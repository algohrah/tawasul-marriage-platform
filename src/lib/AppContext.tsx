import { dataService } from './data/DataService';
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { pushToast, dismissToastById } from './toastBus';
import supabaseClient from './supabase';

// ===== أدوات مزامنة الجداول الحقيقية (المصدر الوحيد للحقيقة) =====

/** تحويل صف تذكرة من قاعدة البيانات إلى شكل الواجهة */
function mapTicketRow(row: any): any {
  const detailMessages = Array.isArray(row.details?.messages) ? row.details.messages : [];
  const messages = detailMessages.length
    ? detailMessages
    : [{ id: 'msg-init', sender: 'user', text: row.message || '', time: '' }];
  return {
    id: String(row.id),
    userId: row.user_id || 'm2',
    subject: row.subject || 'تذكرة دعم',
    category: row.category || 'استفسار عام',
    status: row.status || 'open',
    priority: row.priority || 'normal',
    updatedAt: row.updated_at ? new Date(row.updated_at).toLocaleDateString('ar-SA') : 'الآن',
    messages,
    assignedTo: row.details?.assignedTo || undefined,
  };
}

/** إرسال تذكرة للخادم (إنشاء أو تحديث) */
async function pushTicketToServer(t: any): Promise<string | null> {
  const payload = {
    subject: t.subject,
    category: t.category,
    priority: t.priority || 'normal',
    status: t.status || 'open',
    message: t.messages?.[0]?.text || '',
    user_id: t.userId || 'm2',
    details: { messages: t.messages || [], assignedTo: t.assignedTo || null },
  };
  try {
    if (/^\d+$/.test(String(t.id))) {
      await fetch('/api/support-tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(t.id), ...payload }),
      });
      return null;
    }
    const res = await fetch('/api/support-tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.id) return String(data.id);
    }
  } catch { /* الشبكة غير متاحة — تبقى النسخة المحلية */ }
  return null;
}
import { MEMBERS } from './members';
import type { Member } from './members';
import { ADMIN_MEMBERS, ADMIN_NOTIFICATIONS } from './admin-data';
import type { AdminMember } from './admin-data';
import { INTEREST_REQUESTS, FEE_CONFIG, type InterestRequest, type RequestStatus, type MediationStage } from './data';

export interface ExemptRequest {
  id: string;
  requestId: string;
  userId: string;
  userNickname: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

interface UserProfile {
  name: string;
  email: string;
  city: string;
  age: number;
  plan: 'free' | 'gold' | 'elite';
  verified: boolean;
  profileCompletion: number;
  credits: number;
  isBoosted?: boolean;
  realName: string;
  phone: string;
  whatsapp: string;
  password: string;
}

interface AuthUser {
  name: string;
  isLoggedIn: boolean;
  memberId?: string;   // هوية العضو النشط (للتنقّل بين الحسابات)
  profile: UserProfile;
}

import { PLANS as DEFAULT_PLANS, SUPPORT_TICKETS as DEFAULT_TICKETS, DEFAULT_MESSAGE_PACKAGES } from './data';
import type { Plan, SupportTicket, InterestPurchaseSettings, MemberReport, AdminUser, AdminPermissions, MessagePackage } from './types';
import { calculateCompatibility, type CompatResult } from './compatibility';
import { getNationalityForCountry } from './registrationOptions';

interface PaypalSettings {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
  guestCheckout: boolean;
  active: boolean;
}

export interface PaymentSettings {
  paypalActive: boolean;
  cryptoActive: boolean;
  bankActive: boolean;
  cryptoWalletAddress: string;
  bankDetails: string;
  forceSingleMethod: 'none' | 'paypal' | 'crypto' | 'bank';
}

export interface SocialSettings {
  whatsappNumber: string;
  showWhatsapp: boolean;
  twitter: string;
  showTwitter: boolean;
  instagram: string;
  showInstagram: boolean;
  snapchat: string;
  showSnapchat: boolean;
  facebook: string;
  showFacebook: boolean;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

/** مصفوفة ثابتة فارغة — تحافظ على توافق الواجهة القديمة دون إعادة رسم */
const EMPTY_TOASTS: Toast[] = [];

interface AppContextType {
  user: AuthUser;
  /** هل انتهى التحميل الأولي لبيانات الأعضاء من الخادم؟ */
  membersLoading: boolean;
  /** خطأ الاتصال بالخادم أثناء تحميل الأعضاء (إن وجد) */
  membersError: string | null;
  /** إعادة محاولة تحميل الأعضاء من الخادم */
  retryLoadMembers: () => void;
  login: (name: string, memberId?: string) => void;
  /** تسجيل دخول حقيقي عبر Supabase Auth — يستقبل بيانات العضو المرتبط بحساب المصادقة الفعلي */
  loginWithSession: (memberRow: any, authEmail: string) => void;
  logout: () => void;
  registerNewMember: (memberData: any) => Promise<{ ok: boolean; error?: string }>;
  blockedMembers: Set<string>;
  toggleBlock: (id: string) => void;
  impersonateUser: (member: {
    id: string;
    nickname: string;
    gender?: string;
    age?: number;
    country?: string;
    city?: string;
    realName?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    plan?: string;
    password?: string;
    verified?: boolean;
  }) => void;
  importMembers: (newMembers: AdminMember[], replaceExisting?: boolean) => void;
  likedMembers: Set<string>;
  toggleLike: (id: string) => void;
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: number) => void;
  upgradePlan: (plan: 'gold' | 'elite') => void;
  plans: Plan[];
  updatePlan: (updated: Plan) => void;
  addPlan: (newPlan: Plan) => void;
  deletePlan: (id: string) => void;
  paypalSettings: PaypalSettings;
  updatePaypalSettings: (settings: PaypalSettings) => void;
  paymentSettings: PaymentSettings;
  updatePaymentSettings: (settings: PaymentSettings) => void;
  socialSettings: SocialSettings;
  updateSocialSettings: (settings: SocialSettings) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  showDarkModeToggle: boolean;
  updateShowDarkModeToggle: (show: boolean) => void;
  usage: {
    messagesSent: number;
    searchesDone: number;
    contactsViewed: number;
  };
  checkLimit: (action: 'message' | 'search' | 'contact') => { allowed: boolean; current: number; max: number; error?: string };
  incrementUsage: (action: 'message' | 'search' | 'contact') => void;
  buyMicrotransaction: (type: 'messages_20' | 'contact_1', cost: number) => void;
  boostProfile: () => void;
  isBoosted: boolean;
  resetUsage: () => void;
  interestPurchaseSettings: InterestPurchaseSettings;
  updateInterestPurchaseSettings: (settings: InterestPurchaseSettings) => void;
  extraInterestsCount: number;
  setExtraInterestsCount: React.Dispatch<React.SetStateAction<number>>;
  unlimitedInterestsUntil: number;
  setUnlimitedInterestsUntil: React.Dispatch<React.SetStateAction<number>>;
  buyExtraInterests: () => void;
  messagePackages: MessagePackage[];
  updateMessagePackage: (updated: MessagePackage) => void;

  // Real-Time Stateful Collections & Admin integrations
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  adminMembers: AdminMember[];
  setAdminMembers: React.Dispatch<React.SetStateAction<AdminMember[]>>;
  interestRequests: InterestRequest[];
  adminUsers: AdminUser[];
  addAdminUser: (admin: Omit<AdminUser, 'id' | 'createdAt'>) => void;
  updateAdminUser: (id: string, updates: Partial<AdminUser>) => void;
  deleteAdminUser: (id: string) => void;
  currentAdminRole: AdminUser['role'];
  currentAdminPermissions: AdminPermissions;
  currentAdminName: string;
  simulateAdminLogin: (id: string | null) => void; // null means super admin (default)
  setInterestRequests: React.Dispatch<React.SetStateAction<InterestRequest[]>>;
  depositQuota: {
    hasActiveQuota: boolean;
    remainingAttempts: number;
    totalPaidAmount: number;
    paidAt?: string;
    selectedTierPrice?: number;
  };
  setDepositQuota: React.Dispatch<React.SetStateAction<{
    hasActiveQuota: boolean;
    remainingAttempts: number;
    totalPaidAmount: number;
    paidAt?: string;
    selectedTierPrice?: number;
  }>>;
  adminNotifications: any[];
  setAdminNotifications: React.Dispatch<React.SetStateAction<any[]>>;
  supportTickets: SupportTicket[];
  setSupportTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  reports: MemberReport[];
  submitReport: (reportedId: string, reportedName: string, reason: string) => void;
  resolveReport: (id: string) => void;
  deleteReport: (id: string) => void;
  updateReport: (id: string, fields: Partial<MemberReport>) => void;
  addReportActionLog: (id: string, action: string, adminNote?: string, by?: string) => void;

  // Secure API boundaries for Admin operations
  adminDeleteMember: (id: string) => void;
  adminUpdateMemberStatus: (id: string, status: 'active' | 'suspended' | 'pending' | 'banned', reason?: string) => void;
  adminDeleteMemberFromReports: (id: string) => void;
  adminUpdateMember: (updated: AdminMember) => void;
  adminSendBulkBroadcast: (title: string, message: string, audience: 'all' | 'verified' | 'premium' | 'specific', specificIds?: string[]) => Promise<void>;
  adminUpdateInterestRequestStatus: (id: string, status: RequestStatus | 'accepted', declineReason?: string) => void;
  adminUpdateInterestRequestDetails: (id: string, fields: Partial<InterestRequest>) => void;
  adminCancelAndRefund: (requestId: string, type: 'full' | 'partial') => void;
  adminProcessExemptRequest: (id: string, action: 'approve' | 'reject') => void;
  adminModeratePreExchangeMessage: (requestId: string, messageId: string, action: 'approve' | 'reject') => void;
  
  // Exemption system
  exemptRequests: ExemptRequest[];
  submitExemptRequest: (requestId: string, reason: string) => void;
  payInterestRequestFee: (requestId: string, isSender: boolean, pledgeAccepted: boolean) => void;
  payPreExchangeChatFee: (requestId: string, isSender: boolean) => void;
  sendPreExchangeChatMessage: (requestId: string, text: string, isSender: boolean) => void;
  flagPreExchangeNoMoney: (requestId: string, isSender: boolean) => void;
  choosePreExchangeOption: (requestId: string, choice: 'chat' | 'direct_deposit' | null) => void;

