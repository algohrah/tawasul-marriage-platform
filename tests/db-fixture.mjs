export function makeDb({ plan = 'free', requests = [], failInsert = false } = {}) {
  const tables = {
    members: [{ id: 'sender', plan, premium: false, email: 'sender@test.invalid' }, ...Array.from({length: 50}, (_, i) => ({ id: `receiver${i}`, plan: 'free' }))],
    member_auth_links: [{ auth_user_id: 'auth-sender', member_id: 'sender' }], admin_users: [],
    interest_requests: [...requests], rate_limits: [], request_events: [], notifications: [],
  };
  const db = { tables, auth: { getUser: async token => token === 'test-session' ? { data: { user: { id: 'auth-sender', email: 'sender@test.invalid' } }, error: null } : { data: {}, error: { message: 'Invalid token' } } } };
  db.from = table => {
    let filters = [], action = 'select', payload, mode = 'many', opts = {};
    const q = {
      select: (_cols, options = {}) => { opts = options; return q; },
      eq: (k,v) => { filters.push(r => String(r[k]) === String(v)); return q; },
      gte: (k,v) => { filters.push(r => r[k] >= v); return q; },
      lt: (k,v) => { filters.push(r => r[k] < v); return q; },
      in: (k,v) => { filters.push(r => v.includes(r[k])); return q; },
      order: () => q,
      or: text => {
        // Supports the API's duplicate-pair query.
        if (text.startsWith('and(')) {
          const matches = [...text.matchAll(/sender_id.eq.([^,]+),receiver_id.eq.([^\)]+)/g)];
          filters.push(r => matches.some(m => r.sender_id === m[1] && r.receiver_id === m[2]));
        }
        return q;
      },
      insert: value => { action='insert'; payload=value; return q; },
      update: value => { action='update'; payload=value; return q; },
      maybeSingle: () => { mode='one'; return q; }, single: () => { mode='one'; return q; },
      then: (resolve,reject) => Promise.resolve().then(() => {
        const rows = tables[table] ||= [];
        let result = rows.filter(r => filters.every(f => f(r)));
        if (action === 'insert') {
          if (table === 'interest_requests' && failInsert) return { data:null, error:{message:'Controlled insertion failure'} };
          const values = Array.isArray(payload) ? payload : [payload];
          if (table === 'rate_limits' && values.some(v => rows.some(r => r.key === v.key))) return {data:null,error:{code:'23505'}};
          result = values.map(v => ({...v})); rows.push(...result);
        } else if (action === 'update') result.forEach(r => Object.assign(r,payload));
        return { data: opts.head ? null : mode === 'one' ? (result[0] ? {...result[0]} : null) : result.map(r=>({...r})), count:result.length, error:null };
      }).then(resolve,reject),
    }; return q;
  }; return db;
}
