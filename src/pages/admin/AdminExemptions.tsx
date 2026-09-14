import { dataService } from '../../lib/data/DataService';
import { useState, useMemo } from 'react';
import { ShieldCheck, Search, CheckCircle2, XCircle, Clock, FileText, AlertCircle, Gift, BadgeCheck, Send } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { useAdminMembers } from '../../lib/useAdminData';

import FilterDropdown from '../../components/admin/FilterDropdown';
import PageHeader from '../../components/admin/PageHeader';
import Modal from '../../components/ui/Modal';
const { adminApplyExemption } = dataService.db;


type ExemptionType = 'deposit' | 'badge';

const exemptionTypeConfig: Record<ExemptionType, { label: string; icon: any; desc: string }> = {
  deposit: { label: 'إعفاء من رسوم الجدية', icon: ShieldCheck, desc: 'منح وسام الجدية مباشرة وتفعيل الطلب مجاناً' },
  badge: { label: 'منح وسام الجدية', icon: BadgeCheck, desc: 'وسام الجدية الدائم في الملف الشخصي' },
};

export default function AdminExemptions() {
  const { exemptRequests, adminProcessExemptRequest, showToast, interestRequests, adminMembers } = useApp();
  const { members } = useAdminMembers();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selected, setSelected] = useState<any | null>(null);
  const [exemptType, setExemptType] = useState<ExemptionType>('deposit');
  const [exemptValue, setExemptValue] = useState<number>(0);
  const [processing, setProcessing] = useState(false);

  const enriched = useMemo(() => {
    return exemptRequests.map((ex: any) => {
      const member = members.find((m) => m.id === ex.userId) || adminMembers.find((m) => m.id === ex.userId);
      const request = interestRequests.find((r: any) => r.id === ex.requestId);
      return { ...ex, member, request };
    });
  }, [exemptRequests, members, interestRequests, adminMembers]);

  const filtered = useMemo(() => {
    return enriched.filter((ex) => {
      const matchSearch =
        !search ||
        ex.userNickname.includes(search) ||
        ex.member?.realName?.includes(search) ||
        ex.reason.includes(search);
      const matchStatus = filterStatus === 'all' || ex.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [enriched, search, filterStatus]);

  const stats = {
    total: exemptRequests.length,
    pending: exemptRequests.filter((e) => e.status === 'pending').length,
    approved: exemptRequests.filter((e) => e.status === 'approved').length,
    rejected: exemptRequests.filter((e) => e.status === 'rejected').length,
  };

  const handleAction = (id: string, action: 'approve' | 'reject') => {
    if (action === 'approve' && selected) {
      // تطبيق الإعفاء الفعلي
      setProcessing(true);
      const memberName = selected.member?.nickname || selected.userNickname || 'عضو';
      adminApplyExemption(selected.userId, exemptType, exemptValue, memberName);
      adminProcessExemptRequest(id, action);
      // إشعار العضو
      const typeCfg = exemptionTypeConfig[exemptType];
      const notifText = `✅ تمت الموافقة على طلب الإعفاء الخاص بك: ${typeCfg.label}${exemptValue > 0 ? ` (${exemptValue})` : ''}. تم تفعيل الأثر فوراً في حسابك.`;
      try {
        // إشعار عبر localStorage
        if (typeof window !== 'undefined') {
          const key = 'twafok_user_notifications_' + selected.userId;
          const existing = JSON.parse(dataService.db.settings.get(key) || '[]');
          existing.unshift({
            id: 'notif-' + Date.now(),
            text: notifText,
            read: false,
            created_at: new Date().toISOString(),
          });
          dataService.db.settings.set(key, JSON.stringify(existing));
        }
      } catch { /* تجاهل */ }
      setProcessing(false);
      setSelected(null);
      showToast(`تمت الموافقة على الإعفاء وتفعيل الأثر (${typeCfg.label}) ✓`, 'success');
    } else {
      adminProcessExemptRequest(id, action);
      setSelected(null);
      showToast(action === 'approve' ? 'تمت الموافقة على طلب الإعفاء' : 'تم رفض طلب الإعفاء', action === 'approve' ? 'success' : 'info');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ShieldCheck}
        title="طلبات الإعفاء والتسهيلات"
        subtitle="مراجعة طلبات الإعفاء وتفعيل الأثر فعلياً (وسام الجدية) + إشعار العضو"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الطلبات', value: stats.total, icon: FileText, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'معلقة', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'مقبولة', value: stats.approved, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'مرفوضة', value: stats.rejected, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${s.bg} rounded-2xl p-3`}>
              <Icon className={`w-5 h-5 ${s.color} mb-1`} />
              <p className={`font-cairo font-extrabold text-2xl ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-500 font-cairo">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالعضو أو سبب الإعفاء..."
            className="w-full pr-12 pl-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterDropdown
            label="الحالة:"
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as typeof filterStatus)}
            options={[
              { value: 'all', label: 'كل الحالات' },
              { value: 'pending', label: 'معلقة', count: stats.pending },
              { value: 'approved', label: 'مقبولة', count: stats.approved },
              { value: 'rejected', label: 'مرفوضة', count: stats.rejected },
            ]}
          />
        </div>
      </div>

      {/* جدول سطح المكتب — بتمرير أفقي آمن يمنع كسر القالب على الشاشات الضيقة */}
      <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['العضو', 'رقم الطلب', 'السبب', 'الحالة', 'إجراء'].map((h) => (
                  <th key={h} className="text-right px-5 py-3 text-xs font-cairo font-bold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${ex.member?.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                        {ex.userNickname.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-cairo font-bold text-slate-900 text-sm truncate">{ex.userNickname}</p>
                        <p className="text-[11px] text-slate-400 font-tajawal truncate">{ex.member?.realName || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 font-mono whitespace-nowrap">{ex.requestId}</td>
                  <td className="px-5 py-3 text-xs text-slate-600 font-tajawal max-w-xs truncate">{ex.reason}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {ex.status === 'pending' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-cairo font-bold bg-amber-100 text-amber-700"><Clock className="w-3 h-3" /> معلق</span>}
                    {ex.status === 'approved' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-cairo font-bold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> مقبول</span>}
                    {ex.status === 'rejected' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-cairo font-bold bg-rose-100 text-rose-700"><XCircle className="w-3 h-3" /> مرفوض</span>}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {ex.status === 'pending' ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelected(ex); setExemptType('deposit'); setExemptValue(0); }} aria-label={`عرض تفاصيل طلب ${ex.userNickname}`} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-cairo font-bold hover:bg-slate-200">عرض</button>
                        <button onClick={() => { setSelected(ex); setExemptType('deposit'); setExemptValue(0); }} aria-label={`قبول طلب ${ex.userNickname}`} className="px-3 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-cairo font-bold hover:bg-emerald-200">قبول</button>
                        <button onClick={() => handleAction(ex.id, 'reject')} aria-label={`رفض طلب ${ex.userNickname}`} className="px-3 py-2 rounded-xl bg-rose-100 text-rose-700 text-xs font-cairo font-bold hover:bg-rose-200">رفض</button>
                      </div>
                    ) : (
                      <button onClick={() => setSelected(ex)} aria-label={`عرض تفاصيل طلب ${ex.userNickname}`} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-cairo font-bold hover:bg-slate-200">عرض التفاصيل</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 font-cairo text-sm">لا توجد طلبات إعفاء مطابقة</p>
          </div>
        )}
      </div>

      {/* بطاقات الجوال — بديل كامل عن الجدول لتفادي أي كسر في القالب على الشاشات الضيقة */}
      <div className="lg:hidden space-y-3">
        {filtered.map((ex) => (
          <div key={ex.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${ex.member?.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                {ex.userNickname.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-cairo font-bold text-slate-900 text-sm truncate">{ex.userNickname}</p>
                <p className="text-[11px] text-slate-400 font-tajawal truncate">{ex.member?.realName || '—'}</p>
              </div>
              {ex.status === 'pending' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-cairo font-bold bg-amber-100 text-amber-700 flex-shrink-0"><Clock className="w-3 h-3" /> معلق</span>}
              {ex.status === 'approved' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-cairo font-bold bg-emerald-100 text-emerald-700 flex-shrink-0"><CheckCircle2 className="w-3 h-3" /> مقبول</span>}
              {ex.status === 'rejected' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-cairo font-bold bg-rose-100 text-rose-700 flex-shrink-0"><XCircle className="w-3 h-3" /> مرفوض</span>}
            </div>
            <p className="text-xs text-slate-600 font-tajawal mb-3 line-clamp-2">{ex.reason}</p>
            {ex.status === 'pending' ? (
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => { setSelected(ex); setExemptType('deposit'); setExemptValue(0); }} aria-label={`عرض تفاصيل طلب ${ex.userNickname}`} className="py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-cairo font-bold hover:bg-slate-200">عرض</button>
                <button onClick={() => { setSelected(ex); setExemptType('deposit'); setExemptValue(0); }} aria-label={`قبول طلب ${ex.userNickname}`} className="py-2 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-cairo font-bold hover:bg-emerald-200">قبول</button>
                <button onClick={() => handleAction(ex.id, 'reject')} aria-label={`رفض طلب ${ex.userNickname}`} className="py-2 rounded-xl bg-rose-100 text-rose-700 text-xs font-cairo font-bold hover:bg-rose-200">رفض</button>
              </div>
            ) : (
              <button onClick={() => setSelected(ex)} aria-label={`عرض تفاصيل طلب ${ex.userNickname}`} className="w-full py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-cairo font-bold hover:bg-slate-200">عرض التفاصيل</button>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 font-cairo text-sm">لا توجد طلبات إعفاء مطابقة</p>
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="تفاصيل طلب الإعفاء">
        {selected && (
          <div className="space-y-4 text-right" dir="rtl">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold ${selected.member?.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                {selected.userNickname.charAt(0)}
              </div>
              <div>
                <h3 className="font-cairo font-bold text-slate-900">{selected.userNickname}</h3>
                <p className="text-xs text-slate-500 font-tajawal">{selected.member?.realName || '—'}</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs text-slate-400 font-cairo mb-1">سبب الإعفاء:</p>
              <p className="text-sm text-slate-800 font-tajawal leading-relaxed">{selected.reason}</p>
            </div>

            {selected.status === 'pending' ? (
              <>
                {/* اختيار نوع الإعفاء */}
                <div>
                  <p className="text-xs font-cairo font-bold text-slate-700 mb-2">اختر نوع الإعفاء لتفعيل أثره:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(exemptionTypeConfig) as ExemptionType[]).map((type) => {
                      const cfg = exemptionTypeConfig[type];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={type}
                          onClick={() => { setExemptType(type); setExemptValue(0); }}
                          className={`p-3 rounded-xl border-2 text-right transition-all ${
                            exemptType === type ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <Icon className={`w-5 h-5 mb-1 ${exemptType === type ? 'text-amber-600' : 'text-slate-400'}`} />
                          <p className="font-cairo font-bold text-xs text-slate-800">{cfg.label}</p>
                          <p className="text-[10px] text-slate-400 font-cairo mt-0.5">{cfg.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* معاينة الأثر */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                  <Gift className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] font-cairo text-blue-800 leading-relaxed">
                    سيتم تفعيل الأثر فوراً: {exemptionTypeConfig[exemptType].label}، وإشعار العضو تلقائياً.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAction(selected.id, 'approve')}
                    disabled={processing}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-100 text-emerald-700 font-cairo font-bold text-sm hover:bg-emerald-200 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" /> قبول وتفعيل
                  </button>
                  <button
                    onClick={() => handleAction(selected.id, 'reject')}
                    disabled={processing}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-rose-100 text-rose-700 font-cairo font-bold text-sm hover:bg-rose-200 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> رفض الطلب
                  </button>
                </div>
              </>
            ) : (
              <div className={`p-4 rounded-xl text-center ${selected.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                <p className="font-cairo font-bold text-sm">تم {selected.status === 'approved' ? 'قبول' : 'رفض'} الطلب من قبل الإدارة</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
