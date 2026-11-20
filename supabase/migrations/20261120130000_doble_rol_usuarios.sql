-- =============================================================================
-- Migración: Soporte de Doble Rol (roles_adicionales_json) en usuarios_sistema
-- Fecha: 2026-11-20
-- Permite asignar roles secundarios de nivel central (ej. asesor_uatp + gdp_validador).
-- =============================================================================

ALTER TABLE public.usuarios_sistema
  ADD COLUMN IF NOT EXISTS roles_adicionales_json JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.is_nivel_central_movilidad()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_sistema u
    WHERE u.auth_uid = (SELECT auth.uid())
      AND u.activo = TRUE
      AND (
        u.role IN ('super_usuario', 'subdirector_uatp', 'coordinador_uatp', 'asesor_uatp', 'gdp_validador', 'admin', 'auditor')
        OR (
          u.role NOT IN ('director_establecimiento', 'jefe_utp_establecimiento', 'director_colegio', 'director')
          AND jsonb_typeof(u.roles_adicionales_json) = 'array'
          AND u.roles_adicionales_json ?| ARRAY['super_usuario', 'subdirector_uatp', 'coordinador_uatp', 'asesor_uatp', 'gdp_validador']
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_validador_gdp_o_superior()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_sistema u
    WHERE u.auth_uid = (SELECT auth.uid())
      AND u.activo = TRUE
      AND (
        u.role IN ('super_usuario', 'subdirector_uatp', 'gdp_validador', 'admin')
        OR (
          u.role NOT IN ('director_establecimiento', 'jefe_utp_establecimiento', 'director_colegio', 'director')
          AND jsonb_typeof(u.roles_adicionales_json) = 'array'
          AND u.roles_adicionales_json ?| ARRAY['super_usuario', 'subdirector_uatp', 'gdp_validador']
        )
      )
  );
$$;
