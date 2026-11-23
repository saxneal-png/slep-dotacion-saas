-- Migración: Ciclo de vida de necesidades de vacante (BORRADOR / ENVIADA / CANCELADA)
-- y Registro de Movimientos de la Mesa de Movilidad Territorial

ALTER TABLE IF EXISTS public.docentes
  ADD COLUMN IF NOT EXISTS estado_necesidad TEXT,
  ADD COLUMN IF NOT EXISTS motivo_estado_necesidad TEXT;

CREATE TABLE IF NOT EXISTS public.movilidad_registro_movimientos (
  id TEXT PRIMARY KEY,
  periodo INTEGER NOT NULL DEFAULT 2027,
  tipo_movimiento TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id TEXT NOT NULL,
  codigo_referencia TEXT,
  rbd_origen TEXT NOT NULL,
  nombre_establecimiento TEXT,
  comuna TEXT,
  rbd_destino TEXT,
  usuario_actor TEXT NOT NULL,
  rol_actor TEXT,
  estado_anterior TEXT,
  estado_nuevo TEXT,
  descripcion TEXT NOT NULL,
  motivo TEXT,
  detalles_json JSONB,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movilidad_registro_periodo
  ON public.movilidad_registro_movimientos (periodo, fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_movilidad_registro_rbd
  ON public.movilidad_registro_movimientos (rbd_origen, tipo_movimiento);
