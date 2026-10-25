import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Users, 
  ShieldCheck, 
  Trash2, 
  Layers,
  GraduationCap,
  BookOpen,
  Clock,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Docente, AsignacionHoraria, CursoSae, Establecimiento, PlanEstudioCurricular } from '../types';
import { obtenerPlanPorCurso, PlanEstudioNivel } from '@slep/mineduc-engine';
import { listarPlanesEstudio } from '../database/db';

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
// Helper para resolver plan y asignaturas de un curso
// ============================================================================
interface InfoPlanResuelto {
  asignaturas: { nombre: string; horas: number; caracter?: string }[];
  horasLibreDisposicion: number;
  esJec: boolean;
  talleresJecPredefinidos: { nombre: string; horas?: number }[];
  nombrePlan: string;
}

function resolverPlanCurso(
  curso: CursoSae | null,
  planesDb: PlanEstudioCurricular[]
): InfoPlanResuelto {
  if (!curso) {
    return {
      asignaturas: [],
      horasLibreDisposicion: 0,
      esJec: false,
      talleresJecPredefinidos: [],
      nombrePlan: 'Sin curso'
    };
  }

  const esJec = curso.regimen === 'JEC';
  const talleresCurso = curso.talleresJec || [];

  // 1. Si el curso tiene un plan de estudio personalizado asignado en la BD
  if (curso.planEstudioId) {
    const planDb = planesDb.find(p => p.id === curso.planEstudioId);
    if (planDb && planDb.asignaturas && planDb.asignaturas.length > 0) {
      return {
        asignaturas: planDb.asignaturas.map(a => ({
          nombre: a.nombre,
          horas: Number(a.horasSemanales) || 2,
          caracter: a.caracter || 'Obligatoria'
        })),
        horasLibreDisposicion: planDb.horasLibreDisposicion || (esJec ? 6 : 0),
        esJec: planDb.regimen === 'JEC' || esJec,
        talleresJecPredefinidos: talleresCurso.map(t => ({ nombre: t.nombre, horas: t.horas })),
        nombrePlan: planDb.nivel
      };
    }
  }

  // 2. Si no, consultar el motor normativo de MINEDUC
  const planMineduc: PlanEstudioNivel | null = obtenerPlanPorCurso(
    curso.nivel,
    curso.regimen,
    curso.especialidadTp
  );

  if (planMineduc && planMineduc.asignaturasBase && planMineduc.asignaturasBase.length > 0) {
    return {
      asignaturas: planMineduc.asignaturasBase.map(a => ({
        nombre: a.nombre,
        horas: a.horasSugeridas,
        caracter: 'Obligatoria'
      })),
      horasLibreDisposicion: planMineduc.horasLibreDisposicion || (esJec ? 6 : 0),
      esJec: planMineduc.regimen === 'JEC' || esJec,
      talleresJecPredefinidos: talleresCurso.map(t => ({ nombre: t.nombre, horas: t.horas })),
      nombrePlan: planMineduc.nivel
    };
  }

  // 3. Fallback estándar si no hay coincidencia directa
  const fallback = [
    { nombre: 'Lenguaje y Comunicación', horas: 6, caracter: 'Obligatoria' },
    { nombre: 'Matemática', horas: 6, caracter: 'Obligatoria' },
    { nombre: 'Ciencias Naturales', horas: 3, caracter: 'Obligatoria' },
    { nombre: 'Historia, Geografía y Ciencias Sociales', horas: 3, caracter: 'Obligatoria' },
    { nombre: 'Inglés', horas: 3, caracter: 'Obligatoria' },
    { nombre: 'Educación Física y Salud', horas: 3, caracter: 'Obligatoria' },
    { nombre: 'Artes Visuales', horas: 2, caracter: 'Obligatoria' },
    { nombre: 'Música', horas: 2, caracter: 'Obligatoria' },
    { nombre: 'Tecnología', horas: 1, caracter: 'Obligatoria' },
    { nombre: 'Orientación', horas: 1, caracter: 'Obligatoria' },
    { nombre: 'Religión', horas: 2, caracter: 'Opcional' }
  ];

  return {
    asignaturas: fallback,
    horasLibreDisposicion: esJec ? 6 : 0,
    esJec,
    talleresJecPredefinidos: talleresCurso.map(t => ({ nombre: t.nombre, horas: t.horas })),
    nombrePlan: `${curso.nivel} (${curso.regimen})`
  };
}

