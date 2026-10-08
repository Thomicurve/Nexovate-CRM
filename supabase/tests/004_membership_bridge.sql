BEGIN;
INSERT INTO public.crm_members(slot, user_id) VALUES
  (1, '11111111-1111-4111-8111-111111111111'),
  (2, '22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT test_support.assert_true(public.current_user_is_crm_member(), 'first member uses public readonly bridge');
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT test_support.assert_true(public.current_user_is_crm_member(), 'second member uses bridge');
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
SELECT test_support.assert_true(NOT public.current_user_is_crm_member(), 'third user denied');
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT test_support.assert_true(NOT public.current_user_is_crm_member(), 'missing identity denied');
SELECT test_support.assert_error('SELECT * FROM public.crm_members', '42501', 'bridge does not expose members');
RESET ROLE;
SELECT test_support.assert_true((SELECT NOT prosecdef AND proconfig = ARRAY['search_path=""']
  FROM pg_proc WHERE oid = 'public.current_user_is_crm_member()'::regprocedure), 'invoker and fixed empty search path');
SELECT test_support.assert_true(NOT has_function_privilege('anon', 'public.current_user_is_crm_member()', 'EXECUTE'), 'anon has no execute');
SELECT test_support.assert_true(NOT EXISTS (SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) a
  WHERE p.oid = 'public.current_user_is_crm_member()'::regprocedure AND a.grantee = 0), 'PUBLIC has no execute');
SET LOCAL ROLE anon;
SELECT test_support.assert_error('SELECT public.current_user_is_crm_member()', '42501', 'anonymous execution denied');
ROLLBACK;
