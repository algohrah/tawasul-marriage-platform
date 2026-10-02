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
  markRequestNotificationsRead, getCurrentUserId, buyMessagePackageCustom,
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
    if (!currentUserId || !Number.isFinite(rid) || rid <= 0) {
      setReq(null);
      setLoading(false);
      return;
    }
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
                يمكنك إلغاء هذا الطلب في أي مرحلة مع ذكر السبب. العربون غير مسترد بعد السداد.
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
        {/* مشاركة اختيارية وصريحة — لا تُقرأ أي بيانات من ملف الحساب */}
        <ContactExchange req={req} self={self} busy={busy} runAction={runAction} showToast={showToast} />

        {!!req.guardian_phone && !!req.male_phone && (
          <div className="mt-4 rounded-3xl border border-indigo-200 bg-indigo-50/60 p-4 text-center">
            {(isSender ? req.sender_stage_confirmed : req.receiver_stage_confirmed) ? (
              <>
                <Check className="mx-auto h-7 w-7 text-indigo-600" />
                <p className="mt-2 font-cairo text-sm font-extrabold text-indigo-900">تم تسجيل تأكيدك</p>
                <p className="mt-1 font-cairo text-xs leading-6 text-indigo-700">
                  بانتظار تأكيد الطرف الآخر. لن تنتقل الرحلة قبل موافقة الطرفين.
                </p>
              </>
            ) : (
              <>
                <p className="font-cairo text-sm font-extrabold text-indigo-950">هل أنتما مستعدان لتسجيل نتيجة النظرة الشرعية؟</p>
                <p className="mt-1 font-cairo text-xs leading-6 text-indigo-700">
                  سيُحفظ تأكيدك أولًا، وتنتقل الرحلة فقط بعد تأكيد الطرف الآخر.
                </p>
                <button onClick={() => runAction('confirm_advance', { nextStage: 'sharia_viewing' })} disabled={busy}
                  className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 font-cairo text-sm font-extrabold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
                  تأكيد الاستعداد من جانبي
                </button>
              </>
            )}
          </div>
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
  const { user } = useApp();
  const currentUserId = user?.memberId || getCurrentUserId();
  const isSender = String(req.sender_id) === String(currentUserId);
  const selfPaid = isSender ? !!req.sender_final_paid : !!req.receiver_final_paid;
  const otherPaid = isSender ? !!req.receiver_final_paid : !!req.sender_final_paid;
  const [mahrConfirmed, setMahrConfirmed] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const openPayment = () => {
    if (!mahrConfirmed) {
      showToast('أكد تسليم المهر أولًا قبل سداد المبلغ المتبقي', 'error');
      return;
    }
    setPayOpen(true);
  };

  const completeFinalPayment = async (): Promise<boolean> => {
    const ok = await runAction('pay_final_fee', { mahrConfirmed: true });
    if (ok) showToast(otherPaid ? 'اكتمل سداد الطرفين بفضل الله' : 'تم سداد المبلغ المتبقي، وبانتظار الطرف الآخر');
    return !!ok;
  };

  return (
    <HeroCard meta={meta} c={c} Icon={Icon}>
      <p className="mb-4 font-cairo text-sm leading-7 text-navy-600">{meta.whereYouAre}</p>

      <div className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
        <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-amber-300/15" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gold-gradient shadow-sm">
            <Gem className="h-5 w-5 text-amber-900" />
          </div>
          <div>
            <h4 className="font-cairo text-sm font-extrabold text-navy-900">المتبقي من أتعاب المنصة لكل طرف</h4>
            <p className="mt-1 font-cairo text-xs leading-5 text-navy-500">يستحق بعد نتيجة النظرة الشرعية وتسليم المهر.</p>
          </div>
        </div>
        <div className="relative mt-5 text-center">
          <p className="font-mono text-4xl font-black text-amber-700">{settings.final_fee_amount || 2000}</p>
          <p className="font-cairo text-xs font-bold text-amber-800">ريال لكل طرف</p>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <PaymentState label="دفعت أنت" done={selfPaid} />
          <PaymentState label="دفع الطرف الآخر" done={otherPaid} />
        </div>
      </div>

      {selfPaid ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <Check className="mx-auto h-7 w-7 text-emerald-600" />
          <p className="mt-2 font-cairo text-sm font-extrabold text-emerald-800">تم سداد المبلغ المتبقي من طرفك</p>
          <p className="mt-1 font-cairo text-xs leading-6 text-emerald-700">
            {otherPaid ? 'اكتمل سداد الطرفين، ويتم إكمال الرحلة الآن.' : 'بانتظار سداد الطرف الآخر. سنُخطرك فور اكتمال الرحلة.'}
          </p>
        </div>
      ) : (
        <>
          <label className="mt-4 flex cursor-pointer select-none items-start gap-3 rounded-2xl border border-cream-200 bg-cream-50/70 p-4">
            <input type="checkbox" checked={mahrConfirmed} onChange={(event) => setMahrConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-amber-600" />
            <span className="font-cairo text-xs font-bold leading-6 text-navy-700">
              أؤكد أن المهر تم تسليمه، وأرغب في سداد المتبقي من أتعاب المنصة من جانبي.
            </span>
          </label>
          <button onClick={openPayment} disabled={!mahrConfirmed || busy}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold-gradient px-4 font-cairo text-sm font-extrabold text-navy-900 shadow-gold transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gem className="h-5 w-5 text-amber-800" />}
            سداد المتبقي من جانبي
          </button>
        </>
      )}

      <PaymentGateway
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={settings.final_fee_amount || 2000}
        title="المتبقي من أتعاب رحلة التوافق"
        description="يُسدّد بعد تسليم المهر — لكل طرف بصورة مستقلة"
        lineItems={[
          { label: 'المرحلة', value: 'بعد نتيجة النظرة الشرعية وتسليم المهر' },
          { label: 'المبلغ', value: `${settings.final_fee_amount || 2000} ريال لهذا الطرف` },
        ]}
        payLabel="سداد المبلغ المتبقي"
        onPaid={completeFinalPayment}
        requestId={req.id}
        requiresOfflineReview
        applyVat={false}
        metadata={{ paymentStage: 'final_fee', mahrConfirmed: true }}
      />
    </HeroCard>
  );
}

