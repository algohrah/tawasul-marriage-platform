import type { Plan, Notification, SupportTicket, MessagePackage } from './types';
import { MEMBERS, getMemberById } from './members';

// إعادة تصدير الأعضاء والدوال للتوافق مع باقي الصفحات
export { MEMBERS, getMemberById };
export type { Member } from './members';

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'الباقة المجانية',
    price: 0,
    period: 'للأبد',
    description: 'ابدأ رحلتك واكتشف المنصة واهتماماتك الأساسية',
    features: [
      'تصفّح الملفات الشخصية للأعضاء',
      'إرسال حتى 3 طلبات اهتمام يومياً كحد أقصى',
      'استقبال ردود الإدارة والوسيطة مجانًا',
      'البحث الأساسي السريع',
    ],
    color: 'navy',
    messagesLimit: 0, // No free inquiry messages included
    requestsLimit: 3, // 3 interest requests/day
    searchLimit: 2,
    showContactLimit: 0,
    durationDays: 30,
    advancedFilters: false,
  },
  {
    id: 'gold',
    name: 'الباقة الذهبية',
    price: 100,
    period: 'شهريًا',
    description: 'التجربة المثالية مع تاج ذهبي وأولوية تواصل عالية',
    features: [
      'إرسال حتى 10 طلبات اهتمام يومياً لتسريع المطابقة',
      'رصيد 5 رسائل استفسار مجانية إضافية في غرفة التوافق',
      'شارة التاج الذهبي المميز على ملفك الشخصي',
      'أولوية تواصل وتنسيق من الإدارة والوسيطة',
      'إمكانية شراء باقات رسائل إضافية عند الحاجة',
    ],
    popular: true,
    color: 'gold',
    messagesLimit: 5, // 5 free messages in inquiry balance
    requestsLimit: 10, // 10 interest requests/day
    searchLimit: 15,
    showContactLimit: 5,
    durationDays: 30,
    advancedFilters: true,
  },
  {
    id: 'elite',
    name: 'الباقة المميرة',
    price: 200,
    period: 'شهريًا',
    description: 'أرقى ميزات المنصة مع شارة نجمة مميز وظهور أول بالبحث',
    features: [
      'إرسال حتى 20 طلب اهتمام يومياً لتوافق فوري وجاد',
      'رصيد 10 رسائل استفسار مجانية إضافية في غرفة التوافق',
      'شارة نجمة مميز لزيادة الثقة والجدية',
      'أولوية الظهور كملف أول في نتائج البحث',
      'ميزة البحث المتقدم بكافة الفلاتر المتاحة',
      'دعم وتنسيق مباشر على مدار الساعة',
    ],
    color: 'rose',
    messagesLimit: 10, // 10 free messages in inquiry balance
    requestsLimit: 20, // 20 interest requests/day
    searchLimit: 999,
    showContactLimit: 20,
    durationDays: 30,
    advancedFilters: true,
  },
];

export const DEFAULT_MESSAGE_PACKAGES: MessagePackage[] = [
  { id: 'small', name: 'الباقة الصغرى (٤ رسائل)', credits: 4, price: 29 },
  { id: 'medium', name: 'الباقة المتوسطة (١٠ رسائل)', credits: 10, price: 50 },
  { id: 'large', name: 'الباقة الكبرى (٢٥ رسالة)', credits: 25, price: 100 },
];

// ===== تذاكر الدعم (التواصل مع الإدارة) =====
export const SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: 't1',
    subject: 'استفسار عن باقة النخبة',
    category: 'طلب ترقية',
    status: 'resolved',
    priority: 'normal',
    updatedAt: 'قبل ساعتين',
    messages: [
      { id: '1', sender: 'user', text: 'السلام عليكم، أود الاستفسار عن مزايا باقة النخبة بالتفصيل', time: '10:00 ص' },
      { id: '2', sender: 'admin', text: 'وعليكم السلام، أهلًا بك. باقة النخبة تشمل مستشار علاقات شخصي، ترقية الملف، فلاتر حصرية، وتنسيق مباشر من فريقنا. هل ترغب بالترقية الآن؟', time: '10:15 ص' },
      { id: '3', sender: 'user', text: 'شكرًا لكم على الشرح الوافي 🌹', time: '10:20 ص' },
    ],
  },
  {
    id: 't2',
    subject: 'تعديل بيانات الملف الشخصي',
    category: 'استفسار عام',
    status: 'in_progress',
    priority: 'low',
    updatedAt: 'أمس',
    messages: [
      { id: '1', sender: 'user', text: 'أحتاج تعديل مدينتي في الملف الشخصي', time: 'أمس 2:00 م' },
      { id: '2', sender: 'admin', text: 'أهلًا بك، يمكنك تعديل مدينتك من صفحة «حسابي» ثم «تعديل الملف الشخصي». هل تحتاج مساعدة إضافية؟', time: 'أمس 2:30 م' },
    ],
  },
];

