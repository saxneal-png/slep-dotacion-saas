// =============================================================================
// MOTOR NORMATIVO VTF / JISC: COEFICIENTE TÉCNICO D.S. 315/2010 & D.S. 115/2012,
// COBERTURA DE TURNOS (08:30-19:30) Y PROYECCIÓN INTERANUAL DE PÁRVULOS B3
// =============================================================================

export type SubtipoNivelVtf =
  | 'SALA_CUNA_MENOR'
  | 'SALA_CUNA_MAYOR'
  | 'SALA_CUNA_HETEROGENEA'
  | 'MEDIO_MENOR'
  | 'MEDIO_MAYOR'
  | 'MEDIO_HETEROGENEO'
  | 'HETEROGENEO'
  | 'TRANSICION';

export interface ReglaCoeficienteDs115 {
  subtipo: SubtipoNivelVtf;
  etiqueta: string;
  estrato: 'SALA_CUNA' | 'NIVEL_MEDIO' | 'TRANSICION';
  educadoraPorNinos: number;
  tecnicoPorNinos: number;
  capacidadMaxSalaOperativa: number;
  edadMinMesesSugerida: number;
  edadMaxMesesSugerida: number;
}

export const COEFICIENTES_DS115_2012: Record<SubtipoNivelVtf, ReglaCoeficienteDs115> = {
  SALA_CUNA_MENOR: {
    subtipo: 'SALA_CUNA_MENOR',
    etiqueta: 'Sala Cuna Menor (0-12 meses)',
    estrato: 'SALA_CUNA',
    educadoraPorNinos: 42,
    tecnicoPorNinos: 7,
    capacidadMaxSalaOperativa: 20,
    edadMinMesesSugerida: 3,
    edadMaxMesesSugerida: 11,
  },
  SALA_CUNA_MAYOR: {
    subtipo: 'SALA_CUNA_MAYOR',
    etiqueta: 'Sala Cuna Mayor (12-24 meses)',
    estrato: 'SALA_CUNA',
    educadoraPorNinos: 42,
    tecnicoPorNinos: 7,
    capacidadMaxSalaOperativa: 20,
    edadMinMesesSugerida: 12,
    edadMaxMesesSugerida: 23,
  },
  SALA_CUNA_HETEROGENEA: {
    subtipo: 'SALA_CUNA_HETEROGENEA',
    etiqueta: 'Sala Cuna Heterogénea (3-24 meses)',
    estrato: 'SALA_CUNA',
    educadoraPorNinos: 42,
    tecnicoPorNinos: 7,
    capacidadMaxSalaOperativa: 20,
    edadMinMesesSugerida: 3,
    edadMaxMesesSugerida: 23,
  },
  MEDIO_MENOR: {
    subtipo: 'MEDIO_MENOR',
    etiqueta: 'Nivel Medio Menor (24-35 meses)',
    estrato: 'NIVEL_MEDIO',
    educadoraPorNinos: 32,
    tecnicoPorNinos: 25,
    capacidadMaxSalaOperativa: 32,
    edadMinMesesSugerida: 24,
    edadMaxMesesSugerida: 35,
  },
  MEDIO_MAYOR: {
    subtipo: 'MEDIO_MAYOR',
    etiqueta: 'Nivel Medio Mayor (36-47 meses)',
    estrato: 'NIVEL_MEDIO',
    educadoraPorNinos: 32,
    tecnicoPorNinos: 32,
    capacidadMaxSalaOperativa: 32,
    edadMinMesesSugerida: 36,
    edadMaxMesesSugerida: 47,
  },
  MEDIO_HETEROGENEO: {
    subtipo: 'MEDIO_HETEROGENEO',
    etiqueta: 'Nivel Medio Heterogéneo / Mixto',
    estrato: 'NIVEL_MEDIO',
    educadoraPorNinos: 32,
    tecnicoPorNinos: 25, // Criterio conservador D.S. 115 si no hay B3 explícito
    capacidadMaxSalaOperativa: 32,
    edadMinMesesSugerida: 24,
    edadMaxMesesSugerida: 47,
  },
  HETEROGENEO: {
    subtipo: 'HETEROGENEO',
    etiqueta: 'Grupo Heterogéneo Multinivel',
    estrato: 'NIVEL_MEDIO',
    educadoraPorNinos: 32,
    tecnicoPorNinos: 25,
    capacidadMaxSalaOperativa: 32,
    edadMinMesesSugerida: 24,
    edadMaxMesesSugerida: 59,
  },
  TRANSICION: {
    subtipo: 'TRANSICION',
    etiqueta: 'Nivel Transición (NT1/NT2)',
    estrato: 'TRANSICION',
    educadoraPorNinos: 35,
    tecnicoPorNinos: 35,
    capacidadMaxSalaOperativa: 35,
    edadMinMesesSugerida: 48,
    edadMaxMesesSugerida: 71,
  },
};

