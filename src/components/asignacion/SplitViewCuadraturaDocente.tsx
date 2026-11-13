import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  GripVertical,
  Layers,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2
} from 'lucide-react';
import { AsignacionHoraria, CursoSae, Docente, Establecimiento } from '../../types';
import { esNivelParvulario } from '@slep/mineduc-engine';
import { auditarCargaDocenteIntegral } from '../../services/auditoriaDocenteService';
import {
  calcularDisponibilidadCurso,
  calcularEstadoCursosParvularios,
  resolverPlanCurso,
  sonAsignaturasEquivalentes
} from '../../services/curricularPlanService';
import { useAsignacionDocente } from '../../hooks/useAsignacionDocente';
import { AsignacionQuickPopover, QuickPopoverSeed } from './AsignacionQuickPopover';

interface SplitViewCuadraturaDocenteProps {
  colegio: Establecimiento;
  docentes: Docente[];
  cursos: CursoSae[];
  asignaciones: AsignacionHoraria[];
  periodoActivo: number;
  onGuardarAsignacion?: (a: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion?: (id: string) => Promise<void> | void;
  onAbrirDrawerDocente?: (d: Docente) => void;
}

interface VacanteItem {
  curso: CursoSae;
  asignatura: string;
  horasPlan: number;
  horasAsignadas: number;
  horasDisponibles: number;
  esLibreJec?: boolean;
  esParvularia?: boolean;
  esCoDocenciaParvularia?: boolean;
  notaParvularia?: string;
}

export const SplitViewCuadraturaDocente: React.FC<SplitViewCuadraturaDocenteProps> = ({
  colegio,
  docentes,
  cursos,
  asignaciones,
  periodoActivo,
  onGuardarAsignacion,
  onEliminarAsignacion,
  onAbrirDrawerDocente
}) => {
  const [docenteActivoId, setDocenteActivoId] = useState<string>(docentes[0]?.id || '');
  const [busquedaDoc, setBusquedaDoc] = useState('');
  const [filtroDoc, setFiltroDoc] = useState<'TODOS' | 'LIBRES' | 'EXCEDIDOS' | 'SEP_PIE'>('LIBRES');
  const [agrupacion, setAgrupacion] = useState<'ASIGNATURA' | 'CURSO'>('ASIGNATURA');
  const [busquedaVacante, setBusquedaVacante] = useState('');
  const [soloEnfoqueParvulario, setSoloEnfoqueParvulario] = useState<boolean>(true);
  const [popoverSeed, setPopoverSeed] = useState<QuickPopoverSeed | null>(null);
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);

  const docenteActivo = useMemo(
    () => docentes.find(d => d.id === docenteActivoId) || docentes[0] || null,
    [docentes, docenteActivoId]
  );

  const {
    planesDb,
    asignacionesDocente,
    materiasAfines,
    saldoPorFuente,
    resumenNormativo,
    simular,
    crearAsignacion,
    eliminar
  } = useAsignacionDocente(
    docenteActivo,
    colegio,
    cursos,
    asignaciones,
    periodoActivo,
    onGuardarAsignacion,
    onEliminarAsignacion,
    docentes
  );

  const cursosMap = useMemo(() => new Map(cursos.map(c => [c.id, c])), [cursos]);

