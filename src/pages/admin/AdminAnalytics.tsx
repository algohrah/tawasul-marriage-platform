import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Users, Heart, CreditCard, TrendingUp, Activity, LineChart } from 'lucide-react';
import { useAdminStats } from '../../lib/useAdminData';
import { useApp } from '../../lib/AppContext';
import { dataService } from '../../lib/data/DataService';
import PageHeader from '../../components/admin/PageHeader';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** آخر 6 أشهر ميلادية بالترتيب (الأقدم أولاً) بصيغة {year, month, label} */
function lastMonths(count: number) {
  const now = new Date();
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTHS_AR[d.getMonth()] });
  }
  return months;
}

function monthKey(dateStr: string | undefined | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** رسم بياني خطي بسيط (SVG بحت بدون مكتبات خارجية) لنمو الأعضاء عبر الوقت */
function GrowthLineChart({ points }: { points: { label: string; value: number }[] }) {
  const width = 560;
  const height = 160;
  const padding = 28;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (p.value / max) * (height - padding * 2);
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.x.toFixed(1)} ${height - padding} L ${coords[0]?.x.toFixed(1)} ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" preserveAspectRatio="none">
      <defs>
        <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* خطوط الشبكة */}
      {[0, 0.5, 1].map((t) => (
        <line key={`grid-${t}`} x1={padding} x2={width - padding} y1={padding + t * (height - padding * 2)} y2={padding + t * (height - padding * 2)} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      <path d={areaPath} fill="url(#growthFill)" />
      <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <g key={`pt-${i}-${c.label}`}>
          <circle cx={c.x} cy={c.y} r="3.5" fill="#f59e0b" />
          <text x={c.x} y={height - 6} textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="Cairo, sans-serif">{c.label}</text>
          <text x={c.x} y={c.y - 8} textAnchor="middle" fontSize="10" fill="#334155" fontWeight="bold" fontFamily="Cairo, sans-serif">{c.value}</text>
        </g>
      ))}
    </svg>
  );
}

