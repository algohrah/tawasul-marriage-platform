import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="font-cairo font-extrabold text-8xl sm:text-9xl text-gradient-gold">404</div>
      <h1 className="font-cairo font-bold text-2xl text-navy-900 mt-4">الصفحة غير موجودة</h1>
      <p className="text-navy-600 font-tajawal mt-2 max-w-md">عذرًا، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gold-gradient text-navy-900 font-cairo font-bold shadow-soft">
          <Home className="w-5 h-5" /> الرئيسية
        </Link>
        <Link to="/search" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border-2 border-cream-200 text-navy-700 font-cairo font-bold hover:border-gold-300 transition-colors">
          <Search className="w-5 h-5" /> البحث
        </Link>
      </div>
    </div>
  );
}
