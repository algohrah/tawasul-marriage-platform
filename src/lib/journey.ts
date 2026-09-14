// ============================================================
//  رحلة طلب الاهتمام — نظام موحّد (Single Source of Truth)
//  يستبدل: RequestStatus + MediationStage + coordinationStep
//  مقياس واحد للتقدّم = journeyStage
// ============================================================

import {
  Send, HeartHandshake, ShieldCheck, CalendarClock,
  Users, PartyPopper, XCircle, Ban, Eye, Gem, type LucideIcon,
} from 'lucide-react';

// ===== مراحل الرحلة (المسار الرئيسي) =====
export type JourneyStage =
  | 'sent'           // ① مُرسَل — وصل الطلب للطرف الآخر بانتظار رده
  | 'accepted'       // ② مقبول — (استفسار اختياري + رسوم الجدية في صفحة واحدة)
  | 'seriousness'    // ③ تأكيد الجدية — سداد رسوم الجدية من الطرفين
  | 'coordination'   // ④ تبادل التواصل — الإدارة تنسّق وتبادل القنوات
  | 'sharia_viewing' // ⑤ النظرة الشرعية — اللقاء الشرعي بإشراف الوسيطة
  | 'engagement'     // ⑥ الملكة — إتمام العقد ورسوم السعي النهائية
  | 'completed';     // ⑦ مكتمل — النتيجة النهائية

// ===== المساران الجانبيان =====
export type JourneyTerminal = 'declined' | 'cancelled';

export type JourneyState = JourneyStage | JourneyTerminal;

// ===== ترتيب المراحل الرئيسية =====
export const JOURNEY_STAGES: JourneyStage[] = [
  'sent', 'accepted', 'seriousness', 'coordination', 'sharia_viewing', 'engagement', 'completed',
];

export const STAGE_INDEX: Record<JourneyStage, number> = {
  sent: 0, accepted: 1, seriousness: 2, coordination: 3, sharia_viewing: 4, engagement: 5, completed: 6,
};

// ===== تعريف كل مرحلة (عنوان + وصف + أيقونة + لون + إجراء + شرح منبثق) =====
export interface StageMeta {
  key: JourneyState;
  step: number;            // رقم الخطوة (1..6) أو -1 للمسارات الجانبية
  title: string;           // العنوان المختصر للـ Stepper
  badge: string;           // نص الشارة
  icon: LucideIcon;
  accent: string;          // لون مميّز (tailwind text/bg base)
  // محتوى البطاقة المنبثقة:
  whereYouAre: string;     // أين أنت الآن
  whatToDo: string;        // ماذا تفعل الآن
  whatsNext: string;       // ما المرحلة التالية
}

