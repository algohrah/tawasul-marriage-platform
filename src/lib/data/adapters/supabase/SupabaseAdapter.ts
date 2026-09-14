import { IRepository, IDatabaseAdapter, ISettingsRepository } from '../../interfaces';
import supabaseClient from '../../../supabase';
import { Member } from '../../../members';
import {
  COUNTRIES as SEED_COUNTRIES,
  CITIES_BY_COUNTRY as SEED_CITIES,
  SECTS as DEFAULT_SECTS,
  SKIN_COLORS as DEFAULT_SKIN_COLORS,
  EDUCATION_LEVELS as DEFAULT_EDUCATION_LEVELS,
  WORK_TYPES as DEFAULT_WORK_TYPES,
  HOUSING_TYPES as DEFAULT_HOUSING_TYPES,
  SMOKING_OPTIONS as DEFAULT_SMOKING_OPTIONS,
  MARITAL_MALE as DEFAULT_MARITAL_MALE,
  MARITAL_FEMALE as DEFAULT_MARITAL_FEMALE,
} from '../../../constants';
import * as localStore from '../local/localStore';
import * as geoStore from '../local/geoStore';

export const isReal = true;

export function disableRealSupabase(err: any) {
  console.error('[SupabaseAdapter] A database error occurred:', err);
}

const settingsCache = new Map<string, string>();
let membersCache: Member[] = [];
let requestsCache: any[] = [];
let countriesCache: any[] = [];
let citiesCache: Record<string, string[]> = {};
let pendingCitiesCache: any[] = [];
let verificationDocsCache: any[] = [];
let inquiryMessagesCache: any[] = [];

export function normalizeMemberFromDb(r: any): any {
  if (!r) return r;
  return {
    ...r,
    id: String(r.id),
    nickname: r.nickname || r.real_name || r.realName || r.id,
    username: r.username || '',
    gender: r.gender || '',
    age: Number(r.age) || 0,
    birthDate: r.birth_date || r.birthDate || '',
    country: r.country || '',
    city: r.city || '',
    district: r.district || '',
    nationality: r.nationality || '',
    sect: r.sect || '',
    maritalStatus: r.marital_status || r.maritalStatus || 'single',
    maritalLabel: r.marital_label || r.maritalLabel || '',
    marriageType: r.marriageType || r.marriage_type || r.details?.marriageType || r.details?.marriage_type || 'announced',
    marriageTypeLabel: r.details?.marriageTypeLabel || r.marriageTypeLabel || (
      (r.marriageType || r.marriage_type || r.details?.marriageType || r.details?.marriage_type) === 'misyar' ? 'مسيار' :
      (r.marriageType || r.marriage_type || r.details?.marriageType || r.details?.marriage_type) === 'both' ? 'معلن أو مسيار' : 'معلن'
    ),
    hasChildren: !!(r.has_children ?? r.hasChildren),
    childrenCount: r.children_count || r.childrenCount || '',
    height: Number(r.height) || 0,
    weight: Number(r.weight) || 0,
    skinColor: r.skin_color || r.skinColor || '',
    health: r.health || '',
    smoking: r.smoking || '',
    ethnicity: r.ethnicity || '',
    tribe: r.tribe || r.details?.tribe || '',
    education: r.education || '',
    workType: r.work_type || r.workType || '',
    jobTitle: r.job_title || r.jobTitle || '',
    housing: r.housing || '',
    bio: r.bio || '',
    aboutPartner: r.about_partner || r.aboutPartner || '',
    verified: !!(r.verified),
    premium: !!(r.premium),
    online: !!(r.online),
    lastActive: r.last_active || r.lastActive || new Date().toISOString(),
    matchScore: Number(r.match_score || r.matchScore) || 90,
    hasSeriousnessBadge: !!(r.has_seriousness_badge ?? r.hasSeriousnessBadge),
    plan: r.plan || 'free',
    pinned: !!(r.pinned),
    status: r.status || 'active',
    statusReason: r.status_reason || r.statusReason || '',
    statusBy: r.status_by || r.statusBy || '',
    notes: r.notes || r.adminNote || '',
    adminNote: r.notes || r.adminNote || '',
    flagged: !!(r.flagged),
    sourceType: r.source_type || r.sourceType || 'registered',
    importBatchId: r.import_batch_id || r.importBatchId || '',
    importOfficeName: r.import_office_name || r.importOfficeName || '',
    importDate: r.import_date || r.importDate || '',
    importNotes: r.import_notes || r.importNotes || '',
    isProfileIncomplete: !!(r.is_profile_incomplete ?? r.isProfileIncomplete),
    realName: r.real_name || r.realName || r.nickname || r.id,
    email: r.email || '',
    phone: r.phone || '',
    whatsapp: r.whatsapp || '',
    password: r.password || '',
  };
}

export function memberToDbPayload(m: any): any {
  if (!m) return m;
  return {
    id: String(m.id),
    nickname: m.nickname || m.realName || m.id,
    username: m.username || '',
    gender: m.gender || '',
    age: Number(m.age) || 0,
    birth_date: m.birthDate || m.birth_date || '',
    country: m.country || '',
    city: m.city || '',
    district: m.district || '',
    nationality: m.nationality || '',
    sect: m.sect || '',
    marital_status: m.maritalStatus || m.marital_status || 'single',
    marital_label: m.maritalLabel || m.marital_label || '',
    has_children: !!(m.hasChildren ?? m.has_children),
    children_count: m.childrenCount || m.children_count || '',
    height: Number(m.height) || 0,
    weight: Number(m.weight) || 0,
    skin_color: m.skinColor || m.skin_color || '',
    health: m.health || '',
    smoking: m.smoking || '',
    ethnicity: m.ethnicity || '',
    tribe: m.tribe || '',
    education: m.education || '',
    work_type: m.workType || m.work_type || '',
    job_title: m.jobTitle || m.job_title || '',
    housing: m.housing || '',
    bio: m.bio || '',
    about_partner: m.aboutPartner || m.about_partner || '',
    verified: !!(m.verified),
    premium: !!(m.premium),
    online: !!(m.online),
    last_active: m.lastActive || m.last_active || new Date().toISOString(),
    match_score: Number(m.matchScore || m.match_score) || 90,
    has_seriousness_badge: !!(m.hasSeriousnessBadge ?? m.has_seriousness_badge),
    plan: m.plan || 'free',
    pinned: !!(m.pinned),
    status: m.status || 'active',
    status_reason: m.statusReason || m.status_reason || '',
    status_by: m.statusBy || m.statusBy || '',
    notes: m.adminNote || m.notes || '',
    flagged: !!(m.flagged),
    source_type: m.sourceType || m.source_type || 'registered',
    import_batch_id: m.importBatchId || m.import_batch_id || '',
    import_office_name: m.importOfficeName || m.import_office_name || '',
    import_date: m.importDate || m.import_date || '',
    import_notes: m.importNotes || m.import_notes || '',
    is_profile_incomplete: !!(m.isProfileIncomplete ?? m.is_profile_incomplete),
    real_name: m.realName || m.real_name || m.nickname || '',
    email: m.email || '',
    phone: m.phone || '',
    whatsapp: m.whatsapp || '',
    password: m.password || '',
  };
}

export class MembersRepository implements IRepository<any> {
  async getAll(): Promise<any[]> {
    try {
      const { data, error } = await supabaseClient.from('members').select('*');
      if (error) throw error;
      const list = (data || []).map(normalizeMemberFromDb);
      if (list.length > 0) membersCache = list;
      return list;
    } catch {
      return membersCache;
    }
  }

  async getById(id: string | number): Promise<any | null> {
    try {
      const { data, error } = await supabaseClient.from('members').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? normalizeMemberFromDb(data) : null;
    } catch {
      return null;
    }
  }

