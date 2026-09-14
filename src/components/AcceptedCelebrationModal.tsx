import { motion, AnimatePresence } from 'framer-motion';
import { HeartHandshake, ShieldCheck, Sparkles, MessageSquare, ChevronLeft } from 'lucide-react';
import { INQUIRY_PACKAGE_PRICE, DEPOSIT_AMOUNT } from '../lib/journey';

// ============================================================
//  بطاقة احتفالية تظهر فور الضغط على «قبول»
//  خياران واضحان: سداد رسوم الجدية / استفسار أولاً
// ============================================================

interface Props {
  open: boolean;
  memberName: string;
  onClose: () => void;
  onProceed: () => void;       // سداد رسوم الجدية
  onInquiry: () => void;       // فتح غرفة الاستفسار
  onOpenJourney: () => void;   // فتح الرحلة الكاملة (اختياري)
}

export default function AcceptedCelebrationModal({
  open, memberName, onClose, onProceed, onInquiry,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[96] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className="relative w-full max-w-md bg-cream-50 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
            dir="rtl"
          >
            {/* رأس احتفالي */}
            <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 pt-8 pb-9 text-center overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute text-white/40"
                  style={{ left: `${12 + i * 14}%`, top: `${10 + (i % 3) * 22}%` }}
                  animate={{ y: [0, -10, 0], opacity: [0.2, 0.6, 0.2], rotate: [0, 20, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3 }}
                >
                  <Sparkles className="w-4 h-4" />
                </motion.div>
              ))}
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.15, damping: 12 }}
                className="w-18 h-18 mx-auto rounded-full bg-white flex items-center justify-center shadow-lg mb-3 p-4"
              >
                <HeartHandshake className="w-9 h-9 text-emerald-600" />
              </motion.div>
              <h3 className="font-cairo font-extrabold text-2xl text-white">🎉 تم القبول!</h3>
              <p className="text-emerald-50 font-cairo text-sm mt-1">
                <strong className="text-white">{memberName}</strong> قبِل طلب التوافق للزواج معك
              </p>
            </div>

            {/* خياران واضحان */}
            <div className="p-5">
              <p className="text-center text-[11px] font-cairo font-bold text-navy-400 mb-3">
                ما هي خطوتك التالية؟
              </p>

              {/* الخيار الأساسي: سداد رسوم الجدية */}
              <button
                onClick={onProceed}
                className="w-full bg-gold-gradient rounded-2xl p-4 flex items-center gap-3 transition-all hover:-translate-y-0.5 shadow-gold text-right"
              >
                <div className="w-12 h-12 rounded-2xl bg-navy-900/15 flex items-center justify-center text-navy-900 flex-shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-cairo font-extrabold text-navy-900">سداد رسوم تأكيد الجدية</h4>
                  <p className="text-xs text-navy-800/70 font-cairo">{DEPOSIT_AMOUNT} ريال (تُسترد عند عدم التوافق) — الطريق المباشر لتبادل الأرقام</p>
                </div>
                <ChevronLeft className="w-5 h-5 text-navy-900/60 flex-shrink-0" />
              </button>

              {/* الخيار الثانوي: استفسار أولاً */}
              <button
                onClick={onInquiry}
                className="w-full mt-2.5 bg-white border-2 border-amber-200 hover:border-amber-300 rounded-2xl p-4 flex items-center gap-3 transition-all hover:-translate-y-0.5 shadow-soft text-right"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white flex-shrink-0">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-cairo font-extrabold text-navy-800">استفسار أولاً</h4>
                  <p className="text-xs text-navy-500 font-cairo">تعرّف أكثر عبر المحادثة قبل الدفع · {INQUIRY_PACKAGE_PRICE} ريال</p>
                </div>
                <ChevronLeft className="w-5 h-5 text-amber-400 flex-shrink-0" />
              </button>

              <button
                onClick={onClose}
                className="w-full mt-3 text-navy-400 font-cairo font-bold py-1.5 text-xs hover:text-navy-600 transition-colors"
              >
                لاحقاً — أبقَ في قائمة طلباتي
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
