import supabase from './db-client.js';

/** تسجيل إجراء إداري في سجل التدقيق — لا يُفشل الطلب الأصلي إذا فشل التسجيل */
export async function writeAuditLog(actorEmail, action, targetType, targetId, details = {}) {
  try {
    await supabase.from('audit_logs').insert({
      actor_email: actorEmail || 'unknown',
      action,
      target_type: targetType,
      target_id: targetId ? String(targetId) : null,
      details,
    });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}
