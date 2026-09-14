import { dataService } from '../../lib/data/DataService';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Save, Check, Bell, Database, Settings, Lock, Clock, ArrowLeft } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import { useApp } from '../../lib/AppContext';

const SETTINGS_KEY = 'twafok_admin_security_settings_v1';

interface SecuritySettings {
  emailNotifs: boolean;
  smsNotifs: boolean;
  twoFactor: boolean;
  autoBackup: boolean;
  debugMode: boolean;
  cacheTimeout: string;
}

const DEFAULT_SETTINGS: SecuritySettings = {
  emailNotifs: true,
  smsNotifs: false,
  twoFactor: true,
  autoBackup: true,
  debugMode: false,
  cacheTimeout: '60',
};

function loadSettings(): SecuritySettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = dataService.db.settings.get(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: SecuritySettings) {
  if (typeof window !== 'undefined') {
    try { dataService.db.settings.set(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }
}

interface ToggleProps {
  label: string;
  desc: string;
  icon: React.ElementType;
  value: boolean;
  onChange: (val: boolean) => void;
}

const Toggle = ({ label, desc, icon: Icon, value, onChange }: ToggleProps) => {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-cairo font-semibold text-slate-800 text-sm pl-2">{label}</p>
        <p className="text-xs text-slate-400 font-tajawal">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
          value ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
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

export default function AdminSecuritySettings() {
  const { showToast } = useApp();
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<SecuritySettings>(loadSettings);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    showToast('تم حفظ إعدادات الأمان بنجاح', 'success');
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-5 text-right" dir="rtl">
      <PageHeader
        icon={Shield}
        title="الأمان وسياسات الدخول"
        subtitle="إعدادات الأمان، المصادقة الثنائية، وسياسات حماية لوحة الإدارة"
        action={
          <button
            onClick={handleSave}
            aria-label="حفظ إعدادات الأمان"
            className={`flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold text-sm hover:bg-slate-800 transition-colors ${
              saved ? 'bg-emerald-500 hover:bg-emerald-600' : ''
            }`}
          >
            {saved ? <><Check className="w-4 h-4" /> تم الحفظ</> : <><Save className="w-4 h-4" /> حفظ</>}
          </button>
        }
      />

      {/* تنويه ورابط مباشر لصفحة النسخ الاحتياطي واستعادة المنصة المستقلة */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center flex-shrink-0">
            <Database className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h4 className="font-cairo font-bold text-slate-900 text-sm">
              النسخ الاحتياطي واستعادة المنصة واستيراد الأعضاء
            </h4>
            <p className="text-xs text-slate-600 font-tajawal mt-0.5">
              تم تخصيص تبويب مستقل لإدارة وتنزيل النسخ الاحتياطية الشاملة واستيراد ملفات الأعضاء المصدّرين.
            </p>
          </div>
        </div>
        <Link
          to="/admin/settings?tab=backup"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-cairo font-bold text-xs transition-colors shadow-xs flex-shrink-0"
        >
          <span>الانتقال لصفحة النسخ الاحتياطي</span>
          <ArrowLeft className="w-4 h-4 text-amber-400" />
        </Link>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <h3 className="font-cairo font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-500" /> الأمان وسياسات الدخول
        </h3>
        <div className="divide-y divide-slate-50">
          <Toggle
            label="المصادقة الثنائية (2FA)"
            desc="حماية إضافية وتأكيد عند تسجيل دخول مدراء النظام"
            icon={Lock}
            value={settings.twoFactor}
            onChange={(val) => setSettings({ ...settings, twoFactor: val })}
          />
          <Toggle
            label="وضع التصحيح والمراقبة"
            desc="تسجيل الأخطاء التفصيلية لتسهيل المتابعة الفنية"
            icon={Settings}
            value={settings.debugMode}
            onChange={(val) => setSettings({ ...settings, debugMode: val })}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <h3 className="font-cairo font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-500" /> تنبيهات الأمان والإشعارات
        </h3>
        <div className="divide-y divide-slate-50">
          <Toggle
            label="إشعارات البريد الإلكتروني"
            desc="استقبال تنبيهات بالأعضاء الجدد ومحاولات الدخول المهمة"
            icon={Bell}
            value={settings.emailNotifs}
            onChange={(val) => setSettings({ ...settings, emailNotifs: val })}
          />
          <Toggle
            label="إشعارات SMS الفورية"
            desc="استقبال تنبيهات فورية على الجوال عند العمليات الحساسة"
            icon={Bell}
            value={settings.smsNotifs}
            onChange={(val) => setSettings({ ...settings, smsNotifs: val })}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <h3 className="font-cairo font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Database className="w-5 h-5 text-amber-500" /> النظام والتخزين المؤقت
        </h3>
        <div className="divide-y divide-slate-50">
          <Toggle
            label="النسخ الاحتياطي التلقائي الدوري"
            desc="تفعيل التذكير والجدولة الدورية لحفظ بيانات المنصة"
            icon={Database}
            value={settings.autoBackup}
            onChange={(val) => setSettings({ ...settings, autoBackup: val })}
          />
          <div className="flex items-center gap-3 py-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
            <div className="flex-1">
              <p className="font-cairo font-semibold text-slate-800 text-sm pl-2">مدة التخزين المؤقت (دقائق)</p>
              <p className="text-xs text-slate-400 font-tajawal">تحكم في أداء وسرعة تحميل الواجهات</p>
            </div>
            <input
              type="number"
              value={settings.cacheTimeout}
              onChange={(e) => setSettings({ ...settings, cacheTimeout: e.target.value })}
              className="w-20 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none text-center font-cairo font-bold text-slate-900 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
