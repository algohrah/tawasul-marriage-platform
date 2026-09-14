import type { Plan } from './types';
import { MEMBERS } from './members';
import type { Member } from './members';

// ====================================================================
//  متجر بيانات لوحة الإدارة — قابل للتعديل ديناميكيًا
// ====================================================================

export interface AdminMember extends Member {
  realName: string;
  email: string;
  phone: string;
  password: string;
  status: 'active' | 'suspended' | 'pending' | 'banned';
  plan: 'free' | 'gold' | 'elite';
  joinedAt: string;
  requestsCount: number;
  statusReason?: string;
  whatsapp?: string;
}

export interface RegistrationField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'textarea' | 'radio' | 'checkbox' | 'conditional';
  required: boolean;
  enabled: boolean;
  options?: string[];
  group: 'basic' | 'personal' | 'partner' | 'contact';
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  logoText: string;
  primaryColor: string;
  email: string;
  phone: string;
  maintenanceMode: boolean;
  allowRegistration: boolean;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  audience: 'all' | 'verified' | 'premium' | 'specific';
  sentAt: string;
  recipients: number;
}

// ===== أعضاء مع بيانات حساسة (للإدارة فقط) =====
export const ADMIN_MEMBERS: AdminMember[] = MEMBERS.map((m, i) => ({
  ...m,
  realName: m.realName || ['عبدالله محمد السالم', 'سارة أحمد القحطاني', 'فهد ناصر الدوسري', 'نورة سعيد العتيبي', 'ماجد خالد الحربي', 'ريم عبدالله الشهري', 'سلطان علي القرني', 'لطيفة محمد الأحمدي'][i] || 'اسم حقيقي',
  email: m.email || [`abdullah@email.com`, `sara@email.com`, `fahad@email.com`, `noura@email.com`, `majed@email.com`, `reem@email.com`, `sultan@email.com`, `latifa@email.com`][i] || 'member@email.com',
  phone: m.phone || [`+966501234501`, `+966501234502`, `+966501234503`, `+966501234504`, `+966501234505`, `+966501234506`, `+966501234507`, `+966501234508`][i] || '+966500000000',
  password: m.password || ['Pass@1234', 'Sara@2024', 'Fahad@2024', 'Noura@2024', 'Majed@2024', 'Reem@2024', 'Sultan@2024', 'Latifa@2024'][i] || 'Pass@1234',
  status: m.status || (i === 7 ? 'pending' : 'active'),
  plan: m.plan || (m.premium ? (i % 3 === 0 ? 'elite' : 'gold') : 'free'),
  joinedAt: m.joinedAt || ['15 يناير 2025', '10 يناير 2025', '5 يناير 2025', '28 ديسمبر 2024', '20 ديسمبر 2024', '15 ديسمبر 2024', '10 ديسمبر 2024', '5 ديسمبر 2024'][i] || 'يناير 2025',
  requestsCount: m.requestsCount ?? ([3, 5, 2, 7, 1, 4, 0, 6][i] || 0),
}));

