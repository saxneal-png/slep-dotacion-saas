-- =============================================================================
-- Migración Completa y Autocontenida: Auth UID, RLS Estricto, Pausa UATP y Paridad SQLite <-> Postgres
-- Fecha: 2026-11-17
-- Seguro e idempotente incluso si 20261112 / 20261113 no fueron aplicadas previamente.
-- =============================================================================

-- 0. Agregar auth_uid en usuarios_sistema y pre-vincular cuentas confirmadas en auth.users
ALTER TABLE public.usuarios_sistema
  ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_auth_uid ON public.usuarios_sistema(auth_uid);

UPDATE public.usuarios_sistema u
SET auth_uid = a.id,
    updated_at = timezone('utc'::text, now())
FROM auth.users a
WHERE u.auth_uid IS NULL
  AND a.email_confirmed_at IS NOT NULL
  AND lower(trim(u.email)) = lower(trim(a.email));

-- 1. Normalizar JSONB escalares stringificados a arrays nativos en usuarios_sistema
UPDATE public.usuarios_sistema
SET cartera_rbds_json = CASE
      WHEN jsonb_typeof(cartera_rbds_json) = 'string' THEN (cartera_rbds_json #>> '{}')::jsonb
      ELSE cartera_rbds_json
    END,
    asesores_supervisados_json = CASE
      WHEN jsonb_typeof(asesores_supervisados_json) = 'string' THEN (asesores_supervisados_json #>> '{}')::jsonb
      ELSE asesores_supervisados_json
    END,
    comunas_permitidas_json = CASE
      WHEN jsonb_typeof(comunas_permitidas_json) = 'string' THEN (comunas_permitidas_json #>> '{}')::jsonb
      ELSE comunas_permitidas_json
    END
WHERE jsonb_typeof(cartera_rbds_json) = 'string'
   OR jsonb_typeof(asesores_supervisados_json) = 'string'
   OR jsonb_typeof(comunas_permitidas_json) = 'string';

-- 2. Paridad de esquema: updated_at + columnas faltantes + NULLables para vacantes
ALTER TABLE public.salas_infraestructura
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.asignaciones_horarias
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS codigo_asignatura TEXT,
  ADD COLUMN IF NOT EXISTS ambito_curricular TEXT;

ALTER TABLE public.asignaciones_horarias
  ALTER COLUMN curso_id DROP NOT NULL,
  ALTER COLUMN docente_id DROP NOT NULL;

DROP TRIGGER IF EXISTS trg_salas_updated_at ON public.salas_infraestructura;
CREATE TRIGGER trg_salas_updated_at
  BEFORE UPDATE ON public.salas_infraestructura
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_asignaciones_updated_at ON public.asignaciones_horarias;
CREATE TRIGGER trg_asignaciones_updated_at
  BEFORE UPDATE ON public.asignaciones_horarias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_docentes_updated_at ON public.docentes(updated_at);
CREATE INDEX IF NOT EXISTS idx_cursos_updated_at ON public.cursos_sae(updated_at);
CREATE INDEX IF NOT EXISTS idx_asignaciones_updated_at ON public.asignaciones_horarias(updated_at);
CREATE INDEX IF NOT EXISTS idx_asistentes_updated_at ON public.asistentes_educacion(updated_at);

-- 3. Tablas faltantes en remoto
CREATE TABLE IF NOT EXISTS public.establecimientos_eliminados (
  rbd TEXT PRIMARY KEY,
  eliminado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  motivo TEXT
);

CREATE TABLE IF NOT EXISTS public.planes_estudio_colegio (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL REFERENCES public.establecimientos(rbd) ON DELETE CASCADE,
  nivel TEXT NOT NULL,
  modalidad TEXT,
  especialidad_tp TEXT,
  asignaturas_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS trg_planes_colegio_updated_at ON public.planes_estudio_colegio;
CREATE TRIGGER trg_planes_colegio_updated_at
  BEFORE UPDATE ON public.planes_estudio_colegio
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.planes_estudio_colegio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establecimientos_eliminados ENABLE ROW LEVEL SECURITY;

-- 4. Funciones auxiliares RBAC y Pausa UATP (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.current_slep_user()
RETURNS TABLE (
  id TEXT,
  role TEXT,
  rbd_asignado VARCHAR(10),
  cartera_rbds_json JSONB,
  asesores_supervisados_json JSONB,
  activo BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.role, u.rbd_asignado, u.cartera_rbds_json, u.asesores_supervisados_json, u.activo
  FROM public.usuarios_sistema u
  WHERE u.auth_uid = auth.uid()
  LIMIT 1;
$$;

-- Restringido exclusivamente a super_usuario
CREATE OR REPLACE FUNCTION public.is_slep_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_sistema u
    WHERE u.auth_uid = auth.uid()
      AND u.activo = TRUE
      AND u.role = 'super_usuario'
  );
$$;

-- Verifica Pausa de Revisión Interna UATP en configuracion_general.ui_config_json
CREATE OR REPLACE FUNCTION public.is_pausa_uatp_activa_para_mi()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_sistema u
    JOIN public.configuracion_general cg ON cg.id = 'pausa_revision_interna'
    WHERE u.auth_uid = auth.uid()
      AND u.role IN ('director_establecimiento', 'jefe_utp_establecimiento', 'director_colegio', 'director')
      AND COALESCE((cg.ui_config_json->>'activa')::boolean, false) = true
      AND (
        cg.ui_config_json->'rolesPausados' IS NULL
        OR cg.ui_config_json->'rolesPausados' ? u.role
      )
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
        u.role IN ('super_usuario', 'subdirector_uatp', 'admin', 'auditor', 'visualizador')
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

CREATE OR REPLACE FUNCTION public.can_write_rbd(target_rbd TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.is_pausa_uatp_activa_para_mi()
     AND public.can_access_rbd(target_rbd)
     AND EXISTS (
       SELECT 1 FROM public.current_slep_user() u
       WHERE u.activo = TRUE
         AND u.role NOT IN ('auditor', 'visualizador')
     );
$$;

-- 5. RPCs de Auth seguras
CREATE OR REPLACE FUNCTION public.resolve_login_profile(p_login TEXT)
RETURNS TABLE (
  id TEXT,
  email TEXT,
  role TEXT,
  activo BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email, u.role, u.activo
  FROM public.usuarios_sistema u
  WHERE lower(trim(u.email)) = lower(trim(p_login))
     OR lower(trim(u.username)) = lower(trim(p_login))
     OR split_part(lower(trim(u.email)), '@', 1) = lower(trim(p_login))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_profile(TEXT) TO anon, authenticated;

-- Exige email_confirmed_at IS NOT NULL en auth.users
CREATE OR REPLACE FUNCTION public.link_my_auth_uid()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  updated_rows INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_uid
    AND email_confirmed_at IS NOT NULL;

  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.usuarios_sistema
  SET auth_uid = v_uid,
      ultimo_acceso = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE lower(trim(email)) = lower(trim(v_email))
    AND (auth_uid IS NULL OR auth_uid = v_uid)
    AND activo = TRUE;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.link_my_auth_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_my_auth_uid() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_profile_secrets(
  p_gemini_api_key TEXT DEFAULT NULL,
  p_debe_cambiar_password BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_rows INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.usuarios_sistema
  SET gemini_api_key = CASE WHEN p_gemini_api_key IS NOT NULL THEN NULLIF(trim(p_gemini_api_key), '') ELSE gemini_api_key END,
      debe_cambiar_password = COALESCE(p_debe_cambiar_password, debe_cambiar_password),
      updated_at = timezone('utc'::text, now())
  WHERE auth_uid = auth.uid();

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile_secrets(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile_secrets(TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pausa_revision_publica()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.ui_config_json
  FROM public.configuracion_general c
  WHERE c.id = 'pausa_revision_interna'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_pausa_revision_publica() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pausa_revision_publica() TO anon, authenticated;

-- 6. Limpiar políticas abiertas heredadas y aplicar RLS estricto
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
    'planes_estudio_colegio'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select a todos en %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir insert/update/delete en %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_select_rbd_%I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_write_rbd_%I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_update_rbd_%I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_delete_rbd_%I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_planes_colegio_select" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_planes_colegio_write" ON public.%I', tbl);

    EXECUTE format(
      'CREATE POLICY "rls_select_rbd_%I" ON public.%I FOR SELECT TO authenticated USING (public.can_access_rbd(rbd))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "rls_write_rbd_%I" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_rbd(rbd))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "rls_update_rbd_%I" ON public.%I FOR UPDATE TO authenticated USING (public.can_write_rbd(rbd)) WITH CHECK (public.can_write_rbd(rbd))',
      tbl, tbl
    );
    IF tbl <> 'establecimientos' THEN
      EXECUTE format(
        'CREATE POLICY "rls_delete_rbd_%I" ON public.%I FOR DELETE TO authenticated USING (public.can_write_rbd(rbd))',
        tbl, tbl
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY "rls_delete_rbd_%I" ON public.%I FOR DELETE TO authenticated USING (public.is_slep_admin())',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

-- auditoria_cambios: append-only (SELECT por RBD, INSERT si can_write_rbd, DELETE/UPDATE solo super_usuario)
ALTER TABLE public.auditoria_cambios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select a todos en auditoria_cambios" ON public.auditoria_cambios;
DROP POLICY IF EXISTS "Permitir insert/update/delete en auditoria_cambios" ON public.auditoria_cambios;
DROP POLICY IF EXISTS "rls_select_rbd_auditoria_cambios" ON public.auditoria_cambios;
DROP POLICY IF EXISTS "rls_write_rbd_auditoria_cambios" ON public.auditoria_cambios;
DROP POLICY IF EXISTS "rls_insert_rbd_auditoria_cambios" ON public.auditoria_cambios;
CREATE POLICY "rls_select_rbd_auditoria_cambios" ON public.auditoria_cambios
  FOR SELECT TO authenticated USING (public.can_access_rbd(rbd));
CREATE POLICY "rls_insert_rbd_auditoria_cambios" ON public.auditoria_cambios
  FOR INSERT TO authenticated WITH CHECK (public.can_write_rbd(rbd));

-- Tablas JISC: exigir can_access_rbd/can_write_rbd sin fallback abierto
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['jisc_niveles_parvularia', 'jisc_turnos_personal', 'jisc_parvulos_b3']
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_%I_rbd_scope" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_select_%I" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_write_%I" ON public.%I', tbl, tbl);
      EXECUTE format('CREATE POLICY "rls_select_%I" ON public.%I FOR SELECT TO authenticated USING (public.can_access_rbd(rbd))', tbl, tbl);
      EXECUTE format('CREATE POLICY "rls_write_%I" ON public.%I FOR ALL TO authenticated USING (public.can_write_rbd(rbd)) WITH CHECK (public.can_write_rbd(rbd))', tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- usuarios_sistema, asesor_cartera, roles_permisos, configuracion_general, planes_estudio_mineduc, establecimientos_eliminados
ALTER TABLE public.usuarios_sistema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select a todos en usuarios_sistema" ON public.usuarios_sistema;
DROP POLICY IF EXISTS "Permitir insert/update/delete en usuarios_sistema" ON public.usuarios_sistema;
DROP POLICY IF EXISTS "rls_select_usuarios_sistema" ON public.usuarios_sistema;
DROP POLICY IF EXISTS "rls_write_usuarios_sistema" ON public.usuarios_sistema;
CREATE POLICY "rls_select_usuarios_sistema" ON public.usuarios_sistema
  FOR SELECT TO authenticated
  USING (
    auth_uid = auth.uid()
    OR public.is_slep_admin()
    OR EXISTS (
      SELECT 1 FROM public.current_slep_user() me
      WHERE me.activo = TRUE
        AND me.role IN ('subdirector_uatp', 'coordinador_uatp', 'admin')
    )
  );
CREATE POLICY "rls_write_usuarios_sistema" ON public.usuarios_sistema
  FOR ALL TO authenticated
  USING (public.is_slep_admin())
  WITH CHECK (public.is_slep_admin());

ALTER TABLE public.asesor_cartera ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select a todos en asesor_cartera" ON public.asesor_cartera;
DROP POLICY IF EXISTS "Permitir insert/update/delete en asesor_cartera" ON public.asesor_cartera;
DROP POLICY IF EXISTS "rls_select_asesor_cartera" ON public.asesor_cartera;
DROP POLICY IF EXISTS "rls_write_asesor_cartera" ON public.asesor_cartera;
CREATE POLICY "rls_select_asesor_cartera" ON public.asesor_cartera
  FOR SELECT TO authenticated
  USING (public.is_slep_admin() OR EXISTS (SELECT 1 FROM public.current_slep_user() u WHERE u.id = asesor_cartera.usuario_id));
CREATE POLICY "rls_write_asesor_cartera" ON public.asesor_cartera
  FOR ALL TO authenticated USING (public.is_slep_admin()) WITH CHECK (public.is_slep_admin());

ALTER TABLE public.configuracion_general ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select a todos en configuracion_general" ON public.configuracion_general;
DROP POLICY IF EXISTS "Permitir insert/update/delete en configuracion_general" ON public.configuracion_general;
DROP POLICY IF EXISTS "rls_select_configuracion_general" ON public.configuracion_general;
DROP POLICY IF EXISTS "rls_write_configuracion_general" ON public.configuracion_general;
CREATE POLICY "rls_select_configuracion_general" ON public.configuracion_general
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rls_write_configuracion_general" ON public.configuracion_general
  FOR ALL TO authenticated USING (public.is_slep_admin()) WITH CHECK (public.is_slep_admin());

ALTER TABLE public.roles_permisos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select a todos en roles_permisos" ON public.roles_permisos;
DROP POLICY IF EXISTS "Permitir insert/update/delete en roles_permisos" ON public.roles_permisos;
DROP POLICY IF EXISTS "rls_select_roles_permisos" ON public.roles_permisos;
DROP POLICY IF EXISTS "rls_write_roles_permisos" ON public.roles_permisos;
CREATE POLICY "rls_select_roles_permisos" ON public.roles_permisos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rls_write_roles_permisos" ON public.roles_permisos
  FOR ALL TO authenticated USING (public.is_slep_admin()) WITH CHECK (public.is_slep_admin());

ALTER TABLE public.roles_permisos_bitacora ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select a todos en roles_permisos_bitacora" ON public.roles_permisos_bitacora;
DROP POLICY IF EXISTS "Permitir insert/update/delete en roles_permisos_bitacora" ON public.roles_permisos_bitacora;
DROP POLICY IF EXISTS "rls_select_roles_bitacora" ON public.roles_permisos_bitacora;
DROP POLICY IF EXISTS "rls_write_roles_bitacora" ON public.roles_permisos_bitacora;
CREATE POLICY "rls_select_roles_bitacora" ON public.roles_permisos_bitacora
  FOR SELECT TO authenticated USING (public.is_slep_admin());
CREATE POLICY "rls_write_roles_bitacora" ON public.roles_permisos_bitacora
  FOR ALL TO authenticated USING (public.is_slep_admin()) WITH CHECK (public.is_slep_admin());

ALTER TABLE public.planes_estudio_mineduc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select a todos en planes_estudio_mineduc" ON public.planes_estudio_mineduc;
DROP POLICY IF EXISTS "Permitir insert/update/delete en planes_estudio_mineduc" ON public.planes_estudio_mineduc;
DROP POLICY IF EXISTS "rls_select_planes_mineduc" ON public.planes_estudio_mineduc;
DROP POLICY IF EXISTS "rls_write_planes_mineduc" ON public.planes_estudio_mineduc;
CREATE POLICY "rls_select_planes_mineduc" ON public.planes_estudio_mineduc
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rls_write_planes_mineduc" ON public.planes_estudio_mineduc
  FOR ALL TO authenticated USING (public.is_slep_admin()) WITH CHECK (public.is_slep_admin());

DROP POLICY IF EXISTS "Permitir select a todos en establecimientos_eliminados" ON public.establecimientos_eliminados;
DROP POLICY IF EXISTS "Permitir insert/update/delete a todos en establecimientos_elimi" ON public.establecimientos_eliminados;
DROP POLICY IF EXISTS "rls_est_eliminados_admin" ON public.establecimientos_eliminados;
DROP POLICY IF EXISTS "rls_select_est_eliminados" ON public.establecimientos_eliminados;
DROP POLICY IF EXISTS "rls_write_est_eliminados" ON public.establecimientos_eliminados;
CREATE POLICY "rls_select_est_eliminados" ON public.establecimientos_eliminados
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rls_write_est_eliminados" ON public.establecimientos_eliminados
  FOR ALL TO authenticated USING (public.is_slep_admin()) WITH CHECK (public.is_slep_admin());
