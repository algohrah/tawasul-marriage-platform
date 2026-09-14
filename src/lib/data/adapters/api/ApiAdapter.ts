import { LocalStorageAdapter } from '../../LocalStorageAdapter';
import { IRepository, ISettingsRepository } from '../../interfaces';
import type { Member } from '../../../members';
import { MEMBERS } from '../../../members';
import { ADMIN_MEMBERS } from '../../../admin-data';
import { INTEREST_REQUESTS } from '../../../data';
import {
  COUNTRIES as SEED_COUNTRIES,
  CITIES_BY_COUNTRY as SEED_CITIES,
  NATIONALITIES,
} from '../../../constants';
import supabaseClient from '../../../supabase';
import * as geoStore from '../local/geoStore';

type JsonMap = Record<string, any>;

const CURRENT_USER_KEY = 'active_member_id';
const MEMBER_CACHE_KEY = 'twafok_api_members_cache';
const REQUEST_CACHE_KEY = 'twafok_api_requests_cache';
const NOTIFICATION_CACHE_KEY = 'twafok_api_notifications_cache';
const COUPON_CACHE_KEY = 'twafok_api_coupons_cache';
const TX_CACHE_KEY = 'twafok_api_transactions_cache';
const DOC_CACHE_KEY = 'twafok_api_verification_docs_cache';
const SETTINGS_CACHE_KEY = 'twafok_api_settings_cache';
const COUNTRIES_CACHE_KEY = 'twafok_api_countries_cache';
const CITIES_CACHE_KEY = 'twafok_api_cities_cache';
const PENDING_CITIES_CACHE_KEY = 'twafok_api_pending_cities_cache';
const NATIONALITIES_CACHE_KEY = 'twafok_api_nationalities_cache';
const GEO_SUGGESTIONS_CACHE_KEY = 'twafok_api_geo_suggestions_cache';

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

// ============================================================
//  رمز جلسة مصادقة مخزَّن محلياً بشكل متزامن (Sync) — يُستخدم فقط في مسار
//  navigator.sendBeacon الذي لا يدعم إرفاق ترويسات HTTP (Authorization) ولا
//  يمكن أن ينتظر Promise (يُستدعى عند إغلاق/تبديل التبويب). نُبقيه محدَّثاً
//  عبر الاشتراك بتغييرات حالة المصادقة، ونُرفقه داخل نص الطلب (body) بدلاً
//  من الترويسة، ويتحقق منه الخادم كبديل عن ترويسة Authorization.
// ============================================================
let cachedAccessToken: string | null = null;
if (isBrowser()) {
  supabaseClient.auth.getSession().then(({ data }: any) => { cachedAccessToken = data?.session?.access_token || null; }).catch(() => undefined);
  supabaseClient.auth.onAuthStateChange((_event: string, session: any) => {
    cachedAccessToken = session?.access_token || null;
  });
}

function readCache<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    if (fallback !== null && typeof fallback === 'object' && !Array.isArray(fallback)) {
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

function writeCache(key: string, value: any) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // تجاهل امتلاء التخزين المحلي — المصدر الحقيقي هو Supabase عبر API.
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');

  // نُرفق تلقائياً رمز جلسة Supabase Auth الحالية (إن وُجدت) مع كل طلب،
  // ليتحقق الخادم من صلاحية المستخدم/المشرف الحقيقية بدل الاعتماد على أي بيانات من العميل.
  if (!headers.has('Authorization')) {
    try {
      const { data } = await supabaseClient.auth.getSession();
      const token = data?.session?.access_token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
    } catch {
      // لا نمنع الطلب في حال تعذّر قراءة الجلسة
    }
  }

  if (isBrowser() && localStorage.getItem('impersonating') === 'true') {
    headers.set('X-Impersonating', 'true');
  }

  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  let payload: any = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!res.ok) {
    const message = payload?.error || payload?.message || `تعذر الاتصال بالخادم (${res.status})`;
    throw new Error(message);
  }
  if (typeof payload === 'string' && (payload.trim().startsWith('<!') || payload.trim().startsWith('<html'))) {
    throw new Error('استجابة غير صالحة من الخادم (تم إرجاع صفحة HTML بدلاً من بيانات JSON)');
  }
  return payload as T;
}

function normalizeMember(row: any): any {
  if (!row) return row;
  return {
    ...row,
    id: String(row.id),
    nickname: row.nickname || row.real_name || row.realName || row.id,
    username: row.username || '',
    gender: row.gender || '',
    age: Number(row.age) || 0,
    birthDate: row.birth_date || row.birthDate || '',
    country: row.country || '',
    city: row.city || '',
    district: row.district || '',
    nationality: row.nationality || '',
    sect: row.sect || '',
    maritalStatus: row.marital_status || row.maritalStatus || 'single',
    maritalLabel: row.marital_label || row.maritalLabel || '',
    marriageType: row.marriageType || row.marriage_type || row.details?.marriageType || row.details?.marriage_type || 'announced',
    marriageTypeLabel: row.marriageTypeLabel || row.details?.marriageTypeLabel || (
      (row.marriageType || row.marriage_type || row.details?.marriageType || row.details?.marriage_type) === 'misyar' ? 'مسيار' :
      (row.marriageType || row.marriage_type || row.details?.marriageType || row.details?.marriage_type) === 'both' ? 'معلن أو مسيار' : 'معلن'
    ),
    hasChildren: !!(row.has_children ?? row.hasChildren),
    childrenCount: row.children_count || row.childrenCount || '',
    height: Number(row.height) || 0,
    weight: Number(row.weight) || 0,
    skinColor: row.skin_color || row.skinColor || '',
    health: row.health || '',
    smoking: row.smoking || '',
    ethnicity: row.ethnicity || '',
    tribe: row.tribe || row.details?.tribe || '',
    education: row.education || '',
    workType: row.work_type || row.workType || '',
    jobTitle: row.job_title || row.jobTitle || '',
    housing: row.housing || '',
    bio: row.bio || '',
    aboutPartner: row.about_partner || row.aboutPartner || '',
    pCountry: row.pCountry || row.p_country || row.details?.pCountry || 'لا يهم',
    pCity: row.pCity || row.p_city || row.details?.pCity || 'لا يهم',
    pNationality: row.pNationality || row.p_nationality || row.details?.pNationality || 'اقبل اجنبي',
    pAgeMin: row.pAgeMin ?? row.p_age_min ?? row.details?.pAgeMin ?? '',
    pAgeMax: row.pAgeMax ?? row.p_age_max ?? row.details?.pAgeMax ?? '',
    pMaritalStatus: row.pMaritalStatus || row.p_marital_status || row.details?.pMaritalStatus || 'لا يهم',
    pAcceptChildren: row.pAcceptChildren || row.p_accept_children || row.details?.pAcceptChildren || '',
    customLists: row.customLists || row.custom_lists || row.details?.customLists || [],
    verified: !!row.verified,
    premium: !!row.premium,
    online: !!row.online,
    lastActive: row.last_active || row.lastActive || new Date().toISOString(),
    matchScore: Number(row.match_score ?? row.matchScore) || 90,
    hasSeriousnessBadge: !!(row.has_seriousness_badge ?? row.hasSeriousnessBadge),
    plan: row.plan || 'free',
    pinned: !!row.pinned,
    status: row.status || 'active',
    statusReason: row.status_reason || row.statusReason || '',
    statusBy: row.status_by || row.statusBy || '',
    adminNote: row.notes || row.adminNote || '',
    notes: row.notes || row.adminNote || '',
    flagged: !!row.flagged,
    sourceType: row.source_type || row.sourceType || 'registered',
    importBatchId: row.import_batch_id || row.importBatchId || '',
    importOfficeName: row.import_office_name || row.importOfficeName || '',
    importDate: row.import_date || row.importDate || '',
    importNotes: row.import_notes || row.importNotes || '',
    isProfileIncomplete: !!(row.is_profile_incomplete ?? row.isProfileIncomplete),
    realName: row.real_name || row.realName || row.nickname || row.id,
    email: row.email || '',
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    password: row.password || '',
  };
}

// حقول حسّاسة يجب ألا تُخزَّن أبداً داخل الكاش/التخزين المحلي المشترك الذي تقرأ منه الصفحات العامة
// (البحث، الرئيسية، الملف العام). تبقى هذه الحقول متاحة فقط ضمن حالة React الخاصة بلوحة الإدارة
// (adminMembers) التي تُعاد تعبئتها مباشرة من الخادم عند كل تحميل/تحديث، دون المرور عبر هذا الكاش.
const PUBLIC_CACHE_SENSITIVE_KEYS = [
  'password', 'email', 'phone', 'whatsapp', 'realName', 'real_name', 'notes', 'adminNote',
  'statusReason', 'status_reason', 'statusBy', 'status_by',
  'importBatchId', 'import_batch_id', 'importOfficeName', 'import_office_name',
  'importDate', 'import_date', 'importNotes', 'import_notes',
  'birthDate', 'birth_date', 'details',
];

function stripSensitiveForPublicCache(member: any): any {
  if (!member) return member;
  const clone = { ...member };
  PUBLIC_CACHE_SENSITIVE_KEYS.forEach((k) => { delete clone[k]; });
  return clone;
}

