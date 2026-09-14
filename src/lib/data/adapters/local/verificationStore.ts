// ============================================================
//  إدارة مستندات التوثيق — تخزين في localStorage
// ============================================================

import supabaseClient, { hasRealSupabase } from '../../../supabase';

const isReal = typeof window !== 'undefined' && hasRealSupabase;
let vdocs: VerificationDocument[] | null = null;

export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface VerificationDocument {
  id: string;
  memberId: string;
  memberNickname: string;
  memberRealName: string;
  memberEmail: string;
  docType: string;        // نوع المستند (هوية وطنية، إقامة، إثبات حالة اجتماعية)
  docName: string;        // اسم الملف الأصلي
  docBase64: string;      // الصورة المضغوطة (base64)
  docSizeKB: number;      // الحجم بعد الضغط
  status: VerificationStatus;
  rejectionReason?: string;
  submittedAt: string;    // تاريخ الرفع
  reviewedAt?: string;    // تاريخ المراجعة
  reviewedBy?: string;    // اسم المراجع
}

const STORAGE_KEY = 'twafok_verification_docs_v1';

function loadAll(): VerificationDocument[] {
  if (vdocs) return vdocs;
  vdocs = [];
  return vdocs;
}

function saveAll(docs: VerificationDocument[]) {
  vdocs = docs;
  try {
    if (isReal) {
        Promise.resolve(
          supabaseClient
            .from('settings')
            .upsert({ key: STORAGE_KEY, value: JSON.stringify(docs), updated_at: new Date().toISOString() })
        ).catch((err) => console.warn('[verificationStore] Failed to sync vdocs to Supabase settings:', err));
    }
  } catch { /* تجاهل */ }
}

export async function syncVerificationDocsFromCloud(): Promise<void> {
  if (!isReal) return;
  try {
    const { data, error } = await supabaseClient
      .from('settings')
      .select('value')
      .eq('key', STORAGE_KEY)
      .maybeSingle();
      
    if (error) throw error;
    if (data && data.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) {
        vdocs = parsed;
        console.info('[verificationStore] Successfully synchronized verification documents from Supabase cloud!');
      }
    }
  } catch (err) {
    console.warn('[verificationStore] Failed to fetch verification docs from Supabase.', err);
  }
}

/** رفع مستند توثيق جديد */
export function submitVerificationDoc(doc: Omit<VerificationDocument, 'id' | 'status' | 'submittedAt'>): VerificationDocument {
  const docs = loadAll();
  // إزالة أي مستند سابق معلق أو مرفوض لنفس العضو
  const filtered = docs.filter(d => !(d.memberId === doc.memberId && (d.status === 'pending' || d.status === 'rejected')));
  const newDoc: VerificationDocument = {
    ...doc,
    id: 'vdoc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };
  filtered.push(newDoc);
  saveAll(filtered);
  return newDoc;
}

/** جلب جميع مستندات التوثيق */
export function getAllVerificationDocs(): VerificationDocument[] {
  return loadAll().sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

/** جلب مستند توثيق لعضو محدد */
export function getMemberVerificationDoc(memberId: string): VerificationDocument | null {
  const docs = loadAll().filter(d => d.memberId === memberId);
  if (docs.length === 0) return null;
  // نرجع الأحدث
  return docs.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
}

/** الحصول على حالة التوثيق لعضو */
export function getVerificationStatus(memberId: string): VerificationStatus {
  const doc = getMemberVerificationDoc(memberId);
  return doc?.status || 'none';
}

/** الموافقة على مستند توثيق */
export function approveVerificationDoc(docId: string, reviewerName: string): boolean {
  const docs = loadAll();
  const doc = docs.find(d => d.id === docId);
  if (!doc) return false;
  doc.status = 'approved';
  doc.reviewedAt = new Date().toISOString();
  doc.reviewedBy = reviewerName;
  saveAll(docs);
  return true;
}

/** رفض مستند توثيق */
export function rejectVerificationDoc(docId: string, reviewerName: string, reason: string): boolean {
  const docs = loadAll();
  const doc = docs.find(d => d.id === docId);
  if (!doc) return false;
  doc.status = 'rejected';
  doc.rejectionReason = reason;
  doc.reviewedAt = new Date().toISOString();
  doc.reviewedBy = reviewerName;
  saveAll(docs);
  return true;
}

/** حذف مستند توثيق (بعد المراجعة لتوفير المساحة) */
export function deleteVerificationDoc(docId: string): boolean {
  const docs = loadAll();
  const filtered = docs.filter(d => d.id !== docId);
  if (filtered.length === docs.length) return false;
  saveAll(filtered);
  return true;
}

/** حذف جميع المستندات المراجَعة (المعتمدة والمرفوضة) */
export function deleteReviewedDocs(): number {
  const docs = loadAll();
  const remaining = docs.filter(d => d.status === 'pending');
  const deletedCount = docs.length - remaining.length;
  saveAll(remaining);
  return deletedCount;
}

/** تنزيل صورة مستند (Base64 → ملف) */
export function downloadDocImage(doc: VerificationDocument) {
  const link = document.createElement('a');
  link.href = doc.docBase64;
  link.download = `${doc.memberNickname}-${doc.docType}-${doc.id.slice(-6)}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** تنزيل جميع المستندات المعلقة كصور منفصلة */
export function downloadAllPendingDocs() {
  const docs = loadAll().filter(d => d.status === 'pending');
  docs.forEach((doc, index) => {
    setTimeout(() => downloadDocImage(doc), index * 500);
  });
  return docs.length;
}
