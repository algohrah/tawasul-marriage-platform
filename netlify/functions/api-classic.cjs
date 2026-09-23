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

// Keep each import path as a string literal so Netlify/esbuild includes every
// API handler and its dependencies in the deployed function bundle.
async function loadRouteHandler(route) {
  switch (route) {
    case 'admin-users': return (await import('../../api/admin-users.js')).default;
    case 'audit-log': return (await import('../../api/audit-log.js')).default;
    case 'batch-geo': return (await import('../../api/batch-geo.js')).default;
    case 'coupons': return (await import('../../api/coupons.js')).default;
    case 'exemptions': return (await import('../../api/exemptions.js')).default;
    case 'geo': return (await import('../../api/geo.js')).default;
    case 'geo-nationalities': return (await import('../../api/geo-nationalities.js')).default;
    case 'geo-suggestions': return (await import('../../api/geo-suggestions.js')).default;
    case 'inquiry-messages': return (await import('../../api/inquiry-messages.js')).default;
    case 'interest-requests': return (await import('../../api/interest-requests.js')).default;
    case 'member-reports': return (await import('../../api/member-reports.js')).default;
    case 'members': return (await import('../../api/members.js')).default;
    case 'notifications': return (await import('../../api/notifications.js')).default;
    case 'settings': return (await import('../../api/settings.js')).default;
    case 'stats': return (await import('../../api/stats.js')).default;
    case 'support-tickets': return (await import('../../api/support-tickets.js')).default;
    case 'transactions': return (await import('../../api/transactions.js')).default;
    case 'verification-docs': return (await import('../../api/verification-docs.js')).default;
    case 'whoami': return (await import('../../api/whoami.js')).default;
    default: return null;
  }
}

exports.handler = async function handler(event) {
  const route = getRoute(event);

  if (route === 'health') {
    return json(200, { status: 'ok', runtime: 'netlify-classic', time: new Date().toISOString() });
  }

  try {
    const routeHandler = await loadRouteHandler(route);
    if (!routeHandler) return json(404, { error: `Unknown API route: ${route || 'missing'}` });
    if (typeof routeHandler !== 'function') return json(500, { error: `Invalid API handler: ${route}` });

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
