import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, Users, Crown, ShieldCheck, Check, Bell, Eye, X, Search } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/admin/PageHeader';

export default function AdminNotifications() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<'all' | 'verified' | 'premium' | 'specific'>('all');
  const { adminNotifications: sent, adminSendBulkBroadcast, adminMembers } = useApp();
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [specificMembers, setSpecificMembers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  const audienceConfig = {
    all: { label: 'جميع الأعضاء', icon: Users, count: adminMembers.length, color: 'bg-slate-100 text-slate-700' },
    verified: { label: 'الأعضاء الموثقون', icon: ShieldCheck, count: adminMembers.filter(m => m.verified).length, color: 'bg-sky-100 text-sky-700' },
    premium: { label: 'الأعضاء المميّزون', icon: Crown, count: adminMembers.filter(m => m.premium).length, color: 'bg-amber-100 text-amber-700' },
    specific: { label: 'أعضاء محددون', icon: Users, count: specificMembers.length, color: 'bg-purple-100 text-purple-700' },
  };

  const filteredMembers = useMemo(() => {
    return adminMembers.filter((m) => m.nickname.includes(search) || m.realName.includes(search) || m.email.includes(search));
  }, [adminMembers, search]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim() || isSending) return;
    if (audience === 'specific' && specificMembers.length === 0) return;
    setIsSending(true);
    try {
      await adminSendBulkBroadcast(title, message, audience, specificMembers);
      setTitle('');
      setMessage('');
      setSpecificMembers([]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const toggleMember = (id: string) => {
    setSpecificMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-5">
      <PageHeader icon={Bell} title="الإشعارات والحملات" subtitle="أرسل إشعارات فورية للأعضاء أو لفئات محددة" />

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
          <h3 className="font-cairo font-bold text-slate-900 flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-500" /> إنشاء إشعار جديد
          </h3>

          <div>
            <label className="block text-xs font-cairo font-bold text-slate-700 mb-2">الجمهور المستهدف</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(audienceConfig) as Array<keyof typeof audienceConfig>).map((key) => {
                const cfg = audienceConfig[key];
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setAudience(key);
                      if (key === 'specific') setShowMemberPicker(true);
                    }}
                    disabled={isSending}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-right ${
                      audience === key ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-cairo font-bold text-slate-900 truncate">{cfg.label}</p>
                      <p className="text-[10px] text-slate-400 font-tajawal">{cfg.count.toLocaleString('ar-EG')} عضو</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {audience === 'specific' && (
              <button
                onClick={() => setShowMemberPicker(true)}
                className="mt-2 w-full py-2 rounded-xl bg-purple-50 text-purple-700 text-xs font-cairo font-bold hover:bg-purple-100 transition-colors"
              >
                {specificMembers.length > 0 ? `تم اختيار ${specificMembers.length} عضو` : 'اختر أعضاء محددين'}
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-cairo font-bold text-slate-700 mb-2 flex items-center justify-between">
              <span>عنوان الإشعار</span>
              <span className={`text-[10px] ${title.length > 50 ? 'text-rose-500' : 'text-slate-400'}`}>{title.length}/50</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSending}
              maxLength={60}
              placeholder="مثال: تحديث جديد في المنصة"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-cairo font-bold text-slate-700 mb-2 flex items-center justify-between">
              <span>نص الإشعار</span>
              <span className={`text-[10px] ${message.length > 200 ? 'text-rose-500' : 'text-slate-400'}`}>{message.length}/200</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
              rows={4}
              maxLength={250}
              placeholder="اكتب رسالتك هنا..."
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSend}
              disabled={!title.trim() || !message.trim() || isSending || (audience === 'specific' && specificMembers.length === 0)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 -scale-x-100" /> {isSending ? 'جارٍ الإرسال...' : `إرسال (${audienceConfig[audience].count.toLocaleString('ar-EG')})`}
            </button>
            <button
              onClick={() => setShowPreview(true)}
              disabled={!title.trim() && !message.trim()}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-cairo font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <Eye className="w-4 h-4" /> معاينة
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-cairo font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-slate-400" /> الإشعارات المُرسلة
            </h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
            {sent.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-cairo text-sm">
                لا توجد حملات إشعارات مُرسلة حتى الآن
              </div>
            ) : (
              sent.map((n) => {
                const aud = (n.audience || 'all') as keyof typeof audienceConfig;
                const cfg = audienceConfig[aud] || audienceConfig.all;
                const Icon = cfg.icon;
                return (
                  <div key={n.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-cairo font-bold text-slate-900 text-sm">{n.title}</h4>
                          <span className="text-[10px] text-slate-400 font-tajawal whitespace-nowrap">{n.sentAt}</span>
                        </div>
                        <p className="text-xs text-slate-600 font-tajawal mt-0.5 leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-cairo font-bold ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-[10px] text-emerald-600 font-cairo font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> {n.recipients.toLocaleString('ar-EG')} وصل
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="معاينة الإشعار" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-slate-500 font-tajawal text-center">هكذا سيظهر الإشعار للأعضاء</p>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${(audienceConfig[audience] || audienceConfig.all).color}`}>
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-cairo font-bold text-slate-900 text-sm">{title || 'عنوان الإشعار'}</h4>
                <p className="text-xs text-slate-600 font-tajawal mt-0.5 leading-relaxed">{message || 'نص الإشعار...'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-cairo font-bold ${(audienceConfig[audience] || audienceConfig.all).color}`}>{(audienceConfig[audience] || audienceConfig.all).label}</span>
                  <span className="text-[10px] text-slate-400 font-tajawal">الآن</span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => setShowPreview(false)} className="w-full py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold hover:bg-slate-800 transition-colors">
            إغلاق المعاينة
          </button>
        </div>
      </Modal>

      <Modal open={showMemberPicker} onClose={() => setShowMemberPicker(false)} title="اختيار أعضاء محددين" size="lg">
        <div className="space-y-4" dir="rtl">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-400 text-sm"
            />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {filteredMembers.map((m) => (
              <button
                key={m.id}
                onClick={() => toggleMember(m.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  specificMembers.includes(m.id) ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${m.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                  {m.nickname.charAt(0)}
                </div>
                <div className="flex-1 text-right">
                  <p className="font-cairo font-bold text-sm text-slate-900">{m.nickname}</p>
                  <p className="text-[10px] text-slate-500 font-tajawal">{m.realName} · {m.email}</p>
                </div>
                {specificMembers.includes(m.id) && <Check className="w-5 h-5 text-amber-600" />}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setShowMemberPicker(false)} className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-cairo font-bold">
              تأكيد ({specificMembers.length})
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
