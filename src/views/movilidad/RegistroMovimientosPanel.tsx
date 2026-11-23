import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Download,
  History,
  RefreshCw,
  Search,
  User
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Establecimiento,
  RegistroMovimientoMovilidad,
  TipoMovimientoMovilidad
} from '../../types';
import { listarRegistroMovimientosMovilidad } from '../../services/movilidadTerritorialService';

export interface RegistroMovimientosPanelProps {
  periodoActivo: number;
  colegios: Establecimiento[];
}

const ETIQUETAS_TIPO: Record<TipoMovimientoMovilidad, { label: string; color: string }> = {
  CREACION_NECESIDAD: { label: 'Creación Necesidad', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  EDICION_NECESIDAD: { label: 'Edición Borrador', color: 'bg-sky-100 text-sky-900 border-sky-300' },
  ENVIO_MOVILIDAD: { label: 'Envío a Movilidad', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  RETROCESO_NECESIDAD: { label: 'Retroceso a Borrador', color: 'bg-amber-100 text-amber-950 border-amber-300' },
  CANCELACION_NECESIDAD: { label: 'Cancelación Necesidad', color: 'bg-rose-100 text-rose-900 border-rose-300' },
  SOLICITUD_MOVILIDAD: { label: 'Solicitud Movilidad', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
  CAMBIO_ESTADO_SOLICITUD: { label: 'Cambio Estado Solicitud', color: 'bg-purple-100 text-purple-900 border-purple-300' },
  PROPUESTA_CALCE: { label: 'Propuesta Calce', color: 'bg-teal-100 text-teal-900 border-teal-300' },
  ELIMINACION_CALCE: { label: 'Eliminación Calce', color: 'bg-orange-100 text-orange-900 border-orange-300' },
  CONSOLIDACION_ESCENARIO: { label: 'Consolidación Escenario', color: 'bg-emerald-700 text-white border-emerald-800' },
  REVERSION_ESCENARIO: { label: 'Reversión Escenario', color: 'bg-rose-700 text-white border-rose-800' }
};

export const RegistroMovimientosPanel: React.FC<RegistroMovimientosPanelProps> = ({
  periodoActivo,
  colegios
}) => {
  const [registros, setRegistros] = useState<RegistroMovimientoMovilidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | TipoMovimientoMovilidad>('TODOS');
  const [filtroRbd, setFiltroRbd] = useState<string>('TODOS');

  const colegiosByRbd = useMemo(() => new Map(colegios.map(c => [c.rbd, c])), [colegios]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const lista = await listarRegistroMovimientosMovilidad({
        periodo: periodoActivo,
        limit: 500
      });
      setRegistros(lista);
    } finally {
      setCargando(false);
    }
  }, [periodoActivo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return registros.filter(r => {
      if (filtroTipo !== 'TODOS' && r.tipoMovimiento !== filtroTipo) return false;
      if (filtroRbd !== 'TODOS' && r.rbdOrigen !== filtroRbd && r.rbdDestino !== filtroRbd) return false;
      if (!q) return true;
      const nombreEst = r.nombreEstablecimiento || colegiosByRbd.get(r.rbdOrigen)?.nombre || '';
      const texto = `${r.codigoReferencia || ''} ${r.rbdOrigen} ${nombreEst} ${r.comuna || ''} ${r.usuarioActor} ${r.descripcion} ${r.motivo || ''}`.toLowerCase();
      return texto.includes(q);
    });
  }, [registros, filtroTipo, filtroRbd, busqueda, colegiosByRbd]);

  const handleExportarExcel = () => {
    const filas = filtrados.map(r => {
      const est = colegiosByRbd.get(r.rbdOrigen);
      return {
        'Fecha y Hora': new Date(r.fechaHora).toLocaleString('es-CL'),
        'Tipo Movimiento': ETIQUETAS_TIPO[r.tipoMovimiento]?.label || r.tipoMovimiento,
        'Entidad': r.entidad,
        'Código / Referencia': r.codigoReferencia || r.entidadId,
        'RBD Origen': r.rbdOrigen,
        'Establecimiento': r.nombreEstablecimiento || est?.nombre || '',
        'Comuna': r.comuna || est?.comuna || '',
        'RBD Destino': r.rbdDestino || '',
        'Usuario Actor': r.usuarioActor,
        'Rol': r.rolActor || '',
        'Estado Anterior': r.estadoAnterior || '',
        'Estado Nuevo': r.estadoNuevo || '',
        'Descripción': r.descripcion,
        'Motivo': r.motivo || ''
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, 'Registro_Movimientos');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `Registro_Movimientos_Movilidad_${periodoActivo}.xlsx`
    );
  };

  return (
    <section className="card-elevated p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            <span>Registro de Movimientos, Solicitudes y Cambios ({filtrados.length})</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Trazabilidad completa de quién, desde qué establecimiento, en qué fecha/hora y qué cambio produjo en necesidades y movilidad.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={filtrados.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-45"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código VAC, usuario, escuela, motivo..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value as 'TODOS' | TipoMovimientoMovilidad)}
          className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
        >
          <option value="TODOS">Todos los tipos de movimiento</option>
          {(Object.keys(ETIQUETAS_TIPO) as TipoMovimientoMovilidad[]).map(t => (
            <option key={t} value={t}>
              {ETIQUETAS_TIPO[t].label}
            </option>
          ))}
        </select>

        <select
          value={filtroRbd}
          onChange={e => setFiltroRbd(e.target.value)}
          className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
        >
          <option value="TODOS">Todos los establecimientos</option>
          {colegios
            .slice()
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
            .map(c => (
              <option key={c.rbd} value={c.rbd}>
                {c.nombre} (RBD {c.rbd})
              </option>
            ))}
        </select>
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className="p-8 text-center text-xs text-slate-500">Cargando registro de movimientos...</div>
      ) : filtrados.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
          No se encontraron movimientos con los filtros actuales.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="py-2 px-2.5">Fecha / Hora</th>
                <th className="py-2 px-2.5">Movimiento</th>
                <th className="py-2 px-2.5">Establecimiento (De dónde)</th>
                <th className="py-2 px-2.5">Actor (Quién)</th>
                <th className="py-2 px-2.5">Referencia / Estado</th>
                <th className="py-2 px-2.5">Detalle y Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map(r => {
                const badge = ETIQUETAS_TIPO[r.tipoMovimiento] || {
                  label: r.tipoMovimiento,
                  color: 'bg-slate-100 text-slate-800 border-slate-300'
                };
                const est = colegiosByRbd.get(r.rbdOrigen);
                const nombreEst = r.nombreEstablecimiento || est?.nombre || (r.rbdOrigen === 'SLEP' ? 'Nivel Central SLEP' : `RBD ${r.rbdOrigen}`);
                const comunaEst = r.comuna || est?.comuna;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/70 align-top">
                    <td className="py-2.5 px-2.5 whitespace-nowrap tabular-nums text-[11px] text-slate-700 font-medium">
                      {new Date(r.fechaHora).toLocaleString('es-CL')}
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5">
                      <div className="flex items-start gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-slate-900">{nombreEst}</div>
                          <div className="text-[10px] text-slate-500">
                            RBD {r.rbdOrigen}
                            {comunaEst ? ` · ${comunaEst}` : ''}
                            {r.rbdDestino ? ` → Destino RBD ${r.rbdDestino}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5">
                      <div className="flex items-start gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-slate-800">{r.usuarioActor}</div>
                          {r.rolActor && (
                            <div className="text-[10px] text-slate-500 font-mono">{r.rolActor}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      {r.codigoReferencia && (
                        <div className="font-mono text-[11px] font-black text-indigo-700">
                          {r.codigoReferencia}
                        </div>
                      )}
                      {(r.estadoAnterior || r.estadoNuevo) && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 mt-0.5">
                          {r.estadoAnterior && <span>{r.estadoAnterior}</span>}
                          {r.estadoAnterior && r.estadoNuevo && <ArrowRight className="w-3 h-3" />}
                          {r.estadoNuevo && <span className="text-slate-900">{r.estadoNuevo}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 max-w-md">
                      <div className="text-slate-800">{r.descripcion}</div>
                      {r.motivo && (
                        <div className="text-[11px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded mt-1 inline-block border border-amber-200">
                          <strong>Motivo:</strong> {r.motivo}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
