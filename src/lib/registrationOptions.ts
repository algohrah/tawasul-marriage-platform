import * as C from './constants';
import { dataService } from './data/DataService';

export type RegistrationGender = 'male' | 'female' | '';

export const COUNTRY_NATIONALITY_MAP: Record<string, { male: string; female: string; neutral?: string }> = {
  'السعودية': { male: 'سعودي', female: 'سعودية' },
  'الإمارات': { male: 'إماراتي', female: 'إماراتية' },
  'الكويت': { male: 'كويتي', female: 'كويتية' },
  'قطر': { male: 'قطري', female: 'قطرية' },
  'البحرين': { male: 'بحريني', female: 'بحرينية' },
  'عمان': { male: 'عماني', female: 'عمانية' },
  'مصر': { male: 'مصري', female: 'مصرية' },
  'سوريا': { male: 'سوري', female: 'سورية' },
  'الأردن': { male: 'أردني', female: 'أردنية' },
  'اليمن': { male: 'يمني', female: 'يمنية' },
  'العراق': { male: 'عراقي', female: 'عراقية' },
  'لبنان': { male: 'لبناني', female: 'لبنانية' },
  'فلسطين': { male: 'فلسطيني', female: 'فلسطينية' },
  'السودان': { male: 'سوداني', female: 'سودانية' },
  'ليبيا': { male: 'ليبي', female: 'ليبية' },
  'تونس': { male: 'تونسي', female: 'تونسية' },
  'الجزائر': { male: 'جزائري', female: 'جزائرية' },
  'المغرب': { male: 'مغربي', female: 'مغربية' },
  'موريتانيا': { male: 'موريتاني', female: 'موريتانية' },
  'الصومال': { male: 'صومالي', female: 'صومالية' },
  'جيبوتي': { male: 'جيبوتي', female: 'جيبوتية' },
  'جزر القمر': { male: 'قمري', female: 'قمرية' },
  'تركيا': { male: 'تركي', female: 'تركية' },
  'المملكة المتحدة': { male: 'بريطاني', female: 'بريطانية' },
  'أمريكا (الولايات المتحدة)': { male: 'أمريكي', female: 'أمريكية' },
  'كندا': { male: 'كندي', female: 'كندية' },
  'ألمانيا': { male: 'ألماني', female: 'ألمانية' },
  'السويد': { male: 'سويدي', female: 'سويدية' },
  'فرنسا': { male: 'فرنسي', female: 'فرنسية' },
};

export const SELF_MARITAL_MALE = [
  { value: 'single', label: 'أعزب' },
  { value: 'married', label: 'متزوج' },
  { value: 'divorced', label: 'مطلق' },
  { value: 'widower', label: 'أرمل' },
];

export const SELF_MARITAL_FEMALE = [
  { value: 'single', label: 'عزباء' },
  { value: 'married', label: 'متزوجة' },
  { value: 'divorced', label: 'مطلقة' },
  { value: 'widow', label: 'أرملة' },
];

export const PARTNER_MARITAL_FOR_MALE = [
  'عزباء',
  'مطلقة',
  'أرملة',
];

export const PARTNER_MARITAL_FOR_FEMALE = [
  'أعزب',
  'متزوج',
  'مطلق',
  'أرمل',
];

export function getSelfMaritalOptions(gender: RegistrationGender) {
  let opts: any[] = [];
  try {
    opts = dataService.db.getRegistrationOptions?.(gender === 'female' ? 'maritalFemale' : 'maritalMale') || [];
  } catch {}
  if (!Array.isArray(opts) || opts.length === 0) {
    return gender === 'female' ? SELF_MARITAL_FEMALE : SELF_MARITAL_MALE;
  }
  return opts.map((item) => {
    if (typeof item === 'string') {
      let val = item;
      if (item === 'أعزب' || item === 'عزباء') val = 'single';
      else if (item === 'مطلق' || item === 'مطلقة') val = 'divorced';
      else if (item === 'أرمل' || item === 'أرملة') val = gender === 'female' ? 'widow' : 'widower';
      else if (item === 'متزوج' || item === 'متزوجة') val = 'married';
      return { value: val, label: item };
    }
    return item;
  });
}

export function getPartnerMaritalOptions(userGender: RegistrationGender) {
  return userGender === 'male' ? PARTNER_MARITAL_FOR_MALE : PARTNER_MARITAL_FOR_FEMALE;
}