  // Resumen unificado de cada docente (incluye Parvularia 60m, SEP, PIE, Recreo, HNL y 40% Planif.)
  const docentesResumen = useMemo(() => {
    return docentes.map(d => {
      const propias = asignaciones.filter(a => a.docenteId === d.id);
      const coDoc = asignaciones.filter(a => a.coDocenteId === d.id && a.tieneCoDocente);
      const integral = auditarCargaDocenteIntegral(
        d,
        propias,
        coDoc,
        cursosMap,
        colegio.porcentajePrioritarios || 0
      );
      const contratoSep = Number(d.horasSepTitular || 0) + Number(d.horasSepContrata || 0);
      const contratoPie = Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0);
      const esSepPie = contratoSep + contratoPie > 0 || integral.reqSepDoc > 0 || integral.pieAsignadasDoc > 0;
      const haAsignadas = Math.round(integral.haDocenciaEfectiva * 100) / 100;
      const maxAula = Math.round(integral.maxHAPermitidas * 100) / 100;
      const libresAula = Math.max(0, Math.round((maxAula - haAsignadas) * 100) / 100);
      return {
        docente: d,
        saldo: integral.saldoHoras,
        esSepPie,
        totalAsigs: propias.length + coDoc.length,
        isEducadora: integral.isEducadoraParvulo,
        haAsignadas,
        maxAula,
        libresAula,
        contratoSep,
        sepAsignado: integral.reqSepDoc,
        contratoPie,
        pieAsignado: integral.pieAsignadasDoc,
        minutosRecreo: integral.auditDoc.minutosRecreoTotal,
        minutosHnl: integral.auditDoc.minutosHnlTotal,
        minutosPlan40: integral.auditDoc.minutosHnlPlanificacion40
      };
    });
  }, [docentes, asignaciones, cursosMap, colegio.porcentajePrioritarios]);

  const mapaParvulario = useMemo(
    () =>
      calcularEstadoCursosParvularios(
        cursos,
        docentes,
        asignaciones,
        colegio.porcentajePrioritarios || 0,
        colegio.regimenProporcion
      ),
    [cursos, docentes, asignaciones, colegio.porcentajePrioritarios, colegio.regimenProporcion]
  );

  const otrasEducadorasConSaldo = useMemo(() => {
    return docentesResumen
      .filter(r => r.isEducadora && r.docente.id !== docenteActivo?.id && r.libresAula > 0.05)
      .sort((a, b) => b.libresAula - a.libresAula);
  }, [docentesResumen, docenteActivo?.id]);

  const docentesFiltrados = useMemo(() => {
    const q = busquedaDoc.trim().toLowerCase();
    return docentesResumen
      .filter(({ docente, saldo, esSepPie }) => {
        if (q && !`${docente.nombres} ${docente.apellidos} ${docente.asignaturaPrincipal || ''} ${docente.run}`.toLowerCase().includes(q)) {
          return false;
        }
        if (filtroDoc === 'LIBRES') return saldo > 0.05;
        if (filtroDoc === 'EXCEDIDOS') return saldo < -0.05;
        if (filtroDoc === 'SEP_PIE') return esSepPie;
        return true;
      })
      .sort((a, b) => a.docente.apellidos.localeCompare(b.docente.apellidos));
  }, [docentesResumen, busquedaDoc, filtroDoc]);

  // Vacantes del establecimiento (unificado: HA 45m para Básica/Media y Permanencia DTO 306 en 60m para Parvularia)
  const vacantes = useMemo(() => {
    const lista: VacanteItem[] = [];
    const mapaParv = calcularEstadoCursosParvularios(
      cursos,
      docentes,
      asignaciones,
      colegio.porcentajePrioritarios || 0,
      colegio.regimenProporcion
    );
    for (const c of cursos) {
      if (esNivelParvulario(c.nivel)) {
        const estadoParv = mapaParv.get(c.id);
        if (estadoParv && !estadoParv.resultado.coberturaCompletaPermanencia) {
          const res = estadoParv.resultado;
          const faltaHoras = Math.round((res.minutosDeficitRestante / 60) * 100) / 100;
          const esTitularActiva = Boolean(docenteActivo && estadoParv.titularDocente?.id === docenteActivo.id);
          const hrsSugeridas = esTitularActiva && res.horasRestantesCapacidadTitular > 0
            ? Math.min(res.horasRestantesCapacidadTitular, faltaHoras)
            : res.horasAulaSegundaEducadoraRestante || faltaHoras;
          lista.push({
            curso: c,
            asignatura: res.segundaEducadoraRequerida && !esTitularActiva
              ? 'Atención Directa y Co-Docencia Parvularia (DTO 306)'
              : 'Atención Directa Parvularia (BCEP Integral)',
            horasPlan: Math.round((res.permanenciaMinutos / 60) * 100) / 100,
            horasAsignadas: Math.round((res.minutosCubiertosTotales / 60) * 100) / 100,
            horasDisponibles: Math.max(0.5, Math.round(hrsSugeridas * 100) / 100),
            esParvularia: true,
            esCoDocenciaParvularia: res.segundaEducadoraRequerida && !esTitularActiva,
            notaParvularia: `DTO 306 (${res.regimenNormativoProporcion === '60_40' ? '60/40' : '65/35'}) · Falta ${res.minutosDeficitRestanteTexto}`
          });
        }
        continue;
      }

      const plan = resolverPlanCurso(c, planesDb);
      const disp = calcularDisponibilidadCurso(c, plan, asignaciones);
      for (const d of disp.disponibles) {
        lista.push({
          curso: c,
          asignatura: d.nombre,
          horasPlan: d.horasPlan,
          horasAsignadas: d.horasAsignadas,
          horasDisponibles: d.horasDisponibles
        });
      }
      if (disp.horasLibreDisponibles > 0) {
        lista.push({
          curso: c,
          asignatura: 'Taller JEC / Libre Disposición',
          horasPlan: disp.horasLibrePlan,
          horasAsignadas: disp.horasLibreAsignadas,
          horasDisponibles: disp.horasLibreDisponibles,
          esLibreJec: true
        });
      }
    }
    return lista;
  }, [cursos, docentes, planesDb, asignaciones, colegio.porcentajePrioritarios, colegio.regimenProporcion, docenteActivo]);

  const vacantesFiltradas = useMemo(() => {
    const q = busquedaVacante.trim().toLowerCase();
    return vacantes.filter(v => {
      if (resumenNormativo?.esEducadora && soloEnfoqueParvulario && !v.esParvularia) {
        return false;
      }
      if (!q) return true;
      return (
        v.asignatura.toLowerCase().includes(q) ||
        `${v.curso.nivel} ${v.curso.letra}`.toLowerCase().includes(q)
      );
    });
  }, [vacantes, busquedaVacante, resumenNormativo?.esEducadora, soloEnfoqueParvulario]);

  const gruposVacantes = useMemo(() => {
    const map = new Map<string, { titulo: string; subtitulo: string; esAfin: boolean; items: VacanteItem[] }>();
    for (const v of vacantesFiltradas) {
      const key = agrupacion === 'ASIGNATURA' ? v.asignatura : v.curso.id;
      const esAfin = materiasAfines.some(m => sonAsignaturasEquivalentes(v.asignatura, m));
      const existing = map.get(key);
      if (existing) {
        existing.items.push(v);
        if (esAfin) existing.esAfin = true;
      } else {
        map.set(key, {
          titulo: agrupacion === 'ASIGNATURA' ? v.asignatura : `${v.curso.nivel} ${v.curso.letra}`,
          subtitulo: agrupacion === 'ASIGNATURA' ? '' : v.curso.regimen,
          esAfin,
          items: [v]
        });
      }
    }
    return Array.from(map.entries())
      .map(([key, g]) => ({ key, ...g }))
      .sort((a, b) => Number(b.esAfin) - Number(a.esAfin) || a.titulo.localeCompare(b.titulo));
  }, [vacantesFiltradas, agrupacion, materiasAfines]);

  const asignarDirecto = async (v: VacanteItem, docOverride?: Docente) => {
    const targetDoc = docOverride || docenteActivo;
    if (!targetDoc || !onGuardarAsignacion) return;
    if (docOverride && docOverride.id !== docenteActivo?.id) {
      setDocenteActivoId(docOverride.id);
    }
    await crearAsignacion({
      curso: v.curso,
      asignatura: v.asignatura,
      horas: v.horasDisponibles,
      esTallerJec: Boolean(v.esLibreJec),
      esCoDocencia: Boolean(v.esCoDocenciaParvularia),
      esCoDocenciaParvularia: Boolean(v.esCoDocenciaParvularia),
      tipoApoyo: v.esCoDocenciaParvularia ? '2DA_EDUCADORA_DTO306' : undefined
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* PANEL IZQUIERDO (35% -> 4 cols): Nómina de Docentes */}
      <div className="lg:col-span-4 card-elevated overflow-hidden flex flex-col max-h-[760px]">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wide">
              1. Selecciona o Arrastra un Docente
            </h3>
            <span className="text-[11px] font-mono font-bold text-slate-500">
              {docentesFiltrados.length}/{docentes.length}
            </span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={busquedaDoc}
              onChange={e => setBusquedaDoc(e.target.value)}
              placeholder="Buscar docente o especialidad..."
              className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1 text-[10px]">
            {[
              { id: 'LIBRES' as const, label: 'Con Horas Libres' },
              { id: 'TODOS' as const, label: 'Todos' },
              { id: 'EXCEDIDOS' as const, label: 'Excedidos' },
              { id: 'SEP_PIE' as const, label: 'SEP / PIE' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroDoc(f.id)}
                className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                  filtroDoc === f.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {docentesFiltrados.map(({ docente, saldo, totalAsigs, isEducadora, haAsignadas, maxAula, libresAula, contratoSep, sepAsignado, contratoPie, pieAsignado, minutosRecreo, minutosHnl, minutosPlan40 }) => {
            const activo = docenteActivo?.id === docente.id;
            const fmtM = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
            return (
              <div
                key={docente.id}
                draggable
                onDragStart={() => {
                  setDraggedDocId(docente.id);
                  setDocenteActivoId(docente.id);
                }}
                onDragEnd={() => setDraggedDocId(null)}
                onClick={() => setDocenteActivoId(docente.id)}
                className={`p-2.5 cursor-pointer transition-all space-y-1 ${
                  activo
                    ? 'bg-blue-50/90 dark:bg-blue-950/40 border-l-4 border-l-blue-600'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {docente.apellidos}, {docente.nombres}
                        </p>
                        {isEducadora && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-extrabold bg-teal-100 text-teal-800 shrink-0">
                            60m
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">
                        {docente.asignaturaPrincipal || docente.cargoInstitucional || docente.estamento} ·{' '}
                        <span className="font-mono">{docente.horasContrato}h</span> · {totalAsigs} asig. ·{' '}
                        <span className={`font-mono font-bold ${libresAula <= 0.05 ? 'text-emerald-700' : isEducadora ? 'text-teal-700' : 'text-blue-700'}`}>
                          Aula {haAsignadas}/{maxAula}h {libresAula <= 0.05 ? '(✓ Tope)' : `(+${libresAula}h)`}
                        </span>
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-black shrink-0 ${
                      saldo > 0.05
                        ? 'bg-emerald-100 text-emerald-800'
                        : saldo < -0.05
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {saldo > 0 ? `+${saldo}h` : `${saldo}h`}
                  </span>
                </div>

                {/* Micro-fila compacta SEP / PIE / Recreo / HNL / 40% Planif. */}
                <div className="pl-5 flex flex-wrap items-center gap-1.5 text-[9.5px] font-mono text-slate-500">
                  {(contratoSep > 0 || sepAsignado > 0) && (
                    <span className="px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200/80 font-bold">
                      SEP {Math.round(sepAsignado * 10) / 10}/{contratoSep}h
                    </span>
                  )}
                  {(contratoPie > 0 || pieAsignado > 0) && (
                    <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 border border-purple-200/80 font-bold">
                      PIE {Math.round(pieAsignado * 10) / 10}/{contratoPie}h
                    </span>
                  )}
                  <span title="Recreo · HNL totales · 40% Planificación">
                    Rec {fmtM(minutosRecreo)} · HNL {fmtM(minutosHnl)} (40%: {fmtM(minutosPlan40)})
                  </span>
                </div>
              </div>
            );
          })}
          {docentesFiltrados.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400 italic">
              No hay docentes en este filtro. Cambia a "Todos".
            </div>
          )}
        </div>
      </div>

      {/* PANEL DERECHO (65% -> 8 cols): Vacantes del Colegio + Carga del Docente Activo */}
      <div className="lg:col-span-8 space-y-3">
        {docenteActivo && resumenNormativo && saldoPorFuente && (
          <div className="card-elevated p-3 bg-gradient-to-r from-blue-900 to-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-200 block">Docente Activo para Cuadratura</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-sm font-black">
                  {docenteActivo.nombres} {docenteActivo.apellidos}
                </h4>
                {resumenNormativo.esEducadora && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/30 text-teal-100 border border-teal-400/40">
                    Parvularia DTO 306 · 60m
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/15">
                  Contrato {docenteActivo.horasContrato}h
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    resumenNormativo.horasAulaLibres <= 0.05
                      ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/40'
                      : 'bg-teal-500/30 text-teal-100 border border-teal-400/40'
                  }`}
                >
                  Aula {resumenNormativo.esEducadora ? '60m' : '45m'}: {resumenNormativo.totalHaLectivas}/{resumenNormativo.maxAulaPermitida}h{' '}
                  {resumenNormativo.horasAulaLibres <= 0.05
                    ? '✓ Tope completo'
                    : `(+${resumenNormativo.horasAulaLibres}h disp.)`}
                </span>
                {(saldoPorFuente.contratoSep > 0 || saldoPorFuente.sepAsignado > 0) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/30 text-sky-100">
                    SEP {Math.round(saldoPorFuente.sepAsignado * 10) / 10}/{saldoPorFuente.contratoSep}h
                  </span>
                )}
                {(saldoPorFuente.contratoPie > 0 || saldoPorFuente.pieAsignado > 0) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/30 text-purple-100">
                    PIE {Math.round(saldoPorFuente.pieAsignado * 10) / 10}/{saldoPorFuente.contratoPie}h
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-blue-100">
                  Rec {Math.floor(resumenNormativo.audit.minutosRecreoTotal / 60)}h{resumenNormativo.audit.minutosRecreoTotal % 60}m · HNL {Math.floor(resumenNormativo.audit.minutosHnlTotal / 60)}h{resumenNormativo.audit.minutosHnlTotal % 60}m (40%: {Math.floor(resumenNormativo.audit.minutosHnlPlanificacion40 / 60)}h{resumenNormativo.audit.minutosHnlPlanificacion40 % 60}m)
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    resumenNormativo.audit.saldoHoras > 0
                      ? 'bg-emerald-500/25 text-emerald-200'
                      : resumenNormativo.audit.saldoHoras < 0
                      ? 'bg-rose-500/30 text-rose-200'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  Saldo:{' '}
                  {resumenNormativo.audit.saldoHoras > 0
                    ? `+${resumenNormativo.audit.saldoHoras}h`
                    : `${resumenNormativo.audit.saldoHoras}h`}
                </span>
              </div>
            </div>
            {onAbrirDrawerDocente && (
              <button
                type="button"
                onClick={() => onAbrirDrawerDocente(docenteActivo)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 transition-colors"
              >
                Abrir Ficha Drawer completa
              </button>
            )}
          </div>
        )}

        {/* Barra de control de Vacantes */}
        <div className="card-elevated p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={busquedaVacante}
              onChange={e => setBusquedaVacante(e.target.value)}
              placeholder="Buscar asignatura vacante o curso (ej. Matemática, 4° Básico)..."
              className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {resumenNormativo?.esEducadora && (
              <div className="flex items-center gap-1 bg-teal-50 border border-teal-200 p-1 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setSoloEnfoqueParvulario(true)}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                    soloEnfoqueParvulario ? 'bg-teal-600 text-white shadow-xs' : 'text-teal-800 hover:bg-teal-100'
                  }`}
                >
                  Solo Párvulos (DTO 306)
                </button>
                <button
                  type="button"
                  onClick={() => setSoloEnfoqueParvulario(false)}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                    !soloEnfoqueParvulario ? 'bg-teal-600 text-white shadow-xs' : 'text-teal-800 hover:bg-teal-100'
                  }`}
                >
                  Todo el Colegio
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setAgrupacion('ASIGNATURA')}
                className={`px-2.5 py-1 rounded-md font-bold inline-flex items-center gap-1 ${
                  agrupacion === 'ASIGNATURA' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>Por Asignatura</span>
              </button>
              <button
                type="button"
                onClick={() => setAgrupacion('CURSO')}
                className={`px-2.5 py-1 rounded-md font-bold inline-flex items-center gap-1 ${
                  agrupacion === 'CURSO' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Por Curso</span>
              </button>
            </div>
          </div>
        </div>

        {/* Panel Guiado DTO 306 para Educadoras de Párvulos */}
        {docenteActivo && resumenNormativo?.esEducadora && (
          <div className="card-elevated p-3 space-y-2.5 border-teal-200 bg-teal-50/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wide text-teal-900">
                  Cobertura de Permanencia DTO 306 · Educación Parvularia (60m cron.)
                </h4>
                <p className="text-[11px] text-teal-800/80">
                  Visualiza en tiempo real lo cubierto por la Titular, lo asignado a 2da Educadora y el saldo disponible de{' '}
                  <span className="font-bold">{docenteActivo.nombres} {docenteActivo.apellidos}</span>.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-black ${
                  resumenNormativo.horasAulaLibres <= 0.05
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-teal-600 text-white'
                }`}
              >
                {resumenNormativo.horasAulaLibres <= 0.05
                  ? `✓ Tope aula completo (${resumenNormativo.totalHaLectivas}/${resumenNormativo.maxAulaPermitida}h)`
                  : `Disponible en aula: +${resumenNormativo.horasAulaLibres}h (de ${resumenNormativo.maxAulaPermitida}h)`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {cursos
                .filter(c => {
                  if (!esNivelParvulario(c.nivel)) return false;
                  const q = busquedaVacante.trim().toLowerCase();
                  if (!q) return true;
                  return `${c.nivel} ${c.letra}`.toLowerCase().includes(q);
                })
                .map(c => {
                  const estadoParv = mapaParvulario.get(c.id);
                  if (!estadoParv) return null;
                  const res = estadoParv.resultado;
                  const faltaHoras = Math.round((res.minutosDeficitRestante / 60) * 100) / 100;
                  const esTitularActiva = estadoParv.titularDocente?.id === docenteActivo.id;
                  const hrsSug = Math.max(0.5, Math.min(faltaHoras, resumenNormativo.horasAulaLibres));
                  const pctTitular = Math.min(100, Math.round((res.minutosAsignadosTitular / Math.max(1, res.permanenciaMinutos)) * 100));
                  const pctSegunda = Math.min(100, Math.round((res.minutosAsignadosSegundaEducadora / Math.max(1, res.permanenciaMinutos)) * 100));

                  return (
                    <div
                      key={c.id}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const doc = docentes.find(d => d.id === draggedDocId) || docenteActivo;
                        if (!doc || res.coberturaCompletaPermanencia) return;
                        asignarDirecto(
                          {
                            curso: c,
                            asignatura: !esTitularActiva && res.minutosAsignadosTitular > 0
                              ? 'Atención Directa y Co-Docencia Parvularia (DTO 306)'
                              : 'Atención Directa Parvularia (BCEP Integral)',
                            horasPlan: Math.round((res.permanenciaMinutos / 60) * 100) / 100,
                            horasAsignadas: Math.round((res.minutosCubiertosTotales / 60) * 100) / 100,
                            horasDisponibles: hrsSug,
                            esParvularia: true,
                            esCoDocenciaParvularia: !esTitularActiva && res.minutosAsignadosTitular > 0
                          },
                          doc
                        );
                      }}
                      className={`rounded-xl border p-2.5 bg-white space-y-2 transition-all ${
                        res.coberturaCompletaPermanencia
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : draggedDocId
                          ? 'border-dashed border-teal-400'
                          : 'border-teal-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900">
                              {c.nivel} {c.letra}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700">
                              {c.regimen}
                            </span>
                            {res.requiereTecnicoParvuloDto315 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                {res.cantidadTecnicosSugeridos} TEP Dto.315
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Permanencia: {res.permanenciaTexto} ({res.regimenNormativoProporcion === '60_40' ? '60/40' : '65/35'})
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                            res.coberturaCompletaPermanencia
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {res.coberturaCompletaPermanencia
                            ? '✓ 100% Cubierta'
                            : `Falta ${res.minutosDeficitRestanteTexto}`}
                        </span>
                      </div>

                      {/* Barra apilada Titular (teal) + 2da Educadora (indigo) */}
                      <div className="w-full h-2 rounded-full bg-amber-100 overflow-hidden flex">
                        <div
                          className="h-full bg-teal-600 transition-all"
                          title={`Titular: ${res.minutosAsignadosTitularTexto}`}
                          style={{ width: `${pctTitular}%` }}
                        />
                        {res.minutosAsignadosSegundaEducadora > 0 && (
                          <div
                            className="h-full bg-indigo-500 transition-all"
                            title={`2da Educadora: ${Math.floor(res.minutosAsignadosSegundaEducadora / 60)}h ${String(res.minutosAsignadosSegundaEducadora % 60).padStart(2, '0')}m`}
                            style={{ width: `${pctSegunda}%` }}
                          />
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        {estadoParv.titularDocente && (
                          <span className="px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-900 font-semibold">
                            Titular: {estadoParv.titularDocente.apellidos.split(' ')[0]} ({res.minutosAsignadosTitularTexto}/{res.minutosAulaTitularTexto})
                          </span>
                        )}
                        {res.minutosAsignadosSegundaEducadora > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold">
                            2da Ed: {Math.floor(res.minutosAsignadosSegundaEducadora / 60)}h {String(res.minutosAsignadosSegundaEducadora % 60).padStart(2, '0')}m
                          </span>
                        )}
                      </div>

                      {/* Acción contextual en 1 clic */}
                      {!res.coberturaCompletaPermanencia && (
                        resumenNormativo.horasAulaLibres > 0.05 ? (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                asignarDirecto({
                                  curso: c,
                                  asignatura: !esTitularActiva && res.minutosAsignadosTitular > 0
                                    ? 'Atención Directa y Co-Docencia Parvularia (DTO 306)'
                                    : 'Atención Directa Parvularia (BCEP Integral)',
                                  horasPlan: Math.round((res.permanenciaMinutos / 60) * 100) / 100,
                                  horasAsignadas: Math.round((res.minutosCubiertosTotales / 60) * 100) / 100,
                                  horasDisponibles: hrsSug,
                                  esParvularia: true,
                                  esCoDocenciaParvularia: !esTitularActiva && res.minutosAsignadosTitular > 0
                                })
                              }
                              className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold shadow-2xs transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>
                                Cubrir {hrsSug}h 60m{' '}
                                {resumenNormativo.horasAulaLibres <= faltaHoras
                                  ? '(hasta tope)'
                                  : esTitularActiva || res.minutosAsignadosTitular === 0
                                  ? '(Titular)'
                                  : '(2da Ed. DTO 306)'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPopoverSeed({
                                  curso: c,
                                  asignatura: !esTitularActiva && res.minutosAsignadosTitular > 0
                                    ? 'Atención Directa y Co-Docencia Parvularia (DTO 306)'
                                    : 'Atención Directa Parvularia (BCEP Integral)',
                                  horasSugeridas: hrsSug,
                                  maxHorasPlan: hrsSug,
                                  esCoDocencia: !esTitularActiva && res.minutosAsignadosTitular > 0,
                                  esCoDocenciaParvularia: !esTitularActiva && res.minutosAsignadosTitular > 0
                                })
                              }
                              className="px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                              title="Personalizar horas o núcleo BCEP"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 space-y-1 text-[10px]">
                            <p className="font-bold text-amber-900">
                              Tope de {docenteActivo.apellidos.split(' ')[0]} completo · Faltan {res.minutosDeficitRestanteTexto} para 2da Educadora
                            </p>
                            {otrasEducadorasConSaldo.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-amber-800">Asignar a:</span>
                                {otrasEducadorasConSaldo.slice(0, 3).map(otra => (
                                  <button
                                    key={otra.docente.id}
                                    type="button"
                                    onClick={() => setDocenteActivoId(otra.docente.id)}
                                    className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors"
                                  >
                                    → {otra.docente.apellidos.split(' ')[0]} (+{otra.libresAula}h)
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-amber-800">
                                Sin otra educadora con saldo aula libre en nómina (requiere ~{res.horasContratoSegundaEducadoraRestante}h contrato).
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Lista agrupada de vacantes (Modo Ráfaga + Drop target) */}
        <div className="card-elevated p-3 space-y-3 max-h-[430px] overflow-y-auto">
          {gruposVacantes.length === 0 ? (
            <div className="p-6 text-center text-xs text-emerald-700 font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>¡No quedan vacantes pendientes en el plan de estudios!</span>
            </div>
          ) : (
            gruposVacantes.map(grupo => (
              <div
                key={grupo.key}
                className={`rounded-xl border p-2.5 space-y-2 ${
                  grupo.esAfin ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-800 dark:text-white">{grupo.titulo}</span>
                    {grupo.esAfin && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> Afín al docente
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    {grupo.items.reduce((s, x) => s + x.horasDisponibles, 0)} HA pendientes
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {grupo.items.map((v, idx) => (
                    <div
                      key={`${v.curso.id}_${v.asignatura}_${idx}`}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const doc = docentes.find(d => d.id === draggedDocId) || docenteActivo || undefined;
                        if (doc) asignarDirecto(v, doc);
                      }}
                      className={`inline-flex items-center rounded-lg border text-[11px] overflow-hidden bg-white shadow-2xs transition-all ${
                        draggedDocId ? 'border-dashed border-blue-400 hover:bg-blue-50' : 'border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={!docenteActivo}
                        onClick={() => asignarDirecto(v)}
                        className="px-2 py-1 font-semibold hover:bg-emerald-50 inline-flex items-center gap-1 text-slate-800"
                        title={
                          docenteActivo
                            ? `Asignar ${v.horasDisponibles} HA a ${docenteActivo.nombres} ${docenteActivo.apellidos}`
                            : 'Selecciona un docente'
                        }
                      >
                        <Plus className="w-3 h-3 text-emerald-600" />
                        <span>
                          {agrupacion === 'ASIGNATURA' ? `${v.curso.nivel} ${v.curso.letra}` : v.asignatura}
                        </span>
                        <span className={`font-mono font-black px-1 rounded text-[10px] ${
                          v.esParvularia ? 'bg-teal-100 text-teal-900' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {v.horasDisponibles}{v.esParvularia ? 'h 60m' : 'h'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPopoverSeed({
                            curso: v.curso,
                            asignatura: v.asignatura,
                            horasSugeridas: v.horasDisponibles,
                            maxHorasPlan: v.horasDisponibles,
                            esTallerJec: Boolean(v.esLibreJec),
                            esCoDocencia: Boolean(v.esCoDocenciaParvularia),
                            esCoDocenciaParvularia: Boolean(v.esCoDocenciaParvularia)
                          })
                        }
                        className="px-1.5 py-1 border-l border-slate-200 hover:bg-slate-100 text-slate-500"
                        title="Personalizar horas o modalidad"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Mini resumen de carga actual del docente seleccionado */}
        {docenteActivo && (
          <div className="card-elevated p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                Carga asignada a {docenteActivo.nombres} ({asignacionesDocente.length})
              </span>
              {resumenNormativo && resumenNormativo.audit.saldoHoras < -0.05 && (
                <span className="text-[11px] font-bold text-rose-600 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Sobreasignado
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {asignacionesDocente.map(a => {
                const c = cursosMap.get(a.cursoId);
                return (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-semibold border border-slate-200"
                  >
                    <span>
                      {c ? `${c.nivel} ${c.letra}` : 'Transversal'} · {a.asignatura}
                    </span>
                    <strong className="font-mono text-blue-700">{a.horasPedagogicasAula}h</strong>
                    <button
                      type="button"
                      onClick={() => eliminar(a.id)}
                      className="text-slate-400 hover:text-rose-600"
                      title="Quitar asignación"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
              {asignacionesDocente.length === 0 && (
                <span className="text-xs text-slate-400 italic">Sin bloques asignados todavía.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {docenteActivo && (
        <AsignacionQuickPopover
          seed={popoverSeed}
          docente={docenteActivo}
          cursos={cursos}
          simular={simular}
          onConfirmar={async input => {
            await crearAsignacion(input);
          }}
          onCerrar={() => setPopoverSeed(null)}
        />
      )}
    </div>
  );
};
