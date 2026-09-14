import { useState, useMemo } from 'react';
import { CreditCard, Search, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, XCircle, Download, Gift, ShieldCheck, MessageSquare, Gem, Tag, Check, X, Loader2 } from 'lucide-react';
import { type Transaction } from '../../lib/types';
import { dataService } from '../../lib/data/DataService';
import { useApp } from '../../lib/AppContext';
import supabase from '../../lib/supabase';

import FilterDropdown from '../../components/admin/FilterDropdown';
import PageHeader from '../../components/admin/PageHeader';
const getTransactions = () => dataService.db.getTransactions();

/** اعتماد أو رفض معاملة معلّقة (دفع يدوي بنكي/عملات رقمية) — يُفعّل الامتياز الفعلي عند الاعتماد عبر الخادم */
async function reviewTransaction(id: string | number, approve: boolean): Promise<{ ok: boolean; error?: string }> {
  const targetStatus = approve ? 'completed' : 'failed';
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch('/api/transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ id, status: targetStatus }),
    });
    if (!res.ok) {
      const db = dataService.db as { updateTransactionStatus?: (id: string, status: string) => boolean };
      const ok = db.updateTransactionStatus?.(id.toString(), targetStatus);
      if (ok) return { ok: true };
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error || 'تعذّرت العملية' };
    }
    return { ok: true };
  } catch (err: unknown) {
    const db = dataService.db as { updateTransactionStatus?: (id: string, status: string) => boolean };
    const ok = db.updateTransactionStatus?.(id.toString(), targetStatus);
    if (ok) return { ok: true };
    return { ok: false, error: (err as Error)?.message || 'تعذّرت العملية' };
  }
}


const statusConfig = {
  completed: { label: 'ناجح', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  pending: { label: 'معلق', color: 'bg-amber-100 text-amber-700', icon: Clock },
  failed: { label: 'فاشل', color: 'bg-rose-100 text-rose-700', icon: XCircle },
  refunded: { label: 'مسترد', color: 'bg-slate-100 text-slate-600', icon: ArrowUpRight },
};

const methodConfig: Record<string, string> = {
  paypal: 'باي بال',
  crypto: 'عملات رقمية',
  bank: 'تحويل بنكي',
  exemption: 'إعفاء إداري',
};

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  subscription: { label: 'اشتراك', icon: CreditCard, color: 'text-purple-600' },
  deposit: { label: 'رسوم جدية', icon: ShieldCheck, color: 'text-amber-600' },
  inquiry: { label: 'باقة استفسار', icon: MessageSquare, color: 'text-sky-600' },
  final: { label: 'رسوم سعي', icon: Gem, color: 'text-emerald-600' },
  exemption: { label: 'إعفاء/وسام', icon: Gift, color: 'text-blue-600' },
  coupon: { label: 'كوبون', icon: Tag, color: 'text-rose-600' },
};

