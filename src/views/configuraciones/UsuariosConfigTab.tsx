import React, { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Trash2, Edit2, KeyRound, Shield, Check, AlertCircle, RotateCcw, Search, Lock, CheckCircle2, XCircle, Sparkles, RefreshCw } from 'lucide-react';
import { AuthService, generateSalt, hashPassword, generarPasswordTemporalSegura } from '../../services/authService';
import { UsuarioSistema, UserRole } from '../../types/authTypes';
import { Establecimiento } from '../../types';
import { ROLES_DEFINICIONES, getDefinicionRol, rolesAsignablesPor, normalizarRol } from '../../security/rolesDefinitions';
import { usePermisos } from '../../security/PermisosContext';
import { guardarPerfilAsesor, actualizarColegiosDeAsesor } from '../../services/configuracionGeneralService';

interface UsuariosConfigTabProps {
  colegios: Establecimiento[];
  onColegiosActualizados?: () => Promise<void>;
}

const BADGE_COLORES: Record<string, string> = {
  rose: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  violet: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  sky: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  teal: 'bg-teal-500/20 text-teal-300 border-teal-500/40'
};

const CARGO_POR_ROL: Record<UserRole, string> = {
  super_usuario: 'Super Usuario / Administrador General',
  subdirector_uatp: 'Subdirector(a) UATP',
  coordinador_uatp: 'Coordinador(a) UATP',
  asesor_uatp: 'Asesor(a) UATP',
  director_establecimiento: 'Director(a) de Establecimiento',
  jefe_utp_establecimiento: 'Jefe(a) UTP de Establecimiento'
};

const SUPER_EMAIL = 'saxneal@gmail.com';

