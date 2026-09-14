import supabase from './db-client.js';
import { requireAdmin } from './_auth.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { kind, oldValue, newValue, countryFilter, sourceCountryFilter } = req.body || {};
    if (!kind || !oldValue || !newValue) {
      return res.status(400).json({ error: 'kind, oldValue, newValue are required' });
    }
    if (!['country', 'city', 'nationality', 'skinColor', 'education', 'workType'].includes(kind)) {
      return res.status(400).json({ error: 'نوع التحديث غير مدعوم' });
    }

    let updatedCount = 0;

    if (kind === 'nationality') {
      const { data, error } = await supabase
        .from('members')
        .update({ nationality: String(newValue).trim() })
        .ilike('nationality', String(oldValue))
        .select('id');
      if (error) throw error;
      updatedCount = data?.length || 0;
    } else if (kind === 'country') {
      // تحديث الدولة في ملفات الأعضاء
      const { data, error } = await supabase
        .from('members')
        .update({ country: String(newValue).trim() })
        .ilike('country', String(oldValue))
        .select('id');
      if (error) throw error;
      updatedCount = data?.length || 0;
      // تحديث الجنسية أيضاً إذا كانت مطابقة (نفس اسم الدولة)
      const { data: natData } = await supabase
        .from('members')
        .update({ nationality: String(newValue).trim() })
        .ilike('nationality', String(oldValue))
        .neq('nationality', String(newValue))
        .select('id');
      if (natData?.length) updatedCount += natData.length;
    } else if (kind === 'city') {
      // تحديث المدينة — مع فلتر الدولة إن وُجد
      let query = supabase
        .from('members')
        .update({ city: String(newValue).trim() })
        .ilike('city', String(oldValue));
      if (sourceCountryFilter || countryFilter) {
        query = query.ilike('country', String(sourceCountryFilter || countryFilter));
      }
      const { data, error } = await query.select('id');
      if (error) throw error;
      updatedCount = data?.length || 0;
      // تحديث حقل residence أيضاً إن وُجد
      let query2 = supabase
        .from('members')
        .update({ district: String(newValue).trim() })
        .ilike('district', String(oldValue));
      if (sourceCountryFilter || countryFilter) {
        query2 = query2.ilike('country', String(sourceCountryFilter || countryFilter));
      }
      await query2.catch(() => undefined);
    } else {
      const columnByKind = {
        skinColor: 'skin_color',
        education: 'education',
        workType: 'work_type',
      };
      const column = columnByKind[kind];
      const { data, error } = await supabase
        .from('members')
        .update({ [column]: String(newValue).trim() })
        .ilike(column, String(oldValue))
        .select('id');
      if (error) throw error;
      updatedCount = data?.length || 0;
    }

    return res.status(200).json({ ok: true, updatedCount });
  } catch (err) {
    console.error('Batch geo API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
