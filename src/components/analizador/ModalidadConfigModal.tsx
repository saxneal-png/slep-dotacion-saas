import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, Layers, BookOpen, Sparkles, Building2, HelpCircle, ChevronDown, ChevronRight, Edit3 } from 'lucide-react';
import { TipoModalidadEstudio, SchoolSummary, CourseLoadSummary } from '../../types/analizadorTypes';
import { PlanEstudioCurricular } from '../../types';
import { getPlanesEstudioAnalizadorCache, buscarPlanEstudioAnalizador } from '../../services/analizador/planesEstudioBridge';

interface ModalidadConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: SchoolSummary[];
  courses: CourseLoadSummary[];
  onApplyModalities: (
    updatedSchools: SchoolSummary[],
    updatedCourses: CourseLoadSummary[]
  ) => void;
}

const MODALIDAD_LABELS: Record<TipoModalidadEstudio, { label: string; badgeColor: string; desc: string }> = {
  REGULAR_BASICA: {
    label: 'Básica y Parvularia Regular',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    desc: 'NT1 a 8° Básico con planes regulares de 30 a 38 horas semanales.',
  },
  REGULAR_MEDIA_HC: {
    label: 'Media Humanístico-Científica',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    desc: '1° a 4° Medio HC con formación general y diferenciada de 42 horas JEC.',
  },
  MEDIA_TP: {
    label: 'Media Técnico-Profesional (TP)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    desc: '3° y 4° Medio con especialidades modulares (Agropecuaria, Mecánica, etc.).',
  },
  POLIVALENTE_MIXTO: {
    label: 'Liceo Polivalente (HC + TP)',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    desc: 'Establecimiento con ramas formativas científico-humanista y técnico-profesional.',
  },
  EPJA_BASICA: {
    label: 'Adultos Básica (EPJA)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    desc: 'Decreto 257 (1°, 2° y 3° Nivel Básico de Adultos).',
  },
  EPJA_MEDIA_HC: {
    label: 'Adultos Media HC (EPJA)',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    desc: 'Decretos 1000/2110 (1° y 2° Nivel Medio Humanístico-Científico).',
  },
  EPJA_MEDIA_TP: {
    label: 'Adultos Media TP / Oficios',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
    desc: 'Formación técnica y oficios de adultos con módulos prácticos.',
  },
  RURAL_MULTIGRADO: {
    label: 'Rural Multigrado',
    badgeColor: 'bg-lime-100 text-lime-800 border-lime-200',
    desc: 'Aulas combinadas rurales (1° a 6° básico) con horas adaptadas.',
  },
  ESPECIAL: {
    label: 'Educación Especial / Lenguaje',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    desc: 'Escuelas especiales y de trastornos del lenguaje (Dto 170 / Dto 1300).',
  },
};

