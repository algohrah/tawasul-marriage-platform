// ============================================================
//  مخزن الدول والمدن — إدارة كاملة عبر localStorage ومزامنة Supabase
//  - قائمة رسمية للدول والمدن (قابلة للتعديل من الإدارة)
//  - مدن مقترحة من المستخدمين بانتظار مراجعة الإدارة
//  - استيراد/تصدير الدول أو مدن دولة معينة
// ============================================================

import { COUNTRIES as SEED_COUNTRIES, CITIES_BY_COUNTRY as SEED_CITIES } from '../../../constants';
import supabaseClient, { hasRealSupabase } from '../../../supabase';

const isReal = typeof window !== 'undefined' && hasRealSupabase;

// ===== الأنواع =====
export interface PendingCity {
  id: string;
  name: string;
  country: string;
  suggestedBy: string;        // اسم العضو أو معرّفه
  suggestedById?: string;
  source: 'register' | 'import' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface CountryInfo {
  name: string;
  code?: string;       // رمز ISO اختياري
  flag?: string;        // إيموجي العلم اختياري
}

interface GeoDB {
  countries: CountryInfo[];
  citiesByCountry: Record<string, string[]>;
  pendingCities: PendingCity[];
  seq: number;
}

const STORAGE_KEY = 'twafok_geo_db_v2';

// ===== بيانات البذرة =====
function seedDB(): GeoDB {
  const countries: CountryInfo[] = SEED_COUNTRIES.map((name) => ({ name }));
  const citiesByCountry: Record<string, string[]> = {};
  for (const [country, cities] of Object.entries(SEED_CITIES)) {
    citiesByCountry[country] = [...cities];
  }
  return {
    countries,
    citiesByCountry,
    pendingCities: [],
    seq: 1,
  };
}

let db: GeoDB | null = null;

function load(): GeoDB {
  if (db) return db;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.countries)) {
          db = parsed;
          return db;
        }
      }
    } catch { /* تجاهل */ }
  }
  db = seedDB();
  return db;
}

function save() {
  if (db) {
    try {
      const raw = JSON.stringify(db);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, raw);
      }
      if (isReal) {
        Promise.resolve(
          supabaseClient
            .from('settings')
            .upsert({ key: STORAGE_KEY, value: raw, updated_at: new Date().toISOString() })
        ).catch((err) => console.warn('[geoStore] Failed to sync geo db to Supabase settings:', err));
      }
    } catch { /* تجاهل */ }
  }
}

export async function syncGeoDBFromCloud(): Promise<void> {
  if (!isReal) return;
  try {
    const { data, error } = await supabaseClient
      .from('settings')
      .select('value')
      .eq('key', STORAGE_KEY)
      .maybeSingle();
      
    if (error) throw error;
    if (data && data.value) {
      const parsed: GeoDB = JSON.parse(data.value);
      if (parsed && Array.isArray(parsed.countries)) {
        if (!parsed.citiesByCountry) parsed.citiesByCountry = {};
        if (!parsed.pendingCities) parsed.pendingCities = [];
        if (!parsed.seq) parsed.seq = 1;
        db = parsed;
        console.info('[geoStore] Successfully synchronized countries and cities from Supabase cloud!');
      }
    }
  } catch (err) {
    console.warn('[geoStore] Failed to fetch geo db from Supabase.', err);
  }
}

function nextId(): string {
  const d = load();
  d.seq += 1;
  return `pc_${d.seq}_${Date.now().toString(36)}`;
}

