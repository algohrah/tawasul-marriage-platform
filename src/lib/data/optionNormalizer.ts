// ====================================================================
//  توحيد وقواعد مطابقة البيانات — Client-Side Normalizer
//  توحيد الجنسيات إلى أسماء الدول وتقييد نوع الزواج واستخراج خيارات "أخرى"
// ====================================================================

import { COUNTRIES, SKIN_COLORS, EDUCATION_LEVELS, WORK_TYPES } from '../constants';

// خريطة تحويل الجنسيات بالصفات إلى أسماء الدول مباشرة
export const DEMONYM_TO_COUNTRY_MAP: Record<string, string> = {
  'سعودي': 'السعودية', 'سعودية': 'السعودية', 'سعوديه': 'السعودية', 'سعودي/ة': 'السعودية', 'السعودية': 'السعودية',
  'إماراتي': 'الإمارات', 'إماراتية': 'الإمارات', 'اماراتية': 'الإمارات', 'إماراتيه': 'الإمارات', 'الإمارات': 'الإمارات',
  'كويتي': 'الكويت', 'كويتية': 'الكويت', 'كويتيه': 'الكويت', 'كويتي/ة': 'الكويت', 'الكويت': 'الكويت',
  'قطري': 'قطر', 'قطرية': 'قطر', 'قطريه': 'قطر', 'قطري/ة': 'قطر', 'قطر': 'قطر',
  'بحريني': 'البحرين', 'بحرينية': 'البحرين', 'بحرينيه': 'البحرين', 'بحريني/ة': 'البحرين', 'البحرين': 'البحرين',
  'عماني': 'عمان', 'عمانية': 'عمان', 'عمانيه': 'عمان', 'عماني/ة': 'عمان', 'عمان': 'عمان',
  'مصري': 'مصر', 'مصرية': 'مصر', 'مصريه': 'مصر', 'مصري/ة': 'مصر', 'مصر': 'مصر',
  'سوري': 'سوريا', 'سورية': 'سوريا', 'سوريه': 'سوريا', 'سوري/ة': 'سوريا', 'سوريا': 'سوريا',
  'أردني': 'الأردن', 'أردنية': 'الأردن', 'أردنيه': 'الأردن', 'اردني': 'الأردن', 'اردنية': 'الأردن', 'اردنيه': 'الأردن', 'الأردن': 'الأردن',
  'يمني': 'اليمن', 'يمنية': 'اليمن', 'يمنيه': 'اليمن', 'يماني': 'اليمن', 'يمانية': 'اليمن', 'يمانيه': 'اليمن', 'اليمن': 'اليمن',
  'عراقي': 'العراق', 'عراقية': 'العراق', 'عراقيه': 'العراق', 'عراقي/ة': 'العراق', 'العراق': 'العراق',
  'لبناني': 'لبنان', 'لبنانية': 'لبنان', 'لبنانيه': 'لبنان', 'لبناني/ة': 'لبنان', 'لبنان': 'لبنان',
  'فلسطيني': 'فلسطين', 'فلسطينية': 'فلسطين', 'فلسطينيه': 'فلسطين', 'فلسطيني/ة': 'فلسطين', 'فلسطين': 'فلسطين',
  'سوداني': 'السودان', 'سودانية': 'السودان', 'سودانيه': 'السودان', 'سوداني/ة': 'السودان', 'السودان': 'السودان',
  'ليبي': 'ليبيا', 'ليبية': 'ليبيا', 'ليبيه': 'ليبيا', 'ليبي/ة': 'ليبيا', 'ليبيا': 'ليبيا',
  'تونسي': 'تونس', 'تونسية': 'تونس', 'تونسيه': 'تونس', 'تونسي/ة': 'تونس', 'تونس': 'تونس',
  'جزائري': 'الجزائر', 'جزائرية': 'الجزائر', 'جزائريه': 'الجزائر', 'جزائري/ة': 'الجزائر', 'الجزائر': 'الجزائر',
  'مغربي': 'المغرب', 'مغربية': 'المغرب', 'مغربيه': 'المغرب', 'مغربي/ة': 'المغرب', 'المغرب': 'المغرب',
  'موريتاني': 'موريتانيا', 'موريتانية': 'موريتانيا', 'موريتانيه': 'موريتانيا', 'موريتاني/ة': 'موريتانيا', 'موريتانيا': 'موريتانيا',
  'صومالي': 'الصومال', 'صومالية': 'الصومال', 'صوماليه': 'الصومال', 'صومالي/ة': 'الصومال', 'الصومال': 'الصومال',
  'جيبوتي': 'جيبوتي', 'جيبوتية': 'جيبوتي', 'جيبوتيه': 'جيبوتي', 'جيبوتي/ة': 'جيبوتي',
  'قمري': 'جزر القمر', 'قمرية': 'جزر القمر', 'قمريه': 'جزر القمر', 'قمري/ة': 'جزر القمر', 'جزر القمر': 'جزر القمر',
  'باكستاني': 'باكستان', 'باكستانية': 'باكستان', 'باكستانيه': 'باكستان', 'باكستان': 'باكستان',
  'هندي': 'الهند', 'هندية': 'الهند', 'هنديه': 'الهند', 'الهند': 'الهند',
  'تركي': 'تركيا', 'تركية': 'تركيا', 'تركيه': 'تركيا', 'تركي/ة': 'تركيا', 'تركيا': 'تركيا',
  'بريطاني': 'المملكة المتحدة', 'بريطانية': 'المملكة المتحدة', 'بريطانيه': 'المملكة المتحدة',
  'أمريكي': 'أمريكا (الولايات المتحدة)', 'أمريكية': 'أمريكا (الولايات المتحدة)', 'امريكية': 'أمريكا (الولايات المتحدة)',
  'كندي': 'كندا', 'كندية': 'كندا', 'كنديه': 'كندا',
  'ألماني': 'ألمانيا', 'ألمانية': 'ألمانيا', 'المانيه': 'ألمانيا',
  'سويدي': 'السويد', 'سويدية': 'السويد', 'سويديه': 'السويد',
  'فرنسي': 'فرنسا', 'فرنسية': 'فرنسا', 'فرنسيه': 'فرنسا',
};

