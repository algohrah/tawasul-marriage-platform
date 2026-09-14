import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Crown, Inbox, Bell, Heart, Headphones, Eye,
  Edit3, LogOut, Bookmark, ChevronLeft, Lock, Camera, ShieldCheck, Check,
  Clock, Send, CheckCheck, X, Sparkles, CreditCard, Gift, Mail, Phone, MapPin,
  KeyRound, EyeOff, AlertCircle, CheckCircle2, FileText, Zap,
} from 'lucide-react';
import { useApp, DEFAULT_PROFILE } from '../lib/AppContext';
import { VerifiedBadge, PremiumBadge } from '../components/ui/Badge';
import { PhoneInputWithCountryCode } from '../components/ui/FormFields';
import { getAvatar } from '../lib/types';
import type { Plan } from '../lib/types';
import MemberCard from '../components/MemberCard';
import Modal from '../components/ui/Modal';
import VerificationUploadModal from '../components/VerificationUploadModal';

type Tab = 'account' | 'saved' | 'subscription' | 'requests';

const tabsList: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'account', label: 'الحساب', icon: User },
  { id: 'saved', label: 'المحفوظات', icon: Bookmark },
  { id: 'subscription', label: 'الاشتراك', icon: Crown },
  { id: 'requests', label: 'الطلبات', icon: Inbox },
];

