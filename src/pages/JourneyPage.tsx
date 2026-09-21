import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Loader2, AlertCircle, BadgeCheck, MapPin, Check, Info, X,
  ShieldCheck, MessageSquare, Send as SendIcon, CalendarClock, Heart,
  Sparkles, Coins, AlertTriangle, ChevronLeft, LifeBuoy, Eye, Gem, Ban,
  Phone, Lock, Clock, HeartHandshake, Calendar, Edit3, Trash2,
} from 'lucide-react';
import { getAvatar, getGenderColors } from '../lib/types';
import { useApp } from '../lib/AppContext';
import {
  fetchRequest, fetchRequestEvents, fetchInquiry, buyInquiryPackage, sendInquiryMessage, initializeInquiryPackage,
  fetchMembers, runActionStandalone, simulateInquiryReply, markRequestSeen,
  markRequestNotificationsRead, getCurrentUserId, hasUserPaidDepositAnywhere, buyMessagePackageCustom,
  updateInquiryMessage, deleteInquiryMessage, type ApiRequest, type RequestEvent, type InquiryState,
} from '../lib/useInterestRequests';
import { useSettings } from '../lib/useSettings';
import {
  JOURNEY_STAGES, STAGE_INDEX, STAGE_META, ACCENT_CLASSES,
  isTerminal, DECLINE_REASONS, CANCEL_REASONS, getJourneyStage, getJourneyStatusSummary,
  type JourneyState,
} from '../lib/journey';
import RequestStatusPanel from '../components/requests/RequestStatusPanel';
import PaymentGateway from '../components/payments/PaymentGateway';
import supabase from '../lib/supabase';

function stageOf(r: ApiRequest, activeUserId: string): JourneyState {
  return getJourneyStage(r, activeUserId);
}