function PaymentState({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 text-center ${done ? 'border-emerald-200 bg-emerald-50' : 'border-cream-200 bg-white'}`}>
      <span className={`font-cairo text-xs font-extrabold ${done ? 'text-emerald-700' : 'text-navy-500'}`}>
        {done ? 'تم السداد' : 'بانتظار السداد'}
      </span>
      <p className="mt-0.5 font-cairo text-[10px] text-navy-400">{label}</p>
    </div>
  );
}

// ============================================================
//  مشاركة معلومات التواصل — لا يظهر إلا ما يكتبه العضو ويرسله بنفسه
// ============================================================

function ContactExchange({ req, self, busy, runAction, showToast }: any) {
  const isFemale = self?.gender === 'female';
  const ownSubmitted = isFemale ? !!req.guardian_phone : !!req.male_phone;
  const otherSubmitted = isFemale ? !!req.male_phone : !!req.guardian_phone;

  const [phone, setPhone] = useState(isFemale ? (req.guardian_phone || '') : (req.male_phone || ''));
  const [name, setName] = useState(isFemale ? (req.guardian_name || '') : (req.male_name || ''));
  const [relation, setRelation] = useState(isFemale ? (req.guardian_relation || '') : (req.male_relation || ''));
  const [contactTime, setContactTime] = useState(isFemale ? (req.contact_time || '') : (req.male_contact_time || ''));
  const [note, setNote] = useState(isFemale ? (req.contact_note || '') : (req.male_contact_note || ''));
  const [confirmed, setConfirmed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('تعذر التواصل مع الطرف الآخر');

  const submit = async () => {
    if (!phone.trim()) {
      showToast(isFemale ? 'اكتب رقم ولي الأمر أو رقم التواصل الذي اخترت مشاركته' : 'اكتب رقم التواصل الذي اخترت مشاركته', 'error');
      return;
    }
    if (!confirmed) {
      showToast('يرجى تأكيد أنك اخترت مشاركة هذه المعلومات بنفسك', 'error');
      return;
    }
    const payload = isFemale
      ? {
          guardianPhone: phone.trim(), guardianName: name.trim(), guardianRelation: relation.trim(),
          contactTime: contactTime.trim(), contactNote: note.trim(),
        }
      : {
          malePhone: phone.trim(), maleName: name.trim(), maleRelation: relation.trim(),
          maleContactTime: contactTime.trim(), maleContactNote: note.trim(),
        };
    const ok = await runAction('submit_contact', payload);
    if (ok) showToast('تم إرسال معلومات التواصل التي كتبتها للطرف الآخر', 'success');
  };

  const otherContact = isFemale
    ? {
        phone: req.male_phone,
        name: req.male_name,
        relation: req.male_relation,
        time: req.male_contact_time,
        note: req.male_contact_note,
      }
    : {
        phone: req.guardian_phone,
        name: req.guardian_name,
        relation: req.guardian_relation,
        time: req.contact_time,
        note: req.contact_note,
      };

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-right">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700" />
          <div>
            <p className="font-cairo text-sm font-extrabold text-blue-950">خصوصيتك بقرارك</p>
            <p className="mt-1 font-cairo text-xs leading-6 text-blue-800">
              لا نعرض رقم هاتفك أو بريدك المحفوظ في الحساب. لن يرى الطرف الآخر إلا المعلومات التي تكتبها هنا ثم تضغط «إرسال معلومات التواصل».
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-cream-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-cream-100 pb-3">
          <div>
            <h3 className="font-cairo text-sm font-extrabold text-navy-900">معلومات التواصل التي سأشاركها</h3>
            <p className="mt-1 font-cairo text-[11px] leading-5 text-navy-500">
              {isFemale ? 'يمكنك مشاركة رقم ولي الأمر أو وسيلة التواصل المناسبة لك.' : 'اكتب وسيلة التواصل التي تريد إظهارها للطرف الآخر.'}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 font-cairo text-[10px] font-bold ${ownSubmitted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {ownSubmitted ? 'تم الإرسال' : 'مطلوب منك'}
          </span>
        </div>

        {ownSubmitted ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="font-cairo text-xs font-extrabold text-emerald-800">تمت مشاركة المعلومات التالية باختيارك</p>
            <div className="mt-3 space-y-1.5 break-words font-cairo text-xs text-navy-700">
              <p><strong>رقم التواصل:</strong> {phone}</p>
              {name && <p><strong>الاسم:</strong> {name}</p>}
              {relation && <p><strong>الصفة أو صلة القرابة:</strong> {relation}</p>}
              {contactTime && <p><strong>الوقت المناسب:</strong> {contactTime}</p>}
              {note && <p><strong>ملاحظة:</strong> {note}</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block font-cairo text-xs font-bold text-navy-700">
                {isFemale ? 'رقم ولي الأمر أو رقم التواصل' : 'رقم التواصل'} <span className="text-rose-500">*</span>
              </label>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="off"
                placeholder="اكتب الرقم الذي اخترت مشاركته"
                className="min-h-12 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 font-cairo text-sm text-navy-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-cairo text-xs font-bold text-navy-700">اسم شخص التواصل (اختياري)</label>
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" placeholder="الاسم الذي تريد إظهاره"
                  className="min-h-12 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 font-cairo text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1.5 block font-cairo text-xs font-bold text-navy-700">الصفة أو صلة القرابة (اختياري)</label>
                <input value={relation} onChange={(event) => setRelation(event.target.value)} autoComplete="off" placeholder="مثال: ولي الأمر، صاحب الرقم"
                  className="min-h-12 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 font-cairo text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block font-cairo text-xs font-bold text-navy-700">الوقت المناسب للتواصل (اختياري)</label>
              <input value={contactTime} onChange={(event) => setContactTime(event.target.value)} autoComplete="off" placeholder="مثال: من ٥ إلى ٩ مساءً"
                className="min-h-12 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 font-cairo text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label className="mb-1.5 block font-cairo text-xs font-bold text-navy-700">ملاحظة للطرف الآخر (اختياري)</label>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="اكتب تعليمات قصيرة وواضحة للتواصل"
                className="w-full resize-none rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 font-cairo text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-amber-600" />
              <span className="font-cairo text-xs leading-6 text-navy-700">
                راجعت المعلومات وأفهم أنها ستظهر للطرف الآخر في طلب التوافق بعد الضغط على الإرسال.
              </span>
            </label>
            <button onClick={submit} disabled={busy || !phone.trim() || !confirmed}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 font-cairo text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
              إرسال معلومات التواصل
            </button>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-cream-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-cairo text-sm font-extrabold text-navy-900">معلومات الطرف الآخر</h3>
          <span className={`rounded-full px-2.5 py-1 font-cairo text-[10px] font-bold ${otherSubmitted ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {otherSubmitted ? 'تمت المشاركة' : 'بانتظار الإرسال'}
          </span>
        </div>
        {otherSubmitted ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="font-cairo text-[11px] leading-5 text-emerald-800">كتب الطرف الآخر هذه المعلومات وأرسلها لك باختياره:</p>
            <div className="mt-3 space-y-2 break-words font-cairo text-xs text-navy-800">
              <p><strong>رقم التواصل:</strong> <a href={`tel:${otherContact.phone}`} className="font-extrabold text-blue-700 underline">{otherContact.phone}</a></p>
              {otherContact.name && <p><strong>الاسم:</strong> {otherContact.name}</p>}
              {otherContact.relation && <p><strong>الصفة أو صلة القرابة:</strong> {otherContact.relation}</p>}
              {otherContact.time && <p><strong>الوقت المناسب:</strong> {otherContact.time}</p>}
              {otherContact.note && <p><strong>ملاحظة:</strong> {otherContact.note}</p>}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-cream-300 bg-cream-50 p-5 text-center">
            <Clock className="mx-auto h-6 w-6 text-navy-300" />
            <p className="mt-2 font-cairo text-xs font-bold text-navy-600">بانتظار الطرف الآخر ليكتب معلوماته ويضغط إرسال</p>
            <p className="mt-1 font-cairo text-[11px] text-navy-400">لن تعرض المنصة أي بيانات محفوظة في حسابه تلقائيًا.</p>
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3 text-center">
        <p className="font-cairo text-[11px] leading-5 text-navy-500">إذا كانت المعلومات غير صحيحة أو تعذر التواصل، أخبر إدارة الموقع.</p>
        <button onClick={() => setReportOpen(true)} className="mt-2 min-h-11 rounded-xl border border-rose-200 px-4 font-cairo text-xs font-bold text-rose-700 hover:bg-rose-50">
          إبلاغ الإدارة للمساعدة
        </button>
      </div>

      <DialogShell open={reportOpen} onClose={() => setReportOpen(false)} title="إبلاغ إدارة الموقع">
        <p className="mb-3 font-cairo text-xs leading-6 text-navy-600">اكتب سببًا مختصرًا ليساعد فريق الإدارة على متابعة المشكلة.</p>
        <textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)} rows={4}
          className="w-full resize-none rounded-xl border border-cream-200 bg-white p-3 font-cairo text-sm outline-none focus:border-rose-300" />
        <button disabled={busy || !reportReason.trim()} onClick={async () => {
          const ok = await runAction('report_contact_issue', { reason: reportReason.trim() });
          if (ok) { showToast('تم إرسال البلاغ إلى إدارة الموقع', 'success'); setReportOpen(false); }
        }} className="mt-3 min-h-12 w-full rounded-xl bg-navy-900 font-cairo text-sm font-bold text-white disabled:opacity-50">
          إرسال البلاغ
        </button>
      </DialogShell>
    </div>
  );
}

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
//  مركز "مقبول" — الاستفسار + العربون في صفحة واحدة
// ============================================================
// ============================================================
//  مركز "مقبول" — الاستفسار + العربون في صفحة واحدة
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
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-current" /> سداد العربون</span>
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
          تخطّي الاستفسار وسداد العربون ←
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
            <p className="text-xs font-cairo text-navy-500 leading-relaxed">يمكنك شراء باقة جديدة أو الانتقال لسداد العربون وتبادل التواصل.</p>
          </div>
          <button onClick={handleBuy} disabled={buying}
            className="w-full bg-amber-500 text-white font-cairo font-extrabold py-3.5 rounded-2xl hover:brightness-105 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm">
            {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-5 h-5" />}
            شراء باقة رسائل للمتابعة ({pkgPrice} ريال / {pkgCredits} رسالة)
          </button>
        </div>
      )}

      {/* الانتقال لالعربون */}
      <button onClick={onProceedDeposit}
        className="w-full mt-4 bg-gold-gradient text-navy-900 font-cairo font-extrabold py-3.5 rounded-2xl shadow-gold hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
        <ShieldCheck className="w-5 h-5" /> انتهيت — سداد العربون
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
//  لوحة العربون (داخل مركز مقبول)
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
    setPayOpen(true);
  };

  // يُنفّذ فعلياً بعد نجاح الدفع
  const completeDeposit = async (): Promise<boolean> => {
    const ok = await runAction('pay_deposit');
    if (ok) showToast('تم سداد العربون من طرفك بنجاح');
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
            <p className="text-xs font-cairo font-extrabold text-emerald-800">الطرف الآخر سدّد العربون!</p>
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
          {/* قيمة العربون واضحة قبل الانتقال إلى الدفع */}
          <div className="relative overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 shadow-sm sm:p-6">
            <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-amber-500/5" />
            <div className="relative z-10 text-center">
              <ShieldCheck className="mx-auto mb-2 h-11 w-11 text-amber-600" />
              <p className="font-cairo text-3xl font-black text-amber-700">{settings.deposit_amount || 500} <span className="text-base font-bold">ريال</span></p>
              <p className="mt-1.5 font-cairo text-xs font-bold text-navy-700">عربون المنصة لكل طرف في طلب التوافق</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 font-cairo text-[10px] font-extrabold text-rose-700">
                العربون غير مسترد بعد السداد
              </div>
            </div>
            <div className="relative mt-5 space-y-2 border-t border-amber-200/60 pt-4 font-cairo text-xs leading-6 text-navy-700">
              <p><strong>مقابل:</strong> خدمات المنصة وجهود التنسيق لهذا الطلب.</p>
              <p><strong>بعد سداد الطرفين:</strong> يمكن لكل طرف مشاركة معلومات التواصل التي يختارها بنفسه.</p>
              <p><strong>إجمالي أتعاب كل طرف:</strong> ٢٥٠٠ ريال؛ المتبقي ٢٠٠٠ ريال بعد نتيجة النظرة الشرعية وتسليم المهر.</p>
            </div>
          </div>

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
                  <span>⏳</span> مهلة سداد العربون: متبقي {deadlineDiffDays} أيام
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
              سداد العربون
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
      <DialogShell open={deferOpen} onClose={() => setDeferOpen(false)} title="تأجيل سداد العربون">
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
              💰 العربون المطلوبة: {settings?.deposit_amount || 500} ريال سعودي (أو ما يعادله)
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

      {/* بوابة دفع العربون — المدفوعات اليدوية (بنكي/عملات رقمية) تمر عبر مراجعة إدارية قبل التفعيل */}
      <PaymentGateway
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={settings.deposit_amount || 500}
        title="العربون"
        description="سداد لمرة واحدة — يتيح تبادل التواصل"
        lineItems={[
          { label: 'نوع الرسوم', value: 'العربون' },
          { label: 'السداد', value: 'مرة واحدة لهذا الطرف في الطلب' },
        ]}
        payLabel="سداد العربون"
        onPaid={completeDeposit}
        requestId={req.id}
        requiresOfflineReview
        applyVat={false}
        metadata={{ paymentStage: 'deposit' }}
      />
    </div>
  );
}

