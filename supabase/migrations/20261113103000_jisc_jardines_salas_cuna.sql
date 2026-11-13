-- ==============================================================================
-- MIGRACIÓN: SOPORTE DIFERENCIADO POR TIPO DE ESTABLECIMIENTO Y JARDINES / SALAS CUNA VTF (JISC + PAL 2027)
-- Fecha: 2026-11-13
-- ==============================================================================

ALTER TABLE public.establecimientos
  ADD COLUMN IF NOT EXISTS tipo_perfil TEXT DEFAULT 'ESCUELA_BASICA',
  ADD COLUMN IF NOT EXISTS modalidades_autorizadas_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS codigo_junji TEXT,
  ADD COLUMN IF NOT EXISTS nombre_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS localidad TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS horario_apertura TEXT,
  ADD COLUMN IF NOT EXISTS horario_cierre TEXT,
  ADD COLUMN IF NOT EXISTS horario_extension_inicio TEXT,
  ADD COLUMN IF NOT EXISTS horario_extension_cierre TEXT;

ALTER TABLE public.cursos_sae
  ADD COLUMN IF NOT EXISTS edad_meses_minima INTEGER,
  ADD COLUMN IF NOT EXISTS edad_meses_maxima INTEGER,
  ADD COLUMN IF NOT EXISTS codigo_grupo_jisc TEXT,
  ADD COLUMN IF NOT EXISTS horario_jornada TEXT,
  ADD COLUMN IF NOT EXISTS tiene_extension_horaria BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS matricula_extension INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jornada_nivel TEXT DEFAULT 'COMPLETA';

ALTER TABLE public.docentes
  ADD COLUMN IF NOT EXISTS es_vtf BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS funcion_vtf TEXT,
  ADD COLUMN IF NOT EXISTS grupo_jisc_id TEXT,
  ADD COLUMN IF NOT EXISTS hora_ingreso_turno TEXT,
  ADD COLUMN IF NOT EXISTS hora_salida_turno TEXT,
  ADD COLUMN IF NOT EXISTS reemplazo_de_run TEXT;

ALTER TABLE public.asistentes_educacion
  ADD COLUMN IF NOT EXISTS es_vtf BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS funcion_vtf TEXT,
  ADD COLUMN IF NOT EXISTS grupo_jisc_id TEXT,
  ADD COLUMN IF NOT EXISTS hora_ingreso_turno TEXT,
  ADD COLUMN IF NOT EXISTS hora_salida_turno TEXT;

