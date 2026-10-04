# Lightweight admin visitor analytics

## Scope and privacy

`/admin/visitor-analytics` is independent of memberships, journeys, fees, message purchases and Boost. The existing admin analytics page is untouched. The tracker runs on public routes, not `/admin`, and honors Do Not Track.

Storage is limited to two new tables:

- `visitor_analytics_daily`: one row per day/environment scope, aggregate counts and categorical JSON counters, duration sum/sample count, CAS revision.
- `visitor_analytics_presence`: random in-memory UUID, last activity and one transient boolean to deduplicate duration samples. It is not tied to any account or persistent browser/device identifier.

No IP, email/name, raw User-Agent, full referrer/URL, GPS, fingerprint or per-visit ledger is written by analytics. The existing registration anti-abuse code is unchanged and is not used for analytics. Device classification uses the request User-Agent transiently, retaining only Android/iPhone/Computer. iPhone includes iPad/iPod. Geo uses only hosting-provided `context.geo`/`event.geo`; an absent value is Unknown. Client-supplied geo headers/body are ignored. Sources are reduced to the eight allowlisted categories in the browser. No external analytics/geolocation provider or unique visitor sketch is added.

## Metric definitions

- A visit is entry/reload of a public tab. SPA navigation is not a new visit. Separate tabs/reloads can count multiple times; visits are **not unique people**.
- Active now means a temporary tab session with actual activity strictly newer than five minutes ago. Heartbeats run only for visible, recently active tabs and never substitute current time for old activity. The exact five-minute boundary is expired. A resumed interaction can become present again without adding a visit.
- Successful registrations count only after `auth.admin.createUser` succeeds with a user ID. Invalid, failed, duplicate or merely submitted forms do not count. Analytics failure never blocks a successful signup. Existing/imported accounts are not backfilled.
- Country/city/device/source percentage = category visits / selected-period visits × 100. Registration ratio = successful registrations / visits × 100; it is aggregate, not a matched-user funnel.
- Average observed duration = received foreground seconds / received completed duration samples. Hidden time is excluded. Close/beacon failure and expired inactive presence can omit a sample; this is **not all-session average engagement**. Samples are recorded on their completion day.
- Today/last 7/last 30 mean inclusive UTC+3 calendar days, not rolling hour windows. Riyadh and Aden share UTC+3. Online count always means the current five-minute window.

## Security and deployment

RLS is enabled and all table privileges are revoked from PUBLIC/anon/authenticated. Access is server-side through the service role. The read API verifies the actual Supabase bearer session and existing admin role/email resolver; local/demo impersonation tokens are rejected. If real server database configuration is missing, analytics fails closed instead of using the application's dummy database/admin fallback. Responses never contain presence IDs or raw database failures. Public collection cannot submit a registration event.

Netlify's existing API dispatcher adds the two routes and passes native geo metadata. No Netlify settings, `netlify.toml`, payment gateway or existing schema/data change is required. The build embeds only the non-secret deployment scope to protect internal deployment-permalink visits as well as the PR alias. Preview counts are separated from Production by server-derived scope (`preview:PR`, production). The database is shared, but aggregate rows do not mix.

Both migrations are additive and were applied with owner approval: the first creates only the two analytics tables; the second enables pg_cron and schedules analytics-only cleanup. No application SQL function or unrelated scheduled job is added.

## Automatic retention and approved scheduler

The owner approved enabling `pg_cron` explicitly. The additive second migration enables the extension and schedules one named job (`visitor-analytics-retention`) every five minutes, deleting ONLY expired rows in the two analytics tables. Aggregate retention uses UTC+3 calendar day minus 29 (inclusive 30-day window); presence expires at last activity <= now minus five minutes. No unrelated cron job or application table is modified. Standard cron scheduling metadata is managed by the extension, not visitor telemetry.

Event/admin-read cleanup remains as a fallback and queries independently exclude expired data. With no traffic, the scheduled cleanup still runs; physical deletion can lag the expiry by up to one schedule interval. Presence is excluded from active counts at exactly five minutes regardless of deletion timing.

## Manual deletion

The admin page offers today, last 7 days, last 30 days, or all visitor analytics. Every operation requires a confirmation dialog. All additionally requires typing `حذف الكل`, checked again by the API. Cancel/Escape performs no deletion; controls are locked while deletion is in progress. A success message and immediate fresh read follow successful deletion.

`DELETE /api/visitor-analytics` verifies the actual Supabase bearer session and existing admin authorization before any deletion. It accepts only the four allowlisted periods and required confirmation, rejects cross-origin requests and ignores client scope/table/date overrides. It deletes only `visitor_analytics_daily` and `visitor_analytics_presence` in the server-derived current environment. **All means all history in that environment; preview cannot delete Production.** Daily rows are filtered by day; presence by last activity in the corresponding UTC+3 calendar range. New activity can appear again after a reset. Both REST deletes must succeed before reporting success; a partial failure is disclosed and the UI refreshes for retry, rather than falsely reporting success. These operations are not a cross-table SQL transaction.

No direct Supabase delete is issued by the browser. Auth/admin verification may read the existing role directory, but no other application table is written or deleted.

## Reliability limitations

Optimistic revision checks prevent lost concurrent aggregate updates, and random-session insertion/duration claims deduplicate normal retries. Presence and aggregate changes are separate requests, not one SQL transaction; a server crash between them can lose a count/sample. These are lightweight operational estimates, not billing/audit records. Public collection remains potentially forgeable by bots; same-origin and payload validation are not a complete abuse-prevention system. Adding persistent identifiers/IP rate limiting is outside this privacy-approved scope.

## Verification

`npm test` exercises UTC+3 day/retention boundaries, source/device/geo classification, ignored forged geo, scopes, concurrent counts/deduplication, the exact five-minute cutoff and idle heartbeat, duration samples, percentages, registration success/failure, admin denial, API payload/origin checks, retention and preservation of existing tables, all manual deletion periods/confirmations, scope isolation, ordinary-member deletion denial and authorized-admin deletion. Auth/account tests are isolated in-memory fixtures: no real accounts are created.

`npm run build` and `npm run lint` are required. Browser preview tests must distinguish real anonymous API writes/Supabase verification from any mocked admin-session UI tests. A real administrator session is needed for a complete live authenticated admin read; do not claim fixture auth is a real login.
