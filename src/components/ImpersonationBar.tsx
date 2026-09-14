import { dataService } from '../lib/data/DataService';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCog, LogOut, LayoutDashboard, Heart, Bell, User } from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { getMemberById } from '../lib/data';

// ============================================================
//  شريط "تتصفّح كـ..." — يظهر عند الدخول بحساب عضو من الإدارة
//  يوضّح الهوية النشطة ويتيح العودة للوحة الإدارة
//  كما يوفّر روابط سريعة لأهم صفحات العضو
// ============================================================

const DEFAULT_ID = 'm2';

export default function ImpersonationBar() {
  const { user, showToast } = useApp() as any;
  const [activeId, setActiveId] = useState<string>(DEFAULT_ID);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const read = () => {
      if (typeof window !== 'undefined') {
        setActiveId(dataService.db.settings.get('active_member_id') || DEFAULT_ID);
        setIsImpersonating(dataService.db.settings.get('impersonating') === 'true');
      }
    };
    read();
    // القراءة محلية (localStorage) — يكفي الاعتماد على حدث storage + فحص خفيف كل 5 ثوانٍ
    window.addEventListener('storage', read);
    const interval = setInterval(read, 5000);
    return () => { window.removeEventListener('storage', read); clearInterval(interval); };
  }, []);

  // لا نعرض الشريط إلا إذا كنا في وضع المحاكاة
  if (!isImpersonating) return null;

  const member = getMemberById(activeId);
  const displayName = member?.nickname || user?.name || activeId;

  const backToAdmin = () => {
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('active_member_id', DEFAULT_ID);
      dataService.db.settings.remove('impersonating');
      setActiveId(DEFAULT_ID);
      setIsImpersonating(false);
      showToast('تمت العودة إلى لوحة الإدارة', 'info');
      setTimeout(() => {
        window.location.href = '/admin/members';
      }, 100);
    }
  };

  const exitImpersonation = () => {
    if (typeof window !== 'undefined') {
      dataService.db.settings.set('active_member_id', DEFAULT_ID);
      dataService.db.settings.remove('impersonating');
      setActiveId(DEFAULT_ID);
      setIsImpersonating(false);
      showToast('تم إلغاء التصفح بحساب العضو وتسجيل الخروج', 'info');
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }
  };

  return (
    <div className="sticky top-0 z-[60] bg-amber-500 text-navy-950 shadow-lg" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-2 font-cairo font-bold text-sm">
            <UserCog className="w-4 h-4" />
            تتصفّح بحساب:
          </span>
          <div className="flex items-center gap-1.5 bg-navy-950/10 rounded-lg px-2 py-0.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${member?.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'}`}>
              {displayName.charAt(0)}
            </div>
            <strong className="font-cairo text-sm">{displayName}</strong>
            <span className="hidden sm:inline text-amber-900/60 text-xs font-normal">({activeId})</span>
          </div>

          {/* روابط سريعة لصفحات العضو */}
          <div className="hidden sm:flex items-center gap-1 mr-2">
            <Link to="/profile" className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy-950/10 hover:bg-navy-950/20 text-xs font-cairo font-bold transition-colors">
              <User className="w-3.5 h-3.5" /> ملفي
            </Link>
            <Link to="/requests" className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy-950/10 hover:bg-navy-950/20 text-xs font-cairo font-bold transition-colors">
              <Heart className="w-3.5 h-3.5" /> طلباتي
            </Link>
            <Link to="/notifications" className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy-950/10 hover:bg-navy-950/20 text-xs font-cairo font-bold transition-colors">
              <Bell className="w-3.5 h-3.5" /> إشعاراتي
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={exitImpersonation}
            className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-800 text-white font-cairo font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
            title="إلغاء التصفح بحساب العضو والخروج"
          >
            <LogOut className="w-3.5 h-3.5" /> إلغاء التصفح والخروج
          </button>
          <button
            onClick={backToAdmin}
            className="flex items-center gap-1.5 bg-navy-950 text-amber-300 font-cairo font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-navy-800 transition-colors flex-shrink-0 cursor-pointer shadow-xs"
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> العودة للوحة الإدارة
          </button>
        </div>
      </div>
    </div>
  );
}
