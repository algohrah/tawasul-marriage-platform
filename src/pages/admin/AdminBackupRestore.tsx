import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Shield,
  Layers,
  ArrowRight,
  Sparkles,
  Users,
  Eye,
  Check,
  ChevronDown,
  Info,
  Settings
} from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import {
  createFullSystemBackupData,
  downloadFullSystemBackup,
  restoreFullSystemBackup,
  exportMembersToExcel,
  exportMembersForImportTemplate,
  exportMembersWithFullDetails
} from '../../lib/systemBackup';
import {
  preparePlatformExportedMember,
  createImportBatch,
  getImportOffices,
  parseCSV,
  ImportOffice
} from '../../lib/importBatches';
import { parseCSVRow } from '../../lib/fieldSchema';
import { useApp } from '../../lib/AppContext';
import { dataService } from '../../lib/data/DataService';
import * as XLSX from 'xlsx';
import type { AdminMember } from '../../types/admin';

interface BackupPreviewData {
  counts?: Record<string, number>;
  exportedAt?: string;
  version?: string;
  data?: {
    members?: unknown[];
    customLists?: unknown[];
    offices?: unknown[];
    batches?: unknown[];
    transactions?: unknown[];
    localDb?: { requests?: unknown[] };
    tickets?: unknown[];
  };
}

