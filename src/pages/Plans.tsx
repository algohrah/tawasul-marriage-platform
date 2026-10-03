import { Link } from 'react-router-dom';
import { Check, ShieldCheck, Star, MessageSquare, ArrowLeft } from 'lucide-react';
import { PLANS } from '../lib/data';

export default function Plans() {
  return <div className="min-h-screen bg-cream-50" dir="rtl">
    <header className="bg-navy-gradient px-4 py-12 text-center text-white">
      <span className="inline-flex rounded-full bg-white/10 px-4 py-1.5 text-sm font-cairo">عضوية تناسب استخدامك</span>
      <h1 className="mt-4 text-3xl sm:text-4xl font-cairo font-extrabold">مجاني أو توافق مميز</h1>
      <p className="mt-3 text-cream-200 font-tajawal">خياران واضحان، والرسائل ورسوم رحلة التوافق مستقلة عن العضوية.</p>
    </header>
    <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="grid gap-6 md:grid-cols-2">
        {PLANS.map(plan => <section key={plan.id} className={`relative rounded-3xl bg-white p-6 sm:p-8 border shadow-soft ${plan.id === 'featured' ? 'border-gold-400 ring-1 ring-gold-300' : 'border-cream-200'}`}>
          {plan.id === 'featured' ? <Star className="h-9 w-9 text-amber-600" /> : <ShieldCheck className="h-9 w-9 text-navy-700" />}
          <h2 className="mt-4 font-cairo font-extrabold text-2xl text-navy-900">{plan.name}</h2>
          <p className="mt-2 text-sm text-navy-600 font-tajawal min-h-10">{plan.description}</p>
          <div className="mt-6 font-cairo text-navy-900"><strong className="text-4xl">{plan.price || 'مجانًا'}</strong>{plan.price > 0 && <span className="mr-2 text-sm">ريال / 30 يومًا</span>}</div>
          {plan.price > 0 && <p className="mt-1 text-xs text-navy-500">السعر النهائي للعضوية: 99 ريال</p>}
          <Link to={plan.price ? '/checkout/featured' : '/register'} className={`mt-6 block rounded-2xl py-3.5 text-center font-cairo font-bold ${plan.price ? 'bg-gold-gradient text-navy-900' : 'bg-navy-900 text-white'}`}>{plan.price ? 'اشترك في توافق مميز' : 'ابدأ مجانًا'}</Link>
          <ul className="mt-6 space-y-3">{plan.features.map(feature => <li key={feature} className="flex gap-2.5 text-sm font-tajawal text-navy-700"><Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600"/>{feature}</li>)}</ul>
        </section>)}
      </div>
      <section className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <h2 className="flex items-center gap-2 font-cairo font-bold text-navy-900"><MessageSquare className="h-5 w-5"/> الرسائل ليست ضمن العضوية</h2>
        <p className="mt-2 text-sm font-tajawal text-navy-700">رسائل الاستفسار تُشترى من داخل غرفة التوافق. اشتراك توافق مميز لا يمنح رسائل مجانية ولا يغيّر رصيدك الحالي.</p>
      </section>
      <p className="mt-5 text-sm font-tajawal text-navy-600">رسوم رحلة التوافق منفصلة تمامًا؛ العضوية لا تعفي منها ولا تخصم منها.</p>
      <Link to="/search" className="mt-5 inline-flex gap-2 items-center text-sm font-cairo font-bold text-gold-700">تصفّح الأعضاء <ArrowLeft className="h-4 w-4"/></Link>
    </main>
  </div>;
}
