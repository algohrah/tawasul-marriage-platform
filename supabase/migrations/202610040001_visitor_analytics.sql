-- Additive analytics-only schema. No existing table, row or extension is changed.
CREATE TABLE public.visitor_analytics_daily (
  scope text NOT NULL CHECK (length(scope) BETWEEN 1 AND 64),
  day date NOT NULL,
  visits bigint NOT NULL DEFAULT 0 CHECK (visits >= 0),
  registrations bigint NOT NULL DEFAULT 0 CHECK (registrations >= 0),
  country_counts jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(country_counts) = 'object'),
  city_counts jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(city_counts) = 'object'),
  device_counts jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(device_counts) = 'object'),
  source_counts jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_counts) = 'object'),
  duration_seconds_sum bigint NOT NULL DEFAULT 0 CHECK (duration_seconds_sum >= 0),
  duration_samples bigint NOT NULL DEFAULT 0 CHECK (duration_samples >= 0),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, day)
);
CREATE TABLE public.visitor_analytics_presence (
  scope text NOT NULL CHECK (length(scope) BETWEEN 1 AND 64),
  session_id uuid NOT NULL,
  last_activity timestamptz NOT NULL,
  duration_reported boolean NOT NULL DEFAULT false,
  PRIMARY KEY (scope, session_id)
);
CREATE INDEX visitor_analytics_presence_activity_idx ON public.visitor_analytics_presence (last_activity);
ALTER TABLE public.visitor_analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_analytics_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visitor_analytics_daily, public.visitor_analytics_presence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visitor_analytics_daily, public.visitor_analytics_presence TO service_role;
COMMENT ON TABLE public.visitor_analytics_daily IS 'Daily aggregate visitor metrics only, UTC+3; scoped production/preview, retained 30 calendar days. No unique visitor identifiers or raw request metadata.';
COMMENT ON TABLE public.visitor_analytics_presence IS 'Temporary random browsing-session presence only. Last activity within 5 minutes; no member/device/IP identifiers.';
