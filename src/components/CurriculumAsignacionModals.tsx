import React, { useState, useEffect } from 'react';
import { BookOpen, Users, ShieldCheck, X } from 'lucide-react';
import { AsignacionHoraria, CursoSae, Docente, Establecimiento } from '../types';
import { PlanEstudioNivel, AsignaturaPlan } from '@slep/mineduc-engine';

export const TIPOS_APOYO_PIE = [
  { id: 'Co-Docencia en Aula Regular', label: 'Co-Docencia en Aula Regular (Docente Diferencial)', estamentoSugerido: 'DOCENTE_DIFERENCIAL' },
  { id: 'Aula de Recursos / Apoyo Especializado', label: 'Aula de Recursos / Apoyo Especializado', estamentoSugerido: 'DOCENTE_DIFERENCIAL' },
  { id: 'Apoyo Multidisciplinario / Clínico PAE', label: 'Apoyo Profesional PAE (Fonoaudiólogo / Psicólogo / TO)', estamentoSugerido: 'PROFESIONAL_PAE' },
  { id: 'Apoyo Técnico en Aula', label: 'Apoyo Técnico en Educación Especial', estamentoSugerido: 'TECNICO_ESPECIAL' },
  { id: 'Trabajo Colaborativo / Co-Planificación', label: 'Trabajo Colaborativo Art. 86 (Docente de Aula)', estamentoSugerido: 'DOCENTE_AULA' }
];

// =========================================================
// 1. MODAL ASIGNAR / EDITAR DOCENCIA REGULAR O TALLER
// =========================================================
interface ModalDocenciaProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardar: (asig: AsignacionHoraria) => Promise<void> | void;
  cursoActivo: CursoSae | null;
  esModoTransversal: boolean;
  colegio: Establecimiento;
  periodoActivo: number;
  editandoAsig: AsignacionHoraria | null;
  asignaturaSugerida?: string;
  horasSugeridas?: number;
  docentes: Docente[];
  disponibilidadDocentes: Map<string, { horasAsignadas: number; horasLibres: number }>;
  planActivo: PlanEstudioNivel | null;
}

