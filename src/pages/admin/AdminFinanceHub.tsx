import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DollarSign, CreditCard, FileMinus, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminTransactions from './AdminTransactions';
import AdminPlans from './AdminPlans';
import AdminExemptions from './AdminExemptions';
import { useApp } from '../../lib/AppContext';

type TabKey = 'transactions' | 'plans' | 'exemptions';

export default function AdminFinanceHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey =
    rawTab && ['transactions', 'plans', 'exemptions'].includes(rawTab)
      ? rawTab
      : 'transactions';

  const { exemptRequests } = useApp();

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab }, { replace: true });
  };

  const pendingExemptions = useMemo(() => {
    const list = exemptRequests || [];
    return list.filter((e) => e.status === 'pending').length;
  }, [exemptRequests]);

  const tabs: { key: TabKey; label: string; icon: LucideIcon; badge?: number; badgeColor?: string }[] = [
    { key: 'transactions', label: 'المعاملات المالية والعمليات', icon: DollarSign },
    { key: 'plans', label: 'باقات الاشتراك والأسعار', icon: CreditCard },
    {
      key: 'exemptions',
      label: 'الإعفاءات والتسهيلات',
      icon: FileMinus,
      badge: pendingExemptions,
      badgeColor: 'bg-amber-500',
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
                      t.badgeColor || 'bg-amber-500'
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
          {activeTab === 'transactions' && <AdminTransactions />}
          {activeTab === 'plans' && <AdminPlans />}
          {activeTab === 'exemptions' && <AdminExemptions />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