export const STAGE_META: Record<JourneyState, StageMeta> = {
  sent: {
    key: 'sent', step: 1, title: 'بانتظار القبول', badge: 'بانتظار الرد',
    icon: Send, accent: 'gold',
    whereYouAre: 'تم إرسال طلبك بنجاح! الطرف الآخر يستلم إشعاراً الآن وبانتظار قبوله.',
    whatToDo: 'لا تحتاج لفعل أي شيء حالياً — سنُخطرك فوراً عندما يقرر الطرف الآخر الرد.',
    whatsNext: 'إذا وافق الطرف الآخر، ينتقل الطلب مباشرة إلى مرحلة تأكيد الجدية والقبول.',
  },
  accepted: {
    key: 'accepted', step: 2, title: 'تم القبول 🎉', badge: 'خطوتك التالية',
    icon: HeartHandshake, accent: 'emerald',
    whereYouAre: 'مبارك! الطرف الآخر قبِل طلبك. الخطوة التالية: تأكيد جدية الطرفين.',
    whatToDo: 'اختر: سداد رسوم تأكيد الجدية مباشرة، أو الاستفسار أولاً عبر غرفة المحادثة.',
    whatsNext: 'بعد سداد الطرفين، يتم تبادل أرقام التواصل للتنسيق المباشر.',
  },
  seriousness: {
    key: 'seriousness', step: 3, title: 'تأكيد الجدية', badge: 'رسوم التأكيد',
    icon: ShieldCheck, accent: 'amber',
    whereYouAre: 'لتأكيد جدية الطرفين، يُطلب من كل طرف سداد ٥٠٠ ريال (تُسترد عند عدم التوافق بعد النظرة الشرعية).',
    whatToDo: 'أكمل سداد الرسوم للحصول على وسام الجدية الدائم والانتقال لتبادل أرقام التواصل.',
    whatsNext: 'بمجرد سداد الطرفين، تبدأ مرحلة تبادل أرقام التواصل مباشرة.',
  },
  coordination: {
    key: 'coordination', step: 4, title: 'تبادل أرقام التواصل', badge: 'مشاركة الأرقام',
    icon: CalendarClock, accent: 'blue',
    whereYouAre: 'آن الآوان لتبادل أرقام التواصل! الباحثة عن الستر تُدخل رقم ولي أمرها، والباحث عن الستر يطّلع عليه بعد التعهد بالحفاظ على الخصوصية.',
    whatToDo: 'أدخل بيانات التواصل (رقم ولي الأمر للباحثة عن الستر / رقمك للباحث عن الستر) للتنسيق المباشر للنظرة الشرعية.',
    whatsNext: 'بعد اكتمال تبادل الأرقام والتعهدات، تنتقل لمرحلة النظرة الشرعية.',
  },
  sharia_viewing: {
    key: 'sharia_viewing', step: 5, title: 'النظرة الشرعية', badge: 'اللقاء الأول',
    icon: Eye, accent: 'indigo',
    whereYouAre: 'مرحلة اللقاء الشرعي بين العائلتين بحضور المحرم. تواصلوا لترتيب الموعد المناسب.',
    whatToDo: 'نسّقوا موعد اللقاء، ثم بعد المقابلة سجّل كل طرف نتيجته بأمانة: توافق للمضي قدماً، أو اعتذار لطيف.',
    whatsNext: 'عند توافق الطرفين، تنتقل لمرحلة الملكة (عقد القران).',
  },
  engagement: {
    key: 'engagement', step: 6, title: 'الملكة 💍', badge: 'عقد القران',
    icon: Gem, accent: 'gold',
    whereYouAre: 'مبارك التوافق! آن أوان إتمام عقد القران وسداد رسوم السعي النهائية (٢٠٠٠ ريال).',
    whatToDo: 'أكمل إجراءات عقد القران رسمياً، ثم سدّد رسوم السعي لإتمام التوثيق في المنصة.',
    whatsNext: 'بعد إتمام الملكة والسداد، تكتمل الرحلة ويُحدَّث وضعكما كمتزوجين.',
  },
  completed: {
    key: 'completed', step: 7, title: 'مكتمل ✅', badge: 'اكتملت الرحلة',
    icon: PartyPopper, accent: 'emerald',
    whereYouAre: 'اكتملت رحلة التوافق للزواج بنجاح! نسأل الله لكما حياة سعيدة مباركة.',
    whatToDo: 'الرحلة مكتملة. بارك الله لكما وبارك عليكما وجمع بينكما في خير.',
    whatsNext: 'تم توثيق زواجكما في المنصة. نسأل الله التوفيق والسعادة.',
  },
  declined: {
    key: 'declined', step: -1, title: 'تم الاعتذار', badge: 'منتهٍ',
    icon: XCircle, accent: 'rose',
    whereYouAre: 'انتهت هذه الرحلة باعتذار لطيف من أحد الطرفين. الزواج قسمة ونصيب.',
    whatToDo: 'لا تيأس! لكل شخص نصيبه. تصفّح أعضاء جدد وأرسل طلبات توافق للزواج جديدة.',
    whatsNext: 'يمكنك بدء رحلة جديدة مع عضو آخر في أي وقت.',
  },
  cancelled: {
    key: 'cancelled', step: -1, title: 'ملغى', badge: 'مؤرشف',
    icon: Ban, accent: 'slate',
    whereYouAre: 'تم إلغاء هذا الطلب (بسبب عدم السداد في الوقت المحدد أو بطلب من أحد الطرفين).',
    whatToDo: 'يمكنك إرسال طلب توافق للزواج جديد لعضو آخر في أي وقت.',
    whatsNext: 'لا يلزمك أي إجراء. ابدأ بحثاً جديداً.',
  },
};

