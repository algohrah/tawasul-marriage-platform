import { useState, useMemo } from 'react';
import { GitMerge, Check, Edit3, MapPin, Globe, FileText, Trash2, CheckSquare, Square, FolderOutput, Sparkles } from 'lucide-react';
import { dataService } from '../../lib/data/DataService';

type Kind = 'country' | 'city' | 'nationality';

const KIND_META: Record<Kind, { label: string; icon: typeof Globe }> = {
  country: { label: 'دولة', icon: Globe },
  city: { label: 'مدينة', icon: MapPin },
  nationality: { label: 'جنسية', icon: FileText },
};

const SOURCE_LABEL: Record<string, { text: string; color: string }> = {
  register: { text: 'من تسجيل عضو', color: 'bg-blue-50 text-blue-600' },
  import: { text: 'من استيراد', color: 'bg-purple-50 text-purple-600' },
  admin: { text: 'من الإدارة', color: 'bg-amber-50 text-amber-600' },
};

function norm(s: string): string {
  return (s || '').toString().trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').toLowerCase();
}

interface GeoGroup {
  key: string;
  name: string;
  country: string;
  ids: string[];
  count: number;
  sources: Set<string>;
}

export default function GeoSuggestionsPanel({
  kind,
  onAction,
  showToast,
  extraGender,
}: {
  kind: Kind;
  onAction: () => void;
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
  extraGender?: boolean;
  embedded?: boolean;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [mergeForKey, setMergeForKey] = useState<string | null>(null);
  const [mergeTargetCountry, setMergeTargetCountry] = useState('');
  const [mergeTargetName, setMergeTargetName] = useState('');
  const [isNewTarget, setIsNewTarget] = useState(false);
  const [newTargetInput, setNewTargetInput] = useState('');
  const [genderChoice, setGenderChoice] = useState<Record<string, 'male' | 'female' | 'both'>>({});

  // التحديد الجماعي
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isBulkMerging, setIsBulkMerging] = useState(false);
  const [bulkTargetCountry, setBulkTargetCountry] = useState('');
  const [bulkTargetName, setBulkTargetName] = useState('');
  const [isBulkNewTarget, setIsBulkNewTarget] = useState(false);
  const [bulkNewTargetInput, setBulkNewTargetInput] = useState('');
  const [bulkCityMergeMode, setBulkCityMergeMode] = useState<'keep_names' | 'single_city'>('keep_names');

  const meta = KIND_META[kind];

  const groups = useMemo<GeoGroup[]>(() => {
    const all = dataService.db.getPendingGeoSuggestions() as Array<{ id: string; kind: string; name: string; country?: string; status: string; source?: string }>;
    const pending = all.filter((s) => s.kind === kind && s.status === 'pending');
    const map = new Map<string, GeoGroup>();
    for (const s of pending) {
      const country = s.country || '';
      const key = kind === 'country' ? norm(s.name) : `${norm(s.name)}|${norm(country)}`;
      if (!map.has(key)) {
        map.set(key, { key, name: s.name, country, ids: [], count: 0, sources: new Set() });
      }
      const g = map.get(key)!;
      g.ids.push(s.id);
      g.count++;
      if (s.source) g.sources.add(s.source);
    }
    return Array.from(map.values());
  }, [kind]);

  const countryNames = useMemo(() => {
    const official = dataService.db.getCountryNames().map((x: unknown) => (typeof x === 'string' ? x : (x as { name?: string })?.name || '')).filter(Boolean);
    const pendingCountries = groups.map((g) => g.country).filter(Boolean) as string[];
    return Array.from(new Set([...official, ...pendingCountries])).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [groups]);

  const mergeOptions = useMemo(() => {
    const cleanList = (arr: unknown[]) => arr.map((x) => (typeof x === 'string' ? x : (x as { name?: string })?.name || '')).filter(Boolean);
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const groupNames = groups.map((g) => g.name).filter(Boolean);
    if (kind === 'country') {
      const official = cleanList(dataService.db.getCountryNames());
      return Array.from(new Set([...official, ...groupNames])).sort((a, b) => a.localeCompare(b, 'ar'));
    }
    if (kind === 'nationality') {
      const nats = cleanList(dataService.db.getNationalities());
      const countries = cleanList(dataService.db.getCountryNames());
      return Array.from(new Set([...nats, ...countries, ...groupNames])).sort((a, b) => a.localeCompare(b, 'ar'));
    }
    if (kind === 'city') {
      if (!mergeTargetCountry) return [];
      const official = cleanList(dataService.db.getCities(mergeTargetCountry));
      const pendingForCountry = groups.filter((g) => norm(g.country) === norm(mergeTargetCountry)).map((g) => g.name);
      const memberCities: string[] = [];
      const normCountry = norm(mergeTargetCountry);
      dataService.db.getLiveMembers(true).forEach((m: { country?: string, city?: string, residence?: string }) => {
        if (norm(m.country || '') === normCountry) {
          const c = (m.city || m.residence || '').trim();
          if (c) memberCities.push(c);
        }
      });
      return Array.from(new Set([...official, ...pendingForCountry, ...memberCities])).sort((a, b) => a.localeCompare(b, 'ar'));
    }
    return [];
  }, [kind, mergeTargetCountry, groups]);

  const bulkMergeOptions = useMemo(() => {
    const cleanList = (arr: unknown[]) => arr.map((x) => (typeof x === 'string' ? x : (x as { name?: string })?.name || '')).filter(Boolean);
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const groupNames = groups.map((g) => g.name).filter(Boolean);
    if (kind === 'country') {
      const official = cleanList(dataService.db.getCountryNames());
      return Array.from(new Set([...official, ...groupNames])).sort((a, b) => a.localeCompare(b, 'ar'));
    }
    if (kind === 'nationality') {
      const nats = cleanList(dataService.db.getNationalities());
      const countries = cleanList(dataService.db.getCountryNames());
      return Array.from(new Set([...nats, ...countries, ...groupNames])).sort((a, b) => a.localeCompare(b, 'ar'));
    }
    if (kind === 'city') {
      if (!bulkTargetCountry) return [];
      const official = cleanList(dataService.db.getCities(bulkTargetCountry));
      const pendingForCountry = groups.filter((g) => norm(g.country) === norm(bulkTargetCountry)).map((g) => g.name);
      const memberCities: string[] = [];
      const normCountry = norm(bulkTargetCountry);
      dataService.db.getLiveMembers(true).forEach((m: { country?: string, city?: string, residence?: string }) => {
        if (norm(m.country || '') === normCountry) {
          const c = (m.city || m.residence || '').trim();
          if (c) memberCities.push(c);
        }
      });
      return Array.from(new Set([...official, ...pendingForCountry, ...memberCities])).sort((a, b) => a.localeCompare(b, 'ar'));
    }
    return [];
  }, [kind, bulkTargetCountry, groups]);

  const approve = (g: GeoGroup) => {
    const finalName = (editingKey === g.key ? editedName.trim() : '') || g.name;
    if (kind === 'nationality' && extraGender) {
      const genderVal = genderChoice[g.key] || 'both';
      dataService.db.addNationality(finalName, g.country || '', genderVal);
    } else if (kind === 'country') {
      dataService.db.addCountry(finalName);
    } else if (kind === 'city') {
      dataService.db.addCityToCountry(g.country || '', finalName);
    } else if (kind === 'nationality') {
      dataService.db.addNationality(finalName, g.country || '');
    }

    if (g.name) {
      dataService.db.batchUpdateMemberGeo(kind, g.name, finalName, g.country);
    }

    if (g.ids.length > 0) {
      g.ids.forEach((id) => dataService.db.approvePendingGeo(id, finalName));
    }
    showToast(`تم اعتماد ${meta.label} «${finalName}» وإضافتها للقائمة الرسمية وتحديث كافة ملفات الأعضاء`, 'success');
    setEditingKey(null); setEditedName('');
    onAction();
  };

  const doMerge = (g: GeoGroup) => {
    const targetName = isNewTarget ? newTargetInput.trim() : mergeTargetName;
    if (!targetName) { showToast('اختر أو اكتب القيمة المستهدفة للدمج', 'error'); return; }
    const targetCountry = kind === 'city' ? mergeTargetCountry : (g.country || '');
    if (kind === 'city') {
      if (!targetCountry) { showToast('اختر الدولة المستهدفة للدمج', 'error'); return; }
      dataService.db.addCityToCountry(targetCountry, targetName);
    }

    if (g.name) {
      dataService.db.batchUpdateMemberGeo(kind, g.name, targetName, targetCountry, g.country);
    }
    g.ids.forEach((id) => dataService.db.mergePendingGeo(id, targetName, targetCountry));
    showToast(`تم دمج «${g.name}» في «${targetName}» وتحديث دولة الأعضاء المقترنين`, 'success');
    setMergeForKey(null); setMergeTargetName(''); setMergeTargetCountry(''); setIsNewTarget(false); setNewTargetInput('');
    onAction();
  };

  const moveToOther = (g: GeoGroup) => {
    g.ids.forEach((id) => dataService.db.rejectPendingGeo(id, 'تم نقل المقترح لقائمة "أخرى" بواسطة الإدارة'));
    showToast(`تم نقل «${g.name}» إلى قائمة «أخرى» وإلغاء الإشعار المعلق بنجاح`, 'info');
    onAction();
  };

  const moveAllToOther = () => {
    if (groups.length === 0) return;
    groups.forEach((g) => {
      g.ids.forEach((id) => dataService.db.rejectPendingGeo(id, 'تفريغ جماعي لقائمة "أخرى"'));
    });
    showToast(`تم نقل جميع المقترحات المعلقة (${groups.length}) إلى قائمة «أخرى» وتفريغ الإشعارات بنجاح`, 'success');
    onAction();
  };

  const del = (g: GeoGroup) => {
    g.ids.forEach((id) => dataService.db.deletePendingGeo(id));
    showToast('تم حذف الاقتراح نهائياً', 'info');
    onAction();
  };

  // عمليات الجماعية
  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleSelectAll = () => {
    if (selectedKeys.length === groups.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(groups.map((g) => g.key));
    }
  };

  const bulkApprove = () => {
    const selectedGroups = groups.filter((g) => selectedKeys.includes(g.key));
    if (selectedGroups.length === 0) return;
    selectedGroups.forEach((g) => {
      const finalName = (editingKey === g.key ? editedName.trim() : '') || g.name;
      if (kind === 'nationality' && extraGender) {
        const genderVal = genderChoice[g.key] || 'both';
        dataService.db.addNationality(finalName, g.country || '', genderVal);
      } else if (kind === 'country') {
        dataService.db.addCountry(finalName);
      } else if (kind === 'city') {
        dataService.db.addCityToCountry(g.country || '', finalName);
      } else if (kind === 'nationality') {
        dataService.db.addNationality(finalName, g.country || '');
      }

      if (g.name) {
        dataService.db.batchUpdateMemberGeo(kind, g.name, finalName, g.country);
      }

      if (g.ids.length > 0) {
        g.ids.forEach((id) => dataService.db.approvePendingGeo(id, finalName));
      }
    });
    showToast(`تم اعتماد ${selectedGroups.length} عناصر وإضافتها للقائمة الرسمية وتحديث كافة ملفات الأعضاء`, 'success');
    setSelectedKeys([]);
    onAction();
  };

  const bulkMoveToOther = () => {
    const selectedGroups = groups.filter((g) => selectedKeys.includes(g.key));
    if (selectedGroups.length === 0) return;
    selectedGroups.forEach((g) => {
      g.ids.forEach((id) => dataService.db.rejectPendingGeo(id, 'تم نقل المقترح لقائمة "أخرى" بواسطة الإدارة'));
    });
    showToast(`تم نقل ${selectedGroups.length} عناصر إلى قائمة «أخرى» وإلغاء الإشعارات بنجاح`, 'info');
    setSelectedKeys([]);
    onAction();
  };

  const bulkMergeExecute = () => {
    const selectedGroups = groups.filter((g) => selectedKeys.includes(g.key));
    if (selectedGroups.length === 0) return;

    if (kind === 'city') {
      if (!bulkTargetCountry) {
        showToast('اختر الدولة المستهدفة للدمج الجماعي', 'error');
        return;
      }

      if (bulkCityMergeMode === 'keep_names') {
        // الخيار الأول: الدولة فقط (إضافة/دمج المدن بأسمائها الحالية تحت الدولة المستهدفة وتحديث دولة الأشخاص)
        selectedGroups.forEach((g) => {
          const cityName = g.name.trim();
          if (cityName) {
            dataService.db.addCityToCountry(bulkTargetCountry, cityName);
            dataService.db.batchUpdateMemberGeo('city', g.name, cityName, bulkTargetCountry, g.country);
            g.ids.forEach((id) => dataService.db.mergePendingGeo(id, cityName, bulkTargetCountry));
          }
        });
        showToast(`تم إضافة/دمج ${selectedGroups.length} مدن إلى «${bulkTargetCountry}» وتغيير دولة كافة الأعضاء إلى «${bulkTargetCountry}»`, 'success');
      } else {
        // الخيار الثاني: الدولة والمدينة (دمج الكل في مدينة واحدة)
        const targetName = isBulkNewTarget ? bulkNewTargetInput.trim() : bulkTargetName;
        if (!targetName) {
          showToast('اختر أو اكتب المدينة المستهدفة للدمج الجماعي', 'error');
          return;
        }
        dataService.db.addCityToCountry(bulkTargetCountry, targetName);

        selectedGroups.forEach((g) => {
          if (g.name) {
            dataService.db.batchUpdateMemberGeo('city', g.name, targetName, bulkTargetCountry, g.country);
          }
          g.ids.forEach((id) => dataService.db.mergePendingGeo(id, targetName, bulkTargetCountry));
        });
        showToast(`تم دمج ${selectedGroups.length} مدن في «${targetName}» (دولة ${bulkTargetCountry}) وتغيير دولة كافة الأعضاء`, 'success');
      }
    } else {
      const targetName = isBulkNewTarget ? bulkNewTargetInput.trim() : bulkTargetName;
      if (!targetName) {
        showToast('اختر أو اكتب القيمة المستهدفة للدمج الجماعي', 'error');
        return;
      }
      selectedGroups.forEach((g) => {
        if (g.name) {
          dataService.db.batchUpdateMemberGeo(kind, g.name, targetName);
        }
        g.ids.forEach((id) => dataService.db.mergePendingGeo(id, targetName));
      });
      showToast(`تم دمج ${selectedGroups.length} عناصر بنجاح في «${targetName}» وتحديث كافة الأعضاء`, 'success');
    }

    setSelectedKeys([]);
    setIsBulkMerging(false);
    setBulkTargetName('');
    setBulkTargetCountry('');
    setIsBulkNewTarget(false);
    setBulkNewTargetInput('');
    setBulkCityMergeMode('keep_names');
    onAction();
  };

  const Icon = meta.icon;
  const totalDupes = groups.reduce((sum, g) => sum + g.count, 0);
  const kindPlural = meta.label === 'دولة' ? 'الدول' : meta.label === 'مدينة' ? 'المدن' : 'الجنسيات';

  return (
    <div className="space-y-4">
      {/* كارت التوجيه ورأس المقترحات */}
      <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <h3 className="font-cairo font-extrabold text-sm text-amber-900">
              مقترحات {kindPlural} الجديدة المعلقة ({groups.length})
            </h3>
          </div>
          {groups.length > 0 && (
            <button
              onClick={moveAllToOther}
              className="px-3.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-cairo font-bold text-xs flex items-center gap-1.5 transition-colors border border-amber-300 shadow-xs"
              title="نقل جميع المقترحات المعلقة إلى قسم (أخرى) لإخلاء قائمة المقترحات وإلغاء شارة الإشعار"
            >
              <FolderOutput className="w-4 h-4 text-amber-700" />
              تفريغ جميع المقترحات ونقلها إلى «أخرى» (إلغاء الإشعارات)
            </button>
          )}
        </div>
        <p className="text-xs text-amber-800 font-tajawal leading-relaxed">
          هذه القيم قادمة من تسجيل الأعضاء أو استيراد البيانات وليست ضمن القائمة الرسمية بعد. يمكنك اعتمادها فوراً أو تعديل اسمها وإضافتها، أو دمجها مع قيمة رسمية، أو نقلها إلى تبويب «أخرى» لإلغاء تنبيه الإشعار المعلق.
          {totalDupes > groups.length && <strong className="mr-1">(تم توحيد {totalDupes} مقترحاً مكرراً في {groups.length}).</strong>}
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
          <Check className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="font-cairo font-bold text-slate-700 text-sm">لا توجد مقترحات معلقة حالياً</p>
          <p className="font-tajawal text-slate-400 text-xs">جميع المقترحات تم اعتمادها أو نقلها لقائمة «أخرى» الرسمية</p>
        </div>
      ) : (
        <>
          {/* شريط التحديد الجماعي */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-cairo font-bold text-slate-700 hover:text-amber-600"
            >
              {selectedKeys.length === groups.length ? (
                <CheckSquare className="w-4 h-4 text-amber-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              تحديد الكل ({groups.length})
            </button>

            {selectedKeys.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-cairo font-extrabold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg">
                  تم تحديد ({selectedKeys.length})
                </span>

                <button
                  onClick={bulkApprove}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-xs flex items-center gap-1 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" /> اعتماد الجماعي
                </button>

                <button
                  onClick={() => setIsBulkMerging(true)}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-cairo font-bold text-xs flex items-center gap-1 shadow-xs"
                >
                  <GitMerge className="w-3.5 h-3.5" /> دمج الجماعي
                </button>

                <button
                  onClick={bulkMoveToOther}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-cairo font-bold text-xs flex items-center gap-1"
                >
                  <FolderOutput className="w-3.5 h-3.5" /> نقل الجماعي لـ «أخرى»
                </button>
              </div>
            )}
          </div>

          {/* واجهة الدمج الجماعي */}
          {isBulkMerging && (
            <div className="bg-sky-50 rounded-xl p-4 space-y-4 border border-sky-200 shadow-xs">
              <div className="flex items-center justify-between border-b border-sky-200/80 pb-2">
                <h4 className="font-cairo font-bold text-xs text-sky-900 flex items-center gap-1.5">
                  <GitMerge className="w-4 h-4 text-sky-600" />
                  دمج جماعي لـ ({selectedKeys.length}) مقترحات
                </h4>
                <span className="text-[11px] font-tajawal text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full font-medium">
                  {kind === 'city' ? 'خيارات المدن والمناطق' : meta.label}
                </span>
              </div>

              {kind === 'city' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-cairo font-bold text-slate-700 mb-1">
                      الدولة المستهدفة للدمج (تنسَب إليها المدن ويتم تغيير دولة الأشخاص إليها) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={bulkTargetCountry}
                      onChange={(e) => { setBulkTargetCountry(e.target.value); setBulkTargetName(''); }}
                      className="w-full px-3 py-2 rounded-lg border border-sky-300 focus:border-sky-500 focus:outline-none font-tajawal text-xs bg-white font-medium"
                    >
                      <option value="">— اختر الدولة المستهدفة (مثال: السعودية) —</option>
                      {countryNames.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-cairo font-bold text-slate-700 mb-1">
                      طريقة خيار الدمج للمدن المحددة:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBulkCityMergeMode('keep_names')}
                        className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                          bulkCityMergeMode === 'keep_names'
                            ? 'border-sky-500 bg-white text-sky-950 ring-2 ring-sky-400/30 font-bold shadow-xs'
                            : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-white'
                        }`}
                      >
                        <span className="font-cairo text-xs font-bold block text-sky-900 mb-0.5">
                          1. تحديد الدولة فقط
                        </span>
                        <span className="font-tajawal text-[11px] text-slate-500 block leading-tight">
                          إضافة/دمج كل مدينة باسمها وتغيير دولة الأشخاص المستهدفين إلى الدولة المحددة.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBulkCityMergeMode('single_city')}
                        className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                          bulkCityMergeMode === 'single_city'
                            ? 'border-sky-500 bg-white text-sky-950 ring-2 ring-sky-400/30 font-bold shadow-xs'
                            : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-white'
                        }`}
                      >
                        <span className="font-cairo text-xs font-bold block text-sky-900 mb-0.5">
                          2. تحديد الدولة والمدينة
                        </span>
                        <span className="font-tajawal text-[11px] text-slate-500 block leading-tight">
                          دمج جميع المدن المحددة في مدينة واحدة مستهدفة وتغيير دولة الأشخاص إليها.
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {(kind !== 'city' || bulkCityMergeMode === 'single_city') && (
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-cairo font-bold text-slate-700">
                      اختر المدينة/القيمة المستهدفة للدمج الجماعي
                    </label>
                    <div className="flex gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setIsBulkNewTarget(false)}
                        className={`px-2.5 py-0.5 rounded-md font-bold transition-colors ${!isBulkNewTarget ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                      >
                        موجودة
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsBulkNewTarget(true)}
                        className={`px-2.5 py-0.5 rounded-md font-bold transition-colors ${isBulkNewTarget ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                      >
                        جديدة
                      </button>
                    </div>
                  </div>
                  {isBulkNewTarget ? (
                    <input
                      value={bulkNewTargetInput}
                      onChange={(e) => setBulkNewTargetInput(e.target.value)}
                      placeholder={kind === 'city' ? 'اكتب اسم المدينة الجديدة للدمج الجماعي...' : 'اكتب الاسم الجديد...'}
                      className="w-full px-3 py-2 rounded-lg border border-sky-400 focus:outline-none font-tajawal text-xs bg-white"
                    />
                  ) : (
                    <select
                      value={bulkTargetName}
                      onChange={(e) => setBulkTargetName(e.target.value)}
                      disabled={kind === 'city' && !bulkTargetCountry}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-sky-500 focus:outline-none font-tajawal text-xs bg-white disabled:opacity-50"
                    >
                      <option value="">— اختر القيمة الرسمية —</option>
                      {bulkMergeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2 border-t border-sky-200/60">
                <button
                  onClick={() => { setIsBulkMerging(false); setIsBulkNewTarget(false); setBulkNewTargetInput(''); }}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  onClick={bulkMergeExecute}
                  disabled={
                    kind === 'city'
                      ? !bulkTargetCountry || (bulkCityMergeMode === 'single_city' && (isBulkNewTarget ? !bulkNewTargetInput.trim() : !bulkTargetName))
                      : (isBulkNewTarget ? !bulkNewTargetInput.trim() : !bulkTargetName)
                  }
                  className="px-4 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 font-cairo font-bold text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <GitMerge className="w-3.5 h-3.5" /> تنفيذ الدمج الجماعي
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {groups.map((g) => {
              const isSelected = selectedKeys.includes(g.key);
              const isEditing = editingKey === g.key;
              const isMerging = mergeForKey === g.key;
              const srcList = Array.from(g.sources);
              return (
                <div key={g.key} className={`bg-white rounded-xl border p-3.5 space-y-2.5 transition-all ${isSelected ? 'border-amber-400 bg-amber-50/30 shadow-xs' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggleSelect(g.key)}
                      className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-amber-600"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-amber-600" />
                    </div>
                    {isEditing ? (
                      <input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        autoFocus
                        className="px-2.5 py-1 rounded-lg border border-amber-400 focus:outline-none font-cairo font-bold text-sm w-48 bg-amber-50/50"
                      />
                    ) : (
                      <span className="font-cairo font-extrabold text-slate-900 text-sm">{g.name}</span>
                    )}
                    {kind !== 'country' && g.country && (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-cairo font-bold">{g.country}</span>
                    )}
                    {g.count > 1 && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-cairo font-bold">×{g.count} مكرر</span>
                    )}
                    {srcList.map((src) => {
                      const meta2 = SOURCE_LABEL[src] || SOURCE_LABEL.register;
                      return <span key={src} className={`px-2 py-0.5 rounded-lg text-[10px] font-cairo font-bold ${meta2.color}`}>{meta2.text}</span>;
                    })}
                  </div>

                  {/* اعتماد الجنسية بجنس محدد */}
                  {kind === 'nationality' && extraGender && !isMerging && (
                    <div className="flex items-center gap-1.5 pr-7">
                      <span className="text-[11px] text-slate-500 font-tajawal">تُعتمد كـ:</span>
                      {(['male', 'female', 'both'] as const).map((gv) => (
                        <button
                          key={gv}
                          onClick={() => setGenderChoice((prev) => ({ ...prev, [g.key]: gv }))}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-cairo font-bold transition-all ${
                            (genderChoice[g.key] || 'both') === gv ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {gv === 'male' ? 'ذكر' : gv === 'female' ? 'أنثى' : 'عام'}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* واجهة التحكم بالإجراءات الأربعة */}
                  {isMerging ? (
                    <div className="bg-slate-50 rounded-xl p-3 space-y-2.5 border border-slate-200">
                      {kind === 'city' && (
                        <div>
                          <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1">الدولة المستهدفة للدمج</label>
                          <select
                            value={mergeTargetCountry}
                            onChange={(e) => { setMergeTargetCountry(e.target.value); setMergeTargetName(''); }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
                          >
                            <option value="">— اختر الدولة المستهدفة —</option>
                            {countryNames.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-cairo font-bold text-slate-600">
                            {kind === 'city' ? 'المدينة المستهدفة' : kind === 'country' ? 'الدولة المستهدفة' : 'الجنسية المستهدفة'}
                          </label>
                          <div className="flex gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setIsNewTarget(false)}
                              className={`px-2 py-0.5 rounded font-bold transition-colors ${!isNewTarget ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}
                            >
                              موجودة
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsNewTarget(true)}
                              className={`px-2 py-0.5 rounded font-bold transition-colors ${isNewTarget ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}
                            >
                              جديدة
                            </button>
                          </div>
                        </div>

                        {isNewTarget ? (
                          <input
                            value={newTargetInput}
                            onChange={(e) => setNewTargetInput(e.target.value)}
                            placeholder={kind === 'city' ? 'اكتب اسم المدينة الجديدة...' : 'اكتب الاسم الجديد...'}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-amber-400 focus:outline-none font-tajawal text-xs bg-white"
                          />
                        ) : (
                          <select
                            value={mergeTargetName}
                            onChange={(e) => setMergeTargetName(e.target.value)}
                            disabled={kind === 'city' && !mergeTargetCountry}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-xs bg-white disabled:opacity-50"
                          >
                            <option value="">— اختر القيمة الرسمية الموجودة —</option>
                            {mergeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <button onClick={() => { setMergeForKey(null); setMergeTargetName(''); setMergeTargetCountry(''); setIsNewTarget(false); setNewTargetInput(''); }} className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-cairo font-bold text-xs">إلغاء</button>
                        <button onClick={() => doMerge(g)} disabled={isNewTarget ? !newTargetInput.trim() : !mergeTargetName} className="px-3.5 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 font-cairo font-bold text-xs flex items-center gap-1.5 shadow-xs">
                          <GitMerge className="w-3.5 h-3.5" /> تأكيد الدمج
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
                      <button onClick={() => approve(g)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition-colors">
                        <Check className="w-3.5 h-3.5" /> إضافة للرسمية
                      </button>

                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => approve(g)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-[11px] flex items-center gap-1 shadow-xs">
                            حفظ واعتاماد للرسمية
                          </button>
                          <button onClick={() => { setEditingKey(null); setEditedName(''); }} className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-cairo font-bold text-[11px]">
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingKey(g.key); setEditedName(g.name); }} className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-cairo font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition-colors">
                          <Edit3 className="w-3.5 h-3.5" /> تعديل الاسم وإضافة للرسمية
                        </button>
                      )}

                      <button onClick={() => { setMergeForKey(g.key); setMergeTargetCountry(kind === 'city' ? (g.country || '') : ''); setMergeTargetName(''); }} className="px-3 py-1.5 rounded-lg bg-sky-100 text-sky-800 hover:bg-sky-200 font-cairo font-bold text-[11px] flex items-center gap-1.5 transition-colors">
                        <GitMerge className="w-3.5 h-3.5 text-sky-600" /> دمج مع رسمية موجودة
                      </button>

                      <button onClick={() => moveToOther(g)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-cairo font-bold text-[11px] flex items-center gap-1.5 transition-colors" title="نقل هذا الخيار إلى قائمة (أخرى) وإلغاء تنبيه الإشعار المعلق">
                        <FolderOutput className="w-3.5 h-3.5 text-slate-500" /> نقل إلى «أخرى» (إلغاء الإشعار)
                      </button>

                      <button onClick={() => del(g)} className="p-1.5 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-colors mr-auto" title="حذف نهائي للمقترح">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

