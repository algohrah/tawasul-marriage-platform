import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './lib/AppContext';
import ErrorBoundary from './components/ErrorBoundary';

const routeLoaders = {
  Layout: () => import('./components/layout/Layout'),
  AdminLayout: () => import('./components/admin/AdminLayout'),
  Home: () => import('./pages/Home'),
  Search: () => import('./pages/Search'),
  Profile: () => import('./pages/Profile'),
  EditProfile: () => import('./pages/EditProfile'),
  CompleteProfile: () => import('./pages/CompleteProfile'),
  MemberProfile: () => import('./pages/MemberProfile'),
  Register: () => import('./pages/Register'),
  Login: () => import('./pages/Login'),
  ForgotPassword: () => import('./pages/ForgotPassword'),
  ResetPassword: () => import('./pages/ResetPassword'),
  About: () => import('./pages/About'),
  Contact: () => import('./pages/Contact'),
  Plans: () => import('./pages/Plans'),
  Checkout: () => import('./pages/Checkout'),
  JourneyPage: () => import('./pages/JourneyPage'),
  Notifications: () => import('./pages/Notifications'),
  InterestRequests: () => import('./pages/InterestRequests'),
  AdminChat: () => import('./pages/AdminChat'),
  LegalPage: () => import('./pages/Legal'),
  NotFound: () => import('./pages/NotFound'),
  AdminDashboard: () => import('./pages/admin/AdminDashboard'),
  AdminMembers: () => import('./pages/admin/AdminMembers'),
  AdminRequests: () => import('./pages/admin/AdminRequests'),
  AdminVerifications: () => import('./pages/admin/AdminVerifications'),
  AdminTransactions: () => import('./pages/admin/AdminTransactions'),
  AdminMessages: () => import('./pages/admin/AdminMessages'),
  AdminReports: () => import('./pages/admin/AdminReports'),
  AdminPlans: () => import('./pages/admin/AdminPlans'),
  AdminPlatformSettings: () => import('./pages/admin/AdminPlatformSettings'),
  AdminPaymentSettings: () => import('./pages/admin/AdminPaymentSettings'),
  AdminSecuritySettings: () => import('./pages/admin/AdminSecuritySettings'),
  AdminNotifications: () => import('./pages/admin/AdminNotifications'),
  AdminCities: () => import('./pages/admin/AdminCities'),
  AdminAnalytics: () => import('./pages/admin/AdminAnalytics'),
  AdminImportMembers: () => import('./pages/admin/AdminImportMembers'),
  AdminExemptions: () => import('./pages/admin/AdminExemptions'),
  AdminFeatureSettings: () => import('./pages/admin/AdminFeatureSettings'),
  AdminAuditLog: () => import('./pages/admin/AdminAuditLog'),
  AdminImportedCoordination: () => import('./pages/admin/AdminImportedCoordination'),
  AdminKhataabaDirectory: () => import('./pages/admin/AdminKhataabaDirectory'),
  AdminOverviewHub: () => import('./pages/admin/AdminOverviewHub'),
  AdminMembersHub: () => import('./pages/admin/AdminMembersHub'),
  AdminJourneysHub: () => import('./pages/admin/AdminJourneysHub'),
  AdminFinanceHub: () => import('./pages/admin/AdminFinanceHub'),
  AdminTrustHub: () => import('./pages/admin/AdminTrustHub'),
  AdminSettingsHub: () => import('./pages/admin/AdminSettingsHub'),
};

type RouteLoader = () => Promise<any>;
type PreloadableLazy = ReturnType<typeof lazy> & { preload: RouteLoader };

// يلفّ مُحمّل الوحدة بآلية استرجاع تلقائي: عند فشل جلب chunk (غالباً لأن النشر
// حدّث أسماء الملفات وبقيت نسخة index.html القديمة في المتصفح) نُعيد تحميل الصفحة
// مرة واحدة لجلب النسخة الجديدة، مع علامة في sessionStorage لمنع أي حلقة لانهائية.
function makeReloadableLoader(loader: RouteLoader): RouteLoader {
  return async () => {
    try {
      return await loader();
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      const isChunkError =
        /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|dynamically imported module/i.test(msg);
      if (isChunkError && typeof window !== 'undefined') {
        const KEY = 'chunk_reload_ts';
        const last = Number(sessionStorage.getItem(KEY) || '0');
        // نعيد التحميل مرة واحدة كل 10 ثوانٍ كحد أقصى لتفادي التكرار اللانهائي
        if (Date.now() - last > 10000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
          // نُرجع Promise لا يُحل حتى تكتمل إعادة التحميل
          return new Promise(() => {});
        }
      }
      throw err;
    }
  };
}

