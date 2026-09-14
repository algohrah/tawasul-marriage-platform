import supabase from './db-client.js';
import { authorizeMemberAction, requireAdmin } from './_auth.js';
import { writeAuditLog } from './_audit.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function fromDb(r) {
  if (!r) return r;
  return {
    id: r.id,
    requestId: '',
    userId: r.member_id || '',
    userNickname: '',
    reason: r.reason || '',
    status: r.status || 'pending',
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { id, userId } = req.query;
      if (userId) {
        const authz = await authorizeMemberAction(req, res, userId);
        if (!authz) return;
      } else if (!id) {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
      }
      let query = supabase.from('exemption_requests').select('*');
      if (id) query = query.eq('id', String(id)).maybeSingle();
      else {
        if (userId) query = query.eq('member_id', String(userId));
        query = query.order('created_at', { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;
      if (id) return res.status(200).json(fromDb(data));
      return res.status(200).json((data || []).map(fromDb));
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const userId = b.userId || b.user_id;
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const authz = await authorizeMemberAction(req, res, userId);
      if (!authz) return;
      const row = {
        id: b.id || `ex_${Date.now()}`,
        member_id: userId,
        reason: b.reason || '',
        status: b.status || 'pending',
      };
      const { data, error } = await supabase.from('exemption_requests').upsert(row).select().single();
      if (error) throw error;
      return res.status(201).json(fromDb(data));
    }

    if (req.method === 'PUT') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id, status, reason } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const update = {};
      if (status !== undefined) update.status = status;
      if (reason !== undefined) update.reason = reason;
      const { data, error } = await supabase.from('exemption_requests').update(update).eq('id', String(id)).select().single();
      if (error) throw error;
      await writeAuditLog(admin.email, `exemption_${status || 'update'}`, 'exemption_request', id, {});
      return res.status(200).json(fromDb(data));
    }

    if (req.method === 'DELETE') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('exemption_requests').delete().eq('id', String(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Exemptions API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
