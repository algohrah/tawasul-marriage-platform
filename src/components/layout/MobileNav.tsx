import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Home, Search, Heart, Headphones, User, LogIn, UserPlus } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { SUPPORT_TICKETS } from '../../lib/data';
import { getActionableRequestsCount, getCurrentUserId } from '../../lib/useInterestRequests';

// عناصر قائمة الأعضاء المسجلين
const memberItems = [
  { to: '/', label: 'الرئيسية', icon: Home, end: true },
  { to: '/search', label: 'البحث', icon: Search, end: false },
  { to: '/requests', label: 'طلباتي', icon: Heart, end: false },
  { to: '/admin-chat', label: 'الدعم', icon: Headphones, end: false },
  { to: '/profile', label: 'حسابي', icon: User, end: false },
];

// عناصر قائمة الزوار غير المسجلين
const guestItems = [
  { to: '/', label: 'الرئيسية', icon: Home, end: true, cta: false },
  { to: '/search', label: 'البحث', icon: Search, end: false, cta: false },
  { to: '/login', label: 'دخول', icon: LogIn, end: false, cta: false },
  { to: '/register', label: 'سجّل', icon: UserPlus, end: false, cta: true },
];

export default function MobileNav() {
  const { user } = useApp();
  const [pendingRequests, setPendingRequests] = useState(0);
  const isLoggedIn = user?.isLoggedIn;

  useEffect(() => {
    if (!isLoggedIn) {
      setPendingRequests(0);
      return;
    }
    let mounted = true;
    const loadCount = async () => {
      const activeId = user?.memberId || getCurrentUserId();
      const count = await getActionableRequestsCount(activeId);
      if (mounted) setPendingRequests(count);
    };
    loadCount();
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
  }, [isLoggedIn, user?.memberId]);

  const openTickets = SUPPORT_TICKETS.filter(
    (t) => t.status === 'open' || t.status === 'in_progress'
  ).length;

  const memberBadges: Record<string, number> = {
    '/requests': pendingRequests,
    '/admin-chat': openTickets,
  };

  // ===== قائمة الأعضاء المسجلين =====
  if (isLoggedIn) {
    return (
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none">
        <div className="pointer-events-auto mx-auto flex h-16 max-w-md items-center justify-around rounded-[1.6rem] border border-gold-300/25 bg-white/88 shadow-luxe backdrop-blur-xl dark:bg-navy-900/88 dark:border-white/10">
          {memberItems.map((item) => {
            const badge = memberBadges[item.to] || 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all no-tap-highlight ${
                    isActive
                      ? 'text-navy-950 bg-gold-gradient shadow-gold'
                      : 'text-navy-500 dark:text-cream-200/70 hover:bg-cream-100/70 dark:hover:bg-white/8'
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

  // ===== قائمة الزوار غير المسجلين =====
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none">
      <div className="pointer-events-auto mx-auto flex h-16 max-w-md items-center justify-around rounded-[1.6rem] border border-gold-300/25 bg-white/88 shadow-luxe backdrop-blur-xl dark:bg-navy-900/88 dark:border-white/10">
        {guestItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all no-tap-highlight ${
                item.cta
                  ? 'bg-gold-gradient text-navy-900 shadow-gold'
                  : isActive
                  ? 'text-navy-950 bg-gold-gradient shadow-gold'
                  : 'text-navy-500 dark:text-cream-200/70 hover:bg-cream-100/70 dark:hover:bg-white/8'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`w-5 h-5 ${isActive || item.cta ? 'fill-current/10' : ''}`}
                  strokeWidth={isActive || item.cta ? 2.5 : 2}
                />
                <span className="text-[10px] font-cairo font-semibold">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
