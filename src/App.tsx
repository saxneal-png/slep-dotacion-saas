import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { LoadingAnimation } from './components/LoadingAnimation';
const SchoolNavigatorModal = React.lazy(() => import('./components/SchoolNavigatorModal').then(m => ({ default: m.SchoolNavigatorModal })));
const SaveBackupModal = React.lazy(() => import('./components/SaveBackupModal').then(m => ({ default: m.SaveBackupModal })));
const DotacionCopilotDrawer = React.lazy(() => import('./components/DotacionCopilotDrawer').then(m => ({ default: m.DotacionCopilotDrawer })));
const ModalTraspasoDotacion = React.lazy(() => import('./components/ModalTraspasoDotacion').then(m => ({ default: m.ModalTraspasoDotacion })));
const ComparadorPeriodosModal = React.lazy(() => import('./components/ComparadorPeriodosModal').then(m => ({ default: m.ComparadorPeriodosModal })));
const GestionEstablecimientosModal = React.lazy(() => import('./components/GestionEstablecimientosModal').then(m => ({ default: m.GestionEstablecimientosModal })));
import { Sparkles } from 'lucide-react';

const CarteraView = React.lazy(() => import('./views/CarteraView').then(m => ({ default: m.CarteraView })));
const ColegiosAsesoradosView = React.lazy(() => import('./views/ColegiosAsesoradosView').then(m => ({ default: m.ColegiosAsesoradosView })));
const ConfiguracionesGeneralesView = React.lazy(() => import('./views/ConfiguracionesGeneralesView').then(m => ({ default: m.ConfiguracionesGeneralesView })));
const SalasSaeView = React.lazy(() => import('./views/SalasSaeView').then(m => ({ default: m.SalasSaeView })));
const CurriculumDemandaView = React.lazy(() => import('./views/CurriculumDemandaView').then(m => ({ default: m.CurriculumDemandaView })));
const PieAuditorView = React.lazy(() => import('./views/PieAuditorView').then(m => ({ default: m.PieAuditorView })));
const DocentesDotacionView = React.lazy(() => import('./views/DocentesDotacionView').then(m => ({ default: m.DocentesDotacionView })));
const BalanzaDiagnosticoView = React.lazy(() => import('./views/BalanzaDiagnosticoView').then(m => ({ default: m.BalanzaDiagnosticoView })));
const ConsolidadorMasterView = React.lazy(() => import('./views/ConsolidadorMasterView').then(m => ({ default: m.ConsolidadorMasterView })));
const SigeIngestaView = React.lazy(() => import('./views/SigeIngestaView').then(m => ({ default: m.SigeIngestaView })));
const ColegioWorkspaceView = React.lazy(() => import('./views/ColegioWorkspaceView').then(m => ({ default: m.ColegioWorkspaceView })));
const AnalizadorDotacionView = React.lazy(() => import('./views/AnalizadorDotacionView').then(m => ({ default: m.AnalizadorDotacionView })));
const EstadisticasView = React.lazy(() => import('./views/EstadisticasView').then(m => ({ default: m.EstadisticasView })));
const PlanesEstudioView = React.lazy(() => import('./views/PlanesEstudioView').then(m => ({ default: m.PlanesEstudioView })));
const AsistentesDotacionView = React.lazy(() => import('./views/AsistentesDotacionView').then(m => ({ default: m.AsistentesDotacionView })));

import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria,
  AsistenteEducacion
} from './types';

import {
  getDb,
  listarEstablecimientos,
  guardarEstablecimiento,
  eliminarEstablecimiento,
  listarSalas,
  listarTodasLasSalas,
  guardarSala,
  eliminarSala,
  listarCursos,
  listarTodosLosCursos,
  guardarCurso,
  eliminarCurso,
  listarDocentes,
  guardarDocente,
  guardarDocentesBatch,
  eliminarDocente,
  listarAsignaciones,
  guardarAsignacion,
  eliminarAsignacion,
  listarAsistentes,
  listarTodosLosAsistentesTerritorio,
  guardarAsistente,
  guardarAsistentesBatch,
  eliminarAsistente,
  exportarCarteraCompleta,
  exportarDotacionEstablecimiento,
  importarCartera,
  exportarBaseDatosSqlite,
  importarBaseDatosSqlite,
  listarTodosLosDocentesTerritorio,
  listarTodasLasAsignaciones,
  subscribePersist,
  persistDb,
  getUltimaHoraGuardado,
  borrarDotacionPeriodo,
  reiniciarTodaLaBaseDatos
} from './database/db';

import { checkAndSeedInitialData } from './database/seedData';
import { SupabaseDotacionService } from './services/supabaseDotacionService';
import { isSupabaseEnabled, supabase } from './services/supabaseClient';
import { notificarMutacionLocalEmitida } from './services/colaboracionService';
import { calcularDiagnosticoColegio, consolidarCarteraTerritorial, DiagnosticoColegioCompleto } from './services/dotacionCalculationService';
import { cargarConfiguracionGeneral, cargarConfiguracionGeneralRemota } from './services/configuracionGeneralService';
import { RolesPermisosService } from './services/rolesPermisosService';
import { AuthService } from './services/authService';
import { AuthSession, UsuarioSistema } from './types/authTypes';
import { useEvaluadorPermisos, PermisosProvider } from './security/PermisosContext';
import { getDefinicionRol, normalizarRol } from './security/rolesDefinitions';
import { colegiosVisibles, puedeAccederRbd } from './services/scopeService';
import { LoginModal } from './components/auth/LoginModal';
import { CambiarPasswordModal } from './components/auth/CambiarPasswordModal';
import { OlvidoPasswordModal } from './components/auth/OlvidoPasswordModal';
import { PrimerAccesoModal } from './components/auth/PrimerAccesoModal';

