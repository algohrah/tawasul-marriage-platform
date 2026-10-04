// In-memory Supabase query model: no network calls or real account/data writes.
export function analyticsDb(seed={}) {
  const tables={visitor_analytics_daily:[],visitor_analytics_presence:[],members:[],rate_limits:[],admin_users:[],...structuredClone(seed)};
  const calls=[];
  const db={tables,calls,failTable:null,auth:{getUser:async token=>token==='admin-session' ? {data:{user:{id:'test-admin',email:'admin@tawafok.com'}},error:null} : token==='member-session' ? {data:{user:{id:'test-member',email:'member@test.invalid'}},error:null} : {data:{},error:{message:'Invalid token'}},admin:{createUser:async()=>({data:{user:{id:'created-fixture-account'}},error:null})}}};
  db.from=table=>{
    const filters=[];let action='select',payload,one=false,options={};
    const q={
      select(_columns,opts={}){options=opts;return q;},
      eq(k,v){filters.push(r=>r[k]===v);return q;},
      lt(k,v){filters.push(r=>r[k]<v);return q;},lte(k,v){filters.push(r=>r[k]<=v);return q;},
      gt(k,v){filters.push(r=>r[k]>v);return q;},gte(k,v){filters.push(r=>r[k]>=v);return q;},
      ilike(k,v){filters.push(r=>String(r[k]||'').toLowerCase()===v.toLowerCase());return q;},
      order(){return q;},maybeSingle(){one=true;return q;},single(){one=true;return q;},
      insert(v){action='insert';payload=structuredClone(v);return q;},upsert(v){action='upsert';payload=structuredClone(v);return q;},
      update(v){action='update';payload=structuredClone(v);return q;},delete(){action='delete';return q;},
      then(resolve,reject){return Promise.resolve().then(()=>{
        calls.push({table,action});
        if(db.failTable===table)return {data:null,error:{message:'Controlled database failure'}};
        const rows=tables[table] ||= [];let result=rows.filter(r=>filters.every(f=>f(r)));
        const key=table==='visitor_analytics_daily' ? ['scope','day'] : table==='visitor_analytics_presence' ? ['scope','session_id'] : ['key'];
        if(action==='insert'||action==='upsert') {
          const values=Array.isArray(payload) ? payload : [payload];
          const conflict=values.map(v=>rows.find(r=>key.every(k=>r[k]===v[k])));
          if(action==='insert'&&conflict.some(Boolean))return {data:null,error:{code:'23505'}};
          result=values.map((v,i)=>{if(conflict[i]){Object.assign(conflict[i],v);return conflict[i];}rows.push(v);return v;});
        } else if(action==='update')result.forEach(r=>Object.assign(r,payload));
        else if(action==='delete')tables[table]=rows.filter(r=>!result.includes(r));
        return {data:options.head ? null : one ? (result[0] ? structuredClone(result[0]) : null) : structuredClone(result),count:result.length,error:null};
      }).then(resolve,reject);},
    };return q;
  };return db;
}
export function apiResponse(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},end(){return this;}};}
