import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Crown, Sparkles, ShieldCheck, Star, Zap } from 'lucide-react';
import { useApp } from '../lib/AppContext';

const colorMap = {
  gold: { ring: 'ring-gold-500', bg: 'bg-gold-gradient', text: 'text-gold-700', icon: Crown },
  navy: { ring: 'ring-navy-700', bg: 'bg-navy-900', text: 'text-navy-700', icon: ShieldCheck },
  rose: { ring: 'ring-rose-deep', bg: 'bg-rose-deep', text: 'text-rose-deep', icon: Sparkles },
};

export default function Plans() {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const { plans } = useApp();

  return (
    <div className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-navy-gradient relative overflow-hidden">
        <div className="absolute inset-0 pattern-arabesque opacity-30" />
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-gold-500/20 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gold-300/15 mb-4">
              <Crown className="w-6 h-6 sm:w-7 sm:h-7 text-gold-300" />
            </div>
            <h1 className="font-cairo font-extrabold text-2xl sm:text-3xl md:text-4xl text-white">اختر باقتك</h1>
            <p className="mt-3 text-cream-200/80 font-tajawal max-w-xl mx-auto text-sm sm:text-base">استثمر في رحلتك نحو شريك الحياة. باقات مرنة تناسب احتياجاتك.</p>
          </motion.div>

          {/* Period toggle */}
          <div className="mt-6 sm:mt-8 inline-flex items-center bg-white/10 rounded-full p-1 border border-white/15">
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-cairo font-semibold text-xs sm:text-sm transition-all ${period === 'monthly' ? 'bg-gold-gradient text-navy-900' : 'text-cream-200/80'}`}
            >شهري</button>
            <button
              onClick={() => setPeriod('yearly')}
              className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-cairo font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 sm:gap-2 ${period === 'yearly' ? 'bg-gold-gradient text-navy-900' : 'text-cream-200/80'}`}
            >سنوي <span className="text-[9px] sm:text-[10px] bg-emerald-400/20 text-emerald-300 px-1.5 py-0.5 rounded-full">وفّر 20%</span></button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid md:grid-cols-2 gap-5 sm:gap-6 max-w-4xl mx-auto">
          {plans.filter(plan => !plan.hidden).map((plan, i) => {
            const c = colorMap[plan.color];
            const price = period === 'yearly' ? Math.round(plan.price * 12 * 0.8) : plan.price;
            const periodLabel = period === 'yearly' && plan.price > 0 ? 'سنويًا' : plan.period;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative bg-white rounded-3xl p-5 sm:p-8 ${plan.popular ? 'ring-2 ring-gold-500 shadow-luxe lg:-mt-4 lg:mb-4' : 'shadow-soft border border-cream-200/60'}`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 right-1/2 translate-x-1/2 bg-gold-gradient text-navy-900 text-[11px] sm:text-xs font-cairo font-bold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-gold whitespace-nowrap">
                    الأكثر شعبية ⭐
                  </span>
                )}
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${c.bg} flex items-center justify-center mb-4 ${plan.popular ? 'bg-gold-gradient' : ''}`}>
                  <c.icon className={`w-6 h-6 sm:w-7 sm:h-7 ${plan.popular ? 'text-navy-900' : 'text-white'}`} />
                </div>
                <h3 className="font-cairo font-extrabold text-lg sm:text-xl text-navy-900">{plan.name}</h3>
                <p className="text-sm text-navy-500 font-tajawal mt-1 mb-5">{plan.description}</p>

                <div className="flex items-end gap-1 mb-1">
                  <span className="font-cairo font-extrabold text-3xl sm:text-4xl text-navy-900">{price === 0 ? 'مجانًا' : price}</span>
                  {price > 0 && <span className="text-navy-500 font-tajawal mb-1 text-sm sm:text-base">ر.س / {periodLabel}</span>}
                </div>

                <Link
                  to={price === 0 ? '/register' : `/checkout/${plan.id}`}
                  className={`w-full mt-5 py-3 sm:py-3.5 rounded-2xl font-cairo font-bold transition-all inline-block text-center ${
                    plan.popular ? 'bg-gold-gradient text-navy-900 shadow-gold hover:-translate-y-0.5' : 'bg-navy-900 text-white hover:bg-navy-800'
                  }`}
                >
                  {price === 0 ? 'ابدأ مجانًا' : 'اشترك الآن'}
                </Link>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((f, fIdx) => (
                    <li key={`${plan.id}-feat-${fIdx}`} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full ${c.bg} flex items-center justify-center flex-shrink-0 mt-0.5 ${plan.popular ? 'bg-gold-gradient' : ''}`}>
                        <Check className={`w-3 h-3 ${plan.popular ? 'text-navy-900' : 'text-white'}`} />
                      </div>
                      <span className="text-sm text-navy-700 font-tajawal">{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Trust */}
        <div className="mt-8 sm:mt-12 bg-white rounded-3xl shadow-soft border border-cream-200/60 p-5 sm:p-8">
          <div className="grid sm:grid-cols-3 gap-5 sm:gap-6 text-center">
            {[
              { icon: ShieldCheck, title: 'دفع آمن', desc: 'تشفير SSL وحماية كاملة' },
              { icon: Zap, title: 'تفعيل فوري', desc: 'استمتع بالمزايا مباشرة' },
              { icon: Star, title: 'إلفاء مرن', desc: 'ألِِــت من أي وقت دون رسوم' },
            ].map((t, tIdx) => (
              <div key={`trust-item-${t.title}-${tIdx}`}>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gold-300/15 flex items-center justify-center mx-auto mb-3">
                  <t.icon className="w-5 h-5 sm:w-6 sm:h-6 text-gold-600" />
                </div>
                <h4 className="font-cairo font-bold text-navy-900">{t.title}</h4>
                <p className="text-sm text-navy-500 font-tajawal mt-1">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
