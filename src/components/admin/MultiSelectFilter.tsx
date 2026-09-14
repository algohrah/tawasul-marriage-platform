import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, X, Search, Filter } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
  badge?: string;
  isPending?: boolean;
}

interface Props {
  label: string;
  selectedValues: string[];
  options: (string | MultiSelectOption)[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  icon?: React.ReactNode;
  className?: string;
  accentColor?: 'amber' | 'blue' | 'purple' | 'slate';
  searchable?: boolean;
  disabled?: boolean;
}

export default function MultiSelectFilter({
  label,
  selectedValues = [],
  options = [],
  onChange,
  placeholder = 'الكل',
  searchPlaceholder = 'بحث في الخيارات...',
  icon,
  className = '',
  accentColor = 'amber',
  searchable,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to object shape
  const normalizedOptions = useMemo<MultiSelectOption[]>(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const isSearchable = searchable ?? normalizedOptions.length > 5;

  // Filter options by search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const q = searchTerm.trim().toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, searchTerm]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus search input when opening
  useEffect(() => {
    if (open && isSearchable) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
    }
  }, [open, isSearchable]);

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const selectAll = () => {
    const allVals = normalizedOptions.map((o) => o.value);
    onChange(allVals);
  };

  const clearAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange([]);
  };

  const hasSelection = selectedValues.length > 0;
  const allSelected =
    normalizedOptions.length > 0 &&
    normalizedOptions.every((o) => selectedValues.includes(o.value));

  // Determine display label on trigger button
  const displaySummary = useMemo(() => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const found = normalizedOptions.find((o) => o.value === selectedValues[0]);
      return found ? found.label : selectedValues[0];
    }
    const first = normalizedOptions.find((o) => o.value === selectedValues[0]);
    const firstLabel = first ? first.label : selectedValues[0];
    return `${firstLabel} (+${selectedValues.length - 1})`;
  }, [selectedValues, normalizedOptions, placeholder]);

  const accentStyles = {
    amber: {
      activeBtn: 'bg-amber-500 text-slate-950 border-amber-500 hover:bg-amber-600',
      badge: 'bg-amber-100 text-amber-900 border border-amber-300',
      check: 'text-amber-600',
      activeItem: 'bg-amber-50 text-amber-950 font-bold',
      ring: 'focus-within:border-amber-500',
    },
    blue: {
      activeBtn: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
      badge: 'bg-blue-100 text-blue-900 border border-blue-300',
      check: 'text-blue-600',
      activeItem: 'bg-blue-50 text-blue-950 font-bold',
      ring: 'focus-within:border-blue-500',
    },
    purple: {
      activeBtn: 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700',
      badge: 'bg-purple-100 text-purple-900 border border-purple-300',
      check: 'text-purple-600',
      activeItem: 'bg-purple-50 text-purple-950 font-bold',
      ring: 'focus-within:border-purple-500',
    },
    slate: {
      activeBtn: 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800',
      badge: 'bg-slate-200 text-slate-900 border border-slate-300',
      check: 'text-slate-900',
      activeItem: 'bg-slate-100 text-slate-950 font-bold',
      ring: 'focus-within:border-slate-500',
    },
  }[accentColor];

  return (
    <div ref={containerRef} className={`relative flex flex-col ${className}`}>
      {label && (
        <label className="block text-[11px] font-cairo font-bold text-slate-600 mb-1 flex items-center justify-between">
          <span className="truncate">{label}</span>
          {hasSelection && (
            <span className="text-[10px] text-amber-700 font-normal font-mono">
              ({selectedValues.length} محدد)
            </span>
          )}
        </label>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`w-full min-h-[34px] px-2.5 py-1.5 rounded-lg border text-xs font-cairo font-semibold flex items-center justify-between gap-1.5 transition-all text-right select-none shadow-2xs ${
          disabled
            ? 'bg-slate-100/80 text-slate-400 border-slate-200 cursor-not-allowed opacity-75'
            : hasSelection
            ? `${accentStyles.badge} ring-1 ring-amber-400/30 cursor-pointer`
            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 cursor-pointer'
        }`}
        title={`${label}: ${displaySummary}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
          <span className="truncate block font-medium">
            {displaySummary}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {hasSelection && (
            <span
              onClick={clearAll}
              className="p-0.5 rounded-full hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 transition-colors"
              title="مسح التحديد"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
              open ? 'rotate-180 text-slate-700' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full right-0 mt-1 w-full min-w-[210px] max-w-[320px] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden font-tajawal dir-rtl text-right"
            style={{ minWidth: '100%' }}
          >
            {/* Search Box if needed */}
            {isSearchable && (
              <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={searchPlaceholder || "بحث في الخيارات..."}
                    className="w-full pl-2 pr-8 py-1 text-xs bg-white rounded-md border border-slate-200 text-slate-800 placeholder-slate-400 font-tajawal focus:outline-none focus:border-amber-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute left-2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions Header */}
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 text-[10px] font-cairo font-bold border-b border-slate-100 text-slate-600">
              <button
                type="button"
                onClick={selectAll}
                className="hover:text-amber-700 hover:underline transition-colors"
              >
                تحديد الكل ({normalizedOptions.length})
              </button>
              {hasSelection && (
                <button
                  type="button"
                  onClick={() => clearAll()}
                  className="text-rose-600 hover:underline transition-colors"
                >
                  إلغاء التحديد
                </button>
              )}
            </div>

            {/* Option Checkboxes List */}
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 py-1">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 font-cairo">
                  لا توجد خيارات مطابقة
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isChecked = selectedValues.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      onClick={() => toggleOption(opt.value)}
                      className={`flex items-center justify-between px-3 py-2 text-xs font-cairo transition-colors cursor-pointer select-none ${
                        isChecked ? accentStyles.activeItem : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
                            isChecked
                              ? 'bg-amber-500 border-amber-500 text-slate-950'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="truncate">{opt.label}</span>
                        {opt.isPending && (
                          <span className="px-1 py-0.2 rounded text-[8px] bg-amber-100 text-amber-800 font-mono">
                            معلق
                          </span>
                        )}
                      </div>

                      {opt.count !== undefined && (
                        <span className="text-[10px] text-slate-400 font-mono mr-2">
                          {opt.count}
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer Done Button */}
            <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-cairo text-slate-500">
                {hasSelection ? `${selectedValues.length} محدد` : 'الكل مفعل'}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-cairo font-bold transition-colors cursor-pointer"
              >
                تم ✓
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
