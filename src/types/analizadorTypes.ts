export interface TeacherCourseAssignment {
  curso: string;
  nivel?: string;
  letra?: string;
  asignatura: string;
  horas: number;
  tipo?: 'AULA' | 'TALLER' | 'PIE' | 'OTRO';
}

export interface TeacherRecord {
  id: string;
  file_name: string;
  rbd: string;
  establishment: string;
  comuna?: string;
  rut: string;
  teacher_name: string;
  activity: string;
  curso?: string;
  cursos_asignados?: string[];
  desglose_cursos?: TeacherCourseAssignment[];
  hours: number;
  category: 'AULA' | 'TECNICA' | 'DIRECTIVA';
  source: string;
  total_declared?: number;
  total_teacher_hours?: number;
  horas_aula?: number;
  horas_tecnicas?: number;
  horas_directivas?: number;
  horas_no_lectivas?: number;
  diferencia_carga?: number;
  estado_carga?: 'CUADRADA' | 'SUBASIGNADA' | 'SOBREASIGNADA' | 'EXCESO_LEGAL';
  is_over_legal_limit?: boolean;
  legal_limit_warning?: string;
}

export interface SchoolSummary {
  rbd: string;
  establishment: string;
  comuna?: string;
  matricula: number;
  horas_aula: number;
  horas_directivas: number;
  horas_tecnicas: number;
  total_horas_ee: number;
  teachers_count: number;
  courses_count?: number;
  over_44_count?: number;
  has_discrepancy: boolean;
  discrepancy_note?: string;
  source_file: string;
}

export interface CourseTeacherItem {
  rut: string;
  teacher_name: string;
  asignatura: string;
  horas: number;
  categoria: 'AULA' | 'TECNICA' | 'DIRECTIVA';
}

export interface CourseLoadSummary {
  curso: string;
  nivel: string;
  letra: string;
  rbd: string;
  establishment: string;
  comuna?: string;
  total_horas: number;
  docentes: CourseTeacherItem[];
}

export interface TeacherConsolidatedLoad {
  rut: string;
  teacher_name: string;
  rbd: string;
  establishment: string;
  comuna?: string;
  horas_contrato: number;
  total_asignado: number;
  diferencia: number;
  estado_carga: 'CUADRADA' | 'SUBASIGNADA' | 'SOBREASIGNADA' | 'EXCESO_LEGAL';
  cursos: TeacherCourseAssignment[];
  horas_aula: number;
  horas_tecnicas: number;
  horas_directivas: number;
  is_over_legal_limit: boolean;
}

export interface KpiStats {
  total_schools: number;
  total_teachers: number;
  total_matricula: number;
  total_courses?: number;
  total_comunas?: number;
  total_horas_general: number;
  total_horas_aula: number;
  total_horas_directivas: number;
  total_horas_tecnicas: number;
  pct_aula: number;
  pct_directivas: number;
  pct_tecnicas: number;
  discrepancies_count: number;
  teachers_over_44_count?: number;
  teachers_subasignados_count?: number;
  teachers_sobreasignados_count?: number;
}

export interface GeminiModel {
  id: string;
  display_name: string;
  description: string;
  badge?: string;
  is_recommended?: boolean;
  input_token_limit?: number;
  output_token_limit?: number;
}

export interface ModelsResponse {
  models: GeminiModel[];
  selected_model: string;
}

export interface ConsolidatedResponse {
  schools: SchoolSummary[];
  teachers: TeacherRecord[];
  courses: CourseLoadSummary[];
  teacherLoads: TeacherConsolidatedLoad[];
  kpis: KpiStats;
  processed_files: string[];
}

export type TipoHoraInstitucional =
  | 'DIRECTIVA'
  | 'TECNICO_PEDAGOGICA'
  | 'COORDINACION_PIE'
  | 'CONVIVENCIA'
  | 'EXTRAESCOLAR'
  | 'CO_DOCENCIA'
  | 'AGRUPACION_FLEXIBLE'
  | 'AULA_REGULAR';

export interface HomologacionItem {
  key: string; // `${rawSubject}__${nivel}`
  rawSubject: string;
  nivel: string;
  asignaturaOficial: string;
  horasTotales: number;
  docentesCount: number;
  fuente: 'IA_GEMINI' | 'REGLA_MINEDUC' | 'MANUAL';
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
  justificacion?: string;
  tipoHoraInstitucional?: TipoHoraInstitucional;
  esDirectivo?: boolean;
  esTecnicoPedagogico?: boolean;
  esCoordinacionPie?: boolean;
  esConvivencia?: boolean;
  esExtraescolar?: boolean;
  esCoDocencia?: boolean;
  esAgrupacionFlexible?: boolean;
  esTallerJec?: boolean;
  esTallerSep?: boolean;
  esPie?: boolean;
  esProporcionDocente?: boolean;
}

export interface TraspasoConfig {
  periodo: number; // 2026
  modo: 'REEMPLAZAR' | 'FUSIONAR';
  homologaciones: Record<string, string>; // clave: `${rawSubject}__${nivel}` -> valor: asignaturaOficial
  colegiosRbd: string[];
  targetRbdOverride?: string; // Si el usuario selecciona manualmente la escuela/liceo destino
  cursosJecMap?: Record<string, 'JEC' | 'No JEC'>; // clave: cursoKey -> 'JEC' | 'No JEC'
  cursosProporcionMap?: Record<string, '65_35' | '60_40'>; // clave: cursoKey -> '65_35' | '60_40'
}

export interface TraspasoResult {
  colegiosProcesados: number;
  cursosCreados: number;
  docentesGuardados: number;
  asignacionesGuardadas: number;
  alertas: string[];
}

