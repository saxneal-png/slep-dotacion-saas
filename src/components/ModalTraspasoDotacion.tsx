import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Users,
  GraduationCap,
  Calendar,
  Building2,
  ShieldCheck,
  BookOpen,
  RefreshCw,
  X,
  Layers,
  Check,
  ChevronRight
} from 'lucide-react';
import { Establecimiento, Docente } from '../types';
import {
  diagnosticarTraspasoColegio,
  ejecutarTraspasoPeriodoColegio,
  DiagnosticoPrevioTraspaso,
  OpcionesTraspasoPeriodo,
  listarDocentes
} from '../database/db';

interface ModalTraspasoDotacionProps {
  isOpen: boolean;
  onClose: () => void;
  colegioActivo: Establecimiento | null;
  colegios: Establecimiento[];
  periodoOrigen?: number;
  periodoDestino?: number;
  onTraspasoCompletado?: (rbd: string, periodoDestino: number) => void;
}

export const ModalTraspasoDotacion: React.FC<ModalTraspasoDotacionProps> = ({
  isOpen,
  onClose,
  colegioActivo,
  colegios,
  periodoOrigen = 2026,
  periodoDestino = 2027,
  onTraspasoCompletado
}) => {
  const [rbdSeleccionado, setRbdSeleccionado] = useState<string>(colegioActivo?.rbd || colegios[0]?.rbd || '');
  const [pasoActual, setPasoActual] = useState<number>(1);
  const [cargando, setCargando] = useState<boolean>(false);
  const [ejecutando, setEjecutando] = useState<boolean>(false);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoPrevioTraspaso | null>(null);
  const [docentesOrigen, setDocentesOrigen] = useState<Docente[]>([]);

  // Opciones de configuración
  const [promoverCursos, setPromoverCursos] = useState<boolean>(true);
  const [estrategiaDocentes, setEstrategiaDocentes] = useState<'TODOS' | 'SOLO_TITULARES' | 'PERSONALIZADO'>('TODOS');
  const [docentesExcluidos, setDocentesExcluidos] = useState<string[]>([]);
  const [estrategiaAsignaciones, setEstrategiaAsignaciones] = useState<'REPLICAR_CONTINUIDAD' | 'SOLO_DEMANDA_VACANTE' | 'NINGUNA'>('REPLICAR_CONTINUIDAD');
  const [ajusteMatriculaEntrante, setAjusteMatriculaEntrante] = useState<string>('');
  const [sobreescribirSiExiste, setSobreescribirSiExiste] = useState<boolean>(true);

  // Estado final
  const [resultadoMensaje, setResultadoMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (colegioActivo?.rbd) {
      setRbdSeleccionado(colegioActivo.rbd);
    }
  }, [colegioActivo]);

  useEffect(() => {
    if (isOpen && rbdSeleccionado) {
      cargarDiagnostico(rbdSeleccionado);
    }
  }, [isOpen, rbdSeleccionado]);

  const cargarDiagnostico = async (rbd: string) => {
    setCargando(true);
    setResultadoMensaje(null);
    try {
      const diag = await diagnosticarTraspasoColegio(rbd, periodoOrigen, periodoDestino);
      setDiagnostico(diag);
      const docs = await listarDocentes(rbd, periodoOrigen);
      setDocentesOrigen(docs);
    } catch (err: any) {
      console.error('Error al diagnosticar:', err);
    } finally {
      setCargando(false);
    }
  };

  if (!isOpen) return null;

  const handleEjecutarTraspaso = async () => {
    if (!rbdSeleccionado) return;
    setEjecutando(true);
    try {
      const opciones: OpcionesTraspasoPeriodo = {
        promoverCursos,
        estrategiaDocentes,
        docentesExcluidosRuns: docentesExcluidos,
        estrategiaAsignaciones,
        ajusteMatriculaEntrante: ajusteMatriculaEntrante.trim() ? Number(ajusteMatriculaEntrante) : undefined,
        sobreescribirSiExiste
      };

      const res = await ejecutarTraspasoPeriodoColegio(rbdSeleccionado, periodoOrigen, periodoDestino, opciones);
      setResultadoMensaje(res.mensaje);
      setPasoActual(4);
      if (onTraspasoCompletado) {
        onTraspasoCompletado(rbdSeleccionado, periodoDestino);
      }
    } catch (err: any) {
      alert(`Error al ejecutar traspaso: ${err.message}`);
    } finally {
      setEjecutando(false);
    }
  };

  const colegioSeleccionadoObj = colegios.find(c => c.rbd === rbdSeleccionado) || colegioActivo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Cabecera Estilo Steve Jobs */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Traspaso y Proyección de Dotación Escolar
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {periodoOrigen} ➔ {periodoDestino}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Transición normativa, promoción de cohortes SAE y resguardo de planta docente DFL 1
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Establecimiento y Stepper */}
        <div className="px-6 py-3.5 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-[280px]">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={rbdSeleccionado}
              onChange={(e) => setRbdSeleccionado(e.target.value)}
              disabled={pasoActual === 4 || ejecutando}
              className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none w-full"
            >
              {colegios.map(c => (
                <option key={c.rbd} value={c.rbd}>
                  RBD {c.rbd} - {c.nombre} ({c.comuna})
                </option>
              ))}
            </select>
          </div>

          {/* Stepper */}
          <div className="flex items-center space-x-1 sm:space-x-2 text-xs">
            {[
              { num: 1, label: 'Diagnóstico' },
              { num: 2, label: 'Cursos y Cohortes' },
              { num: 3, label: 'Planta Docente' },
              { num: 4, label: 'Confirmación' }
            ].map((s) => (
              <div
                key={s.num}
                onClick={() => {
                  if (pasoActual < 4 && !ejecutando) setPasoActual(s.num);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  pasoActual === s.num
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20'
                    : pasoActual > s.num
                    ? 'bg-slate-800 text-emerald-400 font-medium'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  pasoActual === s.num ? 'bg-white text-blue-900 font-bold' : pasoActual > s.num ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                }`}>
                  {pasoActual > s.num ? '✓' : s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cuerpo Dinámico según Paso */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar text-slate-200">
          {cargando ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mb-3" />
              <p className="text-sm">Analizando matriz de dotación y cohortes de la escuela...</p>
            </div>
          ) : (
            <>
              {/* PASO 1: DIAGNÓSTICO */}
              {pasoActual === 1 && diagnostico && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Estado de la Dotación {periodoOrigen} en {colegioSeleccionadoObj?.nombre}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Cursos Origen</span>
                        <span className="text-lg font-bold text-white font-mono">{diagnostico.totalCursosOrigen}</span>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Total Docentes</span>
                        <span className="text-lg font-bold text-white font-mono">{diagnostico.totalDocentesOrigen}</span>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Horas Contratadas</span>
                        <span className="text-lg font-bold text-indigo-300 font-mono">{diagnostico.totalHorasContratoOrigen} hrs</span>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Titulares / Contratas</span>
                        <span className="text-sm font-bold text-slate-200">
                          {diagnostico.totalTitulares} Tit. / {diagnostico.totalContratas} Con.
                        </span>
                      </div>
                    </div>

                    {diagnostico.directorDetectado && (
                      <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Director(a) Detectado(a):</span>
                        <span className="font-semibold text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                          {diagnostico.directorDetectado} (DFL 1 Protegido)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Advertencias */}
                  {diagnostico.cursosYaExistenEnDestino > 0 && (
                    <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4 text-xs text-amber-200 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">
                          Atención: Ya existen {diagnostico.cursosYaExistenEnDestino} cursos y {diagnostico.docentesYaExistenEnDestino} docentes en el periodo {periodoDestino}.
                        </p>
                        <p className="text-amber-300/80 mb-2">
                          Si continúas, el sistema puede sobrescribir o actualizar limpiamente los registros del periodo destino para mantener la coherencia.
                        </p>
                        <label className="inline-flex items-center gap-2 font-medium cursor-pointer text-white">
                          <input
                            type="checkbox"
                            checked={sobreescribirSiExiste}
                            onChange={(e) => setSobreescribirSiExiste(e.target.checked)}
                            className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500"
                          />
                          Sobrescribir y reemplazar datos existentes de {periodoDestino} para este colegio
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs text-slate-400">
                    <p className="flex items-center gap-1.5 text-slate-300 font-medium mb-1">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      Protocolo Oficial de Proyección SLEP:
                    </p>
                    El traspaso promoverá de forma automática las cohortes de alumnos de un curso al siguiente, preservará los contratos titulares de planta y recalculará la demanda curricular para el año escolar {periodoDestino}.
                  </div>
                </div>
              )}

              {/* PASO 2: CURSOS Y COHORTES */}
              {pasoActual === 2 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-blue-400" />
                      Reglas de Promoción Curricular SAE {periodoOrigen} ➔ {periodoDestino}
                    </h3>

                    <label className="flex items-start gap-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700 cursor-pointer hover:border-slate-600 transition-colors">
                      <input
                        type="checkbox"
                        checked={promoverCursos}
                        onChange={(e) => setPromoverCursos(e.target.checked)}
                        className="mt-1 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Promover niveles automáticamente (Recomendado)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Los alumnos avanzan de nivel (ej. 1° Básico pasa a 2° Básico, 3° Medio pasa a 4° Medio). Los alumnos de 4° Medio egresan.
                        </span>
                      </div>
                    </label>

                    <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                      <span className="text-xs font-semibold text-slate-200 block">
                        Ajuste de Matrícula Proyectada para Nueva Cohorte Entrante:
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Por defecto, el nuevo curso inicial (Pre-Kínder o Kínder) conservará la misma capacidad que el año anterior. Puedes ingresar una matrícula específica según cupos SAE autorizados:
                      </p>
                      <input
                        type="number"
                        placeholder="Ej: 30 (Dejar vacío para usar valor histórico)"
                        value={ajusteMatriculaEntrante}
                        onChange={(e) => setAjusteMatriculaEntrante(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none w-64"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 3: PLANTA DOCENTE */}
              {pasoActual === 3 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400" />
                      Estrategia de Traspaso de Planta Docente (DFL 1)
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {
                          id: 'TODOS',
                          title: 'Traspasar Toda la Planta',
                          desc: 'Renovación completa de docentes Titulares y Contratas vigentes.'
                        },
                        {
                          id: 'SOLO_TITULARES',
                          title: 'Solo Titulares (Planta)',
                          desc: 'Traspasa exclusivamente a docentes titulares. Contratas quedan fuera.'
                        },
                        {
                          id: 'PERSONALIZADO',
                          title: 'Selección Personalizada',
                          desc: 'Elegir manualmente qué docentes a contrata no continúan en 2027.'
                        }
                      ].map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setEstrategiaDocentes(item.id as any)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            estrategiaDocentes === item.id
                              ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                              : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <span className="text-xs font-bold block mb-1">{item.title}</span>
                          <span className="text-[11px] text-slate-400 leading-tight block">{item.desc}</span>
                        </div>
                      ))}
                    </div>

                    {estrategiaDocentes === 'PERSONALIZADO' && (
                      <div className="mt-4 border-t border-slate-700 pt-3">
                        <span className="text-xs font-semibold text-slate-200 block mb-2">
                          Marcar docentes que NO continúan en {periodoDestino}:
                        </span>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                          {docentesOrigen.map(d => {
                            const isExcluded = docentesExcluidos.includes(d.run);
                            const isTitular = d.calidadJuridica === 'TITULAR';
                            return (
                              <div
                                key={d.id}
                                className={`flex items-center justify-between p-2 rounded text-xs border ${
                                  isExcluded ? 'bg-rose-950/20 border-rose-800/40 text-rose-300' : 'bg-slate-900/80 border-slate-800 text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-slate-400">{d.run}</span>
                                  <span className="font-medium">{d.nombres} {d.apellidos}</span>
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                    isTitular ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'
                                  }`}>
                                    {d.calidadJuridica} ({d.horasContrato}h)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  disabled={isTitular}
                                  onClick={() => {
                                    if (isExcluded) {
                                      setDocentesExcluidos(docentesExcluidos.filter(r => r !== d.run));
                                    } else {
                                      setDocentesExcluidos([...docentesExcluidos, d.run]);
                                    }
                                  }}
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                    isTitular
                                      ? 'opacity-40 cursor-not-allowed text-slate-500'
                                      : isExcluded
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                  }`}
                                >
                                  {isTitular ? 'Inamovible' : isExcluded ? 'Excluido' : 'Mantener'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Asignaciones */}
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                      Estrategia de Asignación Curricular de Horas
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                        estrategiaAsignaciones === 'REPLICAR_CONTINUIDAD'
                          ? 'bg-emerald-950/30 border-emerald-500 text-white'
                          : 'bg-slate-900/60 border-slate-700 text-slate-300'
                      }`}>
                        <input
                          type="radio"
                          name="estrategiaAsig"
                          checked={estrategiaAsignaciones === 'REPLICAR_CONTINUIDAD'}
                          onChange={() => setEstrategiaAsignaciones('REPLICAR_CONTINUIDAD')}
                          className="mt-1 text-emerald-600"
                        />
                        <div>
                          <span className="text-xs font-bold block">Continuidad Curricular</span>
                          <span className="text-[11px] text-slate-400 block">
                            Replicar asignaciones de aula hacia los nuevos cursos correspondientes.
                          </span>
                        </div>
                      </label>

                      <label className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                        estrategiaAsignaciones === 'SOLO_DEMANDA_VACANTE'
                          ? 'bg-emerald-950/30 border-emerald-500 text-white'
                          : 'bg-slate-900/60 border-slate-700 text-slate-300'
                      }`}>
                        <input
                          type="radio"
                          name="estrategiaAsig"
                          checked={estrategiaAsignaciones === 'SOLO_DEMANDA_VACANTE'}
                          onChange={() => setEstrategiaAsignaciones('SOLO_DEMANDA_VACANTE')}
                          className="mt-1 text-emerald-600"
                        />
                        <div>
                          <span className="text-xs font-bold block">Generar Demanda Vacante</span>
                          <span className="text-[11px] text-slate-400 block">
                            Crea los cursos y su demanda teórica pero deja las horas libres para armar la malla desde cero.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 4: CONFIRMACIÓN Y RESULTADO */}
              {pasoActual === 4 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {resultadoMensaje ? (
                    <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-6 text-center space-y-3">
                      <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                        <Check className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-white">¡Traspaso Completado con Éxito!</h3>
                      <p className="text-xs text-emerald-300 font-medium max-w-lg mx-auto">
                        {resultadoMensaje}
                      </p>
                      <div className="pt-3">
                        <button
                          onClick={onClose}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
                        >
                          Cerrar y Ver Periodo {periodoDestino}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                        Resumen de Configuración de Traspaso {periodoOrigen} ➔ {periodoDestino}
                      </h3>

                      <div className="divide-y divide-slate-700/60 text-xs">
                        <div className="py-2.5 flex justify-between">
                          <span className="text-slate-400">Establecimiento:</span>
                          <span className="font-semibold text-white">{colegioSeleccionadoObj?.nombre} (RBD {rbdSeleccionado})</span>
                        </div>
                        <div className="py-2.5 flex justify-between">
                          <span className="text-slate-400">Promoción de Cursos:</span>
                          <span className="font-semibold text-emerald-400">{promoverCursos ? 'Sí (Cohortes Avanzan + Egreso 4°M/8°B)' : 'No (Misma estructura)'}</span>
                        </div>
                        <div className="py-2.5 flex justify-between">
                          <span className="text-slate-400">Estrategia Docentes:</span>
                          <span className="font-semibold text-white">
                            {estrategiaDocentes === 'TODOS' ? 'Todos los docentes' : estrategiaDocentes === 'SOLO_TITULARES' ? 'Solo Titulares' : `Personalizado (${docentesExcluidos.length} excluidos)`}
                          </span>
                        </div>
                        <div className="py-2.5 flex justify-between">
                          <span className="text-slate-400">Asignaciones Curriculares:</span>
                          <span className="font-semibold text-indigo-300">
                            {estrategiaAsignaciones === 'REPLICAR_CONTINUIDAD' ? 'Continuidad Docente' : 'Demanda Vacante'}
                          </span>
                        </div>
                        <div className="py-2.5 flex justify-between">
                          <span className="text-slate-400">Sobrescribir si existe:</span>
                          <span className="font-semibold text-amber-300">{sobreescribirSiExiste ? 'Sí (Reemplazo limpio)' : 'No'}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg text-xs text-blue-200">
                        ⚡ Se ejecutará una transacción SQLite atómica con registro de auditoría institucional.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer con Acciones */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div>
            {pasoActual > 1 && pasoActual < 4 && !resultadoMensaje && (
              <button
                type="button"
                onClick={() => setPasoActual(pasoActual - 1)}
                disabled={ejecutando}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Anterior
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancelar
            </button>

            {pasoActual < 3 && (
              <button
                type="button"
                onClick={() => setPasoActual(pasoActual + 1)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1.5"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {pasoActual === 3 && (
              <button
                type="button"
                onClick={() => setPasoActual(4)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5"
              >
                Revisar y Confirmar
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {pasoActual === 4 && !resultadoMensaje && (
              <button
                type="button"
                onClick={handleEjecutarTraspaso}
                disabled={ejecutando}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
              >
                {ejecutando ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Ejecutando Traspaso...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Ejecutar Traspaso {periodoOrigen} ➔ {periodoDestino}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
