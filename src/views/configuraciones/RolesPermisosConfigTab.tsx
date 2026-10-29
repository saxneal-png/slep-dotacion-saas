import React, { useState, useMemo } from 'react';
import {
  ShieldCheck, Shield, Lock, RotateCcw, Copy, Check, AlertTriangle, History,
  Eye, Save, CheckCircle2, ChevronDown, ChevronRight, Sparkles, Filter
} from 'lucide-react';
import { RolId, PermisoKey, AccionPermiso } from '../../types/authTypes';
import {
  ROLES_DEFINICIONES, getDefinicionRol
} from '../../security/rolesDefinitions';
import {
  CATALOGO_PERMISOS, GRUPOS_PERMISOS, ACCIONES_ORDEN, ACCIONES_ETIQUETAS,
  k, esClaveReservada
} from '../../security/permissionCatalog';
import { RolesPermisosService } from '../../services/rolesPermisosService';
import { usePermisos } from '../../security/PermisosContext';

export const RolesPermisosConfigTab: React.FC = () => {
  const { esSuperUsuario, rolSimulado, setRolSimulado } = usePermisos();
  const [rolSeleccionado, setRolSeleccionado] = useState<RolId>('subdirector_uatp');
  const [subTab, setSubTab] = useState<'matriz' | 'bitacora'>('matriz');

  // Estado local editable de la matriz para el rol activo
  const [permisosEditados, setPermisosEditados] = useState<PermisoKey[]>(() =>
    RolesPermisosService.getPermisosRol('subdirector_uatp')
  );
  const [filtroGrupo, setFiltroGrupo] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error' | 'info'; texto: string } | null>(null);
  const [modalConfirmar, setModalConfirmar] = useState(false);
  const [motivoCambio, setMotivoCambio] = useState('');

  // Seleccionar otro rol
  const handleCambiarRol = (nuevoRol: RolId) => {
    setRolSeleccionado(nuevoRol);
    setPermisosEditados(RolesPermisosService.getPermisosRol(nuevoRol));
    setMensaje(null);
  };

  const defRol = getDefinicionRol(rolSeleccionado);
  const permisosActualesRol = useMemo(() => RolesPermisosService.getPermisosRol(rolSeleccionado), [rolSeleccionado]);

  // Cálculo de diferencias (dirty check)
  const diff = useMemo(() => {
    const actuales = new Set(permisosActualesRol);
    const editados = new Set(permisosEditados);
    const agregados = permisosEditados.filter(p => !actuales.has(p));
    const removidos = permisosActualesRol.filter(p => !editados.has(p));
    return { agregados, removidos, hayCambios: agregados.length > 0 || removidos.length > 0 };
  }, [permisosActualesRol, permisosEditados]);

  // Alternar permiso con lógica de dependencia (activar acción => activa 'ver'; desactivar 'ver' => desactiva grupo del módulo)
  const handleTogglePermiso = (moduloId: string, accion: AccionPermiso) => {
    if (!defRol.editable) return;
    const clave = k(moduloId, accion);
    const claveVer = k(moduloId, 'ver');
    const yaTiene = permisosEditados.includes(clave);

    let nuevos: PermisoKey[];
    if (yaTiene) {
      if (accion === 'ver') {
        // Desactivar 'ver' desactiva todas las acciones de ese módulo
        nuevos = permisosEditados.filter(p => !p.startsWith(`${moduloId}.`));
      } else {
        nuevos = permisosEditados.filter(p => p !== clave);
      }
    } else {
      // Activar cualquier acción agrega 'ver' si existe en el módulo
      const mod = CATALOGO_PERMISOS.find(m => m.id === moduloId);
      nuevos = [...permisosEditados, clave];
      if (accion !== 'ver' && mod?.acciones.includes('ver') && !nuevos.includes(claveVer)) {
        nuevos.push(claveVer);
      }
    }
    setPermisosEditados(nuevos);
  };

  // Acciones en bloque para un módulo
  const handleToggleModuloCompleto = (moduloId: string) => {
    if (!defRol.editable) return;
    const mod = CATALOGO_PERMISOS.find(m => m.id === moduloId);
    if (!mod) return;
    const clavesMod = mod.acciones.map(a => k(moduloId, a)).filter(c => !esClaveReservada(c));
    const tieneTodas = clavesMod.every(c => permisosEditados.includes(c));

    if (tieneTodas) {
      setPermisosEditados(permisosEditados.filter(p => !p.startsWith(`${moduloId}.`)));
    } else {
      const set = new Set([...permisosEditados, ...clavesMod]);
      setPermisosEditados([...set]);
    }
  };

  // Guardar cambios con confirmación
  const handleEjecutarGuardado = () => {
    try {
      RolesPermisosService.guardarPermisosRol(rolSeleccionado, permisosEditados, 'Super Usuario', motivoCambio || undefined);
      setMensaje({ tipo: 'ok', texto: `Permisos del rol "${defRol.nombre}" actualizados y persistidos exitosamente.` });
      setModalConfirmar(false);
      setMotivoCambio('');
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al guardar permisos.' });
      setModalConfirmar(false);
    }
  };

  // Restablecer valores de fábrica para el rol
  const handleRestablecerDefecto = () => {
    if (!window.confirm(`¿Restablecer los permisos del rol "${defRol.nombre}" a los valores normativos por defecto?`)) return;
    RolesPermisosService.restablecerRol(rolSeleccionado, 'Super Usuario');
    setPermisosEditados(RolesPermisosService.getPermisosRol(rolSeleccionado));
    setMensaje({ tipo: 'info', texto: `Permisos restablecidos a los valores por defecto del rol.` });
  };

  // Copiar permisos desde otro rol
  const handleCopiarDesde = (origen: RolId) => {
    if (origen === rolSeleccionado) return;
    if (window.confirm(`¿Copiar todos los permisos asignados a "${getDefinicionRol(origen).nombre}" hacia "${defRol.nombre}"?`)) {
      const copiados = RolesPermisosService.getPermisosRol(origen).filter(p => !esClaveReservada(p));
      setPermisosEditados(copiados);
      setMensaje({ tipo: 'info', texto: `Permisos copiados desde ${getDefinicionRol(origen).nombre}. Recuerde guardar los cambios.` });
    }
  };

  // Módulos filtrados para la vista
  const modulosFiltrados = useMemo(() => {
    return CATALOGO_PERMISOS.filter(mod => {
      if (filtroGrupo !== 'todos' && mod.grupo !== filtroGrupo) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const coincide = mod.nombre.toLowerCase().includes(q) || mod.descripcion.toLowerCase().includes(q) || mod.id.toLowerCase().includes(q);
        if (!coincide) return false;
      }
      return true;
    });
  }, [filtroGrupo, busqueda]);

  const bitacora = useMemo(() => RolesPermisosService.getBitacora(), [subTab]);

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-700 gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            Matriz de Control de Acceso y Permisos por Rol (RBAC)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Módulo reservado para el Super Usuario. Configure las funciones, lecturas, escrituras y procesos a los que tiene acceso cada rol.
          </p>
        </div>

        {/* Simulador "Ver como rol" para auditar UI */}
        {esSuperUsuario && (
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700">
            <Eye className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-bold text-slate-300">Auditar UI:</span>
            <select
              value={rolSimulado || 'real'}
              onChange={e => setRolSimulado(e.target.value === 'real' ? null : (e.target.value as RolId))}
              className="text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold px-2 py-1"
            >
              <option value="real">Vista Super Usuario (Real)</option>
              {ROLES_DEFINICIONES.filter(r => r.id !== 'super_usuario').map(r => (
                <option key={r.id} value={r.id}>Ver como: {r.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {mensaje && (
        <div className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
          mensaje.tipo === 'ok'
            ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
            : mensaje.tipo === 'error'
            ? 'bg-red-950/60 border-red-700 text-red-300'
            : 'bg-blue-950/60 border-blue-700 text-blue-300'
        }`}>
          <div className="flex items-center gap-2">
            {mensaje.tipo === 'ok' && <Check className="w-4 h-4 shrink-0" />}
            {mensaje.tipo === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {mensaje.tipo === 'info' && <Sparkles className="w-4 h-4 shrink-0" />}
            <span>{mensaje.texto}</span>
          </div>
          <button onClick={() => setMensaje(null)} className="text-[10px] underline font-bold">Cerrar</button>
        </div>
      )}

      {/* Sub-navegación: Matriz vs Bitácora */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setSubTab('matriz')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            subTab === 'matriz' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          Matriz de Permisos
        </button>
        <button
          onClick={() => setSubTab('bitacora')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            subTab === 'bitacora' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Bitácora de Auditoría ({bitacora.length})
        </button>
      </div>

      {subTab === 'matriz' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Panel Izquierdo: Selector de Roles */}
          <div className="lg:col-span-1 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Roles Institucionales SLEP
            </h4>
            <div className="space-y-1.5">
              {ROLES_DEFINICIONES.map(r => {
                const activo = r.id === rolSeleccionado;
                const totalPermisos = RolesPermisosService.getPermisosRol(r.id).length;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleCambiarRol(r.id)}
                    className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-1 ${
                      activo
                        ? 'bg-blue-900/40 border-blue-500 shadow-md'
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${activo ? 'text-blue-300' : 'text-white'}`}>
                        {r.nombre}
                      </span>
                      {!r.editable && (
                        <span title="Rol inmutable con dominio completo" className="flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600/40">
                          <Lock className="w-3 h-3" /> Inmutable
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                      {r.descripcion}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                      <span>Alcance: <strong className="text-slate-300">{r.alcance}</strong></span>
                      <span>{totalPermisos} activos</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel Derecho: Matriz Detallada */}
          <div className="lg:col-span-3 space-y-4">
            {/* Barra de Herramientas del Rol Activo */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{defRol.nombre}</h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Nivel {defRol.nivel} · Alcance {defRol.alcance}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{defRol.descripcion}</p>
              </div>

              {defRol.editable ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Selector Copiar Desde */}
                  <select
                    onChange={e => { if (e.target.value) handleCopiarDesde(e.target.value as RolId); e.target.value = ''; }}
                    className="text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-300 px-2.5 py-1.5"
                    defaultValue=""
                  >
                    <option value="" disabled>Copiar permisos de…</option>
                    {ROLES_DEFINICIONES.filter(r => r.id !== rolSeleccionado).map(r => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>

                  <button
                    onClick={handleRestablecerDefecto}
                    title="Restablecer valores normativos de fábrica"
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Defecto</span>
                  </button>

                  <button
                    onClick={() => setModalConfirmar(true)}
                    disabled={!diff.hayCambios}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 rounded-lg shadow-md flex items-center gap-1.5 transition"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Cambios {diff.hayCambios ? `(${diff.agregados.length + diff.removidos.length})` : ''}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-600/40 px-3 py-1.5 rounded-xl">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>El Super Usuario conserva siempre todas las atribuciones de forma inmutable.</span>
                </div>
              )}
            </div>

            {/* Filtros de Módulos */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                <button
                  onClick={() => setFiltroGrupo('todos')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                    filtroGrupo === 'todos' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({CATALOGO_PERMISOS.length})
                </button>
                {GRUPOS_PERMISOS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setFiltroGrupo(g.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                      filtroGrupo === g.id ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {g.nombre}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Filtrar función…"
                className="w-full sm:w-48 px-3 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>

            {/* Tabla de Matriz */}
            <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/60">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3 min-w-[220px]">Función / Módulo</th>
                    {ACCIONES_ORDEN.map(acc => (
                      <th key={acc} className="px-3 py-3 text-center min-w-[80px]">
                        {ACCIONES_ETIQUETAS[acc]}
                      </th>
                    ))}
                    {defRol.editable && <th className="px-3 py-3 text-right">Todo</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {modulosFiltrados.map(mod => {
                    return (
                      <tr key={mod.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{mod.nombre}</span>
                            {mod.critico && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-red-950/80 text-red-400 border border-red-700/50">
                                Crítico
                              </span>
                            )}
                            {mod.reservadoSuperUsuario && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-700/50">
                                Super Usuario
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">{mod.descripcion}</div>
                        </td>

                        {/* Celdas por acción */}
                        {ACCIONES_ORDEN.map(acc => {
                          const existeAccion = mod.acciones.includes(acc);
                          if (!existeAccion) {
                            return (
                              <td key={acc} className="px-3 py-3 text-center text-slate-700">
                                —
                              </td>
                            );
                          }

                          const clave = k(mod.id, acc);
                          const esReservada = esClaveReservada(clave);
                          const activa = defRol.id === 'super_usuario' || permisosEditados.includes(clave);
                          const disabled = !defRol.editable || (esReservada && defRol.id !== 'super_usuario');

                          return (
                            <td key={acc} className="px-3 py-3 text-center">
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => handleTogglePermiso(mod.id, acc)}
                                className={`w-6 h-6 rounded-md flex items-center justify-center mx-auto transition ${
                                  activa
                                    ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-500'
                                    : 'bg-slate-950 border border-slate-700 hover:border-slate-500'
                                } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                title={`${activa ? 'Revocar' : 'Conceder'} ${ACCIONES_ETIQUETAS[acc]} en ${mod.nombre}`}
                              >
                                {activa && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>
                            </td>
                          );
                        })}

                        {defRol.editable && (
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleModuloCompleto(mod.id)}
                              className="text-[10px] text-slate-400 hover:text-white font-bold underline"
                            >
                              Alternar
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Vista SubTab: Bitácora de Auditoría */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Historial de Modificaciones de Permisos
            </h4>
            <span className="text-[11px] text-slate-500 font-mono">
              Registros append-only de seguridad institucional
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3">Fecha y Hora</th>
                  <th className="px-4 py-3">Rol Afectado</th>
                  <th className="px-4 py-3">Modificado Por</th>
                  <th className="px-4 py-3">Permisos Agregados</th>
                  <th className="px-4 py-3">Permisos Revocados</th>
                  <th className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {bitacora.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                      No hay registros de cambios de permisos en el sistema.
                    </td>
                  </tr>
                ) : (
                  bitacora.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {new Date(item.fecha).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {getDefinicionRol(item.rolId).nombre}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{item.usuario}</td>
                      <td className="px-4 py-3">
                        {item.agregados.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.agregados.map(p => (
                              <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                                +{p}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {item.removidos.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.removidos.map(p => (
                              <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-700/50">
                                -{p}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-400 italic">
                        {item.motivo || 'Actualización manual'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Confirmación con Diff antes de guardar */}
      {modalConfirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Confirmar Modificación de Atribuciones</h4>
                <p className="text-xs text-slate-400">Rol: {defRol.nombre}</p>
              </div>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto rounded-xl bg-slate-950 p-3 border border-slate-800 text-xs">
              {diff.agregados.length > 0 && (
                <div>
                  <span className="font-bold text-emerald-400 uppercase text-[10px]">
                    Permisos a conceder ({diff.agregados.length}):
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {diff.agregados.map(p => (
                      <span key={p} className="font-mono text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/50 px-1.5 py-0.5 rounded">
                        +{p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {diff.removidos.length > 0 && (
                <div>
                  <span className="font-bold text-red-400 uppercase text-[10px]">
                    Permisos a revocar ({diff.removidos.length}):
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {diff.removidos.map(p => (
                      <span key={p} className="font-mono text-[10px] bg-red-950 text-red-300 border border-red-700/50 px-1.5 py-0.5 rounded">
                        -{p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                Motivo / Justificación del cambio (opcional)
              </label>
              <input
                type="text"
                value={motivoCambio}
                onChange={e => setMotivoCambio(e.target.value)}
                placeholder="ej: Habilitar exportación de planillas DEP para el rol"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalConfirmar(false)}
                className="px-3 py-2 text-xs text-slate-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEjecutarGuardado}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition"
              >
                Confirmar y Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
