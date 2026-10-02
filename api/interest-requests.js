import supabase from './db-client.js';
import {
  authorizeMemberAction, requireAdmin, getAuthUser, getMemberLink, isAdminEmail,
} from './_auth.js';
import { writeAuditLog } from './_audit.js';
import { checkRateLimit } from './_rateLimit.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function resolveViewer(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'يجب تسجيل الدخول لعرض طلبات التوافق' });
    return null;
  }
  if (await isAdminEmail(user.email)) return { user, memberId: null, isAdmin: true };
  const link = await getMemberLink(user.id);
  if (link?.member_id) return { user, memberId: String(link.member_id), isAdmin: false };
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .or(`id.eq.${user.id},email.eq.${user.email || ''}`)
    .maybeSingle();
  if (!member) {
    res.status(403).json({ error: 'تعذر ربط جلسة الدخول بملف العضو' });
    return null;
  }
  return { user, memberId: String(member.id), isAdmin: false };
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
    request_id: Number(requestId),
    type,
    title,
    message: text,
    read: false,
  };
  const { error } = await supabase.from('notifications').insert(row);
  if (error) console.warn('Notification insert skipped:', error.message);
}

async function requestProgress(request) {
  const { data, error } = await supabase
    .from('request_events')
    .select('actor_id, action, payload, created_at')
    .eq('request_id', Number(request.id))
    .in('action', ['confirm_advance', 'pay_final_fee'])
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('Request progress lookup skipped:', error.message);
    return {};
  }
  const events = data || [];
  const finalPayments = events.filter((event) => event.action === 'pay_final_fee');
  const stageConfirmations = events.filter((event) =>
    event.action === 'confirm_advance' &&
    (event.payload?.fromStage || 'coordination') === 'coordination' &&
    (event.payload?.nextStage || 'sharia_viewing') === 'sharia_viewing'
  );
  const paidAt = (actorId) => finalPayments.find((event) => String(event.actor_id) === String(actorId))?.created_at || null;
  const confirmed = (actorId) => stageConfirmations.some((event) => String(event.actor_id) === String(actorId));
  return {
    sender_final_paid: !!paidAt(request.sender_id),
    receiver_final_paid: !!paidAt(request.receiver_id),
    sender_final_paid_at: paidAt(request.sender_id),
    receiver_final_paid_at: paidAt(request.receiver_id),
    sender_stage_confirmed: confirmed(request.sender_id),
    receiver_stage_confirmed: confirmed(request.receiver_id),
  };
}

async function withProgress(request) {
  if (!request) return request;
  return { ...fromDb(request), ...(await requestProgress(request)) };
}

