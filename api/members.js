import supabase from './db-client.js';
import { getAuthUser, isAdminEmail, getMemberLink, authorizeMemberAction, requireAdmin } from './_auth.js';
import { writeAuditLog } from './_audit.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// حقول حسّاسة لا تُكشف أبداً لغير الإدارة أو صاحب الحساب نفسه
const SENSITIVE_KEYS = [
  'password', 'email', 'phone', 'whatsapp', 'real_name', 'notes', 'status_reason', 'status_by',
  'import_batch_id', 'import_office_name', 'import_date', 'import_notes', 'birth_date', 'details',
];

// حقول يُسمح للعضو نفسه بتعديلها ذاتياً (بدون صلاحية إدارية)
const SELF_EDITABLE_KEYS = new Set([
  'nickname', 'realName', 'real_name', 'city', 'district', 'phone', 'whatsapp', 'bio',
  'aboutPartner', 'about_partner', 'pNotes', 'p_notes', 'height', 'weight', 'skinColor', 'skin_color',
  'health', 'smoking', 'ethnicity', 'education', 'workType', 'work_type', 'jobTitle', 'job_title',
  'housing', 'sect', 'nationality', 'maritalStatus', 'marital_status', 'maritalLabel', 'marital_label',
  'marriageType', 'marriage_type', 'marriageTypeLabel', 'marriage_type_label',
  'hasChildren', 'has_children', 'childrenCount', 'children_count', 'is_profile_incomplete', 'isProfileIncomplete',
  'acceptPolygamy', 'acceptDivorced', 'acceptWithChildren', 'religionLevel', 'religion_level',
  'prayer', 'healthStatus', 'health_status', 'tribe',
]);

// أعمدة جدول members الحقيقية (حارس لمنع تمرير أعمدة غير موجودة إلى Supabase)
const KNOWN_COLUMNS = new Set([
  'id', 'nickname', 'username', 'real_name', 'email', 'phone', 'whatsapp', 'password', 'gender',
  'birth_date', 'age', 'country', 'city', 'district', 'nationality', 'sect', 'religion_level',
  'marital_status', 'marital_label', 'marriage_type', 'has_children', 'children_count', 'housing_type', 'housing',
  'skin_color', 'height', 'weight', 'health', 'health_status', 'smoking', 'prayer', 'ethnicity', 'tribe',
  'education', 'work_type', 'job_title', 'income_range', 'bio', 'about_partner', 'p_country', 'p_city',
  'p_nationality', 'p_age_min', 'p_age_max', 'p_marital_status', 'p_accept_children', 'p_notes',
  'verified', 'premium', 'online', 'last_active', 'match_score', 'has_seriousness_badge', 'plan',
  'pinned', 'status', 'status_reason', 'status_by', 'notes', 'flagged', 'source_type',
  'import_batch_id', 'import_office_name', 'import_date', 'import_notes', 'is_profile_incomplete',
  'details', 'created_at', 'updated_at',
]);

// حقول موسّعة بلا أعمدة مخصّصة في الجدول — تُحفظ داخل details (jsonb) وتُسترجع منه
const DETAIL_KEYS = [
  'acceptPolygamy', 'acceptDivorced', 'acceptWithChildren', 'wifeCount', 'seekingWife',
  'childrenLiveWith', 'hijab', 'drivesCar', 'tribe', 'marriageType', 'marriageTypeLabel', 'marriage_type', 'customLists',
  'pCountry', 'pCity', 'pNationality', 'pAgeMin', 'pAgeMax', 'pMaritalStatus', 'pAcceptChildren',
  'pSect', 'pEducation', 'pWorkType', 'pReligionLevel', 'pSkinColor', 'pHeight', 'pHousing',
];

