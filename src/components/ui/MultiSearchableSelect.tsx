import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check, MapPin, X, Plus } from 'lucide-react';
import { dataService } from '../../lib/data/DataService';

function safeNormalize(s: string): string {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

interface MultiSearchableSelectProps {
  values: string[];
  onChange: (newValues: string[]) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: string;
  allowAddNew?: boolean;
  onAddNew?: (name: string) => any;
  addNewLabel?: string;
  addNewPlaceholder?: string;
  groupLabel?: string;
  autoOpen?: boolean;
  openTrigger?: number;
}

export default function MultiSearchableSelect({
  values = [], onChange, options, placeholder = 'اختر واحدًا أو أكثر...',
  searchPlaceholder = 'ابحث...', disabled = false, error,
  allowAddNew = false, onAddNew,
  addNewLabel = 'اضغط هنا لكتابة خيار جديد', addNewPlaceholder = 'اكتب الاسم هنا...',
  groupLabel,
  autoOpen = false,
  openTrigger = 0,
}: MultiSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const lastTriggerRef = useRef<number>(0);

  const reposition = useCallback(() => {
    if (!boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  const doOpen = () => {
    if (disabled) return;
    setQuery(''); setShowAddForm(false); setAddSuccess(false);
    reposition();
    setOpen(true);
  };
  const doClose = () => { setOpen(false); setQuery(''); setShowAddForm(false); };

  useEffect(() => {
    if (autoOpen) {
      const timer = setTimeout(() => {
        doOpen();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [autoOpen]);

  useEffect(() => {
    if (openTrigger !== undefined) {
      if (openTrigger > 0 && openTrigger !== lastTriggerRef.current) {
        lastTriggerRef.current = openTrigger;
        const timer = setTimeout(() => {
          doOpen();
        }, 60);
        return () => clearTimeout(timer);
      } else if (openTrigger === 0) {
        lastTriggerRef.current = 0;
        doClose();
      }
    }
  }, [openTrigger]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      doClose();
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = () => reposition();
    window.addEventListener('scroll', h, true);
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [open, reposition]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  const safeValues = useMemo(() => {
    return Array.from(new Set((values || []).map((v) => String(v || '').trim()).filter(Boolean)));
  }, [values]);

  const toggleOption = (opt: string) => {
    if (safeValues.includes(opt)) onChange(safeValues.filter((v) => v !== opt));
    else onChange([...safeValues, opt]);
  };

  const removeValue = (opt: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(safeValues.filter((v) => v !== opt));
  };

  const filtered = useMemo(() => {
    if (!open) return [];
    const all = Array.from(new Set(options)).filter(Boolean);
    if (!query.trim()) return all;
    const n = safeNormalize(query);
    return all.filter((o) => safeNormalize(o).includes(n));
  }, [open, options, query]);

  const handleAddNew = () => {
    if (!onAddNew) return;
    const name = newItemName.trim();
    if (!name) { setAddError('الرجاء كتابة الاسم'); return; }
    try {
      const result = onAddNew(name);
      const ok = result === true || result?.ok === true || (result && typeof result === 'object' && !result?.error);
      if (ok) {
        if (!values.includes(name)) onChange([...values, name]);
        setAddSuccess(true); setNewItemName(''); setAddError('');
        setTimeout(() => { setShowAddForm(false); setAddSuccess(false); setQuery(''); }, 1200);
      } else { setAddError(result?.error || 'تعذّر الإضافة'); }
    } catch { setAddError('تعذّر الإضافة'); }
  };

  const dropdownPortal = open && pos ? createPortal(
    <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 999999 }}>
      <div className="bg-white rounded-2xl shadow-2xl border border-cream-200 overflow-hidden font-tajawal" dir="rtl">
        <div className="p-2.5 border-b border-cream-100">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
            <input ref={searchRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pr-9 pl-8 py-2 rounded-xl bg-cream-50 border border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-sm text-navy-900" />
            {query && <button type="button" onClick={() => setQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700"><X className="w-4 h-4" /></button>}
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {groupLabel && filtered.length > 0 && <div className="px-4 py-1.5 text-[11px] font-cairo font-bold text-navy-400 bg-cream-50/50 sticky top-0">{groupLabel}</div>}
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center"><p className="text-xs text-navy-400">{query ? 'لا توجد نتائج مطابقة' : 'لا توجد خيارات'}</p></div>
          ) : filtered.map((opt, idx) => {
            const isSelected = safeValues.includes(opt);
            return (
              <button key={`${opt}-${idx}`} type="button" onClick={() => toggleOption(opt)}
                className={`w-full px-4 py-2.5 text-right text-sm transition-colors flex items-center justify-between gap-2 ${isSelected ? 'bg-gold-300/15 text-gold-900 font-bold' : 'text-navy-700 hover:bg-cream-50'}`}>
                <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-navy-300" />{opt}</span>
                {isSelected && <Check className="w-4 h-4 text-gold-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
        {allowAddNew && (
          <div className="border-t border-cream-100">
            {!showAddForm ? (
              <button type="button" onClick={() => setShowAddForm(true)}
                className="w-full px-4 py-2.5 text-right text-sm font-cairo font-semibold text-gold-700 hover:bg-gold-300/10 transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />{addNewLabel}
              </button>
            ) : addSuccess ? (
              <div className="p-3"><div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200"><Check className="w-4 h-4 text-emerald-600" /><span className="text-sm font-cairo font-semibold text-emerald-700">تمت الإضافة بنجاح ✅</span></div></div>
            ) : (
              <div className="p-3 space-y-2 bg-cream-50/50">
                <div className="flex gap-2">
                  <input type="text" value={newItemName} onChange={(e) => { setNewItemName(e.target.value); setAddError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNew(); } }}
                    placeholder={addNewPlaceholder} autoFocus
                    className="flex-1 px-3 py-2 rounded-xl bg-white border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-sm text-navy-900" />
                  <button type="button" onClick={handleAddNew}
                    className="px-4 py-2 rounded-xl bg-gold-gradient text-navy-900 font-cairo font-bold text-sm">إضافة</button>
                </div>
                {addError && <p className="text-xs text-rose-deep font-tajawal">{addError}</p>}
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
      <div ref={boxRef} onClick={() => open ? doClose() : doOpen()}
        className={`w-full min-h-[48px] px-3 py-2 rounded-xl bg-cream-50 border-2 transition-colors text-right font-tajawal flex flex-wrap items-center justify-between gap-1.5 cursor-pointer
          ${error ? 'border-rose-400' : open ? 'border-gold-500' : 'border-cream-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gold-300'}`}>
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {safeValues.length === 0 ? (
            <span className="text-navy-400 text-sm px-1">{placeholder}</span>
          ) : safeValues.map((val, idx) => (
            <span key={`${val}-${idx}`} className="inline-flex items-center gap-1 bg-gold-300/20 text-gold-900 border border-gold-300/40 text-xs font-cairo font-bold px-2.5 py-1 rounded-lg">
              <span>{val}</span>
              <button type="button" onClick={(e) => removeValue(val, e)} className="hover:bg-gold-300/40 rounded-full p-0.5 text-navy-600 transition-colors"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <ChevronDown className={`w-4 h-4 text-navy-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {dropdownPortal}
    </div>
  );
}
