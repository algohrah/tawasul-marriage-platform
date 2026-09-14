import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import supabase from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  // رابط إعادة تعيين كلمة المرور من البريد ينشئ جلسة مؤقتة تلقائياً عبر Supabase عند تحميل الصفحة
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (password !== confirmPassword) { setError('كلمتا المرور غير متطابقتين'); return; }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        setDone(true);
        setTimeout(() => navigate('/login'), 2500);
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
        {done ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <h1 className="font-cairo font-extrabold text-2xl text-navy-900">تم تحديث كلمة المرور!</h1>
            <p className="mt-2 text-navy-600 font-tajawal">جارٍ تحويلك لصفحة تسجيل الدخول...</p>
          </div>
        ) : !ready ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-9 h-9 text-rose-500" />
            </div>
            <h1 className="font-cairo font-extrabold text-xl text-navy-900">الرابط غير صالح أو منتهي</h1>
            <p className="mt-2 text-navy-600 font-tajawal">يرجى طلب رابط إعادة تعيين جديد.</p>
            <Link to="/forgot-password" className="inline-block mt-5 font-cairo font-bold text-gold-700 hover:underline">طلب رابط جديد</Link>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gold-300/15 flex items-center justify-center mb-5">
              <ShieldCheck className="w-7 h-7 text-gold-700" />
            </div>
            <h1 className="font-cairo font-extrabold text-2xl text-navy-900">تعيين كلمة مرور جديدة</h1>
            <p className="mt-2 text-navy-600 font-tajawal">اختر كلمة مرور قوية وآمنة لحسابك.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm font-tajawal">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-cairo font-semibold text-navy-800 mb-2">كلمة المرور الجديدة</label>
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-12 pl-12 py-3.5 rounded-2xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 transition-colors text-right"
                    dir="ltr"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700">
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-cairo font-semibold text-navy-800 mb-2">تأكيد كلمة المرور</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 rounded-2xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-navy-900 transition-colors text-right"
                  dir="ltr"
                />
              </div>
              <Button type="submit" fullWidth size="lg" disabled={loading}>{loading ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور الجديدة'}</Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
