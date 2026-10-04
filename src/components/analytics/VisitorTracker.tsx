import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { visitSource } from '../../../shared/visitorAnalytics.js';

// Only a random in-memory browsing token. No cookie, localStorage identity,
// member ID, IP, URL/referrer or device fingerprint is sent by this tracker.
type Session = { id:string; source:string; acknowledged:boolean; starting:boolean; ended:boolean; lastActivity:number; visibleSince:number | null; foregroundMs:number };
let session:Session | null = null;
export default function VisitorTracker() {
  const { pathname } = useLocation();
  const [generation,setGeneration]=useState(0);
  const inAdmin = pathname.startsWith('/admin');
  useEffect(() => {
    if (inAdmin || !window.crypto?.randomUUID || navigator.doNotTrack === '1') return;
    if (!session || session.ended) session = {id:crypto.randomUUID(),source:visitSource(location.search,document.referrer,location.origin),acknowledged:false,starting:false,ended:false,lastActivity:Date.now(),visibleSince:document.visibilityState==='visible' ? Date.now() : null,foregroundMs:0};
    const current=session;
    if(current.visibleSince===null && document.visibilityState==='visible')current.visibleSince=Date.now();
    const send = (event:string, extra:Record<string,unknown> = {}, keepalive=false) => fetch('/api/visitor-events',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',keepalive,body:JSON.stringify({event,sessionId:current.id,...extra})});
    const start = async () => {
      if(current.acknowledged || current.starting || current.ended)return;
      current.starting=true;
      try {const result=await send('visit',{source:current.source,lastActivityAt:current.lastActivity});current.acknowledged=result.ok;}catch{/* analytics must never interrupt browsing */}
      finally{current.starting=false;}
    };
    const noteActivity=()=>{if(document.visibilityState==='visible')current.lastActivity=Date.now();};
    const accumulate=()=>{if(current.visibleSince!==null){current.foregroundMs+=Date.now()-current.visibleSince;current.visibleSince=null;}};
    const visibility=()=>{accumulate();if(document.visibilityState==='visible'){current.visibleSince=Date.now();noteActivity();}};
    const finish=()=>{
      if(current.ended)return;
      accumulate();current.ended=true;
      const durationSeconds=Math.floor(current.foregroundMs/1000);
      if(current.acknowledged && durationSeconds>0)void send('duration',{durationSeconds},true).catch(()=>undefined);
    };
    void start();
    const timer=setInterval(()=>{
      if(current.ended || document.visibilityState!=='visible')return;
      if(!current.acknowledged){void start();return;}
      // An idle tab must not stay "online" just because the heartbeat timer runs.
      if(Date.now()-current.lastActivity<300000)void send('activity',{lastActivityAt:current.lastActivity}).catch(()=>undefined);
    },30000);
    const activityEvents=['pointerdown','keydown','scroll','focus'] as const;
    activityEvents.forEach(name=>window.addEventListener(name,noteActivity,{passive:true}));
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',finish);
    const pageShow=(event:PageTransitionEvent)=>{if(event.persisted){session=null;setGeneration(value=>value+1);}};
    window.addEventListener('pageshow',pageShow);
    return ()=>{
      clearInterval(timer);accumulate();
      activityEvents.forEach(name=>window.removeEventListener(name,noteActivity));
      document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',finish);window.removeEventListener('pageshow',pageShow);
    };
  },[inAdmin,generation]);
  return null;
}
