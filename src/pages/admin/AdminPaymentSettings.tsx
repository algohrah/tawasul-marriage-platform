import { useState } from 'react';
import { CreditCard, Save, Check, HelpCircle, Bitcoin, Building2 } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import PageHeader from '../../components/admin/PageHeader';

export default function AdminPaymentSettings() {
  const { paypalSettings, updatePaypalSettings, paymentSettings, updatePaymentSettings, showToast } = useApp();
  const [saved, setSaved] = useState(false);

  const [paypalForm, setPaypalForm] = useState({ ...paypalSettings });
  const [paymentsForm, setPaymentsForm] = useState({ ...paymentSettings });

  const handleSave = () => {
    updatePaypalSettings(paypalForm);
    updatePaymentSettings(paymentsForm);
    setSaved(true);
    showToast('تم حفظ إعدادات الدفع بنجاح', 'success');
    setTimeout(() => setSaved(false), 2500);
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm';
  const labelClass = 'block text-xs font-cairo font-bold text-slate-700 mb-1.5';

  return (
    <div className="space-y-5 text-right" dir="rtl">
      <PageHeader
        icon={CreditCard}
        title="إعدادات الدفع"
        subtitle="تحكم في بوابات الدفع وقنوات الاستلام"
        action={
          <button
            onClick={handleSave}
            aria-label="حفظ إعدادات الدفع"
            className={`flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold text-sm hover:bg-slate-800 transition-colors ${
              saved ? 'bg-emerald-500 hover:bg-emerald-600' : ''
            }`}
          >
            {saved ? <><Check className="w-4 h-4" /> تم الحفظ</> : <><Save className="w-4 h-4" /> حفظ</>}
          </button>
        }
      />

      {/* PayPal */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <h3 className="font-cairo font-bold text-slate-900 flex items-center gap-2.5">
            <CreditCard className="w-5.5 h-5.5 text-amber-500" /> PayPal
          </h3>
          <button
            type="button"
            onClick={() => setPaypalForm({ ...paypalForm, active: !paypalForm.active })}
            className={`px-3 py-1.5 rounded-lg text-xs font-cairo font-bold ${
              paypalForm.active
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            {paypalForm.active ? 'البوابة مفعّلة ✓' : 'البوابة معطلة ✕'}
          </button>
        </div>

        <div className="bg-amber-50/40 border border-amber-100/70 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 font-tajawal leading-relaxed">
            <p className="font-bold font-cairo text-amber-900 mb-1">كيف تعمل هذه الميزة؟</p>
            <p>
              عند حفظ بيانات PayPal، ستقوم بوابة الدفع في صفحة الترقية بتحميل أزرار PayPal الحقيقية باستخدام معرف العميل (Client ID) المدخل.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>PayPal Client ID</label>
            <input
              value={paypalForm.clientId}
              onChange={(e) => setPaypalForm({ ...paypalForm, clientId: e.target.value })}
              className={`${inputClass} font-mono text-left tracking-wide`}
              placeholder="AX_..."
              dir="ltr"
            />
          </div>
          <div>
            <label className={labelClass}>Client Secret</label>
            <input
              type="password"
              value={paypalForm.clientSecret}
              onChange={(e) => setPaypalForm({ ...paypalForm, clientSecret: e.target.value })}
              className={`${inputClass} font-mono text-left`}
              placeholder="••••••••"
              dir="ltr"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-50">
          <div>
            <label className={labelClass}>بيئة العمل</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(['sandbox', 'live'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaypalForm({ ...paypalForm, mode })}
                  className={`py-2 rounded-xl border-2 font-cairo text-xs font-bold ${
                    paypalForm.mode === mode
                      ? 'bg-amber-50 border-amber-400 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-amber-200'
                  }`}
                >
                  {mode === 'sandbox' ? 'اختبار (Sandbox)' : 'إنتاج (Live)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>تمكين الدفع المباشر بالبطاقة</label>
            <button
              type="button"
              onClick={() => setPaypalForm({ ...paypalForm, guestCheckout: !paypalForm.guestCheckout })}
              className={`w-full mt-1 py-3 rounded-xl border-2 font-cairo text-xs font-bold flex items-center justify-center gap-2 ${
                paypalForm.guestCheckout
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  : 'bg-rose-50 border-rose-300 text-rose-800'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  paypalForm.guestCheckout ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {paypalForm.guestCheckout
                ? 'الدفع المباشر بالبطاقة مفعّل ✓'
                : 'إلزام المستخدم بحساب PayPal'}
            </button>
          </div>
        </div>
      </div>

      {/* Other payment methods */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
        <h3 className="font-cairo font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Building2 className="w-5.5 h-5.5 text-amber-500" /> قنوات الدفع البديلة
        </h3>

        <div className="grid sm:grid-cols-3 gap-3 pt-2">
          {[
            { key: 'paypalActive' as const, label: 'باي بال', desc: 'دفع مباشر بالبطاقات' },
            { key: 'cryptoActive' as const, label: 'العملات الرقمية', desc: 'USDT مع رفع إثبات' },
            { key: 'bankActive' as const, label: 'التحويل البنكي', desc: 'حسابات بنكية محلية' },
          ].map((method) => (
            <label
              key={method.key}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-all"
            >
              <input
                type="checkbox"
                checked={!!paymentsForm[method.key]}
                onChange={(e) =>
                  setPaymentsForm({ ...paymentsForm, [method.key]: e.target.checked })
                }
                className="rounded text-amber-500 focus:ring-amber-400 w-4.5 h-4.5"
              />
              <div>
                <span className="block font-cairo font-bold text-xs text-slate-700">{method.label}</span>
                <span className="text-[10px] text-slate-400 font-tajawal">{method.desc}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="bg-amber-50/20 p-4 rounded-xl border border-amber-100/60 mt-3">
          <label className={labelClass}>وضع التحكم في تشغيل الطرق</label>
          <select
            value={paymentsForm.forceSingleMethod}
            onChange={(e) =>
              setPaymentsForm({
                ...paymentsForm,
                forceSingleMethod: e.target.value as any,
              })
            }
            className={inputClass}
          >
            <option value="none">عرض جميع طرق الدفع المفعّلة</option>
            <option value="paypal">إجبار تشغيل باي بال فقط</option>
            <option value="crypto">إجبار تشغيل العملات الرقمية فقط</option>
            <option value="bank">إجبار تشغيل التحويل البنكي فقط</option>
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className={labelClass}>محفظة استلام العملات الرقمية</label>
            <input
              type="text"
              value={paymentsForm.cryptoWalletAddress}
              onChange={(e) =>
                setPaymentsForm({ ...paymentsForm, cryptoWalletAddress: e.target.value })
              }
              className={`${inputClass} font-mono text-left`}
              placeholder="0x..."
              dir="ltr"
            />
          </div>
          <div>
            <label className={labelClass}>تفاصيل الحساب البنكي</label>
            <textarea
              rows={2}
              value={paymentsForm.bankDetails}
              onChange={(e) => setPaymentsForm({ ...paymentsForm, bankDetails: e.target.value })}
              className={inputClass}
              placeholder="اسم البنك... الآيبان..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