export default function Profile() {
  const {
    user,
    logout,
    plans,
    likedMembers,
    interestRequests,
    supportTickets,
    showToast,
    allowProfileHiding,
    isProfileHidden,
    toggleProfileHiding,
    enableWhoViewedMe,
  } = useApp();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const prof = user?.profile || DEFAULT_PROFILE;
  const name = prof.name || user?.name || 'ضيف';

  // أرقام حقيقية بدلاً من الثوابت الوهمية
  const myTicketsCount = supportTickets.filter(t => (t.userId || 'm2') === (user.memberId || 'm2')).length;
  const profileVisits = prof.profileCompletion ? Math.max(12, Math.round(prof.profileCompletion * 0.9)) : 0;

  const pendingRequestsCount = interestRequests.filter(r => r.receiverId === user.memberId && r.status === 'pending').length;
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const savedCount = likedMembers.size;
  const unreadNotifs = 3; // محاكاة إشعارات غير مقروءة

  const handleLogout = () => {
    logout();
    showToast('تم تسجيل الخروج بنجاح', 'info');
    navigate('/');
  };

  // بطاقة الحالة الجانبية (تظهر على الديسكتوب)
  const sidebar = (
    <div className="space-y-4">
      {/* بطاقة العضو المختصرة */}
      <div className="bg-white rounded-3xl shadow-luxe border border-cream-200/60 p-5 text-center">
        <div className="relative inline-block">
          <div className="w-20 h-20 rounded-3xl bg-gold-gradient flex items-center justify-center text-navy-900 font-cairo font-extrabold text-3xl ring-4 ring-white shadow-lg mx-auto">
            {name.charAt(0)}
          </div>
          <Link to="/edit-profile" className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-navy-900 text-white flex items-center justify-center ring-2 ring-white hover:bg-navy-800 transition-colors">
            <Camera className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="flex items-center gap-1.5 justify-center flex-wrap mt-3">
          <h2 className="font-cairo font-extrabold text-xl text-navy-900">{name}</h2>
          {prof.verified && <VerifiedBadge size="md" />}
          <PremiumBadge size="md" />
        </div>
        <p className="text-navy-500 font-tajawal text-sm mt-1">
          {prof.plan === 'gold' ? 'عضو ذهبي' : prof.plan === 'elite' ? 'عضو نخبة' : 'عضو مجاني'} · {prof.city || 'الرياض'}
        </p>
        <div className="mt-2 h-1.5 bg-cream-200 rounded-full overflow-hidden max-w-[160px] mx-auto">
          <div className="h-full bg-gold-gradient rounded-full transition-all duration-500" style={{ width: `${prof.profileCompletion || 85}%` }} />
        </div>
        <p className="text-[11px] text-emerald-600 font-tajawal mt-1.5">ملفك مكتمل بنسبة {prof.profileCompletion || 85}%</p>
      </div>

      {/* قائمة التبويبات العمودية */}
      <nav className="bg-white rounded-2xl shadow-soft border border-cream-200/60 p-2 space-y-1">
        {tabsList.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl font-cairo font-semibold text-sm transition-all no-tap-highlight ${
              activeTab === tab.id
                ? 'bg-navy-900 text-white shadow-soft'
                : 'text-navy-600 hover:bg-cream-100'
            }`}
          >
            <tab.icon className="w-4.5 h-4.5 flex-shrink-0" />
            <span className="flex-1 text-right">{tab.label}</span>
            {tab.id === 'requests' && pendingRequestsCount > 0 && (
              <span className="bg-rose-deep text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {pendingRequestsCount}
              </span>
            )}
            {tab.id === 'saved' && savedCount > 0 && (
              <span className="bg-cream-200 text-navy-600 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {savedCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* زر الإشعارات + زر الخروج الثابت */}
      <div className="space-y-2">
        <Link
          to="/notifications"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-cream-200/60 shadow-soft text-navy-700 hover:bg-cream-100 transition-colors no-tap-highlight"
        >
          <div className="relative">
            <Bell className="w-4.5 h-4.5 text-gold-600" />
            {unreadNotifs > 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-rose-deep text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadNotifs}
              </span>
            )}
          </div>
          <span className="flex-1 text-right font-cairo font-semibold text-sm">الإشعارات</span>
          <ChevronLeft className="w-4 h-4 text-navy-300" />
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-white border-2 border-rose-deep/20 text-rose-deep font-cairo font-bold text-sm hover:bg-rose-deep/5 transition-colors active:scale-[0.98] no-tap-highlight"
        >
          <LogOut className="w-4.5 h-4.5" /> تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-cream-50 min-h-screen pb-28 lg:pb-8">
      {/* Cover */}
      <div className="relative h-32 sm:h-40 lg:h-44 bg-navy-gradient overflow-hidden">
        <div className="absolute inset-0 pattern-arabesque opacity-30" />
        <div className="absolute -top-10 -right-10 w-60 h-60 bg-gold-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-rose-deep/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-16 lg:-mt-20 relative">
        {/* ===== Mobile: رأس مختصر ===== */}
        <div className="lg:hidden bg-white rounded-3xl shadow-luxe border border-cream-200/60 p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gold-gradient flex items-center justify-center text-navy-900 font-cairo font-extrabold text-2xl ring-3 ring-white shadow-lg">
                {name.charAt(0)}
              </div>
              <Link to="/edit-profile" className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-navy-900 text-white flex items-center justify-center ring-2 ring-white hover:bg-navy-800 transition-colors">
                <Camera className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-cairo font-extrabold text-lg text-navy-900 truncate">{name}</h1>
                {prof.verified && <VerifiedBadge size="sm" />}
                <PremiumBadge size="sm" />
              </div>
              <p className="text-navy-500 font-tajawal text-xs mt-0.5">
                {prof.plan === 'gold' ? 'عضو ذهبي' : prof.plan === 'elite' ? 'عضو نخبة' : 'عضو مجاني'} · {prof.city || 'الرياض'} · {prof.age || 26} سنة
              </p>
              <div className="mt-1.5 h-1.5 bg-cream-200 rounded-full overflow-hidden max-w-[180px]">
                <div className="h-full bg-gold-gradient rounded-full transition-all duration-500" style={{ width: `${prof.profileCompletion || 85}%` }} />
              </div>
            </div>
            <Link
              to="/notifications"
              className="relative flex-shrink-0 w-10 h-10 rounded-xl bg-cream-100 flex items-center justify-center hover:bg-cream-200 transition-colors no-tap-highlight"
            >
              <Bell className="w-5 h-5 text-gold-600" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -left-1 bg-rose-deep text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadNotifs}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile: الإحصائيات التفاعلية */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { id: 'saved' as const, icon: Bookmark, label: 'محفوظات', value: savedCount, color: 'text-gold-600 bg-gold-300/15' },
              { id: 'support' as const, icon: Headphones, label: 'تذاكر', value: myTicketsCount, color: 'text-gold-600 bg-gold-300/15' },
              { id: 'requests' as const, icon: Inbox, label: 'طلبات', value: pendingRequestsCount, color: 'text-sky-600 bg-sky-100' },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  if (s.id === 'saved') setActiveTab('saved');
                  else if (s.id === 'requests') setActiveTab('requests');
                  else if (s.id === 'support') navigate('/support');
                }}
                className="bg-cream-50 rounded-2xl p-2.5 text-center border border-cream-200 transition-all cursor-pointer hover:bg-cream-100 hover:border-gold-300 no-tap-highlight"
              >
                <div className={`w-8 h-8 rounded-xl mx-auto flex items-center justify-center mb-1 ${s.color}`}>
                  <s.icon className="w-4 h-4" strokeWidth={2.2} />
                </div>
                <div className="font-cairo font-extrabold text-base text-navy-900">{s.value}</div>
                <div className="text-[10px] text-navy-500 font-tajawal">{s.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ===== Desktop: رأس كامل + إحصائيات ===== */}
        <div className="hidden lg:block bg-white rounded-3xl shadow-luxe border border-cream-200/60 p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-3xl bg-gold-gradient flex items-center justify-center text-navy-900 font-cairo font-extrabold text-4xl ring-4 ring-white shadow-lg">
                {name.charAt(0)}
              </div>
              <Link to="/edit-profile" className="absolute -bottom-1 -left-1 w-9 h-9 rounded-full bg-navy-900 text-white flex items-center justify-center ring-2 ring-white hover:bg-navy-800 transition-colors">
                <Camera className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-cairo font-extrabold text-2xl text-navy-900">{name}</h1>
                {prof.verified && <VerifiedBadge size="md" />}
                <PremiumBadge size="md" />
              </div>
              <p className="text-navy-500 font-tajawal mt-1">
                {prof.plan === 'gold' ? 'عضو ذهبي' : prof.plan === 'elite' ? 'عضو نخبة' : 'عضو مجاني'} · {prof.city || 'الرياض'} · {prof.age || 26} سنة
              </p>
              <div className="mt-2 flex items-center gap-3 max-w-xs">
                <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gold-gradient rounded-full transition-all duration-500" style={{ width: `${prof.profileCompletion || 85}%` }} />
                </div>
                <span className="text-xs text-emerald-600 font-tajawal whitespace-nowrap">{prof.profileCompletion || 85}%</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Link to="/edit-profile" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-navy-900 text-white font-cairo font-bold text-sm hover:bg-navy-800 transition-colors no-tap-highlight">
                <Edit3 className="w-4 h-4" /> تعديل الملف
              </Link>
              <Link to="/notifications" className="relative inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cream-100 text-navy-700 font-cairo font-bold text-sm hover:bg-cream-200 transition-colors no-tap-highlight">
                <Bell className="w-4 h-4 text-gold-600" /> الإشعارات
                {unreadNotifs > 0 && (
                  <span className="bg-rose-deep text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadNotifs}</span>
                )}
              </Link>
            </div>
          </div>

          {/* Desktop: الإحصائيات التفاعلية */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { id: 'saved' as const, icon: Bookmark, label: 'المحفوظات', value: savedCount, color: 'text-gold-600 bg-gold-300/15' },
              { id: 'support' as const, icon: Headphones, label: 'تذاكر الدعم', value: myTicketsCount, color: 'text-gold-600 bg-gold-300/15' },
              { id: 'requests' as const, icon: Inbox, label: 'طلبات معلّقة', value: pendingRequestsCount, color: 'text-sky-600 bg-sky-100' },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  if (s.id === 'saved') setActiveTab('saved');
                  else if (s.id === 'requests') setActiveTab('requests');
                  else if (s.id === 'support') navigate('/support');
                }}
                className="bg-cream-50 rounded-2xl p-3 text-center border border-cream-200 transition-all cursor-pointer hover:bg-cream-100 hover:border-gold-300 no-tap-highlight"
              >
                <div className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center mb-1.5 ${s.color}`}>
                  <s.icon className="w-4.5 h-4.5" strokeWidth={2.2} />
                </div>
                <div className="font-cairo font-extrabold text-lg text-navy-900">{s.value}</div>
                <div className="text-[11px] text-navy-500 font-tajawal">{s.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ===== Mobile: تبويبات أفقية ===== */}
        <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {tabsList.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-cairo font-semibold text-sm whitespace-nowrap transition-all no-tap-highlight ${
                activeTab === tab.id
                  ? 'bg-navy-900 text-white shadow-soft'
                  : 'bg-white text-navy-600 border border-cream-200 hover:bg-cream-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'requests' && pendingRequestsCount > 0 && (
                <span className="bg-rose-deep text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {pendingRequestsCount}
                </span>
              )}
              {tab.id === 'saved' && savedCount > 0 && (
                <span className="bg-cream-200 text-navy-600 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {savedCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ===== التخطيط: شريط جانبي + محتوى ===== */}
        <div className="flex gap-5 items-start">
          {/* الشريط الجانبي - ديسكتوب فقط */}
          <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-4">
            {sidebar}
          </aside>

          {/* المحتوى الرئيسي */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'account' && <AccountTab name={name} onLogout={handleLogout} onRequestVerification={() => setShowVerificationModal(true)} />}
                {activeTab === 'saved' && <SavedTab />}
                {activeTab === 'subscription' && <SubscriptionTab currentPlan={prof.plan} plans={plans} />}
                {activeTab === 'requests' && <RequestsTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Verification Upload Modal */}
      <VerificationUploadModal open={showVerificationModal} onClose={() => setShowVerificationModal(false)} />
    </div>
  );
}

/* ===== Account Tab (merged overview + settings) ===== */
function AccountTab({ name, onLogout, onRequestVerification }: { name: string; onLogout: () => void; onRequestVerification: () => void }) {
  const { showToast, user, profileData, updateAccountInfo, allowProfileHiding, isProfileHidden, toggleProfileHiding } = useApp();
  const accProfile = { ...(user?.profile || DEFAULT_PROFILE), ...profileData };

  const [notifSettings, setNotifSettings] = useState({
    likes: true, messages: true,
  });

  // حالة نافذة تغيير كلمة المرور
  const [showPassModal, setShowPassModal] = useState(false);
  const [passForm, setPassForm] = useState({ current: '', next: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [passError, setPassError] = useState('');

  // حالة نافذة تعديل معلومات الحساب
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({
    realName: accProfile.realName || '',
    email: accProfile.email || '',
    phone: accProfile.phone || '',
    whatsapp: accProfile.whatsapp || '',
  });

  const handleToggle = (key: keyof typeof notifSettings) => {
    setNotifSettings(prev => ({ ...prev, [key]: !prev[key] }));
    showToast('تم تحديث إعدادات الإشعارات', 'success');
  };

  const handleChangePassword = () => {
    setPassError('');
    if (!passForm.current) { setPassError('الرجاء إدخال كلمة المرور الحالية'); return; }
    if (passForm.current !== accProfile.password) { setPassError('كلمة المرور الحالية غير صحيحة'); return; }
    if (passForm.next.length < 6) { setPassError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'); return; }
    if (passForm.next !== passForm.confirm) { setPassError('كلمتا المرور غير متطابقتين'); return; }
    updateAccountInfo({ password: passForm.next });
    showToast('تم تغيير كلمة المرور بنجاح ✓', 'success');
    setShowPassModal(false);
    setPassForm({ current: '', next: '', confirm: '' });
  };

  const handleSaveAccount = () => {
    if (!accountForm.realName.trim()) { showToast('الرجاء إدخال الاسم الرباعي', 'error'); return; }
    if (!accountForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountForm.email)) {
      showToast('البريد الإلكتروني غير صحيح', 'error'); return;
    }
    updateAccountInfo(accountForm);
    showToast('تم تحديث معلومات الحساب بنجاح ✓', 'success');
    setShowAccountModal(false);
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-gold-gradient' : 'bg-cream-200'}`}
    >
      <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'right-1' : 'right-6'}`} />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* === القسم 1: إجراءات سريعة === */}
      <div>
        <h3 className="font-cairo font-bold text-navy-900 mb-3 px-1">إجراءات سريعة</h3>
        <div className="space-y-3">
          {/* زر تعديل الملف الشخصي */}
          <Link
            to="/edit-profile"
            className="flex items-center justify-between gap-3 bg-gold-gradient rounded-2xl p-4 shadow-gold hover:-translate-y-0.5 transition-all group no-tap-highlight"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-navy-900/10 flex items-center justify-center">
                <Edit3 className="w-5 h-5 text-navy-900" />
              </div>
              <div>
                <h4 className="font-cairo font-bold text-navy-900">تعديل الملف الشخصي</h4>
                <p className="text-xs text-navy-800/70 font-tajawal">حدّث معلوماتك ونبذتك</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-navy-900 group-hover:-translate-x-1 transition-transform" />
          </Link>

          {/* زر أكمل ملفك الشخصي */}
          <Link
            to="/complete-profile"
            className="flex items-center justify-between gap-3 bg-white rounded-2xl p-4 shadow-soft border border-cream-200/60 hover:shadow-luxe hover:border-gold-300 transition-all group no-tap-highlight"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-cairo font-bold text-navy-900">
                  {(accProfile.profileCompletion || 0) >= 100 ? 'ملفك الشخصي مكتمل 100% ✓' : 'أكمل ملفك الشخصي'}
                </h4>
                <p className="text-xs text-navy-500 font-tajawal">
                  {(accProfile.profileCompletion || 0) >= 100
                    ? 'جميع بياناتك مسجلة بالكامل بنجاح'
                    : 'املأ الحقول الناقصة لزيادة فرص التوافق'}
                </p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-navy-300 group-hover:text-gold-600 transition-colors" />
          </Link>

          {/* باقي الإجراءات */}
          {[
            { icon: ShieldCheck, label: 'التحقق من الحساب', desc: 'احصل على شارة التوثيق', color: 'bg-sky-100 text-sky-600', action: () => onRequestVerification() },
            { icon: Gift, label: 'ادعُ صديقًا', desc: 'احصل على مكافآت', color: 'bg-rose-deep/10 text-rose-deep', action: () => showToast('رابط الدعوة: tawasul.sa/r/' + name, 'success') },
          ].map((item) => (
            <QuickActionItem key={item.label} item={item} />
          ))}
        </div>
      </div>

      {/* === القسم 2: معلومات الحساب === */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-cairo font-bold text-navy-900">معلومات الحساب</h3>
          <button
            onClick={() => setShowAccountModal(true)}
            className="text-xs text-gold-700 font-cairo font-bold hover:underline"
          >
            تعديل المعلومات
          </button>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-soft border border-cream-200/60">
          <div className="space-y-1">
            {/* الاسم الرباعي */}
            <div className="flex items-center justify-between gap-3 py-3 border-b border-cream-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-navy-500" />
                </div>
                <span className="text-sm text-navy-500 font-tajawal">الاسم الرباعي</span>
              </div>
              <span className="text-sm font-cairo font-semibold text-navy-900 truncate">{accProfile.realName || 'غير محدد'}</span>
            </div>
            {/* البريد الإلكتروني */}
            <div className="flex items-center justify-between gap-3 py-3 border-b border-cream-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-navy-500" />
                </div>
                <span className="text-sm text-navy-500 font-tajawal">البريد الإلكتروني</span>
              </div>
              <span className="text-sm font-cairo font-semibold text-navy-900 truncate">{accProfile.email || 'غير محدد'}</span>
            </div>
            {/* رقم الهاتف */}
            <div className="flex items-center justify-between gap-3 py-3 border-b border-cream-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-navy-500" />
                </div>
                <span className="text-sm text-navy-500 font-tajawal">رقم الهاتف</span>
              </div>
              <span className="text-sm font-cairo font-semibold text-navy-900 truncate">{accProfile.phone || 'غير محدد'}</span>
            </div>
            {/* كلمة المرور */}
            <div className="flex items-center justify-between gap-3 py-3 border-b border-cream-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-4 h-4 text-navy-500" />
                </div>
                <span className="text-sm text-navy-500 font-tajawal">كلمة المرور</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-cairo font-semibold text-navy-900">••••••••</span>
                <button
                  onClick={() => setShowPassModal(true)}
                  className="text-xs text-gold-700 font-cairo font-bold hover:underline whitespace-nowrap"
                >
                  تغيير
                </button>
              </div>
            </div>
            {/* المدينة */}
            <div className="flex items-center justify-between gap-3 py-3 border-b border-cream-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-navy-500" />
                </div>
                <span className="text-sm text-navy-500 font-tajawal">المدينة</span>
              </div>
              <span className="text-sm font-cairo font-semibold text-navy-900 truncate">{accProfile.city || 'الرياض'}</span>
            </div>
            {/* العمر */}
            <div className="flex items-center justify-between gap-3 py-3 border-b border-cream-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-navy-500" />
                </div>
                <span className="text-sm text-navy-500 font-tajawal">العمر</span>
              </div>
              <span className="text-sm font-cairo font-semibold text-navy-900 truncate">{accProfile.age || 26} سنة</span>
            </div>

            {/* نوع الزواج المطلوب */}
            <div className="flex items-center justify-between gap-3 py-3 border-b border-cream-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-sm text-navy-500 font-tajawal">نوع الزواج المطلوب</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-cairo font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  {(accProfile.marriageType || profileData?.marriageType) === 'misyar' ? 'مسيار' : (accProfile.marriageType || profileData?.marriageType) === 'both' ? 'لا مانع / معلن او مسيار' : 'معلن'}
                </span>
                <Link to="/edit-profile" className="text-xs text-gold-700 font-cairo font-bold hover:underline">
                  تعديل
                </Link>
              </div>
            </div>

            {/* القبيلة / النسب */}
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4 text-navy-500" />
                </div>
                <span className="text-sm text-navy-500 font-tajawal">القبيلة / النسب</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-cairo font-semibold text-navy-900 truncate">
                  {(accProfile.tribe || profileData?.tribe) || 'غير محدد'}
                </span>
                <Link to="/edit-profile" className="text-xs text-gold-700 font-cairo font-bold hover:underline">
                  تعديل
                </Link>
              </div>
            </div>

            {/* إخفاء الحساب مؤقتاً (يظهر فقط إذا سمح المشرف من الإعدادات) */}
            {allowProfileHiding && (
              <div className="flex items-center justify-between gap-3 py-3 border-t border-cream-100 mt-2 pt-3" id="profile-hiding-toggle-wrapper">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <EyeOff className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-right">
                    <span className="block text-sm text-navy-800 font-cairo font-bold">إخفاء الحساب مؤقتاً</span>
                    <span className="block text-[10px] text-navy-400 font-tajawal">إخفاء ملفك من نتائج البحث مؤقتاً مع بقاء المحادثات</span>
                  </div>
                </div>
                <Toggle checked={isProfileHidden} onChange={toggleProfileHiding} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === القسم 3: إعدادات الإشعارات === */}
      <div>
        <h3 className="font-cairo font-bold text-navy-900 mb-3 px-1">إعدادات الإشعارات</h3>
        <div className="bg-white rounded-2xl p-5 shadow-soft border border-cream-200/60">
          <div className="space-y-1">
            {[
              { key: 'likes' as const, label: 'المحفوظات والاهتمامات', desc: 'عندما يحفظ شخص ملفك أو يبدي اهتماماً بك' },
              { key: 'messages' as const, label: 'رسائل الإدارة', desc: 'عند استقبال رسالة جديدة' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 py-3 border-b border-cream-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-cairo font-semibold text-navy-800 text-sm">{item.label}</p>
                  <p className="text-xs text-navy-400 font-tajawal">{item.desc}</p>
                </div>
                <Toggle checked={notifSettings[item.key]} onChange={() => handleToggle(item.key)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* === القسم 4: روابط سريعة === */}
      <div>
        <h3 className="font-cairo font-bold text-navy-900 mb-3 px-1">روابط سريعة</h3>
        <div className="bg-white rounded-2xl p-3 shadow-soft border border-cream-200/60">
          <div className="space-y-1">
            {[
              { icon: ShieldCheck, label: 'الشروط والأحكام', to: '/terms', color: 'text-sky-600' },
              { icon: Headphones, label: 'الدعم الفني', to: '/support', color: 'text-gold-600' },
              { icon: Sparkles, label: 'ادعُ صديقًا', action: () => showToast('رابط الدعوة تم نسخه ✓', 'success'), color: 'text-rose-deep' },
            ].map((item) => {
              const inner = (
                <>
                  <item.icon className={`w-4.5 h-4.5 ${item.color}`} />
                  <span className="flex-1 font-cairo font-semibold text-sm text-navy-800">{item.label}</span>
                  <ChevronLeft className="w-4 h-4 text-navy-300" />
                </>
              );
              return item.to ? (
                <Link key={item.label} to={item.to} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-cream-100 transition-colors no-tap-highlight">{inner}</Link>
              ) : (
                <button key={item.label} onClick={item.action} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-cream-100 transition-colors text-right no-tap-highlight">{inner}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* === زر تسجيل الخروج (موبايل) === */}
      <button
        onClick={onLogout}
        className="lg:hidden w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-white border-2 border-rose-deep/20 text-rose-deep font-cairo font-bold hover:bg-rose-deep/5 transition-colors active:scale-[0.98] no-tap-highlight"
      >
        <LogOut className="w-5 h-5" /> تسجيل الخروج
      </button>

      {/* === نافذة تغيير كلمة المرور === */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm" onClick={() => setShowPassModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-luxe border border-cream-200/60 p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-cairo font-bold text-lg text-navy-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-gold-600" /> تغيير كلمة المرور
              </h3>
              <button onClick={() => setShowPassModal(false)} className="w-8 h-8 rounded-full bg-cream-100 hover:bg-cream-200 flex items-center justify-center text-navy-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-cairo font-semibold text-navy-800 mb-2 block">كلمة المرور الحالية</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={passForm.current}
                    onChange={(e) => setPassForm(p => ({ ...p, current: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 transition-colors"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700">
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-cairo font-semibold text-navy-800 mb-2 block">كلمة المرور الجديدة</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={passForm.next}
                  onChange={(e) => setPassForm(p => ({ ...p, next: e.target.value }))}
                  placeholder="6 أحرف على الأقل"
                  className="w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-cairo font-semibold text-navy-800 mb-2 block">تأكيد كلمة المرور</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={passForm.confirm}
                  onChange={(e) => setPassForm(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 transition-colors"
                />
              </div>
              {passError && (
                <div className="flex items-center gap-2 text-sm text-rose-deep font-tajawal">
                  <AlertCircle className="w-4 h-4" /> {passError}
                </div>
              )}
              <button
                onClick={handleChangePassword}
                className="w-full py-3 rounded-xl bg-gold-gradient text-navy-900 font-cairo font-bold hover:shadow-gold transition-all no-tap-highlight"
              >
                حفظ كلمة المرور
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* === نافذة تعديل معلومات الحساب === */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm" onClick={() => setShowAccountModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-luxe border border-cream-200/60 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-cairo font-bold text-lg text-navy-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-gold-600" /> تعديل معلومات الحساب
              </h3>
              <button onClick={() => setShowAccountModal(false)} className="w-8 h-8 rounded-full bg-cream-100 hover:bg-cream-200 flex items-center justify-center text-navy-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-navy-600 font-tajawal">هذه البيانات سرية بالكامل ولا تظهر لأي عضو. تستخدمها الإدارة للتواصل معك فقط.</p>
              </div>
              <div>
                <label className="text-sm font-cairo font-semibold text-navy-800 mb-2 block">الاسم الرباعي الحقيقي</label>
                <input
                  value={accountForm.realName}
                  onChange={(e) => setAccountForm(p => ({ ...p, realName: e.target.value }))}
                  placeholder="الاسم الكامل"
                  className="w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-cairo font-semibold text-navy-800 mb-2 block">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={accountForm.email}
                  onChange={(e) => setAccountForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="example@email.com"
                  className="w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-cairo font-semibold text-navy-800 mb-2 block">رقم الواتساب للتواصل والإدارة</label>
                <PhoneInputWithCountryCode
                  value={accountForm.whatsapp || accountForm.phone || ''}
                  onChange={(val) => setAccountForm(p => ({ ...p, whatsapp: val, phone: val }))}
                  placeholder="501234567"
                />
              </div>
              <button
                onClick={handleSaveAccount}
                className="w-full py-3 rounded-xl bg-gold-gradient text-navy-900 font-cairo font-bold hover:shadow-gold transition-all no-tap-highlight"
              >
                حفظ التغييرات
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

interface QuickActionItem {
  icon: typeof Edit3;
  label: string;
  desc: string;
  color: string;
  to?: string;
  action?: () => void;
}

function QuickActionItem({ item }: { key?: any; item: QuickActionItem }) {
  const content = (
    <div className="flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
        <item.icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-cairo font-bold text-navy-900">{item.label}</h4>
        <p className="text-xs text-navy-500 font-tajawal">{item.desc}</p>
      </div>
      <ChevronLeft className="w-5 h-5 text-navy-300 group-hover:text-gold-600 transition-colors" />
    </div>
  );

  if (item.to) {
    return (
      <Link to={item.to} className="block bg-white rounded-2xl p-4 shadow-soft border border-cream-200/60 hover:shadow-luxe hover:border-gold-300 transition-all group no-tap-highlight">
        {content}
      </Link>
    );
  }
  return (
    <button onClick={item.action} className="w-full text-right bg-white rounded-2xl p-4 shadow-soft border border-cream-200/60 hover:shadow-luxe hover:border-gold-300 transition-all group no-tap-highlight">
      {content}
    </button>
  );
}

/* ===== Subscription Tab ===== */
function SubscriptionTab({ currentPlan, plans }: { currentPlan: string; plans: Plan[] }) {
  const { enableProfileBoosting, boostProfile, isBoosted, showToast } = useApp();
  const plan = plans.find(p => p.id === (currentPlan === 'gold' ? 'premium' : currentPlan === 'elite' ? 'elite' : 'free')) || plans[1];
  const renewalDate = 'غير منتهية';

  return (
    <div className="space-y-4">
      {/* Current plan card */}
      <div className="bg-navy-gradient rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 pattern-arabesque opacity-30" />
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-gold-500/20 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-gold-300" />
              <span className="font-cairo font-bold text-white text-lg">باقتك الحالية</span>
            </div>
            <span className="px-3 py-1 rounded-full bg-gold-gradient text-navy-900 text-xs font-cairo font-bold">
              {plan.name}
            </span>
          </div>
          <div className="space-y-2 text-sm font-tajawal text-cream-200/80">
            <div className="flex items-center justify-between">
              <span>المدة</span>
              <span className="text-white font-semibold">{renewalDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>السعر</span>
              <span className="text-white font-semibold">{plan.price} ر.س / شهريًا</span>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Link to="/checkout/gold" className="flex-1 text-center py-2.5 rounded-xl bg-gold-gradient text-navy-900 font-cairo font-bold text-sm no-tap-highlight">
              تجديد الباقة
            </Link>
            <Link to="/plans" className="flex-1 text-center py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-cairo font-bold text-sm hover:bg-white/15 transition-colors no-tap-highlight">
              ترقية الباقة
            </Link>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-2xl p-5 shadow-soft border border-cream-200/60">
        <h3 className="font-cairo font-bold text-navy-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-gold-600" /> سجل المدفوعات
        </h3>
        <div className="space-y-3">
          {[
            { desc: 'باقة ذهبية - شهري', amount: 99, date: '15 يناير 2025', status: 'مدفوع' },
            { desc: 'باقة ذهبية - شهري', amount: 99, date: '15 ديسمبر 2024', status: 'مدفوع' },
            { desc: 'باقة ذهبية - شهري', amount: 99, date: '15 نوفمبر 2024', status: 'مدفوع' },
          ].map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-cream-100 last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-cairo font-semibold text-navy-800 truncate">{p.desc}</p>
                  <p className="text-xs text-navy-400 font-tajawal">{p.date}</p>
                </div>
              </div>
              <div className="text-left flex-shrink-0">
                <p className="font-cairo font-bold text-navy-900 text-sm">{p.amount} ر.س</p>
                <p className="text-[10px] text-emerald-600 font-tajawal">{p.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Profile boosting (show only if enabled by admin) */}
      {enableProfileBoosting && (
        <div className="bg-gradient-to-r from-amber-500/10 to-gold-500/10 border border-amber-500/20 rounded-2xl p-5 shadow-soft mt-4 text-right" id="profile-boosting-card">
          <div className="flex items-center gap-3 justify-between mb-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 flex-shrink-0">
                <Zap className="w-5 h-5 fill-amber-500" />
              </div>
              <div>
                <h4 className="font-cairo font-bold text-navy-900 text-sm">ميزة تمييز وتعزيز الملف</h4>
                <p className="text-xs text-navy-500 font-tajawal">ضاعف ظهورك في أعلى نتائج البحث للحصول على توافق أسرع</p>
              </div>
            </div>
            {isBoosted && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-cairo font-bold flex items-center gap-1">
                <Check className="w-3 h-3" /> نشط حالياً
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (isBoosted) {
                showToast('ملفك الشخصي معزز ونشط حالياً في أعلى نتائج البحث ✓', 'info');
              } else {
                boostProfile();
                showToast('تم تمييز وتعزيز ملفك الشخصي بنجاح! سيظهر في الصدارة لـ 24 ساعة ✓', 'success');
              }
            }}
            className={`w-full py-2.5 rounded-xl font-cairo font-bold text-sm transition-all ${
              isBoosted
                ? 'bg-cream-200 text-navy-600 cursor-default'
                : 'bg-gradient-to-r from-amber-500 to-gold-600 text-white shadow-md hover:brightness-105 active:scale-[0.99]'
            }`}
          >
            {isBoosted ? 'تم تمييز ملفك الشخصي في الصدارة ✨' : 'تمييز الملف الشخصي الآن (99 ر.س)'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ===== Requests Tab ===== */
function RequestsTab() {
  const [filter, setFilter] = useState<'received' | 'sent'>('received');
  const { interestRequests: requests, adminUpdateInterestRequestStatus: handleAction, members, user } = useApp();

  const getMemberById = (id: string) => members.find(m => m.id === id);

  const filtered = requests.filter(r => filter === 'received' ? r.receiverId === user.memberId : r.senderId === user.memberId);
  const receivedPending = requests.filter(r => r.receiverId === user.memberId && r.status === 'pending').length;

  const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    pending: { label: 'معلّق', color: 'text-gold-600 bg-gold-300/15', icon: Clock },
    accepted_pending_admin: { label: 'بانتظار موافقة الإدارة ⏳', color: 'text-blue-600 bg-blue-50', icon: Clock },
    accepted_pending_payment: { label: 'بانتظار الدفع', color: 'text-orange-600 bg-orange-100', icon: CreditCard },
    paid: { label: 'مدفوع', color: 'text-emerald-600 bg-emerald-50', icon: CheckCheck },
    in_mediation: { label: 'في الوساطة', color: 'text-blue-600 bg-blue-100', icon: Headphones },
    completed: { label: 'مكتمل', color: 'text-emerald-700 bg-emerald-700 text-white', icon: CheckCheck },
    declined: { label: 'مرفوض', color: 'text-rose-deep bg-rose-50', icon: X },
    cancelled: { label: 'ملغى', color: 'text-navy-400 bg-cream-100', icon: X },
  };

  return (
    <div className="space-y-4">
      {/* Mediation note */}
      <div className="bg-gold-300/10 rounded-2xl p-3 border border-gold-500/20 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-gold-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-navy-600 font-tajawal">جميع الطلبات تُعالج عبر فريق الإدارة بسرية تامة</p>
      </div>

      {/* Link to full page */}
      <Link to="/requests" className="flex items-center justify-between gap-3 bg-navy-900 rounded-2xl p-4 text-white hover:bg-navy-800 transition-colors group no-tap-highlight">
        <div className="flex items-center gap-3">
          <Inbox className="w-5 h-5 text-gold-400" />
          <div>
            <h4 className="font-cairo font-bold text-sm">عرض جميع الطلبات والتتبع التفصيلي</h4>
            <p className="text-xs text-cream-200/60 font-tajawal">صفحة الطلبات الكاملة مع الفلاتر والمتابعة</p>
          </div>
        </div>
        <ChevronLeft className="w-5 h-5 text-gold-400 group-hover:-translate-x-1 transition-transform" />
      </Link>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('received')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-cairo font-semibold text-sm transition-all no-tap-highlight ${
            filter === 'received' ? 'bg-navy-900 text-white shadow-soft' : 'bg-white text-navy-600 border border-cream-200'
          }`}
        >
          <Inbox className="w-4 h-4" /> الواردة
          {receivedPending > 0 && <span className="bg-rose-deep text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{receivedPending}</span>}
        </button>
        <button
          onClick={() => setFilter('sent')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-cairo font-semibold text-sm transition-all no-tap-highlight ${
            filter === 'sent' ? 'bg-navy-900 text-white shadow-soft' : 'bg-white text-navy-600 border border-cream-200'
          }`}
        >
          <Send className="w-4 h-4" /> المُرسلة
        </button>
      </div>

      {/* Requests list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-cream-200/60">
            <Inbox className="w-12 h-12 text-navy-200 mx-auto mb-2" />
            <p className="text-navy-500 font-tajawal">لا توجد طلبات {filter === 'received' ? 'واردة' : 'مُرسلة'}</p>
          </div>
        ) : (
          filtered.slice(0, 5).map((req, idx) => {
            const partnerId = req.senderId === user.memberId ? req.receiverId : req.senderId;
            const member = getMemberById(partnerId);
            if (!member) return null;
            const sc = statusConfig[req.status] || statusConfig.pending;
            const isReceivedType = req.receiverId === user.memberId;
            const isActive = ['pending', 'accepted_pending_admin', 'accepted_pending_payment', 'paid', 'in_mediation'].includes(req.status);
            const reqKey = (req?.id !== undefined && req?.id !== null && !Number.isNaN(Number(req.id))) ? `prof-req-${req.id}-${idx}` : `prof-req-idx-${idx}`;
            return (
              <div key={reqKey} className="bg-white rounded-2xl p-4 shadow-soft border border-cream-200/60">
                <div className="flex items-start gap-3">
                  <Link to={`/member/${member.id}`} className="flex-shrink-0">
                    <img src={getAvatar(member.gender)} alt="" className="w-14 h-14 rounded-2xl object-contain bg-cream-100 p-1.5" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Link to={`/member/${member.id}`} className="font-cairo font-bold text-navy-900 hover:text-gold-700 transition-colors">
                        {member.nickname}
                      </Link>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.color} flex items-center gap-1`}>
                        <sc.icon className="w-3 h-3" /> {sc.label}
                      </span>
                    </div>
                    <p className="text-sm text-navy-600 font-tajawal leading-relaxed mb-1 line-clamp-2">{req.message}</p>
                    <p className="text-xs text-navy-400 font-tajawal mb-2">{req.time}</p>

                    {isReceivedType && req.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleAction(req.id, 'accepted_pending_admin')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-cairo font-bold hover:bg-emerald-700 transition-colors no-tap-highlight">
                          <Check className="w-3.5 h-3.5" /> قبول
                        </button>
                        <button onClick={() => handleAction(req.id, 'declined', 'لم يتم ذكر سبب')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cream-100 text-navy-600 text-xs font-cairo font-bold hover:bg-cream-200 transition-colors no-tap-highlight">
                          <X className="w-3.5 h-3.5" /> رفض
                        </button>
                      </div>
                    )}
                    {isActive && req.status !== 'pending' && (
                      <Link to="/requests" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-navy-900 text-white text-xs font-cairo font-bold hover:bg-navy-800 transition-colors no-tap-highlight">
                        <Headphones className="w-3.5 h-3.5" /> تواصل مع الإدارة
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filtered.length > 5 && (
        <Link to="/requests" className="block text-center py-3 rounded-2xl bg-white border border-cream-200 text-gold-700 font-cairo font-bold text-sm hover:bg-cream-50 transition-colors no-tap-highlight">
          عرض جميع الطلبات ({filtered.length})
        </Link>
      )}
    </div>
  );
}

/* ===== Saved Tab ===== */
function SavedTab() {
  const { likedMembers, members } = useApp();
  const savedList = members.filter(m => likedMembers.has(m.id) && (!m.status || m.status === 'active'));

  return (
    <div className="space-y-4">
      {/* Informative note */}
      <div className="bg-gold-300/10 rounded-2xl p-3 border border-gold-500/20 flex items-start gap-2">
        <Bookmark className="w-4 h-4 text-gold-600 flex-shrink-0 mt-0.5 fill-gold-600" />
        <p className="text-xs text-navy-600 font-tajawal">هنا تجد جميع ملفات الأعضاء التي قمت بحفظها للرجوع إليها والاطلاع عليها لاحقًا.</p>
      </div>

      {savedList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-cream-200/60 shadow-soft">
          <Bookmark className="w-12 h-12 text-navy-200 mx-auto mb-2" />
          <p className="font-cairo font-bold text-navy-800 text-base mb-1">قائمتك فارغة</p>
          <p className="text-xs text-navy-400 font-tajawal mb-4">تصفّح ملفات الأعضاء واضغط على زر الحفظ لإضافتهم هنا.</p>
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-900 text-white font-cairo font-bold text-xs hover:bg-navy-800 transition-colors no-tap-highlight"
          >
            ابدأ تصفح الأعضاء
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4">
          {savedList.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}
