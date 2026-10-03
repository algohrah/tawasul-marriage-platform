// One active catalog. Legacy values are read-only compatibility aliases;
// historical records are never rewritten or removed by this module.
export const FEATURED_PLAN = 'featured';
export const FEATURED_NAME = 'توافق مميز';
export const FEATURED_PRICE = 99;
export const FREE_FILTERS = ['gender', 'country', 'age', 'city'];
export function normalizePlan(plan, premium = false) {
  const value = String(plan || '').trim().toLowerCase();
  return premium || (value && value !== 'free') ? FEATURED_PLAN : 'free';
}
export function memberPlan(member) {
  return normalizePlan(typeof member === 'string' ? member : member?.plan, typeof member === 'object' && !!member?.premium);
}
export function isFeatured(member) { return memberPlan(member) === FEATURED_PLAN; }
export function dailyRequestLimit(member) { return isFeatured(member) ? 20 : 5; }
export function canUseFilter(member, filter) { return FREE_FILTERS.includes(filter) || isFeatured(member); }
// Calendar-day quota, UTC+03:00 (Saudi Arabia/Yemen), shared by client/API.
export function requestDay(now = new Date()) {
  const time = new Date(now).getTime();
  const key = new Date(time + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const start = new Date(`${key}T00:00:00+03:00`);
  return { key, start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}
export function compareMemberPriority(a, b, scoreA = 0, scoreB = 0) {
  // Membership boosts peers within a compatibility band, not poor matches.
  const band = Math.floor(scoreB / 10) - Math.floor(scoreA / 10);
  if (band) return band;
  const featured = Number(isFeatured(b)) - Number(isFeatured(a));
  if (featured) return featured;
  if (scoreA !== scoreB) return scoreB - scoreA;
  return Number(!!b.pinned) - Number(!!a.pinned);
}
