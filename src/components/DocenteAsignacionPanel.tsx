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
  AlertCircle,
  X,
  UserCheck
} from 'lucide-react';
import { Docente, AsignacionHoraria, CursoSae, Establecimiento, PlanEstudioCurricular } from '../types';
import { 
  PlanEstudioNivel,
  PLANES_MINEDUC,
  CATALOGO_PROFUNDIZACION_HC_27,
  CATALOGO_PLAN_COMUN_ELECTIVO_3_4,
  buscarContratoMinimoPorTabla,
  calcularAuditoriaDocenteMultitramo,
  esNivelParvulario,
  calcularDotacionParvulariaCurso,
  buscarContratoMinimoParvulariaPorMinutos,
  obtenerTramoMineduc,
  formatearMinutosAHHMM,
  CATALOGO_BCEP_PARVULARIA,
  resolverCodigoYAmbitoAsignatura,
  coincideAsignacionConNucleoBcep
} from '@slep/mineduc-engine';
import { listarPlanesEstudio } from '../database/db';
import { calcularHorasFueraAulaDocente } from '../services/auditoriaDocenteService';
import {
  InfoPlanResuelto,
  DisponibilidadAsignatura,
  esCursoModalidadEpja,
  esCursoNivelMedio34,
  esCursoModalidadTp,
  esTextoTallerOLibreDisposicion,
  resolverPlanCurso,
  esAsignaturaProfundizacionHc,
  esAsignaturaPlanComunElectivo,
  normalizarNombreAsignatura,
  sonAsignaturasEquivalentes,
  esAsignacionCoDocenciaOApoyo,
  esAsignacionLibreDisposicionJec,
  calcularDisponibilidadCurso,
  calcularSaldoDocentePorFuente
} from '../services/curricularPlanService';

export {
  esCursoModalidadEpja,
  resolverPlanCurso,
  esAsignaturaProfundizacionHc,
  esAsignaturaPlanComunElectivo,
  normalizarNombreAsignatura,
  sonAsignaturasEquivalentes,
  esAsignacionCoDocenciaOApoyo,
  calcularDisponibilidadCurso
};
export type { DisponibilidadAsignatura, InfoPlanResuelto };

