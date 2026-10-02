import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, Layers, BookOpen, Sparkles, Building2, HelpCircle } from 'lucide-react';
import { TipoModalidadEstudio, SchoolSummary, CourseLoadSummary } from '../../types/analizadorTypes';
import { PlanEstudioCurricular } from '../../types';
import { getPlanesEstudioAnalizadorCache } from '../../services/analizador/planesEstudioBridge';

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

  const handleModalityChange = (schoolKey: string, mod: TipoModalidadEstudio) => {
    setSelectedModalities((prev) => ({ ...prev, [schoolKey]: mod }));
  };

  const handleRegimenChange = (schoolKey: string, reg: 'JEC' | 'No JEC') => {
    setSelectedRegimen((prev) => ({ ...prev, [schoolKey]: reg }));
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
      const schoolMod = selectedModalities[sKey];
      const schoolReg = selectedRegimen[sKey] || c.regimen || 'JEC';

      return {
        ...c,
        regimen: schoolReg,
        modalidad: c.modalidad || schoolMod,
      };
    });

    onApplyModalities(updatedSchools, updatedCourses);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  Modalidades Educativas y Planes de Estudio
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Auditoría Inteligente
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Valida o ajusta la modalidad de estudio de cada colegio para vincular con precisión los planes curriculares MINEDUC.
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
              <span className="font-bold">¿Por qué es importante definir la modalidad?</span>
              <p className="text-blue-800">
                La modalidad determina las horas semanales mínimas exigidas por el Ministerio de Educación (ej. 38h Básica JEC, 42h Media TP/HC, o 24-28h EPJA Adultos), permitiendo auditar con exactitud el déficit o superávit de horas docentes.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>Establecimientos Detectados ({schools.length})</span>
            </h4>

            <div className="space-y-3">
              {schools.map((school) => {
                const sKey = school.rbd || school.establishment;
                const currentMod = selectedModalities[sKey] || school.modalidad_detectada || 'REGULAR_BASICA';
                const currentReg = selectedRegimen[sKey] || 'JEC';
                const modMeta = MODALIDAD_LABELS[currentMod] || MODALIDAD_LABELS.REGULAR_BASICA;
                const schoolCourses = courses.filter((c) => (c.rbd === school.rbd || c.establishment === school.establishment));

                return (
                  <div
                    key={sKey}
                    className={`bg-white rounded-xl border p-4 shadow-xs transition-all ${
                      school.modalidad_ambigua ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono font-bold">
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

                      {/* Selectores */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Modalidad de Estudio
                          </label>
                          <select
                            value={currentMod}
                            onChange={(e) => handleModalityChange(sKey, e.target.value as TipoModalidadEstudio)}
                            className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                            className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="JEC">Jornada Escolar Completa (JEC)</option>
                            <option value="No JEC">Sin JEC (Media Jornada)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Resumen de Cursos del Colegio */}
                    <div className="pt-3 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Cursos:
                      </span>
                      {schoolCourses.map((c, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium border border-slate-200"
                          title={`Plan asociado: ${c.plan_referencia || 'Plan Estándar'} (${c.horas_plan_estudio || 0} hrs)`}
                        >
                          {c.curso} {c.horas_plan_estudio ? `(${c.horas_plan_estudio}h)` : ''}
                        </span>
                      ))}
                    </div>
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
              <span>Aplicar y Asociar Planes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