// ===== حقول التسجيل القابلة للتعديل =====
export const REGISTRATION_FIELDS: RegistrationField[] = [
  { id: 'f1', label: 'الاسم المستعار', type: 'text', required: true, enabled: true, group: 'basic' },
  { id: 'f2', label: 'الجنس', type: 'radio', required: true, enabled: true, options: ['ذكر', 'أنثى'], group: 'basic' },
  { id: 'f3', label: 'العمر', type: 'number', required: true, enabled: true, group: 'basic' },
  { id: 'f4', label: 'الدولة', type: 'select', required: true, enabled: true, options: ['السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان', 'مصر', 'الأردن'], group: 'basic' },
  { id: 'f5', label: 'المدينة', type: 'select', required: true, enabled: true, options: ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الطائف', 'بريدة', 'تبوك', 'أبها', 'دبي', 'أبو ظبي', 'الكويت', 'الدوحة'], group: 'basic' },
  { id: 'f6', label: 'المنطقة / الحي', type: 'text', required: false, enabled: true, group: 'basic' },
  { id: 'f7', label: 'الطول', type: 'number', required: true, enabled: true, group: 'personal' },
  { id: 'f8', label: 'الوزن', type: 'number', required: false, enabled: true, group: 'personal' },
  { id: 'f9', label: 'لون البشرة', type: 'select', required: false, enabled: true, options: ['أبيض', 'حنطي', 'أسمر'], group: 'personal' },
  { id: 'f10', label: 'المؤهل العلمي', type: 'select', required: true, enabled: true, options: ['ثانوية عامة', 'دبلوم', 'بكالوريوس', 'ماجستير', 'دكتوراه'], group: 'personal' },
  { id: 'f11', label: 'نوع العمل', type: 'conditional', required: true, enabled: true, options: ['حكومي', 'قطاع خاص', 'أعمال حرة', 'عمل خاص'], group: 'personal' },
  { id: 'f12', label: 'الحالة الاجتماعية', type: 'select', required: true, enabled: true, options: ['أعزب / آنسة', 'مطلق / مطلقة', 'أرمل / أرملة'], group: 'personal' },
  { id: 'f13', label: 'نبذة عني', type: 'textarea', required: false, enabled: true, group: 'personal' },
  { id: 'f14', label: 'وصف الشريك المطلوب', type: 'textarea', required: false, enabled: true, group: 'partner' },
];

// ===== إعدادات الموقع =====
export const SITE_SETTINGS: SiteSettings = {
  siteName: 'توافق',
  tagline: 'منصة الزواج العربية الموثوقة',
  logoText: 'توافق',
  primaryColor: '#C9A961',
  email: 'support@tawafuq.sa',
  phone: '+966 11 234 5678',
  maintenanceMode: false,
  allowRegistration: true,
};

// ===== إشعارات الإدارة المُرسلة =====
export const ADMIN_NOTIFICATIONS: AdminNotification[] = [];

// ===== إحصائيات لوحة المعلومات =====
export const DASHBOARD_STATS = [
  { label: 'إجمالي الأعضاء', value: '154,320', change: '+12.5%', trend: 'up' as const, icon: 'users' },
  { label: 'أعضاء جدد (هذا الشهر)', value: '8,240', change: '+23.1%', trend: 'up' as const, icon: 'user-plus' },
  { label: 'طلبات اهتمام', value: '3,120', change: '+8.7%', trend: 'up' as const, icon: 'heart' },
  { label: 'الإيرادات الشهرية', value: '284,500 ر.س', change: '+15.3%', trend: 'up' as const, icon: 'dollar' },
  { label: 'أعضاء موثقون', value: '98,450', change: '+5.2%', trend: 'up' as const, icon: 'shield' },
  { label: 'تذاكر دعم مفتوحة', value: '42', change: '-18.0%', trend: 'down' as const, icon: 'ticket' },
];

export const RECENT_ACTIVITY = [
  { type: 'member', text: 'عضو جديد: «أم محمد» انضم إلى المنصة', time: 'قبل 5 دقائق', icon: 'user-plus' },
  { type: 'request', text: 'طلب اهتمام جديد من «أبو عبدالله»', time: 'قبل 12 دقيقة', icon: 'heart' },
  { type: 'payment', text: 'دفعة جديدة: 99 ر.س من «العتيبي» - باقة ذهبية', time: 'قبل 25 دقيقة', icon: 'dollar' },
  { type: 'verification', text: 'طلب توثيق جديد من «بنت الخليج»', time: 'قبل ساعة', icon: 'shield' },
  { type: 'ticket', text: 'تذكرة دعم جديدة: «مشكلة في البحث»', time: 'قبل ساعتين', icon: 'ticket' },
  { type: 'member', text: 'عضو جديد: «القحطاني» انضم إلى المنصة', time: 'قبل 3 ساعات', icon: 'user-plus' },
];
