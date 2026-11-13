-- ==============================================================================
-- MIGRACIÓN: Endurecimiento Auth + RLS Completa + RPCs Seguras de Login y Perfil
-- Fecha: 2026-11-13
-- Ejecutar DESPUÉS de 20261112_rls_and_updated_at.sql
-- ==============================================================================

-- 1. RPC pre-autenticación segura: resuelve únicamente email/estado mínimo sin exponer hashes, salts ni API keys
CREATE OR REPLACE FUNCTION public.resolve_login_profile(p_login TEXT)
RETURNS TABLE (
  id TEXT,
  email TEXT,
  role TEXT,
  activo BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email, u.role, u.activo
  FROM public.usuarios_sistema u
  WHERE lower(trim(u.email)) = lower(trim(p_login))
     OR lower(trim(u.username)) = lower(trim(p_login))
     OR split_part(lower(trim(u.email)), '@', 1) = lower(trim(p_login))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_profile(TEXT) TO anon, authenticated;

-- 2. RPC post-autenticación: vincula auth.uid() con el registro correspondiente en usuarios_sistema según el email verificado del JWT
CREATE OR REPLACE FUNCTION public.link_my_auth_uid()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_email TEXT;
  updated_rows INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  jwt_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  IF jwt_email = '' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.usuarios_sistema
  SET auth_uid = auth.uid(),
      ultimo_acceso = timezone('utc'::text, now())
  WHERE lower(trim(email)) = jwt_email
    AND (auth_uid IS NULL OR auth_uid = auth.uid());

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.link_my_auth_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_my_auth_uid() TO authenticated;

-- 3. RPC segura para que cada usuario autenticado actualice únicamente su propia API Key personal y flag de cambio de clave
CREATE OR REPLACE FUNCTION public.update_my_profile_secrets(
  p_gemini_api_key TEXT DEFAULT NULL,
  p_debe_cambiar_password BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_rows INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.usuarios_sistema
  SET gemini_api_key = CASE WHEN p_gemini_api_key IS NOT NULL THEN NULLIF(trim(p_gemini_api_key), '') ELSE gemini_api_key END,
      debe_cambiar_password = COALESCE(p_debe_cambiar_password, debe_cambiar_password),
      updated_at = timezone('utc'::text, now())
  WHERE auth_uid = auth.uid();

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile_secrets(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile_secrets(TEXT, BOOLEAN) TO authenticated;

-- 4. RPC segura para consultar únicamente el estado público de pausa de revisión interna
CREATE OR REPLACE FUNCTION public.get_pausa_revision_publica()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.ui_config_json
  FROM public.configuracion_general c
  WHERE c.id = 'pausa_revision_interna'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_pausa_revision_publica() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pausa_revision_publica() TO anon, authenticated;

-- 5. Cerrar políticas permisivas residuales en tablas no cubiertas en 20261112
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['asesor_cartera', 'roles_permisos_bitacora', 'establecimientos_eliminados']
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Permitir select a todos en %I" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Permitir insert/update/delete en %I" ON public.%I', tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- Políticas estrictas para asesor_cartera
DROP POLICY IF EXISTS "rls_select_asesor_cartera" ON public.asesor_cartera;
DROP POLICY IF EXISTS "rls_write_asesor_cartera" ON public.asesor_cartera;
CREATE POLICY "rls_select_asesor_cartera" ON public.asesor_cartera
  FOR SELECT TO authenticated
  USING (
    public.is_slep_admin()
    OR EXISTS (SELECT 1 FROM public.current_slep_user() u WHERE u.id = asesor_cartera.usuario_id)
  );
CREATE POLICY "rls_write_asesor_cartera" ON public.asesor_cartera
  FOR ALL TO authenticated
  USING (public.is_slep_admin())
  WITH CHECK (public.is_slep_admin());

-- Políticas estrictas para roles_permisos_bitacora
DROP POLICY IF EXISTS "rls_select_roles_bitacora" ON public.roles_permisos_bitacora;
DROP POLICY IF EXISTS "rls_write_roles_bitacora" ON public.roles_permisos_bitacora;
CREATE POLICY "rls_select_roles_bitacora" ON public.roles_permisos_bitacora
  FOR SELECT TO authenticated
  USING (public.is_slep_admin());
CREATE POLICY "rls_write_roles_bitacora" ON public.roles_permisos_bitacora
  FOR ALL TO authenticated
  USING (public.is_slep_admin())
  WITH CHECK (public.is_slep_admin());

-- Políticas estrictas para establecimientos_eliminados (si existe)
DO $$
BEGIN
  IF to_regclass('public.establecimientos_eliminados') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "rls_select_est_eliminados" ON public.establecimientos_eliminados';
    EXECUTE 'DROP POLICY IF EXISTS "rls_write_est_eliminados" ON public.establecimientos_eliminados';
    EXECUTE 'CREATE POLICY "rls_select_est_eliminados" ON public.establecimientos_eliminados FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "rls_write_est_eliminados" ON public.establecimientos_eliminados FOR ALL TO authenticated USING (public.is_slep_admin()) WITH CHECK (public.is_slep_admin())';
  END IF;
END $$;

-- 6. Revocar acceso anónimo directo sobre usuarios_sistema
REVOKE ALL ON TABLE public.usuarios_sistema FROM anon;
