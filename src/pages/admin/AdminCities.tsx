import { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import {
  Globe, MapPin, Plus, Trash2, Check, X, Search, Download, Upload,
  Clock, AlertCircle, CheckCircle2, XCircle, Edit3, FileJson, RefreshCw, GitMerge, FileText,
  Sparkles, Users, ChevronDown, ChevronUp, ArrowRight, CheckSquare, Square,
  Palette, Bell, FolderOutput
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../../components/ui/Modal';
import { type PendingCity, type ImportResult } from '../../lib/data/adapters/local/geoStore';
import { dataService } from '../../lib/data/DataService';

import { useApp } from '../../lib/AppContext';
import { COUNTRY_NATIONALITY_MAP } from '../../lib/registrationOptions';
import GeoSuggestionsPanel from './GeoSuggestionsPanel';
import { extractCustomFieldValues } from '../../lib/data/optionNormalizer';
import { SKIN_COLORS } from '../../lib/constants';

const getCountries = () => dataService.db.getCountries();
const getCountryNames = () => dataService.db.getCountryNames();
const getCities = (country: string) => dataService.db.getCities(country);
const getNationalities = () => dataService.db.getNationalities();
const addCountry = (name: string, code?: string, flag?: string) => dataService.db.addCountry(name, code, flag);
const addNationality = (name: string, country?: string, gender?: string) => dataService.db.addNationality(name, country, gender);
const removeNationality = (name: string) => dataService.db.removeNationality(name);
const renameNationality = (oldName: string, newName: string) => dataService.db.renameNationality(oldName, newName);
const removeCountry = (name: string) => dataService.db.removeCountry(name);
const renameCountry = (oldName: string, newName: string) => dataService.db.renameCountry(oldName, newName);
const addCityToCountry = (country: string, city: string) => dataService.db.addCityToCountry(country, city);
const removeCityFromCountry = (country: string, city: string) => dataService.db.removeCityFromCountry(country, city);
const renameCity = (country: string, oldName: string, newName: string) => dataService.db.renameCity(country, oldName, newName);
const adminMergeCities = (sourceCountry: string, sourceCity: string, targetCountry: string, targetCity: string) => dataService.db.adminMergeCities(sourceCountry, sourceCity, targetCountry, targetCity);
const adminMergeCountries = (sourceCountry: string, targetCountry: string) => dataService.db.adminMergeCountries(sourceCountry, targetCountry);
const batchUpdateMemberGeo = (kind: 'country' | 'city' | 'nationality' | 'skinColor' | 'education' | 'workType', oldValue: string, newValue: string, countryFilter?: string) =>
  dataService.db.batchUpdateMemberGeo(kind, oldValue, newValue, countryFilter);

const getPendingGeoSuggestions = () => dataService.db.getPendingGeoSuggestions();
const approvePendingGeo = (id: string, editedName?: string) => dataService.db.approvePendingGeo(id, editedName);
const mergePendingGeo = (id: string, targetName: string, targetCountry?: string) => dataService.db.mergePendingGeo(id, targetName, targetCountry);
const rejectPendingGeo = (id: string, reason?: string) => dataService.db.rejectPendingGeo(id, reason);
const deletePendingGeo = (id: string) => dataService.db.deletePendingGeo(id);

const exportAllCountries = () => dataService.db.exportAllCountries();
const exportCitiesForCountry = (country: string) => dataService.db.exportCitiesForCountry(country);
const exportAllGeo = () => dataService.db.exportAllGeo();
const importCountries = (json: string, mode?: 'merge' | 'replace') => dataService.db.importCountries(json, mode);
const importCitiesForCountry = (country: string, json: string, mode?: 'merge' | 'replace') => dataService.db.importCitiesForCountry(country, json, mode);
const importFullGeo = (json: string, mode?: 'merge' | 'replace') => dataService.db.importFullGeo(json, mode);
const resetGeoDB = () => dataService.db.resetGeoDB();
const refreshGeoDB = () => dataService.db.refreshGeoDB();

function normText(s: string): string {
  return (s || '').toString().trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').toLowerCase();
}

function getAllMembersList(): any[] {
  // adminGetMembers هو async لكن نحتاج البيانات متزامناً هنا — نعتمد على الكاش المحلي
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('saved_members_list') || localStorage.getItem('twafok_members') || localStorage.getItem('saved_admin_members_list');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {}
  // محاولة أخيرة عبر الكاش المتزامن
  try {
    const cached = dataService.db.getLiveMembers?.(true) || [];
    if (cached && cached.length > 0) return cached;
  } catch {}
  return [];
}

type Tab = 'countries' | 'cities' | 'nationalities' | 'skinColors' | 'import-export';

function countPendingByKind(kind: 'country' | 'city' | 'nationality'): number {
  try {
    return (dataService.db.getPendingGeoSuggestions() as any[]).filter((s) => s.kind === kind && s.status === 'pending').length;
  } catch { return 0; }
}

export default function AdminCities() {
  const { showToast } = useApp();
  const [tab, setTab] = useState<Tab>('countries');
  const [tick, setTick] = useState(0);
  const refresh = () => { refreshGeoDB(); setTick((t) => t + 1); };

  const countryPending = useMemo(() => countPendingByKind('country'), [tick]);
  const cityPending = useMemo(() => countPendingByKind('city'), [tick]);
  const nationalityPending = useMemo(() => countPendingByKind('nationality'), [tick]);

  const allMembers = useMemo(() => getAllMembersList(), [tick]);
  const skinOtherCount = useMemo(() => extractCustomFieldValues('skinColor', allMembers, SKIN_COLORS).length, [allMembers]);

  const tabs: { id: Tab; label: string; icon: typeof Globe; badge?: number }[] = [
    { id: 'countries', label: 'الدول', icon: Globe, badge: countryPending },
    { id: 'cities', label: 'المدن', icon: MapPin, badge: cityPending },
    { id: 'nationalities', label: 'الجنسيات', icon: FileText, badge: nationalityPending },
    { id: 'skinColors', label: 'البشرة', icon: Palette, badge: skinOtherCount },
    { id: 'import-export', label: 'استيراد / تصدير', icon: FileJson },
  ];

  return (
    <div className="space-y-6" key={tick}>
      {/* العنوان */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-cairo font-extrabold text-xl text-slate-900">إدارة الجغرافيا والجنسيات</h2>
            <p className="text-xs text-slate-500 font-tajawal mt-0.5">
              إدارة القوائم الرسمية، تصنيف خيارات «أخرى» المخصصة، وتحديث ملفات الأعضاء تلقائياً
            </p>
          </div>
        </div>
      </div>

      {/* التبويبات الرئيسية */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-cairo font-bold text-xs transition-all border-b-2 -mb-px
              ${tab === t.id ? 'border-amber-500 text-amber-600 bg-amber-50/60 shadow-xs' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center shadow-xs">
                {t.badge > 9 ? '9+' : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'countries' && <CountriesTab onAction={refresh} showToast={showToast} />}
          {tab === 'cities' && <CitiesTab onAction={refresh} showToast={showToast} />}
          {tab === 'nationalities' && <NationalitiesTab onAction={refresh} showToast={showToast} />}
          {tab === 'skinColors' && <CustomFieldTab title="لون البشرة" fieldKey="skinColor" defaultOptions={SKIN_COLORS} icon={Palette} onAction={refresh} showToast={showToast} />}
          {tab === 'import-export' && <ImportExportTab onAction={refresh} showToast={showToast} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ====================================================================
//  تبويب الدول (الرسمية + أخرى)
// ====================================================================
function CountriesTab({ onAction, showToast }: { onAction: () => void; showToast: (m: string, t?: 'success' | 'error' | 'info') => void }) {
  const [subTab, setSubTab] = useState<'official' | 'pending' | 'other'>('official');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // دمج الدول
  const [mergingCountry, setMergingCountry] = useState<string | null>(null);
  const [targetCountry, setTargetCountry] = useState('');
  const [isNewTargetCountry, setIsNewTargetCountry] = useState(false);
  const [newTargetCountryInput, setNewTargetCountryInput] = useState('');

  // توسيع تفاصيل الدول الأخرى لرؤية المدن فيها
  const [expandedOther, setExpandedOther] = useState<string | null>(null);

  // التحديد الجماعي للدول الرسمية
  const [selectedOfficialCountries, setSelectedOfficialCountries] = useState<string[]>([]);
  const [isBulkMergingOfficialCountries, setIsBulkMergingOfficialCountries] = useState(false);
  const [bulkTargetOfficialCountry, setBulkTargetOfficialCountry] = useState('');
  const [isBulkNewTargetOfficialCountry, setIsBulkNewTargetOfficialCountry] = useState(false);
  const [bulkNewTargetOfficialCountryInput, setBulkNewTargetOfficialCountryInput] = useState('');

  // التحديد الجماعي للدول الأخرى
  const [selectedOtherCountries, setSelectedOtherCountries] = useState<string[]>([]);
  const [isBulkMergingCountries, setIsBulkMergingCountries] = useState(false);
  const [bulkTargetCountryName, setBulkTargetCountryName] = useState('');

  const pendingCount = useMemo(() => {
    const suggestions = getPendingGeoSuggestions() as Array<{ kind: string; status: string }>;
    return suggestions.filter((s) => s.kind === 'country' && s.status === 'pending').length;
  }, [onAction]);

  const toggleSelectOfficialCountry = (name: string) => {
    setSelectedOfficialCountries((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const toggleSelectAllOfficialCountries = () => {
    if (selectedOfficialCountries.length === filteredOfficial.length) {
      setSelectedOfficialCountries([]);
    } else {
      setSelectedOfficialCountries(filteredOfficial.map((item) => item.name));
    }
  };

  const handleBulkMoveOfficialCountriesToOther = () => {
    if (selectedOfficialCountries.length === 0) return;
    let count = 0;
    selectedOfficialCountries.forEach((countryName) => {
      removeCountry(countryName);
      dataService.db.addPendingGeo?.('country', countryName, '', 'الإدارة', 'admin');
      count++;
    });
    setSelectedOfficialCountries([]);
    showToast(`تم نقل ${count} دول رسمية إلى قائمة «أخرى» بنجاح`, 'info');
    onAction();
  };

  const handleBulkDeleteOfficialCountries = () => {
    if (selectedOfficialCountries.length === 0) return;
    let count = 0;
    selectedOfficialCountries.forEach((countryName) => {
      removeCountry(countryName);
      count++;
    });
    setSelectedOfficialCountries([]);
    showToast(`تم حذف ${count} دول رسمية بنجاح`, 'info');
    onAction();
  };

  const handleBulkMergeOfficialCountries = () => {
    const destCountry = isBulkNewTargetOfficialCountry ? bulkNewTargetOfficialCountryInput.trim() : bulkTargetOfficialCountry;
    if (!destCountry) {
      showToast('يرجى اختيار أو كتابة الدولة المستهدفة للدمج الجماعي', 'error');
      return;
    }
    if (isBulkNewTargetOfficialCountry) {
      addCountry(destCountry);
    }
    let count = 0;
    selectedOfficialCountries.forEach((c) => {
      if (normText(c) !== normText(destCountry)) {
        const res = adminMergeCountries(c, destCountry);
        if (res.ok) count++;
      }
    });
    setSelectedOfficialCountries([]);
    setIsBulkMergingOfficialCountries(false);
    setBulkTargetOfficialCountry('');
    setIsBulkNewTargetOfficialCountry(false);
    setBulkNewTargetOfficialCountryInput('');
    showToast(`تم دمج ${count} دول رسمية بنجاح في «${destCountry}» وتم تحديث ملفات الأعضاء`, 'success');
    onAction();
  };

  const toggleSelectOtherCountry = (name: string) => {
    setSelectedOtherCountries((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const toggleSelectAllOtherCountries = () => {
    if (selectedOtherCountries.length === filteredOther.length) {
      setSelectedOtherCountries([]);
    } else {
      setSelectedOtherCountries(filteredOther.map((item) => item.name));
    }
  };

  const handleBulkPromoteCountries = () => {
    let count = 0;
    selectedOtherCountries.forEach((c) => {
      const res = addCountry(c);
      if (res.ok) count++;
    });
    setSelectedOtherCountries([]);
    showToast(`تمت ترقية ${count} دول رسمية للقائمة بنجاح`, 'success');
    onAction();
  };

  const handleBulkMergeCountries = () => {
    if (!bulkTargetCountryName) {
      showToast('يرجى اختيار الدولة المستهدفة للدمج الجماعي', 'error');
      return;
    }
    let count = 0;
    selectedOtherCountries.forEach((c) => {
      const res = adminMergeCountries(c, bulkTargetCountryName);
      if (res.ok) count++;
    });
    setSelectedOtherCountries([]);
    setIsBulkMergingCountries(false);
    setBulkTargetCountryName('');
    showToast(`تم دمج ${count} دول بنجاح في «${bulkTargetCountryName}» وتحديث ملفات الأعضاء`, 'success');
    onAction();
  };

  const officialCountriesList = useMemo(() => {
    const raw = getCountries();
    return raw
      .map((c: any) => {
        if (typeof c === 'string') return { name: c, code: '', flag: '' };
        return { name: c?.name || '', code: c?.code || '', flag: c?.flag || '' };
      })
      .filter((c) => Boolean(c.name));
  }, [onAction]);

  const officialNames = useMemo(() => officialCountriesList.map((c) => c.name), [officialCountriesList]);
  const officialNormSet = useMemo(() => new Set(officialNames.map((c) => normText(c))), [officialNames]);

  // الدول الأخرى
  const otherCountries = useMemo(() => {
    const members = getAllMembersList();
    const map = new Map<string, { name: string; memberCount: number; cities: Set<string> }>();

    members.forEach((m) => {
      const c = (m.country || '').trim();
      if (c && !officialNormSet.has(normText(c))) {
        const normKey = normText(c);
        if (!map.has(normKey)) {
          map.set(normKey, { name: c, memberCount: 0, cities: new Set() });
        }
        const item = map.get(normKey)!;
        item.memberCount++;
        if (m.city) item.cities.add(m.city.trim());
        if (m.residence) item.cities.add(m.residence.trim());
      }
    });

    const pendingGeo = getPendingGeoSuggestions();
    pendingGeo.forEach((g: any) => {
      if (g.kind === 'country' && g.name) {
        const c = g.name.trim();
        if (!officialNormSet.has(normText(c))) {
          const normKey = normText(c);
          if (!map.has(normKey)) {
            map.set(normKey, { name: c, memberCount: 0, cities: new Set() });
          }
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [officialNormSet, onAction]);

  const filteredOfficial = useMemo(() => {
    if (!search.trim()) return officialCountriesList;
    const q = search.toLowerCase();
    return officialCountriesList.filter((c) => c.name.toLowerCase().includes(q));
  }, [officialCountriesList, search]);

  const filteredOther = useMemo(() => {
    if (!search.trim()) return otherCountries;
    const q = search.toLowerCase();
    return otherCountries.filter((c) => c.name.toLowerCase().includes(q));
  }, [otherCountries, search]);

  const handleAddOfficial = () => {
    const result = addCountry(newName, newCode || undefined);
    if (result.ok) {
      showToast(`تمت إضافة دولة «${newName}» بالقائمة الرسمية`, 'success');
      setNewName(''); setNewCode(''); setAdding(false);
      onAction();
    } else showToast(result.error || 'تعذّرت الإضافة', 'error');
  };

  const handleRename = (oldName: string) => {
    const trimmed = editName.trim();
    if (!trimmed) { showToast('اسم الدولة مطلوب', 'error'); return; }
    const res = batchUpdateMemberGeo('country', oldName, trimmed);
    const result = renameCountry(oldName, trimmed);
    if (result.ok) {
      showToast(`تم تحديث اسم الدولة وتحديث ${res.updatedCount} من ملفات الأعضاء تلقائياً`, 'success');
      setEditing(null); setEditName('');
      onAction();
    } else showToast(result.error || 'تعذّر التحديث', 'error');
  };

  const handlePromoteOtherToOfficial = (otherName: string) => {
    const result = addCountry(otherName);
    if (result.ok) {
      showToast(`تمت ترقية الدولة «${otherName}» وإضافتها للقائمة الرسمية`, 'success');
      onAction();
    } else showToast(result.error || 'الدولة موجودة بالفعل بالقائمة الرسمية', 'info');
  };

  const handleMoveOfficialCountryToOther = (countryName: string) => {
    removeCountry(countryName);
    dataService.db.addPendingGeo?.('country', countryName, '', 'الإدارة', 'admin');
    showToast(`تم نقل الدولة «${countryName}» إلى قائمة «أخرى» بنجاح`, 'info');
    onAction();
  };

  const handleMergeCountries = () => {
    if (!mergingCountry) return;
    const destCountry = isNewTargetCountry ? newTargetCountryInput.trim() : targetCountry;
    if (!destCountry) {
      showToast('يرجى اختيار أو كتابة الدولة المستهدفة للدمج', 'error');
      return;
    }
    if (isNewTargetCountry) {
      addCountry(destCountry);
    }
    const result = adminMergeCountries(mergingCountry, destCountry);
    if (result.ok) {
      showToast(`تم دمج «${mergingCountry}» بنجاح في «${destCountry}» وتم تحديث ملفات الأعضاء`, 'success');
      setMergingCountry(null);
      setTargetCountry('');
      setIsNewTargetCountry(false);
      setNewTargetCountryInput('');
      onAction();
    } else {
      showToast(result.error || 'فشل دمج الدولة', 'error');
    }
  };

  const handleDeleteOtherCountry = (countryName: string) => {
    const suggestions = getPendingGeoSuggestions();
    const matched = suggestions.filter((s: any) => s.kind === 'country' && normText(s.name) === normText(countryName));
    matched.forEach((s) => deletePendingGeo(s.id));
    showToast(`تم إزالة «${countryName}» من القائمة بنجاح (مع الحفاظ على بيانات الأعضاء)`, 'info');
    onAction();
  };

  return (
    <div className="space-y-4">
      {/* الشريط الفرعي لتصنيف الرسمية مقابل المقترحات مقابل أخرى */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
          <button
            onClick={() => { setSubTab('official'); setSearch(''); }}
            className={`px-4 py-2 rounded-lg font-cairo font-bold text-xs transition-colors flex items-center gap-2
              ${subTab === 'official' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            الدول الرسمية ({officialCountriesList.length})
          </button>

          <button
            onClick={() => { setSubTab('pending'); setSearch(''); }}
            className={`px-4 py-2 rounded-lg font-cairo font-bold text-xs transition-colors flex items-center gap-2
              ${subTab === 'pending' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Bell className="w-4 h-4 text-amber-500" />
            المقترحات المعلقة ({pendingCount})
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setSubTab('other'); setSearch(''); }}
            className={`px-4 py-2 rounded-lg font-cairo font-bold text-xs transition-colors flex items-center gap-2
              ${subTab === 'other' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            خيارات أخرى ({otherCountries.length})
            {otherCountries.length > 0 && (
              <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {otherCountries.length}
              </span>
            )}
          </button>
        </div>

        {subTab !== 'pending' && (
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={subTab === 'official' ? 'ابحث في الدول الرسمية...' : 'ابحث في خيارات أخرى...'}
              className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none text-xs font-tajawal"
            />
          </div>
        )}

        {subTab === 'official' && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors font-cairo font-bold text-xs shadow-xs">
            <Plus className="w-4 h-4" /> دولة جديدة
          </button>
        )}
      </div>

      {subTab === 'pending' ? (
        <GeoSuggestionsPanel kind="country" onAction={onAction} showToast={showToast} embedded={true} />
      ) : subTab === 'official' ? (
        <>
          {adding && (
            <div className="bg-white rounded-2xl border border-amber-200 p-4 flex flex-wrap items-end gap-3 shadow-xs">
              <div className="flex-1 min-w-40">
                <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">اسم الدولة الرسمية</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus placeholder="مثال: تركيا" className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs" />
              </div>
              <div className="w-32">
                <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">الرمز (اختياري)</label>
                <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="TR" className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs uppercase" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setAdding(false); setNewName(''); setNewCode(''); }} className="px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
                <button onClick={handleAddOfficial} className="px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 font-cairo font-bold text-xs shadow-xs">حفظ الإضافة</button>
              </div>
            </div>
          )}

          {/* شريط التحكم بالتحديد الجماعي للدول الرسمية */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-3 rounded-xl mb-3">
            <button
              onClick={toggleSelectAllOfficialCountries}
              className="flex items-center gap-2 text-xs font-cairo font-bold text-slate-700 hover:text-amber-600"
            >
              {selectedOfficialCountries.length > 0 && selectedOfficialCountries.length === filteredOfficial.length ? (
                <CheckSquare className="w-4 h-4 text-amber-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              تحديد الكل ({filteredOfficial.length})
            </button>

            {selectedOfficialCountries.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-cairo font-extrabold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg">
                  تم تحديد ({selectedOfficialCountries.length})
                </span>

                <button
                  onClick={() => { setIsBulkMergingOfficialCountries(true); setBulkTargetOfficialCountry(''); setIsBulkNewTargetOfficialCountry(false); setBulkNewTargetOfficialCountryInput(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-cairo font-bold text-xs transition-colors shadow-xs"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  دمج جماعي ({selectedOfficialCountries.length})
                </button>

                <button
                  onClick={handleBulkMoveOfficialCountriesToOther}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-cairo font-bold text-xs transition-colors"
                >
                  <FolderOutput className="w-3.5 h-3.5" />
                  نقل لأخرى ({selectedOfficialCountries.length})
                </button>

                <button
                  onClick={handleBulkDeleteOfficialCountries}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-cairo font-bold text-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف المحدد ({selectedOfficialCountries.length})
                </button>
              </div>
            )}
          </div>

          {/* واجهة الدمج الجماعي للدول الرسمية */}
          {isBulkMergingOfficialCountries && (
            <div className="bg-amber-50 rounded-xl p-3.5 space-y-3 border border-amber-200 mb-3">
              <h4 className="font-cairo font-bold text-xs text-amber-900">
                دمج جماعي لـ ({selectedOfficialCountries.length}) دول رسمية في دولة رسمية أو جديدة
              </h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">نوع الدولة المستهدفة</label>
                  <div className="flex gap-2 h-8 items-center">
                    <button
                      type="button"
                      onClick={() => setIsBulkNewTargetOfficialCountry(false)}
                      className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-lg transition-all ${!isBulkNewTargetOfficialCountry ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}
                    >
                      دولة موجودة
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBulkNewTargetOfficialCountry(true)}
                      className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-lg transition-all ${isBulkNewTargetOfficialCountry ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}
                    >
                      جديدة
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">الدولة المستهدفة</label>
                  {isBulkNewTargetOfficialCountry ? (
                    <input
                      value={bulkNewTargetOfficialCountryInput}
                      onChange={(e) => setBulkNewTargetOfficialCountryInput(e.target.value)}
                      placeholder="اكتب اسم الدولة الجديدة للدمج..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
                    />
                  ) : (
                    <select
                      value={bulkTargetOfficialCountry}
                      onChange={(e) => setBulkTargetOfficialCountry(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white font-medium"
                    >
                      <option value="">— اختر دولة رسمية —</option>
                      {officialNames.filter((x) => !selectedOfficialCountries.includes(x)).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => { setIsBulkMergingOfficialCountries(false); setIsBulkNewTargetOfficialCountry(false); setBulkNewTargetOfficialCountryInput(''); }} className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
                <button onClick={handleBulkMergeOfficialCountries} disabled={isBulkNewTargetOfficialCountry ? !bulkNewTargetOfficialCountryInput.trim() : !bulkTargetOfficialCountry} className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 font-cairo font-bold text-xs flex items-center gap-1.5 shadow-xs">
                  <GitMerge className="w-3.5 h-3.5" /> تأكيد الدمج الجماعي
                </button>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredOfficial.map((c) => (
              <div key={c.name} className={`bg-white rounded-2xl border p-3.5 flex items-center gap-3 shadow-xs transition-colors ${selectedOfficialCountries.includes(c.name) ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 hover:border-amber-200'}`}>
                <button
                  onClick={() => toggleSelectOfficialCountry(c.name)}
                  className="p-1 text-slate-400 hover:text-amber-600"
                  title="تحديد"
                >
                  {selectedOfficialCountries.includes(c.name) ? (
                    <CheckSquare className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300" />
                  )}
                </button>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  {editing === c.name ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleRename(c.name)} className="w-full px-2 py-1 rounded-lg border border-amber-400 focus:outline-none font-cairo font-bold text-xs" />
                  ) : (
                    <p className="font-cairo font-bold text-slate-900 text-xs truncate">{c.name}</p>
                  )}
                  <p className="text-[11px] text-slate-400 font-tajawal mt-0.5">{getCities(c.name).length} مدينة رسمية</p>
                </div>
                {editing === c.name ? (
                  <div className="flex gap-1">
                    <button onClick={() => handleRename(c.name)} className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600" title="حفظ وتحديث ملفات الأعضاء"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setEditing(null); setEditName(''); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(c.name); setEditName(c.name); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="تعديل الاسم (تحديث تلقائي)"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setMergingCountry(c.name); setTargetCountry(''); setIsNewTargetCountry(false); setNewTargetCountryInput(''); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="دمج مع دولة أخرى"><GitMerge className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleMoveOfficialCountryToOther(c.name)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="نقل الدولة إلى قسم «أخرى»"><FolderOutput className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { removeCountry(c.name); onAction(); showToast(`تم حذف الدولة «${c.name}» بنجاح`, 'info'); }} className="p-1.5 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500" title="حذف نهائي"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        /* قسم خيارات أخرى للدول */
        <div className="space-y-3">
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs font-tajawal text-amber-900 leading-relaxed flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>قسم الدول في خيار «أخرى»:</strong> يعرض الدول المخصصة أو التي تم إدخالها في حسابات الأعضاء أو الاقتراحات وليست ضمن القائمة الرسمية. يمكنك ترقيتها للرسمية، تعديل اسمها (ليتعدل في كافة ملفات الأعضاء تلقائياً)، أو دمجها.
            </div>
          </div>

          {filteredOther.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 font-tajawal text-xs">
              لا توجد دول في قائمة «أخرى» حالياً — جميع الدول في النظام معتمدة رسمياً!
            </div>
          ) : (
            <div className="space-y-3">
              {/* شريط التحكم بالتحديد الجماعي للدول */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <button
                  onClick={toggleSelectAllOtherCountries}
                  className="flex items-center gap-2 text-xs font-cairo font-bold text-slate-700 hover:text-amber-600"
                >
                  {selectedOtherCountries.length === filteredOther.length ? (
                    <CheckSquare className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  تحديد الكل ({filteredOther.length})
                </button>

                {selectedOtherCountries.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-cairo font-extrabold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg">
                      تم تحديد ({selectedOtherCountries.length})
                    </span>

                    <button
                      onClick={handleBulkPromoteCountries}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-xs flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> ترقية المحددة للرسمية
                    </button>

                    <button
                      onClick={() => setIsBulkMergingCountries(true)}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-cairo font-bold text-xs flex items-center gap-1 shadow-xs"
                    >
                      <GitMerge className="w-3.5 h-3.5" /> دمج المحددة مع رسمية
                    </button>
                  </div>
                )}
              </div>

              {/* واجهة الدمج الجماعي للدول */}
              {isBulkMergingCountries && (
                <div className="bg-sky-50 rounded-xl p-3.5 space-y-3 border border-sky-200">
                  <h4 className="font-cairo font-bold text-xs text-sky-900">
                    دمج جماعي لـ ({selectedOtherCountries.length}) دول في دولة رسمية
                  </h4>
                  <div>
                    <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">اختر الدولة الرسمية المستهدفة</label>
                    <select
                      value={bulkTargetCountryName}
                      onChange={(e) => setBulkTargetCountryName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
                    >
                      <option value="">— اختر دولة رسمية —</option>
                      {officialNames.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setIsBulkMergingCountries(false)} className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
                    <button onClick={handleBulkMergeCountries} disabled={!bulkTargetCountryName} className="px-3.5 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 font-cairo font-bold text-xs flex items-center gap-1.5 shadow-xs">
                      <GitMerge className="w-3.5 h-3.5" /> تأكيد الدمج الجماعي
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-3">
                {filteredOther.map((item) => {
                  const isSelected = selectedOtherCountries.includes(item.name);
                  const isExpanded = expandedOther === item.name;
                  const isEditing = editing === item.name;
                  const cityList = Array.from(item.cities);

                  return (
                    <div key={item.name} className={`bg-white rounded-2xl border p-4 shadow-xs transition-colors space-y-3 ${isSelected ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200 hover:border-amber-200'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectOtherCountry(item.name)}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-amber-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-amber-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300" />
                            )}
                          </button>
                          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                            <Globe className="w-5 h-5 text-amber-600" />
                          </div>
                        <div>
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleRename(item.name)}
                                className="px-2.5 py-1 rounded-lg border-2 border-amber-400 focus:outline-none font-cairo font-bold text-xs"
                              />
                              <button onClick={() => handleRename(item.name)} className="px-3 py-1 rounded-lg bg-emerald-500 text-white font-cairo font-bold text-xs">حفظ وتحديث</button>
                              <button onClick={() => { setEditing(null); setEditName(''); }} className="p-1 rounded-lg text-slate-400"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <p className="font-cairo font-extrabold text-slate-900 text-sm flex items-center gap-2">
                              {item.name}
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-tajawal">خيار أخرى</span>
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-tajawal">
                            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" /> {item.memberCount} عضوًا</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {cityList.length} مدن مسجلة</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handlePromoteOtherToOfficial(item.name)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-cairo font-bold text-xs flex items-center gap-1 transition-colors border border-emerald-200"
                        >
                          <Plus className="w-3.5 h-3.5" /> إضافة للرسمية
                        </button>

                        <button
                          onClick={() => { setEditing(item.name); setEditName(item.name); }}
                          className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 font-cairo font-bold text-xs flex items-center gap-1 transition-colors border border-sky-200"
                          title="تعديل الاسم لتحديث ملفات الأعضاء"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> تعديل الاسم
                        </button>

                        <button
                          onClick={() => { setMergingCountry(item.name); setTargetCountry(''); }}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-cairo font-bold text-xs flex items-center gap-1 transition-colors border border-amber-200"
                        >
                          <GitMerge className="w-3.5 h-3.5" /> دمج مع رسمية
                        </button>

                        <button
                          onClick={() => handleDeleteOtherCountry(item.name)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-cairo font-bold text-xs flex items-center gap-1 transition-colors border border-rose-200"
                          title="حذف هذا الخيار"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> حذف
                        </button>

                        <button
                          onClick={() => setExpandedOther(isExpanded ? null : item.name)}
                          className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 font-cairo text-xs flex items-center gap-1"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* قائمة المدن داخل هذه الدولة من فئة "أخرى" */}
                    {isExpanded && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 mt-2">
                        <p className="font-cairo font-bold text-xs text-slate-700">المدن المسجلة تحت دولة «{item.name}» ({cityList.length}):</p>
                        {cityList.length === 0 ? (
                          <p className="text-xs text-slate-400 font-tajawal">لا توجد مدن فرعية مسجلة بشكل منفصل.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {cityList.map((cityName) => (
                              <span key={cityName} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-tajawal text-slate-800 flex items-center gap-1.5 shadow-2xs">
                                <MapPin className="w-3 h-3 text-amber-500" />
                                {cityName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    )}

      {/* مودال دمج الدول */}
      <Modal open={!!mergingCountry} onClose={() => { setMergingCountry(null); setTargetCountry(''); setIsNewTargetCountry(false); setNewTargetCountryInput(''); }} title={`دمج الدولة «${mergingCountry}»`} size="sm">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-tajawal leading-relaxed">
              تنبيه دمج الدولة: سيتم نقل كافة الأعضاء والمدن المنسوبة لـ <strong>«{mergingCountry}»</strong> إلى الدولة المستهدفة وحذف المصدر من القوائم.
            </p>
          </div>

          <div>
            <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">نوع الدولة المستهدفة</label>
            <div className="flex gap-2 h-9 items-center mb-3">
              <button
                type="button"
                onClick={() => setIsNewTargetCountry(false)}
                className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-xl transition-all ${!isNewTargetCountry ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                دولة موجودة
              </button>
              <button
                type="button"
                onClick={() => setIsNewTargetCountry(true)}
                className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-xl transition-all ${isNewTargetCountry ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                دولة جديدة
              </button>
            </div>

            {isNewTargetCountry ? (
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">اسم الدولة الجديدة</label>
                <input
                  value={newTargetCountryInput}
                  onChange={(e) => setNewTargetCountryInput(e.target.value)}
                  placeholder="اكتب اسم الدولة الجديدة..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">اختر الدولة المستهدفة للدمج</label>
                <select
                  value={targetCountry}
                  onChange={(e) => setTargetCountry(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
                >
                  <option value="">-- اختر دولة --</option>
                  {Array.from(new Set([...officialNames, ...getCountryNames()]))
                    .filter((x) => normText(x) !== normText(mergingCountry || ''))
                    .map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setMergingCountry(null); setTargetCountry(''); setIsNewTargetCountry(false); setNewTargetCountryInput(''); }} className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
            <button
              onClick={handleMergeCountries}
              disabled={isNewTargetCountry ? !newTargetCountryInput.trim() : !targetCountry}
              className="px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 font-cairo font-bold text-xs"
            >
              تأكيد الدمج والحذف
            </button>
          </div>
        </div>
      </Modal>

      {/* مودال الدمج الجماعي للدول الرسمية */}
      <Modal
        open={isBulkMergingOfficialCountries}
        onClose={() => { setIsBulkMergingOfficialCountries(false); setBulkTargetOfficialCountry(''); setIsBulkNewTargetOfficialCountry(false); setBulkNewTargetOfficialCountryInput(''); }}
        title={`دمج جماعي لـ ${selectedOfficialCountries.length} دول رسمية`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-tajawal text-amber-900 leading-relaxed">
              سيتم دمج كافة الدول المحددة ({selectedOfficialCountries.length}) ونقل جميع أعضائها ومدنها إلى الدولة المستهدفة، ثم إزالة الدول القديمة من القائمة الرسمية.
            </p>
          </div>

          <div>
            <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">نوع الدولة المستهدفة</label>
            <div className="flex gap-2 h-9 items-center mb-3">
              <button
                type="button"
                onClick={() => setIsBulkNewTargetOfficialCountry(false)}
                className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-xl transition-all ${!isBulkNewTargetOfficialCountry ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                دولة موجودة
              </button>
              <button
                type="button"
                onClick={() => setIsBulkNewTargetOfficialCountry(true)}
                className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-xl transition-all ${isBulkNewTargetOfficialCountry ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                دولة جديدة
              </button>
            </div>

            {isBulkNewTargetOfficialCountry ? (
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">اسم الدولة الجديدة</label>
                <input
                  value={bulkNewTargetOfficialCountryInput}
                  onChange={(e) => setBulkNewTargetOfficialCountryInput(e.target.value)}
                  placeholder="اكتب اسم الدولة الجديدة..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">اختر الدولة المستهدفة للدمج</label>
                <select
                  value={bulkTargetOfficialCountry}
                  onChange={(e) => setBulkTargetOfficialCountry(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
                >
                  <option value="">-- اختر دولة --</option>
                  {officialNames
                    .filter((x) => !selectedOfficialCountries.includes(x))
                    .map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setIsBulkMergingOfficialCountries(false); setBulkTargetOfficialCountry(''); setIsBulkNewTargetOfficialCountry(false); setBulkNewTargetOfficialCountryInput(''); }} className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
            <button
              onClick={handleBulkMergeOfficialCountries}
              disabled={isBulkNewTargetOfficialCountry ? !bulkNewTargetOfficialCountryInput.trim() : !bulkTargetOfficialCountry}
              className="px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 font-cairo font-bold text-xs"
            >
              تأكيد الدمج الجماعي
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ====================================================================
//  تبويب المدن (الرسمية + أخرى)
// ====================================================================
function CitiesTab({ onAction, showToast }: { onAction: () => void; showToast: (m: string, t?: 'success' | 'error' | 'info') => void }) {
  const [selectedCountry, setSelectedCountry] = useState('');
  const [subTab, setSubTab] = useState<'official' | 'pending' | 'other'>('official');
  const [search, setSearch] = useState('');
  const [newCity, setNewCity] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const pendingCount = useMemo(() => {
    const suggestions = getPendingGeoSuggestions() as Array<{ kind: string; status: string }>;
    return suggestions.filter((s) => s.kind === 'city' && s.status === 'pending').length;
  }, [onAction]);

  // دمج المدن
  const [mergingCity, setMergingCity] = useState<string | null>(null);
  const [targetCountryName, setTargetCountryName] = useState('');
  const [targetCityName, setTargetCityName] = useState('');
  const [isNewTargetCity, setIsNewTargetCity] = useState(false);
  const [newTargetCityInput, setNewTargetCityInput] = useState('');

  // التحديد الجماعي للمدن الرسمية
  const [selectedOfficialCities, setSelectedOfficialCities] = useState<string[]>([]);
  const [isBulkMergingOfficialCities, setIsBulkMergingOfficialCities] = useState(false);
  const [bulkOfficialTargetCityCountry, setBulkOfficialTargetCityCountry] = useState('');
  const [bulkOfficialTargetCityName, setBulkOfficialTargetCityName] = useState('');
  const [isBulkOfficialNewTargetCity, setIsBulkOfficialNewTargetCity] = useState(false);
  const [bulkOfficialNewCityInput, setBulkOfficialNewCityInput] = useState('');

  // التحديد الجماعي لمدن أخرى
  const [selectedOtherCities, setSelectedOtherCities] = useState<string[]>([]);
  const [isBulkMergingCities, setIsBulkMergingCities] = useState(false);
  const [bulkTargetCityCountry, setBulkTargetCityCountry] = useState('');
  const [bulkTargetCityName, setBulkTargetCityName] = useState('');
  const [isBulkNewTargetCity, setIsBulkNewTargetCity] = useState(false);
  const [bulkNewCityInput, setBulkNewCityInput] = useState('');

  const toggleSelectOfficialCity = (name: string) => {
    setSelectedOfficialCities((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const toggleSelectAllOfficialCities = () => {
    if (selectedOfficialCities.length === filteredOfficial.length) {
      setSelectedOfficialCities([]);
    } else {
      setSelectedOfficialCities([...filteredOfficial]);
    }
  };

  const handleBulkMoveOfficialCitiesToOther = () => {
    if (selectedOfficialCities.length === 0) return;
    let count = 0;
    selectedOfficialCities.forEach((cityName) => {
      removeCityFromCountry(selectedCountry, cityName);
      dataService.db.addPendingGeo?.('city', cityName, selectedCountry, 'الإدارة', 'admin');
      count++;
    });
    setSelectedOfficialCities([]);
    showToast(`تم نقل ${count} مدن رسمية إلى قائمة مدن «أخرى» بنجاح`, 'info');
    onAction();
  };

  const handleBulkDeleteOfficialCities = () => {
    if (selectedOfficialCities.length === 0) return;
    let count = 0;
    selectedOfficialCities.forEach((cityName) => {
      removeCityFromCountry(selectedCountry, cityName);
      count++;
    });
    setSelectedOfficialCities([]);
    showToast(`تم حذف ${count} مدن رسمية بنجاح`, 'info');
    onAction();
  };

  const handleBulkMergeOfficialCities = () => {
    const destCity = isBulkOfficialNewTargetCity ? bulkOfficialNewCityInput.trim() : bulkOfficialTargetCityName;
    if (!bulkOfficialTargetCityCountry || !destCity) {
      showToast('يرجى تحديد الدولة والمدينة المستهدفة للدمج الجماعي', 'error');
      return;
    }
    let count = 0;
    selectedOfficialCities.forEach((city) => {
      const res = adminMergeCities(selectedCountry, city, bulkOfficialTargetCityCountry, destCity);
      if (res.ok) {
        count++;
        const suggestions = getPendingGeoSuggestions();
        const matched = suggestions.filter((s: any) => s.kind === 'city' && normText(s.name) === normText(city) && normText(s.country || '') === normText(selectedCountry));
        matched.forEach((s) => mergePendingGeo(s.id, destCity, bulkOfficialTargetCityCountry));
      }
    });
    setSelectedOfficialCities([]);
    setIsBulkMergingOfficialCities(false);
    setBulkOfficialTargetCityName('');
    setBulkOfficialTargetCityCountry('');
    setIsBulkOfficialNewTargetCity(false);
    setBulkOfficialNewCityInput('');
    showToast(`تم دمج ${count} مدن رسمية بنجاح في «${destCity} - ${bulkOfficialTargetCityCountry}» وتحديث كافة الأعضاء`, 'success');
    onAction();
  };

  const toggleSelectOtherCity = (name: string) => {
    setSelectedOtherCities((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const toggleSelectAllOtherCities = () => {
    if (selectedOtherCities.length === filteredOther.length) {
      setSelectedOtherCities([]);
    } else {
      setSelectedOtherCities(filteredOther.map((item) => item.name));
    }
  };

  const handleBulkPromoteCities = () => {
    let count = 0;
    selectedOtherCities.forEach((city) => {
      const res = addCityToCountry(selectedCountry, city);
      if (res.ok) count++;
    });
    setSelectedOtherCities([]);
    showToast(`تمت ترقية ${count} مدن للقائمة الرسمية بـ ${selectedCountry}`, 'success');
    onAction();
  };

  const handleBulkMergeCities = () => {
    const destCity = isBulkNewTargetCity ? bulkNewCityInput.trim() : bulkTargetCityName;
    if (!bulkTargetCityCountry || !destCity) {
      showToast('يرجى تحديد الدولة والمدينة المستهدفة للدمج الجماعي', 'error');
      return;
    }
    let count = 0;
    selectedOtherCities.forEach((city) => {
      const res = adminMergeCities(selectedCountry, city, bulkTargetCityCountry, destCity);
      if (res.ok) {
        count++;
        const suggestions = getPendingGeoSuggestions();
        const matched = suggestions.filter((s: any) => s.kind === 'city' && normText(s.name) === normText(city) && normText(s.country || '') === normText(selectedCountry));
        matched.forEach((s) => mergePendingGeo(s.id, destCity, bulkTargetCityCountry));
      }
    });
    setSelectedOtherCities([]);
    setIsBulkMergingCities(false);
    setBulkTargetCityName('');
    setBulkTargetCityCountry('');
    setIsBulkNewTargetCity(false);
    setBulkNewCityInput('');
    showToast(`تم دمج ${count} مدن بنجاح في «${destCity} - ${bulkTargetCityCountry}» وتحديث كافة الأعضاء`, 'success');
    onAction();
  };

  const countries = useMemo(() => getCountryNames(), [onAction]);
  useEffect(() => {
    if (!selectedCountry && countries.length > 0) setSelectedCountry(countries[0]);
  }, [countries, selectedCountry]);

  useEffect(() => {
    if (mergingCity && !targetCountryName) {
      setTargetCountryName(selectedCountry);
    }
  }, [mergingCity, selectedCountry, targetCountryName]);

  const officialCities = useMemo(
    () =>
      selectedCountry
        ? getCities(selectedCountry)
            .map((c: any) => (typeof c === 'string' ? c : c?.name || ''))
            .filter(Boolean)
        : [],
    [selectedCountry, onAction]
  );
  const officialCitiesNormSet = useMemo(() => new Set(officialCities.map((c) => normText(c))), [officialCities]);

  // مدن أخرى تحت الدولة المحددة
  const otherCities = useMemo(() => {
    if (!selectedCountry) return [];
    const members = getAllMembersList();
    const map = new Map<string, { name: string; memberCount: number }>();
    const normSelectedCountry = normText(selectedCountry);

    members.forEach((m) => {
      if (normText(m.country || '') === normSelectedCountry) {
        const city = (m.city || m.residence || '').trim();
        if (city && !officialCitiesNormSet.has(normText(city))) {
          const normKey = normText(city);
          if (!map.has(normKey)) {
            map.set(normKey, { name: city, memberCount: 0 });
          }
          map.get(normKey)!.memberCount++;
        }
      }
    });

    const pendingGeo = getPendingGeoSuggestions();
    pendingGeo.forEach((g: any) => {
      if (g.kind === 'city' && g.name && normText(g.country || '') === normSelectedCountry) {
        const city = g.name.trim();
        if (!officialCitiesNormSet.has(normText(city))) {
          const normKey = normText(city);
          if (!map.has(normKey)) {
            map.set(normKey, { name: city, memberCount: 0 });
          }
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [selectedCountry, officialCitiesNormSet, onAction]);

  const filteredOfficial = useMemo(() => {
    if (!search.trim()) return officialCities;
    const q = search.toLowerCase();
    return officialCities.filter((c) => c.toLowerCase().includes(q));
  }, [officialCities, search]);

  const filteredOther = useMemo(() => {
    if (!search.trim()) return otherCities;
    const q = search.toLowerCase();
    return otherCities.filter((c) => c.name.toLowerCase().includes(q));
  }, [otherCities, search]);

  const targetCountryCities = useMemo(() => {
    if (!targetCountryName) return [];
    const official = getCities(targetCountryName)
      .map((c: any) => (typeof c === 'string' ? c : c?.name || ''))
      .filter(Boolean);
    const normTargetCountry = normText(targetCountryName);
    const members = getAllMembersList();
    const otherList: string[] = [];
    members.forEach((m) => {
      if (normText(m.country || '') === normTargetCountry) {
        const city = (m.city || m.residence || '').trim();
        if (city) otherList.push(city);
      }
    });
    const combined = Array.from(new Set([...official, ...otherList])).sort((a, b) => a.localeCompare(b, 'ar'));
    return combined.filter((c) => !(targetCountryName === selectedCountry && normText(c) === normText(mergingCity || '')));
  }, [targetCountryName, selectedCountry, mergingCity, onAction]);

  const bulkOfficialTargetCountryCities = useMemo(() => {
    if (!bulkOfficialTargetCityCountry) return [];
    const official = getCities(bulkOfficialTargetCityCountry)
      .map((c: any) => (typeof c === 'string' ? c : c?.name || ''))
      .filter(Boolean);
    const normTargetCountry = normText(bulkOfficialTargetCityCountry);
    const members = getAllMembersList();
    const otherList: string[] = [];
    members.forEach((m) => {
      if (normText(m.country || '') === normTargetCountry) {
        const city = (m.city || m.residence || '').trim();
        if (city) otherList.push(city);
      }
    });
    const combined = Array.from(new Set([...official, ...otherList])).sort((a, b) => a.localeCompare(b, 'ar'));
    return combined.filter((c) => !(bulkOfficialTargetCityCountry === selectedCountry && selectedOfficialCities.includes(c)));
  }, [bulkOfficialTargetCityCountry, selectedCountry, selectedOfficialCities, onAction]);

  const bulkOtherTargetCountryCities = useMemo(() => {
    if (!bulkTargetCityCountry) return [];
    const official = getCities(bulkTargetCityCountry)
      .map((c: any) => (typeof c === 'string' ? c : c?.name || ''))
      .filter(Boolean);
    const normTargetCountry = normText(bulkTargetCityCountry);
    const members = getAllMembersList();
    const otherList: string[] = [];
    members.forEach((m) => {
      if (normText(m.country || '') === normTargetCountry) {
        const city = (m.city || m.residence || '').trim();
        if (city) otherList.push(city);
      }
    });
    const combined = Array.from(new Set([...official, ...otherList])).sort((a, b) => a.localeCompare(b, 'ar'));
    return combined.filter((c) => !(bulkTargetCityCountry === selectedCountry && selectedOtherCities.includes(c)));
  }, [bulkTargetCityCountry, selectedCountry, selectedOtherCities, onAction]);

  const handleAddOfficial = () => {
    const result = addCityToCountry(selectedCountry, newCity);
    if (result.ok) {
      showToast(`تمت إضافة «${newCity}» لمدن ${selectedCountry}`, 'success');
      setNewCity('');
      onAction();
    } else showToast(result.error || 'تعذّرت الإضافة', 'error');
  };

  const handleRename = (oldName: string) => {
    const trimmed = editName.trim();
    if (!trimmed) { showToast('اسم المدينة مطلوب', 'error'); return; }
    const res = batchUpdateMemberGeo('city', oldName, trimmed, selectedCountry);
    const result = renameCity(selectedCountry, oldName, trimmed);
    if (result.ok) {
      showToast(`تم تحديث اسم المدينة وتحديث ${res.updatedCount} ملف عضو بنجاح`, 'success');
      setEditing(null); setEditName('');
      onAction();
    } else showToast(result.error || 'تعذّر التحديث', 'error');
  };

  const handlePromoteOtherCity = (cityName: string) => {
    const result = addCityToCountry(selectedCountry, cityName);
    if (result.ok) {
      showToast(`تمت ترقية المدينة «${cityName}» وإضافتها للمدن الرسمية بـ ${selectedCountry}`, 'success');
      onAction();
    } else showToast(result.error || 'المدينة موجودة بالفعل', 'info');
  };

  const handleMergeCities = () => {
    if (!mergingCity) return;
    const destCity = isNewTargetCity ? newTargetCityInput.trim() : targetCityName;
    if (!targetCountryName || !destCity) {
      showToast('يرجى تحديد المدينة والدولة المستهدفة للدمج', 'error');
      return;
    }
    const result = adminMergeCities(selectedCountry, mergingCity, targetCountryName, destCity);
    if (result.ok) {
      const suggestions = getPendingGeoSuggestions();
      const matched = suggestions.filter((s: any) => s.kind === 'city' && normText(s.name) === normText(mergingCity) && normText(s.country || '') === normText(selectedCountry));
      matched.forEach((s) => mergePendingGeo(s.id, destCity, targetCountryName));

      showToast(`تم دمج المدينة «${mergingCity}» بنجاح في «${destCity} - ${targetCountryName}» وتم تحديث كافة الأعضاء`, 'success');
      setMergingCity(null);
      setTargetCityName('');
      setNewTargetCityInput('');
      setIsNewTargetCity(false);
      onAction();
    } else {
      showToast(result.error || 'فشل دمج المدينة', 'error');
    }
  };

  const handleDeleteOfficialCity = (cityName: string) => {
    removeCityFromCountry(selectedCountry, cityName);
    showToast(`تم حذف المدينة «${cityName}» بنجاح`, 'info');
    onAction();
  };

  const handleMoveOfficialToOther = (cityName: string) => {
    removeCityFromCountry(selectedCountry, cityName);
    dataService.db.addPendingGeo?.('city', cityName, selectedCountry, 'الإدارة', 'admin');
    showToast(`تم نقل المدينة «${cityName}» إلى قائمة مدن «أخرى» بنجاح`, 'info');
    onAction();
  };

  const handleDeleteOtherCity = (cityName: string) => {
    const suggestions = getPendingGeoSuggestions();
    const matched = suggestions.filter((s: any) => s.kind === 'city' && normText(s.name) === normText(cityName) && normText(s.country || '') === normText(selectedCountry));
    matched.forEach((s) => deletePendingGeo(s.id));
    showToast(`تم إزالة «${cityName}» من القائمة بنجاح (مع الحفاظ على بيانات الأعضاء)`, 'info');
    onAction();
  };

  return (
    <div className="space-y-4">
      {/* اختيار الدولة + التبويب الفرعي للرسمية مقابل المقترحات مقابل أخرى */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-end gap-3">
          {subTab !== 'pending' && (
            <div className="min-w-56 flex-1">
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">اختر الدولة لعرض مدنها</label>
              <select
                value={selectedCountry}
                onChange={(e) => { setSelectedCountry(e.target.value); setSearch(''); }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
              >
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
            <button
              onClick={() => { setSubTab('official'); setSearch(''); }}
              className={`px-3.5 py-1.5 rounded-lg font-cairo font-bold text-xs transition-colors flex items-center gap-1.5
                ${subTab === 'official' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600'}`}
            >
              المدن الرسمية ({officialCities.length})
            </button>

            <button
              onClick={() => { setSubTab('pending'); setSearch(''); }}
              className={`px-3.5 py-1.5 rounded-lg font-cairo font-bold text-xs transition-colors flex items-center gap-1.5
                ${subTab === 'pending' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600'}`}
            >
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              المقترحات المعلقة ({pendingCount})
              {pendingCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setSubTab('other'); setSearch(''); }}
              className={`px-3.5 py-1.5 rounded-lg font-cairo font-bold text-xs transition-colors flex items-center gap-1.5
                ${subTab === 'other' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600'}`}
            >
              مدن أخرى ({otherCities.length})
            </button>
          </div>

          {subTab !== 'pending' && (
            <div className="relative flex-1 min-w-40">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن مدينة..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
              />
            </div>
          )}
        </div>

        {subTab === 'official' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <input
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddOfficial()}
              placeholder={`أضف مدينة جديدة لـ ${selectedCountry}...`}
              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
            />
            <button onClick={handleAddOfficial} disabled={!selectedCountry} className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 font-cairo font-bold text-xs shadow-xs">
              <Plus className="w-4 h-4" /> إضافة للمدن
            </button>
          </div>
        )}
      </div>

      {subTab === 'pending' ? (
        <GeoSuggestionsPanel kind="city" onAction={onAction} showToast={showToast} embedded={true} />
      ) : subTab === 'official' ? (
        filteredOfficial.length === 0 ? (
          <EmptyState icon={MapPin} title="لا توجد مدن رسمية" desc={`أضف مدناً جديدة لـ ${selectedCountry} أو استورد قائمة`} />
        ) : (
          <div className="space-y-3">
            {/* شريط التحكم بالتحديد الجماعي للمدن الرسمية */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <button
                onClick={toggleSelectAllOfficialCities}
                className="flex items-center gap-2 text-xs font-cairo font-bold text-slate-700 hover:text-amber-600"
              >
                {selectedOfficialCities.length > 0 && selectedOfficialCities.length === filteredOfficial.length ? (
                  <CheckSquare className="w-4 h-4 text-amber-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                تحديد الكل ({filteredOfficial.length})
              </button>

              {selectedOfficialCities.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-cairo font-extrabold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg">
                    تم تحديد ({selectedOfficialCities.length})
                  </span>

                  <button
                    onClick={() => { setIsBulkMergingOfficialCities(true); setBulkOfficialTargetCityCountry(selectedCountry); setBulkOfficialTargetCityName(''); setIsBulkOfficialNewTargetCity(false); setBulkOfficialNewCityInput(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-cairo font-bold text-xs transition-colors shadow-xs"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    دمج جماعي ({selectedOfficialCities.length})
                  </button>

                  <button
                    onClick={handleBulkMoveOfficialCitiesToOther}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-cairo font-bold text-xs transition-colors"
                  >
                    <FolderOutput className="w-3.5 h-3.5" />
                    نقل لأخرى ({selectedOfficialCities.length})
                  </button>

                  <button
                    onClick={handleBulkDeleteOfficialCities}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-cairo font-bold text-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف المحدد ({selectedOfficialCities.length})
                  </button>
                </div>
              )}
            </div>

            {/* واجهة الدمج الجماعي للمدن الرسمية */}
            {isBulkMergingOfficialCities && (
              <div className="bg-amber-50 rounded-xl p-3.5 space-y-3 border border-amber-200 my-3">
                <h4 className="font-cairo font-bold text-xs text-amber-900">
                  دمج جماعي لـ ({selectedOfficialCities.length}) مدن رسمية في مدينة رسمية أو جديدة
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">اختر الدولة المستهدفة</label>
                    <select
                      value={bulkOfficialTargetCityCountry}
                      onChange={(e) => {
                        setBulkOfficialTargetCityCountry(e.target.value);
                        setBulkOfficialTargetCityName('');
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white font-medium"
                    >
                      <option value="">— اختر دولة —</option>
                      {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-cairo font-bold text-slate-600">المدينة المستهدفة</label>
                      <div className="flex gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setIsBulkOfficialNewTargetCity(false)}
                          className={`px-2 py-0.5 rounded font-bold transition-colors ${!isBulkOfficialNewTargetCity ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}
                        >
                          رسمية
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsBulkOfficialNewTargetCity(true)}
                          className={`px-2 py-0.5 rounded font-bold transition-colors ${isBulkOfficialNewTargetCity ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}
                        >
                          جديدة
                        </button>
                      </div>
                    </div>
                    {isBulkOfficialNewTargetCity ? (
                      <input
                        value={bulkOfficialNewCityInput}
                        onChange={(e) => setBulkOfficialNewCityInput(e.target.value)}
                        placeholder="اكتب اسم المدينة الجديدة للدمج..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
                      />
                    ) : (
                      <select
                        value={bulkOfficialTargetCityName}
                        onChange={(e) => setBulkOfficialTargetCityName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white disabled:opacity-50"
                        disabled={!bulkOfficialTargetCityCountry}
                      >
                        <option value="">— اختر مدينة —</option>
                        {bulkOfficialTargetCountryCities.map((cityName) => (
                          <option key={cityName} value={cityName}>{cityName}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setIsBulkMergingOfficialCities(false); setIsBulkOfficialNewTargetCity(false); setBulkOfficialNewCityInput(''); }} className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
                  <button onClick={handleBulkMergeOfficialCities} disabled={!bulkOfficialTargetCityCountry || (isBulkOfficialNewTargetCity ? !bulkOfficialNewCityInput.trim() : !bulkOfficialTargetCityName)} className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 font-cairo font-bold text-xs flex items-center gap-1.5 shadow-xs">
                    <GitMerge className="w-3.5 h-3.5" /> تأكيد الدمج الجماعي
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {filteredOfficial.map((c) => (
                <div key={c} className={`rounded-xl border pl-2 pr-3 py-1.5 flex items-center gap-2 group shadow-2xs transition-colors ${selectedOfficialCities.includes(c) ? 'border-amber-400 bg-amber-50/40' : 'bg-white border-slate-200 hover:border-amber-200'}`}>
                  <button
                    onClick={() => toggleSelectOfficialCity(c)}
                    className="text-slate-400 hover:text-amber-600"
                    title="تحديد"
                  >
                    {selectedOfficialCities.includes(c) ? (
                      <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-300" />
                    )}
                  </button>
                  {editing === c ? (
                    <>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleRename(c)} className="px-2 py-0.5 rounded border border-amber-400 focus:outline-none font-tajawal text-xs w-32" />
                      <button onClick={() => handleRename(c)} className="text-emerald-500 hover:text-emerald-600" title="حفظ وتحديث ملفات الأعضاء"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setEditing(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                    </>
                  ) : (
                    <>
                      <span className="font-tajawal text-xs text-slate-800 font-semibold">{c}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditing(c); setEditName(c); }} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="تعديل الاسم (تحديث تلقائي)"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setMergingCity(c); setTargetCountryName(selectedCountry); setTargetCityName(''); setIsNewTargetCity(false); setNewTargetCityInput(''); }} className="p-1 rounded-lg text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="دمج مع مدينة أو دولة أخرى"><GitMerge className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleMoveOfficialToOther(c)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="نقل المدينة إلى قسم «أخرى»"><FolderOutput className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteOfficialCity(c)} className="p-1 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors" title="حذف المدينة"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        /* قسم مدن أخرى تحت الدولة المحددة */
        <div className="space-y-3">
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 text-xs font-tajawal text-amber-900 leading-relaxed flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>مدن «أخرى» المسجلة تحت دولة <strong>{selectedCountry}</strong>: يمكنك إضافتها رسمياً أو تعديل اسمها مع التحديث التلقائي لملفات الأعضاء.</span>
          </div>

          {filteredOther.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 font-tajawal text-xs">
              لا توجد مدن غير معتمدة تحت دولة {selectedCountry}
            </div>
          ) : (
            <div className="space-y-3">
              {/* شريط التحكم بالتحديد الجماعي للمدن */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <button
                  onClick={toggleSelectAllOtherCities}
                  className="flex items-center gap-2 text-xs font-cairo font-bold text-slate-700 hover:text-amber-600"
                >
                  {selectedOtherCities.length === filteredOther.length ? (
                    <CheckSquare className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  تحديد الكل ({filteredOther.length})
                </button>

                {selectedOtherCities.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-cairo font-extrabold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg">
                      تم تحديد ({selectedOtherCities.length})
                    </span>

                    <button
                      onClick={handleBulkPromoteCities}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-xs flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> ترقية المحددة للرسمية
                    </button>

                    <button
                      onClick={() => {
                        setIsBulkMergingCities(true);
                        setBulkTargetCityCountry(selectedCountry);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-cairo font-bold text-xs flex items-center gap-1 shadow-xs"
                    >
                      <GitMerge className="w-3.5 h-3.5" /> دمج المحددة مع مدينة
                    </button>
                  </div>
                )}
              </div>

              {/* واجهة الدمج الجماعي للمدن */}
              {isBulkMergingCities && (
                <div className="bg-sky-50 rounded-xl p-3.5 space-y-3 border border-sky-200">
                  <h4 className="font-cairo font-bold text-xs text-sky-900">
                    دمج جماعي لـ ({selectedOtherCities.length}) مدن في مدينة رسمية أو جديدة
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">اختر الدولة المستهدفة</label>
                      <select
                        value={bulkTargetCityCountry}
                        onChange={(e) => {
                          setBulkTargetCityCountry(e.target.value);
                          setBulkTargetCityName('');
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
                      >
                        <option value="">— اختر دولة —</option>
                        {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-cairo font-bold text-slate-600">المدينة المستهدفة</label>
                        <div className="flex gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setIsBulkNewTargetCity(false)}
                            className={`px-2 py-0.5 rounded font-bold transition-colors ${!isBulkNewTargetCity ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                          >
                            رسمية
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsBulkNewTargetCity(true)}
                            className={`px-2 py-0.5 rounded font-bold transition-colors ${isBulkNewTargetCity ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                          >
                            جديدة
                          </button>
                        </div>
                      </div>
                      {isBulkNewTargetCity ? (
                        <input
                          value={bulkNewCityInput}
                          onChange={(e) => setBulkNewCityInput(e.target.value)}
                          placeholder="اكتب اسم المدينة الجديدة للدمج..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-sky-400 focus:outline-none font-tajawal text-xs bg-white"
                        />
                      ) : (
                        <select
                          value={bulkTargetCityName}
                          onChange={(e) => setBulkTargetCityName(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white disabled:opacity-50"
                          disabled={!bulkTargetCityCountry}
                        >
                          <option value="">— اختر مدينة —</option>
                          {bulkOtherTargetCountryCities.map((cityName) => (
                            <option key={cityName} value={cityName}>{cityName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setIsBulkMergingCities(false); setIsBulkNewTargetCity(false); setBulkNewCityInput(''); }} className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
                    <button onClick={handleBulkMergeCities} disabled={!bulkTargetCityCountry || (isBulkNewTargetCity ? !bulkNewCityInput.trim() : !bulkTargetCityName)} className="px-3.5 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 font-cairo font-bold text-xs flex items-center gap-1.5 shadow-xs">
                      <GitMerge className="w-3.5 h-3.5" /> تأكيد الدمج الجماعي
                    </button>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                {filteredOther.map((item) => {
                  const isSelected = selectedOtherCities.includes(item.name);
                  return (
                    <div key={item.name} className={`bg-white rounded-2xl border p-3.5 flex items-center justify-between gap-3 shadow-2xs transition-colors ${isSelected ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200 hover:border-amber-200'}`}>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSelectOtherCity(item.name)}
                          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-amber-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                        {editing === item.name ? (
                          <div className="flex items-center gap-1">
                            <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus className="px-2 py-1 rounded-lg border border-amber-400 text-xs font-tajawal w-32" />
                            <button onClick={() => handleRename(item.name)} className="p-1 rounded-lg bg-emerald-500 text-white"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditing(null)} className="p-1 text-slate-400"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <p className="font-cairo font-bold text-slate-900 text-xs flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-amber-500" />
                            {item.name}
                            <span className="text-[10px] text-slate-400 font-tajawal">({item.memberCount} عضوًا)</span>
                          </p>
                        )}
                      </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handlePromoteOtherCity(item.name)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-cairo font-bold text-[11px] flex items-center gap-1 border border-emerald-200"
                    >
                      <Plus className="w-3 h-3" /> ترقية للرسمية
                    </button>
                    <button
                      onClick={() => { setEditing(item.name); setEditName(item.name); }}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                      title="تعديل وتحديث الملفات"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setMergingCity(item.name); setTargetCountryName(selectedCountry); setTargetCityName(''); setIsNewTargetCity(false); setNewTargetCityInput(''); }}
                      className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                      title="دمج مع مدينة رسمية"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteOtherCity(item.name)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                      title="حذف هذا الخيار"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}
      </div>
    )}

      {/* مودال دمج المدينة */}
      <Modal open={!!mergingCity} onClose={() => { setMergingCity(null); }} title={`دمج المدينة «${mergingCity}»`} size="sm">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-tajawal leading-relaxed">
              تنبيه دمج المدينة: سيتم تحويل كافة الأعضاء المنتمين لمدينة <strong>«{mergingCity}»</strong> إلى المدينة والدولة المستهدفة وحذف المصدر.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">الدولة المستهدفة</label>
              <select
                value={targetCountryName}
                onChange={(e) => { setTargetCountryName(e.target.value); setTargetCityName(''); }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white font-medium"
              >
                <option value="">-- اختر دولة --</option>
                {countries.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">نوع المدينة المستهدفة</label>
              <div className="flex gap-2 h-9 items-center">
                <button
                  type="button"
                  onClick={() => setIsNewTargetCity(false)}
                  className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-xl transition-all ${!isNewTargetCity ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  مدينة رسمية
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewTargetCity(true)}
                  className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-xl transition-all ${isNewTargetCity ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  جديدة
                </button>
              </div>
            </div>
          </div>

          {isNewTargetCity ? (
            <div>
              <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">اسم المدينة الجديدة</label>
              <input
                value={newTargetCityInput}
                onChange={(e) => setNewTargetCityInput(e.target.value)}
                placeholder="مثال: مكة المكرمة"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">اختر المدينة المستهدفة</label>
              <select
                value={targetCityName}
                onChange={(e) => setTargetCityName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
              >
                <option value="">-- اختر مدينة --</option>
                {targetCountryCities.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setMergingCity(null); }} className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
            <button
              onClick={handleMergeCities}
              disabled={isNewTargetCity ? !newTargetCityInput.trim() : !targetCityName}
              className="px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 font-cairo font-bold text-xs"
            >
              تأكيد الدمج
            </button>
          </div>
        </div>
      </Modal>

      {/* مودال الدمج الجماعي للمدن الرسمية */}
      <Modal
        open={isBulkMergingOfficialCities}
        onClose={() => { setIsBulkMergingOfficialCities(false); setBulkOfficialTargetCityName(''); setBulkOfficialTargetCityCountry(''); setIsBulkOfficialNewTargetCity(false); setBulkOfficialNewCityInput(''); }}
        title={`دمج جماعي لـ ${selectedOfficialCities.length} مدن رسمية من «${selectedCountry}»`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-tajawal text-amber-900 leading-relaxed">
              سيتم دمج كافة المدن المحددة ({selectedOfficialCities.length}) ونقل جميع الأعضاء المنسوبين إليها إلى الدولة والمدينة المستهدفة، ثم إزالتها من المدن الرسمية.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">الدولة المستهدفة</label>
              <select
                value={bulkOfficialTargetCityCountry}
                onChange={(e) => { setBulkOfficialTargetCityCountry(e.target.value); setBulkOfficialTargetCityName(''); }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
              >
                <option value="">-- اختر دولة --</option>
                {countries.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">نوع المدينة المستهدفة</label>
              <div className="flex gap-2 h-9 items-center">
                <button
                  type="button"
                  onClick={() => setIsBulkOfficialNewTargetCity(false)}
                  className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-xl transition-all ${!isBulkOfficialNewTargetCity ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  مدينة رسمية
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkOfficialNewTargetCity(true)}
                  className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-xl transition-all ${isBulkOfficialNewTargetCity ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  جديدة
                </button>
              </div>
            </div>
          </div>

          {isBulkOfficialNewTargetCity ? (
            <div>
              <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">اسم المدينة الجديدة</label>
              <input
                value={bulkOfficialNewCityInput}
                onChange={(e) => setBulkOfficialNewCityInput(e.target.value)}
                placeholder="مثال: الرياض"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">اختر المدينة المستهدفة</label>
              <select
                value={bulkOfficialTargetCityName}
                onChange={(e) => setBulkOfficialTargetCityName(e.target.value)}
                disabled={!bulkOfficialTargetCityCountry}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white disabled:opacity-50"
              >
                <option value="">-- اختر مدينة --</option>
                {bulkOfficialTargetCountryCities.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setIsBulkMergingOfficialCities(false); setBulkOfficialTargetCityName(''); setBulkOfficialTargetCityCountry(''); setIsBulkOfficialNewTargetCity(false); setBulkOfficialNewCityInput(''); }} className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
            <button
              onClick={handleBulkMergeOfficialCities}
              disabled={!bulkOfficialTargetCityCountry || (isBulkOfficialNewTargetCity ? !bulkOfficialNewCityInput.trim() : !bulkOfficialTargetCityName)}
              className="px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 font-cairo font-bold text-xs"
            >
              تأكيد الدمج الجماعي
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ====================================================================
//  تبويب الجنسيات (الرسمية / الرئيسية + أخرى)
// ====================================================================
function NationalitiesTab({ onAction, showToast }: { onAction: () => void; showToast: (m: string, t?: 'success' | 'error' | 'info') => void }) {
  const [subTab, setSubTab] = useState<'official' | 'pending' | 'other'>('official');
  const [search, setSearch] = useState('');
  const [newNationalityName, setNewNationalityName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const pendingCount = useMemo(() => {
    const suggestions = getPendingGeoSuggestions() as Array<{ kind: string; status: string }>;
    return suggestions.filter((s) => s.kind === 'nationality' && s.status === 'pending').length;
  }, [onAction]);

  // دمج جنسية أخرى مع جنسية رسمية
  const [mergingNat, setMergingNat] = useState<string | null>(null);
  const [targetOfficialNat, setTargetOfficialNat] = useState('');

  // التحديد الجماعي لجنسيات أخرى
  const [selectedOtherNationalities, setSelectedOtherNationalities] = useState<string[]>([]);
  const [isBulkMergingNationalities, setIsBulkMergingNationalities] = useState(false);
  const [bulkTargetNationalityName, setBulkTargetNationalityName] = useState('');

  const toggleSelectOtherNationality = (name: string) => {
    setSelectedOtherNationalities((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const toggleSelectAllOtherNationalities = () => {
    if (selectedOtherNationalities.length === filteredOther.length) {
      setSelectedOtherNationalities([]);
    } else {
      setSelectedOtherNationalities(filteredOther.map((item) => item.name));
    }
  };

  const handleBulkPromoteNationalities = () => {
    let count = 0;
    selectedOtherNationalities.forEach((nat) => {
      const res = addNationality(nat);
      if (!res || res.ok !== false) count++;
    });
    setSelectedOtherNationalities([]);
    showToast(`تمت ترقية ${count} جنسيات للقائمة الرسمية الرئيسية`, 'success');
    onAction();
  };

  const handleBulkMergeNationalities = () => {
    if (!bulkTargetNationalityName) {
      showToast('اختر الجنسية الرسمية المستهدفة للدمج الجماعي', 'error');
      return;
    }
    let totalMembersUpdated = 0;
    const countSelected = selectedOtherNationalities.length;
    selectedOtherNationalities.forEach((nat) => {
      const res = batchUpdateMemberGeo('nationality', nat, bulkTargetNationalityName);
      removeNationality(nat);
      totalMembersUpdated += res.updatedCount;
    });
    setSelectedOtherNationalities([]);
    setIsBulkMergingNationalities(false);
    setBulkTargetNationalityName('');
    showToast(`تم دمج ${countSelected} جنسيات في «${bulkTargetNationalityName}» وتحديث ${totalMembersUpdated} من ملفات الأعضاء`, 'success');
    onAction();
  };

  const officialCountryNames = useMemo(() => getCountryNames(), [onAction]);

  // الجنسيات الرسمية / الرئيسية: قائمة غير مكررة تحتوي على أسماء الجنسيات / الدول
  const officialNationalitiesList = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    const dbNats = getNationalities();
    dbNats.forEach((n) => {
      if (!n) return;
      const name = n.trim();
      if (!name) return;
      const norm = normText(name);
      if (norm && !map.has(norm)) {
        map.set(norm, { id: `nat_${name}`, name });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [officialCountryNames, onAction]);

  const officialNatNormSet = useMemo(() => new Set(officialNationalitiesList.map(x => normText(x.name))), [officialNationalitiesList]);

  // جنسيات أخرى (غير معتمدة في القائمة الرسمية)
  const otherNationalitiesList = useMemo(() => {
    const members = getAllMembersList();
    const map = new Map<string, { name: string; memberCount: number; sampleCountry?: string }>();

    members.forEach((m) => {
      const nat = (m.nationality || '').trim();
      if (nat && !officialNatNormSet.has(normText(nat))) {
        const normKey = normText(nat);
        if (!map.has(normKey)) {
          map.set(normKey, { name: nat, memberCount: 0, sampleCountry: m.country || '' });
        }
        map.get(normKey)!.memberCount++;
      }
    });

    const pendingGeo = getPendingGeoSuggestions();
    pendingGeo.forEach((g: any) => {
      if (g.kind === 'nationality' && g.name) {
        const nat = g.name.trim();
        if (!officialNatNormSet.has(normText(nat))) {
          const normKey = normText(nat);
          if (!map.has(normKey)) {
            map.set(normKey, { name: nat, memberCount: 0, sampleCountry: g.country || '' });
          }
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [officialNatNormSet, onAction]);

  const filteredOfficial = useMemo(() => {
    if (!search.trim()) return officialNationalitiesList;
    const q = search.toLowerCase();
    return officialNationalitiesList.filter((item) => item.name.toLowerCase().includes(q));
  }, [officialNationalitiesList, search]);

  const filteredOther = useMemo(() => {
    if (!search.trim()) return otherNationalitiesList;
    const q = search.toLowerCase();
    return otherNationalitiesList.filter((item) => item.name.toLowerCase().includes(q));
  }, [otherNationalitiesList, search]);

  const handleAddOfficial = () => {
    const nat = newNationalityName.trim();
    if (!nat) {
      showToast('ادخل اسم الجنسية أو الدولة', 'error');
      return;
    }

    const res = addNationality(nat, nat, 'both');
    if (!res || res.ok !== false) {
      setNewNationalityName('');
      onAction();
      showToast(`تمت إضافة جنسية «${nat}» للقائمة الرسمية`, 'success');
    } else {
      showToast(res?.error || 'تعذّرت الإضافة', 'info');
    }
  };

  const handleSaveOfficialEdit = (item: { id: string; name: string }) => {
    const val = editingValue.trim();
    if (!val) { showToast('ادخل اسم الجنسية الجديد', 'error'); return; }

    const res = batchUpdateMemberGeo('nationality', item.name, val);
    renameNationality(item.name, val);

    setEditingId(null);
    setEditingValue('');
    onAction();
    showToast(`تم تعديل اسم الجنسية وتحديث ${res.updatedCount} ملف عضو بنجاح`, 'success');
  };

  const handlePromoteOtherNationality = (otherNatName: string) => {
    const res = addNationality(otherNatName);
    if (!res || res.ok !== false) {
      onAction();
      showToast(`تمت ترقية الجنسية «${otherNatName}» وإضافتها للقائمة الرسمية`, 'success');
    } else {
      showToast('الجنسية موجودة بالفعل بالقائمة الرسمية', 'info');
    }
  };

  const handleRenameOtherNationality = (oldName: string) => {
    const val = editingValue.trim();
    if (!val) { showToast('اسم الجنسية مطلوب', 'error'); return; }

    const res = batchUpdateMemberGeo('nationality', oldName, val);
    renameNationality(oldName, val);

    setEditingId(null);
    setEditingValue('');
    onAction();
    showToast(`تم تعديل اسم الجنسية وتحديث ${res.updatedCount} من ملفات الأعضاء تلقائياً`, 'success');
  };

  const handleMergeOtherNat = () => {
    if (!mergingNat || !targetOfficialNat) {
      showToast('يرجى اختيار الجنسية الرسمية المستهدفة', 'error');
      return;
    }
    const res = batchUpdateMemberGeo('nationality', mergingNat, targetOfficialNat);
    removeNationality(mergingNat);
    setMergingNat(null);
    setTargetOfficialNat('');
    onAction();
    showToast(`تم دمج الجنسية «${mergingNat}» في «${targetOfficialNat}» وتحديث ${res.updatedCount} من ملفات الأعضاء`, 'success');
  };

  const handleDeleteOfficial = (item: { id: string; name: string }) => {
    removeNationality(item.name);
    onAction();
    showToast(`تم حذف جنسية «${item.name}»`, 'info');
  };

  const handleDeleteOtherNationality = (natName: string) => {
    const suggestions = getPendingGeoSuggestions();
    const matched = suggestions.filter((s: any) => s.kind === 'nationality' && normText(s.name) === normText(natName));
    matched.forEach((s) => deletePendingGeo(s.id));
    showToast(`تم إزالة «${natName}» من القائمة بنجاح (مع الحفاظ على بيانات الأعضاء)`, 'info');
    onAction();
  };

  const exportNationalities = () => {
    const content = JSON.stringify(
      officialNationalitiesList.map((item) => ({ country: item.name, nationality: item.name })),
      null,
      2
    );
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twafok-nationalities-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('تم تصدير ملف الجنسيات', 'success');
  };

  const importNationalities = () => {
    try {
      const parsed = JSON.parse(importText);
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.nationalities) ? parsed.nationalities : [];
      if (rows.length === 0) { showToast('الملف لا يحتوي على قائمة جنسيات', 'error'); return; }
      let count = 0;
      rows.forEach((row: any) => {
        if (typeof row === 'string') {
          addNationality(row.trim());
          count++;
        } else if (row.nationality || row.name) {
          const nat = String(row.nationality || row.name).trim();
          const country = String(row.country || nat).trim();
          addNationality(nat, country, 'both');
          count++;
        }
      });
      setImportText('');
      setImportOpen(false);
      onAction();
      showToast(`تم استيراد ${count} جنسية بنجاح`, 'success');
    } catch {
      showToast('تعذر قراءة ملف JSON. استخدم الصيغة: [{"country":"السعودية","nationality":"سعودي"}]', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* شريط التحكم الفرعي: الرسمية vs المقترحات vs أخرى */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
          <button
            onClick={() => { setSubTab('official'); setSearch(''); }}
            className={`px-4 py-2 rounded-lg font-cairo font-bold text-xs transition-colors flex items-center gap-2
              ${subTab === 'official' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            الجنسيات الرسمية الرئيسية ({officialNationalitiesList.length})
          </button>

          <button
            onClick={() => { setSubTab('pending'); setSearch(''); }}
            className={`px-4 py-2 rounded-lg font-cairo font-bold text-xs transition-colors flex items-center gap-2
              ${subTab === 'pending' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Bell className="w-4 h-4 text-amber-500" />
            المقترحات المعلقة ({pendingCount})
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setSubTab('other'); setSearch(''); }}
            className={`px-4 py-2 rounded-lg font-cairo font-bold text-xs transition-colors flex items-center gap-2
              ${subTab === 'other' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            جنسيات أخرى ({otherNationalitiesList.length})
            {otherNationalitiesList.length > 0 && (
              <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {otherNationalitiesList.length}
              </span>
            )}
          </button>
        </div>

        {subTab === 'official' && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportNationalities} className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-cairo font-bold text-xs flex items-center gap-1.5 shadow-xs">
              <Download className="w-3.5 h-3.5" /> تصدير
            </button>
            <button onClick={() => setImportOpen((v) => !v)} className="px-3 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-cairo font-bold text-xs flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-emerald-600" /> استيراد
            </button>
          </div>
        )}
      </div>

      {subTab === 'pending' ? (
        <GeoSuggestionsPanel kind="nationality" onAction={onAction} showToast={showToast} extraGender={true} embedded={true} />
      ) : subTab === 'official' ? (
        <>
          {importOpen && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <p className="text-xs font-cairo font-bold text-emerald-800">صيغة الاستيراد: JSON بالدول والجنسيات مثل: [{'{'}"country":"السعودية","nationality":"سعودي"{'}'}]</p>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={4} placeholder='[{"country":"السعودية","nationality":"سعودي"}]' className="w-full px-3 py-2 rounded-xl border border-emerald-200 focus:border-emerald-500 focus:outline-none font-mono text-xs bg-white" dir="ltr" />
              <button onClick={importNationalities} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-cairo font-bold text-xs shadow-xs">تنفيذ الاستيراد</button>
            </div>
          )}

          {/* شريط الإضافة والبحث للجنسيات الرسمية */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 grid sm:grid-cols-12 gap-3 items-end shadow-xs">
            <div className="sm:col-span-6">
              <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">البحث في الجنسيات الرسمية</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم الجنسية أو الدولة..." className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none text-xs font-tajawal" />
              </div>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">اسم الجنسية / الدولة الجديد</label>
              <input value={newNationalityName} onChange={(e) => setNewNationalityName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddOfficial()} placeholder="مثال: السعودية" className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none text-xs font-tajawal" />
            </div>

            <div className="sm:col-span-2">
              <button onClick={handleAddOfficial} className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-cairo font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs">
                <Plus className="w-4 h-4" /> إضافة رسمية
              </button>
            </div>
          </div>

          {/* جدول الجنسيات الرسمية */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="grid grid-cols-[2fr_1fr] gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-cairo font-bold text-slate-600">
              <span>الجنسية / الدولة</span>
              <span className="text-left">الإجراءات</span>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredOfficial.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <div key={item.id} className="grid grid-cols-[2fr_1fr] gap-3 px-4 py-3 items-center hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Globe className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 max-w-xs">
                          <input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveOfficialEdit(item)}
                            className="px-2.5 py-1 rounded-lg border border-amber-400 focus:outline-none font-tajawal text-xs w-full"
                          />
                          <button onClick={() => handleSaveOfficialEdit(item)} className="p-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600" title="حفظ وتحديث ملفات الأعضاء"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setEditingId(null); setEditingValue(''); }} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <span className="font-cairo font-extrabold text-slate-900 text-xs">{item.name}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 justify-end">
                      {!isEditing && (
                        <>
                          <button onClick={() => { setEditingId(item.id); setEditingValue(item.name); }} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-cairo text-xs flex items-center gap-1" title="تعديل الاسم (تحديث تلقائي لملفات الأعضاء)">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setMergingNat(item.name); setTargetOfficialNat(''); }} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 font-cairo text-xs flex items-center gap-1" title="دمج مع جنسية رسمية أخرى">
                            <GitMerge className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button onClick={() => handleDeleteOfficial(item)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 font-cairo text-xs flex items-center gap-1" title="حذف">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredOfficial.length === 0 && (
                <div className="p-8 text-center text-slate-400 font-tajawal text-xs">
                  لا توجد نتائج مطابقة للجنسيات الرسمية
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* قسم جنسيات أخرى */
        <div className="space-y-3">
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs font-tajawal text-amber-900 leading-relaxed flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>قسم الجنسيات في خيار «أخرى»:</strong> يحتوي على الجنسيات غير المربوطة بالدول الرسمية أو المدخلة مخصصة في ملفات الأعضاء. يمكنك إضافة أي من هذه الجنسيات للرئيسية الرسمية، تعديل اسم الجنسية (حيث يتعدل تلقائياً في كل ملفات الأعضاء المنسوبة لها)، أو دمجها مع جنسية رسمية.
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في جنسيات أخرى..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none text-xs font-tajawal bg-white"
            />
          </div>

          {filteredOther.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 font-tajawal text-xs">
              لا توجد جنسيات في قائمة «أخرى» — كل الجنسيات المسجلة مطابقة للقائمة الرسمية!
            </div>
          ) : (
            <div className="space-y-3">
              {/* شريط التحكم بالتحديد الجماعي للجنسيات */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <button
                  onClick={toggleSelectAllOtherNationalities}
                  className="flex items-center gap-2 text-xs font-cairo font-bold text-slate-700 hover:text-amber-600"
                >
                  {selectedOtherNationalities.length === filteredOther.length ? (
                    <CheckSquare className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  تحديد الكل ({filteredOther.length})
                </button>

                {selectedOtherNationalities.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-cairo font-extrabold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg">
                      تم تحديد ({selectedOtherNationalities.length})
                    </span>

                    <button
                      onClick={handleBulkPromoteNationalities}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-xs flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> ترقية المحددة للرئيسية
                    </button>

                    <button
                      onClick={() => setIsBulkMergingNationalities(true)}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-cairo font-bold text-xs flex items-center gap-1 shadow-xs"
                    >
                      <GitMerge className="w-3.5 h-3.5" /> دمج المحددة مع جنسية
                    </button>
                  </div>
                )}
              </div>

              {/* واجهة الدمج الجماعي للجنسيات */}
              {isBulkMergingNationalities && (
                <div className="bg-sky-50 rounded-xl p-3.5 space-y-3 border border-sky-200">
                  <h4 className="font-cairo font-bold text-xs text-sky-900">
                    دمج جماعي لـ ({selectedOtherNationalities.length}) جنسية في جنسية رسمية
                  </h4>
                  <div>
                    <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">اختر الجنسية الرسمية المستهدفة للدمج</label>
                    <select
                      value={bulkTargetNationalityName}
                      onChange={(e) => setBulkTargetNationalityName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
                    >
                      <option value="">— اختر جنسية رسمية —</option>
                      {officialNationalitiesList.map((x) => (
                        <option key={x.id} value={x.name}>{x.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setIsBulkMergingNationalities(false)} className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
                    <button onClick={handleBulkMergeNationalities} disabled={!bulkTargetNationalityName} className="px-3.5 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 font-cairo font-bold text-xs flex items-center gap-1.5 shadow-xs">
                      <GitMerge className="w-3.5 h-3.5" /> تأكيد الدمج الجماعي
                    </button>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                {filteredOther.map((item) => {
                  const isSelected = selectedOtherNationalities.includes(item.name);
                  const isEditing = editingId === item.name;

                  return (
                    <div key={item.name} className={`bg-white rounded-2xl border p-4 shadow-2xs transition-colors space-y-3 ${isSelected ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200 hover:border-amber-200'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => toggleSelectOtherNationality(item.name)}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-amber-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                autoFocus
                                className="px-2.5 py-1 rounded-lg border-2 border-amber-400 text-xs font-tajawal w-36"
                              />
                              <button onClick={() => handleRenameOtherNationality(item.name)} className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white font-cairo font-bold text-xs">حفظ وتحديث</button>
                              <button onClick={() => setEditingId(null)} className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div>
                              <p className="font-cairo font-extrabold text-slate-900 text-sm flex items-center gap-2">
                                <FileText className="w-4 h-4 text-amber-500" />
                                {item.name}
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-tajawal">جنسية أخرى</span>
                              </p>
                              <p className="text-xs text-slate-500 font-tajawal mt-1 flex items-center gap-2">
                                <Users className="w-3.5 h-3.5 text-slate-400" /> {item.memberCount} عضوًا بهذه الجنسية
                                {item.sampleCountry && <span>— دولة العينة: {item.sampleCountry}</span>}
                              </p>
                            </div>
                          )}
                        </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => handlePromoteOtherNationality(item.name)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-cairo font-bold text-xs flex items-center gap-1 border border-emerald-200 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> إضافة للرئيسية
                        </button>

                        <button
                          onClick={() => { setEditingId(item.name); setEditingValue(item.name); }}
                          className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 font-cairo font-bold text-xs flex items-center gap-1 border border-sky-200 transition-colors"
                          title="تعديل الاسم لتحديث كل ملفات الأعضاء"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> تعديل الاسم
                        </button>

                        <button
                          onClick={() => { setMergingNat(item.name); setTargetOfficialNat(''); }}
                          className="p-2 rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                          title="دمج مع جنسية رسمية"
                        >
                          <GitMerge className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteOtherNationality(item.name)}
                          className="p-2 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                          title="حذف هذا الخيار"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    )}

      {/* مودال دمج جنسية أخرى مع جنسية رسمية */}
      <Modal open={!!mergingNat} onClose={() => { setMergingNat(null); setTargetOfficialNat(''); }} title={`دمج الجنسية «${mergingNat}»`} size="sm">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-tajawal leading-relaxed">
              تنبيه: دمج الجنسية <strong>«{mergingNat}»</strong> سيقوم بتحويل كافة الأعضاء المنتمين لها للجنسية الرسمية المستهدفة وحذف هذه القيمة من القوائم.
            </p>
          </div>

          <div>
            <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">اختر الجنسية الرسمية المستهدفة للدمج</label>
            <select
              value={targetOfficialNat}
              onChange={(e) => setTargetOfficialNat(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
            >
              <option value="">-- اختر جنسية رسمية --</option>
              {officialNationalitiesList.map((x) => (
                <option key={x.id} value={x.name}>{x.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setMergingNat(null); setTargetOfficialNat(''); }} className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
            <button
              onClick={handleMergeOtherNat}
              disabled={!targetOfficialNat}
              className="px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 font-cairo font-bold text-xs"
            >
              تأكيد الدمج وتحويل الأعضاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ====================================================================
//  تبويب الاستيراد والتصدير
// ====================================================================
function ImportExportTab({ onAction, showToast }: { onAction: () => void; showToast: (m: string, t?: 'success' | 'error' | 'info') => void }) {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importType, setImportType] = useState<'full' | 'countries' | 'cities'>('full');
  const [importCountry, setImportCountry] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ name: string; content: string } | null>(null);
  const countries = useMemo(() => getCountryNames(), [onAction]);

  useEffect(() => {
    if (!importCountry && countries.length > 0) setImportCountry(countries[0]);
  }, [countries, importCountry]);

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = (type: 'full' | 'countries' | 'cities') => {
    if (type === 'full') {
      downloadFile(exportAllGeo(), `twafok-geo-full-${Date.now()}.json`);
      showToast('تم تصدير كل الدول والمدن', 'success');
    } else if (type === 'countries') {
      downloadFile(exportAllCountries(), `twafok-countries-${Date.now()}.json`);
      showToast('تم تصدير قائمة الدول', 'success');
    } else {
      if (!importCountry) { showToast('اختر دولة أولاً', 'error'); return; }
      downloadFile(exportCitiesForCountry(importCountry), `twafok-cities-${importCountry}-${Date.now()}.json`);
      showToast(`تم تصدير مدن ${importCountry}`, 'success');
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setImportPreview({ name: file.name, content });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const doImport = () => {
    if (!importPreview) return;
    let result: ImportResult;
    if (importType === 'full') {
      result = importFullGeo(importPreview.content, importMode);
    } else if (importType === 'countries') {
      result = importCountries(importPreview.content, importMode);
    } else {
      if (!importCountry) { showToast('اختر دولة أولاً', 'error'); return; }
      result = importCitiesForCountry(importCountry, importPreview.content, importMode);
    }
    if (result.ok) {
      showToast(`تم استيراد ${result.imported} عنصر (${result.skipped} مكرر/متخطى)`, 'success');
      setImportPreview(null);
      onAction();
    } else {
      showToast(result.errors.join(' — ') || 'فشل الاستيراد', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-cairo font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
          <Download className="w-4 h-4 text-emerald-500" /> تصدير البيانات
        </h3>
        <p className="text-xs text-slate-400 font-tajawal mb-4">نزّل نسخة JSON من الدول أو المدن للاحتفاظ بها أو نقلها</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleExport('full')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-cairo font-bold text-xs border border-emerald-200 transition-colors">
            <FileJson className="w-4 h-4" /> تصدير الكل (دول + مدن)
          </button>
          <button onClick={() => handleExport('countries')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-cairo font-bold text-xs border border-blue-200 transition-colors">
            <Globe className="w-4 h-4" /> تصدير الدول فقط
          </button>
          <div className="flex items-center gap-2">
            <select value={importCountry} onChange={(e) => setImportCountry(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white">
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => handleExport('cities')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 font-cairo font-bold text-xs border border-amber-200 transition-colors">
              <MapPin className="w-4 h-4" /> تصدير مدن الدولة
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-cairo font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
          <Upload className="w-4 h-4 text-amber-500" /> استيراد البيانات
        </h3>
        <p className="text-xs text-slate-400 font-tajawal mb-4">ارفع ملف JSON لاستيراد دول أو مدن</p>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              { id: 'full', label: 'الكل (دول + مدن)', icon: FileJson },
              { id: 'countries', label: 'دول فقط', icon: Globe },
              { id: 'cities', label: 'مدن دولة معينة', icon: MapPin },
            ] as const).map((t) => (
              <button key={t.id} onClick={() => setImportType(t.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-cairo font-bold text-xs transition-colors
                ${importType === t.id ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>

          {importType === 'cities' && (
            <div>
              <label className="block text-xs font-cairo font-bold text-slate-600 mb-1">الدولة المستهدفة</label>
              <select value={importCountry} onChange={(e) => setImportCountry(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white">
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            {([
              { id: 'merge', label: 'دمج (إضافة للموجود)' },
              { id: 'replace', label: 'استبدال (حذف الموجود)' },
            ] as const).map((m) => (
              <button key={m.id} onClick={() => setImportMode(m.id)} className={`px-3 py-2 rounded-xl font-cairo font-bold text-xs transition-colors
                ${importMode === m.id ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {m.label}
              </button>
            ))}
          </div>

          <input ref={fileRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 rounded-2xl py-8 flex flex-col items-center gap-2 text-slate-500 hover:border-amber-400 hover:bg-amber-50/30 transition-colors">
            <Upload className="w-8 h-8 text-amber-500" />
            <span className="font-cairo font-bold text-xs">اختر ملف JSON</span>
            <span className="text-[11px] font-tajawal text-slate-400">يدعم ملفات التصدير من هذا النظام</span>
          </button>

          {importPreview && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileJson className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-cairo font-bold text-xs text-slate-800 truncate">{importPreview.name}</p>
                  <p className="text-[11px] text-slate-500 font-tajawal">{(importPreview.content.length / 1024).toFixed(1)} كيلوبايت — جاهز للاستيراد</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setImportPreview(null)} className="px-3 py-1.5 rounded-xl text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
                <button onClick={doImport} className="px-4 py-1.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 font-cairo font-bold text-xs">استيراد الآن</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: typeof Globe; title: string; desc: string }) {
  return (
    <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-8 h-8 text-slate-300" />
      </div>
      <p className="font-cairo font-bold text-slate-600 text-sm">{title}</p>
      <p className="text-xs text-slate-400 font-tajawal mt-1">{desc}</p>
    </div>
  );
}

function CustomFieldTab({
  title,
  fieldKey,
  defaultOptions,
  icon: Icon,
  onAction,
  showToast,
}: {
  title: string;
  fieldKey: 'skinColor' | 'education' | 'workType';
  defaultOptions: string[];
  icon: typeof Globe;
  onAction: () => void;
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [subTab, setSubTab] = useState<'official' | 'other'>('official');
  const [search, setSearch] = useState('');
  const [addingName, setAddingName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Merge modal state
  const [mergingItem, setMergingItem] = useState<string | null>(null);
  const [targetOfficialOption, setTargetOfficialOption] = useState('');

  // Bulk state
  const [selectedOther, setSelectedOther] = useState<string[]>([]);
  const [isBulkMerging, setIsBulkMerging] = useState(false);
  const [bulkTarget, setBulkTarget] = useState('');

  const getCustomAdded = (): string[] => {
    try {
      const raw = localStorage.getItem(`twafok_custom_${fieldKey}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const addCustomOfficial = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const current = getCustomAdded();
    if (!current.includes(clean)) {
      current.push(clean);
      localStorage.setItem(`twafok_custom_${fieldKey}`, JSON.stringify(current));
    }
  };

  const removeCustomOfficial = (name: string) => {
    const current = getCustomAdded().filter((x) => x !== name);
    localStorage.setItem(`twafok_custom_${fieldKey}`, JSON.stringify(current));
  };

  const officialList = useMemo(() => {
    const custom = getCustomAdded();
    const cleanDefaults = defaultOptions.filter((x) => x !== 'أخرى');
    return Array.from(new Set([...cleanDefaults, ...custom])).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [fieldKey, subTab, editingId]);

  const allMembers = useMemo(() => getAllMembersList(), [fieldKey, subTab]);

  const otherList = useMemo(() => {
    return extractCustomFieldValues(fieldKey, allMembers, officialList);
  }, [fieldKey, allMembers, officialList]);

  const filteredOfficial = officialList.filter((x) => normText(x).includes(normText(search)));
  const filteredOther = otherList.filter((x) => normText(x.name).includes(normText(search)));

  const handleAddOfficial = () => {
    if (!addingName.trim()) return;
    addCustomOfficial(addingName.trim());
    setAddingName('');
    showToast(`تمت إضافة «${addingName.trim()}» إلى قائمة ${title} الرسمية`, 'success');
    onAction();
  };

  const handleRenameOfficial = (oldVal: string) => {
    if (!editingValue.trim() || editingValue.trim() === oldVal) {
      setEditingId(null);
      return;
    }
    const newVal = editingValue.trim();
    addCustomOfficial(newVal);
    removeCustomOfficial(oldVal);
    const res = batchUpdateMemberGeo(fieldKey, oldVal, newVal);
    setEditingId(null);
    showToast(`تم التعديل وتحديث ${res.updatedCount} من ملفات الأعضاء`, 'success');
    onAction();
  };

  const handleDeleteOfficial = (val: string) => {
    removeCustomOfficial(val);
    showToast(`تم حذف «${val}» من القائمة الرسمية`, 'info');
    onAction();
  };

  const handlePromoteOther = (name: string) => {
    addCustomOfficial(name);
    showToast(`تمت ترقية «${name}» إلى خيارات ${title} الرسمية`, 'success');
    onAction();
  };

  const handleMergeOther = (sourceVal: string, targetVal: string) => {
    if (!targetVal) return;
    const res = batchUpdateMemberGeo(fieldKey, sourceVal, targetVal);
    setMergingItem(null);
    setTargetOfficialOption('');
    showToast(`تم دمج «${sourceVal}» في «${targetVal}» وتحديث ${res.updatedCount} عضو`, 'success');
    onAction();
  };

  const toggleSelectOther = (name: string) => {
    setSelectedOther((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  };

  const toggleSelectAllOther = () => {
    if (selectedOther.length === filteredOther.length) {
      setSelectedOther([]);
    } else {
      setSelectedOther(filteredOther.map((x) => x.name));
    }
  };

  const handleBulkPromote = () => {
    selectedOther.forEach((name) => addCustomOfficial(name));
    showToast(`تمت ترقية ${selectedOther.length} خيارات لقائمة ${title} الرسمية`, 'success');
    setSelectedOther([]);
    onAction();
  };

  const handleBulkMerge = () => {
    if (!bulkTarget) return;
    let totalUpdated = 0;
    selectedOther.forEach((item) => {
      const res = batchUpdateMemberGeo(fieldKey, item, bulkTarget);
      totalUpdated += res.updatedCount;
    });
    showToast(`تم دمج ${selectedOther.length} خيارات في «${bulkTarget}» وتحديث ${totalUpdated} عضو`, 'success');
    setSelectedOther([]);
    setIsBulkMerging(false);
    setBulkTarget('');
    onAction();
  };

  return (
    <div className="space-y-5">
      {/* الفرع العلوي */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('official')}
            className={`px-4 py-2 rounded-xl text-xs font-cairo font-bold transition-all ${
              subTab === 'official' ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            القائمة الرسمية الرئيسية ({officialList.length})
          </button>
          <button
            onClick={() => setSubTab('other')}
            className={`px-4 py-2 rounded-xl text-xs font-cairo font-bold transition-all relative ${
              subTab === 'other' ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            خيارات «أخرى» المضافة ({otherList.length})
            {otherList.length > 0 && (
              <span className="mr-1.5 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {otherList.length}
              </span>
            )}
          </button>
        </div>

        <div className="relative min-w-60">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`بحث في ${title}...`}
            className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-slate-200 text-xs font-tajawal focus:outline-hidden focus:border-amber-400"
          />
        </div>
      </div>

      {/* المحتوى */}
      {subTab === 'official' ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={addingName}
              onChange={(e) => setAddingName(e.target.value)}
              placeholder={`إضافة خيار جديد لـ ${title}...`}
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-tajawal focus:outline-hidden focus:border-amber-400"
              onKeyDown={(e) => e.key === 'Enter' && handleAddOfficial()}
            />
            <button
              onClick={handleAddOfficial}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-cairo font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> إضافة
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-2">
            {filteredOfficial.map((item) => (
              <div
                key={item}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2 hover:border-amber-300 transition-colors"
              >
                {editingId === item ? (
                  <div className="flex items-center gap-1 w-full">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-amber-400 rounded-lg font-tajawal bg-white focus:outline-hidden"
                      autoFocus
                    />
                    <button onClick={() => handleRenameOfficial(item)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="font-cairo font-bold text-xs text-slate-800 truncate">{item}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingId(item); setEditingValue(item); }}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="تعديل المسمى"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteOfficial(item)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          {filteredOfficial.length === 0 && <EmptyState icon={Icon} title="لا توجد خيارات رسمية" desc="قم بإضافة خيارات جديدة" />}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-tajawal text-amber-900 leading-relaxed">
            هذه الخيارات أدخلها المستخدمون أو وُجدت في الاستيراد. يمكنك ترقيتها لتصبح رسمية في النظام، أو دمجها مع أحد الخيارات الرسمية لتعديل ملفات الأعضاء تلقائياً.
          </div>

          {filteredOther.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <button
                onClick={toggleSelectAllOther}
                className="flex items-center gap-2 text-xs font-cairo font-bold text-slate-700 hover:text-slate-900"
              >
                {selectedOther.length === filteredOther.length ? <CheckSquare className="w-4 h-4 text-amber-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                <span>تحديد الكل ({filteredOther.length})</span>
              </button>

              {selectedOther.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkPromote}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> ترقية المحدد ({selectedOther.length})
                  </button>
                  <button
                    onClick={() => setIsBulkMerging(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-cairo font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <GitMerge className="w-3.5 h-3.5" /> دمج المحدد ({selectedOther.length})
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {filteredOther.map((item) => (
              <div
                key={item.name}
                className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-colors ${
                  selectedOther.includes(item.name) ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => toggleSelectOther(item.name)}>
                    {selectedOther.includes(item.name) ? <CheckSquare className="w-4 h-4 text-amber-500" /> : <Square className="w-4 h-4 text-slate-300" />}
                  </button>
                  <div>
                    <span className="font-cairo font-bold text-xs text-slate-900">{item.name}</span>
                    <span className="mr-2 text-[11px] font-tajawal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      مستخدم لدى {item.count} عضو
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePromoteOther(item.name)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-cairo font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> ترقية لرئيسي
                  </button>
                  <button
                    onClick={() => { setMergingItem(item.name); setTargetOfficialOption(officialList[0] || ''); }}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-cairo font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <GitMerge className="w-3.5 h-3.5" /> دمج مع خيار رسمي
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredOther.length === 0 && <EmptyState icon={Icon} title="لا توجد خيارات «أخرى» جديدة" desc="جميع قيم الأعضاء مسجلة ضمن القوائم الرسمية" />}
        </div>
      )}

      {/* مودال الدمج الفردي */}
      {mergingItem && (
        <Modal open={Boolean(mergingItem)} onClose={() => setMergingItem(null)} title={`دمج خيار «${mergingItem}»`}>
          <div className="space-y-4">
            <p className="text-xs text-slate-600 font-tajawal leading-relaxed">
              اختر الخيار الرسمي المستهدف. سيتم استبدال قيمة «{mergingItem}» بالخيار المختار في كافة ملفات الأعضاء تلقائياً.
            </p>
            <select
              value={targetOfficialOption}
              onChange={(e) => setTargetOfficialOption(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-cairo focus:outline-hidden focus:border-amber-400 bg-white"
            >
              {officialList.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setMergingItem(null)} className="px-4 py-2 rounded-xl text-xs font-cairo font-bold text-slate-600 hover:bg-slate-100">إلغاء</button>
              <button
                onClick={() => handleMergeOther(mergingItem, targetOfficialOption)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-cairo font-bold text-xs"
              >
                تأكيد الدمج وتحديث الملفات
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* مودال الدمج الجماعي */}
      {isBulkMerging && (
        <Modal open={isBulkMerging} onClose={() => setIsBulkMerging(false)} title={`دمج جماعي لـ ${selectedOther.length} خيارات`}>
          <div className="space-y-4">
            <p className="text-xs text-slate-600 font-tajawal leading-relaxed">
              اختر الخيار الرسمي الذي تريد دمج الخيارات المحددة ({selectedOther.join('، ')}) فيه:
            </p>
            <select
              value={bulkTarget}
              onChange={(e) => setBulkTarget(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-cairo focus:outline-hidden focus:border-amber-400 bg-white"
            >
              <option value="">-- اختر الخيار الرسمي --</option>
              {officialList.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setIsBulkMerging(false)} className="px-4 py-2 rounded-xl text-xs font-cairo font-bold text-slate-600 hover:bg-slate-100">إلغاء</button>
              <button
                onClick={handleBulkMerge}
                disabled={!bulkTarget}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-cairo font-bold text-xs"
              >
                تنفيذ الدمج الجماعي
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
