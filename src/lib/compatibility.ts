import type { Member } from './members';
import type { ProfileData } from './AppContext';

// ====================================================================
//  محرك حساب التوافق — يعتمد على مواصفات الشريك في profileData
// ====================================================================

export interface CompatResult {
  score: number;           // النسبة 0-100
  isGenderMatch: boolean;  // هل الجنس متطابق (ذكر↔أنثى)
  isEstimated: boolean;    // هل الحساب تقديري (حقول شريك ناقصة)
  reasons: string[];       // أسباب التوافق الحقيقية
  details: { label: string; pct: number; weight: number }[]; // تفاصيل كل حقل
}

// مستويات التعليم مرتبة من الأقل للأعلى
const EDUCATION_RANK: Record<string, number> = {
  'أقل من الثانوية': 1,
  'الثانوية العامة': 2,
  'دبلوم': 3,
  'دبلوم عالي': 4,
  'بكالوريوس': 5,
  'ماجستير': 6,
  'دكتوراه': 7,
};

// خريطة الحالة الاجتماعية للقيم الموحدة
function normalizeMarital(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'single' || s === 'أعزب/عزباء' || s === 'أعزب' || s === 'عزباء') return 'single';
  if (s === 'divorced' || s === 'مطلق/مطلقة' || s === 'مطلق' || s === 'مطلقة') return 'divorced';
  if (s === 'widower' || s === 'widow' || s === 'أرمل/أرملة' || s === 'أرمل' || s === 'أرملة') return 'widowed';
  if (s === 'married' || s === 'متزوج' || s === 'متزوجة') return 'married';
  return s;
}

