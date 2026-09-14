import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Filter } from 'lucide-react';

// ============================================================
//  فلتر منسدل موحّد — يستبدل صفوف أزرار الفلترة الكثيرة
//  يوفّر المساحة ويقلّل التشتّت البصري
// ============================================================

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  label?: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  className?: string;
}

export default function FilterDropdown({ label, value, options, onChange, icon, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = options.find((o) => o.value === value);
  const totalActive = value !== 'all' && value !== options[0]?.value;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-cairo font-bold transition-colors border shadow-2xs cursor-pointer
          ${totalActive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'}`}
      >
        {icon || <Filter className="w-3.5 h-3.5" />}
        <span className="text-[10px] opacity-70">{label}</span>
        <span>{current?.label || 'الكل'}</span>
        {current?.count !== undefined && current.count > 0 && (
          <span className={`px-1.5 rounded text-[10px] ${totalActive ? 'bg-amber-500 text-slate-900' : 'bg-slate-100 text-slate-500'}`}>
            {current.count}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 min-w-[190px] bg-white rounded-xl shadow-2xl border border-slate-200 py-1 max-h-72 overflow-y-auto right-0 font-cairo"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-xs font-cairo text-right transition-colors cursor-pointer
                    ${active ? 'bg-amber-50 text-amber-900 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <span className="flex items-center gap-2">
                    {active ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <span className="w-4 shrink-0" />}
                    <span>{opt.label}</span>
                  </span>
                  {opt.count !== undefined && (
                    <span className={`px-1.5 rounded text-[10px] ${active ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                      {opt.count}
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
