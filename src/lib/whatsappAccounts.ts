export type StoredWhatsAppAccount = {
  id: string;
  label?: string;
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  twoStepVerificationPin?: string | null;
  registrationStatus?: string | null;
  registeredAt?: string | null;
  connectedAt?: string;
  updatedAt?: string;
};

export type LegacyWhatsAppCredentials = {
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  wabaId?: string;
  twoStepVerificationPin?: string | null;
  registrationStatus?: string | null;
  registeredAt?: string | null;
};

export const getWhatsAppAccountId = (businessAccountId?: string, phoneNumberId?: string) =>
  [businessAccountId || 'waba', phoneNumberId || 'phone'].join(':');

export const normalizeWhatsAppAccount = (
  account: Partial<StoredWhatsAppAccount> & LegacyWhatsAppCredentials,
  fallbackLabel?: string
): StoredWhatsAppAccount | null => {
  const accessToken = String(account.accessToken || '').trim();
  const phoneNumberId = String(account.phoneNumberId || '').trim();
  const businessAccountId = String(account.businessAccountId || account.wabaId || '').trim();

  if (!accessToken || !phoneNumberId || !businessAccountId) return null;

  return {
    id: String(account.id || getWhatsAppAccountId(businessAccountId, phoneNumberId)),
    label: account.label || fallbackLabel || `WhatsApp ${phoneNumberId}`,
    accessToken,
    phoneNumberId,
    businessAccountId,
    twoStepVerificationPin: account.twoStepVerificationPin || null,
    registrationStatus: account.registrationStatus || null,
    registeredAt: account.registeredAt || null,
    connectedAt: account.connectedAt,
    updatedAt: account.updatedAt
  };
};

export const getWhatsAppAccounts = (profile: any): StoredWhatsAppAccount[] => {
  const fromList = Array.isArray(profile?.whatsappAccounts)
    ? profile.whatsappAccounts
        .map((account: any) => normalizeWhatsAppAccount(account, profile?.companyName))
        .filter(Boolean) as StoredWhatsAppAccount[]
    : [];

  const legacyAccount = normalizeWhatsAppAccount(profile?.whatsappCredentials || {}, profile?.companyName);
  const merged = new Map<string, StoredWhatsAppAccount>();

  if (legacyAccount) {
    merged.set(legacyAccount.id, legacyAccount);
  }

  fromList.forEach((account) => {
    merged.set(account.id, account);
  });

  return Array.from(merged.values());
};

export const getActiveWhatsAppAccount = (profile: any): StoredWhatsAppAccount | null => {
  const accounts = getWhatsAppAccounts(profile);
  if (!accounts.length) return null;

  const activeId = String(profile?.activeWhatsappAccountId || '');
  return accounts.find((account) => account.id === activeId) || accounts[0];
};

export const upsertWhatsAppAccount = (
  profile: any,
  nextAccount: StoredWhatsAppAccount
): StoredWhatsAppAccount[] => {
  const accounts = getWhatsAppAccounts(profile);
  const withoutCurrent = accounts.filter((account) => account.id !== nextAccount.id);
  return [...withoutCurrent, nextAccount];
};

export const getWhatsAppPhoneNumberIds = (accounts: StoredWhatsAppAccount[]) =>
  Array.from(new Set(accounts.map((account) => account.phoneNumberId).filter(Boolean)));

export const toLegacyWhatsAppCredentials = (account: StoredWhatsAppAccount) => ({
  accessToken: account.accessToken,
  phoneNumberId: account.phoneNumberId,
  businessAccountId: account.businessAccountId,
  twoStepVerificationPin: account.twoStepVerificationPin || null,
  registrationStatus: account.registrationStatus || null,
  registeredAt: account.registeredAt || null
});
