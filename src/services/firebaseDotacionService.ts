/**
 * FirebaseDotacionService - STUB
 * Toda la persistencia y sincronización en la nube se ejecuta exclusivamente en Supabase PostgreSQL
 * a través de SupabaseDotacionService.
 */
export function isCloudSyncEnabled(): boolean {
  return false;
}

export class FirebaseDotacionService {
  static async guardarEstablecimiento(): Promise<void> {}
  static async guardarEstablecimientosBatch(): Promise<void> {}
  static async obtenerEstablecimientos(): Promise<any[]> { return []; }
  static async eliminarEstablecimiento(): Promise<void> {}
  static async guardarSala(): Promise<void> {}
  static async eliminarSala(): Promise<void> {}
  static async guardarCurso(): Promise<void> {}
  static async guardarCursosBatch(): Promise<void> {}
  static async eliminarCurso(): Promise<void> {}
  static async guardarDocente(): Promise<void> {}
  static async guardarDocentesBatch(): Promise<void> {}
  static async eliminarDocente(): Promise<void> {}
  static async guardarAsignacion(): Promise<void> {}
  static async guardarAsignacionesBatch(): Promise<void> {}
  static async eliminarAsignacion(): Promise<void> {}
  static async guardarAsistente(): Promise<void> {}
  static async guardarAsistentesBatch(): Promise<void> {}
  static async eliminarAsistente(): Promise<void> {}
  static async obtenerDotacionColegio(): Promise<any> {
    return { establecimiento: null, cursos: [], docentes: [], asignaciones: [], asistentes: [] };
  }
  static async guardarDotacionBatch(): Promise<void> {}
}
