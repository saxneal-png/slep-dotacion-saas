import { describe, it, expect } from 'vitest';
import { normalizarNombreAsignatura, sonAsignaturasEquivalentes } from '../src/components/DocenteAsignacionPanel';
import { resolverCodigoYAmbitoAsignatura, obtenerPlanPorCurso } from '@slep/mineduc-engine';

describe('Blindaje y Normalización de Módulos TP (Gastronomía y otras especialidades)', () => {
  it('no confunde módulos que contienen "mate" o "calculo" con Matemática', () => {
    const moduloMateriasPrimas = 'Módulo: Recepción y almacenamiento de insumos';
    const moduloMateriales = 'Módulo: Material didáctico y de ambientación';
    const moduloCalculo = 'Módulo mención: Cálculo de remuneraciones, finiquitos y obligaciones laborales';

    expect(normalizarNombreAsignatura(moduloMateriasPrimas)).not.toBe('matematica');
    expect(normalizarNombreAsignatura(moduloMateriales)).not.toBe('matematica');
    expect(normalizarNombreAsignatura(moduloCalculo)).not.toBe('matematica');

    // Debe preservar la identidad como modulo_...
    expect(normalizarNombreAsignatura(moduloMateriasPrimas)).toContain('modulo_');
    expect(normalizarNombreAsignatura(moduloMateriales)).toContain('modulo_');
    expect(normalizarNombreAsignatura(moduloCalculo)).toContain('modulo_');

    // Jamás deben ser equivalentes a "Matemática"
    expect(sonAsignaturasEquivalentes('Matemática', moduloMateriasPrimas)).toBe(false);
    expect(sonAsignaturasEquivalentes('Matemática', moduloMateriales)).toBe(false);
    expect(sonAsignaturasEquivalentes('Matemática', moduloCalculo)).toBe(false);
  });

  it('no confunde módulos de salud con Educación Física ni módulos de comunicación con Lenguaje', () => {
    const modSalud = 'Módulo: Higiene y bioseguridad en salud';
    const modCom = 'Módulo: Telecomunicaciones y redes de datos';
    const modQuim = 'Módulo: Análisis químico instrumental';

    expect(normalizarNombreAsignatura(modSalud)).not.toBe('educacion fisica y salud');
    expect(normalizarNombreAsignatura(modCom)).not.toBe('lenguaje y comunicacion');
    expect(normalizarNombreAsignatura(modQuim)).not.toBe('ciencias naturales');

    expect(sonAsignaturasEquivalentes('Educación Física y Salud', modSalud)).toBe(false);
    expect(sonAsignaturasEquivalentes('Lengua y Literatura', modCom)).toBe(false);
    expect(sonAsignaturasEquivalentes('Ciencias Naturales', modQuim)).toBe(false);
  });

  it('resuelve correctamente el ámbito canónico DIFERENCIADA_TP para módulos oficiales', () => {
    const res1 = resolverCodigoYAmbitoAsignatura('Módulo: Elaboración de alimentos de baja complejidad');
    expect(res1.ambito).toBe('DIFERENCIADA_TP');
    expect(res1.esOficial).toBe(true);

    const res2 = resolverCodigoYAmbitoAsignatura('Módulo mención: Cocina chilena');
    expect(res2.ambito).toBe('DIFERENCIADA_TP');
    expect(res2.esOficial).toBe(true);

    const res3 = resolverCodigoYAmbitoAsignatura('Módulo mención: Elaboración de productos de repostería');
    expect(res3.ambito).toBe('DIFERENCIADA_TP');
    expect(res3.esOficial).toBe(true);
  });

  it('obtiene el plan correcto para 4° Medio Gastronomía sin ser anulado por 3° Medio', () => {
    const plan4Cocina = obtenerPlanPorCurso('4° Medio A', 'JEC', '4° Medio - Especialidad Gastronomía, Mención Cocina');
    expect(plan4Cocina).not.toBeNull();
    expect(plan4Cocina?.nivel).toContain('4° Medio');
    expect(plan4Cocina?.asignaturasBase.some(a => a.nombre.includes('Cocina chilena'))).toBe(true);

    const plan4Pasteleria = obtenerPlanPorCurso('4° Medio B', 'JEC', 'Gastronomía Pastelería');
    expect(plan4Pasteleria).not.toBeNull();
    expect(plan4Pasteleria?.nivel).toContain('Pastelería');
  });
});
