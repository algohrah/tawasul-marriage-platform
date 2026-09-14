import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { subscribeToasts, dismissToastById, type ToastItem } from '../../lib/toastBus';

const config: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  error: { icon: XCircle, color: 'text-rose-deep', bg: 'bg-rose-50', border: 'border-rose-200' },
  info: { icon: Info, color: 'text-gold-600', bg: 'bg-gold-300/10', border: 'border-gold-300/30' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
};

const defaultConfig = { icon: Info, color: 'text-gold-600', bg: 'bg-gold-300/10', border: 'border-gold-300/30' };

/**
 * حاوية التوستات — تدير حالتها محلياً عبر ناقل التوستات.
 * أي رسالة جديدة تعيد رسم هذا المكون فقط وليس التطبيق كاملاً.
 */
export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const c = config[toast.type] || defaultConfig;
          const Icon = c.icon;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className={`pointer-events-auto ${c.bg} ${c.border} border rounded-3xl px-4 py-3 shadow-luxe flex items-center gap-3 backdrop-blur ring-luxe`}
            >
              <Icon className={`w-5 h-5 ${c.color} flex-shrink-0`} />
              <p className="flex-1 font-cairo font-semibold text-sm text-navy-800">{toast.message}</p>
              <button onClick={() => dismissToastById(toast.id)} className="text-navy-400 hover:text-navy-700">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
