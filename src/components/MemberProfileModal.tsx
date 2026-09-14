import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, MapPin, Briefcase, GraduationCap, Ruler, Heart, Bookmark,
  ShieldCheck, Calendar, Users, Copy, Share2, Crown, Check,
  AlertTriangle, Send, Ban, Weight, Palette, Stethoscope, Cigarette,
  Home, ExternalLink, FileText, User, Sparkles, Building2, Church,
  TreePine, Flame, Zap, Shield, Eye, Lock, Globe, Baby, Scale, MessageCircle,
  MoreVertical, ChevronDown, ChevronUp, CheckCircle2,
} from 'lucide-react';
import type { Member } from '../lib/members';
import { useApp } from '../lib/AppContext';
import { getAvatar, getGenderColors } from '../lib/types';
import { formatMaritalStatus, getPartnerSummary } from '../lib/memberUtils';
import { getCurrentUserId, useInterestRequests } from '../lib/useInterestRequests';
import { normalizeNationality } from '../lib/data/optionNormalizer';
import WhatsAppShareModal from './WhatsAppShareModal';

interface MemberProfileModalProps {
  member: Member | null;
  open: boolean;
  onClose: () => void;
}

const MESSAGE_TEMPLATES = [
  'السلام عليكم ورحمة الله، لفت انتباهي توافق ملفنا وأتمنى التوفيق لنا.',
  'مرحبًا، أرى توافقًا في القيم والأهداف وأرغب بالتوافق الجاد للزواج بإذن الله.',
  'السلام عليكم، ملفك أعجبني وأبحث عن شريك بصفات مشابهة، أتمنى التواصل.',
  'تحية طيبة، لاحظت توافقًا في المواصفات وأرغب في التقدم عبر الإدارة.',
];