// لوحة العربون المستقلة (لمرحلة seriousness)
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
            <span className="font-cairo font-extrabold text-xs text-emerald-700 block">تم القبول بفضل الله</span>
          </button>
          <button onClick={() => setChoice('failed')}
            className={`p-4 rounded-2xl border-2 text-center transition-all ${choice === 'failed' ? 'border-amber-400 bg-amber-50/50' : 'border-cream-200 bg-white'}`}>
            <span className="text-2xl block mb-1">🕊️</span>
            <span className="font-cairo font-extrabold text-xs text-amber-800 block">لم يُكتب النصيب</span>
          </button>
        </div>

        {choice === 'success' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 mb-3 text-right space-y-1.5 shadow-sm animate-fade-in">
            <p className="text-xs font-cairo font-extrabold text-emerald-800">تم القبول بفضل الله</p>
            <p className="text-[11px] font-cairo text-navy-600 leading-relaxed">
              الحمد لله الذي بنعمته تتم الصالحات. نسأل الله أن يبارك لكما ويتمم على خير.
            </p>
          </div>
        )}

        {choice === 'failed' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3 text-right text-[11px] font-cairo text-amber-800 leading-relaxed shadow-sm">
            <strong>لم يُكتب النصيب:</strong> الزواج قسمة ونصيب، وسيُنهي اختيارك الرحلة باحترام وخصوصية.
          </div>
        )}

        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder={choice === 'failed' ? 'اكتب رسالة اعتذار لطيفة للطرف الآخر (إلزامي)' : 'ملاحظة اختيارية'}
          className="w-full bg-white border border-cream-200 rounded-xl p-3 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-gold-200" />
        {choice === 'failed' && !note.trim() && (
          <p className="text-[11px] text-rose-500 font-cairo mt-1">يرجى كتابة رسالة الاعتذار بلطف لإرسالها للطرف الآخر.</p>
        )}
        <button
          disabled={choice === 'failed' && !note.trim()}
          onClick={async () => { await runAction('record_result', { result: choice, note }); setOpen(false); }}
          className="w-full mt-4 bg-navy-900 text-white font-cairo font-bold py-3.5 rounded-2xl disabled:opacity-50 hover:bg-navy-800 transition-colors">
          {choice === 'success' ? 'تأكيد: تم القبول بفضل الله' : 'تأكيد: لم يُكتب النصيب'}
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
