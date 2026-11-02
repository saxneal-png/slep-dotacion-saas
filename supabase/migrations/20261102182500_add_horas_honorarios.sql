-- Migración: Agregar apartado de horas honorarios para asistentes de la educación
ALTER TABLE public.asistentes_educacion ADD COLUMN IF NOT EXISTS horas_honorarios NUMERIC(5,2) DEFAULT 0.00;
