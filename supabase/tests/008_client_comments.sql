BEGIN;
SELECT test_support.assert_true((SELECT count(*)=2 FROM public.client_comments),'real migration imports exactly nonblank notes');
SELECT test_support.assert_true((SELECT body=E'  Exacto\nsegunda línea  ' AND author_id IS NULL AND created_at IS NULL AND imported_at IS NOT NULL AND legacy
 FROM public.client_comments WHERE client_id='80000000-0000-4000-8000-000000000001'),'legacy exact text without invented metadata');
SELECT test_support.assert_true((SELECT body='Borrado' FROM public.client_comments WHERE client_id='80000000-0000-4000-8000-000000000002'),'deleted client history retained');
INSERT INTO public.crm_members VALUES (1,'11111111-1111-4111-8111-111111111111'),(2,'22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT public.create_client('80000000-0000-4000-8000-000000000010','{"name":"Comments","initial_comment":"Inicio"}') AS target \gset
SELECT test_support.assert_true(public.create_client('80000000-0000-4000-8000-000000000010','{"name":"Comments","initial_comment":"Inicio"}')=:'target'::jsonb,'initial comment and client replay together');
SELECT test_support.assert_true((SELECT count(*)=1 FROM public.client_comments WHERE client_id=(:'target'::jsonb->>'id')::uuid),'one initial comment');
-- Match ECMAScript trim whitespace, independently of the PostgreSQL locale.
RESET ROLE;
CREATE FUNCTION test_support.assert_unicode_comments(p_client_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  whitespace text;
  failures text[] := ARRAY[]::text[];
BEGIN
  FOREACH whitespace IN ARRAY ARRAY[chr(160),chr(65279),chr(5760),chr(8192),chr(8193),chr(8194),chr(8195),chr(8196),chr(8197),chr(8198),chr(8199),chr(8200),chr(8201),chr(8202),chr(8232),chr(8233),chr(8239),chr(8287),chr(12288)] LOOP
    BEGIN
      PERFORM test_support.assert_error(format('SELECT public.create_client_comment(gen_random_uuid(),%L,%L)',p_client_id,whitespace),'22023','Unicode-only comment rejected');
    EXCEPTION WHEN OTHERS THEN failures := array_append(failures,'comment U+'||to_hex(ascii(whitespace))); END;
    BEGIN
      PERFORM test_support.assert_error(format('SELECT public.create_client(gen_random_uuid(),%L)',jsonb_build_object('name','Unicode blank initial','initial_comment',whitespace)),'22023','Unicode-only initial rejected');
    EXCEPTION WHEN OTHERS THEN failures := array_append(failures,'initial U+'||to_hex(ascii(whitespace))); END;
  END LOOP;
  IF cardinality(failures)>0 THEN RAISE EXCEPTION 'Unicode whitespace incorrectly accepted: %',array_to_string(failures,', '); END IF;
END; $$;
SET LOCAL ROLE authenticated;
SELECT test_support.assert_unicode_comments((:'target'::jsonb->>'id')::uuid);
SAVEPOINT unicode_real_content;
SELECT chr(160)||chr(65279)||chr(8195)||E'Texto\nexacto'||chr(8239)||chr(12288) AS unicode_text \gset
SELECT public.create_client_comment(gen_random_uuid(),(:'target'::jsonb->>'id')::uuid,:'unicode_text') AS unicode_receipt \gset
SELECT test_support.assert_true(:'unicode_receipt'::jsonb->'comment'->>'body'=:'unicode_text','real Unicode-padded comment exact');
SELECT public.create_client(gen_random_uuid(),jsonb_build_object('name','Unicode real initial','initial_comment',:'unicode_text')) AS unicode_initial \gset
SELECT test_support.assert_true((SELECT body=:'unicode_text' FROM public.client_comments WHERE client_id=(:'unicode_initial'::jsonb->>'id')::uuid),'real Unicode-padded initial exact');
ROLLBACK TO SAVEPOINT unicode_real_content;
RESET ROLE;
SELECT test_support.assert_error(format('INSERT INTO public.client_comments(client_id,body,author_id,created_at) VALUES(%L,%L,%L,clock_timestamp())',
 :'target'::jsonb->>'id',chr(160),'11111111-1111-4111-8111-111111111111'),'23514','CHECK also rejects Unicode-only body');
SET LOCAL ROLE authenticated;
SELECT public.dashboard_metrics('2026-01-01','2026-12-31','month') AS metrics_before \gset
SELECT public.create_client_comment('80000000-0000-4000-8000-000000000011',(:'target'::jsonb->>'id')::uuid,E' Texto\nlargo ') AS receipt \gset
SELECT test_support.assert_true(public.create_client_comment('80000000-0000-4000-8000-000000000011',(:'target'::jsonb->>'id')::uuid,E' Texto\nlargo ')=:'receipt'::jsonb,'same intent replays exact receipt');
SELECT test_support.assert_error(format('SELECT public.create_client_comment(''80000000-0000-4000-8000-000000000011'',%L,''Otro'')',:'target'::jsonb->>'id'),'22023','changed payload rejected');
SELECT test_support.assert_true(:'receipt'::jsonb->'comment'->>'author_id'='11111111-1111-4111-8111-111111111111' AND :'receipt'::jsonb->'comment'->>'author_email'='first@example.test','actor and display identity from session');
SELECT test_support.assert_true((SELECT version=1 AND updated_at=created_at FROM public.clients WHERE id=(:'target'::jsonb->>'id')::uuid),'comment does not mutate client version');
SELECT test_support.assert_error(format('SELECT public.create_client_comment(gen_random_uuid(),%L,''   '')',:'target'::jsonb->>'id'),'22023','blank rejected');
SELECT test_support.assert_error(format('SELECT public.create_client_comment(gen_random_uuid(),%L,repeat(''x'',5001))',:'target'::jsonb->>'id'),'22023','oversize rejected');
SELECT public.create_client_comment(gen_random_uuid(),(:'target'::jsonb->>'id')::uuid,repeat('x',5000));
SELECT test_support.assert_error('SELECT public.create_client(gen_random_uuid(),''{"name":"Invalid initial","initial_comment":"   "}'')','22023','invalid initial rolls back client');
SELECT test_support.assert_error(format('SELECT public.update_client(gen_random_uuid(),%L,1,''{"notes":"forbidden"}'')',:'target'::jsonb->>'id'),'22023','old notes RPC blocked');
SELECT test_support.assert_true(jsonb_array_length(public.list_client_comments((:'target'::jsonb->>'id')::uuid,false,NULL,NULL,1)->'rows')=1 AND public.list_client_comments((:'target'::jsonb->>'id')::uuid,false,NULL,NULL,1)->'next' <> 'null'::jsonb,'bounded page signals more');
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT test_support.assert_true(jsonb_array_length(public.list_client_comments((:'target'::jsonb->>'id')::uuid,false)->'rows')=3,'second member reads all new comments');
SELECT test_support.assert_error(format('SELECT public.archive_client_comment(gen_random_uuid(),%L,%L)',:'target'::jsonb->>'id',:'receipt'::jsonb->'comment'->>'id'),'42501','other member cannot archive new comment');
SELECT public.list_client_comments('80000000-0000-4000-8000-000000000001',false) AS legacy_page \gset
SELECT public.archive_client_comment(gen_random_uuid(),'80000000-0000-4000-8000-000000000001',(:'legacy_page'::jsonb->'rows'->0->>'id')::uuid) AS legacy_archive \gset
SELECT test_support.assert_true(:'legacy_archive'::jsonb->'comment'->>'archived_by'='22222222-2222-4222-8222-222222222222','either member archives legacy');
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT public.archive_client_comment('80000000-0000-4000-8000-000000000012',(:'target'::jsonb->>'id')::uuid,(:'receipt'::jsonb->'comment'->>'id')::uuid) AS archived \gset
SELECT test_support.assert_true((public.archive_client_comment(gen_random_uuid(),(:'target'::jsonb->>'id')::uuid,(:'receipt'::jsonb->'comment'->>'id')::uuid)->'comment')=(:'archived'::jsonb->'comment'),'second archive preserves first archive metadata');
SELECT test_support.assert_true(:'archived'::jsonb->'comment'->>'body'=E' Texto\nlargo ' AND :'archived'::jsonb->'comment'->>'created_at'=:'receipt'::jsonb->'comment'->>'created_at','archive preserves originals');
SELECT test_support.assert_true(public.archive_client_comment('80000000-0000-4000-8000-000000000012',(:'target'::jsonb->>'id')::uuid,(:'receipt'::jsonb->'comment'->>'id')::uuid)=:'archived'::jsonb,'archive same intent exact replay');
SELECT test_support.assert_true(jsonb_array_length(public.list_client_comments((:'target'::jsonb->>'id')::uuid,true)->'rows')=1 AND
 public.list_client_comments((:'target'::jsonb->>'id')::uuid,true)->'rows'->0->>'archived_by_email'='first@example.test','archived page includes restricted actor display');
SELECT test_support.assert_error(format('SELECT public.create_client_comment(gen_random_uuid(),%L,''x'',%L)',:'target'::jsonb->>'id','22222222-2222-4222-8222-222222222222'),'42883','no caller-selected author parameter');
SELECT test_support.assert_error('INSERT INTO public.client_comments(client_id,body) VALUES(gen_random_uuid(),''x'')','42501','no direct insert bypass');
SELECT test_support.assert_error('UPDATE public.client_comments SET body=''edited''','42501','no direct update');
SELECT test_support.assert_error('DELETE FROM public.client_comments','42501','no physical delete');
SELECT test_support.assert_error('TRUNCATE public.client_comments','42501','no truncate bypass');
SELECT test_support.assert_error('SELECT * FROM auth.users','42501','no general auth directory');
SELECT test_support.assert_error('SELECT public.list_client_comments(''80000000-0000-4000-8000-000000000002'',false)','P0002','deleted history inaccessible');
SELECT test_support.assert_true((SELECT count(*)=0 FROM public.client_comments WHERE client_id='80000000-0000-4000-8000-000000000002'),'direct RLS excludes deleted history');
SELECT test_support.assert_error('SELECT public.create_client_comment(gen_random_uuid(),''80000000-0000-4000-8000-000000000002'',''x'')','P0002','deleted create rejected');
SELECT test_support.assert_error('SELECT public.list_client_comments(''80000000-0000-4000-8000-000000000001'',false,NULL,NULL,0)','22023','page limit required');
SELECT test_support.assert_error('SELECT public.list_client_comments(''80000000-0000-4000-8000-000000000001'',false,now(),NULL,30)','22023','cursor pair required');
SELECT test_support.assert_true(public.dashboard_metrics('2026-01-01','2026-12-31','month')=:'metrics_before'::jsonb,'comments and archive preserve metrics');
SELECT test_support.assert_true((SELECT count(*)=1 FROM public.client_transitions WHERE client_id=(:'target'::jsonb->>'id')::uuid) AND
 (SELECT count(*)=1 FROM public.client_milestones WHERE client_id=(:'target'::jsonb->>'id')::uuid),'comments do not add transitions or milestones');
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT test_support.assert_error(format('SELECT public.list_client_comments(%L,false)',:'target'::jsonb->>'id'),'42501','nonmember read rejected');
SELECT test_support.assert_error(format('SELECT public.create_client_comment(gen_random_uuid(),%L,''x'')',:'target'::jsonb->>'id'),'42501','nonmember create rejected');
SELECT test_support.assert_error(format('SELECT public.archive_client_comment(gen_random_uuid(),%L,%L)',:'target'::jsonb->>'id',:'receipt'::jsonb->'comment'->>'id'),'42501','nonmember archive rejected');
SELECT test_support.assert_true((SELECT count(*)=0 FROM public.client_comments),'nonmember direct read empty');
SELECT set_config('request.jwt.claim.sub','',true);
SELECT test_support.assert_error(format('SELECT public.list_client_comments(%L,false)',:'target'::jsonb->>'id'),'42501','missing identity rejected');
SET LOCAL ROLE anon;
SELECT test_support.assert_error('SELECT * FROM public.client_comments','42501','anonymous direct read rejected');
SELECT test_support.assert_error(format('SELECT public.list_client_comments(%L,false)',:'target'::jsonb->>'id'),'42501','anonymous RPC denied');
RESET ROLE;
SELECT test_support.assert_true(NOT EXISTS(SELECT 1 FROM public.clients WHERE name='Invalid initial'),'invalid initial leaves no client');
-- Force ties at microsecond resolution to exercise the real cursor and its UUID tiebreaker.
INSERT INTO public.client_comments(id,client_id,body,author_id,created_at)
SELECT ('90000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,(:'target'::jsonb->>'id')::uuid,'Tie '||n,
 '11111111-1111-4111-8111-111111111111','9999-01-01T00:00:00.123456Z' FROM generate_series(1,65) n;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT public.list_client_comments((:'target'::jsonb->>'id')::uuid,false) AS page1 \gset
SELECT public.list_client_comments((:'target'::jsonb->>'id')::uuid,false,(:'page1'::jsonb->'next'->>'at')::timestamptz,(:'page1'::jsonb->'next'->>'id')::uuid) AS page2 \gset
SELECT public.list_client_comments((:'target'::jsonb->>'id')::uuid,false,(:'page2'::jsonb->'next'->>'at')::timestamptz,(:'page2'::jsonb->'next'->>'id')::uuid) AS page3 \gset
SELECT test_support.assert_true(jsonb_array_length(:'page1'::jsonb->'rows')=30 AND jsonb_array_length(:'page2'::jsonb->'rows')=30 AND
 jsonb_array_length(:'page3'::jsonb->'rows')=7 AND :'page3'::jsonb->'next'='null'::jsonb,'all pages have exact count and terminal cursor');
SELECT test_support.assert_true(:'page1'::jsonb->'rows'->0->>'body'='Tie 65' AND :'page2'::jsonb->'rows'->0->>'body'='Tie 35' AND
 :'page3'::jsonb->'rows'->0->>'body'='Tie 5','stable UUID tiebreaker and microseconds without omissions');
RESET ROLE;
-- A storage failure after the write must roll back the whole transaction, including intent.
CREATE FUNCTION test_support.fail_comment_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_id='80000000-0000-4000-8000-000000000099' THEN RAISE EXCEPTION 'synthetic_receipt_failure' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER fail_comment_receipt BEFORE UPDATE ON crm_private.comment_requests FOR EACH ROW EXECUTE FUNCTION test_support.fail_comment_receipt();
CREATE TRIGGER fail_client_receipt BEFORE UPDATE ON crm_private.client_requests FOR EACH ROW EXECUTE FUNCTION test_support.fail_comment_receipt();
SELECT count(*) AS comments_before FROM public.client_comments \gset
SET LOCAL ROLE authenticated;
SELECT test_support.assert_error('SELECT public.create_client(''80000000-0000-4000-8000-000000000099'',''{"name":"Atomic initial","initial_comment":"Keep together"}'')','23514','client receipt failure rolls back initial comment');
SELECT test_support.assert_error(format('SELECT public.create_client_comment(''80000000-0000-4000-8000-000000000099'',%L,''Atomic comment'')',:'target'::jsonb->>'id'),'23514','create receipt failure rolls back comment');
SELECT test_support.assert_error(format('SELECT public.archive_client_comment(''80000000-0000-4000-8000-000000000099'',%L,%L)',:'target'::jsonb->>'id',:'page1'::jsonb->'rows'->0->>'id'),'23514','archive receipt failure rolls back archive');
RESET ROLE;
SELECT test_support.assert_true((SELECT count(*)=:comments_before FROM public.client_comments) AND NOT EXISTS(SELECT 1 FROM public.clients WHERE name='Atomic initial'),'atomic writes leave no partial records');
SELECT test_support.assert_true(NOT EXISTS(SELECT 1 FROM crm_private.comment_requests WHERE request_id='80000000-0000-4000-8000-000000000099') AND
 NOT EXISTS(SELECT 1 FROM crm_private.client_requests WHERE request_id='80000000-0000-4000-8000-000000000099'),'failed writes leave no reserved intent');
SELECT test_support.assert_true((SELECT archived_at IS NULL FROM public.client_comments WHERE id=(:'page1'::jsonb->'rows'->0->>'id')::uuid),'failed archive restores metadata');
SELECT test_support.assert_error('UPDATE public.client_comments SET body=''overwrite'' WHERE legacy','42501','immutable originals even for elevated accidental writes');
SELECT test_support.assert_error('UPDATE public.clients SET notes=''new'' WHERE id=''80000000-0000-4000-8000-000000000001''','22023','notes blocked even outside RPC');
SELECT test_support.assert_true(NOT has_function_privilege('anon','public.create_client_comment(uuid,uuid,text)','EXECUTE'),'anonymous cannot create');
SELECT test_support.assert_true(NOT has_function_privilege('authenticated','crm_private.mutate_comment(text,uuid,uuid,uuid,text)','EXECUTE'),'private mutation inaccessible');
ROLLBACK;
