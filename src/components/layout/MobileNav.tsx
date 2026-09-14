import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Heart, Headphones, User } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { SUPPORT_TICKETS } from '../../lib/data';
import { getActionableRequestsCount, getCurrentUserId } from '../../lib/useInterestRequests';

const items = [
  { to: '/', label: 'الرئيسية', icon: Home, end: true },
  { to: '/search', label: 'البحث', icon: Search, end: false },
  { to: '/requests', label: 'طلباتي', icon: Heart, end: false },
  { to: '/admin-chat', label: 'الإدارة', icon: Headphones, end: false },
  { to: '/profile', label: 'حسابي', icon: User, end: false },
];

export default function MobileNav() {
  const { user } = useApp();
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    let mounted = true;
    const loadCount = async () => {
      if (!user.isLoggedIn) { if (mounted) setPendingRequests(0); return; }
      const activeId = user?.memberId || getCurrentUserId();
      const count = await getActionableRequestsCount(activeId);
      if (mounted) setPendingRequests(count);
    };
    loadCount();
    // تحديث ذكي: عند العودة للنافذة + فاصل طويل (60 ثانية) بدلاً من كل 2.5 ثانية
    const onFocus = () => loadCount();
    const onVisible = () => { if (document.visibilityState === 'visible') loadCount(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadCount();
    }, 60000);
    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [user.isLoggedIn]);

  if (!user.isLoggedIn) return null;

  const openTickets = SUPPORT_TICKETS.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  const badges: Record<string, number> = {
    '/requests': pendingRequests,
    '/admin-chat': openTickets,
  };

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none">
      <div className="pointer-events-auto mx-auto flex h-16 max-w-md items-center justify-around rounded-[1.6rem] border border-gold-300/25 bg-white/88 shadow-luxe backdrop-blur-xl dark:bg-navy-900/88 dark:border-white/10">
        {items.map((item) => {
          const badge = badges[item.to] || 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all no-tap-highlight ${
                  isActive ? 'text-navy-950 bg-gold-gradient shadow-gold' : 'text-navy-500 dark:text-cream-200/70 hover:bg-cream-100/70 dark:hover:bg-white/8'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <item.icon
                      className={`w-5 h-5 ${isActive ? 'fill-gold-300/30' : ''}`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {badge > 0 && (
                      <span className="absolute -top-1.5 -left-2 bg-rose-deep text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-cream-50">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-cairo font-semibold">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
