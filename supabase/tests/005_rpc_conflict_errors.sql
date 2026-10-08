BEGIN;
INSERT INTO public.crm_members VALUES
  (1,'11111111-1111-4111-8111-111111111111'),
  (2,'22222222-2222-4222-8222-222222222222');
-- An incomplete committed reservation is synthetic and exists only in this disposable test transaction.
INSERT INTO crm_private.client_requests(actor_id,request_id,envelope) VALUES
  ('11111111-1111-4111-8111-111111111111','50000000-0000-4000-8000-000000000001',
   jsonb_build_object('operation','create','client_id',NULL,'expected_version',NULL,'payload','{"name":"Incomplete"}'::jsonb));
CREATE FUNCTION test_support.assert_rpc_error(statement text, expected_message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'PT409' AND SQLERRM = expected_message THEN RETURN; END IF;
    RAISE EXCEPTION 'FAIL: wrong RPC error contract (%, %)', SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL: RPC error was accepted';
END;
$$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT test_support.assert_rpc_error(
  $q$SELECT public.create_client('50000000-0000-4000-8000-000000000001','{"name":"Incomplete"}')$q$,
  'incomplete_request');
SELECT test_support.assert_true((SELECT count(*)=0 FROM public.clients),'incomplete request creates no client');
SELECT public.create_client('50000000-0000-4000-8000-000000000002','{"name":"Version"}') AS original \gset
SELECT public.update_client('50000000-0000-4000-8000-000000000003',(:'original'::jsonb->>'id')::uuid,1,'{"name":"Confirmed"}') AS updated \gset
SELECT test_support.assert_rpc_error(format(
  'SELECT public.update_client(''50000000-0000-4000-8000-000000000004'',%L,1,''{"name":"Stale"}'')',
  :'original'::jsonb->>'id'),'client_version_conflict');
SELECT test_support.assert_true((SELECT version=2 AND name='Confirmed' FROM public.clients),
  'business conflict rolls back overwrite');
SELECT test_support.assert_true(public.update_client('50000000-0000-4000-8000-000000000003',
  (:'original'::jsonb->>'id')::uuid,1,'{"name":"Confirmed"}')=:'updated'::jsonb,
  'completed request still replays after error contract change');
RESET ROLE;
SELECT test_support.assert_true((SELECT count(*)=3 FROM crm_private.client_requests),
  'failed conflict leaves no new request');
SELECT test_support.assert_true((SELECT response IS NULL FROM crm_private.client_requests
  WHERE request_id='50000000-0000-4000-8000-000000000001'),'incomplete reservation unchanged');
SELECT test_support.assert_true((SELECT NOT prosecdef AND proconfig @> ARRAY['search_path=""']
  FROM pg_proc WHERE oid='crm_private.mutate_client(text,uuid,uuid,bigint,jsonb)'::regprocedure),
  'worker remains invoker with fixed empty search path');
SELECT test_support.assert_true(NOT has_function_privilege('authenticated',
  'crm_private.mutate_client(text,uuid,uuid,bigint,jsonb)','EXECUTE') AND NOT has_function_privilege('anon',
  'crm_private.mutate_client(text,uuid,uuid,bigint,jsonb)','EXECUTE'),'worker remains inaccessible to callers');
ROLLBACK;
