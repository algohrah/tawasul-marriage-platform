import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, Heart, Eye, ShieldCheck, Info, CheckCheck, Headphones, Users, MessageSquare,
  X, Trash2, Inbox, Sparkles, ChevronLeft,
} from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { getCurrentUserId } from '../lib/useInterestRequests';
import {
  getUnifiedNotifications, markAllUnifiedNotificationsRead, deleteUnifiedNotification,
  markUnifiedNotificationRead, type UnifiedNotification,
} from '../lib/notifications';
import supabase from '../lib/supabase';

const typeConfig = {
  like: { icon: Heart, color: 'text-rose-deep bg-rose-deep/10' },
  request: { icon: Heart, color: 'text-rose-deep bg-rose-deep/10' },
  match: { icon: Users, color: 'text-gold-600 bg-gold-300/15' },
  visit: { icon: Eye, color: 'text-navy-600 bg-navy-900/10' },
  verification: { icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-100' },
  system: { icon: Info, color: 'text-sky-600 bg-sky-100' },
  admin: { icon: Headphones, color: 'text-gold-600 bg-gold-300/15' },
  inquiry: { icon: MessageSquare, color: 'text-amber-700 bg-amber-100' },
};

export default function Notifications() {
  const { showToast, user } = useApp();
  const activeId = user?.memberId || getCurrentUserId();
  const [notifs, setNotifs] = useState<UnifiedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const unread = notifs.filter((n) => !n.read).length;

  const loadNotifications = useCallback(async () => {
    try {
      setNotifs(await getUnifiedNotifications(activeId));
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // اشتراك لحظي حقيقي عبر Supabase Realtime — يُحدّث القائمة فور وصول إشعار جديد بدل الفحص الدوري
  useEffect(() => {
    if (!activeId || typeof supabase?.channel !== 'function') return;
    const channel = supabase
      .channel(`notifications-page-${activeId}`)
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${activeId}` }, () => {
        loadNotifications();
      })
      ?.subscribe();
    return () => { if (channel && typeof supabase?.removeChannel === 'function') supabase.removeChannel(channel); };
  }, [activeId, loadNotifications]);

  const markAll = async () => {
    await markAllUnifiedNotificationsRead(activeId);
    await loadNotifications();
    showToast('تم تعليم جميع الإشعارات كمقروءة', 'success');
  };

  const removeNotif = async (id: number) => {
    await deleteUnifiedNotification(id);
    await loadNotifications();
    showToast('تم حذف الإشعار', 'info');
  };

  const clearAll = async () => {
    await Promise.all(notifs.map((n) => deleteUnifiedNotification(n.id)));
    await loadNotifications();
    showToast('تم حذف جميع الإشعارات', 'info');
  };

  return (
    <div className="bg-cream-50 min-h-screen pb-28 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gold-300/15 flex items-center justify-center">
              <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-gold-600" />
            </div>
            <div>
              <h1 className="font-cairo font-extrabold text-xl sm:text-2xl text-navy-900">الإشعارات</h1>
              <p className="text-navy-600 font-tajawal text-sm">
                {unread > 0 ? `${unread} إشعار غير مقروء` : 'لا توجد إشعارات غير مقروءة'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {unread > 0 && (
              <button
                onClick={markAll}
                className="flex items-center gap-1.5 text-sm text-gold-700 font-cairo font-semibold hover:bg-gold-300/10 px-3 py-2 rounded-xl transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">تعليم الكل كمقروء</span>
              </button>
            )}
            {notifs.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 text-sm text-rose-deep font-cairo font-semibold hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">حذف الكل</span>
              </button>
            )}
          </div>
        </div>

        <h2 className="flex items-center gap-1.5 font-cairo font-extrabold text-navy-800 mb-3">
          <Sparkles className="w-4 h-4 text-gold-500" /> تحديثات حسابك ورحلاتك
        </h2>

        {/* Notifications list */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-cream-200/60 p-4 flex items-center gap-3 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-cream-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-cream-200/80 rounded-full w-1/3" />
                  <div className="h-3 bg-cream-100 rounded-full w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-16 sm:py-20 bg-white rounded-3xl border border-cream-200/60">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-cream-100 flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-8 h-8 sm:w-10 sm:h-10 text-navy-300" />
            </div>
            <h3 className="font-cairo font-bold text-lg sm:text-xl text-navy-900">لا توجد إشعارات</h3>
            <p className="text-navy-500 font-tajawal mt-2 text-sm sm:text-base">ستظهر هنا جميع التنبيهات والتحديثات الجديدة</p>
            <Link
              to="/search"
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl bg-gold-gradient text-navy-900 font-cairo font-bold text-sm shadow-gold hover:opacity-95 transition-opacity"
            >
              تصفّح الأعضاء الآن
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {notifs.map((n, idx) => {
                const cfg = typeConfig[n.type as keyof typeof typeConfig] || typeConfig.system;
                const Icon = cfg.icon;
                const itemKey = (n?.id !== undefined && n?.id !== null && !Number.isNaN(Number(n.id))) ? `notif-${n.id}-${idx}` : `notif-idx-${idx}`;
                return (
                  <motion.div
                    key={itemKey}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`group relative bg-white rounded-2xl shadow-soft border overflow-hidden transition-all hover:shadow-luxe ${
                      !n.read ? 'border-gold-300/40 ring-1 ring-gold-300/20' : 'border-cream-200/60'
                    }`}
                  >
                    <Link to={n.href} onClick={() => { markUnifiedNotificationRead(n.id); }} className="flex items-center gap-3 p-3 sm:p-4">
                      {/* Icon */}
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-cream-100 flex items-center justify-center">
                          <Info className="w-5 h-5 sm:w-6 sm:h-6 text-navy-400" />
                        </div>
                        <div className={`absolute -bottom-1 -left-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center ring-2 ring-white ${cfg.color}`}>
                          <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gold-700 font-cairo font-extrabold mb-0.5">{n.title}</p>
                        <p className={`font-tajawal text-sm leading-snug ${!n.read ? 'text-navy-900 font-semibold' : 'text-navy-700'}`}>
                          {n.text}
                        </p>
                        <p className="text-xs text-navy-400 font-tajawal mt-0.5">{new Date(n.created_at).toLocaleString('ar-SA')}</p>
                      </div>

                      {/* Unread dot */}
                      {!n.read && (
                        <span className="w-2.5 h-2.5 rounded-full bg-gold-500 flex-shrink-0" />
                      )}

                      {/* Close button */}
                      <button
                        onClick={(e) => { e.preventDefault(); removeNotif(n.id); }}
                        className="w-8 h-8 rounded-full bg-cream-100 hover:bg-rose-50 flex items-center justify-center text-navy-400 hover:text-rose-deep transition-colors flex-shrink-0"
                        aria-label="حذف الإشعار"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <ChevronLeft className="hidden sm:block w-4 h-4 text-navy-300 flex-shrink-0" />
                    </Link>

                    {/* Unread accent bar */}
                    {!n.read && (
                      <div className="absolute top-0 right-0 bottom-0 w-1 bg-gold-gradient" />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
