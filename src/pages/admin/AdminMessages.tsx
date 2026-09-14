import { useState, useMemo, useEffect } from 'react';
import {
  Headphones, Mail, Clock, CheckCircle2, AlertCircle, X,
  Search, Send, MessageSquare, ChevronLeft, ShieldCheck, Phone, Lock, MapPin, Crown,
  MailOpen, Mail as MailUnread, UserCog, MessageCircle, ShieldAlert, Trash2, Eye, Inbox, XCircle,
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupportTicket, InquiryMessage } from '../../lib/types';
import { type AdminMember } from '../../lib/admin-data';
import Modal from '../../components/ui/Modal';
import FilterDropdown from '../../components/admin/FilterDropdown';
import PageHeader from '../../components/admin/PageHeader';
import { useReviewMarkers } from '../../lib/useReviewMarkers';
import { dataService } from '../../lib/data/DataService';
const getAllInquiryMessages = () => dataService.db.getAllInquiryMessages();
const moderateInquiryMessage = (messageId: number, action: 'approve' | 'reject', moderatorName: string) => dataService.db.moderateInquiryMessage(messageId, action, moderatorName);
const deleteInquiryMessage = (messageId: number) => dataService.db.deleteInquiryMessage(messageId);
const getLiveMemberById = (id: string) => dataService.db.getLiveMemberById(id);