export default function AdminBackupRestore() {
  const {
    adminMembers,
    customLists,
    createCustomList,
    assignMembersToCustomList,
    importMembers,
    showToast
  } = useApp();

  const [searchParams, setSearchParams] = useSearchParams();
  const rawSection = searchParams.get('section');
  const [activeSection, setActiveSection] = useState<'system-backup' | 'platform-import'>(
    rawSection === 'platform-import' ? 'platform-import' : 'system-backup'
  );

  useEffect(() => {
    if (rawSection === 'platform-import') {
      setActiveSection('platform-import');
    } else if (rawSection === 'system-backup') {
      setActiveSection('system-backup');
    }
  }, [rawSection]);

  const handleSectionChange = (section: 'system-backup' | 'platform-import') => {
    setActiveSection(section);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'backup');
      next.set('section', section);
      return next;
    }, { replace: true });
  };

  // ===== حالة النسخ الاحتياطي الشامل =====
  const [restoring, setRestoring] = useState(false);
  const [previewBackup, setPreviewBackup] = useState<BackupPreviewData | null>(null);
  const [backupFileRaw, setBackupFileRaw] = useState<any>(null);
  const systemFileInputRef = useRef<HTMLInputElement>(null);

  // إحصائيات النظام الحالية للنسخ الاحتياطي
  const stats = useMemo(() => {
    try {
      return createFullSystemBackupData().counts;
    } catch {
      return {
        membersCount: adminMembers?.length || 0,
        officesCount: 0,
        batchesCount: 0,
        transactionsCount: 0,
        requestsCount: 0,
        inquiryMessagesCount: 0,
        customListsCount: customLists?.length || 0,
      };
    }
  }, [adminMembers, customLists]);

  // تصدير النسخة الاحتياطية الشاملة
  const handleExportSystemBackup = () => {
    try {
      downloadFullSystemBackup();
      showToast('تم تحميل ملف النسخة الاحتياطية الشاملة بنجاح ✓', 'success');
    } catch (e) {
      showToast('حدث خطأ أثناء تصدير النسخة الاحتياطية', 'error');
    }
  };

  // اختيار ملف النسخة الاحتياطية الشاملة وفحصه
  const handleSystemFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      showToast('يرجى اختيار ملف بصيغة JSON فقط', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || (typeof parsed !== 'object')) {
          throw new Error('ملف غير صالح');
        }

        setBackupFileRaw(parsed);
        setPreviewBackup({
          counts: parsed.counts,
          exportedAt: parsed.exportedAt,
          version: parsed.version,
          data: parsed.data,
        });
        showToast('تم فحص ملف النسخة الاحتياطية بنجاح ✓', 'success');
      } catch (err) {
        showToast('ملف النسخة الاحتياطية غير صالح أو تالف', 'error');
        setPreviewBackup(null);
        setBackupFileRaw(null);
      }
    };
    reader.readAsText(file);
  };

  // تأكيد واستعادة النسخة الاحتياطية الشاملة
  const handleConfirmSystemRestore = async () => {
    if (!backupFileRaw) return;

    if (!window.confirm('⚠️ تحذير: استعادة النسخة الاحتياطية ستقوم بمطابقة وتحديث كافة بيانات النظام وفق الملف المحدد. هل أنت متأكد من الاستمرار؟')) {
      return;
    }

    setRestoring(true);
    try {
      const result = await restoreFullSystemBackup(backupFileRaw);
      if (result.success) {
        showToast(`تم استعادة النظام بنجاح! تم استرجاع ${result.counts.membersCount} عضو و ${result.counts.transactionsCount} معاملة ✓`, 'success');
        setPreviewBackup(null);
        setBackupFileRaw(null);
        if (systemFileInputRef.current) systemFileInputRef.current.value = '';
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        showToast(`فشلت الاستعادة: ${result.errors.join(', ')}`, 'error');
      }
    } catch (e) {
      showToast('حدث خطأ غير متوقع أثناء استعادة النسخة الاحتياطية', 'error');
    } finally {
      setRestoring(false);
    }
  };

  // ===== حالة استيراد أعضاء المنصة المصدّرين =====
  const [platformFile, setPlatformFile] = useState<File | null>(null);
  const [platformParsedData, setPlatformParsedData] = useState<Record<string, any>[]>([]);
  const [platformHeaders, setPlatformHeaders] = useState<string[]>([]);
  const [platformParsing, setPlatformParsing] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'update' | 'skip' | 'clone'>('update');
  const [selectedCustomListId, setSelectedCustomListId] = useState<string>('');
  const [isCreatingNewCustomList, setIsCreatingNewCustomList] = useState(false);
  const [newCustomListName, setNewCustomListName] = useState('');
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
  const [importingPlatform, setImportingPlatform] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    added: number;
    updated: number;
    skipped: number;
    incomplete: number;
  } | null>(null);

  const officesList: ImportOffice[] = useMemo(() => {
    try {
      return getImportOffices();
    } catch {
      return [];
    }
  }, []);

  // معالجة رفع ملف أعضاء المنصة
  const handlePlatformFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPlatformFile(file);
    setPlatformParsing(true);
    setImportResult(null);

    try {
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.members) ? parsed.members : (parsed.data?.members || [parsed]));
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error('لا توجد سجلات أعضاء صالحة');
        }
        const headersSet = new Set<string>();
        rows.forEach((r: any) => Object.keys(r || {}).forEach(k => headersSet.add(k)));
        setPlatformHeaders(Array.from(headersSet));
        setPlatformParsedData(rows);
        showToast(`تم قراءة ${rows.length} عضو من ملف JSON بنجاح ✓`, 'success');
      } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error('الملف فارغ');
        const sheet = wb.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
        if (!jsonRows || jsonRows.length === 0) throw new Error('لا توجد صفوف بيانات');
        const headersSet = new Set<string>();
        jsonRows.forEach(r => Object.keys(r || {}).forEach(k => headersSet.add(k)));
        setPlatformHeaders(Array.from(headersSet));
        setPlatformParsedData(jsonRows);
        showToast(`تم قراءة ${jsonRows.length} عضو من ملف Excel بنجاح ✓`, 'success');
      } else {
        // CSV / Text
        const text = await file.text();
        const result = parseCSV(text);
        if (result.errors.length > 0 || result.rows.length === 0) {
          throw new Error('خطأ في قراءة ملف CSV');
        }
        const rawData = result.rows.map(row => parseCSVRow(result.headers, row));
        setPlatformHeaders(result.headers);
        setPlatformParsedData(rawData);
        showToast(`تم قراءة ${rawData.length} عضو من ملف CSV بنجاح ✓`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'خطأ في معالجة الملف', 'error');
      setPlatformParsedData([]);
      setPlatformFile(null);
    } finally {
      setPlatformParsing(false);
    }
  };

  // تنفيذ استيراد أعضاء المنصة
  const handleExecutePlatformImport = async () => {
    if (platformParsedData.length === 0) return;

    setImportingPlatform(true);
    try {
      try { await dataService.db.ensureGeoLoaded?.(); } catch { /* ignore */ }

      // إنشاء القائمة المخصصة إن وجدت
      let effectiveCustomListId = selectedCustomListId;
      if (isCreatingNewCustomList && newCustomListName.trim()) {
        const created = createCustomList(newCustomListName.trim(), `أعضاء مصدّرون تم استيرادهم بتاريخ ${new Date().toLocaleDateString('ar-SA')}`, 'amber');
        effectiveCustomListId = created.id;
      }

      // تحضير الأعضاء
      const preparedMembers = platformParsedData.map(row => {
        const member = preparePlatformExportedMember(row, {
          forceNewId: duplicateStrategy === 'clone'
        }) as AdminMember;

        if (selectedOfficeId) {
          const off = officesList.find(o => o.id === selectedOfficeId);
          if (off) {
            member.officeId = off.id;
            member.officeName = off.name;
            member.khataabaName = off.name;
          }
        }

        return member;
      });

      // إسناد القائمة المخصصة
      if (effectiveCustomListId) {
        preparedMembers.forEach(m => {
          const currentLists = Array.isArray(m.customLists) ? m.customLists : [];
          if (!currentLists.includes(effectiveCustomListId)) {
            m.customLists = [...currentLists, effectiveCustomListId];
          }
        });
        assignMembersToCustomList(effectiveCustomListId, preparedMembers.map(m => m.id));
      }

      // معالجة التكرارات والمطابقة
      const existingMembers = adminMembers || [];
      const existingIds = new Set(existingMembers.map(m => m.id));
      const existingUsernames = new Set(existingMembers.map(m => m.username?.toLowerCase()).filter(Boolean));
      const existingPhones = new Set(existingMembers.map(m => (m.phone || (m as any).whatsapp)).filter(Boolean));

      const membersToSave: AdminMember[] = [];
      let updatedCount = 0;
      let addedCount = 0;
      let skippedCount = 0;
      let incompleteCount = 0;

      preparedMembers.forEach(member => {
        if (member.isProfileIncomplete) incompleteCount++;

        const isMatch = duplicateStrategy !== 'clone' && (
          existingIds.has(member.id) ||
          (member.username && existingUsernames.has(member.username.toLowerCase())) ||
          (member.phone && existingPhones.has(member.phone))
        );

        if (isMatch) {
          if (duplicateStrategy === 'update') {
            membersToSave.push(member);
            updatedCount++;
          } else if (duplicateStrategy === 'skip') {
            skippedCount++;
          }
        } else {
          membersToSave.push(member);
          addedCount++;
        }
      });

      if (membersToSave.length > 0) {
        // إنشاء دفعة توثيقية
        const batch = createImportBatch({
          officeId: selectedOfficeId || undefined,
          officeName: officesList.find(o => o.id === selectedOfficeId)?.name || 'استيراد أعضاء المنصة',
          importDate: new Date().toISOString().split('T')[0],
          membersCount: membersToSave.length,
          duplicatesCount: updatedCount,
          skippedCount: skippedCount,
          errorsCount: 0,
          notes: `استيراد ملف منصة مصدّر (${duplicateStrategy}) - غير مكتملين: ${incompleteCount}`,
          sourceType: 'csv',
        });

        membersToSave.forEach(m => { m.importBatchId = batch.id; });

        // حفظ الأعضاء في النظام والموقع العام
        importMembers(membersToSave, false);
      }

      setImportResult({
        total: preparedMembers.length,
        added: addedCount,
        updated: updatedCount,
        skipped: skippedCount,
        incomplete: incompleteCount,
      });

      showToast(`تم استيراد ومعالجة ${membersToSave.length} عضو بنجاح ✓ (جدد: ${addedCount}، تم تحديثهم: ${updatedCount})`, 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء استيراد أعضاء المنصة', 'error');
    } finally {
      setImportingPlatform(false);
    }
  };

  // تفريغ الاستيراد للبدء من جديد
  const handleResetPlatformImport = () => {
    setPlatformFile(null);
    setPlatformParsedData([]);
    setPlatformHeaders([]);
    setImportResult(null);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* رأس الصفحة */}
      <PageHeader
        icon={Database}
        title="النسخ الاحتياطي واستعادة المنصة"
        subtitle="تصدير واستعادة النسخ الاحتياطية الشاملة لكافة بيانات النظام، واستيراد ملفات أعضاء المنصة المصدّرين بدقة تامة"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => exportMembersForImportTemplate([], 'platform_members_template')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-cairo font-bold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              تحميل نموذج أعضاء المنصة (.xlsx)
            </button>
            <button
              onClick={handleExportSystemBackup}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-cairo font-bold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              تصدير نسخة احتياطية كاملة (JSON)
            </button>
          </div>
        }
      />

      {/* التبويبات العلوية داخل الصفحة */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleSectionChange('system-backup')}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-cairo font-bold transition-all cursor-pointer ${
              activeSection === 'system-backup'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Database className="w-4 h-4 text-amber-400" />
            <span>النسخ الاحتياطي الشامل واستعادة النظام</span>
          </button>
          <button
            type="button"
            onClick={() => handleSectionChange('platform-import')}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-cairo font-bold transition-all cursor-pointer ${
              activeSection === 'platform-import'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>استيراد ملفات أعضاء المنصة المصدّرين</span>
          </button>
        </div>
      </div>

      {/* ===== القسم الأول: النسخ الاحتياطي الشامل واستعادة النظام ===== */}
      {activeSection === 'system-backup' && (
        <div className="space-y-6">
          {/* كارت ملخص بيانات النظام الجاهزة للنسخ */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-cairo font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-500" /> النسخة الاحتياطية الشاملة لكافة محتويات المنصة
                </h3>
                <p className="text-xs text-slate-500 font-tajawal mt-1 leading-relaxed">
                  توليد وتنزيل ملف مشفر ومرتب يحفظ كامل بيانات المنصة: الأعضاء والملفات الشخصية، المكاتب والخطابات، الدفعات، المعاملات المالية، طلبات الاهتمام، المحادثات، التذاكر، والقوائم الجغرافية والإعدادات.
                </p>
              </div>
              <button
                onClick={handleExportSystemBackup}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-900 font-cairo font-bold text-sm hover:bg-amber-400 transition-colors shadow-sm flex-shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" /> تنزيل النسخة الشاملة الآن
              </button>
            </div>

            {/* الإحصائيات الحية */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                <div className="font-cairo font-bold text-slate-900 text-lg">{stats.membersCount}</div>
                <div className="text-[11px] text-slate-500 font-tajawal font-medium">عضو مسجل</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                <div className="font-cairo font-bold text-slate-900 text-lg">{stats.officesCount}</div>
                <div className="text-[11px] text-slate-500 font-tajawal font-medium">خطابة ومكتب</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                <div className="font-cairo font-bold text-slate-900 text-lg">{stats.batchesCount}</div>
                <div className="text-[11px] text-slate-500 font-tajawal font-medium">دفعة استيراد</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                <div className="font-cairo font-bold text-slate-900 text-lg">{stats.customListsCount}</div>
                <div className="text-[11px] text-slate-500 font-tajawal font-medium">قائمة مخصصة</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                <div className="font-cairo font-bold text-slate-900 text-lg">{stats.transactionsCount}</div>
                <div className="text-[11px] text-slate-500 font-tajawal font-medium">معاملة مالية</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                <div className="font-cairo font-bold text-slate-900 text-lg">{stats.requestsCount}</div>
                <div className="text-[11px] text-slate-500 font-tajawal font-medium">طلب واهتمام</div>
              </div>
            </div>
          </div>

          {/* كارت استعادة النسخة الاحتياطية الشاملة */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Upload className="w-5 h-5 text-amber-600" />
              <h4 className="font-cairo font-bold text-slate-900 text-base">استعادة نسخة احتياطية سابقة (Full Restore)</h4>
            </div>
            <p className="text-xs text-slate-600 font-tajawal leading-relaxed">
              قم برفع ملف النسخة الاحتياطية الشاملة بصيغة <code>.json</code> المصدّر سابقاً. سيقوم النظام بفحص الملف ومعاينة كافة السجلات بدقة قبل بدء الاستعادة.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <input
                ref={systemFileInputRef}
                type="file"
                accept=".json"
                onChange={handleSystemFileSelect}
                className="hidden"
                id="system-backup-upload-input"
              />
              <label
                htmlFor="system-backup-upload-input"
                className="cursor-pointer flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300 font-cairo font-bold text-xs text-slate-800 transition-colors shadow-xs"
              >
                <FileText className="w-4 h-4 text-amber-500" /> اختيار ملف النسخة الاحتياطية (JSON)
              </label>

              {previewBackup && (
                <button
                  onClick={handleConfirmSystemRestore}
                  disabled={restoring}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-cairo font-bold text-xs hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {restoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  تأكيد واستعادة بيانات النظام بالكامل
                </button>
              )}
            </div>

            {/* معاينة بيانات النسخة بعد الفحص */}
            {previewBackup && (
              <div className="mt-4 p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs font-tajawal space-y-2 text-slate-800 animate-in fade-in duration-200">
                <div className="font-cairo font-bold text-emerald-950 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> تم التحقق من سلامة وبنية ملف النسخة الاحتياطية:
                  </span>
                  {previewBackup.exportedAt && (
                    <span className="text-[11px] text-slate-600 font-mono">تاريخ التصدير: {new Date(previewBackup.exportedAt).toLocaleString('ar-SA')}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-slate-700">
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    • الأعضاء: <span className="font-bold text-slate-900">{previewBackup.counts?.membersCount ?? previewBackup.data?.members?.length ?? 0}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    • القوائم المخصصة: <span className="font-bold text-slate-900">{previewBackup.counts?.customListsCount ?? previewBackup.data?.customLists?.length ?? 0}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    • المكاتب والخطابات: <span className="font-bold text-slate-900">{previewBackup.counts?.officesCount ?? previewBackup.data?.offices?.length ?? 0}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    • الدفعات: <span className="font-bold text-slate-900">{previewBackup.counts?.batchesCount ?? previewBackup.data?.batches?.length ?? 0}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    • المعاملات المالية: <span className="font-bold text-slate-900">{previewBackup.counts?.transactionsCount ?? previewBackup.data?.transactions?.length ?? 0}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    • الاستفسارات والطلبات: <span className="font-bold text-slate-900">{previewBackup.counts?.requestsCount ?? previewBackup.data?.localDb?.requests?.length ?? 0}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    • الشكاوى والتذاكر: <span className="font-bold text-slate-900">{previewBackup.counts?.ticketsCount ?? previewBackup.data?.tickets?.length ?? 0}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    • الإعدادات والجغرافيا: <span className="font-bold text-emerald-700">كاملة وتامة ✓</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* بطاقات التصدير السريع التخصصي */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h4 className="font-cairo font-bold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" /> خيارات التصدير السريع المخصص (Excel & CSV)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                onClick={() => exportMembersToExcel(adminMembers || [], 'tawfok_all_members')}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/30 transition-all text-right cursor-pointer group"
              >
                <div>
                  <div className="font-cairo font-bold text-slate-900 text-xs group-hover:text-emerald-800">تصدير كافة الأعضاء (Excel)</div>
                  <div className="text-[11px] text-slate-500 font-tajawal mt-0.5">ملف إكسل كامل بجميع الحقول (50+ حقل)</div>
                </div>
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 flex-shrink-0 mr-2" />
              </button>

              <button
                onClick={() => exportMembersWithFullDetails(adminMembers || [], 'csv', 'tawfok_all_members')}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-amber-400 bg-slate-50/50 hover:bg-amber-50/30 transition-all text-right cursor-pointer group"
              >
                <div>
                  <div className="font-cairo font-bold text-slate-900 text-xs group-hover:text-amber-800">تصدير كافة الأعضاء (CSV)</div>
                  <div className="text-[11px] text-slate-500 font-tajawal mt-0.5">ملف نصي متوافق مع كافة الأنظمة</div>
                </div>
                <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mr-2" />
              </button>

              <button
                onClick={() => exportMembersForImportTemplate([], 'platform_import_blank_template')}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 transition-all text-right cursor-pointer group"
              >
                <div>
                  <div className="font-cairo font-bold text-slate-900 text-xs group-hover:text-indigo-800">نموذج الاستيراد الفارغ (.xlsx)</div>
                  <div className="text-[11px] text-slate-500 font-tajawal mt-0.5">قالب إكسل مهيأ بالأعمدة والخيارات</div>
                </div>
                <Download className="w-5 h-5 text-indigo-600 flex-shrink-0 mr-2" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== القسم الثاني: استيراد أعضاء المنصة المصدّرين ===== */}
      {activeSection === 'platform-import' && (
        <div className="space-y-6">
          {/* كارت التوجيهات والمعلومات */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-navy-900 rounded-2xl p-6 text-white space-y-4 shadow-md border border-emerald-800/40">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-400/30">
                  <Users className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-cairo font-bold text-base text-emerald-200">
                    استيراد أعضاء المنصة المصدّرين (Platform Export / Restore)
                  </h3>
                  <p className="text-xs text-slate-300 font-tajawal mt-0.5">
                    مخصص لاستيراد ملفات الأعضاء التي تم تصديرها من المنصة سابقاً أو من خلال النسخ الاحتياطي
                  </p>
                </div>
              </div>
              <button
                onClick={() => exportMembersForImportTemplate([], 'platform_members_template')}
                className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-cairo font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" /> تحميل نموذج أعضاء المنصة (.xlsx)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs font-tajawal text-slate-200">
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/10 space-y-1">
                <span className="font-bold text-emerald-300 font-cairo block mb-1">👑 مطابقة تامة لـ 50+ حقل:</span>
                يقرأ المعرفات الأصلية، أسماء المستخدمين، كلمات المرور، باقات الاشتراك، التوثيقات، وتواريخ الانضمام.
              </div>
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/10 space-y-1">
                <span className="font-bold text-emerald-300 font-cairo block mb-1">🛡️ قبول الملفات غير المكتملة:</span>
                يقبل استيراد أي عضو غير مكتمل البيانات ويُعيّن حالته بسلاسة (غير مكتمل) دون إيقاف المعالجة.
              </div>
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/10 space-y-1">
                <span className="font-bold text-emerald-300 font-cairo block mb-1">🔄 مرونة التكرارات والمطابقة:</span>
                إمكانية تحديث بيانات الأعضاء المسجلين أو تخطيهم أو توليد حسابات جديدة بالكامل.
              </div>
            </div>
          </div>

          {/* خيارات الإعداد ومعالجة التكرار */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
            <h4 className="font-cairo font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Settings className="w-4 h-4 text-amber-500" /> إعدادات واستراتيجية استيراد أعضاء المنصة
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* خيار 1: تحديث القائم */}
              <label
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  duplicateStrategy === 'update'
                    ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-cairo font-bold text-xs">تحديث القائم وإضافة الجدد</span>
                  <input
                    type="radio"
                    name="platform-dup-strategy"
                    checked={duplicateStrategy === 'update'}
                    onChange={() => setDuplicateStrategy('update')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] font-tajawal text-slate-500 mt-2">
                  مطابقة العضو برقم المعرف أو الهاتف أو اسم المستخدم وتحديث بياناته، وإضافة الأعضاء الجدد.
                </p>
              </label>

              {/* خيار 2: تخطي المكررات */}
              <label
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  duplicateStrategy === 'skip'
                    ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-cairo font-bold text-xs">تخطي الأعضاء المسجلين مسبقاً</span>
                  <input
                    type="radio"
                    name="platform-dup-strategy"
                    checked={duplicateStrategy === 'skip'}
                    onChange={() => setDuplicateStrategy('skip')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] font-tajawal text-slate-500 mt-2">
                  استيراد الأعضاء الجدد فقط دون التعديل على بيانات الأعضاء الحاليين.
                </p>
              </label>

              {/* خيار 3: توليد معرفات جديدة */}
              <label
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  duplicateStrategy === 'clone'
                    ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-cairo font-bold text-xs">استيراد كحسابات جديدة مستقلة</span>
                  <input
                    type="radio"
                    name="platform-dup-strategy"
                    checked={duplicateStrategy === 'clone'}
                    onChange={() => setDuplicateStrategy('clone')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] font-tajawal text-slate-500 mt-2">
                  توليد معرفات (IDs) جديدة لكافة السجلات لتفادي أي تداخل مع الحسابات القائمة.
                </p>
              </label>
            </div>

            {/* إسناد القوائم المخصصة والمكاتب (اختياري) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="block font-cairo font-bold text-xs text-slate-700">
                  إسناد إلى قائمة مخصصة (اختياري)
                </label>
                <div className="flex items-center gap-2">
                  {!isCreatingNewCustomList ? (
                    <select
                      value={selectedCustomListId}
                      onChange={(e) => setSelectedCustomListId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-tajawal font-medium focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- بدون إسناد لقائمة --</option>
                      {customLists?.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name} ({list.membersCount || 0} عضو)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="اسم القائمة المخصصة الجديدة..."
                      value={newCustomListName}
                      onChange={(e) => setNewCustomListName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50/40 text-xs font-tajawal font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewCustomList(!isCreatingNewCustomList);
                      setNewCustomListName('');
                    }}
                    className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-xs whitespace-nowrap cursor-pointer transition-colors"
                  >
                    {isCreatingNewCustomList ? 'اختيار سابقة' : '+ قائمة جديدة'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-cairo font-bold text-xs text-slate-700">
                  ربط بمكتب أو خطابة (اختياري)
                </label>
                <select
                  value={selectedOfficeId}
                  onChange={(e) => setSelectedOfficeId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-tajawal font-medium focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- بدون ربط بمكتب --</option>
                  {officesList.map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name} {office.phone ? `(${office.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* منطقة رفع الملف */}
          {!platformFile ? (
            <div className="bg-white rounded-2xl p-8 border-2 border-dashed border-slate-200 hover:border-emerald-500 transition-all text-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                onChange={handlePlatformFileUpload}
                className="hidden"
                id="platform-members-file-input"
              />
              <label htmlFor="platform-members-file-input" className="cursor-pointer block">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="font-cairo font-bold text-slate-900 text-base">
                  اضغط لرفع ملف أعضاء المنصة المصدّر
                </h4>
                <p className="text-xs text-slate-500 font-tajawal mt-1">
                  يدعم ملفات Excel (.xlsx, .xls) و CSV و JSON الشاملة
                </p>
              </label>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="font-cairo font-bold text-slate-900 text-sm">
                      الملف المرفوع: <span className="text-emerald-700">{platformFile.name}</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 font-tajawal">
                      تم استخراج {platformParsedData.length} سجل عضو جاهز للاستيراد
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetPlatformImport}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-xs cursor-pointer transition-colors"
                  >
                    تغيير الملف
                  </button>
                  <button
                    onClick={handleExecutePlatformImport}
                    disabled={importingPlatform || platformParsedData.length === 0}
                    className="flex items-center gap-2 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-cairo font-bold text-xs cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                  >
                    {importingPlatform ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    تنفيذ استيراد الأعضاء الآن ({platformParsedData.length})
                  </button>
                </div>
              </div>

              {/* تقرير نتيجة الاستيراد إن وُجد */}
              {importResult && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2 text-xs font-tajawal">
                  <div className="font-cairo font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> تقرير اكتمال الاستيراد:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 pt-1">
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                      • إجمالي الملف: <span className="font-bold text-slate-900">{importResult.total}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                      • تمت إضافتهم كجدد: <span className="font-bold text-emerald-700">{importResult.added}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                      • تم تحديث بياناتهم: <span className="font-bold text-blue-700">{importResult.updated}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                      • تم تخطيهم (تكرار): <span className="font-bold text-slate-500">{importResult.skipped}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* معاينة الجدول */}
              <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs font-tajawal divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 font-cairo font-bold text-slate-700">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">الاسم / المعرف</th>
                      <th className="p-2.5">الجنس</th>
                      <th className="p-2.5">العمر</th>
                      <th className="p-2.5">الدولة والمدينة</th>
                      <th className="p-2.5">الحالة الاجتماعية</th>
                      <th className="p-2.5">الهاتف / الواتساب</th>
                      <th className="p-2.5">اكتمال الملف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {platformParsedData.slice(0, 10).map((row, idx) => {
                      const name = row.realName || row.real_name || row.nickname || row['الاسم الحقيقي'] || row['الاسم المستعار'] || row.name || `عضو #${idx + 1}`;
                      const gender = row.gender === 'male' || row['الجنس'] === 'ذكر' ? 'ذكر' : (row.gender === 'female' || row['الجنس'] === 'أنثى' ? 'أنثى' : '—');
                      const age = row.age || row['العمر'] || '—';
                      const location = [row.country || row['الدولة'], row.city || row['المدينة']].filter(Boolean).join(' - ') || '—';
                      const marital = row.maritalStatus || row.marital_status || row['الحالة الاجتماعية'] || '—';
                      const phone = row.phone || row.whatsapp || row['الهاتف'] || row['الواتساب'] || '—';
                      const isIncomplete = row.isProfileIncomplete || (!row.gender && !row['الجنس']);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2.5 font-cairo font-bold text-slate-900">{name}</td>
                          <td className="p-2.5 text-slate-600">{gender}</td>
                          <td className="p-2.5 text-slate-600">{age}</td>
                          <td className="p-2.5 text-slate-600">{location}</td>
                          <td className="p-2.5 text-slate-600">{marital}</td>
                          <td className="p-2.5 text-slate-600 font-mono">{phone}</td>
                          <td className="p-2.5">
                            {isIncomplete ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-cairo font-bold">غير مكتمل</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-cairo font-bold">مكتمل ✓</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {platformParsedData.length > 10 && (
                <p className="text-[11px] text-slate-500 text-center font-tajawal">
                  يتم عرض أول 10 صفوف من إجمالي {platformParsedData.length} سجل.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