function normStr(txt: string): string {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function inferirSubtipoNivelVtf(nombreNivel: string): SubtipoNivelVtf {
  const n = normStr(nombreNivel);
  if (n.includes('sala cuna') || n.includes('salacuna')) {
    if (n.includes('menor')) return 'SALA_CUNA_MENOR';
    if (n.includes('mayor')) return 'SALA_CUNA_MAYOR';
    return 'SALA_CUNA_HETEROGENEA';
  }
  if (n.includes('medio menor')) return 'MEDIO_MENOR';
  if (n.includes('medio mayor')) return 'MEDIO_MAYOR';
  if (n.includes('medio mixto') || (n.includes('medio') && n.includes('heterog'))) {
    return 'MEDIO_HETEROGENEO';
  }
  if (n.includes('heterog') || n.includes('mixto')) return 'HETEROGENEO';
  if (n.includes('transicion') || n.includes('nt1') || n.includes('nt2') || n.includes('kinder')) {
    return 'TRANSICION';
  }
  return 'MEDIO_HETEROGENEO';
}

export interface InputNivelVtf {
  id: string;
  nivelNombre: string;
  subtipoNivel?: SubtipoNivelVtf;
  matriculaActiva: number;
  capacidadAutorizada?: number;
  edadMesesMin?: number;
  edadMesesMax?: number;
  tieneExtensionHoraria?: boolean;
  matriculaExtension?: number;
  educadorasAsignadas?: number;
  tecnicosAsignados?: number;
}

export interface ResultadoRequerimientoNivelVtf {
  nivelId: string;
  nivelNombre: string;
  subtipoNivel: SubtipoNivelVtf;
  subtipoEfectivoPorEdad: SubtipoNivelVtf;
  estrato: 'SALA_CUNA' | 'NIVEL_MEDIO' | 'TRANSICION';
  reglaAplicada: ReglaCoeficienteDs115;
  matriculaActiva: number;
  capacidadAutorizada: number;
  educadorasFraccion: number;
  educadorasRequeridasGrupo: number;
  tecnicosRequeridosGrupo: number;
  reglaEdadMinimaAplicada: boolean;
  alertaSobrecupoOperativo: boolean;
  alertas: string[];
}

/**
 * Calcula el requerimiento de Educadora y Técnico de Párvulos para un nivel o grupo JISC
 * aplicando D.S. 315/2010 y D.S. 115/2012 (incluyendo criterio de niño menor para heterogéneos).
 */
export function calcularRequerimientoNivelVtf(input: InputNivelVtf): ResultadoRequerimientoNivelVtf {
  const subtipoDeclarado = input.subtipoNivel || inferirSubtipoNivelVtf(input.nivelNombre);
  let subtipoEfectivo = subtipoDeclarado;
  let reglaEdadMinimaAplicada = false;
  const alertas: string[] = [];

  const esHet =
    subtipoDeclarado === 'SALA_CUNA_HETEROGENEA' ||
    subtipoDeclarado === 'MEDIO_HETEROGENEO' ||
    subtipoDeclarado === 'HETEROGENEO';

  if (esHet && typeof input.edadMesesMin === 'number' && Number.isFinite(input.edadMesesMin)) {
    reglaEdadMinimaAplicada = true;
    if (input.edadMesesMin < 24) {
      subtipoEfectivo = 'SALA_CUNA_HETEROGENEA';
      if (subtipoDeclarado !== 'SALA_CUNA_HETEROGENEA') {
        alertas.push(
          `Grupo heterogéneo incluye lactante de ${input.edadMesesMin} meses (<24m): aplica coeficiente estricto de Sala Cuna (1 Téc c/7 niños).`
        );
      }
    } else if (input.edadMesesMin < 36) {
      subtipoEfectivo = 'MEDIO_MENOR';
    } else if (input.edadMesesMin < 48) {
      subtipoEfectivo = 'MEDIO_MAYOR';
    } else {
      subtipoEfectivo = 'TRANSICION';
    }
  }

  const regla = COEFICIENTES_DS115_2012[subtipoEfectivo];
  const matricula = Math.max(0, Math.round(input.matriculaActiva || 0));
  const capacidad = Math.max(0, Math.round(input.capacidadAutorizada || regla.capacidadMaxSalaOperativa));

  const educadorasFraccion = matricula > 0 ? Number((matricula / regla.educadoraPorNinos).toFixed(2)) : 0;
  const educadorasRequeridasGrupo = matricula > 0 ? Math.ceil(matricula / regla.educadoraPorNinos) : 0;
  const tecnicosRequeridosGrupo = matricula > 0 ? Math.ceil(matricula / regla.tecnicoPorNinos) : 0;

  const alertaSobrecupoOperativo = matricula > regla.capacidadMaxSalaOperativa;
  if (alertaSobrecupoOperativo) {
    alertas.push(
      `Matrícula (${matricula}) supera tope operativo recomendado por grupo (${regla.capacidadMaxSalaOperativa}) para ${regla.etiqueta}.`
    );
  }
  if (capacidad > 0 && matricula > capacidad) {
    alertas.push(
      `Sobrecupo sobre capacidad autorizada JISC: ${matricula} activos / ${capacidad} cupos.`
    );
  }

  return {
    nivelId: input.id,
    nivelNombre: input.nivelNombre,
    subtipoNivel: subtipoDeclarado,
    subtipoEfectivoPorEdad: subtipoEfectivo,
    estrato: regla.estrato,
    reglaAplicada: regla,
    matriculaActiva: matricula,
    capacidadAutorizada: capacidad,
    educadorasFraccion,
    educadorasRequeridasGrupo,
    tecnicosRequeridosGrupo,
    reglaEdadMinimaAplicada,
    alertaSobrecupoOperativo,
    alertas,
  };
}

export interface InputTurnoVtf {
  id: string;
  estamentoVtf: 'DIRECTIVA' | 'EDUCADORA' | 'TECNICO' | 'OTRO_ASISTENTE';
  horaEntrada: string; // HH:mm
  horaSalida: string; // HH:mm
  minutosColacion?: number;
  horasSemanalesCronologicas?: number;
}

export interface ResultadoFranjaHorariaVtf {
  franjaInicio: string;
  franjaFin: string;
  etiqueta: string;
  esExtension: boolean;
  educadorasActivas: number;
  tecnicosActivos: number;
  directivasActivas: number;
  requiereCoberturaMinima: boolean;
  cumpleCoberturaBasica: boolean;
}

export interface ResultadoCoberturaTurnosVtf {
  franjas: ResultadoFranjaHorariaVtf[];
  tieneBrechaRegular: boolean;
  tieneBrechaExtension: boolean;
  alertasTurnos: string[];
}

export function parseHoraAMinutos(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!m) return -1;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return -1;
  return h * 60 + min;
}

