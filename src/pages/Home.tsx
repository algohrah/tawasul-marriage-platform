import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Lock, BadgeCheck, Heart, Search, Send,
  Sparkles, ArrowLeft, Star, Quote, Users, TrendingUp, Clock,
  HeartHandshake, CalendarClock, PartyPopper, ChevronLeft, ChevronRight,
  UserPlus, ShieldAlert, Eye, FileCheck, CheckCircle2, MapPin, Globe,
} from 'lucide-react';
import { ButtonLink, Button } from '../components/ui/Button';
import MemberCard from '../components/MemberCard';
import SectionHeading from '../components/layout/SectionHeading';
import SectionDivider from '../components/ui/SectionDivider';
import { TESTIMONIALS } from '../lib/data';
import { useApp } from '../lib/AppContext';
import { MemberGridSkeleton } from '../components/ui/MemberCardSkeleton';
import { getMemberTimestamp } from '../lib/memberUtils';
import { dataService } from '../lib/data/DataService';
import { COUNTRIES, CITIES_BY_COUNTRY } from '../lib/constants';

const trustPillars = [
  {
    icon: Users,
    title: 'تنسيق وتعاون مع الخطابات',
    desc: 'ربط مباشر وتعاون مع شبكة واسعة من الخطابات ومكاتب التوفيق المعتمدة.',
    color: 'text-gold-300',
    bg: 'bg-gold-500/10 border-gold-500/20',
  },
  {
    icon: ShieldCheck,
    title: 'متابعة وتصفية مستمرة',
    desc: 'مراجعة وتحديث مستمر للملفات وحذف الحسابات غير الجادة لضمان نقاء المنصة.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: Lock,
    title: 'خصوصية وسرية تامة',
    desc: 'حماية كاملة للبيانات الحساسة وعدم مشاركة وسائل التواصل إلا بموافقة صريحة.',
    color: 'text-blue-300',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: Sparkles,
    title: 'بيئة للزواج الجاد',
    desc: 'منصة مخصصة حصراً لتيسير الزواج الشرعي وبناء الأسرة وفق الضوابط.',
    color: 'text-rose-300',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
];

const features = [
  { icon: Users, title: 'شبكة واسعة من الخطابات', desc: 'تجمع وتعاون مستمر مع نخبة من الخطابات ومكاتب التوفيق لتوسيع فرص التوافق.' },
  { icon: Lock, title: 'خصوصية وحماية البيانات', desc: 'بياناتك الحساسة مشفّرة ومحمية، وتتحكم أنت بمن يراها بكل أمان.' },
  { icon: Search, title: 'بحث وفلاتر دقيقة', desc: 'تصفية ذكية حسب الدولة، المدينة، العمر، والمواصفات الشرعية والاجتماعية.' },
  { icon: ShieldCheck, title: 'إشراف ومتابعة إدارية', desc: 'متابعة نشطة للملفات وحذف غير الجادين وتنسيق التواصل باحترام وسرية.' },
];

const journeyStages = [
  { icon: Send, title: 'أرسل طلب توافق', desc: 'اختر الشخص المناسب لمواصفاتك وأرسل له طلب توافق لتبدأ خطوة التعارف الجاد.', accent: 'text-amber-600 bg-amber-50' },
  { icon: HeartHandshake, title: 'الموافقة المبدئية', desc: 'عندما يوافق الطرف الآخر على طلبك، يبدأ مسار التنسيق المباشر بينكما.', accent: 'text-emerald-600 bg-emerald-50' },
  { icon: ShieldCheck, title: 'تأكيد الجدية', desc: 'رسوم جدية لمرة واحدة تضمن صدق رغبة الطرفين وتحفظ وقت الجميع.', accent: 'text-amber-700 bg-amber-50' },
  { icon: CalendarClock, title: 'التنسيق والوساطة', desc: 'تتولى إدارة المنصة والوسيطة ترتيب خطوات التواصل والإشراف عليها.', accent: 'text-blue-600 bg-blue-50' },
  { icon: Users, title: 'النظرة والتواصل الشرعي', desc: 'تبادل بيانات التواصل والتنسيق مع ولي الأمر للرؤية الشرعية وفق الأصول.', accent: 'text-indigo-600 bg-indigo-50' },
  { icon: PartyPopper, title: 'إتمام التوافق', desc: 'التوفيق والبركة نحو إتمام الزواج وبناء الأسرة المستقرة.', accent: 'text-emerald-700 bg-emerald-50' },
];

const securityPoints = [
  { icon: ShieldCheck, text: 'متابعة دورية للملفات وحذف غير الجادين باستمرار', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  { icon: Lock, text: 'تشفير كامل وحماية لبيانات التواصل والخصوصية', color: 'text-gold-300', bg: 'bg-gold-500/15' },
  { icon: BadgeCheck, text: 'توثيق اختياري بشارة معتمدة لمن يرغب بتوثيق الهوية', color: 'text-blue-300', bg: 'bg-blue-500/15' },
];

export default function Home() {
  const navigate = useNavigate();
  const { members, membersLoading, currentUser, user } = useApp();
  const isLoggedIn = !!(currentUser || user?.isLoggedIn);

  // ===== الفلتر السريع في الـ Hero =====
  const [quickGender, setQuickGender] = useState<'female' | 'male' | 'all'>('female');
  const [quickCountry, setQuickCountry] = useState<string>('السعودية');
  const [quickCity, setQuickCity] = useState<string>('');

  useEffect(() => {
    dataService.db.ensureGeoLoaded?.().catch(() => undefined);
  }, []);

  const countryOptions = useMemo(() => {
    const db = dataService.db.getCountryNames?.() || [];
    return db.length ? db : COUNTRIES;
  }, []);

  const cityOptions = useMemo(() => {
    if (!quickCountry) return [];
    const db = dataService.db.getCities?.(quickCountry) || [];
    return db.length ? db : (CITIES_BY_COUNTRY[quickCountry] || []);
  }, [quickCountry]);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (quickGender && quickGender !== 'all') params.set('gender', quickGender);
    if (quickCountry) params.set('country', quickCountry);
    if (quickCity) params.set('city', quickCity);
    navigate(`/search?${params.toString()}`);
  };

  // ===== تبويب قسم الأعضاء (الافتراضي: المميزون في المقدمة) =====
  const [membersTab, setMembersTab] = useState<'featured' | 'new'>('featured');

  // ===== Carousel قصص النجاح =====
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  const activeMembersOnly = useMemo(() => {
    const seen = new Set<string>();
    return members.filter((m, idx) => {
      if (!m) return false;
      if (m.status && m.status !== 'active') return false;
      if (!(m.nickname || m.realName || m.id)) return false;
      const key = m.id || `idx-${idx}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [members]);

  const canShowOnHome = (member: any) => {
    return !!(member.nickname || member.realName || member.id);
  };

  const featuredMembers = useMemo(() => {
    return [...activeMembersOnly]
      .filter(canShowOnHome)
      .sort((a, b) => {
        const pinA = a.pinned ? 1 : 0;
        const pinB = b.pinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;

        const getPlanScore = (member: any) => {
          const plan = member.plan || (member.premium ? 'elite' : 'free');
          if (plan === 'elite') return 100;
          if (plan === 'gold') return 50;
          if (member.hasSeriousnessBadge) return 30;
          if (member.verified) return 20;
          if (member.sourceType === 'imported') return 15;
          return 5;
        };
        const scoreA = getPlanScore(a);
        const scoreB = getPlanScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;

        const timeA = getMemberTimestamp(a);
        const timeB = getMemberTimestamp(b);
        if (timeA !== timeB) return timeB - timeA;

        return b.id.localeCompare(a.id);
      })
      .slice(0, 12);
  }, [activeMembersOnly]);

  const newMembers = useMemo(() => {
    return [...activeMembersOnly]
      .filter(canShowOnHome)
      .sort((a, b) => {
        const pinA = a.pinned ? 1 : 0;
        const pinB = b.pinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;

        const timeA = getMemberTimestamp(a);
        const timeB = getMemberTimestamp(b);
        if (timeA !== timeB) return timeB - timeA;

        const getPlanScore = (member: any) => {
          const plan = member.plan || (member.premium ? 'elite' : 'free');
          if (plan === 'elite') return 100;
          if (plan === 'gold') return 50;
          return 10;
        };
        const scoreA = getPlanScore(a);
        const scoreB = getPlanScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;

        return b.id.localeCompare(a.id);
      })
      .slice(0, 12);
  }, [activeMembersOnly]);

  const activeMembers = membersTab === 'featured' ? featuredMembers : newMembers;

  const nextTestimonial = () => setTestimonialIdx((prev) => (prev + 1) % TESTIMONIALS.length);
  const prevTestimonial = () => setTestimonialIdx((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  const activeTestimonial = TESTIMONIALS[testimonialIdx];

  return (
    <div>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-navy-gradient pb-6 pt-2">
        <div className="absolute inset-0 pattern-islamic opacity-40" />
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-gold-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-rose-deep/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8 lg:pt-12 lg:pb-10">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            {/* النص والتقديم */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7 text-center lg:text-right flex flex-col items-center lg:items-start"
            >
              <span className="badge-shimmer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gold-500/15 border border-gold-500/30 text-gold-300 text-xs font-cairo font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                تجمع وتعاون مع شبكة خطابات ومكاتب التوفيق
              </span>

              <h1 className="font-cairo font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white leading-[1.2] text-shadow-gold">
                ابدأ رحلة العمر مع
                <span className="block text-gradient-gold mt-1.5">شريك الحياة المناسب</span>
              </h1>

              <p className="mt-3.5 text-base text-cream-200/90 font-tajawal leading-relaxed max-w-xl lg:max-w-lg">
                منصة تجمع وتنسق بين الباحثين الجادين ونخبة من الخطابات ومكاتب التوفيق، مع متابعة مستمرة وتصفية للحسابات غير الجادة لنوفر لك بيئة منظمة وآمنة للزواج الشرعي.
              </p>

              {/* أزرار الإجراء السريع */}
              <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start w-full sm:w-auto">
                {isLoggedIn ? (
                  <>
                    <ButtonLink to="/search" size="lg" className="shadow-gold w-full sm:w-auto">
                      <Search className="w-4 h-4" />
                      تصفّح كافة الأعضاء
                    </ButtonLink>
                    <ButtonLink to="/profile" variant="outline" size="lg" className="bg-white/5 hover:bg-white hover:text-navy-950 border border-white/40 text-white font-cairo font-bold transition-all duration-300 shadow-md w-full sm:w-auto">
                      <Heart className="w-4 h-4" />
                      ملفي الشخصي
                    </ButtonLink>
                  </>
                ) : (
                  <>
                    <ButtonLink to="/register" size="lg" className="shadow-gold w-full sm:w-auto">
                      <Heart className="w-4 h-4" />
                      ابدأ مجانًا الآن
                    </ButtonLink>
                    <ButtonLink to="/search" variant="outline" size="lg" className="bg-white/5 hover:bg-white hover:text-navy-950 border border-white/40 text-white font-cairo font-bold transition-all duration-300 shadow-md w-full sm:w-auto">
                      <Search className="w-4 h-4" />
                      تصفّح الأعضاء
                    </ButtonLink>
                  </>
                )}
              </div>

              {/* مؤشرات الثقة البارزة */}
              <div className="mt-5 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-xs text-cream-200/80 font-tajawal">
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-gold-300" /> شبكة خطابات معتمدة</span>
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> تصفية مستمرة لغير الجادين</span>
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-blue-300" /> خصوصية وسرية تامة</span>
              </div>
            </motion.div>

            {/* بطاقة الفلتر السريع الذكي للبحث */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="lg:col-span-5 w-full"
            >
              <div className="relative rounded-3xl bg-gradient-to-br from-navy-800/90 to-navy-950/95 backdrop-blur-md border border-gold-500/25 p-5 sm:p-6 shadow-luxe glow-gold">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gold-500/20 flex items-center justify-center text-gold-300">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-cairo font-bold text-white text-base leading-none">بحث سريع عن شريك</h3>
                      <p className="text-[11px] text-cream-200/70 font-tajawal mt-0.5">اختر المواصفات الأساسية وانتقل للبحث المتقدم</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-cairo bg-gold-500/15 text-gold-300 border border-gold-500/30 px-2 py-0.5 rounded-full">
                    مباشر
                  </span>
                </div>

                <form onSubmit={handleQuickSearch} className="space-y-3.5">
                  {/* اختيار الجنس */}
                  <div>
                    <label className="block text-xs font-cairo font-semibold text-cream-200/90 mb-1.5">
                      أبحث عن:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'female', label: 'عروس (امرأة)', icon: '👰' },
                        { value: 'male', label: 'عريس (رجل)', icon: '🤵' },
                        { value: 'all', label: 'الجميع', icon: '✨' },
                      ].map((item) => (
                        <button
                          type="button"
                          key={item.value}
                          onClick={() => setQuickGender(item.value as typeof quickGender)}
                          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-cairo font-bold transition-all border ${
                            quickGender === item.value
                              ? 'bg-gold-500 text-navy-950 border-gold-400 shadow-gold scale-[1.02]'
                              : 'bg-white/5 hover:bg-white/10 text-cream-100 border-white/10'
                          }`}
                        >
                          <span className="text-sm mb-0.5">{item.icon}</span>
                          <span className="text-[11px] whitespace-nowrap">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* اختيار الدولة */}
                  <div>
                    <label className="block text-xs font-cairo font-semibold text-cream-200/90 mb-1">
                      الدولة:
                    </label>
                    <div className="relative">
                      <select
                        value={quickCountry}
                        onChange={(e) => {
                          setQuickCountry(e.target.value);
                          setQuickCity('');
                        }}
                        className="w-full h-10 px-3 pr-8 rounded-xl bg-navy-900/90 border border-white/20 text-white text-xs font-tajawal focus:outline-none focus:border-gold-400 transition-colors appearance-none cursor-pointer"
                      >
                        <option value="">جميع الدول</option>
                        {countryOptions.map((c) => (
                          <option key={c} value={c} className="bg-navy-900 text-white">
                            {c}
                          </option>
                        ))}
                      </select>
                      <Globe className="w-4 h-4 text-gold-300/70 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* اختيار المدينة */}
                  <div>
                    <label className="block text-xs font-cairo font-semibold text-cream-200/90 mb-1">
                      المدينة:
                    </label>
                    <div className="relative">
                      <select
                        value={quickCity}
                        onChange={(e) => setQuickCity(e.target.value)}
                        disabled={!quickCountry || cityOptions.length === 0}
                        className="w-full h-10 px-3 pr-8 rounded-xl bg-navy-900/90 border border-white/20 text-white text-xs font-tajawal focus:outline-none focus:border-gold-400 transition-colors appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">{quickCountry ? 'جميع المدن' : 'اختر الدولة أولاً'}</option>
                        {cityOptions.map((ct) => (
                          <option key={ct} value={ct} className="bg-navy-900 text-white">
                            {ct}
                          </option>
                        ))}
                      </select>
                      <MapPin className="w-4 h-4 text-gold-300/70 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* زر البحث */}
                  <button
                    type="submit"
                    className="w-full mt-2 py-3 rounded-xl bg-gold-gradient text-navy-950 font-cairo font-extrabold text-sm shadow-gold hover:opacity-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    ابحث عن شريكك المناسب
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== 1. MEMBERS IN THE FOREFRONT (الأعضاء في المقدمة مباشرة) ===== */}
      <section className="py-12 lg:py-16 bg-white dark:bg-navy-950 border-b border-cream-200/50 dark:border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/10 dark:bg-gold-500/20 text-gold-700 dark:text-gold-300 font-cairo font-bold text-xs mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                ملفات متجددة باستمرار
              </span>
              <h2 className="font-cairo font-extrabold text-2xl sm:text-3xl lg:text-4xl text-navy-900 dark:text-cream-50">
                أعضاء مميزون <span className="text-amber-600 font-extrabold">يبحثون عن شريك الحياة</span>
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-navy-600 dark:text-slate-300 font-tajawal max-w-xl">
                تصفّح نخبة من الأعضاء المسجلين والمتابعين من قبل الإدارة والخطابات وفق المعايير والضوابط الشرعية.
              </p>
            </div>

            {/* تبويب الأعضاء وأزرار العرض */}
            <div className="flex items-center gap-3">
              <div className="inline-flex bg-cream-100 dark:bg-navy-900 rounded-2xl p-1 border border-cream-200/60 dark:border-navy-800">
                {[
                  { key: 'featured', label: '⭐ مميزون', count: featuredMembers.length },
                  { key: 'new', label: '✨ أحدث المنضمين', count: newMembers.length },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setMembersTab(tab.key as typeof membersTab)}
                    className={`px-4 sm:px-5 py-2 rounded-xl font-cairo font-bold text-xs sm:text-sm transition-all duration-300 ${
                      membersTab === tab.key
                        ? 'bg-white dark:bg-navy-950 text-gold-700 dark:text-gold-400 shadow-soft'
                        : 'text-navy-500 hover:text-navy-700 dark:text-cream-200/70 dark:hover:text-cream-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <Link
                to="/search"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold-500/10 hover:bg-gold-500/20 text-gold-700 dark:text-gold-300 font-cairo font-bold text-xs sm:text-sm transition-colors"
              >
                تصفح الكل
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* شبكة الأعضاء */}
          <AnimatePresence mode="wait">
            <motion.div
              key={membersTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5"
            >
              {membersLoading && activeMembers.length === 0 ? (
                <MemberGridSkeleton count={7} />
              ) : (
                activeMembers.slice(0, 7).map((m, idx) => (
                  <MemberCard key={m?.id ? `home-member-${m.id}-${idx}` : `home-member-idx-${idx}`} member={m} />
                ))
              )}

              {/* بطاقة "انضم إليهم" أو "استكشف المزيد" */}
              <Link
                to={isLoggedIn ? "/search" : "/register"}
                className="group rounded-2xl border-2 border-dashed border-gold-400/50 hover:border-gold-500 bg-gold-300/5 hover:bg-gold-300/10 transition-all duration-500 flex flex-col items-center justify-center p-6 min-h-[280px] text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gold-gradient flex items-center justify-center mb-4 shadow-gold group-hover:scale-110 transition-transform duration-500">
                  {isLoggedIn ? <Search className="w-8 h-8 text-navy-900" /> : <UserPlus className="w-8 h-8 text-navy-900" />}
                </div>
                <h3 className="font-cairo font-bold text-navy-900 dark:text-cream-50 text-base mb-1">
                  {isLoggedIn ? 'تصفّح كافة الأعضاء' : 'انضم إليهم الآن'}
                </h3>
                <p className="text-xs text-navy-500 dark:text-slate-400 font-tajawal">
                  {isLoggedIn ? 'ابحث وفلتر حسب مواصفات الشريك' : 'ابدأ رحلتك نحو شريك الحياة'}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-cairo font-bold text-gold-600 dark:text-gold-400 group-hover:translate-x-[-3px] transition-transform">
                  الانتقال للبحث المتقدم <ArrowLeft className="w-3.5 h-3.5" />
                </span>
              </Link>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 text-center sm:hidden">
            <ButtonLink to="/search" variant="outline" className="w-full">
              تصفّح كافة الأعضاء في البحث المتقدم <ArrowLeft className="w-4 h-4" />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ===== 2. TRUST PILLARS & MATCHMAKER NETWORK (ركائز الثقة والتعاون) ===== */}
      <section className="py-12 bg-cream-100/60 dark:bg-navy-900/60 border-b border-cream-200/50 dark:border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-xs font-cairo font-bold text-gold-600 dark:text-gold-400">منظومة موثوقة</span>
            <h3 className="font-cairo font-extrabold text-xl sm:text-2xl text-navy-900 dark:text-cream-50 mt-1">
              لماذا يثق الباحثون والخطابات في منصة توافق؟
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trustPillars.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-navy-950 border border-cream-200/80 dark:border-navy-800 shadow-soft hover:border-gold-500/40 transition-all duration-300"
              >
                <div className={`w-11 h-11 rounded-xl ${pillar.bg} border flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <pillar.icon className={`w-5 h-5 ${pillar.color}`} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-cairo font-bold text-navy-900 dark:text-cream-50 text-sm leading-tight">{pillar.title}</h4>
                  <p className="text-xs text-navy-600 dark:text-slate-300 font-tajawal mt-1 leading-relaxed">{pillar.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 3. FEATURES (لماذا توافق) ===== */}
      <section className="py-16 lg:py-20 bg-white dark:bg-navy-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="لماذا توافق؟"
            title={<>منصة تُبنى على <span className="text-amber-600 font-extrabold">الثقة والوضوح والجدية</span></>}
            subtitle="نحن ننسق مع نخبة من الخطابات ونراجع البيانات باستمرار مع حفظ الخصوصية التامة لنسهل لك الوصول إلى شريك الحياة."
          />

          <div className="mt-14 relative">
            <div className="hidden lg:block absolute top-10 right-[12.5%] left-[12.5%] h-0.5 bg-gradient-to-l from-gold-500/10 via-gold-500/30 to-gold-500/10" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="relative flex flex-col items-center text-center group"
                >
                  <div className="relative z-10 w-20 h-20 rounded-full bg-white dark:bg-navy-900 border-2 border-gold-500/40 dark:border-gold-500/20 flex items-center justify-center shadow-soft mb-5 transition-transform duration-300 group-hover:scale-105">
                    <div className="w-12 h-12 rounded-xl bg-gold-500/10 flex items-center justify-center group-hover:bg-gold-gradient transition-colors duration-300">
                      <f.icon className="w-6 h-6 text-gold-600 group-hover:text-navy-900 transition-colors duration-300" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-navy-900 text-gold-300 font-cairo font-bold text-xs flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>

                  <h3 className="font-cairo font-bold text-navy-900 dark:text-cream-50 text-base mb-2">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-navy-600 dark:text-slate-300 font-tajawal leading-relaxed max-w-[200px]">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 4. PROCESS: كيف تعمل المنصة ===== */}
      <section className="py-16 lg:py-20 bg-cream-100 dark:bg-navy-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="كيف تعمل المنصة؟"
            title={<>مسار منظم ومباشر <span className="text-amber-600 font-extrabold">من الطلب حتى الزواج</span></>}
            subtitle="خطوات واضحة تبدأ باختيار الشريك وإرسال طلب التوافق وتنتهي بالتنسيق الشرعي والمبارك تحت إشراف الإدارة."
          />

          <div className="mt-14 relative">
            <div className="hidden lg:block absolute top-10 right-[8.33%] left-[8.33%] h-0.5 bg-gradient-to-l from-gold-500/10 via-gold-500/30 to-gold-500/10" />

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {journeyStages.map((stage, i) => (
                <motion.div
                  key={stage.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="relative flex flex-col items-center text-center group"
                >
                  <div className="relative z-10 w-20 h-20 rounded-full bg-white dark:bg-navy-950 border-2 border-gold-500/40 dark:border-gold-500/20 flex items-center justify-center shadow-soft mb-4 transition-transform duration-300 group-hover:scale-105">
                    <div className={`w-12 h-12 rounded-xl ${stage.accent} flex items-center justify-center group-hover:bg-gold-gradient transition-all duration-300`}>
                      <stage.icon className="w-6 h-6 group-hover:text-navy-900 transition-colors duration-300" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-navy-900 text-gold-300 font-cairo font-bold text-xs flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="font-cairo font-bold text-navy-900 dark:text-cream-50 text-sm mb-1">{stage.title}</h3>
                  <p className="text-xs text-navy-500 dark:text-slate-400 font-tajawal leading-relaxed max-w-[140px]">{stage.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <ButtonLink to="/search" variant="outline">
              ابدأ بالبحث عن شريكك الآن <ArrowLeft className="w-4 h-4" />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ===== SECURITY HIGHLIGHT ===== */}
      <section className="py-16 lg:py-24 bg-navy-gradient relative overflow-hidden">
        <div className="absolute inset-0 pattern-islamic opacity-30" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-gold-500/10 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <SectionHeading
                center={false}
                light
                eyebrow="الأمان والخصوصية"
                title={<>بيئة نقية <span className="text-gradient-gold">بإشراف ومتابعة مستمرة</span></>}
                subtitle="نحرص على تصفية الحسابات غير الجادة دورياً، وحماية بيانات التواصل وعدم مشاركتها إلا بموافقة صريحة."
              />
              <div className="mt-8 grid sm:grid-cols-3 gap-4">
                {securityPoints.map((item, i) => (
                  <motion.div
                    key={item.text}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className="glass-navy rounded-2xl p-4 border border-gold-500/20 flex flex-col items-center text-center gap-3"
                  >
                    <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                      <item.icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    <p className="text-cream-200/90 font-tajawal text-sm leading-relaxed">{item.text}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* عنصر بصري: بطاقة شهادة موثوقية */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative flex justify-center"
            >
              <div className="relative w-full max-w-sm">
                {/* هالة خلفية */}
                <div className="absolute inset-0 bg-gold-500/10 rounded-[2.5rem] blur-2xl" />

                <div className="relative glass-navy rounded-[2.5rem] p-8 border border-gold-500/30 shadow-luxe text-center">
                  {/* أيقونة الدرع الكبيرة */}
                  <div className="relative inline-flex mb-6">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-24 h-24 rounded-full bg-gold-gradient flex items-center justify-center shadow-gold"
                    >
                      <ShieldCheck className="w-12 h-12 text-navy-900" />
                    </motion.div>
                    {/* دوائر متحرّكة */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0 -m-3 rounded-full border border-dashed border-gold-500/30"
                    />
                  </div>

                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 mb-4">
                    <BadgeCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300 font-cairo font-bold text-sm">بيئة مراقبة ومنضبطة</span>
                  </div>

                  <h3 className="font-cairo font-bold text-white text-xl mb-2">إشراف وتنسيق مباشر</h3>
                  <p className="text-cream-200/70 font-tajawal text-sm leading-relaxed mb-6">
                    متابعة دورية لحذف الحسابات غير المتفاعلة أو غير الجادة، مع توفير خيار توثيق الهوية الرسمي بشارة معتمدة.
                  </p>

                  {/* شارات التحقق */}
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    {[
                      { icon: FileCheck, label: 'تشفير كامل' },
                      { icon: Eye, label: 'متابعة دورية' },
                      { icon: Lock, label: 'بيانات محمية' },
                    ].map((badge) => (
                      <div key={badge.label} className="flex items-center gap-1.5 text-cream-200/60">
                        <badge.icon className="w-4 h-4 text-gold-300" />
                        <span className="text-xs font-tajawal">{badge.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS (Carousel) ===== */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="تجارب وتطلعات"
            title={<>تجارب مباركة <span className="text-amber-600 font-extrabold">نحو بناء أسرة</span></>}
            subtitle="تجارب وتطلعات مباركة نحو بناء أسرة مستقرة على هدي وسنة."
          />

          <div className="mt-14 max-w-3xl mx-auto">
            <div className="relative bg-white dark:bg-navy-900 rounded-3xl p-8 sm:p-12 shadow-luxe border border-cream-200/60 dark:border-navy-800 overflow-hidden">
              <Quote className="w-24 h-24 text-gold-300/20 absolute -top-4 -left-4" />

              <AnimatePresence mode="wait">
                <motion.div
                  key={testimonialIdx}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.4 }}
                  className="relative z-10"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, idx) => (
                      <Star key={`test-star-${testimonialIdx}-${idx}`} className="w-5 h-5 fill-gold-500 text-gold-500" />
                    ))}
                  </div>

                  <p className="text-navy-700 dark:text-cream-100 font-tajawal text-lg leading-relaxed mb-8">
                    {activeTestimonial.story}
                  </p>

                  <div className="flex items-center gap-4 pt-6 border-t border-cream-200 dark:border-navy-800">
                    <div className="w-14 h-14 rounded-full bg-gold-gradient flex items-center justify-center text-navy-900 font-cairo font-bold text-xl">
                      {activeTestimonial.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-cairo font-bold text-navy-900 dark:text-cream-50 text-lg">{activeTestimonial.name}</div>
                      <div className="text-sm text-navy-500 dark:text-slate-400 font-tajawal">{activeTestimonial.city} · {activeTestimonial.duration}</div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* أزرار التنقّل */}
              <div className="flex items-center justify-between mt-8">
                <button
                  onClick={prevTestimonial}
                  className="w-11 h-11 rounded-full bg-cream-100 dark:bg-navy-800 hover:bg-gold-300/20 dark:hover:bg-gold-300/10 flex items-center justify-center transition-all duration-300 group"
                  aria-label="السابق"
                >
                  <ChevronRight className="w-5 h-5 text-navy-600 dark:text-cream-200 group-hover:text-gold-700 dark:group-hover:text-gold-400" />
                </button>

                {/* نقاط مؤشّرة */}
                <div className="flex items-center gap-2">
                  {TESTIMONIALS.map((_, idx) => (
                    <button
                      key={`test-dot-${idx}`}
                      onClick={() => setTestimonialIdx(idx)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        idx === testimonialIdx ? 'w-8 bg-gold-gradient' : 'w-2 bg-cream-300 dark:bg-navy-700 hover:bg-gold-300 dark:hover:bg-gold-600'
                      }`}
                      aria-label={`قصة ${idx + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={nextTestimonial}
                  className="w-11 h-11 rounded-full bg-cream-100 dark:bg-navy-800 hover:bg-gold-300/20 dark:hover:bg-gold-300/10 flex items-center justify-center transition-all duration-300 group"
                  aria-label="التالي"
                >
                  <ChevronLeft className="w-5 h-5 text-navy-600 dark:text-cream-200 group-hover:text-gold-700 dark:group-hover:text-gold-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA (خلفية ذهبية مميّزة) ===== */}
      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative wave-bg rounded-[2.5rem] overflow-hidden p-10 lg:p-16 text-center shadow-luxe">
            <div className="absolute inset-0 pattern-islamic opacity-20" />
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/15 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-navy-900/10 rounded-full blur-3xl" />

            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-navy-900 mb-6 shadow-luxe"
              >
                <Heart className="w-8 h-8 text-gold-300 fill-gold-300" />
              </motion.div>

              <h2 className="font-cairo font-extrabold text-3xl sm:text-4xl lg:text-5xl text-navy-900 leading-tight">
                {isLoggedIn ? 'ابحث عن شريك حياتك المناسب...' : 'قلبك ينتظر شريكه...'}
              </h2>
              <p className="mt-4 text-lg text-navy-800/80 font-tajawal max-w-xl mx-auto">
                {isLoggedIn ? 'تصفّح ملفات الأعضاء وأرسل طلب توافق جاد بكل سهولة ووضوح.' : 'انضم اليوم وابدأ رحلتك نحو شريك الحياة في بيئة آمنة ومنسقة.'}
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                {isLoggedIn ? (
                  <>
                    <ButtonLink to="/search" variant="navy" size="lg" className="shadow-luxe">
                      <Search className="w-5 h-5" /> ابحث عن شريك حياتك
                    </ButtonLink>
                    <ButtonLink to="/profile" variant="outline" size="lg" className="!border-navy-900/30 !text-navy-900 hover:!bg-navy-900/10">
                      <Heart className="w-5 h-5" /> ملفي الشخصي
                    </ButtonLink>
                  </>
                ) : (
                  <>
                    <ButtonLink to="/register" variant="navy" size="lg" className="shadow-luxe">
                      <Heart className="w-5 h-5" /> أنشئ حسابك مجانًا
                    </ButtonLink>
                    <ButtonLink to="/plans" variant="outline" size="lg" className="!border-navy-900/30 !text-navy-900 hover:!bg-navy-900/10">
                      <TrendingUp className="w-5 h-5" /> اكتشف الباقات
                    </ButtonLink>
                  </>
                )}
              </div>

              {/* عنصر ثقة إضافي */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-navy-800/70 font-tajawal">
                <span className="flex items-center gap-1.5"><BadgeCheck className="w-4 h-4" /> بدون بطاقة ائتمان للتسجيل</span>
                <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> سرية تامة لبياناتك</span>
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> إشراف وتنسيق مباشر</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
