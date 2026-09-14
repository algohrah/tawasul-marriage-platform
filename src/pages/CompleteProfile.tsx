import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Save, Check, User, MapPin, Heart, FileText, ShieldCheck,
  Ruler, Weight, GraduationCap, Briefcase, Sparkles, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useApp, type ProfileData } from '../lib/AppContext';
import { Button } from '../components/ui/Button';
import {
  Field, TextInput, SelectInput, TextArea, RadioGroup, RangeSlider,
} from '../components/ui/FormFields';
import * as C from '../lib/constants';
import { dataService } from '../lib/data/DataService';
import { getNationalityOptions, getPartnerMaritalOptions, getPartnerTerms } from '../lib/registrationOptions';

// تعريف الحقول التي يتم التحقق منها (مع التسمية والقسم)
interface FieldDef {
  key: keyof ProfileData;
  label: string;
  section: string;
  sectionIcon: typeof User;
  isFilled: (data: ProfileData) => boolean;
}

const ALL_FIELDS: FieldDef[] = [
  // أساسي
  { key: 'marriageType', label: 'نوع الزواج المطلوب', section: 'المعلومات الأساسية', sectionIcon: Heart, isFilled: d => !!(d as any).marriageType },
  { key: 'tribe', label: 'القبيلة / النسب', section: 'المعلومات الأساسية', sectionIcon: User, isFilled: () => true },
  { key: 'city', label: 'المدينة', section: 'المعلومات الأساسية', sectionIcon: User, isFilled: d => !!(d as any).city?.trim() },
  { key: 'district', label: 'المنطقة / الحي', section: 'المعلومات الأساسية', sectionIcon: User, isFilled: () => true },
  { key: 'sect', label: 'المذهب', section: 'المعلومات الأساسية', sectionIcon: User, isFilled: d => !!d.sect },
  { key: 'nationality', label: 'الجنسية', section: 'المعلومات الأساسية', sectionIcon: User, isFilled: d => !!d.nationality },
  // شخصية
  { key: 'height', label: 'الطول', section: 'المواصفات الشخصية', sectionIcon: Ruler, isFilled: d => d.height > 0 },
  { key: 'weight', label: 'الوزن', section: 'المواصفات الشخصية', sectionIcon: Ruler, isFilled: d => d.weight > 0 },
  { key: 'skinColor', label: 'لون البشرة', section: 'المواصفات الشخصية', sectionIcon: Ruler, isFilled: d => !!d.skinColor },
  { key: 'ethnicity', label: 'العرق', section: 'المواصفات الشخصية', sectionIcon: Ruler, isFilled: d => !!d.ethnicity?.trim() },
  { key: 'health', label: 'الحالة الصحية', section: 'المواصفات الشخصية', sectionIcon: Ruler, isFilled: d => !!d.health?.trim() },
  { key: 'smoking', label: 'التدخين', section: 'المواصفات الشخصية', sectionIcon: Ruler, isFilled: d => !!d.smoking },
  { key: 'education', label: 'المؤهل الدراسي', section: 'التعليم والعمل', sectionIcon: GraduationCap, isFilled: d => !!d.education },
  { key: 'workType', label: 'نوع جهة العمل', section: 'التعليم والعمل', sectionIcon: GraduationCap, isFilled: d => !!d.workType },
  { key: 'jobTitle', label: 'المسمى الوظيفي', section: 'التعليم والعمل', sectionIcon: GraduationCap, isFilled: d => !!d.jobTitle?.trim() || d.workType === 'بدون عمل' || d.workType === 'باحث عن عمل' },
  { key: 'housing', label: 'نوع السكن', section: 'التعليم والعمل', sectionIcon: GraduationCap, isFilled: d => !!d.housing },
  { key: 'bio', label: 'نبذة عني', section: 'نبذة عني', sectionIcon: FileText, isFilled: d => (d.bio?.trim().length || 0) >= 10 },
  // مواصفات الشريك
  { key: 'pCountry', label: 'دولة الشريك المطلوب', section: 'مواصفات الشريك', sectionIcon: Heart, isFilled: d => !!d.pCountry },
  { key: 'pNationality', label: 'جنسية الشريك', section: 'مواصفات الشريك', sectionIcon: Heart, isFilled: d => !!d.pNationality },
  { key: 'pMaritalStatus', label: 'الحالة الاجتماعية المقبولة', section: 'مواصفات الشريك', sectionIcon: Heart, isFilled: d => !!d.pMaritalStatus },
  { key: 'pAcceptChildren', label: 'قبول الأطفال', section: 'مواصفات الشريك', sectionIcon: Heart, isFilled: d => !!d.pAcceptChildren },
  { key: 'pNotes', label: 'ملاحظات إضافية عن الشريك', section: 'مواصفات الشريك', sectionIcon: Heart, isFilled: () => true },
];

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { profileData, updateProfileData, showToast } = useApp();
  const [saving, setSaving] = useState(false);

  // نضمن تحميل قوائم المدن/الجنسيات الرسمية من قاعدة البيانات
  useEffect(() => { dataService.db.ensureGeoLoaded?.().catch(() => undefined); }, []);

  // الحقول غير المعبأة فقط
  const unfilledFields = useMemo(() => {
    return ALL_FIELDS.filter(f => !f.isFilled(profileData));
  }, [profileData]);

  // تجميع الحقول حسب القسم
  const sections = useMemo(() => {
    const map = new Map<string, FieldDef[]>();
    unfilledFields.forEach(f => {
      if (!map.has(f.section)) map.set(f.section, []);
      map.get(f.section)!.push(f);
    });
    return Array.from(map.entries()).map(([title, fields]) => ({
      title,
      icon: fields[0].sectionIcon,
      fields,
    }));
  }, [unfilledFields]);

  const totalFields = ALL_FIELDS.length;
  const filledCount = totalFields - unfilledFields.length;
  const completionPct = Math.round((filledCount / totalFields) * 100);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      showToast('تم حفظ البيانات بنجاح ✓', 'success');
      setTimeout(() => navigate('/profile'), 1000);
    }, 1200);
  };

  const set = (key: keyof ProfileData, value: any) => {
    updateProfileData({ [key]: value } as Partial<ProfileData>);
  };

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
                <h1 className="font-cairo font-extrabold text-2xl text-white">أكمل ملفك الشخصي</h1>
                <p className="text-cream-200/70 font-tajawal text-sm">املأ الحقول الناقصة لزيادة فرص التوافق</p>
              </div>
            </div>
          </div>

          {/* شريط التقدم */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cream-200/80 font-tajawal text-sm">نسبة إكمال الملف</span>
              <span className="text-gold-300 font-cairo font-bold text-lg">{completionPct}%</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gold-gradient rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${completionPct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-cream-200/60 font-tajawal text-xs mt-2">
              {unfilledFields.length > 0
                ? `لديك ${unfilledFields.length} حقل غير مُعبأ`
                : 'أحسنت! ملفك مكتمل'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {unfilledFields.length === 0 ? (
          /* ملف مكتمل */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-luxe border border-cream-200/60 p-8 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="font-cairo font-extrabold text-2xl text-navy-900 mb-2">ملفك مكتمل! 🎉</h2>
            <p className="text-navy-500 font-tajawal mb-6">لقد عبأت جميع الحقول المطلوبة. ملفك الآن جاهز لزيادة فرص التوافق.</p>
            <Link to="/profile" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-navy-900 text-white font-cairo font-bold hover:bg-navy-800 transition-colors no-tap-highlight">
              <ArrowRight className="w-5 h-5" /> العودة للملف
            </Link>
          </motion.div>
        ) : (
          <>
            {/* تنبيه */}
            <div className="bg-gold-300/10 border border-gold-500/20 rounded-2xl p-4 flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-gold-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-cairo font-semibold text-navy-900 text-sm">حقول ناقصة</p>
                <p className="text-xs text-navy-600 font-tajawal mt-0.5">
                  هذه الحقول فقط هي التي لم تُعبأها بعد. أكملها لتحسين ملفك الشخصي وزيادة فرص التوافق.
                </p>
              </div>
            </div>

            {/* الأقسام */}
            <AnimatePresence>
              {sections.map((section) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl shadow-soft border border-cream-200/60 p-5 sm:p-6 mb-4"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-gold-300/15 flex items-center justify-center">
                      <section.icon className="w-5 h-5 text-gold-600" />
                    </div>
                    <div>
                      <h2 className="font-cairo font-bold text-lg text-navy-900">{section.title}</h2>
                      <p className="text-xs text-navy-400 font-tajawal">{section.fields.length} حقل غير مُعبأ</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {section.fields.map((field) => (
                      <FieldRenderer
                        key={field.key}
                        fieldKey={field.key}
                        label={field.label}
                        data={profileData}
                        set={set}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* أزرار الحفظ */}
            <div className="flex gap-3 sticky bottom-20 lg:bottom-4 z-20">
              <Button onClick={handleSave} size="lg" fullWidth className="shadow-gold">
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />
                    جارِ الحفظ...
                  </span>
                ) : (
                  <span className="flex items-center gap-2"><Save className="w-5 h-5" /> حفظ التغييرات</span>
                )}
              </Button>
              <Link to="/profile" className="flex items-center justify-center px-6 py-4 rounded-2xl bg-white border-2 border-cream-200 text-navy-600 font-cairo font-bold hover:bg-cream-100 transition-colors no-tap-highlight">
                إلغاء
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ===== مكوّن عرض الحقل حسب نوعه ===== */
function FieldRenderer({
  fieldKey,
  label,
  data,
  set,
}: {
  fieldKey: keyof ProfileData;
  label: string;
  data: ProfileData;
  set: (key: keyof ProfileData, value: any) => void;
  key?: any;
}) {
  const value = data[fieldKey];
  const partnerTerms = getPartnerTerms(data.gender as any);

  // المدينة — من قاعدة البيانات الموحّدة حسب دولة العضو (نفس مصدر التسجيل والبحث)
  if (fieldKey === 'city') {
    let cityList: string[] = [];
    try { cityList = dataService.db.getCities?.((data as any).country || '') || []; } catch { /* ignore */ }
    if (!cityList.length) cityList = C.CITIES_BY_COUNTRY[(data as any).country || ''] || [];
    return (
      <Field label={label} required>
        <SelectInput
          value={value as string}
          onChange={(v) => set('city' as any, v)}
          options={cityList}
          placeholder={cityList.length ? 'اختر المدينة' : 'اختر الدولة أولاً'}
        />
      </Field>
    );
  }

  // العمر الأدنى/الأقصى للشريك
  if (fieldKey === 'pAgeMin' || fieldKey === 'pAgeMax') {
    const isMin = fieldKey === 'pAgeMin';
    return (
      <Field label={isMin ? 'العمر الأدنى للشريك' : 'العمر الأقصى للشريك'} required>
        <RangeSlider value={value as number} onChange={(v) => set(fieldKey, v)} min={16} max={80} unit=" سنة" />
      </Field>
    );
  }

  // قوائم منسدلة نصية
  const selectMap: Record<string, string[]> = {
    sect: C.SECTS,
    nationality: getNationalityOptions(data.gender as any),
    skinColor: C.SKIN_COLORS,
    smoking: C.SMOKING_OPTIONS,
    education: C.EDUCATION_LEVELS,
    housing: C.HOUSING_TYPES,
    pCountry: ['لا يهم', ...C.COUNTRIES],
    pNationality: ['لا يهم', ...getNationalityOptions(data.gender === 'male' ? 'female' : 'male')],
    pMaritalStatus: getPartnerMaritalOptions(data.gender as any),
  };

  if (selectMap[fieldKey as string]) {
    return (
      <Field label={label} required>
        <SelectInput
          value={value as string}
          onChange={(v) => set(fieldKey, v)}
          options={selectMap[fieldKey as string]}
          placeholder="اختر..."
        />
      </Field>
    );
  }

  // الطول والوزن
  if (fieldKey === 'height') {
    return (
      <Field label={label} required>
        <SelectInput
          value={value ? String(value) : ''}
          onChange={(v) => set('height', Number(v))}
          options={Array.from({ length: 91 }, (_, i) => {
            const h = 130 + i;
            return { value: String(h), label: `${h} سم` };
          })}
          placeholder="اختر الطول"
        />
      </Field>
    );
  }
  if (fieldKey === 'weight') {
    return (
      <Field label={label} required>
        <SelectInput
          value={value ? String(value) : ''}
          onChange={(v) => set('weight', Number(v))}
          options={Array.from({ length: 161 }, (_, i) => {
            const w = 35 + i;
            return { value: String(w), label: `${w} كجم` };
          })}
          placeholder="اختر الوزن"
        />
      </Field>
    );
  }

  // خيارات الراديو
  const radioMap: Record<string, { value: string; label: string }[]> = {
    marriageType: [
      { value: 'announced', label: 'معلن' },
      { value: 'misyar', label: 'مسيار' },
      { value: 'both', label: 'لا مانع / معلن او مسيار' },
    ],
    pAcceptChildren: [
      { value: 'نعم', label: 'نعم (أقبل)' },
      { value: 'لا', label: 'لا (أفضل بدون أطفال)' },
      { value: 'لا يهم', label: 'لا يهم' },
      { value: 'بشرط ألا يعيشوا معنا', label: 'بشرط ألا يعيشوا معنا' },
    ],
  };

  if (radioMap[fieldKey as string]) {
    return (
      <Field label={label} required>
        <RadioGroup
          options={radioMap[fieldKey as string]}
          value={value as string}
          onChange={(v) => set(fieldKey, v)}
          columns={2}
        />
      </Field>
    );
  }

  // نوع العمل
  if (fieldKey === 'workType') {
    return (
      <Field label={label} required>
        <RadioGroup
          options={C.WORK_TYPES.map(w => ({ value: w, label: w }))}
          value={value as string}
          onChange={(v) => set('workType', v)}
          columns={3}
        />
      </Field>
    );
  }

  // حقول نصية (افتراضي)
  return (
    <Field label={label} required>
      {fieldKey === 'bio' || fieldKey === 'pNotes' ? (
        <TextArea
          value={value as string}
          onChange={(v) => set(fieldKey, v)}
          placeholder={fieldKey === 'bio' ? 'اكتب نبذة قصيرة عن شخصيتك...' : partnerTerms.notesPlaceholder}
          rows={4}
        />
      ) : (
        <TextInput
          value={value as string}
          onChange={(v) => set(fieldKey, v)}
          placeholder="اكتب هنا..."
        />
      )}
    </Field>
  );
}
