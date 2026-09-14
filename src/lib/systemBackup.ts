import { dataService } from './data/DataService';
import { getImportOffices, saveImportOffices, getImportBatches, saveImportBatches, ImportOffice, ImportBatch } from './importBatches';
import { getCustomLists, saveCustomLists, CustomMemberList } from './customLists';
import { refreshGeoDB } from './data/adapters/local/geoStore';
import * as XLSX from 'xlsx';
import { IMPORT_COLUMNS, IMPORT_COLUMN_LABELS } from './fieldSchema';

export interface SystemBackupData {
  version: string;
  exportedAt: string;
  appName: string;
  counts: {
    membersCount: number;
    adminMembersCount: number;
    customListsCount: number;
    officesCount: number;
    batchesCount: number;
    transactionsCount: number;
    requestsCount: number;
    eventsCount: number;
    inquiryMessagesCount: number;
    ticketsCount: number;
    reportsCount: number;
    couponsCount: number;
    verificationsCount: number;
    exemptionsCount: number;
  };
  rawStorage?: Record<string, string>;
  data: {
    offices: ImportOffice[];
    batches: ImportBatch[];
    customLists: CustomMemberList[];
    members: any[];
    adminMembers: any[];
    membersMeta: Record<string, any>;
    transactions: any[];
    localDb: {
      requests: any[];
      events: any[];
      inquiryMessages: any[];
      inquiryPackages: any[];
      notifications: any[];
      seq: number;
    };
    interestRequests: any[];
    adminNotifications: any[];
    verifications: Record<string, any>;
    exemptions: any[];
    tickets: any[];
    reports: any[];
    coupons: any[];
    adminUsers: any[];
    plans: any[];
    settings: {
      siteSettings: any;
      socialSettings: any;
      paymentSettings: any;
      paypalSettings: any;
      securitySettings: any;
      interestPurchaseSettings: any;
      messagePackagesSettings: any;
      userDepositQuota: any;
      userExtraInterestsCount: any;
      userUnlimitedInterestsUntil: any;
      otherSettings: Record<string, any>;
    };
    geoData: {
      suggestions: any[];
      nationalities: any[];
      geoDb: any;
    };
    platformOptions?: Record<string, any>;
    customOptions: Record<string, any>;
    rawStorage?: Record<string, string>;
  };
}

/**
 * تصدير جميع بيانات النظام بالكامل إلى ملف JSON
 * يشمل: الأعضاء، القوائم المخصصة، الخطابات والمكاتب، الدفعات، المعاملات المالية، طلبات الاهتمام، الرحلات،
 * رسائل الاستفسار، الدول والمدن، الجنسيات، التوثيق، الإعفاءات، التذاكر، الباقات، والإعدادات بالكامل.
 */