export function getPartnerTerms(userGender: RegistrationGender) {
  const seekingFemale = userGender === 'male';
  return {
    partnerLabel: seekingFemale ? 'الشريكة' : 'الشريك',
    partnerFullLabel: seekingFemale ? 'شريكة الحياة' : 'شريك الحياة',
    nationalityLabel: seekingFemale ? 'جنسية الشريكة المطلوبة' : 'جنسية الشريك المطلوبة',
    countryLabel: seekingFemale ? 'دولة إقامة الشريكة' : 'دولة إقامة الشريك',
    cityLabel: seekingFemale ? 'مدينة الشريكة' : 'مدينة الشريك',
    maritalLabel: seekingFemale ? 'الحالة الاجتماعية للشريكة' : 'الحالة الاجتماعية للشريك',
    ageLabel: seekingFemale ? 'عمر الشريكة المناسب' : 'عمر الشريك المناسب',
    childrenLabel: seekingFemale ? 'هل تقبل أن تكون لديها أبناء؟' : 'هل تقبلين أن يكون لديه أبناء؟',
    notesPlaceholder: seekingFemale
      ? 'اكتب صفات الشريكة المناسبة لك مثل الخلق، التعليم، المدينة، قبول السكن...'
      : 'اكتبي صفات الشريك المناسب لك مثل الخلق، الاستقرار، التعليم، المدينة...',
  };
}

export function getNationalityForCountry(country: string, _gender?: RegistrationGender) {
  return country || 'السعودية';
}

export function getNationalityOptions(_gender?: RegistrationGender, countries: string[] = C.COUNTRIES) {
  const cleanCountries = countries.filter((c) => c && c !== 'أخرى');
  return Array.from(new Set([...cleanCountries, 'أخرى']));
}

export function shouldAskChildren(maritalStatus: string) {
  return ['divorced', 'widower', 'widow', 'widowed', 'married', 'مطلق', 'مطلقة', 'أرمل', 'أرملة', 'متزوج', 'متزوجة'].includes(maritalStatus);
}

export function isMarriedMale(gender: RegistrationGender, maritalStatus: string) {
  return gender === 'male' && ['married', 'متزوج'].includes(maritalStatus);
}

export const MARRIAGE_TYPE_OPTIONS = [
  { value: 'announced', label: 'معلن' },
  { value: 'misyar', label: 'مسيار' },
  { value: 'both', label: 'لا مانع / معلن او مسيار' },
] as const;

export function formatMarriageType(type?: string): string {
  if (!type) return '';
  const t = String(type).toLowerCase().trim();
  if (t === 'misyar' || t === 'مسيار') return 'مسيار';
  if (
    t === 'both' ||
    t === 'لا مانع / معلن او مسيار' ||
    t === 'لا مانع / معلن أو مسيار' ||
    t === 'معلن أو مسيار' ||
    t === 'معلن او مسيار' ||
    t === 'لا مانع (معلن أو مسيار)' ||
    t === 'لا مانع (معلن او مسيار)' ||
    t === 'لا مانع' ||
    t === 'كلاهما' ||
    t === 'الاثنين معا (مسيار أو معلن)' ||
    t === 'الاثنين معاً (مسيار أو معلن)'
  ) {
    return 'لا مانع / معلن او مسيار';
  }
  if (t === 'announced' || t === 'معلن' || t === 'عادي' || t === 'معلن (عادي)') return 'معلن';
  return type;
}

export function normalizeMaritalLabel(status: string, gender: RegistrationGender) {
  const options = getSelfMaritalOptions(gender);
  return options.find((option) => option.value === status || option.label === status)?.label || status;
}

// ============================================================
//  دوال موحّدة لجلب القوائم والخيارات (Unified Options Loaders)
// ============================================================

export function getUnifiedCountries(): string[] {
  try {
    const list = dataService.db.getCountries?.();
    if (Array.isArray(list) && list.length > 0) {
      return list.map((c: any) => (typeof c === 'string' ? c : c.name)).filter(Boolean);
    }
  } catch {}
  return C.COUNTRIES;
}

const citiesCache = new Map<string, string[]>();

export function clearCitiesCache() {
  citiesCache.clear();
}

export function getUnifiedCitiesForCountry(country: string): string[] {
  if (!country) return [];
  const clean = country.trim();
  if (clean === 'نفس دولتي' || clean === 'لا مانع' || clean === 'لا يهم' || clean === 'أي دولة' || clean === 'أي دولة / لا مانع') {
    return [];
  }
  if (citiesCache.has(clean)) {
    return citiesCache.get(clean)!;
  }
  let official: string[] = [];
  try {
    official = dataService.db.getCities?.(clean) || [];
  } catch {}
  if (!official || official.length === 0) {
    official = C.CITIES_BY_COUNTRY[clean] || [];
  }
  if (!official || official.length === 0) {
    const norm = normalizeNationality(clean);
    official = C.CITIES_BY_COUNTRY[norm] || [];
  }
  let pending: string[] = [];
  try {
    pending = (dataService.db.getAllPendingCities?.() || [])
      .filter((p: any) => (p.country === clean || p.country === normalizeNationality(clean)) && p.status === 'pending')
      .map((p: any) => p.name);
  } catch {}
  const res = Array.from(new Set([...official, ...pending])).filter((c) => c && c !== 'أخرى' && !c.includes('أخرى'));
  citiesCache.set(clean, res);
  return res;
}

