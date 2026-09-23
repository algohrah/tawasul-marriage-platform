const routeModules = {
  'admin-users': '../../api/admin-users.js',
  'audit-log': '../../api/audit-log.js',
  'batch-geo': '../../api/batch-geo.js',
  coupons: '../../api/coupons.js',
  exemptions: '../../api/exemptions.js',
  geo: '../../api/geo.js',
  'geo-nationalities': '../../api/geo-nationalities.js',
  'geo-suggestions': '../../api/geo-suggestions.js',
  'inquiry-messages': '../../api/inquiry-messages.js',
  'interest-requests': '../../api/interest-requests.js',
  'member-reports': '../../api/member-reports.js',
  members: '../../api/members.js',
  notifications: '../../api/notifications.js',
  settings: '../../api/settings.js',
  stats: '../../api/stats.js',
  'support-tickets': '../../api/support-tickets.js',
  transactions: '../../api/transactions.js',
  'verification-docs': '../../api/verification-docs.js',
  whoami: '../../api/whoami.js',
};

function json(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  };
}

function getRoute(event) {
  const path = event.rawPath || event.path || '';
  const match = path.match(/(?:\/api|\/functions\/api-classic)\/([^/?]+)/);
  return match?.[1] || '';
}

function parseBody(event) {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try { return JSON.parse(raw); } catch { return raw; }
}

function createExpressResponse() {
  const state = {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: '',
  };
  const res = {
    setHeader(name, value) { state.headers[name] = String(value); },
    status(code) { state.statusCode = code; return res; },
    json(payload) { state.body = JSON.stringify(payload); state.headers['Content-Type'] = 'application/json'; return res; },
    send(payload) { state.body = typeof payload === 'string' ? payload : JSON.stringify(payload); return res; },
    end(payload = '') { state.body = payload == null ? '' : String(payload); return res; },
  };
  return { state, res };
}

exports.handler = async function handler(event) {
  const route = getRoute(event);

  if (route === 'health') {
    return json(200, { status: 'ok', runtime: 'netlify-classic', time: new Date().toISOString() });
  }

  const modulePath = routeModules[route];
  if (!modulePath) return json(404, { error: `Unknown API route: ${route || 'missing'}` });

  try {
    const imported = await import(modulePath);
    const routeHandler = imported.default;
    if (typeof routeHandler !== 'function') {
      return json(500, { error: `Invalid API handler: ${route}` });
    }

    const { state, res } = createExpressResponse();
    const req = {
      method: event.httpMethod || event.requestContext?.http?.method || 'GET',
      headers: event.headers || {},
      query: event.queryStringParameters || {},
      body: parseBody(event),
    };

    await routeHandler(req, res);
    return state;
  } catch (error) {
    console.error(`Netlify API route ${route} failed:`, error);
    return json(500, { error: error?.message || 'Internal Server Error' });
  }
};
