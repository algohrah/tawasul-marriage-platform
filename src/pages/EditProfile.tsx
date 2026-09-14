import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Save, User, MapPin, Heart, FileText, Check, ShieldCheck,
  Lock, Ruler, Weight, GraduationCap, Briefcase, Calendar,
} from 'lucide-react';
import { useApp, type ProfileData } from '../lib/AppContext';
import { Button } from '../components/ui/Button';
import {
  Field, TextInput, SelectInput, TextArea, RadioGroup,
  RangeSlider, DateSelect, SelectWithOther,
} from '../components/ui/FormFields';
import SearchableSelect from '../components/ui/SearchableSelect';
import MultiSearchableSelect from '../components/ui/MultiSearchableSelect';
import * as C from '../lib/constants';
import {
  getSelfMaritalOptions,
  getPartnerMaritalOptions,
  getPartnerTerms,
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



export default function EditProfile() {
  const navigate = useNavigate();
  const { profileData, updateProfileData, showToast, user } = useApp();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [pCountryCustomOpen, setPCountryCustomOpen] = useState(true);
  const [pCityCustomOpen, setPCityCustomOpen] = useState(false);
  const [pNationalityCustomOpen, setPNationalityCustomOpen] = useState(false);
  const [pCountryDropdownTrigger, setPCountryDropdownTrigger] = useState(0);
  const [pCityDropdownTrigger, setPCityDropdownTrigger] = useState(0);
  const [pNationalityDropdownTrigger, setPNationalityDropdownTrigger] = useState(0);

  // حساب تاريخ الميلاد الأولي إذا كان خاليًا ولكن العمر موجود
  const initialBirthDate = useMemo(() => {
    if (profileData.birthDate) return profileData.birthDate;
    if (profileData.age && profileData.age > 0) {
      const computedYear = new Date().getFullYear() - profileData.age;
      return `${computedYear}-01-01`;
    }
    return '';
  }, [profileData.birthDate, profileData.age]);

  // نسخة محلية من البيانات للتعديل
  const [form, setForm] = useState<ProfileData>({ ...profileData, birthDate: initialBirthDate });

  useEffect(() => {
    const bDate = profileData.birthDate || (profileData.age ? `${new Date().getFullYear() - profileData.age}-01-01` : '');
    setForm({ ...profileData, birthDate: bDate });
    if (profileData.pCountry && profileData.pCountry !== 'لا مانع' && profileData.pCountry !== 'لا يهم') {
      setPCountryCustomOpen(true);
    }
    if (profileData.pCity && profileData.pCity !== 'لا مانع' && profileData.pCity !== 'لا يهم') {
      setPCityCustomOpen(true);
    }
    if (profileData.pNationality && profileData.pNationality !== 'اقبل اجنبي' && profileData.pNationality !== 'أقبل أجنبي' && profileData.pNationality !== 'لا مانع' && profileData.pNationality !== 'لا يهم') {
      setPNationalityCustomOpen(true);
    }
  }, [profileData]);

  // نضمن تحميل قوائم المدن/الجنسيات الرسمية من قاعدة البيانات (نفس مصدر البحث والتسجيل)
  useEffect(() => { dataService.db.ensureGeoLoaded?.().catch(() => undefined); }, []);

  const isMale = form.gender === 'male';
  const isFemale = form.gender === 'female';
  const partnerTerms = useMemo(() => getPartnerTerms(form.gender as any), [form.gender]);

  const set = (key: keyof ProfileData, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  // قائمة الدول الموحدة
  const countryOptions = useMemo(() => getUnifiedCountries(), []);

  // المدن حسب الدولة المحددة (موحدة)
  const cities = useMemo(() => getUnifiedCitiesForCountry(form.country || ''), [form.country]);

  // مدن الشريك المطلوبة (موحدة)
  const pCities = useMemo(() => getUnifiedCitiesForPartnerCountries(form.pCountry, form.country), [form.pCountry, form.country]);

  const userActualNationality = useMemo(() => {
    const raw = (form.nationality || form.country || 'السعودية').trim();
    return normalizeNationality(raw);
  }, [form.nationality, form.country]);

  const isDiffNationality = useMemo(() => {
    if (!form.country) return false;
    return userActualNationality !== normalizeNationality(form.country);
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
    if (form.pMaritalStatus === 'لا يهم' || form.pMaritalStatus === 'لا مانع' || form.pMaritalStatus === 'الجميع') return true;
    const items = (form.pMaritalStatus || '').split('،').map((s) => s.trim()).filter((s) => s && s !== 'لا يهم' && s !== 'لا مانع' && s !== 'الجميع');
    return partnerMaritalOptions.length > 0 && partnerMaritalOptions.every((opt) => items.includes(opt));
  }, [form.pMaritalStatus, partnerMaritalOptions]);

  const pSelectedMarital = useMemo(() => {
    if (form.pMaritalStatus === 'لا يهم' || form.pMaritalStatus === 'لا مانع' || form.pMaritalStatus === 'الجميع') {
      return [...partnerMaritalOptions];
    }
    if (!form.pMaritalStatus) return [];
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
    if (!form.pMaritalStatus) {
      set('pMaritalStatus', opt);
      return;
    }
    let current: string[];
    if (form.pMaritalStatus === 'لا يهم' || form.pMaritalStatus === 'لا مانع' || form.pMaritalStatus === 'الجميع') {
      current = [...partnerMaritalOptions];
    } else {
      current = (form.pMaritalStatus || '').split('،').map((s) => s.trim()).filter(Boolean);
    }
    if (current.includes(opt)) {
      const updated = current.filter((m) => m !== opt);
      set('pMaritalStatus', updated.length > 0 ? updated.join('، ') : '');
    } else {
      const updated = [...current, opt];
      set('pMaritalStatus', updated.join('، '));
    }
  };

  // الجنسيات الموحدة
  const nationalityOptions = useMemo(() => getUnifiedNationalities(form.gender as any, countryOptions), [form.gender, countryOptions]);
  const partnerNationalityOptions = useMemo(() => getUnifiedNationalities(isMale ? 'female' : 'male', countryOptions), [isMale, countryOptions]);

  // إضافة مدينة مقترحة
  const handleAddCity = (country: string) => (name: string) => {
    return dataService.db.addPendingGeo('city', name, country, form.nickname || profileData.nickname || 'عضو', 'register');
  };

  const handleAddCountry = (name: string) => {
    return dataService.db.addPendingGeo('country', name, '', form.nickname || profileData.nickname || 'عضو', 'profile');
  };

  const handleAddNationality = (name: string) => {
    return dataService.db.addPendingGeo('nationality', name, form.country || '', form.nickname || profileData.nickname || 'عضو', 'profile');
  };

  // حساب العمر من تاريخ الميلاد
  const handleBirthDateChange = (date: string) => {
    set('birthDate', date);
    const parts = date ? date.split('-') : [];
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const birth = new Date(date);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
      set('age', age);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // حماية حقل الجنس: لا يمكن تغييره بواسطة العضو ويقتصر تعديله على لوحة الإدارة فقط
      const payload = {
        ...form,
        gender: profileData.gender || form.gender,
      };
      // ننتظر اكتمال حفظ التعديلات في قاعدة البيانات قبل المتابعة
      const success = await updateProfileData(payload);
      if (success === false) {
        showToast('تعذّر حفظ التغييرات في قاعدة البيانات، حاول مجدداً', 'error');
        setSaving(false);
        return;
      }
      // إعادة جلب الملف من قاعدة البيانات للتأكد من نجاح الحفظ
      const activeId = user?.memberId || (typeof window !== 'undefined' ? dataService.db.getCurrentUserId() : null);
      if (activeId) {
        try {
          const fresh = await dataService.db.members.getById(activeId);
          if (fresh) {
            // تحديث profileData بالبيانات الفعلية من قاعدة البيانات
            setForm({ ...form, ...(fresh as any) });
          }
        } catch { /* ignore refresh error */ }
      }
      setSaving(false);
      setSaved(true);
      showToast('تم حفظ التغييرات بنجاح ✓', 'success');
      setTimeout(() => navigate('/profile'), 600);
    } catch (err) {
      console.error('[EditProfile] Error saving profile:', err);
      setSaving(false);
      showToast('حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى', 'error');
    }
  };

  const sections = [
    {
      title: 'المعلومات الأساسية',
      icon: User,
      fields: (
        <>
          <Field label="الجنس" hint="لا يمكن تغييره إلا عبر الإدارة">
            <div className="px-4 py-2.5 rounded-xl bg-slate-100/90 dark:bg-navy-800/80 border border-slate-200 dark:border-navy-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isMale ? 'bg-blue-500' : 'bg-rose-500'}`} />
                <span className="font-cairo font-bold text-sm text-navy-900 dark:text-cream-100">
                  {isMale ? 'ذكر' : 'أنثى'}
                </span>
              </div>
              <span className="text-[11px] font-cairo text-slate-500 dark:text-slate-400 flex items-center gap-1 bg-white/80 dark:bg-navy-900/70 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-navy-700/60 shadow-2xs">
                <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span>لا يمكن تغييره إلا عبر الإدارة</span>
              </span>
            </div>
          </Field>
          <Field label="الاسم المستعار" hint="يظهر في ملفك العام">
            <TextInput value={form.nickname} onChange={(v) => set('nickname', v)} placeholder="مثال: أبو عبدالله، باحثة عن الستر" />
          </Field>
          <Field label="تاريخ الميلاد" hint="اختر السنة ثم الشهر ثم اليوم">
            <DateSelect value={form.birthDate} onChange={handleBirthDateChange} />
          </Field>
          <Field label="العمر (محسوب تلقائيًا)">
            <div className="px-4 py-3 rounded-xl bg-gold-300/10 border-2 border-gold-300/40 flex items-center gap-2">
              <span className="font-cairo font-extrabold text-2xl text-gradient-gold">
                {form.age > 0 ? form.age : '—'}
              </span>
              {form.age > 0 && <span className="text-navy-500 font-tajawal">سنة</span>}
            </div>
          </Field>
          <Field label="الدولة" required>
            <SearchableSelect
              value={form.country}
              onChange={(v) => { set('country', v); set('city', ''); }}
              options={countryOptions}
              placeholder="ابحث واختر الدولة"
              searchPlaceholder="اكتب اسم الدولة..."
              allowAddNew
              onAddNew={handleAddCountry}
              addNewLabel="إذا لم تجد دولتك؟ اضغط هنا لكتابة اسم الدولة"
              addNewPlaceholder="اكتب اسم الدولة..."
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="المدينة" required>
              <SearchableSelect
                value={form.city}
                onChange={(v) => set('city', v)}
                options={cities}
                placeholder={form.country ? 'ابحث واختر المدينة' : 'اختر الدولة أولًا'}
                searchPlaceholder="اكتب اسم المدينة..."
                disabled={!form.country}
                allowAddNew={!!form.country}
                onAddNew={handleAddCity(form.country)}
                addNewLabel="إذا لم تجد مدينتك؟ اضغط هنا لكتابة اسم المدينة"
                addNewPlaceholder="اكتب اسم مدينتك..."
              />
            </Field>
            <Field label="المنطقة / الحي" hint="الحي أو المنطقة التفصيلية">
              <TextInput value={form.district} onChange={(v) => set('district', v)} placeholder="حي العليا..." />
            </Field>
          </div>
          <Field label="الجنسية" hint="جنسيتك">
            <SearchableSelect
              value={form.nationality}
              onChange={(v) => set('nationality', v)}
              options={nationalityOptions}
              placeholder="ابحث عن الجنسية"
              searchPlaceholder="اكتب اسم الجنسية..."
              allowAddNew
              onAddNew={handleAddNationality}
              addNewLabel="إذا لم تجد جنسيتك؟ اضغط هنا لكتابة دولة الجنسية"
              addNewPlaceholder="أدخل اسم الدولة التي منها جنسيتك..."
            />
          </Field>
          <Field label="المذهب" hint="المذهب الديني الذي تتبعه">
            <SelectWithOther
              value={form.sect}
              otherValue={form.sectOther}
              onChange={(v) => set('sect', v)}
              onOtherChange={(v) => set('sectOther', v)}
              options={getUnifiedSects()}
              placeholder="اختر المذهب"
            />
          </Field>
        </>
      ),
    },
    {
      title: 'الحالة الاجتماعية',
      icon: Heart,
      fields: (
        <>
          <Field label="الحالة الاجتماعية" required>
            <RadioGroup
              options={getSelfMaritalOptions(form.gender as any)}
              value={form.maritalStatus}
              onChange={(v) => set('maritalStatus', v)}
              columns={isMale ? 4 : 3}
            />
          </Field>
          <Field label="نوع الزواج المطلوب">
            <RadioGroup
              options={[
                { value: 'announced', label: 'معلن' },
                { value: 'misyar', label: 'مسيار' },
                { value: 'both', label: 'لا مانع / معلن او مسيار' },
              ]}
              value={form.marriageType || 'announced'}
              onChange={(v) => set('marriageType', v)}
              columns={3}
            />
          </Field>
          {['divorced', 'widower', 'widow', 'widowed', 'مطلق', 'مطلقة', 'أرمل', 'أرملة'].includes(form.maritalStatus) && (
            <div className="space-y-4 bg-cream-50 rounded-2xl p-4 border border-cream-200">
              <h4 className="font-cairo font-bold text-navy-900 text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-gold-600" /> معلومات الأبناء
              </h4>
              <Field label={isMale ? 'هل لديك أبناء؟' : 'هل لديكِ أبناء؟'}>
                <RadioGroup options={C.YES_NO} value={form.hasChildren} onChange={(v) => set('hasChildren', v)} />
              </Field>
              {form.hasChildren === 'yes' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="عدد الأبناء">
                    <SelectInput value={form.childrenCount} onChange={(v) => set('childrenCount', v)} options={getChildrenCountList()} placeholder="اختر" />
                  </Field>
                  <Field label={isMale ? 'هل الأبناء يعيشون معك؟' : 'هل الأبناء يعيشون معكِ؟'}>
                    <RadioGroup options={C.YES_NO} value={form.childrenLiveWith} onChange={(v) => set('childrenLiveWith', v)} />
                  </Field>
                </div>
              )}
            </div>
          )}
          {isMale && ['married', 'متزوج'].includes(form.maritalStatus) && (
            <div className="space-y-4 bg-cream-50 rounded-2xl p-4 border border-cream-200">
              <h4 className="font-cairo font-bold text-navy-900 text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-gold-600" /> تفاصيل الزواج
              </h4>
              <Field label="عدد الزوجات الحالي">
                <RadioGroup options={C.WIFE_COUNT} value={form.wifeCount} onChange={(v) => set('wifeCount', v)} columns={3} />
              </Field>
              <Field label="هل لديك أبناء؟">
                <RadioGroup options={C.YES_NO} value={form.hasChildren} onChange={(v) => set('hasChildren', v)} />
              </Field>
              {form.hasChildren === 'yes' && (
                <Field label="كم عدد الأبناء؟">
                  <SelectInput value={form.childrenCount} onChange={(v) => set('childrenCount', v)} options={getChildrenCountList()} placeholder="اختر" />
                </Field>
              )}
              <Field label="هل تبحث عن زوجة أخرى؟">
                <RadioGroup options={C.YES_NO} value={form.seekingWife} onChange={(v) => set('seekingWife', v)} />
              </Field>
            </div>
          )}
        </>
      ),
    },
    {
      title: 'المواصفات الشخصية',
      icon: Ruler,
      fields: (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="الطول (كتابة)" hint="طولك بالسنتيمتر (80 - 300 سم)">
              <div className="relative">
                <TextInput
                  type="number"
                  min={80}
                  max={300}
                  value={form.height ? String(form.height) : ''}
                  onChange={(v) => set('height', v ? Number(v) : '')}
                  placeholder="80 - 300 سم"
                  className="pl-12"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-navy-400 font-tajawal pointer-events-none">سم</span>
              </div>
            </Field>
            <Field label="الوزن (كتابة)" hint="وزنك بالكيلوغرام (20 - 300 كجم)">
              <div className="relative">
                <TextInput
                  type="number"
                  min={20}
                  max={300}
                  value={form.weight ? String(form.weight) : ''}
                  onChange={(v) => set('weight', v ? Number(v) : '')}
                  placeholder="20 - 300 كجم"
                  className="pl-12"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-navy-400 font-tajawal pointer-events-none">كجم</span>
              </div>
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="لون البشرة" hint="لون بشرتك الطبيعي">
              <SearchableSelect
                value={form.skinColor}
                onChange={(v) => set('skinColor', v)}
                options={getUnifiedSkinColorOptions()}
                placeholder="اختر لون البشرة"
                searchPlaceholder="ابحث عن لون البشرة..."
              />
            </Field>
            <Field label="العرق" hint="مثال: عربي، خليجي، قبلي">
              <TextInput value={form.ethnicity} onChange={(v) => set('ethnicity', v)} placeholder="اكتب العرق..." />
            </Field>
          </div>
          <Field label="القبيلة / النسب" hint="اسم القبيلة أو انتسابك (مثل: قبيلي، عتيبي، مطيري...)">
            <TextInput value={form.tribe || ''} onChange={(v) => set('tribe', v)} placeholder="اسم القبيلة أو النسب..." />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="الحالة الصحية" hint="مثال: ممتازة، جيدة، وضع صحي خاص">
              <TextInput value={form.health} onChange={(v) => set('health', v)} placeholder="اكتب حالتك الصحية..." />
            </Field>
            <Field label={isFemale ? 'هل تدخنين؟' : 'هل تدخن؟'} hint="عادتك في التدخين">
              <SelectInput value={form.smoking} onChange={(v) => set('smoking', v)} options={getUnifiedSmokingOptions()} placeholder="اختر" />
            </Field>
          </div>
        </>
      ),
    },
    {
      title: 'التعليم والعمل',
      icon: GraduationCap,
      fields: (
        <>
          <Field label="المؤهل الدراسي" hint="أعلى مؤهل علمي حصلت عليه">
            <SelectInput value={form.education} onChange={(v) => set('education', v)} options={getUnifiedEducationLevels()} placeholder="اختر المؤهل" />
          </Field>
          <Field label="نوع جهة العمل" hint="طبيعة عملك الحالي">
            <RadioGroup
              options={getUnifiedWorkTypes().map(w => ({ value: w, label: w }))}
              value={form.workType}
              onChange={(v) => { set('workType', v); set('jobTitle', ''); }}
              columns={3}
            />
          </Field>
          {form.workType && form.workType !== 'بدون عمل' && (
            <Field label="المسمى الوظيفي" hint={`مثال: ${form.workType === 'طالب' ? 'طالب جامعي' : 'معلم، طبيب، مهندس'}`}>
              <TextInput value={form.jobTitle} onChange={(v) => set('jobTitle', v)} placeholder={form.workType === 'طالب' ? 'طالب جامعي...' : 'معلم، طبيب...'} />
            </Field>
          )}
          <Field label="نوع السكن" hint="وضعك السكني الحالي">
            <SelectInput value={form.housing} onChange={(v) => set('housing', v)} options={getUnifiedHousingTypes()} placeholder="اختر" />
          </Field>
        </>
      ),
    },
    {
      title: 'نبذة عني',
      icon: FileText,
      fields: (
        <Field label="اكتب نبذة قصيرة عنك" hint={`${form.bio.length}/500 حرف`}>
          <TextArea value={form.bio} onChange={(v) => set('bio', v)} placeholder="اكتب نبذة عن شخصيتك وأهدافك..." rows={4} />
        </Field>
      ),
    },
    {
      title: `مواصفات ${partnerTerms.partnerLabel} المطلوبة`,
      icon: Heart,
      fields: (
        <div className="space-y-5">
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
                    يرجى تحديد دولة إقامتك أولاً في البيانات الأساسية (أو تحديد دولة الشريك أعلاه) لعرض المدن المتاحة.
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
                    onAddNew={(newCity) => handleAddCity(form.pCountry || form.country || 'السعودية')(newCity)}
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
                    onAddNew={handleAddNationality}
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
                  placeholder="مثال: 20"
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
                  placeholder="مثال: 45"
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
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
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
            </div>
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
        </div>
      ),
    },
  ];

  return (
    <div className="bg-cream-50 min-h-screen pb-28 lg:pb-8">
      {/* Header */}
      <div className="bg-navy-gradient relative overflow-hidden">
        <div className="absolute inset-0 pattern-arabesque opacity-30" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/profile" className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors no-tap-highlight">
                <ArrowRight className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-cairo font-extrabold text-2xl text-white">تعديل الملف الشخصي</h1>
                <p className="text-cream-200/70 font-tajawal text-sm">حدّث جميع معلوماتك الشخصية</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-cream-200/80 text-xs font-tajawal">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> بياناتك محمية
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* ملاحظة الخصوصية */}
        <div className="bg-gold-300/10 border border-gold-500/20 rounded-2xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-gold-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-cairo font-semibold text-navy-900 text-sm">خصوصية معلوماتك</p>
            <p className="text-xs text-navy-600 font-tajawal mt-0.5">لا يتم عرض معلوماتك الحساسة (مثل الحي، رقم الهاتف) للأعضاء الآخرين. تظهر فقط معلوماتك الأساسية.</p>
          </div>
        </div>

        {/* الأقسام */}
        {sections.map((section) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-soft border border-cream-200/60 p-5 sm:p-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gold-300/15 flex items-center justify-center">
                <section.icon className="w-5 h-5 text-gold-600" />
              </div>
              <h2 className="font-cairo font-bold text-lg text-navy-900">{section.title}</h2>
            </div>
            <div className="space-y-4">{section.fields}</div>
          </motion.div>
        ))}

        {/* أزرار الحفظ */}
        <div className="flex gap-3 sticky bottom-20 lg:bottom-4 z-20">
          <Button onClick={handleSave} size="lg" fullWidth className="shadow-gold">
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />
                جارِ الحفظ...
              </span>
            ) : saved ? (
              <span className="flex items-center gap-2"><Check className="w-5 h-5" /> تم الحفظ</span>
            ) : (
              <span className="flex items-center gap-2"><Save className="w-5 h-5" /> حفظ التغييرات</span>
            )}
          </Button>
          <Link to="/profile" className="flex items-center justify-center px-6 py-4 rounded-2xl bg-white border-2 border-cream-200 text-navy-600 font-cairo font-bold hover:bg-cream-100 transition-colors no-tap-highlight">
            إلغاء
          </Link>
        </div>
      </div>
    </div>
  );
}
