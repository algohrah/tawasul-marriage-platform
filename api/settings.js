import supabase from './db-client.js';
import { getAuthUser, requireAdmin } from './_auth.js';
import { writeAuditLog } from './_audit.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// مفاتيح محدّدة (وليس كل جدول settings) يديرها العضو نفسه ذاتياً — حصص/أرصدة ورصيد رسائل شخصي،
// وليست إعدادات منصة عامة. أي مفتاح آخر (باقات، بوابات دفع، شروط، إعدادات المنصة، أو علامات
// "تمت المراجعة" الخاصة بلوحة الإدارة مثل twafok_reviewed_reports/tickets/moderated_messages)
// يتطلب صلاحية إدارية حقيقية حتى لو كان مفتاحاً بسيطاً شكلياً.
const SELF_SERVICE_EXACT_KEYS = new Set([
  'user_deposit_quota', 'user_extra_interests_count', 'user_unlimited_interests_until',
  'dark_mode', 'profile_boosted',
]);
const SELF_SERVICE_PREFIXES = ['inquiry_balance_', 'profile_hidden_'];

function isSelfServiceKey(key) {
  if (SELF_SERVICE_EXACT_KEYS.has(key)) return true;
  return SELF_SERVICE_PREFIXES.some((p) => key.startsWith(p));
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      // القراءة عامة — الإعدادات العامة (الباقات، بوابات الدفع الظاهرة، الشروط...) تحتاجها كل الصفحات العامة
      const { key } = req.query;
      let query = supabase.from('settings').select('*');
      if (key) query = query.eq('key', String(key)).maybeSingle();
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || (key ? null : []));
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { key, value } = req.body || {};
      if (!key) return res.status(400).json({ error: 'key is required' });

      if (isSelfServiceKey(key)) {
        // مفاتيح شخصية (رصيد رسائل، حصص استخدام...) — يكفي تسجيل دخول حقيقي
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول لتحديث هذا الإعداد' });
      } else {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
        await writeAuditLog(admin.email, 'update_setting', 'setting', key, {});
      }

      const { data, error } = await supabase.from('settings').upsert({ key, value: String(value ?? ''), updated_at: new Date().toISOString() }).select().single();
      if (error) throw error;
      return res.status(req.method === 'POST' ? 201 : 200).json(data);
    }

    if (req.method === 'DELETE') {
      const { key } = req.body || {};
      if (!key) return res.status(400).json({ error: 'key is required' });

      if (isSelfServiceKey(key)) {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول لحذف هذا الإعداد' });
      } else {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
        await writeAuditLog(admin.email, 'delete_setting', 'setting', key, {});
      }

      const { error } = await supabase.from('settings').delete().eq('key', String(key));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Settings API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