export const ModalAsignarDocencia: React.FC<ModalDocenciaProps> = ({
  isOpen,
  onClose,
  onGuardar,
  cursoActivo,
  esModoTransversal,
  colegio,
  periodoActivo,
  editandoAsig,
  asignaturaSugerida,
  horasSugeridas,
  docentes,
  disponibilidadDocentes,
  planActivo
}) => {
  const [docenteId, setDocenteId] = useState('');
  const [asignatura, setAsignatura] = useState('');
  const [horas, setHoras] = useState(4);
  const [tipoFuncion, setTipoFuncion] = useState<'CURRICULAR' | 'TALLER_JEC' | 'TALLER_SEP' | 'TRABAJO_COLABORATIVO'>('CURRICULAR');

  useEffect(() => {
    if (!isOpen) return;
    if (editandoAsig) {
      setDocenteId(editandoAsig.docenteId);
      setAsignatura(editandoAsig.asignatura);
      setHoras(editandoAsig.horasPedagogicasAula);
      if (editandoAsig.esTrabajoColaborativo) {
        setTipoFuncion('TRABAJO_COLABORATIVO');
      } else if (editandoAsig.esTallerSep) {
        setTipoFuncion('TALLER_SEP');
      } else if (editandoAsig.esTallerJec) {
        setTipoFuncion('TALLER_JEC');
      } else {
        setTipoFuncion('CURRICULAR');
      }
    } else {
      setAsignatura(asignaturaSugerida || (esModoTransversal ? 'Taller de Robótica / Extraescolar' : (planActivo?.asignaturasBase[0]?.nombre || 'Lenguaje y Comunicación')));
      setHoras(horasSugeridas || (esModoTransversal ? 4 : (planActivo?.asignaturasBase[0]?.horasSugeridas || 4)));
      setTipoFuncion(esModoTransversal ? 'TALLER_SEP' : 'CURRICULAR');
      const docSugerido = docentes.find(d => d.estamento === 'DOCENTE_AULA') || docentes[0];
      setDocenteId(docSugerido ? docSugerido.id : '');
    }
  }, [isOpen, editandoAsig, asignaturaSugerida, horasSugeridas, esModoTransversal, planActivo, docentes]);

  if (!isOpen || (!cursoActivo && !esModoTransversal)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docenteId || !asignatura.trim()) return;

    const esJec = tipoFuncion === 'TALLER_JEC';
    const esSep = tipoFuncion === 'TALLER_SEP';
    const esColab = tipoFuncion === 'TRABAJO_COLABORATIVO';

    const asig: AsignacionHoraria = {
      id: editandoAsig ? editandoAsig.id : `asig-doc-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      cursoId: esModoTransversal ? 'TRANSVERSAL' : (cursoActivo ? cursoActivo.id : 'TRANSVERSAL'),
      docenteId,
      asignatura: asignatura.trim(),
      horasPedagogicasAula: Number(horas),
      esCoDocencia: false,
      esTallerJec: esJec && !esModoTransversal,
      esTallerSep: esSep,
      esTrabajoColaborativo: esColab,
      tipoApoyo: esColab ? 'TRABAJO_COLABORATIVO' : (esSep ? 'TALLER_SEP' : (esJec ? 'TALLER_JEC' : 'AULA_REGULAR'))
    };

    await onGuardar(asig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-orange-600" />
            {editandoAsig ? 'Editar Asignación / Taller' : (esModoTransversal ? 'Crear Taller Transversal' : 'Asignar Docente / Asignatura')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs mt-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Destino / Ámbito</label>
            <input
              type="text"
              disabled
              value={esModoTransversal ? '🌟 Taller Institucional / Transversal (Sin Curso)' : (cursoActivo ? `${cursoActivo.nivel} ${cursoActivo.letra} (${cursoActivo.regimen})` : 'Transversal')}
              className="w-full px-3 py-2 border rounded-lg bg-slate-100 text-slate-700 font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Asignatura / Subsector *</label>
            <input
              type="text"
              required
              list="sugerencias-materias-modal"
              value={asignatura}
              onChange={e => setAsignatura(e.target.value)}
              placeholder="Ej. Lenguaje y Comunicación, Matemática..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold"
            />
            <datalist id="sugerencias-materias-modal">
              {planActivo?.asignaturasBase.map((asig: AsignaturaPlan, i: number) => (
                <option key={i} value={asig.nombre} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Profesor(a) Asignado(a) *</label>
            <select
              required
              value={docenteId}
              onChange={e => setDocenteId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none font-medium"
            >
              <option value="">-- Seleccionar Docente --</option>
              {docentes.map(d => {
                const disp = disponibilidadDocentes.get(d.id);
                return (
                  <option key={d.id} value={d.id}>
                    {d.nombres} {d.apellidos} ({d.estamento}) - {d.horasContrato}h [Libres: {disp?.horasLibres || 0}h]
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Horas Pedagógicas Semanales (HA) *</label>
            <input
              type="number"
              min="1"
              max="44"
              required
              value={horas}
              onChange={e => setHoras(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-center font-bold text-orange-600 text-base"
            />
            <p className="text-[10px] text-slate-400 mt-1">1 hora pedagógica = 45 minutos de aula.</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Tipo de Función / Régimen Horario</label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-0.5 transition-all ${
                tipoFuncion === 'CURRICULAR' ? 'border-orange-500 bg-orange-50/70 text-orange-950 font-bold' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}>
                <div className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="tipoFuncionModal"
                    checked={tipoFuncion === 'CURRICULAR'}
                    onChange={() => setTipoFuncion('CURRICULAR')}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-xs">Plan Regular</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal ml-5">Afecto a proporción Ley 20.903</span>
              </label>

              <label className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-0.5 transition-all ${
                tipoFuncion === 'TALLER_JEC' ? 'border-blue-500 bg-blue-50/70 text-blue-950 font-bold' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}>
                <div className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="tipoFuncionModal"
                    checked={tipoFuncion === 'TALLER_JEC'}
                    onChange={() => setTipoFuncion('TALLER_JEC')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs">Taller JEC</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal ml-5">Afecto a proporción Ley 20.903</span>
              </label>

              <label className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-0.5 transition-all ${
                tipoFuncion === 'TALLER_SEP' ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-bold' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}>
                <div className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="tipoFuncionModal"
                    checked={tipoFuncion === 'TALLER_SEP'}
                    onChange={() => setTipoFuncion('TALLER_SEP')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs">Taller SEP</span>
                </div>
                <span className="text-[10px] text-emerald-700 font-normal ml-5">Exento de proporción Ley 20.903</span>
              </label>

              <label className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-0.5 transition-all ${
                tipoFuncion === 'TRABAJO_COLABORATIVO' ? 'border-purple-500 bg-purple-50/70 text-purple-950 font-bold' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}>
                <div className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="tipoFuncionModal"
                    checked={tipoFuncion === 'TRABAJO_COLABORATIVO'}
                    onChange={() => setTipoFuncion('TRABAJO_COLABORATIVO')}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs">Trabajo Colaborativo</span>
                </div>
                <span className="text-[10px] text-purple-700 font-normal ml-5">Art. 86 / Exento Ley 20.903</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow"
            >
              {editandoAsig ? 'Guardar Cambios' : 'Asignar Docencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================
// 2. MODAL ASIGNAR / EDITAR CO-DOCENCIA (NO PIE) / APOYO
// =========================================================
interface ModalCoDocenciaProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardar: (asig: AsignacionHoraria) => Promise<void> | void;
  cursoActivo: CursoSae | null;
  colegio: Establecimiento;
  periodoActivo: number;
  editandoAsig: AsignacionHoraria | null;
  asignaturaSugerida?: string;
  horasSugeridas?: number;
  docentes: Docente[];
  disponibilidadDocentes: Map<string, { horasAsignadas: number; horasLibres: number }>;
  planActivo: PlanEstudioNivel | null;
  horasPlanCurso: number;
}

export const ModalAsignarCoDocencia: React.FC<ModalCoDocenciaProps> = ({
  isOpen,
  onClose,
  onGuardar,
  cursoActivo,
  colegio,
  periodoActivo,
  editandoAsig,
  asignaturaSugerida,
  horasSugeridas,
  docentes,
  disponibilidadDocentes,
  planActivo,
  horasPlanCurso
}) => {
  const [docenteId, setDocenteId] = useState('');
  const [asignatura, setAsignatura] = useState('');
  const [horas, setHoras] = useState(4);
  const [tipoModalidad, setTipoModalidad] = useState<'AGRUPACION_FLEXIBLE' | 'CO_DOCENCIA' | 'REFUERZO_AULA' | 'APOYO_DOCENTE'>('AGRUPACION_FLEXIBLE');
  const [esSep, setEsSep] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editandoAsig) {
      setDocenteId(editandoAsig.docenteId);
      setAsignatura(editandoAsig.asignatura);
      setHoras(editandoAsig.horasPedagogicasAula);
      if (editandoAsig.tipoApoyo === 'CO_DOCENCIA') {
        setTipoModalidad('CO_DOCENCIA');
      } else if (editandoAsig.tipoApoyo === 'REFUERZO_AULA') {
        setTipoModalidad('REFUERZO_AULA');
      } else if (editandoAsig.tipoApoyo === 'APOYO_DOCENTE') {
        setTipoModalidad('APOYO_DOCENTE');
      } else {
        setTipoModalidad('AGRUPACION_FLEXIBLE');
      }
      setEsSep(Boolean(editandoAsig.esTallerSep));
    } else {
      setAsignatura(asignaturaSugerida || (planActivo?.asignaturasBase[0]?.nombre || 'Lenguaje y Comunicación'));
      setHoras(horasSugeridas || 4);
      setTipoModalidad('AGRUPACION_FLEXIBLE');
      setEsSep(false);
      const docSugerido = docentes.find(d => d.estamento === 'DOCENTE_AULA') || docentes[0];
      setDocenteId(docSugerido ? docSugerido.id : '');
    }
  }, [isOpen, editandoAsig, asignaturaSugerida, horasSugeridas, planActivo, docentes]);

  if (!isOpen || !cursoActivo) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docenteId || !asignatura.trim()) return;

    const asig: AsignacionHoraria = {
      id: editandoAsig ? editandoAsig.id : `asig-codoc-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      cursoId: cursoActivo.id,
      docenteId,
      asignatura: asignatura.trim(),
      horasPedagogicasAula: Number(horas),
      esCoDocencia: true,
      esAgrupacionFlexible: tipoModalidad === 'AGRUPACION_FLEXIBLE',
      esTallerSep: esSep,
      tipoApoyo: tipoModalidad
    };

    await onGuardar(asig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h3 className="text-base font-bold text-indigo-950 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            {editandoAsig ? 'Editar Co-Docencia / Apoyo' : 'Asignar Co-Docencia / Agrupación Flexible'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs mt-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Curso Destino</label>
            <input
              type="text"
              disabled
              value={`${cursoActivo.nivel} ${cursoActivo.letra} (${cursoActivo.regimen})`}
              className="w-full px-3 py-2 border rounded-lg bg-indigo-50/70 text-indigo-950 font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Modalidad de Apoyo / Co-Enseñanza *</label>
            <select
              value={tipoModalidad}
              onChange={e => setTipoModalidad(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
            >
              <option value="AGRUPACION_FLEXIBLE">Agrupación Flexible (División de subgrupos en aula)</option>
              <option value="CO_DOCENCIA">Co-Docencia Regular (2° Docente en sala simultáneo)</option>
              <option value="REFUERZO_AULA">Refuerzo Pedagógico en Sala (Nivelación)</option>
              <option value="APOYO_DOCENTE">Apoyo Docente / Asistente Pedagógico</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Asignatura o Área Apoyada *</label>
            <input
              type="text"
              required
              list="sugerencias-materias-codoc-modal"
              value={asignatura}
              onChange={e => setAsignatura(e.target.value)}
              placeholder="Ej. Lenguaje y Comunicación, Matemática..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold"
            />
            <datalist id="sugerencias-materias-codoc-modal">
              {planActivo?.asignaturasBase.map((asig: AsignaturaPlan, i: number) => (
                <option key={i} value={asig.nombre} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Docente o Funcionario de Apoyo *
            </label>
            <select
              required
              value={docenteId}
              onChange={e => setDocenteId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
            >
              <option value="">-- Seleccionar Docente / Funcionario --</option>
              {docentes.map(d => {
                const disp = disponibilidadDocentes.get(d.id);
                return (
                  <option key={d.id} value={d.id}>
                    {d.nombres} {d.apellidos} ({d.estamento}) - {d.horasContrato}h [Libres: {disp?.horasLibres || 0}h]
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Horas Pedagógicas (HA) *</label>
              <input
                type="number"
                min="1"
                max="44"
                required
                value={horas}
                onChange={e => setHoras(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center font-bold text-indigo-700 text-base"
              />
              <p className="text-[10px] text-slate-400 mt-1">1 HA = 45 minutos</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fuente Financiamiento</label>
              <select
                value={esSep ? 'SEP' : 'SUB_GEN'}
                onChange={e => setEsSep(e.target.value === 'SEP')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              >
                <option value="SUB_GEN">Subvención General</option>
                <option value="SEP">SEP (Refuerzo/PME)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">{esSep ? 'Exento prop. 65/35' : 'Carga regular'}</p>
            </div>
          </div>

          <div className="p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-[11px]">
            ℹ️ Esta asignación sumará a la carga horaria del docente seleccionado, pero <strong>no inflará las {horasPlanCurso} HA del Plan de Estudio del curso</strong>.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow"
            >
              {editandoAsig ? 'Guardar Cambios' : 'Asignar Co-Docencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================
// 3. MODAL ASIGNAR / EDITAR APOYO PIE
// =========================================================
interface ModalPieProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardar: (asig: AsignacionHoraria) => Promise<void> | void;
  cursoActivo: CursoSae | null;
  colegio: Establecimiento;
  periodoActivo: number;
  editandoAsig: AsignacionHoraria | null;
  docentes: Docente[];
  disponibilidadDocentes: Map<string, { horasAsignadas: number; horasLibres: number }>;
  demandaPieCurso: { neetCount: number; neepCount: number };
}

export const ModalAsignarPie: React.FC<ModalPieProps> = ({
  isOpen,
  onClose,
  onGuardar,
  cursoActivo,
  colegio,
  periodoActivo,
  editandoAsig,
  docentes,
  disponibilidadDocentes,
  demandaPieCurso
}) => {
  const [docenteId, setDocenteId] = useState('');
  const [tipoApoyo, setTipoApoyo] = useState('Co-Docencia en Aula Regular');
  const [horas, setHoras] = useState(6);
  const [asignatura, setAsignatura] = useState('Apoyo PIE - Co-docencia Aula Regular');

  useEffect(() => {
    if (!isOpen) return;
    if (editandoAsig) {
      setDocenteId(editandoAsig.docenteId);
      setTipoApoyo(editandoAsig.tipoApoyo || 'Co-Docencia en Aula Regular');
      setHoras(editandoAsig.horasCronologicasPie || editandoAsig.horasPedagogicasAula || 4);
      setAsignatura(editandoAsig.asignatura);
    } else {
      setTipoApoyo('Co-Docencia en Aula Regular');
      setHoras(6);
      setAsignatura('Apoyo PIE - Co-docencia Aula Regular');
      const pieSugerido = docentes.find(d => d.estamento === 'DOCENTE_DIFERENCIAL') ||
                          docentes.find(d => d.estamento === 'PROFESIONAL_PAE') ||
                          docentes[0];
      setDocenteId(pieSugerido ? pieSugerido.id : '');
    }
  }, [isOpen, editandoAsig, docentes]);

  if (!isOpen || !cursoActivo) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docenteId || !asignatura.trim()) return;

    const esColab = tipoApoyo.includes('Colaborativo') || tipoApoyo.includes('86');
    const horasCron = Number(horas);
    const horasPed = Math.round(horasCron * 1.333);

    const asig: AsignacionHoraria = {
      id: editandoAsig ? editandoAsig.id : `asig-pie-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      cursoId: cursoActivo.id,
      docenteId,
      asignatura: asignatura.trim(),
      horasPedagogicasAula: horasPed,
      horasCronologicasPie: horasCron,
      esCoDocencia: true,
      esTrabajoColaborativo: esColab,
      tipoApoyo
    };

    await onGuardar(asig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h3 className="text-base font-bold text-purple-950 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            {editandoAsig ? 'Editar Apoyo PIE' : 'Asignar Apoyo PIE / Co-Docencia'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs mt-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Curso Destino</label>
            <input
              type="text"
              disabled
              value={`${cursoActivo.nivel} ${cursoActivo.letra} (${demandaPieCurso.neetCount} NEET / ${demandaPieCurso.neepCount} NEEP)`}
              className="w-full px-3 py-2 border rounded-lg bg-purple-50 text-purple-900 font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tipo de Apoyo Decreto 170 *</label>
            <select
              value={tipoApoyo}
              onChange={e => setTipoApoyo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
            >
              {TIPOS_APOYO_PIE.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Profesional / Asistente Asignado *
            </label>
            <select
              required
              value={docenteId}
              onChange={e => setDocenteId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
            >
              <option value="">-- Seleccionar Profesional o Asistente --</option>
              <optgroup label="Educadoras Diferenciales (PIE)">
                {docentes.filter(d => d.estamento === 'DOCENTE_DIFERENCIAL').map(d => {
                  const disp = disponibilidadDocentes.get(d.id);
                  return (
                    <option key={d.id} value={d.id}>
                      {d.nombres} {d.apellidos} - {d.horasContrato}h [Libres: {disp?.horasLibres || 0}h]
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="Asistentes Profesionales PAE (Fono/Psico/TO)">
                {docentes.filter(d => d.estamento === 'PROFESIONAL_PAE').map(d => {
                  const disp = disponibilidadDocentes.get(d.id);
                  return (
                    <option key={d.id} value={d.id}>
                      {d.nombres} {d.apellidos} ({d.titulo || 'PAE'}) - {d.horasContrato}h [Libres: {disp?.horasLibres || 0}h]
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="Asistentes Técnicos en Educación Especial / Aula">
                {docentes.filter(d => d.estamento === 'TECNICO_ESPECIAL' || d.estamento === 'ASISTENTE_AULA').map(d => {
                  const disp = disponibilidadDocentes.get(d.id);
                  return (
                    <option key={d.id} value={d.id}>
                      {d.nombres} {d.apellidos} - {d.horasContrato}h [Libres: {disp?.horasLibres || 0}h]
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="Docentes de Aula Regular (Co-docencia / Colaborativo)">
                {docentes.filter(d => d.estamento === 'DOCENTE_AULA').map(d => {
                  const disp = disponibilidadDocentes.get(d.id);
                  return (
                    <option key={d.id} value={d.id}>
                      {d.nombres} {d.apellidos} - {d.horasContrato}h [Libres: {disp?.horasLibres || 0}h]
                    </option>
                  );
                })}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Descripción / Asignatura Articulada</label>
            <input
              type="text"
              value={asignatura}
              onChange={e => setAsignatura(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
              placeholder="Ej: Apoyo PIE Lenguaje y Matemática"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Horas Cronológicas Semanales *</label>
            <input
              type="number"
              min="1"
              max="44"
              step="0.5"
              required
              value={horas}
              onChange={e => setHoras(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-center font-bold text-purple-700 text-base"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Equivale aprox. a {Math.round(horas * 1.333)} horas pedagógicas de aula (HA).
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow"
            >
              {editandoAsig ? 'Guardar Cambios' : 'Asignar Apoyo PIE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
