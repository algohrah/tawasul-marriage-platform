import { IRepository, IDatabaseAdapter, ISettingsRepository } from './interfaces';
import * as localStore from './adapters/local/localStore';
import * as verificationStore from './adapters/local/verificationStore';
import * as geoStore from './adapters/local/geoStore';
import {
  SECTS as DEFAULT_SECTS,
  SKIN_COLORS as DEFAULT_SKIN_COLORS,
  EDUCATION_LEVELS as DEFAULT_EDUCATION_LEVELS,
  WORK_TYPES as DEFAULT_WORK_TYPES,
  HOUSING_TYPES as DEFAULT_HOUSING_TYPES,
  SMOKING_OPTIONS as DEFAULT_SMOKING_OPTIONS,
  MARITAL_MALE as DEFAULT_MARITAL_MALE,
  MARITAL_FEMALE as DEFAULT_MARITAL_FEMALE,
  NATIONALITIES,
} from '../constants';

// ============================================================
//  LocalStorage Adapter — التخزين المحلي عبر المتصفح
//  هذا هو الملف الوحيد المسموح له بالوصول المباشر لـ window.localStorage
// ============================================================

export class LocalStorageRepository<T extends { id: string | number }> implements IRepository<T> {
  private storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
  }

  private getItems(): T[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveItems(items: T[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (e) {
      console.error(`Error saving to localStorage [${this.storageKey}]:`, e);
    }
  }

  async getAll(): Promise<T[]> {
    return this.getItems();
  }

  async getById(id: string | number): Promise<T | null> {
    const items = this.getItems();
    const item = items.find((i) => i.id == id);
    return item || null;
  }

  async create(item: T): Promise<T> {
    const items = this.getItems();
    items.push(item);
    this.saveItems(items);
    return item;
  }

  async update(id: string | number, payload: Partial<T>): Promise<T> {
    const items = this.getItems();
    const index = items.findIndex((i) => i.id == id);
    if (index === -1) {
      // إذا لم يكن العنصر موجوداً في هذا الجدول ونحن في جدول الأعضاء، نجرب تحديثه في localStore
      if (this.storageKey === 'twafok_members') {
        localStore.adminUpdateMember(String(id), payload as any).catch(() => undefined);
      }
      throw new Error(`Item with id ${id} not found.`);
    }
    const updatedItem = { ...items[index], ...payload };
    items[index] = updatedItem;
    this.saveItems(items);

    if (this.storageKey === 'twafok_members') {
      localStore.adminUpdateMember(String(id), payload as any).catch(() => undefined);
    }
    return updatedItem;
  }

  async delete(id: string | number): Promise<boolean> {
    const items = this.getItems();
    const initialLength = items.length;
    const filteredItems = items.filter((i) => i.id != id);
    if (filteredItems.length === initialLength) {
      return false;
    }
    this.saveItems(filteredItems);
    return true;
  }
}

/**
 * مستودع الإعدادات عبر localStorage.
 * المنفذ الوحيد المسموح له بالقراءة/الكتابة المباشرة في localStorage.
 */
export class LocalStorageSettingsRepository implements ISettingsRepository {
  get(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error(`Error setting localStorage key [${key}]:`, e);
    }
  }

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* تجاهل */
    }
  }
}

export class LocalStorageAdapter implements IDatabaseAdapter {
  members: IRepository<any> = new LocalStorageRepository<any>('twafok_members');
  requests: IRepository<any> = new LocalStorageRepository<any>('twafok_requests');
  transactions: IRepository<any> = new LocalStorageRepository<any>('twafok_transactions');
  tickets: IRepository<any> = new LocalStorageRepository<any>('twafok_tickets');
  adminUsers: IRepository<any> = new LocalStorageRepository<any>('twafok_admin_users');
  settings: ISettingsRepository = new LocalStorageSettingsRepository();

  // ===== الأعضاء (Members) =====
  getMembers = () => localStore.getMembers();
  getLiveMembers = (includeInactiveAndDeleted?: boolean) => localStore.getLiveMembers(includeInactiveAndDeleted);
  getLiveMemberById = (id: string) => localStore.getLiveMemberById(id);
  getCurrentUserId = () => localStore.getCurrentUserId();
  setCurrentUserId = (id: string) => localStore.setCurrentUserId(id);
  hasUserPaidDepositAnywhere = (userId: string) => localStore.hasUserPaidDepositAnywhere(userId);

