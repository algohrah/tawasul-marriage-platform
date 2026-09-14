import { dataService } from './data/DataService';
import { normalizeNationality, normalizeCountry, normalizeMarriageType, getMarriageTypeDisplayLabel } from './data/optionNormalizer';
// ====================================================================
//  نظام الخطابات والدفعات — إدارة أسماء الخطابات وعمليات الاستيراد
//  جميع البيانات تُخزن في localStorage
// ====================================================================

// ===== أنواع البيانات =====

export interface ImportOffice {
  id: string;
  name: string;           // اسم الخطابة أو المكتب
  createdAt: string;      // تاريخ الإنشاء
  usageCount: number;     // عدد مرات الاستخدام
  lastUsedAt?: string;    // آخر استخدام
  notes?: string;         // ملاحظات
}

export interface ImportBatch {
  id: string;
  batchNumber: string;    // رقم الدفعة (مثال: IMP-001)
  officeId?: string;      // معرف الخطابة (اختياري)
  officeName?: string;    // اسم الخطابة (للعرض)
  importDate: string;     // تاريخ الاستيراد
  membersCount: number;   // عدد الأعضاء المستوردين
  duplicatesCount: number;// عدد المكررات
  skippedCount: number;   // عدد السجلات المتجاهلة
  errorsCount: number;    // عدد الأخطاء
  notes?: string;         // ملاحظات الاستيراد
  sourceType: 'csv' | 'paste' | 'api';  // طريقة الاستيراد
  createdAt: string;
}

export interface ImportReport {
  batchId: string;
  totalRows: number;      // إجمالي الصفوف في الملف
  importedCount: number;  // تم استيرادهم
  duplicatesCount: number;// مكررات
  skippedCount: number;   // متجاهلة
  errorsCount: number;    // أخطاء
  errors: ImportError[];  // تفاصيل الأخطاء
  warnings: ImportWarning[]; // التحذيرات
  officeName?: string;
  batchNumber?: string;
  importDate?: string;
}

export interface ImportError {
  row: number;            // رقم الصف
  field?: string;         // الحقل المشكل
  message: string;        // رسالة الخطأ
  value?: any;            // القيمة المشكلة
}

export interface ImportWarning {
  row: number;
  field?: string;
  message: string;
}

export type KhataabaStatus = 'active' | 'warning' | 'blocked';

export interface KhataabaRecord {
  id: string;
  phone: string;           // رقم الواتساب/الهاتف الفريد للخطابة
  name: string;            // الاسم المخصص للخطابة
  status: KhataabaStatus;  // حالة الخطابة: نشطة / تحت التحذير / محظورة
  notes?: string;          // ملاحظات الإدارة الخاصة
  offices?: string[];      // أسماء القروبات والمكاتب التابعة لها
  createdAt: string;
  updatedAt: string;
}

// ===== ثوابت =====

const STORAGE_KEYS = {
  offices: 'import_offices_list',
  batches: 'import_batches_list',
  khataabas: 'twafok_khataaba_directory_v1',
};

// ===== دوال دليل الخطابات وحظرها =====

export function getKhataabaDirectory(): KhataabaRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = dataService.db.settings.get(STORAGE_KEYS.khataabas);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

export function saveKhataabaDirectory(records: KhataabaRecord[]): void {
  if (typeof window === 'undefined') return;
  dataService.db.settings.set(STORAGE_KEYS.khataabas, JSON.stringify(records));
}

export function getKhataabaByPhone(phone: string): KhataabaRecord | undefined {
  if (!phone) return undefined;
  const clean = phone.replace(/[^\d]/g, '');
  if (!clean) return undefined;
  return getKhataabaDirectory().find((k) => k.phone.replace(/[^\d]/g, '') === clean);
}

export function getKhataabaByName(name: string): KhataabaRecord | undefined {
  if (!name) return undefined;
  const clean = name.trim().toLowerCase();
  return getKhataabaDirectory().find((k) => k.name.trim().toLowerCase() === clean);
}

export function upsertKhataabaRecord(data: {
  phone: string;
  name?: string;
  officeName?: string;
  status?: KhataabaStatus;
  notes?: string;
}): KhataabaRecord {
  const records = getKhataabaDirectory();
  const cleanPhone = (data.phone || '').trim();
  const existingIndex = records.findIndex(
    (k) => (cleanPhone && k.phone.replace(/[^\d]/g, '') === cleanPhone.replace(/[^\d]/g, '')) ||
           (data.name && k.name.trim().toLowerCase() === data.name.trim().toLowerCase())
  );

  const now = new Date().toISOString();
  if (existingIndex !== -1) {
    const existing = records[existingIndex];
    const updatedOffices = Array.from(
      new Set([...(existing.offices || []), ...(data.officeName ? [data.officeName] : [])])
    );
    records[existingIndex] = {
      ...existing,
      phone: cleanPhone || existing.phone,
      name: (data.name && data.name.trim() !== existing.phone) ? data.name.trim() : existing.name,
      status: data.status || existing.status,
      notes: data.notes !== undefined ? data.notes.trim() : existing.notes,
      offices: updatedOffices,
      updatedAt: now,
    };
    saveKhataabaDirectory(records);
    return records[existingIndex];
  } else {
    // إن لم يحدد الاسم صراحة، يكون الاسم الافتراضي هو رقم الهاتف بنفسه
    const defaultName = data.name?.trim() || cleanPhone || 'خطابة غير معرفة';
    const newRecord: KhataabaRecord = {
      id: 'khat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7),
      phone: cleanPhone || 'بدون رقم',
      name: defaultName,
      status: data.status || 'active',
      notes: data.notes?.trim() || '',
      offices: data.officeName ? [data.officeName] : [],
      createdAt: now,
      updatedAt: now,
    };
    records.push(newRecord);
    saveKhataabaDirectory(records);
    return newRecord;
  }
}

/** توحيد صيغة رقم الهاتف للمطابقة المرنة (الاستفادة من آخر 9 أرقام لتجاوز اختلافات مفاتيح الدول 05/966/+) */
export function normalizePhoneForMatching(phone?: string): string {
  if (!phone) return '';
  const digits = phone.toString().replace(/[^\d]/g, '');
  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
}

/** التحقق مما إذا كان العضو ينتمي لخطابة محددة مع مطابقة مرنة تشمل الرقم والاسم والملاحظات */
export function doesMemberBelongToKhataaba(m: any, k: KhataabaRecord): boolean {
  if (!m || !k) return false;

  const kPhoneNorm = normalizePhoneForMatching(k.phone);
  const kNameClean = (k.name || '').trim().toLowerCase();

  // 1. المطابقة المباشرة في حقل رقم الخطابة للعضو
  const mKPhoneNorm = normalizePhoneForMatching(m.khataabaPhone);
  if (kPhoneNorm && mKPhoneNorm && kPhoneNorm === mKPhoneNorm) {
    return true;
  }

  // 2. المطابقة في اسم الخطابة
  const mKNameClean = (m.khataabaName || '').trim().toLowerCase();
  if (kNameClean && mKNameClean && (kNameClean === mKNameClean || (kNameClean !== kPhoneNorm && mKNameClean.includes(kNameClean)))) {
    return true;
  }

  // 3. البحث في ملاحظات الاستيراد والملاحظات الإدارية عن رقم الخطابة
  if (kPhoneNorm && kPhoneNorm.length >= 7) {
    const combinedNotes = `${m.importNotes || ''} ${m.adminNote || ''} ${m.importOfficeName || ''}`;
    const cleanNotesDigits = combinedNotes.replace(/[^\d]/g, '');
    if (cleanNotesDigits.includes(kPhoneNorm)) {
      return true;
    }
  }

  // 4. البحث في الملاحظات عن اسم الخطابة إن كان اسم كستوم
  if (kNameClean && kNameClean !== (k.phone || '').trim().toLowerCase() && kNameClean.length >= 3) {
    const combinedNotes = `${m.importNotes || ''} ${m.adminNote || ''} ${m.importOfficeName || ''}`;
    if (combinedNotes.toLowerCase().includes(kNameClean)) {
      return true;
    }
  }

  return false;
}

/** التحقق مما إذا كان العضو ينتمي لمكتب/قروب محدد */
export function doesMemberBelongToOffice(m: any, officeName: string, khataabas?: KhataabaRecord[]): boolean {
  if (!m || !officeName) return false;
  const targetOff = officeName.trim().toLowerCase();

  if ((m.importOfficeName || '').trim().toLowerCase() === targetOff) {
    return true;
  }

  const combinedNotes = `${m.importNotes || ''} ${m.adminNote || ''}`;
  if (combinedNotes.toLowerCase().includes(targetOff)) {
    return true;
  }

  if (Array.isArray(khataabas)) {
    const matchedK = khataabas.find((k) => doesMemberBelongToKhataaba(m, k));
    if (matchedK && matchedK.offices && matchedK.offices.some((o) => o.trim().toLowerCase() === targetOff)) {
      return true;
    }
  }

  return false;
}

/** تزامن واستخراج تلقائي لجميع الخطابات والمكاتب من قائمة الأعضاء بالموقع */
export function syncKhataabasFromMembers(membersList: any[]): KhataabaRecord[] {
  if (!Array.isArray(membersList) || membersList.length === 0) {
    return getKhataabaDirectory();
  }

  membersList.forEach((m) => {
    let kPhone = (m.khataabaPhone || '').trim();
    let kName = (m.khataabaName || '').trim();
    const officeName = (m.importOfficeName || '').trim();

    if (!kPhone) {
      const notes = `${m.importNotes || ''} ${m.adminNote || ''}`;
      const phoneMatch = notes.match(/(?:05|9665|\+9665)\d{8}/);
      if (phoneMatch) {
        kPhone = phoneMatch[0];
      }
    }

    if (kPhone || kName || officeName) {
      const displayName = kName || kPhone || (officeName ? `خطابة (${officeName})` : '');
      if (kPhone || displayName) {
        upsertKhataabaRecord({
          phone: kPhone || kName,
          name: displayName,
          officeName: officeName || undefined,
        });
      }
    }

    if (officeName) {
      addImportOffice(officeName);
    }
  });

  return getKhataabaDirectory();
}

export function updateKhataabaStatus(idOrPhone: string, status: KhataabaStatus, notes?: string, name?: string): void {
  const records = getKhataabaDirectory();
  const idx = records.findIndex(
    (k) => k.id === idOrPhone || k.phone.replace(/[^\d]/g, '') === idOrPhone.replace(/[^\d]/g, '')
  );
  if (idx !== -1) {
    records[idx].status = status;
    if (notes !== undefined) records[idx].notes = notes;
    if (name) records[idx].name = name;
    records[idx].updatedAt = new Date().toISOString();
    saveKhataabaDirectory(records);
  }
}

export function deleteKhataabaRecord(id: string): void {
  const records = getKhataabaDirectory().filter((k) => k.id !== id);
  saveKhataabaDirectory(records);
}