export const ModalidadConfigModal: React.FC<ModalidadConfigModalProps> = ({
  isOpen,
  onClose,
  schools,
  courses,
  onApplyModalities,
}) => {
  if (!isOpen) return null;

  const planesDisponibles: PlanEstudioCurricular[] = getPlanesEstudioAnalizadorCache();

  // Estados locales para ajustes por establecimiento
  const [selectedModalities, setSelectedModalities] = useState<Record<string, TipoModalidadEstudio>>(() => {
    const map: Record<string, TipoModalidadEstudio> = {};
    schools.forEach((s) => {
      map[s.rbd || s.establishment] = s.modalidad_confirmada || s.modalidad_detectada || 'REGULAR_BASICA';
    });
    return map;
  });

  const [selectedRegimen, setSelectedRegimen] = useState<Record<string, 'JEC' | 'No JEC'>>(() => {
    const map: Record<string, 'JEC' | 'No JEC'> = {};
    schools.forEach((s) => {
      map[s.rbd || s.establishment] = 'JEC';
    });
    return map;
  });

  // Estado local para asociación de planes de estudio por curso (`${rbd}-${curso}` -> planId)
  const [coursePlansMap, setCoursePlansMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    courses.forEach((c) => {
      const key = `${c.rbd}-${c.curso}`;
      if (c.plan_estudio_id) {
        map[key] = c.plan_estudio_id;
      } else if (c.plan_referencia) {
        const found = planesDisponibles.find((p) => p.nivel === c.plan_referencia);
        if (found) map[key] = found.id;
      }
    });
    return map;
  });

  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(() => {
    return new Set(schools.map((s) => s.rbd || s.establishment));
  });

  const toggleSchoolExpanded = (key: string) => {
    setExpandedSchools((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleModalityChange = (schoolKey: string, mod: TipoModalidadEstudio) => {
    setSelectedModalities((prev) => ({ ...prev, [schoolKey]: mod }));
  };

  const handleRegimenChange = (schoolKey: string, reg: 'JEC' | 'No JEC') => {
    setSelectedRegimen((prev) => ({ ...prev, [schoolKey]: reg }));
  };

  const handleCoursePlanChange = (courseKey: string, planId: string) => {
    setCoursePlansMap((prev) => ({ ...prev, [courseKey]: planId }));
  };

  const handleAutoAssignSchoolPlans = (school: SchoolSummary) => {
    const sKey = school.rbd || school.establishment;
    const reg = selectedRegimen[sKey] || 'JEC';
    const schoolCourses = courses.filter((c) => c.rbd === school.rbd || c.establishment === school.establishment);

    const newMap = { ...coursePlansMap };
    schoolCourses.forEach((c) => {
      const cKey = `${c.rbd}-${c.curso}`;
      const autoPlan = buscarPlanEstudioAnalizador(c.nivel, reg) || buscarPlanEstudioAnalizador(c.curso, reg);
      if (autoPlan) {
        newMap[cKey] = autoPlan.id;
      }
    });
    setCoursePlansMap(newMap);
  };

  const handleSave = () => {
    const updatedSchools = schools.map((s) => {
      const key = s.rbd || s.establishment;
      const mod = selectedModalities[key] || s.modalidad_detectada || 'REGULAR_BASICA';
      return {
        ...s,
        modalidad_confirmada: mod,
        modalidad_ambigua: false,
      };
    });

    const updatedCourses = courses.map((c) => {
      const sKey = c.rbd || c.establishment;
      const cKey = `${c.rbd}-${c.curso}`;
      const schoolMod = selectedModalities[sKey];
      const schoolReg = selectedRegimen[sKey] || c.regimen || 'JEC';
      const assignedPlanId = coursePlansMap[cKey];
      const assignedPlan = assignedPlanId ? planesDisponibles.find((p) => p.id === assignedPlanId) : null;

      let planRef = c.plan_referencia;
      let horasPlan = c.horas_plan_estudio;
      let horasOblig = c.horas_obligatorias_plan;
      let horasLibre = c.horas_libre_disposicion_plan;
      let catPlan = c.categoria_plan;
      let estadoCob = c.estado_cobertura;
      let diffHoras = c.diferencia_horas_plan;
      let pctCob = c.porcentaje_cobertura_plan;

      if (assignedPlan) {
        planRef = assignedPlan.nivel;
        horasPlan = assignedPlan.totalHorasPlan || assignedPlan.totalHorasSemanalesObligatorias;
        horasOblig = assignedPlan.totalHorasSemanalesObligatorias;
        horasLibre = assignedPlan.horasLibreDisposicion || 0;
        catPlan = assignedPlan.categoria;

        const diff = Math.round((c.total_horas - horasPlan) * 100) / 100;
        diffHoras = diff;
        pctCob = horasPlan > 0 ? Math.round((c.total_horas / horasPlan) * 100) : 100;
        estadoCob = Math.abs(diff) <= 0.5 ? 'CUBIERTO' : diff < -0.5 ? 'DEFICIT' : 'SUPERAVIT';
      }

      return {
        ...c,
        regimen: schoolReg,
        modalidad: c.modalidad || schoolMod,
        plan_estudio_id: assignedPlanId || c.plan_estudio_id,
        plan_referencia: planRef,
        horas_plan_estudio: horasPlan,
        horas_obligatorias_plan: horasOblig,
        horas_libre_disposicion_plan: horasLibre,
        categoria_plan: catPlan,
        estado_cobertura: estadoCob,
        diferencia_horas_plan: diffHoras,
        porcentaje_cobertura_plan: pctCob,
      };
    });

    onApplyModalities(updatedSchools, updatedCourses);
    onClose();
  };

  // Agrupar planes disponibles por categoría para el selector
  const planesAgrupados = planesDisponibles.reduce((acc, p) => {
    const cat = p.categoria || 'OTRO';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, PlanEstudioCurricular[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  Modalidades Educativas y Asociación de Planes de Estudio
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Auditoría Curricular Activa
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Asocia individualmente a cada curso detectado su plan de estudio oficial (horas obligatorias, electivos y libre disposición).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Asociación Directa de Planes de Estudio por Curso</span>
              <p className="text-blue-800">
                Puedes cambiar la modalidad institucional del colegio y vincular un plan curricular específico a cada curso (ej. Básica JEC 38h, Media TP 42h con su especialidad o EPJA Adultos 2024). El sistema recalculará en tiempo real el déficit o superávit docente.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>Establecimientos y Cursos Detectados ({schools.length})</span>
              </h4>
            </div>

            <div className="space-y-4">
              {schools.map((school) => {
                const sKey = school.rbd || school.establishment;
                const currentMod = selectedModalities[sKey] || school.modalidad_detectada || 'REGULAR_BASICA';
                const currentReg = selectedRegimen[sKey] || 'JEC';
                const modMeta = MODALIDAD_LABELS[currentMod] || MODALIDAD_LABELS.REGULAR_BASICA;
                const schoolCourses = courses.filter((c) => (c.rbd === school.rbd || c.establishment === school.establishment));
                const isExpanded = expandedSchools.has(sKey);

                return (
                  <div
                    key={sKey}
                    className={`bg-white rounded-2xl border shadow-xs transition-all overflow-hidden ${
                      school.modalidad_ambigua ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'
                    }`}
                  >
                    {/* Header Establecimiento */}
                    <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleSchoolExpanded(sKey)}
                          className="mt-0.5 p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                          title={isExpanded ? 'Contraer cursos' : 'Expandir cursos'}
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 text-xs font-mono font-bold">
                              RBD: {school.rbd || 'N/A'}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${modMeta.badgeColor}`}>
                              {modMeta.label}
                            </span>
                            {school.modalidad_ambigua && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Revisión Sugerida (Polivalente / Mixto)
                              </span>
                            )}
                          </div>
                          <h5 className="text-sm font-bold text-slate-800 mt-1">
                            {school.establishment}
                          </h5>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {schoolCourses.length} cursos detectados • {school.teachers_count} docentes • {school.total_horas_ee} hrs totales
                          </p>
                        </div>
                      </div>

                      {/* Selectores de Modalidad y Régimen de la Escuela */}
                      <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Modalidad Establecimiento
                          </label>
                          <select
                            value={currentMod}
                            onChange={(e) => handleModalityChange(sKey, e.target.value as TipoModalidadEstudio)}
                            className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          >
                            {Object.entries(MODALIDAD_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Régimen
                          </label>
                          <select
                            value={currentReg}
                            onChange={(e) => handleRegimenChange(sKey, e.target.value as 'JEC' | 'No JEC')}
                            className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="JEC">Jornada Completa (JEC)</option>
                            <option value="No JEC">Media Jornada (No JEC)</option>
                          </select>
                        </div>

                        <button
                          onClick={() => handleAutoAssignSchoolPlans(school)}
                          className="mt-4 px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                          title="Auto-asignar planes normativos MINEDUC a todos los cursos de este colegio"
                        >
                          Auto-Asociar
                        </button>
                      </div>
                    </div>

                    {/* Tabla de Cursos con Selector de Plan de Estudio */}
                    {isExpanded && (
                      <div className="p-4 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                              <th className="py-2 px-3">Curso Detectado</th>
                              <th className="py-2 px-3 text-center">Horas Planilla</th>
                              <th className="py-2 px-3">Plan de Estudio Asociado (MINEDUC)</th>
                              <th className="py-2 px-3 text-center">Horas Plan</th>
                              <th className="py-2 px-3 text-center">Estado Cobertura</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                            {schoolCourses.map((c) => {
                              const cKey = `${c.rbd}-${c.curso}`;
                              const selectedPlanId = coursePlansMap[cKey] || '';
                              const currentPlan = planesDisponibles.find((p) => p.id === selectedPlanId);
                              const targetHours = currentPlan ? (currentPlan.totalHorasPlan || currentPlan.totalHorasSemanalesObligatorias) : (c.horas_plan_estudio || 0);
                              const diff = targetHours > 0 ? Math.round((c.total_horas - targetHours) * 100) / 100 : 0;

                              return (
                                <tr key={cKey} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{c.curso}</span>
                                      {c.especialidad_tp && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                          {c.especialidad_tp}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      Nivel: {c.nivel} • Letra: {c.letra}
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                                    {c.total_horas.toFixed(1)}h
                                  </td>

                                  <td className="py-2.5 px-3 min-w-[280px]">
                                    <select
                                      value={selectedPlanId}
                                      onChange={(e) => handleCoursePlanChange(cKey, e.target.value)}
                                      className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 truncate"
                                    >
                                      <option value="">-- Sin Plan Específico ({c.plan_referencia || 'Plan Automático'}) --</option>
                                      {Object.entries(planesAgrupados).map(([categoria, listaPlanes]) => (
                                        <optgroup key={categoria} label={`--- Categoría: ${categoria} ---`}>
                                          {listaPlanes.map((p) => (
                                            <option key={p.id} value={p.id}>
                                              {p.nivel} ({p.regimen}) - {p.totalHorasPlan || p.totalHorasSemanalesObligatorias}h {p.decretoSupremo ? `[${p.decretoSupremo}]` : ''}
                                            </option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>
                                  </td>

                                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                                    {targetHours > 0 ? `${targetHours}h` : '-'}
                                  </td>

                                  <td className="py-2.5 px-3 text-center">
                                    {targetHours > 0 ? (
                                      Math.abs(diff) <= 0.5 ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                          ✓ Cubierto
                                        </span>
                                      ) : diff < -0.5 ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800" title={`Faltan ${Math.abs(diff)} horas`}>
                                          ⚠️ Déficit ({diff}h)
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                          ℹ️ Superávit (+{diff}h)
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-[10px] text-slate-400">Sin plan</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{planesDisponibles.length} planes curriculares disponibles en SQLite</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Guardar y Asociar Planes a Cursos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
