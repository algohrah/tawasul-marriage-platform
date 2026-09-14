import { useState, useEffect, useCallback } from 'react';
import type {
  AdminMemberRow,
  AdminStats,
  JourneyRequest as AdminRequestRow,
  MemberStatus,
  RequestPaymentsSummary,
} from './types';

import { dataService } from './data/DataService';
import { useApp } from './AppContext';

export type { RequestPaymentsSummary };
export type { MemberStatus };
export type { AdminMemberRow, AdminStats, AdminRequestRow };

// ============================================================
//  خطاف بيانات لوحة الإدارة — موحّد بالكامل عبر dataService.db
//  يقرأ نفس قاعدة بيانات رحلة الطلب من خلال المزوّد النشط
// ============================================================


export function useAdminMembers() {
  const {
    setMembers: setAppMembers,
    setAdminMembers: setAppAdminMembers,
    adminDeleteMember: appAdminDeleteMember,
    adminUpdateMemberStatus: appAdminUpdateMemberStatus,
    adminMembers: appAdminMembers,
  } = useApp();

  const [members, setMembers] = useState<AdminMemberRow[]>(() => {
    try {
      if (Array.isArray(appAdminMembers)) return appAdminMembers as unknown as AdminMemberRow[];
      const live = dataService.db.getLiveMembers(true);
      if (Array.isArray(live)) return live as unknown as AdminMemberRow[];
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(members.length === 0);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setError(null);
      const res = await dataService.db.adminGetMembers();
      if (res && Array.isArray(res)) {
        setMembers(res);
      }
    } catch (err: any) {
      if (members.length === 0) {
        setError(err.message || 'تعذّر تحميل الأعضاء');
      }
    } finally {
      setLoading(false);
    }
  }, [members.length]);

  useEffect(() => {
    if (Array.isArray(appAdminMembers)) {
      setMembers(appAdminMembers as unknown as AdminMemberRow[]);
      setLoading(false);
    }
  }, [appAdminMembers]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // إعادة الجلب عند عودة التركيز للنافذة أو عند استعادة قاعدة البيانات الشاملة
  useEffect(() => {
    const onFocus = () => { fetchMembers(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('twafok_db_restored', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('twafok_db_restored', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [fetchMembers]);

  const updateMember = useCallback(async (id: string, fields: any) => {
    // Optimistic local updates
    setMembers((prev) => prev.map((m) => (m.id === id ? ({ ...m, ...fields } as any) : m)));
    setAppAdminMembers((prev) => prev.map((m) => (m.id === id ? ({ ...m, ...fields } as any) : m)));
    setAppMembers((prev) => prev.map((m) => (m.id === id ? ({ ...m, ...fields } as any) : m)));

    const ok = await dataService.db.adminUpdateMember(id, fields);
    if (ok) {
      if (fields.status) {
        appAdminUpdateMemberStatus(id, fields.status as any, fields.statusReason);
      }
    } else {
      await fetchMembers();
    }
    return ok;
  }, [appAdminUpdateMemberStatus, setAppAdminMembers, setAppMembers, fetchMembers]);

  // ===== إجراءات جماعية تفاعلية فورية (Optimistic Bulk Actions) =====
  const bulkDelete = useCallback(async (ids: string[]) => {
    // 1. تحديث فوري مباشر في الواجهة لإخفاء الأعضاء فوراً
    setMembers((prev) => prev.filter((m) => !ids.includes(m.id)));
    setAppAdminMembers((prev) => prev.filter((m) => !ids.includes(m.id)));
    setAppMembers((prev) => prev.filter((m) => !ids.includes(m.id)));

    // 2. إرسال أمر الحذف إلى قاعدة البيانات
    const ok = await dataService.db.adminBulkDeleteMembers(ids);
    if (ok) {
      await fetchMembers();
    } else {
      await fetchMembers(); // تراجع عند الخلل
    }
    return ok;
  }, [fetchMembers, setAppMembers, setAppAdminMembers]);

  const bulkUpdateStatus = useCallback(async (ids: string[], status: MemberStatus, reason = '', by = 'الإدارة') => {
    const updater = (m: any) =>
      ids.includes(m.id)
        ? { ...m, status, statusReason: reason, statusChangedBy: by, statusChangedAt: new Date().toISOString() }
        : m;

    // 1. تحديث تفاعلي فوري بالواجهة
    setMembers((prev) => prev.map(updater));
    setAppAdminMembers((prev) => prev.map(updater));
    setAppMembers((prev) => prev.map(updater));

    // 2. حفظ بقاعدة البيانات
    const ok = await dataService.db.adminBulkUpdateStatus(ids, status, reason, by);
    if (ok) {
      await fetchMembers();
    } else {
      await fetchMembers();
    }
    return ok;
  }, [fetchMembers, setAppAdminMembers, setAppMembers]);

  const bulkSetVerified = useCallback(async (ids: string[], value: boolean) => {
    const updater = (m: any) => (ids.includes(m.id) ? { ...m, verified: value } : m);
    setMembers((prev) => prev.map(updater));
    setAppAdminMembers((prev) => prev.map(updater));
    setAppMembers((prev) => prev.map(updater));

    const ok = await dataService.db.adminBulkSetVerified(ids, value);
    if (ok) {
      await fetchMembers();
    } else {
      await fetchMembers();
    }
    return ok;
  }, [fetchMembers, setAppAdminMembers, setAppMembers]);

  const bulkSetPinned = useCallback(async (ids: string[], value: boolean) => {
    const updater = (m: any) => (ids.includes(m.id) ? { ...m, pinned: value } : m);
    setMembers((prev) => prev.map(updater));
    setAppAdminMembers((prev) => prev.map(updater));
    setAppMembers((prev) => prev.map(updater));

    const ok = await dataService.db.adminBulkSetPinned(ids, value);
    if (ok) {
      await fetchMembers();
    } else {
      await fetchMembers();
    }
    return ok;
  }, [fetchMembers, setAppAdminMembers, setAppMembers]);

  const bulkSetPlan = useCallback(async (ids: string[], plan: 'free' | 'gold' | 'elite') => {
    const premium = plan !== 'free';
    const updater = (m: any) => (ids.includes(m.id) ? { ...m, plan, premium } : m);
    setMembers((prev) => prev.map(updater));
    setAppAdminMembers((prev) => prev.map(updater));
    setAppMembers((prev) => prev.map(updater));

    const ok = await dataService.db.adminBulkSetPlan(ids, plan);
    if (ok) {
      await fetchMembers();
    } else {
      await fetchMembers();
    }
    return ok;
  }, [fetchMembers, setAppAdminMembers, setAppMembers]);

  const bulkSetSeriousnessBadge = useCallback(async (ids: string[], value: boolean) => {
    const updater = (m: any) => (ids.includes(m.id) ? { ...m, hasSeriousnessBadge: value } : m);
    setMembers((prev) => prev.map(updater));
    setAppAdminMembers((prev) => prev.map(updater));
    setAppMembers((prev) => prev.map(updater));

    const ok = await dataService.db.adminBulkSetSeriousnessBadge(ids, value);
    if (ok) {
      await fetchMembers();
    } else {
      await fetchMembers();
    }
    return ok;
  }, [fetchMembers, setAppAdminMembers, setAppMembers]);

  const deleteMember = useCallback(async (id: string) => {
    // حذف فوري من الواجهة، ثم إرسال الطلب — بلا إعادة جلب كامل للقائمة (أسرع بكثير)
    setMembers((prev) => prev.filter((m) => m.id !== id));
    appAdminDeleteMember(id);
    const ok = await dataService.db.adminDeleteMember(id);
    return ok;
  }, [appAdminDeleteMember, setMembers]);

  const hardDeleteMember = useCallback(async (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    appAdminDeleteMember(id);
    const ok = await dataService.db.adminHardDeleteMember(id);
    return ok;
  }, [appAdminDeleteMember, setMembers]);

  const resetPassword = useCallback(async (id: string) => {
    const newPw = await dataService.db.adminResetPassword(id);
    if (newPw) {
      await fetchMembers();
      setAppAdminMembers((prev) => prev.map((m) => (m.id === id ? { ...m, password: newPw } : m)));
    }
    return newPw;
  }, [fetchMembers, setAppAdminMembers]);

  const toggleVerified = useCallback(async (id: string, v: boolean) => {
    return updateMember(id, { verified: v });
  }, [updateMember]);

  const setPremium = useCallback(async (id: string, v: boolean) => {
    return updateMember(id, { premium: v, plan: v ? 'gold' : 'free' });
  }, [updateMember]);

  const setNote = useCallback(async (id: string, note: string) => {
    return updateMember(id, { adminNote: note, adminNotes: note });
  }, [updateMember]);

  const toggleFlag = useCallback(async (id: string, v: boolean) => {
    return updateMember(id, { flagged: v });
  }, [updateMember]);

  const notifyMember = useCallback(async (id: string, text: string) => {
    return dataService.db.adminSendNotification(id, text);
  }, []);

  return {
    members, loading, error, refresh: fetchMembers,
    updateMember, deleteMember, hardDeleteMember, resetPassword, toggleVerified, setPremium, setNote, toggleFlag, notifyMember,
    bulkDelete, bulkUpdateStatus, bulkSetVerified, bulkSetPinned, bulkSetPlan, bulkSetSeriousnessBadge,
  };
}

export function useAdminStats() {
  const { adminMembers, interestRequests } = useApp();

  const [stats, setStats] = useState<AdminStats | null>(() => {
    try {
      const live = dataService.db.getLiveMembers(true);
      const membersToUse = live && live.length > 0 ? live : (adminMembers || []);
      if (membersToUse.length > 0) {
        const reqs = interestRequests || [];
        const pendingReqs = reqs.filter((r) => r.status === 'pending').length;
        const activeJ = reqs.filter((r) => !['declined', 'cancelled', 'completed'].includes(r.status)).length;
        const completedJ = reqs.filter((r) => (r as any).status === 'completed').length;
        const declinedJ = reqs.filter((r) => (r as any).status === 'declined').length;
        const cancelledJ = reqs.filter((r) => (r as any).status === 'cancelled').length;

        const breakdown: Record<string, number> = {
          sent: reqs.filter((r) => r.status === 'pending').length,
          accepted: reqs.filter((r) => (r as any).status === 'accepted').length,
          seriousness: 0, coordination: 0, sharia_viewing: 0, engagement: 0,
          completed: completedJ, declined: declinedJ, cancelled: cancelledJ,
        };

        const activeM = membersToUse.filter((m: any) => m.status === 'active' || !m.status).length;
        const pendingM = membersToUse.filter((m: any) => m.status === 'pending').length;
        const suspendedM = membersToUse.filter((m: any) => m.status === 'suspended').length;
        const bannedM = membersToUse.filter((m: any) => m.status === 'banned').length;
        const males = membersToUse.filter((m: any) => m.gender === 'male').length;
        const females = membersToUse.filter((m: any) => m.gender === 'female').length;

        return {
          totalMembers: membersToUse.length,
          activeMembers: activeM,
          pendingMembers: pendingM,
          suspendedMembers: suspendedM,
          bannedMembers: bannedM,
          totalRequests: reqs.length,
          completedRequests: completedJ,
          declinedRequests: declinedJ,
          cancelledRequests: cancelledJ,
          seriousRequests: 0,
          maleCount: males,
          femaleCount: females,
          males,
          females,
          pendingRequests: pendingReqs,
          activeRequests: reqs.length,
          activeJourneys: activeJ,
          completed: completedJ,
          verified: membersToUse.filter((m: any) => m.verified).length,
          premium: membersToUse.filter((m: any) => m.premium || m.plan === 'gold' || m.plan === 'elite').length,
          revenue: membersToUse.filter((m: any) => m.plan === 'gold').length * 200 + membersToUse.filter((m: any) => m.plan === 'elite').length * 500,
          depositsPaid: reqs.filter((r) => (r as any).senderPaid || (r as any).receiverPaid).length,
          stageBreakdown: breakdown,
          seriousnessBadges: membersToUse.filter((m: any) => m.hasSeriousnessBadge || m.has_seriousness_badge).length,
          totalTransactions: 0,
          totalRevenue: 0,
          recentEvents: [],
        };
      }
    } catch {}
    return null;
  });

  const [loading, setLoading] = useState(!stats);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await dataService.db.adminGetStats();
      if (res) setStats(res);
    } catch (err: any) {
      if (!stats) setError(err.message || 'تعذّر تحميل الإحصائيات');
    } finally {
      setLoading(false);
    }
  }, [stats]);

  useEffect(() => { refresh(); }, [refresh]);

  return { stats, loading, error, refresh };
}

export function useAdminRequests() {
  const { interestRequests, adminMembers: appAdminMembers } = useApp();

  const [requests, setRequests] = useState<AdminRequestRow[]>([]);
  const [members, setMembers] = useState<AdminMemberRow[]>(() => {
    try {
      if (appAdminMembers && appAdminMembers.length > 0) return appAdminMembers as unknown as AdminMemberRow[];
      const live = dataService.db.getLiveMembers(true);
      if (live && live.length > 0) return live as unknown as AdminMemberRow[];
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(requests.length === 0 && members.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [reqData, memData] = await Promise.all([
        dataService.db.adminGetRequests(),
        dataService.db.adminGetMembers(),
      ]);
      if (reqData) setRequests(reqData);
      if (memData) setMembers(memData);
    } catch (err: any) {
      if (requests.length === 0) {
        setError(err.message || 'تعذّر تحميل الطلبات');
      }
    } finally {
      setLoading(false);
    }
  }, [requests.length]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // الإدارة تضبط مرحلة الطلب مباشرة (ينعكس للأعضاء فوراً)
  const setStage = useCallback(async (requestId: number, stage: string, note?: string) => {
    setActionLoading(requestId);
    try {
      const res = await dataService.db.runRequestAction(requestId, 'set_stage', 'admin', { stage, note });
      if (res.ok) await fetchAll();
      return res.ok;
    } finally {
      setActionLoading(null);
    }
  }, [fetchAll]);

  // الإدارة تحدّث تنسيق الموعد
  const updateCoordination = useCallback(async (requestId: number, meetingDate: string, meetingNotes: string) => {
    setActionLoading(requestId);
    try {
      const res = await dataService.db.runRequestAction(requestId, 'update_coordination', 'admin', { meetingDate, meetingNotes });
      if (res.ok) await fetchAll();
      return res.ok;
    } finally {
      setActionLoading(null);
    }
  }, [fetchAll]);

  const getMember = useCallback(
    (id: string) => {
      if (!id) return undefined;
      const strId = String(id).trim();
      let found = members.find((m) => String(m.id).trim() === strId);
      if (!found) {
        found = dataService.db.getLiveMemberById(id);
      }
      return found;
    },
    [members]
  );

  // جلب سجل أحداث طلب معيّن (للوحة الإدارة)
  const fetchEvents = useCallback((requestId: number) => dataService.db.getEvents(requestId), []);

  // جلب سجل مدفوعات طلب معيّن
  const fetchPayments = useCallback((requestId: number) => dataService.db.adminGetRequestPayments(requestId), []);

  // حذف طلب نهائياً
  const deleteRequest = useCallback(async (requestId: number) => {
    setActionLoading(requestId);
    try {
      const ok = await dataService.db.adminDeleteRequest(requestId);
      if (ok) await fetchAll();
      return ok;
    } finally { setActionLoading(null); }
  }, [fetchAll]);

  // ===== المرحلة 1: تحكّم الإدارة الكامل في المراحل =====

  // نقل الطلب لأي مرحلة مع سبب
  const moveToStage = useCallback(async (requestId: number, stage: string, reason: string) => {
    setActionLoading(requestId);
    try {
      const res = await dataService.db.runRequestAction(requestId, 'set_stage', 'admin', { stage, note: reason });
      if (res.ok) await fetchAll();
      return res.ok;
    } finally { setActionLoading(null); }
  }, [fetchAll]);

  // تأخير مرحلة (رجوع خطوة للخلف)
  const delayStage = useCallback(async (requestId: number, reason: string) => {
    setActionLoading(requestId);
    try {
      const req = requests.find((r) => r.id === requestId);
      if (!req) return false;
      const stages = ['sent', 'accepted', 'seriousness', 'coordination', 'sharia_viewing', 'engagement', 'completed'];
      const idx = stages.indexOf(req.journey_stage);
      if (idx <= 0) return false;
      const prev = stages[idx - 1];
      const res = await dataService.db.runRequestAction(requestId, 'set_stage', 'admin', { stage: prev, note: `تأخير إداري: ${reason}` });
      if (res.ok) await fetchAll();
      return res.ok;
    } finally { setActionLoading(null); }
  }, [fetchAll, requests]);

  // تجميد الطلب
  const freezeRequest = useCallback(async (requestId: number, reason: string) => {
    setActionLoading(requestId);
    try {
      const res = await dataService.db.runRequestAction(requestId, 'freeze_request', 'admin', { note: reason });
      if (res.ok) await fetchAll();
      return res.ok;
    } finally { setActionLoading(null); }
  }, [fetchAll]);

  // إلغاء التجميد
  const unfreezeRequest = useCallback(async (requestId: number) => {
    setActionLoading(requestId);
    try {
      const res = await dataService.db.runRequestAction(requestId, 'unfreeze_request', 'admin', {});
      if (res.ok) await fetchAll();
      return res.ok;
    } finally { setActionLoading(null); }
  }, [fetchAll]);

  // إعادة تفعيل طلب منتهٍ/ملغى
  const reactivateRequest = useCallback(async (requestId: number, stage: string, reason: string) => {
    setActionLoading(requestId);
    try {
      const res = await dataService.db.runRequestAction(requestId, 'reactivate', 'admin', { stage, note: reason });
      if (res.ok) await fetchAll();
      return res.ok;
    } finally { setActionLoading(null); }
  }, [fetchAll]);

  // تبديل طرف (المرسِل أو المستقبِل)
  const swapParty = useCallback(async (requestId: number, role: 'sender' | 'receiver', newMemberId: string, reason: string) => {
    setActionLoading(requestId);
    try {
      const res = await dataService.db.runRequestAction(requestId, 'swap_party', 'admin', { role, newMemberId, note: reason });
      if (res.ok) await fetchAll();
      return res.ok;
    } finally { setActionLoading(null); }
  }, [fetchAll]);

  // الإدارة تضبط حالة الدفع
  const adminSetPayments = useCallback(async (requestId: number, sender_paid: boolean, receiver_paid: boolean) => {
    setActionLoading(requestId);
    try {
      const res = await dataService.db.runRequestAction(requestId, 'admin_set_payments', 'admin', { sender_paid, receiver_paid });
      if (res.ok) await fetchAll();
      return res.ok;
    } finally { setActionLoading(null); }
  }, [fetchAll]);

  // الإدارة تضبط تعهدات الطرفين
  const adminSetPledges = useCallback(async (requestId: number, male_pledged: boolean, female_pledged: boolean) => {
    setActionLoading(requestId);
    try {
      const res = await dataService.db.runRequestAction(requestId, 'admin_set_pledges', 'admin', { male_pledged, female_pledged });
      if (res.ok) await fetchAll();
      return res.ok;
    } finally { setActionLoading(null); }
  }, [fetchAll]);

  // الإدارة تضبط نتائج النظرة الشرعية
  const adminSetViewingResults = useCallback(async (requestId: number, sender_viewing_result: string | null, receiver_viewing_result: string | null) => {
    setActionLoading(requestId);
    try {
      const res = await dataService.db.runRequestAction(requestId, 'admin_set_viewing_results', 'admin', { sender_viewing_result, receiver_viewing_result });
      if (res.ok) await fetchAll();
      return res.ok;
    } finally { setActionLoading(null); }
  }, [fetchAll]);

  // الإدارة تضبط بيانات تواصل الطرفين
  const adminSetContacts = useCallback(async (requestId: number, fields: { male_phone?: string; male_name?: string; guardian_phone?: string; guardian_name?: string; contact_info?: string }) => {
    setActionLoading(requestId);
    try {
      const res = await dataService.db.runRequestAction(requestId, 'admin_set_contacts', 'admin', fields);
      if (res.ok) await fetchAll();
      return res.ok;
    } finally { setActionLoading(null); }
  }, [fetchAll]);

  return {
    requests, members, loading, error, actionLoading,
    refresh: fetchAll, setStage, updateCoordination, getMember, fetchEvents, fetchPayments, deleteRequest,
    moveToStage, delayStage, freezeRequest, unfreezeRequest, reactivateRequest, swapParty,
    adminSetPayments, adminSetPledges, adminSetViewingResults, adminSetContacts,
  };
}
