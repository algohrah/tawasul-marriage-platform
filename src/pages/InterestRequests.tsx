import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Send, Inbox, Archive, Search, X, Loader2, AlertCircle,
  ShieldCheck, CalendarClock, MapPin, BadgeCheck, ChevronLeft, Info, Sparkles, Ban,
  Zap, CreditCard, UserCheck, Compass, Mail, Clock, CheckSquare, Square, Trash2, CheckCircle2, ListChecks,
} from 'lucide-react';
import { getAvatar, getGenderColors } from '../lib/types';
import {
  useInterestRequests, fetchRequestEvents, getCurrentUserId,
  isRequestUnseen,
  type ApiRequest, type RequestEvent,
} from '../lib/useInterestRequests';
import { useApp } from '../lib/AppContext';
import { dataService } from '../lib/data/DataService';
import {
  STAGE_META, ACCENT_CLASSES, getPrimaryAction, isTerminal,
  requiresMyAction, actionUrgency,
  getJourneyStage, getJourneyStatusSummary,
  DECLINE_REASONS, CANCEL_REASONS, DEPOSIT_AMOUNT, type JourneyState, type RequestRole,
} from '../lib/journey';
import { JourneyTimeline } from '../components/JourneyTimeline';
import AcceptedCelebrationModal from '../components/AcceptedCelebrationModal';
import Modal from '../components/ui/Modal';
import RequestStatusPanel from '../components/requests/RequestStatusPanel';

// ============================================================
//  صفحة طلبات الاهتمام — مسار واحد واضح، بيانات حقيقية
// ============================================================

type Tab = 'active' | 'incoming' | 'archive';

function stageOf(r: ApiRequest, userId: string): JourneyState {
  return getJourneyStage(r, userId);
}

