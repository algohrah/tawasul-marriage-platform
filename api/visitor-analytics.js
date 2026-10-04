import {analyticsScope,requireAnalyticsAdmin,readVisitorAnalytics} from './_visitorAnalytics.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try {
    if(!(await requireAnalyticsAdmin(req,res)))return;
    const days=Number(req.query?.days || 1);
    if(![1,7,30].includes(days))return res.status(400).json({error:'الفترة يجب أن تكون اليوم أو 7 أو 30 يومًا'});
    return res.status(200).json(await readVisitorAnalytics(analyticsScope(req),days));
  }catch{return res.status(503).json({error:'تعذر تحميل إحصائيات الزوار. أعد المحاولة.'});}
}
