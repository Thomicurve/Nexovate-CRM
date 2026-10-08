BEGIN;
INSERT INTO public.crm_members VALUES
  (1, '11111111-1111-4111-8111-111111111111'),
  (2, '22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT public.create_client('00000000-0000-4000-8000-000000000001', '{"name":"Primero","rubro":"Software","contact_at":"2026-10-01T12:00:00Z"}') AS first \gset
SELECT test_support.assert_true(:'first'::jsonb->>'status' = 'Contactado', 'creation always Contactado');
SELECT test_support.assert_true((:'first'::jsonb->>'version')::bigint = 1, 'initial version');
SELECT test_support.assert_true(
  public.create_client('00000000-0000-4000-8000-000000000001', '{"contact_at":"2026-10-01T12:00:00Z","rubro":"Software","name":"Primero"}') = :'first'::jsonb,
  'create replay canonical JSON returns original response');
SELECT test_support.assert_error($q$SELECT public.create_client('00000000-0000-4000-8000-000000000001','{"name":"Changed"}')$q$, '22023', 'changed request payload rejected');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.clients), 'replay does not duplicate client');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.client_transitions), 'one initial event');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.client_milestones), 'one initial milestone');
SELECT test_support.assert_true((SELECT reached_at = '2026-10-01T12:00:00Z' FROM public.client_milestones), 'contact milestone follows contact_at');
SELECT test_support.assert_true((SELECT actor_id = auth.uid() AND from_status IS NULL FROM public.client_transitions), 'initial actor from session');
SELECT test_support.assert_error($q$SELECT public.create_client(gen_random_uuid(),'{"name":"Spoof","actor_id":"22222222-2222-4222-8222-222222222222"}')$q$, '22023', 'actor input rejected');
SELECT test_support.assert_error($q$SELECT public.create_client(gen_random_uuid(),'{"name":"Spoof","status":"Cerrado"}')$q$, '22023', 'caller cannot choose initial state');
SELECT test_support.assert_error($q$SELECT public.create_client(gen_random_uuid(),'{"name":{"unexpected":true}}')$q$, '22023', 'non-string fields rejected');
SELECT test_support.assert_error($q$SELECT public.create_client(gen_random_uuid(),'{"name":" "}')$q$, '23514', 'invalid name rejected through RPC');

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT public.change_client_status('00000000-0000-4000-8000-000000000002', (:'first'::jsonb->>'id')::uuid, 1, 'Reunión agendada') AS meeting \gset
SELECT test_support.assert_true((:'meeting'::jsonb->>'version')::bigint = 2, 'second member writes shared client');
SELECT test_support.assert_true((SELECT actor_id = auth.uid() FROM public.client_transitions WHERE to_status = 'Reunión agendada'), 'transition actor is second member');
SELECT test_support.assert_true((SELECT m.reached_at = t.occurred_at FROM public.client_milestones m JOIN public.client_transitions t USING(client_id) WHERE m.status = 'Reunión agendada' AND t.to_status = m.status), 'meeting milestone uses server event time');
SELECT public.update_client('00000000-0000-4000-8000-000000000003', (:'first'::jsonb->>'id')::uuid, 2, '{"name":"Editado","company":"Ejemplo","email":"x@example.test","phone":"123","notes":"nota","contact_at":"2026-09-30T12:00:00Z","meeting_at":"2026-12-01T15:00:00Z"}') AS edited \gset
SELECT test_support.assert_true((:'edited'::jsonb->>'version')::bigint = 3 AND :'edited'::jsonb->>'company' = 'Ejemplo', 'field edit increments version');
SELECT test_support.assert_true((SELECT reached_at = '2026-09-30T12:00:00Z' FROM public.client_milestones WHERE status = 'Contactado'), 'contact correction moves its milestone');
SELECT test_support.assert_true((SELECT count(*) = 2 FROM public.client_transitions), 'correction preserves transition history');
SELECT test_support.assert_true((SELECT occurred_at = (:'first'::jsonb->>'created_at')::timestamptz FROM public.client_transitions WHERE from_status IS NULL), 'correction preserves initial event timestamp');
SELECT test_support.assert_true((SELECT created_at = (:'first'::jsonb->>'created_at')::timestamptz FROM public.clients), 'correction preserves creation time');
SELECT test_support.assert_true((SELECT old_contact_at = '2026-10-01T12:00:00Z' AND new_contact_at = '2026-09-30T12:00:00Z' AND actor_id = auth.uid() AND recorded_at = (:'edited'::jsonb->>'updated_at')::timestamptz FROM public.client_contact_corrections), 'correction audit records old/new/actor/time');
SELECT test_support.assert_true((SELECT reached_at = (:'meeting'::jsonb->>'updated_at')::timestamptz FROM public.client_milestones WHERE status = 'Reunión agendada'), 'appointment edit does not move meeting milestone');
SELECT test_support.assert_true(public.update_client('00000000-0000-4000-8000-000000000003', (:'first'::jsonb->>'id')::uuid, 2, '{"name":"Editado","company":"Ejemplo","email":"x@example.test","phone":"123","notes":"nota","contact_at":"2026-09-30T12:00:00Z","meeting_at":"2026-12-01T15:00:00Z"}') = :'edited'::jsonb, 'edit replay returns original version');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.client_contact_corrections), 'edit replay does not duplicate audit');
SELECT test_support.assert_error(format('SELECT public.update_client(''00000000-0000-4000-8000-000000000003'', %L, 2, %L)', :'first'::jsonb->>'id', '{"name":"Changed"}'), '22023', 'edit changed payload rejected');
SELECT test_support.assert_error(format('SELECT public.change_client_status(''00000000-0000-4000-8000-000000000003'', %L, 2, %L)', :'first'::jsonb->>'id', 'Cerrado'), '22023', 'request cannot replay as another operation');
SELECT public.change_client_status(gen_random_uuid(), (:'first'::jsonb->>'id')::uuid, 3, 'Sin respuesta');
SELECT public.change_client_status(gen_random_uuid(), (:'first'::jsonb->>'id')::uuid, 4, 'Reunión agendada');
SELECT public.change_client_status('00000000-0000-4000-8000-000000000004', (:'first'::jsonb->>'id')::uuid, 5, 'Reunión agendada') AS same_state \gset
SELECT test_support.assert_true(public.change_client_status('00000000-0000-4000-8000-000000000004', (:'first'::jsonb->>'id')::uuid, 5, 'Reunión agendada') = :'same_state'::jsonb, 'movement replay returns original response');
SELECT test_support.assert_true((SELECT count(*) = 4 FROM public.client_transitions), 'same state and replay do not create events');
SELECT test_support.assert_true((SELECT count(*) = 2 FROM public.client_milestones), 'return does not duplicate and departure does not remove milestones');
SELECT test_support.assert_true((SELECT reached_at = (:'meeting'::jsonb->>'updated_at')::timestamptz FROM public.client_milestones WHERE status = 'Reunión agendada'), 'return retains first meeting date');
SELECT test_support.assert_error(format('SELECT public.change_client_status(''00000000-0000-4000-8000-000000000004'', %L, 5, %L)', :'first'::jsonb->>'id', 'Cerrado'), '22023', 'movement changed payload rejected');
SELECT test_support.assert_error(format('SELECT public.update_client(gen_random_uuid(), %L, 1, %L)', :'first'::jsonb->>'id', '{"name":"Obsoleto"}'), '40001', 'stale version rejected');
SELECT test_support.assert_error(format('SELECT public.update_client(gen_random_uuid(), %L, NULL, %L)', :'first'::jsonb->>'id', '{}'), '22023', 'version guard mandatory');
SELECT public.create_client('00000000-0000-4000-8000-000000000001', '{"name":"Segundo"}') AS second \gset
SELECT test_support.assert_true(:'second'::jsonb->>'id' <> :'first'::jsonb->>'id', 'request IDs scoped to actor');
SELECT test_support.assert_true((:'second'::jsonb->>'contact_at')::timestamptz = (:'second'::jsonb->>'created_at')::timestamptz, 'automatic contact time matches creation');
SELECT public.change_client_status(gen_random_uuid(), (:'second'::jsonb->>'id')::uuid, 1, 'Cerrado');
SELECT test_support.assert_true((SELECT count(*) = 2 FROM public.client_milestones WHERE client_id = (:'second'::jsonb->>'id')::uuid), 'jump to closed invents no meeting');
SELECT public.change_client_status(gen_random_uuid(), (:'second'::jsonb->>'id')::uuid, 2, 'Interesado');
SELECT public.change_client_status(gen_random_uuid(), (:'second'::jsonb->>'id')::uuid, 3, 'Cerrado');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.client_milestones WHERE client_id = (:'second'::jsonb->>'id')::uuid AND status = 'Cerrado'), 'closed milestone remains unique after return');
SELECT public.change_client_status(gen_random_uuid(), (:'second'::jsonb->>'id')::uuid, 4, 'Contactado');
SELECT test_support.assert_true((SELECT reached_at = (:'second'::jsonb->>'contact_at')::timestamptz FROM public.client_milestones WHERE client_id = (:'second'::jsonb->>'id')::uuid AND status = 'Contactado'), 'return to Contactado retains contact time');
SELECT public.change_client_status(gen_random_uuid(), (:'second'::jsonb->>'id')::uuid, 5, 'Respuesta negativa');
SELECT public.update_client(gen_random_uuid(), (:'second'::jsonb->>'id')::uuid, 6, '{"rubro":null,"email":"","meeting_at":null}') AS cleared \gset
SELECT test_support.assert_true(:'cleared'::jsonb->>'status' = 'Respuesta negativa' AND :'cleared'::jsonb->>'rubro' IS NULL AND :'cleared'::jsonb->>'email' = '' AND :'cleared'::jsonb->>'meeting_at' IS NULL, 'sixth state and optional fields clear safely');
SELECT test_support.assert_error(format('SELECT public.update_client(gen_random_uuid(), %L, 7, %L)', :'second'::jsonb->>'id', '{"email":"invalid"}'), '23514', 'invalid email rejected through update RPC');