function lazyWithPreload(loader: RouteLoader): PreloadableLazy {
  const reloadable = makeReloadableLoader(loader);
  const Component = lazy(reloadable) as PreloadableLazy;
  Component.preload = reloadable;
  return Component;
}

const Layout = lazyWithPreload(routeLoaders.Layout);
const AdminLayout = lazyWithPreload(routeLoaders.AdminLayout);

// Public/User pages
const Home = lazyWithPreload(routeLoaders.Home);
const Search = lazyWithPreload(routeLoaders.Search);
const Profile = lazyWithPreload(routeLoaders.Profile);
const EditProfile = lazyWithPreload(routeLoaders.EditProfile);
const CompleteProfile = lazyWithPreload(routeLoaders.CompleteProfile);
const MemberProfile = lazyWithPreload(routeLoaders.MemberProfile);
const Register = lazyWithPreload(routeLoaders.Register);
const Login = lazyWithPreload(routeLoaders.Login);
const ForgotPassword = lazyWithPreload(routeLoaders.ForgotPassword);
const ResetPassword = lazyWithPreload(routeLoaders.ResetPassword);
const About = lazyWithPreload(routeLoaders.About);
const Contact = lazyWithPreload(routeLoaders.Contact);
const Plans = lazyWithPreload(routeLoaders.Plans);
const Checkout = lazyWithPreload(routeLoaders.Checkout);
const JourneyPage = lazyWithPreload(routeLoaders.JourneyPage);
const Notifications = lazyWithPreload(routeLoaders.Notifications);
const InterestRequests = lazyWithPreload(routeLoaders.InterestRequests);
const AdminChat = lazyWithPreload(routeLoaders.AdminChat);
const LegalPage = lazyWithPreload(routeLoaders.LegalPage);
const NotFound = lazyWithPreload(routeLoaders.NotFound);

// Admin pages
const AdminDashboard = lazyWithPreload(routeLoaders.AdminDashboard);
const AdminMembers = lazyWithPreload(routeLoaders.AdminMembers);
const AdminRequests = lazyWithPreload(routeLoaders.AdminRequests);
const AdminVerifications = lazyWithPreload(routeLoaders.AdminVerifications);
const AdminTransactions = lazyWithPreload(routeLoaders.AdminTransactions);
const AdminMessages = lazyWithPreload(routeLoaders.AdminMessages);
const AdminReports = lazyWithPreload(routeLoaders.AdminReports);
const AdminPlans = lazyWithPreload(routeLoaders.AdminPlans);
const AdminPlatformSettings = lazyWithPreload(routeLoaders.AdminPlatformSettings);
const AdminPaymentSettings = lazyWithPreload(routeLoaders.AdminPaymentSettings);
const AdminSecuritySettings = lazyWithPreload(routeLoaders.AdminSecuritySettings);
const AdminNotifications = lazyWithPreload(routeLoaders.AdminNotifications);
const AdminCities = lazyWithPreload(routeLoaders.AdminCities);
const AdminAnalytics = lazyWithPreload(routeLoaders.AdminAnalytics);
const AdminImportMembers = lazyWithPreload(routeLoaders.AdminImportMembers);
const AdminExemptions = lazyWithPreload(routeLoaders.AdminExemptions);
const AdminFeatureSettings = lazyWithPreload(routeLoaders.AdminFeatureSettings);
const AdminAuditLog = lazyWithPreload(routeLoaders.AdminAuditLog);
const AdminImportedCoordination = lazyWithPreload(routeLoaders.AdminImportedCoordination);
const AdminKhataabaDirectory = lazyWithPreload(routeLoaders.AdminKhataabaDirectory);
const AdminOverviewHub = lazyWithPreload(routeLoaders.AdminOverviewHub);
const AdminMembersHub = lazyWithPreload(routeLoaders.AdminMembersHub);
const AdminJourneysHub = lazyWithPreload(routeLoaders.AdminJourneysHub);
const AdminFinanceHub = lazyWithPreload(routeLoaders.AdminFinanceHub);
const AdminTrustHub = lazyWithPreload(routeLoaders.AdminTrustHub);
const AdminSettingsHub = lazyWithPreload(routeLoaders.AdminSettingsHub);

const preloadedRoutes = new Set<string>();

