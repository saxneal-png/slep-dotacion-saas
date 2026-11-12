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
import { calcularAuditoriaDocenteMultitramo } from '@slep/mineduc-engine';
import { calcularHorasFueraAulaDocente } from '../../services/auditoriaDocenteService';
import {
  calcularDisponibilidadCurso,
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
    onEliminarAsignacion
  );

  // Resumen rápido de cada docente para la columna izquierda
  const docentesResumen = useMemo(() => {
    const es60 = (colegio.porcentajePrioritarios || 0) >= 80;
    return docentes.map(d => {
      const asigs = asignaciones.filter(
        a => a.docenteId === d.id || (a.coDocenteId === d.id && a.tieneCoDocente)
      );
      const desglose = calcularHorasFueraAulaDocente(d, asigs, colegio.porcentajePrioritarios || 0);
      let ha65 = 0;
      let ha60 = 0;
      let pieCron = 0;
      let sepEx = 0;
      for (const a of asigs) {
        if (a.esTrabajoColaborativo) {
          pieCron += a.horasCronologicasPie || a.horasColaborativas || a.horasPedagogicasAula || 0;
        } else if (a.esTallerSep) {
          sepEx += Math.round((a.horasPedagogicasAula || 0) * 0.75 * 100) / 100;
        } else if (es60) {
          ha60 += a.horasPedagogicasAula || 0;
        } else {
          ha65 += a.horasPedagogicasAula || 0;
        }
      }
      const audit = calcularAuditoriaDocenteMultitramo({
        horasAula65_35: ha65,
        horasAula60_40: ha60,
        horasPieCronologicas: pieCron,
        horasTallerSepExento: sepEx,
        horasNoAulaInstitucionales: desglose.horasInstitucionalesSubvGen,
        horasContratoReal: d.horasContrato,
        aplicaArticulo69: Boolean(d.aplicaArticulo69)
      });
      const esSepPie =
        (d.horasSepTitular || 0) + (d.horasSepContrata || 0) + (d.horasPieTitular || 0) + (d.horasPieContrata || 0) > 0;
      return { docente: d, saldo: audit.saldoHoras, esSepPie, totalAsigs: asigs.length };
    });
  }, [docentes, asignaciones, colegio.porcentajePrioritarios]);

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

  // Vacantes del establecimiento
  const vacantes = useMemo(() => {
    const lista: VacanteItem[] = [];
    for (const c of cursos) {
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
  }, [cursos, planesDb, asignaciones]);

  const vacantesFiltradas = useMemo(() => {
    const q = busquedaVacante.trim().toLowerCase();
    if (!q) return vacantes;
    return vacantes.filter(
      v =>
        v.asignatura.toLowerCase().includes(q) ||
        `${v.curso.nivel} ${v.curso.letra}`.toLowerCase().includes(q)
    );
  }, [vacantes, busquedaVacante]);

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

  const cursosMap = useMemo(() => new Map(cursos.map(c => [c.id, c])), [cursos]);

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
      esTallerJec: Boolean(v.esLibreJec)
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
          {docentesFiltrados.map(({ docente, saldo, totalAsigs }) => {
            const activo = docenteActivo?.id === docente.id;
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
                className={`p-2.5 cursor-pointer transition-all flex items-center justify-between gap-2 ${
                  activo
                    ? 'bg-blue-50/90 dark:bg-blue-950/40 border-l-4 border-l-blue-600'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {docente.apellidos}, {docente.nombres}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {docente.asignaturaPrincipal || docente.cargoInstitucional || docente.estamento} ·{' '}
                      <span className="font-mono">{docente.horasContrato}h</span> · {totalAsigs} asig.
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
        {docenteActivo && resumenNormativo && (
          <div className="card-elevated p-3 bg-gradient-to-r from-blue-900 to-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-200 block">Docente Activo para Cuadratura</span>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-black">
                  {docenteActivo.nombres} {docenteActivo.apellidos}
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/15">
                  Contrato {docenteActivo.horasContrato}h
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
                        <span className="font-mono font-black px-1 rounded bg-amber-100 text-amber-900 text-[10px]">
                          {v.horasDisponibles}h
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
                            esTallerJec: Boolean(v.esLibreJec)
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
