import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useApp } from '../../lib/AppContext';

/**
 * يحمي المسارات اللي تتطلب تسجيل دخول.
 * لو المستخدم غير مسجّل، يُحوّل لصفحة الدخول مع تذكّر الصفحة المطلوبة.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const location = useLocation();

  if (!user.isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