export function getUnifiedCitiesForPartnerCountries(pCountry: string, userCountry = 'السعودية'): string[] {
  const fallbackCountry = (userCountry || '').trim() || 'السعودية';
  if (!pCountry || pCountry === 'لا تفضيل' || pCountry === 'لا يهم' || pCountry === 'لا مانع' || pCountry === 'أي دولة / لا مانع' || pCountry === 'نفس دولتي') {
    return getUnifiedCitiesForCountry(fallbackCountry);
  }

  const selectedCountriesList = pCountry.split('،').map((s) => s.trim()).filter(Boolean);
  const accumulatedCities: string[] = [];

  for (let cnt of selectedCountriesList) {
    if (cnt === 'نفس دولتي') cnt = fallbackCountry;
    if (cnt === 'لا مانع' || cnt === 'لا يهم' || cnt === 'أي دولة / لا مانع') continue;
    const list = getUnifiedCitiesForCountry(cnt);
    accumulatedCities.push(...list);
  }

  if (accumulatedCities.length === 0 && fallbackCountry) {
    accumulatedCities.push(...getUnifiedCitiesForCountry(fallbackCountry));
  }

  return Array.from(new Set(accumulatedCities)).filter((c) => c && c !== 'أخرى' && !c.includes('أخرى'));
}

export function getUnifiedNationalities(gender?: RegistrationGender): string[] {
  const countries = getUnifiedCountries();
  let dbNats: string[] = [];
  try {
    dbNats = dataService.db.getNationalities?.() || [];
  } catch {}
  return Array.from(new Set([...dbNats, ...getNationalityOptions(gender, countries)]));
}

export function getUnifiedRegistrationOptions(key: string, fallback: any[]): any[] {
  try {
    const opts = dataService.db.getRegistrationOptions?.(key);
    if (Array.isArray(opts) && opts.length > 0) {
      const list = opts.map((o) => (typeof o === 'string' ? o : o?.name || o?.label || o?.value || String(o))).filter(Boolean);
      return Array.from(new Set(list));
    }
  } catch {}
  const list = fallback.map((o) => (typeof o === 'string' ? o : o?.name || o?.label || o?.value || String(o))).filter(Boolean);
  return Array.from(new Set(list));
}

export function getUnifiedSects(): string[] {
  return getUnifiedRegistrationOptions('sects', C.SECTS);
}

export function getUnifiedSkinColorOptions(): { value: string; label: string; description: string }[] {
  const dynamicColors = getUnifiedRegistrationOptions('skinColors', C.SKIN_COLORS);
  return dynamicColors.map((colorStr) => {
    const matched = C.SKIN_COLOR_OPTIONS.find((o) => o.value === colorStr || o.label === colorStr);
    if (matched) return matched;
    return { value: colorStr, label: colorStr, description: '' };
  });
}

export function getUnifiedSkinColors(): string[] {
  return getUnifiedRegistrationOptions('skinColors', C.SKIN_COLORS);
}

export function getUnifiedEducationLevels(): string[] {
  return getUnifiedRegistrationOptions('educationLevels', C.EDUCATION_LEVELS);
}

export function getUnifiedWorkTypes(): string[] {
  return getUnifiedRegistrationOptions('workTypes', C.WORK_TYPES);
}

export function getUnifiedHousingTypes(): string[] {
  return getUnifiedRegistrationOptions('housingTypes', C.HOUSING_TYPES);
}

export function getUnifiedSmokingOptions(): string[] {
  return getUnifiedRegistrationOptions('smokingOptions', C.SMOKING_OPTIONS);
}

export function getChildrenCountList(): { value: string; label: string }[] {
  return Array.from({ length: 20 }, (_, i) => {
    const num = i + 1;
    let label = `${num}`;
    if (num === 1) label = '1 (طفل واحد)';
    else if (num === 2) label = '2 (طفلان)';
    else if (num <= 10) label = `${num} أطفال`;
    else label = `${num} طفلًا`;
    return { value: String(num), label };
  });
}
