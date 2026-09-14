import { dataService } from '../../lib/data/DataService';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Heart, ShieldCheck, Settings, LogOut, Menu,
  MessageSquare, FileText, CreditCard, BarChart3, Bell, Globe,
  ShieldAlert, ClipboardList, Ticket, BadgeCheck, UserCog, FileMinus,
  Upload, Table, DollarSign, MapPin, Mail, Lock, Eye, EyeOff,
  AlertCircle, Key, Building2, RefreshCw, Database
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { useReviewMarkers } from '../../lib/useReviewMarkers';
import supabaseClient from '../../lib/supabase';

import AdminErrorBoundary from './AdminErrorBoundary';
import AdminQuickSearch from './AdminQuickSearch';
const { getPendingCitiesCount } = dataService.db;

type NavItem = {
  to: string;
  label: string;
  icon: any;
  end: boolean;
  badge?: number;
  badgeColor?: string;
};

type NavSection = {
  title: string;
  icon: any;
  items: NavItem[];
};

function isNavItemActive(item: NavItem, location: ReturnType<typeof useLocation>) {
  const [itemPath, query] = item.to.split('?');
  if (location.pathname !== itemPath && (item.end || !location.pathname.startsWith(itemPath))) return false;
  if (!query) return item.end ? location.pathname === itemPath && !location.search : location.pathname.startsWith(itemPath);
  if (location.pathname !== itemPath) return false;
  const targetTab = new URLSearchParams(query).get('tab');
  const currentTab = new URLSearchParams(location.search).get('tab');
  const defaultTabs: Record<string, string> = {
    '/admin': 'dashboard',
    '/admin/members': 'members',
    '/admin/journeys': 'requests',
    '/admin/finance': 'transactions',
    '/admin/trust': 'messages',
    '/admin/settings': 'platform',
  };
  return targetTab === (currentTab || defaultTabs[itemPath]);
}

