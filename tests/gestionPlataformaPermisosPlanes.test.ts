import { describe, it, expect, beforeAll } from 'vitest';
import {
  normalizarPermisos,
  PERMISOS_POR_DEFECTO,
  ROLES_PUEDEN_CREAR_CURSOS
} from '../src/security/permissionCatalog';
import { RolesPermisosService } from '../src/services/rolesPermisosService';
import {
  guardarPlanEstudioColegio,
  listarPlanesEstudioColegio,
  listarPlanesEstudio,
  eliminarPlanEstudioColegio
} from '../src/database/repositories/planesEstudioRepo';
import { resolverPlanCurso } from '../src/services/curricularPlanService';
import { getDb } from '../src/database/dbCore';
import { CursoSae } from '../src/types';

describe('Gestión de Plataforma: Permisos de Creación de Cursos y Planes por Establecimiento', () => {
  beforeAll(async () => {
    const db = await getDb();
    db.run(
      `INSERT OR IGNORE INTO establecimientos (id, rbd, nombre, comuna, regimen, porcentaje_prioritarios) VALUES (?, ?, ?, ?, ?, ?)`,
      ['est-11111', '11111', 'Escuela Uno', 'Bulnes', 'JEC', 65]
    );
    db.run(
      `INSERT OR IGNORE INTO establecimientos (id, rbd, nombre, comuna, regimen, porcentaje_prioritarios) VALUES (?, ?, ?, ?, ?, ?)`,
      ['est-22222', '22222', 'Escuela Dos', 'Chillán', 'JEC', 50]
    );
  });

  it('restringe curriculum.crear exclusivamente a asesor_uatp, coordinador_uatp y super_usuario', () => {
    expect(ROLES_PUEDEN_CREAR_CURSOS).toEqual(['super_usuario', 'coordinador_uatp', 'asesor_uatp']);

    expect(RolesPermisosService.tienePermiso('super_usuario', 'curriculum.crear')).toBe(true);
    expect(RolesPermisosService.tienePermiso('coordinador_uatp', 'curriculum.crear')).toBe(true);
    expect(RolesPermisosService.tienePermiso('asesor_uatp', 'curriculum.crear')).toBe(true);

    expect(RolesPermisosService.tienePermiso('director_establecimiento', 'curriculum.crear')).toBe(false);
    expect(RolesPermisosService.tienePermiso('jefe_utp_establecimiento', 'curriculum.crear')).toBe(false);
    expect(RolesPermisosService.tienePermiso('subdirector_uatp', 'curriculum.crear')).toBe(false);

    // Incluso si se intenta forzar curriculum.crear mediante normalizarPermisos, debe ser bloqueado
    expect(
      normalizarPermisos('director_establecimiento', [...PERMISOS_POR_DEFECTO.director_establecimiento, 'curriculum.crear'])
    ).not.toContain('curriculum.crear');
    expect(
      normalizarPermisos('jefe_utp_establecimiento', [...PERMISOS_POR_DEFECTO.jefe_utp_establecimiento, 'curriculum.crear'])
    ).not.toContain('curriculum.crear');
  });

  it('almacena planes personalizados exclusivamente para la escuela sin alterar la base general MINEDUC', async () => {
    const globalesAntes = await listarPlanesEstudio();
    const idsGlobalesAntes = new Set(globalesAntes.map(p => p.id));

    const planGuardado = await guardarPlanEstudioColegio('11111', {
      id: '',
      nivel: '1° Básico',
      regimen: 'JEC',
      categoria: 'BASICA',
      totalHorasSemanalesObligatorias: 34,
      horasLibreDisposicion: 6,
      totalHorasPlan: 40,
      asignaturas: [
        { id: 'a1', nombre: 'Lenguaje y Comunicación', horasSemanales: 8, caracter: 'Obligatoria' },
        { id: 'a2', nombre: 'Taller de Robótica Escolar', horasSemanales: 2, caracter: 'Electiva' }
      ],
      esPersonalizado: true
    });

    expect(planGuardado.rbd).toBe('11111');
    expect(planGuardado.id).toContain('colegio_11111_');

    // La base global MINEDUC no fue modificada ni contaminada
    const globalesDespues = await listarPlanesEstudio();
    expect(globalesDespues.map(p => p.id)).toEqual(Array.from(idsGlobalesAntes));
    expect(globalesDespues.some(p => p.id === planGuardado.id)).toBe(false);

    // Escuela 11111 ve su personalización, Escuela 22222 NO
    const planes11111 = await listarPlanesEstudio(undefined, '11111');
    const planes22222 = await listarPlanesEstudio(undefined, '22222');
    expect(planes11111.some(p => p.id === planGuardado.id)).toBe(true);
    expect(planes22222.some(p => p.id === planGuardado.id)).toBe(false);
    expect((await listarPlanesEstudioColegio('22222')).length).toBe(0);

    // Resolución curricular aislada por RBD
    const cursoEscuela1: CursoSae = {
      id: 'c1',
      rbd: '11111',
      periodo: 2027,
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 28,
      alumnosNeet: 0,
      alumnosNeep: 0,
      esCombinado: false,
      planEstudioId: planGuardado.id
    };
    const cursoEscuela2: CursoSae = {
      ...cursoEscuela1,
      id: 'c2',
      rbd: '22222',
      planEstudioId: undefined
    };

    const info1 = resolverPlanCurso(cursoEscuela1, planes11111);
    const info2 = resolverPlanCurso(cursoEscuela2, planes22222);

    expect(info1.esPersonalizadoBd).toBe(true);
    expect(info1.asignaturas.some(a => a.nombre === 'Taller de Robótica Escolar')).toBe(true);
    expect(info2.esPersonalizadoBd).toBe(false);
    expect(info2.asignaturas.some(a => a.nombre === 'Taller de Robótica Escolar')).toBe(false);

    // Restauración limpia
    await eliminarPlanEstudioColegio('11111', planGuardado.id);
    expect((await listarPlanesEstudioColegio('11111')).length).toBe(0);
  });
});
