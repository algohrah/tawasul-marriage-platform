import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useApp } from '../lib/AppContext';
import supabase from '../lib/supabase';
import { DEMO_ADMIN, isDemoAdminCredentials, startOwnerAdminSession } from '../config/access';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithSession, showToast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const from = (location.state as { from?: string })?.from || '/profile';

  const loginAsOwnerAdmin = () => {
    startOwnerAdminSession();
    showToast('تم تسجيل الدخول بحساب المدير العام التجريبي', 'success');
    navigate('/admin');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (isDemoAdminCredentials(cleanEmail, password)) {
      loginAsOwnerAdmin();
      return;
    }

    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signInError) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
        return;
      }

      const sessionUser = data?.user || data?.session?.user;
      loginWithSession({
        id: sessionUser?.id || `member-${Date.now()}`,
        nickname: sessionUser?.email?.split('@')[0] || 'عضو',
        email: sessionUser?.email || cleanEmail,
        gender: 'male',
        maritalStatus: 'single',
        country: 'السعودية',
        city: 'الرياض',
        plan: 'free',
        verified: false,
      } as any, sessionUser?.email || cleanEmail);
      navigate(from);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] grid lg:grid-cols-2" dir="rtl">
      <div className="hidden lg:flex bg-navy-gradient items-center justify-center p-12">
        <div className="max-w-md text-center">
          <ShieldCheck className="w-20 h-20 text-gold-300 mx-auto mb-6" />
          <h2 className="font-cairo font-extrabold text-3xl text-white">مرحباً بعودتك إلى توافق</h2>
          <p className="mt-4 text-cream-200/80 font-tajawal">سجّل الدخول لمتابعة حسابك وتعديل ملفك الشخصي.</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-cream-50">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-navy-600 hover:text-gold-700 font-cairo font-semibold text-sm mb-8">
            <ArrowLeft className="w-4 h-4" /> العودة للرئيسية
          </Link>

          <h1 className="font-cairo font-extrabold text-3xl text-navy-900">تسجيل الدخول</h1>
          <p className="mt-2 text-navy-600 font-tajawal">الحسابات المسجلة هي حسابات أعضاء فقط.</p>

          <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <p className="font-cairo font-bold text-sm text-amber-900">حساب المدير العام التجريبي</p>
            <p className="text-xs font-mono mt-2 text-slate-700">البريد: {DEMO_ADMIN.email}</p>
            <p className="text-xs font-mono text-slate-700">كلمة المرور: {DEMO_ADMIN.password}</p>
            <button
              type="button"
              onClick={() => { setEmail(DEMO_ADMIN.email); setPassword(DEMO_ADMIN.password); }}
              className="mt-3 w-full py-2.5 rounded-xl bg-white border border-amber-300 text-amber-900 font-cairo font-bold text-xs"
            >
              تعبئة بيانات المدير
            </button>
            <button
              type="button"
              onClick={loginAsOwnerAdmin}
              className="mt-2 w-full py-2.5 rounded-xl bg-slate-900 text-amber-300 font-cairo font-bold text-xs"
            >
              الدخول السريع كمدير عام
            </button>
            <p className="mt-2 text-[10px] text-amber-700 font-tajawal text-center">وضع تطوير محلي — سيُستبدل قبل الإطلاق الحقيقي</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-cairo font-semibold text-navy-800 mb-2">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pr-12 pl-4 py-3.5 rounded-2xl bg-white border-2 border-cream-200 focus:border-gold-500 focus:outline-none text-right" dir="ltr" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-cairo font-semibold text-navy-800">كلمة المرور</label>
                <Link to="/forgot-password" className="text-xs text-gold-700 font-cairo font-semibold">نسيت كلمة المرور؟</Link>
              </div>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400" />
                <input type={showPass ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pr-12 pl-12 py-3.5 rounded-2xl bg-white border-2 border-cream-200 focus:border-gold-500 focus:outline-none" dir="ltr" />
                <button type="button" onClick={() => setShowPass((value) => !value)} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400" aria-label="إظهار أو إخفاء كلمة المرور">
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" fullWidth size="lg" disabled={loading}>{loading ? 'جارٍ الدخول...' : 'دخول العضو'}</Button>
          </form>
          <p className="mt-8 text-center text-navy-600 font-tajawal">ليس لديك حساب؟ <Link to="/register" className="font-cairo font-bold text-gold-700">أنشئ حساب عضو</Link></p>
        </motion.div>
      </div>
    </div>
  );
}