  calculateCompat: (m1: Member, m2: Member) => number;
  calculateCompatDetailed: (target: Member) => CompatResult;
  sendInterestRequest: (memberId: string, messageText: string) => Promise<{ ok: boolean; error?: string; data?: any }>;
  sendSupportMessage: (ticketId: string, text: string, sender: 'user' | 'admin') => void;
  createSupportTicket: (subject: string, category: 'استفسار عام' | 'طلب ترقية' | 'مشكلة تقنية' | 'شكوى' | 'اقتراح', initialMessageText: string, userId?: string) => SupportTicket;
  showCompatibility: boolean;
  compatibilityPaidOnly: boolean;
  updateCompatibilitySettings: (enabled: boolean, paidOnly: boolean) => void;
  profileData: ProfileData;
  updateProfileData: (fields: Partial<ProfileData>) => Promise<boolean>;
  updateAccountInfo: (fields: { realName?: string; email?: string; phone?: string; whatsapp?: string; password?: string }) => void;
  allowProfileHiding: boolean;
  requireVerificationForRequests: boolean;
  enableWhoViewedMe: boolean;
  enableProfileBoosting: boolean;
  maxActiveRequests: number;
  pendingRequestsExpiryDays: number;
  updateFeatureSettings: (updates: {
    allowProfileHiding?: boolean;
    requireVerificationForRequests?: boolean;
    enableWhoViewedMe?: boolean;
    enableProfileBoosting?: boolean;
    maxActiveRequests?: number;
    pendingRequestsExpiryDays?: number;
  }) => void;
  isProfileHidden: boolean;
  toggleProfileHiding: () => void;
}

export const DEFAULT_PROFILE: UserProfile = {
  name: 'سارة',
  email: 'demo@tawasul.sa',
  city: 'الرياض',
  age: 26,
  plan: 'gold',
  verified: true,
  profileCompletion: 85,
  credits: 12,
  isBoosted: false,
  realName: 'سارة أحمد القحطاني',
  phone: '+966501234567',
  whatsapp: '+966501234567',
  password: 'password123',
};

// ===== بيانات الملف الشخصي التفصيلية (كل حقول التسجيل) =====
export interface ProfileData {
  id?: string;
  gender: string;
  nickname: string;
  birthDate: string;
  age: number;
  country: string;
  city: string;
  district: string;
  sect: string;
  sectOther: string;
  nationality: string;
  maritalStatus: string;
  marriageType?: string;
  tribe?: string;
  childrenCount: string;
  childrenLiveWith: string;
  hasChildren: string;
  wifeCount: string;
  seekingWife: string;
  height: number;
  weight: number;
  skinColor: string;
  ethnicity: string;
  health: string;
  smoking: string;
  education: string;
  workType: string;
  jobTitle: string;
  housing: string;
  bio: string;
  // مواصفات الشريك
  pCountry: string;
  pCity: string;
  pAgeMin: number | string;
  pAgeMax: number | string;
  pNationality: string;
  pMaritalStatus: string;
  pAcceptChildren: string;
  pNotes: string;
}

const DEFAULT_PROFILE_DATA: ProfileData = {
  id: 'm2',
  gender: 'female',
  nickname: 'سارة',
  birthDate: '',
  age: 26,
  country: 'السعودية',
  city: 'الرياض',
  district: '',
  sect: '',
  sectOther: '',
  nationality: 'السعودية',
  maritalStatus: 'single',
  marriageType: 'announced',
  tribe: '',
  childrenCount: '',
  childrenLiveWith: '',
  hasChildren: '',
  wifeCount: '',
  seekingWife: '',
  height: 0,
  weight: 0,
  skinColor: '',
  ethnicity: '',
  health: '',
  smoking: '',
  education: '',
  workType: '',
  jobTitle: '',
  housing: '',
  bio: '',
  pCountry: '',
  pCity: '',
  pAgeMin: '',
  pAgeMax: '',
  pNationality: '',
  pMaritalStatus: '',
  pAcceptChildren: '',
  pNotes: '',
};

const DEFAULT_PAYPAL: PaypalSettings = {
  clientId: 'AX_demo_paypal_client_id_12345',
  clientSecret: 'SK_demo_secret_key_54321',
  mode: 'sandbox',
  guestCheckout: true,
  active: true,
};

const DEFAULT_PAYMENTS_CONFIG: PaymentSettings = {
  paypalActive: true,
  cryptoActive: true,
  bankActive: true,
  cryptoWalletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F (USDT ERC20)',
  bankDetails: 'مصرف الراجحي - رقم الحساب: SA8980000012345678901234 - باسم شركة توافق المحدودة',
  forceSingleMethod: 'none'
};

const DEFAULT_SOCIALS: SocialSettings = {
  whatsappNumber: '966572133783',
  showWhatsapp: true,
  twitter: 'https://twitter.com/tawasul_sa',
  showTwitter: true,
  instagram: 'https://instagram.com/tawasul_sa',
  showInstagram: true,
  snapchat: 'https://snapchat.com/add/tawasul_sa',
  showSnapchat: true,
  facebook: 'https://facebook.com/tawasul_sa',
  showFacebook: false,
};

function deduplicateById<T extends { id?: string }>(list: T[]): T[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item) continue;
    const id = item.id || `gen-${i}`;
    if (!seen.has(id)) {
      seen.add(id);
      result.push(item.id ? item : { ...item, id });
    }
  }
  return result;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [user, setUser] = useState<AuthUser>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('auth_user');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return {
              ...parsed,
              profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
            };
          }
        } catch { /* ignore error */ }
      }
    }
    return {
      name: '',
      isLoggedIn: false,
      profile: DEFAULT_PROFILE,
    };
  });
  const [likedMembers, setLikedMembers] = useState<Set<string>>(new Set());
  const [blockedMembers, setBlockedMembers] = useState<Set<string>>(new Set());

  // التوستات تُدار الآن عبر ناقل منفصل (toastBus) — لا تعيد رسم التطبيق كاملاً
  const toasts: Toast[] = EMPTY_TOASTS;

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    pushToast(message, type);
  }, []);

  const dismissToast = useCallback((id: number) => {
    dismissToastById(id);
  }, []);

  // Feature Settings States
  const [allowProfileHiding, setAllowProfileHiding] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('allow_profile_hiding');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });

  const [requireVerificationForRequests, setRequireVerificationForRequests] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('require_verification_for_requests');
      return saved === 'true';
    }
    return false;
  });

  const [enableWhoViewedMe, setEnableWhoViewedMe] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('enable_who_viewed_me');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });

  const [enableProfileBoosting, setEnableProfileBoosting] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('enable_profile_boosting');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });

  const [maxActiveRequests, setMaxActiveRequests] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('max_active_requests');
      return saved ? parseInt(saved, 10) : 3;
    }
    return 3;
  });

  const [pendingRequestsExpiryDays, setPendingRequestsExpiryDays] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('pending_requests_expiry_days');
      return saved ? parseInt(saved, 10) : 7;
    }
    return 7;
  });

  // Persistent Collections for full administration real-time integration
  const [members, setMembersRaw] = useState<Member[]>([]);
  const setMembers = useCallback((val: Member[] | ((prev: Member[]) => Member[])) => {
    setMembersRaw((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      return deduplicateById(next);
    });
  }, []);

  // فلترة الأعضاء النشطين فقط للعرض العام (إخفاء المحذوفين/المحظورين/المجمّدين/المخفيين)
  const activeMembers = useMemo(() => {
    if (typeof window === 'undefined') return members;
    try {
      const metaRaw = dataService.db.settings.get('twafok_admin_meta_v1');
      const meta = metaRaw ? JSON.parse(metaRaw) : {};
      return members.filter((m) => {
        if (!m || !m.id) return false;
        const am = meta[m.id];
        if (am) {
          if (am.deleted) return false;
          if (am.status && am.status !== 'active') return false;
        }
        if (m.status && m.status !== 'active') return false;

        // تصفية الحسابات المخفية إذا تم تمكين ميزة إخفاء الحساب من الإدارة ولم يكن الحساب يخص المستخدم نفسه
        const isSelf = user && user.memberId && m.id === user.memberId;
        if (!isSelf && allowProfileHiding) {
          const isHidden = dataService.db.settings.get(`profile_hidden_${m.id}`) === 'true';
          if (isHidden) return false;
        }

        return true;
      });
    } catch {
      return members;
    }
  }, [members, allowProfileHiding, user]);

  const [adminMembers, setAdminMembersRaw] = useState<AdminMember[]>([]);
  const setAdminMembers = useCallback((val: AdminMember[] | ((prev: AdminMember[]) => AdminMember[])) => {
    setAdminMembersRaw((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      return deduplicateById(next);
    });
  }, []);

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('saved_admin_users');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore error */ }
      }
    }
    return [
      {
        id: 'admin-1',
        name: 'المدير العام',
        email: 'admin@tawafok.com',
        role: 'super_admin',
        permissions: { manage_members: true, manage_requests: true, manage_support: true, manage_content: true, view_sensitive_data: true },
        status: 'active',
        createdAt: new Date().toISOString(),
      }
    ];
  });

  const [currentAdminId, setCurrentAdminId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const currentUser = localStorage.getItem('twafok_current_admin_user');
      if (currentUser) {
        try {
          const parsed = JSON.parse(currentUser);
          if (parsed?.id) return parsed.id;
        } catch { /* ignore */ }
      }
      const activeEmail = localStorage.getItem('twafok_active_admin_email');
      if (activeEmail) {
        const saved = dataService.db.settings.get('saved_admin_users');
        if (saved) {
          try {
            const users = JSON.parse(saved);
            const found = users.find((u: any) => u.email?.toLowerCase().trim() === activeEmail.toLowerCase().trim());
            if (found?.id) return found.id;
          } catch { /* ignore */ }
        }
      }
    }
    return null;
  });

  useEffect(() => {
    if (!isInitialized) return;
    dataService.db.settings.set('saved_admin_users', JSON.stringify(adminUsers));
    try {
      localStorage.setItem('saved_admin_users', JSON.stringify(adminUsers));
    } catch { /* ignore */ }
  }, [adminUsers, isInitialized]);

  const addAdminUser = (admin: Omit<AdminUser, 'id' | 'createdAt'>) => {
    setAdminUsers(prev => [...prev, { ...admin, id: 'admin-' + Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString() }]);
    showToast('تم إضافة المشرف بنجاح', 'success');
  };

  const updateAdminUser = (id: string, updates: Partial<AdminUser>) => {
    setAdminUsers(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    showToast('تم تحديث بيانات المشرف', 'success');
  };

  const deleteAdminUser = (id: string) => {
    setAdminUsers(prev => prev.filter(a => a.id !== id));
    showToast('تم حذف المشرف', 'info');
  };

  const simulateAdminLogin = (id: string | null) => {
    setCurrentAdminId(id);
    showToast(id ? 'تم التبديل لصلاحيات المشرف المختار' : 'تم التبديل لصلاحيات المدير العام', 'info');
  };

  const currentAdmin = currentAdminId ? adminUsers.find(a => a.id === currentAdminId) : adminUsers.find(a => a.role === 'super_admin');
  const currentAdminName = currentAdmin?.name || 'الإدارة';
  const currentAdminRole = currentAdmin?.role || 'super_admin';
  const currentAdminPermissions = currentAdmin?.permissions || { manage_members: true, manage_requests: true, manage_support: true, manage_content: true, view_sensitive_data: true };

  // Helper to synchronously load and map legacy requests from the real database (twafok_local_db_v4)
  const getMappedRequestsFromDB = useCallback((): InterestRequest[] => {
    if (typeof window === 'undefined') return INTEREST_REQUESTS;
    try {
      const raw = localStorage.getItem('twafok_local_db_v4');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.requests)) {
          return parsed.requests.map((r: any) => {
            let status: RequestStatus = 'pending';
            if (r.journey_stage === 'sent') status = 'pending';
            else if (r.journey_stage === 'accepted') status = 'accepted_pending_payment';
            else if (r.journey_stage === 'seriousness') status = 'accepted_pending_payment';
            else if (r.journey_stage === 'coordination') status = 'in_mediation';
            else if (r.journey_stage === 'sharia_viewing') status = 'in_mediation';
            else if (r.journey_stage === 'engagement') status = 'in_mediation';
            else if (r.journey_stage === 'completed') status = 'completed';
            else if (r.journey_stage === 'declined') status = 'declined';
            else if (r.journey_stage === 'cancelled') status = 'cancelled';

            if (r.sender_paid && r.receiver_paid) {
              if (status === 'accepted_pending_payment') {
                status = 'paid';
              }
            }

            return {
              id: String(r.id),
              requestNumber: Number(r.request_number) || Number(r.requestNumber) || undefined,
              sourceType: r.source_type || r.sourceType || undefined,
              senderId: r.sender_id,
              receiverId: r.receiver_id,
              status: status,
              message: r.message || 'طلب اهتمام مرسل عبر الإدارة',
              time: new Date(r.created_at).toLocaleDateString('ar-SA'),
              createdAt: new Date(r.created_at).getTime(),
              paymentStatus: (r.sender_paid && r.receiver_paid) ? 'paid' : 'waiting_for_payment',
              senderPaid: r.sender_paid,
              receiverPaid: r.receiver_paid,
              meetingDate: r.meeting_date || undefined,
              meetingNotes: r.meeting_notes || undefined,
              declineReason: r.decline_reason || undefined,
              adminNotes: r.admin_notes || undefined,
            };
          });
        }
      }
    } catch (e) {
      console.error('Error loading requests from localStore database:', e);
    }
    
    // Fallback to legacy settings key
    const saved = dataService.db.settings.get('saved_interest_requests');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore error */ }
    }
    return INTEREST_REQUESTS;
  }, []);

  const [interestRequests, setInterestRequests] = useState<InterestRequest[]>(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('twafok_local_db_v4');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.requests)) {
            return parsed.requests.map((r: any) => {
              let status: RequestStatus = 'pending';
              if (r.journey_stage === 'sent') status = 'pending';
              else if (r.journey_stage === 'accepted') status = 'accepted_pending_payment';
              else if (r.journey_stage === 'seriousness') status = 'accepted_pending_payment';
              else if (r.journey_stage === 'coordination') status = 'in_mediation';
              else if (r.journey_stage === 'sharia_viewing') status = 'in_mediation';
              else if (r.journey_stage === 'engagement') status = 'in_mediation';
              else if (r.journey_stage === 'completed') status = 'completed';
              else if (r.journey_stage === 'declined') status = 'declined';
              else if (r.journey_stage === 'cancelled') status = 'cancelled';

              if (r.sender_paid && r.receiver_paid) {
                if (status === 'accepted_pending_payment') {
                  status = 'paid';
                }
              }

              return {
                id: String(r.id),
                requestNumber: Number(r.request_number) || Number(r.requestNumber) || undefined,
                sourceType: r.source_type || r.sourceType || undefined,
                senderId: r.sender_id,
                receiverId: r.receiver_id,
                status: status,
                message: r.message || 'طلب اهتمام مرسل عبر الإدارة',
                time: new Date(r.created_at).toLocaleDateString('ar-SA'),
                createdAt: new Date(r.created_at).getTime(),
                paymentStatus: (r.sender_paid && r.receiver_paid) ? 'paid' : 'waiting_for_payment',
                senderPaid: r.sender_paid,
                receiverPaid: r.receiver_paid,
                meetingDate: r.meeting_date || undefined,
                meetingNotes: r.meeting_notes || undefined,
                declineReason: r.decline_reason || undefined,
                adminNotes: r.admin_notes || undefined,
              };
            });
          }
        } catch { /* ignore */ }
      }
      
      const saved = dataService.db.settings.get('saved_interest_requests');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore error */ }
      }
    }
    return INTEREST_REQUESTS;
  });

  // Refresh helper
  const refreshInterestRequests = useCallback(async () => {
    try {
      const dbReqs = await dataService.db.getRequests();
      if (dbReqs && Array.isArray(dbReqs)) {
        const mapped: InterestRequest[] = dbReqs.map((r: any) => {
          let status: RequestStatus = 'pending';
          const stage = r.journey_stage || r.status || 'sent';
          if (stage === 'sent' || stage === 'pending') status = 'pending';
          else if (stage === 'accepted' || stage === 'seriousness') status = 'accepted_pending_payment';
          else if (stage === 'coordination' || stage === 'sharia_viewing' || stage === 'engagement') status = 'in_mediation';
          else if (stage === 'completed') status = 'completed';
          else if (stage === 'declined') status = 'declined';
          else if (stage === 'cancelled') status = 'cancelled';

          if (r.sender_paid && r.receiver_paid) {
            if (status === 'accepted_pending_payment') {
              status = 'paid';
            }
          }

          return {
            id: String(r.id),
            senderId: r.sender_id,
            receiverId: r.receiver_id,
            status: status,
            message: r.message || 'طلب اهتمام مرسل عبر الإدارة',
            time: r.created_at ? new Date(r.created_at).toLocaleDateString('ar-SA') : 'الآن',
            createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
            paymentStatus: (r.sender_paid && r.receiver_paid) ? 'paid' : 'waiting_for_payment',
            senderPaid: !!r.sender_paid,
            receiverPaid: !!r.receiver_paid,
            meetingDate: r.meeting_date || undefined,
            meetingNotes: r.meeting_notes || undefined,
            declineReason: r.decline_reason || undefined,
            adminNotes: r.admin_notes || undefined,
          };
        });
        setInterestRequests(mapped);
        return;
      }
    } catch (e) {
      console.error('Error in refreshInterestRequests:', e);
    }
    setInterestRequests(getMappedRequestsFromDB());
  }, [getMappedRequestsFromDB]);

  // Intercept dataService database actions to keep AppContext state fully synchronized reactive-style
  useEffect(() => {
    const originalRunRequestAction = dataService.db.runRequestAction;
    const originalCreateRequest = dataService.db.createRequest;
    const originalAdminDeleteRequest = dataService.db.adminDeleteRequest;
    
    dataService.db.runRequestAction = async (requestId, action, actorId, payload) => {
      const res = await originalRunRequestAction(requestId, action, actorId, payload);
      if (res.ok) {
        refreshInterestRequests();
      }
      return res;
    };

    dataService.db.createRequest = async (senderId, receiverId, message) => {
      const res = await originalCreateRequest(senderId, receiverId, message);
      if (res.ok) {
        refreshInterestRequests();
      }
      return res;
    };

    dataService.db.adminDeleteRequest = async (requestId) => {
      const res = await originalAdminDeleteRequest(requestId);
      if (res) {
        refreshInterestRequests();
      }
      return res;
    };
    
    return () => {
      dataService.db.runRequestAction = originalRunRequestAction;
      dataService.db.createRequest = originalCreateRequest;
      dataService.db.adminDeleteRequest = originalAdminDeleteRequest;
    };
  }, [refreshInterestRequests]);

  const [adminNotifications, setAdminNotifications] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('saved_admin_notifications');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore error */ }
      }
    }
    return ADMIN_NOTIFICATIONS;
  });

  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('saved_support_tickets_list');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore error */ }
      }
    }
    return DEFAULT_TICKETS.map(t => ({ ...t, userId: t.userId || 'm2' }));
  });

  // جلب التذاكر من جدول support_tickets الحقيقي عند الإقلاع (المصدر الوحيد للحقيقة)
  useEffect(() => {
    let mounted = true;
    fetch('/api/support-tickets')
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (!mounted || !Array.isArray(rows) || rows.length === 0) return;
        setSupportTickets(rows.map(mapTicketRow));
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  // Fetch members directly from local/cloud store preserving full admin metadata
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersFetchNonce, setMembersFetchNonce] = useState(0);
  const retryLoadMembers = useCallback(() => {
    setMembersError(null);
    setMembersFetchNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchCloudMembers() {
      try {
        const fullAdminMembers = await dataService.db.adminGetMembers();
        if (isMounted) {
          if (Array.isArray(fullAdminMembers) && fullAdminMembers.length > 0) {
            setAdminMembers(fullAdminMembers as any[]);
            const activePublicMembers = (fullAdminMembers as any[]).filter(
              (m) => (!m.status || m.status === 'active') && !m.isDeleted
            );
            setMembers(activePublicMembers.length > 0 ? activePublicMembers : (fullAdminMembers as any[]));
          } else {
            const fallbackAdmin = dataService.db.getLiveMembers(true);
            setAdminMembers(fallbackAdmin as any[]);
            setMembers(dataService.db.getLiveMembers(false));
          }
          setMembersError(null);
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('Failed to fetch members:', err);
        if (isMounted) {
          const fallbackAdmin = dataService.db.getLiveMembers(true);
          const fallbackPublic = dataService.db.getLiveMembers(false);
          setAdminMembers(fallbackAdmin as any[]);
          setMembers(fallbackPublic);
          // نعرض خطأ الاتصال فقط إذا لم تتوفر نسخة محلية مخزنة
          if (!fallbackPublic || fallbackPublic.length === 0) {
            setMembersError('تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مجدداً.');
          }
          setIsInitialized(true);
        }
      }
    }
    fetchCloudMembers();
    return () => { isMounted = false; };
  }, [membersFetchNonce]);

  // الاستماع لحدث استعادة قاعدة البيانات الشاملة لإعادة تحميل الحالة بالكامل
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleRestore = () => {
      retryLoadMembers();
      try {
        const savedReqs = dataService.db.settings.get('saved_interest_requests');
        if (savedReqs) setInterestRequests(JSON.parse(savedReqs));

        const savedPlans = dataService.db.settings.get('saved_plans');
        if (savedPlans) setPlans(JSON.parse(savedPlans));

        const savedPaypal = dataService.db.settings.get('paypal_settings');
        if (savedPaypal) setPaypalSettings(JSON.parse(savedPaypal));

        const savedSocial = dataService.db.settings.get('social_settings');
        if (savedSocial) setSocialSettings(JSON.parse(savedSocial));

        const savedPayments = dataService.db.settings.get('payment_settings');
        if (savedPayments) setPaymentSettings(JSON.parse(savedPayments));

        const savedPurchase = dataService.db.settings.get('interest_purchase_settings');
        if (savedPurchase) setInterestPurchaseSettings(JSON.parse(savedPurchase));

        const savedPackages = dataService.db.settings.get('saved_message_packages');
        if (savedPackages) setMessagePackages(JSON.parse(savedPackages));

        const savedTickets = dataService.db.settings.get('saved_support_tickets_list');
        if (savedTickets) setSupportTickets(JSON.parse(savedTickets));

        const savedReports = dataService.db.settings.get('saved_member_reports_list');
        if (savedReports) setMemberReports(JSON.parse(savedReports));

        const savedExempts = dataService.db.settings.get('saved_exempt_requests');
        if (savedExempts) setExemptRequests(JSON.parse(savedExempts));
      } catch (e) {
        console.error('Error refreshing AppContext on DB restore:', e);
      }
    };

    window.addEventListener('twafok_db_restored', handleRestore);
    return () => {
      window.removeEventListener('twafok_db_restored', handleRestore);
    };
  }, [retryLoadMembers]);

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('saved_support_tickets_list', JSON.stringify(supportTickets));
    }
  }, [supportTickets, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('saved_members_list', JSON.stringify(members));
    }
  }, [members, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('saved_admin_members_list', JSON.stringify(adminMembers));
    }
  }, [adminMembers, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('saved_interest_requests', JSON.stringify(interestRequests));
    }
  }, [interestRequests, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('saved_admin_notifications', JSON.stringify(adminNotifications));
    }
  }, [adminNotifications, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('auth_user', JSON.stringify(user));
    }
  }, [user, isInitialized]);

  // Initialize plans with local storage backup or default
  const [plans, setPlans] = useState<Plan[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('saved_plans');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fail safe fallback
        }
      }
    }
    return DEFAULT_PLANS;
  });

  // Initialize PayPal settings from storage or default
  const [paypalSettings, setPaypalSettings] = useState<PaypalSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('paypal_settings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fail safe fallback
        }
      }
    }
    return DEFAULT_PAYPAL;
  });

  // Initialize Social and WhatsApp settings from storage or default
  const [socialSettings, setSocialSettings] = useState<SocialSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('social_settings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fail safe fallback
        }
      }
    }
    return DEFAULT_SOCIALS;
  });

  // Initialize unified Multiple Payments config from storage or default
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('payment_settings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fail safe fallback
        }
      }
    }
    return DEFAULT_PAYMENTS_CONFIG;
  });

  const updatePaymentSettings = useCallback((settings: PaymentSettings) => {
    setPaymentSettings(settings);
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('payment_settings', JSON.stringify(settings));
    }
  }, []);

  // Extra interest requests settings & state
  const [interestPurchaseSettings, setInterestPurchaseSettings] = useState<InterestPurchaseSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('interest_purchase_settings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return {
      price: 29,
      type: 'count', // 'count' or 'duration'
      count: 10,
      durationDays: 7,
    };
  });

  const updateInterestPurchaseSettings = useCallback((settings: InterestPurchaseSettings) => {
    setInterestPurchaseSettings(settings);
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('interest_purchase_settings', JSON.stringify(settings));
    }
  }, []);

  const [messagePackages, setMessagePackages] = useState<MessagePackage[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('saved_message_packages');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === 3) {
            return parsed;
          }
        } catch {
          // fallback
        }
      }
    }
    return DEFAULT_MESSAGE_PACKAGES;
  });

  const updateMessagePackage = useCallback((updated: MessagePackage) => {
    setMessagePackages((prev) => {
      const next = prev.map((p) => (p.id === updated.id ? updated : p));
      if (typeof window !== 'undefined') {
        dataService.db.settings.set('saved_message_packages', JSON.stringify(next));
      }
      return next;
    });
    showToast(`تم تحديث باقة رسائل ${updated.name} بنجاح!`, 'success');
  }, [showToast]);

  const [extraInterestsCount, setExtraInterestsCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('user_extra_interests_count');
      if (saved) return Number(saved);
    }
    return 0;
  });

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('user_extra_interests_count', String(extraInterestsCount));
    }
  }, [extraInterestsCount, isInitialized]);

  const [depositQuota, setDepositQuota] = useState<{
    hasActiveQuota: boolean;
    remainingAttempts: number;
    totalPaidAmount: number;
    paidAt?: string;
    selectedTierPrice?: number;
  }>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('user_deposit_quota');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            hasActiveQuota: parsed.hasActiveQuota ?? false,
            remainingAttempts: parsed.remainingAttempts ?? 5,
            totalPaidAmount: parsed.totalPaidAmount ?? 0,
            paidAt: parsed.paidAt,
            selectedTierPrice: parsed.selectedTierPrice ?? 500,
          };
        } catch (e) {
          console.warn('Failed parsing deposit quota', e);
        }
      }
    }
    return {
      hasActiveQuota: false,
      remainingAttempts: 5,
      totalPaidAmount: 0,
    };
  });

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('user_deposit_quota', JSON.stringify(depositQuota));
    }
  }, [depositQuota, isInitialized]);

  const [unlimitedInterestsUntil, setUnlimitedInterestsUntil] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('user_unlimited_interests_until');
      if (saved) return Number(saved);
    }
    return 0;
  });

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('user_unlimited_interests_until', String(unlimitedInterestsUntil));
    }
  }, [unlimitedInterestsUntil, isInitialized]);

  // Initialize dark mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('dark_mode');
      return saved === 'true';
    }
    return false;
  });

  // تحكم الإدارة بإظهار/إخفاء زر الوضع الليلي
  const [showDarkModeToggle, setShowDarkModeToggle] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('show_dark_mode_toggle');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });

  const updateShowDarkModeToggle = useCallback((show: boolean) => {
    setShowDarkModeToggle(show);
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('show_dark_mode_toggle', String(show));
    }
  }, []);

  // Compatibility Feature Control (White priority - Admin toggle)
  const [showCompatibility, setShowCompatibility] = useState<boolean>(true); // Forced true for demo as per request

  // ===== بيانات الملف الشخصي التفصيلية =====
  const [profileData, setProfileData] = useState<ProfileData>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('user_profile_data');
      if (saved) {
        try { return { ...DEFAULT_PROFILE_DATA, ...JSON.parse(saved) }; } catch { /* ignore error */ }
      }
    }
    return DEFAULT_PROFILE_DATA;
  });

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('user_profile_data', JSON.stringify(profileData));
    }
  }, [profileData, isInitialized]);

  // Synchronize profileData state with currently logged in user's member details
  useEffect(() => {
    if (!isInitialized) return;
    if (user.isLoggedIn && user.memberId) {
      const matched = members.find((m) => m.id === user.memberId) || (adminMembers as any[]).find((m) => m.id === user.memberId);
      if (matched) {
        setProfileData(prev => {
          const isSameUser = prev.id === user.memberId;
          const bd = (matched as any).birthDate || (matched as any).birth_date || (isSameUser ? prev.birthDate : '') || (matched.age ? `${new Date().getFullYear() - matched.age}-01-01` : '');
          return {
            id: matched.id,
            gender: matched.gender || (isSameUser ? prev.gender : 'female'),
            nickname: matched.nickname || (matched as any).name || (isSameUser ? prev.nickname : 'سارة'),
            birthDate: bd,
            age: matched.age || (isSameUser ? prev.age : 26),
            country: matched.country || (isSameUser ? prev.country : 'السعودية'),
            city: matched.city || (isSameUser ? prev.city : 'الرياض'),
            district: (matched as any).district || (isSameUser ? prev.district : ''),
            sect: (matched as any).sect || (isSameUser ? prev.sect : ''),
            sectOther: (matched as any).sectOther || (isSameUser ? prev.sectOther : ''),
            nationality: (matched as any).nationality || matched.country || (isSameUser ? prev.nationality : 'السعودية'),
            maritalStatus: matched.maritalStatus || (isSameUser ? prev.maritalStatus : 'single'),
            marriageType: (matched as any).marriageType || (isSameUser ? prev.marriageType : 'announced'),
            tribe: (matched as any).tribe !== undefined ? (matched as any).tribe : (isSameUser ? prev.tribe : '') || '',
            childrenCount: (matched as any).childrenCount || (isSameUser ? prev.childrenCount : ''),
            childrenLiveWith: (matched as any).childrenLiveWith || (isSameUser ? prev.childrenLiveWith : ''),
            hasChildren: matched.hasChildren ? 'yes' : (isSameUser ? prev.hasChildren : 'no'),
            wifeCount: (matched as any).wifeCount || (isSameUser ? prev.wifeCount : ''),
            seekingWife: (matched as any).seekingWife || (isSameUser ? prev.seekingWife : ''),
            height: matched.height || (isSameUser ? prev.height : 0),
            weight: matched.weight || (isSameUser ? prev.weight : 0),
            skinColor: (matched as any).skinColor || (isSameUser ? prev.skinColor : ''),
            ethnicity: matched.ethnicity || (isSameUser ? prev.ethnicity : ''),
            health: (matched as any).health || (isSameUser ? prev.health : ''),
            smoking: (matched as any).smoking || (isSameUser ? prev.smoking : ''),
            acceptPolygamy: (matched as any).acceptPolygamy || (isSameUser ? prev.acceptPolygamy : ''),
            acceptDivorced: (matched as any).acceptDivorced || (isSameUser ? prev.acceptDivorced : ''),
            acceptWithChildren: (matched as any).acceptWithChildren || (isSameUser ? prev.acceptWithChildren : ''),
            education: matched.education || (isSameUser ? prev.education : ''),
            workType: matched.workType || (isSameUser ? prev.workType : ''),
            jobTitle: (matched as any).jobTitle || (isSameUser ? prev.jobTitle : ''),
            housing: (matched as any).housing || (isSameUser ? prev.housing : ''),
            bio: matched.bio || (isSameUser ? prev.bio : ''),
            pCountry: (matched as any).pCountry || (isSameUser ? prev.pCountry : 'السعودية'),
            pCity: (matched as any).pCity || (isSameUser ? prev.pCity : ''),
            pAgeMin: (matched as any).pAgeMin ?? (isSameUser ? prev.pAgeMin : ''),
            pAgeMax: (matched as any).pAgeMax ?? (isSameUser ? prev.pAgeMax : ''),
            pNationality: (matched as any).pNationality || (isSameUser ? prev.pNationality : 'لا يهم'),
            pMaritalStatus: (matched as any).pMaritalStatus || (isSameUser ? prev.pMaritalStatus : 'لا يهم'),
            pAcceptChildren: (matched as any).pAcceptChildren || (isSameUser ? prev.pAcceptChildren : 'لا يهم'),
            pSect: (matched as any).pSect || (isSameUser ? prev.pSect : ''),
            pSectOther: (matched as any).pSectOther || (isSameUser ? prev.pSectOther : ''),
            pEducation: (matched as any).pEducation || (isSameUser ? prev.pEducation : ''),
            pWorkType: (matched as any).pWorkType || (isSameUser ? prev.pWorkType : ''),
            pSkinColor: (matched as any).pSkinColor || (isSameUser ? prev.pSkinColor : ''),
            pHousing: (matched as any).pHousing || (isSameUser ? prev.pHousing : ''),
            pNotes: (matched as any).pNotes || matched.aboutPartner || (isSameUser ? prev.pNotes : ''),
          };
        });
      }
    }
  }, [user.memberId, user.isLoggedIn, isInitialized, members, adminMembers]);

  // استماع لحدث تحديث العضو من أي نافذة أو لوحة إدارة
  useEffect(() => {
    const handleMemberUpdated = (e: any) => {
      const { id, fields } = e.detail || {};
      if (!id || !fields) return;

      const mapper = (m: any) => (m.id === id ? { ...m, ...fields } : m);
      setMembers((prev) => prev.map(mapper));
      setAdminMembers((prev) => prev.map(mapper));

      if (user.memberId === id) {
        setUser((prev) => ({
          ...prev,
          name: fields.nickname || fields.realName || prev.name,
          profile: {
            ...prev.profile,
            ...(fields.nickname ? { name: fields.nickname } : {}),
            ...(fields.city ? { city: fields.city } : {}),
            ...(fields.age ? { age: Number(fields.age) } : {}),
            ...(fields.plan ? { plan: fields.plan } : {}),
            ...(fields.verified !== undefined ? { verified: fields.verified } : {}),
          },
        }));
        setProfileData((prev) => ({
          ...prev,
          ...fields,
        }));
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('twafok_member_updated', handleMemberUpdated);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('twafok_member_updated', handleMemberUpdated);
      }
    };
  }, [user.memberId]);

  // Synchronize likedMembers state with currently logged in user's saved preferences
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      if (user.isLoggedIn && user.memberId) {
        const key = 'liked_members_' + user.memberId;
        const saved = dataService.db.settings.get(key);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setLikedMembers(new Set(parsed));
              return;
            }
          } catch {}
        }
        setLikedMembers(new Set());
      } else {
        setLikedMembers(new Set());
      }
    }
  }, [user.memberId, user.isLoggedIn, isInitialized]);

  const updateProfileData = useCallback(async (fields: Partial<ProfileData>): Promise<boolean> => {
    // حفظ التعديلات مباشرة في جدول members الحقيقي — لن تضيع بعد تحديث الصفحة
    const activeId = user.memberId || (typeof window !== 'undefined' ? dataService.db.getCurrentUserId() : null);
    let apiSuccess = true;
    if (activeId) {
      // نُرسل كل الحقول كما هي (camelCase) — الخادم (toDbPartial) يتعامل مع التحويل
      // تلقائياً: الحقول العادية تذهب لأعمدتها، والحقول الموسّعة (مثل pCountry) تذهب لـ details (jsonb)
      const dbFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (key === 'id' || value === undefined) continue;
        // تحويل hasChildren/acceptPolygamy وغيرها من نص 'yes'/'no' إلى boolean عند اللزوم
        if (typeof value === 'string' && (value === 'yes' || value === 'true')) {
          dbFields[key] = true;
        } else if (typeof value === 'string' && (value === 'no' || value === 'false')) {
          dbFields[key] = false;
        } else {
          dbFields[key] = value;
        }
      }
      if (Object.keys(dbFields).length > 0) {
        let token: string | null = null;
        try {
          const { data } = await supabaseClient.auth.getSession();
          token = data?.session?.access_token || null;
        } catch { /* ignore */ }
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        try {
          const res = await fetch('/api/members', {
            method: 'PUT',
            headers,
            body: JSON.stringify({ id: activeId, ...dbFields, _authToken: token }),
          });
          if (!res.ok) {
            // تحديث محلي في dataService عند غياب مسار API في التطبيق المستقل (SPA)
            await dataService.db.members.update(activeId, dbFields).catch(() => null);
            if (res.status !== 404) {
              const errData = await res.json().catch(() => null);
              console.warn('[updateProfileData] API status:', res.status, errData?.error || '');
            }
          }
        } catch {
          await dataService.db.members.update(activeId, dbFields).catch(() => null);
        }
      }
    }

    let computedPct = 85;
    setProfileData(prev => {
      const next = { ...prev, ...fields };
      // إعادة حساب نسبة إكمال الملف
      const allFields = Object.keys(next) as (keyof ProfileData)[];
      const checkFields = allFields.filter(k =>
        !['pAgeMin', 'pAgeMax', 'sectOther', 'pSectOther', 'childrenLiveWith', 'wifeCount', 'seekingWife'].includes(k as string)
      );
      const filled = checkFields.filter(k => {
        const v = next[k];
        if (typeof v === 'number') return v > 0;
        if (typeof v === 'boolean') return true;
        return v && String(v).trim().length > 0;
      }).length;
      computedPct = Math.round((filled / checkFields.length) * 100);
      return next;
    });

    setUser(u => {
      const prevProf = u.profile || DEFAULT_PROFILE;
      const nextUser = {
        ...u,
        profile: {
          ...prevProf,
          profileCompletion: computedPct,
          ...(fields.nickname ? { name: fields.nickname } : {}),
          ...(fields.city ? { city: fields.city } : {}),
          ...(fields.age ? { age: Number(fields.age) } : {}),
        },
      };
      if (typeof window !== 'undefined') {
        try { dataService.db.settings.set('auth_user', JSON.stringify(nextUser)); } catch {}
      }
      return nextUser;
    });

    // تحديث بيانات العضو في قائمة الأعضاء وقائمة المشرفين
    if (activeId) {
      const mapper = (m: any) => {
        if (m.id === activeId) {
          return {
            ...m,
            ...fields,
            nickname: fields.nickname !== undefined ? fields.nickname : m.nickname,
            gender: fields.gender !== undefined ? fields.gender as any : m.gender,
            age: fields.age !== undefined ? Number(fields.age) : m.age,
            country: fields.country !== undefined ? fields.country : m.country,
            city: fields.city !== undefined ? fields.city : m.city,
            district: fields.district !== undefined ? fields.district : m.district,
            nationality: fields.nationality !== undefined ? fields.nationality : m.nationality,
            sect: fields.sect !== undefined ? fields.sect : m.sect,
            tribe: fields.tribe !== undefined ? fields.tribe : (m.tribe || ''),
            ethnicity: fields.ethnicity !== undefined ? fields.ethnicity : (m.ethnicity || ''),
            maritalStatus: fields.maritalStatus !== undefined ? fields.maritalStatus as any : m.maritalStatus,
            marriageType: fields.marriageType !== undefined ? fields.marriageType : (m.marriageType || 'announced'),
            marriageTypeLabel: fields.marriageType !== undefined
              ? (fields.marriageType === 'misyar' ? 'مسيار' : fields.marriageType === 'both' ? 'معلن أو مسيار' : 'معلن')
              : (m.marriageTypeLabel || (m.marriageType === 'misyar' ? 'مسيار' : m.marriageType === 'both' ? 'معلن أو مسيار' : 'معلن')),
            height: fields.height !== undefined ? Number(fields.height) : m.height,
            weight: fields.weight !== undefined ? Number(fields.weight) : m.weight,
            skinColor: fields.skinColor !== undefined ? fields.skinColor : m.skinColor,
            health: fields.health !== undefined ? fields.health : m.health,
            smoking: fields.smoking !== undefined ? fields.smoking : m.smoking,
            education: fields.education !== undefined ? fields.education : m.education,
            workType: fields.workType !== undefined ? fields.workType : m.workType,
            jobTitle: fields.jobTitle !== undefined ? fields.jobTitle : m.jobTitle,
            housing: fields.housing !== undefined ? fields.housing : m.housing,
            bio: fields.bio !== undefined ? fields.bio : m.bio,
            aboutPartner: fields.pNotes !== undefined ? fields.pNotes : (fields.aboutPartner !== undefined ? fields.aboutPartner : m.aboutPartner),
            pNotes: fields.pNotes !== undefined ? fields.pNotes : (m.pNotes || fields.aboutPartner || m.aboutPartner || ''),
          };
        }
        return m;
      };

      setMembers(prevMembers => prevMembers.map(mapper));
      setAdminMembers(prevAdmin => prevAdmin.map(mapper));
    }
    return apiSuccess;
  }, [setMembers, setAdminMembers, user.memberId]);

  const updateAccountInfo = useCallback((fields: { realName?: string; email?: string; phone?: string; whatsapp?: string; password?: string }) => {
    // حفظ بيانات الحساب في جدول members الحقيقي
    const activeId = user.memberId || (typeof window !== 'undefined' ? dataService.db.getCurrentUserId() : null);
    if (activeId) {
      fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeId, ...fields }),
      }).catch(() => undefined);
    }

    setUser(u => {
      const next = {
        ...u,
        profile: {
          ...u.profile,
          ...(fields.realName !== undefined ? { realName: fields.realName } : {}),
          ...(fields.email !== undefined ? { email: fields.email } : {}),
          ...(fields.phone !== undefined ? { phone: fields.phone } : {}),
          ...(fields.whatsapp !== undefined ? { whatsapp: fields.whatsapp } : {}),
          ...(fields.password !== undefined ? { password: fields.password } : {}),
        },
      };
      if (typeof window !== 'undefined') {
        dataService.db.settings.set('auth_user', JSON.stringify(next));
      }
      return next;
    });

    if (activeId) {
      setAdminMembers(prev => prev.map(am => {
        if (am.id === activeId) {
          return {
            ...am,
            realName: fields.realName !== undefined ? fields.realName : am.realName,
            email: fields.email !== undefined ? fields.email : am.email,
            phone: fields.phone !== undefined ? fields.phone : am.phone,
            whatsapp: fields.whatsapp !== undefined ? fields.whatsapp : am.whatsapp,
            password: fields.password !== undefined ? fields.password : am.password,
          };
        }
        return am;
      }));
      setMembers(prev => prev.map(m => {
        if (m.id === activeId) {
          return {
            ...m,
            email: fields.email !== undefined ? fields.email : m.email,
            phone: fields.phone !== undefined ? fields.phone : m.phone,
            whatsapp: fields.whatsapp !== undefined ? fields.whatsapp : m.whatsapp,
          };
        }
        return m;
      }));
    }
  }, [setMembers, setAdminMembers]);

  const [compatibilityPaidOnly, setCompatibilityPaidOnly] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('compatibility_paid_only');
      return saved === 'true';
    }
    return true; // default paid only
  });

  const updateCompatibilitySettings = useCallback((enabled: boolean, paidOnly: boolean) => {
    setShowCompatibility(enabled);
    setCompatibilityPaidOnly(paidOnly);
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('show_compatibility', String(enabled));
      dataService.db.settings.set('compatibility_paid_only', String(paidOnly));
    }
    // Use the showToast function from context (declared later)
    // For now we log - the toast is handled in the settings page
    console.log(`Compatibility settings updated: enabled=${enabled}, paidOnly=${paidOnly}`);
  }, []);

  const updateFeatureSettings = useCallback((updates: {
    allowProfileHiding?: boolean;
    requireVerificationForRequests?: boolean;
    enableWhoViewedMe?: boolean;
    enableProfileBoosting?: boolean;
    maxActiveRequests?: number;
    pendingRequestsExpiryDays?: number;
  }) => {
    if (updates.allowProfileHiding !== undefined) {
      setAllowProfileHiding(updates.allowProfileHiding);
      if (typeof window !== 'undefined') dataService.db.settings.set('allow_profile_hiding', String(updates.allowProfileHiding));
    }
    if (updates.requireVerificationForRequests !== undefined) {
      setRequireVerificationForRequests(updates.requireVerificationForRequests);
      if (typeof window !== 'undefined') dataService.db.settings.set('require_verification_for_requests', String(updates.requireVerificationForRequests));
    }
    if (updates.enableWhoViewedMe !== undefined) {
      setEnableWhoViewedMe(updates.enableWhoViewedMe);
      if (typeof window !== 'undefined') dataService.db.settings.set('enable_who_viewed_me', String(updates.enableWhoViewedMe));
    }
    if (updates.enableProfileBoosting !== undefined) {
      setEnableProfileBoosting(updates.enableProfileBoosting);
      if (typeof window !== 'undefined') dataService.db.settings.set('enable_profile_boosting', String(updates.enableProfileBoosting));
    }
    if (updates.maxActiveRequests !== undefined) {
      setMaxActiveRequests(updates.maxActiveRequests);
      if (typeof window !== 'undefined') dataService.db.settings.set('max_active_requests', String(updates.maxActiveRequests));
    }
    if (updates.pendingRequestsExpiryDays !== undefined) {
      setPendingRequestsExpiryDays(updates.pendingRequestsExpiryDays);
      if (typeof window !== 'undefined') dataService.db.settings.set('pending_requests_expiry_days', String(updates.pendingRequestsExpiryDays));
    }
  }, []);

  const [isProfileHidden, setIsProfileHidden] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = dataService.db.settings.get('auth_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.memberId) {
            return dataService.db.settings.get(`profile_hidden_${parsed.memberId}`) === 'true';
          }
        } catch { /* ignore */ }
      }
    }
    return false;
  });

  const toggleProfileHiding = useCallback(() => {
    setIsProfileHidden(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        const savedUser = dataService.db.settings.get('auth_user');
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            if (parsed && parsed.memberId) {
              dataService.db.settings.set(`profile_hidden_${parsed.memberId}`, String(next));
            }
          } catch { /* ignore */ }
        }
      }
      return next;
    });
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        dataService.db.settings.set('dark_mode', String(next));
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      return next;
    });
  }, []);

  // Sync dark class on mount and state change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [darkMode]);

  const getActiveMemberIdForUsage = useCallback(() => {
    return user.memberId || dataService.db.getCurrentUserId() || 'guest';
  }, [user.memberId]);

  const getUsageStorageKey = useCallback((memberId?: string) => {
    return `user_usage_counters_${memberId || getActiveMemberIdForUsage()}`;
  }, [getActiveMemberIdForUsage]);

  const readUsageForMember = useCallback((memberId?: string) => {
    if (typeof window === 'undefined') return { messagesSent: 0, searchesDone: 0, contactsViewed: 0 };
    const scoped = dataService.db.settings.get(getUsageStorageKey(memberId));
    if (scoped) {
      try { return JSON.parse(scoped); } catch { /* ignore */ }
    }
    // توافق رجعي: إن كان التخزين القديم موجوداً نستخدمه فقط للحساب الافتراضي m2.
    const legacy = memberId === 'm2' || (!memberId && getActiveMemberIdForUsage() === 'm2')
      ? dataService.db.settings.get('user_usage_counters')
      : null;
    if (legacy) {
      try { return JSON.parse(legacy); } catch { /* ignore */ }
    }
    return { messagesSent: 0, searchesDone: 0, contactsViewed: 0 };
  }, [getUsageStorageKey, getActiveMemberIdForUsage]);

  // Keep track of active operational counters in local state with persistent backup per member
  const [usage, setUsage] = useState<{
    messagesSent: number;
    searchesDone: number;
    contactsViewed: number;
  }>(() => {
    return readUsageForMember(user.memberId || dataService.db.getCurrentUserId() || 'guest');
  });

  useEffect(() => {
    setUsage(readUsageForMember(user.memberId || dataService.db.getCurrentUserId() || 'guest'));
  }, [user.memberId, readUsageForMember]);

  const [isBoosted, setIsBoosted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('profile_boosted');
      return saved === 'true';
    }
    return false;
  });

  const [reports, setReports] = useState<MemberReport[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('saved_member_reports_list');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore error */ }
      }
    }
    return [
      {
        id: 'rep1',
        reporterId: 'm2',
        reporterName: 'سارة',
        reportedId: 'm4',
        reportedName: 'سليمان الحربي',
        reason: 'الحساب يتصرف بشكل مريب أو يرسل رسائل مكررة غير جدية.',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        status: 'pending',
        category: 'spam' as const,
        severity: 'medium' as const,
        adminNotes: '',
        actionLog: [],
      },
      {
        id: 'rep2',
        reporterId: 'm6',
        reporterName: 'أم عبدالرحمن',
        reportedId: 'm1',
        reportedName: 'أبو عبدالله',
        reason: 'أرسل رسائل غير لائقة ومضايقات متكررة رغم الاعتذار.',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        status: 'pending',
        category: 'harassment' as const,
        severity: 'high' as const,
        adminNotes: 'تم التواصل المبدئي مع المُبلِغة، بانتظار مراجعة الإدارة.',
        actionLog: [
          { id: 'al1', action: 'تم استلام البلاغ', timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), by: 'النظام' },
          { id: 'al2', action: 'تم التواصل المبدئي مع المُبلِغة', timestamp: new Date(Date.now() - 3600000 * 3).toISOString(), by: 'د. منى السالم' },
        ],
      },
      {
        id: 'rep3',
        reporterId: 'm3',
        reporterName: 'القحطاني',
        reportedId: 'm8',
        reportedName: 'بنت الخليج',
        reason: 'الصور والمعلومات الشخصية غير حقيقية، يبدو حساباً وهمياً.',
        timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
        status: 'pending',
        category: 'fake' as const,
        severity: 'high' as const,
        adminNotes: 'يجب التحقق من هوية العضوة قبل اتخاذ إجراء.',
        actionLog: [
          { id: 'al3', action: 'تم استلام البلاغ', timestamp: new Date(Date.now() - 3600000 * 48).toISOString(), by: 'النظام' },
        ],
      },
      {
        id: 'rep4',
        reporterId: 'm5',
        reporterName: 'العتيبي',
        reportedId: 'm7',
        reportedName: 'أبو فيصل',
        reason: 'محتوى النبذة الشخصية يحتوي على عبارات غير مناسبة.',
        timestamp: new Date(Date.now() - 3600000 * 72).toISOString(),
        status: 'resolved',
        category: 'inappropriate' as const,
        severity: 'low' as const,
        adminNotes: 'تم تنبيه العضو وتعديل النبذة.',
        actionLog: [
          { id: 'al4', action: 'تم استلام البلاغ', timestamp: new Date(Date.now() - 3600000 * 72).toISOString(), by: 'النظام' },
          { id: 'al5', action: 'تم تنبيه العضو وتعديل النبذة', timestamp: new Date(Date.now() - 3600000 * 60).toISOString(), by: 'أ. خالد المنصور' },
          { id: 'al6', action: 'تم حل البلاغ', timestamp: new Date(Date.now() - 3600000 * 58).toISOString(), by: 'أ. خالد المنصور' },
        ],
      },
      {
        id: 'rep5',
        reporterId: 'm1',
        reporterName: 'أبو عبدالله',
        reportedId: 'm5',
        reportedName: 'العتيبي',
        reason: 'سلوك غير لائق أثناء التنسيق الشرعي وعدم احترام الإدارة.',
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
        status: 'pending',
        category: 'inappropriate' as const,
        severity: 'medium' as const,
        adminNotes: '',
        actionLog: [
          { id: 'al7', action: 'تم استلام البلاغ', timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), by: 'النظام' },
        ],
      },
      {
        id: 'rep6',
        reporterId: 'm8',
        reporterName: 'بنت الخليج',
        reportedId: 'm3',
        reportedName: 'القحطاني',
        reason: 'يرسل طلبات اهتمام متكررة بشكل مزعج رغم الرفض.',
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
        status: 'pending',
        category: 'spam' as const,
        severity: 'low' as const,
        adminNotes: '',
        actionLog: [
          { id: 'al8', action: 'تم استلام البلاغ', timestamp: new Date(Date.now() - 3600000 * 8).toISOString(), by: 'النظام' },
        ],
      },
    ];
  });

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('saved_member_reports_list', JSON.stringify(reports));
    }
  }, [reports, isInitialized]);

  const submitReport = useCallback((reportedId: string, reportedName: string, reason: string) => {
    const newReport: MemberReport = {
      id: 'rep_' + Date.now(),
      reporterId: user.isLoggedIn ? 'user_self' : 'guest',
      reporterName: user.isLoggedIn ? user.profile.name : 'زائر',
      reportedId,
      reportedName,
      reason,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    setReports(prev => [newReport, ...prev]);
    showToast('تم إرسال بلاغك بنجاح للإدارة وسيتخذ الوسيط الإجراء اللازم حيال العضو المخالف 🛡️', 'success');
  }, [user, showToast]);

  // جلب البلاغات من جدول member_reports الحقيقي عند الإقلاع
  useEffect(() => {
    let mounted = true;
    fetch('/api/member-reports')
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (!mounted || !Array.isArray(rows) || rows.length === 0) return;
        setReports(rows);
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  /** مزامنة تعديل بلاغ مع الخادم */
  const syncReportToServer = useCallback((id: string, fields: Record<string, unknown>) => {
    fetch('/api/member-reports', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    }).catch(() => undefined);
  }, []);

  const resolveReport = useCallback((id: string) => {
    setReports(prev => prev.map(rep => rep.id === id ? { ...rep, status: 'resolved' as const } : rep));
    syncReportToServer(id, { status: 'resolved' });
    showToast('تمت معالجة البلاغ ووضع العلامة كمكتمل بنجاح.', 'success');
  }, [showToast, syncReportToServer]);

  const deleteReport = useCallback((id: string) => {
    setReports(prev => prev.filter(rep => rep.id !== id));
    fetch('/api/member-reports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
    showToast('تم حذف البلاغ نهائياً.', 'info');
  }, [showToast]);

  const updateReport = useCallback((id: string, fields: Partial<MemberReport>) => {
    setReports(prev => prev.map(rep => rep.id === id ? { ...rep, ...fields } : rep));
    syncReportToServer(id, fields as Record<string, unknown>);
  }, [syncReportToServer]);

  const addReportActionLog = useCallback((id: string, action: string, adminNote?: string, by?: string) => {
    setReports(prev => prev.map(rep => {
      if (rep.id !== id) return rep;
      const logEntry = {
        id: 'al_' + Date.now(),
        action,
        adminNote,
        timestamp: new Date().toISOString(),
        by: by || 'الإدارة',
      };
      const next = { ...rep, actionLog: [...(rep.actionLog || []), logEntry] };
      syncReportToServer(id, { actionLog: next.actionLog, adminNotes: adminNote ?? rep.adminNotes });
      return next;
    }));
  }, [syncReportToServer]);

  const buyExtraInterests = useCallback(() => {
    if (interestPurchaseSettings.type === 'count') {
      setExtraInterestsCount(prev => prev + interestPurchaseSettings.count);
      showToast(`🎉 تم شراء وشحن ${interestPurchaseSettings.count} اهتمامات إضافية بنجاح! يمكنك الآن إرسال الطلبات.`, 'success');
    } else {
      const newExpire = Date.now() + (interestPurchaseSettings.durationDays * 24 * 60 * 60 * 1000);
      setUnlimitedInterestsUntil(newExpire);
      showToast(`🎉 تم شراء وتفعيل اهتمامات بلا حدود لمدة ${interestPurchaseSettings.durationDays} أيام بنجاح!`, 'success');
    }
  }, [interestPurchaseSettings, showToast]);

  // Wallet & Exemption system
  const [exemptRequests, setExemptRequests] = useState<ExemptRequest[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = dataService.db.settings.get('saved_exempt_requests');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore error */ }
      }
    }
    return [
      {
        id: 'ex1',
        requestId: 'ir4',
        userId: 'm3',
        userNickname: 'أبو عبدالله',
        reason: 'أواجه صعوبة مالية مؤقتة وأتمنى تخفيض الرسوم أو إعفائي لتأكيد جديتي.',
        status: 'pending',
        createdAt: Date.now() - 3600000 * 12,
      }
    ];
  });

  // جلب طلبات الإعفاء من جدول exemption_requests الحقيقي عند الإقلاع
  useEffect(() => {
    let mounted = true;
    fetch('/api/exemptions')
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (!mounted || !Array.isArray(rows) || rows.length === 0) return;
        setExemptRequests(rows);
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  // ========== SYNC AND INITIALIZE SETTINGS FROM CLOUD ==========
  useEffect(() => {
    async function initAndSync() {
      // 1. If Supabase is active, sync settings from cloud to localStorage
      const dbAny = dataService.db as any;
      if (typeof dbAny.syncSettingsFromCloud === 'function') {
        try {
          await dbAny.syncSettingsFromCloud();
          console.info('[AppProvider] Successfully synced settings from cloud.');
        } catch (err: any) {
          console.warn('[AppProvider] Notice: Cloud settings sync using fallback:', err?.message || err);
        }
      }

      // 2. Read synced values from settings/localStorage and update React states
      if (typeof window !== 'undefined') {
        const savedMembers = dataService.db.settings.get('saved_members_list');
        if (savedMembers) {
          try { setMembers(JSON.parse(savedMembers)); } catch {}
        }
        const savedAdminMembers = dataService.db.settings.get('saved_admin_members_list');
        if (savedAdminMembers) {
          try { setAdminMembers(JSON.parse(savedAdminMembers)); } catch {}
        }
        const savedRequests = dataService.db.settings.get('saved_interest_requests');
        if (savedRequests) {
          try { setInterestRequests(JSON.parse(savedRequests)); } catch {}
        }
        const savedNotifications = dataService.db.settings.get('saved_admin_notifications');
        if (savedNotifications) {
          try { setAdminNotifications(JSON.parse(savedNotifications)); } catch {}
        }
        const savedTickets = dataService.db.settings.get('saved_support_tickets_list');
        if (savedTickets) {
          try { setSupportTickets(JSON.parse(savedTickets)); } catch {}
        }
        const savedAdminUsers = dataService.db.settings.get('saved_admin_users');
        if (savedAdminUsers) {
          try { setAdminUsers(JSON.parse(savedAdminUsers)); } catch {}
        }
        const savedUser = dataService.db.settings.get('auth_user');
        if (savedUser) {
          try { setUser(JSON.parse(savedUser)); } catch {}
        }
        const savedPlans = dataService.db.settings.get('saved_plans');
        if (savedPlans) {
          try { setPlans(JSON.parse(savedPlans)); } catch {}
        }
        const savedPaypal = dataService.db.settings.get('paypal_settings');
        if (savedPaypal) {
          try { setPaypalSettings(JSON.parse(savedPaypal)); } catch {}
        }
        const savedSocials = dataService.db.settings.get('social_settings');
        if (savedSocials) {
          try { setSocialSettings(JSON.parse(savedSocials)); } catch {}
        }
        const savedPayments = dataService.db.settings.get('payment_settings');
        if (savedPayments) {
          try { setPaymentSettings(JSON.parse(savedPayments)); } catch {}
        }
        const savedExtraInterests = dataService.db.settings.get('user_extra_interests_count');
        if (savedExtraInterests) {
          try { setExtraInterestsCount(Number(savedExtraInterests)); } catch {}
        }
        const savedDepositQuota = dataService.db.settings.get('user_deposit_quota');
        if (savedDepositQuota) {
          try { setDepositQuota(JSON.parse(savedDepositQuota)); } catch {}
        }
        const savedUnlimitedInterests = dataService.db.settings.get('user_unlimited_interests_until');
        if (savedUnlimitedInterests) {
          try { setUnlimitedInterestsUntil(Number(savedUnlimitedInterests)); } catch {}
        }
        const savedProfileData = dataService.db.settings.get('user_profile_data');
        if (savedProfileData) {
          try { setProfileData(JSON.parse(savedProfileData)); } catch {}
        }
        const savedReports = dataService.db.settings.get('saved_member_reports_list');
        if (savedReports) {
          try { setReports(JSON.parse(savedReports)); } catch {}
        }
        const savedExempts = dataService.db.settings.get('saved_exempt_requests');
        if (savedExempts) {
          try { setExemptRequests(JSON.parse(savedExempts)); } catch {}
        }
      }

      // 3. Complete initialization
      setIsInitialized(true);
    }

    initAndSync();
  }, []);

  useEffect(() => {
    const handleDbError = (e: Event) => {
      const err = (e as CustomEvent).detail;
      console.error('[Database Error Event]:', err);
      const message = err?.message || '';
      if (err?.code === '42P01' || message.includes('does not exist') || message.includes('relation "public.')) {
        showToast('خطأ في قاعدة البيانات: الجداول غير موجودة أو لم يتم تهيئة هيكل قاعدة البيانات في Supabase بعد. يرجى مراجعة ملف مشروع SQL لتثبيت الجداول.', 'error');
      } else if (err?.code === 'PGRST116' || err?.code === 'PGRST301' || message.includes('JWT') || message.includes('apiKey')) {
        showToast('فشل التحقق من صلاحيات المفاتيح أو الـ RLS في Supabase. يرجى تصحيح إعدادات الحماية في لوحة التحكم.', 'error');
      } else {
        showToast('خطأ في الاتصال بقاعدة البيانات (Supabase): ' + (message || 'يرجى التحقق من اتصال الشبكة والمفاتيح.'), 'error');
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('supabase-db-error', handleDbError);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('supabase-db-error', handleDbError);
      }
    };
  }, [showToast]);

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('saved_exempt_requests', JSON.stringify(exemptRequests));
    }
  }, [exemptRequests, isInitialized]);

  const submitExemptRequest = useCallback((requestId: string, reason: string) => {
    const newExempt: ExemptRequest = {
      id: 'ex_' + Date.now(),
      requestId,
      userId: user.memberId || 'm2',
      userNickname: user.profile.name,
      reason,
      status: 'pending',
      createdAt: Date.now(),
    };
    setExemptRequests(prev => [newExempt, ...prev]);
    // حفظ طلب الإعفاء في جدول exemption_requests الحقيقي
    fetch('/api/exemptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExempt),
    }).catch(() => undefined);

    // Also update the interest request with exemption status
    setInterestRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        const isSender = req.senderId === (user.memberId || 'm2');
        return {
          ...req,
          ...(isSender ? {
            senderExemptionStatus: 'pending',
            senderExemptionReason: reason,
          } : {
            receiverExemptionStatus: 'pending',
            receiverExemptionReason: reason,
          })
        };
      }
      return req;
    }));

    showToast('تم تقديم طلب التسهيل المالي للإدارة بنجاح. سيتم مراجعته والرد عليك خلال 24 ساعة.', 'success');
  }, [user, showToast]);

  const adminProcessExemptRequest = useCallback((id: string, action: 'approve' | 'reject') => {
    // مزامنة القرار مع جدول exemption_requests الحقيقي
    fetch('/api/exemptions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: action === 'approve' ? 'approved' : 'rejected' }),
    }).catch(() => undefined);

    setExemptRequests(prev => prev.map(ex => {
      if (ex.id !== id) return ex;
      
      const updatedStatus = action === 'approve' ? 'approved' as const : 'rejected' as const;
      
      // Update corresponding interest request
      setInterestRequests(currRequests => currRequests.map(req => {
        if (req.id === ex.requestId) {
          const isSender = req.senderId === ex.userId;
          const updatedReq = {
            ...req,
            ...(isSender ? {
              senderExemptionStatus: updatedStatus,
              senderPaid: action === 'approve' ? true : req.senderPaid,
              senderPaidAmount: action === 'approve' ? 0 : req.senderPaidAmount,
              senderPaidAt: action === 'approve' ? new Date().toISOString() : req.senderPaidAt,
              senderExempted: action === 'approve' ? true : false,
            } : {
              receiverExemptionStatus: updatedStatus,
              receiverPaid: action === 'approve' ? true : req.receiverPaid,
              receiverPaidAmount: action === 'approve' ? 0 : req.receiverPaidAmount,
              receiverPaidAt: action === 'approve' ? new Date().toISOString() : req.receiverPaidAt,
              receiverExempted: action === 'approve' ? true : false,
            })
          };

          // Check if both paid
          if (updatedReq.senderPaid && updatedReq.receiverPaid) {
            updatedReq.status = 'paid';
            updatedReq.paymentStatus = 'paid';
            updatedReq.paidAt = new Date().toISOString();
            updatedReq.mediationStage = 'scheduling';
          }
          return updatedReq;
        }
        return req;
      }));

      return { ...ex, status: updatedStatus };
    }));

    showToast(action === 'approve' ? 'تمت الموافقة على طلب الإعفاء وتفعيل الجدية مجاناً ✓' : 'تم رفض طلب الإعفاء المالي.', 'info');
  }, [showToast]);

  const payInterestRequestFee = useCallback((requestId: string, isSender: boolean, pledgeAccepted: boolean) => {
    if (!pledgeAccepted) {
      showToast('يجب الموافقة على عهد الأمانة والجدية للمتابعة.', 'error');
      return;
    }

    const feeAmount = 500; // Fixed fee

    setInterestRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        const updatedReq = {
          ...req,
          ...(isSender ? {
            senderPaid: true,
            senderPaidAmount: feeAmount,
            senderPaidAt: new Date().toISOString(),
          } : {
            receiverPaid: true,
            receiverPaidAmount: feeAmount,
            receiverPaidAt: new Date().toISOString(),
          })
        };

        // Check if both paid
        if (updatedReq.senderPaid && updatedReq.receiverPaid) {
          updatedReq.status = 'paid';
          updatedReq.paymentStatus = 'paid';
          updatedReq.paidAt = new Date().toISOString();
          updatedReq.mediationStage = 'scheduling';
        }
        return updatedReq;
      }
      return req;
    }));

    showToast('تم تأكيد جديتك وسداد رسوم خدمة الوساطة بنجاح ✓', 'success');
  }, [showToast]);

  const payPreExchangeChatFee = useCallback((requestId: string, isSender: boolean) => {
    // الدفع المباشر عبر بوابة الدفع — يفتح المحادثة بعد إتمام الدفع
    setInterestRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          ...(isSender ? {
            senderChatUnlocked: true,
            senderNoMoney: false,
          } : {
            receiverChatUnlocked: true,
            receiverNoMoney: false,
          })
        };
      }
      return req;
    }));
  }, []);

  const sendPreExchangeChatMessage = useCallback((requestId: string, text: string, isSender: boolean) => {
    if (!text.trim()) return;

    setInterestRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        const newMsg = {
          id: 'chat_' + Date.now() + Math.random().toString(36).substring(2, 6),
          senderId: isSender ? req.senderId : req.receiverId,
          text: text.trim(),
          time: 'الآن',
          approved: false, // Messages are unapproved by default and require admin review
          rejected: false,
        };

        return {
          ...req,
          chatMessages: [...(req.chatMessages || []), newMsg],
          ...(isSender ? {
            senderChatUnlocked: true,
          } : {
            receiverChatUnlocked: true,
          })
        };
      }
      return req;
    }));
    showToast('تم إرسال رسالتك بنجاح. الرسالة قيد المراجعة والتدقيق من قبل الإدارة والوسيط الأخصائي لضمان الجدية والخصوصية الكاملة 🛡️', 'info');
  }, [user, showToast]);

  const flagPreExchangeNoMoney = useCallback((requestId: string, isSender: boolean) => {
    setInterestRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          ...(isSender ? { senderNoMoney: true } : { receiverNoMoney: true })
        };
      }
      return req;
    }));
    showToast('تم إرسال إشعار للطرف الآخر بعدم إمكانية الشحن حالياً.', 'info');
  }, [showToast]);

  const choosePreExchangeOption = useCallback((requestId: string, choice: 'chat' | 'direct_deposit' | null) => {
    setInterestRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          preExchangeChoice: choice,
        };
      }
      return req;
    }));
    showToast(choice === 'chat' ? 'تم اختيار الاستفسار المبكر قبل تبادل الأرقام.' : 'تم اختيار الانتقال المباشر لتبادل الأرقام وسداد رسوم الجدية.', 'info');
  }, [showToast]);

  const adminCancelAndRefund = useCallback((requestId: string, type: 'full' | 'partial') => {
    setInterestRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          status: 'cancelled' as const,
          cancelReason: type === 'full' ? 'إلغاء لعدم السداد الثنائي أو بطلب الإدارة' : 'عدم توافق بعد بدء الوساطة',
          refundPercentage: 0,
        };
      }
      return req;
    }));

    showToast(
      type === 'full'
        ? 'تم إلغاء الطلب بنجاح. جميع الرسوم والمدفوعات غير مستردة نهائياً.'
        : 'تم إنهاء الوساطة وإغلاق الطلب بنجاح. جميع الرسوم والمدفوعات غير مستردة نهائياً.',
      'success'
    );
  }, [showToast]);

  const login = (name: string, memberId: string = 'm2') => {
    const finalName = name || 'سارة';
    // نحاول مطابقة بيانات العضو من القائمة لعرض اسمه ومدينته الحقيقية
    const matched = members.find((m) => m.id === memberId);
    const matchedAdmin = adminMembers.find((am) => am.id === memberId);

    const newUser: AuthUser = {
      name: matched?.nickname || finalName,
      isLoggedIn: true,
      memberId,
      profile: {
        ...DEFAULT_PROFILE,
        name: matched?.nickname || finalName,
        city: matched?.city || DEFAULT_PROFILE.city,
        age: matched?.age || DEFAULT_PROFILE.age,
        email: matchedAdmin?.email || (memberId === 'm2' ? 'demo@tawasul.sa' : `${memberId}@tawafok.com`),
        realName: matchedAdmin?.realName || matched?.nickname || finalName,
        phone: matchedAdmin?.phone || (memberId === 'm2' ? '+966501234567' : ''),
        whatsapp: matchedAdmin?.whatsapp || (memberId === 'm2' ? '+966501234567' : ''),
        password: matchedAdmin?.password || 'password123',
        plan: (matchedAdmin?.plan || (memberId === 'm2' ? 'gold' : 'free')) as any,
        verified: matched?.verified || false,
      },
    };

    setUser(newUser);
    // تعيين الهوية النشطة لصفحة الطلبات والرحلة حسب الحساب المختار
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('auth_user', JSON.stringify(newUser));
      dataService.db.settings.set('active_member_id', memberId);
    }
  };

  /** تسجيل دخول حقيقي — يُستدعى بعد نجاح Supabase Auth وجلب بيانات العضو المرتبط عبر /api/whoami */
  const loginWithSession = (memberRow: any, authEmail: string) => {
    if (!memberRow) return;
    const newUser: AuthUser = {
      name: memberRow.nickname || authEmail,
      isLoggedIn: true,
      memberId: String(memberRow.id),
      profile: {
        ...DEFAULT_PROFILE,
        name: memberRow.nickname || authEmail,
        city: memberRow.city || DEFAULT_PROFILE.city,
        age: memberRow.age || DEFAULT_PROFILE.age,
        email: memberRow.email || authEmail,
        realName: memberRow.real_name || memberRow.realName || memberRow.nickname || '',
        phone: memberRow.phone || '',
        whatsapp: memberRow.whatsapp || '',
        plan: (memberRow.plan || 'free') as any,
        verified: !!memberRow.verified,
      },
    };
    setUser(newUser);
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('auth_user', JSON.stringify(newUser));
      dataService.db.settings.set('active_member_id', String(memberRow.id));
    }
  };

  const logout = () => {
    setUser({ name: '', isLoggedIn: false, profile: DEFAULT_PROFILE });
    if (typeof window !== 'undefined') {
      dataService.db.settings.remove('auth_user');
      dataService.db.settings.remove('active_member_id');
      dataService.db.settings.remove('impersonating');
    }
    supabaseClient.auth.signOut().catch(() => undefined);
  };

  const registerNewMember = useCallback(async (memberData: any): Promise<{ ok: boolean; error?: string }> => {
    const memberId = 'm_' + Date.now();
    
    let maritalLabel = memberData.maritalStatus;
    let canonicalMaritalStatus = memberData.maritalStatus || 'single';

    if (['single', 'أعزب', 'عزباء'].includes(memberData.maritalStatus)) {
      canonicalMaritalStatus = 'single';
      maritalLabel = memberData.gender === 'male' ? 'أعزب' : 'عزباء';
    } else if (['divorced', 'مطلق', 'مطلقة'].includes(memberData.maritalStatus)) {
      canonicalMaritalStatus = 'divorced';
      maritalLabel = memberData.gender === 'male' ? 'مطلق' : 'مطلقة';
    } else if (['widowed', 'widower', 'widow', 'أرمل', 'أرملة'].includes(memberData.maritalStatus)) {
      canonicalMaritalStatus = memberData.gender === 'male' ? 'widower' : 'widow';
      maritalLabel = memberData.gender === 'male' ? 'أرمل' : 'أرملة';
    } else if (['married', 'متزوج'].includes(memberData.maritalStatus)) {
      canonicalMaritalStatus = 'married';
      maritalLabel = 'متزوج';
    }

    const registeredProfileData: ProfileData = {
      id: memberId,
      gender: (memberData.gender || 'female') as any,
      nickname: memberData.nickname || 'عضو جديد',
      birthDate: memberData.birthDate || '',
      age: Number(memberData.age) || 25,
      country: (memberData.country === 'أخرى' && memberData.countryOther) ? memberData.countryOther : (memberData.country || 'السعودية'),
      city: ((memberData.city === 'أخرى' || memberData.city?.includes('أخرى')) && memberData.cityOther) ? memberData.cityOther : (memberData.city || 'الرياض'),
      district: memberData.district || '',
      sect: ((memberData.sect === 'أخرى' || memberData.sect === 'مذهب آخر') && memberData.sectOther ? memberData.sectOther : memberData.sect) || 'سني',
      sectOther: memberData.sectOther || '',
      nationality: memberData.nationalityMode === 'same'
        ? (getNationalityForCountry(memberData.country, memberData.gender) || memberData.country || 'السعودية')
        : (memberData.nationalityOther || memberData.nationality || memberData.country || 'السعودية'),
      maritalStatus: canonicalMaritalStatus,
      marriageType: memberData.marriageType || 'announced',
      tribe: memberData.tribe || '',
      childrenCount: memberData.childrenCount || '',
      childrenLiveWith: memberData.childrenLiveWith || '',
      hasChildren: memberData.hasChildren === 'yes' || memberData.hasChildren === 'true' || memberData.hasChildren === true ? 'yes' : 'no',
      wifeCount: memberData.wifeCount || '',
      seekingWife: memberData.seekingWife || '',
      height: Number(memberData.height) || 170,
      weight: Number(memberData.weight) || 70,
      skinColor: (memberData.skinColor === 'أخرى' && memberData.skinColorOther) ? memberData.skinColorOther : (memberData.skinColor || 'أبيض قمحي'),
      ethnicity: memberData.ethnicity || '',
      health: memberData.health || 'ممتازة',
      smoking: memberData.smoking || 'لا أدخن',
      education: memberData.education || 'بكالوريوس',
      workType: memberData.workType || 'حكومي',
      jobTitle: memberData.jobTitle || 'موظف',
      housing: memberData.housing || 'ملك',
      bio: memberData.bio || '',
      pCountry: memberData.pCountry || 'السعودية',
      pCity: memberData.pCity || '',
      // العمر المطلوب اختياري؛ لا نضع نطاقاً افتراضياً خفياً عند التسجيل.
      pAgeMin: memberData.pAgeMin === '' || memberData.pAgeMin === undefined ? '' : Number(memberData.pAgeMin),
      pAgeMax: memberData.pAgeMax === '' || memberData.pAgeMax === undefined ? '' : Number(memberData.pAgeMax),
      pNationality: memberData.pNationalityOther || memberData.pNationality || 'لا يهم',
      pMaritalStatus: memberData.pMaritalStatus || 'لا يهم',
      pAcceptChildren: memberData.pAcceptChildren || 'لا يهم',
      pNotes: memberData.pNotes || '',
    };

    const newMember: Member = {
      ...registeredProfileData,
      id: memberId,
      nickname: registeredProfileData.nickname,
      gender: registeredProfileData.gender,
      age: registeredProfileData.age,
      country: registeredProfileData.country,
      city: registeredProfileData.city,
      district: registeredProfileData.district,
      nationality: registeredProfileData.nationality,
      sect: registeredProfileData.sect,
      maritalStatus: canonicalMaritalStatus,
      maritalLabel: maritalLabel || (memberData.gender === 'male' ? 'أعزب' : 'عزباء'),
      marriageType: registeredProfileData.marriageType,
      marriageTypeLabel: memberData.marriageType === 'misyar' ? 'مسيار' : memberData.marriageType === 'both' ? 'لا مانع / معلن او مسيار' : 'معلن',
      tribe: registeredProfileData.tribe,
      hasChildren: memberData.hasChildren === 'yes' || memberData.hasChildren === 'true' || memberData.hasChildren === true,
      childrenCount: memberData.childrenCount || 'لا يوجد',
      height: registeredProfileData.height,
      weight: registeredProfileData.weight,
      skinColor: registeredProfileData.skinColor,
      health: registeredProfileData.health,
      smoking: registeredProfileData.smoking,
      education: registeredProfileData.education,
      workType: registeredProfileData.workType,
      jobTitle: registeredProfileData.jobTitle,
      housing: registeredProfileData.housing,
      bio: registeredProfileData.bio,
      aboutPartner: memberData.pNotes || 'لا توجد مواصفات تفصيلية مضافة',
      verified: false,
      premium: false,
      online: true,
      lastActive: 'متصل الآن',
      sourceType: 'registered',
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
      importDate: new Date().toISOString(),
    } as any;

    const newAdminMember: AdminMember = {
      ...newMember,
      realName: memberData.realName || memberData.nickname || 'عضو جديد',
      email: memberData.email || `${memberId}@tawafok.com`,
      phone: memberData.phone || '',
      whatsapp: memberData.whatsapp || '',
      password: memberData.password || 'password123',
      status: 'active',
      plan: 'free',
      requestsCount: 0,
      joinedAt: new Date().toLocaleDateString('ar-SA'),
    };

    // الحفظ في قاعدة البيانات الحقيقية
    try {
      const created: any = await dataService.db.members.create({
        ...registeredProfileData,
        id: newMember.id,
        nickname: newMember.nickname,
        username: newMember.username || '',
        gender: newMember.gender,
        age: newMember.age,
        country: newMember.country,
        city: newMember.city,
        district: newMember.district || '',
        nationality: newMember.nationality,
        sect: newMember.sect,
        marital_status: newMember.maritalStatus,
        marital_label: newMember.maritalLabel,
        marriage_type: newMember.marriageType,
        tribe: newMember.tribe,
        has_children: newMember.hasChildren,
        children_count: newMember.childrenCount,
        height: newMember.height,
        weight: newMember.weight,
        skin_color: newMember.skinColor,
        health: newMember.health,
        smoking: newMember.smoking,
        education: newMember.education,
        work_type: newMember.workType,
        job_title: newMember.jobTitle,
        housing: newMember.housing,
        bio: newMember.bio,
        about_partner: newMember.aboutPartner,
        verified: false,
        premium: false,
        online: true,
        last_active: new Date().toISOString(),
        source_type: 'registered',
        plan: 'free',
        status: 'active',
        real_name: newAdminMember.realName || '',
        email: newAdminMember.email || '',
        phone: newAdminMember.phone || '',
        whatsapp: newAdminMember.whatsapp || '',
        birth_date: memberData.birthDate || '',
        p_country: registeredProfileData.pCountry,
        p_city: registeredProfileData.pCity,
        p_age_min: registeredProfileData.pAgeMin,
        p_age_max: registeredProfileData.pAgeMax,
        p_nationality: registeredProfileData.pNationality,
        p_marital_status: registeredProfileData.pMaritalStatus,
        p_accept_children: registeredProfileData.pAcceptChildren,
        p_notes: registeredProfileData.pNotes,
      });

      setProfileData(registeredProfileData);
      setMembers((prev) => [newMember, ...prev]);
      setAdminMembers((prev) => [newAdminMember, ...prev]);

      setUser({
        name: created?.nickname || newMember.nickname,
        isLoggedIn: true,
        memberId: String(created?.id || newMember.id),
        profile: {
          name: created?.nickname || newMember.nickname,
          email: created?.email || newAdminMember.email,
          city: newMember.city,
          age: newMember.age,
          plan: 'free',
          verified: false,
          profileCompletion: 100,
          credits: 5,
          realName: created?.realName || newAdminMember.realName,
          phone: created?.phone || newAdminMember.phone,
          whatsapp: memberData.whatsapp || '',
        },
      });

      if (typeof window !== 'undefined') {
        dataService.db.settings.set('active_member_id', String(created?.id || newMember.id));
      }
      return { ok: true };
    } catch (err: any) {
      console.error('Error saving member to Supabase:', err);
      return { ok: false, error: err?.message || 'تعذّر إنشاء الحساب، حاول مرة أخرى' };
    }
  }, [setMembers, setAdminMembers]);

  // يقبل أي عضو له الحقول الأساسية (id, nickname, gender, age, city, ...)
  // سواء من AdminMember أو AdminMemberRowLocal من localStore
  const impersonateUser = (member: {
    id: string;
    nickname: string;
    gender?: string;
    age?: number;
    country?: string;
    city?: string;
    realName?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    plan?: string;
    password?: string;
    verified?: boolean;
    [key: string]: any;
  }) => {
    const fullMember = members.find((m) => m.id === member.id) || (adminMembers as any[]).find((m) => m.id === member.id) || member;
    const newUser: AuthUser = {
      name: member.nickname || fullMember.nickname,
      isLoggedIn: true,
      memberId: member.id,
      profile: {
        ...DEFAULT_PROFILE,
        name: member.nickname || fullMember.nickname,
        realName: member.realName || fullMember.realName || member.nickname,
        email: member.email || fullMember.email || '',
        phone: member.phone || fullMember.phone || '',
        whatsapp: member.whatsapp || fullMember.whatsapp || '',
        city: member.city || fullMember.city || DEFAULT_PROFILE.city,
        age: member.age || fullMember.age || DEFAULT_PROFILE.age,
        plan: (member.plan as UserProfile['plan']) || (fullMember.plan as UserProfile['plan']) || 'free',
        verified: member.verified !== undefined ? !!member.verified : !!fullMember.verified,
        profileCompletion: 100,
      },
    };
    setUser(newUser);

    const bd = fullMember.birthDate || fullMember.birth_date || (fullMember.age ? `${new Date().getFullYear() - fullMember.age}-01-01` : '');
    setProfileData({
      id: fullMember.id,
      gender: fullMember.gender || 'female',
      nickname: fullMember.nickname || fullMember.name || 'عضو',
      birthDate: bd,
      age: fullMember.age || 26,
      country: fullMember.country || 'السعودية',
      city: fullMember.city || 'الرياض',
      district: fullMember.district || '',
      sect: fullMember.sect || '',
      sectOther: fullMember.sectOther || '',
      nationality: fullMember.nationality || fullMember.country || 'السعودية',
      maritalStatus: fullMember.maritalStatus || 'single',
      marriageType: fullMember.marriageType || 'announced',
      tribe: fullMember.tribe || '',
      childrenCount: fullMember.childrenCount || '',
      childrenLiveWith: fullMember.childrenLiveWith || '',
      hasChildren: fullMember.hasChildren ? 'yes' : 'no',
      wifeCount: fullMember.wifeCount || '',
      seekingWife: fullMember.seekingWife || '',
      height: fullMember.height || 0,
      weight: fullMember.weight || 0,
      skinColor: fullMember.skinColor || '',
      ethnicity: fullMember.ethnicity || '',
      health: fullMember.health || '',
      smoking: fullMember.smoking || '',
      acceptPolygamy: fullMember.acceptPolygamy || '',
      acceptDivorced: fullMember.acceptDivorced || '',
      acceptWithChildren: fullMember.acceptWithChildren || '',
      education: fullMember.education || '',
      workType: fullMember.workType || '',
      jobTitle: fullMember.jobTitle || '',
      housing: fullMember.housing || '',
      bio: fullMember.bio || '',
      pCountry: fullMember.pCountry || 'السعودية',
      pCity: fullMember.pCity || '',
      pAgeMin: fullMember.pAgeMin ?? '',
      pAgeMax: fullMember.pAgeMax ?? '',
      pNationality: fullMember.pNationality || 'لا يهم',
      pMaritalStatus: fullMember.pMaritalStatus || 'لا يهم',
      pAcceptChildren: fullMember.pAcceptChildren || 'لا يهم',
      pSect: fullMember.pSect || '',
      pSectOther: fullMember.pSectOther || '',
      pEducation: fullMember.pEducation || '',
      pWorkType: fullMember.pWorkType || '',
      pSkinColor: fullMember.pSkinColor || '',
      pHousing: fullMember.pHousing || '',
      pNotes: fullMember.pNotes || fullMember.aboutPartner || '',
    });

    // تخزين الهوية النشطة لصفحة الطلبات والرحلة
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('auth_user', JSON.stringify(newUser));
      dataService.db.settings.set('active_member_id', member.id);
      dataService.db.settings.set('impersonating', 'true');
    }
    showToast(`تم تسجيل الدخول كـ ${member.nickname || fullMember.nickname} — أنت تتصفّح بحسابه الآن`, 'success');
  };

  const importMembers = (newMembers: AdminMember[], replaceExisting = false) => {
    if (!newMembers || newMembers.length === 0) return;

    const inferGender = (member: any) => {
      const raw = String(member.gender || '').trim().toLowerCase();
      if (raw === 'male' || raw === 'ذكر' || raw === 'm' || raw.includes('رجل')) return 'male';
      if (raw === 'female' || raw === 'أنثى' || raw === 'انثى' || raw === 'f' || raw.includes('امرأة') || raw.includes('بنت')) return 'female';
      const status = String(member.maritalStatus || member.maritalLabel || '').trim();
      if (['أعزب', 'مطلق', 'أرمل', 'متزوج', 'widower'].some((v) => status.includes(v))) return 'male';
      if (['عزباء', 'مطلقة', 'أرملة', 'متزوجة', 'widow'].some((v) => status.includes(v))) return 'female';
      const name = String(member.nickname || member.realName || '').trim();
      if (/^(أبو|ابو)\s/.test(name)) return 'male';
      if (/^(أم|ام|بنت)\s/.test(name)) return 'female';
      return '';
    };

    const normalizedNewMembers = newMembers.map((member) => {
      const g = inferGender(member);
      // لا يُخترع اسم: إن لم يوجد اسم مستعار صريح، يُشتق تصنيف بسيط من الجنس (رجل/أنثى)
      const nickname = String(member.nickname || '').trim() || (g === 'male' ? 'رجل' : g === 'female' ? 'أنثى' : '');
      return {
        ...member,
        nickname,
        realName: member.realName || (member as any).real_name || '',
        gender: g as any,
        age: Number(member.age) || 0,
        status: member.status || 'active',
        sourceType: member.sourceType || 'imported',
        plan: member.plan || 'free',
        importDate: member.importDate || new Date().toISOString(),
        marriageType: member.marriageType || (member as any).marriage_type || 'announced',
        marriageTypeLabel: (member as any).marriageTypeLabel || (
          (member.marriageType || (member as any).marriage_type) === 'misyar' ? 'مسيار' :
          (member.marriageType || (member as any).marriage_type) === 'both' ? 'لا مانع / معلن او مسيار' : 'معلن'
        ),
        tribe: member.tribe || (member as any).tribe || '',
        aboutPartner: member.aboutPartner || (member as any).pNotes || (member as any).p_notes || (member as any).partner_notes || '',
        isProfileIncomplete: member.isProfileIncomplete !== undefined ? Boolean(member.isProfileIncomplete) : (!member.city || !g || (!member.height && !member.weight)),
      };
    }) as AdminMember[];

    // 1. Calculate base arrays synchronously
    const currentAdminList = adminMembers.length > 0 ? adminMembers : (dataService.db.getLiveMembers(true) as AdminMember[]);
    const currentPublicList = members.length > 0 ? members : (dataService.db.getLiveMembers(false) as any[]);

    let nextAdminMembers: AdminMember[] = [];
    let nextPublicMembers: any[] = [];

    if (replaceExisting) {
      const newIds = new Set(normalizedNewMembers.map(nm => nm.id));
      const newEmails = new Set(normalizedNewMembers.map(nm => nm.email?.toLowerCase()).filter(Boolean));
      const newPhones = new Set(normalizedNewMembers.map(nm => nm.phone).filter(Boolean));

      const filteredAdmin = currentAdminList.filter(m => !newIds.has(m.id) && !newEmails.has((m as any).email?.toLowerCase()) && !newPhones.has((m as any).phone));
      nextAdminMembers = [...normalizedNewMembers, ...filteredAdmin];

      const filteredPublic = currentPublicList.filter(m => !newIds.has(m.id) && !newEmails.has((m as any).email?.toLowerCase()) && !newPhones.has((m as any).phone));
      const publicMembers = normalizedNewMembers.map(nm => ({
        ...nm,
        isManagedByAdmin: nm.isManagedByAdmin,
        managedByAdminId: nm.managedByAdminId
      }));
      nextPublicMembers = [...publicMembers, ...filteredPublic];
    } else {
      nextAdminMembers = [...normalizedNewMembers, ...currentAdminList];
      const publicMembers = normalizedNewMembers.map(nm => ({
        ...nm,
        isManagedByAdmin: nm.isManagedByAdmin,
        managedByAdminId: nm.managedByAdminId
      }));
      nextPublicMembers = [...publicMembers, ...currentPublicList];
    }

    // 2. Set React state
    setAdminMembers(nextAdminMembers);
    setMembers(nextPublicMembers);

    // 3. حفظ جماعي سريع: طلب واحد لكل الدفعة بدلاً من طلب لكل عضو
    //    مع إرفاق رمز جلسة المشرف الحقيقية (الاستيراد الجماعي يتطلب صلاحية إدارية على الخادم)
    (async () => {
      let token: string | null = null;
      try {
        const { data } = await supabaseClient.auth.getSession();
        token = data?.session?.access_token || null;
      } catch { /* ignore */ }
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) authHeaders.Authorization = `Bearer ${token}`;
      return fetch('/api/members', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ bulk: normalizedNewMembers, _authToken: token }),
      });
    })()
      .then(async (res) => {
        if (res.ok || res.status === 207) {
          const result = await res.json().catch(() => null);
          if (result && result.failedCount > 0) {
            showToast(`تنبيه: تعذر حفظ ${result.failedCount} عضو في قاعدة البيانات — راجع سجل الأخطاء`, 'error');
            console.error('Bulk import partial failures:', result.failed);
          }
          // تحديث الحالة من قاعدة البيانات (إن وجدت)
          try {
            const refreshed = await dataService.db.adminGetMembers();
            if (Array.isArray(refreshed) && refreshed.length > 0) {
              setAdminMembers(refreshed as AdminMember[]);
              setMembers((refreshed.filter((m: any) => !m.status || m.status === 'active') as unknown) as Member[]);
            }
          } catch (e) {
            console.error('Error refreshing imported members:', e);
          }
        } else if (res.status === 404 || res.status === 405) {
          // في حال عدم توفر المسار /api/members في البيئة المستقلة (SPA) تم الحفظ محلياً بنجاح في الخطوة 4
          console.info('[BulkImport] Backend endpoint /api/members returned status ' + res.status + '. Members persisted in local storage.');
        } else {
          throw new Error(`Bulk import failed with status ${res.status}`);
        }
      })
      .catch((e) => {
        console.warn('API bulk persistence skipped or unhandled (saved locally):', e?.message || e);
      });

    // 4. Save updated lists directly to localStorage settings
    if (typeof window !== 'undefined') {
      try {
        dataService.db.settings.set('saved_members_list', JSON.stringify(nextPublicMembers));
        dataService.db.settings.set('saved_admin_members_list', JSON.stringify(nextAdminMembers));
        dataService.db.settings.set('twafok_members', JSON.stringify(nextAdminMembers));
        localStorage.setItem('saved_members_list', JSON.stringify(nextPublicMembers));
        localStorage.setItem('saved_admin_members_list', JSON.stringify(nextAdminMembers));
        localStorage.setItem('twafok_members', JSON.stringify(nextAdminMembers));
      } catch (e) {
        console.error('Error saving updated members list:', e);
      }
    }

    // 5. Update admin metadata in localStorage for both modes
    if (typeof window !== 'undefined') {
      try {
        const raw = dataService.db.settings.get('twafok_admin_meta_v1');
        const meta = raw ? JSON.parse(raw) : {};
        normalizedNewMembers.forEach(nm => {
          meta[nm.id] = {
            status: nm.status || 'active',
            plan: nm.premium ? 'gold' : 'free',
            realName: nm.realName || nm.nickname || nm.id,
            email: nm.email || '',
            phone: nm.phone || '',
            nationalId: (nm as any).nationalId || '',
            password: (nm as any).password || '',
            joinedAt: (nm as any).joinedAt || new Date().toISOString().split('T')[0],
            verifiedOverride: nm.verified,
            premiumOverride: nm.premium,
            adminNote: (nm as any).adminNote || '',
            flagged: !!(nm as any).flagged,
          };
        });
        dataService.db.settings.set('twafok_admin_meta_v1', JSON.stringify(meta));
      } catch (e) {
        console.error(e);
      }
    }

    showToast(`تم استيراد وتحديث ${normalizedNewMembers.length} عضو بنجاح`, 'success');
  };

  const toggleLike = (id: string) => {
    setLikedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        showToast('تمت الإزالة من المحفوظات', 'info');
      } else {
        next.add(id);
        showToast('تم الحفظ في المحفوظات ❤️', 'success');
      }
      // Save immediately for the active user session
      if (user.memberId && typeof window !== 'undefined') {
        dataService.db.settings.set('liked_members_' + user.memberId, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  // قائمة الحظر الشخصية — عضو محظور من طرفك لا يظهر لك في البحث ولا يمكنه التواصل معك
  const toggleBlock = (id: string) => {
    setBlockedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        showToast('تم إلغاء الحظر عن هذا العضو', 'info');
      } else {
        next.add(id);
        showToast('تم حظر هذا العضو، لن يظهر لك بعد الآن 🚫', 'success');
      }
      if (user.memberId && typeof window !== 'undefined') {
        dataService.db.settings.set('blocked_members_' + user.memberId, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  // استرجاع قائمة الحظر عند تسجيل الدخول
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined' && user.isLoggedIn && user.memberId) {
      const saved = dataService.db.settings.get('blocked_members_' + user.memberId);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setBlockedMembers(new Set(parsed));
        } catch { /* ignore */ }
      }
    } else {
      setBlockedMembers(new Set());
    }
  }, [user.isLoggedIn, user.memberId, isInitialized]);

  const upgradePlan = (plan: 'gold' | 'elite') => {
    const userId = dataService.db.getCurrentUserId();
    const targetPlan = plans.find((p) => p.id === plan);
    if (userId) {
      dataService.db.adminUpdateMember(userId, { plan, premium: plan === 'elite' });
      // Grant free messages package
      if (targetPlan && targetPlan.messagesLimit) {
        dataService.db.buyMessagePackageCustom(userId, targetPlan.messagesLimit, 0);
      }
      // تسجيل المعاملة المالية في جدول transactions الحقيقي
      fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          amount: targetPlan?.price ?? 0,
          type: 'subscription',
          description: `ترقية إلى ${targetPlan?.name || (plan === 'gold' ? 'الباقة الذهبية' : 'باقة النخبة')}`,
          status: 'completed',
          metadata: { plan },
        }),
      }).catch(() => undefined);
    }
    setUser((prev) => ({
      ...prev,
      profile: { ...prev.profile, plan },
    }));
    if (userId) {
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, plan, premium: plan === 'elite' } : m))
      );
    }
    showToast(`تم تفعيل باقة ${plan === 'gold' ? 'الذهبية' : 'المميزة'} بنجاح! 🎉`, 'success');
  };

  const updatePlan = (updated: Plan) => {
    setPlans((prev) => {
      const next = prev.map((p) => (p.id === updated.id ? updated : p));
      if (typeof window !== 'undefined') {
        dataService.db.settings.set('saved_plans', JSON.stringify(next));
      }
      return next;
    });
    showToast(`تم تحديث باقة ${updated.name} بنجاح!`, 'success');
  };

  const addPlan = (newPlan: Plan) => {
    setPlans((prev) => {
      const next = [...prev, newPlan];
      if (typeof window !== 'undefined') {
        dataService.db.settings.set('saved_plans', JSON.stringify(next));
      }
      return next;
    });
    showToast(`تم إضافة باقة ${newPlan.name} بنجاح!`, 'success');
  };

  const deletePlan = (id: string) => {
    setPlans((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (typeof window !== 'undefined') {
        dataService.db.settings.set('saved_plans', JSON.stringify(next));
      }
      return next;
    });
    showToast('تم حذف الباقة بنجاح!', 'success');
  };

  const updatePaypalSettings = (settings: PaypalSettings) => {
    setPaypalSettings(settings);
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('paypal_settings', JSON.stringify(settings));
    }
    showToast('تم حفظ إعدادات PayPal بنجاح!', 'success');
  };

  const updateSocialSettings = (settings: SocialSettings) => {
    setSocialSettings(settings);
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('social_settings', JSON.stringify(settings));
    }
    showToast('تم حفظ إعدادات التواصل الاجتماعي بنجاح!', 'success');
  };

  // CHECK LIMIT LOGIC
  const checkLimit = useCallback((action: 'message' | 'search' | 'contact') => {
    const isAdminImpersonating = typeof window !== 'undefined' && dataService.db.settings.get('impersonating') === 'true';
    if (isAdminImpersonating) {
      return {
        allowed: true,
        current: action === 'message' ? usage.messagesSent : action === 'search' ? usage.searchesDone : usage.contactsViewed,
        max: 999,
        error: undefined,
      };
    }

    const currentPlanId = user.profile.plan || 'free';
    const activePlan = plans.find((p) => p.id === currentPlanId) || plans[0];

    let max = 0;
    let current = 0;

    if (action === 'message') {
      if (unlimitedInterestsUntil > Date.now()) {
        return {
          allowed: true,
          current: usage.messagesSent,
          max: 999,
          error: undefined,
        };
      }
      const baseMax = activePlan.requestsLimit !== undefined ? activePlan.requestsLimit : (activePlan.messagesLimit !== undefined ? activePlan.messagesLimit : 3);
      max = baseMax + extraInterestsCount;
      current = usage.messagesSent;
    } else if (action === 'search') {
      max = activePlan.searchLimit !== undefined ? activePlan.searchLimit : 2;
      current = usage.searchesDone;
    } else if (action === 'contact') {
      max = activePlan.showContactLimit !== undefined ? activePlan.showContactLimit : 0;
      current = usage.contactsViewed;
    }

    const allowed = current < max;

    return {
      allowed,
      current,
      max,
      error: allowed
        ? undefined
        : `لقد استنفدت حد باقتك لطلبات الاهتمام المساعدة والربط المباشر (${max}/${max}). يمكنك ترقية باقتك أو شراء باقات طلبات اهتمام إضافية فورياً لمواصلة التواصل مع شريك حياتك المنشود.`,
    };
  }, [user.profile.plan, plans, usage, extraInterestsCount, unlimitedInterestsUntil]);

  // INCREMENT COUNTER ON ACTION SUCCESS
  const incrementUsage = useCallback((action: 'message' | 'search' | 'contact') => {
    setUsage((prev) => {
      const next = { ...prev };
      if (action === 'message') next.messagesSent += 1;
      if (action === 'search') next.searchesDone += 1;
      if (action === 'contact') next.contactsViewed += 1;

      if (typeof window !== 'undefined') {
        dataService.db.settings.set(getUsageStorageKey(), JSON.stringify(next));
        if (getActiveMemberIdForUsage() === 'm2') {
          dataService.db.settings.set('user_usage_counters', JSON.stringify(next));
        }
      }
      return next;
    });
  }, [getUsageStorageKey, getActiveMemberIdForUsage]);

  const resetUsage = useCallback(() => {
    const fresh = { messagesSent: 0, searchesDone: 0, contactsViewed: 0 };
    setUsage(fresh);
    if (typeof window !== 'undefined') {
      dataService.db.settings.set(getUsageStorageKey(), JSON.stringify(fresh));
      if (getActiveMemberIdForUsage() === 'm2') {
        dataService.db.settings.set('user_usage_counters', JSON.stringify(fresh));
      }
    }
    showToast('تم تصفير عدادات الاستخدام والميزات التجريبية بنجاح.', 'success');
  }, [showToast, getUsageStorageKey, getActiveMemberIdForUsage]);

  // MICROTRANSACTIONS LOGIC (buying 20 messages pack or 1 contact pack)
  const buyMicrotransaction = useCallback((type: 'messages_20' | 'contact_1', cost: number) => {
    // subtract usage offset so user gets more tokens allowed or just deduct from usage counter
    setUsage((prev) => {
      const next = { ...prev };
      if (type === 'messages_20') {
        // give breathing room of 20 more messages
        next.messagesSent = Math.max(0, next.messagesSent - 20);
      } else if (type === 'contact_1') {
        // give breathing room of 1 more contact
        next.contactsViewed = Math.max(0, next.contactsViewed - 1);
      }
      if (typeof window !== 'undefined') {
        dataService.db.settings.set('user_usage_counters', JSON.stringify(next));
      }
      return next;
    });

    setUser((prev) => {
      const nextProfile = { ...prev.profile };
      // optionally adjust credits if they had enough
      nextProfile.credits = Math.max(0, nextProfile.credits - cost);
      return { ...prev, profile: nextProfile };
    });

    showToast(
      type === 'messages_20'
        ? `🎉 تم شراء حزمة (20 رسالة إضافية) وتفعيلها بنجاح!`
        : `🎉 تم تفعيل رؤية رقم تواصل لحساب إضافي بنجاح!`,
      'success'
    );
  }, [showToast]);

  // PROFILE BOOSTING LOGIC
  const boostProfile = useCallback(() => {
    setIsBoosted(true);
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('profile_boosted', 'true');
    }
    setUser((prev) => ({
      ...prev,
      profile: { ...prev.profile, isBoosted: true },
    }));
    showToast('تم رفع وترقية ملفك متصدراً نتائج البحث بنجاح! 🚀✨', 'success');
  }, [showToast]);

  // Synchronize demo user profile updates with the member 'm2' list entry in real-time
  useEffect(() => {
    if (user.isLoggedIn && user.profile.email === 'demo@tawasul.sa') {
      const p = user.profile;
      setMembers((prev) =>
        prev.map((m) =>
          m.id === 'm2'
            ? {
                ...m,
                nickname: p.name,
                city: p.city,
                age: p.age,
                verified: p.verified,
                premium: p.plan !== 'free',
              }
            : m
        )
      );
      setAdminMembers((prev) =>
        prev.map((m) =>
          m.id === 'm2'
            ? {
                ...m,
                nickname: p.name,
                city: p.city,
                age: p.age,
                realName: p.name + ' القحطاني',
                verified: p.verified,
                plan: p.plan,
              }
            : m
        )
      );
    }
  }, [user]);

  // Mathematically balanced weighted compatibility index calculator
  const calculateCompat = useCallback((m1: Member, m2: Member): number => {
    const currentUserMember = members.find(m => m.id === 'm2') || m1;
    const result = calculateCompatibility(currentUserMember, m2, profileData);
    return result.score;
  }, [members, profileData]);

  // حساب تفصيلي يرجع الأسباب والألوان
  const calculateCompatDetailed = useCallback((target: Member): CompatResult => {
    const currentUserMember = members.find(m => m.id === 'm2');
    if (!currentUserMember) {
      return { score: 0, isGenderMatch: false, isEstimated: false, reasons: [], details: [] };
    }
    return calculateCompatibility(currentUserMember, target, profileData);
  }, [members, profileData]);

  // Secure API Operations for Administrative Console
  const adminDeleteMember = useCallback((id: string) => {
    setAdminMembers((prev) => prev.filter((m) => m.id !== id));
    setMembers((prev) => prev.filter((m) => m.id !== id));
    
    // Cascading Delete: remove from liked/bookmarked lists
    setLikedMembers((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    // Cascading Delete: remove from pending/active interest requests
    setInterestRequests((prev) => prev.filter((r) => r.senderId !== id && r.receiverId !== id));
    
    // real-time Session Invalidation
    if (id === 'm2' || (user.isLoggedIn && user.profile.email === 'demo@tawasul.sa' && id === 'm2')) {
      logout();
      showToast('تم إلغاء جلستك فوراً وحذف حسابك من قواعد البيانات بشكل متتالٍ وآمن', 'error');
    } else {
      showToast('تم حذف حساب العضو كلياً من المنصة مع إزالة كافة الارتباطات والبيانات ذات الصلة', 'success');
    }
  }, [user, logout, showToast]);

  const adminUpdateMemberStatus = useCallback((id: string, status: AdminMember['status'], reason?: string) => {
    setAdminMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status, statusReason: status === 'active' ? '' : (reason ?? m.statusReason) } : m)));
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));

    // Real-time Session Invalidation on restrictive statuses
    const restrictive = status === 'suspended' || status === 'banned';
    if (restrictive) {
      if (id === 'm2' || (user.isLoggedIn && user.profile.email === 'demo@tawasul.sa' && id === 'm2')) {
        logout();
        showToast('تم تقييد حسابك وطرد جلستك فوراً لأسباب انضباطية من الإدارة', 'error');
      } else {
        const label = status === 'banned' ? 'حظر' : 'إيقاف';
        showToast(`تم ${label} حساب العضو قسرياً بنجاح`, 'info');
      }
    } else {
      showToast('تم تحديث حالة العضو وتأكيدها بنجاح', 'success');
    }
  }, [user, logout, showToast]);

  // حذف نهائي لعضو من واجهة البلاغات/الرسائل
  const adminDeleteMemberFromReports = useCallback((id: string) => {
    setAdminMembers((prev) => prev.filter((m) => m.id !== id));
    setMembers((prev) => prev.filter((m) => m.id !== id));
    showToast('تم حذف حساب العضو نهائياً من المنصة', 'success');
  }, [showToast]);

  const adminUpdateMember = useCallback((updated: AdminMember) => {
    setAdminMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setMembers((prev) =>
      prev.map((m) =>
        m.id === updated.id
          ? {
              ...m,
              nickname: updated.nickname,
              gender: updated.gender,
              age: updated.age,
              country: updated.country,
              city: updated.city,
              district: updated.district,
              nationality: updated.nationality,
              sect: updated.sect,
              maritalStatus: updated.maritalStatus,
              maritalLabel: updated.maritalLabel,
              hasChildren: updated.hasChildren,
              childrenCount: updated.childrenCount,
              height: updated.height,
              weight: updated.weight,
              skinColor: updated.skinColor,
              health: updated.health,
              smoking: updated.smoking,
              education: updated.education,
              workType: updated.workType,
              housing: updated.housing,
              bio: updated.bio,
              aboutPartner: updated.aboutPartner,
              verified: updated.verified,
              premium: updated.plan !== 'free',
              status: updated.status,
            }
          : m
      )
    );
    
    // If updating the demo user, synchronize current auth session
    if (updated.id === 'm2') {
      setUser((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          name: updated.nickname,
          city: updated.city,
          age: updated.age,
          plan: updated.plan,
          verified: updated.verified,
        },
      }));
    }
    
    showToast('تم حفظ التعديلات وترقية حدود العضو برمجياً فورياً وفي اللحظة نفسها', 'success');
  }, [showToast]);

  const adminSendBulkBroadcast = useCallback(async (title: string, message: string, audience: 'all' | 'verified' | 'premium' | 'specific', specificIds?: string[]) => {
    // Non-blocking asynchronous chunk-by-chunk scheduling simulation representing Async Bulk Insertion
    showToast('تجري الجدولة غير المتزامنة والإدراج على دفعات لجدول مستلمي الرسائل (message_recipient)...', 'info');
    
    return new Promise<void>((resolve) => {
      let insertedCount = 0;
      
      // Combine all members sources
      const memberMap = new Map<string, any>();
      (members || []).forEach((m) => memberMap.set(m.id, m));
      (adminMembers || []).forEach((m) => memberMap.set(m.id, m));
      const allMembersList = Array.from(memberMap.values());
      
      let targetMembers: any[] = [];
      if (audience === 'all') {
        targetMembers = allMembersList;
      } else if (audience === 'verified') {
        targetMembers = allMembersList.filter((m) => m.verified);
      } else if (audience === 'premium') {
        targetMembers = allMembersList.filter((m) => m.premium || m.plan === 'gold' || m.plan === 'elite');
      } else if (audience === 'specific') {
        targetMembers = allMembersList.filter((m) => specificIds?.includes(m.id));
      }
      
      const targetCount = targetMembers.length || 1;
      const batchSize = Math.max(1, Math.floor(targetCount / 4));
      
      const timer = setInterval(async () => {
        insertedCount += batchSize;
        if (insertedCount >= targetCount) {
          insertedCount = targetCount;
          clearInterval(timer);
          
          // Actually write persistent notifications to localStore/DB for matched members
          const userIdsToSend = targetMembers.map((m) => m.id);
          if (audience === 'all') {
            userIdsToSend.push('all');
          }
          await dataService.db.adminSendBulkNotifications(userIdsToSend, message, title);
          
          setAdminNotifications((prev) => [
            {
              id: 'an' + Date.now(),
              title,
              message,
              audience,
              sentAt: 'الآن',
              recipients: targetCount,
            },
            ...prev,
          ]);
          
          showToast(`تم الإدراج بنجاح! تم استهداف وتوصيل الرسالة إلى ${targetCount.toLocaleString('ar-EG')} عضو نشط`, 'success');
          resolve();
        } else {
          showToast(`جاري إدراج الدفعة... (${insertedCount.toLocaleString('ar-EG')} / ${targetCount.toLocaleString('ar-EG')})`, 'info');
        }
      }, 300);
    });
  }, [showToast, adminMembers, members]);

  const adminUpdateInterestRequestStatus = useCallback(async (requestId: string, status: RequestStatus | 'accepted', declineReason?: string) => {
    const targetStatus: RequestStatus = status === 'accepted' ? 'accepted_pending_payment' : status;
    
    // 1. Calculate compatibility if accepted
    if (targetStatus === 'accepted_pending_payment') {
      const req = interestRequests.find(r => r.id === requestId);
      if (req) {
        const partnerId = req.senderId === 'm2' ? req.receiverId : req.senderId;
        const requester = members.find((m) => m.id === partnerId);
        const targetMember = members.find((m) => m.id === 'm2');
        
        if (requester && targetMember) {
          const weightCompat = calculateCompat(requester, targetMember);
          showToast(`تم قياس وحساب التوافق الموزون للمعادلة الرياضية: ${weightCompat}% للطرفين`, 'success');
          
          setMembers((currMembers) =>
            currMembers.map((m) =>
              m.id === partnerId ? { ...m, matchScore: weightCompat } : m
            )
          );
          setAdminMembers((currAdmin) =>
            currAdmin.map((m) =>
              m.id === partnerId ? { ...m, matchScore: weightCompat } : m
            )
          );
        }
      }
    }

    // 2. Sync with localStore database
    const cleanId = typeof requestId === 'string' ? Number(requestId.replace(/\D/g, '')) : Number(requestId);
    let dbSuccess = false;
    if (!isNaN(cleanId) && cleanId > 0) {
      if (targetStatus === 'accepted_pending_payment' || targetStatus === 'accepted_pending_admin') {
        const res = await dataService.db.runRequestAction(cleanId, 'accept', 'admin');
        dbSuccess = res.ok;
      } else if (targetStatus === 'declined') {
        const res = await dataService.db.runRequestAction(cleanId, 'decline', 'admin', { reason: declineReason || 'عدم التوافق' });
        dbSuccess = res.ok;
      } else if (targetStatus === 'cancelled') {
        const res = await dataService.db.runRequestAction(cleanId, 'cancel', 'admin', { reason: declineReason || 'تم الإلغاء' });
        dbSuccess = res.ok;
      }
    }

    // 3. Fallback to manual state update if not in database (for legacy compat)
    if (!dbSuccess) {
      setInterestRequests((prevRequests) => {
        return prevRequests.map((req) => {
          if (req.id === requestId) {
            const deadlineTime = targetStatus === 'accepted_pending_payment' 
              ? new Date(Date.now() + 72 * 3600 * 1000).toISOString() 
              : req.paymentDeadline;

            return { 
              ...req, 
              status: targetStatus, 
              ...(declineReason !== undefined ? { declineReason } : {}),
              ...(targetStatus === 'accepted_pending_payment' ? { 
                paymentStatus: 'waiting_for_payment' as const,
                paymentDeadline: deadlineTime,
                senderPaid: false,
                receiverPaid: false,
                attemptsCount: FEE_CONFIG.freeAttemptsAfterDeposit,
              } : {}),
              ...(targetStatus === 'paid' ? { 
                paymentStatus: 'paid' as const,
                paidAt: 'الآن',
                mediationStage: 'scheduling' as MediationStage,
              } : {}),
              ...(targetStatus === 'in_mediation' ? { 
                mediationStage: 'scheduling' as MediationStage,
              } : {}),
              ...(targetStatus === 'completed' ? { 
                mediationStage: 'evaluating' as MediationStage,
              } : {}),
              ...(targetStatus === 'cancelled' ? { 
                refundPercentage: req.mediationStage === 'evaluating' || req.status === 'in_mediation' 
                  ? FEE_CONFIG.refundAfterMeeting 
                  : FEE_CONFIG.refundBeforeMeeting,
              } : {}),
            };
          }
          return req;
        });
      });
    }
    
    const statusLabels: Record<RequestStatus, string> = {
      pending: 'قيد الانتظار',
      accepted_pending_admin: 'مقبول وبانتظار موافقة الإدارة والتحقق ⏳',
      accepted_pending_payment: 'تمت الموافقة وبانتظار سداد رسوم تأكيد الجدية ثنائياً 💳',
      paid: 'تم السداد، جاهز للوساطة ✅',
      in_mediation: 'الوساطة جارية 🤝',
      completed: 'مكتمل 🎉',
      declined: 'مرفوض',
      cancelled: 'ملغى',
    };
    showToast(`تم تحديث حالة طلب الاهتمام: ${statusLabels[targetStatus]}`, 'info');
  }, [interestRequests, members, calculateCompat, showToast]);

  const adminUpdateInterestRequestDetails = useCallback((requestId: string, fields: Partial<InterestRequest>) => {
    setInterestRequests((prevRequests) => {
      return prevRequests.map((req) => {
        if (req.id === requestId) {
          return { ...req, ...fields };
        }
        return req;
      });
    });
    showToast('تم حفظ تحديثات طلب الاهتمام والموعد بنجاح بنظام التوفيق والمطابقة ✓', 'success');
  }, [showToast]);

  const adminModeratePreExchangeMessage = useCallback((requestId: string, messageId: string, action: 'approve' | 'reject') => {
    setInterestRequests((prevRequests) => {
      return prevRequests.map((req) => {
        if (req.id === requestId) {
          const updatedMessages = (req.chatMessages || []).map((msg: any) => {
            if (msg.id === messageId) {
              return {
                ...msg,
                approved: action === 'approve',
                rejected: action === 'reject',
              };
            }
            return msg;
          });
          return {
            ...req,
            chatMessages: updatedMessages,
          };
        }
        return req;
      });
    });
    showToast(action === 'approve' ? 'تمت الموافقة على الرسالة وتوصيلها للطرف الآخر ✓' : 'تم رفض وتصفية الرسالة لمخالفتها شروط المنصة ❌', 'info');
  }, [showToast]);

  const sendInterestRequest = useCallback(async (memberId: string, messageText: string) => {
    const activeUserId = user.isLoggedIn ? (user.memberId || dataService.db.getCurrentUserId()) : null;
    const isAdminImpersonating = typeof window !== 'undefined' && dataService.db.settings.get('impersonating') === 'true';

    if (!user.isLoggedIn || !activeUserId) {
      showToast('يرجى تسجيل الدخول أو إنشاء حساب أولاً لإرسال طلب اهتمام', 'info');
      return { ok: false, error: 'غير مسجل الدخول' };
    }

    if (activeUserId === memberId) {
      showToast('لا يمكنك إرسال طلب اهتمام لنفسك', 'error');
      return { ok: false, error: 'لا يمكنك إرسال طلب اهتمام لنفسك' };
    }

    // 1. التحقق من شرط التوثيق في حال تفعيله من الإدارة
    if (requireVerificationForRequests && !isAdminImpersonating) {
      const activeMember = members.find(m => m.id === activeUserId) || adminMembers.find(m => m.id === activeUserId);
      if (activeMember && !activeMember.verified) {
        showToast('عذراً، يجب توثيق حسابك بالهوية الوطنية أولاً لتتمكن من إرسال طلبات الاهتمام.', 'error');
        return { ok: false, error: 'يجب توثيق الحساب بالهوية الوطنية' };
      }
    }

    // 2. التحقق من الحد الأقصى للعلاقات المتزامنة النشطة
    const activeRequestsCount = interestRequests.filter(
      r => (r.senderId === activeUserId || r.receiverId === activeUserId) &&
        ['pending', 'accepted_pending_payment', 'paid', 'in_mediation', 'sharia_viewing', 'coordination', 'seriousness', 'engagement'].includes(r.status)
    ).length;
    if (!isAdminImpersonating && activeRequestsCount >= maxActiveRequests) {
      showToast(`عذراً، لقد تجاوزت الحد الأقصى للعلاقات المتزامنة النشطة المسموح به حالياً (${maxActiveRequests} علاقات) لضمان جدية التواصل والتركيز.`, 'error');
      return { ok: false, error: 'تجاوزت الحد الأقصى للعلاقات النشطة' };
    }

    // منع التكرار — التحقق من وجود طلب نشط غير منتهٍ لنفس الشخص
    const existingPending = interestRequests.find(
      r => (r.senderId === activeUserId || r.sender_id === activeUserId) &&
           (r.receiverId === memberId || r.receiver_id === memberId) &&
           r.journey_stage !== 'declined' && r.journey_stage !== 'cancelled' &&
           r.status !== 'declined' && r.status !== 'cancelled' && r.status !== 'rejected'
    );
    if (existingPending) {
      showToast('لديك طلب نشط لدى هذا العضو بالفعل', 'error');
      return { ok: false, error: 'لديك طلب نشط لدى هذا العضو بالفعل' };
    }

    const res = await dataService.db.createRequest(activeUserId, memberId, messageText.trim() || 'طلب اهتمام مرسل عبر الإدارة');
    if (res && res.ok) {
      showToast('تم إرسال طلب الاهتمام بنجاح! 💌', 'success');
      await refreshInterestRequests();
      return { ok: true, data: res.data };
    } else {
      showToast(res?.error || 'تعذر إرسال طلب الاهتمام', 'error');
      return { ok: false, error: res?.error || 'تعذر إرسال طلب الاهتمام' };
    }
  }, [
    interestRequests,
    user.memberId,
    requireVerificationForRequests,
    maxActiveRequests,
    members,
    adminMembers,
    showToast,
    refreshInterestRequests,
  ]);

  const sendSupportMessage = useCallback((ticketId: string, text: string, sender: 'user' | 'admin') => {
    setSupportTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          const updated = {
            ...t,
            status: (sender === 'admin' ? 'in_progress' : 'open') as SupportTicket['status'],
            updatedAt: 'الآن',
            messages: [
              ...t.messages,
              {
                id: 'msg-' + Date.now() + Math.random().toString(36).substring(2, 6),
                sender,
                text,
                time: 'الآن',
              },
            ],
          };
          // مزامنة الرد مع جدول support_tickets الحقيقي
          pushTicketToServer(updated);
          return updated;
        }
        return t;
      })
    );
  }, []);

  const createSupportTicket = useCallback((
    subject: string,
    category: 'استفسار عام' | 'طلب ترقية' | 'مشكلة تقنية' | 'شكوى' | 'اقتراح',
    initialMessageText: string,
    userId?: string
  ) => {
    const newTicket: SupportTicket = {
      id: 't-' + Date.now(),
      userId: userId || user.memberId || 'm2',
      subject,
      category,
      status: 'open',
      priority: 'normal',
      updatedAt: 'الآن',
      messages: [
        {
          id: 'msg-' + Date.now(),
          sender: 'user',
          text: initialMessageText,
          time: 'الآن',
        },
      ],
    };
    setSupportTickets((prev) => [newTicket, ...prev]);
    // إنشاء التذكرة في جدول support_tickets الحقيقي واستبدال المعرف المؤقت بمعرف الخادم
    pushTicketToServer(newTicket).then((serverId) => {
      if (serverId) {
        setSupportTickets((prev) => prev.map((t) => (t.id === newTicket.id ? { ...t, id: serverId } : t)));
      }
    });
    return newTicket;
  }, [user.memberId]);

  return (
    <AppContext.Provider
      value={{
        user,
        login,
        loginWithSession,
        logout,
        registerNewMember,
        impersonateUser,
        importMembers,
        likedMembers,
        toggleLike,
        blockedMembers,
        toggleBlock,
        toasts,
        showToast,
        dismissToast,
        upgradePlan,
        plans,
        updatePlan,
        addPlan,
        deletePlan,
        paypalSettings,
        updatePaypalSettings,
        paymentSettings,
        updatePaymentSettings,
        socialSettings,
        updateSocialSettings,
        darkMode,
        toggleDarkMode,
        showDarkModeToggle,
        updateShowDarkModeToggle,
        usage,
        checkLimit,
        incrementUsage,
        buyMicrotransaction,
        boostProfile,
        isBoosted,
        resetUsage,
        interestPurchaseSettings,
        updateInterestPurchaseSettings,
        extraInterestsCount,
        setExtraInterestsCount,
        unlimitedInterestsUntil,
        setUnlimitedInterestsUntil,
        buyExtraInterests,
        messagePackages,
        updateMessagePackage,
        members: activeMembers,
        membersLoading: !isInitialized,
        membersError,
        retryLoadMembers,
        setMembers,
        adminMembers,
        setAdminMembers,
        interestRequests,
        adminUsers,
        addAdminUser,
        updateAdminUser,
        deleteAdminUser,
        currentAdminRole,
        currentAdminPermissions,
        currentAdminName,
        simulateAdminLogin,
        setInterestRequests,
        depositQuota,
        setDepositQuota,
        adminNotifications,
        setAdminNotifications,
        supportTickets,
        setSupportTickets,
        reports,
        submitReport,
        resolveReport,
        deleteReport,
        updateReport,
        addReportActionLog,
        adminDeleteMember,
        adminUpdateMemberStatus,
        adminDeleteMemberFromReports,
        adminUpdateMember,
        adminSendBulkBroadcast,
        adminUpdateInterestRequestStatus,
        adminUpdateInterestRequestDetails,
        adminCancelAndRefund,
        adminProcessExemptRequest,
        adminModeratePreExchangeMessage,
        exemptRequests,
        submitExemptRequest,
        payInterestRequestFee,
        payPreExchangeChatFee,
        sendPreExchangeChatMessage,
        flagPreExchangeNoMoney,
        choosePreExchangeOption,
        calculateCompat,
        calculateCompatDetailed,
        sendInterestRequest,
        sendSupportMessage,
        createSupportTicket,
        showCompatibility,
        compatibilityPaidOnly,
        updateCompatibilitySettings,
        profileData,
        updateProfileData,
        updateAccountInfo,
        allowProfileHiding,
        requireVerificationForRequests,
        enableWhoViewedMe,
        enableProfileBoosting,
        maxActiveRequests,
        pendingRequestsExpiryDays,
        updateFeatureSettings,
        isProfileHidden,
        toggleProfileHiding,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
