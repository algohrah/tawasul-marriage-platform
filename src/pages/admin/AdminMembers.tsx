import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Eye, Ban, CheckCircle2, Mail, Phone, Lock, MapPin,
  ShieldCheck, Crown, Download, Users, Loader2, AlertCircle,
  Fingerprint, Briefcase, GraduationCap, Flag, Send, StickyNote,
  BadgeCheck, UserCheck, UserX, Sparkles, Trash2, KeyRound, Copy, RefreshCw,
  LogIn, Upload, MoreHorizontal, FileSpreadsheet, TrendingUp,
  Building2, Calendar, Hash, FileDown, Table, UserPlus, Import,
  Edit, Save, AlertTriangle, ChevronRight, ChevronLeft, Award, Pin, Star, CheckSquare,
  SlidersHorizontal, RotateCcw, Filter, LayoutGrid, List, Check, Plus, Heart,
} from 'lucide-react';
import { useAdminMembers, type AdminMemberRow } from '../../lib/useAdminData';
import { useApp } from '../../lib/AppContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getImportBatches, prepareImportedMember, getMaritalLabel, getKhataabaDirectory, doesMemberBelongToKhataaba, getKhataabaByPhone } from '../../lib/importBatches';
import {
  getCustomLists, createCustomList, updateCustomList, deleteCustomList,
  assignMembersToCustomList, removeMemberFromCustomList, toggleMemberCustomList,
  getMemberCustomLists, isMemberInCustomList, getListColorStyles, DEFAULT_LIST_COLORS, type CustomMemberList
} from '../../lib/customLists';
import { dataService } from '../../lib/data/DataService';
import supabase from '../../lib/supabase';

import Modal from '../../components/ui/Modal';
import MemberCard from '../../components/MemberCard';
import FilterDropdown from '../../components/admin/FilterDropdown';
import MultiSelectFilter from '../../components/admin/MultiSelectFilter';
import ActionMenu, { type ActionItem } from '../../components/admin/ActionMenu';
import AdminMemberDetailModal from '../../components/admin/AdminMemberDetailModal';
import { getMemberSourceAndDate, getPartnerSummary } from '../../lib/memberUtils';
import {
  getUnifiedCountries,
  getUnifiedCitiesForCountry,
  getUnifiedNationalities,
  getUnifiedSects,
  getUnifiedEducationLevels,
  getUnifiedWorkTypes,
  getUnifiedSmokingOptions,
} from '../../lib/registrationOptions';
import * as C from '../../lib/constants';

const safeGetLiveMembers = (includeInactiveAndDeleted: boolean = true): any[] => {
  try {
    return dataService.db.getLiveMembers?.(includeInactiveAndDeleted) || [];
  } catch {
    return [];
  }
};

const getPendingSuggestionsList = (): any[] => {
  try {
    const list = dataService.db.getPendingGeoSuggestions?.() || [];
    return Array.isArray(list) ? list.filter((s) => s && (s.status === 'pending' || !s.status)) : [];
  } catch {
    return [];
  }
};

