import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

const AUTH_HERO_IMAGE =
  'https://whatsappbusiness.com/wp-content/uploads/2026/03/518332268_1302889734686700_451188852508781875_n.png.png';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteWorkspaceName, setInviteWorkspaceName] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const invitedEmail = params.get('email');
    const invitedName = params.get('name');
    const invitedWorkspace = params.get('workspace');
    const requestedMode = params.get('mode');
    const hasInviteContext = params.has('invite') || requestedMode === 'signup';

    if (invitedEmail) setEmail(invitedEmail);
    if (invitedName) setName(invitedName);
    if (invitedWorkspace) setInviteWorkspaceName(invitedWorkspace);
    if (hasInviteContext) setIsLogin(false);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: name,
            onboarded: false,
            createdAt: serverTimestamp()
          });
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-frame app-safe-screen grid overflow-hidden bg-[#f7f8fb] text-slate-950 lg:grid-cols-[56%_44%]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-slate-200/80 bg-white lg:flex">
        <div className="relative flex min-h-screen w-full origin-center scale-75 flex-col px-14 py-12">
          <img src="/waba.svg" alt="WhatsApp Business" className="h-16 w-16 object-contain" />

          <div className="pointer-events-none absolute right-8 top-14 h-[42rem] w-[38rem] max-w-[48vw] xl:right-14 xl:h-[45rem] xl:w-[42rem]">
            <img src={AUTH_HERO_IMAGE} alt="" className="h-full w-full object-contain" />
          </div>

          <div className="relative z-10 mt-auto max-w-[25rem] pb-20 xl:max-w-[29rem]">
            <h1 className="[font-family:var(--font-body)] text-[3.6rem] font-black leading-[1.04] tracking-tight text-slate-950 xl:text-[4.35rem]">
              Do more
              <br />
              with
              <br />
              <span className="text-[#5B45FF]">Conversations.</span>
            </h1>
            <p className="mt-6 max-w-sm text-base font-medium leading-7 text-slate-500">
              Manage chats, calls, broadcasts, templates, and contacts from one focused workspace.
            </p>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen flex-col">
        <header className="flex h-28 shrink-0 items-center justify-center border-b border-slate-200 bg-white lg:hidden">
          <img src="/waba.svg" alt="WhatsApp Business" className="h-16 w-16 object-contain" />
        </header>

        <motion.main
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto flex w-full max-w-[34rem] flex-1 flex-col px-6 pb-10 pt-12 sm:px-8 lg:justify-center lg:pt-0"
        >
          <div className="mb-10 block lg:hidden">
            <h2 className="[font-family:var(--font-body)] text-4xl font-black leading-tight tracking-tight text-slate-950">
              Do more with <span className="text-[#5B45FF]">Conversations.</span>
            </h2>
          </div>

          <div className="flex min-h-[34rem] flex-col rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
            <div>
              <h1 className="[font-family:var(--font-body)] text-2xl font-extrabold tracking-tight text-slate-950">
                {isLogin ? 'Log in to your workspace' : 'Create your workspace'}
              </h1>
              {inviteWorkspaceName && (
                <div className="mt-6 rounded-2xl border border-[#5B45FF]/20 bg-[#5B45FF]/8 px-5 py-4 text-sm font-medium text-[#4338ca]">
                  You have been invited to join <span className="font-bold">{inviteWorkspaceName}</span> on WhatsApp Business.
                </div>
              )}
            </div>

            <form onSubmit={handleAuth} className="mt-8 space-y-4">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#5B45FF] focus:bg-white focus:ring-4 focus:ring-[#5B45FF]/10"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address or mobile number"
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#5B45FF] focus:bg-white focus:ring-4 focus:ring-[#5B45FF]/10"
              />

              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#5B45FF] focus:bg-white focus:ring-4 focus:ring-[#5B45FF]/10"
              />

              {error && (
                <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#5B45FF] text-sm font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-colors hover:bg-[#4b38df] disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  isLogin ? 'Log in' : 'Create account'
                )}
              </button>
            </form>

            {isLogin && (
              <button
                type="button"
                className="mt-6 w-full text-center text-sm font-semibold text-slate-600 hover:text-slate-950"
              >
                Forgotten password?
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="mt-auto flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-[#5B45FF] transition-colors hover:bg-[#5B45FF]/6"
            >
              {isLogin ? 'Create new account' : 'Log in to existing account'}
            </button>

            <div className="mt-8 flex items-center justify-center gap-1 text-base font-semibold text-slate-500">
              <span className="[font-family:var(--font-body)] text-lg font-black leading-none text-[#5B45FF]">&infin;</span>
              <span>Meta</span>
            </div>
          </div>
        </motion.main>
      </section>
    </div>
  );
}
