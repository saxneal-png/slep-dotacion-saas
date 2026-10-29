/**
 * Fachada unificada de Base de Datos SQLite (sql.js WASM).
 * Mantiene 100% de compatibilidad pública con todas las vistas, servicios y tests.
 */

export {
  getDb,
  persistDb,
  subscribePersist,
  getUltimaHoraGuardado,
  exportarBaseDatosSqlite,
  importarBaseDatosSqlite,
  borrarDotacionPeriodo,
  reiniciarTodaLaBaseDatos
} from './dbCore';
export type { PersistListener } from './dbCore';

export {
  listarEstablecimientos,
  guardarEstablecimiento,
  obtenerEstablecimientoPorRbd,
  eliminarEstablecimiento
} from './repositories/establecimientosRepo';

export {
  listarSalas,
  listarTodasLasSalas,
  guardarSala,
  eliminarSala
} from './repositories/salasRepo';

export {
  listarCursos,
  listarTodosLosCursos,
  guardarCurso,
  eliminarCurso
} from './repositories/cursosRepo';

export {
  listarDocentes,
  listarTodosLosDocentesTerritorio,
  guardarDocente,
  guardarDocentesBatch,
  eliminarDocente
} from './repositories/docentesRepo';

export {
  listarAsignaciones,
  listarTodasLasAsignaciones,
  guardarAsignacion,
  guardarAsignacionesBatch,
  eliminarAsignacion,
  limpiarAsignacionesDeColegio,
  reconciliarYLimpiarAsignacionesEnDb
} from './repositories/asignacionesRepo';

export {
  exportarDotacionEstablecimiento,
  exportarCarteraCompleta,
  importarCartera,
  proyectarPeriodoColegio,
  getComparativaPeriodos
} from './repositories/carteraRepo';

export {
  guardarMatrizExcelEnDb
} from './repositories/matrizExcelRepo';

export {
  ejecutarTraspasoDotacionAnalizador
} from './repositories/traspasoRepo';

export {
  listarPlanesEstudio,
  obtenerPlanEstudioPorId,
  obtenerPlanEstudioPorNivelYRegimen,
  guardarPlanEstudio,
  eliminarPlanEstudio,
  adjuntarPlanACursos,
  poblarPlanesEstudioEnDb,
  PLAN_EPJA_2024_OFICIAL_JSON
} from './repositories/planesEstudioRepo';
export type { PlanEstudioRegistroDb } from './repositories/planesEstudioRepo';

export {
  registrarEventoAuditoria,
  listarEventosAuditoria
} from './repositories/auditoriaRepo';
export type { EventoAuditoria } from './repositories/auditoriaRepo';

export {
  diagnosticarTraspasoColegio,
  ejecutarTraspasoPeriodoColegio
} from '../services/traspasoDotacionService';
export type {
  OpcionesTraspasoPeriodo,
  DiagnosticoPrevioTraspaso,
  ResultadoTraspasoPeriodo
} from '../services/traspasoDotacionService';

export {
  listarAsistentes,
  listarTodosLosAsistentesTerritorio,
  obtenerAsistentePorId,
  guardarAsistente,
  guardarAsistentesBatch,
  eliminarAsistente,
  eliminarAsistentesColegioPeriodo
} from './repositories/asistentesRepo';

export {
  listarUsuariosDb,
  guardarUsuarioDb,
  guardarUsuariosBatchDb,
  eliminarUsuarioDb
} from './repositories/usuariosRepo';