// ===== تطبيع النص للمقارنة (إزالة التشكيل والمسافات الزائدة) =====
export function normalizeText(s: string): string {
  return (s || '')
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')   // إزالة التشكيل
    .replace(/[\u0622\u0623\u0625]/g, '\u0627')  // توحيد الألف
    .replace(/\u0629/g, '\u0647')              // تاء مربوطة -> هاء
    .replace(/\u0649/g, '\u064A')              // ألف مقصورة -> ياء
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// ===== الدول =====
export function getCountries(): CountryInfo[] {
  return load().countries;
}

export function getCountryNames(): string[] {
  return load().countries.map((c) => c.name);
}

export function addCountry(name: string, code?: string, flag?: string): { ok: boolean; error?: string } {
  const d = load();
  const norm = normalizeText(name);
  if (!norm) return { ok: false, error: 'اسم الدولة مطلوب' };
  if (d.countries.some((c) => normalizeText(c.name) === norm)) {
    return { ok: false, error: 'الدولة موجودة بالفعل' };
  }
  d.countries.push({ name: name.trim(), code, flag });
  if (!d.citiesByCountry[name.trim()]) d.citiesByCountry[name.trim()] = [];
  save();
  return { ok: true };
}

export function removeCountry(name: string): void {
  const d = load();
  const norm = normalizeText(name);
  d.countries = d.countries.filter((c) => normalizeText(c.name) !== norm);
  Object.keys(d.citiesByCountry).forEach((k) => {
    if (normalizeText(k) === norm) {
      delete d.citiesByCountry[k];
    }
  });
  save();
}

export function renameCountry(oldName: string, newName: string): { ok: boolean; error?: string } {
  const d = load();
  const norm = normalizeText(newName);
  if (!norm) return { ok: false, error: 'الاسم الجديد مطلوب' };
  
  const normOld = normalizeText(oldName);
  const idx = d.countries.findIndex((c) => normalizeText(c.name) === normOld);
  if (idx !== -1) {
    d.countries[idx].name = newName.trim();
  }
  
  // نقل المدن تحت الاسم الجديد
  Object.keys(d.citiesByCountry).forEach((k) => {
    if (normalizeText(k) === normOld) {
      const cities = d.citiesByCountry[k];
      delete d.citiesByCountry[k];
      d.citiesByCountry[newName.trim()] = cities;
    }
  });

  // تحديث المدن المقترحة المرتبطة
  d.pendingCities.forEach((p) => {
    if (normalizeText(p.country) === normOld) p.country = newName.trim();
    if (p.kind === 'country' && normalizeText(p.name) === normOld) p.name = newName.trim();
  });
  save();

  // تحديث بيانات بطاقات الأعضاء
  batchUpdateMemberGeo('country', oldName, newName.trim());

  return { ok: true };
}

// ===== المدن =====
export function getCities(country: string): string[] {
  const d = load();
  const normCountry = normalizeText(country);
  for (const k of Object.keys(d.citiesByCountry)) {
    if (normalizeText(k) === normCountry) return d.citiesByCountry[k] || [];
  }
  return d.citiesByCountry[country] || [];
}

export function addCityToCountry(country: string, city: string): { ok: boolean; error?: string } {
  const d = load();
  const norm = normalizeText(city);
  if (!norm) return { ok: false, error: 'اسم المدينة مطلوب' };
  
  let targetKey = country.trim();
  const normCountry = normalizeText(country);
  for (const k of Object.keys(d.citiesByCountry)) {
    if (normalizeText(k) === normCountry) {
      targetKey = k;
      break;
    }
  }

  const list = d.citiesByCountry[targetKey] || (d.citiesByCountry[targetKey] = []);
  if (list.some((c) => normalizeText(c) === norm)) {
    return { ok: false, error: 'المدينة موجودة بالفعل في هذه الدولة' };
  }
  list.push(city.trim());
  list.sort((a, b) => a.localeCompare(b, 'ar'));
  save();
  return { ok: true };
}

export function removeCityFromCountry(country: string, city: string): void {
  const d = load();
  const normCountry = normalizeText(country);
  const normCity = normalizeText(city);
  Object.keys(d.citiesByCountry).forEach((k) => {
    if (normalizeText(k) === normCountry) {
      d.citiesByCountry[k] = d.citiesByCountry[k].filter((c) => normalizeText(c) !== normCity);
    }
  });
  save();
}

export function renameCity(country: string, oldName: string, newName: string): { ok: boolean; error?: string } {
  const d = load();
  const normCountry = normalizeText(country);
  const normOld = normalizeText(oldName);
  const normNew = normalizeText(newName);
  if (!normNew) return { ok: false, error: 'الاسم الجديد مطلوب' };

  Object.keys(d.citiesByCountry).forEach((k) => {
    if (normalizeText(k) === normCountry) {
      const list = d.citiesByCountry[k];
      const idx = list.findIndex((c) => normalizeText(c) === normOld);
      if (idx !== -1) {
        list[idx] = newName.trim();
        list.sort((a, b) => a.localeCompare(b, 'ar'));
      }
    }
  });

  // تحديث المقترحات المرتبطة
  d.pendingCities.forEach((p) => {
    if (normalizeText(p.country) === normCountry && normalizeText(p.name) === normOld) {
      p.name = newName.trim();
    }
  });
  save();

  // تحديث بطاقات الأعضاء
  batchUpdateMemberGeo('city', oldName, newName.trim(), country);

  return { ok: true };
}

// هل المدينة معروفة رسمياً؟
export function isCityKnown(country: string, city: string): boolean {
  const list = getCities(country);
  const norm = normalizeText(city);
  return list.some((c) => normalizeText(c) === norm);
}

// هل الدولة معروفة رسمياً؟
export function isCountryKnown(country: string): boolean {
  const norm = normalizeText(country);
  return load().countries.some((c) => normalizeText(c.name) === norm);
}

// ===== المدن المقترحة (بانتظار المراجعة) =====
export function getPendingCities(): PendingCity[] {
  return load().pendingCities.filter((p) => p.status === 'pending');
}

export function getAllPendingCities(): PendingCity[] {
  return load().pendingCities;
}

export function getPendingCitiesCount(): number {
  return load().pendingCities.filter((p) => p.status === 'pending').length;
}

// إضافة مدينة مقترحة من المستخدم أو الاستيراد
export function addPendingCity(
  name: string,
  country: string,
  suggestedBy: string,
  source: 'register' | 'import' | 'admin' = 'register',
  suggestedById?: string,
): { ok: boolean; error?: string; id?: string } {
  const d = load();
  const norm = normalizeText(name);
  if (!norm) return { ok: false, error: 'اسم المدينة مطلوب' };

  // هل المدينة موجودة رسمياً؟
  if (isCityKnown(country, name)) {
    return { ok: false, error: 'المدينة موجودة بالفعل في القائمة الرسمية' };
  }

  // هل يوجد اقتراح مطابق قائم؟
  const dup = d.pendingCities.find(
    (p) => p.status === 'pending' &&
          normalizeText(p.name) === norm &&
          p.country === country,
  );
  if (dup) {
    return { ok: false, error: 'تم اقتراح هذه المدينة بالفعل وهي قيد المراجعة' };
  }

  const id = nextId();
  d.pendingCities.push({
    id,
    name: name.trim(),
    country,
    suggestedBy,
    suggestedById,
    source,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  save();
  return { ok: true, id };
}

// الموافقة على مدينة مقترحة -> تُضاف للقائمة الرسمية
export function approvePendingCity(id: string, reviewer: string, editedName?: string, nameHint?: string, countryHint?: string): { ok: boolean; error?: string } {
  const d = load();
  const target = d.pendingCities.find((x) => x.id === id);
  const name = nameHint || target?.name || '';
  const country = countryHint || target?.country || '';
  const normName = normalizeText(name);
  const normCountry = normalizeText(country);

  const finalName = (editedName || name || (target ? target.name : '')).trim();
  if (country && finalName) {
    addCityToCountry(country, finalName);
  }

  d.pendingCities.forEach((p) => {
    const isIdMatch = p.id === id;
    const isNameMatch = Boolean(normName && normalizeText(p.name) === normName && (!normCountry || !normalizeText(p.country) || normalizeText(p.country) === normCountry));
    if (isIdMatch || isNameMatch) {
      p.status = 'approved';
      p.reviewedAt = new Date().toISOString();
      p.reviewedBy = reviewer;
      if (editedName) p.name = finalName;
    }
  });

  save();
  return { ok: true };
}

export function rejectPendingCity(id: string, reviewer: string, reason?: string, nameHint?: string, countryHint?: string): { ok: boolean; error?: string } {
  const d = load();
  const target = d.pendingCities.find((x) => x.id === id);
  const name = nameHint || target?.name || '';
  const country = countryHint || target?.country || '';
  const normName = normalizeText(name);
  const normCountry = normalizeText(country);

  d.pendingCities.forEach((p) => {
    const isIdMatch = p.id === id;
    const isNameMatch = Boolean(normName && normalizeText(p.name) === normName && (!normCountry || !normalizeText(p.country) || normalizeText(p.country) === normCountry));
    if (isIdMatch || isNameMatch) {
      p.status = 'rejected';
      p.rejectionReason = reason || '';
      p.reviewedAt = new Date().toISOString();
      p.reviewedBy = reviewer;
    }
  });

  save();
  return { ok: true };
}

export function deletePendingCity(id: string, nameHint?: string, countryHint?: string): void {
  const d = load();
  const target = d.pendingCities.find((x) => x.id === id);
  const name = nameHint || target?.name || '';
  const country = countryHint || target?.country || '';
  const normName = normalizeText(name);
  const normCountry = normalizeText(country);

  d.pendingCities = d.pendingCities.filter((p) => {
    const isIdMatch = p.id === id;
    const isNameMatch = Boolean(normName && normalizeText(p.name) === normName && (!normCountry || !normalizeText(p.country) || normalizeText(p.country) === normCountry));
    return !(isIdMatch || isNameMatch);
  });
  save();
}

// ===== فحص جماعي عند الاستيراد — يسجّل المدن/الدول غير المعروفة =====
export interface GeoCheckResult {
  unknownCities: { city: string; country: string }[];
  unknownCountries: string[];
  addedPending: number;
}

export function checkAndRegisterUnknownGeo(
  members: { country?: string; city?: string; nickname?: string; id?: string }[],
  source: 'register' | 'import' = 'import',
): GeoCheckResult {
  const unknownCities: { city: string; country: string }[] = [];
  const unknownCountriesSet = new Set<string>();
  let addedPending = 0;

  for (const m of members) {
    const country = (m.country || '').trim();
    const city = (m.city || '').trim();
    if (!country || !city) continue;

    if (!isCountryKnown(country)) {
      unknownCountriesSet.add(country);
      // نسجّل الدولة كمقترحة ضمن ملاحظة المدينة
    }

    if (!isCityKnown(country, city)) {
      unknownCities.push({ city, country });
      const result = addPendingCity(
        city, country,
        m.nickname || m.id || 'استيراد جماعي',
        source,
        m.id,
      );
      if (result.ok) addedPending++;
    }
  }

  return {
    unknownCities,
    unknownCountries: Array.from(unknownCountriesSet),
    addedPending,
  };
}

// ===== الاستيراد والتصدير =====
export function exportAllCountries(): string {
  const d = load();
  return JSON.stringify({
    type: 'twafok_countries',
    version: 1,
    exportedAt: new Date().toISOString(),
    countries: d.countries,
  }, null, 2);
}

export function exportCitiesForCountry(country: string): string {
  const d = load();
  return JSON.stringify({
    type: 'twafok_cities',
    version: 1,
    country,
    exportedAt: new Date().toISOString(),
    cities: d.citiesByCountry[country] || [],
  }, null, 2);
}

export function exportAllGeo(): string {
  const d = load();
  return JSON.stringify({
    type: 'twafok_geo_full',
    version: 1,
    exportedAt: new Date().toISOString(),
    countries: d.countries,
    citiesByCountry: d.citiesByCountry,
  }, null, 2);
}

export interface ImportResult {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

export function importCountries(json: string, mode: 'merge' | 'replace' = 'merge'): ImportResult {
  const d = load();
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, imported: 0, skipped: 0, errors: ['ملف JSON غير صالح'] };
  }
  if (!data || !Array.isArray(data.countries)) {
    return { ok: false, imported: 0, skipped: 0, errors: ['صيغة الملف غير صحيحة — يجب أن يحتوي على مصفوفة countries'] };
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  if (mode === 'replace') {
    d.countries = [];
    d.citiesByCountry = {};
  }

  for (const c of data.countries) {
    const name = typeof c === 'string' ? c : ((c as any)?.name || '').trim();
    if (!name) { skipped++; continue; }
    if (d.countries.some((x) => normalizeText(x.name) === normalizeText(name))) {
      skipped++;
      continue;
    }
    const info: CountryInfo = { name };
    if ((c as any)?.code) info.code = (c as any).code;
    if ((c as any)?.flag) info.flag = (c as any).flag;
    d.countries.push(info);
    if (!d.citiesByCountry[name]) d.citiesByCountry[name] = [];
    imported++;
  }
  save();
  return { ok: true, imported, skipped, errors };
}

export function importCitiesForCountry(country: string, json: string, mode: 'merge' | 'replace' = 'merge'): ImportResult {
  const d = load();
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, imported: 0, skipped: 0, errors: ['ملف JSON غير صالح'] };
  }

  let cities: string[] = [];
  if (Array.isArray(data)) {
    cities = data as string[];
  } else if (Array.isArray(data.cities)) {
    cities = data.cities as string[];
  } else {
    return { ok: false, imported: 0, skipped: 0, errors: ['صيغة الملف غير صحيحة — يجب أن يحتوي على مصفوفة cities'] };
  }

  // ضمان وجود الدولة
  if (!d.citiesByCountry[country]) d.citiesByCountry[country] = [];
  if (mode === 'replace') d.citiesByCountry[country] = [];

  const list = d.citiesByCountry[country];
  let imported = 0;
  let skipped = 0;

  for (const c of cities) {
    const name = (typeof c === 'string' ? c : (c as any)?.name || '').trim();
    if (!name) { skipped++; continue; }
    if (list.some((x) => normalizeText(x) === normalizeText(name))) {
      skipped++;
      continue;
    }
    list.push(name);
    imported++;
  }
  list.sort((a, b) => a.localeCompare(b, 'ar'));
  save();
  return { ok: true, imported, skipped, errors: [] };
}

export function importFullGeo(json: string, mode: 'merge' | 'replace' = 'merge'): ImportResult {
  const d = load();
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, imported: 0, skipped: 0, errors: ['ملف JSON غير صالح'] };
  }
  if (!data || !Array.isArray(data.countries)) {
    return { ok: false, imported: 0, skipped: 0, errors: ['صيغة الملف غير صحيحة'] };
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  if (mode === 'replace') {
    d.countries = [];
    d.citiesByCountry = {};
  }

  for (const c of data.countries) {
    const name = typeof c === 'string' ? c : ((c as any)?.name || '').trim();
    if (!name) { skipped++; continue; }
    if (d.countries.some((x) => normalizeText(x.name) === normalizeText(name))) {
      skipped++;
      continue;
    }
    const info: CountryInfo = { name };
    if ((c as any)?.code) info.code = (c as any).code;
    if ((c as any)?.flag) info.flag = (c as any).flag;
    d.countries.push(info);
    if (!d.citiesByCountry[name]) d.citiesByCountry[name] = [];
    imported++;
  }

  // استيراد المدن
  if (data.citiesByCountry && typeof data.citiesByCountry === 'object') {
    for (const [country, cities] of Object.entries(data.citiesByCountry)) {
      if (!Array.isArray(cities)) continue;
      if (!d.citiesByCountry[country]) d.citiesByCountry[country] = [];
      const list = d.citiesByCountry[country];
      for (const c of cities) {
        const name = typeof c === 'string' ? c.trim() : '';
        if (!name) continue;
        if (!list.some((x) => normalizeText(x) === normalizeText(name))) {
          list.push(name);
          imported++;
        } else {
          skipped++;
        }
      }
      list.sort((a, b) => a.localeCompare(b, 'ar'));
    }
  }
  save();
  return { ok: true, imported, skipped, errors };
}

