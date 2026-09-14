import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin, ShieldCheck, Crown, Bookmark, Eye,
  Briefcase, Calendar, Users, Heart,
} from 'lucide-react';
import type { Member } from '../lib/members';
import { getAvatar, getGenderColors } from '../lib/types';
import { useApp } from '../lib/AppContext';
import { formatMaritalStatus } from '../lib/memberUtils';
import MemberProfileModal from './MemberProfileModal';

export default function MemberCard({ member }: { member: Member; key?: any }) {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const { user, likedMembers, toggleLike, showToast } = useApp();
  const liked = user?.isLoggedIn ? likedMembers.has(member.id) : false;
  const safeGender = (member.gender === 'male' || member.gender === 'female' ? member.gender : 'female') as any;
  const avatar = getAvatar(safeGender);
  const c = getGenderColors(safeGender);
  const isMale = member.gender === 'male';
  // عند غياب الاسم المستعار (شائع في الأعضاء المستوردين) نعرض وصفاً لائقاً بدل معرّف العضو
  const genderWord = member.gender === 'male' ? 'عضو' : member.gender === 'female' ? 'عضوة' : 'عضو';
  const composedName = [genderWord, (member as any).city ? `من ${(member as any).city}` : '', member.age ? `(${member.age})` : '']
    .filter(Boolean).join(' ');
  const displayName = member.nickname || member.realName || composedName || genderWord;

  const maritalFormatted = formatMaritalStatus(member.maritalStatus, member.maritalLabel, member.gender);

  // ملاحظات ومواصفات الشريك الكتابية (كما كانت)
  const partnerNotes = useMemo(() => {
    const details = (member as any)?.details && typeof (member as any).details === 'object' ? (member as any).details : {};
    const text = member.aboutPartner || member.partnerRequirements || member.idealPartner || details.aboutPartner || (member as any).pNotes || (member as any).p_notes || details.pNotes || '';
    return typeof text === 'string' ? text.trim() : '';
  }, [member]);

  const isImported = member.sourceType === 'imported' || Boolean((member as any).importBatchId) || Boolean((member as any).importOfficeName) || Boolean((member as any).khataabaName) || Boolean((member as any).khataabaPhone) || Boolean((member as any).khataaba_phone);

  const handleOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="group bg-white rounded-2xl overflow-hidden shadow-soft hover:shadow-luxe transition-shadow duration-500 border border-cream-200/70 flex flex-col h-full cursor-pointer"
        onClick={handleOpenModal}
      >
        <div className="block flex flex-col flex-1 no-tap-highlight select-none">
          {/* ===== الرأس المبسّط: الصورة + الاسم + صف الشارات ===== */}
          <div className={`relative ${c.bg} p-3 sm:p-4`}>
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* الصورة الافتراضية */}
              <div className="relative flex-shrink-0">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white flex items-center justify-center overflow-hidden ring-2 ${c.ring} ring-opacity-30 shadow-sm`}>
                  <img src={avatar} alt="" className="w-full h-full object-contain p-1.5" />
                </div>
              </div>

              {/* الاسم + صف الشارات المرتّب */}
              <div className="flex-1 min-w-0 pr-1">
                <h3 className="font-cairo font-bold text-navy-900 text-sm sm:text-base leading-tight truncate">
                  {displayName}
                </h3>
                {/* صف واحد مرتّب لجميع الشارات */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${c.badgeBg} text-white`}>
                    <GenderIcon isMale={isMale} white />
                    <span className="text-[9px] sm:text-[10px] font-cairo font-bold">{isMale ? 'رجل' : 'امرأة'}</span>
                  </span>
                  {isImported && (
                    <span className="inline-flex items-center gap-0.5 bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded-md text-[8.5px] sm:text-[9.5px] font-cairo font-bold" title="ملف مرفوع من قبل الإدارة">
                      📋 مرفوع من الإدارة
                    </span>
                  )}
                  {member.verified && (
                    <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md" title="موثّق">
                      <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </span>
                  )}
                  {(member.plan === 'elite' || (member.premium && member.plan !== 'gold')) && (
                    <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-200/50 px-1.5 py-0.5 rounded-md font-cairo font-extrabold text-[9px] sm:text-[10px]" title="الباقة المميزة">
                      <span>⭐</span>
                      <span>مميز</span>
                    </span>
                  )}
                  {member.plan === 'gold' && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200/50 px-1.5 py-0.5 rounded-md font-cairo font-extrabold text-[9px] sm:text-[10px]" title="الباقة الذهبية">
                      <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                      <span>ذهبي</span>
                    </span>
                  )}
                  {member.hasSeriousnessBadge && (
                    <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-extrabold text-[8px] md:text-[9px] px-1.5 py-0.5 rounded-md font-cairo" title="وسام الجدية المعتمد">
                      🏅 جاد
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===== جسم البطاقة ===== */}
          <div className="p-3 sm:p-4 flex flex-col flex-1">
            {/* الموقع */}
            <div className="flex items-center gap-1.5 bg-cream-50 rounded-lg px-2.5 py-2 border border-cream-200/60 mb-2.5">
              <MapPin className={`w-3.5 h-3.5 ${c.text} flex-shrink-0`} />
              <span className="font-tajawal text-xs sm:text-sm text-navy-700 truncate">
                {[member.city, member.country].filter(Boolean).join('، ') || 'الموقع غير محدد'}
              </span>
            </div>

            {/* شبكة المعلومات: العمر + الحالة + الوظيفة */}
            <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-2.5">
              {[
                { icon: Calendar, label: 'العمر', value: member.age ? `${member.age} سنة` : '—', sub: '' },
                { icon: Users, label: 'الحالة', value: maritalFormatted, sub: '' },
                { icon: Briefcase, label: 'العمل', value: member.jobTitle || member.workType || '—', sub: '' },
              ].map((item) => (
                <div key={`mc-info-${member?.id || 'm'}-${item.label}`} className="bg-cream-50 rounded-lg p-1 sm:p-2 text-center border border-cream-200/60 h-full flex flex-col justify-between">
                  <div>
                    <item.icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${c.text} mx-auto mb-1 flex-shrink-0`} />
                    <div className="text-[10px] sm:text-[11px] font-cairo font-extrabold text-navy-900 leading-[1.1] break-words whitespace-normal line-clamp-2 px-0.5" title={item.value}>
                      {item.value}
                    </div>
                  </div>
                  <div className="text-[8px] sm:text-[9px] text-navy-400 font-tajawal break-words whitespace-normal line-clamp-1 mt-1">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>

            {/* قسم "أبحث عن" (الملاحظات الكتابية كما كانت) */}
            <div className={`rounded-xl ${c.bg} p-2.5 mb-2.5`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Heart className={`w-3.5 h-3.5 ${c.text}`} />
                <span className={`text-[11px] font-cairo font-bold ${c.textStrong} whitespace-nowrap`}>أبحث عن</span>
              </div>

              {/* الملاحظات الكتابية لمواصفات الشريك كما كانت */}
              {partnerNotes ? (
                <p className="text-[11px] sm:text-[12px] text-navy-600 font-tajawal leading-snug line-clamp-2">
                  {partnerNotes}
                </p>
              ) : (
                <p className="text-[11px] text-navy-400 font-tajawal italic">لم تُضف مواصفات الشريك بعد</p>
              )}
            </div>

            {/* الأزرار — زر الحفظ أيقونة فقط + زر العرض موسّع */}
            <div className="mt-auto flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!user?.isLoggedIn) {
                    showToast('يرجى تسجيل الدخول لإضافة الأعضاء إلى المفضلة', 'info');
                    navigate('/login');
                    return;
                  }
                  toggleLike(member.id);
                }}
                aria-label="حفظ الملف"
                className={`flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl transition-all duration-300 no-tap-highlight flex-shrink-0 ${
                  liked ? 'bg-gold-500 text-white shadow-soft' : 'bg-cream-100 text-navy-500 hover:bg-cream-200'
                }`}
              >
                <Bookmark className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${liked ? 'fill-white' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleOpenModal}
                className={`flex-1 h-11 sm:h-12 flex items-center justify-center gap-2 rounded-xl ${c.bgStrong} text-white font-cairo font-bold text-xs sm:text-sm transition-all hover:brightness-110 shadow-sm cursor-pointer`}
              >
                <Eye className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                عرض الملف
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* القائمة المنبثقة الشاملة للملف الشخصي */}
      <MemberProfileModal
        member={member}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

/* أيقونة جنس مخصصة */
function GenderIcon({ isMale, white }: { isMale: boolean; white?: boolean }) {
  const color = white ? 'white' : 'currentColor';
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      {isMale ? (
        <path d="M14 6h6v6M20 6l-7 7M10 6H4v6M4 6l7 7M14 18h6M10 18H4" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="2.2" />
      )}
    </svg>
  );
}
