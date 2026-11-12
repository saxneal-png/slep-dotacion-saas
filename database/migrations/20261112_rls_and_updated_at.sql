-- ==============================================================================
-- MIGRACIÓN: Sincronización Incremental (updated_at), Retención y RLS Estricto
-- Fecha: 2026-11-12
-- NOTA: Ejecutar en Supabase SQL Editor DESPUÉS de vincular auth_uid en usuarios_sistema
-- ==============================================================================

-- 1. Agregar updated_at y triggers para sincronización incremental (ahorro de egress)
ALTER TABLE public.salas_infraestructura
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.asignaciones_horarias
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

DROP TRIGGER IF EXISTS trg_salas_updated_at ON public.salas_infraestructura;
CREATE TRIGGER trg_salas_updated_at
  BEFORE UPDATE ON public.salas_infraestructura
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_asignaciones_updated_at ON public.asignaciones_horarias;
CREATE TRIGGER trg_asignaciones_updated_at
  BEFORE UPDATE ON public.asignaciones_horarias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Índices para consultas incrementales por fecha
CREATE INDEX IF NOT EXISTS idx_docentes_updated_at ON public.docentes(updated_at);
CREATE INDEX IF NOT EXISTS idx_cursos_updated_at ON public.cursos_sae(updated_at);
CREATE INDEX IF NOT EXISTS idx_asignaciones_updated_at ON public.asignaciones_horarias(updated_at);
CREATE INDEX IF NOT EXISTS idx_asistentes_updated_at ON public.asistentes_educacion(updated_at);

-- 2. Vincular usuarios_sistema con Supabase Auth (auth.users)
ALTER TABLE public.usuarios_sistema
  ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_auth_uid ON public.usuarios_sistema(auth_uid);

-- 3. Funciones auxiliares RBAC (SECURITY DEFINER para evitar recursión en RLS)
CREATE OR REPLACE FUNCTION public.current_slep_user()
RETURNS TABLE (
  id TEXT,
  role TEXT,
  rbd_asignado VARCHAR(10),
  cartera_rbds_json JSONB,
  activo BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.role, u.rbd_asignado, u.cartera_rbds_json, u.activo
  FROM public.usuarios_sistema u
  WHERE u.auth_uid = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_slep_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.current_slep_user() u
    WHERE u.activo = TRUE
      AND u.role IN ('super_usuario', 'subdirector_uatp', 'coordinador_uatp', 'admin')
  );
$$;

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
        u.role IN ('super_usuario', 'subdirector_uatp', 'coordinador_uatp', 'admin', 'auditor', 'visualizador')
        OR (u.role IN ('director_establecimiento', 'jefe_utp_establecimiento', 'director') AND u.rbd_asignado = target_rbd)
        OR (
          u.role = 'asesor_uatp' AND (
            u.cartera_rbds_json ? target_rbd
            OR EXISTS (
              SELECT 1 FROM public.asesor_cartera ac
              WHERE ac.usuario_id = u.id AND ac.rbd = target_rbd
            )
          )
        )
      )
  );
$$;

-- 4. Función de retención para mantener la BD dentro del límite gratuito (500 MB)
CREATE OR REPLACE FUNCTION public.purgar_auditoria_antigua(dias_retencion INTEGER DEFAULT 180)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eliminados INTEGER := 0;
BEGIN
  DELETE FROM public.auditoria_cambios
  WHERE fecha_hora < (timezone('utc'::text, now()) - make_interval(days => dias_retencion));
  GET DIAGNOSTICS eliminados = ROW_COUNT;
  RETURN eliminados;
END;
$$;

-- 5. Políticas RLS estrictas por tabla (reemplazan USING (true))
-- Tablas territoriales con columna rbd:
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'establecimientos',
    'salas_infraestructura',
    'cursos_sae',
    'docentes',
    'asignaciones_horarias',
    'asistentes_educacion',
    'bloqueos_edicion',
    'auditoria_cambios'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select a todos en %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir insert/update/delete en %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_select_rbd_%I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_write_rbd_%I" ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY "rls_select_rbd_%I" ON public.%I FOR SELECT TO authenticated USING (public.can_access_rbd(rbd))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "rls_write_rbd_%I" ON public.%I FOR ALL TO authenticated USING (public.can_access_rbd(rbd)) WITH CHECK (public.can_access_rbd(rbd))',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Tabla usuarios_sistema: cada usuario ve su perfil; solo admins gestionan todos
DROP POLICY IF EXISTS "Permitir select a todos en usuarios_sistema" ON public.usuarios_sistema;
DROP POLICY IF EXISTS "Permitir insert/update/delete en usuarios_sistema" ON public.usuarios_sistema;
CREATE POLICY "rls_select_usuarios" ON public.usuarios_sistema
  FOR SELECT TO authenticated
  USING (auth_uid = auth.uid() OR public.is_slep_admin());
CREATE POLICY "rls_write_usuarios" ON public.usuarios_sistema
  FOR ALL TO authenticated
  USING (public.is_slep_admin())
  WITH CHECK (public.is_slep_admin());

-- Catálogos globales (lectura autenticada, escritura admin)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['planes_estudio_mineduc', 'roles_permisos', 'configuracion_general']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select a todos en %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir insert/update/delete en %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "rls_select_auth_%I" ON public.%I FOR SELECT TO authenticated USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "rls_write_admin_%I" ON public.%I FOR ALL TO authenticated USING (public.is_slep_admin()) WITH CHECK (public.is_slep_admin())', tbl, tbl);
  END LOOP;
END $$;
