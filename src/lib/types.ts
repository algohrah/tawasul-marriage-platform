export interface AdminPermissions {
  manage_members: boolean;
  manage_requests: boolean;
  manage_support: boolean;
  manage_content: boolean;
  view_sensitive_data: boolean; // Can view email, phone, exact location
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'super_admin' | 'moderator';
  permissions: AdminPermissions;
  status: 'active' | 'suspended';
  createdAt: string;
  lastLogin?: string;
}

export type Gender = 'male' | 'female';

export interface Member {
  id: string;
  name: string;
  displayName: string;
  username?: string;
  age: number;
  gender: Gender;
  city: string;
  country: string;
  verified: boolean;
  premium: boolean;
  online: boolean;
  lastActive: string;
  workType: string;
  education: string;
  height: number;
  maritalStatus: 'never_married' | 'divorced' | 'widowed';
  hasChildren: boolean;
  religion: string;
  ethnicity: string;
  interests: string[];
  bio: string;
  aboutPartner: string;
  matchScore?: number;
  hasSeriousnessBadge?: boolean;
  plan?: 'free' | 'gold' | 'elite';
  pinned?: boolean;
  isManagedByAdmin?: boolean;
  managedByAdminId?: string;
  isProfileIncomplete?: boolean;
  status?: 'active' | 'suspended' | 'pending' | 'banned';
  email?: string;
  phone?: string;
  whatsapp?: string;
  nickname?: string;
  realName?: string;
  birthDate?: string;
  password?: string;
  marriageType?: string;
  marriageTypeLabel?: string;
  customLists?: string[];
  acceptForeigner?: string;
  nationality?: string;
  district?: string;
  sect?: string;
  tribe?: string;
  ethnicity?: string;
  weight?: number;
  skinColor?: string;
  health?: string;
  smoking?: string;
  jobTitle?: string;
  housing?: string;
  childrenCount?: string;
  childrenLiveWith?: string;
  wifeCount?: string;
  seekingWife?: string;
  acceptPolygamy?: string;
  acceptDivorced?: string;
  acceptWithChildren?: string;
  maritalLabel?: string;
  sourceType?: string;
  pCountry?: string;
  pCity?: string;
  pAgeMin?: number;
  pAgeMax?: number;
  pNationality?: string;
  pMaritalStatus?: string;
  pAcceptChildren?: string;
  pSect?: string;
  pEducation?: string;
  pWorkType?: string;
  pSkinColor?: string;
  pHousing?: string;
  pNotes?: string;
}

// الصورة الافتراضية حسب الجنس (صور محلية ثابتة — بدون صور شخصية)
export function getAvatar(gender: Gender): string {
  return gender === 'male' ? '/images/avatar-male.svg' : '/images/avatar-female.svg';
}

// صورة افتراضية للبطاقات (نفس الصورة)
export function getAvatarCard(gender: Gender): string {
  return getAvatar(gender);
}

// ألوان حسب الجنس
export function getGenderColors(gender: Gender) {
  return gender === 'male'
    ? {
        ring: 'ring-blue-500',
        bg: 'bg-blue-50',
        bgStrong: 'bg-blue-500',
        text: 'text-blue-600',
        textStrong: 'text-blue-700',
        border: 'border-blue-200',
        gradient: 'from-blue-600 to-blue-500',
        glow: 'shadow-blue-500/20',
        badgeBg: 'bg-blue-500',
      }
    : {
        ring: 'ring-rose-500',
        bg: 'bg-rose-50',
        bgStrong: 'bg-rose-500',
        text: 'text-rose-600',
        textStrong: 'text-rose-700',
        border: 'border-rose-200',
        gradient: 'from-rose-600 to-rose-500',
        glow: 'shadow-rose-500/20',
        badgeBg: 'bg-rose-500',
      };
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  color: 'gold' | 'navy' | 'rose' | string;
  messagesLimit?: number;
  requestsLimit?: number;
  searchLimit?: number;
  showContactLimit?: number;
  durationDays?: number;
  advancedFilters?: boolean;
  hidden?: boolean;
}

