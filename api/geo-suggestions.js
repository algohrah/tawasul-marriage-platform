import supabase from './db-client.js';
import { requireAdmin } from './_auth.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function updateMembersForMerge(kind, name, country, targetName, targetCountry) {
  if (!targetName) return;
  if (kind === 'country') {
    await supabase.from('members').update({ country: targetName }).ilike('country', name).catch(() => undefined);
    await supabase.from('geo_cities').update({ country: targetName }).ilike('country', name).catch(() => undefined);
  }
  if (kind === 'city') {
    let query = supabase.from('members').update({ city: targetName }).ilike('city', name);
    if (country) query = query.ilike('country', country);
    await query.catch(() => undefined);
  }
  if (kind === 'nationality') {
    await supabase.from('members').update({ nationality: targetName }).ilike('nationality', name).catch(() => undefined);
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { status, kind } = req.query;
      let query = supabase.from('geo_suggestions').select('*');
      if (status) query = query.eq('status', String(status));
      if (kind) query = query.eq('kind', String(kind));
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      // إرسال مقترح موقع جديد (مدينة/جنسية) يبقى متاحاً أثناء التسجيل قبل وجود حساب
      const body = req.body || {};
      const kind = body.kind || body.type;
      const name = String(body.name || '').trim();
      if (!kind || !name) return res.status(400).json({ error: 'kind and name are required' });
      const row = {
        id: body.id || `geo_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        kind,
        name,
        country: body.country || '',
        suggested_by: body.suggested_by || body.suggestedBy || '',
        suggested_by_id: body.suggested_by_id || body.suggestedById || '',
        source: body.source || 'register',
        status: body.status || 'pending',
        target_name: body.target_name || body.targetName || '',
        target_country: body.target_country || body.targetCountry || '',
        rejection_reason: body.rejection_reason || body.rejectionReason || '',
      };
      const { data, error } = await supabase.from('geo_suggestions').upsert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (req.method === 'PUT') {
      const body = req.body || {};
      const { id, action, editedName, targetName, targetCountry, reason, reviewer } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { data: suggestion, error: findError } = await supabase.from('geo_suggestions').select('*').eq('id', String(id)).single();
      if (findError) throw findError;

      if (action === 'approve') {
        const officialName = String(editedName || suggestion.name).trim();
        if (suggestion.kind === 'country') {
          await supabase.from('geo_countries').upsert({ name: officialName }).catch(() => undefined);
        }
        if (suggestion.kind === 'city') {
          // تفادي التكرار: تحقق أولاً ثم أضف
          const { data: existingCity } = await supabase.from('geo_cities').select('id').eq('country', suggestion.country).ilike('name', officialName).maybeSingle();
          if (!existingCity) await supabase.from('geo_cities').insert({ country: suggestion.country, name: officialName }).catch(() => undefined);
        }
        if (suggestion.kind === 'nationality') {
          await supabase.from('geo_nationalities').upsert({ name: officialName, country: suggestion.country || '', gender: 'both' }).catch(() => undefined);
        }
        const { data, error } = await supabase
          .from('geo_suggestions')
          .update({ status: 'approved', target_name: officialName, reviewer: reviewer || 'الإدارة', reviewed_at: new Date().toISOString() })
          .eq('id', String(id))
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json(data);
      }

      if (action === 'merge') {
        await updateMembersForMerge(suggestion.kind, suggestion.name, suggestion.country, targetName, targetCountry);
        const { data, error } = await supabase
          .from('geo_suggestions')
          .update({ status: 'merged', target_name: targetName || '', target_country: targetCountry || '', reviewer: reviewer || 'الإدارة', reviewed_at: new Date().toISOString() })
          .eq('id', String(id))
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json(data);
      }

      if (action === 'reject') {
        const { data, error } = await supabase
          .from('geo_suggestions')
          .update({ status: 'rejected', rejection_reason: reason || '', reviewer: reviewer || 'الإدارة', reviewed_at: new Date().toISOString() })
          .eq('id', String(id))
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json(data);
      }

      return res.status(400).json({ error: 'Unsupported action' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('geo_suggestions').delete().eq('id', String(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Geo suggestions API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
