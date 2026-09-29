import type { ReactNode } from 'react';

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  center?: boolean;
  light?: boolean;
}

export default function SectionHeading({
  eyebrow, title, subtitle, center = true, light = false,
}: SectionHeadingProps) {
  return (
    <div className={`${center ? 'text-center mx-auto' : 'text-right'} max-w-2xl ${center ? 'mx-auto' : ''}`}>
      {eyebrow && (
        <span className={`inline-block text-xs sm:text-sm font-cairo font-bold tracking-wider mb-2 sm:mb-3 ${light ? 'text-gold-300' : 'text-gold-600'}`}>
          {eyebrow}
        </span>
      )}
      <h2 className={`font-cairo font-extrabold text-xl sm:text-3xl lg:text-4xl leading-tight ${light ? 'text-white' : 'text-navy-900'}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-3 sm:mt-4 font-tajawal text-sm sm:text-lg leading-relaxed ${light ? 'text-cream-200/80' : 'text-navy-600'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
