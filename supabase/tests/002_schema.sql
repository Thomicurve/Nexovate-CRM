BEGIN;
SELECT test_support.assert_true(
  (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) = ARRAY[
    'Contactado', 'Reunión agendada', 'Cerrado', 'Sin respuesta', 'Respuesta negativa', 'Interesado'
  ] FROM pg_enum WHERE enumtypid = 'public.client_status'::regtype), 'exact six statuses');
INSERT INTO public.clients(name) VALUES ('Sólo nombre');
SELECT test_support.assert_true(
  (SELECT status = 'Contactado' AND contact_at IS NOT NULL AND meeting_at IS NULL
    AND company IS NULL AND rubro IS NULL AND email IS NULL AND phone IS NULL
    AND notes IS NULL AND version = 1 FROM public.clients WHERE name = 'Sólo nombre'),
  'required name, optional fields, contact date and default version/state');
SELECT test_support.assert_error('INSERT INTO public.clients(name) VALUES (NULL)', '23502', 'name required');
SELECT test_support.assert_error('INSERT INTO public.clients(name) VALUES ('''')', '23514', 'empty name rejected');
SELECT test_support.assert_error($q$INSERT INTO public.clients(name) VALUES (E' \t\n')$q$, '23514', 'whitespace name rejected');
SELECT test_support.assert_error('INSERT INTO public.clients(name,email) VALUES (''Cliente'',''invalido'')', '23514', 'email format enforced');
SELECT test_support.assert_error('INSERT INTO public.clients(name,status) VALUES (''Cliente'',''Inventado'')', '22P02', 'invalid status rejected');
SELECT test_support.assert_error('INSERT INTO public.clients(name,contact_at) VALUES (''Cliente'', NULL)', '23502', 'contact date required');
SELECT test_support.assert_error('INSERT INTO public.clients(name,contact_at) VALUES (''Cliente'', ''infinity'')', '23514', 'contact date finite');
SELECT test_support.assert_error('INSERT INTO public.clients(name,meeting_at) VALUES (''Cliente'', ''-infinity'')', '23514', 'meeting date finite');
SELECT test_support.assert_error('INSERT INTO public.clients(name,version) VALUES (''Cliente'',0)', '23514', 'version positive');
INSERT INTO public.clients(name, email, rubro, meeting_at) VALUES ('Opcionales', 'prueba@example.test', 'Servicios', '2026-10-08T15:00:00Z');
SELECT test_support.assert_true((SELECT count(*) = 2 FROM public.clients), 'valid optional fields accepted');
SELECT test_support.assert_error('INSERT INTO public.client_milestones(client_id,status,reached_at) SELECT id,''Interesado'',now() FROM public.clients LIMIT 1', '23514', 'only metric statuses create milestones');
SELECT test_support.assert_true(
  (SELECT proconfig @> ARRAY['search_path=""'] AND prosecdef
   FROM pg_proc WHERE oid = 'crm_private.is_crm_member()'::regprocedure),
  'membership helper uses fixed empty search_path and SECURITY DEFINER');
SELECT 'WU003 schema assertions passed';
ROLLBACK;