export function createFullSystemBackupData(): SystemBackupData {
  const getSetting = (key: string) => {
    try {
      const val = dataService.db.settings.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  };

  // 1. الخطابات والدفعات والقوائم المخصصة
  const offices = getImportOffices();
  const batches = getImportBatches();
  const customLists = getCustomLists();

  // 2. الأعضاء وأعضاء الإدارة (دمج القوائم لتفادي فقدان أي عضو من أي مفتاح)
  const membersList1 = Array.isArray(getSetting('saved_members_list')) ? getSetting('saved_members_list') : [];
  const membersList2 = Array.isArray(getSetting('twafok_members')) ? getSetting('twafok_members') : [];
  const membersMap = new Map<string, any>();
  membersList1.forEach((m: any) => { if (m && m.id) membersMap.set(String(m.id), m); });
  membersList2.forEach((m: any) => { if (m && m.id && !membersMap.has(String(m.id))) membersMap.set(String(m.id), m); });

  // سحب الأعضاء النشطين المباشرين لضمان عدم فقدان أي عضو أولي في المنصة
  try {
    const live = dataService.db.getLiveMembers ? dataService.db.getLiveMembers(true) : [];
    if (Array.isArray(live)) {
      live.forEach((m: any) => {
        if (m && m.id && !membersMap.has(String(m.id))) {
          membersMap.set(String(m.id), m);
        }
      });
    }
  } catch {}

  const adminMembersRaw = getSetting('saved_admin_members_list');
  const adminMembers = Array.isArray(adminMembersRaw) ? adminMembersRaw : [];
  adminMembers.forEach((m: any) => {
    if (m && m.id && !membersMap.has(String(m.id))) {
      membersMap.set(String(m.id), m);
    }
  });

  const meta1 = getSetting('twafok_members_meta_v4') || {};
  const meta2 = getSetting('twafok_admin_meta_v1') || {};
  const membersMeta = { ...(typeof meta2 === 'object' ? meta2 : {}), ...(typeof meta1 === 'object' ? meta1 : {}) };

  // دمج الملاحظات والتصنيفات والتوثيق والوسام بشكل صريح مع كل عضو
  const members = Array.from(membersMap.values()).map((m: any) => {
    const meta = membersMeta[m.id] || {};
    return {
      ...m,
      adminNotes: m.adminNotes || meta.adminNotes || '',
      coordinationNote: m.coordinationNote || meta.coordinationNote || '',
      customLists: m.customLists || meta.customLists || [],
      verified: m.verified !== undefined ? m.verified : (meta.verified ?? false),
      pinned: m.pinned !== undefined ? m.pinned : (meta.pinned ?? false),
      hasSeriousnessBadge: m.hasSeriousnessBadge !== undefined ? m.hasSeriousnessBadge : (meta.hasSeriousnessBadge ?? false),
      status: m.status || meta.status || 'active',
      plan: m.plan || meta.plan || 'free',
    };
  });

  // 3. المعاملات المالية (دمج السجلات)
  const txList1 = Array.isArray(getSetting('twafok_transactions_v1')) ? getSetting('twafok_transactions_v1') : [];
  const txList2 = Array.isArray(getSetting('twafok_transactions')) ? getSetting('twafok_transactions') : [];
  const txMap = new Map<string, any>();
  txList1.forEach((t: any) => { if (t && t.id) txMap.set(String(t.id), t); });
  txList2.forEach((t: any) => { if (t && t.id && !txMap.has(String(t.id))) txMap.set(String(t.id), t); });
  const transactions = Array.from(txMap.values());

  // 4. قاعدة بيانات الرحلات والاستفسارات (twafok_local_db_v4)
  const localDbRaw = getSetting('twafok_local_db_v4') || {};
  const localDb = {
    requests: Array.isArray(localDbRaw.requests) ? localDbRaw.requests : [],
    events: Array.isArray(localDbRaw.events) ? localDbRaw.events : [],
    inquiryMessages: Array.isArray(localDbRaw.inquiryMessages) ? localDbRaw.inquiryMessages : [],
    inquiryPackages: Array.isArray(localDbRaw.inquiryPackages) ? localDbRaw.inquiryPackages : [],
    notifications: Array.isArray(localDbRaw.notifications) ? localDbRaw.notifications : [],
    seq: typeof localDbRaw.seq === 'number' ? localDbRaw.seq : 1000,
  };

  const interestRequests = getSetting('saved_interest_requests') || [];
  const adminNotifications = getSetting('saved_admin_notifications') || [];

  // 5. السجلات الإدارية
  const verifications = getSetting('twafok_verif_status') || {};
  const exemptions = getSetting('saved_exempt_requests') || [];
  const tickets = getSetting('saved_support_tickets_list') || [];
  const reports = getSetting('saved_member_reports_list') || [];
  const coupons = getSetting('saved_coupons_v1') || [];
  const adminUsers = getSetting('saved_admin_users') || [];
  const plans = getSetting('saved_plans') || [];

  // 6. الإعدادات
  const siteSettings = getSetting('site_settings');
  const socialSettings = getSetting('social_settings');
  const paymentSettings = getSetting('payment_settings');
  const paypalSettings = getSetting('paypal_settings');
  const securitySettings = getSetting('twafok_admin_security_settings_v1');
  const interestPurchaseSettings = getSetting('interest_purchase_settings');
  const messagePackagesSettings = getSetting('saved_message_packages');
  const userDepositQuota = getSetting('user_deposit_quota');
  const userExtraInterestsCount = getSetting('user_extra_interests_count');
  const userUnlimitedInterestsUntil = getSetting('user_unlimited_interests_until');

  // 7. الجغرافية والخيارات المخصصة والمحتوى
  const geoSuggestions = getSetting('geo_suggestions_list') || [];
  const geoNationalities = getSetting('geo_nationalities_list') || [];
  const geoDb = getSetting('twafok_geo_db_v2') || getSetting('twafok_geo_db_v1') || {};

  // جمع خيارات التسجيل المخصصة والكاستم والـ LocalStorage بالكامل
  const customOptions: Record<string, any> = {};
  const platformOptions: Record<string, any> = {};
  const rawStorageDump: Record<string, string> = {};

  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const rawVal = localStorage.getItem(key);
          if (rawVal !== null) {
            rawStorageDump[key] = rawVal;
          }
          if (key.startsWith('twafok_custom_')) {
            customOptions[key] = getSetting(key);
          } else if (key.startsWith('platform_options_')) {
            platformOptions[key] = getSetting(key);
          }
        }
      }
    } catch { /* ignore */ }
  }

  const backup: SystemBackupData = {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    appName: 'توافق — منصة الزواج الشرعي',
    counts: {
      membersCount: Array.isArray(members) ? members.length : 0,
      adminMembersCount: Array.isArray(adminMembers) ? adminMembers.length : 0,
      customListsCount: Array.isArray(customLists) ? customLists.length : 0,
      officesCount: offices.length,
      batchesCount: batches.length,
      transactionsCount: Array.isArray(transactions) ? transactions.length : 0,
      requestsCount: localDb.requests.length,
      eventsCount: localDb.events.length,
      inquiryMessagesCount: localDb.inquiryMessages.length,
      ticketsCount: Array.isArray(tickets) ? tickets.length : 0,
      reportsCount: Array.isArray(reports) ? reports.length : 0,
      couponsCount: Array.isArray(coupons) ? coupons.length : 0,
      verificationsCount: Object.keys(verifications || {}).length,
      exemptionsCount: Array.isArray(exemptions) ? exemptions.length : 0,
    },
    rawStorage: rawStorageDump,
    data: {
      offices,
      batches,
      customLists,
      members: Array.isArray(members) ? members : [],
      adminMembers: Array.isArray(adminMembers) ? adminMembers : [],
      membersMeta: membersMeta || {},
      transactions: Array.isArray(transactions) ? transactions : [],
      localDb,
      interestRequests: Array.isArray(interestRequests) ? interestRequests : [],
      adminNotifications: Array.isArray(adminNotifications) ? adminNotifications : [],
      verifications,
      exemptions: Array.isArray(exemptions) ? exemptions : [],
      tickets: Array.isArray(tickets) ? tickets : [],
      reports: Array.isArray(reports) ? reports : [],
      coupons: Array.isArray(coupons) ? coupons : [],
      adminUsers: Array.isArray(adminUsers) ? adminUsers : [],
      plans: Array.isArray(plans) ? plans : [],
      settings: {
        siteSettings,
        socialSettings,
        paymentSettings,
        paypalSettings,
        securitySettings,
        interestPurchaseSettings,
        messagePackagesSettings,
        userDepositQuota,
        userExtraInterestsCount,
        userUnlimitedInterestsUntil,
        otherSettings: {},
      },
      geoData: {
        suggestions: geoSuggestions,
        nationalities: geoNationalities,
        geoDb,
      },
      platformOptions,
      customOptions,
      rawStorage: rawStorageDump,
    },
  };

  return backup;
}

