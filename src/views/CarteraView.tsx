import React, { useState, useMemo } from 'react';
import { Building2, Plus, FileUp, FileDown, MapPin, Users, School, Trash2, Edit, Database, FileSpreadsheet, Eraser, Search, RotateCcw, X, UserCheck, ChevronRight, MoreVertical } from 'lucide-react';
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
    <div className="space-y-6 animate-fade-in">
      
      {/* Hero Cartera */}
      <div className="card-elevated p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Cartera Territorial de Colegios UATP
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestión y catálogo de los {colegios.length} establecimientos educacionales del SLEP Valle Diguillín.
          </p>
        </div>

        {/* Toolbar de Acciones Consolidadas */}
        <div className="flex flex-wrap items-center gap-2">
          
          <button
            onClick={onAbrirModuloSige}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-xl transition-all border border-purple-200 dark:border-purple-800/60 active:scale-[0.98]"
            title="Importar plantilla SIGE"
          >
            <FileSpreadsheet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Ingestar SIGE</span>
          </button>

          <button
            onClick={onExportarCarteraSlep}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all border border-slate-200 dark:border-slate-700 active:scale-[0.98]"
            title="Exportar archivo portable con toda la cartera"
          >
            <FileDown className="w-4 h-4 text-slate-500" />
            <span>Exportar Cartera (.slep)</span>
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-700 active:scale-[0.98]">
            <FileUp className="w-4 h-4 text-slate-500" />
            <span>Importar (.slep)</span>
            <input
              type="file"
              accept=".slep,.json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onImportarCarteraSlep(file);
              }}
            />
          </label>

          <button
            onClick={abrirModalNuevo}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Colegio</span>
          </button>

        </div>
      </div>

      {/* Barra de Filtros Multifactor */}
      <div className="card-elevated p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* Asesor */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-indigo-500" /> Asesor UATP
            </label>
            <select
              value={selectedAsesorFilter}
              onChange={(e) => setSelectedAsesorFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos los Asesores</option>
              {config.asesorActivoNombre && (
                <option value={config.asesorActivoNombre}>
                  👤 Mi Cartera ({config.asesorActivoNombre.split(' ')[0]})
                </option>
              )}
              <option value="SIN_ASIGNAR">⚠️ Sin Asesor</option>
              {listaAsesores.map((asesor) => (
                <option key={asesor} value={asesor}>
                  {asesor}
                </option>
              ))}
            </select>
          </div>

          {/* Comuna */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" /> Comuna
            </label>
            <select
              value={selectedComunaFilter}
              onChange={(e) => setSelectedComunaFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todas las Comunas ({colegios.length})</option>
              {COMUNAS.map((com) => {
                const count = colegios.filter((c) => c.comuna === com).length;
                return (
                  <option key={com} value={com}>
                    {com} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Régimen Jornada */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
              <School className="w-3 h-3 text-slate-400" /> Régimen Jornada
            </label>
            <select
              value={selectedRegimenFilter}
              onChange={(e) => setSelectedRegimenFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos los Regímenes</option>
              <option value="JEC">Solo JEC</option>
              <option value="No JEC">Solo No JEC</option>
              <option value="Mixto">Mixto</option>
            </select>
          </div>

          {/* Tramo Ley 20.903 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Tramo Ley 20.903
            </label>
            <select
              value={selectedProporcionFilter}
              onChange={(e) => setSelectedProporcionFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos los Tramos</option>
              <option value="60_40">Régimen 60/40 (≥80% Prioritarios)</option>
              <option value="65_35">Régimen 65/35 (&lt;80% Prioritarios)</option>
            </select>
          </div>

          {/* Orden */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Ordenar por
            </label>
            <select
              value={selectedOrden}
              onChange={(e) => setSelectedOrden(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="NOMBRE_ASC">Nombre (A → Z)</option>
              <option value="NOMBRE_DESC">Nombre (Z → A)</option>
              <option value="RBD_ASC">RBD (Ascendente)</option>
              <option value="COMUNA_ASC">Comuna (A → Z)</option>
            </select>
          </div>

        </div>

        {/* Buscador & Contadores */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por RBD, nombre, director o asesor..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 w-full sm:w-auto justify-between sm:justify-end">
            <span>
              Mostrando <strong className="text-slate-800 dark:text-white tabular-nums">{filteredColegios.length}</strong> de {colegios.length} escuelas
            </span>
            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 rounded-lg border border-orange-200 dark:border-orange-800/60 transition-colors"
                title="Limpiar filtros"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grilla de Colegios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredColegios.map(est => {
          const isSelected = colegioActivo?.id === est.id;
          const es6040 = est.porcentajePrioritarios >= 80;

          return (
            <div
              key={est.id}
              className={`card-elevated p-5 flex flex-col justify-between group relative transition-all ${
                isSelected ? 'border-orange-500 ring-2 ring-orange-400/20' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                      RBD {est.rbd}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {est.nombre}
                    </h3>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                    es6040
                      ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/40'
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/40'
                  }`}>
                    {es6040 ? '60/40' : '65/35'}
                  </span>
                </div>

                <div className="mt-3.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Comuna:</span>
                    <span>{est.comuna}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Jornada:</span>
                    <span className="font-bold">{est.regimen}</span>
                    <span className="text-slate-400 text-[10px]">({est.porcentajePrioritarios}% SEP)</span>
                  </div>

                  {est.director && (
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Dir:</span>
                      <span className="truncate">{est.director}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSelectColegio(est);
                      if (onAbrirWorkflow) onAbrirWorkflow(est);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-blue-600 dark:bg-slate-800 dark:hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                  >
                    <span>Espacio Escolar</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {onExportarMatrizExcelColegio && (
                    <button
                      onClick={() => onExportarMatrizExcelColegio(est, periodoActivo)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                      title="Exportar Matriz Excel (.xlsx)"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                  )}

                  {onExportarDotacionColegio && (
                    <button
                      onClick={() => onExportarDotacionColegio(est, periodoActivo)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                      title="Exportar .slep"
                    >
                      <FileDown className="w-4 h-4" />
                    </button>
                  )}

                  {onLimpiarDotacionColegio && (
                    <button
                      onClick={() => setColegioParaVaciar(est)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg transition-colors"
                      title="Vaciar dotación"
                    >
                      <Eraser className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => abrirModalEditar(est)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                    title="Editar colegio"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={async () => {
                      if (confirm(`¿Eliminar ${est.nombre} de la cartera?`)) {
                        await onEliminarColegio(est.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                    title="Eliminar colegio"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Creación / Edición */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 animate-scale-in">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {editingEst ? 'Editar Establecimiento' : 'Nuevo Establecimiento en Cartera'}
            </h3>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">RBD MINEDUC *</label>
                  <input
                    type="text"
                    required
                    value={formRbd}
                    onChange={e => setFormRbd(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                    placeholder="Ej: 3888"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Comuna *</label>
                  <select
                    value={formComuna}
                    onChange={e => setFormComuna(e.target.value as ComunaValleDiguillin)}
                    className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    {COMUNAS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre Oficial Establecimiento *</label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={e => setFormNombre(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Colegio Bicentenario Politécnico Víctor Jara"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Régimen de Jornada *</label>
                  <select
                    value={formRegimen}
                    onChange={e => setFormRegimen(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="JEC">JEC (Completa)</option>
                    <option value="No JEC">No JEC (Media)</option>
                    <option value="Mixto">Mixto</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Prioritarios SEP (%) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    value={formPrioritarios}
                    onChange={e => setFormPrioritarios(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    {formPrioritarios >= 80 ? '✓ Aplica 60/40 (SEP)' : 'Aplica 65/35'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Director(a)</label>
                <input
                  type="text"
                  value={formDirector}
                  onChange={e => setFormDirector(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre del director"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-sm hover:from-orange-600 hover:to-amber-600 active:scale-[0.98]"
                >
                  {editingEst ? 'Guardar Cambios' : 'Crear Colegio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {colegioParaVaciar && (
        <ConfirmarVaciarDotacionModal
          isOpen={Boolean(colegioParaVaciar)}
          onClose={() => setColegioParaVaciar(null)}
          colegio={colegioParaVaciar}
          periodoActivo={periodoActivo}
          cursosCount={0}
          docentesCount={0}
          asignacionesCount={0}
          onConfirmarVaciar={async () => {
            if (onLimpiarDotacionColegio && colegioParaVaciar) {
              await onLimpiarDotacionColegio(periodoActivo, colegioParaVaciar.rbd);
            }
          }}
          onExportarRespaldoPrevio={onExportarDotacionColegio && colegioParaVaciar ? () => onExportarDotacionColegio(colegioParaVaciar, periodoActivo) : undefined}
        />
      )}

    </div>
  );
};