  async create(item: any): Promise<any> {
    const normItem = normalizeMemberFromDb(item);
    const dbPayload = memberToDbPayload(normItem);

    const existingIdx = membersCache.findIndex(m => String(m.id).trim() === String(normItem.id).trim());
    if (existingIdx >= 0) {
      membersCache[existingIdx] = normItem;
    } else {
      membersCache.unshift(normItem);
    }

    if (typeof window !== 'undefined') {
      try {
        const savedRaw = localStorage.getItem('saved_members_list');
        let savedList: any[] = savedRaw ? JSON.parse(savedRaw) : [];
        if (!Array.isArray(savedList)) savedList = [];
        const sIdx = savedList.findIndex(m => String(m.id).trim() === String(normItem.id).trim());
        if (sIdx >= 0) savedList[sIdx] = normItem;
        else savedList.unshift(normItem);
        localStorage.setItem('saved_members_list', JSON.stringify(savedList));

        const savedAdminRaw = localStorage.getItem('saved_admin_members_list');
        let savedAdminList: any[] = savedAdminRaw ? JSON.parse(savedAdminRaw) : [];
        if (!Array.isArray(savedAdminList)) savedAdminList = [];
        const saIdx = savedAdminList.findIndex(m => String(m.id).trim() === String(normItem.id).trim());
        if (saIdx >= 0) savedAdminList[saIdx] = normItem;
        else savedAdminList.unshift(normItem);
        localStorage.setItem('saved_admin_members_list', JSON.stringify(savedAdminList));
      } catch {}
    }

    try {
      const { data, error } = await supabaseClient.from('members').upsert(dbPayload).select().single();
      if (error) throw error;
      return data ? normalizeMemberFromDb(data) : normItem;
    } catch (err) {
      console.warn('[MembersRepository] Supabase insert warning:', err);
      return normItem;
    }
  }

  async update(id: string | number, payload: Partial<any>): Promise<any> {
    const strId = String(id).trim();
    const dbPayload: Record<string, any> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k === 'maritalStatus') dbPayload.marital_status = v;
      else if (k === 'maritalLabel') dbPayload.marital_label = v;
      else if (k === 'hasChildren') dbPayload.has_children = v;
      else if (k === 'childrenCount') dbPayload.children_count = v;
      else if (k === 'skinColor') dbPayload.skin_color = v;
      else if (k === 'workType') dbPayload.work_type = v;
      else if (k === 'jobTitle') dbPayload.job_title = v;
      else if (k === 'aboutPartner') dbPayload.about_partner = v;
      else if (k === 'lastActive') dbPayload.last_active = v;
      else if (k === 'matchScore') dbPayload.match_score = v;
      else if (k === 'hasSeriousnessBadge') dbPayload.has_seriousness_badge = v;
      else if (k === 'sourceType') dbPayload.source_type = v;
      else if (k === 'importBatchId') dbPayload.import_batch_id = v;
      else if (k === 'importOfficeName') dbPayload.import_office_name = v;
      else if (k === 'importDate') dbPayload.import_date = v;
      else if (k === 'importNotes') dbPayload.import_notes = v;
      else if (k === 'isProfileIncomplete') dbPayload.is_profile_incomplete = v;
      else if (k === 'realName') dbPayload.real_name = v;
      else if (k === 'birthDate') dbPayload.birth_date = v;
      else if (k === 'adminNote') dbPayload.notes = v;
      else dbPayload[k] = v;
    }

    const mIdx = membersCache.findIndex(m => String(m.id).trim() === strId);
    if (mIdx >= 0) {
      membersCache[mIdx] = normalizeMemberFromDb({ ...membersCache[mIdx], ...payload });
    }

    if (typeof window !== 'undefined') {
      try {
        const savedRaw = localStorage.getItem('saved_members_list');
        if (savedRaw) {
          const list = JSON.parse(savedRaw);
          if (Array.isArray(list)) {
            const updated = list.map(m => String(m.id).trim() === strId ? normalizeMemberFromDb({ ...m, ...payload }) : m);
            localStorage.setItem('saved_members_list', JSON.stringify(updated));
          }
        }
      } catch {}
    }

    try {
      const { data, error } = await supabaseClient.from('members').update(dbPayload).eq('id', strId).select().single();
      if (error) throw error;
      return data ? normalizeMemberFromDb(data) : { id: strId, ...payload };
    } catch {
      return { id: strId, ...payload };
    }
  }

  async delete(id: string | number): Promise<boolean> {
    const strId = String(id).trim();
    membersCache = membersCache.filter(m => String(m.id).trim() !== strId);
    try {
      await supabaseClient.from('members').delete().eq('id', strId);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * مستودع بيانات سحابي لـ Supabase متصل مباشرة بالسحابة
 */
export class SupabaseRepository<T extends { id: string | number }> implements IRepository<T> {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  async getAll(): Promise<T[]> {
    try {
      const { data, error } = await supabaseClient.from(this.tableName).select('*');
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn(`[SupabaseRepository] getAll on ${this.tableName}:`, err);
      return [];
    }
  }

  async getById(id: string | number): Promise<T | null> {
    try {
      const { data, error } = await supabaseClient.from(this.tableName).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn(`[SupabaseRepository] getById on ${this.tableName}:`, err);
      return null;
    }
  }

  async create(item: T): Promise<T> {
    try {
      const { data, error } = await supabaseClient.from(this.tableName).insert(item).select().single();
      if (error) throw error;
      return data || item;
    } catch (err) {
      console.warn(`[SupabaseRepository] Error creating item in ${this.tableName}:`, err);
      return item;
    }
  }

  async update(id: string | number, payload: Partial<T>): Promise<T> {
    try {
      const { data, error } = await supabaseClient.from(this.tableName).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data || ({ id, ...payload } as any);
    } catch (err) {
      console.warn(`[SupabaseRepository] Error updating item in ${this.tableName}:`, err);
      return { id, ...payload } as any;
    }
  }

  async delete(id: string | number): Promise<boolean> {
    try {
      const { error } = await supabaseClient.from(this.tableName).delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn(`[SupabaseRepository] Error deleting item in ${this.tableName}:`, err);
      return false;
    }
  }
}

/**
 * مستودع إعدادات Supabase المعتمد على الذاكرة مع المزامنة السحابية المباشرة
 */
export class SupabaseSettingsRepository implements ISettingsRepository {
  get(key: string): string | null {
    if (key === 'active_member_id' || key === 'impersonating') {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    }
    return settingsCache.get(key) ?? null;
  }

  set(key: string, value: string): void {
    if (key === 'active_member_id' || key === 'impersonating') {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }

    settingsCache.set(key, value);

    supabaseClient
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) {
          console.warn('[SupabaseSettingsRepository] Cloud sync notice:', error.message || error);
        }
      })
      .catch((err) => {
        console.warn('[SupabaseSettingsRepository] Cloud sync notice:', err);
      });
  }

  remove(key: string): void {
    if (key === 'active_member_id' || key === 'impersonating') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
      return;
    }

    settingsCache.delete(key);

    supabaseClient
      .from('settings')
      .delete()
      .eq('key', key)
      .then(({ error }) => {
        if (error) {
          console.warn('[SupabaseSettingsRepository] Cloud delete notice:', error.message || error);
        }
      })
      .catch((err) => {
        console.warn('[SupabaseSettingsRepository] Cloud delete notice:', err);
      });
  }
}

/**
 * محوّل قواعد بيانات Supabase المتكامل والكامل (SupabaseAdapter)
 * يتصل بالسحابة مباشرة ويعتمد حصرية قاعدة البيانات السحابية لـ Supabase بدون أي قاعدة بيانات محلية.
 */
export class SupabaseAdapter implements IDatabaseAdapter {
  public members: IRepository<any>;
  public requests: IRepository<any>;
  public transactions: IRepository<any>;
  public tickets: IRepository<any>;
  public adminUsers: IRepository<any>;
  public settings: ISettingsRepository;

  constructor() {
    this.members = new MembersRepository();
    this.requests = new SupabaseRepository<any>('interest_requests');
    this.transactions = new SupabaseRepository<any>('transactions');
    this.tickets = new SupabaseRepository<any>('support_tickets');
    this.adminUsers = new SupabaseRepository<any>('admin_users');
    this.settings = new SupabaseSettingsRepository();

    if (typeof window !== 'undefined') {
      this.initCloudData().catch((err) => {
        console.error('[SupabaseAdapter] Initial cloud sync failed:', err);
      });
    }
  }

