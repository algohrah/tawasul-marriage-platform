import { dailyRequestLimit, memberPlan, requestDay } from '../shared/membership.js';

export async function dailyRequestUsage(db, memberId, now = new Date()) {
  const day = requestDay(now);
  const key = `membership_requests:${memberId}:${day.key}`;
  const [{ data: member, error: memberError }, { count, error: countError }, { data: counter, error: counterError }] = await Promise.all([
    db.from('members').select('id, plan, premium').eq('id', String(memberId)).maybeSingle(),
    db.from('interest_requests').select('id', { count: 'exact', head: true }).eq('sender_id', String(memberId)).gte('created_at', day.start).lt('created_at', day.end),
    db.from('rate_limits').select('count').eq('key', key).maybeSingle(),
  ]);
  if (memberError || countError || counterError) throw memberError || countError || counterError;
  if (!member) throw new Error('ملف العضو غير موجود');
  const used = Math.max(Number(count || 0), Number(counter?.count || 0));
  const limit = dailyRequestLimit(member);
  return { plan: memberPlan(member), used, limit, remaining: Math.max(0, limit - used), resetAt: day.end, key, day, counter };
}

// Existing rate_limits primary key + compare-and-swap make simultaneous POSTs
// respect the quota without adding tables, RPCs or changing the schema.
export async function reserveDailyRequest(db, memberId, now = new Date()) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const usage = await dailyRequestUsage(db, memberId, now);
    if (usage.remaining === 0) return { ok: false, ...usage };
    if (!usage.counter) {
      const { error } = await db.from('rate_limits').insert({ key: usage.key, count: usage.used + 1, window_start: usage.day.start, updated_at: new Date().toISOString() });
      if (error?.code === '23505') continue;
      if (error) throw error;
      return { ok: true, ...usage };
    }
    const { data, error } = await db.from('rate_limits').update({ count: usage.used + 1, updated_at: new Date().toISOString() }).eq('key', usage.key).eq('count', usage.counter.count).select('key');
    if (error) throw error;
    if (data?.length) return { ok: true, ...usage };
  }
  throw new Error('تعذر حجز طلب جديد الآن. حاول مرة أخرى.');
}

export async function releaseDailyRequest(db, key) {
  if (!key) return;
  for (let attempt = 0; attempt < 30; attempt++) {
    const { data: row, error } = await db.from('rate_limits').select('count').eq('key', key).maybeSingle();
    if (error) throw error;
    if (!row || Number(row.count) === 0) return;
    const result = await db.from('rate_limits').update({ count: Number(row.count) - 1 }).eq('key', key).eq('count', row.count).select('key');
    if (result.error) throw result.error;
    if (result.data?.length) return;
  }
}
