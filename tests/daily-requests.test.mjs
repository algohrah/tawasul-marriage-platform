import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDb } from './db-fixture.mjs';
import { reserveDailyRequest, releaseDailyRequest, dailyRequestUsage } from '../api/_dailyRequests.js';
import dbClient from '../api/db-client.js';
import handler from '../api/interest-requests.js';
const now = new Date('2026-10-04T08:00:00Z');
function response() { return { statusCode:200, setHeader(){}, status(n){this.statusCode=n;return this;}, json(body){this.body=body;return this;} }; }
async function api(db, method, body={}, query={}, token='test-session') {
  dbClient.from = db.from; dbClient.auth = db.auth;
  const res=response(); await handler({method,headers:{authorization:`Bearer ${token}`},body,query},res); return res;
}
for (const [plan, limit] of [['free',5],['featured',20],['gold',20],['elite',20],['premium',20]]) {
  test(`${plan}: exactly ${limit} API requests accepted; next rejected`,async()=> {
    const db=makeDb({plan});
    for(let i=0;i<limit;i++) {
      const res=await api(db,'POST',{id:100+i,senderId:'sender',receiverId:`receiver${i}`,created_at:'2000-01-01T00:00:00Z',plan:'featured'});
      assert.equal(res.statusCode,201,JSON.stringify(res.body));
      assert.ok(res.body.created_at.startsWith(new Date().toISOString().slice(0,10)));
    }
    const denied=await api(db,'POST',{id:999,senderId:'sender',receiverId:'receiver49'});
    assert.equal(denied.statusCode,429); assert.equal(denied.body.code,'DAILY_REQUEST_LIMIT'); assert.equal(denied.body.limit,limit);
    assert.equal(denied.body.upgradeAvailable,plan==='free'); assert.equal(db.tables.interest_requests.length,limit);
  });
}
test('concurrent reservations cannot exceed either daily cap',async()=> {
  for(const [plan,limit] of [['free',5],['featured',20]]) {
    const db=makeDb({plan}); const results=await Promise.all(Array.from({length:28},()=>reserveDailyRequest(db,'sender',now)));
    assert.equal(results.filter(r=>r.ok).length,limit); assert.equal(db.tables.rate_limits[0].count,limit);
  }
});
test('existing requests today count; yesterday and incoming do not',async()=> {
  const db=makeDb({requests:[...Array.from({length:5},(_,id)=>({id,sender_id:'sender',created_at:'2026-10-04T00:00:00Z'})),{id:8,sender_id:'other',receiver_id:'sender',created_at:now.toISOString()},{id:9,sender_id:'sender',created_at:'2026-10-02T00:00:00Z'}]});
  const usage=await dailyRequestUsage(db,'sender',now); assert.equal(usage.used,5);assert.equal((await reserveDailyRequest(db,'sender',now)).ok,false);
  assert.equal((await dailyRequestUsage(db,'sender',new Date('2026-10-04T21:00:00Z'))).used,0);
});
test('reservation release does not consume failed request',async()=> {
  const db=makeDb();const reserved=await reserveDailyRequest(db,'sender',now);await releaseDailyRequest(db,reserved.key);
  assert.equal((await dailyRequestUsage(db,'sender',now)).used,0);
});
test('failed API insert releases slot',async()=> {
  const db=makeDb({failInsert:true});const res=await api(db,'POST',{senderId:'sender',receiverId:'receiver1'});
  assert.equal(res.statusCode,500);assert.equal(db.tables.rate_limits[0].count,0);
});
test('usage is authenticated and scoped to caller; cannot spoof paid entitlement',async()=> {
  const db=makeDb();let res=await api(db,'GET',{}, {usage:'1',userId:'receiver1'});
  assert.equal(res.statusCode,200);assert.equal(res.body.plan,'free');assert.equal(res.body.limit,5);assert.equal(res.body.key,undefined);
  res=await api(db,'POST',{senderId:'receiver1',receiverId:'receiver2'});assert.equal(res.statusCode,403);
  res=await api(db,'GET',{}, {usage:'1'},'invalid');assert.equal(res.statusCode,401);
});
test('duplicate is not charged a second slot',async()=> {
 const db=makeDb();assert.equal((await api(db,'POST',{senderId:'sender',receiverId:'receiver1'})).statusCode,201);
 assert.equal((await api(db,'POST',{senderId:'sender',receiverId:'receiver1'})).statusCode,409);assert.equal(db.tables.rate_limits[0].count,1);
});
