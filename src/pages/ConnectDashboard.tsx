/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  User as UserIcon,
  Camera,
  ArrowLeft,
  MapPin,
  Mail,
  Send, 
  History, 
  Settings, 
  Users,
  LogOut,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Plus,
  Zap,
  Link as LinkIcon,
  FileUp,
  Filter,
  MoreHorizontal,
  Paperclip,
  Smile,
  ChevronRight,
  ChevronDown,
  Star,
  Heart,
  ShieldCheck,
  Globe,
  Info,
  Smartphone,
  Trash2,
  Edit3,
  RefreshCw,
  SlidersHorizontal,
  Database as DatabaseIcon,
  Activity,
  Save,
  Phone,
  PhoneOff,
  Tag,
  StickyNote,
  Download,
  Image as ImageIcon,
  Video,
  FileText,
  BellRing,
  Volume2,
  VolumeX,
  UserPlus,
  MessageSquareText,
  PhoneCall,
  Megaphone,
  LayoutTemplate,
  ContactRound,
  Workflow,
  Building2,
  RadioTower,
  Settings2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { whatsappService } from '../services/whatsappService';
import { auth, db, storage } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where, orderBy, addDoc, getDoc, getDocs, limit, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  WhatsAppTemplate,
  BroadcastSession,
  Lead,
  WhatsAppPhoneNumber,
  WhatsAppBusinessProfile,
  WhatsAppAccountOverview,
  WhatsAppCommerceSettings,
  WhatsAppCatalogProduct,
  WhatsAppCallingProbe,
  WhatsAppCallPermissionAction,
  WhatsAppCallSessionDescription
} from '../types';
import { handleFirestoreError, OperationType } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Papa from 'papaparse';
import { WebhooksSection } from '../components/WebhooksSection';
import { Logo } from '../components/Logo';
import { buildBackendUrl, buildBackendWsUrl } from '../lib/backend';
import { cn } from '../lib/utils';
import whatsappCallsLogo from '../../WhatsApp Call Logo.avif';
import defaultConversationProfile from '../../Default Profile.png';

const WHATSAPP_ICON_URL = 'https://upload.wikimedia.org/wikipedia/commons/1/19/WhatsApp_logo-color-vertical.svg';

const WabaIcon = ({ className = "" }: { className?: string }) => (
  <img src="/waba.svg" alt="" className={cn("object-contain", className)} />
);
const CALL_ICE_GATHERING_TIMEOUT_MS = 12000;

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

function WhatsAppCallsIcon({ size = 18 }: { size?: number }) {
  return <BrandImageIcon src={whatsappCallsLogo} alt="WhatsApp Calls" size={size} />;
}

type TabType = 'inbox' | 'calls' | 'broadcast' | 'templates' | 'contacts' | 'automations' | 'profile' | 'channel_status' | 'settings';
type CallDirection = 'incoming' | 'outgoing';
type CallStatus = 'ringing' | 'missed' | 'ongoing' | 'ended' | 'failed';
type CallFilter = 'all' | 'missed' | 'incoming' | 'outgoing';
type SocketConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'error' | 'disconnected';

type CallMessageInfo = {
  direction: CallDirection;
  status: CallStatus;
  label: string;
  mode?: 'voice';
};

type CallDiagnosticEvent = {
  kind: 'socket_registration' | 'webhook_route' | 'socket_status';
  timestamp: number;
  note?: string;
  socketState?: SocketConnectionState;
  userId?: string | null;
  phoneNumberId?: string | null;
  businessNumber?: string;
  callId?: string | null;
  callEvent?: string | null;
  callDirection?: string | null;
  callStatus?: string | null;
  webhookDirection?: string | null;
  webhookStatus?: string | null;
  contactName?: string;
  contactPhone?: string;
  matchedClientSessions?: number;
  matchedFirestoreUsers?: number;
  routedUserIds?: string[];
};

type CallLogRecord = CallMessageInfo & {
  id: string;
  callId?: string;
  contactName: string;
  contactPhone: string;
  startedAt: number;
  endedAt?: number | null;
  durationSeconds?: number;
  phoneNumberId?: string;
  businessPhoneNumber?: string;
  permissionStatus?: string;
  permissionActions?: WhatsAppCallPermissionAction[];
  source?: 'inbox' | 'calls_tab' | 'webhook' | 'session';
  participants?: string[];
  session?: WhatsAppCallSessionDescription | null;
  rawCallPayload?: any;
};

type ActiveCallSession = CallLogRecord & {
  speakerOn: boolean;
  participants: string[];
};

type SupportedMessageMediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

type MessageMediaInfo = {
  type: SupportedMessageMediaType;
  mediaId: string;
  mimeType?: string;
  caption?: string;
  filename?: string;
  sha256?: string;
};

const supportedMessageMediaTypes: SupportedMessageMediaType[] = ['image', 'video', 'audio', 'document', 'sticker'];

const isSupportedMessageMediaType = (value: any): value is SupportedMessageMediaType =>
  supportedMessageMediaTypes.includes(String(value || '').toLowerCase() as SupportedMessageMediaType);

const getMessageMediaLabel = (mediaType?: string | null, filename?: string | null) => {
  const normalizedType = String(mediaType || '').toLowerCase();
  const label = normalizedType === 'image'
    ? 'Image'
    : normalizedType === 'video'
      ? 'Video'
      : normalizedType === 'audio'
        ? 'Audio'
        : normalizedType === 'document'
          ? 'Document'
          : normalizedType === 'sticker'
            ? 'Sticker'
            : 'Media';
  return filename ? `${label}: ${filename}` : label;
};

const getMessageMediaSummaryText = (mediaInfo?: MessageMediaInfo | null) => {
  const caption = String(mediaInfo?.caption || '').trim();
  if (caption) {
    return caption;
  }

  return String(mediaInfo?.filename || '').trim();
};

const unsupportedMediaPreviewPattern = /^media\s*\/?\s*unsupported message$/i;

const getMessageMediaPreviewText = (mediaInfo?: MessageMediaInfo | null) => {
  const caption = String(mediaInfo?.caption || '').trim();
  if (caption) {
    return caption;
  }

  return getMessageMediaLabel(mediaInfo?.type);
};

const resolveConversationPreviewText = (raw: any, fallbackText?: string | null) => {
  const previewText = String(fallbackText ?? raw?.text ?? raw?.body ?? raw?.message ?? raw?.lastMessage ?? '').trim();
  const mediaInfo = extractMessageMediaInfo(raw);

  if (mediaInfo) {
    const compactLabel = getMessageMediaLabel(mediaInfo.type);
    const expandedLabel = getMessageMediaLabel(mediaInfo.type, mediaInfo.filename);
    const normalizedPreview = previewText.toLowerCase();

    if (
      previewText &&
      !unsupportedMediaPreviewPattern.test(previewText) &&
      normalizedPreview !== compactLabel.toLowerCase() &&
      normalizedPreview !== expandedLabel.toLowerCase()
    ) {
      return previewText;
    }

    return getMessageMediaPreviewText(mediaInfo);
  }

  if (unsupportedMediaPreviewPattern.test(previewText)) {
    return 'Image';
  }

  return previewText;
};

const normalizeMessageMediaBlob = (mediaInfo: MessageMediaInfo, mediaBlob: Blob) => {
  const blobType = String(mediaBlob.type || '').toLowerCase();
  const expectedMimeType = String(mediaInfo.mimeType || '').trim();

  if (expectedMimeType && (!blobType || blobType === 'application/octet-stream')) {
    return new Blob([mediaBlob], { type: expectedMimeType });
  }

  return mediaBlob;
};

const isMessageMediaBlobInvalid = (mediaInfo: MessageMediaInfo, mediaBlob: Blob) => {
  const blobType = String(mediaBlob.type || '').toLowerCase();
  if (!blobType) {
    return false;
  }

  if (blobType.includes('json') || blobType.startsWith('text/html')) {
    return true;
  }

  const expectedTypePrefix =
    mediaInfo.type === 'image' || mediaInfo.type === 'sticker'
      ? 'image/'
      : mediaInfo.type === 'video'
        ? 'video/'
        : mediaInfo.type === 'audio'
          ? 'audio/'
          : '';

  return Boolean(expectedTypePrefix && blobType !== 'application/octet-stream' && !blobType.startsWith(expectedTypePrefix));
};

const extractMessageMediaInfo = (raw: any): MessageMediaInfo | null => {
  const rawValue = raw?.rawPayload?.entry?.[0]?.changes?.[0]?.value || {};
  const rawMessage = raw?.rawMessage || rawValue?.messages?.[0] || {};
  const explicitType = String(raw?.mediaType || raw?.messageKind || raw?.type || rawMessage?.type || '').toLowerCase();
  const mediaType =
    supportedMessageMediaTypes.find((candidate) => Boolean(raw?.[candidate]) || Boolean(rawMessage?.[candidate])) ||
    (isSupportedMessageMediaType(explicitType) ? explicitType : '');

  if (!mediaType) {
    return null;
  }

  const mediaPayload = raw?.[mediaType] || raw?.media || rawMessage?.[mediaType] || {};
  return {
    type: mediaType,
    mediaId: String(raw?.mediaId || mediaPayload?.id || ''),
    mimeType: String(raw?.mimeType || mediaPayload?.mime_type || mediaPayload?.mimeType || ''),
    caption: String(raw?.caption || mediaPayload?.caption || rawMessage?.caption || ''),
    filename: String(raw?.filename || mediaPayload?.filename || ''),
    sha256: String(raw?.mediaSha256 || mediaPayload?.sha256 || '')
  };
};

const getMessageTimestamp = (value: any) => {
  const timestamp = value?.created || value?.createdOn || value?.timestamp || Date.now();
  if (typeof timestamp === 'string') {
    const parsed = Number(timestamp);
    if (!Number.isNaN(parsed)) {
      return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
    }
    const asDate = new Date(timestamp).getTime();
    return Number.isNaN(asDate) ? Date.now() : asDate;
  }
  if (typeof timestamp === 'number') {
    return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  }
  const asDate = new Date(timestamp).getTime();
  return Number.isNaN(asDate) ? Date.now() : asDate;
};

const normalizeMessageRecord = (raw: any, fallbackId?: string) => {
  const entryData = raw?.entry || raw?.payload?.entry;
  if (entryData?.[0]?.changes?.[0]?.value?.messages) {
    const value = entryData[0].changes[0].value;
    const msg = value.messages[0];
    const mediaInfo = extractMessageMediaInfo({ rawPayload: raw, rawMessage: msg });
    return {
      id: raw.id || fallbackId || msg.id,
      whatsappId: msg.id,
      from: msg.from,
      to: value.metadata?.display_phone_number || '',
      text: msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || mediaInfo?.caption || (mediaInfo ? getMessageMediaLabel(mediaInfo.type, mediaInfo.filename) : ''),
      timestamp: getMessageTimestamp(msg),
      direction: 'inbound',
      status: 'RECEIVED',
      rawPayload: raw,
      type: mediaInfo?.type || 'received',
      owner: false,
      ...(mediaInfo ? {
        messageKind: mediaInfo.type,
        mediaType: mediaInfo.type,
        mediaId: mediaInfo.mediaId,
        mimeType: mediaInfo.mimeType,
        caption: mediaInfo.caption,
        filename: mediaInfo.filename,
        mediaSha256: mediaInfo.sha256
      } : {})
    };
  }

  const mediaInfo = extractMessageMediaInfo(raw);
  const templatePreview = parseTemplatePreviewData(raw?.templatePreview ?? raw?.templatePreviewJson);
  const rawDirection = String(raw?.direction || '').toLowerCase();
  const explicitType = String(raw?.type || '').toLowerCase();
  const direction =
    rawDirection === 'outbound' || rawDirection === 'sent'
      ? 'outbound'
      : rawDirection === 'inbound' || rawDirection === 'received'
        ? 'inbound'
        : raw?.owner === true || explicitType === 'sent' || explicitType === 'outbound'
          ? 'outbound'
          : 'inbound';
  const normalizedType =
    explicitType === 'template' || Boolean(raw?.templateName) || Boolean(templatePreview)
      ? 'template'
      : explicitType === 'call'
        ? 'call'
        : mediaInfo?.type || (direction === 'outbound' ? 'sent' : 'received');

  return {
    ...raw,
    id: raw?.id || fallbackId || raw?.whatsappId || `${raw?.from || raw?.to || 'message'}-${getMessageTimestamp(raw)}`,
    timestamp: getMessageTimestamp(raw),
    direction,
    text: raw?.text || raw?.body || raw?.message || raw?.caption || mediaInfo?.caption || (mediaInfo ? getMessageMediaLabel(mediaInfo.type, mediaInfo.filename) : ''),
    type: normalizedType,
    owner: direction === 'outbound' || raw?.owner === true,
    ...(templatePreview ? { templatePreview } : {}),
    ...(mediaInfo ? {
      messageKind: mediaInfo.type,
      mediaType: mediaInfo.type,
      mediaId: mediaInfo.mediaId,
      mimeType: mediaInfo.mimeType,
      caption: mediaInfo.caption,
      filename: mediaInfo.filename,
      mediaSha256: mediaInfo.sha256
    } : {})
  };
};

const getMessageIdentity = (message: any) =>
  message.whatsappId ||
  message.id ||
  `${message.direction}-${message.from}-${message.to}-${message.timestamp}-${message.text}`;

const isGenericMessageType = (value: any) => {
  const normalizedValue = String(value || '').toLowerCase();
  return !normalizedValue || normalizedValue === 'sent' || normalizedValue === 'received';
};

const isMeaningfulMessageValue = (value: any) => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const mergeTemplatePreviewData = (existingPreview: any, incomingPreview: any) => {
  if (!isMeaningfulMessageValue(existingPreview)) {
    return incomingPreview;
  }
  if (!isMeaningfulMessageValue(incomingPreview)) {
    return existingPreview;
  }

  return {
    ...existingPreview,
    ...incomingPreview,
    buttons: Array.isArray(incomingPreview?.buttons) && incomingPreview.buttons.length > 0
      ? incomingPreview.buttons
      : existingPreview?.buttons
  };
};

const mergeMessageVariants = (existingMessage: any, incomingMessage: any) => {
  if (!existingMessage) {
    return incomingMessage;
  }

  const mergedMessage = {
    ...existingMessage,
    ...incomingMessage
  };

  if (!incomingMessage.whatsappId && existingMessage.whatsappId) {
    mergedMessage.whatsappId = existingMessage.whatsappId;
  }

  if (isGenericMessageType(incomingMessage.type) && !isGenericMessageType(existingMessage.type)) {
    mergedMessage.type = existingMessage.type;
  }

  if (!isMeaningfulMessageValue(incomingMessage.templateName) && isMeaningfulMessageValue(existingMessage.templateName)) {
    mergedMessage.templateName = existingMessage.templateName;
  }

  if (!isMeaningfulMessageValue(incomingMessage.campaignName) && isMeaningfulMessageValue(existingMessage.campaignName)) {
    mergedMessage.campaignName = existingMessage.campaignName;
  }

  mergedMessage.templatePreview = mergeTemplatePreviewData(existingMessage.templatePreview, incomingMessage.templatePreview);

  const carryForwardFields = [
    'messageKind',
    'mediaType',
    'mediaId',
    'mimeType',
    'caption',
    'filename',
    'mediaSha256',
    'failedReason',
    'broadcastId',
    'rawPayload',
    'rawMessage'
  ];

  carryForwardFields.forEach((fieldName) => {
    if (!isMeaningfulMessageValue(incomingMessage[fieldName]) && isMeaningfulMessageValue(existingMessage[fieldName])) {
      mergedMessage[fieldName] = existingMessage[fieldName];
    }
  });

  if (!isMeaningfulMessageValue(incomingMessage.text) && isMeaningfulMessageValue(existingMessage.text)) {
    mergedMessage.text = existingMessage.text;
  }

  if (incomingMessage.owner == null && existingMessage.owner != null) {
    mergedMessage.owner = existingMessage.owner;
  }

  return normalizeMessageRecord(mergedMessage);
};

const mergeMessages = (existing: any[], incoming: any[]) => {
  const merged = new Map<string, any>();
  [...existing, ...incoming].forEach((message) => {
    const normalized = normalizeMessageRecord(message);
    const messageIdentity = getMessageIdentity(normalized);
    const existingMessage = merged.get(messageIdentity);
    merged.set(messageIdentity, mergeMessageVariants(existingMessage, normalized));
  });

  return Array.from(merged.values()).sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));
};

const syncMessagesWithSnapshot = (existingMessages: any[], snapshotMessages: any[]) => {
  const snapshotMessageIds = new Set(snapshotMessages.map((message) => getMessageIdentity(normalizeMessageRecord(message))));
  const preservedMessages = existingMessages.filter((message) => {
    const messageIdentity = getMessageIdentity(normalizeMessageRecord(message));
    return snapshotMessageIds.has(messageIdentity) || String(messageIdentity).startsWith('optimistic-');
  });

  return mergeMessages(preservedMessages, snapshotMessages);
};

const getContactKey = (contact: any) => contact?.id || contact?.whatsappNumber || contact?.phone;

const getContactPhone = (contact: any) => contact?.whatsappNumber || contact?.phone || '';
const getContactAvatarUrl = (contact: any) => contact?.avatarUrl || contact?.photo || contact?.profilePicture || '';
const getConversationAvatarUrl = (contact: any) => getContactAvatarUrl(contact) || defaultConversationProfile;
const normalizePhoneDigits = (value: string) => value.replace(/\D/g, '');
const createCrmLeadId = () => `crm-inbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const MAX_CONTACT_AVATAR_BYTES = 5 * 1024 * 1024;
const CONTACT_AVATAR_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const getCallLabel = (direction: CallDirection, status: CallStatus) => {
  if (status === 'missed') return direction === 'incoming' ? 'Missed voice call' : 'Missed outgoing call';
  if (status === 'ringing') return direction === 'incoming' ? 'Incoming voice call' : 'Outgoing voice call';
  if (status === 'failed') return direction === 'incoming' ? 'Incoming call failed' : 'Outgoing call failed';
  if (status === 'ended') return direction === 'incoming' ? 'Completed incoming call' : 'Completed outgoing call';
  return direction === 'incoming' ? 'Incoming voice call' : 'Outgoing voice call';
};

const getCallActionLabel = (direction: CallDirection) => direction === 'incoming' ? 'Call Back' : 'Call Again';

const phonesMatch = (left: string, right: string) => {
  const normalizedLeft = normalizePhoneDigits(left || '');
  const normalizedRight = normalizePhoneDigits(right || '');
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft === normalizedRight || normalizedLeft.endsWith(normalizedRight) || normalizedRight.endsWith(normalizedLeft);
};

const normalizeCallEventToken = (value: any) => String(value || '').toLowerCase().replace(/[\s-]+/g, '_');

const isPositiveCallPermissionStatus = (status?: string | null) =>
  /ready|granted|allowed|connected|permanent|temporary/i.test(String(status || '').trim());

const normalizeCallSession = (raw: any): WhatsAppCallSessionDescription | null => {
  const sdp =
    raw?.sdp ||
    raw?.session?.sdp ||
    raw?.session_description?.sdp ||
    raw?.sessionDescription?.sdp;
  const rawType =
    raw?.sdpType ||
    raw?.sdp_type ||
    raw?.type ||
    raw?.session?.sdpType ||
    raw?.session?.sdp_type ||
    raw?.session?.type ||
    raw?.session_description?.sdp_type ||
    raw?.session_description?.type ||
    raw?.sessionDescription?.sdpType ||
    raw?.sessionDescription?.type;
  const normalizedType = String(rawType || '').toLowerCase();

  if (!sdp || !normalizedType) return null;
  if (normalizedType !== 'offer' && normalizedType !== 'answer' && normalizedType !== 'pranswer') return null;

  return {
    sdpType: normalizedType as WhatsAppCallSessionDescription['sdpType'],
    sdp
  };
};

const getCallPermissionMessage = (probe: WhatsAppCallingProbe | null) => {
  if (!probe) return 'Run a permission check to see whether this user can currently receive a WhatsApp call.';
  if (probe.message) return probe.message;
  if (probe.canStartCall) return 'Call permission is active for this user.';
  if (isPositiveCallPermissionStatus(probe.permissionStatus)) return `Call permission is active with ${probe.permissionStatus} access.`;
  if (probe.canRequestPermission) return 'This user has not granted calling permission yet, but a permission request is currently allowed.';
  if (probe.permissionStatus) return `Current permission status: ${probe.permissionStatus}.`;
  return 'Call permission is not available right now.';
};

const formatCallDuration = (durationSeconds?: number) => {
  const safeDuration = Math.max(0, Math.floor(durationSeconds || 0));
  const minutes = Math.floor(safeDuration / 60);
  const seconds = safeDuration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const sortCallLogs = (logs: CallLogRecord[]) => [...logs].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

const getCallUpdateKey = (record: Pick<CallLogRecord, 'id' | 'callId' | 'status' | 'direction' | 'startedAt' | 'endedAt' | 'session'>) => {
  const session = record.session;
  return [
    record.callId || record.id,
    record.status,
    record.direction,
    record.startedAt || 0,
    record.endedAt || 0,
    session?.sdpType || '',
    session?.sdp?.length || 0
  ].join(':');
};

const inferCallInfo = (raw: any): CallMessageInfo | null => {
  if (raw?.callInfo?.direction && raw?.callInfo?.status) {
    return {
      direction: raw.callInfo.direction,
      status: raw.callInfo.status,
      label: raw.callInfo.label || getCallLabel(raw.callInfo.direction, raw.callInfo.status),
      mode: 'voice'
    };
  }

  const rawValue = raw?.rawPayload?.entry?.[0]?.changes?.[0]?.value || {};
  const rawMessage = rawValue?.messages?.[0] || {};
  const rawWebhookCall = rawValue?.calls?.[0] || null;
  const rawCallPayload = raw?.callPayload || raw?.rawCallPayload || raw?.call || rawMessage?.call || rawWebhookCall || null;
  const resolvedMessageType = String(raw?.messageKind || raw?.type || rawMessage?.type || rawWebhookCall?.type || '').toLowerCase();
  const lowerText = [raw?.text, raw?.body, raw?.message].filter(Boolean).join(' ').toLowerCase();
  const structuredMeta = JSON.stringify({
    type: resolvedMessageType,
    call: rawCallPayload,
    errors: raw?.errors || rawMessage?.errors,
    unsupported: raw?.unsupported || rawMessage?.unsupported,
    system: raw?.system || rawMessage?.system,
    event: rawCallPayload?.event || rawWebhookCall?.event || rawMessage?.event || raw?.event
  }).toLowerCase();

  const explicitCall =
    resolvedMessageType === 'call' ||
    Boolean(raw?.callInfo || raw?.callPayload || raw?.rawCallPayload || raw?.call || rawMessage?.call || rawWebhookCall);
  const keywordCall = /(missed voice call|incoming voice call|outgoing voice call|voice call|video call|missed call|incoming call|outgoing call)/.test(lowerText);
  const unsupportedCall = resolvedMessageType === 'unsupported' && /call/.test(structuredMeta);

  if (!(explicitCall || keywordCall || unsupportedCall)) {
    return null;
  }

  const directionHints = `${rawCallPayload?.direction || raw?.call?.direction || ''} ${raw?.direction || ''} ${raw?.type || ''}`.toLowerCase();
  const directionToken = normalizeCallEventToken(rawCallPayload?.direction || raw?.call?.direction || raw?.direction);
  const direction: CallDirection =
    raw?.callInfo?.direction ||
    (directionToken === 'business_initiated'
      ? 'outgoing'
      : directionToken === 'user_initiated'
        ? 'incoming'
        : raw?.owner === true || raw?.direction === 'outbound' || raw?.type === 'sent'
      ? 'outgoing'
      : raw?.direction === 'inbound' || raw?.type === 'received'
        ? 'incoming'
        : phonesMatch(rawCallPayload?.to || '', raw?.to || '')
          ? 'outgoing'
          : phonesMatch(rawCallPayload?.from || '', raw?.from || '')
            ? 'incoming'
            : /outgoing|dialed|agent/.test(directionHints)
              ? 'outgoing'
              : 'incoming');
  const eventToken = normalizeCallEventToken(rawCallPayload?.event || rawWebhookCall?.event || rawMessage?.event || raw?.event);
  const statusText = `${lowerText} ${structuredMeta} ${rawCallPayload?.status || ''} ${rawCallPayload?.direction || ''} ${eventToken}`.toLowerCase();
  const status: CallStatus =
    ['timeout', 'missed', 'no_answer', 'not_answered', 'unanswered'].includes(eventToken) || /missed|unanswered|not answered|no answer|timeout/.test(statusText)
      ? 'missed'
      : ['connect', 'pre_accept', 'offer', 'ringing', 'invite', 'alerting', 'user_initiated'].includes(eventToken) || /ringing|offer|incoming|user initiated/.test(statusText)
        ? 'ringing'
        : ['accept', 'accepted', 'answer', 'answered', 'ongoing', 'connected'].includes(eventToken) || /accepted|answered|ongoing|in progress/.test(statusText)
          ? 'ongoing'
          : ['reject', 'rejected', 'decline', 'declined', 'busy', 'unavailable', 'failed', 'fail'].includes(eventToken) || /failed|declined|rejected|busy|unavailable/.test(statusText)
            ? direction === 'incoming'
              ? 'missed'
              : 'failed'
            : ['terminate', 'terminated', 'hangup', 'hang_up', 'end', 'ended', 'disconnect', 'disconnected', 'complete', 'completed', 'finish', 'finished'].includes(eventToken) || /ended|completed|finished|disconnect|hangup|terminated/.test(statusText)
              ? 'ended'
              : 'ringing';

  return {
    direction,
    status,
    label: getCallLabel(direction, status),
    mode: 'voice'
  };
};

const buildTemplatePreview = (template: any): TemplatePreviewData => {
  const header = template?.components?.find((component: any) => component.type === 'HEADER');
  const body = template?.components?.find((component: any) => component.type === 'BODY');
  const footer = template?.components?.find((component: any) => component.type === 'FOOTER');
  const buttons = template?.components?.find((component: any) => component.type === 'BUTTONS')?.buttons || [];

  return {
    headerType: header?.format || header?.type || '',
    headerText: header?.text || '',
    body: body?.text || '',
    footer: footer?.text || '',
    buttons: buttons.map((button: any) => ({
      text: button?.text || button?.type || 'Action',
      type: button?.type || 'BUTTON'
    }))
  };
};

const getTemplatePreviewSummary = (templateName: string, templatePreview?: { body?: string }) =>
  templatePreview?.body?.trim() || `Template: ${templateName}`;

const clampString = (value: any, maxLength: number, fallback = '') => {
  const normalized = String(value ?? fallback);
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
};

const buildFirestoreTemplatePreview = (templatePreview: any) => ({
  ...normalizeTemplatePreviewData(templatePreview)
});

const buildMessageWritePayload = (message: any, options?: { includeTemplateDetails?: boolean }) => {
  const includeTemplateDetails = options?.includeTemplateDetails !== false;
  const payload: Record<string, any> = {
    from: clampString(message?.from, 50),
    to: clampString(message?.to, 50),
    text: clampString(message?.text, 5000),
    timestamp: typeof message?.timestamp === 'number' ? message.timestamp : Date.now(),
    direction: message?.direction === 'inbound' ? 'inbound' : 'outbound'
  };

  if (message?.status) {
    payload.status = clampString(message.status, 50);
  }

  if (message?.whatsappId) {
    payload.whatsappId = clampString(message.whatsappId, 100);
  }
  if (message?.type) {
    payload.type = clampString(message.type, 50);
  }
  if (message?.templateName) {
    payload.templateName = clampString(message.templateName, 200);
  }
  if (message?.templatePreview) {
    payload.templatePreviewJson = clampString(
      JSON.stringify(normalizeTemplatePreviewData(message.templatePreview)),
      5000
    );
  }
  if (message?.failedReason) {
    payload.failedReason = clampString(message.failedReason, 1000);
  }

  if (!includeTemplateDetails) {
    return payload;
  }

  if (message?.templatePreview) {
    payload.templatePreview = buildFirestoreTemplatePreview(message.templatePreview);
  }

  return payload;
};

const saveMessageRecord = async (userId: string, message: any) => {
  const fullPayload = buildMessageWritePayload(message, { includeTemplateDetails: true });
  const normalizedDocId = clampString(message?.whatsappId || message?.id, 100).trim();
  const messageCollection = collection(db, 'users', userId, 'messages');
  const messageDocRef = normalizedDocId
    ? doc(db, 'users', userId, 'messages', normalizedDocId)
    : doc(messageCollection);

  try {
    await setDoc(messageDocRef, fullPayload, { merge: true });
    return {
      payload: fullPayload,
      docId: messageDocRef.id,
      usedFallback: false
    };
  } catch (error) {
    const fallbackPayload = buildMessageWritePayload(message, { includeTemplateDetails: false });

    if (JSON.stringify(fullPayload) === JSON.stringify(fallbackPayload)) {
      throw error;
    }

    await setDoc(messageDocRef, fallbackPayload, { merge: true });
    console.warn('Saved message with fallback Firestore payload after the rich payload was rejected.', error);
    return {
      payload: fallbackPayload,
      docId: messageDocRef.id,
      usedFallback: true
    };
  }
};

const upsertLiveContact = (contacts: any[], activity: {
  phone: string;
  name?: string;
  text?: string;
  body?: string;
  message?: string;
  lastMessage?: string;
  timestamp?: number;
  outbound?: boolean;
  type?: string;
  messageKind?: string;
  mediaType?: string;
  mediaId?: string;
  mimeType?: string;
  caption?: string;
  filename?: string;
  mediaSha256?: string;
  rawPayload?: any;
  rawMessage?: any;
}) => {
  if (!activity.phone) return contacts;

  const timestampIso = new Date(activity.timestamp || Date.now()).toISOString();
  const previewText = resolveConversationPreviewText(activity, activity.text);
  let found = false;

  const nextContacts = contacts.map((contact) => {
    if (getContactPhone(contact) !== activity.phone) return contact;
    found = true;
    return {
      ...contact,
      fullName: contact.fullName || activity.name || activity.phone,
      phone: contact.phone || activity.phone,
      whatsappNumber: contact.whatsappNumber || activity.phone,
      lastMessage: previewText || contact.lastMessage || '',
      lastMessageTime: timestampIso,
      updatedAt: timestampIso,
      unreadCount: activity.outbound ? 0 : (contact.unreadCount || 0) + 1
    };
  });

  if (!found) {
    nextContacts.push({
      id: `live_${activity.phone}`,
      fullName: activity.name || activity.phone,
      phone: activity.phone,
      whatsappNumber: activity.phone,
      lastMessage: previewText || '',
      lastMessageTime: timestampIso,
      unreadCount: activity.outbound ? 0 : 1,
      status: 'Active',
      tags: activity.outbound ? [] : ['Webhook'],
      notes: ''
    });
  }

  return nextContacts.sort((a, b) => getMessageTimestamp(b.lastMessageTime) - getMessageTimestamp(a.lastMessageTime));
};

const mergeContactsWithMessages = (storedContacts: any[], storedMessages: any[]) => {
  return storedMessages.reduce((acc, message) => {
    const phone = message.direction === 'outbound' ? message.to : message.from;
    return upsertLiveContact(acc, {
      phone,
      text: message.text,
      body: message.body,
      message: message.message,
      type: message.type,
      messageKind: message.messageKind,
      mediaType: message.mediaType,
      mediaId: message.mediaId,
      mimeType: message.mimeType,
      caption: message.caption,
      filename: message.filename,
      mediaSha256: message.mediaSha256,
      rawPayload: message.rawPayload,
      rawMessage: message.rawMessage,
      timestamp: getMessageTimestamp(message),
      outbound: message.direction === 'outbound'
    });
  }, [...storedContacts]);
};

export default function ConnectDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const targetInboxPhone = useMemo(() => new URLSearchParams(location.search).get('target_phone') || '', [location.search]);
  const currentUserId = auth.currentUser?.uid;
  const isDark = false;
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastSession[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageMediaUrls, setMessageMediaUrls] = useState<Record<string, string>>({});
  const [callLogs, setCallLogs] = useState<CallLogRecord[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<WhatsAppPhoneNumber[]>([]);
  const [businessAccounts, setBusinessAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<WhatsAppAccountOverview | null>(null);
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [messageToasts, setMessageToasts] = useState<MessageToast[]>([]);
  const [activeCallSession, setActiveCallSession] = useState<ActiveCallSession | null>(null);
  const [showAddPeopleMenu, setShowAddPeopleMenu] = useState(false);
  const [callTicker, setCallTicker] = useState(Date.now());
  const [callSocketState, setCallSocketState] = useState<SocketConnectionState>('connecting');
  const [callDiagnosticEvents, setCallDiagnosticEvents] = useState<CallDiagnosticEvent[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const shouldReconnectRef = useRef(true);
  const suppressSocketErrorRef = useRef(false);
  const hasLoggedSocketFailureRef = useRef(false);
  const syncingContactPhonesRef = useRef<Set<string>>(new Set());
  const syncingCrmLeadPhonesRef = useRef<Set<string>>(new Set());
  const toastTimeoutsRef = useRef<Map<string, number>>(new Map());
  const seenInboundMessageIdsRef = useRef<Set<string>>(new Set());
  const hasHydratedMessagesRef = useRef(false);
  const lastNotifiedInboundTimestampRef = useRef(0);
  const ringtoneIntervalRef = useRef<number | null>(null);
  const incomingCallTimeoutRef = useRef<number | null>(null);
  const callHistoryPermissionDeniedRef = useRef(false);
  const callMessagePermissionDeniedRef = useRef(false);
  const callPeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localCallStreamRef = useRef<MediaStream | null>(null);
  const remoteCallStreamRef = useRef<MediaStream | null>(null);
  const remoteCallAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeCallSessionRef = useRef<ActiveCallSession | null>(null);
  const callLogsHydratedRef = useRef(false);
  const seenLiveCallUpdateKeysRef = useRef<Set<string>>(new Set());
  const messageMediaUrlsRef = useRef<Record<string, string>>({});
  const pendingMessageMediaIdsRef = useRef<Set<string>>(new Set());
  const failedMessageMediaIdsRef = useRef<Set<string>>(new Set());
  const handleIncomingMessageRef = useRef<(payload: any) => Promise<void> | void>(() => undefined);
  const syncLiveCallRecordRef = useRef<(record: CallLogRecord) => Promise<void> | void>(() => undefined);

  const pushCallDiagnostic = (event: Omit<CallDiagnosticEvent, 'timestamp'> & { timestamp?: number }) => {
    const nextEvent: CallDiagnosticEvent = {
      timestamp: typeof event.timestamp === 'number' ? event.timestamp : Date.now(),
      ...event
    };
    setCallDiagnosticEvents((prev) => [nextEvent, ...prev].slice(0, 8));
  };

  const registerSocketSession = () => {
    const connectedPhoneId = whatsappService.getCredentials().PHONE_NUMBER_ID || phoneNumbers[0]?.phoneId || '';
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !connectedPhoneId) {
      return;
    }

    socketRef.current.send(JSON.stringify({
      type: 'register_dashboard',
      userId: currentUserId || null,
      phoneNumberId: connectedPhoneId
    }));
  };

  const ensureMessageMediaLoaded = async (mediaInfo?: MessageMediaInfo | null) => {
    if (!mediaInfo?.mediaId) return;
    if (messageMediaUrlsRef.current[mediaInfo.mediaId]) return;
    if (pendingMessageMediaIdsRef.current.has(mediaInfo.mediaId)) return;
    if (failedMessageMediaIdsRef.current.has(mediaInfo.mediaId)) return;

    pendingMessageMediaIdsRef.current.add(mediaInfo.mediaId);
    try {
      const mediaBlob = await whatsappService.downloadMediaBlob(mediaInfo.mediaId);
      if (!mediaBlob) {
        failedMessageMediaIdsRef.current.add(mediaInfo.mediaId);
        return;
      }

      const normalizedBlob = normalizeMessageMediaBlob(mediaInfo, mediaBlob);
      if (isMessageMediaBlobInvalid(mediaInfo, normalizedBlob)) {
        console.error('Unsupported WhatsApp media blob received for preview:', normalizedBlob.type || '(empty)');
        failedMessageMediaIdsRef.current.add(mediaInfo.mediaId);
        return;
      }

      const objectUrl = URL.createObjectURL(normalizedBlob);
      if (messageMediaUrlsRef.current[mediaInfo.mediaId]) {
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setMessageMediaUrls((prev) => ({ ...prev, [mediaInfo.mediaId]: objectUrl }));
    } catch (error) {
      console.error('Failed to resolve WhatsApp media preview:', error);
      failedMessageMediaIdsRef.current.add(mediaInfo.mediaId);
    } finally {
      pendingMessageMediaIdsRef.current.delete(mediaInfo.mediaId);
    }
  };

  useEffect(() => {
    let reconnectTimeout: number | null = null;
    let initialConnectTimeout: number | null = null;
    setCallSocketState('connecting');

    const connect = () => {
      setCallSocketState((prev) => prev === 'connected' ? prev : 'connecting');
      const wsUrl = buildBackendWsUrl('/ws');
      const newSocket = new WebSocket(wsUrl);
      socketRef.current = newSocket;
      suppressSocketErrorRef.current = false;

      newSocket.onopen = () => {
        hasLoggedSocketFailureRef.current = false;
        setCallSocketState('connected');
        pushCallDiagnostic({
          kind: 'socket_status',
          socketState: 'connected',
          note: `WebSocket connected to ${wsUrl}.`
        });
        console.log('Connected to WebSocket server');
        registerSocketSession();
      };

      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const connectedPhoneId = whatsappService.getCredentials().PHONE_NUMBER_ID || phoneNumbers[0]?.phoneId || '';
          if (data.type === 'call_diagnostics' && data.payload) {
            pushCallDiagnostic(data.payload);
            return;
          }
          const matchesCurrentSession =
            data.targetUserId === auth.currentUser?.uid ||
            (!data.targetUserId && connectedPhoneId && data?.payload?.phoneNumberId === connectedPhoneId);
          // Only process if the message is for the current logged-in user
          if (data.type === 'whatsapp_message' && matchesCurrentSession) {
            void handleIncomingMessageRef.current(data.payload);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      newSocket.onclose = () => {
        if (!shouldReconnectRef.current) {
          setCallSocketState('disconnected');
          return;
        }
        setCallSocketState('reconnecting');
        pushCallDiagnostic({
          kind: 'socket_status',
          socketState: 'reconnecting',
          note: 'WebSocket disconnected. Retrying in 5 seconds.'
        });
        console.info('WebSocket disconnected. Reconnecting in 5 seconds...');
        reconnectTimeout = window.setTimeout(connect, 5000);
      };

      newSocket.onerror = () => {
        // Browsers often emit a generic error event during expected reconnects/HMR.
        setCallSocketState('error');
        pushCallDiagnostic({
          kind: 'socket_status',
          socketState: 'error',
          note: 'WebSocket reported a connection issue.'
        });
        if (!suppressSocketErrorRef.current && !hasLoggedSocketFailureRef.current) {
          hasLoggedSocketFailureRef.current = true;
          console.warn('WebSocket connection issue detected. The app will retry automatically.');
        }
        newSocket.close();
      };

    };

    shouldReconnectRef.current = true;
    initialConnectTimeout = window.setTimeout(connect, 0);

    return () => {
      shouldReconnectRef.current = false;
      suppressSocketErrorRef.current = true;
      if (initialConnectTimeout !== null) {
        window.clearTimeout(initialConnectTimeout);
      }
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setCallSocketState('disconnected');
    };
  }, []);

  useEffect(() => {
    activeCallSessionRef.current = activeCallSession;
  }, [activeCallSession]);

  useEffect(() => {
    registerSocketSession();
  }, [currentUserId, phoneNumbers, currentUserProfile?.whatsappCredentials?.phoneNumberId]);

  const syncLiveCallRecord = async (callRecord: CallLogRecord) => {
    const currentActiveCallSession = activeCallSessionRef.current;
    const matchesActiveSession = Boolean(
      currentActiveCallSession &&
      (
        (callRecord.callId && currentActiveCallSession.callId && callRecord.callId === currentActiveCallSession.callId) ||
        (
          normalizePhoneDigits(currentActiveCallSession.contactPhone) &&
          normalizePhoneDigits(currentActiveCallSession.contactPhone) === normalizePhoneDigits(callRecord.contactPhone || '')
        )
      )
    );

    if (matchesActiveSession) {
      if (callRecord.session && (callRecord.direction === 'outgoing' || callRecord.status === 'ongoing')) {
        try {
          await applyRemoteCallSession(callRecord.session);
        } catch (error) {
          console.warn('Could not apply remote call SDP from webhook payload.', error);
        }
      }

      if (callRecord.status === 'ended' || callRecord.status === 'missed' || callRecord.status === 'failed') {
        stopCallRingtone();
        cleanupCallMedia();
        setActiveCallSession(null);
      } else {
        setActiveCallSession((prev) => prev ? {
          ...prev,
          ...callRecord,
          id: prev.id,
          callId: callRecord.callId || prev.callId,
          participants: Array.from(new Set([...(prev.participants || []), ...(callRecord.participants || [])])),
          session: callRecord.session || prev.session
        } : prev);
      }
    }

    if (
      callRecord.status === 'ringing' &&
      callRecord.direction === 'incoming' &&
      (!currentActiveCallSession || (callRecord.callId && currentActiveCallSession.callId !== callRecord.callId))
    ) {
      beginCallSession(callRecord, 'ringing');
      showNotification(`Incoming call from ${callRecord.contactName}`, callRecord.contactPhone);
    }
  };

  const handleIncomingMessage = async (payload: any) => {
    const { from, text, timestamp, name, callInfo, mediaInfo } = payload;
    const incomingCallSession = normalizeCallSession(payload.callPayload || payload.session || payload.rawCallPayload);
    const messageDate = typeof timestamp === 'number'
      ? new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp)
      : new Date();
    const mediaLabel = mediaInfo ? getMessageMediaLabel(mediaInfo.type, mediaInfo.filename) : '';
    const normalizedMessage = normalizeMessageRecord({
      id: payload.id,
      whatsappId: payload.id,
      from,
      text: callInfo?.label || text || mediaInfo?.caption || mediaLabel,
      timestamp: messageDate.getTime(),
      direction: 'inbound',
      status: 'RECEIVED',
      type: mediaInfo?.type || 'received',
      messageKind: callInfo ? 'call' : mediaInfo?.type,
      mediaType: mediaInfo?.type,
      mediaId: mediaInfo?.id,
      mimeType: mediaInfo?.mimeType,
      caption: mediaInfo?.caption,
      filename: mediaInfo?.filename,
      mediaSha256: mediaInfo?.sha256,
      media: mediaInfo || undefined,
      callInfo,
      callId: payload.callId,
      session: incomingCallSession,
      rawCallPayload: payload.callPayload
    });
    
    setMessages(prev => mergeMessages(prev, [normalizedMessage]));
    const contactPreviewText = resolveConversationPreviewText({
      text: callInfo?.label || text || mediaInfo?.caption || mediaLabel,
      type: mediaInfo?.type || 'received',
      messageKind: callInfo ? 'call' : mediaInfo?.type,
      mediaType: mediaInfo?.type,
      mediaId: mediaInfo?.id,
      mimeType: mediaInfo?.mimeType,
      caption: mediaInfo?.caption,
      filename: mediaInfo?.filename,
      mediaSha256: mediaInfo?.sha256
    });

    setContacts(prev => upsertLiveContact(prev, {
      phone: from,
      name,
      text: contactPreviewText,
      type: mediaInfo?.type || 'received',
      messageKind: callInfo ? 'call' : mediaInfo?.type,
      mediaType: mediaInfo?.type,
      mediaId: mediaInfo?.id,
      mimeType: mediaInfo?.mimeType,
      caption: mediaInfo?.caption,
      filename: mediaInfo?.filename,
      mediaSha256: mediaInfo?.sha256,
      timestamp: messageDate.getTime(),
      outbound: false
    }));

    if (callInfo) {
      const callRecord: CallLogRecord = {
        id: payload.callId || `call-${payload.id || messageDate.getTime()}`,
        callId: payload.callId || payload.id,
        contactName: name || from,
        contactPhone: from,
        direction: callInfo.direction || 'incoming',
        status: callInfo.status || 'ringing',
        label: callInfo.label || getCallLabel(callInfo.direction || 'incoming', callInfo.status || 'ringing'),
        startedAt: messageDate.getTime(),
        phoneNumberId: payload.phoneNumberId || whatsappService.getCredentials().PHONE_NUMBER_ID,
        businessPhoneNumber: payload.businessNumber || accountInfo?.displayPhoneNumber || '',
        permissionStatus: payload.permissionStatus,
        source: 'webhook',
        participants: [name || from],
        session: incomingCallSession,
        rawCallPayload: payload.callPayload
      };

      upsertCallLogLocal(callRecord);
      await syncLiveCallRecord(callRecord);
    }

    // Update/Create contact in Firestore
    if (auth.currentUser) {
      try {
        const contactSnap = await getDocs(query(collection(db, 'users', auth.currentUser.uid, 'contacts'), where('whatsappNumber', '==', from), limit(1)));
        
        const contactData = {
          whatsappNumber: from,
          fullName: name || from,
          lastMessage: contactPreviewText,
          lastMessageTime: messageDate.toISOString(),
          unreadCount: 1, // This is a simplification, ideally we increment
          updatedAt: new Date().toISOString()
        };

        if (contactSnap.empty) {
          await addDoc(collection(db, 'users', auth.currentUser.uid, 'contacts'), {
            ...contactData,
            createdAt: new Date().toISOString(),
            tags: [],
            notes: ''
          });
        } else {
          const existingDoc = contactSnap.docs[0];
          await updateDoc(doc(db, 'users', auth.currentUser.uid, 'contacts', existingDoc.id), {
            lastMessage: contactPreviewText,
            lastMessageTime: messageDate.toISOString(),
            unreadCount: (existingDoc.data().unreadCount || 0) + 1,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}/contacts`);
      }
    }
  };

  useEffect(() => {
    handleIncomingMessageRef.current = handleIncomingMessage;
  });

  useEffect(() => {
    syncLiveCallRecordRef.current = syncLiveCallRecord;
  });

  useEffect(() => {
    if (!currentUserId) return;

    callHistoryPermissionDeniedRef.current = false;
    callMessagePermissionDeniedRef.current = false;

    let storedContacts: any[] = [];
    let storedMessages: any[] = [];

    const syncConversationState = () => {
      setMessages((prev) => syncMessagesWithSnapshot(prev, storedMessages));
      setContacts(mergeContactsWithMessages(storedContacts, storedMessages));
    };

    const handleSnapshotError = (error: any) => {
      const permissionDenied = typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'permission-denied';
      if (permissionDenied) {
        handleFirestoreError(error, OperationType.LIST, `users/${currentUserId}/contacts_or_messages`);
        setMessages([]);
        setContacts([]);
        return;
      }
      handleFirestoreError(error, OperationType.LIST, `users/${currentUserId}/contacts_or_messages`);
    };

    const contactsQuery = query(
      collection(db, 'users', currentUserId, 'contacts'),
      orderBy('fullName', 'asc')
    );
    const messagesQuery = query(
      collection(db, 'users', currentUserId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
      storedContacts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      syncConversationState();
    }, handleSnapshotError);

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      storedMessages = snapshot.docs.map((doc) => normalizeMessageRecord(doc.data(), doc.id)).reverse();
      syncConversationState();
    }, handleSnapshotError);

    return () => {
      unsubscribeContacts();
      unsubscribeMessages();
    };
  }, [currentUserId]);

  useEffect(() => {
    messageMediaUrlsRef.current = messageMediaUrls;
  }, [messageMediaUrls]);

  useEffect(() => {
    return () => {
      Object.values(messageMediaUrlsRef.current).forEach((objectUrl) => {
        URL.revokeObjectURL(objectUrl);
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRenderableMedia = async () => {
      for (const message of messages) {
        const mediaInfo = extractMessageMediaInfo(message);
        if (!mediaInfo?.mediaId) continue;
        if (!['image', 'video', 'sticker'].includes(mediaInfo.type)) continue;
        if (cancelled) break;
        await ensureMessageMediaLoaded(mediaInfo);
        if (cancelled) {
          break;
        }
      }
    };

    void loadRenderableMedia();

    return () => {
      cancelled = true;
    };
  }, [messages]);

  useEffect(() => {
    callLogsHydratedRef.current = false;
    seenLiveCallUpdateKeysRef.current.clear();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    const callLogsQuery = query(
      collection(db, 'users', currentUserId, 'callLogs'),
      orderBy('startedAt', 'desc'),
      limit(200)
    );

    const unsubscribeCallLogs = onSnapshot(callLogsQuery, (snapshot) => {
      callHistoryPermissionDeniedRef.current = false;
      const nextCallLogs = sortCallLogs(snapshot.docs.map((callDoc) => ({
        id: callDoc.id,
        ...(callDoc.data() as CallLogRecord)
      })));
      setCallLogs(nextCallLogs);

      const webhookUpdates = nextCallLogs.filter((callRecord) => callRecord.source === 'webhook');
      if (!callLogsHydratedRef.current) {
        webhookUpdates.forEach((callRecord) => {
          seenLiveCallUpdateKeysRef.current.add(getCallUpdateKey(callRecord));
        });
        callLogsHydratedRef.current = true;
        return;
      }

      webhookUpdates.forEach((callRecord) => {
        const updateKey = getCallUpdateKey(callRecord);
        if (seenLiveCallUpdateKeysRef.current.has(updateKey)) {
          return;
        }

        seenLiveCallUpdateKeysRef.current.add(updateKey);
        void syncLiveCallRecordRef.current(callRecord);
      });
    }, (error) => {
      const permissionDenied = typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'permission-denied';
      if (permissionDenied) {
        if (!callHistoryPermissionDeniedRef.current) {
          callHistoryPermissionDeniedRef.current = true;
          handleFirestoreError(error, OperationType.LIST, `users/${currentUserId}/callLogs`);
        }
        return;
      }
      handleFirestoreError(error, OperationType.LIST, `users/${currentUserId}/callLogs`);
    });

    return () => unsubscribeCallLogs();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !contacts.length) return;

    const unsyncedContacts = contacts.filter((contact) => {
      const phone = (contact.whatsappNumber || contact.phone || '').replace(/\D/g, '');
      return phone && String(contact.id || '').startsWith('live_') && !syncingContactPhonesRef.current.has(phone);
    });

    if (!unsyncedContacts.length) return;

    unsyncedContacts.forEach((contact) => {
      const phone = (contact.whatsappNumber || contact.phone || '').replace(/\D/g, '');
      if (!phone) return;

      syncingContactPhonesRef.current.add(phone);

      addDoc(collection(db, 'users', currentUserId, 'contacts'), {
        fullName: contact.fullName || contact.name || phone,
        whatsappNumber: phone,
        phone,
        lastMessage: contact.lastMessage || '',
        lastMessageTime: contact.lastMessageTime || new Date().toISOString(),
        unreadCount: contact.unreadCount || 0,
        tags: contact.tags || [],
        notes: contact.notes || '',
        customParams: contact.customParams || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).catch((error) => {
        handleFirestoreError(error, OperationType.CREATE, `users/${currentUserId}/contacts`);
      }).finally(() => {
        syncingContactPhonesRef.current.delete(phone);
      });
    });
  }, [contacts, currentUserId]);

  useEffect(() => {
    if (!currentUserId || !contacts.length || !currentUserProfile?.crmSetup) return;

    const existingLeads = Array.isArray(currentUserProfile.crmSetup.leads) ? currentUserProfile.crmSetup.leads : [];
    const existingLeadPhones = new Set(existingLeads.map((lead: any) => normalizePhoneDigits(String(lead?.phone || ''))).filter(Boolean));
    const existingLeadEmails = new Set(existingLeads.map((lead: any) => String(lead?.email || '').trim().toLowerCase()).filter(Boolean));
    const defaultStage = Array.isArray(currentUserProfile.crmSetup.pipelineStages) && currentUserProfile.crmSetup.pipelineStages.length
      ? currentUserProfile.crmSetup.pipelineStages[0]
      : 'New Lead';
    const defaultOwner = Array.isArray(currentUserProfile.crmSetup.teamMembers) && currentUserProfile.crmSetup.teamMembers.length
      ? currentUserProfile.crmSetup.teamMembers[0]?.name || currentUserProfile.displayName || auth.currentUser?.displayName || 'Workspace Owner'
      : currentUserProfile.displayName || auth.currentUser?.displayName || 'Workspace Owner';

    const newCrmLeads = contacts.reduce<any[]>((nextLeads, contact) => {
      const phone = normalizePhoneDigits(getContactPhone(contact));
      const email = String(contact?.email || '').trim().toLowerCase();
      if (!phone || syncingCrmLeadPhonesRef.current.has(phone)) {
        return nextLeads;
      }
      if (existingLeadPhones.has(phone) || (email && existingLeadEmails.has(email))) {
        return nextLeads;
      }

      nextLeads.push({
        id: createCrmLeadId(),
        name: String(contact?.fullName || contact?.name || phone).trim() || phone,
        company: 'Inbox Contact',
        email,
        phone,
        source: 'WhatsApp',
        owner: defaultOwner,
        stage: defaultStage,
        value: 'INR 0',
        lastTouch: contact?.lastMessageTime ? 'Recently synced' : 'New contact',
        note: String(contact?.notes || '').trim(),
        primaryRemark: String(contact?.notes || contact?.lastMessage || '').trim(),
        dateAdded: String(contact?.createdAt || contact?.updatedAt || new Date().toISOString()),
        remarks: String(contact?.notes || '').trim()
          ? [{
              id: `remark-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              text: String(contact.notes).trim(),
              createdAt: String(contact?.updatedAt || contact?.createdAt || new Date().toISOString()),
              author: 'WhatsApp Business Inbox'
            }]
          : []
      });

      return nextLeads;
    }, []);

    if (!newCrmLeads.length) return;

    newCrmLeads.forEach((lead) => syncingCrmLeadPhonesRef.current.add(lead.phone));

    void setDoc(doc(db, 'users', currentUserId), {
      crmSetup: {
        leads: [...existingLeads, ...newCrmLeads],
        leadSources: Array.from(new Set([...(currentUserProfile.crmSetup.leadSources || []), 'WhatsApp'])),
        updatedAt: new Date().toISOString()
      }
    }, { merge: true }).catch((error) => {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}`);
    }).finally(() => {
      newCrmLeads.forEach((lead) => syncingCrmLeadPhonesRef.current.delete(lead.phone));
    });
  }, [contacts, currentUserId, currentUserProfile]);

  useEffect(() => {
    if (!currentUserId) return;

    const broadcastsQuery = query(
      collection(db, 'users', currentUserId, 'broadcasts'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribeBroadcasts = onSnapshot(broadcastsQuery, (snapshot) => {
      setBroadcasts(snapshot.docs.map((broadcastDoc) => ({
        id: broadcastDoc.id,
        ...(broadcastDoc.data() as BroadcastSession)
      })));
    }, (error) => {
      const permissionDenied = typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'permission-denied';
      if (permissionDenied) {
        handleFirestoreError(error, OperationType.LIST, `users/${currentUserId}/broadcasts`);
        return;
      }
      handleFirestoreError(error, OperationType.LIST, `users/${currentUserId}/broadcasts`);
    });

    return () => unsubscribeBroadcasts();
  }, [currentUserId]);

  useEffect(() => {
    hasHydratedMessagesRef.current = false;
    seenInboundMessageIdsRef.current.clear();
    setCallDiagnosticEvents([]);
    if (currentUserId && typeof window !== 'undefined') {
      const storedValue = window.localStorage.getItem(`WhatsApp Business:last-inbound:${currentUserId}`);
      lastNotifiedInboundTimestampRef.current = storedValue ? Number(storedValue) || 0 : 0;
    } else {
      lastNotifiedInboundTimestampRef.current = 0;
    }
  }, [currentUserId]);

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      toastTimeoutsRef.current.clear();
      stopCallRingtone();
      cleanupCallMedia();
      if (incomingCallTimeoutRef.current) {
        window.clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!remoteCallAudioRef.current) return;
    remoteCallAudioRef.current.muted = activeCallSession?.speakerOn === false;
    if (remoteCallAudioRef.current.srcObject) {
      remoteCallAudioRef.current.play().catch(() => undefined);
    }
  }, [activeCallSession?.speakerOn]);

  useEffect(() => {
    if (!activeCallSession || activeCallSession.direction !== 'incoming' || activeCallSession.status !== 'ringing') {
      stopCallRingtone();
      if (incomingCallTimeoutRef.current) {
        window.clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }
      return;
    }

    playCallRingtoneBurst();
    ringtoneIntervalRef.current = window.setInterval(playCallRingtoneBurst, 1900);
    incomingCallTimeoutRef.current = window.setTimeout(() => {
      void endActiveCall('missed');
    }, 24000);

    return () => {
      stopCallRingtone();
      if (incomingCallTimeoutRef.current) {
        window.clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }
    };
  }, [activeCallSession?.id, activeCallSession?.status, activeCallSession?.direction, currentUserProfile?.notificationSettings?.soundEnabled]);

  useEffect(() => {
    if (!activeCallSession || activeCallSession.status !== 'ongoing') return;

    setCallTicker(Date.now());
    const interval = window.setInterval(() => setCallTicker(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeCallSession?.id, activeCallSession?.status]);

  useEffect(() => {
    if (!currentUserId) return;

    const inboundMessages = messages.filter((message: any) =>
      message.direction === 'inbound' || message.type === 'received'
    );

    const latestInboundTimestamp = inboundMessages.reduce((max, message: any) => {
      const timestamp = getMessageTimestamp(message);
      return Math.max(max, timestamp);
    }, 0);

    if (!hasHydratedMessagesRef.current) {
      lastNotifiedInboundTimestampRef.current = Math.max(lastNotifiedInboundTimestampRef.current, latestInboundTimestamp);
      window.localStorage.setItem(`WhatsApp Business:last-inbound:${currentUserId}`, String(lastNotifiedInboundTimestampRef.current));
      hasHydratedMessagesRef.current = true;
      return;
    }

    inboundMessages.forEach((message: any) => {
      const messageId = getMessageIdentity(message);
      const timestamp = getMessageTimestamp(message);
      if (seenInboundMessageIdsRef.current.has(messageId) || timestamp <= lastNotifiedInboundTimestampRef.current) {
        return;
      }

      seenInboundMessageIdsRef.current.add(messageId);
      const sender = message.name || message.from || 'Unknown';
      const text = message.text || message.body || message.message || 'New message received';
      showNotification(`New message from ${sender}`, text);
      showMessageToast(`New message from ${sender}`, text);
      playIncomingMessageSound();
      lastNotifiedInboundTimestampRef.current = Math.max(lastNotifiedInboundTimestampRef.current, timestamp);
    });
    window.localStorage.setItem(`WhatsApp Business:last-inbound:${currentUserId}`, String(lastNotifiedInboundTimestampRef.current));
  }, [messages, currentUserId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get('tab');

    if (requestedTab && ['inbox', 'calls', 'broadcast', 'templates', 'contacts', 'automations', 'profile', 'channel_status', 'settings'].includes(requestedTab)) {
      setActiveTab(requestedTab as TabType);
    }
  }, [location.search]);
  const requestNotificationPermission = () => {
    if (
      notificationSettings.browserEnabled &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission();
    }
  };

  const removeToast = (id: string) => {
    const timeoutId = toastTimeoutsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      toastTimeoutsRef.current.delete(id);
    }
    setMessageToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const showMessageToast = (title: string, body: string) => {
    if (!notificationSettings.toastEnabled) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessageToasts((prev) => [...prev, { id, title, body }].slice(-3));
    const timeoutId = window.setTimeout(() => removeToast(id), 4200);
    toastTimeoutsRef.current.set(id, timeoutId);
  };

  const playIncomingMessageSound = () => {
    if (!notificationSettings.soundEnabled) return;
    if (typeof window === 'undefined') return;
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      const audioContext = new AudioContextCtor();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.16);

      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.2);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.22);
      oscillator.onended = () => {
        audioContext.close().catch(() => undefined);
      };
    } catch (error) {
      console.warn('Unable to play incoming message sound.', error);
    }
  };

  const showNotification = (title: string, body: string) => {
    if (
      notificationSettings.browserEnabled &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  };

  const cleanupCallMedia = () => {
    if (callPeerConnectionRef.current) {
      callPeerConnectionRef.current.ontrack = null;
      callPeerConnectionRef.current.onconnectionstatechange = null;
      callPeerConnectionRef.current.close();
      callPeerConnectionRef.current = null;
    }

    if (localCallStreamRef.current) {
      localCallStreamRef.current.getTracks().forEach((track) => track.stop());
      localCallStreamRef.current = null;
    }

    if (remoteCallStreamRef.current) {
      remoteCallStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteCallStreamRef.current = null;
    }

    if (remoteCallAudioRef.current) {
      remoteCallAudioRef.current.pause();
      remoteCallAudioRef.current.srcObject = null;
    }
  };

  const setRemoteAudioPlayback = () => {
    if (!remoteCallAudioRef.current || !remoteCallStreamRef.current) return;
    remoteCallAudioRef.current.srcObject = remoteCallStreamRef.current;
    remoteCallAudioRef.current.muted = activeCallSession?.speakerOn === false;
    remoteCallAudioRef.current.play().catch(() => undefined);
  };

  const waitForIceGatheringComplete = async (peerConnection: RTCPeerConnection) => {
    if (peerConnection.iceGatheringState === 'complete') return;

    await new Promise<void>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        peerConnection.removeEventListener('icegatheringstatechange', handleStateChange);
        resolve();
      }, CALL_ICE_GATHERING_TIMEOUT_MS);

      const handleStateChange = () => {
        if (peerConnection.iceGatheringState === 'complete') {
          window.clearTimeout(timeoutId);
          peerConnection.removeEventListener('icegatheringstatechange', handleStateChange);
          resolve();
        }
      };

      peerConnection.addEventListener('icegatheringstatechange', handleStateChange);
    });

    const finalIceGatheringState = String(peerConnection.iceGatheringState);
    if (finalIceGatheringState !== 'complete') {
      console.warn(`ICE gathering did not finish within ${CALL_ICE_GATHERING_TIMEOUT_MS}ms. Proceeding with the best available SDP.`);
    }
  };

  const buildLocalCallSession = (description: RTCSessionDescriptionInit | null): WhatsAppCallSessionDescription | null => {
    if (!description?.type || !description.sdp) return null;
    if (description.type !== 'offer' && description.type !== 'answer' && description.type !== 'pranswer') return null;

    return {
      sdpType: description.type,
      sdp: description.sdp
    };
  };

  const ensurePeerConnection = async () => {
    if (callPeerConnectionRef.current) {
      return callPeerConnectionRef.current;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      },
      video: false
    });

    localCallStreamRef.current = localStream;
    remoteCallStreamRef.current = new MediaStream();
    setRemoteAudioPlayback();

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      if (!remoteCallStreamRef.current) {
        remoteCallStreamRef.current = new MediaStream();
      }

      if (event.track) {
        const existingTrackIds = new Set(remoteCallStreamRef.current.getTracks().map((track) => track.id));
        if (!existingTrackIds.has(event.track.id)) {
          remoteCallStreamRef.current.addTrack(event.track);
        }
      }

      event.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          const existingTrackIds = new Set(remoteCallStreamRef.current?.getTracks().map((existingTrack) => existingTrack.id) || []);
          if (!existingTrackIds.has(track.id)) {
            remoteCallStreamRef.current?.addTrack(track);
          }
        });
      });

      setRemoteAudioPlayback();
    };

    peerConnection.onconnectionstatechange = () => {
      const connectionState = peerConnection.connectionState;
      setActiveCallSession((prev) => prev ? {
        ...prev,
        permissionStatus: prev.permissionStatus || connectionState
      } : prev);

      if (connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed') {
        cleanupCallMedia();
      }
    };

    callPeerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  const applyRemoteCallSession = async (session: WhatsAppCallSessionDescription | null) => {
    if (!session) return;
    const peerConnection = await ensurePeerConnection();

    if (
      peerConnection.remoteDescription &&
      peerConnection.remoteDescription.type === session.sdpType &&
      peerConnection.remoteDescription.sdp === session.sdp
    ) {
      return;
    }

    await peerConnection.setRemoteDescription({
      type: session.sdpType,
      sdp: session.sdp
    });
  };

  const performMetaCallAction = async (request: {
    action: 'connect' | 'pre_accept' | 'accept' | 'reject' | 'terminate';
    to?: string;
    callId?: string;
    session?: WhatsAppCallSessionDescription | null;
    bizOpaqueCallbackData?: string;
  }, options?: { suppressErrorDialog?: boolean }) => {
    const connectedPhoneId = whatsappService.getCredentials().PHONE_NUMBER_ID || phoneNumbers[0]?.phoneId || '';
    if (!connectedPhoneId) {
      if (!options?.suppressErrorDialog) {
        showAppDialog({ tone: 'warning', message: 'Connect a WhatsApp Business number before using calling.' });
      }
      return null;
    }

    const result = await whatsappService.performCallAction(connectedPhoneId, {
      action: request.action,
      to: request.to,
      callId: request.callId,
      session: request.session || undefined,
      bizOpaqueCallbackData: request.bizOpaqueCallbackData
    });

    if (!result.success) {
      if (!options?.suppressErrorDialog) {
        showAppDialog({ tone: 'error', message: result.message || 'WhatsApp call action failed.' });
      }
      return null;
    }

    return result;
  };

  const upsertCallLogLocal = (record: CallLogRecord) => {
    setCallLogs((prev) => sortCallLogs([...prev.filter((entry) => entry.id !== record.id), record]));
  };

  const persistCallLog = async (record: CallLogRecord) => {
    upsertCallLogLocal(record);

    if (!currentUserId || callHistoryPermissionDeniedRef.current) return;

    try {
      await setDoc(doc(db, 'users', currentUserId, 'callLogs', record.id), record, { merge: true });
    } catch (error) {
      const permissionDenied = typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'permission-denied';
      if (permissionDenied) {
        if (!callHistoryPermissionDeniedRef.current) {
          callHistoryPermissionDeniedRef.current = true;
          console.warn('Firestore call history writes are blocked by current rules. Calls will stay available in the live session until rules are updated.');
        }
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}/callLogs/${record.id}`);
        return;
      }
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}/callLogs/${record.id}`);
    }
  };

  const persistCallMessage = async (record: CallLogRecord) => {
    const messageId = `call-msg-${record.id}`;
    const callMessage = {
      id: messageId,
      whatsappId: messageId,
      from: record.direction === 'incoming'
        ? record.contactPhone
        : (record.businessPhoneNumber || accountInfo?.displayPhoneNumber || 'Me'),
      to: record.direction === 'incoming'
        ? (record.businessPhoneNumber || accountInfo?.displayPhoneNumber || '')
        : record.contactPhone,
      text: record.label,
      timestamp: record.startedAt,
      direction: record.direction === 'incoming' ? 'inbound' : 'outbound',
      status: record.status.toUpperCase(),
      callId: record.callId,
      session: record.session || undefined,
      rawCallPayload: record.rawCallPayload,
      messageKind: 'call',
      callInfo: {
        direction: record.direction,
        status: record.status,
        label: record.label
      },
      owner: record.direction === 'outgoing'
    };

    setMessages((prev) => mergeMessages(prev, [normalizeMessageRecord(callMessage, messageId)]));
    setContacts((prev) => upsertLiveContact(prev, {
      phone: record.contactPhone,
      name: record.contactName,
      text: record.label,
      timestamp: record.startedAt,
      outbound: record.direction === 'outgoing'
    }));

    if (!currentUserId || callMessagePermissionDeniedRef.current) return;

    try {
      await setDoc(doc(db, 'users', currentUserId, 'messages', messageId), callMessage, { merge: true });
    } catch (error) {
      const permissionDenied = typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'permission-denied';
      if (permissionDenied) {
        if (!callMessagePermissionDeniedRef.current) {
          callMessagePermissionDeniedRef.current = true;
          console.warn('Firestore call message writes are blocked by current rules. Call cards will remain visible in the active session only until rules are updated.');
        }
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}/messages/${messageId}`);
        return;
      }
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}/messages/${messageId}`);
    }
  };

  const playCallRingtoneBurst = () => {
    if (!notificationSettings.soundEnabled) return;
    if (typeof window === 'undefined') return;

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      const audioContext = new AudioContextCtor();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(540, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(720, audioContext.currentTime + 0.24);
      oscillator.frequency.exponentialRampToValueAtTime(540, audioContext.currentTime + 0.48);

      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.09, audioContext.currentTime + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.62);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.65);
      oscillator.onended = () => {
        audioContext.close().catch(() => undefined);
      };
    } catch (error) {
      console.warn('Unable to play call ringtone.', error);
    }
  };

  const stopCallRingtone = () => {
    if (ringtoneIntervalRef.current) {
      window.clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  };

  const beginCallSession = (record: CallLogRecord, status: CallStatus = record.status) => {
    const session: ActiveCallSession = {
      ...record,
      status,
      label: getCallLabel(record.direction, status),
      speakerOn: true,
      participants: record.participants?.length ? record.participants : [record.contactName || record.contactPhone]
    };
    setActiveCallSession(session);
    setShowAddPeopleMenu(false);
  };

  const endActiveCall = async (status: CallStatus = 'ended') => {
    if (!activeCallSession) return;

    const action = status === 'missed' && activeCallSession.direction === 'incoming'
      ? 'reject'
      : 'terminate';

    if (activeCallSession.callId) {
      await performMetaCallAction({
        action,
        callId: activeCallSession.callId
      });
    }

    const endedAt = Date.now();
    const durationSeconds = activeCallSession.status === 'ongoing'
      ? Math.max(0, Math.floor((endedAt - activeCallSession.startedAt) / 1000))
      : 0;
    const nextRecord: CallLogRecord = {
      ...activeCallSession,
      status,
      label: getCallLabel(activeCallSession.direction, status),
      endedAt,
      durationSeconds,
      participants: activeCallSession.participants,
      session: activeCallSession.session
    };

    stopCallRingtone();
    cleanupCallMedia();
    if (incomingCallTimeoutRef.current) {
      window.clearTimeout(incomingCallTimeoutRef.current);
      incomingCallTimeoutRef.current = null;
    }

    setActiveCallSession(null);
    await persistCallLog(nextRecord);
    await persistCallMessage(nextRecord);
  };

  const answerIncomingCall = async () => {
    if (!activeCallSession || activeCallSession.direction !== 'incoming') return;
    if (!activeCallSession.callId) {
      showAppDialog({ tone: 'warning', message: 'Incoming call metadata is incomplete. Wait for the next webhook update and try again.' });
      return;
    }

    try {
      stopCallRingtone();
      if (incomingCallTimeoutRef.current) {
        window.clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }

      const preAcceptResult = await performMetaCallAction({
        action: 'pre_accept',
        callId: activeCallSession.callId
      }, { suppressErrorDialog: true });
      const latestIncomingSession = preAcceptResult?.session || activeCallSession.session || null;
      if (!latestIncomingSession) {
        showAppDialog({ tone: 'warning', message: 'Incoming call offer SDP was not present in the latest call update, so the call cannot be answered yet.' });
        return;
      }

      cleanupCallMedia();
      const peerConnection = await ensurePeerConnection();
      await applyRemoteCallSession(latestIncomingSession);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await waitForIceGatheringComplete(peerConnection);

      const localSession = buildLocalCallSession(peerConnection.localDescription);
      if (!localSession) {
        showAppDialog({ tone: 'error', message: 'Could not build the WhatsApp call answer SDP.' });
        return;
      }

      const result = await performMetaCallAction({
        action: 'accept',
        callId: preAcceptResult?.callId || activeCallSession.callId,
        session: localSession
      });

      if (!result) {
        cleanupCallMedia();
        return;
      }

      if (result.session) {
        await applyRemoteCallSession(result.session);
      }

      const answeredRecord: CallLogRecord = {
        ...activeCallSession,
        status: 'ongoing',
        label: getCallLabel('incoming', 'ongoing'),
        callId: result.callId || preAcceptResult?.callId || activeCallSession.callId,
        startedAt: Date.now(),
        session: result.session || latestIncomingSession,
        participants: activeCallSession.participants
      };

      beginCallSession(answeredRecord, 'ongoing');
      await persistCallLog(answeredRecord);
      await persistCallMessage(answeredRecord);
    } catch (error) {
      console.error('Failed to answer WhatsApp call:', error);
      cleanupCallMedia();
      showAppDialog({ tone: 'error', message: 'Failed to answer the WhatsApp call. Check microphone permissions and try again.' });
    }
  };

  const startOutgoingCall = async (contactPhone: string, _contactName?: string, _source: CallLogRecord['source'] = 'inbox') => {
    const normalizedPhone = normalizePhoneDigits(contactPhone);
    if (!normalizedPhone) {
      showAppDialog({ tone: 'warning', message: 'No valid WhatsApp number was found for this contact.' });
      return;
    }

    if (activeCallSession) {
      showAppDialog({ tone: 'warning', message: 'Finish the current call session before starting another one.' });
      return;
    }

    const connectedPhoneId = whatsappService.getCredentials().PHONE_NUMBER_ID || phoneNumbers[0]?.phoneId || '';

    let probeMessage = '';
    let probeEnabled = false;
    let permissionStatus = 'unknown';
    let permissionActions: WhatsAppCallPermissionAction[] = [];

    if (connectedPhoneId) {
      const probe = await whatsappService.probeCallingApi(connectedPhoneId, normalizedPhone);
      probeEnabled = probe.enabled;
      permissionStatus = probe.permissionStatus || 'unknown';
      permissionActions = probe.actions || [];
      probeMessage = probe.message || '';

      if (!probe.canStartCall && !probe.enabled) {
        showAppDialog({
          tone: 'warning',
          message: probeMessage || `Call permission is not ready for this user. Current status: ${permissionStatus}.`
        });
        return;
      }
    }

    if (!probeEnabled) {
      showAppDialog({
        tone: 'warning',
        message: 'Live outbound calling is unavailable until call permission is granted for this user and business number.'
      });
      return;
    }

    try {
      cleanupCallMedia();
      const peerConnection = await ensurePeerConnection();
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true
      });
      await peerConnection.setLocalDescription(offer);
      await waitForIceGatheringComplete(peerConnection);

      const localSession = buildLocalCallSession(peerConnection.localDescription);
      if (!localSession) {
        showAppDialog({ tone: 'error', message: 'Could not build the WhatsApp call offer SDP.' });
        cleanupCallMedia();
        return;
      }

      const callResponse = await performMetaCallAction({
        action: 'connect',
        to: normalizedPhone,
        session: localSession,
        bizOpaqueCallbackData: `WhatsApp Business-${Date.now()}`
      });

      if (!callResponse) {
        cleanupCallMedia();
        return;
      }

      if (callResponse.session) {
        await applyRemoteCallSession(callResponse.session);
      }

      const callIdentity = callResponse.callId || `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const callRecord: CallLogRecord = {
        id: callIdentity,
        callId: callResponse.callId || callIdentity,
        contactName: _contactName || normalizedPhone,
        contactPhone: normalizedPhone,
        direction: 'outgoing',
        status: 'ringing',
        label: getCallLabel('outgoing', 'ringing'),
        startedAt: Date.now(),
        phoneNumberId: connectedPhoneId,
        businessPhoneNumber: accountInfo?.displayPhoneNumber || phoneNumbers.find((phone) => phone.phoneId === connectedPhoneId)?.displayPhoneNumber || '',
        permissionStatus,
        permissionActions,
        source: _source,
        participants: [_contactName || normalizedPhone],
        session: localSession
      };

      beginCallSession(callRecord, 'ringing');
      await persistCallLog(callRecord);
      await persistCallMessage(callRecord);
    } catch (error) {
      console.error('Failed to start WhatsApp call:', error);
      cleanupCallMedia();
      showAppDialog({ tone: 'error', message: 'Failed to start the WhatsApp call. Check microphone access and your call permissions, then try again.' });
    }
  };

  const addParticipantToActiveCall = async (contact: { fullName?: string; name?: string; whatsappNumber?: string; phone?: string }) => {
    if (!activeCallSession) return;

    const participantLabel = contact.fullName || contact.name || getContactPhone(contact);
    if (!participantLabel) return;

    if (activeCallSession.participants.includes(participantLabel)) {
      setShowAddPeopleMenu(false);
      return;
    }

    const nextSession: ActiveCallSession = {
      ...activeCallSession,
      participants: [...activeCallSession.participants, participantLabel]
    };
    setActiveCallSession(nextSession);
    setShowAddPeopleMenu(false);
    await persistCallLog({
      ...nextSession,
      participants: nextSession.participants
    });
  };

  const lastFetchRef = useRef<number>(0);
  const fetchData = async (force = false) => {
    const now = Date.now();
    // Prevent fetching more than once every 15 seconds unless forced
    if (!force && now - lastFetchRef.current < 15000) {
      console.log('ConnectDashboard: Throttling fetchData call');
      return;
    }

    const creds = whatsappService.getCredentials();
    if (!creds.BUSINESS_ACCOUNT_ID || !creds.ACCESS_TOKEN) {
      console.log('ConnectDashboard: Skipping fetchData as WhatsApp credentials are not yet available.');
      setLoading(false);
      return;
    }

    lastFetchRef.current = now;
    try {
      const [t, acc, pns, accounts] = await Promise.all([
        whatsappService.getTemplates(),
        whatsappService.getBusinessProfile(),
        whatsappService.getPhoneNumbers(),
        whatsappService.getBusinessAccounts()
      ]);

      setTemplates(t);
      setAccountInfo(pns && pns.length > 0 ? { ...acc, ...pns[0], whatsappName: pns[0].verifiedName } : acc);
      setPhoneNumbers(pns);
      setBusinessAccounts(accounts || []);
      
    } catch (error) {
      console.error('Error fetching WhatsApp data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    requestNotificationPermission();

    // Auto refresh every 60 seconds for new messages
    const interval = setInterval(() => fetchData(), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const requestLogout = () => setIsLogoutConfirmOpen(true);

  useEffect(() => {
    if (auth.currentUser) {
      const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCurrentUserProfile(data);
          if (data.whatsappCredentials) {
            whatsappService.setCredentials(
              data.whatsappCredentials.accessToken,
              data.whatsappCredentials.phoneNumberId,
              data.whatsappCredentials.businessAccountId
            );
            // Only fetch if we haven't fetched recently
            fetchData();
          } else {
            whatsappService.clearCredentials();
          }
        } else {
          whatsappService.clearCredentials();
          setCurrentUserProfile(null);
        }
        setIsProfileLoaded(true);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser.uid}`);
        setIsProfileLoaded(true);
      });
      return () => unsubscribe();
    } else {
      whatsappService.clearCredentials();
      setIsProfileLoaded(true);
    }
  }, []);

  const unreadConversations = useMemo(
    () => contacts.filter((contact) => (contact.unreadCount || 0) > 0).length,
    [contacts]
  );

  const approvedTemplateCount = useMemo(
    () => templates.filter((template) => template.status === 'APPROVED').length,
    [templates]
  );

  const tabDetails = useMemo(() => {
    const tabConfig: Record<TabType, { title: string; description: string }> = {
      inbox: { title: 'Inbox', description: 'Reply faster, spot unread conversations, and keep the team aligned on live chats.' },
      calls: { title: 'WhatsApp Calls', description: 'Check live call readiness, place outbound calls, and answer inbound call offers from one place.' },
      broadcast: { title: 'Broadcast', description: 'Launch campaigns, monitor delivery, and keep campaign execution focused.' },
      templates: { title: 'Templates', description: 'Manage approved templates, review content quickly, and create new ones from one place.' },
      contacts: { title: 'Contacts', description: 'Organize customers, import lists, and keep relationship data clean.' },
      automations: { title: 'Automations', description: 'Design repeatable flows for follow-ups, routing, and routine work.' },
      settings: { title: 'Settings', description: 'Manage workspace access, account configuration, and admin controls.' },
      profile: { title: 'Business Profile', description: 'Polish your public business presence and verify key brand details.' },
      channel_status: { title: 'Channels', description: 'Manage WhatsApp channel health, WABA connection, catalog, and calling readiness.' }
    };

    return tabConfig[activeTab];
  }, [activeTab]);

  const connectedNumberLabel = accountInfo?.displayPhoneNumber || phoneNumbers[0]?.displayPhoneNumber || 'Connecting...';
  const connectedNumberHealth = accountInfo?.qualityRating || accountInfo?.status || phoneNumbers[0]?.qualityRating || phoneNumbers[0]?.status || 'Unknown';
  const accountAvatar = currentUserProfile?.profilePicture || auth.currentUser?.photoURL || '';
  const notificationSettings: NotificationSettings = {
    toastEnabled: currentUserProfile?.notificationSettings?.toastEnabled ?? true,
    soundEnabled: currentUserProfile?.notificationSettings?.soundEnabled ?? true,
    browserEnabled: currentUserProfile?.notificationSettings?.browserEnabled ?? true
  };
  const headerHighlights = useMemo(() => {
    const highlightMap: Record<TabType, Array<{ label: string; value: string }>> = {
      inbox: [
        { label: 'Live chats', value: contacts.length.toLocaleString() },
        { label: 'Unread', value: unreadConversations.toLocaleString() }
      ],
      calls: [
        { label: 'Connected numbers', value: phoneNumbers.length.toLocaleString() },
        { label: 'Contacts ready', value: contacts.length.toLocaleString() }
      ],
      broadcast: [
        { label: 'Campaigns', value: broadcasts.length.toLocaleString() },
        { label: 'Approved templates', value: approvedTemplateCount.toLocaleString() }
      ],
      templates: [
        { label: 'Total templates', value: templates.length.toLocaleString() },
        { label: 'Approved', value: approvedTemplateCount.toLocaleString() }
      ],
      contacts: [
        { label: 'Stored contacts', value: contacts.length.toLocaleString() },
        { label: 'Unread', value: unreadConversations.toLocaleString() }
      ],
      automations: [
        { label: 'Rule groups', value: '3' },
        { label: 'Automation state', value: 'Ready' }
      ],
      settings: [
        { label: 'Workspace', value: 'Configured' },
        { label: 'Notifications', value: notificationSettings.browserEnabled ? 'Enabled' : 'Muted' }
      ],
      profile: [
        { label: 'Business profile', value: accountInfo?.whatsappName || 'Pending' },
        { label: 'Phone ID', value: accountInfo?.phoneId ? 'Connected' : 'Pending' }
      ],
      channel_status: [
        { label: 'Connected numbers', value: phoneNumbers.length.toLocaleString() },
        { label: 'WABA status', value: String(accountInfo?.status || phoneNumbers[0]?.status || 'Unknown') }
      ]
    };

    return highlightMap[activeTab];
  }, [accountInfo?.phoneId, accountInfo?.status, accountInfo?.whatsappName, activeTab, approvedTemplateCount, broadcasts.length, contacts.length, notificationSettings.browserEnabled, phoneNumbers.length, unreadConversations]);
  const availableCallParticipants = useMemo(() => {
    if (!activeCallSession) return [];

    return contacts.filter((contact) => {
      const label = contact.fullName || contact.name || getContactPhone(contact);
      const phone = normalizePhoneDigits(getContactPhone(contact));
      return phone && phone !== activeCallSession.contactPhone && !activeCallSession.participants.includes(label);
    }).slice(0, 6);
  }, [activeCallSession, contacts]);
  const activeCallDurationLabel = activeCallSession?.status === 'ongoing'
    ? formatCallDuration((callTicker - activeCallSession.startedAt) / 1000)
    : activeCallSession?.status === 'ringing'
      ? 'Ringing...'
      : '';
  const activeCallStatusLabel = activeCallSession
    ? activeCallSession.status === 'ringing'
      ? (activeCallSession.direction === 'incoming' ? 'Incoming Call' : 'Calling')
      : activeCallSession.status === 'ongoing'
        ? 'Call in Progress'
        : getCallLabel(activeCallSession.direction, activeCallSession.status)
    : '';

  if (!isProfileLoaded) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", isDark ? "bg-[#0a0f1e] text-white" : "bg-gray-50 text-gray-900")}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B45FF]"></div>
      </div>
    );
  }

  if (!currentUserProfile?.whatsappCredentials) {
    return (
      <>
        <AppDialogHost isDark={isDark} />
        <AnimatePresence>
          {messageToasts.length > 0 && (
            <div className="pointer-events-none fixed right-4 top-4 z-[155] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
              {messageToasts.map((toast) => (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, x: 24, y: -6 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: 18, y: -4 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className={cn(
                    "pointer-events-auto overflow-hidden rounded-[1.4rem] border p-4 shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl",
                    isDark ? "border-[#5B45FF]/20 bg-[#0f172a]/95 text-white" : "border-white/70 bg-white/95 text-slate-900"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#5B45FF]">New Message</p>
                      <h4 className="mt-1 truncate text-sm font-bold">{toast.title}</h4>
                      <p className={cn("mt-1 text-xs leading-5", isDark ? "text-slate-300" : "text-slate-600")}>{toast.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeToast(toast.id)}
                      className={cn("rounded-lg px-2 py-1 text-[11px] font-semibold", isDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600")}
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
        <OnboardingSection isDark={isDark} handleLogout={handleLogout} />
      </>
    );
  }

  return (
    <>
      <AppDialogHost isDark={isDark} />
      <audio ref={remoteCallAudioRef} autoPlay playsInline className="hidden" />
      <AnimatePresence>
        {messageToasts.length > 0 && (
          <div className="pointer-events-none fixed right-4 top-4 z-[155] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
            {messageToasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 24, y: -6 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 18, y: -4 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className={cn(
                  "pointer-events-auto overflow-hidden rounded-[1.4rem] border p-4 shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl",
                  isDark ? "border-[#5B45FF]/20 bg-[#0f172a]/95 text-white" : "border-white/70 bg-white/95 text-slate-900"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#5B45FF]">New Message</p>
                    <h4 className="mt-1 truncate text-sm font-bold">{toast.title}</h4>
                    <p className={cn("mt-1 text-xs leading-5", isDark ? "text-slate-300" : "text-slate-600")}>{toast.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeToast(toast.id)}
                    className={cn("rounded-lg px-2 py-1 text-[11px] font-semibold", isDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600")}
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeCallSession && (
          <motion.div
            initial={{ opacity: 0, y: activeCallSession.status === 'ringing' ? -16 : 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: activeCallSession.status === 'ringing' ? -10 : 10, scale: 0.98 }}
            className={cn(
              "fixed z-[157] pointer-events-none px-4",
              activeCallSession.status === 'ringing'
                ? "left-0 right-0 top-6 flex justify-center"
                : "bottom-6 right-0 flex w-full justify-end sm:right-6 sm:w-auto"
            )}
          >
            <div className={cn(
              "pointer-events-auto w-full overflow-hidden rounded-[1.75rem] border shadow-[0_30px_80px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:max-w-md",
              isDark ? "border-[#5B45FF]/20 bg-[#0f172a]/95 text-white" : "border-white/70 bg-white/95 text-slate-900"
            )}>
              <div className={cn(
                "px-5 py-4",
                activeCallSession.status === 'ringing'
                  ? "bg-[#5B45FF]/10"
                  : (isDark ? "bg-white/5" : "bg-slate-50/80")
              )}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#5B45FF]">{activeCallStatusLabel}</p>
                    <h3 className="mt-2 truncate text-lg font-black tracking-tight">{activeCallSession.contactName}</h3>
                    <p className={cn("mt-1 text-sm", isDark ? "text-slate-300" : "text-slate-600")}>{activeCallSession.contactPhone}</p>
                  </div>
                  <div className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold",
                    activeCallSession.status === 'ringing'
                      ? "bg-[#5B45FF]/10 text-[#5B45FF]"
                      : activeCallSession.status === 'ongoing'
                        ? (isDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-700")
                        : "bg-slate-500/10 text-slate-500"
                  )}>
                    {activeCallDurationLabel}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4">
                <div className={cn("rounded-[1.2rem] border px-4 py-3", isDark ? "border-white/8 bg-white/5" : "border-slate-200 bg-slate-50")}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Session Note</p>
                  <p className={cn("mt-2 text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>
                    {activeCallSession.permissionStatus && !isPositiveCallPermissionStatus(activeCallSession.permissionStatus)
                      ? ['localhost', '127.0.0.1'].includes(window.location.hostname)
                        ? `Meta status: ${activeCallSession.permissionStatus}. Calling itself is active, but answer and incoming-call events must reach this same running dashboard instance through WebSocket or Firestore before audio can attach.`
                        : `Meta status: ${activeCallSession.permissionStatus}. WebRTC and call actions are active here, but the latest answer webhook/session has not arrived yet.`
                      : ['localhost', '127.0.0.1'].includes(window.location.hostname)
                        ? 'Call permission is active. If pickup audio or incoming ringing still does not appear, make sure Meta webhooks are reaching this same environment or syncing back through Firestore.'
                        : 'Use these controls to manage the active WhatsApp call session. Remote audio will begin once the SDP handshake completes.'}
                  </p>
                </div>

                {activeCallSession.status === 'ongoing' && (
                  <div className="relative mt-4">
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveCallSession((prev) => prev ? { ...prev, speakerOn: !prev.speakerOn } : prev)}
                        className={cn(
                          "inline-flex flex-col items-center justify-center gap-2 rounded-[1.2rem] border px-3 py-3 text-sm font-semibold transition-all",
                          activeCallSession.speakerOn
                            ? "border-[#5B45FF]/40 bg-[#5B45FF]/10 text-[#5B45FF]"
                            : (isDark ? "border-white/8 bg-white/5 text-slate-200 hover:bg-white/10" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white")
                        )}
                      >
                        {activeCallSession.speakerOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                        {activeCallSession.speakerOn ? 'Speaker On' : 'Speaker Off'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddPeopleMenu((prev) => !prev)}
                        className={cn("inline-flex flex-col items-center justify-center gap-2 rounded-[1.2rem] border px-3 py-3 text-sm font-semibold transition-all", isDark ? "border-white/8 bg-white/5 text-slate-200 hover:bg-white/10" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white")}
                      >
                        <UserPlus size={18} />
                        Add People
                      </button>
                      <button
                        type="button"
                        onClick={() => void endActiveCall('ended')}
                        className="inline-flex flex-col items-center justify-center gap-2 rounded-[1.2rem] border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm font-semibold text-rose-500 transition-all hover:bg-rose-500/15"
                      >
                        <PhoneOff size={18} />
                        End Call
                      </button>
                    </div>

                    {showAddPeopleMenu && (
                      <div className={cn("absolute bottom-[calc(100%+0.75rem)] left-0 z-20 w-full rounded-[1.2rem] border p-3 shadow-xl", isDark ? "border-gray-700 bg-[#0f172a]" : "border-slate-200 bg-white")}>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Add People</p>
                        <div className="space-y-2">
                          {availableCallParticipants.length === 0 && (
                            <p className="rounded-xl px-3 py-4 text-xs text-slate-500">No other saved contacts are ready to add right now.</p>
                          )}
                          {availableCallParticipants.map((contact) => (
                            <button
                              key={String(getContactKey(contact))}
                              type="button"
                              onClick={() => void addParticipantToActiveCall(contact)}
                              className={cn("flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-all", isDark ? "border-gray-700 bg-gray-900/60 hover:bg-gray-900" : "border-slate-200 bg-slate-50 hover:bg-white")}
                            >
                              <span className="truncate text-sm font-semibold">{contact.fullName || contact.name || getContactPhone(contact)}</span>
                              <span className="text-[11px] text-slate-500">{getContactPhone(contact)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeCallSession.status === 'ringing' && activeCallSession.direction === 'incoming' && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => void endActiveCall('missed')}
                      className={cn("inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all", isDark ? "border-white/8 bg-white/5 text-slate-200 hover:bg-white/10" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white")}
                    >
                      <PhoneOff size={16} />
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => void answerIncomingCall()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B45FF] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#5B45FF]"
                    >
                      <Phone size={16} />
                      Answer
                    </button>
                  </div>
                )}

                {activeCallSession.participants.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeCallSession.participants.map((participant) => (
                      <span
                        key={participant}
                        className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", isDark ? "bg-white/8 text-slate-300" : "bg-slate-100 text-slate-600")}
                      >
                        {participant}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={cn(
        "app-safe-screen transition-colors duration-300 flex flex-col md:flex-row relative overflow-hidden page-frame",
        "app-mesh-light text-slate-900"
      )}
      style={{ ['--connect-sidebar-width' as any]: isSidebarCollapsed ? '5.5rem' : 'var(--app-sidebar-width)' }}>
        <div className={cn(
          "pointer-events-none absolute inset-0",
          isDark
            ? "bg-slate-950"
            : "bg-white"
        )} />
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-[var(--app-sidebar-width)] md:[width:var(--connect-sidebar-width)] border-r transition-all duration-300 z-[70] flex flex-col transform md:translate-x-0 backdrop-blur-2xl",
        isDark ? "bg-slate-950/92 border-white/8 shadow-[0_18px_55px_rgba(2,8,23,0.42)]" : "bg-white/94 border-slate-200/75 shadow-[18px_0_60px_rgba(15,23,42,0.07)]",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className={cn("px-4 pb-3 pt-4 flex items-center justify-between gap-3", isSidebarCollapsed && "md:flex-col md:items-center")}>
          <div className={cn("min-w-0", isSidebarCollapsed && "md:flex md:w-full md:justify-center")}>
            <div className={cn("flex items-center gap-3", isSidebarCollapsed && "md:justify-center")}>
              <Logo size={44} showText={false} className="shrink-0" />
              <div className={cn("min-w-0", isSidebarCollapsed && "md:hidden")}>
                <h1 className="truncate text-base font-bold tracking-tight">WhatsApp Business</h1>
              </div>
            </div>
          </div>
          <div className={cn("flex items-center gap-2", isSidebarCollapsed && "md:w-full md:justify-center")}>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                "hidden md:flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:scale-[1.03]",
                isDark ? "border-white/8 bg-white/5 text-slate-300 hover:bg-white/10" : "border-slate-200 bg-slate-50 text-slate-500 hover:border-[#5B45FF]/25 hover:bg-white hover:text-[#5B45FF]"
              )}
            >
              <ChevronRight className={cn("transition-transform", !isSidebarCollapsed && "rotate-180")} size={18} />
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-500" type="button">
              <ChevronRight className="rotate-180" />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3 no-scrollbar">
          <NavItem 
            icon={<MessageSquareText size={20} strokeWidth={2.2} />} 
            label="Team Inbox" 
            active={activeTab === 'inbox'} 
            onClick={() => { setActiveTab('inbox'); setIsSidebarOpen(false); }}
            isDark={isDark}
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<PhoneCall size={20} strokeWidth={2.2} />} 
            label="WhatsApp Calls" 
            active={activeTab === 'calls'} 
            onClick={() => { setActiveTab('calls'); setIsSidebarOpen(false); }}
            isDark={isDark}
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<Megaphone size={20} strokeWidth={2.2} />} 
            label="Broadcast" 
            active={activeTab === 'broadcast'} 
            onClick={() => { setActiveTab('broadcast'); setIsSidebarOpen(false); }}
            isDark={isDark}
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<LayoutTemplate size={20} strokeWidth={2.2} />} 
            label="Templates" 
            active={activeTab === 'templates'} 
            onClick={() => { setActiveTab('templates'); setIsSidebarOpen(false); }}
            isDark={isDark}
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<ContactRound size={20} strokeWidth={2.2} />} 
            label="Contacts" 
            active={activeTab === 'contacts'} 
            onClick={() => { setActiveTab('contacts'); setIsSidebarOpen(false); }}
            isDark={isDark}
            collapsed={isSidebarCollapsed}
          />

          <NavItem 
            icon={<Workflow size={20} strokeWidth={2.2} />} 
            label="Automations" 
            active={activeTab === 'automations'} 
            onClick={() => { setActiveTab('automations'); setIsSidebarOpen(false); }}
            isDark={isDark}
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<Building2 size={20} strokeWidth={2.2} />} 
            label="Business Profile" 
            active={activeTab === 'profile'} 
            onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}
            isDark={isDark}
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<RadioTower size={20} strokeWidth={2.2} />} 
            label="Channels" 
            active={activeTab === 'channel_status'} 
            onClick={() => { setActiveTab('channel_status'); setIsSidebarOpen(false); }}
            isDark={isDark}
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<Settings2 size={20} strokeWidth={2.2} />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
            isDark={isDark}
            collapsed={isSidebarCollapsed}
          />
        </nav>

        {/* Logout Button */}
        <div className={cn("border-t p-3", isDark ? "border-white/8" : "border-slate-200/80")}>
          <div className={cn(
            "mb-2 flex items-center gap-3 rounded-2xl border px-3 py-3",
            isSidebarCollapsed && "md:justify-center md:px-2",
            isDark ? "border-white/8 bg-white/5" : "border-slate-200/85 bg-slate-50/85"
          )}>
            {accountAvatar ? (
              <img src={accountAvatar} alt="Account" className="h-10 w-10 rounded-2xl object-cover border border-white/20" />
            ) : (
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black",
                isDark ? "bg-[#5B45FF]/15 text-[#5B45FF]" : "bg-[#5B45FF] text-white"
              )}>
                {(currentUserProfile?.displayName || auth.currentUser?.displayName || '?')[0]}
              </div>
            )}
            <div className={cn("min-w-0", isSidebarCollapsed && "md:hidden")}>
              <p className="truncate text-sm font-bold">{currentUserProfile?.displayName || auth.currentUser?.displayName || 'Workspace Owner'}</p>
              <p className={cn("truncate text-xs", isDark ? "text-slate-400" : "text-slate-500")}>{auth.currentUser?.email || connectedNumberLabel}</p>
            </div>
          </div>
          <button 
            onClick={requestLogout}
            title="Sign Out"
            className={cn("w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-red-500 transition-all hover:bg-red-500/10 hover:text-red-600", isSidebarCollapsed && "md:justify-center md:px-0")}
          >
            <LogOut size={20} />
            <span className={cn(isSidebarCollapsed && "md:hidden")}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="desktop-main-offset flex-1 app-safe-screen flex flex-col relative z-10">
        <header className="sticky top-0 z-40 px-4 py-4 transition-colors duration-300 md:px-6 xl:px-8">
          <div className="app-header-card app-header-compact flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="app-header-action-secondary md:hidden p-2 rounded-xl shrink-0"
              >
                <Filter size={20} />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <h2 className="app-header-title truncate font-black tracking-tight">
                    {tabDetails.title}
                  </h2>
                  {headerHighlights.map((item) => (
                    <div
                      key={`${item.label}-${item.value}`}
                      className="app-header-chip hidden rounded-full px-2.5 py-1 text-[10px] font-semibold md:inline-flex"
                    >
                      <span className="mr-1.5 opacity-60">{item.label}:</span>
                      {item.value}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
              <div className="app-header-chip flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-[10px] font-medium md:text-xs">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#5B45FF] rounded-full animate-pulse" />
                <span className="max-w-[8rem] truncate font-mono text-[9px] md:max-w-[11rem] md:text-xs">{connectedNumberLabel}</span>
                <span className="opacity-50">|</span>
                <span className="font-bold">{connectedNumberHealth}</span>
              </div>
              {accountAvatar ? (
                <img
                  src={accountAvatar}
                  alt="WhatsApp Business Account"
                  className="w-10 h-10 md:w-11 md:h-11 rounded-2xl object-cover border border-white/20 shrink-0 shadow-sm"
                />
              ) : (
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold text-xs md:h-11 md:w-11 md:text-base",
                  "bg-[#5B45FF]/10 text-[#5B45FF]"
                )}>
                  {(currentUserProfile?.displayName || auth.currentUser?.displayName || '?')[0]}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="connect-content-pad flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mx-auto w-full max-w-[88rem]"
            >
            {activeTab === 'inbox' && (
              <InboxSection
                isDark={isDark}
                contacts={contacts}
                setContacts={setContacts}
                messages={messages}
                setMessages={setMessages}
                accountInfo={accountInfo}
                templates={templates}
                currentUserProfile={currentUserProfile}
                activeCallSession={activeCallSession}
                messageMediaUrls={messageMediaUrls}
                onLoadMessageMedia={ensureMessageMediaLoaded}
                onStartCall={startOutgoingCall}
                targetContactPhone={targetInboxPhone}
              />
            )}
            {activeTab === 'calls' && (
              <CallsSection
                isDark={isDark}
                contacts={contacts}
                phoneNumbers={phoneNumbers}
                callLogs={callLogs}
                activeCallSession={activeCallSession}
                currentUserId={currentUserId}
                callSocketState={callSocketState}
                callDiagnosticEvents={callDiagnosticEvents}
                onStartCall={startOutgoingCall}
              />
            )}
            {activeTab === 'broadcast' && <BroadcastSection isDark={isDark} templates={templates} broadcasts={broadcasts} contacts={contacts} isCreateTemplateModalOpen={isCreateTemplateModalOpen} setIsCreateTemplateModalOpen={setIsCreateTemplateModalOpen} />}
            {activeTab === 'templates' && <TemplatesSection isDark={isDark} templates={templates} isCreateTemplateModalOpen={isCreateTemplateModalOpen} setIsCreateTemplateModalOpen={setIsCreateTemplateModalOpen} />}
            {activeTab === 'contacts' && <ContactsSection isDark={isDark} contacts={contacts} />}
            {activeTab === 'automations' && <AutomationsSection isDark={isDark} />}
            {activeTab === 'profile' && <ProfileSection isDark={isDark} />}
            {activeTab === 'channel_status' && <ChannelStatusSection isDark={isDark} currentUserProfile={currentUserProfile} />}
            {activeTab === 'settings' && (
              <SettingsSection
                isDark={isDark}
                currentUserProfile={currentUserProfile}
                setCurrentUserProfile={setCurrentUserProfile}
                notificationSettings={notificationSettings}
              />
            )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {isLogoutConfirmOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
              onClick={() => setIsLogoutConfirmOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className={cn(
                "relative w-full max-w-md rounded-[1.75rem] border p-6 shadow-2xl",
                isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200"
              )}
            >
              <h3 className="text-xl font-bold">Sign out?</h3>
              <p className={cn("mt-2 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
                Are you sure you want to sign out of WhatsApp Business Inbox?
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  className={cn("px-5 py-3 rounded-xl font-bold", isDark ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-700")}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsLogoutConfirmOpen(false);
                    await handleLogout();
                  }}
                  className="px-5 py-3 rounded-xl font-bold bg-red-500 text-white shadow-lg shadow-red-500/20"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </>
  );
}

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

type AppDialogTone = 'info' | 'success' | 'warning' | 'error';

type AppDialogState = {
  open: boolean;
  title: string;
  message: string;
  tone: AppDialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirm?: boolean;
  resolve?: (value: boolean) => void;
};

type MessageToast = {
  id: string;
  title: string;
  body: string;
};

type NotificationSettings = {
  toastEnabled: boolean;
  soundEnabled: boolean;
  browserEnabled: boolean;
};

type TemplatePreviewData = {
  headerType: string;
  headerText: string;
  body: string;
  footer: string;
  buttons: Array<{
    text: string;
    type: string;
  }>;
};

const normalizeTemplatePreviewData = (templatePreview: any): TemplatePreviewData => ({
  headerType: clampString(templatePreview?.headerType, 100),
  headerText: clampString(templatePreview?.headerText, 500),
  body: clampString(templatePreview?.body, 4000),
  footer: clampString(templatePreview?.footer, 500),
  buttons: Array.isArray(templatePreview?.buttons)
    ? templatePreview.buttons.slice(0, 3).map((button: any) => ({
        text: clampString(button?.text || button?.type || 'Action', 120),
        type: clampString(button?.type || 'BUTTON', 50)
      }))
    : []
});

const parseTemplatePreviewData = (raw: any): TemplatePreviewData | undefined => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return normalizeTemplatePreviewData(raw);
  }

  if (typeof raw !== 'string' || !raw.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }
    return normalizeTemplatePreviewData(parsed);
  } catch {
    return undefined;
  }
};

type PendingTemplateConfirmation = {
  templateName: string;
  templatePreview: TemplatePreviewData;
  contactName: string;
  contactPhone: string;
  languageCode: string;
  category?: string;
};

const defaultNotificationSettings: NotificationSettings = {
  toastEnabled: true,
  soundEnabled: true,
  browserEnabled: true
};

const defaultDialogState: AppDialogState = {
  open: false,
  title: '',
  message: '',
  tone: 'info'
};

const dialogSubscribers = new Set<(state: AppDialogState) => void>();

const dialogTitleByTone: Record<AppDialogTone, string> = {
  info: 'Heads up',
  success: 'Success',
  warning: 'Please Confirm',
  error: 'Something went wrong'
};

function publishDialog(state: AppDialogState) {
  dialogSubscribers.forEach((listener) => listener(state));
}

function showAppDialog(options: {
  message: string;
  title?: string;
  tone?: AppDialogTone;
  confirmLabel?: string;
}) {
  publishDialog({
    open: true,
    title: options.title || dialogTitleByTone[options.tone || 'info'],
    message: options.message,
    tone: options.tone || 'info',
    confirmLabel: options.confirmLabel || 'OK'
  });
}

function showAppConfirm(options: {
  message: string;
  title?: string;
  tone?: AppDialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  return new Promise<boolean>((resolve) => {
    publishDialog({
      open: true,
      title: options.title || dialogTitleByTone[options.tone || 'warning'],
      message: options.message,
      tone: options.tone || 'warning',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      isConfirm: true,
      resolve
    });
  });
}

function AppDialogHost({ isDark }: { isDark: boolean }) {
  const [dialog, setDialog] = useState<AppDialogState>(defaultDialogState);

  useEffect(() => {
    const listener = (state: AppDialogState) => setDialog(state);
    dialogSubscribers.add(listener);
    return () => {
      dialogSubscribers.delete(listener);
    };
  }, []);

  const closeDialog = (confirmed: boolean) => {
    dialog.resolve?.(confirmed);
    setDialog(defaultDialogState);
  };

  const toneClasses = {
    info: isDark ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-sky-50 text-sky-700 border-sky-200',
    success: isDark ? 'bg-[#5B45FF]/15 text-[#5B45FF] border-[#5B45FF]/30' : 'bg-[#5B45FF] text-white border-[#5B45FF]',
    warning: isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
    error: isDark ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-rose-50 text-rose-700 border-rose-200'
  };

  return (
    <AnimatePresence>
      {dialog.open && (
        <motion.div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => closeDialog(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className={cn(
              'relative w-full max-w-md rounded-[1.75rem] border p-6 shadow-[0_28px_80px_rgba(15,23,42,0.24)]',
              isDark ? 'border-gray-800 bg-[#111827] text-white' : 'border-gray-200 bg-white text-slate-900'
            )}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ delay: 0.05, duration: 0.2 }}
              className={cn('inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em]', toneClasses[dialog.tone])}
            >
              {dialog.tone}
            </motion.div>
            <motion.h3
              className="mt-4 text-xl font-bold"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ delay: 0.08, duration: 0.22 }}
            >
              {dialog.title}
            </motion.h3>
            <motion.p
              className={cn('mt-3 text-sm leading-6', isDark ? 'text-slate-300' : 'text-slate-600')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ delay: 0.12, duration: 0.22 }}
            >
              {dialog.message}
            </motion.p>
            <motion.div
              className="mt-6 flex justify-end gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ delay: 0.16, duration: 0.22 }}
            >
              {dialog.isConfirm && (
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => closeDialog(false)}
                  className={cn('rounded-xl px-4 py-2 text-sm font-semibold', isDark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                >
                  {dialog.cancelLabel || 'Cancel'}
                </motion.button>
              )}
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => closeDialog(true)}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-semibold text-white',
                  dialog.tone === 'error' ? 'bg-rose-500 hover:bg-rose-600' :
                  dialog.tone === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                  dialog.tone === 'success' ? 'bg-[#5B45FF] hover:bg-[#5B45FF]' :
                  'bg-sky-500 hover:bg-sky-600'
                )}
              >
                {dialog.confirmLabel || 'OK'}
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Sub-sections ---

function OnboardingSection({ isDark, handleLogout }: { isDark: boolean, handleLogout: () => void }) {
  const [tab, setTab] = useState<'options' | 'manual'>('options');
  const [saving, setSaving] = useState(false);
  const [facebookSdkStatus, setFacebookSdkStatus] = useState<'loading' | 'ready' | 'error'>(() => (
    typeof window !== 'undefined' && window.FB ? 'ready' : 'loading'
  ));
  const embeddedSignupSessionRef = useRef<{ phoneNumberId?: string; wabaId?: string } | null>(null);
  const facebookAppId = import.meta.env.VITE_FACEBOOK_APP_ID || '1694113538247073';
  const facebookConfigId = import.meta.env.VITE_FACEBOOK_CONFIG_ID || '856897637410790';

  const handleManualSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const accessToken = formData.get('accessToken') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const businessAccountId = formData.get('businessAccountId') as string;

    try {
      if (auth.currentUser) {
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          whatsappCredentials: {
            accessToken,
            phoneNumberId,
            businessAccountId
          }
        }, { merge: true });
        
        // Also update the service immediately so it's ready
        whatsappService.setCredentials(accessToken, phoneNumberId, businessAccountId);
      }
    } catch (error) {
      console.error('Error saving credentials:', error);
      showAppDialog({ tone: 'error', message: 'Failed to save credentials. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleFacebookLogin = () => {
    if (!facebookAppId || !facebookConfigId) {
      showAppDialog({ tone: 'error', message: 'Facebook App ID or Config ID is not configured. Please use Manual Configuration or add VITE_FACEBOOK_APP_ID and VITE_FACEBOOK_CONFIG_ID to your environment variables.' });
      return;
    }

    if (!window.FB || facebookSdkStatus !== 'ready') {
      showAppDialog({
        tone: facebookSdkStatus === 'error' ? 'error' : 'warning',
        message: facebookSdkStatus === 'error'
          ? 'Facebook SDK failed to load. Refresh the page and try again, or use Manual Configuration.'
          : 'Facebook SDK is still loading. Please try again in a moment.'
      });
      return;
    }

    setSaving(true);
    embeddedSignupSessionRef.current = null;

    window.FB.login((response: any) => {
      const handleResponse = async () => {
        const latestResponse = typeof window.FB?.getLoginStatus === 'function'
          ? await new Promise<any>((resolve) => {
              window.FB.getLoginStatus((statusResponse: any) => resolve(statusResponse));
            })
          : response;
        const code = response?.authResponse?.code || latestResponse?.authResponse?.code;

        if (code) {
          
          try {
            const res = await fetch(buildBackendUrl('/api/wa/embedded-signup'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code,
                wabaId: embeddedSignupSessionRef.current?.wabaId,
                phoneNumberId: embeddedSignupSessionRef.current?.phoneNumberId
              })
            });
            
            if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.details?.error?.message || errorData.error || 'Failed to exchange code');
            }
            
            const data = await res.json();
            
            if (auth.currentUser) {
              await setDoc(doc(db, 'users', auth.currentUser.uid), {
                whatsappCredentials: {
                  accessToken: data.accessToken,
                  phoneNumberId: data.phoneNumberId,
                  businessAccountId: data.wabaId,
                  twoStepVerificationPin: data.twoStepVerificationPin || null,
                  registrationStatus: data.provisioning?.registration?.success ? 'registered' : 'pending',
                  registeredAt: data.provisioning?.registeredAt || null
                },
                whatsappProvisioning: {
                  twoStepVerification: data.provisioning?.twoStepVerification || null,
                  registration: data.provisioning?.registration || null,
                  subscribedApps: data.provisioning?.subscribedApps || null,
                  phoneNumberStatus: data.provisioning?.phoneNumberStatus || null,
                  updatedAt: new Date().toISOString()
                },
                toolSetup: {
                  whatsapp: true
                }
              }, { merge: true });
              
              whatsappService.setCredentials(data.accessToken, data.phoneNumberId, data.wabaId);
              showAppDialog({ tone: 'success', message: 'Successfully connected WhatsApp Business Account!' });
              
              // Reload page to reflect changes
              window.location.reload();
            }
          } catch (error: any) {
            console.error('Embedded signup error:', error);
            showAppDialog({ tone: 'error', message: `Failed to complete setup: ${error.message}` });
            setSaving(false);
          }
        } else {
          console.log('User cancelled login or did not fully authorize.', latestResponse || response);
          showAppDialog({ tone: 'warning', message: 'Facebook login did not return an authorization code. If Meta showed a network error, refresh the page and try again.' });
          setSaving(false);
        }
      };
      
      handleResponse();
    }, {
      config_id: facebookConfigId,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        feature: 'whatsapp_embedded_signup',
        sessionInfoVersion: '3'
      }
    });
  };

  useEffect(() => {
    const handleEmbeddedSignupMessage = (event: MessageEvent) => {
      if (!event.origin.includes('facebook.com')) return;

      if (typeof event.data !== 'string') return;

      try {
        const data = JSON.parse(event.data);
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;

        if (data.event === 'FINISH') {
          embeddedSignupSessionRef.current = {
            phoneNumberId: data.data?.phone_number_id,
            wabaId: data.data?.waba_id
          };
        } else if (data.event === 'CANCEL') {
          embeddedSignupSessionRef.current = null;
        }
      } catch {
        // Ignore unrelated Facebook postMessage traffic.
      }
    };

    window.addEventListener('message', handleEmbeddedSignupMessage);
    return () => {
      window.removeEventListener('message', handleEmbeddedSignupMessage);
    };
  }, []);

  useEffect(() => {
    if (!facebookAppId) {
      setFacebookSdkStatus('error');
      return;
    }

    const initializeFacebookSdk = () => {
      if (!window.FB) return;

      try {
        window.FB.init({
          appId: facebookAppId,
          cookie: true,
          xfbml: true,
          version: 'v19.0'
        });

        if (typeof window.FB.getLoginStatus === 'function') {
          window.FB.getLoginStatus(() => {
            setFacebookSdkStatus('ready');
          });
        } else {
          setFacebookSdkStatus('ready');
        }
      } catch (error) {
        console.error('Failed to initialize Facebook SDK:', error);
        setFacebookSdkStatus('error');
      }
    };

    const handleSdkError = () => {
      console.error('Failed to load Facebook SDK script.');
      setFacebookSdkStatus('error');
    };

    if (window.FB) {
      initializeFacebookSdk();
      return;
    }

    setFacebookSdkStatus('loading');
    window.fbAsyncInit = initializeFacebookSdk;

    const existingScript = document.getElementById('facebook-jssdk') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('error', handleSdkError);
      return () => {
        existingScript.removeEventListener('error', handleSdkError);
      };
    }

    const firstScript = document.getElementsByTagName('script')[0];
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.addEventListener('error', handleSdkError);
    firstScript?.parentNode?.insertBefore(script, firstScript);

    return () => {
      script.removeEventListener('error', handleSdkError);
    };
  }, [facebookAppId]);

  return (
    <div className={cn("min-h-screen flex flex-col", isDark ? "bg-[#0a0f1e] text-white" : "bg-gray-50 text-gray-900")}>
      <header className="app-header-card mx-4 mt-4 flex min-h-[4.5rem] items-center justify-between gap-3 px-5 py-3 md:mx-6 md:px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5B45FF]/10 text-[#5B45FF] flex items-center justify-center">
            <WabaIcon className="h-6 w-6" />
          </div>
          <h1 className="app-header-title font-bold tracking-tight">Connect WhatsApp Business Account.</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleLogout}
            className="app-header-action inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-8">
        <div className={cn("w-full max-w-2xl rounded-3xl p-8 md:p-12 border shadow-xl", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200")}>
          {tab === 'options' ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 text-center">
              <div className="w-20 h-20 bg-[#5B45FF]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <WabaIcon className="h-10 w-10" />
              </div>
              <h2 className="text-3xl font-bold">Connect your WhatsApp Business Account</h2>
              <p className={cn("text-lg", isDark ? "text-gray-400" : "text-gray-600")}>
                To start sending messages and managing your inbox, you need to connect your WhatsApp Business API account.
              </p>

              <div className="grid gap-4 mt-8">
                <button 
                  onClick={handleFacebookLogin}
                  disabled={saving || facebookSdkStatus === 'loading'}
                  className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#1864D9] disabled:bg-[#7daeed] disabled:cursor-not-allowed text-white p-4 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-blue-500/20"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                  {facebookSdkStatus === 'loading' ? 'Loading Facebook SDK...' : 'Login with Facebook'}
                </button>
                
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className={cn("w-full border-t", isDark ? "border-gray-800" : "border-gray-200")}></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className={cn("px-4 text-sm", isDark ? "bg-[#111827] text-gray-500" : "bg-white text-gray-400")}>or</span>
                  </div>
                </div>

                <button 
                  onClick={() => setTab('manual')}
                  className={cn("w-full flex items-center justify-center gap-3 p-4 rounded-2xl font-bold text-lg transition-all border-2", isDark ? "border-gray-700 hover:border-gray-600 text-white" : "border-gray-200 hover:border-gray-300 text-gray-900")}
                >
                  <Settings size={24} />
                  Manual Configuration
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setTab('options')} className={cn("p-2 rounded-xl transition-colors", isDark ? "hover:bg-gray-800" : "hover:bg-gray-100")}>
                  <ChevronRight className="rotate-180" />
                </button>
                <h2 className="text-2xl font-bold">Manual Configuration</h2>
              </div>

              <div className={cn("p-6 rounded-2xl text-sm space-y-4", isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-700")}>
                <h4 className="font-bold flex items-center gap-2"><Info size={16} /> Instructions</h4>
                <ol className="list-decimal pl-4 space-y-2">
                  <li>Go to the <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline font-bold">Meta App Dashboard</a>.</li>
                  <li>Select your app and navigate to <strong>WhatsApp &gt; API Setup</strong>.</li>
                  <li>Copy the <strong>Temporary access token</strong> (or generate a permanent one).</li>
                  <li>Copy the <strong>Phone number ID</strong>.</li>
                  <li>Copy the <strong>WhatsApp Business Account ID</strong>.</li>
                </ol>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">API Access Token</label>
                  <input 
                    name="accessToken" 
                    type="password" 
                    required 
                    placeholder="EAAG..." 
                    className={cn("w-full p-4 rounded-xl outline-none border focus:border-[#5B45FF] transition-all font-mono text-sm", isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200")} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Phone Number ID</label>
                  <input 
                    name="phoneNumberId" 
                    type="text" 
                    required 
                    placeholder="101234567890123" 
                    className={cn("w-full p-4 rounded-xl outline-none border focus:border-[#5B45FF] transition-all font-mono text-sm", isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200")} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">WhatsApp Business Account ID</label>
                  <input 
                    name="businessAccountId" 
                    type="text" 
                    required 
                    placeholder="101234567890123" 
                    className={cn("w-full p-4 rounded-xl outline-none border focus:border-[#5B45FF] transition-all font-mono text-sm", isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200")} 
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full bg-[#5B45FF] hover:bg-[#5B45FF] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#5B45FF]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Save size={20} />}
                  {saving ? 'Connecting...' : 'Connect Account'}
                </button>
              </form>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

function OverviewSection({ isDark, templates, broadcasts, stats, channels, accountInfo }: { isDark: boolean, templates: any[], broadcasts: any[], stats: any, channels: any[], accountInfo: any }) {
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const filteredBroadcasts = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    return broadcasts.filter((broadcast) => {
      const createdAt = new Date(broadcast.createdAt || Date.now()).getTime();
      return createdAt >= from && createdAt <= to;
    });
  }, [broadcasts, fromDate, toDate]);

  const overviewStats = useMemo(() => {
    const totals = filteredBroadcasts.reduce((acc, broadcast) => {
      const sentCount = Number(broadcast.sentCount || 0);
      const deliveredCount = Number(broadcast.deliveredCount || 0);
      const readCount = Number(broadcast.readCount || 0);
      const repliedCount = Number(broadcast.repliedCount || 0);
      const failedCount = Number((broadcast as any).failedCount || 0);
      const queuedCount = Number((broadcast as any).queuedCount || 0);
      const closedCount = Number((broadcast as any).closedCount || 0);

      return {
        sent: acc.sent + sentCount,
        delivered: acc.delivered + deliveredCount,
        opened: acc.opened + readCount,
        read: acc.read + readCount,
        replied: acc.replied + repliedCount,
        closed: acc.closed + closedCount,
        failed: acc.failed + failedCount,
        queued: acc.queued + queuedCount + (String(broadcast.status || '').toLowerCase() === 'processing' ? 1 : 0)
      };
    }, { sent: 0, delivered: 0, opened: 0, read: 0, replied: 0, closed: 0, failed: 0, queued: 0 });

    return totals;
  }, [filteredBroadcasts]);

  const channelCards = useMemo(() => {
    const whatsappConnected = accountInfo?.status === 'CONNECTED';
    return [
      {
        name: 'WhatsApp',
        detail: accountInfo?.displayPhoneNumber || 'Primary business channel',
        connected: whatsappConnected,
        icon: <WhatsAppIcon size={20} />,
        iconFrameClass: ''
      },
      {
        name: 'WhatsApp Calls',
        detail: 'Coming soon',
        connected: false,
        icon: <WhatsAppCallsIcon size={20} />,
        iconFrameClass: ''
      }
    ];
  }, [accountInfo]);

  const totalConnectedChannels = channelCards.filter((channel) => channel.connected).length;
  const deliveryRate = overviewStats.sent > 0 ? `${Math.round((overviewStats.delivered / overviewStats.sent) * 100)}%` : '0%';
  const readRate = overviewStats.sent > 0 ? `${Math.round((overviewStats.read / overviewStats.sent) * 100)}%` : '0%';
  const replyRate = overviewStats.sent > 0 ? `${Math.round((overviewStats.replied / overviewStats.sent) * 100)}%` : '0%';
  const recentCampaigns = filteredBroadcasts.slice(0, 3);
  const compactOverviewStats = [
    {
      label: 'Sent',
      value: Number(overviewStats.sent || 0).toLocaleString(),
      helper: `${filteredBroadcasts.length} campaigns`,
      tone: 'text-sky-500'
    },
    {
      label: 'Delivery',
      value: deliveryRate,
      helper: `${Number(overviewStats.delivered || 0).toLocaleString()} delivered`,
      tone: 'text-[#5B45FF]'
    },
    {
      label: 'Read',
      value: readRate,
      helper: `${Number(overviewStats.read || 0).toLocaleString()} read`,
      tone: 'text-violet-500'
    },
    {
      label: 'Replies',
      value: Number(overviewStats.replied || 0).toLocaleString(),
      helper: `${replyRate} reply rate`,
      tone: 'text-amber-500'
    }
  ];
  const accountSummary = [
    { label: 'Display', value: accountInfo?.whatsappName || accountInfo?.verifiedName || 'Not available' },
    { label: 'Number', value: accountInfo?.displayPhoneNumber || 'Not connected' },
    { label: 'Quality', value: accountInfo?.qualityRating || accountInfo?.qualityScore || 'Unknown' },
    {
      label: 'Limit',
      value: accountInfo?.whatsappBusinessManagerMessagingLimit || accountInfo?.messagingLimitTier || 'Unknown'
    }
  ];

  return (
    <motion.div 
      key="overview"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4 md:space-y-5"
    >
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className={cn("overflow-hidden rounded-[1.6rem] border p-4 md:p-5", isDark ? "border-gray-800 bg-slate-900 shadow-[0_24px_70px_rgba(2,8,23,0.28)]" : "border-slate-200 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.08)]")}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className={cn("inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em]", isDark ? "border-[#5B45FF]/20 bg-[#5B45FF]/10 text-[#5B45FF]" : "border-[#5B45FF] bg-[#5B45FF] text-white")}>
                Performance Snapshot
              </div>
              <h3 className="mt-2 text-lg font-black tracking-tight md:text-xl">Overview</h3>
            </div>
            <div className={cn("grid grid-cols-1 gap-2 rounded-[1.2rem] border p-2 sm:grid-cols-2", isDark ? "border-gray-700/80 bg-gray-950/40" : "border-slate-200 bg-white/80")}>
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={cn("w-full rounded-xl border px-3 py-2 text-xs outline-none transition-colors", isDark ? "border-gray-700 bg-gray-900 text-white focus:border-[#5B45FF]" : "border-slate-200 bg-slate-50 text-slate-900 focus:border-[#5B45FF]")}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className={cn("w-full rounded-xl border px-3 py-2 text-xs outline-none transition-colors", isDark ? "border-gray-700 bg-gray-900 text-white focus:border-[#5B45FF]" : "border-slate-200 bg-slate-50 text-slate-900 focus:border-[#5B45FF]")}
                />
              </label>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {compactOverviewStats.map((item) => (
              <div key={item.label} className={cn("rounded-[1.2rem] border px-3 py-3", isDark ? "border-gray-700/80 bg-gray-950/55" : "border-slate-200 bg-white/75")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className={cn("mt-1.5 text-lg font-black tracking-tight md:text-[1.35rem]", item.tone)}>{item.value}</p>
                <p className={cn("mt-1 text-[11px]", isDark ? "text-slate-400" : "text-slate-500")}>{item.helper}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className={cn("rounded-full px-3 py-1 text-[10px] font-semibold", overviewStats.failed > 0 ? "bg-rose-500/10 text-rose-500" : (isDark ? "bg-white/8 text-slate-300" : "bg-slate-100 text-slate-600"))}>
              Failed: {Number(overviewStats.failed || 0).toLocaleString()}
            </span>
            <span className={cn("rounded-full px-3 py-1 text-[10px] font-semibold", isDark ? "bg-white/8 text-slate-300" : "bg-slate-100 text-slate-600")}>
              Queued: {Number(overviewStats.queued || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className={cn("rounded-[1.6rem] border p-4 md:p-5", isDark ? "border-gray-800 bg-slate-900 shadow-[0_24px_70px_rgba(2,8,23,0.24)]" : "border-slate-200 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.08)]")}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Business Health</p>
              <h3 className="mt-2 text-lg font-black tracking-tight">WhatsApp Account Status</h3>
            </div>
            <span className={cn(
              "rounded-full px-3 py-1 text-[10px] font-semibold",
              accountInfo?.status === 'CONNECTED'
                ? "bg-[#5B45FF]/10 text-[#5B45FF]"
                : "bg-slate-500/10 text-slate-500"
            )}>
              {accountInfo?.status || 'Unknown'}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {accountSummary.map((item) => (
              <div key={item.label} className={cn("rounded-[1.2rem] border px-3 py-3", isDark ? "border-gray-700/80 bg-gray-950/45" : "border-slate-200 bg-slate-50/90")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className="mt-1.5 truncate text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={cn("rounded-[1.6rem] border p-4 md:p-5", isDark ? "border-gray-800 bg-slate-900 shadow-[0_24px_70px_rgba(2,8,23,0.24)]" : "border-slate-200 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.08)]")}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Recent Activity</p>
              <h3 className="mt-2 text-lg font-black tracking-tight">Past Campaigns</h3>
            </div>
            <span className={cn("rounded-full px-3 py-1 text-[10px] font-semibold", isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600")}>
              Latest {recentCampaigns.length}
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {recentCampaigns.length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed p-5 text-center text-sm text-slate-500">
                No past broadcasts found for this date range.
              </div>
            ) : (
              recentCampaigns.map((broadcast, idx) => {
                const normalizedStatus = String(broadcast.status || 'Completed').toLowerCase();
                const readCount = Number(broadcast.readCount || 0);
                const replyCount = Number(broadcast.repliedCount || 0);
                const sentCount = Number(broadcast.sentCount || 0);
                const readRatio = sentCount > 0 ? `${Math.round((readCount / sentCount) * 100)}%` : '0%';

                return (
                <div key={broadcast.id || `broadcast-${idx}`} className={cn("rounded-[1.2rem] border p-3", isDark ? "border-gray-700/80 bg-gray-950/45" : "border-slate-200 bg-slate-50/90")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{broadcast.name}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{new Date(broadcast.createdAt || Date.now()).toLocaleString()}</p>
                    </div>
                    <span className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize",
                      normalizedStatus === 'completed'
                        ? "bg-[#5B45FF]/10 text-[#5B45FF]"
                        : normalizedStatus === 'failed'
                          ? "bg-rose-500/10 text-rose-500"
                          : normalizedStatus === 'processing' || normalizedStatus === 'pending'
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-slate-500/10 text-slate-500"
                    )}>
                      {broadcast.status || 'Completed'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <span className={cn("font-medium", isDark ? "text-slate-300" : "text-slate-600")}>Sent {sentCount.toLocaleString()}</span>
                    <span className={cn("font-medium", isDark ? "text-slate-300" : "text-slate-600")}>Read {readCount.toLocaleString()}</span>
                    <span className={cn("font-medium", isDark ? "text-slate-300" : "text-slate-600")}>Read rate {readRatio}</span>
                    <span className={cn("font-medium", isDark ? "text-slate-300" : "text-slate-600")}>Replies {replyCount.toLocaleString()}</span>
                  </div>
                </div>
              )})
            )}
          </div>
        </div>

        <div className={cn("rounded-[1.6rem] border p-4 md:p-5", isDark ? "border-gray-800 bg-slate-900 shadow-[0_24px_70px_rgba(2,8,23,0.24)]" : "border-slate-200 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.08)]")}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Workspace Reach</p>
              <h3 className="mt-2 text-lg font-black tracking-tight">Connected Channels</h3>
            </div>
            <span className={cn("rounded-full px-3 py-1 text-[10px] font-semibold", isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600")}>
              {totalConnectedChannels} connected
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {channelCards.map((channel) => (
              <div
                key={channel.name}
                className={cn(
                  "flex items-center gap-3 rounded-[1.2rem] border p-3 transition-all",
                  channel.connected
                    ? (isDark ? "border-[#5B45FF]/30 bg-[#5B45FF]/10" : "border-[#5B45FF] bg-[#5B45FF] text-white")
                    : (isDark ? "border-gray-700/80 bg-gray-950/45 opacity-80" : "border-slate-200 bg-slate-50/90 opacity-85")
                )}
              >
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl",
                  channel.iconFrameClass || (channel.connected ? "" : "opacity-60")
                )}>
                  {channel.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{channel.name}</p>
                  <p className={cn("text-xs truncate", channel.connected && !isDark ? "text-white/75" : "text-slate-500")}>{channel.detail}</p>
                </div>
                <span className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                  channel.connected ? (isDark ? "bg-[#5B45FF]/10 text-[#5B45FF]" : "bg-white text-[#5B45FF]") : "bg-slate-500/10 text-slate-500"
                )}>
                  {channel.connected ? 'Connected' : 'Not connected'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function InboxSection({
  isDark,
  contacts,
  setContacts,
  messages,
  setMessages,
  accountInfo,
  templates,
  currentUserProfile,
  activeCallSession,
  messageMediaUrls,
  onLoadMessageMedia,
  onStartCall,
  targetContactPhone
}: {
  isDark: boolean,
  contacts: any[],
  setContacts: React.Dispatch<React.SetStateAction<any[]>>,
  messages: any[],
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  accountInfo: any,
  templates: any[],
  currentUserProfile: any,
  activeCallSession: ActiveCallSession | null,
  messageMediaUrls: Record<string, string>,
  onLoadMessageMedia: (mediaInfo?: MessageMediaInfo | null) => Promise<void>,
  onStartCall: (contactPhone: string, contactName?: string, source?: CallLogRecord['source']) => Promise<void>,
  targetContactPhone?: string
}) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(contacts.length > 0 ? getContactKey(contacts[0]) : null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [editingField, setEditingField] = useState<'name' | 'info' | 'attributes' | 'tags' | 'notes' | null>(null);
  const [contactNameDraft, setContactNameDraft] = useState("");
  const [contactInfoDraft, setContactInfoDraft] = useState("");
  const [contactAttributesDraft, setContactAttributesDraft] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [contactTags, setContactTags] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [showChatList, setShowChatList] = useState(true);
  const [isContactDetailsCollapsed, setIsContactDetailsCollapsed] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'starred' | 'favorites'>('all');
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [showComposerTools, setShowComposerTools] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [pendingTemplateConfirmation, setPendingTemplateConfirmation] = useState<PendingTemplateConfirmation | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatMessage, setNewChatMessage] = useState("");
  const [sendingNewChat, setSendingNewChat] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [sendingCatalog, setSendingCatalog] = useState(false);
  const [showChatFilterPopup, setShowChatFilterPopup] = useState(false);
  const [failedMediaPreviewIds, setFailedMediaPreviewIds] = useState<Record<string, boolean>>({});
  const [chatSearch, setChatSearch] = useState("");
  const [attributeFilter, setAttributeFilter] = useState("");
  const [countryCodeFilter, setCountryCodeFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [timePeriodFilter, setTimePeriodFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [commerceSettings, setCommerceSettings] = useState<WhatsAppCommerceSettings | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<WhatsAppCatalogProduct[]>([]);
  const [catalogProductsLoading, setCatalogProductsLoading] = useState(false);
  const [manualCatalogRetailerId, setManualCatalogRetailerId] = useState("");
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);

  const approvedTemplates = useMemo(() => templates.filter((template) => template.status === 'APPROVED'), [templates]);
  const approvedTemplatePreviewByBody = useMemo(() => {
    const previewByBody = new Map<string, { templateName: string; templatePreview: TemplatePreviewData }>();

    approvedTemplates.forEach((template) => {
      const templatePreview = buildTemplatePreview(template);
      const templateBodyKey = templatePreview.body.trim().toLowerCase();
      if (!templateBodyKey || previewByBody.has(templateBodyKey)) {
        return;
      }

      previewByBody.set(templateBodyKey, {
        templateName: template.name,
        templatePreview
      });
    });

    return previewByBody;
  }, [approvedTemplates]);
  const quickEmojis = ['😀', '😂', '😍', '🙏', '👍', '🔥', '🎉', '❤️'];

  const connectedCatalogId = commerceSettings?.catalogId || currentUserProfile?.whatsappCatalogConnection?.catalogId || '';

  useEffect(() => {
    if (showComposerTools) return;
    setShowEmojiPicker(false);
    setShowTemplatePicker(false);
    setShowCatalogPicker(false);
  }, [showComposerTools]);

  useEffect(() => {
    setShowComposerTools(false);
    setShowEmojiPicker(false);
    setShowTemplatePicker(false);
    setShowCatalogPicker(false);
    setPendingTemplateConfirmation(null);
  }, [selectedChatId]);

  useEffect(() => {
    let cancelled = false;

    const loadCommerceData = async () => {
      const settings = await whatsappService.getCommerceSettings();
      if (cancelled) return;

      const effectiveSettings = settings || {
        connected: Boolean(currentUserProfile?.whatsappCatalogConnection?.catalogId),
        catalogId: currentUserProfile?.whatsappCatalogConnection?.catalogId || '',
        isCatalogVisible: Boolean(currentUserProfile?.whatsappCatalogConnection?.isCatalogVisible),
        isCartEnabled: Boolean(currentUserProfile?.whatsappCatalogConnection?.isCartEnabled)
      };

      setCommerceSettings(effectiveSettings);

      const effectiveCatalogId = effectiveSettings?.catalogId || '';
      if (!effectiveCatalogId) {
        setCatalogProducts([]);
        return;
      }

      setCatalogProductsLoading(true);
      const products = await whatsappService.getCatalogProducts(effectiveCatalogId);
      if (!cancelled) {
        setCatalogProducts(products);
        setCatalogProductsLoading(false);
      }
    };

    loadCommerceData();

    return () => {
      cancelled = true;
    };
  }, [
    currentUserProfile?.whatsappCatalogConnection?.catalogId,
    currentUserProfile?.whatsappCatalogConnection?.isCatalogVisible,
    currentUserProfile?.whatsappCatalogConnection?.isCartEnabled
  ]);

  // WebSocket connection for real-time messages is handled by the parent ConnectDashboard
  
  const filteredContacts = useMemo(() => {
    const normalizedTargetPhone = normalizePhoneDigits(targetContactPhone || '');
    return [...contacts]
      .sort((a, b) => {
        const timeA = new Date(a.lastMessageTime || 0).getTime();
        const timeB = new Date(b.lastMessageTime || 0).getTime();
        return timeB - timeA;
      })
      .filter(contact => {
        const matchesRedirectTarget = normalizedTargetPhone && phonesMatch(getContactPhone(contact), normalizedTargetPhone);
        // Only show contacts we've had a conversation with
        if (!contact.lastMessage && !contact.lastMessageTime && !matchesRedirectTarget) return false;
        
        if (activeFilter === 'unread') return (contact.unreadCount || 0) > 0;
        if (activeFilter === 'starred') return starredIds.has(contact.id || contact.whatsappNumber);
        if (activeFilter === 'favorites') return favoriteIds.has(contact.id || contact.whatsappNumber);

        const contactName = `${contact.fullName || contact.name || ''} ${contact.lastMessage || ''} ${contact.whatsappNumber || contact.phone || ''}`.toLowerCase();
        if (chatSearch.trim() && !contactName.includes(chatSearch.trim().toLowerCase())) return false;

        const attributesText = Object.entries(contact.customParams || {})
          .map(([key, value]) => `${key}:${String(value)}`)
          .join(' ')
          .toLowerCase();
        if (attributeFilter.trim() && !attributesText.includes(attributeFilter.trim().toLowerCase())) return false;

        const phoneNumber = String(contact.whatsappNumber || contact.phone || '');
        if (countryCodeFilter.trim() && !phoneNumber.startsWith(countryCodeFilter.replace(/\D/g, ''))) return false;

        const messageTimestamp = new Date(contact.lastMessageTime || 0).getTime();
        if (dateFromFilter) {
          const from = new Date(`${dateFromFilter}T00:00:00`).getTime();
          if (messageTimestamp < from) return false;
        }
        if (dateToFilter) {
          const to = new Date(`${dateToFilter}T23:59:59`).getTime();
          if (messageTimestamp > to) return false;
        }

        if (timePeriodFilter !== 'all') {
          const now = Date.now();
          const threshold = timePeriodFilter === 'today'
            ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
            : now - (timePeriodFilter === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000;
          if (messageTimestamp < threshold) return false;
        }

        return true;
      });
  }, [contacts, activeFilter, starredIds, favoriteIds, chatSearch, attributeFilter, countryCodeFilter, dateFromFilter, dateToFilter, timePeriodFilter, targetContactPhone]);

  const selectedContact = selectedChatId ? contacts.find((contact) => getContactKey(contact) === selectedChatId) || null : null;
  const selectedContactPhone = normalizePhoneDigits(selectedContact?.whatsappNumber || selectedContact?.phone || '');
  const chatMessages = useMemo(() => {
    if (!selectedContact) return [];
    const contactNumbers = [selectedContact.whatsappNumber, selectedContact.phone]
      .filter(Boolean)
      .map((entry) => normalizePhoneDigits(String(entry)));
    return messages.filter((message: any) => contactNumbers.includes(normalizePhoneDigits(String(message.from || ''))) || contactNumbers.includes(normalizePhoneDigits(String(message.to || ''))));
  }, [messages, selectedContact]);
  const selectedContactOnActiveCall = Boolean(activeCallSession && selectedContactPhone && activeCallSession.contactPhone === selectedContactPhone);

  const toggleStar = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearUnreadForContact = async (contact: any) => {
    if (!contact || !auth.currentUser || (contact.unreadCount || 0) <= 0) return;

    const contactKey = getContactKey(contact);
    setContacts(prev => prev.map((item) => (
      getContactKey(item) === contactKey
        ? { ...item, unreadCount: 0 }
        : item
    )));

    const existingId = contact.id;
    if (existingId && !String(existingId).startsWith('live_')) {
      updateDoc(doc(db, 'users', auth.currentUser.uid, 'contacts', existingId), {
        unreadCount: 0,
        updatedAt: new Date().toISOString()
      }).catch((error) => {
        console.error('Error clearing unread count:', error);
      });
    }
  };

  useEffect(() => {
    if (!contacts.length) {
      setSelectedChatId(null);
      return;
    }

    if (!selectedChatId || !contacts.some((contact) => getContactKey(contact) === selectedChatId)) {
      setSelectedChatId(getContactKey(contacts[0]));
    }
  }, [contacts, selectedChatId]);

  useEffect(() => {
    const normalizedTargetPhone = normalizePhoneDigits(targetContactPhone || '');
    if (!normalizedTargetPhone || !contacts.length) {
      return;
    }

    const targetContact = contacts.find((contact) => phonesMatch(getContactPhone(contact), normalizedTargetPhone));
    if (!targetContact) {
      return;
    }

    const targetChatId = getContactKey(targetContact);
    if (targetChatId && targetChatId !== selectedChatId) {
      setSelectedChatId(targetChatId);
    }
  }, [contacts, selectedChatId, targetContactPhone]);

  useEffect(() => {
    if (selectedContact) {
      setContactNameDraft(selectedContact.fullName || selectedContact.name || "");
      setContactInfoDraft(selectedContact.whatsappNumber || selectedContact.phone || "");
      setContactNotes(selectedContact.notes || "");
      setContactTags(selectedContact.tags?.join(", ") || "");
      setContactAttributesDraft(
        Object.entries(selectedContact.customParams || {})
          .map(([key, value]) => `${key}: ${String(value)}`)
          .join('\n')
      );
      setEditingField(null);
    }
  }, [selectedContact, setContacts]);

  const parseCustomAttributes = (raw: string) => {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) return acc;
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        if (key) acc[key] = value;
        return acc;
      }, {});
  };

  const hasPendingChanges = useMemo(() => {
    if (!selectedContact) return false;
    const currentName = selectedContact.fullName || selectedContact.name || "";
    const currentInfo = selectedContact.whatsappNumber || selectedContact.phone || "";
    const currentTags = selectedContact.tags?.join(", ") || "";
    const currentNotes = selectedContact.notes || "";
    const currentAttributes = Object.entries(selectedContact.customParams || {})
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join('\n');

    return (
      contactNameDraft !== currentName ||
      contactInfoDraft !== currentInfo ||
      contactTags !== currentTags ||
      contactNotes !== currentNotes ||
      contactAttributesDraft !== currentAttributes
    );
  }, [selectedContact, contactNameDraft, contactInfoDraft, contactTags, contactNotes, contactAttributesDraft]);

  const handleSaveContactInfo = async () => {
    if (!selectedContact || !auth.currentUser) return;
    setSavingInfo(true);
    const tags = contactTags.split(',').map((t: string) => t.trim()).filter(Boolean);
    const normalizedPhone = contactInfoDraft.replace(/\D/g, '');
    const customParams = parseCustomAttributes(contactAttributesDraft);
    const contactPayload = {
      fullName: contactNameDraft.trim() || selectedContact.fullName || selectedContact.name || normalizedPhone || 'Unknown',
      whatsappNumber: normalizedPhone || selectedContact.whatsappNumber || selectedContact.phone || '',
      phone: normalizedPhone || selectedContact.phone || selectedContact.whatsappNumber || '',
      notes: contactNotes,
      tags,
      customParams,
      updatedAt: new Date().toISOString()
    };

    try {
      if (selectedContact.id) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid, 'contacts', selectedContact.id), contactPayload);
      } else {
        const existingContact = await getDocs(query(
          collection(db, 'users', auth.currentUser.uid, 'contacts'),
          where('whatsappNumber', '==', contactPayload.whatsappNumber),
          limit(1)
        ));

        if (existingContact.empty) {
          await addDoc(collection(db, 'users', auth.currentUser.uid, 'contacts'), {
            ...contactPayload,
            createdAt: new Date().toISOString(),
            lastMessage: selectedContact.lastMessage || '',
            lastMessageTime: selectedContact.lastMessageTime || null,
            unreadCount: selectedContact.unreadCount || 0,
            customParams: selectedContact.customParams || {}
          });
        } else {
          await updateDoc(doc(db, 'users', auth.currentUser.uid, 'contacts', existingContact.docs[0].id), contactPayload);
        }
      }

      setContacts(prev => prev.map((contact) => (
        getContactKey(contact) === getContactKey(selectedContact)
          ? { ...contact, ...contactPayload }
          : contact
      )));
      setEditingField(null);
    } catch (error) {
      console.error('Error saving contact info:', error);
      showAppDialog({ tone: 'error', message: 'Failed to save contact info.' });
    } finally {
      setSavingInfo(false);
    }
  };

  useEffect(() => {
    setLoadingMessages(false);
  }, [chatMessages]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages, selectedChatId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || sending || !auth.currentUser) return;

    setSending(true);
    const messageText = newMessage.trim();
    const rawNumber = selectedContact.whatsappNumber || selectedContact.phone;
    if (!rawNumber) {
      showAppDialog({ tone: 'warning', message: 'No valid phone number found for this contact.' });
      setSending(false);
      return;
    }
    const number = rawNumber.replace(/\D/g, ''); // Remove any non-digit characters (like + or spaces)
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage = normalizeMessageRecord({
      id: optimisticId,
      whatsappId: optimisticId,
      from: accountInfo?.displayPhoneNumber || 'Me',
      to: number,
      text: messageText,
      timestamp: Date.now(),
      direction: 'outbound',
      status: 'PENDING',
      owner: true
    });

    setNewMessage("");
    setMessages(prev => mergeMessages(prev, [optimisticMessage]));
    setContacts(prev => upsertLiveContact(prev, {
      phone: number,
      name: selectedContact.fullName,
      text: messageText,
      timestamp: optimisticMessage.timestamp,
      outbound: true
    }));

    const result = await whatsappService.sendTextMessage(number, messageText);
    
    if (result.success) {
      const sentMsg = {
        from: accountInfo?.displayPhoneNumber || 'Me',
        to: number,
        text: messageText,
        timestamp: Date.now(),
        direction: 'outbound',
        status: 'SENT',
        whatsappId: result.data?.messages?.[0]?.id
      };

      try {
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'messages'), sentMsg);
        setMessages(prev => prev.filter((msg) => getMessageIdentity(msg) !== optimisticId));
        const confirmedMessage = normalizeMessageRecord({ ...sentMsg, id: result.data?.messages?.[0]?.id || Date.now().toString() });
        setMessages(prev => mergeMessages(prev, [confirmedMessage]));
      } catch (err) {
        console.error("Error saving sent message:", err);
        // handleFirestoreError(err, OperationType.CREATE, `users/${auth.currentUser.uid}/messages`);
      }
    } else {
      setMessages(prev => prev.filter((msg) => getMessageIdentity(msg) !== optimisticId));
      setNewMessage(messageText);
      showAppDialog({ tone: 'error', message: 'Failed to send message. Please check your WhatsApp Cloud API configuration.' });
    }
    setSending(false);
  };

  const closeNewChat = (force = false) => {
    if (sendingNewChat && !force) return;
    setIsNewChatOpen(false);
    setNewChatName("");
    setNewChatPhone("");
    setNewChatMessage("");
  };

  const handleNewChatSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendingNewChat || !auth.currentUser) return;

    const number = normalizePhoneDigits(newChatPhone);
    const messageText = newChatMessage.trim();
    const contactName = newChatName.trim() || number;

    if (number.length < 7) {
      showAppDialog({ tone: 'warning', message: 'Enter a WhatsApp number with country code.' });
      return;
    }

    if (!messageText) {
      showAppDialog({ tone: 'warning', message: 'Type a message before sending.' });
      return;
    }

    setSendingNewChat(true);
    try {
      const result = await whatsappService.sendTextMessage(number, messageText);
      if (!result.success) {
        throw new Error(result.error || 'Failed to send message.');
      }

      const timestampIso = new Date().toISOString();
      const existingContact = contacts.find((contact) => phonesMatch(getContactPhone(contact), number));
      let contactDocId = existingContact?.id && !String(existingContact.id).startsWith('live_')
        ? existingContact.id
        : '';

      const contactPayload = {
        fullName: existingContact?.fullName || existingContact?.name || contactName,
        name: existingContact?.name || contactName,
        whatsappNumber: number,
        phone: number,
        lastMessage: messageText,
        lastMessageTime: timestampIso,
        unreadCount: 0,
        status: existingContact?.status || 'Active',
        tags: existingContact?.tags || [],
        notes: existingContact?.notes || '',
        customParams: existingContact?.customParams || {},
        updatedAt: timestampIso
      };

      if (contactDocId) {
        await setDoc(doc(db, 'users', auth.currentUser.uid, 'contacts', contactDocId), contactPayload, { merge: true });
      } else {
        const existingContactSnapshot = await getDocs(query(
          collection(db, 'users', auth.currentUser.uid, 'contacts'),
          where('whatsappNumber', '==', number),
          limit(1)
        ));

        if (existingContactSnapshot.empty) {
          const contactRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'contacts'), {
            ...contactPayload,
            createdAt: timestampIso
          });
          contactDocId = contactRef.id;
        } else {
          const existingContactDoc = existingContactSnapshot.docs[0];
          contactDocId = existingContactDoc.id;
          await setDoc(existingContactDoc.ref, contactPayload, { merge: true });
        }
      }

      const sentMsg = {
        from: accountInfo?.displayPhoneNumber || 'Me',
        to: number,
        text: messageText,
        timestamp: Date.now(),
        direction: 'outbound',
        status: 'SENT',
        whatsappId: result.data?.messages?.[0]?.id
      };
      const savedSentMessage = await saveMessageRecord(auth.currentUser.uid, sentMsg);
      const confirmedMessage = normalizeMessageRecord({
        ...sentMsg,
        id: savedSentMessage.docId,
        whatsappId: sentMsg.whatsappId || savedSentMessage.docId
      });

      setMessages(prev => mergeMessages(prev, [confirmedMessage]));
      setContacts(prev => upsertLiveContact(prev, {
        phone: number,
        name: contactName,
        text: messageText,
        timestamp: sentMsg.timestamp,
        outbound: true
      }).map((contact) => (
        phonesMatch(getContactPhone(contact), number)
          ? {
              ...contact,
              id: contactDocId || contact.id,
              fullName: contact.fullName || contactName,
              name: contact.name || contactName,
              whatsappNumber: number,
              phone: number,
              lastMessage: messageText,
              lastMessageTime: timestampIso,
              unreadCount: 0
            }
          : contact
      )));
      setSelectedChatId(contactDocId || number);
      setShowChatList(false);
      closeNewChat(true);
    } catch (error: any) {
      console.error('Failed to send new chat message:', error);
      showAppDialog({ tone: 'error', message: error.message || 'Failed to send message.' });
    } finally {
      setSendingNewChat(false);
    }
  };

  const applyWrapFormatting = (marker: '*' | '_') => {
    if (!newMessage.trim()) {
      setNewMessage(`${marker}${marker}`);
      requestAnimationFrame(() => composerInputRef.current?.focus());
      return;
    }
    setNewMessage((prev) => `${marker}${prev}${marker}`);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };

  const appendEmoji = (emoji: string) => {
    setNewMessage((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };

  const handleTemplateSend = (templateName: string) => {
    if (!selectedContact || !auth.currentUser) return;

    const rawNumber = selectedContact.whatsappNumber || selectedContact.phone;
    if (!rawNumber) {
      showAppDialog({ tone: 'warning', message: 'No valid phone number found for this contact.' });
      return;
    }

    const selectedTemplate = approvedTemplates.find((template) => template.name === templateName);
    if (!selectedTemplate) {
      showAppDialog({ tone: 'warning', message: 'That template could not be found anymore. Refresh and try again.' });
      return;
    }

    const number = rawNumber.replace(/\D/g, '');
    const languageCode = selectedTemplate?.language || 'en_US';
    const templatePreview = buildTemplatePreview(selectedTemplate);
    setShowTemplatePicker(false);
    setPendingTemplateConfirmation({
      templateName,
      templatePreview,
      contactName: selectedContact.fullName || selectedContact.name || number,
      contactPhone: number,
      languageCode,
      category: selectedTemplate.category || 'Template'
    });
  };

  const handleConfirmTemplateSend = async () => {
    if (!pendingTemplateConfirmation || !auth.currentUser) return;

    const { templateName, templatePreview, contactName, contactPhone, languageCode } = pendingTemplateConfirmation;
    setSendingTemplate(true);
    let result;

    try {
      result = await whatsappService.sendTemplateMessage(contactPhone, templateName, languageCode);
    } catch (error) {
      setSendingTemplate(false);
      setPendingTemplateConfirmation(null);
      showAppDialog({ tone: 'error', message: 'Failed to send template. Please try again.' });
      return;
    }

    if (!result.success) {
      const failedMessageId = `template-failed-${Date.now()}`;
      const failedMsg = {
        id: failedMessageId,
        from: accountInfo?.displayPhoneNumber || 'Me',
        to: contactPhone,
        text: getTemplatePreviewSummary(templateName, templatePreview),
        templateName,
        templatePreview,
        type: 'template',
        timestamp: Date.now(),
        direction: 'outbound',
        status: 'FAILED',
        failedReason: result.error || 'Failed to send template.'
      };

      try {
        const savedFailedMessage = await saveMessageRecord(auth.currentUser.uid, failedMsg);
        setMessages(prev => mergeMessages(prev, [normalizeMessageRecord({
          ...failedMsg,
          id: savedFailedMessage.docId
        })]));
        setContacts(prev => upsertLiveContact(prev, {
          phone: contactPhone,
          name: contactName,
          text: failedMsg.text,
          timestamp: failedMsg.timestamp,
          outbound: true
        }));
      } catch (error) {
        console.error('Error saving failed template message:', error);
      }
      setPendingTemplateConfirmation(null);
      setSendingTemplate(false);
      showAppDialog({ tone: 'error', message: result.error || 'Failed to send template.' });
      return;
    }

    const sentMsg = {
      id: result.data?.messages?.[0]?.id || `template-sent-${Date.now()}`,
      from: accountInfo?.displayPhoneNumber || 'Me',
      to: contactPhone,
      text: getTemplatePreviewSummary(templateName, templatePreview),
      templateName,
      templatePreview,
      type: 'template',
      timestamp: Date.now(),
      direction: 'outbound',
      status: 'SENT',
      whatsappId: result.data?.messages?.[0]?.id
    };

    try {
      const savedSentMessage = await saveMessageRecord(auth.currentUser.uid, sentMsg);
      setMessages(prev => mergeMessages(prev, [normalizeMessageRecord({
        ...sentMsg,
        id: savedSentMessage.docId,
        whatsappId: sentMsg.whatsappId || savedSentMessage.docId
      })]));
      setContacts(prev => upsertLiveContact(prev, {
        phone: contactPhone,
        name: contactName,
        text: `Template: ${templateName}`,
        timestamp: sentMsg.timestamp,
        outbound: true
      }));
      setShowTemplatePicker(false);
      setPendingTemplateConfirmation(null);
    } catch (error) {
      setPendingTemplateConfirmation(null);
      console.error('Error saving template message:', error);
      showAppDialog({ tone: 'error', message: 'Template was sent, but saving it locally failed.' });
    } finally {
      setSendingTemplate(false);
    }
  };

  const handleCatalogSend = async (product?: WhatsAppCatalogProduct) => {
    if (!selectedContact || !auth.currentUser) return;

    const rawNumber = selectedContact.whatsappNumber || selectedContact.phone;
    if (!rawNumber) {
      showAppDialog({ tone: 'warning', message: 'No valid phone number found for this contact.' });
      return;
    }

    if (!connectedCatalogId) {
      showAppDialog({ tone: 'warning', message: 'Connect a WhatsApp catalog first from Channels.' });
      return;
    }

    const productRetailerId = (product?.productRetailerId || manualCatalogRetailerId).trim();
    if (!productRetailerId) {
      showAppDialog({ tone: 'warning', message: 'Enter a product retailer ID or choose a catalog item.' });
      return;
    }

    setSendingCatalog(true);
    const number = rawNumber.replace(/\D/g, '');
    const result = await whatsappService.sendCatalogProductMessage(number, connectedCatalogId, productRetailerId);

    if (!result.success) {
      setSendingCatalog(false);
      showAppDialog({ tone: 'error', message: result.error || 'Failed to send catalog product.' });
      return;
    }

    const productLabel = product?.name || productRetailerId;
    const sentMsg = {
      from: accountInfo?.displayPhoneNumber || 'Me',
      to: number,
      text: `Catalog product shared: ${productLabel}`,
      type: 'catalog',
      timestamp: Date.now(),
      direction: 'outbound',
      status: 'SENT',
      whatsappId: result.data?.messages?.[0]?.id
    };

    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'messages'), sentMsg);
      setMessages(prev => mergeMessages(prev, [normalizeMessageRecord({ ...sentMsg, id: sentMsg.whatsappId || Date.now().toString() })]));
      setContacts(prev => upsertLiveContact(prev, {
        phone: number,
        name: selectedContact.fullName,
        text: sentMsg.text,
        timestamp: sentMsg.timestamp,
        outbound: true
      }));
      setManualCatalogRetailerId('');
      setShowCatalogPicker(false);
    } catch (error) {
      console.error('Error saving catalog message:', error);
      showAppDialog({ tone: 'error', message: 'Catalog product was sent, but saving it locally failed.' });
    } finally {
      setSendingCatalog(false);
    }
  };

  const handleMediaAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedContact || !auth.currentUser) return;

    const rawNumber = selectedContact.whatsappNumber || selectedContact.phone;
    if (!rawNumber) {
      showAppDialog({ tone: 'warning', message: 'No valid phone number found for this contact.' });
      event.target.value = '';
      return;
    }

    setSendingMedia(true);
    const number = rawNumber.replace(/\D/g, '');
    try {
      const result = await whatsappService.sendMediaMessage(number, file);
      if (!result.success) {
        showAppDialog({ tone: 'error', message: result.error || 'Failed to send media.' });
        return;
      }

      const sentMsg = {
        from: accountInfo?.displayPhoneNumber || 'Me',
        to: number,
        text: `Sent ${result.mediaType}: ${file.name}`,
        timestamp: Date.now(),
        direction: 'outbound',
        status: 'SENT',
        whatsappId: result.data?.messages?.[0]?.id,
        type: result.mediaType,
        messageKind: result.mediaType,
        mediaType: result.mediaType,
        mediaId: result.mediaId,
        mimeType: file.type,
        filename: file.name,
        caption: ''
      };

      await addDoc(collection(db, 'users', auth.currentUser.uid, 'messages'), sentMsg);
      setMessages(prev => mergeMessages(prev, [normalizeMessageRecord({ ...sentMsg, id: sentMsg.whatsappId || Date.now().toString() })]));
      setContacts(prev => upsertLiveContact(prev, {
        phone: number,
        name: selectedContact.fullName,
        text: sentMsg.text,
        timestamp: sentMsg.timestamp,
        outbound: true
      }));
    } catch (error) {
      console.error('Error sending media:', error);
      showAppDialog({ tone: 'error', message: 'Failed to send media.' });
    } finally {
      setSendingMedia(false);
      event.target.value = '';
    }
  };

  const renderDetailField = ({
    id,
    label,
    value,
    placeholder,
    multiline = false,
    onChange
  }: {
    id: 'name' | 'info' | 'attributes' | 'tags' | 'notes';
    label: string;
    value: string;
    placeholder: string;
    multiline?: boolean;
    onChange: (value: string) => void;
  }) => {
    const isEditing = editingField === id;
    const showActions = isEditing;

    return (
      <div className={cn("rounded-[1.35rem] border p-4", isDark ? "border-gray-800 bg-gray-950/45" : "border-slate-200 bg-slate-50/80")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditingField(isEditing ? null : id)}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn("flex h-8 w-8 items-center justify-center rounded-xl transition-all", isDark ? "bg-white/10 text-slate-300 hover:bg-white/15" : "bg-white text-slate-500 shadow-sm hover:text-slate-900")}
          >
            <Edit3 size={14} />
          </button>
        </div>

        {isEditing ? (
          <div className="mt-3 space-y-3">
            {multiline ? (
              <textarea
                rows={id === 'attributes' ? 5 : 4}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={cn("w-full rounded-xl border p-3 text-xs outline-none resize-none", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-white text-slate-900")}
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={cn("w-full rounded-xl border p-3 text-xs outline-none", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-white text-slate-900")}
              />
            )}
            <AnimatePresence>
              {showActions && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="flex justify-end gap-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedContact) return;
                      setContactNameDraft(selectedContact.fullName || selectedContact.name || "");
                      setContactInfoDraft(selectedContact.whatsappNumber || selectedContact.phone || "");
                      setContactTags(selectedContact.tags?.join(", ") || "");
                      setContactNotes(selectedContact.notes || "");
                      setContactAttributesDraft(
                        Object.entries(selectedContact.customParams || {})
                          .map(([key, val]) => `${key}: ${String(val)}`)
                          .join('\n')
                      );
                      setEditingField(null);
                    }}
                    className={cn("rounded-xl px-3 py-2 text-[11px] font-semibold", isDark ? "bg-white/10 text-slate-200" : "bg-white text-slate-600 shadow-sm")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveContactInfo}
                    disabled={savingInfo || !hasPendingChanges}
                    className="rounded-xl bg-[#5B45FF] px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#5B45FF] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingInfo ? 'Saving...' : 'Save'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <p className={cn("mt-3 text-xs leading-6", isDark ? "text-slate-200" : "text-slate-700")}>{value || placeholder}</p>
        )}
      </div>
    );
  };

  return (
    <motion.div 
      key="inbox"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "connect-inbox-frame rounded-[1.7rem] md:rounded-[2rem] border overflow-hidden flex relative shadow-[0_24px_70px_rgba(15,23,42,0.08)]",
        isDark ? "border-gray-800 bg-slate-900" : "border-slate-200/85 bg-white/95 backdrop-blur-xl"
      )}
    >
      {/* Chat List */}
      <div className={cn(
        "absolute inset-0 md:relative md:inset-auto w-full md:w-[clamp(17.5rem,19vw,20rem)] border-r flex flex-col transition-transform duration-300 z-20 backdrop-blur-sm",
        isDark ? "bg-[#0d1729]/96 border-gray-800" : "bg-white/96 border-slate-200/80",
        showChatList ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className={cn("border-b p-4", isDark ? "border-white/8" : "border-slate-200/80")}>
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black tracking-tight">Inbox</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">{filteredContacts.length} conversations</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewChatOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#5B45FF] px-3 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-[#4b38df]"
              >
                <Plus size={14} />
                New Chat
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className={cn("flex flex-1 items-center gap-2 rounded-xl border px-3 py-2", isDark ? "border-gray-700 bg-gray-800" : "border-slate-200 bg-slate-50")}>
              <Search size={16} className="text-gray-500" />
              <input
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search chats..."
                className="w-full border-none bg-transparent text-xs outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowChatFilterPopup((prev) => !prev)}
              className={cn("flex h-10 w-10 items-center justify-center rounded-xl transition-all", isDark ? "bg-gray-800 text-slate-300 hover:bg-gray-700" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50")}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
          <AnimatePresence>
            {showChatFilterPopup && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className={cn("rounded-[1.2rem] border p-3 shadow-xl", isDark ? "border-gray-700 bg-[#0f172a]" : "border-slate-200 bg-white")}
              >
                <div className="grid gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Attributes</label>
                    <input
                      type="text"
                      value={attributeFilter}
                      onChange={(e) => setAttributeFilter(e.target.value)}
                      placeholder="vip, plan:premium"
                      className={cn("w-full rounded-xl border px-3 py-2 text-xs outline-none", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Country Code</label>
                    <input
                      type="text"
                      value={countryCodeFilter}
                      onChange={(e) => setCountryCodeFilter(e.target.value)}
                      placeholder="91"
                      className={cn("w-full rounded-xl border px-3 py-2 text-xs outline-none", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">From Date</label>
                      <input
                        type="date"
                        value={dateFromFilter}
                        onChange={(e) => setDateFromFilter(e.target.value)}
                        className={cn("w-full rounded-xl border px-3 py-2 text-xs outline-none", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">To Date</label>
                      <input
                        type="date"
                        value={dateToFilter}
                        onChange={(e) => setDateToFilter(e.target.value)}
                        className={cn("w-full rounded-xl border px-3 py-2 text-xs outline-none", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Time Period</label>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { id: 'all', label: 'All' },
                        { id: 'today', label: 'Today' },
                        { id: '7d', label: '7 Days' },
                        { id: '30d', label: '30 Days' }
                      ] as const).map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setTimePeriodFilter(option.id)}
                          className={cn(
                            "rounded-full px-3 py-1 text-[10px] font-semibold transition-all",
                            timePeriodFilter === option.id
                              ? "bg-[#5B45FF] text-white"
                              : (isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600")
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAttributeFilter("");
                        setCountryCodeFilter("");
                        setDateFromFilter("");
                        setDateToFilter("");
                        setTimePeriodFilter('all');
                      }}
                      className={cn("rounded-xl px-3 py-2 text-[11px] font-semibold", isDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600")}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowChatFilterPopup(false)}
                      className="rounded-xl bg-[#5B45FF] px-3 py-2 text-[11px] font-semibold text-white"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mt-3 flex gap-1 overflow-x-auto pb-1 no-scrollbar">
            {(['all', 'unread', 'starred', 'favorites'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                  activeFilter === f
                    ? "bg-[#5B45FF] text-white"
                    : (isDark ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900")
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {filteredContacts.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              {`No ${activeFilter !== 'all' ? activeFilter : ''} contacts found`}
            </div>
          )}
          {filteredContacts.map((contact: any, idx: number) => {
            const contactId = contact.id || contact.whatsappNumber;
            const isStarred = starredIds.has(contactId);
            const isFavorite = favoriteIds.has(contactId);
            const contactPreviewText = resolveConversationPreviewText(contact, contact.lastMessage);
            const isSelectedContactRow = Boolean(selectedContact && (selectedContact.id || selectedContact.whatsappNumber) === contactId);
            
            return (
              <button 
                key={contactId || idx}
                onClick={() => {
                  clearUnreadForContact(contact);
                  setSelectedChatId(contactId);
                  setShowChatList(false);
                }}
                className={cn(
                  "group flex w-full gap-3 border-b px-4 py-3.5 text-left transition-all",
                  isDark ? "border-gray-800/50" : "border-gray-100",
                  isSelectedContactRow
                    ? (isDark ? "bg-[#5B45FF]/10" : "bg-[#5B45FF] text-white") 
                    : (isDark ? "hover:bg-white/5" : "hover:bg-slate-50")
                )}
              >
                <div className="relative shrink-0">
                  <img 
                    src={getConversationAvatarUrl(contact)}
                    alt={contact.fullName || contact.name || 'Conversation profile'}
                    className="w-10 h-10 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#5B45FF] border-2 border-[#111827] rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="truncate text-sm font-bold">{contact.fullName || contact.name || contact.whatsappNumber || 'Unknown'}</h4>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {isFavorite && <Heart size={10} className="text-red-500 fill-red-500" />}
                      {isStarred && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
                      <span className={cn("text-[9px] md:text-[10px] uppercase", isSelectedContactRow && !isDark ? "text-white/90" : "text-gray-500")}>
                        {contact.lastMessageTime ? new Date(contact.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className={cn("text-[11px] truncate flex-1", isSelectedContactRow && !isDark ? "text-white/85" : "text-gray-400")}>{contactPreviewText || contact.whatsappNumber}</p>
                    {contact.unreadCount > 0 && (
                      <AnimatePresence initial={false}>
                        <motion.span
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          className="bg-[#5B45FF] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-2"
                        >
                        {contact.unreadCount}
                        </motion.span>
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Window */}
      <div className={cn("flex-1 flex flex-col relative z-0", isDark ? "bg-[#08111f]/35" : "bg-transparent")}>
        {selectedContact ? (
          <>
            <div className={cn("flex items-center justify-between border-b px-4 py-3 backdrop-blur-sm", isDark ? "border-white/8 bg-[#0b1527]/70" : "border-slate-200/80 bg-white/82")}>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowChatList(true)}
                  className="md:hidden p-2 -ml-2 text-gray-500"
                >
                  <ChevronRight className="rotate-180" size={20} />
                </button>
                <img
                  src={getConversationAvatarUrl(selectedContact)}
                  alt={selectedContact.fullName || selectedContact.name || 'Conversation profile'}
                  className="h-9 w-9 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <h4 className="truncate text-base font-bold leading-tight">{selectedContact.fullName || selectedContact.name}</h4>
                  <p className="text-[10px] text-slate-400">{selectedContact.whatsappNumber || selectedContact.phone || ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <button 
                  onClick={() => toggleStar(selectedContact.id || selectedContact.whatsappNumber)}
                  className={cn("rounded-xl p-2 transition-colors", starredIds.has(selectedContact.id || selectedContact.whatsappNumber) ? "text-yellow-500" : "hover:bg-slate-100 hover:text-slate-700")}
                >
                  <Star size={18} fill={starredIds.has(selectedContact.id || selectedContact.whatsappNumber) ? "currentColor" : "none"} />
                </button>
                <button
                  type="button"
                  onClick={() => void onStartCall(selectedContact.whatsappNumber || selectedContact.phone || '', selectedContact.fullName || selectedContact.name, 'inbox')}
                  title={selectedContactOnActiveCall ? 'Call already active' : 'Start call'}
                  disabled={!selectedContactPhone || selectedContactOnActiveCall}
                  className={cn(
                    "rounded-xl p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    selectedContactOnActiveCall ? "text-[#5B45FF]" : "hover:bg-slate-100 hover:text-slate-700"
                  )}
                >
                  <Phone size={18} />
                </button>
                <button 
                  onClick={() => toggleFavorite(selectedContact.id || selectedContact.whatsappNumber)}
                  className={cn("rounded-xl p-2 transition-colors", favoriteIds.has(selectedContact.id || selectedContact.whatsappNumber) ? "text-red-500" : "hover:bg-slate-100 hover:text-slate-700")}
                >
                  <Heart size={18} fill={favoriteIds.has(selectedContact.id || selectedContact.whatsappNumber) ? "currentColor" : "none"} />
                </button>
                <button className="rounded-xl p-2 hover:bg-slate-100 hover:text-slate-700"><Search size={18} /></button>
                <button className="rounded-xl p-2 hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal size={18} /></button>
              </div>
            </div>
            <div 
              ref={messagesViewportRef}
              className={cn(
                "flex-1 p-3.5 md:p-4 overflow-y-auto space-y-3 relative no-scrollbar",
                "chat-canvas-light"
              )}
            >
              <div className="relative z-0 space-y-3">
                {loadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5B45FF]"></div>
                  </div>
                ) : (!Array.isArray(chatMessages) || chatMessages.length === 0) ? (
                  <div className="flex justify-center items-center h-full text-gray-500 text-sm">
                    No messages found
                  </div>
                ) : (
                  [...chatMessages].sort((a: any, b: any) => {
                    const getTimestamp = (m: any) => {
                      if (m.created || m.createdOn) return m.created || m.createdOn;
                      if (m.timestamp) {
                        const ts = typeof m.timestamp === 'string' ? parseInt(m.timestamp) : m.timestamp;
                        if (!isNaN(ts)) {
                          return ts < 10000000000 ? ts * 1000 : ts;
                        }
                      }
                      return new Date().toISOString();
                    };
                    return new Date(getTimestamp(a)).getTime() - new Date(getTimestamp(b)).getTime();
                  }).map((msg: any, mIdx: number) => {
                    const isSentByUs = msg.owner === true || msg.type === 'sent' || msg.type === 'outbound' || msg.direction === 'outbound' || !!msg.operatorEmail || !!msg.operatorName || msg.eventType?.includes('Sent');
                    const isFailedMessage = isSentByUs && (msg.status === 'FAILED' || msg.failedReason);
                    const callInfo = inferCallInfo(msg);
                    const callContactPhone = normalizePhoneDigits(String(
                      callInfo?.direction === 'incoming'
                        ? (msg.from || selectedContact.whatsappNumber || selectedContact.phone || '')
                        : (msg.to || selectedContact.whatsappNumber || selectedContact.phone || '')
                    ));
                    const callActionLabel = callInfo ? getCallActionLabel(callInfo.direction) : 'Call';
                    const callActionDisabled = !callInfo || !callContactPhone || Boolean(activeCallSession && activeCallSession.contactPhone === callContactPhone);
                    const messageMedia = extractMessageMediaInfo(msg);
                    const inferredTemplate = !callInfo && isSentByUs && !messageMedia
                      ? approvedTemplatePreviewByBody.get(String(msg.text || msg.body || msg.message || '').trim().toLowerCase())
                      : undefined;
                    const effectiveTemplateName = msg.templateName || inferredTemplate?.templateName || '';
                    const effectiveTemplatePreview = msg.templatePreview || inferredTemplate?.templatePreview || null;
                    const isTemplateMessage = Boolean((msg.type === 'template' || effectiveTemplatePreview || effectiveTemplateName) && isSentByUs && !callInfo);
                    const resolvedMediaUrl = messageMedia?.mediaId ? messageMediaUrls[messageMedia.mediaId] : '';
                    const mediaSummaryText = getMessageMediaSummaryText(messageMedia);
                    const hasFailedMediaPreview = Boolean(messageMedia?.mediaId && failedMediaPreviewIds[messageMedia.mediaId]);
                    const getMsgDate = (m: any) => {
                      if (m.created || m.createdOn) return m.created || m.createdOn;
                      if (m.timestamp) {
                        const ts = typeof m.timestamp === 'string' ? parseInt(m.timestamp) : m.timestamp;
                        if (!isNaN(ts)) {
                          return ts < 10000000000 ? ts * 1000 : ts;
                        }
                      }
                      return new Date().toISOString();
                    };
                    const msgDate = getMsgDate(msg);
                    return (
                      <motion.div
                        key={msg.id || msg.whatsappId || mIdx}
                        layout
                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className={cn("flex", isSentByUs ? "justify-end" : "justify-start")}
                      >
                        <div className={cn(
                          "max-w-[82%] md:max-w-[68%] p-2.5 md:p-3 rounded-[1.2rem] text-[13px] shadow-sm backdrop-blur-sm",
                          isFailedMessage
                            ? (isDark ? "rounded-tr-sm bg-rose-500 text-white shadow-[0_16px_35px_rgba(244,63,94,0.24)]" : "rounded-tr-sm bg-rose-100 text-slate-900 border border-rose-200")
                            : isSentByUs 
                            ? (isDark ? "rounded-tr-sm bg-[#5B45FF] text-white shadow-[0_16px_35px_rgba(91,69,255,0.24)]" : "rounded-tr-sm bg-[#5B45FF] text-white border border-[#5B45FF]")
                            : (isDark ? "rounded-tl-sm bg-white/8 text-white border border-white/8" : "rounded-tl-sm bg-white/92 text-gray-900 border border-white")
                        )}>
                          {isTemplateMessage && (
                            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                              <span className={cn(
                                "rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em]",
                                isFailedMessage
                                  ? "bg-white/15 text-white"
                                  : isSentByUs
                                    ? (isDark ? "bg-white/15 text-white" : "border border-white/80 bg-white/95 text-[#5B45FF]")
                                    : "bg-[#5B45FF] text-white"
                              )}>
                                Template
                              </span>
                              {effectiveTemplateName && (
                                <span className={cn(
                                "rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em]",
                                isFailedMessage
                                  ? "bg-white/10 text-white/90"
                                  : isSentByUs
                                      ? (isDark ? "bg-white/10 text-white/90" : "border border-white/80 bg-white/95 text-slate-700")
                                      : "bg-slate-100 text-slate-600"
                                )}>
                                  {effectiveTemplateName}
                                </span>
                              )}
                            </div>
                          )}
                          {callInfo ? (
                            <div className="space-y-2">
                              <div className={cn(
                                "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                                callInfo.status === 'missed'
                                  ? "bg-rose-500/15 text-rose-200"
                                  : isSentByUs || isFailedMessage
                                    ? "bg-white/15 text-white/90"
                                    : "bg-[#5B45FF]/10 text-[#5B45FF]"
                              )}>
                                <Phone size={12} />
                                <span>{callInfo.label}</span>
                              </div>
                              <div className={cn(
                                "rounded-2xl border px-3 py-3",
                                isFailedMessage
                                  ? "border-white/10 bg-white/10"
                                  : isSentByUs
                                    ? "border-white/10 bg-white/10"
                                    : (isDark ? "border-white/8 bg-white/5" : "border-slate-200 bg-slate-50/90")
                              )}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold">{callInfo.status === 'missed' ? 'Missed call' : callInfo.direction === 'incoming' ? 'Incoming call' : 'Outgoing call'}</p>
                                    <p className={cn("mt-1 text-[11px] leading-5", isSentByUs || isFailedMessage ? "text-white/75" : (isDark ? "text-slate-300" : "text-slate-500"))}>
                                      {callInfo.status === 'ongoing'
                                        ? 'Call session opened in workspace mode.'
                                        : callInfo.status === 'ringing'
                                          ? 'Ringing event received.'
                                          : 'Open the call console again from here if needed.'}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void onStartCall(callContactPhone, selectedContact.fullName || selectedContact.name, 'inbox')}
                                    disabled={callActionDisabled}
                                    className={cn(
                                      "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50",
                                      isSentByUs || isFailedMessage
                                        ? "bg-white/15 text-white hover:bg-white/20"
                                        : "bg-[#5B45FF] text-white hover:bg-[#5B45FF]"
                                    )}
                                  >
                                    <Phone size={13} />
                                    {callActionLabel}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : isTemplateMessage && effectiveTemplatePreview ? (
                            <div className="space-y-2">
                              {msg.campaignName && (
                                <div className={cn("inline-flex rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em]", isFailedMessage ? "bg-white/15 text-white" : (isSentByUs ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"))}>
                                  {msg.campaignName}
                                </div>
                              )}
                              {(effectiveTemplatePreview.headerText || effectiveTemplatePreview.headerType) && (
                                <div className={cn(
                                  "rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em]",
                                  isFailedMessage
                                    ? "bg-white/15 text-white/90"
                                    : isSentByUs
                                      ? (isDark ? "bg-white/18 text-white" : "bg-white/95 text-slate-700")
                                      : "bg-slate-100 text-slate-600"
                                )}>
                                  {effectiveTemplatePreview.headerText || effectiveTemplatePreview.headerType || 'Template header'}
                                </div>
                              )}
                              <div className={cn(
                                "rounded-xl p-3 leading-relaxed",
                                isFailedMessage
                                  ? "bg-white/12 text-white"
                                  : isSentByUs
                                    ? (isDark ? "bg-white/14 text-white" : "bg-white/96 text-slate-900")
                                    : "bg-white/70 text-slate-900"
                              )}>
                                {effectiveTemplatePreview.body || msg.text || 'Template message'}
                              </div>
                              {effectiveTemplatePreview.footer && (
                                <p className={cn(
                                  "text-[10px]",
                                  isFailedMessage
                                    ? "text-white/80"
                                    : isSentByUs
                                      ? (isDark ? "text-white/85" : "text-[#5B45FF]/80")
                                      : "text-slate-500"
                                )}>
                                  {effectiveTemplatePreview.footer}
                                </p>
                              )}
                              {Array.isArray(effectiveTemplatePreview.buttons) && effectiveTemplatePreview.buttons.length > 0 && (
                                <div className="space-y-1.5">
                                  {effectiveTemplatePreview.buttons.slice(0, 3).map((button: any, buttonIndex: number) => (
                                    <div
                                      key={`${button.text}-${buttonIndex}`}
                                      className={cn(
                                        "rounded-xl px-3 py-2 text-center text-[11px] font-semibold",
                                        isFailedMessage
                                          ? "bg-white/15 text-white"
                                          : isSentByUs
                                            ? (isDark ? "bg-white/15 text-white" : "border border-white/80 bg-white/96 text-[#5B45FF]")
                                            : "bg-white/80 text-cyan-700 border border-white"
                                      )}
                                    >
                                      {button.text}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : messageMedia ? (
                            <div className="space-y-2">
                              <div className={cn(
                                "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                                isFailedMessage
                                  ? "bg-white/15 text-white"
                                  : isSentByUs
                                    ? "bg-white/15 text-white"
                                    : "bg-slate-100 text-slate-600"
                              )}>
                                {messageMedia.type === 'image' || messageMedia.type === 'sticker' ? <ImageIcon size={12} /> : messageMedia.type === 'video' ? <Video size={12} /> : messageMedia.type === 'audio' ? <Volume2 size={12} /> : <FileText size={12} />}
                                <span>{getMessageMediaLabel(messageMedia.type, messageMedia.filename)}</span>
                              </div>

                              {(messageMedia.type === 'image' || messageMedia.type === 'sticker') && (
                                resolvedMediaUrl && !hasFailedMediaPreview ? (
                                  <img
                                    src={resolvedMediaUrl}
                                    alt={messageMedia.caption || getMessageMediaLabel(messageMedia.type, messageMedia.filename)}
                                    className={cn(
                                      "max-h-[22rem] w-full rounded-2xl object-cover",
                                      messageMedia.type === 'sticker' && "max-h-48 object-contain"
                                    )}
                                    onError={() => {
                                      if (!messageMedia.mediaId) return;
                                      setFailedMediaPreviewIds((prev) => ({ ...prev, [messageMedia.mediaId]: true }));
                                    }}
                                  />
                                ) : (
                                  <div className={cn(
                                    "flex min-h-[10rem] items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-xs font-semibold uppercase tracking-[0.18em]",
                                    isSentByUs || isFailedMessage ? "border-white/20 bg-white/10 text-white/80" : "border-slate-200 bg-slate-50 text-slate-500"
                                  )}>
                                    {hasFailedMediaPreview ? 'Preview unavailable' : 'Loading media...'}
                                  </div>
                                )
                              )}

                              {messageMedia.type === 'video' && (
                                resolvedMediaUrl && !hasFailedMediaPreview ? (
                                  <video
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="max-h-[22rem] w-full rounded-2xl bg-black"
                                    src={resolvedMediaUrl}
                                    onError={() => {
                                      if (!messageMedia.mediaId) return;
                                      setFailedMediaPreviewIds((prev) => ({ ...prev, [messageMedia.mediaId]: true }));
                                    }}
                                  />
                                ) : (
                                  <div className={cn(
                                    "flex min-h-[10rem] items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-xs font-semibold uppercase tracking-[0.18em]",
                                    isSentByUs || isFailedMessage ? "border-white/20 bg-white/10 text-white/80" : "border-slate-200 bg-slate-50 text-slate-500"
                                  )}>
                                    {hasFailedMediaPreview ? 'Preview unavailable' : 'Loading video...'}
                                  </div>
                                )
                              )}

                              {messageMedia.type === 'audio' && (
                                <div className={cn(
                                  "rounded-2xl border px-3 py-3",
                                  isSentByUs || isFailedMessage ? "border-white/10 bg-white/10" : "border-slate-200 bg-slate-50/90"
                                )}>
                                  {messageMedia.mediaId ? (
                                    <button
                                      type="button"
                                      onClick={() => void onLoadMessageMedia(messageMedia)}
                                      className={cn(
                                        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all",
                                        isSentByUs || isFailedMessage ? "bg-white/15 text-white hover:bg-white/20" : "bg-white text-slate-700 hover:bg-slate-100"
                                      )}
                                    >
                                      <Volume2 size={14} />
                                      Load audio
                                    </button>
                                  ) : null}
                                  {resolvedMediaUrl && (
                                    <audio controls preload="metadata" className="mt-3 w-full" src={resolvedMediaUrl} />
                                  )}
                                </div>
                              )}

                              {messageMedia.type === 'document' && (
                                <div className={cn(
                                  "rounded-2xl border px-3 py-3",
                                  isSentByUs || isFailedMessage ? "border-white/10 bg-white/10" : "border-slate-200 bg-slate-50/90"
                                )}>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold">{messageMedia.filename || 'Document attachment'}</p>
                                      {messageMedia.mimeType && (
                                        <p className={cn("mt-1 text-[11px]", isSentByUs || isFailedMessage ? "text-white/75" : "text-slate-500")}>
                                          {messageMedia.mimeType}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void onLoadMessageMedia(messageMedia)}
                                      className={cn(
                                        "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all",
                                        isSentByUs || isFailedMessage ? "bg-white/15 text-white hover:bg-white/20" : "bg-white text-slate-700 hover:bg-slate-100"
                                      )}
                                    >
                                      <Download size={13} />
                                      Load file
                                    </button>
                                  </div>
                                  {resolvedMediaUrl && (
                                    <a
                                      href={resolvedMediaUrl}
                                      download={messageMedia.filename || 'attachment'}
                                      className={cn("mt-3 inline-flex items-center gap-2 text-xs font-bold", isSentByUs || isFailedMessage ? "text-white" : "text-cyan-700")}
                                    >
                                      <Download size={13} />
                                      Download attachment
                                    </a>
                                  )}
                                </div>
                              )}

                              {mediaSummaryText && (
                                <p className="leading-relaxed">{mediaSummaryText}</p>
                              )}
                            </div>
                          ) : (
                            <p className="leading-relaxed">{msg.text || msg.body || msg.message || 'Message not supported yet'}</p>
                          )}
                          {isFailedMessage && (
                            <div className="mt-2 flex items-start gap-2 rounded-xl bg-black/10 px-3 py-2 text-[11px] text-white">
                              <AlertCircle size={14} className="mt-0.5 shrink-0" />
                              <span>{msg.failedReason || 'Failed to send this message.'}</span>
                            </div>
                          )}
                          <div className={cn(
                            "text-[9px] mt-1.5 flex justify-between items-center gap-2",
                            isFailedMessage || isSentByUs ? "text-white/85" : "text-slate-500"
                          )}>
                            <div className="flex items-center gap-2 opacity-70">
                              {isSentByUs && msg.operatorName && <span>Sent by: {msg.operatorName}</span>}
                              {isTemplateMessage && (
                                <span className={cn(
                                "rounded px-1.5 py-0.5 font-bold uppercase tracking-[0.18em]",
                                isFailedMessage
                                    ? "bg-white/15 text-white"
                                    : isSentByUs
                                      ? (isDark ? "bg-white/15 text-white" : "border border-white/80 bg-white/95 text-[#5B45FF]")
                                      : "bg-[#5B45FF] text-white"
                                )}>
                                  Template
                                </span>
                              )}
                              {isFailedMessage && (
                                <span className="rounded px-1 text-rose-100">
                                  FAILED
                                </span>
                              )}
                              {isSentByUs && msg.statusString && (
                                <span className={cn(
                                  "px-1 rounded",
                                  msg.statusString === 'READ' ? "text-blue-100" : "text-white/75"
                                )}>
                                  {msg.statusString}
                                </span>
                              )}
                            </div>
                            <span className={cn(
                              "rounded-full px-1.5 py-0.5 text-white",
                              isFailedMessage || isSentByUs ? "bg-white/10" : "bg-slate-700/45"
                            )}>
                              {new Date(msgDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <div className={cn("relative z-40 p-3 border-t backdrop-blur-sm", isDark ? "border-white/8 bg-[#0b1527]/75" : "border-slate-200/80 bg-white/75")}>
              <div className="relative z-40">
                <AnimatePresence>
                  {showComposerTools && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className={cn("mb-2 flex items-center gap-1.5", isDark ? "text-slate-300" : "text-slate-600")}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowTemplatePicker(false);
                          setShowCatalogPicker(false);
                          setShowEmojiPicker((prev) => !prev);
                        }}
                        className={cn("flex h-8 w-8 items-center justify-center rounded-xl transition-all", isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-white shadow-sm hover:bg-slate-50")}
                      >
                        <Smile size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={cn("flex h-8 w-8 items-center justify-center rounded-xl transition-all", isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-white shadow-sm hover:bg-slate-50")}
                      >
                        <Paperclip size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEmojiPicker(false);
                          setShowCatalogPicker(false);
                          setShowTemplatePicker((prev) => !prev);
                        }}
                        className={cn("rounded-xl px-3 py-2 text-[11px] font-semibold transition-all", isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-white shadow-sm hover:bg-slate-50")}
                      >
                        Templates
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEmojiPicker(false);
                          setShowTemplatePicker(false);
                          setShowCatalogPicker((prev) => !prev);
                        }}
                        disabled={!connectedCatalogId}
                        className={cn(
                          "rounded-xl px-3 py-2 text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
                          isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-white shadow-sm hover:bg-slate-50"
                        )}
                      >
                        Catalog
                      </button>
                      <button
                        type="button"
                        onClick={() => applyWrapFormatting('*')}
                        className={cn("flex h-8 w-8 items-center justify-center rounded-xl transition-all", isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-white shadow-sm hover:bg-slate-50")}
                      >
                        <strong className="text-xs">B</strong>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyWrapFormatting('_')}
                        className={cn("flex h-8 w-8 items-center justify-center rounded-xl transition-all", isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-white shadow-sm hover:bg-slate-50")}
                      >
                        <em className="text-xs">I</em>
                      </button>
                      <div className="ml-auto text-[10px] text-slate-400">
                        {sendingTemplate
                          ? 'Sending template...'
                          : sendingCatalog
                            ? 'Sending catalog product...'
                            : sendingMedia
                              ? 'Sending media...'
                              : showCatalogPicker
                                ? 'Choose a product'
                                : showTemplatePicker
                                  ? 'Choose a template'
                                  : showEmojiPicker
                                    ? 'Choose an emoji'
                                    : 'Composer tools'}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showComposerTools && showEmojiPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className={cn("absolute bottom-[calc(100%+0.75rem)] left-0 z-[90] rounded-[1.2rem] border p-3 shadow-xl", isDark ? "border-gray-700 bg-[#0f172a]" : "border-slate-200 bg-white")}
                    >
                      <div className="grid grid-cols-4 gap-2">
                        {quickEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => appendEmoji(emoji)}
                            className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-all", isDark ? "hover:bg-white/10" : "hover:bg-slate-100")}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showComposerTools && showTemplatePicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className={cn("absolute bottom-[calc(100%+0.75rem)] left-0 z-[90] w-72 rounded-[1.2rem] border p-3 shadow-xl", isDark ? "border-gray-700 bg-[#0f172a]" : "border-slate-200 bg-white")}
                    >
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Approved Templates</p>
                      <div className="max-h-56 space-y-2 overflow-y-auto">
                        {approvedTemplates.length === 0 && (
                          <p className="rounded-xl px-3 py-4 text-xs text-slate-500">No approved templates available.</p>
                        )}
                        {approvedTemplates.map((template) => (
                          <button
                            key={template.id || template.name}
                            type="button"
                            onClick={() => handleTemplateSend(template.name)}
                            className={cn("w-full rounded-xl border px-3 py-2 text-left transition-all", isDark ? "border-gray-700 bg-gray-900/60 hover:bg-gray-900" : "border-slate-200 bg-slate-50 hover:bg-white")}
                          >
                            <p className="text-xs font-semibold">{template.name}</p>
                            <p className="mt-1 text-[10px] text-slate-500">{template.category || 'Template'}</p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showComposerTools && showCatalogPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className={cn("absolute bottom-[calc(100%+0.75rem)] left-0 z-[90] w-[22rem] rounded-[1.2rem] border p-3 shadow-xl", isDark ? "border-gray-700 bg-[#0f172a]" : "border-slate-200 bg-white")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">WhatsApp Catalog</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {connectedCatalogId ? `Catalog ID: ${connectedCatalogId}` : 'Connect a catalog from Channels first.'}
                          </p>
                        </div>
                        {catalogProductsLoading && <RefreshCw size={14} className="animate-spin text-slate-400" />}
                      </div>

                      {connectedCatalogId && (
                        <div className="mt-3 space-y-3">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Manual Product Retailer ID</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={manualCatalogRetailerId}
                                onChange={(e) => setManualCatalogRetailerId(e.target.value)}
                                placeholder="SKU-1001"
                                className={cn("flex-1 rounded-xl border px-3 py-2 text-xs outline-none", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                              />
                              <button
                                type="button"
                                onClick={() => handleCatalogSend()}
                                disabled={!manualCatalogRetailerId.trim() || sendingCatalog}
                                className="rounded-xl bg-[#5B45FF] px-3 py-2 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Send
                              </button>
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Catalog Products</p>
                            <div className="max-h-56 space-y-2 overflow-y-auto">
                              {!catalogProductsLoading && catalogProducts.length === 0 && (
                                <p className="rounded-xl px-3 py-4 text-xs text-slate-500">
                                  No products were returned for this catalog yet. You can still send a product using its retailer ID.
                                </p>
                              )}
                              {catalogProducts.map((product) => (
                                <button
                                  key={product.id || product.productRetailerId}
                                  type="button"
                                  onClick={() => handleCatalogSend(product)}
                                  disabled={sendingCatalog}
                                  className={cn("w-full rounded-xl border px-3 py-3 text-left transition-all", isDark ? "border-gray-700 bg-gray-900/60 hover:bg-gray-900" : "border-slate-200 bg-slate-50 hover:bg-white")}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold truncate">{product.name || product.productRetailerId || 'Catalog product'}</p>
                                      <p className="mt-1 text-[10px] text-slate-500 truncate">{product.productRetailerId || product.id}</p>
                                    </div>
                                    <div className="text-right text-[10px] text-[#5B45FF]">
                                      {product.price ? `${product.currency || ''} ${product.price}`.trim() : 'Share'}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className={cn("flex items-center gap-2 p-2 rounded-[1.1rem] border", isDark ? "border-white/8 bg-white/6" : "border-slate-200 bg-slate-50/90")}>
                  <button
                    type="button"
                    onClick={() => setShowComposerTools((prev) => !prev)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                      showComposerTools
                        ? (isDark ? "bg-[#5B45FF] text-white" : "bg-[#5B45FF] text-white shadow-sm")
                        : (isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-white hover:text-slate-900")
                    )}
                    title={showComposerTools ? 'Hide composer tools' : 'Show composer tools'}
                  >
                    <Plus size={20} className={cn("transition-transform", showComposerTools && "rotate-45")} />
                  </button>
                  <input
                    ref={composerInputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="bg-transparent border-none outline-none text-[13px] flex-1 py-1"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      newMessage.trim() ? "bg-[#5B45FF] text-white" : "text-gray-500"
                    )}
                  >
                    <Send size={20} />
                  </motion.button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={handleMediaAttachment}
                />
              </div>
            </div>
          </>
        ) : (
          <div className={cn(
            "flex-1 flex flex-col items-center justify-center p-8 text-center relative",
            "chat-canvas-light"
          )}>
            <div className="relative z-10 flex flex-col items-center">
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mb-4", isDark ? "bg-gray-800" : "bg-white shadow-sm")}>
                <WabaIcon className="h-8 w-8" />
              </div>
              <h3 className={cn("text-lg font-bold mb-2", isDark ? "text-white" : "text-gray-900")}>Your Messages</h3>
              <p className={cn("text-sm max-w-xs", isDark ? "text-gray-400" : "text-gray-500")}>Select a contact from the list to start chatting.</p>
              <button
                type="button"
                onClick={() => setIsNewChatOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#5B45FF] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#4b38df]"
              >
                <Plus size={16} />
                New Chat
              </button>
              <button 
                onClick={() => setShowChatList(true)}
                className="md:hidden mt-3 px-6 py-2 bg-[#5B45FF] text-white rounded-xl font-bold text-sm shadow-sm"
              >
                View Contacts
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contact Info Pane - Desktop Only */}
      {selectedContact && (
        <div className={cn(
          "hidden min-h-0 border-l flex-col overflow-hidden backdrop-blur-sm transition-all duration-300 lg:flex",
          isContactDetailsCollapsed ? "w-[4.25rem]" : "w-[clamp(16.5rem,18vw,19.5rem)]",
          isDark ? "border-white/8 bg-[#08111f]/40" : "border-slate-200/80 bg-white/72"
        )}>
          {isContactDetailsCollapsed ? (
            <div className="flex h-full flex-col items-center gap-4 p-3">
              <button
                type="button"
                onClick={() => setIsContactDetailsCollapsed(false)}
                title="Expand contact details"
                className={cn("flex h-10 w-10 items-center justify-center rounded-2xl transition-all", isDark ? "bg-white/10 text-slate-200 hover:bg-white/15" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
              >
                <ChevronRight className="rotate-180" size={18} />
              </button>
              <img
                src={getConversationAvatarUrl(selectedContact)}
                alt={selectedContact.fullName || selectedContact.name || 'Conversation profile'}
                className="h-10 w-10 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="vertical-rl rotate-180 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400" style={{ writingMode: 'vertical-rl' }}>
                Details
              </div>
            </div>
          ) : (
            <>
              <div className={cn("flex items-center justify-between border-b px-4 py-3", isDark ? "border-white/8" : "border-slate-200/80")}>
                <div>
                  <p className="text-sm font-bold">Contact Details</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Profile and notes</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsContactDetailsCollapsed(true)}
                  title="Collapse contact details"
                  className={cn("flex h-9 w-9 items-center justify-center rounded-xl transition-all", isDark ? "bg-white/10 text-slate-200 hover:bg-white/15" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <div className="mb-5 rounded-[1.5rem] border p-4 text-center shadow-sm backdrop-blur-sm">
                  <img
                    src={getConversationAvatarUrl(selectedContact)}
                    alt={selectedContact.fullName || selectedContact.name || 'Conversation profile'}
                    className="mx-auto mb-3 h-16 w-16 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <h4 className="text-base font-bold">{selectedContact.fullName || selectedContact.name}</h4>
                  <p className="mt-1 text-xs text-gray-400">{selectedContact.whatsappNumber || selectedContact.phone}</p>
                </div>
                
                <div className="space-y-3">
                  {renderDetailField({
                    id: 'name',
                    label: 'Contact Name',
                    value: contactNameDraft,
                    placeholder: 'Add contact name',
                    onChange: setContactNameDraft
                  })}
                  {renderDetailField({
                    id: 'info',
                    label: 'Contact Information',
                    value: contactInfoDraft,
                    placeholder: 'Add contact phone number',
                    onChange: setContactInfoDraft
                  })}
                  {renderDetailField({
                    id: 'attributes',
                    label: 'Contact Attributes',
                    value: contactAttributesDraft,
                    placeholder: 'plan: premium',
                    multiline: true,
                    onChange: setContactAttributesDraft
                  })}
                  {renderDetailField({
                    id: 'tags',
                    label: 'Contact Tags',
                    value: contactTags,
                    placeholder: 'vip, lead, support',
                    onChange: setContactTags
                  })}
                  {renderDetailField({
                    id: 'notes',
                    label: 'Contact Notes',
                    value: contactNotes,
                    placeholder: 'Add internal notes',
                    multiline: true,
                    onChange: setContactNotes
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {isNewChatOpen && (
          <motion.div
            className="absolute inset-0 z-[125] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => closeNewChat()}
          >
            <motion.form
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(event) => event.stopPropagation()}
              onSubmit={handleNewChatSubmit}
              className={cn(
                "w-full max-w-md rounded-[1.7rem] border p-5 shadow-[0_28px_80px_rgba(15,23,42,0.24)]",
                isDark ? "border-gray-800 bg-[#111827] text-white" : "border-slate-200 bg-white text-slate-900"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#5B45FF]">WhatsApp</p>
                  <h3 className="mt-2 text-xl font-black tracking-tight">New Chat</h3>
                </div>
                <button
                  type="button"
                  onClick={() => closeNewChat()}
                  disabled={sendingNewChat}
                  className={cn("flex h-9 w-9 items-center justify-center rounded-xl transition-all disabled:opacity-50", isDark ? "bg-white/10 text-slate-200 hover:bg-white/15" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Phone Number</label>
                  <input
                    type="tel"
                    value={newChatPhone}
                    onChange={(event) => setNewChatPhone(event.target.value)}
                    placeholder="+91 98765 43210"
                    autoFocus
                    className={cn("w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all focus:border-[#5B45FF]", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Name</label>
                  <input
                    type="text"
                    value={newChatName}
                    onChange={(event) => setNewChatName(event.target.value)}
                    placeholder="Optional"
                    className={cn("w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all focus:border-[#5B45FF]", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Message</label>
                  <textarea
                    value={newChatMessage}
                    onChange={(event) => setNewChatMessage(event.target.value)}
                    placeholder="Type a message..."
                    rows={5}
                    className={cn("w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none transition-all focus:border-[#5B45FF]", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => closeNewChat()}
                  disabled={sendingNewChat}
                  className={cn("rounded-xl px-4 py-3 text-sm font-bold transition-all disabled:opacity-50", isDark ? "bg-white/10 text-slate-200 hover:bg-white/15" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingNewChat || normalizePhoneDigits(newChatPhone).length < 7 || !newChatMessage.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#5B45FF] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#4b38df] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingNewChat ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  {sendingNewChat ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingTemplateConfirmation && (
          <motion.div
            className="absolute inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!sendingTemplate) {
                setPendingTemplateConfirmation(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "w-full max-w-xl rounded-[1.8rem] border p-5 shadow-[0_28px_80px_rgba(15,23,42,0.24)]",
                isDark ? "border-gray-800 bg-[#111827] text-white" : "border-slate-200 bg-white text-slate-900"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className={cn(
                    "inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]",
                    isDark ? "border-[#5B45FF]/30 bg-[#5B45FF]/10 text-[#5B45FF]" : "border-[#5B45FF] bg-[#5B45FF] text-white"
                  )}>
                    Template Preview
                  </div>
                  <h3 className="mt-3 text-xl font-bold">{pendingTemplateConfirmation.templateName}</h3>
                  <p className={cn("mt-2 text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>
                    Are you sure you want to send the Template "{pendingTemplateConfirmation.templateName}" to "{pendingTemplateConfirmation.contactName}"?
                  </p>
                </div>
                <div className={cn(
                  "rounded-2xl border px-3 py-2 text-right text-[11px]",
                  isDark ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
                )}>
                  <p className="font-bold uppercase tracking-[0.18em] text-slate-400">Recipient</p>
                  <p className="mt-1 text-sm font-semibold">{pendingTemplateConfirmation.contactName}</p>
                  <p className="mt-1">{pendingTemplateConfirmation.contactPhone}</p>
                </div>
              </div>

              <div className={cn(
                "mt-5 rounded-[1.6rem] border p-4",
                isDark ? "border-gray-800 bg-[#0b1527]" : "border-slate-200 bg-slate-50"
              )}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">How it appears to the customer</p>
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                    isDark ? "bg-white/10 text-slate-300" : "bg-white text-slate-600"
                  )}>
                    {pendingTemplateConfirmation.category || 'Template'}
                  </span>
                </div>

                <div className={cn(
                  "mt-4 rounded-[1.4rem] border p-4 shadow-sm",
                  isDark ? "border-white/10 bg-white" : "border-white bg-white"
                )}>
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[#5B45FF] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white">
                      Template Message
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">
                      {pendingTemplateConfirmation.templateName}
                    </span>
                  </div>
                  {(pendingTemplateConfirmation.templatePreview.headerText || pendingTemplateConfirmation.templatePreview.headerType) && (
                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                      {pendingTemplateConfirmation.templatePreview.headerText || pendingTemplateConfirmation.templatePreview.headerType}
                    </div>
                  )}
                  <div className="mt-2 rounded-xl bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-900">
                    {pendingTemplateConfirmation.templatePreview.body || `Template: ${pendingTemplateConfirmation.templateName}`}
                  </div>
                  {pendingTemplateConfirmation.templatePreview.footer && (
                    <p className="mt-2 text-[10px] text-slate-500">
                      {pendingTemplateConfirmation.templatePreview.footer}
                    </p>
                  )}
                  {pendingTemplateConfirmation.templatePreview.buttons.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {pendingTemplateConfirmation.templatePreview.buttons.slice(0, 3).map((button, buttonIndex) => (
                        <div
                          key={`${button.text}-${buttonIndex}`}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-[11px] font-semibold text-cyan-700"
                        >
                          {button.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPendingTemplateConfirmation(null)}
                  disabled={sendingTemplate}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
                    isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmTemplateSend()}
                  disabled={sendingTemplate}
                  className="rounded-xl bg-[#5B45FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5B45FF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingTemplate ? 'Sending...' : 'Send Template'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const TEMPLATE_CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'UTILITY', label: 'Utility' },
  { value: 'AUTHENTICATION', label: 'Authentication' }
];

const TEMPLATE_LANGUAGES = [
  { value: 'af', label: 'Afrikaans' },
  { value: 'sq', label: 'Albanian' },
  { value: 'ar', label: 'Arabic' },
  { value: 'az', label: 'Azerbaijani' },
  { value: 'bn', label: 'Bengali' },
  { value: 'bg', label: 'Bulgarian' },
  { value: 'ca', label: 'Catalan' },
  { value: 'zh_CN', label: 'Chinese (Simplified)' },
  { value: 'zh_HK', label: 'Chinese (Hong Kong)' },
  { value: 'zh_TW', label: 'Chinese (Traditional)' },
  { value: 'hr', label: 'Croatian' },
  { value: 'cs', label: 'Czech' },
  { value: 'da', label: 'Danish' },
  { value: 'nl', label: 'Dutch' },
  { value: 'en', label: 'English' },
  { value: 'en_GB', label: 'English (UK)' },
  { value: 'en_US', label: 'English (US)' },
  { value: 'et', label: 'Estonian' },
  { value: 'fil', label: 'Filipino' },
  { value: 'fi', label: 'Finnish' },
  { value: 'fr', label: 'French' },
  { value: 'ka', label: 'Georgian' },
  { value: 'de', label: 'German' },
  { value: 'el', label: 'Greek' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'ha', label: 'Hausa' },
  { value: 'he', label: 'Hebrew' },
  { value: 'hi', label: 'Hindi' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'id', label: 'Indonesian' },
  { value: 'ga', label: 'Irish' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'kn', label: 'Kannada' },
  { value: 'kk', label: 'Kazakh' },
  { value: 'ko', label: 'Korean' },
  { value: 'ky_KG', label: 'Kyrgyz' },
  { value: 'lo', label: 'Lao' },
  { value: 'lv', label: 'Latvian' },
  { value: 'lt', label: 'Lithuanian' },
  { value: 'mk', label: 'Macedonian' },
  { value: 'ms', label: 'Malay' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'mr', label: 'Marathi' },
  { value: 'nb', label: 'Norwegian' },
  { value: 'fa', label: 'Persian' },
  { value: 'pl', label: 'Polish' },
  { value: 'pt_BR', label: 'Portuguese (Brazil)' },
  { value: 'pt_PT', label: 'Portuguese (Portugal)' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'ro', label: 'Romanian' },
  { value: 'ru', label: 'Russian' },
  { value: 'sr', label: 'Serbian' },
  { value: 'sk', label: 'Slovak' },
  { value: 'sl', label: 'Slovenian' },
  { value: 'es', label: 'Spanish' },
  { value: 'es_AR', label: 'Spanish (Argentina)' },
  { value: 'es_ES', label: 'Spanish (Spain)' },
  { value: 'es_MX', label: 'Spanish (Mexico)' },
  { value: 'sw', label: 'Swahili' },
  { value: 'sv', label: 'Swedish' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'th', label: 'Thai' },
  { value: 'tr', label: 'Turkish' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'ur', label: 'Urdu' },
  { value: 'uz', label: 'Uzbek' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'zu', label: 'Zulu' }
];

function sanitizeTemplateName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function CreateTemplateModal({
  isDark,
  onClose
}: {
  isDark: boolean,
  onClose: () => void
}) {
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('en_US');
  const [headerType, setHeaderType] = useState<'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'>('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerMediaSample, setHeaderMediaSample] = useState('');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [websiteButtonText, setWebsiteButtonText] = useState('');
  const [websiteButtonUrl, setWebsiteButtonUrl] = useState('');
  const [quickReplies, setQuickReplies] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, []);

  const insertIntoBody = (before: string, after = before) => {
    const textarea = bodyRef.current;
    const selectionStart = textarea?.selectionStart ?? body.length;
    const selectionEnd = textarea?.selectionEnd ?? body.length;
    const selectedText = body.slice(selectionStart, selectionEnd);
    const nextBody = `${body.slice(0, selectionStart)}${before}${selectedText}${after}${body.slice(selectionEnd)}`;
    setBody(nextBody);

    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      const cursor = selectionStart + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const insertEmoji = () => insertIntoBody('😊', '');
  const insertVariable = () => {
    const nextIndex = (body.match(/\{\{.*?\}\}/g) || []).length + 1;
    insertIntoBody(`{{variable_${nextIndex}}}`, '');
  };

  const updateQuickReply = (index: number, value: string) => {
    setQuickReplies(prev => prev.map((item, idx) => idx === index ? value : item));
  };

  const addQuickReply = () => {
    if (quickReplies.length >= 3) return;
    setQuickReplies(prev => [...prev, '']);
  };

  const removeQuickReply = (index: number) => {
    setQuickReplies(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const components: any[] = [];

      if (headerType === 'TEXT' && headerText.trim()) {
        components.push({
          type: 'HEADER',
          format: 'TEXT',
          text: headerText.trim()
        });
      }

      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
        const headerComponent: any = {
          type: 'HEADER',
          format: headerType
        };

        if (headerMediaSample.trim()) {
          headerComponent.example = { header_handle: [headerMediaSample.trim()] };
        }

        components.push(headerComponent);
      }

      components.push({
        type: 'BODY',
        text: body.trim()
      });

      if (footer.trim()) {
        components.push({
          type: 'FOOTER',
          text: footer.trim()
        });
      }

      const buttons: any[] = [];
      if (websiteButtonText.trim() && websiteButtonUrl.trim()) {
        buttons.push({
          type: 'URL',
          text: websiteButtonText.trim(),
          url: websiteButtonUrl.trim()
        });
      }

      quickReplies
        .map(reply => reply.trim())
        .filter(Boolean)
        .forEach((reply) => {
          buttons.push({
            type: 'QUICK_REPLY',
            text: reply
          });
        });

      if (buttons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons
        });
      }

      const result = await whatsappService.createTemplate(
        sanitizeTemplateName(templateName),
        category,
        language,
        components
      );

      if (result.success) {
        showAppDialog({ tone: 'success', message: 'Template sent for approval.' });
        onClose();
      } else {
        showAppDialog({ tone: 'error', message: `Failed to create template: ${result.error}` });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] md:pl-72 flex items-start md:items-center justify-center p-4 md:p-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={cn("relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-[2rem] shadow-2xl border interactive-lift glass-sheen", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200")}
      >
        <div className="max-h-[92vh] overflow-y-auto overscroll-contain p-8">
          <div className="flex items-start justify-between gap-6 mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#5B45FF]">Template builder</p>
              <h3 className="text-3xl font-black tracking-tight mt-2">Create a New Template</h3>
              <p className={cn("mt-2 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
                Build a polished campaign template with structured content, rich guidance, and action-focused buttons.
              </p>
            </div>
            <button type="button" onClick={onClose} className={cn("px-4 py-2 rounded-xl text-sm font-bold shrink-0", isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700")}>
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 md:col-span-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Template Name</label>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(sanitizeTemplateName(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === ' ') {
                    e.preventDefault();
                    setTemplateName(prev => sanitizeTemplateName(`${prev}_`));
                  }
                }}
                placeholder="summer_sale_launch"
                className={cn("w-full p-4 rounded-2xl outline-none border focus:border-[#5B45FF] transition-all", isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200")}
                required
              />
              <p className="text-xs text-gray-500">Spaces are automatically converted to underscores.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={cn("w-full p-4 rounded-2xl outline-none border focus:border-[#5B45FF] transition-all", isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200")}>
                {TEMPLATE_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={cn("w-full p-4 rounded-2xl outline-none border focus:border-[#5B45FF] transition-all", isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200")}>
                {TEMPLATE_LANGUAGES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={cn("rounded-3xl p-6 border", isDark ? "bg-gray-800/30 border-gray-700" : "bg-gray-50 border-gray-200")}>
            <h4 className="text-xl font-bold">Campaign Title Selection</h4>
            <p className={cn("text-sm mt-1 mb-5", isDark ? "text-gray-400" : "text-gray-600")}>
              Highlight your brand here, use images or videos, to stand out
            </p>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              {(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setHeaderType(type)}
                  className={cn(
                    "px-4 py-3 rounded-2xl border text-sm font-bold transition-all",
                    headerType === type
                      ? "bg-[#5B45FF] text-white border-[#5B45FF]"
                      : (isDark ? "border-gray-700 text-gray-300 hover:border-[#5B45FF]" : "border-gray-200 text-gray-700 hover:border-[#5B45FF]")
                  )}
                >
                  {type === 'NONE' ? 'None' : type[0] + type.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {headerType === 'TEXT' && (
              <input
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Enter your campaign title"
                className={cn("w-full p-4 rounded-2xl outline-none border focus:border-[#5B45FF] transition-all", isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}
              />
            )}

            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
              <input
                value={headerMediaSample}
                onChange={(e) => setHeaderMediaSample(e.target.value)}
                placeholder="Optional media sample URL or handle for approval"
                className={cn("w-full p-4 rounded-2xl outline-none border focus:border-[#5B45FF] transition-all", isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}
              />
            )}
          </div>

          <div className={cn("rounded-3xl p-6 border", isDark ? "bg-gray-800/30 border-gray-700" : "bg-gray-50 border-gray-200")}>
            <h4 className="text-xl font-bold">Body</h4>
            <p className={cn("text-sm mt-1 mb-5", isDark ? "text-gray-400" : "text-gray-600")}>
              Make your messages personal using variables like {'{{name}}'} and get more replies!
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              <button type="button" onClick={insertEmoji} className={cn("px-3 py-2 rounded-xl text-sm font-bold", isDark ? "bg-gray-800 text-gray-200" : "bg-white border border-gray-200 text-gray-700")}>Emoji</button>
              <button type="button" onClick={() => insertIntoBody('*', '*')} className={cn("px-3 py-2 rounded-xl text-sm font-bold", isDark ? "bg-gray-800 text-gray-200" : "bg-white border border-gray-200 text-gray-700")}>Bold</button>
              <button type="button" onClick={() => insertIntoBody('_', '_')} className={cn("px-3 py-2 rounded-xl text-sm font-bold", isDark ? "bg-gray-800 text-gray-200" : "bg-white border border-gray-200 text-gray-700")}>Italics</button>
              <button type="button" onClick={() => insertIntoBody('<u>', '</u>')} className={cn("px-3 py-2 rounded-xl text-sm font-bold", isDark ? "bg-gray-800 text-gray-200" : "bg-white border border-gray-200 text-gray-700")}>Underline</button>
              <button type="button" onClick={() => insertIntoBody('~', '~')} className={cn("px-3 py-2 rounded-xl text-sm font-bold", isDark ? "bg-gray-800 text-gray-200" : "bg-white border border-gray-200 text-gray-700")}>Strikethrough</button>
              <button type="button" onClick={insertVariable} className="px-3 py-2 rounded-xl text-sm font-bold bg-[#5B45FF] text-white">Add Variable</button>
            </div>

            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the message body here..."
              className={cn("w-full p-4 rounded-2xl outline-none border h-40 focus:border-[#5B45FF] transition-all", isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}
              required
            />
          </div>

          <div className={cn("rounded-3xl p-6 border", isDark ? "bg-gray-800/30 border-gray-700" : "bg-gray-50 border-gray-200")}>
            <h4 className="text-xl font-bold">Footer (optional)</h4>
            <p className={cn("text-sm mt-1 mb-5", isDark ? "text-gray-400" : "text-gray-600")}>
              Footers are great to add any disclaimers or to add a thoughtful PS
            </p>
            <input
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Footer Field"
              className={cn("w-full p-4 rounded-2xl outline-none border focus:border-[#5B45FF] transition-all", isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}
            />
          </div>

          <div className={cn("rounded-3xl p-6 border", isDark ? "bg-gray-800/30 border-gray-700" : "bg-gray-50 border-gray-200")}>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-xl font-bold">Buttons</h4>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#5B45FF]/10 text-[#5B45FF] uppercase tracking-wider">Recommended</span>
            </div>
            <p className={cn("text-sm mt-1 mb-5", isDark ? "text-gray-400" : "text-gray-600")}>
              Insert buttons so your customers can take action and engage with your message!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <h5 className="font-bold">Visit Website</h5>
                <input
                  value={websiteButtonText}
                  onChange={(e) => setWebsiteButtonText(e.target.value)}
                  placeholder="Button label"
                  className={cn("w-full p-4 rounded-2xl outline-none border focus:border-[#5B45FF] transition-all", isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}
                />
                <input
                  value={websiteButtonUrl}
                  onChange={(e) => setWebsiteButtonUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className={cn("w-full p-4 rounded-2xl outline-none border focus:border-[#5B45FF] transition-all", isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold">Quick Replied</h5>
                  <button type="button" onClick={addQuickReply} disabled={quickReplies.length >= 3} className="text-sm font-bold text-[#5B45FF] disabled:opacity-40">+ Add</button>
                </div>
                {quickReplies.map((reply, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      value={reply}
                      onChange={(e) => updateQuickReply(index, e.target.value)}
                      placeholder={`Quick reply ${index + 1}`}
                      className={cn("flex-1 p-4 rounded-2xl outline-none border focus:border-[#5B45FF] transition-all", isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}
                    />
                    {quickReplies.length > 1 && (
                      <button type="button" onClick={() => removeQuickReply(index)} className="px-4 rounded-2xl text-sm font-bold text-red-500 bg-red-500/10">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

            <div className="flex justify-end gap-4">
              <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-gray-500">Cancel</button>
              <button type="submit" disabled={submitting || !templateName || !body.trim()} className="px-6 py-3 rounded-xl font-bold bg-[#5B45FF] text-white shadow-lg shadow-[#5B45FF]/20 disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function BroadcastSection({ isDark, templates, broadcasts, contacts, isCreateTemplateModalOpen, setIsCreateTemplateModalOpen }: { isDark: boolean, templates: any[], broadcasts: any[], contacts: any[], isCreateTemplateModalOpen: boolean, setIsCreateTemplateModalOpen: (open: boolean) => void }) {
  const [tab, setTab] = useState<'new' | 'history' | 'templates'>('new');
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [audienceMode, setAudienceMode] = useState<'csv' | 'contacts'>('csv');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [launchingBroadcast, setLaunchingBroadcast] = useState(false);

  const approvedTemplates = useMemo(
    () => templates.filter((template) => template.status === 'APPROVED'),
    [templates]
  );

  const selectedTemplate = useMemo(
    () => approvedTemplates.find((template) => template.name === selectedTemplateName) || null,
    [approvedTemplates, selectedTemplateName]
  );

  const templateBody = selectedTemplate?.components?.find((component: any) => component.type === 'BODY')?.text || 'Your approved template preview will appear here.';
  const templateFooter = selectedTemplate?.components?.find((component: any) => component.type === 'FOOTER')?.text || '';
  const templateHeader = selectedTemplate?.components?.find((component: any) => component.type === 'HEADER');
  const templateButtons = selectedTemplate?.components?.find((component: any) => component.type === 'BUTTONS')?.buttons || [];

  const selectedContacts = contacts.filter((contact) => {
    const id = contact.id || contact.whatsappNumber || contact.phone;
    return selectedContactIds.includes(id);
  });

  const audienceSummary = audienceMode === 'csv'
    ? (csvFileName ? `CSV ready: ${csvFileName}` : 'Waiting for your CSV upload')
    : `${selectedContacts.length} contact${selectedContacts.length === 1 ? '' : 's'} selected`;

  const downloadSampleCsv = () => {
    const sampleCsv = Papa.unparse([
      { Name: 'Aarav Sharma', Phone: '+919876543210' },
      { Name: 'Sophia Carter', Phone: '+14155552671' }
    ]);
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'WhatsApp Business-broadcast-sample.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleContact = (contact: any) => {
    const id = contact.id || contact.whatsappNumber || contact.phone;
    setSelectedContactIds((prev) => prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]);
  };

  const parseCsvRecipients = async (file: File) => {
    return new Promise<Array<{ name: string; phone: string }>>((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = Array.isArray(results.data) ? results.data : [];
          const recipients = rows
            .map((row) => {
              const name = row.Name || row.name || row.fullName || row.FullName || row.full_name || '';
              const rawPhone =
                row.Phone ||
                row.phone ||
                row.whatsappNumber ||
                row.WhatsApp ||
                row.whatsapp ||
                row.phone_number ||
                '';
              return {
                name: String(name).trim(),
                phone: String(rawPhone).replace(/\D/g, '')
              };
            })
            .filter((recipient) => recipient.phone);

          resolve(recipients);
        },
        error: (error) => reject(error)
      });
    });
  };

  const resetBroadcastBuilder = () => {
    setCampaignName('');
    setSelectedTemplateName('');
    setAudienceMode('csv');
    setSelectedContactIds([]);
    setSendMode('now');
    setScheduledDate('');
    setScheduledTime('');
    setCsvFileName('');
    setCsvFile(null);
  };

  const handleLaunchBroadcast = async () => {
    if (!auth.currentUser) {
      showAppDialog({ tone: 'error', message: 'You need to be signed in to launch a broadcast.' });
      return;
    }

    if (!campaignName.trim()) {
      showAppDialog({ tone: 'warning', message: 'Add a campaign name before launching the broadcast.' });
      return;
    }

    if (!selectedTemplate) {
      showAppDialog({ tone: 'warning', message: 'Choose an approved template before launching the broadcast.' });
      return;
    }

    if (sendMode === 'schedule' && (!scheduledDate || !scheduledTime)) {
      showAppDialog({ tone: 'warning', message: 'Choose both a scheduled date and time.' });
      return;
    }

    setLaunchingBroadcast(true);

    try {
      let recipients: Array<{ name: string; phone: string }> = [];

      if (audienceMode === 'contacts') {
        recipients = selectedContacts
          .map((contact) => ({
            name: contact.fullName || contact.name || '',
            phone: String(contact.whatsappNumber || contact.phone || '').replace(/\D/g, '')
          }))
          .filter((recipient) => recipient.phone);
      } else {
        if (!csvFile) {
          showAppDialog({ tone: 'warning', message: 'Upload a CSV file before launching the broadcast.' });
          return;
        }
        recipients = await parseCsvRecipients(csvFile);
      }

      const dedupedRecipients = Array.from(
        new Map(recipients.map((recipient) => [recipient.phone, recipient])).values()
      );

      if (!dedupedRecipients.length) {
        showAppDialog({ tone: 'warning', message: 'No valid recipient phone numbers were found for this broadcast.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const scheduledAt = sendMode === 'schedule'
        ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
        : undefined;

      const broadcastRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'broadcasts'), {
        name: campaignName.trim(),
        templateName: selectedTemplate.name,
        status: sendMode === 'schedule' ? 'Pending' : 'Processing',
        totalContacts: dedupedRecipients.length,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        repliedCount: 0,
        createdAt: nowIso,
        scheduledAt: scheduledAt || null,
        audienceMode,
        audienceSummary: audienceMode === 'csv' ? csvFileName : `${dedupedRecipients.length} contacts selected`
      });

      if (sendMode === 'schedule') {
        showAppDialog({
          tone: 'success',
          message: `Broadcast scheduled for ${scheduledDate} at ${scheduledTime}. It has been saved to history as pending.`
        });
        resetBroadcastBuilder();
        setTab('history');
        return;
      }

      let sentCount = 0;
      let failedCount = 0;
      const languageCode = selectedTemplate.language || 'en_US';
      const templatePreview = buildTemplatePreview(selectedTemplate);

      for (const recipient of dedupedRecipients) {
        const result = await whatsappService.sendTemplateMessage(recipient.phone, selectedTemplate.name, languageCode);
        if (result.success) {
          sentCount += 1;
          const sentMsg = {
            from: 'Broadcast',
            to: recipient.phone,
            text: getTemplatePreviewSummary(selectedTemplate.name, templatePreview),
            templateName: selectedTemplate.name,
            campaignName: campaignName.trim(),
            templatePreview,
            type: 'template',
            timestamp: Date.now(),
            direction: 'outbound',
            status: 'SENT',
            whatsappId: result.data?.messages?.[0]?.id,
            broadcastId: broadcastRef.id
          };

          try {
            await saveMessageRecord(auth.currentUser.uid, sentMsg);
          } catch (messageWriteError) {
            console.error(`Broadcast message log write failed for ${recipient.phone}:`, messageWriteError);
          }
        } else {
          failedCount += 1;
          const failedMsg = {
            from: 'Broadcast',
            to: recipient.phone,
            text: getTemplatePreviewSummary(selectedTemplate.name, templatePreview),
            templateName: selectedTemplate.name,
            campaignName: campaignName.trim(),
            templatePreview,
            type: 'template',
            timestamp: Date.now(),
            direction: 'outbound',
            status: 'FAILED',
            failedReason: result.error || 'Failed to send template.',
            broadcastId: broadcastRef.id
          };

          try {
            await saveMessageRecord(auth.currentUser.uid, failedMsg);
          } catch (messageWriteError) {
            console.error(`Broadcast failed message log write failed for ${recipient.phone}:`, messageWriteError);
          }
        }
      }

      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'broadcasts', broadcastRef.id), {
        status: sentCount > 0 ? 'Completed' : 'Failed',
        sentCount,
        deliveredCount: sentCount,
        readCount: 0,
        repliedCount: 0,
        updatedAt: new Date().toISOString(),
        failedCount
      });

      showAppDialog({
        tone: sentCount > 0 ? 'success' : 'error',
        message: sentCount > 0
          ? `Broadcast launched. ${sentCount} of ${dedupedRecipients.length} messages were sent successfully.`
          : 'Broadcast launch failed for all recipients. Please verify your template and WhatsApp configuration.'
      });

      resetBroadcastBuilder();
      setTab('history');
    } catch (error) {
      console.error('Failed to launch broadcast:', error);
      showAppDialog({ tone: 'error', message: 'Unable to launch the broadcast right now.' });
    } finally {
      setLaunchingBroadcast(false);
    }
  };

  return (
    <motion.div
      key="broadcast"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className={cn(
        "inline-flex w-fit flex-wrap gap-2 rounded-[1.4rem] border p-2 backdrop-blur-xl",
        isDark ? "border-[#5B45FF]/10 bg-[#5B45FF]/8 shadow-[0_18px_50px_rgba(91,69,255,0.08)]" : "border-[#5B45FF] bg-white/85 shadow-[0_18px_50px_rgba(91,69,255,0.12)]"
      )}>
        {[
          { key: 'new', label: 'New Broadcast' },
          { key: 'history', label: 'Past Campaigns' }
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key as 'new' | 'history')}
            className={cn(
              "rounded-xl px-6 py-3 text-sm font-bold transition-all",
              tab === item.key
                ? "bg-[#5B45FF] text-white shadow-lg shadow-[#5B45FF]/25"
                : (isDark ? "text-slate-300 hover:bg-white/6" : "text-slate-600 hover:bg-[#5B45FF] hover:text-white")
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
          <div className="space-y-6">
            <div className={cn(
              "rounded-[2rem] border p-7 md:p-8",
              isDark ? "border-gray-800 bg-[#111827]" : "border-white/80 bg-white/92 shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
            )}>
              <div className="mb-8">
                <h3 className="text-2xl font-black tracking-tight">What message do you want to send?</h3>
                <p className={cn("mt-2 text-sm font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                  Build the campaign, choose the audience, and decide the send time from one cleaner flow.
                </p>
              </div>

              <div className="space-y-6">
                <section className={cn(
                  "rounded-[1.7rem] border p-6",
                  isDark ? "border-gray-800 bg-slate-900/40" : "border-slate-200 bg-slate-50/85"
                )}>
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-600">Section 1</p>
                    <h4 className="mt-2 text-xl font-bold tracking-tight">What message do you want to send?</h4>
                    <p className={cn("mt-1 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                      Add campaign name and template below
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Campaign Name</label>
                      <input
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="e.g. April launch follow-up"
                        className={cn(
                          "w-full rounded-2xl border px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]",
                          isDark ? "border-gray-700 bg-gray-800 text-white" : "border-slate-200 bg-white text-slate-900"
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Select Template Message</label>
                      <select
                        value={selectedTemplateName}
                        onChange={(e) => setSelectedTemplateName(e.target.value)}
                        className={cn(
                          "w-full rounded-2xl border px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]",
                          isDark ? "border-gray-700 bg-gray-800 text-white" : "border-slate-200 bg-white text-slate-900"
                        )}
                      >
                        <option value="">Choose an approved template</option>
                        {approvedTemplates.map((template) => (
                          <option key={template.id || template.name} value={template.name}>{template.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className={cn(
                  "rounded-[1.7rem] border p-6",
                  isDark ? "border-gray-800 bg-slate-900/40" : "border-slate-200 bg-slate-50/85"
                )}>
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-600">Section 2</p>
                    <h4 className="mt-2 text-xl font-bold tracking-tight">Who is your audience?</h4>
                    <p className={cn("mt-1 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                      Choose from pre-built segments, imported contacts, or manual selection
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setAudienceMode('csv')}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-all",
                        audienceMode === 'csv'
                          ? "border-[#5B45FF] bg-[#5B45FF]/10"
                          : (isDark ? "border-gray-700 bg-gray-800/60 hover:border-gray-600" : "border-slate-200 bg-white hover:border-slate-300")
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <FileUp className="text-[#5B45FF]" size={18} />
                        <div>
                          <p className="font-bold">Import Contacts via CSV</p>
                          <p className="mt-1 text-xs text-slate-500">Upload your file or start from a sample sheet.</p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudienceMode('contacts')}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-all",
                        audienceMode === 'contacts'
                          ? "border-[#5B45FF] bg-[#5B45FF]/10"
                          : (isDark ? "border-gray-700 bg-gray-800/60 hover:border-gray-600" : "border-slate-200 bg-white hover:border-slate-300")
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="text-cyan-500" size={18} />
                        <div>
                          <p className="font-bold">Select from the List of Contacts</p>
                          <p className="mt-1 text-xs text-slate-500">Pick exactly who should receive this campaign.</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {audienceMode === 'csv' ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <label className={cn(
                        "flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed px-5 py-8 text-center transition-all",
                        isDark ? "border-gray-700 bg-gray-800/40 hover:border-[#5B45FF]" : "border-slate-300 bg-white hover:border-[#5B45FF]"
                      )}>
                        <FileUp className="text-[#5B45FF]" size={22} />
                        <div>
                          <p className="font-bold">Upload CSV</p>
                          <p className="mt-1 text-xs text-slate-500">{csvFileName || 'Choose your contact file'}</p>
                        </div>
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setCsvFile(file);
                            setCsvFileName(file?.name || '');
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={downloadSampleCsv}
                        className={cn(
                          "flex items-center justify-center gap-3 rounded-2xl border px-5 py-8 font-bold transition-all",
                          isDark ? "border-gray-700 bg-gray-800/40 hover:border-cyan-500" : "border-slate-200 bg-white hover:border-cyan-400"
                        )}
                      >
                        <Download size={20} className="text-cyan-500" />
                        Download Sample CSV
                      </button>
                    </div>
                  ) : (
                    <div className={cn(
                      "mt-5 max-h-72 space-y-3 overflow-y-auto rounded-2xl border p-3",
                      isDark ? "border-gray-700 bg-gray-800/40" : "border-slate-200 bg-white"
                    )}>
                      {contacts.length === 0 && (
                        <p className="px-3 py-8 text-center text-sm text-slate-500">No contacts available yet. Import or add contacts first.</p>
                      )}
                      {contacts.map((contact, index) => {
                        const id = contact.id || contact.whatsappNumber || contact.phone || `contact-${index}`;
                        const isSelected = selectedContactIds.includes(id);
                        return (
                          <button
                            type="button"
                            key={id}
                            onClick={() => toggleContact(contact)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all",
                              isSelected
                                ? "border-[#5B45FF] bg-[#5B45FF]/10"
                                : (isDark ? "border-gray-700 bg-slate-900/40 hover:border-gray-600" : "border-slate-200 bg-slate-50 hover:border-slate-300")
                            )}
                          >
                            <div>
                              <p className="font-semibold">{contact.fullName || contact.name || 'Unnamed Contact'}</p>
                              <p className="mt-1 text-xs text-slate-500">{contact.whatsappNumber || contact.phone || 'No number available'}</p>
                            </div>
                            <div className={cn(
                              "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]",
                              isSelected ? "bg-[#5B45FF] text-white" : (isDark ? "bg-gray-800 text-slate-400" : "bg-white text-slate-500")
                            )}>
                              {isSelected ? 'Selected' : 'Select'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className={cn(
                  "rounded-[1.7rem] border p-6",
                  isDark ? "border-gray-800 bg-slate-900/40" : "border-slate-200 bg-slate-50/85"
                )}>
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-600">Section 3</p>
                    <h4 className="mt-2 text-xl font-bold tracking-tight">When do you want to send it?</h4>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setSendMode('now')}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-all",
                        sendMode === 'now'
                          ? "border-[#5B45FF] bg-[#5B45FF]/10"
                          : (isDark ? "border-gray-700 bg-gray-800/60 hover:border-gray-600" : "border-slate-200 bg-white hover:border-slate-300")
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Send className="text-[#5B45FF]" size={18} />
                        <div>
                          <p className="font-bold">Send now</p>
                          <p className="mt-1 text-xs text-slate-500">Launch this campaign as soon as you are ready.</p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSendMode('schedule')}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-all",
                        sendMode === 'schedule'
                          ? "border-[#5B45FF] bg-[#5B45FF]/10"
                          : (isDark ? "border-gray-700 bg-gray-800/60 hover:border-gray-600" : "border-slate-200 bg-white hover:border-slate-300")
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="text-cyan-500" size={18} />
                        <div>
                          <p className="font-bold">Schedule it</p>
                          <p className="mt-1 text-xs text-slate-500">Pick the exact date and time for delivery.</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {sendMode === 'schedule' && (
                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Calendar</label>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className={cn(
                            "w-full rounded-2xl border px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]",
                            isDark ? "border-gray-700 bg-gray-800 text-white" : "border-slate-200 bg-white text-slate-900"
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Time</label>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className={cn(
                            "w-full rounded-2xl border px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]",
                            isDark ? "border-gray-700 bg-gray-800 text-white" : "border-slate-200 bg-white text-slate-900"
                          )}
                        />
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-500">
                  {sendMode === 'schedule' && scheduledDate && scheduledTime
                    ? `Scheduled for ${scheduledDate} at ${scheduledTime}`
                    : 'Your campaign is ready for a final review.'}
                </div>
                <button
                  type="button"
                  onClick={handleLaunchBroadcast}
                  disabled={launchingBroadcast}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B45FF] px-6 py-4 font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#5B45FF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={18} />
                  {launchingBroadcast ? 'Launching...' : 'Launch Broadcast'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={cn(
              "sticky top-6 rounded-[2rem] border p-6",
              isDark ? "border-gray-800 bg-[#111827]" : "border-white/80 bg-white/94 shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
            )}>
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-600">Live Preview</p>
                <h4 className="mt-2 text-xl font-bold tracking-tight">How your broadcast will look</h4>
                <p className="mt-1 text-sm text-slate-500">{audienceSummary}</p>
              </div>

              <div className={cn(
                "rounded-[1.8rem] p-4",
                isDark ? "bg-slate-950/70" : "bg-slate-100"
              )}>
                <div className={cn(
                  "mx-auto max-w-sm rounded-[1.8rem] border p-4 shadow-xl",
                  isDark ? "border-gray-800 bg-[#111b21]" : "border-white/80 bg-white"
                )}>
                  <div className="flex items-center gap-3 border-b border-slate-200/70 pb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5B45FF] text-white">
                      <WabaIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">WhatsApp Business Inbox</p>
                      <p className="text-xs text-slate-500">
                        {sendMode === 'schedule' && scheduledDate && scheduledTime
                          ? `Scheduled • ${scheduledDate} ${scheduledTime}`
                          : 'Ready to send'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4 rounded-[1.4rem] bg-[#F1EFFF] p-4 text-slate-900">
                    {templateHeader && (
                      <div className="rounded-2xl bg-white/70 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                        {templateHeader.format === 'TEXT'
                          ? templateHeader.text || 'Header text'
                          : templateHeader.format || 'Media header'}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-500">Campaign</p>
                      <p className="mt-1 text-base font-bold">{campaignName || 'Campaign name will appear here'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-500">Template</p>
                      <p className="mt-1 text-sm font-bold">{selectedTemplateName || 'Choose an approved template'}</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 p-3 text-sm leading-6">
                      {templateBody}
                    </div>
                    {templateFooter && (
                      <p className="text-xs font-medium text-slate-500">{templateFooter}</p>
                    )}
                    {templateButtons.length > 0 && (
                      <div className="space-y-2">
                        {templateButtons.slice(0, 3).map((button: any, index: number) => (
                          <div key={`${button.text || button.type}-${index}`} className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-center text-sm font-bold text-cyan-700">
                            {button.text || button.type}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-[1.2rem] border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">
                    Audience: {audienceMode === 'csv' ? (csvFileName || 'CSV import not selected yet') : `${selectedContacts.length} contacts selected`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className={cn("rounded-3xl p-8 border", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
          <h3 className="text-xl font-bold mb-6">Past Campaigns</h3>
          {broadcasts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No past campaigns found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={cn("border-b", isDark ? "border-gray-800" : "border-gray-200")}>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Campaign Name</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Template</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Status</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Sent</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Delivered</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Read</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.map((b, idx) => (
                    <tr key={b.id || `bc-${idx}`} className={cn("border-b last:border-0 transition-colors", isDark ? "border-gray-800 hover:bg-gray-800/30" : "border-gray-100 hover:bg-gray-50")}>
                      <td className="py-4 px-4 font-medium">{b.name}</td>
                      <td className="py-4 px-4 text-sm">{b.templateName}</td>
                      <td className="py-4 px-4">
                        <span className={cn("px-3 py-1 rounded-full text-xs font-bold", 
                          b.status?.toLowerCase() === 'completed' ? "bg-[#5B45FF]/10 text-[#5B45FF]" : 
                          b.status?.toLowerCase() === 'processing' ? "bg-blue-500/10 text-blue-500" : 
                          "bg-gray-500/10 text-gray-500"
                        )}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm">{b.sentCount}</td>
                      <td className="py-4 px-4 text-sm">{b.deliveredCount}</td>
                      <td className="py-4 px-4 text-sm">{b.readCount}</td>
                      <td className="py-4 px-4 text-sm text-gray-400">{new Date(b.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'templates' && (
        <div className={cn("rounded-3xl p-8 border", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold">Message Templates</h3>
              <span className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                isDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600"
              )}>
                {templates.length} {templates.length === 1 ? 'template' : 'templates'}
              </span>
            </div>
            <button 
              onClick={() => setIsCreateTemplateModalOpen(true)}
              className="bg-[#5B45FF] hover:bg-[#5B45FF] text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              <Plus size={16} />
              Create New Template
            </button>
          </div>
          
          {templates.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No templates found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((t, idx) => (
                <div key={t.id || `tpl-${idx}`} className={cn("p-6 rounded-2xl border flex flex-col", isDark ? "bg-gray-800/30 border-gray-700" : "bg-gray-50 border-gray-200")}>
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-lg truncate pr-2">{t.name}</h4>
                    <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0", 
                      t.status === 'APPROVED' ? "bg-[#5B45FF]/10 text-[#5B45FF]" : 
                      t.status === 'REJECTED' ? "bg-red-500/10 text-red-500" : 
                      "bg-yellow-500/10 text-yellow-500"
                    )}>
                      {t.status}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">{t.category} • {t.language}</p>
                    <div className={cn("p-3 rounded-xl text-sm mt-4", isDark ? "bg-gray-800" : "bg-white border")}>
                      {/* Preview body text if available, else placeholder */}
                      {t.components?.find((c: any) => c.type === 'BODY')?.text || "Template content preview not available."}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isCreateTemplateModalOpen && <CreateTemplateModal isDark={isDark} onClose={() => setIsCreateTemplateModalOpen(false)} />}
    </motion.div>
  );
}

function TemplatesSection({ isDark, templates, isCreateTemplateModalOpen, setIsCreateTemplateModalOpen }: { isDark: boolean, templates: any[], isCreateTemplateModalOpen: boolean, setIsCreateTemplateModalOpen: (open: boolean) => void }) {
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const sortedTemplates = useMemo(() => [...templates].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))), [templates]);

  return (
    <motion.div
      key="templates"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className={cn("rounded-3xl p-8 border", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold">Message Templates</h3>
            <span className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              isDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600"
            )}>
              {templates.length} {templates.length === 1 ? 'template' : 'templates'}
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className={cn(
              "inline-flex w-fit gap-2 rounded-2xl border p-1.5",
              isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
            )}>
              {[
                { key: 'cards', label: 'Card Containers' },
                { key: 'list', label: 'List' }
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setViewMode(option.key as 'cards' | 'list')}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-bold transition-all",
                    viewMode === option.key
                      ? "bg-[#5B45FF] text-white shadow-lg shadow-[#5B45FF]/25"
                      : (isDark ? "text-slate-300 hover:bg-white/6" : "text-slate-600 hover:bg-white")
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsCreateTemplateModalOpen(true)}
              className="bg-[#5B45FF] hover:bg-[#5B45FF] text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              <Plus size={16} />
              Create New Template
            </button>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>No templates found.</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedTemplates.map((t, idx) => (
              <div key={t.id || `tpl-${idx}`} className={cn("p-6 rounded-2xl border flex flex-col", isDark ? "bg-gray-800/30 border-gray-700" : "bg-gray-50 border-gray-200")}>
                <div className="flex justify-between items-start mb-4 gap-3">
                  <h4 className="font-bold text-lg truncate pr-2">{t.name}</h4>
                  <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0",
                    t.status === 'APPROVED' ? "bg-[#5B45FF]/10 text-[#5B45FF]" :
                    t.status === 'REJECTED' ? "bg-red-500/10 text-red-500" :
                    "bg-yellow-500/10 text-yellow-500"
                  )}>
                    {t.status}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">{t.category} • {t.language}</p>
                  <div className={cn("p-3 rounded-xl text-sm mt-4", isDark ? "bg-gray-800" : "bg-white border")}>
                    {t.components?.find((c: any) => c.type === 'BODY')?.text || "Template content preview not available."}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn("overflow-hidden rounded-3xl border", isDark ? "border-gray-800" : "border-slate-200")}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={cn("border-b", isDark ? "border-gray-800 bg-white/5" : "border-gray-200 bg-slate-50")}>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Template</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Status</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Category</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Language</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-400 uppercase">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTemplates.map((t, idx) => (
                    <tr key={t.id || `tpl-list-${idx}`} className={cn("border-b last:border-0 align-top", isDark ? "border-gray-800 hover:bg-white/5" : "border-gray-100 hover:bg-gray-50")}>
                      <td className="py-4 px-4 font-semibold">{t.name}</td>
                      <td className="py-4 px-4">
                        <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          t.status === 'APPROVED' ? "bg-[#5B45FF]/10 text-[#5B45FF]" :
                          t.status === 'REJECTED' ? "bg-red-500/10 text-red-500" :
                          "bg-yellow-500/10 text-yellow-500"
                        )}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm">{t.category || 'Template'}</td>
                      <td className="py-4 px-4 text-sm">{t.language || 'en_US'}</td>
                      <td className="py-4 px-4 text-sm text-slate-500 max-w-xl">
                        {t.components?.find((c: any) => c.type === 'BODY')?.text || "Template content preview not available."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isCreateTemplateModalOpen && <CreateTemplateModal isDark={isDark} onClose={() => setIsCreateTemplateModalOpen(false)} />}
    </motion.div>
  );
}

function ContactsSection({ isDark, contacts }: { isDark: boolean, contacts: any[] }) {
  const [syncedContacts, setSyncedContacts] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [contactAvatarFile, setContactAvatarFile] = useState<File | null>(null);
  const [contactAvatarPreview, setContactAvatarPreview] = useState('');
  const [customParams, setCustomParams] = useState<{name: string, value: string}[]>([]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) {
      setSyncedContacts([]);
      return;
    }

    const contactsQuery = query(
      collection(db, 'users', auth.currentUser.uid, 'contacts'),
      orderBy('fullName', 'asc')
    );

    const unsubscribe = onSnapshot(contactsQuery, (snapshot) => {
      setSyncedContacts(snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser.uid}/contacts`);
      setSyncedContacts([]);
    });

    return () => unsubscribe();
  }, [contacts]);

  const displayContacts = syncedContacts;

  const resetContactForm = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedContact(null);
    setNewContactName('');
    setNewContactPhone('');
    setContactAvatarFile(null);
    setContactAvatarPreview('');
    setCustomParams([]);
  };

  const handleContactAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!CONTACT_AVATAR_EXTENSIONS[file.type]) {
      showAppDialog({ tone: 'warning', message: 'Please choose a JPG, PNG, or WebP image for the contact picture.' });
      return;
    }

    if (file.size > MAX_CONTACT_AVATAR_BYTES) {
      showAppDialog({ tone: 'warning', message: 'Please choose an image smaller than 5 MB.' });
      return;
    }

    setContactAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setContactAvatarPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const uploadContactAvatar = async (contactId: string) => {
    if (!contactAvatarFile || !auth.currentUser) {
      return '';
    }

    const extension = CONTACT_AVATAR_EXTENSIONS[contactAvatarFile.type] || 'jpg';
    const avatarRef = storageRef(
      storage,
      `users/${auth.currentUser.uid}/contacts/${contactId}/profile-picture-${Date.now()}.${extension}`
    );

    await uploadBytes(avatarRef, contactAvatarFile, {
      contentType: contactAvatarFile.type || 'image/jpeg'
    });
    return getDownloadURL(avatarRef);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && auth.currentUser) {
      const userId = auth.currentUser.uid;
      Papa.parse(file, {
        header: true,
        complete: async (results) => {
          const data = results.data as any[];
          let successCount = 0;
          for (const row of data) {
            const name = row.Name || row.fullName || row.name;
            const phone = row.Phone || row.whatsappNumber || row.phone;
            const avatarUrl = row.Avatar || row.AvatarUrl || row.avatarUrl || row.Photo || row.photo || '';
            if (name && phone) {
              try {
                await addDoc(collection(db, 'users', userId, 'contacts'), {
                  fullName: name,
                  whatsappNumber: String(phone).replace(/\D/g, ''),
                  phone: String(phone).replace(/\D/g, ''),
                  ...(String(avatarUrl).startsWith('http') ? { avatarUrl: String(avatarUrl) } : {}),
                  createdAt: new Date().toISOString(),
                  tags: row.Tags ? row.Tags.split(',').map((t: string) => t.trim()) : [],
                  notes: row.Notes || ''
                });
                successCount++;
              } catch (err) {
                console.error('Error adding contact from CSV:', err);
              }
            }
          }
          showAppDialog({ tone: 'success', message: `Successfully imported ${successCount} contacts.` });
        }
      });
    }
  };

  const handleAddContact = async () => {
    if (!newContactName || !newContactPhone || !auth.currentUser) {
      showAppDialog({ tone: 'warning', message: 'Please enter a name and WhatsApp number.' });
      return;
    }
    setIsAdding(true);
    try {
      const paramsObj: any = {};
      customParams.forEach(p => {
        if (p.name) paramsObj[p.name] = p.value;
      });

      const normalizedPhone = newContactPhone.replace(/\D/g, '');
      if (!normalizedPhone) {
        showAppDialog({ tone: 'warning', message: 'Please enter a valid WhatsApp number.' });
        return;
      }

      const contactDocRef = doc(collection(db, 'users', auth.currentUser.uid, 'contacts'));
      const avatarUrl = await uploadContactAvatar(contactDocRef.id);
      await setDoc(contactDocRef, {
        fullName: newContactName.trim(),
        whatsappNumber: normalizedPhone,
        phone: normalizedPhone,
        customParams: paramsObj,
        ...(avatarUrl ? { avatarUrl } : {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        notes: ''
      });
      const savedSnapshot = await getDoc(contactDocRef);

      console.log('Contact saved to Firestore:', contactDocRef.id);
      console.log('Contact Firestore path:', contactDocRef.path);
      console.log('Contact projectId:', contactDocRef.firestore.app.options.projectId);
      console.log('Contact read-back exists:', savedSnapshot.exists(), savedSnapshot.data());
      
      resetContactForm();
    } catch (error) {
      console.error(error);
      showAppDialog({ tone: 'error', message: 'An error occurred while adding the contact.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditContact = async () => {
    if (!selectedContact || !newContactPhone || !auth.currentUser) return;
    setIsAdding(true);
    try {
      const paramsObj: any = {};
      customParams.forEach(p => {
        if (p.name) paramsObj[p.name] = p.value;
      });

      const avatarUrl = await uploadContactAvatar(selectedContact.id);
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'contacts', selectedContact.id), {
        fullName: newContactName,
        whatsappNumber: newContactPhone.replace(/\D/g, ''),
        customParams: paramsObj,
        ...(avatarUrl ? { avatarUrl } : {}),
        updatedAt: new Date().toISOString()
      });

      resetContactForm();
    } catch (error) {
      console.error(error);
      showAppDialog({ tone: 'error', message: 'An error occurred while updating the contact.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteContact = async (contact: any) => {
    const confirmed = await showAppConfirm({
      title: 'Delete Contact',
      message: 'Are you sure you want to delete this contact?',
      tone: 'warning',
      confirmLabel: 'Delete'
    });
    if (!confirmed || !auth.currentUser) return;

    const directId = typeof contact?.id === 'string' && contact.id && !String(contact.id).startsWith('live_')
      ? contact.id
      : null;
    const contactPhone = String(contact?.whatsappNumber || contact?.phone || '').replace(/\D/g, '');
    const deleteKey = directId || contactPhone;
    if (!deleteKey) {
      showAppDialog({ tone: 'error', message: 'Unable to identify this contact for deletion.' });
      return;
    }

    setIsDeleting(deleteKey);
    try {
      if (directId) {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'contacts', directId));
      } else {
        const contactQuery = await getDocs(query(
          collection(db, 'users', auth.currentUser.uid, 'contacts'),
          where('whatsappNumber', '==', contactPhone),
          limit(1)
        ));

        if (contactQuery.empty) {
          showAppDialog({ tone: 'error', message: 'Contact record was not found in Firestore.' });
          return;
        }

        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'contacts', contactQuery.docs[0].id));
      }
    } catch (error) {
      console.error(error);
      showAppDialog({ tone: 'error', message: 'An error occurred while deleting the contact.' });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleExport = () => {
    if (displayContacts.length === 0) {
      showAppDialog({ tone: 'warning', message: 'No contacts to export.' });
      return;
    }
    const csv = Papa.unparse(displayContacts.map(c => ({
      Name: c.fullName,
      Phone: c.whatsappNumber,
      AvatarUrl: getContactAvatarUrl(c),
      Tags: c.tags?.join(', ') || '',
      Notes: c.notes || ''
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `visionary_contacts_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openEditModal = (contact: any) => {
    setSelectedContact(contact);
    setNewContactName(contact.fullName || contact.name || '');
    setNewContactPhone(contact.whatsappNumber || contact.phone || '');
    setContactAvatarFile(null);
    setContactAvatarPreview(getContactAvatarUrl(contact));
    
    // Extract custom parameters if available
    const params = [];
    if (contact.customParams) {
      for (const [key, value] of Object.entries(contact.customParams)) {
        params.push({ name: key, value: String(value) });
      }
    }
    setCustomParams(params);
    setShowEditModal(true);
  };

  const addCustomParam = () => {
    setCustomParams([...customParams, { name: '', value: '' }]);
  };

  const updateCustomParam = (index: number, field: 'name' | 'value', val: string) => {
    const newParams = [...customParams];
    newParams[index][field] = val;
    setCustomParams(newParams);
  };

  const removeCustomParam = (index: number) => {
    setCustomParams(customParams.filter((_, i) => i !== index));
  };

  const formatPhoneWithCountryCode = (phone: string) => {
    if (!phone) return '-';
    // Basic heuristic for common country codes if libphonenumber-js is not used
    // Assuming mostly Indian (+91) or US (+1) for this example, or just display raw if unknown
    // Let's try to extract if it starts with 91 or 1
    let countryCode = '';
    let rest = phone;
    
    if (phone.startsWith('+')) {
      phone = phone.substring(1);
    }

    if (phone.startsWith('91') && phone.length === 12) {
      countryCode = '91';
      rest = phone.substring(2);
    } else if (phone.startsWith('1') && phone.length === 11) {
      countryCode = '1';
      rest = phone.substring(1);
    } else if (phone.startsWith('44') && phone.length === 12) {
      countryCode = '44';
      rest = phone.substring(2);
    } else if (phone.startsWith('971') && phone.length === 12) {
      countryCode = '971';
      rest = phone.substring(3);
    } else {
      // Fallback: just show the first 2 digits as a guess if it's long enough
      if (phone.length > 10) {
        const diff = phone.length - 10;
        countryCode = phone.substring(0, diff);
        rest = phone.substring(diff);
      }
    }

    if (countryCode) {
      return <span className="font-mono"><span className="text-gray-500">(+{countryCode})</span> {rest}</span>;
    }
    return <span className="font-mono">{phone}</span>;
  };

  return (
    <motion.div 
      key="contacts"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 relative"
    >
      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
              onClick={resetContactForm}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className={cn("relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[1.8rem] border p-6 shadow-2xl", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200")}
            >
            <h3 className="text-xl font-bold mb-4">{showEditModal ? 'Edit Contact' : 'Add New Contact'}</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-2xl border", isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-100")}>
                  {contactAvatarPreview ? (
                    <img src={contactAvatarPreview} alt="Contact profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      <UserIcon size={24} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all", isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200")}>
                    <Camera size={16} />
                    Upload Picture
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleContactAvatarUpload} />
                  </label>
                  <p className="mt-2 text-xs text-gray-500">Square JPG, PNG, or WebP, up to 5 MB.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">Name</label>
                <input 
                  type="text" 
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className={cn("w-full p-3 rounded-xl border outline-none", isDark ? "bg-gray-800/50 border-gray-700 focus:border-[#5B45FF]" : "bg-gray-50 border-gray-200 focus:border-[#5B45FF]")}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">WhatsApp Number</label>
                <input 
                  type="text" 
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  disabled={showEditModal} // Phone number is the identifier, shouldn't change
                  className={cn("w-full p-3 rounded-xl border outline-none", isDark ? "bg-gray-800/50 border-gray-700 focus:border-[#5B45FF]" : "bg-gray-50 border-gray-200 focus:border-[#5B45FF]", showEditModal && "opacity-50 cursor-not-allowed")}
                  placeholder="e.g. 1234567890"
                />
                <p className="text-xs text-gray-500 mt-1">Include country code without + (e.g. 15559172686)</p>
              </div>
              
              <div className="pt-4 border-t border-gray-800/50">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-400">Custom Attributes</label>
                  <button type="button" onClick={addCustomParam} className="text-xs text-blue-500 hover:text-blue-400 font-bold flex items-center gap-1">
                    <Plus size={12} /> Add Attribute
                  </button>
                </div>
                
                {customParams.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No custom attributes added.</p>
                ) : (
                  <div className="space-y-2">
                    {customParams.map((param, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          value={param.name}
                          onChange={(e) => updateCustomParam(idx, 'name', e.target.value)}
                          className={cn("w-1/3 p-2 text-sm rounded-lg border outline-none", isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200")}
                          placeholder="Name"
                        />
                        <input 
                          type="text" 
                          value={param.value}
                          onChange={(e) => updateCustomParam(idx, 'value', e.target.value)}
                          className={cn("flex-1 p-2 text-sm rounded-lg border outline-none", isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200")}
                          placeholder="Value"
                        />
                        <button type="button" onClick={() => removeCustomParam(idx)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button"
                  onClick={resetContactForm}
                  className={cn("px-4 py-2 rounded-xl font-medium", isDark ? "hover:bg-gray-800" : "hover:bg-gray-100")}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={showEditModal ? handleEditContact : handleAddContact}
                  disabled={isAdding || !newContactName || !newContactPhone}
                  className="px-4 py-2 rounded-xl bg-[#5B45FF] text-white font-bold disabled:opacity-50"
                >
                  {isAdding ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold">Contacts</h3>
            <span className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              isDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600"
            )}>
              {displayContacts.length} {displayContacts.length === 1 ? 'contact' : 'contacts'}
            </span>
          </div>
          <div className={cn("flex items-center gap-3 p-3 rounded-2xl w-full xl:w-96 border", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
            <Search size={20} className="text-gray-500" />
            <input type="text" placeholder="Search contacts..." className="bg-transparent border-none outline-none text-sm w-full" />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className={cn("px-6 py-3 rounded-2xl font-bold text-sm cursor-pointer flex items-center gap-2 transition-all", isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200")}>
            <FileUp size={18} />
            Import CSV
            <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={handleExport}
            className={cn("px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all", isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200")}
          >
            <Download size={18} />
            Export
          </button>
          <button 
            onClick={() => {
              resetContactForm();
              setShowAddModal(true);
            }}
            className="px-6 py-3 rounded-2xl bg-[#5B45FF] text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-[#5B45FF]/20 hover:bg-[#5B45FF] transition-all"
          >
            <Plus size={18} />
            Add Contact
          </button>
        </div>
      </div>

      <div className={cn("rounded-3xl border overflow-hidden", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
        <table className="w-full text-left">
          <thead>
            <tr className={cn("text-xs font-bold uppercase tracking-wider", isDark ? "bg-gray-800/50 text-gray-500" : "bg-gray-50 text-gray-400")}>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Phone</th>
              <th className="px-6 py-4">Attributes</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {displayContacts.map((contact, idx) => {
              const phone = contact.whatsappNumber || contact.phone;
              const avatarUrl = getContactAvatarUrl(contact);
              return (
                <tr key={contact.id || idx} className={isDark ? "hover:bg-gray-800/30" : "hover:bg-gray-50"}>
                  <td className="px-6 py-4 font-bold">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-10 w-10 shrink-0 overflow-hidden rounded-xl border", isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-100")}>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-400">
                            <UserIcon size={18} />
                          </div>
                        )}
                      </div>
                      <span className="min-w-0 truncate">{contact.fullName || contact.name || contact.whatsappNumber || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {formatPhoneWithCountryCode(phone)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {contact.customParams && Object.entries(contact.customParams).map(([key, val]) => (
                        <span key={key} className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                          {key}: {String(val)}
                        </span>
                      ))}
                      {(!contact.customParams || Object.keys(contact.customParams).length === 0) && (
                        <span className="text-xs text-gray-500 italic">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        type="button"
                        onClick={() => openEditModal(contact)}
                        className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                        title="Edit Contact"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteContact(contact);
                        }}
                        disabled={isDeleting === (contact.id || contact.whatsappNumber || contact.phone)}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                        title="Delete Contact"
                      >
                        {isDeleting === (contact.id || contact.whatsappNumber || contact.phone) ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {displayContacts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  No contacts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function ExplorerSection({ isDark, contacts, broadcasts, templates, accountInfo }: { isDark: boolean, contacts: any[], broadcasts: any[], templates: any[], accountInfo: any }) {
  return (
    <motion.div 
      key="explorer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 md:space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-bold">Data Explorer</h3>
          <p className="text-xs md:text-sm text-gray-400">Raw system data for transparency and debugging</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn("px-3 py-1.5 md:px-4 md:py-2 rounded-xl border font-mono text-[10px] md:text-xs", isDark ? "bg-gray-800 border-gray-700 text-[#5B45FF]" : "bg-gray-100 border-gray-200 text-[#5B45FF]")}>
            API STATUS: {accountInfo?.apiStatus || 'HEALTHY'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <DataCard title="Contacts Raw Data" data={contacts} isDark={isDark} />
        <DataCard title="Broadcast Reports" data={broadcasts} isDark={isDark} />
        <DataCard title="Message Templates" data={templates} isDark={isDark} />
        <DataCard title="Account Metadata" data={accountInfo} isDark={isDark} />
      </div>
    </motion.div>
  );
}

function DataCard({ title, data, isDark }: { title: string, data: any, isDark: boolean }) {
  return (
    <div className={cn(
      "rounded-3xl border-2 overflow-hidden flex flex-col h-[450px] transition-all shadow-lg", 
      isDark ? "bg-[#0b141a] border-[#5B45FF]" : "bg-white border-[#5B45FF]"
    )}>
      {/* Header: Green Header with White Font */}
      <div className="p-4 flex justify-between items-center bg-[#5B45FF] shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <h4 className="font-bold text-sm text-white uppercase tracking-wider">{title}</h4>
        </div>
        <span className="text-[10px] font-bold font-mono px-2 py-1 rounded-lg bg-white/20 text-white">
          {Array.isArray(data) ? data.length : 1} ITEMS
        </span>
      </div>
      
      {/* Body: Black body Font (Light) / White body Font (Dark) */}
      <div className={cn(
        "flex-1 overflow-auto p-6 font-mono text-[11px] leading-relaxed scrollbar-thin",
        isDark ? "text-white bg-[#0b141a] scrollbar-thumb-[#5B45FF]" : "text-black bg-white scrollbar-thumb-[#5B45FF]"
      )}>
        <pre className="whitespace-pre-wrap break-all selection:bg-[#5B45FF] selection:text-white">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
      
      {/* Footer: Visual touch */}
      <div className={cn(
        "px-4 py-2 text-[9px] font-bold uppercase tracking-tighter border-t",
        isDark ? "bg-[#5B45FF]/10 border-[#5B45FF]/30 text-[#5B45FF]" : "bg-[#5B45FF] border-[#5B45FF] text-white"
      )}>
        System Log • {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}

function AutomationsSection({ isDark }: { isDark: boolean }) {
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [selectedTriggerType, setSelectedTriggerType] = useState<'incoming' | 'attribute' | 'action_pending'>('incoming');

  const ruleGroups = {
    incoming: {
      title: 'Incoming message based triggers',
      subtitle: 'Triggers if a New WhatsApp Message is Received'
    },
    attribute: {
      title: 'Attribute Based Triggers',
      subtitle: 'New attribute is added to a Contact or an attribute value is changed for a contact'
    },
    action_pending: {
      title: 'Action Pending Triggers',
      subtitle: 'WhatsApp Customer No Response'
    }
  } as const;

  const rules = [
    { id: 1, name: 'Incoming message router', group: ruleGroups.incoming.title, trigger: 'Triggers if a New WhatsApp Message is Received', status: 'Active' },
    { id: 2, name: 'Attribute update follow-up', group: ruleGroups.attribute.title, trigger: 'Runs when a contact attribute is added or changed', status: 'Draft' },
    { id: 3, name: 'No response reminder', group: ruleGroups.action_pending.title, trigger: 'WhatsApp Customer No Response', status: 'Active' },
  ];

  return (
    <motion.div 
      key="automations"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <AnimatePresence>
        {isCreateRuleOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setIsCreateRuleOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className={cn(
                "relative w-full max-w-3xl rounded-[2rem] border p-6 md:p-8 shadow-2xl",
                isDark ? "border-gray-800 bg-[#111827]" : "border-gray-200 bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#5B45FF]">Create Rule</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight">Automate messages, assignments, and chatbot flows</h3>
                  <p className="mt-2 text-sm text-gray-500">Choose a trigger type below and build the rule flow that should happen next.</p>
                </div>
                <button onClick={() => setIsCreateRuleOpen(false)} className="rounded-xl px-3 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Close</button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {([
                  { key: 'incoming', label: 'Incoming Message' },
                  { key: 'attribute', label: 'Attribute Based' },
                  { key: 'action_pending', label: 'Action Pending' }
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedTriggerType(option.key)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all",
                      selectedTriggerType === option.key
                        ? "border-[#5B45FF] bg-[#5B45FF]/10"
                        : (isDark ? "border-gray-700 bg-gray-800/50 hover:border-gray-600" : "border-gray-200 bg-gray-50 hover:border-gray-300")
                    )}
                  >
                    <p className="text-sm font-bold">{option.label}</p>
                    <p className="mt-2 text-xs text-gray-500">{ruleGroups[option.key].subtitle}</p>
                  </button>
                ))}
              </div>

              <div className={cn("mt-6 rounded-[1.75rem] border p-5", isDark ? "border-gray-700 bg-gray-800/40" : "border-gray-200 bg-gray-50")}>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#5B45FF]">{ruleGroups[selectedTriggerType].title}</p>
                <p className="mt-3 text-sm font-medium text-gray-500">{ruleGroups[selectedTriggerType].subtitle}</p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {selectedTriggerType === 'incoming' && (
                    <>
                      <TriggerLine title="Incoming message based triggers" copy="Triggers if a New WhatsApp Message is Received" isDark={isDark} />
                      <TriggerLine title="Suggested actions" copy="Send automated messages, assign chats, or trigger chatbot flows." isDark={isDark} />
                    </>
                  )}
                  {selectedTriggerType === 'attribute' && (
                    <>
                      <TriggerLine title="New attribute is added to a Contact" copy="Use this when a new label, stage, or field appears on a contact profile." isDark={isDark} />
                      <TriggerLine title="An attribute value is changed for a contact" copy="Use this when lifecycle stage, owner, or any tracked field changes." isDark={isDark} />
                    </>
                  )}
                  {selectedTriggerType === 'action_pending' && (
                    <>
                      <TriggerLine title="WhatsApp Customer No Response" copy="Trigger follow-ups or reassign chats when customers stop responding." isDark={isDark} />
                      <TriggerLine title="Suggested actions" copy="Send reminders, move chat owner, or open escalation steps." isDark={isDark} />
                    </>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateRuleOpen(false)}
                  className={cn("rounded-2xl px-5 py-3 text-sm font-bold", isDark ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-600")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-[#5B45FF] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#5B45FF]/20 hover:bg-[#5B45FF] transition-all"
                >
                  Save Rule
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <p className="text-sm font-semibold">Rules</p>
          <p className="text-sm text-gray-400">Create Rules to trigger automated messages, chat assignments, chatbots and more.</p>
        </div>
        <button onClick={() => setIsCreateRuleOpen(true)} className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#5B45FF] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#5B45FF]/20 hover:bg-[#5B45FF] transition-all">
          <Plus size={18} />
          Create Rule
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {rules.map(auto => (
          <div key={auto.id} className={cn("p-6 rounded-2xl md:rounded-3xl border space-y-4", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                <Zap className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className={cn("px-2 py-1 rounded-lg text-[9px] md:text-[10px] font-bold uppercase", auto.status === 'Active' ? "bg-[#5B45FF]/10 text-[#5B45FF]" : "bg-yellow-500/10 text-yellow-500")}>
                {auto.status}
              </span>
            </div>
            <div>
              <h4 className="font-bold text-base md:text-lg">{auto.name}</h4>
              <p className="text-[10px] md:text-xs uppercase tracking-[0.22em] text-[#5B45FF] mt-2">{auto.group}</p>
              <p className="text-xs md:text-sm text-gray-400 mt-1">{auto.trigger}</p>
            </div>
            <div className="pt-4 flex gap-2">
              <button className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all", isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200")}>Edit Rule</button>
              <button className={cn("p-2 rounded-xl text-red-400 transition-all", isDark ? "bg-gray-800 hover:bg-red-500/10" : "bg-gray-100 hover:bg-red-500/10")}><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function IntegrationsSection({ isDark }: { isDark: boolean }) {
  const integrations = [
    { name: 'Shopify', desc: 'Sync orders and send updates', icon: '🛍️' },
    { name: 'Google Sheets', desc: 'Export contacts automatically', icon: '📊' },
    { name: 'Zapier', desc: 'Connect with 5000+ apps', icon: '⚡' },
  ];

  return (
    <motion.div 
      key="integrations"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
    >
      {integrations.map(app => (
        <div key={app.name} className={cn("p-6 rounded-2xl md:rounded-3xl border space-y-4 hover:border-blue-500 transition-all cursor-pointer group", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
          <div className="text-3xl md:text-4xl mb-4">{app.icon}</div>
          <h4 className="font-bold text-base md:text-lg group-hover:text-blue-500 transition-colors">{app.name}</h4>
          <p className="text-xs md:text-sm text-gray-400">{app.desc}</p>
          <button className="w-full py-2.5 md:py-3 rounded-xl md:rounded-2xl bg-gray-800 text-[10px] md:text-xs font-bold hover:bg-blue-600 hover:text-white transition-all">Connect</button>
        </div>
      ))}
    </motion.div>
  );
}

function CallsSection({
  isDark,
  contacts,
  phoneNumbers,
  callLogs,
  activeCallSession,
  currentUserId,
  callSocketState,
  callDiagnosticEvents,
  onStartCall
}: {
  isDark: boolean,
  contacts: any[],
  phoneNumbers: WhatsAppPhoneNumber[],
  callLogs: CallLogRecord[],
  activeCallSession: ActiveCallSession | null,
  currentUserId?: string | null,
  callSocketState: SocketConnectionState,
  callDiagnosticEvents: CallDiagnosticEvent[],
  onStartCall: (contactPhone: string, contactName?: string, source?: CallLogRecord['source']) => Promise<void>
}) {
  const [targetPhoneId, setTargetPhoneId] = useState<string>(whatsappService.getCredentials().PHONE_NUMBER_ID || phoneNumbers[0]?.phoneId || '');
  const [targetUserWaId, setTargetUserWaId] = useState('');
  const [callingProbe, setCallingProbe] = useState<WhatsAppCallingProbe | null>(null);
  const [loadingProbe, setLoadingProbe] = useState(false);
  const [lastCheckedWaId, setLastCheckedWaId] = useState('');
  const [callFilter, setCallFilter] = useState<CallFilter>('all');

  useEffect(() => {
    if (targetPhoneId) return;
    const preferredPhoneId = whatsappService.getCredentials().PHONE_NUMBER_ID || phoneNumbers[0]?.phoneId || '';
    if (preferredPhoneId) {
      setTargetPhoneId(preferredPhoneId);
    }
  }, [phoneNumbers, targetPhoneId]);

  const recentContacts = useMemo(() => {
    const seen = new Set<string>();

    return contacts.reduce<Array<{ id: string; label: string; phone: string }>>((acc, contact) => {
      const phone = normalizePhoneDigits(getContactPhone(contact));
      if (!phone || seen.has(phone)) return acc;

      seen.add(phone);
      acc.push({
        id: String(getContactKey(contact) || phone),
        label: contact?.fullName || contact?.name || phone,
        phone
      });
      return acc;
    }, []).slice(0, 6);
  }, [contacts]);

  useEffect(() => {
    if (targetUserWaId || recentContacts.length === 0) return;
    setTargetUserWaId(recentContacts[0].phone);
  }, [recentContacts, targetUserWaId]);

  const selectedPhone = phoneNumbers.find((phone) => phone.phoneId === targetPhoneId) || phoneNumbers[0] || null;
  const normalizedTargetUserWaId = normalizePhoneDigits(targetUserWaId);
  const selectedRecentContact = recentContacts.find((contact) => contact.phone === normalizedTargetUserWaId) || null;
  const isDialingActiveTarget = Boolean(activeCallSession && normalizedTargetUserWaId && activeCallSession.contactPhone === normalizedTargetUserWaId);

  const filterCounts = useMemo(() => ({
    all: callLogs.length,
    missed: callLogs.filter((call) => call.status === 'missed').length,
    incoming: callLogs.filter((call) => call.direction === 'incoming').length,
    outgoing: callLogs.filter((call) => call.direction === 'outgoing').length
  }), [callLogs]);

  const filteredCallLogs = useMemo(() => {
    return sortCallLogs(callLogs).filter((call) => {
      if (callFilter === 'all') return true;
      if (callFilter === 'missed') return call.status === 'missed';
      if (callFilter === 'incoming') return call.direction === 'incoming';
      return call.direction === 'outgoing';
    });
  }, [callFilter, callLogs]);

  const runProbe = async (candidateWaId?: string) => {
    const normalizedWaId = normalizePhoneDigits(candidateWaId || targetUserWaId);

    if (!targetPhoneId) {
      showAppDialog({ tone: 'warning', message: 'Connect a WhatsApp Business number before checking call permissions.' });
      return;
    }

    if (!normalizedWaId) {
      showAppDialog({ tone: 'warning', message: 'Enter a WhatsApp user number to check call permissions.' });
      return;
    }

    setLoadingProbe(true);
    try {
      const result = await whatsappService.probeCallingApi(targetPhoneId, normalizedWaId);
      setCallingProbe(result);
      setLastCheckedWaId(normalizedWaId);
      setTargetUserWaId(normalizedWaId);
    } finally {
      setLoadingProbe(false);
    }
  };

  const permissionTone = callingProbe?.enabled
    ? 'text-[#5B45FF]'
    : callingProbe
      ? 'text-amber-500'
      : (isDark ? 'text-slate-300' : 'text-slate-600');

  const capabilityLabel = callingProbe
    ? (callingProbe.enabled ? 'Ready for checks' : 'Unavailable')
    : 'Not checked yet';

  const latestDiagnostic = callDiagnosticEvents[0] || null;
  const latestRouteDiagnostic = callDiagnosticEvents.find((event) => event.kind === 'webhook_route') || null;
  const latestRegistrationDiagnostic = callDiagnosticEvents.find((event) => event.kind === 'socket_registration') || null;
  const socketStateTone = callSocketState === 'connected'
    ? 'text-[#5B45FF]'
    : callSocketState === 'reconnecting'
      ? 'text-amber-500'
      : callSocketState === 'error'
        ? 'text-rose-500'
        : (isDark ? 'text-slate-300' : 'text-slate-600');
  const socketStateLabel = callSocketState.charAt(0).toUpperCase() + callSocketState.slice(1);
  const environmentHost = typeof window !== 'undefined' ? window.location.host : 'Unavailable';
  const recentDiagnosticEvents = callDiagnosticEvents.slice(0, 4);
  const formatDiagnosticTime = (timestamp?: number) =>
    timestamp
      ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Pending';

  const dialTarget = async () => {
    if (!normalizedTargetUserWaId) {
      showAppDialog({ tone: 'warning', message: 'Enter a valid WhatsApp number before starting a call.' });
      return;
    }

    await onStartCall(
      normalizedTargetUserWaId,
      selectedRecentContact?.label || normalizedTargetUserWaId,
      'calls_tab'
    );
  };

  const filterOptions: Array<{ id: CallFilter; label: string; description: string }> = [
    { id: 'all', label: 'All Calls', description: 'Full history' },
    { id: 'missed', label: 'Missed Calls', description: 'Needs follow-up' },
    { id: 'incoming', label: 'Incoming Calls', description: 'Customer initiated' },
    { id: 'outgoing', label: 'Outgoing Calls', description: 'Team initiated' }
  ];

  return (
    <motion.div
      key="calls"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto w-full max-w-6xl space-y-5 md:space-y-6"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {filterOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setCallFilter(option.id)}
            className={cn(
              "rounded-[1.35rem] border p-4 text-left transition-all",
              callFilter === option.id
                ? "border-[#5B45FF]/40 bg-[#5B45FF]/10"
                : (isDark ? "border-gray-800 bg-[#111827] hover:border-[#5B45FF]/30" : "border-gray-200 bg-white shadow-sm hover:border-[#5B45FF]")
            )}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{option.label}</p>
            <p className="mt-2 text-2xl font-black tracking-tight">{filterCounts[option.id].toLocaleString()}</p>
            <p className={cn("mt-1 text-[11px] leading-5", isDark ? "text-slate-400" : "text-slate-500")}>{option.description}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className={cn("rounded-[1.75rem] border p-4 md:p-5", isDark ? "border-gray-800 bg-[#111827]" : "border-gray-200 bg-white shadow-sm")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Call History</p>
              <h3 className="mt-1 text-lg font-black tracking-tight">{filterOptions.find((option) => option.id === callFilter)?.label || 'All Calls'}</h3>
            </div>
            <div className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", isDark ? "bg-gray-900 text-slate-300" : "bg-slate-100 text-slate-600")}>
              {filteredCallLogs.length.toLocaleString()} shown
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setCallFilter(option.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                  callFilter === option.id
                    ? "bg-[#5B45FF] text-white"
                    : (isDark ? "bg-gray-900 text-slate-300 hover:text-white" : "bg-slate-100 text-slate-600 hover:text-slate-900")
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 max-h-[44rem] space-y-3 overflow-y-auto pr-1">
            {filteredCallLogs.length === 0 && (
              <div className={cn("rounded-[1.3rem] border px-4 py-8 text-center", isDark ? "border-gray-700 bg-gray-900/50 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500")}>
                No calls match this view yet.
              </div>
            )}

            {filteredCallLogs.map((call) => {
              const actionDisabled = Boolean(activeCallSession && activeCallSession.contactPhone === call.contactPhone);
              const statusTone = call.status === 'missed'
                ? 'text-rose-500'
                : call.status === 'ongoing'
                  ? 'text-[#5B45FF]'
                  : call.status === 'failed'
                    ? 'text-amber-500'
                    : (isDark ? 'text-slate-300' : 'text-slate-700');

              return (
                <div
                  key={call.id}
                  className={cn("rounded-[1.35rem] border p-4", isDark ? "border-gray-700 bg-gray-900/50" : "border-slate-200 bg-slate-50")}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded-2xl",
                          call.status === 'missed'
                            ? "bg-rose-500/10 text-rose-500"
                            : call.direction === 'incoming'
                              ? "bg-[#5B45FF]/10 text-[#5B45FF]"
                              : "bg-sky-500/10 text-sky-500"
                        )}>
                          <Phone size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{call.contactName || call.contactPhone}</p>
                          <p className={cn("truncate text-xs", isDark ? "text-slate-400" : "text-slate-500")}>{call.contactPhone}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className={cn("rounded-full px-2.5 py-1 font-semibold", isDark ? "bg-white/8 text-slate-300" : "bg-white text-slate-600")}>
                          {call.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
                        </span>
                        <span className={cn("rounded-full px-2.5 py-1 font-semibold", isDark ? "bg-white/8" : "bg-white", statusTone)}>
                          {call.status === 'ongoing' ? 'Live' : call.status.charAt(0).toUpperCase() + call.status.slice(1)}
                        </span>
                        {call.durationSeconds ? (
                          <span className={cn("rounded-full px-2.5 py-1 font-semibold", isDark ? "bg-white/8 text-slate-300" : "bg-white text-slate-600")}>
                            {formatCallDuration(call.durationSeconds)}
                          </span>
                        ) : null}
                      </div>
                      <p className={cn("mt-3 text-sm font-semibold", statusTone)}>{call.label}</p>
                      <p className={cn("mt-1 text-[11px] leading-5", isDark ? "text-slate-400" : "text-slate-500")}>
                        {new Date(call.startedAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {call.permissionStatus ? ` • ${call.permissionStatus}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onStartCall(call.contactPhone, call.contactName, 'calls_tab')}
                      disabled={actionDisabled}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#5B45FF] px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#5B45FF] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Phone size={15} />
                      {getCallActionLabel(call.direction)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className={cn("rounded-[1.75rem] border p-5", isDark ? "border-gray-800 bg-[#111827]" : "border-gray-200 bg-white shadow-sm")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Quick Dial</p>
                <h3 className="mt-1 text-lg font-black tracking-tight">Start or Retry a Call</h3>
              </div>
              {loadingProbe && <RefreshCw size={18} className="animate-spin text-slate-400" />}
            </div>

            <div className="mt-4 grid gap-3">
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Business Number</span>
                <select
                  value={targetPhoneId}
                  onChange={(event) => setTargetPhoneId(event.target.value)}
                  className={cn("w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                >
                  {phoneNumbers.length === 0 && <option value="">No phone numbers connected</option>}
                  {phoneNumbers.map((phone) => (
                    <option key={phone.phoneId} value={phone.phoneId}>
                      {phone.displayPhoneNumber} ({phone.verifiedName || 'Unverified'})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Target WhatsApp User</span>
                <input
                  type="text"
                  value={targetUserWaId}
                  onChange={(event) => setTargetUserWaId(event.target.value)}
                  placeholder="e.g. 919876543210"
                  className={cn("w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all", isDark ? "border-gray-700 bg-gray-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {recentContacts.slice(0, 6).map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => setTargetUserWaId(contact.phone)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                    isDark ? "border-gray-700 bg-gray-900/60 text-slate-200 hover:border-[#5B45FF]" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[#5B45FF]"
                  )}
                >
                  <Users size={12} />
                  <span className="max-w-[10rem] truncate">{contact.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void dialTarget()}
                disabled={!normalizedTargetUserWaId || isDialingActiveTarget}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B45FF] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[#5B45FF] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Phone size={16} />
                {isDialingActiveTarget ? 'Call Active' : 'Call Now'}
              </button>
              <button
                type="button"
                onClick={() => void runProbe()}
                disabled={loadingProbe || !targetPhoneId || !normalizedTargetUserWaId}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  isDark ? "border-gray-700 bg-gray-900/60 text-slate-200 hover:border-gray-500" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <CheckCircle2 size={16} />
                {loadingProbe ? 'Checking...' : 'Check Permission'}
              </button>
            </div>
          </div>

          <div className={cn("rounded-[1.75rem] border p-5", isDark ? "border-gray-800 bg-[#111827]" : "border-gray-200 bg-white shadow-sm")}>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Current Status</p>
            <div className="mt-4 space-y-3">
              <div className={cn("rounded-[1.2rem] border p-4", isDark ? "border-gray-700 bg-gray-900/50" : "border-slate-200 bg-slate-50")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Connected Number</p>
                <p className="mt-2 text-sm font-semibold">{selectedPhone?.displayPhoneNumber || 'Not connected'}</p>
                <p className={cn("mt-1 text-[11px] leading-5", isDark ? "text-slate-400" : "text-slate-500")}>
                  {selectedPhone?.verifiedName || 'Choose the number used for outbound call checks'}
                </p>
              </div>
              <div className={cn("rounded-[1.2rem] border p-4", isDark ? "border-gray-700 bg-gray-900/50" : "border-slate-200 bg-slate-50")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Meta Capability</p>
                <p className={cn("mt-2 text-sm font-semibold", permissionTone)}>{capabilityLabel}</p>
                <p className={cn("mt-1 text-[11px] leading-5", isDark ? "text-slate-400" : "text-slate-500")}>
                  {callingProbe?.permissionStatus || (selectedPhone?.status || 'Run a permission check for live status')}
                </p>
              </div>
              <div className={cn("rounded-[1.2rem] border p-4", isDark ? "border-gray-700 bg-gray-900/50" : "border-slate-200 bg-slate-50")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Meta Response</p>
                <p className={cn("mt-2 text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>
                  {getCallPermissionMessage(callingProbe)}
                </p>
                {lastCheckedWaId && (
                  <p className={cn("mt-2 text-[11px]", isDark ? "text-slate-400" : "text-slate-500")}>Last checked: {lastCheckedWaId}</p>
                )}
              </div>
              <div className={cn("rounded-[1.2rem] border p-4", isDark ? "border-amber-500/20 bg-amber-500/10" : "border-amber-200 bg-amber-50")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500">Webhook Readiness</p>
                <p className={cn("mt-2 text-sm leading-6", isDark ? "text-slate-200" : "text-slate-700")}>
                  Incoming calls depend on Meta sending call webhooks with the call offer/session payload. The dashboard can only ring and answer after that payload reaches this workspace.
                </p>
                <p className={cn("mt-2 text-[11px] leading-5", isDark ? "text-slate-400" : "text-slate-500")}>
                  Incoming calls also require Meta to send call webhooks to a public subscribed endpoint. If you are testing on `localhost`, Meta cannot deliver those webhooks directly.
                </p>
              </div>
              <div className={cn("rounded-[1.2rem] border p-4", isDark ? "border-cyan-500/20 bg-cyan-500/10" : "border-cyan-200 bg-cyan-50")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-500">Call Diagnostics</p>
                    <p className={cn("mt-2 text-sm leading-6", isDark ? "text-slate-200" : "text-slate-700")}>
                      Live routing status for this dashboard session.
                    </p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", isDark ? "bg-[#0b1527] text-slate-200" : "bg-white text-slate-700", socketStateTone)}>
                    {socketStateLabel}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className={cn("rounded-[1rem] border px-3 py-3", isDark ? "border-white/8 bg-[#0b1527]/80" : "border-white/70 bg-white/90")}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Session</p>
                    <p className="mt-2 text-sm font-semibold">{environmentHost}</p>
                    <p className={cn("mt-1 text-[11px] leading-5", isDark ? "text-slate-400" : "text-slate-500")}>
                      User: {latestRegistrationDiagnostic?.userId || currentUserId || 'Pending'}
                    </p>
                    <p className={cn("mt-1 text-[11px] leading-5", isDark ? "text-slate-400" : "text-slate-500")}>
                      Phone ID: {latestRegistrationDiagnostic?.phoneNumberId || targetPhoneId || 'Pending'}
                    </p>
                  </div>
                  <div className={cn("rounded-[1rem] border px-3 py-3", isDark ? "border-white/8 bg-[#0b1527]/80" : "border-white/70 bg-white/90")}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Last Webhook</p>
                    <p className="mt-2 text-sm font-semibold">
                      {latestRouteDiagnostic?.callEvent || 'Waiting for call event'}
                    </p>
                    <p className={cn("mt-1 text-[11px] leading-5", isDark ? "text-slate-400" : "text-slate-500")}>
                      {latestRouteDiagnostic?.callDirection ? `${latestRouteDiagnostic.callDirection} • ${latestRouteDiagnostic.callStatus || 'pending'}` : 'No routed call webhook yet'}
                    </p>
                    <p className={cn("mt-1 text-[11px] leading-5", isDark ? "text-slate-400" : "text-slate-500")}>
                      {formatDiagnosticTime(latestRouteDiagnostic?.timestamp)}
                    </p>
                  </div>
                </div>

                <div className={cn("mt-3 rounded-[1rem] border px-3 py-3", isDark ? "border-white/8 bg-[#0b1527]/80" : "border-white/70 bg-white/90")}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Routing</p>
                  <p className="mt-2 text-sm font-semibold">
                    {latestRouteDiagnostic?.note || latestDiagnostic?.note || 'Waiting for the next registration or call-routing event.'}
                  </p>
                  <div className={cn("mt-2 flex flex-wrap gap-2 text-[11px]", isDark ? "text-slate-300" : "text-slate-600")}>
                    <span className={cn("rounded-full px-2.5 py-1", isDark ? "bg-white/8" : "bg-slate-100")}>
                      Live sessions: {(latestRouteDiagnostic?.matchedClientSessions ?? 0).toLocaleString()}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1", isDark ? "bg-white/8" : "bg-slate-100")}>
                      Firestore routes: {(latestRouteDiagnostic?.matchedFirestoreUsers ?? 0).toLocaleString()}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1", isDark ? "bg-white/8" : "bg-slate-100")}>
                      Call ID: {latestRouteDiagnostic?.callId || 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {recentDiagnosticEvents.length === 0 && (
                    <div className={cn("rounded-[1rem] border px-3 py-3 text-[11px]", isDark ? "border-white/8 bg-[#0b1527]/80 text-slate-400" : "border-white/70 bg-white/90 text-slate-500")}>
                      Waiting for the dashboard registration acknowledgement and the next call webhook.
                    </div>
                  )}
                  {recentDiagnosticEvents.map((event, index) => (
                    <div
                      key={`${event.kind}-${event.timestamp}-${index}`}
                      className={cn("rounded-[1rem] border px-3 py-3", isDark ? "border-white/8 bg-[#0b1527]/80" : "border-white/70 bg-white/90")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold">
                          {event.kind === 'socket_registration'
                            ? 'Dashboard Registered'
                            : event.kind === 'webhook_route'
                              ? `Webhook ${event.callEvent || 'Route'}`
                              : `Socket ${event.socketState || 'status'}`}
                        </p>
                        <span className={cn("text-[10px]", isDark ? "text-slate-400" : "text-slate-500")}>
                          {formatDiagnosticTime(event.timestamp)}
                        </span>
                      </div>
                      <p className={cn("mt-1 text-[11px] leading-5", isDark ? "text-slate-400" : "text-slate-500")}>
                        {event.note || 'No additional note for this event.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {activeCallSession && (
                <div className={cn("rounded-[1.2rem] border p-4", isDark ? "border-[#5B45FF]/20 bg-[#5B45FF]/10" : "border-[#5B45FF] bg-[#5B45FF] text-white")}>
                  <p className={cn("text-[10px] font-bold uppercase tracking-[0.18em]", isDark ? "text-[#5B45FF]" : "text-white/75")}>Live Session</p>
                  <p className="mt-2 text-sm font-semibold">{activeCallSession.contactName}</p>
                  <p className={cn("mt-1 text-[11px] leading-5", isDark ? "text-slate-300" : "text-white/75")}>
                    {activeCallSession.status === 'ringing'
                      ? 'Incoming ring popup is active.'
                      : `Call in progress with ${activeCallSession.participants.length} participant${activeCallSession.participants.length === 1 ? '' : 's'}.`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TriggerLine({ title, copy, isDark }: { title: string; copy: string; isDark: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4", isDark ? "border-gray-700 bg-gray-900/50" : "border-gray-200 bg-white")}>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-2 text-xs leading-6 text-gray-500">{copy}</p>
    </div>
  );
}

function ChannelStatusSection({ isDark, currentUserProfile }: { isDark: boolean, currentUserProfile: any }) {
  const [businessAccounts, setBusinessAccounts] = useState<any[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<WhatsAppPhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetPhoneId, setTargetPhoneId] = useState<string>(whatsappService.getCredentials().PHONE_NUMBER_ID);
  const [disconnecting, setDisconnecting] = useState(false);
  const [catalogs, setCatalogs] = useState<Array<{ id: string; name: string; vertical?: string }>>([]);
  const [commerceSettings, setCommerceSettings] = useState<WhatsAppCommerceSettings | null>(null);
  const [catalogIdInput, setCatalogIdInput] = useState(currentUserProfile?.whatsappCatalogConnection?.catalogId || '');
  const [catalogVisible, setCatalogVisible] = useState(Boolean(currentUserProfile?.whatsappCatalogConnection?.isCatalogVisible));
  const [cartEnabled, setCartEnabled] = useState(Boolean(currentUserProfile?.whatsappCatalogConnection?.isCartEnabled));
  const [savingCommerce, setSavingCommerce] = useState(false);
  const [loadingCommerce, setLoadingCommerce] = useState(false);
  const [callingProbe, setCallingProbe] = useState<WhatsAppCallingProbe | null>(null);
  const [loadingCallingProbe, setLoadingCallingProbe] = useState(false);
  const [provisioningNumber, setProvisioningNumber] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [accounts, phones, availableCatalogs] = await Promise.all([
          whatsappService.getBusinessAccounts(),
          whatsappService.getPhoneNumbers(),
          whatsappService.getCatalogs()
        ]);

        if (cancelled) return;

        setBusinessAccounts(accounts);
        setPhoneNumbers(phones);
        setCatalogs(availableCatalogs);

        const preferredPhoneId = targetPhoneId || whatsappService.getCredentials().PHONE_NUMBER_ID || phones[0]?.phoneId || '';
        if (preferredPhoneId) {
          setTargetPhoneId(preferredPhoneId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load channel status data", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!targetPhoneId) return;

    let cancelled = false;

    const loadCapabilityData = async () => {
      setLoadingCommerce(true);
      setLoadingCallingProbe(true);

      try {
        const [liveCommerceSettings, liveCallingProbe] = await Promise.all([
          whatsappService.getCommerceSettings(targetPhoneId),
          whatsappService.probeCallingApi(targetPhoneId)
        ]);

        if (cancelled) return;

        const effectiveCommerce = liveCommerceSettings || {
          connected: Boolean(currentUserProfile?.whatsappCatalogConnection?.catalogId),
          catalogId: currentUserProfile?.whatsappCatalogConnection?.catalogId || '',
          isCatalogVisible: Boolean(currentUserProfile?.whatsappCatalogConnection?.isCatalogVisible),
          isCartEnabled: Boolean(currentUserProfile?.whatsappCatalogConnection?.isCartEnabled)
        };

        setCommerceSettings(effectiveCommerce);
        setCatalogIdInput(effectiveCommerce?.catalogId || currentUserProfile?.whatsappCatalogConnection?.catalogId || '');
        setCatalogVisible(Boolean(effectiveCommerce?.isCatalogVisible));
        setCartEnabled(Boolean(effectiveCommerce?.isCartEnabled));
        setCallingProbe(liveCallingProbe);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load channel capability data:', error);
        }
      } finally {
        if (!cancelled) {
          setLoadingCommerce(false);
          setLoadingCallingProbe(false);
        }
      }
    };

    loadCapabilityData();

    return () => {
      cancelled = true;
    };
  }, [
    targetPhoneId,
    currentUserProfile?.whatsappCatalogConnection?.catalogId,
    currentUserProfile?.whatsappCatalogConnection?.isCatalogVisible,
    currentUserProfile?.whatsappCatalogConnection?.isCartEnabled
  ]);

  const primaryPhone = phoneNumbers.find((phone) => phone.phoneId === targetPhoneId) || phoneNumbers[0];
  const primaryAccount = businessAccounts.find((account) => account.id === primaryPhone?.wabaId) || businessAccounts[0];
  const credentials = whatsappService.getCredentials();
  const connectedWabaId = primaryPhone?.wabaId || primaryAccount?.id || credentials.BUSINESS_ACCOUNT_ID || currentUserProfile?.whatsappCredentials?.businessAccountId || '';
  const accountName = primaryAccount?.businessName || primaryAccount?.name || currentUserProfile?.companyName || 'WhatsApp Business Account';
  const messagingTier = primaryPhone?.whatsappBusinessManagerMessagingLimit || primaryPhone?.messagingLimitTier || 'Unknown';
  const messageLimitLabel =
    messagingTier === 'TIER_50' ? '50' :
    messagingTier === 'TIER_250' ? '250' :
    messagingTier === 'TIER_1K' ? '1,000' :
    messagingTier === 'TIER_10K' ? '10,000' :
    messagingTier === 'TIER_100K' ? '100,000' :
    messagingTier === 'TIER_UNLIMITED' ? 'Unlimited' :
    messagingTier;

  const handleNumberChange = async (newPhoneId: string) => {
    setTargetPhoneId(newPhoneId);
    try {
      if (auth.currentUser) {
        const currentCredentials = whatsappService.getCredentials();
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          whatsappCredentials: {
            accessToken: currentCredentials.ACCESS_TOKEN,
            businessAccountId: currentCredentials.BUSINESS_ACCOUNT_ID,
            phoneNumberId: newPhoneId
          }
        }, { merge: true });
        whatsappService.setCredentials(currentCredentials.ACCESS_TOKEN, newPhoneId, currentCredentials.BUSINESS_ACCOUNT_ID);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser?.uid}`);
      console.error('Failed to update connected WhatsApp number:', error);
      showAppDialog({ tone: 'error', message: 'Unable to switch the active WhatsApp number right now.' });
    }
  };

  const handleDisconnect = async () => {
    if (!auth.currentUser) return;

    const confirmed = await showAppConfirm({
      tone: 'warning',
      title: 'Disconnect WABA',
      message: 'This will remove the connected WhatsApp Business Account from this workspace. You can reconnect it from onboarding later.',
      confirmLabel: 'Disconnect',
      cancelLabel: 'Keep Connected'
    });

    if (!confirmed) return;

    setDisconnecting(true);
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        whatsappCredentials: null,
        whatsappCatalogConnection: null,
        toolSetup: {
          whatsapp: false
        }
      }, { merge: true });
      whatsappService.clearCredentials();
      showAppDialog({ tone: 'success', message: 'WhatsApp Business Account disconnected.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
      console.error('Failed to disconnect WhatsApp Business Account:', error);
      showAppDialog({ tone: 'error', message: 'Unable to disconnect the WhatsApp Business Account right now.' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveCommerce = async () => {
    if (!auth.currentUser || !targetPhoneId) return;

    const trimmedCatalogId = catalogIdInput.trim();
    if (!trimmedCatalogId) {
      showAppDialog({ tone: 'warning', message: 'Enter a catalog ID before saving WhatsApp commerce settings.' });
      return;
    }

    setSavingCommerce(true);
    try {
      const result = await whatsappService.updateCommerceSettings(targetPhoneId, {
        catalogId: trimmedCatalogId,
        isCatalogVisible: catalogVisible,
        isCartEnabled: cartEnabled
      });

      if (!result.success) {
        showAppDialog({ tone: 'error', message: result.error || 'Unable to connect the WhatsApp catalog right now.' });
        return;
      }

      const nextCommerceSettings: WhatsAppCommerceSettings = {
        connected: true,
        catalogId: trimmedCatalogId,
        isCatalogVisible: catalogVisible,
        isCartEnabled: cartEnabled
      };

      setCommerceSettings(nextCommerceSettings);

      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        whatsappCatalogConnection: {
          ...nextCommerceSettings,
          phoneNumberId: targetPhoneId,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });

      showAppDialog({ tone: 'success', message: 'WhatsApp catalog connected successfully.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
      console.error('Failed to save WhatsApp commerce settings:', error);
      showAppDialog({ tone: 'error', message: 'Unable to connect the WhatsApp catalog right now.' });
    } finally {
      setSavingCommerce(false);
    }
  };

  const handleProvisionNumber = async () => {
    if (!auth.currentUser || !targetPhoneId || !connectedWabaId) return;

    const currentCredentials = whatsappService.getCredentials();
    if (!currentCredentials.ACCESS_TOKEN) {
      showAppDialog({ tone: 'warning', message: 'No WhatsApp access token is available for this workspace.' });
      return;
    }

    setProvisioningNumber(true);
    try {
      const response = await fetch(buildBackendUrl('/api/wa/provision-phone-number'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentCredentials.ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          wabaId: connectedWabaId,
          phoneNumberId: targetPhoneId,
          pin: currentUserProfile?.whatsappCredentials?.twoStepVerificationPin || ''
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details?.registration?.error?.message || data.error || 'WhatsApp number registration failed.');
      }

      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        whatsappCredentials: {
          accessToken: currentCredentials.ACCESS_TOKEN,
          phoneNumberId: targetPhoneId,
          businessAccountId: connectedWabaId,
          twoStepVerificationPin: data.twoStepVerificationPin || currentUserProfile?.whatsappCredentials?.twoStepVerificationPin || null,
          registrationStatus: data.provisioning?.registration?.success ? 'registered' : 'pending',
          registeredAt: data.provisioning?.registeredAt || null
        },
        whatsappProvisioning: {
          twoStepVerification: data.provisioning?.twoStepVerification || null,
          registration: data.provisioning?.registration || null,
          subscribedApps: data.provisioning?.subscribedApps || null,
          phoneNumberStatus: data.provisioning?.phoneNumberStatus || null,
          updatedAt: new Date().toISOString()
        },
        toolSetup: {
          whatsapp: true
        }
      }, { merge: true });

      whatsappService.setCredentials(currentCredentials.ACCESS_TOKEN, targetPhoneId, connectedWabaId);

      const [accounts, phones] = await Promise.all([
        whatsappService.getBusinessAccounts(),
        whatsappService.getPhoneNumbers()
      ]);
      setBusinessAccounts(accounts);
      setPhoneNumbers(phones);

      showAppDialog({ tone: 'success', message: 'WhatsApp number registration completed.' });
    } catch (error: any) {
      console.error('Failed to provision WhatsApp number:', error);
      showAppDialog({ tone: 'error', message: error.message || 'Unable to register the WhatsApp number right now.' });
    } finally {
      setProvisioningNumber(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#5B45FF]" />
      </div>
    );
  }

  const accountFields = [
    { label: 'WABA ID', value: connectedWabaId || 'Not available' },
    { label: 'WABA Name', value: accountName },
    { label: 'Phone Number ID', value: primaryPhone?.phoneId || targetPhoneId || 'Not available' },
    { label: 'Display Number', value: primaryPhone?.displayPhoneNumber || 'Not available' }
  ];

  const statusCards = [
    {
      title: 'Phone Number Status',
      icon: <Smartphone size={18} className="text-slate-400" />,
      value: primaryPhone?.status || 'DISCONNECTED',
      helper: primaryPhone?.status === 'CONNECTED'
        ? 'This number is currently connected and ready for WhatsApp messaging.'
        : 'If this number should be active, reconnect or review it in Meta Business Manager.'
    },
    {
      title: 'Message Limit',
      icon: <Zap size={18} className="text-slate-400" />,
      value: messageLimitLabel || 'Unknown',
      helper: 'Business-initiated conversations allowed in a rolling 24-hour period.'
    },
    {
      title: 'Display Name',
      icon: <ShieldCheck size={18} className="text-slate-400" />,
      value: primaryPhone?.nameStatus || 'UNKNOWN',
      helper: primaryPhone?.verifiedName ? `Current name: ${primaryPhone.verifiedName}` : 'No verified display name returned yet.'
    },
    {
      title: 'Quality Rating',
      icon: <Activity size={18} className="text-slate-400" />,
      value: primaryPhone?.qualityRating || primaryPhone?.qualityScore || 'UNKNOWN',
      helper: 'Meta quality signal based on message performance and user feedback.'
    }
  ];

  return (
    <motion.div
      key="channel_status"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto w-full max-w-6xl space-y-6 md:space-y-8"
    >
      <div className={cn("rounded-2xl border p-6 md:rounded-3xl md:p-8", isDark ? "border-gray-800 bg-[#111827]" : "border-gray-200 bg-white shadow-sm")}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5B45FF]/10">
              <WabaIcon className="h-8 w-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-black tracking-tight md:text-2xl">WhatsApp Channel</h3>
                <span className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-semibold uppercase",
                  primaryPhone?.status === 'CONNECTED'
                    ? "bg-[#5B45FF]/10 text-[#5B45FF]"
                    : "bg-rose-500/10 text-rose-500"
                )}>
                  {primaryPhone?.status || 'Disconnected'}
                </span>
              </div>
              <p className={cn("mt-2 max-w-2xl text-sm leading-6", isDark ? "text-slate-400" : "text-slate-500")}>
                Review the connected WABA, switch the active phone number, manage catalog settings, and disconnect this WhatsApp Business Account.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {primaryPhone?.status !== 'CONNECTED' && (
              <button
                type="button"
                onClick={() => void handleProvisionNumber()}
                disabled={provisioningNumber || !targetPhoneId || !connectedWabaId}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B45FF] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#4b38df] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={16} className={cn(provisioningNumber && "animate-spin")} />
                {provisioningNumber ? 'Registering...' : 'Retry Registration'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50",
                isDark
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
                  : "border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
              )}
            >
              <Trash2 size={16} />
              {disconnecting ? 'Disconnecting...' : 'Disconnect WABA'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className={cn("rounded-[1.4rem] border p-4", isDark ? "border-gray-700 bg-gray-900/50" : "border-slate-200 bg-slate-50")}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold">Active Phone Number</p>
                <p className="mt-1 text-xs text-slate-500">Choose which connected WhatsApp number this workspace should use.</p>
              </div>
              <select
                value={targetPhoneId}
                onChange={(event) => void handleNumberChange(event.target.value)}
                className={cn(
                  "min-w-[14rem] rounded-xl border px-3 py-2 text-xs font-semibold outline-none transition-all",
                  isDark ? "border-gray-700 bg-gray-950 text-white focus:border-[#5B45FF]" : "border-slate-200 bg-white text-slate-900 focus:border-[#5B45FF]"
                )}
              >
                {phoneNumbers.length === 0 && <option value="">No numbers found</option>}
                {phoneNumbers.map((phone) => (
                  <option key={phone.phoneId} value={phone.phoneId}>
                    {phone.displayPhoneNumber || phone.phoneId} ({phone.verifiedName || 'Unverified'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={cn("rounded-[1.4rem] border p-4", isDark ? "border-gray-700 bg-gray-900/50" : "border-slate-200 bg-slate-50")}>
            <p className="text-sm font-bold">Business Account</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {accountFields.map((field) => (
                <div key={field.label} className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{field.label}</p>
                  <p className="mt-1 truncate text-sm font-semibold">{field.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statusCards.map((card) => (
          <div key={card.title} className={cn("rounded-2xl border p-5 md:rounded-3xl", isDark ? "border-gray-800 bg-[#111827]" : "border-gray-200 bg-white shadow-sm")}>
            <div className="flex items-center gap-3">
              {card.icon}
              <p className="text-sm font-bold">{card.title}</p>
            </div>
            <p className="mt-4 text-2xl font-black tracking-tight">{card.value}</p>
            <p className={cn("mt-2 text-xs leading-5", isDark ? "text-slate-400" : "text-slate-500")}>{card.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className={cn("rounded-2xl border p-6 md:rounded-3xl md:p-8", isDark ? "border-gray-800 bg-[#111827]" : "border-gray-200 bg-white shadow-sm")}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <DatabaseIcon size={20} className="text-[#5B45FF]" />
              <h3 className="text-lg font-bold">WhatsApp Catalog</h3>
            </div>
            {loadingCommerce && <RefreshCw size={16} className="animate-spin text-slate-400" />}
          </div>
          <p className={cn("mt-2 text-sm leading-6", isDark ? "text-slate-400" : "text-slate-500")}>
            Link a Meta catalog so inbox agents can send product messages from this channel.
          </p>

          <div className="mt-5 grid gap-4">
            <div className={cn("rounded-xl border p-3", isDark ? "border-gray-700 bg-gray-900/60" : "border-slate-200 bg-slate-50")}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Catalog ID</p>
              <input
                type="text"
                value={catalogIdInput}
                onChange={(event) => setCatalogIdInput(event.target.value)}
                placeholder="Enter Meta catalog ID"
                className={cn("mt-2 w-full rounded-xl border px-3 py-2 text-xs outline-none", isDark ? "border-gray-700 bg-gray-950 text-white" : "border-slate-200 bg-white text-slate-900")}
              />
              <p className="mt-2 text-[11px] text-slate-500">
                {catalogs.length > 0 ? `${catalogs.length} catalog${catalogs.length === 1 ? '' : 's'} found on this WABA.` : 'No catalogs were returned from this WABA yet.'}
              </p>
            </div>

            {catalogs.length > 0 && (
              <div className="grid gap-2">
                {catalogs.map((catalog) => (
                  <button
                    key={catalog.id}
                    type="button"
                    onClick={() => setCatalogIdInput(catalog.id)}
                    className={cn("rounded-xl border px-3 py-2 text-left transition-all", isDark ? "border-gray-700 bg-gray-900/60 hover:border-[#5B45FF]" : "border-slate-200 bg-slate-50 hover:border-[#5B45FF]")}
                  >
                    <p className="text-xs font-semibold">{catalog.name}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{catalog.id}{catalog.vertical ? ` - ${catalog.vertical}` : ''}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setCatalogVisible((prev) => !prev)}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                  catalogVisible
                    ? "border-[#5B45FF]/40 bg-[#5B45FF]/10 text-[#5B45FF]"
                    : (isDark ? "border-gray-700 bg-gray-900/60 text-slate-200" : "border-slate-200 bg-white text-slate-600")
                )}
              >
                <span>Catalog Visible</span>
                <span>{catalogVisible ? 'On' : 'Off'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCartEnabled((prev) => !prev)}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                  cartEnabled
                    ? "border-[#5B45FF]/40 bg-[#5B45FF]/10 text-[#5B45FF]"
                    : (isDark ? "border-gray-700 bg-gray-900/60 text-slate-200" : "border-slate-200 bg-white text-slate-600")
                )}
              >
                <span>Cart Enabled</span>
                <span>{cartEnabled ? 'On' : 'Off'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSaveCommerce()}
                disabled={savingCommerce || !targetPhoneId}
                className="inline-flex items-center justify-center rounded-xl bg-[#5B45FF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#4b38df] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingCommerce ? 'Saving...' : 'Save Catalog Connection'}
              </button>
              {commerceSettings?.catalogId && (
                <span className="rounded-full bg-[#5B45FF]/10 px-3 py-1 text-[10px] font-semibold text-[#5B45FF]">
                  Active catalog: {commerceSettings.catalogId}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={cn("rounded-2xl border p-6 md:rounded-3xl md:p-8", isDark ? "border-gray-800 bg-[#111827]" : "border-gray-200 bg-white shadow-sm")}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Phone size={20} className="text-[#5B45FF]" />
              <h3 className="text-lg font-bold">WhatsApp Calls API</h3>
            </div>
            {loadingCallingProbe && <RefreshCw size={16} className="animate-spin text-slate-400" />}
          </div>
          <p className={cn("mt-2 text-sm leading-6", isDark ? "text-slate-400" : "text-slate-500")}>
            The dashboard checks live Meta calling capability for the selected phone number before exposing call controls.
          </p>

          <div className="mt-5 grid gap-4">
            <div className={cn("rounded-xl border p-4", isDark ? "border-gray-700 bg-gray-900/60" : "border-slate-200 bg-slate-50")}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Live Meta Status</p>
              <div className="mt-3 flex items-center gap-2">
                {callingProbe?.enabled ? <CheckCircle2 size={18} className="text-[#5B45FF]" /> : <AlertCircle size={18} className="text-amber-500" />}
                <p className={cn("text-sm font-semibold", callingProbe?.enabled ? "text-[#5B45FF]" : "text-amber-500")}>
                  {callingProbe?.enabled ? 'Ready for permission checks' : (callingProbe?.permissionStatus || 'Unavailable')}
                </p>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {getCallPermissionMessage(callingProbe)}
              </p>
            </div>

            <div className={cn("rounded-xl border p-4", isDark ? "border-gray-700 bg-gray-900/60" : "border-slate-200 bg-slate-50")}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Display Name Guidance</p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-500">
                <li>Use the same display name as the brand shown on your website.</li>
                <li>Keep the website live and operational before submitting changes.</li>
                <li>Add the legal company name in the website footer when possible.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProfileSection({ isDark }: { isDark: boolean }) {
  const [businessAccounts, setBusinessAccounts] = useState<any[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<WhatsAppPhoneNumber[]>([]);
  const [phoneDetail, setPhoneDetail] = useState<WhatsAppBusinessProfile | null>(null);
  const [profileAbout, setProfileAbout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    address: '',
    description: '',
    email: '',
    vertical: '',
    website1: '',
    website2: '',
    about: '',
    displayName: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [targetPhoneId, setTargetPhoneId] = useState<string>(whatsappService.getCredentials().PHONE_NUMBER_ID);

  const CATEGORY_OPTIONS = [
    { label: 'Automotive', value: 'AUTO' },
    { label: 'Beauty, spa and salon', value: 'BEAUTY' },
    { label: 'Clothing', value: 'APPAREL' },
    { label: 'Education', value: 'EDU' },
    { label: 'Entertainment', value: 'ENTERTAIN' },
    { label: 'Online gambling and gaming', value: 'GAMING' },
    { label: 'Non-online gambling and gaming (e.g. brick and mortar)', value: 'OTHER' },
    { label: 'Event planning and service', value: 'OTHER' },
    { label: 'Matrimonial Service', value: 'OTHER' },
    { label: 'Finance and Banking', value: 'OTHER' },
    { label: 'Food and groceries', value: 'GROCERY' },
    { label: 'Alcoholic drinks', value: 'OTHER' },
    { label: 'Public service', value: 'GOVT' },
    { label: 'Hotel and lodging', value: 'HOTEL' },
    { label: 'Medical and health', value: 'HEALTH' },
    { label: 'Over-the-counter med', value: 'HEALTH' },
    { label: 'Pharmacy', value: 'HEALTH' },
    { label: 'Professional services', value: 'PROF_SERVICES' },
    { label: 'Shopping and retail', value: 'RETAIL' },
    { label: 'Travel and transportation', value: 'TRAVEL' },
    { label: 'Restaurant', value: 'RESTAURANT' },
    { label: 'Other', value: 'OTHER' }
  ];

  useEffect(() => {
    async function loadProfileData() {
      setLoading(true);
      try {
        const [accounts, phones] = await Promise.all([
          whatsappService.getBusinessAccounts(),
          whatsappService.getPhoneNumbers()
        ]);
        setBusinessAccounts(accounts);
        setPhoneNumbers(phones);

        const currentPhoneId = targetPhoneId || whatsappService.getCredentials().PHONE_NUMBER_ID;

        const [detail, about] = await Promise.all([
          whatsappService.getBusinessProfile(currentPhoneId),
          whatsappService.getBusinessProfileAbout(currentPhoneId)
        ]);
        setPhoneDetail(detail);
        setProfileAbout(about);
        
        const primaryPhone = phones.find(p => p.phoneId === currentPhoneId) || phones[0];

        if (detail) {
          setEditForm({
            address: detail.address || '',
            description: detail.description || '',
            email: detail.email || '',
            vertical: detail.vertical || '',
            website1: detail.websites?.[0] || '',
            website2: detail.websites?.[1] || '',
            about: about?.text || '',
            displayName: primaryPhone?.verifiedName || ''
          });
        }
      } catch (error) {
        console.error("Failed to load profile data", error);
      } finally {
        setLoading(false);
      }
    }
    loadProfileData();
  }, [targetPhoneId]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const normalizedType = (file.type || '').toLowerCase();
    if (!['image/jpeg', 'image/jpg'].includes(normalizedType)) {
      showAppDialog({ tone: 'warning', message: 'WhatsApp profile photos currently need to be uploaded as JPG/JPEG images.' });
      return;
    }

    // Basic validation
    if (file.size > 5 * 1024 * 1024) {
      showAppDialog({ tone: 'warning', message: 'File size exceeds 5MB limit.' });
      return;
    }

    setIsSaving(true);
    try {
      const currentPhoneId = targetPhoneId || whatsappService.getCredentials().PHONE_NUMBER_ID;
      const success = await whatsappService.updateBusinessProfilePhoto(currentPhoneId, file);
      
      if (success) {
        // Give Meta a moment to process
        setTimeout(async () => {
          const newDetail = await whatsappService.getBusinessProfile(currentPhoneId);
          setPhoneDetail(newDetail);
          showAppDialog({ tone: 'success', message: 'Profile photo updated successfully. It may take a few minutes to reflect everywhere.' });
        }, 2000);
      } else {
        showAppDialog({ tone: 'error', message: 'Failed to update profile photo. Please check the console for details.' });
      }
    } catch (error) {
      console.error("Failed to upload photo", error);
      showAppDialog({ tone: 'error', message: 'Failed to update profile photo. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    const confirmed = await showAppConfirm({
      title: 'Remove Profile Photo',
      message: 'Are you sure you want to remove your profile photo?',
      tone: 'warning',
      confirmLabel: 'Remove'
    });
    if (!confirmed) return;
    
    setIsSaving(true);
    try {
      const currentPhoneId = targetPhoneId || whatsappService.getCredentials().PHONE_NUMBER_ID;
      // Meta API removal: set profile_picture_handle to empty string
      const success = await whatsappService.updateBusinessProfile(currentPhoneId, {
        profile_picture_handle: "" 
      });
      
      if (success) {
        setTimeout(async () => {
          const newDetail = await whatsappService.getBusinessProfile(currentPhoneId);
          setPhoneDetail(newDetail);
          showAppDialog({ tone: 'success', message: 'Profile photo removal requested. It may take a few minutes to reflect.' });
        }, 2000);
      } else {
        showAppDialog({ tone: 'error', message: 'Failed to remove profile photo via API. You may need to use Meta Business Suite for this action.' });
      }
    } catch (error) {
      console.error("Failed to remove photo", error);
      showAppDialog({ tone: 'error', message: 'Failed to remove profile photo. Please try again or use Meta Business Suite.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditing = () => {
    if (phoneDetail) {
      setEditForm({
        address: phoneDetail.address || '',
        description: phoneDetail.description || '',
        email: phoneDetail.email || '',
        vertical: phoneDetail.vertical || '',
        website1: phoneDetail.websites?.[0] || '',
        website2: phoneDetail.websites?.[1] || '',
        about: profileAbout?.text || '',
        displayName: editForm.displayName // Keep current display name
      });
    }
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    const currentPhoneId = targetPhoneId || whatsappService.getCredentials().PHONE_NUMBER_ID;
    const primaryPhone = phoneNumbers.find(p => p.phoneId === currentPhoneId) || phoneNumbers[0];
    
    // Check if display name changed
    if (editForm.displayName !== (primaryPhone?.verifiedName || '')) {
      const confirmChange = await showAppConfirm({
        title: 'Review Required',
        message: 'Changing your display name will trigger a new review process by Meta. Your current name will remain until the new one is approved. Do you want to proceed?',
        tone: 'warning',
        confirmLabel: 'Proceed'
      });
      if (!confirmChange) return;
    }

    setIsSaving(true);
    try {
      const profileData: any = {
        messaging_product: 'whatsapp',
        address: editForm.address,
        description: editForm.description,
        email: editForm.email,
        vertical: editForm.vertical,
        websites: [editForm.website1, editForm.website2].filter(w => w.trim() !== '')
      };

      const profileSuccess = await whatsappService.updateBusinessProfile(currentPhoneId, profileData);
      
      if (editForm.about !== (profileAbout?.text || '')) {
        await whatsappService.updateBusinessProfileAbout(currentPhoneId, editForm.about);
      }

      // Handle Display Name Update
      if (editForm.displayName !== (primaryPhone?.verifiedName || '')) {
        await whatsappService.updatePhoneNumberVerifiedName(currentPhoneId, editForm.displayName);
      }

      const [newDetail, newAbout, newPhones] = await Promise.all([
        whatsappService.getBusinessProfile(currentPhoneId),
        whatsappService.getBusinessProfileAbout(currentPhoneId),
        whatsappService.getPhoneNumbers()
      ]);
      
      setPhoneDetail(newDetail);
      setProfileAbout(newAbout);
      setPhoneNumbers(newPhones);
      setIsEditing(false);
      showAppDialog({ tone: 'success', message: 'Profile update requested. Some changes like display name may take time to be reviewed and reflected.' });
    } catch (error) {
      console.error("Failed to save profile", error);
      showAppDialog({ tone: 'error', message: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const primaryAccount = businessAccounts[0];
  const primaryPhone = phoneNumbers.find(p => p.phoneId === targetPhoneId) || phoneNumbers[0];

  return (
    <motion.div 
      key="profile"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-6xl space-y-6 md:space-y-8"
    >
      <div className="flex justify-between items-start">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Business Profile</h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Choose the photo, name and number that people will see when they get a marketing message from you.
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Edit Profile
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Form */}
        <div className={cn("rounded-2xl md:rounded-3xl p-6 md:p-8 border space-y-8", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
          {/* Profile Picture Section */}
          <div>
            <label className={`block text-sm font-bold uppercase tracking-wider mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Profile picture (This will be visible on your business profile)
            </label>
            <div className="flex items-center space-x-6">
              <div className="relative group">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-gray-800 border-4 border-gray-700 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                  {phoneDetail?.profile_picture_url ? (
                    <img 
                      src={phoneDetail.profile_picture_url} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon className="w-12 h-12 text-gray-400" />
                  )}
                </div>
                {isEditing && (
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                  >
                    <Camera className="w-6 h-6 text-white" />
                  </button>
                )}
              </div>
              {isEditing && (
                <div className="space-y-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-bold text-blue-500 hover:text-blue-400 transition-colors flex items-center"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Change Photo
                  </button>
                  <p className="text-xs text-gray-500">JPG, PNG or GIF. Max size 5MB.</p>
                  <button
                    onClick={handleRemovePhoto}
                    className="block text-sm font-bold text-red-500 hover:text-red-400 transition-colors"
                  >
                    Remove Photo
                  </button>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                className="hidden" 
                accept="image/jpeg,image/jpg"
              />
            </div>
          </div>

          {/* Display Name Section */}
          <div className="space-y-3">
            <label className={`block text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Display name
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={editForm.displayName}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                readOnly={!isEditing}
                placeholder="Business Name"
                className={cn("flex-1 px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-blue-500/50", 
                  isDark ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900",
                  !isEditing && (isDark ? "bg-gray-900/50 border-gray-700 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-500")
                )}
              />
              {primaryPhone?.nameStatus === 'APPROVED' && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-[#5B45FF]/10 text-[#5B45FF]">
                  Approved
                </span>
              )}
              {primaryPhone?.nameStatus === 'PENDING_REVIEW' && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-500">
                  Pending Review
                </span>
              )}
              {primaryPhone?.nameStatus === 'DECLINED' && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-red-500/10 text-red-500">
                  Declined
                </span>
              )}
            </div>
            {isEditing && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-500 flex items-start leading-relaxed">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="block mb-1">Critical Note:</strong> If you update your display name, it will undergo review again from Meta. 
                    This can take up to 24 hours. Your current name will remain active until approved.
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Category Section */}
          <div className="space-y-3">
            <label className={`block text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Category
            </label>
            <select
              value={editForm.vertical}
              onChange={(e) => setEditForm({ ...editForm, vertical: e.target.value })}
              disabled={!isEditing}
              className={cn("w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-blue-500/50",
                isDark ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900",
                !isEditing && "opacity-60 cursor-not-allowed"
              )}
            >
              <option value="">Select a category</option>
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.label} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Description Section */}
          <div className="space-y-3">
            <label className={`block text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Description
            </label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              disabled={!isEditing}
              rows={3}
              placeholder="Tell customers about your business..."
              className={cn("w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-blue-500/50",
                isDark ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900",
                !isEditing && "opacity-60 cursor-not-allowed"
              )}
            />
          </div>

          {/* About/Status Section */}
          <div className="space-y-3">
            <label className={`block text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              About (Status)
            </label>
            <input
              type="text"
              value={editForm.about}
              onChange={(e) => setEditForm({ ...editForm, about: e.target.value })}
              disabled={!isEditing}
              placeholder="Available"
              className={cn("w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-blue-500/50",
                isDark ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900",
                !isEditing && "opacity-60 cursor-not-allowed"
              )}
            />
          </div>

          {/* Contact Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className={`block text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Email
              </label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                disabled={!isEditing}
                placeholder="business@example.com"
                className={cn("w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-blue-500/50",
                  isDark ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900",
                  !isEditing && "opacity-60 cursor-not-allowed"
                )}
              />
            </div>
            <div className="space-y-3">
              <label className={`block text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Address
              </label>
              <input
                type="text"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                disabled={!isEditing}
                placeholder="123 Business St, City"
                className={cn("w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-blue-500/50",
                  isDark ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900",
                  !isEditing && "opacity-60 cursor-not-allowed"
                )}
              />
            </div>
          </div>

          {/* Websites Section */}
          <div className="space-y-4">
            <label className={`block text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Websites
            </label>
            <div className="space-y-3">
              <input
                type="url"
                value={editForm.website1}
                onChange={(e) => setEditForm({ ...editForm, website1: e.target.value })}
                disabled={!isEditing}
                placeholder="https://example.com"
                className={cn("w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-blue-500/50",
                  isDark ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900",
                  !isEditing && "opacity-60 cursor-not-allowed"
                )}
              />
              <input
                type="url"
                value={editForm.website2}
                onChange={(e) => setEditForm({ ...editForm, website2: e.target.value })}
                disabled={!isEditing}
                placeholder="https://another-example.com"
                className={cn("w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-blue-500/50",
                  isDark ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900",
                  !isEditing && "opacity-60 cursor-not-allowed"
                )}
              />
            </div>
          </div>

          {isEditing && (
            <div className="pt-6 border-t border-gray-800 flex justify-end space-x-4">
              <button
                onClick={handleCancelEditing}
                className={cn("px-6 py-2 rounded-xl text-sm font-bold transition-colors",
                  isDark ? "text-gray-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-100"
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-8 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center shadow-lg shadow-blue-600/20"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Live Preview */}
        <div className="hidden lg:block">
          <div className="sticky top-8">
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Live Preview
              </h4>
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-500/10 text-blue-500 uppercase">
                Customer View
              </span>
            </div>
            
            {/* WhatsApp Mobile UI Mockup */}
            <div className={cn("rounded-[3rem] border-8 p-4 shadow-2xl aspect-[9/19] max-w-[320px] mx-auto overflow-hidden relative",
              isDark ? "bg-[#0b141a] border-[#232d36]" : "bg-[#f0f2f5] border-[#d1d7db]"
            )}>
              {/* Status Bar */}
              <div className="flex justify-between items-center px-4 mb-4">
                <span className="text-xs font-medium">9:41</span>
                <div className="flex space-x-1">
                  <div className="w-4 h-4 rounded-full border border-current opacity-50" />
                  <div className="w-4 h-4 rounded-full border border-current opacity-50" />
                </div>
              </div>

              {/* App Header */}
              <div className={cn("flex items-center space-x-3 mb-6", isDark ? "text-white" : "text-gray-800")}>
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold">Business details</span>
              </div>

              {/* Profile Card */}
              <div className={cn("rounded-2xl p-4 mb-4 shadow-sm", isDark ? "bg-[#111b21]" : "bg-white")}>
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="w-24 h-24 rounded-full overflow-hidden mb-3 ring-4 ring-blue-500/20">
                    {phoneDetail?.profile_picture_url ? (
                      <img src={phoneDetail.profile_picture_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                        <UserIcon className="w-12 h-12 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                    {editForm.displayName || primaryAccount?.businessName}
                  </h3>
                  <p className="text-sm text-blue-500 font-medium">
                    {CATEGORY_OPTIONS.find(o => o.value === editForm.vertical)?.label || 'Business'}
                  </p>
                </div>

                <div className="flex justify-center space-x-8 border-t border-b py-4 border-gray-800/50 mb-4">
                  <div className="flex flex-col items-center space-y-1">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <WabaIcon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-medium opacity-60">Message</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <Globe className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium opacity-60">Website</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {editForm.description && (
                    <div className="flex items-start space-x-3">
                      <Info className="w-4 h-4 mt-0.5 opacity-40" />
                      <p className="text-xs leading-relaxed opacity-80">{editForm.description}</p>
                    </div>
                  )}
                  {editForm.address && (
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-4 h-4 mt-0.5 opacity-40" />
                      <p className="text-xs opacity-80">{editForm.address}</p>
                    </div>
                  )}
                  {editForm.email && (
                    <div className="flex items-start space-x-3">
                      <Mail className="w-4 h-4 mt-0.5 opacity-40" />
                      <p className="text-xs opacity-80">{editForm.email}</p>
                    </div>
                  )}
                  {(editForm.website1 || editForm.website2) && (
                    <div className="flex items-start space-x-3">
                      <Globe className="w-4 h-4 mt-0.5 opacity-40" />
                      <div className="space-y-1">
                        {editForm.website1 && <p className="text-xs text-blue-500">{editForm.website1}</p>}
                        {editForm.website2 && <p className="text-xs text-blue-500">{editForm.website2}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* About Section in Mockup */}
              <div className={cn("rounded-2xl p-4 shadow-sm", isDark ? "bg-[#111b21]" : "bg-white")}>
                <h4 className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2">About and phone number</h4>
                <p className="text-sm mb-1">{editForm.about || 'Available'}</p>
                <p className="text-xs opacity-40">{primaryPhone?.displayPhoneNumber}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SettingsSection({
  isDark,
  currentUserProfile,
  setCurrentUserProfile,
  notificationSettings
}: {
  isDark: boolean,
  currentUserProfile: any,
  setCurrentUserProfile: React.Dispatch<React.SetStateAction<any>>,
  notificationSettings: NotificationSettings
}) {
  const [profileForm, setProfileForm] = useState({
    firstName: currentUserProfile?.firstName || currentUserProfile?.displayName?.split(' ')[0] || '',
    lastName: currentUserProfile?.lastName || currentUserProfile?.displayName?.split(' ').slice(1).join(' ') || '',
    emailAddress: currentUserProfile?.emailAddress || currentUserProfile?.email || auth.currentUser?.email || '',
    contactNumber: currentUserProfile?.contactNumber || '',
    profilePicture: currentUserProfile?.profilePicture || auth.currentUser?.photoURL || ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [notificationForm, setNotificationForm] = useState<NotificationSettings>(notificationSettings);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  useEffect(() => {
    setProfileForm({
      firstName: currentUserProfile?.firstName || currentUserProfile?.displayName?.split(' ')[0] || '',
      lastName: currentUserProfile?.lastName || currentUserProfile?.displayName?.split(' ').slice(1).join(' ') || '',
      emailAddress: currentUserProfile?.emailAddress || currentUserProfile?.email || auth.currentUser?.email || '',
      contactNumber: currentUserProfile?.contactNumber || '',
      profilePicture: currentUserProfile?.profilePicture || auth.currentUser?.photoURL || ''
    });
  }, [currentUserProfile]);

  useEffect(() => {
    setNotificationForm(notificationSettings);
  }, [notificationSettings]);

  const handleProfileImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((prev) => ({ ...prev, profilePicture: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;

    const displayName = [profileForm.firstName, profileForm.lastName].filter(Boolean).join(' ').trim();
    const nextProfile = {
      ...currentUserProfile,
      firstName: profileForm.firstName.trim(),
      lastName: profileForm.lastName.trim(),
      displayName: displayName || currentUserProfile?.displayName || auth.currentUser.displayName || '',
      emailAddress: profileForm.emailAddress.trim(),
      contactNumber: profileForm.contactNumber.trim(),
      profilePicture: profileForm.profilePicture || ''
    };

    setIsSavingProfile(true);
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), nextProfile, { merge: true });
      if (displayName || profileForm.profilePicture) {
        await updateProfile(auth.currentUser, {
          displayName: displayName || auth.currentUser.displayName || undefined,
          photoURL: profileForm.profilePicture || auth.currentUser.photoURL || undefined
        });
      }
      setCurrentUserProfile(nextProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
      console.error('Failed to save profile settings:', error);
      showAppDialog({ tone: 'error', message: 'Unable to save your account settings right now.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!auth.currentUser) return;
    setIsSavingNotifications(true);
    try {
      const nextProfile = {
        ...currentUserProfile,
        notificationSettings: notificationForm
      };
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        notificationSettings: notificationForm
      }, { merge: true });
      setCurrentUserProfile(nextProfile);

      if (notificationForm.browserEnabled && 'Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
      console.error('Failed to save notification settings:', error);
      showAppDialog({ tone: 'error', message: 'Unable to save notification settings right now.' });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  return (
    <motion.div 
      key="settings"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl space-y-6 md:space-y-8"
    >
      <div className="grid grid-cols-1 gap-6 md:gap-8">
        <div className={cn("rounded-2xl md:rounded-3xl p-6 md:p-8 border", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <div className="flex items-center gap-3">
                <UserIcon className="text-[#5B45FF]" />
                <h3 className="text-lg md:text-xl font-bold">WhatsApp Business Account</h3>
              </div>
              <p className={cn("mt-2 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                Update your first name, last name, email address, contact number, and profile picture.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B45FF] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#5B45FF] disabled:opacity-50"
            >
              <Save size={16} />
              {isSavingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className={cn("rounded-[1.8rem] border p-5", isDark ? "border-gray-700 bg-gray-800/40" : "border-slate-200 bg-slate-50")}>
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] bg-[#5B45FF] text-white shadow-lg">
                  {profileForm.profilePicture ? (
                    <img src={profileForm.profilePicture} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black">
                      {(profileForm.firstName || currentUserProfile?.displayName || auth.currentUser?.displayName || '?')[0]}
                    </span>
                  )}
                </div>
                <label className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-all",
                  isDark ? "border-gray-700 bg-gray-900/60 hover:border-cyan-500" : "border-slate-200 bg-white hover:border-cyan-400"
                )}>
                  <Camera size={16} className="text-cyan-500" />
                  Change Picture
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
                </label>
                <p className="mt-3 text-xs text-slate-500">Use a square image for the cleanest profile display.</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">First Name</label>
                <input
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  className={cn("w-full rounded-2xl border px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]", isDark ? "border-gray-700 bg-gray-800 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Last Name</label>
                <input
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  className={cn("w-full rounded-2xl border px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]", isDark ? "border-gray-700 bg-gray-800 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Email Address</label>
                <input
                  type="email"
                  value={profileForm.emailAddress}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, emailAddress: e.target.value }))}
                  className={cn("w-full rounded-2xl border px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]", isDark ? "border-gray-700 bg-gray-800 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Contact Number</label>
                <input
                  value={profileForm.contactNumber}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, contactNumber: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className={cn("w-full rounded-2xl border px-4 py-4 text-sm outline-none transition-all focus:border-[#5B45FF]", isDark ? "border-gray-700 bg-gray-800 text-white" : "border-slate-200 bg-slate-50 text-slate-900")}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={cn("rounded-2xl md:rounded-3xl p-6 md:p-8 border", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <BellRing className="text-[#5B45FF]" />
                <h3 className="text-lg md:text-xl font-bold">Notifications</h3>
              </div>
              <p className={cn("mt-2 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                Tweak how new messages notify you across popup toasts, sound, and browser alerts.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveNotifications}
              disabled={isSavingNotifications}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B45FF] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#5B45FF]/20 transition-all hover:bg-[#5B45FF] disabled:opacity-50"
            >
              <Save size={16} />
              {isSavingNotifications ? 'Saving...' : 'Save Notification Settings'}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                key: 'toastEnabled',
                title: 'In-app Toasts',
                description: 'Show animated popup toasts for new incoming messages.'
              },
              {
                key: 'soundEnabled',
                title: 'Notification Sound',
                description: 'Play a short tone when a new incoming message arrives.'
              },
              {
                key: 'browserEnabled',
                title: 'Browser Notifications',
                description: 'Allow desktop/browser notifications when permission is granted.'
              }
            ].map((item) => (
              <div
                key={item.key}
                className={cn("rounded-[1.5rem] border p-5", isDark ? "border-gray-700 bg-gray-800/40" : "border-slate-200 bg-slate-50")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">{item.title}</p>
                    <p className={cn("mt-2 text-xs leading-5", isDark ? "text-slate-400" : "text-slate-500")}>
                      {item.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotificationForm((prev) => ({
                      ...prev,
                      [item.key]: !prev[item.key as keyof NotificationSettings]
                    }))}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all",
                      notificationForm[item.key as keyof NotificationSettings]
                        ? "bg-[#5B45FF]"
                        : (isDark ? "bg-gray-700" : "bg-slate-300")
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-white transition-all",
                        notificationForm[item.key as keyof NotificationSettings] ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PhoneNumbersSection({ isDark, phoneNumbers, businessAccounts }: { isDark: boolean, phoneNumbers: any[], businessAccounts: any[] }) {
  return (
    <motion.div 
      key="phone-numbers"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 md:space-y-8"
    >
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold">WhatsApp Phone Numbers</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6">
        {phoneNumbers.map((pn, idx) => {
          const waba = businessAccounts.find(ba => ba.id === pn.wabaId);
          return (
            <div key={pn.phoneId || idx} className={cn("p-6 rounded-2xl md:rounded-3xl border", isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-[#5B45FF]/10 flex items-center justify-center shrink-0">
                    <Phone className="text-[#5B45FF] w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg md:text-xl font-bold truncate">{pn.displayPhoneNumber}</h3>
                    <p className="text-xs md:text-sm text-gray-500 truncate">Phone ID: {pn.phoneId}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={cn("px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-bold uppercase", 
                    pn.status === 'CONNECTED' ? "bg-[#5B45FF]/10 text-[#5B45FF]" : "bg-red-500/10 text-red-500"
                  )}>
                    {pn.status || 'UNKNOWN'}
                  </span>
                  <span className={cn("px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-bold uppercase", 
                    pn.qualityRating === 'GREEN' ? "bg-[#5B45FF]/10 text-[#5B45FF]" : 
                    pn.qualityRating === 'YELLOW' ? "bg-yellow-500/10 text-yellow-500" : 
                    pn.qualityRating === 'RED' ? "bg-red-500/10 text-red-500" : "bg-gray-500/10 text-gray-500"
                  )}>
                    Quality: {pn.qualityRating || 'UNKNOWN'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-1">Verified Name</p>
                    <p className="text-sm md:text-base font-medium truncate">{pn.verifiedName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-1">Name Status</p>
                    <p className="text-sm md:text-base font-medium">{pn.nameStatus || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-1">New Name Status</p>
                    <p className="text-sm md:text-base font-medium">{pn.newNameStatus || 'NONE'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Verification Status</p>
                    <p className="font-medium">{pn.codeVerificationStatus || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Messaging Limit Tier</p>
                    <p className="font-medium">{pn.whatsappBusinessManagerMessagingLimit || pn.messagingLimitTier || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Quality Score</p>
                    <p className="font-medium">{pn.qualityScore || 'N/A'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">WABA ID</p>
                    <p className="font-medium font-mono text-sm">{pn.wabaId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">WABA Name</p>
                    <p className="font-medium">{waba?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Business Verification</p>
                    <p className="font-medium">{pn.businessVerificationStatus || waba?.accountReviewStatus || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {phoneNumbers.length === 0 && (
          <div className={cn("p-12 text-center rounded-3xl border", isDark ? "border-gray-800" : "border-gray-200")}>
            <Phone className="mx-auto mb-4 text-gray-500" size={48} />
            <h3 className="text-xl font-bold mb-2">No Phone Numbers Found</h3>
            <p className="text-gray-500">Connect a WhatsApp Business Account to see phone numbers here.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// --- Helper Components ---

function NavItem({ icon, label, active, onClick, isDark, collapsed = false }: { icon: React.ReactNode, label: string, active: boolean, onClick?: () => void, isDark: boolean, collapsed?: boolean }) {
  return (
    <button 
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-2.5 py-2.5 text-left font-medium transition-all",
        collapsed && "md:justify-center",
        active 
          ? "border-[#5B45FF]/18 bg-[#5B45FF] text-white shadow-[0_14px_30px_rgba(91,69,255,0.2)]"
          : (isDark ? "border-transparent text-slate-400 hover:border-white/8 hover:bg-white/6 hover:text-white" : "border-transparent text-slate-600 hover:border-slate-200/90 hover:bg-slate-50 hover:text-slate-950")
      )}
    >
      <span className={cn(
        "absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full transition-all",
        active ? "bg-white/80 opacity-100" : "bg-[#5B45FF] opacity-0 group-hover:opacity-35"
      )} />
      <span className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all",
        active
          ? "bg-white/15 text-white"
          : (isDark ? "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white" : "bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/70 group-hover:text-[#5B45FF] group-hover:ring-[#5B45FF]/20")
      )}>
        {icon}
      </span>
      <span className={cn("relative truncate text-[13px] font-semibold", collapsed && "md:hidden")}>{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon, trend, isDark }: { label: string, value: string, icon: React.ReactNode, trend?: string, isDark: boolean }) {
  return (
    <div className={cn(
      "p-4 md:p-5 rounded-2xl border transition-all hover:-translate-y-0.5",
      isDark ? "bg-slate-900/88 border-white/8 shadow-[0_18px_44px_rgba(2,8,23,0.22)]" : "bg-white/90 border-slate-200/80 shadow-[0_16px_38px_rgba(15,23,42,0.06)]"
    )}>
      <div className="flex justify-between items-start mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isDark ? "bg-white/6 text-slate-300" : "bg-slate-100 text-slate-600")}>
          {icon}
        </div>
        {trend && <span className="text-[10px] md:text-xs font-bold text-[#5B45FF] bg-[#5B45FF]/10 px-2 py-1 rounded-lg">{trend}</span>}
      </div>
      <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-[0.18em]">{label}</p>
      <h4 className="text-xl md:text-2xl font-extrabold mt-1">{value}</h4>
    </div>
  );
}

function HealthItem({ label, value, status, isDark }: { label: string, value: string, status: 'success' | 'info' | 'warning', isDark: boolean }) {
  return (
    <div className={cn("flex justify-between items-center rounded-2xl border px-3 py-3", isDark ? "border-white/8 bg-white/5" : "border-slate-200 bg-white/80")}>
      <div className="flex items-center gap-2">
        <Info size={12} className="text-gray-500 shrink-0" />
        <span className="text-xs md:text-sm text-gray-400 truncate">{label}</span>
      </div>
      <span className={cn(
        "px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase shrink-0",
        status === 'success' ? "bg-[#5B45FF]/10 text-[#5B45FF]" : "bg-blue-500/10 text-blue-500"
      )}>
        {value}
      </span>
    </div>
  );
}
