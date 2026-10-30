export type EstamentoAsistente = 
  | 'PROFESIONAL'
  | 'TECNICO'
  | 'ADMINISTRATIVO'
  | 'AUXILIAR'
  | 'PARADOCENTE_INSPECTORIA';

export interface AsistenteRegistroBase {
  id: string;
  rbd: string;
  periodo?: number;
  run: string;
  nombres: string;
  apellidos: string;
  cargoFuncion: string;
  estamento: EstamentoAsistente;
  horasContrato: number;
  horasSubvencionGeneralIndefinido: number;
  horasSubvencionGeneralPlazoFijo: number;
  horasSepIndefinido: number;
  horasSepPlazoFijo: number;
  horasPieIndefinido: number;
  horasPiePlazoFijo: number;
  esDuplaPsicosocial?: boolean;
  esEquipoPie?: boolean;
  esTecnicoParvulo?: boolean;
  esAuxiliarServicio?: boolean;
  esInspectorPatio?: boolean;
  observaciones?: string;
  activo?: boolean;
}

export interface ClasificacionInferencia {
  estamento: EstamentoAsistente;
  esDuplaPsicosocial: boolean;
  esEquipoPie: boolean;
  esTecnicoParvulo: boolean;
  esAuxiliarServicio: boolean;
  esInspectorPatio: boolean;
}

/**
 * Clasifica de forma inteligente el estamento y flags de un asistente según su cargo o función
 * bajo el marco de la Ley N° 21.109 / 19.464 y normativas MINEDUC.
 */
export function inferirClasificacionAsistente(cargo: string): ClasificacionInferencia {
  const c = (cargo || '').trim().toUpperCase();

  const esPsicologo = /PSIC[OÓ]LOG/i.test(c);
  const esTrabajadorSocial = /ASISTENTE\s*SOCIAL|TRABAJADOR(A)?\s*SOCIAL/i.test(c);
  const esFono = /FONOAUD/i.test(c);
  const esTerapeuta = /TERAPEUTA\s*OCUPACIONAL|TERAPIA/i.test(c);
  const esKine = /KINESI[OÓ]LOG/i.test(c);
  const esDiferencial = /ASISTENTE\s*(DE\s*)?EDUCACI[OÓ]N\s*DIFERENCIAL|ASISTENTE\s*DIFERENCIAL/i.test(c);
  const esPsicopedagogo = /PSICOPEDAG/i.test(c);

  const esPie = esFono || esTerapeuta || esKine || esDiferencial || esPsicopedagogo;
  const esDupla = esPsicologo || esTrabajadorSocial;
  const esParvulo = /P[AÁ]RVULO|PARVULARIA/i.test(c);
  const esAuxiliar = /AUXILIAR(ES)?|ASEO|SERVICIOS\s*MENORES|CHOFER(ES)?|CONDUCTOR(ES|AS)?|SERENO(S)?|NOCHERO(S|AS|\/A|\/A)?|ROND[IÍ]N(ES)?|CUIDADOR(ES|AS)?|MANTENCI[OÓ]N|MAESTRO(S)?/i.test(c);
  const esInspector = /INSPECTOR(ES|AS|\/A|\/A)?|PARADOCENTE(S)?|PATIO|PASILLO/i.test(c);

  let estamento: EstamentoAsistente = 'PARADOCENTE_INSPECTORIA';

  if (esPsicologo || esTrabajadorSocial || esFono || esTerapeuta || esKine || /ENFERMER[OA]\s*UNIV|INGENIERO|ASISTENTE\s*SOCIAL/i.test(c)) {
    estamento = 'PROFESIONAL';
  } else if (/T[EÉ]CNICO|TENS|ENFERMER[IÍ]A|SOPORTE\s*T[EÉ]CNICO|BIBLIOTEC/i.test(c) || esParvulo) {
    estamento = 'TECNICO';
  } else if (/SECRETARI|ADMINISTRATIV|ENCARGAD[OA]\s*(DE\s*)?(INFORMATICA|SIGE|ADQUISICIONES|BODEGA)|CONTADOR/i.test(c)) {
    estamento = 'ADMINISTRATIVO';
  } else if (esAuxiliar) {
    estamento = 'AUXILIAR';
  } else {
    estamento = 'PARADOCENTE_INSPECTORIA';
  }

  return {
    estamento,
    esDuplaPsicosocial: esDupla,
    esEquipoPie: esPie,
    esTecnicoParvulo: esParvulo,
    esAuxiliarServicio: esAuxiliar,
    esInspectorPatio: esInspector
  };
}