export interface MessagePackage {
  id: string;
  name: string;
  credits: number;
  price: number;
}

// ===== نظام التواصل مع الإدارة فقط =====
// لا يوجد رسائل بين الأعضاء — كل التواصل يتم عبر الإدارة
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportMessage {
  id: string;
  sender: 'user' | 'admin';
  text: string;
  time: string;
}

export interface SupportTicket {
  id: string;
  userId?: string; // العضو صاحب التذكرة
  subject: string;
  category: 'استفسار عام' | 'طلب ترقية' | 'مشكلة تقنية' | 'شكوى' | 'اقتراح';
  status: TicketStatus;
  priority: TicketPriority;
  messages: SupportMessage[];
  updatedAt: string;
  assignedTo?: string; // المسؤول المُحوّل إليه التذكرة
}

export interface Notification {
  id: string;
  type: 'request' | 'match' | 'system' | 'verification' | 'admin';
  text: string;
  time: string;
  read: boolean;
  memberId?: string;
}

export const SAUDI_CITIES = CITIES_BY_COUNTRY['السعودية'] || [];

export const INTERESTS = [
  'القراءة', 'السفر', 'الطبخ', 'الرياضة', 'الفنون',
  'الموسيقى', 'التقنية', 'التصوير', 'التطوع', 'الديكور',
  'الحدائق', 'الأفلام', 'الشعر', 'ركوب الخيل', 'السباحة',
];

export const EDUCATION_LEVELS = [
  'ثانوية عامة', 'دبلوم', 'بكالوريوس', 'ماجستير', 'دكتوراه',
];

export const JOB_TITLES = [
  'حكومي', 'قطاع خاص', 'أعمال حرة',
];

export const MARITAL_STATUS = {
  never_married: 'أعزب / آنسة',
  divorced: 'مطلق / مطلقة',
  widowed: 'أرمل / أرملة',
};

import { COUNTRIES, CITIES_BY_COUNTRY } from './constants';

export const ETHNICITIES = [
  'عربي', 'خليجي', 'شامي', 'مصري', 'مغاربي', 'أخرى',
];

export const RELIGIONS = [
  'مسلم سني', 'مسلم شيعي', 'مسيحي', 'أخرى',
];

// الدول العربية ودول الاغتراب
export const ARAB_COUNTRIES = COUNTRIES;
export const ARAB_CITIES = Array.from(new Set(Object.values(CITIES_BY_COUNTRY).flat()));

// المذاهب
export const SECTS = [
  'سني', 'شيعي', 'سلفي', 'أشعري', 'أخرى',
];

// عدد الأبناء
export const CHILDREN_COUNTS = ['لا يوجد', '1', '2', '3', '4', 'أكثر من 4'];

// خيارات التدخين
export const SMOKING_OPTIONS = ['لا أدخن', 'أدخن', 'سابقًا وتركت', 'شيشة فقط'];

// خيارات لون البشرة (12 خياراً متدرجاً)
export const SKIN_COLORS = [
  'أبيض ناصع',
  'أبيض',
  'أبيض مائل للقمحي',
  'قمحي فاتح',
  'قمحي',
  'قمحي غامق',
  'حنطي فاتح',
  'حنطي',
  'حنطي غامق',
  'أسمر فاتح',
  'أسمر',
  'أسمر داكن',
];

// خيارات الحالة الصحية
export const HEALTH_OPTIONS = ['ممتازة', 'جيدة', 'يوجد مرض مزمن'];

// خيارات نوع جهة العمل
export const WORK_TYPES = ['حكومي', 'قطاع خاص', 'عمل حر', 'باحث عن عمل', 'طالب', 'بدون عمل', 'أخرى'];

// خيارات نوع السكن
export const HOUSING_TYPES = ['أملك منزل', 'أستأجر', 'أسكن مع العائلة'];