const safeGetCountries = (currentValue?: string): Array<{ name: string; isPending?: boolean }> => {
  try {
    const list = dataService.db.getCountries?.() || [];
    const dbCountries = (Array.isArray(list) ? list : []).map((c: any) => typeof c === 'string' ? c : c?.name || String(c)).filter(Boolean);
    const constCountries = C.COUNTRIES || [];

    const pendingList = getPendingSuggestionsList()
      .filter((s) => s.kind === 'country')
      .map((s) => s.name)
      .filter(Boolean);

    const map = new Map<string, { name: string; isPending?: boolean }>();

    [...dbCountries, ...constCountries].filter(Boolean).forEach((n) => {
      map.set(n, { name: n, isPending: false });
    });

    pendingList.forEach((n) => {
      if (!map.has(n)) map.set(n, { name: n, isPending: true });
    });

    if (currentValue && currentValue !== 'all' && currentValue !== 'لا يهم' && !map.has(currentValue)) {
      map.set(currentValue, { name: currentValue, isPending: false });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  } catch {
    return (C.COUNTRIES || []).map((c) => ({ name: c, isPending: false }));
  }
};

const safeGetCities = (country?: string | string[], currentCity?: string): Array<{ name: string; isPending?: boolean }> => {
  try {
    let cities: string[] = [];
    const countriesList = Array.isArray(country) ? country : country ? [country] : [];
    if (countriesList.length === 0 || countriesList.includes('all') || countriesList.includes('لا يهم')) {
      cities = Array.from(new Set(Object.values(C.CITIES_BY_COUNTRY || {}).flat()));
    } else {
      countriesList.forEach((cName) => {
        const dbCities = dataService.db.getCities?.(cName) || [];
        const constCities = C.CITIES_BY_COUNTRY[cName] || [];
        cities.push(...(Array.isArray(dbCities) ? dbCities : []), ...(Array.isArray(constCities) ? constCities : []));
      });
      cities = Array.from(new Set(cities));
    }

    const pendingList = getPendingSuggestionsList()
      .filter((s) => s.kind === 'city' && (countriesList.length === 0 || countriesList.includes('all') || !s.country || countriesList.some(c => c.trim().toLowerCase() === s.country.trim().toLowerCase())))
      .map((s) => s.name)
      .filter(Boolean);

    const map = new Map<string, { name: string; isPending?: boolean }>();

    cities.filter(Boolean).forEach((n) => {
      map.set(n, { name: n, isPending: false });
    });

    pendingList.forEach((n) => {
      if (!map.has(n)) map.set(n, { name: n, isPending: true });
    });

    if (currentCity && currentCity !== 'all' && currentCity !== 'لا يهم' && !map.has(currentCity)) {
      map.set(currentCity, { name: currentCity, isPending: false });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  } catch {
    return currentCity ? [{ name: currentCity, isPending: false }] : [];
  }
};

const safeGetNationalities = (currentVal?: string): Array<{ name: string; isPending?: boolean }> => {
  try {
    const dbNats = (dataService.db.getNationalities?.() || []).map((x: any) => typeof x === 'string' ? x : x?.name || '').filter(Boolean);
    const constNats = C.NATIONALITIES || [];
    const dbCountries = dataService.db.getCountryNames?.() || [];

    const pendingList = getPendingSuggestionsList()
      .filter((s) => s.kind === 'nationality')
      .map((s) => s.name)
      .filter(Boolean);

    const map = new Map<string, { name: string; isPending?: boolean }>();

    [...dbNats, ...constNats, ...dbCountries].filter(Boolean).forEach((n) => map.set(n, { name: n, isPending: false }));

    pendingList.forEach((n) => {
      if (!map.has(n)) map.set(n, { name: n, isPending: true });
    });

    if (currentVal && currentVal !== 'all' && currentVal !== 'لا يهم' && !map.has(currentVal)) {
      map.set(currentVal, { name: currentVal, isPending: false });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  } catch {
    return (C.NATIONALITIES || []).map((n) => ({ name: n, isPending: false }));
  }
};


type PageSize = 10 | 20 | 50 | 100 | 999999;
const PAGE_SIZE_ALL = 999999;
const DEFAULT_PAGE_SIZE: PageSize = 100;

const PAGE_SIZE_OPTIONS: { value: PageSize; label: string }[] = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: PAGE_SIZE_ALL, label: 'الكل' },
];

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active: { label: 'نشط', color: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  pending: { label: 'قيد المراجعة', color: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  suspended: { label: 'موقوف', color: 'text-orange-700', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  banned: { label: 'محظور نهائياً', color: 'text-rose-700', bg: 'bg-rose-100', dot: 'bg-rose-600' },
  inactive: { label: 'غير نشط', color: 'text-slate-700', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  rejected: { label: 'مرفوض', color: 'text-rose-700', bg: 'bg-rose-100', dot: 'bg-rose-500' },
  deleted: { label: 'مُحذوف', color: 'text-rose-900 border border-rose-300 font-bold', bg: 'bg-rose-200', dot: 'bg-rose-700' },
};
const planConfig: Record<string, { label: string; color: string }> = {
  free: { label: 'مجاني', color: 'bg-slate-100 text-slate-600' },
  gold: { label: 'ذهبي', color: 'bg-amber-100 text-amber-700' },
  elite: { label: 'نخبة', color: 'bg-purple-100 text-purple-700' },
  premium: { label: 'ممتاز', color: 'bg-indigo-100 text-indigo-700' },
  vip: { label: 'VIP', color: 'bg-yellow-100 text-yellow-800' },
  basic: { label: 'أساسي', color: 'bg-blue-100 text-blue-700' },
};

const defaultStatus = { label: 'نشط', color: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' };
const defaultPlan = { label: 'مجاني', color: 'bg-slate-100 text-slate-600' };

function getStatusCfg(status?: string) {
  if (!status) return defaultStatus;
  return statusConfig[status] || { label: status, color: 'text-slate-700', bg: 'bg-slate-100', dot: 'bg-slate-400' };
}

function getPlanCfg(plan?: string) {
  if (!plan) return defaultPlan;
  return planConfig[plan] || { label: plan, color: 'bg-slate-100 text-slate-600' };
}

function getKhateebahInfo(m: any): { name: string; phone: string; hasInfo: boolean } {
  if (!m) return { name: '', phone: '', hasInfo: false };

  // 1. المطابقة المباشرة مع دليل الخطابات
  try {
    const directory = getKhataabaDirectory();
    const matched = directory.find((k) => doesMemberBelongToKhataaba(m, k));
    if (matched) {
      return {
        name: matched.name || matched.phone || '',
        phone: matched.phone && matched.phone !== matched.name ? matched.phone : '',
        hasInfo: true,
      };
    }
  } catch { /* ignore */ }

  // 2. القراءة المباشرة من حقول العضو
  let name = (m.importOfficeName || m.khateebahName || m.assignedKhateebah || m.officeName || m.assignedOffice || m.assignedKhateebahName || m.khataabaName || '').toString().trim();
  let phone = (m.khataabaPhone || m.khateebahPhone || m.officePhone || '').toString().trim();

  // إذا كان الاسم رقم هاتف والفرع فارغ، ابحث برقم الهاتف في الدليل
  if (name && !phone && /^[\d\+\s-]+$/.test(name)) {
    try {
      const kByPhone = getKhataabaByPhone(name);
      if (kByPhone) {
        name = kByPhone.name;
        phone = kByPhone.phone;
      } else {
        phone = name;
        name = 'خطابة غير معرفة';
      }
    } catch {
      phone = name;
      name = 'خطابة غير معرفة';
    }
  }

  // إذا توفر الرقم ولم يتوفر الاسم
  if (phone && !name) {
    try {
      const kByPhone = getKhataabaByPhone(phone);
      if (kByPhone) name = kByPhone.name;
    } catch { /* ignore */ }
  }

  return {
    name,
    phone,
    hasInfo: !!(name || phone),
  };
}

function getRichMemberDetails(m: any) {
  const isMale = m.gender === 'male';

  // 1. الدولة والمدينة
  const country = (m.country || '').toString().trim();
  const city = (m.city || '').toString().trim();
  const location = [country, city].filter(Boolean).join(' - ') || city || country || '';

  // 2. الجنسية
  const nationality = (m.nationality || '').toString().trim();

  // 3. الحالة الاجتماعية
  const rawMarital = m.maritalStatus || m.marital || m.maritalLabel || '';
  let marital = '';
  if (rawMarital) {
    const s = String(rawMarital).trim().toLowerCase();
    if (['single', 'أعزب', 'عزباء', 'بكر'].includes(s)) marital = isMale ? 'أعزب' : 'عزباء';
    else if (['divorced', 'مطلق', 'مطلقة'].includes(s)) marital = isMale ? 'مطلق' : 'مطلقة';
    else if (['widow', 'widower', 'widowed', 'أرمل', 'أرملة'].includes(s)) marital = isMale ? 'أرمل' : 'أرملة';
    else if (['married', 'متزوج', 'متزوجة'].includes(s)) marital = 'متزوج';
    else marital = String(rawMarital).trim();
  }

  // 4. العمر
  const age = m.age ? `${m.age} سنة` : '';

  // 5. نوع الزواج المطلوب
  const rawMarriage = m.marriageType || m.marriageTypeLabel || '';
  let marriageType = '';
  if (rawMarriage === 'misyar') marriageType = 'مسيار';
  else if (rawMarriage === 'announced') marriageType = 'معلن';
  else if (rawMarriage === 'both') marriageType = 'لا مانع / معلن او مسيار';
  else if (rawMarriage && rawMarriage !== 'غير محدد') marriageType = String(rawMarriage).trim();

  // 6. الوظيفة والمؤهل
  const job = (m.workType || m.occupation || m.jobTitle || '').toString().trim();
  const education = (m.education || '').toString().trim();

  // 7. النسب والعرق
  const tribe = (m.tribe || '').toString().trim();
  const ethnicity = (m.ethnicity || '').toString().trim();

  return {
    location,
    country,
    city,
    nationality,
    marital,
    age,
    marriageType,
    job,
    education,
    tribe,
    ethnicity,
  };
}

function getKhateebahName(m: any): string {
  return getKhateebahInfo(m).name;
}

function getOrderedMemberDetails(m: AdminMemberRow) {
  const isMale = m.gender === 'male';

  // 1. الحالة الاجتماعية
  const rawMarital = m.maritalStatus || (m as any).marital || (m as any).maritalLabel || '';
  let maritalVal = '';
  if (rawMarital) {
    const s = String(rawMarital).trim().toLowerCase();
    if (['single', 'أعزب', 'عزباء', 'بكر'].includes(s)) maritalVal = isMale ? 'أعزب' : 'عزباء';
    else if (['divorced', 'مطلق', 'مطلقة'].includes(s)) maritalVal = isMale ? 'مطلق' : 'مطلقة';
    else if (['widow', 'widower', 'widowed', 'أرمل', 'أرملة'].includes(s)) maritalVal = isMale ? 'أرمل' : 'أرملة';
    else if (['married', 'متزوج', 'متزوجة'].includes(s)) maritalVal = 'متزوج';
    else maritalVal = String(rawMarital).trim();
  }

  // 2. العمر
  const ageVal = m.age ? `${m.age} سنة` : '';

  // 3. الجنسية
  const natVal = ((m as any).nationality || m.nationality || '').toString().trim();

  // 4. الدولة
  const countryVal = (m.country || '').toString().trim();

  // 5. المدينة
  const cityVal = (m.city || '').toString().trim();

  // 6. لون البشرة
  const skinVal = (m.skinColor || (m as any).skinColor || '').toString().trim();

  // 7. الوظيفة
  const jobVal = (m.workType || m.occupation || (m as any).jobTitle || '').toString().trim();

  const rawItems = [
    { label: 'الحالة الاجتماعية', value: maritalVal },
    { label: 'العمر', value: ageVal },
    { label: 'الجنسية', value: natVal },
    { label: 'الدولة', value: countryVal },
    { label: 'المدينة', value: cityVal },
    { label: 'لون البشرة', value: skinVal },
    { label: 'الوظيفة', value: jobVal },
  ];

  return rawItems.filter(item => {
    if (!item.value) return false;
    const v = String(item.value).trim();
    return v !== '' && v !== '—' && v !== 'غير محدد' && v !== 'غير معروف' && v !== 'لا يوجد' && v !== 'null' && v !== 'undefined';
  });
}

export default function AdminMembers() {
  const {
    members, loading, error, updateMember, deleteMember, hardDeleteMember,
    toggleVerified, setPremium, setNote, toggleFlag, notifyMember,
    bulkDelete, bulkUpdateStatus, bulkSetVerified, bulkSetPinned, bulkSetPlan, bulkSetSeriousnessBadge, refresh,
  } = useAdminMembers();
  const { impersonateUser, importMembers, showToast } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const togglePin = async (id: string) => {
    const member = members.find((item) => item.id === id);
    if (!member) return;
    const ok = await bulkSetPinned([id], !member.pinned);
    showToast(ok ? (member.pinned ? 'تم إلغاء تثبيت العضو' : 'تم تثبيت العضو في البداية') : 'تعذّر تحديث حالة التثبيت', ok ? 'success' : 'error');
  };
  const [search, setSearch] = useState('');

  useEffect(() => {
    const memberId = searchParams.get('member');
    if (memberId) setSearch(memberId);
  }, [searchParams]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'pending' | 'banned' | 'deleted'>('all');
  const [filterPlan, setFilterPlan] = useState<'all' | 'free' | 'gold' | 'elite'>('all');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  // ===== فلاتر الاستيراد =====
  const [filterSource, setFilterSource] = useState<'all' | 'registered' | 'imported'>('all');
  const [filterOffice, setFilterOffice] = useState<string>('all');
  const [filterBatch, setFilterBatch] = useState<string>('all');
  const [filterImportDate, setFilterImportDate] = useState<string>('all');
  const [filterCompleteness, setFilterCompleteness] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [filterBadge, setFilterBadge] = useState<'all' | 'has' | 'none'>('all');
  // ===== القوائم المخصصة =====
  const [customLists, setCustomLists] = useState<CustomMemberList[]>(() => getCustomLists());
  const [filterCustomList, setFilterCustomList] = useState<string>('all');
  const [showCustomListsModal, setShowCustomListsModal] = useState<boolean>(false);
  const [editingCustomList, setEditingCustomList] = useState<CustomMemberList | null>(null);
  const [customListForm, setCustomListForm] = useState({ name: '', description: '', color: 'amber' });
  const [showAssignListModal, setShowAssignListModal] = useState<boolean>(false);
  const [assignTargetMemberIds, setAssignTargetMemberIds] = useState<string[]>([]);

  useEffect(() => {
    const handleUpdate = () => {
      setCustomLists(getCustomLists());
    };
    window.addEventListener('twafok_custom_lists_updated', handleUpdate);
    return () => window.removeEventListener('twafok_custom_lists_updated', handleUpdate);
  }, []);

  // ===== تبويب الإدارة واختيارات العرض =====
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [customListsOpen, setCustomListsOpen] = useState(false);

  // ===== خيارات البحث المتقدم الشامل (تحديد متعدد) =====
  const [filterGender, setFilterGender] = useState<string[]>([]);
  const [filterSect, setFilterSect] = useState<string[]>([]);
  const [filterNationality, setFilterNationality] = useState<string[]>([]);
  const [filterCountry, setFilterCountry] = useState<string[]>([]);
  const [filterCity, setFilterCity] = useState<string[]>([]);
  const [filterMaritalStatus, setFilterMaritalStatus] = useState<string[]>([]);
  const [filterMarriageType, setFilterMarriageType] = useState<string[]>([]);
  const [filterTribe, setFilterTribe] = useState<string>('');
  const [filterAgeMin, setFilterAgeMin] = useState<string>('');
  const [filterAgeMax, setFilterAgeMax] = useState<string>('');
  const [filterHeightMin, setFilterHeightMin] = useState<string>('');
  const [filterHeightMax, setFilterHeightMax] = useState<string>('');
  const [filterWeightMin, setFilterWeightMin] = useState<string>('');
  const [filterWeightMax, setFilterWeightMax] = useState<string>('');
  const [filterEducation, setFilterEducation] = useState<string[]>([]);
  const [filterOccupation, setFilterOccupation] = useState<string[]>([]);
  const [filterHealth, setFilterHealth] = useState<string[]>([]);
  const [filterSmoking, setFilterSmoking] = useState<string[]>([]);
  const [filterVerification, setFilterVerification] = useState<string>('all');
  const [filterOfficeMulti, setFilterOfficeMulti] = useState<string[]>([]);
  const [filterBatchMulti, setFilterBatchMulti] = useState<string[]>([]);
  const [filterImportDateMulti, setFilterImportDateMulti] = useState<string[]>([]);
  const [filterCustomListMulti, setFilterCustomListMulti] = useState<string[]>([]);

  // ===== فلاتر مواصفات الشريك المطلوبة المتقدمة (تحديد متعدد) =====
  const [filterPartnerMarital, setFilterPartnerMarital] = useState<string[]>([]);
  const [filterPartnerNationality, setFilterPartnerNationality] = useState<string[]>([]);
  const [filterPartnerCountry, setFilterPartnerCountry] = useState<string[]>([]);
  const [filterPartnerCity, setFilterPartnerCity] = useState<string[]>([]);
  const [filterPartnerAgeMin, setFilterPartnerAgeMin] = useState<string>('');
  const [filterPartnerAgeMax, setFilterPartnerAgeMax] = useState<string>('');
  const [filterPartnerChildren, setFilterPartnerChildren] = useState<string[]>([]);

  // خيارات مدن الشريك المطلوبة — تقتصر حصراً على مدن الدول اللتي اخترناها سابقاً في فلاتر العضو (filterCountry)
  // وإذا لم تُحدد الدولة، لا تظهر أي مدن
  const partnerCityOptions = useMemo(() => {
    if (!filterCountry || filterCountry.length === 0) return [];
    return safeGetCities(filterCountry);
  }, [filterCountry]);

  // تنظيف المدن المحددة للشريك عند إلغاء الدولة أو تغييرها
  useEffect(() => {
    if (filterCountry.length === 0) {
      if (filterPartnerCity.length > 0) setFilterPartnerCity([]);
    } else {
      const validNames = new Set(partnerCityOptions.map((c) => c.name));
      setFilterPartnerCity((prev) => prev.filter((c) => validNames.has(c)));
    }
  }, [filterCountry, partnerCityOptions]);

  const resetAllFilters = () => {
    setSearch('');
    setFilterStatus('all');
    setFilterPlan('all');
    setFilterSource('all');
    setFilterOffice('all');
    setFilterOfficeMulti([]);
    setFilterBatch('all');
    setFilterBatchMulti([]);
    setFilterImportDate('all');
    setFilterImportDateMulti([]);
    setFilterCompleteness('all');
    setFilterBadge('all');
    setFilterCustomList('all');
    setFilterCustomListMulti([]);
    setOnlyFlagged(false);
    setFilterGender([]);
    setFilterSect([]);
    setFilterNationality([]);
    setFilterCountry([]);
    setFilterCity([]);
    setFilterMaritalStatus([]);
    setFilterMarriageType([]);
    setFilterTribe('');
    setFilterAgeMin('');
    setFilterAgeMax('');
    setFilterHeightMin('');
    setFilterHeightMax('');
    setFilterWeightMin('');
    setFilterWeightMax('');
    setFilterEducation([]);
    setFilterOccupation([]);
    setFilterHealth([]);
    setFilterSmoking([]);
    setFilterVerification('all');
    // إعادة تعيين فلاتر مواصفات الشريك
    setFilterPartnerMarital([]);
    setFilterPartnerNationality([]);
    setFilterPartnerCountry([]);
    setFilterPartnerCity([]);
    setFilterPartnerAgeMin('');
    setFilterPartnerAgeMax('');
    setFilterPartnerChildren([]);
  };

  const advancedFilterActiveCount = useMemo(() => {
    return [
      search.trim() ? 'search' : '',
      filterStatus !== 'all' ? 'status' : '',
      filterPlan !== 'all' ? 'plan' : '',
      filterSource !== 'all' ? 'source' : '',
      (filterOffice !== 'all' || filterOfficeMulti.length > 0) ? 'office' : '',
      (filterBatch !== 'all' || filterBatchMulti.length > 0) ? 'batch' : '',
      (filterImportDate !== 'all' || filterImportDateMulti.length > 0) ? 'date' : '',
      filterCompleteness !== 'all' ? 'complete' : '',
      filterBadge !== 'all' ? 'badge' : '',
      (filterCustomList !== 'all' || filterCustomListMulti.length > 0) ? 'customList' : '',
      onlyFlagged ? 'flagged' : '',
      filterGender.length > 0 ? 'gender' : '',
      filterSect.length > 0 ? 'sect' : '',
      filterNationality.length > 0 ? 'nat' : '',
      filterCountry.length > 0 ? 'country' : '',
      filterCity.length > 0 ? 'city' : '',
      filterMaritalStatus.length > 0 ? 'marital' : '',
      filterMarriageType.length > 0 ? 'marriageType' : '',
      filterTribe.trim() ? 'tribe' : '',
      filterAgeMin ? 'ageMin' : '',
      filterAgeMax ? 'ageMax' : '',
      filterHeightMin ? 'hMin' : '',
      filterHeightMax ? 'hMax' : '',
      filterWeightMin ? 'wMin' : '',
      filterWeightMax ? 'wMax' : '',
      filterEducation.length > 0 ? 'edu' : '',
      filterOccupation.length > 0 ? 'job' : '',
      filterHealth.length > 0 ? 'health' : '',
      filterSmoking.length > 0 ? 'smoke' : '',
      filterVerification !== 'all' ? 'verify' : '',
      // فلاتر مواصفات الشريك
      filterPartnerMarital.length > 0 ? 'pMarital' : '',
      filterPartnerNationality.length > 0 ? 'pNat' : '',
      filterPartnerCity.length > 0 ? 'pCity' : '',
      filterPartnerAgeMin ? 'pAgeMin' : '',
      filterPartnerAgeMax ? 'pAgeMax' : '',
      filterPartnerChildren.length > 0 ? 'pChildren' : '',
    ].filter(Boolean).length;
  }, [
    search, filterStatus, filterPlan, filterSource, filterOffice, filterOfficeMulti, filterBatch, filterBatchMulti, filterImportDate, filterImportDateMulti, filterCompleteness, filterBadge, filterCustomList, filterCustomListMulti, onlyFlagged,
    filterGender, filterSect, filterNationality, filterCountry, filterCity, filterMaritalStatus, filterMarriageType, filterTribe,
    filterAgeMin, filterAgeMax, filterHeightMin, filterHeightMax, filterWeightMin, filterWeightMax, filterEducation, filterOccupation, filterHealth, filterSmoking, filterVerification,
    filterPartnerMarital, filterPartnerNationality, filterPartnerCity, filterPartnerAgeMin, filterPartnerAgeMax, filterPartnerChildren
  ]);
  
  const liveMembersMap = useMemo(() => {
    const list = safeGetLiveMembers(true);
    return new Map(list.map(lm => [lm.id, lm]));
  }, [members]); // re-compute when members state changes

  // ===== حالات تعديل الملف من الإدارة =====
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [activeEditTab, setActiveEditTab] = useState<'basic' | 'account' | 'partner'>('basic');
  const [activeViewTab, setActiveViewTab] = useState<'basic' | 'partner'>('basic');

  const [selected, setSelected] = useState<AdminMemberRow | null>(null);

  const getNormalizedMaritalCode = (raw: string, gender: string): string => {
    if (!raw) return 'single';
    const s = raw.trim().toLowerCase();
    if (['single', 'أعزب', 'عزباء'].includes(s)) return 'single';
    if (['divorced', 'مطلق', 'مطلقة'].includes(s)) return 'divorced';
    if (['widow', 'widower', 'widowed', 'أرمل', 'أرملة'].includes(s)) return gender === 'female' ? 'widow' : 'widower';
    if (['married', 'متزوج', 'متزوجة'].includes(s)) return 'married';
    return s;
  };

  const openEditModal = (member: AdminMemberRow) => {
    const gender = ((member.gender as string) || 'female') as 'male' | 'female';
    const rawStatus = member.maritalStatus || (member as any).marital || '';
    const normStatus = getNormalizedMaritalCode(rawStatus, gender);

    setSelected(member);
    setEditForm({
      ...member,
      gender,
      maritalStatus: normStatus,
      marital: normStatus,
      maritalLabel: getMaritalLabel(normStatus, gender),
      marriageType: (member as any).marriageType || 'announced',
      marriageTypeLabel: (member as any).marriageType === 'misyar' ? 'مسيار' : (member as any).marriageType === 'both' ? 'لا مانع / معلن او مسيار' : 'معلن',
      tribe: (member as any).tribe || '',
      acceptPolygamy: (member as any).acceptPolygamy || '',
      sect: (member as any).sect || '',
      nationality: (member as any).nationality || member.country || 'السعودية',
      country: member.country || 'السعودية',
      city: member.city || '',
    });
    setActiveEditTab('basic');
    setIsEditing(true);
  };
  const [revealSensitive, setRevealSensitive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [localToast, setLocalToast] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  // ===== إضافة عضو سريع =====
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({
    nickname: '',
    gender: 'female' as 'male' | 'female',
    age: 26,
    city: 'الرياض',
    phone: '0501234567',
    email: '',
    plan: 'free',
    status: 'active',
    maritalStatus: 'عزباء',
    education: 'بكالوريوس',
    occupation: 'معلمة',
    aboutMe: 'أنثى تخاف الله تبحث عن الزواج الشرعي على سنة الله ورسوله.',
  });

  const handleQuickAddRandom = () => {
    const isFemale = Math.random() > 0.4;
    const femaleNames = ['سارة العتيبي', 'نورة الدوسري', 'أمل القحطاني', 'ريم الشهري', 'عبير المطيري', 'منى الحربي', 'هدى الغامدي'];
    const maleNames = ['عبدالله السبيعي', 'محمد الشمري', 'فهد العنزي', 'خالد الزهراني', 'سعود التميمي', 'عبدالرحمن المالكي'];
    const cities = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر', 'أبها', 'القصيم'];
    const femaleJobs = ['معلمة', 'مهندسة برمجيات', 'طبيبة أسنان', 'محاسبة', 'إدارية ماليّة', 'طالبة ماجستير'];
    const maleJobs = ['مهندس برمجيات', 'طبيب باطنية', 'ضابط عسكري', 'معلم ثانوي', 'رائد أعمال', 'موظف بنكي'];
    const femaleMarital = ['عزباء', 'مطلقة بدون أطفال', 'أرملة'];
    const maleMarital = ['أعزب', 'مطلق بدون أطفال', 'متزوج (يرغب بتعدد)'];

    const randomName = isFemale
      ? femaleNames[Math.floor(Math.random() * femaleNames.length)]
      : maleNames[Math.floor(Math.random() * maleNames.length)];
    const randomCity = cities[Math.floor(Math.random() * cities.length)];
    const randAge = Math.floor(Math.random() * 18) + 22;
    const randNum = Math.floor(Math.random() * 8999999) + 1000000;

    setQuickAddForm({
      nickname: randomName,
      gender: isFemale ? 'female' : 'male',
      age: randAge,
      city: randomCity,
      phone: `055${randNum}`,
      email: `user_${randNum}@twafok.sa`,
      plan: Math.random() > 0.7 ? 'gold' : 'free',
      status: 'active',
      maritalStatus: isFemale ? femaleMarital[Math.floor(Math.random() * femaleMarital.length)] : maleMarital[Math.floor(Math.random() * maleMarital.length)],
      education: 'بكالوريوس',
      occupation: isFemale ? femaleJobs[Math.floor(Math.random() * femaleJobs.length)] : maleJobs[Math.floor(Math.random() * femaleJobs.length)],
      aboutMe: isFemale
        ? 'إنسانة هادئة، خلوقة ومحافظة على صلاتها، تبحث عن زوج صالح ومسؤول لبناء أسرة سعيدة.'
        : 'شاب طموح ومسؤول، أعمل بجد وأبحث عن زوجة صالحة تعينني على طاعة الله وتربية الأبناء.',
    });
  };

  const handleQuickAddSubmit = () => {
    if (!quickAddForm.nickname.trim()) {
      showLocalToast('يرجى إدخال الاسم أو اللقب');
      return;
    }
    const newMemberData = prepareImportedMember({
      nickname: quickAddForm.nickname,
      gender: quickAddForm.gender,
      age: Number(quickAddForm.age) || 25,
      city: quickAddForm.city,
      phone: quickAddForm.phone || `050${Math.floor(Math.random() * 8999999) + 1000000}`,
      email: quickAddForm.email || `user_${Date.now()}@twafok.sa`,
      plan: quickAddForm.plan,
      status: quickAddForm.status,
      maritalStatus: quickAddForm.maritalStatus,
      education: quickAddForm.education,
      occupation: quickAddForm.occupation,
      aboutMe: quickAddForm.aboutMe,
      country: 'السعودية',
      sourceType: 'admin_created',
      importedAt: new Date().toISOString(),
    });

    importMembers([newMemberData]);
    refresh();
    setQuickAddOpen(false);
    showLocalToast(`تمت إضافة العضو ${quickAddForm.nickname} بنجاح ✓`);
  };

  const showLocalToast = (t: string) => {
    setLocalToast(t);
    setTimeout(() => setLocalToast(null), 2500);
  };

  const impersonateAndGo = (member: AdminMemberRow) => {
    impersonateUser({
      id: member.id,
      nickname: member.nickname,
      gender: member.gender,
      age: member.age,
      country: member.country,
      city: member.city,
      realName: member.realName,
      email: member.email,
      phone: member.phone,
      whatsapp: (member as any).whatsapp,
      plan: member.plan,
      password: member.password,
      verified: member.verified,
    });
    showLocalToast(`جارٍ الدخول بحساب ${member.nickname}...`);
    setTimeout(() => navigate('/profile'), 400);
  };

  const selectedLive = useMemo(
    () => (selected ? members.find((m) => m.id === selected.id) || selected : null),
    [selected, members]
  );
  useEffect(() => {
    if (selectedLive) setNoteDraft(selectedLive.adminNote || '');
  }, [selectedLive?.id]);

  const [notifyFor, setNotifyFor] = useState<AdminMemberRow | null>(null);
  const [notifyText, setNotifyText] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [deleteFor, setDeleteFor] = useState<AdminMemberRow | null>(null);

  // ===== التحديد المتعدد والإجراءات الجماعية =====
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // نافذة تأكيد الإجراء الجماعي: {action, label}
  const [bulkConfirm, setBulkConfirm] = useState<{ action: 'ban' | 'suspend' | 'activate' | 'verify' | 'delete' | 'pin' | 'unpin' | 'plan_elite' | 'plan_gold' | 'plan_free' | 'grant_badge' | 'revoke_badge'; label: string } | null>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  // نافذة تغيير حالة فردية بسبب (حظر/تجميد/إيقاف)
  const [statusFor, setStatusFor] = useState<{ member: AdminMemberRow; status: 'banned' | 'suspended' } | null>(null);
  const [statusReasonDraft, setStatusReasonDraft] = useState('');
  const [bulkPlansOpen, setBulkPlansOpen] = useState(false);

  // ===== الخطابات والدفعات =====
  const offices = useMemo(() => {
    const officeSet = new Set<string>();
    members.forEach(m => { if (m.importOfficeName) officeSet.add(m.importOfficeName); });
    return Array.from(officeSet);
  }, [members]);
  
  const batches = useMemo(() => {
    const batchSet = new Set<string>();
    members.forEach(m => { if (m.importBatchId) batchSet.add(m.importBatchId); });
    return Array.from(batchSet);
  }, [members]);

  const allImportBatches = useMemo(() => {
    return getImportBatches();
  }, [members]);

  const batchMap = useMemo(() => {
    const map = new Map<string, string>();
    allImportBatches.forEach(b => {
      map.set(b.id, b.batchNumber);
    });
    return map;
  }, [allImportBatches]);

  const importDates = useMemo(() => {
    const datesSet = new Set<string>();
    members.forEach(m => {
      if (m.importDate) {
        const dStr = String(m.importDate);
        const d = dStr.includes('T') ? dStr.split('T')[0] : dStr;
        datesSet.add(d);
      }
    });
    return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  }, [members]);

  const stats = useMemo(
    () => ({
      total: members.length,
      registered: members.filter((m) => !m.sourceType || m.sourceType === 'registered').length,
      imported: members.filter((m) => m.sourceType === 'imported').length,
      active: members.filter((m) => m.status === 'active').length,
      pending: members.filter((m) => m.status === 'pending').length,
      verified: members.filter((m) => m.verified).length,
      premium: members.filter((m) => m.premium).length,
      flagged: members.filter((m) => m.flagged).length,
    }),
    [members]
  );

  const activeFilterCount = advancedFilterActiveCount;

  const filtered = useMemo(
    () => {
      return members.filter((m) => {
        const sLower = search.trim().toLowerCase();
        const matchSearch =
          !sLower ||
          (m.nickname || '').toLowerCase().includes(sLower) ||
          (m.realName || '').toLowerCase().includes(sLower) ||
          (m.username || '').toLowerCase().includes(sLower) ||
          (m.email || '').toLowerCase().includes(sLower) ||
          (m.nationalId || '').includes(sLower) ||
          (m.phone || '').includes(sLower) ||
          ((m as any).tribe || '').toLowerCase().includes(sLower) ||
          (m.city || '').toLowerCase().includes(sLower) ||
          (m.country || '').toLowerCase().includes(sLower) ||
          ((m as any).nationality || '').toLowerCase().includes(sLower) ||
          ((m as any).bio || m.aboutMe || '').toLowerCase().includes(sLower) ||
          ((m as any).aboutPartner || '').toLowerCase().includes(sLower) ||
          (m.adminNote || '').toLowerCase().includes(sLower);

        const matchStatus = filterStatus === 'all' || m.status === filterStatus;
        const matchPlan = filterPlan === 'all' || m.plan === filterPlan;
        const matchFlag = !onlyFlagged || m.flagged;
        // فلاتر الاستيراد (تدعم التحديد المفرد والمتعدد)
        const matchSource = filterSource === 'all' || 
          (filterSource === 'registered' && (!m.sourceType || m.sourceType === 'registered')) ||
          (filterSource === 'imported' && m.sourceType === 'imported');
        const matchOffice = (filterOffice === 'all' && filterOfficeMulti.length === 0) ||
          (filterOffice !== 'all' && m.importOfficeName === filterOffice) ||
          (filterOfficeMulti.length > 0 && filterOfficeMulti.includes(m.importOfficeName || ''));
        const matchBatch = (filterBatch === 'all' && filterBatchMulti.length === 0) ||
          (filterBatch !== 'all' && m.importBatchId === filterBatch) ||
          (filterBatchMulti.length > 0 && filterBatchMulti.includes(m.importBatchId || ''));
        const matchImportDate = (filterImportDate === 'all' && filterImportDateMulti.length === 0) || 
          (filterImportDate !== 'all' && m.importDate && (m.importDate.startsWith(filterImportDate) || m.importDate === filterImportDate)) ||
          (filterImportDateMulti.length > 0 && m.importDate && filterImportDateMulti.some(d => m.importDate.startsWith(d) || m.importDate === d));
        
        // فلتر اكتمال الملف الشخصي
        const matchCompleteness = filterCompleteness === 'all' || 
          (filterCompleteness === 'complete' && !m.isProfileIncomplete) ||
          (filterCompleteness === 'incomplete' && m.isProfileIncomplete);
        // فلتر وسام الجدية
        const memberLive = liveMembersMap.get(m.id);
        const hasBadge = !!(memberLive?.hasSeriousnessBadge || (m as any).hasSeriousnessBadge);
        const matchBadge = filterBadge === 'all' ||
          (filterBadge === 'has' && hasBadge) ||
          (filterBadge === 'none' && !hasBadge);

        // ===== فلاتر بيانات العضو الشخصية (تحديد متعدد) =====
        const matchGender = filterGender.length === 0 || filterGender.includes(m.gender);
        
        const mSectRaw = ((m as any).sect || (m as any).pSect || '').toString().toLowerCase().trim();
        const matchSect = filterSect.length === 0 || !mSectRaw || filterSect.some(s => mSectRaw.includes(s.toLowerCase()));

        const mNatRaw = ((m as any).nationality || m.country || '').toString().toLowerCase().trim();
        const matchNationality = filterNationality.length === 0 || filterNationality.some(n => mNatRaw.includes(n.toLowerCase()));

        const matchCountry = filterCountry.length === 0 || filterCountry.includes(m.country || '');
        const matchCity = filterCity.length === 0 || filterCity.includes(m.city || '');

        const mStatusRaw = (m.maritalStatus || (m as any).marital || '').toString().toLowerCase().trim();
        const matchMaritalStatus = filterMaritalStatus.length === 0 || filterMaritalStatus.some(st => {
          if (st === 'single') return ['single', 'أعزب', 'عزباء', 'بكر', 'لم يسبق'].some(k => mStatusRaw.includes(k));
          if (st === 'divorced') return ['divorced', 'مطلق', 'مطلقة'].some(k => mStatusRaw.includes(k));
          if (st === 'widow') return ['widow', 'widower', 'widowed', 'أرمل', 'أرملة'].some(k => mStatusRaw.includes(k));
          if (st === 'married') return ['married', 'متزوج', 'متزوجة', 'معدد'].some(k => mStatusRaw.includes(k));
          return mStatusRaw.includes(st.toLowerCase());
        });

        // تصفية نوع الزواج (معلن / مسيار / كلاهما) — من اختار "لا مانع" أو "كلاهما" أو يقبل الاثنين يظهر في المعلن والمسيار كأنه اختار الاثنين
        // تصفية نوع الزواج (معلن / مسيار / كلاهما) — من اختار "لا مانع" أو "كلاهما" أو يقبل الاثنين يظهر في المعلن والمسيار كأنه اختار الاثنين
        const mTypeRaw = [
          (m as any).marriageType,
          (m as any).marriage_type,
          (m as any).marriageTypeLabel,
          (m as any).preferredMarriageType,
        ].filter(Boolean).join(' ').toLowerCase().trim();

        const isBothMarriage = [
          'both', 'معلن أو مسيار', 'معلن ومسيار', 'معلن و مسيار', 'لا مانع', 'الاثنين', 'كلاهما', 'لا مانع معلن او مسيار', 'لا مانع / معلن او مسيار', 'لا مانع معلن أو مسيار'
        ].some(k => mTypeRaw.includes(k)) || (mTypeRaw.includes('مسيار') && mTypeRaw.includes('معلن'));

        const isAnnounced = isBothMarriage || ['announced', 'معلن', 'عادي', 'طبيعي'].some(k => mTypeRaw.includes(k)) || !mTypeRaw;
        const isMisyar = isBothMarriage || ['misyar', 'مسيار'].some(k => mTypeRaw.includes(k));

        const matchMarriageType = filterMarriageType.length === 0 || filterMarriageType.some(mt => {
          if (mt === 'announced') return isAnnounced;
          if (mt === 'misyar') return isMisyar;
          if (mt === 'both') return isBothMarriage;
          return false;
        });

        // تصفية القوائم المخصصة
        const matchCustomList = (filterCustomList === 'all' && filterCustomListMulti.length === 0) ||
          (filterCustomList !== 'all' && isMemberInCustomList(m, filterCustomList)) ||
          (filterCustomListMulti.length > 0 && filterCustomListMulti.some(cId => isMemberInCustomList(m, cId)));

        const matchTribe = !filterTribe.trim() || ((m as any).tribe || '').toLowerCase().includes(filterTribe.trim().toLowerCase());

        const mAge = Number(m.age || 0);
        const matchAgeMin = !filterAgeMin || mAge >= Number(filterAgeMin);
        const matchAgeMax = !filterAgeMax || mAge <= Number(filterAgeMax);

        const mHeight = Number(m.height || 0);
        const matchHeightMin = !filterHeightMin || mHeight >= Number(filterHeightMin);
        const matchHeightMax = !filterHeightMax || mHeight <= Number(filterHeightMax);

        const mWeight = Number(m.weight || 0);
        const matchWeightMin = !filterWeightMin || mWeight >= Number(filterWeightMin);
        const matchWeightMax = !filterWeightMax || mWeight <= Number(filterWeightMax);

        const mEduRaw = (m.education || (m as any).educationLevel || '').toString().toLowerCase().trim();
        const matchEducation = filterEducation.length === 0 || filterEducation.some(ed => mEduRaw.includes(ed.toLowerCase()));

        const mJobRaw = (m.occupation || (m as any).workType || (m as any).jobTitle || '').toString().toLowerCase().trim();
        const matchOccupation = filterOccupation.length === 0 || filterOccupation.some(job => mJobRaw.includes(job.toLowerCase()));

        const mHealthRaw = ((m as any).health || (m as any).healthStatus || '').toString().toLowerCase().trim();
        const matchHealth = filterHealth.length === 0 || filterHealth.some(h => mHealthRaw.includes(h.toLowerCase()));

        const mSmokeRaw = ((m as any).smoking || (m as any).isSmoking || '').toString().toLowerCase().trim();
        const matchSmoking = filterSmoking.length === 0 || filterSmoking.some(sm => mSmokeRaw.includes(sm.toLowerCase()));

        const matchVerification = filterVerification === 'all' || (filterVerification === 'verified' && m.verified) || (filterVerification === 'unverified' && !m.verified);

        // ===== فلاتر مواصفات الشريك المطلوبة المتقدمة (تحديد متعدد) =====
        
        // 1. استخراج جنسية العضو ومواصفات جنسية الشريك المسجلة
        const mNatClean = [
          (m as any).nationality,
          (m as any).country,
        ].filter(Boolean).join(' ').toLowerCase().trim();

        const pNatRaw = [
          (m as any).pNationality,
          (m as any).p_nationality,
          (m as any).pNationalityOther,
          (m as any).partnerNationality,
          (m as any).pCountry,
          (m as any).p_country,
          (m as any).partnerCountry,
        ].filter(Boolean).join(' ').toLowerCase().trim();

        // هل يقبل العضو أجنبي / غير مواطن؟
        // يشمل: من اختار في حسابه لا يهم أي جنسية / جنسية أخرى غير جنسيته / اختار دول متعددة
        const hasExplicitAnyForeigner = !pNatRaw || [
          'لا يهم', 'الجميع', 'اقبل اجنبي', 'أقبل أجنبي', 'أية جنسية', 'اي جنسية',
          'أي جنسية', 'غير محدد', 'لا مانع', 'أي دولة', 'اي دولة', 'كل الجنسيات', 'all', 'any'
        ].some(k => pNatRaw.includes(k));

        const hasMultipleCountries = pNatRaw.includes('،') || pNatRaw.includes(',') || pNatRaw.includes(' و ') || pNatRaw.includes(' / ');

        const isDifferentThanOwnCountry = Boolean(
          mNatClean && pNatRaw &&
          !pNatRaw.includes('نفس') &&
          !['سعودي', 'سعودية', 'السعودية'].every(sa => mNatClean.includes(sa) && pNatRaw.includes(sa) && !hasMultipleCountries)
        );

        const memberAcceptsForeigner = hasExplicitAnyForeigner || hasMultipleCountries || isDifferentThanOwnCountry;

        // تصفية جنسية الشريك المطلوبة (تحديد متعدد)
        const matchPartnerNationality = filterPartnerNationality.length === 0 || filterPartnerNationality.some(pn => {
          if (pn === 'any_foreigner') {
            return memberAcceptsForeigner;
          }
          const targetNat = pn.toLowerCase().trim();
          const isSameNatRequested = pNatRaw.includes('نفس') && mNatClean.includes(targetNat);
          const isTargetDirectlyInPNat = pNatRaw.includes(targetNat);
          const acceptsAny = hasExplicitAnyForeigner;
          return isTargetDirectlyInPNat || isSameNatRequested || acceptsAny;
        });

        // 2. تصفية الحالة الاجتماعية المقبولة للشريك (تحديد متعدد)
        // القاعدة: من يقبل الجميع أو لا يهم يظهر في جميع الحالات الاجتماعية
        const pMaritalRaw = [
          (m as any).pMaritalStatus,
          (m as any).p_marital_status,
          (m as any).pMarital,
          (m as any).partnerMarital,
          (m as any).partnerMaritalStatus,
          (m as any).acceptDivorced === 'yes' ? 'مطلق مطلقة' : '',
          (m as any).accept_divorced === 'yes' ? 'مطلق مطلقة' : '',
          (m as any).acceptPolygamy === 'yes' || (m as any).acceptPolygamy === 'maybe' || (m as any).accept_polygamy === 'yes' ? 'متزوج معدد تعدد' : '',
          (m as any).aboutPartner,
        ].filter(Boolean).join(' ').toLowerCase().trim();

        const acceptsAllMarital = !pMaritalRaw || [
          'لا يهم', 'الجميع', 'يقبل الجميع', 'all', 'أي حالة', 'اي حالة', 'كافة الحالات', 'غير محدد', 'لا مانع'
        ].some(k => pMaritalRaw.includes(k)) || (
          ['single', 'أعزب', 'عزباء'].some(k => pMaritalRaw.includes(k)) &&
          ['divorced', 'مطلق', 'مطلقة'].some(k => pMaritalRaw.includes(k)) &&
          ['widow', 'أرمل', 'أرملة'].some(k => pMaritalRaw.includes(k))
        );

        const acceptsDivorced = (m as any).acceptDivorced === 'yes' || (m as any).accept_divorced === 'yes' || ['divorced', 'مطلق', 'مطلقة', 'مطلقين', 'مطلقات'].some(k => pMaritalRaw.includes(k));
        const acceptsWidow = ['widow', 'widower', 'widowed', 'أرمل', 'أرملة', 'ارمل', 'ارملة', 'أرامل', 'ارامل'].some(k => pMaritalRaw.includes(k));
        const acceptsPolygamy = ['yes', 'maybe', 'نعم', 'لا مانع'].includes((m as any).acceptPolygamy) || ['yes', 'maybe', 'نعم', 'لا مانع'].includes((m as any).accept_polygamy) || ['married', 'متزوج', 'متزوجة', 'تعدد', 'معدد'].some(k => pMaritalRaw.includes(k));
        const acceptsSingle = ['single', 'أعزب', 'عزباء', 'اعزب', 'بكر', 'لم يسبق'].some(k => pMaritalRaw.includes(k));

        const matchPartnerMarital = filterPartnerMarital.length === 0 || filterPartnerMarital.some(pm => {
          if (pm === 'accept_all' || pm === 'accept_all_only') return acceptsAllMarital;
          if (pm === 'single') return acceptsAllMarital || acceptsSingle;
          if (pm === 'divorced') return acceptsAllMarital || acceptsDivorced;
          if (pm === 'widow') return acceptsAllMarital || acceptsWidow;
          if (pm === 'married') return acceptsAllMarital || acceptsPolygamy;
          return acceptsAllMarital || pMaritalRaw.includes(pm.toLowerCase());
        });

        // 3. تصفية مدينة الشريك المطلوبة (تحديد متعدد)
        // القاعدة: عندما نختار مدينة أو مدن يظهر اللذين في حسابهم اختاروا "لا يهم / جميع المدن" أو اللذين اختاروا إحدى المدن المحددة
        const pCityRaw = [
          (m as any).pCity,
          (m as any).p_city,
          (m as any).partnerCity,
          (m as any).partnerCities,
          (m as any).pCityOther,
        ].filter(Boolean).join(' ').trim();

        const pCityLower = pCityRaw.toLowerCase();
        const acceptsAllCities = !pCityRaw || [
          'لا يهم', 'الجميع', 'جميع المدن', 'كل المدن', 'أي مدينة', 'اي مدينة', 'كافة المدن', 'غير محدد', 'all'
        ].some(k => pCityLower.includes(k));

        const matchPartnerCity = filterPartnerCity.length === 0 || acceptsAllCities || filterPartnerCity.some(pc => {
          return pCityLower.includes(pc.toLowerCase().trim());
        });

        // 4. تصفية نطاق عمر الشريك المطلوب
        const pAgeMinVal = Number((m as any).pAgeMin || (m as any).p_age_min || (m as any).partnerAgeMin || (m as any).partner_age_min || 0);
        const pAgeMaxVal = Number((m as any).pAgeMax || (m as any).p_age_max || (m as any).partnerAgeMax || (m as any).partner_age_max || 0);
        let matchPartnerAge = true;
        if (filterPartnerAgeMin) {
          const reqMin = Number(filterPartnerAgeMin);
          if (pAgeMaxVal > 0 && pAgeMaxVal < reqMin) matchPartnerAge = false;
        }
        if (filterPartnerAgeMax) {
          const reqMax = Number(filterPartnerAgeMax);
          if (pAgeMinVal > 0 && pAgeMinVal > reqMax) matchPartnerAge = false;
        }

        // 5. تصفية قبول أطفال لدى الشريك (تحديد متعدد)
        const pChildrenRaw = [
          (m as any).pAcceptChildren,
          (m as any).p_accept_children,
          (m as any).acceptWithChildren,
          (m as any).acceptChildren,
        ].filter(Boolean).join(' ').toLowerCase().trim();

        const isNoMatter = !pChildrenRaw || ['لا يهم', 'الجميع', 'كل', 'all', 'any', 'غير محدد', 'لا مانع'].some(k => pChildrenRaw.includes(k));
        const isNoChildren = ['لا (أفضل بدون أطفال)', 'بدون أطفال', 'بدون اطفال', 'يرفض أطفال', 'يرفض اطفال', 'أفضل بدون أطفال'].some(k => pChildrenRaw.includes(k)) ||
          pChildrenRaw === 'لا' || pChildrenRaw === 'no' || pChildrenRaw === 'false' || (pChildrenRaw.includes('بدون') && !pChildrenRaw.includes('لا يهم'));
        const isYesChildren = ['نعم', 'yes', 'true', 'يقبل', 'أقبل'].some(k => pChildrenRaw.includes(k)) && !pChildrenRaw.includes('بشرط') && !pChildrenRaw.includes('بشروط');
        const isConditional = ['شرط', 'شروط', 'بشرط ألا يعيشوا معنا', 'أقبل بشروط', 'اقبل بشروط'].some(k => pChildrenRaw.includes(k));

        const matchPartnerChildren = filterPartnerChildren.length === 0 || filterPartnerChildren.some(pc => {
          if (pc === 'no') return isNoChildren;
          if (pc === 'yes') return isYesChildren || isNoMatter;
          if (pc === 'no_matter') return isNoMatter;
          if (pc === 'conditional') return isConditional;
          return pChildrenRaw.includes(pc.toLowerCase());
        });

        return matchSearch && matchStatus && matchPlan && matchFlag && matchSource && matchOffice && matchBatch && matchImportDate &&
               matchCompleteness && matchBadge && matchGender && matchSect && matchNationality && matchCountry && matchCity &&
               matchMaritalStatus && matchMarriageType && matchCustomList && matchTribe && matchAgeMin && matchAgeMax && matchHeightMin && matchHeightMax &&
               matchWeightMin && matchWeightMax && matchEducation && matchOccupation && matchHealth && matchSmoking && matchVerification &&
               matchPartnerNationality && matchPartnerMarital && matchPartnerCity && matchPartnerAge && matchPartnerChildren;
      });
    },
    [
      members, search, filterStatus, filterPlan, onlyFlagged, filterSource, filterOffice, filterOfficeMulti, filterBatch, filterBatchMulti, filterImportDate, filterImportDateMulti, filterCompleteness, filterBadge, filterCustomList, filterCustomListMulti, customLists,
      filterGender, filterSect, filterNationality, filterCountry, filterCity, filterMaritalStatus, filterMarriageType, filterTribe,
      filterAgeMin, filterAgeMax, filterHeightMin, filterHeightMax, filterWeightMin, filterWeightMax, filterEducation, filterOccupation, filterHealth, filterSmoking, filterVerification,
      filterPartnerMarital, filterPartnerNationality, filterPartnerCity, filterPartnerAgeMin, filterPartnerAgeMax, filterPartnerChildren
    ]
  );

  const effectivePageSize = pageSize === PAGE_SIZE_ALL ? (filtered.length || 1) : (pageSize || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize));
  const paginated = pageSize === PAGE_SIZE_ALL ? filtered : filtered.slice((page - 1) * effectivePageSize, page * effectivePageSize);
  const showingFrom = filtered.length === 0 ? 0 : (page - 1) * effectivePageSize + 1;
  const showingTo = Math.min(page * effectivePageSize, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [
    search, filterStatus, filterPlan, onlyFlagged, filterSource, filterOffice, filterOfficeMulti, filterBatch, filterBatchMulti, filterImportDate, filterImportDateMulti, filterCompleteness, filterBadge, filterCustomList, filterCustomListMulti,
    filterGender, filterSect, filterNationality, filterCountry, filterCity, filterMaritalStatus, filterMarriageType, filterTribe,
    filterAgeMin, filterAgeMax, filterHeightMin, filterHeightMax, filterWeightMin, filterWeightMax, filterEducation, filterOccupation, filterHealth, filterSmoking, filterVerification,
    filterPartnerMarital, filterPartnerNationality, filterPartnerCity, filterPartnerAgeMin, filterPartnerAgeMax, filterPartnerChildren, pageSize
  ]);

  // ===== قائمة إجراءات العضو بالجدول =====
  const getMemberActionItems = (m: AdminMemberRow): ActionItem[] => {
    const memberLive = liveMembersMap.get(m.id) || m;
    const hasSeriousness = !!(memberLive?.hasSeriousnessBadge || (m as any).hasSeriousnessBadge);
    return [
      {
        label: 'عرض التفاصيل والبيانات',
        icon: <Eye className="w-3.5 h-3.5 text-slate-500" />,
        onClick: () => { setSelected(m); setIsEditing(false); },
      },
      {
        label: 'تعديل بيانات الحساب',
        icon: <Edit className="w-3.5 h-3.5 text-amber-600" />,
        onClick: () => openEditModal(m),
      },
      {
        label: 'تسجيل الدخول بالحساب',
        icon: <LogIn className="w-3.5 h-3.5 text-blue-600" />,
        onClick: () => impersonateAndGo(m),
      },
      {
        label: 'إسناد / إدارة القوائم المخصصة',
        icon: <Users className="w-3.5 h-3.5 text-amber-600" />,
        onClick: () => {
          setAssignTargetMemberIds([m.id]);
          setShowAssignListModal(true);
        },
      },
      {
        label: m.pinned ? 'إلغاء التثبيت' : 'تثبيت العضو في البداية',
        icon: <Pin className={`w-3.5 h-3.5 ${m.pinned ? 'text-amber-500' : 'text-slate-400'}`} />,
        onClick: () => bulkSetPinned([m.id], !m.pinned),
        divider: true,
      },
      {
        label: m.verified ? 'إلغاء التوثيق' : 'توثيق الحساب بالهوية',
        icon: <ShieldCheck className={`w-3.5 h-3.5 ${m.verified ? 'text-emerald-600' : 'text-slate-400'}`} />,
        onClick: () => toggleVerified(m.id),
      },
      {
        label: hasSeriousness ? 'سحب وسام الجدية' : 'منح وسام الجدية 🏅',
        icon: <Award className={`w-3.5 h-3.5 ${hasSeriousness ? 'text-amber-500' : 'text-slate-400'}`} />,
        onClick: () => bulkSetSeriousnessBadge([m.id], !hasSeriousness),
      },
      {
        label: 'إرسال إشعار خَاص',
        icon: <Send className="w-3.5 h-3.5 text-indigo-600" />,
        onClick: () => setNotifyFor(m),
        divider: true,
      },
      {
        label: m.status === 'active' ? 'إيقاف الحساب مؤقتاً' : 'تفعيل الحساب',
        icon: m.status === 'active' ? <Ban className="w-3.5 h-3.5 text-orange-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        onClick: () => {
          if (m.status === 'active') {
            setStatusFor({ member: m, status: 'suspended' });
            setStatusReasonDraft(m.statusReason || '');
          } else {
            updateMember(m.id, { status: 'active' });
            showLocalToast('تم تفعيل الحساب ✓');
          }
        },
      },
      {
        label: 'حظر نهائي',
        icon: <UserX className="w-3.5 h-3.5 text-rose-600" />,
        onClick: () => {
          setStatusFor({ member: m, status: 'banned' });
          setStatusReasonDraft(m.statusReason || '');
        },
        variant: 'danger',
      },
      {
        label: 'حذف العضو نهائياً',
        icon: <Trash2 className="w-3.5 h-3.5 text-red-600" />,
        onClick: () => setDeleteFor(m),
        variant: 'danger',
        divider: true,
      },
    ];
  };

  // ===== منطق التحديد المتعدد الإداري =====
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // هل كل الصفحة المعروضة محدّدة؟
  const allPageSelected = paginated.length > 0 && paginated.every((m) => selectedIds.has(m.id));
  // هل كل النتائج المفلترة محدّدة؟
  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selectedIds.has(m.id));
  // هل توجد نتائج خارج الصفحة الحالية غير محدّدة؟
  const hasMoreBeyondPage = filtered.length > paginated.length && filtered.some((m) => !selectedIds.has(m.id));

  // تحديد/إلغاء تحديد الصفحة المعروضة فقط
  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      if (allPageSelected) {
        const next = new Set(prev);
        paginated.forEach((m) => next.delete(m.id));
        return next;
      }
      const next = new Set(prev);
      paginated.forEach((m) => next.add(m.id));
      return next;
    });
  };

  // تحديد أول 10 أعضاء من النتائج المفلترة
  const selectTenMembers = () => {
    const ten = filtered.slice(0, 10);
    setSelectedIds(new Set(ten.map((m) => m.id)));
  };

  // تحديد/إلغاء تحديد كل النتائج المفلترة
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        return new Set();
      }
      return new Set(filtered.map((m) => m.id));
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectedCount = selectedIds.size;

  // تنفيذ الإجراء الجماعي المباشر والفوري (Optimistic Execution)
  const runBulk = async () => {
    if (!bulkConfirm) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { setBulkConfirm(null); return; }
    
    // إخفاء التحديد وإغلاق النافذة فوراً دون أي تأخير
    const currentAction = bulkConfirm;
    setBulkConfirm(null);
    clearSelection();
    setBulkBusy(true);

    let ok = false;
    const needsReason = currentAction.action === 'ban' || currentAction.action === 'suspend';
    const reason = needsReason ? bulkReason.trim() : '';
    setBulkReason('');

    switch (currentAction.action) {
      case 'ban': ok = await bulkUpdateStatus(ids, 'banned', reason); break;
      case 'suspend': ok = await bulkUpdateStatus(ids, 'suspended', reason); break;
      case 'activate': ok = await bulkUpdateStatus(ids, 'active'); break;
      case 'verify': ok = await bulkSetVerified(ids, true); break;
      case 'pin': ok = await bulkSetPinned(ids, true); break;
      case 'unpin': ok = await bulkSetPinned(ids, false); break;
      case 'plan_elite': ok = await bulkSetPlan(ids, 'elite'); break;
      case 'plan_gold': ok = await bulkSetPlan(ids, 'gold'); break;
      case 'plan_free': ok = await bulkSetPlan(ids, 'free'); break;
      case 'grant_badge': ok = await bulkSetSeriousnessBadge(ids, true); break;
      case 'revoke_badge': ok = await bulkSetSeriousnessBadge(ids, false); break;
      case 'delete': ok = await bulkDelete(ids); break;
    }
    setBulkBusy(false);
    if (ok) {
      showLocalToast(`تم تطبيق "${currentAction.label}" على ${ids.length} عضو بنجاح ✓`);
    } else {
      showToast('تعذّر تنفيذ الإجراء الجماعي', 'error');
    }
  };

  // تغيير حالة فردية بسبب
  const applyStatusChange = async () => {
    if (!statusFor) return;
    const ok = await updateMember(statusFor.member.id, { status: statusFor.status, statusReason: statusReasonDraft.trim() });
    if (ok) showLocalToast(`تم تحديث حالة ${statusFor.member.nickname} ✓`);
    setStatusFor(null);
    setStatusReasonDraft('');
  };

  const handleExport = () => {
    const headers = [
      'المعرّف', 'الاسم المستعار', 'الاسم الحقيقي', 'البريد', 'كلمة المرور', 'رقم الواتساب',
      'الهوية', 'الجنس', 'العمر', 'المدينة', 'الباقة', 'الحالة', 'موثق', 'تاريخ الانضمام'
    ];
    const rows = filtered.map((m) => [
      m.id, m.nickname, m.realName, m.email, (m as any).password || (m as any).pass || '', m.whatsapp || m.phone || '—', m.nationalId, m.gender === 'male' ? 'ذكر' : 'أنثى',
      m.age, m.city, m.plan, m.status, m.verified ? 'نعم' : 'لا', m.joinedAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `members-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showLocalToast(`تم تصدير ${filtered.length} عضو ✓`);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) {
        showToast('البيانات المدخلة غير صالحة، يجب أن تكون مصفوفة JSON', 'error');
        return;
      }
      if (parsed.length === 0) {
        showToast('لم يتم العثور على أعضاء في البيانات', 'error');
        return;
      }
      const batchId = 'batch_json_' + Date.now();
      const valid = parsed.map((item, idx) => prepareImportedMember(item, batchId, 'استيراد JSON مباشر', new Date().toISOString(), '', idx + 1));
      importMembers(valid as any);
      setImportOpen(false);
      setImportText('');
      showToast(`تم استيراد ${valid.length} عضو بنجاح`, 'success');
    } catch {
      showToast('حدث خطأ أثناء الاستيراد. تأكد من صحة تنسيق JSON.', 'error');
    }
  };

  if (error && members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
        <p className="font-cairo text-slate-700 font-bold">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-slate-950 via-navy-900 to-slate-800 p-5 sm:p-6 shadow-luxe">
        <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="absolute inset-0 pattern-islamic opacity-30" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-cairo font-bold text-amber-200"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> بيانات الأعضاء الحية</div>
            <h2 className="font-cairo font-black text-2xl text-white flex items-center gap-2"><Users className="w-6 h-6 text-amber-300" /> مركز إدارة الأعضاء</h2>
            <p className="mt-1 text-sm text-slate-300 font-tajawal">ابحث، راجع، صنّف، ونفذ الإجراءات من مساحة عمل واحدة واضحة.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <div><p className="text-[10px] font-cairo text-slate-400">إجمالي الأعضاء</p><p className="font-cairo text-xl font-black text-white">{stats.total}</p></div>
            <div className="border-x border-white/10 px-3"><p className="text-[10px] font-cairo text-slate-400">بانتظار المراجعة</p><p className="font-cairo text-xl font-black text-amber-300">{stats.pending}</p></div>
            <div><p className="text-[10px] font-cairo text-slate-400">بلاغات معلّمة</p><p className="font-cairo text-xl font-black text-rose-300">{stats.flagged}</p></div>
          </div>
        </div>
      </section>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-tajawal"><span className="h-2 w-2 rounded-full bg-emerald-500" /> آخر مزامنة من قاعدة البيانات</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { refresh(); showLocalToast('تم تحديث قائمة الأعضاء'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-100 text-sky-700 font-cairo font-semibold text-xs hover:bg-sky-200 transition-colors"
            title="تحديث لعرض آخر تعديلات الأعضاء"
          >
            <RefreshCw className="w-3.5 h-3.5" /> تحديث
          </button>
          <button
            onClick={() => navigate('/admin/members?tab=khataaba&panel=lists')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-cairo font-bold text-xs hover:bg-amber-200 transition-colors shadow-2xs"
            title="إدارة القوائم والتصنيفات المخصصة للأعضاء"
          >
            <List className="w-3.5 h-3.5 text-amber-700" /> القوائم والتصنيفات ({customLists.length})
          </button>
          <button
            onClick={() => { handleQuickAddRandom(); setQuickAddOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white font-cairo font-bold text-xs hover:bg-amber-600 transition-colors shadow-2xs"
          >
            <UserPlus className="w-3.5 h-3.5" /> إضافة عضو جديد
          </button>
          <button
            onClick={() => navigate('/admin/members?tab=import')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-cairo font-semibold text-xs hover:bg-emerald-200 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> استيراد أعضاء
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-cairo font-semibold text-xs hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> تصدير ({filtered.length})
          </button>
        </div>
      </div>

      {/* Stats - Compact Micro-Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        {[
          { label: 'الإجمالي', value: stats.total, icon: Users, color: 'text-slate-800', bg: 'bg-white border-slate-200 hover:bg-slate-50', onClick: () => { setFilterStatus('all'); setOnlyFlagged(false); setFilterSource('all'); } },
          { label: 'مسجلون', value: stats.registered, icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-50/50 border-blue-100 hover:bg-blue-50', onClick: () => setFilterSource('registered') },
          { label: 'مستوردون', value: stats.imported, icon: Import, color: 'text-purple-600', bg: 'bg-purple-50/50 border-purple-100 hover:bg-purple-50', onClick: () => setFilterSource('imported') },
          { label: 'نشط', value: stats.active, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50', onClick: () => setFilterStatus('active') },
          { label: 'مراجعة', value: stats.pending, icon: Loader2, color: 'text-amber-600', bg: 'bg-amber-50/50 border-amber-100 hover:bg-amber-50', onClick: () => setFilterStatus('pending') },
          { label: 'موثق', value: stats.verified, icon: BadgeCheck, color: 'text-sky-600', bg: 'bg-sky-50/50 border-sky-100 hover:bg-sky-50', onClick: () => {} },
          { label: 'مميّز', value: stats.premium, icon: Crown, color: 'text-indigo-600', bg: 'bg-indigo-50/50 border-indigo-100 hover:bg-indigo-50', onClick: () => setFilterPlan('gold') },
          { label: 'معلّم', value: stats.flagged, icon: Flag, color: 'text-rose-600', bg: 'bg-rose-50/50 border-rose-100 hover:bg-rose-50', onClick: () => setOnlyFlagged(true) },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={s.onClick}
              className={`${s.bg} rounded-2xl px-3 py-3 text-right border shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between gap-1.5 cursor-pointer`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${s.color}`} />
                <span className="text-[11px] text-slate-600 font-cairo font-bold truncate">{s.label}</span>
              </div>
              <span className={`font-cairo font-black text-lg ${s.color}`}>{s.value}</span>
            </button>
          );
        })}
      </div>

      {/* Filters - Compact & High Efficiency */}
      <div className="admin-surface rounded-2xl p-3 sm:p-4 space-y-3 relative z-30">
        <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم المستعار، الحقيقي، البريد، الهاتف، أو الهوية..."
              className="w-full pr-9 pl-3 py-1.5 rounded-lg bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-amber-400 focus:outline-none font-tajawal text-xs text-slate-900 transition-all h-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <FilterDropdown
              label="الحالة:"
              value={filterStatus}
              onChange={(v) => setFilterStatus(v as typeof filterStatus)}
              options={(['all', 'active', 'pending', 'suspended', 'banned', 'deleted'] as const).map((s) => ({
                value: s,
                label: s === 'all' ? 'كل الحالات' : getStatusCfg(s).label,
              }))}
            />
            <FilterDropdown
              label="الباقة:"
              value={filterPlan}
              onChange={(v) => setFilterPlan(v as typeof filterPlan)}
              options={(['all', 'free', 'gold', 'elite'] as const).map((p) => ({
                value: p,
                label: p === 'all' ? 'كل الباقات' : getPlanCfg(p).label,
              }))}
            />
            <FilterDropdown
              label="النوع:"
              value={filterSource}
              onChange={(v) => setFilterSource(v as typeof filterSource)}
              options={[
                { value: 'all', label: 'كل الأعضاء' },
                { value: 'registered', label: 'مسجلون' },
                { value: 'imported', label: 'مستوردون' },
              ]}
            />
            <button
              type="button"
              onClick={() => setCustomListsOpen((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-cairo font-bold transition-colors flex items-center gap-1.5 border h-8 cursor-pointer ${
                customListsOpen || filterCustomList !== 'all' || filterCustomListMulti.length > 0
                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs font-black'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="إظهار / إخفاء شريط القوائم المخصصة"
            >
              <List className="w-3.5 h-3.5 text-amber-600" />
              <span>القوائم المخصصة</span>
              {filterCustomList !== 'all' && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
            <button
              onClick={() => setAdvancedFiltersOpen((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-cairo font-bold transition-colors flex items-center gap-1.5 border h-8 cursor-pointer ${
                advancedFiltersOpen || activeFilterCount > 0 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> خيارات إضافية
              {activeFilterCount > 0 && <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300 text-[10px] font-black">{activeFilterCount}</span>}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={resetAllFilters}
                className="px-2.5 py-1.5 rounded-lg text-xs font-cairo font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors h-8 cursor-pointer"
              >
                تصفير
              </button>
            )}

            {/* View Mode Switcher (Grid vs Table) */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 h-8">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-md text-xs font-cairo font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="عرض قائمة مختصرة (جدول)"
              >
                <Table className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">قائمة</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-md text-xs font-cairo font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-amber-500 text-slate-950 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="عرض شبكة بطاقات (نفس الصفحة الرئيسية)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">شبكة كروت</span>
              </button>
            </div>
          </div>
        </div>

        {/* شريط القوائم المخصصة السريع (Custom Lists Quick Strip - قابل للطي والإظهار) */}
        <AnimatePresence initial={false}>
          {(customListsOpen || filterCustomList !== 'all') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1 text-[11px] font-cairo font-bold text-slate-500 pl-1">
                  <List className="w-3.5 h-3.5 text-amber-500" />
                  <span>القوائم المخصصة:</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterCustomList('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-cairo font-bold transition-all cursor-pointer ${
                    filterCustomList === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  كل الأعضاء ({members.length})
                </button>
                {customLists.map((l) => {
                  const colorStyles = getListColorStyles(l.color);
                  const count = members.filter((m) => isMemberInCustomList(m, l.id) || isMemberInCustomList(m, l.name)).length;
                  const isActive = filterCustomList === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setFilterCustomList(isActive ? 'all' : l.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-cairo font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'ring-2 ring-amber-500 ring-offset-1 shadow-2xs scale-[1.02]'
                          : 'opacity-90 hover:opacity-100 hover:shadow-2xs'
                      }`}
                      style={{
                        backgroundColor: colorStyles.bg,
                        color: colorStyles.text,
                        borderColor: colorStyles.border,
                      }}
                      title={l.description || l.name}
                    >
                      <span className={`w-2 h-2 rounded-full ${colorStyles.dot}`} />
                      <span>{l.name}</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-white/80 text-[10px] font-bold">
                        {count}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowCustomListsModal(true)}
                  className="px-2 py-1 rounded-lg text-xs font-cairo font-bold text-amber-700 bg-amber-50 border border-dashed border-amber-300 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer mr-auto"
                  title="إنشاء قائمة جديدة أو تعديل وتخصيص القوائم"
                >
                  <Plus className="w-3.5 h-3.5" /> قائمة جديدة / إدارة
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsible Comprehensive Additional Filters Panel */}
        <AnimatePresence initial={false}>
          {advancedFiltersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="border-t border-slate-100 pt-3 mt-2 font-tajawal overflow-visible"
            >
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                    <span className="font-cairo font-bold text-xs text-slate-800">
                      خيارات الفلترة والبحث المتقدم الشاملة
                    </span>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetAllFilters}
                      className="px-2.5 py-1 rounded-lg text-xs font-cairo font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> تصفير كل الفلاتر ({activeFilterCount})
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* قسم 1: بيانات العضو الشخصية */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-cairo font-bold text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>بيانات العضو الشخصية (يمكن تحديد خيارات متعددة):</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {/* الجنس */}
                      <MultiSelectFilter
                        label="الجنس"
                        options={[
                          { value: 'male', label: 'ذكر 👨' },
                          { value: 'female', label: 'أنثى 👩' },
                        ]}
                        selectedValues={filterGender}
                        onChange={setFilterGender}
                        placeholder="الكل (ذكور وإناث)"
                      />

                      {/* الدولة */}
                      <MultiSelectFilter
                        label="الدولة"
                        options={safeGetCountries().map((c) => ({ value: c.name, label: c.name + (c.isPending ? ' (مقترح معلق)' : '') }))}
                        selectedValues={filterCountry}
                        onChange={setFilterCountry}
                        placeholder="كل الدول"
                        searchPlaceholder="بحث عن دولة..."
                      />

                      {/* المدينة */}
                      <MultiSelectFilter
                        label="المدينة"
                        options={safeGetCities(filterCountry).map((ct) => ({ value: ct.name, label: ct.name + (ct.isPending ? ' (مقترح معلق)' : '') }))}
                        selectedValues={filterCity}
                        onChange={setFilterCity}
                        placeholder="كل المدن"
                        searchPlaceholder="بحث عن مدينة..."
                      />

                      {/* الجنسية */}
                      <MultiSelectFilter
                        label="الجنسية"
                        options={getUnifiedNationalities().map((n) => ({ value: n, label: n }))}
                        selectedValues={filterNationality}
                        onChange={setFilterNationality}
                        placeholder="كل الجنسيات"
                        searchPlaceholder="بحث عن جنسية..."
                      />

                      {/* المذهب */}
                      <MultiSelectFilter
                        label="المذهب"
                        options={getUnifiedSects().map((s) => ({ value: s, label: s }))}
                        selectedValues={filterSect}
                        onChange={setFilterSect}
                        placeholder="كل المذاهب"
                        searchPlaceholder="بحث عن مذهب..."
                      />

                      {/* الحالة الاجتماعية */}
                      <MultiSelectFilter
                        label="الحالة الاجتماعية"
                        options={[
                          { value: 'single', label: 'أعزب / عزباء' },
                          { value: 'divorced', label: 'مطلق / مطلقة' },
                          { value: 'widow', label: 'أرمل / أرملة' },
                          { value: 'married', label: 'متزوج / متزوجة' },
                        ]}
                        selectedValues={filterMaritalStatus}
                        onChange={setFilterMaritalStatus}
                        placeholder="كل الحالات الاجتماعية"
                      />

                      {/* نوع الزواج */}
                      <MultiSelectFilter
                        label="نوع الزواج المفضل"
                        options={[
                          { value: 'announced', label: 'زواج معلن (يشمل من يقبل كلاهما)' },
                          { value: 'misyar', label: 'زواج مسيار (يشمل من يقبل كلاهما)' },
                          { value: 'both', label: 'يقبل المعلن والمسيار معاً' },
                        ]}
                        selectedValues={filterMarriageType}
                        onChange={setFilterMarriageType}
                        placeholder="كل أنواع الزواج"
                      />

                      {/* القائمة المخصصة */}
                      <MultiSelectFilter
                        label="القائمة المخصصة"
                        options={customLists.map((l) => {
                          const count = members.filter((m) => isMemberInCustomList(m, l.id) || isMemberInCustomList(m, l.name)).length;
                          return { value: l.id, label: `${l.name} (${count})` };
                        })}
                        selectedValues={filterCustomListMulti}
                        onChange={setFilterCustomListMulti}
                        placeholder="كل القوائم المخصصة"
                        searchPlaceholder="بحث عن قائمة..."
                      />

                      {/* القبيلة / النسب */}
                      <div>
                        <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">القبيلة / النسب</label>
                        <input
                          type="text"
                          value={filterTribe}
                          onChange={(e) => setFilterTribe(e.target.value)}
                          placeholder="اسم القبيلة..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-amber-500 focus:outline-none font-tajawal h-[34px]"
                        />
                      </div>

                      {/* التعليم */}
                      <MultiSelectFilter
                        label="المستوى التعليمي"
                        options={getUnifiedEducationLevels().map((ed) => ({ value: ed, label: ed }))}
                        selectedValues={filterEducation}
                        onChange={setFilterEducation}
                        placeholder="كل المستويات التعليمية"
                        searchPlaceholder="بحث عن مؤهل..."
                      />

                      {/* قطاع العمل */}
                      <MultiSelectFilter
                        label="قطاع العمل / الوظيفة"
                        options={getUnifiedWorkTypes().map((wt) => ({ value: wt, label: wt }))}
                        selectedValues={filterOccupation}
                        onChange={setFilterOccupation}
                        placeholder="كل القطاعات"
                        searchPlaceholder="بحث عن قطاع..."
                      />

                      {/* الحالة الصحية */}
                      <MultiSelectFilter
                        label="الحالة الصحية"
                        options={C.HEALTH_STATUS.map((h) => ({ value: h, label: h }))}
                        selectedValues={filterHealth}
                        onChange={setFilterHealth}
                        placeholder="كل الحالات الصحية"
                        searchPlaceholder="بحث عن حالة صحية..."
                      />

                      {/* التدخين */}
                      <MultiSelectFilter
                        label="التدخين"
                        options={getUnifiedSmokingOptions().map((sm) => ({ value: sm, label: sm }))}
                        selectedValues={filterSmoking}
                        onChange={setFilterSmoking}
                        placeholder="كل خيارات التدخين"
                      />

                      {/* التوثيق */}
                      <div>
                        <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">التوثيق بالهوية</label>
                        <select
                          value={filterVerification}
                          onChange={(e) => setFilterVerification(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-cairo font-semibold focus:border-amber-500 focus:outline-none h-[34px]"
                        >
                          <option value="all">الكل</option>
                          <option value="verified">موثق بالهوية ✓</option>
                          <option value="unverified">غير موثق</option>
                        </select>
                      </div>

                      {/* اكتمال الملف */}
                      <div>
                        <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">اكتمال الملف</label>
                        <select
                          value={filterCompleteness}
                          onChange={(e) => setFilterCompleteness(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-cairo font-semibold focus:border-amber-500 focus:outline-none h-[34px]"
                        >
                          <option value="all">كل المستويات</option>
                          <option value="complete">مكتمل</option>
                          <option value="incomplete">غير مكتمل</option>
                        </select>
                      </div>

                      {/* وسام الجدية */}
                      <div>
                        <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">وسام الجدية</label>
                        <select
                          value={filterBadge}
                          onChange={(e) => setFilterBadge(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-cairo font-semibold focus:border-amber-500 focus:outline-none h-[34px]"
                        >
                          <option value="all">كل الأعضاء</option>
                          <option value="has">حاصل على الوسام 🏅</option>
                          <option value="none">بدون وسام</option>
                        </select>
                      </div>

                      {/* الأعضاء المعلمون */}
                      <div>
                        <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">علامة المتابعة</label>
                        <button
                          type="button"
                          onClick={() => setOnlyFlagged((v) => !v)}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-cairo font-bold transition-colors flex items-center justify-center gap-1.5 border h-[34px] cursor-pointer ${
                            onlyFlagged ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span>{onlyFlagged ? 'المعلّمون فقط (نشط)' : 'عرض المعلّمين فقط'}</span>
                        </button>
                      </div>

                      {/* نطاق العمر */}
                      <div>
                        <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">نطاق العمر (سنة)</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={filterAgeMin}
                            onChange={(e) => setFilterAgeMin(e.target.value)}
                            placeholder="من 16"
                            className="w-1/2 px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-amber-500 focus:outline-none h-[34px]"
                          />
                          <span className="text-slate-400 font-bold text-xs">-</span>
                          <input
                            type="number"
                            value={filterAgeMax}
                            onChange={(e) => setFilterAgeMax(e.target.value)}
                            placeholder="إلى 80"
                            className="w-1/2 px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-amber-500 focus:outline-none h-[34px]"
                          />
                        </div>
                      </div>

                      {/* نطاق الطول */}
                      <div>
                        <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">نطاق الطول (سم)</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={filterHeightMin}
                            onChange={(e) => setFilterHeightMin(e.target.value)}
                            placeholder="من"
                            className="w-1/2 px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-amber-500 focus:outline-none h-[34px]"
                          />
                          <span className="text-slate-400 font-bold text-xs">-</span>
                          <input
                            type="number"
                            value={filterHeightMax}
                            onChange={(e) => setFilterHeightMax(e.target.value)}
                            placeholder="إلى"
                            className="w-1/2 px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-amber-500 focus:outline-none h-[34px]"
                          />
                        </div>
                      </div>

                      {/* نطاق الوزن */}
                      <div>
                        <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">نطاق الوزن (كجم)</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={filterWeightMin}
                            onChange={(e) => setFilterWeightMin(e.target.value)}
                            placeholder="من"
                            className="w-1/2 px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-amber-500 focus:outline-none h-[34px]"
                          />
                          <span className="text-slate-400 font-bold text-xs">-</span>
                          <input
                            type="number"
                            value={filterWeightMax}
                            onChange={(e) => setFilterWeightMax(e.target.value)}
                            placeholder="إلى"
                            className="w-1/2 px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-amber-500 focus:outline-none h-[34px]"
                          />
                        </div>
                      </div>

                      {/* خيارات الاستيراد إن وجدت */}
                      {offices.length > 0 && (
                        <MultiSelectFilter
                          label="مكتب الخطابة"
                          options={offices.map((o) => ({ value: o, label: o }))}
                          selectedValues={filterOfficeMulti}
                          onChange={setFilterOfficeMulti}
                          placeholder="كل الخطابات"
                          searchPlaceholder="بحث عن مكتب..."
                        />
                      )}

                      {batches.length > 0 && (
                        <MultiSelectFilter
                          label="رقم الدفعة"
                          options={batches.map((bId) => ({ value: bId, label: batchMap.get(bId) || bId }))}
                          selectedValues={filterBatchMulti}
                          onChange={setFilterBatchMulti}
                          placeholder="كل الدفعات"
                          searchPlaceholder="بحث عن دفعة..."
                        />
                      )}

                      {importDates.length > 0 && (
                        <MultiSelectFilter
                          label="تاريخ الاستيراد"
                          options={importDates.map((d) => ({ value: d, label: d }))}
                          selectedValues={filterImportDateMulti}
                          onChange={setFilterImportDateMulti}
                          placeholder="كل التواريخ"
                          searchPlaceholder="بحث عن تاريخ..."
                        />
                      )}
                    </div>
                  </div>

                  {/* قسم 2: مواصفات الشريك المطلوبة (فلاتر متقدمة) */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-200/80">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-cairo font-bold text-amber-900">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>فلاتر مواصفات الشريك المطلوبة:</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-tajawal">
                        (مدن الشريك تتبع الدول المحددة في فلاتر العضو | من اختار "لا يهم" يظهر في النتائج)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 bg-amber-50/40 p-3 rounded-xl border border-amber-200/60">
                      {/* جنسية الشريك المطلوبة (مع خيار قبول أجنبي) */}
                      <MultiSelectFilter
                        label="جنسية الشريك المطلوبة"
                        options={[
                          { value: 'any_foreigner', label: 'قبول أجنبي (لا يهم / جنسية أخرى / دول متعددة)' },
                          ...getUnifiedNationalities().map((n) => ({ value: n, label: n })),
                        ]}
                        selectedValues={filterPartnerNationality}
                        onChange={setFilterPartnerNationality}
                        placeholder="كل الجنسيات المطلوبة"
                        searchPlaceholder="بحث عن جنسية..."
                      />

                      {/* الحالة الاجتماعية المقبولة للشريك (أعزب / مطلق / أرمل / معدد) */}
                      <MultiSelectFilter
                        label="حالة الشريك الاجتماعية المقبولة"
                        options={[
                          { value: 'accept_all', label: 'يقبل الجميع (لا يهم / أي حالة)' },
                          { value: 'single', label: 'يقبل أعزب / عزباء (يشمل من يقبل الجميع)' },
                          { value: 'divorced', label: 'يقبل مطلق / مطلقة (يشمل من يقبل الجميع)' },
                          { value: 'widow', label: 'يقبل أرمل / أرملة (يشمل من يقبل الجميع)' },
                          { value: 'married', label: 'يقبل متزوج / معدد (يشمل من يقبل الجميع)' },
                        ]}
                        selectedValues={filterPartnerMarital}
                        onChange={setFilterPartnerMarital}
                        placeholder="كل الحالات المقبولة"
                      />

                      {/* قبول أطفال لدى الشريك (تحديد متعدد متناسق مع باقي الفلاتر) */}
                      <MultiSelectFilter
                        label="قبول أطفال لدى الشريك"
                        options={[
                          { value: 'no', label: 'لا (يفضل بدون أطفال)' },
                          { value: 'yes', label: 'نعم (يقبل وجود أطفال)' },
                          { value: 'no_matter', label: 'لا يهم (يقبل الجميع)' },
                          { value: 'conditional', label: 'بشرط ألا يعيشوا معنا / بشروط' },
                        ]}
                        selectedValues={filterPartnerChildren}
                        onChange={setFilterPartnerChildren}
                        placeholder="كل خيارات الأطفال"
                      />

                      {/* مدينة الشريك المطلوبة — مدن الدول المختارة فقط في فلاتر العضو */}
                      <div>
                        <MultiSelectFilter
                          label="مدينة الشريك المطلوبة"
                          options={partnerCityOptions.map((ct) => ({ value: ct.name, label: ct.name + (ct.isPending ? ' (مقترح معلق)' : '') }))}
                          selectedValues={filterPartnerCity}
                          onChange={setFilterPartnerCity}
                          placeholder={filterCountry.length === 0 ? "حدد الدولة في فلاتر العضو أولاً" : "كل مدن الدول المحددة"}
                          searchPlaceholder="بحث عن مدينة..."
                          disabled={filterCountry.length === 0}
                        />
                        {filterCountry.length === 0 && (
                          <span className="text-[9.5px] text-amber-700 font-tajawal mt-0.5 block">
                            ⚠️ تظهر مدن الدول المحددة في فلاتر العضو أعلاه
                          </span>
                        )}
                      </div>

                      {/* نطاق عمر الشريك المطلوب */}
                      <div>
                        <label className="block text-[11px] font-cairo font-bold text-slate-700 mb-1">نطاق عمر الشريك المطلوب</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={filterPartnerAgeMin}
                            onChange={(e) => setFilterPartnerAgeMin(e.target.value)}
                            placeholder="الحد الأدنى"
                            className="w-1/2 px-2 py-1.5 rounded-lg bg-white border border-amber-200 text-xs focus:border-amber-500 focus:outline-none h-[34px]"
                          />
                          <span className="text-slate-400 font-bold text-xs">-</span>
                          <input
                            type="number"
                            value={filterPartnerAgeMax}
                            onChange={(e) => setFilterPartnerAgeMax(e.target.value)}
                            placeholder="الحد الأقصى"
                            className="w-1/2 px-2 py-1.5 rounded-lg bg-white border border-amber-200 text-xs focus:border-amber-500 focus:outline-none h-[34px]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-200/80">
                  <button
                    onClick={resetAllFilters}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-cairo font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> تصفير وإعادة تعيين جميع الفلاتر
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* شريط الإجراءات الجماعية العائم (Floating Bulk Action Dock) */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 backdrop-blur-md bg-slate-900/95 text-white rounded-2xl shadow-2xl border border-slate-700/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 max-w-[95vw] sm:max-w-4xl w-full dir-rtl"
          >
            <div className="flex items-center gap-2">
              <span className="font-cairo font-bold text-xs flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[10px] font-black">{selectedCount}</span>
                عضو محدّد
              </span>

              {/* أزرار التحديد السريع */}
              <button
                type="button"
                onClick={selectTenMembers}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-cairo font-bold transition-colors"
                title="تحديد أول 10 أعضاء مطابقة"
              >
                تحديد 10 أعضاء
              </button>
              <button
                type="button"
                onClick={toggleSelectAll}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-cairo font-bold flex items-center gap-1 transition-colors ${
                  allFilteredSelected ? 'bg-amber-400 text-slate-950' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="تحديد جميع الأعضاء المطابقين بالفلاتر"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{allFilteredSelected ? 'إلغاء تحديد الكل' : `تحديد الكل (${filtered.length})`}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => { setBulkReason(''); setBulkConfirm({ action: 'verify', label: 'توثيق الأعضاء' }); }}
                className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-cairo font-bold flex items-center gap-1 transition-all shadow-2xs">
                <BadgeCheck className="w-3.5 h-3.5" /> توثيق
              </button>
              <button onClick={() => { setBulkReason(''); setBulkConfirm({ action: 'pin', label: 'تثبيت الأعضاء في الصدارة' }); }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-cairo font-bold flex items-center gap-1 transition-all shadow-2xs">
                <Pin className="w-3.5 h-3.5 rotate-45" /> تثبيت
              </button>
              <button onClick={() => { setBulkReason(''); setBulkConfirm({ action: 'unpin', label: 'إلغاء تثبيت الأعضاء' }); }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-cairo font-bold flex items-center gap-1 transition-all">
                <Pin className="w-3.5 h-3.5" /> إلغاء تثبيت
              </button>
              <button
                onClick={() => {
                  setAssignTargetMemberIds(Array.from(selectedIds));
                  setShowAssignListModal(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-cairo font-bold flex items-center gap-1 transition-all shadow-2xs"
              >
                <Users className="w-3.5 h-3.5" /> إسناد لقائمة
              </button>

              {/* خيارات الاشتراكات والأوسمة الجماعية */}
              <div className="relative">
                <button
                  onClick={() => setBulkPlansOpen(!bulkPlansOpen)}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-cairo font-bold flex items-center gap-1 transition-all shadow-2xs"
                >
                  <Crown className="w-3.5 h-3.5 text-purple-100 fill-purple-100/30" /> باقات وأوسمة
                </button>
                {bulkPlansOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setBulkPlansOpen(false)} />
                    <div className="absolute bottom-full mb-2 left-0 z-50 min-w-[210px] bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-100 py-1.5 font-cairo text-right" dir="rtl">
                      <button
                        onClick={() => {
                          setBulkPlansOpen(false);
                          setBulkReason('');
                          setBulkConfirm({ action: 'plan_elite', label: 'منح باقة مميز (Elite)' });
                        }}
                        className="w-full px-4 py-2 text-xs font-bold text-slate-700 hover:bg-purple-50 flex items-center gap-2 transition-colors text-right"
                      >
                        <Star className="w-3.5 h-3.5 text-purple-600 fill-purple-600" /> منح باقة مميز (Elite) ⭐
                      </button>
                      <button
                        onClick={() => {
                          setBulkPlansOpen(false);
                          setBulkReason('');
                          setBulkConfirm({ action: 'plan_gold', label: 'منح باقة ذهبية (Gold)' });
                        }}
                        className="w-full px-4 py-2 text-xs font-bold text-slate-700 hover:bg-amber-50 flex items-center gap-2 transition-colors text-right"
                      >
                        <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-100" /> منح باقة ذهبية (Gold)
                      </button>
                      <button
                        onClick={() => {
                          setBulkPlansOpen(false);
                          setBulkReason('');
                          setBulkConfirm({ action: 'plan_free', label: 'إلغاء باقات الاشتراك (Free)' });
                        }}
                        className="w-full px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors text-right"
                      >
                        <Trash2 className="w-3.5 text-rose-500" /> إلغاء باقات الاشتراك
                      </button>
                      <div className="h-px bg-slate-100 my-1" />
                      <button
                        onClick={() => {
                          setBulkPlansOpen(false);
                          setBulkReason('');
                          setBulkConfirm({ action: 'grant_badge', label: 'منح وسام الجدية' });
                        }}
                        className="w-full px-4 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 transition-colors text-right"
                      >
                        <Award className="w-3.5 h-3.5 text-emerald-500" /> منح وسام الجدية 🏅
                      </button>
                      <button
                        onClick={() => {
                          setBulkPlansOpen(false);
                          setBulkReason('');
                          setBulkConfirm({ action: 'revoke_badge', label: 'سحب وسام الجدية' });
                        }}
                        className="w-full px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-2 transition-colors text-right"
                      >
                        <Award className="w-3.5 h-3.5 text-slate-400" /> سحب وسام الجدية
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button onClick={() => { setBulkReason(''); setBulkConfirm({ action: 'activate', label: 'تفعيل الأعضاء' }); }}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-cairo font-bold flex items-center gap-1 transition-all shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> تفعيل
              </button>
              <button onClick={() => { setBulkReason(''); setBulkConfirm({ action: 'suspend', label: 'إيقاف' }); }}
                className="px-2.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-cairo font-bold flex items-center gap-1 transition-all shadow-2xs">
                <Ban className="w-3.5 h-3.5" /> إيقاف
              </button>
              <button onClick={() => { setBulkReason(''); setBulkConfirm({ action: 'ban', label: 'حظر نهائي' }); }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-cairo font-bold flex items-center gap-1 transition-all shadow-2xs">
                <UserX className="w-3.5 h-3.5" /> حظر نهائي
              </button>
              <button onClick={() => { setBulkReason(''); setBulkConfirm({ action: 'delete', label: 'حذف نهائي' }); }}
                className="px-2.5 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-[11px] font-cairo font-bold flex items-center gap-1 transition-all shadow-2xs">
                <Trash2 className="w-3.5 h-3.5" /> حذف نهائي
              </button>
              <button onClick={clearSelection}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-cairo font-bold transition-colors">
                إلغاء
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid View vs Table View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {paginated.map((m) => {
            const statusCfg = getStatusCfg(m.status);
            const khateebahInfo = getKhateebahInfo(m);

            return (
              <div
                key={`grid-member-${m.id}`}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden relative flex flex-col justify-between ${
                  selectedIds.has(m.id)
                    ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/10'
                    : m.flagged
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Admin Top Header Bar */}
                <div className="p-2.5 px-3.5 bg-slate-900 text-white flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                      className="w-4 h-4 rounded accent-amber-400 cursor-pointer flex-shrink-0"
                      title="تحديد العضو"
                    />
                    <span className="font-mono text-[11px] text-amber-300 font-bold truncate" title="معرف العضو">
                      {m.id}
                    </span>
                    {khateebahInfo.hasInfo && (
                      <span className="bg-purple-900/90 text-purple-200 border border-purple-700/80 text-[10px] px-2 py-0.5 rounded-full font-cairo flex items-center gap-1 font-bold truncate max-w-[220px]" title={`الخطابة المسؤول: ${khateebahInfo.name} ${khateebahInfo.phone}`}>
                        <Building2 className="w-3 h-3 text-purple-300 flex-shrink-0" />
                        <span className="truncate">الخطابة: {khateebahInfo.name}</span>
                        {khateebahInfo.phone && <span className="text-purple-300 font-mono text-[9px] flex-shrink-0 dir-ltr">({khateebahInfo.phone})</span>}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-cairo ${statusCfg.bg} ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(m.id); }}
                      className={`p-1 rounded-md transition-colors ${m.pinned ? 'text-amber-400 bg-amber-400/20' : 'text-slate-400 hover:text-white'}`}
                      title={m.pinned ? 'إلغاء التثبيت' : 'تثبيت العضو في البداية'}
                    >
                      <Pin className="w-3.5 h-3.5 rotate-45" />
                    </button>
                  </div>
                </div>

                {/* Member Card Component */}
                <div className="flex-1 p-1">
                  <MemberCard member={m as any} />
                </div>

                {/* Admin Bottom Footer Action Bar */}
                <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-1.5 text-xs">
                  <div className="flex items-center gap-1.5 flex-1">
                    <button
                      onClick={() => { setSelected(m); setIsEditing(false); }}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-cairo font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-1 cursor-pointer text-[11px]"
                      title="عرض التفاصيل الإدارية"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" /> عرض
                    </button>
                    <button
                      onClick={() => openEditModal(m)}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-cairo font-bold hover:bg-amber-100 transition-colors flex items-center justify-center gap-1 cursor-pointer text-[11px]"
                      title="تعديل العضو"
                    >
                      <Edit className="w-3.5 h-3.5 text-amber-600" /> تعديل
                    </button>
                    <button
                      onClick={() => impersonateAndGo(m)}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-cairo font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1 cursor-pointer text-[11px]"
                      title="تسجيل الدخول بالحساب"
                    >
                      <LogIn className="w-3.5 h-3.5 text-blue-600" /> دخول
                    </button>
                  </div>

                  <ActionMenu items={getMemberActionItems(m)} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* Desktop table */}
      <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="sticky top-14 z-10">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2.5 w-10">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectPage}
                  className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                  title="تحديد الصفحة المعروضة"
                />
              </th>
              {['العضو والبيانات', 'الخطابة / المكتب', 'البريد / الاتصال', 'الباقة', 'الحالة', 'إجراءات'].map((h) => (
                <th key={h} className="text-right px-3 py-2.5 text-[11px] font-cairo font-bold text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paginated.map((m) => {
              const khateebahInfo = getKhateebahInfo(m);
              const details = getRichMemberDetails(m);

              return (
                <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(m.id) ? 'bg-amber-50/50' : m.flagged ? 'bg-rose-50/40' : ''}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                      className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5 ${
                          m.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'
                        }`}
                      >
                        {(m.nickname || m.realName || '؟').charAt(0)}
                        {m.flagged && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white" />}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-cairo font-bold text-slate-900 text-xs">{m.nickname || m.realName || 'بدون اسم'}</span>
                          {m.realName && m.realName !== m.nickname && <span className="text-[10px] text-slate-400">({m.realName})</span>}
                          {m.pinned && <Pin className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0 rotate-45" />}
                          {m.verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />}
                          {m.plan === 'elite' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-cairo font-bold bg-purple-50 text-purple-600 border border-purple-200" title="باقة مميّز">
                              <Star className="w-2.5 h-2.5 fill-purple-500 text-purple-500" /> مميّز
                            </span>
                          )}
                          {m.plan === 'gold' && <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-100" />}
                          {m.isProfileIncomplete && (
                            <span className="px-1.5 py-0.5 text-[9px] font-cairo font-bold bg-amber-100 text-amber-800 rounded select-none">غير مكتمل</span>
                          )}
                        </div>

                        {/* التفاصيل الأساسية والموسعة */}
                        <div className="text-[11px] text-slate-600 font-cairo flex flex-wrap items-center gap-x-2 gap-y-1">
                          {details.nationality && <span className="font-bold text-slate-800">الجنسية: {details.nationality}</span>}
                          {details.location && <span className="text-slate-500">📍 {details.location}</span>}
                          {details.marital && <span className="text-slate-700 font-semibold">{details.marital} {details.age ? `(${details.age})` : ''}</span>}
                          {details.marriageType && <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded text-[10px] font-bold">زواج {details.marriageType}</span>}
                        </div>

                        {/* النسب والعرق والعمل */}
                        {(details.tribe || details.ethnicity || details.job) && (
                          <div className="text-[10px] text-slate-500 font-tajawal flex flex-wrap items-center gap-2">
                            {details.tribe && <span>النسب: <strong className="text-slate-700">{details.tribe}</strong></span>}
                            {details.ethnicity && <span>العرق: <strong className="text-slate-700">{details.ethnicity}</strong></span>}
                            {details.job && <span>العمل: <strong className="text-slate-700">{details.job}</strong></span>}
                          </div>
                        )}

                        {/* القوائم المخصصة */}
                        {(() => {
                          const mLists = getMemberCustomLists(m);
                          if (mLists.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {mLists.map((l) => {
                                const cStyle = getListColorStyles(l.color);
                                return (
                                  <span
                                    key={l.id}
                                    className="px-1.5 py-0.2 rounded text-[9px] font-cairo font-bold border"
                                    style={{
                                      backgroundColor: cStyle.bg,
                                      color: cStyle.text,
                                      borderColor: cStyle.border,
                                    }}
                                  >
                                    🏷️ {l.name}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* مصدر التسجيل ومواصفات الشريك المطلوبة */}
                        {(() => {
                          const partnerInfo = getPartnerSummary(m);
                          const sourceInfo = getMemberSourceAndDate(m);
                          return (
                            <div className="space-y-1 mt-1 pt-1 border-t border-slate-100">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-cairo font-bold ${sourceInfo.badgeClass}`} title={sourceInfo.date ? `تاريخ: ${sourceInfo.date}` : ''}>
                                  {sourceInfo.badgeText}
                                </span>
                                {sourceInfo.date && (
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    {sourceInfo.date}
                                  </span>
                                )}
                              </div>
                              {(partnerInfo.tags.length > 0 || partnerInfo.notes) && (
                                <div className="bg-amber-50/70 rounded-md p-1.5 border border-amber-200/60 text-[10px] font-tajawal text-slate-700 mt-1">
                                  <div className="flex items-center gap-1 font-cairo font-bold text-amber-900 text-[10px] mb-1">
                                    <Heart className="w-3 h-3 text-amber-600 fill-amber-100" />
                                    <span>مواصفات الشريك المطلوب:</span>
                                  </div>
                                  {partnerInfo.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-1">
                                      {partnerInfo.tags.map((t, idx) => (
                                        <span key={idx} className="bg-white px-1.5 py-0.2 rounded text-[9px] font-cairo font-bold border border-amber-200 text-slate-800 shadow-2xs">
                                          {t.label}: {t.value}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {partnerInfo.notes && (
                                    <p className="text-[9px] text-slate-600 line-clamp-2 italic bg-white/60 p-1 rounded border border-amber-100">
                                      "{partnerInfo.notes}"
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {m.username && (
                          <div className="mt-0.5">
                            <a 
                              href={`/u/${m.username}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[10px] text-blue-600 font-mono hover:underline inline-flex items-center gap-0.5"
                            >
                              @{m.username} (رابط الملف)
                            </a>
                          </div>
                        )}

                        {/* ملاحظة إدارية خاصة بالعضو */}
                        {(() => {
                          const note = m.adminNote || (m as any).adminNotes;
                          return (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected(m);
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-cairo font-semibold transition-colors cursor-pointer ${
                                  note 
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200' 
                                    : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-800 border border-slate-200'
                                }`}
                                title={note ? `ملاحظة إدارية: ${note}` : 'إضافة ملاحظة إدارية'}
                              >
                                <StickyNote className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                <span className="truncate max-w-[180px]">
                                  {note ? `ملاحظة: ${note}` : '+ ملاحظة إدارية'}
                                </span>
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {khateebahInfo.hasInfo ? (
                      <div className="flex flex-col gap-0.5 max-w-[170px]">
                        <span className="font-cairo font-bold text-purple-900 text-xs flex items-center gap-1 truncate" title={khateebahInfo.name}>
                          <Building2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                          <span className="truncate">{khateebahInfo.name}</span>
                        </span>
                        {khateebahInfo.phone && (
                          <span className="text-[11px] text-purple-700 font-mono dir-ltr flex items-center gap-1 font-semibold">
                            <Phone className="w-3 h-3 text-purple-500 flex-shrink-0" />
                            {khateebahInfo.phone}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-600 font-tajawal max-w-[190px] truncate">{m.email || m.whatsapp || m.phone || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-cairo font-bold ${getPlanCfg(m.plan).color}`}>
                      {getPlanCfg(m.plan).label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-cairo font-bold ${getStatusCfg(m.status).color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusCfg(m.status).dot}`} />
                      {getStatusCfg(m.status).label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <ActionMenu items={getMemberActionItems(m)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center py-10 text-slate-400 font-cairo text-sm">لا يوجد أعضاء مطابقون</p>}
      </div>

      {/* شريط التحديد الذكي — يظهر عند تحديد صفحة كاملة ويوفر خيار تحديد الكل */}
      <AnimatePresence>
        {allPageSelected && hasMoreBeyondPage && !allFilteredSelected && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2"
          >
            <span className="text-xs font-cairo text-blue-800">
              تم تحديد {paginated.length} عضو من الصفحة الحالية.
            </span>
            <button
              onClick={toggleSelectAll}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-cairo font-bold transition-colors"
            >
              تحديد كل النتائج ({filtered.length})
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile cards */}
      <div className="lg:hidden grid grid-cols-2 gap-2 sm:gap-3">
        {paginated.map((m) => {
          const khateebahInfo = getKhateebahInfo(m);
          const details = getRichMemberDetails(m);

          return (
            <div key={m.id} className={`bg-white rounded-2xl p-2.5 sm:p-3 shadow-sm border flex flex-col justify-between ${selectedIds.has(m.id) ? 'border-amber-300 ring-1 ring-amber-200' : m.flagged ? 'border-rose-200' : 'border-slate-200'}`}>
              <div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m.id)}
                    onChange={() => toggleSelect(m.id)}
                    className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer flex-shrink-0 mt-1"
                  />
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                      m.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'
                    }`}
                  >
                    {(m.nickname || m.realName || '؟').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-cairo font-bold text-slate-900 text-xs truncate max-w-[90px]">{m.nickname || m.realName || 'بدون اسم'}</span>
                      {m.pinned && <Pin className="w-2.5 h-2.5 text-amber-500 fill-amber-500 flex-shrink-0 rotate-45" />}
                      {m.verified && <BadgeCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                      {m.plan === 'gold' && <Crown className="w-3 h-3 text-amber-500 fill-amber-100 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-cairo font-bold ${getStatusCfg(m.status).color}`}>
                        {getStatusCfg(m.status).label}
                      </span>
                      {(() => {
                        const sInfo = getMemberSourceAndDate(m);
                        return (
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-cairo font-bold ${sInfo.badgeClass}`} title={sInfo.date ? `تاريخ: ${sInfo.date}` : ''}>
                            {sInfo.badgeText}
                          </span>
                        );
                      })()}
                      {m.isProfileIncomplete && (
                        <span className="px-1 py-0.2 text-[8px] font-cairo font-bold bg-amber-100 text-amber-800 rounded">غير مكتمل</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* بيانات الخطابة على الجوال */}
                {khateebahInfo.hasInfo && (
                  <div className="mt-2 p-1.5 rounded-lg bg-purple-50 border border-purple-100 flex flex-col gap-0.5 text-[10px] font-cairo">
                    <div className="flex items-center gap-1 min-w-0">
                      <Building2 className="w-3 h-3 text-purple-600 flex-shrink-0" />
                      <span className="font-bold text-purple-900 truncate">{khateebahInfo.name}</span>
                    </div>
                    {khateebahInfo.phone && (
                      <span className="font-mono text-purple-700 dir-ltr text-[9px]">
                        {khateebahInfo.phone}
                      </span>
                    )}
                  </div>
                )}

                {/* التفاصيل الموسعة على الجوال - خيارات مصغرة توفر المساحة */}
                <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-cairo">
                  {details.nationality && (
                    <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-bold text-slate-700">
                      {details.nationality}
                    </span>
                  )}
                  {details.location && (
                    <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-600 truncate max-w-[120px]">
                      📍 {details.location}
                    </span>
                  )}
                  {details.marital && (
                    <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-700">
                      {details.marital} {details.age ? `(${details.age})` : ''}
                    </span>
                  )}
                  {details.marriageType && (
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                      {details.marriageType}
                    </span>
                  )}
                  {details.tribe && (
                    <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-600 truncate max-w-[110px]">
                      {details.tribe}
                    </span>
                  )}
                  {details.ethnicity && (
                    <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-600">
                      {details.ethnicity}
                    </span>
                  )}
                  {details.job && (
                    <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-600 truncate max-w-[110px]">
                      💼 {details.job}
                    </span>
                  )}
                </div>
              </div>

              {/* أزرار إجراءات واضحة على الجوال بحجم مصغر */}
              <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-slate-100 overflow-x-auto">
                <button
                  onClick={() => { setSelected(m); setRevealSensitive(false); }}
                  className="flex-shrink-0 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-[10px] flex items-center gap-0.5"
                >
                  <Eye className="w-3 h-3" /> عرض
                </button>
                <button
                  onClick={() => impersonateAndGo(m)}
                  className="flex-shrink-0 px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-cairo font-bold text-[10px] flex items-center gap-0.5"
                >
                  <LogIn className="w-3 h-3" /> دخول
                </button>
                <button
                  onClick={async () => {
                    await toggleVerified(m.id, !m.verified);
                    showLocalToast(m.verified ? 'أُلغي التوثيق' : 'تم التوثيق ✓');
                  }}
                  className={`flex-shrink-0 px-2 py-1 rounded-lg font-cairo font-bold text-[10px] flex items-center gap-0.5 ${
                    m.verified ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <BadgeCheck className="w-3 h-3" /> {m.verified ? 'موثق' : 'توثيق'}
                </button>
                <button
                  onClick={async () => {
                    await setPremium(m.id, !m.premium);
                    showLocalToast(m.premium ? 'أُلغي التميّز' : 'ترقية 👑');
                  }}
                  className={`flex-shrink-0 px-2 py-1 rounded-lg font-cairo font-bold text-[10px] flex items-center gap-0.5 ${
                    m.premium ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Crown className="w-3 h-3" /> {m.premium ? 'مميّز' : 'ترقية'}
                </button>
                <ActionMenu items={getMemberActionItems(m)} />
              </div>
            </div>
          );
        })}
      </div>
        </>
      )}

      {/* شريط التحكم السفلي: عدّاد + حجم الصفحة + ترقيم */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
        {/* عدّاد النتائج */}
        <div className="flex items-center gap-2 text-xs font-cairo text-slate-500">
          {selectedCount > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-amber-400 text-navy-900 flex items-center justify-center text-[10px] font-black">{selectedCount}</span>
              محدّد من {filtered.length}
            </span>
          ) : (
            <span>عرض <strong className="text-slate-700">{showingFrom}–{showingTo}</strong> من <strong className="text-slate-700">{filtered.length}</strong></span>
          )}
        </div>

        {/* حجم الصفحة */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-cairo text-slate-400">عرض:</span>
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPageSize(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-cairo font-bold transition-colors ${
                pageSize === opt.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* الترقيم */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center disabled:opacity-40 hover:bg-slate-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(isNaN(totalPages) ? 1 : totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) {
                p = i + 1;
              } else if (page <= 4) {
                p = i + 1;
              } else if (page >= totalPages - 3) {
                p = totalPages - 6 + i;
              } else {
                p = page - 3 + i;
              }
              const safeNum = isNaN(p) ? i + 1 : p;
              return (
                <button
                  key={`page-btn-${safeNum}-${i}`}
                  onClick={() => setPage(safeNum)}
                  className={`w-8 h-8 rounded-lg font-cairo font-bold text-xs transition-colors ${
                    page === safeNum ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {safeNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center disabled:opacity-40 hover:bg-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <AdminMemberDetailModal
        member={selectedLive}
        open={!!selectedLive}
        onClose={() => { setSelected(null); setIsEditing(false); }}
        initialEditing={isEditing}
        onUpdated={() => { refresh?.(); }}
      />
      {false && (
      <Modal open={!!selectedLive} onClose={() => { setSelected(null); setIsEditing(false); }} title={isEditing ? `تعديل بيانات: ${selectedLive?.nickname}` : "ملف العضو"} size="lg">
        {selectedLive && (
          isEditing ? (
            <div className="space-y-4 font-cairo">
              {/* Warning banner if incomplete */}
              {editForm.isProfileIncomplete && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="font-bold text-xs">ملف شخصي غير مكتمل</p>
                    <p className="text-[11px] font-tajawal text-amber-700 leading-relaxed">هذا العضو مستورد ومصنف "غير مكتمل" لغياب بعض البيانات الإلزامية. املأ الحقول الفارغة لحفظ ملفه كملف كامل ليظهر للبحث العام.</p>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveEditTab('basic')}
                  className={`flex-1 text-center py-2.5 font-bold text-xs border-b-2 transition-all ${
                    activeEditTab === 'basic' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  البيانات الشخصية والأساسية
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEditTab('partner')}
                  className={`flex-1 text-center py-2.5 font-bold text-xs border-b-2 transition-all ${
                    activeEditTab === 'partner' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  مواصفات الشريك المطلوبة
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEditTab('account')}
                  className={`flex-1 text-center py-2.5 font-bold text-xs border-b-2 transition-all ${
                    activeEditTab === 'account' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  بيانات الحساب والاتصال
                </button>
              </div>

              {activeEditTab === 'basic' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto px-1 py-1">
                  {/* Nickname & Real Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الاسم المستعار (اللقب) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editForm.nickname || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, nickname: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 ${!editForm.nickname ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                      placeholder="مثال: الواثق بالله"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الحقيقي <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editForm.realName || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, realName: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 ${!editForm.realName ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                      placeholder="الاسم الثلاثي للتثبت الإداري"
                    />
                  </div>

                  {/* Gender & BirthDate */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الجنس <span className="text-red-500">*</span></label>
                    <select
                      value={editForm.gender || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, gender: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 ${!editForm.gender ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                    >
                      <option value="">-- اختر --</option>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </div>
                  {/* Age & Nationality */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">العمر (سنوات) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={editForm.age || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, age: Number(e.target.value) }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 ${!editForm.age ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                      min="16"
                      max="80"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الجنسية</label>
                    <select
                      value={editForm.nationality || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, nationality: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                    >
                      <option value="">-- اختر الجنسية --</option>
                      {safeGetNationalities(editForm.nationality).map((nat, idx) => (
                        <option key={`edit-nat-${nat.name}-${idx}`} value={nat.name}>{nat.name}{nat.isPending ? ' (مقترح معلق)' : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* Country & City */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">بلد الإقامة <span className="text-red-500">*</span></label>
                    <select
                      value={editForm.country || 'السعودية'}
                      onChange={(e) => {
                        const newCountry = e.target.value;
                        setEditForm(prev => ({ ...prev, country: newCountry, city: '' }));
                      }}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 ${!editForm.country ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                    >
                      <option value="">-- اختر بلد الإقامة --</option>
                      {safeGetCountries(editForm.country).map((c, idx) => (
                        <option key={`edit-country-${c.name}-${idx}`} value={c.name}>{c.name}{c.isPending ? ' (مقترح معلق)' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المدينة <span className="text-red-500">*</span></label>
                    <select
                      value={editForm.city || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 ${!editForm.city ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                    >
                      <option value="">-- اختر المدينة --</option>
                      {(editForm.country || 'السعودية') ? safeGetCities(editForm.country || 'السعودية', editForm.city).map((ct, idx) => (
                        <option key={`edit-city-${ct.name}-${idx}`} value={ct.name}>{ct.name}{ct.isPending ? ' (مقترح معلق)' : ''}</option>
                      )) : null}
                    </select>
                  </div>

                  {/* District & Tribe */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الحي / المنطقة</label>
                    <input
                      type="text"
                      value={editForm.district || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, district: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400"
                      placeholder="مثال: الملقا"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">القبيلة / النسب</label>
                    <input
                      type="text"
                      value={editForm.tribe || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, tribe: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400"
                      placeholder="مثل: قبيلي، عتيبي، مطيري..."
                    />
                  </div>

                  {/* Sect & Marriage Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المذهب</label>
                    <select
                      value={editForm.sect || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, sect: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                    >
                      <option value="">-- اختر المذهب --</option>
                      {C.SECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نوع الزواج المطلوب</label>
                    <select
                      value={editForm.marriageType || 'announced'}
                      onChange={(e) => setEditForm(prev => ({ ...prev, marriageType: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-bold text-amber-900 font-cairo"
                    >
                      <option value="announced">معلن</option>
                      <option value="misyar">مسيار</option>
                      <option value="both">لا مانع / معلن او مسيار</option>
                    </select>
                  </div>

                  {/* Marital Status & Children */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الحالة الاجتماعية <span className="text-red-500">*</span></label>
                    <select
                      value={editForm.maritalStatus || editForm.marital || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, maritalStatus: e.target.value, marital: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 font-cairo ${!(editForm.maritalStatus || editForm.marital) ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                    >
                      <option value="">-- اختر الحالة الاجتماعية --</option>
                      {editForm.gender === 'female' ? (
                        <>
                          <option value="عزباء">عزباء</option>
                          <option value="single">عزباء (single)</option>
                          <option value="مطلقة">مطلقة</option>
                          <option value="divorced">مطلقة (divorced)</option>
                          <option value="أرملة">أرملة</option>
                          <option value="widow">أرملة (widow)</option>
                        </>
                      ) : (
                        <>
                          <option value="أعزب">أعزب</option>
                          <option value="single">أعزب (single)</option>
                          <option value="مطلق">مطلق</option>
                          <option value="divorced">مطلق (divorced)</option>
                          <option value="أرمل">أرمل</option>
                          <option value="widower">أرمل (widower)</option>
                          <option value="متزوج">متزوج</option>
                          <option value="married">متزوج (married)</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">عدد الأبناء</label>
                    <input
                      type="text"
                      value={editForm.childrenCount || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, childrenCount: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400"
                      placeholder="مثال: لا يوجد أو ٢"
                    />
                  </div>

                  {/* Height & Weight */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الطول (سم) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={editForm.height || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, height: Number(e.target.value) }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 ${!editForm.height ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                      placeholder="170"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الوزن (كجم) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={editForm.weight || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, weight: Number(e.target.value) }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 ${!editForm.weight ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                      placeholder="70"
                    />
                  </div>

                  {/* Skin Color & Education */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">لون البشرة <span className="text-red-500">*</span></label>
                    <select
                      value={editForm.skinColor || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, skinColor: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 font-cairo ${!editForm.skinColor ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                    >
                      <option value="">-- اختر لون البشرة --</option>
                      {C.SKIN_COLORS.map((sc) => (
                        <option key={sc} value={sc}>{sc}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المستوى التعليمي <span className="text-red-500">*</span></label>
                    <select
                      value={editForm.education || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, education: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 font-cairo ${!editForm.education ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                    >
                      <option value="">-- اختر المستوى التعليمي --</option>
                      {C.EDUCATION_LEVELS.map((ed) => (
                        <option key={ed} value={ed}>{ed}</option>
                      ))}
                    </select>
                  </div>

                  {/* Work Type & Job Title */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نوع العمل / الوظيفة <span className="text-red-500">*</span></label>
                    <select
                      value={editForm.workType || editForm.occupation || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, workType: e.target.value, occupation: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 font-cairo ${!(editForm.workType || editForm.occupation) ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                    >
                      <option value="">-- اختر نوع العمل --</option>
                      {C.WORK_TYPES.map((wt) => (
                        <option key={wt} value={wt}>{wt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المسمى الوظيفي / المهنة</label>
                    <input
                      type="text"
                      value={editForm.jobTitle || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                      placeholder="مثال: مهندس برمجيات، معلّمة..."
                    />
                  </div>

                  {/* Housing & Health Status */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">طبيعة السكن <span className="text-red-500">*</span></label>
                    <select
                      value={editForm.housing || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, housing: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 font-cairo ${!editForm.housing ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                    >
                      <option value="">-- اختر طبيعة السكن --</option>
                      {C.HOUSING_TYPES.map((ht) => (
                        <option key={ht} value={ht}>{ht}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الحالة الصحية</label>
                    <input
                      type="text"
                      value={editForm.healthStatus || editForm.health || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, healthStatus: e.target.value, health: e.target.value }))}
                      placeholder="اكتب الحالة الصحية (مثل: سليم ولله الحمد، سكر وضغط...)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                    />
                  </div>

                  {/* Smoking */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">التدخين</label>
                    <select
                      value={editForm.smoking || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, smoking: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                    >
                      <option value="">-- اختر التدخين --</option>
                      {C.SMOKING_OPTIONS.map((sm) => (
                        <option key={sm} value={sm}>{sm}</option>
                      ))}
                    </select>
                  </div>

                  {/* تقبل التعدد — للنساء فقط (قابل للتعبئة بعد الاستيراد) */}
                  {editForm.gender === 'female' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">هل تقبل التعدد؟</label>
                      <select
                        value={editForm.acceptPolygamy || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, acceptPolygamy: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400"
                      >
                        <option value="">— لم يتم الاختيار —</option>
                        <option value="yes">نعم، أقبل التعدد</option>
                        <option value="first_only">أقبل أن أكون الزوجة الأولى فقط</option>
                        <option value="no">لا أقبل التعدد</option>
                      </select>
                    </div>
                  )}

                  {/* Bio & About Partner */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">نبذة عن العضو (تحدث عن نفسك)</label>
                    <textarea
                      value={editForm.bio || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 h-16 resize-none"
                      placeholder="اكتب بضعة أسطر عن شخصيتك واهتماماتك..."
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">شروط ومواصفات الشريك المطلوبة</label>
                    <textarea
                      value={editForm.aboutPartner || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, aboutPartner: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 h-16 resize-none"
                      placeholder="اكتب مواصفات شريك الحياة المطلوب..."
                    />
                  </div>

                  {/* Incompleteness Override Checkbox */}
                  <div className="sm:col-span-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center justify-between mt-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-xs text-amber-900">حالة غير مكتملة</p>
                        <p className="text-[10px] text-amber-700 font-tajawal leading-relaxed">عند تفعيل هذا الخيار، سيتم اعتبار الملف غير مكتمل وسيُحجب من العرض العام للأعضاء.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!editForm.isProfileIncomplete}
                      onChange={(e) => setEditForm(prev => ({ ...prev, isProfileIncomplete: e.target.checked }))}
                      className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              ) : activeEditTab === 'account' ? (
                <div className="space-y-3.5 max-h-[50vh] overflow-y-auto px-1 py-1">
                  {/* Whatsapp */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رقم الواتساب <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editForm.whatsapp || editForm.phone || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, whatsapp: e.target.value, phone: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 ${(!editForm.whatsapp && !editForm.phone) ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                      placeholder="مثال: 0500000000"
                      dir="ltr"
                    />
                  </div>

                  {/* Email & Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 ${!editForm.email ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                        placeholder="member@email.com"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={editForm.password || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-xs focus:outline-none focus:border-amber-400 ${!editForm.password ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}
                        placeholder="Pass@1234"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Subscription Plan & Pinning */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">باقة الاشتراك</label>
                      <select
                        value={editForm.plan || 'free'}
                        onChange={(e) => setEditForm(prev => ({ 
                          ...prev, 
                          plan: e.target.value, 
                          premium: e.target.value === 'gold' || e.target.value === 'elite' 
                        }))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                      >
                        <option value="free">المجانية (Free)</option>
                        <option value="gold">الذهبية (Gold)</option>
                        <option value="elite">المميز (Elite) ⭐</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="editFormPinned"
                        checked={!!editForm.pinned}
                        onChange={(e) => setEditForm(prev => ({ ...prev, pinned: e.target.checked }))}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                      />
                      <label htmlFor="editFormPinned" className="text-xs font-bold text-slate-700 cursor-pointer font-cairo select-none flex items-center gap-1">
                        <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 rotate-45" /> تثبيت العضو في صدارة البحث والرئيسية
                      </label>
                    </div>
                  </div>

                  {/* Status, Verification, and Badges */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">حالة الحساب الإدارية</label>
                        <select
                          value={editForm.status || 'active'}
                          onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo font-bold"
                        >
                          <option value="active">نشط (مفعل بالمنصة) ✓</option>
                          <option value="pending">قيد المراجعة ⏳</option>
                          <option value="suspended">موقوف مؤقتاً ⚠️</option>
                          <option value="banned">محظور نهائياً ⛔</option>
                          <option value="inactive">غير نشط 💤</option>
                        </select>
                      </div>
                      {(editForm.status === 'suspended' || editForm.status === 'banned') && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">سبب الإيقاف / الحظر</label>
                          <input
                            type="text"
                            value={editForm.statusReason || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, statusReason: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                            placeholder="سبب الإيقاف الظاهر للعضو..."
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="flex items-center gap-2 bg-sky-50/50 p-2.5 rounded-xl border border-sky-100">
                        <input
                          type="checkbox"
                          id="editFormVerified"
                          checked={!!editForm.verified}
                          onChange={(e) => setEditForm(prev => ({ ...prev, verified: e.target.checked }))}
                          className="w-4 h-4 rounded accent-sky-500 cursor-pointer"
                        />
                        <label htmlFor="editFormVerified" className="text-xs font-bold text-slate-800 cursor-pointer font-cairo select-none flex items-center gap-1.5">
                          <BadgeCheck className="w-4 h-4 text-sky-500" /> توثيق الهوية بالمنصة
                        </label>
                      </div>
                      <div className="flex items-center gap-2 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                        <input
                          type="checkbox"
                          id="editFormSeriousnessBadge"
                          checked={!!editForm.hasSeriousnessBadge}
                          onChange={(e) => setEditForm(prev => ({ ...prev, hasSeriousnessBadge: e.target.checked }))}
                          className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                        />
                        <label htmlFor="editFormSeriousnessBadge" className="text-xs font-bold text-slate-800 cursor-pointer font-cairo select-none flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-emerald-500" /> منح وسام الجدية
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto px-1 py-1">
                  {/* مواصفات الشريك المطلوبة */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">بلد إقامة الشريك</label>
                    <select
                      value={editForm.pCountry || 'لا يهم'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditForm(prev => ({ ...prev, pCountry: val, pCity: val === 'لا يهم' ? 'لا يهم' : '' }));
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                    >
                      <option value="لا يهم">لا يهم</option>
                      {safeGetCountries(editForm.pCountry)
                        .filter((c) => c.name && c.name !== 'لا يهم')
                        .map((c, idx: number) => (
                          <option key={`pcountry-${c.name}-${idx}`} value={c.name}>{c.name}{c.isPending ? ' (مقترح معلق)' : ''}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">مدينة إقامة الشريك</label>
                    <select
                      value={editForm.pCity || 'لا يهم'}
                      onChange={(e) => setEditForm(prev => ({ ...prev, pCity: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                    >
                      <option value="لا يهم">لا يهم</option>
                      {editForm.pCountry && editForm.pCountry !== 'لا يهم' ? safeGetCities(editForm.pCountry, editForm.pCity)
                        .filter((ct) => ct.name && ct.name !== 'لا يهم')
                        .map((ct, idx: number) => (
                          <option key={`pcity-${ct.name}-${idx}`} value={ct.name}>{ct.name}{ct.isPending ? ' (مقترح معلق)' : ''}</option>
                        )) : null}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">جنسية الشريك</label>
                    <select
                      value={
                        !editForm.pNationality || editForm.pNationality === 'اقبل اجنبي' || editForm.pNationality === 'أقبل أجنبي' || editForm.pNationality === 'لا يهم'
                          ? 'اقبل اجنبي'
                          : editForm.pNationality === 'نفس جنسيتي'
                          ? 'نفس جنسيتي'
                          : 'custom'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          if (editForm.pNationality === 'نفس جنسيتي' || editForm.pNationality === 'اقبل اجنبي' || editForm.pNationality === 'أقبل أجنبي' || editForm.pNationality === 'لا يهم') {
                            setEditForm(prev => ({ ...prev, pNationality: '' }));
                          }
                        } else {
                          setEditForm(prev => ({ ...prev, pNationality: val }));
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                    >
                      <option value="نفس جنسيتي">نفس جنسيتي (نفس جنسية العضو)</option>
                      <option value="اقبل اجنبي">اقبل اجنبي (أية جنسية)</option>
                      <option value="custom">تحديد جنسيات معينة</option>
                    </select>
                    {(editForm.pNationality !== 'نفس جنسيتي' && editForm.pNationality !== 'اقبل اجنبي' && editForm.pNationality !== 'أقبل أجنبي' && editForm.pNationality !== 'لا يهم') && (
                      <div className="mt-1.5 space-y-1">
                        <label className="text-[11px] text-slate-600 font-cairo block">الجنسية أو الجنسيات المحددة (افصل بينها بفصلة):</label>
                        <input
                          type="text"
                          value={editForm.pNationality || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, pNationality: e.target.value }))}
                          placeholder="مثال: سعودية، كويتية..."
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-cairo focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">الحد الأدنى لعمر الشريك</label>
                    <input
                      type="number"
                      min={16}
                      max={90}
                      value={editForm.pAgeMin ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditForm(prev => ({ ...prev, pAgeMin: val === '' ? '' : Number(val) }));
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                      placeholder="فارغ (أي عمر)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">الحد الأقصى لعمر الشريك</label>
                    <input
                      type="number"
                      min={16}
                      max={90}
                      value={editForm.pAgeMax ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditForm(prev => ({ ...prev, pAgeMax: val === '' ? '' : Number(val) }));
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                      placeholder="فارغ (أي عمر)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">الحالة الاجتماعية للشريك</label>
                    <select
                      value={editForm.pMaritalStatus || 'لا يهم'}
                      onChange={(e) => setEditForm(prev => ({ ...prev, pMaritalStatus: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                    >
                      <option value="لا يهم">لا يهم</option>
                      {editForm.gender === 'male' ? (
                        <>
                          <option value="عزباء">عزباء</option>
                          <option value="مطلقة">مطلقة</option>
                          <option value="أرملة">أرملة</option>
                        </>
                      ) : (
                        <>
                          <option value="أعزب">أعزب</option>
                          <option value="مطلق">مطلق</option>
                          <option value="أرمل">أرمل</option>
                          <option value="متزوج">متزوج</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">قبول أطفال لدى الشريك</label>
                    <select
                      value={editForm.pAcceptChildren || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, pAcceptChildren: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 font-cairo"
                    >
                      <option value="">-- اختر --</option>
                      <option value="لا يهم">لا يهم</option>
                      <option value="نعم">نعم</option>
                      <option value="لا">لا</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">تفاصيل وملاحظات إضافية عن الشريك المطلوبة</label>
                    <textarea
                      value={editForm.pNotes || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, pNotes: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400 h-20 resize-none font-tajawal"
                      placeholder="مثال: يفضل سكن مستقل بالرياض، لديه قدرة على تحمل المسؤولية..."
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={async () => {
                    const gender = ((editForm.gender as string) || 'female') as 'male' | 'female';
                    const rawStatus = editForm.maritalStatus || editForm.marital || '';
                    const normStatus = getNormalizedMaritalCode(rawStatus, gender);
                    const maritalLabel = getMaritalLabel(normStatus, gender);
                    const marriageType = editForm.marriageType || 'announced';
                    const marriageTypeLabel = marriageType === 'misyar' ? 'مسيار' : marriageType === 'both' ? 'لا مانع / معلن او مسيار' : 'معلن';

                    const updatedIncomplete = 
                      !editForm.gender || 
                      !editForm.age || 
                      !editForm.country || 
                      !normStatus;

                    const fieldsToSave = {
                      ...editForm,
                      gender,
                      maritalStatus: normStatus,
                      marital: normStatus,
                      maritalLabel,
                      marriageType,
                      marriageTypeLabel,
                      tribe: editForm.tribe || '',
                      acceptPolygamy: editForm.acceptPolygamy || '',
                      isProfileIncomplete: editForm.isProfileIncomplete !== undefined ? editForm.isProfileIncomplete : updatedIncomplete,
                    } as any;

                    const ok = await updateMember(selectedLive.id, fieldsToSave);
                    if (ok) {
                      showLocalToast('تم تحديث بيانات ملف العضو بنجاح ✓');
                      setIsEditing(false);
                      setSelected(prev => prev ? { ...prev, ...fieldsToSave } : null);
                    } else {
                      showLocalToast('حدث خطأ أثناء حفظ التغييرات');
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-cairo font-bold text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> حفظ التغييرات
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-sm transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl ${
                    selectedLive.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'
                  }`}
                >
                  {(selectedLive.nickname || selectedLive.realName || '؟').charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 justify-between">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-cairo font-extrabold text-lg text-slate-900">{selectedLive.nickname || selectedLive.realName || 'بدون اسم'}</h3>
                      {selectedLive.verified && <BadgeCheck className="w-5 h-5 text-blue-500" />}
                      {selectedLive.premium && <Crown className="w-5 h-5 text-amber-500" />}
                      {selectedLive.isProfileIncomplete && (
                        <span className="px-2 py-0.5 text-[10px] font-cairo font-bold bg-amber-100 text-amber-800 rounded select-none">غير مكتمل</span>
                      )}
                    </div>
                    <button
                      onClick={() => openEditModal(selectedLive)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-cairo font-bold text-xs hover:bg-amber-600 transition-all flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" /> تعديل البيانات
                    </button>
                  </div>
                <p className="text-sm text-slate-500 font-tajawal">
                  {selectedLive.age} سنة · {selectedLive.city}، {selectedLive.country}
                </p>
                <div className="flex gap-1.5 mt-1">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-cairo font-bold ${getStatusCfg(selectedLive.status).color}`}>
                    {getStatusCfg(selectedLive.status).label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-cairo font-bold ${getPlanCfg(selectedLive.plan).color}`}>
                    {getPlanCfg(selectedLive.plan).label}
                  </span>
                  {selectedLive.flagged && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-cairo font-bold bg-rose-100 text-rose-700 flex items-center gap-0.5">
                      <Flag className="w-3 h-3" /> معلّم
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* بانر سبب تقييد الحساب (حظر/تجميد/إيقاف) */}
            {selectedLive.status !== 'active' && selectedLive.status !== 'pending' && (
              <div className={`rounded-xl p-3 border ${
                selectedLive.status === 'banned' ? 'bg-rose-50 border-rose-200' : 'bg-orange-50 border-orange-200'
              }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {selectedLive.status === 'banned' ? <UserX className="w-4 h-4 text-rose-600" /> :
                   <Ban className="w-4 h-4 text-orange-600" />}
                  <span className="text-xs font-cairo font-bold text-slate-800">
                    الحساب {getStatusCfg(selectedLive.status).label}
                  </span>
                </div>
                {selectedLive.statusReason && (
                  <p className="text-xs text-slate-600 font-tajawal leading-relaxed">السبب: {selectedLive.statusReason}</p>
                )}
                {selectedLive.statusChangedAt && (
                  <p className="text-[10px] text-slate-400 font-tajawal mt-1">
                    بواسطة {selectedLive.statusChangedBy || 'الإدارة'} · {new Date(selectedLive.statusChangedAt).toLocaleString('ar-SA')}
                  </p>
                )}
              </div>
            )}

            {/* View Tabs */}
            <div className="flex border-b border-slate-200 mb-3 font-cairo">
              <button
                type="button"
                onClick={() => setActiveViewTab('basic')}
                className={`flex-1 text-center py-2.5 font-bold text-xs border-b-2 transition-all ${
                  activeViewTab === 'basic' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                البيانات والصفات الشخصية
              </button>
              <button
                type="button"
                onClick={() => setActiveViewTab('partner')}
                className={`flex-1 text-center py-2.5 font-bold text-xs border-b-2 transition-all ${
                  activeViewTab === 'partner' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                مواصفات الشريك المطلوبة
              </button>
            </div>

            {activeViewTab === 'basic' ? (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1 py-1 font-cairo">
                {(() => {
                  const basicItems = [
                    { label: 'نوع الزواج المطلوب', value: (selectedLive as any).marriageType === 'misyar' ? 'مسيار' : (selectedLive as any).marriageType === 'both' ? 'لا مانع / معلن او مسيار' : 'معلن' },
                    { label: 'القبيلة / النسب', value: (selectedLive as any).tribe },
                    { label: 'الجنس', value: selectedLive.gender === 'male' ? 'ذكر' : 'أنثى' },
                    { label: 'الحالة الاجتماعية', value: selectedLive.maritalStatus === 'single' ? (selectedLive.gender === 'male' ? 'أعزب' : 'عزباء') : selectedLive.maritalStatus === 'divorced' ? (selectedLive.gender === 'male' ? 'مطلق' : 'مطلقة') : (selectedLive.maritalStatus === 'widow' || selectedLive.maritalStatus === 'widower') ? (selectedLive.gender === 'male' ? 'أرمل' : 'أرملة') : selectedLive.maritalStatus === 'married' ? 'متزوج' : selectedLive.maritalStatus },
                    { label: 'العمر', value: selectedLive.age ? `${selectedLive.age} سنة` : '' },
                    { label: 'الدولة', value: selectedLive.country },
                    { label: 'المدينة', value: selectedLive.city },
                    { label: 'المنطقة / الحي', value: selectedLive.district },
                    { label: 'الجنسية', value: selectedLive.nationality },
                    { label: 'المذهب', value: selectedLive.sect },
                    { label: 'عدد الأبناء', value: selectedLive.childrenCount },
                    { label: 'الطول', value: selectedLive.height ? `${selectedLive.height} سم` : '' },
                    { label: 'الوزن', value: selectedLive.weight ? `${selectedLive.weight} كجم` : '' },
                    { label: 'لون البشرة', value: selectedLive.skinColor },
                    { label: 'العرق', value: selectedLive.ethnicity },
                    { label: 'الحالة الصحية', value: selectedLive.health },
                    { label: 'التدخين', value: selectedLive.smoking },
                    { label: 'التعليم', value: selectedLive.education },
                    { label: 'طبيعة السكن', value: selectedLive.housing },
                    { label: 'جهة العمل', value: selectedLive.workType },
                    { label: 'المسمى الوظيفي', value: selectedLive.jobTitle },
                  ].filter((item) => {
                    if (!item.value) return false;
                    const s = String(item.value).trim();
                    return s !== '' && s !== '—' && s !== '-' && s !== 'غير محدد' && s !== 'غير مذكور' && s !== 'لم يتم الاختيار' && s !== 'لا يوجد' && s !== 'لا يهم' && s !== '0';
                  });

                  const hasBio = selectedLive.bio && String(selectedLive.bio).trim() !== '' && String(selectedLive.bio).trim() !== '—';

                  if (basicItems.length === 0 && !hasBio) {
                    return (
                      <p className="text-xs text-slate-400 text-center py-8 font-cairo">
                        لا توجد بيانات شخصية محددة للعرض
                      </p>
                    );
                  }

                  return (
                    <>
                      {basicItems.length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                          {basicItems.map((item) => (
                            <div key={item.label} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                              <span className="text-[10px] text-slate-400 block mb-0.5">{item.label}</span>
                              <span className="font-bold text-xs text-slate-800">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasBio && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <span className="text-[10px] text-slate-400 block mb-1">نبذة تعريفية عن النفس</span>
                          <p className="text-xs text-slate-700 leading-relaxed font-tajawal whitespace-pre-wrap">{selectedLive.bio}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1 py-1 font-cairo">
                {(() => {
                  const partnerItems = [
                    { label: 'بلد إقامة الشريك', value: selectedLive.pCountry },
                    { label: 'مدينة إقامة الشريك', value: selectedLive.pCity },
                    { label: 'جنسية الشريك', value: selectedLive.pNationality },
                    { label: 'العمر المطلوب', value: selectedLive.pAgeMin && selectedLive.pAgeMax ? `من ${selectedLive.pAgeMin} إلى ${selectedLive.pAgeMax} سنة` : '' },
                    { label: 'الحالة الاجتماعية المقبولة', value: selectedLive.pMaritalStatus },
                    { label: 'قبول أطفال لدى الشريك', value: selectedLive.pAcceptChildren },
                  ].filter((item) => {
                    if (!item.value) return false;
                    const s = String(item.value).trim();
                    return s !== '' && s !== '—' && s !== '-' && s !== 'غير محدد' && s !== 'غير مذكور' && s !== 'لم يتم الاختيار' && s !== 'لا يوجد' && s !== 'لا يهم' && s !== '0';
                  });

                  const pNotesVal = selectedLive.pNotes || selectedLive.aboutPartner;
                  const hasPNotes = pNotesVal && String(pNotesVal).trim() !== '' && String(pNotesVal).trim() !== '—';

                  if (partnerItems.length === 0 && !hasPNotes) {
                    return (
                      <p className="text-xs text-slate-400 text-center py-8 font-cairo">
                        لا توجد مواصفات محددة للشريك المطلوبة
                      </p>
                    );
                  }

                  return (
                    <>
                      {partnerItems.length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                          {partnerItems.map((item) => (
                            <div key={item.label} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                              <span className="text-[10px] text-slate-400 block mb-0.5">{item.label}</span>
                              <span className="font-bold text-xs text-slate-800">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasPNotes && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <span className="text-[10px] text-slate-400 block mb-1">ملاحظات إضافية عن الشريك المطلوب</span>
                          <p className="text-xs text-slate-700 leading-relaxed font-tajawal whitespace-pre-wrap">{pNotesVal}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {(() => {
              const sensitiveItems = [
                { icon: Fingerprint, label: 'الاسم الحقيقي', value: selectedLive.realName },
                { icon: Mail, label: 'البريد', value: selectedLive.email },
                { icon: Phone, label: 'رقم الواتساب', value: selectedLive.whatsapp || selectedLive.phone },
                { icon: Fingerprint, label: 'الهوية', value: selectedLive.nationalId },
              ].filter((f) => {
                if (!f.value) return false;
                const s = String(f.value).trim();
                return s !== '' && s !== '—' && s !== 'غير محدد' && s !== 'مستورد مباشر';
              });

              if (sensitiveItems.length === 0) return null;

              return (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 font-cairo">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                      <Lock className="w-4 h-4" /> بيانات حساسة — للإدارة فقط
                    </span>
                    <button
                      onClick={() => setRevealSensitive((v) => !v)}
                      className="text-[11px] font-bold text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      {revealSensitive ? 'إخفاء' : 'كشف الكل'}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {sensitiveItems.map((f) => {
                      const Icon = f.icon;
                      return (
                        <div key={f.label} className="flex items-center gap-2 text-sm bg-white/60 rounded-lg px-2 py-1.5">
                          <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="text-slate-500 font-cairo text-xs w-24 flex-shrink-0">{f.label}:</span>
                          <span
                            className="text-slate-800 flex-1 truncate font-tajawal"
                            dir="ltr"
                          >
                            {revealSensitive ? f.value : '•••••••••'}
                          </span>
                          {revealSensitive && (
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(f.value);
                                showLocalToast('تم نسخ ' + f.label + ' ✓');
                              }}
                              className="text-slate-400 hover:text-slate-700 flex-shrink-0"
                              title="نسخ"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {revealSensitive && selectedLive.email && (
                    <button
                      onClick={async () => {
                        const { error } = await supabase.auth.resetPasswordForEmail(selectedLive.email, {
                          redirectTo: `${window.location.origin}/reset-password`,
                        });
                        showLocalToast(error ? 'تعذّر إرسال رابط إعادة التعيين' : `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${selectedLive.email} ✓`);
                      }}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white border border-rose-200 text-rose-600 font-cairo font-bold text-xs hover:bg-rose-100 transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> إرسال رابط إعادة تعيين كلمة المرور للعضو
                    </button>
                  )}
                </div>
              );
            })()}

            <div>
              <label className="flex items-center gap-1.5 text-xs font-cairo font-bold text-slate-600 mb-1">
                <StickyNote className="w-4 h-4" /> ملاحظة إدارية خاصة
              </label>
              <div className="flex gap-2">
                <input
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="اكتب ملاحظة..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-sm"
                />
                <button
                  onClick={async () => {
                    await setNote(selectedLive.id, noteDraft);
                    showLocalToast('حُفظت الملاحظة ✓');
                  }}
                  className="px-4 rounded-xl bg-slate-900 text-white font-cairo font-bold text-sm"
                >
                  حفظ
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={async () => {
                  await toggleVerified(selectedLive.id, !selectedLive.verified);
                  showLocalToast(selectedLive.verified ? 'أُلغي التوثيق' : 'تم التوثيق ✓');
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-cairo font-bold text-sm ${
                  selectedLive.verified ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <BadgeCheck className="w-4 h-4" /> {selectedLive.verified ? 'موثق' : 'توثيق'}
              </button>
              <button
                onClick={async () => {
                  await setPremium(selectedLive.id, !selectedLive.premium);
                  showLocalToast(selectedLive.premium ? 'أُلغي التميّز' : 'ترقية مميّز 👑');
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-cairo font-bold text-sm ${
                  selectedLive.premium ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Crown className="w-4 h-4" /> {selectedLive.premium ? 'مميّز' : 'ترقية'}
              </button>
              {selectedLive.status !== 'active' ? (
                <button
                  onClick={async () => {
                    await updateMember(selectedLive.id, { status: 'active' });
                    showLocalToast('تم التفعيل ✓');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 font-cairo font-bold text-sm"
                >
                  <UserCheck className="w-4 h-4" /> تفعيل
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await updateMember(selectedLive.id, { status: 'suspended' });
                    showLocalToast('تم الإيقاف');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-100 text-rose-700 font-cairo font-bold text-sm"
                >
                  <UserX className="w-4 h-4" /> إيقاف
                </button>
              )}
              <button
                onClick={async () => {
                  await toggleFlag(selectedLive.id, !selectedLive.flagged);
                  showLocalToast(selectedLive.flagged ? 'أُزيل التعليم' : 'تم التعليم');
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-cairo font-bold text-sm ${
                  selectedLive.flagged ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Flag className="w-4 h-4" /> {selectedLive.flagged ? 'معلّم' : 'تعليم'}
              </button>
            </div>

            <button
              onClick={() => { setNotifyFor(selectedLive); setNotifyText(''); }}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-amber-500 text-white font-cairo font-bold text-sm hover:brightness-105"
            >
              <Send className="w-4 h-4 -scale-x-100" /> إرسال إشعار للعضو
            </button>

            <button
              onClick={() => impersonateAndGo(selectedLive)}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gradient-to-l from-slate-900 to-slate-800 text-amber-300 font-cairo font-bold text-sm hover:brightness-110 transition-all border border-amber-500/30"
            >
              <LogIn className="w-4 h-4" /> الدخول بحساب العضو
            </button>

            <button
              onClick={() => setDeleteFor(selectedLive)}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white border-2 border-rose-200 text-rose-600 font-cairo font-bold text-sm hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> حذف الحساب نهائياً
            </button>
          </div>
        )
      )}
    </Modal>
    )}

      {/* Delete confirmation */}
      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title="حذف أو تعطيل الحساب">
        {deleteFor && (
          <div className="text-center" dir="rtl">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-7 h-7 text-rose-500" />
            </div>
            <p className="font-cairo font-bold text-slate-800 mb-1">التحكم بحساب العضو «{deleteFor.nickname}»</p>
            <p className="text-xs text-slate-500 font-tajawal mb-4">اختر الإجراء المناسب لحالة العضو:</p>
            
            <div className="grid gap-3 mb-5 text-right">
              {/* Option 1: Temporary Suspension */}
              <button
                type="button"
                onClick={async () => {
                  await updateMember(deleteFor.id, { status: 'suspended', statusReason: 'تعطيل مؤقت من الإدارة' });
                  setDeleteFor(null);
                  setSelected(null);
                  showLocalToast('تم تعطيل حساب العضو مؤقتاً بنجاح');
                }}
                className="p-3.5 rounded-2xl border-2 border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 transition-all text-right flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">⚠️</div>
                <div>
                  <h4 className="font-cairo font-bold text-xs text-amber-900">تعطيل الحساب مؤقتاً (Suspend)</h4>
                  <p className="text-[11px] text-slate-600 font-tajawal mt-0.5">يخفي الملف من البحث والموقع ويمنع العضو من تسجيل الدخول، مع الاحتفاظ ببياناته وإمكانية تفعيله مجدداً لاحقاً.</p>
                </div>
              </button>

              {/* Option 2: Hard Delete */}
              <button
                type="button"
                onClick={() => {
                  const targetId = deleteFor.id;
                  // إغلاق فوري + إزالة فورية من الواجهة، والطلب يجري في الخلفية
                  setDeleteFor(null);
                  setSelected(null);
                  showLocalToast('تم حذف العضو نهائياً من قاعدة البيانات');
                  hardDeleteMember(targetId).catch((err) => {
                    console.error('Hard delete failed:', err);
                    showLocalToast('تعذّر إكمال الحذف على الخادم — حدّث الصفحة وتأكد من صلاحيتك');
                  });
                }}
                className="p-3.5 rounded-2xl border-2 border-rose-200 hover:border-rose-400 bg-rose-50/30 hover:bg-rose-50 transition-all text-right flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 mt-0.5">☠️</div>
                <div>
                  <h4 className="font-cairo font-bold text-xs text-rose-900">حذف العضو نهائياً (Hard Delete)</h4>
                  <p className="text-[11px] text-slate-600 font-tajawal mt-0.5">يمسح العضو تماماً من قاعدة البيانات بما في ذلك كافة سجلاته ومعاملاته وإشعاراته، مما يتيح له إعادة التسجيل بنفس الهاتف أو البريد.</p>
                </div>
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteFor(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-600 font-cairo font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                إلغاء التراجع
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* نافذة تأكيد الإجراء الجماعي */}
      <Modal open={!!bulkConfirm} onClose={() => { if (!bulkBusy) { setBulkConfirm(null); setBulkReason(''); } }} title="تأكيد إجراء جماعي">
        {bulkConfirm && (
          <div className="text-center" dir="rtl">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
              bulkConfirm.action === 'delete' || bulkConfirm.action === 'ban' ? 'bg-rose-100' : 'bg-amber-100'
            }`}>
              {bulkConfirm.action === 'delete' ? <Trash2 className="w-7 h-7 text-rose-600" /> :
               bulkConfirm.action === 'ban' ? <UserX className="w-7 h-7 text-rose-600" /> :
               bulkConfirm.action === 'verify' ? <BadgeCheck className="w-7 h-7 text-blue-600" /> :
               <CheckCircle2 className="w-7 h-7 text-emerald-600" />}
            </div>
            <p className="font-cairo font-bold text-slate-800 mb-1">
              تطبيق «{bulkConfirm.label}» على <span className="text-amber-600">{selectedCount}</span> عضو؟
            </p>
            <p className="text-sm text-slate-500 font-tajawal mb-4">
              {bulkConfirm.action === 'delete'
                ? 'سيُحذف هؤلاء الأعضاء نهائياً ولا يمكن التراجع عن هذا الإجراء.'
                : 'سيتم تطبيق الإجراء على جميع الأعضاء المحددين دفعة واحدة.'}
            </p>
            {(bulkConfirm.action === 'ban' || bulkConfirm.action === 'suspend') && (
              <textarea
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                rows={2}
                placeholder="سبب الإجراء (اختياري — يظهر في ملف العضو)..."
                className="w-full mb-4 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-sm text-right"
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { if (!bulkBusy) { setBulkConfirm(null); setBulkReason(''); } }}
                disabled={bulkBusy}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-cairo font-bold text-sm hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={runBulk}
                disabled={bulkBusy}
                className={`flex-1 py-3 rounded-xl text-white font-cairo font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  bulkConfirm.action === 'delete' || bulkConfirm.action === 'ban' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-navy-900 hover:bg-navy-800'
                }`}
              >
                {bulkBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                {bulkBusy ? 'جارٍ التنفيذ...' : 'تأكيد'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* نافذة تغيير حالة فردية بسبب */}
      <Modal open={!!statusFor} onClose={() => { setStatusFor(null); setStatusReasonDraft(''); }} title="تغيير حالة الحساب">
        {statusFor && (
          <div dir="rtl">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
              statusFor.status === 'banned' ? 'bg-rose-100' : 'bg-orange-100'
            }`}>
              {statusFor.status === 'banned' ? <UserX className="w-7 h-7 text-rose-600" /> :
               <Ban className="w-7 h-7 text-orange-600" />}
            </div>
            <p className="font-cairo font-bold text-slate-800 text-center mb-1">
              {statusFor.status === 'banned' ? 'حظر نهائي' : 'إيقاف'} لحساب «{statusFor.member.nickname}»
            </p>
            <div className={`rounded-xl p-3 mb-4 mt-2 text-right border ${
              statusFor.status === 'banned' ? 'bg-rose-50 border-rose-200' : 'bg-orange-50 border-orange-200'
            }`}>
              <p className={`text-xs font-cairo leading-relaxed ${
                statusFor.status === 'banned' ? 'text-rose-700' : 'text-orange-700'
              }`}>
                {statusFor.status === 'banned'
                  ? '🚫 لن يتمكن العضو من الدخول أو الظهور في البحث أو صفحة الملف. الحساب يبقى مسجلاً ويمكن إعادة تفعيله لاحقاً.'
                  : '⏸️ يُوقف الحساب مؤقتاً عن النشاط — يختفي من البحث. يمكن إعادة التفعيل لاحقاً.'}
              </p>
            </div>
            <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">سبب الإجراء (يظهر في ملف العضو):</label>
            <textarea
              value={statusReasonDraft}
              onChange={(e) => setStatusReasonDraft(e.target.value)}
              rows={3}
              placeholder="مثال: مخالفة شروط الاستخدام، بلاغات متكررة..."
              className="w-full mb-4 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-sm text-right"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setStatusFor(null); setStatusReasonDraft(''); }}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-cairo font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={applyStatusChange}
                className={`flex-1 py-3 rounded-xl text-white font-cairo font-bold text-sm transition-all ${
                  statusFor.status === 'banned' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                تأكيد الإجراء
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Notify modal */}
      <Modal open={!!notifyFor} onClose={() => setNotifyFor(null)} title="إرسال إشعار للعضو">
        {notifyFor && (
          <div>
            <p className="text-sm text-slate-500 font-tajawal mb-3">
              سيصل هذا الإشعار إلى <strong className="text-slate-800">{notifyFor.nickname}</strong> داخل المنصة.
            </p>
            <textarea
              value={notifyText}
              onChange={(e) => setNotifyText(e.target.value)}
              rows={4}
              placeholder="نص الإشعار..."
              className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-sm"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {['نرحّب بك في توافق ✨', 'يرجى استكمال توثيق حسابك.', 'تمت مراجعة ملفك بنجاح ✓'].map((t) => (
                <button
                  key={t}
                  onClick={() => setNotifyText(t)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-cairo hover:bg-slate-200"
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                if (!notifyText.trim()) return;
                await notifyMember(notifyFor.id, notifyText.trim());
                setNotifyFor(null);
                showLocalToast('تم إرسال الإشعار ✓');
              }}
              disabled={!notifyText.trim()}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-white font-cairo font-bold text-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4 -scale-x-100" /> إرسال الإشعار
            </button>
          </div>
        )}
      </Modal>

      {/* Modal Quick Add Member */}
      <Modal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} title="إضافة عضو جديد مباشرة" size="lg">
        <div className="space-y-4 text-right" dir="rtl">
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center gap-2 text-amber-900 text-xs font-tajawal">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>يمكنك إدخال البيانات المباشرة أو استخدام التعبئة العشوائية للاختبار والتجربة السريعة.</span>
            </div>
            <button
              onClick={handleQuickAddRandom}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-cairo font-bold text-xs shrink-0 transition-colors shadow-2xs"
            >
              <RefreshCw className="w-3 h-3" /> توليد بيانات عشوائية
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">الاسم أو اللقب *</label>
              <input
                value={quickAddForm.nickname}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, nickname: e.target.value })}
                placeholder="مثال: نورة العتيبي"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">الجنس</label>
              <select
                value={quickAddForm.gender}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, gender: e.target.value as 'male' | 'female' })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
              >
                <option value="female">أنثى</option>
                <option value="male">ذكر</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">العمر</label>
              <input
                type="number"
                value={quickAddForm.age}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, age: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">المدينة</label>
              <input
                value={quickAddForm.city}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, city: e.target.value })}
                placeholder="الرياض"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">رقم الواتساب</label>
              <input
                value={quickAddForm.phone}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, phone: e.target.value })}
                placeholder="0501234567"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
              <input
                value={quickAddForm.email}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, email: e.target.value })}
                placeholder="member@twafok.sa"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">الباقة</label>
              <select
                value={quickAddForm.plan}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, plan: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
              >
                <option value="free">مجاني</option>
                <option value="gold">ذهبي</option>
                <option value="elite">نخبة</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">حالة الحساب</label>
              <select
                value={quickAddForm.status}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
              >
                <option value="active">نشط</option>
                <option value="pending">قيد المراجعة</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">نبذة عن العضو / مواصفات الزوج المطلوب</label>
            <textarea
              value={quickAddForm.aboutMe}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, aboutMe: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setQuickAddOpen(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-cairo font-bold text-xs hover:bg-slate-200 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleQuickAddSubmit}
              className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-cairo font-bold text-xs hover:bg-slate-800 transition-colors shadow-2xs"
            >
              حفظ وإنشاء العضو
            </button>
          </div>
        </div>
      </Modal>

      {/* Import modal */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="استيراد الأعضاء" size="lg">
        <div className="space-y-4 text-right" dir="rtl">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-800 font-tajawal leading-relaxed">
              ألصق بيانات الأعضاء بصيغة JSON. <strong>البريد الإلكتروني وكلمة السر غير مطلوبة</strong>. الحقول الفارغة يتم قبولها واستيرادها تلقائياً.
            </p>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={8}
            placeholder={`[\n  {\n    "nickname": "أحمد",\n    "gender": "male",\n    "age": 30,\n    "city": "الرياض",\n    "whatsapp": "0512345678"\n  }\n]`}
            className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-sm font-mono text-left"
            dir="ltr"
          />
          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold text-sm disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> استيراد الأعضاء
          </button>
        </div>
      </Modal>

      {/* Modal إدارة وتصنيف القوائم المخصصة */}
      <Modal open={showCustomListsModal} onClose={() => { setShowCustomListsModal(false); setEditingCustomList(null); setCustomListForm({ name: '', description: '', color: 'amber' }); }} title="إدارة القوائم المخصصة للأعضاء" size="lg">
        <div className="space-y-5 text-right font-tajawal" dir="rtl">
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4">
            <h4 className="text-xs font-cairo font-bold text-amber-900 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              إنشاء وتصنيف قوائم خاصة (مثل: أعضاء طرف أم زيد، معلمون، vip...)
            </h4>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              تتيح لك القوائم تجميع أعضاء محددين وتصنيفهم للوصول السريع والفلترة الفورية والتواصل المركز.
            </p>
          </div>

          {/* Form إضافة / تعديل قائمة */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <h5 className="text-xs font-cairo font-bold text-slate-800">
              {editingCustomList ? 'تعديل بيانات القائمة' : 'إنشاء قائمة جديدة'}
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">اسم القائمة *</label>
                <input
                  type="text"
                  value={customListForm.name}
                  onChange={(e) => setCustomListForm({ ...customListForm, name: e.target.value })}
                  placeholder="مثال: أعضاء طرف أم زيد، قطاع التعليم..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-cairo focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">لون الوسم والتمييز</label>
                <div className="flex items-center gap-1.5 pt-1">
                  {DEFAULT_LIST_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCustomListForm({ ...customListForm, color: c.value })}
                      className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center border transition-all ${c.bg} ${c.text} ${c.border} ${
                        customListForm.color === c.value ? 'ring-2 ring-slate-900 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={c.label}
                    >
                      ●
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">وصف أو ملاحظات القائمة (اختياري)</label>
              <input
                type="text"
                value={customListForm.description}
                onChange={(e) => setCustomListForm({ ...customListForm, description: e.target.value })}
                placeholder="ملاحظات توضيحية لهذه الفئة..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              {editingCustomList && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCustomList(null);
                    setCustomListForm({ name: '', description: '', color: 'amber' });
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-cairo font-bold hover:bg-slate-100"
                >
                  إلغاء
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!customListForm.name.trim()) return;
                  if (editingCustomList) {
                    await updateCustomList(editingCustomList.id, {
                      name: customListForm.name.trim(),
                      description: customListForm.description.trim(),
                      color: customListForm.color,
                    });
                    showLocalToast('تم تحديث القائمة بنجاح ✓');
                  } else {
                    await createCustomList(
                      customListForm.name.trim(),
                      customListForm.description.trim(),
                      customListForm.color
                    );
                    showLocalToast('تم إنشاء القائمة بنجاح ✓');
                  }
                  setEditingCustomList(null);
                  setCustomListForm({ name: '', description: '', color: 'amber' });
                  setCustomLists(getCustomLists());
                }}
                disabled={!customListForm.name.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-cairo font-bold text-xs disabled:opacity-50 transition-colors shadow-2xs"
              >
                {editingCustomList ? 'حفظ التعديلات' : 'إنشاء القائمة ✨'}
              </button>
            </div>
          </div>

          {/* عرض القوائم الحالية */}
          <div>
            <h5 className="text-xs font-cairo font-bold text-slate-800 mb-2">القوائم الحالية ({customLists.length})</h5>
            {customLists.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                لا توجد قوائم مخصصة منشأة بعد. قم بإنشاء أول قائمة أعلاه.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {customLists.map((list) => {
                  const colorStyles = getListColorStyles(list.color);
                  return (
                    <div
                      key={list.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="px-2 py-0.5 rounded-md text-[11px] font-cairo font-bold border"
                          style={{
                            backgroundColor: colorStyles.bg,
                            color: colorStyles.text,
                            borderColor: colorStyles.border,
                          }}
                        >
                          {list.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ({members.filter((m) => isMemberInCustomList(m, list.id) || isMemberInCustomList(m, list.name)).length} عضو)
                        </span>
                        {list.description && (
                          <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                            - {list.description}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCustomList(list);
                            setCustomListForm({
                              name: list.name,
                              description: list.description || '',
                              color: list.color || 'amber',
                            });
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                          title="تعديل"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`هل أنت متأكد من حذف قائمة "${list.name}"؟`)) {
                              await deleteCustomList(list.id);
                              setCustomLists(getCustomLists());
                              showLocalToast('تم حذف القائمة بنجاح ✓');
                            }
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal إسناد الأعضاء إلى القوائم المخصصة */}
      <Modal
        open={showAssignListModal}
        onClose={() => {
          setShowAssignListModal(false);
          setAssignTargetMemberIds([]);
        }}
        title={`إسناد القوائم المخصصة (${assignTargetMemberIds.length} عضو)`}
      >
        <div className="space-y-4 text-right font-tajawal" dir="rtl">
          <p className="text-xs text-slate-600 leading-relaxed">
            اختر القوائم التي ترغب بإسناد الأعضاء المحددين إليها أو إزالتهم منها:
          </p>

          {customLists.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl space-y-2">
              <p className="text-xs text-slate-500 font-cairo">لا توجد قوائم مخصصة منشأة بعد.</p>
              <button
                type="button"
                onClick={() => {
                  setShowAssignListModal(false);
                  setShowCustomListsModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-cairo font-bold text-xs"
              >
                إنشاء أول قائمة الآن ➕
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {customLists.map((list) => {
                const colorStyles = getListColorStyles(list.color);
                const allSelectedInList = assignTargetMemberIds.length > 0 && assignTargetMemberIds.every((id) =>
                  isMemberInCustomList(id, list.id)
                );
                const someSelectedInList =
                  !allSelectedInList &&
                  assignTargetMemberIds.some((id) => isMemberInCustomList(id, list.id));

                return (
                  <div
                    key={list.id}
                    onClick={async () => {
                      if (allSelectedInList) {
                        // إزالة من القائمة
                        for (const memberId of assignTargetMemberIds) {
                          await removeMemberFromCustomList(list.id, memberId);
                        }
                        showLocalToast(`تمت الإزالة من قائمة "${list.name}" ✓`);
                      } else {
                        // إسناد للقائمة
                        try {
                          await assignMembersToCustomList(list.id, assignTargetMemberIds);
                          await refresh();
                          showLocalToast(`تم الإسناد إلى قائمة "${list.name}" وحفظه في قاعدة البيانات ✓`);
                        } catch (error: any) {
                          showLocalToast(error?.message || 'تعذّر حفظ إسناد القائمة؛ لم يتم اعتماد العملية');
                        }
                      }
                      setCustomLists(getCustomLists());
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      allSelectedInList
                        ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          allSelectedInList
                            ? 'bg-amber-500 border-amber-600 text-slate-950'
                            : someSelectedInList
                            ? 'bg-amber-200 border-amber-400 text-amber-800'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {allSelectedInList && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        {someSelectedInList && <span className="text-xs font-bold leading-none">-</span>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded-md text-xs font-cairo font-bold border"
                            style={{
                              backgroundColor: colorStyles.bg,
                              color: colorStyles.text,
                              borderColor: colorStyles.border,
                            }}
                          >
                            {list.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ({members.filter((m) => isMemberInCustomList(m, list.id) || isMemberInCustomList(m, list.name)).length} عضو)
                          </span>
                        </div>
                        {list.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{list.description}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-cairo font-bold text-slate-400">
                      {allSelectedInList ? 'مُسند (اضغط للإزالة)' : 'اضغط للإسناد'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setShowAssignListModal(false);
                setShowCustomListsModal(true);
              }}
              className="text-xs text-amber-600 font-bold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> إنشاء أو إدارة قوائم أخرى
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAssignListModal(false);
                setAssignTargetMemberIds([]);
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-cairo font-bold text-xs hover:bg-slate-800 transition-colors"
            >
              تم وإغلاق
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      <AnimatePresence>
        {localToast && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 30, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-[100] px-5 py-3 rounded-2xl shadow-2xl font-cairo font-bold text-sm text-white bg-slate-900 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            {localToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
