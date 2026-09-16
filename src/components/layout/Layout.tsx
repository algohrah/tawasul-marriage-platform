import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Header from '../ui/Header';
import Footer from './Footer';
import MobileNav from './MobileNav';
import ToastContainer from '../ui/Toast';
import ImpersonationBar from '../ImpersonationBar';
import { useApp } from '../../lib/AppContext';
import { motion } from 'framer-motion';

export default function Layout() {
  const { pathname } = useLocation();
  const { socialSettings } = useApp();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const hideFooter = pathname === '/search' ||
                     pathname.startsWith('/checkout') ||
                     pathname === '/requests' ||
                     pathname === '/admin-chat' ||
                     pathname === '/notifications' ||
                     pathname.startsWith('/profile');

  // Clean the phone number from non-numeric characters for the direct WhatsApp link
  const cleanNumber = socialSettings?.whatsappNumber 
    ? socialSettings.whatsappNumber.replace(/[+\s-]/g, '') 
    : '';

  return (
    <div className="min-h-screen flex flex-col bg-cream-50 text-navy-950 dark:bg-navy-950 dark:text-cream-50 transition-colors duration-300">
      <ImpersonationBar />
      <Header />
      <main className="flex-1 relative">
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(circle_at_top_right,rgba(239,194,91,0.12),transparent_38rem)]" />
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
      <MobileNav />
      <ToastContainer />

      {/* Floating WhatsApp Support Button */}
      {socialSettings?.showWhatsapp && cleanNumber && (
        <motion.a
          href={`{{https://wa.me/${cleanNumber}}}`}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="fixed right-6 bottom-24 lg:bottom-8 z-50 flex items-center justify-center gap-2 h-14 min-w-[3.5rem] px-3.5 bg-[#25D366] text-white rounded-full shadow-luxe hover:bg-[#20ba5a] transition-all duration-300 group cursor-pointer border border-white/20"
          title="تواصل معنا عبر واتساب"
        >
          {/* Ping Pulse Effect */}
          <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-30 animate-ping group-hover:animate-none" />
          
          {/* Official WhatsApp Icon from Simple Icons */}
          <svg className="w-6 h-6 relative z-10 fill-current drop-shadow-md flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.458h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>

          {/* Premium Slide-out Text */}
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out font-cairo font-bold text-sm whitespace-nowrap hidden sm:inline-block relative z-10 leading-none">
            تواصل معنا
          </span>
        </motion.a>
      )}
    </div>
  );
}
