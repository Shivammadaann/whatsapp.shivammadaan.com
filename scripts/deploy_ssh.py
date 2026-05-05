"""
One-time / manual deploy: pack project, upload via SFTP, install deps, restart systemd.
Usage (PowerShell):
  $env:DEPLOY_SSH_PASSWORD = 'your-password'
  python scripts/deploy_ssh.py
"""
from __future__ import annotations

import io
import os
import stat
import subprocess
import sys
import tarfile
from pathlib import Path

import paramiko

HOST = "72.60.218.174"
USER = "root"
REMOTE_DIR = "/opt/WhatsApp Business"
SERVICE_NAME = "WhatsApp Business"


def should_exclude(rel: Path) -> bool:
    parts = rel.parts
    if ".git" in parts or "node_modules" in parts or ".cursor" in parts:
        return True
    if rel.name == ".env.local":
        return True
    return False


def make_tarball(project_root: Path) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz", format=tarfile.GNU_FORMAT) as tar:
        for path in project_root.rglob("*"):
            if not path.is_file():
                continue
            try:
                rel = path.relative_to(project_root)
            except ValueError:
                continue
            if should_exclude(rel):
                continue
            arcname = str(rel).replace("\\", "/")
            info = tar.gettarinfo(name=str(path), arcname=arcname)
            with open(path, "rb") as f:
                tar.addfile(info, f)
    buf.seek(0)
    return buf.read()


def sftp_mkdir_p(sftp: paramiko.SFTPClient, remote: str) -> None:
    parts = remote.strip("/").split("/")
    cur = ""
    for p in parts:
        cur += "/" + p
        try:
            sftp.stat(cur)
        except OSError:
            sftp.mkdir(cur)


def upload_bytes(sftp: paramiko.SFTPClient, data: bytes, remote_path: str) -> None:
    with sftp.open(remote_path, "wb") as f:
        f.write(data)


def main() -> int:
    password = os.environ.get("DEPLOY_SSH_PASSWORD")
    if not password:
        print("Set DEPLOY_SSH_PASSWORD", file=sys.stderr)
        return 1

    project_root = Path(__file__).resolve().parent.parent
    print("Packing", project_root, "...")
    blob = make_tarball(project_root)
    print(f"Tarball size: {len(blob) / 1024 / 1024:.2f} MB")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=password, timeout=60)

    sftp = client.open_sftp()
    try:
        sftp_mkdir_p(sftp, REMOTE_DIR)
        upload_bytes(sftp, blob, "/tmp/WhatsApp Business-deploy.tgz")
    finally:
        sftp.close()

    node_check = "command -v node >/dev/null 2>&1 && node -v || echo MISSING"
    stdin, stdout, stderr = client.exec_command(node_check)
    node_out = stdout.read().decode().strip()
    print("Remote node:", node_out or "(none)")

    install_node = r"""
set -e
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v node && node -v
command -v npm && npm -v
"""

    stdin, stdout, stderr = client.exec_command(install_node)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print(out)
    if err and "WARNING" not in err:
        print(err, file=sys.stderr)

    deploy = rf"""
set -e
mkdir -p {REMOTE_DIR}
cd {REMOTE_DIR}
find {REMOTE_DIR} -mindepth 1 -maxdepth 1 ! -name '.env.local' -exec rm -rf {{}} + 2>/dev/null || true
tar -xzf /tmp/WhatsApp Business-deploy.tgz -C {REMOTE_DIR}
cd {REMOTE_DIR}
npm ci --omit=dev
"""

    stdin, stdout, stderr = client.exec_command(deploy, get_pty=True)
    for line in iter(stdout.readline, ""):
        print(line, end="")
    err = stderr.read().decode()
    if err:
        print(err, file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    if code != 0:
        print(f"Deploy step failed with {code}", file=sys.stderr)
        client.close()
        return code

    unit = f"""[Unit]
Description=WhatsApp Business Express
After=network.target

[Service]
Type=simple
WorkingDirectory={REMOTE_DIR}
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/bash -lc 'cd {REMOTE_DIR} && exec npm run start'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""

    setup_service = f"""
set -e
cat > /etc/systemd/system/{SERVICE_NAME}.service << 'UNITEOF'
{unit}
UNITEOF
systemctl daemon-reload
systemctl enable {SERVICE_NAME}
systemctl restart {SERVICE_NAME}
sleep 2
systemctl is-active {SERVICE_NAME}
curl -sS http://127.0.0.1:3000/api/health || true
"""

    stdin, stdout, stderr = client.exec_command(setup_service, get_pty=True)
    for line in iter(stdout.readline, ""):
        print(line, end="")
    err = stderr.read().decode()
    if err:
        print(err, file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code if code != 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
