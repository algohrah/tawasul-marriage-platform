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

  // جدول المشرفين حسّاس بالكامل — كل العمليات تتطلب صلاحية إدارية مؤكدة عبر Supabase Auth
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    if (req.method === 'GET') {
      const { id } = req.query;
      let query = supabase.from('admin_users').select('*');
      if (id) query = query.eq('id', String(id)).maybeSingle();
      else query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || (id ? null : []));
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const row = { id: body.id || body.email || `admin_${Date.now()}`, username: body.username || 'admin', email: (body.email || '').toLowerCase().trim(), role: body.role || 'admin' };
      const { data, error } = await supabase.from('admin_users').upsert(row).select().single();
      if (error) throw error;
      await writeAuditLog(admin.email, 'add_admin_user', 'admin_user', data.id, { email: row.email });
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { data, error } = await supabase.from('admin_users').update(fields).eq('id', String(id)).select().single();
      if (error) throw error;
      await writeAuditLog(admin.email, 'update_admin_user', 'admin_user', id, { fields: Object.keys(fields) });
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('admin_users').delete().eq('id', String(id));
      if (error) throw error;
      await writeAuditLog(admin.email, 'delete_admin_user', 'admin_user', id, {});
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Admin users API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