SELECT test_support.assert_error('SELECT * FROM crm_private.client_requests', '42501', 'ledger not caller-readable');
SELECT test_support.assert_error('DELETE FROM crm_private.client_requests', '42501', 'ledger not caller-writable');
SELECT test_support.assert_error('UPDATE crm_private.client_requests SET response = ''{}''', '42501', 'ledger response cannot be forged');
SELECT test_support.assert_error('INSERT INTO crm_private.client_requests(actor_id,request_id,envelope) VALUES(auth.uid(),gen_random_uuid(),''{}'')', '42501', 'ledger reservation cannot be forged');
SELECT test_support.assert_error('TRUNCATE crm_private.client_requests', '42501', 'ledger truncate denied');
SELECT test_support.assert_error($q$SELECT crm_private.mutate_client('create',gen_random_uuid(),NULL,NULL,'{"name":"Bypass"}')$q$, '42501', 'private worker not callable');
SELECT test_support.assert_true((SELECT count(*) = 3 AND bool_and(prosecdef AND proconfig @> ARRAY['search_path=""']) FROM pg_proc WHERE oid IN ('public.create_client(uuid,jsonb)'::regprocedure,'public.update_client(uuid,uuid,bigint,jsonb)'::regprocedure,'public.change_client_status(uuid,uuid,bigint,public.client_status)'::regprocedure)), 'all RPC wrappers use fixed search path');
SELECT test_support.assert_error('DELETE FROM public.client_contact_corrections', '42501', 'audit immutable to caller');
SELECT test_support.assert_error('UPDATE public.client_contact_corrections SET recorded_at = now()', '42501', 'audit update denied');
SELECT test_support.assert_error('INSERT INTO public.client_contact_corrections(client_id) VALUES(gen_random_uuid())', '42501', 'audit insert denied');
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
SELECT test_support.assert_error($q$SELECT public.create_client(gen_random_uuid(),'{"name":"Tercero"}')$q$, '42501', 'third user RPC denied');
SELECT test_support.assert_error(format('SELECT public.update_client(gen_random_uuid(), %L, 6, %L)', :'first'::jsonb->>'id', '{}'), '42501', 'third user edit denied');
SELECT test_support.assert_error(format('SELECT public.change_client_status(gen_random_uuid(), %L, 6, %L)', :'first'::jsonb->>'id', 'Cerrado'), '42501', 'third user movement denied');
SELECT test_support.assert_true((SELECT count(*) = 0 FROM public.client_contact_corrections), 'third user audit read denied by RLS');
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT test_support.assert_error($q$SELECT public.create_client(gen_random_uuid(),'{"name":"Sin identidad"}')$q$, '42501', 'missing identity RPC denied');
SELECT test_support.assert_error(format('SELECT public.update_client(gen_random_uuid(), %L, 6, %L)', :'first'::jsonb->>'id', '{}'), '42501', 'missing identity edit denied');
SELECT test_support.assert_error(format('SELECT public.change_client_status(gen_random_uuid(), %L, 6, %L)', :'first'::jsonb->>'id', 'Cerrado'), '42501', 'missing identity movement denied');
SET LOCAL ROLE anon;
SELECT test_support.assert_error($q$SELECT public.create_client(gen_random_uuid(),'{"name":"Anónimo"}')$q$, '42501', 'anon RPC execute denied');
SELECT test_support.assert_error(format('SELECT public.update_client(gen_random_uuid(), %L, 6, %L)', :'first'::jsonb->>'id', '{}'), '42501', 'anon edit execute denied');
SELECT test_support.assert_error(format('SELECT public.change_client_status(gen_random_uuid(), %L, 6, %L)', :'first'::jsonb->>'id', 'Cerrado'), '42501', 'anon movement execute denied');
SELECT test_support.assert_error('SELECT * FROM public.client_contact_corrections', '42501', 'anon audit read denied');
RESET ROLE;

