import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Baby,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  GraduationCap,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import {
  AsistenteEducacion,
  CursoSae,
  Docente,
  Establecimiento,
  JiscNivelParvularia,
  JiscParvuloB3,
  SalaInfraestructura,
  SubtipoNivelJisc,
  TurnoParvulariaVtf,
} from '../types';
import {
  COEFICIENTES_DS115_2012,
  evaluarDotacionEstablecimientoVtf,
  proyectarNivelesVtfSiguientePeriodo,
} from '@slep/mineduc-engine';
import {
  eliminarJiscNivel,
  eliminarTurnoVtf,
  guardarCursosBatch,
  guardarJiscNivelesBatch,
  guardarTurnosVtfBatch,
  listarJiscNiveles,
  listarParvulosB3,
  listarTurnosVtf,
} from '../database/db';
import { ingestarArchivosJisc } from '../services/jiscIngestaService';
import { importarPlanillaPalDEP } from '../services/depPalExportService';

interface JardinVtfWorkspaceViewProps {
  colegio: Establecimiento;
  periodoActivo: number;
  cursos: CursoSae[];
  docentes: Docente[];
  asistentes: AsistenteEducacion[];
  salas: SalaInfraestructura[];
  onRefreshData?: () => void;
  onGuardarColegio?: (col: Establecimiento) => Promise<void> | void;
  onSelectTab?: (tab: 'balanza' | 'docentes' | 'asistentes' | 'cursos' | 'pie' | 'salas' | 'jardin_vtf') => void;
}

const SUBTIPOS_OPTIONS: Array<{ value: SubtipoNivelJisc; label: string }> = [
  { value: 'SALA_CUNA_MENOR', label: 'Sala Cuna Menor (3-11m | 1 Téc/7)' },
  { value: 'SALA_CUNA_MAYOR', label: 'Sala Cuna Mayor (12-23m | 1 Téc/7)' },
  { value: 'SALA_CUNA_HETEROGENEA', label: 'Sala Cuna Heterogénea (3-23m | 1 Téc/7)' },
  { value: 'MEDIO_MENOR', label: 'Nivel Medio Menor (24-35m | 1 Téc/25)' },
  { value: 'MEDIO_MAYOR', label: 'Nivel Medio Mayor (36-47m | 1 Téc/32)' },
  { value: 'MEDIO_HETEROGENEO', label: 'Nivel Medio Mixto / Heterogéneo' },
  { value: 'HETEROGENEO', label: 'Grupo Heterogéneo Multinivel' },
  { value: 'TRANSICION', label: 'Nivel Transición (NT1/NT2 | 1 Téc/35)' },
];

