import { useCallback, useEffect, useState, useRef } from 'react';
import { Activity, Clock3, Globe, RefreshCw, UserPlus, Users, ShieldCheck, Trash2, AlertTriangle } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import supabase from '../../lib/supabase';

type DeletePeriod = 1|7|30|'all';
const deleteOptions=[{value:1,label:'حذف إحصائيات اليوم'},{value:7,label:'حذف آخر 7 أيام'},{value:30,label:'حذف آخر 30 يومًا'},{value:'all',label:'حذف جميع إحصائيات الزوار'}] as const;
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
  const [deletePeriod,setDeletePeriod]=useState<DeletePeriod>(1);
  const [confirmOpen,setConfirmOpen]=useState(false);
  const [confirmation,setConfirmation]=useState('');
  const [deleting,setDeleting]=useState(false);
  const [deleteError,setDeleteError]=useState('');
  const [success,setSuccess]=useState('');
  const deletingRef=useRef(false);
  const dialogRef=useRef<HTMLDivElement>(null);
  const requestNumber=useRef(0);
  const deleteLabel=deleteOptions.find(option=>option.value===deletePeriod)!.label;
  const load=useCallback(async(force=false)=>{
    if(deletingRef.current && !force)return;
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
  useEffect(()=>{
    if(!confirmOpen)return;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-cancel-delete]')?.focus();
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape' && !deletingRef.current){event.preventDefault();setConfirmOpen(false);}
      if(event.key!=='Tab')return;
      const controls=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') || []);
      if(!controls.length){event.preventDefault();return;}
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keydown);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
  },[confirmOpen]);
  const deleteStats=async()=>{
    if(deletingRef.current || (deletePeriod==='all' && confirmation.trim()!=='حذف الكل'))return;
    deletingRef.current=true;setDeleting(true);setDeleteError('');setSuccess('');++requestNumber.current;
    try {
      const {data}=await supabase.auth.getSession();const token=data?.session?.access_token;
      if(!token)throw new Error('يلزم تسجيل دخول مدير فعلي لحذف الإحصائيات.');
      const response=await fetch('/api/visitor-analytics',{method:'DELETE',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({period:deletePeriod,confirmation:deletePeriod==='all' ? confirmation.trim() : 'CONFIRM_VISITOR_ANALYTICS_DELETE'})});
      const result=await response.json();if(!response.ok)throw new Error(result.error || 'تعذر حذف الإحصائيات');
      setConfirmOpen(false);setConfirmation('');setSuccess(`تم ${deleteLabel} بنجاح في هذه البيئة فقط.`);
      await load(true);
    }catch(err){
      const message=err instanceof Error ? err.message : 'تعذر حذف الإحصائيات';
      await load(true);setDeleteError(message);setError(message);
    }finally{deletingRef.current=false;setDeleting(false);}
  };
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
      <div className="flex rounded-xl bg-white border border-slate-200 p-1 gap-1" aria-label="فترة الإحصائيات">{([{value:1,label:'اليوم'},{value:7,label:'آخر 7 أيام'},{value:30,label:'آخر 30 يومًا'}] as const).map(item=><button key={item.value} onClick={()=>setDays(item.value)} disabled={deleting} aria-pressed={days===item.value} className={`min-h-11 px-3 sm:px-5 rounded-lg text-xs sm:text-sm font-bold ${days===item.value ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{item.label}</button>)}</div>
      <button onClick={()=>void load()} disabled={loading || deleting} className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 min-h-11 text-sm text-slate-700"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />تحديث</button>
    </div>
    {success && <div role="status" data-testid="visitor-delete-success" className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 text-sm text-emerald-800">{success}</div>}
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
        <p>لا توجد بيانات زيارات تاريخية قبل تشغيل هذه الميزة. التنظيف التلقائي يعمل كل 5 دقائق حتى دون زيارات، وأيضًا عند وصول الأحداث وقراءة اللوحة. يُستبعد الحضور من العدّ بعد 5 دقائق من آخر نشاط.</p>
      </div>
    </>}
    <section className="rounded-2xl border border-rose-200 bg-white p-4 sm:p-5 space-y-3" data-testid="visitor-delete-controls">
      <h2 className="flex items-center gap-2 font-bold text-navy-900"><Trash2 className="h-5 w-5 text-rose-600" />حذف إحصائيات الزوار</h2>
      <p className="text-xs leading-relaxed text-slate-600 font-tajawal">الحذف نهائي ويقتصر على إحصائيات الزوار والحضور المؤقت في هذه البيئة فقط؛ لا يمس حسابات الأعضاء أو الطلبات أو الرحلات أو المدفوعات. على Deploy Preview لا تُحذف بيانات Production.</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="flex-1 min-w-0 text-xs text-slate-600" htmlFor="visitor-delete-period">نطاق الحذف
          <select id="visitor-delete-period" value={deletePeriod} disabled={deleting} onChange={event=>setDeletePeriod(event.target.value==='all' ? 'all' : Number(event.target.value) as DeletePeriod)} className="mt-1 block w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-900">{deleteOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </label>
        <button onClick={()=>{setConfirmation('');setDeleteError('');setSuccess('');setError('');setConfirmOpen(true);}} disabled={loading || deleting || !stats} className="self-stretch sm:self-end min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white disabled:opacity-50">{deleteLabel}</button>
      </div>
      <p className="text-[11px] text-slate-500 font-tajawal">الفترات حسب تقويم السعودية/اليمن UTC+3. يشمل الحذف الحضور الذي يقع آخر نشاط له داخل الفترة المحددة. النشاط والزيارات الجديدة قد تظهر مجددًا بعد الحذف.</p>
    </section>
    {confirmOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="visitor-delete-title" aria-describedby="visitor-delete-description" aria-busy={deleting} className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-2xl space-y-4">
        <h2 id="visitor-delete-title" className="flex gap-2 items-center text-lg font-bold text-rose-700"><AlertTriangle className="w-6 h-6 shrink-0" />{deletePeriod==='all' ? 'تأكيد حذف جميع إحصائيات الزوار' : 'تأكيد حذف إحصائيات الزوار'}</h2>
        <p id="visitor-delete-description" className="text-sm leading-relaxed text-slate-600">هل تريد {deleteLabel}؟ سيُحذف التجميع اليومي والحضور المطابق للفترة في هذه البيئة ({stats?.scope}) فقط. لا يمكن التراجع، ولن تُحذف أي بيانات أعضاء أو طلبات أو رحلات أو دفع.</p>
        {deletePeriod==='all' && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2"><p className="text-sm font-bold text-rose-800">سيُحذف كل سجل إحصائيات الزوار في هذه البيئة، وليس الفترة المعروضة فقط.</p><label htmlFor="visitor-delete-confirmation" className="block text-sm text-rose-800">اكتب «حذف الكل» لتأكيد الحذف النهائي</label><input id="visitor-delete-confirmation" value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={deleting} autoComplete="off" className="min-h-11 w-full rounded-lg border border-rose-300 bg-white px-3 text-sm" /></div>}
        {deleteError && <p role="alert" className="text-sm text-rose-700">{deleteError}</p>}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2"><button data-cancel-delete onClick={()=>setConfirmOpen(false)} disabled={deleting} className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700">إلغاء</button><button onClick={()=>void deleteStats()} disabled={deleting || (deletePeriod==='all' && confirmation.trim()!=='حذف الكل')} className="min-h-11 flex-1 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white disabled:opacity-50">{deleting ? 'جاري الحذف…' : deletePeriod==='all' ? 'تأكيد حذف جميع الإحصائيات' : 'تأكيد الحذف'}</button></div>
      </div>
    </div>}
  </div>;
}