// ===== ألوان كل accent (للـ Tailwind — صريحة كي لا يُحذفها الـ purge) =====
export const ACCENT_CLASSES: Record<string, {
  text: string; bg: string; bgSoft: string; border: string; ring: string; dot: string; line: string;
}> = {
  gold:    { text: 'text-amber-700',  bg: 'bg-amber-500',   bgSoft: 'bg-amber-50',   border: 'border-amber-200',   ring: 'ring-amber-200',   dot: 'bg-amber-500',   line: 'bg-amber-400' },
  emerald: { text: 'text-emerald-700', bg: 'bg-emerald-500', bgSoft: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-200', dot: 'bg-emerald-500', line: 'bg-emerald-400' },
  amber:   { text: 'text-amber-700',  bg: 'bg-amber-500',   bgSoft: 'bg-amber-50',   border: 'border-amber-200',   ring: 'ring-amber-200',   dot: 'bg-amber-500',   line: 'bg-amber-400' },
  blue:    { text: 'text-blue-700',    bg: 'bg-blue-500',    bgSoft: 'bg-blue-50',    border: 'border-blue-200',    ring: 'ring-blue-200',    dot: 'bg-blue-500',    line: 'bg-blue-400' },
  indigo:  { text: 'text-indigo-700',  bg: 'bg-indigo-500',  bgSoft: 'bg-indigo-50',  border: 'border-indigo-200',  ring: 'ring-indigo-200',  dot: 'bg-indigo-500',  line: 'bg-indigo-400' },
  rose:    { text: 'text-rose-700',    bg: 'bg-rose-500',    bgSoft: 'bg-rose-50',    border: 'border-rose-200',    ring: 'ring-rose-200',    dot: 'bg-rose-500',    line: 'bg-rose-400' },
  slate:   { text: 'text-slate-600',   bg: 'bg-slate-500',   bgSoft: 'bg-slate-50',   border: 'border-slate-200',   ring: 'ring-slate-200',   dot: 'bg-slate-400',   line: 'bg-slate-300' },
};

// ===== الإجراء الأساسي الوحيد لكل مرحلة (Primary CTA) =====
// role: دور المستخدم الحالي في الطلب — مرسِل أو مستقبِل
export type RequestRole = 'sender' | 'receiver';

export interface PrimaryAction {
  type: 'accept_decline' | 'open_journey' | 'pay_deposit' | 'view_coordination' | 'record_result' | 'none';
  label: string;
  hint: string;
}

export function getPrimaryAction(
  stage: JourneyState,
  role: RequestRole,
  ctx: { selfPaid?: boolean; otherPaid?: boolean } = {},
): PrimaryAction {
  switch (stage) {
    case 'sent':
      // المستقبِل لديه قرار القبول/الرفض، المرسِل ينتظر
      return role === 'receiver'
        ? { type: 'accept_decline', label: 'الرد على الطلب', hint: 'اقبل الطلب أو اعتذر بلطف' }
        : { type: 'none', label: 'بانتظار الرد', hint: 'سنُشعرك فور رد الطرف الآخر' };
    case 'accepted':
      // بعد القبول: سداد رسوم الجدية أو استفسار في الصفحة الكاملة
      return { type: 'open_journey', label: 'سداد رسوم الجدية', hint: 'سدّد ٥٠٠ ريال أو استفسر أولاً' };
    case 'seriousness':
      if (ctx.selfPaid && !ctx.otherPaid) {
        return { type: 'none', label: 'بانتظار سداد الطرف الآخر', hint: 'أكملت السداد ✓' };
      }
      if (ctx.selfPaid && ctx.otherPaid) {
        return { type: 'view_coordination', label: 'متابعة التواصل', hint: 'أكّد الطرفان الجدية' };
      }
      return { type: 'open_journey', label: 'سداد رسوم الجدية', hint: 'سدّد ٥٠٠ ريال لتأكيد الجدية' };
    case 'coordination':
      return { type: 'view_coordination', label: 'متابعة التواصل', hint: 'شارك رقمك للتنسيق' };
    case 'sharia_viewing':
      return { type: 'record_result', label: 'تسجيل نتيجة النظرة', hint: 'توافق للمضي للملكة أو اعتذار مع السبب' };
    case 'engagement':
      return { type: 'open_journey', label: 'إتمام الملكة', hint: 'سدّد رسوم السعي (٢٠٠٠ ريال)' };
    case 'completed':
      return { type: 'none', label: 'اكتملت الرحلة', hint: 'نسأل الله لكما التوفيق' };
    default:
      return { type: 'none', label: '', hint: '' };
  }
}

// ===== هل يتطلّب هذا الطلب إجراءً فورياً من المستخدم الحالي؟ =====
// يُستخدم لتمييز البطاقات بصرياً وترتيبها أولاً + لوحة الإحصائيات
export function requiresMyAction(
  stage: JourneyState,
  role: RequestRole,
  ctx: { selfPaid?: boolean; otherPaid?: boolean } = {},
): boolean {
  switch (stage) {
    case 'sent':
      return role === 'receiver';            // طلب وارد ينتظر ردّي
    case 'accepted':
      return true;                            // عليّ اختيار استفسار/رسوم جدية
    case 'seriousness':
      return !ctx.selfPaid;                   // لم أدفع بعد
    case 'sharia_viewing':
      return true;                            // عليّ تسجيل نتيجة النظرة
    case 'engagement':
      return true;                            // عليّ إتمام الملكة
    default:
      return false;                           // التنسيق/مكتمل/مؤرشف لا يتطلّب إجراءً
  }
}

// تصنيف نوع الإجراء المطلوب (للون الشريط الجانبي والشارة)
export function actionUrgency(
  stage: JourneyState,
  role: RequestRole,
  ctx: { selfPaid?: boolean; otherPaid?: boolean } = {},
): 'pay' | 'respond' | 'continue' | null {
  if (!requiresMyAction(stage, role, ctx)) return null;
  if (stage === 'sent' && role === 'receiver') return 'respond';
  if (stage === 'seriousness' && !ctx.selfPaid) return 'pay';
  if (stage === 'accepted') return 'respond';
  return 'continue';
}

// ===== ربط الحالة القديمة بالمرحلة الجديدة (توافق رجعي مع البيانات القديمة) =====
export function legacyToJourney(status: string, mediationStage?: string): JourneyState {
  switch (status) {
    case 'pending': return 'sent';
    case 'accepted':
    case 'accepted_pending_admin':
    case 'accepted_pending_payment': return 'accepted';
    case 'paid': return 'seriousness';
    case 'in_mediation':
      if (mediationStage === 'evaluating') return 'sharia_viewing';
      if (mediationStage === 'exchanging') return 'coordination';
      return 'coordination';
    case 'introduction': return 'sharia_viewing';
    case 'sharia_viewing': return 'sharia_viewing';
    case 'engagement': return 'engagement';
    case 'completed': return 'completed';
    case 'declined': return 'declined';
    case 'cancelled': return 'cancelled';
    default: return 'sent';
  }
}

export function isTerminal(stage: JourneyState): stage is JourneyTerminal {
  return stage === 'declined' || stage === 'cancelled';
}

// ===== أدوات موحّدة لحساب المرحلة، الدور الحالي، والنص الواضح للواجهة =====
export interface JourneyRequestLike {
  journey_stage: string;
  sender_id: string;
  receiver_id: string;
  sender_paid?: boolean;
  receiver_paid?: boolean;
  sender_viewing_result?: 'success' | 'failed' | null;
  receiver_viewing_result?: 'success' | 'failed' | null;
  guardian_phone?: string | null;
  contact_info?: string | null;
  male_phone?: string | null;
  male_pledged?: boolean;
  female_pledged?: boolean;
  decline_reason?: string | null;
  cancel_reason?: string | null;
}

export type TurnActor = 'me' | 'other' | 'both' | 'system' | 'none';
export type StatusTone = 'urgent' | 'waiting' | 'success' | 'neutral' | 'danger';

export interface JourneyStatusSummary {
  actor: TurnActor;
  actorLabel: string;
  tone: StatusTone;
  title: string;
  description: string;
  nextHint: string;
}

const VALID_STAGES: JourneyState[] = ['sent', 'accepted', 'seriousness', 'coordination', 'sharia_viewing', 'engagement', 'completed', 'declined', 'cancelled'];

export function getJourneyStage(req: JourneyRequestLike, currentUserId: string): JourneyState {
  const baseStage = VALID_STAGES.includes(req.journey_stage as JourneyState)
    ? (req.journey_stage as JourneyState)
    : legacyToJourney(req.journey_stage);

  if (baseStage === 'sharia_viewing') {
    if (req.sender_viewing_result === 'success' && req.receiver_viewing_result === 'success') return 'engagement';
  }

  return baseStage;
}

export function getJourneyStatusSummary(
  req: JourneyRequestLike,
  currentUserId: string,
  otherName = 'الطرف الآخر',
): JourneyStatusSummary {
  const stage = getJourneyStage(req, currentUserId);
  const isSender = req.sender_id === currentUserId;
  const role: RequestRole = isSender ? 'sender' : 'receiver';
  const selfPaid = isSender ? !!req.sender_paid : !!req.receiver_paid;
  const otherPaid = isSender ? !!req.receiver_paid : !!req.sender_paid;
  const meta = STAGE_META[stage];

  if (stage === 'declined') {
    return {
      actor: 'none', actorLabel: 'منتهٍ', tone: 'danger',
      title: 'تم الاعتذار عن هذا الطلب',
      description: req.decline_reason ? `السبب: ${req.decline_reason}` : 'انتهت الرحلة باعتذار لطيف من أحد الطرفين. الزواج قسمة ونصيب.',
      nextHint: 'لا تيأس — تصفّح أعضاء جدد وأرسل طلبات جديدة.',
    };
  }

  if (stage === 'cancelled') {
    return {
      actor: 'none', actorLabel: 'مؤرشف', tone: 'neutral',
      title: 'تم إلغاء هذا الطلب',
      description: req.cancel_reason ? `السبب: ${req.cancel_reason}` : 'أُلغي الطلب. يمكنك بدء طلب جديد متى شئت.',
      nextHint: 'ابدأ رحلة توافق للزواج جديدة في أي وقت.',
    };
  }

  if (stage === 'completed') {
    return {
      actor: 'none', actorLabel: 'مكتمل ✅', tone: 'success',
      title: '🎉 اكتملت الرحلة بنجاح!',
      description: 'تم توثيق زواجكما في المنصة. بارك الله لكما وبارك عليكما.',
      nextHint: meta.whatsNext,
    };
  }

  if (stage === 'sent') {
    if (role === 'receiver') {
      return {
        actor: 'me', actorLabel: '🔔 الدور عليك الآن', tone: 'urgent',
        title: `${otherName} يريد التوافق معك للزواج!`,
        description: `وصلك طلب توافق للزواج من ${otherName}. اقرأ الملف الشخصي ثم اقبل أو اعتذر بلطف.`,
        nextHint: 'عند قبولك، ينتقل الطرفان لمرحلة تأكيد الجدية والقبول.',
      };
    }
    return {
      actor: 'other', actorLabel: '⏳ بانتظار الرد', tone: 'waiting',
      title: 'تم تقديم طلبك بنجاح وبانتظار القبول',
      description: `${otherName} يستلم إشعاراً بطلبك الآن وبانتظار قبوله. لا تحتاج لفعل أي شيء حالياً.`,
      nextHint: 'سنُخطرك فوراً عند الرد والقبول.',
    };
  }

  if (stage === 'accepted') {
    return {
      actor: 'both', actorLabel: '🎉 الخطوة التالية', tone: 'urgent',
      title: 'تم القبول — ما خطوتك التالية؟',
      description: 'يمكنك سداد رسوم تأكيد الجدية (٥٠٠ ريال) مباشرة، أو الاستفسار أولاً عبر غرفة المحادثة.',
      nextHint: 'بعد سداد الطرفين، يتم تبادل أرقام التواصل مباشرة.',
    };
  }

  if (stage === 'seriousness') {
    if (!selfPaid) {
      return {
        actor: 'me', actorLabel: '💳 الدور عليك', tone: 'urgent',
        title: 'رسوم تأكيد الجدية بانتظارك',
        description: otherPaid
          ? `✅ ${otherName} سدّد بالفعل. أكمل سدادك (٥٠٠ ريال) لبدء تبادل أرقام التواصل.`
          : 'أكمل سداد ٥٠٠ ريال لتأكيد جديتك. (تُسترد عند عدم التوافق بعد النظرة الشرعية).',
        nextHint: 'بمجرد سداد الطرفين → تبادل أرقام التواصل فوراً.',
      };
    }
    if (!otherPaid) {
      return {
        actor: 'other', actorLabel: '⏳ بانتظار الطرف الآخر', tone: 'waiting',
        title: '✅ أكملت سدادك بنجاح!',
        description: `بانتظار ${otherName} ليسدّد رسومه. سنُخطرك فور سداده.`,
        nextHint: 'بعد سداد الطرفين → تبادل أرقام التواصل.',
      };
    }
  }

  if (stage === 'coordination') {
    const femaleContactReady = !!(req.guardian_phone || req.contact_info);
    const maleContactReady = !!req.male_phone;
    if (!femaleContactReady || !maleContactReady) {
      return {
        actor: 'both', actorLabel: '📱 تبادل الأرقام', tone: 'urgent',
        title: 'آن الآوان لتبادل أرقام التواصل',
        description: 'الباحثة عن الستر تُدخل رقم ولي أمرها، والباحث عن الستر يطّلع عليه بعد تقديم التعهد. أكمِلا البيانات أدناه.',
        nextHint: 'بعد اكتمال التبادل → النظرة الشرعية.',
      };
    }
    if (!req.male_pledged || !req.female_pledged) {
      return {
        actor: 'both', actorLabel: '🔒 تعهد مطلوب', tone: 'waiting',
        title: 'الأرقام جاهزة — أكمِل التعهد للاطّلاع',
        description: 'بقي التعهد بالحفاظ على الخصوصية قبل إظهار الأرقام.',
        nextHint: 'بعد التعهد → تظهر الأرقام → تنسيق النظرة الشرعية.',
      };
    }
    return {
      actor: 'both', actorLabel: '✅ جاهز للتنسيق', tone: 'success',
      title: 'اكتمل تبادل الأرقام بنجاح!',
      description: 'يمكنكما الآن تنسيق موعد النظرة الشرعية مباشرة.',
      nextHint: 'نسّقوا الموعد ثم سجّلوا النتيجة.',
    };
  }

  if (stage === 'sharia_viewing') {
    const myResult = isSender ? req.sender_viewing_result : req.receiver_viewing_result;
    const otherResult = isSender ? req.receiver_viewing_result : req.sender_viewing_result;
    if (myResult === 'success' && !otherResult) {
      return {
        actor: 'other', actorLabel: '⏳ بانتظار الطرف الآخر', tone: 'waiting',
        title: '✅ سجّلت توافقك بنجاح!',
        description: `بانتظار ${otherName} ليسجّل نتيجته. عند توافقكما → الملكة.`,
        nextHint: 'عند توافق الطرفين → تنتقل لمرحلة الملكة.',
      };
    }
    return {
      actor: 'me', actorLabel: '📝 سجّل نتيجتك', tone: 'urgent',
      title: 'بعد اللقاء — سجّل نتيجتك بأمانة',
      description: 'هل وجدت توافقاً للمضي قدماً نحو الملكة؟ أم تفضل الاعتذار بلطف؟',
      nextHint: 'عند توافق الطرفين → الملكة. عند اعتذار أحد الطرفين → نهاية لطيفة.',
    };
  }

  if (stage === 'engagement') {
    return {
      actor: 'me', actorLabel: '💍 إتمام العقد', tone: 'urgent',
      title: 'مبارك التوافق! أكمِل الملكة',
      description: 'أكمل إجراءات عقد القران وسدّد رسوم السعي النهائية (٢٠٠٠ ريال) لإتمام التوثيق.',
      nextHint: 'بعد السداد → تحديث حالتكما كمتزوجين في المنصة.',
    };
  }

  return {
    actor: 'system', actorLabel: 'متابعة', tone: 'neutral',
    title: meta.title,
    description: meta.whereYouAre,
    nextHint: meta.whatsNext,
  };
}

// ===== رسوم السعي وباقة الاستفسار =====
export const DEPOSIT_AMOUNT = 500;
export const FINAL_FEE_AMOUNT = 2000;
export const INQUIRY_PACKAGE_PRICE = 100;   // سعر باقة الاستفسار
export const INQUIRY_PACKAGE_CREDITS = 20;   // عدد رسائل الباقة
export const INQUIRY_LOW_CREDITS = 3;        // عتبة التحذير

// ===== أسباب الاعتذار الجاهزة =====
export const DECLINE_REASONS = [
  'عدم توافق في المواصفات الأساسية المطلوبة.',
  'الفارق في العمر كبير جداً.',
  'الحالة الاجتماعية غير مناسبة.',
  'عدم توافق في الأهداف وتطلعات شريك الحياة.',
  'المسافة الجغرافية بين المدن كبيرة.',
  'سبب آخر.',
];

// ===== أسباب إلغاء الطلب الجاهزة =====
export const CANCEL_REASONS = [
  'لم يعد لدي رغبة في إكمال هذا الطلب.',
  'تبيّن عدم التوافق بعد الاستفسار.',
  'ظروف خاصة طرأت.',
  'سبب آخر.',
];
