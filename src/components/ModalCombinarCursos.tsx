import React, { useState, useMemo, useEffect } from 'react';
import { Layers, X, AlertTriangle, CheckCircle2, Users, School, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { CursoSae } from '../types';
import { combinarCursosExistentes, extraerGradosDeCurso } from '../services/combinacionCursosService';

interface ModalCombinarCursosProps {
  isOpen: boolean;
  onClose: () => void;
  cursos: CursoSae[];
  cursoInicialId?: string;
  onConfirmarCombinacion: (cursosIdsSeleccionados: string[], cursoCombinado: CursoSae) => Promise<void> | void;
}

export const ModalCombinarCursos: React.FC<ModalCombinarCursosProps> = ({
  isOpen,
  onClose,
  cursos,
  cursoInicialId,
  onConfirmarCombinacion
}) => {
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [nombrePersonalizado, setNombrePersonalizado] = useState('');
  const [letra, setLetra] = useState('U');
  const [regimen, setRegimen] = useState<'JEC' | 'No JEC'>('JEC');
  const [regimenProporcion, setRegimenProporcion] = useState<'65_35' | '60_40'>('65_35');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [pasoConfirmacion, setPasoConfirmacion] = useState(false);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (cursoInicialId) {
        setSeleccionados([cursoInicialId]);
      } else {
        setSeleccionados([]);
      }
      setNombrePersonalizado('');
      setLetra('U');
      setPasoConfirmacion(false);
    }
  }, [isOpen, cursoInicialId]);

  // Cursos seleccionados como objetos
  const cursosSeleccionados = useMemo(() => {
    return cursos.filter(c => seleccionados.includes(c.id));
  }, [cursos, seleccionados]);

  // Grados que resultan de la combinación
  const gradosResultado = useMemo(() => {
    const todos: string[] = [];
    for (const c of cursosSeleccionados) {
      const gList = extraerGradosDeCurso(c);
      for (const g of gList) {
        if (!todos.includes(g)) todos.push(g);
      }
    }
    return todos;
  }, [cursosSeleccionados]);

  // Nombre sugerido automático
  const nombreSugerido = useMemo(() => {
    if (gradosResultado.length === 0) return '';
    if (gradosResultado.length <= 3) {
      return `Curso Combinado (${gradosResultado.join(' - ')})`;
    }
    return `Multigrado (${gradosResultado[0]} a ${gradosResultado[gradosResultado.length - 1]})`;
  }, [gradosResultado]);

  // Métricas agregadas
  const totalMatricula = cursosSeleccionados.reduce((s, c) => s + (c.matriculaProyectada || 0), 0);
  const totalCupo = cursosSeleccionados.reduce((s, c) => s + (c.cupoSae || 0), 0);
  const totalNeet = cursosSeleccionados.reduce((s, c) => s + (c.alumnosNeet || 0), 0);
  const totalNeep = cursosSeleccionados.reduce((s, c) => s + (c.alumnosNeep || 0), 0);

  if (!isOpen) return null;

  const toggleSeleccion = (id: string) => {
    setSeleccionados(prev => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter(item => item !== id) : [...prev, id];
      // Si cambia la selección, ajustar régimen por defecto
      const selCursos = cursos.filter(c => next.includes(c.id));
      if (selCursos.some(c => c.regimen === 'JEC')) {
        setRegimen('JEC');
      }
      return next;
    });
  };

  const seleccionarTodosVisibles = () => {
    const idsVisibles = cursosFiltrados.map(c => c.id);
    setSeleccionados(Array.from(new Set([...seleccionados, ...idsVisibles])));
  };

  const deseleccionarTodos = () => {
    setSeleccionados([]);
  };

  const handleProcederAConfirmacion = (e: React.FormEvent) => {
    e.preventDefault();
    if (seleccionados.length < 2) {
      alert('Debes seleccionar al menos 2 cursos para realizar la combinación.');
      return;
    }
    setPasoConfirmacion(true);
  };

  const handleEjecutarCombinacion = async () => {
    if (seleccionados.length < 2) return;
    try {
      setProcesando(true);
      const cursoGenerado = combinarCursosExistentes(cursosSeleccionados, {
        nombrePersonalizado: nombrePersonalizado.trim() || nombreSugerido,
        letra: letra.trim().toUpperCase() || 'U',
        regimen,
        regimenProporcion
      });

      await onConfirmarCombinacion(seleccionados, cursoGenerado);
      handleCerrar();
    } catch (err: any) {
      alert(`Error al combinar cursos: ${err?.message || err}`);
    } finally {
      setProcesando(false);
    }
  };

  const handleCerrar = () => {
    setSeleccionados([]);
    setNombrePersonalizado('');
    setLetra('U');
    setPasoConfirmacion(false);
    setProcesando(false);
    onClose();
  };

  const cursosFiltrados = cursos.filter(c => {
    const q = filtroBusqueda.toLowerCase().trim();
    if (!q) return true;
    return `${c.nivel} ${c.letra}`.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] border border-slate-200 my-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Combinar Cursos Existentes
              </h3>
              <p className="text-xs text-slate-500">
                Fusiona dos o más cursos del establecimiento en un aula multigrado o curso combinado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCerrar}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!pasoConfirmacion ? (
          /* PASO 1: SELECCIÓN Y CONFIGURACIÓN */
          <form onSubmit={handleProcederAConfirmacion} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
            {/* Buscador y botones de selección rápida */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-700">
                  1. Selecciona los cursos a combinar ({seleccionados.length} seleccionados):
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={seleccionarTodosVisibles}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Seleccionar todos
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={deseleccionarTodos}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Filtrar cursos por nombre o letra..."
                value={filtroBusqueda}
                onChange={e => setFiltroBusqueda(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />

              {/* Lista de cursos con checkboxes */}
              <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50 p-1">
                {cursosFiltrados.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No se encontraron cursos coincidentes.
                  </div>
                ) : (
                  cursosFiltrados.map(curso => {
                    const isChecked = seleccionados.includes(curso.id);
                    return (
                      <label
                        key={curso.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                          isChecked ? 'bg-indigo-50/80 text-indigo-950 font-bold border border-indigo-200/60' : 'hover:bg-slate-100/70 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSeleccion(curso.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <span className="font-bold">{curso.nivel} {curso.letra}</span>
                            <span className="ml-2 text-[10px] text-slate-500 font-normal">
                              ({curso.regimen} • {curso.matriculaProyectada} alumnos • {curso.alumnosNeet || 0}T/{curso.alumnosNeep || 0}P)
                            </span>
                          </div>
                        </div>
                        {curso.esCombinado && (
                          <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-semibold">
                            Combinado
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Configuración del Nuevo Curso Combinado */}
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
              <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-indigo-600" />
                2. Configuración del Curso Combinado Resultante:
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nombre / Nivel del Curso:
                  </label>
                  <input
                    type="text"
                    value={nombrePersonalizado}
                    onChange={e => setNombrePersonalizado(e.target.value)}
                    placeholder={nombreSugerido || 'Ej: Multigrado 1°-2° Básico'}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Dejar vacío para usar el nombre sugerido automático.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Letra del Curso:
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={letra}
                    onChange={e => setLetra(e.target.value.toUpperCase())}
                    placeholder="U"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white uppercase font-bold"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    'U' para grupo único multigrado o letra asignada.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Jornada Escolar:
                  </label>
                  <select
                    value={regimen}
                    onChange={e => setRegimen(e.target.value as 'JEC' | 'No JEC')}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="JEC">JEC (38 Horas Aula Plan)</option>
                    <option value="No JEC">No JEC (30 Horas Aula Plan)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Régimen Proporción Docente:
                  </label>
                  <select
                    value={regimenProporcion}
                    onChange={e => setRegimenProporcion(e.target.value as '65_35' | '60_40')}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="65_35">65/35 (Estándar Ley 20.903)</option>
                    <option value="60_40">60/40 (Vulnerabilidad SEP &gt; 80%)</option>
                  </select>
                </div>
              </div>

              {/* Resumen de Métricas Proyectadas */}
              {seleccionados.length >= 2 && (
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-indigo-100 text-center text-xs">
                  <div className="p-2 bg-white rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 block">Cursos</span>
                    <span className="font-black text-indigo-900">{seleccionados.length}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 block">Matrícula</span>
                    <span className="font-black text-slate-900">{totalMatricula} est.</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 block">Cupo SAE</span>
                    <span className="font-black text-slate-900">{totalCupo}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-slate-500 block">NEE PIE</span>
                    <span className="font-black text-purple-900">{totalNeet}T • {totalNeep}P</span>
                  </div>
                </div>
              )}
              </div>
            </div>

            {/* Botones de acción Paso 1 */}
            <div className="shrink-0 p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCerrar}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={seleccionados.length < 2}
                className={`flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl transition-all ${
                  seleccionados.length >= 2
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Continuar a Confirmación</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          /* PASO 2: CONFIRMACIÓN EXPLÍCITA */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 space-y-1">
                  <h4 className="font-bold text-amber-900">
                    ¿Confirmas la combinación de los siguientes cursos?
                  </h4>
                  <p>
                    Esta acción unificará los cursos seleccionados en un único curso combinado. Las asignaciones docentes existentes se traspasarán al nuevo curso y los cursos de origen se eliminarán.
                  </p>
                </div>
              </div>

              {/* Detalle de la Operación */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="font-bold text-slate-800 flex items-center justify-between border-b pb-2">
                  <span>Cursos de Origen que se Fusionarán ({cursosSeleccionados.length}):</span>
                  <span className="text-[11px] text-slate-500 font-normal">Se eliminarán tras la unión</span>
                </div>
                <ul className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {cursosSeleccionados.map(c => (
                    <li key={c.id} className="flex items-center justify-between text-slate-700 bg-white p-2 rounded border border-slate-200 text-[11px]">
                      <span className="font-bold">{c.nivel} {c.letra}</span>
                      <span className="text-slate-500">{c.matriculaProyectada} estudiantes • {c.regimen}</span>
                    </li>
                  ))}
                </ul>

                <div className="border-t pt-2 space-y-1">
                  <div className="font-bold text-slate-800">Nuevo Curso Combinado que se Creará:</div>
                  <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200 flex items-center justify-between">
                    <div>
                      <div className="font-black text-indigo-950 text-sm">
                        {nombrePersonalizado.trim() || nombreSugerido} {letra}
                      </div>
                      <div className="text-[11px] text-indigo-800">
                        Jornada: {regimen} • Proporción: {regimenProporcion === '60_40' ? '60/40' : '65/35'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900 text-sm">{totalMatricula} estudiantes</div>
                      <div className="text-[11px] text-purple-700 font-bold">{totalNeet}T • {totalNeep}P PIE</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de confirmación final */}
            <div className="shrink-0 p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPasoConfirmacion(false)}
                disabled={procesando}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ← Volver a Modificar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCerrar}
                  disabled={procesando}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEjecutarCombinacion}
                  disabled={procesando}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {procesando ? (
                    <span>Combinando cursos...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar y Combinar Cursos</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
