import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import supabase from '../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        setError(resetError.message);
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-cream-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-luxe border border-cream-200/60 p-8"
      >
        <Link to="/login" className="inline-flex items-center gap-2 text-navy-600 hover:text-gold-700 font-cairo font-semibold text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> العودة لتسجيل الدخول
        </Link>

        {sent ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <h1 className="font-cairo font-extrabold text-2xl text-navy-900">تم إرسال الرابط!</h1>
            <p className="mt-2 text-navy-600 font-tajawal leading-relaxed">
              تحقق من بريدك الإلكتروني <span className="font-bold">{email}</span> واتبع الرابط لإعادة تعيين كلمة المرور.
            </p>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gold-300/15 flex items-center justify-center mb-5">
              <ShieldCheck className="w-7 h-7 text-gold-700" />
            </div>
            <h1 className="font-cairo font-extrabold text-2xl text-navy-900">نسيت كلمة المرور؟</h1>
            <p className="mt-2 text-navy-600 font-tajawal">أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm font-tajawal">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-cairo font-semibold text-navy-800 mb-2">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full pr-12 pl-4 py-3.5 rounded-2xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 transition-colors text-right"
                    dir="ltr"
                  />
                </div>
              </div>
              <Button type="submit" fullWidth size="lg" disabled={loading}>{loading ? 'جارٍ الإرسال...' : 'إرسال رابط إعادة التعيين'}</Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
