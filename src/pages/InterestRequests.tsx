="text-xs text-slate-500 font-cairo leading-relaxed mt-1">{m.whereYouAre}</p>
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
