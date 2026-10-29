-- ==============================================================================
-- SISTEMA DE GESTIÓN Y PLANIFICACIÓN DE DOTACIÓN ESCOLAR SLEP VALLE DIGUILLÍN
-- Esquema Oficial PostgreSQL 17 / Supabase
-- Proyecto: rvvyjfgiwalqsdtpidxz (https://rvvyjfgiwalqsdtpidxz.supabase.co)
-- Metodología: Ley 20.903, Decreto 170 PIE, DFL 1/1996 Estatuto Docente,
-- Ley 21.040 Nueva Educación Pública, Ley 20.248 SEP, Gestión GDP / PAL 2027.
-- ==============================================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función de actualización automática de timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. TABLA: ESTABLECIMIENTOS (121 Establecimientos SLEP Valle Diguillín)
CREATE TABLE IF NOT EXISTS public.establecimientos (
  rbd VARCHAR(10) PRIMARY KEY,
  id TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  comuna TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('LICEO', 'ESCUELA', 'COLEGIO', 'JARDIN', 'SALA_CUNA')) DEFAULT 'ESCUELA',
  regimen TEXT NOT NULL CHECK (regimen IN ('JEC', 'No JEC', 'Mixto')) DEFAULT 'JEC',
  porcentaje_prioritarios NUMERIC(5,2) NOT NULL DEFAULT 75.00,
  director TEXT,
  asesor_uatp TEXT,
  telefono TEXT,
  email TEXT,
  subvencion_sep_mensual NUMERIC(14,2) DEFAULT 0.00,
  subvencion_pro_retencion NUMERIC(14,2) DEFAULT 0.00,
  cupo_horas_pie_diferencial NUMERIC(8,2) DEFAULT 0.00,
  cupo_horas_pie_asistentes NUMERIC(8,2) DEFAULT 0.00,
  estado_planificacion TEXT NOT NULL CHECK (estado_planificacion IN ('BORRADOR', 'EN_REVISION', 'APROBADO_UATP', 'CONSOLIDADO')) DEFAULT 'BORRADOR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER trg_establecimientos_updated_at
BEFORE UPDATE ON public.establecimientos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. TABLA: SALAS INFRAESTRUCTURA (Decreto 548 Mineduc)
CREATE TABLE IF NOT EXISTS public.salas_infraestructura (
  id TEXT PRIMARY KEY,
  rbd VARCHAR(10) NOT NULL REFERENCES public.establecimientos(rbd) ON DELETE CASCADE,
  pabellon TEXT,
  nombre_sala TEXT NOT NULL,
  superficie_m2 NUMERIC(8,2) NOT NULL DEFAULT 45.00,
  tipo TEXT NOT NULL DEFAULT 'AULA_COMUN',
  aforo_maximo INTEGER NOT NULL DEFAULT 35,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABLA: CURSOS SAE Y DEMANDA HORARIA
CREATE TABLE IF NOT EXISTS public.cursos_sae (
  id TEXT PRIMARY KEY,
  rbd VARCHAR(10) NOT NULL REFERENCES public.establecimientos(rbd) ON DELETE CASCADE,
  periodo INTEGER NOT NULL DEFAULT 2026,
  nivel TEXT NOT NULL,
  letra VARCHAR(5) NOT NULL DEFAULT 'A',
  regimen TEXT NOT NULL CHECK (regimen IN ('JEC', 'No JEC')) DEFAULT 'JEC',
  regimen_proporcion TEXT NOT NULL CHECK (regimen_proporcion IN ('65_35', '60_40')) DEFAULT '65_35',
  sala_id TEXT,
  cupo_sae INTEGER NOT NULL DEFAULT 35,
  matricula_proyectada INTEGER NOT NULL DEFAULT 30,
  alumnos_neet INTEGER NOT NULL DEFAULT 0,
  alumnos_neep INTEGER NOT NULL DEFAULT 0,
  talleres_jec_json JSONB DEFAULT '[]'::jsonb,
  es_multigrado BOOLEAN NOT NULL DEFAULT FALSE,
  es_combinado BOOLEAN NOT NULL DEFAULT FALSE,
  tipo_modalidad TEXT NOT NULL DEFAULT 'REGULAR',
  grados_combinados_json JSONB DEFAULT '[]'::jsonb,
  especialidad_tp TEXT,
  plan_estudio_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER trg_cursos_sae_updated_at
BEFORE UPDATE ON public.cursos_sae
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. TABLA: DOCENTES Y PERSONAL LEY 20.903 / DFL 1
CREATE TABLE IF NOT EXISTS public.docentes (
  id TEXT PRIMARY KEY,
  rbd VARCHAR(10) NOT NULL REFERENCES public.establecimientos(rbd) ON DELETE CASCADE,
  periodo INTEGER NOT NULL DEFAULT 2026,
  run VARCHAR(12) NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  titulo TEXT,
  calidad_juridica TEXT NOT NULL CHECK (calidad_juridica IN ('TITULAR', 'CONTRATA')) DEFAULT 'TITULAR',
  estamento TEXT NOT NULL DEFAULT 'DOCENTE_AULA',
  horas_contrato INTEGER NOT NULL CHECK (horas_contrato > 0 AND horas_contrato <= 44) DEFAULT 44,
  horas_subvencion_general_titular NUMERIC(5,2) DEFAULT 0.00,
  horas_subvencion_general_contrata NUMERIC(5,2) DEFAULT 0.00,
  horas_sep_titular NUMERIC(5,2) DEFAULT 0.00,
  horas_sep_contrata NUMERIC(5,2) DEFAULT 0.00,
  horas_pie_titular NUMERIC(5,2) DEFAULT 0.00,
  horas_pie_contrata NUMERIC(5,2) DEFAULT 0.00,
  horas_directivas INTEGER DEFAULT 0,
  horas_inspector_general NUMERIC(5,2) DEFAULT 0.00,
  horas_tecnico_pedagogica INTEGER DEFAULT 0,
  horas_coordinacion INTEGER DEFAULT 0,
  tipo_coordinacion TEXT,
  horas_taller_sep NUMERIC(5,2) DEFAULT 0.00,
  horas_trabajo_colaborativo NUMERIC(5,2) DEFAULT 0.00,
  horas_coordinacion_pie NUMERIC(5,2) DEFAULT 0.00,
  horas_convivencia_escolar NUMERIC(5,2) DEFAULT 0.00,
  horas_extraescolar NUMERIC(5,2) DEFAULT 0.00,
  cargo_institucional TEXT,
  horas_aula INTEGER DEFAULT 0,
  horas_ingles INTEGER DEFAULT 0,
  funcion_principal TEXT,
  funcion_secundaria TEXT,
  asignatura_principal TEXT,
  aplica_articulo_69 BOOLEAN DEFAULT FALSE,
  funciones_no_aula_json JSONB DEFAULT '[]'::jsonb,
  horas_vigentes_anterior NUMERIC(5,2) DEFAULT 0.00,
  propuesta_gdp TEXT DEFAULT 'Continuidad',
  remuneracion_mensual_app NUMERIC(14,2) DEFAULT 0.00,
  fecha_inicio_contrato DATE DEFAULT '2026-03-01',
  fecha_termino_contrato DATE DEFAULT '2027-02-28',
  accion_pme_sep TEXT,
  horas_pro_retencion NUMERIC(5,2) DEFAULT 0.00,
  descripcion_funcion_gdp TEXT,
  estado_sancion_gdp TEXT DEFAULT 'Pendiente',
  horas_aprobadas_gdp NUMERIC(5,2) DEFAULT 0.00,
  situacion_final_gdp TEXT DEFAULT 'Vigente',
  observaciones_director TEXT,
  observaciones_slep TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER trg_docentes_updated_at
BEFORE UPDATE ON public.docentes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. TABLA: ASIGNACIONES HORARIAS Y CO-DOCENCIA
CREATE TABLE IF NOT EXISTS public.asignaciones_horarias (
  id TEXT PRIMARY KEY,
  rbd VARCHAR(10) NOT NULL REFERENCES public.establecimientos(rbd) ON DELETE CASCADE,
  curso_id TEXT NOT NULL REFERENCES public.cursos_sae(id) ON DELETE CASCADE,
  docente_id TEXT NOT NULL REFERENCES public.docentes(id) ON DELETE CASCADE,
  co_docente_id TEXT,
  tiene_co_docente BOOLEAN DEFAULT FALSE,
  es_taller_jec BOOLEAN DEFAULT FALSE,
  asignatura TEXT NOT NULL,
  horas_pedagogicas_aula NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  horas_cronologicas_pie NUMERIC(5,2) DEFAULT 0.00,
  horas_colaborativas NUMERIC(5,2) DEFAULT 0.00,
  tipo_apoyo TEXT,
  periodo INTEGER NOT NULL DEFAULT 2026,
  es_taller_sep BOOLEAN DEFAULT FALSE,
  es_trabajo_colaborativo BOOLEAN DEFAULT FALSE,
  es_proporcion_docente BOOLEAN DEFAULT FALSE,
  es_co_docencia BOOLEAN DEFAULT FALSE,
  es_agrupacion_flexible BOOLEAN DEFAULT FALSE,
  cursos_compartidos_json JSONB DEFAULT '[]'::jsonb,
  es_diferenciado_compartido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. TABLA: ASISTENTES DE LA EDUCACIÓN (Ley 21.109 / GDP)
CREATE TABLE IF NOT EXISTS public.asistentes_educacion (
  id TEXT PRIMARY KEY,
  rbd VARCHAR(10) NOT NULL REFERENCES public.establecimientos(rbd) ON DELETE CASCADE,
  periodo INTEGER NOT NULL DEFAULT 2026,
  run VARCHAR(12) NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  cargo_funcion TEXT NOT NULL,
  estamento TEXT NOT NULL,
  horas_contrato NUMERIC(5,2) NOT NULL DEFAULT 44.00,
  horas_subvencion_general_indefinido NUMERIC(5,2) DEFAULT 0.00,
  horas_subvencion_general_plazo_fijo NUMERIC(5,2) DEFAULT 0.00,
  horas_sep_indefinido NUMERIC(5,2) DEFAULT 0.00,
  horas_sep_plazo_fijo NUMERIC(5,2) DEFAULT 0.00,
  horas_pie_indefinido NUMERIC(5,2) DEFAULT 0.00,
  horas_pie_plazo_fijo NUMERIC(5,2) DEFAULT 0.00,
  es_dupla_psicosocial BOOLEAN DEFAULT FALSE,
  es_equipo_pie BOOLEAN DEFAULT FALSE,
  es_tecnico_parvulo BOOLEAN DEFAULT FALSE,
  es_auxiliar_servicio BOOLEAN DEFAULT FALSE,
  es_inspector_patio BOOLEAN DEFAULT FALSE,
  observaciones TEXT,
  activo BOOLEAN DEFAULT TRUE,
  horas_vigentes_anterior NUMERIC(5,2) DEFAULT 0.00,
  propuesta_gdp TEXT DEFAULT 'Continuidad',
  remuneracion_mensual_app NUMERIC(14,2) DEFAULT 0.00,
  fecha_inicio_contrato DATE DEFAULT '2026-03-01',
  fecha_termino_contrato DATE DEFAULT '2027-02-28',
  accion_pme_sep TEXT,
  horas_pro_retencion NUMERIC(5,2) DEFAULT 0.00,
  descripcion_funcion_gdp TEXT,
  estado_sancion_gdp TEXT DEFAULT 'Pendiente',
  horas_aprobadas_gdp NUMERIC(5,2) DEFAULT 0.00,
  situacion_final_gdp TEXT DEFAULT 'Vigente',
  observaciones_director TEXT,
  observaciones_slep TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER trg_asistentes_educacion_updated_at
BEFORE UPDATE ON public.asistentes_educacion
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. TABLA: PLANES DE ESTUDIO OFICIALES MINEDUC (EPJA, TP, HC, Parvularia)
CREATE TABLE IF NOT EXISTS public.planes_estudio_mineduc (
  id TEXT PRIMARY KEY,
  nivel TEXT NOT NULL,
  regimen TEXT NOT NULL,
  categoria TEXT,
  referencia_fuente TEXT,
  horas_obligatorias NUMERIC(5,2) NOT NULL,
  horas_libre_disposicion NUMERIC(5,2) NOT NULL,
  total_horas_plan NUMERIC(5,2) NOT NULL,
  asignaturas_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. TABLA: USUARIOS DEL SISTEMA Y GESTIÓN DE SEGURIDAD
CREATE TABLE IF NOT EXISTS public.usuarios_sistema (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  nombre_completo TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_usuario', 'admin', 'asesor_uatp', 'director', 'auditor', 'visualizador')) DEFAULT 'director',
  cargo TEXT,
  rbd_asignado VARCHAR(10) REFERENCES public.establecimientos(rbd) ON DELETE SET NULL,
  cartera_rbds_json JSONB DEFAULT '[]'::jsonb,
  asesores_supervisados_json JSONB DEFAULT '[]'::jsonb,
  comunas_permitidas_json JSONB DEFAULT '[]'::jsonb,
  password_hash TEXT,
  salt TEXT,
  gemini_api_key TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER trg_usuarios_sistema_updated_at
BEFORE UPDATE ON public.usuarios_sistema
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. TABLA: CARTERA ASESOR UATP
CREATE TABLE IF NOT EXISTS public.asesor_cartera (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE CASCADE,
  rbd VARCHAR(10) NOT NULL REFERENCES public.establecimientos(rbd) ON DELETE CASCADE,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_asesor_rbd UNIQUE (usuario_id, rbd)
);

-- 10. TABLA: BLOQUEOS DE EDICIÓN CONCURRENTE
CREATE TABLE IF NOT EXISTS public.bloqueos_edicion (
  rbd VARCHAR(10) PRIMARY KEY REFERENCES public.establecimientos(rbd) ON DELETE CASCADE,
  bloqueado_por TEXT NOT NULL,
  usuario_nombre TEXT NOT NULL,
  modulo TEXT NOT NULL DEFAULT 'DOTACION_DOCENTE',
  bloqueado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expira_en TIMESTAMPTZ NOT NULL
);

-- 11. TABLA: AUDITORÍA TRANSACCIONAL
CREATE TABLE IF NOT EXISTS public.auditoria_cambios (
  id TEXT PRIMARY KEY,
  rbd VARCHAR(10) NOT NULL,
  periodo INTEGER NOT NULL DEFAULT 2026,
  tipo_evento TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id TEXT,
  descripcion TEXT NOT NULL,
  detalles_json JSONB,
  usuario_id TEXT,
  usuario_nombre TEXT,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- ÍNDICES DE RENDIMIENTO Y ACCESO RÁPIDO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_cursos_rbd_periodo ON public.cursos_sae(rbd, periodo);
CREATE INDEX IF NOT EXISTS idx_docentes_rbd_periodo ON public.docentes(rbd, periodo);
CREATE INDEX IF NOT EXISTS idx_docentes_run ON public.docentes(run);
CREATE INDEX IF NOT EXISTS idx_asignaciones_rbd_periodo ON public.asignaciones_horarias(rbd, periodo);
CREATE INDEX IF NOT EXISTS idx_asignaciones_curso ON public.asignaciones_horarias(curso_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_docente ON public.asignaciones_horarias(docente_id);
CREATE INDEX IF NOT EXISTS idx_asistentes_rbd_periodo ON public.asistentes_educacion(rbd, periodo);
CREATE INDEX IF NOT EXISTS idx_asistentes_run ON public.asistentes_educacion(run);
CREATE INDEX IF NOT EXISTS idx_salas_rbd ON public.salas_infraestructura(rbd);
CREATE INDEX IF NOT EXISTS idx_planes_estudio_nivel ON public.planes_estudio_mineduc(nivel, regimen);
CREATE INDEX IF NOT EXISTS idx_auditoria_rbd_periodo ON public.auditoria_cambios(rbd, periodo);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON public.usuarios_sistema(role);

-- ==============================================================================
-- VISTAS ANALÍTICAS Y METODOLOGÍA LEY 20.903
-- ==============================================================================
CREATE OR REPLACE VIEW public.vista_resumen_dotacion_colegio AS
SELECT
  e.rbd,
  e.nombre AS establecimiento_nombre,
  e.comuna,
  d.periodo,
  COUNT(DISTINCT d.id) AS total_docentes,
  COALESCE(SUM(d.horas_contrato), 0) AS total_horas_contrato,
  COALESCE(SUM(d.horas_aula), 0) AS total_horas_aula,
  COALESCE(SUM(d.horas_contrato - d.horas_aula), 0) AS total_horas_no_lectivas,
  COALESCE(SUM(d.horas_sep_titular + d.horas_sep_contrata), 0) AS total_horas_sep,
  COALESCE(SUM(d.horas_pie_titular + d.horas_pie_contrata), 0) AS total_horas_pie,
  ROUND(
    CASE 
      WHEN SUM(d.horas_contrato) > 0 
      THEN (SUM(d.horas_aula)::numeric / SUM(d.horas_contrato)::numeric) * 100.0 
      ELSE 0 
    END, 2
  ) AS porcentaje_horas_aula_efectivo
FROM public.establecimientos e
LEFT JOIN public.docentes d ON e.rbd = d.rbd
GROUP BY e.rbd, e.nombre, e.comuna, d.periodo;

-- ==============================================================================
-- SEGURIDAD ROW LEVEL SECURITY (RLS)
-- Políticas para permitir acceso transparente a la API REST / Frontend
-- ==============================================================================
ALTER TABLE public.establecimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salas_infraestructura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos_sae ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones_horarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistentes_educacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_estudio_mineduc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asesor_cartera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueos_edicion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_cambios ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura y escritura para el rol 'anon' y 'authenticated'
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select a todos en %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Permitir select a todos en %I" ON public.%I FOR SELECT USING (true)', tbl, tbl);
    
    EXECUTE format('DROP POLICY IF EXISTS "Permitir insert/update/delete en %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Permitir insert/update/delete en %I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;
