import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, ArrowLeft, Check, CreditCard } from 'lucide-react';
import {
  JOURNEY_STAGES, STAGE_INDEX, STAGE_META, ACCENT_CLASSES,
  isTerminal, type JourneyState,
} from '../lib/journey';

// ============================================================
//  خط الرحلة الموحّد — Stepper أفقي واحد واضح
//  يُبرز المرحلة الحالية، المكتمل بعلامة ✓، القادم معتّم
//  + مؤشّر تقدّم بصري (نسبة مئوية)
//  + معلومات الدفع المدمجة (رسوم الجدية للمرسِل/المستقبِل)
// ============================================================

interface JourneyTimelineProps {
  stage: JourneyState;
  senderPaid?: boolean;
  receiverPaid?: boolean;
  isSender?: boolean;
}

export function JourneyTimeline({ stage, senderPaid, receiverPaid, isSender }: JourneyTimelineProps) {
  const [infoFor, setInfoFor] = useState<JourneyState | null>(null);

  // المسار الجانبي (مرفوض/ملغى) — شريط مختصر بدلاً من الخط الكامل
  if (isTerminal(stage)) {
    const meta = STAGE_META[stage];
    const c = ACCENT_CLASSES[meta.accent];
    const Icon = meta.icon;
    return (
      <>
        <div className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${c.bgSoft} border ${c.border}`} dir="rtl">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-full ${c.bg} flex items-center justify-center text-white flex-shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-sm font-cairo font-bold ${c.text}`}>{meta.title}</p>
              <p className="text-[11px] text-navy-500 font-cairo">{meta.badge}</p>
            </div>
          </div>
          <button
            onClick={() => setInfoFor(stage)}
            className={`w-8 h-8 rounded-full bg-white/70 hover:bg-white flex items-center justify-center ${c.text} transition-colors`}
            aria-label="معلومات"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
        <StageInfoModal stage={infoFor} onClose={() => setInfoFor(null)} />
      </>
    );
  }

  const currentIdx = STAGE_INDEX[stage as keyof typeof STAGE_INDEX];
  const progressPct = Math.round((currentIdx / (JOURNEY_STAGES.length - 1)) * 100);

  // هل نعرض معلومات الدفع؟ (فقط في مراحل الجدية والتنسيق)
  const showPayment =
    senderPaid !== undefined && receiverPaid !== undefined &&
    (stage === 'accepted' || stage === 'seriousness' || stage === 'coordination');

  return (
    <>
      <div className="rounded-2xl bg-white border border-cream-200 px-3 py-4 sm:px-4 shadow-soft" dir="rtl">
        {/* شريط التقدّم العلوي */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-cairo font-bold text-navy-400">
            المرحلة {currentIdx + 1} من {JOURNEY_STAGES.length}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1.5 bg-cream-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gold-gradient rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] font-cairo font-extrabold text-gold-600">{progressPct}%</span>
          </div>
        </div>

        {/* الدوائر والخطوط */}
        <div className="flex items-start">
          {JOURNEY_STAGES.map((sKey, idx) => {
            const meta = STAGE_META[sKey];
            const c = ACCENT_CLASSES[meta.accent];
            const isDone = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const Icon = meta.icon;

            return (
              <div key={sKey} className="flex items-start flex-1 last:flex-none min-w-0">
                {/* الدائرة + التسمية */}
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <motion.button
                    onClick={() => setInfoFor(sKey)}
                    whileTap={{ scale: 0.9 }}
                    className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all
                      ${isDone ? 'bg-emerald-500 text-white' : ''}
                      ${isCurrent ? `${c.bg} text-white ring-4 ${c.ring}` : ''}
                      ${!isDone && !isCurrent ? 'bg-cream-100 text-navy-300' : ''}`}
                    aria-label={meta.title}
                  >
                    {isDone ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icon className="w-4 h-4 sm:w-5 sm:h-5" />}
                    {isCurrent && (
                      <motion.span
                        className={`absolute -inset-1 rounded-full ${c.bg} opacity-20`}
                        animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0, 0.2] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </motion.button>
                  <span className={`text-[9px] sm:text-[10px] font-cairo font-bold text-center leading-tight max-w-[52px]
                    ${isDone ? 'text-emerald-700' : isCurrent ? c.text : 'text-navy-300'}`}>
                    {meta.title}
                  </span>
                </div>
                {/* الخط الواصل */}
                {idx < JOURNEY_STAGES.length - 1 && (
                  <div className="flex-1 h-9 sm:h-10 flex items-center px-0.5 sm:px-1 min-w-[8px]">
                    <div className="w-full h-1 rounded-full bg-cream-200 overflow-hidden">
                      <motion.div
                        className="h-full bg-emerald-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: idx < currentIdx ? '100%' : '0%' }}
                        transition={{ duration: 0.5, delay: idx * 0.08 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* معلومات الدفع المدمجة */}
        {showPayment && (
          <div className="mt-3 pt-3 border-t border-cream-100 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <div className="flex-1 flex items-center gap-2">
              <PaymentBadge label="المرسِل" paid={senderPaid!} />
              <PaymentBadge label="المستقبِل" paid={receiverPaid!} />
            </div>
            {senderPaid && receiverPaid && (
              <span className="text-[10px] font-cairo font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                ✓ أكّد الطرفان
              </span>
            )}
          </div>
        )}
      </div>
      <StageInfoModal stage={infoFor} onClose={() => setInfoFor(null)} />
    </>
  );
}

// شارة حالة الدفع المصغّرة
function PaymentBadge({ label, paid }: { label: string; paid: boolean }) {
  return (
    <div className={`flex-1 rounded-lg px-2 py-1 text-center border ${paid ? 'bg-emerald-50 border-emerald-200' : 'bg-cream-50 border-cream-200'}`}>
      <span className="text-[10px] font-cairo text-navy-400 block">{label}</span>
      <span className={`text-[11px] font-cairo font-bold ${paid ? 'text-emerald-600' : 'text-navy-400'}`}>
        {paid ? '✓ مدفوع' : 'بانتظار'}
      </span>
    </div>
  );
}

// ============================================================
//  البطاقة المنبثقة لشرح المرحلة — أين أنت / ماذا تفعل / ما التالي
// ============================================================

export function StageInfoModal({ stage, onClose }: { stage: JourneyState | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {stage && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose}
          />
          <StageInfoCard stage={stage} onClose={onClose} />
        </div>
      )}
    </AnimatePresence>
  );
}

function StageInfoCard({ stage, onClose }: { stage: JourneyState; onClose: () => void }) {
  const meta = STAGE_META[stage];
  const c = ACCENT_CLASSES[meta.accent];
  const Icon = meta.icon;

  const rows = [
    { label: 'أين أنت الآن', text: meta.whereYouAre, icon: '📍' },
    { label: 'ماذا تفعل', text: meta.whatToDo, icon: '✅' },
    { label: 'المرحلة التالية', text: meta.whatsNext, icon: '➡️' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.98 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="relative w-full max-w-md bg-cream-50 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
      dir="rtl"
    >
      {/* الترويسة */}
      <div className={`${c.bgSoft} border-b ${c.border} px-6 py-5 rounded-t-3xl relative`}>
        <button onClick={onClose} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-navy-600 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl ${c.bg} flex items-center justify-center text-white flex-shrink-0`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            {meta.step > 0 && (
              <span className="text-[11px] font-cairo font-bold text-navy-400">المرحلة {meta.step} من 6</span>
            )}
            <h3 className={`font-cairo font-extrabold text-xl ${c.text}`}>{meta.title}</h3>
          </div>
        </div>
      </div>
      {/* المحتوى */}
      <div className="p-6 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="bg-white rounded-2xl border border-cream-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{r.icon}</span>
              <span className="text-xs font-cairo font-extrabold text-navy-800">{r.label}</span>
            </div>
            <p className="text-sm text-navy-600 font-cairo leading-relaxed pr-7">{r.text}</p>
          </div>
        ))}
      </div>
      <div className="px-6 pb-6">
        <button
          onClick={onClose}
          className={`w-full ${c.bg} text-white font-cairo font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:brightness-105 transition-all`}
        >
          فهمت <ArrowLeft className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
