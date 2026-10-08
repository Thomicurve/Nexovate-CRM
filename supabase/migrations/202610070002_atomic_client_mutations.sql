BEGIN;

CREATE TABLE public.client_contact_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  old_contact_at timestamptz NOT NULL CHECK (isfinite(old_contact_at)),
  new_contact_at timestamptz NOT NULL CHECK (isfinite(new_contact_at)),
  actor_id uuid NOT NULL REFERENCES public.crm_members(user_id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (old_contact_at <> new_contact_at)
);
ALTER TABLE public.client_contact_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contact_corrections FORCE ROW LEVEL SECURITY;
CREATE POLICY members_read_corrections ON public.client_contact_corrections
  FOR SELECT TO authenticated USING ((SELECT crm_private.is_crm_member()));
REVOKE ALL ON public.client_contact_corrections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.client_contact_corrections TO authenticated;

CREATE TABLE crm_private.client_requests (
  actor_id uuid NOT NULL REFERENCES public.crm_members(user_id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  envelope jsonb NOT NULL,
  response jsonb,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (actor_id, request_id)
);
ALTER TABLE crm_private.client_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_private.client_requests FROM PUBLIC, anon, authenticated;

-- Invoker worker: sólo los wrappers elevados, nunca el caller, pueden ejecutarlo.
CREATE FUNCTION crm_private.mutate_client(
  p_operation text, p_request_id uuid, p_client_id uuid, p_expected_version bigint, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  envelope jsonb;
  prior crm_private.client_requests%ROWTYPE;
  old_client public.clients%ROWTYPE;
  new_client public.clients%ROWTYPE;
  event_at timestamptz;
  allowed text[] := ARRAY['name','company','rubro','email','phone','notes','contact_at','meeting_at'];
BEGIN
  IF actor IS NULL OR NOT crm_private.is_crm_member() THEN
    RAISE EXCEPTION 'crm_access_denied' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;
  IF p_operation NOT IN ('create', 'update', 'status') THEN
    RAISE EXCEPTION 'invalid_operation' USING ERRCODE = '22023';
  END IF;
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
      RAISE EXCEPTION 'incomplete_request' USING ERRCODE = '40001';
    END IF;
    RETURN prior.response;
  END IF;

  IF p_operation = 'create' THEN
    event_at := clock_timestamp();
    INSERT INTO public.clients(name, company, rubro, email, phone, notes, contact_at, meeting_at, created_at, updated_at)
    VALUES(p_payload->>'name', p_payload->>'company', p_payload->>'rubro', p_payload->>'email',
           p_payload->>'phone', p_payload->>'notes',
           CASE WHEN p_payload ? 'contact_at' THEN (p_payload->>'contact_at')::timestamptz ELSE event_at END,
           (p_payload->>'meeting_at')::timestamptz, event_at, event_at)
    RETURNING * INTO new_client;
    INSERT INTO public.client_transitions(client_id, to_status, occurred_at, actor_id)
    VALUES(new_client.id, new_client.status, event_at, actor);
    INSERT INTO public.client_milestones(client_id, status, reached_at)
    VALUES(new_client.id, 'Contactado', new_client.contact_at);
  ELSE
    SELECT * INTO old_client FROM public.clients WHERE id = p_client_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'client_not_found' USING ERRCODE = 'P0002'; END IF;
    IF old_client.version <> p_expected_version THEN
      RAISE EXCEPTION 'client_version_conflict' USING ERRCODE = '40001';
    END IF;
    event_at := clock_timestamp();
    UPDATE public.clients SET
      name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE old_client.name END,
      company = CASE WHEN p_payload ? 'company' THEN p_payload->>'company' ELSE old_client.company END,
      rubro = CASE WHEN p_payload ? 'rubro' THEN p_payload->>'rubro' ELSE old_client.rubro END,
      email = CASE WHEN p_payload ? 'email' THEN p_payload->>'email' ELSE old_client.email END,
      phone = CASE WHEN p_payload ? 'phone' THEN p_payload->>'phone' ELSE old_client.phone END,
      notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE old_client.notes END,
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
  UPDATE crm_private.client_requests SET response = to_jsonb(new_client)
    WHERE actor_id = actor AND request_id = p_request_id;
  RETURN to_jsonb(new_client);
END;
$$;
REVOKE ALL ON FUNCTION crm_private.mutate_client(text,uuid,uuid,bigint,jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_client(p_request_id uuid, p_payload jsonb) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT crm_private.mutate_client('create',p_request_id,NULL,NULL,p_payload);
$$;
CREATE FUNCTION public.update_client(p_request_id uuid, p_client_id uuid, p_expected_version bigint, p_payload jsonb) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT crm_private.mutate_client('update',p_request_id,p_client_id,p_expected_version,p_payload);
$$;
CREATE FUNCTION public.change_client_status(p_request_id uuid, p_client_id uuid, p_expected_version bigint, p_status public.client_status) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT crm_private.mutate_client('status',p_request_id,p_client_id,p_expected_version,jsonb_build_object('status',p_status));
$$;
REVOKE ALL ON FUNCTION public.create_client(uuid,jsonb), public.update_client(uuid,uuid,bigint,jsonb),
  public.change_client_status(uuid,uuid,bigint,public.client_status) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_client(uuid,jsonb), public.update_client(uuid,uuid,bigint,jsonb),
  public.change_client_status(uuid,uuid,bigint,public.client_status) TO authenticated;

COMMIT;
