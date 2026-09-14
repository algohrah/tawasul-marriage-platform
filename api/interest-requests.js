import supabase from './db-client.js';
import { authorizeMemberAction, requireAdmin } from './_auth.js';
import { writeAuditLog } from './_audit.js';
import { checkRateLimit } from './_rateLimit.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// إجراءات لا يجوز تنفيذها إلا من قِبل الإدارة (تدخّل مباشر في مسار الوساطة/المدفوعات)
const ADMIN_ONLY_ACTIONS = new Set([
  'admin_set_payments', 'admin_set_pledges', 'admin_set_viewing_results', 'admin_set_contacts',
  'freeze_request', 'unfreeze_request', 'reactivate', 'swap_party', 'set_stage',
]);

function isSchemaCacheError(error) {
  return !!error && (
    error.code === 'PGRST204' ||
    String(error.message || '').toLowerCase().includes('schema cache') ||
    String(error.details || '').toLowerCase().includes('schema cache')
  );
}

function fromDb(r) {
  if (!r) return r;
  const rawStage = r.journey_stage || r.status || 'sent';
  const stage = rawStage === 'pending' ? 'sent' : rawStage;
  return {
    ...r,
    id: Number(r.id),
    senderId: r.sender_id,
    receiverId: r.receiver_id,
    status: stage,
    journey_stage: stage,
    mediationStage: r.mediation_stage || stage,
    senderPaid: !!r.sender_paid,
    receiverPaid: !!r.receiver_paid,
    senderPaidAt: r.sender_paid_at,
    receiverPaidAt: r.receiver_paid_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function basePayload(body = {}) {
  const rawStage = body.journey_stage || body.status || body.stage || 'sent';
  const stage = rawStage === 'pending' ? 'sent' : rawStage;
  return {
    id: body.id ? Number(body.id) : Date.now(),
    sender_id: body.sender_id || body.senderId,
    receiver_id: body.receiver_id || body.receiverId,
    journey_stage: stage,
    status: stage,
    mediation_stage: body.mediation_stage || body.mediationStage || stage,
    message: body.message || '',
    sender_paid: !!(body.sender_paid ?? body.senderPaid),
    receiver_paid: !!(body.receiver_paid ?? body.receiverPaid),
    created_at: body.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

function minimalRequestPayload(payload = {}) {
  const stage = payload.journey_stage || payload.status || payload.mediation_stage || 'sent';
  return compact({
    id: payload.id,
    sender_id: payload.sender_id,
    receiver_id: payload.receiver_id,
    status: stage,
    message: payload.message || '',
    created_at: payload.created_at,
    updated_at: payload.updated_at || new Date().toISOString(),
  });
}

function minimalRequestUpdate(update = {}) {
  const stage = update.journey_stage || update.status || update.mediation_stage;
  return compact({
    status: stage,
    message: update.message,
    updated_at: update.updated_at || new Date().toISOString(),
  });
}

async function ensureMemberExists(memberId) {
  if (!memberId) return;
  try {
    const { data } = await supabase.from('members').select('id').eq('id', String(memberId)).maybeSingle();
    if (!data) {
      await supabase.from('members').insert({
        id: String(memberId),
        nickname: `عضو ${memberId}`,
        gender: 'female',
        age: 25,
        city: 'الرياض',
        status: 'active',
        created_at: new Date().toISOString(),
      }).catch(() => undefined);
    }
  } catch {
    // ignore DB error
  }
}

async function addNotification(userId, requestId, type, text, title = 'تحديث رحلة التوافق') {
  if (!userId) return;
  const row = {
    user_id: String(userId),
    type,
    title,
    message: text,
    read: false,
  };
  const { error } = await supabase.from('notifications').insert(row);
  if (error) console.warn('Notification insert skipped:', error.message);
}

async function buildActionUpdate(current, action, actorId, payload = {}) {
  const now = new Date().toISOString();
  const update = { updated_at: now };
  const setStage = (stage) => {
    update.journey_stage = stage;
    update.status = stage;
    update.mediation_stage = stage;
  };

  switch (action) {
    case 'accept': {
      setStage('accepted');
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 15);
      update.deadline_date = deadline.toISOString();
      break;
    }
    case 'decline':
      setStage('declined');
      update.decline_reason = payload.reason || 'عدم التوافق';
      break;
    case 'cancel':
      setStage('cancelled');
      update.cancel_reason = payload.reason || 'تم الإلغاء';
      break;
    case 'skip_to_seriousness':
      setStage('seriousness');
      break;
    case 'defer_payment':
      update.defer_date = payload.deferDate || payload.defer_date;
      update.defer_by = actorId;
      break;
    case 'pay_deposit': {
      if (actorId === current.sender_id) {
        update.sender_paid = true;
        update.sender_paid_at = now;
      } else {
        update.receiver_paid = true;
        update.receiver_paid_at = now;
      }
      const senderPaid = actorId === current.sender_id ? true : !!current.sender_paid;
      const receiverPaid = actorId !== current.sender_id ? true : !!current.receiver_paid;
      setStage(senderPaid && receiverPaid ? 'coordination' : 'seriousness');
      break;
    }
    case 'update_coordination':
      if (payload.meetingDate !== undefined) update.meeting_date = payload.meetingDate;
      if (payload.meetingNotes !== undefined) update.meeting_notes = payload.meetingNotes;
      if (payload.advance) setStage('sharia_viewing');
      else if (!current.journey_stage || current.journey_stage === 'seriousness') setStage('coordination');
      break;
    case 'submit_contact':
      ['contact_info', 'contact_by', 'guardian_phone', 'guardian_name', 'guardian_relation', 'contact_time', 'contact_note', 'male_phone', 'male_name', 'male_relation', 'male_contact_time', 'male_contact_note'].forEach((key) => {
        const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (payload[key] !== undefined || payload[camel] !== undefined) update[key] = payload[key] ?? payload[camel];
      });
      break;
    case 'male_pledge':
      update.male_pledged = true;
      break;
    case 'female_pledge':
      update.female_pledged = true;
      break;
    case 'advance_viewing':
      setStage('sharia_viewing');
      break;
    case 'record_result': {
      const isSender = actorId === current.sender_id;
      if (isSender) {
        update.sender_viewing_result = payload.result || null;
        update.sender_viewing_note = payload.note || null;
      } else {
        update.receiver_viewing_result = payload.result || null;
        update.receiver_viewing_note = payload.note || null;
      }
      if (payload.result === 'failed') {
        setStage('declined');
        update.decline_reason = payload.note || 'لم يتم التوافق بعد النظرة';
      } else if ((isSender ? payload.result : current.sender_viewing_result) === 'success' && (!isSender ? payload.result : current.receiver_viewing_result) === 'success') {
        setStage('engagement');
      }
      break;
    }
    case 'complete_engagement':
      setStage('completed');
      update.evaluation_result = 'success';
      update.evaluation_note = payload.note || null;
      break;
    case 'set_stage':
      if (payload.stage) setStage(payload.stage);
      if (payload.note && payload.stage === 'cancelled') update.cancel_reason = payload.note;
      if (payload.note && payload.stage === 'declined') update.decline_reason = payload.note;
      break;
    case 'admin_set_payments':
      if (payload.sender_paid !== undefined) {
        update.sender_paid = !!payload.sender_paid;
        update.sender_paid_at = payload.sender_paid ? now : null;
      }
      if (payload.receiver_paid !== undefined) {
        update.receiver_paid = !!payload.receiver_paid;
        update.receiver_paid_at = payload.receiver_paid ? now : null;
      }
      break;
    case 'admin_set_pledges':
      if (payload.male_pledged !== undefined) update.male_pledged = !!payload.male_pledged;
      if (payload.female_pledged !== undefined) update.female_pledged = !!payload.female_pledged;
      break;
    case 'admin_set_viewing_results':
      if (payload.sender_viewing_result !== undefined) update.sender_viewing_result = payload.sender_viewing_result;
      if (payload.receiver_viewing_result !== undefined) update.receiver_viewing_result = payload.receiver_viewing_result;
      break;
    case 'admin_set_contacts':
      Object.assign(update, compact({
        guardian_phone: payload.guardian_phone,
        guardian_name: payload.guardian_name,
        guardian_relation: payload.guardian_relation,
        male_phone: payload.male_phone,
        male_name: payload.male_name,
        male_relation: payload.male_relation,
        contact_time: payload.contact_time,
        contact_note: payload.contact_note,
      }));
      break;
    case 'freeze_request':
      update.frozen = true;
      update.frozen_reason = payload.note || 'تجميد مؤقت من الإدارة';
      update.frozen_at = now;
      break;
    case 'unfreeze_request':
      update.frozen = false;
      break;
    case 'reactivate':
      setStage(payload.stage || 'coordination');
      update.decline_reason = null;
      update.cancel_reason = null;
      break;
    case 'swap_party':
      if (payload.role === 'sender' && payload.newMemberId) update.sender_id = payload.newMemberId;
      if (payload.role === 'receiver' && payload.newMemberId) update.receiver_id = payload.newMemberId;
      break;
    default:
      Object.assign(update, payload);
  }
  return update;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { id, userId } = req.query;
      let query = supabase.from('interest_requests').select('*');
      if (id) query = query.eq('id', Number(id)).maybeSingle();
      else {
        if (userId) query = query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
        query = query.order('updated_at', { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;
      if (id) return res.status(200).json(fromDb(data));
      return res.status(200).json((data || []).map(fromDb));
    }

    if (req.method === 'POST') {
      const payload = compact(basePayload(req.body || {}));
      if (!payload.sender_id || !payload.receiver_id) return res.status(400).json({ error: 'senderId and receiverId are required' });

      const authz = await authorizeMemberAction(req, res, payload.sender_id);
      if (!authz) return;

      await ensureMemberExists(payload.sender_id);
      await ensureMemberExists(payload.receiver_id);

      const allowed = await checkRateLimit(`ir_create:${payload.sender_id}`, 20, 3600);
      if (!allowed) return res.status(429).json({ error: 'لقد تجاوزت الحد المسموح من طلبات الاهتمام في الساعة، حاول لاحقاً' });

      // منع التكرار: التحقق من وجود طلب نشط لنفس الطرفين قبل الإنشاء
      const TERMINAL_STAGES = ['declined', 'cancelled', 'completed'];
      const { data: existing } = await supabase
        .from('interest_requests')
        .select('id, status, journey_stage')
        .eq('sender_id', payload.sender_id)
        .eq('receiver_id', payload.receiver_id);
      const activeDuplicate = (existing || []).find((r) => {
        const stage = r.journey_stage || r.status || 'sent';
        return !TERMINAL_STAGES.includes(stage);
      });
      if (activeDuplicate) {
        return res.status(409).json({ error: 'يوجد طلب اهتمام نشط بالفعل بين هذين العضوين', existingId: activeDuplicate.id });
      }

      let { data, error } = await supabase.from('interest_requests').insert(payload).select().single();
      if (isSchemaCacheError(error)) {
        const fallbackPayload = minimalRequestPayload(payload);
        const fallback = await supabase.from('interest_requests').insert(fallbackPayload).select().single();
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      await addNotification(payload.receiver_id, payload.id, 'request', 'لديك طلب اهتمام جديد بانتظار الرد', 'طلب اهتمام جديد');
      return res.status(201).json(fromDb(data));
    }

    if (req.method === 'PUT') {
      const { id, action = 'update', actorId = 'admin', payload = {}, ...directFields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { data: current, error: currentError } = await supabase.from('interest_requests').select('*').eq('id', Number(id)).single();
      if (currentError) throw currentError;

      const isAdminAction = action === 'update' || ADMIN_ONLY_ACTIONS.has(action);
      let actingAdminEmail = null;
      if (isAdminAction) {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
        actingAdminEmail = admin.email;
      } else {
        // إجراءات الأعضاء (قبول/رفض/دفع/تنسيق...) يجب أن يكون الفاعل أحد طرفي الطلب فعلاً
        if (String(actorId) !== String(current.sender_id) && String(actorId) !== String(current.receiver_id)) {
          return res.status(403).json({ error: 'لا يمكنك تنفيذ إجراء على طلب لا تخصّه' });
        }
        const authz = await authorizeMemberAction(req, res, actorId);
        if (!authz) return;
      }

      const update = action === 'update' ? { ...directFields, ...payload, updated_at: new Date().toISOString() } : await buildActionUpdate(current, action, actorId, payload);
      let { data, error } = await supabase.from('interest_requests').update(compact(update)).eq('id', Number(id)).select().single();
      if (isSchemaCacheError(error)) {
        const fallback = await supabase.from('interest_requests').update(minimalRequestUpdate(update)).eq('id', Number(id)).select().single();
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      await addNotification(data.sender_id, data.id, 'match', 'تم تحديث حالة رحلة التوافق الخاصة بك');
      await addNotification(data.receiver_id, data.id, 'match', 'تم تحديث حالة رحلة التوافق الخاصة بك');
      if (isAdminAction) await writeAuditLog(actingAdminEmail || 'admin', `journey_${action}`, 'interest_request', id, {});
      return res.status(200).json(fromDb(data));
    }

    if (req.method === 'DELETE') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('interest_requests').delete().eq('id', Number(id));
      if (error) throw error;
      await writeAuditLog(admin.email, 'delete_request', 'interest_request', id, {});
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Interest requests API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
