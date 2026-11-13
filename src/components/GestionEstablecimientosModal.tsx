import React, { useState, useMemo } from 'react';
import {
  Building2, Plus, Trash2, Edit3, Search, X, AlertTriangle, CheckCircle2,
  ShieldAlert, Phone, Mail, User, School, Sparkles, Filter, AlertOctagon,
  ArrowRight, Check, RefreshCw
} from 'lucide-react';
import {
  Establecimiento,
  ComunaValleDiguillin,
  RegimenJornada,
  TipoEstablecimientoBase,
  TipoPerfilEstablecimiento,
} from '../types';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../data/slepSchoolsCatalog';
import {
  PERFILES_ESTABLECIMIENTO_OPTIONS,
  getPerfilEstablecimientoMeta,
  resolvePerfilEstablecimiento,
} from '../utils/establishmentTypeHelpers';

export interface GestionEstablecimientosModalProps {
  isOpen: boolean;
  onClose: () => void;
  colegios: Establecimiento[];
  onGuardarColegio: (est: Establecimiento) => Promise<void>;
  onEliminarColegio: (id: string) => Promise<void>;
  colegioActivo?: Establecimiento | null;
  onSelectColegio?: (est: Establecimiento) => void;
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

export const GestionEstablecimientosModal: React.FC<GestionEstablecimientosModalProps> = ({
  isOpen,
  onClose,
  colegios,
  onGuardarColegio,
  onEliminarColegio,
  colegioActivo,
  onSelectColegio
}) => {
  const [tab, setTab] = useState<'lista' | 'nuevo'>('lista');
  const [busqueda, setBusqueda] = useState('');
  const [filtroComuna, setFiltroComuna] = useState<string>('ALL');
  const [filtroTipo, setFiltroTipo] = useState<'ALL' | TipoPerfilEstablecimiento>('ALL');
  
  // Estado para creación / edición
  const [editingEst, setEditingEst] = useState<Establecimiento | null>(null);
  const [formRbd, setFormRbd] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formTipoPerfil, setFormTipoPerfil] = useState<TipoPerfilEstablecimiento>('ESCUELA_BASICA');
  const [formComuna, setFormComuna] = useState<ComunaValleDiguillin>('Chillán');
  const [formLocalidad, setFormLocalidad] = useState('');
  const [formRegimen, setFormRegimen] = useState<RegimenJornada>('JEC');
  const [formPrioritarios, setFormPrioritarios] = useState(80);
  const [formDirector, setFormDirector] = useState('');
  const [formAsesor, setFormAsesor] = useState('UATP Valle Diguillín');
  const [formTelefono, setFormTelefono] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCodigoJunji, setFormCodigoJunji] = useState('');
  const [formHorarioApertura, setFormHorarioApertura] = useState('08:30');
  const [formHorarioCierre, setFormHorarioCierre] = useState('16:30');
  const [formHorarioExtensionCierre, setFormHorarioExtensionCierre] = useState('19:30');
  const [formSubvencionSep, setFormSubvencionSep] = useState<number>(0);
  const [formSubvencionProRet, setFormSubvencionProRet] = useState<number>(0);
  const [formCupoPieDiferencial, setFormCupoPieDiferencial] = useState<number>(0);
  const [formCupoPieAsistentes, setFormCupoPieAsistentes] = useState<number>(0);

  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Estado para confirmación de eliminación
  const [colegioAEliminar, setColegioAEliminar] = useState<Establecimiento | null>(null);
  const [confirmacionTexto, setConfirmacionTexto] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const [depurandoFantasmas, setDepurandoFantasmas] = useState(false);

  const colegiosFantasma = useMemo(() => {
    return colegios.filter(c => {
      const rbdClean = c.rbd.trim();
      const esSintetico = c.nombre.trim().toUpperCase().startsWith('ESTABLECIMIENTO RBD') || !rbdClean || rbdClean === '0';
      const existeEnCatalogo = SLEP_VALLE_DIGUILLIN_SCHOOLS.some(s => s.rbd === rbdClean);
      return esSintetico || !existeEnCatalogo;
    });
  }, [colegios]);

  const handleDepurarFantasmas = async () => {
    if (!colegiosFantasma.length) return;
    const confirmacion = window.confirm(
      `¿Desea depurar y eliminar definitivamente ${colegiosFantasma.length} colegios no oficiales o generados automáticamente? Esta acción limpiará sus dependencias tanto en SQLite local como en Supabase.`
    );
    if (!confirmacion) return;

    setDepurandoFantasmas(true);
    try {
      for (const f of colegiosFantasma) {
        await onEliminarColegio(f.id);
      }
      setMensajeExito(`Se han depurado ${colegiosFantasma.length} colegios fantasma exitosamente.`);
    } catch (err: any) {
      setFormError(`Error durante la depuración: ${err.message}`);
    } finally {
      setDepurandoFantasmas(false);
    }
  };

  const filteredColegios = useMemo(() => {
    return colegios.filter(c => {
      if (filtroComuna !== 'ALL' && c.comuna !== filtroComuna) return false;
      if (filtroTipo !== 'ALL' && resolvePerfilEstablecimiento(c) !== filtroTipo) return false;
      if (!busqueda) return true;
      const q = busqueda.toLowerCase().trim();
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.rbd.toLowerCase().includes(q) ||
        (c.comuna && c.comuna.toLowerCase().includes(q)) ||
        (c.localidad && c.localidad.toLowerCase().includes(q)) ||
        (c.codigoJunji && c.codigoJunji.toLowerCase().includes(q)) ||
        (c.director && c.director.toLowerCase().includes(q)) ||
        (c.asesorUatp && c.asesorUatp.toLowerCase().includes(q))
      );
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [colegios, busqueda, filtroComuna, filtroTipo]);

  const abrirFormularioNuevo = () => {
    setEditingEst(null);
    setFormRbd('');
    setFormNombre('');
    setFormTipoPerfil('ESCUELA_BASICA');
    setFormComuna('Chillán');
    setFormLocalidad('');
    setFormRegimen('JEC');
    setFormPrioritarios(80);
    setFormDirector('');
    setFormAsesor('UATP Valle Diguillín');
    setFormTelefono('');
    setFormEmail('');
    setFormCodigoJunji('');
    setFormHorarioApertura('08:30');
    setFormHorarioCierre('16:30');
    setFormHorarioExtensionCierre('19:30');
    setFormSubvencionSep(0);
    setFormSubvencionProRet(0);
    setFormCupoPieDiferencial(0);
    setFormCupoPieAsistentes(0);
    setFormError(null);
    setTab('nuevo');
  };

  const abrirFormularioEditar = (est: Establecimiento) => {
    setEditingEst(est);
    setFormRbd(est.rbd);
    setFormNombre(est.nombre);
    setFormTipoPerfil(resolvePerfilEstablecimiento(est));
    setFormComuna(est.comuna);
    setFormLocalidad(est.localidad || '');
    setFormRegimen(est.regimen);
    setFormPrioritarios(est.porcentajePrioritarios ?? 80);
    setFormDirector(est.director || '');
    setFormAsesor(est.asesorUatp || 'UATP Valle Diguillín');
    setFormTelefono(est.telefono || '');
    setFormEmail(est.email || '');
    setFormCodigoJunji(est.codigoJunji || '');
    setFormHorarioApertura(est.horarioApertura || '08:30');
    setFormHorarioCierre(est.horarioCierre || '16:30');
    setFormHorarioExtensionCierre(est.horarioExtensionCierre || '19:30');
    setFormSubvencionSep(est.subvencionSepMensual || 0);
    setFormSubvencionProRet(est.subvencionProRetencion || 0);
    setFormCupoPieDiferencial(est.cupoHorasPieDiferencial || 0);
    setFormCupoPieAsistentes(est.cupoHorasPieAsistentes || 0);
    setFormError(null);
    setTab('nuevo');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const rbdClean = formRbd.trim();
    const nombreClean = formNombre.trim();

    if (!rbdClean) {
      setFormError('El RBD del establecimiento es obligatorio.');
      return;
    }
    if (!/^\d+$/.test(rbdClean)) {
      setFormError('El RBD debe ser numérico sin puntos ni guiones.');
      return;
    }
    if (!nombreClean) {
      setFormError('El nombre oficial del establecimiento es obligatorio.');
      return;
    }

    // Verificar si RBD ya existe en caso de creación
    if (!editingEst) {
      const existe = colegios.some(c => c.rbd.trim() === rbdClean);
      if (existe) {
        setFormError(`Ya existe un establecimiento con el RBD ${rbdClean}. Use la opción de edición si desea modificarlo.`);
        return;
      }
    }

    setGuardando(true);
    try {
      const perfilOption = PERFILES_ESTABLECIMIENTO_OPTIONS.find(o => o.value === formTipoPerfil);
      const upperNombre = nombreClean.toUpperCase();
      const tipoResuelto: TipoEstablecimientoBase =
        formTipoPerfil === 'JARDIN_SALA_CUNA'
          ? upperNombre.startsWith('SALA CUNA') && !upperNombre.includes('JARD')
            ? 'SALA_CUNA'
            : 'JARDIN'
          : (perfilOption?.tipoBaseDefault || 'ESCUELA');

      const datos: Establecimiento = {
        id: editingEst ? editingEst.id : `est-${rbdClean}`,
        rbd: rbdClean,
        nombre: nombreClean,
        tipo: tipoResuelto,
        tipoPerfil: formTipoPerfil,
        comuna: formComuna,
        localidad: formLocalidad.trim() || undefined,
        regimen: formRegimen,
        porcentajePrioritarios: Number(formPrioritarios),
        director: formDirector.trim() || undefined,
        asesorUatp: formAsesor.trim() || undefined,
        telefono: formTelefono.trim() || undefined,
        email: formEmail.trim() || undefined,
        codigoJunji: formTipoPerfil === 'JARDIN_SALA_CUNA' ? (formCodigoJunji.trim() || undefined) : editingEst?.codigoJunji,
        horarioApertura: formTipoPerfil === 'JARDIN_SALA_CUNA' ? (formHorarioApertura.trim() || '08:30') : editingEst?.horarioApertura,
        horarioCierre: formTipoPerfil === 'JARDIN_SALA_CUNA' ? (formHorarioCierre.trim() || '16:30') : editingEst?.horarioCierre,
        horarioExtensionCierre: formTipoPerfil === 'JARDIN_SALA_CUNA' ? (formHorarioExtensionCierre.trim() || '19:30') : editingEst?.horarioExtensionCierre,
        subvencionSepMensual: Number(formSubvencionSep) || 0,
        subvencionProRetencion: Number(formSubvencionProRet) || 0,
        cupoHorasPieDiferencial: Number(formCupoPieDiferencial) || 0,
        cupoHorasPieAsistentes: Number(formCupoPieAsistentes) || 0
      };

      await onGuardarColegio(datos);
      setMensajeExito(editingEst ? `✓ Establecimiento "${nombreClean}" actualizado correctamente.` : `✓ Establecimiento "${nombreClean}" creado e integrado a la cartera.`);
      setTimeout(() => setMensajeExito(null), 4000);
      setTab('lista');
    } catch (err: any) {
      setFormError(`Error al guardar: ${err.message || err}`);
    } finally {
      setGuardando(false);
    }
  };

  const handleConfirmarEliminacion = async () => {
    if (!colegioAEliminar) return;
    setEliminando(true);
    try {
      await onEliminarColegio(colegioAEliminar.id);
      setMensajeExito(`✓ Establecimiento "${colegioAEliminar.nombre}" (RBD: ${colegioAEliminar.rbd}) eliminado con éxito.`);
      setTimeout(() => setMensajeExito(null), 4000);
      setColegioAEliminar(null);
      setConfirmacionTexto('');
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message || err}`);
    } finally {
      setEliminando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div 
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Principal */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 shadow-inner">
              <Building2 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  Gestión de Establecimientos Educacionales
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  <ShieldAlert className="w-3 h-3 text-rose-400" />
                  Super Usuario
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Panel maestro para dar de alta y baja establecimientos en el catálogo territorial SLEP.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de Éxito Flotante */}
        {mensajeExito && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-6 py-2.5 text-xs font-bold flex items-center gap-2 animate-fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{mensajeExito}</span>
          </div>
        )}

        {/* Barra de Pestañas / Acciones */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setTab('lista'); setEditingEst(null); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                tab === 'lista'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Establecimientos ({colegios.length})</span>
            </button>

            <button
              onClick={abrirFormularioNuevo}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                tab === 'nuevo' && !editingEst
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Agregar Nuevo Establecimiento</span>
            </button>
          </div>

          {tab === 'nuevo' && editingEst && (
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
              Modo Edición: RBD {editingEst.rbd}
            </span>
          )}
        </div>

        {/* ── CUERPO: LISTA DE ESTABLECIMIENTOS ── */}
        {tab === 'lista' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Barra de Filtros y Búsqueda */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, RBD, comuna, director o asesor..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value as 'ALL' | TipoPerfilEstablecimiento)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl px-2.5 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Todos los Tipos</option>
                  {PERFILES_ESTABLECIMIENTO_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={filtroComuna}
                  onChange={(e) => setFiltroComuna(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl px-2.5 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Todas las Comunas</option>
                  {COMUNAS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Banner de Detección de Colegios Fantasma */}
            {colegiosFantasma.length > 0 && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0 animate-fade-in">
                <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <span className="font-black text-amber-800 dark:text-amber-300">Detección de anomalías: </span>
                    <span>Se detectaron <strong>{colegiosFantasma.length}</strong> establecimientos no oficiales o sintéticos en el sistema.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDepurarFantasmas}
                  disabled={depurandoFantasmas}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0 disabled:opacity-50"
                  title="Eliminar de forma permanente todos los colegios fantasma y sus datos asociados"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{depurandoFantasmas ? 'Depurando...' : `Depurar Colegios Fantasma (${colegiosFantasma.length})`}</span>
                </button>
              </div>
            )}

            {/* Listado con scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800">
              {filteredColegios.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <School className="w-12 h-12 mx-auto mb-2 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                  <p className="text-sm font-semibold">No se encontraron establecimientos</p>
                  <p className="text-xs text-slate-400 mt-1">Intente cambiar los filtros o agregue un nuevo establecimiento.</p>
                  <button
                    onClick={abrirFormularioNuevo}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Establecimiento</span>
                  </button>
                </div>
              ) : (
                filteredColegios.map((col) => {
                  const esActivo = colegioActivo?.id === col.id || colegioActivo?.rbd === col.rbd;
                  const perfilMeta = getPerfilEstablecimientoMeta(col);
                  return (
                    <div
                      key={col.id || col.rbd}
                      className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-mono font-bold text-xs ${
                          esActivo
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        }`}>
                          {col.rbd}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                              {col.nombre}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${perfilMeta.badgeClass}`}
                              title={perfilMeta.label}
                            >
                              {perfilMeta.shortLabel}
                            </span>
                            {esActivo && (
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                                En Uso
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">📍 {col.comuna}{col.localidad ? ` (${col.localidad})` : ''}</span>
                            <span>•</span>
                            {perfilMeta.esJardinOSalaCuna ? (
                              <>
                                <span>Modalidad: <strong>VTF / D.S. 115</strong></span>
                                {col.codigoJunji && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-[11px] bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 px-1.5 rounded">
                                      JISC {col.codigoJunji}
                                    </span>
                                  </>
                                )}
                                <span>•</span>
                                <span className="text-[11px] font-mono">
                                  {col.horarioApertura || '08:30'}–{col.horarioExtensionCierre || col.horarioCierre || '16:30'}
                                </span>
                              </>
                            ) : (
                              <>
                                <span>Régimen: <strong>{col.regimen}</strong></span>
                                <span>•</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  col.porcentajePrioritarios >= 80
                                    ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}>
                                  {col.porcentajePrioritarios >= 80 ? '60/40 (≥80% SEP)' : '65/35'}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                            {col.director && (
                              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 truncate max-w-[200px]" title={`Director: ${col.director}`}>
                                <User className="w-3 h-3 text-slate-400" /> Dir: {col.director}
                              </span>
                            )}
                            {col.asesorUatp && (
                              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 truncate max-w-[200px]" title={`Asesor UATP: ${col.asesorUatp}`}>
                                👤 {col.asesorUatp}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botonera de Acciones por Establecimiento */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {onSelectColegio && (
                          <button
                            onClick={() => {
                              onSelectColegio(col);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Seleccionar y abrir en el espacio escolar"
                          >
                            Seleccionar
                          </button>
                        )}

                        <button
                          onClick={() => abrirFormularioEditar(col)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors"
                          title="Editar información del establecimiento"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          onClick={() => {
                            setColegioAEliminar(col);
                            setConfirmacionTexto('');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 transition-colors"
                          title="Eliminar establecimiento definitivamente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── CUERPO: FORMULARIO AGREGAR / EDITAR ── */}
        {tab === 'nuevo' && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  RBD (Identificador Único) *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingEst}
                  value={formRbd}
                  onChange={(e) => setFormRbd(e.target.value)}
                  placeholder="Ej: 3451"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Solo dígitos numéricos MINEDUC.</span>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Nombre Oficial del Establecimiento *
                </label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej: Liceo Bicentenario Manuel Bulnes"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="text-[11px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Perfil / Modalidad Normativa *
                </label>
                <select
                  value={formTipoPerfil}
                  onChange={(e) => setFormTipoPerfil(e.target.value as TipoPerfilEstablecimiento)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {PERFILES_ESTABLECIMIENTO_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Localidad / Sector
                </label>
                <input
                  type="text"
                  value={formLocalidad}
                  onChange={(e) => setFormLocalidad(e.target.value)}
                  placeholder="Ej: Pueblo Seco, Chillán Urbano"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {formTipoPerfil === 'JARDIN_SALA_CUNA' && (
              <div className="p-4 rounded-xl bg-pink-50/70 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800/70 space-y-3">
                <h4 className="text-xs font-black text-pink-900 dark:text-pink-200 uppercase tracking-wider">
                  Configuración Jardín Infantil / Sala Cuna (VTF · D.S. 115 / JISC)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-pink-800 dark:text-pink-300 block mb-1">
                      Código Unidad JISC
                    </label>
                    <input
                      type="text"
                      value={formCodigoJunji}
                      onChange={(e) => setFormCodigoJunji(e.target.value)}
                      placeholder="Ej: 16101018"
                      className="w-full bg-white dark:bg-slate-900 border border-pink-200 dark:border-pink-800 rounded-lg p-2 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-pink-800 dark:text-pink-300 block mb-1">
                      Apertura Normal
                    </label>
                    <input
                      type="text"
                      value={formHorarioApertura}
                      onChange={(e) => setFormHorarioApertura(e.target.value)}
                      placeholder="08:30"
                      className="w-full bg-white dark:bg-slate-900 border border-pink-200 dark:border-pink-800 rounded-lg p-2 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-pink-800 dark:text-pink-300 block mb-1">
                      Cierre Jornada Normal
                    </label>
                    <input
                      type="text"
                      value={formHorarioCierre}
                      onChange={(e) => setFormHorarioCierre(e.target.value)}
                      placeholder="16:30"
                      className="w-full bg-white dark:bg-slate-900 border border-pink-200 dark:border-pink-800 rounded-lg p-2 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-pink-800 dark:text-pink-300 block mb-1">
                      Cierre Extensión Horaria
                    </label>
                    <input
                      type="text"
                      value={formHorarioExtensionCierre}
                      onChange={(e) => setFormHorarioExtensionCierre(e.target.value)}
                      placeholder="19:30"
                      className="w-full bg-white dark:bg-slate-900 border border-pink-200 dark:border-pink-800 rounded-lg p-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Comuna Territorial *
                </label>
                <select
                  value={formComuna}
                  onChange={(e) => setFormComuna(e.target.value as ComunaValleDiguillin)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {COMUNAS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Régimen de Jornada *
                </label>
                <select
                  value={formRegimen}
                  onChange={(e) => setFormRegimen(e.target.value as RegimenJornada)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="JEC">JEC (Jornada Escolar Completa)</option>
                  <option value="No JEC">No JEC</option>
                  <option value="Mixto">Mixto</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  % Alumnos Prioritarios (SEP) *
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  required
                  value={formPrioritarios}
                  onChange={(e) => setFormPrioritarios(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {formPrioritarios >= 80 ? '✓ Aplica Proporción 60/40 (Ley 20.903)' : 'Aplica Proporción estándar 65/35'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Director(a) Titular o Encargado(a)
                </label>
                <input
                  type="text"
                  value={formDirector}
                  onChange={(e) => setFormDirector(e.target.value)}
                  placeholder="Nombre y apellido del director"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Asesor(a) UATP Asignado
                </label>
                <input
                  type="text"
                  value={formAsesor}
                  onChange={(e) => setFormAsesor(e.target.value)}
                  placeholder="Nombre del asesor o 'UATP Valle Diguillín'"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={formTelefono}
                  onChange={(e) => setFormTelefono(e.target.value)}
                  placeholder="Ej: +56 9 8765 4321"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-black text-slate-600 dark:text-slate-300 block mb-1">
                  Correo Electrónico Institucional
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="contacto.escuela@slepvallediguillin.cl"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Parámetros Financieros DEP (Opcionales) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Metadatos Financieros Oficiales DEP (Opcionales)</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Subvención SEP ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formSubvencionSep}
                    onChange={(e) => setFormSubvencionSep(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Pro-Retención ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formSubvencionProRet}
                    onChange={(e) => setFormSubvencionProRet(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Cupo Hrs PIE Dif.
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formCupoPieDiferencial}
                    onChange={(e) => setFormCupoPieDiferencial(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Cupo Hrs PIE Asist.
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formCupoPieAsistentes}
                    onChange={(e) => setFormCupoPieAsistentes(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Botones del formulario */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setTab('lista'); setEditingEst(null); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={guardando}
                className="flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {guardando ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{editingEst ? 'Guardar Cambios' : 'Crear Establecimiento'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── MODAL DIÁLOGO DE CONFIRMACIÓN DE ELIMINACIÓN ── */}
        {colegioAEliminar && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-rose-300 dark:border-rose-900 p-6 space-y-4 animate-scale-in">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800">
                  <AlertOctagon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Confirmar Eliminación
                  </h3>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                    Operación irreversible de Super Usuario
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                <p>
                  Está a punto de eliminar definitivamente el establecimiento:
                </p>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 font-bold text-slate-900 dark:text-white">
                  {colegioAEliminar.nombre} <span className="font-mono text-rose-600">(RBD: {colegioAEliminar.rbd})</span>
                </div>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold leading-relaxed">
                  ⚠️ Se eliminarán de forma permanente todos sus cursos, salas de infraestructura, nómina de docentes, asistentes de la educación y asignaciones horarias vinculadas tanto en SQLite local como en Supabase.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Para confirmar, escriba el RBD del establecimiento (<strong className="font-mono">{colegioAEliminar.rbd}</strong>):
                </label>
                <input
                  type="text"
                  value={confirmacionTexto}
                  onChange={(e) => setConfirmacionTexto(e.target.value.trim())}
                  placeholder={`Escriba ${colegioAEliminar.rbd}`}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={eliminando}
                  onClick={() => { setColegioAEliminar(null); setConfirmacionTexto(''); }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={eliminando || confirmacionTexto !== colegioAEliminar.rbd}
                  onClick={handleConfirmarEliminacion}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {eliminando ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar Permanentemente</span>
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
