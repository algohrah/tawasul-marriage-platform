import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, MessageCircle, Clock, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { dataService } from '../lib/data/DataService';

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await dataService.db.tickets.create({
        user_id: dataService.db.getCurrentUserId() || 'visitor',
        subject: `[Contact Form] ${name} - ${subject}`,
        message: `Email: ${email}\n\nMessage:\n${message}`,
        status: 'open',
        priority: 'medium',
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setName('');
        setEmail('');
        setSubject('');
        setMessage('');
      }, 4000);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('تعذّر إرسال الرسالة حالياً. يرجى المحاولة مرة أخرى لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-cream-50 min-h-screen">
      <div className="bg-navy-gradient relative overflow-hidden">
        <div className="absolute inset-0 pattern-arabesque opacity-30" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-14 text-center">
          <h1 className="font-cairo font-extrabold text-3xl sm:text-4xl text-white">اتصل بنا</h1>
          <p className="mt-3 text-cream-200/80 font-tajawal max-w-xl mx-auto">نحن هنا لمساعدتك. تواصل معنا في أي وقت وسنرد عليك بأسرع ما يمكن.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-12">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Info cards */}
          <div className="space-y-4">
            {[
              { icon: Mail, title: 'البريد الإلكتروني', value: 'support@tawasul.sa', sub: 'نرد خلال 24 ساعة' },
              { icon: Phone, title: 'الهاتف', value: '+966 11 234 5678', sub: 'الأحد - الخميس' },
              { icon: MapPin, title: 'العنوان', value: 'الرياض، المملكة العربية السعودية', sub: 'حي العليا' },
              { icon: Clock, title: 'ساعات العمل', value: '24/7 دعم عبر المنصة', sub: 'دعم على مدار الساعة' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl p-5 shadow-soft border border-cream-200/60 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gold-300/15 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-6 h-6 text-gold-600" />
                </div>
                <div>
                  <h3 className="font-cairo font-bold text-navy-900">{item.title}</h3>
                  <p className="text-navy-700 font-tajawal text-sm mt-0.5">{item.value}</p>
                  <p className="text-xs text-navy-400 font-tajawal mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 bg-white rounded-3xl shadow-luxe border border-cream-200/60 p-6 sm:p-8">
            <h2 className="font-cairo font-extrabold text-2xl text-navy-900 mb-2">أرسل لنا رسالة</h2>
            <p className="text-navy-600 font-tajawal mb-6">سنرد عليك في أقرب وقت ممكن.</p>
            {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-tajawal text-rose-700">{error}</div>}
            {sent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="font-cairo font-bold text-xl text-navy-900">تم إرسال رسالتك!</h3>
                <p className="text-navy-600 font-tajawal mt-2">شكراً لتواصلك معنا. سنرد عليك قريبًا.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-cairo font-semibold text-navy-800 mb-2">الاسم</label>
                    <input required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal" placeholder="اسمك" />
                  </div>
                  <div>
                    <label className="block text-sm font-cairo font-semibold text-navy-800 mb-2">البريد الإلكتروني</label>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal" placeholder="example@email.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-cairo font-semibold text-navy-800 mb-2">الموضوع</label>
                  <input required value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal" placeholder="موضوع رسالتك" />
                </div>
                <div>
                  <label className="block text-sm font-cairo font-semibold text-navy-800 mb-2">الرسالة</label>
                  <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={5} className="w-full px-4 py-3 rounded-xl bg-cream-50 border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal resize-none" placeholder="اكتب رسالتك هنا..." />
                </div>
                <Button type="submit" size="lg" fullWidth disabled={loading} className="shadow-gold">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5 -scale-x-100" /> إرسال الرسالة</>}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
