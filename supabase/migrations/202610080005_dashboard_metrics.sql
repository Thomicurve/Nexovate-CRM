BEGIN;
-- Readonly aggregation avoids REST pagination and shares the calling statement snapshot.
CREATE FUNCTION public.dashboard_metrics(p_from date, p_until date, p_grouping text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  first_bucket timestamp;
  last_bucket timestamp;
  period_count integer;
  start_at timestamptz;
  end_at timestamptz;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT crm_private.is_crm_member() THEN
    RAISE EXCEPTION 'crm_access_denied' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_until IS NULL OR p_grouping IS NULL OR p_from > p_until OR
    p_from < DATE '1900-01-01' OR p_until > DATE '9999-12-31' OR
    p_grouping NOT IN ('day','month','year') THEN
    RAISE EXCEPTION 'invalid_metrics_range' USING ERRCODE = '22023';
  END IF;
  first_bucket := date_trunc(p_grouping, p_from::timestamp);
  last_bucket := date_trunc(p_grouping, p_until::timestamp);
  period_count := CASE p_grouping
    WHEN 'day' THEN p_until - p_from + 1
    WHEN 'month' THEN (extract(year FROM p_until)::int - extract(year FROM p_from)::int) * 12
      + extract(month FROM p_until)::int - extract(month FROM p_from)::int + 1
    ELSE extract(year FROM p_until)::int - extract(year FROM p_from)::int + 1 END;
  start_at := p_from::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires';
  end_at := (p_until + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires';

  WITH states(status, ordinal) AS (
    VALUES ('Contactado'::public.client_status,1), ('Reunión agendada'::public.client_status,2), ('Cerrado'::public.client_status,3)
  ), milestones AS MATERIALIZED (
    SELECT status, reached_at FROM public.client_milestones
  ), totals AS (
    SELECT s.status, s.ordinal, count(m.status) AS historical_total,
      count(m.status) FILTER (WHERE m.reached_at >= start_at AND m.reached_at < end_at) AS range_total
    FROM states s LEFT JOIN milestones m USING(status) GROUP BY s.status, s.ordinal
  ), periods AS (
    -- Check cardinality before generating any periods; oversized requests keep all totals.
    SELECT generate_series(first_bucket, last_bucket, ('1 ' || p_grouping)::interval) AS start
    WHERE period_count <= 2000
  ), activity AS (
    SELECT status, date_trunc(p_grouping, reached_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS start, count(*) AS total
    FROM milestones WHERE reached_at >= start_at AND reached_at < end_at GROUP BY status, start
  ), series AS (
    SELECT s.status, jsonb_agg(jsonb_build_object('start', to_char(p.start,'YYYY-MM-DD'), 'count', coalesce(a.total,0)) ORDER BY p.start) AS buckets
    FROM states s CROSS JOIN periods p LEFT JOIN activity a ON a.status = s.status AND a.start = p.start GROUP BY s.status
  ) SELECT jsonb_build_object('kind', CASE WHEN period_count > 2000 THEN 'too_many_buckets' ELSE 'ready' END,
    'from', to_char(p_from,'YYYY-MM-DD'), 'until', to_char(p_until,'YYYY-MM-DD'), 'grouping', p_grouping,
    'metrics', jsonb_agg(jsonb_build_object('status', t.status, 'historicalTotal', t.historical_total, 'rangeTotal', t.range_total) ||
      CASE WHEN period_count > 2000 THEN '{}'::jsonb ELSE jsonb_build_object('buckets', s.buckets) END ORDER BY t.ordinal)) ||
      CASE WHEN period_count > 2000 THEN jsonb_build_object('bucketCount', period_count) ELSE '{}'::jsonb END
    INTO result FROM totals t LEFT JOIN series s USING(status);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.dashboard_metrics(date,date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics(date,date,text) TO authenticated;
COMMIT;