function normalizeRequest(row: any): any {
  if (!row) return row;
  const stage = row.journey_stage || row.status || row.mediation_stage || 'pending';
  const reqNum = row.request_number || row.requestNumber || row.id;
  const srcType = row.source_type || row.sourceType || 'registered';
  return {
    ...row,
    id: Number(row.id),
    request_number: Number(reqNum) || Number(row.id),
    requestNumber: Number(reqNum) || Number(row.id),
    source_type: srcType,
    sourceType: srcType,
    sender_id: row.sender_id || row.senderId,
    receiver_id: row.receiver_id || row.receiverId,
    senderId: row.sender_id || row.senderId,
    receiverId: row.receiver_id || row.receiverId,
    journey_stage: stage,
    status: stage,
    mediationStage: row.mediation_stage || row.mediationStage || stage,
    message: row.message || '',
    sender_paid: !!(row.sender_paid ?? row.senderPaid),
    receiver_paid: !!(row.receiver_paid ?? row.receiverPaid),
    senderPaid: !!(row.sender_paid ?? row.senderPaid),
    receiverPaid: !!(row.receiver_paid ?? row.receiverPaid),
    sender_paid_at: row.sender_paid_at || row.senderPaidAt || null,
    receiver_paid_at: row.receiver_paid_at || row.receiverPaidAt || null,
    created_at: row.created_at || row.createdAt || new Date().toISOString(),
    updated_at: row.updated_at || row.updatedAt || new Date().toISOString(),
  };
}

/**
 * مفاتيح خاصة بالمتصفح فقط (جلسة/تفضيلات شخصية) — لا تُرفع أبداً للخادم
 * ولا تُقرأ من إعدادات السحابة المشتركة، لأن جدول settings مشترك بين جميع المستخدمين.
 * هذا يمنع مشكلة «آخر مستخدم سجّل دخوله يكتب فوق جلسة الجميع».
 */
const LOCAL_ONLY_KEY_PREFIXES = [
  'auth_user',
  'active_member_id',
  'impersonating',
  'user_profile_data',
  'liked_members_',
  'blocked_members_',
  'user_usage_counters',
];

function isLocalOnlyKey(key: string): boolean {
  return LOCAL_ONLY_KEY_PREFIXES.some((p) => key === p || key.startsWith(p));
}

/**
 * لقطات JSON قديمة ضخمة (25KB+) كانت تُرفع للخادم مع كل تغيير.
 * الجداول الحقيقية (members / interest_requests / support_tickets ...) هي
 * المصدر الوحيد للحقيقة الآن، لذا تُحفظ هذه اللقطات محلياً فقط كاحتياط قراءة
 * ولا تُرفع للخادم إطلاقاً.
 */
const LEGACY_SNAPSHOT_KEYS = [
  'saved_members_list',
  'saved_admin_members_list',
  'saved_interest_requests',
  'saved_support_tickets_list',
  'saved_admin_notifications',
  'saved_member_reports_list',
  'saved_exempt_requests',
  'twafok_members',
];

function isLegacySnapshotKey(key: string): boolean {
  return LEGACY_SNAPSHOT_KEYS.includes(key);
}

class ApiSettingsRepository implements ISettingsRepository {
  private cache: Map<string, string>;
  /** مفاتيح متغيّرة بانتظار الرفع للخادم (مزامنة مجمّعة) */
  private pendingSync = new Map<string, string>();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  /** آخر قيمة أُرسلت فعلياً للخادم لكل مفتاح — لتخطي القيم غير المتغيرة */
  private lastSynced = new Map<string, string>();

  constructor() {
    this.cache = new Map(Object.entries(readCache<Record<string, string>>(SETTINGS_CACHE_KEY, {})));
    this.refresh();
    // رفع أي تغييرات معلّقة قبل مغادرة الصفحة
    if (isBrowser()) {
      window.addEventListener('beforeunload', () => this.flushSync(true));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flushSync(true);
      });
    }
  }

  private persist() {
    writeCache(SETTINGS_CACHE_KEY, Object.fromEntries(this.cache.entries()));
  }

  /** جدولة مزامنة مجمّعة بفاصل 3 ثوانٍ بدلاً من طلب لكل تغيير */
  private scheduleSync(key: string, value: string) {
    // تخطي إن لم تتغير القيمة عمّا أُرسل سابقاً
    if (this.lastSynced.get(key) === value) return;
    this.pendingSync.set(key, value);
    if (this.syncTimer) return;
    this.syncTimer = setTimeout(() => this.flushSync(), 3000);
  }

  private flushSync(useBeacon = false) {
    if (this.syncTimer) { clearTimeout(this.syncTimer); this.syncTimer = null; }
    if (this.pendingSync.size === 0) return;
    const entries = Array.from(this.pendingSync.entries());
    this.pendingSync.clear();
    for (const [key, value] of entries) {
      this.lastSynced.set(key, value);
      if (useBeacon && isBrowser() && navigator.sendBeacon) {
        try {
          // نُرفق رمز الجلسة داخل نص الطلب نفسه لأن sendBeacon لا يدعم ترويسة Authorization
          const beaconBody = JSON.stringify({ key, value, _authToken: cachedAccessToken });
          navigator.sendBeacon('/api/settings', new Blob([beaconBody], { type: 'application/json' }));
          continue;
        } catch { /* fallback to fetch */ }
      }
      apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ key, value }) }).catch(() => undefined);
    }
  }

  async refresh() {
    try {
      const rows = await apiFetch<Array<{ key: string; value: string }>>('/api/settings');
      rows.forEach((row) => {
        this.cache.set(row.key, row.value);
        this.lastSynced.set(row.key, row.value);
      });
      this.persist();
    } catch {
      // يعمل التطبيق بآخر نسخة مخزنة لحين عودة الاتصال.
    }
  }

  get(key: string): string | null {
    if (isBrowser()) {
      const local = localStorage.getItem(key);
      if (local !== null) return local;
    }
    // المفاتيح الشخصية لا تُقرأ أبداً من الإعدادات السحابية المشتركة
    if (isLocalOnlyKey(key)) return null;
    return this.cache.get(key) ?? null;
  }

  set(key: string, value: string): void {
    // الحفظ المحلي فوري دائماً — التطبيق لا ينتظر الشبكة
    if (isBrowser()) {
      try { localStorage.setItem(key, value); } catch {}
    }
    // المفاتيح الشخصية (جلسة، تفضيلات) تبقى في هذا المتصفح فقط
    if (isLocalOnlyKey(key)) return;
    this.cache.set(key, value);
    this.persist();
    // اللقطات القديمة الضخمة لا تُرفع للخادم — الجداول الحقيقية هي المصدر
    if (isLegacySnapshotKey(key)) return;
    // المزامنة مع الخادم مجمّعة (debounced) لمنع عاصفة الطلبات
    this.scheduleSync(key, value);
  }

  remove(key: string): void {
    this.cache.delete(key);
    this.pendingSync.delete(key);
    this.lastSynced.delete(key);
    this.persist();
    if (isBrowser()) localStorage.removeItem(key);
    apiFetch('/api/settings', {
      method: 'DELETE',
      body: JSON.stringify({ key }),
    }).catch(() => undefined);
  }
}

class ApiMembersRepository implements IRepository<any> {
  constructor(private adapter: ApiAdapter) {}

  getAll(): Promise<any[]> { return this.adapter.getMembers(); }

  async getById(id: string | number): Promise<any | null> {
    const found = this.adapter.getLiveMemberById(String(id));
    if (found) return found;
    try {
      return normalizeMember(await apiFetch(`/api/members?id=${encodeURIComponent(String(id))}`));
    } catch {
      return null;
    }
  }

  async create(item: any): Promise<any> {
    const member = normalizeMember(await apiFetch('/api/members', {
      method: 'POST',
      body: JSON.stringify(item),
    }));
    this.adapter.upsertMemberCache(member);
    return member;
  }

  async update(id: string | number, payload: Partial<any>): Promise<any> {
    const member = normalizeMember(await apiFetch('/api/members', {
      method: 'PUT',
      body: JSON.stringify({ id, ...payload }),
    }));
    this.adapter.upsertMemberCache(member);
    return member;
  }

  async delete(id: string | number): Promise<boolean> {
    await apiFetch('/api/members', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    this.adapter.removeMemberCache(String(id));
    return true;
  }
}

class ApiGenericRepository<T extends { id: string | number }> implements IRepository<T> {
  constructor(private route: string) {}

  async getAll(): Promise<T[]> { return apiFetch<T[]>(this.route); }

  async getById(id: string | number): Promise<T | null> {
    try { return await apiFetch<T>(`${this.route}?id=${encodeURIComponent(String(id))}`); }
    catch { return null; }
  }

  async create(item: T): Promise<T> {
    return apiFetch<T>(this.route, { method: 'POST', body: JSON.stringify(item) });
  }

  async update(id: string | number, payload: Partial<T>): Promise<T> {
    return apiFetch<T>(this.route, { method: 'PUT', body: JSON.stringify({ id, ...payload }) });
  }

  async delete(id: string | number): Promise<boolean> {
    await apiFetch(this.route, { method: 'DELETE', body: JSON.stringify({ id }) });
    return true;
  }
}

export class ApiAdapter extends LocalStorageAdapter {
  public members: IRepository<any>;
  public requests: IRepository<any>;
  public transactions: IRepository<any>;
  public tickets: IRepository<any>;
  public adminUsers: IRepository<any>;
  public settings: ISettingsRepository;

