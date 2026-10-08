-- Sólo para un cluster desechable. No es una migración ni integración con Supabase Auth.
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
-- Reproduce grants amplios posibles en proyectos Supabase existentes:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
CREATE SCHEMA test_support;
GRANT USAGE ON SCHEMA test_support TO anon, authenticated;
CREATE FUNCTION test_support.assert_true(value boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
END;
$$;
CREATE FUNCTION test_support.assert_error(statement text, code text, label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = code THEN RETURN; END IF;
    RAISE EXCEPTION 'FAIL: % (SQLSTATE %, expected %)', label, SQLSTATE, code;
  END;
  RAISE EXCEPTION 'FAIL: % (operation accepted)', label;
END;
$$;
