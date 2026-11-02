-- ==============================================================================
-- MIGRACIÓN DE PRODUCCIÓN: AJUSTES DE ESQUEMA SUPABASE POSTGRESQL 17
-- Fecha: 2026-11-02
-- Proyecto: rvvyjfgiwalqsdtpidxz (https://rvvyjfgiwalqsdtpidxz.supabase.co)
-- ==============================================================================

-- 1. Modificaciones seguras condicionales sobre tablas existentes (si ya fueron creadas)
DO $$
BEGIN
  -- 1.1 Agregar columna requerida en tabla docentes si la tabla existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'docentes'
  ) THEN
    ALTER TABLE public.docentes
    ADD COLUMN IF NOT EXISTS requiere_autorizacion_docente BOOLEAN DEFAULT FALSE;
  END IF;

  -- 1.2 Actualizar constraint de roles en usuarios_sistema si la tabla existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
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
        'director_establecimiento',
        'jefe_utp_establecimiento',
        'admin',
        'director',
        'auditor',
        'visualizador'
      )
    );
  END IF;
END $$;

-- 2. Crear tabla para Matriz de Roles y Permisos Granular en la Nube
CREATE TABLE IF NOT EXISTS public.roles_permisos (
  rol_id TEXT PRIMARY KEY,
  permisos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  actualizado_por TEXT,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Crear tabla para Bitácora de Cambios de Permisos
CREATE TABLE IF NOT EXISTS public.roles_permisos_bitacora (
  id TEXT PRIMARY KEY,
  rol_id TEXT NOT NULL,
  agregados_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  removidos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  usuario TEXT NOT NULL,
  motivo TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Crear tabla para Configuración General y Parámetros Normativos MINEDUC
CREATE TABLE IF NOT EXISTS public.configuracion_general (
  id TEXT PRIMARY KEY DEFAULT 'global',
  parametros_mineduc_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ui_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  asesores_registrados_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  actualizado_por TEXT,
  ultima_modificacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Habilitar RLS y políticas universales para Frontend transparente
ALTER TABLE public.roles_permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles_permisos_bitacora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_general ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['roles_permisos', 'roles_permisos_bitacora', 'configuracion_general']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select a todos en %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Permitir select a todos en %I" ON public.%I FOR SELECT USING (true)', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir insert/update/delete en %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Permitir insert/update/delete en %I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;
