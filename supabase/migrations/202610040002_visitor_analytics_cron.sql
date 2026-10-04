-- Approved explicitly by the owner: analytics retention every five minutes.
-- Only the two analytics tables are targets. No existing application data,
-- unrelated scheduled job or application table schema is modified.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule(
  'visitor-analytics-retention',
  '*/5 * * * *',
  $cleanup$
    DELETE FROM public.visitor_analytics_daily
      WHERE day < ((now() AT TIME ZONE 'Asia/Riyadh')::date - 29);
    DELETE FROM public.visitor_analytics_presence
      WHERE last_activity <= now() - interval '5 minutes';
  $cleanup$
);
