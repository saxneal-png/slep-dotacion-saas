import { describe, it, expect } from 'vitest';
import { generarHtmlFichaDocente } from '../src/services/docenteFichaImpresionService';
import type { DocenteConsolidadoTerritorial, Establecimiento } from '../src/types';

describe('Servicio de Impresión de Ficha Oficial Docente', () => {
  it('genera correctamente el HTML institucional con todos los bloques normativos', () => {
    const colegioMock: Establecimiento = {
      id: 'e_1',
      rbd: '3501',
      nombre: 'Escuela Rural El Roble',
      comuna: 'San Ignacio',
      regimen: 'JEC',
      porcentajePrioritarios: 85
    };

    const docenteMock: DocenteConsolidadoTerritorial = {
      run: '15.123.456-7',
      nombres: 'Andrea',
      apellidos: 'Valenzuela Morales',
      titulo: 'Profesora de Educación General Básica',
      estamentoPrincipal: 'DOCENTE_AULA',
      horasTotalesSlep: 44,
      excedeLimiteSlep: false,
      sobreasignacionTerritorialMinutos: 0,
      totalMinutosLectivos: 1485,
      totalMinutosRecreo: 248,
      totalMinutosHnl: 907,
      minutosDisponiblesParaOtrasFunciones: 544,
      advertenciasTerritoriales: [],
      contratos: [
        {
          colegio: colegioMock,
          docente: {
            id: 'd_1',
            rbd: '3501',
            run: '15.123.456-7',
            nombres: 'Andrea',
            apellidos: 'Valenzuela Morales',
            calidadJuridica: 'TITULAR',
            estamento: 'DOCENTE_AULA',
            horasContrato: 44,
            periodo: 2026
          },
          horasDocenciaNeta: 33,
          horasPedagogicasAsignadas: 33,
          regimen: '65/35',
          maxHorasPedagogicasMineduc: 33,
          minutosLectivosMineduc: 1485,
          minutosRecreoMineduc: 248,
          minutosNoLectivosMineduc: 907,
          minutosTotalesContrato: 2640,
          estaSobreasignado: false,
          excesoHorasAula: 0,
          minutosHnlPlanificacion40: 363,
          fuentesFinanciamiento: {
            subvencionGeneralTitular: 44,
            subvencionGeneralContrata: 0,
            sepTitular: 0,
            sepContrata: 0,
            pieTitular: 0,
            pieContrata: 0,
            total: 44
          },
          asignaciones: [
            {
              id: 'asig_1',
              rbd: '3501',
              cursoId: 'c_1',
              docenteId: 'd_1',
              asignatura: 'Lenguaje y Comunicación',
              horasPedagogicasAula: 8,
              periodo: 2026
            }
          ]
        }
      ]
    };

    const html = generarHtmlFichaDocente(docenteMock, colegioMock);

    expect(html).toContain('FICHA OFICIAL DE CARGA HORARIA');
    expect(html).toContain('Andrea Valenzuela Morales');
    expect(html).toContain('15.123.456-7');
    expect(html).toContain('Escuela Rural El Roble');
    expect(html).toContain('44 hrs');
    expect(html).toContain('Lenguaje y Comunicación');
    expect(html).toContain('Ley N° 20.903');
  });
});