export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'match', text: 'تم إيجاد 3 ملفات جديدة متوافقة معك', time: 'قبل 5 دقائق', read: false },
  { id: 'n2', type: 'request', text: 'تم قبول طلب الاهتمام الخاص بك من الإدارة', time: 'قبل 20 دقيقة', read: false },
  { id: 'n3', type: 'admin', text: 'رسالة جديدة من فريق الدعم حول تذكرتك', time: 'قبل ساعة', read: false },
  { id: 'n4', type: 'verification', text: 'تهانينا! تم توثيق حسابك بنجاح ✓', time: 'قبل 3 ساعات', read: true },
  { id: 'n5', type: 'system', text: 'تم تحديث سياسة الخصوصية، يرجى الاطلاع', time: 'منذ يومين', read: true },
];

export const TESTIMONIALS = [
  {
    name: 'أحمد و سارة',
    city: 'الرياض',
    story: 'التقينا عبر توافق قبل عام، وكانت أفضل قرار اتخذته. نظام الوساطة المهنية أعطاني ثقة كبيرة. شكراً لكم.',
    duration: 'متزوجان منذ 8 أشهر',
  },
  {
    name: 'محمد و فاطمة',
    city: 'جدة',
    story: 'كنت متردداً في البداية، لكن النظام الموثوق والتحقق من الحسابات طمأنني. اليوم أنا أسعد رجل.',
    duration: 'متزوجان منذ سنة',
  },
  {
    name: 'عبدالرحمن و ريم',
    city: 'الدمام',
    story: 'البحث المتقدم ساعدني في العثور على شريكة تشاركني القيم والاهتمامات. تجربة استثنائية وراقية.',
    duration: 'متزوجان منذ 6 أشهر',
  },
];

export const STATS = [
  { label: 'عضو موثّق', value: '+150 ألف' },
  { label: 'قصة زواج ناجح', value: '+12 ألف' },
  { label: 'زيارات يومية', value: '+25 ألف' },
  { label: 'دعم على مدار الساعة', value: '24/7' },
];

export const TEAM = [
  { name: 'د. منى السالم', role: 'مستشار العلاقات', gender: 'female' as const },
  { name: 'أ. خالد المنصور', role: 'مدير المنتج', gender: 'male' as const },
  { name: 'د. سعاد الحربي', role: 'مستشار أسري', gender: 'female' as const },
];

export function getMemberByIdLocal(id: string) {
  return MEMBERS.find((m) => m.id === id);
}

export function getNotificationMember(notif: Notification) {
  return notif.memberId ? getMemberById(notif.memberId) : undefined;
}

// طلبات الاهتمام (تُرسل عبر الإدارة)
// ===== حالات الطلب الموسّعة (7 مراحل) =====
export type RequestStatus =
  | 'pending'                    // ⏱️ الطلب مرسل، في انتظار رد الطرف الآخر
  | 'accepted_pending_admin'     // ⏳ تم القبول من الطرف الآخر، بانتظار موافقة الإدارة والتحقق
  | 'accepted_pending_payment'   // 💳 تم القبول والموافقة، بانتظار سداد رسوم تأكيد الجدية من الطرفين
  | 'paid'                       // ✅ تم السداد من الطرفين، الطلب جاهز للوساطة
  | 'in_mediation'               // 🤝 الوساطة جارية
  | 'completed'                  // 🎉 تم اللقاء/الاتصال
  | 'declined'                   // ❌ تم الرفض من الطرف الآخر
  | 'cancelled';                 // ⬜ تم الإلغاء لعدم السداد أو لعدم التوافق

// ===== مراحل الوساطة الأربعة =====
export type MediationStage =
  | 'scheduling'     // تنسيق موعد
  | 'confirming'     // تأكيد الموعد
  | 'exchanging'     // إرسال الأرقام للتواصل
  | 'evaluating';    // تقييم النتيجة

export interface PreExchangeMessage {
  senderId: string;
  text: string;
  time: string;
}

