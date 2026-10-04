export const ANALYTICS_TIMEZONE = 'Asia/Riyadh';
export const SOURCES = ['Direct', 'Google', 'WhatsApp', 'Facebook', 'Instagram', 'TikTok', 'YouTube', 'Other'];
export const DEVICES = ['Android', 'iPhone', 'Computer'];
export const UNKNOWN_LOCATION = 'غير معروف';
export const PRESENCE_MS = 5 * 60 * 1000;
export function analyticsDay(now = new Date()) {
  return new Date(new Date(now).getTime() + 10800000).toISOString().slice(0, 10);
}
export function analyticsRange(days = 1, now = new Date()) {
  const endDay = analyticsDay(now);
  const first = new Date(`${endDay}T00:00:00+03:00`);
  const startDay = analyticsDay(new Date(first.getTime() - (days - 1) * 86400000));
  return { startDay, endDay, days };
}
export function deviceCategory(userAgent = '') {
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipod|ipad/i.test(userAgent)) return 'iPhone';
  return 'Computer';
}
export function normalizeSource(value) {
  const input = String(value || '').trim().toLowerCase();
  const aliases = { direct:'Direct', google:'Google', whatsapp:'WhatsApp', wa:'WhatsApp', facebook:'Facebook', fb:'Facebook', instagram:'Instagram', ig:'Instagram', tiktok:'TikTok', youtube:'YouTube', other:'Other' };
  return Object.hasOwn(aliases,input) ? aliases[input] : 'Other';
}
// Parse in the browser; send only an allowlisted category, never the URL/query.
export function visitSource(search = '', referrer = '', siteOrigin = '') {
  const params = new URLSearchParams(search);
  if (params.has('utm_source')) return normalizeSource(params.get('utm_source'));
  if (!referrer) return 'Direct';
  try {
    const url = new URL(referrer);
    if (siteOrigin && url.origin === siteOrigin) return 'Direct';
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'Google';
    if (host === 'wa.me' || /(^|\.)whatsapp.com$/.test(host)) return 'WhatsApp';
    if (/(^|\.)(facebook.com|fb.com)$/.test(host)) return 'Facebook';
    if (/(^|\.)instagram.com$/.test(host)) return 'Instagram';
    if (/(^|\.)tiktok.com$/.test(host)) return 'TikTok';
    if (host === 'youtu.be' || /(^|\.)youtube.com$/.test(host)) return 'YouTube';
  } catch { /* malformed referrer is never persisted */ }
  return 'Other';
}
export function activePresence(lastActivity, now = new Date()) {
  const t = Date.parse(lastActivity);
  return Number.isFinite(t) && t <= new Date(now).getTime() && t > new Date(now).getTime() - PRESENCE_MS;
}
export function summarizeDaily(rows, days = 1, now = new Date()) {
  const { startDay, endDay } = analyticsRange(days, now);
  const selected = rows.filter(row => row.day >= startDay && row.day <= endDay);
  const totals = { visits:0, registrations:0, durationSeconds:0, durationSamples:0 };
  const maps = { countries:{}, cities:{}, devices:Object.fromEntries(DEVICES.map(label=>[label,0])), sources:Object.fromEntries(SOURCES.map(label=>[label,0])) };
  for (const row of selected) {
    totals.visits += Number(row.visits || 0); totals.registrations += Number(row.registrations || 0);
    totals.durationSeconds += Number(row.duration_seconds_sum || 0); totals.durationSamples += Number(row.duration_samples || 0);
    for (const [label, field] of Object.entries({countries:'country_counts',cities:'city_counts',devices:'device_counts',sources:'source_counts'})) {
      for (const [key, count] of Object.entries(row[field] || {})) maps[label][key] = Number(maps[label][key] || 0) + Number(count || 0);
    }
  }
  const breakdown = Object.fromEntries(Object.entries(maps).map(([name,map])=>[name,Object.entries(map).map(([label,count])=>({label,count,percentage:totals.visits ? count / totals.visits * 100 : 0})).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label))]));
  return { ...totals, ...breakdown, startDay, endDay, days, conversionPercentage:totals.visits ? totals.registrations / totals.visits * 100 : null, averageDurationSeconds:totals.durationSamples ? totals.durationSeconds / totals.durationSamples : null };
}
