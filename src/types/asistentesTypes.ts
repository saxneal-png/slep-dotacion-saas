import type { Establecimiento } from './index';

export type EstamentoAsistente = 
  | 'PROFESIONAL'
  | 'TECNICO'
  | 'ADMINISTRATIVO'
  | 'AUXILIAR'
  | 'PARADOCENTE_INSPECTORIA';

export type CalidadContratoAsistente = 'INDEFINIDO' | 'PLAZO_FIJO' | 'MIXTO';

export interface AsistenteEducacion {
  id: string;
  rbd: string;
  periodo: number; // 2026, 2027
  run: string;
  nombres: string;
  apellidos: string;
  cargoFuncion: string;
  estamento: EstamentoAsistente;
  horasContrato: number; // Máx 44 hrs
  
  // Financiamiento y Calidad Contractual (6 columnas estándar + Honorarios)
  horasSubvencionGeneralIndefinido: number;
  horasSubvencionGeneralPlazoFijo: number;
  horasSepIndefinido: number;
  horasSepPlazoFijo: number;
  horasPieIndefinido: number;
  horasPiePlazoFijo: number;
  horasHonorarios?: number;

  // Clasificaciones operativas e indicadores
  esDuplaPsicosocial?: boolean;
  esEquipoPie?: boolean;
  esTecnicoParvulo?: boolean;
  esAuxiliarServicio?: boolean;
  esInspectorPatio?: boolean;
  observaciones?: string;
  activo: boolean;

  // Metadatos Oficiales DEP y Planilla GDP
  horasVigentesAnterior?: number;
  propuestaGdp?: string;
  remuneracionMensualApp?: number;
  remuneracionMensual?: number;
  fechaInicioContrato?: string;
  fechaTerminoContrato?: string;
  accionPmeSep?: string;
  accionPme?: string;
  horasProRetencion?: number;
  descripcionFuncionGdp?: string;
  estadoSancionGdp?: 'Pendiente' | 'Aprobado' | 'Aprobado parcial.' | 'Rechazado';
  horasAprobadasGdp?: number;
  situacionFinalGdp?: string;
  observacionesDirector?: string;
  observacionesSlep?: string;
  observacionesPal?: string;
  // Campos específicos VTF / JISC
  esVtf?: boolean;
  funcionVtf?: 'Función Directiva' | 'Educadora de Párvulos' | 'Técnico de Educación Parvularia' | 'Otros asistentes de la educación';
  grupoJiscId?: string;
  horaIngresoTurno?: string;
  horaSalidaTurno?: string;
}

export interface AsistenteResumenEstamento {
  estamento: EstamentoAsistente;
  cantidadFuncionarios: number;
  totalHoras: number;
  horasSubvencionGeneral: number;
  horasSep: number;
  horasPie: number;
  horasIndefinidas: number;
  horasPlazoFijo: number;
  porcentajeHoras: number;
}

export interface DiagnosticoAsistentesColegio {
  rbd: string;
  periodo: number;
  totalAsistentes: number;
  totalHoras: number;
  totalHorasSubvencionGeneral: number;
  totalHorasSep: number;
  totalHorasPie: number;
  totalHorasHonorarios?: number;
  totalHorasIndefinidas: number;
  totalHorasPlazoFijo: number;
  porcentajeIndefinidos: number;
  porcentajePlazoFijo: number;
  desgloseEstamentos: AsistenteResumenEstamento[];
  duplaPsicosocial: {
    tienePsicologo: boolean;
    tieneTrabajadorSocial: boolean;
    horasPsicologia: number;
    horasTrabajoSocial: number;
    estadoCobertura: 'COMPLETA' | 'PARCIAL' | 'SIN_DUPLA';
  };
  equipoPie: {
    cantidadProfesionales: number;
    horasTotales: number;
    especialidades: string[];
  };
  auxiliaresAseo: {
    cantidad: number;
    horasTotales: number;
    ratioAlumnosPorAuxiliar: number;
  };
  tecnicosParvulo: {
    cantidad: number;
    horasTotales: number;
    salasParvuloDetectadas: number;
    coberturaSalas: boolean;
  };
  alertas: string[];
}

export interface ContratoAsistenteColegio {
  colegio: Establecimiento;
  asistente: AsistenteEducacion;
  horasContrato: number;
  fuentesFinanciamiento: {
    subvencionGeneralIndefinido: number;
    subvencionGeneralPlazoFijo: number;
    sepIndefinido: number;
    sepPlazoFijo: number;
    pieIndefinido: number;
    piePlazoFijo: number;
    honorarios: number;
    proRetencion: number;
    total: number;
  };
}

export interface AsistenteConsolidadoTerritorial {
  idKey: string;
  run: string;
  nombres: string;
  apellidos: string;
  estamentoPrincipal: EstamentoAsistente;
  cargosPrincipales: string[];
  contratos: ContratoAsistenteColegio[];
  colegiosNombres: string[];
  horasTotalesSlep: number;
  excedeLimiteSlep: boolean; // > 44 hrs en el SLEP
  excesoHorasSlep: number;
  esDuplaPsicosocial: boolean;
  esEquipoPie: boolean;
  esTecnicoParvulo: boolean;
  esAuxiliarServicio: boolean;
  esInspectorPatio: boolean;
  resumenFinanciamiento: {
    subvencionGeneralIndefinido: number;
    subvencionGeneralPlazoFijo: number;
    sepIndefinido: number;
    sepPlazoFijo: number;
    pieIndefinido: number;
    piePlazoFijo: number;
    honorarios: number;
    proRetencion: number;
    subvencionGeneral: number;
    sep: number;
    pie: number;
    indefinido: number;
    plazoFijo: number;
    total: number;
  };
}