export default function MemberProfileModal({ member, open, onClose }: MemberProfileModalProps) {
  const navigate = useNavigate();
  const {
    user, likedMembers, toggleLike, showToast, checkLimit, incrementUsage,
    sendInterestRequest, submitReport,
    blockedMembers, toggleBlock,
  } = useApp();

  const [contactOpen, setContactOpen] = useState(false);
  const [contactMsg, setContactMsg] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [sending, setSending] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const currentUserId = user?.isLoggedIn ? (user.memberId || getCurrentUserId()) : '';
  const { requests } = useInterestRequests(currentUserId);

  const latestRequest = useMemo(() => {
    if (!user?.isLoggedIn || !requests || requests.length === 0 || !member?.id || !currentUserId) return null;
    const sent = requests.filter(r => r.sender_id === currentUserId && r.receiver_id === member.id);
    if (sent.length === 0) return null;
    return [...sent].sort((a, b) => b.id - a.id)[0];
  }, [requests, currentUserId, member?.id, user?.isLoggedIn]);

  if (!open || !member) return null;

  const liked = user?.isLoggedIn ? likedMembers.has(member.id) : false;
  const isBlocked = user?.isLoggedIn ? blockedMembers.has(member.id) : false;
  const isSelf = Boolean(user?.isLoggedIn && currentUserId && member.id === currentUserId);

  const safeGender = (member.gender === 'male' || member.gender === 'female' ? member.gender : 'female') as any;
  const avatar = getAvatar(safeGender);
  const c = getGenderColors(safeGender);
  const isMale = member.gender === 'male';
  const isImported = member.sourceType === 'imported' || Boolean((member as any).importBatchId) || Boolean((member as any).importOfficeName) || Boolean((member as any).khataabaName) || Boolean((member as any).khataabaPhone) || Boolean((member as any).khataaba_phone);

  const maritalFormatted = formatMaritalStatus(member.maritalStatus, member.maritalLabel, member.gender);
  const marriageTypeFormatted = (
    member.marriageType === 'misyar' || (member as any).marriage_type === 'misyar' ? 'مسيار' :
    member.marriageType === 'both' || (member as any).marriage_type === 'both' || member.marriageTypeLabel?.includes('مسيار') && member.marriageTypeLabel?.includes('معلن') ? 'لا مانع / معلن او مسيار' :
    member.marriageType === 'announced' || (member as any).marriage_type === 'announced' ? 'معلن' :
    member.marriageTypeLabel || ''
  );
  const partnerSummary = getPartnerSummary(member);

  const limitCheck = checkLimit('message');

  // نسخ جميع بيانات العضو بطريقة مرتبة وشاملة للحافظة
  const handleCopyMemberData = () => {
    const genderWord = isMale ? 'رجل' : 'امرأة';
    const profileUrl = member.username
      ? `${window.location.origin}/u/${member.username}`
      : `${window.location.origin}/member/${member.id}`;

    const lines = [
      `📌 **بيانات العضو في منصة توافق للزواج الشرعي** 📌`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 الاسم المستعار: ${member.nickname || 'غير محدد'}`,
      member.username ? `🆔 اليوزر: @${member.username}` : null,
      `⚤ الجنس: ${genderWord}`,
      `🎂 العمر: ${member.age ? `${member.age} سنة` : 'غير محدد'}`,
      `📍 الدولة والمدينة: ${[member.city, member.country].filter(Boolean).join('، ') || 'غير محدد'}`,
      member.district ? `🏙️ المنطقة/الحي: ${member.district}` : null,
      member.nationality ? `🌍 الجنسية: ${member.nationality}` : null,
      member.sect ? `🕌 المذهب: ${member.sect}` : null,
      (member as any).tribe ? `🏛️ القبيلة/النسب: ${(member as any).tribe}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💍 الحالة الاجتماعية: ${member.maritalLabel || member.maritalStatus || 'غير محدد'}`,
      marriageTypeFormatted ? `📜 نوع الزواج المطلوب: ${marriageTypeFormatted}` : null,
      member.hasChildren ? `👶 الأطفال: نعم (${member.childrenCount || 'يوجد'})` : `👶 الأطفال: لا يوجد`,
      member.housing ? `🏠 السكن: ${member.housing}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💼 العمل والوظيفة: ${member.jobTitle || member.workType || 'غير محدد'}`,
      member.education ? `🎓 المؤهل التعليمي: ${member.education}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      member.height ? `📏 الطول: ${member.height} سم` : null,
      member.weight ? `⚖️ الوزن: ${member.weight} كجم` : null,
      member.skinColor ? `🎨 لون البشرة: ${member.skinColor}` : null,
      member.health ? `🏥 الحالة الصحية: ${member.health}` : null,
      member.smoking ? `🚬 التدخين: ${member.smoking}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      member.bio ? `📝 نبذة عني:\n"${member.bio}"` : null,
      member.aboutPartner ? `🎯 مواصفات الشريك المطلوب:\n"${member.aboutPartner}"` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✨ الشارات: ${[
        member.verified ? '✓ موثق' : '',
        member.hasSeriousnessBadge ? '🏅 جاد' : '',
        member.plan === 'gold' ? '👑 ذهبي' : member.plan === 'elite' ? '⭐ مميز' : '',
      ].filter(Boolean).join(' | ') || 'عضو عادي'}`,
      `🔗 رابط الملف الشخصي: ${profileUrl}`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lines)
      .then(() => {
        showToast('تم نسخ كافة بيانات العضو إلى الحافظة بنجاح! 📋', 'success');
      })
      .catch(() => {
        showToast('تعذّر النسخ إلى الحافظة', 'error');
      });
  };

  const handleCopyLink = () => {
    const profileUrl = member.username
      ? `${window.location.origin}/u/${member.username}`
      : `${window.location.origin}/member/${member.id}`;
    navigator.clipboard.writeText(profileUrl)
      .then(() => showToast('تم نسخ رابط الملف الشخصي ✓', 'success'))
      .catch(() => showToast('تعذّر النسخ', 'error'));
  };

  const handleShareWhatsApp = () => {
    setWhatsAppModalOpen(true);
  };

  const handleViewFullPage = () => {
    onClose();
    navigate(`/member/${member.id}`);
  };

  const handleSendInterest = async () => {
    if (!limitCheck.allowed) {
      showToast('لقد وصلت للحد الأقصى لإرسال طلبات الاهتمام اليوم', 'error');
      return;
    }
    setSending(true);
    try {
      const msg = contactMsg || 'طلب توافق جديد للزواج عبر المنصة';
      const res = await sendInterestRequest(member.id, msg);
      if (res?.ok) {
        incrementUsage('message');
        setContactOpen(false);
        setContactMsg('');
        showToast('تم إرسال طلب التوافق بنجاح! سيتم إشعار الطرف الآخر. 💌', 'success');
      } else {
        showToast(res?.error || 'حدث خطأ أثناء إرسال الطلب', 'error');
      }
    } catch {
      showToast('تعذر إرسال الطلب، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleReportSubmit = () => {
    if (!reportReason.trim()) {
      showToast('يرجى كتابة سبب البلاغ', 'error');
      return;
    }
    submitReport(member.id, reportReason);
    setReportOpen(false);
    setReportReason('');
    showToast('تم إرسال بلاغك للإدارة بنجاح، وستتم مراجعته بفحص دقيق.', 'success');
  };

  return (
    <>
      <div key={`modal-overlay-${member.id}`} className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden dir-rtl" dir="rtl">
        {/* الخلفية المظلمة الضبابية */}
        <motion.div
          key={`modal-backdrop-${member.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-navy-950/75 backdrop-blur-md"
          onClick={onClose}
        />

        {/* جسم النافذة المنبثقة */}
        <motion.div
          key={`modal-card-${member.id}`}
          initial={{ opacity: 0, y: 50, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.97 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className={`relative w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden border transition-colors ${
            isMale
              ? 'bg-[#edf5ff] dark:bg-[#0b1728] border-sky-300 dark:border-sky-800/80'
              : 'bg-[#faf0f4] dark:bg-[#230913] border-rose-300 dark:border-rose-900/80'
          }`}
        >
          {/* Header Bar: هيدر مرتب بدون تكرار أزرار */}
          <div className={`sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b ${
            isMale
              ? 'bg-[#e0f2fe]/95 dark:bg-[#071322]/95 border-sky-200 dark:border-sky-800/80 backdrop-blur-md'
              : 'bg-[#f4dbe3]/95 dark:bg-[#1a050d]/95 border-rose-200 dark:border-rose-900/80 backdrop-blur-md'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse ${isMale ? 'bg-sky-500' : 'bg-rose-600'}`} />
              <h3 className="font-cairo font-bold text-sm sm:text-base text-navy-900 dark:text-cream-50 truncate">
                ملف العضو: {member.nickname}
              </h3>
              {member.username && (
                <span className="text-xs font-mono text-navy-400 dark:text-slate-400 hidden xs:inline" dir="ltr">
                  @{member.username}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* زر عرض الصفحة كاملة (أنيق وموجز في الرأس) */}
              <button
                onClick={handleViewFullPage}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-navy-800/90 hover:bg-white dark:hover:bg-navy-800 text-navy-800 dark:text-cream-100 font-cairo font-bold text-xs transition-colors border border-navy-100 dark:border-navy-700 shadow-2xs cursor-pointer"
                title="الانتقال إلى الصفحة الكاملة"
              >
                <ExternalLink className="w-3.5 h-3.5 text-gold-600" />
                <span className="hidden xs:inline">عرض الصفحة كاملة</span>
              </button>

              {/* زر إغلاق النافذة */}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white dark:bg-navy-800 dark:hover:bg-navy-700 flex items-center justify-center text-navy-600 dark:text-cream-200 transition-colors shadow-2xs cursor-pointer"
                title="إغلاق النافذة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* محتوى البطاقة القابل للتمرير */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">

            {/* 1. بطاقة البطل التلخيصية (Hero Profile Card) */}
            <div className={`relative rounded-2xl p-4 border shadow-sm transition-colors ${
              isMale
                ? 'bg-gradient-to-br from-sky-50 via-blue-50/40 to-white dark:from-sky-950/40 dark:to-navy-800/90 border-sky-200/80 dark:border-sky-800/40'
                : 'bg-gradient-to-br from-[#4a1224]/10 via-rose-50/50 to-white dark:from-[#3a0d1c]/40 dark:to-navy-800/90 border-rose-200/80 dark:border-rose-900/50'
            }`}>
              <div className="flex items-start gap-3.5 sm:gap-4">
                {/* الصورة الرمزية مع الشارة */}
                <div className="relative flex-shrink-0">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-navy-950 p-1 ring-2 ${c.ring} ring-opacity-30 shadow-md flex items-center justify-center overflow-hidden`}>
                    <img src={avatar} alt="" className="w-full h-full object-contain p-1.5" />
                  </div>
                  {member.verified && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center shadow-xs" title="حساب موثّق">
                      <ShieldCheck className="w-3 h-3 text-white" />
                    </span>
                  )}
                </div>

                {/* تفاصيل الاسم والشارات الأساسية */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="font-cairo font-black text-lg sm:text-xl text-navy-900 dark:text-cream-50 leading-tight">
                      {member.nickname}
                    </h2>
                    {member.username && (
                      <span className="text-xs font-mono text-navy-400 dark:text-slate-400" dir="ltr">@{member.username}</span>
                    )}
                  </div>

                  {/* الشارات المعتمدة */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${c.badgeBg} text-white font-cairo font-bold text-[10px]`}>
                      {isMale ? 'رجل' : 'امرأة'}
                    </span>
                    {isImported && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-lg text-[10px] font-cairo font-bold shadow-2xs" title="ملف مرفوع من قبل الإدارة">
                        📋 مرفوع من قبل الإدارة
                      </span>
                    )}
                    {member.verified && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-lg text-[10px] font-cairo font-bold shadow-2xs">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" /> موثّق
                      </span>
                    )}
                    {member.hasSeriousnessBadge && (
                      <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-cairo font-bold shadow-xs">
                        🏅 جاد
                      </span>
                    )}
                    {member.plan === 'gold' && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg text-[10px] font-cairo font-bold">
                        <Crown className="w-3 h-3 text-amber-500 fill-amber-500" /> ذهبي
                      </span>
                    )}
                    {(member.plan === 'elite' || (member.premium && member.plan !== 'gold')) && (
                      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-lg text-[10px] font-cairo font-bold">
                        ⭐ مميز
                      </span>
                    )}
                  </div>

                  {/* معلومات أساسية سريعة */}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-navy-700 dark:text-cream-200/80 font-tajawal">
                    <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gold-600" />{member.age ? `${member.age} سنة` : '—'}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gold-600" />{[member.city, member.country].filter(Boolean).join('، ') || 'الموقع غير محدد'}</span>
                    <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-gold-600" />{maritalFormatted}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* تنبيه وساطة الإدارة للملفات المرفوعة */}
            {isImported && (
              <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/50 rounded-2xl p-3.5 flex items-start gap-3 text-right shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-800 dark:text-amber-300 flex-shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-cairo font-bold text-xs text-amber-950 dark:text-amber-200 mb-0.5">
                    ملف وساطة مرفوع من قبل الإدارة
                  </h4>
                  <p className="font-tajawal text-xs text-amber-900/90 dark:text-amber-300/80 leading-relaxed">
                    تم رفع هذا الملف بواسطة وساطة وتنسيق الإدارة مع الخطابات. عند رغبتك بالتقدم، يتم التنسيق المباشر بإشراف فريق المنصة مع الخطابة المسؤولة لبحث التوافق والتوفيق بين الطرفين.
                  </p>
                </div>
              </div>
            )}

            {/* 1. المعلومات الأساسية والشخصية */}
            <div className="space-y-2">
              <h4 className="font-cairo font-bold text-xs sm:text-sm text-navy-900 dark:text-cream-100 flex items-center gap-1.5">
                <User className="w-4 h-4 text-amber-500" />
                <span>المعلومات الأساسية والشخصية:</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                <DetailGridItem icon={User} label="الجنس" value={member.gender === 'female' ? 'أنثى' : 'ذكر'} />
                {member.age ? <DetailGridItem icon={Calendar} label="العمر" value={`${member.age} سنة`} /> : null}
                {member.country && !['—', ''].includes(member.country) ? <DetailGridItem icon={MapPin} label="الدولة" value={normalizeNationality(member.country)} /> : null}
                {member.city && !['—', ''].includes(member.city) ? <DetailGridItem icon={MapPin} label="المدينة" value={member.city} /> : null}
                {member.district && !['—', 'غير ينطبق', ''].includes(member.district) ? <DetailGridItem icon={MapPin} label="الحي / المنطقة" value={member.district} /> : null}
                {member.nationality && !['—', ''].includes(member.nationality) ? <DetailGridItem icon={Globe} label="الجنسية" value={normalizeNationality(member.nationality)} /> : null}
                {member.sect && !['—', 'غير ينطبق', ''].includes(member.sect) ? <DetailGridItem icon={Church} label="المذهب" value={member.sect} /> : null}
                {member.tribe && !['—', 'غير ينطبق', ''].includes(member.tribe) ? (
                  <DetailGridItem icon={TreePine} label="القبيلة / النسب" value={member.tribe} />
                ) : null}
                {member.ethnicity && !['—', 'غير ينطبق', ''].includes(member.ethnicity) ? (
                  <DetailGridItem icon={Globe} label="العرق / الأصل" value={member.ethnicity} />
                ) : null}
              </div>
            </div>

            {/* 2. الحالة الاجتماعية والسكن والأبناء والتعدد */}
            <div className="space-y-2">
              <h4 className="font-cairo font-bold text-xs sm:text-sm text-navy-900 dark:text-cream-100 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-500" />
                <span>الحالة الاجتماعية والسكن والأبناء:</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                <DetailGridItem icon={Users} label="الحالة الاجتماعية" value={maritalFormatted} />
                {marriageTypeFormatted && !['غير ينطبق', '—', ''].includes(marriageTypeFormatted) && (
                  <DetailGridItem icon={Heart} label="نوع الزواج" value={marriageTypeFormatted} />
                )}
                {member.gender === 'male' && member.wifeCount && !['غير ينطبق', 'لا يوجد', 'لا يوجد (أعزب)', '—', '0', ''].includes(member.wifeCount) && ['married', 'متزوج'].includes(member.maritalStatus) && (
                  <DetailGridItem icon={Users} label="عدد الزوجات الحالي" value={member.wifeCount} />
                )}
                {member.gender === 'male' && member.seekingWife && !['غير ينطبق', '—', '', 'غير متعدد', 'زواج أول (غير متعدد)'].includes(member.seekingWife) && (
                  <DetailGridItem icon={Heart} label="التعدد / رغبة الزواج" value={member.seekingWife} />
                )}
                {(() => {
                  const isSingle = ['single', 'أعزب', 'عزباء'].includes(member.maritalStatus) || ['أعزب', 'عزباء'].includes(maritalFormatted);
                  if (member.hasChildren) {
                    return <DetailGridItem icon={Users} label="وجود أبناء" value="نعم" />;
                  }
                  if (!isSingle) {
                    return <DetailGridItem icon={Users} label="وجود أبناء" value="لا يوجد" />;
                  }
                  return null;
                })()}
                {member.hasChildren && member.childrenCount && !['لا يوجد', 'غير ينطبق', '—', '0', ''].includes(member.childrenCount) && (
                  <DetailGridItem icon={Baby} label="عدد الأبناء" value={member.childrenCount} />
                )}
                {member.hasChildren && member.childrenLiveWith && !['لا يوجد', 'غير ينطبق', '—', ''].includes(member.childrenLiveWith) && (
                  <DetailGridItem icon={Home} label="إقامة الأبناء" value={member.childrenLiveWith} />
                )}
                {member.housing && !['—', 'غير ينطبق', ''].includes(member.housing) && (
                  <DetailGridItem icon={Home} label="نوع السكن" value={member.housing} />
                )}
              </div>
            </div>

            {/* 3. التعليم والعمل */}
            {(member.education || member.workType || member.jobTitle) && (
              <div className="space-y-2">
                <h4 className="font-cairo font-bold text-xs sm:text-sm text-navy-900 dark:text-cream-100 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-blue-500" />
                  <span>التعليم والعمل:</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {member.education && !['—', ''].includes(member.education) ? <DetailGridItem icon={GraduationCap} label="المؤهل العلمي" value={member.education} /> : null}
                  {member.workType && !['—', ''].includes(member.workType) ? <DetailGridItem icon={Building2} label="جهة العمل" value={member.workType} /> : null}
                  {member.jobTitle && !['—', ''].includes(member.jobTitle) ? <DetailGridItem icon={Briefcase} label="المسمى الوظيفي" value={member.jobTitle} /> : null}
                </div>
              </div>
            )}

            {/* 4. المواصفات الجسدية والصحية */}
            {(member.height || member.weight || member.skinColor || member.health || member.smoking) && (
              <div className="space-y-2">
                <h4 className="font-cairo font-bold text-xs sm:text-sm text-navy-900 dark:text-cream-100 flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-purple-500" />
                  <span>المواصفات الجسدية والصحية:</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {member.height ? <DetailGridItem icon={Ruler} label="الطول" value={`${member.height} سم`} /> : null}
                  {member.weight ? <DetailGridItem icon={Weight} label="الوزن" value={`${member.weight} كجم`} /> : null}
                  {member.skinColor && !['—', ''].includes(member.skinColor) ? <DetailGridItem icon={Palette} label="لون البشرة" value={member.skinColor} /> : null}
                  {member.health && !['—', ''].includes(member.health) ? <DetailGridItem icon={Stethoscope} label="الحالة الصحية" value={member.health} /> : null}
                  {member.smoking && !['—', ''].includes(member.smoking) ? <DetailGridItem icon={Cigarette} label="التدخين" value={member.smoking} /> : null}
                </div>
              </div>
            )}

            {/* 5. نبذة عن العضو (عن نفسي) */}
            <div className="bg-white dark:bg-navy-800/60 rounded-2xl p-4 border border-cream-200 dark:border-navy-700/60 shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-gold-600 font-cairo font-bold text-xs sm:text-sm">
                <FileText className="w-4.5 h-4.5 text-gold-500" />
                <span>نبذة عن العضو (عن نفسي):</span>
              </div>
              <p className="text-xs sm:text-sm font-tajawal text-navy-800 dark:text-cream-100 leading-relaxed bg-cream-50/60 dark:bg-navy-950/40 p-3 rounded-xl border border-cream-100 dark:border-navy-800">
                {member.bio || 'لم يقم العضو بإضافة نبذة عن نفسه بعد.'}
              </p>
            </div>

            {/* 6. مواصفات الشريك المطلوب (أبحث عن) 🎯 - في الأسفل */}
            <div className="bg-white dark:bg-navy-800/70 rounded-2xl p-4 border border-rose-200/80 dark:border-rose-900/50 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-cairo font-bold text-xs sm:text-sm">
                  <Heart className="w-4.5 h-4.5 text-rose-500 fill-rose-100" />
                  <span>مواصفات الشريك المطلوب (أبحث عن):</span>
                </div>
                <span className="text-[10px] font-cairo font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-200/60">
                  المواصفات والشروط المطلوبة
                </span>
              </div>

              {/* الوسوم الشاملة والذكية لمواصفات الشريك مع خاصية التوسيع التفاعلي */}
              {partnerSummary.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {partnerSummary.tags.map((tag, tIdx) => (
                    <ExpandablePartnerTag key={`modal-tag-${tag.label}-${tIdx}`} tag={tag} />
                  ))}
                </div>
              )}

              {/* النص التفصيلي والملاحظات */}
              {partnerSummary.text ? (
                <p className="text-xs sm:text-sm font-tajawal text-navy-800 dark:text-cream-100 leading-relaxed bg-rose-50/40 dark:bg-navy-950/40 p-3 rounded-xl border border-rose-100 dark:border-navy-800">
                  {partnerSummary.text}
                </p>
              ) : partnerSummary.tags.length === 0 ? (
                <p className="text-xs font-tajawal text-navy-400 dark:text-slate-400 italic">
                  لم يحدد العضو مواصفات الشريك المطلوب بعد.
                </p>
              ) : null}
            </div>

            {/* 7. شريط الخصوصية والوساطة الشرعية (رسالة طمأنة وتوضيح في أسفل الملف) */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl p-3.5 border border-emerald-200/70 dark:border-emerald-800/50 flex items-start gap-2.5 shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-tajawal text-emerald-900 dark:text-emerald-200 leading-relaxed">
                <strong className="font-cairo font-bold block mb-0.5 text-emerald-950 dark:text-emerald-300">وساطة شرعية وسرية تامة:</strong>
                يتم التواصل والتوافق بخصوصية عالية تحت إشراف الإدارة، ولا تظهر بيانات الاتصال المباشرة إلا بإذن شرعي رسمي من الطرفين.
              </div>
            </div>

          </div>

          {/* ═══════════ شريط الإجراءات السفلي الذكي والمطور (STICKY ACTION BAR) ═══════════ */}
          <div className={`p-3 sm:p-4 border-t relative z-30 transition-colors ${
            isMale
              ? 'bg-[#e0f2fe] dark:bg-[#071322] border-sky-200 dark:border-sky-800/80'
              : 'bg-[#f4dbe3] dark:bg-[#1a050d] border-rose-200 dark:border-rose-900/80'
          }`}>
            <div className="flex items-center gap-2">
              {/* 1. الزر الأساسي: طلب التوافق أو إنشاء حساب أو متابعة الطلب */}
              <div className="flex-1 min-w-0">
                {!user?.isLoggedIn ? (
                  <button
                    onClick={() => {
                      showToast('أهلاً بك! يرجى إنشاء حسابك أو تسجيل الدخول لإرسال طلب التوافق', 'info');
                      onClose();
                      navigate('/register');
                    }}
                    className="w-full py-2.5 sm:py-3 px-3 rounded-2xl bg-gradient-to-r from-amber-500 via-gold-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-cairo font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4 -scale-x-100 text-slate-900" />
                    <span className="truncate">
                      إنشاء حساب لطلب التوافق 💌
                    </span>
                  </button>
                ) : latestRequest && latestRequest.journey_stage !== 'declined' && latestRequest.journey_stage !== 'cancelled' ? (
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/requests');
                    }}
                    className="w-full py-2.5 sm:py-3 px-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-cairo font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="truncate">
                      {latestRequest.journey_stage === 'sent' 
                        ? (isImported ? 'طلب الوساطة قيد المتابعة والتنسيق' : 'طلب التوافق قيد الانتظار (متابعة)')
                        : 'متابعة رحلة التوافق والوساطة'}
                    </span>
                  </button>
                ) : isImported ? (
                  <button
                    onClick={() => {
                      setContactOpen(!contactOpen);
                    }}
                    disabled={isSelf}
                    className="w-full py-2.5 sm:py-3 px-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:brightness-105 text-white font-cairo font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Building2 className="w-4.5 h-4.5 text-white" />
                    <span className="truncate">
                      طلب التوفيق والوساطة لهذا الملف 💍
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setContactOpen(!contactOpen);
                    }}
                    disabled={isSelf}
                    className="w-full py-2.5 sm:py-3 px-3 rounded-2xl bg-gradient-to-r from-amber-500 via-gold-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-cairo font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 -scale-x-100 text-slate-900" />
                    <span className="truncate">
                      إرسال طلب توافق للزواج 💌
                    </span>
                  </button>
                )}
              </div>

              {/* 2. زر الواتساب للتوفيق والوساطة */}
              <button
                onClick={handleShareWhatsApp}
                className="py-2.5 sm:py-3 px-3 sm:px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs flex-shrink-0"
                title="تواصل واتساب للتوفيق والوساطة مع هذا الملف"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span className="inline">{!user?.isLoggedIn ? 'تواصل واتساب للتوفيق 💬' : 'واتساب للتوفيق 💬'}</span>
              </button>

              {/* 3. زر المفضلة التفاعلي */}
              <button
                onClick={() => {
                  if (!user?.isLoggedIn) {
                    showToast('يرجى تسجيل الدخول لحفظ العضو في المفضلة', 'info');
                    onClose();
                    navigate('/login');
                    return;
                  }
                  toggleLike(member.id);
                }}
                className={`py-2.5 sm:py-3 px-3 rounded-2xl font-cairo font-bold text-xs transition-all flex items-center justify-center gap-1.5 border cursor-pointer flex-shrink-0 shadow-xs ${
                  liked
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white dark:bg-navy-900 text-navy-700 dark:text-cream-100 border-cream-300 dark:border-navy-700 hover:bg-cream-50'
                }`}
                title={liked ? 'إزالة من المحفوظات' : 'حفظ في المفضلة'}
              >
                <Bookmark className={`w-4 h-4 ${liked ? 'fill-white' : ''}`} />
                <span className="hidden sm:inline">{liked ? 'محفوظ' : 'حفظ'}</span>
              </button>

              {/* 4. قائمة الخيارات الإضافية والأمان المنسدلة (...) */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white dark:bg-navy-900 hover:bg-cream-100 dark:hover:bg-navy-800 text-navy-700 dark:text-cream-100 border border-cream-300 dark:border-navy-700 transition-colors flex items-center justify-center cursor-pointer shadow-xs"
                  title="خيارات إضافية"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* القائمة المنسدلة */}
                <AnimatePresence>
                  {moreMenuOpen && (
                    <motion.div
                      key="modal-more-menu-dropdown"
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute left-0 bottom-full mb-2 w-52 bg-white dark:bg-navy-900 rounded-2xl shadow-xl border border-cream-200 dark:border-navy-700 p-1.5 z-50 space-y-1 text-right"
                    >
                      {/* نسخ بيانات العضو */}
                      <button
                        onClick={() => {
                          setMoreMenuOpen(false);
                          handleCopyMemberData();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-cairo font-bold text-navy-800 dark:text-cream-100 hover:bg-cream-50 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                      >
                        <Copy className="w-4 h-4 text-amber-600" />
                        <span>نسخ كافة بيانات العضو</span>
                      </button>

                      {/* نسخ رابط الملف */}
                      <button
                        onClick={() => {
                          setMoreMenuOpen(false);
                          handleCopyLink();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-cairo font-bold text-navy-800 dark:text-cream-100 hover:bg-cream-50 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                      >
                        <Share2 className="w-4 h-4 text-blue-500" />
                        <span>نسخ رابط الملف</span>
                      </button>

                      {/* حظر العضو */}
                      {user?.isLoggedIn && !isSelf && (
                        <button
                          onClick={() => {
                            setMoreMenuOpen(false);
                            toggleBlock(member.id);
                            showToast(isBlocked ? 'تم إلغاء حظر العضو' : 'تم حظر العضو بنجاح', isBlocked ? 'info' : 'warning');
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-cairo font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                        >
                          <Ban className="w-4 h-4 text-slate-500" />
                          <span>{isBlocked ? 'إلغاء حظر العضو' : 'حظر العضو'}</span>
                        </button>
                      )}

                      {/* إبلاغ الإدارة */}
                      {user?.isLoggedIn && !isSelf && (
                        <button
                          onClick={() => {
                            setMoreMenuOpen(false);
                            setReportOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-cairo font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer border-t border-cream-100 dark:border-navy-800 pt-2"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                          <span>إبلاغ الإدارة عن العضو</span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {moreMenuOpen && (
                  <div key="modal-more-menu-backdrop" className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════════ نافذة منبثقة لطلب التوافق أو التوفيق والوساطة (POPUP MODAL) ═══════════ */}
      <AnimatePresence>
        {contactOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            {/* الخلفية المظلمة */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setContactOpen(false)}
              className="fixed inset-0 bg-navy-950/75 backdrop-blur-xs z-[120]"
            />

            {/* بطاقة النافذة المنبثقة في المنتصف */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative w-full max-w-lg bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-cream-200 dark:border-navy-700 z-[121] overflow-hidden flex flex-col my-auto max-h-[92vh] text-right"
              dir="rtl"
            >
              {/* ترويسة النافذة المنبثقة */}
              <div className={`px-5 py-4 border-b flex items-center justify-between ${
                isImported
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white'
                  : 'bg-gradient-to-r from-amber-500 via-gold-500 to-amber-600 text-slate-950'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center flex-shrink-0">
                    {isImported ? <Building2 className="w-5 h-5 text-white" /> : <Send className="w-5 h-5 -scale-x-100 text-slate-950" />}
                  </div>
                  <div>
                    <h3 className="font-cairo font-black text-sm sm:text-base leading-tight truncate">
                      {isImported ? 'طلب التوفيق والوساطة لهذا الملف' : 'إرسال طلب توافق للزواج'}
                    </h3>
                    <p className={`text-[11px] font-tajawal ${isImported ? 'text-emerald-100' : 'text-slate-800'}`}>
                      {isImported ? 'إشراف مباشر من إدارة المنصة والخطابات' : 'تواصل شرعي ومباشر بين الطرفين'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setContactOpen(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    isImported ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-black/10 hover:bg-black/20 text-slate-900'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* جسم النافذة المنبثقة (Scrollable) */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
                {/* ملخص بطاقة العضو المصغرة */}
                <div className={`p-3 rounded-2xl border flex items-center gap-3 ${
                  isMale 
                    ? 'bg-sky-50/70 dark:bg-navy-800/80 border-sky-200/80 dark:border-sky-800 text-sky-950 dark:text-sky-100'
                    : 'bg-rose-50/70 dark:bg-navy-800/80 border-rose-200/80 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                }`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border ${
                    isMale ? 'border-sky-300 dark:border-sky-700 bg-sky-100 dark:bg-navy-700' : 'border-rose-300 dark:border-rose-700 bg-rose-100 dark:bg-navy-700'
                  }`}>
                    <img src={avatar} alt="" className="w-full h-full object-contain p-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-cairo font-bold text-sm truncate text-navy-900 dark:text-cream-50">{member.nickname}</span>
                      {member.username && <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">@{member.username}</span>}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-tajawal flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span>{member.age} سنة</span>
                      <span>•</span>
                      <span>{member.city}</span>
                      <span>•</span>
                      <span>{maritalFormatted}</span>
                    </div>
                  </div>
                </div>

                {/* تنبيه خاص للملفات المستوردة المرفوعة من الإدارة */}
                {isImported && (
                  <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-tajawal text-emerald-900 dark:text-emerald-200 leading-relaxed">
                      💡 سيتم تسجيل هذا الطلب رسمياً في حسابك ولدى إدارة المنصة لبدء التنسيق الشرعي مع الخطابة المسؤولة وصاحب الملف لبحث التوافق والتوفيق.
                    </p>
                  </div>
                )}

                {/* اختيار قالب رسالة سريع */}
                <div className="space-y-1.5">
                  <span className="text-xs font-cairo font-bold text-navy-800 dark:text-cream-100 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                    <span>اختر قالباً جاهزاً للرسالة أو اكتب نصك الخاص:</span>
                  </span>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {(isImported
                      ? [
                          'السلام عليكم ورحمة الله، اطلعت على هذا الملف المرفوع عبر الإدارة، وأرغب في التقدم وطلب التوفيق والوساطة للتواصل مع الطرف الآخر/الخطابة لبحث التوافق.',
                          'السلام عليكم، أرغب في التقدّم الجاد لطلب التوافق مع هذا الملف المبارك عبر وساطة المنصة.',
                          'تحية طيبة، أرجو تزويدي بمزيد من التفاصيل حول هذا الملف لبحث التوافق الشرعي والتنسيق مع الخطابة.',
                        ]
                      : MESSAGE_TEMPLATES
                    ).map((tpl, i) => (
                      <button
                        key={`modal-contact-tpl-${i}`}
                        type="button"
                        onClick={() => setContactMsg(tpl)}
                        className={`text-right text-xs font-tajawal p-2.5 rounded-xl border transition-all cursor-pointer leading-relaxed ${
                          contactMsg === tpl
                            ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-200 font-bold shadow-xs'
                            : 'bg-cream-50 dark:bg-navy-800/60 border-cream-200 dark:border-navy-700 text-navy-800 dark:text-cream-100 hover:bg-cream-100 dark:hover:bg-navy-800'
                        }`}
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* حقل كتابة الرسالة المخصصة */}
                <div className="space-y-1">
                  <label className="text-xs font-cairo font-semibold text-slate-700 dark:text-slate-300">
                    نص الرسالة أو الملاحظات:
                  </label>
                  <textarea
                    value={contactMsg}
                    onChange={(e) => setContactMsg(e.target.value)}
                    rows={3}
                    placeholder={isImported ? 'اكتب ملاحظاتك أو تفاصيل طلب التوفيق للإدارة...' : 'اكتب رسالة اهتمام مخصصة للشريك...'}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-cream-50 dark:bg-navy-950 border border-cream-300 dark:border-navy-700 font-tajawal text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:text-cream-50 transition-all"
                  />
                </div>
              </div>

              {/* أزرار الإجراءات السفلية في النافذة المنبثقة */}
              <div className="p-4 bg-cream-50 dark:bg-navy-950/80 border-t border-cream-200 dark:border-navy-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendInterest}
                  disabled={sending}
                  className={`flex-1 py-3 px-4 rounded-2xl font-cairo font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    isImported
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white hover:brightness-105'
                      : 'bg-gradient-to-r from-amber-500 via-gold-500 to-amber-600 text-slate-950 hover:brightness-105'
                  }`}
                >
                  {isImported ? <Building2 className="w-4 h-4 text-white" /> : <Send className="w-4 h-4 -scale-x-100" />}
                  <span>{sending ? 'جاري إرسال الطلب...' : isImported ? 'تأكيد إرسال طلب التوفيق والوساطة 💍' : 'تأكيد إرسال طلب التوافق 💌'}</span>
                </button>

                {isImported && (
                  <button
                    type="button"
                    onClick={() => {
                      setContactOpen(false);
                      setWhatsAppModalOpen(true);
                    }}
                    className="py-3 px-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="تنسيق عبر واتساب"
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span className="hidden sm:inline">واتساب</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setContactOpen(false)}
                  className="py-3 px-3.5 rounded-2xl bg-white dark:bg-navy-800 hover:bg-cream-100 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 font-cairo font-bold text-xs border border-cream-300 dark:border-navy-700 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════ نافذة منبثقة لإبلاغ الإدارة (REPORT POPUP MODAL) ═══════════ */}
      <AnimatePresence>
        {reportOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReportOpen(false)}
              className="fixed inset-0 bg-navy-950/75 backdrop-blur-xs z-[120]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-navy-700 z-[121] overflow-hidden flex flex-col my-auto text-right"
              dir="rtl"
            >
              <div className="px-5 py-4 bg-rose-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-white" />
                  <h3 className="font-cairo font-black text-sm sm:text-base">إبلاغ الإدارة عن العضو</h3>
                </div>
                <button
                  onClick={() => setReportOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-3">
                <p className="text-xs font-tajawal text-slate-600 dark:text-slate-300">
                  يرجى توضيح سبب البلاغ بدقة لمراجعة الملف من قِبل فريق الرقابة والأمان:
                </p>

                <div className="space-y-1.5">
                  {['بيانات غير صحيحة أو منتحلة', 'سلوك غير لائق أو مخالف للضوابط الشرعية', 'طلب أموال أو وسائل دفع خارج المنصة', 'عدم الجدية في الزواج'].map((reason, idx) => (
                    <button
                      key={`report-r-${idx}`}
                      type="button"
                      onClick={() => setReportReason(reason)}
                      className={`w-full text-right text-xs font-tajawal p-2.5 rounded-xl border transition-colors cursor-pointer ${
                        reportReason === reason
                          ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-400 text-rose-900 dark:text-rose-200 font-bold'
                          : 'bg-cream-50 dark:bg-navy-800/60 border-cream-200 dark:border-navy-700 text-navy-800 dark:text-cream-100 hover:bg-cream-100'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  rows={2}
                  placeholder="أو اكتب تفاصيل البلاغ هنا..."
                  className="w-full px-3.5 py-2 rounded-xl bg-cream-50 dark:bg-navy-950 border border-cream-300 dark:border-navy-700 font-tajawal text-xs focus:outline-none focus:border-rose-500 dark:text-cream-50"
                />
              </div>

              <div className="p-4 bg-cream-50 dark:bg-navy-950/80 border-t border-cream-200 dark:border-navy-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReportSubmit}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-cairo font-bold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  تأكيد إرسال البلاغ ⚠️
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="py-2.5 px-3.5 rounded-xl bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-cairo font-bold text-xs border border-cream-300 dark:border-navy-700 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة خيارات وإرسال رسالة الواتساب */}
      <WhatsAppShareModal
        open={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        member={member}
      />
    </>
  );
}

// عنصر الخلية الصغيرة في قائمة التفاصيل
function DetailGridItem({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="bg-cream-50/80 dark:bg-navy-950/60 rounded-xl p-1.5 sm:p-2 border border-cream-200/70 dark:border-navy-800 flex items-start gap-1.5 min-w-0 shadow-2xs">
      <Icon className="w-3.5 h-3.5 text-gold-600 dark:text-gold-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="block text-[9px] sm:text-[9.5px] text-navy-400 dark:text-slate-400 font-tajawal leading-none mb-0.5 truncate">{label}</span>
        <span className="block text-[11px] sm:text-xs font-cairo font-bold text-navy-900 dark:text-cream-50 truncate" title={String(value)}>{value}</span>
      </div>
    </div>
  );
}

// دالة تفكيك عناصر الوسم المتعددة (مثل المدن، الدول، الجنسيات، الحالات)
function parseTagItems(value: string, label: string): string[] {
  if (!value) return [];
  const trimmed = String(value).trim();
  
  // لا نقسم النطاقات العمرية أو النصوص المركبة الخاصة
  if (label === 'العمر' || (trimmed.includes(' - ') && !trimmed.includes('،') && !trimmed.includes(','))) {
    return [trimmed];
  }
  if (trimmed.startsWith('يقبل أجنبي') || trimmed.startsWith('نفس الجنسية') || trimmed === 'مواطن فقط' || trimmed === 'يقبل الجميع') {
    return [trimmed];
  }

  // التقسيم بالفواصل العربية والإنجليزية والشرطات
  const splitItems = trimmed
    .split(/[،,]| \/ | \+ /)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s !== '—' && s !== '-');

  return splitItems.length > 0 ? splitItems : [trimmed];
}

// وسم مواصفات الشريك الذكي القابل للتوسيع عند وجود أكثر من قيمة
function ExpandablePartnerTag({ tag }: { tag: { label: string; value: string } }) {
  const [expanded, setExpanded] = useState(false);
  const items = useMemo(() => parseTagItems(tag.value, tag.label), [tag.value, tag.label]);

  if (items.length <= 1) {
    return (
      <span className="bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 px-2.5 py-1 rounded-lg text-xs font-cairo font-bold border border-rose-200/80 dark:border-rose-800/60 shadow-2xs">
        {tag.label}: {tag.value}
      </span>
    );
  }

  if (!expanded) {
    const extraCount = items.length - 1;
    return (
      <div className="inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 py-1 px-2.5 rounded-lg text-xs font-cairo font-bold border border-rose-200/80 dark:border-rose-800/60 shadow-2xs">
        <span>{tag.label}: {items[0]}</span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1 bg-rose-200/90 dark:bg-rose-900/90 hover:bg-rose-300 dark:hover:bg-rose-800 text-rose-900 dark:text-rose-100 px-2 py-0.5 rounded-md text-[10px] font-cairo font-black transition-all cursor-pointer shadow-2xs"
          title={`عرض بقية ${tag.label} (${extraCount} إضافية)`}
        >
          <span>+{extraCount} أخرى</span>
          <ChevronDown className="w-3 h-3 text-rose-700 dark:text-rose-300" />
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full flex flex-col gap-1.5 p-2.5 rounded-xl bg-gradient-to-r from-rose-50 via-pink-50/50 to-rose-50 dark:from-rose-950/80 dark:to-navy-900 border border-rose-300 dark:border-rose-800 shadow-xs my-0.5"
    >
      <div className="flex items-center justify-between text-xs font-cairo font-bold text-rose-900 dark:text-rose-200">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span>{tag.label} المطلوبة ({items.length}):</span>
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="inline-flex items-center gap-1 text-[11px] font-cairo font-bold text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100 bg-white/80 dark:bg-navy-800 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800/80 cursor-pointer shadow-2xs"
        >
          <span>عرض أقل</span>
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {items.map((it, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 bg-white dark:bg-navy-900 text-rose-950 dark:text-rose-100 px-2.5 py-1 rounded-lg text-xs font-cairo font-bold border border-rose-200/90 dark:border-rose-800 shadow-2xs"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            {it}
          </span>
        ))}
      </div>
    </motion.div>
  );
}