/**
 * Evalúa la cobertura por franjas horarias (08:30-16:30 regular y 16:30-19:30 extensión)
 * con base en los turnos asignados al personal VTF.
 */
export function calcularCoberturaTurnosVtf(
  turnos: InputTurnoVtf[],
  tieneExtensionHoraria: boolean,
  horarioApertura: string = '08:30',
  horarioCierre: string = '16:30',
  horarioExtensionCierre: string = '19:30'
): ResultadoCoberturaTurnosVtf {
  const minApertura = parseHoraAMinutos(horarioApertura);
  const minCierreReg = parseHoraAMinutos(horarioCierre);
  const minCierreExt = parseHoraAMinutos(horarioExtensionCierre);

  const bloques: { inicio: string; fin: string; etiqueta: string; esExtension: boolean }[] = [
    { inicio: horarioApertura, fin: '12:30', etiqueta: 'Mañana Regular', esExtension: false },
    { inicio: '12:30', fin: horarioCierre, etiqueta: 'Tarde Regular', esExtension: false },
  ];

  if (tieneExtensionHoraria && minCierreExt > minCierreReg) {
    bloques.push({
      inicio: horarioCierre,
      fin: horarioExtensionCierre,
      etiqueta: 'Extensión Horaria',
      esExtension: true,
    });
  }

  const alertasTurnos: string[] = [];
  for (const t of turnos) {
    if ((t.horasSemanalesCronologicas || 0) > 45) {
      alertasTurnos.push(
        `Turno ${t.id} supera el tope legal de 44/45 hrs cronológicas semanales (${t.horasSemanalesCronologicas} hrs).`
      );
    }
    const ent = parseHoraAMinutos(t.horaEntrada);
    const sal = parseHoraAMinutos(t.horaSalida);
    if (ent < 0 || sal <= ent) {
      alertasTurnos.push(`Turno ${t.id} posee rango horario inválido (${t.horaEntrada}-${t.horaSalida}).`);
    }
  }

  const franjas: ResultadoFranjaHorariaVtf[] = bloques.map((b) => {
    const bIni = parseHoraAMinutos(b.inicio);
    const bFin = parseHoraAMinutos(b.fin);
    const midpoint = Math.round((bIni + bFin) / 2);

    let educadorasActivas = 0;
    let tecnicosActivos = 0;
    let directivasActivas = 0;

    for (const t of turnos) {
      const ent = parseHoraAMinutos(t.horaEntrada);
      const sal = parseHoraAMinutos(t.horaSalida);
      if (ent >= 0 && sal > ent && ent <= midpoint && sal >= midpoint) {
        if (t.estamentoVtf === 'EDUCADORA') educadorasActivas++;
        else if (t.estamentoVtf === 'TECNICO') tecnicosActivos++;
        else if (t.estamentoVtf === 'DIRECTIVA') directivasActivas++;
      }
    }

    const cumpleCoberturaBasica = b.esExtension
      ? tecnicosActivos >= 1
      : educadorasActivas >= 1 && tecnicosActivos >= 1;

    return {
      franjaInicio: b.inicio,
      franjaFin: b.fin,
      etiqueta: b.etiqueta,
      esExtension: b.esExtension,
      educadorasActivas,
      tecnicosActivos,
      directivasActivas,
      requiereCoberturaMinima: minApertura >= 0 && minCierreReg > minApertura,
      cumpleCoberturaBasica,
    };
  });

  const tieneBrechaRegular = franjas.some((f) => !f.esExtension && !f.cumpleCoberturaBasica);
  const tieneBrechaExtension = franjas.some((f) => f.esExtension && !f.cumpleCoberturaBasica);

  if (tieneBrechaRegular) {
    alertasTurnos.push(
      'Cobertura incompleta en jornada regular (08:30-16:30): se requiere al menos 1 Educadora y 1 Técnico presentes en cada bloque.'
    );
  }
  if (tieneBrechaExtension) {
    alertasTurnos.push(
      `Extensión horaria activa (${horarioCierre}-${horarioExtensionCierre}) sin Técnico de Párvulos asignado al turno vespertino.`
    );
  }

  return {
    franjas,
    tieneBrechaRegular,
    tieneBrechaExtension,
    alertasTurnos,
  };
}

