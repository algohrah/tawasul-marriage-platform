import { motion } from 'framer-motion';
import { Target, Eye, Heart, ShieldCheck, Users, Award, Sparkles, MessageCircle, Twitter, Instagram, Facebook } from 'lucide-react';
import SectionHeading from '../components/layout/SectionHeading';
import { STATS, TEAM } from '../lib/data';
import { getAvatar } from '../lib/types';
import { useApp } from '../lib/AppContext';

export default function About() {
  const { socialSettings } = useApp();
  const values = [
    { icon: ShieldCheck, title: 'الأمان', desc: 'نحمي أعضاءنا بأعلى معايير التحقق والخصوصية.' },
    { icon: Heart, title: 'الجدية', desc: 'منصة مخصصة للزواج الشرعي والعلاقات الجادة فقط.' },
    { icon: Users, title: 'المجتمع', desc: 'نبني مجتمعًا محترمًا من أعضاء يشاركون القيم نفسها.' },
    { icon: Award, title: 'الجودة', desc: 'نلتزم بتجربة استخدام راقية وخدمة استثنائية.' },
  ];

  return (
    <div className="bg-cream-50">
      {/* Hero */}
      <section className="relative bg-navy-gradient overflow-hidden">
        <div className="absolute inset-0 pattern-arabesque opacity-30" />
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-gold-500/20 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold-500/15 border border-gold-500/30 text-gold-300 text-sm font-cairo font-semibold mb-5">
              <Sparkles className="w-4 h-4" /> قصتنا
            </span>
            <h1 className="font-cairo font-extrabold text-3xl sm:text-5xl text-white leading-tight">من نحن</h1>
            <p className="mt-5 text-base sm:text-lg text-cream-200/80 font-tajawal leading-relaxed max-w-2xl mx-auto">
              توافق هي منصة زواج عربية عصرية وُلدت من إيمان عميق بأن لكل شخص شريكًا ينتظره. نحن نربط القلوب بثقة وخصوصية تامة.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white rounded-3xl p-4 sm:p-6 text-center shadow-soft border border-cream-200/60">
              <div className="font-cairo font-extrabold text-2xl sm:text-3xl text-gradient-gold">{s.value}</div>
              <div className="text-sm text-navy-600 font-tajawal mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white rounded-3xl p-6 sm:p-8 shadow-soft border border-cream-200/60">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gold-300/15 flex items-center justify-center mb-4">
              <Target className="w-6 h-6 sm:w-7 sm:h-7 text-gold-600" />
            </div>
            <h2 className="font-cairo font-extrabold text-xl sm:text-2xl text-navy-900 mb-3">رسالتنا</h2>
            <p className="text-navy-600 font-tajawal leading-relaxed text-sm sm:text-base">
              تسهيل رحلة البحث عن شريك الحياة في بيئة آمنة وموثوقة تحترم القيم العربية والإسلامية، باستخدام أحدث الفلاتر المتقدمة والربط المباشر الميسر وبإشراف بشري كامل.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white rounded-3xl p-6 sm:p-8 shadow-soft border border-cream-200/60">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gold-300/15 flex items-center justify-center mb-4">
              <Eye className="w-6 h-6 sm:w-7 sm:h-7 text-gold-600" />
            </div>
            <h2 className="font-cairo font-extrabold text-xl sm:text-2xl text-navy-900 mb-3">رؤيتنا</h2>
            <p className="text-navy-600 font-tajawal leading-relaxed text-sm sm:text-base">
              أن نكون المنصة العربية الأولى للزواج الموثوق، ومرجعًا موثوقًا في بناء العلاقات الجادة التي تنتهي بزواج سعيد وناجح.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-12 sm:py-16 bg-cream-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading eyebrow="قيمنا" title={<>مبادئ <span className="text-gradient-gold">نلتزم بها</span></>} />
          <div className="mt-8 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {values.map((v, i) => (
              <motion.div key={v.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="bg-white rounded-3xl p-5 sm:p-6 text-center shadow-soft border border-cream-200/60">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gold-300/15 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="w-6 h-6 sm:w-7 sm:h-7 text-gold-600" />
                </div>
                <h3 className="font-cairo font-bold text-navy-900 text-base sm:text-lg mb-2">{v.title}</h3>
                <p className="text-sm text-navy-600 font-tajawal">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-12 sm:py-16 bg-white border-t border-cream-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading eyebrow="فريقنا" title={<>الناس <span className="text-gradient-gold">خلف توافق</span></>} subtitle="فريق من الخبراء المتفانين في خدمتك." />
          <div className="mt-8 sm:mt-12 grid sm:grid-cols-3 gap-4 sm:gap-6">
            {TEAM.map((member, i) => (
              <motion.div key={member.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="bg-white rounded-3xl overflow-hidden shadow-soft border border-cream-200/60 text-center">
                <img src={getAvatar(member.gender)} alt={member.name} className="w-full aspect-square object-contain bg-cream-100 p-6 sm:p-8" />
                <div className="p-4 sm:p-5">
                  <h3 className="font-cairo font-bold text-navy-900 text-base sm:text-lg">{member.name}</h3>
                  <p className="text-sm text-gold-700 font-tajawal mt-1">{member.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Customizable Social & Whatsapp Support Button section */}
      {(socialSettings.showWhatsapp || socialSettings.showTwitter || socialSettings.showInstagram || socialSettings.showFacebook) && (
        <section className="py-12 sm:py-16 bg-amber-50/40 border-t border-b border-amber-200/40 text-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="font-cairo font-extrabold text-xl sm:text-2xl text-navy-900 mb-2">الدعم الفني وخدمة العملاء</h2>
            <p className="text-sm text-navy-600 font-tajawal mb-6 sm:mb-8 leading-relaxed">
              يسعد فريقنا المؤهل الرد على استفساراتكم بخصوص باقات الاشتراكات والمطابقة والمساعدة الفنية على مدار الساعة.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {socialSettings.showWhatsapp && socialSettings.whatsappNumber && (
                <a
                  href={`{{https://wa.me/${socialSettings.whatsappNumber}}}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto justify-center inline-flex items-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-cairo font-extrabold text-sm sm:text-base shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  <MessageCircle className="w-5 h-5 fill-current" />
                  <span className="hidden sm:inline">تواصل مباشر مع الدعم المالي والتقني عبر WhatsApp</span>
                  <span className="sm:hidden">تواصل عبر WhatsApp</span>
                </a>
              )}

              <div className="flex items-center gap-3">
                {socialSettings.showTwitter && socialSettings.twitter && (
                  <a
                    href={socialSettings.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-colors"
                    title="تويتر"
                  >
                    <Twitter className="w-5 h-5 fill-current" />
                  </a>
                )}
                {socialSettings.showInstagram && socialSettings.instagram && (
                  <a
                    href={socialSettings.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 hover:opacity-95 text-white flex items-center justify-center transition-colors"
                    title="إنستغرام"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {socialSettings.showFacebook && socialSettings.facebook && (
                  <a
                    href={socialSettings.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
                    title="فيسبوك"
                  >
                    <Facebook className="w-5 h-5 fill-current" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