  private memberCache: any[] = (() => {
    const cached = readCache<any[]>(MEMBER_CACHE_KEY, readCache<any[]>('saved_members_list', readCache<any[]>('saved_admin_members_list', [])));
    if (Array.isArray(cached) && cached.length > 0) return cached.map(normalizeMember);
    return (ADMIN_MEMBERS && ADMIN_MEMBERS.length > 0 ? ADMIN_MEMBERS : MEMBERS).map(normalizeMember);
  })();
  private requestCache: any[] = (() => {
    const cached = readCache<any[]>(REQUEST_CACHE_KEY, readCache<any[]>('saved_interest_requests', []));
    if (Array.isArray(cached) && cached.length > 0) return cached;
    return INTEREST_REQUESTS || [];
  })();
  private notificationCache: any[] = readCache<any[]>(NOTIFICATION_CACHE_KEY, []);
  private couponCache: any[] = readCache<any[]>(COUPON_CACHE_KEY, []);
  private txCache: any[] = readCache<any[]>(TX_CACHE_KEY, []);
  private docCache: any[] = readCache<any[]>(DOC_CACHE_KEY, []);
  private countriesCache: any[] = readCache<any[]>(COUNTRIES_CACHE_KEY, SEED_COUNTRIES.map((name: string) => ({ name })));
  private citiesCache: Record<string, string[]> = readCache<Record<string, string[]>>(CITIES_CACHE_KEY, SEED_CITIES as Record<string, string[]>);
  private pendingCitiesCache: any[] = readCache<any[]>(PENDING_CITIES_CACHE_KEY, []);
  private nationalitiesCache: string[] = readCache<string[]>(NATIONALITIES_CACHE_KEY, []);
  private geoSuggestionsCache: any[] = readCache<any[]>(GEO_SUGGESTIONS_CACHE_KEY, []);

  private get safePendingCitiesCache(): any[] {
    if (!Array.isArray(this.pendingCitiesCache)) this.pendingCitiesCache = [];
    return this.pendingCitiesCache;
  }
  private get safeGeoSuggestionsCache(): any[] {
    if (!Array.isArray(this.geoSuggestionsCache)) this.geoSuggestionsCache = [];
    return this.geoSuggestionsCache;
  }
  private get safeCountriesCache(): any[] {
    if (!Array.isArray(this.countriesCache)) this.countriesCache = SEED_COUNTRIES.map((name: string) => ({ name }));
    return this.countriesCache;
  }
  private get safeNationalitiesCache(): string[] {
    if (!Array.isArray(this.nationalitiesCache)) this.nationalitiesCache = [];
    return this.nationalitiesCache;
  }
  private get safeDocCache(): any[] {
    if (!Array.isArray(this.docCache)) this.docCache = [];
    return this.docCache;
  }
  private get safeNotificationCache(): any[] {
    if (!Array.isArray(this.notificationCache)) this.notificationCache = [];
    return this.notificationCache;
  }
  private get safeCouponCache(): any[] {
    if (!Array.isArray(this.couponCache)) this.couponCache = [];
    return this.couponCache;
  }
  private get safeTxCache(): any[] {
    if (!Array.isArray(this.txCache)) this.txCache = [];
    return this.txCache;
  }

  constructor() {
    super();
    this.members = new ApiMembersRepository(this);
    this.requests = new ApiGenericRepository<any>('/api/interest-requests');
    this.transactions = new ApiGenericRepository<any>('/api/transactions');
    this.tickets = new ApiGenericRepository<any>('/api/support-tickets');
    this.adminUsers = new ApiGenericRepository<any>('/api/admin-users');
    this.settings = new ApiSettingsRepository();
    this.hydrateCaches();
  }

  private hydrateCaches() {
    // تحميل كسول: عند الإقلاع نجلب الطلبات فقط.
    // الأعضاء يُجلبون مرة واحدة عبر AppContext (adminGetMembers) — لا داعي للتكرار هنا.
    // الكوبونات/المعاملات/التوثيق/الجغرافيا/الإشعارات تُجلب تلقائياً عند أول استخدام
    // لأن دوال getCoupons/getTransactions/getCountries... تستدعي refresh الخاص بها.
    this.getRequests().catch(() => undefined);
  }

  private cacheMembers(list: any[]) {
    // الكاش المشترك هنا تقرأ منه الصفحات العامة (البحث/الرئيسية) — نُزيل الحقول الحسّاسة
    // دفاعياً قبل التخزين حتى لو وصلتنا بيانات كاملة من استجابة تعديل إداري.
    this.memberCache = list.map(normalizeMember).map(stripSensitiveForPublicCache);
    writeCache(MEMBER_CACHE_KEY, this.memberCache);
    writeCache('saved_members_list', this.memberCache);
  }

  upsertMemberCache(member: any) {
    const normalized = normalizeMember(member);
    const adminList = readCache<any[]>('saved_admin_members_list', readCache<any[]>('twafok_members', []));
    if (Array.isArray(adminList)) {
      const idxA = adminList.findIndex((m) => String(m.id) === String(normalized.id));
      if (idxA >= 0) adminList[idxA] = { ...adminList[idxA], ...normalized };
      else adminList.unshift(normalized);
      writeCache('saved_admin_members_list', adminList);
      writeCache('twafok_members', adminList);
    }
    const idx = this.memberCache.findIndex((m) => String(m.id) === String(normalized.id));
    if (idx >= 0) this.memberCache[idx] = { ...this.memberCache[idx], ...normalized };
    else this.memberCache.unshift(normalized);
    this.cacheMembers(this.memberCache);
  }

  removeMemberCache(id: string) {
    const adminList = readCache<any[]>('saved_admin_members_list', []);
    if (Array.isArray(adminList)) {
      const filtered = adminList.filter((m) => String(m.id) !== String(id));
      writeCache('saved_admin_members_list', filtered);
      writeCache('twafok_members', filtered);
    }
    this.cacheMembers(this.memberCache.filter((m) => String(m.id) !== String(id)));
  }

  private cacheRequests(list: any[]) {
    this.requestCache = list.map(normalizeRequest);
    writeCache(REQUEST_CACHE_KEY, this.requestCache);
    writeCache('saved_interest_requests', this.requestCache);
  }

  private upsertRequestCache(req: any) {
    const normalized = normalizeRequest(req);
    const idx = this.requestCache.findIndex((r) => Number(r.id) === Number(normalized.id));
    if (idx >= 0) this.requestCache[idx] = normalized;
    else this.requestCache.unshift(normalized);
    this.cacheRequests(this.requestCache);
  }

  // ===== الأعضاء =====
  getMembers = async (): Promise<any[]> => {
    try {
      const rows = await apiFetch<any[]>('/api/members');
      if (!Array.isArray(rows)) {
        console.warn('getMembers received non-array response:', rows);
        return this.getLiveMembers(false);
      }
      const list = rows.map(normalizeMember);
      this.cacheMembers(list);
      return list;
    } catch (err) {
      console.warn('getMembers fetch error, using local fallback:', err);
      return this.getLiveMembers(false);
    }
  };

  getLiveMembers = (includeInactiveAndDeleted: boolean = false): any[] => {
    let list: any[];
    if (includeInactiveAndDeleted) {
      const adminList = readCache<any[]>('saved_admin_members_list', readCache<any[]>('twafok_members', []));
      list = (Array.isArray(adminList) && adminList.length > 0) ? adminList : this.memberCache;
    } else {
      list = this.memberCache;
    }
    if (!list || !Array.isArray(list) || list.length === 0) {
      list = (ADMIN_MEMBERS && ADMIN_MEMBERS.length > 0 ? ADMIN_MEMBERS : MEMBERS);
      this.memberCache = list.map(normalizeMember);
    } else {
      list = list.map(normalizeMember);
    }
    if (!includeInactiveAndDeleted) {
      list = list.filter((m) => !m.deleted && (!m.status || m.status === 'active' || m.status === 'pending'));
    }
    return [...list].sort((a, b) => {
      const pin = Number(!!b.pinned) - Number(!!a.pinned);
      if (pin) return pin;
      return String(b.id).localeCompare(String(a.id));
    });
  };

  getLiveMemberById = (id: string): any | undefined => this.getLiveMembers(true).find((m) => String(m.id) === String(id));

  getCurrentUserId = (): string => {
    if (!isBrowser()) return 'm2';
    const active = localStorage.getItem(CURRENT_USER_KEY);
    if (active && active.trim()) return active.trim();
    const authUserRaw = localStorage.getItem('auth_user');
    if (authUserRaw) {
      try {
        const authUser = JSON.parse(authUserRaw);
        if (authUser?.memberId && String(authUser.memberId).trim()) {
          return String(authUser.memberId).trim();
        }
      } catch {}
    }
    return 'm2';
  };

  setCurrentUserId = (id: string): void => {
    if (!isBrowser()) return;
    if (id) {
      localStorage.setItem(CURRENT_USER_KEY, id);
    }
  };

  hasUserPaidDepositAnywhere = (userId: string): boolean => {
    return this.requestCache.some((r) => (r.sender_id === userId || r.receiver_id === userId) && (r.sender_paid || r.receiver_paid));
  };

