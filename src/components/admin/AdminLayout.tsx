import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bell, Building2, ChevronDown, CreditCard, Database, DollarSign,
  Globe, Heart, LayoutDashboard, Lock, LogOut, Menu, MessageSquare,
  Settings, ShieldCheck, Ticket, Upload, Users, X,
} from 'lucide-react';
import AdminErrorBoundary from './AdminErrorBoundary';
import AdminQuickSearch from './AdminQuickSearch';
import { useApp } from '../../lib/AppContext';
import {
  DEMO_ADMIN,
  endOwnerAdminSession,
  hasOwnerAdminSession,
  isDemoAdminCredentials,
  startOwnerAdminSession,
} from '../../config/access';

type NavItem = { to: string; label: string; icon: any };
type NavSection = { title: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'الرؤية والتحليلات',
    items: [
      { to: '/admin', label: 'لوحة المعلومات', icon: LayoutDashboard },
      { to: '/admin/overview?tab=analytics', label: 'التحليلات والتقارير', icon: BarChart3 },
    ],
  },
  {
    title: 'الأعضاء والوساطة',
    items: [
      { to: '/admin/members?tab=members', label: 'إدارة الأعضاء', icon: Users },
      { to: '/admin/members?tab=verifications', label: 'طلبات التوثيق', icon: ShieldCheck },
      { to: '/admin/members?tab=khataaba', label: 'دليل الخطابات والمكاتب', icon: Building2 },
      { to: '/admin/members?tab=import', label: 'استيراد وتصدير الأعضاء', icon: Upload },
    ],
  },
  {
    title: 'الرحلات والتوافق',
    items: [
      { to: '/admin/journeys?tab=requests', label: 'طلبات الاهتمام', icon: Heart },
      { to: '/admin/journeys?tab=imported', label: 'تنسيق الأعضاء المستوردين', icon: Heart },
    ],
  },
  {
    title: 'المال والاشتراكات',
    items: [
      { to: '/admin/finance?tab=transactions', label: 'المعاملات المالية', icon: DollarSign },
      { to: '/admin/finance?tab=plans', label: 'الباقات والأسعار', icon: CreditCard },
      { to: '/admin/finance?tab=exemptions', label: 'الإعفاءات', icon: CreditCard },
    ],
  },
  {
    title: 'الدعم والرقابة',
    items: [
      { to: '/admin/trust?tab=messages', label: 'الدعم والرسائل', icon: Ticket },
      { to: '/admin/trust?tab=reports', label: 'البلاغات والشكاوى', icon: MessageSquare },
      { to: '/admin/trust?tab=audit', label: 'سجل العمليات', icon: ShieldCheck },
    ],
  },
  {
    title: 'إعدادات المنصة',
    items: [
      { to: '/admin/settings?tab=platform', label: 'الهوية والإعدادات', icon: Globe },
      { to: '/admin/settings?tab=payments', label: 'إعدادات الدفع', icon: CreditCard },
      { to: '/admin/settings?tab=features', label: 'الميزات', icon: Settings },
      { to: '/admin/settings?tab=security', label: 'الأمان والدخول', icon: Lock },
      { to: '/admin/settings?tab=backup', label: 'النسخ الاحتياطي', icon: Database },
      { to: '/admin/settings?tab=cities', label: 'الدول والمدن', icon: Globe },
      { to: '/admin/settings?tab=notifications', label: 'الإشعارات', icon: Bell },
    ],
  },
];