export function isKhataabaBlocked(phoneOrName: string): { blocked: boolean; khataaba?: KhataabaRecord } {
  if (!phoneOrName) return { blocked: false };
  const cleanPhone = phoneOrName.replace(/[^\d]/g, '');
  const rec = getKhataabaDirectory().find(
    (k) => (cleanPhone && k.phone.replace(/[^\d]/g, '') === cleanPhone) ||
           (k.name.trim().toLowerCase() === phoneOrName.trim().toLowerCase())
  );
  return { blocked: rec?.status === 'blocked', khataaba: rec };
}

/** حذف كافة الأعضاء المنسوبين لخطابة معينة برقمها أو اسمها */
export function deleteMembersByKhataaba(khataabaPhoneOrName: string): { deletedCount: number } {
  if (typeof window === 'undefined' || !khataabaPhoneOrName) return { deletedCount: 0 };
  const targetPhone = khataabaPhoneOrName.replace(/[^\d]/g, '');
  const targetName = khataabaPhoneOrName.trim().toLowerCase();

  const filterList = (list: any[]) => {
    return list.filter((m) => {
      const mKPhone = (m.khataabaPhone || '').replace(/[^\d]/g, '');
      const mKName = (m.khataabaName || '').trim().toLowerCase();
      const mNote = (m.importNotes || '' ) + (m.adminNote || '');

      const matchesPhone = targetPhone && mKPhone && mKPhone === targetPhone;
      const matchesName = targetName && mKName && mKName === targetName;
      const matchesNote = (targetPhone && mNote.includes(targetPhone)) || (targetName && mNote.toLowerCase().includes(targetName));

      return !(matchesPhone || matchesName || matchesNote);
    });
  };

  let totalDeleted = 0;
  ['saved_members_list', 'saved_admin_members_list', 'twafok_members'].forEach((key) => {
    try {
      const raw = dataService.db.settings.get(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const filtered = filterList(arr);
          totalDeleted = Math.max(totalDeleted, arr.length - filtered.length);
          dataService.db.settings.set(key, JSON.stringify(filtered));
        }
      }
    } catch { /* ignore */ }
  });

  // إشعار التطبيق بتحديث الأعضاء
  window.dispatchEvent(new CustomEvent('twafok_members_updated'));
  return { deletedCount: totalDeleted };
}

/** حذف كافة الأعضاء المنسوبين لمكتب/قروب معين */
export function deleteMembersByOffice(officeName: string): { deletedCount: number } {
  if (typeof window === 'undefined' || !officeName) return { deletedCount: 0 };
  const targetOffice = officeName.trim().toLowerCase();

  const filterList = (list: any[]) => {
    return list.filter((m) => {
      const mOffice = (m.importOfficeName || '').trim().toLowerCase();
      return mOffice !== targetOffice;
    });
  };

  let totalDeleted = 0;
  ['saved_members_list', 'saved_admin_members_list', 'twafok_members'].forEach((key) => {
    try {
      const raw = dataService.db.settings.get(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const filtered = filterList(arr);
          totalDeleted = Math.max(totalDeleted, arr.length - filtered.length);
          dataService.db.settings.set(key, JSON.stringify(filtered));
        }
      }
    } catch { /* ignore */ }
  });

  window.dispatchEvent(new CustomEvent('twafok_members_updated'));
  return { deletedCount: totalDeleted };
}

/** حذف أعضاء محددين بمجموعات معرفاتهم (Bulk Delete) */
export function deleteSelectedMembers(memberIds: string[]): { deletedCount: number } {
  if (typeof window === 'undefined' || !Array.isArray(memberIds) || memberIds.length === 0) {
    return { deletedCount: 0 };
  }
  const idSet = new Set(memberIds);

  let totalDeleted = 0;
  ['saved_members_list', 'saved_admin_members_list', 'twafok_members'].forEach((key) => {
    try {
      const raw = dataService.db.settings.get(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const filtered = arr.filter((m) => !idSet.has(m.id));
          totalDeleted = Math.max(totalDeleted, arr.length - filtered.length);
          dataService.db.settings.set(key, JSON.stringify(filtered));
        }
      }
    } catch { /* ignore */ }
  });

  window.dispatchEvent(new CustomEvent('twafok_members_updated'));
  return { deletedCount: totalDeleted };
}

/** تعديل حالة أو خصائص أعضاء محددين (Bulk Update) */
export function batchUpdateMembers(memberIds: string[], updates: Record<string, any>): { updatedCount: number } {
  if (typeof window === 'undefined' || !Array.isArray(memberIds) || memberIds.length === 0) {
    return { updatedCount: 0 };
  }
  const idSet = new Set(memberIds);

  let totalUpdated = 0;
  ['saved_members_list', 'saved_admin_members_list', 'twafok_members'].forEach((key) => {
    try {
      const raw = dataService.db.settings.get(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          let count = 0;
          const updated = arr.map((m) => {
            if (idSet.has(m.id)) {
              count++;
              return { ...m, ...updates };
            }
            return m;
          });
          totalUpdated = Math.max(totalUpdated, count);
          dataService.db.settings.set(key, JSON.stringify(updated));
        }
      }
    } catch { /* ignore */ }
  });

  window.dispatchEvent(new CustomEvent('twafok_members_updated'));
  return { updatedCount: totalUpdated };
}

// ===== دوال الخطابات =====

export function getImportOffices(): ImportOffice[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = dataService.db.settings.get(STORAGE_KEYS.offices);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

export function saveImportOffices(offices: ImportOffice[]): void {
  if (typeof window === 'undefined') return;
  dataService.db.settings.set(STORAGE_KEYS.offices, JSON.stringify(offices));
}

export function addImportOffice(name: string, notes?: string): ImportOffice {
  const offices = getImportOffices();
  const newOffice: ImportOffice = {
    id: 'office_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    usageCount: 0,
    notes: notes?.trim(),
  }; 
  offices.push(newOffice);
  saveImportOffices(offices);
  return newOffice;
}

export function updateImportOffice(id: string, updates: Partial<ImportOffice>): void {
  const offices = getImportOffices();
  const idx = offices.findIndex(o => o.id === id);
  if (idx !== -1) {
    offices[idx] = { ...offices[idx], ...updates }; 
    saveImportOffices(offices);
  }
}

export function deleteImportOffice(id: string): void {
  const offices = getImportOffices().filter(o => o.id !== id);
  saveImportOffices(offices);
}

export function incrementOfficeUsage(id: string): void {
  const offices = getImportOffices();
  const idx = offices.findIndex(o => o.id === id);
  if (idx !== -1) {
    offices[idx].usageCount += 1;
    offices[idx].lastUsedAt = new Date().toISOString();
    saveImportOffices(offices);
  }
}

export function getImportOfficeById(id: string): ImportOffice | undefined {
  return getImportOffices().find(o => o.id === id);
}

export function getImportOfficeByName(name: string): ImportOffice | undefined {
  return getImportOffices().find(o => o.name.toLowerCase() === name.toLowerCase());
}

// ===== دوال الدفعات =====

export function getImportBatches(): ImportBatch[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = dataService.db.settings.get(STORAGE_KEYS.batches);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

export function saveImportBatches(batches: ImportBatch[]): void {
  if (typeof window === 'undefined') return;
  dataService.db.settings.set(STORAGE_KEYS.batches, JSON.stringify(batches));
}

export function generateBatchNumber(): string {
  const batches = getImportBatches();
  const lastNum = batches.length > 0 
    ? Math.max(...batches.map(b => parseInt(b.batchNumber.replace('IMP-', '')) || 0)) 
    : 0;
  return `IMP-${String(lastNum + 1).padStart(3, '0')}`;
}

export function createImportBatch(data: {
  batchNumber?: string;
  officeId?: string;
  officeName?: string;
  importDate?: string;
  membersCount: number;
  duplicatesCount: number;
  skippedCount: number;
  errorsCount: number;
  notes?: string;
  sourceType: 'csv' | 'paste' | 'api';
}): ImportBatch {
  const batches = getImportBatches();
  const batchNumber = data.batchNumber ? data.batchNumber.trim() : generateBatchNumber();
  const newBatch: ImportBatch = {
    id: 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    batchNumber,
    officeId: data.officeId,
    officeName: data.officeName,
    importDate: data.importDate || new Date().toISOString(),
    membersCount: data.membersCount,
    duplicatesCount: data.duplicatesCount,
    skippedCount: data.skippedCount,
    errorsCount: data.errorsCount,
    notes: data.notes?.trim(),
    sourceType: data.sourceType,
    createdAt: new Date().toISOString(),
  }; 
  batches.unshift(newBatch);
  saveImportBatches(batches);
  
  // تحديث استخدام الخطابة
  if (data.officeId) incrementOfficeUsage(data.officeId);
  
  return newBatch;
}

export function getImportBatchById(id: string): ImportBatch | undefined {
  return getImportBatches().find(b => b.id === id);
}

export function getImportBatchByNumber(batchNumber: string): ImportBatch | undefined {
  return getImportBatches().find(b => b.batchNumber === batchNumber);
}

export function deleteImportBatch(id: string): void {
  const batches = getImportBatches().filter(b => b.id !== id);
  saveImportBatches(batches);
}

// ===== دوال الاستيراد =====

// تنظيف وتقليم النص الخام للاستيراد من علامات Markdown والشروحات التمهيدية
export function cleanRawImportText(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();

  // 1. تنظيف علامات Markdown code block (مثل ```csv أو ```json)
  text = text.replace(/^```[a-z0-9_]*\r?\n/gi, '').replace(/\r?\n```$/gi, '').trim();
  text = text.replace(/```[a-z0-9_]*/gi, '').replace(/```/g, '').trim();

  // 2. إذا كانت هناك أسطر شروحات قبل صف العناوين الرئيسي، ابحث عن بداية صف العناوين
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const l = lines[i];
    if (
      l.startsWith('[') || l.startsWith('{') ||
      l.includes('real_name') || l.includes('realName') || l.includes('nickname') || l.includes('phone') ||
      l.includes('gender') || l.includes('الجنس') || l.includes('الاسم') || l.includes('العمر') ||
      (l.includes(',') && l.split(',').length >= 2) ||
      (l.includes('\t') && l.split('\t').length >= 2)
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex > 0) {
    text = lines.slice(headerIndex).join('\n');
  }

  return text;
}

// فحص ما إذا كان الصف عبارة عن صف توضيحي للقالب (مثل "الاسم الكامل,الجنس (ذكر/أنثى)..." أو عناوين عربية)
function isTemplateLabelRow(rowValues: string[]): boolean {
  const str = rowValues.join(' ');
  const first = (rowValues[0] || '').trim();
  const second = (rowValues[1] || '').trim();
  return (
    str.includes('(YYYY-MM-DD)') ||
    str.includes('(ذكر/أنثى)') ||
    str.includes('أعزب/عزباء/مطلق/مطلقة') ||
    str.includes('تاريخ الميلاد (YYYY-MM-DD)') ||
    str.includes('الاسم الكامل') ||
    (first === 'الجنس' && (second === 'العمر' || str.includes('الحالة الاجتماعية') || str.includes('نوع الزواج') || str.includes('المدينة')))
  );
}

// تحليل CSV
export function parseCSV(csvText: string): { headers: string[]; rows: string[][]; errors: string[] } {
  const errors: string[] = []; 
  const cleanText = cleanRawImportText(csvText);

  // دعم صيغة JSON المباشرة
  if (cleanText.startsWith('[') || cleanText.startsWith('{')) {
    try {
      let parsedJson = JSON.parse(cleanText);
      if (!Array.isArray(parsedJson) && typeof parsedJson === 'object' && parsedJson !== null) {
        const possibleArr = Object.values(parsedJson).find(val => Array.isArray(val));
        if (possibleArr) parsedJson = possibleArr;
        else parsedJson = [parsedJson];
      }
      if (Array.isArray(parsedJson) && parsedJson.length > 0) {
        const allKeys = new Set<string>();
        parsedJson.forEach(obj => {
          if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(k => allKeys.add(k));
          }
        });
        const headers = Array.from(allKeys);
        const rows = parsedJson.map(obj => headers.map(h => (obj[h] ?? '').toString()));
        return { headers, rows, errors: [] };
      }
    } catch {
      // ليس JSON، نواصل مع تحليل CSV Standard
    }
  }

  // تحديد الفاصل من السطر الأول
  const firstLineEnd = cleanText.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? cleanText : cleanText.slice(0, firstLineEnd);
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

  // محلل كامل للنص يدعم الحقول متعددة الأسطر داخل علامات الاقتباس
  // (ملفات Excel المصدرة كثيراً ما تحتوي نصوصاً طويلة فيها أسطر جديدة)
  const allRows = tokenizeCSV(cleanText, delimiter);

  if (allRows.length < 2) {
    errors.push('الملف يجب أن يحتوي على صف العناوين وصف البيانات على الأقل');
    return { headers: [], rows: [], errors };
  }

  const headers = allRows[0].map((h) => h.trim());

  // تحليل الصفوف
  const rows: string[][] = [];
  for (let i = 1; i < allRows.length; i++) {
    let row = allRows[i];
    // تجاهل الصفوف الفارغة تماماً
    if (row.every((cell) => !cell || !cell.trim())) continue;
    if (isTemplateLabelRow(row)) {
      continue; // صف توضيحي للقالب، يتم تجاهله
    }
    if (row.length < headers.length) {
      while (row.length < headers.length) row.push('');
    } else if (row.length > headers.length) {
      row = row.slice(0, headers.length);
    }
    rows.push(row);
  }

  return { headers, rows, errors };
}

/**
 * محلل CSV كامل (آلة حالة) — يقرأ النص بأكمله ويحترم علامات الاقتباس،
 * بما في ذلك الأسطر الجديدة داخل الحقول المقتبسة والاقتباس المزدوج "".
 */
function tokenizeCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' || char === '\r') {
      // نهاية صف — تجاهل \r\n المزدوج
      if (char === '\r' && text[i + 1] === '\n') i++;
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((c) => c !== '')) rows.push(currentRow);
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // آخر حقل/صف
  currentRow.push(currentField.trim());
  if (currentRow.some((c) => c !== '')) rows.push(currentRow);

  return rows;
}

