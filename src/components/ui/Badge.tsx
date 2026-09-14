import type { ReactNode } from 'react';
import { ShieldCheck, Crown, Circle } from 'lucide-react';

export function VerifiedBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs';
  return (
    <span className={`inline-flex items-center gap-1 ${text} font-bold text-sky-700 bg-sky-soft px-2.5 py-1 rounded-full ring-1 ring-sky-200/70`}>
      <ShieldCheck className={s} /> موثّق
    </span>
  );
}

export function PremiumBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <span className={`inline-flex items-center gap-1 ${text} font-bold text-gold-800 bg-gold-100 px-2.5 py-1 rounded-full ring-1 ring-gold-300/50`}>
      <Crown className={s} /> ذهبي
    </span>
  );
}

export function OnlineBadge() {
  return null;
}

export function Chip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-cairo font-semibold transition-all duration-200 no-tap-highlight ${
        active
          ? 'bg-gold-gradient text-navy-950 shadow-gold'
          : 'bg-white/80 text-navy-700 ring-1 ring-cream-200 hover:bg-cream-100'
      }`}
    >
      {children}
    </button>
  );
}

export function MatchScore({ score }: { score: number }) {
  return null;
}
