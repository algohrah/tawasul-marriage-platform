import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, BadgeCheck, Building2, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminMembers from './AdminMembers';
import AdminVerifications from './AdminVerifications';
import AdminKhataabaDirectory from './AdminKhataabaDirectory';
import AdminImportMembers from './AdminImportMembers';
import { useApp } from '../../lib/AppContext';
import { dataService } from '../../lib/data/DataService';

type TabKey = 'members' | 'verifications' | 'khataaba' | 'import';

export default function AdminMembersHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey =
    rawTab && ['members', 'verifications', 'khataaba', 'import'].includes(rawTab)
      ? rawTab
      : 'members';

  const { adminMembers } = useApp();

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab }, { replace: true });
  };

  // طلبات التوثيق المعلقة
  const pendingVerifications = useMemo(() => {
    let statusMap: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      try {
        const raw = dataService.db.settings.get('twafok_verif_status');
        if (raw) statusMap = JSON.parse(raw);
      } catch { /* تجاهل */ }
    }
    const vdocMap: Record<string, string> = {};
    try {
      const docs = dataService.db.getAllVerificationDocs() || [];
      docs.forEach((d) => {
        if (d?.memberId) vdocMap[d.memberId] = d.status || '';
      });
    } catch { /* تجاهل */ }

    const list = adminMembers || [];
    return list.filter((m) => {
      if (m.verified) return false;
      const storedStatus = statusMap[m.id];
      const docStatus = vdocMap[m.id];
      if (storedStatus === 'pending') return true;
      if (!storedStatus && docStatus === 'pending') return true;
      return false;
    }).length;
  }, [adminMembers]);

  const tabs: { key: TabKey; label: string; icon: any; badge?: number; badgeColor?: string }[] = [
    { key: 'members', label: 'إدارة الأعضاء والقوائم', icon: Users },
    {
      key: 'verifications',
      label: 'طلبات التوثيق',
      icon: BadgeCheck,
      badge: pendingVerifications,
      badgeColor: 'bg-rose-500',
    },
    { key: 'khataaba', label: 'دليل الخطابات والمكاتب', icon: Building2 },
    { key: 'import', label: 'استيراد وتصدير الأعضاء', icon: Upload },
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
                {t.badge !== undefined && t.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white leading-none ${
                      t.badgeColor || 'bg-rose-500'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
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
          {activeTab === 'members' && <AdminMembers />}
          {activeTab === 'verifications' && <AdminVerifications />}
          {activeTab === 'khataaba' && <AdminKhataabaDirectory />}
          {activeTab === 'import' && <AdminImportMembers />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
