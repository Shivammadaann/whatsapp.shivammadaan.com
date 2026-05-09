import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import {
  Mail,
  BarChart3,
  Settings,
  LogOut,
  LayoutDashboard,
  Users,
  Zap,
  ArrowRight,
  ChevronRight,
  Filter,
  Shield,
  Globe,
  Smartphone,
  CheckCircle2,
  Lock,
  Crown,
  Sparkles,
  BadgeDollarSign,
  Send,
  Database,
  Workflow,
  UserPlus,
  Camera,
  Save,
  BellRing
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { whatsappService } from '../services/whatsappService';

import { Logo } from '../components/Logo';

const WHATSAPP_ICON_URL = 'https://upload.wikimedia.org/wikipedia/commons/1/19/WhatsApp_logo-color-vertical.svg';

function WabaIcon({ size = 18 }: { size?: number }) {
  return <img src="/waba.svg" alt="" width={size} height={size} className="object-contain" />;
}

function BrandImageIcon({ src, alt, size = 18 }: { src: string; alt: string; size?: number }) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="object-contain"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return <BrandImageIcon src={WHATSAPP_ICON_URL} alt="WhatsApp" size={size} />;
}

const plans = [
  {
    id: 'WhatsApp Business-one',
    name: 'WhatsApp Business One',
    price: 'INR 1',
    cadence: '/year',
    description: 'Unlock all current tools and automation features with one annual subscription.',
    highlights: ['WhatsApp Business Inbox', 'CRM access', 'Email tools', 'Analytics', 'Automation features'],
    visuals: [
      { label: 'WhatsApp', icon: WhatsAppIcon },
      { label: 'CRM', icon: Users },
      { label: 'Email', icon: Mail },
      { label: 'SMS', icon: Smartphone },
      { label: 'Marketing', icon: BadgeDollarSign }
    ],
    featured: true
  }
];

const serviceCatalog = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business Inbox',
    description: 'WhatsApp API inbox, broadcasts, templates, and channel operations.',
    icon: WhatsAppIcon,
    path: '/whatsapp',
    price: 'INR 1',
    accent: 'bg-white text-[#5B45FF] border-[#5B45FF]/20',
    surface: 'bg-white',
    ribbon: 'bg-[#5B45FF] text-white',
    visuals: [
      { label: 'WhatsApp', icon: WhatsAppIcon }
    ]
  },
  {
    id: 'crm',
    name: 'WhatsApp Business CRM',
    description: 'Lead tracking, customer notes, and relationship history across channels.',
    icon: Users,
    path: '/crm',
    price: 'INR 1',
    accent: 'bg-white text-[#5B45FF] border-[#5B45FF]/20',
    surface: 'bg-white',
    ribbon: 'bg-violet-100 text-violet-700',
    visuals: [
      { label: 'Contacts', icon: Users },
      { label: 'Pipelines', icon: Workflow },
      { label: 'Records', icon: Database },
      { label: 'Dashboard', icon: LayoutDashboard }
    ]
  },
  {
    id: 'email',
    name: 'Email Marketing',
    description: 'Campaign creation, template journeys, and future cross-channel orchestration.',
    icon: Mail,
    path: '#',
    price: 'INR 1',
    accent: 'bg-white text-[#5B45FF] border-[#5B45FF]/20',
    surface: 'bg-white',
    ribbon: 'bg-sky-100 text-sky-700',
    visuals: [
      { label: 'Email', icon: Mail },
      { label: 'Campaigns', icon: Send },
      { label: 'Audience', icon: Users },
      { label: 'Reports', icon: BarChart3 }
    ]
  },
  {
    id: 'analytics',
    name: 'Advanced Analytics',
    description: 'Performance visibility, reporting, and service-specific growth intelligence.',
    icon: BarChart3,
    path: '#',
    price: 'INR 1',
    accent: 'bg-white text-[#5B45FF] border-[#5B45FF]/20',
    surface: 'bg-white',
    ribbon: 'bg-amber-100 text-amber-700',
    visuals: [
      { label: 'Charts', icon: BarChart3 },
      { label: 'Signals', icon: Sparkles },
      { label: 'Attribution', icon: Globe },
      { label: 'Growth', icon: BadgeDollarSign }
    ]
  }
];

type SubscriptionState = {
  plan?: string | null;
  planStatus?: string | null;
  trialActive?: boolean;
  trialEndsAt?: string | null;
  services?: Record<string, boolean>;
};

type DashboardView = 'dashboard' | 'subscriptions' | 'users' | 'settings';
type WorkspaceRole = 'Owner' | 'Administrator' | 'Manager' | 'Agent';
type WorkspaceMemberStatus = 'active' | 'invited';

type WorkspaceMemberRecord = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  assignedApps: string[];
  status: WorkspaceMemberStatus;
  title?: string;
  invitedAt?: string;
  lastUpdatedAt?: string;
  inviteLink?: string;
};

type AccountSettingsForm = {
  firstName: string;
  lastName: string;
  emailAddress: string;
  contactNumber: string;
  profilePicture: string;
};

type HubNotificationSettings = {
  toastEnabled: boolean;
  soundEnabled: boolean;
  browserEnabled: boolean;
};

const workspaceRoles: WorkspaceRole[] = ['Owner', 'Administrator', 'Manager', 'Agent'];
const defaultHubNotifications: HubNotificationSettings = {
  toastEnabled: true,
  soundEnabled: true,
  browserEnabled: true
};
const workspaceAppLabels: Record<string, string> = {
  whatsapp: 'WhatsApp Business Inbox',
  crm: 'WhatsApp Business CRM',
  email: 'Email Marketing',
  analytics: 'Advanced Analytics'
};

