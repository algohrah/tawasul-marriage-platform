import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Headphones, Plus, Send, Clock, CheckCircle2, AlertCircle,
  MessageSquare, ChevronLeft, Headphones as Support, Check,
  HeartHandshake, Sparkles, ShieldCheck, ArrowRight, ArrowLeft,
  ExternalLink, MessageCircle, MapPin, BadgeCheck, Zap,
} from 'lucide-react';
import { useApp } from '../lib/AppContext';
import type { SupportTicket } from '../lib/types';
import { getAvatar, getGenderColors } from '../lib/types';
import { Button } from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useInterestRequests, getCurrentUserId } from '../lib/useInterestRequests';
import { dataService } from '../lib/data/DataService';

const statusConfig = {
  open: { label: 'مفتوحة', color: 'text-sky-600 bg-sky-50', icon: Clock },
  in_progress: { label: 'قيد المعالجة', color: 'text-gold-600 bg-gold-300/15', icon: AlertCircle },
  resolved: { label: 'تم الحل', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
  closed: { label: 'مغلقة', color: 'text-navy-400 bg-cream-100', icon: CheckCircle2 },
};

const stageLabels: Record<string, { label: string; color: string }> = {
  sent: { label: 'بانتظار الموافقة المبدئية', color: 'text-amber-800 bg-amber-50 border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800' },
  accepted: { label: 'تم القبول - بانتظار سداد الجدية', color: 'text-sky-800 bg-sky-50 border-sky-200/80 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800' },
  seriousness: { label: 'سداد رسوم الجدية', color: 'text-purple-800 bg-purple-50 border-purple-200/80 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800' },
  coordination: { label: 'تنسيق اللقاء الشرعي', color: 'text-indigo-800 bg-indigo-50 border-indigo-200/80 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800' },
  sharia_viewing: { label: 'الرؤية واللقاء الشرعي', color: 'text-teal-800 bg-teal-50 border-teal-200/80 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800' },
  completed: { label: 'مكتمل بتوافق مبارك 🌸', color: 'text-emerald-800 bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800' },
  declined: { label: 'تم الاعتذار بلطف', color: 'text-rose-800 bg-rose-50 border-rose-200/80 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800' },
  cancelled: { label: 'ملغي', color: 'text-slate-800 bg-slate-100 border-slate-200/80 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800' },
};

const categories = ['استفسار عام', 'طلب ترقية', 'مشكلة تقنية', 'شكوى', 'اقتراح'] as const;

export default function AdminChat() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    showToast,
    supportTickets,
    sendSupportMessage,
    createSupportTicket,
    members,
    user,
  } = useApp();

  const activeUserId = user?.memberId || getCurrentUserId();
  const { requests, loading: requestsLoading } = useInterestRequests(activeUserId);

  const [activeMainTab, setActiveMainTab] = useState<'requests' | 'tickets'>('requests');
  const [requestInquiries, setRequestInquiries] = useState<Record<number, any>>({});
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState<typeof categories[number]>('استفسار عام');
  const [newMessage, setNewMessage] = useState('');

  // تحميل تفاصيل رسائل واستفسارات الإدارة لكل طلب
  useEffect(() => {
    let mounted = true;
    const loadInquiries = async () => {
      if (!requests || requests.length === 0) return;
      const inqMap: Record<number, any> = {};
      for (const r of requests) {
        try {
          const inq = await dataService.db.getInquiry(r.id);
          inqMap[r.id] = inq;
        } catch {
          // ignore
        }
      }
      if (mounted) {
        setRequestInquiries(inqMap);
      }
    };
    loadInquiries();
    const handleUpdate = () => loadInquiries();
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('twafok_notification_update', handleUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('twafok_notification_update', handleUpdate);
    };
  }, [requests]);

  // Active ticket calculated reactively from shared state
  const activeTicket = supportTickets.find(t => t.id === activeTicketId) || null;

  // Sync / intercept partner coordination redirect parameters
  useEffect(() => {
    const partnerId = searchParams.get('partnerId');
    if (partnerId) {
      const partner = members.find(m => m.id === partnerId);
      if (partner) {
        const expectedSubject = `تنسيق اللقاء الشرعي - ${partner.nickname}`;
        // Try to find existing conversation
        const existing = supportTickets.find(
          t => t.userId === activeUserId && t.subject === expectedSubject
        );
        if (existing) {
          setActiveMainTab('tickets');
          setActiveTicketId(existing.id);
        } else {
          const initialText = `السلام عليكم ورحمة الله وبركاته،
يسعدنا في إدارة «توافق» البدء في تنسيق اللقاء الشرعي والتقريب المبارك بينكما.

بطاقة العضو المطلوب التنسيق معه:
• الاسم المستعار: ${partner.nickname}
• العمر: ${partner.age} سنة
• المدينة: ${partner.city}
• المؤهل الدراسي: ${partner.education}
• جهة العمل: ${partner.workType}

يرجى تأكيد رغبتكم بالبدء وسيقوم وسيط العلاقات بالتواصل مع عائلة العضو والبدء في الرؤية الشرعية الرسمية للطرفين.`;

          const created = createSupportTicket(expectedSubject, 'استفسار عام', initialText, activeUserId);
          setActiveMainTab('tickets');
          setActiveTicketId(created.id);
          showToast('تم فتح محادثة تنسيق اللقاء الشرعي مع الإدارة 🌸', 'success');
        }
      }
      searchParams.delete('partnerId');
      setSearchParams(searchParams);
    }
  }, [searchParams, members, supportTickets, createSupportTicket, setSearchParams, showToast, activeUserId]);

  const sendMessage = () => {
    if (!draft.trim() || !activeTicketId) return;
    sendSupportMessage(activeTicketId, draft, 'user');
    setDraft('');

    // Simulated helper reply after 2.5 seconds
    setTimeout(() => {
      sendSupportMessage(
        activeTicketId,
        'شكرًا لتواصلك معنا الدائم في توافق. تم استلام تدوينك، وسلَّم وسيط العلاقات الطلب لمراجعته وسيتم إفادتك فور الاتصال المباشر مع الأطراف. 🌸',
        'admin'
      );
    }, 2500);
  };

  const createTicket = () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    const created = createSupportTicket(newSubject, newCategory, newMessage, activeUserId);
    setNewTicketOpen(false);
    setNewSubject('');
    setNewMessage('');
    showToast('تم إنشاء تذكرة الدعم بنجاح! 🎫', 'success');
    setActiveTicketId(created.id);
  };

  // Only show tickets relevant to the active user
  const userTickets = supportTickets.filter(t => t.userId === activeUserId || t.userId === 'm2');

  if (activeTicket) {
    const sc = statusConfig[activeTicket.status] || statusConfig.open;
    return (
      <div className="bg-cream-50 dark:bg-navy-950 min-h-[calc(100vh-5rem)] lg:min-h-screen" dir="rtl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <button
            onClick={() => setActiveTicketId(null)}
            className="flex items-center gap-2 text-navy-600 dark:text-cream-200 hover:text-gold-700 font-cairo font-semibold text-sm mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 rotate-180" /> رجوع لقائمة الإدارة والتذاكر
          </button>

          <div className="bg-white dark:bg-navy-900 rounded-3xl shadow-soft border border-cream-200/60 dark:border-navy-800 overflow-hidden flex flex-col h-[70vh]">
            {/* Header */}
            <div className="flex items-center gap-3 p-3 sm:p-4 border-b border-cream-200 dark:border-navy-800 bg-cream-50/40 dark:bg-navy-950/40">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-navy-gradient flex items-center justify-center flex-shrink-0">
                <Headphones className="w-5 h-5 sm:w-6 sm:h-6 text-gold-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-cairo font-bold text-navy-900 dark:text-cream-50 truncate text-sm sm:text-base">{activeTicket.subject}</h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.color} flex items-center gap-1`}>
                    <sc.icon className="w-3 h-3" /> {sc.label}
                  </span>
                  <span className="text-xs text-navy-400 dark:text-slate-400 font-tajawal">{activeTicket.category}</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-cream-50/20 dark:bg-navy-950/20">
              {activeTicket.messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className="flex gap-2 max-w-[90%] sm:max-w-[85%]">
                    {msg.sender === 'admin' && (
                      <div className="w-8 h-8 rounded-full bg-navy-gradient flex items-center justify-center flex-shrink-0 mt-1">
                        <Headphones className="w-4 h-4 text-gold-300" />
                      </div>
                    )}
                    <div>
                      <div className={`px-3.5 sm:px-4 py-2.5 rounded-2xl whitespace-pre-line ${
                        msg.sender === 'user'
                          ? 'bg-navy-900 text-white rounded-bl-md dark:bg-navy-700'
                          : 'bg-white dark:bg-navy-800 text-navy-900 dark:text-cream-50 rounded-br-md shadow-soft border border-cream-200/80 dark:border-navy-700 font-semibold'
                      }`}>
                        <p className="font-tajawal text-sm leading-relaxed">{msg.text}</p>
                      </div>
                      <span className="text-[10px] mt-1 block text-navy-400 dark:text-slate-400 px-1">
                        {msg.sender === 'admin' ? 'مستشار العلاقات الشرعية' : 'أنت'} · {msg.time}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input */}
            <div className="p-3 sm:p-4 border-t border-cream-200 dark:border-navy-800 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="اكتب رسالتك للإدارة والوسيط الشرعي..."
                className="flex-1 min-w-0 px-3.5 sm:px-4 py-3 rounded-xl bg-cream-50 dark:bg-navy-950 border border-cream-200 dark:border-navy-800 focus:border-gold-400 focus:outline-none font-tajawal text-navy-950 dark:text-cream-50 text-sm sm:text-base"
              />
              <button
                onClick={sendMessage}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gold-gradient flex items-center justify-center text-navy-900 flex-shrink-0 shadow-soft cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                <Send className="w-5 h-5 -scale-x-100" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream-50 dark:bg-navy-950 min-h-screen pb-28 lg:pb-8" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-6 font-cairo">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-navy-gradient flex items-center justify-center shadow-md flex-shrink-0">
              <Headphones className="w-5 h-5 sm:w-6 sm:h-6 text-gold-300" />
            </div>
            <div>
              <h1 className="font-cairo font-extrabold text-xl sm:text-2xl text-navy-900 dark:text-cream-50">إدارة التواصل وتنسيق التوافق</h1>
              <p className="text-navy-600 dark:text-slate-300 font-tajawal text-xs sm:text-sm text-right">نتابع طلباتك ونوجهك خطوة بخطوة حتى التوفيق المبارك</p>
            </div>
          </div>
          {activeMainTab === 'tickets' && (
            <button
              onClick={() => setNewTicketOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gold-gradient text-navy-900 font-cairo font-bold text-sm shadow-soft hover:shadow-gold transition-all cursor-pointer self-start sm:self-auto w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> تذكرة جديدة
            </button>
          )}
        </div>

        {/* Info banner */}
        <div className="bg-navy-gradient rounded-2xl p-3.5 sm:p-4 mb-5 relative overflow-hidden shadow-sm">
          <div className="absolute inset-0 pattern-arabesque opacity-30" />
          <div className="relative flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-gold-300 flex-shrink-0" />
            <p className="text-cream-200/90 font-tajawal text-xs sm:text-sm text-right leading-relaxed">
              التواصل في توافق <span className="text-gold-300 font-bold">بإشراف إداري ووساطة شرعية رسمية</span>. نضمن خصوصية العائلات وسرية المراسلات والتنسيق المباشر.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-white dark:bg-navy-900 border border-cream-200/80 dark:border-navy-800 rounded-2xl mb-6 shadow-xs">
          <button
            onClick={() => setActiveMainTab('requests')}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-cairo font-bold text-xs sm:text-sm transition-all cursor-pointer min-w-0 ${
              activeMainTab === 'requests'
                ? 'bg-navy-900 text-white dark:bg-gold-gradient dark:text-navy-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-cream-100 dark:hover:bg-navy-800'
            }`}
          >
            <HeartHandshake className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              <span className="hidden sm:inline">طلبات التوافق وتوجيهات الإدارة</span>
              <span className="sm:hidden">طلبات التوافق</span>
            </span>
            {requests.length > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                activeMainTab === 'requests'
                  ? 'bg-white/20 text-white dark:bg-navy-900 dark:text-gold-300'
                  : 'bg-cream-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300'
              }`}>
                {requests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveMainTab('tickets')}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-cairo font-bold text-xs sm:text-sm transition-all cursor-pointer min-w-0 ${
              activeMainTab === 'tickets'
                ? 'bg-navy-900 text-white dark:bg-gold-gradient dark:text-navy-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-cream-100 dark:hover:bg-navy-800'
            }`}
          >
            <Support className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              <span className="hidden sm:inline">تذاكر الدعم والاستفسارات</span>
              <span className="sm:hidden">تذاكر الدعم</span>
            </span>
            {userTickets.length > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                activeMainTab === 'tickets'
                  ? 'bg-white/20 text-white dark:bg-navy-900 dark:text-gold-300'
                  : 'bg-cream-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300'
              }`}>
                {userTickets.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: Compatibility Requests & Admin Directives */}
        {activeMainTab === 'requests' && (
          <div className="space-y-4">
            {requestsLoading ? (
              <div className="text-center py-12 bg-white dark:bg-navy-900 rounded-3xl border border-cream-200 dark:border-navy-800">
                <Clock className="w-8 h-8 text-gold-500 animate-spin mx-auto mb-2" />
                <p className="font-cairo text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل طلبات التوافق والتوجيهات الإدارية...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white dark:bg-navy-900 rounded-3xl border border-cream-200 dark:border-navy-800">
                <HeartHandshake className="w-12 h-12 text-slate-300 dark:text-navy-600 mx-auto mb-3" />
                <h3 className="font-cairo font-bold text-base text-navy-900 dark:text-cream-50 mb-1">لا توجد طلبات توافق نشطة حالياً</h3>
                <p className="font-cairo text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
                  يمكنك استعراض الأعضاء المتوافقين معك وإرسال طلب اهتمام، وسيظهر هنا مسار التنسيق وتوجيهات الإدارة لطلبك.
                </p>
                <button
                  onClick={() => navigate('/search')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-gradient text-navy-900 font-cairo font-bold text-xs shadow-soft hover:shadow-gold transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" /> استعراض الأعضاء والبحث
                </button>
              </div>
            ) : (
              requests.map((req) => {
                const isSender = req.sender_id === activeUserId;
                const otherPartyId = isSender ? req.receiver_id : req.sender_id;
                const other = members.find((m) => m.id === otherPartyId);
                const colors = other ? getGenderColors(other.gender) : getGenderColors('male');
                const stConfig = stageLabels[req.journey_stage] || stageLabels.sent;
                const inq = requestInquiries[req.id];
                const adminMessages = inq?.messages?.filter((m: any) => m.sender_id === 'admin') || [];
                const latestAdminMsg = adminMessages.length > 0 ? adminMessages[adminMessages.length - 1] : null;
                const latestInqMsg = inq?.messages && inq.messages.length > 0 ? inq.messages[inq.messages.length - 1] : null;

                return (
                  <motion.div
                    key={`chat-req-${req.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-navy-900 rounded-3xl border border-cream-200/90 dark:border-navy-800 p-4 sm:p-5 shadow-soft hover:border-gold-300/80 transition-all group"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Link to={`/member/${otherPartyId}`} className="relative flex-shrink-0 group-hover:scale-105 transition-transform">
                          <img
                            src={getAvatar(other?.gender || 'male')}
                            alt={other?.nickname || 'العضو'}
                            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover ring-2 ${colors.ring} ring-offset-1`}
                          />
                        </Link>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-cairo font-black text-sm sm:text-base text-navy-950 dark:text-cream-50">
                              {other?.nickname || 'طرف التوافق'}
                            </span>
                            {other?.verified && <BadgeCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-cream-100 dark:bg-navy-950 text-slate-600 dark:text-slate-300">
                              #{req.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-400 mt-0.5 flex-wrap">
                            <span>{other?.age ? `${other.age} سنة` : ''}</span>
                            {other?.city && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-3 h-3" /> {other.city}
                              </span>
                            )}
                            <span>· {isSender ? 'طلب أرسلته' : 'طلب وارد إليك'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stage Badge */}
                      <span className={`text-[11px] font-cairo font-bold px-3 py-1 rounded-full border ${stConfig.color} flex-shrink-0`}>
                        {stConfig.label}
                      </span>
                    </div>

                    {/* Admin Guidance Box if present */}
                    {latestAdminMsg && (
                      <div className="mb-3.5 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 dark:border-emerald-500/40 rounded-2xl p-3 sm:p-3.5 shadow-xs">
                        <div className="flex items-center justify-between gap-2 mb-1.5 text-xs text-emerald-800 dark:text-emerald-300 font-cairo font-black flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            توجيه وإشعار من إدارة المنصة
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {new Date(latestAdminMsg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs font-cairo text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line bg-white/80 dark:bg-navy-950/60 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                          {latestAdminMsg.text}
                        </p>
                      </div>
                    )}

                    {/* Latest inquiry message if exists and not admin */}
                    {latestInqMsg && latestInqMsg.sender_id !== 'admin' && (
                      <div className="mb-3 bg-cream-50/70 dark:bg-navy-950/60 border border-cream-200/60 dark:border-navy-800 rounded-2xl p-3">
                        <div className="flex items-center justify-between gap-2 mb-1 text-[11px] text-slate-400 flex-wrap">
                          <span className="font-bold text-navy-800 dark:text-cream-100 flex items-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5 text-gold-500" />
                            آخر رسالة في استفسار التوافق
                          </span>
                          <span>{new Date(latestInqMsg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 italic">
                          "{latestInqMsg.text}"
                        </p>
                      </div>
                    )}

                    {/* Original interest message */}
                    {!latestAdminMsg && !latestInqMsg && req.message && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic bg-cream-50/60 dark:bg-navy-950/40 p-2.5 rounded-xl border border-cream-200/50 dark:border-navy-800/60 mb-3">
                        "{req.message}"
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1 border-t border-cream-100 dark:border-navy-800">
                      <button
                        onClick={() => navigate(`/journey/${req.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white dark:bg-gold-gradient dark:text-navy-950 font-cairo font-bold text-xs transition-all shadow-xs cursor-pointer min-w-0"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-gold-300 dark:text-navy-950 flex-shrink-0" />
                        <span className="truncate">الانتقال إلى رحلة التوافق</span>
                        <ArrowLeft className="w-3.5 h-3.5 rotate-180 flex-shrink-0" />
                      </button>

                      <button
                        onClick={() => navigate(`/journey/${req.id}?tab=inquiry`)}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 sm:px-3.5 rounded-xl bg-cream-100 dark:bg-navy-800 hover:bg-cream-200 dark:hover:bg-navy-700 text-navy-800 dark:text-cream-100 font-cairo font-bold text-xs transition-colors cursor-pointer border border-cream-200/80 dark:border-navy-700 flex-shrink-0"
                        title="غرفة الاستفسار والرسائل المباشرة"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-gold-600 dark:text-gold-400" />
                        <span className="hidden sm:inline">الاستفسارات</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: Support Tickets */}
        {activeMainTab === 'tickets' && (
          <div className="space-y-3">
            {userTickets.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-navy-900 rounded-3xl border border-cream-200 dark:border-navy-800">
                <Support className="w-12 h-12 text-cream-400 dark:text-navy-600 mx-auto mb-2" />
                <p className="text-navy-500 dark:text-slate-400 font-tajawal">لم تفتح أي تذاكر محادثة حالياً.</p>
              </div>
            ) : (
              userTickets.map((ticket) => {
                const sc = statusConfig[ticket.status] || statusConfig.open;
                const lastMsg = ticket.messages[ticket.messages.length - 1];
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setActiveTicketId(ticket.id)}
                    className="w-full flex items-start gap-3 p-3.5 sm:p-4 bg-white dark:bg-navy-900 rounded-2xl shadow-soft border border-cream-200/60 dark:border-navy-800 text-right hover:shadow-luxe hover:border-gold-300 transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-cream-100 dark:bg-navy-800 flex items-center justify-center flex-shrink-0">
                      <Support className="w-5 h-5 text-navy-600 dark:text-cream-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                        <h3 className="font-cairo font-bold text-navy-900 dark:text-cream-50 truncate">{ticket.subject}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.color} flex items-center gap-1 flex-shrink-0`}>
                          <sc.icon className="w-3 h-3" /> {sc.label}
                        </span>
                      </div>
                      <p className="text-sm text-navy-500 dark:text-slate-400 font-tajawal truncate text-right">
                        {lastMsg ? lastMsg.text : 'لا توجد رسائل بعد'}
                      </p>
                      <p className="text-xs text-navy-400 dark:text-slate-500 font-tajawal mt-1 text-right">
                        {ticket.category} · {ticket.updatedAt}
                      </p>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-navy-300 dark:text-slate-600 flex-shrink-0 mt-1" />
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* New ticket modal */}
      <Modal open={newTicketOpen} onClose={() => setNewTicketOpen(false)} title="تذكرة دعم واستفسار جديدة">
        <div className="space-y-4 font-cairo">
          <div>
            <label className="block text-sm font-semibold text-navy-800 dark:text-cream-100 mb-2 text-right">الموضوع</label>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="موضوع الاستفسار أو طلب التنسيق"
              className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-navy-950 border-2 border-cream-200 dark:border-navy-800 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 dark:text-cream-50 text-right"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy-800 dark:text-cream-100 mb-2 text-right">التصنيف</label>
            <div className="flex flex-wrap gap-2 justify-start">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setNewCategory(cat)}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    newCategory === cat
                      ? 'bg-navy-900 text-white dark:bg-gold-gradient dark:text-navy-950 shadow-soft'
                      : 'bg-cream-100 dark:bg-navy-800 text-navy-600 dark:text-cream-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy-800 dark:text-cream-100 mb-2 text-right">رسالتك</label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={4}
              placeholder="اشرح استفسارك بالتفصيل..."
              className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-navy-950 border-2 border-cream-200 dark:border-navy-800 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 dark:text-cream-50 text-right resize-none"
            />
          </div>
          <Button fullWidth size="lg" onClick={createTicket}>
            <Send className="w-5 h-5 -scale-x-100" /> إرسال التذكرة
          </Button>
        </div>
      </Modal>
    </div>
  );
}