  // ===== الطلبات والرحلات (Requests & Journeys) =====
  getRequests = (userId?: string) => localStore.getRequests(userId);
  getRequest = (id: number) => localStore.getRequest(id);
  createRequest = (senderId: string, receiverId: string, message: string) => localStore.createRequest(senderId, receiverId, message);
  runRequestAction = (requestId: number, action: string, actorId: string, payload?: any) => localStore.runRequestAction(requestId, action, actorId, payload);
  getEvents = (requestId: number) => localStore.getEvents(requestId);
  isRequestUnseen = (requestId: number, updatedAt?: string | null) => localStore.isRequestUnseen(requestId, updatedAt);
  markRequestSeen = (requestId: number) => localStore.markRequestSeen(requestId);
  markRequestNotificationsRead = (requestId: number, userId?: string) => localStore.markRequestNotificationsRead(requestId, userId);

  // ===== غرفة الاستفسار (Inquiry room messaging) =====
  getUserInquiryBalance = (userId: string) => localStore.getUserInquiryBalance(userId);
  consumeUserInquiryMessage = (userId: string) => localStore.consumeUserInquiryMessage(userId);
  getInquiry = (requestId: number) => localStore.getInquiry(requestId);
  initializeInquiry = (requestId: number, userId: string) => localStore.initializeInquiry(requestId, userId);
  buyInquiry = (requestId: number, ownerId: string) => localStore.buyInquiry(requestId, ownerId);
  buyMessagePackageCustom = (userId: string, credits: number, price: number, _requestId?: number, _skipTransactionRecord?: boolean) => localStore.buyMessagePackageCustom(userId, credits, price);
  sendInquiry = (requestId: number, senderId: string, text: string) => localStore.sendInquiry(requestId, senderId, text);
  simulateReply = (requestId: number, replierId: string, text: string) => localStore.simulateReply(requestId, replierId, text);
  getAllInquiryMessages = () => localStore.getAllInquiryMessages();
  moderateInquiryMessage = (messageId: number, action: 'approve' | 'reject', moderatorName: string) => localStore.moderateInquiryMessage(messageId, action, moderatorName);
  updateInquiryMessage = (messageId: number, newText: string) => localStore.updateInquiryMessage(messageId, newText);
  deleteInquiryMessage = (messageId: number) => localStore.deleteInquiryMessage(messageId);

  // ===== الإشعارات (Journey Notifications) =====
  getJourneyNotifications = (userId: string): Promise<any[]> => localStore.getJourneyNotifications(userId);
  markNotificationRead = (id: number): void | Promise<void> => localStore.markNotificationRead(id);
  markAllNotificationsRead = (userId: string): void | Promise<void> => localStore.markAllNotificationsRead(userId);
  getUnreadNotificationsCount = (userId: string): number | Promise<number> => localStore.getUnreadNotificationsCount(userId);
  getActionableRequestsCount = (userId: string): Promise<number> => localStore.getActionableRequestsCount(userId);
  deleteNotification = (id: number): void | Promise<void> => localStore.deleteNotification(id);

