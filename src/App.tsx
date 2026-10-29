import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { SchoolNavigatorModal } from './components/SchoolNavigatorModal';
import { SaveBackupModal } from './components/SaveBackupModal';
import { DotacionCopilotDrawer } from './components/DotacionCopilotDrawer';
import { ModalTraspasoDotacion } from './components/ModalTraspasoDotacion';
import { ComparadorPeriodosModal } from './components/ComparadorPeriodosModal';
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
import { FirebaseDotacionService } from './services/firebaseDotacionService';
import { calcularDiagnosticoColegio, consolidarCarteraTerritorial, DiagnosticoColegioCompleto } from './services/dotacionCalculationService';
import { generarExcelConsolidadoSlep } from './services/excelReportService';
import { generarExcelMatrizDotacionColegio } from './services/excelMatrizDotacionService';
import { cargarConfiguracionGeneral } from './services/configuracionGeneralService';
import { AuthService } from './services/authService';
import { AuthSession, UsuarioSistema } from './types/authTypes';
import { useEvaluadorPermisos, PermisosProvider } from './security/PermisosContext';
import { getDefinicionRol, normalizarRol } from './security/rolesDefinitions';
import { colegiosVisibles, puedeAccederRbd } from './services/scopeService';
import { LoginModal } from './components/auth/LoginModal';
import { CambiarPasswordModal } from './components/auth/CambiarPasswordModal';
import { OlvidoPasswordModal } from './components/auth/OlvidoPasswordModal';

