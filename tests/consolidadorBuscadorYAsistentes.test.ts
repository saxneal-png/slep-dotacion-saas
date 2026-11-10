import { describe, it, expect } from 'vitest';
import { obtenerAsistentesConsolidadosTerritorio } from '../src/services/dotacionCalculationService';
import { coincideBusquedaFuncionario, normalizarTextoBusqueda } from '../src/utils/searchUtils';
import { generarHtmlFichaAsistente } from '../src/services/asistenteFichaImpresionService';
import type { AsistenteEducacion, Establecimiento } from '../src/types';

describe('Consolidador Territorial: Buscador Unificado y Consolidación de Asistentes', () => {
  const colegioA: Establecimiento = {
    id: 'est-1',
    rbd: '3451',
    nombre: 'Liceo Manuel Bulnes',
    comuna: 'Bulnes',
    regimen: 'JEC',
    porcentajePrioritarios: 82.5
  };

  const colegioB: Establecimiento = {
    id: 'est-2',
    rbd: '3480',
    nombre: 'Escuela Quilamapu',
    comuna: 'Chillán Viejo',
    regimen: 'JEC',
    porcentajePrioritarios: 65.0
  };

  describe('obtenerAsistentesConsolidadosTerritorio', () => {
    it('consolida asistentes multi-escuela por RUN normalizado y detecta exceso >44h', () => {
      const asistentes: AsistenteEducacion[] = [
        {
          id: 'asis-1',
          rbd: '3451',
          periodo: 2027,
          run: '15.234.567-8',
          nombres: 'Camila Andrea',
          apellidos: 'Soto Méndez',
          cargoFuncion: 'Psicóloga Convivencia Escolar',
          estamento: 'PROFESIONAL',
          horasContrato: 30,
          horasSubvencionGeneralIndefinido: 0,
          horasSubvencionGeneralPlazoFijo: 0,
          horasSepIndefinido: 20,
          horasSepPlazoFijo: 10,
          horasPieIndefinido: 0,
          horasPiePlazoFijo: 0,
          esDuplaPsicosocial: true,
          activo: true
        },
        {
          id: 'asis-2',
          rbd: '3480',
          periodo: 2027,
          run: '15234567-8',
          nombres: 'Camila Andrea',
          apellidos: 'Soto Méndez',
          cargoFuncion: 'Psicóloga PIE',
          estamento: 'PROFESIONAL',
          horasContrato: 20,
          horasSubvencionGeneralIndefinido: 0,
          horasSubvencionGeneralPlazoFijo: 0,
          horasSepIndefinido: 0,
          horasSepPlazoFijo: 0,
          horasPieIndefinido: 0,
          horasPiePlazoFijo: 20,
          esEquipoPie: true,
          activo: true
        }
      ];

      const consolidados = obtenerAsistentesConsolidadosTerritorio([colegioA, colegioB], asistentes);

      expect(consolidados).toHaveLength(1);
      const camila = consolidados[0];
      expect(camila.run).toBe('15234567-8');
      expect(camila.contratos).toHaveLength(2);
      expect(camila.horasTotalesSlep).toBe(50);
      expect(camila.excedeLimiteSlep).toBe(true);
      expect(camila.excesoHorasSlep).toBe(6);
      expect(camila.esDuplaPsicosocial).toBe(true);
      expect(camila.esEquipoPie).toBe(true);
      expect(camila.cargosPrincipales).toEqual(['Psicóloga Convivencia Escolar', 'Psicóloga PIE']);
      expect(camila.resumenFinanciamiento.sep).toBe(30);
      expect(camila.resumenFinanciamiento.pie).toBe(20);
      expect(camila.resumenFinanciamiento.indefinido).toBe(20);
      expect(camila.resumenFinanciamiento.plazoFijo).toBe(30);
    });

    it('mantiene separados a los asistentes sin RUN válido y excluye inactivos', () => {
      const asistentes: AsistenteEducacion[] = [
        {
          id: 'asis-sin-1',
          rbd: '3451',
          periodo: 2027,
          run: 'Sin RUN',
          nombres: 'Pedro',
          apellidos: 'Araya',
          cargoFuncion: 'Auxiliar de Aseo',
          estamento: 'AUXILIAR',
          horasContrato: 44,
          horasSubvencionGeneralIndefinido: 44,
          horasSubvencionGeneralPlazoFijo: 0,
          horasSepIndefinido: 0,
          horasSepPlazoFijo: 0,
          horasPieIndefinido: 0,
          horasPiePlazoFijo: 0,
          activo: true
        },
        {
          id: 'asis-sin-2',
          rbd: '3480',
          periodo: 2027,
          run: '',
          nombres: 'Luis',
          apellidos: 'Bustos',
          cargoFuncion: 'Inspector de Patio',
          estamento: 'ADMINISTRATIVO',
          horasContrato: 44,
          horasSubvencionGeneralIndefinido: 44,
          horasSubvencionGeneralPlazoFijo: 0,
          horasSepIndefinido: 0,
          horasSepPlazoFijo: 0,
          horasPieIndefinido: 0,
          horasPiePlazoFijo: 0,
          activo: true
        },
        {
          id: 'asis-inactivo',
          rbd: '3451',
          periodo: 2027,
          run: '16.000.111-K',
          nombres: 'Inactivo',
          apellidos: 'Registro',
          cargoFuncion: 'Administrativo',
          estamento: 'ADMINISTRATIVO',
          horasContrato: 44,
          horasSubvencionGeneralIndefinido: 44,
          horasSubvencionGeneralPlazoFijo: 0,
          horasSepIndefinido: 0,
          horasSepPlazoFijo: 0,
          horasPieIndefinido: 0,
          horasPiePlazoFijo: 0,
          activo: false
        }
      ];

      const consolidados = obtenerAsistentesConsolidadosTerritorio([colegioA, colegioB], asistentes);
      expect(consolidados).toHaveLength(2);
      expect(consolidados.map(c => c.idKey)).toEqual(['ID:asis-sin-1', 'ID:asis-sin-2']);
      expect(consolidados.every(c => !c.excedeLimiteSlep)).toBe(true);
    });
  });

  describe('coincideBusquedaFuncionario', () => {
    const target = {
      run: '13456789-K',
      nombres: 'Mónica Beatriz',
      apellidos: 'Pérez Troncoso',
      extras: ['Psicóloga Convivencia', 'Liceo Manuel Bulnes']
    };

    it('normaliza acentos y permite buscar por nombre y apellido en cualquier orden', () => {
      expect(normalizarTextoBusqueda('Mónica   Pérez')).toBe('monica perez');
      expect(coincideBusquedaFuncionario('monica perez', target).match).toBe(true);
      expect(coincideBusquedaFuncionario('Troncoso Mónica', target).match).toBe(true);
      expect(coincideBusquedaFuncionario('psicologa bulnes', target).match).toBe(true);
    });

    it('acepta RUN con puntos, sin puntos, sin guion y prefijos', () => {
      const exactPuntos = coincideBusquedaFuncionario('13.456.789-k', target);
      const exactSinGuion = coincideBusquedaFuncionario('13456789K', target);
      const prefijo = coincideBusquedaFuncionario('13456', target);

      expect(exactPuntos.match).toBe(true);
      expect(exactPuntos.score).toBe(100);
      expect(exactSinGuion.match).toBe(true);
      expect(exactSinGuion.score).toBe(100);
      expect(prefijo.match).toBe(true);
      expect(prefijo.score).toBeGreaterThan(50);
    });

    it('no confunde nombres con letra K con el dígito verificador de un RUN', () => {
      expect(coincideBusquedaFuncionario('karen', target).match).toBe(false);
    });
  });

  describe('generarHtmlFichaAsistente', () => {
    it('genera HTML imprimible con cargo, descripción GDP y escape seguro de HTML', () => {
      const asistentes: AsistenteEducacion[] = [
        {
          id: 'asis-html',
          rbd: '3451',
          periodo: 2027,
          run: '18.111.222-3',
          nombres: 'Elena',
          apellidos: 'Rojas',
          cargoFuncion: 'Trabajadora Social',
          descripcionFuncionGdp: 'Atención psicosocial <prioritaria> & seguimiento PME',
          estamento: 'PROFESIONAL',
          horasContrato: 44,
          horasSubvencionGeneralIndefinido: 0,
          horasSubvencionGeneralPlazoFijo: 0,
          horasSepIndefinido: 44,
          horasSepPlazoFijo: 0,
          horasPieIndefinido: 0,
          horasPiePlazoFijo: 0,
          estadoSancionGdp: 'Aprobado',
          activo: true
        }
      ];
      const [elena] = obtenerAsistentesConsolidadosTerritorio([colegioA], asistentes);
      const html = generarHtmlFichaAsistente(elena, colegioA);

      expect(html).toContain('Elena Rojas');
      expect(html).toContain('18111222-3');
      expect(html).toContain('Trabajadora Social');
      expect(html).toContain('Atención psicosocial &lt;prioritaria&gt; &amp; seguimiento PME');
      expect(html).toContain('Aprobado');
    });
  });
});