// إعادة التعيين لبيانات البذرة
export function resetGeoDB(): void {
  db = seedDB();
  save();
}

// إجبار إعادة التحميل من التخزين (للاستخدام بعد التعديلات الخارجية)
export function refreshGeoDB(): void {
  db = null;
  load();
}

export function adminMergeCities(
  sourceCountry: string,
  sourceCity: string,
  targetCountry: string,
  targetCity: string
): { ok: boolean; error?: string } {
  const d = load();
  
  const normSourceCountry = normalizeText(sourceCountry);
  const normSourceCity = normalizeText(sourceCity);
  const normTargetCountry = normalizeText(targetCountry);
  const normTargetCity = normalizeText(targetCity);

  if (!normSourceCountry || !normSourceCity || !normTargetCountry || !normTargetCity) {
    return { ok: false, error: 'المدخلات غير مكتملة' };
  }

  // 1. Remove sourceCity from sourceCountry
  Object.keys(d.citiesByCountry).forEach((k) => {
    if (normalizeText(k) === normSourceCountry) {
      d.citiesByCountry[k] = d.citiesByCountry[k].filter(
        (c) => normalizeText(c) !== normSourceCity
      );
    }
  });

  // 2. Add targetCity to targetCountry if it doesn't exist
  let targetKey = targetCountry.trim();
  for (const k of Object.keys(d.citiesByCountry)) {
    if (normalizeText(k) === normTargetCountry) {
      targetKey = k;
      break;
    }
  }
  if (!d.citiesByCountry[targetKey]) {
    d.citiesByCountry[targetKey] = [];
  }
  const targetList = d.citiesByCountry[targetKey];
  if (!targetList.some((c) => normalizeText(c) === normTargetCity)) {
    targetList.push(targetCity.trim());
    targetList.sort((a, b) => a.localeCompare(b, 'ar'));
  }

  d.pendingCities.forEach((p) => {
    if (
      p.kind === 'city' &&
      normalizeText(p.name) === normSourceCity &&
      (!normSourceCountry || !normalizeText(p.country) || normalizeText(p.country) === normSourceCountry)
    ) {
      p.status = 'merged';
      p.rejectionReason = `merged into ${targetCity}`;
    }
  });

  save();

  // 3. Update all members' city & residence & country
  batchUpdateMemberGeo('city', sourceCity, targetCity.trim(), targetCountry.trim(), sourceCountry);

  return { ok: true };
}

