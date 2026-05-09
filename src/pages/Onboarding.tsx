import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Camera, ArrowRight, Mail, Phone, User, ShieldCheck } from 'lucide-react';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

import { Logo } from '../components/Logo';

export default function Onboarding() {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const initialNameParts = useMemo(() => {
    const displayName = currentUser?.displayName?.trim() || '';
    if (!displayName) {
      return { firstName: '', lastName: '' };
    }

    const [firstName, ...rest] = displayName.split(/\s+/);
    return {
      firstName,
      lastName: rest.join(' ')
    };
  }, [currentUser?.displayName]);

  const [firstName, setFirstName] = useState(initialNameParts.firstName);
  const [lastName, setLastName] = useState(initialNameParts.lastName);
  const [mobileNumber, setMobileNumber] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [profilePicture, setProfilePicture] = useState(currentUser?.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(initialNameParts.firstName);
    setLastName(initialNameParts.lastName);
  }, [initialNameParts]);

  const handleProfileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProfilePicture(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAccount = async () => {
    if (!currentUser) {
      setError('User session not found. Please sign in again.');
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !mobileNumber.trim()) {
      setError('Please fill in first name, last name, and mobile number.');
      return;
    }

    if (!consentChecked) {
      setError('Please agree to the Terms of Service and Privacy Policies to continue.');
      return;
    }

    setLoading(true);
    setError(null);

    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('WhatsApp Business_onboarding_pending', 'true');
      }

      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        email: currentUser.email || '',
        displayName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        emailAddress: currentUser.email || '',
        contactNumber: mobileNumber.trim(),
        mobileNumber: mobileNumber.trim(),
        profilePicture: profilePicture || '',
        consentAccepted: true,
        consentAcceptedAt: new Date().toISOString(),
        companyName: 'WhatsApp Business',
        onboarded: true,
        createdAt: serverTimestamp()
      }, { merge: true });

      await updateProfile(currentUser, {
        displayName,
        photoURL: profilePicture || currentUser.photoURL || undefined
      });

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('WhatsApp Business_show_welcome', 'true');
      }

      navigate('/', { replace: true });
    } catch (err: any) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('WhatsApp Business_onboarding_pending');
      }
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
      setError(err?.message || 'Unable to create your account right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-frame app-mesh-light app-safe-screen flex items-center justify-center overflow-hidden px-4 py-6 sm:px-6 sm:py-8 text-slate-900">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="form-shell w-full rounded-[1.5rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-7 xl:p-9"
      >
        <div className="grid gap-7 xl:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-start">
          <div>
            <Logo />

            <div className="mt-6 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5">
              <div className="flex items-start gap-4">
                <label className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white shadow-sm">
                  {profilePicture ? (
                    <img src={profilePicture} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="text-[#5B45FF]" size={24} />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} />
                </label>

                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#5B45FF]">Welcome</p>
                  <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 md:text-3xl">
                    Welcome, {firstName || currentUser?.displayName || 'there'}
                  </h1>
                  <p className="mt-2 text-[13px] font-medium leading-6 text-slate-500">
                    A new WhatsApp Business account will be created for the email address <span className="font-semibold text-slate-700">{currentUser?.email || 'No email found'}</span>.
                  </p>
                  <p className="mt-3 text-xs text-slate-500">Upload your profile picture to personalize your workspace from day one.</p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B45FF]/10 text-[#5B45FF]">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Account creation step</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    We are collecting just the essentials so your WhatsApp Business account is ready right after first sign up.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">First Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none focus:border-[#5B45FF] focus:bg-white focus:ring-4 focus:ring-[#5B45FF]/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Last Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none focus:border-[#5B45FF] focus:bg-white focus:ring-4 focus:ring-[#5B45FF]/10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    value={currentUser?.email || ''}
                    disabled
                    className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 py-3.5 pl-12 pr-4 text-sm text-slate-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none focus:border-[#5B45FF] focus:bg-white focus:ring-4 focus:ring-[#5B45FF]/10"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#5B45FF] focus:ring-[#5B45FF]"
                />
                <span className="text-[13px] leading-6 text-slate-600">
                  I agree to the Terms of service and Privacy policies of WhatsApp Business
                </span>
              </label>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-600">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateAccount}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5B45FF] py-3.5 text-sm font-bold text-white shadow-xl shadow-[#5B45FF]/20 transition-all hover:bg-[#5B45FF] disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
