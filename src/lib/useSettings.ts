import { useState } from 'react';

// ============================================================
//  الإعدادات المالية للرحلة — محلية بالكامل داخل المشروع
//  لا قاعدة بيانات خارجية. القيم ثابتة هنا ويمكن تعديلها مباشرة.
// ============================================================

export interface JourneySettings {
  deposit_amount: number;
  final_fee_amount: number;
  inquiry_package_price: number;
  inquiry_package_credits: number;
  inquiry_low_credits: number;
  payment_deadline_days: number;
  free_attempts_after_deposit: number;
  new_request_cooldown_days: number;
  refund_before_meeting: number;
  refund_after_meeting: number;
}

export const DEFAULT_SETTINGS: JourneySettings = {
  deposit_amount: 500,
  final_fee_amount: 2000,
  inquiry_package_price: 100,
  inquiry_package_credits: 20,
  inquiry_low_credits: 3,
  payment_deadline_days: 15,
  free_attempts_after_deposit: 5,
  new_request_cooldown_days: 30,
  refund_before_meeting: 0,
  refund_after_meeting: 0,
};

export function useSettings() {
  const [settings] = useState<JourneySettings>(DEFAULT_SETTINGS);
  return { settings, loaded: true };
}

// جلب الإعدادات مرة واحدة (للاستخدام خارج React عند الحاجة)
export async function fetchSettings(): Promise<JourneySettings> {
  return DEFAULT_SETTINGS;
}
