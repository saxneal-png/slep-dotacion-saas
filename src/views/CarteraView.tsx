import React, { useState, useMemo } from 'react';
import {
  Building2, Plus, FileUp, FileDown, MapPin, Users, School, Trash2, Edit, Database,
  FileSpreadsheet, Eraser, Search, RotateCcw, X, UserCheck, ChevronRight, MoreVertical,
  CheckCircle2, ArrowUpDown, Filter, Download
} from 'lucide-react';
import { Establecimiento, ComunaValleDiguillin, RegimenJornada } from '../types';
import { ConfirmarVaciarDotacionModal } from '../components/ConfirmarVaciarDotacionModal';
import { cargarConfiguracionGeneral } from '../services/configuracionGeneralService';

interface CarteraViewProps {
  colegios: Establecimiento[];
  colegioActivo: Establecimiento | null;
  onSelectColegio: (est: Establecimiento) => void;
  onGuardarColegio: (est: Establecimiento) => Promise<void>;
  onEliminarColegio: (id: string) => Promise<void>;
  onExportarCarteraSlep: () => void;
  onImportarCarteraSlep: (file: File) => void;
  onAbrirModuloSige: () => void;
  onAbrirWorkflow?: (est: Establecimiento) => void;
  onExportarSqlite: () => void;
  onImportarSqlite: (file: File) => void;
  periodoActivo?: number;
  onLimpiarDotacionColegio?: (periodo: number, rbd: string) => Promise<void>;
  onExportarDotacionColegio?: (est: Establecimiento, periodo: number) => Promise<void> | void;
  onExportarMatrizExcelColegio?: (est: Establecimiento, periodo: number) => Promise<void> | void;
  onAbrirColegiosAsesorados?: () => void;
}

const COMUNAS: ComunaValleDiguillin[] = [
  'Bulnes',
  'Chillán',
  'Chillán Viejo',
  'El Carmen',
  'Pemuco',
  'San Ignacio',
  'Yungay'
];

