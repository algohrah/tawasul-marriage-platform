import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`relative w-full ${sizes[size]} bg-cream-50 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto`}
          >
            {title && (
              <div className="sticky top-0 glass z-10 flex items-center justify-between px-6 py-4 border-b border-cream-200 rounded-t-3xl">
                <h3 className="font-cairo font-bold text-lg text-navy-900">{title}</h3>
                <button onClick={onClose} className="w-9 h-9 rounded-full bg-cream-100 hover:bg-cream-200 flex items-center justify-center text-navy-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
