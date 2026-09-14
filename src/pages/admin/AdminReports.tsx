import { useState, useMemo } from 'react';
import { useApp } from '../../lib/AppContext';
import {
  CheckCircle, Trash2, ShieldAlert, Clock, Eye,
  Search, Flag, UserX, MessageSquare, History, Plus, Ban, AlertCircle, Download,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import { motion } from 'framer-motion';
import type { ReportCategory, ReportSeverity } from '../../lib/types';
import FilterDropdown from '../../components/admin/FilterDropdown';
import PageHeader from '../../components/admin/PageHeader';
import { useReviewMarkers } from '../../lib/useReviewMarkers';
import { dataService } from '../../lib/data/DataService';
const getLiveMemberById = (id: string) => dataService.db.getLiveMemberById(id);

const CATEGORY_CONFIG: Record<ReportCategory, { label: string; color: string; icon: string }> = {
  spam: { label: 'حساب وهمي/مزعج', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '🚫' },
  harassment: { label: 'مضايقة أو تحرش', color: 'bg-red-100 text-red-700 border-red-200', icon: '⚠️' },
  fake: { label: 'بيانات كاذبة', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🎭' },
  inappropriate: { label: 'سلوك غير لائق', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: '⛔' },
  other: { label: 'سبب آخر', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: '📋' },
};

const SEVERITY_CONFIG: Record<ReportSeverity, { label: string; color: string; dot: string }> = {
  high: { label: 'خطورة عالية', color: 'bg-red-500 text-white', dot: 'bg-red-500' },
  medium: { label: 'خطورة متوسطة', color: 'bg-amber-500 text-white', dot: 'bg-amber-500' },
  low: { label: 'خطورة منخفضة', color: 'bg-sky-500 text-white', dot: 'bg-sky-500' },
};

export default function AdminReports() {
  const { reports, resolveReport, deleteReport, adminUpdateMemberStatus, adminDeleteMemberFromReports, updateReport, addReportActionLog, showToast, currentAdminName, adminMembers } = useApp();

  const getMemberStatusInfo = (userId?: string, fallbackName?: string) => {
    if (!userId) return { member: null, isDeleted: false, isBanned: false, isSuspended: false, label: fallbackName || 'مجهول' };
    const member = adminMembers.find((m) => m.id === userId) || getLiveMemberById(userId);
    const isDeleted = !member || member.status === 'deleted' || (member as any)?.deleted === true;
    const isBanned = member?.status === 'banned';
    const isSuspended = member?.status === 'suspended';
    const nickname = member?.nickname || member?.realName || member?.name || fallbackName;
    const label = nickname || userId;
    return { member, isDeleted, isBanned, isSuspended, label };
  };
  const { markReviewed, isReviewed, getMark } = useReviewMarkers('twafok_reviewed_reports');
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ReportCategory>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | ReportSeverity>('all');
  const [search, setSearch] = useState('');
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);

  // Detail modal
  const [detailModal, setDetailModal] = useState<string | null>(null);

  // Admin notes modal
  const [notesModal, setNotesModal] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

  // Add action log modal
  const [actionModal, setActionModal] = useState<string | null>(null);
  const [actionText, setActionText] = useState('');

  // Confirmation modal for suspend/ban
  const [confirmAction, setConfirmAction] = useState<{ reportId: string; userId: string; userName: string; action: 'suspend' | 'ban' } | null>(null);

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    const { reportId, userId, userName, action } = confirmAction;
    if (action === 'suspend') {
      handleSuspendUser(reportId, userId, userName);
    } else {
      handleBanUser(reportId, userId, userName);
    }
    setConfirmAction(null);
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchStatus = filter === 'all' || r.status === filter;
      const matchCategory = categoryFilter === 'all' || r.category === categoryFilter;
      const matchSeverity = severityFilter === 'all' || r.severity === severityFilter;
      const matchSearch = !search ||
        r.reporterName.includes(search) ||
        r.reportedName.includes(search) ||
        r.reason.includes(search);
      const matchReviewed = !onlyUnreviewed || !isReviewed(r.id);
      return matchStatus && matchCategory && matchSeverity && matchSearch && matchReviewed;
    });
  }, [reports, filter, categoryFilter, severityFilter, search, onlyUnreviewed, isReviewed]);

  // عدد مرات البلاغ عن كل عضو (لإبراز المخالفين المتكررين)
  const reportCountByMember = useMemo(() => {
    const map: Record<string, number> = {};
    reports.forEach((r) => { if (r.reportedId) map[r.reportedId] = (map[r.reportedId] || 0) + 1; });
    return map;
  }, [reports]);

  const handleSuspendUser = (reportId: string, userId: string, userName: string) => {
    adminUpdateMemberStatus(userId, 'suspended');
    addReportActionLog(reportId, `تم إيقاف حساب ${userName}`, undefined, currentAdminName);
    markReviewed(reportId, currentAdminName);
    showToast(`⛔ تم إيقاف حساب ${userName} بنجاح!`, 'success');
  };

  const handleBanUser = (reportId: string, userId: string, userName: string) => {
    adminUpdateMemberStatus(userId, 'banned');
    addReportActionLog(reportId, `تم حظر حساب ${userName} نهائياً`, undefined, currentAdminName);
    markReviewed(reportId, currentAdminName);
    showToast(`🚫 تم حظر حساب ${userName} نهائياً`, 'success');
  };

  const [deleteUserFor, setDeleteUserFor] = useState<{ reportId: string; userId: string; userName: string } | null>(null);
  const confirmDeleteUser = () => {
    if (!deleteUserFor) return;
    adminDeleteMemberFromReports(deleteUserFor.userId);
    addReportActionLog(deleteUserFor.reportId, `تم حذف حساب ${deleteUserFor.userName} نهائياً`, undefined, currentAdminName);
    resolveReport(deleteUserFor.reportId);
    markReviewed(deleteUserFor.reportId, currentAdminName);
    setDeleteUserFor(null);
  };

  const handleResolve = (id: string) => {
    resolveReport(id);
    addReportActionLog(id, 'تم حل البلاغ', undefined, currentAdminName);
    markReviewed(id, currentAdminName);
  };

  // تصدير البلاغات إلى CSV
  const handleExportReports = () => {
    const headers = ['المعرّف', 'المُبلِغ', 'المخالف', 'النوع', 'الخطورة', 'الحالة', 'السبب', 'التاريخ', 'تمت المراجعة'];
    const rows = filteredReports.map((r) => [
      r.id, r.reporterName || 'مجهول', r.reportedName,
      r.category ? CATEGORY_CONFIG[r.category].label : '—',
      r.severity ? SEVERITY_CONFIG[r.severity].label : '—',
      r.status === 'pending' ? 'معلّق' : 'تم الحل',
      (r.reason || '').replace(/\n/g, ' '),
      new Date(r.timestamp).toLocaleString('ar-SA'),
      isReviewed(r.id) ? `نعم (${getMark(r.id)?.reviewedBy})` : 'لا',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`تم تصدير ${filteredReports.length} بلاغ ✓`, 'success');
  };

  const handleSaveNotes = () => {
    if (!notesModal) return;
    updateReport(notesModal, { adminNotes: notesText });
    addReportActionLog(notesModal, 'تم تحديث الملاحظات الإدارية', notesText, currentAdminName);
    markReviewed(notesModal, currentAdminName);
    showToast('تم حفظ الملاحظات بنجاح ✓', 'success');
    setNotesModal(null);
    setNotesText('');
  };

  const handleAddAction = () => {
    if (!actionModal || !actionText.trim()) return;
    addReportActionLog(actionModal, actionText, undefined, currentAdminName);
    markReviewed(actionModal, currentAdminName);
    showToast('تمت إضافة الإجراء للسجل ✓', 'success');
    setActionModal(null);
    setActionText('');
  };

  const handleSetCategory = (id: string, category: ReportCategory) => {
    updateReport(id, { category });
    showToast('تم تحديث تصنيف البلاغ', 'info');
  };

  const handleSetSeverity = (id: string, severity: ReportSeverity) => {
    updateReport(id, { severity });
    showToast('تم تحديث مستوى الخطورة', 'info');
  };

  const detailReport = reports.find(r => r.id === detailModal);

  // Stats
  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    high: reports.filter(r => r.severity === 'high').length,
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        icon={ShieldAlert}
        title="إدارة بلاغات وشكاوى الأعضاء"
        subtitle="متابعة الشكاوى المقدمة من الأعضاء ضد الحسابات غير الجادة والمخالفة."
        action={
          <div className="flex gap-2 items-center">
            <div className="bg-white rounded-xl px-4 py-2 border border-slate-200 text-center">
              <div className="font-cairo font-black text-lg text-red-500">{stats.pending}</div>
              <div className="text-[10px] text-slate-500 font-tajawal">معلّقة</div>
            </div>
            <div className="bg-white rounded-xl px-4 py-2 border border-slate-200 text-center">
              <div className="font-cairo font-black text-lg text-emerald-500">{stats.resolved}</div>
              <div className="text-[10px] text-slate-500 font-tajawal">تم حلها</div>
            </div>
            <div className="bg-white rounded-xl px-4 py-2 border border-slate-200 text-center">
              <div className="font-cairo font-black text-lg text-orange-500">{stats.high}</div>
              <div className="text-[10px] text-slate-500 font-tajawal">خطورة عالية</div>
            </div>
            <button
              onClick={handleExportReports}
              aria-label="تصدير البلاغات كملف CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-cairo font-semibold text-xs hover:bg-slate-800 transition-colors self-stretch"
            >
              <Download className="w-3.5 h-3.5" /> تصدير CSV
            </button>
          </div>
        }
      />

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المُبلِغ أو المخالف أو محتوى البلاغ..."
            className="w-full pr-12 pl-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm"
          />
        </div>

        {/* فلاتر موحّدة منسدلة — الحالة والنوع والخطورة في صف واحد */}
        <div className="flex flex-wrap gap-2">
          <FilterDropdown
            label="الحالة:"
            value={filter}
            onChange={(v) => setFilter(v as 'all' | 'pending' | 'resolved')}
            options={[
              { value: 'all', label: 'كل البلاغات', count: reports.length },
              { value: 'pending', label: 'معلّقة', count: stats.pending },
              { value: 'resolved', label: 'تم حلها', count: stats.resolved },
            ]}
          />
          <FilterDropdown
            label="النوع:"
            value={categoryFilter}
            onChange={(v) => setCategoryFilter(v as 'all' | ReportCategory)}
            options={(['all', ...Object.keys(CATEGORY_CONFIG)] as ('all' | ReportCategory)[]).map((c) => ({
              value: c,
              label: c === 'all' ? 'كل الأنواع' : `${CATEGORY_CONFIG[c as ReportCategory].icon} ${CATEGORY_CONFIG[c as ReportCategory].label}`,
            }))}
          />
          <FilterDropdown
            label="الخطورة:"
            value={severityFilter}
            onChange={(v) => setSeverityFilter(v as 'all' | 'high' | 'medium' | 'low')}
            options={(['all', 'high', 'medium', 'low'] as const).map((s) => ({
              value: s,
              label: s === 'all' ? 'كل الدرجات' : SEVERITY_CONFIG[s].label,
            }))}
          />
          <button
            onClick={() => setOnlyUnreviewed((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-cairo font-bold transition-colors flex items-center gap-1 border ${
              onlyUnreviewed ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" /> غير المُراجَعة فقط
          </button>
        </div>
      </div>

      {/* Reports list */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
            <CheckCircle className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="font-cairo font-bold text-lg text-slate-900">
            {search ? 'لا توجد نتائج مطابقة' : 'لا يوجد بلاغات متوفرة'}
          </h3>
          <p className="text-xs font-tajawal text-slate-500 max-w-sm">
            {search ? 'جرّب تغيير كلمات البحث أو الفلتر' : 'ممتاز! لم يقم أي عضو بتقديم بلاغات حالياً.'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredReports.map((report) => {
            const cat = report.category ? CATEGORY_CONFIG[report.category] : CATEGORY_CONFIG.other;
            const sev = report.severity ? SEVERITY_CONFIG[report.severity] : SEVERITY_CONFIG.medium;

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-2xl p-5 border transition-all ${
                  report.status === 'pending'
                    ? report.severity === 'high' ? 'border-red-200 hover:border-red-300' : 'border-slate-200 hover:border-slate-300'
                    : 'border-slate-200 opacity-80 hover:opacity-100'
                }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-cairo border ${cat.color}`}>
                        {cat.icon} {cat.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold font-cairo ${sev.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} /> {sev.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold font-cairo ${
                        report.status === 'pending' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {report.status === 'pending' ? <><Clock className="w-3 h-3" /> معلّق</> : <><CheckCircle className="w-3 h-3" /> تم الحل</>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-tajawal">
                      <Clock className="w-3.5 h-3.5 text-slate-300" />
                      <span>{new Date(report.timestamp).toLocaleString('ar-SA')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteReport(report.id)}
                    title="حذف البلاغ"
                    className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Reporter & Reported */}
                {(() => {
                  const reporterInfo = getMemberStatusInfo(report.reporterId, report.reporterName);
                  const reportedInfo = getMemberStatusInfo(report.reportedId, report.reportedName);

                  return (
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3">
                      <div>
                        <span className="block text-[10px] text-slate-400 font-cairo mb-0.5">المُبلِغ:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-cairo font-bold text-xs text-slate-800">{reporterInfo.label}</span>
                          {reporterInfo.isDeleted && (
                            <span className="text-[9px] font-cairo font-black text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.2 rounded">
                              ⚠️ مُحذوف
                            </span>
                          )}
                          {reporterInfo.isBanned && (
                            <span className="text-[9px] font-cairo font-black text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                              ⛔ محظور
                            </span>
                          )}
                          {reporterInfo.isSuspended && (
                            <span className="text-[9px] font-cairo font-black text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.2 rounded">
                              ⚠️ موقوف
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 font-cairo mb-0.5">المخالف:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-cairo font-bold text-xs text-red-700">{reportedInfo.label}</span>
                          {reportedInfo.isDeleted && (
                            <span className="text-[9px] font-cairo font-black text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.2 rounded">
                              ⚠️ مُحذوف
                            </span>
                          )}
                          {reportedInfo.isBanned && (
                            <span className="text-[9px] font-cairo font-black text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                              ⛔ محظور
                            </span>
                          )}
                          {reportedInfo.isSuspended && (
                            <span className="text-[9px] font-cairo font-black text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.2 rounded">
                              ⚠️ موقوف
                            </span>
                          )}
                          {!reportedInfo.isDeleted && (
                            <Link to={`/member/${report.reportedId}`} className="inline-flex p-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors" title="عرض الملف" target="_blank">
                              <Eye className="w-3 h-3" />
                            </Link>
                          )}
                          {reportCountByMember[report.reportedId] > 1 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[9px] font-cairo font-black" title="عضو متكرر البلاغات">
                              <AlertCircle className="w-2.5 h-2.5" /> بُلِّغ {reportCountByMember[report.reportedId]} مرات
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Reason */}
                <div className="mb-3 bg-white p-3 rounded-xl border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-cairo mb-1.5 flex items-center gap-1">
                    <Flag className="w-3 h-3" /> محتوى البلاغ:
                  </span>
                  <p className="text-slate-700 font-tajawal text-xs leading-relaxed font-semibold">"{report.reason}"</p>
                </div>

                {/* Admin notes preview */}
                {report.adminNotes && (
                  <div className="mb-3 bg-amber-50 p-3 rounded-xl border border-amber-100">
                    <span className="block text-[10px] text-amber-700 font-cairo mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> ملاحظات إدارية:
                    </span>
                    <p className="text-slate-600 font-tajawal text-xs leading-relaxed">{report.adminNotes}</p>
                  </div>
                )}

                {/* Action log count */}
                {report.actionLog && report.actionLog.length > 0 && (
                  <button
                    onClick={() => setDetailModal(report.id)}
                    className="mb-3 w-full flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-cairo font-bold">
                      <History className="w-3.5 h-3.5" /> سجل الإجراءات ({report.actionLog.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-cairo">عرض التفاصيل ←</span>
                  </button>
                )}

                {/* شارة المراجعة الدائمة */}
                {isReviewed(report.id) && (
                  <div className="mb-3 flex items-center gap-1.5 text-[10px] font-cairo font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    تمت المراجعة بواسطة {getMark(report.id)?.reviewedBy} · {new Date(getMark(report.id)!.reviewedAt).toLocaleString('ar-SA')}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                  {report.status === 'pending' && (
                    <button
                      onClick={() => handleResolve(report.id)}
                      className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-[11px] transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> حل البلاغ
                    </button>
                  )}
                  {/* إجراءات على المخالف */}
                  <button
                    onClick={() => setConfirmAction({ reportId: report.id, userId: report.reportedId, userName: report.reportedName, action: 'suspend' })}
                    className="py-1.5 px-2 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 font-cairo font-bold text-[11px] transition-colors flex items-center gap-1 border border-orange-200"
                  >
                    <Ban className="w-3.5 h-3.5" /> إيقاف
                  </button>
                  <button
                    onClick={() => setConfirmAction({ reportId: report.id, userId: report.reportedId, userName: report.reportedName, action: 'ban' })}
                    className="py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-cairo font-bold text-[11px] transition-colors flex items-center gap-1"
                  >
                    <UserX className="w-3.5 h-3.5" /> حظر نهائي
                  </button>
                  <button
                    onClick={() => setDeleteUserFor({ reportId: report.id, userId: report.reportedId, userName: report.reportedName })}
                    className="py-1.5 px-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-cairo font-bold text-[11px] transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> حذف الحساب
                  </button>
                  <button
                    onClick={() => { setNotesModal(report.id); setNotesText(report.adminNotes || ''); }}
                    className="py-1.5 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-cairo font-bold text-[11px] transition-colors flex items-center gap-1 border border-amber-200"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> ملاحظات
                  </button>
                  <button
                    onClick={() => setActionModal(report.id)}
                    className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-cairo font-bold text-[11px] transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> إجراء
                  </button>
                  <button
                    onClick={() => setDetailModal(report.id)}
                    className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-cairo font-bold text-[11px] transition-colors flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> تفاصيل
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title="تفاصيل البلاغ وسجل الإجراءات" size="lg">
        {detailReport && (
          <div className="space-y-4 text-right" dir="rtl">
            {/* Category + severity selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 font-cairo mb-1.5">تصنيف البلاغ:</label>
                <select
                  value={detailReport.category || 'other'}
                  onChange={(e) => handleSetCategory(detailReport.id, e.target.value as ReportCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-cairo font-bold text-slate-800 focus:outline-none focus:border-amber-400"
                >
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 font-cairo mb-1.5">مستوى الخطورة:</label>
                <select
                  value={detailReport.severity || 'medium'}
                  onChange={(e) => handleSetSeverity(detailReport.id, e.target.value as ReportSeverity)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-cairo font-bold text-slate-800 focus:outline-none focus:border-amber-400"
                >
                  {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="block text-[10px] text-slate-400 font-cairo mb-0.5">المُبلِغ:</span>
                <span className="font-cairo font-bold text-sm text-slate-800">{detailReport.reporterName}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-cairo mb-0.5">المخالف:</span>
                <span className="font-cairo font-bold text-sm text-red-700">{detailReport.reportedName}</span>
              </div>
            </div>

            {/* Reason */}
            <div className="bg-white p-3 rounded-xl border border-slate-100">
              <span className="block text-[10px] text-slate-400 font-cairo mb-1.5">محتوى البلاغ:</span>
              <p className="text-slate-700 font-tajawal text-sm leading-relaxed font-semibold">"{detailReport.reason}"</p>
            </div>

            {/* Admin notes */}
            {detailReport.adminNotes && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                <span className="block text-[10px] text-amber-700 font-cairo mb-1">ملاحظات إدارية:</span>
                <p className="text-slate-600 font-tajawal text-xs leading-relaxed">{detailReport.adminNotes}</p>
              </div>
            )}

            {/* Action log */}
            <div>
              <h4 className="font-cairo font-bold text-sm text-slate-900 mb-2 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" /> سجل الإجراءات
              </h4>
              <div className="space-y-2">
                {(detailReport.actionLog || []).map((log, i) => (
                  <div key={log.id} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-cairo font-bold text-slate-800">{log.action}</p>
                      {log.adminNote && <p className="text-[11px] text-slate-500 font-tajawal mt-0.5">{log.adminNote}</p>}
                      <p className="text-[10px] text-slate-400 font-tajawal mt-0.5">
                        {log.by} · {new Date(log.timestamp).toLocaleString('ar-SA')}
                      </p>
                    </div>
                  </div>
                ))}
                {(!detailReport.actionLog || detailReport.actionLog.length === 0) && (
                  <p className="text-xs text-slate-400 font-tajawal text-center py-4">لا توجد إجراءات مسجلة</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Admin notes modal */}
      <Modal open={!!notesModal} onClose={() => { setNotesModal(null); setNotesText(''); }} title="ملاحظات إدارية">
        <div className="space-y-4 text-right" dir="rtl">
          <p className="text-xs text-slate-500 font-tajawal">اكتب ملاحظاتك الإدارية الداخلية حول هذا البلاغ:</p>
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="مثال: تم التواصل مع الطرفين، بانتظار التحقق..."
            rows={4}
            className="w-full text-sm font-tajawal p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-amber-400"
            autoFocus
          />
          <button
            onClick={handleSaveNotes}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold text-sm hover:bg-slate-800 transition-colors"
          >
            حفظ الملاحظات
          </button>
        </div>
      </Modal>

      {/* \u062a\u0623\u0643\u064a\u062f \u062d\u0630\u0641 \u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u062e\u0627\u0644\u0641 */}
      <Modal open={!!deleteUserFor} onClose={() => setDeleteUserFor(null)} title="تأكيد حذف الحساب نهائياً">
        {deleteUserFor && (
          <div className="text-center" dir="rtl">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-7 h-7 text-rose-600" />
            </div>
            <p className="font-cairo font-bold text-slate-800 mb-1">حذف حساب «{deleteUserFor.userName}» نهائياً؟</p>
            <p className="text-sm text-slate-500 font-tajawal mb-5">سيُزال الحساب بالكامل من المنصة وسيُحلّ البلاغ تلقائياً. لا يمكن التراجع.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteUserFor(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-cairo font-bold text-sm hover:bg-slate-200 transition-colors">
                إلغاء
              </button>
              <button onClick={confirmDeleteUser}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-cairo font-bold text-sm hover:bg-rose-700 transition-all">
                تأكيد الحذف النهائي
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add action modal */}
      <Modal open={!!actionModal} onClose={() => { setActionModal(null); setActionText(''); }} title="إضافة إجراء للسجل">
        <div className="space-y-4 text-right" dir="rtl">
          <p className="text-xs text-slate-500 font-tajawal">سجّل إجراءً اتخذته بخصوص هذا البلاغ:</p>
          <input
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            placeholder="مثال: تم تنبيه العضو، تم تجميد الحساب..."
            className="w-full text-sm font-tajawal p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-amber-400"
            autoFocus
          />
          <button
            onClick={handleAddAction}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold text-sm hover:bg-slate-800 transition-colors"
          >
            إضافة للسجل
          </button>
        </div>
      </Modal>

      {/* Confirmation modal for suspend/ban */}
      <Modal open={!!confirmAction} onClose={() => setConfirmAction(null)} title="تأكيد الإجراء">
        {confirmAction && (
          <div className="space-y-4 text-right" dir="rtl">
            <div className={`rounded-xl p-4 border ${confirmAction.action === 'ban' ? 'bg-rose-50 border-rose-200' : 'bg-orange-50 border-orange-200'}`}>
              <p className={`text-sm font-cairo leading-relaxed ${confirmAction.action === 'ban' ? 'text-rose-700' : 'text-orange-700'}`}>
                {confirmAction.action === 'ban'
                  ? `🚫 هل أنت متأكد من حظر «${confirmAction.userName}» نهائياً؟ لن يتمكن من الدخول أو الظهور في البحث.`
                  : `⏸️ هل أنت متأكد من إيقاف «${confirmAction.userName}» مؤقتاً؟ سيختفي من البحث ويمكن إعادة تفعيله لاحقاً.`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-cairo font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmAction}
                className={`flex-1 py-3 rounded-xl text-white font-cairo font-bold text-sm transition-colors ${confirmAction.action === 'ban' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-orange-600 hover:bg-orange-700'}`}
              >
                تأكيد {confirmAction.action === 'ban' ? 'الحظر' : 'الإيقاف'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
