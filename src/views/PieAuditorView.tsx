import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  AlertCircle,
  CheckCircle,
  Users,
  Clock,
  ShieldCheck,
  Plus,
  Trash2,
  UserCheck,
  Filter
} from 'lucide-react';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria, AsistenteEducacion } from '../types';
import {
  calcularDemandaNormativaPieCurso,
  esModalidadAdultos,
  esModalidadEspecial,
  esNivelParvulario,
  determinarRegimenNormativo,
  buscarContratoMinimoPorTabla,
  cronologicasAPedagogicasPie,
  pedagogicasACronologicasPie,
  decToHhmm
} from '@slep/mineduc-engine';
import {
  obtenerHorasCronologicasExactasAsig,
  esDocenteEducacionEspecialPie,
  getHorasAulaLectivaAsig,
  auditarCargaDocenteIntegral
} from '../services/auditoriaDocenteService';
import { usePermisos } from '../security/PermisosContext';

interface PieAuditorViewProps {
  colegio: Establecimiento | null;
  cursos: CursoSae[];
  docentes: Docente[];
  asistentes?: AsistenteEducacion[];
  asignaciones?: AsignacionHoraria[];
  onGuardarCurso: (curso: CursoSae) => void;
  onGuardarAsignacion?: (a: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion?: (id: string) => Promise<void> | void;
}

type SubTabPieView = 'matriz_multi' | 'equipo_pie' | 'tabla_resumen';
type FiltroCursosPie = 'TODOS' | 'BRECHA' | 'AFORO_EXCEDIDO';

function esProfesionalPaeAsistente(a: AsistenteEducacion): boolean {
  const est = (a.estamento || '').toUpperCase();
  const fun = (a.cargoFuncion || '').toUpperCase();
  const isTec = est === 'TECNICO' || fun.includes('TECNICO') || fun.includes('TÉCNICO');
  if (isTec) return false;
  return (
    est === 'PROFESIONAL' ||
    fun.includes('FONOAUDI') ||
    fun.includes('PSICOLOG') ||
    fun.includes('TERAPEUTA') ||
    fun.includes('KINESI') ||
    fun.includes('ASISTENTE SOCIAL') ||
    fun.includes('TRABAJADOR SOCIAL')
  );
}

export const PieAuditorView: React.FC<PieAuditorViewProps> = ({
  colegio,
  cursos,
  docentes,
  asistentes = [],
  asignaciones = [],
  onGuardarCurso,
  onGuardarAsignacion,
  onEliminarAsignacion
}) => {
  const { can } = usePermisos();
  const puedeEditarPie = can('pie.editar');
  const [draftInputs, setDraftInputs] = useState<Record<string, { neet?: number; neep?: number }>>({});
  const [subTab, setSubTab] = useState<SubTabPieView>('matriz_multi');
  const [filtroCursos, setFiltroCursos] = useState<FiltroCursosPie>('TODOS');
  const [filtroDocenteId, setFiltroDocenteId] = useState<string>('TODOS');
  const [draftHorasAsig, setDraftHorasAsig] = useState<Record<string, number | string>>({});
  const [jidokaMsg, setJidokaMsg] = useState<string | null>(null);
  const [autoAsignando, setAutoAsignando] = useState(false);

  if (!colegio) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
        Selecciona un establecimiento en la barra superior.
      </div>
    );
  }

  const periodoActivo = cursos[0]?.periodo || docentes[0]?.periodo || 2027;

  // 1. Demandas y asignaciones PIE por curso
  const demandasCursos = useMemo(() => {
    return cursos.map(c => {
      const esParvulario = esNivelParvulario(c.nivel);
      const isJec = esParvulario ? false : c.regimen === 'JEC';
      const jecMismatchParvularia = esParvulario && c.regimen === 'JEC';
      const regimenProporcionCurso: '65_35' | '60_40' =
        c.regimenProporcion || determinarRegimenNormativo(colegio.porcentajePrioritarios || 0, c.nivel);
      const esEpja = esModalidadAdultos(c.nivel) || ((c as any).nombre ? esModalidadAdultos((c as any).nombre) : false);
      const esEspecial = esModalidadEspecial(c.nivel);
      const esExentoPie = esEpja || esEspecial;

      const neetVal = draftInputs[c.id]?.neet ?? c.alumnosNeet;
      const neepVal = draftInputs[c.id]?.neep ?? c.alumnosNeep;

      const dem = esExentoPie
        ? {
            horasTotalCronologicas: 0,
            horasDiferencialDecimal: 0,
            horasDiferencialHHMM: '00:00',
            horasPaeDecimal: 0,
            horasPaeHHMM: '00:00',
            horasTrabajoColaborativoCronologicas: 0,
            neetCount: neetVal,
            neepCount: neepVal,
            isJec,
            cumpleAforo: true,
            observacionNormativa: esEpja
              ? 'EPJA no elegible para Programa de Integración Escolar (PIE).'
              : 'Modalidad Especial no elegible para cupos PIE.'
          }
        : calcularDemandaNormativaPieCurso(neetVal, neepVal, isJec);

      const asigsCurso = asignaciones.filter(a => a.cursoId === c.id);
      const asigsPie = asigsCurso.filter(a => {
        if (a.esTallerSep || a.esTrabajoColaborativo || (a.tipoApoyo && /sep|colaborativ/i.test(a.tipoApoyo))) {
          return false;
        }
        const doc = docentes.find(d => d.id === a.docenteId || d.id === a.coDocenteId);
        const esDocPie =
          doc &&
          (esDocenteEducacionEspecialPie(doc) || doc.estamento === 'PROFESIONAL_PAE');
        return Boolean(
          esDocPie ||
            (a.tipoApoyo && /pie|decreto 170|recurso|pae|cl[ií]nico/i.test(a.tipoApoyo)) ||
            (a.asignatura && /pie|decreto 170|recurso/i.test(a.asignatura))
        );
      });

      const asigsDiferencial = asigsPie.filter(a => {
        const doc = docentes.find(d => d.id === a.docenteId || d.id === a.coDocenteId);
        if (doc?.estamento === 'PROFESIONAL_PAE') return false;
        if (a.tipoApoyo && /pae|cl[ií]nico/i.test(a.tipoApoyo)) return false;
        return Boolean(
          (doc && esDocenteEducacionEspecialPie(doc)) ||
            (a.tipoApoyo && /co-docencia|recurso|diferencial/i.test(a.tipoApoyo)) ||
            (a.asignatura && /co-docencia|recurso|diferencial/i.test(a.asignatura))
        );
      });

      const asigsPae = asigsPie.filter(a => !asigsDiferencial.includes(a));

      const haDiferencialAsignadas = asigsDiferencial.reduce((s, a) => s + getHorasAulaLectivaAsig(a), 0);
      const cronDiferencialAsignadas = asigsDiferencial.reduce((s, a) => s + obtenerHorasCronologicasExactasAsig(a), 0);
      const cronPaeAsignadas = asigsPae.reduce((s, a) => s + obtenerHorasCronologicasExactasAsig(a), 0);
      const horasPieAsignadasCurso = cronDiferencialAsignadas + cronPaeAsignadas;

      const haDifRequeridas = cronologicasAPedagogicasPie(dem.horasDiferencialDecimal);
      const faltanHaDif = Math.max(0, Math.round((haDifRequeridas - haDiferencialAsignadas) * 100) / 100);
      const faltanCronPae = Math.max(0, Math.round((dem.horasPaeDecimal - cronPaeAsignadas) * 100) / 100);
      const contratoEqDifCurso =
        haDifRequeridas > 0 ? buscarContratoMinimoPorTabla(Math.ceil(haDifRequeridas), regimenProporcionCurso) : 0;

      return {
        curso: c,
        demanda: dem,
        esParvulario,
        isJec,
        jecMismatchParvularia,
        regimenProporcionCurso,
        contratoEqDifCurso,
        asigsPie,
        asigsDiferencial,
        asigsPae,
        haDiferencialAsignadas,
        haDifRequeridas,
        faltanHaDif,
        cronDiferencialAsignadas,
        cronPaeAsignadas,
        faltanCronPae,
        horasPieAsignadasCurso,
        esEpja,
        esExentoPie
      };
    });
  }, [cursos, asignaciones, docentes, draftInputs, colegio.porcentajePrioritarios]);

  const cursosConPieCount = demandasCursos.filter(
    d => !d.esExentoPie && (d.demanda.neetCount > 0 || d.demanda.neepCount > 0)
  ).length;
  const metaCoordinacionPie = cursosConPieCount * 2; // Ord. N° 2622/2026 Sección I.5: al menos 2h cronológicas no lectivas por curso PIE

  const totalDemandaEdDiferencial = demandasCursos.reduce((sum, d) => sum + d.demanda.horasDiferencialDecimal, 0);
  const totalDemandaHaDiferencial = cronologicasAPedagogicasPie(totalDemandaEdDiferencial);
  const totalDemandaPae = demandasCursos.reduce((sum, d) => sum + d.demanda.horasPaeDecimal, 0);
  const totalDemandaColab = demandasCursos.reduce((sum, d) => sum + d.demanda.horasTrabajoColaborativoCronologicas, 0);
  const totalHorasPieGeneral = totalDemandaEdDiferencial + totalDemandaPae;
  const totalHorasPieAsignadas = demandasCursos.reduce((sum, d) => sum + d.horasPieAsignadasCurso, 0);

  // 2. Disponibilidad real de Educadoras Diferenciales bajo Ley 20.903 (HA 45m)
  const cursosMap = useMemo(() => new Map(cursos.map(c => [c.id, c])), [cursos]);

  const docentesDiferenciales = useMemo(() => {
    return docentes
      .filter(
        d =>
          esDocenteEducacionEspecialPie(d) ||
          ((d.horasPieTitular || 0) + (d.horasPieContrata || 0) > 0 && d.estamento !== 'PROFESIONAL_PAE')
      )
      .map(d => {
        const hPie = (d.horasPieTitular || 0) + (d.horasPieContrata || 0);
        const horasTotal = hPie > 0 ? hPie : d.horasContrato;
        const coordFunciones =
          d.funcionesNoAula && d.funcionesNoAula.length > 0
            ? d.funcionesNoAula
                .filter(
                  f =>
                    (f.tipo === 'COORDINACION' && f.financiamiento === 'PIE') ||
                    (f.financiamiento === 'PIE' && /coord/i.test(f.nombre || ''))
                )
                .reduce((s, f) => s + (Number(f.horas) || 0), 0)
            : 0;
        const horasCoord = coordFunciones > 0 ? coordFunciones : d.horasCoordinacionPie || 0;
        const horasDirectasDisponibles = Math.max(0, horasTotal - horasCoord);

        const docenteAsigs = asignaciones.filter(a => a.docenteId === d.id);
        const coDocenteAsigs = asignaciones.filter(a => a.coDocenteId === d.id && a.tieneCoDocente);
        const asigsDoc = [...docenteAsigs, ...coDocenteAsigs.filter(ca => !docenteAsigs.some(da => da.id === ca.id))];
        const audit = auditarCargaDocenteIntegral(
          d,
          docenteAsigs,
          coDocenteAsigs,
          cursosMap,
          colegio.porcentajePrioritarios || 0
        );

        const haAsignadas = audit.haDocenciaEfectiva;
        const maxHaPermitidas = audit.maxHAPermitidas;
        const haLibres = Math.max(0, maxHaPermitidas - haAsignadas);

        const cursosResumen = asigsDoc
          .filter(a => !a.esTrabajoColaborativo && !a.esTallerSep)
          .map(a => {
            const c = cursos.find(cur => cur.id === a.cursoId);
            const nombreCurso = c ? `${c.nivel} ${c.letra}` : 'Aula de Recursos';
            return `${nombreCurso} (${getHorasAulaLectivaAsig(a)} HA)`;
          });

        return {
          ...d,
          horasTotal,
          horasCoord,
          horasDirectasDisponibles,
          haAsignadas,
          maxHaPermitidas,
          haLibres,
          esExcesoLectivo: audit.esInfractorExcesoLectivo || haAsignadas > maxHaPermitidas,
          cursosResumen
        };
      });
  }, [docentes, asignaciones, cursos, cursosMap, colegio.porcentajePrioritarios]);

  const horasContratadasDiferencial = docentesDiferenciales.reduce((s, d) => s + d.horasDirectasDisponibles, 0);
  const horasContratadasDiferencialBrutas = docentesDiferenciales.reduce((s, d) => s + d.horasTotal, 0);
  const horasCoordinacionDiferencial = docentesDiferenciales.reduce((s, d) => s + d.horasCoord, 0);
  const totalHaCapacidadDiferencial = docentesDiferenciales.reduce((s, d) => s + d.maxHaPermitidas, 0);
  const totalHaAsignadasDiferencial = docentesDiferenciales.reduce((s, d) => s + d.haAsignadas, 0);

  // 3. Profesionales Asistentes PAE (Docentes PROFESIONAL_PAE + Asistentes PAE) con saldo cronológico
  const profesionalesPae = useMemo(() => {
    const docentesPaeList = docentes
      .filter(d => d.estamento === 'PROFESIONAL_PAE')
      .map(d => {
        const hPie = (d.horasPieTitular || 0) + (d.horasPieContrata || 0);
        const horasPae = hPie > 0 ? hPie : d.horasContrato;
        const asigsDoc = asignaciones.filter(a => a.docenteId === d.id);
        const horasAsignadas = asigsDoc.reduce((s, a) => s + obtenerHorasCronologicasExactasAsig(a), 0);
        const horasLibres = Math.max(0, Math.round((horasPae - horasAsignadas) * 100) / 100);
        const cursosResumen = asigsDoc.map(a => {
          const c = cursos.find(cur => cur.id === a.cursoId);
          return `${c ? `${c.nivel} ${c.letra}` : 'Sin curso'} (${obtenerHorasCronologicasExactasAsig(a)}h)`;
        });
        return {
          id: d.id,
          run: d.run,
          nombre: `${d.nombres} ${d.apellidos}`,
          cargo: d.titulo || 'Profesional Asistente PAE',
          horasPae,
          horasAsignadas,
          horasLibres,
          horasContratoTotal: d.horasContrato,
          origen: 'Docentes' as const,
          cursosResumen
        };
      });

    const asistentesPaeList = asistentes
      .filter(a => {
        const hPie = (Number(a.horasPieIndefinido) || 0) + (Number(a.horasPiePlazoFijo) || 0);
        if (hPie <= 0 && !esProfesionalPaeAsistente(a)) return false;
        const fun = (a.cargoFuncion || '').toUpperCase();
        if (fun.includes('TECNICO') || fun.includes('TÉCNICO')) return false;
        return !docentesPaeList.some(d => d.run.trim() === a.run.trim());
      })
      .map(a => {
        const hPieRaw = (Number(a.horasPieIndefinido) || 0) + (Number(a.horasPiePlazoFijo) || 0);
        const hPie = hPieRaw > 0 ? hPieRaw : Number(a.horasContrato || 0);
        const asigsAsis = asignaciones.filter(asig => asig.docenteId === a.id);
        const horasAsignadas = asigsAsis.reduce((s, asig) => s + obtenerHorasCronologicasExactasAsig(asig), 0);
        const horasLibres = Math.max(0, Math.round((hPie - horasAsignadas) * 100) / 100);
        const cursosResumen = asigsAsis.map(asig => {
          const c = cursos.find(cur => cur.id === asig.cursoId);
          return `${c ? `${c.nivel} ${c.letra}` : 'Sin curso'} (${obtenerHorasCronologicasExactasAsig(asig)}h)`;
        });
        return {
          id: a.id,
          run: a.run,
          nombre: `${a.nombres} ${a.apellidos}`,
          cargo: a.cargoFuncion || 'Profesional Asistente PAE',
          horasPae: hPie,
          horasAsignadas,
          horasLibres,
          horasContratoTotal: a.horasContrato,
          origen: 'Asistentes' as const,
          cursosResumen
        };
      });

    return [...docentesPaeList, ...asistentesPaeList];
  }, [docentes, asistentes, asignaciones, cursos]);

  const horasContratadasPae = profesionalesPae.reduce((s, p) => s + p.horasPae, 0);
  const haDemanda65 = demandasCursos
    .filter(d => !d.esExentoPie && d.regimenProporcionCurso === '65_35')
    .reduce((s, d) => s + d.haDifRequeridas, 0);
  const haDemanda60 = demandasCursos
    .filter(d => !d.esExentoPie && d.regimenProporcionCurso === '60_40')
    .reduce((s, d) => s + d.haDifRequeridas, 0);
  const contratoDifRequeridoMultitramo =
    (haDemanda65 > 0 ? buscarContratoMinimoPorTabla(Math.ceil(haDemanda65), '65_35') : 0) +
    (haDemanda60 > 0 ? buscarContratoMinimoPorTabla(Math.ceil(haDemanda60), '60_40') : 0);
  const balanceContratoDiferencial = Math.round((horasContratadasDiferencial - contratoDifRequeridoMultitramo) * 10) / 10;
  const balanceHaDiferencial = totalHaCapacidadDiferencial - totalDemandaHaDiferencial;
  const balancePae = horasContratadasPae - totalDemandaPae;

  // 4. Acciones de asignación multi-docente directa por curso
  const handleAgregarEducadoraACurso = async (cursoId: string, faltanHa: number) => {
    if (!onGuardarAsignacion || !puedeEditarPie) return;
    if (docentesDiferenciales.length === 0) {
      alert('No hay Educadoras Diferenciales registradas en la dotación del establecimiento.');
      return;
    }

    const mejorEducadora = [...docentesDiferenciales].sort((a, b) => b.haLibres - a.haLibres)[0];
    const haSugeridas = faltanHa > 0 ? Math.max(1, Math.round(faltanHa)) : 4;
    const haFinal = mejorEducadora.haLibres > 0 ? Math.min(haSugeridas, Math.max(1, mejorEducadora.haLibres)) : haSugeridas;

    const nuevaAsig: AsignacionHoraria = {
      id: `asig-pie-dif-${cursoId}-${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      cursoId,
      docenteId: mejorEducadora.id,
      asignatura: 'Apoyo PIE - Co-docencia Aula Común',
      horasPedagogicasAula: haFinal,
      horasCronologicasPie: pedagogicasACronologicasPie(haFinal),
      esCoDocencia: true,
      esProporcionDocente: true,
      tipoApoyo: 'Co-Docencia en Aula Regular'
    };

    await onGuardarAsignacion(nuevaAsig);
  };

  const handleAgregarPaeACurso = async (cursoId: string, faltanCron: number) => {
    if (!onGuardarAsignacion || !puedeEditarPie) return;
    if (profesionalesPae.length === 0) {
      alert('No hay Profesionales Asistentes PAE (Fonoaudiólogo, Psicólogo, TO) registrados con horas PIE en este establecimiento.');
      return;
    }

    const mejorPae = [...profesionalesPae].sort((a, b) => b.horasLibres - a.horasLibres)[0];
    const hrsSugeridas = faltanCron > 0 ? Math.round(faltanCron * 100) / 100 : 2;
    const hrsFinal = mejorPae.horasLibres > 0 ? Math.min(hrsSugeridas, mejorPae.horasLibres) : hrsSugeridas;

    const nuevaAsig: AsignacionHoraria = {
      id: `asig-pie-pae-${cursoId}-${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      cursoId,
      docenteId: mejorPae.id,
      asignatura: `Apoyo Especializado PAE - ${mejorPae.cargo}`,
      horasPedagogicasAula: Math.round(hrsFinal * 1.333),
      horasCronologicasPie: hrsFinal,
      esCoDocencia: true,
      esProporcionDocente: false,
      tipoApoyo: 'Apoyo Multidisciplinario / Clínico PAE'
    };

    await onGuardarAsignacion(nuevaAsig);
  };

  const handleActualizarAsigPie = async (asig: AsignacionHoraria, patch: Partial<AsignacionHoraria>) => {
    if (!onGuardarAsignacion || !puedeEditarPie) return;
    await onGuardarAsignacion({ ...asig, ...patch });
  };

  const handleAutoAsignarBrechasJidoka = async () => {
    if (!onGuardarAsignacion || !puedeEditarPie) return;
    setAutoAsignando(true);
    setJidokaMsg(null);
    try {
      const saldoHaMap = new Map<string, number>();
      docentesDiferenciales.forEach(d => saldoHaMap.set(d.id, d.haLibres));

      const saldoPaeMap = new Map<string, number>();
      profesionalesPae.forEach(p => saldoPaeMap.set(p.id, p.horasLibres));

      let creadasDif = 0;
      let creadasPae = 0;

      for (const item of demandasCursos) {
        if (item.esExentoPie || item.demanda.horasTotalCronologicas === 0) continue;

        let haRestantesCurso = item.faltanHaDif;
        if (haRestantesCurso > 0) {
          for (const d of docentesDiferenciales) {
            if (haRestantesCurso <= 0) break;
            const libre = saldoHaMap.get(d.id) || 0;
            if (libre >= 1) {
              const asignarHa = Math.min(libre, Math.ceil(haRestantesCurso));
              saldoHaMap.set(d.id, libre - asignarHa);
              haRestantesCurso -= asignarHa;

              await onGuardarAsignacion({
                id: `auto-pie-dif-${item.curso.id}-${d.id}-${Date.now()}_${creadasDif}`,
                rbd: colegio.rbd,
                periodo: periodoActivo,
                cursoId: item.curso.id,
                docenteId: d.id,
                asignatura: 'Apoyo PIE - Co-docencia Aula Común',
                horasPedagogicasAula: asignarHa,
                horasCronologicasPie: pedagogicasACronologicasPie(asignarHa),
                esCoDocencia: true,
                esProporcionDocente: true,
                tipoApoyo: 'Co-Docencia en Aula Regular'
              });
              creadasDif++;
            }
          }
        }

        let paeRestantesCurso = item.faltanCronPae;
        if (paeRestantesCurso > 0) {
          for (const p of profesionalesPae) {
            if (paeRestantesCurso <= 0.01) break;
            const libre = saldoPaeMap.get(p.id) || 0;
            if (libre >= 0.25) {
              const asignarPae = Math.round(Math.min(libre, paeRestantesCurso) * 100) / 100;
              saldoPaeMap.set(p.id, Math.round((libre - asignarPae) * 100) / 100);
              paeRestantesCurso = Math.round((paeRestantesCurso - asignarPae) * 100) / 100;

              await onGuardarAsignacion({
                id: `auto-pie-pae-${item.curso.id}-${p.id}-${Date.now()}_${creadasPae}`,
                rbd: colegio.rbd,
                periodo: periodoActivo,
                cursoId: item.curso.id,
                docenteId: p.id,
                asignatura: `Apoyo Especializado PAE - ${p.cargo}`,
                horasPedagogicasAula: Math.round(asignarPae * 1.333),
                horasCronologicasPie: asignarPae,
                esCoDocencia: true,
                esProporcionDocente: false,
                tipoApoyo: 'Apoyo Multidisciplinario / Clínico PAE'
              });
              creadasPae++;
            }
          }
        }
      }

      if (creadasDif === 0 && creadasPae === 0) {
        setJidokaMsg('No se crearon nuevas asignaciones (los cursos ya están cubiertos o no quedan horas libres en el equipo PIE).');
      } else {
        setJidokaMsg(
          `Asignación Jidoka completada: se crearon ${creadasDif} asignación(es) de Educadora Diferencial (en HA bajo Ley 20.903) y ${creadasPae} asignación(es) de Profesional PAE.`
        );
      }
    } finally {
      setAutoAsignando(false);
    }
  };

  // Filtrado de cursos en la matriz visual
  const cursosFiltrados = demandasCursos.filter(item => {
    if (filtroDocenteId !== 'TODOS') {
      const participa = item.asigsPie.some(a => a.docenteId === filtroDocenteId || a.coDocenteId === filtroDocenteId);
      if (!participa) return false;
    }
    if (filtroCursos === 'BRECHA') {
      return !item.esExentoPie && (item.faltanHaDif > 0 || item.faltanCronPae > 0);
    }
    if (filtroCursos === 'AFORO_EXCEDIDO') {
      return !item.demanda.cumpleAforo;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header Slim Dec. 170 & Ord. 2622 */}
      <div className="card-elevated px-4 py-3.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 text-[10px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3" />
            Dec. 170 & Ord. 2622/2026
          </span>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
            Auditoría y Asignación Visual PIE · {colegio.nombre}
          </h2>
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold cursor-help"
            title="Las Educadoras Diferenciales se asignan y auditan siempre en Horas Pedagógicas (HA 45m) bajo Ley 20.903. Los Profesionales PAE se asignan en horas cronológicas."
          >
            ?
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div
            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-2"
            title={`Capacidad máxima Ley 20.903: ${totalHaCapacidadDiferencial} HA | Demanda Dto. 170: ${totalDemandaHaDiferencial} HA (${haDemanda65} HA en 65/35 + ${haDemanda60} HA en 60/40) = ~${contratoDifRequeridoMultitramo}h contrato req. vs ${horasContratadasDiferencial}h contratadas directas.`}
          >
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Dif. (HA)</span>
            <span className="text-sm font-black font-mono tabular-nums text-orange-600 dark:text-orange-400">
              {totalHaAsignadasDiferencial} / {totalDemandaHaDiferencial} HA
            </span>
            <span
              className={`text-[10px] font-bold font-mono tabular-nums ${
                balanceHaDiferencial >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {balanceHaDiferencial >= 0 ? `+${balanceHaDiferencial} HA` : `${balanceHaDiferencial} HA`}
            </span>
          </div>

          <div
            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-2"
            title={`Comparación homogénea en horas cronológicas de contrato Ley 20.903 (${haDemanda65} HA en 65/35 + ${haDemanda60} HA en 60/40).`}
          >
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Cto. Dif.</span>
            <span className="text-sm font-black font-mono tabular-nums text-purple-700 dark:text-purple-400">
              {horasContratadasDiferencial} / {contratoDifRequeridoMultitramo}h
            </span>
            <span
              className={`text-[10px] font-bold font-mono tabular-nums ${
                balanceContratoDiferencial >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {balanceContratoDiferencial >= 0 ? `+${balanceContratoDiferencial}h` : `${balanceContratoDiferencial}h`}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">PAE</span>
            <span className="text-sm font-black font-mono tabular-nums text-blue-600 dark:text-blue-400">
              {totalDemandaPae.toFixed(1)}h
            </span>
            <span
              className={`text-[10px] font-bold font-mono tabular-nums ${
                balancePae >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {balancePae >= 0 ? `+${balancePae.toFixed(1)}h` : `${balancePae.toFixed(1)}h`}
            </span>
          </div>

          <div
            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-2"
            title={`Ord. N° 2622/2026 (Sección I.5): Al menos 2 hrs cronológicas no lectivas por cada curso con PIE (${cursosConPieCount} cursos × 2h = ${metaCoordinacionPie}h).`}
          >
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Coord. PIE</span>
            <span
              className={`text-sm font-black font-mono tabular-nums ${
                horasCoordinacionDiferencial >= metaCoordinacionPie
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {horasCoordinacionDiferencial}h / {metaCoordinacionPie}h
            </span>
          </div>
        </div>
      </div>

      {/* Sub-navegación visual y acción Jidoka */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
          <button
            type="button"
            onClick={() => setSubTab('matriz_multi')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'matriz_multi'
                ? 'bg-white text-purple-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏫 Asignación Visual por Curso ({cursos.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('equipo_pie')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'equipo_pie'
                ? 'bg-white text-purple-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👥 Equipo PIE & Saldos Ley 20.903 ({docentesDiferenciales.length + profesionalesPae.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('tabla_resumen')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'tabla_resumen'
                ? 'bg-white text-purple-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📊 Tabla Resumen Normativa
          </button>
        </div>

        {puedeEditarPie && onGuardarAsignacion && (
          <button
            type="button"
            disabled={autoAsignando}
            onClick={handleAutoAsignarBrechasJidoka}
            className="px-4 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer w-fit"
            title="Distribuye automáticamente las HA faltantes de Educadoras Diferenciales (respetando topes Ley 20.903) y horas PAE por curso."
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{autoAsignando ? 'Asignando...' : 'Auto-Asignar Brechas (Jidoka)'}</span>
          </button>
        )}
      </div>

      {jidokaMsg && (
        <div className="p-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
            <span>{jidokaMsg}</span>
          </span>
          <button type="button" onClick={() => setJidokaMsg(null)} className="text-purple-700 hover:text-purple-950 font-black px-1">
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-PESTAÑA 1: MATRIZ VISUAL MULTI-DOCENTE POR CURSO (ESTILO SAASSLEP) */}
      {/* ===================================================================== */}
      {subTab === 'matriz_multi' && (
        <div className="space-y-4">
          {/* Roster Compacto de Capacidad en Vivo (Bolsillos HA Ley 20.903 y PAE) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-600" />
                <span>Capacidad en Vivo del Equipo PIE (clic para filtrar cursos de un profesional)</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1 text-[11px] bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <Filter className="w-3 h-3 text-slate-500 ml-1.5" />
                  {(['TODOS', 'BRECHA', 'AFORO_EXCEDIDO'] as FiltroCursosPie[]).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFiltroCursos(f)}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        filtroCursos === f ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {f === 'TODOS' ? 'Todos' : f === 'BRECHA' ? 'Con Brecha' : 'Exceso Aforo'}
                    </button>
                  ))}
                </div>
                {filtroDocenteId !== 'TODOS' && (
                  <button
                    type="button"
                    onClick={() => setFiltroDocenteId('TODOS')}
                    className="text-[11px] font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2 py-1 rounded-lg"
                  >
                    Limpiar filtro docente ✕
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {docentesDiferenciales.map(d => {
                const pct = d.maxHaPermitidas > 0 ? Math.min(100, Math.round((d.haAsignadas / d.maxHaPermitidas) * 100)) : 0;
                const activo = filtroDocenteId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setFiltroDocenteId(activo ? 'TODOS' : d.id)}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      activo
                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                        : d.esExcesoLectivo
                        ? 'border-rose-300 bg-rose-50/50 hover:bg-rose-50'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="font-bold text-slate-900 truncate">👩‍🏫 {d.nombres.split(' ')[0]} {d.apellidos.split(' ')[0]}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-black text-[10px] shrink-0 ${
                          d.esExcesoLectivo
                            ? 'bg-rose-100 text-rose-800'
                            : d.haLibres > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {d.esExcesoLectivo ? 'Exceso' : `${d.haLibres} HA lib.`}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {d.haAsignadas} / {d.maxHaPermitidas} HA (Ley 20.903){d.horasCoord > 0 ? ` · ${d.horasCoord}h Coord.` : ''}
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          d.esExcesoLectivo ? 'bg-rose-500' : pct >= 95 ? 'bg-blue-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}

              {profesionalesPae.map(p => {
                const pct = p.horasPae > 0 ? Math.min(100, Math.round((p.horasAsignadas / p.horasPae) * 100)) : 0;
                const activo = filtroDocenteId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFiltroDocenteId(activo ? 'TODOS' : p.id)}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      activo
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : p.horasAsignadas > p.horasPae
                        ? 'border-rose-300 bg-rose-50/50 hover:bg-rose-50'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="font-bold text-slate-900 truncate">🩺 {p.nombre.split(' ').slice(0, 2).join(' ')}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-black text-[10px] shrink-0 ${
                          p.horasAsignadas > p.horasPae
                            ? 'bg-rose-100 text-rose-800'
                            : p.horasLibres > 0
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {p.horasLibres}h lib.
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {p.horasAsignadas} / {p.horasPae}h cron. · {p.cargo}
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          p.horasAsignadas > p.horasPae ? 'bg-rose-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tarjetas por Curso (Multi-Docente) */}
          <div className="space-y-3.5">
            {cursosFiltrados.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs italic">
                No hay cursos que coincidan con el filtro seleccionado.
              </div>
            ) : (
              cursosFiltrados.map(item => {
                const {
                  curso,
                  demanda,
                  esParvulario,
                  isJec,
                  jecMismatchParvularia,
                  regimenProporcionCurso,
                  contratoEqDifCurso,
                  asigsDiferencial,
                  asigsPae,
                  haDiferencialAsignadas,
                  haDifRequeridas,
                  faltanHaDif,
                  cronPaeAsignadas,
                  faltanCronPae,
                  esExentoPie
                } = item;

                const neetActual = draftInputs[curso.id]?.neet ?? curso.alumnosNeet;
                const neepActual = draftInputs[curso.id]?.neep ?? curso.alumnosNeep;

                return (
                  <div
                    key={curso.id}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3.5 transition-all ${
                      !demanda.cumpleAforo
                        ? 'border-rose-300'
                        : faltanHaDif === 0 && faltanCronPae === 0 && !esExentoPie && demanda.horasTotalCronologicas > 0
                        ? 'border-emerald-200'
                        : 'border-slate-200 hover:border-purple-300'
                    }`}
                  >
                    {/* Encabezado del Curso */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-black text-base shrink-0">
                          🏫
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-slate-900">
                              {curso.nivel} {curso.letra}
                            </h4>
                            {puedeEditarPie && !esParvulario ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onGuardarCurso({
                                    ...curso,
                                    regimen: isJec ? 'No JEC' : 'JEC'
                                  })
                                }
                                title="Clic para alternar jornada JEC / Sin JEC de este curso (impacta la tabla base Dto. 170: 10h vs 7h)."
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                  isJec
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                    : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200'
                                }`}
                              >
                                {isJec ? 'JEC' : 'Sin JEC'}
                              </button>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  jecMismatchParvularia
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-sky-50 text-sky-800 border-sky-200'
                                }`}
                                title={
                                  jecMismatchParvularia
                                    ? 'Curso de Parvularia etiquetado como JEC en origen; el motor aplica automáticamente Sin JEC (7h base) por normativa.'
                                    : esParvulario
                                    ? 'Educación Parvularia aplica siempre régimen Sin JEC.'
                                    : undefined
                                }
                              >
                                {isJec ? 'JEC' : 'Sin JEC'}
                                {jecMismatchParvularia ? ' (Auto Parv.)' : ''}
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                regimenProporcionCurso === '60_40'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              }`}
                              title={
                                curso.regimenProporcion
                                  ? 'Proporción Ley 20.903 definida explícitamente en el curso.'
                                  : `Proporción Ley 20.903 automática según ${colegio.porcentajePrioritarios || 0}% prioritarios y nivel (${curso.nivel}).`
                              }
                            >
                              {regimenProporcionCurso === '60_40' ? '60/40' : '65/35'}
                            </span>
                          </div>
                          {esExentoPie && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{demanda.observacionNormativa}</p>
                          )}
                        </div>
                      </div>

                      {!esExentoPie && (
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Inputs NEET / NEEP */}
                          <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
                            <label className="text-[10px] font-bold uppercase text-slate-500">NEET:</label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              disabled={!puedeEditarPie}
                              value={neetActual}
                              onChange={e => {
                                const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                setDraftInputs(prev => ({ ...prev, [curso.id]: { ...prev[curso.id], neet: val } }));
                              }}
                              onBlur={() => {
                                const val = draftInputs[curso.id]?.neet;
                                if (val !== undefined && val !== curso.alumnosNeet) {
                                  onGuardarCurso({ ...curso, alumnosNeet: val });
                                }
                              }}
                              className={`w-12 text-center border rounded px-1 py-0.5 font-black font-mono ${
                                neetActual > 5 ? 'border-rose-500 bg-rose-50 text-rose-700' : 'bg-white text-slate-800'
                              }`}
                            />

                            <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">NEEP:</label>
                            <input
                              type="number"
                              min="0"
                              max="15"
                              disabled={!puedeEditarPie}
                              value={neepActual}
                              onChange={e => {
                                const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                setDraftInputs(prev => ({ ...prev, [curso.id]: { ...prev[curso.id], neep: val } }));
                              }}
                              onBlur={() => {
                                const val = draftInputs[curso.id]?.neep;
                                if (val !== undefined && val !== curso.alumnosNeep) {
                                  onGuardarCurso({ ...curso, alumnosNeep: val });
                                }
                              }}
                              className={`w-12 text-center border rounded px-1 py-0.5 font-black font-mono ${
                                neepActual > 2 ? 'border-rose-500 bg-rose-50 text-rose-700' : 'bg-white text-slate-800'
                              }`}
                            />

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                demanda.cumpleAforo ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {demanda.cumpleAforo ? '✓ Aforo OK' : '⚠️ Exceso Aforo'}
                            </span>
                          </div>

                          {/* Cajas Demanda vs Asignado */}
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <div className="bg-orange-50 px-2.5 py-1.5 rounded-xl border border-orange-200 text-center">
                              <span className="block text-[9px] uppercase font-bold text-orange-800">Diferencial (45m)</span>
                              <strong className="text-orange-950">
                                {haDiferencialAsignadas} / {haDifRequeridas} HA
                              </strong>
                              <span className={`block text-[9px] font-bold ${faltanHaDif === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {demanda.horasDiferencialHHMM}h aula · ~{contratoEqDifCurso}h cto · {faltanHaDif > 0 ? `faltan ${faltanHaDif} HA` : '✓ Cubierto'}
                              </span>
                            </div>

                            <div className="bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200 text-center">
                              <span className="block text-[9px] uppercase font-bold text-blue-800">PAE (60m)</span>
                              <strong className="text-blue-950">
                                {cronPaeAsignadas.toFixed(2).replace(/\.00$/, '')} / {demanda.horasPaeDecimal}h
                              </strong>
                              <span className={`block text-[9px] font-bold ${faltanCronPae === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {demanda.horasPaeHHMM}h · {faltanCronPae > 0 ? `faltan ${faltanCronPae}h` : '✓ Cubierto'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Grilla Multi-Docente del Curso */}
                    {!esExentoPie && (
                      <div className="space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                            Equipo PIE Asignado al Curso ({asigsDiferencial.length + asigsPae.length})
                          </span>

                          {puedeEditarPie && onGuardarAsignacion && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleAgregarEducadoraACurso(curso.id, faltanHaDif)}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] shadow-2xs cursor-pointer flex items-center gap-1 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Educadora Dif. {faltanHaDif > 0 ? `(+${Math.round(faltanHaDif)} HA)` : '(HA)'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAgregarPaeACurso(curso.id, faltanCronPae)}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] shadow-2xs cursor-pointer flex items-center gap-1 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Profesional PAE {faltanCronPae > 0 ? `(+${faltanCronPae}h)` : '(hrs)'}</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {asigsDiferencial.length === 0 && asigsPae.length === 0 ? (
                          <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-slate-500 text-xs">
                            Sin profesionales PIE asignados en este curso. Presiona <strong>+ Educadora Dif.</strong> o <strong>+ Profesional PAE</strong> para asignar en 1 clic.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {/* Tarjetas de Educadoras Diferenciales (HA 45m) */}
                            {asigsDiferencial.map(asig => {
                              const haVal = draftHorasAsig[asig.id] ?? getHorasAulaLectivaAsig(asig);
                              const haNum = Number(haVal) || 0;
                              return (
                                <div
                                  key={asig.id}
                                  className="p-3 rounded-xl border border-purple-200 bg-purple-50/60 flex flex-col gap-2 text-xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-900 text-[10px] font-black uppercase">
                                      👩‍🏫 Educadora Diferencial · HA (45m)
                                    </span>
                                    {puedeEditarPie && onEliminarAsignacion && (
                                      <button
                                        type="button"
                                        onClick={() => onEliminarAsignacion(asig.id)}
                                        className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-100 transition-colors cursor-pointer"
                                        title="Quitar asignación de este curso"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                                    <div className="sm:col-span-2">
                                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Docente Diferencial</label>
                                      <select
                                        disabled={!puedeEditarPie || !onGuardarAsignacion}
                                        value={asig.docenteId}
                                        onChange={e => handleActualizarAsigPie(asig, { docenteId: e.target.value })}
                                        className="w-full p-1.5 bg-white border border-purple-300 rounded-lg font-bold text-slate-800 text-xs"
                                      >
                                        {docentesDiferenciales.map(d => (
                                          <option key={d.id} value={d.id}>
                                            {d.nombres} {d.apellidos} ({d.esExcesoLectivo ? 'Exceso' : `${d.haLibres} HA libres`})
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Horas Aula (HA)</label>
                                      <input
                                        type="number"
                                        min="1"
                                        max="44"
                                        step="1"
                                        disabled={!puedeEditarPie || !onGuardarAsignacion}
                                        value={haVal}
                                        onChange={e => setDraftHorasAsig(prev => ({ ...prev, [asig.id]: e.target.value }))}
                                        onBlur={() => {
                                          const h = Math.max(1, Math.round(Number(draftHorasAsig[asig.id] ?? getHorasAulaLectivaAsig(asig))));
                                          setDraftHorasAsig(prev => {
                                            const copy = { ...prev };
                                            delete copy[asig.id];
                                            return copy;
                                          });
                                          if (h !== asig.horasPedagogicasAula || asig.esProporcionDocente !== true) {
                                            handleActualizarAsigPie(asig, {
                                              horasPedagogicasAula: h,
                                              horasCronologicasPie: pedagogicasACronologicasPie(h),
                                              esProporcionDocente: true
                                            });
                                          }
                                        }}
                                        className="w-full p-1.5 bg-white border border-purple-300 rounded-lg font-black font-mono text-center text-xs text-purple-900"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <select
                                      disabled={!puedeEditarPie || !onGuardarAsignacion}
                                      value={asig.tipoApoyo || 'Co-Docencia en Aula Regular'}
                                      onChange={e =>
                                        handleActualizarAsigPie(asig, {
                                          tipoApoyo: e.target.value,
                                          asignatura: e.target.value.includes('Recursos')
                                            ? 'Apoyo PIE - Aula de Recursos'
                                            : 'Apoyo PIE - Co-docencia Aula Común',
                                          esProporcionDocente: true
                                        })
                                      }
                                      className="p-1 bg-white border border-purple-200 rounded-lg text-[11px] font-semibold text-slate-700"
                                    >
                                      <option value="Co-Docencia en Aula Regular">Co-Docencia en Aula Regular</option>
                                      <option value="Aula de Recursos / Refuerzo Especializado">Aula de Recursos / Refuerzo Especializado</option>
                                    </select>
                                    <span className="text-[10px] font-bold text-purple-700 shrink-0">
                                      ≡ {decToHhmm(pedagogicasACronologicasPie(haNum))}h Dto. 170 · Ley 20.903
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Tarjetas de Profesionales Asistentes PAE (hrs cron.) */}
                            {asigsPae.map(asig => {
                              const cronVal = draftHorasAsig[asig.id] ?? obtenerHorasCronologicasExactasAsig(asig);
                              return (
                                <div
                                  key={asig.id}
                                  className="p-3 rounded-xl border border-blue-200 bg-blue-50/60 flex flex-col gap-2 text-xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="px-2 py-0.5 rounded bg-blue-200 text-blue-900 text-[10px] font-black uppercase">
                                      🩺 Profesional PAE · hrs cron. (60m)
                                    </span>
                                    {puedeEditarPie && onEliminarAsignacion && (
                                      <button
                                        type="button"
                                        onClick={() => onEliminarAsignacion(asig.id)}
                                        className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-100 transition-colors cursor-pointer"
                                        title="Quitar asignación de este curso"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                                    <div className="sm:col-span-2">
                                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Profesional Asistente PAE</label>
                                      <select
                                        disabled={!puedeEditarPie || !onGuardarAsignacion}
                                        value={asig.docenteId}
                                        onChange={e => {
                                          const sel = profesionalesPae.find(p => p.id === e.target.value);
                                          handleActualizarAsigPie(asig, {
                                            docenteId: e.target.value,
                                            asignatura: sel ? `Apoyo Especializado PAE - ${sel.cargo}` : asig.asignatura
                                          });
                                        }}
                                        className="w-full p-1.5 bg-white border border-blue-300 rounded-lg font-bold text-slate-800 text-xs"
                                      >
                                        {profesionalesPae.map(p => (
                                          <option key={p.id} value={p.id}>
                                            {p.nombre} ({p.cargo} · {p.horasLibres}h libres)
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Horas Cron.</label>
                                      <input
                                        type="number"
                                        min="0.25"
                                        max="44"
                                        step="0.25"
                                        disabled={!puedeEditarPie || !onGuardarAsignacion}
                                        value={cronVal}
                                        onChange={e => setDraftHorasAsig(prev => ({ ...prev, [asig.id]: e.target.value }))}
                                        onBlur={() => {
                                          const c = Math.max(0.25, Number(draftHorasAsig[asig.id] ?? obtenerHorasCronologicasExactasAsig(asig)));
                                          setDraftHorasAsig(prev => {
                                            const copy = { ...prev };
                                            delete copy[asig.id];
                                            return copy;
                                          });
                                          if (c !== asig.horasCronologicasPie) {
                                            handleActualizarAsigPie(asig, {
                                              horasCronologicasPie: c,
                                              horasPedagogicasAula: Math.round(c * 1.333),
                                              esProporcionDocente: false
                                            });
                                          }
                                        }}
                                        className="w-full p-1.5 bg-white border border-blue-300 rounded-lg font-black font-mono text-center text-xs text-blue-900"
                                      />
                                    </div>
                                  </div>

                                  <div className="text-[10px] font-semibold text-blue-800">
                                    Modalidad: {asig.tipoApoyo || 'Apoyo Multidisciplinario / Clínico PAE'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-PESTAÑA 2: EQUIPO PIE & DISPONIBILIDAD LEY 20.903                 */}
      {/* ===================================================================== */}
      {subTab === 'equipo_pie' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center justify-between">
              <span>Docentes Educación Diferencial ({docentesDiferenciales.length})</span>
              <span className="text-xs text-orange-600 font-bold">
                {totalHaAsignadasDiferencial} / {totalHaCapacidadDiferencial} HA (Ley 20.903)
              </span>
            </h3>

            <div className="space-y-2.5 text-xs">
              {docentesDiferenciales.length === 0 ? (
                <p className="text-slate-400 italic">No hay educadores diferenciales registrados.</p>
              ) : (
                docentesDiferenciales.map(d => (
                  <div key={d.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-bold text-slate-900">{d.nombres} {d.apellidos}</div>
                        <div className="text-[10px] text-slate-500">
                          RUN: {d.run} • {d.calidadJuridica} • Contrato PIE: {d.horasTotal}h
                          {d.horasCoord > 0 ? ` (${d.horasCoord}h Coord. PIE)` : ''}
                        </div>
                      </div>
                      <span
                        className={`font-black px-2 py-0.5 rounded border text-[11px] shrink-0 ${
                          d.esExcesoLectivo
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-white text-purple-800 border-purple-200'
                        }`}
                      >
                        {d.haAsignadas} / {d.maxHaPermitidas} HA ({d.esExcesoLectivo ? 'Exceso' : `${d.haLibres} HA lib.`})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {d.cursosResumen.length > 0 ? (
                        d.cursosResumen.map((cr, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded text-[10px]">
                            {cr}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-amber-600 font-semibold italic">Sin cursos asignados</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center justify-between">
              <span>Profesionales Asistentes PAE ({profesionalesPae.length})</span>
              <span className="text-xs text-blue-600 font-bold">{horasContratadasPae} hrs contratadas</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              {profesionalesPae.length === 0 ? (
                <p className="text-slate-400 italic">No hay profesionales asistentes PAE registrados.</p>
              ) : (
                profesionalesPae.map(p => (
                  <div key={p.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-bold text-slate-900">{p.nombre}</div>
                        <div className="text-[10px] text-slate-500">
                          RUN: {p.run} • {p.cargo} • <span className="text-blue-700 font-semibold">{p.origen}</span>
                        </div>
                      </div>
                      <span className="font-black text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200 text-[11px] shrink-0">
                        {p.horasAsignadas} / {p.horasPae} hrs ({p.horasLibres}h lib.)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.cursosResumen.length > 0 ? (
                        p.cursosResumen.map((cr, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-[10px]">
                            {cr}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-amber-600 font-semibold italic">Sin cursos asignados</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-PESTAÑA 3: TABLA RESUMEN NORMATIVA                                */}
      {/* ===================================================================== */}
      {subTab === 'tabla_resumen' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-600" />
              Matriz de Diagnóstico y Demanda PIE por Curso
            </h3>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Total Asignado: {totalHorasPieAsignadas.toFixed(1)}h / {totalHorasPieGeneral.toFixed(1)}h
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Curso</th>
                  <th className="px-4 py-3 text-center">Régimen</th>
                  <th className="px-4 py-3 text-center">NEET</th>
                  <th className="px-4 py-3 text-center">NEEP</th>
                  <th className="px-4 py-3 text-center bg-orange-50/70 text-orange-900">Ed. Diferencial</th>
                  <th className="px-4 py-3 text-center bg-blue-50/70 text-blue-900">PAE</th>
                  <th className="px-4 py-3 text-center">Colaborativo (Art. 86)</th>
                  <th className="px-4 py-3 text-center font-black">Total Req.</th>
                  <th className="px-4 py-3 text-center bg-emerald-50/70 text-emerald-900">Asignado</th>
                  <th className="px-4 py-3 text-center">Cobertura</th>
                  <th className="px-4 py-3">Estado Normativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {demandasCursos.map(({ curso, demanda, isJec, regimenProporcionCurso, contratoEqDifCurso, horasPieAsignadasCurso }) => {
                  const pct = demanda.horasTotalCronologicas > 0 ? Math.round((horasPieAsignadasCurso / demanda.horasTotalCronologicas) * 100) : 0;
                  return (
                    <tr key={curso.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-bold text-slate-800">{curso.nivel} {curso.letra}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border">
                            {isJec ? 'JEC' : 'Sin JEC'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            {regimenProporcionCurso === '60_40' ? '60/40' : '65/35'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold">{curso.alumnosNeet}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold">{curso.alumnosNeep}</td>
                      <td className="px-4 py-3 text-center font-bold text-orange-700 bg-orange-50/30">
                        <div>{cronologicasAPedagogicasPie(demanda.horasDiferencialDecimal)} HA</div>
                        <div className="text-[10px] font-semibold text-orange-600/80">
                          {demanda.horasDiferencialHHMM}h aula · ~{contratoEqDifCurso}h cto
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-blue-700 bg-blue-50/30">
                        {demanda.horasPaeHHMM} hrs ({demanda.horasPaeDecimal}h)
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700">
                        {demanda.horasTrabajoColaborativoCronologicas.toFixed(1)} hrs
                      </td>
                      <td className="px-4 py-3 text-center font-black text-[#002B49]">{demanda.horasTotalCronologicas} hrs</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-800 bg-emerald-50/30">
                        {horasPieAsignadasCurso.toFixed(1)} hrs
                      </td>
                      <td className="px-4 py-3 text-center">
                        {demanda.horasTotalCronologicas === 0 ? (
                          <span className="text-[10px] text-slate-400">Sin demanda</span>
                        ) : pct >= 100 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">{pct}% Cubierto</span>
                        ) : pct > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">{pct}% Parcial</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">0% Sin Asignar</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {demanda.cumpleAforo ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            Aforo Decreto 170 OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 text-[11px] font-bold">
                            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                            Aforo Excedido
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
