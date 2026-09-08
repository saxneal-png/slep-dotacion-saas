export type ComunaValleDiguillin = 
  | 'Bulnes'
  | 'Chillán'
  | 'Chillán Viejo'
  | 'El Carmen'
  | 'Pemuco'
  | 'San Ignacio'
  | 'Yungay';

export type RegimenJornada = 'JEC' | 'No JEC' | 'Mixto';

export interface Establecimiento {
  id: string;
  rbd: string;
  nombre: string;
  comuna: ComunaValleDiguillin;
  regimen: RegimenJornada;
  porcentajePrioritarios: number; // >= 80% aplica 60/40
  director?: string;
  asesorUatp?: string;
  telefono?: string;
  email?: string;
}

export interface SalaInfraestructura {
  id: string;
  rbd: string;
  pabellon?: string;
  nombreSala: string;
  superficieM2: number;
  tipo: 'REGULAR' | 'PARVULARIA' | 'TALLER';
  aforoMaximo: number;
}

export interface TallerJec {
  id: string;
  nombre: string;
  horas: number;
}

export interface CursoSae {
  id: string;
  rbd: string;
  periodo?: number; // 2026 | 2027
  nivel: string; // ej: "1° Básico", "4° Medio HC"
  letra: string; // "A", "B"
  regimen: 'JEC' | 'No JEC';
  regimenProporcion?: '65_35' | '60_40';
  salaId?: string;
  cupoSae: number;
  matriculaProyectada: number;
  alumnosNeet: number; // Necesidades Educativas Transitorias
  alumnosNeep: number; // Necesidades Educativas Permanentes
  talleresJec?: TallerJec[];
}

export type CalidadJuridicaDocente = 'TITULAR' | 'CONTRATA';

export type EstamentoDocente = 
  | 'DOCENTE_AULA'
  | 'DOCENTE_DIFERENCIAL'
  | 'PROFESIONAL_PAE'
  | 'TECNICO_ESPECIAL'
  | 'ASISTENTE_AULA'
  | 'DIRECTIVO'
  | 'TECNICO_PEDAGOGICO'
  | 'COORDINADOR_CRA'
  | 'OTRA_ESTABLECIMIENTO';

export type TipoFuncionNoAula =
  | 'DIRECTIVA'
  | 'INSPECTORIA'
  | 'UTP'
  | 'COORDINACION'
  | 'CONVIVENCIA'
  | 'CRA'
  | 'ENLACES'
  | 'EXTRAESCOLAR'
  | 'EVALUACION'
  | 'ORIENTACION'
  | 'GREMIAL'
  | 'ADMINISTRATIVA'
  | 'OTRA';

export type FuenteFinanciamientoFuncion = 'SUBVENCION_GENERAL' | 'SEP' | 'PIE';

export interface FuncionNoAulaDocente {
  id: string;
  tipo: TipoFuncionNoAula;
  nombre: string;
  horas: number;
  financiamiento?: FuenteFinanciamientoFuncion;
}

export interface Docente {
  id: string;
  rbd: string;
  periodo?: number; // 2026 | 2027
  run: string;
  nombres: string;
  apellidos: string;
  titulo?: string;
  calidadJuridica: CalidadJuridicaDocente;
  estamento: EstamentoDocente;
  horasContrato: number; // 1 a 44 hrs
  // Desglose por fuente de financiamiento y calidad jurídica
  horasSubvencionGeneralTitular?: number;
  horasSubvencionGeneralContrata?: number;
  horasSepTitular?: number;
  horasSepContrata?: number;
  horasPieTitular?: number;
  horasPieContrata?: number;
  horasDirectivas?: number; // Director, Subdirector
  horasInspectorGeneral?: number; // Inspectoría General
  horasTecnicoPedagogicas?: number; // Jefatura UTP, Evaluador, Orientador
  horasCoordinacion?: number; // Coordinaciones UTP (CRA, Enlaces/TIC, Convivencia Escolar, etc.)
  horasTallerSep?: number; // Horas fijas de taller SEP contratadas (exentas de proporción)
  horasTrabajoColaborativo?: number; // Horas fijas de trabajo colaborativo Art. 86 (exentas de proporción)
  horasCoordinacionPie?: number;
  horasConvivenciaEscolar?: number;
  horasExtraescolar?: number;
  cargoInstitucional?: string;
  tipoCoordinacion?: string;
  funcionesNoAula?: FuncionNoAulaDocente[]; // Múltiples funciones no aula / administrativas
  horasAula?: number;
  horasIngles?: number;
  funcionPrincipal?: string;
  funcionSecundaria?: string;
  asignaturaPrincipal?: string;
  aplicaArticulo69?: boolean; // Reducción a máx 24 hrs por >= 30 años servicio
}