export function adminMergeCountries(
  sourceCountry: string,
  targetCountry: string
): { ok: boolean; error?: string } {
  const d = load();

  const normSourceCountry = normalizeText(sourceCountry);
  const normTargetCountry = normalizeText(targetCountry);

  if (!normSourceCountry || !normTargetCountry) {
    return { ok: false, error: 'المدخلات غير مكتملة' };
  }

  if (normSourceCountry === normTargetCountry) {
    return { ok: false, error: 'لا يمكن دمج الدولة مع نفسها' };
  }

  // 1. Merge cities of sourceCountry into targetCountry
  let sourceCities: string[] = [];
  Object.keys(d.citiesByCountry).forEach((k) => {
    if (normalizeText(k) === normSourceCountry) {
      sourceCities = [...sourceCities, ...d.citiesByCountry[k]];
      delete d.citiesByCountry[k];
    }
  });

  let targetKey = targetCountry.trim();
  for (const k of Object.keys(d.citiesByCountry)) {
    if (normalizeText(k) === normTargetCountry) {
      targetKey = k;
      break;
    }
  }
  if (!d.citiesByCountry[targetKey]) {
    d.citiesByCountry[targetKey] = [];
  }
  const targetCities = d.citiesByCountry[targetKey];
  sourceCities.forEach((city) => {
    if (!targetCities.some((c) => normalizeText(c) === normalizeText(city))) {
      targetCities.push(city);
    }
  });
  targetCities.sort((a, b) => a.localeCompare(b, 'ar'));

  // 2. Remove sourceCountry
  d.countries = d.countries.filter((c) => normalizeText(c.name) !== normSourceCountry);

  // 3. Update pending suggestions
  d.pendingCities.forEach((p) => {
    if (p.kind === 'country' && normalizeText(p.name) === normSourceCountry) {
      p.status = 'merged';
      p.rejectionReason = `merged into ${targetCountry}`;
    }
  });

  save();

  // 4. Update all members' country
  batchUpdateMemberGeo('country', sourceCountry, targetCountry.trim());

  return { ok: true };
}

