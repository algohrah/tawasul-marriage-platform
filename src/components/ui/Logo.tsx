import { Link } from 'react-router-dom';

interface LogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ variant = 'dark', size = 'md' }: LogoProps) {
  const textColor = variant === 'light' ? 'text-white' : 'text-navy-950 dark:text-white';
  const subColor = variant === 'light' ? 'text-gold-200' : 'text-gold-700 dark:text-gold-300';
  const sizes = {
    sm: { mark: 'w-9 h-9', text: 'text-lg', sub: 'text-[9px]' },
    md: { mark: 'w-11 h-11', text: 'text-xl', sub: 'text-[10px]' },
    lg: { mark: 'w-15 h-15', text: 'text-3xl', sub: 'text-xs' },
  };
  const s = sizes[size];

  return (
    <Link to="/" className="group flex items-center gap-2.5 no-tap-highlight" aria-label="توافق - الرئيسية">
      <div className={`${s.mark} relative flex-shrink-0 rounded-2xl bg-navy-gradient p-1 shadow-gold ring-1 ring-gold-300/35 transition-transform duration-300 group-hover:-translate-y-0.5`}>
        <svg viewBox="0 0 64 64" className="h-full w-full drop-shadow-sm" aria-hidden="true">
          <defs>
            <linearGradient id="tawafokLogoGrad" x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff4c7" />
              <stop offset="0.48" stopColor="#efc25b" />
              <stop offset="1" stopColor="#bf7e22" />
            </linearGradient>
          </defs>
          <path d="M32 49c-2.7-2.2-5.2-4.3-7.6-6.4C17.6 36.6 13 31.7 13 25.7 13 20.4 17.1 16 22.2 16c3.4 0 6.4 1.7 8.2 4.4.4.6 1.3.6 1.7 0 1.8-2.7 4.9-4.4 8.2-4.4C45.7 16 50 20.4 50 25.7c0 6-4.6 10.9-11.4 16.9-2.4 2.1-4.9 4.2-6.6 6.4Z" fill="url(#tawafokLogoGrad)" />
          <path d="M22 29h20" stroke="#081320" strokeWidth="4" strokeLinecap="round" opacity=".7" />
          <path d="M28 24c1.6 1.7 2.9 3.6 4 5.7 1.1-2.1 2.5-4 4-5.7" stroke="#081320" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-cairo font-black tracking-tight ${s.text} ${textColor}`}>توافق</span>
        <span className={`${s.sub} mt-1 font-tajawal font-bold tracking-[0.16em] ${subColor}`}>زواج موثوق</span>
      </div>
    </Link>
  );
}
