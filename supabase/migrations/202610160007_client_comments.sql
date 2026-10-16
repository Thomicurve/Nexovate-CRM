BEGIN;
-- Serialize the backfill with legacy writes, then freeze the old column.
LOCK TABLE public.clients IN SHARE ROW EXCLUSIVE MODE;
-- ECMAScript String.trim whitespace, explicit so database locale cannot widen/narrow it.
-- Validate a copy; never trim the persisted comment or change the legacy backfill.
CREATE FUNCTION crm_private.valid_comment_body(p_body text) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path='' AS $$
  SELECT char_length(p_body) BETWEEN 1 AND 5000 AND
    btrim(p_body,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> '';
$$;
REVOKE ALL ON FUNCTION crm_private.valid_comment_body(text) FROM PUBLIC,anon,authenticated;
CREATE TABLE public.client_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  body text NOT NULL,
  legacy boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES public.crm_members(user_id) ON DELETE RESTRICT,
  created_at timestamptz,
  imported_at timestamptz,
  sort_at timestamptz GENERATED ALWAYS AS (coalesce(created_at,imported_at)) STORED,
  archived_by uuid REFERENCES public.crm_members(user_id) ON DELETE RESTRICT,
  archived_at timestamptz,
  CHECK ((legacy AND author_id IS NULL AND created_at IS NULL AND imported_at IS NOT NULL) OR
         (NOT legacy AND author_id IS NOT NULL AND created_at IS NOT NULL AND imported_at IS NULL)),
  CHECK (legacy OR crm_private.valid_comment_body(body)),
  CHECK ((archived_at IS NULL) = (archived_by IS NULL)),
  CHECK (created_at IS NULL OR isfinite(created_at)),
  CHECK (imported_at IS NULL OR isfinite(imported_at)),
  CHECK (archived_at IS NULL OR isfinite(archived_at))
);
CREATE UNIQUE INDEX client_comments_one_legacy ON public.client_comments(client_id) WHERE legacy;
CREATE INDEX client_comments_page ON public.client_comments(client_id,(archived_at IS NOT NULL),sort_at DESC,id DESC);
ALTER TABLE public.client_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_comments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_comments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.client_comments TO authenticated;
CREATE POLICY members_read_comments ON public.client_comments FOR SELECT TO authenticated
  USING ((SELECT crm_private.is_crm_member()) AND EXISTS
    (SELECT 1 FROM public.clients c WHERE c.id=client_id AND c.deleted_at IS NULL));
INSERT INTO public.client_comments(client_id,body,legacy,imported_at)
SELECT id,notes,true,statement_timestamp() FROM public.clients WHERE notes IS NOT NULL AND notes !~ '^[[:space:]]*$';

CREATE FUNCTION crm_private.freeze_client_notes() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF (TG_OP='INSERT' AND NEW.notes IS NOT NULL) OR
     (TG_OP='UPDATE' AND NEW.notes IS DISTINCT FROM OLD.notes) THEN
    RAISE EXCEPTION 'legacy_notes_frozen' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION crm_private.freeze_client_notes() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER freeze_client_notes BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION crm_private.freeze_client_notes();

CREATE FUNCTION crm_private.preserve_comment() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'comment_immutable' USING ERRCODE='42501'; END IF;
  IF ROW(NEW.id,NEW.client_id,NEW.body,NEW.legacy,NEW.author_id,NEW.created_at,NEW.imported_at)
     IS DISTINCT FROM ROW(OLD.id,OLD.client_id,OLD.body,OLD.legacy,OLD.author_id,OLD.created_at,OLD.imported_at)
     OR OLD.archived_at IS NOT NULL AND ROW(NEW.archived_at,NEW.archived_by) IS DISTINCT FROM ROW(OLD.archived_at,OLD.archived_by) THEN
    RAISE EXCEPTION 'comment_immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION crm_private.preserve_comment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_comment BEFORE UPDATE OR DELETE ON public.client_comments
FOR EACH ROW EXECUTE FUNCTION crm_private.preserve_comment();

