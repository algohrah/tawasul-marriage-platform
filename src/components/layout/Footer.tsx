import { Link } from 'react-router-dom';
import { ShieldCheck, MessageCircle, Twitter, Instagram, Facebook } from 'lucide-react';
import Logo from '../ui/Logo';
import { useApp } from '../../lib/AppContext';

export default function Footer() {
  const { socialSettings } = useApp();

  const allLinks = [
    { to: '/about', label: 'من نحن' },
    { to: '/plans', label: 'الباقات' },
    { to: '/contact', label: 'اتصل بنا' },
    { to: '/legal/privacy', label: 'سياسة الخصوصية' },
    { to: '/legal/terms', label: 'الشروط والأحكام' },
  ];

  return (
    /*
      pb-20 lg:pb-0 :
        على الجوال نُضيف 80px تحت الـ Footer ليكون المحتوى فوق MobileNav
        على الشاشات الكبيرة (lg+) لا حاجة للـ padding لأن MobileNav مخفي
    */
    <footer className="bg-navy-gradient text-white mt-6 sm:mt-8 pb-20 lg:pb-0 relative overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 pattern-arabesque opacity-10" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">

          {/* الشعار وحقوق النشر */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-right">
            <Logo variant="light" size="sm" />
            <span className="hidden sm:inline text-white/20">|</span>
            <p className="text-cream-200/50 font-tajawal text-xs">
              © 2025 توافق. جميع الحقوق محفوظة.
            </p>
          </div>

          {/* الروابط */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-center">
            {allLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-cream-200/70 hover:text-gold-300 font-tajawal text-[11px] sm:text-xs transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* السوشيال ميديا وشارة الأمان */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {socialSettings.showWhatsapp && socialSettings.whatsappNumber && (
                <a
                  href={`https://wa.me/${socialSettings.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-all hover:scale-105"
                  title="واتساب"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                </a>
              )}
              {socialSettings.showTwitter && socialSettings.twitter && (
                <a
                  href={socialSettings.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white transition-all hover:scale-105"
                  title="تويتر"
                >
                  <Twitter className="w-4 h-4 fill-current" />
                </a>
              )}
              {socialSettings.showInstagram && socialSettings.instagram && (
                <a
                  href={socialSettings.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 flex items-center justify-center text-white transition-all hover:scale-105"
                  title="إنستغرام"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {socialSettings.showFacebook && socialSettings.facebook && (
                <a
                  href={socialSettings.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white transition-all hover:scale-105"
                  title="فيسبوك"
                >
                  <Facebook className="w-4 h-4 fill-current" />
                </a>
              )}
            </div>

            <span className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              <ShieldCheck className="w-3.5 h-3.5" /> آمن
            </span>
          </div>

        </div>
      </div>
    </footer>
  );
}