export const CarteraView: React.FC<CarteraViewProps> = ({
  colegios,
  colegioActivo,
  onSelectColegio,
  onGuardarColegio,
  onEliminarColegio,
  onExportarCarteraSlep,
  onImportarCarteraSlep,
  onAbrirModuloSige,
  onAbrirWorkflow,
  onExportarSqlite,
  onImportarSqlite,
  periodoActivo = 2026,
  onLimpiarDotacionColegio,
  onExportarDotacionColegio,
  onExportarMatrizExcelColegio,
  onAbrirColegiosAsesorados
}) => {
  const [config] = useState(() => cargarConfiguracionGeneral());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEst, setEditingEst] = useState<Establecimiento | null>(null);
  const [colegioParaVaciar, setColegioParaVaciar] = useState<Establecimiento | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComunaFilter, setSelectedComunaFilter] = useState<string>('ALL');
  const [selectedRegimenFilter, setSelectedRegimenFilter] = useState<string>('ALL');
  const [selectedProporcionFilter, setSelectedProporcionFilter] = useState<string>('ALL');
  const [selectedAsesorFilter, setSelectedAsesorFilter] = useState<string>('ALL');
  const [selectedOrden, setSelectedOrden] = useState<string>('NOMBRE_ASC');

  // Lista de asesores únicos
  const listaAsesores = useMemo(() => {
    const set = new Set<string>();
    for (const c of colegios) {
      if (c.asesorUatp && c.asesorUatp.trim()) set.add(c.asesorUatp.trim());
    }
    for (const a of config.asesoresRegistrados) {
      if (a.nombre.trim()) set.add(a.nombre.trim());
    }
    return Array.from(set).sort();
  }, [colegios, config.asesoresRegistrados]);

  const hayFiltrosActivos = searchTerm !== '' || selectedComunaFilter !== 'ALL' || selectedRegimenFilter !== 'ALL' || selectedProporcionFilter !== 'ALL' || selectedAsesorFilter !== 'ALL';

  const limpiarFiltros = () => {
    setSearchTerm('');
    setSelectedComunaFilter('ALL');
    setSelectedRegimenFilter('ALL');
    setSelectedProporcionFilter('ALL');
    setSelectedAsesorFilter('ALL');
    setSelectedOrden('NOMBRE_ASC');
  };

  const filteredColegios = useMemo(() => {
    return colegios.filter((c) => {
      if (selectedComunaFilter !== 'ALL' && c.comuna !== selectedComunaFilter) return false;
      if (selectedRegimenFilter !== 'ALL' && c.regimen !== selectedRegimenFilter) return false;
      if (selectedProporcionFilter === '60_40' && c.porcentajePrioritarios < 80) return false;
      if (selectedProporcionFilter === '65_35' && c.porcentajePrioritarios >= 80) return false;
      if (selectedAsesorFilter === 'SIN_ASIGNAR') {
        if (c.asesorUatp && c.asesorUatp.trim() !== '') return false;
      } else if (selectedAsesorFilter !== 'ALL') {
        if (!c.asesorUatp || c.asesorUatp.toLowerCase().trim() !== selectedAsesorFilter.toLowerCase().trim()) return false;
      }
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.rbd.toLowerCase().includes(q) ||
        (c.comuna && c.comuna.toLowerCase().includes(q)) ||
        (c.director && c.director.toLowerCase().includes(q)) ||
        (c.asesorUatp && c.asesorUatp.toLowerCase().includes(q))
      );
    }).sort((a, b) => {
      if (selectedOrden === 'NOMBRE_ASC') return a.nombre.localeCompare(b.nombre);
      if (selectedOrden === 'NOMBRE_DESC') return b.nombre.localeCompare(a.nombre);
      if (selectedOrden === 'RBD_ASC') return Number(a.rbd) - Number(b.rbd);
      if (selectedOrden === 'COMUNA_ASC') return a.comuna.localeCompare(b.comuna);
      return 0;
    });
  }, [colegios, selectedComunaFilter, selectedRegimenFilter, selectedProporcionFilter, selectedAsesorFilter, searchTerm, selectedOrden]);

  const [formRbd, setFormRbd] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formComuna, setFormComuna] = useState<ComunaValleDiguillin>('Chillán');
  const [formRegimen, setFormRegimen] = useState<RegimenJornada>('JEC');
  const [formPrioritarios, setFormPrioritarios] = useState(80);
  const [formDirector, setFormDirector] = useState('');
  const [formAsesor, setFormAsesor] = useState('UATP Valle Diguillín');
  const [formError, setFormError] = useState<string | null>(null);

  const abrirModalNuevo = () => {
    setEditingEst(null);
    setFormRbd('');
    setFormNombre('');
    setFormComuna('Bulnes');
    setFormRegimen('JEC');
    setFormPrioritarios(80);
    setFormDirector('');
    setFormAsesor('UATP Valle Diguillín');
    setFormError(null);
    setModalOpen(true);
  };

  const abrirModalEditar = (est: Establecimiento) => {
    setEditingEst(est);
    setFormRbd(est.rbd);
    setFormNombre(est.nombre);
    setFormComuna(est.comuna);
    setFormRegimen(est.regimen);
    setFormPrioritarios(est.porcentajePrioritarios);
    setFormDirector(est.director || '');
    setFormAsesor(est.asesorUatp || 'UATP Valle Diguillín');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const rbdClean = formRbd.trim();
    const nombreClean = formNombre.trim();

    if (!rbdClean) {
      setFormError('El RBD es obligatorio.');
      return;
    }
    if (!nombreClean) {
      setFormError('El nombre del establecimiento es obligatorio.');
      return;
    }

    try {
      const nuevo: Establecimiento = {
        id: editingEst ? editingEst.id : `est-${rbdClean}`,
        rbd: rbdClean,
        nombre: nombreClean,
        comuna: formComuna,
        regimen: formRegimen,
        porcentajePrioritarios: Number(formPrioritarios),
        director: formDirector.trim() || undefined,
        asesorUatp: formAsesor.trim() || undefined
      };

      await onGuardarColegio(nuevo);
      setModalOpen(false);
    } catch (err: any) {
      setFormError(`Error al guardar: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* ── 1. HEADER DE CARTERA TERRITORIAL ── */}
      <div className="card-elevated p-5 sm:p-6 bg-gradient-to-r from-surface-card via-surface-card to-slate-50/50 dark:to-slate-900/50 border border-border-subtle flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Cartera Territorial de Colegios UATP
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Gestión y catálogo de los <strong>{colegios.length}</strong> establecimientos educacionales del SLEP Valle Diguillín.
          </p>
        </div>

        {/* Acciones Principales */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onAbrirModuloSige}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all shadow-xs"
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>Ingestar SIGE</span>
          </button>

          <button
            onClick={onExportarCarteraSlep}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all shadow-xs"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Exportar (.slep)</span>
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all shadow-xs cursor-pointer">
            <FileUp className="w-3.5 h-3.5" />
            <span>Importar (.slep)</span>
            <input
              type="file"
              accept=".slep,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportarCarteraSlep(file);
              }}
            />
          </label>

          <button
            onClick={abrirModalNuevo}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Colegio</span>
          </button>
        </div>
      </div>

      {/* ── 2. BARRA DE FILTROS AVANZADOS ── */}
      <div className="card-elevated p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          
          {/* Asesor */}
          <div>
            <label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 block mb-1">
              Asesor UATP
            </label>
            <select
              value={selectedAsesorFilter}
              onChange={(e) => setSelectedAsesorFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl p-2 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">Todos los Asesores</option>
              <option value="SIN_ASIGNAR">⚠️ Sin Asignar</option>
              {listaAsesores.map((a) => (
                <option key={a} value={a}>👤 {a}</option>
              ))}
            </select>
          </div>

          {/* Comuna */}
          <div>
            <label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 block mb-1">
              Comuna
            </label>
            <select
              value={selectedComunaFilter}
              onChange={(e) => setSelectedComunaFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl p-2 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">Todas las Comunas ({colegios.length})</option>
              {COMUNAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Régimen */}
          <div>
            <label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 block mb-1">
              Régimen Jornada
            </label>
            <select
              value={selectedRegimenFilter}
              onChange={(e) => setSelectedRegimenFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl p-2 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">Todos los Regímenes</option>
              <option value="JEC">JEC</option>
              <option value="No JEC">No JEC</option>
              <option value="Mixto">Mixto</option>
            </select>
          </div>

          {/* Tramo Ley 20.903 */}
          <div>
            <label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 block mb-1">
              Tramo Ley 20.903
            </label>
            <select
              value={selectedProporcionFilter}
              onChange={(e) => setSelectedProporcionFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl p-2 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">Todos los Tramos</option>
              <option value="65_35">65/35 (General)</option>
              <option value="60_40">60/40 (≥80% Prioritarios)</option>
            </select>
          </div>

          {/* Ordenar Por */}
          <div>
            <label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 block mb-1">
              Ordenar Por
            </label>
            <select
              value={selectedOrden}
              onChange={(e) => setSelectedOrden(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl p-2 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="NOMBRE_ASC">Nombre (A — Z)</option>
              <option value="NOMBRE_DESC">Nombre (Z — A)</option>
              <option value="RBD_ASC">RBD (Menor a Mayor)</option>
              <option value="COMUNA_ASC">Comuna</option>
            </select>
          </div>

        </div>

        {/* Buscador Rápido y Limpiar */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por RBD, nombre, director o asesor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Mostrando <strong>{filteredColegios.length}</strong> de {colegios.length} escuelas
            </span>
            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. GRID DE COLEGIOS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredColegios.map((est) => {
          const es60_40 = est.porcentajePrioritarios >= 80;
          return (
            <div
              key={est.id || est.rbd}
              className="card-elevated p-5 flex flex-col justify-between group relative transition-all duration-200 hover:-translate-y-0.5"
            >
              <div>
                {/* Header Card */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700">
                      RBD {est.rbd}
                    </span>
                    <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                      {est.comuna}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                    es60_40
                      ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}>
                    {es60_40 ? '60/40' : '65/35'}
                  </span>
                </div>

                <h3 className="font-black text-slate-900 dark:text-white text-sm mt-2.5 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                  {est.nombre}
                </h3>

                {est.director && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 truncate">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Dir:</span> {est.director}
                  </p>
                )}

                <div className="mt-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-bold">Asesor UATP:</span>
                    <span className="font-black text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                      {est.asesorUatp || '⚠️ Sin Asignar'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-slate-500 font-bold">Régimen:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{est.regimen}</span>
                  </div>
                </div>
              </div>

              {/* Botonera de Acciones */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => abrirModalEditar(est)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                    title="Editar datos del colegio"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  {onExportarDotacionColegio && (
                    <button
                      onClick={() => onExportarDotacionColegio(est, periodoActivo)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                      title="Exportar Dotación .slep"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {onExportarMatrizExcelColegio && (
                    <button
                      onClick={() => onExportarMatrizExcelColegio(est, periodoActivo)}
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
                      title="Descargar Matriz Oficial Excel (.xlsx)"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {onLimpiarDotacionColegio && (
                    <button
                      onClick={() => setColegioParaVaciar(est)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                      title="Vaciar dotación escolar"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    onSelectColegio(est);
                    if (onAbrirWorkflow) onAbrirWorkflow(est);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-sm active:scale-[0.98]"
                >
                  <span>Espacio Escolar</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Nuevo / Editar Colegio */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="card-elevated max-w-lg w-full p-6 shadow-2xl space-y-4 border border-border-subtle animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  {editingEst ? 'Editar Establecimiento' : 'Nuevo Establecimiento'}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 text-xs font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                    RBD
                  </label>
                  <input
                    type="text"
                    required
                    value={formRbd}
                    onChange={(e) => setFormRbd(e.target.value)}
                    disabled={!!editingEst}
                    placeholder="Ej: 3451"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                    Comuna
                  </label>
                  <select
                    value={formComuna}
                    onChange={(e) => setFormComuna(e.target.value as ComunaValleDiguillin)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {COMUNAS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Nombre del Establecimiento
                </label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej: Liceo Bicentenario Manuel Bulnes"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                    Régimen Jornada
                  </label>
                  <select
                    value={formRegimen}
                    onChange={(e) => setFormRegimen(e.target.value as RegimenJornada)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="JEC">JEC</option>
                    <option value="No JEC">No JEC</option>
                    <option value="Mixto">Mixto</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                    % Alumnos Prioritarios
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formPrioritarios}
                    onChange={(e) => setFormPrioritarios(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Director(a) del Establecimiento
                </label>
                <input
                  type="text"
                  value={formDirector}
                  onChange={(e) => setFormDirector(e.target.value)}
                  placeholder="Nombre del Director"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Asesor(a) UATP Asignado
                </label>
                <input
                  type="text"
                  value={formAsesor}
                  onChange={(e) => setFormAsesor(e.target.value)}
                  placeholder="Nombre del Asesor UATP"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vaciar Dotación */}
      {colegioParaVaciar && onLimpiarDotacionColegio && (
        <ConfirmarVaciarDotacionModal
          isOpen={!!colegioParaVaciar}
          onClose={() => setColegioParaVaciar(null)}
          colegio={colegioParaVaciar}
          periodoActivo={periodoActivo}
          cursosCount={0}
          docentesCount={0}
          asignacionesCount={0}
          onConfirmarVaciar={async () => {
            await onLimpiarDotacionColegio(periodoActivo, colegioParaVaciar.rbd);
            setColegioParaVaciar(null);
          }}
          onExportarRespaldoPrevio={onExportarDotacionColegio ? () => onExportarDotacionColegio(colegioParaVaciar, periodoActivo) : undefined}
        />
      )}

    </div>
  );
};
