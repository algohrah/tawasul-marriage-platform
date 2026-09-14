/**
 * ناقل التوستات (Toast Bus) — نظام رسائل منفصل عن سياق التطبيق الرئيسي.
 * الهدف: عرض رسائل النجاح/الخطأ دون إعادة رسم كامل شجرة التطبيق،
 * لأن أي تغيير في حالة AppContext كان يعيد رسم جميع المكونات المستهلكة له.
 */

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning' | string;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  const snapshot = toasts;
  Promise.resolve().then(() => {
    listeners.forEach((l) => l(snapshot));
  });
}

export function pushToast(message: string, type: ToastItem['type'] = 'success') {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, message, type }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3500);
}

export function dismissToastById(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  const snapshot = toasts;
  Promise.resolve().then(() => {
    if (listeners.has(listener)) {
      listener(snapshot);
    }
  });
  return () => { listeners.delete(listener); };
}
