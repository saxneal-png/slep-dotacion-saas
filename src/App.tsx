import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { SchoolNavigatorModal } from './components/SchoolNavigatorModal';
import { SaveBackupModal } from './components/SaveBackupModal';

const CarteraView = React.lazy(() => import('./views/CarteraView').then(m => ({ default: m.CarteraView })));
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

import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria
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
  exportarCarteraCompleta,
  exportarDotacionEstablecimiento,
  importarCartera,
  exportarBaseDatosSqlite,
  importarBaseDatosSqlite,
  listarTodosLosDocentesTerritorio,
  listarTodasLasAsignaciones,
  subscribePersist,
  getUltimaHoraGuardado,
  borrarDotacionPeriodo,
  reiniciarTodaLaBaseDatos
} from './database/db';

import { checkAndSeedInitialData } from './database/seedData';
import { calcularDiagnosticoColegio, consolidarCarteraTerritorial, DiagnosticoColegioCompleto } from './services/dotacionCalculationService';
import { generarExcelConsolidadoSlep } from './services/excelReportService';
import { generarExcelMatrizDotacionColegio } from './services/excelMatrizDotacionService';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [colegios, setColegios] = useState<Establecimiento[]>([]);
  const [colegioActivo, setColegioActivo] = useState<Establecimiento | null>(null);

  // Datos del colegio actualmente activo
  const [salas, setSalas] = useState<SalaInfraestructura[]>([]);
  const [cursos, setCursos] = useState<CursoSae[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionHoraria[]>([]);

  // Datos globales territoriales (100% de los colegios)
  const [todasLasSalas, setTodasLasSalas] = useState<SalaInfraestructura[]>([]);
  const [todosLosCursos, setTodosLosCursos] = useState<CursoSae[]>([]);
  const [todosLosDocentes, setTodosLosDocentes] = useState<Docente[]>([]);
  const [todasLasAsignaciones, setTodasLasAsignaciones] = useState<AsignacionHoraria[]>([]);

  const [vistaActiva, setVistaActiva] = useState<string>('cartera');
  const [notificacion, setNotificacion] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  // Modales Steve Jobs: Navegador Rápido y Centro de Respaldos
  const [modalNavegadorAbierto, setModalNavegadorAbierto] = useState(false);
  const [modalRespaldosAbierto, setModalRespaldosAbierto] = useState(false);
  const [estadoGuardado, setEstadoGuardado] = useState<'saved' | 'error'>('saved');
  const [errorGuardado, setErrorGuardado] = useState<string | undefined>(undefined);
  const [ultimaHoraGuardado, setUltimaHoraGuardado] = useState<string>(getUltimaHoraGuardado());
  const [periodoActivo, setPeriodoActivo] = useState<number>(2026);

  const mostrarMensaje = (mensaje: string, tipo: 'success' | 'error' = 'success') => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => setNotificacion(null), 4000);
  };

  // Suscripción al monitor de persistencia SQLite
  useEffect(() => {
    const unsub = subscribePersist((status, time, err) => {
      setEstadoGuardado(status);
      setUltimaHoraGuardado(time);
      if (err) setErrorGuardado(err);
    });
    return unsub;
  }, []);

  // Atajo de teclado global Ctrl+K / Cmd+K para abrir el Navegador Rápido
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setModalNavegadorAbierto(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. Cargar Base de Datos y Colecciones Globales
  const cargarDatos = async (p: number = periodoActivo) => {
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
    setSalas(s);
    setCursos(c);
    setDocentes(d);
    setAsignaciones(a);
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

  // Handlers CRUD
  const handleGuardarColegio = async (est: Establecimiento) => {
    await guardarEstablecimiento(est);
    const list = await listarEstablecimientos();
    setColegios(list);
    if (!colegioActivo || colegioActivo.id === est.id) {
      setColegioActivo(est);
      await cargarDatosColegio(est.rbd);
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
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd);
    const allSalas = await listarTodasLasSalas();
    setTodasLasSalas(allSalas);
    mostrarMensaje('Sala eliminada.');
  };

  const handleGuardarCurso = async (c: CursoSae) => {
    await guardarCurso(c);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd);
    const allCursos = await listarTodosLosCursos();
    setTodosLosCursos(allCursos);
    mostrarMensaje(`Curso ${c.nivel} ${c.letra} actualizado.`);
  };

  const handleEliminarCurso = async (id: string) => {
    await eliminarCurso(id);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd);
    const allCursos = await listarTodosLosCursos();
    setTodosLosCursos(allCursos);
    mostrarMensaje('Curso eliminado.');
  };

  const handleGuardarDocente = async (d: Docente) => {
    await guardarDocente(d);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd);
    const all = await listarTodosLosDocentesTerritorio();
    setTodosLosDocentes(all);
    mostrarMensaje(`Docente ${d.nombres} ${d.apellidos} guardado.`);
  };

  const handleEliminarDocente = async (id: string) => {
    await eliminarDocente(id);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd);
    const all = await listarTodosLosDocentesTerritorio();
    setTodosLosDocentes(all);
    mostrarMensaje('Docente eliminado de la dotación.');
  };

  const handleGuardarAsignacion = async (asig: AsignacionHoraria) => {
    await guardarAsignacion(asig);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd);
    const all = await listarTodasLasAsignaciones();
    setTodasLasAsignaciones(all);
    mostrarMensaje('Asignación horaria actualizada.');
  };

  const handleEliminarAsignacion = async (id: string) => {
    await eliminarAsignacion(id);
    if (colegioActivo) await cargarDatosColegio(colegioActivo.rbd);
    const all = await listarTodasLasAsignaciones();
    setTodasLasAsignaciones(all);
    mostrarMensaje('Asignación eliminada.');
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

  // Borrado Masivo de Dotación por Periodo / Colegio
  const handleBorrarDotacionPeriodo = async (periodo: number, rbd?: string) => {
    try {
      const res = await borrarDotacionPeriodo(periodo, rbd);
      await cargarDatos(periodo);
      if (colegioActivo) {
        await cargarDatosColegio(colegioActivo.rbd, periodo);
      }
      mostrarMensaje(`Se eliminaron ${res.cursosBorrados} cursos, ${res.docentesBorrados} docentes y ${res.asignacionesBorradas} asignaciones del periodo ${periodo}.`);
    } catch (e: any) {
      mostrarMensaje(`Error al borrar dotación: ${e.message || e}`, 'error');
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
    <div className="min-h-screen bg-[#F4F7F9] flex flex-col">
      <Header
        colegioActivo={colegioActivo}
        colegios={colegios}
        onSelectColegio={handleSelectColegio}
        vistaActiva={vistaActiva}
        onSelectVista={setVistaActiva}
        onExportarExcel={handleExportarExcel}
        inconsistenciasCount={consolidacionMaster.inconsistencias.length}
        onAbrirNavegadorColegios={() => setModalNavegadorAbierto(true)}
        onAbrirCentroRespaldos={() => setModalRespaldosAbierto(true)}
        estadoGuardado={estadoGuardado}
        ultimaHoraGuardado={ultimaHoraGuardado}
        periodoActivo={periodoActivo}
        onTogglePeriodo={handleTogglePeriodo}
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <React.Suspense
          fallback={
            <div className="flex flex-col items-center justify-center min-h-[400px] py-16 space-y-4 animate-in fade-in">
              <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-500">Cargando módulo...</p>
            </div>
          }
        >
        {vistaActiva === 'cartera' && (
          <CarteraView
            colegios={colegios}
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
              diagnostico={diagnosticoColegioActivo}
              onGuardarSala={handleGuardarSala}
              onEliminarSala={handleEliminarSala}
              onGuardarCurso={handleGuardarCurso}
              onEliminarCurso={handleEliminarCurso}
              onGuardarDocente={handleGuardarDocente}
              onEliminarDocente={handleEliminarDocente}
              onGuardarAsignacion={handleGuardarAsignacion}
              onEliminarAsignacion={handleEliminarAsignacion}
              onAbrirModuloSige={() => setVistaActiva('sige')}
              onExportarExcel={handleExportarExcel}
              onAbrirNavegadorColegios={() => setModalNavegadorAbierto(true)}
              todosLosColegios={colegios}
              todosLosDocentes={todosLosDocentes}
              todasLasAsignaciones={todasLasAsignaciones}
              periodoActivo={periodoActivo}
              onTogglePeriodo={handleTogglePeriodo}
              onRefreshData={() => cargarDatos(periodoActivo)}
              onLimpiarDotacionColegio={handleBorrarDotacionPeriodo}
              onExportarDotacionColegio={handleExportarDotacionColegio}
              onExportarMatrizExcelColegio={handleExportarMatrizExcelColegio}
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
            establecimientos={colegios}
            docentes={todosLosDocentes}
            diagnosticos={diagnosticosTodosColegios}
            asignaciones={todasLasAsignaciones}
            onImportarCarteraSlep={handleImportarCarteraSlep}
            onExportarExcel={handleExportarExcel}
          />
        )}

        {vistaActiva === 'estadisticas' && (
          <EstadisticasView
            colegios={colegios}
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
            onSyncWithDatabase={async () => {
              await cargarDatos(periodoActivo);
            }}
            onNavigateToColegio={async (rbd: string) => {
              await cargarDatos(2026);
              const list = await listarEstablecimientos();
              const est = list.find((c) => c.rbd === rbd) || colegios.find((c) => c.rbd === rbd);
              if (est) {
                await handleSelectColegio(est);
                setPeriodoActivo(2026);
                setVistaActiva('workflow');
                mostrarMensaje(`Navegando a ${est.nombre} en Dotación 2026`);
              }
            }}
          />
        )}
        </React.Suspense>
      </main>

      {/* Modal Navegador Rápido de Colegios (Spotlight / Ctrl+K) */}
      <SchoolNavigatorModal
        isOpen={modalNavegadorAbierto}
        onClose={() => setModalNavegadorAbierto(false)}
        colegios={colegios}
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

      {/* Modal Centro de Guardado y Respaldos */}
      <SaveBackupModal
        isOpen={modalRespaldosAbierto}
        onClose={() => setModalRespaldosAbierto(false)}
        ultimaHoraGuardado={ultimaHoraGuardado}
        estadoGuardado={estadoGuardado}
        errorGuardado={errorGuardado}
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
    </div>
  );
};
