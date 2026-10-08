BEGIN;
INSERT INTO public.crm_members VALUES
  (1, '11111111-1111-4111-8111-111111111111'),
  (2, '22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT public.dashboard_metrics('2026-10-07', '2026-10-09', 'day') AS empty_metrics \gset
SELECT test_support.assert_true(:'empty_metrics'::jsonb->>'kind' = 'ready' AND jsonb_array_length(:'empty_metrics'::jsonb->'metrics') = 3, 'empty has all three metrics');
SELECT test_support.assert_true((:'empty_metrics'::jsonb->'metrics'->0) = '{"status":"Contactado","historicalTotal":0,"rangeTotal":0,"buckets":[{"start":"2026-10-07","count":0},{"start":"2026-10-08","count":0},{"start":"2026-10-09","count":0}]}'::jsonb, 'empty days explicitly zero');
SELECT public.create_client(gen_random_uuid(), '{"name":"Historical","contact_at":"2026-01-01T02:59:59.999999Z"}') AS first \gset
SELECT public.change_client_status(gen_random_uuid(), (:'first'::jsonb->>'id')::uuid, 1, 'Reunión agendada') AS meeting \gset
SELECT public.change_client_status(gen_random_uuid(), (:'first'::jsonb->>'id')::uuid, 2, 'Sin respuesta');
SELECT public.change_client_status(gen_random_uuid(), (:'first'::jsonb->>'id')::uuid, 3, 'Reunión agendada');
SELECT public.change_client_status(gen_random_uuid(), (:'first'::jsonb->>'id')::uuid, 4, 'Cerrado');
SELECT public.change_client_status(gen_random_uuid(), (:'first'::jsonb->>'id')::uuid, 5, 'Interesado');
SELECT public.create_client(gen_random_uuid(), '{"name":"Skip","contact_at":"2026-01-01T03:00:00Z"}') AS second \gset
SELECT public.change_client_status(gen_random_uuid(), (:'second'::jsonb->>'id')::uuid, 1, 'Cerrado');
SELECT public.change_client_status(gen_random_uuid(), (:'second'::jsonb->>'id')::uuid, 2, 'Respuesta negativa');
SELECT public.change_client_status(gen_random_uuid(), (:'second'::jsonb->>'id')::uuid, 3, 'Cerrado');
SELECT public.dashboard_metrics('1900-01-01', '9999-12-31', 'year') AS oversized \gset
SELECT test_support.assert_true(:'oversized'::jsonb->>'kind' = 'too_many_buckets' AND (:'oversized'::jsonb->'metrics'->0->>'historicalTotal')::int = 2 AND (:'oversized'::jsonb->'metrics'->1->>'rangeTotal')::int = 1 AND (:'oversized'::jsonb->'metrics'->2->>'rangeTotal')::int = 2 AND NOT (:'oversized'::jsonb->'metrics'->0 ? 'buckets'), 'excessive series retains exact historical/range totals without truncation');
SELECT public.dashboard_metrics('2025-12-31', '2026-01-02', 'day') AS days \gset
SELECT test_support.assert_true((:'days'::jsonb->'metrics'->0->'buckets') = '[{"start":"2025-12-31","count":1},{"start":"2026-01-01","count":1},{"start":"2026-01-02","count":0}]'::jsonb, 'local year edge and microseconds preserved');
SELECT test_support.assert_true((:'days'::jsonb->'metrics'->1->>'historicalTotal')::int = 1 AND (:'days'::jsonb->'metrics'->2->>'historicalTotal')::int = 2, 'departure and return retain first counts, direct skip invents no meeting');
SELECT public.update_client(gen_random_uuid(), (:'first'::jsonb->>'id')::uuid, 6, '{"contact_at":"2026-01-02T03:00:00Z","meeting_at":"2099-12-01T12:00:00Z"}');
SELECT public.dashboard_metrics('2025-12-31', '2026-01-02', 'day') AS corrected \gset
SELECT test_support.assert_true((:'corrected'::jsonb->'metrics'->0->'buckets') = '[{"start":"2025-12-31","count":0},{"start":"2026-01-01","count":1},{"start":"2026-01-02","count":1}]'::jsonb, 'correction moves only contact period');
SELECT test_support.assert_true(:'corrected'::jsonb->'metrics'->1 = :'days'::jsonb->'metrics'->1 AND :'corrected'::jsonb->'metrics'->2 = :'days'::jsonb->'metrics'->2, 'appointment and contact edits do not move other first milestones');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.client_contact_corrections), 'correction audited');
SELECT test_support.assert_true((SELECT reached_at = (:'meeting'::jsonb->>'updated_at')::timestamptz FROM public.client_milestones WHERE client_id = (:'first'::jsonb->>'id')::uuid AND status = 'Reunión agendada'), 'first meeting server instant retained');
RESET ROLE;
-- Administrative fixtures only in this new local cluster: exact edges and >1000 rows.
WITH fixtures AS (
  INSERT INTO public.clients(name, contact_at)
  SELECT 'Bulk ' || n, '2026-02-01T03:00:00Z'::timestamptz FROM generate_series(1,1005) n RETURNING id, contact_at
) INSERT INTO public.client_milestones SELECT id, 'Contactado', contact_at FROM fixtures;
WITH fixtures AS (
  INSERT INTO public.clients(name, contact_at) VALUES
    ('Before range', '2025-12-31T02:59:59.999999Z'), ('After range', '2026-01-03T03:00:00Z'),
    ('Leap day', '2024-02-29T03:00:00Z'), ('Historical DST', '2008-10-19T03:00:00Z'),
    ('Upper edge', '9999-12-31T03:00:00Z') RETURNING id, contact_at
) INSERT INTO public.client_milestones SELECT id, 'Contactado', contact_at FROM fixtures;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SET LOCAL TIME ZONE 'Asia/Tokyo';
SELECT public.dashboard_metrics('2026-01-01', '2026-02-01', 'month') AS months \gset
SELECT test_support.assert_true((:'months'::jsonb->'metrics'->0->'buckets') = '[{"start":"2026-01-01","count":3},{"start":"2026-02-01","count":1005}]'::jsonb, 'calendar months with partial edges, complete aggregation over 1000');
SELECT test_support.assert_true((:'months'::jsonb->'metrics'->0->>'historicalTotal')::int = 1012 AND (:'months'::jsonb->'metrics'->0->>'rangeTotal')::int = 1008, 'historical total independent of partial range and REST pagination');
SELECT public.dashboard_metrics('2025-12-31', '2026-01-02', 'year') AS years \gset
SELECT test_support.assert_true((:'years'::jsonb->'metrics'->0->'buckets') = '[{"start":"2025-01-01","count":0},{"start":"2026-01-01","count":2}]'::jsonb, 'calendar years clip both edges and zero-fill');
SELECT test_support.assert_true(jsonb_array_length(public.dashboard_metrics('2026-01-01','2026-01-31','day')->'metrics'->0->'buckets') = 31 AND jsonb_array_length(public.dashboard_metrics('2026-04-01','2026-04-30','day')->'metrics'->0->'buckets') = 30, '31 and 30 calendar days');
SELECT test_support.assert_true(jsonb_array_length(public.dashboard_metrics('2024-02-01','2024-02-29','day')->'metrics'->0->'buckets') = 29 AND jsonb_array_length(public.dashboard_metrics('2026-02-01','2026-02-28','day')->'metrics'->0->'buckets') = 28, 'leap and common February');
SELECT public.dashboard_metrics('2024-02-28', '2024-03-01', 'day') AS leap \gset
SELECT test_support.assert_true(jsonb_array_length(:'leap'::jsonb->'metrics'->0->'buckets') = 3 AND (:'leap'::jsonb->'metrics'->0->'buckets'->1->>'count')::int = 1, 'leap day appears');
SELECT test_support.assert_true((public.dashboard_metrics('2008-10-19','2008-10-19','day')->'metrics'->0->>'rangeTotal')::int = 1, 'historical skipped midnight included');
SELECT test_support.assert_true((public.dashboard_metrics('9999-12-31','9999-12-31','day')->'metrics'->0->>'rangeTotal')::int = 1, 'upper year last day supported');
SELECT test_support.assert_true(public.dashboard_metrics('2026-01-01','2031-06-23','day')->>'kind' = 'ready', '2000 buckets accepted');
SELECT test_support.assert_true(public.dashboard_metrics('2026-01-01','2031-06-24','day')->>'kind' = 'too_many_buckets' AND (public.dashboard_metrics('2026-01-01','2031-06-24','day')->>'bucketCount')::int = 2001, '2001 buckets declared');
SELECT test_support.assert_error($q$SELECT public.dashboard_metrics(NULL,'2026-01-01','day')$q$, '22023', 'null range rejected');
SELECT test_support.assert_error($q$SELECT public.dashboard_metrics('2026-01-02','2026-01-01','day')$q$, '22023', 'reversed range rejected');
SELECT test_support.assert_error($q$SELECT public.dashboard_metrics('1899-12-31','2026-01-01','day')$q$, '22023', 'unsupported year rejected');
SELECT test_support.assert_error($q$SELECT public.dashboard_metrics('2026-01-01','2026-01-01','week')$q$, '22023', 'unknown grouping rejected');
SELECT test_support.assert_error($q$SELECT public.dashboard_metrics('2026-01-01','2026-01-01',NULL)$q$, '22023', 'null grouping rejected');
SELECT test_support.assert_true((SELECT NOT prosecdef AND provolatile = 's' AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'public.dashboard_metrics(date,date,text)'::regprocedure), 'readonly invoker with fixed snapshot and search path');
SELECT test_support.assert_true(NOT has_function_privilege('anon','public.dashboard_metrics(date,date,text)','EXECUTE'), 'anon execute explicitly revoked');
RESET ROLE;
WITH fixtures AS (
  INSERT INTO public.clients(name, contact_at) VALUES
    ('Before skipped midnight', '2008-10-19T02:59:59.999999Z'),
    ('First repeated hour', '2009-03-15T01:59:59.999999Z'),
    ('Second repeated hour', '2009-03-15T02:00:00Z'),
    ('After repeated day', '2009-03-15T03:00:00Z') RETURNING id, contact_at
) INSERT INTO public.client_milestones SELECT id, 'Contactado', contact_at FROM fixtures;
SELECT count(*) AS clients_before FROM public.clients \gset
SELECT count(*) AS milestones_before FROM public.client_milestones \gset
SET LOCAL ROLE authenticated;
SELECT test_support.assert_true((public.dashboard_metrics('2008-10-19','2008-10-19','day')->'metrics'->0->>'rangeTotal')::int = 1, 'spring gap first instant included, prior microsecond excluded');
SELECT test_support.assert_true((public.dashboard_metrics('2009-03-14','2009-03-14','day')->'metrics'->0->>'rangeTotal')::int = 2 AND (public.dashboard_metrics('2009-03-15','2009-03-15','day')->'metrics'->0->>'rangeTotal')::int = 1, '25-hour historical day counts repeated hour once per milestone, next day exclusive');
SELECT test_support.assert_true((SELECT count(*) = :clients_before FROM public.clients) AND (SELECT count(*) = :milestones_before FROM public.client_milestones), 'aggregation preserves data');
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
SELECT test_support.assert_error($q$SELECT public.dashboard_metrics('2026-01-01','2026-01-01','day')$q$, '42501', 'third identity denied rather than false zeros');
SELECT test_support.assert_error($q$SELECT public.dashboard_metrics(NULL,NULL,NULL)$q$, '42501', 'membership checked before params');
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT test_support.assert_error($q$SELECT public.dashboard_metrics('2026-01-01','2026-01-01','day')$q$, '42501', 'missing identity denied');
SET LOCAL ROLE anon;
SELECT test_support.assert_error($q$SELECT public.dashboard_metrics('2026-01-01','2026-01-01','day')$q$, '42501', 'anonymous execute denied');
RESET ROLE;
ROLLBACK;
