import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Plus, Check, X } from 'lucide-react';
import { dataService } from '../../lib/data/DataService';

function safeNormalize(s: string): string {
  try { return dataService.db.normalizeText(s); }
  catch { return (s || '').toString().trim().toLowerCase(); }
}

export interface SearchableOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: (string | SearchableOption)[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: string;
  allowAddNew?: boolean;
  onAddNew?: (name: string) => any;
  addNewLabel?: string;
  addNewPlaceholder?: string;
  groupLabel?: string;
  includeNoPreference?: boolean;
  noPreferenceLabel?: string;
}

export default function SearchableSelect({
  value, onChange, options, placeholder = 'اختر', searchPlaceholder = 'ابحث...',
  disabled = false, error, allowAddNew = false, onAddNew,
  addNewLabel = 'لم تجد ما تبحث عنه؟ أضفه هنا', addNewPlaceholder = 'اكتب الاسم...',
  groupLabel, includeNoPreference = false, noPreferenceLabel = 'لا مانع',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Position the dropdown
  const reposition = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  // Open/close
  const doOpen = () => {
    if (disabled) return;
    setQuery('');
    setShowAddForm(false);
    setAddSuccess(false);
    reposition();
    setOpen(true);
  };
  const doClose = () => {
    setOpen(false);
    setQuery('');
    setShowAddForm(false);
  };

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      doClose();
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const h = () => reposition();
    window.addEventListener('scroll', h, true);
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [open, reposition]);

  // Auto-focus search
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  const filtered = useMemo(() => {
    const raw = includeNoPreference ? [noPreferenceLabel, ...options] : options;
    if (!query.trim()) return raw;
    const n = safeNormalize(query);
    return raw.filter((o) => {
      if (typeof o === 'string') {
        return safeNormalize(o).includes(n);
      }
      return safeNormalize(o.label).includes(n) || safeNormalize(o.value).includes(n) || (o.description && safeNormalize(o.description).includes(n));
    });
  }, [options, query, includeNoPreference, noPreferenceLabel]);

  const handleAddNew = () => {
    if (!onAddNew) return;
    const name = newItemName.trim();
    if (!name) { setAddError('الرجاء كتابة الاسم'); return; }
    try {
      const result = onAddNew(name);
      const ok = result === true || result?.ok === true || (result && typeof result === 'object' && !result?.error);
      if (ok) {
        onChange(name);
        setAddSuccess(true); setNewItemName(''); setAddError('');
        setTimeout(doClose, 1500);
      } else { setAddError(result?.error || 'تعذّر الإضافة'); }
    } catch { setAddError('تعذّر الإضافة'); }
  };

  const hasValue = !!value;

  const displaySelectedLabel = useMemo(() => {
    if (!value) return '';
    const found = options.find((o) => (typeof o === 'string' ? o === value : o.value === value));
    if (found && typeof found !== 'string') {
      return found.label;
    }
    return value;
  }, [value, options]);

  // Dropdown rendered via portal
  const dropdownPortal = open && pos ? createPortal(
    <div
      ref={dropRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 999999 }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-cream-200 overflow-hidden font-tajawal" dir="rtl">
        {/* Search */}
        <div className="p-2.5 border-b border-cream-100">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
            <input ref={searchRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pr-9 pl-8 py-2.5 rounded-xl bg-cream-50 border border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-sm text-navy-900" />
            {query && <button type="button" onClick={() => setQuery('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700"><X className="w-4 h-4" /></button>}
          </div>
        </div>
        {/* Results */}
        <div className="max-h-60 overflow-y-auto divide-y divide-cream-100/50">
          {groupLabel && filtered.length > 0 && <div className="px-4 py-1.5 text-[11px] font-cairo font-bold text-navy-400 bg-cream-50/50 sticky top-0">{groupLabel}</div>}
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center"><p className="text-xs text-navy-400">{query ? 'لا توجد نتائج مطابقة' : 'لا توجد خيارات'}</p></div>
          ) : filtered.map((opt, idx) => {
            const optVal = typeof opt === 'string' ? opt : opt.value;
            const optLabel = typeof opt === 'string' ? opt : opt.label;
            const optDesc = typeof opt === 'string' ? undefined : opt.description;
            const isActive = optVal === value;
            return (
              <button key={`${optVal}-${idx}`} type="button"
                onClick={() => { onChange(optVal); doClose(); }}
                className={`w-full px-4 py-2.5 text-right text-sm transition-colors flex items-center justify-between gap-2 ${isActive ? 'bg-gold-300/15 text-gold-800 font-bold' : 'text-navy-700 hover:bg-cream-50'}`}>
                <span className="flex items-start gap-2 flex-1 min-w-0">
                  {includeNoPreference && optVal === noPreferenceLabel ? (
                    <span className="text-xs text-navy-400 mt-0.5">—</span>
                  ) : null}
                  <span className="flex flex-col text-right min-w-0">
                    <span className="text-sm font-semibold truncate text-navy-900">{optLabel}</span>
                    {optDesc && (
                      <span className="text-[11px] text-navy-400 font-tajawal mt-0.5 leading-tight">
                        {optDesc}
                      </span>
                    )}
                  </span>
                </span>
                {isActive && <Check className="w-4 h-4 text-gold-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
        {/* Add new */}
        {allowAddNew && (
          <div className="border-t border-cream-100">
            {!showAddForm ? (
              <button type="button" onClick={() => setShowAddForm(true)}
                className="w-full px-4 py-3 text-right text-sm font-cairo font-semibold text-gold-700 hover:bg-gold-300/10 transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />{addNewLabel}
              </button>
            ) : addSuccess ? (
              <div className="p-3"><div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200"><Check className="w-4 h-4 text-emerald-600" /><span className="text-sm font-cairo font-semibold text-emerald-700">تم إرسال طلب الإضافة ✅</span></div></div>
            ) : (
              <div className="p-3 space-y-2 bg-cream-50/50">
                <div className="flex gap-2">
                  <input type="text" value={newItemName} onChange={(e) => { setNewItemName(e.target.value); setAddError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNew(); } }}
                    placeholder={addNewPlaceholder} autoFocus
                    className="flex-1 px-3 py-2.5 rounded-xl bg-white border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-sm text-navy-900" />
                  <button type="button" onClick={handleAddNew}
                    className="px-4 py-2.5 rounded-xl bg-gold-gradient text-navy-900 font-cairo font-bold text-sm flex items-center gap-1"><Plus className="w-4 h-4" />إضافة</button>
                </div>
                {addError && <p className="text-xs text-rose-deep font-tajawal px-1">{addError}</p>}
                <p className="text-[11px] text-navy-400 font-tajawal px-1">ستُضاف مؤقتاً وتراجعها الإدارة.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button ref={btnRef} type="button" onClick={() => open ? doClose() : doOpen()} disabled={disabled}
        className={`w-full px-4 py-3 pl-10 rounded-xl bg-cream-50 border-2 transition-colors text-right font-tajawal flex items-center justify-between gap-2
          ${error ? 'border-rose-400' : open ? 'border-gold-500' : 'border-cream-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gold-300 cursor-pointer'}
          ${hasValue ? 'text-navy-900' : 'text-navy-400'}`}>
        <span className="flex items-center gap-2 truncate">
          {hasValue && <Check className="w-4 h-4 text-gold-600 flex-shrink-0" />}
          <span className="truncate">{displaySelectedLabel || placeholder}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-navy-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {dropdownPortal}
    </div>
  );
}
