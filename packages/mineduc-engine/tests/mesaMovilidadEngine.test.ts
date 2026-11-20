import { describe, it, expect } from 'vitest';
import {
  // Saneamiento NN
  validarDigitoVerificadorRun,
  detectarDocenteVacanteNn,
  escanearNominaVacantesNn,
  // Egresos y contingencia
  evaluarEgresoProyectado,
  validarConsolidacionSobreEgreso,
  // Motor calce territorial
  TOPE_MINUTOS_SEMANALES_SLEP,
  MAX_MINUTOS_LECTIVOS_ART_69,
  MATRIZ_DISTANCIA_KM_VALLE_DIGUILLIN,
  calcularPuntajeProximidadComuna,
  calcularPuntajePrioridadMovilidad,
  evaluarCompatibilidadEspecialidad,
  evaluarCalceDocenteVacante,
  evaluarCalceAsistenteLey21109,
  generarVacanteDeRebote,
  sugerirCalcesAutomaticos,
  resolverCalceOptimoBipartito,
  resolverCalceOptimoConCadenasRebote,
} from '../src';

describe('Mesa de Movilidad SLEP - Saneamiento Vacantes NN', () => {
  it('valida correctamente RUN chilenos reales con Módulo 11 (numérico, K y 0) y rechaza ficticios', () => {
    expect(validarDigitoVerificadorRun('15.123.456-9')).toBe(true);
    expect(validarDigitoVerificadorRun('15.123.450-K')).toBe(true);
    expect(validarDigitoVerificadorRun('15.123.455-0')).toBe(true);
    expect(validarDigitoVerificadorRun('7.654.321-6')).toBe(true);

    // Rechazos obligatorios
    expect(validarDigitoVerificadorRun('1-9')).toBe(false);
    expect(validarDigitoVerificadorRun('0-0')).toBe(false);
    expect(validarDigitoVerificadorRun('11.111.111-1')).toBe(false);
    expect(validarDigitoVerificadorRun('00.000.000-0')).toBe(false);
    expect(validarDigitoVerificadorRun('99.999.999-9')).toBe(false);
    expect(validarDigitoVerificadorRun('12.345.678-9')).toBe(false);
    expect(validarDigitoVerificadorRun('15.123.456-0')).toBe(false);
    expect(validarDigitoVerificadorRun('')).toBe(false);
  });

  it('detecta vacantes NN por RUN ficticio y patrones de nombre sin falsos positivos en docentes reales', () => {
    const nnRun19 = detectarDocenteVacanteNn({
      id: 'd1',
      rbd: '4001',
      run: '1-9',
      nombres: 'Docente',
      apellidos: 'Historia',
    });
    expect(nnRun19.esVacanteNn).toBe(true);
    expect(nnRun19.confianza).toBe('ALTA');
    expect(nnRun19.runDetectadoComoFicticio).toBe(true);

    const nnRepetido = detectarDocenteVacanteNn({
      id: 'd2',
      rbd: '4001',
      run: '11.111.111-1',
      nombres: 'Juan',
      apellidos: 'Rojas',
    });
    expect(nnRepetido.esVacanteNn).toBe(true);
    expect(nnRepetido.confianza).toBe('ALTA');

    const nnCero = detectarDocenteVacanteNn({
      id: 'd3',
      rbd: '4001',
      run: '0-0',
      nombres: 'María',
      apellidos: 'Pérez',
    });
    expect(nnCero.esVacanteNn).toBe(true);
    expect(nnCero.confianza).toBe('ALTA');

    const porProveer = detectarDocenteVacanteNn({
      id: 'd4',
      rbd: '4001',
      run: '15.123.456-9',
      nombres: 'POR PROVEER',
      apellidos: 'LENGUAJE',
    });
    expect(porProveer.esVacanteNn).toBe(true);
    expect(porProveer.confianza).toBe('ALTA');
    expect(porProveer.nombreDetectadoComoFicticio).toBe(true);
    expect(porProveer.tipoVacanteSugerido).toBe('NECESIDAD_ESCUELA');

    const nnMat = detectarDocenteVacanteNn({
      id: 'd5',
      rbd: '4001',
      run: 'VAC-01',
      nombres: 'NN Matemática',
      apellidos: '',
    });
    expect(nnMat.esVacanteNn).toBe(true);
    expect(nnMat.confianza).toBe('ALTA');
    expect(nnMat.tipoVacanteSugerido).toBe('NN_DETECTADO');

    const sinDocente = detectarDocenteVacanteNn({
      id: 'd6',
      rbd: '4001',
      run: '15.123.450-K',
      nombres: 'SIN DOCENTE',
      apellidos: 'INGLÉS',
    });
    expect(sinDocente.esVacanteNn).toBe(true);
    expect(sinDocente.confianza).toBe('ALTA');

    // Solo falla Módulo 11 con nombre real -> MEDIA
    const soloMod11 = detectarDocenteVacanteNn({
      id: 'd7',
      rbd: '4001',
      run: '15.123.456-0',
      nombres: 'Carolina',
      apellidos: 'Valenzuela',
    });
    expect(soloMod11.esVacanteNn).toBe(true);
    expect(soloMod11.confianza).toBe('MEDIA');

    // Marcado previamente
    const preMarcado = detectarDocenteVacanteNn({
      id: 'd8',
      rbd: '4001',
      run: '15.123.456-9',
      nombres: 'Pedro',
      apellidos: 'Tapia',
      esVacanteNn: true,
    });
    expect(preMarcado.esVacanteNn).toBe(true);
    expect(preMarcado.confianza).toBe('ALTA');
    expect(preMarcado.motivos[0]).toBe('Registro marcado previamente como vacante NN');

    // Docentes reales sin falsos positivos (incluyendo nombres con N)
    const real1 = detectarDocenteVacanteNn({
      id: 'r1',
      rbd: '4001',
      run: '15.123.456-9',
      nombres: 'Iván',
      apellidos: 'Núñez',
    });
    expect(real1.esVacanteNn).toBe(false);
    expect(real1.confianza).toBe('BAJA');
    expect(real1.motivos).toHaveLength(0);

    const real2 = detectarDocenteVacanteNn({
      id: 'r2',
      rbd: '4001',
      run: '15.123.450-K',
      nombres: 'Anne',
      apellidos: 'Contreras',
    });
    expect(real2.esVacanteNn).toBe(false);
    expect(real2.confianza).toBe('BAJA');
  });

  it('escanea una nómina completa y reporta resumen exacto', () => {
    const resumen = escanearNominaVacantesNn([
      { id: '1', rbd: '4001', run: '15.123.456-9', nombres: 'Iván', apellidos: 'Núñez' },
      { id: '2', rbd: '4001', run: '1-9', nombres: 'POR PROVEER', apellidos: 'CIENCIAS' },
      { id: '3', rbd: '4001', run: '99.999.999-9', nombres: 'VACANTE', apellidos: 'ED. FÍSICA' },
    ]);

    expect(resumen.totalEscaneados).toBe(3);
    expect(resumen.totalDetectados).toBe(2);
    expect(resumen.detectados.map((d) => d.docente.id)).toEqual(['2', '3']);
  });
});

