import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {analyticsDb,apiResponse} from './visitor-db-fixture.mjs';
import {analyticsDay,analyticsRange,deviceCategory,visitSource,normalizeSource,activePresence,summarizeDaily,SOURCES} from '../shared/visitorAnalytics.js';
import {analyticsScope,coarseGeo,recordVisitorEvent,readVisitorAnalytics,incrementDaily,cleanupVisitorAnalytics,recordSuccessfulRegistration,requireAnalyticsAdmin,touchPresence,deleteVisitorAnalytics} from '../api/_visitorAnalytics.js';
import dbClient from '../api/db-client.js';
import eventsHandler from '../api/visitor-events.js';
import statsHandler from '../api/visitor-analytics.js';
import registerHandler from '../api/register-auth.js';
const now=new Date('2026-10-04T08:00:00Z');
const req=(event='visit',extra={},id=randomUUID())=>({headers:{host:'deploy-preview-18--tawafok.netlify.app','user-agent':'Android'},platformGeo:{country:{code:'SA'},city:'Riyadh'},body:{event,sessionId:id,source:'WhatsApp',lastActivityAt:now.getTime(),...extra}});
function patch(db){dbClient.from=db.from;dbClient.auth=db.auth;process.env.VITE_SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='isolated-fixture';}
async function invoke(handler,request,db){patch(db);const res=apiResponse();await handler(request,res);return res;}
test('UTC+3 midnight and inclusive calendar retention boundary',()=>{
 assert.equal(analyticsDay('2026-10-03T20:59:59Z'),'2026-10-03');assert.equal(analyticsDay('2026-10-03T21:00:00Z'),'2026-10-04');
 assert.deepEqual(analyticsRange(30,now),{startDay:'2026-09-05',endDay:'2026-10-04',days:30});assert.equal(analyticsRange(7,now).startDay,'2026-09-28');
});
test('all device categories and eight source categories are allowlisted',()=>{
 assert.equal(deviceCategory('Android'),'Android');assert.equal(deviceCategory('iPhone'),'iPhone');assert.equal(deviceCategory('iPad'),'iPhone');assert.equal(deviceCategory('Windows Mac Linux'),'Computer');
 for(const source of SOURCES)assert.equal(visitSource(`?utm_source=${source}`),source);
 for(const [url,source] of [['https://www.google.com/search?q=private','Google'],['https://wa.me/1234','WhatsApp'],['https://m.facebook.com/x','Facebook'],['https://instagram.com/x','Instagram'],['https://tiktok.com/x','TikTok'],['https://youtu.be/x','YouTube'],['https://unknown.example/private','Other']])assert.equal(visitSource('',url),source);
 assert.equal(visitSource('','https://own.test/secret','https://own.test'),'Direct');assert.equal(visitSource(),'Direct');assert.equal(visitSource('','bad'),'Other');assert.equal(normalizeSource('constructor'),'Other');
});
test('geography uses only attached native metadata, rejects forged body/headers',()=>{
 assert.deepEqual(coarseGeo(req()),{country:'SA',city:'Riyadh'});
 assert.deepEqual(coarseGeo({platform:'netlify',headers:{'x-nf-geo':Buffer.from(JSON.stringify({city:'Forged',country:'SA'})).toString('base64')},body:{country:'US',city:'Forged'}}),{country:'غير معروف',city:'غير معروف'});
 assert.equal(coarseGeo({platformGeo:{city:'__proto__',country:'someone@private.invalid'}}).city,'غير معروف');
});
test('production and deploy preview cannot select each others scope from body',()=>{
 assert.equal(analyticsScope({...req(),body:{scope:'production'}},{}),'preview:18');assert.equal(analyticsScope({headers:{host:'tawafok.sa'}},{}),'production');assert.equal(analyticsScope({headers:{host:'localhost:5173'}},{}),'local');
});
test('simultaneous duplicate visits count once with no lost aggregates',async()=>{
 const db=analyticsDb();const request=req();await Promise.all(Array.from({length:10},()=>recordVisitorEvent(request,db,now)));
 assert.equal(db.tables.visitor_analytics_daily[0].visits,1);assert.equal(db.tables.visitor_analytics_presence.length,1);
 await Promise.all(Array.from({length:20},()=>recordVisitorEvent(req(),db,now)));
 const row=db.tables.visitor_analytics_daily[0];assert.equal(row.visits,21);assert.equal(row.source_counts.WhatsApp,21);assert.equal(row.country_counts.SA,21);assert.equal(row.device_counts.Android,21);
 assert.deepEqual([...new Set(db.calls.map(c=>c.table))].sort(),['visitor_analytics_daily','visitor_analytics_presence']);
});
test('five-minute boundary expires, idle heartbeats do not resurrect old activity',async()=>{
 const db=analyticsDb();const request=req();await recordVisitorEvent(request,db,now);
 assert.equal(activePresence(now.toISOString(),new Date(now.getTime()+299999)),true);
 assert.equal(activePresence(now.toISOString(),new Date(now.getTime()+300000)),false);
 assert.equal((await readVisitorAnalytics('preview:18',1,db,new Date(now.getTime()+299999))).activeNow,1);
 assert.equal((await readVisitorAnalytics('preview:18',1,db,new Date(now.getTime()+300000))).activeNow,0);
 request.body.event='activity';await recordVisitorEvent(request,db,new Date(now.getTime()+300000));assert.equal(db.tables.visitor_analytics_presence.length,0);
 request.body.lastActivityAt=now.getTime()+301000;await recordVisitorEvent(request,db,new Date(now.getTime()+301000));assert.equal(db.tables.visitor_analytics_presence.length,1);assert.equal(db.tables.visitor_analytics_daily[0].visits,1);
});
test('future client times are clamped and last activity cannot move backwards',async()=>{
 const db=analyticsDb(),id=randomUUID();await touchPresence('local',id,now.getTime()+10000000,db,now);assert.equal(db.tables.visitor_analytics_presence[0].last_activity,now.toISOString());
 await touchPresence('local',id,now.getTime()-1000,db,now);assert.equal(db.tables.visitor_analytics_presence[0].last_activity,now.toISOString());
});
test('completed foreground duration deduplicates and does not delete online presence',async()=>{
 const db=analyticsDb();const request=req();await recordVisitorEvent(request,db,now);
 request.body={...request.body,event:'duration',durationSeconds:75};await Promise.all(Array.from({length:5},()=>recordVisitorEvent(request,db,now)));
 const stats=await readVisitorAnalytics('preview:18',1,db,now);assert.equal(stats.averageDurationSeconds,75);assert.equal(stats.durationSamples,1);assert.equal(stats.activeNow,1);
});
test('aggregated totals, percentages and denominators for today/7/30; zero values',()=>{
 const row=(day,visits,registrations)=>({day,visits,registrations,country_counts:{SA:visits},city_counts:{Riyadh:visits},device_counts:{Android:visits},source_counts:{Direct:visits},duration_seconds_sum:100,duration_samples:2});
 const rows=[row('2026-10-04',10,2),row('2026-09-28',20,4),row('2026-09-05',30,6),row('2026-09-04',500,400)];
 for(const [days,visits] of [[1,10],[7,30],[30,60]]){const s=summarizeDaily(rows,days,now);assert.equal(s.visits,visits);assert.equal(s.conversionPercentage,20);assert.equal(s.countries[0].percentage,100);assert.equal(s.averageDurationSeconds,50);assert.equal(s.devices.reduce((n,r)=>n+r.count,0),visits);}
 const empty=summarizeDaily([],30,now);assert.equal(empty.conversionPercentage,null);assert.equal(empty.averageDurationSeconds,null);assert.equal(empty.sources.length,8);assert.ok(empty.sources.every(r=>r.percentage===0));
});
test('cleanup removes only expired analytics and preserves 30th day/original tables',async()=>{
 const original={members:[{id:'preserve'}],rate_limits:[{key:'preserve'}],settings:[{key:'preserve'}]};
 const db=analyticsDb({...original,visitor_analytics_daily:[{scope:'local',day:'2026-09-04'},{scope:'local',day:'2026-09-05'}],visitor_analytics_presence:[{session_id:randomUUID(),last_activity:new Date(now.getTime()-300000).toISOString()},{session_id:randomUUID(),last_activity:new Date(now.getTime()-299999).toISOString()}]});
 await cleanupVisitorAnalytics(db,now);assert.equal(db.tables.visitor_analytics_daily.length,1);assert.equal(db.tables.visitor_analytics_daily[0].day,'2026-09-05');assert.equal(db.tables.visitor_analytics_presence.length,1);
 for(const [table,rows]of Object.entries(original))assert.deepEqual(db.tables[table],rows);
});
test('registration helper never uses identity or rate_limits',async()=>{
 const db=analyticsDb();await recordSuccessfulRegistration({...req(),body:{email:'not-persisted@test.invalid'},headers:{...req().headers,'x-forwarded-for':'192.0.2.1'}},db,now);
 assert.equal(db.tables.visitor_analytics_daily[0].registrations,1);assert.equal(db.tables.visitor_analytics_daily[0].visits,0);assert.ok(db.calls.every(c=>c.table.startsWith('visitor_analytics_')));
 assert.ok(!JSON.stringify(db.tables).includes('not-persisted'));assert.ok(!JSON.stringify(db.tables).includes('192.0.2.1'));
});
test('real verification gate rejects no auth, demo impersonation, invalid and non-admin',async()=>{
 const db=analyticsDb();patch(db);
 for(const [token,status]of [['',401],['local-token-123',401],['demo-admin-token',401],['invalid',401],['member-session',403]]){
  const res=apiResponse();assert.equal(await requireAnalyticsAdmin({headers:{authorization:token?`Bearer ${token}`:''}},res,db),false);assert.equal(res.statusCode,status);
 }
 assert.equal(await requireAnalyticsAdmin({headers:{authorization:'Bearer admin-session'}},apiResponse(),db),true);
});
test('public API rejects registration spoof, malformed token, cross-origin and large body',async()=>{
 const db=analyticsDb();
 for(const [body,status]of [[{event:'registration',sessionId:randomUUID()},400],[{event:'visit',sessionId:'member-id'},400],[{event:'visit',sessionId:randomUUID(),extra:'x'.repeat(1500)},413]]){
  const result=await invoke(eventsHandler,{method:'POST',headers:{host:'app.test'},body},db);assert.equal(result.statusCode,status);
 }
 const result=await invoke(eventsHandler,{method:'POST',headers:{host:'app.test',origin:'https://attacker.test'},body:req().body},db);assert.equal(result.statusCode,403);assert.equal(db.tables.visitor_analytics_daily.length,0);
});
test('API writes visit, serves only admin aggregate data and enforces period',async()=>{
 const db=analyticsDb();const request=req();request.method='POST';request.body.lastActivityAt=Date.now();
 assert.equal((await invoke(eventsHandler,request,db)).statusCode,202);
 const get={method:'GET',headers:{host:request.headers.host,authorization:'Bearer admin-session'},query:{days:'30'}};
 let result=await invoke(statsHandler,get,db);assert.equal(result.statusCode,200);assert.equal(result.body.visits,1);assert.equal(result.body.activeNow,1);assert.equal(result.body.scope,'preview:18');assert.equal(result.body.uniqueVisitorsAvailable,false);assert.ok(!JSON.stringify(result.body).includes(request.body.sessionId));
 result=await invoke(statsHandler,{...get,query:{days:'90'}},db);assert.equal(result.statusCode,400);
 result=await invoke(statsHandler,{...get,headers:{host:request.headers.host}},db);assert.equal(result.statusCode,401);
});
test('successful actual signup increments once, failed/duplicate/invalid signup not counted',async()=>{
 const request={method:'POST',headers:{host:'deploy-preview-18--tawafok.netlify.app'},body:{email:'fixture@test.invalid',password:'not-a-real-password'}};
 const db=analyticsDb();let result=await invoke(registerHandler,request,db);assert.equal(result.statusCode,201);assert.equal(db.tables.visitor_analytics_daily[0].registrations,1);
 const bad=analyticsDb();bad.auth.admin.createUser=async()=>({data:{},error:{message:'Already registered'}});result=await invoke(registerHandler,request,bad);assert.equal(result.statusCode,409);assert.equal(bad.tables.visitor_analytics_daily.length,0);
 const failed=analyticsDb();failed.auth.admin.createUser=async()=>({data:{},error:{message:'Controlled validation failure'}});result=await invoke(registerHandler,request,failed);assert.equal(result.statusCode,400);assert.equal(failed.tables.visitor_analytics_daily.length,0);
 const invalid=analyticsDb();result=await invoke(registerHandler,{...request,body:{email:'bad',password:'x'}},invalid);assert.equal(result.statusCode,400);assert.equal(invalid.tables.visitor_analytics_daily.length,0);
 const noId=analyticsDb();noId.auth.admin.createUser=async()=>({data:{user:null},error:null});result=await invoke(registerHandler,request,noId);assert.equal(noId.tables.visitor_analytics_daily.length,0);
});
test('analytics failure cannot break successful signup and never returns database details',async()=>{
 const db=analyticsDb();db.failTable='visitor_analytics_daily';let result=await invoke(registerHandler,{method:'POST',headers:{host:'app.test'},body:{email:'fixture@test.invalid',password:'not-a-real-password'}},db);assert.equal(result.statusCode,201);
 const request=req();request.method='POST';request.body.lastActivityAt=Date.now();result=await invoke(eventsHandler,request,db);assert.equal(result.statusCode,503);assert.ok(!JSON.stringify(result.body).includes('Controlled'));assert.equal(db.tables.visitor_analytics_presence.length,0);
});
test('schema includes only two analytics tables, grants no client access, no PII/cron',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/202610040001_visitor_analytics.sql',import.meta.url),'utf8');assert.equal((sql.match(/CREATE TABLE/g)||[]).length,2);assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g)||[]).length,2);assert.match(sql,/REVOKE ALL.*PUBLIC, anon, authenticated/);assert.doesNotMatch(sql,/CREATE EXTENSION|CREATE FUNCTION|cron\.schedule|DROP TABLE|ALTER TABLE public\.members/i);
});
test('missing server database configuration cannot fall back to fake admin or fake analytics success',async()=>{
 const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 try{await assert.rejects(readVisitorAnalytics('local'),/real server database/);const res=apiResponse();await statsHandler({method:'GET',headers:{authorization:'Bearer arbitrary'}},res);assert.equal(res.statusCode,503);}finally{process.env.SUPABASE_SERVICE_ROLE_KEY=previous;}
});
test('actual Netlify dispatcher routes analytics with native context and without context',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);const dispatcher=require('../netlify/functions/api-classic.cjs');
 const db=analyticsDb();patch(db);
 const event={path:'/api/visitor-events',httpMethod:'POST',headers:{host:'deploy-preview-18--tawafok.netlify.app','user-agent':'iPhone'},body:JSON.stringify({...req().body,sessionId:randomUUID(),lastActivityAt:Date.now(),source:'Google'})};
 let result=await dispatcher.handler(event,{geo:{country:{code:'YE'},city:'Aden'}});assert.equal(result.statusCode,202);assert.equal(db.tables.visitor_analytics_daily[0].country_counts.YE,1);assert.equal(db.tables.visitor_analytics_daily[0].city_counts.Aden,1);
 result=await dispatcher.handler({...event,body:JSON.stringify({...req().body,sessionId:randomUUID(),lastActivityAt:Date.now()})});assert.equal(result.statusCode,202);assert.equal(db.tables.visitor_analytics_daily[0].country_counts['غير معروف'],1);
 result=await dispatcher.handler({path:'/api/visitor-analytics',httpMethod:'GET',headers:{host:event.headers.host,authorization:'Bearer admin-session'},queryStringParameters:{days:'1'}});assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).visits,2);
 result=await dispatcher.handler({path:'/api/settings',httpMethod:'OPTIONS',headers:{}});assert.equal(result.statusCode,204);
});