// ===== الحالة الاجتماعية حسب الجنس =====
// خيارات الرجال
export const MARITAL_MALE = [
  { value: 'single', label: 'أعزب' },
  { value: 'divorced', label: 'مطلق' },
  { value: 'widower', label: 'أرمل' },
  { value: 'married', label: 'متزوج' },
];

// خيارات النساء
export const MARITAL_FEMALE = [
  { value: 'single', label: 'عزباء' },
  { value: 'divorced', label: 'مطلقة' },
  { value: 'widow', label: 'أرملة' },
  { value: 'married', label: 'متزوجة' },
];

// دالة مساعدة لجلب خيارات الحالة الاجتماعية حسب الجنس
export function getMaritalOptions(gender: 'male' | 'female') {
  return gender === 'male' ? MARITAL_MALE : MARITAL_FEMALE;
}

export function getMaritalStatusLabel(status: string): string {
  return MARITAL_STATUS[status as keyof typeof MARITAL_STATUS] || status;
}

export interface InterestPurchaseSettings {
  price: number;
  type: 'count' | 'duration';
  count: number;
  durationDays: number;
}

export type ReportCategory = 'spam' | 'harassment' | 'fake' | 'inappropriate' | 'other';
export type ReportSeverity = 'low' | 'medium' | 'high';

export interface ReportActionLog {
  id: string;
  action: string;
  adminNote?: string;
  timestamp: string;
  by: string;
}

export interface MemberReport {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedId: string;
  reportedName: string;
  reason: string;
  timestamp: string;
  status: 'pending' | 'resolved';
  category?: ReportCategory;
  severity?: ReportSeverity;
  adminNotes?: string;
  actionLog?: ReportActionLog[];
}

// ===== Central Adapter-Agnostic Database Types =====

export type MemberStatus = 'active' | 'pending' | 'suspended' | 'banned';

export interface AdminMemberRow {
  id: string;
  nickname: string;
  username?: string;
  gender: 'male' | 'female';
  age: number;
  country: string;
  city: string;
  verified: boolean;
  premium: boolean;
  realName: string;
  email: string;
  phone: string;
  nationalId: string;
  password: string;
  status: MemberStatus;
  plan: 'free' | 'gold' | 'elite';
  pinned?: boolean;
  joinedAt: string;
  requestsCount: number;
  district: string;
  education: string;
  workType: string;
  adminNote: string;
  flagged: boolean;
  statusReason: string;
  statusChangedAt: string;
  statusChangedBy: string;
  sourceType?: 'registered' | 'imported';
  importBatchId?: string;
  importOfficeName?: string;
  importDate?: string;
  importNotes?: string;
  isProfileIncomplete?: boolean;
  maritalStatus?: string;
  birthDate?: string;
  skinColor?: string;
  height?: number;
  weight?: number;
  bio?: string;
  nationality?: string;
  sect?: string;
  childrenCount?: string;
  ethnicity?: string;
  health?: string;
  smoking?: string;
  housing?: string;
  jobTitle?: string;
  pCountry?: string;
  pCity?: string;
  pNationality?: string;
  pSect?: string;
  pAgeMin?: number;
  pAgeMax?: number;
  pMaritalStatus?: string;
  pAcceptChildren?: string;
  pSkinColor?: string;
  pEducation?: string;
  pWorkType?: string;
  pHousing?: string;
  pNotes?: string;
}

