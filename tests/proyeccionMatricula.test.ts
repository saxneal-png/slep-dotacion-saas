import { describe, it, expect } from 'vitest';
import { proyectarMatriculaNivel, distribuirMatriculaEnCursos } from '../src/services/proyeccionMatriculaService';

describe('Servicio de Proyección de Matrícula Territorial', () => {
  it('proyecta 1° Básico en escuela con Kínder considerando absorción externa (máximo entre Kínder e Histórico)', () => {
    // RBD 3663 (Escuela República de México)
    // Kínder ago26 = 28, Histórico 1B avg = 79
    const res = proyectarMatriculaNivel('3663', '1° Básico');
    expect(res.matriculaProyectada).toBeGreaterThanOrEqual(70);
    expect(res.metodoAplicado).toBe('PROMEDIO_HISTORICO_ABSORCION');
    expect(res.detalle).toContain('1° Básico con Kínder');
  });

  it('proyecta 1° Básico en escuela rural sin Kínder por absorción histórica', () => {
    // RBD 3698 (Escuela Básica Quilmo)
    const res = proyectarMatriculaNivel('3698', '1° Básico');
    expect(res.matriculaProyectada).toBe(7);
    expect(res.metodoAplicado).toBe('PROMEDIO_HISTORICO_ABSORCION');
    expect(res.detalle).toContain('sin Kínder');
  });

  it('proyecta Pre-Kínder por promedio histórico de absorción', () => {
    // RBD 3672 (Escuela Arturo Mutizabal)
    const res = proyectarMatriculaNivel('3672', 'Prekínder');
    expect(res.matriculaProyectada).toBe(12);
    expect(res.metodoAplicado).toBe('PROMEDIO_HISTORICO_ABSORCION');
  });

  it('proyecta 7° Básico en liceo sin 6° básico por absorción histórica', () => {
    // RBD 3638 (Liceo Marta Brunet - parte en 7°)
    const res = proyectarMatriculaNivel('3638', '7° Básico');
    expect(res.matriculaProyectada).toBe(17);
    expect(res.metodoAplicado).toBe('PROMEDIO_HISTORICO_ABSORCION');
  });

  it('proyecta 1° Medio respetando cupo REX de infraestructura cuando está fijado', () => {
    // RBD 3638 (Liceo Marta Brunet) tiene cuposRex = 160
    const res = proyectarMatriculaNivel('3638', '1° Medio');
    expect(res.matriculaProyectada).toBe(160);
    expect(res.metodoAplicado).toBe('CUPO_REX_INFRAESTRUCTURA');
  });

  it('proyecta cursos continuos por promoción de cohorte anterior (Agosto 2026)', () => {
    // RBD 3672: 2° Básico promueve a 1° Básico de agosto 2026 (que tenía 21 alumnos)
    const res = proyectarMatriculaNivel('3672', '2° Básico');
    expect(res.matriculaProyectada).toBe(21);
    expect(res.metodoAplicado).toBe('PROMOCION_COHORTE_PREVIA');
  });

  it('distribuye equitativamente la matrícula entre secciones existentes en el SaaS', () => {
    const cursos = [
      { id: 'c1', letra: 'A' },
      { id: 'c2', letra: 'B' }
    ];
    const mapa = distribuirMatriculaEnCursos(cursos, 55);
    expect(mapa.get('c1')).toBe(28); // 27 + 1 de residuo
    expect(mapa.get('c2')).toBe(27);
  });
});
