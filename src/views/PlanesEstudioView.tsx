import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Search, Plus, Edit2, Trash2, Link2, CheckCircle2, ShieldCheck,
  Sparkles, Layers, ArrowRight, X, Clock, GraduationCap, School, Check,
  AlertCircle, AlertTriangle, RefreshCw, FileText, ChevronDown, ChevronRight,
  SlidersHorizontal, Award, Globe, BookCheck, HelpCircle, Copy
} from 'lucide-react';
import {
  PlanEstudioCurricular,
  AsignaturaPlanEstudio,
  AmbitoFormativoPlan,
  Establecimiento,
  CursoSae
} from '../types';
import {
  listarPlanesEstudio,
  guardarPlanEstudio,
  eliminarPlanEstudio,
  adjuntarPlanACursos,
  poblarPlanesEstudioEnDb,
  PLAN_EPJA_2024_OFICIAL_JSON,
  getDb,
  persistDb
} from '../database/db';
import { OrientacionesDecreto0876Modal } from './curriculum/components/OrientacionesDecreto0876Modal';

interface PlanesEstudioViewProps {
  colegios: Establecimiento[];
  colegioActivo: Establecimiento | null;
  todosLosCursos: CursoSae[];
  periodoActivo?: number;
  onSelectColegio?: (est: Establecimiento) => void;
  onAbrirWorkflow?: (est: Establecimiento) => void;
  onRefreshCursos?: () => Promise<void> | void;
}

