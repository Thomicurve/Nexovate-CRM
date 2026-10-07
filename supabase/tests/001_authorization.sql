BEGIN;
SELECT test_support.assert_true(
  (SELECT count(*) = 4 AND bool_and(relrowsecurity) FROM pg_class
   WHERE oid IN ('public.crm_members'::regclass, 'public.clients'::regclass,
                 'public.client_transitions'::regclass, 'public.client_milestones'::regclass)),
  'all application tables enable RLS');
INSERT INTO public.crm_members(slot, user_id) VALUES
  (1, '11111111-1111-4111-8111-111111111111'),
  (2, '22222222-2222-4222-8222-222222222222');
SELECT test_support.assert_error(
  $q$INSERT INTO public.crm_members VALUES (3, '33333333-3333-4333-8333-333333333333')$q$,
  '23514', 'membership limited to two slots');
SELECT test_support.assert_error(
  $q$UPDATE public.crm_members SET user_id = '11111111-1111-4111-8111-111111111111' WHERE slot = 2$q$,
  '23505', 'distinct member identities');
INSERT INTO public.clients(id, name, company, rubro, email, phone, notes, contact_at, meeting_at)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sintético', 'Empresa ficticia', 'Software',
        '', NULL, 'Fixture', '2026-10-07T12:00:00Z', NULL);
INSERT INTO public.client_transitions(client_id, to_status, actor_id)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Contactado', '11111111-1111-4111-8111-111111111111');
INSERT INTO public.client_milestones(client_id, status, reached_at)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Contactado', '2026-10-07T12:00:00Z');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT test_support.assert_true(current_user = 'authenticated' AND
  NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) AND
  (SELECT relowner <> (SELECT oid FROM pg_roles WHERE rolname = current_user)
   FROM pg_class WHERE oid = 'public.clients'::regclass), 'test role is not owner/superuser/bypassrls');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.clients), 'first member reads shared clients');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.client_transitions), 'first member reads history');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.client_milestones), 'first member reads milestones');
SELECT test_support.assert_error('INSERT INTO public.clients(name) VALUES (''Directo'')', '42501', 'direct client insert denied');
SELECT test_support.assert_error('UPDATE public.clients SET name = ''Directo''', '42501', 'direct client update denied');
SELECT test_support.assert_error('DELETE FROM public.clients', '42501', 'client delete denied');
SELECT test_support.assert_error('TRUNCATE public.clients', '42501', 'truncate cannot bypass RLS');
SELECT test_support.assert_error('INSERT INTO public.crm_members VALUES (1, auth.uid())', '42501', 'no self-assigned membership');
SELECT test_support.assert_error('UPDATE public.crm_members SET user_id = auth.uid()', '42501', 'no membership replacement');
SELECT test_support.assert_error('DELETE FROM public.crm_members', '42501', 'no membership removal');
SELECT test_support.assert_error('SELECT * FROM public.crm_members', '42501', 'membership data private');
SELECT test_support.assert_error('INSERT INTO public.client_transitions(client_id, to_status, actor_id) VALUES (gen_random_uuid(), ''Cerrado'', auth.uid())', '42501', 'history insert denied');
SELECT test_support.assert_error('UPDATE public.client_transitions SET to_status = ''Cerrado''', '42501', 'history update denied');
SELECT test_support.assert_error('DELETE FROM public.client_transitions', '42501', 'history delete denied');
SELECT test_support.assert_error('INSERT INTO public.client_milestones(client_id, status, reached_at) VALUES (gen_random_uuid(), ''Cerrado'', now())', '42501', 'milestone insert denied');
SELECT test_support.assert_error('UPDATE public.client_milestones SET reached_at = now()', '42501', 'milestone update denied');
SELECT test_support.assert_error('DELETE FROM public.client_milestones', '42501', 'milestone delete denied');
SELECT test_support.assert_error('ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY', '42501', 'member cannot disable RLS');
SELECT test_support.assert_true(NOT has_schema_privilege(current_user, 'crm_private', 'CREATE'), 'private schema is not caller-writable');
SELECT test_support.assert_true(NOT has_function_privilege('anon', 'crm_private.is_crm_member()', 'EXECUTE'), 'helper is not executable by anon');

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.clients), 'second member shares the same client');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.client_transitions), 'second member shares history');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.client_milestones), 'second member shares milestones');
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
SELECT test_support.assert_true((SELECT count(*) = 0 FROM public.clients), 'third authenticated user denied clients');
SELECT test_support.assert_true((SELECT count(*) = 0 FROM public.client_transitions), 'third user denied history');
SELECT test_support.assert_true((SELECT count(*) = 0 FROM public.client_milestones), 'third user denied milestones');
SELECT test_support.assert_error('INSERT INTO public.crm_members VALUES (2, auth.uid())', '42501', 'third user cannot join');
SELECT test_support.assert_error('INSERT INTO public.clients(name) VALUES (''Tercero'')', '42501', 'third user cannot write');
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222"}', true);
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.clients), 'JSON JWT subject fallback shares clients');
SELECT set_config('request.jwt.claims', '', true);
SELECT test_support.assert_true((SELECT count(*) = 0 FROM public.clients), 'missing identity denied');
SET LOCAL ROLE anon;
SELECT test_support.assert_error('SELECT * FROM public.clients', '42501', 'anonymous clients denied by grants');
SELECT test_support.assert_error('SELECT * FROM public.client_transitions', '42501', 'anonymous history denied');
SELECT test_support.assert_error('SELECT * FROM public.client_milestones', '42501', 'anonymous milestones denied');
SELECT test_support.assert_error('INSERT INTO public.clients(name) VALUES (''Anónimo'')', '42501', 'anonymous write denied');
SELECT test_support.assert_error('SELECT crm_private.is_crm_member()', '42501', 'anonymous cannot execute helper');
RESET ROLE;
SELECT 'WU003 authorization assertions passed';
ROLLBACK;