export interface InterestRequest {
  id: string;
  requestNumber?: number;         // الرقم التسلسلي بحسب الفئة (مسجلين / مستوردين)
  sourceType?: 'registered' | 'imported'; // نوع المصدر
  senderId: string;    // من مرسل الطلب
  receiverId: string;  // من مستلم الطلب
  status: RequestStatus;
  message: string;
  time: string;
  adminNotes?: string;   // ملاحظات خاصة بالإدارة
  meetingDate?: string;  // موعد التواصل الشرعي أو التنسيقي
  meetingNotes?: string; // إرشادات وملاحظات موعد اللقاء أو الاتصال
  declineReason?: string; // سبب الرفض
  paymentStatus?: 'waiting_for_payment' | 'paid'; // حالة سداد رسوم الجدية (500 ريال)
  senderPaid?: boolean;           // هل دفع مرسل الطلب رسوم الجدية
  receiverPaid?: boolean;         // هل دفع مستقبل الطلب رسوم الجدية
  senderPaidAmount?: number;      // المبلغ المدفوع من المرسل
  receiverPaidAmount?: number;    // المبلغ المدفوع من المستقبل
  senderPaidAt?: string;          // وقت سداد المرسل
  receiverPaidAt?: string;        // وقت سداد المستقبل
  // ===== حقول النظام الموسّع =====
  paymentDeadline?: string;       // موعد انتهاء فترة السداد (30 يوم)
  paidAt?: string;                // تاريخ السداد الفعلي
  mediationStage?: MediationStage; // المرحلة الحالية للوساطة
  evaluationResult?: 'success' | 'failed' | null; // نتيجة التقييم بعد اللقاء
  evaluationNote?: string;        // ملاحظة التقييم
  cancelReason?: string;          // سبب الإلغاء
  refundPercentage?: number;      // نسبة الاسترداد (50% قبل اللقاء، 0% بعد اللقاء)
  attemptsCount?: number;         // عدد محاولات التواصل المتبقية قبل طلب رسوم جدية جديدة
  supportTicketId?: string;       // رقم تذكرة الدعم المرتبطة
  createdAt?: number;             // طابع زمني للإنشاء
  // ===== حقول الاستفسار المبكر والشات الثنائي =====
  preExchangeChoice?: 'chat' | 'direct_deposit' | null;
  senderChatUnlocked?: boolean;
  receiverChatUnlocked?: boolean;
  senderChatCredits?: number;
  receiverChatCredits?: number;
  senderNoMoney?: boolean;
  receiverNoMoney?: boolean;
  chatMessages?: PreExchangeMessage[];
  senderExemptionStatus?: 'pending' | 'approved' | 'rejected' | null;
  receiverExemptionStatus?: 'pending' | 'approved' | 'rejected' | null;
  senderExemptionReason?: string;
  receiverExemptionReason?: string;
  senderExempted?: boolean;
  receiverExempted?: boolean;
}

// ===== إعدادات رسوم السعي والتنسيق =====
export const FEE_CONFIG = {
  depositAmount: 500,           // رسوم الجدية المبدئية
  finalFeeAmount: 2000,         // رسوم السعي النهائية بعد الملكة
  paymentDeadlineDays: 15,      // مدة سداد رسوم الجدية (15 يوم)
  freeAttemptsAfterDeposit: 5,  // متاح للتواصل مع حتى 5 أعضاء برسوم الجدية الواحدة
  retryAfterAttempts: 5,        // الحد الأقصى للأعضاء برسوم الجدية الواحدة هو 5 أعضاء
  refundBeforeMeeting: 0,       // المبالغ غير قابلة للاسترداد نهائياً لضمان الجدية والمصداقية
  refundAfterMeeting: 0,        // المبالغ غير قابلة للاسترداد نهائياً لضمان الجدية والمصداقية
  newRequestCooldownDays: 30,   // فترة الانتظار قبل فتح طلب جديد لنفس الشخص
};