  // ===== الطلبات والرحلات =====
  getRequests = async (userId?: string): Promise<any[]> => {
    try {
      const query = userId && userId.trim() ? `?userId=${encodeURIComponent(userId.trim())}` : '';
      const rows = await apiFetch<any[]>(`/api/interest-requests${query}`);
      if (!Array.isArray(rows)) {
        return userId && userId.trim()
          ? this.requestCache.filter((r) => String(r.sender_id) === userId.trim() || String(r.receiver_id) === userId.trim())
          : this.requestCache;
      }
      const list = rows.map(normalizeRequest);
      this.cacheRequests(userId ? [...list, ...this.requestCache.filter((r) => r.sender_id !== userId && r.receiver_id !== userId)] : list);
      return userId && userId.trim()
        ? list.filter((r) => String(r.sender_id) === userId.trim() || String(r.receiver_id) === userId.trim())
        : list;
    } catch {
      return userId && userId.trim()
        ? this.requestCache.filter((r) => String(r.sender_id) === userId.trim() || String(r.receiver_id) === userId.trim())
        : this.requestCache;
    }
  };

  getRequest = async (id: number): Promise<any | null> => {
    try {
      const row = await apiFetch<any>(`/api/interest-requests?id=${encodeURIComponent(String(id))}`);
      const req = normalizeRequest(row);
      this.upsertRequestCache(req);
      return req;
    } catch {
      return this.requestCache.find((r) => Number(r.id) === Number(id)) || null;
    }
  };

  createRequest = async (senderId: string, receiverId: string, message: string): Promise<any> => {
    const isImp = isBrowser() && localStorage.getItem('impersonating') === 'true';
    try {
      const row = await apiFetch<any>('/api/interest-requests', {
        method: 'POST',
        body: JSON.stringify({ senderId, receiverId, message, _impersonating: isImp }),
      });
      this.upsertRequestCache(row);
      return { ok: true, data: normalizeRequest(row) };
    } catch (err: any) {
      console.warn('API createRequest error, using resilient fallback:', err);
      // إنشاء محلي احتياطي لضمان عدم توقف العضو أو المشرف عند إرسال اهتمام
      const fallbackRow = {
        id: Date.now(),
        sender_id: senderId,
        receiver_id: receiverId,
        message,
        journey_stage: 'sent',
        status: 'pending',
        mediation_stage: 'sent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.upsertRequestCache(fallbackRow);
      return { ok: true, data: normalizeRequest(fallbackRow) };
    }
  };

  runRequestAction = async (requestId: number, action: string, actorId: string, payload: JsonMap = {}): Promise<any> => {
    const isImp = isBrowser() && localStorage.getItem('impersonating') === 'true';
    try {
      const row = await apiFetch<any>('/api/interest-requests', {
        method: 'PUT',
        body: JSON.stringify({ id: requestId, action, actorId, payload, _impersonating: isImp }),
      });
      this.upsertRequestCache(row);
      return { ok: true, data: normalizeRequest(row) };
    } catch (err: any) {
      console.warn('API runRequestAction error, using resilient fallback:', err);
      const existing = this.requestCache.find((r) => Number(r.id) === Number(requestId));
      if (existing) {
        const updated = { ...existing, status: payload.stage || action, updated_at: new Date().toISOString() };
        this.upsertRequestCache(updated);
        return { ok: true, data: updated };
      }
      return { ok: false, error: err.message || 'تعذر تحديث رحلة الطلب' };
    }
  };

  getEvents = async (requestId: number): Promise<any[]> => {
    try {
      const rows = await apiFetch<any[]>(`/api/notifications?requestId=${encodeURIComponent(String(requestId))}`);
      return rows.map((n) => ({
        id: Number(n.id),
        request_id: Number(n.request_id || requestId),
        actor_id: n.user_id || 'system',
        type: n.type || 'system',
        note: n.text || n.title || 'تحديث على الطلب',
        created_at: n.created_at || new Date().toISOString(),
      }));
    } catch { return []; }
  };

  isRequestUnseen = (requestId: number, updatedAt?: string | null): boolean => {
    if (!isBrowser()) return false;
    const key = `twafok_seen_request_${requestId}`;
    const seen = localStorage.getItem(key);
    return !!updatedAt && seen !== updatedAt;
  };

  markRequestSeen = (requestId: number): void => {
    if (!isBrowser()) return;
    const req = this.requestCache.find((r) => Number(r.id) === Number(requestId));
    localStorage.setItem(`twafok_seen_request_${requestId}`, req?.updated_at || new Date().toISOString());
  };

  markRequestNotificationsRead = (requestId: number, userId?: string): void => {
    apiFetch('/api/notifications', { method: 'PUT', body: JSON.stringify({ requestId, userId, read: true }) }).catch(() => undefined);
  };

  // ===== غرفة الاستفسار =====
  getUserInquiryBalance = (userId: string): number => Number(this.settings.get(`inquiry_balance_${userId}`) || 0);

  consumeUserInquiryMessage = (userId: string): boolean => {
    const current = this.getUserInquiryBalance(userId);
    if (current <= 0) return false;
    this.settings.set(`inquiry_balance_${userId}`, String(current - 1));
    return true;
  };

  getInquiry = async (requestId: number): Promise<any> => {
    try {
      const messages = await apiFetch<any[]>(`/api/inquiry-messages?requestId=${encodeURIComponent(String(requestId))}`);
      return { messages };
    } catch { return { messages: [] }; }
  };

  initializeInquiry = async (requestId: number, userId: string): Promise<any> => ({ ok: true, state: await this.getInquiry(requestId), ownerId: userId });

  buyInquiry = async (requestId: number, ownerId: string): Promise<any> => this.buyMessagePackageCustom(ownerId, 4, 29, requestId);

  /**
   * @param skipTransactionRecord صحيح إذا كانت المعاملة المالية قد سُجّلت مسبقاً (مثل بوابة الدفع
   * PaymentGateway التي تُسجّل معاملة واحدة تلقائياً قبل استدعاء onPaid) — يمنع تكرار تسجيل نفس عملية الشراء مرتين.
   */
  buyMessagePackageCustom = async (userId: string, credits: number, price: number, requestId?: number, skipTransactionRecord = false): Promise<any> => {
    try {
      if (!skipTransactionRecord) {
        await apiFetch('/api/transactions', {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, userId, credits, amount: price, type: 'inquiry_package', description: `شراء ${credits} رسائل استفسار`, request_id: requestId }),
        });
      }
      this.settings.set(`inquiry_balance_${userId}`, String(this.getUserInquiryBalance(userId) + credits));
      await this.refreshTransactions();
      return { ok: true };
    } catch (err: any) { return { ok: false, error: err.message }; }
  };

  sendInquiry = async (requestId: number, senderId: string, text: string): Promise<any> => {
    try {
      const row = await apiFetch('/api/inquiry-messages', {
        method: 'POST',
        body: JSON.stringify({ requestId, senderId, text }),
      });
      return { ok: true, data: row };
    } catch (err: any) { return { ok: false, error: err.message || 'تعذر إرسال الرسالة' }; }
  };

  simulateReply = async (requestId: number, replierId: string, text: string): Promise<any> => this.sendInquiry(requestId, replierId, text);

  getAllInquiryMessages = (): any[] => readCache<any[]>('twafok_api_inquiry_messages_cache', []);

  moderateInquiryMessage = (messageId: number, action: 'approve' | 'reject', moderatorName: string): boolean => {
    apiFetch('/api/inquiry-messages', { method: 'PUT', body: JSON.stringify({ id: messageId, action, moderatorName }) }).catch(() => undefined);
    return true;
  };

  updateInquiryMessage = (messageId: number, newText: string): boolean => {
    apiFetch('/api/inquiry-messages', { method: 'PUT', body: JSON.stringify({ id: messageId, text: newText }) }).catch(() => undefined);
    return true;
  };

  deleteInquiryMessage = (messageId: number): boolean => {
    apiFetch('/api/inquiry-messages', { method: 'DELETE', body: JSON.stringify({ id: messageId }) }).catch(() => undefined);
    return true;
  };

  // ===== الإشعارات =====
  private async refreshNotifications(userId?: string) {
    try {
      const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      const rows = await apiFetch<any[]>(`/api/notifications${query}`);
      if (Array.isArray(rows)) {
        this.notificationCache = rows;
        writeCache(NOTIFICATION_CACHE_KEY, rows);
        return rows;
      }
    } catch { /* fallback */ }
    return this.notificationCache;
  }

  getJourneyNotifications = async (userId: string): Promise<any[]> => {
    try { return await this.refreshNotifications(userId); }
    catch { return this.notificationCache.filter((n) => n.user_id === userId || n.userId === userId || n.user_id === 'all'); }
  };

  markNotificationRead = (id: number): void => {
    this.notificationCache = this.notificationCache.map((n) => Number(n.id) === Number(id) ? { ...n, read: true } : n);
    writeCache(NOTIFICATION_CACHE_KEY, this.notificationCache);
    apiFetch('/api/notifications', { method: 'PUT', body: JSON.stringify({ id, read: true }) }).catch(() => undefined);
  };

  markAllNotificationsRead = (userId: string): void => {
    this.notificationCache = this.notificationCache.map((n) => (n.user_id === userId || n.user_id === 'all') ? { ...n, read: true } : n);
    writeCache(NOTIFICATION_CACHE_KEY, this.notificationCache);
    apiFetch('/api/notifications', { method: 'PUT', body: JSON.stringify({ userId, read: true }) }).catch(() => undefined);
  };

  getUnreadNotificationsCount = async (userId: string): Promise<number> => (await this.getJourneyNotifications(userId)).filter((n) => !n.read).length;

  getActionableRequestsCount = async (userId: string): Promise<number> => (await this.getRequests(userId)).filter((r) => r.receiver_id === userId && ['pending', 'sent', 'accepted'].includes(r.journey_stage)).length;

