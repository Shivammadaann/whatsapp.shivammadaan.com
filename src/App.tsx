/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { Logo } from './components/Logo';

const ConnectDashboard = lazy(() => import('./pages/ConnectDashboard'));
const Auth = lazy(() => import('./pages/Auth'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(false);
  const previousUserRef = useRef<User | null>(null);
  const splashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onboardingPending =
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem('WhatsApp Business_onboarding_pending') === 'true';

  const renderLoadingScreen = () => (
    <div className="app-mesh-light app-safe-screen flex items-center justify-center px-6 text-slate-900">
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200/80 bg-white/90 px-8 py-7 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <Logo size={54} showText={false} />
        <div>
          <p className="text-sm font-extrabold tracking-tight text-slate-950">Finalizing your workspace</p>
          <div className="mt-4 flex justify-center gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#5B45FF]" style={{ animationDelay: '0ms' }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#5B45FF]" style={{ animationDelay: '150ms' }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#5B45FF]" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      const hadPreviousUser = previousUserRef.current !== null;
      if (currentUser && !hadPreviousUser) {
        setShowSplash(true);
        if (splashTimeoutRef.current) {
          clearTimeout(splashTimeoutRef.current);
        }
        splashTimeoutRef.current = setTimeout(() => setShowSplash(false), 2000);
      }

      previousUserRef.current = currentUser;
      setUser(currentUser);

      if (currentUser) {
        setLoading(true);
      } else {
        if (splashTimeoutRef.current) {
          clearTimeout(splashTimeoutRef.current);
        }
        setShowSplash(false);
        setOnboarded(null);
        setLoading(false);
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('WhatsApp Business_onboarding_pending');
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (splashTimeoutRef.current) {
        clearTimeout(splashTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    setOnboarded(null);

    const unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      const nextOnboarded = docSnap.exists() ? !!docSnap.data().onboarded : false;
      setOnboarded(nextOnboarded);
      setLoading(false);

      if (typeof window !== 'undefined' && nextOnboarded) {
        window.sessionStorage.removeItem('WhatsApp Business_onboarding_pending');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      setLoading(false);
    });

    return () => unsubscribeDoc();
  }, [user]);

  if (loading || showSplash) {
    return (
      <div className="app-mesh-light app-safe-screen flex items-center justify-center px-4 sm:px-6">
        <div className="flex flex-col items-center gap-6">
          <Logo size={80} showText={false} />
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-black tracking-tighter text-slate-950">WhatsApp Business</h1>
            <div className="mt-2 flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#5B45FF] animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-[#5B45FF] animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-[#5B45FF] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Suspense fallback={renderLoadingScreen()}>
        <Routes>
          <Route
            path="/auth"
            element={!user ? <Auth /> : <Navigate to="/" replace />}
          />
          <Route
            path="/onboarding"
            element={
              user ? (
                onboarded === false && !onboardingPending ? (
                  <Onboarding />
                ) : onboarded === null || onboardingPending ? (
                  renderLoadingScreen()
                ) : (
                  <Navigate to="/" replace />
                )
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/whatsapp"
            element={<Navigate to="/" replace />}
          />
          <Route
            path="/crm"
            element={<Navigate to="/" replace />}
          />
          <Route
            path="/"
            element={
              user ? (
                onboarded === true ? (
                  <ConnectDashboard />
                ) : onboarded === false && !onboardingPending ? (
                  <Navigate to="/onboarding" replace />
                ) : (
                  renderLoadingScreen()
                )
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