export const INTEREST_REQUESTS: InterestRequest[] = [
  { 
    id: 'ir1', 
    senderId: 'm3',      // القحطاني رسل لسارة
    receiverId: 'm2',    // سارة (المدير / الحساب التجريبي)
    status: 'pending', 
    message: 'السلام عليكم ورحمة الله، لفت نظري في ملف حضرتك التوافق الكبير في الأهداف والقيم وأتمنى التوفيق لنا.', 
    time: 'قبل ساعة',
    adminNotes: 'الطلب جاد جداً، تم التواصل مع القحطاني وأكد رغبته.',
    createdAt: Date.now() - 3600000,
  },
  { 
    id: 'ir2', 
    senderId: 'm5',      // العتيبي رسل لسارة
    receiverId: 'm2',    // سارة
    status: 'pending', 
    message: 'أرغب بالارتباط بصاحبة الملف لتوافق المواصفات المطلوبة، والمدن متقاربة جداً.', 
    time: 'قبل 3 ساعات',
    createdAt: Date.now() - 10800000,
  },
  { 
    id: 'ir3', 
    senderId: 'm1',      // أبو عبدالله رسل لسارة
    receiverId: 'm2',    // سارة
    status: 'pending', 
    message: 'يسرني التقدم بطلب اهتمام ومستعد للتنسيق مع الإدارة والوسيطة للاستفسار عن بقية التفاصيل.', 
    time: 'أمس',
    createdAt: Date.now() - 86400000,
  },
  { 
    id: 'ir4', 
    senderId: 'm2',      // سارة رسلت للقحطاني
    receiverId: 'm3', 
    status: 'accepted_pending_payment', 
    message: 'لدي رغبة بالارتباط تماشياً مع المواصفات المشتركة وطبيعة العمل المستقبلي.', 
    time: 'منذ يومين',
    paymentStatus: 'waiting_for_payment',
    paymentDeadline: 'باقي 28 يوم للسداد',
    attemptsCount: 4,
    createdAt: Date.now() - 172800000,
  },
  { 
    id: 'ir5', 
    senderId: 'm2',      // سارة رسلت للعتيبي
    receiverId: 'm5', 
    status: 'pending', 
    message: 'طلب اهتمام مبدئي للاستفسار عن السكن المستقبلي والخدمة العسكرية.', 
    time: 'منذ 3 أيام',
    createdAt: Date.now() - 259200000,
  },
  { 
    id: 'ir6', 
    senderId: 'm2',      // سارة رسلت لأبو عبدالله
    receiverId: 'm1', 
    status: 'declined', 
    message: 'طلب اهتمام للاطلاع على التوافق الديني والاجتماعي.', 
    time: 'منذ أسبوع',
    declineReason: 'عدم توافق في المواصفات الأساسية المطلوبة.',
    createdAt: Date.now() - 604800000,
  },
  { 
    id: 'ir7', 
    senderId: 'm6',      // أم عبدالرحمن رسلت لأبو عبدالله
    receiverId: 'm1', 
    status: 'pending', 
    message: 'السلام عليكم، لفت انتباهي التوافق العلمي والديني في ملفكم وأتمنى التوفيق.', 
    time: 'قبل 30 دقيقة',
    createdAt: Date.now() - 1800000,
  },
  { 
    id: 'ir8', 
    senderId: 'm7',      // أبو فيصل رسلت لأم محمد
    receiverId: 'm4', 
    status: 'paid', 
    message: 'أبحث عن أم حنونة لأبنائي وشريكة حياة، أرى توافقاً في القيم.', 
    time: 'منذ يوم',
    paymentStatus: 'paid',
    paidAt: 'قبل 12 ساعة',
    mediationStage: 'scheduling',
    attemptsCount: 3,
    createdAt: Date.now() - 86400000,
  },
  { 
    id: 'ir9', 
    senderId: 'm4',      // أم محمد رسلت للعتيبي
    receiverId: 'm5', 
    status: 'declined', 
    message: 'طلب اهتمام لمعرفة التفاصيل أكثر.', 
    time: 'منذ 4 أيام',
    declineReason: 'المسافة بين المدن كبيرة والظروف لا تسمح بالتنقل حالياً.',
    createdAt: Date.now() - 345600000,
  },
  { 
    id: 'ir10', 
    senderId: 'm8',      // بنت الخليج رسلت للقحطاني
    receiverId: 'm3', 
    status: 'in_mediation', 
    message: 'أرغب بالتوافق الجاد للزواج، مواصفاتكم تناسبني.', 
    time: 'قبل ساعتين',
    paymentStatus: 'paid',
    paidAt: 'قبل 3 أيام',
    mediationStage: 'exchanging',
    meetingDate: '2026-06-28 في الساعة 7 مساءً',
    meetingNotes: 'تبادل أرقام الهواتف للتواصل المباشر بين الأسرتين بإشراف الوسيطة',
    attemptsCount: 2,
    createdAt: Date.now() - 7200000,
  },
  { 
    id: 'ir11', 
    senderId: 'm1',      // أبو عبدالله رسلت لأم عبدالرحمن
    receiverId: 'm6', 
    status: 'completed', 
    message: 'أرى توافقاً كبيراً في الأهداف والقيم، وأتطلع لمعرفة المزيد.', 
    time: 'منذ أسبوعين',
    paymentStatus: 'paid',
    paidAt: 'منذ 12 يوم',
    mediationStage: 'evaluating',
    evaluationResult: 'success',
    evaluationNote: 'تم اللقاء بنجاح وحصلت الموافقة المبدئية من الطرفين، جاري التنسيق للملكة.',
    attemptsCount: 1,
    createdAt: Date.now() - 1209600000,
  },
];
