import { useState, useMemo } from 'react';
import { MessageCircle, Check, Copy, Sparkles, User, ShieldCheck } from 'lucide-react';
import Modal from './ui/Modal';
import { useApp } from '../lib/AppContext';
import { ADMIN_WHATSAPP_NUMBER, ADMIN_WHATSAPP_DISPLAY } from '../lib/constants';

interface MemberData {
  id?: string;
  username?: string;
  nickname?: string;
  name?: string;
  realName?: string;
  gender?: string;
  age?: number | string;
  country?: string;
  city?: string;
  nationality?: string;
  maritalLabel?: string;
  maritalStatus?: string;
  marital_status?: string;
  marriageType?: string;
  marriageTypeLabel?: string;
  khataabaPhone?: string;
  khataaba_phone?: string;
  [key: string]: unknown;
}

interface WhatsAppShareModalProps {
  open: boolean;
  onClose: () => void;
  member?: MemberData | null;
  platformWhatsApp?: string;
  isImported?: boolean;
}

export default function WhatsAppShareModal({
  open,
  onClose,
  member,
  platformWhatsApp = ADMIN_WHATSAPP_NUMBER,
  isImported,
}: WhatsAppShareModalProps) {
  const { user } = useApp();
  const isImportedProfile = isImported || member?.sourceType === 'imported' || Boolean(member?.importBatchId) || Boolean(member?.importOfficeName) || Boolean(member?.khataabaPhone) || Boolean(member?.khataaba_phone);
  
  const requesterIdentifier = useMemo(() => {
    if (!user?.isLoggedIn) return '';
    return user.profile?.username 
      ? `@${user.profile.username}` 
      : (user.username ? `@${user.username}` : (user.profile?.name || user.name || (user.memberId ? `#${user.memberId}` : 'عضو مسجل')));
  }, [user]);

  const targetMemberIdentifier = useMemo(() => {
    if (!member) return '';
    if (member.username) return `@${member.username}`;
    if (member.id) return `#${member.id}`;
    return member.nickname || member.name || 'العضو';
  }, [member]);

  const defaultTemplates = useMemo(() => {
    const isMemberLoggedIn = user?.isLoggedIn;

    if (isMemberLoggedIn) {
      return [
        { 
          id: 'mediation_member', 
          label: '💍 طلب التوفيق والوساطة لهذا الملف (كعضو مسجل)', 
          text: `السلام عليكم ورحمة الله، أنا العضو (${requesterIdentifier}) في منصة توافق، اطلعت على ملف (${targetMemberIdentifier}) وأرغب في طلب التوفيق والوساطة لبحث التوافق الشرعي.` 
        },
        { 
          id: 'inquire_member', 
          label: '💬 استفسار عن إتاحة وتفاصيل الملف', 
          text: `السلام عليكم ورحمة الله، أنا العضو (${requesterIdentifier}) في منصة توافق، هل ملف (${targetMemberIdentifier}) متاح حالياً للتوافق والتقدم؟` 
        },
        { 
          id: 'broadcast', 
          label: '📢 بطاقة نشر للمجموعات (بدون معلومات خاصة)', 
          text: '✨ *ملف زواج مبارك عبر منصة توافق للزواج الشرعي:*' 
        },
        { 
          id: 'custom', 
          label: '✏️ كتابة رسالة مخصصة', 
          text: '' 
        },
      ];
    } else {
      return [
        { 
          id: 'mediation_guest', 
          label: '💍 طلب التوفيق والوساطة دون إنشاء حساب (كزائر)', 
          text: `السلام عليكم ورحمة الله، أنا زائر في منصة توافق واطلعت على ملف (${targetMemberIdentifier}) المبارك، وأرغب في طلب التوفيق والوساطة للتواصل مع الطرف الآخر بإشراف إدارة المنصة دون إنشاء حساب حالياً.` 
        },
        { 
          id: 'inquire_guest', 
          label: '💬 استفسار عن إتاحة الملف وتفاصيله', 
          text: `السلام عليكم ورحمة الله، أنا زائر في المنصة وأرغب بالاستفسار عن إتاحة ملف (${targetMemberIdentifier}) للتوافق والزواج.` 
        },
        { 
          id: 'broadcast', 
          label: '📢 بطاقة نشر للمجموعات (بدون معلومات خاصة)', 
          text: '✨ *ملف زواج مبارك عبر منصة توافق للزواج الشرعي:*' 
        },
        { 
          id: 'custom', 
          label: '✏️ كتابة رسالة مخصصة', 
          text: '' 
        },
      ];
    }
  }, [user?.isLoggedIn, requesterIdentifier, targetMemberIdentifier]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => user?.isLoggedIn ? 'mediation_member' : 'mediation_guest');
  const [customMessage, setCustomMessage] = useState<string>(() => {
    if (user?.isLoggedIn) {
      return `السلام عليكم ورحمة الله، أنا العضو (${requesterIdentifier}) في منصة توافق، اطلعت على ملف (${targetMemberIdentifier}) وأرغب في طلب التوفيق والوساطة لبحث التوافق الشرعي.`;
    }
    return `السلام عليكم ورحمة الله، أنا زائر في منصة توافق واطلعت على ملف (${targetMemberIdentifier}) المبارك، وأرغب في طلب التوفيق والوساطة للتواصل مع الطرف الآخر بإشراف إدارة المنصة دون إنشاء حساب حالياً.`;
  });

  const [includeProfileDetails, setIncludeProfileDetails] = useState<boolean>(true);
  const [targetRecipient, setTargetRecipient] = useState<'admin' | 'share'>('admin');
  const [copied, setCopied] = useState<boolean>(false);

  const isMale = member?.gender === 'male';
  const memberName = member?.nickname || member?.name || member?.realName || 'عضو توافق';
  const memberCode = member?.username ? `@${member.username}` : (member?.id ? `#${member.id}` : '');
  
  const profileUrl = typeof window !== 'undefined' && member
    ? (member.username ? `${window.location.origin}/u/${member.username}` : `${window.location.origin}/member/${member.id}`)
    : '';

  const marital = member?.maritalLabel || member?.marital_status || member?.maritalStatus || 'غير محدد';
  const marriageType = member?.marriageTypeLabel || (member?.marriageType === 'misyar' ? 'مسيار' : member?.marriageType === 'both' ? 'معلن أو مسيار' : 'معلن');
  const location = member ? [member.country, member.city].filter(Boolean).join(' - ') || 'السعودية' : '';
  const age = member?.age ? `${member.age} سنة` : '';
  const nationality = member?.nationality || '';

  const tribe = member?.tribe || '';
  const education = member?.education || '';
  const jobTitle = member?.jobTitle || '';
  const aboutPartner = member?.aboutPartner ? (member.aboutPartner.length > 80 ? member.aboutPartner.slice(0, 80) + '...' : member.aboutPartner) : '';

  // تجهيز نص الرسالة الكاملة مع بيانات العضو المرسل والملف المطلوب
  const fullMessage = useMemo(() => {
    if (!member) return '';
    const parts: string[] = [];

    // الرسالة الأساسية
    if (customMessage.trim()) {
      parts.push(customMessage.trim());
    }

    // معلومات مرسل الطلب لتسهيل البحث الفوري
    parts.push('\n━━━━━━━━━━━━━━━━━━━━');
    if (user?.isLoggedIn) {
      parts.push('👤 *بيانات العضو المرسل (المسجل بالمنصة):*');
      if (user.profile?.username || user.username) {
        parts.push(`▫️ *اسم المستخدم / اليوزر:* @${user.profile?.username || user.username}`);
      }
      if (user.memberId) {
        parts.push(`▫️ *رقم/معرف الحساب (ID):* #${user.memberId}`);
      }
      parts.push(`▫️ *الاسم:* ${user.profile?.name || user.name || 'عضو توافق'}`);
      if (user.profile?.phone || user.profile?.whatsapp) {
        parts.push(`▫️ *رقم التواصل المسجل:* ${user.profile?.whatsapp || user.profile?.phone}`);
      }
    } else {
      parts.push('👤 *بيانات المرسل:* زائر في المنصة (طلب وساطة وتوفيق مباشر)');
    }

    // ملخص بيانات الملف المطلوب التوفيق معه
    if (includeProfileDetails) {
      parts.push('\n📋 *الملف المطلوب التوفيق والوساطة معه:*');
      if (member.username) {
        parts.push(`▫️ *اسم المستخدم / اليوزر:* @${member.username}`);
      }
      if (member.id) {
        parts.push(`▫️ *رقم/معرف الملف (ID):* #${member.id}`);
      }
      parts.push(`▫️ *الاسم المستعار:* ${memberName}`);
      parts.push(`▫️ *الصفة:* ${isMale ? 'رجل (خاطب)' : 'امرأة (مخطوبة)'}`);
      if (age) parts.push(`▫️ *العمر:* ${age}`);
      if (marital) parts.push(`▫️ *الحالة الاجتماعية:* ${marital}`);
      if (location) parts.push(`▫️ *المدينة والإقامة:* ${location}`);
      if (tribe) parts.push(`▫️ *القبيلة / النسب:* ${tribe}`);
      if (education) parts.push(`▫️ *المؤهل التعليمي:* ${education}`);
      if (jobTitle) parts.push(`▫️ *الوظيفة:* ${jobTitle}`);
      if (marriageType) parts.push(`▫️ *نوع الزواج:* ${marriageType}`);
      if (aboutPartner) parts.push(`▫️ *مواصفات الشريك:* ${aboutPartner}`);
      if (profileUrl) {
        parts.push(`\n🔗 *رابط الملف بالمنصة:*\n${profileUrl}`);
      }
    }
    parts.push('━━━━━━━━━━━━━━━━━━━━');

    return parts.join('\n');
  }, [member, customMessage, includeProfileDetails, memberCode, memberName, isMale, age, marital, location, tribe, education, jobTitle, marriageType, aboutPartner, profileUrl, user]);

  const handleTemplateSelect = (template: typeof defaultTemplates[0]) => {
    setSelectedTemplateId(template.id);
    if (template.id !== 'custom') {
      setCustomMessage(template.text);
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(fullMessage)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {});
  };

  const handleSendWhatsApp = () => {
    const encoded = encodeURIComponent(fullMessage);
    let waUrl = `https://wa.me/?text=${encoded}`;
    
    // الإرسال لرقم إدارة المنصة المعتمد
    const targetPhone = member?.khataabaPhone || member?.khataaba_phone || platformWhatsApp || ADMIN_WHATSAPP_NUMBER;
    if (targetRecipient === 'admin' && targetPhone) {
      const cleanPhone = (targetPhone as string).replace(/[^\d]/g, '');
      waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;
    }

    window.open(waUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  if (!member) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="طلب التوفيق والوساطة عبر واتساب 💬"
      size="md"
    >
      <div className="space-y-4 text-right" dir="rtl">
        {/* بطاقة العضو المصغرة مع التوضيح */}
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
          isMale 
            ? 'bg-sky-50/80 border-sky-200/90 text-sky-950'
            : 'bg-rose-50/80 border-rose-200/90 text-rose-950'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-cairo font-bold text-white shadow-xs flex-shrink-0 ${
              isMale ? 'bg-sky-600' : 'bg-rose-500'
            }`}>
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-cairo font-black text-sm truncate">{memberName}</span>
                <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-white/80 border border-slate-200/60 text-slate-700">
                  ID: #{member.id}
                </span>
                {member.username && <span className="font-mono text-[11px] text-slate-500" dir="ltr">@{member.username}</span>}
              </div>
              <div className="text-xs text-slate-600 font-tajawal flex items-center gap-2 mt-0.5">
                <span>{age}</span>
                <span>•</span>
                <span>{location}</span>
                <span>•</span>
                <span className="font-semibold">{marriageType}</span>
              </div>
            </div>
          </div>

          <div className="text-left flex-shrink-0">
            <span className="inline-flex items-center gap-1 text-[11px] font-cairo font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-xl shadow-2xs">
              <MessageCircle className="w-3.5 h-3.5 fill-white" />
              واتساب الإدارة ({ADMIN_WHATSAPP_DISPLAY})
            </span>
          </div>
        </div>

        {/* تنبيه حالة العضو المسجل أو الزائر */}
        <div className="flex items-center gap-2 text-xs font-tajawal px-3 py-2 rounded-xl bg-slate-100/90 text-slate-700 border border-slate-200/60">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {user?.isLoggedIn ? (
            <span>
              أنت مسجل كـ <strong>{user.profile?.name || user.name}</strong> (رقم ID: <strong>#{user.memberId}</strong>) وسيتم تضمين بيانات حسابك للإدارة للبحث الفوري.
            </span>
          ) : (
            <span>
              أنت تتواصل كـ <strong>زائر</strong> — يمكنك التواصل المباشر مع الإدارة للوساطة والتوفيق دون الحاجة لإنشاء حساب.
            </span>
          )}
        </div>

        {/* اختيار رسالة جاهزة */}
        <div>
          <label className="block text-xs font-cairo font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>اختر نص الرسالة أو اكتب رسالتك:</span>
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {defaultTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleTemplateSelect(tmpl)}
                className={`w-full text-right p-2.5 rounded-xl border text-xs font-cairo transition-all flex items-center justify-between cursor-pointer ${
                  selectedTemplateId === tmpl.id
                    ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{tmpl.label}</span>
                {selectedTemplateId === tmpl.id && (
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* حقل تعديل نص الرسالة */}
        <div>
          <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">
            نص الرسالة:
          </label>
          <textarea
            rows={2}
            value={customMessage}
            onChange={(e) => {
              setCustomMessage(e.target.value);
              setSelectedTemplateId('custom');
            }}
            placeholder="اكتب رسالتك هنا..."
            className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-tajawal text-xs focus:outline-none focus:border-emerald-500 text-slate-800"
          />
        </div>

        {/* خيار تضمين ملخص بيانات الملف */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeProfileDetails}
              onChange={(e) => setIncludeProfileDetails(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
            />
            <span className="text-xs font-cairo font-semibold text-slate-800">
              تضمين ملخص بيانات الملف وID الحساب ورابطه تلقائياً في الرسالة
            </span>
          </label>

          {/* خيار جهة الإرسال */}
          <div className="pt-2 border-t border-slate-200/60 flex items-center gap-4 text-xs font-cairo">
            <span className="text-slate-500 font-bold">طريقة الإرسال:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="targetRecipient"
                value="admin"
                checked={targetRecipient === 'admin'}
                onChange={() => setTargetRecipient('admin')}
                className="accent-emerald-600 cursor-pointer"
              />
              <span className="text-slate-900 font-bold">مباشرة لواتساب إدارة المنصة ({ADMIN_WHATSAPP_DISPLAY})</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="targetRecipient"
                value="share"
                checked={targetRecipient === 'share'}
                onChange={() => setTargetRecipient('share')}
                className="accent-emerald-600 cursor-pointer"
              />
              <span className="text-slate-700">مشاركة حرة</span>
            </label>
          </div>
        </div>

        {/* معاينة نص الرسالة النهائية */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-cairo font-bold text-slate-500">معاينة الرسالة التلقائية:</span>
            <button
              type="button"
              onClick={handleCopyMessage}
              className="text-[11px] font-cairo text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ بنجاح ✓' : 'نسخ الرسالة'}</span>
            </button>
          </div>
          <div className="p-3 bg-emerald-900/5 rounded-xl border border-emerald-200/60 max-h-36 overflow-y-auto font-tajawal text-xs text-slate-700 whitespace-pre-line dir-rtl leading-relaxed select-all">
            {fullMessage}
          </div>
        </div>

        {/* الأزرار السفلية */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-cairo font-bold text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>إرسال لواتساب الإدارة الآن 💬</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-xs transition-colors cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}

