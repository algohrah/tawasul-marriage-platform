import supabase from './db-client.js';
import { authorizeMemberAction, requireAdmin } from './_auth.js';
import { writeAuditLog } from './_audit.js';

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

const TX_TYPE_LABELS = {
  subscription: 'ترقية الباقة',
  deposit: 'رسوم الجدية',
  inquiry: 'باقة رسائل الاستفسار',
  inquiry_package: 'باقة رسائل الاستفسار',
  final: 'رسوم السعي النهائية',
};

/** إشعار العضو فور اعتماد/رفض المشرف لمعاملته المعلّقة — بدل انتظار زيارة الصفحة يدوياً */
async function notifyMemberOfReview(tx, approved) {
  const memberId = tx.member_id || tx.user_id;
  if (!memberId || memberId === 'system') return;
  const label = TX_TYPE_LABELS[tx.type] || 'معاملتك المالية';
  const row = {
    user_id: String(memberId),
    type: 'system',
    title: approved ? 'تم اعتماد معاملتك المالية ✅' : 'تم رفض معاملتك المالية',
    message: approved
      ? `تم اعتماد ${label} بنجاح وتفعيلها في حسابك.`
      : `تعذّر اعتماد ${label}. يرجى التواصل مع الدعم إذا كنت تعتقد أن هذا خطأ.`,
    read: false,
  };
  const { error } = await supabase.from('notifications').insert(row);
  if (isSchemaCacheError(error)) {
    const { request_id, ...minimalRow } = row;
    await supabase.from('notifications').insert(minimalRow).catch(() => undefined);
  }
}

/** عند اعتماد الإدارة لمعاملة معلّقة، نُفعّل الامتياز الفعلي المرتبط بها */
async function grantEntitlement(tx) {
  const meta = tx.metadata || {};
  const memberId = tx.member_id || tx.user_id;
  if (tx.type === 'subscription' && meta.desiredPlan) {
    await supabase.from('members').update({ plan: meta.desiredPlan, updated_at: new Date().toISOString() }).eq('id', memberId);
  }
  if ((tx.type === 'inquiry' || tx.type === 'inquiry_package') && memberId) {
    const credits = Number(meta.credits || 0);
    if (credits > 0) {
      const key = `inquiry_balance_${memberId}`;
      const { data: existing } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
      const current = Number(existing?.value || 0);
      await supabase.from('settings').upsert({ key, value: String(current + credits), updated_at: new Date().toISOString() });
    }
  }
  if (tx.type === 'final' && tx.request_id) {
    await supabase.from('interest_requests').update({
      journey_stage: 'completed', status: 'completed', mediation_stage: 'completed',
      evaluation_result: 'success', updated_at: new Date().toISOString(),
    }).eq('id', tx.request_id);
  }
  if (tx.type === 'deposit' && tx.request_id) {
    const { data: request } = await supabase.from('interest_requests').select('*').eq('id', tx.request_id).maybeSingle();
    if (request) {
      const now = new Date().toISOString();
      const isSender = String(tx.user_id) === String(request.sender_id);
      const update = isSender
        ? { sender_paid: true, sender_paid_at: now }
        : { receiver_paid: true, receiver_paid_at: now };
      const senderPaid = isSender ? true : !!request.sender_paid;
      const receiverPaid = !isSender ? true : !!request.receiver_paid;
      if (senderPaid && receiverPaid) {
        update.journey_stage = 'coordination';
        update.status = 'coordination';
        update.mediation_stage = 'coordination';
      }
      await supabase.from('interest_requests').update(update).eq('id', tx.request_id);
    }
  }
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
      } else if (userId) {
        const authz = await authorizeMemberAction(req, res, userId);
        if (!authz) return;
      }
      let query = supabase.from('transactions').select('*');
      if (id) query = query.eq('id', Number(id)).maybeSingle();
      else {
        if (userId) query = query.eq('member_id', String(userId));
        query = query.order('created_at', { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || (id ? null : []));
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const userId = body.user_id || body.userId || 'system';
      const authz = await authorizeMemberAction(req, res, userId);
      if (!authz) return;
      const row = {
        member_id: userId,
        amount: Number(body.amount || body.price || 0),
        type: body.type || 'payment',
        description: body.description || '',
        status: body.status || 'pending',
        metadata: body.metadata || body.details || {},
      };
      let { data, error } = await supabase.from('transactions').insert(row).select().single();
      if (isSchemaCacheError(error)) {
        const { request_id, metadata, ...minimalRow } = row;
        const fallback = await supabase.from('transactions').insert(minimalRow).select().single();
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { data, error } = await supabase.from('transactions').update(fields).eq('id', Number(id)).select().single();
      if (error) throw error;
      if (fields.status === 'completed') {
        await grantEntitlement(data);
        await writeAuditLog(admin.email, 'approve_transaction', 'transaction', id, { type: data.type, amount: data.amount });
        await notifyMemberOfReview(data, true);
      } else if (fields.status === 'failed') {
        await writeAuditLog(admin.email, 'reject_transaction', 'transaction', id, {});
        await notifyMemberOfReview(data, false);
      }
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('transactions').delete().eq('id', Number(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Transactions API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
