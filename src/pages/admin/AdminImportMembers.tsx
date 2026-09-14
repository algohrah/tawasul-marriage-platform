import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, Clipboard, CheckCircle2, AlertCircle, XCircle,
  Users, Building2, Calendar, Hash, StickyNote, Download, Eye, EyeOff,
  ChevronDown, ChevronUp, RefreshCw, Trash2, Plus, Search, Loader2,
  FileDown, Table, AlertTriangle, Info, Sparkles, Ban, BadgeCheck,
  Copy, FileText, GitMerge, Globe, MapPin, ArrowRight, ArrowLeft, ShieldCheck, Filter, Database,
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import Modal from '../../components/ui/Modal';
import {
  REGISTRATION_FIELDS, getCSVFields, generateCSVTemplate, generateSimpleCSVTemplate,
  generateAiImportPrompt,
  IMPORT_REQUIRED_COLUMNS, IMPORT_COLUMN_LABELS,
  parseCSVRow, validateField, parseCSVValue, FieldDefinition,
} from '../../lib/fieldSchema';
import {
  getImportOffices, addImportOffice, getImportOfficeById,
  getImportBatches, createImportBatch, generateBatchNumber, parseCSV, parsePastedData,
  checkDuplicates, prepareImportedMember, createImportReport,
  upsertKhataabaRecord, isKhataabaBlocked,
  ImportOffice, ImportBatch, ImportReport, ImportError, ImportWarning,
} from '../../lib/importBatches';
import {
  getCustomLists, createCustomList, assignMembersToCustomList, CustomMemberList
} from '../../lib/customLists';
import type { AdminMember } from '../../lib/admin-data';
import { dataService } from '../../lib/data/DataService';
import PageHeader from '../../components/admin/PageHeader';
import {
  exportMembersWithFullDetails,
  exportMembersToExcel,
  exportKhataabaBlankTemplateToExcel,
} from '../../lib/systemBackup';

type ImportMethod = 'csv' | 'paste';
type ImportStep = 'setup' | 'upload' | 'preview' | 'validate' | 'result';