export interface ResumenProyeccionInteranualVtf {
  matriculaActualActiva: number;
  proyectadosSalaCunaMenor: number; // nuevos ingresos o < 12m
  proyectadosSalaCunaMayor: number;
  proyectadosMedioMenor: number;
  proyectadosMedioMayor: number;
  egresanANt1Escuela: number;
  cuposLiberadosPorEgreso: number;
  alertasProyeccion: string[];
}

export function proyectarNivelesVtfSiguientePeriodo(
  parvulosActivos: Array<{ edadMeses: number; activo?: boolean }>
): ResumenProyeccionInteranualVtf {
  const activos = parvulosActivos.filter((p) => p.activo !== false);
  let proyectadosSalaCunaMenor = 0;
  let proyectadosSalaCunaMayor = 0;
  let proyectadosMedioMenor = 0;
  let proyectadosMedioMayor = 0;
  let egresanANt1Escuela = 0;

  for (const p of activos) {
    const edadProx = Math.max(0, Math.round(p.edadMeses)) + 12;
    if (edadProx < 12) {
      proyectadosSalaCunaMenor++;
    } else if (edadProx < 24) {
      proyectadosSalaCunaMayor++;
    } else if (edadProx < 36) {
      proyectadosMedioMenor++;
    } else if (edadProx < 48) {
      proyectadosMedioMayor++;
    } else {
      egresanANt1Escuela++;
    }
  }

  const alertasProyeccion: string[] = [];
  if (activos.length === 0) {
    alertasProyeccion.push('Sin nómina nominal B3 cargada para calcular promoción automática por cohorte etaria (+12 meses).');
  } else if (egresanANt1Escuela > 0) {
    alertasProyeccion.push(
      `${egresanANt1Escuela} párvulos alcanzan >= 48 meses el próximo período y egresan hacia NT1 (Pre-Kínder) en escuelas básicas.`
    );
  }

  return {
    matriculaActualActiva: activos.length,
    proyectadosSalaCunaMenor,
    proyectadosSalaCunaMayor,
    proyectadosMedioMenor,
    proyectadosMedioMayor,
    egresanANt1Escuela,
    cuposLiberadosPorEgreso: egresanANt1Escuela,
    alertasProyeccion,
  };
}

