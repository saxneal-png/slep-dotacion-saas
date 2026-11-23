import { describe, it, expect, beforeEach } from 'vitest';
import {
  CATALOGO_PERMISOS,
  PERMISOS_POR_DEFECTO,
  k
} from '../src/security/permissionCatalog';
import { RolesPermisosService } from '../src/services/rolesPermisosService';
import { crearEvaluador } from '../src/security/PermisosContext';

describe('Permisos por rol en pestañas del Espacio Escolar', () => {
  beforeEach(() => {
    RolesPermisosService.restablecerTodo('test');
  });

  it('1. Incluye todas las pestañas del Espacio Escolar en el catálogo de permisos', () => {
    const ids = CATALOGO_PERMISOS.filter(m => m.grupo === 'establecimiento').map(m => m.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'workflow',
        'balanza',
        'docentes',
        'necesidades_docentes',
        'asistentes',
        'curriculum',
        'pie',
        'salas_sae',
        'jardin_vtf'
      ])
    );
  });

  it('2. Super Usuario puede deshabilitar edición dejando solo lectura en una pestaña para un rol', () => {
    // Por defecto director_establecimiento puede ver y editar docentes y necesidades_docentes
    let ev = crearEvaluador('director_establecimiento');
    expect(ev.can('docentes.ver')).toBe(true);
    expect(ev.can('docentes.editar')).toBe(true);
    expect(ev.can('necesidades_docentes.ver')).toBe(true);
    expect(ev.can('necesidades_docentes.editar')).toBe(true);

    // Super Usuario revoca docentes.editar y necesidades_docentes.editar
    const sinEditar = PERMISOS_POR_DEFECTO.director_establecimiento.filter(
      p => p !== k('docentes', 'editar') && p !== k('necesidades_docentes', 'editar')
    );
    RolesPermisosService.guardarPermisosRol(
      'director_establecimiento',
      sinEditar,
      'Super Usuario',
      'Modo solo lectura en docentes y necesidades'
    );

    ev = crearEvaluador('director_establecimiento');
    expect(ev.can('docentes.ver')).toBe(true);
    expect(ev.can('docentes.editar')).toBe(false);
    expect(ev.can('necesidades_docentes.ver')).toBe(true);
    expect(ev.can('necesidades_docentes.editar')).toBe(false);
  });

  it('3. Super Usuario puede ocultar completamente una pestaña revocando su permiso .ver', () => {
    const sinPie = PERMISOS_POR_DEFECTO.jefe_utp_establecimiento.filter(p => !p.startsWith('pie.'));
    RolesPermisosService.guardarPermisosRol(
      'jefe_utp_establecimiento',
      sinPie,
      'Super Usuario',
      'Ocultar pestaña PIE para Jefe UTP'
    );

    const ev = crearEvaluador('jefe_utp_establecimiento');
    expect(ev.can('pie.ver')).toBe(false);
    expect(ev.can('pie.editar')).toBe(false);
    expect(ev.can('curriculum.ver')).toBe(true);
  });
});
