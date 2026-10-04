import {createClient} from '@supabase/supabase-js';

// Analytics must never borrow the legacy singleton used by admin-auth sign-in:
// signing in on that client can replace its REST bearer with an end-user token.
export function createVisitorAnalyticsDb(env=process.env,transport=globalThis.fetch) {
  const url=env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const serviceKey=env.SUPABASE_SERVICE_ROLE_KEY || '';
  if(!url || url.includes('placeholder') || !serviceKey) {
    const unavailable=()=>{throw new Error('Analytics requires a real server database configuration');};
    return {from:unavailable,auth:{getUser:async()=>unavailable()}};
  }
  const origin=new URL(url).origin;
  return createClient(url,serviceKey,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init={})=>{
      const target=new URL(typeof input==='string' || input instanceof URL ? String(input) : input.url);
      const headers=new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      // Pin only database REST requests to this server-only key. Supabase Auth
      // requests retain their supplied user JWT so admin verification stays real.
      if(target.origin===origin && target.pathname.startsWith('/rest/v1/'))headers.set('Authorization',`Bearer ${serviceKey}`);
      return transport(input,{...init,headers});
    }},
  });
}
export default createVisitorAnalyticsDb();
