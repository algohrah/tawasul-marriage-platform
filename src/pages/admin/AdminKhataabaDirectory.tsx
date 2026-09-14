import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  ShieldAlert,
  UserCheck,
  Building2,
  Phone,
  Search,
  Plus,
  Trash2,
  Edit3,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Ban,
  FileText,
  Filter,
  RefreshCw,
  X,
  UserX,
  PhoneCall,
  Sparkles,
  ChevronLeft,
  Info,
  CheckSquare,
  Square,
  Snowflake,
  Star,
  ArrowUpDown,
  Check,
  ShieldCheck,
  Award
} from 'lucide-react';
import {
  getKhataabaDirectory,
  saveKhataabaDirectory,
  upsertKhataabaRecord,
  syncKhataabasFromMembers,
  updateKhataabaStatus,
  deleteKhataabaRecord,
  deleteMembersByKhataaba,
  deleteMembersByOffice,
  deleteSelectedMembers,
  batchUpdateMembers,
  getImportOffices,
  addImportOffice,
  deleteImportOffice,
  doesMemberBelongToKhataaba,
  doesMemberBelongToOffice,
  normalizePhoneForMatching,
  KhataabaRecord,
  KhataabaStatus,
  ImportOffice
} from '../../lib/importBatches';
import { useApp } from '../../lib/AppContext';
import { dataService } from '../../lib/data/DataService';
import MemberCard from '../../components/MemberCard';
import AdminMemberDetailModal from '../../components/admin/AdminMemberDetailModal';
import CustomListsPanel from '../../components/admin/CustomListsPanel';

