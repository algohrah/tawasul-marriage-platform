// ============================================================
//  واجهات طبقة البيانات الموحّدة — Single Source Data Architecture
//  كل وصول للبيانات يمر عبر DataService → Adapter → Storage
// ============================================================

export interface IRepository<T> {
  getAll(): Promise<T[]>;
  getById(id: string | number): Promise<T | null>;
  create(item: T): Promise<T>;
  update(id: string | number, item: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<boolean>;
}

/**
 * مستودع الإعدادات — مخزن key/value عام.
 * يُسخدم لجميع البيانات التي لا تحتاج جداول مستقلة (إعدادات، عدادات، حالات UI).
 */
export interface ISettingsRepository {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface IDatabaseAdapter {
  members: IRepository<any>;
  requests: IRepository<any>;
  transactions: IRepository<any>;
  tickets: IRepository<any>;
  adminUsers: IRepository<any>;
  /** مستودع الإعدادات العام — المصدر الوحيد للتخزين key/value */
  settings: ISettingsRepository;

  // ===== الأعضاء (Members) =====
  getMembers(): Promise<any[]>;
  getLiveMembers(includeInactiveAndDeleted?: boolean): any[];
  getLiveMemberById(id: string): any | undefined;
  getCurrentUserId(): string;
  setCurrentUserId(id: string): void;
  hasUserPaidDepositAnywhere(userId: string): boolean;

  // ===== الطلبات والرحلات (Requests & Journeys) =====
  getRequests(userId?: string): Promise<any[]>;
  getRequest(id: number): Promise<any | null>;
  createRequest(senderId: string, receiverId: string, message: string): Promise<any>;
  runRequestAction(requestId: number, action: string, actorId: string, payload?: any): Promise<any>;
  getEvents(requestId: number): Promise<any[]>;
  isRequestUnseen(requestId: number, updatedAt?: string | null): boolean;
  markRequestSeen(requestId: number): void;
  markRequestNotificationsRead(requestId: number, userId?: string): void;

  // ===== غرفة الاستفسار (Inquiry room messaging) =====
  getUserInquiryBalance(userId: string): number;
  consumeUserInquiryMessage(userId: string): boolean;
  getInquiry(requestId: number): Promise<any>;
  initializeInquiry(requestId: number, userId: string): Promise<any>;
  buyInquiry(requestId: number, ownerId: string): Promise<any>;
  buyMessagePackageCustom(userId: string, credits: number, price: number, requestId?: number, skipTransactionRecord?: boolean): Promise<any>;
  sendInquiry(requestId: number, senderId: string, text: string): Promise<any>;
  simulateReply(requestId: number, replierId: string, text: string): Promise<any>;
  getAllInquiryMessages(): any[];
  moderateInquiryMessage(messageId: number, action: 'approve' | 'reject', moderatorName: string): boolean;
  updateInquiryMessage(messageId: number, newText: string): boolean;
  deleteInquiryMessage(messageId: number): boolean;

  // ===== الإشعارات (Journey Notifications) =====
  getJourneyNotifications(userId: string): Promise<any[]>;
  markNotificationRead(id: number): void;
  markAllNotificationsRead(userId: string): void;
  getUnreadNotificationsCount(userId: string): number | Promise<number>;
  getActionableRequestsCount(userId: string): Promise<number>;
  deleteNotification(id: number): void;

  // ===== لوحة الإدارة (Admin Panel Operations) =====
  adminGetMembers(): Promise<any[]>;
  adminUpdateMember(id: string, fields: any): Promise<boolean>;
  adminBulkDeleteMembers(ids: string[]): Promise<boolean>;
  adminBulkUpdateStatus(ids: string[], status: any, reason?: string, by?: string): Promise<boolean>;
  adminBulkSetVerified(ids: string[], value: boolean): Promise<boolean>;
  adminBulkSetPinned(ids: string[], value: boolean): Promise<boolean>;
  adminBulkSetPlan(ids: string[], plan: 'free' | 'gold' | 'elite'): Promise<boolean>;
  adminBulkSetSeriousnessBadge(ids: string[], value: boolean): Promise<boolean>;
  adminDeleteMember(id: string): Promise<boolean>;
  adminHardDeleteMember(id: string): Promise<boolean>;
  adminResetPassword(id: string): Promise<string>;
  adminToggleVerified(id: string, value: boolean): Promise<boolean>;
  adminSetPremium(id: string, value: boolean): Promise<boolean>;
  adminSetNote(id: string, note: string): Promise<boolean>;
  adminToggleFlag(id: string, value: boolean): Promise<boolean>;
  adminSendNotification(id: string, text: string, title?: string): Promise<boolean>;
  adminSendBulkNotifications(userIds: string[], text: string, title?: string): Promise<boolean>;
  adminDeleteRequest(requestId: number): Promise<boolean>;
  adminGrantSeriousnessBadge(id: string): Promise<boolean>;
  adminRevokeSeriousnessBadge(id: string): Promise<boolean>;
  adminGetRequests(): Promise<any[]>;
  adminGetStats(): Promise<any>;
  adminGetRequestPayments(requestId: number): Promise<any[]>;
  adminApplyExemption(memberId: string, type: 'deposit' | 'badge', value: number | boolean, memberName?: string): Promise<boolean>;