export interface JourneyRequest {
  id: number;
  request_number?: number;
  requestNumber?: number;
  source_type?: 'registered' | 'imported';
  sourceType?: 'registered' | 'imported';
  sender_id: string;
  receiver_id: string;
  sender_nickname?: string;
  receiver_nickname?: string;
  sender_gender?: 'male' | 'female';
  receiver_gender?: 'male' | 'female';
  journey_stage: string;
  message: string;
  sender_paid: boolean;
  receiver_paid: boolean;
  sender_paid_at?: string | null;
  receiver_paid_at?: string | null;
  paid_at?: string | null;
  meeting_date?: string | null;
  meeting_notes?: string | null;
  decline_reason?: string | null;
  cancel_reason?: string | null;
  evaluation_result?: string | null;
  evaluation_note?: string | null;
  sender_viewing_result?: 'success' | 'failed' | null;
  receiver_viewing_result?: 'success' | 'failed' | null;
  sender_viewing_note?: string | null;
  receiver_viewing_note?: string | null;
  admin_notes?: string | null;
  contact_info?: string | null;
  contact_by?: string | null;
  guardian_phone?: string | null;
  guardian_name?: string | null;
  guardian_relation?: string | null;
  contact_time?: string | null;
  contact_note?: string | null;
  male_pledged?: boolean;
  female_pledged?: boolean;
  male_phone?: string | null;
  male_name?: string | null;
  male_relation?: string | null;
  male_contact_time?: string | null;
  male_contact_note?: string | null;
  defer_date?: string | null;
  defer_by?: string | null;
  deadline_date?: string | null;
  frozen?: boolean;
  frozen_reason?: string | null;
  frozen_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestEvent {
  id: number;
  request_id: number;
  actor_id: string;
  type: string;
  note: string;
  created_at: string;
}

export interface InquiryMessage {
  id: number;
  request_id: number;
  sender_id: string; // 'admin' = الوسيطة
  text: string;
  charged_to: string | null;
  created_at: string;
  approved?: boolean;
  rejected?: boolean;
  moderated_by?: string | null;
  moderated_at?: string | null;
}

export interface InquiryPackage {
  id: number;
  request_id: number;
  owner_id: string;
  credits_total: number;
  credits_used: number;
  price: number;
  active: boolean;
  created_at: string;
}

export interface JourneyNotification {
  id: number;
  user_id: string;
  request_id: number;
  type: string;
  text: string;
  title?: string;
  read: boolean;
  created_at: string;
}

export interface InquiryState {
  package: InquiryPackage | null;
  remaining: number;
  messages: InquiryMessage[];
  inquiry_started_by?: string | null;
}

export interface RequestPaymentsSummary {
  requestId: number;
  sender_paid: boolean;
  receiver_paid: boolean;
  sender_paid_at?: string;
  receiver_paid_at?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount: number;
  type: 'percent' | 'fixed';
  usageLimit: number;
  expiryDate: string;
  active: boolean;
  usedCount?: number;
  usageCount?: number;
  createdAt?: string;
  createdBy?: string;
}

export interface Transaction {
  id: string;
  memberId: string;
  memberName?: string;
  amount: number;
  type: 'subscription' | 'inquiry' | 'deposit' | 'exemption';
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  createdAt: string;
  description?: string;
  method?: string;
  date?: string;
  couponCode?: string;
}

export interface AdminStats {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  suspendedMembers: number;
  bannedMembers: number;
  totalRequests: number;
  completedRequests: number;
  declinedRequests: number;
  cancelledRequests: number;
  seriousRequests: number;
  maleCount: number;
  femaleCount: number;
  males: number;
  females: number;
  pendingRequests: number;
  activeJourneys: number;
  completed: number;
  verified: number;
  premium: number;
  revenue: number;
  depositsPaid: number;
  seriousnessBadges: number;
  totalTransactions: number;
  totalRevenue: number;
  stageBreakdown: Record<string, number>;
  recentEvents: any[];
}

export function translitArabicToEnglish(text: string): string {
  if (!text) return '';
  const charMap: Record<string, string> = {
    'أ': 'a', 'إ': 'a', 'آ': 'a', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'y', 'ء': 'a', 'ؤ': 'w',
    'ة': 'h', ' ': '_'
  };
  return text
    .split('')
    .map((c) => charMap[c] || (/[a-zA-Z0-9_]/.test(c) ? c.toLowerCase() : ''))
    .join('')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
}



