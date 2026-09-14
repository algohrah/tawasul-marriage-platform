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
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const [membersRes, requestsRes, transactionsRes] = await Promise.all([
      supabase.from('members').select('*'),
      supabase.from('interest_requests').select('*'),
      supabase.from('transactions').select('*'),
    ]);

    if (membersRes.error) throw membersRes.error;
    if (requestsRes.error) throw requestsRes.error;
    if (transactionsRes.error) throw transactionsRes.error;

    const members = membersRes.data || [];
    const requests = requestsRes.data || [];
    const transactions = transactionsRes.data || [];
    const stageOf = (r) => {
      const raw = r.journey_stage || r.status || 'sent';
      return raw === 'pending' ? 'sent' : raw;
    };
    const revenue = transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const stageBreakdown = requests.reduce((acc, req) => {
      const stage = stageOf(req);
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      totalMembers: members.length,
      activeMembers: members.filter((m) => !m.status || m.status === 'active').length,
      pendingMembers: members.filter((m) => m.status === 'pending').length,
      suspendedMembers: members.filter((m) => m.status === 'suspended').length,
      bannedMembers: members.filter((m) => m.status === 'banned').length,
      totalRequests: requests.length,
      pendingRequests: requests.filter((r) => ['pending', 'sent'].includes(stageOf(r))).length,
      activeRequests: requests.filter((r) => !['declined', 'cancelled', 'completed'].includes(stageOf(r))).length,
      activeJourneys: requests.filter((r) => !['declined', 'cancelled', 'completed'].includes(stageOf(r))).length,
      completedRequests: requests.filter((r) => stageOf(r) === 'completed').length,
      declinedRequests: requests.filter((r) => stageOf(r) === 'declined').length,
      cancelledRequests: requests.filter((r) => stageOf(r) === 'cancelled').length,
      seriousRequests: requests.filter((r) => ['seriousness', 'coordination', 'sharia_viewing', 'engagement'].includes(stageOf(r))).length,
      maleCount: members.filter((m) => m.gender === 'male').length,
      femaleCount: members.filter((m) => m.gender === 'female').length,
      males: members.filter((m) => m.gender === 'male').length,
      females: members.filter((m) => m.gender === 'female').length,
      completed: requests.filter((r) => stageOf(r) === 'completed').length,
      verified: members.filter((m) => m.verified).length,
      premium: members.filter((m) => m.premium || m.plan === 'gold' || m.plan === 'elite').length,
      revenue,
      totalRevenue: revenue,
      totalTransactions: transactions.length,
      depositsPaid: requests.filter((r) => r.sender_paid || r.receiver_paid).length,
      seriousnessBadges: members.filter((m) => m.has_seriousness_badge).length,
      stageBreakdown,
      recentEvents: transactions.slice(0, 8).map((tx) => ({
        id: `tx-${tx.id}`,
        note: tx.description || `معاملة ${tx.type || 'مالية'} بقيمة ${Number(tx.amount || 0).toLocaleString('ar-SA')} ر.س`,
        type: tx.type || 'transaction',
        created_at: tx.created_at,
      })),
    });
  } catch (err) {
    console.error('Stats API error:', err);
    return res.status(500).json({ error: err.message });
  }
}