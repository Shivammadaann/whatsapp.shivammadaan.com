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
    <div className="page-frame app-safe-screen grid overflow-hidden bg-white text-black lg:grid-cols-[57%_43%]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-[#dadde1] px-12 py-14 lg:flex lg:flex-col">
        <img src="/waba.svg" alt="WhatsApp Business" className="h-20 w-20 object-contain" />

        <div className="pointer-events-none absolute right-10 top-16 h-[45rem] w-[42rem] max-w-[58vw]">
          <img src={AUTH_HERO_IMAGE} alt="" className="h-full w-full object-contain" />
        </div>

        <div className="relative z-10 mt-auto max-w-[28rem] pb-20">
          <h1 className="[font-family:var(--font-body)] text-[4.6rem] font-black leading-[1.05] tracking-normal text-[#0b0b0f] xl:text-[5.3rem]">
            Do More
            <br />
            with
            <br />
            <span className="text-[#0866ff]">Conversations/</span>
          </h1>
        </div>
      </section>

      <section className="flex min-h-screen flex-col">
        <header className="flex h-[10.25rem] shrink-0 items-center justify-center border-b border-[#dadde1] lg:hidden">
          <img src="/waba.svg" alt="WhatsApp Business" className="h-20 w-20 object-contain" />
        </header>

        <motion.main
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto flex w-full max-w-[42.75rem] flex-1 flex-col px-6 pb-10 pt-16 sm:px-0 lg:justify-center lg:pt-0"
        >
          <div className="mb-10 block lg:hidden">
            <h2 className="[font-family:var(--font-body)] text-5xl font-black leading-tight tracking-normal text-[#0b0b0f]">
              Do More with <span className="text-[#0866ff]">Conversations/</span>
            </h2>
          </div>

          <div className="flex min-h-[41rem] flex-col lg:min-h-[34rem]">
            <div>
              <h1 className="[font-family:var(--font-body)] text-2xl font-bold tracking-normal text-black">
                {isLogin ? 'Log in to Facebook' : 'Create new account'}
              </h1>
              {inviteWorkspaceName && (
                <div className="mt-6 rounded-2xl border border-[#0866ff]/20 bg-[#f0f5ff] px-5 py-4 text-[15px] font-medium text-[#0866ff]">
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
                      className="h-[4.75rem] w-full rounded-[1.15rem] border border-[#ccd0d5] bg-white px-5 text-[1.25rem] font-medium text-black outline-none placeholder:text-[#606770] focus:border-black focus:ring-0"
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
                className="h-[4.75rem] w-full rounded-[1.15rem] border border-[#ccd0d5] bg-white px-5 text-[1.25rem] font-medium text-black outline-none placeholder:text-[#606770] focus:border-black focus:ring-0"
              />

              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-[4.75rem] w-full rounded-[1.15rem] border border-[#ccd0d5] bg-white px-5 text-[1.25rem] font-medium text-black outline-none placeholder:text-[#606770] focus:border-[#ccd0d5] focus:ring-0"
              />

              {error && (
                <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-[3.4rem] w-full items-center justify-center rounded-[1.7rem] bg-[#0866ff] text-lg font-bold text-white transition-colors hover:bg-[#075ce5] disabled:opacity-50"
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
                className="mt-7 w-full text-center text-[1.2rem] font-semibold text-black"
              >
                Forgotten password?
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="mt-auto flex h-[3.4rem] w-full items-center justify-center rounded-[1.7rem] border border-[#0866ff] bg-white text-lg font-semibold text-[#0064ff] transition-colors hover:bg-[#f5f8ff]"
            >
              {isLogin ? 'Create new account' : 'Log in to existing account'}
            </button>

            <div className="mt-8 flex items-center justify-center gap-1 text-xl font-semibold text-[#1c1e21]">
              <span className="[font-family:var(--font-body)] text-[1.35rem] font-black leading-none text-[#0866ff]">&infin;</span>
              <span>Meta</span>
            </div>
          </div>
        </motion.main>
      </section>
    </div>
  );
}