-- Trigger sintético inyecta fallo después de escribir cliente, para probar rollback real.
CREATE FUNCTION test_support.reject_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'synthetic history failure' USING ERRCODE = '23514'; END; $$;
CREATE TRIGGER reject_event BEFORE INSERT ON public.client_transitions FOR EACH ROW EXECUTE FUNCTION test_support.reject_event();
SELECT count(*) AS before_clients FROM public.clients \gset
SELECT count(*) AS before_requests FROM crm_private.client_requests \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT test_support.assert_error($q$SELECT public.create_client('00000000-0000-4000-8000-000000000099','{"name":"Falla"}')$q$, '23514', 'history failure aborts create');
SELECT test_support.assert_error(format('SELECT public.change_client_status(gen_random_uuid(), %L, 6, %L)', :'first'::jsonb->>'id', 'Cerrado'), '23514', 'history failure aborts update');
SELECT test_support.assert_error(format('SELECT public.update_client(gen_random_uuid(), %L, 6, %L)', :'first'::jsonb->>'id', '{"status":"Cerrado","contact_at":"2026-10-03T12:00:00Z"}'), '23514', 'history failure rolls back correction and audit too');
RESET ROLE;
SELECT test_support.assert_true((SELECT count(*) = :before_clients FROM public.clients), 'failed create leaves no client');
SELECT test_support.assert_true((SELECT count(*) = :before_requests FROM crm_private.client_requests), 'failed requests leave no ledger entry');
SELECT test_support.assert_true((SELECT version = 6 AND status = 'Reunión agendada' AND contact_at = '2026-09-30T12:00:00Z' FROM public.clients WHERE id = (:'first'::jsonb->>'id')::uuid), 'failed transition restores client version/state/contact date');
SELECT test_support.assert_true(NOT EXISTS(SELECT 1 FROM public.client_milestones WHERE client_id = (:'first'::jsonb->>'id')::uuid AND status = 'Cerrado'), 'failed transition leaves no milestone');
SELECT test_support.assert_true((SELECT reached_at = '2026-09-30T12:00:00Z' FROM public.client_milestones WHERE client_id = (:'first'::jsonb->>'id')::uuid AND status = 'Contactado'), 'failed correction restores milestone');
SELECT test_support.assert_true((SELECT count(*) = 1 FROM public.client_contact_corrections), 'failed correction leaves no audit');
ROLLBACK;
