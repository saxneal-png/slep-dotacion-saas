-- Migración: Soporte para vacantes de cargos Asistentes de la Educación (Ley 21.109)
ALTER TABLE IF EXISTS public.asistentes_educacion
  ADD COLUMN IF NOT EXISTS es_vacante_nn BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tipo_vacante TEXT,
  ADD COLUMN IF NOT EXISTS justificacion_vacante TEXT,
  ADD COLUMN IF NOT EXISTS estado_necesidad TEXT,
  ADD COLUMN IF NOT EXISTS motivo_estado_necesidad TEXT;