/**
 * تنزيل النسخة الاحتياطية الشاملة كملف JSON
 */
export function downloadFullSystemBackup(): void {
  const backup = createFullSystemBackupData();
  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `twafok_full_system_backup_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * استيراد نسخة احتياطية شاملة وتحديث جميع بيانات النظام فورياً
 */
export function restoreFullSystemBackup(backupData: any): {
  success: boolean;
  message: string;
  counts?: SystemBackupData['counts'];
} {
  try {
    if (!backupData || typeof backupData !== 'object') {
      return { success: false, message: 'ملف النسخة الاحتياطية غير صالحة' };
    }

    const data = backupData.data || backupData;

    const setSetting = (key: string, val: any) => {
      if (val === undefined || val === null) return;
      const strVal = typeof val === 'string' ? val : JSON.stringify(val);
      dataService.db.settings.set(key, strVal);
    };

    // 0. استعادة التخزين الخام كاملاً إن وُجد
    const rawStorage = backupData.rawStorage || data.rawStorage;
    if (rawStorage && typeof rawStorage === 'object') {
      Object.entries(rawStorage).forEach(([k, v]) => {
        if (typeof v === 'string' && typeof window !== 'undefined') {
          try { localStorage.setItem(k, v); } catch {}
        }
      });
    }

    // إزالة علامة التفريغ إن وجدت لضمان ظهور كافة الأعضاء فوراً
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('members_purged');
        localStorage.removeItem('twafok_members_purged');
      } catch {}
    }

    // 1. استعادة الخطابات والمكاتب
    if (Array.isArray(data.offices)) {
      saveImportOffices(data.offices);
    }

    // 2. استعادة الدفعات
    if (Array.isArray(data.batches)) {
      saveImportBatches(data.batches);
    }

    // 2.1 استعادة القوائم المخصصة
    if (Array.isArray(data.customLists)) {
      saveCustomLists(data.customLists);
      setSetting('twafok_custom_member_lists_v1', data.customLists);
    }

    // 3. استعادة الأعضاء
    if (Array.isArray(data.members) && data.members.length > 0) {
      setSetting('saved_members_list', data.members);
      setSetting('twafok_members', data.members);
    }
    if (Array.isArray(data.adminMembers)) {
      setSetting('saved_admin_members_list', data.adminMembers);
    }
    if (data.membersMeta && typeof data.membersMeta === 'object') {
      setSetting('twafok_members_meta_v4', data.membersMeta);
      setSetting('twafok_admin_meta_v1', data.membersMeta);
    }

    // 4. استعادة المعاملات المالية
    if (Array.isArray(data.transactions)) {
      setSetting('twafok_transactions_v1', data.transactions);
      setSetting('twafok_transactions', data.transactions);
    }

    // 5. استعادة قاعدة البيانات المحلية (الطلبات، الرحلات، الاستفسارات، التنبيهات)
    if (data.localDb && typeof data.localDb === 'object') {
      setSetting('twafok_local_db_v4', data.localDb);
    }
    if (Array.isArray(data.interestRequests)) {
      setSetting('saved_interest_requests', data.interestRequests);
    }
    if (Array.isArray(data.adminNotifications)) {
      setSetting('saved_admin_notifications', data.adminNotifications);
    }

    // 6. السجلات الإدارية
    if (data.verifications) setSetting('twafok_verif_status', data.verifications);
    if (Array.isArray(data.exemptions)) setSetting('saved_exempt_requests', data.exemptions);
    if (Array.isArray(data.tickets)) setSetting('saved_support_tickets_list', data.tickets);
    if (Array.isArray(data.reports)) setSetting('saved_member_reports_list', data.reports);
    if (Array.isArray(data.coupons)) setSetting('saved_coupons_v1', data.coupons);
    if (Array.isArray(data.adminUsers)) setSetting('saved_admin_users', data.adminUsers);
    if (Array.isArray(data.plans)) setSetting('saved_plans', data.plans);

    // 7. الإعدادات
    if (data.settings) {
      const s = data.settings;
      if (s.siteSettings) setSetting('site_settings', s.siteSettings);
      if (s.socialSettings) setSetting('social_settings', s.socialSettings);
      if (s.paymentSettings) setSetting('payment_settings', s.paymentSettings);
      if (s.paypalSettings) setSetting('paypal_settings', s.paypalSettings);
      if (s.securitySettings) setSetting('twafok_admin_security_settings_v1', s.securitySettings);
      if (s.interestPurchaseSettings) setSetting('interest_purchase_settings', s.interestPurchaseSettings);
      if (s.messagePackagesSettings) setSetting('saved_message_packages', s.messagePackagesSettings);
      if (s.userDepositQuota) setSetting('user_deposit_quota', s.userDepositQuota);
      if (s.userExtraInterestsCount) setSetting('user_extra_interests_count', s.userExtraInterestsCount);
      if (s.userUnlimitedInterestsUntil) setSetting('user_unlimited_interests_until', s.userUnlimitedInterestsUntil);
    }

    // 8. البيانات الجغرافية والخيارات المخصصة
    if (data.geoData) {
      if (Array.isArray(data.geoData.suggestions)) setSetting('geo_suggestions_list', data.geoData.suggestions);
      if (Array.isArray(data.geoData.nationalities)) setSetting('geo_nationalities_list', data.geoData.nationalities);
      if (data.geoData.geoDb) {
        setSetting('twafok_geo_db_v2', data.geoData.geoDb);
        setSetting('twafok_geo_db_v1', data.geoData.geoDb);
      }
    }

    if (data.platformOptions && typeof data.platformOptions === 'object') {
      Object.entries(data.platformOptions).forEach(([k, v]) => setSetting(k, v));
    }
    if (data.customOptions && typeof data.customOptions === 'object') {
      Object.entries(data.customOptions).forEach(([k, v]) => setSetting(k, v));
    }

    // إجبار إعادة تحديث ذاكرة GeoStore
    try {
      refreshGeoDB();
    } catch { /* ignore */ }

    // إطلاق أحداث للتطبيق لتحديث الواجهات فورياً
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('twafok_db_restored'));
      window.dispatchEvent(new Event('twafok_custom_lists_updated'));
      window.dispatchEvent(new Event('twafok_import_offices_updated'));
      window.dispatchEvent(new Event('twafok_batches_updated'));
      window.dispatchEvent(new Event('storage'));
    }

    const counts = backupData.counts || {
      membersCount: Array.isArray(data.members) ? data.members.length : 0,
      adminMembersCount: Array.isArray(data.adminMembers) ? data.adminMembers.length : 0,
      customListsCount: Array.isArray(data.customLists) ? data.customLists.length : (Array.isArray(data.members) ? 1 : 0),
      officesCount: Array.isArray(data.offices) ? data.offices.length : 0,
      batchesCount: Array.isArray(data.batches) ? data.batches.length : 0,
      transactionsCount: Array.isArray(data.transactions) ? data.transactions.length : 0,
      requestsCount: data.localDb?.requests?.length || 0,
      eventsCount: data.localDb?.events?.length || 0,
      inquiryMessagesCount: data.localDb?.inquiryMessages?.length || 0,
      ticketsCount: Array.isArray(data.tickets) ? data.tickets.length : 0,
      reportsCount: Array.isArray(data.reports) ? data.reports.length : 0,
      couponsCount: Array.isArray(data.coupons) ? data.coupons.length : 0,
      verificationsCount: Object.keys(data.verifications || {}).length,
      exemptionsCount: Array.isArray(data.exemptions) ? data.exemptions.length : 0,
    };

    return {
      success: true,
      message: 'تمت استعادة جميع بيانات وإعدادات النظام بالكامل بنجاح ✓',
      counts,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `حدث خطأ أثناء استعادة النسخة الاحتياطية: ${err?.message || 'خطأ غير معروف'}`,
    };
  }
}

/**
 * تصدير الأعضاء مع كافة تفاصيلهم (أسماء الخطابات، الدفعات، الماليات، البيانات الشخصية والإدارية)
 */
export function exportMembersWithFullDetails(
  members: any[],
  format: 'csv' | 'json' = 'csv',
  filenamePrefix: string = 'twafok_members'
): void {
  const dateStr = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    const jsonStr = JSON.stringify(members, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}_full_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // تصدير CSV شامل مع كل حقول المنصة والشريك والإدارة
  const headers = [
    'معرّف العضو',
    'الاسم المستعار',
    'الاسم الحقيقي',
    'اسم الخطابة / المكتب',
    'هاتف الخطابة / المكتب',
    'رقم الدفعة',
    'تاريخ الاستيراد',
    'تفاصيل الدفعة',
    'البريد الإلكتروني',
    'كلمة المرور',
    'رقم الهاتف',
    'رقم الواتساب',
    'رقم الهوية',
    'الجنس',
    'العمر',
    'تاريخ الميلاد',
    'الجنسية',
    'الدولة',
    'المدينة',
    'الحي',
    'القبيلة / النسب',
    'المذهب',
    'الحالة الاجتماعية',
    'نوع الزواج',
    'عدد الأبناء',
    'مكان إقامة الأبناء',
    'عدد الزوجات',
    'رغبة التعدد',
    'الطول',
    'الوزن',
    'لون البشرة',
    'العرق',
    'المستوى التعليمي',
    'نوع العمل',
    'المسمى الوظيفي',
    'السكن',
    'التدخين',
    'الحالة الصحية',
    'تقبل التعدد',
    'قبول المطلق/ة',
    'قبول بأبناء',
    'قبول غير مواطن / أجنبي',
    'دولة الشريك المطلوبة',
    'جنسية الشريك المطلوبة',
    'المدن المقبولة للشريك',
    'عمر الشريك (من)',
    'عمر الشريك (إلى)',
    'حالة الشريك الاجتماعية المطلوبة',
    'القوائم المخصصة',
    'الباقة',
    'الحالة',
    'موثق',
    'سداد الجدية',
    'تاريخ سداد الجدية',
    'وسام الجدية',
    'نبذة عن النفس',
    'مواصفات الشريك المطلوب',
    'ملاحظات الإدارة',
    'تاريخ الانضمام',
  ];

  const clean = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = members.map((m) => [
    clean(m.id),
    clean(m.nickname || m.username),
    clean(m.realName || m.real_name),
    clean(m.officeName || m.office_name || m.khataabaName),
    clean(m.khataabaPhone || m.khataaba_phone),
    clean(m.batchNumber || m.batch_number || m.batchId),
    clean(m.importDate || m.import_date),
    clean(m.importNotes || m.import_notes || m.notes),
    clean(m.email),
    clean(m.password || m.pass || ''),
    clean(m.phone),
    clean(m.whatsapp),
    clean(m.nationalId || m.national_id),
    clean(m.gender === 'male' ? 'ذكر' : m.gender === 'female' ? 'أنثى' : m.gender),
    clean(m.age),
    clean(m.birthDate || m.birth_date),
    clean(m.nationality),
    clean(m.country),
    clean(m.city),
    clean(m.district),
    clean(m.tribe),
    clean(m.sect),
    clean(m.maritalLabel || m.maritalStatus || m.marital_status),
    clean(m.marriageTypeLabel || m.marriageType || m.marriage_type),
    clean(m.childrenCount || m.children_count),
    clean(m.childrenLiveWith || m.children_live_with),
    clean(m.wifeCount || m.wife_count),
    clean(m.seekingWife || m.seeking_wife),
    clean(m.height),
    clean(m.weight),
    clean(m.skinColor || m.skin_color),
    clean(m.ethnicity),
    clean(m.education),
    clean(m.workType || m.work_type),
    clean(m.jobTitle || m.job_title),
    clean(m.housing),
    clean(m.smoking),
    clean(m.health),
    clean(m.acceptPolygamy || m.accept_polygamy ? 'نعم' : 'لا'),
    clean(m.acceptDivorced || m.accept_divorced ? 'نعم' : 'لا'),
    clean(m.acceptWithChildren || m.accept_with_children ? 'نعم' : 'لا'),
    clean(m.acceptForeigner || m.accept_foreigner || 'لا'),
    clean(m.pCountry || m.partner_country),
    clean(m.pNationality || m.partner_nationality),
    clean(m.pCity || m.partner_city || m.partner_cities),
    clean(m.pAgeMin || m.partner_age_min),
    clean(m.pAgeMax || m.partner_age_max),
    clean(m.pMaritalStatus || m.partner_marital_status),
    clean(Array.isArray(m.customLists) ? m.customLists.join(', ') : (m.customList || '')),
    clean(m.plan),
    clean(m.status),
    clean(m.verified ? 'نعم' : 'لا'),
    clean(m.paid || m.deposit_paid ? 'نعم' : 'لا'),
    clean(m.paidAt || m.paid_at),
    clean(m.hasSeriousnessBadge ? 'نعم' : 'لا'),
    clean(m.bio),
    clean(m.pNotes || m.p_notes),
    clean(m.adminNotes || m.admin_notes),
    clean(m.joinedAt || m.createdAt || m.created_at),
  ]);

  const csvContent = '\uFEFF' + [headers.map(clean).join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_full_${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * تصدير الأعضاء إلى ملف Excel (.xlsx) احترافي وشامل
 */
export function exportMembersToExcel(
  members: any[],
  filenamePrefix = 'members',
  mode: 'full' | 'import_template' = 'full'
) {
  const dateStr = new Date().toISOString().split('T')[0];

  if (mode === 'import_template') {
    // تصدير متوافق 100% مع نموذج الاستيراد (IMPORT_COLUMNS)
    const headerKeys = IMPORT_COLUMNS;
    const headerLabels = IMPORT_COLUMNS.map(c => IMPORT_COLUMN_LABELS[c] || c);

    const dataRows = members.map(m => {
      return [
        m.gender === 'male' ? 'ذكر' : m.gender === 'female' ? 'أنثى' : (m.gender || ''),
        m.age || '',
        m.marriageTypeLabel || m.marriageType || 'معلن',
        m.tribe || '',
        m.nationality || '',
        m.country || 'السعودية',
        m.city || '',
        m.maritalLabel || m.maritalStatus || '',
        m.sect || '',
        m.height || '',
        m.weight || '',
        m.skinColor || '',
        m.education || '',
        m.workType || '',
        m.jobTitle || '',
        m.housing || '',
        m.pNationality || m.partner_nationality || '',
        m.pCity || m.partner_city || m.partner_cities || '',
        m.pAgeMin || m.partner_age_min || '',
        m.pAgeMax || m.partner_age_max || '',
        m.acceptForeigner || m.accept_foreigner || 'لا',
        m.whatsapp || m.phone || '',
        m.password || m.pass || '',
        m.bio || '',
        m.pNotes || m.p_notes || '',
        m.adminNotes || m.admin_notes || '',
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headerKeys, headerLabels, ...dataRows]);
    // تنسيق اتجاه اليمين لليسار
    worksheet['!dir'] = 'rtl';
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الأعضاء المستوردون');
    XLSX.writeFile(workbook, `${filenamePrefix}_import_template_${dateStr}.xlsx`);
    return;
  }

  // تصدير تفصيلي كامل
  const headers = [
    'معرّف العضو', 'الاسم المستعار', 'الاسم الحقيقي', 'اسم الخطابة / المكتب', 'هاتف الخطابة',
    'رقم الدفعة', 'تاريخ الاستيراد', 'تفاصيل الدفعة', 'البريد', 'كلمة المرور', 'رقم الهاتف', 'رقم الواتساب',
    'رقم الهوية', 'الجنس', 'العمر', 'الجنسية', 'الدولة', 'المدينة', 'الحي', 'القبيلة / النسب', 'المذهب',
    'الحالة الاجتماعية', 'نوع الزواج', 'عدد الأبناء', 'مكان إقامة الأبناء', 'عدد الزوجات', 'رغبة التعدد',
    'الطول', 'الوزن', 'لون البشرة', 'العرق', 'المستوى التعليمي', 'نوع العمل', 'المسمى الوظيفي',
    'السكن', 'التدخين', 'الحالة الصحية', 'تقبل التعدد', 'قبول غير مواطن / أجنبي',
    'دولة الشريك', 'جنسية الشريك', 'مدن الشريك المقبولة', 'عمر الشريك الأدنى', 'عمر الشريك الأعلى',
    'حالة الشريك الاجتماعية', 'القوائم المخصصة', 'الباقة', 'الحالة', 'موثق', 'سداد الجدية',
    'نبذة عن النفس', 'مواصفات الشريك', 'ملاحظات الإدارة', 'تاريخ الانضمام'
  ];

  const rows = members.map(m => [
    m.id || '',
    m.nickname || m.username || '',
    m.realName || m.real_name || '',
    m.officeName || m.office_name || m.khataabaName || '',
    m.khataabaPhone || m.khataaba_phone || '',
    m.batchNumber || m.batch_number || m.batchId || '',
    m.importDate || m.import_date || '',
    m.importNotes || m.import_notes || m.notes || '',
    m.email || '',
    m.password || m.pass || '',
    m.phone || '',
    m.whatsapp || '',
    m.nationalId || m.national_id || '',
    m.gender === 'male' ? 'ذكر' : m.gender === 'female' ? 'أنثى' : (m.gender || ''),
    m.age || '',
    m.nationality || '',
    m.country || '',
    m.city || '',
    m.district || '',
    m.tribe || '',
    m.sect || '',
    m.maritalLabel || m.maritalStatus || '',
    m.marriageTypeLabel || m.marriageType || '',
    m.childrenCount || m.children_count || '',
    m.childrenLiveWith || m.children_live_with || '',
    m.wifeCount || m.wife_count || '',
    m.seekingWife || m.seeking_wife || '',
    m.height || '',
    m.weight || '',
    m.skinColor || m.skin_color || '',
    m.ethnicity || '',
    m.education || '',
    m.workType || m.work_type || '',
    m.jobTitle || m.job_title || '',
    m.housing || '',
    m.smoking || '',
    m.health || '',
    m.acceptPolygamy || m.accept_polygamy ? 'نعم' : 'لا',
    m.acceptForeigner || m.accept_foreigner || 'لا',
    m.pCountry || m.partner_country || '',
    m.pNationality || m.partner_nationality || '',
    m.pCity || m.partner_city || m.partner_cities || '',
    m.pAgeMin || m.partner_age_min || '',
    m.pAgeMax || m.partner_age_max || '',
    m.pMaritalStatus || m.partner_marital_status || '',
    Array.isArray(m.customLists) ? m.customLists.join(', ') : (m.customList || ''),
    m.plan || '',
    m.status || '',
    m.verified ? 'نعم' : 'لا',
    m.paid || m.deposit_paid ? 'نعم' : 'لا',
    m.bio || '',
    m.pNotes || m.p_notes || '',
    m.adminNotes || m.admin_notes || '',
    m.joinedAt || m.createdAt || m.created_at || '',
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!dir'] = 'rtl';
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'قائمة الأعضاء');
  XLSX.writeFile(workbook, `${filenamePrefix}_detailed_${dateStr}.xlsx`);
}

/**
 * تصدير الأعضاء بصيغة CSV المتوافقة تماماً مع نموذج الاستيراد لإعادة الاستيراد المباشر
 */
export function exportMembersForImportTemplate(members: any[], filenamePrefix = 'members_import_ready') {
  const dateStr = new Date().toISOString().split('T')[0];
  const headers = IMPORT_COLUMNS.join(',');
  const clean = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = members.map(m => [
    clean(m.gender === 'male' ? 'ذكر' : m.gender === 'female' ? 'أنثى' : m.gender),
    clean(m.age),
    clean(m.marriageTypeLabel || m.marriageType || 'معلن'),
    clean(m.tribe),
    clean(m.nationality),
    clean(m.country || 'السعودية'),
    clean(m.city),
    clean(m.maritalLabel || m.maritalStatus),
    clean(m.sect),
    clean(m.height),
    clean(m.weight),
    clean(m.skinColor || m.skin_color),
    clean(m.education),
    clean(m.workType || m.work_type),
    clean(m.jobTitle || m.job_title),
    clean(m.housing),
    clean(m.pNationality || m.partner_nationality),
    clean(m.pCity || m.partner_city || m.partner_cities),
    clean(m.pAgeMin || m.partner_age_min),
    clean(m.pAgeMax || m.partner_age_max),
    clean(m.acceptForeigner || m.accept_foreigner || 'لا'),
    clean(m.whatsapp || m.phone),
    clean(m.password || m.pass),
    clean(m.bio),
    clean(m.pNotes || m.p_notes),
    clean(m.adminNotes || m.admin_notes),
  ]);

  const csvContent = '\uFEFF' + [headers, ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * تحميل قالب Excel فارغ وموجه للخطابات والوسطاء لتعبئته
 */
export function exportKhataabaBlankTemplateToExcel(filename = 'khataaba_import_template.xlsx') {
  const headers = [
    'الجنس',
    'العمر',
    'نوع الزواج',
    'القبيلة / النسب',
    'الجنسية',
    'الدولة',
    'المدينة',
    'الحالة الاجتماعية',
    'المذهب',
    'الطول',
    'الوزن',
    'لون البشرة',
    'المؤهل التعليمي',
    'نوع العمل',
    'المسمى الوظيفي',
    'السكن',
    'جنسية الشريك المطلوبة',
    'مدن الشريك المطلوبة',
    'عمر الشريك من',
    'عمر الشريك إلى',
    'قبول غير مواطن / أجنبي',
    'رقم الواتساب / الجوال',
    'اسم الخطابة / الوسيطة',
    'رقم هاتف الخطابة',
    'نبذة عن النفس والمواصفات',
    'مواصفات الشريك المطلوبة',
    'ملاحظات الإدارة والاتفاق المالي',
  ];

  const exampleRow = [
    'أنثى',
    '28',
    'معلن',
    'قحطان',
    'سعودية',
    'السعودية',
    'الرياض',
    'عزباء',
    'سني',
    '162',
    '58',
    'حنطي فاتح',
    'جامعي',
    'قطاع خاص',
    'أخصائية تسويق',
    'مع الأهل',
    'سعودي',
    'الرياض، الخرج',
    '29',
    '36',
    'لا',
    '0501234567',
    'أم خالد',
    '0559876543',
    'محافظة، هادئة، تخاف الله',
    'رجل كفء ومحترم يقدر الحياة الزوجية',
    'سعي الخطابة 2000 ريال عند كتب الكتاب',
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  worksheet['!dir'] = 'rtl';
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج بيانات الخطابات');
  XLSX.writeFile(workbook, filename);
}


