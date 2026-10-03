import { Crown, MessageSquare } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import PageHeader from '../../components/admin/PageHeader';
import { PLANS } from '../../lib/data';
export default function AdminPlans() {
  const { messagePackages, updateMessagePackage } = useApp();
  return <div className="space-y-6" dir="rtl">
    <PageHeader title="العضويات وباقات الرسائل" subtitle="نموذج تجريبي ثابت: مجاني وتوافق مميز. الرسائل ورسوم الرحلة مستقلة." />
    <div className="grid md:grid-cols-2 gap-6">{PLANS.map(plan => <section key={plan.id} className="bg-white border border-slate-200 rounded-2xl p-6">
      <h3 className="flex items-center gap-2 font-cairo font-bold text-lg"><Crown className="w-5 h-5 text-amber-500" />{plan.name}</h3>
      <p className="my-3 font-bold">{plan.price ? '99 ريال / 30 يومًا' : 'مجاني'}</p>
      <ul className="space-y-2 text-sm text-slate-600">{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
      <p className="mt-4 text-xs text-slate-500">لا تمنح العضوية رصيد رسائل ولا إعفاءً أو خصمًا من رسوم رحلة التوافق.</p>
    </section>)}</div>
      {/* قسم تخصيص باقات الرسائل الإضافية */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 mt-8 space-y-6">
        <div>
          <h3 className="font-cairo font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-500" /> التحكم بباقات رسائل الاستفسار والتواصل الإضافية
          </h3>
          <p className="text-xs text-slate-500 font-tajawal mt-1 font-medium">يمكنك تعديل أسعار وحدود رسائل الاستفسار الإضافية التي يشتريها الأعضاء بشكل مستقل عن العضوية.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 border-t border-slate-100 pt-6" dir="rtl">
          {messagePackages.map((pkg) => (
            <div key={pkg.id} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="font-cairo font-bold text-sm text-slate-800">{pkg.name}</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-cairo font-bold">{pkg.id === 'small' ? 'صغيرة' : pkg.id === 'medium' ? 'متوسطة' : 'كبيرة'}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-cairo font-bold text-slate-500 mb-1">عدد الرسائل</label>
                  <input
                    type="number"
                    value={pkg.credits}
                    onChange={(e) => updateMessagePackage({ ...pkg, credits: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-cairo font-bold text-slate-500 mb-1">السعر (ر.س)</label>
                  <input
                    type="number"
                    value={pkg.price}
                    onChange={(e) => updateMessagePackage({ ...pkg, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-950 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

  </div>;
}