function preloadRoute(pathname: string) {
  const path = (pathname.replace(/\/+$/, '') || '/').toLowerCase();
  const jobs: Array<[string, RouteLoader]> = [];

  const add = (key: keyof typeof routeLoaders) => jobs.push([key, routeLoaders[key]]);

  if (path.startsWith('/admin')) {
    add('AdminLayout');
    if (path === '/admin') add('AdminDashboard');
    else if (path.startsWith('/admin/analytics')) add('AdminAnalytics');
    else if (path.startsWith('/admin/members')) add('AdminMembers');
    else if (path.startsWith('/admin/import-members')) add('AdminImportMembers');
    else if (path.startsWith('/admin/cities')) add('AdminCities');
    else if (path.startsWith('/admin/verifications')) add('AdminVerifications');
    else if (path.startsWith('/admin/requests')) add('AdminRequests');
    else if (path.startsWith('/admin/imported-coordination')) add('AdminImportedCoordination');
    else if (path.startsWith('/admin/messages')) add('AdminMessages');
    else if (path.startsWith('/admin/reports')) add('AdminReports');
    else if (path.startsWith('/admin/audit-log')) add('AdminAuditLog');
    else if (path.startsWith('/admin/plans')) add('AdminPlans');
    else if (path.startsWith('/admin/transactions')) add('AdminTransactions');
    else if (path.startsWith('/admin/exemptions')) add('AdminExemptions');
    else if (path.startsWith('/admin/notifications')) add('AdminNotifications');
    else if (path.startsWith('/admin/settings/platform')) add('AdminPlatformSettings');
    else if (path.startsWith('/admin/settings/payments')) add('AdminPaymentSettings');
    else if (path.startsWith('/admin/settings/features')) add('AdminFeatureSettings');
    else if (path.startsWith('/admin/settings/security')) add('AdminSecuritySettings');
  } else {
    add('Layout');
    if (path === '/') add('Home');
    else if (path.startsWith('/search')) add('Search');
    else if (path.startsWith('/profile')) add('Profile');
    else if (path.startsWith('/edit-profile')) add('EditProfile');
    else if (path.startsWith('/complete-profile')) add('CompleteProfile');
    else if (path.startsWith('/member/') || path.startsWith('/u/')) add('MemberProfile');
    else if (path.startsWith('/register')) add('Register');
    else if (path.startsWith('/login')) add('Login');
    else if (path.startsWith('/forgot-password')) add('ForgotPassword');
    else if (path.startsWith('/reset-password')) add('ResetPassword');
    else if (path.startsWith('/about')) add('About');
    else if (path.startsWith('/contact')) add('Contact');
    else if (path.startsWith('/plans')) add('Plans');
    else if (path.startsWith('/checkout')) add('Checkout');
    else if (path.startsWith('/journey')) add('JourneyPage');
    else if (path.startsWith('/notifications')) add('Notifications');
    else if (path.startsWith('/requests')) add('InterestRequests');
    else if (path.startsWith('/admin-chat')) add('AdminChat');
    else if (path.startsWith('/legal/')) add('LegalPage');
  }

  jobs.forEach(([key, loader]) => {
    if (preloadedRoutes.has(key)) return;
    preloadedRoutes.add(key);
    loader().catch(() => preloadedRoutes.delete(key));
  });
}