CREATE TABLE crm_private.comment_requests (
  actor_id uuid NOT NULL REFERENCES public.crm_members(user_id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  envelope jsonb NOT NULL,
  response jsonb,
  PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE crm_private.comment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_private.comment_requests FROM PUBLIC,anon,authenticated;

-- Only elevated, member-gated wrappers may expose these account emails.
CREATE FUNCTION crm_private.comment_json(p_comment public.client_comments) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT to_jsonb(p_comment) || jsonb_build_object(
    'author_email',(SELECT email FROM auth.users WHERE id=p_comment.author_id),
    'archived_by_email',(SELECT email FROM auth.users WHERE id=p_comment.archived_by));
$$;
REVOKE ALL ON FUNCTION crm_private.comment_json(public.client_comments) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION crm_private.mutate_comment(p_operation text,p_request_id uuid,p_client_id uuid,p_comment_id uuid,p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  actor uuid := auth.uid();
  envelope jsonb;
  prior crm_private.comment_requests%ROWTYPE;
  target public.client_comments%ROWTYPE;
  target_client public.clients%ROWTYPE;
  receipt jsonb;
BEGIN
  IF actor IS NULL OR NOT crm_private.is_crm_member() THEN
    RAISE EXCEPTION 'crm_access_denied' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_client_id IS NULL OR p_operation IS NULL OR p_operation NOT IN ('create','archive') OR
    p_operation='create' AND (p_body IS NULL OR NOT crm_private.valid_comment_body(p_body) OR p_comment_id IS NOT NULL) OR
    p_operation='archive' AND (p_comment_id IS NULL OR p_body IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid_comment_intent' USING ERRCODE='22023';
  END IF;
  envelope := jsonb_build_object('operation',p_operation,'client_id',p_client_id,'comment_id',p_comment_id,'body',p_body);
  INSERT INTO crm_private.comment_requests(actor_id,request_id,envelope) VALUES(actor,p_request_id,envelope) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO STRICT prior FROM crm_private.comment_requests WHERE actor_id=actor AND request_id=p_request_id;
    IF prior.envelope IS DISTINCT FROM envelope THEN RAISE EXCEPTION 'idempotency_payload_mismatch' USING ERRCODE='22023'; END IF;
    IF prior.response IS NULL THEN RAISE EXCEPTION 'incomplete_request' USING ERRCODE='PT409'; END IF;
    RETURN prior.response;
  END IF;
  -- Same lock as editing/deletion: a deleted client cannot receive a later write.
  SELECT * INTO target_client FROM public.clients WHERE id=p_client_id FOR UPDATE;
  IF NOT FOUND OR target_client.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'client_not_found' USING ERRCODE='P0002'; END IF;
  IF p_operation='create' THEN
    INSERT INTO public.client_comments(client_id,body,author_id,created_at)
    VALUES(p_client_id,p_body,actor,clock_timestamp()) RETURNING * INTO target;
  ELSE
    SELECT * INTO target FROM public.client_comments WHERE id=p_comment_id AND client_id=p_client_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'comment_not_found' USING ERRCODE='P0002'; END IF;
    IF NOT target.legacy AND target.author_id <> actor THEN RAISE EXCEPTION 'comment_archive_denied' USING ERRCODE='42501'; END IF;
    IF target.archived_at IS NULL THEN
      UPDATE public.client_comments SET archived_by=actor,archived_at=clock_timestamp() WHERE id=target.id RETURNING * INTO target;
    END IF;
  END IF;
  receipt := jsonb_build_object('request_id',p_request_id,'comment',crm_private.comment_json(target));
  UPDATE crm_private.comment_requests SET response=receipt WHERE actor_id=actor AND request_id=p_request_id;
  RETURN receipt;
END; $$;
REVOKE ALL ON FUNCTION crm_private.mutate_comment(text,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.create_client_comment(p_request_id uuid,p_client_id uuid,p_body text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT crm_private.mutate_comment('create',p_request_id,p_client_id,NULL,p_body);
$$;
CREATE FUNCTION public.archive_client_comment(p_request_id uuid,p_client_id uuid,p_comment_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT crm_private.mutate_comment('archive',p_request_id,p_client_id,p_comment_id,NULL);
$$;
CREATE FUNCTION public.list_client_comments(p_client_id uuid,p_archived boolean,p_before_at timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,p_limit integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  rows jsonb;
  has_more boolean;
  last_row jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT crm_private.is_crm_member() THEN RAISE EXCEPTION 'crm_access_denied' USING ERRCODE='42501'; END IF;
  IF p_client_id IS NULL OR p_archived IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 OR
     (p_before_at IS NULL) <> (p_before_id IS NULL) OR p_before_at IS NOT NULL AND NOT isfinite(p_before_at) THEN
    RAISE EXCEPTION 'invalid_comment_page' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=p_client_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'client_not_found' USING ERRCODE='P0002'; END IF;
  SELECT coalesce(jsonb_agg(crm_private.comment_json(c) ORDER BY c.sort_at DESC,c.id DESC),'[]'::jsonb) INTO rows
  FROM (SELECT * FROM public.client_comments WHERE client_id=p_client_id AND (archived_at IS NOT NULL)=p_archived
    AND (p_before_at IS NULL OR (sort_at,id)<(p_before_at,p_before_id)) ORDER BY sort_at DESC,id DESC LIMIT p_limit+1) c;
  has_more := jsonb_array_length(rows)>p_limit;
  IF has_more THEN rows := rows - p_limit; END IF;
  last_row := rows->(jsonb_array_length(rows)-1);
  RETURN jsonb_build_object('rows',rows,'next',CASE WHEN has_more THEN jsonb_build_object('at',last_row->>'sort_at','id',last_row->>'id') ELSE NULL END);
END; $$;
REVOKE ALL ON FUNCTION public.create_client_comment(uuid,uuid,text),public.archive_client_comment(uuid,uuid,uuid),public.list_client_comments(uuid,boolean,timestamptz,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_comment(uuid,uuid,text),public.archive_client_comment(uuid,uuid,uuid),public.list_client_comments(uuid,boolean,timestamptz,uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION crm_private.mutate_client(
  p_operation text, p_request_id uuid, p_client_id uuid, p_expected_version bigint, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  envelope jsonb;
  prior crm_private.client_requests%ROWTYPE;
  old_client public.clients%ROWTYPE;
  new_client public.clients%ROWTYPE;
  event_at timestamptz;
  allowed text[] := ARRAY['name','company','rubro','email','phone','contact_at','meeting_at'];
BEGIN
  IF actor IS NULL OR NOT crm_private.is_crm_member() THEN
    RAISE EXCEPTION 'crm_access_denied' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;
  IF p_operation NOT IN ('create', 'update', 'status', 'delete') THEN
    RAISE EXCEPTION 'invalid_operation' USING ERRCODE = '22023';
  END IF;
  IF p_operation = 'create' THEN allowed := allowed || ARRAY['initial_comment']; END IF;
  IF p_operation <> 'create' THEN
    allowed := allowed || ARRAY['status'];
    IF p_client_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1 THEN
      RAISE EXCEPTION 'expected_version_required' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(p_payload) AS field
             WHERE NOT field.key = ANY(allowed) OR jsonb_typeof(field.value) NOT IN ('string','null')) THEN
    RAISE EXCEPTION 'invalid_fields' USING ERRCODE = '22023';
  END IF;
  envelope := jsonb_build_object('operation',p_operation,'client_id',p_client_id,
                               'expected_version',p_expected_version,'payload',p_payload);
  -- La clave única serializa solicitudes repetidas; un fallo revierte la reserva.
  INSERT INTO crm_private.client_requests(actor_id, request_id, envelope)
  VALUES(actor, p_request_id, envelope) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO STRICT prior FROM crm_private.client_requests
      WHERE actor_id = actor AND request_id = p_request_id;
    IF prior.envelope IS DISTINCT FROM envelope THEN
      RAISE EXCEPTION 'idempotency_payload_mismatch' USING ERRCODE = '22023';
    END IF;
    IF prior.response IS NULL THEN
      RAISE EXCEPTION 'incomplete_request' USING ERRCODE = 'PT409';
    END IF;
    RETURN prior.response;
  END IF;

  IF p_operation = 'create' THEN
    event_at := clock_timestamp();
    INSERT INTO public.clients(name, company, rubro, email, phone, contact_at, meeting_at, created_at, updated_at)
    VALUES(p_payload->>'name', p_payload->>'company', p_payload->>'rubro', p_payload->>'email',
           p_payload->>'phone',
           CASE WHEN p_payload ? 'contact_at' THEN (p_payload->>'contact_at')::timestamptz ELSE event_at END,
           (p_payload->>'meeting_at')::timestamptz, event_at, event_at)
    RETURNING * INTO new_client;
    IF p_payload->>'initial_comment' IS NOT NULL THEN
      IF NOT crm_private.valid_comment_body(p_payload->>'initial_comment') THEN
        RAISE EXCEPTION 'invalid_comment' USING ERRCODE='22023';
      END IF;
      INSERT INTO public.client_comments(client_id,body,author_id,created_at)
      VALUES(new_client.id,p_payload->>'initial_comment',actor,event_at);
    END IF;
    INSERT INTO public.client_transitions(client_id, to_status, occurred_at, actor_id)
    VALUES(new_client.id, new_client.status, event_at, actor);
    INSERT INTO public.client_milestones(client_id, status, reached_at)
    VALUES(new_client.id, 'Contactado', new_client.contact_at);
  ELSE
    SELECT * INTO old_client FROM public.clients WHERE id = p_client_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'client_not_found' USING ERRCODE = 'P0002'; END IF;
    IF old_client.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'client_not_found' USING ERRCODE = 'P0002'; END IF;
    IF old_client.version <> p_expected_version THEN
      RAISE EXCEPTION 'client_version_conflict' USING ERRCODE = 'PT409';
    END IF;
    event_at := clock_timestamp();
    IF p_operation = 'delete' THEN
      UPDATE public.clients SET deleted_at=event_at, updated_at=event_at, version=old_client.version+1 WHERE id=old_client.id RETURNING * INTO new_client;
    ELSE
    UPDATE public.clients SET
      name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE old_client.name END,
      company = CASE WHEN p_payload ? 'company' THEN p_payload->>'company' ELSE old_client.company END,
      rubro = CASE WHEN p_payload ? 'rubro' THEN p_payload->>'rubro' ELSE old_client.rubro END,
      email = CASE WHEN p_payload ? 'email' THEN p_payload->>'email' ELSE old_client.email END,
      phone = CASE WHEN p_payload ? 'phone' THEN p_payload->>'phone' ELSE old_client.phone END,
      contact_at = CASE WHEN p_payload ? 'contact_at' THEN (p_payload->>'contact_at')::timestamptz ELSE old_client.contact_at END,
      meeting_at = CASE WHEN p_payload ? 'meeting_at' THEN (p_payload->>'meeting_at')::timestamptz ELSE old_client.meeting_at END,
      status = CASE WHEN p_payload ? 'status' THEN (p_payload->>'status')::public.client_status ELSE old_client.status END,
      version = old_client.version + 1,
      updated_at = event_at
    WHERE id = old_client.id RETURNING * INTO new_client;
    IF old_client.contact_at IS DISTINCT FROM new_client.contact_at THEN
      UPDATE public.client_milestones SET reached_at = new_client.contact_at
        WHERE client_id = new_client.id AND status = 'Contactado';
      INSERT INTO public.client_contact_corrections(client_id, old_contact_at, new_contact_at, actor_id, recorded_at)
      VALUES(new_client.id, old_client.contact_at, new_client.contact_at, actor, event_at);
    END IF;
    IF old_client.status IS DISTINCT FROM new_client.status THEN
      INSERT INTO public.client_transitions(client_id, from_status, to_status, occurred_at, actor_id)
      VALUES(new_client.id, old_client.status, new_client.status, event_at, actor);
      IF new_client.status IN ('Contactado','Reunión agendada','Cerrado') THEN
        INSERT INTO public.client_milestones(client_id, status, reached_at)
        VALUES(new_client.id, new_client.status,
               CASE WHEN new_client.status = 'Contactado' THEN new_client.contact_at ELSE event_at END)
        ON CONFLICT (client_id, status) DO NOTHING;
      END IF;
    END IF;
  END IF;
    END IF;
  UPDATE crm_private.client_requests SET response = CASE WHEN p_operation='delete' THEN jsonb_build_object('client_id',new_client.id,'request_id',p_request_id,'version',new_client.version,'deleted_at',new_client.deleted_at) ELSE to_jsonb(new_client) END
    WHERE actor_id = actor AND request_id = p_request_id;
  RETURN (SELECT response FROM crm_private.client_requests WHERE actor_id=actor AND request_id=p_request_id);
END;
$$;


COMMIT;
