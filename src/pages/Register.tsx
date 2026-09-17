import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, User, FileText, Heart, ShieldCheck,
  Venus, Mars, Lock, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import {
  Field, TextInput, SelectInput, TextArea,
  RadioGroup, ChoiceCard, RangeSlider, ProgressBar, DateSelect,
  SelectWithOther, PhoneInputWithCountryCode,
} from '../components/ui/FormFields';
import SearchableSelect from '../components/ui/SearchableSelect';
import MultiSearchableSelect from '../components/ui/MultiSearchableSelect';
import { useApp } from '../lib/AppContext';
import supabase from '../lib/supabase';
import { translitArabicToEnglish } from '../lib/types';
import * as C from '../lib/constants';
import {
  getNationalityForCountry,
  getNationalityOptions,
  getPartnerMaritalOptions,
  getPartnerTerms,
  getSelfMaritalOptions,
  isMarriedMale,
  normalizeMaritalLabel,
  shouldAskChildren,
  getUnifiedCountries,
  getUnifiedCitiesForCountry,
  getUnifiedCitiesForPartnerCountries,
  getUnifiedNationalities,
  getUnifiedSects,
  getUnifiedSkinColors,
  getUnifiedSkinColorOptions,
  getUnifiedEducationLevels,
  getUnifiedWorkTypes,
  getUnifiedHousingTypes,
  getUnifiedSmokingOptions,
  getChildrenCountList,
} from '../lib/registrationOptions';
import { dataService } from '../lib/data/DataService';
import { normalizeNationality } from '../lib/data/optionNormalizer';
const { getCountries, getCities, addPendingCity, getAllPendingCities } = dataService.db;



// ====================================================================
//  صفحة التسجيل الديناميكي — نموذج متعدد الخطوات
// ====================================================================

interface FormData {
  // أساسي
  gender: string;
  nickname: string;
  username: string;
  birthDate: string;
  age: number;
  country: string;
  city: string;
  district: string;
  sect: string;
  sectOther: string;
  nationalityMode: string; // 'same' | 'other'
  nationality: string;
  nationalityOther: string;
  // الحالة الاجتماعية
  maritalStatus: string;
  marriageType: string; // 'announced' | 'misyar' | 'both'
  tribe: string;
  childrenCount: string;
  childrenLiveWith: string;
  hasChildren: string;
  wifeCount: string;
  seekingWife: string;
  // شخصية
  height: number;
  weight: number;
  skinColor: string;
  skinColorOther: string;
  ethnicity: string;
  health: string;
  smoking: string;
  // تعليم وعمل
  education: string;
  workType: string;
  jobTitle: string;
  housing: string;
  // نبذة
  bio: string;
  // مواصفات الشريك
  pCountry: string;
  pCity: string;
  pAgeMin: number | string;
  pAgeMax: number | string;
  pNationality: string;
  pNationalityOther: string;
  pMaritalStatus: string;
  pAcceptChildren: string;
  pNotes: string;
  // بيانات الإدارة
  realName: string;
  whatsapp: string;
  email: string;
  // كلمة المرور
  password: string;
  passwordConfirm: string;
}

const emptyForm: FormData = {
  gender: '', nickname: '', username: '', birthDate: '', age: 0, country: 'السعودية', city: '',
  district: '', sect: '', sectOther: '', nationalityMode: '', nationality: '', nationalityOther: '',
  maritalStatus: '', marriageType: '', tribe: '', childrenCount: '', childrenLiveWith: '',
  hasChildren: '', wifeCount: '', seekingWife: '',
  height: 0, weight: 0, skinColor: '', skinColorOther: '', ethnicity: '', health: '', smoking: '',
  education: '', workType: '', jobTitle: '', housing: '',
  bio: '',
  pCountry: 'نفس دولتي', pCity: 'لا مانع', pAgeMin: '', pAgeMax: '', pNationality: 'اقبل اجنبي', pNationalityOther: '',
  pMaritalStatus: '', pAcceptChildren: '', pNotes: '',
  realName: '', whatsapp: '', email: '',
  password: '', passwordConfirm: '',
};

const STEPS = [
  { id: 0, title: 'الهوية والإقامة', icon: User },
  { id: 1, title: 'المظهر والعمل والنبذة', icon: FileText },
  { id: 2, title: 'مواصفات الشريك', icon: Heart },
  { id: 3, title: 'بيانات الحساب والأمان', icon: ShieldCheck },
  { id: 4, title: 'المراجعة والتأكيد', icon: Check },
];

