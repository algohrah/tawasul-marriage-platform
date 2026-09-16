  if (action.type === 'accept_decline') {
    return (
      <div className="flex gap-3">
        <button onClick={onAccept} disabled={busy}
          className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-cairo font-black py-3.5 rounded-2xl shadow-[0_4px_12px_rgba(16,185,129,0.15)] hover:-translate-y-0.5 transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4 text-white" />} قبول طلب التوافق
        </button>
        <button onClick={onDecline} disabled={busy}
          className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 font-cairo font-black py-3.5 rounded-2xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-sm">
          <X className="w-4 h-4 text-slate-500" /> اعتذار بلطف
        </button>
      </div>
    );
  }

  if (action.type === 'none') {
    return (
      <div className="text-center py-4 bg-[#FAF9F5] dark:bg-navy-900/40 rounded-2xl border border-slate-200/50">
        <p className="text-xs sm:text-sm font-cairo font-black text-slate-800">{action.label}</p>
        <p className="text-[10px] sm:text-xs font-cairo text-slate-500 mt-1">{action.hint}</p>
      </div>
    );
  }

  const handler = action.type === 'pay_deposit' ? onPay
    : action.type === 'view_coordination' ? onCoord
    : action.type === 'record_result' ? onResult : () => {};

  const accent = stage === 'seriousness' || stage === 'accepted' || stage === 'engagement' 
    ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-[0_4px_15px_rgba(245,158,11,0.2)]'
    : stage === 'sharia_viewing' 
      ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.15)]' 
      : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-[0_4px_12px_rgba(59,130,246,0.15)]';

  const Icon = action.type === 'pay_deposit' ? ShieldCheck : action.type === 'record_result' ? Heart : CalendarClock;

  return (
    <button onClick={handler} disabled={busy}
      className={`w-full ${accent} font-cairo font-black py-4 rounded-2xl hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0 flex items-center justify-center gap-2 cursor-pointer text-sm`}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-5 h-5" />}
      {action.label}
    </button>
  );
}

