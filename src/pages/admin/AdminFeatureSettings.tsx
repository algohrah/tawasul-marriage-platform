import { useState } from 'react';
import {
  ShieldCheck, Save, Check, Moon, Sun, Lock, Eye, EyeOff, Zap,
  Calendar, Award, Sparkles, AlertCircle, RefreshCw, UserCheck
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import PageHeader from '../../components/admin/PageHeader';

interface ToggleProps {
  label: string;
  desc: string;
  icon: any;
  value: boolean;
  onChange: (val: boolean) => void;
  id?: string;
}

const Toggle = ({ label, desc, icon: Icon, value, onChange, id }: ToggleProps) => {
  return (
    <div className="flex items-center gap-3 py-4 border-b border-slate-50 last:border-0" id={id}>
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-cairo font-bold text-slate-800 text-sm pl-2">{label}</p>
        <p className="text-xs text-slate-400 font-tajawal mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 focus:outline-none ${
          value ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
        id={`${id}-btn`}
      >
        <div
          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
            value ? 'right-1' : 'right-6'
          }`}
        />
      </button>
    </div>
  );
};

export default function AdminFeatureSettings() {
  const {
    showDarkModeToggle,
    updateShowDarkModeToggle,
    allowProfileHiding,
    requireVerificationForRequests,
    enableWhoViewedMe,
    enableProfileBoosting,
    maxActiveRequests,
    pendingRequestsExpiryDays,
    updateFeatureSettings,
    showToast,
  } = useApp();

  const [saved, setSaved] = useState(false);
  const [localHiding, setLocalHiding] = useState(allowProfileHiding);
  const [localVerification, setLocalVerification] = useState(requireVerificationForRequests);
  const [localWhoViewedMe, setLocalWhoViewedMe] = useState(enableWhoViewedMe);
  const [localBoosting, setLocalBoosting] = useState(enableProfileBoosting);
  const [localMaxRequests, setLocalMaxRequests] = useState(maxActiveRequests);
  const [localExpiryDays, setLocalExpiryDays] = useState(pendingRequestsExpiryDays);

  const handleSave = () => {
    updateFeatureSettings({
      allowProfileHiding: localHiding,
      requireVerificationForRequests: localVerification,
      enableWhoViewedMe: localWhoViewedMe,
      enableProfileBoosting: localBoosting,
      maxActiveRequests: localMaxRequests,
      pendingRequestsExpiryDays: localExpiryDays,
    });
    setSaved(true);
    showToast('تم حفظ إعدادات الميزات والمحددات بنجاح ✓', 'success');
    setTimeout(() => setSaved(false), 2500);
  };

  const labelClass = 'block text-xs font-cairo font-bold text-slate-700 mb-1.5';
  const inputClass =
    'w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-cairo font-bold text-slate-900 text-sm text-center';

  return (
    <div className="space-y-6 text-right" dir="rtl" id="admin-feature-settings-container">
      {/* Header */}
      <PageHeader
        icon={ShieldCheck}
        title="إعدادات الميزات والمحددات"
        subtitle="التحكم في الميزات النشطة والقيود التشغيلية على مستوى المنصة"
        action={
          <button
            onClick={handleSave}
            aria-label="حفظ كافة الإعدادات"
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-cairo font-bold text-sm transition-all shadow-sm ${
              saved
                ? 'bg-emerald-500 text-white shadow-emerald-100'
                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'
            }`}
            id="save-feature-settings-btn"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" /> تم الحفظ بنجاح
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> حفظ كافة الإعدادات
              </>
            )}
          </button>
        }
      />

      <div className="grid md:grid-cols-2 gap-5">
        {/* Card 1: Interaction Limits & Rules */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4" id="interaction-rules-card">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cairo font-extrabold text-lg text-slate-900">ضوابط ومحددات العلاقات</h3>
              <p className="text-xs text-slate-500 font-tajawal">التحكم في جدية الأعضاء ومنع السلوك العشوائي</p>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            <Toggle
              label="اشتراط التوثيق بالهوية الوطنية"
              desc="منع الأعضاء غير الموثقين من إرسال طلبات اهتمام لحماية الأعضاء الآخرين"
              icon={UserCheck}
              value={localVerification}
              onChange={setLocalVerification}
              id="toggle-require-verification"
            />

            {/* Inputs Grid */}
            <div className="grid grid-cols-2 gap-4 pt-3">
              <div id="max-active-requests-input-wrapper">
                <label className={labelClass}>الحد الأقصى للعلاقات المتزامنة</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={localMaxRequests}
                    onChange={(e) => setLocalMaxRequests(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className={inputClass}
                  />
                  <div className="absolute left-3 top-3 text-[10px] text-slate-400 font-cairo">علاقات</div>
                </div>
                <p className="text-[10px] text-slate-400 font-tajawal mt-1">الحد المسموح به لكل عضو في نفس الوقت</p>
              </div>

              <div id="expiry-days-input-wrapper">
                <label className={labelClass}>صلاحية الطلبات المعلقة (بالأيام)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={localExpiryDays}
                    onChange={(e) => setLocalExpiryDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className={inputClass}
                  />
                  <div className="absolute left-3 top-3 text-[10px] text-slate-400 font-cairo">يوم</div>
                </div>
                <p className="text-[10px] text-slate-400 font-tajawal mt-1">إلغاء الطلب تلقائياً إذا لم يستجب المستلم</p>
              </div>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 mt-3 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950 font-tajawal leading-relaxed">
                <p className="font-bold font-cairo text-amber-900 mb-1">تأثير هذه المحددات:</p>
                <p>تفعيل هذه القيود يساعد في زيادة نسبة جدية الطلبات، حيث يركز المشترك على عدد محدود من العلاقات في آن واحد.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Features Visibility */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4" id="features-visibility-card">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cairo font-extrabold text-lg text-slate-900">ميزات وخصائص الحسابات</h3>
              <p className="text-xs text-slate-500 font-tajawal">إتاحة أو حجب الخصائص الاستباقية للمشتركين</p>
            </div>
          </div>

          <div className="divide-y divide-slate-50 pt-1">
            <Toggle
              label="السماح بإخفاء الحساب مؤقتاً"
              desc="إتاحة خيار للأعضاء لإخفاء ملفاتهم من البحث مع بقاء محادثاتهم الحالية نشطة"
              icon={EyeOff}
              value={localHiding}
              onChange={setLocalHiding}
              id="toggle-profile-hiding"
            />

            <Toggle
              label="ميزة تتبع الزيارات (من زار ملفي)"
              desc="تمكين الأعضاء من معرفة من قام بزيارة ملفهم الشخصي لزيادة التفاعل"
              icon={Eye}
              value={localWhoViewedMe}
              onChange={setLocalWhoViewedMe}
              id="toggle-who-viewed-me"
            />

            <Toggle
              label="تمكين تعزيز الملف الشخصي"
              desc="السماح للأعضاء بدفع رسوم لرفع ملفاتهم في أعلى قائمة البحث"
              icon={Zap}
              value={localBoosting}
              onChange={setLocalBoosting}
              id="toggle-profile-boosting"
            />
          </div>
        </div>
      </div>

      {/* Card 3: Dark Mode (Separated and visually stunning) */}
      <div className="bg-gradient-to-br from-indigo-950 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md text-white" id="dark-mode-feature-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
            <Moon className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <h3 className="font-cairo font-extrabold text-xl text-white">الوضع الداكن (التبديل الليلي)</h3>
            <p className="text-slate-300 text-xs font-tajawal">التحكم بظهور أداة تغيير مظهر المنصة للزوار والأعضاء</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              {showDarkModeToggle ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
            </div>
            <div>
              <p className="font-cairo font-bold text-sm text-white">زر تبديل المظهر في شريط التنقل</p>
              <p className="text-xs text-slate-300 font-tajawal mt-0.5">عند تعطيله سيتم إخفاء الخيار واعتماد المظهر الفاتح القياسي والمصمم للمنصة.</p>
            </div>
          </div>

          <button
            onClick={() => updateShowDarkModeToggle(!showDarkModeToggle)}
            className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 focus:outline-none ${
              showDarkModeToggle ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
            id="admin-dark-mode-toggle-btn"
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                showDarkModeToggle ? 'right-1' : 'right-6'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
