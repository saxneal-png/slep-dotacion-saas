-- =============================================================================
-- Migración: Hardening Mesa de Movilidad Territorial (Fases 1, 2 y 3)
-- Fecha: 2026-11-20
-- Descripción:
--   1. Agrega columnas normativas/operativas en establecimientos, docentes,
--      egresos_proyectados, solicitudes_movilidad, escenarios_calce y propuestas_calce.
--   2. Actualiza public.is_consolidator_movilidad() para soportar doble rol
--      (roles_adicionales_json) excluyendo roles de establecimiento.
--   3. Actualiza política rls_update_escenarios_calce permitiendo que
--      is_validador_gdp_o_superior() registre RESOLUCION_EMITIDA sobre escenarios
--      CONSOLIDADO / RESOLUCION_EMITIDA, bloqueando cualquier otro cambio.
--   4. Crea el RPC transaccional atómico public.consolidar_escenario_movilidad_rpc()
--      con lock pesimista, control optimista de versión, validaciones servidor y
--      preservación estricta de horas Titulares vs Contrata / Indefinido vs Plazo Fijo.
-- 100% idempotente y segura para PostgreSQL 17 / Supabase.
-- =============================================================================

-- 0. Asegurar columna roles_adicionales_json en usuarios_sistema (idempotente)
ALTER TABLE public.usuarios_sistema
  ADD COLUMN IF NOT EXISTS roles_adicionales_json JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 1. Columnas nuevas Fases 1, 2 y 3
ALTER TABLE public.establecimientos
  ADD COLUMN IF NOT EXISTS accesibilidad TEXT DEFAULT 'urbano',
  ADD COLUMN IF NOT EXISTS condiciones_dificiles_pct NUMERIC(5,2) DEFAULT 0;

ALTER TABLE public.docentes
  ADD COLUMN IF NOT EXISTS tramo_carrera_docente TEXT,
  ADD COLUMN IF NOT EXISTS habilitacion_seremi_rbd TEXT,
  ADD COLUMN IF NOT EXISTS habilitacion_seremi_asignatura TEXT;

ALTER TABLE public.egresos_proyectados
  ADD COLUMN IF NOT EXISTS cpeip_notificacion_firme BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS estado_reversion TEXT NOT NULL DEFAULT 'ACTIVO',
  ADD COLUMN IF NOT EXISTS motivo_reversion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_reversion TEXT,
  ADD COLUMN IF NOT EXISTS revertido_por TEXT;

ALTER TABLE public.solicitudes_movilidad
  ADD COLUMN IF NOT EXISTS estamento_personal TEXT NOT NULL DEFAULT 'DOCENTE',
  ADD COLUMN IF NOT EXISTS categoria_asistente TEXT,
  ADD COLUMN IF NOT EXISTS horas_contrata_actuales INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS numero_resolucion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_resolucion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vigencia TEXT;

ALTER TABLE public.escenarios_calce
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS numero_resolucion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_resolucion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vigencia TEXT;

ALTER TABLE public.propuestas_calce
  ADD COLUMN IF NOT EXISTS estamento_personal TEXT NOT NULL DEFAULT 'DOCENTE',
  ADD COLUMN IF NOT EXISTS estado_resolucion_rebote TEXT NOT NULL DEFAULT 'NO_APLICA',
  ADD COLUMN IF NOT EXISTS rebote_cubierto_por_propuesta_id TEXT,
  ADD COLUMN IF NOT EXISTS minutos_titulares_origen INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutos_contrata_origen INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alerta_menoscabo_art50 BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alerta_condiciones_dificiles BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alerta_habilitacion_seremi_dto352 BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alerta_itinerancia_rural BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS numero_resolucion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_resolucion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vigencia TEXT;

CREATE INDEX IF NOT EXISTS idx_propuestas_calce_rebote_estado
  ON public.propuestas_calce(escenario_id, genera_rebote, estado_resolucion_rebote);

