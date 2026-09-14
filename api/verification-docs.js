import supabase from './db-client.js';
import { authorizeMemberAction, requireAdmin } from './_auth.js';
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
      const { id, memberId } = req.query;
      if (memberId) {
        const authz = await authorizeMemberAction(req, res, memberId);
        if (!authz) return;
      } else if (!id) {
        // قائمة كاملة بدون تحديد عضو — للإدارة فقط
        const admin = await requireAdmin(req, res);
        if (!admin) return;
      }
      let query = supabase.from('verification_docs').select('*');
      if (id) query = query.eq('id', String(id)).maybeSingle();
      else {
        if (memberId) query = query.eq('member_id', String(memberId));
        query = query.order('created_at', { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || (id ? null : []));
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const memberId = body.member_id || body.memberId;
      if (!memberId) return res.status(400).json({ error: 'memberId is required' });
      const authz = await authorizeMemberAction(req, res, memberId);
      if (!authz) return;

      const docId = body.id || `doc_${Date.now()}`;
      let fileUrl = body.file_url || body.fileUrl || '';

      if (body.docBase64 || body.fileBase64) {
        const raw = body.docBase64 || body.fileBase64;
        const match = String(raw).match(/^data:([^;]+);base64,(.+)$/);
        const contentType = body.contentType || (match ? match[1] : 'image/jpeg');
        const base64 = match ? match[2] : raw;
        const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
        const fileName = `${memberId}/${docId}.${extension}`;
        const buffer = Buffer.from(base64, 'base64');
        const { error: uploadError } = await supabase.storage
          .from('verification-docs')
          .upload(fileName, buffer, { contentType, upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('verification-docs').getPublicUrl(fileName);
          fileUrl = urlData.publicUrl;
        }
      }

      const row = {
        id: docId,
        member_id: memberId,
        file_url: fileUrl,
        file_name: body.fileName || body.docName || body.doc_name || `${docId}.jpg`,
        status: body.status || 'pending',
        notes: body.notes || body.rejectionReason || body.rejection_reason || '',
      };
      const { data, error } = await supabase.from('verification_docs').upsert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      // اعتماد/رفض وثائق التوثيق إجراء إداري بالكامل
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const update = {
        ...(fields.status !== undefined ? { status: fields.status } : {}),
        ...(fields.notes !== undefined || fields.rejectionReason !== undefined ? { notes: fields.notes || fields.rejectionReason || '' } : {}),
      };
      const { data, error } = await supabase.from('verification_docs').update(update).eq('id', String(id)).select().single();
      if (error) throw error;
      await writeAuditLog(admin.email, `verification_${fields.status || 'update'}`, 'verification_doc', id, { memberId: data.member_id });
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { error } = await supabase.from('verification_docs').delete().eq('id', String(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Verification docs API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