export default function JourneyPage() {
  const { id } = useParams();
  const rid = Number(id);
  const navigate = useNavigate();
  const { user } = useApp();
  const currentUserId = user?.memberId || getCurrentUserId();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab'); // 'inquiry' | 'deposit'

  // تعليم الطلب كمقروء عند فتح رحلته
  useEffect(() => {
    if (rid && currentUserId) {
      markRequestSeen(rid);
      markRequestNotificationsRead(rid, currentUserId);
    }
  }, [rid, currentUserId]);

  const [req, setReq] = useState<ApiRequest | null>(null);
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [inquiry, setInquiry] = useState<InquiryState>({ package: null, remaining: 0, messages: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: string } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const showToast = (text: string, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    if (!currentUserId) return;
    await initializeInquiryPackage(rid, currentUserId);
    const [r, ev, inq, mem] = await Promise.all([
      fetchRequest(rid),
      fetchRequestEvents(rid),
      fetchInquiry(rid),
      fetchMembers(),
    ]);
    setReq(r);
    setEvents(ev);
    setInquiry(inq);
    setMembers(mem);
    setLoading(false);
  }, [rid, currentUserId]);

  useEffect(() => {
    load();
    const handleUpdate = () => load();
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('twafok_notification_update', handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('twafok_notification_update', handleUpdate);
    };
  }, [load]);

  // اشتراك لحظي حقيقي عبر Supabase Realtime — تنعكس إجراءات الطرف الآخر (قبول/رفض/دفع...) فوراً بدون تحديث الصفحة
  useEffect(() => {
    if (!rid || typeof supabase?.channel !== 'function') return;
    const channel = supabase
      .channel(`interest-request-${rid}`)
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'interest_requests', filter: `id=eq.${rid}` }, () => {
        load();
      })
      ?.subscribe();
    return () => { if (channel && typeof supabase?.removeChannel === 'function') supabase.removeChannel(channel); };
  }, [rid, load]);

  const runAction = async (action: string, payload: Record<string, any> = {}) => {
    setBusy(true);
    try {
      const res = await runActionStandalone(rid, action, currentUserId, payload);
      if (!res.ok) { showToast(res.error || 'فشل الإجراء', 'error'); return false; }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-gold-500 mb-2 sm:mb-3" />
        <p className="font-cairo text-navy-500">جارٍ فتح رحلتك...</p>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center px-6 text-center" dir="rtl">
        <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
        <p className="font-cairo font-bold text-navy-700 mb-4">تعذّر العثور على هذا الطلب</p>
        <Link to="/requests" className="text-gold-700 font-cairo font-bold underline">العودة لطلباتي</Link>
      </div>
    );
  }

  // التحقق من صلاحية الوصول للطلب — العضو يرى فقط الطلبات التي هو طرف فيها
  const isParticipant = req.sender_id === currentUserId || req.receiver_id === currentUserId;
  if (!isParticipant) {
    return (
      <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center px-6 text-center" dir="rtl">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <p className="font-cairo font-bold text-navy-800 text-lg mb-2">غير مصرح بالوصول</p>
        <p className="font-cairo text-navy-600 text-sm mb-4">هذا الطلب يخص عضواً آخر، لا يمكنك الاطلاع على تفاصيله.</p>
        <Link to="/requests" className="px-5 py-2.5 bg-navy-900 text-white rounded-xl font-cairo font-bold hover:bg-navy-800 transition">العودة إلى طلباتي</Link>
      </div>
    );
  }

  const stage = stageOf(req, currentUserId);
  const isSender = req.sender_id === currentUserId;
  const other = members.find((m) => m.id === (isSender ? req.receiver_id : req.sender_id));
  const isOtherDeleted = !other || other.status === 'deleted' || (other as any).deleted === true;
  const isOtherBanned = other?.status === 'banned';
  const isOtherSuspended = other?.status === 'suspended';
  const isOtherUnavailable = isOtherDeleted || isOtherBanned || isOtherSuspended;

  const colors = other ? getGenderColors(other.gender) : getGenderColors('male');
  const currentIdx = isTerminal(stage) ? -1 : STAGE_INDEX[stage as keyof typeof STAGE_INDEX];
  const progress = isTerminal(stage) ? 0 : Math.round(((currentIdx) / (JOURNEY_STAGES.length - 1)) * 100);
  const statusSummary = getJourneyStatusSummary(req, currentUserId, other?.nickname || 'الطرف الآخر');

  return (
    <div className="min-h-screen bg-cream-50 pb-20" dir="rtl">
      {/* ===== بانر التجميد الإداري أو حذف حساب الشريك ===== */}
      {isOtherUnavailable && (
        <div className="sticky top-0 z-50 bg-rose-600 text-white px-4 py-3 text-center font-cairo font-bold text-sm flex items-center justify-center gap-2 shadow-md">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-bounce" />
          <span>
            {isOtherDeleted ? 'تنبيه: تم حذف حساب الطرف الآخر من المنصة، لا يمكن استكمال المراسلات أو خطوات الرحلة.' : isOtherBanned ? 'تنبيه: حساب الطرف الآخر محظور حالياً من قبل الإدارة.' : 'تنبيه: حساب الطرف الآخر موقوف موقتاً.'}
          </span>
        </div>
      )}
      {req.frozen && !isOtherUnavailable && (
        <div className="sticky top-0 z-50 bg-sky-500 text-white px-4 py-2.5 text-center font-cairo font-bold text-sm flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 animate-pulse" />
          هذا الطلب قيد تنسيق الإدارة — سيتم تحديثه قريباً
        </div>
      )}
      {/* ===== الطبقة 1: رأس ثابت ===== */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-cream-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/requests')}
              className="w-9 h-9 rounded-full bg-cream-100 hover:bg-cream-200 flex items-center justify-center text-navy-600 flex-shrink-0 transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
            {other && (
              <Link to={`/member/${other.id}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                <img src={getAvatar(other.gender)} alt={other.nickname}
                  className={`w-10 h-10 rounded-xl object-cover ring-2 ${colors.ring} ring-offset-1`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-cairo font-extrabold text-navy-900 truncate">{other.nickname}</span>
                    {other.verified && <BadgeCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  </div>
                  <span className="text-[11px] text-navy-400 font-cairo flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{other.city}
                  </span>
                </div>
              </Link>
            )}
            <a href="/support" className="w-9 h-9 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-500 flex-shrink-0 transition-colors" title="تواصل مع الوسيطة">
              <LifeBuoy className="w-5 h-5" />
            </a>
          </div>
          {/* شريط التقدّم */}
          {!isTerminal(stage) && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[11px] font-cairo font-bold text-navy-400 mb-1">
                <span>المرحلة {currentIdx + 1} من {JOURNEY_STAGES.length}</span>
                <span>{progress}% من الرحلة</span>
              </div>
              <div className="h-1.5 bg-cream-200 rounded-full overflow-hidden">
                <motion.div className="h-full bg-gold-gradient rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* ===== الطبقة 2: المرحلة النشطة (Hero) ===== */}
        <div className="mt-5">
          <div className="mb-4">
            <RequestStatusPanel summary={statusSummary} />
          </div>

          {/* تنبيه بتوجيهات ورسائل إدارة المنصة لهذا الطلب */}
          {inquiry?.messages?.filter((m: any) => m.sender_id === 'admin').length > 0 && (
            <div className="mb-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border-2 border-emerald-500/30 dark:border-emerald-500/40 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2.5 text-emerald-800 dark:text-emerald-300 font-cairo font-black text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>توجيه وإرشادات من إدارة المنصة:</span>
              </div>
              <div className="space-y-2">
                {inquiry.messages.filter((m: any) => m.sender_id === 'admin').map((m: any, mIdx: number) => (
                  <div key={`admin-direct-msg-${m.id || mIdx}`} className="bg-white dark:bg-navy-900 border border-emerald-200 dark:border-emerald-800/60 p-3.5 rounded-xl text-xs sm:text-sm font-cairo text-navy-900 dark:text-cream-50 leading-relaxed shadow-xs">
                    <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px] text-slate-400">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <span>🛡️</span> إدارة منصة التوافق
                      </span>
                      <span>{new Date(m.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 whitespace-pre-line">{m.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ActiveStagePanel
            req={req} stage={stage} isSender={isSender} other={other} busy={busy}
            self={members.find((m) => m.id === currentUserId)}
            inquiry={inquiry} setInquiry={setInquiry} reload={load} showToast={showToast}
            runAction={runAction} initialTab={initialTab}
          />
          {/* #7 معاينة المرحلة القادمة */}
          <NextStepHint stage={stage} />
        </div>

        {/* ===== الطبقة 3: خريطة الرحلة الكاملة (عمودية) ===== */}
        <div className="mt-6">
          <h3 className="font-cairo font-extrabold text-navy-800 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gold-500" /> خريطة رحلتك الكاملة
          </h3>
          <VerticalJourney req={req} stage={stage} events={events} />
        </div>

        {/* ===== إلغاء الطلب — متاح في أي مرحلة نشطة ===== */}
        {!isTerminal(stage) && (
          <div className="mt-6 bg-white rounded-2xl border border-rose-100 p-4">
            <div className="flex items-start gap-2.5 mb-3">
              <Ban className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-navy-500 font-cairo leading-relaxed">
                يمكنك إلغاء هذا الطلب في أي مرحلة مع ذكر السبب. لا تُسترد رسوم الجدية عند الإلغاء.
              </p>
            </div>
            <button onClick={() => setCancelOpen(true)} disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 text-sm font-cairo font-bold text-rose-500 border border-rose-200 hover:bg-rose-50 rounded-2xl py-2.5 transition-colors disabled:opacity-60">
              <Ban className="w-4 h-4" /> إلغاء الطلب
            </button>
          </div>
        )}

        {/* العودة لقائمة الطلبات (البطاقات الصغيرة) */}
        <button onClick={() => navigate('/requests')}
          className="mt-6 mb-2 w-full flex items-center justify-center gap-2 text-sm font-cairo font-bold text-navy-600 bg-cream-100 hover:bg-cream-200 rounded-2xl py-3.5 transition-colors">
          <ArrowRight className="w-4 h-4" /> العودة لقائمة طلباتي
        </button>
      </div>

      {/* حوار الإلغاء */}
      <CancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} busy={busy}
        onConfirm={async (reason: string) => {
          const ok = await runAction('cancel', { reason });
          setCancelOpen(false);
          if (ok) showToast('تم إلغاء الطلب', 'info');
        }} />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={`fixed bottom-6 left-1/2 z-[100] px-5 py-3 rounded-2xl shadow-2xl font-cairo font-bold text-sm text-white max-w-[90%]
              ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-rose-deep' : 'bg-navy-800'}`}>
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
//  الطبقة 2 — لوحة المرحلة النشطة (تتغيّر حسب المرحلة)
// ============================================================
function ActiveStagePanel({
  req, stage, isSender, other, self, busy, inquiry, setInquiry, reload, showToast, runAction, initialTab,
}: any) {
  const meta = STAGE_META[stage as JourneyState];
  const c = ACCENT_CLASSES[meta.accent];
  const Icon = meta.icon;

  // حالات المسارات الجانبية
  if (stage === 'declined' || stage === 'cancelled') {
    return (
      <div className={`rounded-3xl ${c.bgSoft} border ${c.border} p-6 text-center`}>
        <div className={`w-14 h-14 rounded-2xl ${c.bg} flex items-center justify-center text-white mx-auto mb-3`}>
          <Icon className="w-7 h-7" />
        </div>
        <h2 className={`font-cairo font-extrabold text-xl ${c.text}`}>{meta.title}</h2>
        <p className="text-sm text-navy-600 font-cairo mt-2">{meta.whereYouAre}</p>
        {(req.decline_reason || req.cancel_reason) && (
          <p className="text-xs text-navy-500 font-cairo mt-3 bg-white/60 rounded-xl p-2.5">
            السبب: {req.decline_reason || req.cancel_reason}
          </p>
        )}
        <Link to="/search" className="inline-block mt-4 bg-navy-900 text-white font-cairo font-bold px-6 py-3 rounded-2xl">
          ابدأ بحثاً جديداً
        </Link>
      </div>
    );
  }

  // المرحلة: مُرسَل
  if (stage === 'sent') {
    if (!isSender) {
      // المستقبِل يرى قرار القبول/الإلغاء
      return <DecisionPanel req={req} other={other} busy={busy} runAction={runAction} showToast={showToast} mode="incoming" />;
    }
    return (
      <HeroCard meta={meta} c={c} Icon={Icon}>
        <p className="text-sm text-navy-600 font-cairo leading-relaxed">{meta.whatToDo}</p>
        <div className="mt-3 bg-cream-50 rounded-xl p-3 text-center text-sm font-cairo font-bold text-navy-500">
          ⏳ بانتظار رد {other?.nickname || 'الطرف الآخر'}...
        </div>
        <p className="mt-2 text-[11px] text-navy-400 font-cairo text-center">
          سنُخطرك فوراً عند الرد. لا تحتاج لفعل أي شيء حالياً.
        </p>
      </HeroCard>
    );
  }

  // المرحلة: مقبول أو تأكيد الجدية -> مركز الخطوة التالية لكلا الطرفين (الاستفسار والرسوم) طالما لم يكتمل سداد الطرفين معاً للانتقال لمرحلة التنسيق
  if (stage === 'accepted' || stage === 'seriousness') {
    return <AcceptedHub req={req} other={other} busy={busy} inquiry={inquiry} setInquiry={setInquiry} reload={reload} showToast={showToast} runAction={runAction} initialTab={initialTab} />;
  }

  // تبادل أرقام التواصل (التنسيق)
  if (stage === 'coordination') {
    return (
      <HeroCard meta={meta} c={c} Icon={Icon}>
        <p className="text-sm text-navy-600 font-cairo leading-relaxed">{meta.whereYouAre}</p>
        {/* ===== مشاركة معلومات التواصل (الأنثى تُدخل، الذكر يطّلع بعد القَسَم) ===== */}
        <ContactExchange req={req} self={self} busy={busy} runAction={runAction} showToast={showToast} />

        {/* المتابعة للنظرة الشرعية بعد اكتمال تبادل التواصل واطّلاع الطرف الآخر */}
        {(req.guardian_phone || req.contact_info) && req.male_pledged && (
          <button onClick={() => runAction('advance_viewing')} disabled={busy}
            className="w-full mt-4 bg-indigo-500 text-white font-cairo font-bold py-3.5 rounded-2xl hover:brightness-105 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />} الانتقال للنظرة الشرعية
          </button>
        )}
        {(req.guardian_phone || req.contact_info) && !req.male_pledged && self?.gender === 'female' && (
          <p className="mt-3 text-center text-[11px] font-cairo text-navy-400">
            ⏳ بانتظار الطرف الآخر ليقوم بالتعهد ويُطلع على الأرقام. ستُخطرك فور إتمام ذلك.
          </p>
        )}
      </HeroCard>
    );
  }

  // النظرة الشرعية — تسجيل النتيجة (توافق -> الملكة، اعتذار مع سبب -> مرفوض)
  if (stage === 'sharia_viewing') {
    return (
      <HeroCard meta={meta} c={c} Icon={Icon}>
        <p className="text-sm text-navy-600 font-cairo leading-relaxed mb-4">{meta.whereYouAre}</p>
        
        {req.meeting_date ? (
          <div className="bg-gradient-to-br from-cream-50 to-amber-50/40 border border-amber-200 rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex items-center gap-2 text-amber-800 font-cairo font-bold text-sm mb-2 pb-2 border-b border-amber-100">
              <Eye className="w-4 h-4" /> موعد اللقاء الشرعي
            </div>
            <div className="space-y-2">
              <p className="text-sm font-cairo text-navy-800 font-bold">📅 الموعد: {req.meeting_date}</p>
              {req.meeting_notes && (
                <p className="text-xs text-navy-600 font-cairo leading-relaxed">
                  📌 {req.meeting_notes}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-center mb-4 text-xs font-cairo text-navy-600">
            ⏳ لم يتم تحديد الموعد بعد. تواصل مع الطرف الآخر لترتيب اللقاء.
          </div>
        )}

        {/* إتيكيت وتوجيهات النظرة الشرعية */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 mb-4 text-right">
          <p className="text-xs font-cairo font-bold text-indigo-900 mb-2 flex items-center gap-1.5">
            💡 توجيهات النظرة الشرعية:
          </p>
          <ul className="text-[11px] font-cairo text-navy-600 space-y-1.5 list-disc list-inside">
            <li><strong>الولاية:</strong> احرص على حضور ولي أمر الفتاة.</li>
            <li><strong>اللباس:</strong> الالتزام باللباس الشرعي الأنيق.</li>
            <li><strong>الصدق:</strong> الصدق بالحديث أساس بناء عائلة مستقرة.</li>
            <li><strong>الاستخارة:</strong> لا تنسَ صلاة الاستخارة.</li>
          </ul>
        </div>

        <RecordResultButton req={req} busy={busy} runAction={runAction} />
      </HeroCard>
    );
  }

  // الملكة — إتمام العقد ورسوم السعي النهائية
  if (stage === 'engagement') {
    return <EngagementPanel req={req} busy={busy} runAction={runAction} showToast={showToast} meta={meta} c={c} Icon={Icon} />;
  }

  // مكتمل
  const isCompletedSuccess = req.evaluation_result !== 'failed';
  return (
    <HeroCard meta={meta} c={c} Icon={Icon}>
      {isCompletedSuccess ? (
        <div className="space-y-4">
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-3xl p-6 text-center shadow-lg border border-emerald-500">
            {/* زخارف عائمة لمظهر ملوكي */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-6 -mt-6 blur-lg" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-6 -mb-6 blur-lg" />
            
            <Sparkles className="w-12 h-12 text-amber-300 mx-auto mb-3 animate-pulse" />
            
            <h3 className="font-cairo font-extrabold text-xl tracking-tight text-amber-200">💚 زواج مبارك ميمون!</h3>
            <p className="text-[11.5px] font-mono tracking-widest text-emerald-200 mt-1 uppercase">وثيقة توثيق عقد قران وتوافق جاد</p>
            
            {/* الآية القرآنية بجمالية راقية */}
            <p className="text-xs font-serif italic text-cream-100 bg-white/10 rounded-2xl p-3 my-4 leading-relaxed font-medium">
              "وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً"
            </p>
            
            <div className="space-y-1 text-right text-xs border-t border-white/20 pt-3">
              <p className="font-cairo"><span className="opacity-80">💍 حالة الرحلة:</span> <strong className="text-emerald-300">مكتملة ومباركة بالملكة ✓</strong></p>
              <p className="font-cairo"><span className="opacity-80">📅 تاريخ الإتمام:</span> <strong>{new Date(req.updated_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
              <p className="font-cairo"><span className="opacity-80">🔐 رقم التوثيق:</span> <span className="font-mono text-emerald-300">TW-2026-{req.id}</span></p>
            </div>
            
            <div className="mt-4 inline-flex items-center gap-1 bg-amber-400 text-navy-950 px-3.5 py-1.5 rounded-full text-[10.5px] font-cairo font-extrabold shadow-sm">
              👑 تم دفع كامل الرسوم وسعي الجدية
            </div>
          </div>
          
          {req.evaluation_note && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 text-xs font-cairo text-navy-700 leading-relaxed text-right">
              <strong>📝 رسالة المباركة والتوثيق من الطرفين:</strong> {req.evaluation_note}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-rose-50/50 border border-rose-200 rounded-3xl p-5 text-center shadow-sm text-right">
          <HeartHandshake className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="font-cairo font-extrabold text-navy-800 text-base text-center">قدّر الله وما شاء فعل 🕊️</h3>
          <p className="text-xs font-cairo text-navy-600 leading-relaxed mt-2 max-w-sm mx-auto text-center">
            انتهت رحلة طلب الاهتمام هذه دون حدوث نصيب. الزواج قسمة ونصيب، ونسأل الله العلي القدير أن يكتب لك الخير والتوفيق ويبدلك شريكاً صالحاً قريباً جداً.
          </p>
          {req.evaluation_note && (
            <div className="mt-3 bg-white border border-rose-100 rounded-xl p-3 text-xs font-cairo text-rose-700 leading-relaxed">
              <strong>سبب انتهاء المحاولة:</strong> {req.evaluation_note}
            </div>
          )}
          
          <div className="mt-4 pt-3 border-t border-rose-100 flex items-center justify-center gap-2">
            <span className="text-[10px] text-navy-400 font-cairo">لا تستسلم! ما زال هناك العديد من الأعضاء الجادين بانتظارك بالمنصة.</span>
          </div>
        </div>
      )}
    </HeroCard>
  );
}

// ============================================================
//  لوحة الملكة — رسوم السعي النهائية + إتمام العقد
// ============================================================
function EngagementPanel({ req, busy, runAction, showToast, meta, c, Icon }: any) {
  const { settings } = useSettings();
  const [pledge, setPledge] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const complete = async () => {
    if (!pledge) { showToast('يرجى تأكيد إتمام إجراءات العقد والموافقة على سداد الرسوم أولاً', 'error'); return; }
    // سداد رسوم السعي النهائية عبر بوابة الدفع قبل توثيق الزواج
    setPayOpen(true);
  };

  // يُنفّذ فعلياً بعد إتمام دفع رسوم السعي النهائية
  const completeEngagement = async (): Promise<boolean> => {
    const ok = await runAction('complete_engagement');
    if (ok) showToast('🎉 مبارك! تم سداد رسوم السعي وتوثيق الزواج بنجاح');
    return !!ok;
  };
  return (
    <HeroCard meta={meta} c={c} Icon={Icon}>
      <p className="text-sm text-navy-600 font-cairo leading-relaxed mb-4">{meta.whereYouAre}</p>
      
      {/* بطاقة عقد القران والرسوم بجمالية فاخرة */}
      <div className="bg-gradient-to-br from-amber-50/60 to-gold-50/40 border border-amber-200 rounded-3xl p-5 text-right shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-20 h-20 bg-amber-500/5 rounded-full -ml-6 -mt-6" />
        
        <div className="flex items-center gap-3 mb-3 border-b border-amber-200/60 pb-3">
          <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center text-navy-900 shadow-sm">
            <Gem className="w-5 h-5 text-amber-800" />
          </div>
          <div>
            <h4 className="font-cairo font-extrabold text-navy-800 text-sm">رسوم السعي النهائية</h4>
            <p className="text-[10px] text-navy-400 font-cairo">تُسدّد بعد عقد القران (الملكة)</p>
          </div>
        </div>
        
        <div className="text-center py-4">
          <p className="font-mono font-black text-2xl sm:text-4xl text-amber-700">{settings.final_fee_amount || 2000} <span className="text-base font-cairo font-bold">ريال</span></p>
          <p className="text-[11px] text-navy-500 font-cairo mt-1.5 leading-relaxed">
            تُسدّد عند إتمام الملكة إبراءً للذمة.
          </p>
        </div>

        <div className="space-y-2 mt-2 pt-3 border-t border-amber-200/50 text-xs text-navy-700 font-cairo">
          <p className="flex items-center gap-1.5">
            <span className="text-amber-600 font-bold">✓</span> توثيق الحالة كـ "متزوج".
          </p>
          <p className="flex items-center gap-1.5">
            <span className="text-amber-600 font-bold">✓</span> أرشفة وحماية بيانات الطرفين.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 mt-4 p-3.5 rounded-2xl bg-cream-50/60 border border-cream-200 cursor-pointer select-none">
        <input type="checkbox" checked={pledge} onChange={(e) => setPledge(e.target.checked)} className="mt-1 accent-gold-500 w-4 h-4 rounded" />
        <span className="text-xs font-cairo text-navy-700 leading-relaxed font-bold">
          أقر بإتمام عقد القران وألتزم بسداد رسوم السعي النهائية إبراءً للذمة.
        </span>
      </label>

      <button onClick={complete} disabled={!pledge || busy}
        className="w-full mt-4 bg-gold-gradient text-navy-900 font-cairo font-extrabold py-3.5 rounded-2xl shadow-gold hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gem className="w-5 h-5 text-amber-800" />}
        سداد رسوم السعي وتوثيق الملكة 🎉
      </button>

      {/* بوابة دفع رسوم السعي النهائية (بعد التواصل وإتمام الملكة) */}
      <PaymentGateway
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={settings.final_fee_amount || 2000}
        title="رسوم السعي النهائية"
        description="تُسدّد بعد إتمام عقد القران"
        lineItems={[
          { label: 'نوع الرسوم', value: 'سعي وتوثيق نهائي' },
          { label: 'التوثيق', value: 'تحديث الحالة إلى متزوج' },
        ]}
        payLabel="سداد رسوم السعي وتوثيق الزواج"
        onPaid={completeEngagement}
        requestId={req.id}
        requiresOfflineReview
      />
    </HeroCard>
  );
}

// ============================================================
//  مشاركة معلومات التواصل
//  الأنثى تُدخل رقم ولي الأمر → الذكر يراه بعد القَسَم بعدم النشر
// ============================================================
const GUARDIAN_RELATIONS = ['الأب', 'الأخ', 'العم', 'الخال', 'الجد', 'ولي الأمر'];

function ContactExchange({ req, self, busy, runAction, showToast }: any) {
  const isFemale = self?.gender === 'female';
  
  // States for reporting communication issues
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('الطرف الآخر لم يتجاوب');
  const [customReason, setCustomReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const handleReport = async () => {
    setReporting(true);
    const finalReason = reportReason === 'كتابة سبب مخصص' ? customReason : reportReason;
    if (!finalReason.trim()) {
      showToast('يرجى تحديد أو كتابة سبب البلاغ', 'error');
      setReporting(false);
      return;
    }
    const ok = await runAction('report_contact_issue', { reason: finalReason });
    setReporting(false);
    if (ok) {
      showToast('✅ تم إرسال البلاغ للإدارة بنجاح. سيقوم فريق الدعم بالتحقق والتواصل معك خلال ساعات.', 'success');
      setReportOpen(false);
    }
  };

  // Female states
  const femaleSubmitted = !!req.guardian_phone;
  const [fPhone, setFPhone] = useState(req.guardian_phone || '');
  const [fName, setFName] = useState(req.guardian_name || '');
  const [fRel, setFRel] = useState(req.guardian_relation || '');
  const [fTime, setFTime] = useState(req.contact_time || '');
  const [fNote, setFNote] = useState(req.contact_note || '');
  const [fPledgedInput, setFPledgedInput] = useState(false);

  // Male states
  const maleSubmitted = !!req.male_phone;
  const [mPhone, setMPhone] = useState(req.male_phone || '');
  const [mName, setMName] = useState(req.male_name || '');
  const [mRel, setMRel] = useState(req.male_relation || '');
  const [mTime, setMTime] = useState(req.male_contact_time || '');
  const [mNote, setMNote] = useState(req.male_contact_note || '');
  const [mPledgedInput, setMPledgedInput] = useState(false);

  const submitFemale = async () => {
    if (!fPhone.trim()) { showToast('رقم ولي الأمر مطلوب', 'error'); return; }
    const ok = await runAction('submit_contact', {
      guardianPhone: fPhone.trim(), guardianName: fName.trim(),
      guardianRelation: fRel, contactTime: fTime.trim(), contactNote: fNote.trim(),
    });
    if (ok) showToast('تمت مشاركة رقم ولي الأمر بنجاح ✓');
  };

  const submitMale = async () => {
    if (!mPhone.trim()) { showToast('رقم جوال التواصل مطلوب', 'error'); return; }
    const ok = await runAction('submit_contact', {
      malePhone: mPhone.trim(), maleName: mName.trim(), maleRelation: mRel,
      maleContactTime: mTime.trim(), maleContactNote: mNote.trim(),
    });
    if (ok) showToast('تمت مشاركة بيانات التواصل بنجاح ✓');
  };

  const doMalePledge = async () => {
    const ok = await runAction('male_pledge', {});
    if (ok) showToast('تم تأكيد التعهّد — تظهر لك معلومات ولي الأمر الآن', 'success');
  };

  const doFemalePledge = async () => {
    const ok = await runAction('female_pledge', {});
    if (ok) showToast('تم تأكيد التعهّد — يظهر لك رقم التواصل المباشر الآن', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
        <p className="text-xs font-cairo text-indigo-700 leading-relaxed text-center font-bold">
          🤝 آن الآوان لتبادل أرقام التواصل! الباحثة عن الستر تُدخل رقم ولي أمرها، والباحث عن الستر يطّلع عليه بعد التعهد بالحفاظ على الخصوصية.
        </p>
      </div>

      {/* 1. معلومات الباحثة عن الستر (رقم ولي الأمر - أولوية) */}
      <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
        <h3 className="font-cairo font-extrabold text-sm text-navy-800 flex items-center gap-1.5 border-b border-cream-100 pb-2 mb-3">
          <span className="text-lg">🌸</span> بيانات التواصل للباحثة عن الستر
          <span className="text-[9px] font-normal text-navy-400 bg-cream-100 px-1.5 py-0.5 rounded-full">أولوية رقم ولي الأمر</span>
        </h3>

        {isFemale ? (
          // لوحة الأنثى نفسها
          !femaleSubmitted ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1">📱 رقم ولي الأمر <span className="text-rose-500">*</span></label>
                <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} inputMode="tel" placeholder="مثال: 05xxxxxxxx"
                  className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1">👤 اسم ولي الأمر</label>
                  <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="اسم الولي"
                    className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1">صلة القرابة</label>
                  <input value={fRel} onChange={(e) => setFRel(e.target.value)} placeholder="مثال: أبي، عمي، خالي، أخي الأكبر"
                    className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1">⏰ الوقت المناسب للاتصال</label>
                <input value={fTime} onChange={(e) => setFTime(e.target.value)} placeholder="مثال: من 5 إلى 9 مساءً"
                  className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
              <div>
                <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1">📝 ملاحظة (اختياري)</label>
                <textarea value={fNote} onChange={(e) => setFNote(e.target.value)} rows={2} placeholder="مثال: يرجى الاتصال هاتفياً مباشرة"
                  className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
              <button onClick={submitFemale} disabled={busy || !fPhone.trim()}
                className="w-full bg-indigo-500 text-white font-cairo font-bold py-3 rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50">
                مشاركة معلومات التواصل لولي الأمر
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-2">
              <p className="text-xs font-cairo text-emerald-700 font-bold flex items-center gap-1">✓ تمت مشاركة بيانات ولي الأمر بنجاح</p>
              <div className="text-xs space-y-1 font-cairo text-navy-700">
                <p><strong>رقم ولي الأمر:</strong> {req.guardian_phone}</p>
                {req.guardian_name && <p><strong>اسم ولي الأمر:</strong> {req.guardian_name} ({req.guardian_relation || 'غير محدد'})</p>}
                {req.contact_time && <p><strong>الوقت المناسب:</strong> {req.contact_time}</p>}
                {req.contact_note && <p><strong>ملاحظات:</strong> {req.contact_note}</p>}
              </div>
            </div>
          )
        ) : (
          // لوحة الشريك الذكر لرؤية بيانات الأنثى
          !femaleSubmitted ? (
            <p className="text-xs text-navy-500 font-cairo text-center py-4 bg-cream-50/50 rounded-xl">
              ⏳ بانتظار إدخال الطرف الآخر لرقم ولي الأمر (أولوية تبادل التواصل)
            </p>
          ) : !req.male_pledged ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-3">
              <p className="text-xs font-cairo font-extrabold text-amber-800 flex items-center gap-1.5">
                🔒 رقم ولي الأمر جاهز — أكمِل التعهد للاطّلاع عليه
              </p>
              <p className="text-[10px] font-cairo text-navy-500 leading-relaxed">
                الباحثة عن الستر أدخلت رقم ولي أمرها بنجاح. للاطّلاع عليه، يُرجى التعهد بالحفاظ على الخصوصية.
              </p>
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-amber-200 cursor-pointer">
                <input type="checkbox" checked={mPledgedInput} onChange={(e) => setMPledgedInput(e.target.checked)} className="mt-0.5 accent-amber-500" />
                <span className="text-xs font-cairo text-navy-700 leading-relaxed">
                  أُقسم بالله العظيم أن أحفظ هذه المعلومات ولا أنشرها أبداً، وأن أتواصل بنية الزواج الجاد فقط.
                </span>
              </label>
              <button onClick={doMalePledge} disabled={busy || !mPledgedInput}
                className="w-full bg-amber-500 text-white font-cairo font-bold py-2.5 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50">
                أتعهّد — أظهر لي الرقم
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-xs font-cairo font-bold text-emerald-700 mb-2 flex items-center gap-1">🌸 بيانات التواصل لولي الأمر:</p>
              <div className="text-xs space-y-1.5 font-cairo text-navy-700">
                <p><strong>رقم التواصل:</strong> <a href={`tel:${req.guardian_phone}`} className="text-indigo-600 underline font-bold">{req.guardian_phone}</a></p>
                {req.guardian_name && <p><strong>اسم ولي الأمر:</strong> {req.guardian_name} ({req.guardian_relation || 'غير محدد'})</p>}
                {req.contact_time && <p><strong>الوقت المناسب للاتصال:</strong> {req.contact_time}</p>}
                {req.contact_note && <p><strong>ملاحظات الطرف الآخر:</strong> {req.contact_note}</p>}
              </div>
            </div>
          )
        )}
      </div>

      {/* 2. معلومات الباحث عن الستر (رقم الجوال - اختياري) */}
      <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
        <h3 className="font-cairo font-extrabold text-sm text-navy-800 flex items-center gap-1.5 border-b border-cream-100 pb-2 mb-3">
          <span className="text-lg">👔</span> بيانات التواصل للباحث عن الستر
          <span className="text-[9px] font-normal text-navy-400 bg-cream-100 px-1.5 py-0.5 rounded-full">رقم الجوال المباشر</span>
        </h3>

        {!isFemale ? (
          // لوحة الذكر نفسه
          !maleSubmitted ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1">📱 رقم جوال التواصل <span className="text-rose-500">*</span></label>
                <input value={mPhone} onChange={(e) => setMPhone(e.target.value)} inputMode="tel" placeholder="مثال: 05xxxxxxxx"
                  className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1">👤 اسم شخص التواصل (اختياري)</label>
                  <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="مثال: محمد"
                    className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1">صلة القرابة</label>
                  <input value={mRel} onChange={(e) => setMRel(e.target.value)} placeholder="مثال: أنا، أبي، أمي، أخي..."
                    className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1">⏰ الوقت المناسب للاتصال</label>
                <input value={mTime} onChange={(e) => setMTime(e.target.value)} placeholder="مثال: من 5 إلى 9 مساءً"
                  className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
              <div>
                <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1">📝 ملاحظة (اختياري)</label>
                <textarea value={mNote} onChange={(e) => setMNote(e.target.value)} rows={2} placeholder="مثال: يُفضل التنسيق عبر الواتساب أولاً"
                  className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
              <button onClick={submitMale} disabled={busy || !mPhone.trim()}
                className="w-full bg-indigo-500 text-white font-cairo font-bold py-3 rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50">
                مشاركة معلومات التواصل للباحث عن الستر
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-2">
              <p className="text-xs font-cairo text-emerald-700 font-bold flex items-center gap-1">✓ تمت مشاركة بيانات التواصل بنجاح</p>
              <div className="text-xs space-y-1 font-cairo text-navy-700">
                <p><strong>رقم التواصل:</strong> {req.male_phone}</p>
                {req.male_name && <p><strong>اسم شخص التواصل:</strong> {req.male_name} ({req.male_relation || 'غير محدد'})</p>}
                {req.male_relation && !req.male_name && <p><strong>صلة القرابة:</strong> {req.male_relation}</p>}
                {req.male_contact_time && <p><strong>الوقت المناسب للاتصال:</strong> {req.male_contact_time}</p>}
                {req.male_contact_note && <p><strong>ملاحظاتك:</strong> {req.male_contact_note}</p>}
              </div>
            </div>
          )
        ) : (
          // لوحة الأنثى لرؤية معلومات الذكر
          !maleSubmitted ? (
            <p className="text-xs text-navy-500 font-cairo text-center py-4 bg-cream-50/50 rounded-xl">
              ⏳ بانتظار إدخال الطرف الآخر لبيانات التواصل الخاصة به
            </p>
          ) : !req.female_pledged ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-3">
              <p className="text-xs font-cairo font-extrabold text-amber-800 flex items-center gap-1.5">
                🔒 تعهّد للاطّلاع على معلومات التواصل
              </p>
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-amber-200 cursor-pointer">
                <input type="checkbox" checked={fPledgedInput} onChange={(e) => setFPledgedInput(e.target.checked)} className="mt-0.5 accent-amber-500" />
                <span className="text-xs font-cairo text-navy-700 leading-relaxed">
                  أتعهد أمام الله بحفظ هذه المعلومات وعدم نشرها، والتواصل بنية الزواج الجاد فقط.
                </span>
              </label>
              <button onClick={doFemalePledge} disabled={busy || !fPledgedInput}
                className="w-full bg-amber-500 text-white font-cairo font-bold py-2.5 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50">
                أتعهّد والاطّلاع على المعلومات
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-xs font-cairo font-bold text-emerald-700 mb-2 flex items-center gap-1">👔 بيانات التواصل للباحث عن الستر:</p>
              <div className="text-xs space-y-1.5 font-cairo text-navy-700">
                <p><strong>رقم التواصل:</strong> <a href={`tel:${req.male_phone}`} className="text-indigo-600 underline font-bold">{req.male_phone}</a></p>
                {req.male_name && <p><strong>اسم شخص التواصل:</strong> {req.male_name} ({req.male_relation || 'غير محدد'})</p>}
                {req.male_relation && !req.male_name && <p><strong>صلة القرابة:</strong> {req.male_relation}</p>}
                {req.male_contact_time && <p><strong>الوقت المناسب للاتصال:</strong> {req.male_contact_time}</p>}
                {req.male_contact_note && <p><strong>ملاحظات الطرف الآخر:</strong> {req.male_contact_note}</p>}
              </div>
            </div>
          )
        )}
      </div>

      {/* قسم الإبلاغ والدعم عند تعذر التواصل */}
      <div className="bg-rose-50/30 border border-rose-100 rounded-2xl p-3 text-center">
        <p className="text-[11px] font-cairo text-navy-500 mb-2 leading-relaxed">
          هل واجهت مشكلة في التواصل مع الطرف الآخر؟ (رقم خاطئ، لا يتجاوب، إلخ)
        </p>
        <button onClick={() => setReportOpen(true)}
          className="text-rose-700 hover:bg-rose-50 font-cairo font-bold text-[11px] py-2 px-4 rounded-xl border border-rose-200 transition-colors inline-flex items-center gap-1.5">
          ⚠️ إبلاغ الإدارة للمساعدة
        </button>
      </div>

      {req.contact_issue_reported && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center mt-3 animate-pulse">
          <p className="text-xs font-cairo text-rose-700 font-bold">
            ⚠️ تم تقديم بلاغ للإدارة بنجاح: ({req.contact_issue_reason})
          </p>
          <p className="text-[10px] text-navy-500 font-cairo mt-0.5">
            يقوم فريق الدعم والوساطة بالتحقق والاتصال بالطرف الآخر الآن لمتابعة الجدية ومساعدتك.
          </p>
        </div>
      )}

      <DialogShell open={reportOpen} onClose={() => setReportOpen(false)} title="الدعم والتحقق — الإبلاغ عن مشكلة">
        <p className="text-xs font-cairo text-navy-600 leading-relaxed mb-4">
          يرجى تحديد المشكلة التي تواجهها مع الطرف الآخر. سيقوم فريق الإدارة والوساطة بالاتصال بالطرف الآخر للتحقق والمساعدة فوراً ومتابعة جدية الطلب.
        </p>
        <div className="space-y-2.5 mb-4">
          {[
            'الطرف الآخر لم يتجاوب',
            'رقم التواصل خاطئ',
            'واجهتني مشكلة أخرى',
            'كتابة سبب مخصص'
          ].map((r) => (
            <label key={r} className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${reportReason === r ? 'border-rose-300 bg-rose-50' : 'border-cream-200 bg-white'}`}>
              <input type="radio" checked={reportReason === r} onChange={() => setReportReason(r)} className="accent-rose-500" />
              <span className="text-xs font-cairo font-bold text-navy-700">{r}</span>
            </label>
          ))}
        </div>

        {reportReason === 'كتابة سبب مخصص' && (
          <textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)} rows={3}
            placeholder="اكتب تفاصيل المشكلة هنا لتطلع عليها الإدارة..."
            className="w-full bg-white border border-cream-200 rounded-xl p-3 text-xs font-cairo focus:outline-none focus:ring-2 focus:ring-rose-200" />
        )}

        <button onClick={handleReport} disabled={reporting || (reportReason === 'كتابة سبب مخصص' && !customReason.trim())}
          className="w-full mt-4 bg-rose-600 hover:bg-rose-700 text-white font-cairo font-bold py-3 rounded-xl hover:brightness-105 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {reporting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} إرسال البلاغ للتحقق والدعم
        </button>
      </DialogShell>
    </div>
  );
}

// بطاقة Hero عامة

function HeroCard({ meta, c, Icon, children }: any) {
  return (
    <div className="rounded-3xl bg-white border border-cream-200 shadow-soft overflow-hidden">
      <div className={`${c.bgSoft} border-b ${c.border} px-5 py-4 flex items-center gap-3`}>
        <div className={`w-12 h-12 rounded-2xl ${c.bg} flex items-center justify-center text-white`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <span className="text-[11px] font-cairo font-bold text-navy-400">المرحلة الحالية</span>
          <h2 className={`font-cairo font-extrabold text-lg ${c.text}`}>{meta.title}</h2>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ============================================================
//  مركز "مقبول" — الاستفسار + رسوم الجدية في صفحة واحدة
// ============================================================
// ============================================================
//  مركز "مقبول" — الاستفسار + رسوم الجدية في صفحة واحدة
// ============================================================
function AcceptedHub({ req, other, busy, inquiry, setInquiry, reload, showToast, runAction, initialTab }: any) {
  const { user } = useApp();
  const currentUserId = user?.memberId || getCurrentUserId();
  const isSender = req.sender_id === currentUserId;
  const selfPaid = isSender ? req.sender_paid : req.receiver_paid;

  // إذا كان العضو قد سدّد بالفعل، نفتح له المحادثة تلقائياً كخيار افتراضي لتسهيل الرد والمتابعة
  const defaultTab = initialTab
    ? (initialTab === 'inquiry' ? 'inquiry' : 'deposit')
    : (selfPaid ? 'inquiry' : 'deposit');

  const [tab, setTab] = useState<'choose' | 'inquiry' | 'deposit'>(defaultTab);
  const [cancelOpen, setCancelOpen] = useState(false);

  // الكشف عن رسائل واردة غير مقروءة للوسم المرئي
  const hasMessages = inquiry?.messages && inquiry.messages.length > 0;
  const lastMsg = hasMessages ? inquiry.messages[inquiry.messages.length - 1] : null;
  const hasUnreadInquiry = lastMsg && lastMsg.sender_id !== 'admin' && lastMsg.sender_id !== currentUserId;

  return (
    <div className="rounded-3xl bg-white border border-cream-200 shadow-soft overflow-hidden">
      <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white">
          <Check className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <span className="text-[11px] font-cairo font-bold text-navy-400">تم القبول ✓</span>
          <h2 className="font-cairo font-extrabold text-lg text-emerald-700">ما هي خطوتك التالية؟</h2>
        </div>
      </div>

      {/* تبويبات الاختيار مع شرح بسيط */}
      <div className="flex gap-2.5 p-3.5 bg-slate-50/50 border-b border-cream-100">
        <button onClick={() => setTab('deposit')}
          className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl font-cairo font-extrabold text-xs sm:text-sm transition-all duration-300 border cursor-pointer
            ${tab === 'deposit' 
              ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 border-amber-400 shadow-[0_4px_12px_rgba(245,158,11,0.2)]' 
              : 'bg-white border-cream-200 text-navy-500 hover:border-amber-300'}`}>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-current" /> سداد رسوم الجدية</span>
          <span className={`text-[9px] font-bold ${tab === 'deposit' ? 'text-navy-950/80' : 'text-navy-400'}`}>
            {selfPaid ? 'تم تأكيد جديتك بنجاح ✓' : 'الطريق المباشر للتوافق للزواج'}
          </span>
        </button>
        <button onClick={() => setTab('inquiry')}
          className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl font-cairo font-extrabold text-xs sm:text-sm transition-all duration-300 border cursor-pointer relative
            ${tab === 'inquiry' 
              ? 'bg-slate-900 text-white border-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.15)]' 
              : 'bg-white border-cream-200 text-navy-500 hover:border-amber-300'}`}>
          {hasUnreadInquiry && tab !== 'inquiry' && (
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          )}
          <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-current" /> استفسار أولاً</span>
          <span className={`text-[9px] font-bold ${tab === 'inquiry' ? 'text-amber-400' : 'text-navy-400'}`}>تعرّف أكثر قبل الدفع</span>
        </button>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">
          {tab === 'inquiry' && (
            <motion.div key="inq" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <InquiryRoom req={req} other={other} inquiry={inquiry} setInquiry={setInquiry} showToast={showToast}
                onProceedDeposit={() => setTab('deposit')} reload={reload} />
            </motion.div>
          )}
          {tab === 'deposit' && (
            <motion.div key="dep" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <DepositInline req={req} busy={busy} runAction={runAction} showToast={showToast} />
            </motion.div>
          )}
          {tab === 'choose' && (
            <motion.div key="cho" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
              <p className="text-sm font-cairo text-navy-500">اختر أحد الخيارين بالأعلى للمتابعة</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* إلغاء الطلب */}
        <button onClick={() => setCancelOpen(true)}
          className="w-full mt-4 text-rose-500 font-cairo font-bold text-sm py-2 hover:text-rose-600 transition-colors">
          إلغاء الطلب
        </button>
      </div>

      <CancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} busy={busy}
        onConfirm={async (reason: string) => {
          const ok = await runAction('cancel', { reason });
          setCancelOpen(false);
          if (ok) showToast('تم إلغاء الطلب', 'info');
        }} />
    </div>
  );
}

// ============================================================
//  غرفة الاستفسار — المحادثة + الباقة
// ============================================================
// أسئلة استفسار جاهزة (chips)
const INQUIRY_SUGGESTIONS = [
  'ما توقعاتك بخصوص السكن المستقبلي؟',
  'هل تمانع/ين استمرار العمل بعد الزواج؟',
  'ما رأيك في السكن المستقل عن الأهل؟',
  'كيف تصف/ين التزامك الديني؟',
  'هل لديك خطط للدراسة أو السفر؟',
];

function InquiryRoom({ req, other, inquiry, setInquiry, showToast, onProceedDeposit, reload }: any) {
  const { settings } = useSettings();
  const { messagePackages, user } = useApp();
  const currentUserId = user?.memberId || getCurrentUserId();
  const [buying, setBuying] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [showBuyInfo, setShowBuyInfo] = useState(false);
  const [typing, setTyping] = useState(false);
  const [confirmLow, setConfirmLow] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('medium');
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingMsgText, setEditingMsgText] = useState<string>('');
  const endRef = useRef<HTMLDivElement>(null);

  const selectedPkg = messagePackages.find((p) => p.id === selectedPkgId) || messagePackages[1] || messagePackages[0];
  const pkgPrice = selectedPkg.price;
  const pkgCredits = selectedPkg.credits;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [inquiry.messages.length, typing]);

  // اشتراك لحظي حقيقي عبر Supabase Realtime — تظهر رسائل الطرف الآخر فوراً بدون إعادة تحميل الصفحة
  useEffect(() => {
    if (!req?.id || typeof supabase?.channel !== 'function') return;
    const channel = supabase
      .channel(`inquiry-messages-${req.id}`)
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'inquiry_messages', filter: `request_id=eq.${req.id}` }, () => {
        reload?.();
      })
      ?.subscribe();
    return () => { if (channel && typeof supabase?.removeChannel === 'function') supabase.removeChannel(channel); };
  }, [req?.id, reload]);

  const hasPackage = !!inquiry.inquiry_started_by || inquiry.remaining > 0;
  const remaining = inquiry.remaining;
  const low = remaining <= 3;

  // يفتح بوابة الدفع — لا يتم تفعيل الباقة إلا بعد إتمام الدفع فعلياً
  const handleBuy = () => setPayOpen(true);

  // يُنفّذ فعلياً بعد نجاح الدفع عبر بوابة الدفع — PaymentGateway تُسجّل المعاملة المالية بنفسها
  // (سواء اكتملت فوراً أو عُلِّقت لمراجعة إدارية)، لذا نتجنب تكرار تسجيلها هنا (skipTransactionRecord=true).
  const completeBuy = async (): Promise<boolean> => {
    setBuying(true);
    const res = await buyMessagePackageCustom(currentUserId, pkgCredits, pkgPrice, req.id, true);
    setBuying(false);
    if (res.ok) {
      const initRes = await initializeInquiryPackage(req.id, currentUserId);
      if (initRes.ok && initRes.state) {
        setInquiry(initRes.state);
      }
      await reload?.();
      showToast('تم تفعيل باقة الاستفسار وشحن الرصيد بنجاح! ✓', 'success');
      return true;
    }
    showToast(res.error || 'تعذّر الشراء', 'error');
    return false;
  };

  const doSend = async () => {
    setConfirmLow(false);
    setSending(true);
    const res = await sendInquiryMessage(req.id, currentUserId, input.trim());
    if (res.ok && res.state) {
      setInquiry(res.state);
      setInput('');
      await reload?.();
      showToast('تم إرسال الرسالة وإشعار الطرف الآخر', 'success');
    } else {
      showToast(res.error || 'تعذّر الإرسال', 'error');
    }
    setSending(false);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    if (remaining <= 0) { showToast('نفد رصيد الباقة', 'error'); return; }
    // تأكيد قبل الإرسال عند الرصيد المنخفض (≤3)
    if (low) { setConfirmLow(true); return; }
    doSend();
  };

  // شاشة الشراء
  if (!hasPackage) {
    return (
      <div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
          <MessageSquare className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h3 className="font-cairo font-extrabold text-navy-800">باقة الاستفسار والتوافق للزواج</h3>
          <p className="text-xs text-navy-600 font-cairo mt-1 leading-relaxed">
            تريد معرفة المزيد عن {other?.nickname || 'الطرف الآخر'}؟ اختر باقة رسائل استفسار آمنة ومُشرَفة ومباشرة.
          </p>

          {/* Package Selection Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4">
            {messagePackages.map((pkg) => {
              const isSelected = selectedPkgId === pkg.id;
              const isPopular = pkg.id === 'medium';
              return (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPkgId(pkg.id)}
                  type="button"
                  className={`relative p-3 rounded-2xl border-2 text-center transition-all duration-300 cursor-pointer flex flex-col justify-between h-full
                    ${isSelected
                      ? 'border-amber-500 bg-amber-500/10 shadow-[0_4px_12px_rgba(245,158,11,0.08)] ring-2 ring-amber-400/20'
                      : 'border-slate-200 bg-white hover:border-amber-300'
                    }`}
                >
                  {isPopular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-cairo font-black px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                      الأكثر شعبية
                    </span>
                  )}
                  <div className="w-full">
                    <p className="text-[10px] font-cairo font-black text-navy-800 leading-tight mb-1 truncate">{pkg.name}</p>
                    <p className="font-cairo font-black text-2xl text-amber-600 leading-none mt-2">{pkg.credits}</p>
                    <p className="text-[9px] text-navy-400 font-cairo font-bold mt-1">رسالة استفسار</p>
                  </div>
                  <div className="w-full">
                    <div className="h-px bg-slate-200/60 my-2" />
                    <p className="font-cairo font-black text-xs text-navy-950">{pkg.price} ريال</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* شرح اقتصاد الباقة بوضوح قبل الشراء */}
        <button onClick={() => setShowBuyInfo((v) => !v)}
          className="w-full mt-2 flex items-center justify-center gap-1 text-[11px] font-cairo font-bold text-navy-400 py-1">
          <Info className="w-3.5 h-3.5" /> كيف يُحتسب الرصيد؟
        </button>
        <AnimatePresence>
          {showBuyInfo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-cream-50 rounded-xl p-3 text-xs font-cairo text-navy-600 leading-relaxed space-y-1">
                <p>• كل رسالة <strong>ترسلها أنت</strong> = رصيد واحد.</p>
                <p>• كل <strong>ردّ من الطرف الآخر</strong> = رصيد واحد أيضاً يُخصم من باقتك.</p>
                <p>• أي رسالة من الطرفين تُحتسب من رصيد صاحب باقة الاستفسار.</p>
                <p>• الباقة عالمية: يمكنك استخدام رصيد الرسائل المتبقي مع أعضاء آخرين أيضاً!</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={handleBuy} disabled={buying}
          className="w-full mt-3 bg-amber-500 text-white font-cairo font-extrabold py-3.5 rounded-2xl hover:brightness-105 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-5 h-5" />}
          شراء باقة رسائل ({pkgPrice} ريال / {pkgCredits} رسالة)
        </button>
        <button onClick={onProceedDeposit}
          className="w-full mt-2 text-navy-500 font-cairo font-bold text-sm py-2 hover:text-navy-700">
          تخطّي الاستفسار وسداد رسوم الجدية ←
        </button>

        <PaymentGateway
          open={payOpen}
          onClose={() => setPayOpen(false)}
          amount={pkgPrice}
          title="باقة رسائل الاستفسار والتوافق للزواج"
          description={`${pkgCredits} رسالة استفسار آمنة ومُشرَفة`}
          lineItems={[
            { label: 'عدد الرسائل', value: `${pkgCredits} رسالة` },
            { label: 'صالحة مع', value: 'جميع الأعضاء' },
          ]}
          payLabel="شراء الباقة"
          onPaid={completeBuy}
          requestId={req.id}
          requiresOfflineReview
          metadata={{ credits: pkgCredits }}
        />
      </div>
    );
  }

  // غرفة المحادثة
  return (
    <div>
      {/* عدّاد الرصيد */}
      <div className={`flex items-center justify-between rounded-xl px-3 py-2 mb-3 bg-emerald-50 border border-emerald-200`}>
        <span className="flex items-center gap-1.5 text-sm font-cairo font-bold text-navy-700">
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          رسائل الاستفسار والتوافق للزواج الجاد المتبقية
        </span>
        <span className="font-cairo font-extrabold text-emerald-600">
          {remaining} / {inquiry.package ? inquiry.package.credits_total : 10}
        </span>
      </div>

      {/* تنويه تواصل بشري مباشر وبدون ذكاء اصطناعي */}
      <div className="bg-amber-50/40 border border-amber-200/80 rounded-2xl p-3 mb-3 text-right">
        <p className="text-xs font-cairo text-amber-900 leading-relaxed font-bold flex items-center gap-1.5 mb-1">
          💬 تواصل مباشر جاد وآمن
        </p>
        <p className="text-[10.5px] font-cairo text-navy-600 leading-relaxed">
          استفسار مباشر بين الطرفين لضمان المصداقية، بدون ردود آلية أو ذكاء اصطناعي.
        </p>
      </div>

      {/* المحادثة */}
      <div className="bg-cream-50 rounded-2xl p-3 max-h-72 overflow-y-auto space-y-2.5 border border-cream-100">
        {inquiry.messages.map((m: any, mIdx: number) => {
          const mine = m.sender_id === currentUserId;
          const admin = m.sender_id === 'admin';
          const msgKey = (m?.id !== undefined && m?.id !== null && !Number.isNaN(Number(m.id))) ? `msg-${m.id}-${mIdx}` : `msg-idx-${mIdx}`;
          const isEditingThis = editingMsgId === m.id;

          return (
            <div key={msgKey} className={`flex ${admin ? 'justify-center' : mine ? 'justify-start' : 'justify-end'}`}>
              {admin ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-[11px] font-cairo text-blue-700 max-w-[95%] text-center leading-relaxed">
                  <ShieldCheck className="w-3.5 h-3.5 inline ml-1" />{m.text}
                </div>
              ) : (
                <div className="group relative flex flex-col items-start gap-1 max-w-[85%]">
                  {/* شريط الأدوات للأعضاء لرسائلهم */}
                  {mine && (
                    <div className="flex items-center justify-between w-full px-1 text-[10px] text-slate-400">
                      <span>أنت</span>
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title="تعديل الرسالة"
                          onClick={() => {
                            if (isEditingThis) {
                              setEditingMsgId(null);
                            } else {
                              setEditingMsgId(m.id);
                              setEditingMsgText(m.text);
                            }
                          }}
                          className="p-1 hover:bg-cream-200 text-slate-500 hover:text-navy-900 rounded"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title="حذف الرسالة"
                          onClick={async () => {
                            if (!window.confirm('هل تريد حذف هذه الرسالة؟ سيتم حذفها من كلا الطرفين والإدارة.')) return;
                            try {
                              setInquiry((prev: any) => ({
                                ...prev,
                                messages: prev.messages.filter((msg: any) => msg.id !== m.id),
                              }));
                              await deleteInquiryMessage(m.id);
                              await reload?.();
                              showToast('تم حذف الرسالة بنجاح ✓', 'success');
                            } catch (e) {
                              showToast('تعذر حذف الرسالة', 'error');
                            }
                          }}
                          className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {isEditingThis ? (
                    <div className="p-2.5 bg-white border-2 border-amber-400 rounded-2xl w-full space-y-2 shadow-xs">
                      <textarea
                        value={editingMsgText}
                        onChange={(e) => setEditingMsgText(e.target.value)}
                        rows={2}
                        className="w-full text-xs font-cairo p-2 border border-cream-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400 text-navy-900"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setEditingMsgId(null); setEditingMsgText(''); }}
                          className="px-2.5 py-1 text-[11px] font-cairo text-slate-500 hover:bg-cream-100 rounded-lg"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          disabled={!editingMsgText.trim()}
                          onClick={async () => {
                            if (!editingMsgText.trim()) return;
                            const newText = editingMsgText.trim();
                            try {
                              setInquiry((prev: any) => ({
                                ...prev,
                                messages: prev.messages.map((msg: any) => msg.id === m.id ? { ...msg, text: newText } : msg),
                              }));
                              setEditingMsgId(null);
                              setEditingMsgText('');
                              await updateInquiryMessage(m.id, newText);
                              await reload?.();
                              showToast('تم تعديل الرسالة بنجاح ✓', 'success');
                            } catch (e) {
                              showToast('تعذر حفظ التعديل', 'error');
                            }
                          }}
                          className="px-3 py-1 text-[11px] font-cairo font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          حفظ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`rounded-2xl px-3.5 py-2 text-sm font-cairo
                      ${mine ? 'bg-gold-gradient text-navy-900' : 'bg-white border border-cream-200 text-navy-700'}`}>
                      {m.text}
                    </div>
                  )}

                  {mine && !m.approved && !m.rejected && (
                    <span className="text-[10px] font-cairo text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 flex items-center gap-1 self-start mr-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      قيد مراجعة الإدارة (لن يظهر للطرف الآخر حتى يوافق المشرف)
                    </span>
                  )}
                  {mine && m.approved && (
                    <span className="text-[10px] font-cairo text-emerald-600 px-1 py-0.5 flex items-center gap-0.5 self-start mr-1 mt-0.5">
                      ✓ معتمد من الإدارة ومرئي للطرف الآخر
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {/* مؤشّر "يكتب الآن" */}
        {typing && (
          <div className="flex justify-end">
            <div className="bg-white border border-cream-200 rounded-2xl px-4 py-2.5 flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-navy-300"
                  animate={{ y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
              ))}
              <span className="text-[10px] font-cairo text-navy-400 mr-1">يكتب الآن</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* اقتراحات أسئلة جاهزة (chips) */}
      {remaining > 0 && inquiry.messages.length <= 2 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {INQUIRY_SUGGESTIONS.map((q) => (
            <button key={q} onClick={() => setInput(q)}
              className="text-[11px] font-cairo text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full px-2.5 py-1 transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* إدخال */}
      {remaining > 0 ? (
        <div className="flex gap-2 mt-3">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="اكتب استفسارك..." disabled={sending}
            className="flex-1 bg-white border border-cream-200 rounded-2xl px-4 py-3 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-amber-200" />
          <button onClick={handleSend} disabled={sending || !input.trim()}
            className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center disabled:opacity-50 flex-shrink-0">
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <SendIcon className="w-5 h-5 -scale-x-100" />}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-center">
            <p className="text-sm font-cairo font-bold text-rose-600 mb-1">نفد رصيد الرسائل.</p>
            <p className="text-xs font-cairo text-navy-500 leading-relaxed">يمكنك شراء باقة جديدة أو الانتقال لسداد رسوم الجدية وتبادل التواصل.</p>
          </div>
          <button onClick={handleBuy} disabled={buying}
            className="w-full bg-amber-500 text-white font-cairo font-extrabold py-3.5 rounded-2xl hover:brightness-105 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm">
            {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-5 h-5" />}
            شراء باقة رسائل للمتابعة ({pkgPrice} ريال / {pkgCredits} رسالة)
          </button>
        </div>
      )}

      {/* الانتقال لرسوم الجدية */}
      <button onClick={onProceedDeposit}
        className="w-full mt-4 bg-gold-gradient text-navy-900 font-cairo font-extrabold py-3.5 rounded-2xl shadow-gold hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
        <ShieldCheck className="w-5 h-5" /> انتهيت — سداد رسوم الجدية
      </button>

      <PaymentGateway
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={pkgPrice}
        title="باقة رسائل الاستفسار والتوافق للزواج"
        description={`${pkgCredits} رسالة استفسار آمنة ومُشرَفة`}
        lineItems={[
          { label: 'عدد الرسائل', value: `${pkgCredits} رسالة` },
          { label: 'صالحة مع', value: 'جميع الأعضاء' },
        ]}
        payLabel="شراء الباقة"
        onPaid={completeBuy}
        requestId={req.id}
        requiresOfflineReview
        metadata={{ credits: pkgCredits }}
      />
    </div>
  );
}

// ============================================================
//  لوحة رسوم الجدية (داخل مركز مقبول)
// ============================================================
function DepositInline({ req, busy, runAction, showToast }: any) {
  const { settings } = useSettings();
  const { user, paymentSettings, socialSettings } = useApp();
  const [pledge, setPledge] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [deferOpen, setDeferOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  
  const currentUserId = user?.memberId || getCurrentUserId();
  const isSender = req.sender_id === currentUserId;
  const selfPaid = isSender ? req.sender_paid : req.receiver_paid;
  const otherPaid = isSender ? req.receiver_paid : req.sender_paid;
  const hasPreviouslyPaid = hasUserPaidDepositAnywhere(currentUserId);

  // حساب الشهرين القادمين ديناميكياً لتأجيل السداد لمدة شهرين كحد أقصى
  const nextMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const arabicMonthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    for (let i = 0; i <= 1; i++) {
      const d = new Date(currentYear, currentMonth + i, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const totalDays = new Date(yr, mIdx + 1, 0).getDate();
      months.push({
        index: i,
        monthNum: mIdx,
        year: yr,
        label: `${arabicMonthNames[mIdx]} ${yr}`,
        totalDays,
      });
    }
    return months;
  }, []);

  const [selMonthIdx, setSelMonthIdx] = useState(0);
  const now = new Date();
  const [selDay, setSelDay] = useState(now.getDate());

  // تعديل اليوم عند تغيير الشهر ليتناسب مع الحد الأدنى أو الأقصى للأيام
  useEffect(() => {
    const m = nextMonths[selMonthIdx];
    if (selMonthIdx === 0) {
      if (selDay < now.getDate() || selDay > m.totalDays) {
        setSelDay(now.getDate());
      }
    } else {
      if (selDay > m.totalDays) {
        setSelDay(1);
      }
    }
  }, [selMonthIdx, nextMonths]);

  // حساب التاريخ بتنسيق ISO للطلب
  const computedDeferDate = useMemo(() => {
    const m = nextMonths[selMonthIdx];
    if (!m) return '';
    const dStr = String(selDay).padStart(2, '0');
    const mStr = String(m.monthNum + 1).padStart(2, '0');
    return `${m.year}-${mStr}-${dStr}`;
  }, [selMonthIdx, selDay, nextMonths]);

  const pay = async () => {
    if (!pledge) { showToast('يرجى الموافقة على عهد وقسم الجدية', 'error'); return; }
    // العضو الذي سدّد رسوم الجدية سابقاً يُفعّل الطلب مجاناً دون بوابة دفع
    if (hasPreviouslyPaid) {
      const ok = await runAction('pay_deposit');
      if (ok) showToast('✅ تم تفعيل الطلب مجاناً (سددت الرسوم مسبقاً)');
      return;
    }
    // غير ذلك: نفتح بوابة الدفع لسداد رسوم الجدية
    setPayOpen(true);
  };

  // يُنفّذ فعلياً بعد نجاح الدفع
  const completeDeposit = async (): Promise<boolean> => {
    const ok = await runAction('pay_deposit');
    if (ok) showToast('✅ تم تأكيد وتفعيل رسوم الجدية بنجاح');
    return !!ok;
  };

  const handleDefer = async () => {
    if (!computedDeferDate) { showToast('يرجى تحديد موعد تأجيل صحيح', 'error'); return; }
    const ok = await runAction('defer_payment', { deferDate: computedDeferDate });
    if (ok) {
      showToast('تم تأجيل موعد السداد وإشعار الطرف الآخر ✓');
      setDeferOpen(false);
    }
  };

  // مهلة الـ 15 يوماً
  let deadlineDiffDays = 15;
  if (req.deadline_date) {
    const dead = new Date(req.deadline_date);
    const diffTime = dead.getTime() - new Date().getTime();
    deadlineDiffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="space-y-4">
      {otherPaid && !selfPaid && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-right flex items-start gap-3 shadow-sm">
          <span className="text-xl">🌸</span>
          <div className="space-y-1">
            <p className="text-xs font-cairo font-extrabold text-emerald-800">الطرف الآخر سدّد رسوم الجدية!</p>
            <p className="text-[11px] font-cairo text-navy-600 leading-relaxed">
              أكمل الطرف الآخر السداد، وبانتظار سدادك لتبادل التواصل والبدء في التنسيق.
            </p>
          </div>
        </div>
      )}

      {selfPaid ? (
        <WaitingOther />
      ) : (
        <>
          {/* 1. حالة الجدية المسبقة */}
          {hasPreviouslyPaid ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center shadow-sm">
              <Sparkles className="w-9 h-9 text-emerald-600 mx-auto mb-2 animate-pulse" />
              <p className="font-cairo font-extrabold text-lg text-emerald-700">الرسوم مدفوعة مسبقاً! ✓</p>
              <p className="text-xs text-navy-600 font-cairo mt-1.5 leading-relaxed">
                لقد أثبتّ جديتك بسداد رسوم الجدية في طلب سابق. يمكنك المتابعة وتبادل التواصل مجاناً دون دفع مجدداً!
              </p>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200 rounded-[2rem] p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/5 rounded-full -translate-x-6 -translate-y-6" />
              <div className="text-center relative z-10">
                <ShieldCheck className="w-12 h-12 text-amber-600 mx-auto mb-2" />
                <p className="font-cairo font-black text-2xl sm:text-4xl text-amber-700">{settings.deposit_amount || 500} <span className="text-lg font-bold">ريال</span></p>
                <p className="text-xs text-navy-600 font-cairo mt-1.5 font-bold">
                  رسوم الجدية وتأكيد رغبة الزواج
                </p>
                
                {/* شارة الضمان والاطمئنان والشفافية الشرعية */}
                <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200/60 px-3.5 py-1.5 rounded-full text-[10px] font-cairo font-extrabold mt-3 shadow-inner">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  🔐 تنبيه هام: جميع الرسوم المدفوعة للمنصة غير مستردة نهائياً تحت أي ظرف بعد السداد
                </div>
              </div>
              
              {/* المزايا باختصار */}
              <div className="mt-5 pt-4 border-t border-amber-200/60 text-right space-y-3.5">
                <div className="flex items-start gap-3">
                  <span className="text-emerald-600 font-extrabold text-base mt-0.5">✓</span>
                  <div>
                    <p className="text-xs font-cairo font-bold text-navy-800">سداد لمرة واحدة فقط</p>
                    <p className="text-[11px] font-cairo text-navy-600 leading-relaxed mt-0.5">
                      تُدفع مرة واحدة طوال اشتراكك بالمنصة. في حال لم يكتب الله بينكما نصيباً، يحق لك تبادل التواصل مع أعضاء آخرين مجاناً ودون دفع أي رسوم إضافية.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="text-amber-600 font-extrabold text-base mt-0.5">🏆</span>
                  <div>
                    <p className="text-xs font-cairo font-bold text-navy-800">وسام الجدية الدائم</p>
                    <p className="text-[11px] font-cairo text-navy-600 leading-relaxed mt-0.5">
                      فور السداد يحصل ملفك على وسام الجدية الذهبي، مما يثبت صدق رغبتك ويضاعف فرصة قبول طلباتك ومباركة زواجك.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. تنبيه المهلة أو التأجيل */}
          {req.defer_date ? (
            (() => {
              const deferDead = new Date(req.defer_date);
              const deferDiffTime = deferDead.getTime() - new Date().getTime();
              const deferDiffDays = Math.ceil(deferDiffTime / (1000 * 60 * 60 * 24));
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <p className="text-xs font-cairo text-blue-700 font-bold flex items-center justify-center gap-1">
                    <span>⏳</span> تم تأجيل الطلب: متبقي {deferDiffDays > 0 ? deferDiffDays : 0} أيام على انتهاء مهلة السداد المحددة
                  </p>
                  <p className="text-[10px] text-navy-500 font-cairo mt-0.5">تم إشعار الطرف الآخر بنجاح لتنسيق المواعيد بطريقة ودّية وملتزمة.</p>
                </div>
              );
            })()
          ) : (
            deadlineDiffDays > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-center">
                <p className="text-xs font-cairo text-rose-700 font-bold flex items-center justify-center gap-1">
                  <span>⏳</span> مهلة سداد رسوم الجدية: متبقي {deadlineDiffDays} أيام
                </p>
                <p className="text-[10px] text-navy-500 font-cairo mt-0.5">يرجى السداد قبل انتهاء المهلة (١٥ يوماً من القبول) لتجنب الإلغاء التلقائي.</p>
              </div>
            )
          )}

          {/* 3. عهد الجدية */}
          <div className="bg-gold-50/50 border border-gold-200 rounded-2xl p-4">
            <p className="text-xs font-cairo font-extrabold text-amber-800 text-center mb-2">📜 عهد الجدية</p>
            <p className="text-[11px] font-cairo text-navy-600 leading-relaxed text-center bg-white border border-gold-100 rounded-xl p-3 mb-3">
              "أتعهد بدفع رسوم السعي (٢٠٠٠ ريال) بعد إتمام عقد القران مباشرة دون تأخير إبراءً للذمة."
            </p>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={pledge} onChange={(e) => setPledge(e.target.checked)} className="mt-0.5 accent-gold-500" />
              <span className="text-xs font-cairo text-navy-700 leading-relaxed font-bold">
                أوافق على عهد الجدية وألتزم به.
              </span>
            </label>
          </div>

          {/* 4. أزرار التحكم والعمل الإداري */}
          <div className="space-y-2">
            <button onClick={pay} disabled={!pledge || busy}
              className="w-full bg-gold-gradient text-navy-900 font-cairo font-extrabold py-3.5 rounded-2xl shadow-gold hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              {hasPreviouslyPaid ? 'تأكيد تفعيل الطلب مجاناً' : 'سداد رسوم الجدية'}
            </button>

            <div className="flex gap-2">
              {!req.defer_date && (
                <button onClick={() => setDeferOpen(true)}
                  className="flex-1 bg-cream-100 text-navy-600 font-cairo font-bold text-xs py-2.5 rounded-xl hover:bg-cream-200 transition-colors flex items-center justify-center gap-1.5">
                  📅 تأجيل السداد
                </button>
              )}
              <button onClick={() => setSupportOpen(true)}
                className="flex-1 bg-cream-100 text-navy-600 font-cairo font-bold text-xs py-2.5 rounded-xl hover:bg-cream-200 transition-colors flex items-center justify-center gap-1.5">
                💬 مشكلة بالسداد؟
              </button>
            </div>
          </div>
        </>
      )}

      {/* حوار تأجيل السداد بتجربة مستخدم ذكية وسهلة */}
      <DialogShell open={deferOpen} onClose={() => setDeferOpen(false)} title="تأجيل سداد رسوم الجدية">
        <p className="text-xs font-cairo text-navy-600 leading-relaxed mb-4">
          تسهيلاً لتحديد الموعد المناسب لظروفك، يرجى اختيار الشهر واليوم المناسبين لك من التقويم التفاعلي أدناه:
        </p>
        <div className="space-y-4">
          {/* اختيار الشهر */}
          <div>
            <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1.5">📅 أولاً: اختر الشهر</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {nextMonths.map((m: any) => (
                <button
                  key={m.index}
                  type="button"
                  onClick={() => setSelMonthIdx(m.index)}
                  className={`px-3 py-2 rounded-xl font-cairo text-xs font-bold border transition-all text-center
                    ${selMonthIdx === m.index
                      ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-100'
                      : 'border-cream-200 bg-white hover:bg-cream-50 text-navy-700'
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* اختيار اليوم */}
          <div>
            <label className="block text-[11px] font-cairo font-bold text-navy-600 mb-1.5">🔢 ثانياً: اختر اليوم المحدد</label>
            <div className="grid grid-cols-7 gap-1 bg-cream-50/50 p-2 rounded-2xl border border-cream-100">
              {Array.from({ length: nextMonths[selMonthIdx].totalDays }, (_, index) => {
                const dayNum = index + 1;
                const isDisabled = selMonthIdx === 0 && dayNum < now.getDate();
                return (
                  <button
                    key={dayNum}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setSelDay(dayNum)}
                    className={`h-7 sm:h-8 w-full rounded-lg font-cairo text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center
                      ${isDisabled
                        ? 'opacity-30 cursor-not-allowed bg-cream-100/50 text-navy-300'
                        : selDay === dayNum
                          ? 'bg-navy-900 text-white font-black'
                          : 'bg-white hover:bg-cream-100 text-navy-700 border border-cream-100'
                      }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-amber-50/40 border border-amber-200 rounded-xl flex items-center justify-between">
            <span className="text-[11px] font-cairo text-navy-600 font-bold">الموعد المحدد للتأجيل:</span>
            <span className="text-xs font-cairo font-bold text-navy-900">{computedDeferDate ? new Date(computedDeferDate).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}</span>
          </div>

          <button onClick={handleDefer} disabled={!computedDeferDate || busy}
            className="w-full bg-navy-900 text-white font-cairo font-bold py-3.5 rounded-xl hover:brightness-105 transition-all disabled:opacity-50">
            تأكيد تأجيل الموعد وإشعار الطرفين
          </button>
        </div>
      </DialogShell>

      {/* حوار تواصل مع الإدارة / الدعم */}
      <DialogShell open={supportOpen} onClose={() => setSupportOpen(false)} title="التواصل مع إدارة المنصة للـدعم">
        <div className="space-y-4 font-cairo" dir="rtl">
          <p className="text-xs text-navy-600 leading-relaxed text-right">
            إذا لم تكن تعرف كيفية السداد الإلكتروني أو تفضل التحويل المباشر، يمكنك استخدام المعلومات التالية وإرسال إثبات السداد للإدارة للتفعيل اليدوي:
          </p>
          
          <div className="bg-white border border-cream-200 rounded-xl p-3.5 space-y-3.5 text-xs text-navy-700 text-right whitespace-pre-wrap leading-relaxed">
            {paymentSettings?.bankActive !== false && (
              <div>
                <p className="font-bold text-navy-900 border-b border-cream-100 pb-1 mb-1.5">🏦 تفاصيل التحويل البنكي:</p>
                <p className="text-slate-600 text-xs">{paymentSettings?.bankDetails || "مصرف الراجحي\nرقم الحساب: SA8980000012345678901234\nباسم: شركة توافق لتيسير الزواج"}</p>
              </div>
            )}
            
            {paymentSettings?.cryptoActive && (
              <div>
                <p className="font-bold text-navy-900 border-b border-cream-100 pb-1 mb-1.5">🪙 محفظة العملات الرقمية USDT:</p>
                <p className="font-mono text-[11px] bg-slate-50 p-2 rounded-lg break-all text-center select-all">{paymentSettings?.cryptoWalletAddress || "عنوان محفظة غير متوفر"}</p>
              </div>
            )}

            <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-lg font-bold text-xs">
              💰 رسوم الجدية المطلوبة: {settings?.deposit_amount || 500} ريال سعودي (أو ما يعادله)
            </div>
          </div>

          <a 
            href={`https://wa.me/${(socialSettings?.whatsappNumber || "966500000000").replace(/[+\s-]/g, '')}`} 
            target="_blank" 
            rel="noreferrer"
            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
          >
            📱 تواصل مباشر عبر واتساب الإدارة
          </a>
          
          <button onClick={() => setSupportOpen(false)}
            className="w-full bg-cream-200 text-navy-700 py-2.5 rounded-xl text-xs font-bold">
            إغلاق النافذة
          </button>
        </div>
      </DialogShell>

      {/* بوابة دفع رسوم الجدية — المدفوعات اليدوية (بنكي/عملات رقمية) تمر عبر مراجعة إدارية قبل التفعيل */}
      <PaymentGateway
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={settings.deposit_amount || 500}
        title="رسوم الجدية"
        description="سداد لمرة واحدة — يتيح تبادل التواصل"
        lineItems={[
          { label: 'نوع الرسوم', value: 'رسوم الجدية' },
          { label: 'السداد', value: 'مرة واحدة طوال الاشتراك' },
        ]}
        payLabel="سداد رسوم الجدية"
        onPaid={completeDeposit}
        requestId={req.id}
        requiresOfflineReview
      />
    </div>
  );
}

// لوحة رسوم الجدية المستقلة (لمرحلة seriousness)
function DepositPanel({ req, isSender, busy, runAction, showToast }: any) {
  const selfPaid = isSender ? req.sender_paid : req.receiver_paid;
  const otherPaid = isSender ? req.receiver_paid : req.sender_paid;
  const meta = STAGE_META.seriousness;
  const c = ACCENT_CLASSES[meta.accent];
  return (
    <HeroCard meta={meta} c={c} Icon={meta.icon}>
      {!selfPaid && <DepositInline req={req} busy={busy} runAction={runAction} showToast={showToast} />}
      {selfPaid && !otherPaid && <WaitingOther />}
    </HeroCard>
  );
}

// زر تسجيل النتيجة
function RecordResultButton({ req, busy, runAction }: any) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<'success' | 'failed'>('success');
  const [note, setNote] = useState('');
  return (
    <>
      <button onClick={() => setOpen(true)} disabled={busy}
        className="w-full mt-4 bg-navy-900 text-white font-cairo font-bold py-3.5 rounded-2xl hover:bg-navy-800 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
        <Eye className="w-4 h-4" /> تسجيل نتيجة النظرة الشرعية
      </button>
      <DialogShell open={open} onClose={() => setOpen(false)} title="نتيجة النظرة الشرعية">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={() => setChoice('success')}
            className={`p-4 rounded-2xl border-2 text-center transition-all ${choice === 'success' ? 'border-emerald-400 bg-emerald-50' : 'border-cream-200 bg-white'}`}>
            <span className="text-2xl block mb-1">💚</span>
            <span className="font-cairo font-extrabold text-xs text-emerald-700 block">تم التوافق بفضل الله</span>
          </button>
          <button onClick={() => setChoice('failed')}
            className={`p-4 rounded-2xl border-2 text-center transition-all ${choice === 'failed' ? 'border-amber-400 bg-amber-50/50' : 'border-cream-200 bg-white'}`}>
            <span className="text-2xl block mb-1">🕊️</span>
            <span className="font-cairo font-extrabold text-xs text-amber-800 block">لم يحدث نصيب (الاعتذار بلطف)</span>
          </button>
        </div>

        {choice === 'success' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 mb-3 text-right space-y-1.5 shadow-sm animate-fade-in">
            <p className="text-xs font-cairo font-extrabold text-emerald-800">✨ تم التوافق بفضل الله ✨</p>
            <p className="text-[11px] font-cairo text-navy-600 leading-relaxed">
              الحمد لله الذي بنعمته تتم الصالحات. نسأل الله أن يبارك لكما ويتمم على خير.
            </p>
          </div>
        )}

        {choice === 'failed' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3 text-right text-[11px] font-cairo text-amber-800 leading-relaxed shadow-sm">
            🕊️ <strong>الاعتذار بلطف:</strong> الزواج قسمة ونصيب، والاعتذار الراقي يحفظ الكرامة والود.
          </div>
        )}

        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder={choice === 'failed' ? 'يرجى كتابة كلمة اعتذار لطيفة للطرف الآخر (إلزامي)...' : 'ملاحظة مباركة أو تفاصيل إضافية (اختياري)...'}
          className="w-full bg-white border border-cream-200 rounded-xl p-3 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-gold-200" />
        {choice === 'failed' && !note.trim() && (
          <p className="text-[11px] text-rose-500 font-cairo mt-1">يرجى كتابة رسالة الاعتذار بلطف لإرسالها للطرف الآخر.</p>
        )}
        <button
          disabled={choice === 'failed' && !note.trim()}
          onClick={async () => { await runAction('record_result', { result: choice, note }); setOpen(false); }}
          className="w-full mt-4 bg-navy-900 text-white font-cairo font-bold py-3.5 rounded-2xl disabled:opacity-50 hover:bg-navy-800 transition-colors">
          {choice === 'success' ? 'تأكيد التوافق والمضي للملكة والقران 🎉' : 'تأكيد الاعتذار بلطف وسلام 🕊️'}
        </button>
      </DialogShell>
    </>
  );
}

// ============================================================
//  لوحة القرار (المستقبِل: قبول/إلغاء)
// ============================================================
function DecisionPanel({ req, other, busy, runAction, showToast }: any) {
  const [cancelOpen, setCancelOpen] = useState(false);
  return (
    <div className="rounded-3xl bg-white border border-cream-200 shadow-soft overflow-hidden">
      <div className="bg-gold-300/15 border-b border-gold-200 px-5 py-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gold-gradient flex items-center justify-center text-navy-900">
          <Heart className="w-6 h-6" />
        </div>
        <div>
          <span className="text-[11px] font-cairo font-bold text-navy-400">🔔 طلب توافق وارد</span>
          <h2 className="font-cairo font-extrabold text-lg text-navy-800">الرد على طلب {other?.nickname}</h2>
        </div>
      </div>
      <div className="p-5">
        {req.message && (
          <p className="text-sm text-navy-600 font-cairo bg-cream-50 rounded-2xl p-3 mb-4 border border-cream-100 leading-relaxed">"{req.message}"</p>
        )}
        <p className="text-xs text-navy-500 font-cairo mb-3 text-center">
          اقرأ الملف الشخصي جيداً ثم اتخذ قرارك. القبول ينقلكما لمرحلة تأكيد الجدية.
        </p>
        <button onClick={async () => { const ok = await runAction('accept'); if (ok) showToast('🎉 تم قبول الطلب!'); }} disabled={busy}
          className="w-full bg-emerald-500 text-white font-cairo font-extrabold py-3.5 rounded-2xl hover:bg-emerald-600 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />} قبول وبدء رحلة التوافق للزواج
        </button>
        <button onClick={() => setCancelOpen(true)}
          className="w-full mt-2 bg-cream-100 text-navy-600 font-cairo font-bold py-3 rounded-2xl hover:bg-cream-200 transition-all flex items-center justify-center gap-2">
          <X className="w-4 h-4" /> الاعتذار بلطف
        </button>
      </div>
      <CancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} busy={busy} reasons={DECLINE_REASONS} title="الاعتذار عن الطلب"
        onConfirm={async (reason: string) => { const ok = await runAction('decline', { reason }); setCancelOpen(false); if (ok) showToast('تم الاعتذار بلطف', 'info'); }} />
    </div>
  );
}

// ============================================================
//  حوار الإلغاء/الاعتذار مع ذكر السبب
// ============================================================
function CancelDialog({ open, onClose, onConfirm, busy, reasons = CANCEL_REASONS, title = 'إلغاء الطلب' }: any) {
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');
  const finalReason = reason === reasons[reasons.length - 1] ? custom : reason;
  return (
    <DialogShell open={open} onClose={onClose} title={title}>
      <p className="text-sm text-navy-600 font-cairo mb-3">يرجى ذكر السبب:</p>
      <div className="space-y-2">
        {reasons.map((r: string) => (
          <label key={r} className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${reason === r ? 'border-rose-300 bg-rose-50' : 'border-cream-200'}`}>
            <input type="radio" checked={reason === r} onChange={() => setReason(r)} className="accent-rose-500" />
            <span className="text-sm font-cairo text-navy-700">{r}</span>
          </label>
        ))}
      </div>
      {reason === reasons[reasons.length - 1] && (
        <textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={3} placeholder="اكتب التفاصيل..."
          className="w-full mt-3 bg-white border border-cream-200 rounded-xl p-3 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-rose-200" />
      )}
      <button onClick={() => finalReason.trim() && onConfirm(finalReason)} disabled={busy || !finalReason.trim()}
        className="w-full mt-4 bg-rose-deep text-white font-cairo font-bold py-3.5 rounded-2xl hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} تأكيد
      </button>
    </DialogShell>
  );
}

// قشرة حوار بسيطة
function DialogShell({ open, onClose, title, children }: any) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[97] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            className="relative w-full max-w-md bg-cream-50 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="sticky top-0 bg-cream-50 z-10 flex items-center justify-between px-6 py-4 border-b border-cream-200">
              <h3 className="font-cairo font-bold text-lg text-navy-900">{title}</h3>
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center text-navy-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
//  الطبقة 3 — خريطة الرحلة العمودية (كل المراحل)
// ============================================================
function VerticalJourney({ req, stage, events }: { req: any; stage: JourneyState; events: RequestEvent[] }) {
  const [infoFor, setInfoFor] = useState<JourneyState | null>(null);
  const currentIdx = isTerminal(stage) ? 99 : STAGE_INDEX[stage as keyof typeof STAGE_INDEX];

  // For terminal stages, determine how far the journey went before being terminated:
  const lastActiveIdx = useMemo(() => {
    if (!isTerminal(stage)) {
      return STAGE_INDEX[stage as keyof typeof STAGE_INDEX] ?? 0;
    }
    let maxIdx = 0;
    // 1. Check events
    if (events && events.length > 0) {
      events.forEach((e) => {
        const evStage = mapEventToStage(e.type);
        const evIdx = STAGE_INDEX[evStage as keyof typeof STAGE_INDEX];
        if (evIdx !== undefined && evIdx > maxIdx) {
          maxIdx = evIdx;
        }
      });
    }
    // 2. Check request properties to fall back
    if (req) {
      if (req.evaluation_result || req.sender_viewing_result || req.receiver_viewing_result) {
        maxIdx = Math.max(maxIdx, 4); // sharia_viewing index is 4
      } else if (req.guardian_phone || req.male_phone || req.contact_info) {
        maxIdx = Math.max(maxIdx, 3); // coordination index is 3
      } else if (req.sender_paid || req.receiver_paid) {
        maxIdx = Math.max(maxIdx, 2); // seriousness index is 2
      } else if (events.some(e => e.type === 'accept' || e.type === 'inquiry_buy')) {
        maxIdx = Math.max(maxIdx, 1); // accepted index is 1
      }
    }
    return maxIdx;
  }, [stage, events, req]);

  return (
    <div className="bg-white rounded-3xl border border-cream-200 shadow-soft p-5">
      <div className="relative">
        {JOURNEY_STAGES.map((sKey, idx) => {
          const meta = STAGE_META[sKey];
          const c = ACCENT_CLASSES[meta.accent];
          const Icon = meta.icon;
          const isDone = isTerminal(stage)
            ? idx < lastActiveIdx
            : idx < currentIdx;
          const isCurrent = isTerminal(stage)
            ? idx === lastActiveIdx
            : idx === currentIdx;
          const stageEvents = events.filter((e) => mapEventToStage(e.type) === sKey);

          return (
            <div key={sKey} className="flex gap-4 pb-5 last:pb-0 relative">
              {/* الخط العمودي */}
              {idx < JOURNEY_STAGES.length - 1 && (
                <div className={`absolute right-[18px] top-10 bottom-0 w-0.5 ${isDone ? 'bg-emerald-300' : 'bg-cream-200'}`} />
              )}
              {/* الأيقونة */}
              <button onClick={() => setInfoFor(sKey)} className="relative z-10 flex-shrink-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all
                  ${isDone ? 'bg-emerald-500 text-white' : isCurrent ? `${c.bg} text-white ring-4 ${c.ring}` : 'bg-cream-100 text-navy-300'}`}>
                  {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                </div>
              </button>
              {/* المحتوى */}
              <div className="flex-1 pt-1">
                <button onClick={() => setInfoFor(sKey)} className="flex items-center gap-1.5 text-right">
                  <span className={`font-cairo font-bold ${isDone ? 'text-emerald-700' : isCurrent ? c.text : 'text-navy-400'}`}>
                    {idx + 1}. {meta.title}
                  </span>
                  {isCurrent && <span className={`text-[9px] font-cairo font-bold px-1.5 py-0.5 rounded-full ${c.bgSoft} ${c.text}`}>الآن</span>}
                  <Info className="w-3 h-3 text-navy-300" />
                </button>
                <p className="text-xs text-navy-500 font-cairo mt-0.5 leading-relaxed">{meta.whereYouAre}</p>
                {/* أحداث هذه المرحلة */}
                {stageEvents.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {stageEvents.map((ev, evIdx) => (
                      <div key={(ev?.id !== undefined && ev?.id !== null && !Number.isNaN(Number(ev.id))) ? `j-ev-${ev.id}-${evIdx}` : `j-ev-idx-${evIdx}`} className="flex items-center gap-1.5 text-[10px] font-cairo text-navy-400">
                        <span className="w-1 h-1 rounded-full bg-gold-400" />{ev.note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* بطاقة شرح المرحلة */}
      <AnimatePresence>
        {infoFor && (
          <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={() => setInfoFor(null)} />
            <StageInfo stage={infoFor} onClose={() => setInfoFor(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StageInfo({ stage, onClose }: { stage: JourneyState; onClose: () => void }) {
  const meta = STAGE_META[stage];
  const c = ACCENT_CLASSES[meta.accent];
  const Icon = meta.icon;
  const rows = [
    { label: 'أين أنت الآن', text: meta.whereYouAre, icon: '📍' },
    { label: 'ماذا تفعل', text: meta.whatToDo, icon: '✅' },
    { label: 'المرحلة التالية', text: meta.whatsNext, icon: '➡️' },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      className="relative w-full max-w-md bg-cream-50 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden" dir="rtl">
      <div className={`${c.bgSoft} border-b ${c.border} px-6 py-5 relative`}>
        <button onClick={onClose} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/70 flex items-center justify-center text-navy-600"><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl ${c.bg} flex items-center justify-center text-white`}><Icon className="w-6 h-6" /></div>
          <div>
            {meta.step > 0 && <span className="text-[11px] font-cairo font-bold text-navy-400">المرحلة {meta.step} من 6</span>}
            <h3 className={`font-cairo font-extrabold text-xl ${c.text}`}>{meta.title}</h3>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="bg-white rounded-2xl border border-cream-200 p-4">
            <div className="flex items-center gap-2 mb-1"><span>{r.icon}</span><span className="text-xs font-cairo font-extrabold text-navy-800">{r.label}</span></div>
            <p className="text-sm text-navy-600 font-cairo leading-relaxed pr-7">{r.text}</p>
          </div>
        ))}
        <button onClick={onClose} className={`w-full ${c.bg} text-white font-cairo font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2`}>
          فهمت <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ربط نوع الحدث بالمرحلة لعرضه في الخريطة العمودية
function mapEventToStage(type: string): JourneyState {
  switch (type) {
    case 'sent': return 'sent';
    case 'accept': return 'accepted';
    case 'inquiry_buy': return 'accepted';
    case 'pay_deposit': return 'seriousness';
    case 'coordination': return 'coordination';
    case 'sharia_viewing': return 'sharia_viewing';
    case 'completed': return 'completed';
    case 'decline': return 'declined';
    case 'cancel': return 'cancelled';
    default: return 'sent';
  }
}

// ============================================================
//  #7 معاينة المرحلة القادمة — يقلّل قلق المجهول
// ============================================================
function NextStepHint({ stage }: { stage: JourneyState }) {
  if (isTerminal(stage) || stage === 'completed') return null;
  const idx = STAGE_INDEX[stage as keyof typeof STAGE_INDEX];
  const nextKey = JOURNEY_STAGES[idx + 1];
  if (!nextKey) return null;
  const next = STAGE_META[nextKey];
  const c = ACCENT_CLASSES[next.accent];
  const NextIcon = next.icon;
  return (
    <div className="mt-3 bg-white rounded-2xl border border-cream-200 shadow-soft px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl ${c.bgSoft} flex items-center justify-center ${c.text} flex-shrink-0`}>
        <NextIcon className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-cairo font-bold text-navy-400">ماذا ينتظرني بعد ذلك؟</span>
        <p className="font-cairo font-bold text-sm text-navy-700 truncate">
          الخطوة القادمة: <span className={c.text}>{next.title}</span>
        </p>
      </div>
      <ChevronLeft className="w-4 h-4 text-navy-300 flex-shrink-0" />
    </div>
  );
}

// ============================================================
//  #11 حالة "بانتظار الطرف الآخر" — متحركة لطيفة
// ============================================================
function WaitingOther() {
  return (
          <div className="bg-gradient-to-br from-blue-50 to-cream-50 border border-blue-100 rounded-2xl p-5 text-center">
          <div className="relative w-14 h-14 mx-auto mb-3">
            <motion.span
              className="absolute inset-0 rounded-full bg-blue-200/50"
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.span
              className="absolute inset-0 rounded-full bg-blue-200/40"
              animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>
          <p className="font-cairo font-extrabold text-emerald-600">أكملت سدادك ✓</p>
          <p className="text-sm font-cairo text-navy-500 mt-1">بانتظار سداد الطرف الآخر لبدء التواصل</p>
          <p className="text-[11px] font-cairo text-blue-500 mt-2 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" /> سنُشعرك فور سداده
          </p>
        </div>
  );
}
