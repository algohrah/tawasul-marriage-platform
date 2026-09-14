import supabase from './db-client.js';
import { requireAdmin } from './_auth.js';
import { writeAuditLog } from './_audit.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { code } = req.query;
      // التحقق من كوبون واحد بالكود يبقى متاحاً للجميع (مطلوب عند صفحة الدفع)
      if (code) {
        const { data, error } = await supabase.from('coupons').select('*').eq('code', String(code)).maybeSingle();
        if (error) throw error;
        return res.status(200).json(data || null);
      }
      // قائمة كل الكوبونات تتطلب صلاحية إدارية
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = req.body || {};
      if (!body.code) return res.status(400).json({ error: 'code is required' });
      const row = {
        code: String(body.code).toUpperCase(),
        discount: Number(body.discount || body.value || 0),
        is_active: body.is_active ?? body.isActive ?? true,
        uses_count: Number(body.uses_count || body.usesCount || 0),
        expires_at: body.expires_at || body.expiresAt || null,
        details: body.details || {},
      };
      const { data, error } = await supabase.from('coupons').upsert(row).select().single();
      if (error) throw error;
      await writeAuditLog(admin.email, 'upsert_coupon', 'coupon', row.code, {});
      return res.status(req.method === 'POST' ? 201 : 200).json(data);
    }

    if (req.method === 'DELETE') {
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: 'code is required' });
      const { error } = await supabase.from('coupons').delete().eq('code', String(code).toUpperCase());
      if (error) throw error;
      await writeAuditLog(admin.email, 'delete_coupon', 'coupon', code, {});
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Coupons API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
