export type DatabaseProvider = 'api' | 'local' | 'supabase';

export const DATABASE_CONFIG = {
  // الوضع الافتراضي: local — تشغيل فوري وسلس في المتصفح بكامل الوظائف وبدون أخطاء 404
  PROVIDER: (((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_DATABASE_PROVIDER) || 'local') as DatabaseProvider),
};

