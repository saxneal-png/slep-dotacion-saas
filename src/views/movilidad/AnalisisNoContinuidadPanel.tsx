import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Search, ShieldAlert } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Establecimiento } from '../../types';
import {
  CasoNoContinuidadItem,
  cumpleFiltroTipoEscuela,
  etiquetaCategoriaEscuela
} from './movilidadHelpers';

export interface AnalisisNoContinuidadPanelProps {
  casosNoContinuidadConsolidados: CasoNoContinuidadItem[];
  colegiosByRbd: Map<string, Establecimiento>;
  comunasDisponibles: string[];
  periodoActivo: number;
  onFeedback: (mensaje: string, tipo?: 'success' | 'error') => void;
}

export const AnalisisNoContinuidadPanel: React.FC<
  AnalisisNoContinuidadPanelProps
> = ({
  casosNoContinuidadConsolidados,
  colegiosByRbd,
  comunasDisponibles,
  periodoActivo,
  onFeedback
}) => {
  const [busquedaNcAnalisis, setBusquedaNcAnalisis] = useState<string>('');
  const [filtroEstamentoNc, setFiltroEstamentoNc] = useState<
    'TODOS' | 'DOCENTE' | 'ASISTENTE'
  >('TODOS');
  const [filtroTipoEscuelaNc, setFiltroTipoEscuelaNc] =
    useState<string>('TODOS');
  const [filtroComunaNc, setFiltroComunaNc] = useState<string>('TODAS');
  const [filtroRazonNc, setFiltroRazonNc] = useState<
    'TODAS' | 'CON_RAZON' | 'SIN_RAZON'
  >('TODAS');
  const [exportandoNc, setExportandoNc] = useState<boolean>(false);

  const casosNoContinuidadFiltrados = useMemo(() => {
    const q = busquedaNcAnalisis.toLowerCase().trim();
    return casosNoContinuidadConsolidados.filter(item => {
      if (
        filtroEstamentoNc !== 'TODOS' &&
        item.estamentoTipo !== filtroEstamentoNc
      ) {
        return false;
      }
      const est = colegiosByRbd.get(item.rbd);
      if (!cumpleFiltroTipoEscuela(est, filtroTipoEscuelaNc)) return false;
      if (filtroComunaNc !== 'TODAS' && item.comuna !== filtroComunaNc) {
        return false;
      }
      if (filtroRazonNc === 'CON_RAZON' && !item.tieneRazon) return false;
      if (filtroRazonNc === 'SIN_RAZON' && item.tieneRazon) return false;
      if (q) {
        const hit =
          item.nombreCompleto.toLowerCase().includes(q) ||
          item.run.toLowerCase().includes(q) ||
          item.establecimientoNombre.toLowerCase().includes(q) ||
          item.rbd.toLowerCase().includes(q) ||
          item.cargoEspecialidad.toLowerCase().includes(q) ||
          item.razon.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [
    casosNoContinuidadConsolidados,
    busquedaNcAnalisis,
    filtroEstamentoNc,
    filtroTipoEscuelaNc,
    filtroComunaNc,
    filtroRazonNc,
    colegiosByRbd
  ]);

  const resumenNoContinuidad = useMemo(() => {
    const docentesCount = casosNoContinuidadFiltrados.filter(
      c => c.estamentoTipo === 'DOCENTE'
    ).length;
    const asistentesCount = casosNoContinuidadFiltrados.filter(
      c => c.estamentoTipo === 'ASISTENTE'
    ).length;
    const horasTotales = casosNoContinuidadFiltrados.reduce(
      (s, c) => s + c.horasContrato,
      0
    );
    const conResguardoEstabilidad = casosNoContinuidadFiltrados.filter(
      c =>
        c.calidadJuridica === 'TITULAR' || c.calidadJuridica === 'INDEFINIDO'
    ).length;
    const sinRazonCount = casosNoContinuidadFiltrados.filter(
      c => !c.tieneRazon
    ).length;

    const porTipoEscuela = new Map<
      string,
      { cantidad: number; horas: number }
    >();
    const porRazon = new Map<string, number>();
    for (const c of casosNoContinuidadFiltrados) {
      const catLabel = etiquetaCategoriaEscuela(c.categoriaEscuela);
      const prev = porTipoEscuela.get(catLabel) || { cantidad: 0, horas: 0 };
      porTipoEscuela.set(catLabel, {
        cantidad: prev.cantidad + 1,
        horas: prev.horas + c.horasContrato
      });
      porRazon.set(c.razon, (porRazon.get(c.razon) || 0) + 1);
    }

    return {
      docentesCount,
      asistentesCount,
      horasTotales,
      conResguardoEstabilidad,
      sinRazonCount,
      porTipoEscuela: Array.from(porTipoEscuela.entries()).sort(
        (a, b) => b[1].cantidad - a[1].cantidad
      ),
      topRazones: Array.from(porRazon.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    };
  }, [casosNoContinuidadFiltrados]);

  const handleExportarExcelNoContinuidad = async () => {
    setExportandoNc(true);
    try {
      const wb = new ExcelJS.Workbook();
      const wsResumen = wb.addWorksheet('Resumen Analítico');
      wsResumen.columns = [
        { header: 'Indicador / Categoría', key: 'indicador', width: 42 },
        { header: 'Cantidad Casos', key: 'cantidad', width: 18 },
        { header: 'Horas Contrato', key: 'horas', width: 18 }
      ];
      wsResumen.getRow(1).font = { bold: true };
      wsResumen.addRow({
        indicador: 'Total Casos No Continuidad',
        cantidad: casosNoContinuidadFiltrados.length,
        horas: resumenNoContinuidad.horasTotales
      });
      wsResumen.addRow({
        indicador: 'Docentes (Ley 20.903)',
        cantidad: resumenNoContinuidad.docentesCount,
        horas: casosNoContinuidadFiltrados
          .filter(c => c.estamentoTipo === 'DOCENTE')
          .reduce((s, c) => s + c.horasContrato, 0)
      });
      wsResumen.addRow({
        indicador: 'Asistentes de la Educación (Ley 21.109)',
        cantidad: resumenNoContinuidad.asistentesCount,
        horas: casosNoContinuidadFiltrados
          .filter(c => c.estamentoTipo === 'ASISTENTE')
          .reduce((s, c) => s + c.horasContrato, 0)
      });
      wsResumen.addRow({
        indicador: 'Titulares / Indefinidos (Resguardo Art. 42)',
        cantidad: resumenNoContinuidad.conResguardoEstabilidad,
        horas: ''
      });
      wsResumen.addRow({
        indicador: 'Casos sin razón especificada',
        cantidad: resumenNoContinuidad.sinRazonCount,
        horas: ''
      });
      wsResumen.addRow({});
      wsResumen.addRow({
        indicador: 'Desglose por Tipo de Establecimiento',
        cantidad: 'Casos',
        horas: 'Horas'
      }).font = { bold: true };
      for (const [tipo, data] of resumenNoContinuidad.porTipoEscuela) {
        wsResumen.addRow({
          indicador: tipo,
          cantidad: data.cantidad,
          horas: data.horas
        });
      }

      const wsDetalle = wb.addWorksheet('Detalle No Continuidad');
      wsDetalle.columns = [
        { header: 'RBD', key: 'rbd', width: 10 },
        { header: 'Establecimiento', key: 'establecimiento', width: 34 },
        { header: 'Tipo Escuela', key: 'tipoEscuela', width: 20 },
        { header: 'Comuna', key: 'comuna', width: 16 },
        { header: 'Estamento', key: 'estamento', width: 14 },
        { header: 'RUN', key: 'run', width: 14 },
        { header: 'Nombre Completo', key: 'nombre', width: 30 },
        { header: 'Calidad Jurídica', key: 'calidad', width: 16 },
        { header: 'Cargo / Especialidad', key: 'cargo', width: 26 },
        { header: 'Horas Contrato', key: 'horas', width: 14 },
        { header: 'Fuente Financiamiento', key: 'fuente', width: 22 },
        { header: 'Propuesta GDP', key: 'propuesta', width: 20 },
        { header: 'Situación Final GDP', key: 'situacion', width: 18 },
        { header: 'Razón / Fundamento', key: 'razon', width: 48 }
      ];
      wsDetalle.getRow(1).font = { bold: true };
      for (const item of casosNoContinuidadFiltrados) {
        wsDetalle.addRow({
          rbd: item.rbd,
          establecimiento: item.establecimientoNombre,
          tipoEscuela: etiquetaCategoriaEscuela(item.categoriaEscuela),
          comuna: item.comuna,
          estamento:
            item.estamentoTipo === 'DOCENTE'
              ? 'Docente'
              : 'Asistente de la Educación',
          run: item.run,
          nombre: item.nombreCompleto,
          calidad: item.calidadJuridica,
          cargo: item.cargoEspecialidad,
          horas: item.horasContrato,
          fuente: item.fuenteFinanciamiento,
          propuesta: item.propuestaGdp,
          situacion: item.situacionFinalGdp,
          razon: item.razon
        });
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      saveAs(blob, `Analisis_No_Continuidad_SLEP_${periodoActivo}.xlsx`);
      onFeedback(
        `Exportado Excel con ${casosNoContinuidadFiltrados.length} casos de No Continuidad.`,
        'success'
      );
    } catch (e: any) {
      onFeedback(
        e?.message || 'Error al exportar Excel de No Continuidad.',
        'error'
      );
    } finally {
      setExportandoNc(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>
                Análisis Territorial de Casos de No Continuidad (
                {casosNoContinuidadFiltrados.length})
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidado de Docentes (Ley 20.903) y Asistentes de la Educación
              (Ley 21.109) con propuesta o solicitud de No Continuidad y sus
              fundamentos.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportarExcelNoContinuidad}
            disabled={exportandoNc || casosNoContinuidadFiltrados.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>
              {exportandoNc ? 'Exportando...' : 'Exportar Excel (.xlsx)'}
            </span>
          </button>
        </div>

        {/* KPIs Analíticos */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold uppercase text-slate-500">
              Total Casos
            </div>
            <div className="text-xl font-black text-slate-900 tabular-nums mt-0.5">
              {casosNoContinuidadFiltrados.length}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
            <div className="text-[10px] font-bold uppercase text-indigo-800">
              Docentes
            </div>
            <div className="text-xl font-black text-indigo-900 tabular-nums mt-0.5">
              {resumenNoContinuidad.docentesCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200">
            <div className="text-[10px] font-bold uppercase text-teal-800">
              Asistentes (AA.EE.)
            </div>
            <div className="text-xl font-black text-teal-900 tabular-nums mt-0.5">
              {resumenNoContinuidad.asistentesCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
            <div className="text-[10px] font-bold uppercase text-amber-800">
              Horas Totales
            </div>
            <div className="text-xl font-black text-amber-900 tabular-nums mt-0.5">
              {resumenNoContinuidad.horasTotales}h
            </div>
          </div>
          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
            <div className="text-[10px] font-bold uppercase text-rose-800">
              Titulares / Indefinidos
            </div>
            <div className="text-xl font-black text-rose-900 tabular-nums mt-0.5">
              {resumenNoContinuidad.conResguardoEstabilidad}
            </div>
          </div>
        </div>

        {/* Desglose por Tipo de Escuela y Top Razones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-700">
              Distribución por Tipo de Establecimiento
            </div>
            {resumenNoContinuidad.porTipoEscuela.length === 0 ? (
              <p className="text-xs text-slate-400">
                Sin registros con los filtros actuales.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {resumenNoContinuidad.porTipoEscuela.map(([tipo, data]) => (
                  <span
                    key={tipo}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 tabular-nums"
                  >
                    {tipo}: {data.cantidad} ({data.horas}h)
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-700">
              Principales Razones Registradas (
              {resumenNoContinuidad.sinRazonCount} sin razón)
            </div>
            {resumenNoContinuidad.topRazones.length === 0 ? (
              <p className="text-xs text-slate-400">Sin razones registradas.</p>
            ) : (
              <div className="space-y-1">
                {resumenNoContinuidad.topRazones.map(([razon, cnt]) => (
                  <div
                    key={razon}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-slate-700 truncate">{razon}</span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-[10px] tabular-nums shrink-0">
                      {cnt}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <div className="relative md:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={busquedaNcAnalisis}
              onChange={e => setBusquedaNcAnalisis(e.target.value)}
              placeholder="Buscar por nombre, RUN, escuela, especialidad o razón..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>

          <select
            value={filtroEstamentoNc}
            onChange={e =>
              setFiltroEstamentoNc(
                e.target.value as 'TODOS' | 'DOCENTE' | 'ASISTENTE'
              )
            }
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
          >
            <option value="TODOS">Todos los estamentos</option>
            <option value="DOCENTE">Solo Docentes</option>
            <option value="ASISTENTE">Solo Asistentes (AA.EE.)</option>
          </select>

          <select
            value={filtroTipoEscuelaNc}
            onChange={e => setFiltroTipoEscuelaNc(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
          >
            <option value="TODOS">Todo tipo de escuela</option>
            <option value="CAT:ESCUELA">Escuelas</option>
            <option value="CAT:LICEO">Liceos</option>
            <option value="CAT:JARDIN_VTF">Jardines / Salas Cuna VTF</option>
            <option value="ESCUELA_BASICA">Escuela Básica</option>
            <option value="LICEO_HC">Liceo HC</option>
            <option value="LICEO_TP">Liceo TP</option>
            <option value="LICEO_POLIVALENTE">Liceo Polivalente</option>
            <option value="ESCUELA_ESPECIAL">Escuela Especial</option>
            <option value="EPJA">EPJA</option>
          </select>

          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={filtroComunaNc}
              onChange={e => setFiltroComunaNc(e.target.value)}
              className="px-2 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
            >
              <option value="TODAS">Comunas</option>
              {comunasDisponibles.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={filtroRazonNc}
              onChange={e =>
                setFiltroRazonNc(
                  e.target.value as 'TODAS' | 'CON_RAZON' | 'SIN_RAZON'
                )
              }
              className="px-2 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
            >
              <option value="TODAS">Razón: Todas</option>
              <option value="CON_RAZON">Con razón</option>
              <option value="SIN_RAZON">Sin razón</option>
            </select>
          </div>
        </div>

        {/* Tabla de Casos */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
              <tr>
                <th className="p-2.5">Estamento</th>
                <th className="p-2.5">Funcionario / RUN</th>
                <th className="p-2.5">Establecimiento / Tipo</th>
                <th className="p-2.5">Calidad / Horas</th>
                <th className="p-2.5">Cargo / Especialidad</th>
                <th className="p-2.5">Propuesta / Estado</th>
                <th className="p-2.5">Razón / Fundamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {casosNoContinuidadFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No se registran casos de No Continuidad para los filtros
                    seleccionados.
                  </td>
                </tr>
              ) : (
                casosNoContinuidadFiltrados.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                          item.estamentoTipo === 'DOCENTE'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : 'bg-teal-50 text-teal-800 border-teal-200'
                        }`}
                      >
                        {item.estamentoTipo === 'DOCENTE'
                          ? 'Docente'
                          : 'Asistente'}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <div className="font-bold text-slate-900">
                        {item.nombreCompleto}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {item.run}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold text-slate-800">
                        {item.establecimientoNombre}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {etiquetaCategoriaEscuela(item.categoriaEscuela)} ·{' '}
                        {item.comuna} · RBD {item.rbd}
                      </div>
                    </td>
                    <td className="p-2.5 tabular-nums">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.calidadJuridica === 'TITULAR' ||
                          item.calidadJuridica === 'INDEFINIDO'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.calidadJuridica}
                      </span>
                      <div className="text-[11px] font-black text-slate-800 mt-0.5">
                        {item.horasContrato}h
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.fuenteFinanciamiento}
                      </div>
                    </td>
                    <td className="p-2.5 text-slate-700">
                      {item.cargoEspecialidad}
                    </td>
                    <td className="p-2.5">
                      <div className="font-bold text-rose-700">
                        {item.propuestaGdp}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.situacionFinalGdp}
                      </div>
                    </td>
                    <td className="p-2.5 max-w-xs">
                      <span
                        className={
                          item.tieneRazon
                            ? 'text-slate-800'
                            : 'text-amber-700 italic'
                        }
                      >
                        {item.razon}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
