import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'خطأ غير متوقع' };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[GlobalErrorBoundary]', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-20 text-center px-4" dir="rtl">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4 border border-amber-200 shadow-xs">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="font-cairo font-black text-xl text-slate-900 mb-2">عذراً، حدث خطأ غير متوقع</h3>
          <p className="text-sm text-slate-600 font-tajawal max-w-md mb-2">
            تم تسجيل الخطأ ونحن نعتذر عن هذا الإزعاج المؤقت. يمكنك تحديث الصفحة أو العودة إلى الصفحة الرئيسية.
          </p>
          {this.state.message && (
            <p className="text-[11px] text-slate-500 font-mono bg-white border border-slate-200 rounded-lg px-3 py-1.5 mt-2 max-w-md truncate shadow-xs">
              {this.state.message}
            </p>
          )}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-cairo font-bold text-sm transition-colors shadow-xs"
            >
              <RefreshCw className="w-4 h-4" /> تحديث الصفحة
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-cairo font-bold text-sm transition-colors"
            >
              <Home className="w-4 h-4" /> الصفحة الرئيسية
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
