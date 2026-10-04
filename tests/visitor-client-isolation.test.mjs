import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createVisitorAnalyticsDb} from '../api/_visitorAnalyticsDb.js';
import {requireAnalyticsAdmin} from '../api/_visitorAnalytics.js';
import {apiResponse} from './visitor-db-fixture.mjs';
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt=role=>`${b64({alg:'HS256',typ:'JWT'})}.${b64({role,sub:'72e7a588-89c2-4278-b5ad-8dd08c0fdd2e',exp:Math.floor(Date.now()/1000)+3600})}.not-a-real-signature`;
const serviceKey=jwt('service_role'),userToken=jwt('authenticated');
function transportFixture({directory=false}={}){
 const calls=[];
 const user={id:'72e7a588-89c2-4278-b5ad-8dd08c0fdd2e',email:'fixture@test.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
 const fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string' || input instanceof URL ? String(input) : input.url);
  const headers=new Headers(init.headers);calls.push({path:url.pathname,method:init.method || 'GET',bearer:headers.get('authorization')});
  if(url.pathname.endsWith('/token'))return new Response(JSON.stringify({access_token:userToken,refresh_token:'not-a-real-refresh-token',expires_in:3600,token_type:'bearer',user}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.pathname.endsWith('/user'))return new Response(JSON.stringify(user),{status:200,headers:{'Content-Type':'application/json'}});
  if(directory && url.pathname==='/rest/v1/admin_users')return new Response(JSON.stringify([{id:'configured-admin'}]),{status:200,headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify([]),{status:200,headers:{'Content-Type':'application/json','Content-Range':'0-0/0'}});
 };return{calls,fetch};
}
const env={VITE_SUPABASE_URL:'https://isolated.test.invalid',SUPABASE_SERVICE_ROLE_KEY:serviceKey};
test('reproduces legacy warm-client contamination after admin sign-in without real credentials',async()=>{
 const t=transportFixture();const legacy=createClient(env.VITE_SUPABASE_URL,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:t.fetch}});
 await legacy.from('visitor_analytics_daily').select('*');assert.equal(t.calls.at(-1).bearer,`Bearer ${serviceKey}`);
 const signed=await legacy.auth.signInWithPassword({email:'fixture@test.invalid',password:'not-a-real-password'});assert.equal(signed.error,null);
 await legacy.from('visitor_analytics_daily').select('*');assert.equal(t.calls.at(-1).bearer,`Bearer ${userToken}`);
});
test('isolated analytics client ignores legacy sign-in and user-token verification for REST access',async()=>{
 const t=transportFixture();const legacy=createClient(env.VITE_SUPABASE_URL,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:t.fetch}});const analytics=createVisitorAnalyticsDb(env,t.fetch);
 await legacy.auth.signInWithPassword({email:'fixture@test.invalid',password:'not-a-real-password'});
 const user=await analytics.auth.getUser(userToken);assert.equal(user.data.user.id,'72e7a588-89c2-4278-b5ad-8dd08c0fdd2e');assert.equal(t.calls.at(-1).path,'/auth/v1/user');assert.equal(t.calls.at(-1).bearer,`Bearer ${userToken}`);
 await analytics.from('visitor_analytics_daily').select('*');assert.equal(t.calls.at(-1).bearer,`Bearer ${serviceKey}`);
 await analytics.from('visitor_analytics_presence').delete().eq('scope','preview:18');assert.equal(t.calls.at(-1).bearer,`Bearer ${serviceKey}`);
});
test('even accidental sign-in on analytics client cannot replace its server REST bearer',async()=>{
 const t=transportFixture(),analytics=createVisitorAnalyticsDb(env,t.fetch);
 await analytics.auth.signInWithPassword({email:'fixture@test.invalid',password:'not-a-real-password'});
 await analytics.from('visitor_analytics_daily').select('*');assert.equal(t.calls.at(-1).bearer,`Bearer ${serviceKey}`);
});
test('missing service configuration never falls back to anonymous/dummy access',()=>{
 const db=createVisitorAnalyticsDb({VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY:'anonymous-key'});
 assert.throws(()=>db.from('visitor_analytics_daily'),/real server database/);
});

test('configured non-hardcoded admin is verified using the isolated role directory client',async()=>{
 const t=transportFixture({directory:true}),client=createVisitorAnalyticsDb(env,t.fetch),res=apiResponse();
 assert.equal(await requireAnalyticsAdmin({headers:{authorization:`Bearer ${userToken}`}},res,client),true);
 assert.equal(t.calls.find(c=>c.path==='/auth/v1/user').bearer,`Bearer ${userToken}`);
 assert.equal(t.calls.find(c=>c.path==='/rest/v1/admin_users').bearer,`Bearer ${serviceKey}`);
});
