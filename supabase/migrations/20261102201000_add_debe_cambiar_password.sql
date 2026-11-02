-- Migración para añadir soporte de cambio obligatorio de contraseña en primer acceso
ALTER TABLE public.usuarios_sistema
ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE;