export default function AdminLayout() {
  const [authenticated, setAuthenticated] = useState(hasOwnerAdminSession);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { adminMembers, interestRequests } = useApp();

  useEffect(() => {
    // Delete all legacy moderator records. The development model has one owner admin only.
    localStorage.removeItem('saved_admin_users');
    localStorage.removeItem('twafok_admin_users');
    localStorage.removeItem('twafok_current_admin_user');
  }, []);

  const currentTitle = useMemo(() => {
    const item = NAV_SECTIONS.flatMap((section) => section.items).find((entry) => {
      const path = entry.to.split('?')[0];
      return path === location.pathname;
    });
    return item?.label || 'لوحة المدير العام';
  }, [location.pathname]);

  const logout = () => {
    endOwnerAdminSession();
    setAuthenticated(false);
    navigate('/');
  };

  if (!authenticated) {
    return <OwnerAdminLogin onSuccess={() => setAuthenticated(true)} />;
  }

  const sidebar = (
    <div className="h-full flex flex-col bg-slate-950 text-white" dir="rtl">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <Link to="/admin" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-slate-950" /></div>
          <div><p className="font-cairo font-black">لوحة المدير العام</p><p className="text-[10px] text-amber-400">صلاحيات كاملة</p></div>
        </Link>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X className="w-5 h-5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1 text-[10px] font-cairo font-bold text-slate-500">{section.title}</p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const path = item.to.split('?')[0];
              const active = location.pathname === path && (!item.to.includes('?') || location.search === `?${item.to.split('?')[1]}`);
              return (
                <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-cairo font-bold transition-colors ${active ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                  <Icon className="w-4 h-4" /> {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10 space-y-2">
        <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5"><Globe className="w-4 h-4" /> عرض الموقع</Link>
        <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10"><LogOut className="w-4 h-4" /> تسجيل الخروج</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <aside className="hidden lg:block fixed top-0 right-0 bottom-0 w-72 z-50">{sidebar}</aside>
      {sidebarOpen && <div className="lg:hidden fixed inset-0 z-[60]"><button aria-label="إغلاق القائمة" className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} /><aside className="absolute top-0 right-0 bottom-0 w-72">{sidebar}</aside></div>}
      <div className="lg:mr-72">
        <header className="sticky top-0 z-40 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg bg-slate-100"><Menu className="w-5 h-5" /></button>
            <div><p className="text-[10px] text-amber-700 font-bold">المدير العام الوحيد</p><h1 className="font-cairo font-black text-sm text-slate-900">{currentTitle}</h1></div>
          </div>
          <div className="flex items-center gap-3">
            <AdminQuickSearch members={adminMembers || []} requests={interestRequests || []} />
            <span className="hidden sm:inline-flex px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-cairo font-bold">قاعدة محلية للتطوير</span>
            <button onClick={logout} className="p-2 rounded-xl bg-rose-50 text-rose-600" title="تسجيل الخروج"><LogOut className="w-4 h-4" /></button>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto">
          <AdminErrorBoundary resetKey={`${location.pathname}${location.search}`}><Outlet /></AdminErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function OwnerAdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState(DEMO_ADMIN.email);
  const [password, setPassword] = useState(DEMO_ADMIN.password);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const login = () => {
    if (!isDemoAdminCredentials(email, password)) {
      setError('بيانات المدير غير صحيحة');
      return;
    }
    startOwnerAdminSession();
    onSuccess();
  };

  const quickLogin = () => {
    setEmail(DEMO_ADMIN.email);
    setPassword(DEMO_ADMIN.password);
    startOwnerAdminSession();
    onSuccess();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl">
        <ShieldCheck className="w-14 h-14 text-amber-400 mx-auto mb-4" />
        <h1 className="font-cairo font-black text-2xl text-white text-center">دخول المدير العام</h1>
        <p className="text-xs text-slate-400 text-center mt-2">لا توجد حسابات مشرفين — هذا الحساب يمتلك جميع الصلاحيات</p>
        <div className="mt-5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-slate-300">
          <p>البريد: <b className="text-amber-400">{DEMO_ADMIN.email}</b></p>
          <p>كلمة المرور: <b className="text-amber-400">{DEMO_ADMIN.password}</b></p>
        </div>
        {error && <p className="mt-4 p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs">{error}</p>}
        <div className="mt-4 space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white" dir="ltr" />
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 pl-12 rounded-xl bg-slate-800 border border-slate-700 text-white" dir="ltr" />
            <button onClick={() => setShowPassword((v) => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><ChevronDown className={`w-5 h-5 ${showPassword ? 'rotate-180' : ''}`} /></button>
          </div>
          <button onClick={login} className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-cairo font-black">تسجيل الدخول</button>
          <button onClick={quickLogin} className="w-full py-3 rounded-xl bg-slate-800 text-amber-300 border border-amber-500/30 font-cairo font-bold">الدخول السريع بنقرة واحدة</button>
          <p className="text-[10px] text-center text-slate-500">بيانات تجريبية محلية ستُستبدل قبل الإطلاق</p>
        </div>
      </div>
    </div>
  );
}