export interface AsignacionHoraria {
  id: string;
  rbd: string;
  periodo?: number; // 2026 | 2027
  cursoId: string;
  docenteId: string;
  coDocenteId?: string;
  tieneCoDocente?: boolean;
  esTallerJec?: boolean;
  esTallerSep?: boolean;
  esTrabajoColaborativo?: boolean; // Trabajo Colaborativo / Co-Planificación Art. 86 (Exento de proporción)
  esProporcionDocente?: boolean;
  esAgrupacionFlexible?: boolean;
  esCoDocencia?: boolean; // Co-docencia en aula regular Decreto 170 (Categoría de apoyo independiente)
  asignatura: string;
  horasPedagogicasAula: number;
  horasCronologicasPie?: number;
  horasColaborativas?: number;
  tipoApoyo?: string;
}

export interface BalanzaHorariaColegio {
  rbd: string;
  nombre: string;
  comuna: string;
  totalCursos: number;
  totalMatriculaProyectada: number;
  totalCuposSae: number;
  horasAulaDemandadasCurriculo: number;
  horasPieDemandadas: number;
  horasColaborativasDemandadas: number;
  horasContratadasTotales: number;
  horasDirectivasTotales: number; // Dirección y Subdirección
  horasInspectorGeneralTotales?: number; // Inspectoría General
  horasTecnicoPedagogicasTotales: number; // Jefatura UTP
  horasCoordinacionTotales?: number; // Coordinaciones UTP
  horasLectivasDisponibles: number;
  horasLectivasAsignadas: number;
  superavitDeficitLectivo: number;
  sobreasignacionesAlertas: string[];
  alertasInfraestructura: string[];
  alertasAforoPie: string[];
}

export interface CarteraExportData {
  version: string;
  fechaExportacion: string;
  asesor: {
    nombre: string;
    email: string;
  };
  establecimientos: Establecimiento[];
  salas: SalaInfraestructura[];
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
}

export interface InconsistenciaTerritorial {
  tipo: 'RUT_DUPLICADO' | 'EXCESO_JORNADA_GLOBAL' | 'DEFICIT_ESPECIALIDAD';
  run?: string;
  docenteNombre?: string;
  colegiosInvolucrados: string[];
  horasTotalesSumadas?: number;
  descripcion: string;
}

export interface SigeDocenteRow {
  runCompleto: string;
  run: string;
  dv: string;
  nombres: string;
  apellidos: string;
  rbd: string;
  nombreEstablecimiento: string;
  funcionPrincipal: string;
  funcionSecundaria: string;
  horasContrato: number;
  horasIngles: number;
  horasDirectivas: number;
  horasTecnicoPedagogica: number;
  horasAula: number;
  horasPedagogicasFuncion1: number;
  horasPedagogicasFuncion2: number;
  sectorFuncion1: string;
  subSectorFuncion1: string;
  sectorFuncion2: string;
  subSectorFuncion2: string;
  estadoIdoneidad: string;
}

export interface ContratoDocenteColegio {
  colegio: Establecimiento;
  docente: Docente;
  asignaciones: AsignacionHoraria[];
  horasDocenciaNeta: number;
  horasDirectivas?: number;
  horasInspectorGeneral?: number;
  horasTecnicoPedagogicas?: number;
  horasCoordinacion?: number;
  horasTallerSep?: number;
  horasTrabajoColaborativo?: number;
  horasCoDocencia?: number;
  horasAulaRegular?: number;
  esExentoProporcion?: boolean;
  horasPedagogicasAsignadas: number;
  regimen: '65/35' | '60/40';
  maxHorasPedagogicasMineduc: number;
  minutosLectivosMineduc: number;
  minutosRecreoMineduc: number;
  minutosNoLectivosMineduc: number;
  minutosTotalesContrato: number;
  estaSobreasignado: boolean;
  excesoHorasAula: number;
  fuentesFinanciamiento: {
    subvencionGeneralTitular: number;
    subvencionGeneralContrata: number;
    sepTitular: number;
    sepContrata: number;
    pieTitular: number;
    pieContrata: number;
    total: number;
  };
  // Campos de Auditoría Multitramo y Proporción Estricta MINEDUC
  horasAula65_35?: number;
  horasAula60_40?: number;
  horasPieCronologicas?: number;
  horasTallerSepExento?: number;
  horasPieSepCronologicas?: number;
  contratoCalculadoTotal?: number;
  contratoReq65_35?: number;
  contratoReq60_40?: number;
  contratoPonderado65_35?: number;
  contratoPonderado60_40?: number;
  minutosHnlPlanificacion40?: number;
  porcentajeLectivoReal?: number;
  porcentajeLimitePonderado?: number;
  esInfractorExcesoLectivo?: boolean;
  saldoHoras?: number;
  estadoSaldo?: 'EXACTO' | 'HOLGURA' | 'DEFICIT' | 'POR_AUDITAR';
  // Auditoría Financiera: Restricción de financiamiento de Plan de Estudio y JEC con SEP/PIE
  horasAulaPlanEstudioYJec?: number;
  contratoReqSubvencionGeneral?: number;
  subvencionGeneralContratoTotal?: number;
  deficitSubvencionGeneral?: number;
  esImprocedenteFinanciamientoSepPie?: boolean;
  alertaFinanciamientoSepPie?: string;
  // Funciones fuera de aula y Artículo 69
  funcionesNoAula?: FuncionNoAulaDocente[];
  aplicaArticulo69?: boolean;
  horasReduccionArticulo69?: number;
  minutosReduccionArticulo69?: number;
}

