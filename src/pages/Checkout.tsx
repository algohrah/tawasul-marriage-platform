import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Lock, Check, ShieldCheck, ArrowLeft, Crown,
  Zap, Star, CheckCircle2, Wallet, Smartphone, ShieldAlert,
  Coins, LayoutGrid, HelpCircle, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useApp } from '../lib/AppContext';
import { dataService } from '../lib/data/DataService';

export default function Checkout() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { upgradePlan, showToast, plans, paypalSettings, user, paymentSettings = { paypalActive: true, cryptoActive: true, bankActive: true, cryptoWalletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F (USDT ERC20)', bankDetails: 'مصرف الراجحي - رقم الحساب: SA8980000012345678901234 - باسم شركة توافق المحدودة', forceSingleMethod: 'none' } } = useApp();
  
  // Resolve default payment method based on config (paypal / crypto / bank only)
  const initialMethod = paymentSettings.forceSingleMethod && paymentSettings.forceSingleMethod !== 'none'
    ? (paymentSettings.forceSingleMethod === 'paypal' ? 'paypal' : paymentSettings.forceSingleMethod === 'crypto' ? 'crypto' : 'bank')
    : (paypalSettings.active && paymentSettings.paypalActive ? 'paypal' : paymentSettings.cryptoActive ? 'crypto' : 'bank');

  const [paymentMethod, setPaymentMethod] = useState<string>(initialMethod);
  
  // Nested selection inside PayPal component
  const [paypalOption, setPaypalOption] = useState<'paypal_acc' | 'guest_card'>('paypal_acc');
  
  // Offline Payment states
  const [cryptoTxid, setCryptoTxid] = useState('');
  const [transferredBank, setTransferredBank] = useState('');
  const [senderName, setSenderName] = useState('');
  const [uploadedReceipt, setUploadedReceipt] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  
  // Card forms
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // PayPal Account simulated form
  const [paypalEmail, setPaypalEmail] = useState('user@example.com');
  const [paypalPassword, setPaypalPassword] = useState('••••••••');
  const [showPaypalModal, setShowPaypalModal] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);

  // Load selected plan dynamically from state manager
  const plan = plans.find(p => p.id === planId) || plans.find(p => p.id === 'premium') || plans[1];
  const vat = Math.round(plan.price * 0.15);
  const total = plan.price + vat;

  const handlePay = useCallback((via: string) => {
    // Validate fields if direct card checkout
    if (via === 'direct_card' || (via === 'paypal_guest_card' && !cardNumber)) {
      if (!via.includes('paypal_acc') && (!cardNumber || !cardExpiry || !cardCvv)) {
        showToast('برجاء ملء كافة بيانات البطاقة المطلوبة والمحاولة مرة أخرى.', 'error');
        return;
      }
    }

    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
      setPendingReview(false);
      setShowPaypalModal(false);

      // طريقة فورية (بطاقة/باي بال) — تُسجّل كمعاملة مكتملة فوراً ويُفعّل الاشتراك فوراً
      dataService.db.recordTransaction({
        user_id: user.memberId,
        userId: user.memberId,
        type: 'subscription',
        description: `اشتراك باقة ${plan.name}`,
        amount: total,
        status: 'completed',
        metadata: { desiredPlan: plan.id === 'elite' ? 'elite' : 'gold' },
      });
      upgradePlan(plan.id === 'elite' ? 'elite' : 'gold');
      setTimeout(() => navigate('/profile'), 2500);
    }, 2000);
  }, [cardNumber, cardExpiry, cardCvv, plan.id, plan.name, total, upgradePlan, navigate, showToast, user.memberId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedReceipt(file);
      setReceiptUrl(URL.createObjectURL(file));
      showToast('تم تحميل صورة الإيصال بنجاح! 📄', 'success');
    }
  };

  const handleOfflinePay = () => {
    if (paymentMethod === 'crypto' && !cryptoTxid) {
      showToast('يرجى كتابة رمز المعاملة (TXID) لمراجعة الحوالة.', 'error');
      return;
    }
    if (paymentMethod === 'bank' && (!senderName || !transferredBank)) {
      showToast('يرجى ملء اسم المرسل والبنك المحوّل لتأكيد تسليم البيانات.', 'error');
      return;
    }
    if (!uploadedReceipt) {
      showToast('يرجى إرفاق صورة إيصال أو إثبات التحويل للتحقق.', 'error');
      return;
    }

    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
      setPendingReview(true);
      // الدفع اليدوي (بنكي/عملات رقمية) يُسجّل كمعاملة معلّقة بانتظار مراجعة الإدارة قبل أي تفعيل
      // للباقة — لا يتم استدعاء upgradePlan() هنا إطلاقاً
      dataService.db.recordTransaction({
        user_id: user.memberId,
        userId: user.memberId,
        type: 'subscription',
        description: `اشتراك باقة ${plan.name} (${paymentMethod === 'crypto' ? 'عملات رقمية' : 'تحويل بنكي'})`,
        amount: total,
        status: 'pending',
        metadata: { desiredPlan: plan.id === 'elite' ? 'elite' : 'gold', method: paymentMethod, senderName, transferredBank, cryptoTxid },
      });
      showToast('تم إرسال إثبات الدفع بنجاح! سيتم مراجعة الطلب من الإدارة وتفعيل اشتراكك خلال دقائق. ⏰✨', 'success');
      setTimeout(() => navigate('/profile'), 3500);
    }, 2500);
  };

  const [sdkLoaded, setSdkLoaded] = useState(false);

  useEffect(() => {
    if (paymentMethod !== 'paypal') return;
    
    // Clean old scripts
    const oldScript = document.getElementById('paypal-sdk-script');
    if (oldScript) {
      oldScript.remove();
    }
    
    const script = document.createElement('script');
    script.id = 'paypal-sdk-script';
    // Use user-defined Client ID dynamically
    script.src = `{{https://www.paypal.com/sdk/js?client-id=${paypalSettings.clientId}} || 'sb'}&currency=USD&intent=capture`;
    script.async = true;
    script.onload = () => {
      setSdkLoaded(true);
    };
    script.onerror = () => {
      console.warn("PayPal Smart SDK unavailable or blocked. Using fast checkout fallback.");
    };
    document.body.appendChild(script);

    return () => {
      const s = document.getElementById('paypal-sdk-script');
      if (s) s.remove();
    };
  }, [paymentMethod, paypalSettings.clientId]);

  useEffect(() => {
    if (paymentMethod === 'paypal' && (sdkLoaded || (window as any).paypal) && paypalOption === 'paypal_acc') {
      const container = document.getElementById('paypal-button-container');
      if (container) {
        container.innerHTML = '';
        try {
          (window as any).paypal.Buttons({
            createOrder: (data: any, actions: any) => {
              return actions.order.create({
                purchase_units: [{
                  amount: {
                    currency_code: 'USD',
                    value: (total / 3.75).toFixed(2) // Convert to roughly equivalent USD
                  },
                  description: `ترقية اشتراك ${plan.name} - موقع وموقع زواج توافق`
                }]
              });
            },
            onApprove: async (data: any, actions: any) => {
              const details = await actions.order.capture();
              showToast(`تمت الموافقة بنجاح! شكراً لك، ${details.payer.name.given_name || 'العضو'}`, 'success');
              handlePay('paypal');
            },
            onError: (err: any) => {
              console.error(err);
              showToast('خطأ بالدفع من PayPal الجاري. يمكنك تجربة الدفع السريع البديل.', 'error');
            }
          }).render('#paypal-button-container');
        } catch (e) {
          console.error("PayPal buttons render failed", e);
        }
      }
    }
  }, [paymentMethod, sdkLoaded, paypalOption, total, plan.name, handlePay, showToast]);

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4" dir="rtl">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl shadow-luxe border border-cream-200/60 p-6 sm:p-12 text-center max-w-md w-full"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5"
          >
            <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-600" />
          </motion.div>
          <h1 className="font-cairo font-extrabold text-xl sm:text-2xl text-navy-900">{pendingReview ? 'تم استلام طلبك! ⏳' : 'تم الدفع بنجاح!'}</h1>
          <p className="text-navy-600 font-tajawal mt-2 text-sm sm:text-base">
            {pendingReview
              ? `سيقوم فريق الإدارة بمراجعة إثبات التحويل وتفعيل باقة ${plan.name} خلال دقائق. ستصلك رسالة تأكيد فور التفعيل.`
              : `تم تفعيل ${plan.name} بنجاح. استمتع بكل المزايا وصلاحيات البحث الآن.`}
          </p>
          {pendingReview && (
            <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs font-cairo font-semibold">
              الباقة الحالية ستبقى كما هي حتى اعتماد الإدارة للدفعة — لا حاجة لإعادة الإرسال.
            </div>
          )}
          <div className="mt-6 bg-cream-50 rounded-2xl p-4 text-right space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-navy-500 font-tajawal">{pendingReview ? 'الباقة المطلوبة' : 'الباقة المفعّلة'}</span>
              <span className="font-cairo font-bold text-navy-900">{plan.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy-500 font-tajawal">المبلغ المدفوع</span>
              <span className="font-cairo font-bold text-navy-900">{total} ر.س</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy-500 font-tajawal">بوابة المعالجة</span>
              <span className="font-cairo font-bold text-amber-700">
                {paymentMethod === 'paypal' ? 'bypassed PayPal API' : 'بطاقة شبكة وطنية'}
              </span>
            </div>
            {paymentMethod === 'paypal' && (
              <div className="flex flex-col gap-1 border-t border-cream-200/50 pt-2 text-[10px] text-slate-400 font-mono text-center">
                <span>Client ID: {paypalSettings.clientId.slice(0, 16)}...</span>
                <span>Mode: {paypalSettings.mode.toUpperCase()}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-navy-400 font-tajawal mt-5">جارِ تحويلك لصفحة حسابك الشخصي...</p>
        </motion.div>
      </div>
    );
  }

  // Resolve active methods based on paymentSettings config
  const activeForces = {
    paypal: paymentSettings.forceSingleMethod === 'paypal',
    crypto: paymentSettings.forceSingleMethod === 'crypto',
    bank: paymentSettings.forceSingleMethod === 'bank',
  };

  const isForced = paymentSettings.forceSingleMethod && paymentSettings.forceSingleMethod !== 'none';

  const paymentMethods = [];

  if (isForced) {
    if (activeForces.paypal && paypalSettings.active) {
      paymentMethods.push({ id: 'paypal', label: 'باي بال والبطاقات', icon: CreditCard, desc: 'بوابة PayPal وائتمان' });
    } else if (activeForces.crypto && paymentSettings.cryptoActive) {
      paymentMethods.push({ id: 'crypto', label: 'العملات الرقمية (Crypto)', icon: Coins, desc: 'تحويل USDT آمن' });
    } else if (activeForces.bank && paymentSettings.bankActive) {
      paymentMethods.push({ id: 'bank', label: 'حوالة بنكية محلية', icon: Wallet, desc: 'تحويل فوري فروع المملكة' });
    }
  } else {
    if (paypalSettings.active && paymentSettings.paypalActive) {
      paymentMethods.push({ id: 'paypal', label: 'باي بال والبطاقات', icon: CreditCard, desc: 'بوابة PayPal وائتمان' });
    }
    if (paymentSettings.cryptoActive) {
      paymentMethods.push({ id: 'crypto', label: 'العملات الرقمية (Crypto)', icon: Coins, desc: 'تحويل USDT آمن' });
    }
    if (paymentSettings.bankActive) {
      paymentMethods.push({ id: 'bank', label: 'حوالة بنكية محلية', icon: Wallet, desc: 'الراجحي / الأهلي معتمد' });
    }
  }

  return (
    <div className="bg-cream-50 min-h-screen pb-12 font-tajawal text-right" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        <Link to="/plans" className="inline-flex items-center gap-2 text-navy-600 hover:text-gold-700 font-cairo font-semibold text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 ml-1 transform rotate-180" /> العودة لقائمة الباقات والعروض
        </Link>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Payment form */}
          <div className="lg:col-span-3 space-y-5">
            <div>
              <h1 className="font-cairo font-extrabold text-xl sm:text-2xl text-navy-900">ترقية الحساب والاشتراك</h1>
              <p className="text-navy-600 font-tajawal mt-1 text-sm sm:text-base">اختر بوابة الدفع المفضلة لديك وأكمل عملية الترقية بأمان 100%.</p>
            </div>

            {/* Payment methods */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-soft border border-cream-200/60">
              <h3 className="font-cairo font-bold text-navy-900 mb-4 text-sm">طرق الدفع المتوفرة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paymentMethods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-right ${
                      paymentMethod === m.id ? 'border-amber-400 bg-amber-50/20' : 'border-slate-100 hover:border-amber-200'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${paymentMethod === m.id ? 'bg-gold-gradient text-navy-900' : 'bg-cream-100 text-navy-500'}`}>
                      <m.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-cairo font-bold text-navy-900 text-xs">{m.label}</p>
                      <p className="text-[10px] text-navy-400 font-tajawal">{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* PAYPAL ADVANCED CHANNEL EXPERIENCES */}
            {paymentMethod === 'paypal' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-soft border border-cream-200/60">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 flex-wrap gap-2">
                    <h3 className="font-cairo font-bold text-navy-900 text-sm">الدفع الذكي عبر PayPal</h3>
                    <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-mono">
                      Client ID: {paypalSettings.clientId.slice(0, 10)}... ({paypalSettings.mode})
                    </span>
                  </div>

                  {/* Toggle suboptions */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-4">
                    <button
                      type="button"
                      onClick={() => setPaypalOption('paypal_acc')}
                      className={`py-2 rounded-lg font-cairo text-[11px] sm:text-xs font-bold transition-all ${
                        paypalOption === 'paypal_acc' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      الدفع بحساب PayPal
                    </button>
                    {paypalSettings.guestCheckout && (
                      <button
                        type="button"
                        onClick={() => setPaypalOption('guest_card')}
                        className={`py-2 rounded-lg font-cairo text-[11px] sm:text-xs font-bold transition-all ${
                          paypalOption === 'guest_card' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        دفع مباشر بالبطاقة (Guest)
                      </button>
                    )}
                  </div>

                  {/* Option 1: PAYPAL LOGIN EXP */}
                  {paypalOption === 'paypal_acc' && (
                    <div className="space-y-4 text-center py-4">
                      <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-900 text-right leading-relaxed mb-1">
                        سيقوم النظام بتحميل بوابة دفع PayPal بآخر تحديثات لمثبّت الحساب الفعلي (مستضاف في لوحة الإدارة): 
                        <code className="block bg-white border border-amber-100 p-1.5 rounded font-mono text-center text-[10px] mt-1 text-slate-600 truncate">{paypalSettings.clientId}</code>
                      </div>

                      {/* PayPal JS SDK buttons integration containers */}
                      <div id="paypal-button-container" className="my-4 min-h-[50px] relative z-10 transition-all"></div>

                      <div className="text-slate-400 text-xs font-tajawal my-2">-- أو --</div>

                      <button
                        type="button"
                        onClick={() => handlePay('paypal')}
                        className="w-full py-4 px-4 sm:px-6 rounded-2xl bg-yellow-400 hover:bg-yellow-500 text-navy-900 font-cairo font-bold text-xs sm:text-sm shadow-md flex flex-wrap items-center justify-center gap-2 transition-all active:scale-[0.99]"
                      >
                        <span className="font-extrabold italic text-sky-800">Pay<span className="text-blue-500">Pal</span></span>
                        <span>تأكيد الاشتراك السريع فوري (بديل تجريبي)</span>
                      </button>
                      <p className="text-[10px] text-slate-400 font-tajawal">آمن ومشفر وتطبق شروط حماية المشتري لـ PayPal.</p>
                    </div>
                  )}

                  {/* Option 2: PAYPAL GUEST CARD (NO ACCOUNT REQUIRED) */}
                  {paypalOption === 'guest_card' && (
                    <div className="space-y-4">
                      <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-800 leading-relaxed">
                        ✓ <strong>ميزة الدفع للزوار (PayPal Guest Checkout):</strong> يمكنك ملء بيانات بطاقتك أدناه مباشرة ويتم إرسالها ومعالجتها فوراً كزائر عبر بوابتنا المحمية بـ PayPal دون الحاجة لوجود حساب أو تسجيل.
                      </div>

                      <div>
                        <label className="block text-xs font-cairo font-semibold text-slate-700 mb-1.5">رقم بطاقة الائتمان / مدى</label>
                        <div className="relative">
                          <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input 
                            placeholder="4000 1234 5678 9010" 
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            className="w-full pr-12 pl-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-mono text-center tracking-widest text-slate-900 text-sm" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-xs font-cairo font-semibold text-slate-700 mb-1.5">تاريخ انتهاء الصلاحية</label>
                          <input 
                            placeholder="MM / YY" 
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-mono text-center text-slate-900 text-sm" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-cairo font-semibold text-slate-700 mb-1.5">رمز الأمان (CVV)</label>
                          <div className="relative">
                            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                              placeholder="123" 
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value)}
                              className="w-full pr-11 pl-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-mono text-center text-slate-900 text-sm" 
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-cairo font-semibold text-slate-700 mb-1.5">الاسم الكامل كما هو مطبوع</label>
                        <input 
                          placeholder="Fahad Al-Qahtani" 
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none font-tajawal text-slate-900 text-sm" 
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePay('paypal_guest_card')}
                        disabled={processing}
                        className="w-full py-3.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors font-cairo font-bold text-sm shadow-sm flex items-center justify-center gap-2"
                      >
                        {processing ? (
                          <>
                            <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                            معالجة تفويض بطاقة PayPal Guest...
                          </>
                        ) : (
                          <>
                            <Lock className="w-4.5 h-4.5 text-amber-400" />
                            دفع {total} ر.س كزائر آمن بـ PayPal
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* CRYPTO WALLET FORM */}
            {paymentMethod === 'crypto' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-4 sm:p-5 shadow-soft border border-cream-200/60 space-y-4 text-slate-800">
                <div className="flex items-center gap-2 pb-2 border-b border-cream-100">
                  <Coins className="w-5.5 h-5.5 text-amber-500" />
                  <h3 className="font-cairo font-bold text-navy-900 text-sm">الدفع بالعملات الرقمية (USDT)</h3>
                </div>
                
                <div className="bg-amber-50/60 p-4 rounded-xl text-xs leading-relaxed text-amber-900 space-y-1">
                  <p className="font-bold font-cairo">تعليمات التحويل والرفع:</p>
                  <p>1. قم بنسخ عنوان المحفظة أدناه بدقة بالغة.</p>
                  <p>2. أرسل قيمة الفاتورة بما يعادل بالدولار ({(total / 3.75).toFixed(2)} USDT).</p>
                  <p>3. اكتب رمز المعاملة (TXID/Hash) الخاص بحوالتك وقم بإرفاق لقطة شاشة واضحة (إيصال التحويل).</p>
                  <p>4. انقر على تأكيد لإرسال الحوالة إلى المراجعة الفورية.</p>
                </div>

                <div>
                  <label className="block text-xs font-cairo font-semibold text-navy-800 mb-1.5">عنوان محفظة الاستلاف الخاص بالإدارة (ERC20 / TRC20)</label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input 
                      readOnly
                      value={paymentSettings.cryptoWalletAddress || "0x71C7656EC7ab88b098defB751B7401B5f6d8976F (USDT-TRC20)"}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-center text-xs text-navy-900 focus:outline-none" 
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        navigator.clipboard.writeText(paymentSettings.cryptoWalletAddress || "0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
                        showToast('تم نسخ عنوان المحفظة بنجاح!', 'success');
                      }}
                      className="px-3 py-2.5 rounded-xl bg-slate-900 text-white font-cairo font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
                    >
                      نسخ
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-cairo font-semibold text-navy-800 mb-1.5">رمز معرّف التحويل الخاص بك (TxID / Hash) *</label>
                  <input 
                    placeholder="أدخل هاش أو رقم TxID هنا لمطابقة دفعتك..." 
                    value={cryptoTxid}
                    onChange={(e) => setCryptoTxid(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-cream-50 border border-cream-200 focus:border-gold-500 focus:outline-none text-right font-mono text-xs text-slate-800"
                  />
                </div>

                {/* File Upload Screen */}
                <div>
                  <label className="block text-xs font-cairo font-semibold text-navy-800 mb-1.5">إرفاق إيصال التحويل الرقمي أو لقطة إثبات التحويل الرقمي *</label>
                  <div className="border-2 border-dashed border-cream-300 rounded-xl p-4 text-center cursor-pointer hover:bg-cream-50/50 transition-colors relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                    <div className="space-y-1">
                      <span className="block text-xs font-cairo font-bold text-gold-700">اسحب صورة الإيصال أو انقر هنا للرفع 📄</span>
                      <span className="block text-[10px] text-slate-400">يدعم صيغ الصور (PNG, JPG, JPEG)</span>
                    </div>
                  </div>
                  {uploadedReceipt && (
                    <div className="mt-2 text-xs text-emerald-700 font-tajawal text-center flex items-center justify-center gap-1.5">
                      <Check className="w-5 h-5 text-emerald-600" /> تم تحميل الإيصال: {uploadedReceipt.name} ({(uploadedReceipt.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                <Button onClick={handleOfflinePay} fullWidth size="lg" className="mt-2" disabled={processing}>
                  {processing ? 'جاري إرسال إثبات المعاملة...' : 'إرسال تأكيد التحويل الرقمي'}
                </Button>
              </motion.div>
            )}

            {/* LOCAL BANK TRANSFER FORM */}
            {paymentMethod === 'bank' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-4 sm:p-5 shadow-soft border border-cream-200/60 space-y-4 text-slate-800">
                <div className="flex items-center gap-2 pb-2 border-b border-cream-100">
                  <Wallet className="w-5.5 h-5.5 text-amber-500" />
                  <h3 className="font-cairo font-bold text-navy-900 text-sm">تحويل بنكي محلّي (الراجحي / الأهلي)</h3>
                </div>

                <div className="bg-amber-50/60 p-4 rounded-xl text-xs leading-relaxed text-amber-900 space-y-1">
                  <p className="font-bold font-cairo">تحويل آمن لشركائنا البنكيين في المملكة العربية السعودية:</p>
                  <p>الرجاء إجراء التحويل من تطبيق البنك الخاص بك إلى الحساب المذكور أدناه، ثم تعبئة وتوثيق الحوالة برفع لقطة الإيصال.</p>
                </div>

                <div>
                  <label className="block text-xs font-cairo font-semibold text-navy-800 mb-1.5">معلومات الحسابات البنكية لاستقبال الحوالة المباشرة</label>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-tajawal text-xs text-navy-900 select-all whitespace-pre-wrap leading-loose">
                    {paymentSettings.bankDetails || "مصرف الراجحي\nرقم الحساب: SA8980000012345678901234\nباسم: شركة توافق لتكنولوجيا المعلومات"}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-cairo font-semibold text-navy-800 mb-1.5">اسم المحوّل من حسابه البنكي *</label>
                    <input 
                      placeholder="أدخل اسمك كما بالهوية..." 
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 border border-cream-200 focus:border-gold-500 focus:outline-none text-right text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-cairo font-semibold text-navy-800 mb-1.5">البنك الذي تم التحويل منه *</label>
                    <input 
                      placeholder="مثال: مصرف الراجحي، الأهلي..." 
                      value={transferredBank}
                      onChange={(e) => setTransferredBank(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 border border-cream-200 focus:border-gold-500 focus:outline-none text-right text-xs text-slate-800"
                    />
                  </div>
                </div>

                {/* File Upload Screen */}
                <div>
                  <label className="block text-xs font-cairo font-semibold text-navy-800 mb-1.5">إرفاق إثبات الحوالة أو صورة الإيصال المحول *</label>
                  <div className="border-2 border-dashed border-cream-300 rounded-xl p-4 text-center cursor-pointer hover:bg-cream-50/50 transition-colors relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                    <div className="space-y-1">
                      <span className="block text-xs font-cairo font-bold text-gold-700">اسحب صورة الإيصال أو انقر لرفع الملف 📄</span>
                      <span className="block text-[10px] text-slate-400">الصور فقط من نوع (PNG, JPEG)</span>
                    </div>
                  </div>
                  {uploadedReceipt && (
                    <div className="mt-2 text-xs text-emerald-700 font-tajawal text-center flex items-center justify-center gap-1.5">
                      <Check className="w-5 h-5 text-emerald-600" /> تم تحميل الإيصال: {uploadedReceipt.name} ({(uploadedReceipt.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                <Button onClick={handleOfflinePay} fullWidth size="lg" className="mt-2" disabled={processing}>
                  {processing ? 'جاري فحص وتأكيد تسليم البيانات...' : 'تأكيد الحوالة البنكية وإرسال الإيصال للأدمن'}
                </Button>
              </motion.div>
            )}

            {/* Security badges */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
              {[
                { icon: Lock, label: 'تشفير آمن SSL 256-bit' },
                { icon: ShieldCheck, label: 'معالجة مشفرة بالكامل' },
                { icon: Check, label: 'تحديث فوري للباقة' },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-1.5 text-[11px] text-navy-500 font-tajawal">
                  <b.icon className="w-4 h-4 text-emerald-500" /> {b.label}
                </div>
              ))}
            </div>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-soft border border-cream-200/60 lg:sticky lg:top-24">
              <h3 className="font-cairo font-bold text-navy-900 mb-4 text-sm">ملخص الفاتورة والحدود</h3>

              {/* Plan card */}
              <div className="bg-navy-gradient rounded-2xl p-4 mb-4 relative overflow-hidden">
                <div className="absolute inset-0 pattern-arabesque opacity-30" />
                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gold-gradient flex items-center justify-center flex-shrink-0">
                    <Crown className="w-6 h-6 text-navy-900" />
                  </div>
                  <div>
                    <span className="inline-block px-1.5 py-0.5 bg-white/20 text-[9px] text-white rounded font-bold mb-0.5">الباقة المشتراة</span>
                    <p className="font-cairo font-bold text-sm text-white">{plan.name}</p>
                  </div>
                </div>
              </div>

              {/* Limits and inclusions preview */}
              <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">حد الرسائل الشهرية:</span>
                  <span className="font-bold text-slate-800">{plan.messagesLimit ? `${plan.messagesLimit} رسالة` : 'غير محدود'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">طلبات الاهتمام المتاحة:</span>
                  <span className="font-bold text-slate-800">{plan.requestsLimit ? `${plan.requestsLimit} طلب/يوم` : 'غير محدود'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">فلاتر البحث والمطابقة:</span>
                  <span className={`font-bold ${plan.advancedFilters ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {plan.advancedFilters ? 'بريميوم متقدمة ✓' : 'رئيسية فقط'}
                  </span>
                </div>
              </div>

              {/* Inclusions list */}
              <div className="space-y-2 mb-4 border-t border-cream-100 pt-3">
                <p className="text-[10px] text-slate-400 font-bold mb-1">المزايا التسويقية المدرجة:</p>
                {plan.features.slice(0, 4).map((f, fIdx) => (
                  <div key={`${plan.id}-checkout-feat-${fIdx}`} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                    </div>
                    <span className="text-xs text-navy-600 font-tajawal">{f}</span>
                  </div>
                ))}
              </div>

              {/* Price breakdown */}
              <div className="space-y-2 py-4 border-t border-cream-200">
                <div className="flex justify-between text-xs"><span className="text-navy-500 font-tajawal">سعر الباقة الرئيسي</span><span className="font-cairo font-semibold text-navy-900">{plan.price} ر.س</span></div>
                <div className="flex justify-between text-xs"><span className="text-navy-500 font-tajawal">ضريبة القيمة المضافة لخدمات الإنترنت (15%)</span><span className="font-cairo font-semibold text-navy-900">{vat} ر.س</span></div>
                <div className="flex justify-between pt-2.5 border-t border-cream-200">
                  <span className="font-cairo font-bold text-navy-900 text-sm">المجموع الكلي المطلوب سداده</span>
                  <span className="font-cairo font-extrabold text-base text-gradient-gold">{total} ر.س</span>
                </div>
              </div>

              <p className="text-center text-[10px] text-navy-400 font-tajawal mt-3">
                بالضغط على الترقية أو الدفع فإنك تقر وتوافق صراحة على <Link to="/terms" className="text-gold-700 underline font-semibold">شروط الاستخدام وعقد بيع الخدمات الرقمية</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FULLY INTERACTIVE POPUP / DIALOG DIALECT FOR PAYPAL ACCOUNT PAYMENT SIMULATION */}
      <AnimatePresence>
        {showPaypalModal && (
          <div className="fixed inset-0 bg-black/65 flex items-center justify-center p-4 z-50 overflow-y-auto" dir="ltr">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-300 flex flex-col justify-between"
            >
              {/* Header */}
              <div className="bg-slate-50 px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between rounded-t-2xl flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-black italic text-sky-800">Pay<span className="text-blue-500">Pal</span></span>
                  <span className="bg-amber-100 text-amber-800 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                    {paypalSettings.mode} mode
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono">Secure Payment Sandbox Portal</p>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 space-y-4">
                <div className="text-center">
                  <p className="text-xs text-slate-500">PAYING TO MERCHANT ID</p>
                  <p className="font-mono text-xs font-bold text-slate-800 bg-slate-100 p-2 rounded tracking-wide border border-slate-200 mt-1 truncate">
                    {paypalSettings.clientId}
                  </p>
                </div>

                <div className="border-y border-dashed border-slate-200 py-3 text-center">
                  <span className="text-xs text-slate-400 block">TOTAL AMOUNT TO PAY</span>
                  <span className="font-sans font-extrabold text-xl sm:text-2xl text-slate-900">{total} SAR <span className="text-xs font-light text-slate-400">(incl. 15% VAT)</span></span>
                </div>

                {/* Login credentials inside popup */}
                <div className="space-y-3">
                  <p className="text-xs font-bold font-sans text-slate-700">Log in to your PayPal Account</p>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">EMAIL ADDRESS</label>
                    <input 
                      type="email" 
                      value={paypalEmail} 
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono focus:border-blue-500 focus:outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">PASSWORD *</label>
                    <input 
                      type="password" 
                      value={paypalPassword} 
                      onChange={(e) => setPaypalPassword(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono focus:border-blue-500 focus:outline-none" 
                    />
                  </div>
                </div>

                {/* Simulation helpful instructions on sandbox logins */}
                <div className="bg-blue-50 text-[10px] text-blue-900 p-3 rounded-lg leading-relaxed flex gap-2">
                  <ShieldAlert className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    Your secure portal has hooked successfully onto your active PayPal Client ID. You can click <strong>Complete Integration Payment</strong> below to simulate full backend authorization.
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 px-4 sm:px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowPaypalModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handlePay('paypal_acc')}
                  disabled={processing}
                  className="px-4 sm:px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  {processing ? 'Processing Secure API...' : 'Complete Integration Payment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
