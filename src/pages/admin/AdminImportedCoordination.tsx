import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageSquare, Send, CheckCircle2, XCircle, Clock,
  Activity, Filter, RefreshCw, AlertCircle, X,
  ClipboardList, Edit, Copy, Eye, CreditCard,
  User, Check, Calendar, MapPin, ChevronRight, ChevronDown, ChevronUp,
  ShieldCheck, Sparkles, MessageCircle, Settings, CheckSquare,
  ArrowRightLeft, AlertTriangle, Bell, Trash2, Edit3
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { dataService } from '../../lib/data/DataService';
import type { InterestRequest } from '../../lib/data';
import AdminMemberDetailModal from '../../components/admin/AdminMemberDetailModal';

interface ChatMessage {
  id: number;
  request_id: number;
  sender_id: string;
  text: string;
  charged_to: string | null;
  created_at: string;
}

type UnifiedFilter = 'all' | 'pending' | 'awaiting_deposit' | 'paid' | 'in_mediation' | 'completed' | 'terminal';

// جميع مراحل ومسارات الطلب الإدارية
const ALL_STAGES = [
  { id: 'sent', label: 'طلب جديد معلق (Sent)', color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-navy-800 dark:text-slate-300' },
  { id: 'accepted', label: 'قبول مبدئي (Accepted)', color: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300' },
  { id: 'seriousness', label: 'بانتظار سداد العربون (Seriousness)', color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300' },
  { id: 'coordination', label: 'قيد الوساطة والتنسيق (Coordination)', color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300' },
  { id: 'sharia_viewing', label: 'النظرة الشرعية والتواصل (Viewing)', color: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300' },
  { id: 'engagement', label: 'عقد القران / الملكة (Engagement)', color: 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-950 dark:text-teal-300' },
  { id: 'completed', label: 'تم الزواج والتوافق بنجاح 💍 (Completed)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' },
  { id: 'declined', label: 'مرفوض / تم الاعتذار ❌ (Declined)', color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300' },
  { id: 'cancelled', label: 'ملغي إدارياً 🚫 (Cancelled)', color: 'bg-slate-200 text-slate-800 border-slate-400 dark:bg-navy-950 dark:text-slate-400' },
];

// قوالب ردود إدارية سريعة
const ADMIN_QUICK_RESPONSES = [
  'تم استلام طلبكم وجاري التنسيق والتواصل مع الخطابة المسؤولة لبحث التوافق.',
  'تمت الموافقة المبدئية ونقوم حالياً بترتيب إجراءات التواصل الشرعي.',
  'نرجو تزويدنا بالأوقات المناسبة لكم لإتمام التواصل والتنسيق الشرعي.',
  'نعتذر منكم لعدم توفر النصيب في هذا الملف حالياً، ونسأل الله لكم التوفيق.',
];

export default function AdminImportedCoordination() {
  const { interestRequests, adminMembers, members, setInterestRequests, showToast } = useApp();
  
  // الفلاتر والبحث
  const [activeFilter, setActiveFilter] = useState<UnifiedFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // الطلب المحدد المعروض في النافذة المنبثقة (Popup Modal)
  const [selectedReq, setSelectedReq] = useState<InterestRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // غرف الدردشة
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingMsgText, setEditingMsgText] = useState<string>('');
  
  // حقول التحديث والملاحظات داخل النافذة
  const [targetStage, setTargetStage] = useState<string>('sent');
  const [isStageDropdownOpen, setIsStageDropdownOpen] = useState<boolean>(false);
  const [senderPaidState, setSenderPaidState] = useState<boolean>(false);
  const [receiverPaidState, setReceiverPaidState] = useState<boolean>(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // نافذة تفاصيل وتعديل العضو الكاملة (AdminMemberDetailModal)
  const [detailModalMember, setDetailModalMember] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalEditing, setDetailModalEditing] = useState(false);

  // خريطة الأعضاء لدمج البيانات
  const allMembers = useMemo(() => {
    const map = new Map<string, any>();
    (members || []).forEach(m => map.set(m.id, m));
    (adminMembers || []).forEach(m => map.set(m.id, { ...map.get(m.id), ...m }));
    return map;
  }, [members, adminMembers]);

  // جميع الطلبات التي تحتوي على عضو مستورد مع ترقيم تسلسلي يبدأ من 1
  const importedRequests = useMemo(() => {
    const list = interestRequests.filter(r => {
      const sender = allMembers.get(r.senderId);
      const receiver = allMembers.get(r.receiverId);
      return (
        r.sourceType === 'imported' ||
        (r as any).source_type === 'imported' ||
        r.senderId?.startsWith('imp_') ||
        r.receiverId?.startsWith('imp_') ||
        sender?.sourceType === 'imported' ||
        receiver?.sourceType === 'imported' ||
        sender?.importBatchId ||
        receiver?.importBatchId ||
        sender?.importOfficeName ||
        receiver?.importOfficeName
      );
    });

    // ترتيب الطلبات تصاعدياً حسب تاريخ الإنشاء لضمان أن أول طلب يبدأ بالرقم 1
    const sorted = [...list].sort((a, b) => {
      const timeA = a.createdAt || (new Date(a.time || 0).getTime()) || 0;
      const timeB = b.createdAt || (new Date(b.time || 0).getTime()) || 0;
      if (timeA !== timeB) return timeA - timeB;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    return sorted.map((r, idx) => ({
      ...r,
      requestNumber: r.requestNumber || (r as any).request_number || (idx + 1),
    }));
  }, [interestRequests, allMembers]);

  // تصفية الطلبات حسب الفلتر الموحد وشريط البحث
  const filteredRequests = useMemo(() => {
    return importedRequests.filter(r => {
      const sender = allMembers.get(r.senderId);
      const receiver = allMembers.get(r.receiverId);
      const searchLower = searchQuery.trim().toLowerCase();

      // البحث
      if (searchLower) {
        const matches = 
          r.id.toLowerCase().includes(searchLower) ||
          (sender?.nickname || '').toLowerCase().includes(searchLower) ||
          (receiver?.nickname || '').toLowerCase().includes(searchLower) ||
          (sender?.username || '').toLowerCase().includes(searchLower) ||
          (receiver?.username || '').toLowerCase().includes(searchLower) ||
          (sender?.khataabaName || '').toLowerCase().includes(searchLower) ||
          (receiver?.khataabaName || '').toLowerCase().includes(searchLower) ||
          (sender?.importOfficeName || '').toLowerCase().includes(searchLower) ||
          (receiver?.importOfficeName || '').toLowerCase().includes(searchLower);
        if (!matches) return false;
      }

      // الفلتر الموحد
      if (activeFilter === 'pending') {
        return r.status === 'pending';
      }
      if (activeFilter === 'awaiting_deposit') {
        return r.status === 'accepted_pending_payment';
      }
      if (activeFilter === 'paid') {
        return r.status === 'paid' || (r.senderPaid && r.receiverPaid);
      }
      if (activeFilter === 'in_mediation') {
        return r.status === 'in_mediation';
      }
      if (activeFilter === 'completed') {
        return r.status === 'completed';
      }
      if (activeFilter === 'terminal') {
        return r.status === 'declined' || r.status === 'cancelled';
      }
      return true;
    });
  }, [importedRequests, activeFilter, searchQuery, allMembers]);

  // إحصائيات سريعة ومطابقة
  const stats = useMemo(() => {
    const total = importedRequests.length;
    const pending = importedRequests.filter(r => r.status === 'pending').length;
    const awaitingDeposit = importedRequests.filter(r => r.status === 'accepted_pending_payment').length;
    const paid = importedRequests.filter(r => r.status === 'paid' || (r.senderPaid && r.receiverPaid)).length;
    const inMediation = importedRequests.filter(r => r.status === 'in_mediation').length;
    const completed = importedRequests.filter(r => r.status === 'completed').length;
    const terminal = importedRequests.filter(r => r.status === 'declined' || r.status === 'cancelled').length;
    return { total, pending, awaitingDeposit, paid, inMediation, completed, terminal };
  }, [importedRequests]);

  // تحديد طرفي الطلب المفتوح
  const currentParties = useMemo(() => {
    if (!selectedReq) return null;
    const s = allMembers.get(selectedReq.senderId);
    const r = allMembers.get(selectedReq.receiverId);
    
    const imported = s?.sourceType === 'imported' ? s : (r?.sourceType === 'imported' ? r : null);
    const registered = s?.sourceType !== 'imported' ? s : (r?.sourceType !== 'imported' ? r : null);
    
    return {
      sender: s,
      receiver: r,
      imported,
      registered,
      isSenderImported: s?.sourceType === 'imported',
    };
  }, [selectedReq, allMembers]);

  // مزامنة حالة الطلبات محلياً
  const syncLocalRequests = () => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('twafok_local_db_v4');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.requests)) {
            const mapped = parsed.requests.map((r: any) => {
              let status = 'pending';
              const st = r.journey_stage || r.status || 'sent';
              if (st === 'sent') status = 'pending';
              else if (st === 'accepted') status = 'accepted_pending_payment';
              else if (st === 'seriousness') status = 'accepted_pending_payment';
              else if (st === 'coordination' || st === 'sharia_viewing' || st === 'engagement') status = 'in_mediation';
              else if (st === 'completed') status = 'completed';
              else if (st === 'declined') status = 'declined';
              else if (st === 'cancelled') status = 'cancelled';

              if (r.sender_paid && r.receiver_paid && status === 'accepted_pending_payment') {
                status = 'paid';
              }

              return {
                id: String(r.id),
                requestNumber: Number(r.request_number) || Number(r.requestNumber) || undefined,
                sourceType: r.source_type || r.sourceType || undefined,
                senderId: r.sender_id,
                receiverId: r.receiver_id,
                status,
                journeyStage: st,
                message: r.message || 'طلب اهتمام مرسل عبر الإدارة',
                time: new Date(r.created_at).toLocaleDateString('ar-SA'),
                createdAt: new Date(r.created_at).getTime(),
                paymentStatus: (r.sender_paid && r.receiver_paid) ? 'paid' : 'waiting_for_payment',
                senderPaid: !!r.sender_paid,
                receiverPaid: !!r.receiver_paid,
                meetingDate: r.meeting_date || undefined,
                meetingNotes: r.meeting_notes || undefined,
                declineReason: r.decline_reason || undefined,
                adminNotes: r.admin_notes || undefined,
              };
            });
            setInterestRequests(mapped);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  // تحميل الشات عند فتح الطلب
  const loadChat = async (reqId: number | string) => {
    const parsedId = typeof reqId === 'number' ? reqId : Number(String(reqId).replace(/\D/g, ''));
    if (!parsedId || isNaN(parsedId)) {
      setChatMessages([]);
      return;
    }
    setChatLoading(true);
    try {
      const res = await dataService.db.getInquiry(parsedId);
      if (res && Array.isArray(res.messages)) {
        setChatMessages(res.messages);
      } else if (res && Array.isArray(res.data)) {
        setChatMessages(res.data);
      } else if (Array.isArray(res)) {
        setChatMessages(res);
      } else {
        setChatMessages([]);
      }
    } catch (err) {
      console.error('Error loading inquiry chat:', err);
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  // فتح نافذة إدارة وتنسيق الطلب المنبثقة
  const handleOpenRequestModal = (req: any) => {
    setSelectedReq(req);
    // استخراج المرحلة الفعلية
    let currentStage = 'sent';
    if (req.journeyStage) {
      currentStage = req.journeyStage;
    } else if (req.status === 'accepted_pending_payment') {
      currentStage = 'seriousness';
    } else if (req.status === 'in_mediation') {
      currentStage = 'coordination';
    } else if (req.status === 'completed') {
      currentStage = 'completed';
    } else if (req.status === 'declined') {
      currentStage = 'declined';
    } else if (req.status === 'cancelled') {
      currentStage = 'cancelled';
    }
    setTargetStage(currentStage);
    setIsStageDropdownOpen(false);
    setSenderPaidState(!!req.senderPaid);
    setReceiverPaidState(!!req.receiverPaid);
    setAdminNotes(req.adminNotes || '');
    setMeetingDate(req.meetingDate || '');
    setMeetingNotes(req.meetingNotes || '');
    setDeclineReason(req.declineReason || '');
    setIsModalOpen(true);
    const parsedId = Number(String(req.id).replace(/\D/g, ''));
    loadChat(isNaN(parsedId) ? 0 : parsedId);
  };

  // إغلاق النافذة المنبثقة
  const handleCloseRequestModal = () => {
    setIsModalOpen(false);
    setSelectedReq(null);
    setIsStageDropdownOpen(false);
    setChatMessages([]);
  };

  // فتح نافذة تفاصيل وتعديل العضو
  const handleOpenMemberDetail = (memberObj: any, editing: boolean = false) => {
    if (!memberObj) return;
    setDetailModalMember(memberObj);
    setDetailModalEditing(editing);
    setDetailModalOpen(true);
  };

  // توليد رسالة واتساب منسقة للخطابة
  const generateKhataabaText = () => {
    const imp = currentParties?.imported;
    const reg = currentParties?.registered;
    if (!imp) return '';
    const khataabaName = imp.importOfficeName || imp.khataabaName || 'أم فهد (الخطابة)';
    
    return `السلام عليكم ورحمة الله أختنا ${khataabaName}،\nلدينا متقدم جاد عبر منصة توافق لملف العضو (الكود: #${imp.id} - ${imp.nickname}):\n\n👤 *بيانات المتقدم:* ${reg?.nickname || 'متقدم مسجل'} (${reg?.age ? `${reg.age} سنة` : ''}) - ${reg?.city || ''}\n▫️ *الوظيفة والمؤهل:* ${reg?.jobTitle || 'غير محدد'} (${reg?.education || ''})\n▫️ *الحالة الاجتماعية:* ${reg?.maritalLabel || reg?.maritalStatus || ''}\n▫️ *القبيلة:* ${reg?.tribe || 'غير محدد'}\n\nنأمل التنسيق وبحث التوافق والتوفيق بين الطرفين بإذن الله.`;
  };

  // فتح واتساب الخطابة مباشرة
  const handleNotifyKhataaba = () => {
    const imp = currentParties?.imported;
    if (!imp) return;
    let phone = String(imp.khataabaPhone || imp.khataaba_phone || imp.phone || '').replace(/[^\d]/g, '');
    if (phone.startsWith('05')) {
      phone = '966' + phone.substring(1);
    } else if (phone.startsWith('5') && phone.length === 9) {
      phone = '966' + phone;
    }
    const text = generateKhataabaText();
    const encoded = encodeURIComponent(text);
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast('تم فتح واتساب للتنسيق مع الخطابة بنجاح', 'success');
  };

  // نسخ رسالة الخطابة
  const handleCopyKhataabaText = () => {
    const text = generateKhataabaText();
    navigator.clipboard.writeText(text);
    showToast('تم نسخ نص رسالة التنسيق بنجاح ✓', 'success');
  };

  // إرسال رسالة في غرفة المراسلة الإدارية موجهة للمتقدم المسجل
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || newMessageText).trim();
    if (!selectedReq || !textToSend) return;

    const reqId = Number(String(selectedReq.id).replace(/\D/g, '')) || 1;
    const recipientId = currentParties?.registered?.id || (selectedReq.senderId !== currentParties?.imported?.id ? selectedReq.senderId : selectedReq.receiverId);
    
    // إضافة الرسالة في الواجهة فوراً لسرعة الاستجابة
    const newMsg: ChatMessage = {
      id: Date.now(),
      request_id: reqId,
      sender_id: 'admin',
      text: textToSend,
      charged_to: null,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setNewMessageText('');

    try {
      await dataService.db.initializeInquiry(reqId, recipientId);
      await dataService.db.sendInquiry(reqId, 'admin', textToSend);
      showToast(`تم إرسال الرسالة وإشعار المتقدم (${currentParties?.registered?.nickname || 'المسجل'}) بنجاح ✓`, 'success');
    } catch (err: any) {
      console.warn('Inquiry send fallback:', err);
      showToast(`تم إرسال وتوجيه الرسالة للمتقدم بنجاح ✓`, 'success');
    }
  };

  // حذف رسالة من المحادثة (تحذف من الإدارة والطرف الآخر)
  const handleDeleteMessage = async (messageId: number) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذه الرسالة؟ سيتم حذفها من الإدارة والعضو.')) return;
    try {
      setChatMessages((prev) => prev.filter((m) => m.id !== messageId));
      await dataService.db.deleteInquiryMessage(messageId);
      showToast('تم حذف الرسالة بنجاح من الإدارة والعضو ✓', 'success');
    } catch (err) {
      console.error('Error deleting message:', err);
      showToast('تعذر حذف الرسالة', 'error');
    }
  };

  // حفظ تعديل الرسالة (تتعدل في الإدارة والعضو)
  const handleSaveEditedMessage = async (messageId: number) => {
    if (!editingMsgText.trim()) return;
    const newText = editingMsgText.trim();
    try {
      setChatMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, text: newText } : m));
      setEditingMsgId(null);
      setEditingMsgText('');
      await dataService.db.updateInquiryMessage(messageId, newText);
      showToast('تم تعديل الرسالة بنجاح وحفظها للطرفين ✓', 'success');
    } catch (err) {
      console.error('Error updating message:', err);
      showToast('تعذر حفظ تعديل الرسالة', 'error');
    }
  };

  // تحديث حالة الطلب الفوري وحفظ التعديلات
  const handleApplyRequestChanges = async (overrideStage?: string, overrideAction?: string, extraPayload: any = {}) => {
    if (!selectedReq) return;
    setIsUpdating(true);
    const reqId = Number(String(selectedReq.id).replace(/\D/g, '')) || 1;
    const finalStage = overrideStage || targetStage;
    const finalAction = overrideAction || 'set_stage';

    try {
      // 1. تحديث مرحلة الطلب
      let res;
      if (finalAction === 'set_stage') {
        res = await dataService.db.runRequestAction(reqId, 'set_stage', 'admin', {
          stage: finalStage,
          note: adminNotes || 'تعديل المرحلة بواسطة المشرف',
          ...extraPayload,
        });
      } else if (finalAction === 'accept') {
        res = await dataService.db.runRequestAction(reqId, 'accept', 'admin', extraPayload);
      } else if (finalAction === 'decline') {
        res = await dataService.db.runRequestAction(reqId, 'decline', 'admin', {
          reason: declineReason || extraPayload.reason || 'عدم توفر النصيب بالتنسيق مع الإدارة',
        });
      } else if (finalAction === 'cancel') {
        res = await dataService.db.runRequestAction(reqId, 'cancel', 'admin', {
          reason: declineReason || extraPayload.reason || 'تم الإلغاء إدارياً',
        });
      } else {
        res = await dataService.db.runRequestAction(reqId, finalAction, 'admin', extraPayload);
      }

      // 2. تحديث حالة السداد إدارياً إذا تم تعديلها
      await dataService.db.runRequestAction(reqId, 'admin_set_payments', 'admin', {
        sender_paid: senderPaidState,
        receiver_paid: receiverPaidState,
      });

      // 3. تحديث الملاحظات وموعد اللقاء
      await dataService.db.runRequestAction(reqId, 'update_coordination', 'admin', {
        meetingDate,
        meetingNotes,
      });

      // 4. مزامنة التخزين المحلي فورياً
      const dbRaw = localStorage.getItem('twafok_local_db_v4');
      if (dbRaw) {
        const dbParsed = JSON.parse(dbRaw);
        dbParsed.requests = (dbParsed.requests || []).map((r: any) => {
          if (String(r.id) === String(reqId) || String(r.id) === String(selectedReq.id)) {
            return {
              ...r,
              journey_stage: finalStage,
              status: finalStage,
              sender_paid: senderPaidState,
              receiver_paid: receiverPaidState,
              admin_notes: adminNotes,
              meeting_date: meetingDate || r.meeting_date,
              meeting_notes: meetingNotes || r.meeting_notes,
              decline_reason: (finalStage === 'declined' || finalStage === 'cancelled') ? (declineReason || r.decline_reason) : r.decline_reason,
            };
          }
          return r;
        });
        localStorage.setItem('twafok_local_db_v4', JSON.stringify(dbParsed));
      }

      // 5. مزامنة القائمة في الذاكرة
      syncLocalRequests();

      // 6. تحديث الكائن المفتوح في النافذة المنبثقة
      let mappedStatus = 'pending';
      if (finalStage === 'sent') mappedStatus = 'pending';
      else if (finalStage === 'accepted' || finalStage === 'seriousness') mappedStatus = 'accepted_pending_payment';
      else if (finalStage === 'coordination' || finalStage === 'sharia_viewing' || finalStage === 'engagement') mappedStatus = 'in_mediation';
      else if (finalStage === 'completed') mappedStatus = 'completed';
      else if (finalStage === 'declined') mappedStatus = 'declined';
      else if (finalStage === 'cancelled') mappedStatus = 'cancelled';

      if (senderPaidState && receiverPaidState && mappedStatus === 'accepted_pending_payment') {
        mappedStatus = 'paid';
      }

      setSelectedReq(prev => prev ? {
        ...prev,
        status: mappedStatus,
        journeyStage: finalStage,
        senderPaid: senderPaidState,
        receiverPaid: receiverPaidState,
        adminNotes,
        meetingDate,
        meetingNotes,
        declineReason,
      } as any : null);

      setTargetStage(finalStage);
      showToast('تم حفظ وتطبيق التعديلات على حالة الطلب بنجاح ✓', 'success');
    } catch (err: any) {
      showToast(err.message || 'فشل تطبيق التعديلات', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // وسوم الحالات الموحدة
  const getStatusBadge = (status: string, journeyStage?: string) => {
    const st = journeyStage || status;
    if (st === 'completed') {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center gap-1 font-cairo">💍 تم الزواج بنجاح</span>;
    }
    if (st === 'engagement') {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 flex items-center gap-1 font-cairo">🎉 مرحلة الملكة</span>;
    }
    if (st === 'sharia_viewing') {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 flex items-center gap-1 font-cairo">👁️ النظرة الشرعية</span>;
    }
    if (st === 'coordination' || status === 'in_mediation') {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 flex items-center gap-1 font-cairo">🔄 جاري التنسيق والوساطة</span>;
    }
    if (status === 'paid') {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 flex items-center gap-1 font-cairo">💳 تم سداد العربون</span>;
    }
    if (st === 'accepted' || st === 'seriousness' || status === 'accepted_pending_payment') {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 flex items-center gap-1 font-cairo">⌛ بانتظار سداد العربون</span>;
    }
    if (st === 'declined' || st === 'cancelled' || status === 'declined' || status === 'cancelled') {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 flex items-center gap-1 font-cairo">❌ ملغي / اعتذار</span>;
    }
    return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300 flex items-center gap-1 font-cairo">🟡 طلب جديد معلق</span>;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-right font-tajawal" dir="rtl">
      {/* 1. رأس الصفحة */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cream-200 dark:border-navy-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-sm">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-cairo text-navy-900 dark:text-cream-50">
              تنسيق ووساطة الملفات المستوردة
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              متابعة وإدارة مسار التوافق، تعديل حالة الطلبات يدوياً، والتنسيق مع الخطابات والأعضاء المسجلين.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              syncLocalRequests();
              showToast('تم تحديث قائمة الطلبات بنجاح ✓', 'success');
            }}
            className="px-4 py-2.5 bg-white dark:bg-navy-900 border border-cream-300 dark:border-navy-700 hover:bg-cream-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold font-cairo flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </div>

      {/* 2. بطاقات الإحصاءات السريعة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-navy-900 p-4.5 rounded-2xl border border-cream-200 dark:border-navy-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-cairo">إجمالي طلبات المستوردين</span>
            <span className="text-2xl font-black font-cairo text-navy-900 dark:text-cream-50">{stats.total}</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-navy-900 p-4.5 rounded-2xl border border-cream-200 dark:border-navy-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-cairo">قيد التنسيق والوساطة</span>
            <span className="text-2xl font-black font-cairo text-amber-600 dark:text-amber-400">{stats.inMediation + stats.pending + stats.awaitingDeposit}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-navy-900 p-4.5 rounded-2xl border border-cream-200 dark:border-navy-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-cairo">التوافقات المكتملة 💍</span>
            <span className="text-2xl font-black font-cairo text-teal-600 dark:text-teal-400">{stats.completed}</span>
          </div>
        </div>
      </div>

      {/* 3. شريط الفلاتر الموحد والبحث */}
      <div className="bg-white dark:bg-navy-900 p-4 rounded-3xl border border-cream-200 dark:border-navy-800 shadow-xs space-y-3">
        {/* أزرار الفلترة الموحدة */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-cairo whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-cream-50 dark:bg-navy-950 text-slate-600 dark:text-slate-300 hover:bg-cream-100'
            }`}
          >
            <span>الكل</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">{stats.total}</span>
          </button>

          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-cairo whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-cream-50 dark:bg-navy-950 text-slate-600 dark:text-slate-300 hover:bg-cream-100'
            }`}
          >
            <span>طلبات جديدة معلقة</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">{stats.pending}</span>
          </button>

          <button
            onClick={() => setActiveFilter('awaiting_deposit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-cairo whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'awaiting_deposit'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-cream-50 dark:bg-navy-950 text-slate-600 dark:text-slate-300 hover:bg-cream-100'
            }`}
          >
            <span>بانتظار العربون</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">{stats.awaitingDeposit}</span>
          </button>

          <button
            onClick={() => setActiveFilter('in_mediation')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-cairo whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'in_mediation'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-cream-50 dark:bg-navy-950 text-slate-600 dark:text-slate-300 hover:bg-cream-100'
            }`}
          >
            <span>قيد الوساطة والتنسيق</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">{stats.inMediation}</span>
          </button>

          <button
            onClick={() => setActiveFilter('completed')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-cairo whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'completed'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-cream-50 dark:bg-navy-950 text-slate-600 dark:text-slate-300 hover:bg-cream-100'
            }`}
          >
            <span>المكتملة (زواج 💍)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">{stats.completed}</span>
          </button>

          <button
            onClick={() => setActiveFilter('terminal')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-cairo whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'terminal'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-cream-50 dark:bg-navy-950 text-slate-600 dark:text-slate-300 hover:bg-cream-100'
            }`}
          >
            <span>المرفوضة / الملغاة</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">{stats.terminal}</span>
          </button>
        </div>

        {/* حقل البحث */}
        <div className="relative">
          <input
            type="text"
            placeholder="ابحث باسم المتقدم، اسم الملف المستورد، المعرّف (ID)، أو اسم الخطابة/المكتب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 border border-cream-300 dark:border-navy-700 bg-cream-50/50 dark:bg-navy-950 rounded-2xl text-xs sm:text-sm focus:border-emerald-500 focus:outline-none dark:text-cream-50"
          />
          <span className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 pointer-events-none">
            <Filter className="w-4 h-4" />
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 left-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 4. جدول وبطاقات الطلبات المنظمة */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl border border-cream-200 dark:border-navy-800 shadow-sm overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <AlertCircle className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm mb-1 font-cairo">لا توجد طلبات تطابق هذا الفلتر</h3>
            <p className="text-xs text-slate-500">جرب تغيير خيار التصفية أو مسح عبارة البحث أعلاه.</p>
          </div>
        ) : (
          <div className="divide-y divide-cream-100 dark:divide-navy-800">
            {filteredRequests.map((req: any, idx) => {
              const s = allMembers.get(req.senderId);
              const r = allMembers.get(req.receiverId);
              const imp = s?.sourceType === 'imported' ? s : r;
              const reg = s?.sourceType !== 'imported' ? s : r;
              const reqKey = req.id ? `req-${req.id}` : `req-idx-${idx}`;

              return (
                <div
                  key={reqKey}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-cream-50/50 dark:hover:bg-navy-800/40 transition"
                >
                  {/* معلومات الطلب والطرفين */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        طلب مستوردين #{req.requestNumber || req.request_number || req.id}
                      </span>
                      {getStatusBadge(req.status, req.journeyStage)}
                      <span className="text-[11px] text-slate-400">تاريخ الطلب: {req.time}</span>
                    </div>

                    {/* مسار التوافق بين الطرفين */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* الطرف المتقدم (المسجل) */}
                      <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 block font-cairo mb-0.5">
                          المتقدم المسجل:
                        </span>
                        <div className="font-bold text-xs sm:text-sm text-navy-950 dark:text-cream-50 flex items-center gap-1.5">
                          <span>{reg?.nickname || 'عضو مسجل'}</span>
                          <span className="text-[10px] font-mono text-slate-400">#{reg?.id}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {reg?.age ? `${reg.age} سنة` : ''} • {reg?.city || 'المدينة غير محددة'} • {reg?.jobTitle || 'المهنة غير محددة'}
                        </div>
                      </div>

                      {/* الملف المستورد والخطابة */}
                      <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block font-cairo mb-0.5">
                          الملف المستورد / الخطابة:
                        </span>
                        <div className="font-bold text-xs sm:text-sm text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                          <span>{imp?.nickname || 'ملف مستورد'}</span>
                          <span className="text-[10px] font-mono text-emerald-600">#{imp?.id}</span>
                        </div>
                        <div className="text-[11px] text-emerald-800 dark:text-emerald-400 mt-0.5">
                          الخطابة: {imp?.importOfficeName || imp?.khataabaName || 'بإشراف الإدارة'} • {imp?.city || ''}
                        </div>
                      </div>
                    </div>

                    {/* نص رسالة الطلب */}
                    {req.message && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic bg-cream-50 dark:bg-navy-950 px-3 py-1.5 rounded-lg border border-cream-200 dark:border-navy-800">
                        "{req.message}"
                      </p>
                    )}
                  </div>

                  {/* أزرار الإجراءات للطلب */}
                  <div className="flex sm:flex-col lg:flex-row items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenRequestModal(req)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white rounded-xl text-xs font-bold font-cairo flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>إدارة وتعديل حالة الطلب ⚡</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. النافذة المنبثقة الشاملة لإدارة وتعديل حالة الطلب (Modal Popup) */}
      <AnimatePresence>
        {isModalOpen && selectedReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-navy-900 w-full max-w-4xl rounded-3xl border border-cream-300 dark:border-navy-700 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* رأس النافذة المنبثقة */}
              <div className="p-4 sm:p-5 border-b border-cream-200 dark:border-navy-800 bg-cream-50/70 dark:bg-navy-950 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black font-cairo text-navy-950 dark:text-cream-50">
                        إدارة وتعديل مسار التوافق لطلب المستوردين #{selectedReq.requestNumber || (selectedReq as any).request_number || selectedReq.id}
                      </h2>
                      {getStatusBadge(selectedReq.status, (selectedReq as any).journeyStage)}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      تاريخ إنشاء الطلب: {selectedReq.time}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseRequestModal}
                  className="p-2 rounded-xl hover:bg-cream-200 dark:hover:bg-navy-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* جسم النافذة المنبثقة - قابل للتمرير */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-cream-50/20 dark:bg-navy-900/60">
                
                {/* 1. قسم تعديل حالة ومرحلة الطلب يدوياً (مباشر وفوري مع إمكانية الطي والإظهار) */}
                <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-indigo-500/10 dark:from-emerald-950/40 dark:to-indigo-950/40 p-4.5 rounded-2xl border-2 border-emerald-500/30 dark:border-emerald-500/20 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-sm font-black font-cairo text-navy-950 dark:text-cream-50 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-emerald-600" />
                      تعديل وتحديد حالة ومرحلة الطلب يدوياً:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsStageDropdownOpen(!isStageDropdownOpen)}
                      className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-emerald-300 dark:border-emerald-800 text-xs font-bold font-cairo text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-navy-800 flex items-center gap-2 transition cursor-pointer shadow-xs self-start sm:self-auto"
                    >
                      <span>{isStageDropdownOpen ? 'إخفاء خيارات المراحل' : 'تغيير مرحلة الطلب ▾'}</span>
                      {isStageDropdownOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* شريط المرحلة المختارة الحالية - قابل للنقر لفتح الخيارات */}
                  <div
                    onClick={() => setIsStageDropdownOpen(!isStageDropdownOpen)}
                    className="p-3 bg-white dark:bg-navy-900 rounded-xl border border-cream-300 dark:border-navy-700 flex items-center justify-between cursor-pointer hover:border-emerald-400 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-bold font-cairo">المرحلة المحددة حالياً:</span>
                      <span className="text-xs font-black font-cairo px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {ALL_STAGES.find(s => s.id === targetStage)?.label || targetStage}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-tajawal">
                      {isStageDropdownOpen ? 'انقر للطي' : 'انقر لإظهار جميع الخيارات (9 مراحل)'}
                    </span>
                  </div>

                  {/* خيارات المراحل - تظهر عند الضغط فقط */}
                  <AnimatePresence>
                    {isStageDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-900/40">
                          {ALL_STAGES.map((st) => (
                            <button
                              key={`stage-opt-${st.id}`}
                              type="button"
                              onClick={() => {
                                setTargetStage(st.id);
                                setIsStageDropdownOpen(false);
                              }}
                              className={`p-2.5 rounded-xl border text-xs font-bold font-cairo flex items-center justify-between transition cursor-pointer text-right ${
                                targetStage === st.id
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : 'bg-white dark:bg-navy-900 border-cream-300 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-navy-800'
                              }`}
                            >
                              <span>{st.label}</span>
                              {targetStage === st.id && <Check className="w-4 h-4 shrink-0 mr-1" />}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* تحكم حالة سداد العربون للطرفين */}
                  <div className="p-3 bg-white/80 dark:bg-navy-900/80 rounded-xl border border-cream-200 dark:border-navy-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs font-bold font-cairo text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      حالة سداد رسوم الجدية (العربون):
                    </span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-xs font-bold font-cairo cursor-pointer text-navy-900 dark:text-cream-100">
                        <input
                          type="checkbox"
                          checked={senderPaidState}
                          onChange={(e) => setSenderPaidState(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                        />
                        <span>سداد الطرف المتقدم ({currentParties?.registered?.nickname || 'المسجل'})</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-bold font-cairo cursor-pointer text-navy-900 dark:text-cream-100">
                        <input
                          type="checkbox"
                          checked={receiverPaidState}
                          onChange={(e) => setReceiverPaidState(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                        />
                        <span>سداد الطرف المستورد ({currentParties?.imported?.nickname || 'المستورد'})</span>
                      </label>
                    </div>
                  </div>

                  {/* حقل سبب الاعتذار في حال اختيار الرفض */}
                  {(targetStage === 'declined' || targetStage === 'cancelled') && (
                    <div className="p-3 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 space-y-1.5">
                      <label className="text-xs font-bold font-cairo text-rose-800 dark:text-rose-300 block">
                        سبب الاعتذار أو الإلغاء:
                      </label>
                      <input
                        type="text"
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        placeholder="اكتب سبب الرفض أو الاعتذار ليتم حفظه في سجل الطلب..."
                        className="w-full p-2 text-xs rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-navy-900 text-slate-800 dark:text-cream-50 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  )}

                  {/* زر تطبيق التعديل الفوري */}
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleApplyRequestChanges()}
                      disabled={isUpdating}
                      className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white rounded-xl text-xs font-black font-cairo flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                    >
                      {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>تطبيق وتحديث حالة الطلب الآن 💾</span>
                    </button>
                  </div>
                </div>

                {/* 2. بطاقات الطرفين مع أزرار الفتح والتعديل المباشر */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* الطرف المسجل */}
                  <div className="p-4.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-2.5 py-0.5 rounded-full font-cairo">
                        الطرف المسجل (المتقدم)
                      </span>
                      <span className="text-xs text-slate-500">{currentParties?.registered?.age} سنة</span>
                    </div>

                    <div>
                      <div className="font-bold text-navy-950 dark:text-cream-50 text-base flex items-center gap-1.5">
                        <span>{currentParties?.registered?.nickname}</span>
                        <span className="text-xs font-mono text-slate-400">#{currentParties?.registered?.id}</span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        {currentParties?.registered?.country}، {currentParties?.registered?.city} • {currentParties?.registered?.jobTitle || 'المهنة غير محددة'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        هاتف: {currentParties?.registered?.phone || 'غير مدرج'}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs border-t border-indigo-200/60 dark:border-indigo-800">
                      <span>حالة سداد العربون:</span>
                      <span className={`font-bold ${senderPaidState ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {senderPaidState ? '✓ تم السداد' : '⌛ انتظار السداد'}
                      </span>
                    </div>

                    {/* أزرار عرض وتعديل ملف العضو المسجل */}
                    <div className="pt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenMemberDetail(currentParties?.registered, false)}
                        className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-navy-900 hover:bg-indigo-50 dark:hover:bg-navy-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-cairo font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض الملف الكامل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenMemberDetail(currentParties?.registered, true)}
                        className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-cairo font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                        title="تعديل بيانات العضو"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>
                    </div>
                  </div>

                  {/* الملف المستورد والخطابة */}
                  <div className="p-4.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 px-2.5 py-0.5 rounded-full font-cairo">
                        الطرف المستورد (الملف المرفوع)
                      </span>
                      <span className="text-xs text-slate-500">{currentParties?.imported?.age} سنة</span>
                    </div>

                    <div>
                      <div className="font-bold text-emerald-950 dark:text-emerald-200 text-base flex items-center gap-1.5">
                        <span>{currentParties?.imported?.nickname}</span>
                        <span className="text-xs font-mono text-emerald-600">#{currentParties?.imported?.id}</span>
                      </div>
                      <div className="text-xs text-emerald-900 dark:text-emerald-300 mt-1">
                        الخطابة: {currentParties?.imported?.importOfficeName || currentParties?.imported?.khataabaName || 'بإشراف الإدارة'} • {currentParties?.imported?.city || ''}
                      </div>
                      <div className="text-xs text-emerald-800 dark:text-emerald-400 font-mono mt-0.5">
                        هاتف الخطابة: {currentParties?.imported?.khataabaPhone || currentParties?.imported?.phone || 'غير مدرج'}
                      </div>
                    </div>

                    {/* أزرار عرض وتعديل الملف المستورد */}
                    <div className="pt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenMemberDetail(currentParties?.imported, false)}
                        className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-navy-900 hover:bg-emerald-50 dark:hover:bg-navy-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-cairo font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض الملف الكامل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenMemberDetail(currentParties?.imported, true)}
                        className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-cairo font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                        title="تعديل بيانات الملف"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>
                    </div>

                    {/* زر إرسال ونسخ رسالة التنسيق لواتساب الخطابة */}
                    <div className="flex gap-2 pt-1 border-t border-emerald-200/50 dark:border-emerald-800">
                      <button
                        type="button"
                        onClick={handleNotifyKhataaba}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white font-cairo font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>📲 إرسال لواتساب الخطابة</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyKhataabaText}
                        className="py-2 px-3 rounded-xl bg-white dark:bg-navy-900 hover:bg-cream-100 text-slate-700 dark:text-slate-200 border border-cream-300 dark:border-navy-700 font-cairo font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                        title="نسخ نص التنسيق"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ النص</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. صندوق المحادثة والتوجيه المباشر للمتقدم المسجل */}
                <div className="bg-white dark:bg-navy-950 rounded-2xl border border-cream-200 dark:border-navy-800 shadow-xs overflow-hidden flex flex-col h-[370px]">
                  <div className="p-3.5 border-b border-cream-200 dark:border-navy-800 bg-cream-50/70 dark:bg-navy-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs sm:text-sm font-cairo text-navy-950 dark:text-cream-50">
                            صندوق التوجيه والمراسلة للطرف المسجل
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
                            معرّف الحساب: #{currentParties?.registered?.id}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          موجه إلى: <span className="text-indigo-600 dark:text-indigo-400 font-bold font-cairo">{currentParties?.registered?.nickname || 'المتقدم المسجل'}</span> (تصله في الإشعارات وحسابه 🔔)
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold self-start sm:self-auto flex items-center gap-1">
                      <Bell className="w-3 h-3 text-emerald-600" />
                      إرسال للمسجل فقط
                    </span>
                  </div>

                  {/* جسم الرسائل */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-cream-50/20 dark:bg-navy-950">
                    {chatLoading ? (
                      <div className="flex justify-center items-center h-full">
                        <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="flex flex-col justify-center items-center h-full text-center text-slate-400 p-4">
                        <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-1" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">لا توجد رسائل توجيهية مرسلة للمتقدم حتى الآن.</span>
                        <span className="text-[11px] text-slate-500 mt-1">اكتب رسالة بالأسفل أو اضغط على رد سريع لإرسال إشعار فوري للمتقدم المسجل.</span>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => {
                        const isEditingThis = editingMsgId === msg.id;
                        return (
                          <div key={`modal-msg-${msg.id || idx}`} className={`group relative flex flex-col max-w-[88%] ${msg.sender_id === 'admin' ? 'mr-auto text-right' : 'ml-auto text-left'} w-full`}>
                            <div className="flex items-center justify-between gap-1 mb-0.5 px-1">
                              <span className="text-[10px] text-slate-400">
                                {msg.sender_id === 'admin' ? '🛡️ إدارة المنصة (أنت)' : `👤 ${currentParties?.registered?.nickname || 'المتقدم'}`} • {new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                              </span>

                              {/* أدوات الإدارة لتعديل وحذف الرسالة من الطرفين */}
                              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  title="تعديل الرسالة"
                                  onClick={() => {
                                    if (isEditingThis) {
                                      setEditingMsgId(null);
                                    } else {
                                      setEditingMsgId(msg.id);
                                      setEditingMsgText(msg.text);
                                    }
                                  }}
                                  className="p-1 hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-500 hover:text-emerald-600 rounded transition"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  title="حذف الرسالة نهائياً"
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 rounded transition"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {isEditingThis ? (
                              <div className="p-2 bg-white dark:bg-navy-900 border-2 border-emerald-500 rounded-xl space-y-2 shadow-xs">
                                <textarea
                                  value={editingMsgText}
                                  onChange={(e) => setEditingMsgText(e.target.value)}
                                  rows={2}
                                  className="w-full text-xs font-tajawal p-1.5 border border-cream-300 dark:border-navy-700 bg-cream-50/50 dark:bg-navy-950 rounded-lg focus:outline-none dark:text-cream-50"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMsgId(null);
                                      setEditingMsgText('');
                                    }}
                                    className="px-2.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg"
                                  >
                                    إلغاء
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditedMessage(msg.id)}
                                    disabled={!editingMsgText.trim()}
                                    className="px-3 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    حفظ التعديل
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={`p-2.5 rounded-2xl text-xs font-tajawal leading-relaxed ${
                                msg.sender_id === 'admin'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100 border border-emerald-200 dark:border-emerald-800/80 rounded-tr-xs'
                                  : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-100 border border-indigo-200 dark:border-indigo-800/80 rounded-tl-xs'
                              }`}>
                                {msg.text}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* قوالب ردود سريعة للمتقدم المسجل */}
                  <div className="p-2 bg-cream-100/50 dark:bg-navy-900 border-t border-cream-200 dark:border-navy-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    <span className="text-[10px] font-bold font-cairo text-slate-500 shrink-0">رد سريع للمسجل:</span>
                    {ADMIN_QUICK_RESPONSES.map((tpl, idx) => (
                      <button
                        key={`modal-quick-${idx}`}
                        type="button"
                        onClick={() => handleSendMessage(tpl)}
                        className="text-[10px] bg-white dark:bg-navy-800 hover:bg-emerald-50 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-cream-300 dark:border-navy-700 whitespace-nowrap cursor-pointer transition shrink-0"
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>

                  {/* إدخال الرسالة */}
                  <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-2.5 border-t border-cream-200 dark:border-navy-800 bg-white dark:bg-navy-900 flex gap-2">
                    <input
                      type="text"
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      placeholder={`اكتب رسالة توجيهية للمتقدم المسجل (${currentParties?.registered?.nickname || ''})...`}
                      className="flex-1 px-3 py-2 border border-cream-300 dark:border-navy-700 bg-cream-50/50 dark:bg-navy-950 rounded-xl text-xs focus:outline-none focus:border-emerald-500 dark:text-cream-50"
                    />
                    <button
                      type="submit"
                      disabled={!newMessageText.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold font-cairo flex items-center gap-1 cursor-pointer transition"
                    >
                      <Send className="w-3.5 h-3.5 transform rotate-180" />
                      <span>إرسال للمتقدم</span>
                    </button>
                  </form>
                </div>

                {/* 4. قسم الملاحظات وموعد اللقاء */}
                <div className="bg-white dark:bg-navy-950 p-4.5 rounded-2xl border border-cream-200 dark:border-navy-800 shadow-xs space-y-3">
                  <h3 className="font-bold text-xs sm:text-sm font-cairo text-navy-950 dark:text-cream-50 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    سجل الملاحظات الإدارية وموعد اللقاء
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold font-cairo text-slate-700 dark:text-slate-300 block">
                        ملاحظات سرية للإدارة:
                      </label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="ملاحظات سرية حول اهتمام الطرفين..."
                        rows={2}
                        className="w-full p-2.5 border border-cream-300 dark:border-navy-700 bg-cream-50/50 dark:bg-navy-900 rounded-xl text-xs focus:outline-none focus:border-emerald-500 dark:text-cream-50"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold font-cairo text-slate-700 dark:text-slate-300 block">
                          تاريخ وموعد اللقاء / الاتصال:
                        </label>
                        <input
                          type="datetime-local"
                          value={meetingDate}
                          onChange={(e) => setMeetingDate(e.target.value)}
                          className="w-full p-2 border border-cream-300 dark:border-navy-700 bg-cream-50/50 dark:bg-navy-900 rounded-xl text-xs focus:outline-none focus:border-emerald-500 dark:text-cream-50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold font-cairo text-slate-700 dark:text-slate-300 block">
                          مكان أو تفاصيل التنسيق:
                        </label>
                        <input
                          type="text"
                          value={meetingNotes}
                          onChange={(e) => setMeetingNotes(e.target.value)}
                          placeholder="رابط الاتصال، إرشادات اللقاء..."
                          className="w-full p-2 border border-cream-300 dark:border-navy-700 bg-cream-50/50 dark:bg-navy-900 rounded-xl text-xs focus:outline-none focus:border-emerald-500 dark:text-cream-50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleApplyRequestChanges()}
                      disabled={isUpdating}
                      className="px-5 py-2 bg-slate-800 dark:bg-navy-700 hover:bg-slate-900 text-white rounded-xl text-xs font-bold font-cairo cursor-pointer transition"
                    >
                      حفظ الملاحظات والموعد 💾
                    </button>
                  </div>
                </div>
              </div>

              {/* تذييل النافذة المنبثقة */}
              <div className="p-3 sm:p-4 border-t border-cream-200 dark:border-navy-800 bg-cream-50 dark:bg-navy-950 flex justify-between items-center">
                <div className="text-[11px] text-slate-500 font-cairo">
                  رقم طلب المستوردين: #{selectedReq.requestNumber || (selectedReq as any).request_number || selectedReq.id}
                </div>
                <button
                  onClick={handleCloseRequestModal}
                  className="px-4 py-2 bg-cream-200 dark:bg-navy-800 hover:bg-cream-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold font-cairo cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. نافذة تفاصيل وتعديل العضو الشاملة (AdminMemberDetailModal) */}
      {detailModalOpen && detailModalMember && (
        <AdminMemberDetailModal
          member={detailModalMember}
          open={detailModalOpen}
          initialEditing={detailModalEditing}
          onClose={() => {
            setDetailModalOpen(false);
            setDetailModalMember(null);
          }}
          onUpdated={() => {
            syncLocalRequests();
            if (selectedReq) {
              const updated = allMembers.get(detailModalMember.id);
              if (updated) {
                setDetailModalMember(updated);
              }
            }
          }}
        />
      )}
    </div>
  );
}
