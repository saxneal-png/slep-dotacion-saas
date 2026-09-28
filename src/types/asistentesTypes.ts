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
  
  // Financiamiento y Calidad Contractual (6 columnas estándar)
  horasSubvencionGeneralIndefinido: number;
  horasSubvencionGeneralPlazoFijo: number;
  horasSepIndefinido: number;
  horasSepPlazoFijo: number;
  horasPieIndefinido: number;
  horasPiePlazoFijo: number;

  // Clasificaciones operativas e indicadores
  esDuplaPsicosocial?: boolean;
  esEquipoPie?: boolean;
  esTecnicoParvulo?: boolean;
  esAuxiliarServicio?: boolean;
  esInspectorPatio?: boolean;
  observaciones?: string;
  activo: boolean;
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