// ============================================================================
// Helper de Disponibilidad y Cobertura de Asignaturas en Curso
// ============================================================================
interface DisponibilidadAsignatura {
  nombre: string;
  horasPlan: number;
  horasAsignadas: number;
  horasDisponibles: number;
  estado: 'DISPONIBLE' | 'CUBIERTA' | 'EXCEDIDA';
  caracter?: string;
}

function calcularDisponibilidadCurso(
  curso: CursoSae | null,
  infoPlan: InfoPlanResuelto,
  asignacionesColegio: AsignacionHoraria[]
): {
  disponibles: DisponibilidadAsignatura[];
  cubiertas: DisponibilidadAsignatura[];
  todas: DisponibilidadAsignatura[];
  horasLibreDisponibles: number;
  horasLibrePlan: number;
  horasLibreAsignadas: number;
} {
  if (!curso) {
    return {
      disponibles: [],
      cubiertas: [],
      todas: [],
      horasLibreDisponibles: 0,
      horasLibrePlan: 0,
      horasLibreAsignadas: 0
    };
  }

  const asigsCurso = asignacionesColegio.filter(a => a.cursoId === curso.id && !a.esCoDocencia);

  const todas: DisponibilidadAsignatura[] = infoPlan.asignaturas.map(asigPlan => {
    const horasAsig = asigsCurso
      .filter(a => a.asignatura.trim().toLowerCase() === asigPlan.nombre.trim().toLowerCase())
      .reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);

    const horasDisp = Math.max(0, asigPlan.horas - horasAsig);
    const estado: 'DISPONIBLE' | 'CUBIERTA' | 'EXCEDIDA' = 
      horasAsig >= asigPlan.horas ? (horasAsig > asigPlan.horas ? 'EXCEDIDA' : 'CUBIERTA') : 'DISPONIBLE';

    return {
      nombre: asigPlan.nombre,
      horasPlan: asigPlan.horas,
      horasAsignadas: horasAsig,
      horasDisponibles: horasDisp,
      estado,
      caracter: asigPlan.caracter
    };
  });

  const disponibles = todas.filter(a => a.estado === 'DISPONIBLE');
  const cubiertas = todas.filter(a => a.estado !== 'DISPONIBLE');

  // Libre Disposición / JEC
  const horasLibrePlan = infoPlan.horasLibreDisposicion || (curso.regimen === 'JEC' ? 6 : 0);
  const horasLibreAsignadas = asigsCurso
    .filter(a => a.esTallerJec || /taller|jec|libre/i.test(a.asignatura))
    .reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
  const horasLibreDisponibles = Math.max(0, horasLibrePlan - horasLibreAsignadas);

  return {
    disponibles,
    cubiertas,
    todas,
    horasLibreDisponibles,
    horasLibrePlan,
    horasLibreAsignadas
  };
}

function obtenerMateriasPreferentesDocente(docenteId: string, asignaciones: AsignacionHoraria[]): string[] {
  const asigsDoc = asignaciones.filter(a => a.docenteId === docenteId && !a.esCoDocencia);
  const conteo: Record<string, number> = {};
  for (const a of asigsDoc) {
    const nom = a.asignatura.trim();
    if (nom) {
      conteo[nom] = (conteo[nom] || 0) + (a.horasPedagogicasAula || 1);
    }
  }
  return Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
}

// ============================================================================
// Subcomponentes aislados para evitar re-renderizados del panel al tipear
// ============================================================================

interface FormRegularProps {
  docente: Docente;
  colegio: Establecimiento;
  cursos: CursoSae[];
  planesDb: PlanEstudioCurricular[];
  asignacionesColegio: AsignacionHoraria[];
  onGuardar: (asig: AsignacionHoraria) => Promise<void> | void;
  onCerrar: () => void;
}