function buildDetails(m = {}, existing = {}) {
  const out = { ...(existing || {}) };
  for (const key of DETAIL_KEYS) {
    const val = m[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') out[key] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

function toDb(m = {}) {
  return {
    id: m.id ? String(m.id) : `m${Date.now()}`,
    nickname: m.nickname || m.realName || m.real_name || m.name || '',
    username: m.username || '',
    gender: m.gender || '',
    age: Number(m.age) || 0,
    country: m.country || '',
    city: m.city || '',
    district: m.district || '',
    nationality: m.nationality || '',
    sect: m.sect || '',
    religion_level: m.religionLevel || m.religion_level || '',
    marital_status: m.maritalStatus || m.marital_status || 'single',
    marital_label: m.maritalLabel || m.marital_label || '',
    has_children: !!(m.hasChildren ?? m.has_children),
    children_count: m.childrenCount || m.children_count || '',
    height: Number(m.height) || 0,
    weight: Number(m.weight) || 0,
    skin_color: m.skinColor || m.skin_color || '',
    health: m.health || '',
    health_status: m.healthStatus || m.health_status || '',
    prayer: m.prayer || '',
    smoking: m.smoking || '',
    ethnicity: m.ethnicity || '',
    tribe: m.tribe || '',
    education: m.education || '',
    work_type: m.workType || m.work_type || '',
    job_title: m.jobTitle || m.job_title || '',
    housing: m.housing || '',
    bio: m.bio || '',
    about_partner: m.aboutPartner || m.about_partner || m.pNotes || m.p_notes || m.partner_notes || '',
    verified: !!m.verified,
    premium: !!m.premium,
    online: !!m.online,
    last_active: m.lastActive || m.last_active || new Date().toISOString(),
    match_score: Number(m.matchScore ?? m.match_score) || 90,
    has_seriousness_badge: !!(m.hasSeriousnessBadge ?? m.has_seriousness_badge),
    plan: m.plan || 'free',
    pinned: !!m.pinned,
    status: m.status || 'active',
    status_reason: m.statusReason || m.status_reason || '',
    status_by: m.statusBy || m.status_by || '',
    notes: m.adminNote || m.notes || '',
    flagged: !!m.flagged,
    source_type: m.sourceType || m.source_type || 'registered',
    import_batch_id: m.importBatchId || m.import_batch_id || '',
    import_office_name: m.importOfficeName || m.import_office_name || '',
    import_date: m.importDate || m.import_date || '',
    import_notes: m.importNotes || m.import_notes || '',
    real_name: m.realName || m.real_name || m.nickname || '',
    email: (m.email || '').toLowerCase().trim(),
    phone: m.phone || '',
    whatsapp: m.whatsapp || '',
    // لا نخزّن كلمات مرور نصية إطلاقاً — المصادقة الحقيقية تتم عبر Supabase Auth
    password: '',
    birth_date: m.birthDate || m.birth_date || '',
    is_profile_incomplete: !!(m.isProfileIncomplete ?? m.is_profile_incomplete),
    details: buildDetails(m, m.details && typeof m.details === 'object' ? m.details : {}),
    updated_at: new Date().toISOString(),
  };
}

function toDbPartial(fields = {}, restrictToSelfEditable = false) {
  const mapping = {
    nickname: 'nickname', realName: 'real_name', real_name: 'real_name', username: 'username', gender: 'gender', age: 'age',
    country: 'country', city: 'city', district: 'district', nationality: 'nationality', sect: 'sect',
    maritalStatus: 'marital_status', marital_status: 'marital_status', maritalLabel: 'marital_label', marital_label: 'marital_label',
    hasChildren: 'has_children', has_children: 'has_children', childrenCount: 'children_count', children_count: 'children_count',
    height: 'height', weight: 'weight', skinColor: 'skin_color', skin_color: 'skin_color', health: 'health', smoking: 'smoking', ethnicity: 'ethnicity', tribe: 'tribe',
    education: 'education', workType: 'work_type', work_type: 'work_type', jobTitle: 'job_title', job_title: 'job_title', housing: 'housing',
    religionLevel: 'religion_level', religion_level: 'religion_level', healthStatus: 'health_status', health_status: 'health_status', prayer: 'prayer',
    bio: 'bio', aboutPartner: 'about_partner', about_partner: 'about_partner', pNotes: 'about_partner', p_notes: 'about_partner', partner_notes: 'about_partner',
    verified: 'verified', premium: 'premium', online: 'online', lastActive: 'last_active', last_active: 'last_active',
    matchScore: 'match_score', match_score: 'match_score', hasSeriousnessBadge: 'has_seriousness_badge', has_seriousness_badge: 'has_seriousness_badge',
    plan: 'plan', pinned: 'pinned', status: 'status', statusReason: 'status_reason', status_reason: 'status_reason', statusBy: 'status_by', status_by: 'status_by',
    adminNote: 'notes', notes: 'notes', flagged: 'flagged', sourceType: 'source_type', source_type: 'source_type',
    importBatchId: 'import_batch_id', import_batch_id: 'import_batch_id', importOfficeName: 'import_office_name', import_office_name: 'import_office_name',
    importDate: 'import_date', import_date: 'import_date', importNotes: 'import_notes', import_notes: 'import_notes',
    email: 'email', phone: 'phone', whatsapp: 'whatsapp', birthDate: 'birth_date', birth_date: 'birth_date',
    isProfileIncomplete: 'is_profile_incomplete', is_profile_incomplete: 'is_profile_incomplete', details: 'details',
  };
  const out = {};
  const detailsPatch = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'password' || key === 'details' || value === undefined) continue;
    if (restrictToSelfEditable && !SELF_EDITABLE_KEYS.has(key)) continue;
    // الحقول الموسّعة تذهب إلى details (jsonb) بدل عمود غير موجود
    if (DETAIL_KEYS.includes(key)) { detailsPatch[key] = value; continue; }
    const dbKey = mapping[key] || key;
    if (!KNOWN_COLUMNS.has(dbKey)) continue; // تجاهل أي مفتاح لا يقابل عموداً حقيقياً
    if (['age', 'height', 'weight', 'match_score'].includes(dbKey)) out[dbKey] = Number(value) || 0;
    else if (['has_children', 'verified', 'premium', 'online', 'has_seriousness_badge', 'pinned', 'flagged', 'is_profile_incomplete'].includes(dbKey)) out[dbKey] = !!value;
    else out[dbKey] = value;
  }
  if (Object.keys(detailsPatch).length) out.__details = detailsPatch;
  out.updated_at = new Date().toISOString();
  return out;
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

function fromDb(r, canSeeSensitive = false) {
  if (!r) return r;
  const base = {
    ...r,
    id: String(r.id),
    nickname: r.nickname || r.real_name || '',
    username: r.username || '',
    gender: r.gender || '',
    age: Number(r.age) || 0,
    birthDate: r.birth_date || '',
    country: r.country || '',
    city: r.city || '',
    district: r.district || '',
    nationality: r.nationality || '',
    sect: r.sect || '',
    maritalStatus: r.marital_status || 'single',
    maritalLabel: r.marital_label || '',
    hasChildren: !!r.has_children,
    childrenCount: r.children_count || '',
    skinColor: r.skin_color || '',
    tribe: r.tribe || (r.details?.tribe || ''),
    ethnicity: r.ethnicity || '',
    workType: r.work_type || '',
    jobTitle: r.job_title || '',
    aboutPartner: r.about_partner || '',
    pNotes: r.about_partner || '',
    lastActive: r.last_active || '',
    matchScore: Number(r.match_score) || 90,
    hasSeriousnessBadge: !!r.has_seriousness_badge,
    statusReason: r.status_reason || '',
    statusBy: r.status_by || '',
    adminNote: r.notes || '',
    notes: r.notes || '',
    sourceType: r.source_type || 'registered',
    importBatchId: r.import_batch_id || '',
    importOfficeName: r.import_office_name || '',
    importDate: r.import_date || '',
    importNotes: r.import_notes || '',
    realName: r.real_name || '',
    isProfileIncomplete: !!r.is_profile_incomplete,
    religionLevel: r.religion_level || '',
    healthStatus: r.health_status || '',
    // توحيد حقول تفضيلات الشريك للواجهة الإدارية مهما كان مصدرها
    // (أعمدة قديمة أو حقول موسعة داخل details).
    pCountry: r.p_country || r.pCountry || r.details?.pCountry || 'لا يهم',
    pCity: r.p_city || r.pCity || r.details?.pCity || 'لا يهم',
    pNationality: r.p_nationality || r.pNationality || r.details?.pNationality || 'اقبل اجنبي',
    pAgeMin: r.p_age_min ?? r.pAgeMin ?? r.details?.pAgeMin ?? '',
    pAgeMax: r.p_age_max ?? r.pAgeMax ?? r.details?.pAgeMax ?? '',
    pMaritalStatus: r.p_marital_status || r.pMaritalStatus || r.details?.pMaritalStatus || 'لا يهم',
    pAcceptChildren: r.p_accept_children || r.pAcceptChildren || r.details?.pAcceptChildren || '',
    marriageType: r.marriage_type || r.marriageType || r.details?.marriageType || r.details?.marriage_type || 'announced',
    marriageTypeLabel: r.details?.marriageTypeLabel || r.marriageTypeLabel || (
      (r.marriage_type || r.marriageType || r.details?.marriageType || r.details?.marriage_type) === 'misyar' ? 'مسيار' :
      (r.marriage_type || r.marriageType || r.details?.marriageType || r.details?.marriage_type) === 'both' ? 'معلن أو مسيار' : 'معلن'
    ),
  };
  // استرجاع الحقول الموسّعة المخزّنة في details إلى المستوى الأعلى ليقرأها الفرونت
  if (r.details && typeof r.details === 'object') {
    for (const key of DETAIL_KEYS) {
      if (r.details[key] !== undefined && base[key] === undefined) base[key] = r.details[key];
    }
  }
  // إزالة كلمة المرور دائماً بلا استثناء (لا تُخزَّن نصياً أصلاً، لكن كإجراء دفاعي إضافي)
  delete base.password;
  if (canSeeSensitive) return base;
  for (const key of SENSITIVE_KEYS) delete base[key];
  return base;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { id, admin, limit, checkEmail } = req.query;

      // فحص خفيف لوجود بريد مسجّل مسبقاً — بدون كشف أي بيانات (يُستخدم في التسجيل)
      if (checkEmail) {
        const { data } = await supabase.from('members').select('id').ilike('email', String(checkEmail).trim()).maybeSingle();
        return res.status(200).json({ exists: !!data });
      }

      // تحديد هوية الطالب (اختياري) لتقرير ما إذا كان يحق له رؤية الحقول الحسّاسة
      const viewer = await getAuthUser(req);
      const viewerIsAdmin = viewer ? await isAdminEmail(viewer.email) : true;
      const viewerLink = viewer && !viewerIsAdmin ? await getMemberLink(viewer.id) : null;

      let query = supabase.from('members').select('*');
      if (id) query = query.eq('id', String(id)).maybeSingle();
      else {
        const wantsAdminView = !!admin && viewerIsAdmin;
        if (!wantsAdminView) query = query.in('status', ['active', 'pending']);
        query = query.order('pinned', { ascending: false }).order('created_at', { ascending: false });
        if (limit) query = query.limit(Number(limit));
      }
      const { data, error } = await query;
      if (error) throw error;

      if (id) {
        const canSeeSensitive = viewerIsAdmin || (viewerLink && String(viewerLink.member_id) === String(id));
        return res.status(200).json(fromDb(data, canSeeSensitive));
      }
      const listCanSeeSensitive = viewerIsAdmin && !!admin;
      return res.status(200).json((data || []).map((row) => fromDb(row, listCanSeeSensitive)));
    }

    if (req.method === 'POST') {
      const body = req.body || {};

      // ===== استيراد جماعي: صلاحية إدارية فقط =====
      if (Array.isArray(body.bulk)) {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
        const rows = body.bulk.map((m) => compact(toDb(m)));
        if (rows.length === 0) return res.status(400).json({ error: 'bulk array is empty' });
        const { data, error } = await supabase.from('members').upsert(rows).select();
        if (error) {
          let saved = 0;
          const failed = [];
          for (const row of rows) {
            const { error: rowError } = await supabase.from('members').upsert(row);
            if (rowError) failed.push({ id: row.id, error: rowError.message });
            else saved++;
          }
          await writeAuditLog(admin.email, 'bulk_import_members', 'members', null, { saved, failedCount: failed.length });
          return res.status(207).json({ saved, failedCount: failed.length, failed });
        }
        await writeAuditLog(admin.email, 'bulk_import_members', 'members', null, { saved: (data || []).length });
        return res.status(201).json({ saved: (data || []).length, failedCount: 0, failed: [], members: (data || []).map((r) => fromDb(r, true)) });
      }

      // ===== تسجيل عضو جديد: يتطلب حساب Supabase Auth حقيقي تم إنشاؤه مسبقاً من العميل =====
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'يجب إنشاء حساب مصادقة (Supabase Auth) قبل إنشاء الملف الشخصي' });

      const email = (body.email || authUser.email || '').toLowerCase().trim();
      if (email) {
        const { data: existing } = await supabase.from('members').select('id').ilike('email', email).maybeSingle();
        if (existing) return res.status(409).json({ error: 'البريد الإلكتروني هذا مستخدم بالفعل بحساب آخر' });
      }
      // منع ربط حساب مصادقة واحد بأكثر من عضو
      const { data: existingLink } = await supabase.from('member_auth_links').select('member_id').eq('auth_user_id', authUser.id).maybeSingle();
      if (existingLink) return res.status(409).json({ error: 'هذا الحساب مرتبط بملف عضو موجود بالفعل' });

      const payload = compact(toDb({ ...body, email }));
      const { data, error } = await supabase.from('members').upsert(payload).select().single();
      if (error) throw error;

      await supabase.from('member_auth_links').upsert({ auth_user_id: authUser.id, member_id: data.id, email });

      return res.status(201).json(fromDb(data, true));
    }

    if (req.method === 'PUT') {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });

      const authz = await authorizeMemberAction(req, res, id);
      if (!authz) return;

      const partial = toDbPartial(fields, !authz.isAdmin);
      // دمج تعديلات الحقول الموسّعة داخل details (jsonb) مع القيم الحالية
      if (partial.__details) {
        const patch = partial.__details;
        delete partial.__details;
        const { data: cur } = await supabase.from('members').select('details').eq('id', String(id)).maybeSingle();
        partial.details = { ...((cur && cur.details && typeof cur.details === 'object') ? cur.details : {}), ...patch };
      }
      const payload = compact(partial);
      let { data, error } = await supabase.from('members').update(payload).eq('id', String(id)).select().maybeSingle();
      if (!data) {
        const fullPayload = compact(toDb({ id, ...fields }));
        const upsertRes = await supabase.from('members').upsert(fullPayload).select().maybeSingle();
        data = upsertRes.data;
        error = upsertRes.error;
      }
      if (error) throw error;
      if (authz.isAdmin) await writeAuditLog(authz.user.email, 'update_member', 'member', id, { fields: Object.keys(payload) });
      return res.status(200).json(fromDb(data, true));
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { error } = await supabase.from('members').delete().eq('id', String(id));
      if (error) throw error;
      // حذف الربط المصادقي إن وُجد (لا نُفشل الحذف لو تعذّر)
      try { await supabase.from('member_auth_links').delete().eq('member_id', String(id)); } catch { /* ignore */ }
      // سجل التدقيق في الخلفية دون تعطيل الاستجابة
      writeAuditLog(admin.email, 'delete_member', 'member', id, {});
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Members API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
