import supabase from './db-client.js';
import { getAuthUser, isAdminEmail, getMemberLink } from './_auth.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(200).json({ authenticated: false, isAdmin: false, member: null });

    const admin = await isAdminEmail(user.email);
    const link = await getMemberLink(user.id);
    let member = null;
    if (link?.member_id) {
      const { data } = await supabase.from('members').select('*').eq('id', link.member_id).maybeSingle();
      member = data || null;
    }

    return res.status(200).json({
      authenticated: true,
      isAdmin: admin,
      authUser: { id: user.id, email: user.email },
      member,
    });
  } catch (err) {
    console.error('Whoami API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