export interface DocenteConsolidadoTerritorial {
  run: string;
  nombres: string;
  apellidos: string;
  titulo?: string;
  estamentoPrincipal: string;
  contratos: ContratoDocenteColegio[];
  horasTotalesSlep: number;
  excedeLimiteSlep: boolean; // > 44 hrs en el SLEP
  excesoHorasSlep: number;
  colegiosNombres: string[];
  totalHorasPedagogicasAula: number;
  totalHorasAulaRegular?: number;
  totalHorasCoDocencia?: number;
  totalHorasTallerSep?: number;
  totalHorasTrabajoColaborativo?: number;
  totalHorasInstitucionalesNoAula?: number;
  funcionesNoAula?: FuncionNoAulaDocente[];
  aplicaArticulo69?: boolean;
  resumenFinanciamiento: {
    subvencionGeneralTitular: number;
    subvencionGeneralContrata: number;
    sepTitular: number;
    sepContrata: number;
    pieTitular: number;
    pieContrata: number;
    subvencionGeneral: number;
    sep: number;
    pie: number;
    titular: number;
    contrata: number;
    total: number;
  };
}

export type PeriodoGestion = 2026 | 2027;

export interface CursoDetectadoExcel {
  colIndex: number;
  headerRaw: string;
  nivel: string;
  letra: string;
  regimen: 'JEC' | 'No JEC';
  esMultigrado: boolean;
  horasTotalesColumna?: number;
}

export interface AsignacionMatrizExcel {
  docenteRun: string;
  docenteNombre: string;
  asignatura: string;
  nivelCurso: string;
  letraCurso: string;
  horasPedagogicasAula: number;
  esTallerJec?: boolean;
}

export interface DocenteMatrizExcel {
  nombres: string;
  apellidos: string;
  run: string;
  horasContrato: number;
  titularSubGral: number;
  contrataSubGral: number;
  titularSep: number;
  contrataSep: number;
  titularPie: number;
  contrataPie: number;
  totalHa?: number;
  totalHcSubGral?: number;
  totalHcSubSep?: number;
  totalHcSubPie?: number;
  totalHc?: number;
  recreos6040?: number;
  recreos6535?: number;
  horasNoLectivas6040?: number;
  horasNoLectivas6535?: number;
  asignaciones: AsignacionMatrizExcel[];
  observaciones?: string;
}

export interface MatrizExcelParseResult {
  archivoNombre: string;
  hojaSeleccionada: string;
  rbdDetectado?: string;
  nombreEstablecimientoDetectado?: string;
  comunaDetectada?: string;
  periodoDetectado: number;
  cursos: CursoDetectadoExcel[];
  docentes: DocenteMatrizExcel[];
  totalAsignaciones: number;
  totalHorasContrato: number;
  totalHorasAulaAsignadas: number;
  alertas: string[];
}

export interface ResumenPeriodo {
  periodo: number;
  totalCursos: number;
  matriculaTotal: number;
  docentesTotal: number;
  horasContratoTotal: number;
  horasAulaDemandadas: number;
  horasLectivasDisponibles: number;
  horasAsignadas: number;
  balanceLectivo: number;
  subvencionGeneralTotal: number;
  sepTotal: number;
  pieTotal: number;
}

export interface ComparativaPeriodosResult {
  rbd: string;
  establecimientoNombre: string;
  periodoA: ResumenPeriodo; // e.g. 2026
  periodoB: ResumenPeriodo; // e.g. 2027
  deltaMatricula: number;
  deltaCursos: number;
  deltaHorasContrato: number;
  deltaHorasAulaDemandadas: number;
  deltaBalanceLectivo: number;
  variacionesDocentes: {
    run: string;
    nombre: string;
    horasA: number;
    horasB: number;
    deltaHoras: number;
    cambioCalidad?: string;
    tipoVariacion: 'NUEVO_CONTRATO' | 'REDUCCION_HORAS' | 'AUMENTO_HORAS' | 'SIN_CAMBIO' | 'EGRESO';
  }[];
}

