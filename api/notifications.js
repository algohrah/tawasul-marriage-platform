import supabase from './db-client.js';
import { authorizeMemberAction, requireAdmin } from './_auth.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function isSchemaCacheError(error) {
  return !!error && (
    error.code === 'PGRST204' ||
    String(error.message || '').toLowerCase().includes('schema cache') ||
    String(error.details || '').toLowerCase().includes('schema cache')
  );
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { userId } = req.query;
      if (userId) {
        const authz = await authorizeMemberAction(req, res, userId);
        if (!authz) return;
      }
      let query = supabase.from('notifications').select('*');
      if (userId) query = query.in('user_id', [String(userId), 'all']);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      // إرسال إشعار إداري صريح (من لوحة الإدارة) يتطلب صلاحية إدارية
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const body = req.body || {};
      const row = {
        user_id: body.user_id || body.userId || 'all',
        title: body.title || 'تنبيه جديد',
        message: body.text || body.message || '',
        type: body.type || 'system',
        read: !!body.read,
      };
      const { data, error } = await supabase.from('notifications').insert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, userId, read = true } = req.body || {};
      if (userId) {
        const authz = await authorizeMemberAction(req, res, userId);
        if (!authz) return;
      }
      let query = supabase.from('notifications').update({ read: !!read });
      if (id) query = query.eq('id', String(id));
      else if (userId) query = query.eq('user_id', String(userId));
      else return res.status(400).json({ error: 'id or userId is required' });
      const { data, error } = await query.select();
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('notifications').delete().eq('id', String(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Notifications API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
