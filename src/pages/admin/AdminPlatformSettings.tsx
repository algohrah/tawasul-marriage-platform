import { dataService } from '../../lib/data/DataService';
import { useState } from 'react';
import { Globe, Save, Check, Type, Mail, Lock, UserPlus } from 'lucide-react';
import { SITE_SETTINGS, type SiteSettings } from '../../lib/admin-data';
import { useApp } from '../../lib/AppContext';
import PageHeader from '../../components/admin/PageHeader';

export default function AdminPlatformSettings() {
  const { socialSettings, updateSocialSettings, showToast } = useApp();
  const [settings, setSettings] = useState<SiteSettings>(() => {
    const savedSettings = dataService.db.settings.get('site_settings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch {
        // ignore
      }
    }
    return SITE_SETTINGS;
  });
  const [localSocials, setLocalSocials] = useState(socialSettings);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    dataService.db.settings.set('site_settings', JSON.stringify(settings));
    updateSocialSettings(localSocials);
    setSaved(true);
    showToast('تم حفظ إعدادات المنصة بنجاح', 'success');
    setTimeout(() => setSaved(false), 2500);
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm';
  const labelClass = 'block text-xs font-cairo font-bold text-slate-700 mb-1.5';

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Globe}
        title="إعدادات المنصة"
        subtitle="تحكم في هوية المنصة ومعلومات التواصل الأساسية"
        action={
          <button
            onClick={handleSave}
            aria-label="حفظ إعدادات المنصة"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-cairo font-semibold text-sm transition-colors ${
              saved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {saved ? <><Check className="w-4 h-4" /> تم الحفظ</> : <><Save className="w-4 h-4" /> حفظ</>}
          </button>
        }
      />

      {/* Branding */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <h3 className="font-cairo font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Type className="w-5 h-5 text-amber-500" /> هوية المنصة
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>اسم الموقع</label>
            <input
              value={settings.siteName}
              onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>نص الشعار</label>
            <input
              value={settings.logoText}
              onChange={(e) => setSettings({ ...settings, logoText: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>الوصف المختصر</label>
            <input
              value={settings.tagline}
              onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <h3 className="font-cairo font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-amber-500" /> معلومات التواصل
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>البريد الإلكتروني</label>
            <input
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className={`${inputClass} text-left`}
              dir="ltr"
            />
          </div>
          <div>
            <label className={labelClass}>رقم الهاتف</label>
            <input
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className={`${inputClass} text-left`}
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* WhatsApp & Support Configuration */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <h3 className="font-cairo font-bold text-slate-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#25D366] fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.004 2C6.48 2 2 6.48 2 12C2 13.92 2.54 15.71 3.48 17.24L2 22L6.92 20.61C8.38 21.51 10.13 22 12.004 22C17.528 22 22.008 17.52 22.008 12C22.008 6.48 17.528 2 12.004 2ZM17.15 15.39C16.94 15.98 16.14 16.48 15.52 16.61C14.98 16.72 14.3 16.8 11.91 15.81C8.86 14.54 6.89 11.43 6.74 11.23C6.59 11.03 5.48 9.56 5.48 8.04C5.48 6.52 6.25 5.78 6.56 5.47C6.8 5.23 7.2 5.12 7.58 5.12C7.7 5.12 7.81 5.13 7.91 5.13C8.2 5.14 8.35 5.16 8.54 5.62C8.78 6.19 9.37 7.63 9.44 7.78C9.51 7.93 9.58 8.13 9.48 8.33C9.38 8.53 9.3 8.61 9.15 8.78C9 8.95 8.87 9.09 8.72 9.27C8.58 9.42 8.42 9.59 8.6 9.9C8.78 10.2 9.4 11.22 10.31 12.03C11.49 13.08 12.47 13.42 12.8 13.56C13.13 13.7 13.43 13.67 13.63 13.44C13.88 13.16 14.19 12.72 14.5 12.28C14.75 11.93 15.05 11.97 15.38 12.1C15.71 12.23 17.48 13.11 17.84 13.29C18.2 13.47 18.44 13.56 18.52 13.71C18.6 13.86 18.6 14.58 18.3 15.17C18.01 15.75 17.36 15.11 17.15 15.39Z" />
          </svg>
          إعدادات دعم واتساب وقنوات التواصل
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-emerald-50/40 rounded-xl border border-emerald-100">
            <div>
              <p className="font-cairo font-semibold text-slate-800 text-sm">عرض زر واتساب العائم</p>
              <p className="text-xs text-slate-400 font-tajawal">عرض زر التواصل العائم في أسفل يمين الشاشة لكافة الزوار والأعضاء</p>
            </div>
            <button
              onClick={() => setLocalSocials(prev => ({ ...prev, showWhatsapp: !prev.showWhatsapp }))}
              className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
                localSocials?.showWhatsapp ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  localSocials?.showWhatsapp ? 'right-1' : 'right-6'
                }`}
              />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>رقم واتساب الدعم الفني (رمز الدولة بدون +)</label>
              <input
                type="text"
                value={localSocials?.whatsappNumber || ''}
                onChange={(e) => setLocalSocials(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                placeholder="مثال: 966500000000"
                className={`${inputClass} text-left`}
                dir="ltr"
              />
              <p className="mt-1 text-[11px] font-tajawal text-slate-400">مثال: 966501234567 لضمان عمل الرابط بشكل صحيح وتلقائي</p>
            </div>
            <div>
              <label className={labelClass}>حساب منصة تويتر (X)</label>
              <input
                type="text"
                value={localSocials?.twitter || ''}
                onChange={(e) => setLocalSocials(prev => ({ ...prev, twitter: e.target.value }))}
                placeholder="https://twitter.com/..."
                className={`${inputClass} text-left`}
                dir="ltr"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
        <h3 className="font-cairo font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-500" /> التحكم في المنصة
        </h3>
        {[
          {
            key: 'allowRegistration' as const,
            label: 'السماح بالتسجيل الجديد',
            desc: 'فتح أو إغلاق التسجيل في المنصة',
            icon: UserPlus,
          },
          {
            key: 'maintenanceMode' as const,
            label: 'وضع الصيانة',
            desc: 'إغلاق الموقع مؤقتًا للزوار',
            icon: Lock,
          },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 py-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="font-cairo font-semibold text-slate-800 text-sm">{item.label}</p>
                <p className="text-xs text-slate-400 font-tajawal">{item.desc}</p>
              </div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, [item.key]: !settings[item.key] })}
              className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
                settings[item.key] ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  settings[item.key] ? 'right-1' : 'right-6'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