interface DocenteAsignacionPanelProps {
  docente: Docente;
  colegio: Establecimiento;
  cursos: CursoSae[];
  asignaciones: AsignacionHoraria[];
  docentes?: Docente[];
  periodoActivo?: number;
  onGuardarAsignacion?: (asig: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion?: (id: string) => Promise<void> | void;
}

type TipoFormularioActivo = 'REGULAR' | 'CO_DOCENCIA' | 'PIE' | null;
export type AmbitoFormRegular = 'PLAN_COMUN' | 'DIFERENCIADA_HC_ELEC' | 'LIBRE_DISPOSICION' | 'OTRO';

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
// Subcomponente de Fila Editable de Asignación en Tabla Principal
// ============================================================================
interface FilaAsignacionProps {
  asignacion: AsignacionHoraria;
  docente: Docente;
  cursos: CursoSae[];
  planesDb: PlanEstudioCurricular[];
  asignacionesColegio: AsignacionHoraria[];
  onGuardarAsignacion?: (a: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion?: (id: string) => Promise<void> | void;
}

export function getHorasAulaLectivaAsig(a: Partial<AsignacionHoraria>): number {
  if (a.horasPedagogicasAula) return a.horasPedagogicasAula;
  if (a.horasCronologicasPie) return Math.round(a.horasCronologicasPie * 1.333);
  return 0;
}

const FilaAsignacionDocente: React.FC<FilaAsignacionProps> = React.memo(({
  asignacion: a,
  docente,
  cursos,
  planesDb,
  asignacionesColegio,
  onGuardarAsignacion,
  onEliminarAsignacion
}) => {
  const [editandoManual, setEditandoManual] = useState(false);
  const [nombreManual, setNombreManual] = useState(a.asignatura);
  const [asigTransversal, setAsigTransversal] = useState(a.asignatura);
  const esCoDoc = (a.coDocenteId === docente.id && a.tieneCoDocente) ||
                  a.esCoDocencia ||
                  a.esAgrupacionFlexible ||
                  a.tipoApoyo === 'CO_DOCENCIA' ||
                  a.tipoApoyo === 'AGRUPACION_FLEXIBLE' ||
                  a.tipoApoyo === 'REFUERZO_AULA' ||
                  a.tipoApoyo === 'APOYO_DOCENTE' ||
                  (a.asignatura && /co.*docenc|codocenc|agrupaci/i.test(a.asignatura));

  // Una asignación es PIE única y exclusivamente si su denominación o tipo lo indica,
  // o si el docente asignado es de estamento diferencial / 100% financiamiento PIE.
  // JAMÁS debe activarse por tener horas numéricas cronológicas.
  const esAsignacionPie = Boolean(
    (a.tipoApoyo && /pie|decreto 170|recurso|multidisciplinario|cl[ií]nico/i.test(a.tipoApoyo)) ||
    (a.asignatura && /pie|decreto 170|aula de recurso/i.test(a.asignatura))
  );

  const esDocentePiePuro = docente.estamento === 'DOCENTE_DIFERENCIAL' ||
    ((docente.horasPieTitular || 0) + (docente.horasPieContrata || 0) > 0 &&
     (docente.horasSubvencionGeneralTitular || 0) + (docente.horasSubvencionGeneralContrata || 0) === 0);

  const esPie = esAsignacionPie || (esDocentePiePuro && !a.esTallerSep && !a.esTallerJec);

  const esTrabajoNoAula = Boolean(
    a.esTrabajoColaborativo || 
    a.tipoApoyo === 'TRABAJO_COLABORATIVO' || 
    (a.tipoApoyo && /colaborativo|art\.?\s*86|cl[ií]nico/i.test(a.tipoApoyo)) ||
    (a.asignatura && /colaborativo|art\.?\s*86|cl[ií]nico/i.test(a.asignatura))
  );

  const esApoyoAulaCurso = Boolean(a.cursoId && a.cursoId !== 'TRANSVERSAL' && a.cursoId !== 'SIN_CURSO');
  const esDocenteDiferencialFila = docente.estamento === 'DOCENTE_DIFERENCIAL' || 
    (docente.horasPieTitular || 0) + (docente.horasPieContrata || 0) > 0;

  // En todas las asignaturas asignadas a curso, las horas son siempre pedagógicas (45m)
  // y sujetas a cálculo de proporción docente Ley 20.903 (salvo párvulos con DTO 306).
  const [localHoras, setLocalHoras] = useState<number | string>(
    esApoyoAulaCurso
      ? (a.horasPedagogicasAula || a.horasCronologicasPie || 0)
      : (a.horasCronologicasPie || a.horasPedagogicasAula || 0)
  );

  useEffect(() => {
    setNombreManual(a.asignatura);
    setAsigTransversal(a.asignatura);
    setLocalHoras(
      esApoyoAulaCurso
        ? (a.horasPedagogicasAula || a.horasCronologicasPie || 0)
        : (a.horasCronologicasPie || a.horasPedagogicasAula || 0)
    );
  }, [a.id, a.asignatura, a.horasPedagogicasAula, a.horasCronologicasPie, a.cursoId, esApoyoAulaCurso]);

  // Asegurar proporción docente activa en toda asignación frente a curso
  useEffect(() => {
    if (esApoyoAulaCurso && !esTrabajoNoAula && a.esProporcionDocente !== true && onGuardarAsignacion) {
      const ha = a.horasPedagogicasAula || a.horasCronologicasPie || 0;
      onGuardarAsignacion({
        ...a,
        horasPedagogicasAula: ha,
        esProporcionDocente: true,
        horasCronologicasPie: esPie ? Math.round(ha * 0.75 * 10) / 10 : undefined
      });
    }
  }, [a.id, esApoyoAulaCurso, esTrabajoNoAula, a.esProporcionDocente, esPie]);

  const cursoActual = useMemo(() => {
    return cursos.find(c => c.id === a.cursoId) || null;
  }, [cursos, a.cursoId]);

  const infoPlan = useMemo(() => {
    return resolverPlanCurso(cursoActual, planesDb);
  }, [cursoActual, planesDb]);

  const disponibilidad = useMemo(() => {
    return calcularDisponibilidadCurso(cursoActual, infoPlan, asignacionesColegio);
  }, [cursoActual, infoPlan, asignacionesColegio]);

  const esEducadoraFila = docente.estamento === 'EDUCADORA_PARVULO' || 
    Boolean(docente.esEducadoraParvulo) || 
    Boolean(docente.cargoInstitucional && /p[aá]rvulo|infantil|prek[ií]nder|k[ií]nder/i.test(docente.cargoInstitucional)) ||
    Boolean(docente.titulo && /p[aá]rvulo|infantil|preescolar/i.test(docente.titulo)) ||
    Boolean(docente.funcionPrincipal && /p[aá]rvulo|infantil|prek[ií]nder|k[ií]nder/i.test(docente.funcionPrincipal));
  const esParvulariaFila = esEducadoraFila && Boolean(cursoActual && esNivelParvulario(cursoActual.nivel));
  const esCoDocParv = esEducadoraFila && Boolean(a.esCoDocenciaParvularia || (esParvulariaFila && esCoDoc));

  // Verificar si la asignatura actual coincide con algún núcleo BCEP de Educación Parvularia
  const matchBcepActual = CATALOGO_BCEP_PARVULARIA.find(b => b.nucleo.toLowerCase() === (a.asignatura || '').trim().toLowerCase());
  const esCoDocDto306Nombre = /atenci[oó]n\s*directa\s*y\s*co-docencia\s*parvularia/i.test(a.asignatura || '');

  const esCursoEpjaFila = esCursoModalidadEpja(cursoActual, infoPlan);

  // Verificar si la asignatura actual coincide con alguna del plan (solo si no es Libre Disposición)
  const esLibreDisposicion = esAsignacionLibreDisposicionJec(a, cursoActual, infoPlan);
  const asigEnPlan = esLibreDisposicion ? undefined : infoPlan.asignaturas.find(p => sonAsignaturasEquivalentes(p.nombre, a.asignatura));

  // Autocorrección reactiva: si la fila pertenecía a un curso EPJA y tenía esTallerJec: true por error previo, limpiarlo
  useEffect(() => {
    if (esCursoEpjaFila && a.esTallerJec && onGuardarAsignacion) {
      const resCod = resolverCodigoYAmbitoAsignatura(a.asignatura, { nivelCurso: cursoActual?.nivel, esJec: false });
      onGuardarAsignacion({
        ...a,
        esTallerJec: false,
        codigoAsignatura: resCod.codigo,
        ambitoCurricular: resCod.ambito
      });
    }
  }, [a.id, esCursoEpjaFila, a.esTallerJec]);

  const esMedio34Fila = esCursoNivelMedio34(cursoActual, infoPlan);

  const matchProfActual = !esLibreDisposicion ? CATALOGO_PROFUNDIZACION_HC_27.find(p => p.nombre.toLowerCase() === a.asignatura.toLowerCase()) : undefined;
  const matchPlanComunActual = !esLibreDisposicion ? CATALOGO_PLAN_COMUN_ELECTIVO_3_4.find(c => a.asignatura.toLowerCase().includes(c.nombre.toLowerCase())) : undefined;

  // Si es un módulo TP oficial o un módulo/especialidad personalizado en EPJA, preservar su valor exacto para que el select no lo colapse a Lengua y Literatura
  const esModuloTpActual = /^(m[oó]dulo|oficio|especialidad)\b/i.test(a.asignatura || '') ||
    (esCursoEpjaFila && Boolean(a.asignatura) && (!asigEnPlan || asigEnPlan.nombre.toLowerCase() !== a.asignatura.toLowerCase()));

  const valorSelectFila = matchBcepActual
    ? matchBcepActual.nucleo
    : esCoDocDto306Nombre
    ? 'Atención Directa y Co-Docencia Parvularia (DTO 306)'
    : esLibreDisposicion
    ? 'LIBRE_DISPOSICION'
    : (
        matchProfActual
          ? matchProfActual.nombre
          : (matchPlanComunActual && a.asignatura.toLowerCase().includes('electivo')
              ? `${matchPlanComunActual.nombre} (Electivo)`
              : (esModuloTpActual ? a.asignatura : (asigEnPlan?.nombre || 'OTRA_MANUAL'))
            )
      );

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      {/* 1. Columna CURSO / NIVEL */}
      <td className="px-3 py-2">
        <select
          value={a.cursoId || 'TRANSVERSAL'}
          onChange={async (e) => {
            const nuevoCursoId = e.target.value;
            if (onGuardarAsignacion) {
              const nuevoCurso = cursos.find(c => c.id === nuevoCursoId);
              let nuevaAsig = a.asignatura;
              if (nuevoCurso) {
                const planNuevo = resolverPlanCurso(nuevoCurso, planesDb);
                const dispNuevo = calcularDisponibilidadCurso(nuevoCurso, planNuevo, asignacionesColegio);
                // Si la asignatura actual no existe en el nuevo curso, sugerir la primera disponible (salvo si es módulo TP en curso TP)
                const esTpActual = /^m[oó]dulo\b/i.test(a.asignatura);
                const esTpDestino = nuevoCurso.nivel.toLowerCase().includes('tp') || Boolean(nuevoCurso.especialidadTp);
                if (!planNuevo.asignaturas.some(p => sonAsignaturasEquivalentes(p.nombre, a.asignatura))) {
                  if (!(esTpActual && esTpDestino) && dispNuevo.disponibles.length > 0) {
                    nuevaAsig = dispNuevo.disponibles[0].nombre;
                  }
                }
              }
              await onGuardarAsignacion({ ...a, cursoId: nuevoCursoId, asignatura: nuevaAsig });
            }
          }}
          className="bg-white hover:bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700 shadow-xs focus:ring-1 focus:ring-orange-500 focus:border-orange-500 max-w-[210px]"
        >
          <option value="TRANSVERSAL">🌟 Taller Transversal (Sin Curso)</option>
          {cursos.map(c => (
            <option key={c.id} value={c.id}>
              {c.nivel} {c.letra} ({c.regimen})
            </option>
          ))}
        </select>
      </td>

      {/* 2. Columna ASIGNATURA / FUNCIÓN (Inteligente según Plan del Curso) */}
      <td className="px-3 py-2">
        {esPie ? (
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
            <input
              type="text"
              defaultValue={a.asignatura}
              onBlur={async (e) => {
                const val = e.target.value.trim();
                if (val && val !== a.asignatura && onGuardarAsignacion) {
                  await onGuardarAsignacion({ ...a, asignatura: val });
                }
              }}
              className="bg-purple-50/50 hover:bg-white focus:bg-white border border-purple-200 focus:border-purple-500 px-2 py-0.5 text-xs font-semibold text-purple-900 rounded outline-none w-full"
              title="Función o apoyo PIE"
            />
          </div>
        ) : esCoDoc ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🤝</span>
            <input
              type="text"
              defaultValue={a.asignatura}
              onBlur={async (e) => {
                const val = e.target.value.trim();
                if (val && val !== a.asignatura && onGuardarAsignacion) {
                  await onGuardarAsignacion({ ...a, asignatura: val });
                }
              }}
              className="bg-indigo-50/50 hover:bg-white focus:bg-white border border-indigo-200 focus:border-indigo-500 px-2 py-0.5 text-xs font-semibold text-indigo-900 rounded outline-none w-full"
              title="Asignatura o Refuerzo en Co-Docencia"
            />
          </div>
        ) : cursoActual ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <select
                value={valorSelectFila}
                onChange={async (e) => {
                  const sel = e.target.value;
                  const matchProf = CATALOGO_PROFUNDIZACION_HC_27.find(p => p.nombre.toLowerCase() === sel.toLowerCase());
                  const matchComunElec = CATALOGO_PLAN_COMUN_ELECTIVO_3_4.find(c => sel.toLowerCase().includes(c.nombre.toLowerCase()));

                  if (sel === 'LIBRE_DISPOSICION') {
                    setEditandoManual(true);
                    if (onGuardarAsignacion) {
                      const nuevoNom = /taller/i.test(a.asignatura) ? a.asignatura : 'Taller JEC / Libre Disposición';
                      const resCod = resolverCodigoYAmbitoAsignatura(nuevoNom, {
                        nivelCurso: cursoActual?.nivel,
                        esJec: true,
                        ambitoExplicito: 'LIBRE_DISPOSICION_JEC'
                      });
                      await onGuardarAsignacion({ 
                        ...a, 
                        asignatura: nuevoNom,
                        codigoAsignatura: resCod.codigo,
                        ambitoCurricular: 'LIBRE_DISPOSICION_JEC',
                        esTallerJec: true 
                      });
                    }
                  } else if (sel === 'OTRA_MANUAL') {
                    setEditandoManual(true);
                  } else if (matchProf) {
                    setEditandoManual(false);
                    if (onGuardarAsignacion) {
                      const resCod = resolverCodigoYAmbitoAsignatura(sel, { nivelCurso: cursoActual?.nivel });
                      await onGuardarAsignacion({ 
                        ...a, 
                        asignatura: sel, 
                        codigoAsignatura: resCod.codigo,
                        ambitoCurricular: resCod.ambito,
                        horasPedagogicasAula: a.horasPedagogicasAula === 6 ? a.horasPedagogicasAula : 6, 
                        esTallerJec: false 
                      });
                    }
                  } else if (matchComunElec) {
                    setEditandoManual(false);
                    if (onGuardarAsignacion) {
                      const resCod = resolverCodigoYAmbitoAsignatura(sel, { nivelCurso: cursoActual?.nivel });
                      await onGuardarAsignacion({ 
                        ...a, 
                        asignatura: sel, 
                        codigoAsignatura: resCod.codigo,
                        ambitoCurricular: resCod.ambito,
                        horasPedagogicasAula: a.horasPedagogicasAula === 2 ? a.horasPedagogicasAula : 2, 
                        esTallerJec: false 
                      });
                    }
                  } else {
                    setEditandoManual(false);
                    if (onGuardarAsignacion) {
                      const resCod = resolverCodigoYAmbitoAsignatura(sel, { nivelCurso: cursoActual?.nivel });
                      await onGuardarAsignacion({ 
                        ...a, 
                        asignatura: sel, 
                        codigoAsignatura: resCod.codigo,
                        ambitoCurricular: resCod.ambito,
                        esTallerJec: false 
                      });
                    }
                  }
                }}
                className="bg-white hover:bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 shadow-xs focus:ring-1 focus:ring-orange-500 focus:border-orange-500 w-full"
              >
                {esParvulariaFila && (
                  <optgroup label="👶 Núcleos BCEP Educación Parvularia (Horas 60 min)">
                    {CATALOGO_BCEP_PARVULARIA.map(b => (
                      <option key={b.id} value={b.nucleo}>
                        👶 {b.nucleo} ({cursoActual?.regimen === 'JEC' ? b.horasJecCronologicas : b.horasMediaJornadaCronologicas} h 60m)
                      </option>
                    ))}
                    <option value="Atención Directa y Co-Docencia Parvularia (DTO 306)">
                      👶 Atención Directa y Co-Docencia Parvularia (DTO 306)
                    </option>
                  </optgroup>
                )}

                {/* Si la fila tiene un módulo TP o asignatura específica asignada que no está literalmente en disponibles ni cubiertas, incluirlo para que el select lo muestre fielmente y NUNCA salte a Lengua y Literatura */}
                {(esModuloTpActual || (a.asignatura && valorSelectFila === a.asignatura)) && !disponibilidad.disponibles.some(d => d.nombre === a.asignatura) && !disponibilidad.cubiertas.some(d => d.nombre === a.asignatura) && (
                  <optgroup label={esCursoEpjaFila ? '🛠️ Módulo / Especialidad EPJA Asignado' : '🛠️ Módulo de Especialidad TP Asignado'}>
                    <option value={a.asignatura}>
                      🛠️ {a.asignatura}
                    </option>
                  </optgroup>
                )}

                <optgroup label="🟢 Asignaturas Disponibles del Plan de Estudio">
                  {disponibilidad.disponibles.map(d => (
                    <option key={d.nombre} value={d.nombre}>
                      {d.nombre} ({d.horasDisponibles} {esParvulariaFila ? 'h (60m)' : 'HA'} faltan / {d.horasPlan} {esParvulariaFila ? 'h' : 'HA'} plan)
                    </option>
                  ))}
                  {disponibilidad.disponibles.length === 0 && (
                    <option value="" disabled>(Todas las obligatorias están cubiertas)</option>
                  )}
                </optgroup>

                {esMedio34Fila && (
                  <>
                    <optgroup label="✨ Plan Común Electivo (3° y 4° Medio - 2 HA)">
                      {CATALOGO_PLAN_COMUN_ELECTIVO_3_4.map(elec => (
                        <option key={elec.id} value={`${elec.nombre} (Electivo)`}>
                          ✨ {elec.nombre} (Electivo - 2 HA)
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="🎓 Formación Diferenciada HC - Área A: Lengua, Filosofía, Cs. Sociales (6 HA)">
                      {CATALOGO_PROFUNDIZACION_HC_27.filter(p => p.area === 'A').map(p => (
                        <option key={p.id} value={p.nombre}>
                          📘 {p.nombre} ({p.disciplina} - 6 HA)
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="🎓 Formación Diferenciada HC - Área B: Matemática y Ciencias (6 HA)">
                      {CATALOGO_PROFUNDIZACION_HC_27.filter(p => p.area === 'B').map(p => (
                        <option key={p.id} value={p.nombre}>
                          🔬 {p.nombre} ({p.disciplina} - 6 HA)
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="🎓 Formación Diferenciada HC - Área C: Artes y Ed. Física (6 HA)">
                      {CATALOGO_PROFUNDIZACION_HC_27.filter(p => p.area === 'C').map(p => (
                        <option key={p.id} value={p.nombre}>
                          🎨 {p.nombre} ({p.disciplina} - 6 HA)
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}

                {(infoPlan.esJec || disponibilidad.horasLibrePlan > 0) && !esCursoEpjaFila && !esParvulariaFila && (
                  <optgroup label="⚡ Libre Disposición / JEC (Nombre Flexible)">
                    <option value="LIBRE_DISPOSICION">
                      ⚡ Taller JEC / Libre Disposición ({disponibilidad.horasLibreDisponibles} HA libres)
                    </option>
                  </optgroup>
                )}

                {disponibilidad.cubiertas.length > 0 && (
                  <optgroup label="⚪ Asignaturas Ya Cubiertas en este Curso">
                    {disponibilidad.cubiertas.map(d => (
                      <option key={d.nombre} value={d.nombre}>
                        {d.nombre} (Cubierta: {d.horasAsignadas}/{d.horasPlan} {esParvulariaFila ? 'h (60m)' : 'HA'}{d.horasCompensadasLibreDisposicion ? ` [+${d.horasCompensadasLibreDisposicion}h JEC]` : ''})
                      </option>
                    ))}
                  </optgroup>
                )}

                <optgroup label="✏️ Personalizada / Otra Asignatura">
                  <option value="OTRA_MANUAL">✏️ Otra Asignatura no listada en el Plan...</option>
                </optgroup>
              </select>

              {/* Botón rápido para alternar edición de texto manual */}
              <button
                type="button"
                onClick={() => setEditandoManual(!editandoManual)}
                className={`p-1 rounded text-[10px] shrink-0 border ${
                  editandoManual 
                    ? 'bg-orange-100 text-orange-700 border-orange-300' 
                    : 'text-slate-400 hover:text-slate-600 border-transparent hover:border-slate-200'
                }`}
                title="Editar nombre libremente"
              >
                ✏️
              </button>
            </div>

            {/* Input adicional si es Libre Disposición o se activa edición manual */}
            {(editandoManual || esLibreDisposicion) && (
              <div className="flex items-center gap-1 mt-1 pl-1">
                <span className="text-[10px] font-semibold text-amber-700 shrink-0">Nombre:</span>
                <input
                  type="text"
                  value={nombreManual}
                  onChange={(e) => setNombreManual(e.target.value)}
                  onBlur={async () => {
                    const val = nombreManual.trim();
                    if (val && val !== a.asignatura && onGuardarAsignacion) {
                      const mantenerLibre = !esCursoEpjaFila && (esLibreDisposicion || esTextoTallerOLibreDisposicion(val));
                      const resCod = resolverCodigoYAmbitoAsignatura(val, {
                        nivelCurso: cursoActual?.nivel,
                        esJec: mantenerLibre,
                        esTallerSep: a.esTallerSep,
                        ambitoExplicito: mantenerLibre ? 'LIBRE_DISPOSICION_JEC' : undefined
                      });
                      const nuevoEsJec = !esCursoEpjaFila && (infoPlan.esJec || disponibilidad.horasLibrePlan > 0) && (
                        resCod.ambito === 'LIBRE_DISPOSICION_JEC' || mantenerLibre
                      );
                      await onGuardarAsignacion({
                        ...a,
                        asignatura: val,
                        codigoAsignatura: resCod.codigo,
                        ambitoCurricular: nuevoEsJec ? 'LIBRE_DISPOSICION_JEC' : resCod.ambito,
                        esTallerJec: nuevoEsJec
                      });
                      setEditandoManual(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  placeholder={esCursoEpjaFila ? 'Ej: Módulo Instalaciones Eléctricas, Contabilidad, Mecánica...' : 'Ej: Taller de Robótica, Inglés Comunicativo, etc.'}
                  className="bg-amber-50 hover:bg-white focus:bg-white border border-amber-300 focus:border-amber-500 px-1.5 py-0.5 text-xs text-amber-900 font-medium rounded outline-none w-full"
                />
              </div>
            )}
            {/* Badge visual para división específica de Ciencias (Biología / Física / Química) */}
            {asigEnPlan?.nombre === 'Ciencias Naturales' && a.asignatura !== 'Ciencias Naturales' && !editandoManual && (
              <div className="mt-1 flex items-center gap-1">
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1 border border-emerald-200">
                  🔬 Subsector específico: {a.asignatura} (Plan Ciencias: {asigEnPlan.horas} HA)
                </span>
              </div>
            )}

            {/* Badge visual si es formación diferenciada compartida */}
            {a.cursosCompartidosIds && a.cursosCompartidosIds.length > 0 && (
              <div className="mt-1 flex items-center gap-1">
                <span 
                  className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-bold rounded-md flex items-center gap-1 border border-blue-200"
                  title={`Asignatura compartida en paralelo con: ${cursos.filter(c => a.cursosCompartidosIds?.includes(c.id)).map(c => `${c.nivel} ${c.letra}`).join(', ')}`}
                >
                  <span>🤝 Compartida con:</span>
                  <span className="font-extrabold text-blue-900">
                    {cursos.filter(c => a.cursosCompartidosIds?.includes(c.id)).map(c => `${c.nivel} ${c.letra}`).join(', ') || 'Otros Cursos'}
                  </span>
                </span>
              </div>
            )}
          </div>
        ) : (
          <input
            type="text"
            value={asigTransversal}
            onChange={(e) => setAsigTransversal(e.target.value)}
            onBlur={async () => {
              const val = asigTransversal.trim();
              if (val && val !== a.asignatura && onGuardarAsignacion) {
                await onGuardarAsignacion({ ...a, asignatura: val });
              }
            }}
            placeholder="Nombre de asignatura o taller transversal..."
            className="bg-transparent hover:bg-slate-100 focus:bg-white border-b border-transparent focus:border-orange-500 px-1 py-0.5 text-xs font-semibold text-slate-800 rounded outline-none w-full"
          />
        )}
      </td>

      {/* 3. Columna HORAS ASIGNADAS */}
      <td className="px-3 py-2 text-center font-bold text-slate-800">
        <div className="flex flex-col items-center justify-center gap-0.5">
          <div className="inline-flex items-center justify-center gap-1">
            <input
              type="number"
              value={localHoras}
              min={0.5}
              max={44}
              step={esParvulariaFila ? '0.1' : '0.5'}
              onChange={(e) => setLocalHoras(e.target.value === '' ? '' : Number(e.target.value))}
              onBlur={async () => {
                const h = Number(localHoras);
                if (h > 0 && onGuardarAsignacion) {
                  if (esApoyoAulaCurso) {
                    if (h !== a.horasPedagogicasAula || a.esProporcionDocente !== true) {
                      await onGuardarAsignacion({ 
                        ...a, 
                        horasPedagogicasAula: h,
                        horasCronologicasPie: esPie ? Math.round(h * 0.75 * 10) / 10 : undefined,
                        esProporcionDocente: true
                      });
                    }
                  } else {
                    if (h !== a.horasCronologicasPie || a.esProporcionDocente !== false) {
                      await onGuardarAsignacion({ 
                        ...a, 
                        horasCronologicasPie: h, 
                        horasPedagogicasAula: Math.round(h * 1.333),
                        esProporcionDocente: false 
                      });
                    }
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              className="w-16 text-center font-black bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-orange-500 outline-none"
            />
            {esParvulariaFila ? (
              <span 
                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300"
                title="En Educación Parvularia (DTO 306/2007) las horas lectivas frente a niños corresponden a 60 minutos cronológicos."
              >
                h (60m)
              </span>
            ) : esApoyoAulaCurso ? (
              <span 
                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300"
                title="Horas Pedagógicas (45 min) lectivas frente a curso, sujetas a Proporción Docente Ley 20.903."
              >
                HA (45m)
              </span>
            ) : (
              <span 
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300"
                title="Horas Cronológicas (60 min) fuera de curso o exentas de proporción."
              >
                hrs cron
              </span>
            )}
          </div>
          {esParvulariaFila ? (
            <span className="text-[9px] text-teal-700 font-bold flex items-center gap-0.5" title="Docencia directa y permanencia DTO 306/2007 (60 min/hora)">
              👶 DTO 306 (60m)
            </span>
          ) : esApoyoAulaCurso && (
            <span className="text-[9px] text-purple-700 font-bold flex items-center gap-0.5" title={`Horas lectivas frente a curso computadas con Proporción Docente Ley 20.903 (${cursoActual?.regimenProporcion === '60_40' ? '60/40' : '65/35'})`}>
              ⚖️ Aula {cursoActual?.regimenProporcion === '60_40' ? '60/40' : '65/35'}
            </span>
          )}
        </div>
      </td>

      {/* 4. Columna TIPO / MODALIDAD */}
      <td className="px-3 py-2 text-center">
        {esCoDocParv ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300 inline-flex items-center gap-1 shadow-2xs">
            <span>👶</span>
            <span>2da Educadora DTO 306</span>
          </span>
        ) : esParvulariaFila && !esPie && !esCoDoc ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 inline-flex items-center gap-1">
            <span>🎓</span>
            <span>Ed. Parvularia</span>
          </span>
        ) : esPie ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-purple-600" />
            <span>{a.tipoApoyo || a.asignatura || 'Apoyo PIE Dec. 170'}</span>
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
        ) : esLibreDisposicion ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
            ⚡ Libre Disposición JEC
          </span>
        ) : a.esTallerSep ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            🌱 SEP Extracurricular
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            📚 Plan Regular
          </span>
        )}
      </td>

      {/* 5. Columna ACCIONES */}
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={async () => {
            if (confirm(`¿Eliminar la asignación de ${a.asignatura}?`)) {
              if (onEliminarAsignacion) await onEliminarAsignacion(a.id);
            }
          }}
          className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
          title="Eliminar asignación"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
});

interface FormRegularProps {
  docente: Docente;
  colegio: Establecimiento;
  cursos: CursoSae[];
  planesDb: PlanEstudioCurricular[];
  asignacionesColegio: AsignacionHoraria[];
  periodoActivo: number;
  initialCursoId?: string;
  initialAmbito?: AmbitoFormRegular;
  onGuardar: (asig: AsignacionHoraria) => Promise<void> | void;
  onCerrar: () => void;
}

const FormAsignarRegular: React.FC<FormRegularProps> = React.memo(({
  docente,
  colegio,
  cursos,
  planesDb,
  asignacionesColegio,
  periodoActivo,
  initialCursoId,
  initialAmbito,
  onGuardar,
  onCerrar
}) => {
  const [regCursoId, setRegCursoId] = useState(initialCursoId || cursos[0]?.id || 'TRANSVERSAL');
  const [ambitoActivo, setAmbitoActivo] = useState<AmbitoFormRegular>(initialAmbito || 'PLAN_COMUN');
  const [tipoAsignaturaSeleccionada, setTipoAsignaturaSeleccionada] = useState<string>('');
  const [regNombreCustom, setRegNombreCustom] = useState('');
  const [regHoras, setRegHoras] = useState(4);
  const [regEsTallerSep, setRegEsTallerSep] = useState(false);
  const [regCompartir, setRegCompartir] = useState(false);
  const [regCursosCompartidos, setRegCursosCompartidos] = useState<string[]>([]);

  useEffect(() => {
    if (initialCursoId) setRegCursoId(initialCursoId);
    if (initialAmbito) setAmbitoActivo(initialAmbito);
  }, [initialCursoId, initialAmbito]);

  // Obtener plan resuelto del curso seleccionado
  const cursoSeleccionado = useMemo(() => {
    return cursos.find(c => c.id === regCursoId) || null;
  }, [cursos, regCursoId]);

  const infoPlan = useMemo(() => {
    return resolverPlanCurso(cursoSeleccionado, planesDb);
  }, [cursoSeleccionado, planesDb]);

  // Materias preferentes del docente
  const materiasPreferentes = useMemo(() => {
    return obtenerMateriasPreferentesDocente(docente.id, asignacionesColegio);
  }, [docente.id, asignacionesColegio]);

  // Disponibilidad de asignaturas en el curso seleccionado
  const datosDisp = useMemo(() => {
    return calcularDisponibilidadCurso(cursoSeleccionado, infoPlan, asignacionesColegio);
  }, [cursoSeleccionado, infoPlan, asignacionesColegio]);

  const saldoDocente = useMemo(() => {
    return calcularSaldoDocentePorFuente(docente, asignacionesColegio, colegio.porcentajePrioritarios || 0);
  }, [docente, asignacionesColegio, colegio.porcentajePrioritarios]);

  const esCursoEpjaForm = useMemo(() => esCursoModalidadEpja(cursoSeleccionado, infoPlan), [cursoSeleccionado, infoPlan]);
  const esMedio34Form = useMemo(() => esCursoNivelMedio34(cursoSeleccionado, infoPlan), [cursoSeleccionado, infoPlan]);
  const esParvularioForm = useMemo(() => Boolean(cursoSeleccionado && esNivelParvulario(cursoSeleccionado.nivel)), [cursoSeleccionado]);
  const esCursoTpForm = useMemo(() => esCursoModalidadTp(cursoSeleccionado, infoPlan, colegio), [cursoSeleccionado, infoPlan, colegio]);
  const puedeLibreDisposicion = !esCursoEpjaForm && !esParvularioForm && (infoPlan.esJec || datosDisp.horasLibrePlan > 0);

  // Info de la asignatura actualmente seleccionada (solo si pertenece al plan)
  const infoAsigSeleccionada = useMemo(() => {
    if (ambitoActivo === 'LIBRE_DISPOSICION' || ambitoActivo === 'OTRO') return null;
    return datosDisp.todas.find(a => a.nombre.toLowerCase() === tipoAsignaturaSeleccionada.toLowerCase()) || null;
  }, [datosDisp.todas, tipoAsignaturaSeleccionada, ambitoActivo]);

  // Al cambiar de curso, actualizar disponibilidad y preselección según el ámbito
  useEffect(() => {
    if (regCursoId === 'TRANSVERSAL') {
      setAmbitoActivo('OTRO');
      setTipoAsignaturaSeleccionada('__TRANSVERSAL__');
      setRegNombreCustom('Taller Institucional Transversal');
      setRegHoras(2);
      setRegCompartir(false);
      setRegCursosCompartidos([]);
      return;
    }

    if (ambitoActivo === 'LIBRE_DISPOSICION' && puedeLibreDisposicion) {
      setTipoAsignaturaSeleccionada('__LIBRE_DISPOSICION__');
      setRegHoras(datosDisp.horasLibreDisponibles >= 2 ? 2 : (datosDisp.horasLibreDisponibles > 0 ? datosDisp.horasLibreDisponibles : 2));
      return;
    }

    if (ambitoActivo === 'DIFERENCIADA_HC_ELEC' && esMedio34Form) {
      if (esCursoTpForm) {
        const primerElec = `${CATALOGO_PLAN_COMUN_ELECTIVO_3_4[0].nombre} (Electivo)`;
        setTipoAsignaturaSeleccionada(primerElec);
        setRegHoras(2);
      } else {
        setTipoAsignaturaSeleccionada(CATALOGO_PROFUNDIZACION_HC_27[0].nombre);
        setRegHoras(6);
      }
      return;
    }

    // Si estaba en ámbito no disponible para este curso, volver a PLAN_COMUN
    if ((ambitoActivo === 'LIBRE_DISPOSICION' && !puedeLibreDisposicion) || (ambitoActivo === 'DIFERENCIADA_HC_ELEC' && !esMedio34Form)) {
      setAmbitoActivo('PLAN_COMUN');
    }

    // 1. Prioridad: ¿El docente dicta una materia habitual disponible en este curso?
    const materiaAfinDisponible = datosDisp.disponibles.find(d =>
      materiasPreferentes.some(pref => pref.toLowerCase() === d.nombre.toLowerCase())
    );
    if (materiaAfinDisponible) {
      setTipoAsignaturaSeleccionada(materiaAfinDisponible.nombre);
      setRegNombreCustom('');
      setRegHoras(materiaAfinDisponible.horasDisponibles);
      return;
    }

    // 2. Primera asignatura disponible del plan
    if (datosDisp.disponibles.length > 0) {
      setTipoAsignaturaSeleccionada(datosDisp.disponibles[0].nombre);
      setRegNombreCustom('');
      setRegHoras(datosDisp.disponibles[0].horasDisponibles);
      return;
    }

    // 3. Si el plan obligatorio está 100% cubierto y queda Libre Disposición JEC
    if (puedeLibreDisposicion && datosDisp.horasLibreDisponibles > 0) {
      setAmbitoActivo('LIBRE_DISPOSICION');
      setTipoAsignaturaSeleccionada('__LIBRE_DISPOSICION__');
      setRegNombreCustom('');
      setRegHoras(Math.min(datosDisp.horasLibreDisponibles, 2));
      return;
    }

    if (infoPlan.asignaturas.length > 0) {
      setTipoAsignaturaSeleccionada(infoPlan.asignaturas[0].nombre);
      setRegNombreCustom('');
      setRegHoras(infoPlan.asignaturas[0].horas || 2);
    } else {
      setAmbitoActivo('OTRO');
      setTipoAsignaturaSeleccionada('__OTRO_PERSONALIZADO__');
      setRegNombreCustom('');
      setRegHoras(2);
    }
  }, [regCursoId]);

  const handleCambioAmbito = (nuevoAmbito: AmbitoFormRegular) => {
    setAmbitoActivo(nuevoAmbito);
    setRegCompartir(false);
    setRegCursosCompartidos([]);

    if (nuevoAmbito === 'LIBRE_DISPOSICION') {
      setTipoAsignaturaSeleccionada('__LIBRE_DISPOSICION__');
      setRegNombreCustom('');
      setRegHoras(datosDisp.horasLibreDisponibles >= 2 ? 2 : (datosDisp.horasLibreDisponibles > 0 ? datosDisp.horasLibreDisponibles : 2));
    } else if (nuevoAmbito === 'DIFERENCIADA_HC_ELEC') {
      setRegNombreCustom('');
      if (esCursoTpForm) {
        setTipoAsignaturaSeleccionada(`${CATALOGO_PLAN_COMUN_ELECTIVO_3_4[0].nombre} (Electivo)`);
        setRegHoras(2);
      } else {
        setTipoAsignaturaSeleccionada(CATALOGO_PROFUNDIZACION_HC_27[0].nombre);
        setRegHoras(6);
      }
    } else if (nuevoAmbito === 'OTRO') {
      setTipoAsignaturaSeleccionada('__OTRO_PERSONALIZADO__');
      setRegNombreCustom('');
      setRegHoras(2);
    } else {
      setRegNombreCustom('');
      const disp0 = datosDisp.disponibles[0] || datosDisp.todas[0];
      if (disp0) {
        setTipoAsignaturaSeleccionada(disp0.nombre);
        setRegHoras(disp0.horasDisponibles > 0 ? disp0.horasDisponibles : disp0.horasPlan);
      }
    }
  };

  const esSeleccionDiferenciadaEpja = useMemo(() => {
    if (!esCursoEpjaForm) return false;
    const t = tipoAsignaturaSeleccionada.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return t.includes('formacion diferenciada') && (t.includes('especializacion') || t.includes('oficio') || t.includes('tp') || t.includes('especialidad'));
  }, [esCursoEpjaForm, tipoAsignaturaSeleccionada]);

  const handleSeleccionAsignatura = (valor: string) => {
    setTipoAsignaturaSeleccionada(valor);

    const matchProf = CATALOGO_PROFUNDIZACION_HC_27.find(p => p.nombre.toLowerCase() === valor.toLowerCase());
    const matchComunElec = CATALOGO_PLAN_COMUN_ELECTIVO_3_4.find(c => valor.toLowerCase().includes(c.nombre.toLowerCase()));
    const matchBcep = CATALOGO_BCEP_PARVULARIA.find(b => b.nucleo.toLowerCase() === valor.toLowerCase());

    if (matchBcep) {
      setRegNombreCustom('');
      const hrsBcep = infoPlan.esJec ? matchBcep.horasJecCronologicas : matchBcep.horasMediaJornadaCronologicas;
      setRegHoras(hrsBcep);
    } else if (matchProf) {
      setRegNombreCustom('');
      setRegHoras(6);
    } else if (matchComunElec) {
      setRegNombreCustom('');
      setRegHoras(2);
    } else {
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
    let ambitoExplicito: 'LIBRE_DISPOSICION_JEC' | 'PLAN_COMUN' | 'DIFERENCIADA_HC' | 'PLAN_COMUN_ELECTIVO' | 'ADICIONAL_EXTRA' | undefined;
    let esJec = false;

    if (regCursoId === 'TRANSVERSAL') {
      nombreFinal = regNombreCustom.trim() || 'Taller Institucional Transversal';
      ambitoExplicito = 'ADICIONAL_EXTRA';
      esJec = false;
    } else if (ambitoActivo === 'LIBRE_DISPOSICION') {
      nombreFinal = regNombreCustom.trim();
      if (!nombreFinal) {
        alert('Escribe o selecciona el nombre del Taller / Libre Disposición (ej: Talleres de Educación Física y Deporte).');
        return;
      }
      esJec = !esCursoEpjaForm && (infoPlan.esJec || datosDisp.horasLibrePlan > 0);
      ambitoExplicito = esJec ? 'LIBRE_DISPOSICION_JEC' : undefined;
    } else if (ambitoActivo === 'OTRO' || esSeleccionDiferenciadaEpja) {
      nombreFinal = regNombreCustom.trim() || tipoAsignaturaSeleccionada.trim();
      esJec = false;
    } else if (ambitoActivo === 'DIFERENCIADA_HC_ELEC') {
      nombreFinal = tipoAsignaturaSeleccionada.trim();
      esJec = false;
    } else {
      // PLAN_COMUN
      nombreFinal = tipoAsignaturaSeleccionada.trim();
      esJec = false;
    }

    if (!nombreFinal) {
      alert('Por favor especifica el nombre de la asignatura, módulo o taller.');
      return;
    }

    const resCod = resolverCodigoYAmbitoAsignatura(nombreFinal, {
      nivelCurso: cursoSeleccionado?.nivel,
      esJec,
      esTallerSep: regEsTallerSep,
      esDiferenciadoCompartido: regCompartir && regCursosCompartidos.length > 0,
      ambitoExplicito: regEsTallerSep ? 'ADICIONAL_EXTRA' : ambitoExplicito
    });

    const esLibreFinal = !esCursoEpjaForm && regCursoId !== 'TRANSVERSAL' && !regEsTallerSep && (
      ambitoActivo === 'LIBRE_DISPOSICION' ||
      resCod.ambito === 'LIBRE_DISPOSICION_JEC'
    );

    const newAsig: AsignacionHoraria = {
      id: `asig-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      cursoId: regCursoId,
      docenteId: docente.id,
      asignatura: nombreFinal,
      codigoAsignatura: resCod.codigo,
      ambitoCurricular: esLibreFinal ? 'LIBRE_DISPOSICION_JEC' : resCod.ambito,
      horasPedagogicasAula: Number(regHoras),
      esTallerJec: esLibreFinal,
      esTallerSep: regEsTallerSep,
      esProporcionDocente: regCursoId !== 'TRANSVERSAL',
      cursosCompartidosIds: regCompartir && regCursosCompartidos.length > 0 ? regCursosCompartidos : undefined,
      esDiferenciadoCompartido: regCompartir && regCursosCompartidos.length > 0
    };

    await onGuardar(newAsig);
    onCerrar();
  };

  return (
    <form onSubmit={handleSubmit} className="p-3.5 bg-white border border-orange-200 rounded-xl shadow-xs transition-all space-y-3">
      {/* Selector de Curso + Ámbito Curricular en 2 pasos inequívocos */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2.5 pb-2 border-b border-slate-100 text-xs">
        <div className="min-w-[210px] flex-1">
          <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-orange-600" />
            <span>1. Curso / Nivel ({infoPlan.nombrePlan})</span>
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

        {/* Selector Explícito de Ámbito Curricular */}
        {regCursoId !== 'TRANSVERSAL' && (
          <div className="flex-1">
            <span className="block text-[10px] font-bold text-slate-700 mb-1">
              2. Tipo / Ámbito de la Asignación
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleCambioAmbito('PLAN_COMUN')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                  ambitoActivo === 'PLAN_COMUN'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                }`}
              >
                <span>📚 Plan Obligatorio</span>
                {datosDisp.disponibles.length > 0 && (
                  <span className={`px-1 rounded text-[9px] font-black ${
                    ambitoActivo === 'PLAN_COMUN' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {datosDisp.disponibles.length}
                  </span>
                )}
              </button>

              {esMedio34Form && (
                <button
                  type="button"
                  onClick={() => handleCambioAmbito('DIFERENCIADA_HC_ELEC')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                    ambitoActivo === 'DIFERENCIADA_HC_ELEC'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50'
                  }`}
                >
                  <span>🎓 {esCursoTpForm ? 'Electivo Común 3°-4°' : 'Diferenciada HC & Electivos'}</span>
                </button>
              )}

              {puedeLibreDisposicion && (
                <button
                  type="button"
                  onClick={() => handleCambioAmbito('LIBRE_DISPOSICION')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                    ambitoActivo === 'LIBRE_DISPOSICION'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <span>⚡ Libre Disposición JEC</span>
                  <span className={`px-1 rounded text-[9px] font-black ${
                    ambitoActivo === 'LIBRE_DISPOSICION' ? 'bg-white/25 text-white' : 'bg-amber-200 text-amber-950'
                  }`}>
                    {datosDisp.horasLibreDisponibles} HA
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleCambioAmbito('OTRO')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  ambitoActivo === 'OTRO'
                    ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>✏️ Otra / Personalizada</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fila de Inputs según el Ámbito Elegido */}
      <div className="flex flex-wrap items-end gap-2.5 text-xs">
        {/* ÁMBITO 1: PLAN OBLIGATORIO */}
        {regCursoId !== 'TRANSVERSAL' && ambitoActivo === 'PLAN_COMUN' && (
          <div className="min-w-[250px] flex-1">
            <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>3. Asignatura del Plan de Estudio</span>
            </label>
            <select
              value={tipoAsignaturaSeleccionada}
              onChange={(e) => handleSeleccionAsignatura(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {datosDisp.disponibles.length > 0 && (
                <optgroup label={`🟢 Con Horas Pendientes (${datosDisp.disponibles.length})`}>
                  {datosDisp.disponibles.map((asig, idx) => (
                    <option key={`disp-${idx}`} value={asig.nombre}>
                      🟢 {asig.nombre} — {asig.horasDisponibles} {esParvularioForm ? 'h (60m)' : 'HA'} disponibles (Plan: {asig.horasPlan})
                    </option>
                  ))}
                </optgroup>
              )}

              {esParvularioForm && (
                <optgroup label="👶 Núcleos BCEP Educación Parvularia (60 min)">
                  {CATALOGO_BCEP_PARVULARIA.map(b => (
                    <option key={b.id} value={b.nucleo}>
                      👶 {b.nucleo} ({infoPlan.esJec ? b.horasJecCronologicas : b.horasMediaJornadaCronologicas}h cron.)
                    </option>
                  ))}
                </optgroup>
              )}

              {esCursoTpForm && (
                <optgroup label="🛠️ Módulos de Especialidad Técnico-Profesional">
                  {infoPlan.asignaturas
                    .filter(a => /^m[oó]dulo\b/i.test(a.nombre))
                    .map((mod, idx) => (
                      <option key={`tp-mod-${idx}`} value={mod.nombre}>
                        🛠️ {mod.nombre} ({mod.horas} HA)
                      </option>
                    ))}
                  {!infoPlan.asignaturas.some(a => /^m[oó]dulo\b/i.test(a.nombre)) && (
                    PLANES_MINEDUC
                      .filter((p: PlanEstudioNivel) => p.categoria === 'MEDIA_TP' && p.asignaturasBase.some(a => /^m[oó]dulo\b/i.test(a.nombre)))
                      .flatMap((p: PlanEstudioNivel) => p.asignaturasBase.filter(a => /^m[oó]dulo\b/i.test(a.nombre)))
                      .filter((val, idx, self) => self.findIndex(v => v.nombre === val.nombre) === idx)
                      .slice(0, 25)
                      .map((mod, idx) => (
                        <option key={`tp-cat-${idx}`} value={mod.nombre}>
                          🛠️ {mod.nombre} ({mod.horasSugeridas} HA)
                        </option>
                      ))
                  )}
                </optgroup>
              )}

              {datosDisp.cubiertas.length > 0 && (
                <optgroup label={`⚪ Ya Cubiertas (${datosDisp.cubiertas.length})`}>
                  {datosDisp.cubiertas.map((asig, idx) => (
                    <option key={`cub-${idx}`} value={asig.nombre}>
                      ⚪ {asig.nombre} ({asig.horasAsignadas}/{asig.horasPlan} {esParvularioForm ? 'h' : 'HA'})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {/* Desglose rápido para Ciencias Naturales (Biología / Física / Química) */}
            {tipoAsignaturaSeleccionada === 'Ciencias Naturales' && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                <span className="text-[10px] font-bold text-slate-500">¿Dividir Ciencias en eje específico?:</span>
                {['Biología', 'Física', 'Química'].map(eje => (
                  <button
                    key={eje}
                    type="button"
                    onClick={() => {
                      setTipoAsignaturaSeleccionada(eje);
                      setRegHoras(2);
                    }}
                    className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold"
                  >
                    + {eje} (2 HA)
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ÁMBITO 2: DIFERENCIADA HC & PLAN COMÚN ELECTIVO (3° y 4° Medio) */}
        {regCursoId !== 'TRANSVERSAL' && ambitoActivo === 'DIFERENCIADA_HC_ELEC' && esMedio34Form && (
          <div className="min-w-[250px] flex-1">
            <label className="block text-[10px] font-bold text-indigo-900 mb-1 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
              <span>3. Profundización HC (6 HA) o Plan Común Electivo (2 HA)</span>
            </label>
            <select
              value={tipoAsignaturaSeleccionada}
              onChange={(e) => handleSeleccionAsignatura(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-xs bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <optgroup label="✨ Plan Común Electivo (3° y 4° Medio - 2 HA)">
                {CATALOGO_PLAN_COMUN_ELECTIVO_3_4.map(elec => (
                  <option key={elec.id} value={`${elec.nombre} (Electivo)`}>
                    ✨ {elec.nombre} (Electivo - 2 HA)
                  </option>
                ))}
              </optgroup>
              {!esCursoTpForm && (
                <>
                  <optgroup label="🎓 Área A: Lengua, Filosofía, Cs. Sociales (6 HA)">
                    {CATALOGO_PROFUNDIZACION_HC_27.filter(p => p.area === 'A').map(p => (
                      <option key={p.id} value={p.nombre}>
                        📘 {p.nombre} ({p.disciplina} - 6 HA)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🎓 Área B: Matemática y Ciencias (6 HA)">
                    {CATALOGO_PROFUNDIZACION_HC_27.filter(p => p.area === 'B').map(p => (
                      <option key={p.id} value={p.nombre}>
                        🔬 {p.nombre} ({p.disciplina} - 6 HA)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🎓 Área C: Artes y Ed. Física (6 HA)">
                    {CATALOGO_PROFUNDIZACION_HC_27.filter(p => p.area === 'C').map(p => (
                      <option key={p.id} value={p.nombre}>
                        🎨 {p.nombre} ({p.disciplina} - 6 HA)
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </div>
        )}

        {/* ÁMBITO 3: LIBRE DISPOSICIÓN JEC (Explícito y Protegido) */}
        {regCursoId !== 'TRANSVERSAL' && ambitoActivo === 'LIBRE_DISPOSICION' && (
          <div className="min-w-[260px] flex-1 space-y-1.5">
            <label className="block text-[10px] font-bold text-amber-800 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>3. Nombre del Taller / Libre Disposición JEC</span>
              </span>
              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-1.5 rounded">
                Saldo: {datosDisp.horasLibreDisponibles} / {datosDisp.horasLibrePlan} HA
              </span>
            </label>
            <input
              type="text"
              autoFocus
              value={regNombreCustom}
              onChange={(e) => setRegNombreCustom(e.target.value)}
              placeholder="Ej: Talleres de Educación Física y Deporte, Taller de Robótica..."
              className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs font-bold text-slate-900 bg-amber-50/40 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              required
            />
            <div className="flex flex-wrap gap-1">
              {infoPlan.talleresJecPredefinidos.map((tj, idx) => (
                <button
                  key={`tj-chip-${idx}`}
                  type="button"
                  onClick={() => {
                    setRegNombreCustom(tj.nombre);
                    if (tj.horas) setRegHoras(tj.horas);
                  }}
                  className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-bold"
                >
                  {tj.nombre} {tj.horas ? `(${tj.horas} HA)` : ''}
                </button>
              ))}
              {[
                'Talleres de Educación Física y Deporte',
                'Taller de Reforzamiento Matemática',
                'Taller de Comprensión Lectora',
                'Taller de Inglés Comunicativo',
                'Taller Artístico / Música'
              ].map(sug => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setRegNombreCustom(sug)}
                  className="px-2 py-0.5 rounded bg-white hover:bg-amber-50 text-slate-700 border border-slate-200 text-[10px] font-medium"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ÁMBITO 4: PERSONALIZADA / TRANSVERSAL / EPJA */}
        {(regCursoId === 'TRANSVERSAL' || ambitoActivo === 'OTRO' || esSeleccionDiferenciadaEpja) && (
          <div className="min-w-[230px] flex-1">
            <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {regCursoId === 'TRANSVERSAL'
                  ? 'Nombre del Taller Transversal (Sin Curso)'
                  : esCursoEpjaForm
                  ? 'Nombre del Módulo / Especialidad / Oficio EPJA'
                  : 'Nombre de la Asignatura / Subsector Específico'}
              </span>
            </label>
            <input
              type="text"
              autoFocus={!esSeleccionDiferenciadaEpja}
              value={regNombreCustom}
              onChange={(e) => setRegNombreCustom(e.target.value)}
              placeholder={esCursoEpjaForm ? 'Ej: Módulo Instalaciones Eléctricas, Contabilidad...' : 'Ej: Lengua Indígena, Astronomía, Taller Transversal...'}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-slate-50/70 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              required={!esSeleccionDiferenciadaEpja}
            />
          </div>
        )}

        {/* HORAS PEDAGÓGICAS (Soporta 0.5 HA y 0.1h en Parvularia) */}
        <div className={esParvularioForm ? 'w-28' : 'w-24'}>
          <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{esParvularioForm ? 'Horas (60m)' : 'Horas Aula'}</span>
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step={esParvularioForm ? '0.1' : '0.5'}
              value={regHoras}
              onChange={(e) => setRegHoras(parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-center font-black focus:ring-2 focus:ring-orange-500 focus:outline-none"
              min={0.5}
              max={44}
              required
            />
            <span className="text-[10px] font-bold text-slate-500">{esParvularioForm ? 'hrs' : 'HA'}</span>
          </div>
        </div>

        {/* COMPARTIR EN PARALELO (Decreto 193/2019) */}
        {regCursoId !== 'TRANSVERSAL' && (ambitoActivo === 'DIFERENCIADA_HC_ELEC' || ambitoActivo === 'LIBRE_DISPOSICION' || ambitoActivo === 'OTRO') && (
          <div className="flex items-center pb-1">
            <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold px-2.5 py-1.5 rounded-lg select-none border transition-colors ${
              regCompartir ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}>
              <input
                type="checkbox"
                checked={regCompartir}
                onChange={(e) => {
                  setRegCompartir(e.target.checked);
                  if (!e.target.checked) setRegCursosCompartidos([]);
                }}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>🤝 Compartir paralelo</span>
            </label>
          </div>
        )}

        {/* FINANCIAMIENTO SEP (Solo cuando corresponde a Taller SEP extracurricular o Transversal) */}
        {(regCursoId === 'TRANSVERSAL' || ambitoActivo === 'OTRO' || ambitoActivo === 'LIBRE_DISPOSICION') && (
          <div className="flex items-center pb-1">
            <label
              className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 select-none"
              title="Marca esta opción solo si es un taller extracurricular financiado con SEP (exento de la malla regular y libre disposición JEC)"
            >
              <input
                type="checkbox"
                checked={regEsTallerSep}
                onChange={(e) => setRegEsTallerSep(e.target.checked)}
                className="rounded text-orange-600 focus:ring-orange-500"
              />
              <span>Taller SEP (Exento)</span>
            </label>
          </div>
        )}

        {/* BOTONES */}
        <div className="flex items-center gap-2 pb-0.5 ml-auto">
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Guardar</span>
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Selector de Cursos Paralelos */}
      {regCompartir && regCursoId !== 'TRANSVERSAL' && (
        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-900">🤝 Formación Diferenciada / Electivo Compartido</span>
            <span className="text-[10px] text-blue-700">Cubre ambos cursos pero computa 1 sola vez en el contrato docente</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {cursos.filter(c => c.id !== regCursoId).map(c => {
              const estaMarcado = regCursosCompartidos.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (estaMarcado) setRegCursosCompartidos(prev => prev.filter(id => id !== c.id));
                    else setRegCursosCompartidos(prev => [...prev, c.id]);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                    estaMarcado ? 'bg-blue-600 text-white border-blue-700 shadow-xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-blue-50'
                  }`}
                >
                  <span>{estaMarcado ? '✓' : '+'}</span>
                  <span>{c.nivel} {c.letra}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra Informativa de Cobertura del Curso y Saldo Preventivo por Fuente */}
      <div className="space-y-1.5 pt-0.5">
        {regCursoId !== 'TRANSVERSAL' && infoAsigSeleccionada && (
          infoAsigSeleccionada.estado === 'DISPONIBLE' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                <strong>{infoAsigSeleccionada.nombre}:</strong> Quedan <strong>{infoAsigSeleccionada.horasDisponibles} HA disponibles</strong> en el plan (Plan Oficial: {infoAsigSeleccionada.horasPlan} HA • Cubiertas: {infoAsigSeleccionada.horasAsignadas} HA).
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                <strong>{infoAsigSeleccionada.nombre} (Cubierta):</strong> Ya tiene <strong>{infoAsigSeleccionada.horasAsignadas}/{infoAsigSeleccionada.horasPlan} HA</strong> cubiertas{infoAsigSeleccionada.horasCompensadasLibreDisposicion ? ` (+${infoAsigSeleccionada.horasCompensadasLibreDisposicion}h con cargo a Libre Disposición)` : ''}.
              </span>
            </div>
          )
        )}

        {regCursoId !== 'TRANSVERSAL' && ambitoActivo === 'LIBRE_DISPOSICION' && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] ${
            Number(regHoras) > datosDisp.horasLibreDisponibles
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              <strong>Libre Disposición JEC:</strong> Se registrará explícitamente como Taller/Libre Disposición (<strong>{datosDisp.horasLibreDisponibles} HA disponibles</strong> de {datosDisp.horasLibrePlan} HA en {cursoSeleccionado?.nivel} {cursoSeleccionado?.letra}).
              {Number(regHoras) > datosDisp.horasLibreDisponibles && (
                <strong className="ml-1 text-amber-800">⚠️ Excede el saldo libre del curso en {Math.round((Number(regHoras) - datosDisp.horasLibreDisponibles) * 100) / 100} HA.</strong>
              )}
            </span>
          </div>
        )}

        {/* Alerta Preventiva de Financiamiento del Docente */}
        {((saldoDocente.esDocentePiePuro && ambitoActivo === 'PLAN_COMUN') ||
          (saldoDocente.esDocenteSepPuro && ambitoActivo === 'PLAN_COMUN' && !regEsTallerSep)) && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>
              <strong>Alerta de Financiamiento:</strong> Este docente es 100% <strong>{saldoDocente.esDocentePiePuro ? 'PIE' : 'SEP'}</strong> (Subv. General: 0h). Asignarle Malla Obligatoria del Plan Común generará descuadre normativo; utiliza el botón <strong>Co-Docencia / SEP</strong> o <strong>Apoyo PIE</strong>.
            </span>
          </div>
        )}
      </div>
    </form>
  );
});

interface FormCoDocenciaProps {
  docente: Docente;
  colegio: Establecimiento;
  cursos: CursoSae[];
  planesDb: PlanEstudioCurricular[];
  periodoActivo: number;
  onGuardar: (asig: AsignacionHoraria) => Promise<void> | void;
  onCerrar: () => void;
}

const FormAsignarCoDocencia: React.FC<FormCoDocenciaProps> = React.memo(({
  docente,
  colegio,
  cursos,
  planesDb,
  periodoActivo,
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
    if (cursoSeleccionado && esNivelParvulario(cursoSeleccionado.nivel)) {
      setTipoAsignaturaSeleccionada('__PERSONALIZADA__');
      setCoDocNombreCustom('Atención Directa y Co-Docencia Parvularia (DTO 306)');
      setCoDocTipo('CO_DOCENCIA');
    } else if (infoPlan.asignaturas.length > 0) {
      setTipoAsignaturaSeleccionada(infoPlan.asignaturas[0].nombre);
      setCoDocNombreCustom('');
    } else {
      setTipoAsignaturaSeleccionada('__PERSONALIZADA__');
      setCoDocNombreCustom('Apoyo Pedagógico en Aula');
    }
  }, [coDocCursoId, infoPlan, cursoSeleccionado]);

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

    const esParv = Boolean(cursoSeleccionado && esNivelParvulario(cursoSeleccionado.nivel));

    const newAsig: AsignacionHoraria = {
      id: `asig-codoc-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      cursoId: coDocCursoId,
      docenteId: docente.id,
      asignatura: nombreFinal,
      horasPedagogicasAula: Number(coDocHoras),
      esCoDocencia: true,
      esCoDocenciaParvularia: esParv,
      esAgrupacionFlexible: coDocTipo === 'AGRUPACION_FLEXIBLE',
      tipoApoyo: coDocTipo,
      esTallerSep: coDocFinanciamiento === 'SEP',
      esProporcionDocente: coDocTipo === 'CO_DOCENCIA' || coDocCursoId !== 'TRANSVERSAL'
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
  periodoActivo: number;
  onGuardar: (asig: AsignacionHoraria) => Promise<void> | void;
  onCerrar: () => void;
}

const FormAsignarPie: React.FC<FormPieProps> = React.memo(({
  docente,
  colegio,
  cursos,
  periodoActivo,
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
    const esCoDocAula = pieTipo === 'Co-Docencia en Aula Regular';
    const numInput = Number(pieHoras);
    const horasPed = esCoDocAula ? numInput : Math.round(numInput * 1.333);
    const horasCron = esCoDocAula ? Math.round(numInput * 0.75 * 10) / 10 : numInput;

    const newAsig: AsignacionHoraria = {
      id: `asig-pie-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      cursoId: pieCursoId,
      docenteId: docente.id,
      asignatura: pieAsignatura.trim() || `Apoyo Especializado PIE (${pieTipo})`,
      horasPedagogicasAula: horasPed,
      horasCronologicasPie: horasCron,
      esCoDocencia: true,
      esTrabajoColaborativo: esColab,
      tipoApoyo: pieTipo,
      esProporcionDocente: esCoDocAula
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

      <div className="w-28">
        <label className="block text-[10px] font-bold text-purple-900 mb-0.5">
          {pieTipo === 'Co-Docencia en Aula Regular' ? 'Horas Aula (HA)' : 'Horas Cron.'}
        </label>
        <input
          type="number"
          value={pieHoras}
          onChange={(e) => setPieHoras(Number(e.target.value))}
          onFocus={(e) => e.target.select()}
          className="w-full px-2 py-1 border border-purple-300 rounded text-xs text-center font-bold focus:ring-1 focus:ring-purple-500 focus:outline-none"
          min={1}
          max={44}
          step={pieTipo === 'Co-Docencia en Aula Regular' ? '1' : '0.5'}
          required
        />
        {pieTipo === 'Co-Docencia en Aula Regular' && (
          <span className="block text-[9px] text-purple-600 font-semibold text-center mt-0.5">
            Ley 20.903 activa
          </span>
        )}
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
  docentes = [],
  periodoActivo = 2027,
  onGuardarAsignacion,
  onEliminarAsignacion
}) => {
  const [formActivo, setFormActivo] = useState<TipoFormularioActivo>(null);
  const [formRegularCursoId, setFormRegularCursoId] = useState<string | undefined>(undefined);
  const [formRegularAmbito, setFormRegularAmbito] = useState<AmbitoFormRegular | undefined>(undefined);
  const [planesDb, setPlanesDb] = useState<PlanEstudioCurricular[]>([]);
  const [modalSegundaEducadoraOpen, setModalSegundaEducadoraOpen] = useState(false);
  const [docenteSeleccionada2daId, setDocenteSeleccionada2daId] = useState<string>('');
  const [horas2daEducadoraInput, setHoras2daEducadoraInput] = useState<number>(0);

  useEffect(() => {
    let cancel = false;
    listarPlanesEstudio(undefined, colegio.rbd)
      .then(res => {
        if (!cancel && res) setPlanesDb(res);
      })
      .catch(err => console.warn('Error al cargar planes de estudio:', err));
    return () => { cancel = true; };
  }, [colegio.rbd]);

  const asignacionesDocente = useMemo(() => {
    return asignaciones.filter(a => {
      const lePertenece = a.docenteId === docente.id || (a.coDocenteId === docente.id && a.tieneCoDocente);
      if (!lePertenece) return false;
      if (a.cursoId && a.cursoId !== 'TRANSVERSAL') {
        const c = cursos.find(curso => curso.id === a.cursoId);
        if (c) {
          const es34Medio = !/b[aá]sic[oa]|parvulari|k[ií]nder|transici[oó]n|nt[12]|sala\s*cuna/i.test(c.nivel) &&
            /([34][°ºo]?\s*(medio|em|tp)|tercer[oa]?\s*(medio|em)|cuart[oa]?\s*(medio|em))/i.test(c.nivel);
          if (!es34Medio && /plan com[uú]n electivo/i.test(a.asignatura)) {
            return false;
          }
        }
      }
      return true;
    });
  }, [asignaciones, docente.id, cursos]);

  // Purga proactiva si el docente tiene asignada dicha asignatura en cursos de básica/parvularia
  React.useEffect(() => {
    if (!onEliminarAsignacion) return;
    const invalidas = asignaciones.filter(a => {
      const lePertenece = a.docenteId === docente.id || (a.coDocenteId === docente.id && a.tieneCoDocente);
      if (!lePertenece) return false;
      if (a.cursoId && a.cursoId !== 'TRANSVERSAL') {
        const c = cursos.find(curso => curso.id === a.cursoId);
        if (c) {
          const es34Medio = !/b[aá]sic[oa]|parvulari|k[ií]nder|transici[oó]n|nt[12]|sala\s*cuna/i.test(c.nivel) &&
            /([34][°ºo]?\s*(medio|em|tp)|tercer[oa]?\s*(medio|em)|cuart[oa]?\s*(medio|em))/i.test(c.nivel);
          return !es34Medio && /plan com[uú]n electivo/i.test(a.asignatura);
        }
      }
      return false;
    });
    if (invalidas.length > 0) {
      invalidas.forEach(inv => {
        onEliminarAsignacion(inv.id);
      });
    }
  }, [asignaciones, docente.id, cursos, onEliminarAsignacion]);

  // Detección estricta de rol Educadora de Párvulo (nunca por el hecho de dictar un taller en un curso parvulario)
  const esEducadora = useMemo(() => {
    return docente.estamento === 'EDUCADORA_PARVULO' || 
           Boolean(docente.esEducadoraParvulo) || 
           Boolean(docente.cargoInstitucional && /p[aá]rvulo|infantil|prek[ií]nder|k[ií]nder/i.test(docente.cargoInstitucional)) ||
           Boolean(docente.titulo && /p[aá]rvulo|infantil|preescolar/i.test(docente.titulo)) ||
           Boolean(docente.funcionPrincipal && /p[aá]rvulo|infantil|prek[ií]nder|k[ií]nder/i.test(docente.funcionPrincipal));
  }, [docente]);

  // Todos los cursos de Educación Parvularia de la escuela (para el tablero de cobertura)
  const todosCursosParvulariosEscuela = useMemo(() => {
    return cursos.filter(c => esNivelParvulario(c.nivel));
  }, [cursos]);

  // Curso inicial sugerido: si es Educadora de Párvulos, abrir siempre en su primer curso parvulario asignado o en el primer curso parvulario del colegio (nunca en 1° Básico)
  const cursoInicialSugeridoId = useMemo(() => {
    if (esEducadora) {
      const asigParv = asignacionesDocente.find(a => {
        const c = cursos.find(cur => cur.id === a.cursoId);
        return c && esNivelParvulario(c.nivel);
      });
      if (asigParv?.cursoId) return asigParv.cursoId;
      if (todosCursosParvulariosEscuela[0]?.id) return todosCursosParvulariosEscuela[0].id;
    }
    return cursos[0]?.id || '';
  }, [esEducadora, asignacionesDocente, cursos, todosCursosParvulariosEscuela]);

  // Estado para el selector de Curso del Resumen Rápido de Cumplimiento
  const [cursoInspeccionId, setCursoInspeccionId] = useState<string>(cursoInicialSugeridoId);

  // Asegurar que para una Educadora de Párvulos el curso seleccionado por defecto sea un curso parvulario si estaba en 1° Básico
  useEffect(() => {
    if (esEducadora && todosCursosParvulariosEscuela.length > 0) {
      const actual = cursos.find(c => c.id === cursoInspeccionId);
      if (!actual || !esNivelParvulario(actual.nivel)) {
        setCursoInspeccionId(cursoInicialSugeridoId);
      }
    }
  }, [esEducadora, todosCursosParvulariosEscuela, cursos, cursoInspeccionId, cursoInicialSugeridoId]);

  const cursoInspeccion = useMemo(() => {
    return cursos.find(c => c.id === cursoInspeccionId) || (esEducadora ? todosCursosParvulariosEscuela[0] : null) || cursos[0] || null;
  }, [cursos, cursoInspeccionId, esEducadora, todosCursosParvulariosEscuela]);

  const planCursoInspeccion = useMemo(() => {
    return resolverPlanCurso(cursoInspeccion, planesDb);
  }, [cursoInspeccion, planesDb]);

  const dispCursoInspeccion = useMemo(() => {
    return calcularDisponibilidadCurso(cursoInspeccion, planCursoInspeccion, asignaciones);
  }, [cursoInspeccion, planCursoInspeccion, asignaciones]);

    // Total de horas requeridas y cubiertas del curso inspeccionado
  const totalHorasCurso = useMemo(() => {
    const horasBase = planCursoInspeccion.asignaturas.reduce((s, a) => s + a.horas, 0);
    const horasJec = planCursoInspeccion.horasLibreDisposicion || (cursoInspeccion?.regimen === 'JEC' ? 6 : 0);
    return horasBase + horasJec;
  }, [planCursoInspeccion, cursoInspeccion]);

  const totalCubiertasCurso = useMemo(() => {
    const cubiertasBase = dispCursoInspeccion.todas.reduce((s, a) => s + a.horasAsignadas, 0);
    return cubiertasBase + dispCursoInspeccion.horasLibreAsignadas;
  }, [dispCursoInspeccion]);

  // Cursos de párvulo disponibles para esta educadora (todos los cursos parvularios de la escuela)
  const cursosParvulariosDocente = useMemo(() => {
    if (esEducadora && todosCursosParvulariosEscuela.length > 0) {
      return todosCursosParvulariosEscuela;
    }
    const ids = new Set<string>();
    asignacionesDocente.forEach(a => {
      const c = cursos.find(cur => cur.id === a.cursoId);
      if (c && esNivelParvulario(c.nivel)) ids.add(c.id);
    });
    const lista = cursos.filter(c => ids.has(c.id));
    if (cursoInspeccion && esNivelParvulario(cursoInspeccion.nivel) && !ids.has(cursoInspeccion.id)) {
      lista.unshift(cursoInspeccion);
    }
    return lista;
  }, [esEducadora, todosCursosParvulariosEscuela, asignacionesDocente, cursos, cursoInspeccion]);

  // Desglose oficial de Horas Fuera de Aula / Deducibles del docente (Institucionales, SEP, PIE y exentas)
  const desgloseHorasFueraAula = useMemo(() => {
    return calcularHorasFueraAulaDocente(docente, asignacionesDocente, colegio.porcentajePrioritarios || 0);
  }, [docente, asignacionesDocente, colegio.porcentajePrioritarios]);

  const horasNoAulaDocente = desgloseHorasFueraAula.horasExentasTotales;
  const horasContratoDisponiblesAula = desgloseHorasFueraAula.horasParaDocenciaAula;

  // Cálculo de dotación parvularia DTO 306 para el curso relevante
  const cursoParvularioActivo = useMemo(() => {
    if (cursoInspeccion && esNivelParvulario(cursoInspeccion.nivel)) {
      return cursoInspeccion;
    }
    return cursosParvulariosDocente[0] || todosCursosParvulariosEscuela[0] || null;
  }, [cursoInspeccion, cursosParvulariosDocente, todosCursosParvulariosEscuela]);

  // Función auxiliar para calcular el estado normativo de cualquier curso parvulario de la escuela
  const calcularEstadoCursoParvulario = (cursoParv: CursoSae) => {
    // Helper para determinar si un docente es Educadora de Párvulos idónea para DTO 306
    const esDocParvulo = (docId: string): boolean => {
      const d = docentes.find(x => x.id === docId);
      if (!d) return false;
      return d.estamento === 'EDUCADORA_PARVULO' ||
        Boolean(d.esEducadoraParvulo) ||
        Boolean(d.cargoInstitucional && /p[aá]rvulo|infantil|prek[ií]nder|k[ií]nder/i.test(d.cargoInstitucional)) ||
        Boolean(d.titulo && /p[aá]rvulo|infantil|preescolar/i.test(d.titulo)) ||
        Boolean(d.funcionPrincipal && /p[aá]rvulo|infantil|prek[ií]nder|k[ií]nder/i.test(d.funcionPrincipal));
    };

    // Helper para determinar si una asignación es de Apoyo PIE (Decreto 170 / Docente Diferencial)
    const esAsigPie = (a: AsignacionHoraria): boolean => {
      const d = docentes.find(x => x.id === a.docenteId);
      const esDocDiff = Boolean(d && (
        d.estamento === 'DOCENTE_DIFERENCIAL' ||
        ((d.horasPieTitular || 0) + (d.horasPieContrata || 0) > 0 &&
         (d.horasSubvencionGeneralTitular || 0) + (d.horasSubvencionGeneralContrata || 0) === 0)
      ));
      return Boolean(
        esDocDiff ||
        (a.tipoApoyo && /pie|decreto 170|recurso|multidisciplinario|cl[ií]nico/i.test(a.tipoApoyo)) ||
        (a.asignatura && /pie|decreto 170|aula de recurso/i.test(a.asignatura))
      );
    };

    const asigsCursoTodas = asignaciones.filter(a => a.cursoId === cursoParv.id && !a.esTrabajoColaborativo && !a.esTallerSep);

    // Asignaciones de apoyo PIE (Decreto 170): Ingresan como apoyo adicional para NEE, NO cubren ni descuentan permanencia DTO 306
    const asigsApoyoPie = asigsCursoTodas.filter(a => esAsigPie(a));

    // Asignaciones curriculares para la permanencia de los párvulos (DTO 306 / BCEP):
    // SOLO aplican horas de docentes que sean efectivamente Educadoras de Párvulos y que NO sean de apoyo PIE
    const asigsParvulariaPermanencia = asigsCursoTodas.filter(a => !esAsigPie(a) && esDocParvulo(a.docenteId));

    // Asignaciones de talleres impartidos por otros docentes (ej. Educación Física / Música aula regular):
    const asigsTalleresOtrosDocentes = asigsCursoTodas.filter(a => !esAsigPie(a) && !esDocParvulo(a.docenteId));

    // Mapa de horas de Educadoras de Párvulos para determinar Titular y Segunda Educadora
    const mapaHorasEducadoras = new Map<string, { regular: number; codoc: number; total: number }>();
    asigsParvulariaPermanencia.forEach(a => {
      const h = a.horasPedagogicasAula || a.horasCronologicasPie || 0;
      const prev = mapaHorasEducadoras.get(a.docenteId) || { regular: 0, codoc: 0, total: 0 };
      const esCoDocAsig = Boolean(a.esCoDocenciaParvularia || /co-docencia|2da educadora|apoyo/i.test(a.asignatura));
      if (esCoDocAsig) {
        prev.codoc += h;
      } else {
        prev.regular += h;
      }
      prev.total += h;
      mapaHorasEducadoras.set(a.docenteId, prev);
    });

    // Determinar la Educadora Titular del curso
    let titularDocente = docente;
    let maxRegular = -1;
    mapaHorasEducadoras.forEach((vals, docId) => {
      if (vals.regular > maxRegular) {
        maxRegular = vals.regular;
        const dObj = docentes.find(x => x.id === docId);
        if (dObj) titularDocente = dObj;
      }
    });

    // Si la educadora actual no es titular y no tiene horas pero hay educadoras asignadas, usar la de mayor carga
    if (!esDocParvulo(titularDocente.id)) {
      const primeraEd = docentes.find(x => esDocParvulo(x.id));
      if (primeraEd) titularDocente = primeraEd;
    }

    const titularId = titularDocente.id;
    let horasTitularAsig = 0;
    let horasSegundaAsig = 0;

    asigsParvulariaPermanencia.forEach(a => {
      const h = a.horasPedagogicasAula || a.horasCronologicasPie || 0;
      if (a.esCoDocenciaParvularia || (a.docenteId !== titularId)) {
        horasSegundaAsig += h;
      } else {
        horasTitularAsig += h;
      }
    });

    const desgloseTit = titularDocente.id === docente.id
      ? desgloseHorasFueraAula
      : calcularHorasFueraAulaDocente(titularDocente, asignaciones, colegio.porcentajePrioritarios || 0);
    const horasNoAulaTitular = desgloseTit.horasExentasTotales;
    const horasDispAulaTitular = desgloseTit.horasParaDocenciaAula;

    const resultado = calcularDotacionParvulariaCurso(
      {
        id: cursoParv.id,
        nivel: cursoParv.nivel,
        letra: cursoParv.letra,
        regimen: cursoParv.regimen,
        matriculaProyectada: cursoParv.matriculaProyectada,
        esCombinado: cursoParv.esCombinado,
        regimenProporcion: cursoParv.regimenProporcion
      },
      colegio.porcentajePrioritarios,
      {
        horasContrato: titularDocente.horasContrato || 0,
        horasNoAulaDeducibles: horasNoAulaTitular,
        horasContratoDisponiblesAula: horasDispAulaTitular,
        aplicaArticulo69: Boolean(titularDocente.aplicaArticulo69)
      },
      {
        horasAsignadasTitular: horasTitularAsig,
        horasAsignadasSegundaEducadora: horasSegundaAsig
      }
    );

    // Desglose de educadoras/docentes que participan en este curso
    const participantes = [
      ...Array.from(mapaHorasEducadoras.entries()).map(([docId, vals]) => {
        const dObj = docentes.find(x => x.id === docId);
        return {
          docenteId: docId,
          nombreCompleto: dObj ? `${dObj.nombres.split(' ')[0]} ${dObj.apellidos.split(' ')[0]}` : 'Educadora',
          rolTexto: docId === titularId ? 'Titular' : '2da Educadora',
          esTitularCurso: docId === titularId,
          tipo: 'EDUCADORA' as const,
          horas: Math.round(vals.total * 100) / 100
        };
      }),
      ...asigsApoyoPie.map(a => {
        const dObj = docentes.find(x => x.id === a.docenteId);
        const h = a.horasPedagogicasAula || a.horasCronologicasPie || 0;
        return {
          docenteId: a.docenteId,
          nombreCompleto: dObj ? `${dObj.nombres.split(' ')[0]} ${dObj.apellidos.split(' ')[0]}` : 'Docente PIE',
          rolTexto: 'Apoyo PIE (Dec. 170)',
          esTitularCurso: false,
          tipo: 'PIE' as const,
          horas: h
        };
      }),
      ...asigsTalleresOtrosDocentes.map(a => {
        const dObj = docentes.find(x => x.id === a.docenteId);
        const h = a.horasPedagogicasAula || a.horasCronologicasPie || 0;
        return {
          docenteId: a.docenteId,
          nombreCompleto: dObj ? `${dObj.nombres.split(' ')[0]} ${dObj.apellidos.split(' ')[0]}` : 'Docente',
          rolTexto: 'Taller Aula Regular',
          esTitularCurso: false,
          tipo: 'TALLER' as const,
          horas: h
        };
      })
    ];

    const horasDocenteActualEnCurso = Math.round((asigsCursoTodas.filter(a => a.docenteId === docente.id).reduce((s, a) => s + (a.horasPedagogicasAula || a.horasCronologicasPie || 0), 0)) * 100) / 100;

    return {
      ...resultado,
      titularDocente,
      esDocenteActualTitularDelCurso: titularDocente.id === docente.id,
      horasDocenteActualEnCurso,
      participantes
    };
  };

  // Tablero panorámico de todos los cursos parvularios de la escuela
  const resumenTodosCursosParvularios = useMemo(() => {
    return todosCursosParvulariosEscuela.map(c => ({
      curso: c,
      estado: calcularEstadoCursoParvulario(c)
    }));
  }, [todosCursosParvulariosEscuela, asignaciones, docentes, docente, colegio.porcentajePrioritarios]);

  const dotacionParvulariaCursoActivo = useMemo(() => {
    if (!cursoParvularioActivo) return null;
    return calcularEstadoCursoParvulario(cursoParvularioActivo);
  }, [cursoParvularioActivo, colegio.porcentajePrioritarios, docente, docentes, asignaciones]);

  // Cálculo de Carga Horaria y Proporción Docente Ley 20.903 en tiempo real para este docente
  const resumenCargaHoraria = useMemo(() => {
    const isDocenteDiferencial = docente.estamento === 'DOCENTE_DIFERENCIAL' || 
      ((docente.horasPieTitular || 0) + (docente.horasPieContrata || 0) > 0 && 
       (docente.horasSubvencionGeneralTitular || 0) + (docente.horasSubvencionGeneralContrata || 0) === 0);

    // Asignaciones vinculadas a curso con proporción activa o por defecto normativo
    const asigsProporcionales = asignacionesDocente.filter(a => {
      const tieneCurso = Boolean(a.cursoId && a.cursoId !== 'TRANSVERSAL' && a.cursoId !== 'SIN_CURSO');
      const esTrabajoNoAula = Boolean(
        a.esTrabajoColaborativo || 
        a.tipoApoyo === 'TRABAJO_COLABORATIVO' || 
        (a.tipoApoyo && /colaborativo|art\.?\s*86|cl[ií]nico/i.test(a.tipoApoyo)) ||
        (a.asignatura && /colaborativo|art\.?\s*86|cl[ií]nico/i.test(a.asignatura))
      );
      if (!tieneCurso || esTrabajoNoAula) return false;
      if (isDocenteDiferencial) return true;
      return a.esProporcionDocente === true || a.esProporcionDocente !== false;
    });

    let haLectivas65 = 0;
    let haLectivas60 = 0;
    let minsAulaParvularia65 = 0;
    let minsAulaParvularia60 = 0;

    // Régimen normativo de referencia para Educación Parvularia en el establecimiento:
    // Prioridad: 1) Régimen explícito del curso parvulario activo, 2) Régimen de los cursos parvularios de la escuela,
    // 3) Régimen explícito del colegio, 4) '65_35' por defecto (evitando que porcentajePrioritarios=75% fuerce '60_40' cuando no se definió en el colegio).
    const regDefectoParv: '65_35' | '60_40' = cursoParvularioActivo?.regimenProporcion
      ? cursoParvularioActivo.regimenProporcion
      : (todosCursosParvulariosEscuela.find(cp => cp.regimenProporcion)?.regimenProporcion
        || colegio.regimenProporcion
        || '65_35');

    asigsProporcionales.forEach(a => {
      const c = cursos.find(cur => cur.id === a.cursoId);
      const esParvCurso = Boolean((c && esNivelParvulario(c.nivel)) || a.esCoDocenciaParvularia);
      const es60 = (esEducadora && (esParvCurso || !c))
        ? (c?.regimenProporcion ? c.regimenProporcion === '60_40' : regDefectoParv === '60_40')
        : (c?.regimenProporcion ? c.regimenProporcion === '60_40' : (colegio.regimenProporcion ? colegio.regimenProporcion === '60_40' : colegio.porcentajePrioritarios >= 80));
      const ha = getHorasAulaLectivaAsig(a);

      // IMPORTANTE: Solo las Educadoras de Párvulos se calculan en horas cronológicas de 60 min (DTO 306).
      // Un docente de aula regular que dicta un taller en Pre-Kínder o Kínder se calcula SIEMPRE como docente de aula regular (45 min).
      if (esEducadora && (esParvCurso || !c)) {
        const mins = Math.round(ha * 60);
        if (es60) {
          minsAulaParvularia60 += mins;
        } else {
          minsAulaParvularia65 += mins;
        }
      } else {
        if (es60) {
          haLectivas60 += ha;
        } else {
          haLectivas65 += ha;
        }
      }
    });

    const totalHaLectivas = haLectivas65 + haLectivas60;
    const totalHorasAulaParvularia = Math.round(((minsAulaParvularia65 + minsAulaParvularia60) / 60) * 100) / 100;
    const horasAulaParv65 = Math.round((minsAulaParvularia65 / 60) * 100) / 100;
    const horasAulaParv60 = Math.round((minsAulaParvularia60 / 60) * 100) / 100;

    // Asignaciones exentas y funciones fuera de aula (Institucionales, SEP y PIE)
    const horasFuncionesNoAula = desgloseHorasFueraAula.horasInstitucionalesSubvGen;
    const horasCronExentasAsig = Math.round((desgloseHorasFueraAula.sepExentasCronologicas + desgloseHorasFueraAula.pieCronologicas) * 10) / 10;
    const totalHorasFueraAula = desgloseHorasFueraAula.horasExentasTotales;

    // Contrato Requerido por Aula según Tablas Oficiales Mineduc
    // 1. Aula Regular Básica/Media (45 min)
    const reqContratoRegular65 = buscarContratoMinimoPorTabla(haLectivas65, '65_35');
    const reqContratoRegular60 = buscarContratoMinimoPorTabla(haLectivas60, '60_40');
    // 2. Aula Parvularia DTO 306 (60 min)
    const lookupParv65 = buscarContratoMinimoParvulariaPorMinutos(minsAulaParvularia65, '65_35');
    const lookupParv60 = buscarContratoMinimoParvulariaPorMinutos(minsAulaParvularia60, '60_40');
    const reqContratoParv65 = lookupParv65.horasContrato;
    const reqContratoParv60 = lookupParv60.horasContrato;

    const reqContrato65 = reqContratoRegular65 + reqContratoParv65;
    const reqContrato60 = reqContratoRegular60 + reqContratoParv60;
    const reqContratoAulaTotal = reqContrato65 + reqContrato60;

    // Tope máximo de horas de aula (60m) que la educadora puede hacer con su jornada contratada disponible
    // Se prioriza el régimen explícito del curso activo parvulario o de los cursos parvularios del establecimiento
    const tramoTopeEducadora = obtenerTramoMineduc(horasContratoDisponiblesAula, regDefectoParv);
    const minsTopeEducadora = tramoTopeEducadora
      ? tramoTopeEducadora.lectivasMinutosCronologicos
      : Math.floor(horasContratoDisponiblesAula * 60 * (regDefectoParv === '60_40' ? 0.60 : 0.65));
    const topeMaxHorasAulaSegunContrato = Math.round((minsTopeEducadora / 60) * 100) / 100;
    const topeMaxMinutosAulaTexto = formatearMinutosAHHMM(minsTopeEducadora);

    // Contrato Total Requerido
    const contratoRequeridoTotal = reqContratoAulaTotal + totalHorasFueraAula;
    const horasContratoReal = docente.horasContrato || 0;
    const saldoHoras = Math.round((horasContratoReal - contratoRequeridoTotal) * 10) / 10;

    // Auditoría multitramo oficial para recreos y HNL
    const auditRegular = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: haLectivas65,
      horasAula60_40: haLectivas60,
      horasPieCronologicas: desgloseHorasFueraAula.pieCronologicas,
      horasTallerSepExento: desgloseHorasFueraAula.sepExentasCronologicas,
      horasPieSepCronologicas: Math.round((desgloseHorasFueraAula.pieCronologicas + desgloseHorasFueraAula.sepExentasCronologicas) * 10) / 10,
      horasNoAulaInstitucionales: desgloseHorasFueraAula.horasInstitucionalesSubvGen,
      horasContratoReal,
      aplicaArticulo69: Boolean(docente.aplicaArticulo69)
    });

    const minutosRecreoTotal = auditRegular.minutosRecreoTotal + lookupParv65.minutosRecreo + lookupParv60.minutosRecreo;
    const minutosHnlTotal = auditRegular.minutosHnlTotal + lookupParv65.minutosHnl + lookupParv60.minutosHnl;

    return {
      isDocenteDiferencial,
      haLectivas65,
      haLectivas60,
      totalHaLectivas,
      totalHorasAulaParvularia,
      horasAulaParv65,
      horasAulaParv60,
      topeMaxHorasAulaSegunContrato,
      topeMaxMinutosAulaTexto,
      reqContrato65,
      reqContrato60,
      reqContratoAulaTotal,
      horasCronExentasAsig,
      horasFuncionesNoAula,
      contratoRequeridoTotal,
      horasContratoReal,
      saldoHoras,
      audit: {
        ...auditRegular,
        minutosRecreoTotal,
        minutosHnlTotal
      }
    };
  }, [asignacionesDocente, cursos, cursoParvularioActivo, todosCursosParvulariosEscuela, colegio.porcentajePrioritarios, colegio.regimenProporcion, docente, esEducadora, horasNoAulaDocente, horasContratoDisponiblesAula]);

  // Lista exclusiva de Educadoras de Párvulos disponibles en el colegio con su capacidad de aula (60m) y contrato libre
  const educadorasDisponibles = useMemo(() => {
    const regParv: '65_35' | '60_40' = cursoParvularioActivo?.regimenProporcion
      ? cursoParvularioActivo.regimenProporcion
      : (todosCursosParvulariosEscuela.find(cp => cp.regimenProporcion)?.regimenProporcion
        || colegio.regimenProporcion
        || '65_35');

    const mapeados = docentes.map(d => {
      const esEdParv = d.estamento === 'EDUCADORA_PARVULO' ||
        Boolean(d.esEducadoraParvulo) ||
        Boolean(d.cargoInstitucional && /p[aá]rvulo|infantil|prek[ií]nder|k[ií]nder/i.test(d.cargoInstitucional)) ||
        Boolean(d.titulo && /p[aá]rvulo|infantil|preescolar/i.test(d.titulo)) ||
        Boolean(d.funcionPrincipal && /p[aá]rvulo|infantil|prek[ií]nder|k[ií]nder/i.test(d.funcionPrincipal));

      const asigsD = asignaciones.filter(a => a.docenteId === d.id && !a.esTrabajoColaborativo);
      const horasAulaAsignadas = Math.round(asigsD.reduce((s, a) => s + (a.horasPedagogicasAula || a.horasCronologicasPie || 0), 0) * 100) / 100;
      const horasContrato = d.horasContrato || 0;
      const desgloseD = d.id === docente.id
        ? desgloseHorasFueraAula
        : calcularHorasFueraAulaDocente(d, asignaciones, colegio.porcentajePrioritarios || 0);
      const noAulaD = desgloseD.horasExentasTotales;
      const contratoDispAula = desgloseD.horasParaDocenciaAula;
      const tramoTope = obtenerTramoMineduc(contratoDispAula, regParv);
      const minsTopeD = tramoTope ? tramoTope.lectivasMinutosCronologicos : Math.floor(contratoDispAula * 60 * (regParv === '60_40' ? 0.60 : 0.65));
      const topeAulaHoras = Math.round((minsTopeD / 60) * 100) / 100;
      const horasAulaLibres = Math.max(0, Math.round((topeAulaHoras - horasAulaAsignadas) * 100) / 100);
      const reqContratoActual = buscarContratoMinimoParvulariaPorMinutos(Math.round(horasAulaAsignadas * 60), regParv).horasContrato + noAulaD;
      const horasLibres = Math.max(0, Math.round((horasContrato - reqContratoActual) * 10) / 10);

      return {
        docente: d,
        horasContrato,
        horasNoAula: noAulaD,
        horasAsignadas: horasAulaAsignadas,
        topeAulaHoras,
        horasAulaLibres,
        horasLibres,
        esEducadora: esEdParv
      };
    });

    // Filtrar EXCLUSIVAMENTE a las Educadoras de Párvulos (si existen en la escuela)
    const soloEducadoras = mapeados.filter(m => m.esEducadora);
    const listaFinal = soloEducadoras.length > 0 ? soloEducadoras : mapeados;

    return listaFinal.sort((a, b) => b.horasAulaLibres - a.horasAulaLibres);
  }, [docentes, asignaciones, cursos, cursoParvularioActivo, todosCursosParvulariosEscuela, colegio.porcentajePrioritarios, colegio.regimenProporcion, desgloseHorasFueraAula, docente.id]);

  // Detección de posibles asignaciones duplicadas de este docente
  const idsDuplicadosSugeridos = useMemo(() => {
    const vistos = new Map<string, string>(); // clave -> id
    const duplicados: string[] = [];
    asignacionesDocente.forEach(a => {
      const normAsig = (a.asignatura || '').trim().toLowerCase();
      const clave = `${a.cursoId || 'TRANSVERSAL'}_${normAsig}`;
      if (vistos.has(clave)) {
        duplicados.push(a.id);
      } else {
        vistos.set(clave, a.id);
      }
    });
    return duplicados;
  }, [asignacionesDocente]);

  const handleLimpiarDuplicados = async () => {
    if (!onEliminarAsignacion || idsDuplicadosSugeridos.length === 0) return;
    if (confirm(`Se detectaron ${idsDuplicadosSugeridos.length} asignaciones duplicadas para ${docente.nombres}. ¿Deseas depurarlas para conservar una sola asignación por asignatura?`)) {
      for (const id of idsDuplicadosSugeridos) {
        await onEliminarAsignacion(id);
      }
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Barra de Acciones / Botones de Asignación Rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
          <Layers className="w-4 h-4 text-orange-600" />
          <span>Carga Horaria & Asignaciones de {docente.nombres} {docente.apellidos}</span>
          <span className="text-[11px] font-normal text-slate-500">({asignacionesDocente.length} asignaciones)</span>
          {idsDuplicadosSugeridos.length > 0 && onEliminarAsignacion && (
            <button
              type="button"
              onClick={handleLimpiarDuplicados}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded shadow-2xs transition-colors ml-1"
              title={`Depurar ${idsDuplicadosSugeridos.length} asignaciones duplicadas en este docente`}
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Depurar Duplicados ({idsDuplicadosSugeridos.length})</span>
            </button>
          )}
        </h4>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFormRegularCursoId(undefined);
              setFormRegularAmbito(undefined);
              setFormActivo(formActivo === 'REGULAR' ? null : 'REGULAR');
            }}
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

      {/* Tarjeta Resumen: Cómputo de Carga Horaria & Proporción Docente (Ley 20.903) */}
      <div className="bg-gradient-to-r from-slate-50 via-indigo-50/20 to-purple-50/20 border border-slate-200/90 rounded-xl p-3.5 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200/60 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>⚖️ Cómputo de Carga Horaria &amp; Proporción Docente (Ley 20.903)</span>
            </span>
            {esEducadora ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800 border border-teal-200">
                👶 Educadora de Párvulos (DTO 306 - 60 min)
              </span>
            ) : resumenCargaHoraria.isDocenteDiferencial ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                🛡️ Docente Diferencial PIE (Decreto 170 &amp; Ley 20.903 - 45 min)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                👨‍🏫 Docente de Aula Regular (Ley 20.903 - 45 min)
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Jornada Contratada: <strong className="text-slate-800 font-bold">{resumenCargaHoraria.horasContratoReal} hrs cronológicas</strong>
          </span>
        </div>

        {/* Indicadores Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {/* 1. Horas Aula */}
          <div className={`bg-white rounded-lg p-2.5 shadow-2xs border ${esEducadora ? 'border-teal-200' : 'border-indigo-100'}`}>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              1. Horas Aula {esEducadora ? '(60m)' : '(45m)'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-black ${esEducadora ? 'text-teal-700' : 'text-indigo-700'}`}>
                {esEducadora 
                  ? (resumenCargaHoraria.totalHorasAulaParvularia > 0 ? resumenCargaHoraria.totalHorasAulaParvularia : resumenCargaHoraria.totalHaLectivas) 
                  : resumenCargaHoraria.totalHaLectivas}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {esEducadora ? 'hrs (60m)' : 'HA'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block truncate">
              {esEducadora ? (
                `Tope legal: ${resumenCargaHoraria.topeMaxHorasAulaSegunContrato}h (${resumenCargaHoraria.topeMaxMinutosAulaTexto})`
              ) : (
                `${resumenCargaHoraria.haLectivas65} HA (65/35)${resumenCargaHoraria.haLectivas60 > 0 ? ` • ${resumenCargaHoraria.haLectivas60} HA (60/40)` : ''}`
              )}
            </span>
          </div>

          {/* 2. Contrato Req. por Aula */}
          <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">2. Contrato Req. Aula</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-slate-800">{resumenCargaHoraria.reqContratoAulaTotal}</span>
              <span className="text-xs font-bold text-slate-500">hrs</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              {esEducadora ? 'Tabla DTO 306' : 'Tabla Ley 20.903 (45m)'}
            </span>
          </div>

          {/* 3. Funciones No Aula / Coordinación / Colaboración */}
          <div className="bg-white border border-purple-100 rounded-lg p-2.5 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              3. {resumenCargaHoraria.isDocenteDiferencial ? 'Colab. / No Aula' : 'Func. No Aula'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-purple-700">
                {resumenCargaHoraria.horasFuncionesNoAula + resumenCargaHoraria.horasCronExentasAsig}
              </span>
              <span className="text-xs font-bold text-slate-500">hrs</span>
            </div>
            <span className="text-[10px] text-slate-500 block truncate" title={`Funciones No Aula: ${resumenCargaHoraria.horasFuncionesNoAula}h | Exentas: ${resumenCargaHoraria.horasCronExentasAsig}h`}>
              {resumenCargaHoraria.horasFuncionesNoAula > 0 ? `${resumenCargaHoraria.horasFuncionesNoAula}h No Aula` : ''}
              {resumenCargaHoraria.horasCronExentasAsig > 0 ? ` +${resumenCargaHoraria.horasCronExentasAsig}h Exenta` : ''}
              {(resumenCargaHoraria.horasFuncionesNoAula + resumenCargaHoraria.horasCronExentasAsig === 0) ? '0h' : ''}
            </span>
          </div>

          {/* 4. Total Contrato Requerido */}
          <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">4. Contrato Calculado</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-slate-900">{resumenCargaHoraria.contratoRequeridoTotal}</span>
              <span className="text-xs font-bold text-slate-500">hrs</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              Aula ({resumenCargaHoraria.reqContratoAulaTotal}h) + No Aula
            </span>
          </div>

          {/* 5. Saldo Disponible / Horas Libres */}
          <div className={`rounded-lg p-2.5 shadow-2xs border ${
            resumenCargaHoraria.saldoHoras > 0 
              ? 'bg-emerald-50/70 border-emerald-200' 
              : resumenCargaHoraria.saldoHoras < 0 
              ? 'bg-rose-50/70 border-rose-200' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">5. Saldo Jornada</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-black ${
                resumenCargaHoraria.saldoHoras > 0 
                  ? 'text-emerald-700' 
                  : resumenCargaHoraria.saldoHoras < 0 
                  ? 'text-rose-700' 
                  : 'text-slate-700'
              }`}>
                {resumenCargaHoraria.saldoHoras > 0 ? `+${resumenCargaHoraria.saldoHoras}` : resumenCargaHoraria.saldoHoras}
              </span>
              <span className="text-xs font-bold text-slate-500">hrs</span>
            </div>
            <span className={`text-[10px] font-bold block ${
              resumenCargaHoraria.saldoHoras > 0 
                ? 'text-emerald-700' 
                : resumenCargaHoraria.saldoHoras < 0 
                ? 'text-rose-700' 
                : 'text-slate-500'
            }`}>
              {resumenCargaHoraria.saldoHoras > 0 ? 'Horas Libres' : resumenCargaHoraria.saldoHoras < 0 ? 'Sobreasignado' : 'Exacto'}
            </span>
          </div>
        </div>

        {/* Desglose de Derechos Mineduc (Recreo y Horas No Lectivas) */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 bg-white/70 rounded-lg px-3 py-1.5 border border-slate-200/50">
          <span className="flex items-center gap-1">
            <Clock className={`w-3.5 h-3.5 ${esEducadora ? 'text-teal-600' : 'text-indigo-600'}`} />
            <span>Recreo Garantizado: <strong>{Math.floor(resumenCargaHoraria.audit.minutosRecreoTotal / 60)}h {resumenCargaHoraria.audit.minutosRecreoTotal % 60}m</strong></span>
          </span>
          <span className="flex items-center gap-1">
            <span>📚 Horas No Lectivas (HNL): <strong>{Math.floor(resumenCargaHoraria.audit.minutosHnlTotal / 60)}h {resumenCargaHoraria.audit.minutosHnlTotal % 60}m</strong></span>
            <span className="text-slate-400 text-[10px]">(Preparación, Colaboración, PACI/FUDEI)</span>
          </span>
          {esEducadora ? (
            resumenCargaHoraria.totalHorasAulaParvularia > 0 && (
              <span className="text-[10px] font-semibold text-teal-800">
                {resumenCargaHoraria.totalHorasAulaParvularia} hrs cronológicas (60m) frente a párvulos
              </span>
            )
          ) : (
            resumenCargaHoraria.totalHaLectivas > 0 && (
              <span className="text-[10px] font-semibold text-indigo-700">
                {resumenCargaHoraria.totalHaLectivas} periodos lectivos de 45 min asignados a cursos
              </span>
            )
          )}
        </div>
      </div>

      {/* Tarjeta Resumen de Normativa Educación Parvularia (DTO 306/2007 & Ley 20.903) */}
      {esEducadora && dotacionParvulariaCursoActivo && (
        <div className="bg-gradient-to-r from-teal-50/95 via-emerald-50/90 to-teal-50/95 border border-teal-200/90 rounded-2xl p-3.5 shadow-xs space-y-2.5">
          {/* Tablero Panorámico de Todos los Cursos de Párvulos de la Escuela */}
          {resumenTodosCursosParvularios.length > 0 && (
            <div className="bg-white/90 border border-teal-200/80 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-black text-teal-900 tracking-wide flex items-center gap-1.5">
                  <span>🏫 Mapa de Cobertura de Cursos de Párvulos de la Escuela (Haz clic en un curso para gestionarlo):</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  {resumenTodosCursosParvularios.length} {resumenTodosCursosParvularios.length === 1 ? 'curso parvulario' : 'cursos parvularios'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {resumenTodosCursosParvularios.map(({ curso: cItem, estado: estItem }) => {
                  const activo = cursoParvularioActivo?.id === cItem.id;
                  const topeTitHoras = Math.round((estItem.minutosAulaTitular / 60) * 100) / 100;
                  const asigTitHoras = Math.round((estItem.minutosAsignadosTitular / 60) * 100) / 100;
                  const titularExcedida = asigTitHoras > topeTitHoras + 0.05;

                  return (
                    <div
                      key={cItem.id}
                      onClick={() => setCursoInspeccionId(cItem.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        activo
                          ? 'bg-teal-50/95 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                          : 'bg-slate-50/70 hover:bg-teal-50/40 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${estItem.coberturaCompletaPermanencia && !titularExcedida ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span className="text-xs font-black text-slate-900">
                            {cItem.nivel} {cItem.letra} ({cItem.regimen})
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          titularExcedida
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : estItem.coberturaCompletaPermanencia
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {titularExcedida
                            ? `⚠️ Titular excedida (${asigTitHoras}h / ${topeTitHoras}h tope)`
                            : estItem.coberturaCompletaPermanencia
                            ? '✓ 100% Cuadrado'
                            : `Faltan ${estItem.minutosDeficitRestanteTexto} (${estItem.horasAulaSegundaEducadoraRestante}h)`}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-600">
                        <span>
                          Permanencia: <strong>{estItem.minutosCubiertosTotalesTexto} / {estItem.permanenciaTexto}</strong>
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                          {estItem.participantes.length > 0 ? (
                            estItem.participantes.map(p => (
                              <span
                                key={`${p.docenteId}_${p.tipo || 'ed'}`}
                                className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                                  p.tipo === 'PIE'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                    : p.tipo === 'TALLER'
                                    ? 'bg-slate-100 text-slate-800 border border-slate-200'
                                    : p.esTitularCurso
                                    ? 'bg-teal-100 text-teal-900 border border-teal-200'
                                    : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                }`}
                                title={p.tipo === 'PIE' ? 'Apoyo PIE en co-docencia Decreto 170 (Adicional, no descuenta permanencia DTO 306)' : undefined}
                              >
                                {p.tipo === 'PIE' ? '🛡️' : p.tipo === 'TALLER' ? '⚡' : p.esTitularCurso ? '🟢' : '🟣'} {p.nombreCompleto}: {p.horas}{p.tipo === 'PIE' ? ' HA (PIE Adicional)' : 'h'}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">Sin educadoras asignadas</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200/70 pb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-teal-600 text-white rounded-lg shadow-xs">
                <GraduationCap className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-black text-teal-950 uppercase tracking-wide">
                    Normativa Educación Parvularia (DTO 306/2007 &amp; Ley 20.903)
                  </h4>
                  {cursoParvularioActivo && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-200/80 text-teal-900 border border-teal-300">
                      Curso Activo: {cursoParvularioActivo.nivel} {cursoParvularioActivo.letra} ({cursoParvularioActivo.regimen})
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-teal-800 border border-teal-200">
                    Titular del Curso: {dotacionParvulariaCursoActivo.titularDocente.nombres.split(' ')[0]} {dotacionParvulariaCursoActivo.titularDocente.apellidos.split(' ')[0]} ({dotacionParvulariaCursoActivo.horasDisponiblesAulaTitular}h disp. → tope {dotacionParvulariaCursoActivo.minutosAulaTitularTexto})
                  </span>
                </div>
                <p className="text-[11px] text-teal-700 font-medium mt-0.5">
                  Permanencia Niños: <strong>{dotacionParvulariaCursoActivo.permanenciaTexto}</strong> (60 min/hora) | Régimen: <strong>{dotacionParvulariaCursoActivo.regimenNormativoProporcion === '60_40' ? '60/40 (Vulnerable ≥ 60% Prioritarios)' : '65/35'}</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Botón de Cuadratura Automática al Tope Legal cuando la educadora actual está sobreasignada en este curso */}
              {cursoParvularioActivo && dotacionParvulariaCursoActivo.esDocenteActualTitularDelCurso && dotacionParvulariaCursoActivo.minutosAsignadosTitular > dotacionParvulariaCursoActivo.minutosAulaTitular + 1 && onGuardarAsignacion && (
                <button
                  type="button"
                  onClick={async () => {
                    const topeHorasExacto = Math.round((dotacionParvulariaCursoActivo.minutosAulaTitular / 60) * 100) / 100;
                    const actualHoras = Math.round((dotacionParvulariaCursoActivo.minutosAsignadosTitular / 60) * 100) / 100;
                    const excesoHoras = Math.round((actualHoras - topeHorasExacto) * 100) / 100;
                    const deficitQueQuedara = Math.max(0, Math.round(((dotacionParvulariaCursoActivo.permanenciaMinutos - dotacionParvulariaCursoActivo.minutosAulaTitular - dotacionParvulariaCursoActivo.minutosAsignadosSegundaEducadora) / 60) * 100) / 100);

                    if (!confirm(
                      `Actualmente ${docente.nombres} tiene ${actualHoras}h (60m) asignadas en ${cursoParvularioActivo.nivel} ${cursoParvularioActivo.letra}, lo que excede su tope legal de aula (${topeHorasExacto}h / ${dotacionParvulariaCursoActivo.minutosAulaTitularTexto} para sus ${dotacionParvulariaCursoActivo.horasDisponiblesAulaTitular}h disponibles de contrato).\n\n¿Deseas ajustar automáticamente sus asignaciones en este curso a su tope legal exacto (${topeHorasExacto}h) para que su contrato quede Exacto (0) y liberar las ${deficitQueQuedara}h restantes de permanencia para asignárselas a la 2da Educadora?`
                    )) return;

                    let porReducir = excesoHoras;
                    const asigsDocEnCurso = [...asignacionesDocente]
                      .filter(a => a.cursoId === cursoParvularioActivo.id && !a.esTrabajoColaborativo)
                      .reverse();

                    for (const asigItem of asigsDocEnCurso) {
                      if (porReducir <= 0.001) break;
                      const hItem = asigItem.horasPedagogicasAula || asigItem.horasCronologicasPie || 0;
                      if (hItem <= porReducir + 0.01) {
                        porReducir = Math.round((porReducir - hItem) * 100) / 100;
                        if (onEliminarAsignacion) {
                          await onEliminarAsignacion(asigItem.id);
                        }
                      } else {
                        const nuevaH = Math.round((hItem - porReducir) * 100) / 100;
                        porReducir = 0;
                        await onGuardarAsignacion({
                          ...asigItem,
                          horasPedagogicasAula: nuevaH
                        });
                      }
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-all cursor-pointer"
                  title="Ajusta las horas de la educadora titular a su tope legal exacto según su contrato y libera el resto para la 2da educadora"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    Cuadrar a mi Tope Legal ({Math.round((dotacionParvulariaCursoActivo.minutosAulaTitular / 60) * 100) / 100}h) y Liberar Resto para 2da Educadora
                  </span>
                </button>
              )}

              {/* Si estamos viendo la ficha de la 2da educadora (ej. Raquel Ibáñez) y en el curso faltan horas por cubrir, botón directo para asignárselas a ella */}
              {cursoParvularioActivo && esEducadora && !dotacionParvulariaCursoActivo.esDocenteActualTitularDelCurso && dotacionParvulariaCursoActivo.minutosDeficitRestante > 0 && onGuardarAsignacion && (
                <button
                  type="button"
                  onClick={async () => {
                    const hrsFaltantesCurso = dotacionParvulariaCursoActivo.horasAulaSegundaEducadoraRestante || Math.round((dotacionParvulariaCursoActivo.minutosDeficitRestante / 60) * 100) / 100;
                    const nuevaAsig: AsignacionHoraria = {
                      id: `asig_codoc_parv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                      rbd: colegio.rbd,
                      docenteId: docente.id,
                      asignatura: 'Atención Directa y Co-Docencia Parvularia (DTO 306)',
                      cursoId: cursoParvularioActivo.id,
                      horasPedagogicasAula: hrsFaltantesCurso,
                      periodo: periodoActivo,
                      esCoDocencia: true,
                      esCoDocenciaParvularia: true,
                      tipoApoyo: 'CO_DOCENCIA',
                      esProporcionDocente: true
                    };
                    await onGuardarAsignacion(nuevaAsig);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    Asignar a {docente.nombres.split(' ')[0]} las {dotacionParvulariaCursoActivo.minutosDeficitRestanteTexto} ({dotacionParvulariaCursoActivo.horasAulaSegundaEducadoraRestante}h) faltantes de {cursoParvularioActivo.nivel} {cursoParvularioActivo.letra}
                  </span>
                </button>
              )}

              {/* Botón para abrir el modal de Asignar a otra Educadora de Párvulos */}
              {(dotacionParvulariaCursoActivo.horasContratoSegundaEducadoraRestante > 0 || dotacionParvulariaCursoActivo.minutosDeficitRestante > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    if (cursoParvularioActivo) {
                      const hrsAulaFaltantes = dotacionParvulariaCursoActivo.horasAulaSegundaEducadoraRestante || Math.round((dotacionParvulariaCursoActivo.minutosDeficitRestante / 60) * 100) / 100;
                      setHoras2daEducadoraInput(hrsAulaFaltantes > 0 ? hrsAulaFaltantes : dotacionParvulariaCursoActivo.horasContratoSegundaEducadoraRestante);
                      // Seleccionar por defecto la primera educadora con horas disponibles distinta de la titular del curso
                      const idTitCurso = dotacionParvulariaCursoActivo.titularDocente.id;
                      const candidata = educadorasDisponibles.find(e => e.docente.id !== idTitCurso && e.horasAulaLibres > 0) || educadorasDisponibles.find(e => e.docente.id !== idTitCurso) || educadorasDisponibles[0];
                      setDocenteSeleccionada2daId(candidata ? candidata.docente.id : docente.id);
                      setModalSegundaEducadoraOpen(true);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-all cursor-pointer"
                  title="Asignar horas restantes de permanencia a otra Educadora de Párvulos de la escuela"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Asignar a 2da Educadora ({dotacionParvulariaCursoActivo.minutosDeficitRestanteTexto} aula / {dotacionParvulariaCursoActivo.horasContratoSegundaEducadoraRestante}h contrato)</span>
                </button>
              )}
            </div>
          </div>

          {/* Barra de Progreso de Cobertura en Vivo */}
          <div className="bg-white/80 p-2.5 rounded-xl border border-teal-100 shadow-2xs space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-teal-950 flex items-center gap-1.5">
                <span>⏱️ Permanencia Estudiantes Cubierta:</span>
                <strong className="text-teal-700 text-sm">
                  {dotacionParvulariaCursoActivo.minutosCubiertosTotalesTexto} / {dotacionParvulariaCursoActivo.permanenciaTexto}
                </strong>
                <span className={`px-2 py-0.2 rounded-full text-[10px] font-extrabold ${
                  dotacionParvulariaCursoActivo.coberturaCompletaPermanencia 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {dotacionParvulariaCursoActivo.porcentajeCoberturaPermanencia}%
                </span>
              </span>
              <span className="text-[11px] font-semibold text-slate-600">
                {dotacionParvulariaCursoActivo.coberturaCompletaPermanencia ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> ¡Permanencia de Estudiantes 100% Cubierta!
                  </span>
                ) : (
                  <span>Permanencia Restante Estudiantes: <strong className="text-amber-700 text-xs">{dotacionParvulariaCursoActivo.minutosDeficitRestanteTexto}</strong> ({dotacionParvulariaCursoActivo.horasAulaSegundaEducadoraRestante}h cronológicas)</span>
                )}
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
              <div 
                className="bg-teal-500 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((dotacionParvulariaCursoActivo.minutosAsignadosTitular / dotacionParvulariaCursoActivo.permanenciaMinutos) * 100))}%` }}
                title={`Aporte Titular: ${dotacionParvulariaCursoActivo.minutosAsignadosTitularTexto}`}
              />
              <div 
                className="bg-indigo-500 h-full transition-all duration-300"
                style={{ width: `${Math.min(100 - Math.min(100, Math.round((dotacionParvulariaCursoActivo.minutosAsignadosTitular / dotacionParvulariaCursoActivo.permanenciaMinutos) * 100)), Math.round((dotacionParvulariaCursoActivo.minutosAsignadosSegundaEducadora / dotacionParvulariaCursoActivo.permanenciaMinutos) * 100))}%` }}
                title={`Aporte 2da Educadora: ${dotacionParvulariaCursoActivo.minutosAsignadosSegundaTexto}`}
              />
            </div>
            
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600 pt-0.5">
              <span>
                🟢 Titular asignada: <strong>{dotacionParvulariaCursoActivo.minutosAsignadosTitularTexto}</strong> de {dotacionParvulariaCursoActivo.minutosAulaTitularTexto} tope legal
                {dotacionParvulariaCursoActivo.minutosRestantesCapacidadTitular > 0 ? (
                  <span className="text-teal-700 font-bold ml-1">(Disponibles en su tope: {dotacionParvulariaCursoActivo.minutosRestantesCapacidadTitularTexto})</span>
                ) : (
                  <span className="text-emerald-700 font-bold ml-1">(✓ Tope titular completado)</span>
                )}
              </span>
              <span>🟣 2da Educadora asignada: <strong>{dotacionParvulariaCursoActivo.minutosAsignadosSegundaTexto}</strong></span>
            </div>
          </div>

          {/* Grid de Métricas Oficiales de Parvularia */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="bg-white/85 p-2 rounded-xl border border-teal-100 shadow-2xs">
              <span className="block text-[10px] uppercase font-bold text-slate-500">1. Permanencia Niños</span>
              <span className="text-sm font-black text-slate-800">{dotacionParvulariaCursoActivo.permanenciaTexto}</span>
              <span className="block text-[9px] text-slate-400 font-medium">Cubierto: {dotacionParvulariaCursoActivo.minutosCubiertosTotalesTexto}</span>
            </div>
            <div className="bg-white/85 p-2 rounded-xl border border-teal-100 shadow-2xs">
              <span className="block text-[10px] uppercase font-bold text-slate-500">2. Aula Educadora Titular</span>
              <span className="text-sm font-black text-teal-700">{dotacionParvulariaCursoActivo.minutosAsignadosTitularTexto} / {dotacionParvulariaCursoActivo.minutosAulaTitularTexto}</span>
              <span className="block text-[9px] text-slate-400 font-medium">
                {dotacionParvulariaCursoActivo.minutosRestantesCapacidadTitular > 0 ? `Le restan ${dotacionParvulariaCursoActivo.minutosRestantesCapacidadTitularTexto} de aula` : `Tope legal cubierto (${dotacionParvulariaCursoActivo.horasDisponiblesAulaTitular}h)`}
              </span>
            </div>
            <div className={`p-2 rounded-xl border shadow-2xs ${dotacionParvulariaCursoActivo.minutosDeficitRestante > 0 ? 'bg-amber-50/95 border-amber-300' : 'bg-emerald-50/95 border-emerald-300'}`}>
              <span className="block text-[10px] uppercase font-bold text-slate-500">3. Permanencia Restante</span>
              <span className={`text-sm font-black ${dotacionParvulariaCursoActivo.minutosDeficitRestante > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                {dotacionParvulariaCursoActivo.minutosDeficitRestanteTexto}
              </span>
              <span className="block text-[9px] text-slate-500 font-medium">
                {dotacionParvulariaCursoActivo.coberturaCompletaPermanencia ? '✓ 0h pendientes' : `${dotacionParvulariaCursoActivo.horasAulaSegundaEducadoraRestante}h de aula por cubrir`}
              </span>
            </div>
            <div className="bg-white/85 p-2 rounded-xl border border-teal-100 shadow-2xs">
              <span className="block text-[10px] uppercase font-bold text-slate-500">4. Cuota 2da Educadora</span>
              <span className={`text-sm font-black ${dotacionParvulariaCursoActivo.horasContratoSegundaEducadoraRestante > 0 ? 'text-indigo-700' : 'text-emerald-700'}`}>
                {dotacionParvulariaCursoActivo.horasContratoSegundaEducadoraRestante > 0 ? `${dotacionParvulariaCursoActivo.horasContratoSegundaEducadoraRestante} hrs contrato` : '✓ Cuadrado'}
              </span>
              <span className="block text-[9px] text-slate-400 font-medium">
                {dotacionParvulariaCursoActivo.horasContratoSegundaEducadoraRestante > 0 ? `Para cubrir ${dotacionParvulariaCursoActivo.minutosDeficitRestanteTexto} de aula` : 'Permanencia cubierta'}
              </span>
            </div>
          </div>

          {dotacionParvulariaCursoActivo.requiereTecnicoParvuloDto315 && (
            <div className="text-[11px] text-teal-900 flex items-center gap-1.5 font-medium bg-teal-100/70 px-2.5 py-1 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Exigencia Coeficiente Técnico (DTO 315/2010): Requiere obligatoriamente 1 Técnico en Educación Parvularia (TEP) por matrícula &gt; 15.</span>
            </div>
          )}
        </div>
      )}

      {/* Módulo Rápido: Cumplimiento de Plan de Estudio por Curso & Asignación con 1-Clic */}
      {cursoInspeccion && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-orange-600" />
                Cumplimiento del Curso:
              </span>
              <select
                value={cursoInspeccion.id}
                onChange={(e) => setCursoInspeccionId(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800 shadow-xs focus:ring-1 focus:ring-orange-500"
              >
                {cursos.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nivel} {c.letra} ({c.regimen})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {esNivelParvulario(cursoInspeccion.nivel) && dotacionParvulariaCursoActivo && dotacionParvulariaCursoActivo.cursoId === cursoInspeccion.id ? (
                <span className="font-semibold text-slate-600">
                  Permanencia: <strong className={dotacionParvulariaCursoActivo.coberturaCompletaPermanencia ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                    {dotacionParvulariaCursoActivo.minutosCubiertosTotalesTexto} / {dotacionParvulariaCursoActivo.permanenciaTexto}
                  </strong> ({dotacionParvulariaCursoActivo.porcentajeCoberturaPermanencia}%)
                </span>
              ) : (
                <span className="font-semibold text-slate-600">
                  Plan Alumnos: <strong className={totalCubiertasCurso >= totalHorasCurso ? 'text-emerald-600' : 'text-amber-600'}>
                    {totalCubiertasCurso} / {totalHorasCurso} HA
                  </strong> ({totalHorasCurso > 0 ? Math.round((totalCubiertasCurso / totalHorasCurso) * 100) : 0}%)
                </span>
              )}
              {dispCursoInspeccion.horasCoDocenciaApoyoCurso > 0 && (
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                  +{dispCursoInspeccion.horasCoDocenciaApoyoCurso} HA Co-Docencia / Apoyo
                </span>
              )}
            </div>
          </div>

          {/* Chips de Asignación en 1-Clic para este docente */}
          {(() => {
            const subTotalDoc = Number(docente.horasSubvencionGeneralTitular || 0) + Number(docente.horasSubvencionGeneralContrata || 0);
            const contratoSepDoc = Number(docente.horasSepTitular || 0) + Number(docente.horasSepContrata || 0);
            const contratoPieDoc = Number(docente.horasPieTitular || 0) + Number(docente.horasPieContrata || 0);
            const isDocenteSepPuro = contratoSepDoc > 0 && subTotalDoc === 0 && contratoPieDoc === 0;
            const isDocentePiePuro = docente.estamento === 'DOCENTE_DIFERENCIAL' || (contratoPieDoc > 0 && subTotalDoc === 0 && contratoSepDoc === 0);

            return (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
                  Asignar con 1 Clic a {docente.nombres}:
                </span>

                {/* Si es docente financiado 100% por SEP, sugerir Co-docencia o Refuerzo SEP (no asignaturas del plan común titular) */}
                {isDocenteSepPuro && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        if (onGuardarAsignacion) {
                          const horas = prompt(`Horas pedagógicas semanales de Co-Docencia SEP en ${cursoInspeccion.nivel} ${cursoInspeccion.letra}:`, '6');
                          const h = Number(horas);
                          if (h && h > 0) {
                            const nuevaAsig: AsignacionHoraria = {
                              id: `asig_auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                              rbd: colegio.rbd,
                              docenteId: docente.id,
                              asignatura: `Co-Docencia SEP`,
                              cursoId: cursoInspeccion.id,
                              horasPedagogicasAula: h,
                              periodo: periodoActivo,
                              esCoDocencia: true,
                              esTallerSep: true,
                              tipoApoyo: 'CO_DOCENCIA'
                            };
                            await onGuardarAsignacion(nuevaAsig);
                          }
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded text-[11px] font-bold transition-all hover:scale-105 shadow-xs"
                      title={`Asignar Co-Docencia financiada por SEP en ${cursoInspeccion.nivel} ${cursoInspeccion.letra}`}
                    >
                      <Plus className="w-3 h-3 text-indigo-600" />
                      <span>🤝 Asignar Co-Docencia SEP</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (onGuardarAsignacion) {
                          const nombreTaller = prompt(`Nombre del Refuerzo / Taller SEP en ${cursoInspeccion.nivel} ${cursoInspeccion.letra}:`, 'Refuerzo Pedagógico SEP');
                          if (nombreTaller && nombreTaller.trim()) {
                            const horas = prompt(`Horas pedagógicas semanales:`, '2');
                            const h = Number(horas);
                            if (h && h > 0) {
                              const nuevaAsig: AsignacionHoraria = {
                                id: `asig_auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                rbd: colegio.rbd,
                                docenteId: docente.id,
                                asignatura: nombreTaller.trim(),
                                cursoId: cursoInspeccion.id,
                                horasPedagogicasAula: h,
                                periodo: periodoActivo,
                                esTallerSep: true,
                                tipoApoyo: 'TALLER_SEP'
                              };
                              await onGuardarAsignacion(nuevaAsig);
                            }
                          }
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold transition-all hover:scale-105 shadow-xs"
                      title="Asignar Taller o Refuerzo SEP en este curso"
                    >
                      <Plus className="w-3 h-3 text-emerald-600" />
                      <span>🌱 Asignar Refuerzo / Taller SEP</span>
                    </button>
                  </>
                )}

                {/* Si es docente diferencial / PIE, sugerir Co-docencia PIE Dec. 170 */}
                {isDocentePiePuro && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (onGuardarAsignacion) {
                        const horas = prompt(`Horas pedagógicas (HA) de Co-Docencia / Apoyo PIE (con proporción Ley 20.903) en ${cursoInspeccion.nivel} ${cursoInspeccion.letra}:`, '4');
                        const h = Number(horas);
                        if (h && h > 0) {
                          const nuevaAsig: AsignacionHoraria = {
                            id: `asig_auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            rbd: colegio.rbd,
                            docenteId: docente.id,
                            asignatura: 'Apoyo PIE - Co-docencia Aula Común (Decreto 170)',
                            cursoId: cursoInspeccion.id,
                            horasPedagogicasAula: h,
                            horasCronologicasPie: Math.round(h * 0.75 * 10) / 10,
                            periodo: periodoActivo,
                            esCoDocencia: true,
                            esProporcionDocente: true,
                            tipoApoyo: 'Co-Docencia en Aula Regular'
                          };
                          await onGuardarAsignacion(nuevaAsig);
                        }
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded text-[11px] font-bold transition-all hover:scale-105 shadow-xs"
                    title={`Asignar Co-Docencia PIE Decreto 170 con proporción de aula en ${cursoInspeccion.nivel} ${cursoInspeccion.letra}`}
                  >
                    <ShieldCheck className="w-3 h-3 text-purple-600" />
                    <span>🛡️ Asignar Apoyo PIE (Dec. 170)</span>
                  </button>
                )}

                {/* Si es Educadora de Párvulos y el curso inspeccionado es Parvulario, ofrecer botón de Co-docencia 2da Educadora DTO 306 */}
                {esEducadora && cursoInspeccion && esNivelParvulario(cursoInspeccion.nivel) && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (onGuardarAsignacion) {
                        const hrsAulaSugeridas = dotacionParvulariaCursoActivo && dotacionParvulariaCursoActivo.cursoId === cursoInspeccion.id
                          ? (dotacionParvulariaCursoActivo.horasAulaSegundaEducadoraRestante || Math.round((dotacionParvulariaCursoActivo.minutosDeficitRestante / 60) * 100) / 100)
                          : 9.17;
                        const horasPrompt = prompt(
                          `Horas cronológicas de aula (60 min) de Co-Docencia / 2da Educadora (DTO 306) para cubrir permanencia en ${cursoInspeccion.nivel} ${cursoInspeccion.letra}:`,
                          String(hrsAulaSugeridas > 0 ? hrsAulaSugeridas : 9.17)
                        );
                        const h = Number(horasPrompt);
                        if (h && h > 0) {
                          const nuevaAsig: AsignacionHoraria = {
                            id: `asig_codoc_parv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            rbd: colegio.rbd,
                            docenteId: docente.id,
                            asignatura: 'Atención Directa y Co-Docencia Parvularia (DTO 306)',
                            cursoId: cursoInspeccion.id,
                            horasPedagogicasAula: h,
                            periodo: periodoActivo,
                            esCoDocencia: true,
                            esCoDocenciaParvularia: true,
                            tipoApoyo: 'CO_DOCENCIA',
                            esProporcionDocente: true
                          };
                          await onGuardarAsignacion(nuevaAsig);
                        }
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 rounded text-[11px] font-bold transition-all hover:scale-105 shadow-xs"
                    title={`Asignar Co-Docencia DTO 306 en ${cursoInspeccion.nivel} ${cursoInspeccion.letra}`}
                  >
                    <Plus className="w-3 h-3 text-teal-600" />
                    <span>👶 Asignar Co-Docencia DTO 306</span>
                  </button>
                )}

                {/* Si es Educadora de Párvulos en curso de Educación Parvularia: Desplegar Menú Modular BCEP por Ámbitos y Núcleos en Horas Cronológicas (60 min) conectado en vivo a la Permanencia */}
                {esEducadora && !isDocenteSepPuro && !isDocentePiePuro && cursoInspeccion && esNivelParvulario(cursoInspeccion.nivel) && (() => {
                  const asigsCursoParv = asignaciones.filter(
                    a => a.cursoId === cursoInspeccion.id && !a.esTallerSep && !a.esTrabajoColaborativo
                  );
                  const dotParvAct = dotacionParvulariaCursoActivo && dotacionParvulariaCursoActivo.cursoId === cursoInspeccion.id
                    ? dotacionParvulariaCursoActivo
                    : null;

                  // Función helper para renderizar cada botón de núcleo con descuento en vivo
                  const renderBotonNucleo = (b: typeof CATALOGO_BCEP_PARVULARIA[number]) => {
                    const hrsPlanNucleo = cursoInspeccion.regimen === 'JEC' ? b.horasJecCronologicas : b.horasMediaJornadaCronologicas;
                    const hrsYaAsignadasNucleo = asigsCursoParv
                      .filter(a => coincideAsignacionConNucleoBcep(a.asignatura, b))
                      .reduce((s, a) => s + (a.horasPedagogicasAula || a.horasCronologicasPie || 0), 0);

                    const hrsRestantesNucleo = Math.max(0, Math.round((hrsPlanNucleo - hrsYaAsignadasNucleo) * 100) / 100);
                    const cubierto = hrsRestantesNucleo <= 0.01;

                    // Tope legal restante de la educadora titular actual
                    const hrsTopeRestanteTitular = dotParvAct ? dotParvAct.horasRestantesCapacidadTitular : 99;
                    const excedeTopeTitular = !cubierto && hrsTopeRestanteTitular > 0 && hrsRestantesNucleo > hrsTopeRestanteTitular;
                    const topeTitularAgotado = !cubierto && dotParvAct !== null && hrsTopeRestanteTitular <= 0.01;

                    return (
                      <div key={b.id} className="space-y-0.5">
                        <button
                          type="button"
                          disabled={cubierto}
                          onClick={async () => {
                            if (!onGuardarAsignacion || cubierto) return;
                            // Si a la titular le queda menos capacidad que el núcleo completo, ofrecer ajustar a su tope exacto o asignar como 2da educadora
                            let horasAAsignar = hrsRestantesNucleo;
                            let comoCoDocencia = false;

                            if (excedeTopeTitular) {
                              const usarTope = confirm(
                                `A ${docente.nombres} le restan ${dotParvAct?.minutosRestantesCapacidadTitularTexto} (${hrsTopeRestanteTitular}h) para completar su tope legal de aula (${dotParvAct?.minutosAulaTitularTexto}).\n\n¿Deseas asignarle exactamente ${hrsTopeRestanteTitular}h en "${b.nucleo}" para cuadrar su tope legal y dejar las ${Math.round((hrsRestantesNucleo - hrsTopeRestanteTitular) * 100) / 100}h restantes disponibles para la 2da Educadora?`
                              );
                              if (usarTope) {
                                horasAAsignar = hrsTopeRestanteTitular;
                              }
                            } else if (topeTitularAgotado) {
                              comoCoDocencia = true;
                            }

                            const nuevaAsig: AsignacionHoraria = {
                              id: `asig_auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                              rbd: colegio.rbd,
                              docenteId: docente.id,
                              asignatura: b.nucleo,
                              cursoId: cursoInspeccion.id,
                              horasPedagogicasAula: horasAAsignar,
                              periodo: periodoActivo,
                              esProporcionDocente: true,
                              ...(comoCoDocencia ? {
                                esCoDocencia: true,
                                esCoDocenciaParvularia: true,
                                tipoApoyo: 'CO_DOCENCIA' as const
                              } : {})
                            };
                            await onGuardarAsignacion(nuevaAsig);
                          }}
                          className={`w-full text-left p-1.5 rounded border flex items-center justify-between text-[11px] transition-all ${
                            cubierto
                              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800 cursor-default opacity-85'
                              : excedeTopeTitular
                              ? 'bg-amber-50/80 hover:bg-amber-100 border-amber-300 text-slate-900 cursor-pointer'
                              : 'bg-teal-50/50 hover:bg-teal-100 border-teal-200/60 text-slate-800 cursor-pointer'
                          }`}
                          title={
                            cubierto
                              ? `✓ ${b.nucleo} ya está 100% cubierto (${hrsYaAsignadasNucleo}h asignadas)`
                              : excedeTopeTitular
                              ? `Quedan ${hrsRestantesNucleo}h en este núcleo (tu tope legal restante es ${hrsTopeRestanteTitular}h)`
                              : `Haz clic para asignar ${hrsRestantesNucleo}h cronológicas de ${b.nucleo} (descuenta directo de la permanencia)`
                          }
                        >
                          <span className="font-semibold truncate flex items-center gap-1">
                            {cubierto && <Check className="w-3 h-3 text-emerald-600 shrink-0" />}
                            <span className="truncate">{b.nucleo}</span>
                          </span>
                          <span className={`font-black px-1.5 py-0.2 rounded text-[10px] shrink-0 ${
                            cubierto
                              ? 'bg-emerald-200/80 text-emerald-900'
                              : hrsYaAsignadasNucleo > 0
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-teal-200/80 text-teal-900'
                          }`}>
                            {cubierto
                              ? `✓ ${hrsPlanNucleo}h`
                              : hrsYaAsignadasNucleo > 0
                              ? `Faltan ${hrsRestantesNucleo}h (de ${hrsPlanNucleo}h)`
                              : `${hrsRestantesNucleo}h`}
                          </span>
                        </button>
                      </div>
                    );
                  };

                  return (
                    <div className="w-full mt-1.5 space-y-2 bg-teal-50/60 p-2.5 rounded-xl border border-teal-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-teal-900 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                          <span>Plan de Estudio BCEP &amp; Permanencia (Dto. 28/2019 y DTO 306) — Cada núcleo asignado descuenta en vivo de la permanencia:</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {dotParvAct && (
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                              dotParvAct.coberturaCompletaPermanencia
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}>
                              {dotParvAct.coberturaCompletaPermanencia
                                ? '✓ 0h 0m por cubrir'
                                : `Por cubrir: ${dotParvAct.minutosDeficitRestanteTexto} (${dotParvAct.horasAulaSegundaEducadoraRestante}h)`}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-teal-700 bg-white/80 px-2 py-0.5 rounded-full border border-teal-200">
                            Meta {cursoInspeccion.regimen}: {dotParvAct ? dotParvAct.permanenciaTexto : (cursoInspeccion.regimen === 'JEC' ? '35 h 25 m' : '22 h 0 m')}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                        {/* Ámbito 1: Desarrollo Personal y Social */}
                        <div className="bg-white p-2 rounded-lg border border-teal-100 shadow-2xs space-y-1">
                          <span className="text-[10px] uppercase font-black text-teal-800 block border-b border-teal-50 pb-0.5">
                            🌱 Des. Personal y Social
                          </span>
                          {CATALOGO_BCEP_PARVULARIA.filter(b => b.ambito === 'Desarrollo Personal y Social').map(renderBotonNucleo)}
                        </div>

                        {/* Ámbito 2: Comunicación Integral */}
                        <div className="bg-white p-2 rounded-lg border border-teal-100 shadow-2xs space-y-1">
                          <span className="text-[10px] uppercase font-black text-teal-800 block border-b border-teal-50 pb-0.5">
                            🗣️ Comunicación Integral
                          </span>
                          {CATALOGO_BCEP_PARVULARIA.filter(b => b.ambito === 'Comunicación Integral').map(renderBotonNucleo)}
                        </div>

                        {/* Ámbito 3: Interacción y Comprensión del Entorno */}
                        <div className="bg-white p-2 rounded-lg border border-teal-100 shadow-2xs space-y-1">
                          <span className="text-[10px] uppercase font-black text-teal-800 block border-b border-teal-50 pb-0.5">
                            🔍 Interacción y Entorno
                          </span>
                          {CATALOGO_BCEP_PARVULARIA.filter(b => b.ambito === 'Interacción y Comprensión del Entorno').map(renderBotonNucleo)}
                        </div>

                        {/* Experiencias Integradas & Talleres */}
                        <div className="bg-white p-2 rounded-lg border border-teal-100 shadow-2xs space-y-1">
                          <span className="text-[10px] uppercase font-black text-teal-800 block border-b border-teal-50 pb-0.5">
                            🧩 Experiencias &amp; Talleres
                          </span>
                          {CATALOGO_BCEP_PARVULARIA.filter(b => b.ambito === 'Experiencias Integradas y Libre Disposición').map(renderBotonNucleo)}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Para docentes regulares / mixtos con horas de Subvención General en cursos de Básica/Media (o docentes de aula regular que dictan taller en Parvularia): ofrecer las asignaturas disponibles o taller */}
                {!isDocenteSepPuro && !isDocentePiePuro && (!esEducadora || !cursoInspeccion || !esNivelParvulario(cursoInspeccion.nivel)) && dispCursoInspeccion.disponibles.map(asig => (
                  <button
                    key={asig.nombre}
                    type="button"
                    onClick={async () => {
                      if (onGuardarAsignacion) {
                        const resCod = resolverCodigoYAmbitoAsignatura(asig.nombre, {
                          nivelCurso: cursoInspeccion.nivel,
                          esJec: false
                        });
                        const nuevaAsig: AsignacionHoraria = {
                          id: `asig_auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                          rbd: colegio.rbd,
                          docenteId: docente.id,
                          asignatura: asig.nombre,
                          codigoAsignatura: resCod.codigo,
                          ambitoCurricular: resCod.ambito,
                          cursoId: cursoInspeccion.id,
                          horasPedagogicasAula: asig.horasDisponibles,
                          periodo: periodoActivo,
                          esTallerJec: false
                        };
                        await onGuardarAsignacion(nuevaAsig);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-semibold transition-all hover:scale-105 shadow-xs"
                    title={`Haz clic para asignar ${asig.horasDisponibles} HA de ${asig.nombre} en ${cursoInspeccion.nivel} ${cursoInspeccion.letra}`}
                  >
                    <Plus className="w-2.5 h-2.5 text-emerald-600" />
                    <span>{asig.nombre}</span>
                    <span className="bg-emerald-200 text-emerald-900 px-1 rounded text-[10px] font-extrabold">
                      {asig.horasDisponibles} HA
                    </span>
                  </button>
                ))}

                {!isDocenteSepPuro && !isDocentePiePuro && (!esEducadora || !cursoInspeccion || !esNivelParvulario(cursoInspeccion.nivel)) && (dispCursoInspeccion.horasLibreDisponibles > 0 || (!esEducadora && cursoInspeccion && esNivelParvulario(cursoInspeccion.nivel))) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormRegularCursoId(cursoInspeccion.id);
                      setFormRegularAmbito('LIBRE_DISPOSICION');
                      setFormActivo('REGULAR');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[11px] font-semibold transition-all hover:scale-105 shadow-xs cursor-pointer"
                    title={`Abrir formulario guiado de Libre Disposición JEC para ${cursoInspeccion.nivel} ${cursoInspeccion.letra}`}
                  >
                    <Plus className="w-2.5 h-2.5 text-amber-600" />
                    <span>⚡ Taller JEC / Libre Disposición</span>
                    <span className="bg-amber-200 text-amber-950 px-1 rounded text-[10px] font-extrabold">
                      {dispCursoInspeccion.horasLibreDisponibles > 0 ? `${dispCursoInspeccion.horasLibreDisponibles} HA` : '2 HA'}
                    </span>
                  </button>
                )}

                {!isDocenteSepPuro && !isDocentePiePuro && dispCursoInspeccion.disponibles.length === 0 && dispCursoInspeccion.horasLibreDisponibles === 0 && (
                  <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-100/60 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ¡Todas las asignaturas del plan de este curso están 100% cubiertas!
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* 1. Formulario Rápido Asignatura Regular / Taller Aislado */}
      {formActivo === 'REGULAR' && onGuardarAsignacion && (
        <FormAsignarRegular
          docente={docente}
          colegio={colegio}
          cursos={cursos}
          planesDb={planesDb}
          asignacionesColegio={asignaciones}
          periodoActivo={periodoActivo}
          initialCursoId={formRegularCursoId}
          initialAmbito={formRegularAmbito}
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
          periodoActivo={periodoActivo}
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
          periodoActivo={periodoActivo}
          onGuardar={onGuardarAsignacion}
          onCerrar={() => setFormActivo(null)}
        />
      )}

      {/* Lista de Asignaciones Actuales */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] border-b uppercase">
            <tr>
              <th className="px-3 py-2 w-[22%]">1. Curso / Nivel</th>
              <th className="px-3 py-2 w-[38%]">2. Asignatura según Plan / Taller</th>
              <th className="px-3 py-2 text-center w-[16%]">3. Horas</th>
              <th className="px-3 py-2 text-center w-[16%]">4. Modalidad</th>
              <th className="px-3 py-2 text-center w-[8%]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {asignacionesDocente.map(a => (
              <FilaAsignacionDocente
                key={a.id}
                asignacion={a}
                docente={docente}
                cursos={cursos}
                planesDb={planesDb}
                asignacionesColegio={asignaciones}
                onGuardarAsignacion={onGuardarAsignacion}
                onEliminarAsignacion={onEliminarAsignacion}
              />
            ))}
            {asignacionesDocente.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                  Este docente no tiene asignaturas, cursos ni apoyos asignados actualmente. Haz clic en "Asignar Asignatura / Taller" arriba para comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Interactivo: Asignar 2da Educadora Complementaria DTO 306 */}
      {modalSegundaEducadoraOpen && cursoParvularioActivo && dotacionParvulariaCursoActivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-teal-200 my-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="p-4 bg-gradient-to-r from-teal-700 to-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-white/20 rounded-lg">
                  <GraduationCap className="w-5 h-5 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold leading-tight">
                    Asignar 2da Educadora Complementaria (DTO 306)
                  </h3>
                  <p className="text-[11px] text-teal-100">
                    Curso: {cursoParvularioActivo.nivel} {cursoParvularioActivo.letra} ({cursoParvularioActivo.regimen})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalSegundaEducadoraOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!docenteSeleccionada2daId || horas2daEducadoraInput <= 0) {
                  alert('Por favor selecciona una educadora y una cantidad válida de horas.');
                  return;
                }

                if (onGuardarAsignacion) {
                  const nuevaAsig: AsignacionHoraria = {
                    id: `asig_codoc_parv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    rbd: colegio.rbd,
                    docenteId: docenteSeleccionada2daId,
                    asignatura: 'Atención Directa y Co-Docencia Parvularia (DTO 306)',
                    cursoId: cursoParvularioActivo.id,
                    horasPedagogicasAula: horas2daEducadoraInput,
                    periodo: periodoActivo,
                    esCoDocencia: true,
                    esCoDocenciaParvularia: true,
                    tipoApoyo: 'CO_DOCENCIA',
                    esProporcionDocente: true
                  };
                  await onGuardarAsignacion(nuevaAsig);
                }
                setModalSegundaEducadoraOpen(false);
              }}
              className="p-4 space-y-4 text-xs"
            >
              {/* Resumen del Déficit a Cubrir en Tiempo Real */}
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center text-teal-950 font-bold">
                  <span>Permanencia Restante de Estudiantes por Cubrir:</span>
                  <span className="text-sm font-black text-amber-700">
                    {dotacionParvulariaCursoActivo.minutosDeficitRestanteTexto} ({dotacionParvulariaCursoActivo.horasAulaSegundaEducadoraRestante}h aula)
                  </span>
                </div>
                <div className="flex justify-between items-center text-teal-800 text-[11px]">
                  <span>Jornada de Contrato Requerida (2da Educadora):</span>
                  <span className="font-extrabold text-indigo-700">
                    {dotacionParvulariaCursoActivo.horasContratoSegundaEducadoraRestante} hrs contrato (Régimen {dotacionParvulariaCursoActivo.regimenNormativoProporcion === '60_40' ? '60/40' : '65/35'})
                  </span>
                </div>
                <div className="text-[10px] text-teal-700 pt-0.5 border-t border-teal-200/60">
                  La Educadora Titular cubre {dotacionParvulariaCursoActivo.minutosAsignadosTitularTexto} (tope legal: {dotacionParvulariaCursoActivo.minutosAulaTitularTexto}) de los {dotacionParvulariaCursoActivo.permanenciaTexto} de permanencia de los estudiantes.
                </div>
              </div>

              {/* Selector exclusivo de Educadoras de Párvulos con Capacidad de Aula Disponible */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                  <span>Educadora de Párvulos a Asignar *</span>
                  <span className="text-[10px] font-normal text-teal-700 font-semibold">({educadorasDisponibles.length} educadoras en establecimiento)</span>
                </label>
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 custom-scrollbar">
                  {educadorasDisponibles.map(({ docente: docItem, horasContrato, horasNoAula, horasAsignadas, topeAulaHoras, horasAulaLibres, horasLibres, esEducadora: esEd }) => {
                    const estaSeleccionada = docenteSeleccionada2daId === docItem.id;
                    const esTitularCurso = dotacionParvulariaCursoActivo.titularDocente.id === docItem.id;
                    return (
                      <div
                        key={docItem.id}
                        onClick={() => setDocenteSeleccionada2daId(docItem.id)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          estaSeleccionada 
                            ? 'bg-teal-50 border-l-4 border-teal-600' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="docenteSegunda"
                            checked={estaSeleccionada}
                            onChange={() => setDocenteSeleccionada2daId(docItem.id)}
                            className="text-teal-600 focus:ring-teal-500"
                          />
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span>{docItem.nombres} {docItem.apellidos}</span>
                              {esEd && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-teal-100 text-teal-800 border border-teal-200">
                                  Educadora Párvulo
                                </span>
                              )}
                              {esTitularCurso && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Titular de este Curso
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Contrato: {horasContrato}h{horasNoAula > 0 ? ` (${horasNoAula}h no aula)` : ''} • Tope aula: <strong>{topeAulaHoras}h (60m)</strong>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            horasAulaLibres > 0
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {horasAulaLibres > 0 ? `${horasAulaLibres}h aula disp. (${horasLibres}h contrato)` : 'Tope aula completo'}
                          </span>
                          <span className="block text-[9px] text-slate-400 mt-0.5">
                            {horasAsignadas}h / {topeAulaHoras}h aula asignadas
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Horas de Aula a Asignar (con cálculo automático del contrato equivalente) */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <label className="block text-slate-800 font-bold mb-0.5">
                    Horas Cronológicas de Permanencia / Aula a Cubrir (60 min):
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Para cubrir <strong>{horas2daEducadoraInput}h</strong> de aula se requiere un contrato de{' '}
                    <strong className="text-indigo-700">
                      {buscarContratoMinimoParvulariaPorMinutos(Math.round(horas2daEducadoraInput * 60), dotacionParvulariaCursoActivo.regimenNormativoProporcion).horasContrato} hrs
                    </strong>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    step="0.01"
                    min={0.5}
                    max={44}
                    value={horas2daEducadoraInput}
                    onChange={(e) => setHoras2daEducadoraInput(Math.max(0.5, Number(e.target.value)))}
                    className="w-24 text-center font-black text-base bg-white border border-teal-300 rounded-lg py-1 text-teal-900 focus:ring-2 focus:ring-teal-500 outline-none"
                    required
                  />
                  <span className="text-xs font-bold text-slate-600">hrs aula</span>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalSegundaEducadoraOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Confirmar y Asignar Horas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
