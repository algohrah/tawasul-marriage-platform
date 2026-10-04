import { recordSuccessfulRegistration } from './_visitorAnalytics.js';
import supabase from './db-client.js';
import { checkRateLimit } from './_rateLimit.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getClientKey(req, email) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip = req.headers?.['x-nf-client-connection-ip']
    || (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '')
    || 'unknown';
  return `signup:${ip}:${email}`;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    }

    const allowed = await checkRateLimit(getClientKey(req, email), 5, 15 * 60);
    if (!allowed) {
      return res.status(429).json({ error: 'تمت محاولات تسجيل كثيرة. انتظر 15 دقيقة قبل المحاولة بهذا البريد.' });
    }

    const { data: existingMember } = await supabase
      .from('members')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (existingMember) {
      return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل. سجّل الدخول أو استعد كلمة المرور.' });
    }

    if (!supabase.auth?.admin?.createUser) {
      return res.status(503).json({ error: 'خدمة إنشاء الحساب غير متاحة حاليًا' });
    }

    // إنشاء الحساب من الخادم وتأكيد البريد مباشرة. هذا يتجنب الحد العالمي
    // لرسائل Supabase التجريبية، ثم يسجل العميل الدخول لإنشاء ملف العضو.
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { source: 'tawafok-registration' },
    });

    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
        return res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقًا. استخدم تسجيل الدخول أو استعادة كلمة المرور.' });
      }
      console.error('Server registration failed:', error.message);
      return res.status(400).json({ error: 'تعذّر إنشاء الحساب. تحقق من البريد وكلمة المرور ثم حاول مرة أخرى.' });
    }

    // Count only a successful account creation. No identity or signup rate-limit
    // key is passed to the analytics helper; telemetry failure cannot break signup.
    if (data?.user?.id) {
      try { await recordSuccessfulRegistration(req); }
      catch { console.warn('Visitor registration counter unavailable'); }
    }
    return res.status(201).json({ ok: true, userId: data?.user?.id || null });
  } catch (error) {
    console.error('Register auth API error:', error);
    return res.status(500).json({ error: 'تعذّر إنشاء الحساب حاليًا. حاول مرة أخرى لاحقًا.' });
  }
}