  // ===== الكوبونات والمعاملات المالية (Coupons & Transactions) =====
  getCoupons(): any[];
  saveCoupon(coupon: any): void;
  deleteCoupon(code: string): void;
  toggleCouponActive(code: string): void;
  getTransactions(): any[];
  recordTransaction(tx: any): void;
  validateCoupon(code: string, amount?: number): any;
  useCoupon(code: string): boolean;
  resetLocalDB(): void;

  // ===== مستندات التوثيق (Verification documents) =====
  submitVerificationDoc(doc: any): any;
  getAllVerificationDocs(): any[];
  getMemberVerificationDoc(memberId: string): any | null;
  getVerificationStatus(memberId: string): any;
  approveVerificationDoc(docId: string, reviewerName: string): boolean;
  rejectVerificationDoc(docId: string, reviewerName: string, reason: string): boolean;
  deleteVerificationDoc(docId: string): boolean;
  deleteReviewedDocs(): number;
  downloadDocImage(doc: any): void;
  downloadAllPendingDocs(): number;

  // ===== خيارات التسجيل وقاعدة البيانات =====
  getSects(): string[];
  getRegistrationOptions(key: string): any[];
  updateRegistrationOptions(key: string, values: any[]): void;

  // ===== المدن والدول (Geo Store - Cities & Countries) =====
  normalizeText(s: string): string;
  getCountries(): any[];
  getCountryNames(): string[];
  getNationalities(): string[];
  addNationality(name: string, country?: string, gender?: string): any;
  removeNationality(name: string): void;
  renameNationality(oldName: string, newName: string): any;
  isNationalityKnown(name: string): boolean;
  addCountry(name: string, code?: string, flag?: string): any;
  removeCountry(name: string): void;
  renameCountry(oldName: string, newName: string): any;
  getCities(country: string): string[];
  addCityToCountry(country: string, city: string): any;
  removeCityFromCountry(country: string, city: string): void;
  renameCity(country: string, oldName: string, newName: string): any;
  adminMergeCities(sourceCountry: string, sourceCity: string, targetCountry: string, targetCity: string): any;
  adminMergeCountries(sourceCountry: string, targetCountry: string): any;
  batchUpdateMemberGeo(kind: 'country' | 'city' | 'nationality' | 'skinColor' | 'education' | 'workType', oldValue: string, newValue: string, targetCountry?: string, sourceCountryFilter?: string): { updatedCount: number };
  isCityKnown(country: string, city: string): boolean;
  isCountryKnown(country: string): boolean;
  getPendingCities(): any[];
  getAllPendingCities(): any[];
  getPendingCitiesCount(): number;
  getPendingGeoSuggestions(): any[];
  getPendingGeoSuggestionsCount(): number;
  addPendingGeo(kind: 'country' | 'city' | 'nationality', name: string, country?: string, suggestedBy?: string, source?: string, suggestedById?: string): any;
  approvePendingGeo(id: string, editedName?: string): any;
  mergePendingGeo(id: string, targetName: string, targetCountry?: string): any;
  rejectPendingGeo(id: string, reason?: string): any;
  deletePendingGeo(id: string): void;
  addPendingCity(name: string, country: string, suggestedBy: string, source?: string, suggestedById?: string): any;
  approvePendingCity(id: string, reviewer: string, editedName?: string): any;
  rejectPendingCity(id: string, reviewer: string, reason?: string): any;
  deletePendingCity(id: string): void;
  checkAndRegisterUnknownGeo(members: any[], source?: string): any;
  exportAllCountries(): string;
  exportCitiesForCountry(country: string): string;
  exportAllGeo(): string;
  importCountries(json: string, mode?: 'merge' | 'replace'): any;
  importCitiesForCountry(country: string, json: string, mode?: 'merge' | 'replace'): any;
  importFullGeo(json: string, mode?: 'merge' | 'replace'): any;
  resetGeoDB(): void;
  refreshGeoDB(): void;
  ensureGeoLoaded?(): Promise<void>;
}
