import supabase from './db-client.js';
import { authorizeMemberAction, requireAdmin } from './_auth.js';
import { writeAuditLog } from './_audit.js';
import { checkRateLimit } from './_rateLimit.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function fromDb(r) {
  if (!r) return r;
  return {
    id: r.id,
    reporterId: r.reporter_id || '',
    reporterName: r.reporter_name || '',
    reportedId: r.reported_id || '',
    reportedName: r.reported_name || '',
    reason: r.reason || '',
    timestamp: r.created_at,
    status: r.status || 'pending',
    category: r.category || undefined,
    severity: r.severity || undefined,
    adminNotes: r.admin_notes || '',
    actionLog: Array.isArray(r.action_log) ? r.action_log : [],
  };
}

function toDb(b = {}) {
  return {
    id: b.id || `rep_${Date.now()}`,
    reporter_id: b.reporterId || b.reporter_id || '',
    reporter_name: b.reporterName || b.reporter_name || '',
    reported_id: b.reportedId || b.reported_id || '',
    reported_name: b.reportedName || b.reported_name || '',
    reason: b.reason || '',
    status: b.status || 'pending',
    category: b.category || null,
    severity: b.severity || null,
    admin_notes: b.adminNotes || b.admin_notes || '',
    action_log: b.actionLog || b.action_log || [],
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      // قوائم البلاغات ومحتواها للإدارة فقط (تحتوي على معلومات حسّاسة عن الأعضاء)
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id } = req.query;
      let query = supabase.from('member_reports').select('*');
      if (id) query = query.eq('id', String(id)).maybeSingle();
      else query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      if (id) return res.status(200).json(fromDb(data));
      return res.status(200).json((data || []).map(fromDb));
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const reporterId = body.reporterId || body.reporter_id;
      if (!reporterId) return res.status(400).json({ error: 'reporterId is required' });
      const authz = await authorizeMemberAction(req, res, reporterId);
      if (!authz) return;

      const allowed = await checkRateLimit(`report:${reporterId}`, 10, 3600);
      if (!allowed) return res.status(429).json({ error: 'لقد تجاوزت الحد المسموح من البلاغات، حاول لاحقاً' });

      const row = toDb(body);
      const { data, error } = await supabase.from('member_reports').upsert(row).select().single();
      if (error) throw error;
      return res.status(201).json(fromDb(data));
    }

    if (req.method === 'PUT') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const update = {};
      if (fields.status !== undefined) update.status = fields.status;
      if (fields.category !== undefined) update.category = fields.category;
      if (fields.severity !== undefined) update.severity = fields.severity;
      if (fields.adminNotes !== undefined) update.admin_notes = fields.adminNotes;
      if (fields.admin_notes !== undefined) update.admin_notes = fields.admin_notes;
      if (fields.actionLog !== undefined) update.action_log = fields.actionLog;
      if (fields.action_log !== undefined) update.action_log = fields.action_log;
      if (fields.reason !== undefined) update.reason = fields.reason;
      const { data, error } = await supabase.from('member_reports').update(update).eq('id', String(id)).select().single();
      if (error) throw error;
      await writeAuditLog(admin.email, 'update_report', 'member_report', id, { fields: Object.keys(update) });
      return res.status(200).json(fromDb(data));
    }

    if (req.method === 'DELETE') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('member_reports').delete().eq('id', String(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Member reports API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