// تحليل صف CSV واحد
function parseCSVLine(line: string, delimiter = ','): string[] {
  const result: string[] = []; 
  let current = ''; 
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'; 
        i++; 
      } else {
        inQuotes = !inQuotes; 
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim()); 
      current = ''; 
    } else {
      current += char; 
    }
  }
  
  result.push(current.trim()); 
  return result; 
}

const SMART_IMPORT_HEADERS = [
  'real_name', 'nickname', 'gender', 'age', 'birth_date', 'nationality', 'country', 'city', 'district',
  'marital_status', 'phone', 'whatsapp', 'sect', 'height', 'weight', 'skin_color', 'education',
  'work_type', 'job_title', 'housing', 'bio', 'p_notes'
];

const COUNTRY_HINTS = [
  'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان', 'سلطنة عمان', 'مصر', 'الأردن',
  'اليمن', 'العراق', 'سوريا', 'لبنان', 'فلسطين', 'السودان', 'المغرب', 'الجزائر', 'تونس'
];

function stripWhatsappMeta(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b\d{1,2}:\d{2}\s*(?:ص|م|AM|PM)?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickByLabels(block: string, labels: string[]): string {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:：=\-–]?\\s*([^\\n،,|؛]+)`, 'i');
    const match = block.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function normalizeGenderSmart(value: string, fullText: string): string {
  const raw = `${value} ${fullText}`.toLowerCase();
  if (/\bmale\b|\bm\b|ذكر|رجل|شاب|زوج/.test(raw) && !/أنثى|انثى|female|فتاة|بنت|زوجة/.test(raw)) return 'ذكر';
  if (/\bfemale\b|\bf\b|أنثى|انثى|امرأة|فتاة|بنت|زوجة/.test(raw)) return 'أنثى';
  if (/أعزب|مطلق|أرمل|متزوج/.test(raw)) return 'ذكر';
  if (/عزباء|مطلقة|أرملة|متزوجة/.test(raw)) return 'أنثى';
  return value;
}

function normalizeMaritalSmart(value: string, fullText: string): string {
  const raw = `${value} ${fullText}`;
  if (/عزباء|single female/i.test(raw)) return 'عزباء';
  if (/أعزب|اعزب|single/i.test(raw)) return 'أعزب';
  if (/مطلقة|divorced female/i.test(raw)) return 'مطلقة';
  if (/مطلق|divorced/i.test(raw)) return 'مطلق';
  if (/أرملة|ارملة|widow/i.test(raw)) return 'أرملة';
  if (/أرمل|ارمل|widower/i.test(raw)) return 'أرمل';
  if (/متزوجة/.test(raw)) return 'متزوجة';
  if (/متزوج|married/i.test(raw)) return 'متزوج';
  return value;
}

function parseLooseProfileBlock(block: string, index: number): Record<string, string> | null {
  const clean = stripWhatsappMeta(block);
  if (!clean || clean.length < 8) return null;

  const phoneMatches = clean.match(/(?:\+?\d[\d\s\-()]{7,}\d|[٠-٩+][٠-٩\s\-()]{7,}[٠-٩])/g) || [];
  const normalizedPhones = phoneMatches
    .map((p) => normalizeArabicNumbers(p).replace(/[^0-9+]/g, ''))
    .filter((p) => p.replace(/\D/g, '').length >= 8);

  const explicitName = pickByLabels(block, ['الاسم الكامل', 'الاسم الحقيقي', 'الاسم', 'اسم العضو', 'name', 'real name']);
  const explicitGender = pickByLabels(block, ['الجنس', 'gender']);
  const explicitAge = pickByLabels(block, ['العمر', 'age']);
  const explicitCountry = pickByLabels(block, ['الدولة', 'بلد الإقامة', 'البلد', 'country']);
  const explicitCity = pickByLabels(block, ['المدينة', 'المنطقة', 'city']);
  const explicitNationality = pickByLabels(block, ['الجنسية', 'nationality']);
  const explicitMarital = pickByLabels(block, ['الحالة الاجتماعية', 'الحالة', 'marital status']);

  const ageMatch = explicitAge || (clean.match(/(?:العمر\s*)?([0-9٠-٩]{2})\s*(?:سنة|عام|سنه)/)?.[1] || '');
  const countryGuess = explicitCountry || COUNTRY_HINTS.find((country) => clean.includes(country)) || '';
  const row: Record<string, string> = {
    real_name: explicitName,
    nickname: explicitName || `عضو مستورد ${index + 1}`,
    gender: normalizeGenderSmart(explicitGender, clean),
    age: normalizeArabicNumbers(ageMatch),
    birth_date: pickByLabels(block, ['تاريخ الميلاد', 'birth date']),
    nationality: explicitNationality,
    country: countryGuess.replace('سلطنة عمان', 'عمان'),
    city: explicitCity,
    district: pickByLabels(block, ['الحي', 'district']),
    marital_status: normalizeMaritalSmart(explicitMarital, clean),
    phone: normalizedPhones[0] || '',
    whatsapp: normalizedPhones[1] || normalizedPhones[0] || '',
    sect: pickByLabels(block, ['المذهب', 'sect']),
    height: normalizeArabicNumbers(pickByLabels(block, ['الطول', 'height'])),
    weight: normalizeArabicNumbers(pickByLabels(block, ['الوزن', 'weight'])),
    skin_color: pickByLabels(block, ['لون البشرة', 'البشرة', 'skin color']),
    education: pickByLabels(block, ['المؤهل', 'التعليم', 'education']),
    work_type: pickByLabels(block, ['نوع العمل', 'العمل', 'work type']),
    job_title: pickByLabels(block, ['الوظيفة', 'المسمى الوظيفي', 'job']),
    housing: pickByLabels(block, ['السكن', 'housing']),
    bio: clean,
    p_notes: pickByLabels(block, ['مواصفات الشريك', 'شروط الشريك', 'المطلوب', 'p_notes']) || clean,
  };

  const hasUsefulData = row.real_name || row.gender || row.phone || row.age || row.country || row.marital_status || row.bio.length > 20;
  return hasUsefulData ? row : null;
}

function parseLooseProfilesData(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: SMART_IMPORT_HEADERS, rows: [] };

  const blocks: string[] = [];
  let current: string[] = [];
  lines.forEach((line) => {
    const startsProfile = /(الاسم|name|profile|طلب\s*زواج|استمارة)/i.test(line) && current.length > 0;
    const separator = /^[-=_]{3,}$/.test(line) || /^#+\s*/.test(line);
    if (startsProfile || separator) {
      if (current.length > 0) blocks.push(current.join('\n'));
      current = separator ? [] : [line];
    } else {
      current.push(line);
    }
  });
  if (current.length > 0) blocks.push(current.join('\n'));

  const profiles = (blocks.length > 0 ? blocks : [text])
    .map((block, index) => parseLooseProfileBlock(block, index))
    .filter((row): row is Record<string, string> => !!row);

  return {
    headers: SMART_IMPORT_HEADERS,
    rows: profiles.map((profile) => SMART_IMPORT_HEADERS.map((h) => profile[h] || '')),
  };
}

// تحليل Paste (Tab-separated, CSV, or JSON)
export function parsePastedData(text: string): { headers: string[]; rows: string[][]; errors: string[] } {
  const errors: string[] = []; 
  const cleanText = cleanRawImportText(text);

  // دعم صيغة JSON المباشرة
  if (cleanText.startsWith('[') || cleanText.startsWith('{')) {
    try {
      let parsedJson = JSON.parse(cleanText);
      if (!Array.isArray(parsedJson) && typeof parsedJson === 'object' && parsedJson !== null) {
        const possibleArr = Object.values(parsedJson).find(val => Array.isArray(val));
        if (possibleArr) parsedJson = possibleArr;
        else parsedJson = [parsedJson];
      }
      if (Array.isArray(parsedJson) && parsedJson.length > 0) {
        const allKeys = new Set<string>();
        parsedJson.forEach(obj => {
          if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(k => allKeys.add(k));
          }
        });
        const headers = Array.from(allKeys);
        const rows = parsedJson.map(obj => headers.map(h => (obj[h] ?? '').toString()));
        return { headers, rows, errors: [] };
      }
    } catch {
      // ليس JSON، نواصل مع المفصول بفواصل أو Tab
    }
  }

  const lines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  // لا يوجد أي استخراج تخميني تلقائي — نطلب ملفاً مهيكلاً (CSV/Tab/JSON) فقط
  if (lines.length < 2) {
    errors.push('الرجاء لصق ملف CSV مهيكل (سطر عناوين + صفوف بيانات) كما يُنشئه الذكاء الاصطناعي. لا يتم استخراج أي بيانات تلقائياً من النصوص الحرة.');
    return { headers: [], rows: [], errors }; 
  }
  
  // تحديد الفاصل (Tab أو comma)
  const firstLine = lines[0];
  const separator = firstLine.includes('\t') ? '\t' : firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

  // استخدام المحلل الكامل الذي يدعم الحقول متعددة الأسطر داخل الاقتباس
  const allRows = tokenizeCSV(cleanText, separator);
  if (allRows.length < 2) {
    errors.push('الرجاء لصق ملف CSV مهيكل (سطر عناوين + صفوف بيانات) كما يُنشئه الذكاء الاصطناعي.');
    return { headers: [], rows: [], errors };
  }

  const headers = allRows[0].map(h => h.trim());
  const rows: string[][] = [];

  for (let i = 1; i < allRows.length; i++) {
    let row = allRows[i];
    if (row.every((cell) => !cell || !cell.trim())) continue;
    if (isTemplateLabelRow(row)) {
      continue; // تجاهل صف شروحات القالب
    }
    if (row.length < headers.length) {
      while (row.length < headers.length) row.push('');
    } else if (row.length > headers.length) {
      row = row.slice(0, headers.length);
    }
    rows.push(row);
  }

  return { headers, rows, errors };
}

// دالة للتحقق مما إذا كان سجلان متطابقين تماماً في كافة الحقول المتاحة
export function areRecordsIdentical(a: Record<string, any>, b: Record<string, any>): boolean {
  const getFirst = (obj: Record<string, any>, keys: string[]) => {
    for (const key of keys) {
      const value = obj[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  };

  const normalizeIdentityPhone = (value: string) => normalizeArabicNumbers(value).replace(/[^0-9]/g, '').replace(/^00/, '');
  const aPhone = normalizeIdentityPhone(getFirst(a, ['phone', 'الهاتف', 'رقم الهاتف', 'الجوال']));
  const bPhone = normalizeIdentityPhone(getFirst(b, ['phone', 'الهاتف', 'رقم الهاتف', 'الجوال']));
  const aWhatsapp = normalizeIdentityPhone(getFirst(a, ['whatsapp', 'واتساب', 'رقم الواتساب']));
  const bWhatsapp = normalizeIdentityPhone(getFirst(b, ['whatsapp', 'واتساب', 'رقم الواتساب']));
  const aEmail = getFirst(a, ['email', 'البريد', 'البريد الإلكتروني']).toLowerCase();
  const bEmail = getFirst(b, ['email', 'البريد', 'البريد الإلكتروني']).toLowerCase();

  const phoneKeysA = [aPhone, aWhatsapp].filter((p) => p.length >= 8);
  const phoneKeysB = [bPhone, bWhatsapp].filter((p) => p.length >= 8);
  if (phoneKeysA.some((p) => phoneKeysB.includes(p))) return true;
  if (aEmail && bEmail && aEmail === bEmail) return true;

  // ===== قاعدة حاسمة =====
  // المُعرّف القوي الوحيد للتكرار هو الهاتف أو البريد. إذا كان أيّ من السجلين
  // بلا هاتف وبلا بريد، فلا نحكم عليه بالتكرار بالمقارنة الضبابية إطلاقاً —
  // كل طلب خطابة بيانات مستقلة تستحق الاستيراد حتى لو تشابهت حقوله القليلة.
  const aHasIdentity = phoneKeysA.length > 0 || !!aEmail;
  const bHasIdentity = phoneKeysB.length > 0 || !!bEmail;
  if (!aHasIdentity || !bHasIdentity) return false;

  const fieldsToCompare = [
    ['phone', 'الهاتف'],
    ['whatsapp', 'واتساب'],
    ['gender', 'الجنس'],
    ['nickname', 'الاسم المستعار', 'name', 'الاسم'],
    ['realName', 'real_name', 'الاسم الحقيقي'],
    ['age', 'العمر'],
    ['country', 'الدولة'],
    ['city', 'المدينة'],
    ['district', 'الحي', 'المنطقة'],
    ['nationality', 'الجنسية'],
    ['sect', 'المذهب'],
    ['maritalStatus', 'marital_status', 'الحالة الاجتماعية'],
    ['height', 'الطول'],
    ['weight', 'الوزن'],
    ['skinColor', 'skin_color', 'لون البشرة'],
    ['education', 'المؤهل'],
    ['workType', 'work_type', 'نوع العمل'],
    ['jobTitle', 'job_title', 'المسمى الوظيفي'],
    ['housing', 'السكن'],
    ['bio', 'نبذة'],
  ];

  const getValue = (obj: Record<string, any>, keys: string[]) => {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        return normalizeArabicNumbers(obj[key].toString().trim().toLowerCase());
      }
    }
    return '';
  };

  let comparedCount = 0;
  for (const keys of fieldsToCompare) {
    const valA = getValue(a, keys);
    const valB = getValue(b, keys);

    // نتحقق إذا كان كلاهما يحتويان على قيم مختلفة
    if (valA !== '' || valB !== '') {
      comparedCount++;
      if (valA !== valB) {
        return false; // يختلفان في حقل واحد على الأقل -> ليس مكرراً!
      }
    }
  }

  return comparedCount > 0;
}

// التحقق من التكرار (يكون مكرراً فقط إذا كانت كافة البيانات في الصف متطابقة تماماً)
export function checkDuplicates(
  data: Record<string, any>[],
  _existingMembers: Record<string, any>[]
): { duplicates: Record<string, any>[]; unique: Record<string, any>[]; duplicateIndices: number[] } {
  // ===== تم تعطيل اكتشاف التكرار بناءً على طلب المستخدم =====
  // يُستورد كل صف دائماً كعضو جديد مستقل، حتى لو تطابق رقم الهاتف أو تطابقت
  // جميع الحقول مع عضو آخر. كل طلب خطابة = عضو مستقل بمعرّف فريد خاص به.
  return { duplicates: [], unique: [...data], duplicateIndices: [] };
}

// توليد ID فريد للعضو
export function generateMemberId(): string {
  return 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// حساب العمر من تاريخ الميلاد
export function calculateAgeFromBirthDate(birthDate: string): number {
  if (!birthDate) return 0;
  let cleanDate = birthDate.trim();
  if (cleanDate.includes('/')) {
    const parts = cleanDate.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        cleanDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        cleanDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  const birth = new Date(cleanDate);
  if (isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--; 
  }
  return age > 0 ? age : 0;
}

// تحويل الحالة الاجتماعية إلى النص العربي المناسب للجنس
export function getMaritalLabel(status: string, gender: 'male' | 'female'): string {
  const isMale = gender === 'male';
  const s = (status || '').toLowerCase().trim();
  if (/عزباء|أعزب|اعزب|single/.test(s)) return isMale ? 'أعزب' : 'عزباء';
  if (/مطلقة|مطلق|divorced/.test(s)) return isMale ? 'مطلق' : 'مطلقة';
  if (/أرملة|ارملة|widow/.test(s)) return isMale ? 'أرمل' : 'أرملة';
  if (/أرمل|ارمل|widower|widowed/.test(s)) return isMale ? 'أرمل' : 'أرملة';
  if (/متزوجة|متزوج|married/.test(s)) return isMale ? 'متزوج' : 'متزوجة';
  const labels: Record<string, Record<string, string>> = {
    male: { single: 'أعزب', divorced: 'مطلق', widower: 'أرمل', married: 'متزوج' },
    female: { single: 'عزباء', divorced: 'مطلقة', widow: 'أرملة' },
  }; 
  return labels[gender]?.[status] || status;
}

function translitArabicToEnglish(text: string): string {
  if (!text) return '';
  const arabicToEnglish: Record<string, string> = {
    'أ': 'a', 'إ': 'a', 'آ': 'a', 'ا': 'a',
    'ب': 'b',
    'ت': 't',
    'ث': 'th',
    'ج': 'j',
    'ح': 'h',
    'خ': 'kh',
    'د': 'd',
    'ذ': 'dh',
    'ر': 'r',
    'ز': 'z',
    'س': 's',
    'ش': 'sh',
    'ص': 's',
    'ض': 'd',
    'ط': 't',
    'ظ': 'z',
    'ع': 'a',
    'غ': 'gh',
    'ف': 'f',
    'ق': 'q',
    'ك': 'k',
    'ل': 'l',
    'م': 'm',
    'ن': 'n',
    'ه': 'h',
    'و': 'w',
    'ي': 'y', 'ى': 'a', 'ئ': 'e', 'ؤ': 'o', 'ء': 'a', 'ة': 'h'
  };

  let result = '';
  const lowerText = text.trim().toLowerCase();
  for (let i = 0; i < lowerText.length; i++) {
    const char = lowerText[i];
    if (arabicToEnglish[char] !== undefined) {
      result += arabicToEnglish[char];
    } else if (/[a-z0-9]/.test(char)) {
      result += char;
    } else if (char === ' ' || char === '_' || char === '-') {
      result += '_';
    }
  }
  return result.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

// تنظيف وتحويل الأرقام العربية إلى أرقام إنجليزية وقراءة الأعداد بأمان
export function normalizeArabicNumbers(val: any): string {
  if (val === null || val === undefined) return '';
  const str = val.toString().trim();
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(arabicDigits[i], 'g'), i.toString());
  }
  return result;
}

export function parseNumberSafely(val: any): number {
  if (!val) return 0;
  const normalized = normalizeArabicNumbers(val).replace(/[^0-9.]/g, '');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

// ====================================================================
//  طبقة التطبيع (Normalization) — شبكة أمان تصحّح مخرجات الذكاء الاصطناعي
//  حتى لو كتب مرادفاً أو صياغة مختلفة، نحوّلها لأقرب قيمة معتمدة في المنصة.
// ====================================================================

function normWorkType(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/أرامكو|ارامكو|سابك|حكوم|وزار|عسكر|جيش|شرط|أمن|بلدي|ديوان/.test(s)) return 'حكومي';
  if (/متقاعد|متقاعده|بدون عمل|لا اعمل|لا أعمل|لا يعمل|عاطل|ربة منزل|ربه منزل|بلا عمل|لا توجد|لا يوجد/.test(s)) return 'بدون عمل';
  if (/طالب|طالبة|دراس/.test(s)) return 'طالب';
  if (/باحث عن عمل|تبحث عن عمل|يبحث عن عمل|أبحث عن عمل/.test(s)) return 'باحث عن عمل';
  if (/قطاع خاص|شرك|مؤسس|أهلي|خاص/.test(s)) return 'قطاع خاص';
  if (/عمل حر|أعمال حرة|اعمال حرة|حرة|حر\b|تجار|أعمال|اعمال|كاسب|صاحب محل|مهندس|طبيب|محاسب|مندوب|معلم|مدرب|فني|سائق|موظف/.test(s)) return 'عمل حر';
  return 'عمل حر';
}

function normEducation(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/دكتور|phd/i.test(s)) return 'دكتوراه';
  if (/ماجست/i.test(s)) return 'ماجستير';
  if (/دبلوم عال/i.test(s)) return 'دبلوم عالي';
  if (/دبلوم/i.test(s)) return 'دبلوم';
  if (/بكالور|جامع|ليسانس|تخرج/i.test(s)) return 'بكالوريوس';
  if (/ثانو/i.test(s)) return 'الثانوية العامة';
  if (/أقل|اقل|ابتدائ|متوسط|أمي|امي|بدون مؤهل/i.test(s)) return 'أقل من الثانوية';
  return '';
}

function normSkin(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  // 1. أبيض ناصع / جداً
  if (/أبيض جدا|ابيض جدا|فاتح جدا|بيضاء جدا|ناصع|شديد البياض/.test(s)) return 'أبيض ناصع';
  // 2. أبيض مائل للقمحي
  if (/أبيض مائل للقمح|ابيض مائل للقمح|أبيض قمحي|ابيض قمحي|بياض على حنطي/.test(s)) return 'أبيض مائل للقمحي';
  // 3. أبيض صريح
  if (/^أبيض$|^ابيض$|^بيضاء$|^فاتح$|^فاتحة$/.test(s)) return 'أبيض';

  // 4. قمحي فاتح
  if (/قمحي فاتح|قمحية فاتحة/.test(s)) return 'قمحي فاتح';
  // 5. قمحي غامق
  if (/قمحي غامق|قمحي داكن|قمحية غامقة/.test(s)) return 'قمحي غامق';
  // 6. قمحي
  if (/قمح/.test(s)) return 'قمحي';

  // 7. حنطي فاتح
  if (/حنطي فاتح|حنطية فاتحة/.test(s)) return 'حنطي فاتح';
  // 8. حنطي غامق / مائل للسمار
  if (/حنطي مائل|حنطي مايل|حنطي غامق|حنطي داكن|مائل للسمار|مايل للسمار|مائل للسمرة|مايل للسمرة/.test(s)) return 'حنطي غامق';
  // 9. حنطي وسط / معتدل
  if (/حنط|وسط|معتدل|متوسط/.test(s)) return 'حنطي';

  // 10. أسمر داكن / غامق
  if (/أسمر داكن|اسمر داكن|أسمر غامق|اسمر غامق|سمراء غامقة|سمراء داكنة|شديد السمار/.test(s)) return 'أسمر داكن';
  // 11. أسمر فاتح / برونزي
  if (/أسمر فاتح|اسمر فاتح|سمراء فاتحة|برونز/.test(s)) return 'أسمر فاتح';
  // 12. أسمر صريح
  if (/أسمر|اسمر|سمراء/.test(s)) return 'أسمر';

  if (/أبيض|ابيض|فاتح|بيضاء/.test(s)) return 'أبيض';
  return s;
}

function normHousing(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/أملك|املك|ملك|بيت مستقل|منزل مستقل|عندي بيت|عنده بيت|عندي منزل/.test(s)) return 'أملك منزل';
  if (/إيجار|ايجار|مستأجر|أستأجر|استأجر|أستاجر/.test(s)) return 'أستأجر';
  if (/عائل|أهل|اهل|مع الوالد|مع والدي|مع العائلة/.test(s)) return 'أسكن مع العائلة';
  return '';
}

// تطبيع الحالة الاجتماعية إلى تسمية عربية معتمدة (يشمل مرادفات مثل «شاب/شابة»)
function normMaritalLabel(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/عزباء|انسة|آنسة|شابة/.test(s)) return 'عزباء';
  if (/مطلقة/.test(s)) return 'مطلقة';
  if (/أرملة|ارملة/.test(s)) return 'أرملة';
  if (/متزوجة/.test(s)) return 'متزوجة';
  if (/أعزب|اعزب|شاب/.test(s)) return 'أعزب';
  if (/مطلق/.test(s)) return 'مطلق';
  if (/أرمل|ارمل/.test(s)) return 'أرمل';
  if (/متزوج/.test(s)) return 'متزوج';
  return s; // إن كانت قيمة إنجليزية معتمدة (single...) تُترك كما هي
}

// تطبيع «تقبل التعدد» إلى قيمة المنصة: yes | no | فارغ
function normPolygamy(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/^لا|لا اقبل|لا أقبل|لا تقبل|ارفض|أرفض|no/i.test(s)) return 'no';
  if (/نعم|اقبل|أقبل|تقبل|موافق|yes/i.test(s)) return 'yes';
  return '';
}

// تنظيف وتجهيز بيانات العضو المستورد - مرن مع الحقول الناقصة
export function prepareImportedMember(
  data: Record<string, any>,
  batchId: string,
  officeName?: string,
  importDate?: string,
  notes?: string,
  sequenceIndex?: number
): Record<string, any> {
  // حساب وتطبيق حقول الاتصال والعناوين
  const email = (data.email || data['البريد'] || '').toString().trim();
  
  // تنظيف رقم الهاتف من ترويسة وتواريخ الواتساب مثل [19/11/2025, 6:54 م]
  let rawPhone = (data.phone || data['الهاتف'] || data['رقم الهاتف'] || data['الجوال'] || '').toString().trim();
  rawPhone = rawPhone.replace(/\[.*?\]/g, '').replace(/:\s*$/, '').trim();
  let phone = normalizeArabicNumbers(rawPhone);

  let rawWhatsapp = (data.whatsapp || data['واتساب'] || data['رقم الواتساب'] || '').toString().trim();
  rawWhatsapp = rawWhatsapp.replace(/\[.*?\]/g, '').replace(/:\s*$/, '').trim();
  let whatsapp = normalizeArabicNumbers(rawWhatsapp);

  // إذا لم يتوفر رقم الهاتف في العمود المخصص، ابحث عنه في النصوص
  const fullRawDataText = Object.values(data).join(' ');
  const phonePattern = /(?:\+?[\d٠-٩]{1,4}[\s-]*)?(?:05|٠٥)[\d٠-٩\s-]{8,12}/g;
  const extractedPhones = (fullRawDataText.match(phonePattern) || []).map(p => normalizeArabicNumbers(p.replace(/[^\d+]/g, '')));
  
  if (!phone && extractedPhones.length > 0) {
    phone = extractedPhones[0];
  }
  if (!whatsapp) {
    whatsapp = extractedPhones[1] || phone;
  }

  // دالة لتنظيف أرقام الهواتف من الحقول العامة (bio, pNotes) لمنع تسريب أي رقم للعامة
  const sanitizePublicText = (str: string): string => {
    if (!str) return '';
    return str
      .replace(/(?:\+?[\d٠-٩]{1,4}[\s-]*)?(?:05|٠٥)[\d٠-٩\s-]{8,12}/g, '')
      .replace(/(?:\+?[\d٠-٩]{10,14})/g, '')
      .replace(/(?:للتواصل|جوال|هاتف|واتس|واتساب|رقم الجوال|رقم الواتساب)\s*:?\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const rawCountry = (data.country || data['الدولة'] || data['بلد الإقامة'] || '').toString().trim();
  const checkCountry = normalizeCountry(rawCountry);
  const checkCity = (data.city || data['المدينة'] || '').toString().trim();
  const checkRealName = (data.realName || data.real_name || data['الاسم الحقيقي'] || '').toString().trim();

  // تحديد الجنس دون تخمين أو فرض قيم افتراضية
  let rawGender = (data.gender || data['الجنس'] || data['الجنيس'] || '').toString().trim().toLowerCase();
  let isMale = rawGender === 'male' || rawGender === 'ذكر' || rawGender === 'm' || rawGender.includes('ذكر');
  let isFemale = rawGender === 'female' || rawGender === 'أنثى' || rawGender === 'انثى' || rawGender === 'f' || rawGender.includes('أنثى') || rawGender.includes('انثى');
  const finalGender = isMale ? 'male' : (isFemale ? 'female' : '');

  // استخراج العمر مباشرة من الرقم أو النص وإكمال تاريخ الميلاد خلفياً فقط
  const rawBirthDate = (data.birthDate || data.birth_date || data['تاريخ الميلاد'] || '').toString().trim();
  const age = parseNumberSafely(data.age || data['العمر']) || (rawBirthDate ? calculateAgeFromBirthDate(rawBirthDate) : 0);
  const computedBirthDate = rawBirthDate || (age > 0 ? `${new Date().getFullYear() - age}-01-01` : '');

  // توليد ID فريد
  const memberId = data.id || generateMemberId();

  // الاسم المستعار - لا يُخترع من الاسم/القبيلة. إن لم يوجد صراحةً في الملف،
  // يُشتق تصنيفاً بسيطاً من الجنس فقط: «رجل» أو «أنثى» (حسب طلب المستخدم).
  const explicitNickname = (data.nickname || data['الاسم المستعار'] || '').toString().trim();
  const checkNickname = explicitNickname || (finalGender === 'male' ? 'رجل' : finalGender === 'female' ? 'أنثى' : '');

  // التحقق التلقائي من الحقول مع تطبيعها لأقرب قيمة معتمدة في المنصة
  const checkMaritalStatus = normMaritalLabel((data.maritalStatus || data.marital_status || data['الحالة الاجتماعية'] || '').toString().trim());
  const checkHeight = parseNumberSafely(data.height || data['الطول']);
  const checkWeight = parseNumberSafely(data.weight || data['الوزن']);
  const checkSkinColor = normSkin((data.skinColor || data.skin_color || data['لون البشرة'] || '').toString().trim());
  const checkEducation = normEducation((data.education || data['المؤهل'] || data['المؤهل العلمي'] || data['المؤهل الدراسي'] || '').toString().trim());
  const rawWorkTypeStr = (data.workType || data.work_type || data['نوع العمل'] || data['العمل'] || '').toString().trim();
  const checkWorkType = normWorkType(rawWorkTypeStr);
  let finalJobTitle = (data.jobTitle || data.job_title || data['المسمى الوظيفي'] || data['الوظيفة'] || '').toString().trim();
  if (checkWorkType === 'أخرى' && !finalJobTitle && rawWorkTypeStr && !['أخرى', 'اخرى'].includes(rawWorkTypeStr)) {
    finalJobTitle = rawWorkTypeStr;
  }
  const checkHousing = normHousing((data.housing || data['السكن'] || '').toString().trim());

  // تجميع الحقول والبيانات الإضافية غير المعيارية لضمان عدم ضياع أي معلومة إطلاقاً
  const knownKeys = new Set([
    'gender', 'الجنس', 'الجنيس', 'age', 'العمر', 'birthDate', 'birth_date', 'تاريخ الميلاد',
    'country', 'الدولة', 'بلد الإقامة', 'city', 'المدينة', 'district', 'الحي', 'المنطقة',
    'nationality', 'الجنسية', 'marriageType', 'marriage_type', 'نوع الزواج',
    'tribe', 'القبيلة', 'القبيلة / النسب', 'النسب', 'العائلة', 'sect', 'المذهب', 'sectOther', 'sect_other',
    'maritalStatus', 'marital_status', 'الحالة الاجتماعية', 'hasChildren', 'has_children', 'أبناء',
    'childrenCount', 'children_count', 'عدد الأبناء', 'childrenLiveWith', 'children_live_with',
    'height', 'الطول', 'weight', 'الوزن', 'skinColor', 'skin_color', 'لون البشرة', 'البشرة',
    'ethnicity', 'العرق', 'health', 'الحالة الصحية', 'smoking', 'التدخين', 'education', 'المؤهل', 'المؤهل العلمي', 'المؤهل الدراسي',
    'workType', 'work_type', 'نوع العمل', 'jobTitle', 'job_title', 'الوظيفة', 'المسمى الوظيفي', 'housing', 'السكن',
    'phone', 'الهاتف', 'رقم الهاتف', 'الجوال', 'whatsapp', 'واتساب', 'رقم الواتساب', 'email', 'البريد',
    'acceptPolygamy', 'accept_polygamy', 'تقبل التعدد', 'قبول التعدد',
    'bio', 'نبذة', 'عني', 'مواصفاتي', 'المواصفات', 'الشروط', 'الشروط الخاصة', 'بيانات إضافية', 'ملاحظات',
    'pNotes', 'p_notes', 'partner_notes', 'مواصفات الشريك', 'مواصفات شريك العمر', 'شريك العمر', 'مواصفات الزوج', 'مواصفات الزوجة',
    'admin_notes', 'adminNotes', 'adminNote', 'ملاحظات إدارية', 'ملاحظات الإدارة',
    'id', 'username', 'nickname', 'realName', 'password', 'status', 'plan'
  ]);

  const extraBioInfo: string[] = [];
  const extraPNotesInfo: string[] = [];
  const extraAdminInfo: string[] = [];

  Object.entries(data).forEach(([key, val]) => {
    if (!val) return;
    const cleanKey = key.trim();
    if (knownKeys.has(cleanKey)) return;
    
    const strVal = val.toString().trim();
    if (!strVal || strVal === '0' || strVal === 'false' || strVal === '-' || strVal === '—') return;

    if (/أتعاب|عمولة|خطابة|وسيطة|مكتب|حساب|دفع|اشتراك/i.test(cleanKey) || /أتعاب|عمولة|اشتراك/i.test(strVal)) {
      extraAdminInfo.push(`${cleanKey}: ${strVal}`);
    } else if (/شريك|مطلوب|طرف|زوج|زوجة|شرط|مهر|المهر|مصروف/i.test(cleanKey)) {
      extraPNotesInfo.push(`${cleanKey}: ${strVal}`);
    } else {
      extraBioInfo.push(`${cleanKey}: ${strVal}`);
    }
  });

  // تجميع السيرة الذاتية والمواصفات الكاملة
  const bioParts = [
    data.bio,
    data['نبذة'],
    data['عني'],
    data['مواصفاتي'],
    data['المواصفات'],
    data['الشروط'],
    data['الشروط الخاصة'],
    data['بيانات إضافية'],
    data['ملاحظات'],
    ...extraBioInfo
  ].filter(Boolean).map(s => s.toString().trim());

  // دمج أي تفاصيل فريدة لتشمل كل نص أرسله المستخدم مع تطهير الهواتف
  const rawBio = Array.from(new Set(bioParts)).join(' - ');
  const bio = sanitizePublicText(rawBio);

  // مواصفات الشريك
  const pNotesParts = [
    data.pNotes,
    data.p_notes,
    data.partner_notes,
    data['مواصفات الشريك'],
    data['مواصفات شريك العمر'],
    data['شريك العمر'],
    data['مواصفات الزوج'],
    data['مواصفات الزوجة'],
    ...extraPNotesInfo
  ].filter(Boolean).map(s => s.toString().trim());
  
  const rawPNotes = Array.from(new Set(pNotesParts)).join(' - ');
  const pNotes = sanitizePublicText(rawPNotes);

  // الملاحظات الإدارية (تجميع الماليات والاتفاقات الإدارية وأرقام التواصل للإدارة)
  const contactInfoNote = [
    phone ? `هاتف/جوال العضو: ${phone}` : '',
    whatsapp && whatsapp !== phone ? `واتساب: ${whatsapp}` : '',
  ].filter(Boolean).join(' | ');

  const baseAdminNote = (data.admin_notes || data.adminNotes || data.adminNote || data['ملاحظات إدارية'] || data['ملاحظات الإدارة'] || '').toString().trim();
  const fullAdminNote = [contactInfoNote, baseAdminNote, ...extraAdminInfo].filter(Boolean).map(s => s.trim()).join(' | ');

  // جلب أسماء المستخدمين الحالية من localStorage لتفادي التكرار
  const existingUsernames = new Set<string>();
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('saved_members_list') || localStorage.getItem('twafok_members');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((m: any) => {
            if (m.username) existingUsernames.add(m.username.toLowerCase());
          });
        }
      }
    } catch { /* ignore */ }
  }

  // تحديد اسم المستخدم / اليوزر
  const checkUsername = (data.username || data['اسم المستخدم'] || data['اليوزر'] || '').toString().trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  
  let baseUsername = '';
  let isNumericSequence = false;
  
  if (checkUsername) {
    baseUsername = checkUsername;
  } else if (sequenceIndex !== undefined) {
    baseUsername = sequenceIndex.toString();
    isNumericSequence = true;
  } else {
    baseUsername = translitArabicToEnglish(checkNickname);
    if (!baseUsername || baseUsername === 'user') {
      baseUsername = 'user_' + memberId.slice(-4);
    }
  }
  
  let finalUsername = baseUsername;
  let counter = 1;
  while (existingUsernames.has(finalUsername)) {
    if (isNumericSequence) {
      const nextNum = parseInt(baseUsername, 10) + counter;
      finalUsername = nextNum.toString();
    } else {
      finalUsername = `${baseUsername}_${counter}`;
    }
    counter++;
  }
  existingUsernames.add(finalUsername);

  const isProfileIncomplete = !checkCity || (!checkHeight && !checkWeight);

  return {
    id: memberId,
    // ===== البيانات الأساسية =====
    nickname: checkNickname,
    username: finalUsername,
    gender: finalGender,
    age: age || 0,
    birthDate: computedBirthDate,
    country: checkCountry,
    city: checkCity,
    district: (data.district || data['الحي'] || data['المنطقة'] || '').toString().trim(),
    nationality: normalizeNationality((data.nationality || data['الجنسية'] || checkCountry || '').toString().trim()),
    marriageType: normalizeMarriageType((data.marriageType || data.marriage_type || data['نوع الزواج'] || '').toString().trim()),
    marriageTypeLabel: getMarriageTypeDisplayLabel((data.marriageType || data.marriage_type || data['نوع الزواج'] || '').toString().trim()),
    customLists: Array.isArray(data.customLists) ? data.customLists : (data.customList ? [data.customList] : (data.custom_lists ? String(data.custom_lists).split(',').map(s => s.trim()) : [])),
    acceptForeigner: (data.acceptForeigner || data.accept_foreigner || data['قبول غير مواطن / أجنبي'] || data['قبول أجنبي'] || '').toString().trim(),
    sect: (data.sect || data['المذهب'] || '').toString().trim(),
    sectOther: (data.sectOther || data.sect_other || '').toString().trim(),
    maritalStatus: (() => {
      if (!checkMaritalStatus) return '';
      const s = checkMaritalStatus.toLowerCase();
      if (/عزباء|أعزب|اعزب|single/.test(s)) return 'single';
      if (/مطلقة|مطلق|divorced/.test(s)) return 'divorced';
      if (/أرملة|ارملة|widow/.test(s)) return 'widow';
      if (/أرمل|ارمل|widower|widowed/.test(s)) return 'widower';
      if (/متزوجة|متزوج|married/.test(s)) return 'married';
      return s;
    })(),
    maritalLabel: (finalGender && checkMaritalStatus) ? getMaritalLabel(checkMaritalStatus, finalGender as 'male' | 'female') : checkMaritalStatus,
    hasChildren: data.hasChildren === 'yes' || data.has_children === 'yes' || data['أبناء'] === 'نعم' || data.hasChildren === true,
    childrenCount: (data.childrenCount || data.children_count || data['عدد الأبناء'] || '').toString().trim(),
    // ===== المواصفات الشخصية =====
    height: checkHeight,
    weight: checkWeight,
    skinColor: checkSkinColor,
    tribe: (data.tribe || data.tribe_name || data['القبيلة'] || data['النسب'] || data['القبيلة / النسب'] || data['العائلة'] || data['القبيلة والعائلة'] || data['العشيرة'] || '').toString().trim(),
    ethnicity: (data.ethnicity || data['العرق'] || data['الأصل'] || data['القومية'] || data['الأصل والعرق'] || '').toString().trim(),
    health: (data.health || data['الحالة الصحية'] || data['الصحة'] || '').toString().trim(),
    smoking: (data.smoking || data['التدخين'] || '').toString().trim(),
    childrenLiveWith: (data.childrenLiveWith || data.children_live_with || data['إقامة الأبناء'] || data['مكان إقامة الأبناء'] || '').toString().trim(),
    wifeCount: (data.wifeCount || data.wife_count || data['عدد الزوجات'] || data['عدد الزوجات الحالي'] || '').toString().trim(),
    seekingWife: (data.seekingWife || data.seeking_wife || data['رغبة الزواج'] || data['التعدد ورغبة الزواج'] || data['التعدد'] || '').toString().trim(),
    // ===== خيارات إضافية =====
    acceptPolygamy: normPolygamy((data.acceptPolygamy || data.accept_polygamy || data['تقبل التعدد'] || data['قبول التعدد'] || data['هل تقبل متزوج'] || data['قبول متزوج'] || data['التعدد'] || '').toString().trim()),
    acceptDivorced: (() => {
      const raw = (data.acceptDivorced || data.accept_divorced || data['قبول المطلق'] || data['قبول المطلقة'] || data['قبول المطلق/ة'] || data['هل تقبل مطلق'] || data['هل تقبل مطلق او ارمل'] || data['هل تقبل ارمل'] || '').toString().trim();
      if (/^(نعم|أقبل|اقبل|لا مانع|yes)/i.test(raw)) return 'yes';
      if (/^(لا|أرفض|ارفض|no)/i.test(raw)) return 'no';
      return raw;
    })(),
    acceptWithChildren: (data.acceptWithChildren || data.accept_with_children || data['قبول بالأبناء'] || data['قبول بأبناء'] || data['القبول بأبناء'] || '').toString().trim(),
    // ===== مواصفات الشريك =====
    pCountry: (data.pCountry || data.partner_country || data['دولة الشريك'] || data['الدولة المطلوبة'] || data['بلد الشريك'] || '').toString().trim(),
    pCity: (data.pCity || data.partner_city || data.partner_cities || data['مدينة الشريك'] || data['المدن المقبولة للشريك'] || data['مدن الشريك'] || data['المدينة المطلوبة'] || '').toString().trim(),
    pAgeMin: parseNumberSafely(data.pAgeMin || data.partner_age_min || data['العمر من'] || data['عمر الشريك (من)'] || data['عمر الشريك الأدنى']) || (() => {
      const raw = (data.partner_age || data['عمر الشريك'] || data['العمر المطلوب'] || data['سن الشريك'] || '').toString();
      const m = raw.match(/\d+/g);
      return m && m.length >= 1 ? parseInt(m[0], 10) : 0;
    })(),
    pAgeMax: parseNumberSafely(data.pAgeMax || data.partner_age_max || data['العمر إلى'] || data['عمر الشريك (إلى)'] || data['عمر الشريك الأعلى']) || (() => {
      const raw = (data.partner_age || data['عمر الشريك'] || data['العمر المطلوب'] || data['سن الشريك'] || '').toString();
      const m = raw.match(/\d+/g);
      return m && m.length >= 2 ? parseInt(m[1], 10) : (m && m.length === 1 ? parseInt(m[0], 10) : 0);
    })(),
    pNationality: (data.pNationality || data.partner_nationality || data['جنسية الشريك'] || data['جنسية الشريك المطلوب'] || data['الجنسية المطلوبة'] || '').toString().trim(),
    pMaritalStatus: (data.pMaritalStatus || data.partner_marital_status || data['حالة الشريك الاجتماعية'] || '').toString().trim(),
    pAcceptChildren: (data.pAcceptChildren || data.partner_accept_children || '').toString().trim(),
    pSect: (data.pSect || data.partner_sect || '').toString().trim(),
    pSectOther: (data.pSectOther || data.partner_sect_other || '').toString().trim(),
    pEducation: (data.pEducation || data.partner_education || '').toString().trim(),
    pWorkType: (data.pWorkType || data.partner_work_type || '').toString().trim(),
    pSkinColor: (data.pSkinColor || data.partner_skin_color || '').toString().trim(),
    pHousing: (data.pHousing || data.partner_housing || '').toString().trim(),
    pNotes: pNotes || (data.pNotes || data.partner_notes || '').toString().trim(),
    // ===== بيانات الحساب والاتصال =====
    realName: checkRealName,
    phone: phone,
    whatsapp: whatsapp,
    email: email,
    password: ((data.password || data.pass || data['كلمة المرور'] || data['كلمة السر'] || data['الرمز السري'] || data['الباسورد'] || data['رمز المرور'] || '').toString().trim()) || `Twafok@${Math.floor(100000 + Math.random() * 900000)}`,
    // ===== حالة الحساب =====
    verified: false,
    premium: false,
    online: false,
    status: 'active',
    plan: 'free',
    lastActive: new Date().toISOString(),
    aboutPartner: (data.aboutPartner || data.partner_notes || '').toString().trim(),
    // ===== ملاحظات إدارية خاصة بهذا العضو (تُحفظ في ملفه فقط، لا تظهر له) =====
    adminNote: fullAdminNote,
    adminNotes: fullAdminNote,
    // ===== بيانات الاستيراد وعلم عدم الاكتمال =====
    sourceType: 'imported',
    importBatchId: batchId,
    importOfficeName: officeName || '',
    importDate: importDate || new Date().toISOString(),
    createdAt: importDate || new Date().toISOString(),
    importNotes: notes || '',
    khataabaPhone: (data.khataabaPhone || data.khataaba_phone || data['رقم الخطابة'] || data['واتساب الخطابة'] || '').toString().trim(),
    khataabaName: (data.khataabaName || data.khataaba_name || data['اسم الخطابة'] || '').toString().trim(),
    isProfileIncomplete: isProfileIncomplete,
    // ===== بيانات الإدارة =====
    joinedAt: new Date().toLocaleDateString('ar-SA'),
    requestsCount: 0,
  }; 
}

// إنشاء تقرير الاستيراد
export function createImportReport(
  totalRows: number,
  imported: number,
  duplicates: number,
  skipped: number,
  errors: ImportError[],
  warnings: ImportWarning[],
  batch: ImportBatch
): ImportReport {
  return {
    batchId: batch.id,
    totalRows,
    importedCount: imported,
    duplicatesCount: duplicates,
    skippedCount: skipped,
    errorsCount: errors.length,
    errors,
    warnings,
    officeName: batch.officeName,
    batchNumber: batch.batchNumber,
    importDate: batch.importDate,
  }; 
}

/**
 * دالة مخصصة ومرنة لاستيراد وتجهيز سجلات الأعضاء المصدّرة من المنصة
 * تحافظ على معرّفاتهم الأصلية (ID, username) وحالات التوثيق والاشتراك
 * وتقبل الملفات غير المكتملة دون أي رفض أو أخطاء تعطيلية مع وضع علامة isProfileIncomplete
 */
export function preparePlatformExportedMember(
  data: Record<string, any>,
  options?: {
    forceNewId?: boolean;
    batchId?: string;
    importDate?: string;
  }
): Record<string, any> {
  const cleanStr = (val: any): string => (val !== undefined && val !== null ? String(val).trim() : '');
  const cleanBool = (val: any): boolean => {
    if (val === true || val === 'true' || val === 'نعم' || val === 'yes' || val === 1 || val === '1') return true;
    return false;
  };

  // 1. المعرف الأصلي
  const rawId = cleanStr(data.id || data['معرّف العضو'] || data['معرف العضو'] || data['معرف'] || data.member_id || data['ID']);
  const memberId = (options?.forceNewId || !rawId) ? generateMemberId() : rawId;

  // 2. الجنس
  let rawGender = cleanStr(data.gender || data['الجنس'] || data['الجنيس']).toLowerCase();
  let isMale = rawGender === 'male' || rawGender === 'ذكر' || rawGender === 'm' || rawGender.includes('ذكر');
  let isFemale = rawGender === 'female' || rawGender === 'أنثى' || rawGender === 'انثى' || rawGender === 'f' || rawGender.includes('أنثى') || rawGender.includes('انثى');
  const finalGender = isMale ? 'male' : (isFemale ? 'female' : (rawGender || ''));

  // 3. الاسم المستعار والاسم الحقيقي
  const nickname = cleanStr(data.nickname || data['الاسم المستعار'] || data['اسم العضو'] || data.username || data['اسم المستخدم']) || (finalGender === 'male' ? 'عضو' : finalGender === 'female' ? 'عضوة' : 'عضو');
  const realName = cleanStr(data.realName || data.real_name || data['الاسم الحقيقي'] || data['الاسم الكامل'] || data['الاسم']);
  
  // 4. اسم المستخدم (Username)
  let username = cleanStr(data.username || data['اسم المستخدم'] || data['اليوزر']).toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!username) {
    username = translitArabicToEnglish(nickname) || ('user_' + memberId.slice(-4));
  }

  // 5. العمر وتاريخ الميلاد
  const rawBirthDate = cleanStr(data.birthDate || data.birth_date || data['تاريخ الميلاد']);
  const age = parseNumberSafely(data.age || data['العمر']) || (rawBirthDate ? calculateAgeFromBirthDate(rawBirthDate) : 0);
  const birthDate = rawBirthDate || (age > 0 ? `${new Date().getFullYear() - age}-01-01` : '');

  // 6. الجغرافيا والمواطنة
  const rawCountry = cleanStr(data.country || data['الدولة'] || data['بلد الإقامة']);
  const country = rawCountry ? normalizeCountry(rawCountry) : '';
  const city = cleanStr(data.city || data['المدينة']);
  const district = cleanStr(data.district || data['الحي'] || data['المنطقة']);
  const rawNationality = cleanStr(data.nationality || data['الجنسية'] || country);
  const nationality = rawNationality ? normalizeNationality(rawNationality) : '';

  // 7. الحالة الاجتماعية ونوع الزواج
  const rawMarital = cleanStr(data.maritalStatus || data.marital_status || data.maritalLabel || data['الحالة الاجتماعية']);
  const checkMaritalStatus = normMaritalLabel(rawMarital);
  const maritalStatus = (() => {
    if (!checkMaritalStatus) return '';
    const s = checkMaritalStatus.toLowerCase();
    if (/عزباء|أعزب|اعزب|single/.test(s)) return 'single';
    if (/مطلقة|مطلق|divorced/.test(s)) return 'divorced';
    if (/أرملة|ارملة|widow/.test(s)) return 'widow';
    if (/أرمل|ارمل|widower|widowed/.test(s)) return 'widower';
    if (/متزوجة|متزوج|married/.test(s)) return 'married';
    return s;
  })();
  const maritalLabel = (finalGender && checkMaritalStatus) ? getMaritalLabel(checkMaritalStatus, finalGender as 'male' | 'female') : (cleanStr(data.maritalLabel) || checkMaritalStatus);

  const rawMarriageType = cleanStr(data.marriageType || data.marriage_type || data.marriageTypeLabel || data['نوع الزواج']);
  const marriageType = normalizeMarriageType(rawMarriageType);
  const marriageTypeLabel = getMarriageTypeDisplayLabel(rawMarriageType);

  // 8. الأبناء والأسرة
  const hasChildren = cleanBool(data.hasChildren ?? data.has_children ?? data['أبناء'] ?? (parseNumberSafely(data.childrenCount || data.children_count || data['عدد الأبناء']) > 0));
  const childrenCount = cleanStr(data.childrenCount || data.children_count || data['عدد الأبناء']);
  const childrenLiveWith = cleanStr(data.childrenLiveWith || data.children_live_with || data['مكان إقامة الأبناء'] || data['إقامة الأبناء']);
  const wifeCount = cleanStr(data.wifeCount || data.wife_count || data['عدد الزوجات'] || data['عدد الزوجات الحالي']);
  const seekingWife = cleanStr(data.seekingWife || data.seeking_wife || data['رغبة التعدد'] || data['التعدد ورغبة الزواج']);

  // 9. المواصفات الجسدية والصحية
  const height = parseNumberSafely(data.height || data['الطول']);
  const weight = parseNumberSafely(data.weight || data['الوزن']);
  const skinColor = normSkin(cleanStr(data.skinColor || data.skin_color || data['لون البشرة'] || data['البشرة']));
  const tribe = cleanStr(data.tribe || data.tribe_name || data['القبيلة / النسب'] || data['القبيلة'] || data['النسب'] || data['العائلة']);
  const ethnicity = cleanStr(data.ethnicity || data['العرق'] || data['الأصل'] || data['القومية']);
  const sect = cleanStr(data.sect || data['المذهب']);
  const sectOther = cleanStr(data.sectOther || data.sect_other);
  const health = cleanStr(data.health || data.health_status || data['الحالة الصحية'] || data['الصحة']);
  const smoking = cleanStr(data.smoking || data['التدخين']);

  // 10. العمل والتعليم والسكن
  const education = normEducation(cleanStr(data.education || data['المستوى التعليمي'] || data['المؤهل'] || data['المؤهل العلمي'] || data['المؤهل الدراسي']));
  const rawWorkTypeStr = cleanStr(data.workType || data.work_type || data['نوع العمل'] || data['العمل']);
  let workType = normWorkType(rawWorkTypeStr);
  let jobTitle = cleanStr(data.jobTitle || data.job_title || data['المسمى الوظيفي'] || data['الوظيفة']);

  // تخصيص دقيق: ربة منزل
  if (/ربة منزل|ربه منزل|ربة بيت|ربه بيت/.test(rawWorkTypeStr) || /ربة منزل|ربه منزل|ربة بيت|ربه بيت/.test(jobTitle)) {
    workType = 'بدون عمل';
    if (!jobTitle) jobTitle = 'ربة منزل';
  }
  // تخصيص دقيق: أرامكو
  if (/أرامكو|ارامكو/.test(rawWorkTypeStr) || /أرامكو|ارامكو/.test(jobTitle)) {
    workType = 'حكومي';
    if (!jobTitle) jobTitle = 'موظف في أرامكو';
  }
  if (!jobTitle && rawWorkTypeStr && !['حكومي', 'قطاع خاص', 'عمل حر', 'بدون عمل', 'طالب', 'أخرى', 'اخرى'].includes(rawWorkTypeStr)) {
    jobTitle = rawWorkTypeStr;
  }
  const housing = normHousing(cleanStr(data.housing || data['السكن'] || data['نوع السكن']));

  // 11. تفضيلات الشريك
  const acceptPolygamy = cleanBool(data.acceptPolygamy ?? data.accept_polygamy ?? data['تقبل التعدد'] ?? data['قبول التعدد']);
  const acceptDivorced = cleanStr(data.acceptDivorced || data.accept_divorced || data['قبول المطلق/ة'] || data['قبول المطلق'] || data['قبول المطلقة']) || (cleanBool(data['قبول المطلق/ة']) ? 'yes' : '');
  const acceptWithChildren = cleanStr(data.acceptWithChildren || data.accept_with_children || data['قبول بأبناء'] || data['قبول بالأبناء']);
  const acceptForeigner = cleanStr(data.acceptForeigner || data.accept_foreigner || data['قبول غير مواطن / أجنبي'] || data['قبول أجنبي'] || data['قبول غير مواطن']);

  const pCountry = cleanStr(data.pCountry || data.partner_country || data['دولة الشريك المطلوبة'] || data['دولة الشريك'] || data['الدولة المطلوبة']);
  const pCity = cleanStr(data.pCity || data.partner_city || data.partner_cities || data['المدن المقبولة للشريك'] || data['مدينة الشريك'] || data['مدن الشريك']);
  const pNationality = cleanStr(data.pNationality || data.partner_nationality || data['جنسية الشريك المطلوبة'] || data['جنسية الشريك'] || data['الجنسية المطلوبة']);
  const pMaritalStatus = cleanStr(data.pMaritalStatus || data.partner_marital_status || data['حالة الشريك الاجتماعية المطلوبة'] || data['حالة الشريك الاجتماعية']);
  const pAgeMin = parseNumberSafely(data.pAgeMin || data.partner_age_min || data['عمر الشريك (من)'] || data['عمر الشريك الأدنى'] || data['العمر من']);
  const pAgeMax = parseNumberSafely(data.pAgeMax || data.partner_age_max || data['عمر الشريك (إلى)'] || data['عمر الشريك الأعلى'] || data['العمر إلى']);
  const pEducation = cleanStr(data.pEducation || data.partner_education);
  const pWorkType = cleanStr(data.pWorkType || data.partner_work_type);
  const pSkinColor = cleanStr(data.pSkinColor || data.partner_skin_color);
  const pHousing = cleanStr(data.pHousing || data.partner_housing);
  const pNotes = cleanStr(data.pNotes || data.p_notes || data.partner_notes || data['مواصفات الشريك المطلوب'] || data['مواصفات الشريك'] || data['شروط الشريك']);

  // 12. نصوص السيرة الذاتية والملاحظات
  const bio = cleanStr(data.bio || data['نبذة عن النفس'] || data['نبذة'] || data['مواصفاتي'] || data['عني']);
  const adminNotes = cleanStr(data.adminNotes || data.adminNote || data.admin_notes || data.admin_note || data['ملاحظات الإدارة'] || data['ملاحظات إدارية']);

  // 13. بيانات الاتصال والأمان
  const phone = cleanStr(data.phone || data['رقم الهاتف'] || data['الهاتف'] || data['الجوال']);
  const whatsapp = cleanStr(data.whatsapp || data['رقم الواتساب'] || data['الواتساب'] || data['واتساب']) || phone;
  const email = cleanStr(data.email || data['البريد الإلكتروني'] || data['البريد']);
  const password = cleanStr(data.password || data.pass || data['كلمة المرور'] || data['كلمة السر']) || `Twafok@${Math.floor(100000 + Math.random() * 900000)}`;
  const nationalId = cleanStr(data.nationalId || data.national_id || data['رقم الهوية'] || data['الهوية الوطنية']);

  // 14. حالة الحساب والاشتراك والتوثيق
  const verified = cleanBool(data.verified ?? data['موثق']);
  const hasSeriousnessBadge = cleanBool(data.hasSeriousnessBadge ?? data.has_seriousness_badge ?? data['وسام الجدية']);
  const paid = cleanBool(data.paid ?? data.deposit_paid ?? data['سداد الجدية']);
  const paidAt = cleanStr(data.paidAt || data.deposit_paid_at || data['تاريخ سداد الجدية']);
  const plan = cleanStr(data.plan || data['الباقة'] || 'free');
  const status = cleanStr(data.status || data['الحالة'] || 'active');

  // 15. القوائم المخصصة
  let customLists: string[] = [];
  if (Array.isArray(data.customLists)) {
    customLists = data.customLists;
  } else if (data.customList) {
    customLists = [String(data.customList)];
  } else if (data.custom_lists || data['القوائم المخصصة']) {
    customLists = cleanStr(data.custom_lists || data['القوائم المخصصة']).split(/[,،]/).map(s => s.trim()).filter(Boolean);
  }

  // 16. بيانات الاستيراد والخطابة الأصلية إن وجدت
  const officeName = cleanStr(data.officeName || data.office_name || data.khataabaName || data.khataaba_name || data.importOfficeName || data['اسم الخطابة / المكتب'] || data['اسم الخطابة'] || data['المكتب']);
  const khataabaPhone = cleanStr(data.khataabaPhone || data.khataaba_phone || data['هاتف الخطابة / المكتب'] || data['هاتف الخطابة'] || data['جوال الخطابة']);
  const batchNumber = cleanStr(data.batchNumber || data.batch_number || data.batchId || data.importBatchId || data['رقم الدفعة']);
  const importDate = cleanStr(options?.importDate || data.importDate || data.import_date || data['تاريخ الاستيراد'] || new Date().toISOString().split('T')[0]);
  const importNotes = cleanStr(data.importNotes || data.import_notes || data['تفاصيل الدفعة'] || data['ملاحظات الاستيراد']);
  const joinedAt = cleanStr(data.joinedAt || data.createdAt || data.created_at || data['تاريخ الانضمام'] || new Date().toLocaleDateString('ar-SA'));
  const sourceType = cleanStr(data.sourceType || data.source_type || (officeName ? 'imported' : 'registered'));

  // 17. فحص عدم الاكتمال (قبول السجل في كل الأحوال دون رفض)
  const isProfileIncomplete = !city || !finalGender || (!height && !weight) || !age || !maritalStatus;

  return {
    id: memberId,
    nickname,
    username,
    gender: finalGender,
    age: age || 0,
    birthDate,
    country,
    city,
    district,
    nationality,
    marriageType,
    marriageTypeLabel,
    customLists,
    acceptForeigner,
    sect,
    sectOther,
    maritalStatus,
    maritalLabel,
    hasChildren,
    childrenCount,
    height: height || 0,
    weight: weight || 0,
    skinColor,
    tribe,
    ethnicity,
    health,
    smoking,
    education,
    workType,
    jobTitle,
    housing,
    childrenLiveWith,
    wifeCount,
    seekingWife,
    acceptPolygamy,
    acceptDivorced,
    acceptWithChildren,
    pCountry,
    pCity,
    pAgeMin: pAgeMin || 0,
    pAgeMax: pAgeMax || 0,
    pNationality,
    pMaritalStatus,
    pEducation,
    pWorkType,
    pSkinColor,
    pHousing,
    pNotes,
    realName,
    phone,
    whatsapp,
    email,
    password,
    nationalId,
    verified,
    hasSeriousnessBadge,
    paid,
    paidAt,
    premium: plan === 'premium' || plan === 'vip',
    online: false,
    status,
    plan,
    lastActive: cleanStr(data.lastActive || data.last_active || new Date().toISOString()),
    aboutPartner: pNotes,
    adminNote: adminNotes,
    adminNotes: adminNotes,
    sourceType,
    importBatchId: options?.batchId || batchNumber || '',
    importOfficeName: officeName,
    importDate,
    importNotes,
    khataabaPhone,
    khataabaName: officeName,
    isProfileIncomplete,
    joinedAt,
    requestsCount: parseNumberSafely(data.requestsCount || data.requests_count) || 0,
  };
}

// إعادة تعيين جميع البيانات
export function resetImportData(): void {
  if (typeof window === 'undefined') return;
  dataService.db.settings.remove(STORAGE_KEYS.offices);
  dataService.db.settings.remove(STORAGE_KEYS.batches);
}
