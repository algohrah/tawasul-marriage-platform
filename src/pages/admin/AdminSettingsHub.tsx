import { useSearchParams } from 'react-router-dom';
import { Globe, CreditCard, Settings, ShieldCheck, Database, MapPin, Bell, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPlatformSettings from './AdminPlatformSettings';
import AdminPaymentSettings from './AdminPaymentSettings';
import AdminFeatureSettings from './AdminFeatureSettings';
import AdminSecuritySettings from './AdminSecuritySettings';
import AdminBackupRestore from './AdminBackupRestore';
import AdminCities from './AdminCities';
import AdminNotifications from './AdminNotifications';

type TabKey = 'platform' | 'payments' | 'features' | 'security' | 'backup' | 'cities' | 'notifications';

export default function AdminSettingsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey =
    rawTab && ['platform', 'payments', 'features', 'security', 'backup', 'cities', 'notifications'].includes(rawTab)
      ? rawTab
      : 'platform';

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab }, { replace: true });
  };

  const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
    { key: 'platform', label: 'إعدادات المنصة والهوية', icon: Globe },
    { key: 'payments', label: 'بوابات وطرق الدفع', icon: CreditCard },
    { key: 'features', label: 'التحكم بالميزات والذكاء الاصطناعي', icon: Settings },
    { key: 'security', label: 'الأمان وسياسات الدخول', icon: ShieldCheck },
    { key: 'backup', label: 'النسخ الاحتياطي واستعادة المنصة', icon: Database },
    { key: 'cities', label: 'الدول والمدن والجنسيات', icon: MapPin },
    { key: 'notifications', label: 'الإشعارات والحملات', icon: Bell },
  ];

  return (
    <div className="space-y-6">
      {/* Hub Tabs Header */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTabChange(t.key)}
                className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-cairo font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'platform' && <AdminPlatformSettings />}
          {activeTab === 'payments' && <AdminPaymentSettings />}
          {activeTab === 'features' && <AdminFeatureSettings />}
          {activeTab === 'security' && <AdminSecuritySettings />}
          {activeTab === 'backup' && <AdminBackupRestore />}
          {activeTab === 'cities' && <AdminCities />}
          {activeTab === 'notifications' && <AdminNotifications />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
