import type { ReactNode } from 'react';

// ============================================================
//  رأس صفحة موحّد لكل أقسام لوحة الإدارة — يضمن نفس الحجم واللون
//  والتباعد في كل الصفحات (كان متكرراً يدوياً بأشكال متفاوتة قليلاً).
// ============================================================

interface PageHeaderProps {
  icon?: React.ElementType;
  title: string;
  subtitle?: string;
  /** عنصر إجراء اختياري يظهر على يمين الرأس (زر إضافة/تصدير/حفظ...) */
  action?: ReactNode;
}

export default function PageHeader({ icon: Icon, title, subtitle, action }: PageHeaderProps) {
  return (
    <section className="admin-surface relative overflow-hidden rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
      <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-amber-400 via-amber-500 to-transparent" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {Icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200"><Icon className="w-5 h-5" /></span>}
          <div>
            <p className="mb-0.5 text-[11px] font-cairo font-bold tracking-wide text-amber-700">مركز الإدارة</p>
            <h2 className="font-cairo font-extrabold text-xl text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 font-tajawal mt-1">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </section>
  );
}