function PayProgress({ req, activeId }: { req: ApiRequest; activeId: string }) {
  const items = [
    { label: 'سدادك أنت لتأكيد الجدية', paid: req.sender_id === activeId ? req.sender_paid : req.receiver_paid },
    { label: 'سداد الطرف الآخر لتأكيد الجدية', paid: req.sender_id === activeId ? req.receiver_paid : req.sender_paid },
  ];
  return (
    <div className="flex gap-3">
      {items.map((it) => (
        <div key={it.label} className={`flex-1 rounded-2xl p-3.5 text-center border transition-all ${it.paid ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
          <p className="text-[11px] font-cairo font-bold text-slate-500">{it.label}</p>
          <p className={`text-sm font-cairo font-black mt-1 ${it.paid ? 'text-emerald-600' : 'text-slate-400'}`}>
            {it.paid ? '✓ تم السداد بنجاح' : 'بانتظار السداد'}
          </p>
        </div>
      ))}
    </div>
  );
}

function JourneyLegend() {
  const [open, setOpen] = useState(false);
  const stages: JourneyState[] = ['sent', 'accepted', 'seriousness', 'coordination', 'sharia_viewing', 'engagement', 'completed'];
  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(15,23,42,0.02)] overflow-hidden transition-all duration-300">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors">
        <span className="flex items-center gap-2.5 font-cairo font-black text-xs sm:text-sm text-slate-800">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" /> 
          <span>كيف تعمل رحلة التوافق للزواج الشرعي الميسر؟ (٧ خطوات واضحة)</span>
        </span>
        <ChevronLeft className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${open ? '-rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-1 space-y-3.5 border-t border-slate-100/50">
              {stages.map((s, i) => {
                const m = STAGE_META[s];
                const c = ACCENT_CLASSES[m.accent];
                const Icon = m.icon;
                return (
                  <div key={`journey-stage-item-${s}-${i}`} className="flex items-start gap-4 p-3 rounded-2xl hover:bg-slate-50/70 transition-colors">
                    <div className={`w-10 h-10 rounded-2xl ${c.bg} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-600 font-cairo">الخطوة {i + 1}</span>
                        <p className="font-cairo font-black text-sm text-slate-900">{m.title}</p>
                      </div>
                      <p className="text-xs text-slate-500 font-cairo leading-relaxed mt-1">{m.whereYouAre}</p>
                      <p className="text-[10px] text-indigo-600 font-cairo font-black mt-1">
                        تلقائياً التالي: <span className="underline">{m.whatsNext}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatChip({
  value, label, icon: Icon, tone, active, onClick,
}: {
  value: number; label: string; icon: typeof Heart; tone: 'gold' | 'rose' | 'emerald'; active: boolean; onClick: () => void;
}) {
  const tones = {
    gold: { ring: 'ring-amber-400/40 border-amber-400/40', icon: 'text-amber-300', val: 'text-amber-300', bg: 'bg-amber-500/10' },
    rose: { ring: 'ring-rose-400/40 border-rose-400/40', icon: 'text-rose-300', val: 'text-rose-300', bg: 'bg-rose-500/10' },
    emerald: { ring: 'ring-emerald-400/40 border-emerald-400/40', icon: 'text-emerald-300', val: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`flex-1 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl px-3.5 py-3 text-center transition-all duration-300 cursor-pointer border border-white/10
        ${active ? `ring-2 ${tones.ring} ${tones.bg}` : ''}`}
    >
      <div className="flex items-center justify-center gap-2">
        <Icon className={`w-4 h-4 ${tones.icon}`} />
        <span className={`font-cairo font-black text-lg sm:text-2xl tracking-tight ${active ? tones.val : 'text-white'}`}>{value}</span>
      </div>
      <p className="text-[10px] font-cairo text-slate-300 mt-1 leading-none font-medium">{label}</p>
    </button>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const config = {
    active: {
      icon: Compass,
      title: 'رحلتك المباركة بانتظار خطوتك الأولى',
      desc: 'سجل التواصل الآمن لا يحتوي على طلبات نشطة حالياً. تصفّح الأعضاء الموثقين الآن، وأرسل طلب اهتمام جاد لبدء المسار.',
      cta: '🔍 تصفّح الأعضاء وابحث عن نصفك الآخر', link: '/search',
    },
    incoming: {
      icon: Mail,
      title: 'صندوق الوارد آمن وبانتظار الفرص',
      desc: 'لم تتلقَ أي طلبات اهتمام جديدة حتى الآن. نوصيك بإكمال ملفك الشخصي بنسبة ٣٠٠٪ ورفع مستوى الجدية لزيادة فرص التواصل.',
      cta: '✨ تحسين وإكمال ملفي الشخصي الموحد', link: '/profile',
    },
    archive: {
      icon: Archive,
      title: 'السجل نظيف ولا توجد رحلات منتهية',
      desc: 'الرحلات السابقة (المنتهية بالزواج أو المعتذر عنها) ستظهر هنا للرجوع إليها لاحقاً بكل سرية وموثوقية.',
      cta: '🔍 ابدأ تصفّح الأعضاء الآن', link: '/search',
    },
  }[tab];
  const Icon = config.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center px-6 bg-white border border-slate-100 rounded-[2.5rem] shadow-[0_8px_30px_rgb(15,23,42,0.015)]"
    >
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-[2.2rem] bg-gradient-to-br from-amber-50 to-amber-100/50 flex items-center justify-center border border-amber-200/20">
          <Icon className="w-10 h-10 text-amber-500 stroke-[1.8]" />
        </div>
        <motion.span
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute -inset-2.5 rounded-[2.8rem] border-2 border-amber-300/30"
        />
      </div>
      <h3 className="font-cairo font-black text-lg text-slate-900">{config.title}</h3>
      <p className="font-cairo text-xs sm:text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">{config.desc}</p>
      <Link
        to={config.link}
        className="mt-6 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-cairo font-black px-7 py-3.5 rounded-2xl shadow-[0_4px_15px_rgba(245,158,11,0.2)] hover:-translate-y-0.5 transition-all text-xs sm:text-sm"
      >
        {config.cta}
      </Link>
    </motion.div>
  );
}
