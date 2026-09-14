import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ticket, ShieldAlert, ClipboardList, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminMessages from './AdminMessages';
import AdminReports from './AdminReports';
import AdminAuditLog from './AdminAuditLog';
import { useApp } from '../../lib/AppContext';
import { useReviewMarkers } from '../../lib/useReviewMarkers';

type TabKey = 'messages' | 'reports' | 'audit';

export default function AdminTrustHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey =
    rawTab && ['messages', 'reports', 'audit'].includes(rawTab)
      ? rawTab
      : 'messages';

  const { supportTickets, reports } = useApp();

  const { isReviewed: isReportReviewed } = useReviewMarkers('twafok_reviewed_reports');
  const { isReviewed: isTicketReviewed } = useReviewMarkers('twafok_reviewed_tickets');

  const pendingReports = useMemo(
    () => reports.filter((r) => r.status === 'pending' && !isReportReviewed(r.id)).length,
    [reports, isReportReviewed]
  );

  const openTickets = useMemo(
    () =>
      supportTickets.filter(
        (t) => (t.status === 'open' || t.status === 'in_progress') && !isTicketReviewed(t.id)
      ).length,
    [supportTickets, isTicketReviewed]
  );

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab }, { replace: true });
  };

  const tabs: { key: TabKey; label: string; icon: LucideIcon; badge?: number; badgeColor?: string }[] = [
    {
      key: 'messages',
      label: 'تذاكر ومحادثات الدعم',
      icon: Ticket,
      badge: openTickets,
      badgeColor: 'bg-amber-500',
    },
    {
      key: 'reports',
      label: 'البلاغات والشكاوى',
      icon: ShieldAlert,
      badge: pendingReports,
      badgeColor: 'bg-red-500',
    },
    { key: 'audit', label: 'سجل التدقيق والعمليات', icon: ClipboardList },
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
          {activeTab === 'messages' && <AdminMessages />}
          {activeTab === 'reports' && <AdminReports />}
          {activeTab === 'audit' && <AdminAuditLog />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
