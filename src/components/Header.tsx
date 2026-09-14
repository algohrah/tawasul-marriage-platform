import React from 'react';
import { Terminal, Upload, Globe, Play, Sparkles } from 'lucide-react';

interface HeaderProps {
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
  onOpenUpload: () => void;
  fileCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onToggleLanguage,
  onOpenUpload,
  fileCount
}) => {
  return (
    <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur sticky top-0 z-40 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
      
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <Terminal className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h1 className="text-base font-extrabold text-white flex items-center gap-2">
            {language === 'ar' ? 'منصة تشغيل ومعاينة المشاريع' : 'Project Workspace & Runner'}
            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md">
              v1.0
            </span>
          </h1>
          <p className="text-[11px] text-slate-400">
            {language === 'ar'
              ? 'جاهز لاستقبال ملفات مشروعك وتشغيلها مباشرة بكل سهولة'
              : 'Ready to receive, inspect, edit and run your web project files'}
          </p>
        </div>
      </div>

      {/* Center Prompt / Ready Status Badge */}
      <div className="hidden lg:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3.5 py-1.5 rounded-full">
        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        <span>
          {language === 'ar'
            ? 'الجهوزية 100%: ارفع ملفات مشروعك الآن لتشغيلها مباشرة'
            : '100% Ready: Upload project files or ZIP now'}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenUpload}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 active:scale-95"
        >
          <Upload className="w-4 h-4" />
          <span>{language === 'ar' ? 'رفع الملفات / ZIP' : 'Upload Files / ZIP'}</span>
        </button>

        <button
          onClick={onToggleLanguage}
          className="bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 font-semibold text-xs px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
          title="Toggle Language"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

    </header>
  );
};
