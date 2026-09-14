import { dataService } from '../../lib/data/DataService';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeCheck, Search, CheckCircle2, XCircle, Clock, FileCheck, Eye,
  Download, Trash2, FileSpreadsheet, AlertTriangle,
  Loader2, FileText, Image as ImageIcon,
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { useAdminMembers, type AdminMemberRow } from '../../lib/useAdminData';
import Modal from '../../components/ui/Modal';
import FilterDropdown from '../../components/admin/FilterDropdown';
import PageHeader from '../../components/admin/PageHeader';

type VerifStatus = 'pending' | 'verified' | 'rejected';

type VerifMember = AdminMemberRow & {
  verified: boolean;
  verificationStatus: VerifStatus;
};

export default function AdminVerifications() {
  const { adminMembers, showToast } = useApp();
  const { members, toggleVerified } = useAdminMembers();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | VerifStatus>('all');
  const [selected, setSelected] = useState<VerifMember | null>(null);

  // ===== التحديد المتعدد =====
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // نافذة تأكيد الإجراء الجماعي
  const [bulkConfirm, setBulkConfirm] = useState<{ action: 'verify' | 'reject' | 'delete'; label: string } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // ===== حالة التوثيق الحقيقية =====
  const verifStatusMap = useMemo(() => {
    const map: Record<string, VerifStatus> = {};
    if (typeof window !== 'undefined') {
      try {
        const raw = dataService.db.settings.get('twafok_verif_status');
        if (raw) {
          const parsed = JSON.parse(raw);
          Object.assign(map, parsed);
        }
      } catch { /* تجاهل */ }
    }
    return map;
  }, []);

  const saveVerifStatus = (id: string, status: VerifStatus) => {
    if (typeof window === 'undefined') return;
    try {
      const raw = dataService.db.settings.get('twafok_verif_status');
      const map = raw ? JSON.parse(raw) : {};
      map[id] = status;
      dataService.db.settings.set('twafok_verif_status', JSON.stringify(map));
    } catch { /* تجاهل */ }
  };

  const combined = useMemo(() => {
    // جلب خريطة مستندات التوثيق المرفوعة من ملفات الأعضاء الشخصية
    const vdocMap: Record<string, string> = {};
    try {
      const docs = dataService.db.getAllVerificationDocs() || [];
      docs.forEach((d: { memberId?: string; status?: string }) => {
        if (d.memberId && d.status) vdocMap[d.memberId] = d.status;
      });
    } catch { /* تجاهل */ }

    const results: VerifMember[] = [];

    adminMembers.forEach((adminM) => {
      const live = members.find((m) => m.id === adminM.id);
      const isVerified = live?.verified ?? adminM.verified;

      const storedStatus = verifStatusMap[adminM.id];
      const docStatus = vdocMap[adminM.id];

      let finalStatus: VerifStatus | 'none' = 'none';

      if (isVerified) {
        finalStatus = 'verified';
      } else if (storedStatus && (storedStatus as string) !== 'none') {
        finalStatus = storedStatus as VerifStatus;
      } else if (docStatus) {
        if (docStatus === 'approved') finalStatus = 'verified';
        else if (docStatus === 'rejected') finalStatus = 'rejected';
        else if (docStatus === 'pending') finalStatus = 'pending';
      }

      // لا يظهر العضو في قائمة طلبات التوثيق إلا إذا طلب التوثيق من ملفه أو منحه/رفضه الأدمن
      if (finalStatus !== 'none') {
        results.push({ ...adminM, verified: isVerified, verificationStatus: finalStatus as VerifStatus });
      }
    });

    return results;
  }, [adminMembers, members, verifStatusMap]);

  const filtered = useMemo(() => {
    return combined.filter((m) => {
      const matchSearch =
        !search || m.nickname.includes(search) || m.realName.includes(search) || m.email.includes(search);
      const matchStatus = filterStatus === 'all' || m.verificationStatus === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [combined, search, filterStatus]);

  const stats = {
    total: combined.length,
    verified: combined.filter((m) => m.verificationStatus === 'verified').length,
    pending: combined.filter((m) => m.verificationStatus === 'pending').length,
    rejected: combined.filter((m) => m.verificationStatus === 'rejected').length,
  };

  const handleVerify = async (id: string, verified: boolean) => {
    await toggleVerified(id, verified);
    saveVerifStatus(id, verified ? 'verified' : 'rejected');
    showToast(verified ? 'تم التوثيق بنجاح' : 'تم رفض التوثيق', 'success');
  };

  // ===== منطق التحديد المتعدد =====
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((m) => selectedIds.has(m.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        filtered.forEach((m) => next.delete(m.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((m) => next.add(m.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());
  const selectedCount = selectedIds.size;

  // ===== تنفيذ الإجراء الجماعي =====
  const runBulk = async () => {
    if (!bulkConfirm) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { setBulkConfirm(null); return; }
    setBulkBusy(true);
    let okCount = 0;
    for (const id of ids) {
      const stringId = id as string;
      if (bulkConfirm.action === 'verify') {
        await toggleVerified(stringId, true);
        saveVerifStatus(stringId, 'verified');
        okCount++;
      } else if (bulkConfirm.action === 'reject') {
        await toggleVerified(stringId, false);
        saveVerifStatus(stringId, 'rejected');
        okCount++;
      } else if (bulkConfirm.action === 'delete') {
        await toggleVerified(stringId, false);
        saveVerifStatus(stringId, 'rejected');
        okCount++;
      }
    }
    setBulkBusy(false);
    showToast(`تم تطبيق "${bulkConfirm.label}" على ${okCount} عضو ✓`, 'success');
    clearSelection();
    setBulkConfirm(null);
  };

  // ===== تنزيل CSV شامل (صور + معلومات) =====
  const handleExportCSV = (ids?: string[]) => {
    const targetIds = ids || Array.from(selectedIds);
    const targetMembers = targetIds.length > 0
      ? combined.filter((m) => targetIds.includes(m.id))
      : filtered;

    const headers = [
      'المعرّف', 'الاسم المستعار', 'الاسم الحقيقي', 'البريد', 'الهاتف',
      'كلمة المرور', 'الجنس', 'العمر', 'الدولة', 'المدينة', 'المنطقة',
      'الحالة الاجتماعية', 'المؤهل', 'نوع العمل', 'الطول', 'الوزن',
      'لون البشرة', 'الباقة', 'حالة الحساب', 'حالة التوثيق',
      'تاريخ الانضمام', 'عدد الطلبات', 'رابط الصورة',
    ];
    const rows = targetMembers.map((m: VerifMember & Record<string, unknown>) => [
      m.id, m.nickname, m.realName, m.email, m.phone,
      m.password || '—', m.gender === 'male' ? 'ذكر' : 'أنثى', m.age, m.country, m.city, m.district || '—',
      m.maritalStatus || m.marital_status || '—', m.education || '—', m.workType || m.work_type || '—',
      m.height || '—', m.weight || '—', m.skinColor || m.skin_color || '—',
      m.plan, m.status, m.verificationStatus,
      m.joinedAt, m.requestsCount,
      m.avatar || m.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nickname)}&background=C9A961&color=fff`,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verifications-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`تم تصدير ${targetMembers.length} عضو إلى ملف CSV ✓`, 'success');
    if (ids && ids.length > 0) clearSelection();
  };

  // ===== تنزيل Excel (تنسيق CSV متوافق مع Excel) =====
  const handleExportExcel = () => {
    const targetIds = Array.from(selectedIds);
    const targetMembers = targetIds.length > 0
      ? combined.filter((m) => targetIds.includes(m.id))
      : filtered;

    // تنسيق جدول HTML يفتح في Excel مباشرة
    const headers = [
      'المعرّف', 'الاسم المستعار', 'الاسم الحقيقي', 'البريد', 'الهاتف',
      'كلمة المرور', 'الجنس', 'العمر', 'الدولة', 'المدينة', 'المنطقة',
      'الحالة الاجتماعية', 'المؤهل', 'نوع العمل', 'الطول', 'الوزن',
      'لون البشرة', 'الباقة', 'حالة الحساب', 'حالة التوثيق',
      'تاريخ الانضمام', 'عدد الطلبات', 'رابط الصورة',
    ];
    const tableRows = targetMembers.map((m: VerifMember & Record<string, unknown>) => {
      const mStat = m.maritalStatus || m.marital_status || '';
      const mLabel = mStat === 'single' ? (m.gender === 'male' ? 'أعزب' : 'عزباء') : mStat === 'divorced' ? (m.gender === 'male' ? 'مطلق' : 'مطلقة') : ['widow','widower','widowed'].includes(mStat) ? (m.gender === 'male' ? 'أرمل' : 'أرملة') : mStat === 'married' ? 'متزوج' : mStat || '—';
      return `
      <tr>
        <td>${m.id}</td><td>${m.nickname}</td><td>${m.realName}</td><td>${m.email}</td><td>${m.phone}</td>
        <td>${m.password || '—'}</td><td>${m.gender === 'male' ? 'ذكر' : 'أنثى'}</td><td>${m.age}</td>
        <td>${m.country}</td><td>${m.city}</td><td>${m.district || '—'}</td>
        <td>${mLabel}</td><td>${m.education || '—'}</td><td>${m.workType || m.work_type || '—'}</td>
        <td>${m.height || '—'}</td><td>${m.weight || '—'}</td><td>${m.skinColor || m.skin_color || '—'}</td>
        <td>${m.plan}</td><td>${m.status}</td><td>${m.verificationStatus}</td>
        <td>${m.joinedAt}</td><td>${m.requestsCount}</td>
        <td>${m.avatar || m.image || ''}</td>
      </tr>`;
    }).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"><title>طلبات التوثيق</title></head>
      <body dir="rtl">
      <table border="1">
        <thead><tr>${headers.map((h) => `<th style="background:#C9A961;color:#fff;padding:8px;">${h}</th>`).join('')}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      </body></html>`;
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verifications-${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`تم تصدير ${targetMembers.length} عضو إلى ملف Excel ✓`, 'success');
    if (targetIds.length > 0) clearSelection();
  };

  const statusConfig: Record<VerifStatus, { label: string; color: string; dot: string; icon: React.ElementType }> = {
    verified: { label: 'موثق', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle2 },
    pending: { label: 'بانتظار المراجعة', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', icon: Clock },
    rejected: { label: 'مرفوض', color: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500', icon: XCircle },
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BadgeCheck}
        title="طلبات التوثيق"
        subtitle="مراجعة طلبات توثيق الأعضاء والمستندات — مع تحديد جماعي وتصدير"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => handleExportCSV()}
              aria-label="تصدير CSV"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 font-cairo font-semibold text-sm hover:bg-emerald-200 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" /> تصدير CSV ({filtered.length})
            </button>
            <button
              onClick={handleExportExcel}
              aria-label="تصدير Excel"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-cairo font-semibold text-sm hover:bg-slate-800 transition-colors"
            >
              <Download className="w-4 h-4" /> تصدير Excel
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الطلبات', value: stats.total, icon: FileCheck, color: 'text-slate-700', bg: 'bg-slate-50', onClick: () => setFilterStatus('all') },
          { label: 'موثقون', value: stats.verified, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => setFilterStatus('verified') },
          { label: 'بانتظار المراجعة', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', onClick: () => setFilterStatus('pending') },
          { label: 'مرفوضون', value: stats.rejected, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50', onClick: () => setFilterStatus('rejected') },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={s.onClick}
              className={`${s.bg} rounded-2xl p-3 text-right border border-transparent hover:border-slate-200 transition-all`}
            >
              <Icon className={`w-5 h-5 ${s.color} mb-1`} />
              <p className={`font-cairo font-extrabold text-2xl ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-500 font-cairo">{s.label}</p>
            </button>
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
            placeholder="ابحث بالاسم أو البريد..."
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
              { value: 'pending', label: 'بانتظار المراجعة' },
              { value: 'verified', label: 'موثقون' },
              { value: 'rejected', label: 'مرفوضون' },
            ]}
          />
        </div>
      </div>

      {/* شريط الإجراءات الجماعية */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="sticky top-2 z-30 bg-navy-900 text-white rounded-2xl shadow-xl border border-navy-800 px-4 py-3 flex flex-wrap items-center gap-2"
          >
            <span className="font-cairo font-bold text-sm flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-amber-400 text-navy-900 flex items-center justify-center text-xs font-black">{selectedCount}</span>
              عضو محدّد
            </span>
            <div className="h-5 w-px bg-white/20 mx-1" />
            <div className="flex flex-wrap gap-1.5 mr-auto">
              <button
                onClick={() => setBulkConfirm({ action: 'verify', label: 'قبول جماعي' })}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-cairo font-bold flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> قبول جماعي
              </button>
              <button
                onClick={() => setBulkConfirm({ action: 'reject', label: 'رفض جماعي' })}
                className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-cairo font-bold flex items-center gap-1.5 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> رفض جماعي
              </button>
              <button
                onClick={() => handleExportCSV(Array.from(selectedIds))}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-cairo font-bold flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> تنزيل CSV
              </button>
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-cairo font-bold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> تنزيل Excel
              </button>
              <button
                onClick={() => setBulkConfirm({ action: 'delete', label: 'حذف جماعي' })}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-cairo font-bold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> حذف جماعي
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-cairo font-bold transition-colors"
              >
                إلغاء التحديد
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop table */}
      <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                  title="تحديد الكل"
                />
              </th>
              {['العضو', 'البريد', 'الحالة', 'إجراء'].map((h) => (
                <th key={h} className="text-right px-5 py-3 text-xs font-cairo font-bold text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((m) => {
              const cfg = statusConfig[m.verificationStatus as VerifStatus] || statusConfig.pending;
              const StatusIcon = cfg.icon;
              return (
                <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(m.id) ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                      className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          m.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'
                        }`}
                      >
                        {m.nickname.charAt(0)}
                      </div>
                      <div>
                        <p className="font-cairo font-bold text-slate-900 text-sm">{m.nickname}</p>
                        <p className="text-[11px] text-slate-400 font-tajawal">{m.realName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 font-tajawal">{m.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-cairo font-bold ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3" /> {cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelected(m)}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                        title="عرض المستندات"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {m.verificationStatus !== 'verified' ? (
                        <button
                          onClick={() => handleVerify(m.id, true)}
                          className="w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-emerald-600"
                          title="قبول التوثيق"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerify(m.id, false)}
                          className="w-8 h-8 rounded-lg bg-rose-100 hover:bg-rose-200 flex items-center justify-center text-rose-600"
                          title="إلغاء التوثيق"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 font-cairo text-sm">لا توجد طلبات مطابقة</p>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-slate-200">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs font-cairo font-bold text-slate-700"
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
            />
            تحديد الكل
          </button>
          {selectedCount > 0 && (
            <button
              onClick={() => handleExportCSV()}
              className="text-xs font-cairo font-bold text-emerald-600"
            >
              تنزيل ({selectedCount})
            </button>
          )}
        </div>
        {filtered.map((m) => {
          const cfg = statusConfig[m.verificationStatus as VerifStatus] || statusConfig.pending;
          const StatusIcon = cfg.icon;
          return (
            <div key={m.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${selectedIds.has(m.id) ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(m.id)}
                  onChange={() => toggleSelect(m.id)}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer flex-shrink-0"
                />
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold ${m.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                  {m.nickname.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-cairo font-bold text-slate-900 text-sm">{m.nickname}</p>
                  <p className="text-[11px] text-slate-400 font-tajawal">{m.realName} · {m.email}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-cairo font-bold ${cfg.color}`}>
                  <StatusIcon className="w-3 h-3" /> {cfg.label}
                </span>
              </div>
              <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelected(m)}
                  className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-cairo font-bold text-[11px] flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> عرض
                </button>
                {m.verificationStatus !== 'verified' ? (
                  <button
                    onClick={() => handleVerify(m.id, true)}
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-600 font-cairo font-bold text-[11px] flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> قبول
                  </button>
                ) : (
                  <button
                    onClick={() => handleVerify(m.id, false)}
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-600 font-cairo font-bold text-[11px] flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" /> إلغاء
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 font-cairo text-sm">لا توجد طلبات مطابقة</p>
          </div>
        )}
      </div>

      {/* نافذة تأكيد الإجراء الجماعي */}
      <Modal open={!!bulkConfirm} onClose={() => setBulkConfirm(null)} title="تأكيد الإجراء الجماعي">
        {bulkConfirm && (
          <div className="space-y-4 text-right" dir="rtl">
            <div className="text-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                bulkConfirm.action === 'verify' ? 'bg-emerald-100' :
                bulkConfirm.action === 'reject' ? 'bg-orange-100' : 'bg-rose-100'
              }`}>
                {bulkConfirm.action === 'verify' ? <CheckCircle2 className="w-7 h-7 text-emerald-600" /> :
                 bulkConfirm.action === 'reject' ? <XCircle className="w-7 h-7 text-orange-600" /> :
                 <Trash2 className="w-7 h-7 text-rose-600" />}
              </div>
              <p className="font-cairo font-bold text-slate-800 mb-1">
                تطبيق «{bulkConfirm.label}» على <span className="text-amber-600">{selectedCount}</span> عضو؟
              </p>
              <p className="text-sm text-slate-500 font-tajawal mb-4">
                {bulkConfirm.action === 'delete'
                  ? 'سيتم رفض توثيق الأعضاء المحددين وحذف طلباتهم. لا يمكن التراجع عن هذا الإجراء.'
                  : 'سيتم تطبيق الإجراء على جميع الأعضاء المحددين دفعة واحدة.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setBulkConfirm(null)}
                disabled={bulkBusy}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-cairo font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={runBulk}
                disabled={bulkBusy}
                className={`flex-1 py-3 rounded-xl text-white font-cairo font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  bulkConfirm.action === 'verify' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  bulkConfirm.action === 'reject' ? 'bg-orange-600 hover:bg-orange-700' :
                  'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                تأكيد الإجراء
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Document preview modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="مراجعة مستندات التوثيق" size="lg">
        {selected && (
          <div className="space-y-4 text-right" dir="rtl">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold ${
                  selected.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'
                }`}
              >
                {selected.nickname.charAt(0)}
              </div>
              <div>
                <h3 className="font-cairo font-bold text-slate-900">{selected.nickname}</h3>
                <p className="text-xs text-slate-500 font-tajawal">{selected.realName}</p>
              </div>
            </div>

            {/* معلومات العضو */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h4 className="font-cairo font-bold text-sm text-slate-800 mb-3 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-500" /> معلومات العضو
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-slate-400">البريد:</span> <span className="font-cairo font-bold text-slate-700">{selected.email}</span></div>
                <div><span className="text-slate-400">الهاتف:</span> <span className="font-cairo font-bold text-slate-700">{selected.phone || '—'}</span></div>
                <div><span className="text-slate-400">العمر:</span> <span className="font-cairo font-bold text-slate-700">{selected.age} سنة</span></div>
                <div><span className="text-slate-400">المدينة:</span> <span className="font-cairo font-bold text-slate-700">{selected.city}</span></div>
                <div><span className="text-slate-400">الجنس:</span> <span className="font-cairo font-bold text-slate-700">{selected.gender === 'male' ? 'ذكر' : 'أنثى'}</span></div>
                <div><span className="text-slate-400">الباقة:</span> <span className="font-cairo font-bold text-slate-700">{selected.plan}</span></div>
              </div>
            </div>

            {/* مستندات التوثيق — معاينة */}
            <div>
              <h4 className="font-cairo font-bold text-sm text-slate-800 mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-500" /> المستندات المرفقة
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {['الهوية الوطنية', 'إثبات الحالة الاجتماعية', 'صورة شخصية'].map((doc, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                    <div className="aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                    </div>
                    <div className="p-2 text-center">
                      <p className="text-[10px] font-cairo font-bold text-slate-600">{doc}</p>
                      <button
                        onClick={() => showToast('سيتم توفير رفع المستندات الفعلي في الإصدار القادم', 'info')}
                        className="text-[9px] text-amber-600 font-cairo font-bold mt-1 hover:underline"
                      >
                        رفع مستند
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] font-cairo text-blue-800 leading-relaxed">
                راجع المستندات بعناية قبل القبول. التوثيق يمنح العضو وسام التوثيق ويزيد ثقة الأعضاء الآخرين به.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  handleVerify(selected.id, true);
                  setSelected(null);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 font-cairo font-bold text-sm hover:bg-emerald-200 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" /> قبول التوثيق
              </button>
              <button
                onClick={() => {
                  handleVerify(selected.id, false);
                  setSelected(null);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-100 text-rose-700 font-cairo font-bold text-sm hover:bg-rose-200 transition-colors"
              >
                <XCircle className="w-4 h-4" /> رفض التوثيق
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