function maskPrivateJourneyFields(request, viewer) {
  if (!request || viewer?.isAdmin) return request;
  const copy = { ...request };
  const isSender = String(copy.sender_id) === String(viewer.memberId);
  const myResult = isSender ? copy.sender_viewing_result : copy.receiver_viewing_result;
  // لا يرى الطرف قرار الآخر في نتيجة النظرة قبل أن يسجل قراره بنفسه.
  if (!myResult && (copy.journey_stage || copy.status) === 'sharia_viewing') {
    if (isSender) {
      copy.receiver_viewing_result = null;
      copy.receiver_viewing_note = null;
    } else {
      copy.sender_viewing_result = null;
      copy.sender_viewing_note = null;
    }
  }
  return copy;
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
      if (String(actorId) !== String(current.receiver_id) || !['sent', 'pending'].includes(current.journey_stage || current.status)) {
        throw new Error('لا يمكن قبول الطلب من هذه الحالة');
      }
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
      if (!['accepted', 'seriousness', 'accepted_pending_payment'].includes(current.journey_stage || current.status)) {
        throw new Error('العربون غير متاح في هذه المرحلة');
      }
      if ((String(actorId) === String(current.sender_id) && current.sender_paid) ||
          (String(actorId) === String(current.receiver_id) && current.receiver_paid)) {
        throw new Error('تم سداد عربونك لهذا الطلب مسبقاً');
      }
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
    case 'submit_contact': {
      if ((current.journey_stage || current.status) !== 'coordination' || !current.sender_paid || !current.receiver_paid) {
        throw new Error('مشاركة التواصل متاحة بعد سداد العربون من الطرفين');
      }
      const { data: actorMember } = await supabase.from('members').select('gender').eq('id', String(actorId)).maybeSingle();
      const allowedFields = actorMember?.gender === 'female'
        ? ['guardian_phone', 'guardian_name', 'guardian_relation', 'contact_time', 'contact_note']
        : ['male_phone', 'male_name', 'male_relation', 'male_contact_time', 'male_contact_note'];
      allowedFields.forEach((key) => {
        const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (payload[key] !== undefined || payload[camel] !== undefined) update[key] = payload[key] ?? payload[camel];
      });
      update.contact_by = String(actorId);
      break;
    }
    case 'male_pledge':
      update.male_pledged = true;
      break;
    case 'female_pledge':
      update.female_pledged = true;
      break;
    case 'advance_viewing':
    case 'confirm_advance': {
      const fromStage = current.journey_stage || current.status;
      const nextStage = payload.nextStage || 'sharia_viewing';
      if (fromStage !== 'coordination' || nextStage !== 'sharia_viewing') {
        throw new Error('لا يمكن تأكيد الانتقال من هذه المرحلة');
      }
      const { data: confirmations } = await supabase
        .from('request_events')
        .select('actor_id, payload')
        .eq('request_id', Number(current.id))
        .eq('action', 'confirm_advance');
      const otherId = String(actorId) === String(current.sender_id) ? current.receiver_id : current.sender_id;
      const otherConfirmed = (confirmations || []).some((event) =>
        String(event.actor_id) === String(otherId) &&
        (event.payload?.nextStage || 'sharia_viewing') === 'sharia_viewing'
      );
      if (otherConfirmed) setStage('sharia_viewing');
      break;
    }
    case 'record_result': {
      if ((current.journey_stage || current.status) !== 'sharia_viewing') {
        throw new Error('تسجيل نتيجة النظرة غير متاح في هذه المرحلة');
      }
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
    case 'pay_final_fee': {
      if ((current.journey_stage || current.status) !== 'engagement') {
        throw new Error('سداد المتبقي غير متاح في هذه المرحلة');
      }
      const { data: finalPayments } = await supabase
        .from('request_events')
        .select('actor_id')
        .eq('request_id', Number(current.id))
        .eq('action', 'pay_final_fee');
      const alreadyPaid = (finalPayments || []).some((event) => String(event.actor_id) === String(actorId));
      if (alreadyPaid) throw new Error('تم سداد المبلغ المتبقي لهذا الطلب مسبقاً');
      const otherId = String(actorId) === String(current.sender_id) ? current.receiver_id : current.sender_id;
      const otherPaid = (finalPayments || []).some((event) => String(event.actor_id) === String(otherId));
      if (otherPaid) {
        setStage('completed');
        update.evaluation_result = 'success';
        update.evaluation_note = payload.note || 'اكتمل سداد الطرفين بعد تسليم المهر';
      }
      break;
    }
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
      const { id, userId, events } = req.query;
      const viewer = await resolveViewer(req, res);
      if (!viewer) return;
      if (id && events === '1') {
        const { data: request, error: requestError } = await supabase
          .from('interest_requests')
          .select('sender_id, receiver_id')
          .eq('id', Number(id))
          .maybeSingle();
        if (requestError) throw requestError;
        if (!request) return res.status(404).json({ error: 'طلب التوافق غير موجود' });
        if (!viewer.isAdmin && ![request.sender_id, request.receiver_id].map(String).includes(String(viewer.memberId))) {
          return res.status(403).json({ error: 'لا يمكنك عرض سجل طلب لا يخصك' });
        }
        const { data, error } = await supabase
          .from('request_events')
          .select('*')
          .eq('request_id', Number(id))
          .order('created_at', { ascending: true });
        if (error) throw error;
        return res.status(200).json(data || []);
      }
      let query = supabase.from('interest_requests').select('*');
      if (id) query = query.eq('id', Number(id)).maybeSingle();
      else {
        const scopedUserId = viewer.isAdmin ? userId : viewer.memberId;
        if (scopedUserId) query = query.or(`sender_id.eq.${scopedUserId},receiver_id.eq.${scopedUserId}`);
        query = query.order('updated_at', { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;
      if (id) {
        if (!data) return res.status(404).json({ error: 'طلب التوافق غير موجود' });
        if (!viewer.isAdmin && ![data.sender_id, data.receiver_id].map(String).includes(String(viewer.memberId))) {
          return res.status(403).json({ error: 'لا يمكنك عرض طلب لا يخصك' });
        }
        return res.status(200).json(await withProgress(maskPrivateJourneyFields(data, viewer)));
      }
      return res.status(200).json(await Promise.all(
        (data || []).map((row) => withProgress(maskPrivateJourneyFields(row, viewer)))
      ));
    }

    if (req.method === 'POST') {
      const payload = compact(basePayload(req.body || {}));
      if (!payload.sender_id || !payload.receiver_id) return res.status(400).json({ error: 'senderId and receiverId are required' });

      const authz = await authorizeMemberAction(req, res, payload.sender_id);
      if (!authz) return;

      await ensureMemberExists(payload.sender_id);
      await ensureMemberExists(payload.receiver_id);

      const allowed = await checkRateLimit(`ir_create:${payload.sender_id}`, 20, 3600);
      if (!allowed) return res.status(429).json({ error: 'لقد تجاوزت الحد المسموح من طلبات التوافق في الساعة، حاول لاحقاً' });

      // منع التكرار: التحقق من وجود طلب نشط لنفس الطرفين قبل الإنشاء
      const TERMINAL_STAGES = ['declined', 'cancelled', 'completed'];
      const { data: existing } = await supabase
        .from('interest_requests')
        .select('id, status, journey_stage')
        .or(
          `and(sender_id.eq.${payload.sender_id},receiver_id.eq.${payload.receiver_id}),` +
          `and(sender_id.eq.${payload.receiver_id},receiver_id.eq.${payload.sender_id})`
        );
      const activeDuplicate = (existing || []).find((r) => {
        const stage = r.journey_stage || r.status || 'sent';
        return !TERMINAL_STAGES.includes(stage);
      });
      if (activeDuplicate) {
        return res.status(409).json({
          error: 'يوجد طلب توافق قائم بالفعل بينكما. افتح طلباتك لمتابعته.',
          existingId: activeDuplicate.id,
        });
      }

      let { data, error } = await supabase.from('interest_requests').insert(payload).select().single();
      if (isSchemaCacheError(error)) {
        const fallbackPayload = minimalRequestPayload(payload);
        const fallback = await supabase.from('interest_requests').insert(fallbackPayload).select().single();
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      await supabase.from('request_events').insert({
        request_id: Number(data.id),
        actor_id: String(payload.sender_id),
        action: 'sent',
        payload: { message: payload.message || '' },
      }).catch(() => undefined);
      await addNotification(payload.receiver_id, data.id, 'request', 'لديك طلب توافق جديد بانتظار الرد', 'طلب توافق جديد');
      return res.status(201).json(await withProgress(data));
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
      await supabase.from('request_events').insert({
        request_id: Number(id),
        actor_id: String(actorId),
        action,
        payload: { ...payload, resultingStage: data.journey_stage || data.status },
      }).catch(() => undefined);

      const actionMessages = {
        accept: ['تم قبول طلب التوافق بفضل الله', 'طلب التوافق مقبول'],
        decline: ['لم يُكتب النصيب في طلب التوافق', 'تحديث طلب التوافق'],
        cancel: ['تم إلغاء طلب التوافق', 'تحديث طلب التوافق'],
        pay_deposit: ['تم تحديث سداد عربون طلب التوافق', 'تحديث السداد'],
        submit_contact: ['شارك الطرف الآخر معلومات تواصل باختياره', 'معلومات تواصل جديدة'],
        confirm_advance: [
          (data.journey_stage || data.status) === 'sharia_viewing'
            ? 'وافق الطرفان على الانتقال إلى نتيجة النظرة الشرعية'
            : 'أكد الطرف الآخر استعداده للانتقال إلى نتيجة النظرة الشرعية',
          'تحديث رحلة التوافق',
        ],
        record_result: [
          (data.journey_stage || data.status) === 'engagement'
            ? 'تم القبول من الطرفين بفضل الله'
            : (data.journey_stage || data.status) === 'declined'
              ? 'لم يُكتب النصيب بعد النظرة الشرعية'
              : 'سجّل الطرف الآخر نتيجة النظرة الشرعية',
          'نتيجة النظرة الشرعية',
        ],
        pay_final_fee: [
          (data.journey_stage || data.status) === 'completed'
            ? 'اكتمل سداد الطرفين وتمت رحلة التوافق بفضل الله'
            : 'سدّد الطرف الآخر المبلغ المتبقي',
          'تحديث السداد',
        ],
      };
      const [notificationText, notificationTitle] = actionMessages[action] || ['تم تحديث رحلة التوافق الخاصة بك', 'تحديث رحلة التوافق'];
      const notifyId = String(actorId) === String(data.sender_id) ? data.receiver_id : data.sender_id;
      await addNotification(notifyId, data.id, 'match', notificationText, notificationTitle);
      if (isAdminAction) await writeAuditLog(actingAdminEmail || 'admin', `journey_${action}`, 'interest_request', id, {});
      return res.status(200).json(await withProgress(data));
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
