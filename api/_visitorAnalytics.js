import supabase from './db-client.js';
import { isAdminEmail } from './_auth.js';
import { analyticsDay, analyticsRange, deviceCategory, normalizeSource, summarizeDaily, UNKNOWN_LOCATION, PRESENCE_MS } from '../shared/visitorAnalytics.js';

export function analyticsScope(req = {}, env = process.env) {
  const host = String(req.headers?.host || '').split(':')[0].toLowerCase();
  const preview = host.match(/^deploy-preview-(\d+)--/);
  if (preview) return `preview:${preview[1]}`;
  if (env.CONTEXT === 'deploy-preview') return `preview:${env.REVIEW_ID || 'current'}`;
  if (env.CONTEXT === 'branch-deploy') return 'branch-preview';
  if (host === 'localhost' || host === '127.0.0.1' || !host) return 'local';
  return 'production';
}
function safeLocation(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s || s.length > 80 || /[<>@\x00-\x1f]/.test(s) || ['__proto__','constructor','prototype'].includes(s)) return UNKNOWN_LOCATION;
  return s;
}
export function coarseGeo(req = {}) {
  const geo = req.platformGeo;
  // Only provider-attached metadata. Never trust a client-supplied geo header,
  // perform an IP lookup, request GPS or call an external service.
  const code = safeLocation(typeof geo?.country === 'string' ? geo.country : geo?.country?.code);
  return { country:code, city:safeLocation(geo?.city) };
}
function ensureAnalyticsDatabase(db) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  if(db===supabase && (!url || url.includes('placeholder') || !process.env.SUPABASE_SERVICE_ROLE_KEY))throw new Error('Analytics requires a real server database configuration');
}
export async function requireAnalyticsAdmin(req, res, db = supabase) {
  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i,'').trim();
  // Analytics never accepts the old local/demo admin impersonation shortcut.
  if (!token || /^(local-token-|demo-admin-token)/.test(token)) { res.status(401).json({error:'يلزم تسجيل دخول مدير فعلي لعرض إحصائيات الزوار'}); return false; }
  ensureAnalyticsDatabase(db);
  const {data,error} = await db.auth.getUser(token);
  if (error || !data?.user) {res.status(401).json({error:'جلسة الدخول غير صالحة'});return false;}
  if (!(await isAdminEmail(data.user.email))) {res.status(403).json({error:'إحصائيات الزوار متاحة للإدارة فقط'});return false;}
  return true;
}
export async function cleanupVisitorAnalytics(db = supabase, now = new Date()) {
  const retentionDay = analyticsRange(30, now).startDay;
  const expiry = new Date(new Date(now).getTime() - PRESENCE_MS).toISOString();
  const [daily, presence] = await Promise.all([
    db.from('visitor_analytics_daily').delete().lt('day',retentionDay),
    db.from('visitor_analytics_presence').delete().lte('last_activity',expiry),
  ]);
  if (daily.error || presence.error) throw daily.error || presence.error;
}
const EMPTY = {visits:0,registrations:0,country_counts:{},city_counts:{},device_counts:{},source_counts:{},duration_seconds_sum:0,duration_samples:0,revision:0};
export async function incrementDaily(scope, change, db = supabase, now = new Date()) {
  const day = analyticsDay(now);
  for (let attempt=0; attempt<30; attempt++) {
    const read = await db.from('visitor_analytics_daily').select('*').eq('scope',scope).eq('day',day).maybeSingle();
    if(read.error)throw read.error;
    const old = read.data;
    const next = {...EMPTY,...old,scope,day,updated_at:new Date(now).toISOString(),revision:Number(old?.revision || 0)+1};
    next.visits = Number(next.visits)+Number(change.visits || 0);
    next.registrations = Number(next.registrations)+Number(change.registrations || 0);
    next.duration_seconds_sum = Number(next.duration_seconds_sum)+Number(change.durationSeconds || 0);
    next.duration_samples = Number(next.duration_samples)+Number(change.durationSamples || 0);
    if(change.visits) for(const [field,key] of Object.entries({country_counts:change.country,city_counts:change.city,device_counts:change.device,source_counts:change.source})) {
      next[field] = {...next[field],[key]:Number(next[field]?.[key] || 0)+Number(change.visits)};
    }
    const result = old
      ? await db.from('visitor_analytics_daily').update(next).eq('scope',scope).eq('day',day).eq('revision',old.revision).select('revision')
      : await db.from('visitor_analytics_daily').insert(next).select('revision');
    if(result.error?.code==='23505')continue;
    if(result.error)throw result.error;
    if(result.data?.length)return;
  }
  throw new Error('Analytics write contention');
}
export async function touchPresence(scope, sessionId, activity, db = supabase, now = new Date()) {
  const time = Math.min(Number(activity),new Date(now).getTime());
  if(!Number.isFinite(time) || time <= new Date(now).getTime()-PRESENCE_MS) return false;
  const timestamp = new Date(time).toISOString();
  const read = await db.from('visitor_analytics_presence').select('last_activity').eq('scope',scope).eq('session_id',sessionId).maybeSingle();
  if(read.error)throw read.error;
  if(read.data) {
    if(Date.parse(read.data.last_activity)<time) {
      const updated=await db.from('visitor_analytics_presence').update({last_activity:timestamp}).eq('scope',scope).eq('session_id',sessionId).lt('last_activity',timestamp);
      if(updated.error)throw updated.error;
    }
    return false;
  }
  const inserted=await db.from('visitor_analytics_presence').insert({scope,session_id:sessionId,last_activity:timestamp,duration_reported:false});
  if(inserted.error?.code==='23505')return false;
  if(inserted.error)throw inserted.error;
  return true;
}
export async function recordVisitorEvent(req, db = supabase, now = new Date()) {
  const body=req.body || {};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.sessionId || ''))throw Object.assign(new Error('معرف الجلسة العشوائي غير صالح'),{status:400});
  if(!['visit','activity','duration'].includes(body.event))throw Object.assign(new Error('نوع حدث غير صالح'),{status:400});
  ensureAnalyticsDatabase(db);
  const scope=analyticsScope(req);const sessionId=body.sessionId;
  await cleanupVisitorAnalytics(db,now);
  if(body.event==='duration') {
    const seconds=Number(body.durationSeconds);
    if(!Number.isFinite(seconds) || seconds<1 || seconds>86400)throw Object.assign(new Error('مدة غير صالحة'),{status:400});
    // A temporary boolean claims the sample once, while last activity still
    // determines presence for the full five-minute window. No duration ledger.
    const claimed=await db.from('visitor_analytics_presence').update({duration_reported:true}).eq('scope',scope).eq('session_id',sessionId).eq('duration_reported',false).select('last_activity');
    if(claimed.error)throw claimed.error;
    if(claimed.data?.length) {
      try {await incrementDaily(scope,{durationSeconds:Math.floor(seconds),durationSamples:1},db,now);}
      catch(error) {await db.from('visitor_analytics_presence').update({duration_reported:false}).eq('scope',scope).eq('session_id',sessionId);throw error;}
    }
    return;
  }
  const inserted=await touchPresence(scope,sessionId,body.lastActivityAt ?? new Date(now).getTime(),db,now);
  if(body.event==='visit' && inserted) {
    const geo=coarseGeo(req);
    try {
      await incrementDaily(scope,{visits:1,...geo,device:deviceCategory(req.headers?.['user-agent']),source:normalizeSource(body.source || 'Direct')},db,now);
    } catch(error) {
      await db.from('visitor_analytics_presence').delete().eq('scope',scope).eq('session_id',sessionId);
      throw error;
    }
  }
}
export async function recordSuccessfulRegistration(req, db = supabase, now = new Date()) {
  ensureAnalyticsDatabase(db);
  await cleanupVisitorAnalytics(db,now);
  await incrementDaily(analyticsScope(req),{registrations:1},db,now);
}
export async function readVisitorAnalytics(scope, days=1, db=supabase, now=new Date()) {
  ensureAnalyticsDatabase(db);
  await cleanupVisitorAnalytics(db,now);
  const range=analyticsRange(days,now);
  const [daily,active] = await Promise.all([
    db.from('visitor_analytics_daily').select('*').eq('scope',scope).gte('day',range.startDay).lte('day',range.endDay).order('day'),
    db.from('visitor_analytics_presence').select('session_id',{count:'exact',head:true}).eq('scope',scope).gt('last_activity',new Date(new Date(now).getTime()-PRESENCE_MS).toISOString()),
  ]);
  if(daily.error || active.error)throw daily.error || active.error;
  return {...summarizeDaily(daily.data || [],days,now),activeNow:Number(active.count || 0),scope,timeZone:'Asia/Riyadh',uniqueVisitorsAvailable:false,retentionDays:30,cleanupMode:'on_collection_and_admin_read',generatedAt:new Date(now).toISOString()};
}
