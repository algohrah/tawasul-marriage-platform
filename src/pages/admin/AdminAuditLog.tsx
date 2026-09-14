import { useState, useMemo, useEffect, useCallback } from 'react';
import { ClipboardList, Search, UserX, CheckCircle2, Trash2, Edit3, ShieldCheck, Flag, RefreshCw, CreditCard, Settings2, MapPin } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import FilterDropdown from '../../components/admin/FilterDropdown';
import PageHeader from '../../components/admin/PageHeader';
import supabase from '../../lib/supabase';

const actionConfig: Record<string, { label: string; icon: any; color: string }> = {
  delete_member: { label: 'حذف عضو', icon: Trash2, color: 'text-red-600 bg-red-50' },
  update_member: { label: 'تعديل عضو', icon: Edit3, color: 'text-amber-600 bg-amber-50' },
  bulk_import_members: { label: 'استيراد جماعي', icon: Edit3, color: 'text-blue-600 bg-blue-50' },
  approve_transaction: { label: 'اعتماد معاملة', icon: CreditCard, color: 'text-emerald-600 bg-emerald-50' },
  reject_transaction: { label: 'رفض معاملة', icon: CreditCard, color: 'text-rose-600 bg-rose-50' },
  verification_approved: { label: 'اعتماد توثيق', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  verification_rejected: { label: 'رفض توثيق', icon: ShieldCheck, color: 'text-rose-600 bg-rose-50' },
  update_setting: { label: 'تعديل إعدادات', icon: Settings2, color: 'text-blue-600 bg-blue-50' },
  delete_setting: { label: 'حذف إعداد', icon: Settings2, color: 'text-rose-600 bg-rose-50' },
  update_admin_user: { label: 'تعديل مشرف', icon: UserX, color: 'text-amber-600 bg-amber-50' },
  add_admin_user: { label: 'إضافة مشرف', icon: UserX, color: 'text-blue-600 bg-blue-50' },
  delete_admin_user: { label: 'حذف مشرف', icon: UserX, color: 'text-red-600 bg-red-50' },
  upsert_coupon: { label: 'كوبون خصم', icon: Edit3, color: 'text-blue-600 bg-blue-50' },
  delete_coupon: { label: 'حذف كوبون', icon: Trash2, color: 'text-rose-600 bg-rose-50' },
  update_report: { label: 'معالجة بلاغ', icon: Flag, color: 'text-purple-600 bg-purple-50' },
  exemption_approved: { label: 'اعتماد إعفاء', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  exemption_rejected: { label: 'رفض إعفاء', icon: ShieldCheck, color: 'text-rose-600 bg-rose-50' },
  delete_request: { label: 'حذف طلب اهتمام', icon: Trash2, color: 'text-red-600 bg-red-50' },
  report: { label: 'معالجة بلاغ (قديم)', icon: Flag, color: 'text-purple-600 bg-purple-50' },
  admin_action: { label: 'إجراء إداري', icon: ShieldCheck, color: 'text-blue-600 bg-blue-50' },
};

function labelFor(action: string) {
  if (actionConfig[action]) return actionConfig[action];
  if (action?.startsWith('journey_')) return { label: `رحلة توافق: ${action.replace('journey_', '')}`, icon: MapPin, color: 'text-teal-600 bg-teal-50' };
  return actionConfig.admin_action;
}

export default function AdminAuditLog() {
  const { reports } = useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [serverLogs, setServerLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/audit-log?limit=300', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'تعذّر تحميل سجل التدقيق');
      }
      const data = await res.json();
      setServerLogs(Array.isArray(data) ? data : []);
    } catch {
      // وضع التخزين المحلي: نعتمد على السجلات الإدارية المحلية
      setServerLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // سجل حقيقي من قاعدة البيانات (audit_logs) — يغطي كل الإجراءات الإدارية الفعلية
  const realLogs = useMemo(() => serverLogs.map((row) => ({
    id: `audit-${row.id}`,
    type: row.action,
    action: row.action,
    target: row.target_id ? `${row.target_type || ''} #${row.target_id}` : (row.target_type || '—'),
    by: row.actor_email || 'غير معروف',
    note: row.details && Object.keys(row.details).length ? JSON.stringify(row.details) : '',
    timestamp: row.created_at,
  })), [serverLogs]);

  // سجلات قديمة مشتقة من البلاغات (للتوافق مع البيانات السابقة قبل تفعيل سجل التدقيق الحقيقي)
  const legacyReportLogs = useMemo(() => {
    const list: any[] = [];
    reports.forEach((r) => {
      (r.actionLog || []).forEach((log: any) => {
        list.push({
          id: `legacy-${log.id}`,
          type: 'report',
          action: 'report',
          target: r.reportedName,
          by: log.by,
          note: log.adminNote,
          timestamp: log.timestamp,
        });
      });
    });
    return list;
  }, [reports]);

  const logs = useMemo(() => {
    return [...realLogs, ...legacyReportLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [realLogs, legacyReportLogs]);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        !search ||
        (log.action || '').includes(search) ||
        (log.target || '').includes(search) ||
        (log.by || '').includes(search);
      const matchType = filterType === 'all' || log.type === filterType || (filterType === 'journey' && log.type?.startsWith('journey_'));
      return matchSearch && matchType;
    });
  }, [logs, search, filterType]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ClipboardList}
        title="سجل التدقيق"
        subtitle="سجل حقيقي بجميع الإجراءات الإدارية على المنصة"
        action={
          <button onClick={fetchLogs} aria-label="تحديث السجل" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-cairo font-bold transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالإجراء أو المسؤول..."
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
              { value: 'update_member', label: 'إجراءات الأعضاء' },
              { value: 'journey', label: 'رحلة التوافق' },
              { value: 'approve_transaction', label: 'المعاملات المالية' },
              { value: 'update_report', label: 'البلاغات' },
              { value: 'report', label: 'بلاغات (سجل قديم)' },
            ]}
          />
        </div>
      </div>

      {/* Logs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-amber-400 mx-auto mb-3 animate-spin" />
            <p className="text-slate-400 font-cairo text-sm">جارٍ تحميل السجل...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-rose-500 font-cairo font-bold text-sm mb-3">{error}</p>
            <button onClick={fetchLogs} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-cairo font-bold">إعادة المحاولة</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['الإجراء', 'الهدف', 'المسؤول', 'ملاحظات', 'التاريخ'].map((h) => (
                    <th key={h} className="text-right px-5 py-3 text-xs font-cairo font-bold text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((log, lIdx) => {
                  const cfg = labelFor(log.type);
                  const Icon = cfg.icon;
                  return (
                    <tr key={`audit-log-${log.id || 'entry'}-${lIdx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-cairo font-bold ${cfg.color}`}>
                          <Icon className="w-3 h-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs font-cairo font-bold text-slate-900 whitespace-nowrap">{log.target}</td>
                      <td className="px-5 py-3 text-xs text-slate-600 font-tajawal whitespace-nowrap">{log.by}</td>
                      <td className="px-5 py-3 text-xs text-slate-500 font-tajawal max-w-xs truncate" title={log.note}>{log.note || '—'}</td>
                      <td className="px-5 py-3 text-xs text-slate-400 font-tajawal whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('ar-SA') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <p className="text-center py-10 text-slate-400 font-cairo text-sm">لا توجد سجلات مطابقة</p>
        )}
      </div>
    </div>
  );
}
