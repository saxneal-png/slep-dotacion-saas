import { Establecimiento, CursoSae, Docente, AsignacionHoraria } from '../../types';

export interface CurriculumDemandaViewProps {
  colegio: Establecimiento | null;
  cursos: CursoSae[];
  docentes?: Docente[];
  asignaciones?: AsignacionHoraria[];
  onGuardarCurso: (curso: CursoSae) => void;
  onEliminarCurso: (id: string) => void;
  onGuardarAsignacion?: (a: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion?: (id: string) => Promise<void> | void;
  periodoActivo?: number;
}

export const NIVELES_REGULARES = [
  'Pre-Kínder', 'Kínder',
  '1° Básico', '2° Básico', '3° Básico', '4° Básico',
  '5° Básico', '6° Básico', '7° Básico', '8° Básico',
  '1° Medio', '2° Medio',
  '3° Medio (Humanístico-Científico)', '4° Medio (Humanístico-Científico)',
  '3° Medio (Técnico-Profesional)', '4° Medio (Técnico-Profesional)',
  '3° Medio - Especialidad Electricidad (Formación Diferenciada TP)',
  '4° Medio - Especialidad Electricidad (Formación Diferenciada TP)',
  '3° Medio - Especialidad Programación (Formación Diferenciada TP)',
  '4° Medio - Especialidad Programación (Formación Diferenciada TP)',
  '3° Medio - Especialidad Gastronomía (Plan Común de la Especialidad)',
  '4° Medio - Especialidad Gastronomía, Mención Cocina',
  '4° Medio - Especialidad Gastronomía, Mención Pastelería y Repostería',
  '3° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP)',
  '4° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP)',
  '3° Medio - Especialidad Administración (Plan Común de la Especialidad)',
  '4° Medio - Especialidad Administración, Mención Recursos Humanos',
  '3° Medio - Especialidad Construcción (Plan Común de la Especialidad)',
  '4° Medio - Especialidad Construcción, Mención Edificación',
  '4° Medio - Especialidad Construcción, Mención Terminaciones de la Construcción',
  '4° Medio - Especialidad Construcción, Mención Obras Viales e Infraestructura',
  '3° Medio - Especialidad Mecánica Industrial (Plan Común de la Especialidad)',
  '4° Medio - Especialidad Mecánica Industrial, Mención Mantenimiento Electromecánico',
  '4° Medio - Especialidad Mecánica Industrial, Mención Máquinas-Herramientas',
  '4° Medio - Especialidad Mecánica Industrial, Mención Matricería',
  '3° Medio - Especialidad Agropecuaria (Plan Común de la Especialidad)',
  '4° Medio - Especialidad Agropecuaria, Mención Agricultura',
  '4° Medio - Especialidad Agropecuaria, Mención Pecuaria',
  '4° Medio - Especialidad Agropecuaria, Mención Vitivinícola',
  '3° Medio - Especialidad Elaboración Industrial de Alimentos (Formación Diferenciada TP)',
  '4° Medio - Especialidad Elaboración Industrial de Alimentos (Formación Diferenciada TP)'
];

export const NIVELES_TP_ESPECIALIDADES = [
  '3° y 4° Medio Técnico-Profesional (Plan Común de Formación General)',
  '3° Medio - Especialidad Electricidad (Formación Diferenciada TP)',
  '4° Medio - Especialidad Electricidad (Formación Diferenciada TP)',
  '3° Medio - Especialidad Programación (Formación Diferenciada TP)',
  '4° Medio - Especialidad Programación (Formación Diferenciada TP)',
  '3° Medio - Especialidad Gastronomía (Plan Común de la Especialidad)',
  '4° Medio - Especialidad Gastronomía, Mención Cocina',
  '4° Medio - Especialidad Gastronomía, Mención Pastelería y Repostería',
  '3° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP)',
  '4° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP)',
  '3° Medio - Especialidad Administración (Plan Común de la Especialidad)',
  '4° Medio - Especialidad Administración, Mención Recursos Humanos',
  '3° Medio - Especialidad Construcción (Plan Común de la Especialidad)',
  '4° Medio - Especialidad Construcción, Mención Edificación',
  '4° Medio - Especialidad Construcción, Mención Terminaciones de la Construcción',
  '4° Medio - Especialidad Construcción, Mención Obras Viales e Infraestructura',
  '3° Medio - Especialidad Mecánica Industrial (Plan Común de la Especialidad)',
  '4° Medio - Especialidad Mecánica Industrial, Mención Mantenimiento Electromecánico',
  '4° Medio - Especialidad Mecánica Industrial, Mención Máquinas-Herramientas',
  '4° Medio - Especialidad Mecánica Industrial, Mención Matricería',
  '3° Medio - Especialidad Agropecuaria (Plan Común de la Especialidad)',
  '4° Medio - Especialidad Agropecuaria, Mención Agricultura',
  '4° Medio - Especialidad Agropecuaria, Mención Pecuaria',
  '4° Medio - Especialidad Agropecuaria, Mención Vitivinícola',
  '3° Medio - Especialidad Elaboración Industrial de Alimentos (Formación Diferenciada TP)',
  '4° Medio - Especialidad Elaboración Industrial de Alimentos (Formación Diferenciada TP)'
];

export const NIVELES_MULTIGRADO_PRESETS = [
  'Multigrado NT1-NT2',
  'Multigrado 1°-2° Básico',
  'Multigrado 3°-4° Básico',
  'Multigrado 5°-6° Básico',
  'Multigrado 7°-8° Básico',
  'Multigrado 1° a 6° Básico',
  'Multigrado 1° a 8° Básico'
];

export const NIVELES_EPJA_OFICIALES = [
  { id: 'Educación Básica - Nivel 1 (1° a 4° Básico)', label: 'Educación Básica - Nivel 1 (1° a 4° Básico - 10 HA)', horasDefecto: 10, ciclo: 'Básica Adultos' },
  { id: 'Educación Básica - Nivel 2 (5° y 6° Básico)', label: 'Educación Básica - Nivel 2 (5° y 6° Básico - 16 HA / 24 HA)', horasDefecto: 16, ciclo: 'Básica Adultos' },
  { id: 'Educación Básica - Nivel 3 (7° y 8° Básico)', label: 'Educación Básica - Nivel 3 (7° y 8° Básico - 16 HA / 24 HA)', horasDefecto: 16, ciclo: 'Básica Adultos' },
  { id: 'Educación Media HC - Nivel 1 (1° y 2° Medio)', label: 'Educación Media HC - Nivel 1 (1° y 2° Medio - 26 HA)', horasDefecto: 26, ciclo: 'Media HC Adultos' },
  { id: 'Educación Media HC - Nivel 2 (3° y 4° Medio)', label: 'Educación Media HC - Nivel 2 (3° y 4° Medio - 26 HA)', horasDefecto: 26, ciclo: 'Media HC Adultos' },
  { id: 'Educación Media TP en Oficios - Niveles 1 y 2 (1° a 4° Medio TP)', label: 'Educación Media TP en Oficios - Niveles 1 y 2 (26 HA)', horasDefecto: 26, ciclo: 'Media TP Oficios Adultos' },
  { id: 'Educación Media TP en Especialidades - Nivel 1 (1° y 2° Medio TP)', label: 'Educación Media TP Especialidades - Nivel 1 (1° y 2° Medio - 24 HA)', horasDefecto: 24, ciclo: 'Media TP Especialidades Adultos' },
  { id: 'Educación Media TP en Especialidades - Niveles 2 y 3 (3° y 4° Medio TP)', label: 'Educación Media TP Especialidades - Niveles 2 y 3 (3° y 4° Medio - 24 HA)', horasDefecto: 24, ciclo: 'Media TP Especialidades Adultos' }
];

export const NIVELES_ESPECIAL_OFICIALES = [
  { id: 'Educación Parvularia Especial (Decreto 83 / Decretos Supremos)', label: 'Parvularia Especial (Atención Temprana / NT1 / NT2 - 28 HA JEC / 22 HA)', ciclo: 'Parvularia Especial' },
  { id: 'Educación Básica Especial (1° a 8° Básico con Adecuaciones Curriculares - Dec. 83)', label: 'Básica Especial (1° a 8° Básico con Dec. 83 - 38 HA JEC / 30 HA)', ciclo: 'Básica Especial' },
];

export const NIVELES_LABORAL_OFICIALES = [
  { id: 'Nivel Laboral 1 (Decreto N° 87/1990 y Normativa Especial)', label: 'Nivel Laboral 1 (Decreto 87 - 38 HA JEC / 30 HA)', ciclo: 'Laboral 1' },
  { id: 'Nivel Laboral 2 (Decreto N° 87/1990 y Normativa Especial)', label: 'Nivel Laboral 2 (Decreto 87 - 38 HA JEC / 30 HA)', ciclo: 'Laboral 2' },
  { id: 'Nivel Laboral 3 (Decreto N° 87/1990 y Normativa Especial)', label: 'Nivel Laboral 3 (Decreto 87 - 38 HA JEC / 30 HA)', ciclo: 'Laboral 3' },
];

export const GRADOS_COMBINABLES = [
  'Pre-Kínder', 'Kínder',
  '1° Básico', '2° Básico', '3° Básico', '4° Básico',
  '5° Básico', '6° Básico', '7° Básico', '8° Básico',
  '1° Medio', '2° Medio', '3° Medio', '4° Medio',
  '1° Nivel Básico Adultos', '2° Nivel Básico Adultos', '3° Nivel Básico Adultos',
  '1° Nivel Medio Adultos', '2° Nivel Medio Adultos'
];

export const TIPOS_APOYO_PIE = [
  { id: 'Co-Docencia en Aula Regular', label: 'Co-Docencia en Aula Regular (Docente Diferencial)', estamentoSugerido: 'DOCENTE_DIFERENCIAL' },
  { id: 'Aula de Recursos / Apoyo Especializado', label: 'Aula de Recursos / Apoyo Especializado', estamentoSugerido: 'DOCENTE_DIFERENCIAL' },
  { id: 'Apoyo Multidisciplinario / Clínico PAE', label: 'Apoyo Profesional PAE (Fonoaudiólogo / Psicólogo / TO)', estamentoSugerido: 'PROFESIONAL_PAE' },
  { id: 'Apoyo Técnico en Aula', label: 'Apoyo Técnico en Educación Especial', estamentoSugerido: 'TECNICO_ESPECIAL' },
  { id: 'Trabajo Colaborativo / Co-Planificación', label: 'Trabajo Colaborativo Art. 86 (Docente de Aula)', estamentoSugerido: 'DOCENTE_AULA' }
];