const FormAsignarRegular: React.FC<FormRegularProps> = React.memo(({
  docente,
  colegio,
  cursos,
  planesDb,
  asignacionesColegio,
  onGuardar,
  onCerrar
}) => {
  const [regCursoId, setRegCursoId] = useState(cursos[0]?.id || 'TRANSVERSAL');
  const [tipoAsignaturaSeleccionada, setTipoAsignaturaSeleccionada] = useState<string>('');
  const [regNombreCustom, setRegNombreCustom] = useState('');
  const [regHoras, setRegHoras] = useState(4);
  const [regEsTallerSep, setRegEsTallerSep] = useState(false);

  // Obtener plan resuelto del curso seleccionado
  const cursoSeleccionado = useMemo(() => {
    return cursos.find(c => c.id === regCursoId) || null;
  }, [cursos, regCursoId]);

  const infoPlan = useMemo(() => {
    return resolverPlanCurso(cursoSeleccionado, planesDb);
  }, [cursoSeleccionado, planesDb]);

  // Materias preferentes del docente (ej: Alejandra Ferrada -> Inglés)
  const materiasPreferentes = useMemo(() => {
    return obtenerMateriasPreferentesDocente(docente.id, asignacionesColegio);
  }, [docente.id, asignacionesColegio]);

  // Disponibilidad de asignaturas en el curso seleccionado
  const datosDisp = useMemo(() => {
    return calcularDisponibilidadCurso(cursoSeleccionado, infoPlan, asignacionesColegio);
  }, [cursoSeleccionado, infoPlan, asignacionesColegio]);

  // Info de la asignatura actualmente seleccionada
  const infoAsigSeleccionada = useMemo(() => {
    return datosDisp.todas.find(a => a.nombre.toLowerCase() === tipoAsignaturaSeleccionada.toLowerCase()) || null;
  }, [datosDisp.todas, tipoAsignaturaSeleccionada]);

  // Al cambiar de curso, precargar inteligentemente la asignatura DISPONIBLE o afín al docente
  useEffect(() => {
    if (regCursoId === 'TRANSVERSAL') {
      setTipoAsignaturaSeleccionada('__TRANSVERSAL__');
      setRegNombreCustom('Taller Institucional Transversal');
      setRegHoras(2);
      return;
    }

    // 1. Prioridad: ¿El docente ya dicta una materia habitual que esté DISPONIBLE en este curso?
    const materiaAfinDisponible = datosDisp.disponibles.find(d => 
      materiasPreferentes.some(pref => pref.toLowerCase() === d.nombre.toLowerCase())
    );

    if (materiaAfinDisponible) {
      setTipoAsignaturaSeleccionada(materiaAfinDisponible.nombre);
      setRegNombreCustom('');
      setRegHoras(materiaAfinDisponible.horasDisponibles);
      return;
    }

    // 2. Si no, seleccionar la primera asignatura DISPONIBLE del curso con su saldo restante
    if (datosDisp.disponibles.length > 0) {
      const primeraDisp = datosDisp.disponibles[0];
      setTipoAsignaturaSeleccionada(primeraDisp.nombre);
      setRegNombreCustom('');
      setRegHoras(primeraDisp.horasDisponibles);
      return;
    }

    // 3. Si no hay troncales disponibles pero hay horas de Libre Disposición JEC
    if (datosDisp.horasLibreDisponibles > 0) {
      setTipoAsignaturaSeleccionada('__LIBRE_DISPOSICION__');
      setRegNombreCustom('');
      setRegHoras(Math.min(datosDisp.horasLibreDisponibles, 2));
      return;
    }

    // 4. Si todo el curso está cubierto al 100%, tomar la primera del plan como referencia
    if (infoPlan.asignaturas.length > 0) {
      const primera = infoPlan.asignaturas[0];
      setTipoAsignaturaSeleccionada(primera.nombre);
      setRegNombreCustom('');
      setRegHoras(primera.horas || 2);
    } else {
      setTipoAsignaturaSeleccionada('__OTRO_PERSONALIZADO__');
      setRegNombreCustom('');
      setRegHoras(2);
    }
  }, [regCursoId, datosDisp, materiasPreferentes, infoPlan]);

  const esModoPersonalizado = 
    regCursoId === 'TRANSVERSAL' ||
    tipoAsignaturaSeleccionada === '__LIBRE_DISPOSICION__' ||
    tipoAsignaturaSeleccionada === '__OTRO_PERSONALIZADO__';

  const handleSeleccionAsignatura = (valor: string) => {
    setTipoAsignaturaSeleccionada(valor);

    if (valor.startsWith('__TALLER_EXISTENTE__:')) {
      const nombreTaller = valor.replace('__TALLER_EXISTENTE__:', '');
      const tallerObj = infoPlan.talleresJecPredefinidos.find(t => t.nombre === nombreTaller);
      setRegNombreCustom(nombreTaller);
      setRegHoras(tallerObj?.horas || 2);
    } else if (valor === '__LIBRE_DISPOSICION__') {
      setRegNombreCustom('');
      const horasLibre = datosDisp.horasLibreDisponibles > 0 ? Math.min(datosDisp.horasLibreDisponibles, 4) : 2;
      setRegHoras(horasLibre);
    } else if (valor === '__OTRO_PERSONALIZADO__') {
      setRegNombreCustom('');
      setRegHoras(2);
    } else {
      // Es una asignatura del plan de estudio (verificar disponibilidad)
      setRegNombreCustom('');
      const dispObj = datosDisp.todas.find(a => a.nombre === valor);
      if (dispObj) {
        setRegHoras(dispObj.horasDisponibles > 0 ? dispObj.horasDisponibles : dispObj.horasPlan);
      } else {
        const asig = infoPlan.asignaturas.find(a => a.nombre === valor);
        if (asig?.horas) setRegHoras(asig.horas);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regCursoId) return;

    let nombreFinal = '';
    let esJec = false;

    if (regCursoId === 'TRANSVERSAL') {
      nombreFinal = regNombreCustom.trim() || 'Taller Institucional Transversal';
      esJec = false;
    } else if (tipoAsignaturaSeleccionada === '__LIBRE_DISPOSICION__') {
      nombreFinal = regNombreCustom.trim();
      esJec = true;
    } else if (tipoAsignaturaSeleccionada === '__OTRO_PERSONALIZADO__') {
      nombreFinal = regNombreCustom.trim();
      esJec = /taller|jec|libre/i.test(nombreFinal);
    } else if (tipoAsignaturaSeleccionada.startsWith('__TALLER_EXISTENTE__:')) {
      nombreFinal = tipoAsignaturaSeleccionada.replace('__TALLER_EXISTENTE__:', '').trim();
      esJec = true;
    } else {
      nombreFinal = tipoAsignaturaSeleccionada.trim();
      esJec = false;
    }

    if (!nombreFinal) {
      alert('Por favor especifica el nombre de la asignatura o taller.');
      return;
    }

    const newAsig: AsignacionHoraria = {
      id: `asig-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: docente.periodo || 2026,
      cursoId: regCursoId,
      docenteId: docente.id,
      asignatura: nombreFinal,
      horasPedagogicasAula: Number(regHoras),
      esTallerJec: esJec,
      esTallerSep: regEsTallerSep,
      esProporcionDocente: false
    };

    await onGuardar(newAsig);
    onCerrar();
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-white border border-orange-200 rounded-xl shadow-xs transition-all space-y-2">
      <div className="flex flex-wrap items-end gap-2.5 text-xs">
        
        {/* 1. SELECCIÓN DE CURSO (PRIMER PASO) */}
        <div className="min-w-[190px] flex-1 sm:flex-none">
          <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-orange-600" />
            <span>1. Curso o Modalidad</span>
          </label>
          <select
            value={regCursoId}
            onChange={(e) => setRegCursoId(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            {cursos.map(c => (
              <option key={c.id} value={c.id}>
                {c.nivel} {c.letra} ({c.regimen})
              </option>
            ))}
            <option value="TRANSVERSAL">🌟 Taller Institucional / Transversal (Sin Curso)</option>
          </select>
        </div>

        {/* 2. SELECCIÓN DE ASIGNATURA SEGÚN PLAN (SEGUNDO PASO) */}
        {regCursoId !== 'TRANSVERSAL' && (
          <div className="min-w-[240px] flex-1">
            <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-orange-600" />
                <span>2. Asignatura según Plan ({infoPlan.nombrePlan})</span>
              </span>
              {datosDisp.disponibles.length > 0 && (
                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full border border-emerald-300">
                  {datosDisp.disponibles.length} disponibles
                </span>
              )}
            </label>
            <select
              value={tipoAsignaturaSeleccionada}
              onChange={(e) => handleSeleccionAsignatura(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              {datosDisp.disponibles.length > 0 && (
                <optgroup label={`🟢 Asignaturas Disponibles con Horas Pendientes (${datosDisp.disponibles.length})`}>
                  {datosDisp.disponibles.map((asig, idx) => (
                    <option key={`disp-${idx}`} value={asig.nombre}>
                      🟢 {asig.nombre} — {asig.horasDisponibles} HA disponibles (Plan: {asig.horasPlan} HA)
                    </option>
                  ))}
                </optgroup>
              )}

              {infoPlan.talleresJecPredefinidos.length > 0 && (
                <optgroup label="🎨 Talleres JEC Registrados en Curso">
                  {infoPlan.talleresJecPredefinidos.map((tj, idx) => (
                    <option key={`tj-${idx}`} value={`__TALLER_EXISTENTE__:${tj.nombre}`}>
                      {tj.nombre} {tj.horas ? `(${tj.horas} HA)` : ''}
                    </option>
                  ))}
                </optgroup>
              )}

              {(infoPlan.esJec || datosDisp.horasLibrePlan > 0) && (
                <optgroup label="⚡ Horas de Libre Disposición (JEC / PEI)">
                  <option value="__LIBRE_DISPOSICION__">
                    ✨ Libre Disposición / Taller JEC ({datosDisp.horasLibreDisponibles} HA disponibles de {datosDisp.horasLibrePlan} HA)
                  </option>
                </optgroup>
              )}

              {datosDisp.cubiertas.length > 0 && (
                <optgroup label={`⚪ Asignaturas Cubiertas al 100% (${datosDisp.cubiertas.length})`}>
                  {datosDisp.cubiertas.map((asig, idx) => (
                    <option key={`cub-${idx}`} value={asig.nombre}>
                      ⚪ {asig.nombre} (Cubierta: {asig.horasAsignadas}/{asig.horasPlan} HA)
                    </option>
                  ))}
                </optgroup>
              )}

              <optgroup label="✏️ Otros">
                <option value="__OTRO_PERSONALIZADO__">
                  ✏️ Otra Asignatura / Taller Específico...
                </option>
              </optgroup>
            </select>
          </div>
        )}

        {/* 3. CAMPO DE NOMBRE PERSONALIZADO (CONDICIONAL PARA JEC O LIBRE DISPOSICIÓN) */}
        {esModoPersonalizado && (
          <div className="min-w-[200px] flex-1">
            <label className="block text-[10px] font-bold text-amber-700 mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {regCursoId === 'TRANSVERSAL'
                  ? 'Nombre del Taller Transversal'
                  : 'Nombre del Taller JEC / Libre Disposición'}
              </span>
            </label>
            <input
              type="text"
              autoFocus
              value={regNombreCustom}
              onChange={(e) => setRegNombreCustom(e.target.value)}
              placeholder="Ej: Taller de Robótica, Refuerzo Matemático, Ajedrez..."
              className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs font-bold text-slate-900 bg-amber-50/40 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              required
            />
          </div>
        )}

        {/* 4. HORAS PEDAGÓGICAS DE AULA */}
        <div className="w-24">
          <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Horas Aula</span>
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={regHoras}
              onChange={(e) => setRegHoras(Number(e.target.value))}
              onFocus={(e) => e.target.select()}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-center font-black focus:ring-2 focus:ring-orange-500 focus:outline-none"
              min={1}
              max={44}
              required
            />
            <span className="text-[10px] font-bold text-slate-500">HA</span>
          </div>
        </div>

        {/* 5. FINANCIAMIENTO SEP */}
        <div className="flex items-center pb-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 select-none">
            <input
              type="checkbox"
              checked={regEsTallerSep}
              onChange={(e) => setRegEsTallerSep(e.target.checked)}
              className="rounded text-orange-600 focus:ring-orange-500"
            />
            <span>Financiamiento SEP</span>
          </label>
        </div>

        {/* 6. BOTONES ACCIONES */}
        <div className="flex items-center gap-2 pb-0.5">
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1 shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Guardar</span>
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-semibold"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Banner Informativo Dinámico de Disponibilidad de la Asignatura */}
      {regCursoId !== 'TRANSVERSAL' && (
        <div className="pt-0.5">
          {infoAsigSeleccionada ? (
            infoAsigSeleccionada.estado === 'DISPONIBLE' ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  <strong>{infoAsigSeleccionada.nombre}:</strong> Quedan <strong>{infoAsigSeleccionada.horasDisponibles} HA disponibles</strong> para este curso (Plan Oficial: {infoAsigSeleccionada.horasPlan} HA • Asignadas a otros docentes: {infoAsigSeleccionada.horasAsignadas} HA).
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  <strong>{infoAsigSeleccionada.nombre} (Cubierta):</strong> Esta materia ya tiene sus <strong>{infoAsigSeleccionada.horasAsignadas}/{infoAsigSeleccionada.horasPlan} HA cubiertas</strong> en el plan de este curso.
                </span>
              </div>
            )
          ) : tipoAsignaturaSeleccionada === '__LIBRE_DISPOSICION__' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>
                <strong>Horas de Libre Disposición JEC:</strong> Quedan <strong>{datosDisp.horasLibreDisponibles} HA disponibles</strong> para talleres o proyectos en este curso (Plan: {datosDisp.horasLibrePlan} HA • Asignadas: {datosDisp.horasLibreAsignadas} HA).
              </span>
            </div>
          ) : null}
        </div>
      )}
    </form>
  );
});

interface FormCoDocenciaProps {
  docente: Docente;
  colegio: Establecimiento;
  cursos: CursoSae[];
  planesDb: PlanEstudioCurricular[];
  onGuardar: (asig: AsignacionHoraria) => Promise<void> | void;
  onCerrar: () => void;
}

const FormAsignarCoDocencia: React.FC<FormCoDocenciaProps> = React.memo(({
  docente,
  colegio,
  cursos,
  planesDb,
  onGuardar,
  onCerrar
}) => {
  const [coDocCursoId, setCoDocCursoId] = useState(cursos[0]?.id || '');
  const [tipoAsignaturaSeleccionada, setTipoAsignaturaSeleccionada] = useState<string>('');
  const [coDocNombreCustom, setCoDocNombreCustom] = useState('');
  const [coDocHoras, setCoDocHoras] = useState(4);
  const [coDocTipo, setCoDocTipo] = useState<'CO_DOCENCIA' | 'AGRUPACION_FLEXIBLE' | 'REFUERZO_AULA' | 'APOYO_DOCENTE'>('CO_DOCENCIA');
  const [coDocFinanciamiento, setCoDocFinanciamiento] = useState<'SUB_GEN' | 'SEP'>('SEP');

  const cursoSeleccionado = useMemo(() => {
    return cursos.find(c => c.id === coDocCursoId) || null;
  }, [cursos, coDocCursoId]);

  const infoPlan = useMemo(() => {
    return resolverPlanCurso(cursoSeleccionado, planesDb);
  }, [cursoSeleccionado, planesDb]);

  useEffect(() => {
    if (infoPlan.asignaturas.length > 0) {
      setTipoAsignaturaSeleccionada(infoPlan.asignaturas[0].nombre);
      setCoDocNombreCustom('');
    } else {
      setTipoAsignaturaSeleccionada('__PERSONALIZADA__');
      setCoDocNombreCustom('Apoyo Pedagógico en Aula');
    }
  }, [coDocCursoId, infoPlan]);

  const esPersonalizada = tipoAsignaturaSeleccionada === '__PERSONALIZADA__';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coDocCursoId) return;

    const nombreFinal = esPersonalizada
      ? coDocNombreCustom.trim()
      : tipoAsignaturaSeleccionada.trim();

    if (!nombreFinal) {
      alert('Por favor especifica la asignatura o área de apoyo.');
      return;
    }

    const newAsig: AsignacionHoraria = {
      id: `asig-codoc-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: docente.periodo || 2026,
      cursoId: coDocCursoId,
      docenteId: docente.id,
      asignatura: nombreFinal,
      horasPedagogicasAula: Number(coDocHoras),
      esCoDocencia: true,
      esAgrupacionFlexible: coDocTipo === 'AGRUPACION_FLEXIBLE',
      tipoApoyo: coDocTipo,
      esTallerSep: coDocFinanciamiento === 'SEP',
      esProporcionDocente: false
    };

    await onGuardar(newAsig);
    onCerrar();
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-wrap items-end gap-2.5 text-xs shadow-xs">
      {/* 1. CURSO RECEPTOR */}
      <div className="min-w-[180px] flex-1 sm:flex-none">
        <label className="block text-[10px] font-bold text-indigo-900 mb-1 flex items-center gap-1">
          <GraduationCap className="w-3.5 h-3.5 text-indigo-700" />
          <span>1. Curso Receptor del Apoyo</span>
        </label>
        <select
          value={coDocCursoId}
          onChange={(e) => setCoDocCursoId(e.target.value)}
          className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          required
        >
          {cursos.map(c => (
            <option key={c.id} value={c.id}>
              {c.nivel} {c.letra} ({c.regimen})
            </option>
          ))}
        </select>
      </div>

      {/* 2. ASIGNATURA SEGÚN PLAN */}
      <div className="min-w-[200px] flex-1">
        <label className="block text-[10px] font-bold text-indigo-900 mb-1 flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5 text-indigo-700" />
          <span>2. Asignatura Apoyada</span>
        </label>
        <select
          value={tipoAsignaturaSeleccionada}
          onChange={(e) => setTipoAsignaturaSeleccionada(e.target.value)}
          className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-xs bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          {infoPlan.asignaturas.map((a, idx) => (
            <option key={idx} value={a.nombre}>
              {a.nombre} ({a.horas} HA)
            </option>
          ))}
          <option value="__PERSONALIZADA__">✨ Otro Apoyo / Taller Específico...</option>
        </select>
      </div>

      {/* 3. CAMPO PERSONALIZADO */}
      {esPersonalizada && (
        <div className="min-w-[180px] flex-1">
          <label className="block text-[10px] font-bold text-indigo-900 mb-1">
            Nombre del Apoyo / Taller
          </label>
          <input
            type="text"
            autoFocus
            value={coDocNombreCustom}
            onChange={(e) => setCoDocNombreCustom(e.target.value)}
            placeholder="Ej: Co-Docencia Matemática, Refuerzo..."
            className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />
        </div>
      )}

      {/* 4. MODALIDAD DE APOYO */}
      <div className="min-w-[180px]">
        <label className="block text-[10px] font-bold text-indigo-900 mb-1">
          Modalidad de Apoyo
        </label>
        <select
          value={coDocTipo}
          onChange={(e) => setCoDocTipo(e.target.value as any)}
          className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="CO_DOCENCIA">🤝 Co-Docencia en Aula</option>
          <option value="AGRUPACION_FLEXIBLE">👥 Agrupación Flexible (Separación)</option>
          <option value="REFUERZO_AULA">💡 Refuerzo Pedagógico en Aula</option>
          <option value="APOYO_DOCENTE">🛡️ Apoyo Docente Adicional</option>
        </select>
      </div>

      {/* 5. HORAS AULA */}
      <div className="w-24">
        <label className="block text-[10px] font-bold text-indigo-900 mb-1">
          Horas Aula
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={coDocHoras}
            onChange={(e) => setCoDocHoras(Number(e.target.value))}
            onFocus={(e) => e.target.select()}
            className="w-full px-2 py-1.5 border border-indigo-300 rounded-lg text-xs text-center font-black focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            min={1}
            max={44}
            required
          />
          <span className="text-[10px] font-bold text-indigo-600">HA</span>
        </div>
      </div>

      {/* 6. FINANCIAMIENTO */}
      <div className="min-w-[140px]">
        <label className="block text-[10px] font-bold text-indigo-900 mb-1">
          Financiamiento
        </label>
        <select
          value={coDocFinanciamiento}
          onChange={(e) => setCoDocFinanciamiento(e.target.value as any)}
          className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="SEP">Subvención SEP (No suma plan)</option>
          <option value="SUB_GEN">Subvención General</option>
        </select>
      </div>

      {/* 7. BOTONES */}
      <div className="flex items-center gap-2 pb-0.5">
        <button
          type="submit"
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Guardar Co-Docencia</span>
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-semibold"
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
  const [planesDb, setPlanesDb] = useState<PlanEstudioCurricular[]>([]);

  useEffect(() => {
    let cancel = false;
    listarPlanesEstudio()
      .then(res => {
        if (!cancel && res) setPlanesDb(res);
      })
      .catch(err => console.warn('Error al cargar planes de estudio:', err));
    return () => { cancel = true; };
  }, []);

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
          planesDb={planesDb}
          asignacionesColegio={asignaciones}
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
          planesDb={planesDb}
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
