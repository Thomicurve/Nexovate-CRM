BEGIN;
INSERT INTO public.crm_members VALUES (1,'11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT public.create_client(gen_random_uuid(),'{"name":"History","contact_at":"2026-10-01T12:00:00Z"}') AS original \gset
SELECT public.dashboard_metrics('2026-10-01','2026-10-31','day') AS before_delete \gset
SELECT test_support.assert_error(format('SELECT public.delete_client(gen_random_uuid(),%L,2)', :'original'::jsonb->>'id'), 'PT409','stale delete rolls back');
SELECT public.delete_client('70000000-0000-4000-8000-000000000001',(:'original'::jsonb->>'id')::uuid,1) AS receipt \gset
SELECT test_support.assert_true(public.delete_client('70000000-0000-4000-8000-000000000001',(:'original'::jsonb->>'id')::uuid,1)=:'receipt'::jsonb,'same delete replays receipt');
SELECT test_support.assert_true((SELECT deleted_at IS NOT NULL AND version=2 FROM public.clients),'logical marker retained');
SELECT test_support.assert_error(format('SELECT public.update_client(gen_random_uuid(),%L,2,''{"name":"Changed"}'')', :'original'::jsonb->>'id'),'P0002','update deleted rejected');
SELECT test_support.assert_error(format('SELECT public.change_client_status(gen_random_uuid(),%L,2,''Cerrado'')', :'original'::jsonb->>'id'),'P0002','move deleted rejected');
SELECT test_support.assert_error(format('SELECT public.delete_client(gen_random_uuid(),%L,2)', :'original'::jsonb->>'id'),'P0002','new delete rejected');
SELECT test_support.assert_error(format('SELECT public.delete_client(''70000000-0000-4000-8000-000000000001'',%L,2)', :'original'::jsonb->>'id'),'22023','changed intent rejected');
SELECT test_support.assert_true((SELECT count(*)=1 FROM public.client_milestones),'milestones retained');
SELECT test_support.assert_true((SELECT count(*)=1 FROM public.client_transitions),'history retained');
SELECT test_support.assert_true(public.dashboard_metrics('2026-10-01','2026-10-31','day')=:'before_delete'::jsonb,'all historical and range metrics unchanged');
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT test_support.assert_error(format('SELECT public.delete_client(gen_random_uuid(),%L,2)', :'original'::jsonb->>'id'),'42501','nonmember denied');
RESET ROLE;
SELECT test_support.assert_true((SELECT count(*)=2 FROM crm_private.client_requests),'failed attempts roll back reservations');
CREATE FUNCTION test_support.fail_delete_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.envelope->>'operation'='delete' AND NEW.request_id='70000000-0000-4000-8000-000000000003' THEN
    RAISE EXCEPTION 'synthetic_receipt_failure' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER fail_delete_receipt BEFORE UPDATE ON crm_private.client_requests FOR EACH ROW EXECUTE FUNCTION test_support.fail_delete_receipt();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT public.create_client(gen_random_uuid(),'{"name":"Rollback"}') AS rollback_client \gset
SELECT test_support.assert_error(format('SELECT public.delete_client(''70000000-0000-4000-8000-000000000003'',%L,1)', :'rollback_client'::jsonb->>'id'),'23514','receipt failure rolls back logical delete');
SELECT test_support.assert_true((SELECT deleted_at IS NULL AND version=1 FROM public.clients WHERE id=(:'rollback_client'::jsonb->>'id')::uuid),'client marker and version roll back');
RESET ROLE;
SELECT test_support.assert_true(NOT EXISTS(SELECT 1 FROM crm_private.client_requests WHERE request_id='70000000-0000-4000-8000-000000000003'),'failed receipt leaves no reservation');
SELECT test_support.assert_true(NOT has_function_privilege('anon','public.delete_client(uuid,uuid,bigint)','EXECUTE'),'anonymous cannot execute delete');
ROLLBACK;
