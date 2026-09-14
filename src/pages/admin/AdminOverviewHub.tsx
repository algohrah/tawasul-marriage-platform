import { useSearchParams } from 'react-router-dom';
import { LayoutDashboard, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminDashboard from './AdminDashboard';
import AdminAnalytics from './AdminAnalytics';

export default function AdminOverviewHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: 'dashboard' | 'analytics' = searchParams.get('tab') === 'analytics' ? 'analytics' : 'dashboard';

  const handleTabChange = (tab: 'dashboard' | 'analytics') => {
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Tab Selector */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-2 max-w-md">
        <button
          type="button"
          onClick={() => handleTabChange('dashboard')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-cairo font-bold transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>لوحة المعلومات والنشاط</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('analytics')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-cairo font-bold transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>التحليلات المتقدمة</span>
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <AdminDashboard />
          </motion.div>
        ) : (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <AdminAnalytics />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
