import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// ============================================================
//  حدود الخطأ للوحة الإدارة — يلتقط أي خطأ في وقت التشغيل
//  داخل صفحات الأدمن ويعرض رسالة واضحة بدلاً من شاشة بيضاء.
// ============================================================

interface Props {
  children: ReactNode;
  /** يُستخدم لإعادة تعيين الحدود عند تغيّر المسار */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class AdminErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'خطأ غير متوقع' };
  }

  componentDidUpdate(prevProps: Props) {
    // إعادة المحاولة تلقائياً عند الانتقال لصفحة أخرى
    const self = this as any;
    if (self.state.hasError && prevProps.resetKey !== self.props.resetKey) {
      self.setState({ hasError: false, message: '' });
    }
  }

  componentDidCatch(error: Error, info: unknown) {
    // تسجيل الخطأ لمساعدة التشخيص
    console.error('[AdminErrorBoundary]', error, info);
  }

  handleReset = () => {
    const self = this as any;
    const msg = String(self.state.message || '');
    // إن كان الخطأ بسبب فشل جلب chunk (نشر جديد + نسخة قديمة في المتصفح) نُعيد تحميل الصفحة كاملةً
    if (/Failed to fetch dynamically imported module|dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(msg)) {
      window.location.reload();
      return;
    }
    self.setState({ hasError: false, message: '' });
  };

  handleHardReload = () => window.location.reload();

  render() {
    const self = this as any;
    if (self.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4" dir="rtl">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <h3 className="font-cairo font-extrabold text-lg text-slate-900 mb-1">تعذّر تحميل هذه الصفحة</h3>
          <p className="text-sm text-slate-500 font-tajawal max-w-md mb-1">
            حدث خطأ مؤقت أثناء عرض هذه الصفحة. يمكنك إعادة المحاولة أو الانتقال لصفحة أخرى.
          </p>
          {self.state.message && (
            <p className="text-[11px] text-slate-400 font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 mt-2 max-w-md truncate">
              {self.state.message}
            </p>
          )}
          <div className="mt-5 flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 text-white font-cairo font-bold text-sm hover:bg-navy-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> إعادة المحاولة
            </button>
            <button
              onClick={this.handleHardReload}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-cairo font-bold text-sm hover:bg-slate-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> تحديث الصفحة بالكامل
            </button>
          </div>
        </div>
      );
    }
    return self.props.children;
  }
}