export const App: React.FC = () => {
  const [session, setSession] = useState<AuthSession | null>(() => AuthService.getSessionActual());
  const [loading, setLoading] = useState(true);
  const loadRequestIdRef = useRef<number>(0);

  const evaluadorPermisos = useEvaluadorPermisos(session);
  const permisos = evaluadorPermisos.legado;
  const alcanceReal = session ? getDefinicionRol(normalizarRol(session.usuario.role)).alcance : null;
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioSistema[]>([]);
  useEffect(() => {
    if (session) AuthService.getUsuarios().then(setUsuariosSistema).catch(() => setUsuariosSistema([]));
  }, [session?.usuario.id]);
  const [modalCambiarPassword, setModalCambiarPassword] = useState(false);
  const [modalOlvidoPassword, setModalOlvidoPassword] = useState(false);
  const [avisoSesionPausada, setAvisoSesionPausada] = useState<string | null>(null);
  const [colegios, setColegios] = useState<Establecimiento[]>([]);
  const [colegioActivo, setColegioActivo] = useState<Establecimiento | null>(null);

  // Datos del colegio actualmente activo
  const [salas, setSalas] = useState<SalaInfraestructura[]>([]);
  const [cursos, setCursos] = useState<CursoSae[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionHoraria[]>([]);
  const [asistentes, setAsistentes] = useState<AsistenteEducacion[]>([]);

  // Datos globales territoriales (100% de los colegios)
  const [todasLasSalas, setTodasLasSalas] = useState<SalaInfraestructura[]>([]);
  const [todosLosCursos, setTodosLosCursos] = useState<CursoSae[]>([]);
  const [todosLosDocentes, setTodosLosDocentes] = useState<Docente[]>([]);
  const [todasLasAsignaciones, setTodasLasAsignaciones] = useState<AsignacionHoraria[]>([]);
  const [todosLosAsistentes, setTodosLosAsistentes] = useState<AsistenteEducacion[]>([]);

  const [vistaActiva, setVistaActiva] = useState<string>(() => {
    try {
      const cfg = cargarConfiguracionGeneral();
      return cfg.ui?.vistaInicial || 'colegios_asesorados';
    } catch {
      return 'colegios_asesorados';
    }
  });
  const [notificacion, setNotificacion] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);
  const [guardandoEnNube, setGuardandoEnNube] = useState(false);
  const [workspaceTabActiva, setWorkspaceTabActiva] = useState<'balanza' | 'docentes' | 'asistentes' | 'cursos' | 'pie' | 'salas'>('balanza');
  const [estadoSyncNube, setEstadoSyncNube] = useState<'synced' | 'checking' | 'saving' | 'updated_remotely' | 'offline' | 'error'>('synced');
  const [ultimaHoraSyncNube, setUltimaHoraSyncNube] = useState<string>('');

  useEffect(() => {
    const handleOnline = () => setEstadoSyncNube('synced');
    const handleOffline = () => setEstadoSyncNube('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleGuardarCambiosEnNube = async (apartadoEspecifico?: 'docentes' | 'asistentes' | 'cursos' | 'salas' | 'pie' | 'general') => {
    if (!colegioActivo) {
      mostrarMensaje('Selecciona un establecimiento para guardar sus cambios en la nube.', 'error');
      return;
    }
    // Protección estricta RBAC: evitar que se guarden cambios en un colegio no autorizado
    if (session && !puedeAccederRbd(session.usuario, colegioActivo.rbd, colegios, usuariosSistema)) {
      mostrarMensaje('Acceso denegado: No tiene autorización para modificar este establecimiento.', 'error');
      return;
    }
    setGuardandoEnNube(true);
    setEstadoSyncNube('saving');

    const targetApartado: 'docentes' | 'asistentes' | 'cursos' | 'salas' | 'pie' | 'general' =
      apartadoEspecifico ||
      (vistaActiva === 'workflow'
        ? (workspaceTabActiva === 'balanza' ? 'general' : workspaceTabActiva)
        : 'general');

    let apartadosTarget: Array<'docentes' | 'asistentes' | 'cursos' | 'salas' | 'asignaciones' | 'establecimiento'>;
    let labelApartado = 'completa';

    if (targetApartado === 'docentes') {
      apartadosTarget = ['docentes', 'asignaciones'];
      labelApartado = 'de Docentes y Asignaciones';
    } else if (targetApartado === 'asistentes') {
      apartadosTarget = ['asistentes'];
      labelApartado = 'de Asistentes de la Educación';
    } else if (targetApartado === 'cursos') {
      apartadosTarget = ['cursos'];
      labelApartado = 'de Cursos y Demanda';
    } else if (targetApartado === 'salas') {
      apartadosTarget = ['salas'];
      labelApartado = 'de Salas e Infraestructura';
    } else if (targetApartado === 'pie') {
      apartadosTarget = ['cursos', 'docentes', 'asignaciones', 'asistentes'];
      labelApartado = 'de Programa de Integración Escolar (PIE)';
    } else {
      apartadosTarget = ['establecimiento', 'salas', 'cursos', 'docentes', 'asignaciones', 'asistentes'];
      labelApartado = 'completa';
    }

    mostrarMensaje(`☁️ Guardando dotación ${labelApartado} de ${colegioActivo.nombre} en Supabase...`);
    try {
      const res = await SupabaseDotacionService.sincronizarApartadoColegioASupabase(
        colegioActivo.rbd,
        periodoActivo,
        apartadosTarget
      );
      notificarMutacionLocalEmitida(targetApartado);
      setEstadoSyncNube('synced');
      setUltimaHoraSyncNube(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));
      mostrarMensaje(
        `✓ Cambios guardados (${labelApartado}) para ${colegioActivo.nombre} (${periodoActivo}): ${res.docentesSincronizados} docentes, ${res.cursosSincronizados} cursos, ${res.asignacionesSincronizadas} asignaciones y ${res.asistentesSincronizados} asistentes sincronizados en Supabase sin tocar otros apartados.`,
        'success'
      );
    } catch (err: any) {
      console.error('Error sincronizando escuela con Supabase:', err);
      setEstadoSyncNube('error');
      mostrarMensaje(`Error guardando en la nube: ${err.message || err}`, 'error');
    } finally {
      setGuardandoEnNube(false);
    }
  };

  // Modales Steve Jobs: Navegador Rápido, Centro de Respaldos, Copilot IA y Traspaso
  const [modalNavegadorAbierto, setModalNavegadorAbierto] = useState(false);
  const [modalRespaldosAbierto, setModalRespaldosAbierto] = useState(false);
  const [modalCopilotAbierto, setModalCopilotAbierto] = useState(false);
  const [modalTraspasoAbierto, setModalTraspasoAbierto] = useState(false);
  const [modalComparadorAbierto, setModalComparadorAbierto] = useState(false);
  const [modalGestionEstablecimientosAbierto, setModalGestionEstablecimientosAbierto] = useState(false);
  const [periodoActivo, setPeriodoActivoState] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('slep_dotacion_periodo_activo', '2027');
      }
    } catch {}
    return 2027;
  });

  const setPeriodoActivo = (_p: number) => {
    setPeriodoActivoState(2027);
    try {
      localStorage.setItem('slep_dotacion_periodo_activo', '2027');
    } catch {}
  };
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState<'balanza' | 'docentes' | 'asistentes' | 'cursos' | 'pie' | 'salas'>('balanza');

  const mostrarMensaje = (mensaje: string, tipo: 'success' | 'error' = 'success') => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => setNotificacion(null), 4000);
  };

  // Validación reactiva, remota y en tiempo real de la vigencia de la sesión activa
  useEffect(() => {
    if (!session) {
      if (isSupabaseEnabled()) {
        AuthService.sincronizarEstadoPausaDesdeNube().catch(() => {});
      }
      return;
    }

    let cancelado = false;

    const verificarEstadoSesion = async (remoto: boolean = true) => {
      if (cancelado) return;
      const sesionActual = AuthService.getSessionActual();
      if (!sesionActual) {
        setSession(null);
        return;
      }
      const check = remoto
        ? await AuthService.verificarSesionRemota(sesionActual)
        : AuthService.verificarSesionValida(sesionActual);

      if (cancelado) return;

      if (!check.valida) {
        const motivoMsg =
          check.motivo || 'Su sesión ha sido pausada temporalmente por período de revisión técnica interna UATP.';
        AuthService.logout();
        setSession(null);
        setAvisoSesionPausada(motivoMsg);
        mostrarMensaje(motivoMsg, 'error');
      }
    };

    // Verificación inicial contra Supabase al cargar sesión
    verificarEstadoSesion(true);

    const handleFocus = () => verificarEstadoSesion(true);
    const handleEventoPausa = () => {
      verificarEstadoSesion(false);
    };
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'slep_pausa_revision_interna_v1' ||
        e.key === 'slep_usuarios_sistema_v2' ||
        e.key === 'slep_auth_session_v1'
      ) {
        verificarEstadoSesion(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('slep:sesiones_pausadas', handleEventoPausa);

    // Respaldo periódico ligero (30s) por si Realtime no está disponible en redes escolares
    const intervalo = setInterval(() => verificarEstadoSesion(true), 30000);

    // Suscripción en tiempo real de Supabase para cierre inmediato al pausar un estamento
    let canalControl: any = null;
    if (isSupabaseEnabled()) {
      canalControl = supabase
        .channel(`control_sesion_${session.usuario.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'configuracion_general',
            filter: 'id=eq.pausa_revision_interna'
          },
          () => {
            verificarEstadoSesion(true);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'usuarios_sistema',
            filter: `id=eq.${session.usuario.id}`
          },
          () => {
            verificarEstadoSesion(true);
          }
        )
        .subscribe();
    }

    return () => {
      cancelado = true;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('slep:sesiones_pausadas', handleEventoPausa);
      clearInterval(intervalo);
      if (canalControl) {
        supabase.removeChannel(canalControl).catch(() => {});
      }
    };
  }, [session]);

  const [sincronizandoNube, setSincronizandoNube] = useState(false);

  const handleRefrescarDesdeNube = async (apartadoEspecifico?: 'docentes' | 'asistentes' | 'cursos' | 'salas' | 'pie' | 'general') => {
    if (!colegioActivo) {
      mostrarMensaje('Selecciona un establecimiento para refrescar sus datos.', 'error');
      return;
    }
    setSincronizandoNube(true);
    setEstadoSyncNube('checking');

    let apartadosTarget: Array<'docentes' | 'asistentes' | 'cursos' | 'salas' | 'asignaciones' | 'establecimiento'> | undefined;
    if (apartadoEspecifico === 'docentes') apartadosTarget = ['docentes', 'asignaciones'];
    else if (apartadoEspecifico === 'asistentes') apartadosTarget = ['asistentes'];
    else if (apartadoEspecifico === 'cursos') apartadosTarget = ['cursos'];
    else if (apartadoEspecifico === 'salas') apartadosTarget = ['salas'];
    else if (apartadoEspecifico === 'pie') apartadosTarget = ['cursos', 'docentes', 'asignaciones', 'asistentes'];

    mostrarMensaje(`☁️ Consultando dotación${apartadoEspecifico ? ` (${apartadoEspecifico})` : ''} de ${colegioActivo.nombre} en Supabase...`);
    try {
      const res = await SupabaseDotacionService.descargarEIntegrarColegioDesdeSupabase(
        colegioActivo.rbd,
        periodoActivo,
        apartadosTarget,
        true // forceSync manual
      );
      setUltimaHoraSyncNube(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));
      if (res.hayDatosRemotos) {
        await cargarDatosColegio(colegioActivo.rbd, periodoActivo, false);
        setEstadoSyncNube('updated_remotely');
        setTimeout(() => setEstadoSyncNube('synced'), 3500);
        mostrarMensaje(
          `✓ Datos sincronizados desde Supabase para ${colegioActivo.nombre}: ${res.docentesDescargados} docentes, ${res.cursosDescargados} cursos, ${res.asignacionesDescargadas} asignaciones y ${res.asistentesDescargados} asistentes cargados en tu sesión.`,
          'success'
        );
      } else {
        setEstadoSyncNube('synced');
        mostrarMensaje(`✓ Tu copia local de ${colegioActivo.nombre} (${periodoActivo}) ya está exactamente al día con la nube.`, 'success');
      }
    } catch (err: any) {
      console.error('Error al sincronizar desde Supabase:', err);
      setEstadoSyncNube('error');
      mostrarMensaje(`Error al refrescar desde Supabase: ${err.message || err}`, 'error');
    } finally {
      setSincronizandoNube(false);
    }
  };

  const handleSincronizarCarteraCompletaDesdeNube = async () => {
    setSincronizandoNube(true);
    mostrarMensaje(`☁️ Sincronizando toda la cartera territorial desde Supabase (${periodoActivo})...`);
    try {
      await cargarDatos(periodoActivo, true);
      mostrarMensaje(
        '✓ Sincronización territorial completada y datos consolidados exitosamente.',
        'success'
      );
    } catch (err: any) {
      console.error('Error al sincronizar cartera territorial:', err);
      mostrarMensaje(`Error al sincronizar cartera desde Supabase: ${err.message || err}`, 'error');
    } finally {
      setSincronizandoNube(false);
    }
  };

  // Atajos de teclado globales: Ctrl+K / Cmd+K (Navegador) y Ctrl+J / Cmd+J (Copilot IA)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!permisos || permisos.puedeAccederTodasEscuelas) {
          setModalNavegadorAbierto(prev => !prev);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (!permisos || permisos.puedeUsarCopilotIa) {
          setModalCopilotAbierto(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [permisos]);

  // 1. Cargar Base de Datos y Colecciones Globales (Optimizado para Nivel Gratuito de Vercel/Supabase)
  const cargarDatos = async (p: number = 2027, forceCloudSync: boolean = false) => {
    try {
      await getDb();
      await checkAndSeedInitialData();

      const listEst = await listarEstablecimientos();
      setColegios(listEst);

      let allSalas = await listarTodasLasSalas();
      setTodasLasSalas(allSalas);

      let allCursos = await listarTodosLosCursos(p);
      setTodosLosCursos(allCursos);

      let allDocs = await listarTodosLosDocentesTerritorio(p);
      setTodosLosDocentes(allDocs);

      let allAsigs = await listarTodasLasAsignaciones(p);
      setTodasLasAsignaciones(allAsigs);

      let allAsist = await listarTodosLosAsistentesTerritorio(p);
      setTodosLosAsistentes(allAsist);

      if (isSupabaseEnabled()) {
        try {
          const rolNormal = session?.usuario?.role ? normalizarRol(session.usuario.role) : undefined;
          const userRbd = session?.usuario?.rbdAsignado;
          const esDirector = rolNormal === 'director_establecimiento';

          // Aislamiento Estricto de Descarga Nube y Optimización de Cuota:
          // 1. Si es Director de Establecimiento, hidratar única y exclusivamente su escuela asignada
          if (esDirector && userRbd) {
            await SupabaseDotacionService.descargarEIntegrarColegioDesdeSupabase(userRbd, p);
            allSalas = await listarTodasLasSalas();
            allCursos = await listarTodosLosCursos(p);
            allDocs = await listarTodosLosDocentesTerritorio(p);
            allAsigs = await listarTodasLasAsignaciones(p);
            allAsist = await listarTodosLosAsistentesTerritorio(p);
            setTodasLasSalas(allSalas);
            setTodosLosCursos(allCursos);
            setTodosLosDocentes(allDocs);
            setTodasLasAsignaciones(allAsigs);
            setTodosLosAsistentes(allAsist);
          } else if (rolNormal === 'asesor_uatp') {
            // 2. Si es Asesor UATP, hidratar únicamente las escuelas de su cartera
            const permitidos = session ? colegiosVisibles(session.usuario, listEst, usuariosSistema) : [];
            for (const est of permitidos) {
              await SupabaseDotacionService.descargarEIntegrarColegioDesdeSupabase(est.rbd, p);
            }
            allSalas = await listarTodasLasSalas();
            allCursos = await listarTodosLosCursos(p);
            allDocs = await listarTodosLosDocentesTerritorio(p);
            allAsigs = await listarTodasLasAsignaciones(p);
            allAsist = await listarTodosLosAsistentesTerritorio(p);
            setTodasLasSalas(allSalas);
            setTodosLosCursos(allCursos);
            setTodosLosDocentes(allDocs);
            setTodasLasAsignaciones(allAsigs);
            setTodosLosAsistentes(allAsist);
          } else {
            // 3. Para Super Usuario / Admin: verificar si ya hay datos en SQLite local (IndexedDB)
            // y controlar el intervalo para no saturar la transferencia de la base de datos en cada recarga
            const syncKey = `slep_last_cartera_sync_${p}`;
            const lastSync = parseInt(localStorage.getItem(syncKey) || '0', 10);
            const now = Date.now();
            const tieneDatosLocales = allDocs.length > 0 && allCursos.length > 0;
            const intervaloExpirado = (now - lastSync) > 20 * 60 * 1000; // 20 minutos de caché local

            if (forceCloudSync || !tieneDatosLocales || intervaloExpirado) {
              const resCartera = await SupabaseDotacionService.descargarTodaLaCarteraDesdeSupabase(p);
              localStorage.setItem(syncKey, String(now));
              if (resCartera.docentesDescargados > 0 || resCartera.cursosDescargados > 0) {
                allSalas = await listarTodasLasSalas();
                allCursos = await listarTodosLosCursos(p);
                allDocs = await listarTodosLosDocentesTerritorio(p);
                allAsigs = await listarTodasLasAsignaciones(p);
                allAsist = await listarTodosLosAsistentesTerritorio(p);
                setTodasLasSalas(allSalas);
                setTodosLosCursos(allCursos);
                setTodosLosDocentes(allDocs);
                setTodasLasAsignaciones(allAsigs);
                setTodosLosAsistentes(allAsist);
              }
            }
          }
        } catch (errSync) {
          console.warn('[cargarDatos] Aviso descargando cartera desde Supabase:', errSync);
        }
      }

      RolesPermisosService.sincronizarDesdeSupabase().catch(() => {});
      cargarConfiguracionGeneralRemota().catch(() => {});

      // Determinación estricta del colegio objetivo según el alcance del usuario en sesión
      let defaultEst: Establecimiento | null = null;
      if (session) {
        const defRol = getDefinicionRol(normalizarRol(session.usuario.role));
        if (defRol.alcance === 'establecimiento' && session.usuario.rbdAsignado) {
          defaultEst = listEst.find(c => c.rbd === session.usuario.rbdAsignado) || null;
        } else {
          const permitidos = colegiosVisibles(session.usuario, listEst, usuariosSistema);
          if (permitidos.length > 0) {
            defaultEst = (colegioActivo && permitidos.some(c => c.rbd === colegioActivo.rbd)) ? colegioActivo : permitidos[0];
          }
        }
      } else if (listEst.length > 0) {
        defaultEst = colegioActivo || listEst[0];
      }

      if (defaultEst) {
        setColegioActivo(defaultEst);
        await cargarDatosColegio(defaultEst.rbd, p, !forceCloudSync);
      }
    } catch (err: any) {
      console.error('Error al inicializar datos:', err);
      mostrarMensaje(`Error al inicializar datos: ${err.message || err}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarDatosColegio = async (rbd: string, p: number = periodoActivo, autoSyncCloud: boolean = true) => {
    const currentReqId = ++loadRequestIdRef.current;
    const cleanRbd = rbd.trim();

    // 1. Carga inmediata desde SQLite local (Renderizado instantáneo <15ms)
    let s = await listarSalas(cleanRbd);
    let c = await listarCursos(cleanRbd, p);
    let d = await listarDocentes(cleanRbd, p);
    let a = await listarAsignaciones(cleanRbd, p);
    let ast = await listarAsistentes(cleanRbd, p);

    if (currentReqId !== loadRequestIdRef.current) return;
    setSalas(s);
    setCursos(c);
    setDocentes(d);
    setAsignaciones(a);
    setAsistentes(ast);

    // 2. Stale-While-Revalidate: Reconciliar en segundo plano con Supabase para absorber cambios concurrentes
    if (isSupabaseEnabled() && autoSyncCloud) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setEstadoSyncNube('offline');
        return;
      }
      setEstadoSyncNube('checking');
      try {
        const res = await SupabaseDotacionService.descargarEIntegrarColegioDesdeSupabase(cleanRbd, p);
        if (currentReqId !== loadRequestIdRef.current) return;
        const horaNow = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        setUltimaHoraSyncNube(horaNow);

        if (res.hayDatosRemotos) {
          s = await listarSalas(cleanRbd);
          c = await listarCursos(cleanRbd, p);
          d = await listarDocentes(cleanRbd, p);
          a = await listarAsignaciones(cleanRbd, p);
          ast = await listarAsistentes(cleanRbd, p);

          if (currentReqId !== loadRequestIdRef.current) return;
          setSalas(s);
          setCursos(c);
          setDocentes(d);
          setAsignaciones(a);
          setAsistentes(ast);

          // Sincronizar en memoria los arreglos territoriales para que Consolidado y Estadísticas reflejen al instante los cambios de esta escuela
          setTodasLasSalas(prev => [...prev.filter(x => x.rbd !== cleanRbd), ...s]);
          setTodosLosCursos(prev => [...prev.filter(x => x.rbd !== cleanRbd), ...c]);
          setTodosLosDocentes(prev => [...prev.filter(x => x.rbd !== cleanRbd), ...d]);
          setTodasLasAsignaciones(prev => [...prev.filter(x => x.rbd !== cleanRbd), ...a]);
          setTodosLosAsistentes(prev => [...prev.filter(x => x.rbd !== cleanRbd), ...ast]);

          setEstadoSyncNube('updated_remotely');
          setTimeout(() => setEstadoSyncNube('synced'), 3500);
        } else {
          setEstadoSyncNube('synced');
        }
      } catch (err) {
        console.warn('[cargarDatosColegio] Aviso consultando Supabase:', err);
        setEstadoSyncNube('error');
      }
    }
  };

  const handleTogglePeriodo = async (nuevoPeriodo: number) => {
    setPeriodoActivo(nuevoPeriodo);
    await cargarDatos(nuevoPeriodo);
    mostrarMensaje(`Visualizando dotación escolar periodo ${nuevoPeriodo}`);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleSelectColegio = async (est: Establecimiento) => {
    // Protección estricta RBAC: el usuario solo puede seleccionar establecimientos dentro de su alcance
    if (session && !puedeAccederRbd(session.usuario, est.rbd, colegios, usuariosSistema)) {
      mostrarMensaje('Acceso denegado: el establecimiento está fuera de su alcance asignado.', 'error');
      return;
    }
    setColegioActivo(est);
    await cargarDatosColegio(est.rbd, periodoActivo);
  };

  // Guardado seguro con soporte para Electron Save Dialog nativo
  const guardarArchivoNativoOEnNavegador = async (
    data: Uint8Array | string,
    defaultFilename: string,
    mimeType: string,
    filters: { name: string; extensions: string[] }[]
  ) => {
    const electron = (window as any).electronAPI;
    if (electron?.isDesktop && electron?.saveFileDialog && electron?.writeFile) {
      const filePath = await electron.saveFileDialog({
        defaultPath: defaultFilename,
        filters
      });
      if (!filePath) return false;
      const res = await electron.writeFile(filePath, data);
      if (!res.success) throw new Error(res.error);
      return true;
    } else {
      const blob = new Blob([data as any], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    }
  };

  // Asegurar que el colegio activo pertenezca al alcance autorizado del usuario (Establecimiento, Cartera o Equipo)
  useEffect(() => {
    if (!session || colegios.length === 0) return;
    if (alcanceReal === 'establecimiento' && session.usuario.rbdAsignado) {
      const asignado = colegios.find(c => c.rbd === session.usuario.rbdAsignado);
      if (asignado && (!colegioActivo || colegioActivo.rbd !== asignado.rbd)) {
        setColegioActivo(asignado);
        cargarDatosColegio(asignado.rbd, periodoActivo);
      }
      return;
    }
    const permitidos = colegiosVisibles(session.usuario, colegios, usuariosSistema);
    if (permitidos.length > 0 && (!colegioActivo || !permitidos.some(c => c.rbd === colegioActivo.rbd))) {
      setColegioActivo(permitidos[0]);
      cargarDatosColegio(permitidos[0].rbd, periodoActivo);
    }
  }, [session, colegios, alcanceReal, usuariosSistema]);

  // Guard de navegación: redirige a la primera vista permitida si la actual no está autorizada
  useEffect(() => {
    if (!session) return;
    if (!evaluadorPermisos.puedeVerVista(vistaActiva)) {
      const candidatas = ['colegios_asesorados', 'workflow', 'cartera', 'consolidador', 'estadisticas', 'planes_estudio'];
      const destino = candidatas.find(v => evaluadorPermisos.puedeVerVista(v));
      if (destino && destino !== vistaActiva) setVistaActiva(destino);
    }
  }, [session, vistaActiva, evaluadorPermisos]);

  // Handlers CRUD
  const handleGuardarColegio = async (est: Establecimiento) => {
    await guardarEstablecimiento(est);
    const list = await listarEstablecimientos();
    setColegios(list);
    if (!colegioActivo || colegioActivo.id === est.id) {
      setColegioActivo(est);
      await cargarDatosColegio(est.rbd, periodoActivo);
    }
    mostrarMensaje(`Establecimiento ${est.nombre} guardado exitosamente.`);
  };

  const handleEliminarColegio = async (id: string) => {
    await eliminarEstablecimiento(id);
    const list = await listarEstablecimientos();
    setColegios(list);
    if (!colegioActivo || colegioActivo.id === id || colegioActivo.rbd === id || !list.some(c => c.id === colegioActivo.id)) {
      if (list.length > 0) {
        handleSelectColegio(list[0]);
      } else {
        setColegioActivo(null);
      }
    }
    await cargarDatos(periodoActivo);
    mostrarMensaje('Establecimiento y su dotación asociada eliminados exitosamente.');
  };

  const handleGuardarSala = async (s: SalaInfraestructura) => {
    await guardarSala(s);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd);
    const allSalas = await listarTodasLasSalas();
    setTodasLasSalas(allSalas);
    mostrarMensaje(`Sala ${s.nombreSala} guardada.`);
  };

  const handleEliminarSala = async (id: string) => {
    await eliminarSala(id);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd, periodoActivo);
    const allSalas = await listarTodasLasSalas();
    setTodasLasSalas(allSalas);
    mostrarMensaje('Sala eliminada.');
  };

  const handleGuardarCurso = async (c: CursoSae) => {
    await guardarCurso(c);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd, periodoActivo);
    const allCursos = await listarTodosLosCursos(periodoActivo);
    setTodosLosCursos(allCursos);
    mostrarMensaje(`Curso ${c.nivel} ${c.letra} actualizado.`);
  };

  const handleEliminarCurso = async (id: string) => {
    await eliminarCurso(id);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd, periodoActivo);
    const allCursos = await listarTodosLosCursos(periodoActivo);
    setTodosLosCursos(allCursos);
    mostrarMensaje('Curso eliminado.');
  };

  const handleGuardarDocente = async (d: Docente) => {
    await guardarDocente(d);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd, periodoActivo);
    const all = await listarTodosLosDocentesTerritorio(periodoActivo);
    setTodosLosDocentes(all);
    mostrarMensaje(`Docente ${d.nombres} ${d.apellidos} guardado.`);
  };

  const handleEliminarDocente = async (id: string) => {
    await eliminarDocente(id);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd, periodoActivo);
    const all = await listarTodosLosDocentesTerritorio(periodoActivo);
    setTodosLosDocentes(all);
    mostrarMensaje('Docente eliminado de la dotación.');
  };

  const handleGuardarAsignacion = async (asig: AsignacionHoraria) => {
    await guardarAsignacion(asig);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd, periodoActivo);
    const all = await listarTodasLasAsignaciones(periodoActivo);
    setTodasLasAsignaciones(all);
    mostrarMensaje('Asignación horaria actualizada.');
  };

  const handleEliminarAsignacion = async (id: string) => {
    await eliminarAsignacion(id);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd, periodoActivo);
    const all = await listarTodasLasAsignaciones(periodoActivo);
    setTodasLasAsignaciones(all);
    mostrarMensaje('Asignación eliminada.');
  };

  const handleGuardarAsistente = async (a: AsistenteEducacion) => {
    await guardarAsistente(a);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd, periodoActivo);
    const all = await listarTodosLosAsistentesTerritorio(periodoActivo);
    setTodosLosAsistentes(all);
    mostrarMensaje(`Asistente ${a.nombres} guardado exitosamente.`);
  };

  const handleGuardarAsistentesBatch = async (batch: AsistenteEducacion[], reemplazar: boolean = false) => {
    if (!colegioActivo) return;
    await guardarAsistentesBatch(batch, colegioActivo.rbd, periodoActivo, reemplazar);
    await cargarDatosColegio(colegioActivo.rbd, periodoActivo);
    const all = await listarTodosLosAsistentesTerritorio(periodoActivo);
    setTodosLosAsistentes(all);
    mostrarMensaje(`Se guardaron ${batch.length} asistentes exitosamente.`);
  };

  const handleEliminarAsistente = async (id: string) => {
    await eliminarAsistente(id);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd, periodoActivo);
    const all = await listarTodosLosAsistentesTerritorio(periodoActivo);
    setTodosLosAsistentes(all);
    mostrarMensaje('Asistente eliminado de la dotación.');
  };

  // Exportar Cartera .slep
  const handleExportarCarteraSlep = async () => {
    try {
      const data = await exportarCarteraCompleta(
        colegioActivo?.asesorUatp || 'Asesor UATP',
        'uatp@slepvallediguillin.cl'
      );
      const jsonStr = JSON.stringify(data, null, 2);
      const filename = `Cartera_UATP_ValleDiguillin_${new Date().toISOString().split('T')[0]}.slep`;
      const guardado = await guardarArchivoNativoOEnNavegador(
        jsonStr,
        filename,
        'application/json',
        [{ name: 'Archivos Cartera SLEP', extensions: ['slep', 'json'] }]
      );
      if (guardado) mostrarMensaje('Archivo de Cartera .slep exportado con éxito.');
    } catch (e: any) {
      mostrarMensaje(`Error al exportar: ${e.message || e}`, 'error');
    }
  };

  // Exportar Dotación de un Establecimiento (.slep individual para el Asesor)
  const handleExportarDotacionColegio = async (est: Establecimiento, periodo: number = periodoActivo) => {
    try {
      const data = await exportarDotacionEstablecimiento(
        est.rbd,
        periodo,
        est.asesorUatp || 'Asesor UATP',
        'uatp@slepvallediguillin.cl'
      );
      const jsonStr = JSON.stringify(data, null, 2);
      const filename = `Dotacion_${est.nombre.replace(/\s+/g, '_')}_RBD${est.rbd}_${periodo}.slep`;
      const guardado = await guardarArchivoNativoOEnNavegador(
        jsonStr,
        filename,
        'application/json',
        [{ name: 'Archivos Dotación SLEP', extensions: ['slep', 'json'] }]
      );
      if (guardado) mostrarMensaje(`Dotación de ${est.nombre} (${periodo}) exportada con éxito.`);
    } catch (e: any) {
      mostrarMensaje(`Error al exportar dotación: ${e.message || e}`, 'error');
    }
  };

  // Exportar Matriz Oficial Excel por Escuela (Formato SLEP / [h]:mm)
  // Si existe una API key de Gemini configurada en el Analizador, se usa para asistir la exportación.
  const handleExportarMatrizExcelColegio = async (est: Establecimiento, periodo: number = periodoActivo) => {
    try {
      const cursosColegio = todosLosCursos.filter(c => c.rbd === est.rbd && (c.periodo === undefined || c.periodo === periodo));
      const docentesColegio = todosLosDocentes.filter(d => d.rbd === est.rbd && (d.periodo === undefined || d.periodo === periodo));
      const asignacionesColegio = todasLasAsignaciones.filter(a => a.rbd === est.rbd && (a.periodo === undefined || a.periodo === periodo));

      // Leer configuración de Gemini desde localStorage (la misma que usa el Analizador)
      const geminiApiKey = localStorage.getItem('gemini_api_key') || '';
      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
      const geminiAnalizarTodos = localStorage.getItem('gemini_export_analizar_todos') === 'true';

      const geminiOptions = geminiApiKey
        ? { apiKey: geminiApiKey, modelName: geminiModel, analizarTodos: geminiAnalizarTodos }
        : undefined;

      if (geminiOptions) {
        mostrarMensaje(`🤖 Gemini AI activado — analizando dotación de ${est.nombre}...`);
      }

      const { generarExcelMatrizDotacionColegio } = await import('./services/excelMatrizDotacionService');
      const bytes = await generarExcelMatrizDotacionColegio(
        est,
        docentesColegio,
        cursosColegio,
        asignacionesColegio,
        geminiOptions
      );

      const nombreLimpio = est.nombre.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
      const filename = `Matriz_Dotacion_${nombreLimpio}_RBD_${est.rbd}_${periodo}.xlsx`;

      const guardado = await guardarArchivoNativoOEnNavegador(
        bytes,
        filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        [{ name: 'Planillas Microsoft Excel', extensions: ['xlsx'] }]
      );
      if (guardado) {
        const sufijo = geminiOptions ? ' (con análisis Gemini AI ✓)' : '';
        mostrarMensaje(`Matriz de dotación Excel de ${est.nombre} exportada exitosamente${sufijo}.`);
      }
    } catch (e: any) {
      console.error('Error al exportar matriz excel colegio:', e);
      mostrarMensaje(`Error al exportar matriz Excel: ${e.message || e}`, 'error');
    }
  };

  // Importar Cartera .slep o Dotación Individual de Asesor
  const handleImportarCarteraSlep = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await importarCartera(parsed);
      await persistDb(true);
      await cargarDatos();
      const nombresInfo = res.colegiosNombres?.length ? `: ${res.colegiosNombres.join(', ')}` : '';
      mostrarMensaje(`Dotación importada con éxito (${res.importados} establecimiento/s${nombresInfo}).`);
    } catch (e: any) {
      mostrarMensaje(`Error al importar archivo: ${e.message || e}`, 'error');
    }
  };

  // Ingesta Completa SIGE
  const handleIngestarSigeCompleto = async (
    est: Establecimiento,
    docentesImportados: Docente[]
  ) => {
    try {
      await guardarEstablecimiento(est);
      // La sincronización remota ya fue realizada (y verificada) por SigeIngestaView
      await guardarDocentesBatch(docentesImportados, true);
      await persistDb(true);
      await cargarDatos(periodoActivo);
      const listEst = await listarEstablecimientos();
      const estActivo = listEst.find(c => c.rbd === est.rbd) || est;
      setColegioActivo(estActivo);
      await cargarDatosColegio(estActivo.rbd, periodoActivo);

      mostrarMensaje(`✓ Ingesta exitosa: ${est.nombre} con ${docentesImportados.length} funcionarios ingresados a la base.`);
      setVistaActiva('workflow');
    } catch (e: any) {
      mostrarMensaje(`Error en la ingesta SIGE: ${e.message || e}`, 'error');
    }
  };

  // Ingesta Completa de Asistentes SIGE
  const handleIngestarAsistentesSigeCompleto = async (
    est: Establecimiento,
    asistentesImportados: any[]
  ) => {
    try {
      await guardarEstablecimiento(est);
      const db = await getDb();
      const { guardarAsistentesBatch } = await import('./database/repositories/asistentesRepo');
      await guardarAsistentesBatch(db, asistentesImportados, est.rbd, periodoActivo, true);
      await persistDb(true);
      await cargarDatos();
      const listEst = await listarEstablecimientos();
      const estActivo = listEst.find(c => c.rbd === est.rbd) || est;
      setColegioActivo(estActivo);
      await cargarDatosColegio(estActivo.rbd);

      mostrarMensaje(`✓ Ingesta SIGE exitosa: ${est.nombre} con ${asistentesImportados.length} asistentes de la educación ingresados.`);
      setVistaActiva('asistentes');
    } catch (e: any) {
      mostrarMensaje(`Error en la ingesta de asistentes SIGE: ${e.message || e}`, 'error');
    }
  };

  // Exportar Base de Datos SQLite (.sqlite)
  const handleExportarSqlite = async () => {
    try {
      const bytes = await exportarBaseDatosSqlite();
      const filename = `Dotacion_SLEP_ValleDiguillin_${new Date().toISOString().split('T')[0]}.sqlite`;
      const guardado = await guardarArchivoNativoOEnNavegador(
        bytes,
        filename,
        'application/x-sqlite3',
        [{ name: 'Bases de Datos SQLite', extensions: ['sqlite', 'db'] }]
      );
      if (guardado) mostrarMensaje('Base de datos SQLite exportada exitosamente.');
    } catch (e: any) {
      mostrarMensaje(`Error al exportar SQLite: ${e.message || e}`, 'error');
    }
  };

  // Importar / Restaurar Base de Datos SQLite (.sqlite)
  const handleImportarSqlite = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      await importarBaseDatosSqlite(uint8);
      await cargarDatos();
      mostrarMensaje('Base de datos SQLite restaurada y cargada exitosamente.');
    } catch (e: any) {
      mostrarMensaje(`Error al restaurar SQLite: ${e.message || e}`, 'error');
    }
  };

  // Borrado Seguro de Dotación por Colegio / Periodo
  const handleBorrarDotacionPeriodo = async (periodo: number, rbd?: string) => {
    try {
      const res = await borrarDotacionPeriodo(periodo, rbd);
      if (isSupabaseEnabled()) {
        try {
          await SupabaseDotacionService.borrarDotacionPeriodo(periodo, rbd);
        } catch (cloudErr) {
          console.warn('[handleBorrarDotacionPeriodo] Aviso eliminando en Supabase:', cloudErr);
        }
      }
      await cargarDatos(periodo);
      if (colegioActivo) {
        await cargarDatosColegio(colegioActivo.rbd, periodo);
      }
      const colegioTarget = rbd ? colegios.find(c => c.rbd === rbd) : null;
      if (colegioTarget) {
        mostrarMensaje(`✓ Se vació exitosamente la dotación de "${colegioTarget.nombre}" (RBD ${rbd}) en el periodo ${periodo}: ${res.cursosBorrados} cursos, ${res.docentesBorrados} docentes y ${res.asignacionesBorradas} asignaciones eliminadas.`);
      } else {
        mostrarMensaje(`Se eliminaron ${res.cursosBorrados} cursos, ${res.docentesBorrados} docentes y ${res.asignacionesBorradas} asignaciones del periodo ${periodo}.`);
      }
    } catch (e: any) {
      mostrarMensaje(`Error al vaciar dotación: ${e.message || e}`, 'error');
    }
  };

  // Reinicio Total de la Base de Datos
  const handleReiniciarBaseDatos = async () => {
    try {
      await reiniciarTodaLaBaseDatos();
      if (isSupabaseEnabled()) {
        try {
          await SupabaseDotacionService.borrarDotacionPeriodo(2026);
          await SupabaseDotacionService.borrarDotacionPeriodo(2027);
        } catch (cloudErr) {
          console.warn('[handleReiniciarBaseDatos] Aviso eliminando en Supabase:', cloudErr);
        }
      }
      await checkAndSeedInitialData();
      await cargarDatos(2027);
      const list = await listarEstablecimientos();
      if (list.length > 0) {
        setColegioActivo(list[0]);
        await cargarDatosColegio(list[0].rbd, 2027);
      }
      mostrarMensaje('Base de datos reiniciada a valores iniciales.');
    } catch (e: any) {
      mostrarMensaje(`Error al reiniciar base de datos: ${e.message || e}`, 'error');
    }
  };

  // Filtrado de colegios segun el alcance del rol (global / equipo / cartera / establecimiento)
  const colegiosPermitidos = useMemo(() => {
    if (!session) return colegios;
    return colegiosVisibles(session.usuario, colegios, usuariosSistema);
  }, [colegios, session, usuariosSistema]);

  // Colecciones acotadas estrictamente a los colegios visibles/autorizados para el usuario
  const {
    cursosScope,
    docentesScope,
    asignacionesScope,
    asistentesScope,
    salasScope
  } = useMemo(() => {
    const rbdsPermitidos = new Set(colegiosPermitidos.map(c => c.rbd));
    return {
      cursosScope: todosLosCursos.filter(c => rbdsPermitidos.has(c.rbd)),
      docentesScope: todosLosDocentes.filter(d => rbdsPermitidos.has(d.rbd)),
      asignacionesScope: todasLasAsignaciones.filter(a => rbdsPermitidos.has(a.rbd)),
      asistentesScope: todosLosAsistentes.filter(a => rbdsPermitidos.has(a.rbd)),
      salasScope: todasLasSalas.filter(s => rbdsPermitidos.has(s.rbd))
    };
  }, [colegiosPermitidos, todosLosCursos, todosLosDocentes, todasLasAsignaciones, todosLosAsistentes, todasLasSalas]);

  // Diagnostico del colegio activo
  const diagnosticoColegioActivo = useMemo(() => {
    if (!colegioActivo) return null;
    return calcularDiagnosticoColegio(colegioActivo, salas, cursos, docentes, asignaciones);
  }, [colegioActivo, salas, cursos, docentes, asignaciones]);

  // Diagnosticos de TODOS los colegios con datos 100% reales globales (Pre-agrupados O(N) por RBD)
  const diagnosticosTodosColegios = useMemo<DiagnosticoColegioCompleto[]>(() => {
    const cursosPorRbd = new Map<string, CursoSae[]>();
    for (const c of todosLosCursos) {
      let arr = cursosPorRbd.get(c.rbd);
      if (!arr) {
        arr = [];
        cursosPorRbd.set(c.rbd, arr);
      }
      arr.push(c);
    }

    const docentesPorRbd = new Map<string, Docente[]>();
    for (const d of todosLosDocentes) {
      let arr = docentesPorRbd.get(d.rbd);
      if (!arr) {
        arr = [];
        docentesPorRbd.set(d.rbd, arr);
      }
      arr.push(d);
    }

    const salasPorRbd = new Map<string, SalaInfraestructura[]>();
    for (const s of todasLasSalas) {
      let arr = salasPorRbd.get(s.rbd);
      if (!arr) {
        arr = [];
        salasPorRbd.set(s.rbd, arr);
      }
      arr.push(s);
    }

    const asigsPorRbd = new Map<string, AsignacionHoraria[]>();
    for (const a of todasLasAsignaciones) {
      let arr = asigsPorRbd.get(a.rbd);
      if (!arr) {
        arr = [];
        asigsPorRbd.set(a.rbd, arr);
      }
      arr.push(a);
    }

    return colegios.map(est => {
      const cList = cursosPorRbd.get(est.rbd) || [];
      const dList = docentesPorRbd.get(est.rbd) || [];
      const sList = salasPorRbd.get(est.rbd) || [];
      const aList = asigsPorRbd.get(est.rbd) || [];
      return calcularDiagnosticoColegio(est, sList, cList, dList, aList);
    });
  }, [colegios, todosLosCursos, todosLosDocentes, todasLasSalas, todasLasAsignaciones]);

  // Diagnosticos acotados a la cartera/alcance del usuario en sesion (para Consolidado y Estadisticas)
  const diagnosticosColegiosPermitidos = useMemo<DiagnosticoColegioCompleto[]>(() => {
    const rbdsPermitidos = new Set(colegiosPermitidos.map(c => c.rbd));
    return diagnosticosTodosColegios.filter(d => rbdsPermitidos.has(d.establecimiento.rbd));
  }, [diagnosticosTodosColegios, colegiosPermitidos]);

  // Inconsistencias de la cartera permitida
  const consolidacionMaster = useMemo(() => {
    return consolidarCarteraTerritorial(colegiosPermitidos, docentesScope, diagnosticosColegiosPermitidos);
  }, [colegiosPermitidos, docentesScope, diagnosticosColegiosPermitidos]);

  // Exportar Excel Oficial
  const handleExportarExcel = async () => {
    try {
      const { generarExcelConsolidadoSlep } = await import('./services/excelReportService');
      const bytes = await generarExcelConsolidadoSlep(
        colegiosPermitidos,
        docentesScope,
        diagnosticosColegiosPermitidos,
        colegioActivo?.asesorUatp || 'Asesor UATP',
        asignacionesScope,
        cursosScope
      );
      const filename = `Consolidado_Dotacion_SLEP_Valle_Diguillin_${new Date().toISOString().split('T')[0]}.xlsx`;
      const guardado = await guardarArchivoNativoOEnNavegador(
        bytes,
        filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        [{ name: 'Planillas Microsoft Excel', extensions: ['xlsx'] }]
      );
      if (guardado) mostrarMensaje('Planilla oficial Excel exportada exitosamente.');
    } catch (e: any) {
      mostrarMensaje(`Error al generar Excel: ${e.message || e}`, 'error');
    }
  };

  const handleLogout = () => {
    loadRequestIdRef.current++;
    AuthService.logout();
    setSession(null);
    setColegioActivo(null);
    setSalas([]);
    setCursos([]);
    setDocentes([]);
    setAsignaciones([]);
    setAsistentes([]);
    setVistaActiva('colegios_asesorados');
    mostrarMensaje('Sesion cerrada correctamente.');
  };

  if (loading) {
    return <LoadingAnimation variant="fullscreen" />;
  }

  return (
    <PermisosProvider value={evaluadorPermisos}>
      <div className="min-h-screen bg-canvas text-content-primary flex flex-col">
      {!session && (
        <>
          <LoginModal
            avisoExterno={avisoSesionPausada}
            onLimpiarAvisoExterno={() => setAvisoSesionPausada(null)}
            onLoginSuccess={(newSession) => {
              setAvisoSesionPausada(null);
              setSession(newSession);
              mostrarMensaje(`¡Bienvenido, ${newSession.usuario.nombreCompleto}!`);
              const defRol = getDefinicionRol(normalizarRol(newSession.usuario.role));
              if (defRol.alcance === 'establecimiento' && newSession.usuario.rbdAsignado) {
                const esc = colegios.find(c => c.rbd === newSession.usuario.rbdAsignado);
                if (esc) {
                  setColegioActivo(esc);
                  cargarDatosColegio(esc.rbd, periodoActivo);
                }
                setVistaActiva('workflow');
              } else {
                const permitidos = colegiosVisibles(newSession.usuario, colegios, usuariosSistema);
                if (permitidos.length > 0) {
                  setColegioActivo(permitidos[0]);
                  cargarDatosColegio(permitidos[0].rbd, periodoActivo);
                }
                setVistaActiva('colegios_asesorados');
              }
            }}
            onAbrirOlvidoPassword={() => setModalOlvidoPassword(true)}
          />
          <OlvidoPasswordModal
            isOpen={modalOlvidoPassword}
            onClose={() => setModalOlvidoPassword(false)}
            onSuccess={(msg) => mostrarMensaje(msg, 'success')}
          />
        </>
      )}

      {session && session.usuario.debeCambiarPassword && (
        <PrimerAccesoModal
          session={session}
          onSuccess={(actualizada) => {
            setSession(actualizada);
            mostrarMensaje('¡Contraseña actualizada exitosamente! Bienvenido al sistema.');
          }}
        />
      )}

      <Header
        session={session}
        onLogout={handleLogout}
        onAbrirCambiarPassword={() => setModalCambiarPassword(true)}
        colegioActivo={colegioActivo}
        colegios={colegiosPermitidos}
        onSelectColegio={handleSelectColegio}
        vistaActiva={vistaActiva}
        onSelectVista={setVistaActiva}
        onExportarExcel={handleExportarExcel}
        inconsistenciasCount={consolidacionMaster.inconsistencias.length}
        onAbrirNavegadorColegios={() => setModalNavegadorAbierto(true)}
        onAbrirCentroRespaldos={() => setModalRespaldosAbierto(true)}
        periodoActivo={periodoActivo}
        onTogglePeriodo={handleTogglePeriodo}
        onAbrirComparadorPeriodos={() => setModalComparadorAbierto(true)}
        onAbrirTraspasoPeriodos={() => setModalTraspasoAbierto(true)}
        onAbrirCopilot={() => setModalCopilotAbierto(true)}
        onAbrirConfiguraciones={() => setVistaActiva('configuraciones')}
        onAbrirGestionEstablecimientos={() => setModalGestionEstablecimientosAbierto(true)}
        onGuardarCambiosEnNube={handleGuardarCambiosEnNube}
        guardandoEnNube={guardandoEnNube}
        sincronizandoNube={sincronizandoNube}
        onRefrescarNube={handleRefrescarDesdeNube}
        estadoSincronizacionNube={estadoSyncNube}
        ultimaSincronizacionNube={ultimaHoraSyncNube}
      />

      {/* Toast Notificación */}
      {notificacion && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-bold transition-all animate-in fade-in slide-in-from-bottom-2 ${
          notificacion.tipo === 'success' ? 'bg-slate-900 text-white border border-slate-700' : 'bg-red-600 text-white'
        }`}>
          {notificacion.mensaje}
        </div>
      )}

      {/* Contenedor Principal de Vistas */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto px-3 sm:px-5 lg:px-6 py-3 sm:py-5">
        <React.Suspense
          fallback={<LoadingAnimation variant="inline" />}
        >
        {(vistaActiva === 'colegios_asesorados' || vistaActiva === 'cartera') && (
          <ColegiosAsesoradosView
            colegios={colegiosPermitidos}
            colegioActivo={colegioActivo}
            onSelectColegio={handleSelectColegio}
            onAbrirWorkflow={(est) => {
              handleSelectColegio(est);
              setVistaActiva('workflow');
            }}
            onExportarDotacionColegio={handleExportarDotacionColegio}
            onExportarMatrizExcelColegio={handleExportarMatrizExcelColegio}
            todosLosCursos={todosLosCursos}
            todosLosDocentes={todosLosDocentes}
            todosLosAsistentes={todosLosAsistentes}
            todasLasSalas={todasLasSalas}
            todasLasAsignaciones={todasLasAsignaciones}
            periodoActivo={periodoActivo}
            onGuardarColegio={handleGuardarColegio}
            onAbrirConfiguraciones={() => setVistaActiva('configuraciones')}
            onEliminarColegio={handleEliminarColegio}
            onExportarCarteraSlep={handleExportarCarteraSlep}
            onImportarCarteraSlep={handleImportarCarteraSlep}
            onAbrirModuloSige={() => setVistaActiva('sige')}
            onAbrirGestionEstablecimientos={() => setModalGestionEstablecimientosAbierto(true)}
          />
        )}

        {vistaActiva === 'configuraciones' && (
          <ConfiguracionesGeneralesView
            colegios={colegios}
            onColegiosActualizados={async () => {
              await cargarDatos(periodoActivo);
            }}
            onExportarSqlite={handleExportarSqlite}
            onImportarSqlite={handleImportarSqlite}
            onExportarCarteraSlep={handleExportarCarteraSlep}
            onImportarCarteraSlep={handleImportarCarteraSlep}
            onVolver={() => setVistaActiva('colegios_asesorados')}
          />
        )}

        {vistaActiva === 'workflow' && (
          colegioActivo ? (
            <ColegioWorkspaceView
              colegio={colegioActivo}
              salas={salas}
              cursos={cursos}
              docentes={docentes}
              asignaciones={asignaciones}
              asistentes={asistentes}
              diagnostico={diagnosticoColegioActivo}
              onGuardarSala={handleGuardarSala}
              onEliminarSala={handleEliminarSala}
              onGuardarCurso={handleGuardarCurso}
              onEliminarCurso={handleEliminarCurso}
              onGuardarDocente={handleGuardarDocente}
              onEliminarDocente={handleEliminarDocente}
              onGuardarAsistente={handleGuardarAsistente}
              onGuardarAsistentesBatch={handleGuardarAsistentesBatch}
              onEliminarAsistente={handleEliminarAsistente}
              onGuardarAsignacion={handleGuardarAsignacion}
              onEliminarAsignacion={handleEliminarAsignacion}
              onAbrirModuloSige={() => setVistaActiva('sige')}
              onExportarExcel={handleExportarExcel}
              onAbrirNavegadorColegios={() => setModalNavegadorAbierto(true)}
              todosLosColegios={colegiosPermitidos}
              todosLosDocentes={todosLosDocentes}
              todasLasAsignaciones={todasLasAsignaciones}
              periodoActivo={periodoActivo}
              permisos={permisos}
              initialTab={workspaceInitialTab}
              onTogglePeriodo={handleTogglePeriodo}
              onRefreshData={() => cargarDatos(periodoActivo)}
              onLimpiarDotacionColegio={handleBorrarDotacionPeriodo}
              onExportarDotacionColegio={handleExportarDotacionColegio}
              onExportarMatrizExcelColegio={handleExportarMatrizExcelColegio}
              onGuardarColegio={handleGuardarColegio}
              onAbrirCopilot={() => setModalCopilotAbierto(true)}
              onNavegarAPestana={setVistaActiva} todosLosCursos={todosLosCursos}
              onGuardarApartadoNube={handleGuardarCambiosEnNube}
              onRefrescarApartadoNube={handleRefrescarDesdeNube}
              guardandoEnNube={guardandoEnNube}
              sincronizandoNube={sincronizandoNube}
              usuarioActual={session?.usuario}
              onTabChange={setWorkspaceTabActiva}
            />
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center max-w-md mx-auto my-12 animate-in fade-in">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center mx-auto mb-4 text-orange-600 font-bold text-xl">
                🏫
              </div>
              <h3 className="text-lg font-bold text-slate-800">Selecciona un Establecimiento</h3>
              <p className="text-xs text-slate-500 mt-2">
                Para ingresar al Espacio de Trabajo Escolar, selecciona una escuela de la cartera territorial.
              </p>
              <button
                onClick={() => setModalNavegadorAbierto(true)}
                className="mt-6 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md transition-all"
              >
                Abrir Navegador de Escuelas (Ctrl+K)
              </button>
            </div>
          )
        )}

        {vistaActiva === 'sige' && (
          <SigeIngestaView
            periodoActivo={periodoActivo}
            session={session}
            colegios={colegiosPermitidos}
            usuariosSistema={usuariosSistema}
            onIngestarSigeCompleto={handleIngestarSigeCompleto}
            onIngestarAsistentesSigeCompleto={handleIngestarAsistentesSigeCompleto}
          />
        )}

        {vistaActiva === 'salas_sae' && (
          <SalasSaeView
            colegio={colegioActivo}
            salas={salas}
            cursos={cursos}
            onGuardarSala={handleGuardarSala}
            onEliminarSala={handleEliminarSala}
            onGuardarCurso={handleGuardarCurso}
          />
        )}

        {vistaActiva === 'curriculum' && (
          <CurriculumDemandaView
            colegio={colegioActivo}
            cursos={cursos}
            docentes={docentes}
            asignaciones={asignaciones}
            onGuardarCurso={handleGuardarCurso}
            onEliminarCurso={handleEliminarCurso}
            onGuardarAsignacion={handleGuardarAsignacion}
            onEliminarAsignacion={handleEliminarAsignacion}
            periodoActivo={periodoActivo}
          />
        )}

        {vistaActiva === 'planes_estudio' && (
          <PlanesEstudioView
            colegios={colegiosPermitidos}
            colegioActivo={colegioActivo}
            todosLosCursos={todosLosCursos}
            periodoActivo={periodoActivo}
            onSelectColegio={handleSelectColegio}
            onAbrirWorkflow={(est) => {
              handleSelectColegio(est);
              setVistaActiva('workflow');
            }}
            onRefreshCursos={() => cargarDatos(periodoActivo)}
          />
        )}

        {vistaActiva === 'pie' && (
          <PieAuditorView
            colegio={colegioActivo}
            cursos={cursos}
            docentes={docentes}
            onGuardarCurso={handleGuardarCurso}
          />
        )}

        {vistaActiva === 'docentes' && (
          <DocentesDotacionView
            colegio={colegioActivo}
            docentes={docentes}
            asignaciones={asignaciones}
            cursos={cursos}
            onGuardarDocente={handleGuardarDocente}
            onEliminarDocente={handleEliminarDocente}
            onGuardarAsignacion={handleGuardarAsignacion}
            onEliminarAsignacion={handleEliminarAsignacion}
            todosLosColegios={colegiosPermitidos}
            todosLosDocentes={todosLosDocentes}
            todasLasAsignaciones={todasLasAsignaciones}
            onNavegarAPestana={setVistaActiva} todosLosCursos={todosLosCursos}
            periodoActivo={periodoActivo}
          />
        )}

        {vistaActiva === 'asistentes' && colegioActivo && (
          <AsistentesDotacionView
            colegio={colegioActivo}
            asistentes={asistentes}
            matricula={cursos.reduce((sum, c) => sum + (c.matriculaProyectada || 0), 0)}
            salasParvulo={salas.filter((s) => s.tipo === 'PARVULARIA').length}
            periodoActivo={periodoActivo}
            onGuardarAsistente={handleGuardarAsistente}
            onGuardarAsistentesBatch={handleGuardarAsistentesBatch}
            onEliminarAsistente={handleEliminarAsistente}
          />
        )}

        {vistaActiva === 'balanza' && (
          <BalanzaDiagnosticoView
            diagnostico={diagnosticoColegioActivo}
            onExportarExcel={handleExportarExcel}
          />
        )}

        {vistaActiva === 'consolidador' && (
          <ConsolidadorMasterView
            establecimientos={colegiosPermitidos}
            docentes={docentesScope}
            asistentes={asistentesScope}
            cursos={cursosScope}
            diagnosticos={diagnosticosColegiosPermitidos}
            asignaciones={asignacionesScope}
            onImportarCarteraSlep={handleImportarCarteraSlep}
            onExportarExcel={handleExportarExcel}
            onRecargarDatos={handleSincronizarCarteraCompletaDesdeNube}
          />
        )}

        {vistaActiva === 'estadisticas' && (
          <EstadisticasView
            colegios={colegiosPermitidos}
            colegioActivo={colegioActivo}
            onSelectColegio={handleSelectColegio}
            todosLosCursos={cursosScope}
            todosLosDocentes={docentesScope}
            todasLasAsignaciones={asignacionesScope}
            todosLosAsistentes={asistentesScope}
            asistentesColegioActivo={asistentes}
            periodoActivo={periodoActivo}
            onNavegarColegio={(est) => {
              handleSelectColegio(est);
              setVistaActiva('workflow');
            }}
            onExportarExcelGlobal={handleExportarExcel}
            onRecargarDatos={handleSincronizarCarteraCompletaDesdeNube}
          />
        )}

        {vistaActiva === 'analizador' && (
          <AnalizadorDotacionView
            periodoActivo={periodoActivo}
            onSyncWithDatabase={async () => {
              await cargarDatos(periodoActivo);
            }}
            onNavigateToColegio={async (rbd: string, tabDestino: string = 'workflow', _pDestino: number = 2027) => {
              const pDestino = 2027;
              await cargarDatos(pDestino);
              const list = await listarEstablecimientos();
              const est = list.find((c) => c.rbd === rbd) || colegios.find((c) => c.rbd === rbd);
              if (est) {
                await handleSelectColegio(est);
                setPeriodoActivo(pDestino);
                if (tabDestino === 'asistentes' || tabDestino === 'docentes' || tabDestino === 'cursos' || tabDestino === 'pie' || tabDestino === 'salas') {
                  setWorkspaceInitialTab(tabDestino as any);
                } else {
                  setWorkspaceInitialTab('balanza');
                }
                setVistaActiva('workflow');
                const destinoTxt = tabDestino === 'asistentes' ? ' (Dotación de Asistentes)' : '';
                mostrarMensaje(`Navegando a ${est.nombre}${destinoTxt} en Dotación ${pDestino}`);
              }
            }}
          />
        )}
        </React.Suspense>
      </main>

      {/* Modal Navegador Rápido de Colegios (Spotlight / Ctrl+K) */}
      {(!permisos || permisos.puedeAccederTodasEscuelas) && (
        <SchoolNavigatorModal
          isOpen={modalNavegadorAbierto}
          onClose={() => setModalNavegadorAbierto(false)}
          colegios={colegiosPermitidos}
          colegioActivo={colegioActivo}
          onSelectColegio={(est) => {
            handleSelectColegio(est);
            if (vistaActiva === 'cartera') setVistaActiva('workflow');
          }}
          diagnosticos={diagnosticosTodosColegios}
          onCrearNuevoColegio={() => {
            setVistaActiva('cartera');
          }}
          onAbrirGestionEstablecimientos={evaluadorPermisos.esSuperUsuario ? () => setModalGestionEstablecimientosAbierto(true) : undefined}
        />
      )}

      {/* Modal Centro de Guardado y Respaldos */}
      {(!permisos || permisos.puedeConfigurarSistema) && (
        <SaveBackupModal
          isOpen={modalRespaldosAbierto}
          onClose={() => setModalRespaldosAbierto(false)}
          colegios={colegiosPermitidos}
          colegioActivo={colegioActivo}
          periodoActivo={periodoActivo}
          docentes={todosLosDocentes}
          cursos={todosLosCursos}
          salas={todasLasSalas}
          asignaciones={todasLasAsignaciones}
          onExportarSqlite={handleExportarSqlite}
          onImportarSqlite={handleImportarSqlite}
          onExportarCarteraSlep={handleExportarCarteraSlep}
          onImportarCarteraSlep={handleImportarCarteraSlep}
          onBorrarDotacionPeriodo={handleBorrarDotacionPeriodo}
          onReiniciarBaseDatos={handleReiniciarBaseDatos}
          onSincronizarNubeCartera={handleSincronizarCarteraCompletaDesdeNube}
        />
      )}

      {/* Panel Lateral Retráctil: ¡Qué no va a saber! IA */}
      <DotacionCopilotDrawer
        isOpen={modalCopilotAbierto}
        onClose={() => setModalCopilotAbierto(false)}
        establecimiento={colegioActivo}
        periodo={periodoActivo}
        salas={salas}
        cursos={cursos}
        docentes={docentes}
        asignaciones={asignaciones}
        todosLosDocentesTerritorio={todosLosDocentes}
        todosLosEstablecimientos={colegios}
      />

      {/* Modal Wizard de Traspaso y Proyección 2026 -> 2027 */}
      <ModalTraspasoDotacion
        isOpen={modalTraspasoAbierto}
        onClose={() => setModalTraspasoAbierto(false)}
        colegioActivo={colegioActivo}
        colegios={colegiosPermitidos}
        periodoOrigen={2026}
        periodoDestino={2027}
        onTraspasoCompletado={async (rbd, destino) => {
          await cargarDatos(destino);
          if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd, destino);
          mostrarMensaje(`✓ Traspaso completado exitosamente para el periodo ${destino}.`);
        }}
      />

      {/* Modal Cambiar Mi Contraseña */}
      {session && (
        <CambiarPasswordModal
          session={session}
          isOpen={modalCambiarPassword}
          onClose={() => setModalCambiarPassword(false)}
          onSuccess={(msg) => mostrarMensaje(msg, 'success')}
        />
      )}

      {/* Modal Comparador Periodos */}
      <ComparadorPeriodosModal
        isOpen={modalComparadorAbierto}
        onClose={() => setModalComparadorAbierto(false)}
        colegioActivo={colegioActivo}
        colegios={colegios}
        onPeriodoActualizado={async () => {
          await cargarDatos(periodoActivo);
          if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd, periodoActivo);
        }}
      />

      {/* Modal Exclusivo Super Usuario: Gestión de Establecimientos (Agregar y Eliminar) */}
      <GestionEstablecimientosModal
        isOpen={modalGestionEstablecimientosAbierto}
        onClose={() => setModalGestionEstablecimientosAbierto(false)}
        colegios={colegios}
        colegioActivo={colegioActivo}
        onSelectColegio={handleSelectColegio}
        onGuardarColegio={handleGuardarColegio}
        onEliminarColegio={handleEliminarColegio}
      />


      {/* Botón Flotante Solo en Pantallas Móviles (en Desktop/Notebooks vive en la barra superior) */}
      {(!permisos || permisos.puedeUsarCopilotIa) && (
        <aside aria-label="Asistente de Dotación Flotante" className="sm:hidden fixed bottom-4 right-4 z-40">
          <button
            onClick={() => setModalCopilotAbierto(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900/95 hover:bg-slate-900 text-white rounded-2xl shadow-xl border border-blue-500/40 transition-all backdrop-blur-md"
            title="Abrir asistente inteligente ¡Qué no va a saber! IA"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            </div>
            <span className="text-xs font-black tracking-tight text-white">IA</span>
          </button>
        </aside>
      )}
    </div>
    </PermisosProvider>
  );
};
