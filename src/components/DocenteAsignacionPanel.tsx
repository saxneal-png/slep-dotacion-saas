import React, { useState } from 'react';
import { 
  Plus, 
  Users, 
  ShieldCheck, 
  Trash2, 
  Layers
} from 'lucide-react';
import { Docente, AsignacionHoraria, CursoSae, Establecimiento } from '../types';
import { obtenerPlanPorCurso } from '@slep/mineduc-engine';

interface DocenteAsignacionPanelProps {
  docente: Docente;
  colegio: Establecimiento;
  cursos: CursoSae[];
  asignaciones: AsignacionHoraria[];
  onGuardarAsignacion?: (asig: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion?: (id: string) => Promise<void> | void;
}

type TipoFormularioActivo = 'REGULAR' | 'CO_DOCENCIA' | 'PIE' | null;

// ============================================================================
// Subcomponentes aislados para evitar re-renderizados del panel al tipear
// ============================================================================

interface FormRegularProps {
  docente: Docente;
  colegio: Establecimiento;
  cursos: CursoSae[];
  onGuardar: (asig: AsignacionHoraria) => Promise<void> | void;
  onCerrar: () => void;
}

const FormAsignarRegular: React.FC<FormRegularProps> = React.memo(({
  docente,
  colegio,
  cursos,
  onGuardar,
  onCerrar
}) => {
  const [regCursoId, setRegCursoId] = useState(cursos[0]?.id || 'TRANSVERSAL');
  const [regNombre, setRegNombre] = useState('');
  const [regHoras, setRegHoras] = useState(4);
  const [regEsTallerSep, setRegEsTallerSep] = useState(false);

  // Obtener plan de estudio del curso seleccionado
  const cursoSeleccionado = cursos.find(c => c.id === regCursoId) || null;
  const planCurso = cursoSeleccionado ? obtenerPlanPorCurso(cursoSeleccionado.nivel, cursoSeleccionado.regimen) : null;

  // Sugerencias de asignaturas según el curso o por defecto
  const sugerenciasAsignaturas = planCurso?.asignaturasBase && planCurso.asignaturasBase.length > 0
    ? planCurso.asignaturasBase.map(a => ({ nombre: a.nombre, horas: a.horasSugeridas }))
    : [
        { nombre: 'Lenguaje y Comunicación', horas: 6 },
        { nombre: 'Matemática', horas: 6 },
        { nombre: 'Ciencias Naturales', horas: 3 },
        { nombre: 'Historia, Geografía y Ciencias Sociales', horas: 3 },
        { nombre: 'Inglés', horas: 3 },
        { nombre: 'Educación Física y Salud', horas: 3 },
        { nombre: 'Artes Visuales', horas: 2 },
        { nombre: 'Música', horas: 2 },
        { nombre: 'Tecnología', horas: 1 },
        { nombre: 'Orientación', horas: 1 },
        { nombre: 'Religión', horas: 2 },
        { nombre: 'Taller Extracurricular SEP', horas: 2 },
        { nombre: 'Taller de Refuerzo Pedagógico', horas: 2 }
      ];

  const handleSelectAsignatura = (nombre: string) => {
    setRegNombre(nombre);
    const asigPlan = sugerenciasAsignaturas.find(a => a.nombre.toLowerCase() === nombre.trim().toLowerCase());
    if (asigPlan?.horas && asigPlan.horas > 0) {
      setRegHoras(asigPlan.horas);
    }
    if (/sep/i.test(nombre)) {
      setRegEsTallerSep(true);
    }
  };

  const handleCursoChange = (nuevoCursoId: string) => {
    setRegCursoId(nuevoCursoId);
    if (nuevoCursoId === 'TRANSVERSAL') {
      if (!regNombre || regNombre === 'Lenguaje y Comunicación') {
        setRegNombre('Taller Institucional Transversal');
        setRegHoras(2);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNombre.trim() || !regCursoId) return;

    const newAsig: AsignacionHoraria = {
      id: `asig-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: docente.periodo || 2026,
      cursoId: regCursoId,
      docenteId: docente.id,
      asignatura: regNombre.trim(),
      horasPedagogicasAula: Number(regHoras),
      esTallerJec: /taller/i.test(regNombre),
      esTallerSep: regEsTallerSep,
      esProporcionDocente: false
    };

    await onGuardar(newAsig);
    onCerrar();
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-white border border-orange-200 rounded-lg flex flex-wrap items-center gap-3 text-xs shadow-sm">
      <div className="flex-1 min-w-[170px]">
        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Asignatura</label>
        <input
          type="text"
          autoFocus
          value={regNombre}
          onChange={(e) => handleSelectAsignatura(e.target.value)}
          onFocus={(e) => e.target.select()}
          list={`datalist-reg-${docente.id}`}
          className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white"
          placeholder="Ej: Matemática, Lenguaje..."
          required
        />
        <datalist id={`datalist-reg-${docente.id}`}>
          {sugerenciasAsignaturas.map((s, idx) => (
            <option key={idx} value={s.nombre}>
              {s.horas ? `${s.horas} HA` : ''}
            </option>
          ))}
        </datalist>
      </div>
      <div className="min-w-[180px]">
        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Curso o Modalidad</label>
        <select
          value={regCursoId}
          onChange={(e) => handleCursoChange(e.target.value)}
          className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white font-medium focus:ring-1 focus:ring-orange-500 focus:outline-none"
        >
          <option value="TRANSVERSAL">🌟 Taller Institucional / Transversal (Sin Curso)</option>
          {cursos.map(c => (
            <option key={c.id} value={c.id}>
              {c.nivel} {c.letra} ({c.regimen})
            </option>
          ))}
        </select>
      </div>
      <div className="w-20">
        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Horas Aula</label>
        <input
          type="number"
          value={regHoras}
          onChange={(e) => setRegHoras(Number(e.target.value))}
          onFocus={(e) => e.target.select()}
          className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-center font-bold focus:ring-1 focus:ring-orange-500 focus:outline-none"
          min={1}
          max={44}
          required
        />
      </div>
      <div className="flex items-center gap-1.5 pt-4">
        <label className="flex items-center gap-1 cursor-pointer text-[11px] font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={regEsTallerSep}
            onChange={(e) => {
              setRegEsTallerSep(e.target.checked);
              if (e.target.checked && !regNombre) {
                setRegNombre('Taller Extracurricular SEP');
                setRegHoras(2);
              }
            }}
          />
          <span>Taller Extracurricular SEP</span>
        </label>
      </div>
      <div className="flex items-center gap-2 pt-4">
        <button
          type="submit"
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition-colors"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
});

interface FormCoDocenciaProps {
  docente: Docente;
  colegio: Establecimiento;
  cursos: CursoSae[];
  onGuardar: (asig: AsignacionHoraria) => Promise<void> | void;
  onCerrar: () => void;
}

const FormAsignarCoDocencia: React.FC<FormCoDocenciaProps> = React.memo(({
  docente,
  colegio,
  cursos,
  onGuardar,
  onCerrar
}) => {
  const [coDocCursoId, setCoDocCursoId] = useState(cursos[0]?.id || '');
  const [coDocAsignatura, setCoDocAsignatura] = useState('');
  const [coDocHoras, setCoDocHoras] = useState(4);
  const [coDocTipo, setCoDocTipo] = useState<'CO_DOCENCIA' | 'AGRUPACION_FLEXIBLE' | 'REFUERZO_AULA' | 'APOYO_DOCENTE'>('CO_DOCENCIA');
  const [coDocFinanciamiento, setCoDocFinanciamiento] = useState<'SUB_GEN' | 'SEP'>('SEP');

  const cursoSeleccionado = cursos.find(c => c.id === coDocCursoId) || null;
  const planCurso = cursoSeleccionado ? obtenerPlanPorCurso(cursoSeleccionado.nivel, cursoSeleccionado.regimen) : null;

  const sugerenciasAsignaturas = planCurso?.asignaturasBase && planCurso.asignaturasBase.length > 0
    ? planCurso.asignaturasBase.map(a => a.nombre)
    : ['Lenguaje y Comunicación', 'Matemática', 'Ciencias Naturales', 'Historia, Geografía y Ciencias Sociales', 'Inglés'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coDocAsignatura.trim() || !coDocCursoId) return;

    const newAsig: AsignacionHoraria = {
      id: `asig-codoc-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: docente.periodo || 2026,
      cursoId: coDocCursoId,
      docenteId: docente.id,
      asignatura: coDocAsignatura.trim(),
      horasPedagogicasAula: Number(coDocHoras),
      esCoDocencia: true,
      esAgrupacionFlexible: coDocTipo === 'AGRUPACION_FLEXIBLE',
      tipoApoyo: coDocTipo,
      esTallerSep: false,
      esProporcionDocente: true
    };

    await onGuardar(newAsig);
    onCerrar();
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-wrap items-center gap-3 text-xs shadow-sm">
      <div className="min-w-[180px]">
        <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">Curso Receptor del Apoyo</label>
        <select
          value={coDocCursoId}
          onChange={(e) => setCoDocCursoId(e.target.value)}
          className="w-full px-2 py-1 border border-indigo-300 rounded text-xs bg-white font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          required
        >
          {cursos.map(c => (
            <option key={c.id} value={c.id}>
              {c.nivel} {c.letra} ({c.regimen})
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[150px]">
        <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">Asignatura</label>
        <input
          type="text"
          autoFocus
          value={coDocAsignatura}
          onChange={(e) => setCoDocAsignatura(e.target.value)}
          onFocus={(e) => e.target.select()}
          list={`datalist-codoc-${docente.id}`}
          className="w-full px-2 py-1 border border-indigo-300 rounded text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
          placeholder="Ej: Matemática, Lenguaje..."
          required
        />
        <datalist id={`datalist-codoc-${docente.id}`}>
          {sugerenciasAsignaturas.map((nombre, idx) => (
            <option key={idx} value={nombre} />
          ))}
        </datalist>
      </div>
      <div className="min-w-[180px]">
        <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">Modalidad de Apoyo</label>
        <select
          value={coDocTipo}
          onChange={(e) => setCoDocTipo(e.target.value as any)}
          className="w-full px-2 py-1 border border-indigo-300 rounded text-xs bg-white font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="CO_DOCENCIA">🤝 Co-Docencia en Aula</option>
          <option value="AGRUPACION_FLEXIBLE">👥 Agrupación Flexible (Separación)</option>
          <option value="REFUERZO_AULA">💡 Refuerzo Pedagógico en Aula</option>
          <option value="APOYO_DOCENTE">🛡️ Apoyo Docente Adicional</option>
        </select>
      </div>
      <div className="w-20">
        <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">Horas Aula</label>
        <input
          type="number"
          value={coDocHoras}
          onChange={(e) => setCoDocHoras(Number(e.target.value))}
          onFocus={(e) => e.target.select()}
          className="w-full px-2 py-1 border border-indigo-300 rounded text-xs text-center font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          min={1}
          max={44}
          required
        />
      </div>
      <div className="min-w-[140px]">
        <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">Financiamiento</label>
        <select
          value={coDocFinanciamiento}
          onChange={(e) => setCoDocFinanciamiento(e.target.value as any)}
          className="w-full px-2 py-1 border border-indigo-300 rounded text-xs bg-white font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="SEP">Subvención SEP (No suma plan)</option>
          <option value="SUB_GEN">Subvención General</option>
        </select>
      </div>
      <div className="flex items-center gap-2 pt-4">
        <button
          type="submit"
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs shadow-xs transition-colors"
        >
          Guardar Co-Docencia
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
});

interface FormPieProps {
  docente: Docente;
  colegio: Establecimiento;
  cursos: CursoSae[];
  onGuardar: (asig: AsignacionHoraria) => Promise<void> | void;
  onCerrar: () => void;
}

const FormAsignarPie: React.FC<FormPieProps> = React.memo(({
  docente,
  colegio,
  cursos,
  onGuardar,
  onCerrar
}) => {
  const [pieCursoId, setPieCursoId] = useState(cursos[0]?.id || '');
  const [pieAsignatura, setPieAsignatura] = useState('Apoyo PIE - Co-docencia Aula Común');
  const [pieHoras, setPieHoras] = useState(6);
  const [pieTipo, setPieTipo] = useState<'Co-Docencia en Aula Regular' | 'Aula de Recursos / Refuerzo Especializado' | 'Trabajo Colaborativo / Co-Planificación Art. 86' | 'Apoyo Multidisciplinario / Clínico PAE'>('Co-Docencia en Aula Regular');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pieCursoId) return;

    const esColab = pieTipo.includes('Colaborativo') || pieTipo.includes('86');
    const horasCron = Number(pieHoras);
    const horasPed = Math.round(horasCron * 1.333);

    const newAsig: AsignacionHoraria = {
      id: `asig-pie-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: docente.periodo || 2026,
      cursoId: pieCursoId,
      docenteId: docente.id,
      asignatura: pieAsignatura.trim() || `Apoyo Especializado PIE (${pieTipo})`,
      horasPedagogicasAula: horasPed,
      horasCronologicasPie: horasCron,
      esCoDocencia: true,
      esTrabajoColaborativo: esColab,
      tipoApoyo: pieTipo,
      esProporcionDocente: false
    };

    await onGuardar(newAsig);
    onCerrar();
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex flex-wrap items-center gap-3 text-xs shadow-sm">
      <div className="min-w-[180px]">
        <label className="block text-[10px] font-bold text-purple-900 mb-0.5">Curso Receptor PIE</label>
        <select
          value={pieCursoId}
          onChange={(e) => setPieCursoId(e.target.value)}
          className="w-full px-2 py-1 border border-purple-300 rounded text-xs bg-white font-medium focus:ring-1 focus:ring-purple-500 focus:outline-none"
          required
        >
          {cursos.map(c => (
            <option key={c.id} value={c.id}>
              {c.nivel} {c.letra} ({c.regimen})
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[200px]">
        <label className="block text-[10px] font-bold text-purple-900 mb-0.5">Modalidad de Apoyo PIE (Dec. 170)</label>
        <select
          value={pieTipo}
          onChange={(e) => {
            const val = e.target.value as any;
            setPieTipo(val);
            if (val.includes('Colaborativo')) {
              setPieHoras(3);
              setPieAsignatura('Trabajo Colaborativo / Co-Planificación PIE Art. 86');
            } else if (val.includes('Recursos')) {
              setPieHoras(4);
              setPieAsignatura('Apoyo PIE - Aula de Recursos');
            } else {
              setPieHoras(6);
              setPieAsignatura('Apoyo PIE - Co-docencia Aula Común');
            }
          }}
          className="w-full px-2 py-1 border border-purple-300 rounded text-xs bg-white font-medium focus:ring-1 focus:ring-purple-500 focus:outline-none"
        >
          <option value="Co-Docencia en Aula Regular">Co-Docencia en Aula Regular (Común)</option>
          <option value="Aula de Recursos / Refuerzo Especializado">Aula de Recursos (Refuerzo Especializado)</option>
          <option value="Trabajo Colaborativo / Co-Planificación Art. 86">Trabajo Colaborativo Art. 86 (3h cron.)</option>
          <option value="Apoyo Multidisciplinario / Clínico PAE">Apoyo Multidisciplinario / Clínico PAE</option>
        </select>
      </div>

      <div className="flex-1 min-w-[160px]">
        <label className="block text-[10px] font-bold text-purple-900 mb-0.5">Descripción / Asignatura</label>
        <input
          type="text"
          autoFocus
          value={pieAsignatura}
          onChange={(e) => setPieAsignatura(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="w-full px-2 py-1 border border-purple-300 rounded text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
          placeholder="Ej: Apoyo PIE Matemática"
          required
        />
      </div>

      <div className="w-24">
        <label className="block text-[10px] font-bold text-purple-900 mb-0.5">Horas Cron.</label>
        <input
          type="number"
          value={pieHoras}
          onChange={(e) => setPieHoras(Number(e.target.value))}
          onFocus={(e) => e.target.select()}
          className="w-full px-2 py-1 border border-purple-300 rounded text-xs text-center font-bold focus:ring-1 focus:ring-purple-500 focus:outline-none"
          min={1}
          max={44}
          step="0.5"
          required
        />
      </div>

      <div className="flex items-center gap-2 pt-4">
        <button
          type="submit"
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded text-xs shadow-xs transition-colors"
        >
          Guardar Apoyo PIE
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
});

// ============================================================================
// Componente Principal: DocenteAsignacionPanel
// ============================================================================

export const DocenteAsignacionPanel: React.FC<DocenteAsignacionPanelProps> = ({
  docente,
  colegio,
  cursos,
  asignaciones,
  onGuardarAsignacion,
  onEliminarAsignacion
}) => {
  const [formActivo, setFormActivo] = useState<TipoFormularioActivo>(null);

  const asignacionesDocente = asignaciones.filter(
    a => a.docenteId === docente.id || (a.coDocenteId === docente.id && a.tieneCoDocente)
  );

  return (
    <div className="space-y-3.5">
      {/* Barra de Acciones / Botones de Asignación Rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-orange-600" />
          <span>Carga Horaria & Asignaciones de {docente.nombres} {docente.apellidos}</span>
          <span className="text-[11px] font-normal text-slate-500">({asignacionesDocente.length} asignaciones)</span>
        </h4>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFormActivo(formActivo === 'REGULAR' ? null : 'REGULAR')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-md flex items-center gap-1 shadow-xs transition-colors ${
              formActivo === 'REGULAR'
                ? 'bg-orange-700 text-white'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            <Plus className="w-3 h-3" />
            <span>Asignar Asignatura / Taller</span>
          </button>

          <button
            type="button"
            onClick={() => setFormActivo(formActivo === 'CO_DOCENCIA' ? null : 'CO_DOCENCIA')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-md flex items-center gap-1 shadow-xs transition-colors ${
              formActivo === 'CO_DOCENCIA'
                ? 'bg-indigo-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>🤝 Co-Docencia / Apoyo Aula</span>
          </button>

          <button
            type="button"
            onClick={() => setFormActivo(formActivo === 'PIE' ? null : 'PIE')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-md flex items-center gap-1 shadow-xs transition-colors ${
              formActivo === 'PIE'
                ? 'bg-purple-700 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
            title="Asignar apoyo de Educación Especial / Diferencial / PAE a un curso"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>🛡️ Asignar Apoyo PIE</span>
          </button>
        </div>
      </div>

      {/* 1. Formulario Rápido Asignatura Regular / Taller Aislado */}
      {formActivo === 'REGULAR' && onGuardarAsignacion && (
        <FormAsignarRegular
          docente={docente}
          colegio={colegio}
          cursos={cursos}
          onGuardar={onGuardarAsignacion}
          onCerrar={() => setFormActivo(null)}
        />
      )}

      {/* 2. Formulario Rápido Co-Docencia / Apoyo Aula Aislado */}
      {formActivo === 'CO_DOCENCIA' && onGuardarAsignacion && (
        <FormAsignarCoDocencia
          docente={docente}
          colegio={colegio}
          cursos={cursos}
          onGuardar={onGuardarAsignacion}
          onCerrar={() => setFormActivo(null)}
        />
      )}

      {/* 3. Formulario Rápido Apoyo PIE Aislado */}
      {formActivo === 'PIE' && onGuardarAsignacion && (
        <FormAsignarPie
          docente={docente}
          colegio={colegio}
          cursos={cursos}
          onGuardar={onGuardarAsignacion}
          onCerrar={() => setFormActivo(null)}
        />
      )}

      {/* Lista de Asignaciones Actuales */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-600 font-semibold text-[10px] border-b">
            <tr>
              <th className="px-3 py-2">Asignatura / Función</th>
              <th className="px-3 py-2">Curso / Nivel</th>
              <th className="px-3 py-2 text-center">Horas Asignadas</th>
              <th className="px-3 py-2 text-center">Tipo / Modalidad</th>
              <th className="px-3 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {asignacionesDocente.map(a => {
              const esCoDoc = (a.coDocenteId === docente.id && a.tieneCoDocente) ||
                              a.esCoDocencia ||
                              a.esAgrupacionFlexible ||
                              a.tipoApoyo === 'CO_DOCENCIA' ||
                              a.tipoApoyo === 'AGRUPACION_FLEXIBLE' ||
                              a.tipoApoyo === 'REFUERZO_AULA' ||
                              a.tipoApoyo === 'APOYO_DOCENTE' ||
                              (a.asignatura && /co.*docenc|codocenc|agrupaci/i.test(a.asignatura));

              const esPie = Boolean(
                (a.tipoApoyo && a.tipoApoyo.toLowerCase().includes('pie')) ||
                (a.tipoApoyo && a.tipoApoyo.toLowerCase().includes('recurso')) ||
                (a.asignatura && a.asignatura.toLowerCase().includes('pie')) ||
                (a.horasCronologicasPie && a.horasCronologicasPie > 0)
              );

              return (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-800">
                    <input
                      type="text"
                      defaultValue={a.asignatura}
                      onBlur={async (e) => {
                        const val = e.target.value.trim();
                        if (val && val !== a.asignatura && onGuardarAsignacion) {
                          await onGuardarAsignacion({ ...a, asignatura: val });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="bg-transparent hover:bg-slate-100 focus:bg-white border-b border-transparent focus:border-orange-500 px-1 py-0.5 text-xs font-semibold text-slate-800 rounded outline-none w-full"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={a.cursoId || 'TRANSVERSAL'}
                      onChange={async (e) => {
                        if (onGuardarAsignacion) {
                          await onGuardarAsignacion({ ...a, cursoId: e.target.value });
                        }
                      }}
                      className="bg-transparent hover:bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-medium text-slate-700"
                    >
                      <option value="TRANSVERSAL">🌟 Taller Transversal (Sin Curso)</option>
                      {cursos.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nivel} {c.letra} ({c.regimen})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-slate-800">
                    <div className="inline-flex items-center justify-center gap-1">
                      <input
                        type="number"
                        defaultValue={esPie ? (a.horasCronologicasPie || a.horasPedagogicasAula) : a.horasPedagogicasAula}
                        min={1}
                        max={44}
                        step={esPie ? '0.5' : '1'}
                        onBlur={async (e) => {
                          const h = Number(e.target.value);
                          if (h > 0 && onGuardarAsignacion) {
                            if (esPie) {
                              await onGuardarAsignacion({ 
                                ...a, 
                                horasCronologicasPie: h, 
                                horasPedagogicasAula: Math.round(h * 1.333) 
                              });
                            } else if (h !== a.horasPedagogicasAula) {
                              await onGuardarAsignacion({ ...a, horasPedagogicasAula: h });
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className="w-16 text-center font-black bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-xs"
                      />
                      <span className="text-[10px] text-slate-400 font-normal">
                        {esPie ? 'hrs cron' : 'HA'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {esPie ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-purple-600" />
                        <span>{a.tipoApoyo || 'Apoyo PIE Dec. 170'}</span>
                      </span>
                    ) : esCoDoc ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1">
                        <span>🤝</span>
                        <span>{a.tipoApoyo === 'AGRUPACION_FLEXIBLE' ? 'Agrupación Flexible' : a.tipoApoyo === 'REFUERZO_AULA' ? 'Refuerzo Aula' : a.tipoApoyo === 'APOYO_DOCENTE' ? 'Apoyo Docente' : 'Co-Docencia'}</span>
                        {a.esTallerSep && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded">SEP</span>}
                      </span>
                    ) : (a.cursoId === 'TRANSVERSAL' || !a.cursoId || a.cursoId === 'SIN_CURSO') ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        🌟 Taller Transversal
                      </span>
                    ) : a.esTallerSep ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        🌱 SEP Extracurricular
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                        📚 Plan Regular
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`¿Eliminar la asignación de ${a.asignatura}?`)) {
                          if (onEliminarAsignacion) await onEliminarAsignacion(a.id);
                        }
                      }}
                      className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                      title="Eliminar asignación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {asignacionesDocente.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                  Este docente no tiene asignaturas, cursos ni apoyos PIE asignados actualmente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
