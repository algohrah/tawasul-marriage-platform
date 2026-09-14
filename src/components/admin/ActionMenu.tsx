import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Loader2 } from 'lucide-react';

// ============================================================
//  قائمة إجراءات موحّدة بزر (⋯) — تستبدل صفّ الأزرار المبعثرة
//  تقلّل المساحة والتشتّت في بطاقات الإدارة
// ============================================================

export interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'success';
  disabled?: boolean;
  hidden?: boolean;
  divider?: boolean; // فاصل قبل العنصر
  sectionHeader?: string; // عنوان فاصل قسم
}

interface Props {
  items: ActionItem[];
  busy?: boolean;
  label?: string;
  align?: 'left' | 'right';
  onOpenChange?: (open: boolean) => void;
}

const variantClasses: Record<string, string> = {
  default: 'text-slate-700 hover:bg-slate-50',
  primary: 'text-slate-900 hover:bg-amber-50',
  danger: 'text-rose-600 hover:bg-rose-50',
  success: 'text-emerald-600 hover:bg-emerald-50',
};

export default function ActionMenu({ items, busy, label = 'إجراءات', align = 'left', onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (onOpenChange) onOpenChange(next);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        if (onOpenChange) onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOpenChange]);

  const visible = (items || []).filter((i) => !i.hidden);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggleOpen}
        disabled={busy}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-cairo font-bold text-[11px] hover:bg-slate-800 transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 mt-2 min-w-[210px] bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 max-h-[80vh] overflow-y-auto ${align === 'left' ? 'left-0' : 'right-0'}`}
          >
            {visible.map((item, i) => (
              <div key={i}>
                {item.sectionHeader && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-cairo font-extrabold text-amber-800 bg-amber-50/80 border-y border-amber-100 my-1 first:mt-0 text-right flex items-center justify-between">
                    <span>{item.sectionHeader}</span>
                  </div>
                )}
                {item.divider && !item.sectionHeader && <div className="my-1 h-px bg-slate-100" />}
                {item.label ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!item.disabled) {
                        item.onClick();
                        setOpen(false);
                        if (onOpenChange) onOpenChange(false);
                      }
                    }}
                    disabled={item.disabled}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-cairo font-bold text-right transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                      ${variantClasses[item.variant || 'default']}`}
                  >
                    {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                    <span className="truncate">{item.label}</span>
                  </button>
                ) : null}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