CREATE TABLE IF NOT EXISTS public.jisc_niveles_parvularia (
  id TEXT PRIMARY KEY,
  rbd VARCHAR(10) NOT NULL REFERENCES public.establecimientos(rbd) ON DELETE CASCADE,
  periodo INTEGER NOT NULL DEFAULT 2027,
  codigo_ue_junji TEXT,
  correl_grupo INTEGER NOT NULL,
  cod_programa TEXT,
  nivel_nombre TEXT NOT NULL,
  subtipo_nivel TEXT NOT NULL,
  es_heterogeneo BOOLEAN NOT NULL DEFAULT FALSE,
  capacidad_autorizada INTEGER NOT NULL DEFAULT 0,
  matricula_activa INTEGER NOT NULL DEFAULT 0,
  retiros INTEGER NOT NULL DEFAULT 0,
  asistencia_promedio NUMERIC(5,2) DEFAULT 0,
  edad_meses_min INTEGER,
  edad_meses_max INTEGER,
  edad_minima_criterio INTEGER,
  jornada TEXT NOT NULL DEFAULT 'COMPLETA',
  horario_inicio TEXT NOT NULL DEFAULT '08:30',
  horario_fin TEXT NOT NULL DEFAULT '16:30',
  tiene_extension_horaria BOOLEAN NOT NULL DEFAULT FALSE,
  matricula_extension INTEGER NOT NULL DEFAULT 0,
  educadoras_asignadas_jisc INTEGER NOT NULL DEFAULT 0,
  tecnicos_asignados_jisc INTEGER NOT NULL DEFAULT 0,
  directoras_asignadas_jisc INTEGER NOT NULL DEFAULT 0,
  fuente_dato TEXT DEFAULT 'MANUAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS trg_jisc_niveles_parvularia_updated_at ON public.jisc_niveles_parvularia;
CREATE TRIGGER trg_jisc_niveles_parvularia_updated_at
BEFORE UPDATE ON public.jisc_niveles_parvularia
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.jisc_turnos_personal (
  id TEXT PRIMARY KEY,
  rbd VARCHAR(10) NOT NULL REFERENCES public.establecimientos(rbd) ON DELETE CASCADE,
  periodo INTEGER NOT NULL DEFAULT 2027,
  nivel_jisc_id TEXT REFERENCES public.jisc_niveles_parvularia(id) ON DELETE SET NULL,
  run_funcionario TEXT NOT NULL,
  nombre_funcionario TEXT,
  estamento_vtf TEXT NOT NULL CHECK (estamento_vtf IN ('DIRECTIVA', 'EDUCADORA', 'TECNICO', 'OTRO_ASISTENTE')),
  dias_semana TEXT NOT NULL DEFAULT 'L-V',
  hora_entrada TEXT NOT NULL,
  hora_salida TEXT NOT NULL,
  minutos_colacion INTEGER NOT NULL DEFAULT 45,
  franja TEXT NOT NULL DEFAULT 'REGULAR' CHECK (franja IN ('REGULAR', 'EXTENSION', 'MIXTO')),
  horas_semanales_cronologicas NUMERIC(5,2) NOT NULL DEFAULT 44,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS trg_jisc_turnos_personal_updated_at ON public.jisc_turnos_personal;
CREATE TRIGGER trg_jisc_turnos_personal_updated_at
BEFORE UPDATE ON public.jisc_turnos_personal
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.jisc_parvulos_b3 (
  id TEXT PRIMARY KEY,
  rbd VARCHAR(10) NOT NULL REFERENCES public.establecimientos(rbd) ON DELETE CASCADE,
  periodo INTEGER NOT NULL DEFAULT 2027,
  codigo_ue_junji TEXT,
  correl_grupo INTEGER NOT NULL,
  desc_nivel TEXT NOT NULL,
  rut_parvulo TEXT,
  edad_meses INTEGER NOT NULL,
  fecha_nacimiento TEXT,
  fecha_ingreso TEXT,
  fecha_retiro TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  presentes_mes INTEGER DEFAULT 0,
  dias_trabajados_mes INTEGER DEFAULT 0,
  porcentaje_asistencia NUMERIC(5,2) DEFAULT 0,
  requiere_nee BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS trg_jisc_parvulos_b3_updated_at ON public.jisc_parvulos_b3;
CREATE TRIGGER trg_jisc_parvulos_b3_updated_at
BEFORE UPDATE ON public.jisc_parvulos_b3
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_jisc_niveles_rbd_periodo ON public.jisc_niveles_parvularia(rbd, periodo);
CREATE INDEX IF NOT EXISTS idx_jisc_turnos_rbd_periodo ON public.jisc_turnos_personal(rbd, periodo);
CREATE INDEX IF NOT EXISTS idx_jisc_b3_rbd_periodo ON public.jisc_parvulos_b3(rbd, periodo);

ALTER TABLE public.jisc_niveles_parvularia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jisc_turnos_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jisc_parvulos_b3 ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  has_can_access BOOLEAN;
  tbl TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'can_access_rbd'
  ) INTO has_can_access;

  FOR tbl IN SELECT unnest(ARRAY['jisc_niveles_parvularia', 'jisc_turnos_personal', 'jisc_parvulos_b3'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "rls_%I_rbd_scope" ON public.%I', tbl, tbl);
    IF has_can_access THEN
      EXECUTE format(
        'CREATE POLICY "rls_%I_rbd_scope" ON public.%I FOR ALL TO authenticated USING (public.can_access_rbd(rbd::text)) WITH CHECK (public.can_access_rbd(rbd::text))',
        tbl, tbl
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY "rls_%I_rbd_scope" ON public.%I FOR ALL TO authenticated USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;
