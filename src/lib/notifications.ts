import { dataService } from './data/DataService';

const getJourneyNotifications = (userId: string) => dataService.db.getJourneyNotifications(userId);
const getUnreadNotificationsCount = (userId: string) => dataService.db.getUnreadNotificationsCount(userId);

export interface LocalNotification {
  id: number;
  user_id: string;
  request_id?: number;
  type: string;
  title?: string;
  text: string;
  read: boolean;
  created_at: string;
}

export type UnifiedNotification = LocalNotification & {
  href: string;
  title: string;
  isJourney: boolean;
};

export async function getUnifiedNotifications(userId: string): Promise<UnifiedNotification[]> {
  const items = await getJourneyNotifications(userId);
  return items.map((item) => ({
    ...item,
    href: item.request_id ? `/journey/${item.request_id}${item.type === 'inquiry' ? '?tab=inquiry' : ''}` : '/notifications',
    title: item.title || (item.type === 'admin' ? 'رسالة من الإدارة' : 'تحديث في رحلة طلب اهتمام'),
    isJourney: (item.request_id ?? 0) > 0,
  }));
}

export async function getUnifiedUnreadCount(userId: string): Promise<number> {
  return getUnreadNotificationsCount(userId);
}

export async function markAllUnifiedNotificationsRead(userId: string): Promise<void> {
  await dataService.db.markAllNotificationsRead(userId);
}

export async function markUnifiedNotificationRead(id: number): Promise<void> {
  await dataService.db.markNotificationRead(id);
}

export async function deleteUnifiedNotification(id: number): Promise<void> {
  await dataService.db.deleteNotification(id);
}

export const notificationsApi = {
  getJourneyNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsRead: (userId: string) => dataService.db.markAllNotificationsRead(userId),
  markRequestNotificationsRead: (requestId: number, userId?: string) => dataService.db.markRequestNotificationsRead(requestId, userId),
  deleteNotification: (id: number) => dataService.db.deleteNotification(id),
  markNotificationRead: (id: number) => dataService.db.markNotificationRead(id),
};
