/**
 * هيكل تحميل لبطاقة العضو — يظهر أثناء جلب البيانات من الخادم
 * بدلاً من ترك القسم فارغاً.
 */
export default function MemberCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-cream-200/60 dark:border-white/10 bg-white dark:bg-navy-900/60 animate-pulse">
      <div className="aspect-[3/4] bg-cream-100 dark:bg-navy-800" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-cream-200/80 dark:bg-navy-800 rounded-full w-2/3" />
        <div className="h-3 bg-cream-100 dark:bg-navy-800/70 rounded-full w-1/2" />
        <div className="flex gap-2">
          <div className="h-6 bg-cream-100 dark:bg-navy-800/70 rounded-full w-16" />
          <div className="h-6 bg-cream-100 dark:bg-navy-800/70 rounded-full w-16" />
        </div>
      </div>
    </div>
  );
}

/** شبكة هياكل تحميل جاهزة */
export function MemberGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <MemberCardSkeleton key={`skeleton-member-${i}`} />
      ))}
    </>
  );
}
