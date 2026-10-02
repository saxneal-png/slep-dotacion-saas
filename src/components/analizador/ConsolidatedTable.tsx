import React, { useState } from 'react';
import { Search, Filter, CheckCircle2, AlertTriangle, Building2, Layers, Users, BookOpen } from 'lucide-react';
import type { SchoolSummary } from '../../types/analizadorTypes';

interface ConsolidatedTableProps {
  schools: SchoolSummary[];
  onSelectSchool?: (rbd: string) => void;
  onTransferSchool?: (rbd: string) => void;
  selectedComuna?: string;
  onSelectComuna?: (comuna: string) => void;
}

export function getComunaBadgeColor(comuna?: string): string {
  switch ((comuna || '').trim().toLowerCase()) {
    case 'chillán':
    case 'chillan':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'chillán viejo':
    case 'chillan viejo':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'bulnes':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'san ignacio':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'yungay':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'pemuco':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

export const ConsolidatedTable: React.FC<ConsolidatedTableProps> = ({
  schools,
  onSelectSchool,
  onTransferSchool,
  selectedComuna = 'ALL',
  onSelectComuna,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OK' | 'DISCREPANCY'>('ALL');
  const [localComuna, setLocalComuna] = useState<string>(selectedComuna);

  const activeComuna = onSelectComuna ? selectedComuna : localComuna;
  const handleComunaChange = (c: string) => {
    setLocalComuna(c);
    if (onSelectComuna) onSelectComuna(c);
  };

  const availableComunas = Array.from(new Set(schools.map((s) => s.comuna).filter(Boolean))) as string[];

  const filteredSchools = schools.filter((s) => {
    const matchesSearch =
      s.establishment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.rbd.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.comuna && s.comuna.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeComuna !== 'ALL' && s.comuna !== activeComuna) return false;

    if (filterStatus === 'OK') return !s.has_discrepancy;
    if (filterStatus === 'DISCREPANCY') return s.has_discrepancy;
    return true;
  });

  const totalMatricula = filteredSchools.reduce((acc, s) => acc + (s.matricula || 0), 0);
  const totalAula = filteredSchools.reduce((acc, s) => acc + s.horas_aula, 0);
  const totalDirectivas = filteredSchools.reduce((acc, s) => acc + s.horas_directivas, 0);
  const totalTecnicas = filteredSchools.reduce((acc, s) => acc + s.horas_tecnicas, 0);
  const totalGeneral = filteredSchools.reduce((acc, s) => acc + s.total_horas_ee, 0);
  const totalDocentes = filteredSchools.reduce((acc, s) => acc + s.teachers_count, 0);
  const totalCursos = filteredSchools.reduce((acc, s) => acc + (s.courses_count || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Barra de Búsqueda y Filtros */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por RBD o establecimiento..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {availableComunas.length > 1 && (
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Comuna:
              </span>
              <select
                value={activeComuna}
                onChange={(e) => handleComunaChange(e.target.value)}
                className="text-xs font-semibold bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="ALL">Todas las Comunas ({schools.length})</option>
                {availableComunas.map((com) => (
                  <option key={com} value={com}>
                    {com} ({schools.filter((s) => s.comuna === com).length})
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Estado:
          </span>
          <div className="inline-flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterStatus === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({schools.length})
            </button>
            <button
              onClick={() => setFilterStatus('OK')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterStatus === 'OK' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cuadrados ({schools.filter((s) => !s.has_discrepancy).length})
            </button>
            <button
              onClick={() => setFilterStatus('DISCREPANCY')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterStatus === 'DISCREPANCY' ? 'bg-white text-red-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Con Descuadre ({schools.filter((s) => s.has_discrepancy).length})
            </button>
          </div>
        </div>
      </div>

      {/* Tabla Oficial */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-4">RBD</th>
              <th className="py-3 px-4">Establecimiento</th>
              <th className="py-3 px-4">Comuna</th>
              <th className="py-3 px-4 text-center">Matrícula</th>
              <th className="py-3 px-4 text-center">Cursos</th>
              <th className="py-3 px-4 text-center">Docentes</th>
              <th className="py-3 px-4 text-right bg-amber-50/50 text-amber-900">Horas Aula</th>
              <th className="py-3 px-4 text-right bg-purple-50/50 text-purple-900">Horas Directivas</th>
              <th className="py-3 px-4 text-right bg-emerald-50/50 text-emerald-900">Horas Técnicas</th>
              <th className="py-3 px-4 text-right bg-blue-50/70 text-blue-900 font-bold">Total Horas EE</th>
              <th className="py-3 px-4 text-center">Estado</th>
              <th className="py-3 px-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {filteredSchools.map((s) => (
              <tr
                key={s.rbd}
                onClick={() => onSelectSchool && onSelectSchool(s.rbd)}
                className={`hover:bg-slate-50 transition-colors ${onSelectSchool ? 'cursor-pointer' : ''}`}
              >
                <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.rbd}</td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-800">{s.establishment}</div>
                  {s.modalidad_detectada && (
                    <div className="mt-0.5">
                      <span className="inline-flex items-center px-2 py-0.2 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        {s.modalidad_detectada.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  {s.comuna ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getComunaBadgeColor(s.comuna)}`}>
                      {s.comuna}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center font-mono">{s.matricula || '-'}</td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800">
                    {s.courses_count || 0}
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-mono">{s.teachers_count}</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 bg-amber-50/30">
                  {s.horas_aula.toFixed(1)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-purple-700 bg-purple-50/30">
                  {s.horas_directivas.toFixed(1)}
                </td>
                <td
                  className="py-3 px-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30"
                  title={`Desglose Técnico Fuera de Aula:\n- UTP: ${(s.horas_utp || 0).toFixed(1)}h\n- Jefaturas: ${(s.horas_jefatura || 0).toFixed(1)}h\n- Coord. PIE: ${(s.horas_coordinacion_pie || 0).toFixed(1)}h\n- Convivencia: ${(s.horas_convivencia || 0).toFixed(1)}h\n- CRA/Enlaces: ${(s.horas_cra_enlaces || 0).toFixed(1)}h\n- Extraescolar: ${(s.horas_extraescolar || 0).toFixed(1)}h`}
                >
                  <div>{s.horas_tecnicas.toFixed(1)}</div>
                  {(s.horas_utp || s.horas_jefatura || s.horas_coordinacion_pie) ? (
                    <div className="text-[10px] text-emerald-600 font-sans font-normal">
                      UTP: {s.horas_utp || 0}h | Jef: {s.horas_jefatura || 0}h
                    </div>
                  ) : null}
                </td>
                <td className="py-3 px-4 text-right font-mono font-black text-blue-900 bg-blue-50/40">
                  {s.total_horas_ee.toFixed(1)}
                </td>
                <td className="py-3 px-4 text-center">
                  {s.has_discrepancy ? (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200"
                      title={s.discrepancy_note}
                    >
                      <AlertTriangle className="w-3 h-3 text-red-600" />
                      Descuadre
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Cuadrado
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {onTransferSchool && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTransferSchool(s.rbd);
                      }}
                      className="px-2.5 py-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-lg text-[11px] font-bold shadow-xs flex items-center gap-1 mx-auto transition-all active:scale-95"
                      title={`Llevar dotación de ${s.establishment} a la aplicación oficial`}
                    >
                      <span>Llevar a la App</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-xs text-slate-800">
              <td className="py-3 px-4" colSpan={3}>
                TOTAL CONSOLIDADO ({filteredSchools.length} Establecimientos)
              </td>
              <td className="py-3 px-4 text-center font-mono">{totalMatricula}</td>
              <td className="py-3 px-4 text-center font-mono">{totalCursos}</td>
              <td className="py-3 px-4 text-center font-mono">{totalDocentes}</td>
              <td className="py-3 px-4 text-right font-mono text-amber-700">{totalAula.toFixed(1)}</td>
              <td className="py-3 px-4 text-right font-mono text-purple-700">{totalDirectivas.toFixed(1)}</td>
              <td className="py-3 px-4 text-right font-mono text-emerald-700">{totalTecnicas.toFixed(1)}</td>
              <td className="py-3 px-4 text-right font-mono text-blue-900 text-sm font-black">{totalGeneral.toFixed(1)}</td>
              <td className="py-3 px-4" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