  // ===== لوحة الإدارة (Admin Panel Operations) =====
  adminGetMembers = () => localStore.adminGetMembers();
  adminUpdateMember = (id: string, fields: any) => localStore.adminUpdateMember(id, fields);
  adminBulkDeleteMembers = (ids: string[]) => localStore.adminBulkDeleteMembers(ids);
  adminBulkUpdateStatus = (ids: string[], status: any, reason?: string, by?: string) => localStore.adminBulkUpdateStatus(ids, status, reason, by);
  adminBulkSetVerified = (ids: string[], value: boolean) => localStore.adminBulkSetVerified(ids, value);
  adminBulkSetPinned = (ids: string[], value: boolean) => localStore.adminBulkSetPinned(ids, value);
  adminBulkSetPlan = (ids: string[], plan: 'free' | 'gold' | 'elite') => localStore.adminBulkSetPlan(ids, plan);
  adminBulkSetSeriousnessBadge = (ids: string[], value: boolean) => localStore.adminBulkSetSeriousnessBadge(ids, value);
  adminDeleteMember = (id: string) => localStore.adminDeleteMember(id);
  adminHardDeleteMember = (id: string) => localStore.adminHardDeleteMember(id);
  adminResetPassword = (id: string) => localStore.adminResetPassword(id);
  adminToggleVerified = (id: string, value: boolean) => localStore.adminToggleVerified(id, value);
  adminSetPremium = (id: string, value: boolean) => localStore.adminSetPremium(id, value);
  adminSetNote = (id: string, note: string) => localStore.adminSetNote(id, note);
  adminToggleFlag = (id: string, value: boolean) => localStore.adminToggleFlag(id, value);
  adminSendNotification = (id: string, text: string, title?: string) => localStore.adminSendNotification(id, text, title);
  adminSendBulkNotifications = (userIds: string[], text: string, title?: string) => localStore.adminSendBulkNotifications(userIds, text, title);
  adminDeleteRequest = (requestId: number) => localStore.adminDeleteRequest(requestId);
  adminGrantSeriousnessBadge = (id: string) => localStore.adminGrantSeriousnessBadge(id);
  adminRevokeSeriousnessBadge = (id: string) => localStore.adminRevokeSeriousnessBadge(id);
  adminGetRequests = () => localStore.adminGetRequests();
  adminGetStats = () => localStore.adminGetStats();
  adminGetRequestPayments = (requestId: number) => localStore.adminGetRequestPayments(requestId);
  adminApplyExemption = (memberId: string, type: 'deposit' | 'badge', value: number | boolean, memberName?: string) => localStore.adminApplyExemption(memberId, type, value, memberName);

  // ===== الكوبونات والمعاملات المالية (Coupons & Transactions) =====
  getCoupons = () => localStore.getCoupons();
  saveCoupon = (coupon: any) => localStore.saveCoupon(coupon);
  deleteCoupon = (code: string) => localStore.deleteCoupon(code);
  toggleCouponActive = (code: string) => localStore.toggleCouponActive(code);
  getTransactions = () => localStore.getTransactions();
  recordTransaction = (tx: any) => localStore.recordTransaction(tx);
  updateTransactionStatus = (id: string, status: string) => localStore.updateTransactionStatus(id, status);
  validateCoupon = (code: string, amount?: number) => localStore.validateCoupon(code, amount);
  useCoupon = (code: string) => localStore.useCoupon(code);
  resetLocalDB = () => localStore.resetLocalDB();

  // ===== مستندات التوثيق (Verification documents) =====
  submitVerificationDoc = (doc: any) => verificationStore.submitVerificationDoc(doc);
  getAllVerificationDocs = () => verificationStore.getAllVerificationDocs();
  getMemberVerificationDoc = (memberId: string) => verificationStore.getMemberVerificationDoc(memberId);
  getVerificationStatus = (memberId: string) => verificationStore.getVerificationStatus(memberId);
  approveVerificationDoc = (docId: string, reviewerName: string) => verificationStore.approveVerificationDoc(docId, reviewerName);
  rejectVerificationDoc = (docId: string, reviewerName: string, reason: string) => verificationStore.rejectVerificationDoc(docId, reviewerName, reason);
  deleteVerificationDoc = (docId: string) => verificationStore.deleteVerificationDoc(docId);
  deleteReviewedDocs = () => verificationStore.deleteReviewedDocs();
  downloadDocImage = (doc: any) => verificationStore.downloadDocImage(doc);
  downloadAllPendingDocs = () => verificationStore.downloadAllPendingDocs();

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

