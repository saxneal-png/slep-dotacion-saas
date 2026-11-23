-- =============================================================================
-- Migración aditiva (100% no destructiva):
-- Tabla solicitudes_movimiento_dotacion para gestionar aumentos/disminuciones
-- de horas, no continuidad, contratos nuevos, cambios de fuente y Art. 69.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.solicitudes_movimiento_dotacion (
  id TEXT PRIMARY KEY,
  periodo INTEGER NOT NULL DEFAULT 2027,
  rbd TEXT NOT NULL,
  nombre_establecimiento TEXT,
  comuna TEXT,
  entidad_tipo TEXT NOT NULL,
  funcionario_id TEXT NOT NULL,
  run_funcionario TEXT NOT NULL,
  nombre_funcionario TEXT NOT NULL,
  calidad_juridica TEXT,
  cargo_o_asignatura TEXT,
  tipo_movimiento TEXT NOT NULL,
  propuesta_gdp_origen TEXT,
  horas_vigentes NUMERIC NOT NULL DEFAULT 0,
  horas_solicitadas NUMERIC NOT NULL DEFAULT 0,
  delta_horas NUMERIC NOT NULL DEFAULT 0,
  aplica_articulo_69_previo BOOLEAN DEFAULT FALSE,
  aplica_articulo_69_solicitado BOOLEAN DEFAULT FALSE,
  fuentes_actuales_json JSONB,
  fuentes_solicitadas_json JSONB,
  remuneracion_mensual_estimada NUMERIC DEFAULT 0,
  accion_pme TEXT,
  justificacion_escuela TEXT NOT NULL,
  estado_revision TEXT NOT NULL DEFAULT 'PENDIENTE',
  horas_aprobadas NUMERIC,
  visado_uatp_por TEXT,
  fecha_visacion_uatp TIMESTAMPTZ,
  observacion_uatp TEXT,
  sancionado_gdp_por TEXT,
  rol_sancionador TEXT,
  fecha_sancion_gdp TIMESTAMPTZ,
  observacion_sancion TEXT,
  aplicado_a_nomina BOOLEAN DEFAULT FALSE,
  solicitud_movilidad_id TEXT,
  creado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sol_mov_dot_periodo_estado
  ON public.solicitudes_movimiento_dotacion (periodo, estado_revision);

CREATE INDEX IF NOT EXISTS idx_sol_mov_dot_rbd_func
  ON public.solicitudes_movimiento_dotacion (rbd, funcionario_id, periodo);

ALTER TABLE public.solicitudes_movimiento_dotacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_select_sol_mov_dot ON public.solicitudes_movimiento_dotacion;
CREATE POLICY rls_select_sol_mov_dot
  ON public.solicitudes_movimiento_dotacion
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_rbd(rbd)
    OR public.is_nivel_central_movilidad()
  );

DROP POLICY IF EXISTS rls_insert_sol_mov_dot ON public.solicitudes_movimiento_dotacion;
CREATE POLICY rls_insert_sol_mov_dot
  ON public.solicitudes_movimiento_dotacion
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_rbd(rbd)
    OR public.is_editor_movilidad()
  );

DROP POLICY IF EXISTS rls_update_sol_mov_dot ON public.solicitudes_movimiento_dotacion;
CREATE POLICY rls_update_sol_mov_dot
  ON public.solicitudes_movimiento_dotacion
  FOR UPDATE
  TO authenticated
  USING (
    public.can_access_rbd(rbd)
    OR public.is_editor_movilidad()
  )
  WITH CHECK (
    public.can_access_rbd(rbd)
    OR public.is_editor_movilidad()
  );

DROP POLICY IF EXISTS rls_delete_sol_mov_dot ON public.solicitudes_movimiento_dotacion;
CREATE POLICY rls_delete_sol_mov_dot
  ON public.solicitudes_movimiento_dotacion
  FOR DELETE
  TO authenticated
  USING (public.is_editor_movilidad());
