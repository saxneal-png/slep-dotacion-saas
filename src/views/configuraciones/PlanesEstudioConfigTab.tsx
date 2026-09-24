import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, FileUp, Download, Plus, Search, RefreshCw, Trash2, Edit2,
  CheckCircle2, AlertTriangle, FileSpreadsheet, Code, Sparkles, Layers,
  ShieldCheck, Eye, X, Check, HelpCircle, Copy, ArrowRight, Table,
  Clock, Award, BookCheck
} from 'lucide-react';
import { PlanEstudioCurricular, AsignaturaPlanEstudio, AmbitoFormativoPlan } from '../../types';
import {
  listarPlanesEstudio,
  guardarPlanEstudio,
  eliminarPlanEstudio,
  poblarPlanesEstudioEnDb
} from '../../database/db';
import {
  exportarPlanesEstudioJson,
  exportarPlanesEstudioExcel,
  importarPlanesEstudioDesdeJson,
  importarPlanesEstudioDesdeExcel,
  IngestaPlanesResultado
} from '../../services/planesEstudioExportImportService';
import { inicializarPlanesEstudioAnalizador } from '../../services/analizador/planesEstudioBridge';

export const PlanesEstudioConfigTab: React.FC = () => {
  const [planes, setPlanes] = useState<PlanEstudioCurricular[]>([]);
  const [cargando, setCargando] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('ALL');
  const [notificacion, setNotificacion] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  // Modales
  const [modalIngestaAbierto, setModalIngestaAbierto] = useState(false);
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [planSeleccionado, setPlanSeleccionado] = useState<PlanEstudioCurricular | null>(null);
  const [planEnEdicion, setPlanEnEdicion] = useState<PlanEstudioCurricular | null>(null);

  // Estado del modal de ingesta
  const [modoIngesta, setModoIngesta] = useState<'archivo' | 'pegar_json'>('archivo');
  const [jsonPegado, setJsonPegado] = useState('');
  const [procesandoIngesta, setProcesandoIngesta] = useState(false);
  const [resultadoIngesta, setResultadoIngesta] = useState<IngestaPlanesResultado | null>(null);

  const mostrarMensaje = (mensaje: string, tipo: 'success' | 'error' = 'success') => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => setNotificacion(null), 4000);
  };

  const recargarPlanes = async () => {
    try {
      setCargando(true);
      const lista = await listarPlanesEstudio();
      setPlanes(lista);
      // Sincronizar también con la memoria del analizador
      await inicializarPlanesEstudioAnalizador();
    } catch (err: any) {
      mostrarMensaje(`Error cargando planes: ${err.message || err}`, 'error');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    recargarPlanes();
  }, []);

  // Estadísticas y Métricas
  const stats = useMemo(() => {
    const total = planes.length;
    const epja = planes.filter(p => p.categoria === 'EPJA' || p.nivel.toLowerCase().includes('epja') || p.nivel.toLowerCase().includes('adult')).length;
    const tp = planes.filter(p => p.categoria === 'MEDIA_TP' || p.nivel.toLowerCase().includes('tp') || p.nivel.toLowerCase().includes('especialidad')).length;
    const basica = planes.filter(p => p.categoria === 'BASICA' || p.nivel.toLowerCase().includes('básic') || p.nivel.toLowerCase().includes('basic')).length;
    const mediaHc = planes.filter(p => p.categoria === 'MEDIA_HC' || (p.nivel.toLowerCase().includes('medio') && !p.nivel.toLowerCase().includes('tp'))).length;
    const especiales = planes.filter(p => p.categoria === 'ESPECIAL' || p.categoria === 'LABORAL').length;
    const personalizados = planes.filter(p => p.esPersonalizado).length;

    return { total, epja, tp, basica, mediaHc, especiales, personalizados };
  }, [planes]);

  // Filtrado de planes
  const planesFiltrados = useMemo(() => {
    return planes.filter(p => {
      if (filtroCategoria !== 'ALL') {
        if (filtroCategoria === 'EPJA' && p.categoria !== 'EPJA' && !p.nivel.toLowerCase().includes('epja') && !p.nivel.toLowerCase().includes('adult')) return false;
        if (filtroCategoria === 'BASICA' && p.categoria !== 'BASICA' && !p.nivel.toLowerCase().includes('básico') && !p.nivel.toLowerCase().includes('basico')) return false;
        if (filtroCategoria === 'MEDIA_HC' && p.categoria !== 'MEDIA_HC' && (!p.nivel.toLowerCase().includes('medio') || p.nivel.toLowerCase().includes('tp'))) return false;
        if (filtroCategoria === 'MEDIA_TP' && p.categoria !== 'MEDIA_TP' && !p.nivel.toLowerCase().includes('tp') && !p.nivel.toLowerCase().includes('especialidad')) return false;
        if (filtroCategoria === 'ESPECIAL_LABORAL' && p.categoria !== 'ESPECIAL' && p.categoria !== 'LABORAL') return false;
        if (filtroCategoria === 'PERSONALIZADOS' && !p.esPersonalizado) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const mNivel = p.nivel.toLowerCase().includes(q);
        const mDec = (p.decretoSupremo || '').toLowerCase().includes(q);
        const mDoc = (p.documento || '').toLowerCase().includes(q);
        const mAsig = (p.asignaturas || []).some(a => a.nombre.toLowerCase().includes(q));
        const mAmb = (p.ambitosFormativos || []).some(amb => amb.ambito.toLowerCase().includes(q));
        return mNivel || mDec || mDoc || mAsig || mAmb;
      }

      return true;
    });
  }, [planes, filtroCategoria, searchTerm]);

  // Manejador de Ingesta desde Archivo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesandoIngesta(true);
    setResultadoIngesta(null);

    try {
      let res: IngestaPlanesResultado;
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        res = await importarPlanesEstudioDesdeJson(text);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        res = await importarPlanesEstudioDesdeExcel(file);
      } else {
        throw new Error('Formato no soportado. Por favor sube un archivo .json o .xlsx');
      }

      setResultadoIngesta(res);
      if (res.exito) {
        await recargarPlanes();
        mostrarMensaje(`✓ Se importaron ${res.planesInsertados} planes de estudio exitosamente.`);
      } else {
        mostrarMensaje(`Fallo en la ingesta: ${res.errores.join(' ')}`, 'error');
      }
    } catch (err: any) {
      mostrarMensaje(`Error procesando archivo: ${err.message || err}`, 'error');
    } finally {
      setProcesandoIngesta(false);
      e.target.value = '';
    }
  };

  // Manejador de Ingesta desde JSON Pegado
  const handleIngestaTextoJson = async () => {
    if (!jsonPegado.trim()) {
      mostrarMensaje('Por favor pega el código JSON de los planes a importar.', 'error');
      return;
    }

    setProcesandoIngesta(true);
    setResultadoIngesta(null);

    try {
      const res = await importarPlanesEstudioDesdeJson(jsonPegado);
      setResultadoIngesta(res);
      if (res.exito) {
        await recargarPlanes();
        mostrarMensaje(`✓ Se procesaron y guardaron ${res.planesInsertados} planes en SQLite.`);
        setJsonPegado('');
      } else {
        mostrarMensaje(`Fallo en la importación: ${res.errores.join(' ')}`, 'error');
      }
    } catch (err: any) {
      mostrarMensaje(`Error de sintaxis JSON: ${err.message || err}`, 'error');
    } finally {
      setProcesandoIngesta(false);
    }
  };

  // Re-sincronización de fábrica
  const handleResincronizarOficiales = async () => {
    if (confirm('¿Deseas re-sembrar y sincronizar todos los planes oficiales MINEDUC y EPJA 2024 (Decreto Supremo N° 10/2022)?')) {
      try {
        setCargando(true);
        await poblarPlanesEstudioEnDb();
        await recargarPlanes();
        mostrarMensaje('✓ Planes oficiales MINEDUC y EPJA 2024 re-sincronizados con éxito.');
      } catch (err: any) {
        mostrarMensaje(`Error en sincronización: ${err.message || err}`, 'error');
      } finally {
        setCargando(false);
      }
    }
  };

  // Eliminar plan
  const handleEliminarPlan = async (id: string, nivel: string) => {
    if (confirm(`¿Estás seguro de eliminar el plan de estudio "${nivel}"?`)) {
      try {
        await eliminarPlanEstudio(id);
        await recargarPlanes();
        mostrarMensaje(`✓ Plan "${nivel}" eliminado.`);
      } catch (err: any) {
        mostrarMensaje(`Error al eliminar: ${err.message || err}`, 'error');
      }
    }
  };

  return (
    <div className="space-y-6">

      {/* Toast Notificación */}
      {notificacion && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce ${
            notificacion.tipo === 'success'
              ? 'bg-slate-900 text-emerald-300 border border-emerald-500/50'
              : 'bg-red-900 text-red-200 border border-red-500/50'
          }`}
        >
          {notificacion.tipo === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
          <span>{notificacion.mensaje}</span>
        </div>
      )}

      {/* Tarjeta de Control & Herramientas de Ingesta/Exportación */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                Motor Curricular Activo
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> SQLite Transaccional
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1.5 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Catálogo de Planes de Estudio & Módulo de Ingesta
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Administra, visualiza, ingesta y exporta matrices curriculares completas (MINEDUC, EPJA 2024 Dto. 10/2022, Técnico-Profesional, Especial y Planes Propios) sin necesidad de modificar el código fuente.
            </p>
          </div>

          {/* Botonera de Ingesta y Exportación */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setModalIngestaAbierto(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              title="Importar planes de estudio desde archivo JSON o Excel"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Ingestar Planes (JSON / Excel)</span>
            </button>

            <button
              onClick={() => exportarPlanesEstudioJson(planes)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors border border-slate-200"
              title="Descargar catálogo completo en formato JSON estructurado"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Exportar JSON</span>
            </button>

            <button
              onClick={() => exportarPlanesEstudioExcel(planes)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              title="Descargar planilla Excel oficial con resumen y detalle de asignaturas"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleResincronizarOficiales}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors border border-slate-200"
              title="Re-sincronizar planes oficiales de fábrica"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tarjetas KPI de Planes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Planes</div>
            <div className="text-xl font-black text-slate-900 mt-0.5">{stats.total}</div>
            <div className="text-[10px] text-slate-500 font-medium">Disponibles en el SLEP</div>
          </div>

          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">EPJA 2024</div>
            <div className="text-xl font-black text-emerald-900 mt-0.5">{stats.epja}</div>
            <div className="text-[10px] text-emerald-600 font-medium">Dto. Supremo 10/2022</div>
          </div>

          <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl">
            <div className="text-[10px] font-black uppercase tracking-wider text-sky-700">Técnico-Prof.</div>
            <div className="text-xl font-black text-sky-900 mt-0.5">{stats.tp}</div>
            <div className="text-[10px] text-sky-600 font-medium">Oficios y Especialidades</div>
          </div>

          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="text-[10px] font-black uppercase tracking-wider text-blue-700">Básica Regular</div>
            <div className="text-xl font-black text-blue-900 mt-0.5">{stats.basica}</div>
            <div className="text-[10px] text-blue-600 font-medium">1° a 8° Básico</div>
          </div>

          <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Media HC</div>
            <div className="text-xl font-black text-indigo-900 mt-0.5">{stats.mediaHc}</div>
            <div className="text-[10px] text-indigo-600 font-medium">1° a 4° Medio</div>
          </div>

          <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl">
            <div className="text-[10px] font-black uppercase tracking-wider text-purple-700">Personalizados</div>
            <div className="text-xl font-black text-purple-900 mt-0.5">{stats.personalizados}</div>
            <div className="text-[10px] text-purple-600 font-medium">Ajustados localmente</div>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'EPJA', label: 'EPJA 2024 (Dto. 10)' },
              { id: 'BASICA', label: 'Básica' },
              { id: 'MEDIA_HC', label: 'Media HC' },
              { id: 'MEDIA_TP', label: 'Media TP' },
              { id: 'ESPECIAL_LABORAL', label: 'Especial / Laboral' },
              { id: 'PERSONALIZADOS', label: 'Personalizados' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setFiltroCategoria(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  filtroCategoria === cat.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar plan, decreto o asignatura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabla Interactiva de Planes de Estudio */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white border-b border-slate-800">
                <th className="p-3 font-extrabold tracking-tight">Nivel / Modalidad</th>
                <th className="p-3 font-extrabold tracking-tight text-center">Categoría</th>
                <th className="p-3 font-extrabold tracking-tight text-center">Régimen</th>
                <th className="p-3 font-extrabold tracking-tight">Decreto / Referencia</th>
                <th className="p-3 font-extrabold tracking-tight text-center">Hrs. Obligatorias</th>
                <th className="p-3 font-extrabold tracking-tight text-center">Total Hrs. Plan</th>
                <th className="p-3 font-extrabold tracking-tight text-center">Asignaturas</th>
                <th className="p-3 font-extrabold tracking-tight text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {planesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No se encontraron planes de estudio que coincidan con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                planesFiltrados.map((p) => {
                  const esEpja = p.categoria === 'EPJA' || p.nivel.toLowerCase().includes('epja') || p.nivel.toLowerCase().includes('adult');
                  const esTp = p.categoria === 'MEDIA_TP' || p.nivel.toLowerCase().includes('tp');
                  const totalHrs = p.totalHorasPlan || p.totalHorasSemanalesObligatorias;

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{p.nivel}</span>
                          {esEpja && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800">
                              EPJA 2024
                            </span>
                          )}
                          {p.esPersonalizado && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-100 text-purple-800">
                              Personalizado
                            </span>
                          )}
                        </div>
                        {p.equivalenciaRegular && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Equivalencia: {p.equivalenciaRegular}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          esEpja ? 'bg-emerald-100 text-emerald-800' :
                          esTp ? 'bg-sky-100 text-sky-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {p.categoria}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                          {p.regimen}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="text-xs font-semibold text-slate-800">
                          {p.decretoSupremo || 'Decreto Oficial MINEDUC'}
                        </div>
                        {p.organizacionModular && (
                          <div className="text-[10px] text-blue-600 font-medium">
                            {p.organizacionModular.modulosObligatorios} Mód. Obligatorios + {p.organizacionModular.modulosElectivos} Electivos
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-center font-mono font-bold text-slate-900">
                        {p.totalHorasSemanalesObligatorias} hrs
                      </td>

                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-md font-mono font-black bg-blue-100 text-blue-900">
                          {totalHrs} hrs
                        </span>
                      </td>

                      <td className="p-3 text-center font-bold text-slate-600">
                        {p.asignaturas?.length || 0} materias
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setPlanSeleccionado(p);
                              setModalDetalleAbierto(true);
                            }}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalle curricular completo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {p.esPersonalizado && (
                            <button
                              onClick={() => handleEliminarPlan(p.id, p.nivel)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar plan personalizado"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: INGESTA / IMPORTACIÓN ASISTIDA */}
      {modalIngestaAbierto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Ingesta e Importación de Planes de Estudio
                  </h3>
                  <p className="text-xs text-slate-500">
                    Carga paquetes curriculares estructurados en formato JSON o planillas Excel (.xlsx / .csv)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalIngestaAbierto(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas de Modo de Ingesta */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setModoIngesta('archivo')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  modoIngesta === 'archivo' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cargar Archivo (.json / .xlsx)
              </button>
              <button
                onClick={() => setModoIngesta('pegar_json')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  modoIngesta === 'pegar_json' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pegar Código JSON Directo
              </button>
            </div>

            {/* Contenido Modo 1: Carga de Archivo */}
            {modoIngesta === 'archivo' && (
              <div className="space-y-4">
                <label className="block border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/50 transition-all group">
                  <FileUp className="w-8 h-8 text-slate-400 group-hover:text-blue-600 mx-auto mb-2 transition-colors" />
                  <span className="block text-xs font-black text-slate-700 group-hover:text-blue-700">
                    Haz clic o arrastra un archivo de Planes de Estudio
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-1">
                    Formatos admitidos: <strong>.json</strong> (Estructurado Oficial / EPJA) o <strong>.xlsx</strong> (Planilla Excel)
                  </span>
                  <input
                    type="file"
                    accept=".json,.xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={procesandoIngesta}
                  />
                </label>
              </div>
            )}

            {/* Contenido Modo 2: Pegar JSON Directo */}
            {modoIngesta === 'pegar_json' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Código JSON de Matrices Curriculares:</span>
                  <button
                    onClick={() => {
                      setJsonPegado(`{
  "planes_de_estudio_epja": [
    {
      "nivel": "Educación Básica - Nivel 1 (1° a 4° Básico)",
      "total_horas_semanales_obligatorias": 10.0,
      "total_horas_anuales_obligatorias": 360,
      "ambitos_formativos": [
        {
          "ambito": "Formación General",
          "caracter": "Obligatoria",
          "horas_semanales_subtotal": 10.0,
          "asignaturas": [
            { "nombre": "Lenguaje y Comunicación", "horas_semanales": 5.0 },
            { "nombre": "Matemática", "horas_semanales": 5.0 }
          ]
        }
      ]
    }
  ]
}`);
                    }}
                    className="text-[10px] text-blue-600 hover:underline font-bold"
                  >
                    Insertar Plantilla EPJA de Ejemplo
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={jsonPegado}
                  onChange={(e) => setJsonPegado(e.target.value)}
                  placeholder='Pega aquí el objeto JSON con "planes_de_estudio" o "planes_de_estudio_epja"...'
                  className="w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleIngestaTextoJson}
                  disabled={procesandoIngesta || !jsonPegado.trim()}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{procesandoIngesta ? 'Procesando e indexando...' : 'Validar y Cargar en Base de Datos SQLite'}</span>
                </button>
              </div>
            )}

            {/* Resultado de la Ingesta */}
            {resultadoIngesta && (
              <div className={`p-4 rounded-xl text-xs space-y-1.5 border ${
                resultadoIngesta.exito ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
              }`}>
                <div className="font-black flex items-center gap-1.5">
                  {resultadoIngesta.exito ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                  <span>{resultadoIngesta.exito ? 'Ingesta Completada' : 'Error en la Ingesta'}</span>
                </div>
                {resultadoIngesta.mensajes.map((m, idx) => (
                  <div key={idx} className="text-[11px] text-emerald-800">{m}</div>
                ))}
                {resultadoIngesta.errores.map((e, idx) => (
                  <div key={idx} className="text-[11px] text-red-800">⚠️ {e}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: VISTA DETALLADA DE UN PLAN DE ESTUDIO */}
      {modalDetalleAbierto && planSeleccionado && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header Detalle */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white">
                    {planSeleccionado.categoria}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-slate-300">
                    {planSeleccionado.regimen}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-1.5">
                  {planSeleccionado.nivel}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {planSeleccionado.decretoSupremo || 'MINEDUC Oficial'} • {planSeleccionado.duracionAnoLectivoSemanas || 36} Semanas Lectivas
                </p>
              </div>
              <button
                onClick={() => setModalDetalleAbierto(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo con Scroll */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Resumen Horas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <div className="text-[10px] font-black uppercase text-blue-700">Hrs. Semanales Oblig.</div>
                  <div className="text-xl font-black text-blue-900 mt-0.5">
                    {planSeleccionado.totalHorasSemanalesObligatorias} hrs
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <div className="text-[10px] font-black uppercase text-emerald-700">Hrs. Anuales Oblig.</div>
                  <div className="text-xl font-black text-emerald-900 mt-0.5">
                    {planSeleccionado.totalHorasAnualesObligatorias || (planSeleccionado.totalHorasSemanalesObligatorias * 36)} hrs
                  </div>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                  <div className="text-[10px] font-black uppercase text-purple-700">Total Plan con Libre Disp.</div>
                  <div className="text-xl font-black text-purple-900 mt-0.5">
                    {planSeleccionado.totalHorasPlan || planSeleccionado.totalHorasSemanalesObligatorias} hrs
                  </div>
                </div>
              </div>

              {/* Organización Modular sugerida */}
              {planSeleccionado.organizacionModular && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-700" />
                    <span className="font-bold">Estructura Modular Oficial:</span>
                  </div>
                  <div className="font-mono font-bold text-amber-950">
                    {planSeleccionado.organizacionModular.modulosObligatorios} Módulos Obligatorios + {planSeleccionado.organizacionModular.modulosElectivos} Electivos ({planSeleccionado.organizacionModular.duracionModuloSemanas} semanas por módulo)
                  </div>
                </div>
              )}

              {/* Ámbitos Formativos */}
              {planSeleccionado.ambitosFormativos && planSeleccionado.ambitosFormativos.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Ámbitos Formativos ({planSeleccionado.ambitosFormativos.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {planSeleccionado.ambitosFormativos.map((amb, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{amb.ambito}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">
                            {amb.horasSemanalesSubtotal} hrs/sem
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Carácter: {amb.caracter}
                        </div>
                        {amb.catalogoAsignaturasElegibles && (
                          <div className="text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 font-mono mt-1">
                            Catálogo: {amb.catalogoAsignaturasElegibles.join(' • ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Asignaturas Desglosadas */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <BookCheck className="w-4 h-4 text-emerald-600" />
                  Malla de Asignaturas ({planSeleccionado.asignaturas?.length || 0})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2.5">Asignatura / Módulo</th>
                        <th className="p-2.5 text-center">Horas Semanales</th>
                        <th className="p-2.5 text-center">Horas Anuales</th>
                        <th className="p-2.5 text-center">Carácter</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {(planSeleccionado.asignaturas || []).map((asig, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-900 font-bold">{asig.nombre}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-blue-700">{asig.horasSemanales} hrs</td>
                          <td className="p-2.5 text-center font-mono text-slate-600">{asig.horasAnuales || asig.horasSemanales * 36} hrs</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              asig.caracter === 'Obligatoria' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {asig.caracter || 'Obligatoria'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setModalDetalleAbierto(false)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
