import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Users,
  Clock,
  ArrowRight,
  X,
  RefreshCw,
  Search,
  Filter,
  Check,
  ChevronDown,
  Building2,
  HelpCircle,
  Sliders,
  Settings2,
  Layers,
  GraduationCap,
  ShieldCheck
} from 'lucide-react';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../../data/slepSchoolsCatalog';
import {
  SchoolSummary,
  TeacherRecord,
  CourseLoadSummary,
  TeacherConsolidatedLoad,
  HomologacionItem,
  TraspasoConfig,
  TraspasoResult
} from '../../types/analizadorTypes';
import {
  buildHomologacionList,
  getAsignaturasSugeridasParaNivel
} from '../../services/analizador/homologationService';
import { ejecutarTraspasoDotacionAnalizador } from '../../database/db';

interface TraspasoDotacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: SchoolSummary[];
  teachers: TeacherRecord[];
  courses: CourseLoadSummary[];
  teacherLoads: TeacherConsolidatedLoad[];
  apiKey?: string;
  selectedModel: string;
  onTransferSuccess: (result: TraspasoResult, targetRbd?: string) => void;
}

export const TraspasoDotacionModal: React.FC<TraspasoDotacionModalProps> = ({
  isOpen,
  onClose,
  schools,
  teachers,
  courses,
  teacherLoads,
  apiKey,
  selectedModel,
  onTransferSuccess,
}) => {
  const [loadingHomologation, setLoadingHomologation] = useState(false);
  const [homologacionItems, setHomologacionItems] = useState<HomologacionItem[]>([]);
  const [editedHomologaciones, setEditedHomologaciones] = useState<Record<string, string>>({});
  const [selectedRbds, setSelectedRbds] = useState<string[]>([]);
  const [targetRbdOverride, setTargetRbdOverride] = useState<string>('');
  const [cursosJecMap, setCursosJecMap] = useState<Record<string, 'JEC' | 'No JEC'>>({});
  const [cursosProporcionMap, setCursosProporcionMap] = useState<Record<string, '65_35' | '60_40'>>({});
  const [activeTab, setActiveTab] = useState<'homologacion' | 'cursos'>('homologacion');
  const [modo, setModo] = useState<'REEMPLAZAR' | 'FUSIONAR'>('REEMPLAZAR');
  const [executing, setExecuting] = useState(false);
  const [step, setStep] = useState<'review' | 'success'>('review');
  const [result, setResult] = useState<TraspasoResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'TODAS' | 'BAJA' | 'IA' | 'PIE' | 'TALLER' | 'INSTITUCIONAL' | 'APOYO'>('TODAS');
  const [statusMsg, setStatusMsg] = useState('');

  // Inicializar colegios seleccionados, cursos y homologaciones al abrir
  useEffect(() => {
    if (!isOpen) return;

    setStep('review');
    setResult(null);
    setSelectedRbds(schools.map((s) => s.rbd));
    if (schools.length > 0 && !targetRbdOverride) {
      setTargetRbdOverride(schools[0].rbd);
    }

    // Inicializar mapas de régimen de cursos
    const initialJec: Record<string, 'JEC' | 'No JEC'> = {};
    const initialProp: Record<string, '65_35' | '60_40'> = {};
    for (const c of courses) {
      const isParv = c.nivel.toLowerCase().includes('parv') || c.nivel.toLowerCase().includes('nt');
      initialJec[c.curso] = isParv ? 'No JEC' : 'JEC';
      const isNTorPrimerCiclo =
        isParv ||
        /^[1-4][°\.\s]?[bB]/.test(c.nivel) ||
        c.nivel.includes('1°') ||
        c.nivel.includes('2°') ||
        c.nivel.includes('3°') ||
        c.nivel.includes('4°');
      if (isNTorPrimerCiclo) {
        initialProp[c.curso] = '65_35';
      }
    }
    setCursosJecMap(initialJec);
    setCursosProporcionMap(initialProp);

    const runHomologation = async () => {
      setLoadingHomologation(true);
      setStatusMsg('Analizando asignaturas con planes de estudio MINEDUC...');
      try {
        const items = await buildHomologacionList(
          teachers,
          teacherLoads,
          apiKey,
          selectedModel,
          (msg) => setStatusMsg(msg)
        );
        setHomologacionItems(items);

        // Prellenar mapa de edición
        const initialMap: Record<string, string> = {};
        for (const it of items) {
          initialMap[it.key] = it.asignaturaOficial;
        }
        setEditedHomologaciones(initialMap);
      } catch (err) {
        console.error('Error generando homologaciones:', err);
      } finally {
        setLoadingHomologation(false);
        setStatusMsg('');
      }
    };

    runHomologation();
  }, [isOpen, schools, teachers, courses, teacherLoads, apiKey, selectedModel]);

  // Manejar cambio manual de una homologación por el usuario
  const handleHomologacionChange = (key: string, newOficial: string) => {
    setEditedHomologaciones((prev) => ({
      ...prev,
      [key]: newOficial,
    }));
    setHomologacionItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? { ...item, asignaturaOficial: newOficial, fuente: 'MANUAL', confianza: 'ALTA' }
          : item
      )
    );
  };

  // Filtrar asignaturas mostradas en la tabla
  const filteredItems = useMemo(() => {
    return homologacionItems.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.rawSubject.toLowerCase().includes(q) ||
                            item.asignaturaOficial.toLowerCase().includes(q) ||
                            item.nivel.toLowerCase().includes(q);
        if (!matchesName) return false;
      }

      if (activeFilter === 'BAJA') return item.confianza === 'BAJA';
      if (activeFilter === 'IA') return item.fuente === 'IA_GEMINI';
      if (activeFilter === 'INSTITUCIONAL') return Boolean(item.esDirectivo || item.esTecnicoPedagogico || item.esCoordinacionPie || item.esConvivencia || item.esExtraescolar);
      if (activeFilter === 'APOYO') return Boolean(item.esCoDocencia || item.esAgrupacionFlexible);
      if (activeFilter === 'PIE') return Boolean(item.esPie);
      if (activeFilter === 'TALLER') return Boolean(item.esTallerJec || item.esTallerSep);
      return true;
    });
  }, [homologacionItems, searchQuery, activeFilter]);

  // Detección preventiva de descuadres y alertas para el resumen
  const alertasPreventivas = useMemo(() => {
    const list: string[] = [];
    const over44 = teacherLoads.filter((d) => d.is_over_legal_limit || d.horas_contrato > 44);
    if (over44.length > 0) {
      list.push(`${over44.length} docente(s) superan el tope legal de 44 horas semanales de contrato.`);
    }

    const subasignados = teacherLoads.filter((d) => d.estado_carga === 'SUBASIGNADA');
    if (subasignados.length > 0) {
      list.push(`${subasignados.length} docente(s) tienen horas de contrato mayores a sus horas de aula (horas no lectivas preservadas en contrato).`);
    }

    const unmapped = homologacionItems.filter((i) => i.confianza === 'BAJA');
    if (unmapped.length > 0) {
      list.push(`${unmapped.length} asignatura(s) con confianza baja requieren revisión.`);
    }

    return list;
  }, [teacherLoads, homologacionItems]);

  const totalHorasAsignadas = useMemo(() => {
    return homologacionItems.reduce((acc, curr) => acc + curr.horasTotales, 0);
  }, [homologacionItems]);

  // Ejecutar Traspaso a la Base de Datos SQLite
  const handleConfirmarTraspaso = async () => {
    if (selectedRbds.length === 0 && !targetRbdOverride) {
      alert('Debes seleccionar al menos un colegio para traspasar.');
      return;
    }

    setExecuting(true);
    try {
      const config: TraspasoConfig = {
        periodo: 2026,
        modo,
        homologaciones: editedHomologaciones,
        colegiosRbd: selectedRbds,
        targetRbdOverride: targetRbdOverride ? targetRbdOverride : undefined,
        cursosJecMap,
        cursosProporcionMap,
      };

      const res = await ejecutarTraspasoDotacionAnalizador(config, {
        schools,
        teachers,
        courses,
        teacherLoads,
      });

      setResult(res);
      setStep('success');
    } catch (err: any) {
      console.error('Error durante el traspaso a SQLite:', err);
      alert(`Ocurrió un error al guardar en la base de datos: ${err.message || err}`);
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera Apple Style */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-orange-950 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center text-orange-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">Traspaso Inteligente a Dotación 2026</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500/30 text-orange-300 border border-orange-400/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {selectedModel}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Homologación oficial de asignaturas según planes MINEDUC y alimentación de la cartera escolar 2026
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Principal */}
        {step === 'review' ? (
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Mensaje de progreso IA */}
            {loadingHomologation && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3 animate-pulse">
                <RefreshCw className="w-5 h-5 text-orange-600 animate-spin" />
                <div className="text-xs font-semibold text-orange-900">
                  {statusMsg || 'Homologando asignaturas contra los planes y programas oficiales de MINEDUC...'}
                </div>
              </div>
            )}

            {/* KPIs y Resumen de Cuadratura */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Colegios</div>
                <div className="text-xl font-black text-slate-800 mt-0.5">{selectedRbds.length}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cursos</div>
                <div className="text-xl font-black text-slate-800 mt-0.5">{courses.length}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Docentes</div>
                <div className="text-xl font-black text-slate-800 mt-0.5">{teacherLoads.length}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                <div className="text-[11px] font-semibold text-orange-700 uppercase tracking-wider">Horas Aula Totales</div>
                <div className="text-xl font-black text-orange-900 mt-0.5">{Math.round(totalHorasAsignadas)} hrs</div>
              </div>
            </div>

            {/* Alertas Preventivas */}
            {alertasPreventivas.length > 0 && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Verificaciones de Cuadratura y Advertencias Previas</span>
                </div>
                <ul className="text-xs text-amber-800 list-disc list-inside pl-1 space-y-0.5">
                  {alertasPreventivas.map((al, idx) => (
                    <li key={idx}>{al}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Selector de Establecimiento Destino */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                    <Building2 className="w-4 h-4 text-orange-600" />
                    <span>Establecimiento Destino en Dotación 2026:</span>
                  </label>
                  <select
                    value={targetRbdOverride}
                    onChange={(e) => setTargetRbdOverride(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm"
                  >
                    <optgroup label="Establecimientos Detectados en Planilla">
                      {schools.map((s) => (
                        <option key={s.rbd} value={s.rbd}>
                          RBD {s.rbd} - {s.establishment} ({s.comuna || 'Territorio Diguillín'})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Catálogo Oficial SLEP Valle Diguillín (131 Establecimientos)">
                      {SLEP_VALLE_DIGUILLIN_SCHOOLS.map((sc) => (
                        <option key={sc.rbd} value={sc.rbd}>
                          RBD {sc.rbd} - {sc.nombre} ({sc.comuna})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="sm:w-64">
                  <div className="text-xs font-bold text-slate-700 mb-1.5">Modo de Inserción:</div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="modo"
                        value="REEMPLAZAR"
                        checked={modo === 'REEMPLAZAR'}
                        onChange={() => setModo('REEMPLAZAR')}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-slate-800 font-bold">Reemplazar</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="modo"
                        value="FUSIONAR"
                        checked={modo === 'FUSIONAR'}
                        onChange={() => setModo('FUSIONAR')}
                        className="text-slate-600"
                      />
                      <span className="text-slate-600">Fusionar</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjetas informativas de reglas normativas: Recreo/HL, Talleres SEP y Funciones Institucionales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-blue-900">Recreos y No Lectivas (HL): </span>
                  <span className="text-blue-800">
                    Se computan como proporción contractual (65/35 o 60/40) y se excluyen de la carga lectiva del curso.
                  </span>
                </div>
              </div>
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-emerald-900">Talleres SEP: </span>
                  <span className="text-emerald-800">
                    Clasificados como extracurriculares sin sumar demanda obligatoria al plan curricular oficial.
                  </span>
                </div>
              </div>
              <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-purple-900">Directivas, UTP & Coordinaciones: </span>
                  <span className="text-purple-800">
                    Se cargan a gestión institucional del docente sin sobrecargar los cursos. Co-docencia y agrupaciones flexibles van como apoyo en aula.
                  </span>
                </div>
              </div>
            </div>

            {/* Pestañas de Ajuste Previo */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('homologacion')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === 'homologacion'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Homologación de Asignaturas ({filteredItems.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cursos')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === 'cursos'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Ajuste de Cursos & Régimen JEC / 65-35 ({courses.length})</span>
              </button>
            </div>

            {/* Vista Tab 1: Homologación de Asignaturas */}
            {activeTab === 'homologacion' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-orange-600" />
                      Homologación Curricular de Asignaturas ({filteredItems.length} detectadas)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Verifica cómo se mapeará cada asignatura encontrada en las planillas al plan oficial MINEDUC. Puedes cambiar cualquier sugerencia usando el menú desplegable.
                    </p>
                  </div>

                  {/* Buscador y Filtros */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar asignatura..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 w-40 sm:w-48"
                      />
                    </div>

                    <select
                      value={activeFilter}
                      onChange={(e: any) => setActiveFilter(e.target.value)}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500 font-semibold text-slate-600"
                    >
                      <option value="TODAS">Todas</option>
                      <option value="BAJA">Confianza Baja</option>
                      <option value="IA">Homologadas por IA</option>
                      <option value="INSTITUCIONAL">Directivas / UTP / Coord.</option>
                      <option value="APOYO">Co-Docencia / Agrup. Flexibles</option>
                      <option value="PIE">Apoyo PIE</option>
                      <option value="TALLER">Talleres JEC / SEP</option>
                    </select>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="p-3">Asignatura en Planilla</th>
                        <th className="p-3">Curso / Nivel</th>
                        <th className="p-3 text-center">Horas</th>
                        <th className="p-3">Asignatura Oficial MINEDUC (Editable)</th>
                        <th className="p-3 text-center">Origen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item) => {
                        const sugerencias = getAsignaturasSugeridasParaNivel(item.nivel);
                        const currentVal = editedHomologaciones[item.key] || item.asignaturaOficial;

                        return (
                          <tr key={item.key} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-semibold text-slate-800">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{item.rawSubject}</span>
                                {item.esDirectivo && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    Directiva
                                  </span>
                                )}
                                {item.esTecnicoPedagogico && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                    UTP
                                  </span>
                                )}
                                {item.esCoordinacionPie && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    Coord. PIE
                                  </span>
                                )}
                                {item.esConvivencia && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-100 text-pink-800 border border-pink-200">
                                    Convivencia
                                  </span>
                                )}
                                {item.esExtraescolar && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                                    Extraescolar
                                  </span>
                                )}
                                {item.esCoDocencia && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Co-Docencia
                                  </span>
                                )}
                                {item.esAgrupacionFlexible && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                                    Agrup. Flexible
                                  </span>
                                )}
                                {item.esTallerSep && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-800 border border-green-200">
                                    Taller SEP
                                  </span>
                                )}
                                {item.esProporcionDocente && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                    Recreo / HL
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                {item.docentesCount} docente(s) dictando
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                                {item.nivel}
                              </span>
                            </td>
                            <td className="p-3 text-center font-black text-slate-800">
                              {item.horasTotales}h
                            </td>
                            <td className="p-3">
                              <div className="relative">
                                <select
                                  value={currentVal}
                                  onChange={(e) => handleHomologacionChange(item.key, e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                >
                                  {!sugerencias.includes(currentVal) && (
                                    <option value={currentVal}>{currentVal} (Actual)</option>
                                  )}
                                  {sugerencias.map((sug) => (
                                    <option key={sug} value={sug}>
                                      {sug}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {item.justificacion && (
                                <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs" title={item.justificacion}>
                                  {item.justificacion}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {item.fuente === 'IA_GEMINI' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  IA
                                </span>
                              ) : item.fuente === 'MANUAL' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  Manual
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  MINEDUC
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

            {/* Vista Tab 2: Cursos & Régimen JEC y Proporción Docente */}
            {activeTab === 'cursos' && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-orange-600" />
                    Configuración de Régimen por Curso ({courses.length} cursos detectados)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ajusta si cada curso opera en Jornada Escolar Completa (JEC 38h) o No JEC (30h), y define el régimen de proporción contractual (65/35 o 60/40) para cursos de NT1 a 4° Básico.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="p-3">Curso / Nivel</th>
                        <th className="p-3 text-center">Docentes</th>
                        <th className="p-3 text-center">Horas Totales</th>
                        <th className="p-3">Jornada Escolar (JEC)</th>
                        <th className="p-3">Régimen Proporción Docente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {courses.map((c) => {
                        const currentJec = cursosJecMap[c.curso] || ((c.nivel.toLowerCase().includes('parv') || c.nivel.toLowerCase().includes('nt')) ? 'No JEC' : 'JEC');
                        const currentProp = cursosProporcionMap[c.curso] || '65_35';
                        const isNTorPrimerCiclo =
                          c.nivel.toLowerCase().includes('parv') ||
                          c.nivel.toLowerCase().includes('nt') ||
                          /^[1-4][°\.\s]?[bB]/.test(c.nivel) ||
                          c.nivel.includes('1°') ||
                          c.nivel.includes('2°') ||
                          c.nivel.includes('3°') ||
                          c.nivel.includes('4°');

                        return (
                          <tr key={c.curso} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-semibold text-slate-800">
                              <div className="flex items-center gap-2">
                                <GraduationCap className="w-4 h-4 text-slate-400" />
                                <span>{c.curso}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                                Nivel: {c.nivel} {c.letra ? `(${c.letra})` : ''}
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700">
                              {(c.docentes || []).length}
                            </td>
                            <td className="p-3 text-center font-black text-slate-800">
                              {c.total_horas}h
                            </td>
                            <td className="p-3">
                              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                                <button
                                  type="button"
                                  onClick={() => setCursosJecMap(prev => ({ ...prev, [c.curso]: 'JEC' }))}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                    currentJec === 'JEC'
                                      ? 'bg-orange-600 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  JEC (38h)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCursosJecMap(prev => ({ ...prev, [c.curso]: 'No JEC' }))}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                    currentJec === 'No JEC'
                                      ? 'bg-slate-800 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  No JEC (30h)
                                </button>
                              </div>
                            </td>
                            <td className="p-3">
                              {isNTorPrimerCiclo ? (
                                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                                  <button
                                    type="button"
                                    onClick={() => setCursosProporcionMap(prev => ({ ...prev, [c.curso]: '65_35' }))}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                      currentProp === '65_35'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    65/35 (Estándar)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCursosProporcionMap(prev => ({ ...prev, [c.curso]: '60_40' }))}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                      currentProp === '60_40'
                                        ? 'bg-purple-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    60/40 (Prioritario)
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                  65/35 Ley 20.903
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
        ) : (
          /* Pantalla de Éxito */
          <div className="p-10 space-y-6 text-center max-w-lg mx-auto animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">¡Traspaso Exitoso a Dotación 2026!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Los datos procesados y sus asignaturas homologadas fueron guardados en la base SQLite local con régimen de planes de estudio oficiales.
              </p>
            </div>

            {result && (
              <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Cursos</div>
                  <div className="text-xl font-black text-slate-800">{result.cursosCreados}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Docentes</div>
                  <div className="text-xl font-black text-slate-800">{result.docentesGuardados}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Asignaciones</div>
                  <div className="text-xl font-black text-orange-600">{result.asignacionesGuardadas}</div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Permanecer en Analizador
              </button>
              <button
                onClick={() => {
                  const targetRbd = selectedRbds[0];
                  if (result) onTransferSuccess(result, targetRbd);
                  onClose();
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <span>Ir al Colegio en Dotación 2026</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Footer con Acciones */}
        {step === 'review' && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {selectedRbds.length} de {schools.length} colegio(s) seleccionados • {filteredItems.length} asignaturas homologadas
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                disabled={executing}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarTraspaso}
                disabled={executing || selectedRbds.length === 0}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-600/30 flex items-center gap-2 transition-all"
              >
                {executing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando en SQLite 2026...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Traspaso a Dotación 2026</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