function createWorkspaceMemberId() {
  return `workspace-member-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getWorkspaceAppLabel(appId: string) {
  return workspaceAppLabels[appId] || appId.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeWorkspaceMember(raw: any): WorkspaceMemberRecord {
  return {
    id: String(raw?.id || createWorkspaceMemberId()),
    name: String(raw?.name || raw?.fullName || 'New teammate'),
    email: String(raw?.email || '').trim(),
    role: workspaceRoles.includes(raw?.role) ? raw.role : 'Agent',
    assignedApps: Array.isArray(raw?.assignedApps)
      ? raw.assignedApps.map((entry: any) => String(entry)).filter(Boolean)
      : [],
    status: raw?.status === 'active' ? 'active' : 'invited',
    title: String(raw?.title || ''),
    invitedAt: raw?.invitedAt || raw?.createdAt || new Date().toISOString(),
    lastUpdatedAt: raw?.lastUpdatedAt || raw?.updatedAt || new Date().toISOString(),
    inviteLink: String(raw?.inviteLink || '')
  };
}

export default function ProductDashboard() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>({});
  const [profileData, setProfileData] = useState<any>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'pending_setup'>('pending_setup');
  const [hubNotice, setHubNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberRecord[]>([]);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'Agent' as WorkspaceRole,
    title: '',
    assignedApps: ['whatsapp']
  });
  const [isSavingWorkspaceMembers, setIsSavingWorkspaceMembers] = useState(false);
  const [isInvitingMember, setIsInvitingMember] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountSettingsForm>({
    firstName: '',
    lastName: '',
    emailAddress: '',
    contactNumber: '',
    profilePicture: ''
  });
  const [notificationForm, setNotificationForm] = useState<HubNotificationSettings>(defaultHubNotifications);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const { scrollYProgress } = useScroll();
  const scrollProgress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.2 });

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      const data = snapshot.data() || {};
      setProfileData(data);
      setSubscriptionState(data.subscriptions || {});
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user]);

  const normalizedWorkspaceMembers = useMemo(
    () => (Array.isArray(profileData?.workspaceTeam?.members) ? profileData.workspaceTeam.members.map(normalizeWorkspaceMember) : []),
    [profileData?.workspaceTeam?.members]
  );

  useEffect(() => {
    setWorkspaceMembers(normalizedWorkspaceMembers);
  }, [normalizedWorkspaceMembers]);

  useEffect(() => {
    setAccountForm({
      firstName: profileData?.firstName || profileData?.displayName?.split(' ')[0] || user?.displayName?.split(' ')[0] || '',
      lastName: profileData?.lastName || profileData?.displayName?.split(' ').slice(1).join(' ') || user?.displayName?.split(' ').slice(1).join(' ') || '',
      emailAddress: profileData?.emailAddress || profileData?.email || user?.email || '',
      contactNumber: profileData?.contactNumber || '',
      profilePicture: profileData?.profilePicture || user?.photoURL || ''
    });
  }, [profileData, user?.displayName, user?.email, user?.photoURL]);

  useEffect(() => {
    setNotificationForm(profileData?.notificationSettings || defaultHubNotifications);
  }, [profileData?.notificationSettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const shouldShow = sessionStorage.getItem('WhatsApp Business_show_welcome') === 'true';
    if (!shouldShow) return;

    setShowWelcome(true);
    const timeout = window.setTimeout(() => {
      setShowWelcome(false);
      sessionStorage.removeItem('WhatsApp Business_show_welcome');
    }, 2600);

    return () => window.clearTimeout(timeout);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const persistWorkspaceMembers = async (
    nextMembers: WorkspaceMemberRecord[],
    successText?: string | null,
    errorText = 'Unable to save workspace member changes right now.'
  ) => {
    if (!user) return false;

    setIsSavingWorkspaceMembers(true);
    setWorkspaceMembers(nextMembers);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        workspaceTeam: {
          members: nextMembers,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });
      if (successText) {
        setHubNotice({ tone: 'success', text: successText });
      }
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      setHubNotice({ tone: 'error', text: errorText });
      return false;
    } finally {
      setIsSavingWorkspaceMembers(false);
    }
  };

  const handleInviteMember = async () => {
    if (!isWorkspaceAdmin) {
      setHubNotice({ tone: 'error', text: 'Only admins can invite teammates and manage workspace access.' });
      return;
    }

    const trimmedName = inviteForm.name.trim();
    const trimmedEmail = inviteForm.email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setHubNotice({ tone: 'error', text: 'Add a valid teammate name and work email before sending an invite.' });
      return;
    }

    setIsInvitingMember(true);

    const memberRecord: WorkspaceMemberRecord = {
      id: createWorkspaceMemberId(),
      name: trimmedName,
      email: trimmedEmail,
      role: inviteForm.role,
      assignedApps: inviteForm.assignedApps,
      status: 'invited',
      title: inviteForm.title.trim(),
      invitedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      inviteLink: ''
    };

    const existingIndex = workspaceMembers.findIndex((member) => member.email.toLowerCase() === trimmedEmail);
    const nextMembers = existingIndex >= 0
      ? workspaceMembers.map((member, index) => index === existingIndex ? { ...memberRecord, id: workspaceMembers[existingIndex].id } : member)
      : [memberRecord, ...workspaceMembers];

    try {
      const didSave = await persistWorkspaceMembers(nextMembers, `${trimmedName} was added to the workspace invite list.`, 'Unable to add this teammate to the workspace invite list right now.');
      if (didSave) {
        setInviteForm({
          name: '',
          email: '',
          role: 'Agent',
          title: '',
          assignedApps: workspaceAppOptions.filter((app) => app.unlocked).slice(0, 1).map((app) => app.id)
        });
      }
    } finally {
      setIsInvitingMember(false);
    }
  };

  const updateWorkspaceMember = async (memberId: string, patch: Partial<WorkspaceMemberRecord>, successText: string) => {
    const nextMembers = workspaceMembers.map((member) => member.id === memberId
      ? { ...member, ...patch, lastUpdatedAt: new Date().toISOString() }
      : member
    );
    await persistWorkspaceMembers(nextMembers, successText);
  };

  const removeWorkspaceMember = async (memberId: string) => {
    const nextMembers = workspaceMembers.filter((member) => member.id !== memberId);
    await persistWorkspaceMembers(nextMembers, 'Workspace member removed.');
  };

  const handleAccountImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAccountForm((prev) => ({ ...prev, profilePicture: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAccount = async () => {
    if (!user) return;

    setIsSavingAccount(true);
    const displayName = [accountForm.firstName.trim(), accountForm.lastName.trim()].filter(Boolean).join(' ').trim();
    const nextProfile = {
      firstName: accountForm.firstName.trim(),
      lastName: accountForm.lastName.trim(),
      displayName: displayName || hubAccountName,
      emailAddress: accountForm.emailAddress.trim(),
      contactNumber: accountForm.contactNumber.trim(),
      profilePicture: accountForm.profilePicture || ''
    };

    try {
      await setDoc(doc(db, 'users', user.uid), nextProfile, { merge: true });
      if (displayName || accountForm.profilePicture) {
        await updateProfile(user, {
          displayName: displayName || user.displayName || undefined,
          photoURL: accountForm.profilePicture || user.photoURL || undefined
        });
      }
      setHubNotice({ tone: 'success', text: 'WhatsApp Business account updated successfully.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      setHubNotice({ tone: 'error', text: 'Unable to save your WhatsApp Business account changes right now.' });
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!user) return;
    setIsSavingNotifications(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        notificationSettings: notificationForm
      }, { merge: true });

      if (notificationForm.browserEnabled && 'Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      setHubNotice({ tone: 'success', text: 'Notification preferences saved.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      setHubNotice({ tone: 'error', text: 'Unable to update notification preferences right now.' });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleStartBundleTrial = async () => {
    if (!user) return;

    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      await setDoc(doc(db, 'users', user.uid), {
        subscriptions: {
          plan: 'WhatsApp Business-one',
          planStatus: 'trial',
          trialActive: true,
          trialEndsAt,
          services: {
            whatsapp: true,
            crm: true,
            email: true,
            analytics: true
          }
        }
      }, { merge: true });

      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const hasBundle = subscriptionState.plan === 'WhatsApp Business-one';
  const unlockedServices = useMemo(() => {
    const services = subscriptionState.services || {};
    return serviceCatalog.reduce<Record<string, boolean>>((acc, service) => {
      acc[service.id] = hasBundle || !!services[service.id];
      return acc;
    }, {});
  }, [hasBundle, subscriptionState.services]);

  const isFirstSubscriptionView = !hasBundle && !Object.values(subscriptionState.services || {}).some(Boolean);
  const availableServices = serviceCatalog.filter((service) => unlockedServices[service.id]);
  const trialEndsAtLabel = subscriptionState.trialEndsAt
    ? new Date(subscriptionState.trialEndsAt).toLocaleDateString()
    : null;
  const hubAccountName = profileData?.displayName || user?.displayName || 'Workspace Owner';
  const hubAccountEmail = user?.email || 'No email available';
  const subscriptionBadge = subscriptionState.planStatus === 'trial'
    ? 'Trial'
    : hasBundle || availableServices.length > 0
      ? 'Active'
      : 'Locked';
  const workspaceAppOptions = useMemo(
    () => serviceCatalog.map((service) => ({
      id: service.id,
      label: service.name,
      unlocked: unlockedServices[service.id]
    })),
    [unlockedServices]
  );
  const isWorkspaceAdmin = (profileData?.role || 'admin') === 'admin';
  const workspaceOwnerMember = useMemo<WorkspaceMemberRecord>(() => ({
    id: user?.uid || 'workspace-owner',
    name: hubAccountName,
    email: hubAccountEmail,
    role: 'Owner',
    assignedApps: Object.entries(unlockedServices).filter(([, enabled]) => enabled).map(([appId]) => appId),
    status: 'active',
    title: 'Workspace Owner',
    invitedAt: profileData?.createdAt || new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString()
  }), [hubAccountEmail, hubAccountName, profileData?.createdAt, unlockedServices, user?.uid]);
  const visibleWorkspaceMembers = useMemo(
    () => [workspaceOwnerMember, ...workspaceMembers.filter((member) => member.email.toLowerCase() !== workspaceOwnerMember.email.toLowerCase())],
    [workspaceMembers, workspaceOwnerMember]
  );
  const pendingInviteCount = workspaceMembers.filter((member) => member.status === 'invited').length;
  const adminCount = visibleWorkspaceMembers.filter((member) => member.role === 'Owner' || member.role === 'Administrator').length;

  useEffect(() => {
    const loadWhatsappStatus = async () => {
      const creds = profileData?.whatsappCredentials;
      const setupCompleted = Boolean(profileData?.toolSetup?.whatsapp || creds);

      if (!unlockedServices.whatsapp || !setupCompleted || !creds) {
        whatsappService.clearCredentials();
        setWhatsappStatus('pending_setup');
        return;
      }

      try {
        whatsappService.setCredentials(
          creds.accessToken,
          creds.phoneNumberId,
          creds.businessAccountId
        );
        const phoneNumbers = await whatsappService.getPhoneNumbers();
        const targetPhone = phoneNumbers.find((phone) => phone.phoneId === creds.phoneNumberId) || phoneNumbers[0];
        setWhatsappStatus(targetPhone?.status?.toUpperCase() === 'CONNECTED' ? 'connected' : 'disconnected');
      } catch (error) {
        console.error('Failed to load WhatsApp connection status:', error);
        setWhatsappStatus('disconnected');
      }
    };

    loadWhatsappStatus();
  }, [profileData, unlockedServices.whatsapp]);

  const toolStatusMap = useMemo(() => {
    return serviceCatalog.reduce<Record<string, 'Connected' | 'Disconnected' | 'Pending Setup'>>((acc, service) => {
      if (!unlockedServices[service.id]) {
        acc[service.id] = 'Pending Setup';
        return acc;
      }

      if (service.id === 'whatsapp') {
        acc[service.id] = whatsappStatus === 'connected'
          ? 'Connected'
          : whatsappStatus === 'disconnected'
            ? 'Disconnected'
            : 'Pending Setup';
        return acc;
      }

      const completed = Boolean(profileData?.toolSetup?.[service.id]);
      acc[service.id] = completed ? 'Connected' : 'Pending Setup';
      return acc;
    }, {});
  }, [profileData, unlockedServices, whatsappStatus]);

  return (
    <div
      className="page-frame app-mesh-light app-safe-screen relative overflow-hidden text-slate-900"
      style={{ ['--connect-sidebar-width' as any]: isSidebarCollapsed ? '5.5rem' : 'var(--app-sidebar-width)' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-white" />
      <motion.div
        style={{ scaleX: scrollProgress }}
        className="fixed left-0 right-0 top-0 z-[160] h-1 origin-left bg-gradient-to-r from-[#5B45FF] via-[#34d399] to-[#0ea5e9]"
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 22, 0], y: [0, -18, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-[-8rem] top-[-5rem] h-72 w-72 rounded-full bg-[#5B45FF]/10 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -18, 0], y: [0, 22, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute right-[-7rem] top-24 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 14, 0], y: [0, 18, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[-10rem] left-1/3 h-80 w-80 rounded-full bg-[#5B45FF]/60 blur-3xl"
        />
      </div>
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] flex items-center justify-center bg-white/96 backdrop-blur-xl"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.45 }}
              className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white px-6 py-8 text-center shadow-[0_28px_80px_rgba(91,69,255,0.1)] sm:px-8 sm:py-9"
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0.8 }}
                animate={{ scale: [1, 1.04, 1], opacity: [0.85, 1, 0.9] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="mx-auto flex h-18 w-18 items-center justify-center rounded-[1.8rem] bg-[#5B45FF] text-white shadow-xl shadow-[#5B45FF]/25"
              >
                <Sparkles size={26} />
              </motion.div>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.32em] text-[#5B45FF]">Welcome aboard</p>
              <h2 className="mt-3 text-[2rem] font-black tracking-tight text-slate-950">Welcome to WhatsApp Business</h2>
              <p className="mt-3 text-[13px] font-medium leading-6 text-slate-500">
                Your workspace is ready. We are taking you to your dashboard so you can choose the services you want to unlock.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed left-0 top-0 bottom-0 z-[70] flex h-full w-[var(--app-sidebar-width)] translate-x-[-100%] flex-col border-r backdrop-blur-xl transition-all duration-300 lg:translate-x-0 lg:[width:var(--connect-sidebar-width)]",
        isSidebarOpen && "translate-x-0",
        "border-[#5B45FF] bg-[linear-gradient(180deg,#F1EFFF_0%,#ffffff_20%)] shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
      )}>
        <div className={cn("p-4 flex items-start justify-between gap-3", isSidebarCollapsed && "lg:flex-col lg:items-center")}>
          <div className={cn("min-w-0", isSidebarCollapsed && "lg:flex lg:w-full lg:justify-center")}>
            <div className="space-y-3">
              <Logo variant="compact" showText={!isSidebarCollapsed} />
              {!isSidebarCollapsed && (
                <div className="rounded-2xl border border-[#5B45FF] bg-[#5B45FF] px-3 py-2 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/75">Workspace</p>
                  <p className="mt-1 text-sm font-bold text-white">WhatsApp Business Hub</p>
                </div>
              )}
            </div>
          </div>
          <div className={cn("flex items-center gap-2", isSidebarCollapsed && "lg:w-full lg:justify-center")}>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-600 transition-all hover:bg-white lg:flex"
            >
              <ChevronRight className={cn("transition-transform", !isSidebarCollapsed && "rotate-180")} size={18} />
            </button>
            <button type="button" onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 lg:hidden">
              <ChevronRight className="rotate-180" />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-2 no-scrollbar">
          <NavItem
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            active={activeView === 'dashboard'}
            onClick={() => { setActiveView('dashboard'); setIsSidebarOpen(false); }}
            collapsed={isSidebarCollapsed}
          />
          <NavItem
            icon={<Users size={20} />}
            label="Subscriptions"
            active={activeView === 'subscriptions'}
            onClick={() => { setActiveView('subscriptions'); setIsSidebarOpen(false); }}
            badge={subscriptionBadge}
            collapsed={isSidebarCollapsed}
          />
          <NavItem
            icon={<UserPlus size={20} />}
            label="User Management"
            active={activeView === 'users'}
            onClick={() => { setActiveView('users'); setIsSidebarOpen(false); }}
            badge={pendingInviteCount > 0 ? String(pendingInviteCount) : undefined}
            collapsed={isSidebarCollapsed}
          />
          <NavItem
            icon={<Settings size={20} />}
            label="Account"
            active={activeView === 'settings'}
            onClick={() => { setActiveView('settings'); setIsSidebarOpen(false); }}
            collapsed={isSidebarCollapsed}
          />
        </nav>

        <div className="border-t border-slate-200/80 p-4">
          <div className={cn(
            "mb-3 flex items-center gap-3 rounded-[1.4rem] border border-[#5B45FF] bg-[#5B45FF]/80 px-3 py-3 text-white",
            isSidebarCollapsed && "lg:justify-center lg:px-2"
          )}>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-sm font-black text-white">
              {hubAccountName[0] || 'U'}
            </div>
            <div className={cn("min-w-0", isSidebarCollapsed && "lg:hidden")}>
              <p className="truncate text-sm font-bold">{hubAccountName}</p>
              <p className="truncate text-xs text-white/75">{hubAccountEmail}</p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title="Sign Out"
            className={cn("flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-red-500 transition-all hover:bg-red-500/10", isSidebarCollapsed && "lg:justify-center lg:px-0")}
          >
            <LogOut size={20} />
            <span className={cn(isSidebarCollapsed && "lg:hidden")}>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="screen-shell desktop-sidebar-offset relative">
        <div className="mx-auto max-w-[84rem]">
          <header className="app-header-card app-header-compact mb-7 backdrop-blur-xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="app-header-action-secondary rounded-xl p-2 lg:hidden"
                >
                  <Filter size={20} />
                </button>
                <div className="min-w-0">
                  {(activeView !== 'dashboard' || isFirstSubscriptionView) && (
                    <p className="app-header-eyebrow text-[10px] font-bold uppercase tracking-[0.28em]">
                      {activeView === 'subscriptions'
                        ? 'Subscription center'
                        : activeView === 'users'
                          ? 'Workspace access'
                        : activeView === 'settings'
                          ? 'WhatsApp Business account'
                          : 'Choose your subscription'}
                    </p>
                  )}
                  <h1 className="app-header-title mt-1 font-black tracking-tight">
                    {activeView === 'subscriptions'
                      ? 'Manage your plan, trial, and unlocked services.'
                      : activeView === 'users'
                        ? 'Invite teammates, assign roles, and control app access.'
                      : activeView === 'settings'
                        ? 'Edit your WhatsApp Business account and workspace preferences.'
                      : isFirstSubscriptionView
                          ? 'Select the WhatsApp Business services you want to unlock.'
                          : 'Access your Business Tools from one centralized Hub.'}
                  </h1>
                  <p className="app-header-copy mt-2 max-w-3xl text-[12px] font-medium leading-5">
                    {activeView === 'subscriptions'
                      ? 'Track your current subscription, trial state, and the products your account can access.'
                      : activeView === 'users'
                        ? 'Admins can invite teammates, assign roles, and decide which WhatsApp Business apps each person should work inside.'
                      : activeView === 'settings'
                        ? 'Update your profile, contact details, notifications, and other WhatsApp Business account preferences from one place.'
                      : isFirstSubscriptionView
                          ? 'If this is your first time here, start with WhatsApp Business One for full access or unlock only the individual services you want right now.'
                          : 'Your home dashboard now works like an app drawer, showing only the products your account can access right now.'}
                  </p>
                  {activeView !== 'settings' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="app-header-chip rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]">
                        {hasBundle ? 'WhatsApp Business One active' : 'Annual bundle'}
                      </span>
                      <span className="app-header-chip rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]">
                        {subscriptionState.planStatus === 'trial' ? `Trial until ${trialEndsAtLabel || 'active'}` : 'Trial ready'}
                      </span>
                      {isFirstSubscriptionView && (
                        <span className="app-header-chip rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]">
                          Service unlocks
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {!isFirstSubscriptionView && activeView === 'dashboard' && (
                <button
                  onClick={() => setActiveView('subscriptions')}
                  className="app-header-action inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-[12px] font-bold transition-all"
                >
                  Add more tools
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </header>

          {hubNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "mb-5 rounded-[1.4rem] border px-4 py-3 text-sm font-semibold shadow-sm",
                hubNotice.tone === 'success'
                  ? "border-[#5B45FF] bg-[#5B45FF] text-white"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              )}
            >
              {hubNotice.text}
            </motion.div>
          )}

          {activeView === 'dashboard' && (isFirstSubscriptionView ? (
            <>
          <HubRevealSection className="mb-7">
            <div className="mb-5 flex items-center gap-3">
              <Crown className="text-[#5B45FF]" size={20} />
              <h2 className="text-lg font-black tracking-tight text-slate-950">Bundle plan</h2>
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-[1.8rem] border p-5 shadow-[0_20px_60px_rgba(86,68,229,0.10)]",
                    plan.featured ? "border-[#5B45FF] bg-white shadow-[0_24px_70px_rgba(91,69,255,0.1)]" : "border-slate-200 bg-white"
                  )}
                >
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#5B45FF]">Featured plan</p>
                      <h3 className="mt-2 text-[1.8rem] font-black tracking-tight text-slate-950">{plan.name}</h3>
                      <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-500">{plan.description}</p>
                      <div className="mt-4">
                        <AnimatedIconStrip items={plan.visuals} mode="bundle" />
                      </div>
                    </div>
                    <div className="w-fit min-w-[7.75rem] justify-self-end rounded-[1rem] border border-slate-200 bg-[#5B45FF] px-3.5 py-2.5 text-right text-white shadow-[0_18px_40px_rgba(91,69,255,0.22)]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">One annual fee</p>
                      <p className="mt-1 text-[1.3rem] font-black tracking-tight">{plan.price}</p>
                      <p className="text-[12px] font-medium text-white/80">{plan.cadence}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {plan.highlights.map((highlight) => (
                      <div key={highlight} className="flex items-center gap-3 rounded-2xl border border-[#D9D3FF] bg-white/90 px-4 py-3 text-[13px] font-semibold text-slate-700">
                        <CheckCircle2 className="text-[#5B45FF]" size={16} />
                        {highlight}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={handleStartBundleTrial}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#5B45FF] px-5 py-3 text-[13px] font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#5B45FF]"
                    >
                      Get Started
                      <ArrowRight size={16} />
                    </button>
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-[#D9D3FF] bg-white px-5 py-3 text-[13px] font-medium text-slate-500">
                      <Shield size={16} className="text-[#5B45FF]" />
                      All in One Business Suite
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-[#5B45FF] bg-[#5B45FF] px-5 py-3 text-[13px] font-medium text-white">
                      <Sparkles size={16} className="text-[#5B45FF]" />
                      7 Days Free Trial
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(91,69,255,0.08)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#5B45FF]">How access works</p>
                <div className="mt-4 space-y-3">
                  <InfoLine icon={Lock} title="Pay per service" copy="If you subscribe to only one tool, only that tool becomes available in the dashboard." />
                  <InfoLine icon={WabaIcon} title="Start with WhatsApp only" copy="You can take just WhatsApp Business Inbox now and add CRM or other services later." />
                  <InfoLine icon={Globe} title="Expand when ready" copy="Every add-on can be unlocked later with a separate payment flow." />
                </div>
              </div>
            </div>
          </HubRevealSection>

          <HubRevealSection className="mb-7">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-950">Individual services</h2>
                <p className="mt-1 text-[13px] text-slate-500">Subscribe only to the services you need right now.</p>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[#5B45FF]">
                Testing price: INR 1
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {serviceCatalog.map((service, idx) => {
                const isUnlocked = unlockedServices[service.id];
                const setupRequired = toolStatusMap[service.id] === 'Pending Setup';
                return (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className={cn(
                      "rounded-[1.45rem] border p-4 shadow-[0_14px_38px_rgba(91,69,255,0.08)]",
                      "border-slate-200",
                      service.surface
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", service.accent)}>
                        <service.icon size={20} />
                      </div>
                      <span className={cn(
                        "rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em]",
                        isUnlocked ? "bg-[#5B45FF] text-white" : service.ribbon
                      )}>
                        {isUnlocked ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-bold tracking-tight text-slate-950">{service.name}</h3>
                    <p className="mt-1.5 text-[12px] leading-5 text-slate-500">{service.description}</p>

                    <div className="mt-3">
                      <AnimatedIconStrip items={service.visuals} mode={service.id === 'whatsapp' ? 'connect' : service.id === 'crm' ? 'crm' : 'service'} />
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5B45FF]">Price</p>
                        <p className="mt-1 text-[1.3rem] font-black tracking-tight text-slate-950">{service.price}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Access</p>
                        <p className="mt-1 text-[12px] font-semibold text-slate-600">{isUnlocked ? 'Available now' : 'Pay to unlock'}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {isUnlocked && service.path !== '#' ? (
                        <button
                          onClick={() => navigate(service.path)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[#5B45FF] px-4 py-2.5 text-[12px] font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#5B45FF]"
                        >
                          {setupRequired ? 'Setup Service' : 'Open Service'}
                          <ArrowRight size={16} />
                        </button>
                      ) : (
                        <button className="inline-flex items-center gap-2 rounded-2xl bg-[#5B45FF] px-4 py-2.5 text-[12px] font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#5B45FF]">
                          Get Started
                          <ArrowRight size={16} />
                        </button>
                      )}

                      {!isUnlocked && (
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-[#D9D3FF] bg-white px-4 py-2.5 text-[12px] font-medium text-slate-500">
                          <Lock size={15} className="text-[#5B45FF]" />
                          Locked until payment
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </HubRevealSection>

          <HubRevealSection className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(91,69,255,0.06)]">
              <h2 className="text-lg font-black tracking-tight text-slate-950">Current access status</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <MiniStat label="Bundle plan" value={hasBundle ? 'Active' : 'Not active'} />
                <MiniStat label="Unlocked tools" value={String(Object.values(unlockedServices).filter(Boolean).length)} />
                <MiniStat label="Billing mode" value="Annual / add-on" />
              </div>
            </div>
          </HubRevealSection>
            </>
          ) : (
            <>
              <HubRevealSection className="mb-7">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-slate-950">Apps & tools</h2>
                    <p className="mt-1 text-[13px] text-slate-500">Only the services your account can use are shown here.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {availableServices.map((service, idx) => {
                    const setupRequired = toolStatusMap[service.id] === 'Pending Setup';

                    return (
                      <motion.button
                        key={service.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        onClick={() => service.path !== '#' && navigate(service.path)}
                        className={cn(
                          "group rounded-[1.45rem] border p-4 text-left shadow-[0_16px_42px_rgba(86,68,229,0.08)] transition-all hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(86,68,229,0.14)]",
                          "border-[#D9D3FF]",
                          service.surface
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", service.accent)}>
                            <service.icon size={20} />
                          </div>
                          <span className={cn(
                            "rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em]",
                            toolStatusMap[service.id] === 'Connected'
                              ? "bg-[#5B45FF] text-white"
                              : toolStatusMap[service.id] === 'Disconnected'
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                          )}>
                            {toolStatusMap[service.id]}
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-bold tracking-tight text-slate-950">{service.name}</h3>
                        <p className="mt-1.5 text-[12px] leading-5 text-slate-500">{service.description}</p>

                        <div className="mt-3">
                          <AnimatedIconStrip items={service.visuals} mode={service.id === 'whatsapp' ? 'connect' : service.id === 'crm' ? 'crm' : 'service'} />
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#E2DEFF] bg-white/80 px-3 py-2.5">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Mode</p>
                            <p className="mt-1 text-[12px] font-semibold text-slate-700">
                              {toolStatusMap[service.id] === 'Pending Setup'
                                ? 'Setup required'
                                : subscriptionState.planStatus === 'trial'
                                  ? 'Trial access'
                                  : 'Subscribed'}
                            </p>
                          </div>
                          <div className="inline-flex items-center gap-2 text-[12px] font-bold text-[#5B45FF] transition-transform group-hover:translate-x-1">
                            {setupRequired ? 'Setup' : 'Open'}
                            <ArrowRight size={16} />
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </HubRevealSection>
            </>
          ))}

          {activeView === 'subscriptions' && (
            <HubRevealSection className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(91,69,255,0.06)]">
                <h2 className="text-lg font-black tracking-tight text-slate-950">Subscription status</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <MiniStat label="Active plan" value={hasBundle ? 'WhatsApp Business One' : 'Custom'} />
                  <MiniStat label="Unlocked tools" value={String(Object.values(unlockedServices).filter(Boolean).length)} />
                  <MiniStat label="Trial status" value={subscriptionState.planStatus === 'trial' ? 'In trial' : 'Active'} />
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(91,69,255,0.06)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#5B45FF]">Included access</p>
                <div className="mt-4 space-y-3">
                  {availableServices.length === 0 ? (
                    <p className="text-[13px] leading-6 text-slate-500">No services unlocked yet.</p>
                  ) : (
                    availableServices.map((service) => (
                      <div key={service.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", service.accent)}>
                          <service.icon size={18} />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-900">{service.name}</p>
                          <p className="text-[12px] text-slate-500">{subscriptionState.planStatus === 'trial' ? 'Trial access' : 'Subscribed access'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </HubRevealSection>
          )}

          {activeView === 'users' && (
            <div className="space-y-6">
              <HubRevealSection className="grid gap-4 md:grid-cols-4">
                <MiniStat label="Workspace members" value={String(visibleWorkspaceMembers.length)} />
                <MiniStat label="Pending invites" value={String(pendingInviteCount)} />
                <MiniStat label="Admins" value={String(adminCount)} />
                <MiniStat label="Apps assignable" value={String(workspaceAppOptions.filter((app) => app.unlocked).length)} />
              </HubRevealSection>

              <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                <HubRevealSection className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(91,69,255,0.06)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#5B45FF]">Invite new user</p>
                      <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950">Team access & invitations</h2>
                      <p className="mt-2 text-[13px] leading-6 text-slate-500">
                        Invite teammates, choose their role, decide which WhatsApp Business apps they should use, and send a real email invitation instantly.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#5B45FF] bg-[#5B45FF] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                      {isWorkspaceAdmin ? 'Admin controls' : 'Read only'}
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    <HubField label="Full Name">
                      <input
                        value={inviteForm.name}
                        onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))}
                        disabled={!isWorkspaceAdmin}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#5B45FF]"
                      />
                    </HubField>
                    <HubField label="Work Email">
                      <input
                        value={inviteForm.email}
                        onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                        disabled={!isWorkspaceAdmin}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#5B45FF]"
                      />
                    </HubField>
                    <div className="grid gap-4 md:grid-cols-2">
                      <HubField label="Role">
                        <select
                          value={inviteForm.role}
                          onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value as WorkspaceRole }))}
                          disabled={!isWorkspaceAdmin}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#5B45FF]"
                        >
                          {workspaceRoles.filter((role) => role !== 'Owner').map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </HubField>
                      <HubField label="Title">
                        <input
                          value={inviteForm.title}
                          onChange={(event) => setInviteForm((current) => ({ ...current, title: event.target.value }))}
                          disabled={!isWorkspaceAdmin}
                          placeholder="Sales Lead"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#5B45FF]"
                        />
                      </HubField>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Assign Apps</p>
                      <div className="mt-3 grid gap-2">
                        {workspaceAppOptions.map((app) => {
                          const selected = inviteForm.assignedApps.includes(app.id);
                          return (
                            <button
                              key={app.id}
                              type="button"
                              disabled={!isWorkspaceAdmin || !app.unlocked}
                              onClick={() => setInviteForm((current) => ({
                                ...current,
                                assignedApps: selected
                                  ? current.assignedApps.filter((entry) => entry !== app.id)
                                  : [...current.assignedApps, app.id]
                              }))}
                              className={cn(
                                "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-all",
                                selected
                                  ? "border-[#5B45FF] bg-[#5B45FF] text-white"
                                  : "border-slate-200 bg-white text-slate-600",
                                !app.unlocked && "cursor-not-allowed opacity-50"
                              )}
                            >
                              <span className="font-semibold">{app.label}</span>
                              <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                                {!app.unlocked ? 'Locked' : selected ? 'Assigned' : 'Available'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleInviteMember()}
                      disabled={!isWorkspaceAdmin || isSavingWorkspaceMembers || isInvitingMember}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#5B45FF] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#5B45FF] disabled:opacity-50"
                    >
                      <UserPlus size={16} />
                      {isInvitingMember ? 'Sending Invite...' : isSavingWorkspaceMembers ? 'Saving...' : 'Invite Team Member'}
                    </button>
                  </div>
                </HubRevealSection>

                <HubRevealSection className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(91,69,255,0.06)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#5B45FF]">User management</p>
                      <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950">Roles, app access, and invite status</h2>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
                      {visibleWorkspaceMembers.length} records
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {visibleWorkspaceMembers.map((member, index) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.25 }}
                        transition={{ delay: index * 0.04 }}
                        className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5B45FF]/10 text-sm font-black text-[#5B45FF]">
                                {(member.name || member.email || 'U')[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-950">{member.name}</p>
                                <p className="truncate text-xs text-slate-500">{member.email}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className={cn(
                                "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                                member.status === 'active' ? "bg-[#5B45FF] text-white" : "bg-amber-100 text-amber-700"
                              )}>
                                {member.status === 'active' ? 'Active' : 'Invited'}
                              </span>
                              {member.title && (
                                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                                  {member.title}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={member.role}
                              disabled={!isWorkspaceAdmin || member.role === 'Owner'}
                              onChange={(event) => void updateWorkspaceMember(member.id, { role: event.target.value as WorkspaceRole }, `${member.name}'s role updated.`)}
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-[#5B45FF] disabled:opacity-60"
                            >
                              {workspaceRoles.map((role) => (
                                <option key={role} value={role}>{role}</option>
                              ))}
                            </select>
                            {member.role !== 'Owner' && (
                              <button
                                type="button"
                                disabled={!isWorkspaceAdmin}
                                onClick={() => void removeWorkspaceMember(member.id)}
                                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-50"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          {workspaceAppOptions.map((app) => {
                            const assigned = member.assignedApps.includes(app.id);
                            return (
                              <button
                                key={`${member.id}-${app.id}`}
                                type="button"
                                disabled={!isWorkspaceAdmin || member.role === 'Owner' || !app.unlocked}
                                onClick={() => void updateWorkspaceMember(member.id, {
                                  assignedApps: assigned
                                    ? member.assignedApps.filter((entry) => entry !== app.id)
                                    : [...member.assignedApps, app.id]
                                }, `${member.name}'s app access updated.`)}
                                className={cn(
                                  "rounded-2xl border px-3 py-3 text-left text-sm transition-all",
                                  assigned
                                    ? "border-[#5B45FF] bg-[#5B45FF] text-white"
                                    : "border-white bg-white text-slate-500",
                                  !app.unlocked && "cursor-not-allowed opacity-50"
                                )}
                              >
                                <p className="font-bold">{app.label}</p>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.18em]">
                                  {!app.unlocked ? 'Locked' : assigned ? 'Assigned' : 'Not assigned'}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </HubRevealSection>
              </div>
            </div>
          )}

          {activeView === 'settings' && (
            <div className="space-y-6">
              <HubRevealSection className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(91,69,255,0.06)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#5B45FF]">WhatsApp Business Account</p>
                    <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950">Edit your Hub profile and account details</h2>
                    <p className="mt-2 text-[13px] leading-6 text-slate-500">
                      Update the same core account fields you can already manage inside Inbox, now directly from WhatsApp Business Hub.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveAccount()}
                    disabled={isSavingAccount}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#5B45FF] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#5B45FF] disabled:opacity-50"
                  >
                    <Save size={16} />
                    {isSavingAccount ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

                <div className="mt-6 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-4 flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] bg-[#5B45FF] text-white shadow-lg">
                        {accountForm.profilePicture ? (
                          <img src={accountForm.profilePicture} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-3xl font-black">{(accountForm.firstName || hubAccountName || '?')[0]}</span>
                        )}
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:border-[#5B45FF]">
                        <Camera size={16} className="text-[#5B45FF]" />
                        Change Picture
                        <input type="file" accept="image/*" className="hidden" onChange={handleAccountImageUpload} />
                      </label>
                      <p className="mt-3 text-xs text-slate-500">Use a square image for the cleanest profile display.</p>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <HubField label="First Name">
                      <input value={accountForm.firstName} onChange={(event) => setAccountForm((current) => ({ ...current, firstName: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]" />
                    </HubField>
                    <HubField label="Last Name">
                      <input value={accountForm.lastName} onChange={(event) => setAccountForm((current) => ({ ...current, lastName: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]" />
                    </HubField>
                    <HubField label="Email Address">
                      <input value={accountForm.emailAddress} onChange={(event) => setAccountForm((current) => ({ ...current, emailAddress: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]" />
                    </HubField>
                    <HubField label="Contact Number">
                      <input value={accountForm.contactNumber} onChange={(event) => setAccountForm((current) => ({ ...current, contactNumber: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]" />
                    </HubField>
                  </div>
                </div>
              </HubRevealSection>

              <HubRevealSection className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(91,69,255,0.06)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#5B45FF]">Notifications</p>
                    <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950">Workspace notification preferences</h2>
                    <p className="mt-2 text-[13px] leading-6 text-slate-500">
                      Tune browser alerts, sound, and in-app toast behavior for your WhatsApp Business workspace.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveNotifications()}
                    disabled={isSavingNotifications}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-all hover:border-[#5B45FF] disabled:opacity-50"
                  >
                    <BellRing size={16} className="text-[#5B45FF]" />
                    {isSavingNotifications ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {[
                    { key: 'toastEnabled', label: 'Toast notifications', copy: 'Show quick in-app message notifications while you work.' },
                    { key: 'soundEnabled', label: 'Sound alerts', copy: 'Play audio cues for important conversation and workspace updates.' },
                    { key: 'browserEnabled', label: 'Browser notifications', copy: 'Allow desktop notifications for attention-worthy activity.' }
                  ].map((item, index) => (
                    <motion.button
                      key={item.key}
                      type="button"
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setNotificationForm((current) => ({ ...current, [item.key]: !current[item.key as keyof HubNotificationSettings] }))}
                      className={cn(
                        "rounded-[1.4rem] border p-5 text-left transition-all",
                        notificationForm[item.key as keyof HubNotificationSettings]
                          ? "border-[#5B45FF] bg-[#5B45FF] text-white"
                          : "border-slate-200 bg-slate-50/80"
                      )}
                    >
                      <p className={cn("text-sm font-bold", notificationForm[item.key as keyof HubNotificationSettings] ? "text-white" : "text-slate-950")}>{item.label}</p>
                      <p className={cn("mt-2 text-[13px] leading-6", notificationForm[item.key as keyof HubNotificationSettings] ? "text-white/75" : "text-slate-500")}>{item.copy}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className={cn("text-[11px] font-bold uppercase tracking-[0.18em]", notificationForm[item.key as keyof HubNotificationSettings] ? "text-white/70" : "text-slate-400")}>Status</span>
                        <span className={cn(
                          "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                          notificationForm[item.key as keyof HubNotificationSettings]
                            ? "bg-white text-[#5B45FF]"
                            : "bg-white text-slate-500"
                        )}>
                          {notificationForm[item.key as keyof HubNotificationSettings] ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </HubRevealSection>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setShowLogoutConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="relative w-full max-w-md rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-[0_28px_80px_rgba(91,69,255,0.16)]"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#5B45FF]">Sign out</p>
              <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Are you sure you want to sign out?</h3>
              <p className="mt-3 text-[13px] leading-6 text-slate-500">
                You will be signed out of WhatsApp Business Hub and returned to the login screen.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-bold text-slate-600 transition-all hover:bg-slate-50"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowLogoutConfirm(false);
                    await handleLogout();
                  }}
                  className="flex-1 rounded-2xl bg-[#5B45FF] px-4 py-3 text-[13px] font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#5B45FF]"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick, badge, collapsed = false }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; badge?: string; collapsed?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-sm font-medium transition-all",
        collapsed && "lg:justify-center",
        active
          ? "border-[#5B45FF] bg-[#5B45FF] text-white shadow-[0_12px_30px_rgba(91,69,255,0.18)]"
          : "border-transparent text-slate-600 hover:border-[#5B45FF] hover:bg-[#5B45FF]/80 hover:text-white"
      )}
    >
      <span className="flex items-center gap-3">
        <span className={cn(
          "flex h-10 w-10 items-center justify-center rounded-2xl transition-all",
          active ? "bg-white/15 text-white" : "bg-[#5B45FF] text-white group-hover:bg-white"
        )}>
          {icon}
        </span>
        <span className={cn("font-semibold", collapsed && "lg:hidden")}>{label}</span>
      </span>
      {badge && !collapsed && (
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]",
          active ? "bg-white/15 text-white" : "bg-[#5B45FF] text-white"
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}

function InfoLine({ icon: Icon, title, copy }: { icon: any; title: string; copy: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#E2DEFF] bg-[#FAF9FF] p-3.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#5B45FF]">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[13px] font-bold text-slate-900">{title}</p>
        <p className="mt-1 text-[13px] leading-6 text-slate-500">{copy}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E2DEFF] bg-[#FAF9FF] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function HubRevealSection({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function HubField({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function AnimatedIconStrip({
  items,
  mode
}: {
  items: Array<{ label: string; icon: any }>;
  mode: 'bundle' | 'connect' | 'crm' | 'service';
}) {
  const heightClass = mode === 'bundle' ? 'h-[6.8rem]' : 'h-[6.4rem]';
  const positions = mode === 'bundle'
    ? [
        { left: '2%', top: '17%' },
        { left: '15%', top: '15%' },
        { left: '28%', top: '17%' },
        { left: '41%', top: '15%' },
        { left: '54%', top: '17%' },
        { left: '67%', top: '15%' },
        { left: '80%', top: '17%' },
        { left: '89%', top: '15%' }
      ]
    : [
        { left: '10%', top: '18%' },
        { left: '60%', top: '18%' },
        { left: '35%', top: '60%' },
        { left: '60%', top: '60%' }
      ];

  return (
    <div className={cn("relative overflow-hidden rounded-[1.5rem] border border-[#D9D3FF] bg-[#FAF9FF]", heightClass)}>
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.22, 0.38, 0.22] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5B45FF]/10 blur-2xl"
      />
      <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[0.9rem] bg-[#5B45FF] text-white shadow-lg shadow-[#5B45FF]/20">
        {mode === 'connect' ? <WhatsAppIcon size={16} /> : mode === 'crm' ? <Users size={16} /> : <Crown size={16} />}
      </div>
      {items.map((item, index) => {
        const Icon = item.icon;
        const position = positions[index] || positions[positions.length - 1];
        const drift = mode === 'connect' ? 4 : mode === 'crm' ? 5 : 6;
        return (
          <motion.div
            key={`${item.label}-${index}`}
            animate={{
              x: [0, index % 2 === 0 ? drift : -drift, 0],
              y: [0, index % 3 === 0 ? -4 : 5, 0],
              rotate: [0, index % 2 === 0 ? -1.4 : 1.4, 0]
            }}
            transition={{
              duration: 4.2 + index * 0.22,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            style={{ left: position.left, top: position.top }}
            className={cn(
              "absolute border border-[#D9D3FF] bg-white shadow-sm",
              mode === 'bundle'
                ? "rounded-xl px-2 py-1.5"
                : mode === 'connect'
                  ? "flex h-11 w-11 items-center justify-center rounded-2xl"
                  : "w-[43%] rounded-[1.1rem] px-2 py-1.5"
            )}
          >
            <div className={cn("flex items-center gap-1.5", mode === 'connect' && "justify-center")}>
              <div className={cn(
                "flex items-center justify-center bg-slate-100 text-[#5B45FF]",
                mode === 'bundle'
                  ? "h-6 w-6 rounded-lg"
                  : mode === 'connect'
                    ? "h-7 w-7 rounded-xl"
                    : "h-7 w-7 rounded-xl shrink-0"
              )}>
                <Icon size={mode === 'bundle' ? 12 : 14} />
              </div>
              {mode !== 'connect' && (
                <span className={cn("truncate font-bold text-slate-700", mode === 'bundle' ? "text-[9px]" : "text-[10px] leading-none")}>{item.label}</span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
