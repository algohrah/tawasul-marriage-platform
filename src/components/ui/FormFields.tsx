import { useState, useRef, useEffect, type ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

// ====================================================================
//  مكونات حقول النموذج — قابلة لإعادة الاستخدام
// ====================================================================

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  error?: string;
}

export function Field({ label, required, hint, children, error }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-cairo font-semibold text-navy-800 mb-1.5">
        {label}
        {required && <span className="text-rose-deep mr-1">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-navy-400 font-tajawal mt-1">{hint}</p>}
      {error && <p className="text-xs text-rose-deep font-tajawal mt-1">{error}</p>}
    </div>
  );
}

// حقل نصي
export function TextInput({
  value, onChange, placeholder, type = 'text', className = '', min, max, step, onBlur,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string; min?: number; max?: number; step?: number; onBlur?: () => void;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      className={`w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 transition-colors ${className}`}
    />
  );
}

// قائمة منسدلة — تستخدم قائمة مخصصة بدلاً من native select لضمان التوافق مع RTL والـ modals
export function SelectInput({
  value, onChange, options, placeholder = 'اختر', className = '', disabled = false, error = false,
}: {
  value: string; onChange: (v: string) => void; options: (string | number | { value?: string; label?: string; name?: string; id?: string })[]; placeholder?: string; className?: string; disabled?: boolean; error?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const opts = options.map((o) => {
    if (typeof o === 'string') return { value: o, label: o };
    if (typeof o === 'number') return { value: String(o), label: String(o) };
    if (typeof o === 'object' && o !== null) {
      const val = o.value ?? o.name ?? o.label ?? o.id ?? '';
      const lbl = o.label ?? o.name ?? o.value ?? '';
      return { value: String(val), label: String(lbl) };
    }
    return { value: String(o || ''), label: String(o || '') };
  });

  const selectedLabel = opts.find((o) => o.value === value)?.label || '';

  const reposition = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  const doOpen = () => { if (disabled) return; reposition(); setIsOpen(true); };
  const doClose = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      doClose();
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = () => reposition();
    window.addEventListener('scroll', h, true);
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [isOpen]);

  const portal = isOpen && pos ? ReactDOM.createPortal(
    <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 999999 }}>
      <div className="bg-white rounded-2xl shadow-2xl border border-cream-200 overflow-hidden font-tajawal max-h-64 overflow-y-auto" dir="rtl">
        <button type="button" onClick={() => { onChange(''); doClose(); }}
          className={`w-full px-4 py-2.5 text-right text-sm transition-colors ${!value ? 'bg-gold-300/15 text-gold-800 font-bold' : 'text-navy-400 hover:bg-cream-50'}`}>
          {placeholder}
        </button>
        {opts.map((o, idx) => (
          <button key={`${o.value}-${idx}`} type="button"
            onClick={() => { onChange(o.value); doClose(); }}
            className={`w-full px-4 py-2.5 text-right text-sm transition-colors flex items-center justify-between ${value === o.value ? 'bg-gold-300/15 text-gold-800 font-bold' : 'text-navy-700 hover:bg-cream-50'}`}>
            <span>{o.label}</span>
            {value === o.value && <Check className="w-4 h-4 text-gold-600 flex-shrink-0" />}
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button ref={btnRef} type="button" onClick={() => isOpen ? doClose() : doOpen()} disabled={disabled}
        className={`w-full px-4 py-3 rounded-xl bg-cream-50 border-2 ${error ? 'border-rose-400' : isOpen ? 'border-gold-500' : 'border-cream-200'} focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 transition-colors cursor-pointer text-right flex items-center justify-between gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
        <span className={`truncate ${selectedLabel ? 'text-navy-900' : 'text-navy-400'}`}>{selectedLabel || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-navy-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {portal}
    </div>
  );
}

// منطقة نص
export function TextArea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 resize-none transition-colors"
    />
  );
}

// خيارات اختيار من متعدد (chips)
export function MultiChips({
  values, selected, onChange, max,
}: {
  values: string[]; selected: string[]; onChange: (v: string[]) => void; max?: number;
}) {
  const toggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((x) => x !== item));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, item]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((item) => {
        const active = selected.includes(item);
        return (
          <button
            key={item}
            type="button"
            onClick={() => toggle(item)}
            className={`px-3.5 py-2 rounded-full text-sm font-cairo font-semibold transition-all no-tap-highlight ${
              active
                ? 'bg-navy-900 text-white shadow-soft'
                : 'bg-cream-100 text-navy-600 hover:bg-cream-200'
            }`}
          >
            {active && <Check className="w-3.5 h-3.5 inline ml-1" />}
            {item}
          </button>
        );
      })}
    </div>
  );
}

// خيارات اختيار فردي (radio cards)
export function RadioGroup({
  options, value, onChange, columns = 2,
}: {
  options: (string | { value: string; label: string | any })[]; value: string; onChange: (v: string) => void; columns?: number;
}) {
  const gridClass = columns === 1 ? 'grid-cols-1' : columns === 3 ? 'grid-cols-3' : columns === 4 ? 'grid-cols-4' : 'grid-cols-2';
  return (
    <div className={`grid ${gridClass} gap-2`}>
      {options.map((rawOpt, idx) => {
        let optVal = '';
        let optLabel = '';
        if (typeof rawOpt === 'string') {
          optVal = rawOpt;
          optLabel = rawOpt;
        } else if (rawOpt && typeof rawOpt === 'object') {
          const rawLabel = rawOpt.label;
          if (rawLabel && typeof rawLabel === 'object') {
            optLabel = String(rawLabel.label || rawLabel.value || rawLabel.name || '');
            optVal = String(rawLabel.value || rawOpt.value || optLabel);
          } else {
            optVal = String(rawOpt.value ?? '');
            optLabel = String(rawOpt.label ?? optVal);
          }
        } else {
          optVal = String(rawOpt ?? '');
          optLabel = optVal;
        }
        return (
          <button
            key={`${optVal}-${idx}`}
            type="button"
            onClick={() => onChange(optVal)}
            className={`px-4 py-2.5 rounded-xl text-sm font-cairo font-semibold transition-all border-2 no-tap-highlight text-center ${
              value === optVal
                ? 'border-gold-500 bg-gold-300/10 text-navy-900'
                : 'border-cream-200 bg-cream-50 text-navy-600 hover:border-gold-300'
            }`}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

// بطاقة اختيار كبيرة (للجنس مثلاً)
export function ChoiceCard({
  active, onClick, icon, title, subtitle,
}: {
  active: boolean; onClick: () => void; icon: ReactNode; title: string; subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-5 rounded-2xl border-2 transition-all duration-300 no-tap-highlight text-center ${
        active ? 'border-gold-500 bg-gold-300/10 shadow-soft' : 'border-cream-200 hover:border-gold-300'
      }`}
    >
      {active && (
        <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-gold-gradient flex items-center justify-center">
          <Check className="w-3 h-3 text-navy-900" />
        </span>
      )}
      <div className="flex flex-col items-center gap-2">
        {icon}
        <span className="font-cairo font-bold text-navy-900">{title}</span>
        {subtitle && <span className="text-xs text-navy-500 font-tajawal">{subtitle}</span>}
      </div>
    </button>
  );
}

// شريط التدرج (slider)
export function RangeSlider({
  value, onChange, min, max, unit,
}: {
  value: number; onChange: (v: number) => void; min: number; max: number; unit?: string;
}) {
  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-gold-500"
      />
      <div className="flex justify-between text-xs text-navy-400 font-tajawal mt-1">
        <span>{min}{unit}</span>
        <span className="font-bold text-gold-700">{value}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

// شريط تقدم
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-gold-gradient rounded-full transition-all duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// قائمة منسدلة مع خيار "أخرى" يُظهر حقل نص
export function SelectWithOther({
  value, otherValue, onChange, onOtherChange, options, placeholder = 'اختر',
}: {
  value: string;
  otherValue: string;
  onChange: (v: string) => void;
  onOtherChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const isOther = value === 'أخرى' || value === 'مذهب آخر' || value === 'جنسية أخرى';
  return (
    <div className="space-y-2">
      <SelectInput
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
      />
      {isOther && (
        <input
          type="text"
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="اكتب بالتفصيل هنا..."
          className="w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-gold-400 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 transition-colors"
        />
      )}
    </div>
  );
}

// ====================================================================
//  اختيار التاريخ بثلاث قوائم منسدلة (سنة / شهر / يوم)
//  - لا يسمح باختيار سنين مستقبلية
//  - عدد الأيام يتكيف تلقائيًا حسب الشهر والسنة (كبسولة فبراير)
// ====================================================================

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// عدد أيام شهر معيّن في سنة معيّنة
function getDaysInMonth(year: number, month: number): number {
  // month هنا 1-12
  if (month === 2) {
    // فبراير: 29 يوم في السنة الكبيسة، وإلا 28
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  // أشهر 31 يومًا
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
  return 30;
}

interface DateSelectProps {
  value: string; // بصيغة yyyy-mm-dd
  onChange: (date: string) => void;
  minYear?: number; // أقدم سنة مسموح بها (افتراضي: قبل 100 سنة)
  placeholder?: { year?: string; month?: string; day?: string };
}

export function DateSelect({
  value,
  onChange,
  minYear = new Date().getFullYear() - 100,
  placeholder = { year: 'السنة', month: 'الشهر', day: 'اليوم' },
}: DateSelectProps) {
  const currentYear = new Date().getFullYear();

  // تحليل القيمة الحالية
  const parts = value ? value.split('-') : [];
  const selectedYear = parts[0] ? parseInt(parts[0]) : 0;
  const selectedMonth = parts[1] ? parseInt(parts[1]) : 0;
  const selectedDay = parts[2] ? parseInt(parts[2]) : 0;

  // قائمة السنين: من السنة الحالية إلى minYear (تنازليًا)
  const years: number[] = [];
  for (let y = currentYear; y >= minYear; y--) {
    years.push(y);
  }

  // قائمة الأيام: تعتمد على الشهر والسنة المختارَين
  const maxDay = selectedYear && selectedMonth ? getDaysInMonth(selectedYear, selectedMonth) : 31;
  const days: number[] = [];
  for (let d = 1; d <= maxDay; d++) {
    days.push(d);
  }

  // تحديث القيمة عند تغيير أي من القوائم
  const updateValue = (newYear: number, newMonth: number, newDay: number) => {
    // إذا تغيّر الشهر أو السنة، تأكد أن اليوم صالح
    let finalDay = newDay;
    if (newYear && newMonth) {
      const daysInThisMonth = getDaysInMonth(newYear, newMonth);
      if (finalDay > daysInThisMonth) finalDay = daysInThisMonth;
    }

    // بناء التاريخ بصيغة yyyy-mm-dd
    if (newYear && newMonth && finalDay) {
      const dateStr = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
      onChange(dateStr);
    } else {
      // حفظ القيم الجزئية مؤقتًا في data attribute عبر callback
      // نبني تاريخًا مؤقتًا حتى لو غير مكتمل
      const y = newYear || '';
      const m = newMonth ? String(newMonth).padStart(2, '0') : '';
      const d = finalDay ? String(finalDay).padStart(2, '0') : '';
      onChange(`${y}-${m}-${d}`);
    }
  };

  const yearOptions = years.map((y) => ({ value: String(y), label: String(y) }));
  const monthOptions = MONTHS_AR.map((m, i) => ({ value: String(i + 1), label: m }));
  const dayOptions = days.map((d) => ({ value: String(d), label: String(d) }));

  return (
    <div className="grid grid-cols-3 gap-2">
      <SelectInput
        value={selectedYear ? String(selectedYear) : ''}
        onChange={(v) => updateValue(parseInt(v) || 0, selectedMonth, selectedDay)}
        options={yearOptions}
        placeholder={placeholder.year || 'السنة'}
      />
      <SelectInput
        value={selectedMonth ? String(selectedMonth) : ''}
        onChange={(v) => updateValue(selectedYear, parseInt(v) || 0, selectedDay)}
        options={monthOptions}
        placeholder={placeholder.month || 'الشهر'}
      />
      <SelectInput
        value={selectedDay ? String(selectedDay) : ''}
        onChange={(v) => updateValue(selectedYear, selectedMonth, parseInt(v) || 0)}
        options={dayOptions}
        placeholder={placeholder.day || 'اليوم'}
      />
    </div>
  );
}

// ====================================================================
//  مكون مدخل رقم الواتساب مع رمز الدولة
// ====================================================================

export interface CountryCode {
  code: string;
  country: string;
  flag: string;
  iso: string;
}

export const ARAB_COUNTRIES: CountryCode[] = [
  { code: '+966', country: 'السعودية', flag: '🇸🇦', iso: 'SA' },
  { code: '+971', country: 'الإمارات', flag: '🇦🇪', iso: 'AE' },
  { code: '+965', country: 'الكويت', flag: '🇰🇼', iso: 'KW' },
  { code: '+974', country: 'قطر', flag: '🇶🇦', iso: 'QA' },
  { code: '+973', country: 'البحرين', flag: '🇧🇭', iso: 'BH' },
  { code: '+968', country: 'عُمان', flag: '🇴🇲', iso: 'OM' },
  { code: '+20', country: 'مصر', flag: '🇪🇬', iso: 'EG' },
  { code: '+962', country: 'الأردن', flag: '🇯🇴', iso: 'JO' },
  { code: '+970', country: 'فلسطين', flag: '🇵🇸', iso: 'PS' },
  { code: '+961', country: 'لبنان', flag: '🇱🇧', iso: 'LB' },
  { code: '+963', country: 'سوريا', flag: '🇸🇾', iso: 'SY' },
  { code: '+964', country: 'العراق', flag: '🇮🇶', iso: 'IQ' },
  { code: '+967', country: 'اليمن', flag: '🇾🇪', iso: 'YE' },
  { code: '+212', country: 'المغرب', flag: '🇲🇦', iso: 'MA' },
  { code: '+213', country: 'الجزائر', flag: '🇩🇿', iso: 'DZ' },
  { code: '+216', country: 'تونس', flag: '🇹🇳', iso: 'TN' },
  { code: '+218', country: 'ليبيا', flag: '🇱🇾', iso: 'LY' },
  { code: '+249', country: 'السودان', flag: '🇸🇩', iso: 'SD' },
  { code: '+222', country: 'موريتانيا', flag: '🇲🇷', iso: 'MR' },
  { code: '+252', country: 'الصومال', flag: '🇸🇴', iso: 'SO' },
  { code: '+253', country: 'جيبوتي', flag: '🇩🇯', iso: 'DJ' },
  { code: '+269', country: 'جزر القمر', flag: '🇰🇲', iso: 'KM' },
];

export const OTHER_COUNTRIES: CountryCode[] = [
  { code: '+90', country: 'تركيا', flag: '🇹🇷', iso: 'TR' },
  { code: '+44', country: 'المملكة المتحدة', flag: '🇬🇧', iso: 'GB' },
  { code: '+1', country: 'أمريكا / كندا', flag: '🇺🇸', iso: 'US' },
  { code: '+49', country: 'ألمانيا', flag: '🇩🇪', iso: 'DE' },
  { code: '+33', country: 'فرنسا', flag: '🇫🇷', iso: 'FR' },
  { code: '+46', country: 'السويد', flag: '🇸🇪', iso: 'SE' },
  { code: '+31', country: 'هولندا', flag: '🇳🇱', iso: 'NL' },
  { code: '+61', country: 'أستراليا', flag: '🇦🇺', iso: 'AU' },
  { code: '+60', country: 'ماليزيا', flag: '🇲🇾', iso: 'MY' },
  { code: '+39', country: 'إيطاليا', flag: '🇮🇹', iso: 'IT' },
  { code: '+34', country: 'إسبانيا', flag: '🇪🇸', iso: 'ES' },
  { code: '+43', country: 'النمسا', flag: '🇦🇹', iso: 'AT' },
  { code: '+41', country: 'سويسرا', flag: '🇨🇭', iso: 'CH' },
  { code: '+32', country: 'بلجيكا', flag: '🇧🇪', iso: 'BE' },
];

export const COUNTRY_PHONE_CODES: CountryCode[] = [...ARAB_COUNTRIES, ...OTHER_COUNTRIES];

function parsePhoneValue(value: string, defaultCode = '+966') {
  if (!value) return { code: defaultCode, number: '', isCustom: false };

  // إذا كانت القيمة تبدأ بصيغة مخصصة غير مسجلة في القائمة
  const sorted = [...COUNTRY_PHONE_CODES].sort((a, b) => b.code.length - a.code.length);
  const found = sorted.find((c) => value.startsWith(c.code));
  if (found) {
    const rawNum = value.slice(found.code.length).trim().replace(/[^\d]/g, '');
    return { code: found.code, number: rawNum, isCustom: false };
  }

  // إذا كانت القيمة تبدأ بـ + لكن الرمز غير موجود بالأكواد الشائعة
  if (value.startsWith('+')) {
    return { code: 'CUSTOM', number: value, isCustom: true };
  }

  return { code: defaultCode, number: value.replace(/[^\d]/g, ''), isCustom: false };
}

export function PhoneInputWithCountryCode({
  value,
  onChange,
  placeholder = '501234567',
  defaultCode = '+966',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  defaultCode?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manualCustomMode, setManualCustomMode] = useState<boolean | null>(null);

  const parsed = parsePhoneValue(value, defaultCode);
  const matchedCountry = COUNTRY_PHONE_CODES.find((c) => c.code === parsed.code);

  const isCustomMode = manualCustomMode !== null ? manualCustomMode : (parsed.isCustom || (!matchedCountry && parsed.code === 'CUSTOM'));

  const selectedCode = parsed.code;
  const localNumber = parsed.number;

  const selectedCountry = matchedCountry || {
    code: '🌐',
    country: 'دولة غير مدرجة',
    flag: '🌐',
    iso: 'XX',
  };

  const handleSelectCode = (newCode: string) => {
    setManualCustomMode(false);
    const raw = isCustomMode ? value.replace(/[^\d]/g, '') : localNumber;
    const cleanNum = raw.replace(/^0+/, '');
    onChange(cleanNum ? `${newCode} ${cleanNum}` : newCode);
    setIsOpen(false);
    setSearch('');
  };

  const handleSelectCustomMode = () => {
    setManualCustomMode(true);
    setIsOpen(false);
    setSearch('');
    if (!value || !value.startsWith('+')) {
      onChange('+');
    }
  };

  const handleStandardNumberChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^\d]/g, '');
    const cleanNum = digitsOnly.replace(/^0+/, '');
    onChange(cleanNum ? `${selectedCode} ${cleanNum}` : `${selectedCode}`);
  };

  const handleCustomNumberChange = (raw: string) => {
    // السماح بالأرقام وعلامة الزائد والمسافات
    let formatted = raw.replace(/[^\d+\s]/g, '');
    if (formatted && !formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }
    onChange(formatted);
  };

  const filteredArab = ARAB_COUNTRIES.filter(
    (c) => c.country.includes(search) || c.code.includes(search)
  );
  const filteredOther = OTHER_COUNTRIES.filter(
    (c) => c.country.includes(search) || c.code.includes(search)
  );

  return (
    <div className="space-y-1.5 relative">
      <div className="flex items-center rounded-xl bg-cream-50 border-2 border-cream-200 focus-within:border-gold-500 overflow-hidden transition-colors shadow-xs" dir="ltr">
        {/* زر اختيار الدولة */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`border-r border-cream-200 transition-colors flex items-center gap-1.5 px-3 py-3 shrink-0 cursor-pointer font-bold font-tajawal select-none ${
            isCustomMode ? 'bg-amber-100/90 hover:bg-amber-200/90 text-amber-950' : 'bg-cream-100/90 hover:bg-cream-200 text-navy-900'
          }`}
        >
          <span className="text-xl">{isCustomMode ? '🌐' : selectedCountry.flag}</span>
          <bdi dir="ltr" className="font-mono text-sm font-bold">
            {isCustomMode ? 'غير مدرجة' : selectedCountry.code}
          </bdi>
          <ChevronDown className={`w-4 h-4 transition-transform ${isCustomMode ? 'text-amber-800' : 'text-navy-500'} ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* حقل إدخال الرقم */}
        {isCustomMode ? (
          <input
            type="tel"
            value={value}
            onChange={(e) => handleCustomNumberChange(e.target.value)}
            placeholder="اكتب الرقم مع رمز الدولة (مثال: +351 912345678)"
            className="w-full px-4 py-3 bg-transparent text-navy-900 font-mono text-base focus:outline-none font-bold placeholder:font-tajawal placeholder:text-navy-300 placeholder:text-xs text-left"
            dir="ltr"
          />
        ) : (
          <input
            type="tel"
            value={localNumber}
            onChange={(e) => handleStandardNumberChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 bg-transparent text-navy-900 font-mono text-base focus:outline-none font-bold placeholder:font-tajawal placeholder:text-navy-300 text-left"
            dir="ltr"
          />
        )}
      </div>

      {/* النافذة المنسدلة لاختيار الدول */}
      {isOpen && ReactDOM.createPortal(
        <>
          {/* خلفية شفافة لإغلاق النافذة عند الضغط خارجها */}
          <div className="fixed inset-0" style={{ zIndex: 999998 }} onClick={() => setIsOpen(false)} />

          <div className="fixed max-w-sm bg-white rounded-2xl shadow-xl border border-cream-200 p-3 space-y-2.5 font-tajawal max-h-80 overflow-y-auto" style={{ zIndex: 999999, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90vw', maxWidth: '24rem' }}>
            {/* شريط البحث */}
            <div className="relative sticky top-0 bg-white pt-1 pb-2 z-10 border-b border-cream-100">
              <Search className="w-4 h-4 text-navy-400 absolute right-3 top-3.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم الدولة أو الرمز (+966، مصر...)"
                className="w-full pr-9 pl-8 py-2 text-xs bg-cream-50 border border-cream-200 rounded-xl focus:border-gold-500 focus:outline-none font-tajawal"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-3 top-3 text-navy-400 hover:text-navy-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* خيار دولة غير مدرجة / كتابة المفتاح يدوياً */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-1.5">
              <button
                type="button"
                onClick={handleSelectCustomMode}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-right transition-colors hover:bg-amber-100/80 cursor-pointer ${
                  isCustomMode ? 'bg-amber-200/90 font-bold text-amber-950' : 'text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌐</span>
                  <div className="flex flex-col text-right">
                    <span className="font-bold text-xs">دولة غير مدرجة في القائمة</span>
                    <span className="text-[10px] text-amber-800">اكتب الرقم كاملاً مع مفتاح الدولة بنفسك</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-950 font-bold dir-ltr">+رمز الدولة</span>
                  {isCustomMode && <Check className="w-3.5 h-3.5 text-amber-800 shrink-0" />}
                </div>
              </button>
            </div>

            {/* الدول العربية */}
            {filteredArab.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-navy-600 px-2.5 py-1 bg-cream-100/70 rounded-lg mb-1.5 flex items-center justify-between">
                  <span>🇸🇦 جميع الدول العربية (22 دولة)</span>
                  <span className="text-[10px] text-gold-700 font-normal">الوطن العربي</span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {filteredArab.map((c) => (
                    <button
                      key={c.code + c.country}
                      type="button"
                      onClick={() => handleSelectCode(c.code)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs text-right transition-colors hover:bg-gold-50/80 cursor-pointer ${
                        !isCustomMode && c.code === selectedCode ? 'bg-gold-100/90 font-bold text-navy-900' : 'text-navy-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{c.flag}</span>
                        <span>{c.country}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono dir-ltr font-bold text-navy-600">{c.code}</span>
                        {!isCustomMode && c.code === selectedCode && <Check className="w-3.5 h-3.5 text-gold-600" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* دول العالم والاغتراب */}
            {filteredOther.length > 0 && (
              <div className="pt-2 border-t border-cream-100">
                <div className="text-[11px] font-bold text-navy-600 px-2.5 py-1 bg-cream-100/70 rounded-lg mb-1.5">
                  🌐 باقي دول العالم والمغتربين
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {filteredOther.map((c) => (
                    <button
                      key={c.code + c.country}
                      type="button"
                      onClick={() => handleSelectCode(c.code)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs text-right transition-colors hover:bg-gold-50/80 cursor-pointer ${
                        !isCustomMode && c.code === selectedCode ? 'bg-gold-100/90 font-bold text-navy-900' : 'text-navy-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{c.flag}</span>
                        <span>{c.country}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono dir-ltr font-bold text-navy-600">{c.code}</span>
                        {!isCustomMode && c.code === selectedCode && <Check className="w-3.5 h-3.5 text-gold-600" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredArab.length === 0 && filteredOther.length === 0 && (
              <div className="text-center py-4 text-xs text-navy-400 font-tajawal">
                لم يتم العثور على دولة مطابقة للبحث "{search}"
              </div>
            )}
          </div>
        </>,
        document.body
      )}

      {/* تنبيه أو معاينة الرقم المعتمد */}
      {isCustomMode ? (
        <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200/70 font-tajawal">
          <span className="text-base leading-none">💡</span>
          <div className="space-y-0.5">
            <span className="font-bold block">دولة غير مدرجة:</span>
            <span>يرجى كتابة رقم الواتساب كاملاً شاملاً مفتاح الدولة مع علامة (+) مثل: <strong className="font-mono dir-ltr inline-block bg-amber-100 px-1.5 py-0.5 rounded text-amber-950 font-bold">+351 912345678</strong></span>
          </div>
        </div>
      ) : (
        localNumber && (
          <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/60 font-tajawal">
            <span>الرقم المعتمد للواتساب بالتنسيق الدولي:</span>
            <bdi dir="ltr" className="font-mono font-bold tracking-wider text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded inline-block">
              {selectedCode} {localNumber.replace(/^0+/, '')}
            </bdi>
          </div>
        )
      )}
    </div>
  );
}