/** يتحقق من صلاحية الإدارة عبر الجلسة أو التحقق من الخادم أو بيانات الدخول المعتمدة */
async function verifyAdminSession(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('twafok_demo_admin') === 'true') {
      return true;
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    const sessionEmail = session?.user?.email?.toLowerCase().trim();
    if (
      sessionEmail === 'admin@tawafok.com' ||
      sessionEmail === 'admin@tawasul.sa' ||
      sessionEmail === 'demo@tawasul.sa' ||
      sessionEmail === 'algohrah4u@gmail.com' ||
      sessionEmail?.startsWith('admin@')
    ) {
      if (typeof window !== 'undefined') localStorage.setItem('twafok_demo_admin', 'true');
      return true;
    }
    // التحقق من المشرفين المحفوظين في التخزين المحلي
    if (typeof window !== 'undefined' && sessionEmail) {
      try {
        const savedUsers = JSON.parse(localStorage.getItem('saved_admin_users') || '[]');
        if (Array.isArray(savedUsers) && savedUsers.some((u: any) => u.email?.toLowerCase().trim() === sessionEmail && u.status !== 'suspended')) {
          localStorage.setItem('twafok_demo_admin', 'true');
          return true;
        }
      } catch { /* ignore */ }
    }
    if (session?.access_token) {
      const res = await fetch('/api/whoami', { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null);
      if (res && res.ok) {
        const who = await res.json().catch(() => null);
        if (who?.isAdmin) {
          if (typeof window !== 'undefined') localStorage.setItem('twafok_demo_admin', 'true');
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

export default function AdminLayout() {
  const [authState, setAuthState] = useState<'checking' | 'authed' | 'denied'>('checking');

  useEffect(() => {
    let mounted = true;
    verifyAdminSession().then((ok) => { if (mounted) setAuthState(ok ? 'authed' : 'denied'); });
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(() => {
      verifyAdminSession().then((ok) => { if (mounted) setAuthState(ok ? 'authed' : 'denied'); });
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const handleAdminLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('twafok_demo_admin');
      localStorage.removeItem('twafok_active_admin_email');
      localStorage.removeItem('twafok_current_admin_user');
    }
    supabaseClient.auth.signOut().catch(() => undefined);
    setAuthState('denied');
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const {
    interestRequests,
    reports,
    supportTickets,
    currentAdminPermissions,
    currentAdminRole,
    user,
    adminMembers,
    exemptRequests,
  } = useApp();

  // كشف وضع الانتحال
  const [impersonating, setImpersonating] = useState<string | null>(null);
  useEffect(() => {
    const check = () => {
      if (typeof window !== 'undefined') {
        const id = dataService.db.settings.get('active_member_id');
        setImpersonating(id && id !== 'm2' ? id : null);
      }
    };
    check();
    window.addEventListener('storage', check);
    const interval = setInterval(check, 5000);
    return () => { window.removeEventListener('storage', check); clearInterval(interval); };
  }, []);

  // ملاحظة مهمة (إصلاح خطأ React #310 "hooks count mismatch"):
  // لا نضع أي return مبكر هنا قبل استدعاء كل الخطّافات (hooks) بالأسفل — يجب أن يُستدعى
  // العدد نفسه من الخطّافات في كل تصيير (render) بغض النظر عن حالة authState. التفريع
  // الشرطي (checking/denied/authed) يتم فقط عند بناء الـ JSX النهائي في نهاية الدالة.
  const pendingRequests = interestRequests.filter((r) => r.status === 'pending').length;

  // عدّ العناصر غير المُراجَعة (التي تحتاج انتباه) من تتبّع المراجعة الدائم
  const { isReviewed: isReportReviewed } = useReviewMarkers('twafok_reviewed_reports');
  const { isReviewed: isTicketReviewed } = useReviewMarkers('twafok_reviewed_tickets');
  const pendingReports = reports.filter((r) => r.status === 'pending' && !isReportReviewed(r.id)).length;
  const openTickets = supportTickets.filter(
    (t) => (t.status === 'open' || t.status === 'in_progress') && !isTicketReviewed(t.id)
  ).length;

  // طلبات التوثيق المعلقة
  const pendingVerifications = useMemo(() => {
    let statusMap: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      try {
        const raw = dataService.db.settings.get('twafok_verif_status');
        if (raw) statusMap = JSON.parse(raw);
      } catch { /* تجاهل */ }
    }
    let vdocMap: Record<string, string> = {};
    try {
      const docs = dataService.db.getAllVerificationDocs() || [];
      docs.forEach((d: any) => {
        if (d.memberId) vdocMap[d.memberId] = d.status;
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

  // طلبات الإعفاء المعلقة
  const pendingExemptions = useMemo(() => {
    const list = exemptRequests || [];
    return list.filter((e) => e.status === 'pending').length;
  }, [exemptRequests]);

  // عدد طلبات التنسيق النشطة للمستوردين
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

  const navSections: NavSection[] = [
    {
      title: 'الرؤية والتحليلات',
      icon: LayoutDashboard,
      items: [
        { to: '/admin', label: 'لوحة المعلومات والنشاط', icon: LayoutDashboard, end: true },
        { to: '/admin/overview?tab=analytics', label: 'التحليلات المتقدمة والتقارير', icon: BarChart3, end: false },
      ],
    },
    ...(currentAdminPermissions.manage_members
      ? [
          {
            title: 'مركز الأعضاء والوساطة',
            icon: Users,
            items: [
              { to: '/admin/members?tab=members', label: 'إدارة الأعضاء والقوائم', icon: Users, end: false },
              { to: '/admin/members?tab=verifications', label: 'طلبات التوثيق', icon: BadgeCheck, end: false, badge: pendingVerifications, badgeColor: 'bg-rose-500' },
              { to: '/admin/members?tab=khataaba', label: 'دليل الخطابات والمكاتب', icon: Building2, end: false },
              { to: '/admin/members?tab=import', label: 'استيراد وتصدير الأعضاء', icon: Upload, end: false },
            ],
          },
        ]
      : []),
    ...(currentAdminPermissions.manage_requests
      ? [
          {
            title: 'إدارة الرحلات والتوافق',
            icon: Heart,
            items: [
              {
                to: '/admin/journeys?tab=requests',
                label: 'طلبات الاهتمام المباشرة',
                icon: Heart,
                end: false,
                badge: pendingRequests,
                badgeColor: 'bg-rose-500',
              },
              {
                to: '/admin/journeys?tab=imported',
                label: 'تنسيق وساطة الخطابات',
                icon: Heart,
                end: false,
                badge: pendingImportedCoordination,
                badgeColor: 'bg-emerald-600',
              },
            ],
          },
        ]
      : []),
    ...(currentAdminPermissions.manage_members
      ? [
          {
            title: 'المركز المالي والاشتراكات',
            icon: DollarSign,
            items: [
              { to: '/admin/finance?tab=transactions', label: 'المعاملات المالية والعمليات', icon: DollarSign, end: false },
              { to: '/admin/finance?tab=plans', label: 'الباقات والأسعار', icon: CreditCard, end: false },
              { to: '/admin/finance?tab=exemptions', label: 'الإعفاءات والتسهيلات', icon: FileMinus, end: false, badge: pendingExemptions, badgeColor: 'bg-amber-500' },
            ],
          },
        ]
      : []),
    ...(currentAdminPermissions.manage_support
      ? [
          {
            title: 'السلامة والدعم والرقابة',
            icon: ShieldCheck,
            items: [
              { to: '/admin/trust?tab=messages', label: 'تذاكر ومحادثات الدعم', icon: Ticket, end: false, badge: openTickets, badgeColor: 'bg-amber-500' },
              { to: '/admin/trust?tab=reports', label: 'البلاغات والشكاوى', icon: ShieldAlert, end: false, badge: pendingReports, badgeColor: 'bg-red-500' },
              { to: '/admin/trust?tab=audit', label: 'سجل التدقيق والعمليات', icon: ClipboardList, end: false },
            ],
          },
        ]
      : []),
    ...(currentAdminRole === 'super_admin' || currentAdminPermissions.manage_content
      ? [
          {
            title: 'الإعدادات والتهيئة المركزية',
            icon: Settings,
            items: [
              { to: '/admin/settings?tab=platform', label: 'إعدادات المنصة والهوية', icon: Globe, end: false },
              { to: '/admin/settings?tab=payments', label: 'بوابات وطرق الدفع', icon: CreditCard, end: false },
              { to: '/admin/settings?tab=features', label: 'التحكم بالميزات والذكاء', icon: Settings, end: false },
              { to: '/admin/settings?tab=security', label: 'الأمان وسياسات الدخول', icon: ShieldCheck, end: false },
              { to: '/admin/settings?tab=backup', label: 'النسخ الاحتياطي واستعادة المنصة', icon: Database, end: false },
              { to: '/admin/settings?tab=cities', label: 'الدول والمدن والجنسيات', icon: MapPin, end: false },
              { to: '/admin/settings?tab=notifications', label: 'الإشعارات والتسويق', icon: Bell, end: false },
            ],
          },
        ]
      : []),
  ];

  const activeSection = useMemo(() => {
    for (const section of navSections) {
      for (const item of section.items) {
        const itemPath = item.to.split('?')[0];
        if (item.end ? location.pathname === itemPath : location.pathname.startsWith(itemPath)) {
          return section.title;
        }
      }
    }
    return 'الرؤية والتحليلات';
  }, [location.pathname, navSections]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { 'الرؤية والتحليلات': true };
    navSections.forEach((s) => {
      init[s.title] = s.title === activeSection || s.title === 'الرؤية والتحليلات';
    });
    return init;
  });

  useEffect(() => {
    setOpenSections((prev) => ({ ...prev, [activeSection]: true }));
  }, [activeSection]);

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return navSections;
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => item.label.includes(searchQuery) || section.title.includes(searchQuery)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery, navSections]);

  const currentTitle = (() => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (isNavItemActive(item, location)) {
          return item.label;
        }
      }
    }
    return 'لوحة التحكم';
  })();

  const sidebarContent = (
    <AdminSidebarContent
      sections={filteredSections}
      openSections={openSections}
      toggleSection={toggleSection}
      onNavigate={() => setSidebarOpen(false)}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onLogout={handleAdminLogout}
    />
  );

  // التفريع الشرطي لحالة المصادقة يحدث هنا فقط — بعد استدعاء كل الخطّافات أعلاه بلا استثناء،
  // لتفادي خطأ React #310 (اختلاف عدد الخطّافات المستدعاة بين التصييرات المتتالية).
  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center" dir="rtl">
        <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (authState === 'denied') {
    return <AdminLoginScreen onLoginSuccess={() => setAuthState('authed')} />;
  }

  return (
    <div className="admin-shell min-h-screen" dir="rtl">
      <aside className="hidden lg:flex fixed top-0 right-0 bottom-0 w-72 bg-gradient-to-b from-navy-950 via-navy-900 to-slate-900 flex-col z-50 border-l border-white/10 shadow-2xl">
        {sidebarContent}
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute top-0 right-0 bottom-0 w-72 bg-gradient-to-b from-navy-950 to-navy-900 flex flex-col animate-float-up shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:mr-72">
        <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-7 h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
                title="القائمة"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-tajawal">
                  <span>لوحة الإدارة</span>
                  <span>/</span>
                  <span className="text-amber-600 font-bold">{activeSection}</span>
                </div>
                <h1 className="font-cairo font-black text-sm sm:text-base text-slate-900 leading-tight">
                  {currentTitle}
                </h1>
              </div>
            </div>

            <AdminQuickSearch members={adminMembers || []} requests={interestRequests || []} />

            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* شارة حالة قاعدة البيانات */}
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[11px] font-tajawal font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>الخادم نشط</span>
              </div>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('focus'))}
                title="تحديث بيانات الصفحة"
                className="hidden sm:flex p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <Link
                to="/"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-cairo font-bold text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" /> عرض المنصة
              </Link>

              <NotificationsBell
                pendingRequests={pendingRequests}
                pendingReports={pendingReports}
                openTickets={openTickets}
              />

              <div className="flex items-center gap-2 pr-1 border-r border-slate-200/80 pl-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                  إ
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-cairo font-bold text-slate-800 leading-none">الإدارة</p>
                  <p className="text-[10px] text-amber-700 font-bold font-cairo mt-0.5">
                    المدير العام
                  </p>
                </div>
              </div>

              <button
                onClick={handleAdminLogout}
                title="تسجيل الخروج من لوحة الإدارة"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-cairo font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200/60"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          </div>

          {impersonating && (
            <div className="bg-gradient-to-l from-amber-500 to-amber-400 px-4 py-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-cairo font-bold text-xs text-navy-950">
                <UserCog className="w-4 h-4 flex-shrink-0" />
                أنت تتصفّح بحساب عضو: <strong>{user?.name || impersonating}</strong>
              </span>
              <Link
                to="/"
                className="flex items-center gap-1.5 bg-navy-950 text-amber-300 font-cairo font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-navy-800 transition-colors flex-shrink-0"
              >
                <Globe className="w-3.5 h-3.5" /> عرض كالعضو
              </Link>
            </div>
          )}
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto">
          <AdminErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </AdminErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function AdminSidebarContent({
  sections,
  openSections,
  toggleSection,
  onNavigate,
  searchQuery,
  setSearchQuery,
  onLogout,
}: {
  sections: NavSection[];
  openSections: Record<string, boolean>;
  toggleSection: (title: string) => void;
  onNavigate?: () => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onLogout?: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <Link to="/admin" onClick={onNavigate} className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-cairo font-bold text-white">لوحة الإدارة</div>
            <div className="text-[10px] text-amber-400">توافق</div>
          </div>
        </Link>
      </div>

      <div className="p-2.5 border-b border-slate-700/50">
        <div className="relative">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في القائمة..."
            className="w-full pr-9 pl-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-tajawal placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2.5 space-y-1">
        {sections.map((section) => {
          const isOpen = openSections[section.title] !== false;
          const totalSectionBadges = section.items.reduce((acc, item) => acc + (item.badge || 0), 0);
          return (
            <div key={section.title} className="rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection(section.title)}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-[11px] font-cairo font-bold rounded-xl transition-colors ${
                  isOpen ? 'text-amber-400 bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <section.icon className="w-4 h-4" />
                  {section.title}
                </div>
                <div className="flex items-center gap-2">
                  {totalSectionBadges > 0 && !isOpen && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 ring-4 ring-rose-500/30 animate-pulse" />
                  )}
                  {totalSectionBadges > 0 && isOpen && (
                    <span className="text-[10px] text-white bg-rose-500/90 px-1.5 py-0.5 rounded-full font-sans">
                      {totalSectionBadges}
                    </span>
                  )}
                  <span className={`text-[10px] transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 mt-1 pr-2">
                      {section.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.end}
                          onClick={onNavigate}
                          label={item.label}
                          icon={item.icon}
                          badge={item.badge}
                          badgeColor={item.badgeColor}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="p-2.5 border-t border-slate-700/50 space-y-1">
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors cursor-pointer text-right"
          >
            <LogOut className="w-4.5 h-4.5 text-rose-400" />
            <span className="font-cairo font-semibold text-xs">تسجيل الخروج</span>
          </button>
        )}
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <Globe className="w-4.5 h-4.5" />
          <span className="font-cairo font-semibold text-xs">العودة للموقع</span>
        </Link>
      </div>
    </>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  end,
  onClick,
  badge,
  badgeColor,
}: {
  key?: string;
  to: string;
  label: string;
  icon: any;
  end: boolean;
  onClick?: () => void;
  badge?: number;
  badgeColor?: string;
}) {
  const location = useLocation();
  const active = isNavItemActive({ to, label, icon: Icon, end, badge, badgeColor }, location);

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl font-cairo font-semibold text-xs transition-all no-tap-highlight ${
        active
          ? 'bg-gold-gradient text-navy-950 shadow-gold font-bold'
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${active ? 'text-navy-900' : 'group-hover:text-amber-400'}`} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`text-white text-[10px] font-bold min-w-5 h-5 px-1 rounded-full flex items-center justify-center ${
            active ? 'bg-navy-900 text-amber-300' : badgeColor || 'bg-rose-500'
          }`}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

function NotificationsBell({
  pendingRequests,
  pendingReports,
  openTickets,
}: {
  pendingRequests: number;
  pendingReports: number;
  openTickets: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const total = pendingRequests + pendingReports + openTickets;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items = [
    {
      show: pendingRequests > 0,
      to: '/admin/journeys?tab=requests',
      icon: Heart,
      color: 'text-rose-500 bg-rose-50',
      label: 'طلبات اهتمام معلّقة',
      count: pendingRequests,
    },
    {
      show: openTickets > 0,
      to: '/admin/trust?tab=messages',
      icon: MessageSquare,
      color: 'text-amber-500 bg-amber-50',
      label: 'تذاكر دعم مفتوحة',
      count: openTickets,
    },
    {
      show: pendingReports > 0,
      to: '/admin/trust?tab=reports',
      icon: ShieldAlert,
      color: 'text-red-500 bg-red-50',
      label: 'بلاغات بانتظار المراجعة',
      count: pendingReports,
    },
  ].filter((i) => i.show);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative p-2.5 rounded-xl transition-colors ${open ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {total > 0 && (
          <span className="absolute -top-0.5 -left-0.5 bg-rose-500 text-white text-[9px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-white">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-cairo font-bold text-sm text-slate-900">الإشعارات</span>
              {total > 0 && (
                <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                  {total} جديد
                </span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-tajawal">لا توجد إشعارات جديدة</p>
                </div>
              ) : (
                items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${it.color}`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-cairo font-bold text-slate-800">{it.label}</p>
                        <p className="text-[10px] text-slate-400 font-tajawal">اضغط للانتقال والمعالجة</p>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{it.count}</span>
                    </Link>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminLoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState('admin@tawafok.com');
  const [password, setPassword] = useState('Pass@1234');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizeArabicDigits = (str: string) => {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return str.replace(/[٠-٩]/g, (w) => arabicDigits.indexOf(w).toString());
  };

  const handleQuickDemoLogin = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('twafok_demo_admin', 'true');
      localStorage.setItem('twafok_active_admin_email', 'admin@tawafok.com');
    }
    onLoginSuccess();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = normalizeArabicDigits(password.trim());

      if (!cleanEmail) {
        setError('يرجى إدخال البريد الإلكتروني');
        setLoading(false);
        return;
      }

      // 1. التحقق من قائمة المشرفين المسجلة محلياً في saved_admin_users
      let isLocalAdminMatch = false;
      let matchedAdminUser: any = null;
      if (typeof window !== 'undefined') {
        try {
          const savedUsers = JSON.parse(localStorage.getItem('saved_admin_users') || '[]');
          if (Array.isArray(savedUsers)) {
            matchedAdminUser = savedUsers.find((u: any) => u.email?.toLowerCase().trim() === cleanEmail && u.status !== 'suspended');
            if (matchedAdminUser) {
              isLocalAdminMatch = true;
            }
          }
        } catch { /* ignore */ }
      }

      const isAdminEmailPattern =
        cleanEmail === 'admin@tawafok.com' ||
        cleanEmail === 'admin@tawasul.sa' ||
        cleanEmail === 'demo@tawasul.sa' ||
        cleanEmail === 'algohrah4u@gmail.com' ||
        cleanEmail.startsWith('admin@') ||
        isLocalAdminMatch;

      if (!isAdminEmailPattern) {
        setError('البريد الإلكتروني غير مخوّل كمدير نظام. استخدم البريد الإداري المعتمد أو زر الدخول المباشر بالأسفل.');
        setLoading(false);
        return;
      }

      // 2. تسجيل الجلسة الإدارية وتفعيل الوصول
      if (typeof window !== 'undefined') {
        localStorage.setItem('twafok_demo_admin', 'true');
        localStorage.setItem('twafok_active_admin_email', cleanEmail);
        if (matchedAdminUser) {
          localStorage.setItem('twafok_current_admin_user', JSON.stringify(matchedAdminUser));
        }
      }

      // 3. محاولة مزامنة الجلسة مع Supabase Auth في الخلفية إن أمكن
      try {
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });
        if (signInError) {
          const { error: signUpError } = await supabaseClient.auth.signUp({ email: cleanEmail, password: cleanPassword });
          if (!signUpError) {
            await supabaseClient.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword }).catch(() => null);
          }
        }
      } catch {
        // لا نحجب الدخول إذا كان Supabase غير متصل
      }

      onLoginSuccess();
    } catch (err: any) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('twafok_demo_admin', 'true');
      }
      onLoginSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* خلفية جمالية */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20 ring-4 ring-amber-500/10">
            <ShieldCheck className="w-8 h-8 text-slate-950" />
          </div>
          <h1 className="font-cairo font-black text-2xl text-white mb-1">لوحة الإدارة والتحكم</h1>
          <p className="text-xs font-tajawal text-slate-400">منصة توافق لتيسير الزواج - الدخول الإداري المركزي</p>
        </div>

        {/* كارت معلومات الدخول السريع */}
        <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-right">
          <p className="text-[11px] font-cairo font-bold text-amber-300 mb-1">بيانات الدخول الإداري المعتمدة:</p>
          <p className="text-[11px] font-mono text-slate-300">البريد: <span className="text-amber-400 font-bold">admin@tawafok.com</span></p>
          <p className="text-[11px] font-mono text-slate-300">كلمة السر: <span className="text-amber-400 font-bold">Pass@1234</span></p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-cairo font-bold text-rose-300 leading-relaxed">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-cairo font-bold text-slate-300 mb-1.5">البريد الإلكتروني</label>
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@tawafok.com"
                className="w-full pr-10 pl-4 py-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-white text-sm font-sans placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all text-right"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-cairo font-bold text-slate-300 mb-1.5">كلمة السر</label>
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-10 pl-10 py-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-white text-sm font-sans placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all text-right"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-cairo font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>تسجيل الدخول للوحة الإدارة</span>
              </>
            )}
          </button>
        </form>

        {/* زر الدخول المباشر بنقرة واحدة للمعاينة */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
          <button
            type="button"
            onClick={handleQuickDemoLogin}
            className="w-full py-3 px-4 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-cairo font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>الدخول السريع المباشر كمدير عام (بنقرة واحدة)</span>
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-cairo text-slate-400 hover:text-amber-400 transition-colors">
            <Globe className="w-3.5 h-3.5" /> العودة للواجهة الرئيسية للموقع
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
