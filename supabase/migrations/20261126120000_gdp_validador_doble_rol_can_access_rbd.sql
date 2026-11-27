-- =============================================================================
-- Migración: Soporte de Doble Rol en public.can_access_rbd(target_rbd)
-- Fecha: 2026-11-26
-- Autocontenida e idempotente: asegura auth_uid y roles_adicionales_json en
-- public.usuarios_sistema antes de crear/reemplazar public.can_access_rbd.
-- =============================================================================

ALTER TABLE public.usuarios_sistema
  ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS roles_adicionales_json JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_usuarios_auth_uid ON public.usuarios_sistema(auth_uid);

UPDATE public.usuarios_sistema u
SET auth_uid = a.id
FROM auth.users a
WHERE u.auth_uid IS NULL
  AND a.email_confirmed_at IS NOT NULL
  AND lower(trim(u.email)) = lower(trim(a.email));

CREATE OR REPLACE FUNCTION public.can_access_rbd(target_rbd TEXT)
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
        u.role IN ('super_usuario', 'subdirector_uatp', 'gdp_validador', 'admin', 'auditor', 'visualizador')
        OR (
          u.role NOT IN ('director_establecimiento', 'jefe_utp_establecimiento', 'director_colegio', 'director')
          AND jsonb_typeof(u.roles_adicionales_json) = 'array'
          AND u.roles_adicionales_json ?| ARRAY['super_usuario', 'subdirector_uatp', 'gdp_validador']
        )
        OR (
          u.role IN ('director_establecimiento', 'jefe_utp_establecimiento', 'director_colegio', 'director')
          AND u.rbd_asignado = target_rbd
        )
        OR (
          u.role IN ('asesor_uatp', 'asesor') AND (
            (jsonb_typeof(u.cartera_rbds_json) = 'array' AND u.cartera_rbds_json ? target_rbd)
            OR EXISTS (
              SELECT 1 FROM public.asesor_cartera ac
              WHERE ac.usuario_id = u.id AND ac.rbd = target_rbd
            )
          )
        )
        OR (
          u.role = 'coordinador_uatp' AND (
            (jsonb_typeof(u.cartera_rbds_json) = 'array' AND u.cartera_rbds_json ? target_rbd)
            OR EXISTS (
              SELECT 1 FROM public.asesor_cartera ac
              WHERE ac.usuario_id = u.id AND ac.rbd = target_rbd
            )
            OR EXISTS (
              SELECT 1 FROM public.usuarios_sistema sup
              WHERE (
                jsonb_typeof(u.asesores_supervisados_json) = 'array' AND u.asesores_supervisados_json ? sup.id
              )
              AND (
                (jsonb_typeof(sup.cartera_rbds_json) = 'array' AND sup.cartera_rbds_json ? target_rbd)
                OR EXISTS (SELECT 1 FROM public.asesor_cartera ac2 WHERE ac2.usuario_id = sup.id AND ac2.rbd = target_rbd)
              )
            )
          )
        )
      )
  );
$$;
