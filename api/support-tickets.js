import supabase from './db-client.js';
import { getAuthUser, requireAdmin } from './_auth.js';

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
      const { id, userId } = req.query;
      if (!userId && !id) {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
      }
      let query = supabase.from('support_tickets').select('*');
      if (id) query = query.eq('id', Number(id)).maybeSingle();
      else {
        if (userId) query = query.eq('user_id', String(userId));
        query = query.order('created_at', { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || (id ? null : []));
    }

    if (req.method === 'POST') {
      // فتح تذكرة دعم يتطلب تسجيل دخول حقيقي (منع السبام) — بلا حاجة لربط عضو محدد
      const user = await getAuthUser(req);
      if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول لفتح تذكرة دعم' });
      const body = req.body || {};
      const row = {
        user_id: body.user_id || body.userId || 'm2',
        subject: body.subject || 'تذكرة دعم',
        message: body.message || body.text || '',
        category: body.category || 'استفسار عام',
        priority: body.priority || 'normal',
        status: body.status || 'open',
        details: body.details || {},
      };
      const { data, error } = await supabase.from('support_tickets').insert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { data, error } = await supabase.from('support_tickets').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', Number(id)).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('support_tickets').delete().eq('id', Number(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Support tickets API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