export interface DiagnosticoEstablecimientoVtf {
  rbd: string;
  totalNiveles: number;
  matriculaTotal: number;
  capacidadTotal: number;
  ocupacionPorcentaje: number;
  requeridoPorNivel: ResultadoRequerimientoNivelVtf[];
  // Requerimientos consolidados D.S. 115/2012 por estrato
  educadorasRequeridasTotal: number;
  tecnicosRequeridosTotal: number;
  directorasRequeridas: number;
  // Asignado actual (PAL VTF + JISC)
  educadorasAsignadas: number;
  tecnicosAsignados: number;
  directorasAsignadas: number;
  otrosAsistentesAsignados: number;
  // Balances (positivo = superávit, negativo = déficit)
  deltaEducadoras: number;
  deltaTecnicos: number;
  deltaDirectoras: number;
  cumpleCoeficienteDs115: boolean;
  coberturaTurnos?: ResultadoCoberturaTurnosVtf;
  alertas: string[];
}

export function evaluarDotacionEstablecimientoVtf(params: {
  rbd: string;
  niveles: InputNivelVtf[];
  personalVtf?: {
    directoras: number;
    educadoras: number;
    tecnicos: number;
    otrosAsistentes: number;
  };
  turnos?: InputTurnoVtf[];
  horarioApertura?: string;
  horarioCierre?: string;
  horarioExtensionCierre?: string;
}): DiagnosticoEstablecimientoVtf {
  const { rbd, niveles, personalVtf, turnos } = params;
  const requeridoPorNivel = niveles.map(calcularRequerimientoNivelVtf);

  const matriculaTotal = requeridoPorNivel.reduce((s, r) => s + r.matriculaActiva, 0);
  const capacidadTotal = requeridoPorNivel.reduce((s, r) => s + r.capacidadAutorizada, 0);
  const ocupacionPorcentaje = capacidadTotal > 0 ? Math.round((matriculaTotal / capacidadTotal) * 100) : 0;

  // D.S. 115/2012: Educadoras se consolidan por estrato (Sala Cuna / Nivel Medio / Transición)
  // o 1 por cada 42 en SC y 1 por cada 32 en Medios
  const matSalaCuna = requeridoPorNivel
    .filter((r) => r.estrato === 'SALA_CUNA')
    .reduce((s, r) => s + r.matriculaActiva, 0);
  const matMedio = requeridoPorNivel
    .filter((r) => r.estrato === 'NIVEL_MEDIO')
    .reduce((s, r) => s + r.matriculaActiva, 0);
  const matTransicion = requeridoPorNivel
    .filter((r) => r.estrato === 'TRANSICION')
    .reduce((s, r) => s + r.matriculaActiva, 0);

  const eduSC = matSalaCuna > 0 ? Math.ceil(matSalaCuna / 42) : 0;
  const eduMed = matMedio > 0 ? Math.ceil(matMedio / 32) : 0;
  const eduTrans = matTransicion > 0 ? Math.ceil(matTransicion / 35) : 0;
  const educadorasRequeridasTotal = eduSC + eduMed + eduTrans;

  const tecnicosRequeridosTotal = requeridoPorNivel.reduce((s, r) => s + r.tecnicosRequeridosGrupo, 0);
  const directorasRequeridas = matriculaTotal > 0 ? 1 : 0;

  const educadorasAsignadas =
    personalVtf?.educadoras ??
    niveles.reduce((s, n) => s + (n.educadorasAsignadas || 0), 0);
  const tecnicosAsignados =
    personalVtf?.tecnicos ??
    niveles.reduce((s, n) => s + (n.tecnicosAsignados || 0), 0);
  const directorasAsignadas = personalVtf?.directoras ?? 0;
  const otrosAsistentesAsignados = personalVtf?.otrosAsistentes ?? 0;

  const deltaEducadoras = educadorasAsignadas - educadorasRequeridasTotal;
  const deltaTecnicos = tecnicosAsignados - tecnicosRequeridosTotal;
  const deltaDirectoras = directorasAsignadas - directorasRequeridas;

  const tieneExtension = niveles.some((n) => n.tieneExtensionHoraria && (n.matriculaExtension || 0) > 0);
  const coberturaTurnos =
    turnos && turnos.length > 0
      ? calcularCoberturaTurnosVtf(
          turnos,
          tieneExtension,
          params.horarioApertura || '08:30',
          params.horarioCierre || '16:30',
          params.horarioExtensionCierre || '19:30'
        )
      : undefined;

  const alertas: string[] = [];
  if (deltaEducadoras < 0) {
    alertas.push(
      `Déficit de Educadora de Párvulos (D.S. 115): faltan ${Math.abs(deltaEducadoras)} (Req: ${educadorasRequeridasTotal}, Asig: ${educadorasAsignadas}).`
    );
  }
  if (deltaTecnicos < 0) {
    alertas.push(
      `Déficit de Técnico de Educación Parvularia (D.S. 115): faltan ${Math.abs(deltaTecnicos)} (Req: ${tecnicosRequeridosTotal}, Asig: ${tecnicosAsignados}).`
    );
  }
  if (deltaDirectoras < 0 && matriculaTotal > 0) {
    alertas.push('No se registra Dirección/Función Directiva asignada al establecimiento VTF.');
  }
  for (const r of requeridoPorNivel) {
    for (const a of r.alertas) {
      alertas.push(`[${r.nivelNombre}] ${a}`);
    }
  }
  if (coberturaTurnos) {
    alertas.push(...coberturaTurnos.alertasTurnos);
  }

  return {
    rbd,
    totalNiveles: niveles.length,
    matriculaTotal,
    capacidadTotal,
    ocupacionPorcentaje,
    requeridoPorNivel,
    educadorasRequeridasTotal,
    tecnicosRequeridosTotal,
    directorasRequeridas,
    educadorasAsignadas,
    tecnicosAsignados,
    directorasAsignadas,
    otrosAsistentesAsignados,
    deltaEducadoras,
    deltaTecnicos,
    deltaDirectoras,
    cumpleCoeficienteDs115: deltaEducadoras >= 0 && deltaTecnicos >= 0,
    coberturaTurnos,
    alertas,
  };
}
