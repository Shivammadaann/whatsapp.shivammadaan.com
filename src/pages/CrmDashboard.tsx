import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import {
  Download,
  Edit3,
  ExternalLink,
  FileUp,
  Filter,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Flame,
  LayoutDashboard,
  Mail,
  Menu,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Snowflake,
  Sparkles,
  Target,
  Users,
  Workflow
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, getDocs, limit, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { buildBackendUrl } from '../lib/backend';
import { cn } from '../lib/utils';
import Papa from 'papaparse';

function WabaIcon({ size = 16 }: { size?: number }) {
  return <img src="/waba.svg" alt="" width={size} height={size} className="object-contain" />;
}
import { whatsappService } from '../services/whatsappService';
import { getActiveWhatsAppAccount } from '../lib/whatsappAccounts';
import { Logo } from '../components/Logo';

type TeamSize = 'solo' | 'small' | 'growing';
type TeamFocus = 'sales' | 'customer_success' | 'operations';
type FollowUpCadence = 'same_day' | 'within_24h' | 'within_48h';
type ImportMode = 'starter' | 'blank';
type CrmView = 'home' | 'leads' | 'pipeline' | 'meta_setup';
type LeadTemperature = 'hot' | 'warm' | 'cold';
type LeadNoticeTone = 'success' | 'error';

type LeadRemark = {
  id: string;
  text: string;
  createdAt: string;
  author: string;
};

type CrmLead = {
  id: string;
  leadNumber: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  stage: string;
  source: string;
  owner: string;
  value: string;
  lastTouch: string;
  note: string;
  primaryRemark: string;
  dateAdded: string;
  remarks: LeadRemark[];
  temperature?: LeadTemperature;
};

type CrmTeamMember = {
  name: string;
  role: string;
};

type LeadFormState = {
  id?: string;
  leadNumber?: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  owner: string;
  stage: string;
  dateAdded: string;
  primaryRemark: string;
  value: string;
  temperature: LeadTemperature;
};

type CrmFormState = {
  workspaceName: string;
  teamSize: TeamSize;
  focus: TeamFocus;
  pipelineTemplate: string;
  leadSources: string[];
  followUpCadence: FollowUpCadence;
  importMode: ImportMode;
};

type CrmTemplate = {
  id: string;
  name: string;
  description: string;
  stages: string[];
};

type MetaLeadCaptureForm = {
  id: string;
  name: string;
  status?: string;
  locale?: string;
};

type MetaLeadCapturePage = {
  id: string;
  name: string;
  accessToken?: string;
  forms?: MetaLeadCaptureForm[];
};

type MetaLeadCaptureConfig = {
  connected?: boolean;
  status?: 'needs_setup' | 'page_selection' | 'pending_test' | 'configured' | 'needs_page_access';
  pageId?: string;
  pageName?: string;
  formId?: string;
  formName?: string;
  pages?: MetaLeadCapturePage[];
  forms?: MetaLeadCaptureForm[];
  testingToolUrl?: string;
  webhookUrl?: string;
  lastTestRequestedAt?: string;
  lastWebhookLeadAt?: string;
  lastWebhookLeadId?: string;
  lastRetrievedLeadAt?: string;
  lastRetrievedLeadId?: string;
  connectedAt?: string;
  configuredAt?: string;
  updatedAt?: string;
};

const steps = ['Workspace', 'Pipeline', 'Launch'];

const crmTemplates: CrmTemplate[] = [
  {
    id: 'sales-pipeline',
    name: 'Sales Pipeline',
    description: 'Track new leads, proposals, and closes.',
    stages: ['New Lead', 'Qualified', 'Proposal Sent', 'Won']
  },
  {
    id: 'demo-funnel',
    name: 'Demo Funnel',
    description: 'Best for demo bookings and follow-up motion.',
    stages: ['Inbound', 'Demo Scheduled', 'Follow-up', 'Converted']
  },
  {
    id: 'account-growth',
    name: 'Account Growth',
    description: 'Useful for renewals, expansions, and relationship tracking.',
    stages: ['Account Review', 'Expansion Fit', 'Negotiation', 'Expanded']
  }
];

const teamSizeOptions: Array<{ value: TeamSize; label: string; description: string }> = [
  { value: 'solo', label: 'Solo operator', description: 'One owner handles the pipeline.' },
  { value: 'small', label: 'Small team', description: 'A compact team shares follow-up.' },
  { value: 'growing', label: 'Growing team', description: 'Multiple reps need clear routing.' }
];

const focusOptions: Array<{ value: TeamFocus; label: string; description: string }> = [
  { value: 'sales', label: 'Sales', description: 'Capture demand and move deals forward.' },
  { value: 'customer_success', label: 'Customer success', description: 'Track onboarding and retention.' },
  { value: 'operations', label: 'Operations', description: 'Manage intake and service visibility.' }
];

const cadenceOptions: Array<{ value: FollowUpCadence; label: string; description: string }> = [
  { value: 'same_day', label: 'Same day', description: 'Push for a fast first response.' },
  { value: 'within_24h', label: 'Within 24 hours', description: 'A balanced default for most teams.' },
  { value: 'within_48h', label: 'Within 48 hours', description: 'A slower cadence for consultative work.' }
];

const sourceOptions = ['Website', 'Meta Ads', 'WhatsApp', 'Referrals', 'Calls', 'Walk-ins'];
const WHATSAPP_ICON_URL = 'https://upload.wikimedia.org/wikipedia/commons/1/19/WhatsApp_logo-color-vertical.svg';
const META_LEADS_TESTING_TOOL_URL = 'https://developers.facebook.com/tools/lead-ads-testing';
const LEAD_NUMBER_PREFIX = 'LD';
const crmInputClass = 'w-full rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/10';
const sampleCsvRows = [
  {
    LeadNumber: 'LD-00001',
    Name: 'Riya Sharma',
    Company: 'BluePeak Studio',
    Email: 'riya@bluepeakstudio.com',
    Phone: '+91 98765 43210',
    Source: 'Meta Ads',
    Owner: 'Aanya Rao',
    Stage: 'Qualified',
    DateAdded: '2026-04-09',
    PrimaryRemark: 'Requested a pricing walkthrough after ad submission.',
    Value: 'INR 58,000',
    Temperature: 'warm'
  }
];

const defaultFormState: CrmFormState = {
  workspaceName: '',
  teamSize: 'small',
  focus: 'sales',
  pipelineTemplate: crmTemplates[0].id,
  leadSources: ['Website', 'WhatsApp'],
  followUpCadence: 'within_24h',
  importMode: 'starter'
};

function normalizePhoneDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

function createLeadId() {
  return `crm-lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRemarkId() {
  return `remark-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseLeadNumberSequence(value?: string | null) {
  const match = String(value || '').trim().match(/(\d+)$/);
  if (!match) return null;
  const sequence = Number(match[1]);
  return Number.isFinite(sequence) && sequence > 0 ? sequence : null;
}

function formatLeadNumber(sequence: number) {
  return `${LEAD_NUMBER_PREFIX}-${String(sequence).padStart(5, '0')}`;
}

function assignUniqueLeadNumbers<T extends { leadNumber?: string | null }>(leads: T[]): Array<T & { leadNumber: string }> {
  const usedLeadNumbers = new Set<string>();
  let highestSequence = leads.reduce((max, lead) => Math.max(max, parseLeadNumberSequence(lead.leadNumber) || 0), 0);

  return leads.map((lead) => {
    const existingSequence = parseLeadNumberSequence(lead.leadNumber);
    const normalizedLeadNumber = existingSequence ? formatLeadNumber(existingSequence) : '';

    if (normalizedLeadNumber && !usedLeadNumbers.has(normalizedLeadNumber)) {
      usedLeadNumbers.add(normalizedLeadNumber);
      return {
        ...lead,
        leadNumber: normalizedLeadNumber
      };
    }

    highestSequence += 1;
    const nextLeadNumber = formatLeadNumber(highestSequence);
    usedLeadNumbers.add(nextLeadNumber);

    return {
      ...lead,
      leadNumber: nextLeadNumber
    };
  });
}

function buildPhoneLookupVariants(value?: string | null) {
  const rawValue = String(value || '').trim();
  const normalizedValue = normalizePhoneDigits(rawValue);
  const variants = new Set<string>();

  if (rawValue) {
    variants.add(rawValue);
  }

  if (normalizedValue) {
    variants.add(normalizedValue);
    variants.add(`+${normalizedValue}`);
    if (normalizedValue.length > 10) {
      const localNumber = normalizedValue.slice(-10);
      variants.add(localNumber);
      variants.add(`+${localNumber}`);
    }
  }

  return Array.from(variants).filter(Boolean).slice(0, 10);
}

function formatLeadDate(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatLeadDateTime(value?: string | null) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function getFirstName(value?: string | null) {
  if (!value) return 'there';
  const normalized = value.includes('@') ? value.split('@')[0].replace(/[._-]+/g, ' ') : value;
  const firstToken = normalized.trim().split(/\s+/)[0] || 'there';
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
}

function buildTeamMembers(teamSize: TeamSize, ownerName: string): CrmTeamMember[] {
  const roster: CrmTeamMember[] = [
    {
      name: ownerName,
      role: teamSize === 'solo' ? 'CRM Owner' : 'Team Lead'
    }
  ];

  if (teamSize !== 'solo') {
    roster.push(
      { name: 'Aanya Rao', role: 'Lead Manager' },
      { name: 'Rahul Mehta', role: 'Sales Executive' }
    );
  }

  if (teamSize === 'growing') {
    roster.push(
      { name: 'Isha Kapoor', role: 'Pipeline Manager' },
      { name: 'Kabir Malhotra', role: 'Account Executive' }
    );
  }

  return roster;
}

function inferLeadTemperature(lead: CrmLead, stages: string[], index = 0): LeadTemperature {
  if (lead.temperature) return lead.temperature;
  const stageIndex = stages.findIndex((stage) => stage === lead.stage);
  if (stageIndex === -1) {
    return (['hot', 'warm', 'cold'] as LeadTemperature[])[index % 3];
  }

  if (stages.length <= 1) return 'hot';
  const progress = stageIndex / (stages.length - 1);
  if (progress >= 0.66) return 'hot';
  if (progress >= 0.33) return 'warm';
  return 'cold';
}

function buildLeadEmail(name: string, company?: string) {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  const companySlug = (company || 'example').trim().toLowerCase().replace(/[^a-z0-9]+/g, '') || 'example';
  return `${base || 'lead'}@${companySlug}.com`;
}

function normalizeCrmLead(raw: any, stages: string[], teamMembers: CrmTeamMember[], index: number): CrmLead {
  const owner = raw?.owner || teamMembers[index % Math.max(teamMembers.length, 1)]?.name || 'Workspace Owner';
  const dateAdded = raw?.dateAdded || raw?.createdAt || new Date(Date.now() - index * 86_400_000).toISOString();
  const primaryRemark = raw?.primaryRemark || raw?.note || raw?.remarks?.[raw?.remarks?.length - 1]?.text || '';
  const remarks = Array.isArray(raw?.remarks) && raw.remarks.length
    ? raw.remarks.map((remark: any, remarkIndex: number) => ({
        id: remark.id || `${raw?.id || 'lead'}-remark-${remarkIndex}`,
        text: remark.text || remark.note || '',
        createdAt: remark.createdAt || remark.timestamp || dateAdded,
        author: remark.author || owner
      }))
    : primaryRemark
      ? [{ id: `${raw?.id || `lead-${index}`}-remark-0`, text: primaryRemark, createdAt: dateAdded, author: owner }]
      : [];
  const phone = normalizePhoneDigits(raw?.phone || raw?.contactNumber || raw?.whatsappNumber || raw?.mobile || `+91 90000${String(index + 1).padStart(5, '0')}`);

  return {
    id: raw?.id || createLeadId(),
    leadNumber: raw?.leadNumber || '',
    name: raw?.name || 'Unnamed Lead',
    company: raw?.company || 'Independent Lead',
    email: raw?.email || buildLeadEmail(raw?.name || 'lead', raw?.company),
    phone,
    stage: raw?.stage || stages[0] || 'New Lead',
    source: raw?.source || sourceOptions[0],
    owner,
    value: raw?.value || 'INR 0',
    lastTouch: raw?.lastTouch || formatLeadDate(dateAdded),
    note: primaryRemark,
    primaryRemark,
    dateAdded,
    remarks,
    temperature: raw?.temperature || inferLeadTemperature({ ...raw, owner } as CrmLead, stages, index)
  };
}

function buildLeadFormState(lead?: CrmLead, defaults?: { owner: string; stage: string; source: string }): LeadFormState {
  return {
    id: lead?.id,
    leadNumber: lead?.leadNumber,
    name: lead?.name || '',
    company: lead?.company || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    source: lead?.source || defaults?.source || sourceOptions[0],
    owner: lead?.owner || defaults?.owner || 'Workspace Owner',
    stage: lead?.stage || defaults?.stage || 'New Lead',
    dateAdded: lead?.dateAdded ? new Date(lead.dateAdded).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    primaryRemark: lead?.primaryRemark || lead?.note || '',
    value: lead?.value || 'INR 0',
    temperature: lead?.temperature || 'warm'
  };
}

function buildStarterLeads(stages: string[], sources: string[], teamMembers: CrmTeamMember[]): CrmLead[] {
  const safeStages = stages.length ? stages : crmTemplates[0].stages;
  const safeSources = sources.length ? sources : ['Website', 'WhatsApp', 'Referrals'];
  const safeTeamMembers = teamMembers.length ? teamMembers : [{ name: 'Workspace Owner', role: 'CRM Owner' }];

  return [
    {
      id: 'crm-lead-1',
      leadNumber: '',
      name: 'Aarav Khanna',
      company: 'Northlane Foods',
      email: 'aarav@northlanefoods.com',
      phone: '919876543210',
      stage: safeStages[0],
      source: safeSources[0],
      owner: safeTeamMembers[0]?.name || 'Workspace Owner',
      value: 'INR 45,000',
      lastTouch: '5 mins ago',
      note: 'Asked for a quick product walkthrough and pricing.',
      primaryRemark: 'Asked for a quick product walkthrough and pricing.',
      dateAdded: '2026-04-09T09:00:00.000Z',
      remarks: [
        {
          id: 'crm-lead-1-remark-1',
          text: 'Asked for a quick product walkthrough and pricing.',
          createdAt: '2026-04-09T09:00:00.000Z',
          author: safeTeamMembers[0]?.name || 'Workspace Owner'
        }
      ],
      temperature: 'cold'
    },
    {
      id: 'crm-lead-2',
      leadNumber: '',
      name: 'Meera Iyer',
      company: 'Aster Clinics',
      email: 'meera@asterclinics.com',
      phone: '919812345678',
      stage: safeStages[Math.min(1, safeStages.length - 1)],
      source: safeSources[Math.min(1, safeSources.length - 1)],
      owner: safeTeamMembers[Math.min(1, safeTeamMembers.length - 1)]?.name || safeTeamMembers[0]?.name || 'Workspace Owner',
      value: 'INR 1,20,000',
      lastTouch: '2 hours ago',
      note: 'Ready for follow-up after the discovery call.',
      primaryRemark: 'Ready for follow-up after the discovery call.',
      dateAdded: '2026-04-08T12:30:00.000Z',
      remarks: [
        {
          id: 'crm-lead-2-remark-1',
          text: 'Ready for follow-up after the discovery call.',
          createdAt: '2026-04-08T12:30:00.000Z',
          author: safeTeamMembers[Math.min(1, safeTeamMembers.length - 1)]?.name || safeTeamMembers[0]?.name || 'Workspace Owner'
        }
      ],
      temperature: 'warm'
    },
    {
      id: 'crm-lead-3',
      leadNumber: '',
      name: 'Rohit Menon',
      company: 'Urban Nest Realty',
      email: 'rohit@urbannestrealty.com',
      phone: '919823456789',
      stage: safeStages[Math.min(2, safeStages.length - 1)],
      source: safeSources[Math.min(2, safeSources.length - 1)],
      owner: safeTeamMembers[Math.min(2, safeTeamMembers.length - 1)]?.name || safeTeamMembers[0]?.name || 'Workspace Owner',
      value: 'INR 82,000',
      lastTouch: 'Yesterday',
      note: 'Requested a proposal with implementation timeline.',
      primaryRemark: 'Requested a proposal with implementation timeline.',
      dateAdded: '2026-04-07T15:00:00.000Z',
      remarks: [
        {
          id: 'crm-lead-3-remark-1',
          text: 'Requested a proposal with implementation timeline.',
          createdAt: '2026-04-07T15:00:00.000Z',
          author: safeTeamMembers[Math.min(2, safeTeamMembers.length - 1)]?.name || safeTeamMembers[0]?.name || 'Workspace Owner'
        }
      ],
      temperature: 'hot'
    },
    {
      id: 'crm-lead-4',
      leadNumber: '',
      name: 'Sana Qureshi',
      company: 'Skyward Travels',
      email: 'sana@skywardtravels.com',
      phone: '919834567890',
      stage: safeStages[Math.min(1, safeStages.length - 1)],
      source: safeSources[Math.min(3, safeSources.length - 1)],
      owner: safeTeamMembers[0]?.name || 'Workspace Owner',
      value: 'INR 64,000',
      lastTouch: 'Today',
      note: 'Requested pricing for a multi-location rollout.',
      primaryRemark: 'Requested pricing for a multi-location rollout.',
      dateAdded: '2026-04-09T11:20:00.000Z',
      remarks: [
        {
          id: 'crm-lead-4-remark-1',
          text: 'Requested pricing for a multi-location rollout.',
          createdAt: '2026-04-09T11:20:00.000Z',
          author: safeTeamMembers[0]?.name || 'Workspace Owner'
        }
      ],
      temperature: 'warm'
    },
    {
      id: 'crm-lead-5',
      leadNumber: '',
      name: 'Dev Patel',
      company: 'Metric Works',
      email: 'dev@metricworks.com',
      phone: '919845678901',
      stage: safeStages[Math.min(safeStages.length - 1, 3)],
      source: safeSources[Math.min(1, safeSources.length - 1)],
      owner: safeTeamMembers[Math.min(1, safeTeamMembers.length - 1)]?.name || safeTeamMembers[0]?.name || 'Workspace Owner',
      value: 'INR 2,10,000',
      lastTouch: '30 mins ago',
      note: 'Final approver joined and is evaluating rollout timing.',
      primaryRemark: 'Final approver joined and is evaluating rollout timing.',
      dateAdded: '2026-04-09T10:45:00.000Z',
      remarks: [
        {
          id: 'crm-lead-5-remark-1',
          text: 'Final approver joined and is evaluating rollout timing.',
          createdAt: '2026-04-09T10:45:00.000Z',
          author: safeTeamMembers[Math.min(1, safeTeamMembers.length - 1)]?.name || safeTeamMembers[0]?.name || 'Workspace Owner'
        }
      ],
      temperature: 'hot'
    }
  ];
}

export default function CrmDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth.currentUser;
  const [profileData, setProfileData] = useState<any>(null);
  const [form, setForm] = useState<CrmFormState>(defaultFormState);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasHydratedForm, setHasHydratedForm] = useState(false);
  const [editingSetup, setEditingSetup] = useState(false);
  const [activeView, setActiveView] = useState<CrmView>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [crmLeadRecords, setCrmLeadRecords] = useState<CrmLead[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [leadNotice, setLeadNotice] = useState<{ tone: LeadNoticeTone; text: string } | null>(null);
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [leadFormMode, setLeadFormMode] = useState<'add' | 'edit'>('add');
  const [leadForm, setLeadForm] = useState<LeadFormState>(buildLeadFormState(undefined, { owner: 'Workspace Owner', stage: crmTemplates[0].stages[0], source: sourceOptions[0] }));
  const [activeLeadForRemark, setActiveLeadForRemark] = useState<CrmLead | null>(null);
  const [newRemark, setNewRemark] = useState('');
  const [activeLeadForTimeline, setActiveLeadForTimeline] = useState<CrmLead | null>(null);
  const [activeLeadForTemplate, setActiveLeadForTemplate] = useState<CrmLead | null>(null);
  const [approvedTemplates, setApprovedTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [metaSetupSaving, setMetaSetupSaving] = useState(false);
  const [metaFormsLoading, setMetaFormsLoading] = useState(false);
  const [metaTestLoading, setMetaTestLoading] = useState(false);
  const [selectedMetaPageId, setSelectedMetaPageId] = useState('');
  const [selectedMetaFormId, setSelectedMetaFormId] = useState('');
  const [availableMetaForms, setAvailableMetaForms] = useState<MetaLeadCaptureForm[]>([]);
  const [resolvedMetaFormsPageId, setResolvedMetaFormsPageId] = useState('');
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const { scrollYProgress } = useScroll();
  const crmScrollProgress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.22 });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      const nextProfile = snapshot.data() || null;
      setProfileData(nextProfile);
      setLoading(false);

      if (!hasHydratedForm && nextProfile) {
        setForm({
          workspaceName: nextProfile.crmSetup?.workspaceName || nextProfile.companyName || nextProfile.displayName || 'WhatsApp Business CRM Workspace',
          teamSize: nextProfile.crmSetup?.teamSize || defaultFormState.teamSize,
          focus: nextProfile.crmSetup?.focus || defaultFormState.focus,
          pipelineTemplate: nextProfile.crmSetup?.pipelineTemplate || defaultFormState.pipelineTemplate,
          leadSources: nextProfile.crmSetup?.leadSources?.length ? nextProfile.crmSetup.leadSources : defaultFormState.leadSources,
          followUpCadence: nextProfile.crmSetup?.followUpCadence || defaultFormState.followUpCadence,
          importMode: nextProfile.crmSetup?.importMode || defaultFormState.importMode
        });
        setHasHydratedForm(true);
      }
    }, (snapshotError) => {
      handleFirestoreError(snapshotError, OperationType.GET, `users/${user.uid}`);
      setLoading(false);
      setError('Unable to load your CRM workspace right now.');
    });

    return () => unsubscribe();
  }, [hasHydratedForm, user]);

  useEffect(() => {
    const credentials = getActiveWhatsAppAccount(profileData);
    if (credentials?.accessToken && credentials?.phoneNumberId) {
      whatsappService.setCredentials(
        credentials.accessToken,
        credentials.phoneNumberId,
        credentials.businessAccountId || ''
      );
      return;
    }

    whatsappService.clearCredentials();
  }, [
    profileData?.activeWhatsappAccountId,
    profileData?.whatsappAccounts,
    profileData?.whatsappCredentials?.accessToken,
    profileData?.whatsappCredentials?.phoneNumberId,
    profileData?.whatsappCredentials?.businessAccountId
  ]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedView = params.get('view');
    const metaStatus = params.get('meta_status');
    const metaMessage = params.get('meta_message');

    if (requestedView === 'meta_setup') {
      setActiveView('meta_setup');
    }

    if (metaStatus) {
      setLeadNotice({
        tone: metaStatus === 'success' ? 'success' : 'error',
        text: metaMessage || (metaStatus === 'success' ? 'Meta lead capture updated successfully.' : 'Meta lead capture setup needs attention.')
      });

      params.delete('meta_status');
      params.delete('meta_message');
      navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const hasCrmAccess = Boolean(
    profileData?.subscriptions?.plan === 'WhatsApp Business-one' ||
    profileData?.subscriptions?.services?.crm
  );
  const setupComplete = Boolean(profileData?.toolSetup?.crm);
  const showSetupFlow = hasCrmAccess && (!setupComplete || editingSetup);
  const activeTemplate = crmTemplates.find((template) => template.id === form.pipelineTemplate) || crmTemplates[0];
  const crmStages = showSetupFlow
    ? activeTemplate.stages
    : profileData?.crmSetup?.pipelineStages || activeTemplate.stages;
  const storedCrmLeads: any[] = Array.isArray(profileData?.crmSetup?.leads) ? profileData.crmSetup.leads : [];
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()),
    []
  );
  const workspaceName = profileData?.crmSetup?.workspaceName || 'WhatsApp Business CRM';
  const pipelineName = crmTemplates.find((template) => template.id === profileData?.crmSetup?.pipelineTemplate)?.name || activeTemplate.name;
  const greetingName = getFirstName(profileData?.displayName || user?.displayName || user?.email);
  const crmTeamMembers = useMemo<CrmTeamMember[]>(() => {
    const storedTeamMembers = Array.isArray(profileData?.crmSetup?.teamMembers)
      ? profileData.crmSetup.teamMembers
          .filter((member: any) => member?.name)
          .map((member: any, index: number) => ({
            name: member.name,
            role: member.role || (index === 0 ? 'Team Lead' : 'Team member')
          }))
      : [];

    if (storedTeamMembers.length) return storedTeamMembers;

    const ownerName = profileData?.crmSetup?.ownerName || profileData?.displayName || user?.displayName || 'Workspace Owner';
    const teamSize = profileData?.crmSetup?.teamSize || form.teamSize;
    return buildTeamMembers(teamSize, ownerName);
  }, [form.teamSize, profileData, user?.displayName]);
  const normalizedCrmLeads = useMemo(
    () => assignUniqueLeadNumbers(storedCrmLeads.map((lead, index) => normalizeCrmLead(lead, crmStages, crmTeamMembers, index))),
    [crmStages, crmTeamMembers, storedCrmLeads]
  );

  useEffect(() => {
    setCrmLeadRecords(normalizedCrmLeads);
  }, [normalizedCrmLeads]);

  const crmLeadsWithTemperature = crmLeadRecords ?? normalizedCrmLeads;
  const leadTemperatureTotals = useMemo(() => crmLeadsWithTemperature.reduce(
    (totals, lead) => ({
      ...totals,
      [lead.temperature || 'cold']: totals[lead.temperature || 'cold'] + 1
    }),
    { hot: 0, warm: 0, cold: 0 } as Record<LeadTemperature, number>
  ), [crmLeadsWithTemperature]);
  const teamPerformance = useMemo(() => {
    const memberMap = new Map<string, CrmTeamMember>();
    crmTeamMembers.forEach((member) => memberMap.set(member.name, member));
    crmLeadsWithTemperature.forEach((lead) => {
      if (lead.owner && !memberMap.has(lead.owner)) {
        memberMap.set(lead.owner, { name: lead.owner, role: 'Team member' });
      }
    });

    return Array.from(memberMap.values()).map((member) => {
      const memberLeads = crmLeadsWithTemperature.filter((lead) => lead.owner === member.name);
      return {
        ...member,
        totalLeads: memberLeads.length,
        hot: memberLeads.filter((lead) => lead.temperature === 'hot').length,
        warm: memberLeads.filter((lead) => lead.temperature === 'warm').length,
        cold: memberLeads.filter((lead) => lead.temperature === 'cold').length,
        latestTouch: memberLeads[0]?.lastTouch || 'No recent activity'
      };
    }).sort((left, right) => right.totalLeads - left.totalLeads || left.name.localeCompare(right.name));
  }, [crmLeadsWithTemperature, crmTeamMembers]);
  const overviewCards = [
    { label: 'Total Team Members', value: String(teamPerformance.length), helper: 'Assigned inside CRM', icon: Users },
    { label: 'Total Leads', value: String(crmLeadsWithTemperature.length), helper: 'Across the workspace', icon: LayoutDashboard },
    { label: 'Hot Leads', value: String(leadTemperatureTotals.hot), helper: 'Need quick action', icon: Flame },
    { label: 'Pipeline Stages', value: String(crmStages.length), helper: pipelineName, icon: Workflow }
  ];
  const metaLeadCapture = (profileData?.crmSetup?.metaLeadCapture || null) as MetaLeadCaptureConfig | null;
  const metaLeadCaptureConfigured = metaLeadCapture?.status === 'configured' || Boolean(profileData?.crmSetup?.metaLeadCaptureConfigured);
  const metaLeadPages = Array.isArray(metaLeadCapture?.pages) ? metaLeadCapture.pages : [];
  const officialMetaTestingToolUrl = metaLeadCapture?.testingToolUrl || META_LEADS_TESTING_TOOL_URL;
  const metaSetupStatusLabel = metaLeadCaptureConfigured
    ? 'Configured'
    : metaLeadCapture?.status === 'pending_test'
      ? 'Pending test'
      : metaLeadCapture?.status === 'page_selection'
        ? 'Select page'
        : 'Needs setup';
  const connectedMetaPage = metaLeadPages.find((page) => page.id === metaLeadCapture?.pageId) || null;
  const leadOwners = useMemo(
    () => Array.from(new Set([...crmTeamMembers.map((member) => member.name), ...crmLeadsWithTemperature.map((lead) => lead.owner)])).filter(Boolean),
    [crmLeadsWithTemperature, crmTeamMembers]
  );
  const leadSources = useMemo(
    () => Array.from(new Set([...sourceOptions, ...crmLeadsWithTemperature.map((lead) => lead.source)])).filter(Boolean),
    [crmLeadsWithTemperature]
  );

  useEffect(() => {
    const fallbackPageId = metaLeadCapture?.pageId || metaLeadPages[0]?.id || '';
    setSelectedMetaPageId((current) => {
      if (current && metaLeadPages.some((page) => page.id === current)) {
        return current;
      }
      return fallbackPageId;
    });
  }, [metaLeadCapture?.pageId, metaLeadPages]);

  useEffect(() => {
    const selectedPage = metaLeadPages.find((page) => page.id === selectedMetaPageId) || null;
    const nextForms = selectedMetaPageId === metaLeadCapture?.pageId && Array.isArray(metaLeadCapture?.forms) && metaLeadCapture.forms.length
      ? metaLeadCapture.forms
      : (selectedPage?.forms || []);
    setAvailableMetaForms(nextForms);
    if (nextForms.length) {
      setResolvedMetaFormsPageId(selectedMetaPageId);
    }
    setSelectedMetaFormId((current) => {
      if (current && nextForms.some((form) => form.id === current)) {
        return current;
      }

      if (selectedMetaPageId === metaLeadCapture?.pageId && metaLeadCapture?.formId && nextForms.some((form) => form.id === metaLeadCapture.formId)) {
        return metaLeadCapture.formId;
      }

      return nextForms[0]?.id || '';
    });
  }, [metaLeadCapture?.formId, metaLeadCapture?.forms, metaLeadCapture?.pageId, metaLeadPages, selectedMetaPageId]);

  useEffect(() => {
    const selectedPage = metaLeadPages.find((page) => page.id === selectedMetaPageId) || null;
    if (
      !selectedMetaPageId ||
      !selectedPage ||
      (selectedPage.forms && selectedPage.forms.length) ||
      metaFormsLoading ||
      resolvedMetaFormsPageId === selectedMetaPageId
    ) {
      return;
    }

    void loadMetaLeadForms(selectedMetaPageId);
  }, [metaFormsLoading, metaLeadPages, resolvedMetaFormsPageId, selectedMetaPageId]);

  const filteredLeads = useMemo(() => crmLeadsWithTemperature.filter((lead) => {
    const matchesSearch = !searchTerm.trim() || [
      lead.leadNumber,
      lead.name,
      lead.email,
      lead.phone,
      lead.company
    ].join(' ').toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesOwner = ownerFilter === 'all' || lead.owner === ownerFilter;
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
    const matchesDate = !dateFilter || new Date(lead.dateAdded).toISOString().slice(0, 10) === dateFilter;
    return matchesSearch && matchesOwner && matchesSource && matchesStage && matchesDate;
  }), [crmLeadsWithTemperature, dateFilter, ownerFilter, searchTerm, sourceFilter, stageFilter]);

  const persistCrmSetupPatch = async (patch: Record<string, any>) => {
    if (!user) return false;

    try {
      await setDoc(doc(db, 'users', user.uid), {
        crmSetup: {
          ...patch,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });
      return true;
    } catch (saveError: any) {
      handleFirestoreError(saveError, OperationType.WRITE, `users/${user.uid}`);
      setLeadNotice({ tone: 'error', text: saveError?.message || 'Unable to update CRM leads right now.' });
      return false;
    }
  };

  const persistMetaLeadCapturePatch = async (patch: Partial<MetaLeadCaptureConfig>) => {
    const selectedMetaPage = metaLeadPages.find((page) => page.id === (metaLeadCapture?.pageId || selectedMetaPageId)) || null;
    const selectedMetaForm = availableMetaForms.find((form) => form.id === (metaLeadCapture?.formId || selectedMetaFormId)) || null;
    const currentMetaLeadCapture = {
      ...(profileData?.crmSetup?.metaLeadCapture || {}),
      ...(metaLeadCapture?.pageId || selectedMetaPageId
        ? {
            pageId: metaLeadCapture?.pageId || selectedMetaPageId,
            pageName: metaLeadCapture?.pageName || selectedMetaPage?.name || ''
          }
        : {}),
      ...(metaLeadCapture?.formId || selectedMetaFormId
        ? {
            formId: metaLeadCapture?.formId || selectedMetaFormId,
            formName: metaLeadCapture?.formName || selectedMetaForm?.name || ''
          }
        : {})
    } as MetaLeadCaptureConfig;
    const nextMetaLeadCapture: MetaLeadCaptureConfig = {
      ...currentMetaLeadCapture,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    const nextPatch: Record<string, any> = {
      metaLeadCapture: nextMetaLeadCapture,
      metaLeadCaptureConfigured: nextMetaLeadCapture.status === 'configured'
    };

    if (nextMetaLeadCapture.status === 'configured') {
      nextPatch.metaLeadCaptureConfiguredAt = nextMetaLeadCapture.configuredAt || new Date().toISOString();
    }

    return persistCrmSetupPatch(nextPatch);
  };

  const saveLeadRecords = async (nextLeads: CrmLead[], successText: string) => {
    const leadsWithNumbers = assignUniqueLeadNumbers(nextLeads);
    setCrmLeadRecords(leadsWithNumbers);
    const didSave = await persistCrmSetupPatch({ leads: leadsWithNumbers });
    if (didSave) {
      setLeadNotice({ tone: 'success', text: successText });
    }
    return didSave;
  };

  useEffect(() => {
    if (!user || !storedCrmLeads.length) return;

    const shouldBackfillLeadNumbers = normalizedCrmLeads.some((lead, index) => lead.leadNumber !== String(storedCrmLeads[index]?.leadNumber || ''));
    if (!shouldBackfillLeadNumbers) return;

    void persistCrmSetupPatch({ leads: normalizedCrmLeads });
  }, [normalizedCrmLeads, storedCrmLeads, user]);

  const loadApprovedTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const templates = await whatsappService.getTemplates();
      setApprovedTemplates(templates.filter((template: any) => template.status === 'APPROVED'));
    } finally {
      setLoadingTemplates(false);
    }
  };

  const syncLeadToInboxContact = async (lead: CrmLead) => {
    if (!user) return '';

    const normalizedPhone = normalizePhoneDigits(lead.phone);
    if (!normalizedPhone) return '';

    const contactPayload = {
      fullName: lead.name,
      whatsappNumber: normalizedPhone,
      phone: normalizedPhone,
      email: lead.email,
      notes: lead.primaryRemark || lead.note || '',
      tags: ['crm_lead'],
      customParams: {
        source: lead.source,
        stage: lead.stage,
        owner: lead.owner,
        company: lead.company
      },
      updatedAt: new Date().toISOString()
    };

    const existingContact = await getDocs(query(
      collection(db, 'users', user.uid, 'contacts'),
      where('whatsappNumber', '==', normalizedPhone),
      limit(1)
    ));

    if (existingContact.empty) {
      await addDoc(collection(db, 'users', user.uid, 'contacts'), {
        ...contactPayload,
        createdAt: new Date().toISOString(),
        lastMessage: '',
        lastMessageTime: null,
        unreadCount: 0
      });
    } else {
      await updateDoc(doc(db, 'users', user.uid, 'contacts', existingContact.docs[0].id), contactPayload);
    }

    return normalizedPhone;
  };

  const hasInboxConversationForLead = async (lead: CrmLead) => {
    if (!user) return false;

    const phoneVariants = buildPhoneLookupVariants(lead.phone);
    if (!phoneVariants.length) return false;

    const [whatsappContactsSnapshot, phoneContactsSnapshot, inboundMessagesSnapshot, outboundMessagesSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'users', user.uid, 'contacts'), where('whatsappNumber', 'in', phoneVariants), limit(5))),
      getDocs(query(collection(db, 'users', user.uid, 'contacts'), where('phone', 'in', phoneVariants), limit(5))),
      getDocs(query(collection(db, 'users', user.uid, 'messages'), where('from', 'in', phoneVariants), limit(1))),
      getDocs(query(collection(db, 'users', user.uid, 'messages'), where('to', 'in', phoneVariants), limit(1)))
    ]);

    const matchingContacts = [...whatsappContactsSnapshot.docs, ...phoneContactsSnapshot.docs];
    const hasConversationContact = matchingContacts.some((contactDoc) => {
      const contactData = contactDoc.data();
      return Boolean(String(contactData?.lastMessage || '').trim() || contactData?.lastMessageTime);
    });

    return hasConversationContact || !inboundMessagesSnapshot.empty || !outboundMessagesSnapshot.empty;
  };

  const openLeadForm = (mode: 'add' | 'edit', lead?: CrmLead) => {
    setLeadFormMode(mode);
    setLeadForm(buildLeadFormState(lead, {
      owner: crmTeamMembers[0]?.name || 'Workspace Owner',
      stage: crmStages[0] || 'New Lead',
      source: leadSources[0] || sourceOptions[0]
    }));
    setIsLeadFormOpen(true);
  };

  const handleLeadFormSubmit = async () => {
    const trimmedName = leadForm.name.trim();
    const normalizedPhone = normalizePhoneDigits(leadForm.phone);
    const trimmedEmail = leadForm.email.trim();

    if (!trimmedName || !normalizedPhone || !trimmedEmail) {
      setLeadNotice({ tone: 'error', text: 'Name, email, and contact number are required for each lead.' });
      return;
    }

    const baseLead: CrmLead = normalizeCrmLead({
      id: leadForm.id || createLeadId(),
      leadNumber: leadForm.leadNumber,
      name: trimmedName,
      company: leadForm.company.trim() || 'Independent Lead',
      email: trimmedEmail,
      phone: normalizedPhone,
      source: leadForm.source,
      owner: leadForm.owner,
      stage: leadForm.stage,
      dateAdded: new Date(leadForm.dateAdded || new Date().toISOString()).toISOString(),
      primaryRemark: leadForm.primaryRemark.trim(),
      note: leadForm.primaryRemark.trim(),
      value: leadForm.value.trim() || 'INR 0',
      temperature: leadForm.temperature,
      remarks: leadForm.primaryRemark.trim()
        ? [{
            id: createRemarkId(),
            text: leadForm.primaryRemark.trim(),
            createdAt: new Date().toISOString(),
            author: leadForm.owner || crmTeamMembers[0]?.name || 'Workspace Owner'
          }]
        : []
    }, crmStages, crmTeamMembers, 0);

    const nextLeads = leadFormMode === 'edit'
      ? crmLeadsWithTemperature.map((lead) => {
          if (lead.id !== leadForm.id) return lead;
          const existingRemarks = lead.remarks || [];
          const shouldAddPrimaryRemark = leadForm.primaryRemark.trim() && existingRemarks.length === 0;
          return {
            ...baseLead,
            remarks: shouldAddPrimaryRemark
              ? [{
                  id: createRemarkId(),
                  text: leadForm.primaryRemark.trim(),
                  createdAt: new Date().toISOString(),
                  author: leadForm.owner || crmTeamMembers[0]?.name || 'Workspace Owner'
                }]
              : existingRemarks
          };
        })
      : [baseLead, ...crmLeadsWithTemperature];

    const didSave = await saveLeadRecords(nextLeads, leadFormMode === 'edit' ? 'Lead updated successfully.' : 'Lead added successfully.');
    if (didSave) {
      setIsLeadFormOpen(false);
    }
  };

  const handleAddRemark = async () => {
    if (!activeLeadForRemark || !newRemark.trim()) {
      setLeadNotice({ tone: 'error', text: 'Add a remark before updating the lead.' });
      return;
    }

    const createdAt = new Date().toISOString();
    const remarkEntry: LeadRemark = {
      id: createRemarkId(),
      text: newRemark.trim(),
      createdAt,
      author: profileData?.displayName || user?.displayName || 'CRM User'
    };

    const nextLeads = crmLeadsWithTemperature.map((lead) => lead.id === activeLeadForRemark.id
      ? {
          ...lead,
          primaryRemark: newRemark.trim(),
          note: newRemark.trim(),
          lastTouch: 'Just now',
          remarks: [remarkEntry, ...(lead.remarks || [])]
        }
      : lead
    );

    const didSave = await saveLeadRecords(nextLeads, 'Lead remark updated.');
    if (didSave) {
      const updatedLead = nextLeads.find((lead) => lead.id === activeLeadForRemark.id) || null;
      setActiveLeadForRemark(updatedLead);
      setNewRemark('');
    }
  };

  const handleOpenInbox = async (lead: CrmLead) => {
    const leadPhone = normalizePhoneDigits(lead.phone);
    if (!leadPhone) {
      setLeadNotice({ tone: 'error', text: 'This lead needs a valid phone number before opening WhatsApp Business Inbox.' });
      return;
    }

    const inboxWindow = window.open('about:blank', '_blank');
    if (inboxWindow?.document) {
      inboxWindow.document.title = 'Opening WhatsApp Business Inbox';
      inboxWindow.document.body.innerHTML = '<p style="font-family: Arial, sans-serif; padding: 24px;">Opening WhatsApp Business Inbox...</p>';
    }

    try {
      const hasConversation = await hasInboxConversationForLead(lead);
      if (!hasConversation) {
        inboxWindow?.close();
        setLeadNotice({ tone: 'error', text: 'No Conversations Found with the Lead' });
        return;
      }

      const normalizedPhone = await syncLeadToInboxContact(lead);
      if (!normalizedPhone) {
        inboxWindow?.close();
        setLeadNotice({ tone: 'error', text: 'This lead needs a valid phone number before opening WhatsApp Business Inbox.' });
        return;
      }

      const inboxUrl = new URL(`/whatsapp?tab=inbox&target_phone=${encodeURIComponent(normalizedPhone)}`, window.location.origin).toString();

      if (inboxWindow) {
        inboxWindow.opener = null;
        inboxWindow.location.replace(inboxUrl);
        return;
      }

      const fallbackWindow = window.open(inboxUrl, '_blank');
      if (!fallbackWindow) {
        setLeadNotice({ tone: 'error', text: 'Allow pop-ups to open WhatsApp Business Inbox in a new tab.' });
      }
    } catch (syncError: any) {
      inboxWindow?.close();
      setLeadNotice({ tone: 'error', text: syncError?.message || 'Unable to sync this lead to WhatsApp Business Inbox.' });
    }
  };

  const handleOpenTemplateModal = async (lead: CrmLead) => {
    setActiveLeadForTemplate(lead);
    if (!approvedTemplates.length) {
      await loadApprovedTemplates();
    }
  };

  const handleSendTemplateToLead = async (templateName: string) => {
    if (!user || !activeLeadForTemplate) return;

    const number = await syncLeadToInboxContact(activeLeadForTemplate);
    if (!number) {
      setLeadNotice({ tone: 'error', text: 'This lead needs a valid phone number before sending a template.' });
      return;
    }

    setSendingTemplate(true);
    try {
      const selectedTemplate = approvedTemplates.find((template) => template.name === templateName);
      const languageCode = selectedTemplate?.language || 'en_US';
      const result = await whatsappService.sendTemplateMessage(number, templateName, languageCode);

      const messageRecord = {
        from: 'CRM',
        to: number,
        text: `Template: ${templateName}`,
        templateName,
        type: 'template',
        timestamp: Date.now(),
        direction: 'outbound',
        status: result.success ? 'SENT' : 'FAILED',
        whatsappId: result.data?.messages?.[0]?.id,
        ...(result.success ? {} : { failedReason: result.error || 'Failed to send template.' })
      };

      await addDoc(collection(db, 'users', user.uid, 'messages'), messageRecord);

      if (!result.success) {
        setLeadNotice({ tone: 'error', text: result.error || 'Unable to send the selected template.' });
        return;
      }

      setLeadNotice({ tone: 'success', text: `Template "${templateName}" sent to ${activeLeadForTemplate.name}.` });
      setActiveLeadForTemplate(null);
    } catch (sendError: any) {
      setLeadNotice({ tone: 'error', text: sendError?.message || 'Unable to send the selected template.' });
    } finally {
      setSendingTemplate(false);
    }
  };

  const handleExportLeads = () => {
    if (!crmLeadsWithTemperature.length) {
      setLeadNotice({ tone: 'error', text: 'There are no leads available to export yet.' });
      return;
    }

    const csv = Papa.unparse(crmLeadsWithTemperature.map((lead) => ({
      LeadNumber: lead.leadNumber,
      Name: lead.name,
      Company: lead.company,
      Email: lead.email,
      Phone: lead.phone,
      Source: lead.source,
      Owner: lead.owner,
      Stage: lead.stage,
      DateAdded: new Date(lead.dateAdded).toISOString().slice(0, 10),
      PrimaryRemark: lead.primaryRemark,
      Value: lead.value,
      Temperature: lead.temperature
    })));

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'WhatsApp Business-crm-leads.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadSampleCsv = () => {
    const csv = Papa.unparse(sampleCsvRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'WhatsApp Business-crm-sample.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCsvImport = async (file?: File | null) => {
    if (!file) {
      setLeadNotice({ tone: 'error', text: 'Choose a CSV file before importing.' });
      return;
    }

    setImportingCsv(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const parsedRows = (results.data as any[])
          .map((row, index) => {
            const name = row.Name || row.name || row.fullName || row.FullName;
            const email = row.Email || row.email;
            const phone = row.Phone || row.phone || row.ContactNumber || row.contactNumber || row.whatsappNumber;
            if (!name || !email || !phone) return null;

            return normalizeCrmLead({
              id: createLeadId(),
              leadNumber: row.LeadNumber || row.leadNumber,
              name,
              company: row.Company || row.company || 'Imported Lead',
              email,
              phone,
              source: row.Source || row.source || sourceOptions[0],
              owner: row.Owner || row.owner || crmTeamMembers[0]?.name || 'Workspace Owner',
              stage: row.Stage || row.stage || crmStages[0] || 'New Lead',
              dateAdded: row.DateAdded || row.dateAdded || new Date().toISOString(),
              primaryRemark: row.PrimaryRemark || row.primaryRemark || '',
              note: row.PrimaryRemark || row.primaryRemark || '',
              value: row.Value || row.value || 'INR 0',
              temperature: (row.Temperature || row.temperature || 'warm').toLowerCase()
            }, crmStages, crmTeamMembers, index);
          })
          .filter(Boolean) as CrmLead[];

        const nextLeads = [...parsedRows, ...crmLeadsWithTemperature];
        const didSave = await saveLeadRecords(nextLeads, `${parsedRows.length} lead${parsedRows.length === 1 ? '' : 's'} imported successfully.`);
        setImportingCsv(false);
        if (didSave) {
          setIsImportModalOpen(false);
        }
      },
      error: (parseError) => {
        setImportingCsv(false);
        setLeadNotice({ tone: 'error', text: parseError.message || 'Unable to import this CSV file.' });
      }
    });
  };

  const loadMetaLeadForms = async (pageId: string) => {
    if (!user || !pageId) return;

    setMetaFormsLoading(true);
    try {
      const response = await fetch(`${buildBackendUrl('/api/meta/leads/forms')}?uid=${encodeURIComponent(user.uid)}&pageId=${encodeURIComponent(pageId)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to load lead forms for this Meta Page.');
      }

      const nextForms = Array.isArray(data.forms) ? data.forms as MetaLeadCaptureForm[] : [];
      setAvailableMetaForms(nextForms);
      setResolvedMetaFormsPageId(pageId);
      setSelectedMetaFormId((current) => current && nextForms.some((form) => form.id === current) ? current : (nextForms[0]?.id || ''));
    } catch (loadError: any) {
      setResolvedMetaFormsPageId(pageId);
      setLeadNotice({ tone: 'error', text: loadError?.message || 'Unable to load lead forms for this Meta Page.' });
    } finally {
      setMetaFormsLoading(false);
    }
  };

  const handleStartMetaLeadAuth = () => {
    if (!user) return;
    window.location.href = `${buildBackendUrl('/api/meta/leads/auth/start')}?uid=${encodeURIComponent(user.uid)}`;
  };

  const handleConnectMetaLeadPage = async () => {
    if (!user) return;
    if (!selectedMetaPageId) {
      setLeadNotice({ tone: 'error', text: 'Select a Meta Page before connecting lead capture.' });
      return;
    }

    setMetaSetupSaving(true);
    try {
      const response = await fetch(buildBackendUrl('/api/meta/leads/connect-page'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uid: user.uid,
          pageId: selectedMetaPageId,
          formId: selectedMetaFormId || undefined
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to connect the selected Meta Page.');
      }

      const nextForms = Array.isArray(data.forms) ? data.forms as MetaLeadCaptureForm[] : [];
      setAvailableMetaForms(nextForms);
      setSelectedMetaFormId(data.form?.id || nextForms[0]?.id || '');
      setLeadNotice({ tone: 'success', text: data.message || 'Meta Page connected. Submit a test lead to finish setup.' });
    } catch (connectError: any) {
      setLeadNotice({ tone: 'error', text: connectError?.message || 'Unable to connect the selected Meta Page.' });
    } finally {
      setMetaSetupSaving(false);
    }
  };

  const handleOpenMetaTestingTool = async () => {
    if (!(metaLeadCapture?.pageId || selectedMetaPageId) || !(metaLeadCapture?.formId || selectedMetaFormId)) {
      setLeadNotice({ tone: 'error', text: 'Connect a Meta Page and instant form before opening the testing tool.' });
      return;
    }

    const testingWindow = window.open(officialMetaTestingToolUrl, '_blank', 'noopener,noreferrer');
    const didSave = await persistMetaLeadCapturePatch({
      status: 'pending_test',
      lastTestRequestedAt: new Date().toISOString()
    });

    if (didSave) {
      setLeadNotice({ tone: 'success', text: 'Meta Lead Ads Testing Tool opened. Submit a test lead there, then return here to retrieve it.' });
    }

    if (!testingWindow) {
      setLeadNotice({ tone: 'error', text: 'Your browser blocked the testing tool window. Allow pop-ups once and try again.' });
    }
  };

  const handleRetrieveMetaTestLead = async () => {
    if (!user) return;
    if (!(metaLeadCapture?.pageId || selectedMetaPageId) || !(metaLeadCapture?.formId || selectedMetaFormId)) {
      setLeadNotice({ tone: 'error', text: 'Connect a Meta Page and instant form before retrieving a test lead.' });
      return;
    }

    setMetaTestLoading(true);
    try {
      const response = await fetch(buildBackendUrl('/api/meta/leads/retrieve-test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uid: user.uid
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No fresh test lead was found yet.');
      }

      setLeadNotice({ tone: 'success', text: data.message || 'A Meta test lead was received successfully.' });
    } catch (testError: any) {
      setLeadNotice({ tone: 'error', text: testError?.message || 'No fresh Meta test lead was found yet.' });
    } finally {
      setMetaTestLoading(false);
    }
  };

  const validateCurrentStep = () => {
    if (currentStep === 0 && !form.workspaceName.trim()) {
      setError('Add a workspace name to continue.');
      return false;
    }

    if (currentStep === 2 && form.leadSources.length === 0) {
      setError('Pick at least one lead source to continue.');
      return false;
    }

    setError(null);
    return true;
  };

  const handleFinishSetup = async () => {
    if (!user || !validateCurrentStep()) return;

    setSaving(true);
    setError(null);

    try {
      const completedAt = new Date().toISOString();
      const ownerName = profileData?.displayName || user.displayName || 'Workspace Owner';
      const teamMembers = Array.isArray(profileData?.crmSetup?.teamMembers) && profileData.crmSetup.teamMembers.length
        ? profileData.crmSetup.teamMembers
        : buildTeamMembers(form.teamSize, ownerName);
      const existingLeads = Array.isArray(profileData?.crmSetup?.leads) ? profileData.crmSetup.leads : [];
      const leads = form.importMode === 'starter'
        ? (existingLeads.length ? existingLeads : buildStarterLeads(activeTemplate.stages, form.leadSources, teamMembers))
        : existingLeads;
      const leadsWithNumbers = assignUniqueLeadNumbers(leads);

      await setDoc(doc(db, 'users', user.uid), {
        companyName: form.workspaceName.trim(),
        crmSetup: {
          workspaceName: form.workspaceName.trim(),
          teamSize: form.teamSize,
          focus: form.focus,
          pipelineTemplate: activeTemplate.id,
          pipelineStages: activeTemplate.stages,
          leadSources: form.leadSources,
          followUpCadence: form.followUpCadence,
          importMode: form.importMode,
          ownerName,
          teamMembers,
          leads: leadsWithNumbers,
          completedAt,
          updatedAt: completedAt
        },
        toolSetup: {
          crm: true
        }
      }, { merge: true });

      setEditingSetup(false);
      setCurrentStep(0);
    } catch (saveError: any) {
      handleFirestoreError(saveError, OperationType.WRITE, `users/${user.uid}`);
      setError(saveError?.message || 'Unable to save your CRM setup right now.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-safe-screen relative flex items-center justify-center overflow-hidden bg-[#F6F9FF] px-4 sm:px-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ x: [0, 20, 0], y: [0, -18, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-[-7rem] top-[-5rem] h-72 w-72 rounded-full bg-[#1D4ED8]/10 blur-3xl"
          />
          <motion.div
            animate={{ x: [0, -16, 0], y: [0, 20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-[-7rem] right-[-6rem] h-80 w-80 rounded-full bg-sky-200/30 blur-3xl"
          />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="relative flex flex-col items-center gap-4 rounded-[1.8rem] border border-[#DBEAFE] bg-white px-8 py-10 shadow-[0_24px_70px_rgba(29,78,216,0.12)]"
        >
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#1D4ED8]" />
          <p className="text-sm font-medium text-slate-500">Loading your CRM workspace...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <div className="app-safe-screen bg-[#F6F9FF]" />;
  }

  if (!hasCrmAccess) {
    return (
      <div className="page-frame app-safe-screen bg-[#F6F9FF] px-4 py-6 sm:px-6 sm:py-8 text-slate-900">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-[#DBEAFE] bg-white p-8 shadow-[0_28px_80px_rgba(29,78,216,0.12)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#1D4ED8]">Access required</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">CRM is not unlocked for this workspace.</h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-7 text-slate-500">
            Start the free trial or unlock CRM from the product hub first, then come back here to complete setup.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[13px] font-bold text-[#1D4ED8] transition-all hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to Hub
          </button>
        </div>
      </div>
    );
  }

  if (showSetupFlow) {
    return (
      <div className="page-frame app-safe-screen relative overflow-hidden bg-[#F6F9FF] px-4 py-5 text-slate-900 md:px-6 md:py-7">
        <div className="pointer-events-none absolute inset-0 bg-white" />
        <motion.div
          style={{ scaleX: crmScrollProgress }}
          className="fixed left-0 right-0 top-0 z-[160] h-1 origin-left bg-gradient-to-r from-[#1D4ED8] via-sky-500 to-cyan-400"
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ x: [0, 20, 0], y: [0, -18, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-[-7rem] top-[-5rem] h-72 w-72 rounded-full bg-[#1D4ED8]/10 blur-3xl"
          />
          <motion.div
            animate={{ x: [0, -16, 0], y: [0, 20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute right-[-8rem] top-24 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl"
          />
          <motion.div
            animate={{ x: [0, 14, 0], y: [0, 18, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-[-9rem] left-1/3 h-80 w-80 rounded-full bg-cyan-100/50 blur-3xl"
          />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,1.05fr)_340px]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_28px_80px_rgba(29,78,216,0.12)] md:p-8">
            <div className="app-header-card app-header-compact flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="app-header-action inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-[12px] font-bold transition-all"
                >
                  <ArrowLeft size={16} />
                  Back to Hub
                </button>
                <p className="app-header-eyebrow mt-4 text-[10px] font-bold uppercase tracking-[0.28em]">WhatsApp Business CRM setup</p>
                <h1 className="app-header-title mt-1 font-black tracking-tight">Turn CRM from pending setup into a ready workspace.</h1>
                <p className="app-header-copy mt-2 max-w-2xl text-[13px] leading-6">
                  We will save the workspace basics, choose a starting pipeline, and optionally add starter leads so CRM is usable right away.
                </p>
              </div>
              <div className="app-header-chip rounded-[1.25rem] px-4 py-3 text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]">Current step</p>
                <p className="mt-1 text-lg font-black tracking-tight text-white">{currentStep + 1} / {steps.length}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className={cn(
                    'rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em]',
                    index === currentStep ? 'bg-[#1D4ED8] text-white' : index < currentStep ? 'bg-[#DBEAFE] text-[#1D4ED8]' : 'bg-slate-100 text-[#1D4ED8]'
                  )}
                >
                  {step}
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-6">
              {currentStep === 0 && (
                <>
                  <SetupHero icon={Building2} title="Workspace basics" copy="Choose how the CRM should be framed for your team from day one." />
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Workspace name</label>
                    <input
                      value={form.workspaceName}
                      onChange={(event) => setForm((current) => ({ ...current, workspaceName: event.target.value }))}
                      placeholder="VisionaryCue CRM"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[14px] text-slate-900 outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
                    />
                  </div>
                  <OptionGrid options={teamSizeOptions} selected={form.teamSize} onSelect={(value) => setForm((current) => ({ ...current, teamSize: value as TeamSize }))} />
                  <OptionGrid options={focusOptions} selected={form.focus} onSelect={(value) => setForm((current) => ({ ...current, focus: value as TeamFocus }))} />
                </>
              )}

              {currentStep === 1 && (
                <>
                  <SetupHero icon={Workflow} title="Choose a pipeline" copy="Pick a starting CRM layout. You can refine it later." />
                  <div className="grid gap-4">
                    {crmTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, pipelineTemplate: template.id }))}
                        className={cn(
                          'rounded-[1.6rem] border p-5 text-left transition-all',
                          form.pipelineTemplate === template.id ? 'border-[#1D4ED8] bg-[#EFF6FF] shadow-[0_18px_40px_rgba(29,78,216,0.10)]' : 'border-slate-200 bg-white hover:bg-slate-50'
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-base font-bold tracking-tight text-slate-950">{template.name}</p>
                            <p className="mt-2 text-[13px] leading-6 text-slate-500">{template.description}</p>
                          </div>
                          {form.pipelineTemplate === template.id && (
                            <span className="rounded-full bg-[#1D4ED8] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white">Selected</span>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {template.stages.map((stage) => (
                            <span key={stage} className="rounded-full border border-[#DBEAFE] bg-white px-3 py-2 text-[11px] font-bold text-slate-600">
                              {stage}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <SetupHero icon={Sparkles} title="Launch preferences" copy="Choose where leads come from and whether to seed the board with sample records." />
                  <div>
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Lead sources</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      {sourceOptions.map((source) => {
                        const selected = form.leadSources.includes(source);
                        return (
                          <button
                            key={source}
                            type="button"
                            onClick={() => setForm((current) => ({
                              ...current,
                              leadSources: selected ? current.leadSources.filter((entry) => entry !== source) : [...current.leadSources, source]
                            }))}
                            className={cn(
                              'rounded-[1.4rem] border px-4 py-4 text-left text-sm font-bold transition-all',
                              selected ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            )}
                          >
                            {source}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <OptionGrid options={cadenceOptions} selected={form.followUpCadence} onSelect={(value) => setForm((current) => ({ ...current, followUpCadence: value as FollowUpCadence }))} />
                  <OptionGrid
                    options={[
                      { value: 'starter', label: 'Seed starter leads', description: 'Add a few example leads so the dashboard is ready immediately.' },
                      { value: 'blank', label: 'Start blank', description: 'Keep the board empty and add your own records later.' }
                    ]}
                    selected={form.importMode}
                    onSelect={(value) => setForm((current) => ({ ...current, importMode: value as ImportMode }))}
                    columns="md:grid-cols-2"
                  />
                </>
              )}
            </div>

            {error && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-[#DBEAFE] pt-6">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCurrentStep((step) => Math.max(step - 1, 0));
                }}
                disabled={currentStep === 0 || saving}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[13px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              {currentStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => validateCurrentStep() && setCurrentStep((step) => Math.min(step + 1, steps.length - 1))}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#1D4ED8] px-5 py-3 text-[13px] font-bold text-white shadow-lg shadow-[#1D4ED8]/20 transition-all hover:bg-[#1E40AF] disabled:opacity-50"
                >
                  Next step
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishSetup}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#1D4ED8] px-5 py-3 text-[13px] font-bold text-white shadow-lg shadow-[#1D4ED8]/20 transition-all hover:bg-[#1E40AF] disabled:opacity-50"
                >
                  {saving ? 'Saving CRM setup...' : 'Finish CRM Setup'}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </motion.div>

          <motion.aside initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="space-y-5">
            <SummaryCard title="Setup summary">
              <SummaryLine label="Workspace" value={form.workspaceName || 'Not set yet'} />
              <SummaryLine label="Team size" value={teamSizeOptions.find((option) => option.value === form.teamSize)?.label || 'Small team'} />
              <SummaryLine label="Focus" value={focusOptions.find((option) => option.value === form.focus)?.label || 'Sales'} />
              <SummaryLine label="Pipeline" value={activeTemplate.name} />
              <SummaryLine label="Lead sources" value={form.leadSources.length ? form.leadSources.join(', ') : 'None selected'} />
            </SummaryCard>
            <SummaryCard title="What this completes" tone="green">
              <ChecklistLine text="Marks CRM as configured instead of pending setup" />
              <ChecklistLine text="Saves pipeline stages and source preferences" />
              <ChecklistLine text="Seeds a starter dashboard when requested" />
            </SummaryCard>
          </motion.aside>
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-frame app-safe-screen relative overflow-hidden bg-[#F6F9FF] text-slate-900"
      style={{ ['--crm-sidebar-width' as any]: isSidebarCollapsed ? '5.5rem' : '16.25rem' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#F6F9FF]" />
      <motion.div
        style={{ scaleX: crmScrollProgress }}
        className="fixed left-0 right-0 top-0 z-[160] h-1 origin-left bg-gradient-to-r from-[#1D4ED8] via-sky-500 to-cyan-400"
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -18, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-[-7rem] top-[-5rem] h-72 w-72 rounded-full bg-[#1D4ED8]/10 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -16, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute right-[-8rem] top-24 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 14, 0], y: [0, 18, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[-9rem] left-1/3 h-80 w-80 rounded-full bg-cyan-100/50 blur-3xl"
        />
      </div>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-[60] bg-slate-950/45 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "fixed left-0 top-0 z-[70] flex h-full w-[16.25rem] transform flex-col border-r border-[#1E40AF]/20 bg-[#1D4ED8] text-white shadow-[0_24px_80px_rgba(29,78,216,0.28)] transition-all duration-300 md:[width:var(--crm-sidebar-width)] md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className={cn("p-4 flex items-start justify-between gap-3", isSidebarCollapsed && "md:flex-col md:items-center")}>
          <div className={cn("min-w-0", isSidebarCollapsed && "md:flex md:w-full md:justify-center")}>
            <div className={cn("flex items-center gap-3", isSidebarCollapsed && "md:justify-center")}>
              <Logo size={44} showText={false} className="shrink-0" />
              <div className={cn("min-w-0", isSidebarCollapsed && "md:hidden")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/70">CRM Workspace</p>
                <h1 className="truncate text-xl font-black tracking-tight">WhatsApp Business CRM</h1>
              </div>
            </div>
          </div>
          <div className={cn("flex items-center gap-2", isSidebarCollapsed && "md:w-full md:justify-center")}>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition-all hover:bg-white/15 md:flex"
            >
              <ChevronRight className={cn("transition-transform", !isSidebarCollapsed && "rotate-180")} size={18} />
            </button>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-2xl p-2 text-white/80 md:hidden"
            >
              <ChevronRight className="rotate-180" size={18} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            title="Back to Hub"
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 text-sm font-medium text-white transition-all hover:bg-white/15",
              isSidebarCollapsed && "md:justify-center"
            )}
          >
            <ArrowLeft size={18} />
            <span className={cn(isSidebarCollapsed && "md:hidden")}>Back to Hub</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-2 no-scrollbar">
          {[
            { key: 'home' as const, label: 'Home', icon: LayoutDashboard },
            { key: 'leads' as const, label: 'Leads', icon: Target },
            { key: 'pipeline' as const, label: 'Pipeline', icon: Workflow },
            { key: 'meta_setup' as const, label: 'Meta Leads Capture Setup', icon: Filter }
          ].map((item) => (
            <CrmNavItem
              key={item.key}
              icon={<item.icon size={20} />}
              label={item.label}
              active={activeView === item.key}
              collapsed={isSidebarCollapsed}
              onClick={() => {
                setActiveView(item.key);
                setIsSidebarOpen(false);
              }}
            />
          ))}
        </nav>

        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => {
              setCurrentStep(0);
              setEditingSetup(true);
              setIsSidebarOpen(false);
            }}
            title="Edit setup"
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-transparent px-4 py-3 text-[13px] font-bold text-white transition-all hover:bg-white/10",
              isSidebarCollapsed && "md:px-0"
            )}
          >
            <ArrowRight size={16} />
            <span className={cn(isSidebarCollapsed && "md:hidden")}>Edit setup</span>
          </button>
        </div>
      </aside>

      <main className="relative md:ml-[var(--crm-sidebar-width)]">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7">
          <div className="mb-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#DBEAFE] bg-white text-[#1D4ED8] shadow-sm md:hidden"
            >
              <Menu size={18} />
            </button>
            <div />
          </div>

          {activeView === 'home' && (
            <CrmRevealSection className="mb-6" delay={0.02}>
              <section className="rounded-[2rem] bg-[#1D4ED8] px-6 py-6 text-white shadow-[0_24px_80px_rgba(29,78,216,0.22)] md:px-8 md:py-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-white/90">
                      <CalendarDays size={14} />
                      {todayLabel}
                    </div>
                    <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Greetings, {greetingName}!</h1>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80 md:text-[15px]">
                      Here is a quick view of your CRM workspace, team ownership, and pipeline activity for today.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/85">
                      {pipelineName}
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/85">
                      {teamPerformance.length} team members
                    </span>
                  </div>
                </div>
              </section>
            </CrmRevealSection>
          )}

          {activeView === 'home' && (
            <>
              <CrmRevealSection className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" delay={0.06}>
                {overviewCards.map((card) => (
                  <CrmOverviewCard key={card.label} icon={card.icon} label={card.label} value={card.value} helper={card.helper} />
                ))}
              </CrmRevealSection>

              <CrmRevealSection className="rounded-[1.9rem] border border-[#DBEAFE] bg-white p-5 shadow-[0_20px_60px_rgba(29,78,216,0.08)] md:p-6" delay={0.1}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">Team overview</p>
                    <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Lead ownership across your team</h2>
                  </div>
                  <span className="rounded-full bg-[#EFF6FF] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                    {crmLeadsWithTemperature.length} active leads
                  </span>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr>
                        {['Team member', 'Role', 'Total Leads', 'Hot', 'Warm', 'Cold', 'Latest activity'].map((heading) => (
                          <th key={heading} className="px-4 text-left text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teamPerformance.map((member) => (
                        <tr key={member.name} className="rounded-2xl">
                          <td className="rounded-l-[1.3rem] border-y border-l border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4 text-sm font-bold text-slate-900">
                            {member.name}
                          </td>
                          <td className="border-y border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4 text-sm text-slate-600">
                            {member.role}
                          </td>
                          <td className="border-y border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4 text-sm font-semibold text-slate-900">
                            {member.totalLeads}
                          </td>
                          <td className="border-y border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4">
                            <CountPill tone="hot" value={member.hot} />
                          </td>
                          <td className="border-y border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4">
                            <CountPill tone="warm" value={member.warm} />
                          </td>
                          <td className="border-y border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4">
                            <CountPill tone="cold" value={member.cold} />
                          </td>
                          <td className="rounded-r-[1.3rem] border-y border-r border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4 text-sm text-slate-600">
                            {member.latestTouch}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </CrmRevealSection>
            </>
          )}

          {activeView === 'leads' && (
            <CrmRevealSection className="rounded-[1.9rem] border border-[#DBEAFE] bg-white p-5 shadow-[0_20px_60px_rgba(29,78,216,0.08)] md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">Leads</p>
                  <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Lead list synced with WhatsApp Business Inbox</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Search, filter, add, import, export, message, and update every lead from one clean table.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <ToolbarButton icon={Plus} label="Add Leads" onClick={() => openLeadForm('add')} />
                  <ToolbarButton icon={FileUp} label="Import Data via CSV" onClick={() => setIsImportModalOpen(true)} />
                  <ToolbarButton icon={Download} label="Export" onClick={handleExportLeads} />
                </div>
              </div>

              {leadNotice && (
                <div className={cn(
                  "mt-5 rounded-[1.3rem] border px-4 py-3 text-sm font-medium",
                  leadNotice.tone === 'success'
                    ? "border-[#5B45FF] bg-[#5B45FF] text-white"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                )}>
                  {leadNotice.text}
                </div>
              )}

              <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,0.7fr))]">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by lead number, name, phone, or email"
                    className="w-full rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] px-11 py-3 text-sm text-slate-900 outline-none transition-all focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/10"
                  />
                </div>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/10"
                />
                <select
                  value={ownerFilter}
                  onChange={(event) => setOwnerFilter(event.target.value)}
                  className="rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/10"
                >
                  <option value="all">All owners</option>
                  {leadOwners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                </select>
                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  className="rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/10"
                >
                  <option value="all">All sources</option>
                  {leadSources.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
                <select
                  value={stageFilter}
                  onChange={(event) => setStageFilter(event.target.value)}
                  className="rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/10"
                >
                  <option value="all">All stages</option>
                  {crmStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-[#BFDBFE] bg-[#F8FBFF] px-4 py-12 text-center text-sm font-medium text-slate-500">
                  No leads match the current search or filters.
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-[1200px] border-separate border-spacing-y-3">
                    <thead>
                      <tr>
                        {['Lead', 'Contact Number', 'Email', 'Owner', 'Source', 'Stage', 'Date Added', 'Primary Remark', 'Actions'].map((heading) => (
                          <th
                            key={heading}
                            className={cn(
                              "bg-[#1D4ED8] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-[0.22em] text-white",
                              heading === 'Lead' && "rounded-l-[1.2rem]",
                              heading === 'Actions' && "rounded-r-[1.2rem]"
                            )}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td className="rounded-l-[1.3rem] border-y border-l border-[#DBEAFE] bg-white px-4 py-4 align-top">
                            <p className="text-sm font-bold text-slate-900">{lead.name}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">{lead.leadNumber}</p>
                            <p className="mt-1 text-xs text-slate-500">{lead.company}</p>
                            <div className="mt-2">
                              <TemperaturePill temperature={lead.temperature || 'cold'} />
                            </div>
                          </td>
                          <td className="border-y border-[#DBEAFE] bg-white px-4 py-4 align-top">
                            <button
                              type="button"
                              onClick={() => void handleOpenTemplateModal(lead)}
                              className="inline-flex items-center gap-2 rounded-full bg-[#EFF6FF] px-3 py-2 text-sm font-semibold text-[#1D4ED8] transition-all hover:bg-[#DBEAFE]"
                            >
                              <img src={WHATSAPP_ICON_URL} alt="WhatsApp" className="h-4 w-4 object-contain" />
                              {lead.phone}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleOpenInbox(lead)}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]"
                            >
                              Open in Inbox
                              <ExternalLink size={12} />
                            </button>
                          </td>
                          <td className="border-y border-[#DBEAFE] bg-white px-4 py-4 align-top">
                            <a
                              href={`mailto:${lead.email}`}
                              className="inline-flex items-center gap-2 rounded-full bg-[#EFF6FF] px-3 py-2 text-sm font-semibold text-[#1D4ED8] transition-all hover:bg-[#DBEAFE]"
                            >
                              <Mail size={14} />
                              {lead.email}
                            </a>
                          </td>
                          <td className="border-y border-[#DBEAFE] bg-white px-4 py-4 align-top text-sm text-slate-600">
                            <p className="font-semibold text-slate-900">{lead.owner}</p>
                            <p className="mt-1 text-xs text-slate-500">{lead.value}</p>
                          </td>
                          <td className="border-y border-[#DBEAFE] bg-white px-4 py-4 align-top text-sm text-slate-600">{lead.source}</td>
                          <td className="border-y border-[#DBEAFE] bg-white px-4 py-4 align-top text-sm text-slate-600">{lead.stage}</td>
                          <td className="border-y border-[#DBEAFE] bg-white px-4 py-4 align-top text-sm text-slate-600">{formatLeadDate(lead.dateAdded)}</td>
                          <td className="border-y border-[#DBEAFE] bg-white px-4 py-4 align-top">
                            <p className="text-sm text-slate-700">{lead.primaryRemark || 'No remarks yet.'}</p>
                            <p className="mt-2 text-xs text-slate-400">{(lead.remarks || []).length} timeline item{(lead.remarks || []).length === 1 ? '' : 's'}</p>
                          </td>
                          <td className="rounded-r-[1.3rem] border-y border-r border-[#DBEAFE] bg-white px-4 py-4 align-top">
                            <div className="flex flex-wrap gap-2">
                              <LeadActionButton icon={Edit3} label="Edit" onClick={() => openLeadForm('edit', lead)} />
                              <LeadActionButton icon={WabaIcon} label="Update" onClick={() => {
                                setActiveLeadForRemark(lead);
                                setNewRemark('');
                              }} />
                              <LeadActionButton icon={CalendarDays} label="Timeline" onClick={() => setActiveLeadForTimeline(lead)} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CrmRevealSection>
          )}

          {activeView === 'pipeline' && (
            <CrmRevealSection className="rounded-[1.9rem] border border-[#DBEAFE] bg-white p-5 shadow-[0_20px_60px_rgba(29,78,216,0.08)] md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">Pipeline</p>
                  <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{pipelineName}</h2>
                </div>
                <span className="rounded-full bg-[#EFF6FF] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                  {crmStages.length} stages
                </span>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-4">
                {crmStages.map((stage) => {
                  const leadsForStage = crmLeadsWithTemperature.filter((lead) => lead.stage === stage);
                  return (
                    <div key={stage} className="rounded-[1.6rem] border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900">{stage}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                          {leadsForStage.length}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {leadsForStage.length > 0 ? leadsForStage.map((lead) => (
                          <div key={lead.id} className="rounded-[1.3rem] border border-[#DBEAFE] bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[13px] font-bold text-slate-900">{lead.name}</p>
                                <p className="mt-1 text-[12px] text-slate-500">{lead.company}</p>
                              </div>
                              <TemperaturePill temperature={lead.temperature || 'cold'} />
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-slate-500">
                              <span>{lead.owner}</span>
                              <span>{lead.lastTouch}</span>
                            </div>
                            <p className="mt-3 text-[12px] leading-5 text-slate-500">{lead.note}</p>
                          </div>
                        )) : (
                          <div className="rounded-[1.3rem] border border-dashed border-[#BFDBFE] bg-white px-3 py-6 text-center text-[12px] font-medium text-slate-400">
                            No leads in this stage yet.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CrmRevealSection>
          )}

          {activeView === 'meta_setup' && (
            <section className="space-y-6">
              <CrmRevealSection className="rounded-[1.9rem] border border-[#DBEAFE] bg-white p-5 shadow-[0_20px_60px_rgba(29,78,216,0.08)] md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">Meta Leads Capture Setup</p>
                    <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Connect your Meta Page, then verify setup with a real test lead</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      This setup now stays pending until WhatsApp Business CRM actually receives a fresh lead from Meta's official Lead Ads Testing Tool.
                    </p>
                  </div>
                  <span className={cn(
                    "rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em]",
                    metaLeadCaptureConfigured ? "bg-[#5B45FF] text-white" : "bg-[#DBEAFE] text-[#1D4ED8]"
                  )}>
                    {metaSetupStatusLabel}
                  </span>
                </div>
              </CrmRevealSection>

              <CrmRevealSection className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_380px]" delay={0.06}>
                <div className="rounded-[1.9rem] border border-[#DBEAFE] bg-white p-5 shadow-[0_20px_60px_rgba(29,78,216,0.08)] md:p-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">Embedded connection flow</p>
                  <div className="mt-5 space-y-5">
                    <div className="rounded-[1.5rem] border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">1. Connect your Meta account</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Pull your accessible Facebook Pages directly into CRM so you can select the exact Page and instant form to watch.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleStartMetaLeadAuth}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[#1D4ED8] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[#1E40AF]"
                        >
                          Connect Meta Page
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <LeadField label="Meta Page">
                        <select
                          value={selectedMetaPageId}
                          onChange={(event) => setSelectedMetaPageId(event.target.value)}
                          className={crmInputClass}
                        >
                          <option value="">{metaLeadPages.length ? 'Choose a Meta Page' : 'Connect Meta first'}</option>
                          {metaLeadPages.map((page) => (
                            <option key={page.id} value={page.id}>{page.name}</option>
                          ))}
                        </select>
                      </LeadField>
                      <LeadField label="Instant Form">
                        <select
                          value={selectedMetaFormId}
                          onChange={(event) => setSelectedMetaFormId(event.target.value)}
                          disabled={!selectedMetaPageId || metaFormsLoading || availableMetaForms.length === 0}
                          className={crmInputClass}
                        >
                          <option value="">
                            {!selectedMetaPageId
                              ? 'Select a Page first'
                              : metaFormsLoading
                                ? 'Loading forms...'
                                : availableMetaForms.length
                                  ? 'Choose an instant form'
                                  : 'No forms found yet'}
                          </option>
                          {availableMetaForms.map((form) => (
                            <option key={form.id} value={form.id}>{form.name}</option>
                          ))}
                        </select>
                      </LeadField>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void loadMetaLeadForms(selectedMetaPageId)}
                        disabled={!selectedMetaPageId || metaFormsLoading}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#BFDBFE] bg-white px-4 py-3 text-sm font-bold text-[#1D4ED8] transition-all hover:bg-[#F8FBFF] disabled:opacity-60"
                      >
                        <RefreshCw size={14} className={cn(metaFormsLoading && 'animate-spin')} />
                        {metaFormsLoading ? 'Loading Forms...' : 'Refresh Forms'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleConnectMetaLeadPage()}
                        disabled={!selectedMetaPageId || !selectedMetaFormId || metaSetupSaving}
                        className="rounded-2xl bg-[#1D4ED8] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[#1E40AF] disabled:opacity-60"
                      >
                        {metaSetupSaving ? 'Connecting...' : 'Save Page + Form Connection'}
                      </button>
                    </div>

                    <div className="rounded-[1.5rem] border border-[#DBEAFE] bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">2. Use Meta's official Lead Ads Testing Tool</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Open the official Meta tool, submit a fresh test lead for the selected instant form, then return here and retrieve it.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleOpenMetaTestingTool()}
                          disabled={!(metaLeadCapture?.pageId || selectedMetaPageId) || !(metaLeadCapture?.formId || selectedMetaFormId)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-[#BFDBFE] bg-white px-4 py-3 text-sm font-bold text-[#1D4ED8] transition-all hover:bg-[#F8FBFF] disabled:opacity-60"
                        >
                          Open Official Tool
                          <ExternalLink size={14} />
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handleRetrieveMetaTestLead()}
                          disabled={!(metaLeadCapture?.pageId || selectedMetaPageId) || !(metaLeadCapture?.formId || selectedMetaFormId) || metaTestLoading}
                          className="rounded-2xl bg-[#1D4ED8] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[#1E40AF] disabled:opacity-60"
                        >
                          {metaTestLoading ? 'Retrieving Test Lead...' : 'Retrieve Test Lead'}
                        </button>
                        <a
                          href={officialMetaTestingToolUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50"
                        >
                          View Meta Tool
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[1.9rem] border border-[#DBEAFE] bg-white p-5 shadow-[0_20px_60px_rgba(29,78,216,0.08)]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">Current status</p>
                    <div className="mt-4 space-y-3">
                      <SummaryLine label="Setup status" value={metaSetupStatusLabel} />
                      <SummaryLine label="Connected Page" value={metaLeadCapture?.pageName || connectedMetaPage?.name || 'Not connected'} />
                      <SummaryLine label="Selected Form" value={metaLeadCapture?.formName || 'Not selected'} />
                      <SummaryLine label="Last test requested" value={metaLeadCapture?.lastTestRequestedAt ? formatLeadDateTime(metaLeadCapture.lastTestRequestedAt) : 'Not started'} />
                      <SummaryLine label="Last lead received" value={metaLeadCapture?.lastWebhookLeadAt ? formatLeadDateTime(metaLeadCapture.lastWebhookLeadAt) : 'No webhook lead yet'} />
                      <SummaryLine label="Webhook URL" value={metaLeadCapture?.webhookUrl || buildBackendUrl('/meta/webhook')} />
                    </div>
                  </div>

                  <div className="rounded-[1.9rem] border border-[#DBEAFE] bg-[#F8FBFF] p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">Recommended mapping</p>
                    <div className="mt-4 space-y-3">
                      <SummaryLine label="Lead name" value="Meta full name" />
                      <SummaryLine label="Email" value="Meta email field" />
                      <SummaryLine label="Phone" value="Meta phone number" />
                      <SummaryLine label="Source" value="Meta Ads" />
                      <SummaryLine label="Stage" value={crmStages[0] || 'New Lead'} />
                    </div>
                  </div>

                  <div className="rounded-[1.9rem] border border-[#DBEAFE] bg-white p-5 shadow-[0_20px_60px_rgba(29,78,216,0.08)]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">How verification works</p>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                      <p>1. Connect the Meta account and save the exact Page + instant form.</p>
                      <p>2. Open Meta's official Lead Ads Testing Tool and submit a fresh test lead.</p>
                      <p>3. Retrieve the latest test lead here. WhatsApp Business marks the setup as configured only after the lead reaches CRM.</p>
                    </div>
                  </div>
                </div>
              </CrmRevealSection>
            </section>
          )}

          {isLeadFormOpen && (
            <CrmModal
              title={leadFormMode === 'edit' ? 'Edit Lead' : 'Add Lead'}
              copy={leadFormMode === 'edit' ? 'Update the core lead details used across CRM and Inbox.' : 'Create a new lead with enough detail to start tracking immediately.'}
              onClose={() => setIsLeadFormOpen(false)}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <LeadField label="Name">
                  <input value={leadForm.name} onChange={(event) => setLeadForm((current) => ({ ...current, name: event.target.value }))} className={crmInputClass} />
                </LeadField>
                <LeadField label="Company">
                  <input value={leadForm.company} onChange={(event) => setLeadForm((current) => ({ ...current, company: event.target.value }))} className={crmInputClass} />
                </LeadField>
                <LeadField label="Email">
                  <input value={leadForm.email} onChange={(event) => setLeadForm((current) => ({ ...current, email: event.target.value }))} className={crmInputClass} />
                </LeadField>
                <LeadField label="Contact Number">
                  <input value={leadForm.phone} onChange={(event) => setLeadForm((current) => ({ ...current, phone: event.target.value }))} className={crmInputClass} />
                </LeadField>
                <LeadField label="Source">
                  <select value={leadForm.source} onChange={(event) => setLeadForm((current) => ({ ...current, source: event.target.value }))} className={crmInputClass}>
                    {leadSources.map((source) => <option key={source} value={source}>{source}</option>)}
                  </select>
                </LeadField>
                <LeadField label="Lead Owner">
                  <select value={leadForm.owner} onChange={(event) => setLeadForm((current) => ({ ...current, owner: event.target.value }))} className={crmInputClass}>
                    {leadOwners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                  </select>
                </LeadField>
                <LeadField label="Stage">
                  <select value={leadForm.stage} onChange={(event) => setLeadForm((current) => ({ ...current, stage: event.target.value }))} className={crmInputClass}>
                    {crmStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                  </select>
                </LeadField>
                <LeadField label="Date Added">
                  <input type="date" value={leadForm.dateAdded} onChange={(event) => setLeadForm((current) => ({ ...current, dateAdded: event.target.value }))} className={crmInputClass} />
                </LeadField>
                <LeadField label="Estimated Value">
                  <input value={leadForm.value} onChange={(event) => setLeadForm((current) => ({ ...current, value: event.target.value }))} className={crmInputClass} />
                </LeadField>
                <LeadField label="Temperature">
                  <select value={leadForm.temperature} onChange={(event) => setLeadForm((current) => ({ ...current, temperature: event.target.value as LeadTemperature }))} className={crmInputClass}>
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="cold">Cold</option>
                  </select>
                </LeadField>
              </div>
              <LeadField label="Primary Remark" className="mt-4">
                <textarea value={leadForm.primaryRemark} onChange={(event) => setLeadForm((current) => ({ ...current, primaryRemark: event.target.value }))} rows={4} className={cn(crmInputClass, "min-h-[110px]")} />
              </LeadField>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setIsLeadFormOpen(false)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50">
                  Cancel
                </button>
                <button type="button" onClick={() => void handleLeadFormSubmit()} className="rounded-2xl bg-[#1D4ED8] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[#1E40AF]">
                  {leadFormMode === 'edit' ? 'Save Lead' : 'Add Lead'}
                </button>
              </div>
            </CrmModal>
          )}

          {activeLeadForRemark && (
            <CrmModal
              title={`Update ${activeLeadForRemark.name}`}
              copy="Add a new remark and keep a running timeline of everything captured for this lead."
              onClose={() => setActiveLeadForRemark(null)}
            >
              <LeadField label="New Remark">
                <textarea value={newRemark} onChange={(event) => setNewRemark(event.target.value)} rows={4} className={cn(crmInputClass, "min-h-[120px]")} placeholder="Add the latest context, follow-up, or sales note..." />
              </LeadField>
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => void handleAddRemark()} className="rounded-2xl bg-[#1D4ED8] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[#1E40AF]">
                  Update Lead
                </button>
              </div>
              <div className="mt-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Remark Timeline</p>
                <div className="mt-4 space-y-3">
                  {(activeLeadForRemark.remarks || []).length === 0 ? (
                    <div className="rounded-[1.3rem] border border-dashed border-[#BFDBFE] bg-[#F8FBFF] px-4 py-5 text-sm text-slate-500">
                      No remarks added yet.
                    </div>
                  ) : (
                    activeLeadForRemark.remarks.map((remark) => (
                      <div key={remark.id} className="rounded-[1.3rem] border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900">{remark.author}</p>
                          <p className="text-xs text-slate-400">{formatLeadDateTime(remark.createdAt)}</p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{remark.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CrmModal>
          )}

          {activeLeadForTimeline && (
            <CrmModal
              title={`${activeLeadForTimeline.name} Timeline`}
              copy="Review the full remark history for this lead."
              onClose={() => setActiveLeadForTimeline(null)}
            >
              <div className="space-y-3">
                {(activeLeadForTimeline.remarks || []).length === 0 ? (
                  <div className="rounded-[1.3rem] border border-dashed border-[#BFDBFE] bg-[#F8FBFF] px-4 py-5 text-sm text-slate-500">
                    No timeline entries available yet.
                  </div>
                ) : (
                  activeLeadForTimeline.remarks.map((remark) => (
                    <div key={remark.id} className="rounded-[1.3rem] border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">{remark.author}</p>
                        <p className="text-xs text-slate-400">{formatLeadDateTime(remark.createdAt)}</p>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{remark.text}</p>
                    </div>
                  ))
                )}
              </div>
            </CrmModal>
          )}

          {activeLeadForTemplate && (
            <CrmModal
              title={`Send WhatsApp Template to ${activeLeadForTemplate.name}`}
              copy="Choose an approved template from WhatsApp Business Inbox and send it directly to this lead."
              onClose={() => setActiveLeadForTemplate(null)}
            >
              <div className="flex items-center justify-between rounded-[1.3rem] border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{activeLeadForTemplate.phone}</p>
                  <p className="mt-1 text-xs text-slate-500">{activeLeadForTemplate.email}</p>
                </div>
                <button type="button" onClick={() => void handleOpenInbox(activeLeadForTemplate)} className="inline-flex items-center gap-2 rounded-2xl border border-[#DBEAFE] bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                  Open Inbox
                  <ExternalLink size={12} />
                </button>
              </div>
              <div className="mt-5 space-y-3">
                {loadingTemplates ? (
                  <div className="rounded-[1.3rem] border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-5 text-sm text-slate-500">
                    Loading approved templates from WhatsApp Business Inbox...
                  </div>
                ) : approvedTemplates.length === 0 ? (
                  <div className="rounded-[1.3rem] border border-dashed border-[#BFDBFE] bg-[#F8FBFF] px-4 py-5 text-sm text-slate-500">
                    No approved templates are available right now.
                  </div>
                ) : (
                  approvedTemplates.map((template) => (
                    <button
                      key={template.id || template.name}
                      type="button"
                      onClick={() => void handleSendTemplateToLead(template.name)}
                      disabled={sendingTemplate}
                      className="flex w-full items-center justify-between rounded-[1.3rem] border border-[#DBEAFE] bg-white px-4 py-4 text-left transition-all hover:bg-[#F8FBFF] disabled:opacity-60"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{template.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{template.category || 'Template'} | {template.language || 'en_US'}</p>
                      </div>
                      <span className="rounded-full bg-[#EFF6FF] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                        {sendingTemplate ? 'Sending...' : 'Send'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </CrmModal>
          )}

          {isImportModalOpen && (
            <CrmModal
              title="Import Leads via CSV"
              copy="Use the sample CSV format below, then upload your lead file to add records in bulk."
              onClose={() => setIsImportModalOpen(false)}
            >
              <div className="rounded-[1.3rem] border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                <p className="text-sm font-bold text-slate-900">Import instructions</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>Include `Name`, `Email`, and `Phone` columns in every row.</li>
                  <li>Optional columns: `LeadNumber`, `Company`, `Source`, `Owner`, `Stage`, `DateAdded`, `PrimaryRemark`, `Value`, and `Temperature`.</li>
                  <li>Dates should be in `YYYY-MM-DD` format for best results.</li>
                </ul>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={handleDownloadSampleCsv} className="rounded-2xl border border-[#DBEAFE] bg-white px-4 py-3 text-sm font-bold text-[#1D4ED8] transition-all hover:bg-[#F8FBFF]">
                  Download Sample CSV
                </button>
                <button type="button" onClick={() => csvInputRef.current?.click()} className="rounded-2xl bg-[#1D4ED8] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[#1E40AF]">
                  Choose CSV File
                </button>
                <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={(event) => void handleCsvImport(event.target.files?.[0] || null)} />
              </div>
              {importingCsv && <p className="mt-4 text-sm text-slate-500">Importing leads from your CSV file...</p>}
            </CrmModal>
          )}

        </div>
        </main>
      </div>
  );
}

function CrmModal({
  title,
  copy,
  children,
  onClose
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-[#DBEAFE] bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#1D4ED8]">WhatsApp Business CRM</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{copy}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 transition-all hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function LeadField({
  label,
  children,
  className
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function CrmRevealSection({
  children,
  className,
  delay = 0
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.45, ease: 'easeOut', delay }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="inline-flex items-center gap-2 rounded-2xl border border-[#DBEAFE] bg-white px-4 py-3 text-sm font-bold text-[#1D4ED8] transition-all hover:bg-[#F8FBFF]"
    >
      <Icon size={16} />
      {label}
    </motion.button>
  );
}

function LeadActionButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#DBEAFE] bg-[#F8FBFF] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8] transition-all hover:bg-[#EFF6FF]"
    >
      <Icon size={12} />
      {label}
    </motion.button>
  );
}

function SetupHero({
  icon: Icon,
  title,
  copy
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1D4ED8] text-white shadow-lg shadow-[#1D4ED8]/20">
          <Icon size={20} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-950">{title}</p>
          <p className="mt-1 text-[13px] leading-6 text-slate-500">{copy}</p>
        </div>
      </div>
    </div>
  );
}

function CrmNavItem({
  icon,
  label,
  active,
  collapsed = false,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      whileHover={{ x: collapsed ? 0 : 4 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm font-medium transition-all",
        collapsed && "md:justify-center",
        active
          ? "border-white/20 bg-[#5B45FF] text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)]"
          : "border-transparent text-white/80 hover:border-white/10 hover:bg-white/12 hover:text-white"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-2xl transition-all",
          active ? "bg-white/15 text-white" : "bg-white/10 text-white"
        )}
      >
        {icon}
      </span>
      <span className={cn("font-semibold", collapsed && "md:hidden")}>{label}</span>
    </motion.button>
  );
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function CrmOverviewCard({
  icon: Icon,
  label,
  value,
  helper
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className="rounded-[1.7rem] border border-[#DBEAFE] bg-white p-5 shadow-[0_20px_55px_rgba(29,78,216,0.08)]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#1D4ED8]">
        <Icon size={22} />
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </motion.div>
  );
}

function CountPill({ tone, value }: { tone: LeadTemperature; value: number }) {
  const toneClasses = tone === 'hot'
    ? 'bg-rose-50 text-rose-600'
    : tone === 'warm'
      ? 'bg-amber-50 text-amber-600'
      : 'bg-sky-50 text-sky-600';

  return (
    <span className={cn("inline-flex min-w-[3rem] items-center justify-center rounded-full px-3 py-1 text-xs font-bold", toneClasses)}>
      {value}
    </span>
  );
}

function TemperaturePill({ temperature }: { temperature: LeadTemperature }) {
  const Icon = temperature === 'hot' ? Flame : temperature === 'warm' ? Sparkles : Snowflake;
  const toneClasses = temperature === 'hot'
    ? 'bg-rose-50 text-rose-600'
    : temperature === 'warm'
      ? 'bg-amber-50 text-amber-600'
      : 'bg-sky-50 text-sky-600';

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]", toneClasses)}>
      <Icon size={12} />
      {temperature}
    </span>
  );
}

function OptionGrid({
  options,
  selected,
  onSelect,
  columns = 'md:grid-cols-3'
}: {
  options: Array<{ value: string; label: string; description: string }>;
  selected: string;
  onSelect: (value: string) => void;
  columns?: string;
}) {
  return (
    <div className={cn('grid gap-4', columns)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className={cn(
            'rounded-[1.5rem] border p-4 text-left transition-all',
            selected === option.value ? 'border-[#1D4ED8] bg-[#EFF6FF] shadow-[0_16px_40px_rgba(29,78,216,0.08)]' : 'border-slate-200 bg-white hover:bg-slate-50'
          )}
        >
          <p className="text-sm font-bold text-slate-950">{option.label}</p>
          <p className="mt-2 text-[13px] leading-6 text-slate-500">{option.description}</p>
        </button>
      ))}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.7rem] border border-[#DBEAFE] bg-white p-5 shadow-[0_18px_50px_rgba(29,78,216,0.08)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#1D4ED8]">
        <Icon size={22} />
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function SummaryCard({
  title,
  children,
  tone = 'violet'
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'violet' | 'green';
}) {
  return (
    <div className={cn(
      'rounded-[1.8rem] border border-[#DBEAFE] p-5 shadow-[0_22px_60px_rgba(29,78,216,0.08)]',
      tone === 'green' ? 'bg-white' : 'bg-white'
    )}>
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#1D4ED8]">{title}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <span className="text-right text-[13px] font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function ChecklistLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#DBEAFE] bg-white px-4 py-3">
      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#DBEAFE] text-[#1D4ED8]">
        <CheckCircle2 size={15} />
      </div>
      <p className="text-[13px] leading-6 text-slate-600">{text}</p>
    </div>
  );
}