export default function Register() {
  const navigate = useNavigate();
  const { registerNewMember, members } = useApp();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // حالات فتح النوافذ المخصصة لمواصفات الشريك (تحديد عدة دول/مدن/جنسيات)
  const [pCountryCustomOpen, setPCountryCustomOpen] = useState(true);
  const [pCityCustomOpen, setPCityCustomOpen] = useState(false);
  const [pNationalityCustomOpen, setPNationalityCustomOpen] = useState(false);
  const [pCountryDropdownTrigger, setPCountryDropdownTrigger] = useState(0);
  const [pCityDropdownTrigger, setPCityDropdownTrigger] = useState(0);
  const [pNationalityDropdownTrigger, setPNationalityDropdownTrigger] = useState(0);
  // التحقق من تكرار البريد الإلكتروني عبر الخادم — الحقول الحسّاسة (email) لم تعد ضمن قائمة
  // الأعضاء العامة في الواجهة، لذا لا يمكن التحقق محلياً؛ نستخدم مسار /api/members?checkEmail= المخصّص لذلك.
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const lastCheckedEmail = useRef('');

  const checkEmailAvailability = async (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean === lastCheckedEmail.current) return;
    lastCheckedEmail.current = clean;
    setCheckingEmail(true);
    try {
      const res = await fetch(`/api/members?checkEmail=${encodeURIComponent(clean)}`);
      const data = await res.json();
      setEmailTaken(!!data?.exists);
    } catch {
      setEmailTaken(false);
    } finally {
      setCheckingEmail(false);
    }
  };

  // نضمن تحميل قوائم الجغرافيا الرسمية من قاعدة البيانات قبل عرض خيارات المدن/الجنسيات
  useEffect(() => { dataService.db.ensureGeoLoaded?.().catch(() => undefined); }, []);

  const isMale = form.gender === 'male';
  const isFemale = form.gender === 'female';
  const partnerTerms = useMemo(() => getPartnerTerms(form.gender as any), [form.gender]);

  const set = (key: keyof FormData, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const setCountryAndSyncNationality = (country: string) => {
    setForm((prev) => ({
      ...prev,
      country,
      city: '',
      nationality: prev.nationalityMode === 'same' ? getNationalityForCountry(country, prev.gender as any) : prev.nationality,
    }));
    setErrors((prev) => ({ ...prev, country: '', city: '', nationality: '' }));
  };

  // حساب قوة كلمة المرور
  const passwordStrength = useMemo(() => {
    const pass = form.password;
    if (!pass) return { score: 0, label: '', color: 'bg-slate-200', percentage: 0 };
    if (pass.length < 6) return { score: 1, label: 'ضعيفة جدًا (اقل من 6 أحرف)', color: 'bg-rose-500', percentage: 25 };
    
    let score = 1;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass) && pass.length >= 8) score++;

    if (score <= 2) return { score: 2, label: 'مقبولة', color: 'bg-amber-500', percentage: 50 };
    if (score === 3) return { score: 3, label: 'جيدة جداً', color: 'bg-blue-500', percentage: 75 };
    return { score: 4, label: 'قوية وآمنة', color: 'bg-emerald-500', percentage: 100 };
  }, [form.password]);

  // حساب العمر تلقائيًا من تاريخ الميلاد
  const handleBirthDateChange = (date: string) => {
    set('birthDate', date);
    const parts = date ? date.split('-') : [];
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const birth = new Date(date);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        calculatedAge--;
      }
      set('age', calculatedAge);
    } else {
      set('age', 0);
    }
  };

  // المدن حسب الدولة المختارة
  const cities = useMemo(() => getUnifiedCitiesForCountry(form.country || ''), [form.country]);

  const pCities = useMemo(() => getUnifiedCitiesForPartnerCountries(form.pCountry, form.country), [form.pCountry, form.country]);

  // تحديد اسم الدولة التي تمثل جنسية العضو الفعلية بدقة
  const userActualNationality = useMemo(() => {
    const explicit = (form.nationalityOther || form.nationality || '').trim();
    if (explicit && explicit !== 'أخرى' && explicit !== 'جنسية أخرى') {
      return normalizeNationality(explicit);
    }
    if (form.nationalityMode === 'same') {
      return normalizeNationality(form.country || 'السعودية');
    }
    return normalizeNationality(form.country || 'السعودية');
  }, [form.nationalityMode, form.nationality, form.nationalityOther, form.country]);

  // هل اختار العضو جنسية تختلف عن دولة إقامته؟
  const isDiffNationality = useMemo(() => {
    if (!form.country) return false;
    return !!userActualNationality && userActualNationality !== normalizeNationality(form.country);
  }, [userActualNationality, form.country]);

  const userActualCountry = form.country || 'السعودية';
  const userActualCity = form.city || 'الرياض';

  const pSelectedCountries = useMemo(() => {
    if (!form.pCountry || form.pCountry === 'لا يهم' || form.pCountry === 'لا مانع' || form.pCountry === 'أي دولة / لا مانع') return [];
    if (form.pCountry === 'نفس دولتي') return [userActualCountry];
    return Array.from(new Set(form.pCountry.split(/[،,]/).map((s) => s.trim()).filter(Boolean)));
  }, [form.pCountry, userActualCountry]);

  const pSelectedCities = useMemo(() => {
    if (!form.pCity || form.pCity === 'لا يهم' || form.pCity === 'لا مانع' || form.pCity === 'أي مدينة / لا مانع') return [];
    if (form.pCity === 'نفس مدينتي') return [userActualCity];
    return Array.from(new Set(form.pCity.split(/[،,]/).map((s) => s.trim()).filter(Boolean)));
  }, [form.pCity, userActualCity]);

  const pSelectedNationalities = useMemo(() => {
    if (
      !form.pNationality ||
      form.pNationality === 'لا يهم' ||
      form.pNationality === 'لا مانع' ||
      form.pNationality === 'اقبل اجنبي' ||
      form.pNationality === 'أقبل أجنبي' ||
      form.pNationality === 'أقبل غير مواطن / أجنبي (لا مانع من أي جنسية)'
    ) return [];
    if (form.pNationality === 'نفس جنسيتي') {
      return userActualNationality ? [userActualNationality] : [];
    }
    return Array.from(new Set(form.pNationality.split(/[،,]/).map((s) => s.trim()).filter(Boolean)));
  }, [form.pNationality, userActualNationality]);

  // حالات وتحديد أزرار الدولة والمدينة والجنسية التفاعلية
  const isNoPrefCountry = form.pCountry === 'لا مانع' || form.pCountry === 'لا يهم' || form.pCountry === 'أي دولة / لا مانع' || (!form.pCountry && !pCountryCustomOpen);
  const isOnlySameCountry = !isNoPrefCountry && pSelectedCountries.length === 1 && pSelectedCountries[0] === userActualCountry;
  const isCustomCountry = pCountryCustomOpen && !isNoPrefCountry && !isOnlySameCountry;

  const isNoPrefCity = form.pCity === 'لا مانع' || form.pCity === 'لا يهم' || form.pCity === 'أي مدينة / لا مانع' || (!form.pCity && !pCityCustomOpen);
  const isOnlySameCity = !isNoPrefCity && pSelectedCities.length === 1 && pSelectedCities[0] === userActualCity;
  const isCustomCity = pCityCustomOpen && !isNoPrefCity && !isOnlySameCity;

  const isNoPrefNat = form.pNationality === 'اقبل اجنبي' || form.pNationality === 'أقبل أجنبي' || form.pNationality === 'لا يهم' || form.pNationality === 'لا مانع' || form.pNationality === 'أقبل غير مواطن / أجنبي (لا مانع من أي جنسية)' || (!form.pNationality && !pNationalityCustomOpen);
  const isOnlySameNat = !isNoPrefNat && pSelectedNationalities.length === 1 && pSelectedNationalities[0] === userActualNationality;
  const isCustomNat = pNationalityCustomOpen && !isNoPrefNat && !isOnlySameNat;

  const partnerMaritalOptions = useMemo(() => getPartnerMaritalOptions(form.gender as any), [form.gender]);

  const isAllMaritalSelected = useMemo(() => {
    if (!form.pMaritalStatus) return false;
    if (form.pMaritalStatus === 'لا يهم' || form.pMaritalStatus === 'لا مانع' || form.pMaritalStatus === 'الجميع') return true;
    const items = form.pMaritalStatus.split('،').map((s) => s.trim()).filter((s) => s && s !== 'لا يهم' && s !== 'لا مانع' && s !== 'الجميع');
    return partnerMaritalOptions.length > 0 && partnerMaritalOptions.every((opt) => items.includes(opt));
  }, [form.pMaritalStatus, partnerMaritalOptions]);

  const pSelectedMarital = useMemo(() => {
    if (!form.pMaritalStatus) return [];
    if (form.pMaritalStatus === 'لا يهم' || form.pMaritalStatus === 'لا مانع' || form.pMaritalStatus === 'الجميع') {
      return [...partnerMaritalOptions];
    }
    return form.pMaritalStatus.split('،').map((s) => s.trim()).filter(Boolean);
  }, [form.pMaritalStatus, partnerMaritalOptions]);

  const shouldShowChildrenAccept = useMemo(() => {
    if (!form.pMaritalStatus) return false;
    if (isAllMaritalSelected || form.pMaritalStatus === 'الجميع' || form.pMaritalStatus === 'لا مانع' || form.pMaritalStatus === 'لا يهم') return true;
    const items = form.pMaritalStatus.split('،').map((s) => s.trim()).filter(Boolean);
    return items.some((item) =>
      item.includes('مطلق') || item.includes('مطلقة') ||
      item.includes('أرمل') || item.includes('أرملة') ||
      item.includes('متزوج')
    );
  }, [form.pMaritalStatus, isAllMaritalSelected]);

  const isSingleOnly = useMemo(() => {
    if (!form.pMaritalStatus || form.pMaritalStatus === 'لا يهم' || form.pMaritalStatus === 'لا مانع' || isAllMaritalSelected) return false;
    const items = form.pMaritalStatus.split('،').map((s) => s.trim()).filter((s) => s && s !== 'لا يهم' && s !== 'لا مانع' && s !== 'الجميع');
    return items.length === 1 && (items[0] === 'عزباء' || items[0] === 'أعزب' || items[0] === 'single');
  }, [form.pMaritalStatus, isAllMaritalSelected]);

  const handleTogglePartnerMarital = (opt: string) => {
    // إذا كانت فارغة تماماً
    if (!form.pMaritalStatus) {
      set('pMaritalStatus', opt);
      return;
    }

    // إذا كانت محددة كـ "الجميع" أو "لا مانع"
    let current: string[];
    if (form.pMaritalStatus === 'لا يهم' || form.pMaritalStatus === 'لا مانع' || form.pMaritalStatus === 'الجميع') {
      current = [...partnerMaritalOptions];
    } else {
      current = form.pMaritalStatus.split('،').map((s) => s.trim()).filter(Boolean);
    }

    if (current.includes(opt)) {
      // السماح بالتراجع وإلغاء التحديد حتى إن كان الخيار الوحيد (لجعله بدون اختيار)
      const updated = current.filter((m) => m !== opt);
      set('pMaritalStatus', updated.length > 0 ? updated.join('، ') : '');
    } else {
      const updated = [...current, opt];
      set('pMaritalStatus', updated.join('، '));
    }
  };

  // قائمة الدول الحيّة الموحدة
  const countryOptions = useMemo(() => getUnifiedCountries(), []);

  // قائمة الجنسيات الموحدة
  const nationalityOptions = useMemo(() => getUnifiedNationalities(form.gender as any, countryOptions), [countryOptions, form.gender]);

  const partnerNationalityOptions = useMemo(() => getUnifiedNationalities(isMale ? 'female' : 'male', countryOptions), [countryOptions, isMale]);

  // قائمة المذاهب الدينيه الموحدة
  const sectOptions = useMemo(() => getUnifiedSects(), []);

  // خيارات المظهر والعمل والتعليم الموحدة (مع شروحات درجات البشرة ولهجات المجتمع)
  const skinColorOptions = useMemo(() => getUnifiedSkinColorOptions(), []);

  const educationOptions = useMemo(() => getUnifiedEducationLevels(), []);

  const workTypeOptions = useMemo(() => getUnifiedWorkTypes(), []);

  const housingOptions = useMemo(() => getUnifiedHousingTypes(), []);

  const childrenCountOptions = useMemo(() => getChildrenCountList(), []);

  const smokingOptions = useMemo(() => getUnifiedSmokingOptions(), []);

  const maritalMaleOptions = useMemo(() => getSelfMaritalOptions('male'), []);
  const maritalFemaleOptions = useMemo(() => getSelfMaritalOptions('female'), []);

  // إضافة مدينة مقترحة
  const handleAddCity = (country: string) => (name: string) => {
    return dataService.db.addPendingGeo('city', name, country, form.nickname || form.realName || 'عضو جديد', 'register');
  };

  const handleAddCountry = (name: string) => {
    return dataService.db.addPendingGeo('country', name, '', form.nickname || form.realName || 'عضو جديد', 'register');
  };

  const handleAddNationality = (name: string) => {
    return dataService.db.addPendingGeo('nationality', name, form.country || '', form.nickname || form.realName || 'عضو جديد', 'register');
  };

  // التحقق من صحة كل خطوة
  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};

    // ====== الخطوة 0: الهوية الأساسية والإقامة ======
    if (s === 0) {
      if (!form.gender) e.gender = 'الرجاء تحديد الجنس (ذكر / أنثى)';
      if (!form.nickname.trim()) e.nickname = 'الرجاء إدخال الاسم المستعار (اسم العرض)';

      const dateParts = form.birthDate ? form.birthDate.split('-') : [];
      const dateComplete = dateParts.length === 3 && dateParts[0] && dateParts[1] && dateParts[2];
      if (!dateComplete) e.birthDate = 'الرجاء اختيار السنة والشهر واليوم';
      else if (form.age < 16) e.birthDate = 'يجب أن يكون عمرك 16 سنة على الأقل لإنشاء حساب';

      if (!form.country) e.country = 'الرجاء اختيار دولة الإقامة';
      if (!form.city) e.city = 'الرجاء اختيار المدينة';
      if (!form.district.trim()) e.district = 'الرجاء إدخال المنطقة / الحي';

      if (!form.nationalityMode) e.nationalityMode = 'الرجاء تحديد الجنسية';
      if (form.nationalityMode === 'byCountry') {
        if (!form.nationality.trim()) e.nationality = 'الرجاء اختيار الجنسية';
        if ((form.nationality === 'أخرى' || form.nationality === 'جنسية أخرى') && !form.nationalityOther.trim()) {
          e.nationalityOther = 'الرجاء كتابة اسم الجنسية';
        }
      }

      if (!form.sect) e.sect = 'الرجاء اختيار المذهب الديني';
      if ((form.sect === 'أخرى' || form.sect === 'مذهب آخر') && !form.sectOther.trim()) e.sectOther = 'الرجاء كتابة المذهب';

      if (!form.maritalStatus) e.maritalStatus = 'الرجاء اختيار الحالة الاجتماعية';
      if (!form.marriageType) e.marriageType = 'الرجاء اختيار نوع الزواج المطلوب';
    }

    // ====== الخطوة 1: المظهر، التعليم والعمل، والنبذة ======
    if (s === 1) {
      if (!form.height || Number(form.height) < 80 || Number(form.height) > 300) {
        e.height = 'الرجاء كتابة الطول الصحيح (بين 80 و 300 سم)';
      }
      if (!form.weight || Number(form.weight) < 20 || Number(form.weight) > 300) {
        e.weight = 'الرجاء كتابة الوزن الصحيح (بين 20 و 300 كجم)';
      }
      if (!form.skinColor) e.skinColor = 'الرجاء اختيار لون البشرة';
      if (!form.ethnicity?.trim()) e.ethnicity = 'الرجاء كتابة العرق / الأصل';
      if (!form.health?.trim()) e.health = 'الرجاء كتابة الحالة الصحية';
      if (!form.smoking) e.smoking = 'الرجاء اختيار حالة التدخين';
      if (!form.education) e.education = 'الرجاء اختيار المؤهل الدراسي';
      if (!form.workType) e.workType = 'الرجاء اختيار نوع جهة العمل';
      if (form.workType && form.workType !== 'بدون عمل' && !form.jobTitle.trim()) e.jobTitle = 'الرجاء كتابة المسمى الوظيفي';
      if (!form.housing) e.housing = 'الرجاء اختيار نوع السكن';
      if (form.bio.trim().length < 20) e.bio = 'النبذة قصيرة جدًا (20 حرفًا على الأقل)';
    }

    // ====== الخطوة 2: مواصفات الشريك ======
    if (s === 2) {
      // لا توجد قيود إجبارية معطلة لحرية اختيار الشريك
    }

    // ====== الخطوة 3: بيانات الحساب والأمان ======
    if (s === 3) {
      if (!form.realName.trim()) e.realName = 'الرجاء إدخال الاسم الكامل (الرباعي الحقيقي)';
      
      // تحقق من اسم المستخدم / اليوزر
      if (!form.username.trim()) {
        e.username = 'الرجاء إدخال اسم المستخدم (اليوزر)';
      } else if (!/^[a-z0-9_]{3,20}$/.test(form.username)) {
        e.username = 'يجب أن يتكون اسم المستخدم من 3 إلى 20 حرفًا إنجليزيًا أو أرقام أو شرطة سفلية (_) فقط';
      } else {
        const usernameExists = members.some((m) => m.username?.toLowerCase() === form.username.toLowerCase());
        if (usernameExists) {
          e.username = 'اسم المستخدم هذا محجوز بالفعل، يرجى اختيار اسم مستخدم آخر';
        }
      }

      if (!form.whatsapp || !form.whatsapp.trim()) {
        e.whatsapp = 'الرجاء إدخال رقم الواتساب الخاص بك للتواصل مع الإدارة';
      } else {
        const digitsOnly = form.whatsapp.replace(/\D/g, '');
        if (digitsOnly.length < 7) {
          e.whatsapp = 'رقم الواتساب غير مكتمل، يرجى التأكد من اختيار رمز الدولة وكتابة الرقم بشكل صحيح';
        }
      }

      if (!form.email.trim()) e.email = 'الرجاء إدخال البريد الإلكتروني';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'صيغة البريد الإلكتروني غير صحيحة';
      else if (emailTaken && lastCheckedEmail.current === form.email.trim().toLowerCase()) {
        e.email = 'البريد الإلكتروني هذا مستخدم بالفعل بحساب آخر';
      }

      if (!form.password) e.password = 'الرجاء إدخال كلمة المرور';
      else if (form.password.length < 6) e.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';

      if (!form.passwordConfirm) e.passwordConfirm = 'الرجاء تأكيد كلمة المرور';
      else if (form.password !== form.passwordConfirm) e.passwordConfirm = 'كلمتا المرور غير متطابقتين';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    // التنقل متاح للاختبار والتجربة واستعراض كافة الخيارات دون قيود
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      setErrors({});
    } else {
      if (validateStep(step)) {
        handleSubmit();
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStepClick = (targetStep: number) => {
    setStep(targetStep);
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      // 1) إنشاء حساب مصادقة حقيقي عبر Supabase Auth (بريد + كلمة مرور)
      const { data, error: signUpError } = await supabase.auth.signUp({ email: form.email.trim(), password: form.password });
      if (signUpError) {
        setSubmitError(signUpError.message.includes('already') ? 'البريد الإلكتروني هذا مستخدم بالفعل بحساب آخر' : signUpError.message);
        setSubmitting(false);
        return;
      }
      if (!data.session) {
        // يتطلب المشروع تأكيد البريد الإلكتروني قبل تفعيل الجلسة
        setSubmitError('تم إنشاء الحساب! يرجى تأكيد بريدك الإلكتروني من الرسالة المُرسلة إليك ثم تسجيل الدخول.');
        setSubmitting(false);
        return;
      }
      // 2) تجهيز الحقول بصيغتها النهائية النظيفة وحفظ أي بيانات جغرافية جديدة
      const finalNationality = form.nationalityMode === 'same'
        ? (getNationalityForCountry(form.country, form.gender as any) || form.country)
        : ((form.nationalityOther || form.nationality || '').trim() || form.country);

      if (form.nationalityOther?.trim()) {
        handleAddNationality(form.nationalityOther.trim());
        handleAddCountry(form.nationalityOther.trim());
      }

      let finalPartnerNationality = form.pNationality;
      if (!finalPartnerNationality || finalPartnerNationality === 'نفس جنسيتي' || finalPartnerNationality === userActualNationality) {
        finalPartnerNationality = userActualNationality;
      }

      const submissionForm: FormData = {
        ...form,
        nationality: finalNationality,
        pNationality: finalPartnerNationality,
        pCountry: form.pCountry === 'لا يهم' ? 'لا مانع' : (form.pCountry || 'لا مانع'),
        pCity: form.pCity === 'لا يهم' ? 'لا مانع' : (form.pCity || 'لا مانع'),
        pAcceptChildren: form.pAcceptChildren === 'لا يهم' ? 'لا مانع' : (form.pAcceptChildren || 'لا مانع'),
      };

      // إنشاء الملف الشخصي الفعلي مرتبطاً بحساب المصادقة (الجلسة تُرفق تلقائياً مع الطلب)
      const result = await registerNewMember(submissionForm);
      if (!result.ok) {
        setSubmitError(result.error || 'تعذّر إنشاء الملف الشخصي، حاول مرة أخرى');
        setSubmitting(false);
        return;
      }
      navigate('/profile');
    } catch (err: any) {
      setSubmitError(err?.message || 'حدث خطأ غير متوقع، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-cream-50 py-4 px-3 sm:py-6 sm:px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-navy-600 hover:text-gold-700 font-cairo font-semibold text-sm mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" /> العودة للرئيسية
        </Link>

        <div className="bg-white rounded-3xl shadow-luxe border border-cream-200/60 overflow-hidden">
          {/* Header مع شريط التقدم النقر الذكي */}
          <div className="bg-navy-gradient p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h1 className="font-cairo font-bold text-white text-base sm:text-lg">إنشاء حساب جديد</h1>
              <span className="text-gold-300 font-cairo font-bold text-xs sm:text-sm whitespace-nowrap">
                الخطوة {step + 1} من {STEPS.length}
              </span>
            </div>
            <ProgressBar value={progress} />
            <div className="flex justify-between mt-3">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStepClick(i)}
                  className="flex flex-col items-center gap-1 flex-1 transition-all cursor-pointer hover:opacity-90"
                >
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all ${
                    i < step ? 'bg-emerald-500 text-white shadow-sm' :
                    i === step ? 'bg-gold-gradient text-navy-900 shadow-md ring-2 ring-gold-300/50' :
                    'bg-white/20 text-cream-100 hover:bg-white/30'
                  }`}>
                    {i < step ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-cairo font-semibold hidden sm:block ${i <= step ? 'text-gold-300' : 'text-cream-200/60'}`}>
                    {s.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* محتوى الخطوة */}
          <div className="p-4 sm:p-7">
            <AnimatePresence mode="wait">
              {/* ====== الخطوة 0: الهوية الأساسية والإقامة ====== */}
              {step === 0 && (
                <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <SectionTitle icon={User} title="الهوية الأساسية والإقامة" desc="حدد بياناتك الاجتماعية والجغرافية الأساسية لتخصيص البحث والتوافق" />

                  {/* 1. تحديد الجنس أولاً */}
                  <Field label="الجنس" required error={errors.gender} hint="لتخصيص الخيارات ونظام المطابقة المعتمد">
                    <div className="grid grid-cols-2 gap-3">
                      <ChoiceCard
                        active={isMale}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            gender: 'male',
                            maritalStatus: '',
                            pMaritalStatus: '',
                            nationality: prev.nationalityMode === 'same' && prev.country ? getNationalityForCountry(prev.country, 'male') : prev.nationality,
                          }));
                          setErrors((prev) => ({ ...prev, gender: '', maritalStatus: '', nationality: '' }));
                        }}
                        icon={<div className={`w-12 h-12 rounded-full flex items-center justify-center ${isMale ? 'bg-blue-500' : 'bg-cream-100'}`}><Mars className={`w-6 h-6 ${isMale ? 'text-white' : 'text-navy-400'}`} /></div>}
                        title="ذكر"
                      />
                      <ChoiceCard
                        active={isFemale}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            gender: 'female',
                            maritalStatus: '',
                            pMaritalStatus: '',
                            nationality: prev.nationalityMode === 'same' && prev.country ? getNationalityForCountry(prev.country, 'female') : prev.nationality,
                          }));
                          setErrors((prev) => ({ ...prev, gender: '', maritalStatus: '', nationality: '' }));
                        }}
                        icon={<div className={`w-12 h-12 rounded-full flex items-center justify-center ${isFemale ? 'bg-rose-500' : 'bg-cream-100'}`}><Venus className={`w-6 h-6 ${isFemale ? 'text-white' : 'text-navy-400'}`} /></div>}
                        title="أنثى"
                      />
                    </div>
                  </Field>

                  {/* 2. الاسم المستعار / اسم العرض */}
                  <Field
                    label={
                      <div className="flex items-center justify-between w-full">
                        <span>الاسم المستعار (اسم العرض بالمنصة)</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-cairo font-bold">👁️ ظاهر بالأعضاء</span>
                      </div>
                    }
                    required
                    error={errors.nickname}
                    hint="الاسم الظاهر للأعضاء في بحث المنصة والملف الشخصي العام (مثال: أبو عبدالله، باحثة عن الستر)"
                  >
                    <TextInput
                      value={form.nickname}
                      onChange={(v) => {
                        set('nickname', v);
                        if (!form.username) {
                          const cleanedNick = v.trim();
                          if (cleanedNick) set('username', translitArabicToEnglish(cleanedNick));
                        }
                      }}
                      placeholder={isMale ? 'مثال: أبو عبدالله، القحطاني' : 'مثال: باحثة عن الستر، أم محمد'}
                    />
                  </Field>

                  {/* 3. تاريخ الميلاد والعمر */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="تاريخ الميلاد" required error={errors.birthDate} hint="اختر السنة ثم الشهر ثم اليوم">
                      <DateSelect value={form.birthDate} onChange={handleBirthDateChange} />
                    </Field>
                    <Field label="العمر (محسوب تلقائيًا)">
                      <div className="px-4 py-3 rounded-xl bg-gold-300/10 border-2 border-gold-300/40 flex items-center justify-between h-full">
                        <span className="text-xs text-navy-600 font-cairo">العمر الحالي:</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-cairo font-extrabold text-2xl text-gradient-gold">
                            {form.age > 0 ? form.age : '—'}
                          </span>
                          {form.age > 0 && <span className="text-navy-500 font-tajawal text-xs">سنة</span>}
                        </div>
                      </div>
                    </Field>
                  </div>

                  {/* 4. دولة الإقامة والمدينة والحي */}
                  <Field label="دولة الإقامة الحالية" required error={errors.country} hint="الدولة التي تقيم فيها حالياً">
                    <SearchableSelect
                      value={form.country}
                      onChange={setCountryAndSyncNationality}
                      options={countryOptions}
                      placeholder="ابحث واختر الدولة"
                      searchPlaceholder="اكتب اسم الدولة..."
                      allowAddNew
                      onAddNew={(newCountry) => {
                        setCountryAndSyncNationality(newCountry);
                        set('countryOther', newCountry);
                        handleAddCountry(newCountry);
                        return { ok: true };
                      }}
                      addNewLabel="إذا لم تجد دولتك؟ اضغط هنا لكتابة اسم الدولة"
                      addNewPlaceholder="اكتب اسم الدولة..."
                    />
                  </Field>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="المدينة" required error={errors.city || errors.cityOther}>
                      <SearchableSelect
                        value={form.city}
                        onChange={(v) => {
                          set('city', v);
                          if (v !== 'أخرى') set('cityOther', '');
                        }}
                        options={cities}
                        placeholder={form.country ? 'ابحث واختر المدينة' : 'اختر الدولة أولًا'}
                        searchPlaceholder="اكتب اسم المدينة..."
                        disabled={!form.country}
                        allowAddNew={!!form.country}
                        onAddNew={(newCity) => {
                          set('city', newCity);
                          set('cityOther', newCity);
                          handleAddCity(form.country)(newCity);
                          return { ok: true };
                        }}
                        addNewLabel="إذا لم تجد مدينتك؟ اضغط هنا لكتابة اسم المدينة"
                        addNewPlaceholder="اكتب اسم مدينتك..."
                      />
                    </Field>
                    <Field label="المنطقة / الحي" required error={errors.district} hint="الحي أو المنطقة التفصيلية">
                      <TextInput value={form.district} onChange={(v) => set('district', v)} placeholder="مثال: حي العليا، الملقا..." />
                    </Field>
                  </div>

                  {/* 5. الجنسية والمذهب */}
                  <Field label="الجنسية" required error={errors.nationalityMode || errors.nationality}>
                    <div className="space-y-3">
                      <RadioGroup
                        options={[
                          { value: 'same', label: form.country ? `نعم، جنسيتي ${getNationalityForCountry(form.country, form.gender as any) || form.country}` : 'نعم، نفس دولة الإقامة' },
                          { value: 'byCountry', label: 'اختر الدولة اللتي تحمل جنسيتها' },
                        ]}
                        value={form.nationalityMode}
                        onChange={(v) => {
                          set('nationalityMode', v);
                          if (v === 'same' && form.country) {
                            set('nationality', getNationalityForCountry(form.country, form.gender as any));
                          } else {
                            set('nationality', '');
                          }
                        }}
                        columns={2}
                      />

                      {form.nationalityMode === 'byCountry' && (
                        <div className="space-y-2 p-3 bg-cream-50 rounded-xl border border-cream-200">
                          <label className="text-xs text-navy-700 font-cairo font-bold block">اختر الدولة اللتي تحمل جنسيتها:</label>
                          <SearchableSelect
                            value={form.nationality}
                            onChange={(v) => {
                              set('nationality', v);
                              if (v !== 'أخرى') {
                                set('nationalityOther', '');
                              }
                            }}
                            options={nationalityOptions}
                            placeholder="اختر الدولة اللتي تحمل جنسيتها..."
                            searchPlaceholder="اكتب اسم الدولة اللتي تحمل جنسيتها..."
                            allowAddNew
                            onAddNew={(newNat) => {
                              const trimmed = newNat.trim();
                              set('nationality', trimmed);
                              set('nationalityOther', trimmed);
                              handleAddNationality(trimmed);
                              handleAddCountry(trimmed);
                              return { ok: true };
                            }}
                            addNewLabel="إذا لم تجد دولتك؟ اضغط هنا لكتابة اسم الدولة اللتي تحمل جنسيتها"
                            addNewPlaceholder="اكتب اسم الدولة اللتي تحمل جنسيتها..."
                          />

                          {/* عند اختيار أخرى أو كتابة اسم دولة جديدة */}
                          {(form.nationality === 'أخرى' || form.nationality === 'دولة أخرى' || form.nationalityOther) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 space-y-1.5 p-3 bg-white rounded-xl border border-amber-300 shadow-2xs">
                              <label className="text-xs text-navy-800 font-cairo font-bold block">
                                اكتب اسم الدولة اللتي تحمل جنسيتها: <span className="text-rose-500">*</span>
                              </label>
                              <TextInput
                                value={form.nationalityOther}
                                onChange={(v) => {
                                  set('nationalityOther', v);
                                  if (v.trim()) {
                                    handleAddNationality(v.trim());
                                    handleAddCountry(v.trim());
                                  }
                                }}
                                placeholder="أدخل اسم الدولة بالتفصيل (مثل: بريطانيا، إسبانيا، تركيا...)"
                              />
                              {errors.nationalityOther && <p className="text-xs text-rose-deep font-tajawal">{errors.nationalityOther}</p>}
                              <p className="text-[11px] text-slate-500 font-tajawal">
                                سيتم إرسال اسم الدولة تلقائياً لإدارة المنصة في خيارات المدن والدول لمراجعتها وتثبيتها.
                              </p>
                            </motion.div>
                          )}

                          {form.nationality && form.nationality !== 'أخرى' && (
                            <p className="text-xs text-emerald-700 font-tajawal">
                              الدولة اللتي تم تحديدها: <span className="font-bold">{form.nationalityOther || form.nationality}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </Field>

                  <Field label="المذهب" required error={errors.sect} hint="المذهب الديني المتبع">
                    <RadioGroup
                      options={sectOptions.map((s) => ({ value: s, label: s }))}
                      value={form.sect}
                      onChange={(v) => set('sect', v)}
                      columns={3}
                    />
                    {(form.sect === 'أخرى' || form.sect === 'مذهب آخر') && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2">
                        <TextInput
                          value={form.sectOther}
                          onChange={(v) => set('sectOther', v)}
                          placeholder="اكتب المذهب بالتفصيل..."
                        />
                        {errors.sectOther && <p className="text-xs text-rose-deep font-tajawal mt-1">{errors.sectOther}</p>}
                      </motion.div>
                    )}
                  </Field>

                  {/* 6. الحالة الاجتماعية ونوع الزواج */}
                  <Field label="الحالة الاجتماعية" required error={errors.maritalStatus}>
                    <RadioGroup
                      options={isMale ? maritalMaleOptions : maritalFemaleOptions}
                      value={form.maritalStatus}
                      onChange={(v) => set('maritalStatus', v)}
                      columns={isMale ? 4 : 3}
                    />
                  </Field>

                  <Field label="نوع الزواج المطلوب" required error={errors.marriageType} hint="اختر نوع الزواج المطلوب (معلن، مسيار، أو لا مانع لكلا النوعين)">
                    <RadioGroup
                      options={[
                        { value: 'announced', label: 'معلن' },
                        { value: 'misyar', label: 'مسيار' },
                        { value: 'both', label: 'لا مانع / معلن او مسيار' },
                      ]}
                      value={form.marriageType || ''}
                      onChange={(v) => set('marriageType', v)}
                      columns={3}
                    />
                  </Field>

                  {/* حقول مطلقة/أرملة/أرمل — الأبناء */}
                  {['divorced', 'widower', 'widow', 'widowed', 'مطلق', 'مطلقة', 'أرمل', 'أرملة'].includes(form.maritalStatus) && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 bg-cream-50 rounded-2xl p-4 border border-cream-200">
                      <h4 className="font-cairo font-bold text-navy-900 text-sm flex items-center gap-2">
                        <User className="w-4 h-4 text-gold-600" /> معلومات الأبناء
                      </h4>
                      <Field label={isMale ? 'هل لديك أبناء؟' : 'هل لديكِ أبناء؟'}>
                        <RadioGroup options={C.YES_NO} value={form.hasChildren} onChange={(v) => set('hasChildren', v)} />
                      </Field>
                      {form.hasChildren === 'yes' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid sm:grid-cols-2 gap-4">
                          <Field label="عدد الأبناء (اختر من 1 إلى 20)">
                            <SelectInput value={form.childrenCount} onChange={(v) => set('childrenCount', v)} options={childrenCountOptions} placeholder="اختر عدد الأبناء" />
                          </Field>
                          <Field label={isMale ? 'هل الأبناء يعيشون معك؟' : 'هل الأبناء يعيشون معكِ؟'}>
                            <RadioGroup options={C.YES_NO} value={form.childrenLiveWith} onChange={(v) => set('childrenLiveWith', v)} />
                          </Field>
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {/* حقول متزوج (للرجال) */}
                  {isMale && ['married', 'متزوج'].includes(form.maritalStatus) && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 bg-cream-50 rounded-2xl p-4 border border-cream-200">
                      <h4 className="font-cairo font-bold text-navy-900 text-sm flex items-center gap-2">
                        <User className="w-4 h-4 text-gold-600" /> تفاصيل الزواج الحالي
                      </h4>
                      <Field label="عدد الزوجات الحالي" required>
                        <RadioGroup options={C.WIFE_COUNT} value={form.wifeCount} onChange={(v) => set('wifeCount', v)} columns={3} />
                      </Field>
                      <Field label="هل لديك أبناء؟">
                        <RadioGroup options={C.YES_NO} value={form.hasChildren} onChange={(v) => set('hasChildren', v)} />
                      </Field>
                      {form.hasChildren === 'yes' && (
                        <Field label="كم عدد الأبناء؟ (من 1 إلى 20)">
                          <SelectInput value={form.childrenCount} onChange={(v) => set('childrenCount', v)} options={childrenCountOptions} placeholder="اختر عدد الأبناء" />
                        </Field>
                      )}
                      <Field label="هل تبحث عن زوجة أخرى؟">
                        <RadioGroup options={C.YES_NO} value={form.seekingWife} onChange={(v) => set('seekingWife', v)} />
                      </Field>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ====== الخطوة 1: المظهر والعمل والنبذة ====== */}
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <SectionTitle icon={FileText} title="المظهر والعمل والتعليم" desc="المواصفات الجسدية والوظيفية والنبذة التعريفية" />

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="الطول (كتابة)" required error={errors.height} hint="أدخل طولك بالسنتيمتر (من 80 إلى 300 سم)">
                      <div className="relative">
                        <TextInput
                          type="number"
                          min={80}
                          max={300}
                          value={form.height ? String(form.height) : ''}
                          onChange={(v) => set('height', v ? Number(v) : '')}
                          placeholder="اكتب الطول (80 - 300)"
                          className="pl-12"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-navy-400 font-tajawal pointer-events-none">سم</span>
                      </div>
                    </Field>
                    <Field label="الوزن (كتابة)" required error={errors.weight} hint="أدخل وزنك بالكيلوغرام (من 20 إلى 300 كجم)">
                      <div className="relative">
                        <TextInput
                          type="number"
                          min={20}
                          max={300}
                          value={form.weight ? String(form.weight) : ''}
                          onChange={(v) => set('weight', v ? Number(v) : '')}
                          placeholder="اكتب الوزن (20 - 300)"
                          className="pl-12"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-navy-400 font-tajawal pointer-events-none">كجم</span>
                      </div>
                    </Field>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="لون البشرة" required error={errors.skinColor}>
                      <SearchableSelect
                        value={form.skinColor}
                        onChange={(v) => {
                          set('skinColor', v);
                          set('skinColorOther', '');
                        }}
                        options={skinColorOptions}
                        placeholder="اختر لون البشرة"
                        searchPlaceholder="ابحث في ألوان البشرة..."
                      />
                    </Field>
                    <Field label="العرق / الأصل" required error={errors.ethnicity} hint="اختر من القائمة المتاحة أو اكتب أصلك/عرقك بالتفصيل">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {C.ETHNICITIES.map((eth, ethIdx) => (
                            <button
                              key={`reg-eth-${eth}-${ethIdx}`}
                              type="button"
                              onClick={() => {
                                if (eth === 'أخرى') {
                                  set('ethnicity', '');
                                } else {
                                  set('ethnicity', eth);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-cairo font-bold border transition-all ${
                                form.ethnicity === eth
                                  ? 'bg-gold-500 text-navy-950 border-gold-600 shadow-2xs'
                                  : 'bg-cream-50 text-navy-700 border-cream-200 hover:bg-cream-100'
                              }`}
                            >
                              {eth}
                            </button>
                          ))}
                        </div>
                        <TextInput
                          value={form.ethnicity}
                          onChange={(v) => set('ethnicity', v)}
                          placeholder="اكتب الأصل/العرق (مثال: قبيلي أصل وفصل، خضيري، عربي...)"
                        />
                      </div>
                    </Field>
                  </div>

                  <Field label="القبيلة / النسب" hint="اختياري — اكتب اسم القبيلة أو انتسابك">
                    <TextInput value={form.tribe} onChange={(v) => set('tribe', v)} placeholder="مثال: قبيلي، عتيبي، مطيري، قحطاني، خضيري..." />
                  </Field>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="الحالة الصحية" required error={errors.health}>
                      <TextInput value={form.health} onChange={(v) => set('health', v)} placeholder="ممتازة، سليم الحمد لله..." />
                    </Field>
                    <Field label={isFemale ? 'هل تدخنين؟' : 'هل تدخن؟'} required error={errors.smoking}>
                      <SelectInput value={form.smoking} onChange={(v) => set('smoking', v)} options={smokingOptions} placeholder="اختر" />
                    </Field>
                  </div>

                  <Field label="المؤهل الدراسي" required error={errors.education}>
                    <SelectInput value={form.education} onChange={(v) => set('education', v)} options={educationOptions} placeholder="اختر المؤهل" />
                  </Field>

                  <Field label="نوع جهة العمل" required error={errors.workType}>
                    <RadioGroup
                      options={workTypeOptions.map((w: any) => (typeof w === 'string' ? { value: w, label: w } : w))}
                      value={form.workType}
                      onChange={(v) => { set('workType', v); set('jobTitle', ''); }}
                      columns={3}
                    />
                  </Field>

                  {form.workType && form.workType !== 'بدون عمل' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <Field label="المسمى الوظيفي" required error={errors.jobTitle}>
                        <TextInput value={form.jobTitle} onChange={(v) => set('jobTitle', v)} placeholder="مثال: معلم، مهندس، موظف إداري..." />
                      </Field>
                    </motion.div>
                  )}

                  <Field label="نوع السكن" required error={errors.housing}>
                    <RadioGroup
                      options={housingOptions.map((h: any) => typeof h === 'string' ? { value: h, label: h } : h)}
                      value={form.housing}
                      onChange={(v) => set('housing', v)}
                      columns={2}
                    />
                  </Field>

                    <Field label="نبذة تعريفية عن نفسك" required error={errors.bio} hint={`${form.bio.length}/500 حرف (20 حرفًا على الأقل)`}>
                    <TextArea value={form.bio} onChange={(v) => set('bio', v)} placeholder="اكتب نبذة مختصرة عن شخصيتك، قيمك، وأهدافك المستقبليّة..." rows={4} />
                  </Field>
                </motion.div>
              )}

              {/* ====== الخطوة 2: مواصفات الشريك ====== */}
              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <SectionTitle icon={Heart} title={`مواصفات ${partnerTerms.partnerFullLabel} المطلوبة`} desc="حدد الخيارات الأساسية المطلوبة لشريك حياتك باختصار وسهولة" />

                  {/* 1. دولة الشريك المطلوبة */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                    <label className="block text-xs font-cairo font-bold text-slate-800">
                      1. {partnerTerms.countryLabel}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          set('pCountry', userActualCountry);
                          setPCountryCustomOpen(true);
                          setPCountryDropdownTrigger(0);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                          isOnlySameCountry
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isOnlySameCountry ? '✓ ' : ''}نفس دولتي ({userActualCountry})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          set('pCountry', 'لا مانع');
                          setPCountryCustomOpen(false);
                          setPCountryDropdownTrigger(0);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                          isNoPrefCountry
                            ? 'bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isNoPrefCountry ? '✓ ' : ''}أي دولة / لا مانع
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPCountryCustomOpen(true);
                          setPCountryDropdownTrigger((t) => (t <= 0 ? 1 : t + 1));
                          if (isNoPrefCountry || isOnlySameCountry) {
                            set('pCountry', '');
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                          isCustomCountry
                            ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isCustomCountry ? '✓ ' : ''}تحديد دول معينة
                      </button>
                    </div>

                    {pCountryCustomOpen && !isNoPrefCountry && (
                      <div className="pt-2">
                        <Field label="الدول المطلوبة (يمكنك اختيار دولة واحدة أو عدة دول)" hint={`الدولة الحالية: ${userActualCountry} (يمكنك اختيار دول أخرى معها)`}>
                          <MultiSearchableSelect
                            values={pSelectedCountries}
                            onChange={(newCountries) => {
                              set('pCountry', newCountries.length > 0 ? newCountries.join('، ') : '');
                            }}
                            options={countryOptions}
                            placeholder="ابحث واختر الدول المطلوبة..."
                            searchPlaceholder="ابحث عن دولة..."
                            openTrigger={pCountryDropdownTrigger}
                            allowAddNew
                            onAddNew={handleAddCountry}
                            addNewLabel="إذا لم تجد الدولة؟ اضغط هنا لكتابتها"
                          />
                        </Field>
                      </div>
                    )}
                  </div>

                  {/* 2. مدينة الشريك المطلوبة */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                    <label className="block text-xs font-cairo font-bold text-slate-800">
                      2. {partnerTerms.cityLabel}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          set('pCity', userActualCity);
                          setPCityCustomOpen(true);
                          setPCityDropdownTrigger(0);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                          isOnlySameCity
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isOnlySameCity ? '✓ ' : ''}نفس مدينتي ({userActualCity})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          set('pCity', 'لا مانع');
                          setPCityCustomOpen(false);
                          setPCityDropdownTrigger(0);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                          isNoPrefCity
                            ? 'bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isNoPrefCity ? '✓ ' : ''}أي مدينة / لا مانع
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPCityCustomOpen(true);
                          setPCityDropdownTrigger((t) => (t <= 0 ? 1 : t + 1));
                          if (isNoPrefCity || isOnlySameCity) {
                            set('pCity', '');
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                          isCustomCity
                            ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isCustomCity ? '✓ ' : ''}تحديد مدن معينة
                      </button>
                    </div>

                    {pCityCustomOpen && !isNoPrefCity && (
                      <div className="pt-2">
                        {pCities.length === 0 && !form.country && (
                          <p className="mb-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 font-cairo">
                            يرجى تحديد دولة إقامتك أولاً في البيانات الشخصية (أو تحديد دولة الشريك أعلاه) لعرض المدن المتاحة.
                          </p>
                        )}
                        <Field label="المدن المطلوبة (يمكنك اختيار مدينة واحدة أو عدة مدن)" hint={`المدينة الحالية: ${userActualCity} (يمكنك اختيار مدن أخرى معها)`}>
                          <MultiSearchableSelect
                            values={pSelectedCities}
                            onChange={(newCities) => {
                              set('pCity', newCities.length > 0 ? newCities.join('، ') : '');
                            }}
                            options={pCities}
                            placeholder="ابحث واختر المدن المطلوبة..."
                            searchPlaceholder="ابحث عن مدينة..."
                            openTrigger={pCityDropdownTrigger}
                            allowAddNew
                            onAddNew={(newCity) => {
                              handleAddCity(form.pCountry || form.country)(newCity);
                              return { ok: true };
                            }}
                            addNewLabel="إذا لم تجد المدينة؟ اضغط هنا لكتابتها"
                          />
                        </Field>
                      </div>
                    )}
                  </div>

                  {/* 3. الجنسية المطلوبة للشريك */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                    <label className="block text-xs font-cairo font-bold text-slate-800">
                      3. {partnerTerms.nationalityLabel}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {/* إذا كانت الجنسية تختلف عن دولة الإقامة: يظهر أولاً زر أقبل أجنبي، ثم نفس جنسيتي */}
                      {isDiffNationality ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              set('pNationality', 'اقبل اجنبي');
                              setPNationalityCustomOpen(false);
                              setPNationalityDropdownTrigger(0);
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                              isNoPrefNat
                                ? 'bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isNoPrefNat ? '✓ ' : ''}أقبل غير مواطن / أجنبي (لا مانع من أي جنسية)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              set('pNationality', userActualNationality);
                              setPNationalityCustomOpen(true);
                              setPNationalityDropdownTrigger(0);
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                              isOnlySameNat
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isOnlySameNat ? '✓ ' : ''}نفس جنسيتي ({userActualNationality})
                          </button>
                        </>
                      ) : (
                        /* إذا كانت الجنسية نفس دولة الإقامة: يظهر أولاً زر نفس جنسيتي، ثم أقبل أجنبي */
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              set('pNationality', userActualNationality);
                              setPNationalityCustomOpen(true);
                              setPNationalityDropdownTrigger(0);
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                              isOnlySameNat
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isOnlySameNat ? '✓ ' : ''}نفس جنسيتي ({userActualNationality})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              set('pNationality', 'اقبل اجنبي');
                              setPNationalityCustomOpen(false);
                              setPNationalityDropdownTrigger(0);
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                              isNoPrefNat
                                ? 'bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isNoPrefNat ? '✓ ' : ''}أقبل غير مواطن / أجنبي (لا مانع من أي جنسية)
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setPNationalityCustomOpen(true);
                          setPNationalityDropdownTrigger((t) => (t <= 0 ? 1 : t + 1));
                          if (isNoPrefNat || isOnlySameNat) {
                            set('pNationality', '');
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                          isCustomNat
                            ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isCustomNat ? '✓ ' : ''}تحديد جنسيات معينة
                      </button>
                    </div>

                    {pNationalityCustomOpen && !isNoPrefNat && (
                      <div className="pt-2">
                        <Field label="تحديد جنسيات معينة (يمكنك اختيار جنسية واحدة أو عدة جنسيات)" hint={`الدولة التي تحمل جنسيتها: ${userActualNationality} (يمكنك اختيار دول أخرى معها)`}>
                          <MultiSearchableSelect
                            values={pSelectedNationalities}
                            onChange={(newNats) => {
                              set('pNationality', newNats.length > 0 ? newNats.join('، ') : '');
                            }}
                            options={partnerNationalityOptions}
                            placeholder="ابحث واختر الجنسيات المطلوبة..."
                            searchPlaceholder="أدخل اسم الدولة التي منها جنسيتك..."
                            openTrigger={pNationalityDropdownTrigger}
                            allowAddNew
                            onAddNew={(newNat) => {
                              handleAddNationality(newNat);
                              handleAddCountry(newNat);
                              return { ok: true };
                            }}
                            addNewLabel="إذا لم تجد الجنسية؟ اضغط هنا لكتابة دولة الجنسية"
                            addNewPlaceholder="أدخل اسم الدولة التي منها جنسيتك..."
                          />
                        </Field>
                      </div>
                    )}
                  </div>

                  {/* 4. العمر */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="block text-xs font-cairo font-bold text-slate-800">
                        4. {partnerTerms.ageLabel}
                      </label>
                      <span className="text-xs font-cairo font-extrabold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        {(!form.pAgeMin && !form.pAgeMax) || (Number(form.pAgeMin) === 0 && Number(form.pAgeMax) === 0)
                          ? 'غير محدد (أي عمر)'
                          : `من ${form.pAgeMin || 'أي عمر'} إلى ${form.pAgeMax || 'أي عمر'} سنة`}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { set('pAgeMin', ''); set('pAgeMax', ''); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-cairo font-bold border transition-all ${
                          (!form.pAgeMin && !form.pAgeMax) || (Number(form.pAgeMin) === 0 && Number(form.pAgeMax) === 0)
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        غير محدد / أي عمر
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] text-slate-600 font-cairo font-bold mb-1 block">الحد الأدنى للعمر (من)</label>
                        <input
                          type="number"
                          min={16}
                          max={90}
                          value={form.pAgeMin || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            set('pAgeMin', val === '' ? '' : Number(val));
                          }}
                          placeholder="مثال: 20 (أو اتركه فارغاً)"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-sm text-navy-900"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-cairo font-bold mb-1 block">الحد الأقصى للعمر (إلى)</label>
                        <input
                          type="number"
                          min={16}
                          max={90}
                          value={form.pAgeMax || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            set('pAgeMax', val === '' ? '' : Number(val));
                          }}
                          placeholder="مثال: 45 (أو اتركه فارغاً)"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-sm text-navy-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. الحالة الاجتماعية (خيارات متعددة) */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="block text-xs font-cairo font-bold text-slate-800">
                        5. {partnerTerms.maritalLabel} (يمكنك اختيار أكثر من خيار)
                      </label>
                      {form.pMaritalStatus && (
                        <button
                          type="button"
                          onClick={() => set('pMaritalStatus', '')}
                          className="text-[11px] text-rose-600 hover:text-rose-700 font-cairo font-bold hover:underline"
                        >
                          إلغاء التحديد (بدون اختيار)
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (isAllMaritalSelected) {
                            set('pMaritalStatus', '');
                          } else {
                            set('pMaritalStatus', partnerMaritalOptions.join('، '));
                          }
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${
                          isAllMaritalSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isAllMaritalSelected && <Check className="w-3.5 h-3.5 text-white inline-block ml-1" />}
                        الجميع (لا مانع من أي حالة)
                      </button>
                      {partnerMaritalOptions.map((opt, idx) => {
                        const isSelected = pSelectedMarital.includes(opt);
                        return (
                          <button
                            key={`${opt}-${idx}`}
                            type="button"
                            onClick={() => handleTogglePartnerMarital(opt)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-bold transition-all border flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-gold-300/30 text-navy-900 border-gold-500 shadow-2xs font-extrabold'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 text-navy-900" />}
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {!form.pMaritalStatus && (
                      <p className="text-[11px] text-slate-500 font-tajawal">
                        لم يتم تحديد أي حالة (متروك بدون اختيار أو تفضيل). يمكنك النقر على أي حالة لتحديدها، أو النقر مجدداً لإلغائها.
                      </p>
                    )}
                  </div>

                  {/* 6. قبول الأطفال (يظهر عند اختيار الجميع أو مطلق أو أرمل أو متزوج للنساء) */}
                  {shouldShowChildrenAccept && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                      <label className="block text-xs font-cairo font-bold text-slate-800">
                        6. {partnerTerms.childrenLabel}
                      </label>
                      <RadioGroup
                        options={[
                          { value: 'أقبل', label: 'أقبل' },
                          { value: 'لا', label: 'لا (أفضل بدون أطفال)' },
                          { value: 'بشرط ألا يعيشوا معنا', label: 'بشرط ألا يعيشوا معنا' },
                        ]}
                        value={
                          form.pAcceptChildren === 'لا مانع' || form.pAcceptChildren === 'نعم' || form.pAcceptChildren === 'أقبل'
                            ? 'أقبل'
                            : (form.pAcceptChildren || 'أقبل')
                        }
                        onChange={(v) => set('pAcceptChildren', v)}
                        columns={3}
                      />
                    </motion.div>
                  )}

                  {/* 7. ملاحظات وصفات إضافية */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                    <label className="block text-xs font-cairo font-bold text-slate-800">
                      7. ملاحظات وصفات إضافية مرغوبة
                    </label>
                    <TextArea
                      value={form.pNotes}
                      onChange={(v) => set('pNotes', v)}
                      placeholder={partnerTerms.notesPlaceholder || "اكتب أي مواصفات أو تفاصيل إضافية ترغب بها في شريك حياتك..."}
                      rows={3}
                    />
                  </div>
                </motion.div>
              )}

              {/* ====== الخطوة 3: بيانات الحساب والأمان ====== */}
              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5