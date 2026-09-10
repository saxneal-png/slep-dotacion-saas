import React, { useState } from 'react';
import { Building2, Plus, FileUp, FileDown, MapPin, Users, School, Trash2, Edit, Database, FileSpreadsheet, Eraser, Search, RotateCcw, X } from 'lucide-react';
import { Establecimiento, ComunaValleDiguillin, RegimenJornada } from '../types';
import { ConfirmarVaciarDotacionModal } from '../components/ConfirmarVaciarDotacionModal';

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
  onExportarMatrizExcelColegio
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEst, setEditingEst] = useState<Establecimiento | null>(null);
  const [colegioParaVaciar, setColegioParaVaciar] = useState<Establecimiento | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComunaFilter, setSelectedComunaFilter] = useState<string>('ALL');
  const [selectedRegimenFilter, setSelectedRegimenFilter] = useState<string>('ALL');
  const [selectedProporcionFilter, setSelectedProporcionFilter] = useState<string>('ALL');
  const [selectedOrden, setSelectedOrden] = useState<string>('NOMBRE_ASC');

  const hayFiltrosActivos = searchTerm !== '' || selectedComunaFilter !== 'ALL' || selectedRegimenFilter !== 'ALL' || selectedProporcionFilter !== 'ALL';

  const limpiarFiltros = () => {
    setSearchTerm('');
    setSelectedComunaFilter('ALL');
    setSelectedRegimenFilter('ALL');
    setSelectedProporcionFilter('ALL');
    setSelectedOrden('NOMBRE_ASC');
  };

  const filteredColegios = colegios.filter((c) => {
    if (selectedComunaFilter !== 'ALL' && c.comuna !== selectedComunaFilter) return false;
    if (selectedRegimenFilter !== 'ALL' && c.regimen !== selectedRegimenFilter) return false;
    if (selectedProporcionFilter === '60_40' && c.porcentajePrioritarios < 80) return false;
    if (selectedProporcionFilter === '65_35' && c.porcentajePrioritarios >= 80) return false;
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
    <div className="space-y-6">
      {/* Barra Superior de la Cartera */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#002B49]" />
            Cartera Territorial de Colegios UATP
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Gestión descentralizada de establecimientos educacionales de las 6 comunas del SLEP Valle Diguillín.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botón Ingesta SIGE */}
          <button
            onClick={onAbrirModuloSige}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg transition-colors border border-purple-200 shadow-sm"
            title="Importar plantilla oficial de funcionarios exportada desde SIGE"
          >
            <FileSpreadsheet className="w-4 h-4 text-purple-600" />
            <span>Ingestar Planilla SIGE</span>
          </button>

          {/* Botones SQLite DB */}
          <button
            onClick={onExportarSqlite}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-300"
            title="Descargar base de datos local SQLite (.sqlite) para respaldo offline"
          >
            <Database className="w-4 h-4 text-blue-600" />
            <span>Exportar BD (.sqlite)</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors border border-slate-300">
            <Database className="w-4 h-4 text-slate-500" />
            <span>Restaurar BD (.sqlite)</span>
            <input
              type="file"
              accept=".sqlite,.db"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onImportarSqlite(file);
              }}
            />
          </label>

          {/* Botón Importar Paquete .slep */}
          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors border border-slate-300">
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

          {/* Botón Exportar Cartera .slep */}
          <button
            onClick={onExportarCarteraSlep}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-300"
            title="Exportar archivo portable con toda la información del asesor"
          >
            <FileDown className="w-4 h-4 text-slate-500" />
            <span>Exportar (.slep)</span>
          </button>

          {/* Botón Nuevo Colegio */}
          <button
            onClick={abrirModalNuevo}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Colegio</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros Multifactor y Búsqueda Optimizada */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Comuna */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" /> Comuna
            </label>
            <select
              value={selectedComunaFilter}
              onChange={(e) => setSelectedComunaFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-orange-500 focus:bg-white"
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

          {/* 2. Régimen Jornada */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <School className="w-3 h-3 text-slate-400" /> Régimen Jornada
            </label>
            <select
              value={selectedRegimenFilter}
              onChange={(e) => setSelectedRegimenFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-orange-500 focus:bg-white"
            >
              <option value="ALL">Todos los Regímenes</option>
              <option value="JEC">Solo JEC</option>
              <option value="No JEC">Solo No JEC</option>
              <option value="Mixto">Mixto</option>
            </select>
          </div>

          {/* 3. Tramo Proporción Ley 20.903 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Tramo Ley 20.903
            </label>
            <select
              value={selectedProporcionFilter}
              onChange={(e) => setSelectedProporcionFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-orange-500 focus:bg-white"
            >
              <option value="ALL">Todos los Tramos</option>
              <option value="60_40">Régimen 60/40 (≥80% Prioritarios)</option>
              <option value="65_35">Régimen 65/35 (&lt;80% Prioritarios)</option>
            </select>
          </div>

          {/* 4. Ordenamiento */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Ordenar por
            </label>
            <select
              value={selectedOrden}
              onChange={(e) => setSelectedOrden(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-orange-500 focus:bg-white"
            >
              <option value="NOMBRE_ASC">Nombre (A → Z)</option>
              <option value="NOMBRE_DESC">Nombre (Z → A)</option>
              <option value="RBD_ASC">RBD (Ascendente)</option>
              <option value="COMUNA_ASC">Comuna (A → Z)</option>
            </select>
          </div>
        </div>

        {/* Buscador de texto y barra de estado de filtros */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por RBD, nombre, director o asesor..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white"
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

          <div className="flex items-center gap-2 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-end">
            <span>
              Mostrando <strong className="text-slate-800">{filteredColegios.length}</strong> de {colegios.length} escuelas
            </span>
            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors"
                title="Limpiar todos los filtros aplicados"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grilla de Colegios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredColegios.map(est => {
          const isSelected = colegioActivo?.id === est.id;
          const es6040 = est.porcentajePrioritarios >= 80;

          return (
            <div
              key={est.id}
              className={`bg-white rounded-xl border p-5 shadow-sm transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-orange-500 ring-2 ring-orange-400/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      RBD {est.rbd}
                    </span>
                    <h3 className="text-base font-bold text-slate-800 mt-1 line-clamp-1">
                      {est.nombre}
                    </h3>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    es6040 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {es6040 ? 'Régimen 60/40 (SEP)' : 'Régimen 65/35'}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700">Comuna:</span>
                    <span>{est.comuna}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700">Jornada:</span>
                    <span className={`px-1.5 py-0.2 rounded font-bold ${
                      est.regimen === 'Mixto' ? 'bg-purple-100 text-purple-800' : 'text-slate-800'
                    }`}>
                      {est.regimen}
                    </span>
                    <span className="text-slate-400 text-[10px]">({est.porcentajePrioritarios}% Prioritarios)</span>
                  </div>

                  {est.director && (
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700">Director:</span>
                      <span className="truncate">{est.director}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSelectColegio(est);
                      if (onAbrirWorkflow) onAbrirWorkflow(est);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-md text-xs font-bold shadow-sm transition-all"
                    title="Abrir Flujo de Trabajo guiado de 7 Pasos (Salas, Cursos, Nómina, JEC, Asignaciones, No Aula, Consolidado)"
                  >
                    <span>📋 Abrir Flujo (7 Pasos)</span>
                  </button>

                  <button
                    onClick={() => onSelectColegio(est)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-slate-200 text-slate-800 font-bold'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                    title="Seleccionar como colegio activo"
                  >
                    {isSelected ? '✓ Activo' : 'Seleccionar'}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {onExportarMatrizExcelColegio && (
                    <button
                      onClick={() => onExportarMatrizExcelColegio(est, periodoActivo)}
                      className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
                      title={`Exportar Matriz de Dotación Excel oficial de ${est.nombre} (Periodo ${periodoActivo} / Formato SLEP y [h]:mm)`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                  )}

                  {onExportarDotacionColegio && (
                    <button
                      onClick={() => onExportarDotacionColegio(est, periodoActivo)}
                      className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                      title={`Exportar archivo .slep exclusivo con la dotación de ${est.nombre} (Periodo ${periodoActivo})`}
                    >
                      <FileDown className="w-4 h-4" />
                    </button>
                  )}

                  {onLimpiarDotacionColegio && (
                    <button
                      onClick={() => setColegioParaVaciar(est)}
                      className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded"
                      title={`Vaciar dotación ${periodoActivo} de ${est.nombre} (preserva el colegio)`}
                    >
                      <Eraser className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => abrirModalEditar(est)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                    title="Editar datos del establecimiento"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={async () => {
                      if (confirm(`¿Eliminar ${est.nombre} de la cartera?`)) {
                        await onEliminarColegio(est.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Eliminar de la cartera"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Creación / Edición */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {editingEst ? 'Editar Establecimiento' : 'Nuevo Establecimiento en Cartera'}
            </h3>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RBD MINEDUC *</label>
                  <input
                    type="text"
                    required
                    value={formRbd}
                    onChange={e => setFormRbd(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono font-bold"
                    placeholder="Ej: 3888"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Comuna (Valle Diguillín) *</label>
                  <select
                    value={formComuna}
                    onChange={e => setFormComuna(e.target.value as ComunaValleDiguillin)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    {COMUNAS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre Oficial Establecimiento *</label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={e => setFormNombre(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  placeholder="Ej: Colegio Bicentenario Politécnico Víctor Jara"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Régimen de Jornada *</label>
                  <select
                    value={formRegimen}
                    onChange={e => setFormRegimen(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none font-medium"
                  >
                    <option value="JEC">JEC (Completa en todos los cursos)</option>
                    <option value="No JEC">No JEC (Media jornada en todos)</option>
                    <option value="Mixto">Mixto (JEC en algunos niveles, No JEC en otros)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {formRegimen === 'Mixto' && 'Podrás definir JEC o No JEC individualmente por cada curso.'}
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alumnos Prioritarios SEP (%) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    value={formPrioritarios}
                    onChange={e => setFormPrioritarios(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {formPrioritarios >= 80 ? '✓ Aplica Proporción 60/40 (SEP)' : 'Aplica Proporción 65/35'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Director(a)</label>
                <input
                  type="text"
                  value={formDirector}
                  onChange={e => setFormDirector(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  placeholder="Nombre del director del colegio"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow"
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
