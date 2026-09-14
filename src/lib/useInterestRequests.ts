import { useState, useEffect, useCallback } from 'react';
import { dataService } from './data/DataService';
import type {
  JourneyRequest as ApiRequest,
  RequestEvent,
  InquiryState,
  JourneyNotification,
} from './types';

const DEFAULT_USER_ID = 'm2';
const CURRENT_USER_ID = DEFAULT_USER_ID;

const getCurrentUserId = () => dataService.db.getCurrentUserId();
const setCurrentUserId = (id: string) => dataService.db.setCurrentUserId(id);
const getMembers = () => dataService.db.getMembers();
const getRequests = (userId?: string) => dataService.db.getRequests(userId);
const getRequest = (id: number) => dataService.db.getRequest(id);
const createRequest = (senderId: string, receiverId: string, message: string) => dataService.db.createRequest(senderId, receiverId, message);
const runRequestAction = (requestId: number, action: string, actorId: string, payload?: any) => dataService.db.runRequestAction(requestId, action, actorId, payload);
const getEvents = (requestId: number) => dataService.db.getEvents(requestId);
const getInquiry = (requestId: number) => dataService.db.getInquiry(requestId);
const buyInquiry = (requestId: number, ownerId: string) => dataService.db.buyInquiry(requestId, ownerId);
const buyMessagePackageCustom = (userId: string, credits: number, price: number, requestId?: number, skipTransactionRecord?: boolean) =>
  dataService.db.buyMessagePackageCustom(userId, credits, price, requestId, skipTransactionRecord);
const sendInquiry = (requestId: number, senderId: string, text: string) => dataService.db.sendInquiry(requestId, senderId, text);
const simulateReply = (requestId: number, replierId: string, text: string) => dataService.db.simulateReply(requestId, replierId, text);
const initializeInquiry = (requestId: number, userId: string) => dataService.db.initializeInquiry(requestId, userId);
const isRequestUnseen = (requestId: number, updatedAt?: string | null) => dataService.db.isRequestUnseen(requestId, updatedAt);
const markRequestSeen = (requestId: number) => dataService.db.markRequestSeen(requestId);
const getJourneyNotifications = (userId: string) => dataService.db.getJourneyNotifications(userId);
const markNotificationRead = (id: number) => dataService.db.markNotificationRead(id);
const markAllNotificationsRead = (userId: string) => dataService.db.markAllNotificationsRead(userId);
const deleteNotification = (id: number) => dataService.db.deleteNotification(id);
const markRequestNotificationsRead = (requestId: number, userId?: string) => dataService.db.markRequestNotificationsRead(requestId, userId);
const getUnreadNotificationsCount = (userId: string) => dataService.db.getUnreadNotificationsCount(userId);
const getActionableRequestsCount = (userId: string) => dataService.db.getActionableRequestsCount(userId);
const hasUserPaidDepositAnywhere = (userId: string) => dataService.db.hasUserPaidDepositAnywhere(userId);

// ============================================================
//  خطاف رحلة طلب الاهتمام — يعمل محلياً بالكامل (localStorage)
//  الهوية النشطة ديناميكية: تتبع الحساب الذي تم الدخول إليه
//  من لوحة التحكم (active_member_id). كل شيء يُحفظ محلياً.
// ============================================================

export {
  CURRENT_USER_ID, DEFAULT_USER_ID, getCurrentUserId, setCurrentUserId, isRequestUnseen, markRequestSeen,
  getJourneyNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification,
  markRequestNotificationsRead, getUnreadNotificationsCount, getActionableRequestsCount,
  hasUserPaidDepositAnywhere, buyMessagePackageCustom,
};

// أنواع متوافقة مع الواجهة
export type { ApiRequest, RequestEvent, InquiryState, JourneyNotification };


export interface ApiMember {
  id: string;
  nickname: string;
  gender: 'male' | 'female';
  age: number;
  country: string;
  city: string;
  verified: boolean;
  premium: boolean;
}

export function useInterestRequests(userId?: string) {
  const currentActiveId = getCurrentUserId();
  const effectiveUserId = (userId && userId.trim()) ? userId.trim() : currentActiveId;

  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      if (!effectiveUserId) {
        setRequests([]);
        setLoading(false);
        return;
      }
      const [reqData, memData] = await Promise.all([
        getRequests(effectiveUserId),
        getMembers(),
      ]);
      const userReqs = (Array.isArray(reqData) ? reqData : []).filter(
        (r) => String(r.sender_id) === effectiveUserId || String(r.receiver_id) === effectiveUserId
      );
      setRequests(userReqs);
      setMembers((memData || []) as ApiMember[]);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء التحميل');
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
    [members],
  );

  const runAction = useCallback(
    async (requestId: number, action: string, payload: Record<string, any> = {}) => {
      setActionLoading(requestId);
      try {
        const res = await runRequestAction(requestId, action, effectiveUserId, payload);
        if (!res.ok) return { ok: false, error: res.error };
        await fetchAll();
        return { ok: true, data: res.data };
      } finally {
        setActionLoading(null);
      }
    },
    [effectiveUserId, fetchAll],
  );

  const sendRequest = useCallback(
    async (receiverId: string, message: string) => {
      const res = await createRequest(effectiveUserId, receiverId, message);
      if (res.ok) await fetchAll();
      return res;
    },
    [effectiveUserId, fetchAll],
  );

  return {
    requests, members, loading, error, actionLoading,
    getMember, runAction, sendRequest, refresh: fetchAll, userId: effectiveUserId,
  };
}

// ===== دوال مساعدة مستقلة (تستخدمها صفحة الرحلة الكاملة) =====
export async function fetchRequest(requestId: number): Promise<ApiRequest | null> {
  return getRequest(requestId);
}

export async function fetchRequestEvents(requestId: number): Promise<RequestEvent[]> {
  return getEvents(requestId);
}

export async function fetchMembers(): Promise<ApiMember[]> {
  return (await getMembers()) as ApiMember[];
}

export async function fetchInquiry(requestId: number): Promise<InquiryState> {
  return getInquiry(requestId);
}

export async function initializeInquiryPackage(requestId: number, userId: string): Promise<{ ok: boolean; state?: InquiryState; error?: string }> {
  return initializeInquiry(requestId, userId);
}

export async function buyInquiryPackage(requestId: number, ownerId: string) {
  return buyInquiry(requestId, ownerId);
}

export async function sendInquiryMessage(requestId: number, senderId: string, text: string) {
  return sendInquiry(requestId, senderId, text);
}

export async function updateInquiryMessage(messageId: number, newText: string) {
  return dataService.db.updateInquiryMessage(messageId, newText);
}

export async function deleteInquiryMessage(messageId: number) {
  return dataService.db.deleteInquiryMessage(messageId);
}

export async function runActionStandalone(requestId: number, action: string, actorId: string, payload: Record<string, any> = {}) {
  return runRequestAction(requestId, action, actorId, payload);
}

// محاكاة ردّ الطرف الآخر داخل غرفة الاستفسار (للتجربة)
export async function simulateInquiryReply(requestId: number, replierId: string, text: string) {
  return simulateReply(requestId, replierId, text);
}

// إنشاء طلب اهتمام جديد (تستخدمه صفحة الملف الشخصي)
export async function createInterestRequest(senderId: string, receiverId: string, message: string) {
  return createRequest(senderId, receiverId, message);
}
