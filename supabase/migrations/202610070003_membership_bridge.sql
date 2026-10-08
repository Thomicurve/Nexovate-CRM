-- Public Data API bridge: caller receives only its own authorization boolean.
CREATE FUNCTION public.current_user_is_crm_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT crm_private.is_crm_member();
$$;
REVOKE ALL ON FUNCTION public.current_user_is_crm_member() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_crm_member() TO authenticated;
