import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Heart, GitPullRequest, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminRequests from './AdminRequests';
import AdminImportedCoordination from './AdminImportedCoordination';
import { useApp } from '../../lib/AppContext';

type TabKey = 'requests' | 'imported';

export default function AdminJourneysHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey =
    rawTab && ['requests', 'imported'].includes(rawTab) ? rawTab : 'requests';

  const { interestRequests, adminMembers } = useApp();

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab }, { replace: true });
  };

  const pendingRequests = interestRequests.filter((r) => r.status === 'pending').length;

  const pendingImportedCoordination = useMemo(() => {
    const list = interestRequests || [];
    const membersList = adminMembers || [];
    return list.filter((r) => {
      const sender = membersList.find((m) => m.id === r.senderId);
      const receiver = membersList.find((m) => m.id === r.receiverId);
      const hasImported = sender?.sourceType === 'imported' || receiver?.sourceType === 'imported';
      const isActive = !['declined', 'cancelled', 'completed'].includes(r.status);
      return hasImported && isActive;
    }).length;
  }, [interestRequests, adminMembers]);

  const tabs: { key: TabKey; label: string; icon: LucideIcon; badge?: number; badgeColor?: string }[] = [
    {
      key: 'requests',
      label: 'طلبات الاهتمام المباشرة',
      icon: Heart,
      badge: pendingRequests,
      badgeColor: 'bg-rose-500',
    },
    {
      key: 'imported',
      label: 'تنسيق وساطة الخطابات والمستوردين',
      icon: GitPullRequest,
      badge: pendingImportedCoordination,
      badgeColor: 'bg-emerald-600',
    },
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
          {activeTab === 'requests' && <AdminRequests />}
          {activeTab === 'imported' && <AdminImportedCoordination />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
