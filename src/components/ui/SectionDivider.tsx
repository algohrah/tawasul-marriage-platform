import { motion } from 'framer-motion';

/**
 * خط فاصل زخرفي ذهبي مع نقطة في المنتصف.
 * يُستخدم بين الأقسام لإضافة فاصل بصري أنيق.
 */
export default function SectionDivider() {
  return (
    <div className="flex items-center justify-center py-6">
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="flex items-center gap-3"
      >
        <div className="h-px w-16 sm:w-24 bg-gradient-to-l from-gold-500/60 to-transparent" />
        <div className="w-2 h-2 rotate-45 bg-gold-gradient rounded-sm" />
        <div className="h-px w-16 sm:w-24 bg-gradient-to-r from-gold-500/60 to-transparent" />
      </motion.div>
    </div>
  );
}
