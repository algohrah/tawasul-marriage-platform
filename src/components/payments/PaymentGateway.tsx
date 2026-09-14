import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Lock, Check, ShieldCheck, Crown, X,
  Wallet, Coins, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { dataService } from '../../lib/data/DataService';



// ============================================================
//  بوابة الدفع الموحّدة — تُستخدم لكل المدفوعات داخل المنصة
//  (باقة الرسائل، رسوم الجدية، الباقات...)
//  تقرأ طرق الدفع من إعدادات الموقع (paymentSettings / paypalSettings)
//  لضمان ربط كل عملية دفع بنفس وسائل الدفع المعتمدة في المنصة.
// ============================================================

export interface PaymentGatewayProps {
  open: boolean;
  onClose: () => void;
  /** المبلغ الأساسي قبل الضريبة (ر.س) */
  amount: number;
  /** عنوان عملية الدفع، مثل: "باقة رسائل الاستفسار" */
  title: string;
  /** وصف مختصر يظهر تحت العنوان */
  description?: string;
  /** بنود/مزايا تُعرض في ملخص الفاتورة */
  lineItems?: { label: string; value: string }[];
  /** هل تُطبّق ضريبة القيمة المضافة 15%؟ (افتراضي: نعم) */
  applyVat?: boolean;
  /** نص زر الدفع — يُضاف إليه المبلغ تلقائياً */
  payLabel?: string;
  /** يُستدعى عند نجاح الدفع — هنا تُنفّذ العملية الفعلية (شراء/سداد) */
  onPaid: (method: string) => Promise<boolean> | boolean;
  /** معرّف طلب الاهتمام المرتبط (لرسوم الجدية) — يُرفق مع المعاملة ليستخدمه المشرف عند الاعتماد */
  requestId?: number;
  /** هل تمر المدفوعات اليدوية (بنكي/عملات رقمية) عبر مراجعة إدارية قبل التفعيل؟ (افتراضي: false للحفاظ على السلوك الحالي في بقات الرسائل/السعي) */
  requiresOfflineReview?: boolean;
  /** بيانات إضافية تُرفق مع المعاملة (مثل عدد رسائل الباقة) ليستخدمها المشرف عند الاعتماد الفعلي */
  metadata?: Record<string, any>;
}

type Method = { id: string; label: string; icon: any; desc: string };

