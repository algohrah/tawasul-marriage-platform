// Local development access model.
// There are only two account kinds during development: member and owner admin.

export const DEMO_ADMIN = {
  id: 'owner-admin',
  email: 'admin@tawafok.com',
  password: 'Pass@1234',
  name: 'المدير العام',
  role: 'super_admin' as const,
};

export const ADMIN_SESSION_KEY = 'twafok_owner_admin_session';

export const OWNER_ADMIN_PERMISSIONS = {
  manage_members: true,
  manage_requests: true,
  manage_support: true,
  manage_content: true,
  view_sensitive_data: true,
} as const;

export function hasOwnerAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
}

export function startOwnerAdminSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_SESSION_KEY, 'true');
}

export function endOwnerAdminSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_SESSION_KEY);
  // Remove legacy development flags so old moderator/admin sessions cannot survive.
  localStorage.removeItem('twafok_demo_admin');
  localStorage.removeItem('twafok_active_admin_email');
  localStorage.removeItem('twafok_current_admin_user');
  localStorage.removeItem('saved_admin_users');
  localStorage.removeItem('twafok_admin_users');
}

export function isDemoAdminCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === DEMO_ADMIN.email && password === DEMO_ADMIN.password;
}
