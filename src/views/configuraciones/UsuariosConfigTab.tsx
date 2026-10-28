import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2, KeyRound, Shield, Check, AlertCircle, Building2, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { AuthService, generateSalt, hashPassword } from '../../services/authService';
import { UsuarioSistema, UserRole } from '../../types/authTypes';
import { Establecimiento } from '../../types';

interface UsuariosConfigTabProps {
  colegios: Establecimiento[];
}

export const UsuariosConfigTab: React.FC<UsuariosConfigTabProps> = ({ colegios }) => {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalResetAbierto, setModalResetAbierto] = useState(false);
  const [usuarioReset, setUsuarioReset] = useState<UsuarioSistema | null>(null);
  const [nuevaPasswordReset, setNuevaPasswordReset] = useState('');
  const [usuarioEnEdicion, setUsuarioEnEdicion] = useState<UsuarioSistema | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('director_colegio');
  const [cargo, setCargo] = useState('Director de Establecimiento');
  const [password, setPassword] = useState('');
  const [rbdAsignado, setRbdAsignado] = useState<string>(colegios[0]?.rbd || '3501');
  const [activo, setActivo] = useState(true);

  const cargarLista = async () => {
    try {
      setCargando(true);
      const lista = await AuthService.getUsuarios();
      setUsuarios(lista);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarLista();
  }, []);

  const abrirModalReset = (u: UsuarioSistema) => {
    setUsuarioReset(u);
    setNuevaPasswordReset('123456'); // Clave sugerida por defecto
    setModalResetAbierto(true);
  };

  const handleEjecutarReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioReset || !nuevaPasswordReset) return;
    try {
      await AuthService.cambiarPassword(usuarioReset.id, nuevaPasswordReset);
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

  const abrirModalNuevo = () => {
    setUsuarioEnEdicion(null);
    setUsername('');
    setNombreCompleto('');
    setEmail('');
    setRole('director_colegio');
    setCargo('Director de Establecimiento');
    setPassword('');
    setRbdAsignado(colegios[0]?.rbd || '3501');
    setActivo(true);
    setMensaje(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = (u: UsuarioSistema) => {
    setUsuarioEnEdicion(u);
    setUsername(u.username);
    setNombreCompleto(u.nombreCompleto);
    setEmail(u.email || '');
    setRole(u.role);
    setCargo(u.cargo);
    setPassword(''); // Opcional al editar
    setRbdAsignado(u.rbdAsignado || colegios[0]?.rbd || '3501');
    setActivo(u.activo ?? true);
    setMensaje(null);
    setModalAbierto(true);
  };

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

    try {
      let salt = usuarioEnEdicion ? usuarioEnEdicion.salt : generateSalt();
      let passwordHash = usuarioEnEdicion ? usuarioEnEdicion.passwordHash : '';

      // Si se escribió una nueva contraseña, actualizar el hash
      if (password) {
        salt = generateSalt();
        passwordHash = await hashPassword(password, salt);
      }

      const usuarioAGuardar: UsuarioSistema = {
        id: usuarioEnEdicion ? usuarioEnEdicion.id : `user-${Date.now()}`,
        username: username.trim().toLowerCase(),
        nombreCompleto: nombreCompleto.trim(),
        email: email.trim(),
        role,
        cargo: cargo.trim(),
        passwordHash,
        salt,
        rbdAsignado: role === 'director_colegio' ? rbdAsignado : undefined,
        activo
      };

      await AuthService.guardarUsuario(usuarioAGuardar);
      setMensaje({
        tipo: 'ok',
        texto: usuarioEnEdicion
          ? `Usuario "${usuarioAGuardar.username}" actualizado exitosamente.`
          : `Usuario "${usuarioAGuardar.username}" creado exitosamente.`
      });
      setModalAbierto(false);
      await cargarLista();
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al guardar usuario' });
    }
  };

  const handleEliminar = async (id: string, uname: string) => {
    if (uname === 'admin') {
      alert('No se puede eliminar la cuenta principal de Administrador.');
      return;
    }
    if (window.confirm(`¿Estás seguro de eliminar al usuario "${uname}"?`)) {
      await AuthService.eliminarUsuario(id);
      await cargarLista();
    }
  };

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return { label: 'Admin SLEP', color: 'bg-red-500/20 text-red-300 border-red-500/40' };
      case 'asesor':
        return { label: 'Asesor UATP', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      case 'director_colegio':
        return { label: 'Director Colegio', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'auditor':
        return { label: 'Auditor DEP', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-700">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Gestión de Usuarios y Atribuciones RBAC
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Crea, edita y administra credenciales, contraseñas, roles y asignación de colegios.
          </p>
        </div>
        <button
          onClick={abrirModalNuevo}
          className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md shadow-blue-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </button>
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
              <th className="px-4 py-3">Nombre & Cargo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Colegio Asignado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-medium">
            {usuarios.map(u => {
              const badge = getRoleBadge(u.role);
              const cole = u.rbdAsignado ? colegios.find(c => c.rbd === u.rbdAsignado) : null;
              return (
                <tr key={u.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    <span>{u.username}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-200">{u.nombreCompleto}</div>
                    <div className="text-[10px] text-slate-400">{u.cargo}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badge.color}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {cole ? (
                      <span className="text-slate-200 text-xs font-semibold">
                        {cole.nombre} (RBD {cole.rbd})
                      </span>
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">Todos los Colegios</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
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
                      {u.username !== 'admin' && (
                        <button
                          onClick={() => handleEliminar(u.id, u.username)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/60 rounded-lg transition"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
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
                  disabled={usuarioEnEdicion?.username === 'admin'}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="ej: dir_pueblo_seco"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

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
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="direccion@slepvallediguillin.cl"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Rol
                  </label>
                  <select
                    value={role}
                    disabled={usuarioEnEdicion?.username === 'admin'}
                    onChange={e => {
                      const r = e.target.value as UserRole;
                      setRole(r);
                      if (r === 'director_colegio') setCargo('Director de Establecimiento');
                      if (r === 'asesor') setCargo('Asesor UATP');
                      if (r === 'auditor') setCargo('Auditor DEP');
                      if (r === 'admin') setCargo('Administrador SLEP');
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="director_colegio">Director de Colegio</option>
                    <option value="asesor">Asesor UATP</option>
                    <option value="auditor">Auditor DEP</option>
                    <option value="admin">Administrador General</option>
                  </select>
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

              {role === 'director_colegio' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Colegio Asignado (Exclusivo)
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