export function batchUpdateMemberGeo(
  kind: 'country' | 'city' | 'nationality' | 'skinColor' | 'education' | 'workType',
  oldValue: string,
  newValue: string,
  targetCountry?: string,
  sourceCountryFilter?: string
): { updatedCount: number } {
  if (!oldValue || !newValue) return { updatedCount: 0 };
  const normOld = normalizeText(oldValue);
  const normSourceCountryFilter = sourceCountryFilter ? normalizeText(sourceCountryFilter) : '';
  let totalUpdated = 0;

  if (typeof window !== 'undefined') {
    const keys = ['saved_members_list', 'saved_admin_members_list', 'twafok_members', 'twafok_members_v2'];
    keys.forEach((key) => {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            let count = 0;
            const updatedList = list.map((m: any) => {
              let changed = false;
              const copy = { ...m };

              if (kind === 'nationality') {
                if (normalizeText(m.nationality || '') === normOld) {
                  copy.nationality = newValue.trim();
                  changed = true;
                }
              } else if (kind === 'skinColor') {
                if (normalizeText(m.skinColor || m.skin_color || '') === normOld) {
                  copy.skinColor = newValue.trim();
                  copy.skin_color = newValue.trim();
                  changed = true;
                }
              } else if (kind === 'education') {
                if (normalizeText(m.education || m.qualification || '') === normOld) {
                  copy.education = newValue.trim();
                  changed = true;
                }
              } else if (kind === 'workType') {
                if (normalizeText(m.workType || m.occupation || m.job || '') === normOld) {
                  copy.workType = newValue.trim();
                  copy.occupation = newValue.trim();
                  changed = true;
                }
              } else if (kind === 'country') {
                if (normalizeText(m.country || '') === normOld) {
                  copy.country = newValue.trim();
                  changed = true;
                }
                if (normalizeText(m.nationality || '') === normOld) {
                  copy.nationality = newValue.trim();
                  changed = true;
                }
              } else if (kind === 'city') {
                const normMCity = normalizeText(m.city || '');
                const normMResidence = normalizeText(m.residence || '');
                const normMCountry = normalizeText(m.country || '');

                const cityMatched = normMCity === normOld || normMResidence === normOld;
                let countryMatched = true;
                if (!targetCountry && normSourceCountryFilter && normMCountry) {
                  countryMatched =
                    normMCountry === normSourceCountryFilter ||
                    normMCountry.includes(normSourceCountryFilter) ||
                    normSourceCountryFilter.includes(normMCountry);
                }

                if (cityMatched && countryMatched) {
                  if (normMCity === normOld || !m.city) {
                    copy.city = newValue.trim();
                  }
                  if (normMResidence === normOld || !m.residence) {
                    copy.residence = newValue.trim();
                  }
                  if (targetCountry && targetCountry.trim()) {
                    copy.country = targetCountry.trim();
                  }
                  changed = true;
                }
              }

              if (changed) count++;
              return copy;
            });

            if (count > 0) {
              totalUpdated += count;
              window.localStorage.setItem(key, JSON.stringify(updatedList));
            }
          }
        }
      } catch {}
    });

    try {
      const rawDb = window.localStorage.getItem('twafok_local_db_v4');
      if (rawDb) {
        const parsed = JSON.parse(rawDb);
        if (parsed && Array.isArray(parsed.members)) {
          let count = 0;
          parsed.members = parsed.members.map((m: any) => {
            let changed = false;
            const copy = { ...m };
            if (kind === 'country' && normalizeText(m.country || '') === normOld) {
              copy.country = newValue.trim();
              changed = true;
            } else if (kind === 'city') {
              const normMCity = normalizeText(m.city || '');
              const normMResidence = normalizeText(m.residence || '');
              if (normMCity === normOld || normMResidence === normOld) {
                copy.city = newValue.trim();
                if (targetCountry && targetCountry.trim()) copy.country = targetCountry.trim();
                changed = true;
              }
            } else if (kind === 'nationality' && normalizeText(m.nationality || '') === normOld) {
              copy.nationality = newValue.trim();
              changed = true;
            }
            if (changed) count++;
            return copy;
          });
          if (count > 0) {
            window.localStorage.setItem('twafok_local_db_v4', JSON.stringify(parsed));
          }
        }
      }
    } catch {}

    try {
      const rawMeta = window.localStorage.getItem('twafok_members_meta_v4');
      if (rawMeta) {
        const meta = JSON.parse(rawMeta);
        if (meta && typeof meta === 'object') {
          let count = 0;
          for (const k of Object.keys(meta)) {
            const m = meta[k];
            let changed = false;
            const copy = { ...m };

            if (kind === 'nationality') {
              if (normalizeText(m.nationality || '') === normOld) {
                copy.nationality = newValue.trim();
                changed = true;
              }
            } else if (kind === 'skinColor') {
              if (normalizeText(m.skinColor || m.skin_color || '') === normOld) {
                copy.skinColor = newValue.trim();
                copy.skin_color = newValue.trim();
                changed = true;
              }
            } else if (kind === 'education') {
              if (normalizeText(m.education || m.qualification || '') === normOld) {
                copy.education = newValue.trim();
                changed = true;
              }
            } else if (kind === 'workType') {
              if (normalizeText(m.workType || m.occupation || m.job || '') === normOld) {
                copy.workType = newValue.trim();
                copy.occupation = newValue.trim();
                changed = true;
              }
            } else if (kind === 'country') {
              if (normalizeText(m.country || '') === normOld) {
                copy.country = newValue.trim();
                changed = true;
              }
              if (normalizeText(m.nationality || '') === normOld) {
                copy.nationality = newValue.trim();
                changed = true;
              }
            } else if (kind === 'city') {
              const normMCity = normalizeText(m.city || '');
              const normMResidence = normalizeText(m.residence || '');
              const normMCountry = normalizeText(m.country || '');

              const cityMatched = normMCity === normOld || normMResidence === normOld;
              let countryMatched = true;
              if (normSourceCountryFilter && normMCountry) {
                countryMatched =
                  normMCountry === normSourceCountryFilter ||
                  normMCountry.includes(normSourceCountryFilter) ||
                  normSourceCountryFilter.includes(normMCountry);
              }

              if (cityMatched && countryMatched) {
                if (normMCity === normOld || !m.city) {
                  copy.city = newValue.trim();
                }
                if (normMResidence === normOld || !m.residence) {
                  copy.residence = newValue.trim();
                }
                if (targetCountry && targetCountry.trim()) {
                  copy.country = targetCountry.trim();
                }
                changed = true;
              }
            }

            if (changed) {
              count++;
              meta[k] = copy;
            }
          }
          if (count > 0) {
            window.localStorage.setItem('twafok_members_meta_v4', JSON.stringify(meta));
          }
        }
      }
    } catch {}
  }

  return { updatedCount: totalUpdated };
}