export const UsuariosConfigTab: React.FC<UsuariosConfigTabProps> = ({ colegios, onColegiosActualizados }) => {
  const { can, rol: rolActor } = usePermisos();
  const puedeEditar = can('usuarios.editar');
  const puedeEliminar = can('usuarios.eliminar');
  const rolesAsignables = rolActor ? rolesAsignablesPor(rolActor) : [];

  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalResetAbierto, setModalResetAbierto] = useState(false);
  const [usuarioReset, setUsuarioReset] = useState<UsuarioSistema | null>(null);
  const [nuevaPasswordReset, setNuevaPasswordReset] = useState('');
  const [usuarioEnEdicion, setUsuarioEnEdicion] = useState<UsuarioSistema | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [filtroRol, setFiltroRol] = useState<'todos' | UserRole>('todos');
  const [generandoDirectores, setGenerandoDirectores] = useState(false);

  // Form State
  const [username, setUsername] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('director_establecimiento');
  const [cargo, setCargo] = useState(CARGO_POR_ROL.director_establecimiento);
  const [password, setPassword] = useState('');
  const [rbdAsignado, setRbdAsignado] = useState<string>(colegios[0]?.rbd || '');
  const [carteraRbds, setCarteraRbds] = useState<string[]>([]);
  const [asesoresSupervisados, setAsesoresSupervisados] = useState<string[]>([]);
  const [busquedaCartera, setBusquedaCartera] = useState('');
  const [activo, setActivo] = useState(true);

  const alcanceForm = getDefinicionRol(role).alcance;
  const esCuentaOficial = (usuarioEnEdicion?.email || '').toLowerCase() === SUPER_EMAIL;

  const cargarLista = async () => {
    try {
      setUsuarios(await AuthService.getUsuarios());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    cargarLista();
  }, []);

  const asesoresDisponibles = useMemo(
    () => usuarios.filter(u => normalizarRol(u.role) === 'asesor_uatp' && u.id !== usuarioEnEdicion?.id),
    [usuarios, usuarioEnEdicion]
  );

  const colegiosFiltrados = useMemo(() => {
    const q = busquedaCartera.trim().toLowerCase();
    if (!q) return colegios;
    return colegios.filter(c => c.nombre.toLowerCase().includes(q) || c.rbd.includes(q) || (c.comuna || '').toLowerCase().includes(q));
  }, [colegios, busquedaCartera]);

  const abrirModalReset = (u: UsuarioSistema) => {
    setUsuarioReset(u);
    setNuevaPasswordReset(generarPasswordTemporalSegura());
    setModalResetAbierto(true);
  };

  const handleEjecutarReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioReset || !nuevaPasswordReset) return;
    try {
      await AuthService.guardarUsuario(usuarioReset, nuevaPasswordReset);
      setMensaje({
        tipo: 'ok',
        texto: `Contraseña de "${usuarioReset.username}" restablecida con éxito a "${nuevaPasswordReset}".`
      });
      setModalResetAbierto(false);
      await cargarLista();
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al resetear contraseña.' });
    }
  };

  const handleToggleActivo = async (u: UsuarioSistema) => {
    try {
      const nuevoEstado = !u.activo;
      await AuthService.toggleEstadoUsuario(u.id, nuevoEstado);
      setMensaje({
        tipo: 'ok',
        texto: `Usuario "${u.username}" ${nuevoEstado ? 'habilitado' : 'deshabilitado'} exitosamente.`
      });
      await cargarLista();
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al modificar estado del usuario.' });
    }
  };

  const abrirModalNuevo = () => {
    const rolInicial: UserRole = rolesAsignables.some(r => r.id === 'director_establecimiento')
      ? 'director_establecimiento'
      : (rolesAsignables[rolesAsignables.length - 1]?.id || 'jefe_utp_establecimiento');
    setUsuarioEnEdicion(null);
    setUsername('');
    setNombreCompleto('');
    setEmail('');
    setRole(rolInicial);
    setCargo(CARGO_POR_ROL[rolInicial]);
    setPassword('');
    setRbdAsignado(colegios[0]?.rbd || '');
    setCarteraRbds([]);
    setAsesoresSupervisados([]);
    setBusquedaCartera('');
    setActivo(true);
    setMensaje(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = (u: UsuarioSistema) => {
    setUsuarioEnEdicion(u);
    setUsername(u.username);
    setNombreCompleto(u.nombreCompleto);
    setEmail(u.email || '');
    setRole(normalizarRol(u.role));
    setCargo(u.cargo);
    setPassword(''); // Opcional al editar
    setRbdAsignado(u.rbdAsignado || colegios[0]?.rbd || '');
    
    // Obtener cartera completa combinando carteraRbds explícito con los colegios que tienen a este usuario asignado
    const nombreNorm = u.nombreCompleto.trim().toLowerCase();
    const rbdsEnColegios = colegios
      .filter(c => (c.asesorUatp || '').trim().toLowerCase() === nombreNorm)
      .map(c => c.rbd);
    const carteraCombinada = Array.from(new Set([...(u.carteraRbds || []), ...rbdsEnColegios]));

    setCarteraRbds(carteraCombinada);
    setAsesoresSupervisados(u.asesoresSupervisados || []);
    setBusquedaCartera('');
    setActivo(u.activo ?? true);
    setMensaje(null);
    setModalAbierto(true);
  };

  const toggleEnLista = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor];

  const handleGuardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    if (!username.trim() || !nombreCompleto.trim()) {
      setMensaje({ tipo: 'error', texto: 'Usuario y Nombre Completo son obligatorios.' });
      return;
    }

    if (!usuarioEnEdicion && !password) {
      setMensaje({ tipo: 'error', texto: 'Debe ingresar una contraseña para el nuevo usuario.' });
      return;
    }

    if (!esCuentaOficial && !rolesAsignables.some(r => r.id === role)) {
      setMensaje({ tipo: 'error', texto: 'No tiene atribuciones para asignar ese rol.' });
      return;
    }

    if (alcanceForm === 'establecimiento' && !rbdAsignado) {
      setMensaje({ tipo: 'error', texto: 'Debe asignar un establecimiento a este rol.' });
      return;
    }

    try {
      let salt = usuarioEnEdicion ? usuarioEnEdicion.salt : generateSalt();
      let passwordHash = usuarioEnEdicion ? usuarioEnEdicion.passwordHash : '';

      // Si se escribió una nueva contraseña, actualizar el hash
      if (password) {
        salt = generateSalt();
        passwordHash = await hashPassword(password, salt);
      }

      const cleanUsername = username.trim().toLowerCase();
      const cleanEmail = email.trim() || (cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@slepvallediguillin.cl`);

      const usuarioAGuardar: UsuarioSistema = {
        ...(usuarioEnEdicion || {}),
        id: usuarioEnEdicion ? usuarioEnEdicion.id : `user-${Date.now()}`,
        username: cleanUsername,
        nombreCompleto: nombreCompleto.trim(),
        email: cleanEmail,
        role,
        cargo: cargo.trim(),
        passwordHash,
        salt,
        rbdAsignado: alcanceForm === 'establecimiento' ? rbdAsignado : undefined,
        carteraRbds: alcanceForm === 'cartera' || alcanceForm === 'equipo' ? carteraRbds : [],
        asesoresSupervisados: alcanceForm === 'equipo' ? asesoresSupervisados : [],
        activo
      };

      const guardado = await AuthService.guardarUsuario(usuarioAGuardar, password || undefined);

      // Si el usuario es Asesor UATP, sincronizar su perfil y cartera en el catálogo de establecimientos
      if (guardado.role === 'asesor_uatp') {
        try {
          guardarPerfilAsesor({
            id: guardado.id,
            nombre: guardado.nombreCompleto,
            email: guardado.email || cleanEmail,
            cargo: guardado.cargo || 'Asesor(a) UATP',
            colorBadge: '#2563eb'
          });
          // Actualizar SQLite siempre con la cartera seleccionada (incluso si está vacía para limpiar asignaciones previas)
          await actualizarColegiosDeAsesor(guardado.nombreCompleto, guardado.carteraRbds || [], colegios);
          if (onColegiosActualizados) {
            await onColegiosActualizados();
          }
        } catch (syncErr) {
          console.warn('[UsuariosConfigTab] Aviso sincronizando cartera de asesor:', syncErr);
        }
      }
      setMensaje({
        tipo: 'ok',
        texto: usuarioEnEdicion
          ? `Usuario "${usuarioAGuardar.username}" actualizado exitosamente.`
          : `Usuario "${usuarioAGuardar.username}" creado y habilitado exitosamente.`
      });
      setModalAbierto(false);
      await cargarLista();
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al guardar usuario' });
    }
  };

  const handleEliminar = async (u: UsuarioSistema) => {
    if (window.confirm(`¿Estás seguro de eliminar al usuario "${u.username}"?`)) {
      try {
        await AuthService.eliminarUsuario(u.id);
        await cargarLista();
      } catch (err: any) {
        setMensaje({ tipo: 'error', texto: err.message || 'No se pudo eliminar el usuario.' });
      }
    }
  };

  const describirAlcance = (u: UsuarioSistema) => {
    const def = getDefinicionRol(normalizarRol(u.role));
    if (def.alcance === 'global') return <span className="text-slate-500 italic text-[11px]">Todo el territorio</span>;
    if (def.alcance === 'establecimiento') {
      const cole = u.rbdAsignado ? colegios.find(c => c.rbd === u.rbdAsignado) : null;
      return cole
        ? <span className="text-slate-200 text-xs font-semibold">{cole.nombre} (RBD {cole.rbd})</span>
        : <span className="text-red-400 text-[11px] font-bold">Sin establecimiento asignado</span>;
    }
    if (def.alcance === 'equipo') {
      return (
        <span className="text-slate-200 text-[11px]">
          {(u.asesoresSupervisados || []).length} asesor(es) · {(u.carteraRbds || []).length} colegio(s) propios
        </span>
      );
    }
    const nombreNorm = u.nombreCompleto.trim().toLowerCase();
    const rbdsEnColegios = colegios
      .filter(c => (c.asesorUatp || '').trim().toLowerCase() === nombreNorm)
      .map(c => c.rbd);
    const countTotal = Array.from(new Set([...(u.carteraRbds || []), ...rbdsEnColegios])).length;
    return <span className="text-slate-200 text-[11px]">{countTotal} colegio(s) en cartera</span>;
  };

  const handleGenerarDirectoresMasivo = async () => {
    if (!window.confirm('¿Confirmas generar o sincronizar masivamente las 89 cuentas de Directores del territorio con contraseña inicial 12346 y su correo SLEP como usuario?')) {
      return;
    }
    setGenerandoDirectores(true);
    try {
      const res = await AuthService.generarUsuariosDirectoresMasivo();
      await cargarLista();
      if (onColegiosActualizados) {
        await onColegiosActualizados();
      }
      setMensaje({
        tipo: 'ok',
        texto: `✓ Base de datos actualizada (SQLite + Cloud Firestore): ${res.creados} creados, ${res.actualizados} sincronizados de ${res.totalProcesados} directores territoriales.`
      });
    } catch (err: any) {
      setMensaje({
        tipo: 'error',
        texto: `Error al generar usuarios masivos: ${err.message || err}`
      });
    } finally {
      setGenerandoDirectores(false);
    }
  };

  const usuariosVisibles = filtroRol === 'todos' ? usuarios : usuarios.filter(u => normalizarRol(u.role) === filtroRol);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-700 gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Gestión de Usuarios y Atribuciones RBAC
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Crea, edita y administra credenciales, contraseñas, roles y alcance territorial (cartera, equipo o establecimiento).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtroRol}
            onChange={e => setFiltroRol(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white"
          >
            <option value="todos">Todos los roles</option>
            {ROLES_DEFINICIONES.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          {puedeEditar && (
            <>
              <button
                onClick={handleGenerarDirectoresMasivo}
                disabled={generandoDirectores}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 rounded-xl shadow-md shadow-amber-600/30 transition"
                title="Generar masivamente los 89 usuarios para los directores de escuelas y liceos del territorio"
              >
                {generandoDirectores ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-200" />}
                <span>Generar Usuarios Directores</span>
              </button>
              <button
                onClick={abrirModalNuevo}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md shadow-blue-600/30 transition"
              >
                <Plus className="w-4 h-4" />
                Nuevo Usuario
              </button>
            </>
          )}
        </div>
      </div>

      {mensaje && (
        <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
          mensaje.tipo === 'ok' ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300' : 'bg-red-950/60 border-red-700 text-red-300'
        }`}>
          {mensaje.tipo === 'ok' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{mensaje.texto}</span>
        </div>
      )}

      {/* Lista de Usuarios */}
      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/60">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-800/80 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-700">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Nombre &amp; Cargo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Alcance</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-medium">
            {usuariosVisibles.map(u => {
              const def = getDefinicionRol(normalizarRol(u.role));
              const oficial = (u.email || '').toLowerCase() === SUPER_EMAIL;
              const editableParaActor = oficial
                ? rolActor === 'super_usuario'
                : rolesAsignables.some(r => r.id === def.id);
              return (
                <tr key={u.id} className={`hover:bg-slate-800/40 transition ${u.activo ? '' : 'opacity-60 bg-red-950/10'}`}>
                  <td className="px-4 py-3 font-bold text-white">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span>{u.username}</span>
                      {!u.activo && <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">Inactivo</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-200">{u.nombreCompleto}</div>
                    <div className="text-[10px] text-slate-400">{u.cargo}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${BADGE_COLORES[def.color]}`}>
                      {def.nombre}
                    </span>
                  </td>
                  <td className="px-4 py-3">{describirAlcance(u)}</td>
                  <td className="px-4 py-3">
                    {oficial ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Activo (Raíz)</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleActivo(u)}
                        disabled={!puedeEditar || !editableParaActor}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                          u.activo
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/50 hover:bg-emerald-900/50'
                            : 'bg-rose-950/60 text-rose-300 border-rose-600/50 hover:bg-rose-900/50'
                        } ${(!puedeEditar || !editableParaActor) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer shadow-sm'}`}
                        title={u.activo ? 'Cuenta habilitada. Clic para deshabilitar' : 'Cuenta inactiva. Clic para habilitar'}
                      >
                        {u.activo ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Habilitado</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-400" />
                            <span>Deshabilitado</span>
                          </>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {puedeEditar && editableParaActor && (
                        <>
                          <button
                            onClick={() => abrirModalReset(u)}
                            className="p-1.5 text-amber-400 hover:text-amber-200 hover:bg-amber-950/60 rounded-lg transition"
                            title={`Resetear contraseña de ${u.username}`}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => abrirModalEditar(u)}
                            className="p-1.5 text-blue-400 hover:text-blue-200 hover:bg-blue-950/60 rounded-lg transition"
                            title="Editar usuario y permisos"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {puedeEliminar && editableParaActor && !oficial && (
                        <button
                          onClick={() => handleEliminar(u)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/60 rounded-lg transition"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {(!editableParaActor || !puedeEditar) && <Lock className="w-3.5 h-3.5 text-slate-600" />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Crear / Editar Usuario */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              {usuarioEnEdicion ? `Editar Usuario: ${usuarioEnEdicion.username}` : 'Crear Nuevo Usuario'}
            </h4>
            <form onSubmit={handleGuardarUsuario} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Usuario (login)
                </label>
                <input
                  type="text"
                  required
                  disabled={esCuentaOficial}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="ej: dir_pueblo_seco"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={nombreCompleto}
                    onChange={e => setNombreCompleto(e.target.value)}
                    placeholder="ej: María González Tapia"
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={cargo}
                    onChange={e => setCargo(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  disabled={esCuentaOficial}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="direccion@slepvallediguillin.cl"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Rol
                  </label>
                  <select
                    value={role}
                    disabled={esCuentaOficial}
                    onChange={e => {
                      const r = e.target.value as UserRole;
                      setRole(r);
                      setCargo(CARGO_POR_ROL[r]);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {(esCuentaOficial ? ROLES_DEFINICIONES.filter(r => r.id === 'super_usuario') : rolesAsignables).map(r => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">{getDefinicionRol(role).descripcion}</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    {usuarioEnEdicion ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                  </label>
                  <input
                    type="password"
                    required={!usuarioEnEdicion}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={usuarioEnEdicion ? 'Dejar en blanco para conservar' : '••••••••'}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {alcanceForm === 'establecimiento' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Establecimiento Asignado (Exclusivo)
                  </label>
                  <select
                    value={rbdAsignado}
                    onChange={e => setRbdAsignado(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {colegios.map(c => (
                      <option key={c.id} value={c.rbd}>
                        {c.nombre} (RBD {c.rbd} - {c.comuna})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {alcanceForm === 'equipo' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Equipo de Asesores Supervisados ({asesoresSupervisados.length})
                  </label>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-2 space-y-1">
                    {asesoresDisponibles.length === 0 && (
                      <p className="text-[11px] text-slate-500 italic p-1">No hay usuarios con rol Asesor UATP registrados.</p>
                    )}
                    {asesoresDisponibles.map(a => (
                      <label key={a.id} className="flex items-center gap-2 text-xs text-slate-200 px-1 py-0.5 rounded hover:bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={asesoresSupervisados.includes(a.id)}
                          onChange={() => setAsesoresSupervisados(l => toggleEnLista(l, a.id))}
                        />
                        <span>{a.nombreCompleto}</span>
                        <span className="text-[10px] text-slate-500">({(a.carteraRbds || []).length} colegios)</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {(alcanceForm === 'cartera' || alcanceForm === 'equipo') && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    {alcanceForm === 'equipo' ? 'Colegios a cargo directo' : 'Cartera de Establecimientos'} ({carteraRbds.length})
                  </label>
                  <div className="relative mb-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      value={busquedaCartera}
                      onChange={e => setBusquedaCartera(e.target.value)}
                      placeholder="Buscar por nombre, RBD o comuna…"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-2 space-y-0.5">
                    {colegiosFiltrados.map(c => (
                      <label key={c.id} className="flex items-center gap-2 text-xs text-slate-200 px-1 py-0.5 rounded hover:bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={carteraRbds.includes(c.rbd)}
                          onChange={() => setCarteraRbds(l => toggleEnLista(l, c.rbd))}
                        />
                        <span className="truncate">{c.nombre}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">RBD {c.rbd} · {c.comuna}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    También se incluyen automáticamente los colegios cuyo "Asesor UATP" coincide con el nombre del usuario.
                  </p>
                </div>
              )}

              {!esCuentaOficial && (
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
                  Cuenta activa
                </label>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-3 py-2 text-xs text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md transition"
                >
                  {usuarioEnEdicion ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Resetear Contraseña (Super Usuario / Admin) */}
      {modalResetAbierto && usuarioReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-xl">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Resetear Contraseña</h4>
                <p className="text-[11px] text-slate-400">Usuario: {usuarioReset.username}</p>
              </div>
            </div>

            <form onSubmit={handleEjecutarReset} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Nueva Contraseña Temporal
                </label>
                <input
                  type="text"
                  required
                  value={nuevaPasswordReset}
                  onChange={e => setNuevaPasswordReset(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  El usuario podrá ingresar con esta clave y luego cambiarla voluntariamente desde su perfil.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalResetAbierto(false)}
                  className="px-3 py-2 text-xs text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-md transition"
                >
                  Restablecer Clave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