export default function AdminTransactions() {
  const { showToast } = useApp();
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const res = getTransactions();
    return Array.isArray(res) ? res : [];
  });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | keyof typeof statusConfig>('all');
  const [filterMethod, setFilterMethod] = useState<'all' | string>('all');
  const [filterType, setFilterType] = useState<'all' | string>('all');
  const [reviewingId, setReviewingId] = useState<string | number | null>(null);

  const refresh = () => {
    const res = getTransactions();
    setTransactions(Array.isArray(res) ? res : []);
  };

  const handleReview = async (id: string | number, approve: boolean) => {
    setReviewingId(id);
    const result = await reviewTransaction(id, approve);
    setReviewingId(null);
    if (result.ok) {
      showToast(approve ? 'تم اعتماد المعاملة وتفعيل الامتياز المرتبط بها ✓' : 'تم رفض المعاملة', approve ? 'success' : 'info');
      setTimeout(refresh, 400);
    } else {
      showToast(result.error || 'تعذّرت العملية', 'error');
    }
  };

  const safeTxList = useMemo(() => Array.isArray(transactions) ? transactions : [], [transactions]);

  const filtered = useMemo(() => {
    return safeTxList.filter((t) => {
      if (!t) return false;
      const matchSearch =
        !search ||
        (t.memberName && t.memberName.includes(search)) ||
        (t.description && t.description.includes(search)) ||
        (t.id && String(t.id).includes(search));
      const matchStatus = filterStatus === 'all' || t.status === filterStatus;
      const matchMethod = filterMethod === 'all' || t.method === filterMethod;
      const matchType = filterType === 'all' || t.type === filterType;
      return matchSearch && matchStatus && matchMethod && matchType;
    });
  }, [safeTxList, search, filterStatus, filterMethod, filterType]);

  const stats = useMemo(() => ({
    total: safeTxList.reduce((sum, t) => sum + (t && t.status === 'completed' ? (Number(t.amount) || 0) : 0), 0),
    count: safeTxList.length,
    pending: safeTxList.filter((t) => t && t.status === 'pending').length,
    refunded: safeTxList.filter((t) => t && t.status === 'refunded').reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    deposits: safeTxList.filter((t) => t && t.type === 'deposit' && t.status === 'completed').length,
    exemptions: safeTxList.filter((t) => t && t.type === 'exemption').length,
  }), [safeTxList]);

  const handleExport = () => {
    const headers = ['المعرف', 'العضو', 'الوصف', 'المبلغ', 'الطريقة', 'الحالة', 'التاريخ', 'الكوبون'];
    const rows = filtered.map((t) => [
      t.id,
      t.memberName,
      t.description,
      t.amount,
      methodConfig[t.method] || t.method,
      statusConfig[t.status as keyof typeof statusConfig]?.label || t.status,
      new Date(t.date).toLocaleDateString('ar-SA'),
      t.couponCode || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CreditCard}
        title="المعاملات المالية"
        subtitle="سجل كافة المدفوعات والاشتراكات والإعفاءات — بيانات حقيقية"
        action={
          <button
            onClick={handleExport}
            aria-label="تصدير المعاملات"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-cairo font-semibold text-sm hover:bg-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" /> تصدير ({filtered.length})
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الإيرادات', value: stats.total + ' ر.س', icon: ArrowDownLeft, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'عدد المعاملات', value: stats.count, icon: CreditCard, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'رسوم جدية مدفوعة', value: stats.deposits, icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'إعفاءات/أوسمة', value: stats.exemptions, icon: Gift, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${s.bg} rounded-2xl p-3`}>
              <Icon className={`w-5 h-5 ${s.color} mb-1`} />
              <p className={`font-cairo font-extrabold text-xl ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-500 font-cairo">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالعضو أو الوصف..."
            className="w-full pr-12 pl-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterDropdown
            label="النوع:"
            value={filterType}
            onChange={(v) => setFilterType(v)}
            options={[
              { value: 'all', label: 'كل الأنواع' },
              ...Object.entries(typeConfig).map(([k, v]) => ({ value: k, label: v.label })),
            ]}
          />
          <FilterDropdown
            label="الحالة:"
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as typeof filterStatus)}
            options={[
              { value: 'all', label: 'كل الحالات' },
              ...Object.entries(statusConfig).map(([k, v]) => ({ value: k, label: v.label })),
            ]}
          />
          <FilterDropdown
            label="الطريقة:"
            value={filterMethod}
            onChange={(v) => setFilterMethod(v)}
            options={[
              { value: 'all', label: 'كل الطرق' },
              ...Object.entries(methodConfig).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['المعرف', 'العضو', 'النوع', 'الوصف', 'المبلغ', 'الطريقة', 'الحالة', 'التاريخ', 'إجراء'].map((h) => (
                <th key={h} className="text-right px-4 py-3 text-xs font-cairo font-bold text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((t) => {
              const cfg = statusConfig[t.status as keyof typeof statusConfig] || statusConfig.pending;
              const StatusIcon = cfg.icon;
              const typeCfg = typeConfig[t.type] || typeConfig.subscription;
              const TypeIcon = typeCfg.icon;
              const isReviewing = reviewingId === t.id;
              return (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-[10px] font-mono text-slate-400">{t.id.slice(0, 16)}</td>
                  <td className="px-4 py-3 text-xs font-cairo font-bold text-slate-900">{t.memberName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-cairo font-bold ${typeCfg.color}`}>
                      <TypeIcon className="w-3.5 h-3.5" /> {typeCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-tajawal max-w-xs truncate">
                    {t.description}
                    {t.couponCode && <span className="text-rose-500 mr-1">· {t.couponCode}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-cairo font-bold text-slate-900">
                    {t.amount > 0 ? `${t.amount} ر.س` : <span className="text-emerald-600">مجاناً</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-tajawal">
                    {methodConfig[t.method] || t.method}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-cairo font-bold ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3" /> {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-tajawal">
                    {new Date(t.date).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="px-4 py-3">
                    {t.status === 'pending' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleReview(t.id, true)}
                          disabled={isReviewing}
                          aria-label="اعتماد المعاملة"
                          className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center justify-center transition-colors disabled:opacity-50"
                        >
                          {isReviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleReview(t.id, false)}
                          disabled={isReviewing}
                          aria-label="رفض المعاملة"
                          className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 flex items-center justify-center transition-colors disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center py-10 text-slate-400 font-cairo text-sm">لا توجد معاملات مطابقة</p>
        )}
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {filtered.map((t) => {
          const cfg = statusConfig[t.status as keyof typeof statusConfig] || statusConfig.pending;
          const StatusIcon = cfg.icon;
          const typeCfg = typeConfig[t.type] || typeConfig.subscription;
          const TypeIcon = typeCfg.icon;
          return (
            <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 text-[10px] font-cairo font-bold ${typeCfg.color}`}>
                  <TypeIcon className="w-3.5 h-3.5" /> {typeCfg.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-cairo font-bold ${cfg.color}`}>
                  <StatusIcon className="w-3 h-3" /> {cfg.label}
                </span>
              </div>
              <p className="font-cairo font-bold text-slate-900 text-sm mb-1">{t.memberName}</p>
              <p className="text-xs text-slate-600 font-tajawal mb-2">{t.description}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="font-cairo font-bold text-slate-900">{t.amount > 0 ? `${t.amount} ر.س` : <span className="text-emerald-600">مجاناً</span>}</span>
                <span className="text-slate-400 font-tajawal">{methodConfig[t.method] || t.method} · {new Date(t.date).toLocaleDateString('ar-SA')}</span>
              </div>
              {t.status === 'pending' && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleReview(t.id, true)}
                    disabled={reviewingId === t.id}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-cairo font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    {reviewingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} اعتماد
                  </button>
                  <button
                    onClick={() => handleReview(t.id, false)}
                    disabled={reviewingId === t.id}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 font-cairo font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> رفض
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 font-cairo text-sm">لا توجد معاملات مطابقة</p>
          </div>
        )}
      </div>
    </div>
  );
}
