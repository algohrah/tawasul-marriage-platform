import { Link } from 'react-router-dom';
import { useApp } from '../../lib/AppContext';
import { normalizePlan } from '../../../shared/membership.js';
export default function DailyRequestLimitNotice() {
  const { user, checkLimit } = useApp();
  if (!user.isLoggedIn) return null;
  const quota = checkLimit('message');
  return <div role="status" data-testid="daily-request-quota" className={`rounded-xl border p-3 text-xs font-cairo ${quota.allowed ? 'border-cream-200 bg-cream-50 text-navy-700' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
    <p>طلبات التوافق اليوم: {quota.current} من {quota.max} — المتبقي {Math.max(0, quota.max - quota.current)}</p>
    {!quota.allowed && <p className="mt-1">وصلت إلى حدك اليومي. يتجدد عند منتصف الليل (توقيت السعودية واليمن).</p>}
    {!quota.allowed && normalizePlan(user.profile.plan) === 'free' && <Link to="/plans" className="mt-2 inline-flex rounded-lg bg-navy-900 px-3 py-2 text-white font-bold">ترقّ إلى توافق مميز — 20 طلبًا يوميًا</Link>}
  </div>;
}
