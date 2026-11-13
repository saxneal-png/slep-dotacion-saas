import { describe, expect, it } from 'vitest';
import {
  calcularAforoFisicoSala,
  calcularCoberturaTurnosVtf,
  calcularRequerimientoNivelVtf,
  evaluarDotacionEstablecimientoVtf,
  obtenerAforoMaximoNormativo,
  obtenerPlanPorCurso,
  proyectarNivelesVtfSiguientePeriodo,
} from '../src';

describe('calculoCoeficienteVtf - Normativa D.S. 315/2010 & D.S. 115/2012', () => {
  it('calcula 1 técnico cada 7 lactantes y 1 educadora cada 42 en Sala Cuna', () => {
    const res = calcularRequerimientoNivelVtf({
      id: 'sc-1',
      nivelNombre: 'Sala Cuna Heterogénea',
      subtipoNivel: 'SALA_CUNA_HETEROGENEA',
      matriculaActiva: 18,
      capacidadAutorizada: 20,
      edadMesesMin: 6,
      edadMesesMax: 21,
    });

    expect(res.educadorasRequeridasGrupo).toBe(1);
    expect(res.tecnicosRequeridosGrupo).toBe(3); // ceil(18/7) = 3
    expect(res.alertaSobrecupoOperativo).toBe(false);
  });

  it('aplica criterio del niño de menor edad en Nivel Medio Mixto con lactante <24m', () => {
    const res = calcularRequerimientoNivelVtf({
      id: 'mm-1',
      nivelNombre: 'Nivel Medio Mixto',
      subtipoNivel: 'MEDIO_HETEROGENEO',
      matriculaActiva: 15,
      capacidadAutorizada: 28,
      edadMesesMin: 20,
      edadMesesMax: 42,
    });

    expect(res.reglaEdadMinimaAplicada).toBe(true);
    expect(res.subtipoEfectivoPorEdad).toBe('SALA_CUNA_HETEROGENEA');
    expect(res.tecnicosRequeridosGrupo).toBe(3); // ceil(15/7) por lactante < 24m
  });

  it('aplica 1 técnico cada 25 en Medio Menor y 1 cada 32 en Medio Mayor', () => {
    const mm = calcularRequerimientoNivelVtf({
      id: 'med-menor',
      nivelNombre: 'Nivel Medio Menor',
      matriculaActiva: 26,
    });
    expect(mm.tecnicosRequeridosGrupo).toBe(2); // ceil(26/25)

    const may = calcularRequerimientoNivelVtf({
      id: 'med-mayor',
      nivelNombre: 'Nivel Medio Mayor',
      matriculaActiva: 30,
    });
    expect(may.tecnicosRequeridosGrupo).toBe(1); // ceil(30/32)
  });

  it('consolida evaluación VTF de jardín infantil completo con déficits y cobertura de turnos', () => {
    const diag = evaluarDotacionEstablecimientoVtf({
      rbd: '34591',
      niveles: [
        {
          id: 'g1',
          nivelNombre: 'Sala Cuna Heterogénea',
          matriculaActiva: 14,
          capacidadAutorizada: 20,
          edadMesesMin: 4,
          tieneExtensionHoraria: true,
          matriculaExtension: 6,
        },
        {
          id: 'g2',
          nivelNombre: 'Nivel Medio Mixto',
          matriculaActiva: 25,
          capacidadAutorizada: 28,
          edadMesesMin: 26,
          tieneExtensionHoraria: true,
          matriculaExtension: 10,
        },
      ],
      personalVtf: {
        directoras: 1,
        educadoras: 2,
        tecnicos: 2, // necesita 2 SC + 1 Medio = 3
        otrosAsistentes: 2,
      },
      turnos: [
        { id: 't1', estamentoVtf: 'EDUCADORA', horaEntrada: '08:30', horaSalida: '17:30', horasSemanalesCronologicas: 44 },
        { id: 't2', estamentoVtf: 'TECNICO', horaEntrada: '08:30', horaSalida: '17:30', horasSemanalesCronologicas: 44 },
      ],
    });

    expect(diag.educadorasRequeridasTotal).toBe(2); // 1 SC + 1 Medio
    expect(diag.tecnicosRequeridosTotal).toBe(3); // ceil(14/7)=2 + ceil(25/25)=1
    expect(diag.deltaTecnicos).toBe(-1);
    expect(diag.cumpleCoeficienteDs115).toBe(false);
    expect(diag.coberturaTurnos?.tieneBrechaExtension).toBe(true);
  });

  it('proyecta promoción etaria +12 meses y egreso a NT1 Escuela', () => {
    const proy = proyectarNivelesVtfSiguientePeriodo([
      { edadMeses: 8, activo: true },   // -> 20m (SC Mayor)
      { edadMeses: 18, activo: true },  // -> 30m (Medio Menor)
      { edadMeses: 30, activo: true },  // -> 42m (Medio Mayor)
      { edadMeses: 40, activo: true },  // -> 52m (Egresa a NT1 Escuela)
      { edadMeses: 20, activo: false }, // retiro no se proyecta
    ]);

    expect(proy.matriculaActualActiva).toBe(4);
    expect(proy.proyectadosSalaCunaMayor).toBe(1);
    expect(proy.proyectadosMedioMenor).toBe(1);
    expect(proy.proyectadosMedioMayor).toBe(1);
    expect(proy.egresanANt1Escuela).toBe(1);
  });

  it('valida cobertura regular y extensión horaria 08:30-19:30', () => {
    const cob = calcularCoberturaTurnosVtf(
      [
        { id: 'e1', estamentoVtf: 'EDUCADORA', horaEntrada: '08:30', horaSalida: '16:30', horasSemanalesCronologicas: 40 },
        { id: 't1', estamentoVtf: 'TECNICO', horaEntrada: '08:30', horaSalida: '16:30', horasSemanalesCronologicas: 40 },
        { id: 't2', estamentoVtf: 'TECNICO', horaEntrada: '11:00', horaSalida: '19:30', horasSemanalesCronologicas: 42.5 },
      ],
      true
    );

    expect(cob.tieneBrechaRegular).toBe(false);
    expect(cob.tieneBrechaExtension).toBe(false);
  });

  it('asigna plan BCEP VTF correcto a Sala Cuna y Medio Menor/Mayor (no Educación Especial) y aforos OGUC/D.S. 548', () => {
    const planSc = obtenerPlanPorCurso('Sala Cuna Heterogénea', 'No JEC');
    const planMm = obtenerPlanPorCurso('Nivel Medio Menor', 'No JEC');
    const planMmix = obtenerPlanPorCurso('Nivel Medio Mixto', 'No JEC');
    expect(planSc?.nivel).toContain('Sala Cuna');
    expect(planMm?.nivel).toContain('Nivel Medio Menor');
    expect(planMm?.nivel).not.toContain('Especial');
    expect(planMm?.nivel).not.toContain('EPJA');
    expect(planMmix?.nivel).toContain('Nivel Medio Mixto');

    expect(obtenerAforoMaximoNormativo('Sala Cuna Mayor')).toBe(20);
    expect(obtenerAforoMaximoNormativo('Nivel Medio Mayor')).toBe(32);

    const aforoSc = calcularAforoFisicoSala(50, 'SALA_CUNA');
    expect(aforoSc.factorM2).toBe(2.5);
    expect(aforoSc.aforoMaximo).toBe(20);
  });
});
