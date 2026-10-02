import supabase from './db-client.js';
import { isAdminEmail } from './_auth.js';
import { checkRateLimit } from './_rateLimit.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function clientKey(req, email) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip = req.headers?.['x-nf-client-connection-ip']
    || (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '')
    || 'unknown';
  return `admin-auth:${ip}:${email}`;
}

async function confirmExistingAdmin(email) {
  if (!supabase.auth?.admin?.listUsers || !supabase.auth?.admin?.updateUserById) return false;
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return false;
  const adminUser = (data?.users || []).find((user) => String(user.email || '').toLowerCase() === email);
  if (!adminUser) return false;
  const result = await supabase.auth.admin.updateUserById(adminUser.id, { email_confirm: true });
  return !result.error;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'أدخل البريد الإلكتروني وكلمة المرور' });

  try {
    const allowed = await checkRateLimit(clientKey(req, email), 8, 15 * 60);
    if (!allowed) return res.status(429).json({ error: 'تمت محاولات دخول كثيرة. حاول لاحقًا.' });

    if (!(await isAdminEmail(email))) {
      return res.status(403).json({ error: 'هذا الحساب غير مخوّل للدخول إلى لوحة الإدارة' });
    }

    let result = await supabase.auth.signInWithPassword({ email, password });
    const authMessage = String(result.error?.message || '').toLowerCase();

    // الحساب الإداري القديم أُنشئ قبل تفعيل تأكيد البريد. نؤكده فقط بعد أن
    // يتحقق Supabase من كلمة المرور ويرجع خطأ "البريد غير مؤكد".
    if (result.error && (authMessage.includes('email not confirmed') || authMessage.includes('email_not_confirmed'))) {
      const confirmed = await confirmExistingAdmin(email);
      if (confirmed) result = await supabase.auth.signInWithPassword({ email, password });
    }

    if (result.error || !result.data?.session?.access_token) {
      return res.status(401).json({ error: 'بيانات الدخول الإدارية غير صحيحة' });
    }

    return res.status(200).json({
      ok: true,
      accessToken: result.data.session.access_token,
      refreshToken: result.data.session.refresh_token,
      expiresAt: result.data.session.expires_at,
      admin: {
        id: result.data.user?.id,
        email: result.data.user?.email,
      },
    });
  } catch (error) {
    console.error('Admin auth API error:', error);
    return res.status(500).json({ error: 'تعذّر إنشاء الجلسة الإدارية الآن' });
  }
}