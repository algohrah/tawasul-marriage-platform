import { useState } from 'react';
import { Edit3, Crown, Check, MessageSquare, Heart, ShieldAlert, Key, Trash2 } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/admin/PageHeader';
import type { Plan } from '../../lib/types';

export default function AdminPlans() {
  const { 
    plans, 
    updatePlan, 
    addPlan, 
    deletePlan, 
    interestPurchaseSettings, 
    updateInterestPurchaseSettings, 
    messagePackages, 
    updateMessagePackage,
    showToast
  } = useApp();
  
  const [editing, setEditing] = useState<Plan | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getLimitText = (num: number | undefined) => {
    if (num === undefined) return 'غير محدد';
    if (num >= 999) return 'بلا حدود';
    return `${num} رسالة`;
  };

  const getRequestText = (num: number | undefined) => {
    if (num === undefined) return 'غير محدد';
    if (num >= 99) return 'بلا حدود';
    return `${num} طلب/يومياً`;
  };

  const handleDeleteConfirm = () => {
    if (deletingId) {
      if (plans.length <= 1) {
        showToast('لا يمكن حذف الباقة الأخيرة، يجب بقاء باقة واحدة على الأقل.', 'error');
        setDeletingId(null);
        return;
      }
      deletePlan(deletingId);
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Title & Add Button */}
      <div className="border-b border-slate-100 pb-4">
      <PageHeader
        title="الباقات والأسعار والحدود التشغيلية"
        subtitle="تحكم في باقات الاشتراك، أسعارها، وميزاتها، بالإضافة إلى حدود وخيارات التوافق والتواصل الخاصة بكل باقة."
        action={
        <button
          aria-label="إضافة باقة جديدة"
          onClick={() => setEditing({
            id: '',
            name: '',
            price: 0,
            period: 'شهريًا',
            description: '',
            features: [],
            color: 'navy',
            messagesLimit: 10,
            requestsLimit: 5,
            searchLimit: 10,
            showContactLimit: 5,
            durationDays: 30,
            advancedFilters: false,
            hidden: false,
          })}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-sm transition-colors shadow-sm self-start flex items-center gap-1.5"
        >
          <span>+ إضافة باقة جديدة</span>
        </button>
        }
      />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className={`bg-white rounded-2xl p-6 shadow-sm border-2 relative flex flex-col justify-between ${plan.popular ? 'border-amber-400 shadow-md' : 'border-slate-200'}`}>
            <div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {plan.popular && (
                  <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-cairo font-bold">الأكثر شعبية ⭐</span>
                )}
                {plan.hidden && (
                  <span className="inline-block px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-cairo font-bold">مخفية (إدارية فقط) 👁️✕</span>
                )}
                {!plan.hidden && (
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-cairo font-bold">مرئية للأعضاء 👁️✓</span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className={`w-5 h-5 ${plan.color === 'gold' ? 'text-amber-500' : plan.color === 'rose' ? 'text-rose-500' : 'text-slate-500'}`} />
                <h3 className="font-cairo font-bold text-lg text-slate-900">{plan.name}</h3>
              </div>
              <div className="mb-4">
                <span className="font-cairo font-extrabold text-3xl text-slate-900">{plan.price}</span>
                <span className="text-slate-500 font-tajawal text-sm"> ر.س / {plan.period}</span>
              </div>
              <p className="text-sm text-slate-500 font-tajawal mb-4">{plan.description}</p>

              {/* operational limits bento */}
              <div className="bg-slate-50 rounded-xl p-3.5 mb-5 space-y-2.5 border border-slate-100">
                <div className="flex items-center justify-between text-xs font-tajawal">
                  <span className="text-slate-400 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" /> حد الرسائل:
                  </span>
                  <span className="font-bold text-slate-700">{getLimitText(plan.messagesLimit)}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-tajawal">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-slate-400" /> حد طلبات الاهتمام:
                  </span>
                  <span className="font-bold text-slate-700">{getRequestText(plan.requestsLimit)}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-tajawal">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-slate-400" /> حد استخدام البحث المتقدم:
                  </span>
                  <span className="font-bold text-slate-700">
                    {plan.searchLimit !== undefined && plan.searchLimit >= 999 ? 'بلا حدود' : `${plan.searchLimit || 0} مرات/يوم`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-tajawal">
                  <span className="text-slate-400 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-slate-400" /> صلاحية الباقة:
                  </span>
                  <span className="font-bold text-slate-700">{plan.durationDays || 30} يوماً</span>
                </div>
                <div className="flex items-center justify-between text-xs font-tajawal">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-slate-400" /> فلاتر بحث متقدمة:
                  </span>
                  <span className={`font-bold ${plan.advancedFilters ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {plan.advancedFilters ? 'متاحة ✓' : 'حساب عالي فقط'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-5 border-t border-slate-100 pt-4">
                <p className="text-xs font-cairo font-bold text-slate-400 mb-2">قائمة الميزات المعروضة للعميل:</p>
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-emerald-600" />
                    </div>
                    <span className="text-xs text-slate-600 font-tajawal">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Edit & Delete Action Buttons */}
            <div className="flex gap-2 border-t border-slate-100 pt-3">
              <button 
                onClick={() => setEditing(plan)} 
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-cairo font-bold text-xs hover:bg-slate-200 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> تعديل وتخصيص الباقة
              </button>
              <button 
                onClick={() => {
                  if (plans.length <= 1) {
                    showToast('لا يمكن حذف الباقة الأخيرة في المنصة، يجب الإبقاء على باقة واحدة على الأقل.', 'error');
                  } else {
                    setDeletingId(plan.id);
                  }
                }} 
                className="px-3 py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors font-cairo font-bold text-xs flex items-center justify-center"
                title="حذف الباقة نهائياً"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* قسم تخصيص باقات الرسائل الإضافية */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 mt-8 space-y-6">
        <div>
          <h3 className="font-cairo font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-500" /> التحكم بباقات رسائل الاستفسار والتواصل الإضافية
          </h3>
          <p className="text-xs text-slate-500 font-tajawal mt-1 font-medium">يمكنك تعديل أسعار وحدود رسائل الاستفسار الإضافية التي يشتريها الأعضاء عند نفاد رصيد باقاتهم المخصصة.</p>
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

      {/* قسم تخصيص خيارات شراء الاهتمامات الإضافية */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 mt-8 space-y-6">
        <div>
          <h3 className="font-cairo font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" /> إعدادات بيع وشراء طلبات الاهتمام الإضافية للأعضاء
          </h3>
          <p className="text-xs text-slate-500 font-tajawal mt-1 font-medium">تحديد ما إذا كان العضو يستطيع بعد نفاد حد باقته شراء اهتمامات إضافية بعدد محدد أو تفعيل فترة كاملة بلا حدود (مثال: 7 أو 30 يوماً).</p>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4" dir="rtl">
          <div>
            <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">نوع تفعيل الاهتمامات</label>
            <select
              value={interestPurchaseSettings.type}
              onChange={(e) => updateInterestPurchaseSettings({
                ...interestPurchaseSettings,
                type: e.target.value as 'count' | 'duration'
              })}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm"
            >
              <option value="count">عدد محدد من الاهتمامات (مثال: شحن 10 اهتمامات)</option>
              <option value="duration">فترة زمنية محددة بلا حدود (مثال: 7 أو 30 يوم)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">سعر باقة الشراء (ر.س)</label>
            <input
              type="number"
              value={interestPurchaseSettings.price}
              onChange={(e) => updateInterestPurchaseSettings({
                ...interestPurchaseSettings,
                price: Number(e.target.value)
              })}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm"
              placeholder="مثال: 29"
            />
          </div>

          {interestPurchaseSettings.type === 'count' ? (
            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">عدد طلبات الاهتمام الممنوحة</label>
              <input
                type="number"
                value={interestPurchaseSettings.count}
                onChange={(e) => updateInterestPurchaseSettings({
                  ...interestPurchaseSettings,
                  count: Number(e.target.value)
                })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm"
                placeholder="مثال: 10"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">مدة التفعيل بالايام (بلا حدود)</label>
              <input
                type="number"
                value={interestPurchaseSettings.durationDays}
                onChange={(e) => updateInterestPurchaseSettings({
                  ...interestPurchaseSettings,
                  durationDays: Number(e.target.value)
                })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm"
                placeholder="مثال: 7 أو 30"
              />
            </div>
          )}
        </div>
      </div>

      {/* Editing / Creating Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "تعديل الباقة والحدود" : "إضافة باقة جديدة مخصصة"} size="lg">
        {editing && (
          <PlanForm plan={editing} onSave={(updated) => {
            if (!updated.id) {
              const generatedId = 'plan_' + Math.random().toString(36).substring(2, 9);
              addPlan({ ...updated, id: generatedId });
            } else {
              updatePlan(updated);
            }
            setEditing(null);
          }} />
        )}
      </Modal>

      {/* Safety Delete Confirmation Modal */}
      <Modal open={!!deletingId} onClose={() => setDeletingId(null)} title="تأكيد حذف باقة الاشتراك" size="md">
        <div className="space-y-4 text-right p-1" dir="rtl">
          <div className="flex items-center gap-3 text-rose-600 bg-rose-50 p-3.5 rounded-2xl border border-rose-100">
            <ShieldAlert className="w-6 h-6 flex-shrink-0" />
            <p className="font-cairo font-bold text-sm">تنبيه سلامة حساس: أنت على وشك مسح هذه الباقة نهائياً من النظام!</p>
          </div>
          <p className="text-slate-600 font-tajawal text-sm leading-relaxed">
            حذف باقة الاشتراك سيؤدي إلى إلغائها من لوحات التسجيل والترقية والتعديل. الأعضاء المسجلون عليها حالياً سيحتفظون بها حتى نهاية صلاحية حساباتهم، ولكن لن يتمكن أي عضو جديد من الترقية إليها. هل أنت متأكد تماماً من رغبتك في حذف هذه الباقة؟
          </p>
          <div className="flex gap-3 pt-3">
            <button 
              onClick={handleDeleteConfirm}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-cairo font-bold text-sm transition-colors"
            >
              نعم، أحذف الباقة نهائياً
            </button>
            <button 
              onClick={() => setDeletingId(null)}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-sm transition-colors"
            >
              إلغاء التراجع
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface PlanFormProps {
  plan: Plan;
  onSave: (p: Plan) => void;
}

function PlanForm({ plan, onSave }: PlanFormProps) {
  const [form, setForm] = useState<Plan>({ ...plan });
  const [newFeature, setNewFeature] = useState('');

  const inputClass = "w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm";
  const labelClass = "block text-xs font-cairo font-bold text-slate-700 mb-1.5";

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>اسم الباقة</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="الباقة البلاتينية" />
        </div>
        <div>
          <label className={labelClass}>السعر (ر.س)</label>
          <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>الفترة</label>
          <input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className={inputClass} placeholder="شهريًا، سنويًا..." />
        </div>
        <div>
          <label className={labelClass}>الوصف القصير</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="ميزات استثنائية للجادين" />
        </div>
      </div>

      {/* Style & Display Options Section */}
      <div className="grid sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
        <div>
          <label className={labelClass}>لون الباقة المميز</label>
          <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputClass}>
            <option value="navy">كحلي (Navy)</option>
            <option value="gold">ذهبي (Gold)</option>
            <option value="rose">وردي (Rose)</option>
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <span className={labelClass}>الترويج للأكثر شعبية</span>
          <button 
            type="button"
            onClick={() => setForm({ ...form, popular: !form.popular })}
            className={`w-full py-2.5 rounded-xl border-2 transition-all font-cairo text-xs font-bold text-center flex items-center justify-center gap-1.5 ${
              form.popular 
                ? 'bg-amber-50 border-amber-500 text-amber-800' 
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-amber-300'
            }`}
          >
            {form.popular ? 'تمييز كالأكثر شعبية ✓' : 'باقة عادية'}
          </button>
        </div>
        <div className="flex flex-col justify-end">
          <span className={labelClass}>إخفاء الباقة (صلاحيات إدارية فقط)</span>
          <button 
            type="button"
            onClick={() => setForm({ ...form, hidden: !form.hidden })}
            className={`w-full py-2.5 rounded-xl border-2 transition-all font-cairo text-xs font-bold text-center flex items-center justify-center gap-1.5 ${
              form.hidden 
                ? 'bg-rose-50 border-rose-300 text-rose-800' 
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-rose-300'
            }`}
          >
            {form.hidden ? 'مخفية عن الأعضاء 👁️✕' : 'مرئية للأعضاء 👁️✓'}
          </button>
        </div>
      </div>

      {/* Limits inputs */}
      <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-3">
        <h4 className="text-sm font-cairo font-bold text-amber-900 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-amber-600" /> الحدود والنظام التشغيلي للباقة (يمكنك تعديلها بضغطة زر)
        </h4>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>حد الرسائل الشهرية</label>
            <input 
              type="number" 
              value={form.messagesLimit !== undefined ? form.messagesLimit : 5} 
              onChange={(e) => setForm({ ...form, messagesLimit: Number(e.target.value) })} 
              className={inputClass} 
              placeholder="مثال: 100" 
            />
            <p className="text-[10px] text-slate-400 font-tajawal mt-1">أدخل 999 لباقة بلا حدود</p>
          </div>
          <div>
            <label className={labelClass}>طلب اهتمام يومياً</label>
            <input 
              type="number" 
              value={form.requestsLimit !== undefined ? form.requestsLimit : 1} 
              onChange={(e) => setForm({ ...form, requestsLimit: Number(e.target.value) })} 
              className={inputClass}
              placeholder="مثال: 10" 
            />
            <p className="text-[10px] text-slate-400 font-tajawal mt-1">أدخل 99 لباقة بلا حدود</p>
          </div>
          <div>
            <label className={labelClass}>حد بحث متقدم بالفلاتر يومياً</label>
            <input 
              type="number" 
              value={form.searchLimit !== undefined ? form.searchLimit : 2} 
              onChange={(e) => setForm({ ...form, searchLimit: Number(e.target.value) })} 
              className={inputClass}
              placeholder="مثال: 15" 
            />
            <p className="text-[10px] text-slate-400 font-tajawal mt-1">أدخل 999 لباقة بلا حدود</p>
          </div>
          <div>
            <label className={labelClass}>صلاحية الباقة (ايام)</label>
            <input 
              type="number" 
              value={form.durationDays !== undefined ? form.durationDays : 30} 
              onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })} 
              className={inputClass}
              placeholder="مثال: 30" 
            />
            <p className="text-[10px] text-slate-400 font-tajawal mt-1">مثال: 30 لـ شهر</p>
          </div>
          <div className="flex flex-col justify-end">
            <span className={labelClass}>فلاتر البحث والمطابقة المتقدمة</span>
            <button 
              type="button"
              onClick={() => setForm({ ...form, advancedFilters: !form.advancedFilters })}
              className={`w-full py-2.5 rounded-xl border-2 transition-all font-cairo text-xs font-bold text-center flex items-center justify-center gap-1.5 ${
                form.advancedFilters 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800' 
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-amber-300'
              }`}
            >
              {form.advancedFilters ? 'تفعيل الفلاتر المتقدمة ✓' : 'تعطيل الفلاتر المتقدمة ✕'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>ميزات العرض التسويقية (تظهر بصفحة الدفع)</label>
        <div className="space-y-2 mb-2">
          {form.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={f} onChange={(e) => {
                const features = [...form.features];
                features[i] = e.target.value;
                setForm({ ...form, features });
              }} className={inputClass} />
              <button type="button" onClick={() => setForm({ ...form, features: form.features.filter((_, idx) => idx !== i) })} className="text-rose-500 hover:text-rose-700 p-1">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newFeature} onChange={(e) => setNewFeature(e.target.value)} placeholder="أضف ميزة جديدة للعرض..." className={inputClass} />
          <button type="button" onClick={() => { if (newFeature.trim()) { setForm({ ...form, features: [...form.features, newFeature] }); setNewFeature(''); } }} className="px-4 rounded-xl bg-slate-900 text-white font-bold">+</button>
        </div>
      </div>

      <button onClick={() => onSave(form)} className="w-full py-3 mt-4 rounded-xl bg-slate-900 text-white font-cairo font-bold hover:bg-slate-800 transition-colors">
        {form.id ? "حفظ وتحديث هذه الباقة رسمياً" : "إضافة وحفظ الباقة الجديدة رسمياً"}
      </button>
    </div>
  );
}