  private async initCloudData(): Promise<void> {
    try {
      await this.syncSettingsFromCloud();
      await this.syncMembersFromCloud();
      await this.syncGeoFromCloud();
    } catch (e) {
      console.warn('[SupabaseAdapter] Error initializing cloud caches:', e);
    }
  }

  async syncSettingsFromCloud(): Promise<void> {
    try {
      const { data, error } = await supabaseClient.from('settings').select('*');
      if (error) throw error;
      if (data) {
        settingsCache.clear();
        for (const item of data) {
          settingsCache.set(item.key, item.value);
        }
      }
    } catch (err) {
      console.warn('[SupabaseAdapter] Sync settings notice (using memory/local):', err);
    }
  }

  async syncMembersFromCloud(): Promise<void> {
    const seed4Members: any[] = [
      {
        id: 'm101',
        nickname: 'أحمد القحطاني',
        username: 'ahmed_q',
        gender: 'male',
        age: 31,
        country: 'السعودية',
        city: 'الرياض',
        district: 'حي النفل',
        nationality: 'سعودي',
        sect: 'سني',
        maritalStatus: 'single',
        marital_status: 'single',
        maritalLabel: 'أعزب',
        marital_label: 'أعزب',
        hasChildren: false,
        has_children: false,
        childrenCount: '0',
        children_count: '0',
        height: 178,
        weight: 76,
        skinColor: 'قمحي',
        skin_color: 'قمحي',
        health: 'ممتازة',
        smoking: 'لا تدخن',
        education: 'بكالوريوس هندسة حاسب',
        workType: 'حكومي',
        work_type: 'حكومي',
        jobTitle: 'مهندس برمجيات',
        job_title: 'مهندس برمجيات',
        housing: 'شقة ملك',
        bio: 'شاب طموح ومثقف أبحث عن زوجة صالحة ومحترمة تعينني على أمور الدين والدنيا.',
        aboutPartner: 'فتاة محترمة، تخاف الله، وتقدّر الحياة الزوجية.',
        about_partner: 'فتاة محترمة، تخاف الله، وتقدّر الحياة الزوجية.',
        verified: true,
        premium: true,
        online: true,
        lastActive: new Date().toISOString(),
        last_active: new Date().toISOString(),
        matchScore: 95,
        match_score: 95,
        hasSeriousnessBadge: true,
        has_seriousness_badge: true,
        plan: 'gold',
        status: 'active',
        sourceType: 'registered',
        source_type: 'registered'
      },
      {
        id: 'm102',
        nickname: 'سارة العتيبي',
        username: 'sara_o',
        gender: 'female',
        age: 26,
        country: 'السعودية',
        city: 'جدة',
        district: 'حي الشاطئ',
        nationality: 'سعودية',
        sect: 'سني',
        maritalStatus: 'single',
        marital_status: 'single',
        maritalLabel: 'عزباء',
        marital_label: 'عزباء',
        hasChildren: false,
        has_children: false,
        childrenCount: '0',
        children_count: '0',
        height: 164,
        weight: 58,
        skinColor: 'بيضاء',
        skin_color: 'بيضاء',
        health: 'ممتازة',
        smoking: 'لا تدخن',
        education: 'بكالوريوس إدارة أعمال',
        workType: 'قطاع خاص',
        work_type: 'قطاع خاص',
        jobTitle: 'أخصائية تسويق',
        job_title: 'أخصائية تسويق',
        housing: 'حسب الاتفاق',
        bio: 'فتاة هادئة ومثقفة أحب القراءة والسفر، أبحث عن شريك حياة يخاف الله ومسؤول.',
        aboutPartner: 'رجل خلوق، طموح، ومسؤول.',
        about_partner: 'رجل خلوق، طموح، ومسؤول.',
        verified: true,
        premium: false,
        online: true,
        lastActive: new Date().toISOString(),
        last_active: new Date().toISOString(),
        matchScore: 92,
        match_score: 92,
        hasSeriousnessBadge: true,
        has_seriousness_badge: true,
        plan: 'free',
        status: 'active',
        sourceType: 'registered',
        source_type: 'registered'
      },
      {
        id: 'm103',
        nickname: 'عمر الشمري',
        username: 'omar_sh',
        gender: 'male',
        age: 34,
        country: 'السعودية',
        city: 'الدمام',
        district: 'حي الفيصلية',
        nationality: 'سعودي',
        sect: 'سني',
        maritalStatus: 'divorced',
        marital_status: 'divorced',
        maritalLabel: 'مطلق',
        marital_label: 'مطلق',
        hasChildren: false,
        has_children: false,
        childrenCount: '0',
        children_count: '0',
        height: 181,
        weight: 82,
        skinColor: 'قمحي',
        skin_color: 'قمحي',
        health: 'ممتازة',
        smoking: 'لا تدخن',
        education: 'ماجستير إدارة مالية',
        workType: 'قطاع خاص',
        work_type: 'قطاع خاص',
        jobTitle: 'محلل مالي',
        job_title: 'محلل مالي',
        housing: 'فيلا مستقلة',
        bio: 'رجل عصامي أحب الاستقرار والتفاهم الاسري، أبحث عن زوجة تناسبني للبدء من جديد.',
        aboutPartner: 'إنسانة متفهمة، هادئة، وترغب في بناء أسر مستقرة.',
        about_partner: 'إنسانة متفهمة، هادئة، وترغب في بناء أسر مستقرة.',
        verified: true,
        premium: true,
        online: false,
        lastActive: new Date().toISOString(),
        last_active: new Date().toISOString(),
        matchScore: 88,
        match_score: 88,
        hasSeriousnessBadge: true,
        has_seriousness_badge: true,
        plan: 'elite',
        status: 'active',
        sourceType: 'registered',
        source_type: 'registered'
      },
      {
        id: 'm104',
        nickname: 'مريم الزهراني',
        username: 'maryam_z',
        gender: 'female',
        age: 28,
        country: 'السعودية',
        city: 'مكة المكرمة',
        district: 'حي العوالي',
        nationality: 'سعودية',
        sect: 'سني',
        maritalStatus: 'single',
        marital_status: 'single',
        maritalLabel: 'عزباء',
        marital_label: 'عزباء',
        hasChildren: false,
        has_children: false,
        childrenCount: '0',
        children_count: '0',
        height: 160,
        weight: 55,
        skinColor: 'حنطية',
        skin_color: 'حنطية',
        health: 'ممتازة',
        smoking: 'لا تدخن',
        education: 'بكالوريوس لغة عربية',
        workType: 'حكومي',
        work_type: 'حكومي',
        jobTitle: 'معلمة',
        job_title: 'معلمة',
        housing: 'حسب الاتفاق',
        bio: 'حافظة لكتاب الله، متزنة وأحب الحياة العائلية، أبحث عن زوج صالح ذو خلق ودين.',
        aboutPartner: 'رجل ملتزم وخلوق ويخاف الله.',
        about_partner: 'رجل ملتزم وخلوق ويخاف الله.',
        verified: true,
        premium: false,
        online: true,
        lastActive: new Date().toISOString(),
        last_active: new Date().toISOString(),
        matchScore: 90,
        match_score: 90,
        hasSeriousnessBadge: true,
        has_seriousness_badge: true,
        plan: 'free',
        status: 'active',
        sourceType: 'registered',
        source_type: 'registered'
      }
    ];

    try {
      const { data, error } = await supabaseClient.from('members').select('*');
      if (error) throw error;
      
      if (data && data.length > 0) {
        membersCache = data.map(normalizeMemberFromDb);
      } else {
        for (const m of seed4Members) {
          const norm = normalizeMemberFromDb(m);
          await supabaseClient.from('members').upsert(memberToDbPayload(norm)).catch(() => {});
        }
        const { data: seededData } = await supabaseClient.from('members').select('*');
        membersCache = seededData && seededData.length > 0 ? seededData.map(normalizeMemberFromDb) : seed4Members.map(normalizeMemberFromDb);
      }
    } catch (err) {
      console.warn('[SupabaseAdapter] Sync members notice (using fallback seed members):', err);
      if (membersCache.length === 0) {
        membersCache = seed4Members.map(normalizeMemberFromDb);
      }
    }
  }

