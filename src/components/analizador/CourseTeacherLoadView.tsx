import React, { useState, useMemo } from 'react';
import {
  Users,
  BookOpen,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  School,
  GraduationCap,
  Sparkles
} from 'lucide-react';
import type { TeacherConsolidatedLoad, CourseLoadSummary, SchoolSummary } from '../../types/analizadorTypes';

import { getComunaBadgeColor } from './ConsolidatedTable';

interface CourseTeacherLoadViewProps {
  teacherLoads: TeacherConsolidatedLoad[];
  courses: CourseLoadSummary[];
  schools: SchoolSummary[];
  selectedRbd: string;
  onSelectRbd: (rbd: string) => void;
  selectedComuna?: string;
  onSelectComuna?: (comuna: string) => void;
}

export const CourseTeacherLoadView: React.FC<CourseTeacherLoadViewProps> = ({
  teacherLoads,
  courses,
  schools,
  selectedRbd,
  onSelectRbd,
  selectedComuna = 'ALL',
  onSelectComuna,
}) => {
  const [subView, setSubView] = useState<'DOCENTES' | 'CURSOS'>('DOCENTES');
  const [searchTerm, setSearchTerm] = useState('');
  const [localComuna, setLocalComuna] = useState<string>(selectedComuna);
  const [expandedTeacherRuts, setExpandedTeacherRuts] = useState<Set<string>>(new Set());
  const [expandedCourseKeys, setExpandedCourseKeys] = useState<Set<string>>(new Set());

  const activeComuna = onSelectComuna ? selectedComuna : localComuna;
  const handleComunaChange = (c: string) => {
    setLocalComuna(c);
    if (onSelectComuna) onSelectComuna(c);
  };

  const availableComunas = Array.from(new Set(schools.map((s) => s.comuna).filter(Boolean))) as string[];

  const toggleTeacher = (rut: string) => {
    setExpandedTeacherRuts((prev) => {
      const next = new Set(prev);
      if (next.has(rut)) next.delete(rut);
      else next.add(rut);
      return next;
    });
  };

  const toggleCourse = (key: string) => {
    setExpandedCourseKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Filtrado por escuela, comuna y búsqueda
  const filteredTeachers = useMemo(() => {
    return teacherLoads.filter((d) => {
      if (selectedRbd && selectedRbd !== 'ALL' && d.rbd !== selectedRbd) return false;
      if (activeComuna !== 'ALL' && d.comuna !== activeComuna) return false;
      const q = searchTerm.toLowerCase();
      if (!q) return true;
      const matchTeacher = d.teacher_name.toLowerCase().includes(q) || d.rut.toLowerCase().includes(q) || (d.comuna && d.comuna.toLowerCase().includes(q));
      const matchCourse = d.cursos.some((c) => c.curso.toLowerCase().includes(q) || c.asignatura.toLowerCase().includes(q));
      return matchTeacher || matchCourse;
    });
  }, [teacherLoads, selectedRbd, activeComuna, searchTerm]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (selectedRbd && selectedRbd !== 'ALL' && c.rbd !== selectedRbd) return false;
      if (activeComuna !== 'ALL' && c.comuna !== activeComuna) return false;
      const q = searchTerm.toLowerCase();
      if (!q) return true;
      const matchCourse = c.curso.toLowerCase().includes(q) || (c.comuna && c.comuna.toLowerCase().includes(q));
      const matchTeacher = c.docentes.some((d) => d.teacher_name.toLowerCase().includes(q) || d.asignatura.toLowerCase().includes(q));
      return matchCourse || matchTeacher;
    });
  }, [courses, selectedRbd, activeComuna, searchTerm]);

  // Contadores analíticos
  const totalDocentes = filteredTeachers.length;
  const cuadradasCount = filteredTeachers.filter((d) => d.estado_carga === 'CUADRADA').length;
  const subasignadasCount = filteredTeachers.filter((d) => d.estado_carga === 'SUBASIGNADA').length;
  const sobreasignadasCount = filteredTeachers.filter((d) => d.estado_carga === 'SOBREASIGNADA').length;
  const excesoLegalCount = filteredTeachers.filter((d) => d.is_over_legal_limit).length;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Barra de Control y Selector de Modo */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Selector de Comuna */}
          {availableComunas.length > 1 && (
            <select
              value={activeComuna}
              onChange={(e) => handleComunaChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todas las Comunas</option>
              {availableComunas.map((com) => (
                <option key={com} value={com}>
                  {com} ({schools.filter((s) => s.comuna === com).length})
                </option>
              ))}
            </select>
          )}

          {/* Selector de Escuela */}
          <select
            value={selectedRbd}
            onChange={(e) => onSelectRbd(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-500 max-w-xs truncate"
          >
            <option value="ALL">Todos los Establecimientos ({schools.length})</option>
            {schools.map((s) => (
              <option key={s.rbd} value={s.rbd}>
                RBD {s.rbd} - {s.establishment}
              </option>
            ))}
          </select>

          {/* Segmented Control Dual: Docente vs Curso */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setSubView('DOCENTES')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                subView === 'DOCENTES'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Por Docente ({filteredTeachers.length})</span>
            </button>
            <button
              onClick={() => setSubView('CURSOS')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                subView === 'CURSOS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Por Curso ({filteredCourses.length})</span>
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar docente, curso o asignatura..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Mini Resumen de Carga Docente */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Carga Cuadrada (100%)</div>
            <div className="text-base font-black text-slate-800">{cuadradasCount} profesores</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Subasignados (Horas Libres)</div>
            <div className="text-base font-black text-amber-700">{subasignadasCount} profesores</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Sobreasignados (&gt; Contrato)</div>
            <div className="text-base font-black text-orange-700">{sobreasignadasCount} profesores</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Exceso Legal (&gt; 44h Art. 80)</div>
            <div className="text-base font-black text-red-700">{excesoLegalCount} profesores</div>
          </div>
        </div>
      </div>

      {/* VISTA 1: POR DOCENTE */}
      {subView === 'DOCENTES' && (
        <div className="space-y-3">
          {filteredTeachers.map((docente) => {
            const isExpanded = expandedTeacherRuts.has(docente.rut || docente.teacher_name);
            const pct = docente.horas_contrato > 0
              ? Math.min(100, Math.round((docente.total_asignado / docente.horas_contrato) * 100))
              : 100;

            const badgeColor =
              docente.estado_carga === 'CUADRADA'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : docente.estado_carga === 'EXCESO_LEGAL'
                ? 'bg-red-50 text-red-800 border-red-200'
                : docente.estado_carga === 'SOBREASIGNADA'
                ? 'bg-orange-50 text-orange-800 border-orange-200'
                : 'bg-amber-50 text-amber-800 border-amber-200';

            return (
              <div
                key={docente.rut || docente.teacher_name}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Cabecera del Docente */}
                <div
                  onClick={() => toggleTeacher(docente.rut || docente.teacher_name)}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 select-none transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{docente.teacher_name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${badgeColor}`}>
                          {docente.estado_carga === 'CUADRADA' ? '✓ Carga Cuadrada' :
                           docente.estado_carga === 'EXCESO_LEGAL' ? '⚠️ Exceso Legal >44h' :
                           docente.estado_carga === 'SOBREASIGNADA' ? `⚠️ Sobrecarga (+${docente.diferencia.toFixed(1)}h)` :
                           `⚠️ Pendiente (${docente.diferencia.toFixed(1)}h)`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono">{docente.rut || 'Sin RUN'}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700">{docente.establishment}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-400">RBD {docente.rbd}</span>
                        {docente.comuna && (
                          <>
                            <span>•</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getComunaBadgeColor(docente.comuna)}`}>
                              {docente.comuna}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Barra de Carga Horaria */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {docente.total_asignado.toFixed(1)}h <span className="text-slate-400">/ {docente.horas_contrato.toFixed(1)}h</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold">
                        Aula: {docente.horas_aula.toFixed(1)}h | Téc: {docente.horas_tecnicas.toFixed(1)}h | Dir: {docente.horas_directivas.toFixed(1)}h
                      </div>
                    </div>
                    <div className="w-28 bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all ${
                          docente.is_over_legal_limit
                            ? 'bg-red-500'
                            : docente.estado_carga === 'SOBREASIGNADA'
                            ? 'bg-orange-500'
                            : docente.estado_carga === 'SUBASIGNADA'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Acordeón de Cursos y Asignaciones */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 divide-y divide-slate-200/60">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-orange-500" />
                      Cursos y Carga Horaria Asignada ({docente.cursos.length})
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-500 text-[10px] uppercase font-bold">
                            <th className="py-2">Curso</th>
                            <th className="py-2">Asignatura / Actividad</th>
                            <th className="py-2">Tipo</th>
                            <th className="py-2 text-right">Horas Asignadas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/40">
                          {docente.cursos.map((c, cIdx) => (
                            <tr key={cIdx} className="hover:bg-slate-100/50">
                              <td className="py-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-100 text-orange-800">
                                  {c.curso}
                                </span>
                              </td>
                              <td className="py-2 font-medium text-slate-800">{c.asignatura}</td>
                              <td className="py-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                  c.tipo === 'AULA' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {c.tipo || 'AULA'}
                                </span>
                              </td>
                              <td className="py-2 text-right font-mono font-bold text-slate-900">
                                {c.horas.toFixed(1)} hrs
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VISTA 2: POR CURSO */}
      {subView === 'CURSOS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCourses.map((c) => {
            const courseKey = `${c.rbd}-${c.curso}`;
            const isExpanded = expandedCourseKeys.has(courseKey);
            const targetHours = c.horas_plan_estudio || (c.total_horas > 0 ? c.total_horas : 38);
            const coveragePct = Math.min(100, Math.round((c.total_horas / targetHours) * 100));

            return (
              <div
                key={courseKey}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between"
              >
                <div className="p-4 border-b border-slate-100 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black bg-orange-100 text-orange-900">
                        <GraduationCap className="w-3.5 h-3.5" />
                        {c.curso}
                      </div>
                      {c.modalidad && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {c.modalidad.replace(/_/g, ' ')}
                        </span>
                      )}
                      {c.especialidad_tp && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          {c.especialidad_tp}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.estado_cobertura === 'CUBIERTO' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ Plan Cubierto ({c.total_horas.toFixed(1)}h / {c.horas_plan_estudio}h)
                        </span>
                      )}
                      {c.estado_cobertura === 'DEFICIT' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                          ⚠️ Déficit Plan (-{Math.abs(c.diferencia_horas_plan || 0).toFixed(1)}h | {c.porcentaje_cobertura_plan}%)
                        </span>
                      )}
                      {c.estado_cobertura === 'SUPERAVIT' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                          ℹ️ Superávit (+{c.diferencia_horas_plan?.toFixed(1)}h | {c.porcentaje_cobertura_plan}%)
                        </span>
                      )}
                      {(!c.estado_cobertura || c.estado_cobertura === 'SIN_PLAN') && (
                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg">
                          {c.total_horas.toFixed(1)} hrs totales
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Plan de Estudio de Referencia Mineduc */}
                  {c.plan_referencia && (
                    <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                      <span className="text-slate-600 font-medium truncate max-w-[280px]">
                        📋 <span className="font-semibold text-slate-800">{c.plan_referencia}</span>
                      </span>
                      <span className="font-mono font-bold text-slate-700">
                        {c.horas_plan_estudio}h Mineduc
                      </span>
                    </div>
                  )}

                  {/* Barra de Cobertura de Horas del Plan */}
                  {c.horas_plan_estudio ? (
                    <div className="space-y-1 pt-0.5">
                      <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                        <span>Horas Asignadas: {c.total_horas.toFixed(1)}h</span>
                        <span>Cobertura: {c.porcentaje_cobertura_plan}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full rounded-full transition-all ${
                            c.estado_cobertura === 'DEFICIT'
                              ? 'bg-amber-500'
                              : c.estado_cobertura === 'SUPERAVIT'
                              ? 'bg-indigo-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, c.porcentaje_cobertura_plan || 0)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold mt-1">
                    <span>{c.establishment} (RBD {c.rbd})</span>
                    {c.comuna && (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getComunaBadgeColor(c.comuna)}`}>
                        {c.comuna}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-2 flex-1">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Profesores Asignados ({c.docentes.length}):
                  </div>
                  <div className="space-y-1.5">
                    {c.docentes.slice(0, isExpanded ? c.docentes.length : 3).map((d, dIdx) => (
                      <div
                        key={dIdx}
                        className="p-2 rounded-xl bg-slate-50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{d.teacher_name}</div>
                          <div className="text-[10px] text-slate-500">{d.asignatura}</div>
                        </div>
                        <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          {d.horas.toFixed(1)}h
                        </span>
                      </div>
                    ))}
                  </div>

                  {c.docentes.length > 3 && (
                    <button
                      onClick={() => toggleCourse(courseKey)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 pt-1"
                    >
                      {isExpanded ? 'Ver menos' : `Ver todos (${c.docentes.length} profesores)`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
