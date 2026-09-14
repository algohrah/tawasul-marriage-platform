import supabase from './db-client.js';
import { requireAdmin } from './_auth.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { type, country } = req.query;
      if (type === 'cities') {
        let query = supabase.from('geo_cities').select('*');
        if (country) query = query.eq('country', String(country));
        const { data, error } = await query.order('name', { ascending: true });
        if (error) throw error;
        return res.status(200).json(data || []);
      }
      if (type === 'pending') {
        const { data, error } = await supabase.from('pending_cities').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json(data || []);
      }
      const { data, error } = await supabase.from('geo_countries').select('*').order('name', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      // اقتراح مدينة جديدة بانتظار المراجعة — يبقى متاحاً أثناء التسجيل قبل وجود حساب
      if (body.type === 'pending') {
        const row = { id: body.id || `pc_${Date.now()}`, name: body.name, country: body.country, suggested_by: body.suggested_by || body.suggestedBy || '', suggested_by_id: body.suggested_by_id || body.suggestedById || '', source: body.source || 'register', status: body.status || 'pending', rejection_reason: body.rejection_reason || '' };
        const { data, error } = await supabase.from('pending_cities').upsert(row).select().single();
        if (error) throw error;
        return res.status(201).json(data);
      }
      // إضافة دولة/مدينة معتمدة مباشرة — إجراء إداري
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      if (body.type === 'city') {
        // تفادي التكرار: تحقق أولاً ثم أضف إن لم يوجد
        const { data: existing } = await supabase
          .from('geo_cities')
          .select('id')
          .eq('country', String(body.country))
          .ilike('name', String(body.name))
          .maybeSingle();
        if (existing) return res.status(200).json(existing);
        const { data, error } = await supabase.from('geo_cities').insert({ country: body.country, name: body.name }).select().single();
        if (error) throw error;
        return res.status(201).json(data);
      }
      const row = { name: body.name, code: body.code || '', flag: body.flag || '' };
      const { data, error } = await supabase.from('geo_countries').upsert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    // اعتماد/رفض المقترحات وحذف الدول/المدن — إجراءات إدارية بالكامل
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (body.type === 'pending') {
        const update = { status: body.status, rejection_reason: body.reason || body.rejection_reason || '' };
        const { data, error } = await supabase.from('pending_cities').update(update).eq('id', body.id).select().single();
        if (error) throw error;
        if (body.status === 'approved' && data?.name && data?.country) {
          await supabase.from('geo_cities').insert({ country: data.country, name: body.editedName || data.name }).catch(() => undefined);
        }
        return res.status(200).json(data);
      }
      return res.status(400).json({ error: 'Unsupported geo update' });
    }

    if (req.method === 'DELETE') {
      const body = req.body || {};
      if (body.type === 'city') {
        const { error } = await supabase.from('geo_cities').delete().eq('country', body.country).ilike('name', String(body.name));
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (body.type === 'pending') {
        const { error } = await supabase.from('pending_cities').delete().eq('id', body.id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      // حذف الدولة + مدنها المرتبطة
      const { error: cityErr } = await supabase.from('geo_cities').delete().ilike('country', String(body.name));
      if (cityErr) console.warn('Failed to delete orphaned cities:', cityErr.message);
      const { error } = await supabase.from('geo_countries').delete().ilike('name', String(body.name));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Geo API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