  async syncGeoFromCloud(): Promise<void> {
    try {
      const { data: cData } = await supabaseClient.from('geo_countries').select('*');
      if (cData && cData.length > 0) {
        countriesCache = cData;
      } else {
        countriesCache = SEED_COUNTRIES.map((name) => ({ name }));
      }

      const { data: ctData } = await supabaseClient.from('geo_cities').select('*');
      if (ctData && ctData.length > 0) {
        citiesCache = {};
        for (const row of ctData) {
          if (!citiesCache[row.country]) citiesCache[row.country] = [];
          citiesCache[row.country].push(row.name);
        }
      } else {
        citiesCache = { ...SEED_CITIES };
      }
    } catch (e) {
      countriesCache = SEED_COUNTRIES.map((name) => ({ name }));
      citiesCache = { ...SEED_CITIES };
    }
  }

  // ===== الأعضاء (Members) =====
  getMembers = async (): Promise<any[]> => {
    try {
      if (!membersCache || membersCache.length === 0) {
        const { data, error } = await supabaseClient.from('members').select('*');
        if (!error && data && data.length > 0) {
          membersCache = data;
        } else {
          await this.syncMembersFromCloud();
        }
      } else {
        this.syncMembersFromCloud().catch(() => {});
      }
    } catch (err) {
      console.warn('[SupabaseAdapter] Fetch members notice (using cached/fallback members):', err);
    }
    return this.getLiveMembers(true);
  };

