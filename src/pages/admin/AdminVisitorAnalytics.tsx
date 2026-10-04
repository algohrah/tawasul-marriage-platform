import { useCallback, useEffect, useState, useRef } from 'react';
import { Activity, Clock3, Globe, RefreshCw, UserPlus, Users, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import supabase from '../../lib/supabase';

type Row = {label:string;count:number;percentage:number};
type Stats = {visits:number;registrations:number;activeNow:number;conversionPercentage:number|null;averageDurationSeconds:number|null;durationSamples:number;countries:Row[];cities:Row[];devices:Row[];sources:Row[];scope:string;startDay:string;endDay:string;generatedAt:string;timeZone:string};
const n=(value:number)=>Number(value || 0).toLocaleString('ar-SA',{maximumFractionDigits:1});
function countryName(label:string){try{return /^[A-Z]{2}$/.test(label) ? new Intl.DisplayNames(['ar'],{type:'region'}).of(label) || label : label;}catch{return label;}}
function Breakdown({title,rows,visits,countries=false}:{title:string;rows:Row[];visits:number;countries?:boolean}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 min-w-0">
    <h2 className="font-cairo font-bold text-base text-navy-900 mb-1">{title}</h2>
    <p className="text-xs text-slate-500 font-tajawal mb-4">النسبة = العدد ÷ إجمالي الزيارات ({n(visits)}) × 100</p>
    <table className="w-full text-sm font-tajawal"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 text-right font-medium">الفئة</th><th className="py-2 text-center font-medium">العدد</th><th className="py-2 text-left font-medium">النسبة</th></tr></thead>
      <tbody>{rows.map(row=><tr key={row.label} className="border-b border-slate-100 last:border-0"><td className="py-2.5 pr-0 pl-2 break-words max-w-40">{countries ? countryName(row.label) : row.label}</td><td className="text-center whitespace-nowrap">{n(row.count)}</td><td className="text-left whitespace-nowrap">{n(row.percentage)}٪</td></tr>)}</tbody></table>
    {!rows.length && <p className="py-6 text-center text-sm text-slate-400">لا توجد بيانات في هذه الفترة.</p>}
  </section>;
}
export default function AdminVisitorAnalytics() {
  const [days,setDays]=useState<1|7|30>(1);
  const [stats,setStats]=useState<Stats|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const requestNumber=useRef(0);
  const load=useCallback(async()=>{
    const request=++requestNumber.current;
    setError('');setLoading(true);
    try {
      const {data}=await supabase.auth.getSession();
      const token=data?.session?.access_token;
      if(!token)throw new Error('يلزم تسجيل دخول مدير فعلي لعرض الإحصائيات.');
      const response=await fetch(`/api/visitor-analytics?days=${days}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error || 'تعذر تحميل الإحصائيات');
      if(request===requestNumber.current)setStats(result);
    }catch(err){if(request===requestNumber.current)setError(err instanceof Error ? err.message : 'تعذر تحميل الإحصائيات');}
    finally{if(request===requestNumber.current)setLoading(false);}
  },[days]);
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),30000);return()=>{++requestNumber.current;clearInterval(timer);};},[load]);
  const cards=stats ? [
    {label:'إجمالي الزيارات',value:n(stats.visits),icon:Users,note:'دخول أو إعادة تحميل تبويب الموقع؛ لا تُحسب الانتقالات الداخلية كزيارة جديدة'},
    {label:'المتواجدون الآن',value:n(stats.activeNow),icon:Activity,note:'جلسات تبويب ذات نشاط خلال آخر 5 دقائق، وليست أشخاصًا فريدين'},
    {label:'التسجيلات الناجحة',value:n(stats.registrations),icon:UserPlus,note:'بعد نجاح إنشاء الحساب فعليًا، وليس الضغط على زر التسجيل'},
    {label:'نسبة التسجيل',value:stats.conversionPercentage===null ? '—' : `${n(stats.conversionPercentage)}٪`,icon:ShieldCheck,note:`التسجيلات (${n(stats.registrations)}) ÷ الزيارات (${n(stats.visits)}) × 100؛ نسبة مجمعة لا تتبع فردي`},
    {label:'متوسط المدة المرصودة',value:stats.averageDurationSeconds===null ? '—' : `${n(stats.averageDurationSeconds)} ثانية`,icon:Clock3,note:`مجموع وقت التبويب المرئي ÷ عينات المدة المستلمة (${n(stats.durationSamples)})؛ لا يشمل كل الزيارات`},
  ] : [];
  return <div className="space-y-5 min-w-0 font-cairo" dir="rtl" data-testid="visitor-analytics-page">
    <PageHeader icon={Globe} title="إحصائيات الزوار" subtitle="إحصائيات مجمعة فقط — توقيت السعودية واليمن UTC+3 — الاحتفاظ بآخر 30 يومًا" />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex rounded-xl bg-white border border-slate-200 p-1 gap-1" aria-label="فترة الإحصائيات">{([{value:1,label:'اليوم'},{value:7,label:'آخر 7 أيام'},{value:30,label:'آخر 30 يومًا'}] as const).map(item=><button key={item.value} onClick={()=>setDays(item.value)} aria-pressed={days===item.value} className={`min-h-11 px-3 sm:px-5 rounded-lg text-xs sm:text-sm font-bold ${days===item.value ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{item.label}</button>)}</div>
      <button onClick={()=>void load()} disabled={loading} className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 min-h-11 text-sm text-slate-700"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />تحديث</button>
    </div>
    {error && <div role="alert" className="border border-rose-200 bg-rose-50 rounded-xl p-4 text-sm text-rose-700">{error}</div>}
    {loading && !stats && <p role="status" className="p-8 text-center text-slate-500">جاري تحميل إحصائيات الزوار…</p>}
    {stats && <>
      {stats.scope!=='production' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">بيانات اختبار Deploy Preview فقط ({stats.scope}) — لا تختلط ببيانات Production.</div>}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-5 gap-3">{cards.map(card=><section key={card.label} className="bg-white border border-slate-200 rounded-2xl p-4 min-w-0"><div className="flex items-center gap-2 text-slate-500 text-xs"><card.icon className="w-4 h-4 shrink-0" />{card.label}</div><p className="my-3 text-2xl sm:text-3xl font-extrabold text-navy-900">{card.value}</p><p className="text-[11px] leading-relaxed text-slate-500 font-tajawal">{card.note}</p></section>)}</div>
      <p className="text-xs text-slate-500 font-tajawal">الفترة: {stats.startDay} إلى {stats.endDay} — المتواجدون الآن لا يتغير تعريفهم عند تغيير الفترة.</p>
      <div className="grid lg:grid-cols-2 gap-4"><Breakdown title="الدول" rows={stats.countries} visits={stats.visits} countries /><Breakdown title="المدن" rows={stats.cities} visits={stats.visits} /><Breakdown title="نوع الجهاز" rows={stats.devices} visits={stats.visits} /><Breakdown title="مصدر الزيارة" rows={stats.sources} visits={stats.visits} /></div>
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed font-tajawal space-y-2">
        <p>لا تُخزن أسماء أو بريد أو IP أو بصمة جهاز أو User-Agent خام أو روابط إحالة كاملة. معرّف الحضور عشوائي ومؤقت، ولا يُربط بالحساب.</p>
        <p>الدولة والمدينة تقريبيتان من معلومات الاستضافة المتاحة فقط؛ عند غيابها تظهر «غير معروف». iPhone يجمع أجهزة iOS، بما فيها iPad؛ التصنيف ليس بصمة جهاز.</p>
        <p>مصادر التطبيقات قد تظهر Direct إذا لم تُرسل إحالة أو utm_source. لا يُعرض عدد فريدين لأن هذه النسخة لا تحتفظ بمعرّف متصفح دائم.</p>
        <p>لا توجد بيانات زيارات تاريخية قبل تشغيل هذه الميزة. التنظيف يعمل عند وصول أحداث الزوار وقراءة اللوحة؛ الحذف الدوري أثناء انقطاع الزيارات يحتاج موافقة منفصلة.</p>
      </div>
    </>}
  </div>;
}
