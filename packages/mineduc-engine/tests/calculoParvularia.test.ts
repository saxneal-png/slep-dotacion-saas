import { describe, it, expect } from 'vitest';
import {
  CONSTANTES_PARVULARIA,
  esNivelParvulario,
  determinarPermanenciaParvularia,
  buscarContratoMinimoParvulariaPorMinutos,
  calcularDotacionParvulariaCurso,
  consolidarDotacionParvulariaEstablecimiento
} from '../src/calculoParvularia';

describe('Motor de Dotación en Educación Parvularia (Ley 20.903, DTO 306/2007, DTO 315)', () => {
  it('detecta correctamente los niveles y cursos parvularios', () => {
    expect(esNivelParvulario('NT1')).toBe(true);
    expect(esNivelParvulario('NT2 - Kínder')).toBe(true);
    expect(esNivelParvulario('Pre-Kínder A')).toBe(true);
    expect(esNivelParvulario('Nivel Heterogéneo Parvularia')).toBe(true);
    expect(esNivelParvulario('1° Básico')).toBe(false);
    expect(esNivelParvulario('4° Medio HC')).toBe(false);
  });

  it('calcula la permanencia cronológica de los párvulos según régimen y nivel', () => {
    // JECD según Decreto 306/2007: 35h 25m = 2.125 minutos
    expect(determinarPermanenciaParvularia('NT1', 'JEC')).toBe(2125);
    expect(determinarPermanenciaParvularia('Kínder', 'JEC')).toBe(2125);

    // Media Jornada sin JEC: NT1 = 22h (1.320 min), NT2 = 20h (1.200 min)
    expect(determinarPermanenciaParvularia('NT1', 'No JEC')).toBe(1320);
    expect(determinarPermanenciaParvularia('NT2', 'No JEC')).toBe(1200);
    expect(determinarPermanenciaParvularia('Parvularia General', 'No JEC')).toBe(1350);
  });

  describe('Cálculo de Déficit y Segunda Educadora en JECD', () => {
    it('Caso 1: Régimen 65/35 con Educadora Titular de 44h', () => {
      // Colegio < 60% prioritarios -> Régimen 65/35
      const res = calcularDotacionParvulariaCurso(
        { nivel: 'NT1 A', regimen: 'JEC', matriculaProyectada: 25 },
        40, // 40% prioritarios -> 65/35
        { horasContrato: 44 }
      );

      expect(res.regimenNormativoProporcion).toBe('65_35');
      expect(res.permanenciaMinutos).toBe(2125); // 35h 25m
      expect(res.minutosAulaTitular).toBe(1710); // 28h 30m
      expect(res.minutosDeficit).toBe(415); // 2125 - 1710 = 415 min (6h 55m)
      expect(res.segundaEducadoraRequerida).toBe(true);

      // En 65/35: 10h contrato = 405 min aula (< 415). 11h contrato = 450 min aula (>= 415).
      expect(res.horasContratoSegundaEducadora).toBe(11);
      expect(res.minutosAulaSegundaEducadora).toBe(450);
      expect(res.superavitMinutosAula).toBe(35); // 450 - 415 = 35 min
      expect(res.requiereTecnicoParvuloDto315).toBe(true); // matrícula 25 > 15
    });

    it('Caso 2: Régimen 60/40 obligatorio (Vulnerabilidad >= 60%) con Titular 44h', () => {
      // Colegio con 70% prioritarios -> En NT1/NT2 aplica 60/40 por Ley 20.903
      const res = calcularDotacionParvulariaCurso(
        { nivel: 'Kínder B', regimen: 'JEC', matriculaProyectada: 28 },
        70, // >= 60% prioritarios -> 60/40
        { horasContrato: 44 }
      );

      expect(res.regimenNormativoProporcion).toBe('60_40');
      expect(res.permanenciaMinutos).toBe(2125);
      // En 60/40, contrato 44h da 26h 15m = 1.575 min de aula directa
      expect(res.minutosAulaTitular).toBe(1575);
      // Déficit: 2.125 - 1.575 = 550 min (9h 10m)
      expect(res.minutosDeficit).toBe(550);
      expect(res.segundaEducadoraRequerida).toBe(true);

      // En 60/40: 15h = 540 min (< 550). 16h = 585 min (>= 550).
      expect(res.horasContratoSegundaEducadora).toBe(16);
      expect(res.minutosAulaSegundaEducadora).toBe(585);
      expect(res.superavitMinutosAula).toBe(35);
    });

    it('Caso 3: Titular con contrato parcial de 38h en régimen 60/40', () => {
      const res = calcularDotacionParvulariaCurso(
        { nivel: 'NT2', regimen: 'JEC', matriculaProyectada: 20 },
        65, // >= 60% prioritarios -> 60/40
        { horasContrato: 38 }
      );

      expect(res.regimenNormativoProporcion).toBe('60_40');
      // En 60/40, 38h contrato da 22h 30m = 1.350 min
      expect(res.minutosAulaTitular).toBe(1350);
      // Déficit: 2.125 - 1.350 = 775 min
      expect(res.minutosDeficit).toBe(775);

      // En 60/40: 21h = 765 min (< 775). 22h = 810 min (>= 775).
      expect(res.horasContratoSegundaEducadora).toBe(22);
      expect(res.minutosAulaSegundaEducadora).toBe(810);
    });

    it('Caso 4: Titular con Artículo 69 (rebaja a 24h cronológicas = 1.440 min)', () => {
      const res = calcularDotacionParvulariaCurso(
        { nivel: 'NT1', regimen: 'JEC', matriculaProyectada: 20 },
        40, // 65/35
        { horasContrato: 44, aplicaArticulo69: true }
      );

      // Sin Art. 69 daría 1.710 min, pero con Art. 69 se limita a 1.440 min
      expect(res.minutosAulaTitular).toBe(1440);
      // Déficit: 2.125 - 1.440 = 685 min
      expect(res.minutosDeficit).toBe(685);
      expect(res.advertenciasNormativas.some(a => a.includes('Art. 69'))).toBe(true);
    });

    it('Caso 4.1: Titular con contrato de 44h pero 6h deducibles por PIE y UTP (38h disponibles para aula)', () => {
      // Caso oficial del usuario: contrato 44h, 3h colab PIE + 3h coord UTP = 6h no aula -> 38h disponibles aula
      const res = calcularDotacionParvulariaCurso(
        { nivel: 'NT1', regimen: 'JEC', matriculaProyectada: 20 },
        40, // < 60% prioritarios -> Régimen 65/35
        { 
          horasContrato: 44, 
          horasNoAulaDeducibles: 6 
        }
      );

      expect(res.regimenNormativoProporcion).toBe('65_35');
      expect(res.horasContratoTitular).toBe(44);
      expect(res.horasDisponiblesAulaTitular).toBe(38);
      // En 65/35: 38h contrato da exactamente 1.485 minutos (24h 45m)
      expect(res.minutosAulaTitular).toBe(1485);
      // Déficit: 2.125 - 1.485 = 640 minutos (10h 40m)
      expect(res.minutosDeficit).toBe(640);
      expect(res.segundaEducadoraRequerida).toBe(true);

      // Ceil matching en 65/35: 16h = 630 min (< 640), 17h = 675 min (>= 640).
      expect(res.horasContratoSegundaEducadora).toBe(17);
      expect(res.minutosAulaSegundaEducadora).toBe(675);
      expect(res.superavitMinutosAula).toBe(35); // 675 - 640 = 35 min
    });

    it('Caso 5: Media Jornada (Sin JEC) no genera déficit con titular de 44h', () => {
      const resNt1 = calcularDotacionParvulariaCurso(
        { nivel: 'NT1', regimen: 'No JEC', matriculaProyectada: 18 },
        85, // 60/40
        { horasContrato: 44 }
      );
      expect(resNt1.permanenciaMinutos).toBe(1320);
      expect(resNt1.minutosAulaTitular).toBe(1575);
      expect(resNt1.minutosDeficit).toBe(0);
      expect(resNt1.segundaEducadoraRequerida).toBe(false);
      expect(resNt1.horasContratoSegundaEducadora).toBe(0);

      const resNt2 = calcularDotacionParvulariaCurso(
        { nivel: 'NT2', regimen: 'No JEC', matriculaProyectada: 18 },
        85,
        { horasContrato: 44 }
      );
      expect(resNt2.permanenciaMinutos).toBe(1200);
      expect(resNt2.minutosDeficit).toBe(0);
    });

    it('Caso 6: Validación de Técnico en Párvulos (TEP) por DTO 315', () => {
      const conTep = calcularDotacionParvulariaCurso(
        { nivel: 'NT1', regimen: 'JEC', matriculaProyectada: 22 },
        50,
        { horasContrato: 44 }
      );
      expect(conTep.requiereTecnicoParvuloDto315).toBe(true);
      expect(conTep.cantidadTecnicosSugeridos).toBe(1);

      const sinTep = calcularDotacionParvulariaCurso(
        { nivel: 'NT1 Rural', regimen: 'JEC', matriculaProyectada: 12 },
        50,
        { horasContrato: 44 }
      );
      expect(sinTep.requiereTecnicoParvuloDto315).toBe(false);
      expect(sinTep.cantidadTecnicosSugeridos).toBe(0);
    });

    it('Caso 7: Curso Combinado Heterogéneo rural unificado', () => {
      const res = calcularDotacionParvulariaCurso(
        { nivel: 'Nivel Heterogéneo Parvularia (NT1-NT2 Combinado)', regimen: 'JEC', matriculaProyectada: 14, esCombinado: true },
        90,
        { horasContrato: 44 }
      );
      expect(res.esCursoCombinado).toBe(true);
      expect(res.permanenciaMinutos).toBe(2125); // Una sola permanencia
      expect(res.advertenciasNormativas.some(a => a.includes('Combinado/Heterogéneo'))).toBe(true);
    });
  });

  describe('Consolidación Multicurso Establecimiento (Pool Co-docencia)', () => {
    it('consolida 2 cursos JEC en 60/40 y genera ahorro en contratación unificada', () => {
      const cursos = [
        { id: 'c1', nivel: 'NT1 A', regimen: 'JEC' as const, matriculaProyectada: 24 },
        { id: 'c2', nivel: 'NT2 A', regimen: 'JEC' as const, matriculaProyectada: 26 },
        { id: 'c3', nivel: '1° Básico', regimen: 'JEC' as const, matriculaProyectada: 30 } // No parvularia
      ];

      const titulares = new Map([
        ['c1', { horasContrato: 44 }],
        ['c2', { horasContrato: 44 }]
      ]);

      const consolidado = consolidarDotacionParvulariaEstablecimiento(
        cursos,
        85, // 60/40
        titulares
      );

      expect(consolidado.totalCursosParvularia).toBe(2);
      expect(consolidado.totalMatriculaParvularia).toBe(50);
      expect(consolidado.regimenPredominante).toBe('60_40');

      // Cada curso tiene déficit de 550 min (total 1.100 min)
      expect(consolidado.totalMinutosDeficit).toBe(1100);

      // En contratos aislados: 16h + 16h = 32 horas
      expect(consolidado.sumaContratosAisladosSegundaEducadoraHoras).toBe(32);

      // En Pool unificado de co-docencia:
      // Para cubrir 1.100 min en 60/40:
      // 30h = 1080 min (< 1100). 31h = 1125 min (>= 1100).
      expect(consolidado.contratoSugeridoPoolSegundaEducadoraHoras).toBe(31);
      expect(consolidado.ahorroHorasPorPool).toBe(1); // 32 - 31 = 1 hora de optimización y contrato unificado
      expect(consolidado.totalTecnicosParvuloRequeridosDto315).toBe(2);
    });
  });
});
