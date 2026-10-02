import supabase from './db-client.js';
import {
  authorizeMemberAction, requireAdmin, getAuthUser, getMemberLink, isAdminEmail,
} from './_auth.js';
import { checkRateLimit } from './_rateLimit.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function getRequest(requestId) {
  const { data, error } = await supabase
    .from('interest_requests')
    .select('id, sender_id, receiver_id')
    .eq('id', Number(requestId))
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function resolveMemberId(req) {
  const user = await getAuthUser(req);
  if (!user) return null;
  if (await isAdminEmail(user.email)) return 'admin';
  const link = await getMemberLink(user.id);
  if (link?.member_id) return String(link.member_id);
  const { data: member } = await supabase.from('members').select('id').eq('email', user.email || '').maybeSingle();
  return member?.id ? String(member.id) : null;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { requestId } = req.query;
      if (!requestId) {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
      } else {
        const [request, memberId] = await Promise.all([getRequest(requestId), resolveMemberId(req)]);
        if (!request) return res.status(404).json({ error: 'طلب التوافق غير موجود' });
        if (!memberId) return res.status(401).json({ error: 'يجب تسجيل الدخول لعرض المحادثة' });
        if (memberId !== 'admin' && ![request.sender_id, request.receiver_id].map(String).includes(memberId)) {
          return res.status(403).json({ error: 'هذه المحادثة تخص طلب توافق آخر' });
        }
      }
      let query = supabase.from('inquiry_messages').select('*');
      if (requestId) query = query.eq('request_id', String(requestId));
      query = query.order('created_at', { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const senderId = body.sender_id || body.senderId || 'admin';
      if (senderId !== 'admin') {
        const authz = await authorizeMemberAction(req, res, senderId);
        if (!authz) return;
        const allowed = await checkRateLimit(`inquiry_msg:${senderId}`, 60, 3600);
        if (!allowed) return res.status(429).json({ error: 'لقد تجاوزت الحد المسموح من الرسائل، حاول لاحقاً' });
      } else {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
      }
      const row = {
        id: body.id || `inq_${Date.now()}`,
        request_id: String(body.request_id || body.requestId),
        sender_id: senderId,
        message: body.text || body.message || '',
      };
      if (!row.request_id || !row.message) return res.status(400).json({ error: 'requestId and text are required' });
      const request = await getRequest(row.request_id);
      if (!request) return res.status(404).json({ error: 'طلب التوافق غير موجود' });
      if (senderId !== 'admin' && ![request.sender_id, request.receiver_id].map(String).includes(String(senderId))) {
        return res.status(403).json({ error: 'لا يمكنك إرسال رسالة في طلب لا يخصك' });
      }
      const { data, error } = await supabase.from('inquiry_messages').insert(row).select().single();
      if (error) throw error;
      const otherId = String(senderId) === String(request.sender_id) ? request.receiver_id : request.sender_id;
      if (senderId !== 'admin') {
        try {
          const { error: notificationError } = await supabase.from('notifications').insert({
            user_id: String(otherId),
            request_id: Number(request.id),
            type: 'message',
            title: 'رسالة جديدة في طلب التوافق',
            message: 'لديك رسالة جديدة مرتبطة بطلب التوافق.',
            read: false,
          });
          if (notificationError) console.warn('Inquiry notification skipped:', notificationError.message);
        } catch (notificationError) {
          console.warn('Inquiry notification skipped:', notificationError?.message || notificationError);
        }
      }
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id, action, moderatorName, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });

      let update;
      if (action === 'approve') {
        update = {
          approved: true,
          rejected: false,
          moderated_by: moderatorName || admin.email || 'admin',
          moderated_at: new Date().toISOString(),
        };
      } else if (action === 'reject') {
        update = {
          approved: false,
          rejected: true,
          moderated_by: moderatorName || admin.email || 'admin',
          moderated_at: new Date().toISOString(),
        };
      } else {
        update = { message: fields.message || fields.text || '' };
      }

      const { data, error } = await supabase.from('inquiry_messages').update(update).eq('id', String(id)).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('inquiry_messages').delete().eq('id', String(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Inquiry messages API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
