import { createClient } from '@supabase/supabase-js';
import { triggerRestore } from './db-wake.js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let supabase;

if (url && key && !url.includes('placeholder')) {
  supabase = createClient(url, key, {
    global: {
      fetch: async (targetUrl, options) => {
        const res = await fetch(targetUrl, options);
        if (!res.ok && res.status >= 500) triggerRestore();
        return res;
      },
    },
  });
} else {
  const createDummyQuery = () => {
    let lastPayload = null;
    const dummy = {
      select: () => dummy,
      insert: (val) => { lastPayload = val; return dummy; },
      upsert: (val) => { lastPayload = val; return dummy; },
      update: (val) => { lastPayload = val; return dummy; },
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
      then: (resolve, reject) => {
        const resultData = Array.isArray(lastPayload)
          ? lastPayload
          : lastPayload
          ? [lastPayload]
          : [];
        return Promise.resolve({ data: resultData, error: null }).then(resolve, reject);
      },
      catch: (reject) => Promise.resolve({ data: [], error: null }).catch(reject),
    };

    return new Proxy(dummy, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop === 'symbol' || prop === 'inspect' || prop === 'valueOf' || prop === 'toString') return undefined;
        return (arg) => {
          if (arg !== undefined) lastPayload = arg;
          return target;
        };
      },
    });
  };

  supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'admin-1', email: 'admin@tawafok.com' } }, error: null }),
    },
    from: () => createDummyQuery(),
  };
}

export default supabase;

