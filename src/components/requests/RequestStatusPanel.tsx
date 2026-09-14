import { AlertTriangle, CheckCircle2, Clock3, Info, UserCheck, Users } from 'lucide-react';
import type { JourneyStatusSummary } from '../../lib/journey';

const toneClasses = {
  urgent: {
    box: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: 'bg-amber-500 text-white',
    badge: 'bg-amber-500 text-white',
  },
  waiting: {
    box: 'bg-blue-50 border-blue-200 text-blue-900',
    icon: 'bg-blue-500 text-white',
    badge: 'bg-blue-500 text-white',
  },
  success: {
    box: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    icon: 'bg-emerald-500 text-white',
    badge: 'bg-emerald-500 text-white',
  },
  neutral: {
    box: 'bg-cream-50 border-cream-200 text-navy-800',
    icon: 'bg-navy-500 text-white',
    badge: 'bg-navy-500 text-white',
  },
  danger: {
    box: 'bg-rose-50 border-rose-200 text-rose-900',
    icon: 'bg-rose-500 text-white',
    badge: 'bg-rose-500 text-white',
  },
};

const actorIcon = {
  me: UserCheck,
  other: Clock3,
  both: Users,
  system: Info,
  none: CheckCircle2,
};

export default function RequestStatusPanel({ summary, compact = false }: { summary: JourneyStatusSummary; compact?: boolean }) {
  const classes = toneClasses[summary.tone];
  const Icon = summary.tone === 'danger' ? AlertTriangle : actorIcon[summary.actor];

  return (
    <div className={`rounded-2xl border ${classes.box} ${compact ? 'p-3' : 'p-4'} shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl ${classes.icon} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-cairo font-extrabold text-sm sm:text-base leading-tight">{summary.title}</h3>
            <span className={`text-[10px] font-cairo font-black px-2 py-0.5 rounded-full ${classes.badge}`}>
              {summary.actorLabel}
            </span>
          </div>
          <p className="font-cairo text-xs sm:text-sm leading-relaxed mt-1 opacity-85">{summary.description}</p>
          {summary.nextHint && !compact && (
            <p className="font-cairo text-[11px] leading-relaxed mt-2 opacity-70">التالي: {summary.nextHint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