test('build scope isolates internal deploy URLs even when runtime build env is unavailable',async()=>{
 const {buildAnalyticsScope}=await import('../scripts/write-analytics-scope.mjs');
 assert.equal(buildAnalyticsScope({CONTEXT:'deploy-preview',REVIEW_ID:'18'}),'preview:18');
 assert.equal(buildAnalyticsScope({DEPLOY_PRIME_URL:'https://deploy-preview-18--tawafok.netlify.app'}),'preview:18');
 assert.equal(buildAnalyticsScope({CONTEXT:'production'}),'production');assert.equal(buildAnalyticsScope({}),null);
 assert.equal(analyticsScope({headers:{host:'6ac19c821f02f40008c2e04a--tawafok.netlify.app'}},{}),'deployment:6ac19c821f02f40008c2e04a');
 assert.equal(analyticsScope({headers:{host:'feat-visitor-analytics--tawafok.netlify.app'}},{}),'branch-preview');
});

function deletionSeed(clock=now) {
 const day=analyticsDay(clock);
 const dates=[analyticsRange(30,clock).startDay,analyticsRange(7,clock).startDay,day];
 const before30=analyticsDay(new Date(new Date(clock).getTime()-30*86400000));
 const tomorrow=analyticsDay(new Date(new Date(clock).getTime()+86400000));
 const days=[before30,...dates,tomorrow];
 const original={members:[{id:'do-not-touch'}],interest_requests:[{id:'do-not-touch'}],journeys:[{id:'do-not-touch'}],transactions:[{id:'do-not-touch'}],settings:[{key:'do-not-touch'}],rate_limits:[{key:'do-not-touch'}]};
 return {...original,visitor_analytics_daily:[...days.map(day=>({scope:'preview:18',day,visits:10})),{scope:'production',day,visits:9}],visitor_analytics_presence:[...days.map(day=>({scope:'preview:18',session_id:randomUUID(),last_activity:new Date(`${day}T12:00:00+03:00`).toISOString()})),{scope:'production',session_id:randomUUID(),last_activity:new Date(clock).toISOString()}]};
}
for(const [period,expected]of [[1,1],[7,2],[30,3],['all',5]])test(`authorized deletion helper ${period}: exact UTC+3 range and current environment only`,async()=>{
 const seed=deletionSeed(),db=analyticsDb(seed);const result=await deleteVisitorAnalytics('preview:18',period,db,now);
 assert.equal(result.deletedDailyRows,expected);assert.equal(result.deletedPresenceRows,expected);
 assert.equal(db.tables.visitor_analytics_daily.filter(r=>r.scope==='preview:18').length,5-expected);
 assert.equal(db.tables.visitor_analytics_daily.find(r=>r.scope==='production').visits,9);assert.equal(db.tables.visitor_analytics_presence.filter(r=>r.scope==='production').length,1);
 for(const table of ['members','interest_requests','journeys','transactions','settings','rate_limits'])assert.deepEqual(db.tables[table],seed[table]);
 assert.ok(db.calls.every(c=>['visitor_analytics_daily','visitor_analytics_presence'].includes(c.table)));
});
test('manual presence deletion uses UTC+3 midnight rather than UTC midnight',async()=>{
 const db=analyticsDb({visitor_analytics_presence:[{scope:'preview:18',session_id:randomUUID(),last_activity:'2026-10-03T20:59:59Z'},{scope:'preview:18',session_id:randomUUID(),last_activity:'2026-10-03T21:00:00Z'},{scope:'preview:18',session_id:randomUUID(),last_activity:'2026-10-04T20:59:59Z'},{scope:'preview:18',session_id:randomUUID(),last_activity:'2026-10-04T21:00:00Z'}]});
 const result=await deleteVisitorAnalytics('preview:18',1,db,now);assert.equal(result.deletedPresenceRows,2);assert.deepEqual(db.tables.visitor_analytics_presence.map(r=>r.last_activity),['2026-10-03T20:59:59Z','2026-10-04T21:00:00Z']);
});
test('unauthenticated, invalid, demo and ordinary members cannot delete anything',async()=>{
 for(const [token,status]of [['',401],['invalid',401],['local-token-123',401],['demo-admin-token',401],['member-session',403]]){
  const seed=deletionSeed(),db=analyticsDb(seed);const result=await invoke(statsHandler,{method:'DELETE',headers:{host:req().headers.host,authorization:token?`Bearer ${token}`:''},body:{period:'all',confirmation:'حذف الكل'}},db);
  assert.equal(result.statusCode,status);assert.deepEqual(db.tables.visitor_analytics_daily,seed.visitor_analytics_daily);assert.deepEqual(db.tables.visitor_analytics_presence,seed.visitor_analytics_presence);assert.ok(!db.calls.some(c=>c.action==='delete'));
 }
});
test('authorized admin API deletion and subsequent read show updated totals',async()=>{
 const db=analyticsDb(deletionSeed(new Date()));
 const request={method:'DELETE',headers:{host:req().headers.host,authorization:'Bearer admin-session'},body:{period:1,confirmation:'CONFIRM_VISITOR_ANALYTICS_DELETE',scope:'production',table:'members'}};
 const deleted=await invoke(statsHandler,request,db);assert.equal(deleted.statusCode,200);assert.equal(deleted.body.scope,'preview:18');assert.equal(deleted.body.deletedDailyRows,1);
 const fresh=await invoke(statsHandler,{method:'GET',headers:request.headers,query:{days:'1'}},db);assert.equal(fresh.statusCode,200);assert.equal(fresh.body.visits,0);assert.equal(db.tables.visitor_analytics_daily.find(r=>r.scope==='production').visits,9);assert.equal(db.tables.members[0].id,'do-not-touch');
});
test('all deletion requires its stronger explicit confirmation and is repeat-safe',async()=>{
 const db=analyticsDb(deletionSeed(new Date()));const request={method:'DELETE',headers:{host:req().headers.host,authorization:'Bearer admin-session'},body:{period:'all',confirmation:'CONFIRM_VISITOR_ANALYTICS_DELETE'}};
 assert.equal((await invoke(statsHandler,request,db)).statusCode,400);assert.ok(!db.calls.some(c=>c.action==='delete'));
 request.body.confirmation='حذف الكل';let result=await invoke(statsHandler,request,db);assert.equal(result.statusCode,200);assert.equal(result.body.deletedDailyRows,5);assert.equal(result.body.deletedPresenceRows,5);
 result=await invoke(statsHandler,request,db);assert.equal(result.statusCode,200);assert.equal(result.body.deletedDailyRows,0);assert.equal(result.body.deletedPresenceRows,0);
});
test('missing confirmation or invalid period never executes deletion',async()=>{
 for(const body of [{period:1},{period:7,confirmation:'no'},{period:90,confirmation:'حذف الكل'},{period:'30',confirmation:'CONFIRM_VISITOR_ANALYTICS_DELETE'},{period:{},confirmation:'حذف الكل'}]){
  const db=analyticsDb(deletionSeed());const result=await invoke(statsHandler,{method:'DELETE',headers:{host:req().headers.host,authorization:'Bearer admin-session'},body},db);assert.equal(result.statusCode,400);assert.ok(!db.calls.some(c=>c.action==='delete'));
 }
 const db=analyticsDb();await assert.rejects(deleteVisitorAnalytics('preview:18',0,db,now));assert.equal(db.calls.length,0);
});
test('cross-origin admin delete and oversized body are rejected before writes',async()=>{
 for(const [extra,body,status]of [[{origin:'https://other.example'},{period:'all',confirmation:'حذف الكل'},403],[{}, {period:'all',confirmation:'حذف الكل',extra:'x'.repeat(600)},413]]){
  const db=analyticsDb(deletionSeed());const result=await invoke(statsHandler,{method:'DELETE',headers:{host:req().headers.host,authorization:'Bearer admin-session',...extra},body},db);assert.equal(result.statusCode,status);assert.ok(!db.calls.some(c=>c.action==='delete'));
 }
});
test('partial database delete failure never reports success or exposes DB details',async()=>{
 const db=analyticsDb(deletionSeed());db.failTable='visitor_analytics_presence';
 const result=await invoke(statsHandler,{method:'DELETE',headers:{host:req().headers.host,authorization:'Bearer admin-session'},body:{period:'all',confirmation:'حذف الكل'}},db);
 assert.equal(result.statusCode,503);assert.match(result.body.error,/قد تكون/);assert.ok(!JSON.stringify(result.body).includes('Controlled'));assert.ok(db.tables.visitor_analytics_presence.length>1);assert.equal(db.tables.members[0].id,'do-not-touch');
});
test('Netlify dispatcher passes authenticated DELETE body to stats handler',async()=>{
 const {createRequire}=await import('node:module');const dispatcher=createRequire(import.meta.url)('../netlify/functions/api-classic.cjs');const db=analyticsDb(deletionSeed(new Date()));patch(db);
 const result=await dispatcher.handler({path:'/api/visitor-analytics',httpMethod:'DELETE',headers:{host:req().headers.host,authorization:'Bearer admin-session'},body:JSON.stringify({period:'all',confirmation:'حذف الكل'})});
 assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).deletedDailyRows,5);assert.equal(db.tables.visitor_analytics_daily.length,1);
});
test('approved scheduler command targets only the two analytics tables every five minutes',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/202610040002_visitor_analytics_cron.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE EXTENSION IF NOT EXISTS pg_cron/);assert.match(sql,/\*\/5 \* \* \* \*/);assert.match(sql,/Asia\/Riyadh/);assert.match(sql,/date - 29/);assert.match(sql,/interval '5 minutes'/);
 assert.deepEqual([...sql.matchAll(/DELETE FROM (\S+)/g)].map(m=>m[1]),['public.visitor_analytics_daily','public.visitor_analytics_presence']);assert.doesNotMatch(sql,/UPDATE |DROP |ALTER TABLE|cron\.unschedule|CREATE FUNCTION/);
});