function RoutePrefetcher() {
  useEffect(() => {
    const preloadAnchor = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      const anchor = element?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      preloadRoute(url.pathname);
    };

    const preloadVisibleLinks = () => {
      document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach((anchor) => {
        const rect = anchor.getBoundingClientRect();
        const nearViewport = rect.top < window.innerHeight + 420 && rect.bottom > -220;
        if (nearViewport) preloadRoute(new URL(anchor.href, window.location.href).pathname);
      });
    };

    const onPointer = (event: Event) => preloadAnchor(event.target);
    const onFocus = (event: Event) => preloadAnchor(event.target);

    document.addEventListener('pointerover', onPointer, { passive: true });
    document.addEventListener('pointerdown', onPointer, { passive: true });
    document.addEventListener('touchstart', onPointer, { passive: true });
    document.addEventListener('focusin', onFocus);

    const scheduleIdle = window.requestIdleCallback || ((cb: any) => window.setTimeout(cb, 700));
    const cancelIdle = window.cancelIdleCallback || window.clearTimeout;
    const idleId = scheduleIdle(() => {
      preloadVisibleLinks();
      const likelyNext = window.location.pathname.startsWith('/admin')
        ? ['/admin', '/admin/members', '/admin/requests', '/admin/import-members']
        : ['/search', '/member/prefetch', '/requests', '/profile', '/plans'];
      likelyNext.forEach(preloadRoute);
    }, { timeout: 1800 });

    const onScroll = () => {
      window.requestAnimationFrame(preloadVisibleLinks);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      document.removeEventListener('pointerover', onPointer);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('focusin', onFocus);
      window.removeEventListener('scroll', onScroll);
      cancelIdle(idleId as any);
    };
  }, []);

  return null;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 dark:bg-navy-950 text-emerald-600 p-4" dir="rtl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin"></div>
        <span className="text-sm font-medium font-tajawal text-slate-700 dark:text-slate-300">جاري تحضير المنصة...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <RoutePrefetcher />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* User facing layout */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="search" element={<Search />} />
                <Route path="profile" element={<Profile />} />
                <Route path="edit-profile" element={<EditProfile />} />
                <Route path="complete-profile" element={<CompleteProfile />} />
                <Route path="member/:id" element={<MemberProfile />} />
                <Route path="u/:username" element={<MemberProfile />} />
                <Route path="register" element={<Register />} />
                <Route path="login" element={<Login />} />
                <Route path="forgot-password" element={<ForgotPassword />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="about" element={<About />} />
                <Route path="contact" element={<Contact />} />
                <Route path="plans" element={<Plans />} />
                <Route path="checkout/:planId" element={<Checkout />} />
                <Route path="journey" element={<JourneyPage />} />
                <Route path="journey/:id" element={<JourneyPage />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="requests" element={<InterestRequests />} />
                <Route path="admin-chat" element={<AdminChat />} />
                {/* روابط مختصرة/قديمة — تحويلات لتفادي صفحة 404 */}
                <Route path="support" element={<Navigate to="/admin-chat" replace />} />
                <Route path="terms" element={<Navigate to="/legal/terms" replace />} />
                <Route path="privacy" element={<Navigate to="/legal/privacy" replace />} />
                <Route path="legal/privacy" element={<LegalPage type="privacy" />} />
                <Route path="legal/terms" element={<LegalPage type="terms" />} />
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* Admin layout */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverviewHub />} />
                <Route path="overview" element={<AdminOverviewHub />} />
                <Route path="analytics" element={<Navigate to="/admin/overview?tab=analytics" replace />} />
                
                <Route path="members" element={<AdminMembersHub />} />
                <Route path="members-hub" element={<AdminMembersHub />} />
                <Route path="khataaba-directory" element={<Navigate to="/admin/members?tab=khataaba" replace />} />
                <Route path="import-members" element={<Navigate to="/admin/members?tab=import" replace />} />
                <Route path="verifications" element={<Navigate to="/admin/members?tab=verifications" replace />} />
                
                <Route path="journeys" element={<AdminJourneysHub />} />
                <Route path="requests" element={<Navigate to="/admin/journeys?tab=requests" replace />} />
                <Route path="imported-coordination" element={<Navigate to="/admin/journeys?tab=imported" replace />} />
                
                <Route path="finance" element={<AdminFinanceHub />} />
                <Route path="transactions" element={<Navigate to="/admin/finance?tab=transactions" replace />} />
                <Route path="plans" element={<Navigate to="/admin/finance?tab=plans" replace />} />
                <Route path="exemptions" element={<Navigate to="/admin/finance?tab=exemptions" replace />} />
                
                <Route path="trust" element={<AdminTrustHub />} />
                <Route path="support" element={<Navigate to="/admin/trust?tab=messages" replace />} />
                <Route path="messages" element={<Navigate to="/admin/trust?tab=messages" replace />} />
                <Route path="reports" element={<Navigate to="/admin/trust?tab=reports" replace />} />
                <Route path="audit-log" element={<Navigate to="/admin/trust?tab=audit" replace />} />
                
                <Route path="settings" element={<AdminSettingsHub />} />
                <Route path="backup" element={<Navigate to="/admin/settings?tab=backup" replace />} />
                <Route path="settings/backup" element={<Navigate to="/admin/settings?tab=backup" replace />} />
                <Route path="settings/platform" element={<Navigate to="/admin/settings?tab=platform" replace />} />
                <Route path="settings/payments" element={<Navigate to="/admin/settings?tab=payments" replace />} />
                <Route path="settings/features" element={<Navigate to="/admin/settings?tab=features" replace />} />
                <Route path="settings/security" element={<Navigate to="/admin/settings?tab=security" replace />} />
                <Route path="cities" element={<Navigate to="/admin/settings?tab=cities" replace />} />
                <Route path="notifications" element={<Navigate to="/admin/settings?tab=notifications" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