export default function PaymentGateway({
  open, onClose, amount, title, description, lineItems = [],
  applyVat = true, payLabel = 'تأكيد ودفع', onPaid, requestId, requiresOfflineReview = false, metadata,
}: PaymentGatewayProps) {
  const {
    paypalSettings,
    paymentSettings = {
      paypalActive: true, cryptoActive: true, bankActive: true,
      cryptoWalletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F (USDT ERC20)',
      bankDetails: 'مصرف الراجحي - رقم الحساب: SA8980000012345678901234',
      forceSingleMethod: 'none' as const,
    },
    showToast,
  } = useApp();

  const currentUserId = useMemo(() => {
    if (dataService.db.getCurrentUserId) {
      return dataService.db.getCurrentUserId();
    }
    return 'm2';
  }, []);

  const currentMember = useMemo(() => {
    if (dataService.db.getLiveMemberById) {
      return dataService.db.getLiveMemberById(currentUserId);
    }
    return null;
  }, [currentUserId]);

  const mName = currentMember?.nickname || 'العضو';

  const vat = applyVat ? Math.round(amount * 0.15) : 0;
  const total = amount + vat;

  // ===== تحديد طرق الدفع المتاحة من إعدادات المنصة =====
  const isForced = paymentSettings.forceSingleMethod && paymentSettings.forceSingleMethod !== 'none';
  const methods = useMemo<Method[]>(() => {
    const list: Method[] = [];
    if (isForced) {
      if (paymentSettings.forceSingleMethod === 'paypal' && paypalSettings.active)
        list.push({ id: 'paypal', label: 'باي بال والبطاقات', icon: CreditCard, desc: 'بوابة PayPal وائتمان' });
      else if (paymentSettings.forceSingleMethod === 'crypto' && paymentSettings.cryptoActive)
        list.push({ id: 'crypto', label: 'العملات الرقمية', icon: Coins, desc: 'تحويل USDT آمن' });
      else if (paymentSettings.forceSingleMethod === 'bank' && paymentSettings.bankActive)
        list.push({ id: 'bank', label: 'حوالة بنكية', icon: Wallet, desc: 'تحويل فروع المملكة' });
      return list;
    }
    if (paypalSettings.active && paymentSettings.paypalActive)
      list.push({ id: 'paypal', label: 'باي بال والبطاقات', icon: CreditCard, desc: 'بوابة PayPal وائتمان' });
    if (paymentSettings.cryptoActive)
      list.push({ id: 'crypto', label: 'العملات الرقمية', icon: Coins, desc: 'تحويل USDT آمن' });
    if (paymentSettings.bankActive)
      list.push({ id: 'bank', label: 'حوالة بنكية', icon: Wallet, desc: 'الراجحي / الأهلي' });
    return list;
  }, [isForced, paypalSettings.active, paymentSettings]);

  const [method, setMethod] = useState<string>(methods[0]?.id || 'paypal');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);

  // أوفلاين
  const [cryptoTxid, setCryptoTxid] = useState('');
  const [senderName, setSenderName] = useState('');
  const [transferredBank, setTransferredBank] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);

  // إعادة الضبط عند الفتح
  useEffect(() => {
    if (open) {
      setMethod(methods[0]?.id || 'paypal');
      setProcessing(false); setSuccess(false);
      setCryptoTxid(''); setSenderName(''); setTransferredBank(''); setReceipt(null);
    }
  }, [open]);

  const txType = title.includes('استفسار') ? 'inquiry' : title.includes('جدية') ? 'deposit' : title.includes('سعي') ? 'final' : 'subscription';
  // المدفوعات اليدوية (بنكي/عملات رقمية) تمر عبر مراجعة إدارية قبل التفعيل الفعلي لمنع التفعيل الوهمي الفوري
  const isOfflineMethod = method === 'crypto' || method === 'bank';
  const needsReview = requiresOfflineReview && isOfflineMethod;

  const finalize = useCallback(async () => {
    setProcessing(true);
    // محاكاة معالجة بوابة الدفع
    await new Promise((r) => setTimeout(r, 1400));

    if (needsReview) {
      // دفع يدوي يتطلب مراجعة إدارية قبل التفعيل — لا يُستدعى onPaid() هنا إطلاقاً
      dataService.db.recordTransaction({
        memberId: currentUserId,
        user_id: currentUserId,
        request_id: requestId,
        memberName: mName,
        type: txType,
        description: title,
        amount: total,
        method: method as any,
        status: 'pending',
        metadata,
      });
      setProcessing(false);
      setPendingReview(true);
      setSuccess(true);
      return;
    }

    dataService.db.recordTransaction({
      memberId: currentUserId,
      user_id: currentUserId,
      request_id: requestId,
      memberName: mName,
      type: txType,
      description: title,
      amount: total,
      method: method as any,
      status: 'completed',
      metadata,
    });
    const ok = await onPaid(method);
    setProcessing(false);
    if (ok) {
      setPendingReview(false);
      setSuccess(true);
      setTimeout(() => { onClose(); }, 1600);
    } else {
      showToast('تعذّر إتمام العملية بعد الدفع، حاول مرة أخرى', 'error');
    }
  }, [method, onPaid, onClose, showToast, title, total, currentUserId, mName, needsReview, requestId, txType, metadata]);

  const handleOfflinePay = () => {
    if (method === 'crypto' && !cryptoTxid) {
      showToast('يرجى إدخال رمز المعاملة (TXID)', 'error');
      return;
    }
    if (method === 'bank' && (!senderName || !transferredBank)) {
      showToast('يرجى ملء اسم المرسل والبنك المحوّل', 'error');
      return;
    }
    if (!receipt) {
      showToast('يرجى إرفاق صورة إيصال التحويل', 'error');
      return;
    }
    finalize();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" dir="rtl">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
          onClick={() => !processing && onClose()}
        />
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="relative bg-cream-50 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl border border-cream-200/60 max-h-[92vh] overflow-y-auto"
        >
          {/* رأس */}
          <div className="sticky top-0 z-10 bg-navy-gradient px-5 py-4 sm:rounded-t-3xl rounded-t-3xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-navy-900" />
              </div>
              <div>
                <h3 className="font-cairo font-extrabold text-white text-sm">{title}</h3>
                {description && <p className="text-[11px] text-cream-200 font-cairo mt-0.5">{description}</p>}
              </div>
            </div>
            <button onClick={() => !processing && onClose()} className="text-white/70 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {success ? (
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle2 className="w-11 h-11 text-emerald-600" />
              </motion.div>
              <h4 className="font-cairo font-extrabold text-xl text-navy-900">{pendingReview ? 'تم إرسال الإثبات! ⏳' : 'تم الدفع بنجاح!'}</h4>
              <p className="text-navy-600 font-cairo text-sm mt-1.5">
                {pendingReview
                  ? `سيقوم فريق الإدارة بمراجعة إثبات التحويل (${total} ر.س) وتفعيل العملية خلال دقائق.`
                  : `تم استلام مبلغ ${total} ر.س وتفعيل العملية.`}
              </p>
              {pendingReview && (
                <button onClick={onClose} className="mt-4 px-5 py-2.5 rounded-xl bg-navy-900 text-white font-cairo font-bold text-xs hover:bg-navy-800 transition-colors">
                  إغلاق
                </button>
              )}
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* ملخص الفاتورة */}
              <div className="bg-white rounded-2xl p-4 shadow-soft border border-cream-200/60">
                {lineItems.length > 0 && (
                  <div className="space-y-1.5 mb-3 pb-3 border-b border-cream-100">
                    {lineItems.map((it) => (
                      <div key={it.label} className="flex justify-between text-xs">
                        <span className="text-navy-500 font-cairo">{it.label}</span>
                        <span className="font-cairo font-bold text-navy-800">{it.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between text-xs">
                  <span className="text-navy-500 font-cairo">المبلغ الأساسي</span>
                  <span className="font-cairo font-semibold text-navy-900">{amount} ر.س</span>
                </div>
                {applyVat && (
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-navy-500 font-cairo">ضريبة القيمة المضافة (15%)</span>
                    <span className="font-cairo font-semibold text-navy-900">{vat} ر.س</span>
                  </div>
                )}
                <div className="flex justify-between pt-2.5 mt-2.5 border-t border-cream-200">
                  <span className="font-cairo font-bold text-navy-900 text-sm">المجموع المطلوب</span>
                  <span className="font-cairo font-extrabold text-base text-gradient-gold">{total} ر.س</span>
                </div>
              </div>

              {/* طرق الدفع */}
              <div>
                <h4 className="font-cairo font-bold text-navy-900 text-xs mb-2.5">اختر طريقة الدفع المعتمدة</h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 transition-all text-right ${
                        method === m.id ? 'border-amber-400 bg-amber-50/30' : 'border-cream-200 bg-white hover:border-amber-200'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${method === m.id ? 'bg-gold-gradient text-navy-900' : 'bg-cream-100 text-navy-500'}`}>
                        <m.icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-cairo font-bold text-navy-900 text-[11px] leading-tight">{m.label}</p>
                        <p className="text-[9px] text-navy-400 font-cairo">{m.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ===== نماذج حسب الطريقة ===== */}
              {(method === 'paypal') && (
                <div className="bg-white rounded-2xl p-4 shadow-soft border border-cream-200/60 text-center space-y-3">
                  <div className="bg-amber-50 rounded-xl p-2.5 text-[11px] text-amber-900 font-cairo leading-relaxed">
                    سيتم تحويلك لبوابة PayPal الآمنة لإتمام الدفع بحسابك أو بطاقتك مباشرة.
                  </div>
                  <button
                    onClick={finalize} disabled={processing}
                    className="w-full py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-500 text-navy-900 font-cairo font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  >
                    {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                      <span className="font-extrabold italic text-sky-800">Pay<span className="text-blue-500">Pal</span></span>
                    )}
                    {processing ? 'جارِ المعالجة...' : `ادفع ${total} ر.س عبر PayPal`}
                  </button>
                </div>
              )}

              {(method === 'crypto') && (
                <div className="bg-white rounded-2xl p-4 shadow-soft border border-cream-200/60 space-y-3">
                  <div className="bg-amber-50/60 p-3 rounded-xl text-[11px] leading-relaxed text-amber-900 font-cairo space-y-0.5">
                    <p className="font-bold">حوّل ما يعادل {(total / 3.75).toFixed(2)} USDT إلى العنوان التالي:</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input readOnly value={paymentSettings.cryptoWalletAddress}
                      className="w-full px-3 py-2.5 rounded-xl bg-cream-50 border border-cream-200 font-mono text-center text-[10px] text-navy-900 focus:outline-none" />
                    <button onClick={() => { navigator.clipboard.writeText(paymentSettings.cryptoWalletAddress); showToast('تم نسخ العنوان', 'success'); }}
                      className="px-3 py-2.5 rounded-xl bg-navy-900 text-white font-cairo font-bold text-xs hover:bg-navy-800 transition-colors">نسخ</button>
                  </div>
                  <input placeholder="رمز المعاملة (TXID / Hash) *" value={cryptoTxid} onChange={(e) => setCryptoTxid(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-cream-50 border border-cream-200 focus:border-gold-500 focus:outline-none text-right font-mono text-xs text-navy-800" />
                  <ReceiptUpload receipt={receipt} setReceipt={setReceipt} showToast={showToast} />
                  <PayButton onClick={handleOfflinePay} processing={processing} label="إرسال إثبات التحويل الرقمي" />
                </div>
              )}

              {(method === 'bank') && (
                <div className="bg-white rounded-2xl p-4 shadow-soft border border-cream-200/60 space-y-3">
                  <div className="p-3 bg-cream-50 border border-cream-100 rounded-xl font-cairo text-[11px] text-navy-900 whitespace-pre-wrap leading-loose">
                    {paymentSettings.bankDetails}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input placeholder="اسم المحوّل *" value={senderName} onChange={(e) => setSenderName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 border border-cream-200 focus:border-gold-500 focus:outline-none text-right text-xs text-navy-800" />
                    <input placeholder="البنك المحوّل منه *" value={transferredBank} onChange={(e) => setTransferredBank(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 border border-cream-200 focus:border-gold-500 focus:outline-none text-right text-xs text-navy-800" />
                  </div>
                  <ReceiptUpload receipt={receipt} setReceipt={setReceipt} showToast={showToast} />
                  <PayButton onClick={handleOfflinePay} processing={processing} label="تأكيد الحوالة وإرسال الإيصال" />
                </div>
              )}

              {/* شارات الأمان */}
              <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
                {[
                  { icon: Lock, label: 'تشفير SSL 256-bit' },
                  { icon: ShieldCheck, label: 'معالجة آمنة' },
                  { icon: Check, label: 'تفعيل فوري' },
                ].map((b) => (
                  <div key={b.label} className="flex items-center gap-1 text-[10px] text-navy-400 font-cairo">
                    <b.icon className="w-3.5 h-3.5 text-emerald-500" /> {b.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function PayButton({ onClick, processing, label }: { onClick: () => void; processing: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={processing}
      className="w-full py-3.5 rounded-2xl bg-gold-gradient text-navy-900 font-cairo font-extrabold text-sm shadow-gold hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0 flex items-center justify-center gap-2">
      {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
      {processing ? 'جارِ معالجة الدفع...' : label}
    </button>
  );
}

function ReceiptUpload({ receipt, setReceipt, showToast }: any) {
  return (
    <div>
      <div className="border-2 border-dashed border-cream-300 rounded-xl p-3.5 text-center cursor-pointer hover:bg-cream-50/50 transition-colors relative">
        <input type="file" accept="image/*"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0];
            if (f) { setReceipt(f); showToast('تم تحميل الإيصال', 'success'); }
          }}
          className="absolute inset-0 opacity-0 cursor-pointer" />
        <span className="block text-[11px] font-cairo font-bold text-gold-700">إرفاق صورة إيصال التحويل 📄</span>
        <span className="block text-[9px] text-navy-400 font-cairo">PNG / JPG</span>
      </div>
      {receipt && (
        <div className="mt-1.5 text-[11px] text-emerald-700 font-cairo text-center flex items-center justify-center gap-1">
          <Check className="w-4 h-4" /> {receipt.name} ({(receipt.size / 1024).toFixed(1)} KB)
        </div>
      )}
    </div>
  );
}
