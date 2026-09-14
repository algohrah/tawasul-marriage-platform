import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

type Variant = 'gold' | 'navy' | 'outline' | 'ghost' | 'rose';
type Size = 'sm' | 'md' | 'lg';

interface BaseProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  disabled?: boolean;
  id?: string;
}

const base = 'inline-flex items-center justify-center gap-2 font-cairo font-extrabold no-tap-highlight transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-300/35 active:scale-[0.985]';

const variants: Record<Variant, string> = {
  gold: 'bg-gold-gradient text-navy-950 shadow-gold hover:-translate-y-0.5 hover:brightness-105',
  navy: 'bg-navy-gradient text-white shadow-soft hover:-translate-y-0.5 hover:shadow-luxe',
  outline: 'border border-gold-400/70 bg-white/75 text-navy-900 shadow-soft hover:-translate-y-0.5 hover:bg-gold-50 hover:border-gold-500',
  ghost: 'text-navy-700 hover:bg-cream-100/80 dark:text-cream-100 dark:hover:bg-white/8',
  rose: 'bg-rose-deep text-white shadow-soft hover:-translate-y-0.5 hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm rounded-xl',
  md: 'px-6 py-3 text-sm rounded-2xl',
  lg: 'px-8 py-4 text-base rounded-[1.15rem]',
};

function classNames({ variant, size, fullWidth, disabled, className }: Required<Pick<BaseProps, 'variant' | 'size'>> & Pick<BaseProps, 'fullWidth' | 'disabled' | 'className'>) {
  return `${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${disabled ? 'opacity-55 cursor-not-allowed pointer-events-none grayscale-[.15]' : ''} ${className || ''}`;
}

export function Button({
  children, variant = 'gold', size = 'md', className = '', fullWidth, type = 'button', onClick, disabled, id,
}: BaseProps) {
  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames({ variant, size, fullWidth, disabled, className })}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children, to, variant = 'gold', size = 'md', className = '', fullWidth, onClick, id,
}: BaseProps & { to: string; onClick?: () => void }) {
  return (
    <Link
      id={id}
      to={to}
      onClick={onClick}
      className={classNames({ variant, size, fullWidth, disabled: false, className })}
    >
      {children}
    </Link>
  );
}