export default function InterestRequests() {
  const { user } = useApp();
  const activeId = user?.memberId || getCurrentUserId();
  const {
    requests, loading, error, actionLoading,
    getMember, runAction, refresh,
  } = useInterestRequests(activeId);

  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  // فلترة فرعية داخل تبويب النشطة: الكل / أرسلتها / وردتني
  const [subFilter, setSubFilter] = useState<'all' | 'sent' | 'received'>('all');

  // تحديث الطلبات تلقائياً عند العودة للصفحة (مثلاً بعد إرسال طلب من صفحة العضو)
  useEffect(() => { refresh(); }, [refresh]);

  // المودالات
  const [acceptModal, setAcceptModal] = useState<{ req: ApiRequest; name: string } | null>(null);
  const [declineModal, setDeclineModal] = useState<ApiRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineCustom, setDeclineCustom] = useState('');
  const [payModal, setPayModal] = useState<ApiRequest | null>(null);
  const [pledge, setPledge] = useState(false);
  const [resultModal, setResultModal] = useState<ApiRequest | null>(null);
  const [resultChoice, setResultChoice] = useState<'success' | 'failed'>('success');
  const [resultNote, setResultNote] = useState('');
  const [coordModal, setCoordModal] = useState<ApiRequest | null>(null);
  // إلغاء الطلب (متاح في أي مرحلة) مع ذكر السبب
  const [cancelModal, setCancelModal] = useState<ApiRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelCustom, setCancelCustom] = useState('');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // حالة التحديد المتعدد (Multi-selection)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmBulkCancel, setConfirmBulkCancel] = useState(false);
  const [bulkCancelReason, setBulkCancelReason] = useState('');

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3200);
  };

  // تصنيف الطلبات
  const buckets = useMemo(() => {
    const active: ApiRequest[] = [];
    const incoming: ApiRequest[] = [];
    const archive: ApiRequest[] = [];
    for (const r of requests) {
      const stage = stageOf(r, activeId);
      if (isTerminal(stage)) { archive.push(r); continue; }
      if (stage === 'completed') { archive.push(r); continue; }
      // وارد = طلب مُرسل لي بانتظار ردي
      if (stage === 'sent' && r.receiver_id === activeId) { incoming.push(r); continue; }
      active.push(r);
    }
    return { active, incoming, archive };
  }, [requests, activeId]);

  // هل يتطلّب الطلب إجراءً مني الآن؟
  const needsAction = (r: ApiRequest): boolean => {
    const stage = stageOf(r, activeId);
    const isSender = r.sender_id === activeId;
    const role: RequestRole = isSender ? 'sender' : 'receiver';
    const selfPaid = isSender ? r.sender_paid : r.receiver_paid;
    const otherPaid = isSender ? r.receiver_paid : r.sender_paid;
    return requiresMyAction(stage, role, { selfPaid, otherPaid });
  };

  const list = useMemo(() => {
    let arr = tab === 'active' ? buckets.active : tab === 'incoming' ? buckets.incoming : buckets.archive;
    // الفلترة الفرعية (تبويب النشطة فقط)
    if (tab === 'active' && subFilter !== 'all') {
      arr = arr.filter((r) => subFilter === 'sent' ? r.sender_id === activeId : r.receiver_id === activeId);
    }
    if (query.trim()) {
      const q = query.trim();
      arr = arr.filter((r) => {
        const other = r.sender_id === activeId ? r.receiver_id : r.sender_id;
        const m = getMember(other);
        return m?.nickname.includes(q) || m?.city.includes(q);
      });
    }
    // ترتيب: ما يتطلّب إجراءً أولاً، ثم الأحدث تحديثاً
    return [...arr].sort((a, b) => {
      const aAct = needsAction(a) ? 1 : 0;
      const bAct = needsAction(b) ? 1 : 0;
      if (aAct !== bAct) return bAct - aAct;
      const at = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bt - at;
    });
  }, [tab, buckets, query, subFilter, getMember, activeId]);

  // ===== لوحة الإحصائيات: عدّ ما يحتاج إجراءً ====
  const stats = useMemo(() => {
    let respond = 0, pay = 0, active = 0;
    for (const r of requests) {
      const stage = stageOf(r);
      if (isTerminal(stage) || stage === 'completed') continue;
      const isSender = r.sender_id === activeId;
      const role: RequestRole = isSender ? 'sender' : 'receiver';
      const selfPaid = isSender ? r.sender_paid : r.receiver_paid;
      const otherPaid = isSender ? r.receiver_paid : r.sender_paid;
      const urgency = actionUrgency(stage, role, { selfPaid, otherPaid });
      if (urgency === 'respond') respond++;
      else if (urgency === 'pay') pay++;
      active++;
    }
    return { respond, pay, active };
  }, [requests, activeId]);

  // ===== الإجراءات =====
  const onAccept = async (req: ApiRequest) => {
    const res = await runAction(req.id, 'accept');
    if (res.ok) {
      const name = getMember(req.sender_id)?.nickname || 'الطرف الآخر';
      setAcceptModal({ req: { ...req, journey_stage: 'accepted' }, name });
    } else showToast(res.error || 'تعذّر القبول', 'error');
  };

  const onDecline = async () => {
    if (!declineModal) return;
    const reason = declineReason === DECLINE_REASONS[DECLINE_REASONS.length - 1] ? declineCustom : declineReason;
    if (!reason.trim()) { showToast('يرجى اختيار سبب الاعتذار', 'error'); return; }
    const res = await runAction(declineModal.id, 'decline', { reason });
    setDeclineModal(null); setDeclineReason(''); setDeclineCustom('');
    showToast(res.ok ? 'تم الاعتذار عن الطلب بلطف' : (res.error || 'خطأ'), res.ok ? 'info' : 'error');
  };

  const onPay = async () => {
    if (!payModal || !pledge) { showToast('يرجى الموافقة على عهد الجدية', 'error'); return; }
    const res = await runAction(payModal.id, 'pay_deposit');
    setPayModal(null); setPledge(false);
    showToast(res.ok ? '✅ تم سداد رسوم الجدية بنجاح' : (res.error || 'خطأ'), res.ok ? 'success' : 'error');
  };

  const onRecordResult = async () => {
    if (!resultModal) return;
    const res = await runAction(resultModal.id, 'record_result', { result: resultChoice, note: resultNote });
    setResultModal(null); setResultNote('');
    showToast(res.ok ? 'تم تسجيل نتيجة التوافق' : (res.error || 'خطأ'), res.ok ? 'success' : 'error');
  };

  const onAdvanceIntro = async (req: ApiRequest) => {
    const res = await runAction(req.id, 'advance_viewing');
    setCoordModal(null);
    showToast(res.ok ? 'تم الانتقال للنظرة الشرعية' : (res.error || 'خطأ'), res.ok ? 'success' : 'error');
  };

  const onCancel = async () => {
    if (!cancelModal) return;
    const reason = cancelReason === CANCEL_REASONS[CANCEL_REASONS.length - 1] ? cancelCustom : cancelReason;
    if (!reason.trim()) { showToast('يرجى اختيار سبب الإلغاء', 'error'); return; }
    const res = await runAction(cancelModal.id, 'cancel', { reason });
    setCancelModal(null); setCancelReason(''); setCancelCustom('');
    showToast(res.ok ? 'تم إلغاء الطلب' : (res.error || 'خطأ'), res.ok ? 'info' : 'error');
  };

  // ===== إجراءات التحديد المتعدد =====
  const toggleSelectAll = () => {
    const currentTabIds = list.map((r) => r.id);
    const allSelected = currentTabIds.length > 0 && currentTabIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentTabIds.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedIds, ...currentTabIds]));
      setSelectedIds(combined);
    }
  };

  const toggleSelectReq = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      await dataService.db.adminDeleteRequest(id);
    }
    const count = selectedIds.length;
    setSelectedIds([]);
    setConfirmBulkDelete(false);
    showToast(`تم حذف ${count} من طلبات الرحلات المحددة بنجاح ✅`);
    refresh();
  };

  const handleBulkCancel = async () => {
    if (selectedIds.length === 0) return;
    const reason = bulkCancelReason.trim() || 'إلغاء جماعي من رحلات التوافق';
    for (const id of selectedIds) {
      await runAction(id, 'cancel', { reason });
    }
    const count = selectedIds.length;
    setSelectedIds([]);
    setConfirmBulkCancel(false);
    setBulkCancelReason('');
    showToast(`تم إلغاء ${count} من الرحلات المحددة بنجاح`, 'info');
    refresh();
  };

  const handleBulkMarkSeen = () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      dataService.db.markRequestSeen(id);
    }
    showToast(`تم تعليم ${selectedIds.length} من الرحلات كـ "تمت مشاهدتها" ✓`);
    refresh();
  };

  const tabs: { key: Tab; label: string; icon: typeof Send; count: number }[] = [
    { key: 'active', label: 'الجارية', icon: Heart, count: buckets.active.length },
    { key: 'incoming', label: 'طلبات واردة', icon: Inbox, count: buckets.incoming.length },
    { key: 'archive', label: 'المنتهية', icon: Archive, count: buckets.archive.length },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F5] dark:bg-navy-950 text-navy-950 font-sans selection:bg-amber-100 selection:text-amber-900" dir="rtl">
      {/* ===== رأس الصفحة الفاخر بتصميم منحني وأشكال زخرفية ===== */}
      <div className="relative bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white overflow-hidden pb-12 pt-8 border-b border-amber-500/10 shadow-lg">
        {/* تأثيرات شبكية هندسية وإضاءة خلفية خافتة */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-3xl mx-auto px-4 relative z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-[0_4px_20px_rgba(245,158,11,0.3)] border border-amber-300/30">
                <Heart className="w-7 h-7 text-navy-900 stroke-[2.2]" />
              </div>
              <div>
                <span className="text-amber-400 text-xs font-semibold tracking-wider font-cairo block mb-1">منصة توافق الوطنية</span>
                <h1 className="font-cairo font-extrabold text-2xl sm:text-3xl text-white tracking-tight drop-shadow-sm">طلبات التوافق للزواج</h1>
                <p className="text-slate-300 text-xs sm:text-sm font-cairo mt-1">
                  {(() => {
                    const me = getMember(activeId);
                    return me
                      ? <>مرحباً بك، <span className="text-amber-400 font-bold">{me.nickname}</span> · تابع خطوات رحلتك الجادة بدقة وسرية تامة</>
                      : 'تابع جميع رحلات التوافق للزواج من الطلب حتى الزواج';
                  })()}
                </p>
              </div>
            </div>
            
            {/* مؤشر الأمان والموثوقية */}
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-1.5 backdrop-blur-sm">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span className="text-[11px] font-cairo font-bold text-slate-200">وساطة آمنة وموثقة</span>
            </div>
          </div>

          {/* ===== لوحة الإحصائيات التفاعلية الراقية (Glassmorphism Stats Bar) ===== */}
          {!loading && (
            <div className="grid grid-cols-3 gap-2.5 mt-8">
              <StatChip
                active={stats.respond > 0}
                value={stats.respond} label="تحتاج ردّك الفوري"
                icon={UserCheck} tone="gold"
                onClick={() => { setTab('active'); setSubFilter('all'); }}
              />
              <StatChip
                active={stats.pay > 0}
                value={stats.pay} label="تحتاج سداد جدية"
                icon={CreditCard} tone="rose"
                onClick={() => { setTab('active'); setSubFilter('all'); }}
              />
              <StatChip
                active={false}
                value={stats.active} label="رحلات نشطة جارية"
                icon={Heart} tone="emerald"
                onClick={() => { setTab('active'); setSubFilter('all'); }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-6 pb-20 relative z-20">
        {/* خريطة الرحلة المرجعية المطورة */}
        <JourneyLegend />

        {/* أزرار التبويبات الفاخرة */}
        <div className="flex gap-2 bg-white dark:bg-navy-900 rounded-2xl p-1.5 shadow-[0_8px_30px_rgb(15,23,42,0.03)] border border-slate-100 dark:border-navy-800 mt-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-cairo font-bold text-xs sm:text-sm transition-all duration-300 cursor-pointer
                  ${active 
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-navy-950 shadow-[0_4px_12px_rgba(15,23,42,0.12)]' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-cream-50 dark:hover:bg-navy-800'}`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-amber-400 dark:text-navy-950' : 'text-slate-400'}`} />
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${active ? 'bg-amber-400 dark:bg-navy-950 text-slate-950 dark:text-navy-950 font-black' : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-cream-200'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* الفلترة الفرعية والبحث الأنيق وشريط التحكم بالتحديد */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4 items-stretch sm:items-center justify-between">
          {/* الفلترة الفرعية (chips) — تبويب النشطة فقط */}
          {tab === 'active' && buckets.active.length > 0 ? (
            <div className="flex gap-1.5 bg-slate-100/60 dark:bg-navy-900/60 p-1 rounded-xl border border-slate-200/50 dark:border-navy-800 self-start">
              {([
                { key: 'all', label: 'الكل' },
                { key: 'sent', label: 'طلبات أرسلتها' },
                { key: 'received', label: 'طلبات وردتني' },
              ] as const).map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => setSubFilter(chip.key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-cairo font-extrabold transition-all duration-200 cursor-pointer
                    ${subFilter === chip.key 
                      ? 'bg-white dark:bg-navy-950 text-slate-950 dark:text-cream-50 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cream-200'}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : <div className="hidden sm:block" />}

          {/* محرك البحث الحديث الفاخر */}
          <div className="relative flex-1 max-w-sm w-full sm:w-auto">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم الشريك أو المدينة..."
              className="w-full bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-navy-800 rounded-2xl py-2.5 pr-10 pl-10 text-xs sm:text-sm font-cairo focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 dark:focus:ring-amber-400/5 placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-cream-50 transition-all shadow-sm"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ===== شريط أدوات التحديد المتعدد وتحديد الجميع ===== */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 bg-white dark:bg-navy-900 p-3 rounded-2xl border border-slate-200/80 dark:border-navy-800 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextMode = !isSelectionMode;
                setIsSelectionMode(nextMode);
                if (!nextMode) setSelectedIds([]);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-cairo font-bold flex items-center gap-2 transition-all cursor-pointer ${
                isSelectionMode
                  ? 'bg-amber-500 text-navy-950 font-black shadow-md'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-cream-100 hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>{isSelectionMode ? 'إلغاء وضع التحديد' : 'تحديد متعدد'}</span>
            </button>

            {isSelectionMode && list.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="px-3.5 py-2 rounded-xl text-xs font-cairo font-bold bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-cream-100 hover:bg-slate-200 dark:hover:bg-navy-700 flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-navy-700"
              >
                <ListChecks className="w-4 h-4 text-amber-500" />
                <span>
                  {list.length > 0 && list.every((r) => selectedIds.includes(r.id))
                    ? 'إلغاء تحديد الجميع'
                    : 'تحديد الجميع'}
                </span>
              </button>
            )}
          </div>

          {isSelectionMode && (
            <div className="flex items-center gap-2 self-end sm:self-center">
              <span className="text-xs font-cairo font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                تم تحديد ({selectedIds.length}) من أصل ({list.length}) رحلة
              </span>
            </div>
          )}
        </div>

        {/* القائمة الذكية */}
        <div className="mt-5 space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-[2rem] shadow-sm">
              <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
              <p className="font-cairo text-sm text-slate-600 dark:text-slate-300 font-medium">جارٍ تحميل طلبات التوافق الآمنة...</p>
              <p className="font-cairo text-xs text-slate-400 dark:text-slate-400 mt-1">نحن نهتم بخصوصيتك ونقوم بتهيئة البيانات</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-rose-100 rounded-[2rem] p-6 shadow-sm">
              <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
              <p className="font-cairo text-slate-800 font-extrabold text-base mb-1">{error}</p>
              <p className="font-cairo text-xs text-slate-400 mb-4">حدث خطأ أثناء تحميل البيانات، يرجى التحديث</p>
              <button onClick={refresh} className="font-cairo text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-5 py-2.5 rounded-xl border border-amber-200/50 transition-colors cursor-pointer">
                إعادة المحاولة والاتصال
              </button>
            </div>
          )}

          {!loading && !error && list.length === 0 && (
            <EmptyState tab={tab} />
          )}

          {!loading && !error && (
            <AnimatePresence mode="popLayout">
              {list.map((req, idx) => (
                <RequestCard
                  key={(req?.id !== undefined && req?.id !== null && !Number.isNaN(Number(req.id))) ? `req-${req.id}-${idx}` : `req-idx-${idx}`}
                  req={req}
                  activeId={activeId}
                  getMember={getMember}
                  busy={actionLoading === req.id}
                  urgent={needsAction(req)}
                  unseen={isRequestUnseen(req.id, req.updated_at)}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.includes(req.id)}
                  onToggleSelect={() => toggleSelectReq(req.id)}
                  onAccept={() => onAccept(req)}
                  onDecline={() => { setDeclineModal(req); setDeclineReason(''); }}
                  onPay={() => { setPayModal(req); setPledge(false); }}
                  onCoord={() => setCoordModal(req)}
                  onResult={() => { setResultModal(req); setResultChoice('success'); setResultNote(''); }}
                  onCancel={() => { setCancelModal(req); setCancelReason(''); setCancelCustom(''); }}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ===== بطاقة القبول الاحتفالية ===== */}
      <AcceptedCelebrationModal
        open={!!acceptModal}
        memberName={acceptModal?.name || ''}
        onClose={() => setAcceptModal(null)}
        onInquiry={() => {
          const r = acceptModal?.req;
          setAcceptModal(null);
          if (r) navigate(`/journey/${r.id}?tab=inquiry`);
        }}
        onOpenJourney={() => {
          const r = acceptModal?.req;
          setAcceptModal(null);
          if (r) navigate(`/journey/${r.id}`);
        }}
        onProceed={() => {
          const r = acceptModal?.req;
          setAcceptModal(null);
          if (r) navigate(`/journey/${r.id}?tab=deposit`);
        }}
      />

      {/* ===== مودال الاعتذار ===== */}
      <Modal open={!!declineModal} onClose={() => setDeclineModal(null)} title="الاعتذار عن الطلب">
        <p className="text-sm text-navy-600 font-cairo mb-4">الاعتذار حق مشروع. اختر السبب الأقرب — لن يظهر اسمك للطرف الآخر بشكل محرج.</p>
        <div className="space-y-2">
          {DECLINE_REASONS.map((reason) => (
            <label key={reason} className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all
              ${declineReason === reason ? 'border-rose-300 bg-rose-50' : 'border-cream-200 hover:bg-cream-50'}`}>
              <input type="radio" name="decline" checked={declineReason === reason} onChange={() => setDeclineReason(reason)} className="accent-rose-500" />
              <span className="text-sm font-cairo text-navy-700">{reason}</span>
            </label>
          ))}
        </div>
        {declineReason === DECLINE_REASONS[DECLINE_REASONS.length - 1] && (
          <textarea
            value={declineCustom} onChange={(e) => setDeclineCustom(e.target.value)}
            placeholder="اكتب التفاصيل..." rows={3}
            className="w-full mt-3 bg-white border border-cream-200 rounded-xl p-3 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
        )}
        <button onClick={onDecline} disabled={actionLoading !== null}
          className="w-full mt-4 bg-rose-deep text-white font-cairo font-bold py-3.5 rounded-2xl hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {actionLoading !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          تأكيد الاعتذار
        </button>
      </Modal>

      {/* ===== مودال إلغاء الطلب (متاح في أي مرحلة) ===== */}
      <Modal open={!!cancelModal} onClose={() => setCancelModal(null)} title="إلغاء الطلب">
        <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 rounded-2xl p-3 mb-4">
          <Ban className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-navy-600 font-cairo leading-relaxed">
            يمكنك إلغاء هذا الطلب في أي مرحلة. يرجى تحديد السبب لتحسين تجربة المنصة.
            <span className="block mt-1 font-bold text-rose-600">⚠️ ملاحظة هامة: رسوم تأكيد الجدية وجميع الرسوم المدفوعة غير مستردة نهائياً تحت أي ظرف بعد السداد.</span>
          </p>
        </div>
        <div className="space-y-2">
          {CANCEL_REASONS.map((reason) => (
            <label key={reason} className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all
              ${cancelReason === reason ? 'border-rose-300 bg-rose-50' : 'border-cream-200 hover:bg-cream-50'}`}>
              <input type="radio" name="cancel" checked={cancelReason === reason} onChange={() => setCancelReason(reason)} className="accent-rose-500" />
              <span className="text-sm font-cairo text-navy-700">{reason}</span>
            </label>
          ))}
        </div>
        {cancelReason === CANCEL_REASONS[CANCEL_REASONS.length - 1] && (
          <textarea
            value={cancelCustom} onChange={(e) => setCancelCustom(e.target.value)}
            placeholder="اكتب سبب الإلغاء..." rows={3}
            className="w-full mt-3 bg-white border border-cream-200 rounded-xl p-3 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={() => setCancelModal(null)}
            className="flex-1 bg-cream-100 text-navy-600 font-cairo font-bold py-3.5 rounded-2xl hover:bg-cream-200 transition-all">
            تراجع
          </button>
          <button onClick={onCancel} disabled={actionLoading !== null}
            className="flex-1 bg-rose-deep text-white font-cairo font-bold py-3.5 rounded-2xl hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {actionLoading !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            تأكيد الإلغاء
          </button>
        </div>
      </Modal>

      {/* ===== مودال سداد رسوم الجدية ===== */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="تأكيد الجدية — سداد الرسوم">
        {payModal && (
          <div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-center">
              <ShieldCheck className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="font-cairo font-extrabold text-2xl text-amber-700">{DEPOSIT_AMOUNT} <span className="text-sm">ريال</span></p>
              <p className="text-xs text-navy-500 font-cairo mt-1">رسوم تأكيد الجدية — تُدفع مرة واحدة فقط</p>
              <p className="text-[10px] text-rose-600 font-cairo mt-1 font-bold">⚠️ تنبيه: جميع الرسوم المدفوعة للمنصة غير مستردة نهائياً تحت أي ظرف</p>
            </div>
            <PayProgress req={payModal} activeId={activeId} />
            <label className="flex items-start gap-2.5 mt-4 p-3 rounded-xl bg-cream-50 border border-cream-200 cursor-pointer">
              <input type="checkbox" checked={pledge} onChange={(e) => setPledge(e.target.checked)} className="mt-0.5 accent-gold-500" />
              <span className="text-xs font-cairo text-navy-600 leading-relaxed">
                أتعهّد أمام الله بأن طلبي هذا بنية الزواج الحقيقي والجاد، وأوافق على شروط المنصة.
              </span>
            </label>
            <button onClick={onPay} disabled={!pledge || actionLoading !== null}
              className="w-full mt-4 bg-gold-gradient text-navy-900 font-cairo font-extrabold py-3.5 rounded-2xl shadow-gold hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2">
              {actionLoading !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              سداد رسوم الجدية
            </button>
          </div>
        )}
      </Modal>

      {/* ===== مودال التنسيق ===== */}
      <Modal open={!!coordModal} onClose={() => setCoordModal(null)} title="تنسيق التواصل">
        {coordModal && (
          <div className="space-y-3">
            {coordModal.meeting_date ? (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <CalendarClock className="w-5 h-5" />
                  <span className="font-cairo font-bold text-sm">موعد التنسيق</span>
                </div>
                <p className="font-cairo text-navy-800 font-bold">{coordModal.meeting_date}</p>
                {coordModal.meeting_notes && <p className="text-xs text-navy-500 font-cairo mt-1">{coordModal.meeting_notes}</p>}
              </div>
            ) : (
              <div className="bg-cream-50 border border-cream-200 rounded-2xl p-4 text-center">
                <Loader2 className="w-6 h-6 text-blue-400 mx-auto mb-2 animate-spin" />
                <p className="text-sm font-cairo text-navy-600">الإدارة تنسّق الموعد حالياً. ستصلك التفاصيل قريباً.</p>
              </div>
            )}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs font-cairo text-navy-600 leading-relaxed">
              <Info className="w-4 h-4 text-indigo-500 inline ml-1" />
              عند تأكيد الموعد وإتمام التوافق الأولي، انتقل لمرحلة تبادل القنوات الرسمية.
            </div>
            {stageOf(coordModal) === 'coordination' && coordModal.meeting_date && (
              <button onClick={() => onAdvanceIntro(coordModal)} disabled={actionLoading !== null}
                className="w-full bg-indigo-500 text-white font-cairo font-bold py-3.5 rounded-2xl hover:brightness-105 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {actionLoading !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                المتابعة لمرحلة التوافق
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* ===== مودال تسجيل النتيجة ===== */}
      <Modal open={!!resultModal} onClose={() => setResultModal(null)} title="تسجيل نتيجة التوافق">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={() => setResultChoice('success')}
            className={`p-4 rounded-2xl border-2 text-center transition-all ${resultChoice === 'success' ? 'border-emerald-400 bg-emerald-50' : 'border-cream-200'}`}>
            <span className="text-2xl block mb-1">💚</span>
            <span className="font-cairo font-bold text-sm text-emerald-700">توافق مبارك</span>
          </button>
          <button onClick={() => setResultChoice('failed')}
            className={`p-4 rounded-2xl border-2 text-center transition-all ${resultChoice === 'failed' ? 'border-slate-400 bg-slate-50' : 'border-cream-200'}`}>
            <span className="text-2xl block mb-1">🤝</span>
            <span className="font-cairo font-bold text-sm text-slate-600">لم يكتمل</span>
          </button>
        </div>
        <textarea value={resultNote} onChange={(e) => setResultNote(e.target.value)} rows={3} placeholder="ملاحظة (اختياري)..."
          className="w-full bg-white border border-cream-200 rounded-xl p-3 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-gold-200" />
        <button onClick={onRecordResult} disabled={actionLoading !== null}
          className="w-full mt-4 bg-navy-900 text-white font-cairo font-bold py-3.5 rounded-2xl hover:bg-navy-800 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {actionLoading !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          تسجيل النتيجة وإنهاء الرحلة
        </button>
      </Modal>

      {/* ===== شريط الإجراءات الجماعية العائم ===== */}
      <AnimatePresence>
        {isSelectionMode && selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 80, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 80, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-[90] w-[94%] max-w-xl bg-navy-950/95 text-white p-3.5 rounded-2xl shadow-2xl border border-amber-500/30 flex items-center justify-between gap-3 flex-wrap backdrop-blur-md"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 text-navy-950 font-black font-cairo text-sm flex items-center justify-center shadow-sm">
                {selectedIds.length}
              </span>
              <div>
                <span className="text-xs font-cairo font-bold text-slate-100 block">رحلات محددة</span>
                <span className="text-[10px] font-cairo text-amber-400/90">اختر إجراءً للمجموعة</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleBulkMarkSeen}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-cairo font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/10"
                title="تعليم الرحلات المحددة كـ تمت مشاهدتها"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>تعليم كمقروء</span>
              </button>

              <button
                onClick={() => setConfirmBulkCancel(true)}
                className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-cairo font-bold flex items-center gap-1.5 border border-amber-500/30 transition-all cursor-pointer"
              >
                <Ban className="w-4 h-4" />
                <span>إلغاء المحددة</span>
              </button>

              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-xs font-cairo font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف المحددة</span>
              </button>

              <button
                onClick={() => setSelectedIds([])}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                title="تفريغ التحديد"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== مودال تأكيد الحذف الجماعي ===== */}
      <Modal open={confirmBulkDelete} onClose={() => setConfirmBulkDelete(false)} title="حذف الرحلات المحددة نهائياً">
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-cairo font-extrabold text-sm text-rose-900">
                هل أنت تأكد من إزالة وحذف {selectedIds.length} من طلبات الرحلات المحددة؟
              </p>
              <p className="font-cairo text-xs text-rose-700 mt-1 leading-relaxed">
                سيتم مسح هذه الرحلات وإزالتها تماماً من قائمتك وسجلك المحلي. لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleBulkDelete}
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-cairo font-extrabold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>تأكيد حذف {selectedIds.length} رحلة</span>
            </button>
            <button
              onClick={() => setConfirmBulkDelete(false)}
              className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold py-3 rounded-xl transition-all cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== مودال تأكيد الإلغاء الجماعي ===== */}
      <Modal open={confirmBulkCancel} onClose={() => setConfirmBulkCancel(false)} title="إلغاء الرحلات المحددة">
        <div className="space-y-4">
          <p className="font-cairo text-sm text-slate-700 dark:text-cream-200 font-bold">
            سيتم إلغاء {selectedIds.length} رحلة من رحلات التوافق المحددة. يرجى اختيار أو كتابة سبب الإلغاء الجماعي:
          </p>
          <input
            value={bulkCancelReason}
            onChange={(e) => setBulkCancelReason(e.target.value)}
            placeholder="سبب الإلغاء الجماعي (مثال: عدم الرغبة بالمتابعة حالياً...)"
            className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-3 text-xs sm:text-sm font-cairo focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-navy-950 text-slate-900 dark:text-cream-50"
          />
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleBulkCancel}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-navy-950 font-cairo font-extrabold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Ban className="w-4 h-4" />
              <span>تأكيد إلغاء {selectedIds.length} رحلة</span>
            </button>
            <button
              onClick={() => setConfirmBulkCancel(false)}
              className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold py-3 rounded-xl transition-all cursor-pointer"
            >
              تراجع
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== Toast ===== */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={`fixed bottom-6 left-1/2 z-[100] px-5 py-3 rounded-2xl shadow-2xl font-cairo font-bold text-sm text-white max-w-[90%]
              ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-rose-deep' : 'bg-navy-800'}`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
//  بطاقة الطلب الواحدة — تصميم فاخر ومتقن مع حلقة التوافق
// ============================================================
function RequestCard({
  req, activeId, getMember, busy, urgent, unseen, isSelectionMode, isSelected, onToggleSelect, onAccept, onDecline, onPay, onCoord, onResult, onCancel,
}: {
  key?: any;
  req: ApiRequest;
  activeId: string;
  getMember: (id: string) => any;
  busy: boolean;
  urgent: boolean;
  unseen: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onAccept: () => void | Promise<void>;
  onDecline: () => void;
  onPay: () => void;
  onCoord: () => any;
  onResult: () => void;
  onCancel: () => void;
}) {
  const stage = stageOf(req, activeId);
  const isSender = req.sender_id === activeId;
  const role: RequestRole = isSender ? 'sender' : 'receiver';
  const otherResolved = getMember(isSender ? req.receiver_id : req.sender_id);
  const isOtherDeleted = !otherResolved || otherResolved.status === 'deleted' || otherResolved.deleted === true;
  const isOtherBanned = otherResolved?.status === 'banned';
  const isOtherSuspended = otherResolved?.status === 'suspended';
  const isOtherUnavailable = isOtherDeleted || isOtherBanned || isOtherSuspended;

  const other = otherResolved || {
    id: isSender ? req.receiver_id : req.sender_id,
    nickname: isSender ? (req.receiver_nickname || 'عضو سابق (مُحذوف)') : (req.sender_nickname || 'عضو سابق (مُحذوف)'),
    gender: isSender ? (req.receiver_gender || 'female') : (req.sender_gender || 'male'),
    age: 28,
    country: 'السعودية',
    city: 'الرياض',
    verified: false,
    premium: false,
  };
  const colors = getGenderColors(other.gender);
  const meta = STAGE_META[stage];

  const selfPaid = isSender ? req.sender_paid : req.receiver_paid;
  const otherPaid = isSender ? req.receiver_paid : req.sender_paid;
  const action = getPrimaryAction(stage, role, { selfPaid, otherPaid });
  const urgency = actionUrgency(stage, role, { selfPaid, otherPaid });

  const [showTimeline, setShowTimeline] = useState(false);
  const [events, setEvents] = useState<RequestEvent[]>([]);

  const loadTimeline = async () => {
    if (!showTimeline && events.length === 0) {
      setEvents(await fetchRequestEvents(req.id));
    }
    setShowTimeline((v) => !v);
  };

  const summary = getJourneyStatusSummary(req, activeId, other.nickname);

  // لون شريط الإجراء النابض والمؤشرات
  const railColor = urgency === 'pay' ? 'bg-gradient-to-b from-rose-500 to-rose-600' : urgency === 'respond' ? 'bg-gradient-to-b from-amber-500 to-amber-600' : 'bg-gradient-to-b from-indigo-500 to-indigo-600';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      onClick={isSelectionMode ? onToggleSelect : undefined}
      className={`relative bg-white rounded-[2rem] border overflow-hidden transition-all duration-300 shadow-[0_4px_20px_rgba(15,23,42,0.02)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.06)] hover:-translate-y-0.5
        ${isSelectionMode ? 'cursor-pointer select-none' : ''}
        ${isSelected ? 'ring-2 ring-amber-500 border-amber-400 bg-amber-50/20' : urgent ? 'border-amber-300 ring-2 ring-amber-400/10' : 'border-slate-100'}`}
    >
      {/* زر التحديد الجانبي في وضع التحديد */}
      {isSelectionMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className="absolute top-4 left-4 z-30 p-2 bg-white dark:bg-navy-900 rounded-xl shadow-md border border-amber-400 dark:border-amber-600 cursor-pointer flex items-center justify-center transition-transform active:scale-95"
          title={isSelected ? 'إلغاء تحديد هذه الرحلة' : 'تحديد هذه الرحلة'}
        >
          {isSelected ? (
            <CheckSquare className="w-6 h-6 text-amber-500 fill-amber-100" />
          ) : (
            <Square className="w-6 h-6 text-slate-300 dark:text-navy-600" />
          )}
        </button>
      )}

      {/* شريط جانبي ملوّن فخم وممتد عمودياً للطلبات العاجلة */}
      {urgent && <div className={`absolute right-0 top-0 bottom-0 w-2.5 ${railColor}`} />}

      {/* شارة "يتطلب إجراءً" النابضة بالتصميم الجديد */}
      {urgent && !isSelectionMode && (
        <div className="absolute top-4 left-4 z-10">
          <motion.span
            animate={{ scale: [1, 1.04, 1], opacity: [0.95, 1, 0.95] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`inline-flex items-center gap-1.5 text-[10px] font-cairo font-black px-3.5 py-1.5 rounded-full text-white shadow-md
              ${urgency === 'pay' ? 'bg-gradient-to-r from-rose-500 to-rose-600' : 'bg-gradient-to-r from-amber-500 to-amber-600'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <Zap className="w-3 h-3" /> إجراء عاجل مطلوب
          </motion.span>
        </div>
      )}

      {/* الرأس: تقسيم bento أنيق يحتوي على الصورة، الاسم، وحلقة التوافق الموزون */}
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={`/member/${other.id}`} className="flex-shrink-0 relative group block cursor-pointer">
            <img 
              src={getAvatar(other.gender)} 
              alt={other.nickname}
              className={`w-16 h-16 rounded-[1.25rem] object-cover ring-4 ${colors.ring} ring-offset-2 transition-all duration-300 group-hover:scale-105`} 
            />
            {unseen && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
            )}
          </Link>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link to={`/member/${other.id}`} className="font-cairo font-black text-lg text-slate-900 dark:text-cream-50 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer leading-tight">
                {other.nickname}
              </Link>
              {isOtherDeleted && (
                <span className="text-[10px] font-cairo font-black text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 px-2.5 py-0.5 rounded-full">
                  ⚠️ حساب مُحذوف
                </span>
              )}
              {isOtherBanned && (
                <span className="text-[10px] font-cairo font-black text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 px-2.5 py-0.5 rounded-full">
                  ⛔ حساب محظور
                </span>
              )}
              {isOtherSuspended && (
                <span className="text-[10px] font-cairo font-black text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 px-2.5 py-0.5 rounded-full">
                  ⚠️ حساب موقوف
                </span>
              )}
              {other.verified && !isOtherDeleted && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 p-1 rounded-md flex items-center gap-1" title="هوية موثقة رسمياً">
                  <BadgeCheck className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                  <span className="text-[9px] font-bold font-cairo hidden sm:inline">موثق</span>
                </div>
              )}
              {unseen && (
                <span className="text-[9px] font-cairo font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 px-2 py-0.5 rounded-full">تحديث</span>
              )}
              <span className="text-xs text-slate-400 dark:text-slate-400 font-cairo">· {other.age} سنة</span>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-300 font-cairo mt-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> 
              <span>يقيم في {other.city}، {other.country}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-cairo font-extrabold px-3 py-1 rounded-full border ${ACCENT_CLASSES[meta.accent].bgSoft} ${ACCENT_CLASSES[meta.accent].text} border-current/10`}>
                {isSender ? 'طلب أرسلته' : 'طلب وارد إليك'} · {meta.badge}
              </span>
              {req.frozen && (
                <span className="inline-flex items-center gap-1 text-[10px] font-cairo font-extrabold px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50">
                  <Clock className="w-3 h-3 animate-spin" /> بانتظار وساطة الإدارة
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* رسالة الاهتمام (إذا وُجدت) */}
      {req.message && (
        <div className="px-5 sm:px-6 pb-4">
          <div className="relative bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-2xl p-4 shadow-inner">
            <div className="absolute right-3.5 -top-2.5 bg-white dark:bg-navy-950 px-2.5 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/40 text-[9px] font-bold text-amber-800 dark:text-amber-400 font-cairo flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
              رسالة الاهتمام من الشريك
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-cairo leading-relaxed italic">
              " {req.message} "
            </p>
          </div>
        </div>
      )}

      {/* لوحة حالة الطلب المحدثة */}
      <div className="px-5 sm:px-6 pb-4">
        <RequestStatusPanel summary={summary} compact />
      </div>

      {/* خط التوقيت الزمني الأنيق للرحلة */}
      <div className="px-5 sm:px-6 pb-4">
        <JourneyTimeline
          stage={stage}
          isSender={isSender}
        />
      </div>

      {/* تفاصيل وحالات مخصصة حسب المرحلة */}
      {stage === 'declined' && req.decline_reason && (
        <div className="mx-5 sm:mx-6 mb-4 text-xs font-cairo text-rose-700 bg-rose-50/50 border border-rose-100 rounded-xl p-3 flex items-start gap-1.5">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">ملاحظة الاعتذار:</span> {req.decline_reason}
          </div>
        </div>
      )}
      {stage === 'completed' && req.evaluation_note && (
        <div className="mx-5 sm:mx-6 mb-4 text-xs font-cairo text-emerald-700 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex items-center gap-1.5">
          <span>{req.evaluation_result === 'failed' ? '🤝 ' : '💚 '}</span>
          <span>{req.evaluation_note}</span>
        </div>
      )}
      {(stage === 'coordination' || stage === 'sharia_viewing' || stage === 'engagement') && req.meeting_date && (
        <div className="mx-5 sm:mx-6 mb-4 text-xs font-cairo text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-500 animate-pulse" /> 
          <span className="font-bold">موعد اللقاء الشرعي المنسق:</span> {req.meeting_date}
        </div>
      )}
      
      {stage === 'seriousness' && (
        <div className="mx-5 sm:mx-6 mb-4 grid grid-cols-2 gap-2.5">
          <div className={`rounded-xl p-3 text-center border transition-all ${selfPaid ? 'bg-emerald-50/40 border-emerald-200' : 'bg-amber-50/40 border-amber-200/50'}`}>
            <p className="text-[10px] font-cairo font-bold text-slate-500">سدادك لتأكيد الجدية</p>
            <p className={`text-xs font-cairo font-black mt-0.5 ${selfPaid ? 'text-emerald-600' : 'text-amber-700'}`}>{selfPaid ? 'تم السداد ✓' : 'بانتظار سدادك'}</p>
          </div>
          <div className={`rounded-xl p-3 text-center border transition-all ${otherPaid ? 'bg-emerald-50/40 border-emerald-200' : 'bg-indigo-50 border-indigo-200/50'}`}>
            <p className="text-[10px] font-cairo font-bold text-slate-500">سداد الشريك لتأكيد الجدية</p>
            <p className={`text-xs font-cairo font-black mt-0.5 ${otherPaid ? 'text-emerald-600' : 'text-indigo-700'}`}>{otherPaid ? 'تم السداد ✓' : 'بانتظار سداده'}</p>
          </div>
        </div>
      )}

      {/* تنبيه حالة العضو الحصري */}
      {isOtherUnavailable && (
        <div className="mx-5 sm:mx-6 mb-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 rounded-2xl p-4 shadow-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="font-cairo font-extrabold text-xs text-rose-900 dark:text-rose-200 leading-tight">
              {isOtherDeleted ? 'تم حذف حساب هذا العضو من المنصة' : isOtherBanned ? 'حساب هذا العضو محظور حالياً من قبل الإدارة' : 'حساب هذا العضو موقوف موقتاً'}
            </h4>
            <p className="font-cairo text-xs text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
              تعذّر استكمال إجراءات هذه الرحلة لأن حساب الطرف الآخر غير متاح. يمكنك إلغاء الطلب لإزالته من القائمة النشطة.
            </p>
          </div>
        </div>
      )}

      {/* قسم الإجراءات والخدمات المساعدة */}
      <div className="px-5 sm:px-6 pb-5 pt-3.5 border-t border-slate-100 dark:border-navy-800 bg-slate-50/30 dark:bg-navy-950/30">
        {isOtherUnavailable ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-3.5 rounded-2xl">
            <span className="text-xs font-cairo font-bold text-rose-800 dark:text-rose-300">توقفت الرحلة بسبب عدم توفر حساب الطرف الآخر</span>
            <button
              onClick={onCancel}
              disabled={busy}
              className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-cairo font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Ban className="w-4 h-4" />
              إلغاء وإزالة الطلب
            </button>
          </div>
        ) : (
          <PrimaryActionBar
            stage={stage} action={action} busy={busy} requestId={req.id}
            onAccept={onAccept} onDecline={onDecline} onPay={onPay} onCoord={onCoord} onResult={onResult}
          />
        )}

        {/* إرشادات ووسائل طمأنينة تفاعلية بناءً على نوع القرار المطلوب */}
        {action.type === 'accept_decline' && (
          <p className="text-[10px] text-slate-500 font-cairo text-center mt-2.5 leading-relaxed flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span>لن تتم مشاركة أي أرقام تواصل أو بيانات حساسة؛ فقط سيتم فتح مسار التعارف المبدئي بأسئلة محددة.</span>
          </p>
        )}
        {action.type === 'pay_deposit' && (
          <p className="text-[10px] text-rose-700 font-cairo text-center mt-2.5 leading-relaxed font-bold bg-rose-50 border border-rose-200/40 rounded-xl py-1.5 px-3 flex items-center justify-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
            <span>تنبيه هام: رسوم تأكيد الجدية وجميع الرسوم المدفوعة غير مستردة نهائياً تحت أي ظرف.</span>
          </p>
        )}
        {stage === 'sharia_viewing' && (
          <p className="text-[10px] text-indigo-700 font-cairo text-center mt-2.5 leading-relaxed bg-indigo-50 border border-indigo-100/50 rounded-xl py-1.5 px-3 flex items-center justify-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <span>بعد اللقاء الشرعي، حدد "توافق مبارك" لتوثيق الملكة أو "لم يكتمل" للاعتذار وإغلاق الطلب بلطف.</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-2.5 mt-3.5">
          {/* فتح الرحلة الكاملة بنمط راقٍ */}
          {!isTerminal(stage) && (
            <Link to={`/journey/${req.id}`}
              className="flex-1 flex items-center justify-center gap-2 font-cairo font-bold text-[11px] sm:text-xs text-amber-800 bg-amber-500/10 hover:bg-amber-500/15 rounded-xl py-3 transition-all cursor-pointer border border-amber-300/20 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" /> عرض الرحلة والتفاصيل
            </Link>
          )}
          
          {/* إلغاء الطلب — متاح للمراحل النشطة */}
          {!isTerminal(stage) && action.type !== 'accept_decline' && (
            <button onClick={onCancel} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-cairo font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50/50 rounded-xl py-3 transition-all disabled:opacity-60 cursor-pointer border border-rose-100/40 shadow-sm">
              <Ban className="w-3.5 h-3.5" /> إلغاء الطلب والاعتذار
            </button>
          )}
        </div>

        {/* سجل الأحداث الزمني التفصيلي القابل للتوسيع */}
        <button onClick={loadTimeline}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-[10px] font-cairo font-bold text-slate-400 hover:text-slate-600 transition-colors py-1 cursor-pointer">
          {showTimeline ? 'إخفاء السجل الزمني للرحلة' : 'عرض السجل الزمني للتواصل والأحداث'}
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${showTimeline ? '-rotate-90' : ''}`} />
        </button>
        
        <AnimatePresence>
          {showTimeline && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }} 
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2 border-t border-slate-200/40 mt-2">
                {events.length === 0 && (
                  <p className="text-[10px] text-slate-400 font-cairo text-center py-2">لم يتم تسجيل أي أحداث للرحلة حتى الآن</p>
                )}
                {events.map((ev, idx) => (
                  <div key={(ev?.id !== undefined && ev?.id !== null && !Number.isNaN(Number(ev.id))) ? `ev-${ev.id}-${idx}` : `ev-idx-${idx}`} className="flex items-start gap-2 text-xs font-cairo bg-white p-2.5 rounded-xl border border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-slate-700 font-medium">{ev.note}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{new Date(ev.created_at).toLocaleString('ar-SA')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================================
//  شريط الإجراء الأساسي — أزرار فاخرة متناسقة مفعمة بالحيوية
// ============================================================
function PrimaryActionBar({
  stage, action, busy, requestId, onAccept, onDecline, onPay, onCoord, onResult,
}: {
  stage: JourneyState; action: ReturnType<typeof getPrimaryAction>; busy: boolean; requestId: number;
  onAccept: () => void; onDecline: () => void; onPay: () => void; onCoord: () => void; onResult: () => void;
}) {
  if (action.type === 'open_journey') {
    return (
      <Link to={`/journey/${requestId}`}
        className="w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-cairo font-black py-4 rounded-2xl shadow-[0_4px_15px_rgba(245,158,11,0.2)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm">
        <Sparkles className="w-5 h-5 text-slate-950" /> {action.label}
      </Link>
    );
  }

  if (action.type === 'accept_decline') {
    return (
      <div className="flex gap-3">
        <button onClick={onAccept} disabled={busy}
          className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-cairo font-black py-3.5 rounded-2xl shadow-[0_4px_12px_rgba(16,185,129,0.15)] hover:-translate-y-0.5 transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4 text-white" />} قبول طلب التوافق
        </button>
        <button onClick={onDecline} disabled={busy}
          className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 font-cairo font-black py-3.5 rounded-2xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-sm">
          <X className="w-4 h-4 text-slate-500" /> اعتذار بلطف
        </button>
      </div>
    );
  }

  if (action.type === 'none') {
    return (
      <div className="text-center py-4 bg-[#FAF9F5] dark:bg-navy-900/40 rounded-2xl border border-slate-200/50">
        <p className="text-xs sm:text-sm font-cairo font-black text-slate-800">{action.label}</p>
        <p className="text-[10px] sm:text-xs font-cairo text-slate-500 mt-1">{action.hint}</p>
      </div>
    );
  }

  const handler = action.type === 'pay_deposit' ? onPay
    : action.type === 'view_coordination' ? onCoord
    : action.type === 'record_result' ? onResult : () => {};

  const accent = stage === 'seriousness' || stage === 'accepted' || stage === 'engagement' 
    ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-[0_4px_15px_rgba(245,158,11,0.2)]'
    : stage === 'sharia_viewing' 
      ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.15)]' 
      : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-[0_4px_12px_rgba(59,130,246,0.15)]';

  const Icon = action.type === 'pay_deposit' ? ShieldCheck : action.type === 'record_result' ? Heart : CalendarClock;

  return (
    <button onClick={handler} disabled={busy}
      className={`w-full ${accent} font-cairo font-black py-4 rounded-2xl hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0 flex items-center justify-center gap-2 cursor-pointer text-sm`}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-5 h-5" />}
      {action.label}
    </button>
  );
}

// ============================================================
//  تقدّم السداد الثنائي داخل مودال الدفع
// ============================================================
function PayProgress({ req, activeId }: { req: ApiRequest; activeId: string }) {
  const items = [
    { label: 'سدادك أنت لتأكيد الجدية', paid: req.sender_id === activeId ? req.sender_paid : req.receiver_paid },
    { label: 'سداد الطرف الآخر لتأكيد الجدية', paid: req.sender_id === activeId ? req.receiver_paid : req.sender_paid },
  ];
  return (
    <div className="flex gap-3">
      {items.map((it) => (
        <div key={it.label} className={`flex-1 rounded-2xl p-3.5 text-center border transition-all ${it.paid ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
          <p className="text-[11px] font-cairo font-bold text-slate-500">{it.label}</p>
          <p className={`text-sm font-cairo font-black mt-1 ${it.paid ? 'text-emerald-600' : 'text-slate-400'}`}>
            {it.paid ? '✓ تم السداد بنجاح' : 'بانتظار السداد'}
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  خريطة الرحلة المرجعية (Legend) — قابلة للطي وغاية في الجاذبية
// ============================================================
function JourneyLegend() {
  const [open, setOpen] = useState(false);
  const stages: JourneyState[] = ['sent', 'accepted', 'seriousness', 'coordination', 'sharia_viewing', 'engagement', 'completed'];
  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(15,23,42,0.02)] overflow-hidden transition-all duration-300">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors">
        <span className="flex items-center gap-2.5 font-cairo font-black text-xs sm:text-sm text-slate-800">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" /> 
          <span>كيف تعمل رحلة التوافق للزواج الشرعي الميسر؟ (٧ خطوات واضحة)</span>
        </span>
        <ChevronLeft className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${open ? '-rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-1 space-y-3.5 border-t border-slate-100/50">
              {stages.map((s, i) => {
                const m = STAGE_META[s];
                const c = ACCENT_CLASSES[m.accent];
                const Icon = m.icon;
                return (
                  <div key={`journey-stage-item-${s}-${i}`} className="flex items-start gap-4 p-3 rounded-2xl hover:bg-slate-50/70 transition-colors">
                    <div className={`w-10 h-10 rounded-2xl ${c.bg} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-600 font-cairo">الخطوة {i + 1}</span>
                        <p className="font-cairo font-black text-sm text-slate-900">{m.title}</p>
                      </div>
                      <p className="text-xs text-slate-500 font-cairo leading-relaxed mt-1">{m.whereYouAre}</p>
                      <p className="text-[10px] text-indigo-600 font-cairo font-black mt-1">
                        تلقائياً التالي: <span className="underline">{m.whatsNext}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
//  شريحة إحصائية في اللوحة العلوية (Stats Bar)
// ============================================================
function StatChip({
  value, label, icon: Icon, tone, active, onClick,
}: {
  value: number; label: string; icon: typeof Heart; tone: 'gold' | 'rose' | 'emerald'; active: boolean; onClick: () => void;
}) {
  const tones = {
    gold: { 
      ring: 'ring-amber-400/40 border-amber-400/40', 
      icon: 'text-amber-300', 
      val: 'text-amber-300',
      bg: 'bg-amber-500/10'
    },
    rose: { 
      ring: 'ring-rose-400/40 border-rose-400/40', 
      icon: 'text-rose-300', 
      val: 'text-rose-300',
      bg: 'bg-rose-500/10'
    },
    emerald: { 
      ring: 'ring-emerald-400/40 border-emerald-400/40', 
      icon: 'text-emerald-300', 
      val: 'text-emerald-300',
      bg: 'bg-emerald-500/10'
    },
  }[tone];
  
  return (
    <button
      onClick={onClick}
      className={`flex-1 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl px-3.5 py-3 text-center transition-all duration-300 cursor-pointer border border-white/10
        ${active ? `ring-2 ${tones.ring} ${tones.bg}` : ''}`}
    >
      <div className="flex items-center justify-center gap-2">
        <Icon className={`w-4 h-4 ${tones.icon}`} />
        <span className={`font-cairo font-black text-lg sm:text-2xl tracking-tight ${active ? tones.val : 'text-white'}`}>{value}</span>
      </div>
      <p className="text-[10px] font-cairo text-slate-300 mt-1 leading-none font-medium">{label}</p>
    </button>
  );
}

// ============================================================
//  حالة فارغة محسّنة ومذهلة — نصوص مصاغة بعناية
// ============================================================
function EmptyState({ tab }: { tab: Tab }) {
  const config = {
    active: {
      icon: Compass,
      title: 'رحلتك المباركة بانتظار خطوتك الأولى',
      desc: 'سجل التواصل الآمن لا يحتوي على طلبات نشطة حالياً. تصفّح الأعضاء الموثقين الآن، وأرسل طلب اهتمام جاد لبدء المسار.',
      cta: '🔍 تصفّح الأعضاء وابحث عن نصفك الآخر', link: '/search',
    },
    incoming: {
      icon: Mail,
      title: 'صندوق الوارد آمن وبانتظار الفرص',
      desc: 'لم تتلقَ أي طلبات اهتمام جديدة حتى الآن. نوصيك بإكمال ملفك الشخصي بنسبة ١٠٠٪ ورفع مستوى الجدية لزيادة فرص التواصل.',
      cta: '✨ تحسين وإكمال ملفي الشخصي الموحد', link: '/profile',
    },
    archive: {
      icon: Archive,
      title: 'السجل نظيف ولا توجد رحلات منتهية',
      desc: 'الرحلات السابقة (المنتهية بالزواج أو المعتذر عنها) ستظهر هنا للرجوع إليها لاحقاً بكل سرية وموثوقية.',
      cta: '🔍 ابدأ تصفّح الأعضاء الآن', link: '/search',
    },
  }[tab];
  const Icon = config.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center px-6 bg-white border border-slate-100 rounded-[2.5rem] shadow-[0_8px_30px_rgb(15,23,42,0.015)]"
    >
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-[2.2rem] bg-gradient-to-br from-amber-50 to-amber-100/50 flex items-center justify-center border border-amber-200/20">
          <Icon className="w-10 h-10 text-amber-500 stroke-[1.8]" />
        </div>
        <motion.span
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute -inset-2.5 rounded-[2.8rem] border-2 border-amber-300/30"
        />
      </div>
      <h3 className="font-cairo font-black text-lg text-slate-900">{config.title}</h3>
      <p className="font-cairo text-xs sm:text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">{config.desc}</p>
      <Link
        to={config.link}
        className="mt-6 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-cairo font-black px-7 py-3.5 rounded-2xl shadow-[0_4px_15px_rgba(245,158,11,0.2)] hover:-translate-y-0.5 transition-all text-xs sm:text-sm"
      >
        {config.cta}
      </Link>
    </motion.div>
  );
}
