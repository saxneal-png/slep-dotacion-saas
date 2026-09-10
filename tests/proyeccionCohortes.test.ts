import { describe, it, expect, beforeAll } from 'vitest';
import {
  getDb,
  guardarEstablecimiento,
  guardarCurso,
  guardarDocente,
  listarCursos,
  proyectarPeriodoColegio,
  borrarDotacionPeriodo
} from '../src/database/db';
import { Establecimiento, CursoSae, Docente } from '../src/types';

describe('Proyección de Cohortes y Refinamiento 2027', () => {
  beforeAll(async () => {
    await getDb();
  });

  it('en escuela básica exclusiva: 8° básico egresa y no genera 1° medio, y pre-kínder se regenera', async () => {
    const rbdBasica = '77701';
    await borrarDotacionPeriodo(2026, rbdBasica);
    await borrarDotacionPeriodo(2027, rbdBasica);

    const escBasica: Establecimiento = {
      id: `est-${rbdBasica}`,
      rbd: rbdBasica,
      nombre: 'Escuela Básica Rural',
      comuna: 'Bulnes',
      regimen: 'JEC',
      porcentajePrioritarios: 80
    };
    await guardarEstablecimiento(escBasica);

    // Cursos 2026: Pre-Kínder, 7° Básico, 8° Básico
    const pk: CursoSae = {
      id: `c_${rbdBasica}_2026_PK`,
      rbd: rbdBasica,
      nivel: 'Pre-Kínder',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 25,
      matriculaProyectada: 20,
      alumnosNeet: 0,
      alumnosNeep: 0,
      periodo: 2026
    };
    const c7: CursoSae = {
      id: `c_${rbdBasica}_2026_7B`,
      rbd: rbdBasica,
      nivel: '7° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 28,
      alumnosNeet: 0,
      alumnosNeep: 0,
      periodo: 2026
    };
    const c8: CursoSae = {
      id: `c_${rbdBasica}_2026_8B`,
      rbd: rbdBasica,
      nivel: '8° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 27,
      alumnosNeet: 0,
      alumnosNeep: 0,
      periodo: 2026
    };

    await guardarCurso(pk);
    await guardarCurso(c7);
    await guardarCurso(c8);

    // Proyectar a 2027
    const res = await proyectarPeriodoColegio(rbdBasica, 2026, 2027, { promoverCursos: true });
    expect(res.cursosCreados).toBe(3); // Kínder (de PK), 8° Básico (de 7°), Pre-Kínder (regenerado)

    const cursos2027 = await listarCursos(rbdBasica, 2027);
    const niveles2027 = cursos2027.map(c => c.nivel);

    // Debe contener Kínder, 8° Básico y el nuevo Pre-Kínder
    expect(niveles2027).toContain('Kínder');
    expect(niveles2027).toContain('8° Básico');
    expect(niveles2027).toContain('Pre-Kínder');

    // NO debe contener 1° Medio (el 8° básico egresó)
    expect(niveles2027).not.toContain('1° Medio');
  });

  it('en liceo con media: 8° básico promueve a 1° medio y 4° medio egresa sin duplicarse', async () => {
    const rbdLiceo = '77702';
    await borrarDotacionPeriodo(2026, rbdLiceo);
    await borrarDotacionPeriodo(2027, rbdLiceo);

    const liceo: Establecimiento = {
      id: `est-${rbdLiceo}`,
      rbd: rbdLiceo,
      nombre: 'Liceo Polivalente',
      comuna: 'San Ignacio',
      regimen: 'JEC',
      porcentajePrioritarios: 85
    };
    await guardarEstablecimiento(liceo);

    // Cursos 2026: 8° Básico, 3° Medio, 4° Medio
    const c8: CursoSae = {
      id: `c_${rbdLiceo}_2026_8B`,
      rbd: rbdLiceo,
      nivel: '8° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 32,
      alumnosNeet: 0,
      alumnosNeep: 0,
      periodo: 2026
    };
    const c3M: CursoSae = {
      id: `c_${rbdLiceo}_2026_3M`,
      rbd: rbdLiceo,
      nivel: '3° Medio',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 30,
      alumnosNeet: 0,
      alumnosNeep: 0,
      periodo: 2026
    };
    const c4M: CursoSae = {
      id: `c_${rbdLiceo}_2026_4M`,
      rbd: rbdLiceo,
      nivel: '4° Medio',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 29,
      alumnosNeet: 0,
      alumnosNeep: 0,
      periodo: 2026
    };

    await guardarCurso(c8);
    await guardarCurso(c3M);
    await guardarCurso(c4M);

    // Proyectar a 2027
    const res = await proyectarPeriodoColegio(rbdLiceo, 2026, 2027, { promoverCursos: true });
    // Creados: 1° Medio (de 8° Básico) y 4° Medio (de 3° Medio). El 4° Medio 2026 egresa.
    expect(res.cursosCreados).toBe(2);

    const cursos2027 = await listarCursos(rbdLiceo, 2027);
    expect(cursos2027.length).toBe(2);

    const niveles2027 = cursos2027.map(c => c.nivel);
    expect(niveles2027).toContain('1° Medio');
    expect(niveles2027).toContain('4° Medio');

    // Verificar que solo hay UN 4° Medio
    const count4M = cursos2027.filter(c => c.nivel === '4° Medio').length;
    expect(count4M).toBe(1);
  });
});