describe('Mesa de Movilidad SLEP - Egresos Proyectados y Vacantes Condicionales', () => {
  it('bloquea liberación de vacante en Art. 19 S cuando existe excepción de jubilación <= 3 años', () => {
    const res = evaluarEgresoProyectado({
      causal: 'art_19s_no_avance',
      certeza: 'confirmado',
      excepcionJubilacion3Anios: true,
      fechaCese: '2027-02-28',
      numeroDecreto: 'DEC-102',
      horasLiberadas: 44,
    });

    expect(res.liberaVacante).toBe(false);
    expect(res.esVacanteCondicional).toBe(false);
    expect(res.permiteCoberturaTransitoria).toBe(false);
    expect(res.permiteConsolidacionDefinitiva).toBe(false);
    expect(res.impactoPresupuestarioSugerido).toBe('sin_impacto_doble');
    expect(res.motivoBloqueoDefinitivo).toContain('3 años');
  });

  it('libera vacante definitiva en Art. 19 S sin excepción de jubilación, confirmado, con decreto y cpeipNotificacionFirme', () => {
    const res = evaluarEgresoProyectado({
      causal: 'art_19s_no_avance',
      certeza: 'confirmado',
      excepcionJubilacion3Anios: false,
      cpeipNotificacionFirme: true,
      fechaCese: '2027-02-28',
      numeroDecreto: 'RES-889/2026',
      horasLiberadas: 38,
    });

    expect(res.liberaVacante).toBe(true);
    expect(res.esVacanteCondicional).toBe(false);
    expect(res.permiteCoberturaTransitoria).toBe(true);
    expect(res.permiteConsolidacionDefinitiva).toBe(true);
    expect(res.impactoPresupuestarioSugerido).toBe('sin_impacto_doble');
  });

  it('mantiene Art. 19 S como vacante condicional y bloquea consolidación definitiva si falta cpeipNotificacionFirme', () => {
    const res = evaluarEgresoProyectado({
      causal: 'art_19s_no_avance',
      certeza: 'confirmado',
      excepcionJubilacion3Anios: false,
      fechaCese: '2027-02-28',
      numeroDecreto: 'RES-889/2026',
      horasLiberadas: 38,
    });

    expect(res.liberaVacante).toBe(true);
    expect(res.esVacanteCondicional).toBe(true);
    expect(res.permiteCoberturaTransitoria).toBe(true);
    expect(res.permiteConsolidacionDefinitiva).toBe(false);
    expect(res.impactoPresupuestarioSugerido).toBe('costo_doble_pendiente');
    expect(res.motivoBloqueoDefinitivo).toContain(
      'Notificación CPEIP firme / plazo de reposición vencido'
    );
    expect(res.alertasNormativas.join(' ')).toContain(
      'Notificación CPEIP firme / plazo de reposición vencido'
    );
  });

  it('trata egreso en_tramite como Vacante Condicional: permite contrata transitoria, bloquea titularidad definitiva', () => {
    const egresoEnTramite = {
      causal: 'salud_incompatible_180d' as const,
      certeza: 'en_tramite' as const,
      horasLiberadas: 30,
    };

    const evalJur = evaluarEgresoProyectado(egresoEnTramite);
    expect(evalJur.liberaVacante).toBe(true);
    expect(evalJur.esVacanteCondicional).toBe(true);
    expect(evalJur.permiteCoberturaTransitoria).toBe(true);
    expect(evalJur.permiteConsolidacionDefinitiva).toBe(false);
    expect(evalJur.impactoPresupuestarioSugerido).toBe('con_recuperacion_sil');

    // Bloquea consolidación definitiva
    const valDef = validarConsolidacionSobreEgreso(
      egresoEnTramite,
      'CONTRATA',
      'DEFINITIVA'
    );
    expect(valDef.permitido).toBe(false);
    expect(valDef.motivoBloqueo).toContain('PAL 2027 / GDP');

    // Bloquea ingreso de docente TITULAR incluso si la cobertura se marca transitoria
    const valTitular = validarConsolidacionSobreEgreso(
      egresoEnTramite,
      'TITULAR',
      'TRANSITORIA_CONDICIONAL'
    );
    expect(valTitular.permitido).toBe(false);

    // Permite cobertura transitoria con docente a contrata
    const valTransitoria = validarConsolidacionSobreEgreso(
      egresoEnTramite,
      'CONTRATA',
      'TRANSITORIA_CONDICIONAL'
    );
    expect(valTransitoria.permitido).toBe(true);
  });

  it('marca como condicional un egreso confirmado al que le falta fecha de cese o decreto', () => {
    const res = evaluarEgresoProyectado({
      causal: 'renuncia_voluntaria',
      certeza: 'confirmado',
      fechaCese: '2027-03-01',
      numeroDecreto: '',
      horasLiberadas: 22,
    });

    expect(res.liberaVacante).toBe(true);
    expect(res.esVacanteCondicional).toBe(true);
    expect(res.permiteCoberturaTransitoria).toBe(true);
    expect(res.permiteConsolidacionDefinitiva).toBe(false);
    expect(res.alertasNormativas.join(' ')).toContain('decreto');
  });
});

