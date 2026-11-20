-- =============================================================================
-- Migración: Mesa de Movilidad Territorial, Egresos de Contingencia y Vacantes NN
-- Fecha: 2026-11-20
-- Idempotente y autocontenida para PostgreSQL / Supabase
-- =============================================================================

-- 0. Asegurar función trigger set_updated_at()
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- 1. Actualizar constraint de roles en usuarios_sistema incluyendo 'gdp_validador'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'usuarios_sistema'
  ) THEN
    ALTER TABLE public.usuarios_sistema
      DROP CONSTRAINT IF EXISTS usuarios_sistema_role_check;

    ALTER TABLE public.usuarios_sistema
      ADD CONSTRAINT usuarios_sistema_role_check CHECK (
        role IN (
          'super_usuario',
          'subdirector_uatp',
          'coordinador_uatp',
          'asesor_uatp',
          'gdp_validador',
          'director_establecimiento',
          'jefe_utp_establecimiento',
          'admin',
          'asesor',
          'director_colegio',
          'director',
          'auditor',
          'visualizador'
        )
      );
  END IF;
END $$;

-- 2. Columnas de Vacantes NN / Contingencia en docentes y Feature Flags en configuracion_general
ALTER TABLE public.docentes
  ADD COLUMN IF NOT EXISTS es_vacante_nn BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tipo_vacante TEXT,
  ADD COLUMN IF NOT EXISTS justificacion_vacante TEXT,
  ADD COLUMN IF NOT EXISTS origen_egreso_id TEXT,
  ADD COLUMN IF NOT EXISTS vacante_condicional BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_docentes_vacante_nn
  ON public.docentes(es_vacante_nn, rbd, periodo);

ALTER TABLE public.configuracion_general
  ADD COLUMN IF NOT EXISTS feature_flags_json JSONB NOT NULL DEFAULT '{"modulo_movilidad_activo":true,"flag_saneamiento_nn_escuelas":true,"flag_egresos_contingencia":true,"flag_traslados_voluntarios":true,"flag_no_continuidad_titulares":true,"flag_simulador_calce_automatico":true}'::jsonb;

