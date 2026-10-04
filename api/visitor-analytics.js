import {analyticsScope,requireAnalyticsAdmin,readVisitorAnalytics,deleteVisitorAnalytics} from './_visitorAnalytics.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(!['GET','DELETE'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  try {
    if(!(await requireAnalyticsAdmin(req,res)))return;
    if(req.method==='DELETE') {
      const origin=req.headers?.origin,host=req.headers?.host;
      if(origin && host){try{if(new URL(origin).host!==host)return res.status(403).json({error:'Origin not allowed'});}catch{return res.status(403).json({error:'Origin not allowed'});}}
      if(JSON.stringify(req.body || {}).length>512)return res.status(413).json({error:'Payload too large'});
      const {period,confirmation}=req.body || {};
      if(![1,7,30,'all'].includes(period))return res.status(400).json({error:'فترة الحذف غير صالحة'});
      const expected=period==='all' ? 'حذف الكل' : 'CONFIRM_VISITOR_ANALYTICS_DELETE';
      if(confirmation!==expected)return res.status(400).json({error:'يجب تأكيد عملية حذف الإحصائيات'});
      return res.status(200).json(await deleteVisitorAnalytics(analyticsScope(req),period));
    }
    const days=Number(req.query?.days || 1);
    if(![1,7,30].includes(days))return res.status(400).json({error:'الفترة يجب أن تكون اليوم أو 7 أو 30 يومًا'});
    return res.status(200).json(await readVisitorAnalytics(analyticsScope(req),days));
  }catch(error){return res.status(error.status || 503).json({error:error.status ? error.message : 'تعذر إتمام عملية إحصائيات الزوار. أعد المحاولة.'});}
}