-- 2. Actualizar is_consolidator_movilidad() contemplando doble rol (roles_adicionales_json)
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
      AND (
        u.role IN ('super_usuario', 'subdirector_uatp', 'admin')
        OR (
          u.role NOT IN ('director_establecimiento', 'jefe_utp_establecimiento', 'director_colegio', 'director')
          AND jsonb_typeof(u.roles_adicionales_json) = 'array'
          AND u.roles_adicionales_json ?| ARRAY['super_usuario', 'subdirector_uatp', 'admin']
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_consolidator_movilidad() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_consolidator_movilidad() TO authenticated;

-- 3. Helper seguro para consultar estado actual del escenario sin recursión RLS
CREATE OR REPLACE FUNCTION public.get_escenario_estado_actual(p_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT estado
  FROM public.escenarios_calce
  WHERE id = p_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_escenario_estado_actual(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_escenario_estado_actual(TEXT) TO authenticated;

-- 4. Política RLS rls_update_escenarios_calce
DROP POLICY IF EXISTS "rls_update_escenarios_calce" ON public.escenarios_calce;
CREATE POLICY "rls_update_escenarios_calce" ON public.escenarios_calce
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_nivel_central_movilidad())
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
    (SELECT public.is_nivel_central_movilidad())
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

-- 5. RPC Transaccional Atómico de Consolidación de Escenario de Movilidad
CREATE OR REPLACE FUNCTION public.consolidar_escenario_movilidad_rpc(
  p_escenario_id TEXT,
  p_expected_version INTEGER,
  p_usuario_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_esc public.escenarios_calce%ROWTYPE;
  v_prop RECORD;
  v_sol public.solicitudes_movilidad%ROWTYPE;
  v_doc_orig public.docentes%ROWTYPE;
  v_doc_dest public.docentes%ROWTYPE;
  v_ast_orig public.asistentes_educacion%ROWTYPE;
  v_ast_dest public.asistentes_educacion%ROWTYPE;
  v_periodo INTEGER;
  v_now_ts TIMESTAMPTZ := timezone('utc'::text, now());
  v_now_txt TEXT;
  v_actor TEXT;
  v_actor_uid TEXT;
  v_new_version INTEGER;
  v_total_propuestas INTEGER := 0;
  v_bloqueos_txt TEXT;
  v_dup_vacante TEXT;
  v_dup_origen TEXT;
  v_rebotes_pendientes INTEGER := 0;
  v_propuestas_consolidadas INTEGER := 0;
  v_vacantes_reemplazadas INTEGER := 0;
  v_rebotes_creados INTEGER := 0;
  v_rbds_afectados TEXT[] := ARRAY[]::TEXT[];
  v_rbd_item TEXT;
  v_rebote_by_propuesta JSONB := '{}'::jsonb;

  -- Variables cálculo docente
  v_target_vacante_id TEXT;
  v_sum_tit_db NUMERIC(8,2);
  v_sum_con_db NUMERIC(8,2);
  v_horas_titulares_origen NUMERIC(8,2);
  v_horas_dest NUMERIC(8,2);
  v_horas_titular_dest NUMERIC(8,2);
  v_horas_contrata_dest NUMERIC(8,2);
  v_calidad_dest TEXT;
  v_fuente_dest TEXT;
  v_reb JSONB;
  v_rebote_id TEXT;
  v_rebote_run TEXT;
  v_horas_reb INTEGER;
  v_fuente_reb TEXT;
  v_asig_reb TEXT;
  v_horas_aula_reb INTEGER;
  v_funciones_reb JSONB;

  -- Variables cálculo asistente
  v_sum_indef_db NUMERIC(8,2);
  v_horas_indef_origen NUMERIC(8,2);
  v_horas_dest_ast NUMERIC(8,2);
  v_horas_indef_dest NUMERIC(8,2);
  v_horas_pf_dest NUMERIC(8,2);
  v_target_ast_id TEXT;
  v_ast_dest_found BOOLEAN;
  v_fuente_orig_ast TEXT;
  v_horas_reb_ast NUMERIC(8,2);
  v_rem_ast NUMERIC(8,2);
  v_d_sg_pf NUMERIC(8,2);
  v_d_sep_pf NUMERIC(8,2);
  v_d_pie_pf NUMERIC(8,2);
  v_d_sg_in NUMERIC(8,2);
  v_d_sep_in NUMERIC(8,2);
  v_d_pie_in NUMERIC(8,2);
BEGIN
  -- 1. Verificación estricta de autorización
  IF NOT public.is_consolidator_movilidad() THEN
    RAISE EXCEPTION 'Acceso denegado: solo Super Usuario o Subdirector UATP pueden consolidar escenarios de movilidad.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Lock pesimista sobre el escenario
  SELECT *
  INTO v_esc
  FROM public.escenarios_calce
  WHERE id = p_escenario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escenario ''%'' no encontrado.', p_escenario_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_esc.estado IN ('CONSOLIDADO', 'RESOLUCION_EMITIDA') THEN
    RAISE EXCEPTION 'El escenario ''%'' ya fue consolidado o emitido (%).', v_esc.nombre, v_esc.estado;
  END IF;

  -- 3. Control optimista de versión
  IF p_expected_version IS NOT NULL AND COALESCE(v_esc.version, 1) <> p_expected_version THEN
    RAISE EXCEPTION 'CONFLICTO_VERSION: El escenario fue modificado por otro usuario (% vs %).',
      COALESCE(v_esc.version, 1), p_expected_version
      USING ERRCODE = '40001';
  END IF;

  v_periodo := COALESCE(v_esc.periodo, 2027);
  v_now_txt := to_char(v_now_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_actor := COALESCE(NULLIF(trim(p_usuario_actor), ''), 'Nivel Central');

  SELECT u.id
  INTO v_actor_uid
  FROM public.usuarios_sistema u
  WHERE u.auth_uid = (SELECT auth.uid())
  LIMIT 1;

  -- 4. Validaciones estructurales en servidor
  SELECT COUNT(*)
  INTO v_total_propuestas
  FROM public.propuestas_calce
  WHERE escenario_id = p_escenario_id;

  IF v_total_propuestas = 0 THEN
    RAISE EXCEPTION 'El escenario no contiene propuestas de calce para consolidar.';
  END IF;

  SELECT string_agg(COALESCE(NULLIF(trim(motivo_bloqueo), ''), nombre_docente || ' -> ' || rbd_destino), ' | ')
  INTO v_bloqueos_txt
  FROM public.propuestas_calce
  WHERE escenario_id = p_escenario_id
    AND bloquea_consolidacion = TRUE;

  IF v_bloqueos_txt IS NOT NULL THEN
    RAISE EXCEPTION 'Consolidación bloqueada por incumplimientos normativos: %', v_bloqueos_txt;
  END IF;

  SELECT vacante_destino_id
  INTO v_dup_vacante
  FROM public.propuestas_calce
  WHERE escenario_id = p_escenario_id
    AND vacante_destino_id IS NOT NULL
    AND trim(vacante_destino_id) <> ''
  GROUP BY vacante_destino_id
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF v_dup_vacante IS NOT NULL THEN
    RAISE EXCEPTION 'Inconsistencia de calce: la vacante destino ''%'' está repetida en el escenario.', v_dup_vacante;
  END IF;

  SELECT p.docente_origen_id
  INTO v_dup_origen
  FROM public.propuestas_calce p
  LEFT JOIN public.docentes d ON d.id = p.docente_origen_id
  LEFT JOIN public.asistentes_educacion a ON a.id = p.docente_origen_id
  WHERE p.escenario_id = p_escenario_id
  GROUP BY p.docente_origen_id, d.horas_contrato, a.horas_contrato
  HAVING COUNT(*) > 1
     AND (
       BOOL_OR(p.genera_rebote = TRUE)
       OR BOOL_OR(
         p.horas_asignadas >= COALESCE(
           CASE WHEN COALESCE(p.estamento_personal, 'DOCENTE') = 'ASISTENTE' THEN a.horas_contrato ELSE d.horas_contrato END,
           p.horas_asignadas
         )
       )
       OR SUM(p.horas_asignadas) > COALESCE(
         MAX(CASE WHEN COALESCE(p.estamento_personal, 'DOCENTE') = 'ASISTENTE' THEN a.horas_contrato ELSE d.horas_contrato END),
         44
       )
     )
  LIMIT 1;

  IF v_dup_origen IS NOT NULL THEN
    RAISE EXCEPTION 'Inconsistencia de calce: el funcionario origen ''%'' figura repetido en traslado completo.', v_dup_origen;
  END IF;

  SELECT COUNT(*)
  INTO v_rebotes_pendientes
  FROM public.propuestas_calce
  WHERE escenario_id = p_escenario_id
    AND genera_rebote = TRUE
    AND COALESCE(NULLIF(trim(estado_resolucion_rebote), ''), 'PENDIENTE') = 'PENDIENTE';

  IF v_rebotes_pendientes > 0 THEN
    RAISE EXCEPTION 'Consolidación bloqueada: existen % vacante(s) de rebote en estado PENDIENTE de resolución.', v_rebotes_pendientes;
  END IF;

  -- 5. Validar máquina de estados sobre solicitudes_movilidad vinculadas
  FOR v_prop IN
    SELECT p.*
    FROM public.propuestas_calce p
    WHERE p.escenario_id = p_escenario_id
    ORDER BY p.created_at ASC NULLS LAST, p.id ASC
  LOOP
    IF v_prop.solicitud_movilidad_id IS NOT NULL AND trim(v_prop.solicitud_movilidad_id) <> '' THEN
      SELECT *
      INTO v_sol
      FROM public.solicitudes_movilidad
      WHERE id = v_prop.solicitud_movilidad_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud de movilidad ''%'' vinculada a la propuesta ''%'' no encontrada.',
          v_prop.solicitud_movilidad_id, v_prop.id;
      END IF;

      IF v_sol.carril = 'TRASLADO_VOLUNTARIO'
         AND v_sol.estado_flujo <> 'ACEPTADO_CON_FIRMA' THEN
        RAISE EXCEPTION 'La solicitud ''%'' (TRASLADO_VOLUNTARIO) requiere estado ACEPTADO_CON_FIRMA para consolidar (estado actual: %).',
          v_sol.id, v_sol.estado_flujo;
      ELSIF v_sol.carril IN ('NO_CONTINUIDAD_TITULAR', 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO')
         AND v_sol.estado_flujo NOT IN ('NOTIFICADO_DIRECCION_ORIGEN', 'ACEPTADO_CON_FIRMA') THEN
        RAISE EXCEPTION 'La solicitud ''%'' (%) requiere estado NOTIFICADO_DIRECCION_ORIGEN o ACEPTADO_CON_FIRMA para consolidar (estado actual: %).',
          v_sol.id, v_sol.carril, v_sol.estado_flujo;
      ELSIF v_sol.estado_flujo IN ('RECHAZADO', 'CONSOLIDADO', 'RESOLUCION_EMITIDA') THEN
        RAISE EXCEPTION 'La solicitud ''%'' posee un estado incompatible para consolidar (%).',
          v_sol.id, v_sol.estado_flujo;
      END IF;
    END IF;
  END LOOP;

  -- 6. Ejecución atómica por cada propuesta
  FOR v_prop IN
    SELECT p.*
    FROM public.propuestas_calce p
    WHERE p.escenario_id = p_escenario_id
    ORDER BY
      EXISTS (
        SELECT 1
        FROM public.propuestas_calce px
        WHERE px.escenario_id = p_escenario_id
          AND px.rebote_cubierto_por_propuesta_id = p.id
      ) ASC,
      (p.rebote_cubierto_por_propuesta_id IS NULL) ASC,
      p.created_at ASC NULLS LAST,
      p.id ASC
  LOOP
    IF COALESCE(v_prop.estamento_personal, 'DOCENTE') = 'ASISTENTE' THEN
      -- 6.A Rama ASISTENTE DE LA EDUCACIÓN
      SELECT *
      INTO v_ast_orig
      FROM public.asistentes_educacion
      WHERE id = v_prop.docente_origen_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Asistente de origen ''%'' no existe en la base de datos.', v_prop.docente_origen_id;
      END IF;

      v_sum_indef_db := COALESCE(v_ast_orig.horas_subvencion_general_indefinido, 0)
                      + COALESCE(v_ast_orig.horas_sep_indefinido, 0)
                      + COALESCE(v_ast_orig.horas_pie_indefinido, 0);

      IF COALESCE(v_prop.minutos_titulares_origen, 0) > 0 OR COALESCE(v_prop.minutos_contrata_origen, 0) > 0 THEN
        v_horas_indef_origen := ROUND(COALESCE(v_prop.minutos_titulares_origen, 0) / 60.0, 2);
      ELSE
        v_horas_indef_origen := v_sum_indef_db;
      END IF;

      v_ast_dest_found := FALSE;
      v_target_ast_id := NULLIF(trim(COALESCE(v_prop.vacante_destino_id, '')), '');

      IF v_target_ast_id IS NOT NULL THEN
        SELECT *
        INTO v_ast_dest
        FROM public.asistentes_educacion
        WHERE id = v_target_ast_id
        FOR UPDATE;

        IF FOUND THEN
          v_ast_dest_found := TRUE;
        END IF;
      END IF;

      IF v_ast_dest_found THEN
        v_horas_dest_ast := COALESCE(NULLIF(v_ast_dest.horas_contrato, 0), NULLIF(v_prop.horas_asignadas, 0), v_ast_orig.horas_contrato);
      ELSE
        v_horas_dest_ast := COALESCE(NULLIF(v_prop.horas_asignadas, 0), v_ast_orig.horas_contrato);
      END IF;

      v_fuente_dest := COALESCE(NULLIF(trim(v_prop.fuente_destino), ''), 'SUBVENCION_GENERAL');
      v_horas_indef_dest := LEAST(v_horas_dest_ast, v_horas_indef_origen);
      v_horas_pf_dest := GREATEST(0, v_horas_dest_ast - v_horas_indef_dest);

      IF v_ast_dest_found THEN
        UPDATE public.asistentes_educacion
        SET run = v_ast_orig.run,
            nombres = v_ast_orig.nombres,
            apellidos = v_ast_orig.apellidos,
            cargo_funcion = COALESCE(NULLIF(trim(cargo_funcion), ''), v_ast_orig.cargo_funcion),
            estamento = COALESCE(NULLIF(trim(estamento), ''), v_ast_orig.estamento),
            horas_contrato = v_horas_dest_ast,
            horas_subvencion_general_indefinido = CASE WHEN v_fuente_dest = 'SUBVENCION_GENERAL' THEN v_horas_indef_dest ELSE 0 END,
            horas_subvencion_general_plazo_fijo = CASE WHEN v_fuente_dest = 'SUBVENCION_GENERAL' THEN v_horas_pf_dest ELSE 0 END,
            horas_sep_indefinido = CASE WHEN v_fuente_dest = 'SEP' THEN v_horas_indef_dest ELSE 0 END,
            horas_sep_plazo_fijo = CASE WHEN v_fuente_dest = 'SEP' THEN v_horas_pf_dest ELSE 0 END,
            horas_pie_indefinido = CASE WHEN v_fuente_dest = 'PIE' THEN v_horas_indef_dest ELSE 0 END,
            horas_pie_plazo_fijo = CASE WHEN v_fuente_dest = 'PIE' THEN v_horas_pf_dest ELSE 0 END,
            horas_honorarios = 0,
            activo = TRUE,
            situacion_final_gdp = 'Vigente',
            updated_at = v_now_ts
        WHERE id = v_ast_dest.id;
      ELSE
        IF v_target_ast_id IS NULL THEN
          v_target_ast_id := 'ast_' || v_prop.rbd_destino || '_' || v_periodo::text || '_' || regexp_replace(v_ast_orig.run, '[^0-9Kk]', '', 'g');
        END IF;

        INSERT INTO public.asistentes_educacion (
          id, rbd, periodo, run, nombres, apellidos, cargo_funcion, estamento, horas_contrato,
          horas_subvencion_general_indefinido, horas_subvencion_general_plazo_fijo,
          horas_sep_indefinido, horas_sep_plazo_fijo,
          horas_pie_indefinido, horas_pie_plazo_fijo,
          horas_honorarios, es_dupla_psicosocial, es_equipo_pie, es_tecnico_parvulo,
          es_auxiliar_servicio, es_inspector_patio, observaciones, activo,
          propuesta_gdp, estado_sancion_gdp, situacion_final_gdp, updated_at
        )
        VALUES (
          v_target_ast_id, v_prop.rbd_destino, v_periodo, v_ast_orig.run, v_ast_orig.nombres, v_ast_orig.apellidos,
          v_ast_orig.cargo_funcion, v_ast_orig.estamento, v_horas_dest_ast,
          CASE WHEN v_fuente_dest = 'SUBVENCION_GENERAL' THEN v_horas_indef_dest ELSE 0 END,
          CASE WHEN v_fuente_dest = 'SUBVENCION_GENERAL' THEN v_horas_pf_dest ELSE 0 END,
          CASE WHEN v_fuente_dest = 'SEP' THEN v_horas_indef_dest ELSE 0 END,
          CASE WHEN v_fuente_dest = 'SEP' THEN v_horas_pf_dest ELSE 0 END,
          CASE WHEN v_fuente_dest = 'PIE' THEN v_horas_indef_dest ELSE 0 END,
          CASE WHEN v_fuente_dest = 'PIE' THEN v_horas_pf_dest ELSE 0 END,
          0, COALESCE(v_ast_orig.es_dupla_psicosocial, FALSE), COALESCE(v_ast_orig.es_equipo_pie, FALSE),
          COALESCE(v_ast_orig.es_tecnico_parvulo, FALSE), COALESCE(v_ast_orig.es_auxiliar_servicio, FALSE),
          COALESCE(v_ast_orig.es_inspector_patio, FALSE), v_ast_orig.observaciones, TRUE,
          'Continuidad', 'Aprobado', 'Vigente', v_now_ts
        )
        ON CONFLICT (id) DO UPDATE SET
          run = EXCLUDED.run,
          nombres = EXCLUDED.nombres,
          apellidos = EXCLUDED.apellidos,
          horas_contrato = EXCLUDED.horas_contrato,
          horas_subvencion_general_indefinido = EXCLUDED.horas_subvencion_general_indefinido,
          horas_subvencion_general_plazo_fijo = EXCLUDED.horas_subvencion_general_plazo_fijo,
          horas_sep_indefinido = EXCLUDED.horas_sep_indefinido,
          horas_sep_plazo_fijo = EXCLUDED.horas_sep_plazo_fijo,
          horas_pie_indefinido = EXCLUDED.horas_pie_indefinido,
          horas_pie_plazo_fijo = EXCLUDED.horas_pie_plazo_fijo,
          horas_honorarios = 0,
          activo = TRUE,
          situacion_final_gdp = 'Vigente',
          updated_at = v_now_ts;
      END IF;

      v_vacantes_reemplazadas := v_vacantes_reemplazadas + 1;
      IF NOT (v_prop.rbd_destino = ANY(v_rbds_afectados)) THEN
        v_rbds_afectados := array_append(v_rbds_afectados, v_prop.rbd_destino);
      END IF;

      -- Rebote o rebaja en origen para asistente
      IF COALESCE(v_prop.genera_rebote, FALSE) = TRUE AND v_prop.rbd_origen <> v_prop.rbd_destino THEN
        v_reb := COALESCE(v_prop.vacante_rebote_json, '{}'::jsonb);
        v_horas_reb_ast := COALESCE(NULLIF((v_reb->>'horasContratoRebote')::numeric, 0), v_ast_orig.horas_contrato);
        v_fuente_orig_ast := COALESCE(
          NULLIF(trim(v_reb->>'fuenteFinanciamiento'), ''),
          CASE
            WHEN (COALESCE(v_ast_orig.horas_pie_indefinido, 0) + COALESCE(v_ast_orig.horas_pie_plazo_fijo, 0)) > 0 THEN 'PIE'
            WHEN (COALESCE(v_ast_orig.horas_sep_indefinido, 0) + COALESCE(v_ast_orig.horas_sep_plazo_fijo, 0)) > 0 THEN 'SEP'
            ELSE 'SUBVENCION_GENERAL'
          END
        );
        v_rebote_id := 'vac_reb_ast_' || v_prop.rbd_origen || '_' || v_periodo::text || '_' || right(v_prop.id, 6) || '_' || v_rebotes_creados::text;
        v_rebote_run := 'REB-' || right(v_prop.rbd_origen, 4) || '-' || upper(left(md5(v_prop.id || ':' || v_rebotes_creados::text), 3));

        INSERT INTO public.asistentes_educacion (
          id, rbd, periodo, run, nombres, apellidos, cargo_funcion, estamento, horas_contrato,
          horas_subvencion_general_indefinido, horas_subvencion_general_plazo_fijo,
          horas_sep_indefinido, horas_sep_plazo_fijo,
          horas_pie_indefinido, horas_pie_plazo_fijo,
          horas_honorarios, activo, propuesta_gdp, estado_sancion_gdp, situacion_final_gdp, observaciones, updated_at
        )
        VALUES (
          v_rebote_id, v_prop.rbd_origen, v_periodo, v_rebote_run,
          'VACANTE REBOTE', upper(COALESCE(v_ast_orig.cargo_funcion, 'ASISTENTE')),
          v_ast_orig.cargo_funcion, v_ast_orig.estamento, v_horas_reb_ast,
          0, CASE WHEN v_fuente_orig_ast = 'SUBVENCION_GENERAL' THEN v_horas_reb_ast ELSE 0 END,
          0, CASE WHEN v_fuente_orig_ast = 'SEP' THEN v_horas_reb_ast ELSE 0 END,
          0, CASE WHEN v_fuente_orig_ast = 'PIE' THEN v_horas_reb_ast ELSE 0 END,
          0, TRUE, 'Vacante por proveer', 'Pendiente', 'Vigente',
          'Vacante de rebote generada por traslado de ' || trim(v_ast_orig.nombres || ' ' || v_ast_orig.apellidos) || ' hacia RBD ' || v_prop.rbd_destino || ' (Escenario ' || v_esc.nombre || ').',
          v_now_ts
        )
        ON CONFLICT (id) DO UPDATE SET
          horas_contrato = EXCLUDED.horas_contrato,
          horas_subvencion_general_plazo_fijo = EXCLUDED.horas_subvencion_general_plazo_fijo,
          horas_sep_plazo_fijo = EXCLUDED.horas_sep_plazo_fijo,
          horas_pie_plazo_fijo = EXCLUDED.horas_pie_plazo_fijo,
          updated_at = v_now_ts;

        v_rebote_by_propuesta := v_rebote_by_propuesta || jsonb_build_object(v_prop.id, v_rebote_id);
        v_rebotes_creados := v_rebotes_creados + 1;
        IF NOT (v_prop.rbd_origen = ANY(v_rbds_afectados)) THEN
          v_rbds_afectados := array_append(v_rbds_afectados, v_prop.rbd_origen);
        END IF;
      END IF;

      IF v_target_ast_id <> v_ast_orig.id THEN
        IF v_horas_dest_ast >= COALESCE(v_ast_orig.horas_contrato, 0) THEN
          DELETE FROM public.asistentes_educacion WHERE id = v_ast_orig.id;
        ELSE
          v_rem_ast := v_horas_dest_ast;
          v_d_sg_pf := LEAST(COALESCE(v_ast_orig.horas_subvencion_general_plazo_fijo, 0), v_rem_ast); v_rem_ast := v_rem_ast - v_d_sg_pf;
          v_d_sep_pf := LEAST(COALESCE(v_ast_orig.horas_sep_plazo_fijo, 0), v_rem_ast); v_rem_ast := v_rem_ast - v_d_sep_pf;
          v_d_pie_pf := LEAST(COALESCE(v_ast_orig.horas_pie_plazo_fijo, 0), v_rem_ast); v_rem_ast := v_rem_ast - v_d_pie_pf;
          v_d_sg_in := LEAST(COALESCE(v_ast_orig.horas_subvencion_general_indefinido, 0), v_rem_ast); v_rem_ast := v_rem_ast - v_d_sg_in;
          v_d_sep_in := LEAST(COALESCE(v_ast_orig.horas_sep_indefinido, 0), v_rem_ast); v_rem_ast := v_rem_ast - v_d_sep_in;
          v_d_pie_in := LEAST(COALESCE(v_ast_orig.horas_pie_indefinido, 0), v_rem_ast);

          UPDATE public.asistentes_educacion
          SET horas_contrato = GREATEST(0, COALESCE(horas_contrato, 0) - v_horas_dest_ast),
              horas_subvencion_general_plazo_fijo = GREATEST(0, COALESCE(horas_subvencion_general_plazo_fijo, 0) - v_d_sg_pf),
              horas_sep_plazo_fijo = GREATEST(0, COALESCE(horas_sep_plazo_fijo, 0) - v_d_sep_pf),
              horas_pie_plazo_fijo = GREATEST(0, COALESCE(horas_pie_plazo_fijo, 0) - v_d_pie_pf),
              horas_subvencion_general_indefinido = GREATEST(0, COALESCE(horas_subvencion_general_indefinido, 0) - v_d_sg_in),
              horas_sep_indefinido = GREATEST(0, COALESCE(horas_sep_indefinido, 0) - v_d_sep_in),
              horas_pie_indefinido = GREATEST(0, COALESCE(horas_pie_indefinido, 0) - v_d_pie_in),
              updated_at = v_now_ts
          WHERE id = v_ast_orig.id;
        END IF;

        IF NOT (v_prop.rbd_origen = ANY(v_rbds_afectados)) THEN
          v_rbds_afectados := array_append(v_rbds_afectados, v_prop.rbd_origen);
        END IF;
      END IF;
    ELSE
      -- 6.B Rama DOCENTE (Ley 20.903 / Estatuto Docente)
      v_target_vacante_id := NULLIF(trim(COALESCE(v_prop.vacante_destino_id, '')), '');

      IF v_target_vacante_id IS NULL THEN
        SELECT v_rebote_by_propuesta ->> p_prev.id
        INTO v_target_vacante_id
        FROM public.propuestas_calce p_prev
        WHERE p_prev.escenario_id = p_escenario_id
          AND p_prev.rebote_cubierto_por_propuesta_id = v_prop.id
        LIMIT 1;
      END IF;

      IF v_target_vacante_id IS NULL THEN
        RAISE EXCEPTION 'La propuesta ''%'' no posee vacante_destino_id.', v_prop.id;
      END IF;

      SELECT *
      INTO v_doc_orig
      FROM public.docentes
      WHERE id = v_prop.docente_origen_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Docente de origen ''%'' no existe en la base de datos.', v_prop.docente_origen_id;
      END IF;

      SELECT *
      INTO v_doc_dest
      FROM public.docentes
      WHERE id = v_target_vacante_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Vacante de destino ''%'' no existe en la base de datos.', v_target_vacante_id;
      END IF;

      -- Desglose Titular vs Contrata del docente origen (sin regalar titularidad a horas a contrata)
      v_sum_tit_db := COALESCE(v_doc_orig.horas_subvencion_general_titular, 0)
                    + COALESCE(v_doc_orig.horas_sep_titular, 0)
                    + COALESCE(v_doc_orig.horas_pie_titular, 0);
      v_sum_con_db := COALESCE(v_doc_orig.horas_subvencion_general_contrata, 0)
                    + COALESCE(v_doc_orig.horas_sep_contrata, 0)
                    + COALESCE(v_doc_orig.horas_pie_contrata, 0);

      IF COALESCE(v_prop.minutos_titulares_origen, 0) > 0 OR COALESCE(v_prop.minutos_contrata_origen, 0) > 0 THEN
        v_horas_titulares_origen := ROUND(COALESCE(v_prop.minutos_titulares_origen, 0) / 60.0, 2);
      ELSIF v_sum_tit_db > 0 OR v_sum_con_db > 0 THEN
        v_horas_titulares_origen := v_sum_tit_db;
      ELSIF v_doc_orig.calidad_juridica = 'TITULAR' THEN
        v_horas_titulares_origen := COALESCE(v_doc_orig.horas_contrato, 0);
      ELSE
        v_horas_titulares_origen := 0;
      END IF;

      v_horas_dest := COALESCE(v_doc_dest.horas_contrato, v_prop.horas_asignadas, 0);
      v_horas_titular_dest := LEAST(v_horas_dest, v_horas_titulares_origen);
      v_horas_contrata_dest := GREATEST(0, v_horas_dest - v_horas_titular_dest);
      v_calidad_dest := CASE WHEN v_horas_titular_dest > 0 THEN 'TITULAR' ELSE 'CONTRATA' END;

      v_fuente_dest := COALESCE(
        NULLIF(trim(v_prop.fuente_destino), ''),
        CASE
          WHEN (COALESCE(v_doc_dest.horas_pie_titular, 0) + COALESCE(v_doc_dest.horas_pie_contrata, 0)) > 0 THEN 'PIE'
          WHEN (COALESCE(v_doc_dest.horas_sep_titular, 0) + COALESCE(v_doc_dest.horas_sep_contrata, 0)) > 0 THEN 'SEP'
          ELSE 'SUBVENCION_GENERAL'
        END
      );

      UPDATE public.docentes
      SET run = v_doc_orig.run,
          nombres = v_doc_orig.nombres,
          apellidos = v_doc_orig.apellidos,
          titulo = v_doc_orig.titulo,
          calidad_juridica = v_calidad_dest,
          aplica_articulo_69 = COALESCE(v_doc_orig.aplica_articulo_69, FALSE),
          tramo_carrera_docente = v_doc_orig.tramo_carrera_docente,
          habilitacion_seremi_rbd = v_doc_orig.habilitacion_seremi_rbd,
          habilitacion_seremi_asignatura = v_doc_orig.habilitacion_seremi_asignatura,
          horas_subvencion_general_titular = CASE WHEN v_fuente_dest = 'SUBVENCION_GENERAL' THEN v_horas_titular_dest ELSE 0 END,
          horas_subvencion_general_contrata = CASE WHEN v_fuente_dest = 'SUBVENCION_GENERAL' THEN v_horas_contrata_dest ELSE 0 END,
          horas_sep_titular = CASE WHEN v_fuente_dest = 'SEP' THEN v_horas_titular_dest ELSE 0 END,
          horas_sep_contrata = CASE WHEN v_fuente_dest = 'SEP' THEN v_horas_contrata_dest ELSE 0 END,
          horas_pie_titular = CASE WHEN v_fuente_dest = 'PIE' THEN v_horas_titular_dest ELSE 0 END,
          horas_pie_contrata = CASE WHEN v_fuente_dest = 'PIE' THEN v_horas_contrata_dest ELSE 0 END,
          es_vacante_nn = FALSE,
          tipo_vacante = NULL,
          justificacion_vacante = NULL,
          vacante_condicional = FALSE,
          origen_egreso_id = NULL,
          situacion_final_gdp = 'Vigente',
          updated_at = v_now_ts
      WHERE id = v_doc_dest.id;

      v_vacantes_reemplazadas := v_vacantes_reemplazadas + 1;
      IF NOT (v_prop.rbd_destino = ANY(v_rbds_afectados)) THEN
        v_rbds_afectados := array_append(v_rbds_afectados, v_prop.rbd_destino);
      END IF;

      -- Si genera rebote en otro establecimiento, insertar NN-Rebote en origen, re-apuntar asignaciones y eliminar fila origen
      IF COALESCE(v_prop.genera_rebote, FALSE) = TRUE AND v_prop.rbd_origen <> v_prop.rbd_destino THEN
        v_reb := COALESCE(v_prop.vacante_rebote_json, '{}'::jsonb);
        v_rebote_id := 'vac_reb_' || v_prop.rbd_origen || '_' || v_periodo::text || '_' || right(v_prop.id, 6) || '_' || v_rebotes_creados::text;
        v_rebote_run := 'REB-' || right(v_prop.rbd_origen, 4) || '-' || upper(left(md5(v_prop.id || ':' || v_rebotes_creados::text), 3));
        v_horas_reb := GREATEST(1, LEAST(44, ROUND(COALESCE(NULLIF((v_reb->>'horasContratoRebote')::numeric, 0), v_doc_orig.horas_contrato))::integer));
        v_fuente_reb := COALESCE(NULLIF(trim(v_reb->>'fuenteFinanciamiento'), ''), 'SUBVENCION_GENERAL');
        v_asig_reb := COALESCE(NULLIF(trim(v_reb->>'asignaturaPrincipal'), ''), v_doc_orig.asignatura_principal, 'DOCENTE AULA');
        v_horas_aula_reb := COALESCE((v_reb->>'horasPedagogicasAula')::integer, v_doc_orig.horas_aula, 0);
        v_funciones_reb := COALESCE(v_reb->'funcionesNoLectivasHeredadas', '[]'::jsonb);

        INSERT INTO public.docentes (
          id, rbd, periodo, run, nombres, apellidos, titulo, calidad_juridica, estamento, horas_contrato,
          horas_subvencion_general_titular, horas_subvencion_general_contrata,
          horas_sep_titular, horas_sep_contrata,
          horas_pie_titular, horas_pie_contrata,
          horas_directivas, horas_inspector_general, horas_tecnico_pedagogica, horas_coordinacion, tipo_coordinacion,
          horas_coordinacion_pie, horas_convivencia_escolar, horas_extraescolar, cargo_institucional,
          horas_taller_sep, horas_trabajo_colaborativo, horas_aula, horas_ingles,
          funcion_principal, funcion_secundaria, asignatura_principal, aplica_articulo_69,
          funciones_no_aula_json, propuesta_gdp, estado_sancion_gdp, situacion_final_gdp,
          es_vacante_nn, tipo_vacante, justificacion_vacante, vacante_condicional, updated_at
        )
        VALUES (
          v_rebote_id, v_prop.rbd_origen, v_periodo, v_rebote_run,
          'VACANTE REBOTE', upper(v_asig_reb), NULL, 'CONTRATA',
          COALESCE(NULLIF(trim(v_doc_orig.estamento), ''), 'DOCENTE_AULA'), v_horas_reb,
          0, CASE WHEN v_fuente_reb = 'SUBVENCION_GENERAL' THEN v_horas_reb ELSE 0 END,
          0, CASE WHEN v_fuente_reb = 'SEP' THEN v_horas_reb ELSE 0 END,
          0, CASE WHEN v_fuente_reb = 'PIE' THEN v_horas_reb ELSE 0 END,
          COALESCE(v_doc_orig.horas_directivas, 0),
          COALESCE(v_doc_orig.horas_inspector_general, 0),
          COALESCE(v_doc_orig.horas_tecnico_pedagogica, 0),
          COALESCE(v_doc_orig.horas_coordinacion, 0),
          v_doc_orig.tipo_coordinacion,
          COALESCE(v_doc_orig.horas_coordinacion_pie, 0),
          COALESCE(v_doc_orig.horas_convivencia_escolar, 0),
          COALESCE(v_doc_orig.horas_extraescolar, 0),
          v_doc_orig.cargo_institucional,
          COALESCE(v_doc_orig.horas_taller_sep, 0),
          COALESCE(v_doc_orig.horas_trabajo_colaborativo, 0),
          v_horas_aula_reb,
          COALESCE(v_doc_orig.horas_ingles, 0),
          v_doc_orig.funcion_principal,
          v_doc_orig.funcion_secundaria,
          v_asig_reb,
          FALSE,
          v_funciones_reb,
          'Vacante por proveer',
          'Pendiente',
          'Vigente',
          TRUE,
          'REBOTE_MOVILIDAD',
          'Vacante de rebote generada por traslado de ' || trim(v_doc_orig.nombres || ' ' || v_doc_orig.apellidos) || ' hacia RBD ' || v_prop.rbd_destino || ' (Escenario ' || v_esc.nombre || ').',
          FALSE,
          v_now_ts
        )
        ON CONFLICT (id) DO UPDATE SET
          horas_contrato = EXCLUDED.horas_contrato,
          horas_subvencion_general_contrata = EXCLUDED.horas_subvencion_general_contrata,
          horas_sep_contrata = EXCLUDED.horas_sep_contrata,
          horas_pie_contrata = EXCLUDED.horas_pie_contrata,
          updated_at = v_now_ts;

        UPDATE public.asignaciones_horarias
        SET docente_id = v_rebote_id,
            updated_at = v_now_ts
        WHERE docente_id = v_doc_orig.id
          AND rbd = v_prop.rbd_origen
          AND periodo = v_periodo;

        UPDATE public.asignaciones_horarias
        SET co_docente_id = v_rebote_id,
            updated_at = v_now_ts
        WHERE co_docente_id = v_doc_orig.id
          AND rbd = v_prop.rbd_origen
          AND periodo = v_periodo;

        IF v_horas_reb >= COALESCE(v_doc_orig.horas_contrato, 0) THEN
          DELETE FROM public.docentes WHERE id = v_doc_orig.id;
        END IF;

        v_rebote_by_propuesta := v_rebote_by_propuesta || jsonb_build_object(v_prop.id, v_rebote_id);
        v_rebotes_creados := v_rebotes_creados + 1;
        IF NOT (v_prop.rbd_origen = ANY(v_rbds_afectados)) THEN
          v_rbds_afectados := array_append(v_rbds_afectados, v_prop.rbd_origen);
        END IF;
      END IF;
    END IF;

    v_propuestas_consolidadas := v_propuestas_consolidadas + 1;
  END LOOP;

  -- 7. Actualizar estados de propuestas, solicitudes y escenario
  v_new_version := COALESCE(v_esc.version, 1) + 1;

  UPDATE public.propuestas_calce
  SET estado = 'CONSOLIDADA',
      updated_at = v_now_ts
  WHERE escenario_id = p_escenario_id;

  UPDATE public.solicitudes_movilidad
  SET estado_flujo = 'CONSOLIDADO',
      updated_at = v_now_ts
  WHERE id IN (
    SELECT DISTINCT solicitud_movilidad_id
    FROM public.propuestas_calce
    WHERE escenario_id = p_escenario_id
      AND solicitud_movilidad_id IS NOT NULL
      AND trim(solicitud_movilidad_id) <> ''
  );

  UPDATE public.escenarios_calce
  SET estado = 'CONSOLIDADO',
      version = v_new_version,
      consolidado_por = v_actor,
      fecha_consolidacion = v_now_txt,
      updated_at = v_now_ts
  WHERE id = p_escenario_id;

  -- 8. Bitácora de auditoría transaccional por cada RBD afectado
  FOREACH v_rbd_item IN ARRAY v_rbds_afectados
  LOOP
    INSERT INTO public.auditoria_cambios (
      id, rbd, periodo, tipo_evento, entidad, entidad_id,
      descripcion, detalles_json, usuario_id, usuario_nombre, fecha_hora
    )
    VALUES (
      'aud_mov_' || p_escenario_id || '_' || v_rbd_item || '_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
      v_rbd_item,
      v_periodo,
      'TRASPASO',
      'DOTACION_COMPLETA',
      p_escenario_id,
      'Consolidación atómica RPC de escenario ''' || v_esc.nombre || ''' por ' || v_actor || ': ' || v_vacantes_reemplazadas || ' vacante(s) cubiertas y ' || v_rebotes_creados || ' vacante(s) de rebote (v' || v_new_version || ').',
      jsonb_build_object(
        'escenarioId', p_escenario_id,
        'usuarioActor', v_actor,
        'propuestasConsolidadas', v_propuestas_consolidadas,
        'vacantesReemplazadas', v_vacantes_reemplazadas,
        'rebotesCreados', v_rebotes_creados,
        'nuevaVersion', v_new_version
      ),
      v_actor_uid,
      v_actor,
      v_now_ts
    );
  END LOOP;

  RETURN jsonb_build_object(
    'propuestasConsolidadas', v_propuestas_consolidadas,
    'vacantesReemplazadas', v_vacantes_reemplazadas,
    'rebotesCreados', v_rebotes_creados,
    'rbdsAfectados', COALESCE(to_jsonb(v_rbds_afectados), '[]'::jsonb),
    'nuevaVersion', v_new_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consolidar_escenario_movilidad_rpc(TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consolidar_escenario_movilidad_rpc(TEXT, INTEGER, TEXT) TO authenticated;
