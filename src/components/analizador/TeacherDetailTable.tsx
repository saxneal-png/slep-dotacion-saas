import React, { useState } from 'react';
import { Search, BookOpen, Wrench, Shield, Edit2, Sparkles, CheckSquare, Square, ChevronDown, AlertTriangle, Layers, Clock, Building2 } from 'lucide-react';
import type { TeacherRecord, SchoolSummary } from '../../types/analizadorTypes';
import { getComunaBadgeColor } from './ConsolidatedTable';

interface TeacherDetailTableProps {
  teachers: TeacherRecord[];
  schools: SchoolSummary[];
  selectedRbd: string;
  onSelectRbd: (rbd: string) => void;
  selectedComuna?: string;
  onSelectComuna?: (comuna: string) => void;
  onReclassify: (teacherIndex: number, newCategory: 'AULA' | 'TECNICA' | 'DIRECTIVA') => Promise<void>;
  onBulkReclassify?: (indices: number[], newCategory: 'AULA' | 'TECNICA' | 'DIRECTIVA') => Promise<void>;
}

export const TeacherDetailTable: React.FC<TeacherDetailTableProps> = ({
  teachers,
  schools,
  selectedRbd,
  onSelectRbd,
  selectedComuna = 'ALL',
  onSelectComuna,
  onReclassify,
  onBulkReclassify,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [loadFilter, setLoadFilter] = useState<string>('ALL');
  const [localComuna, setLocalComuna] = useState<string>(selectedComuna);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const activeComuna = onSelectComuna ? selectedComuna : localComuna;
  const handleComunaChange = (c: string) => {
    setLocalComuna(c);
    if (onSelectComuna) onSelectComuna(c);
  };

  const availableComunas = Array.from(new Set(teachers.map((t) => t.comuna).filter(Boolean))) as string[];

  const getRowKey = (t: TeacherRecord): string => t.id || String(teachers.indexOf(t));

  const filteredTeachers = teachers.filter((t) => {
    if (selectedRbd && selectedRbd !== 'ALL' && t.rbd !== selectedRbd) return false;
    if (activeComuna !== 'ALL' && t.comuna !== activeComuna) return false;
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
    if (loadFilter !== 'ALL' && t.estado_carga !== loadFilter) return false;

    const matchText = `${t.teacher_name} ${t.rut} ${t.activity} ${t.establishment} ${t.comuna || ''} ${t.curso || ''}`.toLowerCase();
    return matchText.includes(searchTerm.toLowerCase());
  });

  const allFilteredIds = filteredTeachers.map((t) => getRowKey(t));
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkReclassify = async (newCategory: 'AULA' | 'TECNICA' | 'DIRECTIVA') => {
    setBulkLoading(true);
    try {
      const indicesToUpdate: number[] = [];
      filteredTeachers.forEach((t) => {
        const id = getRowKey(t);
        if (selectedIds.has(id)) {
          const originalIndex = teachers.indexOf(t);
          if (originalIndex >= 0) indicesToUpdate.push(originalIndex);
        }
      });

      if (indicesToUpdate.length > 0) {
        if (onBulkReclassify) {
          await onBulkReclassify(indicesToUpdate, newCategory);
        } else {
          for (const idx of indicesToUpdate) {
            await onReclassify(idx, newCategory);
          }
        }
      }
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const selectedCount = allFilteredIds.filter((id) => selectedIds.has(id)).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Barra de Filtros y Búsqueda */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Selector de Colegio */}
          {/* Selector de Comuna */}
          {availableComunas.length > 1 && (
            <select
              value={activeComuna}
              onChange={(e) => handleComunaChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todas las Comunas</option>
              {availableComunas.map((com) => (
                <option key={com} value={com}>
                  {com} ({teachers.filter((t) => t.comuna === com).length})
                </option>
              ))}
            </select>
          )}

          {/* Selector de Colegio */}
          <select
            value={selectedRbd}
            onChange={(e) => onSelectRbd(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-500 max-w-xs truncate"
          >
            <option value="ALL">Todos los Establecimientos ({schools.length})</option>
            {schools.map((s) => (
              <option key={s.rbd} value={s.rbd}>
                RBD {s.rbd} - {s.establishment}
              </option>
            ))}
          </select>

          {/* Filtro Categoría */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Todas las Categorías</option>
            <option value="AULA">Aula</option>
            <option value="TECNICA">Técnica</option>
            <option value="DIRECTIVA">Directiva</option>
          </select>

          {/* Filtro Carga */}
          <select
            value={loadFilter}
            onChange={(e) => setLoadFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Todo Estado Carga</option>
            <option value="CUADRADA">Carga Cuadrada</option>
            <option value="SUBASIGNADA">Subasignada (Pendiente)</option>
            <option value="SOBREASIGNADA">Sobreasignada</option>
            <option value="EXCESO_LEGAL">Exceso Legal (&gt;44h)</option>
          </select>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar docente, RUT, curso o materia..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Barra de Acciones Masivas */}
      {selectedCount > 0 && (
        <div className="p-3 px-4 bg-blue-50 border-b border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-blue-900 font-bold">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span>{selectedCount} registro{selectedCount > 1 ? 's' : ''} seleccionado{selectedCount > 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-semibold">Reclasificar masivamente a:</span>
            <button
              onClick={() => handleBulkReclassify('AULA')}
              disabled={bulkLoading}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              Aula
            </button>
            <button
              onClick={() => handleBulkReclassify('TECNICA')}
              disabled={bulkLoading}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              Técnica
            </button>
            <button
              onClick={() => handleBulkReclassify('DIRECTIVA')}
              disabled={bulkLoading}
              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              Directiva
            </button>
          </div>
        </div>
      )}

      {/* Tabla de Detalle */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-4 w-10 text-center">
                <button
                  onClick={toggleSelectAll}
                  className="text-slate-500 hover:text-slate-800"
                  title="Seleccionar todos"
                >
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="py-3 px-4">Docente / RUT</th>
              <th className="py-3 px-4">Establecimiento</th>
              <th className="py-3 px-4">Actividad / Asignatura</th>
              <th className="py-3 px-4">Curso(s) Asignado(s)</th>
              <th className="py-3 px-4 text-right">Horas</th>
              <th className="py-3 px-4 text-center">Categoría</th>
              <th className="py-3 px-4 text-center">Carga Asignada</th>
              <th className="py-3 px-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {filteredTeachers.map((t, idx) => {
              const rowKey = getRowKey(t);
              const isSelected = selectedIds.has(rowKey);
              const originalIndex = teachers.indexOf(t);

              const badgeColor =
                t.category === 'AULA'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : t.category === 'TECNICA'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-purple-100 text-purple-800 border-purple-200';

              const contractHours = t.total_declared || t.hours;
              const assignedHours = t.total_teacher_hours || t.hours;
              const diff = Math.round((assignedHours - contractHours) * 100) / 100;

              return (
                <tr
                  key={rowKey}
                  className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                >
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => toggleSelectRow(rowKey)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{t.teacher_name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{t.rut || 'Sin RUT'}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800 truncate max-w-[180px]">{t.establishment}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono text-slate-400">RBD {t.rbd}</span>
                      {t.comuna && (
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold border ${getComunaBadgeColor(t.comuna)}`}>
                          {t.comuna}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-800">{t.activity}</span>
                    {t.tipo_funcion_fuera_aula && t.tipo_funcion_fuera_aula !== 'AULA_REGULAR' && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {t.tipo_funcion_fuera_aula.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={t.source}>
                      {t.source}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {t.cursos_asignados && t.cursos_asignados.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {t.cursos_asignados.map((c, cIdx) => (
                          <span
                            key={cIdx}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : t.curso ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
                        {t.curso}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic">Sin curso</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {t.hours.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badgeColor}`}>
                      {t.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {assignedHours.toFixed(1)}h / {contractHours.toFixed(1)}h
                      </span>
                      {t.is_over_legal_limit ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-100 text-red-800 border border-red-200 mt-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> &gt;44h Legal
                        </span>
                      ) : diff > 0.5 ? (
                        <span className="text-[9px] font-bold text-orange-600 mt-0.5">
                          +{diff.toFixed(1)}h sobrecarga
                        </span>
                      ) : diff < -0.5 ? (
                        <span className="text-[9px] font-bold text-amber-600 mt-0.5">
                          {diff.toFixed(1)}h pendiente
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-emerald-600 mt-0.5">
                          ✓ 100% Cuadrada
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="relative inline-block text-left">
                      <button
                        onClick={() => setEditingIndex(editingIndex === idx ? null : idx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                        title="Cambiar categoría de esta función"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {editingIndex === idx && (
                        <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-200 z-30 py-1 text-left">
                          {(['AULA', 'TECNICA', 'DIRECTIVA'] as const).map((cat) => (
                            <button
                              key={cat}
                              onClick={async () => {
                                setEditingIndex(null);
                                await onReclassify(originalIndex, cat);
                              }}
                              className={`w-full px-3 py-1.5 text-xs font-bold text-left hover:bg-slate-50 transition-colors ${
                                t.category === cat ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