  // ===== المدن والدول (Geo Store - Cities & Countries) =====
  normalizeText = (s: string) => geoStore.normalizeText(s);
  getCountries = () => geoStore.getCountries();
  getCountryNames = () => geoStore.getCountryNames();
  getNationalities = () => {
    let list: string[] = [];
    try {
      const raw = this.settings.get('geo_nationalities_list');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      }
    } catch {}
    return Array.from(new Set([...list, ...NATIONALITIES, ...this.getCountryNames()])).filter(Boolean);
  };
  addNationality = (name: string, country?: string, gender?: string) => {
    const list = this.getNationalities();
    if (!list.includes(name)) list.unshift(name);
    this.settings.set('geo_nationalities_list', JSON.stringify(list));
    return { ok: true, name, country, gender };
  };
  removeNationality = (name: string) => {
    const norm = this.normalizeText(name);
    this.settings.set('geo_nationalities_list', JSON.stringify(this.getNationalities().filter((n: string) => this.normalizeText(n) !== norm)));
  };
  renameNationality = (oldName: string, newName: string) => {
    const normOld = this.normalizeText(oldName);
    const curr = this.getNationalities();
    let replaced = false;
    const list = curr.map((n: string) => {
      if (this.normalizeText(n) === normOld) {
        replaced = true;
        return newName;
      }
      return n;
    });
    if (!replaced && !list.includes(newName)) {
      list.unshift(newName);
    }
    this.settings.set('geo_nationalities_list', JSON.stringify(Array.from(new Set(list))));

    // Update pending suggestions if any match
    try {
      const suggestions = this.getPendingGeoSuggestions();
      let suggChanged = false;
      suggestions.forEach((s: any) => {
        if (s.kind === 'nationality' && this.normalizeText(s.name) === normOld) {
          s.name = newName.trim();
          suggChanged = true;
        }
      });
      if (suggChanged) {
        this.settings.set('geo_suggestions_list', JSON.stringify(suggestions));
      }
    } catch {}

    return { ok: true, oldName, newName };
  };
  isNationalityKnown = (name: string) => this.getNationalities().some((n: string) => this.normalizeText(n) === this.normalizeText(name));
  batchUpdateMemberGeo = (kind: 'country' | 'city' | 'nationality' | 'skinColor' | 'education' | 'workType', oldValue: string, newValue: string, targetCountry?: string, sourceCountryFilter?: string) => geoStore.batchUpdateMemberGeo(kind, oldValue, newValue, targetCountry, sourceCountryFilter);
  addCountry = (name: string, code?: string, flag?: string) => geoStore.addCountry(name, code, flag);
  removeCountry = (name: string) => geoStore.removeCountry(name);
  renameCountry = (oldName: string, newName: string) => geoStore.renameCountry(oldName, newName);
  getCities = (country: string) => geoStore.getCities(country);
  addCityToCountry = (country: string, city: string) => geoStore.addCityToCountry(country, city);
  removeCityFromCountry = (country: string, city: string) => geoStore.removeCityFromCountry(country, city);
  renameCity = (country: string, oldName: string, newName: string) => geoStore.renameCity(country, oldName, newName);
  adminMergeCities = (sourceCountry: string, sourceCity: string, targetCountry: string, targetCity: string) => {
    const res = geoStore.adminMergeCities(sourceCountry, sourceCity, targetCountry, targetCity);
    try {
      const raw = this.settings.get('geo_suggestions_list');
      const list: any[] = raw ? JSON.parse(raw) : [];
      const normSourceCity = geoStore.normalizeText(sourceCity);
      const normSourceCountry = geoStore.normalizeText(sourceCountry);
      let changed = false;
      list.forEach((g: any) => {
        if (
          g.kind === 'city' &&
          geoStore.normalizeText(g.name) === normSourceCity &&
          (!normSourceCountry || !g.country || geoStore.normalizeText(g.country) === normSourceCountry)
        ) {
          g.status = 'merged';
          g.target_name = targetCity;
          g.target_country = targetCountry;
          changed = true;
        }
      });
      if (changed) this.settings.set('geo_suggestions_list', JSON.stringify(list));
    } catch {}
    return res;
  };
  adminMergeCountries = (sourceCountry: string, targetCountry: string) => {
    const res = geoStore.adminMergeCountries(sourceCountry, targetCountry);
    try {
      const raw = this.settings.get('geo_suggestions_list');
      const list: any[] = raw ? JSON.parse(raw) : [];
      const normSourceCountry = geoStore.normalizeText(sourceCountry);
      let changed = false;
      list.forEach((g: any) => {
        if (g.kind === 'country' && geoStore.normalizeText(g.name) === normSourceCountry) {
          g.status = 'merged';
          g.target_name = targetCountry;
          changed = true;
        }
      });
      if (changed) this.settings.set('geo_suggestions_list', JSON.stringify(list));
    } catch {}
    return res;
  };
  isCityKnown = (country: string, city: string) => geoStore.isCityKnown(country, city);
  isCountryKnown = (country: string) => geoStore.isCountryKnown(country);
  getPendingCities = () => geoStore.getPendingCities();
  getAllPendingCities = () => geoStore.getAllPendingCities();
  getPendingCitiesCount = () => this.getPendingGeoSuggestions().filter((g: any) => g.status === 'pending').length;
  getPendingGeoSuggestions = () => {
    try {
      const raw = this.settings.get('geo_suggestions_list');
      const list1: any[] = raw ? JSON.parse(raw) : [];
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
    } catch { return []; }
  };
  getPendingGeoSuggestionsCount = () => this.getPendingGeoSuggestions().filter((g: any) => g.status === 'pending').length;
  addPendingGeo = (kind: 'country' | 'city' | 'nationality', name: string, country = '', suggestedBy = 'عضو', source = 'register', suggestedById?: string) => {
    const list = this.getPendingGeoSuggestions();
    const item = { id: `geo_${kind}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, kind, name, country, suggested_by: suggestedBy, suggestedBy, suggested_by_id: suggestedById || '', source, status: 'pending', created_at: new Date().toISOString() };
    try {
      const raw = this.settings.get('geo_suggestions_list');
      const list1: any[] = raw ? JSON.parse(raw) : [];
      list1.unshift(item);
      this.settings.set('geo_suggestions_list', JSON.stringify(list1));
    } catch {}
    if (kind === 'city') {
      geoStore.addPendingCity(name, country, suggestedBy, source as any, suggestedById);
    }
    return { ok: true, ...item };
  };
  approvePendingGeo = (id: string, editedName?: string) => {
    const all = this.getPendingGeoSuggestions();
    const item = all.find((g: any) => g.id === id);
    const targetName = editedName || item?.name || '';
    const normName = item?.name ? geoStore.normalizeText(item.name) : '';
    const normCountry = item?.country ? geoStore.normalizeText(item.country) : '';

    if (item) {
      item.status = 'approved';
      item.target_name = targetName;
      if (item.kind === 'country') this.addCountry(targetName);
      if (item.kind === 'city') this.addCityToCountry(item.country || 'السعودية', targetName);
      if (item.kind === 'nationality') this.addNationality(targetName, item.country);
      if (item.name && targetName) {
        this.batchUpdateMemberGeo(item.kind, item.name, targetName, item.country || 'السعودية');
      }
    }

    try {
      const raw = this.settings.get('geo_suggestions_list');
      const list1: any[] = raw ? JSON.parse(raw) : [];
      list1.forEach((g: any) => {
        const isMatch = g.id === id || Boolean(item && g.kind === item.kind && geoStore.normalizeText(g.name) === normName && (item.kind !== 'city' || !g.country || !normCountry || geoStore.normalizeText(g.country) === normCountry));
        if (isMatch) {
          g.status = 'approved';
          g.target_name = targetName;
        }
      });
      this.settings.set('geo_suggestions_list', JSON.stringify(list1));
    } catch {}

    geoStore.approvePendingCity(id, 'admin', editedName, item?.name, item?.country);

    return { ok: true, data: item };
  };
  mergePendingGeo = (id: string, targetName: string, targetCountry?: string) => {
    const all = this.getPendingGeoSuggestions();
    const item = all.find((g: any) => g.id === id);
    const normName = item?.name ? geoStore.normalizeText(item.name) : '';
    const normCountry = item?.country ? geoStore.normalizeText(item.country) : '';

    if (item) {
      item.status = 'merged';
      item.target_name = targetName;
      item.target_country = targetCountry || '';
      if (item.kind === 'city') {
        const cCountry = targetCountry || item.country || 'السعودية';
        this.addCityToCountry(cCountry, targetName);
      }
      if (item.name && targetName) {
        this.batchUpdateMemberGeo(item.kind, item.name, targetName, targetCountry || item.country, item.country);
      }
    }

    try {
      const raw = this.settings.get('geo_suggestions_list');
      const list1: any[] = raw ? JSON.parse(raw) : [];
      list1.forEach((g: any) => {
        const isMatch = g.id === id || Boolean(item && g.kind === item.kind && geoStore.normalizeText(g.name) === normName && (item.kind !== 'city' || !g.country || !normCountry || geoStore.normalizeText(g.country) === normCountry));
        if (isMatch) {
          g.status = 'merged';
          g.target_name = targetName;
          g.target_country = targetCountry || '';
        }
      });
      this.settings.set('geo_suggestions_list', JSON.stringify(list1));
    } catch {}

    geoStore.rejectPendingCity(id, 'admin', `merged into ${targetName}`, item?.name, item?.country);
    geoStore.deletePendingCity(id, item?.name, item?.country);

    return { ok: true, data: item };
  };
  rejectPendingGeo = (id: string, reason?: string) => {
    const all = this.getPendingGeoSuggestions();
    const item = all.find((g: any) => g.id === id);
    const normName = item?.name ? geoStore.normalizeText(item.name) : '';
    const normCountry = item?.country ? geoStore.normalizeText(item.country) : '';

    try {
      const raw = this.settings.get('geo_suggestions_list');
      const list1: any[] = raw ? JSON.parse(raw) : [];
      list1.forEach((g: any) => {
        const isMatch = g.id === id || Boolean(item && g.kind === item.kind && geoStore.normalizeText(g.name) === normName && (item.kind !== 'city' || !g.country || !normCountry || geoStore.normalizeText(g.country) === normCountry));
        if (isMatch) {
          g.status = 'rejected';
          g.rejection_reason = reason || '';
        }
      });
      this.settings.set('geo_suggestions_list', JSON.stringify(list1));
    } catch {}

    geoStore.rejectPendingCity(id, 'admin', reason, item?.name, item?.country);
    return { ok: true };
  };
  deletePendingGeo = (id: string) => {
    const all = this.getPendingGeoSuggestions();
    const item = all.find((g: any) => g.id === id);
    const normName = item?.name ? geoStore.normalizeText(item.name) : '';
    const normCountry = item?.country ? geoStore.normalizeText(item.country) : '';

    try {
      const raw = this.settings.get('geo_suggestions_list');
      const list1: any[] = raw ? JSON.parse(raw) : [];
      const updated = list1.filter((g: any) => {
        const isMatch = g.id === id || Boolean(item && g.kind === item.kind && geoStore.normalizeText(g.name) === normName && (item.kind !== 'city' || !g.country || !normCountry || geoStore.normalizeText(g.country) === normCountry));
        return !isMatch;
      });
      this.settings.set('geo_suggestions_list', JSON.stringify(updated));
    } catch {}

    geoStore.deletePendingCity(id, item?.name, item?.country);
  };
  addPendingCity = (name: string, country: string, suggestedBy: string, source?: any, suggestedById?: string) => {
    return this.addPendingGeo('city', name, country, suggestedBy, source, suggestedById);
  };
  approvePendingCity = (id: string, reviewer: string, editedName?: string) => this.approvePendingGeo(id, editedName);
  rejectPendingCity = (id: string, reviewer: string, reason?: string) => this.rejectPendingGeo(id, reason);
  deletePendingCity = (id: string) => this.deletePendingGeo(id);
  checkAndRegisterUnknownGeo = (members: any[], source?: any) => geoStore.checkAndRegisterUnknownGeo(members, source);
  exportAllCountries = () => geoStore.exportAllCountries();
  exportCitiesForCountry = (country: string) => geoStore.exportCitiesForCountry(country);
  exportAllGeo = () => geoStore.exportAllGeo();
  importCountries = (json: string, mode?: 'merge' | 'replace') => geoStore.importCountries(json, mode);
  importCitiesForCountry = (country: string, json: string, mode?: 'merge' | 'replace') => geoStore.importCitiesForCountry(country, json, mode);
  importFullGeo = (json: string, mode?: 'merge' | 'replace') => geoStore.importFullGeo(json, mode);
  resetGeoDB = () => geoStore.resetGeoDB();
  refreshGeoDB = () => geoStore.refreshGeoDB();
  ensureGeoLoaded = async (): Promise<void> => { geoStore.refreshGeoDB(); };
}

export type DatabaseProvider = 'local' | 'supabase' | 'appwrite';

export const DATABASE_CONFIG = {
  PROVIDER: 'supabase' as DatabaseProvider,
};
