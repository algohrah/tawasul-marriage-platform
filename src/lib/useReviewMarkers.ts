import { dataService } from './data/DataService';
import { useState, useCallback } from 'react';

// ============================================================
//  خطاف تتبّع "المقروء / تمت المراجعة" بشكل دائم (localStorage)
//  يُستخدم في تذاكر الدعم والبلاغات حتى لا تختفي حالة المراجعة
//  عند تحديث الصفحة. يحفظ اسم المشرف ووقت المراجعة لكل عنصر.
// ============================================================

export interface ReviewMark {
  reviewedAt: string;   // ISO timestamp
  reviewedBy: string;   // اسم المشرف الذي راجع
}

type MarkMap = Record<string, ReviewMark>;

function readMarks(key: string): MarkMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = dataService.db.settings.get(key);
    if (raw) return JSON.parse(raw);
  } catch { /* تجاهل */ }
  return {};
}

function writeMarks(key: string, marks: MarkMap) {
  if (typeof window === 'undefined') return;
  try { dataService.db.settings.set(key, JSON.stringify(marks)); } catch { /* تجاهل */ }
}

/**
 * @param storageKey مفتاح التخزين المميّز (مثل: twafok_reviewed_tickets)
 */
export function useReviewMarkers(storageKey: string) {
  const [marks, setMarks] = useState<MarkMap>(() => readMarks(storageKey));

  // وضع علامة "تمت المراجعة" على عنصر
  const markReviewed = useCallback((id: string, reviewedBy: string) => {
    setMarks((prev) => {
      const next = { ...prev, [id]: { reviewedAt: new Date().toISOString(), reviewedBy } };
      writeMarks(storageKey, next);
      return next;
    });
  }, [storageKey]);

  // إزالة العلامة (إعادة كـ "جديد")
  const unmarkReviewed = useCallback((id: string) => {
    setMarks((prev) => {
      const next = { ...prev };
      delete next[id];
      writeMarks(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const isReviewed = useCallback((id: string) => !!marks[id], [marks]);
  const getMark = useCallback((id: string): ReviewMark | null => marks[id] || null, [marks]);

  return { marks, markReviewed, unmarkReviewed, isReviewed, getMark };
}