export interface AsistenteResumenEstamentoCalc {
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

export interface DiagnosticoAsistentesCompleto {
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
  desgloseEstamentos: AsistenteResumenEstamentoCalc[];
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

/**
 * Genera el diagnóstico y balance normativo completo de la dotación de asistentes de un establecimiento.
 */
export function calcularDiagnosticoAsistentes(
  asistentes: AsistenteRegistroBase[],
  contexto?: {
    rbd?: string;
    periodo?: number;
    matricula?: number;
    salasParvulo?: number;
    superficieM2?: number;
  }
): DiagnosticoAsistentesCompleto {
  const rbd = contexto?.rbd || (asistentes[0]?.rbd ?? '');
  const periodo = contexto?.periodo || (asistentes[0]?.periodo ?? 2026);
  const matricula = contexto?.matricula || 0;
  const salasParvulo = contexto?.salasParvulo || 0;

  let totalHoras = 0;
  let totalHorasSubvencionGeneral = 0;
  let totalHorasSep = 0;
  let totalHorasPie = 0;
  let totalHorasIndefinidas = 0;
  let totalHorasPlazoFijo = 0;

  const estamentosMap: Record<EstamentoAsistente, AsistenteResumenEstamentoCalc> = {
    PROFESIONAL: {
      estamento: 'PROFESIONAL',
      cantidadFuncionarios: 0,
      totalHoras: 0,
      horasSubvencionGeneral: 0,
      horasSep: 0,
      horasPie: 0,
      horasIndefinidas: 0,
      horasPlazoFijo: 0,
      porcentajeHoras: 0
    },
    TECNICO: {
      estamento: 'TECNICO',
      cantidadFuncionarios: 0,
      totalHoras: 0,
      horasSubvencionGeneral: 0,
      horasSep: 0,
      horasPie: 0,
      horasIndefinidas: 0,
      horasPlazoFijo: 0,
      porcentajeHoras: 0
    },
    ADMINISTRATIVO: {
      estamento: 'ADMINISTRATIVO',
      cantidadFuncionarios: 0,
      totalHoras: 0,
      horasSubvencionGeneral: 0,
      horasSep: 0,
      horasPie: 0,
      horasIndefinidas: 0,
      horasPlazoFijo: 0,
      porcentajeHoras: 0
    },
    AUXILIAR: {
      estamento: 'AUXILIAR',
      cantidadFuncionarios: 0,
      totalHoras: 0,
      horasSubvencionGeneral: 0,
      horasSep: 0,
      horasPie: 0,
      horasIndefinidas: 0,
      horasPlazoFijo: 0,
      porcentajeHoras: 0
    },
    PARADOCENTE_INSPECTORIA: {
      estamento: 'PARADOCENTE_INSPECTORIA',
      cantidadFuncionarios: 0,
      totalHoras: 0,
      horasSubvencionGeneral: 0,
      horasSep: 0,
      horasPie: 0,
      horasIndefinidas: 0,
      horasPlazoFijo: 0,
      porcentajeHoras: 0
    }
  };

  let horasPsicologia = 0;
  let horasTrabajoSocial = 0;
  let cantidadProfesionalesPie = 0;
  let horasTotalesPie = 0;
  const especialidadesPieSet = new Set<string>();

  let cantidadAuxiliares = 0;
  let horasAuxiliares = 0;

  let cantidadTecnicosParvulo = 0;
  let horasTecnicosParvulo = 0;

  const alertas: string[] = [];

  for (const a of asistentes) {
    if (a.activo === false) continue;

    const horasGralInd = a.horasSubvencionGeneralIndefinido || 0;
    const horasGralPlazo = a.horasSubvencionGeneralPlazoFijo || 0;
    const horasSepInd = a.horasSepIndefinido || 0;
    const horasSepPlazo = a.horasSepPlazoFijo || 0;
    const horasPieInd = a.horasPieIndefinido || 0;
    const horasPiePlazo = a.horasPiePlazoFijo || 0;

    const sumFuentes = horasGralInd + horasGralPlazo + horasSepInd + horasSepPlazo + horasPieInd + horasPiePlazo;
    const horasContrato = a.horasContrato || 0;

    // Validación de exceso legal Art. 22
    if (horasContrato > 44) {
      alertas.push(`Funcionario ${a.nombres} ${a.apellidos} (${a.run}) supera el límite legal máximo de 44 hrs semanales (${horasContrato} hrs).`);
    }

    // Validación de cuadratura de financiamientos
    if (Math.abs(sumFuentes - horasContrato) > 0.05 && sumFuentes > 0) {
      alertas.push(`Descuadre en ${a.nombres} ${a.apellidos}: Contrato declara ${horasContrato} hrs pero la suma de fuentes es ${sumFuentes} hrs.`);
    }

    const horasSubvGral = horasGralInd + horasGralPlazo;
    const horasSep = horasSepInd + horasSepPlazo;
    const horasPie = horasPieInd + horasPiePlazo;
    const horasIndef = horasGralInd + horasSepInd + horasPieInd;
    const horasPlazo = horasGralPlazo + horasSepPlazo + horasPiePlazo;

    totalHoras += horasContrato;
    totalHorasSubvencionGeneral += horasSubvGral;
    totalHorasSep += horasSep;
    totalHorasPie += horasPie;
    totalHorasIndefinidas += horasIndef;
    totalHorasPlazoFijo += horasPlazo;

    const estamento = estamentosMap[a.estamento] ? a.estamento : 'PARADOCENTE_INSPECTORIA';
    const estObj = estamentosMap[estamento];
    estObj.cantidadFuncionarios += 1;
    estObj.totalHoras += horasContrato;
    estObj.horasSubvencionGeneral += horasSubvGral;
    estObj.horasSep += horasSep;
    estObj.horasPie += horasPie;
    estObj.horasIndefinidas += horasIndef;
    estObj.horasPlazoFijo += horasPlazo;

    // Métricas Dupla Psicosocial
    const cargoUpper = (a.cargoFuncion || '').toUpperCase();
    const esPsicologo = /PSIC[OÓ]LOG/i.test(cargoUpper);
    const esTrabajadorSocial = /ASISTENTE\s*SOCIAL|TRABAJADOR(A)?\s*SOCIAL/i.test(cargoUpper);

    if (esPsicologo) {
      // Si el contrato es compartido (SEP/General + PIE), se imputan a la dupla sus horas no-PIE (ej: 22h SEP).
      // Si todo el contrato es financiado por PIE o General, se reconocen sus horas para la cobertura del colegio.
      const hPsico = (horasSubvGral + horasSep) > 0 ? (horasSubvGral + horasSep) : horasContrato;
      horasPsicologia += hPsico;
    }
    if (esTrabajadorSocial) {
      const hSocial = (horasSubvGral + horasSep) > 0 ? (horasSubvGral + horasSep) : horasContrato;
      horasTrabajoSocial += hSocial;
    }

    // Métricas Equipo PIE / PAE: computa estrictamente las horas financiadas por Subvención PIE (Dto. 170)
    if (a.esEquipoPie || horasPie > 0) {
      cantidadProfesionalesPie += 1;
      const horasEfectivasPie = horasPie > 0
        ? horasPie
        : (a.esEquipoPie && (horasSubvGral + horasSep) === 0 ? horasContrato : 0);
      horasTotalesPie += horasEfectivasPie;

      if (/FONOAUD/i.test(cargoUpper)) especialidadesPieSet.add('Fonoaudiología');
      if (/TERAPEUTA/i.test(cargoUpper)) especialidadesPieSet.add('Terapia Ocupacional');
      if (/KINESI/i.test(cargoUpper)) especialidadesPieSet.add('Kinesiología');
      if (/DIFERENCIAL/i.test(cargoUpper)) especialidadesPieSet.add('Educación Diferencial');
      if (/PSICOPEDAG/i.test(cargoUpper)) especialidadesPieSet.add('Psicopedagogía');
      if (/PSIC[OÓ]LOG/i.test(cargoUpper)) especialidadesPieSet.add('Psicología PIE');
      if (/ASISTENTE\s*SOCIAL|TRABAJADOR(A)?\s*SOCIAL/i.test(cargoUpper)) especialidadesPieSet.add('Trabajo Social PIE');
    }

    // Métricas Auxiliares
    if (a.estamento === 'AUXILIAR' || a.esAuxiliarServicio) {
      cantidadAuxiliares += 1;
      horasAuxiliares += horasContrato;
    }

    // Métricas Párvulo
    if (a.esTecnicoParvulo || /P[AÁ]RVULO/i.test(cargoUpper)) {
      cantidadTecnicosParvulo += 1;
      horasTecnicosParvulo += horasContrato;
    }
  }

  // Calcular porcentajes por estamento
  const desgloseEstamentos = Object.values(estamentosMap).map((e) => ({
    ...e,
    porcentajeHoras: totalHoras > 0 ? Math.round((e.totalHoras / totalHoras) * 1000) / 10 : 0
  }));

  const pctIndefinidos = totalHoras > 0 ? Math.round((totalHorasIndefinidas / totalHoras) * 1000) / 10 : 0;
  const pctPlazoFijo = totalHoras > 0 ? Math.round((totalHorasPlazoFijo / totalHoras) * 1000) / 10 : 0;

  const tienePsicologo = horasPsicologia > 0;
  const tieneTrabajadorSocial = horasTrabajoSocial > 0;
  let estadoCoberturaDupla: 'COMPLETA' | 'PARCIAL' | 'SIN_DUPLA' = 'SIN_DUPLA';
  if (tienePsicologo && tieneTrabajadorSocial) {
    estadoCoberturaDupla = 'COMPLETA';
  } else if (tienePsicologo || tieneTrabajadorSocial) {
    estadoCoberturaDupla = 'PARCIAL';
  }

  const ratioAlumnosPorAuxiliar = cantidadAuxiliares > 0 && matricula > 0 ? Math.round(matricula / cantidadAuxiliares) : 0;
  const coberturaSalasParvulo = salasParvulo === 0 || cantidadTecnicosParvulo >= salasParvulo;

  if (salasParvulo > 0 && cantidadTecnicosParvulo < salasParvulo) {
    alertas.push(`Déficit de Técnicos en Párvulos: Se detectaron ${salasParvulo} salas de párvulos pero solo ${cantidadTecnicosParvulo} técnico(s) contratado(s).`);
  }

  return {
    rbd,
    periodo,
    totalAsistentes: asistentes.filter((a) => a.activo !== false).length,
    totalHoras,
    totalHorasSubvencionGeneral,
    totalHorasSep,
    totalHorasPie,
    totalHorasIndefinidas,
    totalHorasPlazoFijo,
    porcentajeIndefinidos: pctIndefinidos,
    porcentajePlazoFijo: pctPlazoFijo,
    desgloseEstamentos,
    duplaPsicosocial: {
      tienePsicologo,
      tieneTrabajadorSocial,
      horasPsicologia,
      horasTrabajoSocial,
      estadoCobertura: estadoCoberturaDupla
    },
    equipoPie: {
      cantidadProfesionales: cantidadProfesionalesPie,
      horasTotales: horasTotalesPie,
      especialidades: Array.from(especialidadesPieSet)
    },
    auxiliaresAseo: {
      cantidad: cantidadAuxiliares,
      horasTotales: horasAuxiliares,
      ratioAlumnosPorAuxiliar
    },
    tecnicosParvulo: {
      cantidad: cantidadTecnicosParvulo,
      horasTotales: horasTecnicosParvulo,
      salasParvuloDetectadas: salasParvulo,
      coberturaSalas: coberturaSalasParvulo
    },
    alertas
  };
}
