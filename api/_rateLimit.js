import supabase from './db-client.js';

/** حماية بسيطة من التكرار المفرط معتمدة على قاعدة البيانات (مناسبة للتوزيع الخادمي serverless) */
export async function checkRateLimit(key, max, windowSeconds) {
  const now = Date.now();
  try {
    const { data } = await supabase.from('rate_limits').select('*').eq('key', key).maybeSingle();
    if (!data) {
      await supabase.from('rate_limits').upsert({ key, count: 1, window_start: new Date(now).toISOString() });
      return true;
    }
    const windowStart = new Date(data.window_start).getTime();
    if (now - windowStart > windowSeconds * 1000) {
      await supabase.from('rate_limits').update({ count: 1, window_start: new Date(now).toISOString() }).eq('key', key);
      return true;
    }
    if (data.count >= max) return false;
    await supabase.from('rate_limits').update({ count: data.count + 1 }).eq('key', key);
    return true;
  } catch {
    // لا نوقف المستخدم بسبب فشل في تتبع الحد المفرط نفسه
    return true;
  }
}
