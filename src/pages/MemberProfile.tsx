import { useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Briefcase, GraduationCap, Ruler, Heart, Bookmark,
  ShieldCheck, Calendar, Users, Globe, Send, ArrowRight,
  Home, Scale, Cigarette, Weight, Palette, Sparkles, AlertTriangle,
  FileText, User, Copy, MessageCircle, Share2, Clock,
  Crown, Check, ChevronDown, ChevronUp, Star, Zap, Eye, EyeOff,
  TrendingUp, Award, BadgeCheck, Lock, Baby, Building2, Church,
  Dumbbell, Stethoscope, TreePine, Ban, MoreVertical, CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { getMemberById } from '../lib/data';
import { useApp } from '../lib/AppContext';
import { getAvatar, getGenderColors } from '../lib/types';
import { formatMaritalStatus, getPartnerSummary } from '../lib/memberUtils';
import { getCurrentUserId, createInterestRequest, useInterestRequests } from '../lib/useInterestRequests';
import { normalizeNationality } from '../lib/data/optionNormalizer';
import WhatsAppShareModal from '../components/WhatsAppShareModal';

const MESSAGE_TEMPLATES = [
  'السلام عليكم ورحمة الله، لفت انتباهي توافق ملفنا وأتمنى التوفيق لنا.',
  'مرحبًا، أرى توافقًا في القيم والأهداف وأرغب بالتوافق الجاد للزواج بإذن الله.',
  'السلام عليكم، ملفك أعجبني وأبحث عن شريك بصفات مشابهة، أتمنى التواصل.',
  'تحية طيبة، لاحظت توافقًا في المواصفات وأرغب في التقدم عبر الإدارة.',
];

// ===== Collapsible Section Component =====
function CollapsibleSection({
  title, icon: Icon, gradient, children, defaultOpen = true, badge,
}: {
  title: string;
  icon: any;
  gradient: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden transition-all duration-300">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
            <Icon className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="font-cairo font-bold text-navy-900 text-sm">{title}</h3>
          {badge && (
            <span className="text-[10px] font-cairo font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-slate-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-slate-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Info Grid Item =====
function InfoItem({ icon: Icon, label, value, color = 'slate' }: {
  icon: any; label: string; value: string | number | undefined | null; color?: string;
}) {
  if (!value && value !== 0) return null;
  const colorMap: Record<string, string> = {
    slate: 'from-slate-500 to-slate-600',
    blue: 'from-blue-500 to-indigo-600',
    emerald: 'from-emerald-500 to-teal-600',
    purple: 'from-purple-500 to-violet-600',
    rose: 'from-rose-500 to-pink-600',
    amber: 'from-amber-500 to-orange-600',
    navy: 'from-slate-700 to-slate-800',
  };
  return (
    <div className="group flex items-center gap-2.5 bg-slate-50/80 rounded-xl px-3 py-2.5 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all">
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colorMap[color] || colorMap.slate} flex items-center justify-center flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity`}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-400 font-tajawal leading-none mb-0.5">{label}</p>
        <p className="font-cairo font-bold text-navy-900 text-xs truncate">{value}</p>
      </div>
    </div>
  );
}

export default function MemberProfile() {
  const { id, username } = useParams();
  const navigate = useNavigate();
  const {
    likedMembers, toggleLike, user, showToast, checkLimit, incrementUsage,
    sendInterestRequest, interestPurchaseSettings,
    buyExtraInterests, submitReport, members, adminMembers,
    blockedMembers, toggleBlock,
  } = useApp();

  const member = useMemo(() => {
    const key = id || username;
    if (!key) return undefined;
    const found = members.find((m) => m.id === key || m.username?.toLowerCase() === key.toLowerCase());
    if (found) return found;

    // البحث الاحتياطي في قائمة الأعضاء المدارة من الإدارة (سواء كانوا معلقين أو مستوردين)
    if (adminMembers) {
      const adminFound = adminMembers.find((m) => m.id === key || m.nickname?.toLowerCase() === key.toLowerCase() || m.username?.toLowerCase() === key.toLowerCase());
      if (adminFound) {
        return {
          ...adminFound,
          status: adminFound.status || 'active', // معاملته كنشط لأغراض العرض العام في صفحة الحساب
        } as any;
      }
    }

    const staticFound = getMemberById(key);
    if (staticFound) return staticFound;
    return members.find((m) => m.username?.toLowerCase() === key.toLowerCase());
  }, [id, username, members, adminMembers]);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactMsg, setContactMsg] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [stickyMoreMenuOpen, setStickyMoreMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showAllBasic, setShowAllBasic] = useState(true);
  const [showAllPersonal, setShowAllPersonal] = useState(true);
  const [showAllWork, setShowAllWork] = useState(true);
  const [showAllPartner, setShowAllPartner] = useState(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 200);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ملاحظة مهمة (إصلاح خطأ React #310 "hooks count mismatch"):
  // نستدعي كل الخطّافات هنا بلا شرط قبل أي return مبكر، لأن `members` تُحمَّل بشكل غير متزامن
  // من الخادم — فقد يكون `member` غير معرَّف في أول تصيير (render) ثم يصبح معرَّفاً بعد اكتمال
  // الجلب، مما يُغيّر عدد الخطّافات المستدعاة بين التصييرات لو كانت هذه الخطّافات بعد return مبكر.
  const currentUserId = user?.isLoggedIn ? (user.memberId || getCurrentUserId()) : '';
  const { requests } = useInterestRequests(currentUserId);

  const latestRequest = useMemo(() => {
    if (!user?.isLoggedIn || !requests || requests.length === 0 || !member?.id || !currentUserId) return null;
    const sent = requests.filter(r => r.sender_id === currentUserId && r.receiver_id === member.id);
    if (sent.length === 0) return null;
    return [...sent].sort((a, b) => b.id - a.id)[0];
  }, [requests, currentUserId, member?.id, user?.isLoggedIn]);

  if (!member) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <User className="w-10 h-10 text-slate-300" />
        </div>
        <h2 className="font-cairo font-bold text-2xl text-navy-900 mb-2">العضو غير موجود</h2>
        <p className="text-slate-500 font-tajawal mb-4">قد يكون الحساب محذوفاً أو غير متاح</p>
        <Button onClick={() => navigate('/search')} className="mt-2">العودة للبحث</Button>
      </div>
    );
  }

  const liked = user?.isLoggedIn ? likedMembers.has(member.id) : false;
  const isBlocked = user?.isLoggedIn ? blockedMembers.has(member.id) : false;
  const isSelf = Boolean(user?.isLoggedIn && currentUserId && member.id === currentUserId);

  const avatar = getAvatar(member.gender);
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
  const remainingRequests = limitCheck.allowed ? limitCheck.max - limitCheck.current : 0;

  const accentGradient = isMale ? 'from-blue-500 to-indigo-600' : 'from-rose-500 to-pink-600';
  const heroGradient = isMale ? 'from-slate-800 via-blue-900 to-indigo-900' : 'from-slate-800 via-rose-900 to-pink-900';

  const handleCopyLink = () => {
    const profileUrl = member.username 
      ? `${window.location.origin}/u/${member.username}` 
      : `${window.location.origin}/member/${member.id}`;
      
    navigator.clipboard.writeText(profileUrl)
      .then(() => showToast('تم نسخ رابط الملف الشخصي ✓', 'success'))
      .catch(() => showToast('تعذّر النسخ', 'error'));
  };

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

  const handleShareWhatsApp = () => {
    setWhatsAppModalOpen(true);
  };

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white min-h-screen pb-24">
      {/* ═══════════ HERO HEADER ═══════════ */}
      <div className={`relative overflow-hidden border-b transition-colors rounded-b-3xl ${
        isMale
          ? 'bg-gradient-to-br from-sky-50 via-blue-50/50 to-white dark:from-sky-950/40 dark:to-navy-900 border-sky-200/80 dark:border-sky-800/40'
          : 'bg-gradient-to-br from-[#4a1224]/10 via-rose-50/60 to-white dark:from-[#3a0d1c]/40 dark:to-navy-900 border-rose-200/80 dark:border-rose-900/50'
      }`}>
        {/* Decorative shapes */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500 rounded-full translate-y-1/2 -translate-x-1/4" />
        </div>

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 pt-4">
          <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-all border border-slate-200 shadow-sm" title="رجوع">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={handleShareWhatsApp} className="h-9 w-9 rounded-xl bg-white flex items-center justify-center text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-slate-200 shadow-sm" title="مشاركة واتساب">
              <Share2 className="w-4 h-4" />
            </button>
            <button onClick={handleCopyLink} className="h-9 w-9 rounded-xl bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all border border-slate-200 shadow-sm" title="نسخ الرابط">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main hero content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-6">
          <div className="flex items-center justify-between gap-4 w-full">
            {/* Right side: Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-0.5 border-2 ${isMale ? 'border-sky-500/60' : 'border-rose-500/60'} shadow-sm`}>
                <div className="w-full h-full rounded-[12px] bg-white flex items-center justify-center overflow-hidden">
                  <img src={avatar} alt="" className="w-full h-full object-contain p-2" />
                </div>
              </div>
              {member.verified && (
                <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </span>
              )}
            </div>

            {/* Center: Name + Info */}
            <div className="flex-1 min-w-0 text-right space-y-1.5">
              <div className="flex items-center gap-2 justify-start mb-1 flex-wrap">
                <h1 className="font-cairo font-extrabold text-lg sm:text-2xl text-slate-900 leading-none">{member.nickname}</h1>
                {(member.plan === 'elite' || (member.premium && member.plan !== 'gold')) && (
                  <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 shadow-sm font-cairo font-extrabold text-[10px] sm:text-xs" title="الباقة المميزة">
                    <span>⭐ مميز</span>
                  </span>
                )}
                {member.plan === 'gold' && (
                  <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 shadow-sm font-cairo font-extrabold text-[10px] sm:text-xs" title="الباقة الذهبية">
                    <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>ذهبي</span>
                  </span>
                )}
              </div>

              {member.username && (
                <div className="text-xs text-slate-500 font-mono tracking-wide select-all pb-1 flex items-center gap-1 justify-start" dir="ltr">
                  <span className="text-slate-400">@</span>
                  <span className="font-semibold text-slate-600">{member.username}</span>
                </div>
              )}

              {/* Badges */}
              <div className="flex items-center gap-1.5 justify-start flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-white text-[11px] font-cairo font-bold ${isMale ? 'bg-sky-600' : 'bg-rose-600'}`}>
                  {isMale ? 'رجل' : 'امرأة'}
                </span>
                {isImported && (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-0.5 rounded-lg text-[11px] font-cairo font-bold shadow-2xs" title="ملف مرفوع من قبل الإدارة">
                    📋 مرفوع من قبل الإدارة
                  </span>
                )}
                {member.verified && (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-cairo font-bold shadow-2xs">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> موثّق
                  </span>
                )}
                {member.hasSeriousnessBadge && (
                  <span className="inline-flex items-center gap-1 bg-gradient-to-l from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-lg text-[11px] font-cairo font-bold shadow-sm">
                    🏅 جاد
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="flex items-center gap-2 sm:gap-3.5 justify-start flex-wrap text-slate-600 text-[11px] sm:text-xs font-tajawal">
                <span className="flex items-center gap-1 text-slate-700"><Calendar className="w-3.5 h-3.5 text-slate-400" />{member.age ? `${member.age} سنة` : '—'}</span>
                <span className="flex items-center gap-1 text-slate-700"><Users className="w-3.5 h-3.5 text-slate-400" />{maritalFormatted}</span>
                <span className="flex items-center gap-1 text-slate-700"><MapPin className="w-3.5 h-3.5 text-slate-400" />{[member.city, member.country].filter(Boolean).join('، ') || 'الموقع غير محدد'}</span>
                {member.jobTitle && <span className="flex items-center gap-1 text-slate-700"><Briefcase className="w-3.5 h-3.5 text-slate-400" />{member.jobTitle}</span>}
              </div>
            </div>


          </div>
        </div>
      </div>

      {/* ═══════════ ACTION BUTTONS BAR (شريط الإجراءات الأساسي) ═══════════ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-5 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl shadow-lg border border-slate-200/80 p-3.5 sm:p-4"
        >
          {!isSelf ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* 1. الزر الأساسي: طلب التوافق أو إنشاء حساب أو متابعة الطلب */}
              <div className="flex-1 min-w-0">
                {!user.isLoggedIn ? (
                  <button
                    onClick={() => {
                      showToast('أهلاً بك! يرجى إنشاء حسابك أو تسجيل الدخول لإرسال طلب التوافق', 'info');
                      navigate('/register');
                    }}
                    className="w-full py-3 sm:py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-gold-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-cairo font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4 -scale-x-100 text-slate-900" />
                    <span className="truncate">
                      إنشاء حساب لطلب التوافق 💌
                    </span>
                  </button>
                ) : latestRequest && latestRequest.journey_stage !== 'declined' && latestRequest.journey_stage !== 'cancelled' ? (
                  <button
                    onClick={() => navigate('/requests')}
                    className="w-full py-3 sm:py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-cairo font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                    onClick={() => setContactOpen(true)}
                    className="w-full py-3 sm:py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:brightness-105 text-white font-cairo font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Building2 className="w-4.5 h-4.5 text-white" />
                    <span className="truncate">طلب التوفيق والوساطة لهذا الملف 💍</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setContactOpen(true)}
                    className="w-full py-3 sm:py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-gold-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-cairo font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4 -scale-x-100 text-slate-900" />
                    <span className="truncate">
                      إرسال طلب توافق للزواج 💌
                    </span>
                  </button>
                )}
              </div>

              {/* 2. زر الواتساب للمشاركة والاستفسار */}
              <button
                onClick={handleShareWhatsApp}
                className="py-3 sm:py-3.5 px-3.5 sm:px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs flex-shrink-0"
                title="تواصل واتساب للتوفيق مع هذا الملف"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span className="inline">{!user.isLoggedIn ? 'تواصل واتساب للتوفيق 💬' : 'واتساب للتوفيق 💬'}</span>
              </button>

              {/* 3. زر المفضلة التفاعلي */}
              <button
                onClick={() => {
                  if (!user.isLoggedIn) {
                    showToast('يرجى تسجيل الدخول لإضافة الأعضاء إلى المفضلة', 'info');
                    navigate('/login');
                    return;
                  }
                  toggleLike(member.id);
                }}
                className={`py-3 sm:py-3.5 px-3.5 sm:px-4 rounded-2xl font-cairo font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 border cursor-pointer flex-shrink-0 shadow-xs ${
                  liked
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title={liked ? 'إزالة من المحفوظات' : 'حفظ بالمفضلة'}
              >
                <Bookmark className={`w-4 h-4 ${liked ? 'fill-white' : ''}`} />
                <span className="hidden sm:inline">{liked ? 'محفوظ' : 'حفظ'}</span>
              </button>

              {/* 4. قائمة الإجراءات الإضافية والأمان (...) */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors flex items-center justify-center cursor-pointer shadow-xs"
                  title="خيارات إضافية"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* القائمة المنسدلة */}
                <AnimatePresence>
                  {moreMenuOpen && (
                    <motion.div
                      key="profile-more-menu-dropdown"
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute left-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 space-y-1 text-right"
                    >
                      {/* نسخ بيانات العضو */}
                      <button
                        onClick={() => {
                          setMoreMenuOpen(false);
                          handleCopyMemberData();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-cairo font-bold text-slate-800 hover:bg-amber-50 hover:text-amber-900 transition-colors cursor-pointer"
                      >
                        <Copy className="w-4 h-4 text-amber-600" />
                        <span>نسخ كافة بيانات العضو 📋</span>
                      </button>

                      {/* نسخ رابط الملف */}
                      <button
                        onClick={() => {
                          setMoreMenuOpen(false);
                          handleCopyLink();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-cairo font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-900 transition-colors cursor-pointer"
                      >
                        <Share2 className="w-4 h-4 text-blue-500" />
                        <span>نسخ رابط الملف</span>
                      </button>

                      {/* حظر العضو */}
                      {user.isLoggedIn && (
                        <button
                          onClick={() => {
                            setMoreMenuOpen(false);
                            toggleBlock(member.id);
                            showToast(isBlocked ? 'تم إلغاء حظر العضو' : 'تم حظر العضو بنجاح', isBlocked ? 'info' : 'warning');
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-cairo font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Ban className="w-4 h-4 text-slate-500" />
                          <span>{isBlocked ? 'إلغاء حظر العضو' : 'حظر العضو'}</span>
                        </button>
                      )}

                      {/* إبلاغ عن العضو */}
                      {user.isLoggedIn && (
                        <button
                          onClick={() => {
                            setMoreMenuOpen(false);
                            setReportOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-cairo font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                          <span>إبلاغ عن العضو ⚠️</span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {moreMenuOpen && (
                  <div key="profile-more-menu-backdrop" className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 text-center py-2">
              <p className="font-cairo font-bold text-slate-700 text-sm flex items-center justify-center gap-2">
                <User className="w-4 h-4" /> هذا حسابك — يمكنك <button onClick={() => navigate('/edit-profile')} className="text-blue-600 underline cursor-pointer">تعديل ملفك</button>
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">
        {isImported && (
          <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 mb-5 flex items-start gap-3.5 text-right shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 flex-shrink-0 mt-0.5">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-cairo font-bold text-xs sm:text-sm text-amber-950 mb-0.5">
                ملف وساطة مرفوع من قبل الإدارة
              </h4>
              <p className="font-tajawal text-xs sm:text-[13px] text-amber-900/90 leading-relaxed">
                تم رفع هذا الملف بواسطة وساطة وتنسيق الإدارة مع الخطابات. عند رغبتك بالتقدم وطلب التوفيق، يتم التنسيق والتواصل المباشر بإشراف فريق المنصة مع الخطابة المسؤولة لبحث التوافق والتوفيق بين الطرفين.
              </p>
            </div>
          </div>
        )}
        <div className="grid lg:grid-cols-3 gap-5">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-4">

          {/* 1. ── Basic Info Grid (المعلومات الأساسية والشخصية) ── */}
          <CollapsibleSection title="المعلومات الأساسية والشخصية" icon={User} gradient="from-amber-500 to-orange-600" defaultOpen={true}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-3">
              <InfoItem icon={User} label="الجنس" value={member.gender === 'female' ? 'أنثى' : 'ذكر'} color="blue" />
              <InfoItem icon={Calendar} label="العمر" value={member.age ? `${member.age} سنة` : '—'} color="blue" />
              <InfoItem icon={Globe} label="الدولة" value={normalizeNationality(member.country)} color="blue" />
              <InfoItem icon={MapPin} label="المدينة" value={member.city} color="emerald" />
              <InfoItem icon={MapPin} label="الحي / المنطقة" value={member.district} color="emerald" />
              <InfoItem icon={Globe} label="الجنسية" value={normalizeNationality(member.nationality)} color="navy" />
              <InfoItem icon={Church} label="المذهب" value={member.sect} color="amber" />
              {member.tribe && !['—', 'غير ينطبق', 'غير محدد', ''].includes(String(member.tribe).trim()) && (
                <InfoItem icon={TreePine} label="القبيلة / النسب" value={member.tribe} color="amber" />
              )}
              {member.ethnicity && (
                <InfoItem icon={Globe} label="العرق / الأصل" value={member.ethnicity} color="navy" />
              )}
            </div>
          </CollapsibleSection>

          {/* 2. ── Social Status, Housing & Children (الحالة الاجتماعية والسكن والأبناء والتعدد) ── */}
          <CollapsibleSection title="الحالة الاجتماعية والسكن والأبناء والتعدد" icon={Users} gradient="from-emerald-500 to-teal-600" defaultOpen={true}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-3">
              <InfoItem icon={Heart} label="الحالة الاجتماعية" value={maritalFormatted} color="rose" />
              {marriageTypeFormatted && !['غير ينطبق', '—', ''].includes(marriageTypeFormatted) && (
                <InfoItem icon={Sparkles} label="نوع الزواج" value={marriageTypeFormatted} color="rose" />
              )}
              {member.gender === 'male' && member.wifeCount && !['غير ينطبق', 'لا يوجد', 'لا يوجد (أعزب)', '—', '0', ''].includes(member.wifeCount) && ['married', 'متزوج'].includes(member.maritalStatus) && (
                <InfoItem icon={Users} label="عدد الزوجات الحالي" value={member.wifeCount} color="blue" />
              )}
              {member.gender === 'male' && member.seekingWife && !['غير ينطبق', '—', '', 'غير متعدد', 'زواج أول (غير متعدد)'].includes(member.seekingWife) && (
                <InfoItem icon={Heart} label="التعدد / رغبة الزواج" value={member.seekingWife} color="purple" />
              )}
              {(() => {
                const isSingle = ['single', 'أعزب', 'عزباء'].includes(member.maritalStatus) || ['أعزب', 'عزباء'].includes(maritalFormatted);
                if (member.hasChildren) {
                  return <InfoItem icon={Users} label="وجود أبناء" value="نعم" color="purple" />;
                }
                if (!isSingle) {
                  return <InfoItem icon={Users} label="وجود أبناء" value="لا يوجد" color="purple" />;
                }
                return null;
              })()}
              {member.hasChildren && member.childrenCount && !['لا يوجد', 'غير ينطبق', '—', '0', ''].includes(member.childrenCount) && (
                <InfoItem icon={Baby} label="عدد الأبناء" value={member.childrenCount} color="rose" />
              )}
              {member.hasChildren && member.childrenLiveWith && !['لا يوجد', 'غير ينطبق', '—', ''].includes(member.childrenLiveWith) && (
                <InfoItem icon={Home} label="إقامة الأبناء" value={member.childrenLiveWith} color="emerald" />
              )}
              {member.housing && !['—', 'غير ينطبق', ''].includes(member.housing) && (
                <InfoItem icon={Home} label="نوع السكن" value={member.housing} color="emerald" />
              )}
            </div>
          </CollapsibleSection>

          {/* 3. ── Education & Work Grid (المؤهل التعليمي والعمل) ── */}
          <CollapsibleSection title="التعليم والعمل" icon={GraduationCap} gradient="from-purple-500 to-violet-600" defaultOpen={true}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-3">
              <InfoItem icon={GraduationCap} label="المؤهل العلمي" value={member.education} color="purple" />
              <InfoItem icon={Briefcase} label="جهة العمل / القطاع" value={member.workType} color="blue" />
              <InfoItem icon={Building2} label="المسمى الوظيفي" value={member.jobTitle} color="navy" />
            </div>
          </CollapsibleSection>

          {/* 4. ── Physical & Health Specs (المواصفات الجسدية والصحية) ── */}
          <CollapsibleSection title="المواصفات الجسدية والصحية" icon={Ruler} gradient="from-indigo-500 to-blue-600" defaultOpen={true}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-3">
              <InfoItem icon={Ruler} label="الطول" value={member.height ? `${member.height} سم` : undefined} color="emerald" />
              <InfoItem icon={Weight} label="الوزن" value={member.weight ? `${member.weight} كجم` : undefined} color="blue" />
              <InfoItem icon={Palette} label="لون البشرة" value={member.skinColor} color="amber" />
              <InfoItem icon={Stethoscope} label="الحالة الصحية" value={member.health} color="emerald" />
              <InfoItem icon={Cigarette} label="التدخين" value={member.smoking} color="slate" />
            </div>
          </CollapsibleSection>

          {/* 5. ── Bio Section (نبذة عني) ── */}
          <CollapsibleSection title="نبذة عني (عن نفسي)" icon={FileText} gradient="from-blue-500 to-indigo-600" defaultOpen={true}>
            <p className="text-slate-700 font-tajawal leading-[1.9] text-sm pt-3">
              {member.bio || 'لم يقم العضو بإضافة نبذة عن نفسه بعد.'}
            </p>
          </CollapsibleSection>

          {/* 6. ── Partner Section (أبحث عن - مواصفات الشريك المطلوب في الأسفل) ── */}
          <CollapsibleSection title="أبحث عن (مواصفات الشريك المطلوب)" icon={Heart} gradient="from-rose-500 to-pink-600" defaultOpen={true}>
            <div className="pt-3 space-y-3">
              {/* الوسوم الشاملة لمواصفات الشريك (العمر، المدن، الجنسية، الدولة، الحالة) */}
              {partnerSummary.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {partnerSummary.tags.map((tag, tIdx) => (
                    <div key={`profile-ptag-${tag.label}-${tIdx}`} className="bg-rose-50/90 text-rose-950 border border-rose-200/80 px-3 py-1.5 rounded-xl font-cairo font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="text-rose-600 text-[10px] font-extrabold">{tag.label}:</span>
                      <span>{tag.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* النص المطلوب أو الملاحظات */}
              {partnerSummary.text ? (
                <p className="text-slate-700 font-tajawal leading-[1.9] text-sm bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                  {partnerSummary.text}
                </p>
              ) : partnerSummary.tags.length === 0 ? (
                <p className="text-slate-400 font-tajawal text-xs italic">لم يحدد العضو مواصفات الشريك المطلوب بعد.</p>
              ) : null}
            </div>
          </CollapsibleSection>

          {/* Mediation notice */}
          <div className="bg-gradient-to-l from-amber-50 to-yellow-50/50 rounded-2xl p-4 border border-amber-200/60 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-cairo font-bold text-slate-900 text-sm mb-1">وساطة احترافية وسرية تامة</h3>
              <p className="text-xs text-slate-600 font-tajawal leading-relaxed">
                التواصل يتم حصريًا عبر فريق الإدارة لضمان الخصوصية والجدية. عند إرسال طلب اهتمام، ستتولى الإدارة التنسيق والربط بين الطرفين وفق ضوابط التوافق الشرعي.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-4">



          {/* Status card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden">
            <div className="h-1 bg-gradient-to-l from-slate-700 to-slate-900" />
            <div className="p-4">
              <h3 className="font-cairo font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" /> حالة العضو
              </h3>
              <div className="space-y-2.5">
                {[
                  { icon: ShieldCheck, iconColor: 'text-emerald-500', label: 'التوثيق', value: member.verified ? 'موثّق ✓' : 'غير موثّق', valueColor: member.verified ? 'text-emerald-600' : 'text-slate-400' },
                  { 
                    icon: Crown, 
                    iconColor: member.plan === 'elite' ? 'text-rose-500' : member.plan === 'gold' ? 'text-amber-500' : 'text-slate-400', 
                    label: 'العضوية', 
                    value: member.plan === 'elite' ? 'باقة مميزة ⭐' : member.plan === 'gold' ? 'باقة ذهبية 👑' : 'باقة مجانية', 
                    valueColor: member.plan === 'elite' ? 'text-rose-600 font-extrabold' : member.plan === 'gold' ? 'text-amber-600 font-extrabold' : 'text-slate-400' 
                  },
                  { icon: User, iconColor: 'text-purple-500', label: 'الجنس', value: isMale ? 'رجل' : 'امرأة', valueColor: 'text-slate-700' },
                  { icon: Scale, iconColor: 'text-amber-500', label: 'المذهب', value: member.sect, valueColor: 'text-slate-700' },
                ].map((item, i) => (
                  <div key={`profile-safety-${item.label}-${i}`} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                    <span className="text-[11px] text-slate-500 font-tajawal flex items-center gap-2">
                      <item.icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                      {item.label}
                    </span>
                    <span className={`text-[11px] font-cairo font-bold ${item.valueColor}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-2.5">
              <Lock className="w-5 h-5 text-amber-400" />
              <h3 className="font-cairo font-bold text-sm">خصوصية تامة</h3>
            </div>
            <p className="text-xs font-tajawal leading-relaxed text-slate-300">
              لا تظهر معلومات التواصل للأعضاء. عبر <strong className="text-amber-400">«طلب اهتمام»</strong> تتولى الإدارة التواصل مع الطرف الآخر بسرية كاملة.
            </p>
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-[10px] text-slate-400 font-tajawal flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                لا تشارك معلوماتك المالية مع أي طرف
              </p>
            </div>
          </div>

          {/* Share */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 p-4">
            <h3 className="font-cairo font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-amber-500" /> مشاركة ونسخ الملف
            </h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleShareWhatsApp} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 font-cairo font-bold text-xs hover:bg-emerald-100 transition-colors cursor-pointer">
                  <MessageCircle className="w-4 h-4" /> واتساب
                </button>
                <button onClick={handleCopyLink} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-cairo font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer">
                  <Copy className="w-4 h-4" /> نسخ الرابط
                </button>
              </div>
              <button 
                onClick={handleCopyMemberData} 
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200/60 font-cairo font-bold text-xs hover:bg-amber-100/70 transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4 text-amber-600" /> نسخ كافة مواصفات العضو للحافظة 📋
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ═══════════ STICKY BOTTOM BAR (on scroll) ═══════════ */}
      <AnimatePresence>
        {scrolled && !isSelf && (
          <motion.div
            key="profile-sticky-bottom-bar"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50"
          >
            <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_30px_rgba(0,0,0,0.12)]">
              <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 w-full" dir="rtl">
                {/* معلومات مصغرة عن العضو */}
                <div className="flex items-center gap-2.5 flex-shrink-0 text-right">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${accentGradient} p-[1.5px] hidden xs:block`}>
                    <div className="w-full h-full rounded-[9px] bg-white flex items-center justify-center">
                      <img src={avatar} alt="" className="w-full h-full object-contain p-1" />
                    </div>
                  </div>
                  <div>
                    <p className="font-cairo font-bold text-slate-900 text-xs sm:text-sm leading-tight flex items-center gap-1">
                      <span>{member.nickname}</span>
                      {member.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 inline" />}
                    </p>
                    <p className="text-[10px] text-slate-400 font-tajawal">{member.age ? `${member.age} سنة` : ''} · {member.city || ''}</p>
                  </div>
                </div>

                {/* أزرار الإجراءات المتسقة */}
                <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
                  {/* 1. الزر الأساسي (طلب توافق / إنشاء حساب / طلب وساطة / متابعة) */}
                  <div className="flex-1 sm:flex-initial min-w-0">
                    {!user.isLoggedIn ? (
                      <button
                        onClick={() => {
                          showToast('أهلاً بك! يرجى إنشاء حسابك أو تسجيل الدخول لإرسال طلب التوافق', 'info');
                          navigate('/register');
                        }}
                        className="w-full sm:w-auto py-2 px-3.5 sm:px-5 rounded-xl bg-gradient-to-r from-amber-500 via-gold-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-cairo font-extrabold text-xs sm:text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 -scale-x-100 text-slate-900" />
                        <span className="truncate">إنشاء حساب لطلب التوافق 💌</span>
                      </button>
                    ) : isImported ? (
                      <button
                        onClick={handleShareWhatsApp}
                        className="w-full sm:w-auto py-2 px-3.5 sm:px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-cairo font-extrabold text-xs sm:text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        <span className="truncate">طلب التوفيق والوساطة 💬</span>
                      </button>
                    ) : latestRequest ? (
                      latestRequest.journey_stage === 'declined' || latestRequest.journey_stage === 'cancelled' ? (
                        <button
                          onClick={() => setContactOpen(true)}
                          className="w-full sm:w-auto py-2 px-3.5 sm:px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-cairo font-extrabold text-xs sm:text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 -scale-x-100" />
                          <span className="truncate">طلب جديد 💌</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/requests')}
                          className="w-full sm:w-auto py-2 px-3.5 sm:px-5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-cairo font-extrabold text-xs sm:text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="truncate">
                            {latestRequest.journey_stage === 'sent' 
                              ? 'قيد الانتظار' 
                              : 'متابعة الرحلة'}
                          </span>
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => setContactOpen(true)}
                        className="w-full sm:w-auto py-2 px-3.5 sm:px-5 rounded-xl bg-gradient-to-r from-amber-500 via-gold-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-cairo font-extrabold text-xs sm:text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 -scale-x-100 text-slate-900" />
                        <span className="truncate">طلب توافق 💌</span>
                      </button>
                    )}
                  </div>

                  {/* 2. زر الواتساب للتوافق */}
                  <button
                    onClick={handleShareWhatsApp}
                    className="h-9 sm:h-10 rounded-xl px-2.5 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1 transition-all font-cairo font-bold text-xs cursor-pointer shadow-xs flex-shrink-0"
                    title="تواصل واتساب للتوفيق مع هذا الملف"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-white" />
                    <span className="inline">{!user.isLoggedIn ? 'واتساب' : 'واتساب'}</span>
                  </button>

                  {/* 3. زر المفضلة */}
                  <button
                    onClick={() => {
                      if (!user.isLoggedIn) {
                        showToast('يرجى تسجيل الدخول لإضافة الأعضاء إلى المفضلة', 'info');
                        navigate('/login');
                        return;
                      }
                      toggleLike(member.id);
                    }}
                    className={`h-9 sm:h-10 rounded-xl px-2.5 sm:px-3 flex items-center justify-center gap-1 transition-all font-cairo font-bold text-xs flex-shrink-0 cursor-pointer ${
                      liked ? 'bg-amber-500 text-white shadow-sm hover:bg-amber-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                    title={liked ? 'إزالة من المحفوظات' : 'حفظ'}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${liked ? 'fill-white' : ''}`} />
                    <span className="hidden sm:inline">{liked ? 'محفوظ' : 'حفظ'}</span>
                  </button>

                  {/* 4. زر القائمة الإضافية والأمان (...) */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setStickyMoreMenuOpen(!stickyMoreMenuOpen)}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors flex items-center justify-center cursor-pointer shadow-xs"
                      title="خيارات إضافية"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* القائمة المنبثقة من الأسفل */}
                    <AnimatePresence>
                      {stickyMoreMenuOpen && (
                        <motion.div
                          key="profile-sticky-more-menu-dropdown"
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute left-0 bottom-full mb-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-1.5 z-50 space-y-1 text-right"
                        >
                          {/* نسخ بيانات العضو */}
                          <button
                            onClick={() => {
                              setStickyMoreMenuOpen(false);
                              handleCopyMemberData();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-cairo font-bold text-slate-800 hover:bg-amber-50 hover:text-amber-900 transition-colors cursor-pointer"
                          >
                            <Copy className="w-4 h-4 text-amber-600" />
                            <span>نسخ كافة بيانات العضو 📋</span>
                          </button>

                          {/* نسخ رابط الملف */}
                          <button
                            onClick={() => {
                              setStickyMoreMenuOpen(false);
                              handleCopyLink();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-cairo font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-900 transition-colors cursor-pointer"
                          >
                            <Share2 className="w-4 h-4 text-blue-500" />
                            <span>نسخ رابط الملف</span>
                          </button>

                          {/* حظر العضو */}
                          {user.isLoggedIn && (
                            <button
                              onClick={() => {
                                setStickyMoreMenuOpen(false);
                                toggleBlock(member.id);
                                showToast(isBlocked ? 'تم إلغاء حظر العضو' : 'تم حظر العضو بنجاح', isBlocked ? 'info' : 'warning');
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-cairo font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Ban className="w-4 h-4 text-slate-500" />
                              <span>{isBlocked ? 'إلغاء حظر العضو' : 'حظر العضو'}</span>
                            </button>
                          )}

                          {/* إبلاغ عن العضو */}
                          {user.isLoggedIn && (
                            <button
                              onClick={() => {
                                setStickyMoreMenuOpen(false);
                                setReportOpen(true);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-cairo font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <AlertTriangle className="w-4 h-4 text-rose-500" />
                              <span>إبلاغ عن العضو ⚠️</span>
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {stickyMoreMenuOpen && (
                      <div key="sticky-more-menu-backdrop" className="fixed inset-0 z-40" onClick={() => setStickyMoreMenuOpen(false)} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ CONTACT MODAL ═══════════ */}
      <Modal open={contactOpen} onClose={() => setContactOpen(false)} title="طلب التنسيق المباشر ودفع رسوم المنصة">
        <div className="space-y-4">
          {/* Member preview */}
          <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accentGradient} p-[2px]`}>
              <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center">
                <img src={avatar} alt="" className="w-full h-full object-contain p-1.5" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-cairo font-bold text-slate-900 text-sm">{member.nickname}</p>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-500 font-tajawal">{member.age} سنة</span>
                <span className="text-[10px] text-slate-500 font-tajawal">· {member.city}</span>
                <span className="text-[10px] text-slate-500 font-tajawal">· {member.maritalStatus || 'مكتمل البيانات'}</span>
              </div>
            </div>
          </div>

          {/* توضيح رحلة التوافق الجديدة */}
          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl border-2 border-amber-300/80 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-cairo font-extrabold text-sm">
              <Crown className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <span>بدء رحلة التوافق للزواج</span>
            </div>
            <p className="text-xs text-slate-700 font-tajawal leading-relaxed">
              سيتم إرسال طلبك مباشرة إلى <strong>{member.nickname}</strong> بانتظار قبوله المبدئي. بعد القبول، تنتقل الرحلة تلقائياً لمرحلة تأكيد الجدية والتواصل المباشر.
            </p>
            <div className="pt-2 border-t border-amber-200/60 grid grid-cols-2 gap-2 text-[11px] font-tajawal text-slate-700">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>توافق موثّق بإشراف المنصة</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>إشعار للطرفين عبر الرحلة</span>
              </div>
            </div>
          </div>

          {/* Templates */}
          <div>
            <label className="block text-xs font-cairo font-bold text-slate-800 mb-2">💬 رسالة الاهتمام المرفقة بالطلب</label>
            <div className="space-y-1.5">
              {MESSAGE_TEMPLATES.map((tpl, i) => (
                <button
                  key={`profile-msg-tpl-${i}`}
                  onClick={() => setContactMsg(tpl)}
                  className={`w-full text-right p-2.5 rounded-xl border-2 text-xs font-tajawal leading-relaxed transition-all ${
                    contactMsg === tpl
                      ? 'border-amber-500 bg-amber-50 text-slate-900 shadow-sm font-semibold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'
                  }`}
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <textarea
              value={contactMsg}
              onChange={(e) => setContactMsg(e.target.value)}
              rows={2}
              placeholder="اكتب رسالة اهتمام مخصصة أو اختر من القوالب أعلاه..."
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-amber-500 focus:outline-none font-tajawal text-sm resize-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={async () => {
                const msg = contactMsg || 'طلب توافق جديد للزواج عبر المنصة';
                const res = await sendInterestRequest(member.id, msg);
                if (res?.ok) {
                  incrementUsage('message');
                  setContactOpen(false);
                  setContactMsg('');
                  showToast('تم إرسال طلب التوافق بنجاح! سيتم إشعار الطرف الآخر.', 'success');
                  setTimeout(() => navigate('/requests'), 600);
                }
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-gold-500 to-amber-600 text-slate-950 font-cairo font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4.5 h-4.5 -scale-x-100" />
              <span>إرسال طلب التوافق للزواج 💌</span>
            </button>

            <button
              onClick={() => {
                setContactOpen(false);
                navigate('/plans');
              }}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-xs transition-colors text-center"
            >
              عرض باقات المنصة الشاملة
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══════════ REPORT MODAL ═══════════ */}
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="⚠️ إرسال بلاغ">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 p-3 bg-red-50 rounded-xl border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-xs text-red-800 font-cairo font-medium">نأخذ البلاغات على محمل الجد لضمان أمان الأعضاء.</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 font-cairo">العضو المُبلَغ عنه:</span>
            <span className="block font-cairo font-bold text-slate-900 mt-0.5">{member.nickname}</span>
          </div>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            rows={4}
            placeholder="اكتب تفاصيل البلاغ بوضوح..."
            className="w-full p-3 rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-red-400 focus:outline-none font-tajawal text-sm resize-none"
          />
          <button
            onClick={() => {
              if (!reportReason.trim()) { showToast('اكتب محتوى البلاغ', 'error'); return; }
              submitReport(member.id, member.nickname, reportReason);
              setReportOpen(false);
              setReportReason('');
              showToast('تم إرسال البلاغ ✓', 'success');
            }}
            className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-cairo font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4.5 h-4.5" /> إرسال البلاغ
          </button>
        </div>
      </Modal>

      {/* نافذة خيارات وإرسال رسالة الواتساب */}
      <WhatsAppShareModal
        open={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        member={member}
      />
    </div>
  );
}
