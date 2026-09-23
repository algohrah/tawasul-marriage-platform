import { Buffer } from 'node:buffer';

import health from '../../api/db-wake.js';
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

function getRoute(event) {
  const path = event.rawPath || event.path || '';
  const match = path.match(/(?:\/api|\/functions\/api)\/([^/?]+)/);
  return match?.[1] || '';
}

function parseBody(event) {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function createResponse() {
  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: '',
  };

  const res = {
    setHeader(name, value) {
      response.headers[name] = value;
    },
    status(code) {
      response.statusCode = code;
      return res;
    },
    json(payload) {
      response.body = JSON.stringify(payload);
      response.headers['Content-Type'] = 'application/json';
      return res;
    },
    send(payload) {
      response.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      return res;
    },
    end(payload = '') {
      response.body = payload;
      return res;
    },
  };

  return { response, res };
}

export default async function handler(event) {
  const route = getRoute(event);

  if (route === 'health') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ok', time: new Date().toISOString() }),
    };
  }

  const routeHandler = routeHandlers[route];
  if (!routeHandler) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Unknown API route: ${route || 'missing'}` }),
    };
  }

  const { response, res } = createResponse();
  const req = {
    method: event.httpMethod || event.requestContext?.http?.method || 'GET',
    headers: event.headers || {},
    query: event.queryStringParameters || {},
    body: parseBody(event),
  };

  try {
    await routeHandler(req, res);
    return response;
  } catch (error) {
    console.error(`Netlify API route ${route} failed:`, error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error?.message || 'Internal Server Error' }),
    };
  }
}
