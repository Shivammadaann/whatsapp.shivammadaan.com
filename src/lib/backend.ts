const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);
const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const resolveConfiguredBackendOrigin = () => {
  const configuredBackendOrigin = import.meta.env.VITE_API_URL?.trim();
  if (!configuredBackendOrigin || configuredBackendOrigin === '/') {
    return '';
  }

  return trimTrailingSlash(configuredBackendOrigin);
};

const resolveRuntimeOrigin = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.origin;
};

const CONFIGURED_BACKEND_ORIGIN = resolveConfiguredBackendOrigin();

export const BACKEND_ORIGIN = CONFIGURED_BACKEND_ORIGIN || resolveRuntimeOrigin();

export const buildBackendUrl = (path: string) =>
  CONFIGURED_BACKEND_ORIGIN
    ? `${CONFIGURED_BACKEND_ORIGIN}${normalizePath(path)}`
    : normalizePath(path);

export const buildBackendWsUrl = (path: string = '/ws') => {
  const socketBase = CONFIGURED_BACKEND_ORIGIN || resolveRuntimeOrigin();
  const socketProtocol = socketBase.startsWith('https://') ? 'wss://' : 'ws://';
  const socketHost = socketBase.replace(/^https?:\/\//, '');
  return `${socketProtocol}${socketHost}${normalizePath(path)}`;
};