// ====================================================================
//  الدالة الرئيسية لحساب التوافق
// ====================================================================
export function calculateCompatibility(
  currentUser: Member,
  target: Member,
  prefs: ProfileData
): CompatResult {
  // 1. التحقق من تطابق الجنس
  const isGenderMatch = currentUser.gender !== target.gender;

  if (!isGenderMatch) {
    return {
      score: 0,
      isGenderMatch: false,
      isEstimated: false,
      reasons: ['غير متطابق في الجنس'],
      details: [],
    };
  }

  // 2. التحقق من عدد حقول مواصفات الشريك المعبأة
  const partnerFields = [
    prefs.pCountry, prefs.pNationality, prefs.pMaritalStatus,
    prefs.pSect, prefs.pSkinColor,
    prefs.pEducation, prefs.pWorkType, prefs.pHousing,
  ];
  const filledPartnerFields = partnerFields.filter(v => v && v.trim().length > 0).length;
  const isEstimated = filledPartnerFields < 3;

  const reasons: string[] = [];
  const details: { label: string; pct: number; weight: number }[] = [];

  // ===== حساب كل حقل =====

  // العمر (20%)
  let agePct = 0;
  const ageMin = Number(prefs.pAgeMin) || 18;
  const ageMax = Number(prefs.pAgeMax) || 45;
  if (target.age >= ageMin && target.age <= ageMax) {
    agePct = 100;
    reasons.push('ضمن نطاق العمر المطلوب');
  } else {
    const dist = Math.min(Math.abs(target.age - ageMin), Math.abs(target.age - ageMax));
    agePct = dist <= 5 ? 50 : 0;
    if (agePct === 0) reasons.push('خارج نطاق العمر المطلوب');
  }
  details.push({ label: 'العمر', pct: agePct, weight: 20 });

  // الدولة (15%)
  let countryPct = 100;
  if (prefs.pCountry && prefs.pCountry !== 'لا يهم') {
    if (target.country === prefs.pCountry) {
      countryPct = 100;
      reasons.push('نفس الدولة المطلوبة');
    } else {
      countryPct = 0;
      reasons.push('دولة مختلفة عن المطلوب');
    }
  }
  details.push({ label: 'الدولة', pct: countryPct, weight: 15 });

  // الجنسية (15%)
  let nationalityPct = 100;
  if (prefs.pNationality && prefs.pNationality !== 'لا يهم') {
    if (target.nationality === prefs.pNationality) {
      nationalityPct = 100;
      reasons.push('نفس الجنسية المطلوبة');
    } else {
      nationalityPct = 0;
      reasons.push('جنسية مختلفة عن المطلوب');
    }
  }
  details.push({ label: 'الجنسية', pct: nationalityPct, weight: 15 });

  // المذهب (15%)
  let sectPct = 100;
  const targetSect = target.sect || '';
  if (prefs.pSect && prefs.pSect !== 'لا يهم') {
    if (targetSect === prefs.pSect) {
      sectPct = 100;
      reasons.push('نفس المذهب المطلوب');
    } else {
      sectPct = 0;
      reasons.push('مذهب مختلف عن المطلوب');
    }
  }
  details.push({ label: 'المذهب', pct: sectPct, weight: 15 });

  // الحالة الاجتماعية (15%)
  let maritalPct = 100;
  if (prefs.pMaritalStatus && prefs.pMaritalStatus !== 'لا يهم') {
    const targetNorm = normalizeMarital(target.maritalStatus);
    const prefNorm = normalizeMarital(prefs.pMaritalStatus);
    if (targetNorm === prefNorm) {
      maritalPct = 100;
      reasons.push('الحالة الاجتماعية مطابقة');
    } else {
      maritalPct = 0;
      reasons.push('الحالة الاجتماعية مختلفة');
    }
  }
  details.push({ label: 'الحالة الاجتماعية', pct: maritalPct, weight: 15 });

  // المؤهل (10%)
  let educationPct = 100;
  if (prefs.pEducation && prefs.pEducation !== 'لا يهم') {
    const prefRank = EDUCATION_RANK[prefs.pEducation] || 0;
    const targetRank = EDUCATION_RANK[target.education] || 0;
    if (targetRank >= prefRank) {
      educationPct = 100;
      reasons.push('مؤهل علمي مطابق أو أعلى');
    } else {
      educationPct = 50;
      reasons.push('مؤهل علمي أقل من المطلوب');
    }
  }
  details.push({ label: 'المؤهل', pct: educationPct, weight: 10 });

  // نوع العمل (5%)
  let workPct = 100;
  if (prefs.pWorkType && prefs.pWorkType !== 'لا يهم') {
    if (target.workType === prefs.pWorkType) {
      workPct = 100;
      reasons.push('نوع عمل مطابق');
    } else {
      workPct = 50;
    }
  }
  details.push({ label: 'نوع العمل', pct: workPct, weight: 5 });

  // لون البشرة (5%)
  let skinPct = 100;
  if (prefs.pSkinColor && prefs.pSkinColor !== 'لا يهم') {
    if (target.skinColor === prefs.pSkinColor) {
      skinPct = 100;
      reasons.push('لون بشرة مطابق');
    } else {
      skinPct = 50;
    }
  }
  details.push({ label: 'لون البشرة', pct: skinPct, weight: 5 });

  // ===== الحساب النهائي =====
  let totalWeight = 0;
  let weightedSum = 0;
  for (const d of details) {
    weightedSum += d.pct * d.weight;
    totalWeight += d.weight;
  }
  const score = totalWeight > 0 ? Math.round((weightedSum / totalWeight)) : 0;

  return {
    score,
    isGenderMatch: true,
    isEstimated,
    reasons: reasons.slice(0, 5),
    details,
  };
}

// ====================================================================
//  ألوان الشارة حسب النسبة
// ====================================================================
export function getCompatBadgeColor(score: number, isGenderMatch: boolean): {
  text: string;
  bg: string;
  stroke: string;
  ring: string;
} {
  if (!isGenderMatch) {
    return {
      text: 'text-navy-400',
      bg: 'bg-navy-100 bg-navy-900/5',
      stroke: '#9ca3af',
      ring: 'ring-navy-200',
    };
  }
  if (score >= 80) {
    return {
      text: 'text-emerald-600',
      bg: 'bg-emerald-50',
      stroke: '#059669',
      ring: 'ring-emerald-200',
    };
  }
  if (score >= 60) {
    return {
      text: 'text-gold-600',
      bg: 'bg-gold-300/15',
      stroke: '#c9a961',
      ring: 'ring-gold-300',
    };
  }
  return {
    text: 'text-rose-deep',
    bg: 'bg-rose-50',
    stroke: '#c97b7f',
    ring: 'ring-rose-200',
  };
}

// تسمية مستوى التوافق
export function getCompatLabel(score: number, isGenderMatch: boolean): string {
  if (!isGenderMatch) return 'غير متطابق';
  if (score >= 80) return 'توافق عالي';
  if (score >= 60) return 'توافق متوسط';
  return 'توافق منخفض';
}