export const JardinVtfWorkspaceView: React.FC<JardinVtfWorkspaceViewProps> = ({
  colegio,
  periodoActivo,
  cursos,
  docentes,
  asistentes,
  salas,
  onRefreshData,
  onGuardarColegio,
  onSelectTab,
}) => {
  const [nivelesJisc, setNivelesJisc] = useState<JiscNivelParvularia[]>([]);
  const [turnos, setTurnos] = useState<TurnoParvulariaVtf[]>([]);
  const [parvulosB3, setParvulosB3] = useState<JiscParvuloB3[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subTab, setSubTab] = useState<'resumen' | 'niveles' | 'turnos' | 'proyeccion' | 'ingesta'>('resumen');
  const [estadoMsg, setEstadoMsg] = useState<{ text: string; type: 'ok' | 'warn' | 'err' } | null>(null);
  const [importando, setImportando] = useState(false);

  // Nuevo / editar nivel JISC
  const [formNivelOpen, setFormNivelOpen] = useState(false);
  const [editNivelId, setEditNivelId] = useState<string | null>(null);
  const [nivelSubtipo, setNivelSubtipo] = useState<SubtipoNivelJisc>('MEDIO_HETEROGENEO');
  const [nivelNombre, setNivelNombre] = useState('Nivel Medio Mixto');
  const [nivelCapacidad, setNivelCapacidad] = useState(28);
  const [nivelMatricula, setNivelMatricula] = useState(24);
  const [nivelEdadMin, setNivelEdadMin] = useState<number>(26);
  const [nivelEdadMax, setNivelEdadMax] = useState<number>(47);
  const [nivelExt, setNivelExt] = useState(false);
  const [nivelMatExt, setNivelMatExt] = useState(0);

  // Nuevo turno VTF
  const [turnoOpen, setTurnoOpen] = useState(false);
  const [turnoRun, setTurnoRun] = useState('');
  const [turnoNombre, setTurnoNombre] = useState('');
  const [turnoEstamento, setTurnoEstamento] = useState<TurnoParvulariaVtf['estamentoVtf']>('TECNICO');
  const [turnoNivelId, setTurnoNivelId] = useState('');
  const [turnoEntrada, setTurnoEntrada] = useState('08:30');
  const [turnoSalida, setTurnoSalida] = useState('17:30');
  const [turnoColacion, setTurnoColacion] = useState(45);
  const [turnoFranja, setTurnoFranja] = useState<TurnoParvulariaVtf['franja']>('REGULAR');

  const fileJiscRef = useRef<HTMLInputElement>(null);
  const filePalVtfRef = useRef<HTMLInputElement>(null);

  const cargarDatosVtf = useCallback(async () => {
    setCargando(true);
    try {
      const [nList, tList, b3List] = await Promise.all([
        listarJiscNiveles(colegio.rbd, periodoActivo),
        listarTurnosVtf(colegio.rbd, periodoActivo),
        listarParvulosB3(colegio.rbd, periodoActivo),
      ]);
      setNivelesJisc(nList);
      setTurnos(tList);
      setParvulosB3(b3List);
    } finally {
      setCargando(false);
    }
  }, [colegio.rbd, periodoActivo]);

  useEffect(() => {
    cargarDatosVtf();
  }, [cargarDatosVtf]);

  // Si aún no hay jisc_niveles_parvularia pero existen cursos_sae creados manualmente, proyectarlos como entrada
  const nivelesParaMotor = useMemo(() => {
    if (nivelesJisc.length > 0) {
      return nivelesJisc.map((n) => ({
        id: n.id,
        nivelNombre: n.nivelNombre,
        subtipoNivel: n.subtipoNivel,
        matriculaActiva: n.matriculaActiva,
        capacidadAutorizada: n.capacidadAutorizada,
        edadMesesMin: n.edadMesesMin,
        edadMesesMax: n.edadMesesMax,
        tieneExtensionHoraria: n.tieneExtensionHoraria,
        matriculaExtension: n.matriculaExtension,
        educadorasAsignadas: n.educadorasAsignadasJisc,
        tecnicosAsignados: n.tecnicosAsignadosJisc,
      }));
    }
    return cursos.map((c) => ({
      id: c.id,
      nivelNombre: c.nivel,
      matriculaActiva: c.matriculaProyectada,
      capacidadAutorizada: c.cupoSae,
      edadMesesMin: c.edadMesesMinima,
      edadMesesMax: c.edadMesesMaxima,
      tieneExtensionHoraria: c.tieneExtensionHoraria,
      matriculaExtension: c.matriculaExtension,
    }));
  }, [nivelesJisc, cursos]);

  // Conteo de personal desde Docentes + Asistentes cargados (PAL VTF o manual) + fallback JISC
  const resumenPersonal = useMemo(() => {
    const dirDoc = docentes.filter((d) => d.funcionVtf === 'Función Directiva' || d.estamento === 'DIRECTIVO' || (d.horasDirectivas || 0) > 0).length;
    const eduDoc = docentes.filter((d) => d.funcionVtf === 'Educadora de Párvulos' || (d.esEducadoraParvulo && d.funcionVtf !== 'Función Directiva' && d.estamento !== 'DIRECTIVO')).length;
    const dirAe = asistentes.filter((a) => a.funcionVtf === 'Función Directiva').length;
    const tecAe = asistentes.filter((a) => a.funcionVtf === 'Técnico de Educación Parvularia' || a.esTecnicoParvulo || a.estamento === 'TECNICO').length;
    const otrosAe = asistentes.filter((a) => a.funcionVtf !== 'Función Directiva' && a.funcionVtf !== 'Técnico de Educación Parvularia' && !a.esTecnicoParvulo && a.estamento !== 'TECNICO').length;

    const tieneNominaPersonal = docentes.length + asistentes.length > 0;
    const jiscEdu = nivelesJisc.reduce((s, n) => s + (n.educadorasAsignadasJisc || 0), 0);
    const jiscTec = nivelesJisc.reduce((s, n) => s + (n.tecnicosAsignadosJisc || 0), 0);
    const jiscDir = nivelesJisc.some((n) => (n.directorasAsignadasJisc || 0) > 0) ? 1 : (colegio.director ? 1 : 0);

    return {
      tieneNominaPersonal,
      directoras: tieneNominaPersonal ? dirDoc + dirAe : jiscDir,
      educadoras: tieneNominaPersonal ? eduDoc : jiscEdu,
      tecnicos: tieneNominaPersonal ? tecAe : jiscTec,
      otrosAsistentes: otrosAe,
    };
  }, [docentes, asistentes, nivelesJisc, colegio.director]);

  const diagnosticoVtf = useMemo(() => {
    return evaluarDotacionEstablecimientoVtf({
      rbd: colegio.rbd,
      niveles: nivelesParaMotor,
      personalVtf: {
        directoras: resumenPersonal.directoras,
        educadoras: resumenPersonal.educadoras,
        tecnicos: resumenPersonal.tecnicos,
        otrosAsistentes: resumenPersonal.otrosAsistentes,
      },
      turnos: turnos.map((t) => ({
        id: t.id,
        estamentoVtf: t.estamentoVtf,
        horaEntrada: t.horaEntrada,
        horaSalida: t.horaSalida,
        minutosColacion: t.minutosColacion,
        horasSemanalesCronologicas: t.horasSemanalesCronologicas,
      })),
      horarioApertura: colegio.horarioApertura || '08:30',
      horarioCierre: colegio.horarioCierre || '16:30',
      horarioExtensionCierre: colegio.horarioExtensionCierre || '19:30',
    });
  }, [colegio, nivelesParaMotor, resumenPersonal, turnos]);

  const proyeccion2027 = useMemo(() => {
    return proyectarNivelesVtfSiguientePeriodo(
      parvulosB3.map((p) => ({ edadMeses: p.edadMeses, activo: p.activo }))
    );
  }, [parvulosB3]);

  const personalCombinadoTurnos = useMemo(() => {
    const lista: Array<{ run: string; nombre: string; estamento: TurnoParvulariaVtf['estamentoVtf']; horas: number }> = [];
    for (const d of docentes) {
      lista.push({
        run: d.run,
        nombre: `${d.nombres} ${d.apellidos}`.trim(),
        estamento: d.funcionVtf === 'Función Directiva' || d.estamento === 'DIRECTIVO' ? 'DIRECTIVA' : 'EDUCADORA',
        horas: d.horasContrato || 44,
      });
    }
    for (const a of asistentes) {
      lista.push({
        run: a.run,
        nombre: `${a.nombres} ${a.apellidos}`.trim(),
        estamento: a.funcionVtf === 'Función Directiva'
          ? 'DIRECTIVA'
          : a.esTecnicoParvulo || a.estamento === 'TECNICO'
          ? 'TECNICO'
          : 'OTRO_ASISTENTE',
        horas: a.horasContrato || 44,
      });
    }
    return lista;
  }, [docentes, asistentes]);

  const handleAbrirFormNivel = (editItem?: JiscNivelParvularia) => {
    if (editItem) {
      setEditNivelId(editItem.id);
      setNivelSubtipo(editItem.subtipoNivel);
      setNivelNombre(editItem.nivelNombre);
      setNivelCapacidad(editItem.capacidadAutorizada);
      setNivelMatricula(editItem.matriculaActiva);
      setNivelEdadMin(editItem.edadMesesMin ?? 26);
      setNivelEdadMax(editItem.edadMesesMax ?? 47);
      setNivelExt(editItem.tieneExtensionHoraria);
      setNivelMatExt(editItem.matriculaExtension || 0);
    } else {
      setEditNivelId(null);
      setNivelSubtipo('MEDIO_HETEROGENEO');
      setNivelNombre('Nivel Medio Mixto');
      setNivelCapacidad(28);
      setNivelMatricula(24);
      setNivelEdadMin(24);
      setNivelEdadMax(47);
      setNivelExt(false);
      setNivelMatExt(0);
    }
    setFormNivelOpen(true);
  };

  const handleGuardarNivel = async (e: React.FormEvent) => {
    e.preventDefault();
    const correl = editNivelId
      ? (nivelesJisc.find((n) => n.id === editNivelId)?.correlGrupo || 1)
      : (nivelesJisc.reduce((m, n) => Math.max(m, n.correlGrupo), 0) + 1);
    const id = editNivelId || `jisc_niv_${colegio.rbd}_${periodoActivo}_g${correl}_${Date.now()}`;
    const prev = editNivelId ? nivelesJisc.find((n) => n.id === editNivelId) : undefined;
    const item: JiscNivelParvularia = {
      id,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      codigoUeJunji: colegio.codigoJunji,
      correlGrupo: correl,
      nivelNombre: nivelNombre.trim() || COEFICIENTES_DS115_2012[nivelSubtipo].etiqueta,
      subtipoNivel: nivelSubtipo,
      esHeterogeneo: nivelSubtipo.includes('HETEROGEN'),
      capacidadAutorizada: Number(nivelCapacidad) || 20,
      matriculaActiva: Number(nivelMatricula) || 0,
      retiros: prev?.retiros || 0,
      asistenciaPromedio: prev?.asistenciaPromedio || 0,
      edadMesesMin: Number(nivelEdadMin),
      edadMesesMax: Number(nivelEdadMax),
      edadMinimaCriterio: Number(nivelEdadMin),
      jornada: 'COMPLETA',
      horarioInicio: colegio.horarioApertura || '08:30',
      horarioFin: nivelExt ? (colegio.horarioExtensionCierre || '19:30') : (colegio.horarioCierre || '16:30'),
      tieneExtensionHoraria: nivelExt,
      matriculaExtension: nivelExt ? Number(nivelMatExt || 0) : 0,
      educadorasAsignadasJisc: prev?.educadorasAsignadasJisc || 0,
      tecnicosAsignadosJisc: prev?.tecnicosAsignadosJisc || 0,
      directorasAsignadasJisc: prev?.directorasAsignadasJisc || 0,
      fuenteDato: 'MANUAL',
    };

    await guardarJiscNivelesBatch([item]);
    // Sincronizar hacia cursos_sae para mantener compatibilidad territorial
    const esSc = nivelSubtipo.startsWith('SALA_CUNA');
    const letra = correl <= 26 ? String.fromCharCode(64 + correl) : String(correl);
    await guardarCursosBatch([
      {
        id: `cur_jisc_${colegio.rbd}_${periodoActivo}_g${correl}`,
        rbd: colegio.rbd,
        periodo: periodoActivo,
        nivel: item.nivelNombre,
        letra,
        regimen: 'No JEC',
        regimenProporcion: '65_35',
        cupoSae: item.capacidadAutorizada,
        matriculaProyectada: item.matriculaActiva,
        alumnosNeet: 0,
        alumnosNeep: 0,
        tipoModalidad: esSc ? 'SALA_CUNA' : 'PARVULARIA_VTF',
        edadMesesMinima: item.edadMesesMin,
        edadMesesMaxima: item.edadMesesMax,
        codigoGrupoJisc: String(correl),
        horarioJornada: `${item.horarioInicio}-${item.horarioFin}`,
        tieneExtensionHoraria: item.tieneExtensionHoraria,
        matriculaExtension: item.matriculaExtension,
        jornadaNivel: 'COMPLETA',
      },
    ]);

    setFormNivelOpen(false);
    setEstadoMsg({ text: `Nivel "${item.nivelNombre}" guardado y sincronizado con coeficientes D.S. 115.`, type: 'ok' });
    await cargarDatosVtf();
    onRefreshData?.();
  };

  const handleEliminarNivel = async (nivel: JiscNivelParvularia) => {
    await eliminarJiscNivel(nivel.id);
    await cargarDatosVtf();
    onRefreshData?.();
  };

  const handleGuardarTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnoNombre.trim()) return;
    const turnoObj: TurnoParvulariaVtf = {
      id: `turno_${colegio.rbd}_${periodoActivo}_${Date.now()}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      nivelJiscId: turnoNivelId || undefined,
      runFuncionario: turnoRun.trim() || 'SIN-RUN',
      nombreFuncionario: turnoNombre.trim(),
      estamentoVtf: turnoEstamento,
      diasSemana: 'L-V',
      horaEntrada: turnoEntrada,
      horaSalida: turnoSalida,
      minutosColacion: Number(turnoColacion) || 45,
      franja: turnoFranja,
      horasSemanalesCronologicas: turnoFranja === 'EXTENSION' ? 15 : 44,
    };
    await guardarTurnosVtfBatch([turnoObj]);
    setTurnoOpen(false);
    setTurnoNombre('');
    setTurnoRun('');
    setEstadoMsg({ text: `Turno horario (${turnoEntrada}-${turnoSalida}) registrado para ${turnoObj.nombreFuncionario}.`, type: 'ok' });
    await cargarDatosVtf();
  };

  const handleUploadJiscFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setImportando(true);
    setEstadoMsg(null);
    try {
      const files: Array<{ name: string; buffer: ArrayBuffer }> = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        files.push({ name: f.name, buffer: await f.arrayBuffer() });
      }
      const res = await ingestarArchivosJisc(files, periodoActivo);
      setEstadoMsg({
        text: `Ingesta JISC completada: ${res.nivelesActualizados} niveles, ${res.parvulosB3Cargados} párvulos B3, ${res.directorasSincronizadas} directoras, ${res.establecimientosActualizados} establecimientos.`,
        type: res.alertas.length > 0 ? 'warn' : 'ok',
      });
      await cargarDatosVtf();
      onRefreshData?.();
    } catch (err: any) {
      setEstadoMsg({ text: `Error importando JISC: ${err?.message || String(err)}`, type: 'err' });
    } finally {
      setImportando(false);
    }
  };

  const handleUploadPalVtf = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setImportando(true);
    setEstadoMsg(null);
    try {
      const buf = await fileList[0].arrayBuffer();
      const res = await importarPlanillaPalDEP(buf, periodoActivo);
      setEstadoMsg({
        text: `PAL 2027 importada: ${res.vtfImportados} funcionarios VTF sincronizados (+${res.docentesImportados} docentes, +${res.asistentesImportados} AE).`,
        type: 'ok',
      });
      await cargarDatosVtf();
      onRefreshData?.();
    } catch (err: any) {
      setEstadoMsg({ text: `Error importando PAL 2027: ${err?.message || String(err)}`, type: 'err' });
    } finally {
      setImportando(false);
    }
  };

  const handleToggleExtensionEstablecimiento = async () => {
    if (!onGuardarColegio) return;
    const tieneExt = Boolean(colegio.horarioExtensionCierre);
    await onGuardarColegio({
      ...colegio,
      horarioApertura: colegio.horarioApertura || '08:30',
      horarioCierre: colegio.horarioCierre || '16:30',
      horarioExtensionInicio: tieneExt ? undefined : '16:30',
      horarioExtensionCierre: tieneExt ? undefined : '19:30',
    });
  };

  return (
    <div className="space-y-4">
      {/* Encabezado Ejecutivo Jardín Infantil / Sala Cuna VTF */}
      <div className="card-elevated p-4 border-l-4 border-l-pink-500">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-pink-100 text-pink-800 border border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800">
                <Baby className="w-3.5 h-3.5" />
                Modalidad VTF / JISC · D.S. 315 &amp; D.S. 115
              </span>
              {colegio.codigoJunji && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Cód. UE JUNJI: {colegio.codigoJunji}
                </span>
              )}
              {colegio.localidad && (
                <span className="text-xs text-slate-500 font-semibold">
                  📍 {colegio.localidad} ({colegio.comuna})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cálculo normativo basado en jornada cronológica (44/45 hrs), coeficiente técnico por niño de menor edad y cobertura de turnos <strong>{colegio.horarioApertura || '08:30'}–{colegio.horarioExtensionCierre || colegio.horarioCierre || '16:30'}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onGuardarColegio && (
              <button
                type="button"
                onClick={handleToggleExtensionEstablecimiento}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  colegio.horarioExtensionCierre
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                    : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{colegio.horarioExtensionCierre ? 'Extensión 16:30–19:30 Activa' : 'Activar Extensión Horaria'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSubTab('ingesta')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar JISC / PAL VTF</span>
            </button>
          </div>
        </div>

        {/* KPIs D.S. 115 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Matrícula / Cupo</div>
            <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
              {diagnosticoVtf.matriculaTotal} <span className="text-xs font-semibold text-slate-400">/ {diagnosticoVtf.capacidadTotal}</span>
            </div>
            <div className="text-[10px] text-slate-500">{diagnosticoVtf.ocupacionPorcentaje}% ocupación ({diagnosticoVtf.totalNiveles} niveles)</div>
          </div>

          <div className={`p-3 rounded-xl border ${diagnosticoVtf.deltaDirectoras >= 0 ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'}`}>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Dirección VTF</div>
            <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
              {diagnosticoVtf.directorasAsignadas} <span className="text-xs font-semibold text-slate-500">/ {diagnosticoVtf.directorasRequeridas} req.</span>
            </div>
            <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              {colegio.director ? `Dir: ${colegio.director}` : 'Sin directora asignada'}
            </div>
          </div>

          <div className={`p-3 rounded-xl border ${diagnosticoVtf.deltaEducadoras >= 0 ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'}`}>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Educadoras (D.S. 115)</div>
            <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
              {diagnosticoVtf.educadorasAsignadas} <span className="text-xs font-semibold text-slate-500">/ {diagnosticoVtf.educadorasRequeridasTotal} req.</span>
            </div>
            <div className={`text-[10px] font-bold ${diagnosticoVtf.deltaEducadoras >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {diagnosticoVtf.deltaEducadoras >= 0 ? `✓ Cubierto (+${diagnosticoVtf.deltaEducadoras})` : `⚠ Déficit de ${Math.abs(diagnosticoVtf.deltaEducadoras)}`}
            </div>
          </div>

          <div className={`p-3 rounded-xl border ${diagnosticoVtf.deltaTecnicos >= 0 ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'}`}>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Técnicos Párvulos</div>
            <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
              {diagnosticoVtf.tecnicosAsignados} <span className="text-xs font-semibold text-slate-500">/ {diagnosticoVtf.tecnicosRequeridosTotal} req.</span>
            </div>
            <div className={`text-[10px] font-bold ${diagnosticoVtf.deltaTecnicos >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {diagnosticoVtf.deltaTecnicos >= 0 ? `✓ Cubierto (+${diagnosticoVtf.deltaTecnicos})` : `⚠ Déficit de ${Math.abs(diagnosticoVtf.deltaTecnicos)}`}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Otros Asistentes</div>
            <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
              {diagnosticoVtf.otrosAsistentesAsignados}
            </div>
            <div className="text-[10px] text-slate-500">Auxiliares / Admin. PAL VTF</div>
          </div>
        </div>
      </div>

      {estadoMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border ${
            estadoMsg.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800'
              : estadoMsg.type === 'warn'
              ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800'
          }`}
        >
          <span>{estadoMsg.text}</span>
          <button onClick={() => setEstadoMsg(null)} className="underline text-[11px]">Cerrar</button>
        </div>
      )}

      {/* Sub-navegación interna VTF */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-fit">
        {[
          { id: 'resumen', label: 'Diagnóstico D.S. 115', icon: CheckCircle2 },
          { id: 'niveles', label: `Niveles BCEP (${nivelesJisc.length || cursos.length})`, icon: GraduationCap },
          { id: 'turnos', label: `Turnos 08:30–19:30 (${turnos.length})`, icon: CalendarClock },
          { id: 'proyeccion', label: `Proyección 2027 (${parvulosB3.length} B3)`, icon: TrendingUp },
          { id: 'ingesta', label: 'Ingesta JISC / PAL VTF', icon: FileSpreadsheet },
        ].map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as any)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                active
                  ? 'bg-white dark:bg-slate-900 text-pink-700 dark:text-pink-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {cargando ? (
        <div className="card-elevated p-8 text-center text-xs text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-pink-500" />
          Cargando estructura de Jardín Infantil / Sala Cuna...
        </div>
      ) : (
        <>
          {/* SUBTAB 1: RESUMEN Y BRECHAS */}
          {subTab === 'resumen' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card-elevated p-4 space-y-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-pink-600" />
                  <span>Alertas Normativas D.S. 315 / D.S. 115 / D.S. 548</span>
                </h3>
                {diagnosticoVtf.alertas.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
                    {nivelesParaMotor.length === 0
                      ? 'Sin niveles configurados aún. Crea un nivel en "Niveles BCEP" o importa tus planillas de Plataforma JISC.'
                      : '✓ Cumplimiento íntegro de coeficientes técnicos y capacidad autorizada para todos los grupos activos.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {diagnosticoVtf.alertas.map((a, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                  {onSelectTab && (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelectTab('docentes')}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                      >
                        Ver Educadoras / Dirección ({docentes.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectTab('asistentes')}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                      >
                        Ver Técnicos y Auxiliares ({asistentes.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectTab('salas')}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                      >
                        Salas D.S. 548 ({salas.length})
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="card-elevated p-4 space-y-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Cálculo por Nivel / Grupo y Regla Niño Menor</span>
                </h3>
                {diagnosticoVtf.requeridoPorNivel.length === 0 ? (
                  <p className="text-xs text-slate-500">Agrega niveles o importa el reporte B3 / Matrícula por nivel JISC para calcular la dotación requerida.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[11px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <th className="py-2 pr-2">Nivel / Grupo</th>
                          <th className="py-2 px-2 text-right">Mat/Cap</th>
                          <th className="py-2 px-2">Criterio Aplicado</th>
                          <th className="py-2 px-2 text-right">Edu.</th>
                          <th className="py-2 pl-2 text-right">Téc. Req.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {diagnosticoVtf.requeridoPorNivel.map((r) => (
                          <tr key={r.nivelId}>
                            <td className="py-2 pr-2 font-bold text-slate-900 dark:text-white">
                              {r.nivelNombre}
                              {r.reglaEdadMinimaAplicada && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px]">
                                  Edad mín. aplicada
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right font-mono tabular-nums">
                              {r.matriculaActiva}/{r.capacidadAutorizada}
                            </td>
                            <td className="py-2 px-2 text-slate-600 dark:text-slate-300">
                              1 Edu/{r.reglaAplicada.educadoraPorNinos} · 1 Téc/{r.reglaAplicada.tecnicoPorNinos}
                            </td>
                            <td className="py-2 px-2 text-right font-bold">{r.educadorasRequeridasGrupo}</td>
                            <td className="py-2 pl-2 text-right font-black text-pink-700 dark:text-pink-300">{r.tecnicosRequeridosGrupo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUBTAB 2: GESTIÓN DE NIVELES BCEP / JISC */}
          {subTab === 'niveles' && (
            <div className="card-elevated p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Niveles y Grupos Educativos (BCEP 2018 / Plataforma JISC)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cada nivel se sincroniza con Cursos SAE y determina las horas cronológicas de atención y coeficientes D.S. 115.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAbrirFormNivel()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Nivel / Grupo</span>
                </button>
              </div>

              {formNivelOpen && (
                <form onSubmit={handleGuardarNivel} className="p-4 rounded-xl bg-pink-50/60 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Subtipo Normativo BCEP</label>
                      <select
                        value={nivelSubtipo}
                        onChange={(e) => {
                          const s = e.target.value as SubtipoNivelJisc;
                          setNivelSubtipo(s);
                          const regla = COEFICIENTES_DS115_2012[s];
                          setNivelNombre(regla.etiqueta.split('(')[0].trim());
                          setNivelCapacidad(regla.capacidadMaxSalaOperativa);
                          setNivelEdadMin(regla.edadMinMesesSugerida);
                          setNivelEdadMax(regla.edadMaxMesesSugerida);
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                      >
                        {SUBTIPOS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre Visible del Grupo</label>
                      <input
                        type="text"
                        required
                        value={nivelNombre}
                        onChange={(e) => setNivelNombre(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Capacidad</label>
                        <input
                          type="number"
                          min={1}
                          max={45}
                          value={nivelCapacidad}
                          onChange={(e) => setNivelCapacidad(Number(e.target.value))}
                          className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Matrícula Activa</label>
                        <input
                          type="number"
                          min={0}
                          max={45}
                          value={nivelMatricula}
                          onChange={(e) => setNivelMatricula(Number(e.target.value))}
                          className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Edad Mín. (meses)</label>
                      <input
                        type="number"
                        min={1}
                        max={84}
                        value={nivelEdadMin}
                        onChange={(e) => setNivelEdadMin(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Edad Máx. (meses)</label>
                      <input
                        type="number"
                        min={1}
                        max={84}
                        value={nivelEdadMax}
                        onChange={(e) => setNivelEdadMax(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 pt-4">
                      <input
                        type="checkbox"
                        checked={nivelExt}
                        onChange={(e) => setNivelExt(e.target.checked)}
                        className="rounded border-slate-300 text-pink-600"
                      />
                      <span>Extensión Horaria (16:30–19:30)</span>
                    </label>
                    {nivelExt && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Párvulos Extensión</label>
                        <input
                          type="number"
                          min={0}
                          max={45}
                          value={nivelMatExt}
                          onChange={(e) => setNivelMatExt(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setFormNivelOpen(false)} className="px-3 py-1.5 text-xs font-bold text-slate-600">
                      Cancelar
                    </button>
                    <button type="submit" className="px-4 py-1.5 rounded-lg bg-pink-600 text-white text-xs font-bold hover:bg-pink-700">
                      Guardar Nivel
                    </button>
                  </div>
                </form>
              )}

              {nivelesJisc.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-500">
                  Este jardín aún no tiene niveles JISC registrados. Haz clic en <strong>Agregar Nivel / Grupo</strong> o sube tus libros Excel desde <strong>Ingesta JISC / PAL VTF</strong>.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2 pr-2">Grupo</th>
                        <th className="py-2 px-2">Subtipo</th>
                        <th className="py-2 px-2 text-right">Matrícula / Cap.</th>
                        <th className="py-2 px-2 text-center">Rango Etario</th>
                        <th className="py-2 px-2 text-center">Asistencia</th>
                        <th className="py-2 px-2 text-center">Jornada</th>
                        <th className="py-2 px-2 text-right">Dotación JISC</th>
                        <th className="py-2 pl-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {nivelesJisc.map((n) => (
                        <tr key={n.id}>
                          <td className="py-2.5 pr-2 font-bold text-slate-900 dark:text-white">
                            #{n.correlGrupo} · {n.nivelNombre}
                          </td>
                          <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">{n.subtipoNivel}</td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold tabular-nums">
                            {n.matriculaActiva} / {n.capacidadAutorizada}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono">
                            {n.edadMesesMin !== undefined ? `${n.edadMesesMin}–${n.edadMesesMax ?? '?'} m` : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {n.asistenciaPromedio ? `${n.asistenciaPromedio}%` : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                              {n.horarioInicio}–{n.horarioFin}
                            </span>
                            {n.tieneExtensionHoraria && (
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                                +Ext ({n.matriculaExtension})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-[11px]">
                            {n.educadorasAsignadasJisc}E / {n.tecnicosAsignadosJisc}T
                          </td>
                          <td className="py-2.5 pl-2 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => handleAbrirFormNivel(n)}
                              className="px-2 py-1 text-[11px] font-bold text-blue-600 hover:underline"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminarNivel(n)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                              title="Eliminar nivel"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 3: GRILLA DE TURNOS 08:30-19:30 */}
          {subTab === 'turnos' && (
            <div className="card-elevated p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Cobertura de Turnos y Extensión Horaria (08:30–19:30)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verifica presencia continua de Educadoras y Técnicos de Párvulos en bloque mañana, tarde y extensión vespertina.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTurnoOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Asignar Turno</span>
                </button>
              </div>

              {/* Semáforo de franjas horarias */}
              {diagnosticoVtf.coberturaTurnos && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {diagnosticoVtf.coberturaTurnos.franjas.map((f, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border ${
                        f.cumpleCoberturaBasica
                          ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                          : 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white">{f.etiqueta}</span>
                        <span className="text-[11px] font-mono font-bold text-slate-600">{f.franjaInicio}–{f.franjaFin}</span>
                      </div>
                      <div className="mt-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {f.educadorasActivas} Educadora(s) · {f.tecnicosActivos} Técnico(s) · {f.directivasActivas} Dir.
                      </div>
                      <div className={`text-[10px] font-bold mt-1 ${f.cumpleCoberturaBasica ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {f.cumpleCoberturaBasica ? '✓ Cobertura normativa OK' : '⚠ Requiere asignación de personal en este bloque'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {turnoOpen && (
                <form onSubmit={handleGuardarTurno} className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-3">
                  {personalCombinadoTurnos.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Autocompletar desde Nómina VTF del Establecimiento
                      </label>
                      <select
                        onChange={(e) => {
                          const chosen = personalCombinadoTurnos.find((p) => p.run === e.target.value);
                          if (chosen) {
                            setTurnoRun(chosen.run);
                            setTurnoNombre(chosen.nombre);
                            setTurnoEstamento(chosen.estamento);
                          }
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- Seleccionar funcionario o ingresar manual --</option>
                        {personalCombinadoTurnos.map((p, i) => (
                          <option key={`${p.run}_${i}`} value={p.run}>
                            {p.nombre} ({p.run}) · {p.estamento} · {p.horas}h
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre / Cargo</label>
                      <input
                        type="text"
                        required
                        value={turnoNombre}
                        onChange={(e) => setTurnoNombre(e.target.value)}
                        placeholder="Ej: Técnico Nivel Medio"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Estamento</label>
                      <select
                        value={turnoEstamento}
                        onChange={(e) => setTurnoEstamento(e.target.value as any)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                      >
                        <option value="EDUCADORA">Educadora de Párvulos</option>
                        <option value="TECNICO">Técnico de Párvulos</option>
                        <option value="DIRECTIVA">Función Directiva</option>
                        <option value="OTRO_ASISTENTE">Otro Asistente / Auxiliar</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Entrada / Salida</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={turnoEntrada}
                          onChange={(e) => setTurnoEntrada(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                        <input
                          type="time"
                          value={turnoSalida}
                          onChange={(e) => setTurnoSalida(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Franja / Nivel</label>
                      <select
                        value={turnoFranja}
                        onChange={(e) => setTurnoFranja(e.target.value as any)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                      >
                        <option value="REGULAR">Jornada Regular (08:30–16:30)</option>
                        <option value="EXTENSION">Extensión Horaria (16:30–19:30)</option>
                        <option value="MIXTO">Turno Rotativo Mixto</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Nivel Asignado (Opcional)</label>
                      <select
                        value={turnoNivelId}
                        onChange={(e) => setTurnoNivelId(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      >
                        <option value="">General del Jardín</option>
                        {nivelesJisc.map((n) => (
                          <option key={n.id} value={n.id}>#{n.correlGrupo} · {n.nivelNombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Colación (min/día)</label>
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={turnoColacion}
                        onChange={(e) => setTurnoColacion(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <button type="button" onClick={() => setTurnoOpen(false)} className="px-3 py-1.5 text-xs font-bold text-slate-600">
                        Cancelar
                      </button>
                      <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">
                        Guardar Turno
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {turnos.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                  Sin turnos asignados aún. Registra los horarios de entrada/salida (ej. 08:30–17:30 y 10:30–19:30 para extensión).
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2 pr-2">Funcionario</th>
                        <th className="py-2 px-2">Estamento</th>
                        <th className="py-2 px-2">Franja</th>
                        <th className="py-2 px-2 text-center">Horario</th>
                        <th className="py-2 px-2 text-right">Hrs Sem.</th>
                        <th className="py-2 pl-2 text-right">Quitar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {turnos.map((t) => (
                        <tr key={t.id}>
                          <td className="py-2 pr-2 font-bold text-slate-900 dark:text-white">
                            {t.nombreFuncionario || t.runFuncionario}
                            <span className="ml-2 text-[10px] font-mono text-slate-400">{t.runFuncionario}</span>
                          </td>
                          <td className="py-2 px-2">{t.estamentoVtf}</td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.franja === 'EXTENSION' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {t.franja}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold">
                            {t.horaEntrada}–{t.horaSalida}
                          </td>
                          <td className="py-2 px-2 text-right font-mono">{t.horasSemanalesCronologicas}h</td>
                          <td className="py-2 pl-2 text-right">
                            <button
                              type="button"
                              onClick={async () => {
                                await eliminarTurnoVtf(t.id);
                                await cargarDatosVtf();
                              }}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 4: PROYECCIÓN INTERANUAL 2027 */}
          {subTab === 'proyeccion' && (
            <div className="card-elevated p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Proyección de Cohorte Etaria +12 Meses (Período Siguiente)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Calculado sobre los {parvulosB3.length} párvulos del archivo nominal JISC B3 excluyendo niños con fecha de retiro.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Activos Base B3</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{proyeccion2027.matriculaActualActiva}</div>
                </div>
                <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800">
                  <div className="text-[10px] font-bold uppercase text-pink-700">Sala Cuna Mayor (12-23m)</div>
                  <div className="text-xl font-black text-pink-900 dark:text-pink-200 mt-0.5">{proyeccion2027.proyectadosSalaCunaMayor}</div>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                  <div className="text-[10px] font-bold uppercase text-indigo-700">Medio Menor (24-35m)</div>
                  <div className="text-xl font-black text-indigo-900 dark:text-indigo-200 mt-0.5">{proyeccion2027.proyectadosMedioMenor}</div>
                </div>
                <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                  <div className="text-[10px] font-bold uppercase text-sky-700">Medio Mayor (36-47m)</div>
                  <div className="text-xl font-black text-sky-900 dark:text-sky-200 mt-0.5">{proyeccion2027.proyectadosMedioMayor}</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="text-[10px] font-bold uppercase text-amber-800">Egresan a NT1 Escuela</div>
                  <div className="text-xl font-black text-amber-900 dark:text-amber-200 mt-0.5">{proyeccion2027.egresanANt1Escuela}</div>
                </div>
              </div>

              {proyeccion2027.alertasProyeccion.map((msg, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {msg}
                </div>
              ))}
            </div>
          )}

          {/* SUBTAB 5: INGESTA MULTI-LIBRO JISC & PAL VTF */}
          {subTab === 'ingesta' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card-elevated p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-pink-600" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    1. Ingesta Multi-Libro Plataforma JISC (.xlsx)
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Selecciona simultáneamente uno o todos los libros de la carpeta <strong>Plataforma JISC</strong>:
                  {' '}<code>Base de datos JISC 2026</code>, <code>Directoras SC_JI Cohorte 2023</code>,
                  {' '}<code>Matricula por nivel</code>, <code>Planilla dotación JISC</code> y <code>B3 SLEP VALLE DIGUILLIN</code>.
                  El motor unifica los 42 jardines, resuelve alias RBD (34646 → 36646), calcula edad mínima real y crea automáticamente los niveles en la base de datos.
                </p>
                <input
                  ref={fileJiscRef}
                  type="file"
                  accept=".xlsx"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUploadJiscFiles(e.target.files)}
                />
                <button
                  type="button"
                  disabled={importando}
                  onClick={() => fileJiscRef.current?.click()}
                  className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>{importando ? 'Procesando libros JISC...' : 'Seleccionar uno o más libros JISC (.xlsx)'}</span>
                </button>
              </div>

              <div className="card-elevated p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    2. Ingesta Nómina PAL 2027 · Info Funcionario (VTF)
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Importa la planilla oficial <strong>PAL 2027 DEP</strong> leyendo la pestaña{' '}
                  <code>Info Funcionario (VTF)</code> (451 funcionarios territoriales VTF: Dirección, Educadoras de Párvulos, Técnicos de Párvulos y Otros Asistentes), preservando la exportación oficial con fórmulas <code>COUNTIFS</code> en la hoja <code>Resumen</code>.
                </p>
                <input
                  ref={filePalVtfRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => handleUploadPalVtf(e.target.files)}
                />
                <button
                  type="button"
                  disabled={importando}
                  onClick={() => filePalVtfRef.current?.click()}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>{importando ? 'Importando PAL 2027...' : 'Seleccionar Planilla PAL 2027 (.xlsx)'}</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