export const PlanesEstudioView: React.FC<PlanesEstudioViewProps> = ({
  colegios,
  colegioActivo,
  todosLosCursos,
  periodoActivo = 2026,
  onSelectColegio,
  onAbrirWorkflow,
  onRefreshCursos
}) => {
  const [planes, setPlanes] = useState<PlanEstudioCurricular[]>([]);
  const [cargando, setCargando] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [planSeleccionadoDetalle, setPlanSeleccionadoDetalle] = useState<PlanEstudioCurricular | null>(null);

  // Modales
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [modalAdjuntarAbierto, setModalAdjuntarAbierto] = useState(false);
  const [modalOrientacionesAbierto, setModalOrientacionesAbierto] = useState(false);
  const [planParaAdjuntar, setPlanParaAdjuntar] = useState<PlanEstudioCurricular | null>(null);
  const [planEnEdicion, setPlanEnEdicion] = useState<PlanEstudioCurricular | null>(null);

  // Estado para adjuntar
  const [colegioSeleccionadoParaAdjuntar, setColegioSeleccionadoParaAdjuntar] = useState<string>(
    colegioActivo?.rbd || (colegios[0]?.rbd || '')
  );
  const [cursosSeleccionadosParaAdjuntar, setCursosSeleccionadosParaAdjuntar] = useState<string[]>([]);
  const [procesandoAdjuntar, setProcesandoAdjuntar] = useState(false);
  const [mensajeToast, setMensajeToast] = useState<{ texto: string; tipo: 'success' | 'error' } | null>(null);

  const mostrarFeedback = (texto: string, tipo: 'success' | 'error' = 'success') => {
    setMensajeToast({ texto, tipo });
    setTimeout(() => setMensajeToast(null), 4000);
  };

  const cargarPlanes = async () => {
    setCargando(true);
    try {
      const data = await listarPlanesEstudio();
      setPlanes(data);
    } catch (e: any) {
      console.error('Error al cargar planes de estudio:', e);
      mostrarFeedback(`Error al cargar planes: ${e.message}`, 'error');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPlanes();
  }, []);

  // Categorías de filtro
  const categorias = [
    { id: 'ALL', label: 'Todos los Planes', count: planes.length },
    { id: 'EPJA', label: '🌟 EPJA 2024 (Dec. 10/2022)', count: planes.filter(p => p.categoria === 'EPJA').length },
    { id: 'BASICA', label: 'Educación Básica', count: planes.filter(p => p.categoria === 'BASICA').length },
    { id: 'MEDIA_HC', label: 'Media HC', count: planes.filter(p => p.categoria === 'MEDIA_HC').length },
    { id: 'MEDIA_TP', label: 'Media TP (Especialidades)', count: planes.filter(p => p.categoria === 'MEDIA_TP').length },
    { id: 'ESPECIAL', label: 'Educación Especial', count: planes.filter(p => p.categoria === 'ESPECIAL').length },
    { id: 'LABORAL', label: 'Talleres Laborales', count: planes.filter(p => p.categoria === 'LABORAL').length },
    { id: 'MULTIGRADO', label: 'Multigrado', count: planes.filter(p => p.categoria === 'MULTIGRADO').length },
    { id: 'PARVULARIA', label: 'Parvularia', count: planes.filter(p => p.categoria === 'PARVULARIA').length }
  ];

  // Filtrado reactivo
  const planesFiltrados = useMemo(() => {
    return planes.filter(p => {
      if (categoriaFiltro !== 'ALL' && p.categoria !== categoriaFiltro) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      const matchNivel = p.nivel.toLowerCase().includes(q);
      const matchDoc = (p.documento || '').toLowerCase().includes(q);
      const matchDecreto = (p.decretoSupremo || '').toLowerCase().includes(q);
      const matchAsig = p.asignaturas.some(a => a.nombre.toLowerCase().includes(q));
      return matchNivel || matchDoc || matchDecreto || matchAsig;
    });
  }, [planes, categoriaFiltro, searchTerm]);

  // Cursos del colegio seleccionado para adjuntar
  const cursosColegioSeleccionado = useMemo(() => {
    return todosLosCursos.filter(c => c.rbd === colegioSeleccionadoParaAdjuntar && (c.periodo === undefined || c.periodo === periodoActivo));
  }, [todosLosCursos, colegioSeleccionadoParaAdjuntar, periodoActivo]);

  // Handlers
  const handleAbrirModalAdjuntar = (plan: PlanEstudioCurricular) => {
    setPlanParaAdjuntar(plan);
    setColegioSeleccionadoParaAdjuntar(colegioActivo?.rbd || (colegios[0]?.rbd || ''));
    setCursosSeleccionadosParaAdjuntar([]);
    setModalAdjuntarAbierto(true);
  };

  const handleEjecutarAdjuntar = async () => {
    if (!planParaAdjuntar || cursosSeleccionadosParaAdjuntar.length === 0) return;
    setProcesandoAdjuntar(true);
    try {
      const res = await adjuntarPlanACursos(
        planParaAdjuntar.id,
        colegioSeleccionadoParaAdjuntar,
        cursosSeleccionadosParaAdjuntar,
        periodoActivo
      );
      if (onRefreshCursos) await onRefreshCursos();
      mostrarFeedback(`✓ Plan "${planParaAdjuntar.nivel}" adjuntado exitosamente a ${res.cursosActualizados} curso(s).`);
      setModalAdjuntarAbierto(false);
    } catch (e: any) {
      mostrarFeedback(`Error al adjuntar: ${e.message}`, 'error');
    } finally {
      setProcesandoAdjuntar(false);
    }
  };

  const handleAbrirNuevoPlan = () => {
    setPlanEnEdicion({
      id: `plan_custom_${Date.now()}`,
      nivel: 'Nuevo Plan Personalizado',
      regimen: 'JEC',
      categoria: 'OTRO',
      documento: 'Plan de Estudio Propio del Establecimiento',
      decretoSupremo: 'Resolución Exenta / Plan Propio',
      ministerio: 'Ministerio de Educación - Gobierno de Chile',
      duracionAnoLectivoSemanas: 36,
      totalHorasSemanalesObligatorias: 38,
      totalHorasAnualesObligatorias: 1368,
      horasLibreDisposicion: 6,
      asignaturas: [
        { id: 'asig-1', nombre: 'Lenguaje y Comunicación', horasSemanales: 6, horasAnuales: 216, caracter: 'Obligatoria' },
        { id: 'asig-2', nombre: 'Matemática', horasSemanales: 6, horasAnuales: 216, caracter: 'Obligatoria' },
        { id: 'asig-3', nombre: 'Ciencias Naturales', horasSemanales: 4, horasAnuales: 144, caracter: 'Obligatoria' }
      ],
      esPersonalizado: true
    });
    setModalEditarAbierto(true);
  };

  const handleAbrirEditarPlan = (plan: PlanEstudioCurricular) => {
    setPlanEnEdicion(JSON.parse(JSON.stringify(plan)));
    setModalEditarAbierto(true);
  };

  const handleDuplicarPlan = (plan: PlanEstudioCurricular) => {
    const clon: PlanEstudioCurricular = {
      ...JSON.parse(JSON.stringify(plan)),
      id: `plan_custom_${Date.now()}`,
      nivel: `${plan.nivel} (Copia Personalizada)`,
      esPersonalizado: true
    };
    setPlanEnEdicion(clon);
    setModalEditarAbierto(true);
  };

  const handleGuardarPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planEnEdicion) return;

    // Calcular total de horas desde las asignaturas
    const totalOblig = planEnEdicion.asignaturas
      .filter(a => a.caracter !== 'Opcional')
      .reduce((acc, a) => acc + (Number(a.horasSemanales) || 0), 0);
    
    const planFinal: PlanEstudioCurricular = {
      ...planEnEdicion,
      totalHorasSemanalesObligatorias: totalOblig,
      totalHorasAnualesObligatorias: totalOblig * (planEnEdicion.duracionAnoLectivoSemanas || 36),
      totalHorasPlan: totalOblig + (planEnEdicion.horasLibreDisposicion || 0)
    };

    try {
      await guardarPlanEstudio(planFinal);
      await cargarPlanes();
      setModalEditarAbierto(false);
      mostrarFeedback(`✓ Plan "${planFinal.nivel}" guardado exitosamente.`);
    } catch (err: any) {
      mostrarFeedback(`Error al guardar plan: ${err.message}`, 'error');
    }
  };

  const handleEliminarPlan = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar el plan "${nombre}"?`)) return;
    try {
      await eliminarPlanEstudio(id);
      await cargarPlanes();
      mostrarFeedback(`Plan "${nombre}" eliminado.`);
    } catch (e: any) {
      mostrarFeedback(`Error al eliminar: ${e.message}`, 'error');
    }
  };

  const handleRestaurarOficiales = async () => {
    if (!confirm('¿Deseas sincronizar y restaurar todos los Planes Oficiales MINEDUC y EPJA 2024?')) return;
    try {
      const db = await getDb();
      poblarPlanesEstudioEnDb(db);
      persistDb();
      await cargarPlanes();
      mostrarFeedback('✓ Planes Oficiales MINEDUC y EPJA 2024 restaurados con éxito.');
    } catch (e: any) {
      mostrarFeedback(`Error al restaurar: ${e.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Toast Feedback */}
      {mensajeToast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2 animate-scale-in backdrop-blur-md ${
          mensajeToast.tipo === 'success'
            ? 'bg-slate-900 text-emerald-300 border border-emerald-500/50'
            : 'bg-red-900 text-red-200 border border-red-500/50'
        }`}>
          {mensajeToast.tipo === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
          <span>{mensajeToast.texto}</span>
        </div>
      )}

      {/* ── 1. HEADER HERO DEL CATÁLOGO ── */}
      <div className="card-elevated p-6 bg-gradient-to-r from-surface-card via-surface-card to-slate-50/50 dark:to-slate-900/50 border border-border-subtle flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-black uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Matrices & Bases Curriculares Oficiales</span>
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              • {planes.length} Planes Disponibles
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-2">
            Catálogo de Planes de Estudio & EPJA 2024
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed mt-1">
            Consulta oficial de asignaturas, distribución horaria semanal/anual, ámbitos formativos y vinculación directa a los cursos del SLEP Valle Diguillín.
          </p>
        </div>

        {/* Acciones Superiores */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setModalOrientacionesAbierto(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 hover:from-blue-800 hover:to-purple-700 text-white text-xs font-black rounded-2xl shadow-md transition-all active:scale-[0.98]"
            title="Consultar Decreto Exento N° 0876/2019, Catálogo de 27 Asignaturas HC y Validador de Oferta"
          >
            <GraduationCap className="w-4 h-4 text-blue-200" />
            <span>Orientaciones 3° y 4° Medio (Dto. 0876/2019)</span>
          </button>

          <button
            onClick={handleRestaurarOficiales}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-2xl border border-slate-300 dark:border-slate-700 transition-all shadow-xs"
            title="Recargar y sincronizar planes oficiales desde el motor MINEDUC"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restaurar Oficiales</span>
          </button>

          <button
            onClick={handleAbrirNuevoPlan}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-2xl shadow-md transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Plan</span>
          </button>
        </div>
      </div>

      {/* ── 2. BARRA DE CATEGORÍAS & FILTROS ── */}
      <div className="card-elevated p-4 space-y-3 shadow-sm">
        
        {/* Píldoras de Categoría */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoriaFiltro(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                categoriaFiltro === cat.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                categoriaFiltro === cat.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nivel, decreto, asignatura o especialidad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Mostrando <strong>{planesFiltrados.length}</strong> de {planes.length} planes
          </span>
        </div>

      </div>

      {/* ── 3. LISTADO DE PLANES DE ESTUDIO (GRID) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {planesFiltrados.map((plan) => {
          const esEpja = plan.categoria === 'EPJA';
          const esTp = plan.categoria === 'MEDIA_TP';
          const cursosVinculados = todosLosCursos.filter(c => c.planEstudioId === plan.id);

          return (
            <div
              key={plan.id}
              className={`card-elevated p-5 flex flex-col justify-between group relative transition-all duration-200 hover:-translate-y-0.5 ${
                esEpja ? 'border-amber-400/80 bg-amber-500/[0.02]' : ''
              }`}
            >
              <div>
                
                {/* Header de Tarjeta */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wider ${
                      esEpja
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                        : esTp
                        ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-800'
                        : 'bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-800'
                    }`}>
                      {plan.categoria}
                    </span>

                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      {plan.regimen}
                    </span>

                    {plan.esPersonalizado && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-300">
                        Personalizado
                      </span>
                    )}
                  </div>

                  {/* Horas Badge */}
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                      {plan.totalHorasSemanalesObligatorias} hrs/sem
                    </span>
                    {plan.totalHorasAnualesObligatorias && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                        {plan.totalHorasAnualesObligatorias} hrs/año
                      </span>
                    )}
                  </div>
                </div>

                {/* Título & Decreto */}
                <h3 className="font-black text-slate-900 dark:text-white text-base mt-2.5 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {plan.nivel}
                </h3>

                {plan.decretoSupremo && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold flex items-center gap-1">
                    <FileText className="w-3 h-3 text-slate-400" />
                    <span>{plan.decretoSupremo}</span>
                  </p>
                )}

                {/* Organización Modular (EPJA) */}
                {plan.organizacionModular && (
                  <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 font-bold flex items-center justify-between">
                    <span>Org. Modular: {plan.organizacionModular.modulosObligatorios} obligatorios + {plan.organizacionModular.modulosElectivos} electivos</span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">36 sem</span>
                  </div>
                )}

                {/* Vista previa de Asignaturas */}
                <div className="mt-3 space-y-1">
                  <div className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-wider">
                    Asignaturas ({plan.asignaturas.length}):
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {plan.asignaturas.map((asig, idx) => (
                      <div
                        key={asig.id || idx}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold"
                      >
                        <span className="truncate max-w-[180px] text-slate-800 dark:text-slate-200">{asig.nombre}</span>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            asig.caracter === 'Opcional' ? 'bg-amber-100 text-amber-800' :
                            asig.caracter === 'Electiva' ? 'bg-purple-100 text-purple-800' :
                            'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            {asig.caracter || 'Oblig.'}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white tabular-nums">{asig.horasSemanales}h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cursos Vinculados en el Territorio */}
                {cursosVinculados.length > 0 && (
                  <div className="mt-3 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                    <span>{cursosVinculados.length} curso(s) vinculados a este plan</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                )}

              </div>

              {/* Botonera de Acción */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAbrirEditarPlan(plan)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                    title="Editar asignaturas y horas del plan"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDuplicarPlan(plan)}
                    className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition-colors"
                    title="Duplicar para crear versión personalizada"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {plan.esPersonalizado && (
                    <button
                      onClick={() => handleEliminarPlan(plan.id, plan.nivel)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                      title="Eliminar plan personalizado"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleAbrirModalAdjuntar(plan)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-sm active:scale-[0.98]"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Adjuntar a Cursos</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* ── 4. MODAL ADJUNTAR PLAN A CURSOS ── */}
      {modalAdjuntarAbierto && planParaAdjuntar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="card-elevated max-w-lg w-full p-6 shadow-2xl space-y-4 border border-border-subtle animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Adjuntar Plan a Cursos
                </h3>
              </div>
              <button onClick={() => setModalAdjuntarAbierto(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen del Plan */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-200 dark:border-blue-800/60 text-xs">
              <div className="font-black text-blue-900 dark:text-blue-100">{planParaAdjuntar.nivel}</div>
              <div className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                Carga horaria: <strong>{planParaAdjuntar.totalHorasSemanalesObligatorias} hrs semanales</strong> • {planParaAdjuntar.asignaturas.length} asignaturas obligatorias
              </div>
            </div>

            {/* Selector de Escuela */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                Seleccionar Establecimiento:
              </label>
              <select
                value={colegioSeleccionadoParaAdjuntar}
                onChange={(e) => {
                  setColegioSeleccionadoParaAdjuntar(e.target.value);
                  setCursosSeleccionadosParaAdjuntar([]);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl p-2.5"
              >
                {colegios.map(c => (
                  <option key={c.rbd} value={c.rbd}>
                    {c.nombre} (RBD {c.rbd} - {c.comuna})
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de Cursos del Establecimiento */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                  Seleccionar Cursos Destino ({cursosColegioSeleccionado.length} en este colegio):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (cursosSeleccionadosParaAdjuntar.length === cursosColegioSeleccionado.length) {
                      setCursosSeleccionadosParaAdjuntar([]);
                    } else {
                      setCursosSeleccionadosParaAdjuntar(cursosColegioSeleccionado.map(c => c.id));
                    }
                  }}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {cursosSeleccionadosParaAdjuntar.length === cursosColegioSeleccionado.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>

              {cursosColegioSeleccionado.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500 font-semibold">
                  No hay cursos registrados en este colegio para el periodo activo.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  {cursosColegioSeleccionado.map(c => {
                    const seleccionado = cursosSeleccionadosParaAdjuntar.includes(c.id);
                    const tieneEstePlan = c.planEstudioId === planParaAdjuntar.id;
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold ${
                          seleccionado ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-950 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={seleccionado}
                            onChange={() => {
                              setCursosSeleccionadosParaAdjuntar(prev =>
                                prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                              );
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>{c.nivel} {c.letra}</span>
                          <span className="text-[10px] text-slate-500">({c.regimen})</span>
                        </div>
                        {tieneEstePlan && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                            Ya asignado
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setModalAdjuntarAbierto(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEjecutarAdjuntar}
                disabled={procesandoAdjuntar || cursosSeleccionadosParaAdjuntar.length === 0}
                className="px-5 py-2 text-xs font-black bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-md"
              >
                {procesandoAdjuntar ? 'Adjuntando...' : `Confirmar Vinculación (${cursosSeleccionadosParaAdjuntar.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. MODAL EDITAR / CREAR PLAN DE ESTUDIO ── */}
      {modalEditarAbierto && planEnEdicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="card-elevated max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-border-subtle animate-scale-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  {planEnEdicion.esPersonalizado ? 'Editar / Personalizar Plan de Estudio' : 'Editar Plan de Estudio'}
                </h3>
              </div>
              <button onClick={() => setModalEditarAbierto(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarPlan} className="space-y-4 overflow-y-auto flex-1 pr-1">
              
              {/* Metadatos Generales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                    Nombre del Nivel / Plan
                  </label>
                  <input
                    type="text"
                    required
                    value={planEnEdicion.nivel}
                    onChange={(e) => setPlanEnEdicion({ ...planEnEdicion, nivel: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                    Categoría
                  </label>
                  <select
                    value={planEnEdicion.categoria}
                    onChange={(e) => setPlanEnEdicion({ ...planEnEdicion, categoria: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="EPJA">🌟 EPJA (Adultos)</option>
                    <option value="BASICA">Educación Básica</option>
                    <option value="MEDIA_HC">Media Humanístico-Científica</option>
                    <option value="MEDIA_TP">Media Técnico-Profesional</option>
                    <option value="ESPECIAL">Educación Especial</option>
                    <option value="LABORAL">Talleres Laborales</option>
                    <option value="MULTIGRADO">Multigrado / Combinada</option>
                    <option value="PARVULARIA">Parvularia</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                    Régimen
                  </label>
                  <select
                    value={planEnEdicion.regimen}
                    onChange={(e) => {
                      const nuevoReg = e.target.value as 'JEC' | 'No JEC';
                      setPlanEnEdicion({ 
                        ...planEnEdicion, 
                        regimen: nuevoReg,
                        horasLibreDisposicion: planEnEdicion.horasLibreDisposicion ?? (nuevoReg === 'JEC' ? 6 : 0)
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="JEC">JEC (Jornada Completa)</option>
                    <option value="No JEC">No JEC (Media Jornada)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                    Horas Libre Disp. / JEC
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={20}
                    value={planEnEdicion.horasLibreDisposicion ?? 0}
                    onChange={(e) => setPlanEnEdicion({ ...planEnEdicion, horasLibreDisposicion: Number(e.target.value) || 0 })}
                    placeholder="Ej: 6"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white text-center"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                    Decreto / Referencia
                  </label>
                  <input
                    type="text"
                    value={planEnEdicion.decretoSupremo || ''}
                    onChange={(e) => setPlanEnEdicion({ ...planEnEdicion, decretoSupremo: e.target.value })}
                    placeholder="Ej: Dto. Exento N° 2960/2012"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                    Año Lectivo (Semanas)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={planEnEdicion.duracionAnoLectivoSemanas || 36}
                    onChange={(e) => setPlanEnEdicion({ ...planEnEdicion, duracionAnoLectivoSemanas: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white text-center"
                  />
                </div>
              </div>

              {/* Resumen en vivo de Horas del Plan */}
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 p-2.5 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Horas Obligatorias</span>
                    <strong className="text-slate-800 dark:text-white font-black text-sm">
                      {planEnEdicion.asignaturas.filter(a => a.caracter !== 'Opcional').reduce((s, a) => s + (Number(a.horasSemanales) || 0), 0)} HA
                    </strong>
                  </div>
                  <div className="border-l border-blue-200 dark:border-blue-800 pl-4">
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 block uppercase font-bold">Libre Disposición</span>
                    <strong className="text-amber-700 dark:text-amber-300 font-black text-sm">
                      {planEnEdicion.horasLibreDisposicion || 0} HA
                    </strong>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 block uppercase font-bold">Total Plan Semanal</span>
                  <strong className="text-blue-900 dark:text-blue-200 font-black text-base">
                    {(planEnEdicion.asignaturas.filter(a => a.caracter !== 'Opcional').reduce((s, a) => s + (Number(a.horasSemanales) || 0), 0)) + (Number(planEnEdicion.horasLibreDisposicion) || 0)} HA
                  </strong>
                </div>
              </div>

              {/* Editor de Asignaturas */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Asignaturas del Plan ({planEnEdicion.asignaturas.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanEnEdicion({
                        ...planEnEdicion,
                        asignaturas: [
                          ...planEnEdicion.asignaturas,
                          {
                            id: `asig-${Date.now()}`,
                            nombre: 'Nueva Asignatura',
                            horasSemanales: 2,
                            horasAnuales: 72,
                            caracter: 'Obligatoria'
                          }
                        ]
                      });
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Asignatura</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {planEnEdicion.asignaturas.map((asig, index) => (
                    <div
                      key={asig.id || index}
                      className="grid grid-cols-12 gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 items-center text-xs"
                    >
                      <div className="col-span-5">
                        <input
                          type="text"
                          required
                          value={asig.nombre}
                          onChange={(e) => {
                            const copia = [...planEnEdicion.asignaturas];
                            copia[index].nombre = e.target.value;
                            setPlanEnEdicion({ ...planEnEdicion, asignaturas: copia });
                          }}
                          placeholder="Nombre asignatura"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs font-bold"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="44"
                          required
                          value={asig.horasSemanales}
                          onChange={(e) => {
                            const copia = [...planEnEdicion.asignaturas];
                            const sem = Number(e.target.value) || 0;
                            copia[index].horasSemanales = sem;
                            copia[index].horasAnuales = sem * (planEnEdicion.duracionAnoLectivoSemanas || 36);
                            setPlanEnEdicion({ ...planEnEdicion, asignaturas: copia });
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs font-bold text-center"
                        />
                      </div>

                      <div className="col-span-3">
                        <select
                          value={asig.caracter || 'Obligatoria'}
                          onChange={(e) => {
                            const copia = [...planEnEdicion.asignaturas];
                            copia[index].caracter = e.target.value as any;
                            setPlanEnEdicion({ ...planEnEdicion, asignaturas: copia });
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs font-bold"
                        >
                          <option value="Obligatoria">Obligatoria</option>
                          <option value="Opcional">Opcional</option>
                          <option value="Electiva">Electiva</option>
                          <option value="Instrumental">Instrumental</option>
                        </select>
                      </div>

                      <div className="col-span-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const copia = planEnEdicion.asignaturas.filter((_, i) => i !== index);
                            setPlanEnEdicion({ ...planEnEdicion, asignaturas: copia });
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle shrink-0">
                <button
                  type="button"
                  onClick={() => setModalEditarAbierto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md"
                >
                  Guardar Cambios
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── 6. MODAL ORIENTACIONES Y VALIDADOR CURRICULAR 3° Y 4° MEDIO (DTO. 0876/2019) ── */}
      <OrientacionesDecreto0876Modal
        abierto={modalOrientacionesAbierto}
        onCerrar={() => setModalOrientacionesAbierto(false)}
      />

    </div>
  );
};
