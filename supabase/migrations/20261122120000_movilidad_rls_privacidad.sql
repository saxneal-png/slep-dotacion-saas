-- =============================================================================
-- Migración: Privacidad y RLS estricto para Mesa de Movilidad (Workstream A / C3)
-- Fecha: 2026-11-22
-- Descripción:
--   1. Crea public.is_editor_movilidad() excluyendo 'auditor' y 'visualizador'.
--   2. Crea public.puede_ver_solicitud_movilidad(p_rbd_origen, p_rbd_destino)
--      para acotar visibilidad de solicitudes por cartera RBD en asesores/coordinadores.
--   3. Reemplaza rls_all_solicitudes_movilidad por 4 políticas granulares.
--   4. Reemplaza rls_all_propuestas_calce por 4 políticas granulares.
--   5. Actualiza rls_insert_escenarios_calce y rls_update_escenarios_calce
--      exigiendo is_editor_movilidad() en lugar de is_nivel_central_movilidad().
-- 100% idempotente y segura para PostgreSQL 17 / Supabase.
-- =============================================================================

-- 1. Función SECURITY DEFINER: Editor de Movilidad (excluye 'auditor' y 'visualizador')
CREATE OR REPLACE FUNCTION public.is_editor_movilidad()
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
        u.role IN ('super_usuario', 'subdirector_uatp', 'coordinador_uatp', 'asesor_uatp', 'gdp_validador', 'admin')
        OR (
          u.role NOT IN ('director_establecimiento', 'jefe_utp_establecimiento', 'director_colegio', 'director')
          AND jsonb_typeof(u.roles_adicionales_json) = 'array'
          AND u.roles_adicionales_json ?| ARRAY['super_usuario', 'subdirector_uatp', 'coordinador_uatp', 'asesor_uatp', 'gdp_validador']
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_editor_movilidad() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_editor_movilidad() TO authenticated;

-- 2. Función SECURITY DEFINER: Visibilidad de solicitudes de movilidad por rol y cartera RBD
CREATE OR REPLACE FUNCTION public.puede_ver_solicitud_movilidad(
  p_rbd_origen TEXT,
  p_rbd_destino TEXT
)
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
        (
          u.role IN ('super_usuario', 'subdirector_uatp', 'gdp_validador', 'admin', 'auditor')
          OR (
            u.role NOT IN ('director_establecimiento', 'jefe_utp_establecimiento', 'director_colegio', 'director')
            AND jsonb_typeof(u.roles_adicionales_json) = 'array'
            AND u.roles_adicionales_json ?| ARRAY['super_usuario', 'subdirector_uatp', 'gdp_validador', 'admin', 'auditor']
          )
        )
        OR (
          (
            u.role IN ('asesor_uatp', 'coordinador_uatp', 'asesor')
            OR (
              u.role NOT IN ('director_establecimiento', 'jefe_utp_establecimiento', 'director_colegio', 'director')
              AND jsonb_typeof(u.roles_adicionales_json) = 'array'
              AND u.roles_adicionales_json ?| ARRAY['asesor_uatp', 'coordinador_uatp', 'asesor']
            )
          )
          AND (
            public.can_access_rbd(p_rbd_origen)
            OR (p_rbd_destino IS NOT NULL AND public.can_access_rbd(p_rbd_destino))
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.puede_ver_solicitud_movilidad(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_ver_solicitud_movilidad(TEXT, TEXT) TO authenticated;

-- 3. Políticas granulares en public.solicitudes_movilidad
DROP POLICY IF EXISTS "rls_all_solicitudes_movilidad" ON public.solicitudes_movilidad;
DROP POLICY IF EXISTS "rls_select_solicitudes_movilidad" ON public.solicitudes_movilidad;
DROP POLICY IF EXISTS "rls_insert_solicitudes_movilidad" ON public.solicitudes_movilidad;
DROP POLICY IF EXISTS "rls_update_solicitudes_movilidad" ON public.solicitudes_movilidad;
DROP POLICY IF EXISTS "rls_delete_solicitudes_movilidad" ON public.solicitudes_movilidad;

CREATE POLICY "rls_select_solicitudes_movilidad" ON public.solicitudes_movilidad
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_nivel_central_movilidad())
    AND (SELECT public.puede_ver_solicitud_movilidad(rbd_origen, rbd_destino_preferente))
  );

CREATE POLICY "rls_insert_solicitudes_movilidad" ON public.solicitudes_movilidad
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_editor_movilidad()));

