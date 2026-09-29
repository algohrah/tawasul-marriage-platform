import { useMemo, useState, ChangeEvent } from 'react';
import { Upload, Loader2, CheckCircle2, XCircle, ShieldCheck, Clock, X, Image as ImageIcon } from 'lucide-react';
import Modal from './ui/Modal';
import { compressImage, formatFileSize } from '../lib/imageCompress';
import { type VerificationStatus } from '../lib/data/adapters/local/verificationStore';
import { dataService } from '../lib/data/DataService';
import { useApp } from '../lib/AppContext';

const getMemberVerificationDoc = (memberId: string) => dataService.db.getMemberVerificationDoc(memberId);
const getVerificationStatus = (memberId: string) => dataService.db.getVerificationStatus(memberId);

const REQUIRED_DOCS = [
  { key: 'identity', label: 'إثبات الهوية', hint: 'صورة واضحة للهوية الوطنية أو الإقامة أو جواز السفر' },
  { key: 'portrait', label: 'صورة شخصية حديثة', hint: 'ارفع صورة واضحة لك أو التقطها مباشرة بالكاميرا' },
] as const;

type DocKey = typeof REQUIRED_DOCS[number]['key'];
type PreparedDoc = { base64: string; sizeKB: number; originalSizeKB: number; fileName: string };

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function VerificationUploadModal({ open, onClose }: Props) {
  const { user, showToast } = useApp();
  const [documents, setDocuments] = useState<Partial<Record<DocKey, PreparedDoc>>>({});
  const [processingKey, setProcessingKey] = useState<DocKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentStatus: VerificationStatus = user.memberId ? getVerificationStatus(user.memberId) : 'none';
  const currentDoc = user.memberId ? getMemberVerificationDoc(user.memberId) : null;
  const readyCount = useMemo(() => REQUIRED_DOCS.filter((doc) => documents[doc.key]).length, [documents]);
  const allReady = readyCount === REQUIRED_DOCS.length;

  const handleFileSelect = async (key: DocKey, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('يرجى اختيار صورة فقط لكل مستند', 'error');
      return;
    }

    setProcessingKey(key);
    try {
      // ضغط كل صورة إلى حجم مناسب حتى تُرفع المستندات الثلاثة بأمان عبر Netlify.
      const result = await compressImage(file, 0.75, 1200);
      setDocuments((prev) => ({
        ...prev,
        [key]: {
          base64: result.base64,
          sizeKB: result.sizeKB,
          originalSizeKB: Math.round(file.size / 1024),
          fileName: file.name,
        },
      }));
    } catch (err: any) {
      showToast(err.message || 'فشل تجهيز الصورة', 'error');
    } finally {
      setProcessingKey(null);
    }
  };

  const handleSubmit = async () => {
    if (!user.memberId || !allReady) {
      showToast('يرجى رفع إثبات الهوية والصورة الشخصية معًا', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // تُرسل الملفات كطلبات مستقلة ضمن عملية واحدة حتى لا نتجاوز حد حجم الطلب.
      await Promise.all(REQUIRED_DOCS.map((slot) => {
        const prepared = documents[slot.key]!;
        return Promise.resolve((dataService.db as any).submitVerificationDoc({
          id: `verify_${user.memberId}_${slot.key}`,
          memberId: user.memberId,
          memberNickname: user.profile.name || user.name,
          memberRealName: user.profile.realName,
          memberEmail: user.profile.email,
          docType: slot.label,
          docName: `${slot.label}.jpg`,
          fileName: `${slot.label}.jpg`,
          docBase64: prepared.base64,
          docSizeKB: prepared.sizeKB,
          status: 'pending',
        }));
      }));

      showToast('تم رفع جميع مستندات التوثيق وإرسالها للإدارة ✓', 'success');
      setDocuments({});
      window.dispatchEvent(new CustomEvent('twafok_verification_docs_changed'));
      onClose();
    } catch (err: any) {
      showToast(err.message || 'فشل رفع أحد المستندات؛ لم تكتمل العملية', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setProcessingKey(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="التحقق من الحساب — رفع المستندات" size="lg">
      <div className="space-y-4 text-right" dir="rtl">
        {currentStatus === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-xs font-cairo text-amber-800">مستنداتك قيد المراجعة. لا يمكن إرسال دفعة أخرى حتى انتهاء المراجعة.</p>
          </div>
        )}
        {currentStatus === 'approved' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-xs font-cairo text-emerald-800">تم توثيق حسابك بنجاح ✓</p>
          </div>
        )}
        {currentStatus === 'rejected' && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
            <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-cairo text-rose-800 font-bold">تم رفض طلب التوثيق السابق</p>
              {currentDoc?.rejectionReason && <p className="text-xs font-cairo text-rose-600 mt-0.5">السبب: {currentDoc.rejectionReason}</p>}
              <p className="text-xs font-cairo text-rose-500 mt-1">يمكنك رفع الدفعة الكاملة مجددًا.</p>
            </div>
          </div>
        )}

        <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <p className="text-xs font-cairo text-blue-800 leading-relaxed">
            ارفع إثبات الهوية والصورة الشخصية في هذه الشاشة ثم اضغط «إرسال المستندات». تُراجع الملفات من الإدارة فقط ولا تظهر للأعضاء.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {REQUIRED_DOCS.map((slot) => {
            const prepared = documents[slot.key];
            const processing = processingKey === slot.key;
            return (
              <div key={slot.key} className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <div className="p-3 border-b border-slate-200 min-h-[74px]">
                  <p className="text-xs font-cairo font-bold text-slate-800">{slot.label}</p>
                  <p className="text-[10px] font-tajawal text-slate-500 mt-1">{slot.hint}</p>
                </div>

                {prepared ? (
                  <div className="relative">
                    <img src={prepared.base64} alt={slot.label} className="w-full aspect-[4/3] object-cover bg-white" />
                    <button
                      type="button"
                      onClick={() => setDocuments((prev) => ({ ...prev, [slot.key]: undefined }))}
                      className="absolute top-2 left-2 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center"
                      aria-label={`إزالة ${slot.label}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="p-2 text-[10px] font-tajawal text-emerald-700 text-center">
                      جاهز — {formatFileSize(prepared.sizeKB)}
                    </div>
                  </div>
                ) : (
                  <div className={`min-h-[150px] p-4 flex flex-col items-center justify-center gap-3 text-center ${processing ? 'pointer-events-none opacity-60' : ''}`}>
                    {processing ? <Loader2 className="w-7 h-7 text-amber-500 animate-spin" /> : <ImageIcon className="w-7 h-7 text-slate-400" />}
                    <span className="text-[11px] font-cairo font-bold text-slate-600">{processing ? 'جارٍ تجهيز الصورة...' : 'اختر طريقة إضافة الصورة'}</span>
                    <div className="w-full grid gap-2">
                      <label className="w-full py-2 px-3 rounded-lg bg-white border border-slate-200 text-[11px] font-cairo font-bold text-slate-700 cursor-pointer hover:border-amber-400 hover:bg-amber-50">
                        رفع صورة
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={processing || submitting || currentStatus === 'pending'}
                          onChange={(event) => handleFileSelect(slot.key, event)}
                        />
                      </label>
                      {slot.key === 'portrait' && (
                        <label className="w-full py-2 px-3 rounded-lg bg-slate-900 text-[11px] font-cairo font-bold text-white cursor-pointer hover:bg-slate-800">
                          التقاط من الكاميرا
                          <input
                            type="file"
                            accept="image/*"
                            capture="user"
                            className="hidden"
                            disabled={processing || submitting || currentStatus === 'pending'}
                            onChange={(event) => handleFileSelect(slot.key, event)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs font-cairo text-slate-600">
          <span>الملفات الجاهزة: {readyCount} من {REQUIRED_DOCS.length}</span>
          <span className={allReady ? 'text-emerald-600 font-bold' : 'text-amber-600'}>{allReady ? 'اكتملت الدفعة ✓' : 'أكمل جميع الملفات'}</span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!allReady || submitting || processingKey !== null || currentStatus === 'pending'}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ رفع المستندات...</> : <><ShieldCheck className="w-4 h-4" /> إرسال المستندات للمراجعة</>}
        </button>
      </div>
    </Modal>
  );
}