export default function AdminKhataabaDirectory() {
  const { adminMembers, setAdminMembers, setMembers } = useApp();
  const [searchParams] = useSearchParams();
  const refreshAdminMembers = async () => {
    const refreshed = await dataService.db.adminGetMembers();
    if (!Array.isArray(refreshed)) return;
    setAdminMembers(refreshed as any);
    setMembers(refreshed.filter((member: any) => !member.status || member.status === 'active') as any);
  };
  const [activeTab, setActiveTab] = useState<'offices' | 'khataabas' | 'lists' | 'blacklist'>(() => searchParams.get('panel') === 'lists' ? 'lists' : 'khataabas');

  useEffect(() => {
    if (searchParams.get('panel') === 'lists') setActiveTab('lists');
  }, [searchParams]);

  // بيانات دليل الخطابات والمكاتب
  const [khataabas, setKhataabas] = useState<KhataabaRecord[]>([]);
  const [offices, setOffices] = useState<ImportOffice[]>([]);
  
  // شريط البحث والفلترة
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'warning' | 'blocked'>('all');
  const [officeFilter, setOfficeFilter] = useState<string>('all');
  const [khataabaSort, setKhataabaSort] = useState<'most_members' | 'least_members' | 'alphabetical' | 'status' | 'newest'>('most_members');
  const [hasMembersFilter, setHasMembersFilter] = useState<'all' | 'with_members' | 'no_members'>('all');

  // شريط البحث والفرز للمكاتب والقروبات
  const [officeSearchQuery, setOfficeSearchQuery] = useState('');
  const [officeSort, setOfficeSort] = useState<'most_members' | 'least_members' | 'most_khataabas' | 'alphabetical'>('most_members');

  // التحديد الجماعي للأعضاء في المودال
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // معاينة وتعديل بيانات العضو عبر المودال الموحد (مطابق لقسم الأعضاء)
  const [selectedMemberForModal, setSelectedMemberForModal] = useState<any | null>(null);
  const [modalInitialEditing, setModalInitialEditing] = useState<boolean>(false);

  // النوافذ المنسدلة والمودال
  const [showAddKhataabaModal, setShowAddKhataabaModal] = useState(false);
  const [showAddOfficeModal, setShowAddOfficeModal] = useState(false);
  const [editingKhataaba, setEditingKhataaba] = useState<KhataabaRecord | null>(null);
  
  // نموذج إضافة/تعديل خطابة
  const [khataabaForm, setKhataabaForm] = useState<{
    phone: string;
    name: string;
    status: KhataabaStatus;
    notes: string;
    officeName: string;
  }>({
    phone: '',
    name: '',
    status: 'active',
    notes: '',
    officeName: '',
  });

  // نموذج إضافة مكتب جديد
  const [newOfficeName, setNewOfficeName] = useState('');

  // استعراض أعضاء جهة معينة (خطابة أو مكتب)
  const [viewingTarget, setViewingTarget] = useState<{
    type: 'khataaba' | 'office';
    identifier: string; // phone or office name
    displayName: string;
  } | null>(null);

  // تأكيد الحذف الجماعي
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    type: 'khataaba' | 'office';
    identifier: string;
    displayName: string;
    count: number;
    alsoBlockKhataaba?: boolean;
  } | null>(null);

  // تحميل البيانات الأولية وتزامن الخطابات من الأعضاء
  const reloadData = () => {
    if (adminMembers && adminMembers.length > 0) {
      syncKhataabasFromMembers(adminMembers);
    }
    setKhataabas(getKhataabaDirectory());
    setOffices(getImportOffices());
    void refreshAdminMembers();
  };

  useEffect(() => {
    if (adminMembers && adminMembers.length > 0) {
      syncKhataabasFromMembers(adminMembers);
    }
    setKhataabas(getKhataabaDirectory());
    setOffices(getImportOffices());

    const handleUpdate = () => {
      setKhataabas(getKhataabaDirectory());
      setOffices(getImportOffices());
    };
    window.addEventListener('twafok_members_updated', handleUpdate);
    return () => window.removeEventListener('twafok_members_updated', handleUpdate);
  }, [adminMembers]);

  // حساب الأعضاء والارتباطات لكل خطابة ومكتب ديناميكياً من `adminMembers`
  const membersList = adminMembers || [];

  // خريطة إحصائيات الخطابات
  const khataabaStatsMap = useMemo(() => {
    const stats: Record<string, { membersCount: number; offices: Set<string>; members: any[] }> = {};

    khataabas.forEach((k) => {
      const kMembers = membersList.filter((m) => doesMemberBelongToKhataaba(m, k));
      const officesSet = new Set<string>(k.offices || []);
      kMembers.forEach((m) => {
        if (m.importOfficeName) officesSet.add(m.importOfficeName);
      });
      stats[k.id] = {
        membersCount: kMembers.length,
        offices: officesSet,
        members: kMembers,
      };
    });

    return stats;
  }, [membersList, khataabas]);

  // خريطة إحصائيات المكاتب/القروبات
  const officeStatsMap = useMemo(() => {
    const stats: Record<string, { membersCount: number; khataabas: Map<string, number>; members: any[] }> = {};

    offices.forEach((o) => {
      const oMembers = membersList.filter((m) => doesMemberBelongToOffice(m, o.name, khataabas));
      const khataabaCounts = new Map<string, number>();

      oMembers.forEach((m) => {
        const matchedK = khataabas.find((k) => doesMemberBelongToKhataaba(m, k));
        const kLabel = matchedK?.name || m.khataabaName || (m.khataabaPhone ? `خطابة (${m.khataabaPhone})` : 'مستورد مباشر');
        khataabaCounts.set(kLabel, (khataabaCounts.get(kLabel) || 0) + 1);
      });

      stats[o.name] = {
        membersCount: oMembers.length,
        khataabas: khataabaCounts,
        members: oMembers,
      };
    });

    // إضافة أي مكاتب فرعية غير مسجلة صراحة
    membersList.forEach((m) => {
      const offName = (m.importOfficeName || '').trim();
      if (offName && !stats[offName]) {
        const oMembers = membersList.filter((m2) => doesMemberBelongToOffice(m2, offName, khataabas));
        const khataabaCounts = new Map<string, number>();
        oMembers.forEach((m2) => {
          const matchedK = khataabas.find((k) => doesMemberBelongToKhataaba(m2, k));
          const kLabel = matchedK?.name || m2.khataabaName || (m2.khataabaPhone ? `خطابة (${m2.khataabaPhone})` : 'مستورد مباشر');
          khataabaCounts.set(kLabel, (khataabaCounts.get(kLabel) || 0) + 1);
        });
        stats[offName] = {
          membersCount: oMembers.length,
          khataabas: khataabaCounts,
          members: oMembers,
        };
      }
    });

    return stats;
  }, [membersList, offices, khataabas]);

  // الخطابات المفلترة والمنظمة للعرض
  const filteredKhataabas = useMemo(() => {
    let result = khataabas.filter((k) => {
      const matchSearch =
        k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.phone.includes(searchQuery) ||
        (k.notes && k.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === 'all' || k.status === statusFilter;
      const matchOffice = officeFilter === 'all' || (k.offices && k.offices.includes(officeFilter));

      const count = khataabaStatsMap[k.id]?.membersCount || 0;
      const matchHasMembers =
        hasMembersFilter === 'all' ||
        (hasMembersFilter === 'with_members' && count > 0) ||
        (hasMembersFilter === 'no_members' && count === 0);

      return matchSearch && matchStatus && matchOffice && matchHasMembers;
    });

    result.sort((a, b) => {
      const countA = khataabaStatsMap[a.id]?.membersCount || 0;
      const countB = khataabaStatsMap[b.id]?.membersCount || 0;

      if (khataabaSort === 'most_members') return countB - countA;
      if (khataabaSort === 'least_members') return countA - countB;
      if (khataabaSort === 'alphabetical') return a.name.localeCompare(b.name, 'ar');
      if (khataabaSort === 'status') {
        const priority = { active: 1, warning: 2, blocked: 3 };
        return (priority[a.status] || 9) - (priority[b.status] || 9);
      }
      if (khataabaSort === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      return 0;
    });

    return result;
  }, [khataabas, searchQuery, statusFilter, officeFilter, hasMembersFilter, khataabaSort, khataabaStatsMap]);

  // المكاتب المفلترة والمنظمة للعرض
  const filteredOfficesList = useMemo(() => {
    const keys = Object.keys(officeStatsMap);
    let list = keys.map((officeName) => {
      const stats = officeStatsMap[officeName];
      return {
        name: officeName,
        membersCount: stats.membersCount,
        khataabasCount: stats.khataabas.size,
        members: stats.members,
        khataabasMap: stats.khataabas,
      };
    });

    if (officeSearchQuery.trim()) {
      const q = officeSearchQuery.trim().toLowerCase();
      list = list.filter((item) => item.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (officeSort === 'most_members') return b.membersCount - a.membersCount;
      if (officeSort === 'least_members') return a.membersCount - b.membersCount;
      if (officeSort === 'most_khataabas') return b.khataabasCount - a.khataabasCount;
      if (officeSort === 'alphabetical') return a.name.localeCompare(b.name, 'ar');
      return 0;
    });

    return list;
  }, [officeStatsMap, officeSearchQuery, officeSort]);

  // الخطابات المحظورة فقط
  const blockedKhataabas = useMemo(() => {
    return khataabas.filter((k) => k.status === 'blocked');
  }, [khataabas]);

  // إحصائيات إجمالية
  const totalActiveKhataabas = khataabas.filter((k) => k.status === 'active').length;
  const totalWarningKhataabas = khataabas.filter((k) => k.status === 'warning').length;
  const totalBlockedKhataabas = khataabas.filter((k) => k.status === 'blocked').length;
  const totalImportedMembers = membersList.filter((m) => m.sourceType === 'imported' || m.importOfficeName || m.khataabaPhone).length;

  // حفظ / إضافة خطابة
  const handleSaveKhataaba = (e: React.FormEvent) => {
    e.preventDefault();
    if (!khataabaForm.phone && !khataabaForm.name) {
      alert('يرجى إدخال اسم الخطابة أو رقم الواتساب الخاص بها على الأقل');
      return;
    }

    upsertKhataabaRecord({
      phone: khataabaForm.phone,
      name: khataabaForm.name,
      status: khataabaForm.status,
      notes: khataabaForm.notes,
      officeName: khataabaForm.officeName || undefined,
    });

    setShowAddKhataabaModal(false);
    setEditingKhataaba(null);
    setKhataabaForm({ phone: '', name: '', status: 'active', notes: '', officeName: '' });
    reloadData();
  };

  // تعديل خطابة
  const handleEditKhataaba = (k: KhataabaRecord) => {
    setEditingKhataaba(k);
    setKhataabaForm({
      phone: k.phone,
      name: k.name,
      status: k.status,
      notes: k.notes || '',
      officeName: k.offices?.[0] || '',
    });
    setShowAddKhataabaModal(true);
  };

  // تغيير حالة خطابة سريعا
  const handleQuickStatusChange = (id: string, status: KhataabaStatus) => {
    updateKhataabaStatus(id, status);
    reloadData();
  };

  // إضافة مكتب/قروب جديد
  const handleAddOffice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficeName.trim()) return;
    addImportOffice(newOfficeName.trim());
    setNewOfficeName('');
    setShowAddOfficeModal(false);
    reloadData();
  };

  // حذف مكتب من القائمة
  const handleDeleteOfficeEntry = (id: string) => {
    if (confirm('هل أنت تأكد من حذف هذا المكتب من القائمة؟ (لن يتم حذف الأعضاء المنسوبين له إلا بدالة الحذف الجماعي)')) {
      deleteImportOffice(id);
      reloadData();
    }
  };

  // تنفيذ الحذف الجماعي لأعضاء الخطابة أو القروب
  const executeGroupDelete = () => {
    if (!confirmDeleteTarget) return;

    if (confirmDeleteTarget.type === 'khataaba') {
      const res = deleteMembersByKhataaba(confirmDeleteTarget.identifier);
      if (confirmDeleteTarget.alsoBlockKhataaba) {
        updateKhataabaStatus(confirmDeleteTarget.identifier, 'blocked', 'تم حظرها وتطبيق حذف جماعي لأعضائها بواسطة الإدارة');
      }
      alert(`تم حذف (${res.deletedCount}) عضواً منسوباً للخطابة [${confirmDeleteTarget.displayName}] بنجاح.`);
    } else {
      const res = deleteMembersByOffice(confirmDeleteTarget.identifier);
      alert(`تم حذف (${res.deletedCount}) عضواً منسوباً للقروب/المكتب [${confirmDeleteTarget.displayName}] بنجاح.`);
    }

    setConfirmDeleteTarget(null);
    reloadData();
  };

  // استخراج قائمة أعضاء الاستعراض المباشر
  const viewingMembersList = useMemo(() => {
    if (!viewingTarget) return [];
    if (viewingTarget.type === 'khataaba') {
      const k = khataabas.find((rec) => rec.id === viewingTarget.identifier || rec.phone === viewingTarget.identifier);
      if (k) {
        return membersList.filter((m) => doesMemberBelongToKhataaba(m, k));
      }
      return membersList.filter((m) => {
        const targetPhone = normalizePhoneForMatching(viewingTarget.identifier);
        const targetName = viewingTarget.displayName.trim().toLowerCase();
        const mKPhone = normalizePhoneForMatching(m.khataabaPhone);
        const mKName = (m.khataabaName || '').trim().toLowerCase();
        const mNotes = `${m.importNotes || ''} ${m.adminNote || ''}`;
        return (targetPhone && mKPhone && mKPhone === targetPhone) ||
               (targetName && mKName && mKName === targetName) ||
               (targetPhone && mNotes.replace(/[^\d]/g, '').includes(targetPhone));
      });
    } else {
      return membersList.filter((m) => doesMemberBelongToOffice(m, viewingTarget.identifier, khataabas));
    }
  }, [viewingTarget, membersList, khataabas]);

  // إدارة تحديد الأعضاء وإلغاء التحديد
  const toggleSelectMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllMembers = () => {
    if (selectedMemberIds.length === viewingMembersList.length && viewingMembersList.length > 0) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(viewingMembersList.map((m) => m.id));
    }
  };

  // تفريغ التحديد عند تغير الجهة المستعرضة
  useEffect(() => {
    setSelectedMemberIds([]);
  }, [viewingTarget]);

  // الإجراءات الجماعية على الأعضاء المحددين في المودال
  const handleBulkDeleteSelected = () => {
    if (selectedMemberIds.length === 0) return;
    if (confirm(`هل أنت تأكد من حذف ${selectedMemberIds.length} عضواً محدداً نهائياً من النظام؟`)) {
      const res = deleteSelectedMembers(selectedMemberIds);
      alert(`تم حذف ${res.deletedCount} عضواً بنجاح`);
      setSelectedMemberIds([]);
      refreshAdminMembers();
      reloadData();
    }
  };

  const handleBulkBlockSelected = () => {
    if (selectedMemberIds.length === 0) return;
    if (confirm(`هل تريد حظر ${selectedMemberIds.length} عضواً محدداً؟`)) {
      const res = batchUpdateMembers(selectedMemberIds, { status: 'banned', verified: false });
      alert(`تم حظر ${res.updatedCount} عضواً بنجاح`);
      setSelectedMemberIds([]);
      refreshAdminMembers();
      reloadData();
    }
  };

  const handleBulkFreezeSelected = () => {
    if (selectedMemberIds.length === 0) return;
    if (confirm(`هل تريد تجميد / إيقاف حسابات ${selectedMemberIds.length} عضواً محدداً؟`)) {
      const res = batchUpdateMembers(selectedMemberIds, { status: 'suspended' });
      alert(`تم تجميد ${res.updatedCount} عضواً بنجاح`);
      setSelectedMemberIds([]);
      refreshAdminMembers();
      reloadData();
    }
  };

  const handleBulkActivateSelected = () => {
    if (selectedMemberIds.length === 0) return;
    const res = batchUpdateMembers(selectedMemberIds, { status: 'active', verified: true });
    alert(`تم تنشيط ${res.updatedCount} عضواً بنجاح`);
    setSelectedMemberIds([]);
    refreshAdminMembers();
    reloadData();
  };

  const handleBulkVerifySelected = () => {
    if (selectedMemberIds.length === 0) return;
    const res = batchUpdateMembers(selectedMemberIds, { verified: true });
    alert(`تم توثيق حسابات ${res.updatedCount} عضواً بنجاح 🛡️`);
    setSelectedMemberIds([]);
    refreshAdminMembers();
    reloadData();
  };

  const handleBulkVIPSelected = () => {
    if (selectedMemberIds.length === 0) return;
    const res = batchUpdateMembers(selectedMemberIds, { premium: true, plan: 'elite', hasSeriousnessBadge: true });
    alert(`تم تحويل ${res.updatedCount} عضواً إلى عضوية مميزة (VIP) بنجاح ⭐`);
    setSelectedMemberIds([]);
    refreshAdminMembers();
    reloadData();
  };

  const handleBulkSeriousnessSelected = () => {
    if (selectedMemberIds.length === 0) return;
    const res = batchUpdateMembers(selectedMemberIds, { hasSeriousnessBadge: true });
    alert(`تم منح وسام الجدية لـ ${res.updatedCount} عضواً بنجاح 🏅`);
    setSelectedMemberIds([]);
    refreshAdminMembers();
    reloadData();
  };

  const handleBulkStandardSelected = () => {
    if (selectedMemberIds.length === 0) return;
    const res = batchUpdateMembers(selectedMemberIds, { premium: false, plan: 'free' });
    alert(`تم تحويل ${res.updatedCount} عضواً إلى الباقة العادية بنجاح`);
    setSelectedMemberIds([]);
    refreshAdminMembers();
    reloadData();
  };

  return (
    <div className="space-y-6 pb-16 font-cairo">
      {/* 1. الترويسة الرئيسية والإحصائيات */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                <Building2 className="w-6 h-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-400 font-tajawal">
                دليل المكاتب والخطابات والحظر
              </h1>
            </div>
            <p className="text-slate-300 text-sm max-w-2xl font-tajawal leading-relaxed">
              مركز التحكم الشامل بالمكاتب والقروبات والخطابات: متابعة الأرقام، تخصيص المسميات، تعيين حالات التحذير والحظر، والحذف الجماعي الفوري لأعضاء أي خطابة أو مكتب بنقرة واحدة.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                setEditingKhataaba(null);
                setKhataabaForm({ phone: '', name: '', status: 'active', notes: '', officeName: '' });
                setShowAddKhataabaModal(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل خطابة جديدة</span>
            </button>
            <button
              onClick={() => setShowAddOfficeModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm border border-slate-700 flex items-center gap-2 transition-all"
            >
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>إضافة قروب/مكتب</span>
            </button>
          </div>
        </div>

        {/* بطاقات الإحصائيات السريعة */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/50 rounded-2xl p-3.5 border border-slate-700/50">
            <div className="text-slate-400 text-xs font-bold mb-1">إجمالي الأعضاء المستوردين</div>
            <div className="text-2xl font-black text-amber-400 font-mono">{totalImportedMembers}</div>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-3.5 border border-slate-700/50">
            <div className="text-slate-400 text-xs font-bold mb-1">خطابات نشطة</div>
            <div className="text-2xl font-black text-emerald-400 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {totalActiveKhataabas}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-3.5 border border-slate-700/50">
            <div className="text-slate-400 text-xs font-bold mb-1">خطابات تحت التحذير</div>
            <div className="text-2xl font-black text-amber-400 font-mono flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {totalWarningKhataabas}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-3.5 border border-slate-700/50">
            <div className="text-slate-400 text-xs font-bold mb-1">خطابات محظورة</div>
            <div className="text-2xl font-black text-rose-400 font-mono flex items-center gap-1.5">
              <Ban className="w-4 h-4" />
              {totalBlockedKhataabas}
            </div>
          </div>
        </div>
      </div>

      {/* 2. تبويبات التنقل الرئيسية */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('khataabas')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'khataabas'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>سجل ودليل الخطابات ({khataabas.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('offices')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'offices'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>المكاتب والقروبات ({Object.keys(officeStatsMap).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('blacklist')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'blacklist'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
              : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'
          }`}
        >
          <Ban className="w-4 h-4" />
          <span>سجل الحظر والأرقام المحظورة ({blockedKhataabas.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('lists')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'lists' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>القوائم والتصنيفات</span>
        </button>
      </div>

      {/* 3. محتوى التبويب الأول: دليل وشجرة الخطابات */}
      {activeTab === 'khataabas' && (
        <div className="space-y-4">
          {/* أدوات التصفية والبحث المتقدم للخطابات */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-3">
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الخطابة، رقم الواتساب، الملاحظات..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap sm:flex-nowrap overflow-x-auto">
              {/* خيار الفرز */}
              <div className="flex items-center gap-1.5 bg-amber-50/70 border border-amber-200/80 px-3 py-2 rounded-xl text-xs shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-amber-900 font-bold shrink-0">الترتيب:</span>
                <select
                  value={khataabaSort}
                  onChange={(e: any) => setKhataabaSort(e.target.value)}
                  className="bg-transparent font-black text-slate-900 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="most_members">🏆 الأكثر أعضاءً</option>
                  <option value="least_members">📉 الأقل أعضاءً</option>
                  <option value="alphabetical">🔤 أبجديًا (أ - ي)</option>
                  <option value="status">🚥 بحسب الحالة</option>
                  <option value="newest">📅 الأحدث تسجيلاً</option>
                </select>
              </div>

              {/* تصفية وجود أعضاء */}
              <select
                value={hasMembersFilter}
                onChange={(e: any) => setHasMembersFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">جميع الخطابات</option>
                <option value="with_members">👥 خطابات تحتوي أعضاء فقط</option>
                <option value="no_members">⚠️ خطابات فارغة (بدون أعضاء)</option>
              </select>

              {/* تصفية الحالة */}
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">جميع الحالات</option>
                <option value="active">🟢 نشطة فقط</option>
                <option value="warning">🟡 تحت التحذير</option>
                <option value="blocked">🔴 محظورة فقط</option>
              </select>

              {/* تصفية القروب */}
              <select
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">جميع المكاتب/القروبات</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.name}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* شبكة كروت الخطابات */}
          {filteredKhataabas.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200">
              <PhoneCall className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700 mb-1">لم يتم العثور على خطابات مسجلة</h3>
              <p className="text-xs text-slate-500 mb-4">يمكنك إضافة خطابة جديدة يدويًا أو سيتم تسجيل أي خطابة تلقائياً عند استيراد الأعضاء بها.</p>
              <button
                onClick={() => setShowAddKhataabaModal(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                + إضافة أول خطابة
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredKhataabas.map((k) => {
                const statsKey = k.id;
                const stats = khataabaStatsMap[statsKey] || {
                  membersCount: membersList.filter(
                    (m) => (m.khataabaPhone && m.khataabaPhone.replace(/[^\d]/g, '') === k.phone.replace(/[^\d]/g, '')) ||
                           (m.khataabaName && m.khataabaName.trim().toLowerCase() === k.name.trim().toLowerCase())
                  ).length,
                  offices: new Set(k.offices || []),
                };

                return (
                  <div
                    key={k.id}
                    className={`bg-white rounded-2xl p-5 border transition-all hover:shadow-md relative flex flex-col justify-between ${
                      k.status === 'blocked'
                        ? 'border-rose-200 bg-rose-50/20'
                        : k.status === 'warning'
                        ? 'border-amber-200 bg-amber-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* ترويسة بطاقة الخطابة */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-900 text-base font-tajawal">{k.name}</h3>
                            {k.name === k.phone && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 text-[10px] font-bold">
                                رقم برقم الهاتف
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-1" dir="ltr">
                            <Phone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{k.phone || 'بدون رقم واتساب'}</span>
                            {k.phone && k.phone !== 'بدون رقم' && (
                              <a
                                href={`https://wa.me/${k.phone.replace(/[^\d]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 font-sans text-[11px] font-bold underline"
                              >
                                واتساب 💬
                              </a>
                            )}
                          </div>
                        </div>

                        {/* شارة الحالة */}
                        <div className="shrink-0">
                          {k.status === 'active' && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> نشطة
                            </span>
                          )}
                          {k.status === 'warning' && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> تحت التحذير
                            </span>
                          )}
                          {k.status === 'blocked' && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold flex items-center gap-1">
                              <Ban className="w-3 h-3" /> محظورة ⛔
                            </span>
                          )}
                        </div>
                      </div>

                      {/* القروبات التابعة لها */}
                      <div className="mb-3">
                        <div className="text-[11px] text-slate-400 font-bold mb-1">القروبات/المكاتب التابعة لها:</div>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(stats.offices).length > 0 ? (
                            Array.from(stats.offices).map((off, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">
                                🏢 {off}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">غير محددة بقروب معين</span>
                          )}
                        </div>
                      </div>

                      {/* ملاحظات الإدارة */}
                      {k.notes && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 mb-3 font-tajawal">
                          <span className="font-bold text-slate-700 block text-[11px]">ملاحظة الإدارة:</span>
                          {k.notes}
                        </div>
                      )}
                    </div>

                    {/* أسفل الكارت: الإحصائية والأزرار */}
                    <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400 block font-bold">الأعضاء المستوردون:</span>
                        <span className="text-base font-black text-slate-800 font-mono">{stats.membersCount} عضو</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            setViewingTarget({
                              type: 'khataaba',
                              identifier: k.phone || k.name,
                              displayName: `${k.name} (${k.phone})`,
                            })
                          }
                          title="استعراض أعضاء هذه الخطابة"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>الأعضاء</span>
                        </button>

                        <button
                          onClick={() => handleEditKhataaba(k)}
                          title="تعديل بيانات أو حالة الخطابة"
                          className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() =>
                            setConfirmDeleteTarget({
                              type: 'khataaba',
                              identifier: k.phone || k.name,
                              displayName: k.name,
                              count: stats.membersCount,
                              alsoBlockKhataaba: k.status !== 'blocked',
                            })
                          }
                          title="حذف كافة أعضاء هذه الخطابة بنقرة واحدة"
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. محتوى التبويب الثاني: المكاتب والقروبات */}
      {activeTab === 'offices' && (
        <div className="space-y-4">
          {/* شريط البحث والفرز للمكاتب */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={officeSearchQuery}
                onChange={(e) => setOfficeSearchQuery(e.target.value)}
                placeholder="ابحث باسم المكتب أو القروب..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-amber-50/70 border border-amber-200/80 px-3 py-2 rounded-xl text-xs w-full sm:w-auto">
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-amber-900 font-bold shrink-0">الترتيب:</span>
                <select
                  value={officeSort}
                  onChange={(e: any) => setOfficeSort(e.target.value)}
                  className="bg-transparent font-black text-slate-900 text-xs focus:outline-none cursor-pointer w-full"
                >
                  <option value="most_members">🏆 المكاتب الأكثر أعضاءً</option>
                  <option value="least_members">📉 المكاتب الأقل أعضاءً</option>
                  <option value="most_khataabas">📱 المكاتب الأكثر خطابات</option>
                  <option value="alphabetical">🔤 الترتيب الأبجدي (أ - ي)</option>
                </select>
              </div>

              <button
                onClick={() => setShowAddOfficeModal(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مكتب جديد</span>
              </button>
            </div>
          </div>

          {filteredOfficesList.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700 mb-1">لم يتم العثور على مكاتب أو قروبات</h3>
              <p className="text-xs text-slate-500">يمكنك إضافة مكتب جديد أو تغيير كلمة البحث.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOfficesList.map((item) => {
                const officeName = item.name;
                const officeEntry = offices.find((o) => o.name === officeName);

                return (
                  <div key={officeName} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                              <Building2 className="w-4 h-4" />
                            </span>
                            <h3 className="font-black text-slate-900 text-base font-tajawal">{officeName}</h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">مكتب / قروب استيراد مسجل</p>
                        </div>

                        {officeEntry && (
                          <button
                            onClick={() => handleDeleteOfficeEntry(officeEntry.id)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="مسح اسم القروب من السجل"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* قائمة الخطابات التابعة لهذا القروب */}
                      <div className="mb-4">
                        <div className="text-[11px] text-slate-500 font-bold mb-1.5">الخطابات النشطة بهذا القروب ({item.khataabasCount}):</div>
                        {item.khataabasCount > 0 ? (
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {Array.from(item.khataabasMap.entries()).map(([kName, count], idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="font-bold text-slate-700 truncate max-w-[180px]">{kName}</span>
                                <span className="font-mono text-[11px] text-slate-500 font-bold">{count} عضو</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                            لا توجد خطابات مسجلة مباشرة بهذا القروب حالياً
                          </div>
                        )}
                      </div>
                    </div>

                    {/* تذييل الكارت */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-400 block font-bold">إجمالي أعضاء القروب:</span>
                        <span className="text-xl font-black text-amber-600 font-mono">{item.membersCount} عضو</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            setViewingTarget({
                              type: 'office',
                              identifier: officeName,
                              displayName: officeName,
                            })
                          }
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض الأعضاء</span>
                        </button>

                        <button
                          onClick={() =>
                            setConfirmDeleteTarget({
                              type: 'office',
                              identifier: officeName,
                              displayName: officeName,
                              count: item.membersCount,
                            })
                          }
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all"
                          title="حذف جميع أعضاء هذا القروب بنقرة واحدة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. محتوى التبويب الثالث: سجل الحظر والأرقام المحظورة */}
      {activeTab === 'blacklist' && (
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-900 text-xs leading-relaxed flex items-start gap-3">
            <Info className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-sm block mb-0.5">محرك الفحص الآلي للحظر أثناء الاستيراد (Import Security Guard)</span>
              أي رقم خطابة محظور يتم إضافته هنا، سيقوم محرك الاستيراد فوراً باكتشافه عند رفع أي ملف (CSV أو JSON أو نص خام)، وتنبيه المسؤول باللون الأحمر مع خيار استبعاد أعضاء هذه الخطابة تلقائياً من الاستيراد.
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm font-tajawal flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-600" />
                <span>قائمة الخطابات والأرقام المحظورة ({blockedKhataabas.length})</span>
              </h3>
              <button
                onClick={() => {
                  setEditingKhataaba(null);
                  setKhataabaForm({ phone: '', name: '', status: 'blocked', notes: 'حظر تلقائي بواسطة الإدارة', officeName: '' });
                  setShowAddKhataabaModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-all"
              >
                + إضافة رقم محظور مسبقاً
              </button>
            </div>

            {blockedKhataabas.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                لا توجد خطابات محظورة حالياً. جميع الخطابات المسجلة بحالة سليمة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">اسم الخطابة</th>
                      <th className="p-3">رقم الواتساب/الهاتف</th>
                      <th className="p-3">سبب الحظر / الملاحظة</th>
                      <th className="p-3">تاريخ الحظر</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {blockedKhataabas.map((k) => (
                      <tr key={k.id} className="hover:bg-rose-50/30">
                        <td className="p-3 font-bold text-slate-900">{k.name}</td>
                        <td className="p-3 font-mono text-slate-700" dir="ltr">{k.phone}</td>
                        <td className="p-3 text-slate-600">{k.notes || 'لا توجد ملاحظة'}</td>
                        <td className="p-3 text-slate-400 font-mono text-[11px]">{new Date(k.updatedAt).toLocaleDateString('ar-SA')}</td>
                        <td className="p-3 text-center space-x-2 space-x-reverse">
                          <button
                            onClick={() => handleQuickStatusChange(k.id, 'active')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[11px] hover:bg-emerald-200"
                          >
                            رفع الحظر
                          </button>
                          <button
                            onClick={() =>
                              setConfirmDeleteTarget({
                                type: 'khataaba',
                                identifier: k.phone || k.name,
                                displayName: k.name,
                                count: membersList.filter(
                                  (m) => (m.khataabaPhone && m.khataabaPhone.replace(/[^\d]/g, '') === k.phone.replace(/[^\d]/g, '')) ||
                                         (m.khataabaName && m.khataabaName.trim().toLowerCase() === k.name.trim().toLowerCase())
                                ).length,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold text-[11px] hover:bg-rose-200"
                          >
                            حذف كافة أعضائها
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'lists' && <CustomListsPanel members={membersList as any[]} />}

      {/* ========================================================= */}
      {/* 6. مودال إضافة / تعديل خطابة */}
      {/* ========================================================= */}
      {showAddKhataabaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base font-tajawal">
                {editingKhataaba ? 'تعديل بيانات الخطابة' : 'تسجيل/تخصيص خطابة جديدة'}
              </h3>
              <button
                onClick={() => setShowAddKhataabaModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKhataaba} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الخطابة المخصص للإدارة <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={khataabaForm.name}
                  onChange={(e) => setKhataabaForm({ ...khataabaForm, name: e.target.value })}
                  placeholder="مثال: أم عبدالله - وسيطة الرياض"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الواتساب / الجوال الخاص بالخطابة <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={khataabaForm.phone}
                  onChange={(e) => setKhataabaForm({ ...khataabaForm, phone: e.target.value })}
                  placeholder="مثال: 0501234567"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:border-amber-400"
                  dir="ltr"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حالة الخطابة في المنصة</label>
                <select
                  value={khataabaForm.status}
                  onChange={(e: any) => setKhataabaForm({ ...khataabaForm, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none"
                >
                  <option value="active">🟢 نشطة (سليمة وموثوقة)</option>
                  <option value="warning">🟡 تحت التحذير (تظهر شارة تنبيه للإدارة)</option>
                  <option value="blocked">🔴 محظورة (تنبيه أمني يمنع استيراد أعضائها)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">القروب/المكتب التابعة له (اختياري)</label>
                <input
                  type="text"
                  value={khataabaForm.officeName}
                  onChange={(e) => setKhataabaForm({ ...khataabaForm, officeName: e.target.value })}
                  placeholder="مثال: قروب النخبة 1"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الإدارة السرية</label>
                <textarea
                  rows={3}
                  value={khataabaForm.notes}
                  onChange={(e) => setKhataabaForm({ ...khataabaForm, notes: e.target.value })}
                  placeholder="أدخل أي ملاحظات حول جدية الخطابة، التعامل، الأسباب..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition-all"
                >
                  حفظ وتحديث السجل
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddKhataabaModal(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. مودال إضافة مكتب / قروب جديد */}
      {/* ========================================================= */}
      {showAddOfficeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200"
          >
            <h3 className="font-bold text-slate-900 text-base mb-3 font-tajawal">إضافة اسم مكتب/قروب جديد</h3>
            <form onSubmit={handleAddOffice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المكتب أو القروب</label>
                <input
                  type="text"
                  value={newOfficeName}
                  onChange={(e) => setNewOfficeName(e.target.value)}
                  placeholder="مثال: قروب وسيطات جدة 2"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                >
                  إضافة
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddOfficeModal(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. مودال استعراض أعضاء الخطابة / المكتب المباشر (بطاقات احترافية كما في البحث المتقدم) */}
      {/* ========================================================= */}
      {viewingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-6xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col"
          >
            {/* الترويسة */}
            <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <span className="text-amber-400 text-xs font-bold block">استعراض كروت أعضاء جهة الاستيراد:</span>
                  <h3 className="text-lg font-black font-tajawal text-white">{viewingTarget.displayName}</h3>
                </div>
              </div>
              <button
                onClick={() => setViewingTarget(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* محتوى الكروت */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 grow bg-slate-50/60 relative">
              {/* شريط الإجراءات والتحكم بالتحديد */}
              <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAllMembers}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                      selectedMemberIds.length > 0 && selectedMemberIds.length === viewingMembersList.length
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {selectedMemberIds.length > 0 && selectedMemberIds.length === viewingMembersList.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>
                      {selectedMemberIds.length > 0 && selectedMemberIds.length === viewingMembersList.length
                        ? 'إلغاء تحديد الكل'
                        : 'تحديد جميع الأعضاء'}
                    </span>
                  </button>

                  {selectedMemberIds.length > 0 && (
                    <span className="text-xs font-black text-amber-800 bg-amber-100 px-3 py-1 rounded-xl border border-amber-300/60">
                      تم تحديد {selectedMemberIds.length} من أصل {viewingMembersList.length} عضواً
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
                    الإجمالي: <strong className="text-slate-900 font-mono text-sm">{viewingMembersList.length}</strong> عضواً
                  </span>

                  {viewingMembersList.length > 0 && (
                    <button
                      onClick={() => {
                        setConfirmDeleteTarget({
                          type: viewingTarget.type,
                          identifier: viewingTarget.identifier,
                          displayName: viewingTarget.displayName,
                          count: viewingMembersList.length,
                        });
                        setViewingTarget(null);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-100 text-rose-800 font-bold text-xs hover:bg-rose-200 transition-all flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف كافة أعضاء الجهة</span>
                    </button>
                  )}
                </div>
              </div>

              {viewingMembersList.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 p-8 shadow-2xs">
                  لا يوجد أعضاء مسجلون حالياً لهذه الجهة.
                </div>
              ) : (
                /* عرض ملفين في الصف دائماً (grid-cols-2) بوضوح وكفاءة للمسؤول */
                <div className="grid grid-cols-2 gap-3 sm:gap-5 pt-2 pb-16">
                  {viewingMembersList.map((m) => {
                    const isSelected = selectedMemberIds.includes(m.id);
                    const matchedK = khataabas.find((k) => doesMemberBelongToKhataaba(m, k));
                    const kBadgeText = matchedK?.name || m.khataabaName || (m.khataabaPhone ? `خطابة (${m.khataabaPhone})` : 'مستورد مباشر');
                    const kBadgePhone = matchedK?.phone || m.khataabaPhone;
                    const officeBadgeText = m.importOfficeName || (matchedK?.offices?.[0]) || '';

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col h-full relative group rounded-2xl transition-all ${
                          isSelected
                            ? 'ring-2 ring-amber-500 border-amber-400 shadow-md bg-amber-50/20'
                            : ''
                        }`}
                      >
                        {/* شارات الخطابة والمكتب، أزرار المعاينة والتعديل المباشر ومربع التحديد الجماعي */}
                        <div className="bg-slate-900 text-white rounded-t-2xl px-2.5 sm:px-3.5 py-2 flex items-center justify-between flex-wrap gap-1.5 text-xs z-10 shadow-sm border-b border-amber-500/30">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* زر مربع التحديد */}
                            <button
                              onClick={() => toggleSelectMember(m.id)}
                              className={`p-1 rounded-lg transition-all shrink-0 ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 font-bold'
                                  : 'text-slate-400 hover:text-white bg-slate-800'
                              }`}
                              title={isSelected ? 'إلغاء تحديد هذا العضو' : 'تحديد هذا العضو للإجراءات الجماعية'}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>

                            <div className="flex items-center gap-1 text-amber-400 font-bold font-tajawal text-[10px] sm:text-[11px] truncate">
                              <Phone className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="truncate"><strong className="text-white">{kBadgeText}</strong></span>
                              {kBadgePhone && kBadgePhone !== kBadgeText && (
                                <span className="text-[9px] text-amber-300/80 font-mono hidden md:inline" dir="ltr">({kBadgePhone})</span>
                              )}
                              {officeBadgeText && (
                                <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded-md hidden lg:inline-flex items-center gap-0.5">
                                  <Building2 className="w-2.5 h-2.5" />
                                  <span>{officeBadgeText}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* أزرار الإجراءات الفردية المباشرة: عرض الملف وتعديل البيانات */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setSelectedMemberForModal(m);
                                setModalInitialEditing(false);
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-[10px] sm:text-[11px] flex items-center gap-1 transition-all"
                              title="عرض التفاصيل والملف الكامل"
                            >
                              <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span className="hidden xs:inline">الملف</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedMemberForModal(m);
                                setModalInitialEditing(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500 text-blue-300 hover:text-white font-bold text-[10px] sm:text-[11px] flex items-center gap-1 transition-all"
                              title="تعديل بيانات العضو"
                            >
                              <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span className="hidden xs:inline">تعديل</span>
                            </button>
                          </div>
                        </div>

                        {/* بطاقة العضو بنفس تصميم صفحة البحث المتقدم */}
                        <div className="flex-1 flex flex-col pt-0">
                          <MemberCard member={m} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* شريط الإجراءات الجماعية العائم الشامل في الأسفل عند تحديد أعضاء */}
              <AnimatePresence>
                {selectedMemberIds.length > 0 && (
                  <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 50, opacity: 0 }}
                    className="sticky bottom-2 left-0 right-0 z-30 bg-slate-900 text-white p-3.5 rounded-2xl border border-amber-500/50 shadow-2xl flex flex-wrap items-center justify-between gap-3 backdrop-blur-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs">
                        {selectedMemberIds.length}
                      </span>
                      <span className="text-xs font-bold text-amber-300">
                        محدد للإجراءات الجماعية:
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={handleBulkDeleteSelected}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm"
                        title="حذف المحددين نهائياً"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف ({selectedMemberIds.length})</span>
                      </button>

                      <button
                        onClick={handleBulkBlockSelected}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 font-bold text-xs flex items-center gap-1 transition-all shadow-sm"
                        title="حظر حسابات المحددين"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>حظر</span>
                      </button>

                      <button
                        onClick={handleBulkFreezeSelected}
                        className="px-2.5 py-1.5 rounded-xl bg-sky-950 hover:bg-sky-900 text-sky-200 border border-sky-800 font-bold text-xs flex items-center gap-1 transition-all shadow-sm"
                        title="تجميد/إيقاف حسابات المحددين"
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                        <span>تجميد</span>
                      </button>

                      <button
                        onClick={handleBulkActivateSelected}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm"
                        title="تنشيط حسابات المحددين"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>تنشيط</span>
                      </button>

                      <button
                        onClick={handleBulkVerifySelected}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm"
                        title="توثيق شارة الهوية"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>توثيق 🛡️</span>
                      </button>

                      <button
                        onClick={handleBulkVIPSelected}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 transition-all shadow-sm"
                        title="تحويل لمميز VIP"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>مميز ⭐</span>
                      </button>

                      <button
                        onClick={handleBulkSeriousnessSelected}
                        className="px-2.5 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-xs flex items-center gap-1 transition-all shadow-sm"
                        title="منح وسام الجدية"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>وسام الجدية 🏅</span>
                      </button>

                      <button
                        onClick={handleBulkStandardSelected}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs flex items-center gap-1 transition-all shadow-sm"
                        title="إلغاء التميز"
                      >
                        <span>عادي</span>
                      </button>

                      <button
                        onClick={() => setSelectedMemberIds([])}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xs border border-slate-700"
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* أسفل المودال */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-bold">
                يمكنك النقر على كارت أي عضو للتعرف على كامل مواصفاته وتفاصيله
              </span>
              <button
                onClick={() => setViewingTarget(null)}
                className="px-6 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-900 transition-all shadow-sm"
              >
                إغلاق
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. مودال التأكيد الأمني للحذف الجماعي لأعضاء الخطابة / القروب */}
      {/* ========================================================= */}
      {confirmDeleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200"
          >
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="font-black text-slate-900 text-lg font-tajawal">تأكيد الحذف الجماعي لأعضاء الجهة</h3>
                <p className="text-xs text-rose-600 font-bold">إجراء دائم وغير قابل للاسترجاع</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              أنت على وشك حذف جميع الأعضاء المنسوبين للجهة <span className="font-bold text-slate-900">[{confirmDeleteTarget.displayName}]</span> والبالغ عددهم:
              <span className="font-bold text-rose-600 font-mono text-sm block mt-1">({confirmDeleteTarget.count}) عضواً مستورداً</span>
            </p>

            {confirmDeleteTarget.type === 'khataaba' && (
              <label className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={confirmDeleteTarget.alsoBlockKhataaba}
                  onChange={(e) =>
                    setConfirmDeleteTarget({ ...confirmDeleteTarget, alsoBlockKhataaba: e.target.checked })
                  }
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="text-xs font-bold text-rose-900">
                  حظر رقم هذه الخطابة تلقائياً لمنع استيراد أي أعضاء منها مستقبلاً ⛔
                </span>
              </label>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={executeGroupDelete}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/20"
              >
                تأكيد الحذف الجماعي الفوري
              </button>
              <button
                onClick={() => setConfirmDeleteTarget(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* مودال تفاصيل وتعديل العضو الموحد بالكامل مع قسم الأعضاء */}
      <AdminMemberDetailModal
        member={selectedMemberForModal}
        open={Boolean(selectedMemberForModal)}
        onClose={() => setSelectedMemberForModal(null)}
        initialEditing={modalInitialEditing}
        onUpdated={() => {
          if (refreshAdminMembers) refreshAdminMembers();
          reloadData();
        }}
      />
    </div>
  );
}
