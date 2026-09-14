import { useState, useRef, ChangeEvent } from 'react';
import { Upload, Loader2, CheckCircle2, XCircle, ShieldCheck, Clock, X } from 'lucide-react';
import Modal from './ui/Modal';
import { compressImage, formatFileSize } from '../lib/imageCompress';
import { type VerificationStatus } from '../lib/data/adapters/local/verificationStore';
import { dataService } from '../lib/data/DataService';

import { useApp } from '../lib/AppContext';
const submitVerificationDoc = (doc: any) => dataService.db.submitVerificationDoc(doc);
const getMemberVerificationDoc = (memberId: string) => dataService.db.getMemberVerificationDoc(memberId);
const getVerificationStatus = (memberId: string) => dataService.db.getVerificationStatus(memberId);


const DOC_TYPES = [
  'هوية وطنية / إقامة',
  'إثبات الحالة الاجتماعية',
  'صورة شخصية حديثة',
  'مستند آخر',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function VerificationUploadModal({ open, onClose }: Props) {
  const { user, showToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [compressed, setCompressed] = useState<{ base64: string; sizeKB: number } | null>(null);
  const [originalSizeKB, setOriginalSizeKB] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentStatus: VerificationStatus = user.memberId ? getVerificationStatus(user.memberId) : 'none';
  const currentDoc = user.memberId ? getMemberVerificationDoc(user.memberId) : null;

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('يرجى اختيار ملف صورة فقط', 'error');
      return;
    }

    setProcessing(true);
    setCompressed(null);
    const originalKB = Math.round(file.size / 1024);
    setOriginalSizeKB(originalKB);

    try {
      const result = await compressImage(file, 1, 1200);
      setCompressed({ base64: result.base64, sizeKB: result.sizeKB });
      showToast(`تم ضغط الصورة من ${formatFileSize(originalKB)} إلى ${formatFileSize(result.sizeKB)} ✓`, 'success');
    } catch (err: any) {
      showToast(err.message || 'فشل ضغط الصورة', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = () => {
    if (!compressed || !user.memberId) {
      showToast('يرجى رفع صورة المستند أولاً', 'error');
      return;
    }

    setSubmitting(true);
    try {
      submitVerificationDoc({
        memberId: user.memberId,
        memberNickname: user.profile.name || user.name,
        memberRealName: user.profile.realName,
        memberEmail: user.profile.email,
        docType,
        docName: docType + '.jpg',
        docBase64: compressed.base64,
        docSizeKB: compressed.sizeKB,
      });
      showToast('تم رفع مستند التوثيق بنجاح وسيتم مراجعته من قبل الإدارة ✓', 'success');
      setCompressed(null);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'فشل رفع المستند', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCompressed(null);
    setProcessing(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="التحقق من الحساب — رفع المستندات" size="md">
      <div className="space-y-4 text-right" dir="rtl">
        {currentStatus === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-xs font-cairo text-amber-800">
              مستندك قيد المراجعة من قبل الإدارة. سيتم إشعارك فور الانتهاء.
            </p>
          </div>
        )}
        {currentStatus === 'approved' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-xs font-cairo text-emerald-800">
              تم توثيق حسابك بنجاح! ✓
            </p>
          </div>
        )}
        {currentStatus === 'rejected' && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
            <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-cairo text-rose-800 font-bold">تم رفض مستندك</p>
              {currentDoc?.rejectionReason && (
                <p className="text-xs font-cairo text-rose-600 mt-0.5">السبب: {currentDoc.rejectionReason}</p>
              )}
              <p className="text-xs font-cairo text-rose-500 mt-1">يمكنك رفع مستند جديد أدناه.</p>
            </div>
          </div>
        )}

        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <p className="text-xs font-cairo text-slate-600 leading-relaxed">
            📋 لطلب التوثيق، ارفع صورة واضحة من أحد المستندات التالية:
            <br />• الهوية الوطنية أو الإقامة
            <br />• إثبات الحالة الاجتماعية
            <br />• صورة شخصية حديثة
            <br /><br />
            🔒 سيتم ضغط الصورة تلقائياً قبل الرفع لحماية بياناتك وتوفير المساحة.
            <br />👁️ المستند يُراجع من قبل الإدارة فقط ولا يظهر للأعضاء.
          </p>
        </div>

        <div>
          <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">نوع المستند</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm"
          >
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">صورة المستند</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {!compressed ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processing || currentStatus === 'pending'}
              className="w-full py-8 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/50 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  <span className="text-xs font-cairo text-slate-500">جارٍ ضغط الصورة...</span>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-400" />
                  <span className="text-xs font-cairo text-slate-500">اضغط لاختيار صورة المستند</span>
                  <span className="text-[10px] text-slate-400 font-tajawal">سيتم ضغطها تلقائياً (حد أقصى 1 ميجا)</span>
                </>
              )}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <img src={compressed.base64} alt="معاينة المستند" className="w-full max-h-64 object-contain" />
                <button
                  onClick={() => setCompressed(null)}
                  className="absolute top-2 left-2 w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between text-xs font-cairo">
                <span className="text-slate-500">
                  الحجم الأصلي: <span className="line-through text-slate-400">{formatFileSize(originalSizeKB)}</span>
                </span>
                <span className="text-emerald-600 font-bold">
                  بعد الضغط: {formatFileSize(compressed.sizeKB)} ✓
                </span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!compressed || submitting || currentStatus === 'pending'}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الإرسال...</>
          ) : (
            <><ShieldCheck className="w-4 h-4" /> إرسال للمراجعة</>
          )}
        </button>
      </div>
    </Modal>
  );
}