  getLiveMembers = (includeInactiveAndDeleted: boolean = false): any[] => {
    const localList = localStore.getLiveMembers(includeInactiveAndDeleted);
    const map = new Map<string, any>();
    
    localList.forEach((m: any) => {
      const norm = normalizeMemberFromDb(m);
      map.set(String(norm.id).trim(), norm);
    });

    (membersCache || []).forEach((m: any) => {
      const norm = normalizeMemberFromDb(m);
      const existing = map.get(String(norm.id).trim()) || {};
      map.set(String(norm.id).trim(), { ...existing, ...norm });
    });

    if (typeof window !== 'undefined') {
      try {
        const savedRaw = localStorage.getItem('saved_members_list');
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((m: any) => {
              const norm = normalizeMemberFromDb(m);
              const existing = map.get(String(norm.id).trim()) || {};
              map.set(String(norm.id).trim(), { ...existing, ...norm });
            });
          }
        }
        const savedAdminRaw = localStorage.getItem('saved_admin_members_list');
        if (savedAdminRaw) {
          const parsedAdmin = JSON.parse(savedAdminRaw);
          if (Array.isArray(parsedAdmin)) {
            parsedAdmin.forEach((m: any) => {
              const norm = normalizeMemberFromDb(m);
              const existing = map.get(String(norm.id).trim()) || {};
              map.set(String(norm.id).trim(), { ...existing, ...norm });
            });
          }
        }
      } catch {}
    }

    let list = Array.from(map.values());
    if (!includeInactiveAndDeleted) {
      list = list.filter((m: any) => m.status !== 'inactive' && m.status !== 'suspended' && m.status !== 'banned' && !m.deleted);
    }
    return list;
  };

  getLiveMemberById = (id: string): any | undefined => {
    if (!id) return undefined;
    const strId = String(id).trim();
    const members = this.getLiveMembers(true);
    let found = members.find((m: any) => String(m.id).trim() === strId);
    if (!found) {
      found = localStore.getLiveMemberById(id);
    }
    return found;
  };

  getCurrentUserId = (): string => {
    const activeMemberId = this.settings.get('active_member_id');
    if (activeMemberId && activeMemberId.trim()) return activeMemberId.trim();

    const authUserRaw = this.settings.get('auth_user');
    if (authUserRaw) {
      try {
        const authUser = JSON.parse(authUserRaw);
        if (authUser?.memberId && String(authUser.memberId).trim()) {
          return String(authUser.memberId).trim();
        }
      } catch {}
    }

    return localStore.getCurrentUserId();
  };

  setCurrentUserId = (id: string): void => {
    if (id) {
      this.settings.set('active_member_id', id);
    }
  };

  hasUserPaidDepositAnywhere = (userId: string): boolean => {
    return false;
  };

  // ===== الطلبات والرحلات (Requests & Journeys) =====
  getRequests = async (userId?: string): Promise<any[]> => {
    try {
      const localReqs = await localStore.getRequests(userId);
      let supabaseReqs: any[] = [];
      const query = supabaseClient.from('interest_requests').select('*');
      if (userId && userId.trim()) {
        const cleanUid = userId.trim();
        query.or(`sender_id.eq.${cleanUid},receiver_id.eq.${cleanUid}`);
      }
      const { data, error } = await query.catch(() => ({ data: null, error: true }));
      if (!error && Array.isArray(data)) {
        supabaseReqs = data;
      }

      // الدمج الذكي بين الذاكرة المحلية وقاعدة البيانات لضمان تواجد الطلب فوراً
      const combinedMap = new Map<string, any>();
      localReqs.forEach((r: any) => combinedMap.set(String(r.id), r));
      supabaseReqs.forEach((r: any) => {
        const existing = combinedMap.get(String(r.id));
        combinedMap.set(String(r.id), {
          ...existing,
          ...r,
          journey_stage: r.journey_stage || r.status || existing?.journey_stage || 'sent',
        });
      });

      let result = Array.from(combinedMap.values()).sort((a, b) =>
        (b.created_at || '').localeCompare(a.created_at || '')
      );

      if (userId && userId.trim()) {
        const cleanUid = userId.trim();
        return result.filter((r: any) => String(r.sender_id) === cleanUid || String(r.receiver_id) === cleanUid);
      }

      requestsCache = result;
      return result;
    } catch (err) {
      console.warn('[SupabaseAdapter] getRequests fallback to localStore:', err);
      return localStore.getRequests(userId);
    }
  };

  getRequest = async (id: number): Promise<any | null> => {
    try {
      const localReq = await localStore.getRequest(id);
      const { data, error } = await supabaseClient.from('interest_requests').select('*').eq('id', id).maybeSingle().catch(() => ({ data: null, error: true }));
      if (!error && data) {
        return {
          ...localReq,
          ...data,
          journey_stage: data.journey_stage || data.status || localReq?.journey_stage || 'sent',
        };
      }
      return localReq;
    } catch (err) {
      return localStore.getRequest(id);
    }
  };

  createRequest = async (senderId: string, receiverId: string, message: string): Promise<any> => {
    // 1. التنفيذ المحلي أولاً لمنع التكرار وإنشاء الإشعارات والأحداث
    let localRes: any = { ok: false };
    try {
      localRes = await localStore.createRequest(senderId, receiverId, message);
    } catch (err) {
      console.error('[SupabaseAdapter] localStore createRequest error:', err);
    }

    if (localRes && !localRes.ok && localRes.error) {
      return localRes;
    }

    // 2. إرسال إلى Supabase وإنشاء إشعار للمستلم
    try {
      const id = localRes?.data?.id || Math.floor(Math.random() * 1000000);
      const reqPayload = {
        id,
        sender_id: senderId,
        receiver_id: receiverId,
        status: 'pending',
        journey_stage: 'sent',
        mediation_stage: 'none',
        message: message || 'طلب اهتمام جديد',
        created_at: new Date().toISOString(),
      };
      
      const { data } = await supabaseClient.from('interest_requests').insert(reqPayload).select().single().catch(() => ({ data: null }));

      // إضافة إشعار للمستلم
      await supabaseClient.from('notifications').insert({
        user_id: receiverId,
        request_id: id,
        type: 'request',
        text: 'وصلك طلب اهتمام جديد بانتظار قرارك',
        title: 'طلب اهتمام جديد 💌',
        read: false,
        created_at: new Date().toISOString(),
      }).catch(() => {});

      requestsCache = [];
      return { ok: true, data: data || localRes?.data || reqPayload };
    } catch (err) {
      console.warn('[SupabaseAdapter] Supabase insert fallback:', err);
      requestsCache = [];
      if (localRes && localRes.ok) return localRes;
      return { ok: true, data: { id: Date.now(), sender_id: senderId, receiver_id: receiverId, message, journey_stage: 'sent' } };
    }
  };

  runRequestAction = async (requestId: number, action: string, actorId: string, payload: Record<string, any> = {}): Promise<any> => {
    let localRes: any = { ok: true };
    try {
      localRes = await localStore.runRequestAction(requestId, action, actorId, payload);
    } catch (err) {
      console.error('[SupabaseAdapter] localStore runRequestAction error:', err);
    }

    try {
      let updateData: any = { updated_at: new Date().toISOString() };
      if (action === 'accept') { updateData.status = 'accepted'; updateData.journey_stage = 'accepted'; }
      else if (action === 'decline') { updateData.status = 'declined'; updateData.journey_stage = 'declined'; updateData.decline_reason = payload?.reason; }
      else if (action === 'cancel') { updateData.status = 'cancelled'; updateData.journey_stage = 'cancelled'; updateData.cancel_reason = payload?.reason; }
      else if (action === 'pay_deposit') { updateData.status = 'paid'; updateData.journey_stage = 'seriousness'; }

      const { data } = await supabaseClient
        .from('interest_requests')
        .update(updateData)
        .eq('id', requestId)
        .select()
        .single()
        .catch(() => ({ data: null }));

      requestsCache = [];
      return { ok: true, data: data || localRes?.data };
    } catch (err) {
      requestsCache = [];
      return localRes || { ok: true };
    }
  };

  getEvents = async (requestId: number): Promise<any[]> => {
    try {
      const localEvents = await localStore.getEvents(requestId);
      const { data } = await supabaseClient.from('notifications').select('*').eq('request_id', requestId).catch(() => ({ data: null }));
      if (data && Array.isArray(data) && data.length > 0) {
        return [...localEvents, ...data];
      }
      return localEvents;
    } catch {
      return localStore.getEvents(requestId);
    }
  };

  isRequestUnseen = (requestId: number, updatedAt?: string | null): boolean => {
    return false;
  };

  markRequestSeen = (requestId: number): void => {};
  markRequestNotificationsRead = (requestId: number, userId?: string): void => {};

  // ===== غرفة الاستفسار (Inquiry Messaging) =====
  getUserInquiryBalance = (userId: string): number => {
    const val = this.settings.get(`inquiry_balance_${userId}`);
    return val ? parseInt(val, 10) : 5;
  };

  consumeUserInquiryMessage = (userId: string): boolean => {
    const current = this.getUserInquiryBalance(userId);
    if (current > 0) {
      this.settings.set(`inquiry_balance_${userId}`, (current - 1).toString());
      return true;
    }
    return false;
  };

  getInquiry = async (requestId: number): Promise<any> => {
    try {
      const { data } = await supabaseClient.from('inquiry_messages').select('*').eq('request_id', requestId);
      return { messages: data || [] };
    } catch {
      return { messages: [] };
    }
  };

  initializeInquiry = async (requestId: number, userId: string): Promise<any> => {
    return { ok: true };
  };

  buyInquiry = async (requestId: number, ownerId: string): Promise<any> => {
    return { ok: true };
  };

  buyMessagePackageCustom = async (userId: string, credits: number, price: number): Promise<any> => {
    const current = this.getUserInquiryBalance(userId);
    this.settings.set(`inquiry_balance_${userId}`, (current + credits).toString());
    await supabaseClient.from('transactions').insert({
      user_id: userId,
      amount: price,
      type: 'inquiry_package',
      description: `شراء باقة رسائل بعدد ${credits}`,
      status: 'completed',
    });
    return { ok: true };
  };

  sendInquiry = async (requestId: number, senderId: string, text: string): Promise<any> => {
    try {
      const { data, error } = await supabaseClient.from('inquiry_messages').insert({
        request_id: requestId,
        sender_id: senderId,
        text,
        status: 'approved',
      }).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('[SupabaseAdapter] Failed sendInquiry:', err);
      return null;
    }
  };

  simulateReply = async (requestId: number, replierId: string, text: string): Promise<any> => {
    return this.sendInquiry(requestId, replierId, text);
  };

  getAllInquiryMessages = (): any[] => {
    return inquiryMessagesCache;
  };

  moderateInquiryMessage = (messageId: number, action: 'approve' | 'reject', moderatorName: string): boolean => {
    supabaseClient.from('inquiry_messages').update({ status: action === 'approve' ? 'approved' : 'rejected', moderated_by: moderatorName }).eq('id', messageId).then();
    return true;
  };

  updateInquiryMessage = (messageId: number, newText: string): boolean => {
    supabaseClient.from('inquiry_messages').update({ message: newText.trim(), updated_at: new Date().toISOString() }).eq('id', messageId).then();
    return true;
  };

  deleteInquiryMessage = (messageId: number): boolean => {
    supabaseClient.from('inquiry_messages').delete().eq('id', messageId).then();
    return true;
  };

  // ===== الإشعارات (Journey Notifications) =====
  getJourneyNotifications = async (userId: string): Promise<any[]> => {
    try {
      const localNotifs = await localStore.getJourneyNotifications(userId);
      let supabaseNotifs: any[] = [];
      const { data, error } = await supabaseClient
        .from('notifications')
        .select('*')
        .in('user_id', [userId, 'all'])
        .order('created_at', { ascending: false })
        .catch(() => ({ data: null, error: true }));
      if (!error && Array.isArray(data)) {
        supabaseNotifs = data;
      }

      const combined = new Map<string, any>();
      localNotifs.forEach((n: any) => combined.set(String(n.id), n));
      supabaseNotifs.forEach((n: any) => combined.set(String(n.id), n));

      return Array.from(combined.values()).sort((a, b) =>
        (b.created_at || '').localeCompare(a.created_at || '')
      );
    } catch (err) {
      return localStore.getJourneyNotifications(userId);
    }
  };

  markNotificationRead = async (id: number): Promise<void> => {
    try { localStore.markNotificationRead(id); } catch {}
    try { await supabaseClient.from('notifications').update({ read: true }).eq('id', id); } catch {}
  };

  markAllNotificationsRead = async (userId: string): Promise<void> => {
    try { localStore.markAllNotificationsRead(userId); } catch {}
    try { await supabaseClient.from('notifications').update({ read: true }).eq('user_id', userId); } catch {}
  };

  getUnreadNotificationsCount = async (userId: string): Promise<number> => {
    try {
      const notifs = await this.getJourneyNotifications(userId);
      return notifs.filter((n: any) => !n.read).length;
    } catch {
      return 0;
    }
  };

  getActionableRequestsCount = async (userId: string): Promise<number> => {
    const requests = await this.getRequests(userId);
    return requests.filter((r) =>
      (r.status === 'pending' || r.journey_stage === 'sent') && r.receiver_id === userId
    ).length;
  };

  deleteNotification = async (id: number): Promise<void> => {
    await supabaseClient.from('notifications').delete().eq('id', id);
  };

  // ===== لوحة الإدارة (Admin Operations) =====
  adminGetMembers = async (): Promise<any[]> => {
    return this.getMembers();
  };

  adminUpdateMember = async (id: string, fields: any): Promise<boolean> => {
    try {
      await this.members.update(id, fields);
      return true;
    } catch (err) {
      console.error('[SupabaseAdapter] adminUpdateMember failed:', err);
      return false;
    }
  };

  adminBulkDeleteMembers = async (ids: string[]): Promise<boolean> => {
    try {
      const { error } = await supabaseClient.from('members').delete().in('id', ids);
      if (error) throw error;
      await this.syncMembersFromCloud();
      return true;
    } catch (err) {
      return false;
    }
  };

  adminBulkUpdateStatus = async (ids: string[], status: any, reason?: string, by?: string): Promise<boolean> => {
    try {
      const { error } = await supabaseClient.from('members').update({ status, status_reason: reason, status_by: by }).in('id', ids);
      if (error) throw error;
      await this.syncMembersFromCloud();
      return true;
    } catch {
      return false;
    }
  };

  adminBulkSetVerified = async (ids: string[], value: boolean): Promise<boolean> => {
    try {
      await supabaseClient.from('members').update({ verified: value }).in('id', ids);
      await this.syncMembersFromCloud();
      return true;
    } catch {
      return false;
    }
  };

  adminBulkSetPinned = async (ids: string[], value: boolean): Promise<boolean> => {
    try {
      await supabaseClient.from('members').update({ pinned: value }).in('id', ids);
      await this.syncMembersFromCloud();
      return true;
    } catch {
      return false;
    }
  };

  adminBulkSetPlan = async (ids: string[], plan: 'free' | 'gold' | 'elite'): Promise<boolean> => {
    try {
      await supabaseClient.from('members').update({ plan }).in('id', ids);
      await this.syncMembersFromCloud();
      return true;
    } catch {
      return false;
    }
  };

  adminBulkSetSeriousnessBadge = async (ids: string[], value: boolean): Promise<boolean> => {
    try {
      await supabaseClient.from('members').update({ has_seriousness_badge: value }).in('id', ids);
      await this.syncMembersFromCloud();
      return true;
    } catch {
      return false;
    }
  };

  adminDeleteMember = async (id: string): Promise<boolean> => {
    return this.adminUpdateMember(id, { status: 'suspended' });
  };

  adminHardDeleteMember = async (id: string): Promise<boolean> => {
    try {
      await supabaseClient.from('members').delete().eq('id', id);
      await this.syncMembersFromCloud();
      return true;
    } catch {
      return false;
    }
  };

  adminResetPassword = async (id: string): Promise<string> => {
    const newPass = 'Tawasol' + Math.floor(1000 + Math.random() * 9000);
    return newPass;
  };

  adminToggleVerified = async (id: string, value: boolean): Promise<boolean> => {
    return this.adminUpdateMember(id, { verified: value });
  };

  adminSetPremium = async (id: string, value: boolean): Promise<boolean> => {
    return this.adminUpdateMember(id, { premium: value, plan: value ? 'gold' : 'free' });
  };

  adminSetNote = async (id: string, note: string): Promise<boolean> => {
    return this.adminUpdateMember(id, { notes: note });
  };

  adminToggleFlag = async (id: string, value: boolean): Promise<boolean> => {
    return this.adminUpdateMember(id, { flagged: value });
  };

  adminSendNotification = async (id: string, text: string, title?: string): Promise<boolean> => {
    try {
      await localStore.adminSendNotification(id, text, title);
      await supabaseClient.from('notifications').insert({
        user_id: id,
        text,
        title: title || 'تنبيه إداري جديد',
        type: 'admin',
        read: false,
      });
      return true;
    } catch {
      return false;
    }
  };

  adminSendBulkNotifications = async (userIds: string[], text: string, title?: string): Promise<boolean> => {
    try {
      await localStore.adminSendBulkNotifications(userIds, text, title);
      const uniqueIds = Array.from(new Set(userIds));
      const rows = uniqueIds.map((uid) => ({
        user_id: uid,
        text,
        title: title || 'تنبيه إداري جديد',
        type: 'admin',
        read: false,
      }));
      await supabaseClient.from('notifications').insert(rows).catch(() => {});
      return true;
    } catch {
      return false;
    }
  };

  adminDeleteRequest = async (requestId: number): Promise<boolean> => {
    try {
      await supabaseClient.from('interest_requests').delete().eq('id', requestId);
      return true;
    } catch {
      return false;
    }
  };

  adminGrantSeriousnessBadge = async (id: string): Promise<boolean> => {
    return this.adminUpdateMember(id, { has_seriousness_badge: true });
  };

  adminRevokeSeriousnessBadge = async (id: string): Promise<boolean> => {
    return this.adminUpdateMember(id, { has_seriousness_badge: false });
  };

  adminGetRequests = async (): Promise<any[]> => {
    return this.getRequests();
  };

  adminGetStats = async (): Promise<any> => {
    const members = await this.getMembers();
    const requests = await this.getRequests();

    const activeCount = members.filter((m: any) => m.status === 'active' || !m.status).length;
    const pendingCount = members.filter((m: any) => m.status === 'pending').length;
    const suspendedCount = members.filter((m: any) => m.status === 'suspended').length;
    const bannedCount = members.filter((m: any) => m.status === 'banned').length;

    const totalReq = requests.length;
    const completedCount = requests.filter((r: any) => (r.journey_stage || r.status) === 'completed').length;
    const declinedCount = requests.filter((r: any) => (r.journey_stage || r.status) === 'declined').length;
    const cancelledCount = requests.filter((r: any) => (r.journey_stage || r.status) === 'cancelled').length;

    const seriousCount = requests.filter((r: any) =>
      ['seriousness', 'coordination', 'sharia_viewing', 'engagement'].includes(r.journey_stage || r.status)
    ).length;

    const maleCount = members.filter((m: any) => m.gender === 'male').length;
    const femaleCount = members.filter((m: any) => m.gender === 'female').length;

    const verifiedCount = members.filter((m: any) => m.verified).length;
    const premiumCount = members.filter((m: any) => m.premium || m.plan === 'gold' || m.plan === 'elite').length;

    const pendingRequestsCount = requests.filter((r: any) => (r.journey_stage || r.status) === 'sent' || (r.journey_stage || r.status) === 'pending').length;
    const activeJourneysCount = requests.filter((r: any) =>
      !['sent', 'pending', 'completed', 'declined', 'cancelled'].includes(r.journey_stage || r.status)
    ).length;

    let depositsPaid = 0;
    requests.forEach((r: any) => {
      if (r.sender_paid || r.senderPaid) depositsPaid++;
      if (r.receiver_paid || r.receiverPaid) depositsPaid++;
    });
    const revenue = depositsPaid * 500;

    const stageBreakdown: Record<string, number> = {};
    const stages = ['sent', 'accepted', 'seriousness', 'coordination', 'sharia_viewing', 'engagement', 'completed', 'declined', 'cancelled'];
    stages.forEach((st) => {
      stageBreakdown[st] = requests.filter((r: any) => (r.journey_stage || r.status) === st).length;
    });

    return {
      totalMembers: members.length,
      activeMembers: activeCount,
      pendingMembers: pendingCount,
      suspendedMembers: suspendedCount,
      bannedMembers: bannedCount,
      totalRequests: totalReq,
      completedRequests: completedCount,
      declinedRequests: declinedCount,
      cancelledRequests: cancelledCount,
      seriousRequests: seriousCount,
      maleCount,
      femaleCount,
      males: maleCount,
      females: femaleCount,

      pendingRequests: pendingRequestsCount,
      activeRequests: totalReq,
      activeJourneys: activeJourneysCount,
      completed: completedCount,
      declined: declinedCount,
      cancelled: cancelledCount,
      verified: verifiedCount,
      premium: premiumCount,
      revenue: revenue,
      depositsPaid: depositsPaid,
      seriousnessBadges: members.filter((m: any) => m.hasSeriousnessBadge || m.has_seriousness_badge).length,
      totalTransactions: depositsPaid,
      totalRevenue: revenue,
      stageBreakdown,
      recentEvents: [],
    };
  };

  adminGetRequestPayments = async (requestId: number): Promise<any[]> => {
    try {
      const { data } = await supabaseClient.from('transactions').select('*').eq('request_id', requestId);
      return data || [];
    } catch {
      return [];
    }
  };

  adminApplyExemption = async (memberId: string, type: 'deposit' | 'badge', value: number | boolean, memberName?: string): Promise<boolean> => {
    if (type === 'badge') {
      return this.adminGrantSeriousnessBadge(memberId);
    }
    return true;
  };

  // ===== الكوبونات والمعاملات المالية =====
  getCoupons = (): any[] => {
    return [];
  };

  saveCoupon = (coupon: any): void => {
    supabaseClient.from('coupons').upsert(coupon).then();
  };

  deleteCoupon = (code: string): void => {
    supabaseClient.from('coupons').delete().eq('code', code).then();
  };

  toggleCouponActive = (code: string): void => {};

  getTransactions = (): any[] => {
    return [];
  };

  recordTransaction = (tx: any): void => {
    supabaseClient.from('transactions').insert(tx).then();
  };

  validateCoupon = (code: string, amount?: number): any => {
    return { valid: false, message: 'الكوبون غير صالح' };
  };

  useCoupon = (code: string): boolean => {
    return false;
  };

  resetLocalDB = (): void => {
    this.initCloudData().then();
  };

  // ===== مستندات التوثيق =====
  submitVerificationDoc = (doc: any): any => {
    supabaseClient.from('verification_docs').upsert(doc).then();
    verificationDocsCache.push(doc);
    return doc;
  };

  getAllVerificationDocs = (): any[] => {
    return verificationDocsCache;
  };

  getMemberVerificationDoc = (memberId: string): any | null => {
    return verificationDocsCache.find((d) => d.memberId === memberId || d.member_id === memberId) || null;
  };

  getVerificationStatus = (memberId: string): any => {
    const doc = this.getMemberVerificationDoc(memberId);
    return doc ? doc.status : 'none';
  };

  approveVerificationDoc = (docId: string, reviewerName: string): boolean => {
    supabaseClient.from('verification_docs').update({ status: 'approved', reviewer_name: reviewerName }).eq('id', docId).then();
    return true;
  };

  rejectVerificationDoc = (docId: string, reviewerName: string, reason: string): boolean => {
    supabaseClient.from('verification_docs').update({ status: 'rejected', reviewer_name: reviewerName, rejection_reason: reason }).eq('id', docId).then();
    return true;
  };

  deleteVerificationDoc = (docId: string): boolean => {
    supabaseClient.from('verification_docs').delete().eq('id', docId).then();
    return true;
  };

  deleteReviewedDocs = (): number => {
    return 0;
  };

  downloadDocImage = (doc: any): void => {};
  downloadAllPendingDocs = (): number => 0;

  // ===== خيارات التسجيل المربوطة بقاعدة البيانات =====
  getSects = (): string[] => {
    return this.getRegistrationOptions('sects');
  };

  getRegistrationOptions = (key: string): any[] => {
    const stored = this.settings.get(`platform_options_${key}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    switch (key) {
      case 'sects': return DEFAULT_SECTS;
      case 'skinColors': return DEFAULT_SKIN_COLORS;
      case 'educationLevels': return DEFAULT_EDUCATION_LEVELS;
      case 'workTypes': return DEFAULT_WORK_TYPES;
      case 'housingTypes': return DEFAULT_HOUSING_TYPES;
      case 'smokingOptions': return DEFAULT_SMOKING_OPTIONS;
      case 'maritalMale': return DEFAULT_MARITAL_MALE;
      case 'maritalFemale': return DEFAULT_MARITAL_FEMALE;
      default: return [];
    }
  };

  updateRegistrationOptions = (key: string, values: any[]): void => {
    this.settings.set(`platform_options_${key}`, JSON.stringify(values));
  };

  // ===== Geo Store (الدول والمدن) =====
  normalizeText = (s: string): string => s.trim();

  getCountries = (): any[] => {
    if (countriesCache && countriesCache.length > 0) return countriesCache;
    return SEED_COUNTRIES.map((name) => ({ name }));
  };
  getCountryNames = (): string[] => {
    const list = this.getCountries();
    return list.map((c) => (typeof c === 'string' ? c : c?.name || String(c))).filter(Boolean);
  };

  getNationalities = (): string[] => {
    const raw = settingsCache.get('geo_nationalities_list');
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    return this.getCountryNames();
  };

  addNationality = (name: string, country?: string, gender?: string): any => {
    const list = this.getNationalities();
    if (!list.includes(name)) list.unshift(name);
    settingsCache.set('geo_nationalities_list', JSON.stringify(list));
    supabaseClient.from('geo_nationalities').upsert({ name, country: country || '', gender: gender || 'both' }).then();
    return { ok: true, name, country, gender };
  };

  removeNationality = (name: string): void => {
    settingsCache.set('geo_nationalities_list', JSON.stringify(this.getNationalities().filter((n) => n !== name)));
    supabaseClient.from('geo_nationalities').delete().eq('name', name).then();
  };

  renameNationality = (oldName: string, newName: string): any => {
    this.removeNationality(oldName);
    this.addNationality(newName);
    return { ok: true, oldName, newName };
  };

  isNationalityKnown = (name: string): boolean => this.getNationalities().some((n) => this.normalizeText(n) === this.normalizeText(name));

  batchUpdateMemberGeo = (kind: 'country' | 'city' | 'nationality' | 'skinColor' | 'education' | 'workType', oldValue: string, newValue: string, countryFilter?: string) => {
    return geoStore.batchUpdateMemberGeo(kind, oldValue, newValue, countryFilter);
  };

  addCountry = (name: string, code?: string, flag?: string): any => {
    const item = { name, code, flag };
    supabaseClient.from('geo_countries').upsert(item).then();
    countriesCache.push(item);
    return item;
  };

  removeCountry = (name: string): void => {
    supabaseClient.from('geo_countries').delete().eq('name', name).then();
    countriesCache = countriesCache.filter((c) => c.name !== name);
  };

  renameCountry = (oldName: string, newName: string): any => {
    this.removeCountry(oldName);
    return this.addCountry(newName);
  };

  getCities = (country: string): string[] => {
    if (citiesCache && citiesCache[country] && citiesCache[country].length > 0) {
      return citiesCache[country];
    }
    return SEED_CITIES[country] || [];
  };

  addCityToCountry = (country: string, city: string): any => {
    supabaseClient.from('geo_cities').insert({ country, name: city }).then();
    if (!citiesCache[country]) citiesCache[country] = [];
    citiesCache[country].push(city);
    return { country, name: city };
  };

  removeCityFromCountry = (country: string, city: string): void => {
    supabaseClient.from('geo_cities').delete().eq('country', country).eq('name', city).then();
    if (citiesCache[country]) {
      citiesCache[country] = citiesCache[country].filter((c) => c !== city);
    }
  };

  renameCity = (country: string, oldName: string, newName: string): any => {
    this.removeCityFromCountry(country, oldName);
    return this.addCityToCountry(country, newName);
  };

  adminMergeCities = (sourceCountry: string, sourceCity: string, targetCountry: string, targetCity: string): any => {
    const res = geoStore.adminMergeCities(sourceCountry, sourceCity, targetCountry, targetCity);
    this.syncGeoFromCloud().catch(() => {});
    return res;
  };

  adminMergeCountries = (sourceCountry: string, targetCountry: string): any => {
    const res = geoStore.adminMergeCountries(sourceCountry, targetCountry);
    this.syncGeoFromCloud().catch(() => {});
    return res;
  };

  isCityKnown = (country: string, city: string): boolean => {
    return geoStore.isCityKnown(country, city);
  };

  isCountryKnown = (country: string): boolean => {
    return geoStore.isCountryKnown(country);
  };

  getPendingCities = (): any[] => geoStore.getPendingCities();
  getAllPendingCities = (): any[] => geoStore.getAllPendingCities();
  getPendingCitiesCount = (): number => geoStore.getPendingCitiesCount() + this.getPendingGeoSuggestionsCount();

  getPendingGeoSuggestions = (): any[] => {
    let list1: any[] = [];
    const raw = settingsCache.get('geo_suggestions_list');
    if (raw) {
      try { list1 = JSON.parse(raw); } catch {}
    }
    const storeCities = geoStore.getAllPendingCities() || [];
    const list2 = storeCities.map((c: any) => ({
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

  getPendingGeoSuggestionsCount = (): number => this.getPendingGeoSuggestions().filter((g: any) => g.status === 'pending').length;

  addPendingGeo = (kind: 'country' | 'city' | 'nationality', name: string, country = '', suggestedBy = 'عضو', source = 'register', suggestedById?: string): any => {
    const list = this.getPendingGeoSuggestions();
    const item = { id: `geo_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, kind, name, country, suggested_by: suggestedBy, suggestedBy, suggested_by_id: suggestedById || '', source, status: 'pending', created_at: new Date().toISOString() };
    try {
      const raw = settingsCache.get('geo_suggestions_list');
      const list1: any[] = raw ? JSON.parse(raw) : [];
      list1.unshift(item);
      settingsCache.set('geo_suggestions_list', JSON.stringify(list1));
    } catch {}
    if (kind === 'city') {
      geoStore.addPendingCity(name, country, suggestedBy, source as any, suggestedById);
    }
    supabaseClient.from('geo_suggestions').upsert(item).then();
    return { ok: true, ...item };
  };

  approvePendingGeo = (id: string, editedName?: string): any => {
    const all = this.getPendingGeoSuggestions();
    const item = all.find((g: any) => g.id === id);
    const targetName = editedName || item?.name || '';
    const normName = item?.name ? geoStore.normalizeText(item.name) : '';
    const normCountry = item?.country ? geoStore.normalizeText(item.country) : '';

    if (item) {
      if (item.kind === 'country') this.addCountry(targetName);
      if (item.kind === 'city') this.addCityToCountry(item.country || 'السعودية', targetName);
      if (item.kind === 'nationality') this.addNationality(targetName, item.country);
      if (item.name && targetName) {
        this.batchUpdateMemberGeo(item.kind, item.name, targetName, item.country || 'السعودية');
      }
    }

    try {
      const raw = settingsCache.get('geo_suggestions_list');
      const list1: any[] = raw ? JSON.parse(raw) : [];
      list1.forEach((g: any) => {
        const isMatch = g.id === id || Boolean(item && g.kind === item.kind && geoStore.normalizeText(g.name) === normName && (item.kind !== 'city' || !g.country || !normCountry || geoStore.normalizeText(g.country) === normCountry));
        if (isMatch) {
          g.status = 'approved';
          g.target_name = targetName;
        }
      });
      settingsCache.set('geo_suggestions_list', JSON.stringify(list1));
    } catch {}

    geoStore.approvePendingCity(id, 'admin', editedName, item?.name, item?.country);
    supabaseClient.from('geo_suggestions').update({ status: 'approved', target_name: targetName }).eq('id', id).then();
    return { ok: true };
  };

  mergePendingGeo = (id: string, targetName: string, targetCountry?: string): any => {
    const all = this.getPendingGeoSuggestions();
    const item = all.find((g: any) => g.id === id);
    const normName = item?.name ? geoStore.normalizeText(item.name) : '';
    const normCountry = item?.country ? geoStore.normalizeText(item.country) : '';

    if (item) {
      if (item.kind === 'city') {
        const cCountry = targetCountry || item.country || 'السعودية';
        this.addCityToCountry(cCountry, targetName);
      }
      if (item.name && targetName) {
        this.batchUpdateMemberGeo(item.kind, item.name, targetName, targetCountry || item.country, item.country);
      }
    }

    try {
      const raw = settingsCache.get('geo_suggestions_list');
      const list1: any[] = raw ? JSON.parse(raw) : [];
      list1.forEach((g: any) => {
        const isMatch = g.id === id || Boolean(item && g.kind === item.kind && geoStore.normalizeText(g.name) === normName && (item.kind !== 'city' || !g.country || !normCountry || geoStore.normalizeText(g.country) === normCountry));
        if (isMatch) {
          g.status = 'merged';
          g.target_name = targetName;
          g.target_country = targetCountry || '';
        }
      });
      settingsCache.set('geo_suggestions_list', JSON.stringify(list1));
    } catch {}

    geoStore.rejectPendingCity(id, 'admin', `merged into ${targetName}`, item?.name, item?.country);
    geoStore.deletePendingCity(id, item?.name, item?.country);
    supabaseClient.from('geo_suggestions').update({ status: 'merged', target_name: targetName, target_country: targetCountry || '' }).eq('id', id).then();
    return { ok: true };
  };

  rejectPendingGeo = (id: string, reason?: string): any => {
    const all = this.getPendingGeoSuggestions();
    const item = all.find((g: any) => g.id === id);
    const normName = item?.name ? geoStore.normalizeText(item.name) : '';
    const normCountry = item?.country ? geoStore.normalizeText(item.country) : '';

    try {
      const raw = settingsCache.get('geo_suggestions_list');
      const list1: any[] = raw ? JSON.parse(raw) : [];
      list1.forEach((g: any) => {
        const isMatch = g.id === id || Boolean(item && g.kind === item.kind && geoStore.normalizeText(g.name) === normName && (item.kind !== 'city' || !g.country || !normCountry || geoStore.normalizeText(g.country) === normCountry));
        if (isMatch) {
          g.status = 'rejected';
          g.rejection_reason = reason || '';
        }
      });
      settingsCache.set('geo_suggestions_list', JSON.stringify(list1));
    } catch {}

    geoStore.rejectPendingCity(id, 'admin', reason, item?.name, item?.country);
    supabaseClient.from('geo_suggestions').update({ status: 'rejected', rejection_reason: reason || '' }).eq('id', id).then();
    return { ok: true };
  };

  deletePendingGeo = (id: string): void => {
    const all = this.getPendingGeoSuggestions();
    const item = all.find((g: any) => g.id === id);
    const normName = item?.name ? geoStore.normalizeText(item.name) : '';
    const normCountry = item?.country ? geoStore.normalizeText(item.country) : '';

    try {
      const raw = settingsCache.get('geo_suggestions_list');
      const list1: any[] = raw ? JSON.parse(raw) : [];
      const updated = list1.filter((g: any) => {
        const isMatch = g.id === id || Boolean(item && g.kind === item.kind && geoStore.normalizeText(g.name) === normName && (item.kind !== 'city' || !g.country || !normCountry || geoStore.normalizeText(g.country) === normCountry));
        return !isMatch;
      });
      settingsCache.set('geo_suggestions_list', JSON.stringify(updated));
    } catch {}

    geoStore.deletePendingCity(id, item?.name, item?.country);
    supabaseClient.from('geo_suggestions').delete().eq('id', id).then();
  };

  addPendingCity = (name: string, country: string, suggestedBy: string, source?: string, suggestedById?: string): any => {
    return this.addPendingGeo('city', name, country, suggestedBy, source, suggestedById);
  };

  approvePendingCity = (id: string, reviewer: string, editedName?: string): any => {
    return geoStore.approvePendingCity(id, reviewer, editedName);
  };

  rejectPendingCity = (id: string, reviewer: string, reason?: string): any => {
    return geoStore.rejectPendingCity(id, reviewer, reason);
  };

  deletePendingCity = (id: string): void => {
    geoStore.deletePendingCity(id);
  };

  checkAndRegisterUnknownGeo = (members: any[], source?: string): any => {
    return geoStore.checkAndRegisterUnknownGeo(members, (source as any) || 'import');
  };

  exportAllCountries = (): string => JSON.stringify(countriesCache);
  exportCitiesForCountry = (country: string): string => JSON.stringify(citiesCache[country] || []);
  exportAllGeo = (): string => JSON.stringify({ countries: countriesCache, cities: citiesCache });

  importCountries = (json: string, mode?: 'merge' | 'replace'): any => {};
  importCitiesForCountry = (country: string, json: string, mode?: 'merge' | 'replace'): any => {};
  importFullGeo = (json: string, mode?: 'merge' | 'replace'): any => {};

  resetGeoDB = (): void => {
    this.syncGeoFromCloud().then();
  };

  refreshGeoDB = (): void => {
    this.syncGeoFromCloud().then();
  };
  ensureGeoLoaded = async (): Promise<void> => {
    try { await this.syncGeoFromCloud(); } catch { /* ignore */ }
  };
}
