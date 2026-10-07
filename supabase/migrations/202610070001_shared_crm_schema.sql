BEGIN;

CREATE SCHEMA crm_private;
REVOKE ALL ON SCHEMA crm_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA crm_private TO authenticated;

-- UUIDs reales se provisionarán explícitamente; esta migración no crea miembros.
CREATE TABLE public.crm_members (
  slot smallint PRIMARY KEY CHECK (slot IN (1, 2)),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT
);
ALTER TABLE public.crm_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_members FROM PUBLIC, anon, authenticated;

CREATE FUNCTION crm_private.is_crm_member() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_members WHERE user_id = (SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION crm_private.is_crm_member() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION crm_private.is_crm_member() TO authenticated;

CREATE TYPE public.client_status AS ENUM (
  'Contactado', 'Reunión agendada', 'Cerrado',
  'Sin respuesta', 'Respuesta negativa', 'Interesado'
);
REVOKE ALL ON TYPE public.client_status FROM PUBLIC, anon;
GRANT USAGE ON TYPE public.client_status TO authenticated;

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (name !~ '^[[:space:]]*$'),
  company text,
  rubro text,
  email text CHECK (email IS NULL OR email = '' OR email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text,
  notes text,
  status public.client_status NOT NULL DEFAULT 'Contactado',
  contact_at timestamptz NOT NULL DEFAULT statement_timestamp() CHECK (isfinite(contact_at)),
  meeting_at timestamptz CHECK (meeting_at IS NULL OR isfinite(meeting_at)),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

CREATE TABLE public.client_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  from_status public.client_status,
  to_status public.client_status NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  actor_id uuid NOT NULL REFERENCES public.crm_members(user_id) ON DELETE RESTRICT,
  CHECK (from_status IS NULL OR from_status <> to_status)
);
CREATE INDEX client_transitions_client_time ON public.client_transitions(client_id, occurred_at);

CREATE TABLE public.client_milestones (
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  status public.client_status NOT NULL CHECK (status IN ('Contactado', 'Reunión agendada', 'Cerrado')),
  reached_at timestamptz NOT NULL CHECK (isfinite(reached_at)),
  PRIMARY KEY (client_id, status)
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_transitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_milestones FORCE ROW LEVEL SECURITY;

CREATE POLICY members_read_clients ON public.clients FOR SELECT TO authenticated
  USING ((SELECT crm_private.is_crm_member()));
CREATE POLICY members_read_transitions ON public.client_transitions FOR SELECT TO authenticated
  USING ((SELECT crm_private.is_crm_member()));
CREATE POLICY members_read_milestones ON public.client_milestones FOR SELECT TO authenticated
  USING ((SELECT crm_private.is_crm_member()));

-- No DML directo: WU-004 concederá sólo RPCs transaccionales que preserven historial.
REVOKE ALL ON public.clients, public.client_transitions, public.client_milestones
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.clients, public.client_transitions, public.client_milestones TO authenticated;

COMMIT;
