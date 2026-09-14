import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../lib/AppContext';
import {
  Search as SearchIcon, SlidersHorizontal, MapPin, Calendar,
  Briefcase, GraduationCap, Users, ChevronDown, ChevronUp,
  Globe, BookOpen, Heart, ShieldCheck, Baby, Building2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import {
  ARAB_COUNTRIES, ARAB_CITIES, EDUCATION_LEVELS, JOB_TITLES,
  SECTS, CHILDREN_COUNTS, getMaritalOptions,
} from '../lib/types';
import { CITIES_BY_COUNTRY, NATIONALITIES, WORK_TYPES } from '../lib/constants';
import MemberCard from '../components/MemberCard';
import { MemberGridSkeleton } from '../components/ui/MemberCardSkeleton';
import { dataService } from '../lib/data/DataService';
import { getMemberTimestamp } from '../lib/memberUtils';

type GenderFilter = 'male' | 'female' | 'all';

const PAGE_SIZE = 24;

export default function Search() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkLimit, incrementUsage, showToast, members, membersLoading, membersError, retryLoadMembers, blockedMembers, currentUser, user } = useApp();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ===== الفلاتر الأساسية (مع دعم التهيئة من معايير الرابط) =====
  const paramGender = searchParams.get('gender') as GenderFilter | null;
  const paramCountry = searchParams.get('country') || '';
  const paramCity = searchParams.get('city') || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [gender, setGender] = useState<GenderFilter>(
    paramGender === 'male' || paramGender === 'female' || paramGender === 'all' ? paramGender : 'all'
  );
  const [ageRange, setAgeRange] = useState<[number, number]>([16, 80]);
  const [country, setCountry] = useState(paramCountry);
  const [city, setCity] = useState(paramCity);

  // عند تغيّر معايير الرابط (مثل الضغط على فلتر سريع من الرئيسية)
  useEffect(() => {
    const urlGender = searchParams.get('gender') as GenderFilter | null;
    const urlCountry = searchParams.get('country');
    const urlCity = searchParams.get('city');

    if (urlGender && (urlGender === 'male' || urlGender === 'female' || urlGender === 'all')) {
      setGender(urlGender);
    }
    if (urlCountry !== null) {
      setCountry(urlCountry);
    }
    if (urlCity !== null) {
      setCity(urlCity);
    }
  }, [searchParams]);

  // ===== الفلاتر المتقدمة =====
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [marriageType, setMarriageType] = useState<'' | 'announced' | 'misyar'>('');
  const [acceptForeigner, setAcceptForeigner] = useState<'' | 'yes' | 'no'>('');
  const [nationality, setNationality] = useState('');
  const [education, setEducation] = useState('');
  const [job, setJob] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [sect, setSect] = useState('');
  const [hasChildren, setHasChildren] = useState('');
  const [childrenCount, setChildrenCount] = useState('');

  // نضمن تحميل قوائم الجغرافيا الرسمية من قاعدة البيانات (نفس مصدر التسجيل)
  React.useEffect(() => { dataService.db.ensureGeoLoaded?.().catch(() => undefined); }, []);

  // الدول والمدن والجنسيات من قاعدة البيانات الموحّدة (مع fallback للقوائم الثابتة)
  const countryOptions = React.useMemo(() => {
    const db = dataService.db.getCountryNames?.() || [];
    return db.length ? db : ARAB_COUNTRIES;
  }, []);
  const OTHER_CITY_OPTION = 'أخرى (مدن أخرى)';

  const cityOptions = React.useMemo(() => {
    if (!country) return [];
    const db = dataService.db.getCities?.(country) || [];
    const mainCities = db.length ? db : (CITIES_BY_COUNTRY[country] || []);
    // نضمن إدراج خيار "أخرى (مدن أخرى)" في نهاية خيارات المدينة للدولة المحددة
    const uniqueCities = Array.from(new Set(mainCities));
    return [...uniqueCities, OTHER_CITY_OPTION];
  }, [country]);
  const nationalityOptions = React.useMemo(() => {
    const db = dataService.db.getNationalities?.() || [];
    return db.length ? db : NATIONALITIES;
  }, []);

  // خيارات الحالة الاجتماعية حسب الجنس المختار
  const maritalOptions = gender === 'all' ? [] : getMaritalOptions(gender);

  // عند تغيير الجنس: نعيد ضبط الحالة الاجتماعية لأن الخيارات تختلف
  const handleGenderChange = (g: GenderFilter) => {
    setGender(g);
    setMaritalStatus(''); // إعادة ضبط الحالة الاجتماعية
    setHasChildren('');
    setChildrenCount('');
  };

  // عند اختيار "مطلق/مطلقة" نظهر خيارات الأبناء
  const showChildrenOptions = ['divorced', 'widower', 'widow', 'widowed', 'مطلق', 'مطلقة', 'أرمل', 'أرملة'].includes(maritalStatus);

  // Live filtering (replaces separate results page - Red Priority #2)
  const filteredMembers = React.useMemo(() => {
    const seen = new Set<string>();
    return members.filter((m, idx) => {
      if (!m) return false;
      if (m.status && m.status !== 'active') return false;
      // إخفاء الأعضاء المحظورين شخصياً من نتائج البحث
      if (blockedMembers.has(m.id)) return false;
      // لا نخفي المستوردين بسبب نقص الجنس/العمر؛ يكفي وجود اسم أو رمز عضو.
      if (!m.nickname && !m.realName && !m.id) return false;
      const key = m.id || `idx-${idx}`;
      if (seen.has(key)) return false;
      seen.add(key);

    // البحث بالكلمة المفتاحية / الرمز / كود العضو
    if (searchQuery.trim()) {
      const rawQ = searchQuery.trim().toLowerCase();
      const cleanQ = rawQ.replace('#', '').replace('tw-', '').replace('imp-', '').trim();
      const rawId = (m.id || '').toLowerCase();
      const cleanId = rawId.replace('#', '').replace('tw-', '').replace('imp-', '').trim();

      const matchId = rawId.includes(rawQ) || (cleanQ.length > 0 && cleanId.includes(cleanQ));
      const matchNick = (m.nickname || '').toLowerCase().includes(rawQ);
      const matchDisplay = ((m as any).displayName || '').toLowerCase().includes(rawQ);
      const matchUser = (m.username || '').toLowerCase().includes(rawQ);
      const matchJob = (m.jobTitle || '').toLowerCase().includes(rawQ);
      const matchTribe = (m.tribe || '').toLowerCase().includes(rawQ);
      const matchBio = (m.bio || '').toLowerCase().includes(rawQ);
      if (!matchId && !matchNick && !matchDisplay && !matchUser && !matchJob && !matchTribe && !matchBio) {
        return false;
      }
    }

    if (gender !== 'all' && m.gender !== gender) return false;
    if (m.age && (m.age < ageRange[0] || m.age > ageRange[1])) return false;
    if (country && m.country !== country) return false;
    if (city) {
      if (city === OTHER_CITY_OPTION || city === 'أخرى' || city.startsWith('أخرى')) {
        // عند اختيار "أخرى (مدن أخرى)"، يُطابق الأعضاء الذين مدينتهم ليست ضمن القائمة الرئيسية لتلك الدولة
        const targetCountry = m.country || country;
        const db = dataService.db.getCities?.(targetCountry) || [];
        const mainCities = db.length ? db : (CITIES_BY_COUNTRY[targetCountry] || []);
        const normMCity = (m.city || '').trim().toLowerCase();
        const isMain = mainCities.some((c) => c.trim().toLowerCase() === normMCity);
        if (isMain) return false;
      } else {
        if (m.city !== city) return false;
      }
    }

    // تصفية الجنسية (مطابقة مرنة تشمل الدولة والمسمى الوظيفي والنسبة)
    if (nationality) {
      const normFilter = nationality.replace('/ة', '').replace('ة', '').replace('ال', '').trim().toLowerCase();
      const normNat = (m.nationality || '').replace('/ة', '').replace('ة', '').replace('ال', '').trim().toLowerCase();
      const normCountry = (m.country || '').replace('ال', '').trim().toLowerCase();

      const isNatMatch = m.nationality === nationality || 
                         normNat === normFilter || 
                         (normNat.length > 2 && normFilter.length > 2 && (normNat.includes(normFilter) || normFilter.includes(normNat))) ||
                         (normCountry.length > 2 && normFilter.length > 2 && (normCountry === normFilter || normCountry.includes(normFilter)));

      if (!isNatMatch) return false;
    }

    if (education && m.education !== education) return false;
    
    if (job) {
      const j = job.trim().toLowerCase();
      const wType = (m.workType || '').toLowerCase();
      const jTitle = (m.jobTitle || '').toLowerCase();
      const isOtherMatch = (j === 'أخرى' || j === 'اخرى') && (wType === 'أخرى' || wType === 'اخرى' || (!['حكومي', 'قطاع خاص', 'عمل حر', 'باحث عن عمل', 'طالب', 'بدون عمل'].includes(wType) && wType !== ''));
      const matchesWork = wType.includes(j) || isOtherMatch || (j === 'عمل حر' && (wType.includes('حر') || wType.includes('أعمال حرة'))) || (j === 'أعمال حرة' && (wType.includes('حر') || wType.includes('عمل')));
      const matchesTitle = jTitle.includes(j);
      if (!matchesWork && !matchesTitle) return false;
    }

    if (maritalStatus) {
      const mStatus = m.maritalStatus || '';
      const mLabel = m.maritalLabel || '';
      const isWidowMatch = (maritalStatus === 'widower' || maritalStatus === 'widow') && (mStatus === 'widower' || mStatus === 'widow');
      if (mStatus !== maritalStatus && !isWidowMatch && !mLabel.includes(maritalStatus)) {
        return false;
      }
    }

    // تصفية المذهب (مطابقة مرنة مثل سني / مسلم سني / سلفي)
    if (sect) {
      const normFilter = sect.replace('مسلم ', '').trim();
      const normSect = (m.sect || '').replace('مسلم ', '').trim();

      const isSectMatch = m.sect === sect || 
                         normSect === normFilter || 
                         normSect.includes(normFilter) || 
                         normFilter.includes(normSect);

      if (!isSectMatch) return false;
    }
    if (hasChildren && ((hasChildren === 'true' && !m.hasChildren) || (hasChildren === 'false' && m.hasChildren))) return false;
    if (childrenCount && m.childrenCount !== childrenCount) return false;

    // تصفية نوع الزواج (معلن / مسيار) — من اختار "لا مانع" يظهر في كلا الخيارين
    if (marriageType) {
      const mTypeRaw = ((m as any).marriageType || (m as any).marriage_type || '').toString().toLowerCase().trim();
      const isBoth = ['both', 'معلن أو مسيار', 'معلن او مسيار', 'لا مانع', 'الاثنين', 'كلاهما', 'معلن ومسيار'].some(k => mTypeRaw.includes(k));
      if (marriageType === 'announced') {
        const isAnnounced = isBoth || ['announced', 'معلن', 'عادي', 'طبيعي'].some(k => mTypeRaw.includes(k)) || !mTypeRaw;
        if (!isAnnounced) return false;
      } else if (marriageType === 'misyar') {
        const isMisyar = isBoth || ['misyar', 'مسيار'].some(k => mTypeRaw.includes(k));
        if (!isMisyar) return false;
      }
    }

    // تصفية قبول غير المواطن / الأجنبي
    if (acceptForeigner) {
      const mAccRaw = ((m as any).acceptForeigner || (m as any).accept_foreigner || (m as any).pNationality || '').toString().toLowerCase().trim();
      const accepts = ['نعم', 'yes', 'true', 'لا مانع', 'اقبل اجنبي', 'أقبل أجنبي', 'أية جنسية', 'اي جنسية'].some(k => mAccRaw.includes(k));
      if (acceptForeigner === 'yes' && !accepts) return false;
      if (acceptForeigner === 'no' && accepts) return false;
    }

    return true;
  }).sort((a, b) => {
    // 0. Priority: Pinned members first
    const pinA = a.pinned ? 1 : 0;
    const pinB = b.pinned ? 1 : 0;
    if (pinA !== pinB) {
      return pinB - pinA; // pinned first
    }

    // Priority: Premium Package (Elite) > Gold Package > Free Package
    const getPlanScore = (member: any) => {
      const plan = member.plan || (member.premium ? 'elite' : 'free');
      if (plan === 'elite') return 100;
      if (plan === 'gold') return 50;
      return 10;
    };

    const scoreA = getPlanScore(a) + (a.hasSeriousnessBadge ? 5 : 0);
    const scoreB = getPlanScore(b) + (b.hasSeriousnessBadge ? 5 : 0);

    if (scoreA !== scoreB) {
      return scoreB - scoreA; // higher score first
    }

    // Secondary: Sort by latest creation/registration date (newest first)
    const timeA = getMemberTimestamp(a);
    const timeB = getMemberTimestamp(b);
    if (timeA !== timeB) {
      return timeB - timeA;
    }

    // Tertiary: fallback comparison
    const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
    if (numA !== numB) {
      return numB - numA;
    }

    return (b.id || '').localeCompare(a.id || '');
  });
  }, [members, blockedMembers, searchQuery, gender, ageRange, country, city, nationality, education, job, maritalStatus, sect, hasChildren, childrenCount, marriageType, acceptForeigner]);

  // إعادة الترقيم للصفحة الأولى عند تغيير أي فلتر لتجنّب صفحة فارغة
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, gender, ageRange[0], ageRange[1], country, city, nationality, education, job, maritalStatus, sect, hasChildren, childrenCount, marriageType, acceptForeigner]);

  const visibleMembers = filteredMembers.slice(0, visibleCount);
  const hasMore = filteredMembers.length > visibleMembers.length;

  const handleSearch = () => {
    // Live results already shown below - no navigation needed
    showToast('تم تحديث النتائج فوراً حسب الفلاتر', 'success');
    incrementUsage('search');
  };

  return (
    <div className="bg-cream-50 min-h-screen pb-12">
      {/* Header banner */}
      <div className="bg-navy-gradient relative overflow-hidden">
        <div className="absolute inset-0 pattern-arabesque opacity-30" />
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-gold-500/20 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-300/15 mb-4">
              <SlidersHorizontal className="w-7 h-7 text-gold-300" />
            </div>
            <h1 className="font-cairo font-extrabold text-3xl sm:text-4xl text-white">البحث المتقدم</h1>
            <p className="mt-3 text-cream-200/80 font-tajawal">خصّص بحثك بدقة للعثور على شريك الحياة المناسب</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-6 relative">
        <div className="bg-white dark:bg-navy-900 rounded-3xl shadow-luxe border border-cream-200/60 dark:border-navy-800 p-5 sm:p-7 space-y-6">

          {/* ===== البحث بالرمز أو الكلمة المفتاحية ===== */}
          <div>
            <label className="flex items-center gap-2 text-sm font-cairo font-bold text-navy-800 dark:text-cream-100 mb-2">
              <SearchIcon className="w-4 h-4 text-gold-600" /> البحث بالسير الذاتية / الرمز الكودي
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بكود العضو (مثل m1)، أو المسمى الوظيفي، أو الاسم المستعار..."
                className="w-full px-4 py-3 pl-10 rounded-2xl bg-cream-50 dark:bg-navy-950 border-2 border-cream-200 dark:border-navy-800 focus:border-gold-500 focus:outline-none font-tajawal text-sm text-navy-900 dark:text-cream-100 placeholder:text-navy-400"
              />
              <SearchIcon className="w-4 h-4 text-navy-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* ===== الخطوة 1: الجنس (أول خيار) ===== */}
          <FilterSection icon={Users} title="أبحث عن" step={1}>
            <div className="grid grid-cols-3 gap-3">
              <GenderButton
                active={gender === 'all'} onClick={() => handleGenderChange('all')}
                label="الجميع" color="gold"
              />
              <GenderButton
                active={gender === 'male'} onClick={() => handleGenderChange('male')}
                label="رجال" color="blue"
              />
              <GenderButton
                active={gender === 'female'} onClick={() => handleGenderChange('female')}
                label="نساء" color="rose"
              />
            </div>
            {gender === 'all' && (
              <p className="text-xs text-navy-400 font-tajawal mt-2.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                عند اختيار «الجميع» تتوفر خيارات الدولة والمدينة والعمر فقط
              </p>
            )}
          </FilterSection>

          {/* ===== الخطوة 2: الدولة والمدينة ===== */}
          <FilterSection icon={MapPin} title="الدولة والمدينة" step={2}>
            <div className="grid sm:grid-cols-2 gap-3">
              <SelectField icon={Globe} label="الدولة" value={country} onChange={(v) => { setCountry(v); setCity(''); }}
                options={countryOptions} placeholder="كل الدول" />
              <SelectField icon={MapPin} label="المدينة" value={city} onChange={setCity}
                disabled={!country}
                options={cityOptions} placeholder={country ? "كل المدن" : "اختر الدولة أولاً لمعاينة المدن"} />
            </div>
          </FilterSection>

          {/* ===== الخطوة 3: العمر ===== */}
          <FilterSection icon={Calendar} title="الفئة العمرية" step={3}>
            <div className="bg-cream-50 rounded-2xl p-4 border border-cream-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-navy-500 font-tajawal">من</span>
                <span className="font-cairo font-bold text-lg text-gold-700 bg-gold-300/15 px-3 py-1 rounded-lg">{ageRange[0]} سنة</span>
              </div>
              <input type="range" min="16" max="80" value={ageRange[0]}
                onChange={(e) => setAgeRange([Math.min(Number(e.target.value), ageRange[1]), ageRange[1]])}
                className="w-full accent-gold-500" />
            </div>
            <div className="bg-cream-50 rounded-2xl p-4 border border-cream-200 mt-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-navy-500 font-tajawal">إلى</span>
                <span className="font-cairo font-bold text-lg text-gold-700 bg-gold-300/15 px-3 py-1 rounded-lg">{ageRange[1]} سنة</span>
              </div>
              <input type="range" min="16" max="80" value={ageRange[1]}
                onChange={(e) => setAgeRange([ageRange[0], Math.max(Number(e.target.value), ageRange[0])])}
                className="w-full accent-gold-500" />
            </div>
          </FilterSection>

          {/* ===== زر المزيد من الخيارات ===== */}
          {gender !== 'all' && (
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-navy-gradient text-white font-cairo font-bold transition-all hover:shadow-luxe relative overflow-hidden"
            >
              <div className="absolute inset-0 pattern-arabesque opacity-20" />
              <span className="relative flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-gold-300" />
                {showAdvanced ? 'إخفاء الخيارات المتقدمة' : 'مزيد من الخيارات'}
              </span>
              <span className="relative">
                {showAdvanced ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </span>
            </button>
          )}

          {/* ===== الخيارات المتقدمة ===== */}
          <AnimatePresence>
            {showAdvanced && gender !== 'all' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="space-y-5 pt-2 border-t border-cream-200">

                  {/* الحالة الاجتماعية — تتغير حسب الجنس */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-cairo font-bold text-navy-800 mb-2.5">
                      <Heart className="w-4 h-4 text-gold-600" /> الحالة الاجتماعية
                      <span className="text-[11px] font-normal text-navy-400">
                        ({gender === 'male' ? 'خيارات الرجال' : 'خيارات النساء'})
                      </span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {maritalOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setMaritalStatus(maritalStatus === opt.value ? '' : opt.value)}
                          className={`py-2.5 px-2 rounded-xl font-cairo font-semibold text-sm transition-all no-tap-highlight ${
                            maritalStatus === opt.value
                              ? 'bg-gold-gradient text-navy-900 shadow-soft'
                              : 'bg-cream-100 text-navy-600 hover:bg-cream-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* عدد الأبناء — يظهر فقط للمطلق/الأرمل */}
                  {showChildrenOptions && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <label className="flex items-center gap-2 text-sm font-cairo font-bold text-navy-800 mb-2.5">
                        <Baby className="w-4 h-4 text-gold-600" /> الأبناء
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <button
                          onClick={() => { setHasChildren('false'); setChildrenCount(''); }}
                          className={`py-2.5 rounded-xl font-cairo font-semibold text-sm transition-all ${
                            hasChildren === 'false' ? 'bg-gold-gradient text-navy-900 shadow-soft' : 'bg-cream-100 text-navy-600 hover:bg-cream-200'
                          }`}
                        >
                          بدون أبناء
                        </button>
                        <button
                          onClick={() => setHasChildren('true')}
                          className={`py-2.5 rounded-xl font-cairo font-semibold text-sm transition-all ${
                            hasChildren === 'true' ? 'bg-gold-gradient text-navy-900 shadow-soft' : 'bg-cream-100 text-navy-600 hover:bg-cream-200'
                          }`}
                        >
                          لديه أبناء
                        </button>
                      </div>
                      {hasChildren === 'true' && (
                        <div className="mt-2">
                          <SelectField icon={Baby} label="عدد الأبناء" value={childrenCount} onChange={setChildrenCount}
                            options={CHILDREN_COUNTS.filter(c => c !== 'لا يوجد')} placeholder="اختر العدد" />
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* نوع الزواج المطلوب */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-cairo font-bold text-navy-800 mb-2.5">
                      <Heart className="w-4 h-4 text-gold-600" /> نوع الزواج
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setMarriageType('')}
                        className={`py-2.5 px-2 rounded-xl font-cairo font-semibold text-sm transition-all ${
                          marriageType === ''
                            ? 'bg-gold-gradient text-navy-900 shadow-soft'
                            : 'bg-cream-100 text-navy-600 hover:bg-cream-200'
                        }`}
                      >
                        الكل
                      </button>
                      <button
                        onClick={() => setMarriageType('announced')}
                        className={`py-2.5 px-2 rounded-xl font-cairo font-semibold text-sm transition-all ${
                          marriageType === 'announced'
                            ? 'bg-gold-gradient text-navy-900 shadow-soft'
                            : 'bg-cream-100 text-navy-600 hover:bg-cream-200'
                        }`}
                      >
                        معلن
                      </button>
                      <button
                        onClick={() => setMarriageType('misyar')}
                        className={`py-2.5 px-2 rounded-xl font-cairo font-semibold text-sm transition-all ${
                          marriageType === 'misyar'
                            ? 'bg-gold-gradient text-navy-900 shadow-soft'
                            : 'bg-cream-100 text-navy-600 hover:bg-cream-200'
                        }`}
                      >
                        مسيار
                      </button>
                    </div>
                  </div>

                  {/* قبول غير مواطن / أجنبي */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-cairo font-bold text-navy-800 mb-2.5">
                      <Globe className="w-4 h-4 text-gold-600" /> قبول غير مواطن / أجنبي
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setAcceptForeigner('')}
                        className={`py-2.5 px-2 rounded-xl font-cairo font-semibold text-sm transition-all ${
                          acceptForeigner === ''
                            ? 'bg-gold-gradient text-navy-900 shadow-soft'
                            : 'bg-cream-100 text-navy-600 hover:bg-cream-200'
                        }`}
                      >
                        الكل
                      </button>
                      <button
                        onClick={() => setAcceptForeigner('yes')}
                        className={`py-2.5 px-2 rounded-xl font-cairo font-semibold text-sm transition-all ${
                          acceptForeigner === 'yes'
                            ? 'bg-gold-gradient text-navy-900 shadow-soft'
                            : 'bg-cream-100 text-navy-600 hover:bg-cream-200'
                        }`}
                      >
                        يقبل أجنبي
                      </button>
                      <button
                        onClick={() => setAcceptForeigner('no')}
                        className={`py-2.5 px-2 rounded-xl font-cairo font-semibold text-sm transition-all ${
                          acceptForeigner === 'no'
                            ? 'bg-gold-gradient text-navy-900 shadow-soft'
                            : 'bg-cream-100 text-navy-600 hover:bg-cream-200'
                        }`}
                      >
                        مواطن فقط
                      </button>
                    </div>
                  </div>

                  {/* المذهب */}
                  <SelectField icon={BookOpen} label="المذهب" value={sect} onChange={setSect}
                    options={SECTS} placeholder="كل المذاهب" />

                  {/* الجنسية */}
                  <SelectField icon={Globe} label="الجنسية" value={nationality} onChange={setNationality}
                    options={nationalityOptions} placeholder="كل الجنسيات" />

                  {/* التعليم والوظيفة */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <SelectField icon={GraduationCap} label="التعليم" value={education} onChange={setEducation}
                      options={EDUCATION_LEVELS} placeholder="الكل" />
                    <SelectField icon={Briefcase} label="نوع العمل" value={job} onChange={setJob}
                      options={WORK_TYPES} placeholder="الكل" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* زر البحث */}
          <Button onClick={handleSearch} fullWidth size="lg" className="shadow-gold">
            <SearchIcon className="w-5 h-5" /> ابحث الآن
          </Button>
        </div>
      </div>

      {/* عرض النتائج */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mt-12 border-t border-cream-200/60">
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-cairo font-extrabold text-2xl text-navy-900">
              نتائج البحث ({filteredMembers.length})
            </h2>
            <p className="mt-1 text-sm text-navy-500 font-tajawal">
              {filteredMembers.length > 0
                ? 'مرتبة حسب الجدية والتميز — الأحدث أولاً'
                : 'لا توجد نتائج مطابقة. جرّب تعديل الفلاتر.'}
            </p>
          </div>
          {filteredMembers.length > 0 && (
            <div className="text-xs font-tajawal text-navy-500 bg-cream-100 px-4 py-2 rounded-2xl flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-gold-600" />
              نتائج مفلترة حسب اختيارك
            </div>
          )}
        </div>

        {membersError && members.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-rose-200/70">
            <div className="w-16 h-16 rounded-full bg-rose-soft flex items-center justify-center mx-auto mb-4">
              <SearchIcon className="w-8 h-8 text-rose-deep" />
            </div>
            <p className="font-cairo font-bold text-navy-800 text-lg mb-1">تعذر تحميل الأعضاء</p>
            <p className="text-sm text-navy-500 font-tajawal mb-6">{membersError}</p>
            <Button onClick={retryLoadMembers}>إعادة المحاولة</Button>
          </div>
        ) : membersLoading && members.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
            <MemberGridSkeleton count={8} />
          </div>
        ) : filteredMembers.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
              {visibleMembers.map((m, idx) => (
                <MemberCard key={m?.id ? `search-member-${m.id}-${idx}` : `search-member-idx-${idx}`} member={m} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} variant="outline" size="md">
                  عرض المزيد ({filteredMembers.length - visibleMembers.length} متبقٍ)
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="py-20 text-center">
            <SearchIcon className="w-16 h-16 text-navy-200 mx-auto mb-4" />
            <p className="font-cairo font-bold text-navy-700 text-lg mb-1">لا توجد نتائج مطابقة</p>
            <p className="text-sm text-navy-400 font-tajawal mb-6">جرّب توسيع نطاق البحث أو تعديل الفلاتر</p>
            <Button
              onClick={() => {
                setSearchQuery('');
                setGender('all');
                setAgeRange([16, 80]);
                setCountry('');
                setCity('');
                setNationality('');
                setEducation('');
                setJob('');
                setMaritalStatus('');
                setSect('');
                setHasChildren('');
                setChildrenCount('');
                setShowAdvanced(false);
              }}
              variant="outline"
              size="md"
            >
              إعادة ضبط الفلاتر
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== مكوّنات مساعدة ===== */

function FilterSection({ icon: Icon, title, step, children }: { icon: typeof Users; title: string; step: number; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2.5 mb-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gold-300/20 text-gold-700 font-cairo font-bold text-sm flex-shrink-0">
          {step}
        </span>
        <span className="flex items-center gap-2 text-sm font-cairo font-bold text-navy-800">
          <Icon className="w-4 h-4 text-gold-600" /> {title}
        </span>
      </label>
      {children}
    </div>
  );
}

function GenderButton({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: 'gold' | 'blue' | 'rose' }) {
  const colors = {
    gold: active ? 'bg-gold-gradient text-navy-900 shadow-soft' : '',
    blue: active ? 'bg-blue-500 text-white shadow-soft' : '',
    rose: active ? 'bg-rose-500 text-white shadow-soft' : '',
  };
  return (
    <button
      onClick={onClick}
      className={`py-3.5 rounded-xl font-cairo font-bold text-sm transition-all no-tap-highlight ${
        active ? colors[color] : 'bg-cream-100 dark:bg-navy-950 text-navy-600 dark:text-cream-200 hover:bg-cream-200 dark:hover:bg-navy-800'
      }`}
    >
      {label}
    </button>
  );
}

function SelectField({ icon: Icon, label, value, onChange, options, placeholder, disabled }: {
  icon: typeof Globe; label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-cairo font-semibold text-navy-600 dark:text-cream-200 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-gold-600" /> {label}
      </label>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-3 rounded-xl border-2 font-tajawal appearance-none transition-colors ${
            disabled
              ? 'bg-slate-100 dark:bg-navy-900/50 border-slate-200 dark:border-navy-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-80'
              : 'bg-cream-50 dark:bg-navy-950 border-cream-200 dark:border-navy-800 text-navy-900 dark:text-cream-100 focus:border-gold-500 focus:outline-none cursor-pointer'
          }`}
        >
          <option value="">{placeholder}</option>
          {options.map((o, idx) => <option key={`opt-${o}-${idx}`} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 text-navy-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}