CREATE POLICY "rls_update_solicitudes_movilidad" ON public.solicitudes_movilidad
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor_movilidad()))
  WITH CHECK ((SELECT public.is_editor_movilidad()));

CREATE POLICY "rls_delete_solicitudes_movilidad" ON public.solicitudes_movilidad
  FOR DELETE TO authenticated
  USING ((SELECT public.is_editor_movilidad()));

-- 4. Políticas granulares en public.propuestas_calce
DROP POLICY IF EXISTS "rls_all_propuestas_calce" ON public.propuestas_calce;
DROP POLICY IF EXISTS "rls_select_propuestas_calce" ON public.propuestas_calce;
DROP POLICY IF EXISTS "rls_insert_propuestas_calce" ON public.propuestas_calce;
DROP POLICY IF EXISTS "rls_update_propuestas_calce" ON public.propuestas_calce;
DROP POLICY IF EXISTS "rls_delete_propuestas_calce" ON public.propuestas_calce;

CREATE POLICY "rls_select_propuestas_calce" ON public.propuestas_calce
  FOR SELECT TO authenticated
  USING ((SELECT public.is_nivel_central_movilidad()));

CREATE POLICY "rls_insert_propuestas_calce" ON public.propuestas_calce
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_editor_movilidad()));

CREATE POLICY "rls_update_propuestas_calce" ON public.propuestas_calce
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor_movilidad()))
  WITH CHECK ((SELECT public.is_editor_movilidad()));

CREATE POLICY "rls_delete_propuestas_calce" ON public.propuestas_calce
  FOR DELETE TO authenticated
  USING ((SELECT public.is_editor_movilidad()));

-- 5. Políticas de escritura en public.escenarios_calce (usando is_editor_movilidad)
DROP POLICY IF EXISTS "rls_insert_escenarios_calce" ON public.escenarios_calce;
CREATE POLICY "rls_insert_escenarios_calce" ON public.escenarios_calce
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_editor_movilidad()));

DROP POLICY IF EXISTS "rls_update_escenarios_calce" ON public.escenarios_calce;
CREATE POLICY "rls_update_escenarios_calce" ON public.escenarios_calce
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_editor_movilidad())
    AND (
      estado NOT IN ('CONSOLIDADO', 'RESOLUCION_EMITIDA')
      OR (SELECT public.is_consolidator_movilidad())
      OR (
        estado IN ('CONSOLIDADO', 'RESOLUCION_EMITIDA')
        AND (SELECT public.is_validador_gdp_o_superior())
      )
    )
  )
  WITH CHECK (
    (SELECT public.is_editor_movilidad())
    AND (
      (
        COALESCE((SELECT public.get_escenario_estado_actual(id)), '') NOT IN ('CONSOLIDADO', 'RESOLUCION_EMITIDA')
        AND (
          estado NOT IN ('CONSOLIDADO', 'RESOLUCION_EMITIDA')
          OR (estado = 'CONSOLIDADO' AND (SELECT public.is_consolidator_movilidad()))
          OR (
            estado = 'RESOLUCION_EMITIDA'
            AND (
              (SELECT public.is_consolidator_movilidad())
              OR (SELECT public.is_validador_gdp_o_superior())
            )
          )
        )
      )
      OR (
        COALESCE((SELECT public.get_escenario_estado_actual(id)), '') IN ('CONSOLIDADO', 'RESOLUCION_EMITIDA')
        AND (
          (SELECT public.is_consolidator_movilidad())
          OR (estado = 'RESOLUCION_EMITIDA' AND (SELECT public.is_validador_gdp_o_superior()))
        )
      )
    )
  );
