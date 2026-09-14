import { createClient } from '@supabase/supabase-js';

const env = ((typeof import.meta !== 'undefined' && import.meta && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {})) as Record<string, string | undefined>;
const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const hasRealSupabase = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder')
);

type LocalSession = {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
};

const AUTH_KEY = 'twafok_local_auth_session';

function readSession(): LocalSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(session: LocalSession | null) {
  if (typeof window === 'undefined') return;
  if (session) localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  else localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new CustomEvent('local-auth-changed', { detail: session }));
}

function makeSession(email: string): LocalSession {
  return {
    access_token: `local-token-${Date.now()}`,
    refresh_token: `local-refresh-${Date.now()}`,
    user: { id: email || 'local-user', email: email || 'demo@tawasul.sa' },
  };
}

const createDummyChannel = () => {
  const dummy = {
    on: () => dummy,
    subscribe: () => dummy,
    unsubscribe: () => dummy,
  };
  return dummy;
};

const createDummyQuery = () => {
  let lastPayload: any = null;
  const dummy: any = {
    select: () => dummy,
    insert: (val: any) => { lastPayload = val; return dummy; },
    upsert: (val: any) => { lastPayload = val; return dummy; },
    update: (val: any) => { lastPayload = val; return dummy; },
    delete: () => dummy,
    eq: () => dummy,
    neq: () => dummy,
    gt: () => dummy,
    gte: () => dummy,
    lt: () => dummy,
    lte: () => dummy,
    like: () => dummy,
    ilike: () => dummy,
    is: () => dummy,
    in: () => dummy,
    contains: () => dummy,
    containedBy: () => dummy,
    range: () => dummy,
    textSearch: () => dummy,
    match: () => dummy,
    not: () => dummy,
    or: () => dummy,
    filter: () => dummy,
    order: () => dummy,
    limit: () => dummy,
    offset: () => dummy,
    csv: () => dummy,
    returns: () => dummy,
    rollback: () => dummy,
    single: async () => ({
      data: Array.isArray(lastPayload) ? (lastPayload[0] || {}) : (lastPayload || {}),
      error: null,
    }),
    maybeSingle: async () => ({
      data: Array.isArray(lastPayload) ? (lastPayload[0] || null) : (lastPayload || null),
      error: null,
    }),
    then: (resolve: any, reject: any) => {
      const resultData = Array.isArray(lastPayload)
        ? lastPayload
        : lastPayload
        ? [lastPayload]
        : [];
      return Promise.resolve({ data: resultData, error: null }).then(resolve, reject);
    },
    catch: (reject: any) => Promise.resolve({ data: [], error: null }).catch(reject),
  };

  return new Proxy(dummy, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol' || prop === 'inspect' || prop === 'valueOf' || prop === 'toString') return undefined;
      return (arg: any) => {
        if (arg !== undefined) lastPayload = arg;
        return target;
      };
    },
  });
};

let supabaseClient: any;

if (hasRealSupabase) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
} else {
  supabaseClient = {
    auth: {
      getSession: async () => ({ data: { session: readSession() }, error: null }),
      onAuthStateChange: (callback: (_event: string, session: LocalSession | null) => void) => {
        const handler = (event: Event) => callback('LOCAL_AUTH_CHANGED', (event as CustomEvent).detail ?? readSession());
        window.addEventListener('local-auth-changed', handler);
        return { data: { subscription: { unsubscribe: () => window.removeEventListener('local-auth-changed', handler) } } };
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        if (!email.includes('@') || password.length < 6) {
          return { data: { user: null, session: null }, error: new Error('بيانات الدخول غير صحيحة') };
        }
        const session = makeSession(email);
        saveSession(session);
        return { data: { user: session.user, session }, error: null };
      },
      signUp: async ({ email, password }: { email: string; password: string }) => {
        if (!email.includes('@') || password.length < 6) {
          return { data: { user: null, session: null }, error: new Error('البريد أو كلمة المرور غير صحيحة') };
        }
        const session = makeSession(email);
        saveSession(session);
        return { data: { user: session.user, session }, error: null };
      },
      signOut: async () => { saveSession(null); return { error: null }; },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: {}, error: null }),
      setSession: async ({ access_token, refresh_token }: { access_token?: string; refresh_token?: string }) => {
        const session: LocalSession = {
          access_token: access_token || `local-token-${Date.now()}`,
          refresh_token: refresh_token || `local-refresh-${Date.now()}`,
          user: { id: 'google-local-user', email: 'google.local@tawasul.sa' },
        };
        saveSession(session);
        return { data: { user: session.user, session }, error: null };
      },
      signInWithIdToken: async () => {
        const session = makeSession('google.local@tawasul.sa');
        saveSession(session);
        return { data: { user: session.user, session }, error: null };
      },
    },
    channel: (_name: string) => createDummyChannel(),
    removeChannel: (_ch: any) => {},
    from: (_table: string) => createDummyQuery(),
  };
}

export default supabaseClient;
