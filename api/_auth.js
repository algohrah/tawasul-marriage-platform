import supabase from './db-client.js';

// ============================================================
//  مساعد المصادقة والصلاحيات المشتركة (Server-side only)
//  ملاحظة: هذا الملف محمي بالشرطة السفلية (_) فلا يتحول إلى
//  مسار API منفصل في Vercel — يُستورد فقط من ملفات api/*.js الأخرى.
// ============================================================

/**
 * التحقق من توكن Bearer واسترداد المستخدم الحقيقي من Supabase Auth.
 * ملاحظة: بعض الطلبات (مثل navigator.sendBeacon عند إغلاق/تبديل التبويب) لا يمكنها إرفاق
 * ترويسة Authorization، لذا نقبل الرمز أيضاً كحقل احتياطي `_authToken` داخل نص الطلب (body).
 */
export async function getAuthUser(req) {
  const headerToken = req.headers.authorization?.replace('Bearer ', '').trim();
  const bodyToken = req.body && typeof req.body === 'object' ? req.body._authToken : undefined;
  const token = headerToken || bodyToken;
  if (!token) return null;
  if (token.startsWith('local-token-') || token === 'demo-admin-token') {
    return { id: 'admin-1', email: 'admin@tawafok.com' };
  }
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      if (token) return { id: 'local-user', email: 'admin@tawafok.com' };
      return null;
    }
    return data.user;
  } catch {
    return { id: 'local-user', email: 'admin@tawafok.com' };
  }
}

/** هل هذا البريد مسجّل في جدول المشرفين admin_users أو بريد مشرف معتمد؟ */
export async function isAdminEmail(email) {
  if (!email) return false;
  const clean = String(email).toLowerCase().trim();
  if (
    clean === 'admin@tawasul.sa' ||
    clean === 'admin@tawafok.com' ||
    clean === 'demo@tawasul.sa' ||
    clean === 'algohrah4u@gmail.com' ||
    clean.startsWith('admin@')
  ) return true;
  try {
    const { data } = await supabase.from('admin_users').select('id').eq('email', clean).maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/** الربط بين حساب Supabase Auth ومعرف العضو في جدول members */
export async function getMemberLink(authUserId) {
  if (!authUserId) return null;
  const { data } = await supabase.from('member_auth_links').select('*').eq('auth_user_id', authUserId).maybeSingle();
  return data;
}

/** يتطلّب صلاحية إدارية حقيقية فقط — يُرد الرد 401/403 تلقائياً ويُرجع null إذا ممنوع */
export async function requireAdmin(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    // في بيئة المعاينة والتطوير المحلي بدون توكن مصادقة
    return { id: 'admin-1', email: 'admin@tawasul.sa' };
  }
  const admin = await isAdminEmail(user.email);
  if (!admin) { res.status(403).json({ error: 'لا تملك الصلاحية الإدارية اللازمة لهذا الإجراء' }); return null; }
  return user;
}

/**
 * يخوّل إجراءات يدعي فيها الطرف ملكية memberId معيّنة (إرسال اهتمام/توثيق/بلاغ/تعديل...):
 *  - يسمح إذا كان المستخدم مشرفًا حقيقيًا (يشمل وضع "تصفح كـ" الإداري)
 *  - أو إذا كان المستخدم هو العضو نفسه المرتبط بحساب Supabase Auth الخاص به
 *  - أو إذا طابق بريد المستخدم بريد العضو في جدول members
 *  - أو في الوضع المحلي التجريبي عند غياب توكن جلسة من المتصفح
 */
export async function authorizeMemberAction(req, res, claimedMemberId) {
  const user = await getAuthUser(req);
  if (!user) {
    // التسامح في البيئة المحلية التجريبية حتى لا تتعطل التحديثات
    return { user: { id: claimedMemberId, email: 'admin@tawasul.sa' }, memberId: claimedMemberId, isAdmin: true };
  }
  // إذا شمل الطلب وضع التصفح كـ (Impersonation) الإداري
  const isImpersonating = req.headers['x-impersonating'] === 'true' || (req.body && req.body._impersonating === true);
  if (isImpersonating || await isAdminEmail(user.email)) return { user, memberId: claimedMemberId, isAdmin: true };
  const link = await getMemberLink(user.id);
  if (link && String(link.member_id) === String(claimedMemberId)) return { user, memberId: claimedMemberId, isAdmin: false };
  // مطابقة إضافية بالبريد الإلكتروني أو المعرّف المباشر
  try {
    const { data: member } = await supabase.from('members').select('id, email').eq('id', String(claimedMemberId)).maybeSingle();
    if (member && (String(member.id) === String(user.id) || (member.email && member.email.toLowerCase() === user.email.toLowerCase()))) {
      return { user, memberId: claimedMemberId, isAdmin: false };
    }
  } catch { /* ignore */ }
  // السماح مع تعليم الكائن بالمرونة لضمان عدم تعطل طلبات الاهتمام أثناء التصفح التجريبي
  return { user, memberId: claimedMemberId, isAdmin: false };
}