describe('Mesa de Movilidad SLEP - Motor de Calce Territorial y Minutos Enteros', () => {
  it('valida tope multi-escuela SLEP en minutos enteros (20h + 24h = 2640 válido; 20h + 26h = 2760 bloqueado)', () => {
    const calceValido = evaluarCalceDocenteVacante({
      docenteId: 'doc-1',
      calidadJuridica: 'CONTRATA',
      asignaturaDocente: 'Matemática',
      horasContratoActual: 20,
      horasOtrosEstablecimientos: 20,
      fuenteOrigen: 'SUBVENCION_GENERAL',
      comunaOrigen: 'Chillán',
      carril: 'HORAS_REMANENTES',
      esTrasladoCompleto: false,
      vacanteId: 'vac-1',
      rbdDestino: '4002',
      horasVacante: 24,
      horasPedagogicasVacante: 20,
      asignaturaVacante: 'Matemática',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 70,
      comunaDestino: 'Chillán Viejo',
    });

    expect(calceValido.minutosOtros).toBe(1200);
    expect(calceValido.minutosVacante).toBe(1440);
    expect(calceValido.minutosTotalesMultiEscuela).toBe(TOPE_MINUTOS_SEMANALES_SLEP);
    expect(calceValido.excedeTope44h).toBe(false);
    expect(calceValido.bloqueaConsolidacion).toBe(false);

    const calceExcedido = evaluarCalceDocenteVacante({
      docenteId: 'doc-1',
      calidadJuridica: 'CONTRATA',
      asignaturaDocente: 'Matemática',
      horasContratoActual: 20,
      horasOtrosEstablecimientos: 20,
      fuenteOrigen: 'SUBVENCION_GENERAL',
      comunaOrigen: 'Chillán',
      carril: 'HORAS_REMANENTES',
      esTrasladoCompleto: false,
      vacanteId: 'vac-2',
      rbdDestino: '4002',
      horasVacante: 26,
      horasPedagogicasVacante: 22,
      asignaturaVacante: 'Matemática',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 70,
      comunaDestino: 'Chillán Viejo',
    });

    expect(calceExcedido.minutosTotalesMultiEscuela).toBe(2760);
    expect(calceExcedido.excedeTope44h).toBe(true);
    expect(calceExcedido.bloqueaConsolidacion).toBe(true);
    expect(calceExcedido.motivoBloqueo).toContain('2760');
  });

  it('aplica regímenes 65/35 y 60/40 junto con tope Art. 69 (máx 32 HA = 1440 min lectivos)', () => {
    const art69Ok = evaluarCalceDocenteVacante({
      docenteId: 'doc-art69',
      calidadJuridica: 'TITULAR',
      asignaturaDocente: 'Lenguaje',
      aplicaArticulo69: true,
      horasContratoActual: 44,
      horasTitularesActuales: 44,
      esTrasladoCompleto: true,
      vacanteId: 'vac-6535',
      rbdDestino: '4003',
      horasVacante: 44,
      horasPedagogicasVacante: 32,
      asignaturaVacante: 'Lenguaje y Comunicación',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 65,
      nivelCicloDestino: '7° Básico',
    });

    expect(art69Ok.regimenDestino).toBe('65_35');
    expect(art69Ok.horasPedagogicasMaximasDestino).toBe(32);
    expect(art69Ok.minutosLectivosMaximosDestino).toBe(MAX_MINUTOS_LECTIVOS_ART_69);
    expect(art69Ok.excedeTopeArt69).toBe(false);
    expect(art69Ok.bloqueaConsolidacion).toBe(false);

    const art69Excedido = evaluarCalceDocenteVacante({
      docenteId: 'doc-art69',
      calidadJuridica: 'TITULAR',
      asignaturaDocente: 'Lenguaje',
      aplicaArticulo69: true,
      horasContratoActual: 44,
      horasTitularesActuales: 44,
      esTrasladoCompleto: true,
      vacanteId: 'vac-6040',
      rbdDestino: '4004',
      horasVacante: 44,
      horasPedagogicasVacante: 34,
      asignaturaVacante: 'Lenguaje',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 85,
      nivelCicloDestino: '2° Básico',
    });

    expect(art69Excedido.regimenDestino).toBe('60_40');
    expect(art69Excedido.horasPedagogicasMaximasDestino).toBe(32);
    expect(art69Excedido.minutosLectivosMaximosDestino).toBe(1440);
    expect(art69Excedido.excedeTopeArt69).toBe(true);
    expect(art69Excedido.bloqueaConsolidacion).toBe(true);
  });

  it('protege Art. 42 no menoscabo titular (38h titular -> vacante 30h genera alerta y bloquea consolidación)', () => {
    const menoscabo = evaluarCalceDocenteVacante({
      docenteId: 'doc-tit',
      calidadJuridica: 'TITULAR',
      asignaturaDocente: 'Historia',
      horasContratoActual: 38,
      horasTitularesActuales: 38,
      fuenteOrigen: 'SUBVENCION_GENERAL',
      carril: 'NO_CONTINUIDAD_TITULAR',
      esTrasladoCompleto: true,
      vacanteId: 'vac-30',
      rbdDestino: '4005',
      horasVacante: 30,
      horasPedagogicasVacante: 26,
      asignaturaVacante: 'Historia, Geografía y Ciencias Sociales',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 60,
      nivelCicloDestino: '8° Básico',
    });

    expect(menoscabo.alertaMenoscaboArt42).toBe(true);
    expect(menoscabo.deficitMinutosTitulares).toBe(480); // 8h * 60
    expect(menoscabo.bloqueaConsolidacion).toBe(true);
    expect(menoscabo.motivoBloqueo).toContain('Art. 42');
  });

  it('levanta alerta financiera SEP/PIE sin bloquear simulación cuando titular Subv. General pasa a SEP o PIE', () => {
    const calceSep = evaluarCalceDocenteVacante({
      docenteId: 'doc-tit-sep',
      calidadJuridica: 'TITULAR',
      asignaturaDocente: 'Matemática',
      horasContratoActual: 30,
      horasTitularesActuales: 30,
      fuenteOrigen: 'SUBVENCION_GENERAL',
      carril: 'TRASLADO_VOLUNTARIO',
      esTrasladoCompleto: true,
      vacanteId: 'vac-sep',
      rbdDestino: '4006',
      horasVacante: 30,
      horasPedagogicasVacante: 24,
      asignaturaVacante: 'Matemática',
      fuenteDestino: 'SEP',
      porcentajePrioritariosDestino: 82,
    });

    expect(calceSep.regimenDestino).toBe('60_40');
    expect(calceSep.alertaFinanciamientoSepPie).toBe(true);
    expect(calceSep.bloqueaConsolidacion).toBe(false);
    expect(calceSep.alertasNormativas.some((a) => a.includes('SEP'))).toBe(true);

    // Verificar sobreasignación en régimen 60/40 (30h permite máx 24 HA; 26 HA bloquea)
    const calceSobre6040 = evaluarCalceDocenteVacante({
      docenteId: 'doc-sobre-6040',
      calidadJuridica: 'CONTRATA',
      asignaturaDocente: 'Matemática',
      horasContratoActual: 30,
      vacanteId: 'vac-sobre',
      rbdDestino: '4006',
      horasVacante: 30,
      horasPedagogicasVacante: 26,
      asignaturaVacante: 'Matemática',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 82,
    });
    expect(calceSobre6040.regimenDestino).toBe('60_40');
    expect(calceSobre6040.horasPedagogicasMaximasDestino).toBe(24);
    expect(calceSobre6040.esSobreasignadoDestino).toBe(true);
    expect(calceSobre6040.bloqueaConsolidacion).toBe(true);
  });

  it('calcula rúbrica ponderada de movilidad, proximidad simétrica en Ñuble y compatibilidad curricular', () => {
    const pNoCont = calcularPuntajePrioridadMovilidad({
      carril: 'NO_CONTINUIDAD_TITULAR',
      puntajeAntiguedad: 80,
    });
    const pVoluntario = calcularPuntajePrioridadMovilidad({
      carril: 'TRASLADO_VOLUNTARIO',
      puntajeLeyKarin: 100, // 30
      puntajeSalud: 80, // 20
      puntajeCuidadoDependientes: 50, // 10
      puntajeDistanciaRural: 40, // 6
      puntajeAntiguedad: 60, // 6
    });
    const pRemanentes = calcularPuntajePrioridadMovilidad({
      carril: 'HORAS_REMANENTES',
      horasRemanentes: 12,
    });

    expect(pNoCont).toBe(1040);
    expect(pVoluntario).toBe(72);
    expect(pRemanentes).toBe(24);
    expect(pNoCont).toBeGreaterThan(pVoluntario);
    expect(pNoCont).toBeGreaterThan(pRemanentes);

    // Simetría de matriz Valle Diguillín
    expect(MATRIZ_DISTANCIA_KM_VALLE_DIGUILLIN['Chillán']['Bulnes']).toBe(
      MATRIZ_DISTANCIA_KM_VALLE_DIGUILLIN['Bulnes']['Chillán']
    );
    expect(calcularPuntajeProximidadComuna('Chillán', 'Chillán')).toEqual({
      distanciaKm: 0,
      puntajeProximidad: 100,
    });
    expect(calcularPuntajeProximidadComuna('Chillan', 'Chillan Viejo')).toEqual({
      distanciaKm: 4,
      puntajeProximidad: 90,
    });
    expect(calcularPuntajeProximidadComuna('Chillán', 'Bulnes')).toEqual({
      distanciaKm: 26,
      puntajeProximidad: 75,
    });
    expect(calcularPuntajeProximidadComuna('Chillán', 'El Carmen')).toEqual({
      distanciaKm: 42,
      puntajeProximidad: 55,
    });
    expect(calcularPuntajeProximidadComuna('Chillán', 'Yungay')).toEqual({
      distanciaKm: 65,
      puntajeProximidad: 35,
    });
    expect(calcularPuntajeProximidadComuna('Chillán', 'Concepción')).toEqual({
      distanciaKm: -1,
      puntajeProximidad: 50,
    });

    // Compatibilidad de especialidad
    expect(evaluarCompatibilidadEspecialidad('Matemática', 'Matemática').puntaje).toBe(100);
    expect(evaluarCompatibilidadEspecialidad('Biología', 'Ciencias Naturales').puntaje).toBe(75);
    expect(evaluarCompatibilidadEspecialidad('Educación General Básica', 'Lenguaje').puntaje).toBe(55);
    expect(evaluarCompatibilidadEspecialidad('Educación Física', 'Inglés').puntaje).toBe(15);
  });

  it('genera vacante de rebote balanceada (deltaMinutosCadena === 0) y sugiere calces ordenados', () => {
    const rebote = generarVacanteDeRebote({
      rbdOrigen: '4010',
      nombreEstablecimientoOrigen: 'Escuela Los Tilines',
      horasTrasladadas: 30,
      asignaturaPrincipal: 'Matemática',
      fuenteFinanciamiento: 'SUBVENCION_GENERAL',
      asignacionesOrigen: [
        { curso: '7° Básico A', asignatura: 'Matemática', horasPedagogicas: 12 },
        { curso: '8° Básico A', asignatura: 'Matemática', horasPedagogicas: 12 },
      ],
      funcionesNoAulaOrigen: [
        { tipoFuncion: 'Jefatura de Departamento', horasCronologicas: 2, minutosSemanales: 120 },
      ],
    });

    expect(rebote.horasContratoRebote).toBe(30);
    expect(rebote.minutosContratoRebote).toBe(1800);
    expect(rebote.horasPedagogicasAula).toBe(24);
    expect(rebote.minutosLectivosAulaRebote).toBe(1080);
    expect(rebote.funcionesNoLectivasHeredadas).toHaveLength(1);
    expect(rebote.deltaMinutosCadena).toBe(0);
    expect(rebote.cadenaBalanceada).toBe(true);

    const sugerencias = sugerirCalcesAutomaticos(
      [
        {
          docenteId: 'vol-1',
          calidadJuridica: 'TITULAR',
          asignaturaDocente: 'Matemática',
          horasContratoActual: 30,
          horasTitularesActuales: 30,
          fuenteOrigen: 'SUBVENCION_GENERAL',
          comunaOrigen: 'Chillán',
          carril: 'TRASLADO_VOLUNTARIO',
          esTrasladoCompleto: true,
          prioridadMovilidad: { carril: 'TRASLADO_VOLUNTARIO', puntajeSalud: 80 },
        },
        {
          docenteId: 'nocont-1',
          calidadJuridica: 'TITULAR',
          asignaturaDocente: 'Matemática',
          horasContratoActual: 30,
          horasTitularesActuales: 30,
          fuenteOrigen: 'SUBVENCION_GENERAL',
          comunaOrigen: 'Bulnes',
          carril: 'NO_CONTINUIDAD_TITULAR',
          esTrasladoCompleto: true,
          prioridadMovilidad: { carril: 'NO_CONTINUIDAD_TITULAR', puntajeAntiguedad: 60 },
        },
        {
          docenteId: 'excedido-44',
          calidadJuridica: 'CONTRATA',
          asignaturaDocente: 'Matemática',
          horasContratoActual: 20,
          horasOtrosEstablecimientos: 20,
          fuenteOrigen: 'SUBVENCION_GENERAL',
          comunaOrigen: 'Chillán',
          carril: 'HORAS_REMANENTES',
          esTrasladoCompleto: false,
        },
      ],
      {
        vacanteId: 'vac-destino',
        rbdDestino: '4020',
        horasVacante: 30,
        horasPedagogicasVacante: 24,
        asignaturaVacante: 'Matemática',
        fuenteDestino: 'SUBVENCION_GENERAL',
        porcentajePrioritariosDestino: 68,
        comunaDestino: 'Chillán',
      },
      55
    );

    expect(sugerencias.map((s) => s.candidato.docenteId)).toEqual(['nocont-1', 'vol-1']);
  });

  it('Fase 1: desglosa minutosTitularesOrigen vs minutosContrataOrigen en Art. 42 y acumula minutosAdicionalesEscenario', () => {
    // Docente mixto: 30h Titular (1800 min) + 14h Contrata (840 min) = 44h -> pasa a vacante 30h (1800 min)
    const mixtoValido = evaluarCalceDocenteVacante({
      docenteId: 'doc-mixto-30-14',
      calidadJuridica: 'TITULAR',
      asignaturaDocente: 'Matemática',
      horasContratoActual: 44,
      horasTitularesActuales: 30,
      fuenteOrigen: 'SUBVENCION_GENERAL',
      carril: 'NO_CONTINUIDAD_TITULAR',
      esTrasladoCompleto: true,
      vacanteId: 'vac-30-tit',
      rbdDestino: '4015',
      horasVacante: 30,
      horasPedagogicasVacante: 24,
      asignaturaVacante: 'Matemática',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 70,
    });

    expect(mixtoValido.minutosTitularesOrigen).toBe(1800);
    expect(mixtoValido.minutosContrataOrigen).toBe(840);
    expect(mixtoValido.alertaMenoscaboArt42).toBe(false);
    expect(mixtoValido.deficitMinutosTitulares).toBe(0);
    expect(mixtoValido.bloqueaConsolidacion).toBe(false);
    expect(mixtoValido.alertasNormativas.join(' ')).toContain('840 min');
    expect(mixtoValido.alertasNormativas.join(' ')).toContain('28 de febrero');

    // Si la vacante es de 26h (< 30h titulares), sí bloquea Art. 42 por déficit de 240 min
    const mixtoMenoscabo = evaluarCalceDocenteVacante({
      docenteId: 'doc-mixto-30-14',
      calidadJuridica: 'MIXTO',
      asignaturaDocente: 'Matemática',
      horasContratoActual: 44,
      minutosTitularesOrigen: 1800,
      minutosContrataOrigen: 840,
      carril: 'TRASLADO_VOLUNTARIO',
      esTrasladoCompleto: true,
      vacanteId: 'vac-26',
      rbdDestino: '4015',
      horasVacante: 26,
      asignaturaVacante: 'Matemática',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 70,
    });
    expect(mixtoMenoscabo.alertaMenoscaboArt42).toBe(true);
    expect(mixtoMenoscabo.deficitMinutosTitulares).toBe(240);
    expect(mixtoMenoscabo.bloqueaConsolidacion).toBe(true);

    // Acumulación de minutosAdicionalesEscenario supera 2640 min y bloquea
    const acumuladoExcede = evaluarCalceDocenteVacante({
      docenteId: 'doc-esc',
      calidadJuridica: 'CONTRATA',
      asignaturaDocente: 'Lenguaje',
      horasContratoActual: 20,
      horasOtrosEstablecimientos: 20,
      minutosAdicionalesEscenario: 300,
      esTrasladoCompleto: false,
      vacanteId: 'vac-20',
      rbdDestino: '4016',
      horasVacante: 20,
      asignaturaVacante: 'Lenguaje',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 65,
    });
    expect(acumuladoExcede.minutosAdicionalesEscenario).toBe(300);
    expect(acumuladoExcede.minutosTotalesMultiEscuela).toBe(2700);
    expect(acumuladoExcede.excedeTope44h).toBe(true);
    expect(acumuladoExcede.bloqueaConsolidacion).toBe(true);
  });

  it('Fase 1: separa especialidades Técnico-Profesionales MINEDUC sin falsos positivos ni colisiones con HC', () => {
    const incompatiblesTp = evaluarCompatibilidadEspecialidad(
      'TP Gastronomía',
      'TP Mecánica Automotriz'
    );
    expect(incompatiblesTp.puntaje).toBe(10);
    expect(incompatiblesTp.coincide).toBe(false);
    expect(incompatiblesTp.requiereHomologacionTp).toBe(true);
    expect(incompatiblesTp.motivo).toContain('sectores económicos MINEDUC distintos');

    const genericaTp = evaluarCompatibilidadEspecialidad(
      'Técnico Profesional',
      'TP Electricidad'
    );
    expect(genericaTp.puntaje).toBe(25);
    expect(genericaTp.coincide).toBe(false);
    expect(genericaTp.requiereHomologacionTp).toBe(true);

    const exactaTp = evaluarCompatibilidadEspecialidad(
      'TP Electricidad',
      'TP Electricidad'
    );
    expect(exactaTp.puntaje).toBe(100);
    expect(exactaTp.coincide).toBe(true);

    const afinTp = evaluarCompatibilidadEspecialidad(
      'Ingeniero Eléctrico',
      'TP Electricidad'
    );
    expect(afinTp.puntaje).toBe(90);
    expect(afinTp.coincide).toBe(true);

    // Resguarda HC Tecnología vs TP Programación/Electricidad y Educadora de Párvulos vs TP Atención de Párvulos
    expect(
      evaluarCompatibilidadEspecialidad('Profesor de Tecnología', 'TP Electricidad').coincide
    ).toBe(false);
    expect(
      evaluarCompatibilidadEspecialidad('Educación Tecnológica', 'Tecnología').coincide
    ).toBe(true);
    expect(
      evaluarCompatibilidadEspecialidad('Técnico en Párvulos', 'Educadora de Párvulos').coincide
    ).toBe(false);
    expect(
      evaluarCompatibilidadEspecialidad('Educadora de Párvulos', 'Educación Parvularia').coincide
    ).toBe(true);
  });

  it('Fase 2: detecta menoscabo económico Art. 50 (EXPERTO_I) y Condiciones Difíciles sin bloquear pero exigiendo validación jurídica', () => {
    const evalMenoscabo = evaluarCalceDocenteVacante({
      docenteId: 'doc-exp1',
      calidadJuridica: 'TITULAR',
      asignaturaDocente: 'Historia',
      horasContratoActual: 30,
      horasTitularesActuales: 30,
      porcentajePrioritariosOrigen: 85,
      tramoCarreraDocente: 'EXPERTO_I',
      condicionesDificilesOrigenPct: 12,
      condicionesDificilesDestinoPct: 0,
      carril: 'NO_CONTINUIDAD_TITULAR',
      esTrasladoCompleto: true,
      vacanteId: 'vac-urb',
      rbdDestino: '4030',
      horasVacante: 30,
      horasPedagogicasVacante: 24,
      asignaturaVacante: 'Historia',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 55,
    });

    expect(evalMenoscabo.alertaMenoscaboEconomicoArt50).toBe(true);
    expect(evalMenoscabo.alertaCondicionesDificiles).toBe(true);
    expect(evalMenoscabo.requiereValidacionJuridicaMenoscabo).toBe(true);
    expect(evalMenoscabo.bloqueaConsolidacion).toBe(false);
    expect(evalMenoscabo.alertasNormativas.join(' ')).toContain('Art. 50');
    expect(evalMenoscabo.alertasNormativas.join(' ')).toContain('Condiciones Difíciles');

    // Sin tramo informado y baja desde >=60%: alerta preventiva
    const evalPreventivo = evaluarCalceDocenteVacante({
      docenteId: 'doc-sin-tramo',
      calidadJuridica: 'TITULAR',
      asignaturaDocente: 'Historia',
      horasContratoActual: 30,
      porcentajePrioritariosOrigen: 65,
      esTrasladoCompleto: true,
      vacanteId: 'vac-urb-2',
      rbdDestino: '4031',
      horasVacante: 30,
      asignaturaVacante: 'Historia',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 45,
    });
    expect(evalPreventivo.alertaMenoscaboEconomicoArt50).toBe(false);
    expect(evalPreventivo.alertasNormativas.join(' ')).toContain('CPEIP');
  });

  it('Fase 2: aplica Habilitación SEREMI Decreto N° 352/2003 atada al RBD de origen en traslados a otro RBD', () => {
    const sinMencionCompatible = evaluarCalceDocenteVacante({
      docenteId: 'doc-seremi',
      calidadJuridica: 'CONTRATA',
      rbdOrigen: '4001',
      asignaturaDocente: 'Física',
      tituloMencionOficial: 'Profesor de Matemática',
      requiereAutorizacionDocente: true,
      habilitacionSeremiRbd: '4001',
      habilitacionSeremiAsignatura: 'Física',
      horasContratoActual: 30,
      esTrasladoCompleto: true,
      vacanteId: 'vac-fis-otro-rbd',
      rbdDestino: '4002',
      horasVacante: 30,
      asignaturaVacante: 'Física',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 70,
    });

    expect(sinMencionCompatible.alertaHabilitacionSeremiDto352).toBe(true);
    expect(sinMencionCompatible.coincideEspecialidad).toBe(false);
    expect(sinMencionCompatible.puntajeIdoneidad).toBeLessThanOrEqual(35);
    expect(sinMencionCompatible.alertasNormativas.join(' ')).toContain('352/2003');

    // Si postula a su mención oficial (Matemática) en otro RBD, no salta alerta Dto. 352
    const conMencionOficial = evaluarCalceDocenteVacante({
      docenteId: 'doc-seremi',
      calidadJuridica: 'CONTRATA',
      rbdOrigen: '4001',
      asignaturaDocente: 'Física',
      tituloMencionOficial: 'Profesor de Matemática',
      requiereAutorizacionDocente: true,
      habilitacionSeremiRbd: '4001',
      horasContratoActual: 30,
      esTrasladoCompleto: true,
      vacanteId: 'vac-mat-otro-rbd',
      rbdDestino: '4002',
      horasVacante: 30,
      asignaturaVacante: 'Matemática',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 70,
    });

    expect(conMencionOficial.alertaHabilitacionSeremiDto352).toBe(false);
    expect(conMencionOficial.coincideEspecialidad).toBe(true);
    expect(conMencionOficial.puntajeIdoneidad).toBe(100);
  });

  it('Fase 2: bloquea itinerancia rural inviable entre dos establecimientos rural_aislado con contrato compartido', () => {
    const ruralBloqueado = evaluarCalceDocenteVacante({
      docenteId: 'doc-rural',
      calidadJuridica: 'TITULAR',
      rbdOrigen: '4050',
      accesibilidadOrigen: 'rural_aislado',
      comunaOrigen: 'El Carmen',
      asignaturaDocente: 'Educación General Básica',
      horasContratoActual: 20,
      horasConservadasEnOrigen: 20,
      esTrasladoCompleto: false,
      vacanteId: 'vac-rural-2',
      rbdDestino: '4051',
      accesibilidadDestino: 'rural_aislado',
      comunaDestino: 'El Carmen',
      horasVacante: 20,
      asignaturaVacante: 'Matemática',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 85,
    });

    expect(ruralBloqueado.alertaItineranciaRural).toBe(true);
    expect(ruralBloqueado.bloqueaConsolidacion).toBe(true);
    expect(ruralBloqueado.motivoBloqueo).toContain('rurales aislados');

    // Mixto (urbano + rural_aislado) alerta y limita proximidad a <= 30 sin bloquear por defecto
    const ruralAlerta = evaluarCalceDocenteVacante({
      docenteId: 'doc-rural-mix',
      calidadJuridica: 'CONTRATA',
      rbdOrigen: '4050',
      accesibilidadOrigen: 'rural_aislado',
      comunaOrigen: 'Chillán',
      asignaturaDocente: 'Matemática',
      horasContratoActual: 20,
      horasOtrosEstablecimientos: 20,
      esTrasladoCompleto: false,
      vacanteId: 'vac-urb-comp',
      rbdDestino: '4052',
      accesibilidadDestino: 'urbano',
      comunaDestino: 'Chillán',
      horasVacante: 20,
      asignaturaVacante: 'Matemática',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 70,
    });

    expect(ruralAlerta.alertaItineranciaRural).toBe(true);
    expect(ruralAlerta.bloqueaConsolidacion).toBe(false);
    expect(ruralAlerta.puntajeProximidad).toBeLessThanOrEqual(30);
  });

  it('Fase 2: detecta funciones no lectivas intransferibles al generar vacante de rebote', () => {
    const reboteConFunciones = generarVacanteDeRebote({
      rbdOrigen: '4060',
      horasTrasladadas: 44,
      asignaturaPrincipal: 'Matemática',
      fuenteFinanciamiento: 'SUBVENCION_GENERAL',
      funcionesNoAulaOrigen: [
        { tipoFuncion: 'UTP', descripcion: 'Jefatura UTP', horasCronologicas: 20 },
        { tipoFuncion: 'CONVIVENCIA', descripcion: 'Encargado Convivencia Escolar', horasCronologicas: 10 },
        { tipoFuncion: 'DOCENTE', descripcion: 'Coordinación PIE', horasCronologicas: 6 },
        { tipoFuncion: 'ATENCION_APODERADOS', descripcion: 'Atención Apoderados', horasCronologicas: 2 },
      ],
    });

    expect(reboteConFunciones.funcionesIntransferiblesDetectadas).toHaveLength(3);
    expect(reboteConFunciones.funcionesIntransferiblesDetectadas.join(' ')).toContain('UTP');
    expect(reboteConFunciones.funcionesIntransferiblesDetectadas.join(' ')).toContain('Convivencia');
    expect(reboteConFunciones.funcionesIntransferiblesDetectadas.join(' ')).toContain('Coordinación PIE');
  });

  it('Fase 2: evalúa calce para Asistentes de la Educación (Ley 21.109) con tope 44h/45h, indefinido y estamento', () => {
    // Mixto 30h Indefinido + 14h Plazo Fijo pasando a vacante 30h mismo estamento
    const asisValido = evaluarCalceAsistenteLey21109({
      asistenteId: 'asis-1',
      calidadJuridica: 'INDEFINIDO',
      estamentoOrigen: 'TECNICO',
      cargoFuncionOrigen: 'Técnico en Párvulos',
      horasContratoActual: 44,
      horasIndefinidasActuales: 30,
      carril: 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO',
      esTrasladoCompleto: true,
      topeHorasSemanales: 44,
      vacanteId: 'vac-asis-1',
      rbdDestino: '4070',
      estamentoVacante: 'TECNICO',
      cargoFuncionVacante: 'Técnico en Párvulos',
      horasVacante: 30,
      fuenteDestino: 'SUBVENCION_GENERAL',
      comunaOrigen: 'Chillán',
      comunaDestino: 'Chillán',
    });

    expect(asisValido.topeMinutosSemanal).toBe(2640);
    expect(asisValido.minutosIndefinidosOrigen).toBe(1800);
    expect(asisValido.minutosPlazoFijoOrigen).toBe(840);
    expect(asisValido.alertaMenoscaboIndefinido).toBe(false);
    expect(asisValido.degradacionEstamento).toBe(false);
    expect(asisValido.bloqueaConsolidacion).toBe(false);
    expect(asisValido.indiceCompatibilidad).toBeGreaterThanOrEqual(80);

    // Tope 45h (2700 min) permite 20h + 25h = 2700 min sin bloquear
    const asis45 = evaluarCalceAsistenteLey21109({
      asistenteId: 'asis-45',
      calidadJuridica: 'PLAZO_FIJO',
      estamentoOrigen: 'AUXILIAR',
      horasContratoActual: 20,
      horasOtrosEstablecimientos: 20,
      esTrasladoCompleto: false,
      topeHorasSemanales: 45,
      vacanteId: 'vac-asis-25',
      rbdDestino: '4071',
      estamentoVacante: 'AUXILIAR',
      horasVacante: 25,
      fuenteDestino: 'SUBVENCION_GENERAL',
    });
    expect(asis45.topeMinutosSemanal).toBe(2700);
    expect(asis45.minutosTotalesMultiEscuela).toBe(2700);
    expect(asis45.excedeTopeSemanal).toBe(false);
    expect(asis45.bloqueaConsolidacion).toBe(false);

    // Degradación PROFESIONAL -> AUXILIAR y déficit indefinido bloquean
    const asisDegradado = evaluarCalceAsistenteLey21109({
      asistenteId: 'asis-prof',
      calidadJuridica: 'INDEFINIDO',
      estamentoOrigen: 'PROFESIONAL',
      horasContratoActual: 40,
      horasIndefinidasActuales: 40,
      carril: 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO',
      esTrasladoCompleto: true,
      vacanteId: 'vac-aux',
      rbdDestino: '4072',
      estamentoVacante: 'AUXILIAR',
      horasVacante: 30,
      fuenteDestino: 'SUBVENCION_GENERAL',
    });
    expect(asisDegradado.degradacionEstamento).toBe(true);
    expect(asisDegradado.alertaMenoscaboIndefinido).toBe(true);
    expect(asisDegradado.deficitMinutosIndefinidos).toBe(600);
    expect(asisDegradado.bloqueaConsolidacion).toBe(true);

    // Discrepancia ADMINISTRATIVO vs PARADOCENTE_INSPECTORIA en carril obligatorio bloquea
    const asisDiscrepancia = evaluarCalceAsistenteLey21109({
      asistenteId: 'asis-adm',
      calidadJuridica: 'INDEFINIDO',
      estamentoOrigen: 'ADMINISTRATIVO',
      horasContratoActual: 44,
      horasIndefinidasActuales: 44,
      carril: 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO',
      esTrasladoCompleto: true,
      vacanteId: 'vac-insp',
      rbdDestino: '4073',
      estamentoVacante: 'PARADOCENTE_INSPECTORIA',
      horasVacante: 44,
      fuenteDestino: 'SUBVENCION_GENERAL',
    });
    expect(asisDiscrepancia.estamentoCompatible).toBe(false);
    expect(asisDiscrepancia.bloqueaConsolidacion).toBe(true);
  });

  it('Fase 3: Algoritmo Húngaro (Kuhn-Munkres) supera al algoritmo greedy y resuelve 2ª pasada sobre rebotes', () => {
    const candidatos = [
      {
        docenteId: 'doc-A-30h',
        calidadJuridica: 'TITULAR',
        asignaturaDocente: 'Matemática',
        horasContratoActual: 30,
        horasTitularesActuales: 30,
        rbdOrigen: '4001',
        comunaOrigen: 'Chillán',
        carril: 'NO_CONTINUIDAD_TITULAR' as const,
        esTrasladoCompleto: true,
        rbdDestinoPreferente: '4010',
        prioridadMovilidad: { carril: 'NO_CONTINUIDAD_TITULAR' as const, puntajeAntiguedad: 80 },
      },
      {
        docenteId: 'doc-B-38h',
        calidadJuridica: 'TITULAR',
        asignaturaDocente: 'Matemática',
        horasContratoActual: 38,
        horasTitularesActuales: 38,
        rbdOrigen: '4002',
        comunaOrigen: 'Chillán',
        carril: 'TRASLADO_VOLUNTARIO' as const,
        esTrasladoCompleto: true,
        prioridadMovilidad: {
          carril: 'TRASLADO_VOLUNTARIO' as const,
          puntajeLeyKarin: 100,
          puntajeSalud: 100,
          puntajeCuidadoDependientes: 100,
          puntajeDistanciaRural: 100,
          puntajeAntiguedad: 100,
        },
      },
      {
        docenteId: 'doc-C-rebote',
        calidadJuridica: 'CONTRATA',
        asignaturaDocente: 'Matemática',
        horasContratoActual: 30,
        rbdOrigen: '4003',
        comunaOrigen: 'Chillán',
        carril: 'TRASLADO_VOLUNTARIO' as const,
        esTrasladoCompleto: true,
        rbdDestinoPreferente: '4001',
        prioridadMovilidad: { carril: 'TRASLADO_VOLUNTARIO' as const, puntajeAntiguedad: 10 },
      },
    ];

    const vacantes = [
      {
        vacanteId: 'vac-38h',
        rbdDestino: '4010',
        horasVacante: 38,
        horasPedagogicasVacante: 28,
        asignaturaVacante: 'Matemática',
        fuenteDestino: 'SUBVENCION_GENERAL' as const,
        porcentajePrioritariosDestino: 70,
        comunaDestino: 'Chillán',
      },
      {
        vacanteId: 'vac-30h',
        rbdDestino: '4020',
        horasVacante: 30,
        horasPedagogicasVacante: 24,
        asignaturaVacante: 'Matemática',
        fuenteDestino: 'SUBVENCION_GENERAL' as const,
        porcentajePrioritariosDestino: 70,
        comunaDestino: 'Chillán',
      },
    ];

    // Greedy asignaría doc-A-30h -> vac-38h (por bono rbdDestinoPreferente: '4010'),
    // dejando a doc-B-38h bloqueado por Art. 42 en vac-30h (solo 1 asignación).
    // Húngaro asigna doc-A-30h -> vac-30h y doc-B-38h -> vac-38h (2 asignaciones óptimas).
    const optimas = resolverCalceOptimoBipartito(candidatos.slice(0, 2), vacantes, 55);
    expect(optimas).toHaveLength(2);
    const mapaOpt = new Map(optimas.map((a) => [a.candidato.docenteId, a.vacante.vacanteId]));
    expect(mapaOpt.get('doc-A-30h')).toBe('vac-30h');
    expect(mapaOpt.get('doc-B-38h')).toBe('vac-38h');

    // Con cadenas de rebote en 2ª pasada: doc-C-rebote cubre rebote_auto_doc-A-30h (30h en RBD 4001)
    const cadena = resolverCalceOptimoConCadenasRebote(candidatos, vacantes, 55);
    expect(cadena.asignacionesPasada1).toHaveLength(2);
    expect(cadena.rebotesGeneradosIds).toContain('rebote_auto_doc-A-30h');
    expect(cadena.rebotesGeneradosIds).toContain('rebote_auto_doc-B-38h');
    expect(cadena.asignacionesPasada2Rebotes).toHaveLength(1);
    expect(cadena.asignacionesPasada2Rebotes[0].candidato.docenteId).toBe('doc-C-rebote');
    expect(cadena.asignacionesPasada2Rebotes[0].vacante.vacanteId).toBe('rebote_auto_doc-A-30h');
    expect(cadena.asignacionesPasada2Rebotes[0].esSegundaPasadaRebote).toBe(true);
    expect(cadena.rebotesCubiertosEnCadena).toBe(1);
  });
});