export default function AdminImportMembers() {
  const { adminMembers, setAdminMembers, importMembers, showToast: contextToast } = useApp();
  const navigate = useNavigate();
  
  // تبويب الواجهة الرئيسي: استيراد أم تصدير
  const [activeMainTab, setActiveMainTab] = useState<'import' | 'export'>('import');

  // فلاتر التصدير
  const [exportScope, setExportScope] = useState<'all' | 'imported' | 'registered'>('all');
  const [exportGender, setExportGender] = useState<'all' | 'male' | 'female'>('all');
  const [exportBatchId, setExportBatchId] = useState<string>('all');
  const [exportOfficeName, setExportOfficeName] = useState<string>('all');
  const [exportCustomListId, setExportCustomListId] = useState<string>('all');
  const [exportFormatMode, setExportFormatMode] = useState<'full' | 'import_template'>('full');
  const [allBatches, setAllBatches] = useState<ImportBatch[]>([]);

  // ===== الحالات =====
  const [step, setStep] = useState<ImportStep>('setup');
  const [method, setMethod] = useState<ImportMethod>('csv');
  
  // بيانات إدارية
  const [officeMode, setOfficeMode] = useState<'new' | 'existing' | 'none'>('none');
  const [newOfficeName, setNewOfficeName] = useState('');
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchNumberPreview, setBatchNumberPreview] = useState('');
  const [importNotes, setImportNotes] = useState('');
  
  // القوائم المخصصة للدفعة
  const [customLists, setCustomLists] = useState<CustomMemberList[]>([]);
  const [selectedCustomListId, setSelectedCustomListId] = useState<string>('');
  const [newCustomListName, setNewCustomListName] = useState<string>('');
  const [isCreatingNewCustomList, setIsCreatingNewCustomList] = useState<boolean>(false);
  
  useEffect(() => {
    setBatchNumberPreview(generateBatchNumber());
    setCustomLists(getCustomLists());
    setAllBatches(getImportBatches());
  }, []);

  // تصفية الأعضاء المحددين للتصدير
  const exportFilteredMembers = useMemo(() => {
    return (adminMembers || []).filter((m) => {
      const hasBatch = Boolean(m.batchNumber || m.batch_number || m.batchId);
      if (exportScope === 'imported' && !hasBatch) return false;
      if (exportScope === 'registered' && hasBatch) return false;
      if (exportGender !== 'all' && m.gender !== exportGender) return false;
      if (exportBatchId !== 'all') {
        const b = m.batchNumber || m.batch_number || m.batchId;
        if (b !== exportBatchId) return false;
      }
      if (exportOfficeName !== 'all') {
        const o = m.officeName || m.office_name || m.khataabaName;
        if (o !== exportOfficeName) return false;
      }
      if (exportCustomListId !== 'all') {
        const lists = Array.isArray(m.customLists) ? m.customLists : (m.customList ? [m.customList] : []);
        if (!lists.includes(exportCustomListId)) return false;
      }
      return true;
    });
  }, [adminMembers, exportScope, exportGender, exportBatchId, exportOfficeName, exportCustomListId]);
  
  // البيانات
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  
  // التحقق
  const [validationErrors, setValidationErrors] = useState<ImportError[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ImportWarning[]>([]);
  const [duplicates, setDuplicates] = useState<Record<string, any>[]>([]);
  const [uniqueData, setUniqueData] = useState<Record<string, any>[]>([]);
  const [replaceMode, setReplaceMode] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showAllPreviewRows, setShowAllPreviewRows] = useState(false);

  // مطابقة الأعمدة والتعديل اللحظي
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRowData, setEditingRowData] = useState<Record<string, any> | null>(null);
  
  // النتيجة
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [createdBatch, setCreatedBatch] = useState<ImportBatch | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // ===== القالب الموحد وتوجيه الذكاء الاصطناعي الشامل =====
  const [showAiPromptModal, setShowAiPromptModal] = useState(false);
  const [aiPromptCopied, setAiPromptCopied] = useState(false);
  const [aiPromptFormat, setAiPromptFormat] = useState<'csv' | 'json'>('csv');

  // يُولَّد تلقائياً من خيارات المنصة الحقيقية (fieldSchema) فلا يتعارض معها أبداً
  const MASTER_UNIFIED_AI_PROMPT = useMemo(() => {
    return generateAiImportPrompt(aiPromptFormat);
  }, [aiPromptFormat]);

  const copyAiPrompt = async () => {
    const promptText = generateAiImportPrompt(aiPromptFormat);
    try {
      await navigator.clipboard.writeText(promptText);
      setAiPromptCopied(true);
      localToast(`تم نسخ توجيه الذكاء الاصطناعي بصيغة (${aiPromptFormat === 'csv' ? 'CSV' : 'JSON'}) بنجاح ✓`, 'success');
      setTimeout(() => setAiPromptCopied(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = promptText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setAiPromptCopied(true);
      localToast(`تم نسخ توجيه الذكاء الاصطناعي بصيغة (${aiPromptFormat === 'csv' ? 'CSV' : 'JSON'}) بنجاح ✓`, 'success');
      setTimeout(() => setAiPromptCopied(false), 3000);
    }
  };
  
  // الخطابات والدفعات — قوائم حية تتحدث بعد الإضافة/الاستيراد مباشرة
  const [offices, setOffices] = useState<ImportOffice[]>(() => getImportOffices());
  const [batches, setBatches] = useState<ImportBatch[]>(() => getImportBatches());
  const refreshOfficesAndBatches = useCallback(() => {
    setOffices(getImportOffices());
    setBatches(getImportBatches());
  }, []);
  
  // ===== دوال =====
  
  const localToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    contextToast(msg, type);
  }, [contextToast]);
  
  // المواقع غير المسجلة والمراجعة
  interface UnknownGeoItem {
    id: string;
    type: 'country' | 'city';
    name: string;
    country?: string;
    action: 'add' | 'merge' | 'ignore';
    targetName: string;
  }
  const [geoUnknownList, setGeoUnknownList] = useState<UnknownGeoItem[]>([]);

  // تحميل قالب CSV
  const downloadTemplate = () => {
    const template = generateCSVTemplate();
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tawfok_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    localToast('تم تحميل القالب الشامل ✓', 'success');
  };

  // تحميل نموذج الخطابات والمكاتب (Excel)
  const downloadKhataabaTemplate = () => {
    exportKhataabaBlankTemplateToExcel('khataaba_members_template');
    localToast('تم تحميل نموذج الخطابات والمكاتب (Excel) ✓', 'success');
  };

  // تحميل النموذج المبسط والسهل (CSV)
  const downloadSimpleTemplate = () => {
    const template = generateSimpleCSVTemplate();
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tawfok_simple_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    localToast('تم تحميل النموذج المبسط والسهل ✓', 'success');
  }; 
  
  // الحصول على القيمة المناسبة للعرض في جدول المعاينة
  const getDisplayCellVal = (row: Record<string, any>, header: string): string => {
    if (!row) return '—';
    // 1. القيمة المباشرة من المفتاح
    if (row[header] !== undefined && row[header] !== null && String(row[header]).trim() !== '') {
      return String(row[header]).trim();
    }
    // 2. البحث عبر تعريف الحقول
    const lowerHeader = header.toLowerCase().trim();
    const field = REGISTRATION_FIELDS.find(f => 
      f.label === header || 
      f.key === header || 
      f.csvColumn === header ||
      (f.labelEn && f.labelEn.toLowerCase() === lowerHeader) ||
      (f.csvColumn && f.csvColumn.toLowerCase() === lowerHeader)
    );

    if (field && row[field.key] !== undefined && row[field.key] !== null && String(row[field.key]).trim() !== '') {
      const val = row[field.key];
      if (field.key === 'gender') {
        return val === 'male' ? 'ذكر' : val === 'female' ? 'أنثى' : String(val);
      }
      return String(val).trim();
    }

    // 3. الترادفات الشائعة
    if (['real_name', 'realname', 'الاسم الحقيقي', 'الاسم الكامل', 'الاسم الرباعي', 'اسم العضو'].includes(lowerHeader)) {
      const val = row.realName || row.real_name || row['الاسم الحقيقي'] || row['الاسم الكامل'];
      if (val) return String(val).trim();
    }
    if (['nickname', 'الاسم المستعار', 'اللقب', 'القبيلة', 'الاسم'].includes(lowerHeader)) {
      const val = row.nickname || row['الاسم المستعار'] || row.name || row['الاسم'];
      if (val) return String(val).trim();
    }
    if (['gender', 'الجنس', 'الجنيس'].includes(lowerHeader)) {
      const val = row.gender || row['الجنس'] || row['الجنيس'];
      if (val) return val === 'male' ? 'ذكر' : val === 'female' ? 'أنثى' : String(val);
    }
    if (['p_notes', 'pnotes', 'partner_notes', 'مواصفات الشريك', 'شروط الشريك', 'شروطي'].includes(lowerHeader)) {
      const val = row.pNotes || row.p_notes || row.partner_notes || row['مواصفات الشريك'];
      if (val) return String(val).trim();
    }
    if (['bio', 'نبذة', 'مواصفاتي', 'المواصفات', 'ملاحظات'].includes(lowerHeader)) {
      const val = row.bio || row['نبذة'] || row['مواصفاتي'] || row['ملاحظات'];
      if (val) return String(val).trim();
    }
    if (['password', 'pass', 'كلمة المرور', 'كلمة السر', 'الرمز السري', 'الباسورد', 'رمز المرور'].includes(lowerHeader)) {
      const val = row.password || row.pass || row['كلمة المرور'] || row['كلمة السر'];
      if (val) return '••••••';
    }

    return '—';
  };

  // تصفية الصفوف الخالية تماماً (أي صف يحتوي على أي قيمة في أي حقل)
  const filterMeaningfulRows = (rowsData: Record<string, any>[]) => {
    return rowsData.filter((row) => {
      if (!row || typeof row !== 'object') return false;
      const keys = Object.keys(row).filter(k => k !== 'row' && k !== 'index');
      return keys.some(k => {
        const val = row[k];
        return val !== undefined && val !== null && String(val).trim() !== '';
      });
    });
  };

  // الكشف التلقائي عن مطابقة الأعمدة المرفوعة مع حقول المنصة الرسمية
  const autoDetectColumnMapping = (headers: string[]) => {
    const mapping: Record<string, string> = {};
    headers.forEach(h => {
      const lower = h.toLowerCase().trim();
      if (['gender', 'الجنس', 'الجنيس'].includes(lower)) mapping[h] = 'gender';
      else if (['age', 'العمر', 'سن', 'السن'].includes(lower)) mapping[h] = 'age';
      else if (['country', 'الدولة', 'بلد الإقامة', 'بلد الاقامة'].includes(lower)) mapping[h] = 'country';
      else if (['city', 'المدينة', 'منطقة السكن'].includes(lower)) mapping[h] = 'city';
      else if (['district', 'الحي', 'المنطقة'].includes(lower)) mapping[h] = 'district';
      else if (['nationality', 'الجنسية'].includes(lower)) mapping[h] = 'nationality';
      else if (['marriage_type', 'marriagetype', 'نوع الزواج'].includes(lower)) mapping[h] = 'marriage_type';
      else if (['tribe', 'القبيلة', 'القبيلة / النسب', 'النسب', 'العائلة'].includes(lower)) mapping[h] = 'tribe';
      else if (['marital_status', 'maritalstatus', 'الحالة الاجتماعية'].includes(lower)) mapping[h] = 'marital_status';
      else if (['sect', 'المذهب'].includes(lower)) mapping[h] = 'sect';
      else if (['height', 'الطول'].includes(lower)) mapping[h] = 'height';
      else if (['weight', 'الوزن'].includes(lower)) mapping[h] = 'weight';
      else if (['skin_color', 'skincolor', 'لون البشرة', 'البشرة'].includes(lower)) mapping[h] = 'skin_color';
      else if (['education', 'المؤهل', 'المؤهل العلمي', 'التعليم'].includes(lower)) mapping[h] = 'education';
      else if (['work_type', 'worktype', 'نوع العمل', 'العمل', 'قطاع العمل'].includes(lower)) mapping[h] = 'work_type';
      else if (['job_title', 'jobtitle', 'الوظيفة', 'المسمى الوظيفي'].includes(lower)) mapping[h] = 'job_title';
      else if (['housing', 'السكن', 'نوع السكن'].includes(lower)) mapping[h] = 'housing';
      else if (['partner_country', 'partnercountry', 'دولة الشريك', 'بلد الشريك', 'الدولة المطلوبة'].includes(lower)) mapping[h] = 'partner_country';
      else if (['partner_nationality', 'partnernationality', 'جنسية الشريك', 'جنسية الشريك المطلوب', 'الجنسية المطلوبة'].includes(lower)) mapping[h] = 'partner_nationality';
      else if (['partner_cities', 'partner_city', 'partnercities', 'مدن الشريك', 'المدن المقبولة للشريك', 'مدينة الشريك', 'المدينة المطلوبة'].includes(lower)) mapping[h] = 'partner_cities';
      else if (['partner_age_min', 'partneragemin', 'عمر الشريك من', 'العمر من', 'أدنى عمر للشريك'].includes(lower)) mapping[h] = 'partner_age_min';
      else if (['partner_age_max', 'partneragemax', 'عمر الشريك إلى', 'العمر إلى', 'أعلى عمر للشريك'].includes(lower)) mapping[h] = 'partner_age_max';
      else if (['partner_marital_status', 'حالة الشريك الاجتماعية', 'الحالة الاجتماعية المطلوبة للشريك'].includes(lower)) mapping[h] = 'partner_marital_status';
      else if (['accept_foreigner', 'acceptforeigner', 'قبول أجنبي', 'قبول غير مواطن', 'قبول غير مواطن / أجنبي'].includes(lower)) mapping[h] = 'accept_foreigner';
      else if (['smoking', 'التدخين', 'مدخن'].includes(lower)) mapping[h] = 'smoking';
      else if (['health', 'الصحة', 'الحالة الصحية'].includes(lower)) mapping[h] = 'health';
      else if (['ethnicity', 'العرق', 'الأصل', 'القومية', 'الأصل والعرق'].includes(lower)) mapping[h] = 'ethnicity';
      else if (['children_count', 'childrencount', 'عدد الأبناء', 'الأبناء', 'عدد الاطفال'].includes(lower)) mapping[h] = 'children_count';
      else if (['children_live_with', 'إقامة الأبناء', 'مكان إقامة الأبناء'].includes(lower)) mapping[h] = 'children_live_with';
      else if (['wife_count', 'عدد الزوجات', 'عدد الزوجات الحالي'].includes(lower)) mapping[h] = 'wife_count';
      else if (['khataaba_phone', 'جوال الخطابة', 'هاتف الخطابة', 'رقم الخطابة'].includes(lower)) mapping[h] = 'khataaba_phone';
      else if (['khataaba_name', 'اسم الخطابة', 'الخطابة', 'المكتب'].includes(lower)) mapping[h] = 'khataaba_name';
      else if (['real_name', 'realname', 'الاسم الحقيقي', 'الاسم الكامل'].includes(lower)) mapping[h] = 'real_name';
      else if (['nickname', 'الاسم المستعار', 'المعرف'].includes(lower)) mapping[h] = 'nickname';
      else if (['phone', 'الجوال', 'الهاتف', 'رقم الهاتف'].includes(lower)) mapping[h] = 'whatsapp';
      else if (['whatsapp', 'واتساب', 'الواتساب', 'رقم الواتساب'].includes(lower)) mapping[h] = 'whatsapp';
      else if (['password', 'pass', 'كلمة المرور', 'كلمة السر', 'الرمز السري', 'الباسورد', 'رمز المرور'].includes(lower)) mapping[h] = 'password';
      else if (['accept_polygamy', 'تقبل التعدد', 'قبول التعدد', 'التعدد'].includes(lower)) mapping[h] = 'accept_polygamy';
      else if (['bio', 'نبذة', 'نبذة عني', 'عني', 'مواصفاتي', 'المواصفات'].includes(lower)) mapping[h] = 'bio';
      else if (['p_notes', 'pnotes', 'partner_notes', 'مواصفات الشريك', 'شروط الشريك', 'المواصفات المطلوبة'].includes(lower)) mapping[h] = 'p_notes';
      else if (['admin_notes', 'adminnotes', 'ملاحظات الإدارة', 'ملاحظات إدارية'].includes(lower)) mapping[h] = 'admin_notes';
      else if (['المهر', 'مهر', 'المصروف', 'مصروف'].includes(lower)) mapping[h] = 'p_notes';
      else mapping[h] = 'append_bio';
    });
    setColumnMapping(mapping);
  };

  // تجهيز البيانات للمعاينة وحساب المكررات فورياً
  const prepareParsedDataForPreview = (data: Record<string, any>[], headers?: string[]) => {
    if (headers && headers.length > 0) {
      autoDetectColumnMapping(headers);
    } else if (parsedHeaders.length > 0) {
      autoDetectColumnMapping(parsedHeaders);
    }
    setParsedData(data);
    setDuplicates([]);
    setUniqueData([...data]);
    setStep('preview');
  };

  // إضافة صف جديد فارغ في المعاينة
  const handleAddBlankRow = () => {
    const newRow: Record<string, any> = {
      gender: 'male',
      country: 'السعودية',
      age: 25,
      marital_status: 'أعزب',
      bio: '',
      p_notes: '',
      admin_notes: '',
    };
    parsedHeaders.forEach(h => {
      if (!newRow[h]) newRow[h] = '';
    });
    setParsedData(prev => [newRow, ...prev]);
    setEditingRowIndex(0);
    setEditingRowData({ ...newRow });
    localToast('تم إضافة صف جديد للمعاينة', 'success');
  };

  // حذف صف من المعاينة
  const handleDeleteRow = (idx: number) => {
    setParsedData(prev => prev.filter((_, i) => i !== idx));
    if (editingRowIndex === idx) {
      setEditingRowIndex(null);
      setEditingRowData(null);
    }
    localToast('تم حذف الصف من قائمة المعاينة', 'info');
  };

  // فتح تعديل الصف
  const handleStartEditRow = (idx: number) => {
    setEditingRowIndex(idx);
    setEditingRowData({ ...parsedData[idx] });
  };

  // حفظ تعديل الصف
  const handleSaveEditRow = () => {
    if (editingRowIndex === null || !editingRowData) return;
    setParsedData(prev => {
      const updated = [...prev];
      updated[editingRowIndex] = { ...editingRowData };
      return updated;
    });
    setEditingRowIndex(null);
    setEditingRowData(null);
    localToast('تم حفظ التعديلات على الصف بنجاح ✓', 'success');
  };

  // معالجة ملف مرفوع (موحّدة لرفع الملفات العادية والأكسل والـ JSON والمسحوب)
  const processUploadedFile = async (file: File) => {
    setCsvFile(file);
    setIsProcessing(true);

    try {
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.json')) {
        const jsonText = await file.text();
        try {
          const parsed = JSON.parse(jsonText);
          const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.members) ? parsed.members : [parsed]);
          const headersSet = new Set<string>();
          rows.forEach((r: any) => Object.keys(r || {}).forEach(k => headersSet.add(k)));
          const headers = Array.from(headersSet);
          setParsedHeaders(headers);
          setParseErrors([]);
          prepareParsedDataForPreview(rows, headers);
        } catch (e) {
          setParseErrors(['الملف لا يحتوي على كود JSON صالح']);
          setStep('upload');
        }
        return;
      }

      let text = '';
      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) {
          setParseErrors(['ملف الأكسل فارغ أو لا يحتوي على أوراق عمل']);
          setStep('upload');
          setIsProcessing(false);
          return;
        }
        text = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
      } else {
        text = await file.text();
      }

      const result = parseCSV(text);

      setParsedHeaders(result.headers);
      setParseErrors(result.errors);

      if (result.errors.length === 0 && result.rows.length > 0) {
        const rawData = result.rows.map(row => parseCSVRow(result.headers, row));
        const data = filterMeaningfulRows(rawData);
        if (data.length === 0) {
          setParseErrors(['الملف لا يحتوي على صفوف بيانات صالحة']);
          setStep('upload');
        } else {
          prepareParsedDataForPreview(data, result.headers);
        }
      } else {
        setStep('upload');
      }
    } catch (err) {
      setParseErrors(['خطأ في قراءة وتحليل الملف']);
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const validExts = ['.csv', '.txt', '.tsv', '.xlsx', '.xls', '.json'];
    if (!validExts.some(ext => lowerName.endsWith(ext))) {
      localToast('الرجاء رفع ملف بصيغة Excel (.xlsx, .xls) أو CSV أو JSON أو TXT', 'error');
      return;
    }

    processUploadedFile(file);
  }; 
  
  // معالجة Paste
  const handlePasteParse = () => {
    if (!pastedText.trim()) {
      localToast('الرجاء إدخال البيانات', 'error');
      return;
    }
    
    setIsProcessing(true);
    const result = parsePastedData(pastedText);
    
    setParsedHeaders(result.headers);
    setParseErrors(result.errors);
    
    if (result.errors.length === 0 && result.rows.length > 0) {
      const rawData = result.rows.map(row => parseCSVRow(result.headers, row));
      const data = filterMeaningfulRows(rawData);
      if (data.length === 0) {
        setParseErrors(['البيانات الملصقة لا تحتوي على صفوف صالحة']);
      } else {
        prepareParsedDataForPreview(data, result.headers);
      }
    }
    
    setIsProcessing(false);
  }; 
  
  // التحقق من البيانات - مرن، لا يوقف الاستيراد
  const validateData = async () => {
    // نضمن تحميل قوائم الجغرافيا من الخادم أولاً حتى لا نعتبر قيمة موجودة «جديدة»
    try { await dataService.db.ensureGeoLoaded?.(); } catch { /* ignore */ }
    const errors: ImportError[] = []; 
    const warnings: ImportWarning[] = []; 
    
    parsedData.forEach((row, idx) => {
      // فحص الحقول الأساسية الـ 4 فقط: (الجنس، الدولة، العمر، الحالة الاجتماعية)
      const genderVal = (row.gender || row['الجنس'] || row['الجنيس'] || '').toString().trim();
      const countryVal = (row.country || row['الدولة'] || row['بلد الإقامة'] || '').toString().trim();
      const ageVal = (row.age || row['العمر'] || row.birth_date || row.birthDate || row['تاريخ الميلاد'] || '').toString().trim();
      const maritalVal = (row.maritalStatus || row.marital_status || row['الحالة الاجتماعية'] || row['الحالة'] || '').toString().trim();

      const missing: string[] = [];
      if (!genderVal) missing.push('الجنس');
      if (!countryVal) missing.push('الدولة');
      if (!ageVal || ageVal === '0') missing.push('العمر');
      if (!maritalVal) missing.push('الحالة الاجتماعية');

      if (missing.length > 0) {
        warnings.push({
          row: idx + 2,
          field: missing.join('، '),
          message: `حقول أساسية فارغة: [${missing.join('، ')}] — سيتم الاستيراد كحقل فارغ`
        });
      }
    });
    
    // عدم تصفية المكررات — استيراد كافة الصفوف دائماً حتى لو تطابقت الأرقام أو البيانات
    setDuplicates([]);
    setUniqueData([...parsedData]);
    
    // اكتشاف المواقع غير المعروفة
    const unknownFound: UnknownGeoItem[] = [];
    const seenGeoKeys = new Set<string>();

    parsedData.forEach((row) => {
      const country = (row.country || row['الدولة'] || '').toString().trim();
      const city = (row.city || row['المدينة'] || '').toString().trim();

      if (country && !dataService.db.isCountryKnown(country)) {
        const key = `country:${country}`;
        if (!seenGeoKeys.has(key)) {
          seenGeoKeys.add(key);
          unknownFound.push({
            id: key,
            type: 'country',
            name: country,
            action: 'add',
            targetName: ''
          });
        }
      }

      if (country && city && !dataService.db.isCityKnown(country, city)) {
        const key = `city:${country}:${city}`;
        if (!seenGeoKeys.has(key)) {
          seenGeoKeys.add(key);
          unknownFound.push({
            id: key,
            type: 'city',
            name: city,
            country: country,
            action: 'add',
            targetName: ''
          });
        }
      }

      const nationality = (row.nationality || row['الجنسية'] || '').toString().trim();
      if (nationality && !dataService.db.isNationalityKnown(nationality)) {
        const key = `nationality:${nationality}`;
        if (!seenGeoKeys.has(key)) {
          seenGeoKeys.add(key);
          unknownFound.push({ id: key, type: 'city', name: nationality, country, action: 'add', targetName: '' });
        }
      }
    });

    setGeoUnknownList(unknownFound);

    setValidationErrors(errors); // لا أخطاء - الاستيراد سيستمر
    setValidationWarnings(warnings);
    setStep('validate');
  }; 
  
  // تنفيذ الاستيراد
  const executeImport = async () => {
    setIsProcessing(true);
    
    try {
      // نضمن تحميل قوائم الجغرافيا من الخادم قبل فحص القيم الموجودة
      try { await dataService.db.ensureGeoLoaded?.(); } catch { /* ignore */ }
      
      // تجهيز القائمة المخصصة إذا تم اختيارها
      let effectiveCustomListId = selectedCustomListId;
      if (isCreatingNewCustomList && newCustomListName.trim()) {
        const created = createCustomList(newCustomListName.trim(), `أعضاء مستوردون في دفعة ${batchNumberPreview || importDate}`, 'amber');
        effectiveCustomListId = created.id;
      }

      // ===== استيراد ملفات الخطابات والوسطاء (Matchmakers & External) =====
      let officeId = '';
      let officeName = '';
      
      if (officeMode === 'new' && newOfficeName.trim()) {
        const newOffice = addImportOffice(newOfficeName.trim());
        officeId = newOffice.id;
        officeName = newOffice.name;
      } else if (officeMode === 'existing' && selectedOfficeId) {
        const office = getImportOfficeById(selectedOfficeId);
        officeId = selectedOfficeId;
        officeName = office?.name || '';
      }

      // تجهيز كافة الأعضاء كحسابات جديدة مستقلة
      const batchId = 'batch_' + Date.now();
      const importDataList = [...parsedData];

      const newMembers = importDataList.map((data, index) => {
        const mappedData: Record<string, any> = { ...data };
        if (columnMapping && Object.keys(columnMapping).length > 0) {
          Object.entries(columnMapping).forEach(([colHeader, targetField]) => {
            const val = data[colHeader];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              if (targetField === 'append_bio') {
                mappedData.bio = mappedData.bio ? `${mappedData.bio} | ${colHeader}: ${val}` : `${colHeader}: ${val}`;
              } else if (targetField === 'append_pnotes') {
                mappedData.pNotes = mappedData.pNotes ? `${mappedData.pNotes} | ${colHeader}: ${val}` : `${colHeader}: ${val}`;
              } else if (targetField === 'append_admin') {
                mappedData.adminNotes = mappedData.adminNotes ? `${mappedData.adminNotes} | ${colHeader}: ${val}` : `${colHeader}: ${val}`;
              } else if (targetField !== 'ignore') {
                mappedData[targetField] = val;
              }
            }
          });
        }
        const m = prepareImportedMember(mappedData, batchId, officeName, importDate, importNotes, index + 1) as AdminMember;
        if (effectiveCustomListId) {
          const currentLists = Array.isArray(m.customLists) ? m.customLists : [];
          if (!currentLists.includes(effectiveCustomListId)) {
            m.customLists = [...currentLists, effectiveCustomListId];
          }
        }
        return m;
      });

      if (effectiveCustomListId && newMembers.length > 0) {
        assignMembersToCustomList(effectiveCustomListId, newMembers.map(m => m.id));
      }
      
      // التحديث والتسجيل التلقائي للخطابات في دليل الخطابات
      newMembers.forEach((m: any) => {
        if (m.khataabaPhone || m.khataabaName) {
          upsertKhataabaRecord({
            phone: m.khataabaPhone || '',
            name: m.khataabaName || '',
            officeName: officeName || undefined,
          });
        }
      });
      
      // تسجيل الدول/المدن/الجنسيات الجديدة كاقتراحات مراجعة
      let newCitiesAddedCount = 0;
      newMembers.forEach((m) => {
        if (m.country && m.country.trim()) {
          const countryClean = m.country.trim();
          if (!dataService.db.isCountryKnown(countryClean)) {
            dataService.db.addPendingGeo('country', countryClean, '', m.nickname || m.realName || 'استيراد أعضاء', 'import', m.id);
          }
          if (m.city && m.city.trim()) {
            const cityClean = m.city.trim();
            if (!dataService.db.isCityKnown(countryClean, cityClean)) {
              dataService.db.addPendingGeo('city', cityClean, countryClean, m.nickname || m.realName || 'استيراد أعضاء', 'import', m.id);
              newCitiesAddedCount++;
            }
          }
        }
        if (m.nationality && String(m.nationality).trim() && !dataService.db.isNationalityKnown(String(m.nationality).trim())) {
          dataService.db.addPendingGeo('nationality', String(m.nationality).trim(), m.country || '', m.nickname || m.realName || 'استيراد أعضاء', 'import', m.id);
        }
      });
      
      // إنشاء الدفعة
      const batch = createImportBatch({
        batchNumber: batchNumberPreview || undefined,
        officeId,
        officeName,
        importDate,
        membersCount: newMembers.length,
        duplicatesCount: 0,
        skippedCount: 0,
        errorsCount: 0,
        notes: importNotes,
        sourceType: method,
      });
      
      // تحديث معرف الدفعة في الأعضاء
      newMembers.forEach(m => m.importBatchId = batch.id);
      
      if (newMembers.length === 0) {
        localToast('لا توجد بيانات للاستيراد', 'error');
        setIsProcessing(false);
        return;
      }

      // إضافة الأعضاء إلى النظام وحفظهم في التخزين ولوحة الإدارة والموقع العام
      importMembers(newMembers, false);

      let geoNote = '';
      if (newCitiesAddedCount > 0) {
        geoNote = ` — تم إرسال ${newCitiesAddedCount} مدينة/دولة جديدة للمراجعة في «إعدادات الموقع - الدول والمدن»`;
      }
      
      // إنشاء التقرير
      const report = createImportReport(
        parsedData.length,
        newMembers.length,
        0,
        0,
        validationErrors,
        validationWarnings,
        batch
      );
      
      setImportReport(report);
      setCreatedBatch(batch);
      setStep('result');
      refreshOfficesAndBatches();
      
      localToast(`تم استيراد ${newMembers.length} عضو بنجاح ✓${geoNote}`, 'success');
    } catch (err) {
      localToast('حدث خطأ أثناء الاستيراد', 'error');
    } finally {
      setIsProcessing(false);
    }
  }; 
  
  // إعادة التعيين
  const resetImport = () => {
    setStep('setup');
    setMethod('csv');
    setCsvFile(null);
    setPastedText('');
    setParsedData([]);
    setParsedHeaders([]);
    setParseErrors([]);
    setValidationErrors([]);
    setValidationWarnings([]);
    setDuplicates([]);
    setUniqueData([]);
    setImportReport(null);
    setCreatedBatch(null);
    setOfficeMode('none');
    setNewOfficeName('');
    setSelectedOfficeId('');
    setImportNotes('');
  }; 
  
  // ===== حساب نقص الحقول الإلزامية (تحذير فقط — لا يمنع الاستيراد) =====
  const requiredFieldWarnings = useMemo(() => {
    const getVal = (row: Record<string, any>, keys: string[]) => {
      for (const k of keys) {
        const v = row?.[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };
    const checks: Record<string, string[]> = {
      gender: ['gender', 'الجنس'],
      age: ['age', 'العمر'],
      country: ['country', 'الدولة'],
      marital_status: ['maritalStatus', 'marital_status', 'الحالة الاجتماعية'],
    };
    const counts: Record<string, number> = {};
    IMPORT_REQUIRED_COLUMNS.forEach((c) => { counts[c] = 0; });
    parsedData.forEach((row) => {
      IMPORT_REQUIRED_COLUMNS.forEach((c) => { if (!getVal(row, checks[c] || [c])) counts[c]++; });
    });
    return Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([col, count]) => ({ col, label: IMPORT_COLUMN_LABELS[col] || col, count }));
  }, [parsedData]);
  
  // ===== العرض =====
  
  const stepsConfig = [
    { id: 'setup', label: 'إعدادات الاستيراد', icon: Building2 },
    { id: 'upload', label: 'رفع البيانات', icon: Upload },
    { id: 'preview', label: 'معاينة', icon: Eye },
    { id: 'validate', label: 'التحقق', icon: AlertCircle },
    { id: 'result', label: 'النتيجة', icon: CheckCircle2 },
  ];
  
  const currentStepIdx = stepsConfig.findIndex(s => s.id === step);
  
  return (
    <div className="space-y-5">
      {/* العنوان */}
      <PageHeader
        icon={Upload}
        title="استيراد وتصدير الأعضاء"
        subtitle="إدارة استيراد دفعات الأعضاء أو تصدير بيانات الأعضاء إلى ملفات Excel وCSV الشاملة"
        action={
          activeMainTab === 'import' ? (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowAiPromptModal(true)}
                aria-label="توجيه وأوامر الذكاء الاصطناعي"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-cairo font-semibold text-sm hover:from-purple-800 hover:to-indigo-800 transition-all shadow-sm border border-purple-500/30"
              >
                <Sparkles className="w-4 h-4 text-amber-300" /> توجيه وأوامر الذكاء الاصطناعي (AI Prompt)
              </button>
              <button
                onClick={downloadSimpleTemplate}
                aria-label="تحميل النموذج المبسط"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-100 text-amber-900 font-cairo font-semibold text-sm hover:bg-amber-200 transition-colors shadow-sm"
              >
                <FileDown className="w-4 h-4 text-amber-600" /> تحميل النموذج المبسط (Excel/CSV)
              </button>
              {step !== 'setup' && (
                <button
                  onClick={resetImport}
                  aria-label="إعادة تعيين الاستيراد"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-cairo font-semibold text-sm hover:bg-slate-200 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> إعادة التعيين
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => exportMembersToExcel(exportFilteredMembers, 'members_export', exportFormatMode)}
                disabled={exportFilteredMembers.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-cairo font-bold text-sm transition-all shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" /> تصدير Excel (.xlsx) ({exportFilteredMembers.length})
              </button>
              <button
                onClick={() => {
                  if (exportFormatMode === 'import_template') {
                    exportMembersForImportTemplate(exportFilteredMembers, 'members_export');
                  } else {
                    exportMembersWithFullDetails(exportFilteredMembers, 'members_export', 'csv');
                  }
                }}
                disabled={exportFilteredMembers.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-cairo font-bold text-sm transition-all shadow-sm"
              >
                <FileDown className="w-4 h-4" /> تصدير CSV ({exportFilteredMembers.length})
              </button>
            </div>
          )
        }
      />
      
      {/* شريط التبديل بين معالج الاستيراد ومركز التصدير */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 max-w-md">
        <button
          onClick={() => setActiveMainTab('import')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-cairo font-bold text-sm transition-all ${
            activeMainTab === 'import'
              ? 'bg-white text-amber-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" /> معالج الاستيراد
        </button>
        <button
          onClick={() => setActiveMainTab('export')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-cairo font-bold text-sm transition-all ${
            activeMainTab === 'export'
              ? 'bg-white text-amber-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileDown className="w-4 h-4" /> مركز تصدير الأعضاء
        </button>
      </div>

      {activeMainTab === 'import' ? (
        <>
      
      {/* شريط الخطوات التفاعلي للتنقل والرجوع */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between md:justify-around gap-2 overflow-x-auto pb-1 scrollbar-none">
          {stepsConfig.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === currentStepIdx;
            const isPast = idx < currentStepIdx;
            const canClick = s.id === 'setup' || s.id === 'upload' || 
              ((s.id === 'preview' || s.id === 'validate') && parsedData.length > 0) ||
              (s.id === 'result' && importReport !== null);
            
            return (
              <div key={s.id} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <button
                  type="button"
                  disabled={!canClick}
                  onClick={() => canClick && setStep(s.id as any)}
                  className={`flex items-center gap-2 p-1.5 rounded-xl transition-all ${
                    canClick ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed opacity-60'
                  }`}
                  title={canClick ? `الانتقال إلى ${s.label}` : 'أكمل الخطوات السابقة أولاً'}
                >
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${
                    isActive ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/20' :
                    isPast ? 'bg-emerald-500 text-white' :
                    'bg-slate-100 text-slate-400'
                  }`}
                  >
                    {isPast ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icon className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </div>
                  <span className={`font-cairo font-semibold text-xs sm:text-sm ${
                    isActive ? 'text-amber-600 font-bold' : isPast ? 'text-emerald-600' : 'text-slate-400'
                  } ${isActive ? 'inline-block' : 'hidden sm:inline-block'}`}>
                    {s.label}
                  </span>
                </button>
                {idx < stepsConfig.length - 1 && (
                  <div className={`w-3 sm:w-8 h-0.5 mx-1 sm:mx-2 ${isPast ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* المحتوى */}
      <AnimatePresence mode="wait">
        {/* ===== الخطوة 1: الإعدادات واختيار مسار الاستيراد ===== */}
        {step === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6"
          >
            {/* رأس الخطوة */}
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-cairo font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-500" /> إعداد بيانات الخطابة والدفعة الإدارية
                </h3>
                <p className="text-xs text-slate-500 font-tajawal mt-1">
                  مخصص لاستيراد قوائم وملفات الأعضاء الواردة من الخطابات، المكاتب، ومجموعات التوفيق
                </p>
              </div>
            </div>

            {/* شريط توجيهي إلى قسم استيراد ملفات المنصة والنسخ الاحتياطي */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Database className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <div className="font-cairo font-bold text-xs sm:text-sm text-slate-900">
                    هل لديك ملف تم تصديره من المنصة أو ترغب باستعادة نسخة احتياطية؟
                  </div>
                  <div className="text-[11px] text-slate-600 font-tajawal mt-0.5">
                    استيراد ملفات أعضاء المنصة المصدّرين (50+ حقل) واستعادة النظام متاح في قسم «النسخ الاحتياطي واستعادة المنصة».
                  </div>
                </div>
              </div>
              <button
                id="btn-goto-backup-restore"
                type="button"
                onClick={() => navigate('/admin/settings?tab=backup&section=platform-import')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-cairo font-bold text-xs transition-all shadow-xs whitespace-nowrap cursor-pointer"
              >
                <span>الانتقال للنسخ والاستعادة</span>
                <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>

            {/* تفاصيل الخطابة والمكتب */}
            <div className="space-y-4">
              {/* الخطابة */}
              <div className="space-y-3">
                <label className="font-cairo font-semibold text-sm text-slate-700">
                  اسم الخطابة أو المكتب (اختياري)
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    id="btn-office-none"
                    type="button"
                    onClick={() => setOfficeMode('none')}
                    className={`px-4 py-2 rounded-xl font-cairo font-semibold text-sm transition-all cursor-pointer ${
                      officeMode === 'none' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    بدون خطابة
                  </button>
                  <button
                    id="btn-office-existing"
                    type="button"
                    onClick={() => setOfficeMode('existing')}
                    className={`px-4 py-2 rounded-xl font-cairo font-semibold text-sm transition-all cursor-pointer ${
                      officeMode === 'existing' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    خطابة مسجلة مسبقاً
                  </button>
                  <button
                    id="btn-office-new"
                    type="button"
                    onClick={() => setOfficeMode('new')}
                    className={`px-4 py-2 rounded-xl font-cairo font-semibold text-sm transition-all flex items-center gap-1 cursor-pointer ${
                      officeMode === 'new' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Plus className="w-4 h-4" /> خطابة جديدة
                  </button>
                </div>
                
                {officeMode === 'existing' && (
                  <div className="mt-3">
                    <select
                      id="select-existing-office"
                      value={selectedOfficeId}
                      onChange={e => setSelectedOfficeId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal cursor-pointer"
                    >
                      <option value="">اختر الخطابة أو المكتب...</option>
                      {offices.map(o => (
                        <option key={o.id} value={o.id}>{o.name} ({o.usageCount} استخدام)</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {officeMode === 'new' && (
                  <div className="mt-3">
                    <input
                      id="input-new-office-name"
                      type="text"
                      value={newOfficeName}
                      onChange={e => setNewOfficeName(e.target.value)}
                      placeholder="اسم الخطابة أو المكتب..."
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal"
                    />
                  </div>
                )}
              </div>
              
              {/* القائمة المخصصة والتصنيف الخاص بالدفعة */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-cairo font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-500" /> إسناد الدفعة لقائمة مخصصة (اختياري)
                  </label>
                  <span className="text-xs text-slate-500 font-tajawal">مثل: قائمة طرف الخطابة أم زيد / خاص بي - تعليم</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <select
                      id="select-batch-custom-list"
                      value={isCreatingNewCustomList ? '__new__' : selectedCustomListId}
                      onChange={e => {
                        if (e.target.value === '__new__') {
                          setIsCreatingNewCustomList(true);
                          setSelectedCustomListId('');
                        } else {
                          setIsCreatingNewCustomList(false);
                          setSelectedCustomListId(e.target.value);
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-sm cursor-pointer"
                    >
                      <option value="">بدون قائمة مخصصة (عام)</option>
                      {customLists.map(l => (
                        <option key={l.id} value={l.id}>📁 {l.name}</option>
                      ))}
                      <option value="__new__">➕ إنشاء قائمة مخصصة جديدة لهذه الدفعة...</option>
                    </select>
                  </div>

                  {isCreatingNewCustomList && (
                    <div>
                      <input
                        id="input-new-custom-list-name"
                        type="text"
                        value={newCustomListName}
                        onChange={e => setNewCustomListName(e.target.value)}
                        placeholder="اسم القائمة الجديدة (مثال: أعضاء طرف أم زيد)..."
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-amber-300 focus:border-amber-500 focus:outline-none font-tajawal text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* تاريخ الاستيراد ورقم الدفعة */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="font-cairo font-semibold text-sm text-slate-700 flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> تاريخ الاستيراد
                </label>
                <input
                  id="input-import-date"
                  type="date"
                  value={importDate}
                  onChange={e => setImportDate(e.target.value)}
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal cursor-pointer"
                />
              </div>
              <div>
                <label className="font-cairo font-semibold text-sm text-slate-700 flex items-center gap-1">
                  <Hash className="w-4 h-4" /> رقم الدفعة <span className="text-xs text-slate-400 font-normal">(تلقائي وقابل للتعديل)</span>
                </label>
                <input
                  id="input-batch-number-preview"
                  type="text"
                  value={batchNumberPreview}
                  onChange={e => setBatchNumberPreview(e.target.value)}
                  placeholder="مثال: IMP-001 أو دفعة-خاصة"
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-cairo font-bold"
                />
              </div>
            </div>
            
            {/* ملاحظات */}
            <div>
              <label className="font-cairo font-semibold text-sm text-slate-700 flex items-center gap-1">
                <StickyNote className="w-4 h-4" /> ملاحظات الاستيراد (اختياري)
              </label>
              <textarea
                id="textarea-import-notes"
                value={importNotes}
                onChange={e => setImportNotes(e.target.value)}
                rows={2}
                placeholder="ملاحظات إضافية حول هذه الدفعة..."
                className="w-full mt-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal"
              />
            </div>
            
            {/* زر الانتقال */}
            <button
              id="btn-step-next-to-upload"
              type="button"
              onClick={() => setStep('upload')}
              className="w-full py-3.5 rounded-xl bg-amber-500 text-slate-950 font-cairo font-bold text-sm hover:bg-amber-400 active:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <span>التالي: رفع وتحديد الملف</span>
              <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
            </button>
          </motion.div>
        )}
        
        {/* ===== الخطوة 2: رفع البيانات ===== */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5"
          >
            {/* اختيار الطريقة */}
            <div className="flex gap-2">
              <button
                onClick={() => setMethod('csv')}
                className={`flex-1 py-4 rounded-xl font-cairo font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  method === 'csv' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5" /> رفع ملف CSV
              </button>
              <button
                onClick={() => setMethod('paste')}
                className={`flex-1 py-4 rounded-xl font-cairo font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  method === 'paste' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Clipboard className="w-5 h-5" /> لصق البيانات
              </button>
            </div>

            {/* كارت التأكيد الأمني والبرمجي */}
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-xs font-cairo font-bold">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>تأكيد أمان وتشفير محلي: الاستيراد والمعالجة يتمان كلياً ببرمجة وكود محلي 100% (Client-Side) دون أي استخدام لـ API خارجي أو إرسال بياناتك لأي ذكاء اصطناعي.</span>
            </div>

            {/* كارت التوجيهات والإرشادات لاستيراد ملفات الخطابات */}
            <div className="bg-gradient-to-r from-navy-900 to-slate-900 rounded-2xl p-5 text-white space-y-3 shadow-md border border-navy-700">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-amber-300" />
                  <h4 className="font-cairo font-bold text-sm text-amber-200">
                    توجيهات استيراد ملفات الخطابات والمكاتب والبيانات الخارجية
                  </h4>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={downloadKhataabaTemplate}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-cairo font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> نموذج إكسل للخطابات (.xlsx)
                  </button>
                  <button
                    onClick={downloadSimpleTemplate}
                    className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-cairo font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> نموذج CSV المبسط
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-tajawal text-slate-200 leading-relaxed pt-1">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-1">
                  <span className="font-bold text-amber-300 font-cairo block mb-1">🔒 قواعد أرقام التواصل والخصوصية:</span>
                  يُمنع إضافة أرقام التواصل في ملف العضو العام. يوجه النظام أي رقم هاتف أو واتساب تلقائياً إلى <strong>ملاحظات الإدارة (admin_notes)</strong> للعضو المستورد لحفظ خصوصيته للإدارة والوسطاء.
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-1">
                  <span className="font-bold text-amber-300 font-cairo block mb-1">⚡ الظهور والترتيب التلقائي:</span>
                  يتم إنشاء حسابات نظيفة للأعضاء وظهورهم فوراً في <strong>مقدمة قائمة الأعضاء الجدد وفي أعلى نتائج البحث</strong>.
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-1">
                  <span className="font-bold text-amber-300 font-cairo block mb-1">🌍 البيانات الجغرافية:</span>
                  المدن والدول غير المسجلة مسبقاً تُدرج وتُرسل كاقتراحات مراجعة إدارية إلى «إعدادات الموقع - الدول والمدن».
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-1">
                  <span className="font-bold text-amber-300 font-cairo block mb-1">✨ المرونة ومواصفات الشريك:</span>
                  يدعم إدخال العمر كرقم (مثال: 25) مباشرة وتوليد كلمات مرور تلقائية وتوجيه شروط ومهر الشريك تلقائياً.
                </div>
              </div>
            </div>
            
            {/* رفع الملف */}
            {method === 'csv' && (
              <div className="space-y-3">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    isDragging
                      ? 'border-amber-500 bg-amber-50/50 scale-[1.01] shadow-inner'
                      : 'border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <input
                    type="file"
                    accept=".csv,.txt,.tsv,.xlsx,.xls,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer block">
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="font-cairo font-bold text-slate-700">
                      اضغط لرفع ملف الأعضاء (Excel / CSV / JSON)
                    </p>
                    <p className="text-sm text-slate-500 font-tajawal mt-1">أو اسحب الملف وأفلته هنا</p>
                  </label>
                </div>
                {csvFile && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="font-cairo font-semibold text-emerald-700">{csvFile.name}</span>
                    <span className="text-sm text-slate-500 font-tajawal">({(csvFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>
            )}
            
            {/* لصق البيانات */}
            {method === 'paste' && (
              <div className="space-y-3">
                <textarea
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  rows={10}
                  placeholder="لصق البيانات هنا...

التنسيق: العناوين في الصف الأول، البيانات في الصفوف التالية
الفاصل: Tab أو comma
يدعم أيضاً JSON أو نصوص واتساب/استمارات خام وسيحاول النظام استخراج ملفات الأعضاء تلقائياً.

مثال:
real_name,nickname,gender,age,country,city,marital_status,whatsapp,bio,p_notes
عبدالله أحمد,أبو عبدالله,ذكر,32,السعودية,الرياض,أعزب,0501234567,جاد ومستقر,يبحث عن زوجة صالحة

أو ألصق نص واتساب مثل:
[19/11/2025, 6:54 م] الاسم: سارة، العمر: 28، عزباء، جدة، الواتساب: 0559876543، الشروط: رجل جاد ومستقر"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-mono text-sm"
                />
                <button
                  onClick={handlePasteParse}
                  disabled={!pastedText.trim() || isProcessing}
                  className="w-full py-3 rounded-xl bg-amber-500 text-white font-cairo font-bold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Table className="w-5 h-5" />}
                  تحليل البيانات
                </button>
              </div>
            )}
            
            {/* أخطاء التحليل */}
            {parseErrors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 font-cairo font-bold">
                  <AlertCircle className="w-5 h-5" /> أخطاء في التحليل
                </div>
                {parseErrors.map((err, idx) => (
                  <p key={idx} className="text-sm text-rose-600 font-tajawal">• {err}</p>
                ))}
              </div>
            )}

            {/* أزرار التنقل السفلية للخطوة 2 */}
            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setStep('setup')}
                className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-sm transition-colors flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" /> السابق: الإعدادات الإدارية
              </button>
              {parsedData.length > 0 && (
                <button
                  onClick={() => setStep('preview')}
                  className="flex-1 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-cairo font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  التالي: المعاينة ومطابقة الأعمدة ({parsedData.length} عضو) <ArrowLeft className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}
        
        {/* ===== الخطوة 3: المعاينة ومطابقة الأعمدة والتعديل ===== */}
        {step === 'preview' && parsedData.length > 0 && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-cairo font-bold text-lg text-slate-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-500" /> معاينة ومطابقة البيانات ({parsedData.length} صف)
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowColumnMapping(!showColumnMapping)}
                  className={`px-3 py-1.5 rounded-lg font-cairo font-bold text-xs flex items-center gap-1.5 transition-colors ${
                    showColumnMapping
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                  }`}
                >
                  <GitMerge className="w-4 h-4" />
                  {showColumnMapping ? 'إخفاء مطابقة الأعمدة' : 'مطابقة الأعمدة التفاعلية'}
                </button>
                <button
                  onClick={handleAddBlankRow}
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 font-cairo font-bold text-xs hover:bg-emerald-200 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> إضافة صف جديد
                </button>
                {parsedData.length > 5 && (
                  <button
                    onClick={() => setShowAllPreviewRows(!showAllPreviewRows)}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-cairo font-bold text-xs hover:bg-amber-200 transition-colors"
                  >
                    {showAllPreviewRows ? 'عرض 5 فقط' : `عرض الكل (${parsedData.length})`}
                  </button>
                )}
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* لوحة مطابقة الأعمدة التفاعلية (Visual Column Mapping Panel) */}
            {showColumnMapping && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-purple-50/70 border-2 border-purple-200 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <GitMerge className="w-5 h-5 text-purple-600" />
                  <h4 className="font-cairo font-bold text-sm text-purple-900">
                    مطابقة وتوجيه أعمدة الملف المستورد إلى حقول المنصة:
                  </h4>
                </div>
                <p className="text-xs text-purple-700 font-tajawal leading-relaxed">
                  يمكنك تحديد الحقل المناسب لكل عمود مرفوع. أي عمود غير مطابق يمكن دمج محتواه تلقائياً في «نبذة عني» أو «مواصفات الشريك/المهر» أو «ملاحظات الإدارة السرية».
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  {parsedHeaders.map(header => (
                    <div key={header} className="bg-white rounded-xl p-3 border border-purple-100 shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-cairo font-bold text-xs text-slate-800 truncate" title={header}>
                          {header}
                        </span>
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-mono">
                          عينة: {parsedData[0]?.[header] ? String(parsedData[0][header]).slice(0, 15) : 'فارغ'}
                        </span>
                      </div>
                      <select
                        value={columnMapping[header] || 'append_bio'}
                        onChange={(e) => {
                          setColumnMapping(prev => ({ ...prev, [header]: e.target.value }));
                        }}
                        className="w-full text-xs font-cairo bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                      >
                        <option value="gender">الجنس (ذكر/أنثى)</option>
                        <option value="age">العمر</option>
                        <option value="country">الدولة</option>
                        <option value="city">المدينة</option>
                        <option value="district">الحي</option>
                        <option value="nationality">الجنسية</option>
                        <option value="marriage_type">نوع الزواج (عادي/مسيار/تعدد)</option>
                        <option value="tribe">القبيلة / النسب</option>
                        <option value="marital_status">الحالة الاجتماعية</option>
                        <option value="sect">المذهب</option>
                        <option value="height">الطول</option>
                        <option value="weight">الوزن</option>
                        <option value="skin_color">لون البشرة</option>
                        <option value="education">المؤهل العلمي</option>
                        <option value="work_type">نوع العمل</option>
                        <option value="job_title">الوظيفة</option>
                        <option value="housing">السكن</option>
                        <option value="whatsapp">رقم الواتساب (خاص بالإدارة)</option>
                        <option value="password">كلمة المرور (اختياري / توليد تلقائي)</option>
                        <option value="accept_polygamy">تقبل التعدد</option>
                        <option value="bio">نبذة عني (عامة للجميع)</option>
                        <option value="p_notes">مواصفات الشريك / المهر (عامة)</option>
                        <option value="admin_notes">ملاحظات إدارية (خاصة بالإدارة)</option>
                        <option value="append_bio">➕ دمج في نبذة عني (bio)</option>
                        <option value="append_pnotes">➕ دمج في مواصفات الشريك (p_notes)</option>
                        <option value="append_admin">🔒 دمج في ملاحظات الإدارة (admin_notes)</option>
                        <option value="ignore">🚫 تجاهل هذا العمود</option>
                      </select>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            
            {showPreview && (
              <div className={`overflow-x-auto ${showAllPreviewRows ? 'max-h-[60vh] overflow-y-auto' : ''}`}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-center font-cairo font-bold text-slate-600 whitespace-nowrap">#</th>
                      {parsedHeaders.slice(0, 7).map((h, hIdx) => (
                        <th key={`import-th-${h}-${hIdx}`} className="px-3 py-2 text-right font-cairo font-bold text-slate-600 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-cairo font-bold text-indigo-700 whitespace-nowrap bg-indigo-50/70">
                        مواصفات وشروط الشريك المطلوب
                      </th>
                      {parsedHeaders.length > 7 && (
                        <th className="px-3 py-2 font-cairo font-bold text-slate-400">+{parsedHeaders.length - 7}</th>
                      )}
                      <th className="px-3 py-2 text-center font-cairo font-bold text-slate-600 whitespace-nowrap">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(showAllPreviewRows ? parsedData : parsedData.slice(0, 5)).map((row, idx) => {
                      const pNat = row.partner_nationality || row.pNationality || row['جنسية الشريك'] || row['جنسية الشريك المطلوبة'] || '';
                      const pCity = row.partner_cities || row.partner_city || row.pCity || row['المدن المقبولة'] || row['المدن المقبولة للشريك'] || '';
                      const pAgeMin = row.partner_age_min || row.pAgeMin || '';
                      const pAgeMax = row.partner_age_max || row.pAgeMax || '';
                      const pForeigner = row.accept_foreigner || row.acceptForeigner || row['قبول غير مواطن'] || '';
                      const pNotes = row.p_notes || row.pNotes || row['مواصفات الشريك'] || '';
                      const hasPartnerSpecs = Boolean(pNat || pCity || pAgeMin || pAgeMax || (pForeigner && pForeigner !== 'لا') || pNotes);

                      return (
                        <tr key={`import-row-${idx}`} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-center font-mono text-xs text-slate-400">{idx + 1}</td>
                          {parsedHeaders.slice(0, 7).map((h, hIdx) => (
                            <td key={`import-cell-${h}-${hIdx}`} className="px-3 py-2 text-slate-700 font-tajawal whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis">
                              {getDisplayCellVal(row, h)}
                            </td>
                          ))}
                          {/* عمود ملخص مواصفات الشريك */}
                          <td className="px-3 py-2 bg-indigo-50/30 max-w-[260px]">
                            {hasPartnerSpecs ? (
                              <div className="flex flex-wrap items-center gap-1">
                                {pNat && (
                                  <span className="inline-flex items-center text-[10px] font-tajawal bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                    جنسية: {pNat}
                                  </span>
                                )}
                                {pCity && (
                                  <span className="inline-flex items-center text-[10px] font-tajawal bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                    مدن: {pCity}
                                  </span>
                                )}
                                {(pAgeMin || pAgeMax) && (
                                  <span className="inline-flex items-center text-[10px] font-tajawal bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono">
                                    عمر: {pAgeMin || '?'}-{pAgeMax || '?'}
                                  </span>
                                )}
                                {pForeigner && ['نعم', 'لا مانع'].includes(pForeigner) && (
                                  <span className="inline-flex items-center text-[10px] font-tajawal bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                    يقبل أجنبي
                                  </span>
                                )}
                                {pNotes && (
                                  <span className="text-[10px] text-slate-600 font-tajawal line-clamp-1 block w-full mt-0.5" title={pNotes}>
                                    📝 {pNotes}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs font-tajawal">— غير محددة</span>
                            )}
                          </td>
                          {parsedHeaders.length > 7 && (
                            <td className="px-3 py-2 text-slate-400 font-mono text-xs">...</td>
                          )}
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleStartEditRow(idx)}
                                className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-cairo font-bold text-xs hover:bg-amber-200 transition-colors"
                                title="تعديل هذا العضو"
                              >
                                تعديل
                              </button>
                              <button
                                onClick={() => handleDeleteRow(idx)}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                title="حذف هذا الصف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!showAllPreviewRows && parsedData.length > 5 && (
                      <tr>
                        <td colSpan={Math.min(parsedHeaders.length, 8) + 3} className="px-3 py-2 text-center text-slate-400 font-tajawal">
                          ... و {parsedData.length - 5} صفوف أخرى — اضغط «عرض الكل» بالأعلى
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* أزرار التنقل السفلية للخطوة 3 */}
            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setStep('upload')}
                className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-sm transition-colors flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" /> السابق: رفع وتحديد الملف
              </button>
              <button
                onClick={validateData}
                disabled={isProcessing}
                className="flex-1 py-3.5 rounded-xl bg-amber-500 text-white font-cairo font-bold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertCircle className="w-5 h-5" />}
                التالي: فحص وتحليل البيانات ({parsedData.length} عضو) <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
        
        {/* ===== الخطوة 4: التحقق ===== */}
        {step === 'validate' && (
          <motion.div
            key="validate"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-5"
          >
            {/* ملخص */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-cairo font-bold text-lg text-slate-800 flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-500" /> ملخص الاستيراد والتحقق
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="font-cairo font-extrabold text-2xl text-slate-700">{parsedData.length}</p>
                  <p className="text-xs text-slate-500 font-cairo">إجمالي الصفوف بالملف</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <p className="font-cairo font-extrabold text-2xl text-emerald-600">{parsedData.length}</p>
                  <p className="text-xs text-emerald-600 font-cairo">جاهز للاستيراد المباشر</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <p className="font-cairo font-extrabold text-2xl text-amber-600">{requiredFieldWarnings.length}</p>
                  <p className="text-xs text-amber-600 font-cairo">حقول أساسية ناقصة</p>
                </div>
              </div>
            </div>

            {/* تحذير الحقول الإلزامية الناقصة (الجنس، الدولة، العمر، الحالة الاجتماعية فقط - لا يمنع الاستيراد) */}
            {requiredFieldWarnings.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-cairo font-bold">
                  <AlertTriangle className="w-5 h-5" />
                  <span>تنبيه: حقول أساسية فارغة (الجنس، الدولة، العمر، الحالة الاجتماعية) — سيتم الاستيراد رغم ذلك</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {requiredFieldWarnings.map((w) => (
                    <span key={w.col} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-amber-300 text-amber-800 text-xs font-cairo font-bold">
                      {w.label}: {w.count} عضو بلا قيمة
                    </span>
                  ))}
                </div>
                <p className="text-xs text-amber-700 font-tajawal leading-relaxed">
                  يمكنك المتابعة والاستيراد الآن، ثم إكمال هذه الحقول لاحقاً من ملف كل عضو في صفحة «الأعضاء».
                </p>
              </div>
            )}
            
            {/* التحذيرات */}
            {validationWarnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-700 font-cairo font-bold">
                  <AlertTriangle className="w-5 h-5" /> سجل التحذيرات للحقول الأساسية ({validationWarnings.length})
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {validationWarnings.map((warn, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-2 flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-cairo font-bold text-xs">صف {warn.row}</span>
                      <span className="text-sm text-amber-600 font-tajawal">
                        {warn.field ? `${warn.field}: ` : ''}{warn.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* إشعار بمواقع جغرافية جديدة تحتاج مراجعة يدوية من المشرف */}
            {geoUnknownList.length > 0 && (
              <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-sky-900 font-cairo font-bold text-base">
                    <Globe className="w-5 h-5 text-sky-600" />
                    <span>مواقع جديدة (دول/مدن/جنسيات) تحتاج مراجعتك ({geoUnknownList.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/cities')}
                    className="text-xs bg-sky-600 hover:bg-sky-700 text-white font-cairo font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5" /> إدارة الدول والمدن الآن
                  </button>
                </div>

                <p className="text-xs text-sky-700 font-tajawal leading-relaxed">
                  اكتُشفت المواقع التالية في ملف الاستيراد وهي غير مسجّلة في المنصة. ستُرسل كاقتراحات مراجعة إلى «إعدادات الموقع - الدول والمدن»، ولن تظهر رسمياً حتى تعتمدها أنت من هناك:
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {geoUnknownList.map((item) => (
                    <span key={item.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-xs font-cairo font-bold shadow-2xs">
                      {item.type === 'country' ? <Globe className="w-3.5 h-3.5 text-sky-600" /> : <MapPin className="w-3.5 h-3.5 text-sky-600" />}
                      <span>{item.name}</span>
                      {item.country && <span className="text-slate-400 font-normal">({item.country})</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* أزرار التنقل السفلية للخطوة 4 */}
            <div className="flex gap-3 pt-3">
              <button
                onClick={() => setStep('preview')}
                className="px-5 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-sm transition-colors flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" /> السابق: المعاينة ومطابقة الأعمدة
              </button>
              <button
                onClick={executeImport}
                disabled={parsedData.length === 0 || isProcessing}
                className="flex-1 py-3.5 rounded-xl font-cairo font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                تأكيد وتنفيذ الاستيراد المباشر ({parsedData.length} عضو)
              </button>
            </div>
          </motion.div>
        )}
        
        {/* ===== الخطوة 5: النتيجة ===== */}
        {step === 'result' && importReport && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-5"
          >
            {/* تقرير النتيجة */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-cairo font-bold text-lg text-slate-800">تم الاستيراد بنجاح!</h3>
                  <p className="text-sm text-slate-500 font-tajawal">{createdBatch?.batchNumber} — {createdBatch?.importDate}</p>
                </div>
              </div>
              
              {/* الإحصائيات */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="font-cairo font-extrabold text-xl text-slate-700">{importReport.totalRows}</p>
                  <p className="text-xs text-slate-500 font-cairo">إجمالي</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="font-cairo font-extrabold text-xl text-emerald-600">{importReport.importedCount}</p>
                  <p className="text-xs text-emerald-600 font-cairo">تم استيرادهم</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="font-cairo font-extrabold text-xl text-amber-600">{importReport.duplicatesCount}</p>
                  <p className="text-xs text-amber-600 font-cairo">مكررات</p>
                </div>
                <div className="bg-sky-50 rounded-xl p-3 text-center">
                  <p className="font-cairo font-extrabold text-xl text-sky-600">{importReport.skippedCount}</p>
                  <p className="text-xs text-sky-600 font-cairo">تجاهل</p>
                </div>
                <div className="bg-rose-50 rounded-xl p-3 text-center">
                  <p className="font-cairo font-extrabold text-xl text-rose-600">{importReport.errorsCount}</p>
                  <p className="text-xs text-rose-600 font-cairo">أخطاء</p>
                </div>
              </div>
              
              {/* تفاصيل الدفعة */}
              {createdBatch && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-slate-400" />
                    <span className="font-cairo font-semibold text-sm text-slate-700">رقم الدفعة:</span>
                    <span className="font-cairo font-bold text-amber-600">{createdBatch.batchNumber}</span>
                  </div>
                  {createdBatch.officeName && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="font-cairo font-semibold text-sm text-slate-700">الخطابة:</span>
                      <span className="font-cairo font-bold text-slate-800">{createdBatch.officeName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="font-cairo font-semibold text-sm text-slate-700">تاريخ الاستيراد:</span>
                    <span className="font-tajawal text-slate-800">{new Date(createdBatch.importDate).toLocaleDateString('ar-SA')}</span>
                  </div>
                  {createdBatch.notes && (
                    <div className="flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-slate-400" />
                      <span className="font-cairo font-semibold text-sm text-slate-700">ملاحظات:</span>
                      <span className="font-tajawal text-slate-800">{createdBatch.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* إشعار بالمواقع الجغرافية الجديدة بعد الاستيراد + زر التحويل */}
            {geoUnknownList.length > 0 && (
              <div className="bg-sky-50 border-2 border-sky-300 rounded-2xl p-4 flex items-start gap-3">
                <Globe className="w-6 h-6 text-sky-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h4 className="font-cairo font-bold text-sm text-sky-900">
                    توجد {geoUnknownList.length} مواقع جديدة (دول/مدن/جنسيات) بانتظار مراجعتك
                  </h4>
                  <p className="text-xs text-sky-700 font-tajawal leading-relaxed">
                    اكتُشفت مواقع غير مسجّلة في المنصة ضمن هذه الدفعة. راجعها واعتمدها من صفحة «الدول والمدن» لتظهر رسمياً في فلاتر البحث والتسجيل.
                  </p>
                  <button
                    onClick={() => navigate('/admin/cities')}
                    className="mt-1 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-cairo font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <MapPin className="w-4 h-4" /> الذهاب لإدارة الدول والمدن
                  </button>
                </div>
              </div>
            )}

            {/* أزرار */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('preview')}
                className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-sm transition-colors flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" /> العودة للمعاينة والتعديل
              </button>
              <button
                onClick={resetImport}
                className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-cairo font-bold text-sm hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> استيراد جديد
              </button>
              <button
                onClick={() => navigate('/admin/members')}
                className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Users className="w-5 h-5" /> عرض الأعضاء
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* سجل الدفعات */}
      {batches.length > 0 && step === 'setup' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-cairo font-bold text-lg text-slate-800 flex items-center gap-2 mb-4">
            <Table className="w-5 h-5 text-amber-500" /> سجل الدفعات السابقة
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2 text-right font-cairo font-bold text-slate-600">رقم الدفعة</th>
                  <th className="px-4 py-2 text-right font-cairo font-bold text-slate-600">الخطابة</th>
                  <th className="px-4 py-2 text-right font-cairo font-bold text-slate-600">التاريخ</th>
                  <th className="px-4 py-2 text-right font-cairo font-bold text-slate-600">الأعضاء</th>
                  <th className="px-4 py-2 text-right font-cairo font-bold text-slate-600">المكررات</th>
                  <th className="px-4 py-2 text-right font-cairo font-bold text-slate-600">الأخطاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.slice(0, 5).map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-cairo font-bold text-amber-600">{b.batchNumber}</td>
                    <td className="px-4 py-2 font-tajawal text-slate-700">{b.officeName || '—'}</td>
                    <td className="px-4 py-2 font-tajawal text-slate-700">{new Date(b.importDate).toLocaleDateString('ar-SA')}</td>
                    <td className="px-4 py-2 font-cairo font-bold text-emerald-600">{b.membersCount}</td>
                    <td className="px-4 py-2 font-cairo font-bold text-amber-600">{b.duplicatesCount}</td>
                    <td className="px-4 py-2 font-cairo font-bold text-rose-600">{b.errorsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      ) : (
        /* ===== قسم مركز تصدير الأعضاء المتقدم ===== */
        <div className="space-y-6">
          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-cairo mb-1">
                <Users className="w-4 h-4 text-amber-500" /> إجمالي الأعضاء
              </div>
              <div className="text-2xl font-bold font-cairo text-slate-900">{adminMembers?.length || 0}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-cairo mb-1">
                <Filter className="w-4 h-4 text-emerald-500" /> محدد للتصدير
              </div>
              <div className="text-2xl font-bold font-cairo text-emerald-600">{exportFilteredMembers.length}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-cairo mb-1">
                <Upload className="w-4 h-4 text-blue-500" /> أعضاء مستوردون
              </div>
              <div className="text-2xl font-bold font-cairo text-blue-600">
                {(adminMembers || []).filter(m => Boolean(m.batchNumber || m.batch_number || m.batchId)).length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-cairo mb-1">
                <Table className="w-4 h-4 text-purple-500" /> دفعات الاستيراد
              </div>
              <div className="text-2xl font-bold font-cairo text-purple-600">{allBatches.length}</div>
            </div>
          </div>

          {/* صندوق الفلاتر وإعدادات التصدير */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-cairo font-bold text-lg text-slate-900 flex items-center gap-2">
                  <FileDown className="w-5 h-5 text-amber-500" /> تخصيص وفلترة التصدير
                </h3>
                <p className="text-xs text-slate-500 font-tajawal mt-1">
                  اختر الفئة المراد تصديرها، الصيغة المطلوبة، ونموذج الأعمدة
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => exportMembersToExcel(exportFilteredMembers, 'members_export', exportFormatMode)}
                  disabled={exportFilteredMembers.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-cairo font-bold text-sm transition-all shadow-sm cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" /> تصدير Excel (.xlsx) ({exportFilteredMembers.length})
                </button>
                <button
                  onClick={() => {
                    if (exportFormatMode === 'import_template') {
                      exportMembersForImportTemplate(exportFilteredMembers, 'members_export');
                    } else {
                      exportMembersWithFullDetails(exportFilteredMembers, 'members_export', 'csv');
                    }
                  }}
                  disabled={exportFilteredMembers.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-cairo font-bold text-sm transition-all shadow-sm cursor-pointer"
                >
                  <FileDown className="w-4 h-4" /> تصدير CSV ({exportFilteredMembers.length})
                </button>
                <button
                  onClick={() => exportMembersWithFullDetails(exportFilteredMembers, 'members_export', 'json')}
                  disabled={exportFilteredMembers.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-cairo font-bold text-sm transition-all shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" /> تصدير JSON
                </button>
              </div>
            </div>

            {/* شبكة الفلاتر */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">نطاق الأعضاء</label>
                <select
                  value={exportScope}
                  onChange={e => setExportScope(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-tajawal focus:border-amber-400 focus:outline-none"
                >
                  <option value="all">جميع الأعضاء ({adminMembers?.length || 0})</option>
                  <option value="imported">الأعضاء المستوردون عبر الدفعات فقط</option>
                  <option value="registered">الأعضاء المسجلون ذاتياً فقط</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">الجنس</label>
                <select
                  value={exportGender}
                  onChange={e => setExportGender(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-tajawal focus:border-amber-400 focus:outline-none"
                >
                  <option value="all">الكل (رجال ونساء)</option>
                  <option value="male">رجال فقط</option>
                  <option value="female">نساء فقط</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">حسب الدفعة المستوردة</label>
                <select
                  value={exportBatchId}
                  onChange={e => setExportBatchId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-tajawal focus:border-amber-400 focus:outline-none"
                >
                  <option value="all">كافة الدفعات</option>
                  {allBatches.map(b => (
                    <option key={b.id} value={b.batchNumber}>
                      {b.batchNumber} - {b.officeName || 'بدون خطابة'} ({b.membersCount} عضو)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">حسب الخطابة / المكتب</label>
                <select
                  value={exportOfficeName}
                  onChange={e => setExportOfficeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-tajawal focus:border-amber-400 focus:outline-none"
                >
                  <option value="all">كافة الخطابات والمكاتب</option>
                  {offices.map(o => (
                    <option key={o.id} value={o.name}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">حسب القائمة المخصصة</label>
                <select
                  value={exportCustomListId}
                  onChange={e => setExportCustomListId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-tajawal focus:border-amber-400 focus:outline-none"
                >
                  <option value="all">كافة القوائم</option>
                  {customLists.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.memberIds?.length || 0} عضو)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1.5">نمط أعمدة التصدير</label>
                <select
                  value={exportFormatMode}
                  onChange={e => setExportFormatMode(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-cairo font-semibold focus:border-amber-400 focus:outline-none"
                >
                  <option value="full">تصدير تفصيلي شامل (كافة الحقول والملاحظات والشريك)</option>
                  <option value="import_template">نموذج جاهز للاستيراد (25 عموداً قياسياً مطابقاً للاستيراد)</option>
                </select>
              </div>
            </div>

            {/* شريط الإحصائية والمساعدة */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="text-xs font-tajawal text-amber-900 leading-relaxed">
                  <strong>جاهزية وتوافق كامل:</strong> ملفات Excel (.xlsx) تُنشأ بتنسيق RTL مدمج وترميز نصوص عربية دقيق بدون أي تشوه، مع تطابق تام لحقول المنصة. يمكنك إعادة استيراد أي ملف تم تصديره بنموذج الاستيراد مباشرة بنقرة زر واحدة.
                </div>
              </div>
              <div className="font-cairo font-bold text-amber-900 text-sm bg-amber-100 px-3 py-1.5 rounded-lg">
                سيتم تصدير: {exportFilteredMembers.length} من أصل {adminMembers?.length || 0}
              </div>
            </div>
          </div>

          {/* جدول معاينة عينة من الأعضاء المحددين */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-cairo font-bold text-base text-slate-800 flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-500" /> عينة من الأعضاء المشمولين بالتصدير (أول {Math.min(exportFilteredMembers.length, 10)} أعضاء)
              </h4>
              <span className="text-xs text-slate-500 font-tajawal bg-slate-100 px-2.5 py-1 rounded-lg">
                إجمالي السجلات المطابقة: {exportFilteredMembers.length}
              </span>
            </div>

            {exportFilteredMembers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-tajawal bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                لا يوجد أعضاء مطابقون للفلاتر المحددة حالياً. جرّب تعديل الفلاتر أعلاه.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-cairo font-bold border-b border-slate-200">
                      <th className="p-3 text-right">#</th>
                      <th className="p-3 text-right">الاسم / المعرف</th>
                      <th className="p-3 text-right">الجنس</th>
                      <th className="p-3 text-right">العمر</th>
                      <th className="p-3 text-right">الدولة والمدينة</th>
                      <th className="p-3 text-right">الحالة الاجتماعية</th>
                      <th className="p-3 text-right">نوع الزواج</th>
                      <th className="p-3 text-right">القبيلة / النسب</th>
                      <th className="p-3 text-right">الدفعة / المصدر</th>
                      <th className="p-3 text-right">رقم التواصل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-tajawal">
                    {exportFilteredMembers.slice(0, 10).map((m, idx) => (
                      <tr key={m.id || idx} className="hover:bg-slate-50/80">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-cairo font-bold text-slate-800">
                          {m.nickname || m.realName || m.username || m.id}
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-cairo font-semibold ${
                            m.gender === 'male' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {m.gender === 'male' ? 'ذكر' : 'أنثى'}
                          </span>
                        </td>
                        <td className="p-3">{m.age || '—'}</td>
                        <td className="p-3">{m.city ? `${m.city} (${m.country || 'السعودية'})` : (m.country || '—')}</td>
                        <td className="p-3">{m.maritalLabel || m.maritalStatus || '—'}</td>
                        <td className="p-3">{m.marriageTypeLabel || m.marriageType || '—'}</td>
                        <td className="p-3">{m.tribe || '—'}</td>
                        <td className="p-3">
                          {m.batchNumber ? (
                            <span className="font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                              {m.batchNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400">مسجل ذاتياً</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-600">{m.whatsapp || m.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Modal تعديل بيانات العضو المباشر */}
      <Modal
        open={editingRowIndex !== null && editingRowData !== null}
        onClose={() => { setEditingRowIndex(null); setEditingRowData(null); }}
        title={`تعديل بيانات العضو رقم ${editingRowIndex !== null ? editingRowIndex + 1 : ''}`}
        size="lg"
      >
        {editingRowData && (
          <div className="space-y-4 text-right" dir="rtl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">الجنس</label>
                <select
                  value={editingRowData.gender || 'male'}
                  onChange={e => setEditingRowData({ ...editingRowData, gender: e.target.value })}
                  className="w-full text-xs font-cairo bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                >
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">العمر</label>
                <input
                  type="number"
                  value={editingRowData.age || ''}
                  onChange={e => setEditingRowData({ ...editingRowData, age: e.target.value })}
                  className="w-full text-xs font-tajawal bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                  placeholder="مثال: 28"
                />
              </div>
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">الحالة الاجتماعية</label>
                <input
                  type="text"
                  value={editingRowData.marital_status || editingRowData.maritalStatus || ''}
                  onChange={e => setEditingRowData({ ...editingRowData, marital_status: e.target.value })}
                  className="w-full text-xs font-tajawal bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                  placeholder="أعزب / مطلقة / أرمة..."
                />
              </div>
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">الدولة</label>
                <input
                  type="text"
                  value={editingRowData.country || ''}
                  onChange={e => setEditingRowData({ ...editingRowData, country: e.target.value })}
                  className="w-full text-xs font-tajawal bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                  placeholder="السعودية"
                />
              </div>
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">المدينة</label>
                <input
                  type="text"
                  value={editingRowData.city || ''}
                  onChange={e => setEditingRowData({ ...editingRowData, city: e.target.value })}
                  className="w-full text-xs font-tajawal bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                  placeholder="الرياض / جدة..."
                />
              </div>
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">الجنسية</label>
                <input
                  type="text"
                  value={editingRowData.nationality || ''}
                  onChange={e => setEditingRowData({ ...editingRowData, nationality: e.target.value })}
                  className="w-full text-xs font-tajawal bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                  placeholder="سعودي / أردني..."
                />
              </div>
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">رقم الواتساب (خاص للإدارة)</label>
                <input
                  type="text"
                  value={editingRowData.whatsapp || editingRowData.phone || ''}
                  onChange={e => setEditingRowData({ ...editingRowData, whatsapp: e.target.value, phone: e.target.value })}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                  placeholder="05xxxxxxx"
                />
              </div>
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">نوع الزواج</label>
                <select
                  value={editingRowData.marriage_type || editingRowData.marriageType || 'announced'}
                  onChange={e => setEditingRowData({ ...editingRowData, marriage_type: e.target.value, marriageType: e.target.value })}
                  className="w-full text-xs font-cairo bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                >
                  <option value="announced">معلن</option>
                  <option value="misyar">مسيار</option>
                  <option value="both">لا مانع / معلن او مسيار</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">جنسية الشريك المطلوبة</label>
                <input
                  type="text"
                  value={editingRowData.partner_nationality || editingRowData.pNationality || ''}
                  onChange={e => setEditingRowData({ ...editingRowData, partner_nationality: e.target.value, pNationality: e.target.value })}
                  className="w-full text-xs font-tajawal bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                  placeholder="مثال: السعودية / أي جنسية..."
                />
              </div>
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">المدن المقبولة للشريك</label>
                <input
                  type="text"
                  value={editingRowData.partner_cities || editingRowData.partner_city || editingRowData.pCity || ''}
                  onChange={e => setEditingRowData({ ...editingRowData, partner_cities: e.target.value, partner_city: e.target.value, pCity: e.target.value })}
                  className="w-full text-xs font-tajawal bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                  placeholder="مثال: الرياض، جدة، كافة المناطق..."
                />
              </div>
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">عمر الشريك (من - إلى)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={editingRowData.partner_age_min || editingRowData.pAgeMin || ''}
                    onChange={e => setEditingRowData({ ...editingRowData, partner_age_min: e.target.value, pAgeMin: e.target.value })}
                    className="w-1/2 text-xs font-tajawal bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                    placeholder="من: 22"
                  />
                  <span className="text-slate-400 text-xs">-</span>
                  <input
                    type="number"
                    value={editingRowData.partner_age_max || editingRowData.pAgeMax || ''}
                    onChange={e => setEditingRowData({ ...editingRowData, partner_age_max: e.target.value, pAgeMax: e.target.value })}
                    className="w-1/2 text-xs font-tajawal bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                    placeholder="إلى: 35"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">قبول غير مواطن / أجنبي</label>
                <select
                  value={editingRowData.accept_foreigner || editingRowData.acceptForeigner || 'لا'}
                  onChange={e => setEditingRowData({ ...editingRowData, accept_foreigner: e.target.value, acceptForeigner: e.target.value })}
                  className="w-full text-xs font-cairo bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                >
                  <option value="لا">لا</option>
                  <option value="نعم">نعم</option>
                  <option value="لا مانع">لا مانع</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">نبذة عني (ظاهرة للجميع)</label>
              <textarea
                rows={2}
                value={editingRowData.bio || ''}
                onChange={e => setEditingRowData({ ...editingRowData, bio: e.target.value })}
                className="w-full text-xs font-tajawal bg-slate-50 border border-slate-200 rounded-lg p-2.5 resize-none"
                placeholder="المواصفات الشخصية والشروط..."
              />
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-slate-700 mb-1">مواصفات الشريك / المهر والمرغوب (ظاهرة للجميع)</label>
              <textarea
                rows={2}
                value={editingRowData.p_notes || editingRowData.pNotes || ''}
                onChange={e => setEditingRowData({ ...editingRowData, p_notes: e.target.value, pNotes: e.target.value })}
                className="w-full text-xs font-tajawal bg-slate-50 border border-slate-200 rounded-lg p-2.5 resize-none"
                placeholder="مواصفات الشريك والالتزامات المالية كالمهر والمصروف..."
              />
            </div>

            <div>
              <label className="block text-xs font-cairo font-bold text-amber-700 mb-1">🔒 ملاحظات الإدارة والعمولات ورقم الولي (سرية للإدارة فقط)</label>
              <textarea
                rows={2}
                value={editingRowData.admin_notes || editingRowData.adminNotes || ''}
                onChange={e => setEditingRowData({ ...editingRowData, admin_notes: e.target.value })}
                className="w-full text-xs font-tajawal bg-amber-50/50 border border-amber-200 rounded-lg p-2.5 resize-none"
                placeholder="أرقام أولياء الأمور، العمولات، الملاحظات الداخلية..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveEditRow}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-cairo font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> حفظ التعديلات
              </button>
              <button
                onClick={() => { setEditingRowIndex(null); setEditingRowData(null); }}
                className="px-5 py-3 rounded-xl bg-slate-100 text-slate-700 font-cairo font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal توجيه وأوامر الذكاء الاصطناعي الموحد */}
      <Modal open={showAiPromptModal} onClose={() => setShowAiPromptModal(false)} title="توجيه وأوامر الذكاء الاصطناعي (AI Prompt) لاستيراد استمارات ومحادثات الواتساب" size="lg">
        <div className="space-y-4 text-right" dir="rtl">
          {/* تبويب اختيار الصيغة */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span className="font-cairo font-bold text-slate-800 text-sm">اختر صيغة الإخراج المرغوبة من الذكاء الاصطناعي:</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAiPromptFormat('csv')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-cairo font-bold transition-all ${
                  aiPromptFormat === 'csv'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📊 صيغة CSV (الأعمدة القياسية)
              </button>
              <button
                type="button"
                onClick={() => setAiPromptFormat('json')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-cairo font-bold transition-all ${
                  aiPromptFormat === 'json'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⚡ صيغة JSON (مقاومة للفواصل والنصوص الطويلة)
              </button>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-purple-700" />
              <span className="font-cairo font-bold text-purple-900 text-sm">
                مزايا التوجيه المطور ({aiPromptFormat === 'csv' ? 'CSV' : 'JSON'}):
              </span>
            </div>
            <ul className="text-xs text-purple-800 font-tajawal space-y-1 list-disc list-inside leading-relaxed">
              <li><strong>تصفية الشات:</strong> يتجاهل تلقائياً كافة سوالف ومحادثات القروب العادية ويركز حصراً على استمارات الزواج.</li>
              <li><strong>استخراج رقم الناشر:</strong> يلتقط رقم هاتف ناشر الاستمارة من رأس رسالة الواتساب ويضعه في واتساب وملاحظات الإدارة.</li>
              <li><strong>تفكيك شروط الشريك:</strong> يستخرج الجنسية والمدن والأعمار وشروط الأجنبي والمهر بدقة متناهية.</li>
              <li><strong>التعامل مع التعدد والمسيار:</strong> يصنف نوع الزواج ورغبة التعدد وفقاً لمعايير المنصة.</li>
            </ul>
          </div>

          <div className="bg-slate-900 rounded-xl p-4 max-h-[45vh] overflow-y-auto font-mono text-xs text-emerald-300 dir-ltr text-left">
            <pre className="whitespace-pre-wrap leading-relaxed font-sans" dir="rtl">
              {MASTER_UNIFIED_AI_PROMPT}
            </pre>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copyAiPrompt}
              className={`flex-1 py-3.5 rounded-xl font-cairo font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                aiPromptCopied 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {aiPromptCopied ? (
                <>
                  <CheckCircle2 className="w-5 h-5" /> تم نسخ توجيه ({aiPromptFormat.toUpperCase()}) بنجاح ✓
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" /> نسخ توجيه ({aiPromptFormat.toUpperCase()}) لـ AI
                </>
              )}
            </button>
            <button
              onClick={() => setShowAiPromptModal(false)}
              className="px-6 py-3.5 rounded-xl bg-slate-100 text-slate-700 font-cairo font-bold text-sm hover:bg-slate-200 transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
