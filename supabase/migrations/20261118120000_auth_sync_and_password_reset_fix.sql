-- =============================================================================
-- Migración: Sincronización de Credenciales Supabase Auth y Reinicio de Claves
-- Fecha: 2026-11-18
-- Propósito:
--   1. Garantizar que el alta/edición/reset de contraseñas por Super Usuario
--      actualice auth.users, auth.identities y public.usuarios_sistema.
--   2. Permitir auto-migración segura en el login para cuentas creadas/reseteadas
--      en public.usuarios_sistema sin exponer password_hash al cliente.
--   3. Reparar las cuentas existentes en producción sin auth.users o sin confirmar.
-- =============================================================================

-- 1. Helper interno (solo invocable desde funciones SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.internal_upsert_auth_user(
  p_email TEXT,
  p_password_plain TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_uid UUID;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_pwd_to_hash TEXT;
BEGIN
  IF v_email = '' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(trim(email)) = v_email
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_uid IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password = CASE
          WHEN p_password_plain IS NOT NULL AND length(p_password_plain) > 0
            THEN extensions.crypt(p_password_plain, extensions.gen_salt('bf', 10))
          ELSE encrypted_password
        END,
        email_confirmed_at = COALESCE(email_confirmed_at, v_now),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        reauthentication_token = COALESCE(reauthentication_token, ''),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        updated_at = v_now
    WHERE id = v_uid;
  ELSE
    v_uid := gen_random_uuid();
    -- Nunca usar una clave predecible cuando no se pasa texto plano;
    -- si el usuario posee clave previa en usuarios_sistema, verify_and_sync_auth_user
    -- la sincronizará tras validar su hash en el próximo inicio de sesión.
    v_pwd_to_hash := COALESCE(
      NULLIF(p_password_plain, ''),
      gen_random_uuid()::text || encode(extensions.gen_random_bytes(16), 'hex')
    );

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      email_change_confirm_status,
      reauthentication_token,
      phone_change,
      phone_change_token,
      is_sso_user,
      is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_uid,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_pwd_to_hash, extensions.gen_salt('bf', 10)),
      v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      false,
      v_now,
      v_now,
      '',
      '',
      '',
      '',
      '',
      0,
      '',
      '',
      '',
      false,
      false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = v_uid AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_uid,
      v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email',
      NULL,
      v_now,
      v_now
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;
  END IF;

  UPDATE public.usuarios_sistema
  SET auth_uid = NULL,
      updated_at = v_now
  WHERE auth_uid = v_uid
    AND lower(trim(email)) <> v_email;

  UPDATE public.usuarios_sistema
  SET auth_uid = v_uid,
      updated_at = v_now
  WHERE lower(trim(email)) = v_email
    AND (auth_uid IS NULL OR auth_uid <> v_uid);

  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_upsert_auth_user(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- 2. RPC pública mínima para derivación PBKDF2 en cliente sin exponer password_hash
CREATE OR REPLACE FUNCTION public.get_login_challenge(p_login TEXT)
RETURNS TABLE (
  id TEXT,
  email TEXT,
  role TEXT,
  activo BOOLEAN,
  salt TEXT,
  kdf_prefix TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.email,
    u.role,
    u.activo,
    COALESCE(u.salt, '') AS salt,
    CASE
      WHEN u.password_hash LIKE 'pbkdf2_sha256$%' THEN
        split_part(u.password_hash, '$', 1) || '$' || split_part(u.password_hash, '$', 2)
      WHEN u.password_hash IS NOT NULL AND u.password_hash <> '' THEN
        'sha256'
      ELSE
        ''
    END AS kdf_prefix
  FROM public.usuarios_sistema u
  WHERE lower(trim(u.email)) = lower(trim(p_login))
     OR lower(trim(u.username)) = lower(trim(p_login))
     OR split_part(lower(trim(u.email)), '@', 1) = lower(trim(p_login))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_login_challenge(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_challenge(TEXT) TO anon, authenticated;

-- 3. RPC de verificación y sincronización automática hacia auth.users durante el login
CREATE OR REPLACE FUNCTION public.verify_and_sync_auth_user(
  p_login TEXT,
  p_password_plain TEXT,
  p_candidate_hash TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user RECORD;
  v_matched BOOLEAN := FALSE;
BEGIN
  IF p_login IS NULL OR trim(p_login) = '' OR p_password_plain IS NULL OR p_password_plain = '' THEN
    RETURN FALSE;
  END IF;

  SELECT u.id, u.email, u.password_hash, u.salt, u.activo
  INTO v_user
  FROM public.usuarios_sistema u
  WHERE lower(trim(u.email)) = lower(trim(p_login))
     OR lower(trim(u.username)) = lower(trim(p_login))
     OR split_part(lower(trim(u.email)), '@', 1) = lower(trim(p_login))
  LIMIT 1;

  IF NOT FOUND OR v_user.activo IS FALSE OR v_user.password_hash IS NULL OR v_user.password_hash = '' THEN
    RETURN FALSE;
  END IF;

  IF v_user.password_hash LIKE 'pbkdf2_sha256$%' THEN
    v_matched := (
      p_candidate_hash IS NOT NULL
      AND p_candidate_hash <> ''
      AND v_user.password_hash = p_candidate_hash
    );
  ELSE
    v_matched := (
      (p_candidate_hash IS NOT NULL AND p_candidate_hash <> '' AND v_user.password_hash = p_candidate_hash)
      OR (
        v_user.salt IS NOT NULL
        AND v_user.salt <> ''
        AND v_user.password_hash = encode(extensions.digest(p_password_plain || v_user.salt, 'sha256'), 'hex')
      )
    );
  END IF;

  IF NOT v_matched THEN
    RETURN FALSE;
  END IF;

  PERFORM public.internal_upsert_auth_user(v_user.email, p_password_plain);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_and_sync_auth_user(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_and_sync_auth_user(TEXT, TEXT, TEXT) TO anon, authenticated;

-- 4. RPC administrativa para sincronizar credenciales y auth.users desde Gestión de Usuarios
CREATE OR REPLACE FUNCTION public.admin_sync_user_credentials(
  p_user_id TEXT,
  p_email TEXT,
  p_password_plain TEXT DEFAULT NULL,
  p_password_hash TEXT DEFAULT NULL,
  p_salt TEXT DEFAULT NULL,
  p_debe_cambiar_password BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_target_email TEXT;
  v_uid UUID;
BEGIN
  IF NOT (
    public.is_slep_admin()
    OR EXISTS (
      SELECT 1 FROM public.current_slep_user() me
      WHERE me.activo = TRUE
        AND me.role IN ('super_usuario', 'subdirector_uatp', 'coordinador_uatp', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'Permiso denegado: solo administradores autorizados pueden sincronizar credenciales.';
  END IF;

  v_target_email := NULLIF(lower(trim(COALESCE(p_email, ''))), '');
  IF v_target_email IS NULL AND NULLIF(trim(COALESCE(p_user_id, '')), '') IS NOT NULL THEN
    SELECT lower(trim(email)) INTO v_target_email
    FROM public.usuarios_sistema
    WHERE id = p_user_id
    LIMIT 1;
  END IF;

  UPDATE public.usuarios_sistema
  SET password_hash = COALESCE(NULLIF(p_password_hash, ''), password_hash),
      salt = COALESCE(NULLIF(p_salt, ''), salt),
      debe_cambiar_password = COALESCE(p_debe_cambiar_password, debe_cambiar_password),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id
     OR (v_target_email IS NOT NULL AND lower(trim(email)) = v_target_email);

  v_uid := public.internal_upsert_auth_user(v_target_email, p_password_plain);
  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sync_user_credentials(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_sync_user_credentials(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- 5. Actualizar link_my_auth_uid para autoconfirmar email si quedó pendiente y limpiar colisiones
CREATE OR REPLACE FUNCTION public.link_my_auth_uid()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_confirmed TIMESTAMPTZ;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  updated_rows INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT email, email_confirmed_at
  INTO v_email, v_confirmed
  FROM auth.users
  WHERE id = v_uid
    AND deleted_at IS NULL;

  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_confirmed IS NULL THEN
    UPDATE auth.users
    SET email_confirmed_at = v_now,
        confirmation_token = COALESCE(confirmation_token, ''),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object('email_verified', true),
        updated_at = v_now
    WHERE id = v_uid;
  END IF;

  UPDATE public.usuarios_sistema
  SET auth_uid = NULL,
      updated_at = v_now
  WHERE auth_uid = v_uid
    AND lower(trim(email)) <> lower(trim(v_email));

  UPDATE public.usuarios_sistema
  SET auth_uid = v_uid,
      ultimo_acceso = v_now,
      updated_at = v_now
  WHERE lower(trim(email)) = lower(trim(v_email))
    AND (auth_uid IS NULL OR auth_uid = v_uid)
    AND activo = TRUE;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.link_my_auth_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_my_auth_uid() TO authenticated;

-- 6. Actualizar update_my_profile_secrets para permitir al propio usuario guardar su hash/clave sin bloquearse por RLS
DROP FUNCTION IF EXISTS public.update_my_profile_secrets(TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.update_my_profile_secrets(
  p_gemini_api_key TEXT DEFAULT NULL,
  p_debe_cambiar_password BOOLEAN DEFAULT NULL,
  p_password_hash TEXT DEFAULT NULL,
  p_salt TEXT DEFAULT NULL,
  p_password_plain TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  updated_rows INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.usuarios_sistema
  SET gemini_api_key = CASE WHEN p_gemini_api_key IS NOT NULL THEN NULLIF(trim(p_gemini_api_key), '') ELSE gemini_api_key END,
      debe_cambiar_password = COALESCE(p_debe_cambiar_password, debe_cambiar_password),
      password_hash = COALESCE(NULLIF(p_password_hash, ''), password_hash),
      salt = COALESCE(NULLIF(p_salt, ''), salt),
      updated_at = v_now
  WHERE auth_uid = v_uid;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  IF p_password_plain IS NOT NULL AND length(trim(p_password_plain)) > 0 THEN
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_password_plain, extensions.gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, v_now),
        updated_at = v_now
    WHERE id = v_uid;
  END IF;

  RETURN updated_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile_secrets(TEXT, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile_secrets(TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;

-- 7. Reparación inmediata de datos en producción: confirmar pendientes y aprovisionar faltantes
DO $$
DECLARE
  r RECORD;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = v_now,
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      reauthentication_token = COALESCE(reauthentication_token, ''),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('email_verified', true),
      updated_at = v_now
  WHERE email_confirmed_at IS NULL
    AND deleted_at IS NULL;

  FOR r IN
    SELECT u.email, u.password_hash, u.salt
    FROM public.usuarios_sistema u
    LEFT JOIN auth.users a
      ON lower(trim(a.email)) = lower(trim(u.email))
     AND a.deleted_at IS NULL
    WHERE u.email IS NOT NULL
      AND trim(u.email) <> ''
      AND (
        a.id IS NULL
        OR u.auth_uid IS NULL
        OR u.auth_uid <> a.id
        OR NOT EXISTS (
          SELECT 1 FROM auth.identities i WHERE i.user_id = a.id AND i.provider = 'email'
        )
      )
  LOOP
    IF r.salt IS NOT NULL
       AND r.salt <> ''
       AND r.password_hash = encode(extensions.digest('123456' || r.salt, 'sha256'), 'hex') THEN
      PERFORM public.internal_upsert_auth_user(r.email, '123456');
    ELSE
      PERFORM public.internal_upsert_auth_user(r.email, NULL);
    END IF;
  END LOOP;
END $$;