/**
 * توحيد حقل الجنسية ليصبح اسم الدولة دائماً (مثلاً: "السعودية"، "المغرب"، "سوريا")
 */
export function normalizeNationality(val?: string): string {
  if (!val) return 'السعودية';
  const clean = val.trim();
  if (DEMONYM_TO_COUNTRY_MAP[clean]) {
    return DEMONYM_TO_COUNTRY_MAP[clean];
  }
  for (const [key, country] of Object.entries(DEMONYM_TO_COUNTRY_MAP)) {
    if (clean === key || clean.startsWith(key) || clean.endsWith(key)) {
      return country;
    }
  }
  return clean;
}

/**
 * توحيد حقل الدولة ليصبح اسم الدولة مباشرة بدلاً من صفة الجنسية
 */
export function normalizeCountry(val?: string): string {
  if (!val) return 'السعودية';
  return normalizeNationality(val);
}

/**
 * توحيد نوع الزواج إلى: "announced" (معلن) أو "misyar" (مسيار) أو "both" (لا مانع - معلن أو مسيار)
 */
export function normalizeMarriageType(val?: string): 'announced' | 'misyar' | 'both' {
  if (!val) return 'announced';
  const clean = val.toString().trim().toLowerCase();
  if (
    clean.includes('both') ||
    clean.includes('لا مانع') ||
    clean.includes('كلاهما') ||
    clean.includes('الاثنين') ||
    clean.includes('معلن ومسيار') ||
    clean.includes('معلن أو مسيار') ||
    clean.includes('مسيار أو معلن') ||
    clean.includes('مسيار ومعلن') ||
    clean.includes('النوعين')
  ) {
    return 'both';
  }
  if (clean.includes('مسيار') || clean === 'misyar') {
    return 'misyar';
  }
  return 'announced';
}

/**
 * الحصول على تسمية واضحة لنوع الزواج
 */
export function getMarriageTypeDisplayLabel(type?: string): string {
  const norm = normalizeMarriageType(type);
  if (norm === 'misyar') return 'مسيار';
  if (norm === 'both') return 'لا مانع / معلن او مسيار';
  return 'معلن';
}

/**
 * توحيد نص عادي (إزالة التشكيل والألف والتاء المربوطة)
 */
export function normText(s: string): string {
  return (s || '')
    .toString()
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * استخراج قيم "أخرى" المخصصة لأي حقل من قائمة الأعضاء
 */
export function extractCustomFieldValues(
  fieldName: 'skinColor' | 'education' | 'workType' | 'nationality' | 'country' | 'city',
  members: any[],
  officialList: string[]
): { name: string; count: number }[] {
  const normOfficial = new Set(officialList.map((x) => normText(x)));
  const countsMap = new Map<string, { raw: string; count: number }>();

  members.forEach((m) => {
    let val: string = '';
    if (fieldName === 'skinColor') val = m.skinColor || m.skin_color || '';
    else if (fieldName === 'education') val = m.education || m.qualification || '';
    else if (fieldName === 'workType') val = m.workType || m.occupation || m.job || '';
    else if (fieldName === 'nationality') val = normalizeNationality(m.nationality);
    else if (fieldName === 'country') val = m.country || '';
    else if (fieldName === 'city') val = m.city || m.residence || '';

    val = val.trim();
    if (!val || val === 'أخرى' || val === 'لا يهم' || val === 'غير محدد') return;

    const norm = normText(val);
    if (!normOfficial.has(norm)) {
      if (countsMap.has(norm)) {
        countsMap.get(norm)!.count += 1;
      } else {
        countsMap.set(norm, { raw: val, count: 1 });
      }
    }
  });

  return Array.from(countsMap.values())
    .map((item) => ({ name: item.raw, count: item.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));
}