export const App: React.FC = () => {
  const [session, setSession] = useState<AuthSession | null>(() => AuthService.getSessionActual());
  const [loading, setLoading] = useState(true);

  const evaluadorPermisos = useEvaluadorPermisos(session);
  const permisos = evaluadorPermisos.legado;
  const alcanceReal = session ? getDefinicionRol(normalizarRol(session.usuario.role)).alcance : null;
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioSistema[]>([]);
  useEffect(() => {
    if (session) AuthService.getUsuarios().then(setUsuariosSistema).catch(() => setUsuariosSistema([]));
  }, [session?.usuario.id]);
  const [modalCambiarPassword, setModalCambiarPassword] = useState(false);
  const [modalOlvidoPassword, setModalOlvidoPassword] = useState(false);
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

  const handleGuardarCambiosEnNube = async () => {
    if (!colegioActivo) {
      mostrarMensaje('Selecciona un establecimiento para guardar sus cambios en la nube.', 'error');
      return;
    }
    setGuardandoEnNube(true);
    mostrarMensaje(`☁️ Guardando dotación de ${colegioActivo.nombre} en Supabase...`);
    try {
      const res = await SupabaseDotacionService.sincronizarColegioASupabase(
        colegioActivo.rbd,
        periodoActivo
      );
      mostrarMensaje(
        `✓ Cambios guardados para ${colegioActivo.nombre} (${periodoActivo}): ${res.docentesSincronizados} docentes, ${res.cursosSincronizados} cursos, ${res.asignacionesSincronizadas} asignaciones y ${res.asistentesSincronizados} asistentes sincronizados en Supabase.`,
        'success'
      );
    } catch (err: any) {
      console.error('Error sincronizando escuela con Supabase:', err);
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
  const [periodoActivo, setPeriodoActivoState] = useState<number>(() => {
    try {
      const g = typeof window !== 'undefined' ? localStorage.getItem('slep_dotacion_periodo_activo') : null;
      if (g) {
        const val = parseInt(g, 10);
        if (!isNaN(val) && (val === 2026 || val === 2027)) return val;
      }
    } catch {}
    return 2026;
  });

  const setPeriodoActivo = (p: number) => {
    setPeriodoActivoState(p);
    try {
      localStorage.setItem('slep_dotacion_periodo_activo', String(p));
    } catch {}
  };
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState<'balanza' | 'docentes' | 'asistentes' | 'cursos' | 'pie' | 'salas'>('balanza');

  const mostrarMensaje = (mensaje: string, tipo: 'success' | 'error' = 'success') => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => setNotificacion(null), 4000);
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

  // 1. Cargar Base de Datos y Colecciones Globales
  const cargarDatos = async (p: number = 2027) => {
    try {
      await getDb();
      await checkAndSeedInitialData();

      const listEst = await listarEstablecimientos();
      setColegios(listEst);

      const allSalas = await listarTodasLasSalas();
      setTodasLasSalas(allSalas);

      const allCursos = await listarTodosLosCursos(p);
      setTodosLosCursos(allCursos);

      const allDocs = await listarTodosLosDocentesTerritorio(p);
      setTodosLosDocentes(allDocs);

      const allAsigs = await listarTodasLasAsignaciones(p);
      setTodasLasAsignaciones(allAsigs);

      const allAsist = await listarTodosLosAsistentesTerritorio(p);
      setTodosLosAsistentes(allAsist);

      if (listEst.length > 0) {
        const defaultEst = colegioActivo || listEst[0];
        setColegioActivo(defaultEst);
        await cargarDatosColegio(defaultEst.rbd, p);
      }
    } catch (err: any) {
      console.error('Error al inicializar datos:', err);
      mostrarMensaje(`Error al inicializar datos: ${err.message || err}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarDatosColegio = async (rbd: string, p: number = periodoActivo) => {
    const s = await listarSalas(rbd);
    const c = await listarCursos(rbd, p);
    const d = await listarDocentes(rbd, p);
    const a = await listarAsignaciones(rbd, p);
    const ast = await listarAsistentes(rbd, p);
    setSalas(s);
    setCursos(c);
    setDocentes(d);
    setAsignaciones(a);
    setAsistentes(ast);
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
    if (list.length > 0) {
      handleSelectColegio(list[0]);
    } else {
      setColegioActivo(null);
    }
    mostrarMensaje('Establecimiento eliminado de la cartera.');
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
      await guardarDocentesBatch(docentesImportados);
      await persistDb(true);
      await cargarDatos();
      const listEst = await listarEstablecimientos();
      const estActivo = listEst.find(c => c.rbd === est.rbd) || est;
      setColegioActivo(estActivo);
      await cargarDatosColegio(estActivo.rbd);

      mostrarMensaje(`✓ Ingesta exitosa: ${est.nombre} con ${docentesImportados.length} funcionarios ingresados a la base.`);
      setVistaActiva('workflow');
    } catch (e: any) {
      mostrarMensaje(`Error en la ingesta SIGE: ${e.message || e}`, 'error');
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
      await checkAndSeedInitialData();
      await cargarDatos(2026);
      const list = await listarEstablecimientos();
      if (list.length > 0) {
        setColegioActivo(list[0]);
        await cargarDatosColegio(list[0].rbd, 2026);
      }
      mostrarMensaje('Base de datos reiniciada a valores iniciales.');
    } catch (e: any) {
      mostrarMensaje(`Error al reiniciar base de datos: ${e.message || e}`, 'error');
    }
  };

  // Diagnóstico del colegio activo
  const diagnosticoColegioActivo = useMemo(() => {
    if (!colegioActivo) return null;
    return calcularDiagnosticoColegio(colegioActivo, salas, cursos, docentes, asignaciones);
  }, [colegioActivo, salas, cursos, docentes, asignaciones]);

  // Diagnósticos de TODOS los colegios con datos 100% reales globales
  const diagnosticosTodosColegios = useMemo<DiagnosticoColegioCompleto[]>(() => {
    return colegios.map(est => {
      const cList = todosLosCursos.filter(c => c.rbd === est.rbd);
      const dList = todosLosDocentes.filter(d => d.rbd === est.rbd);
      const sList = todasLasSalas.filter(s => s.rbd === est.rbd);
      const aList = todasLasAsignaciones.filter(a => a.rbd === est.rbd);
      return calcularDiagnosticoColegio(est, sList, cList, dList, aList);
    });
  }, [colegios, todosLosCursos, todosLosDocentes, todasLasSalas, todasLasAsignaciones]);

  // Inconsistencias globales del territorio
  const consolidacionMaster = useMemo(() => {
    return consolidarCarteraTerritorial(colegios, todosLosDocentes, diagnosticosTodosColegios);
  }, [colegios, todosLosDocentes, diagnosticosTodosColegios]);

  // Exportar Excel Oficial
  const handleExportarExcel = async () => {
    try {
      const bytes = await generarExcelConsolidadoSlep(
        colegios,
        todosLosDocentes,
        diagnosticosTodosColegios,
        colegioActivo?.asesorUatp || 'Asesor UATP',
        todasLasAsignaciones
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
    AuthService.logout();
    setSession(null);
    setVistaActiva('colegios_asesorados');
    mostrarMensaje('Sesión cerrada correctamente.');
  };

  // Filtrado de colegios según el alcance del rol (global / equipo / cartera / establecimiento)
  const colegiosPermitidos = useMemo(() => {
    if (!session) return colegios;
    return colegiosVisibles(session.usuario, colegios, usuariosSistema);
  }, [colegios, session, usuariosSistema]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold tracking-wide text-slate-300">
          Cargando Motor Core MINEDUC & Base de Datos Offline...
        </p>
      </div>
    );
  }

  return (
    <PermisosProvider value={evaluadorPermisos}>
      <div className="min-h-screen bg-[#F4F7F9] flex flex-col">
      {!session && (
        <>
          <LoginModal
            onLoginSuccess={(newSession) => {
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
        onGuardarCambiosEnNube={handleGuardarCambiosEnNube}
        guardandoEnNube={guardandoEnNube}
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
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <React.Suspense
          fallback={
            <div className="flex flex-col items-center justify-center min-h-[400px] py-16 space-y-4 animate-in fade-in">
              <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-500">Cargando módulo...</p>
            </div>
          }
        >
        {vistaActiva === 'colegios_asesorados' && (
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

        {vistaActiva === 'cartera' && (
          <CarteraView
            colegios={colegiosPermitidos}
            colegioActivo={colegioActivo}
            onSelectColegio={handleSelectColegio}
            onGuardarColegio={handleGuardarColegio}
            onEliminarColegio={handleEliminarColegio}
            onExportarCarteraSlep={handleExportarCarteraSlep}
            onImportarCarteraSlep={handleImportarCarteraSlep}
            onAbrirModuloSige={() => setVistaActiva('sige')}
            onAbrirWorkflow={(est) => {
              handleSelectColegio(est);
              setVistaActiva('workflow');
            }}
            onExportarSqlite={handleExportarSqlite}
            onImportarSqlite={handleImportarSqlite}
            periodoActivo={periodoActivo}
            onLimpiarDotacionColegio={handleBorrarDotacionPeriodo}
            onExportarDotacionColegio={handleExportarDotacionColegio}
            onExportarMatrizExcelColegio={handleExportarMatrizExcelColegio}
            onAbrirColegiosAsesorados={() => setVistaActiva('colegios_asesorados')}
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
              todosLosColegios={colegios}
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
              onNavegarAPestana={setVistaActiva}
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
            onIngestarSigeCompleto={handleIngestarSigeCompleto}
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
            todosLosColegios={colegios}
            todosLosDocentes={todosLosDocentes}
            todasLasAsignaciones={todasLasAsignaciones}
            onNavegarAPestana={setVistaActiva}
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
            docentes={todosLosDocentes}
            asistentes={todosLosAsistentes}
            cursos={todosLosCursos}
            diagnosticos={diagnosticosTodosColegios}
            asignaciones={todasLasAsignaciones}
            onImportarCarteraSlep={handleImportarCarteraSlep}
            onExportarExcel={handleExportarExcel}
            onRecargarDatos={() => cargarDatos(periodoActivo)}
          />
        )}

        {vistaActiva === 'estadisticas' && (
          <EstadisticasView
            colegios={colegiosPermitidos}
            colegioActivo={colegioActivo}
            onSelectColegio={handleSelectColegio}
            todosLosCursos={todosLosCursos}
            todosLosDocentes={todosLosDocentes}
            todasLasAsignaciones={todasLasAsignaciones}
            periodoActivo={periodoActivo}
            onNavegarColegio={(est) => {
              handleSelectColegio(est);
              setVistaActiva('workflow');
            }}
            onExportarExcelGlobal={handleExportarExcel}
          />
        )}

        {vistaActiva === 'analizador' && (
          <AnalizadorDotacionView
            periodoActivo={periodoActivo}
            onSyncWithDatabase={async () => {
              await cargarDatos(periodoActivo);
            }}
            onNavigateToColegio={async (rbd: string, tabDestino: string = 'workflow', pDestino: number = 2026) => {
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
        />
      )}

      {/* Modal Centro de Guardado y Respaldos */}
      {(!permisos || permisos.puedeConfigurarSistema) && (
        <SaveBackupModal
          isOpen={modalRespaldosAbierto}
          onClose={() => setModalRespaldosAbierto(false)}
          colegios={colegios}
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

      {/* Botón Flotante Permanente Estilo Steve Jobs: ¡Qué no va a saber! IA */}
      <aside aria-label="Asistente de Dotación Flotante" className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setModalCopilotAbierto(true)}
          className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-900/95 hover:bg-slate-900 text-white rounded-2xl shadow-2xl border border-blue-500/40 hover:border-blue-400 hover:scale-105 active:scale-95 transition-all group backdrop-blur-md"
          title="Abrir asistente inteligente ¡Qué no va a saber! IA (Ctrl+J / ⌘J)"
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform" />
          </div>
          <span className="text-xs font-black tracking-tight text-white">
            ¡Qué no va a saber! IA
          </span>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-blue-200 font-mono border border-white/10">
            ⌘J
          </span>
        </button>
      </aside>
    </div>
    </PermisosProvider>
  );
};
