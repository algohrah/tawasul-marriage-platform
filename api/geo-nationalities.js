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
      const { name } = req.query;
      let query = supabase.from('geo_nationalities').select('*');
      if (name) query = query.eq('name', String(name)).maybeSingle();
      else query = query.order('name', { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || (name ? null : []));
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ error: 'name is required' });
      const row = { name: String(body.name).trim(), country: body.country || '', gender: body.gender || 'both' };
      const { data, error } = await supabase.from('geo_nationalities').upsert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { oldName, name, country, gender } = req.body || {};
      if (!oldName || !name) return res.status(400).json({ error: 'oldName and name are required' });
      // جلب القيم الحالية للحفاظ على country/gender إن لم تُمرّر
      const { data: existing } = await supabase.from('geo_nationalities').select('*').ilike('name', String(oldName)).maybeSingle();
      const update = { name: String(name).trim() };
      update.country = country !== undefined ? country : (existing?.country || '');
      update.gender = gender !== undefined ? gender : (existing?.gender || 'both');
      const { data, error } = await supabase
        .from('geo_nationalities')
        .update(update)
        .ilike('name', String(oldName))
        .select()
        .single();
      if (error) throw error;
      // تحديث ملفات الأعضاء أيضاً
      await supabase.from('members').update({ nationality: String(name).trim() }).ilike('nationality', String(oldName)).catch(() => undefined);
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { name } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name is required' });
      const { error } = await supabase.from('geo_nationalities').delete().ilike('name', String(name));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Geo nationalities API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
