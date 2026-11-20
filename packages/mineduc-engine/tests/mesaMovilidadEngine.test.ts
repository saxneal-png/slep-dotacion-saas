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
  generarVacanteDeRebote,
  sugerirCalcesAutomaticos,
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

  it('libera vacante definitiva en Art. 19 S sin excepción de jubilación, confirmado y con decreto', () => {
    const res = evaluarEgresoProyectado({
      causal: 'art_19s_no_avance',
      certeza: 'confirmado',
      excepcionJubilacion3Anios: false,
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
});