  deleteNotification = (id: number): void => {
    this.notificationCache = this.notificationCache.filter((n) => Number(n.id) !== Number(id));
    writeCache(NOTIFICATION_CACHE_KEY, this.notificationCache);
    apiFetch('/api/notifications', { method: 'DELETE', body: JSON.stringify({ id }) }).catch(() => undefined);
  };

  // ===== لوحة الإدارة =====
  adminGetMembers = async (): Promise<any[]> => {
    try {
      const rows = await apiFetch<any[]>('/api/members?admin=true');
      if (!Array.isArray(rows)) {
        console.warn('adminGetMembers received non-array response:', rows);
        return this.getLiveMembers(true);
      }
      const list = rows.map(normalizeMember);
      writeCache('saved_admin_members_list', list);
      writeCache('twafok_members', list);
      this.cacheMembers(list);
      return list;
    } catch (err) {
      console.warn('adminGetMembers fetch error, using local fallback:', err);
      return this.getLiveMembers(true);
    }
  };

  adminUpdateMember = async (id: string, fields: any): Promise<boolean> => {
    try {
      const updated = await this.members.update(id, fields);
      if (updated) {
        this.upsertMemberCache(updated);
        return true;
      }
    } catch (err) {
      console.warn('adminUpdateMember API call failed:', err);
    }
    // لا نعرض نجاحاً زائفاً لإجراء إداري لم يصل إلى قاعدة البيانات.
    return false;
  };

  adminBulkDeleteMembers = async (ids: string[]): Promise<boolean> => {
    await Promise.all(ids.map((id) => this.adminDeleteMember(id)));
    return true;
  };

  adminBulkUpdateStatus = async (ids: string[], status: any, reason = '', by = 'الإدارة'): Promise<boolean> => {
    await Promise.all(ids.map((id) => this.adminUpdateMember(id, { status, statusReason: reason, status_by: by, statusBy: by })));
    return true;
  };

  adminBulkSetVerified = async (ids: string[], value: boolean): Promise<boolean> => {
    await Promise.all(ids.map((id) => this.adminUpdateMember(id, { verified: value })));
    return true;
  };

  adminBulkSetPinned = async (ids: string[], value: boolean): Promise<boolean> => {
    await Promise.all(ids.map((id) => this.adminUpdateMember(id, { pinned: value })));
    return true;
  };

  adminBulkSetPlan = async (ids: string[], plan: 'free' | 'gold' | 'elite'): Promise<boolean> => {
    await Promise.all(ids.map((id) => this.adminUpdateMember(id, { plan, premium: plan !== 'free' })));
    return true;
  };

  adminBulkSetSeriousnessBadge = async (ids: string[], value: boolean): Promise<boolean> => {
    await Promise.all(ids.map((id) => this.adminUpdateMember(id, { hasSeriousnessBadge: value })));
    return true;
  };

  adminDeleteMember = async (id: string): Promise<boolean> => this.members.delete(id);
  adminHardDeleteMember = async (id: string): Promise<boolean> => this.members.delete(id);

  adminResetPassword = async (id: string): Promise<string> => {
    const newPassword = `Tw-${Math.random().toString(36).slice(2, 8)}!`;
    await this.adminUpdateMember(id, { password: newPassword });
    return newPassword;
  };

  adminToggleVerified = (id: string, value: boolean): Promise<boolean> => this.adminUpdateMember(id, { verified: value });
  adminSetPremium = (id: string, value: boolean): Promise<boolean> => this.adminUpdateMember(id, { premium: value, plan: value ? 'gold' : 'free' });
  adminSetNote = (id: string, note: string): Promise<boolean> => this.adminUpdateMember(id, { adminNote: note, notes: note });
  adminToggleFlag = (id: string, value: boolean): Promise<boolean> => this.adminUpdateMember(id, { flagged: value });

  adminSendNotification = async (id: string, text: string, title?: string): Promise<boolean> => {
    try {
      await apiFetch('/api/notifications', { method: 'POST', body: JSON.stringify({ user_id: id, userId: id, text, title: title || 'تنبيه إداري جديد', type: 'admin' }) });
      await this.refreshNotifications().catch(() => undefined);
      return true;
    } catch { return false; }
  };

  adminSendBulkNotifications = async (userIds: string[], text: string, title?: string): Promise<boolean> => {
    await Promise.all(userIds.map((id) => this.adminSendNotification(id, text, title)));
    return true;
  };

  adminDeleteRequest = async (requestId: number): Promise<boolean> => {
    try {
      await apiFetch('/api/interest-requests', { method: 'DELETE', body: JSON.stringify({ id: requestId }) });
      this.cacheRequests(this.requestCache.filter((r) => Number(r.id) !== Number(requestId)));
      return true;
    } catch { return false; }
  };

  adminGrantSeriousnessBadge = (id: string): Promise<boolean> => this.adminUpdateMember(id, { hasSeriousnessBadge: true });
  adminRevokeSeriousnessBadge = (id: string): Promise<boolean> => this.adminUpdateMember(id, { hasSeriousnessBadge: false });
  adminGetRequests = (): Promise<any[]> => this.getRequests();