/** رسم بياني بالأعمدة لإيرادات كل شهر */
function RevenueBarChart({ bars }: { bars: { label: string; value: number }[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex items-end justify-between gap-2 h-40 px-1">
      {bars.map((b, i) => (
        <div key={`bar-${i}-${b.label}`} className="flex-1 flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-cairo font-bold text-slate-700">{b.value.toLocaleString('ar-SA')}</span>
          <div className="w-full bg-slate-100 rounded-lg overflow-hidden flex items-end" style={{ height: '100px' }}>
            <div
              className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-lg transition-all"
              style={{ height: `${Math.max(3, (b.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 font-cairo">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalytics() {
  const { stats, loading } = useAdminStats();
  const { adminMembers } = useApp();
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const loadTx = () => {
      const tx = dataService.db.getTransactions();
      setTransactions(Array.isArray(tx) ? tx : []);
    };
    loadTx();
    const t = setTimeout(loadTx, 1200);
    return () => clearTimeout(t);
  }, []);

  const safeMembers = Array.isArray(adminMembers) ? adminMembers : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  const statCards = [
    { label: 'إجمالي الأعضاء', value: stats?.totalMembers || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'الأعضاء الموثقون', value: stats?.verified || 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'طلبات الاهتمام', value: stats?.totalRequests || 0, icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'الإيرادات التقريرية', value: (stats?.revenue || 0) + ' ر.س', icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const cities = safeMembers.reduce((acc: Record<string, number>, m) => {
    if (m?.city) {
      acc[m.city] = (acc[m.city] || 0) + 1;
    }
    return acc;
  }, {});

  const topCities = Object.entries(cities)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5);

  // ===== نمو الأعضاء عبر آخر 6 أشهر (بيانات حقيقية من created_at) =====
  const growthPoints = useMemo(() => {
    const months = lastMonths(6);
    return months.map(({ year, month, label }) => {
      const count = safeMembers.filter((m: any) => {
        const key = monthKey(m?.created_at || m?.joinedAt);
        return key === `${year}-${month}`;
      }).length;
      return { label, value: count };
    });
  }, [safeMembers]);

  const growthIsEmpty = growthPoints.every((p) => p.value === 0);

  // ===== الإيرادات الشهرية عبر آخر 6 أشهر (بيانات حقيقية من المعاملات المكتملة) =====
  const revenueBars = useMemo(() => {
    const months = lastMonths(6);
    return months.map(({ year, month, label }) => {
      const total = safeTransactions
        .filter((t: any) => t && t.status === 'completed' && monthKey(t.created_at || t.date) === `${year}-${month}`)
        .reduce((sum: number, t: any) => sum + Number(t?.amount || 0), 0);
      return { label, value: total };
    });
  }, [safeTransactions]);

  const revenueIsEmpty = revenueBars.every((b) => b.value === 0);

  return (
    <div className="space-y-5">
      <PageHeader icon={BarChart3} title="التحليلات المتقدمة" subtitle="إحصائيات وتقارير مفصلة عن أداء المنصة" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
              <Icon className={`w-6 h-6 ${s.color} mb-2`} />
              <p className={`font-cairo font-extrabold text-2xl ${s.color}`}>{s.value.toLocaleString('ar-SA')}</p>
              <p className="text-[11px] text-slate-500 font-cairo">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* رسوم بيانية حقيقية: نمو الأعضاء + الإيرادات الشهرية */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="font-cairo font-bold text-slate-900 mb-1 flex items-center gap-2">
            <LineChart className="w-5 h-5 text-amber-500" /> نمو الأعضاء (آخر 6 أشهر)
          </h3>
          <p className="text-[11px] text-slate-400 font-tajawal mb-3">عدد الأعضاء الجدد المسجلين كل شهر</p>
          {growthIsEmpty ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-400 font-cairo">لا توجد بيانات تسجيل كافية بعد</div>
          ) : (
            <GrowthLineChart points={growthPoints} />
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="font-cairo font-bold text-slate-900 mb-1 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-500" /> الإيرادات الشهرية (آخر 6 أشهر)
          </h3>
          <p className="text-[11px] text-slate-400 font-tajawal mb-3">إجمالي المعاملات المكتملة بالريال السعودي</p>
          {revenueIsEmpty ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-400 font-cairo">لا توجد معاملات مكتملة بعد</div>
          ) : (
            <RevenueBarChart bars={revenueBars} />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Stage breakdown */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="font-cairo font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-500" /> توزيع رحلات الاهتمام
          </h3>
          <div className="space-y-3">
            {stats?.stageBreakdown &&
              Object.entries(stats.stageBreakdown).map(([stage, count]) => (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs font-cairo font-bold text-slate-600 w-24 truncate">{stage}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${Math.max(2, ((count as number) / (stats.totalRequests || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-cairo font-bold text-slate-900 w-8 text-left">{count as any}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Top cities */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="font-cairo font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" /> أكثر المدن نشاطاً
          </h3>
          <div className="space-y-3">
            {topCities.map(([city, count]) => (
              <div key={city} className="flex items-center gap-3">
                <span className="text-xs font-cairo font-bold text-slate-600 w-24 truncate">{city}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${Math.max(2, ((count as number) / adminMembers.length) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-cairo font-bold text-slate-900 w-8 text-left">{count as any}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gender distribution */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <h3 className="font-cairo font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-500" /> توزيع الأعضاء حسب الجنس
        </h3>
        <div className="flex items-center gap-4">
          {(() => {
            const males = adminMembers.filter(m => m.gender === 'male').length;
            const females = adminMembers.filter(m => m.gender === 'female').length;
            const total = males + females || 1;
            return (
              <>
                <div className="flex-1">
                  <div className="flex h-8 rounded-lg overflow-hidden">
                    <div className="bg-blue-500 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${(males / total) * 100}%` }}>
                      {males > 0 && `${Math.round((males / total) * 100)}%`}
                    </div>
                    <div className="bg-rose-500 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${(females / total) * 100}%` }}>
                      {females > 0 && `${Math.round((females / total) * 100)}%`}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 text-xs font-cairo font-bold">
                  <span className="text-blue-600">♂ {males} ذكر</span>
                  <span className="text-rose-600">♀ {females} أنثى</span>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
