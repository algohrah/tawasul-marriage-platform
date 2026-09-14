/**
 * Utility functions for member record calculations and sorting.
 */

export function getMemberTimestamp(member: any): number {
  if (!member) return 0;

  // 1. Candidate date/time fields
  const candidates = [
    member.createdAt,
    member.created_at,
    member.importDate,
    member.importedAt,
    member.registeredAt,
    member.registered_at,
    member.date,
    member.lastActive,
    member.last_active,
  ];

  for (const cand of candidates) {
    if (cand) {
      if (typeof cand === 'number' && cand > 0) {
        return cand < 10000000000 ? cand * 1000 : cand;
      }
      if (typeof cand === 'string') {
        const parsed = new Date(cand).getTime();
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      if (cand instanceof Date) {
        const parsed = cand.getTime();
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  }

  // 2. Check joinedAt string if present
  if (member.joinedAt && typeof member.joinedAt === 'string') {
    const parsed = new Date(member.joinedAt).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // 3. Fallback to ID timestamp if ID contains epoch digits like m_1740...
  if (member.id) {
    const strId = String(member.id);
    const match = strId.match(/(\d{10,13})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 1000000000) {
        return num < 10000000000 ? num * 1000 : num;
      }
    }
    const numOnly = parseInt(strId.replace(/\D/g, ''), 10);
    if (!isNaN(numOnly) && numOnly > 0) {
      return numOnly;
    }
  }

  return 0;
}

/**
 * Ensures marital status is ALWAYS returned as a proper Arabic label based on gender.
 */
export function formatMaritalStatus(status?: string, label?: string, gender?: string): string {
  const val = (label || status || '').toString().trim();
  if (!val) return 'غير محدد';

  const lower = val.toLowerCase();
  const isMale = gender === 'male' || gender === 'ذكر';

  const map: Record<string, string> = {
    single: isMale ? 'أعزب' : 'عزباء',
    divorced: isMale ? 'مطلق' : 'مطلقة',
    widow: isMale ? 'أرمل' : 'أرملة',
    widower: isMale ? 'أرمل' : 'أرملة',
    widowed: isMale ? 'أرمل' : 'أرملة',
    married: isMale ? 'متزوج' : 'متزوجة',
    'أعزب': 'أعزب',
    'عزباء': 'عزباء',
    'مطلق': 'مطلق',
    'مطلقة': 'مطلقة',
    'أرمل': 'أرمل',
    'أرملة': 'أرملة',
    'متزوج': 'متزوج',
    'متزوجة': 'متزوجة',
  };

  if (map[lower]) return map[lower];

  if (lower.includes('single')) return isMale ? 'أعزب' : 'عزباء';
  if (lower.includes('divorce')) return isMale ? 'مطلق' : 'مطلقة';
  if (lower.includes('widow')) return isMale ? 'أرمل' : 'أرملة';
  if (lower.includes('marri')) return isMale ? 'متزوج' : 'متزوجة';

  return val;
}

export interface PartnerTag {
  label: string;
  value: string;
}

export interface PartnerSummary {
  tags: PartnerTag[];
  text: string;
}

/**
 * Extracts and formats concise partner preference tags (Age, Cities, Nationality, Country, Marital, Children)
 */
export function getPartnerSummary(member: any): PartnerSummary {
  if (!member) return { tags: [], text: '' };

  const tags: PartnerTag[] = [];
  const details = member.details && typeof member.details === 'object' ? member.details : {};

  // 1. العمر المطلوب
  const pAgeMin = member.pAgeMin ?? member.p_age_min ?? member.partnerAgeMin ?? details.pAgeMin;
  const pAgeMax = member.pAgeMax ?? member.p_age_max ?? member.partnerAgeMax ?? details.pAgeMax;
  if (pAgeMin || pAgeMax) {
    if (pAgeMin && pAgeMax) {
      tags.push({ label: 'العمر', value: `${pAgeMin} - ${pAgeMax} سنة` });
    } else if (pAgeMin) {
      tags.push({ label: 'العمر', value: `من ${pAgeMin} سنة` });
    } else if (pAgeMax) {
      tags.push({ label: 'العمر', value: `حتى ${pAgeMax} سنة` });
    }
  }

  // 2. الدولة المطلوبة
  const pCountry = member.pCountry || member.p_country || member.partnerCountry || details.pCountry;
  if (pCountry && pCountry !== 'لا يهم' && pCountry !== 'غير محدد') {
    tags.push({ label: 'الدولة', value: String(pCountry) });
  }

  // 3. المدن المطلوبة
  const pCity = member.pCity || member.p_city || member.partnerCity || member.partnerCities || details.pCity;
  if (pCity && pCity !== 'لا يهم' && pCity !== 'غير محدد') {
    tags.push({ label: 'المدن', value: String(pCity) });
  }

  // 4. الجنسية المطلوبة وقبول غير المواطن
  const acceptForeigner = member.acceptForeigner || member.accept_foreigner;
  const pNat = member.pNationality || member.p_nationality || member.pNationalityOther || member.partnerNationality || details.pNationality;
  
  if (acceptForeigner === 'yes' || pNat === 'اقبل اجنبي' || pNat === 'أقبل أجنبي' || pNat === 'أي جنسية' || pNat === 'أية جنسية') {
    tags.push({ label: 'الجنسية', value: 'يقبل أجنبي (أي جنسية)' });
  } else if (pNat && pNat !== 'لا يهم' && pNat !== 'غير محدد') {
    const displayNat = pNat === 'نفس جنسيتي' ? (member.nationality || member.country || 'نفس الجنسية') : String(pNat);
    tags.push({ label: 'الجنسية', value: displayNat });
  } else if (acceptForeigner === 'no') {
    tags.push({ label: 'الجنسية', value: 'مواطن فقط' });
  }

  // 5. الحالة الاجتماعية المطلوبة
  let pMarital = member.pMaritalStatus || member.p_marital_status || member.pMarital || member.partnerMarital || member.partnerMaritalStatus || details.pMaritalStatus;
  if (pMarital) {
    let pMaritalClean = String(pMarital).trim();
    if (pMaritalClean === 'أعزب أو مطلق بدون أبناء') {
      pMaritalClean = 'أعزب، مطلق';
    }
    const pMaritalLower = pMaritalClean.toLowerCase();
    if (['لا يهم', 'الجميع', 'يقبل الجميع', 'all', 'أي حالة', 'اي حالة', 'كافة الحالات'].some(k => pMaritalLower.includes(k))) {
      tags.push({ label: 'الحالة', value: 'يقبل الجميع' });
    } else if (pMaritalClean !== 'غير محدد') {
      tags.push({ label: 'الحالة', value: pMaritalClean });
    }
  }

  // 6. قبول الأطفال
  const pAcceptChildren = member.pAcceptChildren || member.p_accept_children || details.pAcceptChildren;
  if (pAcceptChildren && pAcceptChildren !== 'لا يهم' && pAcceptChildren !== 'غير محدد') {
    tags.push({ label: 'الأبناء', value: String(pAcceptChildren) });
  }

  const text = (member.aboutPartner || member.pNotes || member.p_notes || details.pNotes || '').toString().trim();

  return { tags, text };
}

/**
 * Returns formatted source and registration/import date info for admin views
 */
export function getMemberSourceAndDate(member: any) {
  if (!member) {
    return {
      isImported: false,
      sourceType: 'registered',
      badgeLabel: 'مسجّل',
      badgeText: 'مسجّل 📱',
      badgeClass: 'bg-sky-100 text-sky-800 border border-sky-300',
      dateLabel: 'مسجّل',
      fullDateLabel: 'عضو مسجّل عبر التطبيق',
      dateFormatted: '',
      date: '',
    };
  }

  const isImported = member.sourceType === 'imported' || !!member.importBatchId || !!member.importOfficeName || ((member.notes || '').includes('مستورد'));
  
  const rawDate = member.importedAt || member.importDate || member.registeredAt || member.registered_at || member.createdAt || member.created_at || member.joinedAt;
  let dateFormatted = '';
  
  if (rawDate) {
    if (typeof rawDate === 'string') {
      if (rawDate.includes('T')) {
        dateFormatted = rawDate.split('T')[0];
      } else if (rawDate.includes(' ')) {
        dateFormatted = rawDate.split(' ')[0];
      } else {
        dateFormatted = rawDate;
      }
    } else if (typeof rawDate === 'number') {
      const d = new Date(rawDate < 10000000000 ? rawDate * 1000 : rawDate);
      if (!isNaN(d.getTime())) {
        dateFormatted = d.toISOString().split('T')[0];
      }
    } else if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      dateFormatted = rawDate.toISOString().split('T')[0];
    }
  }

  if (!dateFormatted) {
    const ts = getMemberTimestamp(member);
    if (ts > 0) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        dateFormatted = d.toISOString().split('T')[0];
      }
    }
  }

  return {
    isImported,
    sourceType: isImported ? 'imported' : 'registered',
    badgeLabel: isImported ? 'مستورد' : 'مسجّل',
    badgeText: isImported ? 'مستورد 📥' : 'مسجّل 📱',
    badgeClass: isImported ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-sky-100 text-sky-800 border border-sky-300',
    dateLabel: isImported ? (dateFormatted ? `استيراد: ${dateFormatted}` : 'مستورد') : (dateFormatted ? `تسجيل: ${dateFormatted}` : 'مسجّل'),
    fullDateLabel: isImported ? (dateFormatted ? `تاريخ الاستيراد: ${dateFormatted}` : 'عضو مستورد') : (dateFormatted ? `تاريخ التسجيل: ${dateFormatted}` : 'عضو مسجّل عبر التطبيق'),
    dateFormatted,
    date: dateFormatted,
  };
}