const statusConfig = {
  open: { label: 'مفتوحة', color: 'text-sky-600 bg-sky-50', icon: Clock },
  in_progress: { label: 'قيد المعالجة', color: 'text-amber-600 bg-amber-50', icon: AlertCircle },
  resolved: { label: 'تم الحل', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
  closed: { label: 'مغلقة', color: 'text-slate-400 bg-slate-100', icon: CheckCircle2 },
};

const categories = ['الكل', 'استفسار عام', 'طلب ترقية', 'مشكلة تقنية', 'شكوى', 'اقتراح'] as const;

// قوالب الردود الجاهزة
const REPLY_TEMPLATES = [
  { label: 'ترحيب', text: 'السلام عليكم ورحمة الله وبركاته، أهلاً بك في منصة توافق. كيف يمكننا مساعدتك؟' },
  { label: 'تنسيق شرعي', text: 'يسعدنا تواصلك معنا. سيتم تنسيق موعد للقاء الشرعي بإشراف الوسيطة، وسنوافيك بالتفاصيل قريباً.' },
  { label: 'طلب مستندات', text: 'لإكمال عملية التوثيق، يرجى إرسال صورة من الهوية الوطنية وعقد الميلاد. جميع البيانات محمية تماماً.' },
  { label: 'اعتذار عن تأخير', text: 'نعتذر عن التأخير في الرد، نحن نعمل على معالجة طلبك بأسرع وقت ممكن. شكراً لصبرك.' },
  { label: 'إغلاق التذكرة', text: 'تم حل مشكلتك بنجاح. إذا كان لديك أي استفسار آخر، لا تتردد في فتح تذكرة جديدة. بالتوفيق.' },
];

export default function AdminMessages() {
  const {
    supportTickets,
    setSupportTickets,
    sendSupportMessage,
    adminMembers,
    adminUsers,
    showToast,
    currentAdminName,
  } = useApp();

  // ===== تبويب رئيسي: تذاكر الدعم / مراجعة رسائل الاستفسار =====
  const [mainTab, setMainTab] = useState<'tickets' | 'inquiry_review'>('tickets');

  // ===== مراجعة رسائل الاستفسار =====
  const [inquiryMessages, setInquiryMessages] = useState<(InquiryMessage & { request_id: number })[]>([]);
  const [inquiryFilter, setInquiryFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [inquirySearch, setInquirySearch] = useState('');
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState<number | null>(null);

  const refreshInquiryMessages = () => setInquiryMessages(getAllInquiryMessages());
  useEffect(() => { refreshInquiryMessages(); }, [mainTab]);

  const handleModerateInquiry = (messageId: number, action: 'approve' | 'reject') => {
    const ok = moderateInquiryMessage(messageId, action, currentAdminName);
    if (ok) {
      showToast(action === 'approve' ? 'تمت الموافقة على الرسالة ونشرها للطرفين ✓' : 'تم رفض الرسالة وحجبها ✕', action === 'approve' ? 'success' : 'info');
      refreshInquiryMessages();
    } else {
      showToast('تعذّر تنفيذ الإجراء', 'error');
    }
  };

  const handleDeleteInquiry = () => {
    if (confirmDeleteMsg === null) return;
    const ok = deleteInquiryMessage(confirmDeleteMsg);
    if (ok) {
      showToast('تم اعتراض الرسالة وحذفها من المحادثة نهائياً 🗑️', 'success');
      refreshInquiryMessages();
    } else {
      showToast('تعذّر حذف الرسالة', 'error');
    }
    setConfirmDeleteMsg(null);
  };

  const filteredInquiryMessages = useMemo(() => {
    return inquiryMessages.filter((m) => {
      const matchSearch = !inquirySearch || m.text.includes(inquirySearch);
      const matchFilter =
        inquiryFilter === 'all' ? true :
        inquiryFilter === 'pending' ? (!m.approved && !m.rejected) :
        inquiryFilter === 'approved' ? !!m.approved :
        inquiryFilter === 'rejected' ? !!m.rejected : true;
      return matchSearch && matchFilter;
    });
  }, [inquiryMessages, inquirySearch, inquiryFilter]);

  const pendingInquiryCount = inquiryMessages.filter(m => !m.approved && !m.rejected).length;

  // ===== تتبّع المراجعة الدائم (لا يختفي عند تحديث الصفحة) =====
  const { markReviewed, isReviewed, getMark } = useReviewMarkers('twafok_reviewed_tickets');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [filterCategory, setFilterCategory] = useState<typeof categories[number]>('الكل');
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'normal' | 'low'>('all');

  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  // Selected member profile modal
  const [selectedMember, setSelectedMember] = useState<AdminMember | null>(null);
  // Transfer modal
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState('');

  const activeTicket = supportTickets.find(t => t.id === activeTicketId) || null;

  const filteredTickets = useMemo(() => {
    return supportTickets.filter(ticket => {
      const matchSearch = ticket.subject.toLowerCase().includes(search.toLowerCase()) ||
        ticket.messages.some(m => m.text.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = filterStatus === 'all' || ticket.status === filterStatus;
      const matchCategory = filterCategory === 'الكل' || ticket.category === filterCategory;
      // Priority based on category
      const priority = ticket.category === 'شكوى' ? 'high' : ticket.category === 'مشكلة تقنية' ? 'normal' : 'low';
      const matchPriority = filterPriority === 'all' || priority === filterPriority;
      return matchSearch && matchStatus && matchCategory && matchPriority;
    });
  }, [supportTickets, search, filterStatus, filterCategory, filterPriority]);

  const getOwnerMember = (userId?: string) => {
    if (!userId) return null;
    return adminMembers.find(m => m.id === userId) || getLiveMemberById(userId) || null;
  };

  const getMemberStatusInfo = (userId?: string) => {
    if (!userId) return { member: null, isDeleted: false, isBanned: false, isSuspended: false, label: 'غير معروف' };
    const member = adminMembers.find((m) => m.id === userId) || getLiveMemberById(userId);
    const isDeleted = !member || member.status === 'deleted' || (member as any)?.deleted === true;
    const isBanned = member?.status === 'banned';
    const isSuspended = member?.status === 'suspended';
    const nickname = member?.nickname || member?.realName || member?.name;
    const label = isDeleted ? (nickname ? `${nickname} (حساب مُحذوف)` : 'عضو سابق (حساب مُحذوف)') : nickname || userId;
    return { member, isDeleted, isBanned, isSuspended, label };
  };

  const getTicketPriority = (ticket: SupportTicket): 'high' | 'normal' | 'low' => {
    if (ticket.category === 'شكوى') return 'high';
    if (ticket.category === 'مشكلة تقنية') return 'normal';
    return 'low';
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !activeTicketId) return;
    sendSupportMessage(activeTicketId, replyText, 'admin');
    // الرد يعني أن التذكرة تمت مراجعتها والرد عليها
    markReviewed(activeTicketId, currentAdminName);
    setReplyText('');
    showToast('تم إرسال رد الإدارة بنجاح! 📨', 'success');
  };

  const handleUpdateStatus = (ticketId: string, status: SupportTicket['status']) => {
    setSupportTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status, updatedAt: 'الآن' } : t))
    );
    // مزامنة الحالة مع جدول support_tickets الحقيقي
    if (/^\d+$/.test(String(ticketId))) {
      fetch('/api/support-tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(ticketId), status }),
      }).catch(() => undefined);
    }
    showToast(`تم تحديث حالة التذكرة إلى: ${statusConfig[status].label}`, 'info');
  };

  const handleSelectTicket = (id: string) => {
    setActiveTicketId(id);
    // فتح التذكرة = قراءتها (تُحفظ دائماً)
    markReviewed(id, currentAdminName);
  };

  const handleTransfer = () => {
    if (!transferModal || !transferTarget) return;
    setSupportTickets((prev) => prev.map((t) => t.id === transferModal ? { ...t, assignedTo: transferTarget, updatedAt: 'الآن' } : t));
    showToast(`تم تحويل التذكرة إلى ${transferTarget} بنجاح`, 'success');
    setTransferModal(null);
    setTransferTarget('');
  };

  // Stats
  const stats = {
    total: supportTickets.length,
    open: supportTickets.filter(t => t.status === 'open').length,
    inProgress: supportTickets.filter(t => t.status === 'in_progress').length,
    resolved: supportTickets.filter(t => t.status === 'resolved').length,
    unread: supportTickets.filter(t => !isReviewed(t.id)).length,
  };

  return (
    <div className="space-y-6 font-cairo text-right" dir="rtl">
      <PageHeader
        icon={Headphones}
        title="الرسائل والدعم الفني"
        subtitle="استلام تذاكر الدعم والتحكيم الشرعي من الخاطبين، التخاطب معهم وتنسيق الرؤية الشرعية"
        action={
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setMainTab('tickets')}
              aria-label="عرض تذاكر الدعم"
              className={`px-4 py-2 rounded-lg text-xs font-cairo font-bold transition-all flex items-center gap-1.5 ${mainTab === 'tickets' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Headphones className="w-4 h-4" /> تذاكر الدعم
            </button>
            <button
              onClick={() => setMainTab('inquiry_review')}
              aria-label="مراجعة رسائل الاستفسار"
              className={`px-4 py-2 rounded-lg text-xs font-cairo font-bold transition-all flex items-center gap-1.5 relative ${mainTab === 'inquiry_review' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ShieldAlert className="w-4 h-4" /> مراجعة رسائل الاستفسار
              {pendingInquiryCount > 0 && (
                <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                  {pendingInquiryCount}
                </span>
              )}
            </button>
          </div>
        }
      />

      {/* ===== تبويب مراجعة رسائل الاستفسار ===== */}
      {mainTab === 'inquiry_review' && (
        <InquiryReviewTab
          messages={filteredInquiryMessages}
          allMessages={inquiryMessages}
          filter={inquiryFilter}
          setFilter={setInquiryFilter}
          search={inquirySearch}
          setSearch={setInquirySearch}
          onModerate={handleModerateInquiry}
          onDelete={(id) => setConfirmDeleteMsg(id)}
          pendingCount={pendingInquiryCount}
        />
      )}

      {/* ===== تبويب تذاكر الدعم ===== */}
      {mainTab === 'tickets' && (
        <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'إجمالي التذاكر', value: stats.total, color: 'bg-slate-100 text-slate-700', icon: MessageSquare },
          { label: 'مفتوحة', value: stats.open, color: 'bg-sky-100 text-sky-700', icon: Clock },
          { label: 'قيد المعالجة', value: stats.inProgress, color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
          { label: 'تم حلها', value: stats.resolved, color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
          { label: 'غير مقروءة', value: stats.unread, color: 'bg-rose-100 text-rose-700', icon: MailUnread },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200/80 text-center">
            <div className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center mb-1.5 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div className="font-cairo font-black text-lg text-slate-950">{s.value}</div>
            <div className="text-[10px] text-slate-500 font-tajawal">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Grid: Tickets list + Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-[75vh]">
        {/* Left: Tickets list */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden">
          {/* Header controls */}
          <div className="p-4 border-b border-slate-100 space-y-3 flex-shrink-0 bg-slate-50/20">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بموضوع التذكرة أو محتواها..."
                className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-amber-400 text-slate-800 bg-white"
              />
            </div>
            {/* فلاتر موحّدة منسدلة — حالة وتصنيف وأولوية */}
            <div className="flex flex-wrap gap-2">
              <FilterDropdown
                label="الحالة:"
                value={filterStatus}
                onChange={(v) => setFilterStatus(v as typeof filterStatus)}
                options={(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((s) => ({
                  value: s,
                  label: s === 'all' ? 'كل الحالات' : statusConfig[s].label,
                }))}
              />
              <FilterDropdown
                label="التصنيف:"
                value={filterCategory}
                onChange={(v) => setFilterCategory(v as typeof categories[number])}
                options={categories.map((c) => ({ value: c, label: c === 'الكل' ? 'كل التصنيفات' : c }))}
              />
              <FilterDropdown
                label="الأولوية:"
                value={filterPriority}
                onChange={(v) => setFilterPriority(v as 'all' | 'high' | 'normal' | 'low')}
                options={[
                  { value: 'all', label: 'كل الأولويات' },
                  { value: 'high', label: 'عالية' },
                  { value: 'normal', label: 'عادية' },
                  { value: 'low', label: 'منخفضة' },
                ]}
              />
            </div>
          </div>

          {/* Tickets scroll area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
            {filteredTickets.length === 0 ? (
              <div className="py-20 text-center">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-tajawal">لا توجد رسائل مطابقة</p>
              </div>
            ) : (
              filteredTickets.map(ticket => {
                const sc = statusConfig[ticket.status] || statusConfig.open;
                const owner = getOwnerMember(ticket.userId);
                const lastMsg = ticket.messages[ticket.messages.length - 1];
                const isActive = ticket.id === activeTicketId;
                const isRead = isReviewed(ticket.id);
                const prio = getTicketPriority(ticket);
                const msgCount = ticket.messages.length;

                return (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket.id)}
                    className={`w-full flex items-start gap-2.5 p-3 rounded-2xl text-right transition-all ${
                      isActive ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-slate-50 bg-white'
                    }`}
                  >
                    <div className="relative flex-shrink-0 mt-0.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Headphones className="w-4 h-4" />
                      </div>
                      {!isRead && !isActive && (
                        <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className={`text-[10px] font-black truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>
                          {ticket.subject}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sc.color} flex-shrink-0`}>
                          {sc.label}
                        </span>
                      </div>

                      {(() => {
                        const { isDeleted, isBanned, isSuspended, label } = getMemberStatusInfo(ticket.userId);
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={`text-[9.5px] font-bold truncate ${isActive ? 'text-amber-300' : 'text-amber-600'}`}>
                              {label}
                            </span>
                            {isDeleted && (
                              <span className="text-[8px] font-cairo font-black text-rose-700 bg-rose-100 border border-rose-300 px-1 py-0.2 rounded">
                                ⚠️ مُحذوف
                              </span>
                            )}
                            {isBanned && (
                              <span className="text-[8px] font-cairo font-black text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded">
                                ⛔ محظور
                              </span>
                            )}
                            {isSuspended && (
                              <span className="text-[8px] font-cairo font-black text-orange-700 bg-orange-50 border border-orange-200 px-1 py-0.2 rounded">
                                ⚠️ موقوف
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      <p className={`text-[11px] truncate ${isActive ? 'text-slate-300' : 'text-slate-500'} font-tajawal`}>
                        {lastMsg ? lastMsg.text : 'لا توجد رسائل'}
                      </p>

                      <div className={`text-[9px] font-tajawal mt-1 flex justify-between items-center ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>
                        <span className="flex items-center gap-1">
                          {ticket.category}
                          {prio === 'high' && <span className="px-1 py-0.5 rounded bg-red-100 text-red-700 font-bold">عاجل</span>}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {msgCount}
                          <span className="mx-1">·</span>
                          {ticket.updatedAt}
                        </span>
                      </div>
                      {isRead ? (
                        <div className={`mt-1 flex items-center gap-1 text-[8.5px] font-cairo font-bold ${isActive ? 'text-emerald-300' : 'text-emerald-600'}`}>
                          <CheckCircle2 className="w-2.5 h-2.5" /> تمت المراجعة · {getMark(ticket.id)?.reviewedBy}
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-1 text-[8.5px] font-cairo font-bold text-rose-500">
                          <MailUnread className="w-2.5 h-2.5" /> لم تُراجَع بعد
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Chat window */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden">
          {activeTicket ? (
            <>
              {/* Ticket header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex-shrink-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900">{activeTicket.subject}</h3>
                    <p className="text-[10px] text-slate-500 font-tajawal mt-0.5">
                      التصنيف: {activeTicket.category} · {activeTicket.messages.length} رسالة
                      {activeTicket.assignedTo && ` · مُحوّلة إلى: ${activeTicket.assignedTo}`}
                    </p>
                    {isReviewed(activeTicket.id) && (
                      <p className="text-[10px] text-emerald-600 font-cairo font-bold mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> راجعها {getMark(activeTicket.id)?.reviewedBy} · {new Date(getMark(activeTicket.id)!.reviewedAt).toLocaleString('ar-SA')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['open', 'in_progress', 'resolved', 'closed'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStatus(activeTicket.id, st)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-cairo font-bold border transition-all ${
                        activeTicket.status === st
                          ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {statusConfig[st].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Owner member info + transfer */}
              {activeTicket.userId && (() => {
                const { member, isDeleted, isBanned, isSuspended, label } = getMemberStatusInfo(activeTicket.userId);
                return (
                  <div className={`px-4 py-2.5 border-b flex items-center justify-between text-right flex-wrap gap-2 ${
                    isDeleted ? 'bg-rose-50 border-rose-200 text-rose-900' : isBanned ? 'bg-rose-50/70 border-rose-200 text-rose-900' : 'bg-amber-50/60 border-amber-100 text-navy-900'
                  }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold">
                        صاحب الرسالة والتذكرة: <strong>{label}</strong>
                      </span>
                      {isDeleted && (
                        <span className="text-[9px] font-cairo font-black text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> حساب مُحذوف (الرسائل محفوظة للأمان والدعم)
                        </span>
                      )}
                      {isBanned && (
                        <span className="text-[9px] font-cairo font-black text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> حساب محظور نهائياً
                        </span>
                      )}
                      {isSuspended && (
                        <span className="text-[9px] font-cairo font-black text-orange-800 bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-orange-600" /> حساب موقوف موقتاً
                        </span>
                      )}
                    </div>
                    {member && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setSelectedMember(member)}
                          className="px-2.5 py-1 rounded-lg text-[9px] bg-navy-900 text-white hover:bg-navy-800 transition-colors font-bold"
                        >
                          عرض الملف
                        </button>
                        <button
                          onClick={() => setTransferModal(activeTicket.id)}
                          className="px-2 py-0.5 rounded text-[9px] bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors font-bold flex items-center gap-1"
                        >
                          <UserCog className="w-3 h-3" /> تحويل
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/15">
                {activeTicket.messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-start' : 'justify-end'}`}>
                    <div className="max-w-[85%]">
                      <div className={`px-4 py-2.5 rounded-2xl whitespace-pre-line text-right ${
                        msg.sender === 'admin'
                          ? 'bg-slate-900 text-white rounded-bl-md'
                          : 'bg-amber-50 text-navy-900 rounded-br-md border border-amber-100 font-semibold'
                      }`}>
                        <p className="font-tajawal text-xs leading-relaxed text-right">{msg.text}</p>
                      </div>
                      <span className="text-[9px] mt-1 block text-slate-400 px-1">
                        {msg.sender === 'admin' ? 'إداري' : 'العضو'} · {msg.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply input + templates */}
              <div className="p-4 border-t border-slate-100 flex-shrink-0 space-y-2">
                {/* Templates */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-cairo font-bold transition-colors flex items-center gap-1.5"
                  >
                    <MailOpen className="w-3.5 h-3.5" /> قوالب جاهزة
                    <ChevronLeft className={`w-3 h-3 transition-transform ${showTemplates ? '-rotate-90' : ''}`} />
                  </button>
                </div>
                <AnimatePresence>
                  {showTemplates && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-1.5 pb-1">
                        {REPLY_TEMPLATES.map(tpl => (
                          <button
                            key={tpl.label}
                            onClick={() => { setReplyText(tpl.text); setShowTemplates(false); }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-cairo font-bold transition-colors"
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input row */}
                <div className="flex items-center gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                    placeholder="اكتب ردك..."
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-slate-500 font-tajawal text-xs text-slate-950"
                  />
                  <button
                    onClick={handleSendReply}
                    className="w-12 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                  >
                    <Send className="w-5 h-5 -scale-x-100" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <MessageSquare className="w-14 h-14 text-slate-200 mb-2" />
              <p className="text-xs text-slate-400 font-tajawal">اختر تذكرة من القائمة لعرض الرسائل والرد عليها</p>
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* نافذة تأكيد اعتراض/حذف رسالة استفسار */}
      <Modal open={confirmDeleteMsg !== null} onClose={() => setConfirmDeleteMsg(null)} title="اعتراض وحذف رسالة">
        <div className="space-y-4 text-right" dir="rtl">
          <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl">
            <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-cairo font-bold text-sm text-rose-800">اعتراض على رسالة</p>
              <p className="text-xs text-rose-600 font-tajawal mt-1 leading-relaxed">
                سيتم حذف هذه الرسالة نهائياً من محادثة العضو. لا يمكن التراجع عن هذا الإجراء. تأكد من أن الرسالة تخالف الشروط قبل الحذف.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDeleteMsg(null)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-cairo font-bold text-sm hover:bg-slate-200 transition-colors">
              إلغاء
            </button>
            <button onClick={handleDeleteInquiry} className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-cairo font-bold text-sm hover:bg-rose-700 transition-colors flex items-center justify-center gap-1.5">
              <Trash2 className="w-4 h-4" /> نعم، احذف الرسالة
            </button>
          </div>
        </div>
      </Modal>

      {/* Member profile modal */}
      <Modal open={!!selectedMember} onClose={() => setSelectedMember(null)} title="تفاصيل وبيانات العضو الحساسة" size="lg">
        {selectedMember && <MemberDetailsView member={selectedMember} />}
      </Modal>

      {/* Transfer modal */}
      <Modal open={!!transferModal} onClose={() => setTransferModal(null)} title="تحويل التذكرة لمسؤول آخر">
        <div className="space-y-4 text-right" dir="rtl">
          <p className="text-xs text-slate-500 font-tajawal">اختر المسؤول الذي تريد تحويل التذكرة إليه:</p>
          <div className="space-y-2">
            {adminUsers.filter(a => a.status === 'active').map((admin) => (
              <button
                key={admin.id}
                onClick={() => setTransferTarget(admin.name)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  transferTarget === admin.name ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">
                  {admin.name.charAt(0)}
                </div>
                <div className="flex-1 text-right">
                  <span className="font-cairo font-bold text-sm text-slate-800">{admin.name}</span>
                  <p className="text-[10px] text-slate-400 font-tajawal">{admin.role === 'super_admin' ? 'مدير عام' : 'مشرف'}</p>
                </div>
                {transferTarget === admin.name && <CheckCircle2 className="w-4 h-4 text-amber-600 mr-auto" />}
              </button>
            ))}
          </div>
          <button
            onClick={handleTransfer}
            disabled={!transferTarget}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            تحويل التذكرة
          </button>
        </div>
      </Modal>
    </div>
  );
}

// Compact Member details
function MemberDetailsView({ member }: { member: AdminMember }) {
  const [showPassword, setShowPassword] = useState(false);

  const sections = [
    {
      title: 'بيانات الحساب الحساسة', icon: Lock, color: 'text-rose-600 bg-rose-50',
      fields: [
        { label: 'الاسم الحقيقي', value: member.realName || '—', icon: null },
        { label: 'البريد الإلكتروني', value: member.email, icon: Mail },
        { label: 'رقم الجوال', value: member.phone || '—', icon: Phone },
        { label: 'كلمة المرور', value: showPassword ? member.password : '••••••••', icon: Lock, action: () => setShowPassword(!showPassword), actionLabel: showPassword ? 'إخفاء' : 'إظهار' },
      ],
    },
    {
      title: 'المعلومات الأساسية', icon: MapPin, color: 'text-blue-600 bg-blue-50',
      fields: [
        { label: 'الاسم المستعار', value: member.nickname, icon: null },
        { label: 'الجنس', value: member.gender === 'male' ? 'ذكر' : 'أنثى', icon: null },
        { label: 'العمر', value: `${member.age} سنة`, icon: null },
        { label: 'الدولة', value: member.country, icon: null },
        { label: 'المدينة', value: member.city, icon: null },
        { label: 'الحي', value: member.district || 'غير محدد', icon: null },
      ],
    },
    {
      title: 'الصفات الشخصية', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50',
      fields: [
        { label: 'الطول', value: `${member.height} سم`, icon: null },
        { label: 'الوزن', value: `${member.weight} كجم`, icon: null },
        { label: 'لون البشرة', value: member.skinColor, icon: null },
        { label: 'الحالة الصحية', value: member.health, icon: null },
        { label: 'التدخين', value: member.smoking, icon: null },
      ],
    },
    {
      title: 'العمل والمؤهل', icon: Crown, color: 'text-amber-600 bg-amber-50',
      fields: [
        { label: 'المؤهل', value: member.education, icon: null },
        { label: 'العمل', value: member.workType, icon: null },
        { label: 'السكن', value: member.housing, icon: null },
      ],
    },
  ];

  return (
    <div className="space-y-4 max-h-[80vh] overflow-y-auto p-1 text-right" dir="rtl">
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl ${member.gender === 'male' ? 'bg-blue-600' : 'bg-rose-500'}`}>
          {member.nickname.charAt(0)}
        </div>
        <div className="flex-1">
          <h3 className="font-cairo font-bold text-base text-slate-900 flex items-center gap-1.5">
            {member.nickname}
            {member.verified && <ShieldCheck className="w-5 h-5 text-sky-500" />}
          </h3>
          <p className="text-xs text-slate-500 font-tajawal">{member.realName}</p>
        </div>
      </div>
      {sections.map((section) => {
        const SectionIcon = section.icon;
        return (
          <div key={section.title} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${section.color}`}>
                <SectionIcon className="w-4 h-4" />
              </div>
              <h4 className="font-cairo font-bold text-slate-950 text-xs">{section.title}</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {section.fields.map((field) => {
                const FieldIcon = field.icon;
                return (
                  <div key={field.label} className="flex items-center justify-between gap-1.5 px-3 py-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-500 font-tajawal">{field.label}</span>
                    <div className="flex items-center gap-1.5">
                      {FieldIcon && <FieldIcon className="w-3.5 h-3.5 text-slate-400" />}
                      <span className="text-xs font-cairo font-bold text-slate-900 truncate max-w-[120px]">{field.value}</span>
                      {field.action && (
                        <button onClick={field.action} className="text-[9px] text-amber-600 font-cairo font-black hover:underline">{field.actionLabel}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="space-y-2 pt-2">
        <div className="bg-slate-50 rounded-xl p-3">
          <h4 className="font-cairo font-bold text-slate-900 text-xs mb-1">نبذة:</h4>
          <p className="text-xs text-slate-600 font-tajawal leading-relaxed">{member.bio || 'لم يكتب نبذة.'}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <h4 className="font-cairo font-bold text-slate-900 text-xs mb-1">مواصفات الشريك:</h4>
          <p className="text-xs text-slate-600 font-tajawal leading-relaxed">{member.aboutPartner || 'لم يحدد.'}</p>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
//  تبويب مراجعة رسائل الاستفسار
// ====================================================================
function InquiryReviewTab({
  messages,
  allMessages,
  filter,
  setFilter,
  search,
  setSearch,
  onModerate,
  onDelete,
  pendingCount,
}: {
  messages: (InquiryMessage & { request_id: number })[];
  allMessages: (InquiryMessage & { request_id: number })[];
  filter: 'pending' | 'approved' | 'rejected' | 'all';
  setFilter: (f: 'pending' | 'approved' | 'rejected' | 'all') => void;
  search: string;
  setSearch: (s: string) => void;
  onModerate: (id: number, action: 'approve' | 'reject') => void;
  onDelete: (id: number) => void;
  pendingCount: number;
}) {
  const stats = {
    total: allMessages.length,
    pending: allMessages.filter(m => !m.approved && !m.rejected).length,
    approved: allMessages.filter(m => m.approved).length,
    rejected: allMessages.filter(m => m.rejected).length,
  };

  const getSenderInfo = (senderId: string) => {
    if (senderId === 'admin') return { name: 'الإدارة', isDeleted: false, isBanned: false, isSuspended: false };
    const m = getLiveMemberById(senderId);
    const isDeleted = !m || m.status === 'deleted' || (m as any)?.deleted === true;
    const isBanned = m?.status === 'banned';
    const isSuspended = m?.status === 'suspended';
    const nickname = m?.nickname || senderId;
    return { name: isDeleted ? `${nickname} (حساب مُحذوف)` : nickname, isDeleted, isBanned, isSuspended };
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الرسائل', value: stats.total, color: 'bg-slate-100 text-slate-700', icon: MessageSquare },
          { label: 'بانتظار المراجعة', value: stats.pending, color: 'bg-rose-100 text-rose-700', icon: Clock },
          { label: 'موافق عليها', value: stats.approved, color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
          { label: 'مرفوضة', value: stats.rejected, color: 'bg-amber-100 text-amber-700', icon: XCircle },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200/80 text-center">
            <div className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center mb-1.5 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div className="font-cairo font-black text-lg text-slate-950">{s.value}</div>
            <div className="text-[10px] text-slate-500 font-tajawal">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في نص الرسائل..."
            className="w-full pr-12 pl-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterDropdown
            label="الحالة:"
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            options={[
              { value: 'pending', label: 'بانتظار المراجعة', count: stats.pending },
              { value: 'approved', label: 'موافق عليها', count: stats.approved },
              { value: 'rejected', label: 'مرفوضة', count: stats.rejected },
              { value: 'all', label: 'كل الرسائل', count: stats.total },
            ]}
          />
        </div>
      </div>

      {/* Messages list */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {messages.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-cairo">
              {filter === 'pending' ? 'لا توجد رسائل بانتظار المراجعة 🎉' : 'لا توجد رسائل مطابقة'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {messages.map((msg) => {
              const senderInfo = getSenderInfo(msg.sender_id);
              const isPending = !msg.approved && !msg.rejected;
              return (
                <div key={msg.id} className={`p-4 hover:bg-slate-50 transition-colors ${isPending ? 'bg-rose-50/30' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 ${msg.sender_id === 'admin' ? 'bg-slate-500' : senderInfo.isDeleted ? 'bg-rose-600' : 'bg-navy-900'}`}>
                      {senderInfo.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-cairo font-bold text-sm text-slate-900">{senderInfo.name}</span>
                        {senderInfo.isDeleted && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-cairo font-bold border border-rose-300">
                            ⚠️ حساب مُحذوف
                          </span>
                        )}
                        {senderInfo.isBanned && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[9px] font-cairo font-bold border border-rose-200">
                            ⛔ محظور
                          </span>
                        )}
                        {senderInfo.isSuspended && (
                          <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 text-[9px] font-cairo font-bold border border-orange-200">
                            ⚠️ موقوف
                          </span>
                        )}
                        {(() => {
                          const reqObj = dataService.db.getRequest(msg.request_id);
                          const isImp = reqObj?.source_type === 'imported';
                          const num = reqObj?.request_number || msg.request_id;
                          return (
                            <span className={`text-[10px] font-tajawal font-bold px-1.5 py-0.5 rounded ${isImp ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                              طلب {isImp ? 'مستوردين' : 'مسجلين'} #{num}
                            </span>
                          );
                        })()}
                        {isPending && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-cairo font-bold flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> بانتظار المراجعة
                          </span>
                        )}
                        {msg.approved && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-cairo font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> موافق عليها
                          </span>
                        )}
                        {msg.rejected && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-cairo font-bold flex items-center gap-1">
                            <XCircle className="w-2.5 h-2.5" /> مرفوضة
                          </span>
                        )}
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 mb-2">
                        <p className="text-sm text-slate-800 font-tajawal leading-relaxed">{msg.text}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-tajawal">
                          {new Date(msg.created_at).toLocaleString('ar-SA')}
                          {msg.moderated_by && ` · راجعها: ${msg.moderated_by}`}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isPending && (
                            <>
                              <button
                                onClick={() => onModerate(msg.id, 'approve')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-cairo font-bold transition-colors flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> موافقة
                              </button>
                              <button
                                onClick={() => onModerate(msg.id, 'reject')}
                                className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-cairo font-bold transition-colors flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" /> رفض
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => onDelete(msg.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 text-xs font-cairo font-bold transition-colors flex items-center gap-1"
                            title="اعتراض وحذف الرسالة نهائياً"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> اعتراض وحذف
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
