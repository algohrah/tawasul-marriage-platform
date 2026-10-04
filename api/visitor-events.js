import {recordVisitorEvent} from './_visitorAnalytics.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const origin=req.headers?.origin;const host=req.headers?.host;
  if(origin && host) {try{if(new URL(origin).host!==host)return res.status(403).json({error:'Origin not allowed'});}catch{return res.status(403).json({error:'Origin not allowed'});}}
  if(JSON.stringify(req.body || {}).length>1024)return res.status(413).json({error:'Payload too large'});
  try {await recordVisitorEvent(req);return res.status(202).json({ok:true});}
  catch(error){return res.status(error.status || 503).json({error:error.status ? error.message : 'تعذر تحديث إحصائيات الزيارة الآن'});}
}
