import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Heart, DollarSign, ShieldCheck, Bell,
  Eye, AlertCircle, CheckCircle2, Activity, LogIn, UserCog,
  Award, CreditCard, TrendingUp, Plus, Upload, Building2,
  Settings, ArrowLeft, ArrowUpRight,
} from 'lucide-react';
import { useAdminStats, useAdminMembers } from '../../lib/useAdminData';
import { useApp } from '../../lib/AppContext';
import { STAGE_META } from '../../lib/journey';

const STAGE_KEYS = ['sent', 'accepted', 'seriousness', 'coordination', 'sharia_viewing', 'engagement', 'completed', 'declined', 'cancelled'] as const;

export default function AdminDashboard() {
  const { stats, loading, error } = useAdminStats();
  const { members: adminMembers } = useAdminMembers();
  const { impersonateUser } = useApp();
  const navigate = useNavigate();

  const defaultStats = {
    totalMembers: 0,
    activeRequests: 0,
    verified: 0,
    premium: 0,
    males: 0,
    females: 0,
    totalRequests: 0,
    pendingRequests: 0,
    activeJourneys: 0,
    completed: 0,
    declined: 0,
    cancelled: 0,
    pendingMembers: 0,
    revenue: 0,
    depositsPaid: 0,
    stageBreakdown: {},
    seriousnessBadges: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    recentEvents: [],
  };

  const displayStats = {
    ...defaultStats,
    ...(stats || {}),
    stageBreakdown: stats?.stageBreakdown || defaultStats.stageBreakdown,
    recentEvents: stats?.recentEvents || defaultStats.recentEvents,
  };

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
        <p className="font-cairo text-slate-700 font-bold">{error || 'تعذّر تحميل الإحصائيات'}</p>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-100 rounded-2xl p-4 h-24 animate-pulse" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-slate-100 rounded-2xl h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // بطاقات النظرة السريعة الرئيسية في الأعلى (تتضمن الأعضاء مع عددهم وطلبات الاهتمام وروابط الدخول المباشرة)
  const quickOverviewCards = [
    {
      label: 'الأعضاء',
      value: displayStats.totalMembers || (adminMembers?.length || 0),
      subtext: `${displayStats.males} ذكور · ${displayStats.females} إناث`,
      to: '/admin/members?tab=members',
      icon: Users,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
      actionText: 'إدارة الأعضاء',
    },
    {
      label: 'طلبات الاهتمام',
      value: displayStats.totalRequests || (displayStats.pendingRequests + displayStats.activeJourneys),
      subtext: `${displayStats.pendingRequests} معلّق · ${displayStats.activeJourneys} رحلة نشطة`,
      to: '/admin/journeys?tab=requests',
      icon: Heart,
      color: 'text-rose-600 bg-rose-50 border-rose-100',
      actionText: 'متابعة الرحلات',
    },
    {
      label: 'أعضاء موثّقون',
      value: displayStats.verified,
      subtext: displayStats.pendingMembers > 0 ? `${displayStats.pendingMembers} بانتظار المراجعة` : 'تم التحقق من الهوية',
      to: '/admin/members?tab=verifications',
      icon: ShieldCheck,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      actionText: 'طلبات التوثيق',
    },
    {
      label: 'الإيرادات والاشتراكات',
      value: `${(displayStats.totalRevenue || displayStats.revenue || 0).toLocaleString()} ر.س`,
      subtext: `${displayStats.premium} اشتراك مميّز · ${displayStats.totalTransactions || 0} معاملة`,
      to: '/admin/finance?tab=transactions',
      icon: DollarSign,
      color: 'text-amber-600 bg-amber-50 border-amber-100',
      actionText: 'السجل المالي',
    },
  ];

  // إجراءات سريعة مميزة ومباشرة بدون تكرار
  const quickActions = [
    { label: 'استيراد وتصدير الأعضاء', desc: 'إضافة دفعات ملفات Excel / JSON', to: '/admin/members?tab=import', icon: Upload, color: 'bg-indigo-500' },
    { label: 'دليل الخطابات والمكاتب', desc: 'إدارة وتنسيق شركاء التوفيق', to: '/admin/members?tab=khataaba', icon: Building2, color: 'bg-purple-500' },
    { label: 'إدارة باقات الاشتراك', desc: 'تعديل الأسعار والميزات والحصص', to: '/admin/finance?tab=plans', icon: DollarSign, color: 'bg-emerald-500' },
    { label: 'بوابات وطرق الدفع', desc: 'تهيئة PayPal و MyFatoorah', to: '/admin/settings?tab=payments', icon: CreditCard, color: 'bg-amber-500' },
  ];

  // إحصائيات تفصيلية تكميلية قابلة للنقر للدخول للشاشات المعنية
  const detailedStats = [
    { label: 'رحلات توافق مكتملة', value: displayStats.completed, to: '/admin/journeys?tab=requests', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: 'اشتراكات مميّزة نشطة', value: displayStats.premium, to: '/admin/finance?tab=plans', icon: Award, color: 'bg-purple-50 text-purple-600 border-purple-100' },
    { label: 'رحلات اهتمام نشطة', value: displayStats.activeJourneys, to: '/admin/journeys?tab=requests', icon: Activity, color: 'bg-rose-50 text-rose-600 border-rose-100' },
    { label: 'رسوم جدية مدفوعة', value: displayStats.depositsPaid, to: '/admin/finance?tab=transactions', icon: CreditCard, color: 'bg-teal-50 text-teal-600 border-teal-100' },
    { label: 'أوسمة الجدية النشطة', value: displayStats.seriousnessBadges || 0, to: '/admin/members?tab=members', icon: TrendingUp, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { label: 'إجمالي المعاملات المالية', value: displayStats.totalTransactions || 0, to: '/admin/finance?tab=transactions', icon: CreditCard, color: 'bg-sky-50 text-sky-600 border-sky-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-l from-slate-900 to-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="relative">
          <h2 className="font-cairo font-extrabold text-2xl text-white">مرحبًا بك في لوحة التحكم 👋</h2>
          <p className="text-slate-400 font-tajawal mt-1">بيانات حيّة من قاعدة بيانات توافق</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-cairo font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> متصل بقاعدة البيانات
            </span>
            <Link to="/admin/members?tab=members" className="px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors text-xs font-cairo font-bold flex items-center gap-1 cursor-pointer">
              <Users className="w-3.5 h-3.5" />
              <span>{displayStats.totalMembers} عضو</span>
            </Link>
            <span className="px-3 py-1.5 rounded-full bg-blue-500/15 text-blue-400 text-xs font-cairo font-bold">
              {displayStats.males} ذكر · {displayStats.females} أنثى
            </span>
          </div>
        </div>
      </motion.div>

      {/* نظرة سريعة في الأعلى */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cairo font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" /> نظرة سريعة
          </h3>
          <span className="text-xs text-slate-400 font-tajawal hidden sm:inline">انقر على أي بطاقة للانتقال المباشر للقسم</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {quickOverviewCards.map((task, i) => {
            const Icon = task.icon;
            return (
              <motion.div key={task.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={task.to} className="block bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md hover:border-amber-400/80 transition-all group cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-tajawal font-medium text-slate-500 truncate mb-1">{task.label}</div>
                      <div className="font-cairo font-extrabold text-2xl sm:text-3xl text-slate-900 leading-none mb-1.5">{task.value}</div>
                      <div className="text-[11px] text-slate-400 font-tajawal truncate">{task.subtext}</div>
                    </div>
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border ${task.color} group-hover:scale-105 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-amber-600 font-cairo font-bold group-hover:text-amber-700">
                    <span>{task.actionText}</span>
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* مراحل الرحلة (Journey breakdown) */}
      <div>
        <h3 className="font-cairo font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-500" /> توزيع رحلات الاهتمام حسب المرحلة
        </h3>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STAGE_KEYS.map((key) => {
              const meta = STAGE_META[key];
              const Icon = meta.icon;
              const count = displayStats.stageBreakdown[key] || 0;
              return (
                <Link
                  key={key}
                  to="/admin/journeys?tab=requests"
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50/60 hover:border-amber-200 border border-transparent transition-all cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-600 flex-shrink-0">
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="font-cairo font-extrabold text-lg text-slate-900 leading-none">{count}</div>
                    <div className="text-[10px] text-slate-500 font-cairo">{meta.title}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="font-cairo font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Plus className="w-5 h-5 text-amber-500" /> إجراءات سريعة
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.div key={action.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={action.to} className="block bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md hover:border-amber-300 transition-all cursor-pointer">
                  <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center mb-2`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="font-cairo font-bold text-slate-900 text-sm">{action.label}</h4>
                  <p className="text-[11px] text-slate-400 font-tajawal">{action.desc}</p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* General stats */}
      <div>
        <h3 className="font-cairo font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-500" /> إحصائيات المنصة التكميلية
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {detailedStats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={stat.to}
                  className="bg-white rounded-2xl p-3.5 shadow-2xs border border-slate-200/80 hover:shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between h-full block cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-slate-500 font-tajawal font-medium truncate">{stat.label}</span>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${stat.color} flex-shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="font-cairo font-black text-xl text-slate-900 tracking-tight">{stat.value}</div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Quick impersonation — دخول سريع كأي عضو */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cairo font-bold text-slate-900 flex items-center gap-2">
            <UserCog className="w-5 h-5 text-amber-500" /> دخول سريع بحساب عضو
          </h3>
          <Link to="/admin/members?tab=members" className="text-xs text-amber-600 hover:text-amber-700 font-cairo font-bold flex items-center gap-1">
            <span>عرض كافة الأعضاء ({adminMembers?.length || displayStats.totalMembers})</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-400 font-tajawal mb-3">اختر عضواً للدخول بحسابه ومعاينة تجربته كأنك هو — يمكنك قبول/رفض الطلبات وإرسال الرسائل والتصفّح.</p>
          <div className="flex flex-wrap gap-2">
            {adminMembers.slice(0, 10).map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  impersonateUser({
                    id: m.id,
                    nickname: m.nickname,
                    gender: m.gender,
                    age: m.age,
                    city: m.city,
                    country: m.country,
                    realName: m.realName,
                    phone: m.phone,
                    maritalStatus: m.maritalStatus,
                    plan: m.plan,
                    verified: m.verified,
                    nationalId: m.nationalId,
                    email: m.email,
                  });
                  navigate('/profile');
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-cairo font-bold bg-slate-50 hover:bg-amber-100/70 hover:text-amber-900 text-slate-700 border border-slate-200/80 transition-all cursor-pointer"
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ${m.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                  {m.nickname ? m.nickname.charAt(0) : '#'}
                </div>
                <span>{m.nickname || `عضو #${m.id}`}</span>
                <span className="text-[10px] text-slate-400">({m.gender === 'male' ? 'ذكر' : 'أنثى'})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity — real events */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-cairo font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4.5 h-4.5 text-amber-500" />
            <span>آخر النشاطات (سجل المنصة والرحلات)</span>
          </h3>
          <span className="text-xs text-slate-400 font-tajawal">مباشر</span>
        </div>
        <div className="divide-y divide-slate-50">
          {displayStats.recentEvents.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400 font-cairo">لا توجد نشاطات مسجلة بعد</p>
          ) : (
            displayStats.recentEvents.map((ev: any) => (
              <div key={ev.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-4.5 h-4.5" />
                </div>
                <p className="flex-1 text-sm text-slate-700 font-tajawal">{ev.note || ev.description || ev.text || 'نشاط جديد في المنصة'}</p>
                <span className="text-xs text-slate-400 font-tajawal whitespace-nowrap">
                  {new Date(ev.created_at).toLocaleDateString('ar-SA')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
