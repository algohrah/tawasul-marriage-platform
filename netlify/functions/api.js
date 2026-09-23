import auditLog from '../../api/audit-log.js';
import adminUsers from '../../api/admin-users.js';
import batchGeo from '../../api/batch-geo.js';
import coupons from '../../api/coupons.js';
import exemptions from '../../api/exemptions.js';
import geo from '../../api/geo.js';
import geoNationalities from '../../api/geo-nationalities.js';
import geoSuggestions from '../../api/geo-suggestions.js';
import inquiryMessages from '../../api/inquiry-messages.js';
import interestRequests from '../../api/interest-requests.js';
import memberReports from '../../api/member-reports.js';
import members from '../../api/members.js';
import notifications from '../../api/notifications.js';
import settings from '../../api/settings.js';
import stats from '../../api/stats.js';
import supportTickets from '../../api/support-tickets.js';
import transactions from '../../api/transactions.js';
import verificationDocs from '../../api/verification-docs.js';
import whoami from '../../api/whoami.js';

const routeHandlers = {
  'admin-users': adminUsers,
  'audit-log': auditLog,
  'batch-geo': batchGeo,
  coupons,
  exemptions,
  geo,
  'geo-nationalities': geoNationalities,
  'geo-suggestions': geoSuggestions,
  'inquiry-messages': inquiryMessages,
  'interest-requests': interestRequests,
  'member-reports': memberReports,
  members,
  notifications,
  settings,
  stats,
  'support-tickets': supportTickets,
  transactions,
  'verification-docs': verificationDocs,
  whoami,
};

function getRoute(request) {
  const path = new URL(request.url).pathname;
  const match = path.match(/(?:\/api|\/functions\/api)\/([^/?]+)/);
  return match?.[1] || '';
}

async function parseBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const raw = await request.text();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function createExpressResponse() {
  const state = {
    status: 200,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: '',
  };

  const res = {
    setHeader(name, value) {
      state.headers.set(name, String(value));
    },
    status(code) {
      state.status = code;
      return res;
    },
    json(payload) {
      state.body = JSON.stringify(payload);
      state.headers.set('Content-Type', 'application/json');
      return res;
    },
    send(payload) {
      state.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      return res;
    },
    end(payload = '') {
      state.body = payload == null ? '' : String(payload);
      return res;
    },
  };

  return { state, res };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Modern Netlify Function: receives a Web Request and must return a Web Response.
export default async function handler(request) {
  const route = getRoute(request);

  if (route === 'health') {
    return jsonResponse({ status: 'ok', time: new Date().toISOString() });
  }

  const routeHandler = routeHandlers[route];
  if (!routeHandler) {
    return jsonResponse({ error: `Unknown API route: ${route || 'missing'}` }, 404);
  }

  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const { state, res } = createExpressResponse();
  const req = {
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    query,
    body: await parseBody(request),
  };

  try {
    await routeHandler(req, res);
    return new Response(state.body, {
      status: state.status,
      headers: state.headers,
    });
  } catch (error) {
    console.error(`Netlify API route ${route} failed:`, error);
    return jsonResponse({ error: error?.message || 'Internal Server Error' }, 500);
  }
}