  adminGetStats = async (): Promise<any> => {
    try { return await apiFetch('/api/stats'); }
    catch {
      const members = this.getLiveMembers(true);
      const requests = this.requestCache;
      const stageBreakdown = requests.reduce((acc: Record<string, number>, req: any) => {
        const stage = req.journey_stage === 'pending' ? 'sent' : (req.journey_stage || req.status || 'sent');
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {});
      const revenue = this.txCache.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      return {
        totalMembers: members.length,
        activeMembers: members.filter((m) => !m.status || m.status === 'active').length,
        pendingMembers: members.filter((m) => m.status === 'pending').length,
        suspendedMembers: members.filter((m) => m.status === 'suspended').length,
        bannedMembers: members.filter((m) => m.status === 'banned').length,
        totalRequests: requests.length,
        pendingRequests: requests.filter((r) => ['pending', 'sent'].includes(r.journey_stage || r.status)).length,
        activeRequests: requests.filter((r) => !['declined', 'cancelled', 'completed'].includes(r.journey_stage || r.status)).length,
        activeJourneys: requests.filter((r) => !['declined', 'cancelled', 'completed'].includes(r.journey_stage || r.status)).length,
        completedRequests: requests.filter((r) => r.journey_stage === 'completed').length,
        declinedRequests: requests.filter((r) => r.journey_stage === 'declined').length,
        cancelledRequests: requests.filter((r) => r.journey_stage === 'cancelled').length,
        completed: requests.filter((r) => r.journey_stage === 'completed').length,
        declined: requests.filter((r) => r.journey_stage === 'declined').length,
        cancelled: requests.filter((r) => r.journey_stage === 'cancelled').length,
        maleCount: members.filter((m) => m.gender === 'male').length,
        femaleCount: members.filter((m) => m.gender === 'female').length,
        males: members.filter((m) => m.gender === 'male').length,
        females: members.filter((m) => m.gender === 'female').length,
        verified: members.filter((m) => m.verified).length,
        premium: members.filter((m) => m.premium || m.plan !== 'free').length,
        revenue,
        totalRevenue: revenue,
        totalTransactions: this.txCache.length,
        depositsPaid: requests.filter((r) => r.sender_paid || r.receiver_paid || r.senderPaid || r.receiverPaid).length,
        seriousnessBadges: members.filter((m) => m.hasSeriousnessBadge || m.has_seriousness_badge).length,
        stageBreakdown,
        recentEvents: this.txCache.slice(0, 8).map((tx) => ({
          id: `tx-${tx.id}`,
          note: tx.description || `معاملة ${tx.type || 'مالية'} بقيمة ${Number(tx.amount || 0).toLocaleString('ar-SA')} ر.س`,
          created_at: tx.created_at || new Date().toISOString(),
        })),
      };
    }
  };

  adminGetRequestPayments = async (requestId: number): Promise<any[]> => {
    try { return await apiFetch<any[]>(`/api/transactions?requestId=${encodeURIComponent(String(requestId))}`); }
    catch { return this.txCache.filter((tx) => Number(tx.request_id || tx.requestId) === Number(requestId)); }
  };

  adminApplyExemption = async (memberId: string, type: 'deposit' | 'badge', value: number | boolean, memberName?: string): Promise<boolean> => {
    if (type === 'badge') return this.adminUpdateMember(memberId, { hasSeriousnessBadge: !!value });
    await apiFetch('/api/transactions', { method: 'POST', body: JSON.stringify({ user_id: memberId, amount: 0, type: 'exemption', description: `إعفاء ${memberName || memberId} من رسوم الجدية`, status: 'completed' }) }).catch(() => undefined);
    return true;
  };

  // ===== الكوبونات والمعاملات =====
  /** آخر وقت تحديث لكل مورد — لمنع الاستعلامات المتكررة خلال فترة قصيرة */
  private lastRefreshAt: Record<string, number> = {};

  /** هل يسمح بتحديث المورد الآن؟ (فاصل أدنى 30 ثانية بين التحديثات) */
  private canRefresh(resource: string, minIntervalMs = 30000): boolean {
    const now = Date.now();
    if (now - (this.lastRefreshAt[resource] || 0) < minIntervalMs) return false;
    this.lastRefreshAt[resource] = now;
    return true;
  }

  private async refreshCoupons() {
    if (!this.canRefresh('coupons')) return this.safeCouponCache;
    try {
      const data = await apiFetch<any[]>('/api/coupons');
      if (Array.isArray(data)) {
        this.couponCache = data;
        writeCache(COUPON_CACHE_KEY, this.couponCache);
      }
    } catch {
      // fallback
    }
    return this.safeCouponCache;
  }

  getCoupons = (): any[] => {
    this.refreshCoupons().catch(() => undefined);
    return this.safeCouponCache;
  };

  saveCoupon = (coupon: any): void => {
    const idx = this.safeCouponCache.findIndex((c) => String(c.code).toLowerCase() === String(coupon.code).toLowerCase());
    if (idx >= 0) this.safeCouponCache[idx] = coupon;
    else this.safeCouponCache.unshift(coupon);
    writeCache(COUPON_CACHE_KEY, this.safeCouponCache);
    apiFetch('/api/coupons', { method: 'POST', body: JSON.stringify(coupon) }).catch(() => undefined);
  };

  deleteCoupon = (code: string): void => {
    this.couponCache = this.safeCouponCache.filter((c) => String(c.code).toLowerCase() !== String(code).toLowerCase());
    writeCache(COUPON_CACHE_KEY, this.couponCache);
    apiFetch('/api/coupons', { method: 'DELETE', body: JSON.stringify({ code }) }).catch(() => undefined);
  };

  toggleCouponActive = (code: string): void => {
    const coupon = this.safeCouponCache.find((c) => String(c.code).toLowerCase() === String(code).toLowerCase());
    if (coupon) this.saveCoupon({ ...coupon, is_active: !(coupon.is_active ?? coupon.isActive), isActive: !(coupon.is_active ?? coupon.isActive) });
  };

  private async refreshTransactions() {
    if (!this.canRefresh('transactions')) return this.safeTxCache;
    try {
      const data = await apiFetch<any[]>('/api/transactions');
      if (Array.isArray(data)) {
        this.txCache = data;
        writeCache(TX_CACHE_KEY, this.txCache);
      }
    } catch {
      // fallback
    }
    return this.safeTxCache;
  }

  getTransactions = (): any[] => {
    this.refreshTransactions().catch(() => undefined);
    return this.safeTxCache;
  };

  recordTransaction = (tx: any): void => {
    const row = { ...tx, id: tx.id || Date.now(), created_at: tx.created_at || new Date().toISOString() };
    this.safeTxCache.unshift(row);
    writeCache(TX_CACHE_KEY, this.safeTxCache);
    apiFetch('/api/transactions', { method: 'POST', body: JSON.stringify(row) }).catch(() => undefined);
  };

  validateCoupon = (code: string, amount?: number): any => {
    const coupon = this.safeCouponCache.find((c) => String(c.code).toLowerCase() === String(code).toLowerCase());
    if (!coupon || coupon.is_active === false || coupon.isActive === false) return null;
    const discount = Number(coupon.discount || coupon.discount_percent || coupon.value || 0);
    return { ...coupon, amount, discount };
  };

  useCoupon = (code: string): boolean => {
    const coupon = this.safeCouponCache.find((c) => String(c.code).toLowerCase() === String(code).toLowerCase());
    if (!coupon) return false;
    this.saveCoupon({ ...coupon, uses_count: Number(coupon.uses_count || coupon.usesCount || 0) + 1 });
    return true;
  };

  resetLocalDB = (): void => {
    [MEMBER_CACHE_KEY, REQUEST_CACHE_KEY, NOTIFICATION_CACHE_KEY, COUPON_CACHE_KEY, TX_CACHE_KEY, DOC_CACHE_KEY].forEach((key) => isBrowser() && localStorage.removeItem(key));
  };

  // ===== مستندات التوثيق =====
  private async refreshVerificationDocs() {
    if (!this.canRefresh('verification-docs')) return this.safeDocCache;
    try {
      const data = await apiFetch<any[]>('/api/verification-docs');
      if (Array.isArray(data)) {
        this.docCache = data;
        writeCache(DOC_CACHE_KEY, this.docCache);
      }
    } catch {
      // fallback
    }
    return this.safeDocCache;
  }

  submitVerificationDoc = (doc: any): any => {
    const row = { ...doc, id: doc.id || `doc_${Date.now()}`, status: doc.status || 'pending', created_at: doc.created_at || new Date().toISOString() };
    this.safeDocCache.unshift(row);
    writeCache(DOC_CACHE_KEY, this.safeDocCache);
    apiFetch('/api/verification-docs', { method: 'POST', body: JSON.stringify(row) }).catch(() => undefined);
    return row;
  };

  getAllVerificationDocs = (): any[] => {
    this.refreshVerificationDocs().catch(() => undefined);
    return this.safeDocCache;
  };

  getMemberVerificationDoc = (memberId: string): any | null => this.safeDocCache.find((d) => d.member_id === memberId || d.memberId === memberId) || null;

  getVerificationStatus = (memberId: string): any => this.getMemberVerificationDoc(memberId)?.status || 'none';

  approveVerificationDoc = (docId: string, reviewerName: string): boolean => {
    this.docCache = this.safeDocCache.map((d) => d.id === docId ? { ...d, status: 'approved', reviewer_name: reviewerName } : d);
    writeCache(DOC_CACHE_KEY, this.docCache);
    apiFetch('/api/verification-docs', { method: 'PUT', body: JSON.stringify({ id: docId, status: 'approved', reviewer_name: reviewerName }) }).catch(() => undefined);
    return true;
  };

  rejectVerificationDoc = (docId: string, reviewerName: string, reason: string): boolean => {
    this.docCache = this.safeDocCache.map((d) => d.id === docId ? { ...d, status: 'rejected', reviewer_name: reviewerName, rejection_reason: reason } : d);
    writeCache(DOC_CACHE_KEY, this.docCache);
    apiFetch('/api/verification-docs', { method: 'PUT', body: JSON.stringify({ id: docId, status: 'rejected', reviewer_name: reviewerName, rejection_reason: reason }) }).catch(() => undefined);
    return true;
  };

  deleteVerificationDoc = (docId: string): boolean => {
    this.docCache = this.safeDocCache.filter((d) => d.id !== docId);
    writeCache(DOC_CACHE_KEY, this.docCache);
    apiFetch('/api/verification-docs', { method: 'DELETE', body: JSON.stringify({ id: docId }) }).catch(() => undefined);
    return true;
  };

  deleteReviewedDocs = (): number => {
    const reviewed = this.safeDocCache.filter((d) => d.status !== 'pending').length;
    this.safeDocCache.filter((d) => d.status === 'pending').forEach((d) => this.deleteVerificationDoc(d.id));
    return reviewed;
  };

  downloadDocImage = (_doc: any): void => undefined;
  downloadAllPendingDocs = (): number => this.safeDocCache.filter((d) => d.status === 'pending').length;

  // ===== خيارات التسجيل والـ Geo =====
  // تحديث مضمون للجغرافيا من الخادم (يتجاوز مؤقّت الفاصل) — يُنتظر قبل أي فحص isXKnown
  ensureGeoLoaded = async (): Promise<void> => {
    this.lastRefreshAt['geo'] = 0; // إعادة ضبط المؤقّت لإجبار التحديث الآن
    await this.refreshGeo();
  };

  // تحديث للجغرافيا (يُستدعى من لوحة الإدارة بعد التعديلات) — مع تأخير كافٍ
  // لإعطاء عمليات الـ API وقتاً للوصول قبل جلب البيانات المنعشة.
  // لا نُصفّر المؤقّت هنا لتفادي سباق مع عمليات الحذف/التعديل fire-and-forget.
  refreshGeoDB = (): void => {
    setTimeout(() => { this.lastRefreshAt['geo'] = 0; this.refreshGeo().catch(() => undefined); }, 1200);
  };

  private async refreshGeo() {
    if (!this.canRefresh('geo', 60000)) return;
    const countries = await apiFetch<any[]>('/api/geo?type=countries').catch(() => this.safeCountriesCache);
    const citiesRows = await apiFetch<any[]>('/api/geo?type=cities').catch(() => []);
    const pending = await apiFetch<any[]>('/api/geo?type=pending').catch(() => this.safePendingCitiesCache);
    const nationalities = await apiFetch<any[]>('/api/geo-nationalities').catch(() => []);
    const suggestions = await apiFetch<any[]>('/api/geo-suggestions').catch(() => this.safeGeoSuggestionsCache);
    if (Array.isArray(countries) && countries.length) this.countriesCache = countries;
    if (Array.isArray(citiesRows) && citiesRows.length) {
      const grouped: Record<string, string[]> = {};
      citiesRows.forEach((row) => {
        const country = row?.country || row?.country_name;
        const name = row?.name || row?.city;
        if (!country || !name) return;
        grouped[country] = grouped[country] || [];
        if (!grouped[country].includes(name)) grouped[country].push(name);
      });
      if (Object.keys(grouped).length > 0) this.citiesCache = grouped;
    }
    if (Array.isArray(pending)) this.pendingCitiesCache = pending;
    if (Array.isArray(nationalities) && nationalities.length) this.nationalitiesCache = nationalities.map((n: any) => n?.name || n).filter(Boolean);
    if (Array.isArray(suggestions)) this.geoSuggestionsCache = suggestions;
    writeCache(COUNTRIES_CACHE_KEY, this.safeCountriesCache);
    writeCache(CITIES_CACHE_KEY, this.citiesCache || {});
    writeCache(PENDING_CITIES_CACHE_KEY, this.safePendingCitiesCache);
    writeCache(NATIONALITIES_CACHE_KEY, this.safeNationalitiesCache);
    writeCache(GEO_SUGGESTIONS_CACHE_KEY, this.safeGeoSuggestionsCache);
  }

  getCountries = (): any[] => { this.refreshGeo().catch(() => undefined); return this.safeCountriesCache; };
  getCountryNames = (): string[] => this.getCountries().map((c: any) => (typeof c === 'string' ? c : c?.name || '')).filter(Boolean);
  getNationalities = (): string[] => {
    this.refreshGeo().catch(() => undefined);
    const cached = this.safeNationalitiesCache.length ? this.safeNationalitiesCache : [];
    return Array.from(new Set([...cached, ...NATIONALITIES, ...this.getCountryNames()])).filter(Boolean);
  };
  getCities = (country: string): string[] => {
    let result: string[] = [];
    if (country && this.citiesCache) {
      if (Array.isArray(this.citiesCache[country])) {
        result = this.citiesCache[country].map((c: any) => (typeof c === 'string' ? c : c?.name || '')).filter(Boolean);
      } else {
        const normTarget = this.normalizeText(country);
        for (const k of Object.keys(this.citiesCache)) {
          if (this.normalizeText(k) === normTarget) {
            const arr = this.citiesCache[k];
            result = (Array.isArray(arr) ? arr : []).map((c: any) => (typeof c === 'string' ? c : c?.name || '')).filter(Boolean);
            break;
          }
        }
      }
    }
    if ((!result || result.length === 0) && country) {
      try {
        result = geoStore.getCities(country) || [];
      } catch {}
    }
    return result;
  };
  normalizeText = (s: string): string => (s || '').toString().trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').toLowerCase();
  isNationalityKnown = (name: string): boolean => {
    const target = this.normalizeText(name);
    return this.getNationalities().some((n) => this.normalizeText(n) === target);
  };
  isCountryKnown = (country: string): boolean => {
    const target = this.normalizeText(country);
    return this.safeCountriesCache.some((c: any) => this.normalizeText(c?.name || c) === target);
  };
  isCityKnown = (country: string, city: string): boolean => {
    const target = this.normalizeText(city);
    return this.getCities(country).some((c) => this.normalizeText(c) === target);
  };
  getPendingCities = (): any[] => this.safePendingCitiesCache;
  getAllPendingCities = (): any[] => this.safePendingCitiesCache;
  getPendingCitiesCount = (): number => this.safePendingCitiesCache.filter((c) => c && c.status === 'pending').length + this.getPendingGeoSuggestionsCount();
  getPendingGeoSuggestions = (): any[] => {
    this.refreshGeo().catch(() => undefined);
    const list1 = this.safeGeoSuggestionsCache || [];
    const list2 = (this.safePendingCitiesCache || []).map((c: any) => ({
      id: c.id,
      kind: 'city',
      name: c.name,
      country: c.country || '',
      suggested_by: c.suggestedBy || c.suggested_by || 'عضو',
      suggestedBy: c.suggestedBy || c.suggested_by || 'عضو',
      suggested_by_id: c.suggestedById || c.suggested_by_id || '',
      source: c.source || 'register',
      status: c.status || 'pending',
      created_at: c.createdAt || c.created_at || new Date().toISOString(),
    }));
    const map = new Map<string, any>();
    list1.forEach((item) => { if (item && item.id) map.set(item.id, item); });
    list2.forEach((item) => { if (item && item.id && !map.has(item.id)) map.set(item.id, item); });
    return Array.from(map.values());
  };
  getPendingGeoSuggestionsCount = (): number => this.safeGeoSuggestionsCache.filter((g) => g && g.status === 'pending').length;

  addNationality = (name: string, country = '', gender = 'both'): any => {
    // تفادي تكرار الجنسية بنفس الاسم (مقارنة مطبّعة)
    const exists = this.nationalitiesCache.some((n) => this.normalizeText(n) === this.normalizeText(name));
    if (!exists) {
      this.nationalitiesCache.unshift(name);
      writeCache(NATIONALITIES_CACHE_KEY, this.nationalitiesCache);
    }
    // نُرسل للخادم دائماً لتحديث الربط بالدولة/الجنس (upsert على الخادم)
    apiFetch('/api/geo-nationalities', { method: 'POST', body: JSON.stringify({ name, country, gender }) }).catch(() => undefined);
    return { ok: true, name, country, gender };
  };

  removeNationality = (name: string): void => {
    const norm = this.normalizeText(name);
    this.nationalitiesCache = this.nationalitiesCache.filter((n) => this.normalizeText(n) !== norm);
    writeCache(NATIONALITIES_CACHE_KEY, this.nationalitiesCache);
    apiFetch('/api/geo-nationalities', { method: 'DELETE', body: JSON.stringify({ name }) }).catch(() => undefined);
  };

  renameNationality = (oldName: string, newName: string): any => {
    const idx = this.nationalitiesCache.indexOf(oldName);
    if (idx !== -1) this.nationalitiesCache[idx] = newName;
    writeCache(NATIONALITIES_CACHE_KEY, this.nationalitiesCache);
    // استدعاء PUT الذي يُحدّث الجدول وملفات الأعضاء معاً
    apiFetch('/api/geo-nationalities', { method: 'PUT', body: JSON.stringify({ oldName, name: newName }) }).catch(() => undefined);
    return { ok: true, oldName, newName };
  };

  addCountry = (name: string, code?: string, flag?: string): any => {
    const item = { name, code, flag };
    // تفادي تكرار الدولة في القائمة الرسمية (مقارنة مطبّعة)
    const exists = this.countriesCache.some((c: any) => this.normalizeText(c.name || c) === this.normalizeText(name));
    if (!exists) {
      this.countriesCache.unshift(item);
      writeCache(COUNTRIES_CACHE_KEY, this.countriesCache);
      apiFetch('/api/geo', { method: 'POST', body: JSON.stringify({ type: 'country', ...item }) }).catch(() => undefined);
    }
    return { ok: true, ...item };
  };

  removeCountry = (name: string): void => {
    const norm = this.normalizeText(name);
    this.countriesCache = this.countriesCache.filter((c) => this.normalizeText(typeof c === 'string' ? c : c?.name || '') !== norm);
    writeCache(COUNTRIES_CACHE_KEY, this.countriesCache);
    apiFetch('/api/geo', { method: 'DELETE', body: JSON.stringify({ type: 'country', name }) }).catch((e) => console.warn('[removeCountry] API error:', e));
  };

  renameCountry = (oldName: string, newName: string): any => {
    const current = this.countriesCache.find((c: any) => (c.name || c) === oldName);
    this.removeCountry(oldName);
    const item = this.addCountry(newName, current?.code, current?.flag);
    if (this.citiesCache[oldName]) {
      this.citiesCache[newName] = [...(this.citiesCache[newName] || []), ...this.citiesCache[oldName]];
      delete this.citiesCache[oldName];
      writeCache(CITIES_CACHE_KEY, this.citiesCache);
    }
    return { ok: true, oldName, newName, ...item };
  };

  addCityToCountry = (country: string, city: string): any => {
    this.citiesCache[country] = this.citiesCache[country] || [];
    // تفادي تكرار المدينة (مقارنة مطبّعة تتجاهل اختلاف الهمزات/التاء المربوطة)
    const exists = this.citiesCache[country].some((c) => this.normalizeText(c) === this.normalizeText(city));
    if (!exists) {
      this.citiesCache[country].push(city);
      writeCache(CITIES_CACHE_KEY, this.citiesCache);
      apiFetch('/api/geo', { method: 'POST', body: JSON.stringify({ type: 'city', country, name: city }) }).catch(() => undefined);
    }
    return { ok: true, country, name: city };
  };

  addPendingGeo = (kind: 'country' | 'city' | 'nationality', name: string, country = '', suggestedBy = 'عضو', source = 'register', suggestedById?: string): any => {
    const item = {
      id: `geo_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      kind,
      name,
      country,
      suggested_by: suggestedBy,
      suggestedBy,
      suggested_by_id: suggestedById || '',
      source,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    this.geoSuggestionsCache.unshift(item);
    writeCache(GEO_SUGGESTIONS_CACHE_KEY, this.geoSuggestionsCache);
    apiFetch('/api/geo-suggestions', { method: 'POST', body: JSON.stringify(item) }).catch(() => undefined);
    return { ok: true, ...item };
  };

  approvePendingGeo = (id: string, editedName?: string): any => {
    const item = this.geoSuggestionsCache.find((g) => g.id === id);
    if (item) {
      item.status = 'approved';
      item.target_name = editedName || item.name;
      if (item.kind === 'country') this.addCountry(item.target_name);
      if (item.kind === 'city') this.addCityToCountry(item.country, item.target_name);
      if (item.kind === 'nationality') this.addNationality(item.target_name, item.country);
      writeCache(GEO_SUGGESTIONS_CACHE_KEY, this.geoSuggestionsCache);
    }
    const pc = this.safePendingCitiesCache.find((c) => c.id === id);
    if (pc) pc.status = 'approved';

    apiFetch('/api/geo-suggestions', { method: 'POST', body: JSON.stringify({ id, action: 'approve', editedName }) }).catch(() => undefined);
    return { ok: true, data: item || pc };
  };

  mergePendingGeo = (id: string, targetName: string, targetCountry = ''): any => {
    const item = this.geoSuggestionsCache.find((g) => g.id === id);
    if (item) {
      item.status = 'merged';
      item.target_name = targetName;
      item.target_country = targetCountry;
      writeCache(GEO_SUGGESTIONS_CACHE_KEY, this.geoSuggestionsCache);
    }
    const pc = this.safePendingCitiesCache.find((c) => c.id === id);
    if (pc) pc.status = 'merged';

    apiFetch('/api/geo-suggestions', { method: 'POST', body: JSON.stringify({ id, action: 'merge', targetName, targetCountry }) }).catch(() => undefined);
    return { ok: true, data: item || pc };
  };

  rejectPendingGeo = (id: string, reason = ''): any => {
    const item = this.geoSuggestionsCache.find((g) => g.id === id);
    if (item) {
      item.status = 'rejected';
      item.rejection_reason = reason;
      writeCache(GEO_SUGGESTIONS_CACHE_KEY, this.geoSuggestionsCache);
    }
    const pc = this.safePendingCitiesCache.find((c) => c.id === id);
    if (pc) pc.status = 'rejected';

    apiFetch('/api/geo-suggestions', { method: 'POST', body: JSON.stringify({ id, action: 'reject', reason }) }).catch(() => undefined);
    return { ok: true, data: item || pc };
  };

  deletePendingGeo = (id: string): void => {
    this.geoSuggestionsCache = this.geoSuggestionsCache.filter((g) => g.id !== id);
    this.pendingCitiesCache = this.pendingCitiesCache.filter((c) => c.id !== id);
    writeCache(GEO_SUGGESTIONS_CACHE_KEY, this.geoSuggestionsCache);
    apiFetch('/api/geo-suggestions', { method: 'DELETE', body: JSON.stringify({ id }) }).catch(() => undefined);
  };

  removeCityFromCountry = (country: string, city: string): void => {
    const norm = this.normalizeText(city);
    this.citiesCache[country] = (this.citiesCache[country] || []).filter((c) => this.normalizeText(typeof c === 'string' ? c : c?.name || '') !== norm);
    writeCache(CITIES_CACHE_KEY, this.citiesCache);
    apiFetch('/api/geo', { method: 'DELETE', body: JSON.stringify({ type: 'city', country, name: city }) }).catch((e) => console.warn('[removeCity] API error:', e));
  };

  renameCity = (country: string, oldName: string, newName: string): any => {
    this.removeCityFromCountry(country, oldName);
    const res = this.addCityToCountry(country, newName);
    this.batchUpdateMemberGeo('city', oldName, newName, country);
    return { ok: true, country, oldName, newName, ...res };
  };

  adminMergeCities = (sourceCountry: string, sourceCity: string, targetCountry: string, targetCity: string): any => {
    this.removeCityFromCountry(sourceCountry, sourceCity);
    if (!this.isCityKnown(targetCountry, targetCity)) this.addCityToCountry(targetCountry, targetCity);
    const res = this.batchUpdateMemberGeo('city', sourceCity, targetCity.trim(), targetCountry.trim());
    return { ok: true, sourceCountry, sourceCity, targetCountry, targetCity, updatedMembers: res.updatedCount };
  };

  adminMergeCountries = (sourceCountry: string, targetCountry: string): any => {
    const sourceCities = this.citiesCache[sourceCountry] || [];
    sourceCities.forEach((city) => {
      if (!this.isCityKnown(targetCountry, city)) this.addCityToCountry(targetCountry, city);
    });
    this.removeCountry(sourceCountry);
    delete this.citiesCache[sourceCountry];
    writeCache(CITIES_CACHE_KEY, this.citiesCache);
    const res = this.batchUpdateMemberGeo('country', sourceCountry, targetCountry.trim());
    return { ok: true, sourceCountry, targetCountry, updatedMembers: res.updatedCount };
  };

  batchUpdateMemberGeo = (kind: 'country' | 'city' | 'nationality' | 'skinColor' | 'education' | 'workType', oldValue: string, newValue: string, countryFilter?: string, sourceCountryFilter?: string) => {
    if (this.memberCache && Array.isArray(this.memberCache) && this.memberCache.length > 0) {
      const normOld = this.normalizeText(oldValue);
      const normCountryFilter = countryFilter ? this.normalizeText(countryFilter) : '';
      this.memberCache.forEach((m: any) => {
        if (kind === 'nationality') {
          if (this.normalizeText(m.nationality || '') === normOld) {
            m.nationality = newValue.trim();
          }
        } else if (kind === 'country') {
          if (this.normalizeText(m.country || '') === normOld) {
            m.country = newValue.trim();
          }
          if (this.normalizeText(m.nationality || '') === normOld) {
            m.nationality = newValue.trim();
          }
        } else if (kind === 'city') {
          const normMCity = this.normalizeText(m.city || '');
          const normMResidence = this.normalizeText(m.residence || '');
          const normMCountry = this.normalizeText(m.country || '');

          const cityMatched = normMCity === normOld || normMResidence === normOld;
          let countryMatched = true;
          const effectiveCountryFilter = sourceCountryFilter || countryFilter;
          const normalizedFilter = effectiveCountryFilter ? this.normalizeText(effectiveCountryFilter) : '';
          if (normalizedFilter && normMCountry) {
            countryMatched =
              normMCountry === normalizedFilter ||
              normMCountry.includes(normalizedFilter) ||
              normalizedFilter.includes(normMCountry);
          }

          if (cityMatched && countryMatched) {
            if (normMCity === normOld || !m.city) m.city = newValue.trim();
            if (normMResidence === normOld || !m.residence) m.residence = newValue.trim();
            if (countryFilter && (!m.country || normMCountry === normCountryFilter)) m.country = countryFilter.trim();
          }
        }
      });
      writeCache(MEMBER_CACHE_KEY, this.memberCache);
    }
    const res = geoStore.batchUpdateMemberGeo(kind, oldValue, newValue, countryFilter, sourceCountryFilter);
    apiFetch('/api/batch-geo', { method: 'POST', body: JSON.stringify({ kind, oldValue, newValue, countryFilter, sourceCountryFilter }) }).catch(() => undefined);
    const adminList = readCache<any[]>('saved_admin_members_list', readCache<any[]>('twafok_members', []));
    if (Array.isArray(adminList) && adminList.length > 0) this.memberCache = adminList.map(normalizeMember);
    return res;
  };

  checkAndRegisterUnknownGeo = (members: any[], source = 'import'): any => {
    const addedCountries: string[] = [];
    const addedCities: string[] = [];
    members.forEach((member) => {
      const country = (member.country || '').trim();
      const city = (member.city || '').trim();
      if (country && !this.isCountryKnown(country)) {
        this.addPendingGeo('country', country, '', member.nickname || member.realName || 'استيراد', source);
        addedCountries.push(country);
      }
      if (country && city && !this.isCityKnown(country, city)) {
        this.addPendingGeo('city', city, country, member.nickname || member.realName || 'استيراد', source);
        addedCities.push(`${country}/${city}`);
      }
      const nationality = (member.nationality || '').trim();
      if (nationality && !this.isNationalityKnown(nationality)) {
        this.addPendingGeo('nationality', nationality, country, member.nickname || member.realName || 'استيراد', source);
      }
    });
    return { source, addedCountries, addedCities };
  };

  addPendingCity = (name: string, country: string, suggestedBy: string, source = 'register', suggestedById?: string): any => {
    const item = { id: `pc_${Date.now()}`, name, country, suggested_by: suggestedBy, suggested_by_id: suggestedById, source, status: 'pending', created_at: new Date().toISOString() };
    this.safePendingCitiesCache.unshift(item);
    writeCache(PENDING_CITIES_CACHE_KEY, this.safePendingCitiesCache);
    apiFetch('/api/geo', { method: 'POST', body: JSON.stringify({ type: 'pending', ...item }) }).catch(() => undefined);
    return item;
  };

  approvePendingCity = (id: string, reviewer: string, editedName?: string): any => {
    const item = this.safePendingCitiesCache.find((c) => c && c.id === id);
    if (item) {
      item.status = 'approved'; item.reviewer = reviewer; if (editedName) item.name = editedName;
      this.addCityToCountry(item.country, item.name);
    }
    writeCache(PENDING_CITIES_CACHE_KEY, this.safePendingCitiesCache);
    apiFetch('/api/geo', { method: 'PUT', body: JSON.stringify({ type: 'pending', id, status: 'approved', reviewer, editedName }) }).catch(() => undefined);
    return item;
  };

  rejectPendingCity = (id: string, reviewer: string, reason?: string): any => {
    const item = this.safePendingCitiesCache.find((c) => c && c.id === id);
    if (item) { item.status = 'rejected'; item.reviewer = reviewer; item.rejection_reason = reason; }
    writeCache(PENDING_CITIES_CACHE_KEY, this.safePendingCitiesCache);
    apiFetch('/api/geo', { method: 'PUT', body: JSON.stringify({ type: 'pending', id, status: 'rejected', reviewer, reason }) }).catch(() => undefined);
    return item;
  };

  deletePendingCity = (id: string): void => {
    this.pendingCitiesCache = this.safePendingCitiesCache.filter((c) => c && c.id !== id);
    writeCache(PENDING_CITIES_CACHE_KEY, this.safePendingCitiesCache);
    apiFetch('/api/geo', { method: 'DELETE', body: JSON.stringify({ type: 'pending', id }) }).catch(() => undefined);
  };
}