INSERT INTO public.configuracion_general (id, feature_flags_json)
VALUES (
  'global',
  '{"modulo_movilidad_activo":true,"flag_saneamiento_nn_escuelas":true,"flag_egresos_contingencia":true,"flag_traslados_voluntarios":true,"flag_no_continuidad_titulares":true,"flag_simulador_calce_automatico":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 3. Tablas de Mesa de Movilidad y Egresos Proyectados
CREATE TABLE IF NOT EXISTS public.egresos_proyectados (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  periodo INTEGER NOT NULL DEFAULT 2027,
  docente_id TEXT NOT NULL,
  run_docente TEXT NOT NULL,
  nombre_docente TEXT NOT NULL,
  asignatura_principal TEXT,
  horas_liberadas INTEGER NOT NULL DEFAULT 0,
  horas_aula_liberadas INTEGER NOT NULL DEFAULT 0,
  fuente_financiamiento TEXT NOT NULL DEFAULT 'SUBVENCION_GENERAL',
  calidad_juridica TEXT NOT NULL DEFAULT 'TITULAR',
  causal TEXT NOT NULL,
  certeza TEXT NOT NULL DEFAULT 'en_tramite',
  excepcion_jubilacion_3_anios BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_cese TEXT,
  numero_decreto TEXT,
  impacto_presupuestario TEXT NOT NULL DEFAULT 'costo_doble_pendiente',
  vacante_docente_id TEXT,
  validado_por TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS trg_egresos_proyectados_updated_at ON public.egresos_proyectados;
CREATE TRIGGER trg_egresos_proyectados_updated_at
  BEFORE UPDATE ON public.egresos_proyectados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_egresos_proyectados_rbd_periodo
  ON public.egresos_proyectados(rbd, periodo);
CREATE INDEX IF NOT EXISTS idx_egresos_proyectados_docente
  ON public.egresos_proyectados(docente_id, periodo);

CREATE TABLE IF NOT EXISTS public.solicitudes_movilidad (
  id TEXT PRIMARY KEY,
  periodo INTEGER NOT NULL DEFAULT 2027,
  carril TEXT NOT NULL,
  docente_id TEXT NOT NULL,
  run_docente TEXT NOT NULL,
  nombre_docente TEXT NOT NULL,
  rbd_origen TEXT NOT NULL,
  comuna_origen TEXT,
  rbd_destino_preferente TEXT,
  comuna_destino_preferente TEXT,
  calidad_juridica TEXT NOT NULL DEFAULT 'TITULAR',
  horas_contrato_actual INTEGER NOT NULL DEFAULT 0,
  horas_titulares_actuales INTEGER NOT NULL DEFAULT 0,
  horas_disponibles_mover INTEGER NOT NULL DEFAULT 0,
  horas_remanentes INTEGER NOT NULL DEFAULT 0,
  asignatura_principal TEXT,
  titulo_mencion TEXT,
  aplica_articulo_69 BOOLEAN NOT NULL DEFAULT FALSE,
  fuente_actual TEXT NOT NULL DEFAULT 'SUBVENCION_GENERAL',
  estado_flujo TEXT NOT NULL DEFAULT 'POSTULADO',
  puntaje_salud NUMERIC(8,2) NOT NULL DEFAULT 0,
  puntaje_ley_karin NUMERIC(8,2) NOT NULL DEFAULT 0,
  puntaje_cuidado_dependientes NUMERIC(8,2) NOT NULL DEFAULT 0,
  puntaje_distancia_rural NUMERIC(8,2) NOT NULL DEFAULT 0,
  puntaje_antiguedad NUMERIC(8,2) NOT NULL DEFAULT 0,
  puntaje_prioridad_total NUMERIC(8,2) NOT NULL DEFAULT 0,
  fundamento TEXT,
  creado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS trg_solicitudes_movilidad_updated_at ON public.solicitudes_movilidad;
CREATE TRIGGER trg_solicitudes_movilidad_updated_at
  BEFORE UPDATE ON public.solicitudes_movilidad
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_solicitudes_movilidad_periodo_estado
  ON public.solicitudes_movilidad(periodo, carril, estado_flujo);
CREATE INDEX IF NOT EXISTS idx_solicitudes_movilidad_docente
  ON public.solicitudes_movilidad(docente_id, periodo);

CREATE TABLE IF NOT EXISTS public.escenarios_calce (
  id TEXT PRIMARY KEY,
  periodo INTEGER NOT NULL DEFAULT 2027,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT NOT NULL DEFAULT 'BORRADOR',
  creado_por TEXT,
  aprobado_por TEXT,
  consolidado_por TEXT,
  fecha_consolidacion TEXT,
  resumen_metricas_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS trg_escenarios_calce_updated_at ON public.escenarios_calce;
CREATE TRIGGER trg_escenarios_calce_updated_at
  BEFORE UPDATE ON public.escenarios_calce
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_escenarios_calce_periodo_estado
  ON public.escenarios_calce(periodo, estado);

CREATE TABLE IF NOT EXISTS public.propuestas_calce (
  id TEXT PRIMARY KEY,
  escenario_id TEXT NOT NULL REFERENCES public.escenarios_calce(id) ON DELETE CASCADE,
  periodo INTEGER NOT NULL DEFAULT 2027,
  solicitud_movilidad_id TEXT,
  docente_origen_id TEXT NOT NULL,
  run_docente TEXT NOT NULL,
  nombre_docente TEXT NOT NULL,
  rbd_origen TEXT NOT NULL,
  rbd_destino TEXT NOT NULL,
  vacante_destino_id TEXT,
  egreso_origen_id TEXT,
  tipo_cobertura TEXT NOT NULL DEFAULT 'DEFINITIVA',
  horas_asignadas INTEGER NOT NULL DEFAULT 0,
  minutos_asignados INTEGER NOT NULL DEFAULT 0,
  horas_pedagogicas_aula INTEGER NOT NULL DEFAULT 0,
  fuente_destino TEXT NOT NULL DEFAULT 'SUBVENCION_GENERAL',
  indice_compatibilidad INTEGER NOT NULL DEFAULT 0,
  genera_rebote BOOLEAN NOT NULL DEFAULT FALSE,
  vacante_rebote_json JSONB,
  alertas_normativas_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  bloquea_consolidacion BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_bloqueo TEXT,
  estado TEXT NOT NULL DEFAULT 'PROPUESTA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS trg_propuestas_calce_updated_at ON public.propuestas_calce;
CREATE TRIGGER trg_propuestas_calce_updated_at
  BEFORE UPDATE ON public.propuestas_calce
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_propuestas_calce_escenario
  ON public.propuestas_calce(escenario_id);
CREATE INDEX IF NOT EXISTS idx_propuestas_calce_rbd_destino
  ON public.propuestas_calce(rbd_destino, periodo);

-- 4. Funciones SECURITY DEFINER para aislamiento estricto de Nivel Central (con cacheo (SELECT auth.uid()))
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
      AND u.role IN (
        'super_usuario',
        'subdirector_uatp',
        'coordinador_uatp',
        'asesor_uatp',
        'gdp_validador',
        'admin',
        'auditor'
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
      AND u.role IN (
        'super_usuario',
        'subdirector_uatp',
        'gdp_validador',
        'admin'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_consolidator_movilidad()
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
      AND u.role IN (
        'super_usuario',
        'subdirector_uatp',
        'admin'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_nivel_central_movilidad() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_nivel_central_movilidad() TO authenticated;

REVOKE ALL ON FUNCTION public.is_validador_gdp_o_superior() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_validador_gdp_o_superior() TO authenticated;

REVOKE ALL ON FUNCTION public.is_consolidator_movilidad() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_consolidator_movilidad() TO authenticated;

-- 5. Actualizar public.can_access_rbd incluyendo 'gdp_validador' en acceso global de lectura
CREATE OR REPLACE FUNCTION public.can_access_rbd(target_rbd TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.current_slep_user() u
    WHERE u.activo = TRUE
      AND (
        u.role IN ('super_usuario', 'subdirector_uatp', 'gdp_validador', 'admin', 'auditor', 'visualizador')
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
                (jsonb_typeof(u.asesores_supervisados_json) = 'array' AND u.asesores_supervisados_json ? sup.id)
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

-- 6. Habilitar y forzar RLS en las 4 nuevas tablas + revocar anon
ALTER TABLE public.egresos_proyectados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egresos_proyectados FORCE ROW LEVEL SECURITY;

ALTER TABLE public.solicitudes_movilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_movilidad FORCE ROW LEVEL SECURITY;

ALTER TABLE public.escenarios_calce ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escenarios_calce FORCE ROW LEVEL SECURITY;

ALTER TABLE public.propuestas_calce ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propuestas_calce FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.egresos_proyectados FROM anon;
REVOKE ALL ON TABLE public.solicitudes_movilidad FROM anon;
REVOKE ALL ON TABLE public.escenarios_calce FROM anon;
REVOKE ALL ON TABLE public.propuestas_calce FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.egresos_proyectados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.solicitudes_movilidad TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.escenarios_calce TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.propuestas_calce TO authenticated;

-- 7. Políticas RLS (director_establecimiento y jefe_utp_establecimiento quedan 100% bloqueados)
DROP POLICY IF EXISTS "rls_select_egresos_proyectados" ON public.egresos_proyectados;
DROP POLICY IF EXISTS "rls_insert_egresos_proyectados" ON public.egresos_proyectados;
DROP POLICY IF EXISTS "rls_update_egresos_proyectados" ON public.egresos_proyectados;
DROP POLICY IF EXISTS "rls_delete_egresos_proyectados" ON public.egresos_proyectados;

CREATE POLICY "rls_select_egresos_proyectados" ON public.egresos_proyectados
  FOR SELECT TO authenticated
  USING ((SELECT public.is_nivel_central_movilidad()));

CREATE POLICY "rls_insert_egresos_proyectados" ON public.egresos_proyectados
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_validador_gdp_o_superior()));

CREATE POLICY "rls_update_egresos_proyectados" ON public.egresos_proyectados
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_validador_gdp_o_superior()))
  WITH CHECK ((SELECT public.is_validador_gdp_o_superior()));

CREATE POLICY "rls_delete_egresos_proyectados" ON public.egresos_proyectados
  FOR DELETE TO authenticated
  USING ((SELECT public.is_validador_gdp_o_superior()));

DROP POLICY IF EXISTS "rls_all_solicitudes_movilidad" ON public.solicitudes_movilidad;
CREATE POLICY "rls_all_solicitudes_movilidad" ON public.solicitudes_movilidad
  FOR ALL TO authenticated
  USING ((SELECT public.is_nivel_central_movilidad()))
  WITH CHECK ((SELECT public.is_nivel_central_movilidad()));

DROP POLICY IF EXISTS "rls_select_escenarios_calce" ON public.escenarios_calce;
DROP POLICY IF EXISTS "rls_insert_escenarios_calce" ON public.escenarios_calce;
DROP POLICY IF EXISTS "rls_update_escenarios_calce" ON public.escenarios_calce;
DROP POLICY IF EXISTS "rls_delete_escenarios_calce" ON public.escenarios_calce;

CREATE POLICY "rls_select_escenarios_calce" ON public.escenarios_calce
  FOR SELECT TO authenticated
  USING ((SELECT public.is_nivel_central_movilidad()));

CREATE POLICY "rls_insert_escenarios_calce" ON public.escenarios_calce
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_nivel_central_movilidad()));

CREATE POLICY "rls_update_escenarios_calce" ON public.escenarios_calce
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_nivel_central_movilidad())
    AND (estado <> 'CONSOLIDADO' OR (SELECT public.is_consolidator_movilidad()))
  )
  WITH CHECK (
    (SELECT public.is_nivel_central_movilidad())
    AND (estado <> 'CONSOLIDADO' OR (SELECT public.is_consolidator_movilidad()))
  );

CREATE POLICY "rls_delete_escenarios_calce" ON public.escenarios_calce
  FOR DELETE TO authenticated
  USING ((SELECT public.is_consolidator_movilidad()));

DROP POLICY IF EXISTS "rls_all_propuestas_calce" ON public.propuestas_calce;
CREATE POLICY "rls_all_propuestas_calce" ON public.propuestas_calce
  FOR ALL TO authenticated
  USING ((SELECT public.is_nivel_central_movilidad()))
  WITH CHECK ((SELECT public.is_nivel_central_movilidad()));

-- 8. Actualizar política de escritura en public.configuracion_general
ALTER TABLE public.configuracion_general ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir insert/update/delete en configuracion_general" ON public.configuracion_general;
DROP POLICY IF EXISTS "rls_write_configuracion_general" ON public.configuracion_general;
CREATE POLICY "rls_write_configuracion_general" ON public.configuracion_general
  FOR ALL TO authenticated
  USING (
    (SELECT public.is_slep_admin())
    OR (id = 'global' AND (SELECT public.is_consolidator_movilidad()))
  )
  WITH CHECK (
    (SELECT public.is_slep_admin())
    OR (id = 'global' AND (SELECT public.is_consolidator_movilidad()))
  );
