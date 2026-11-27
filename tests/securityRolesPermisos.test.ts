import { describe, it, expect, beforeEach } from 'vitest';
import { RolesPermisosService } from '../src/services/rolesPermisosService';
import { normalizarRol, rolesAsignablesPor, esRolNivelCentral } from '../src/security/rolesDefinitions';
import { TODAS_LAS_CLAVES, k, normalizarPermisos } from '../src/security/permissionCatalog';
import { colegiosVisibles, puedeAccederRbd } from '../src/services/scopeService';
import { Establecimiento } from '../src/types';

describe('Roles, Permisos y Scope Territorial RBAC', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    RolesPermisosService.invalidarCache();
    for (const key of Object.keys(store)) delete store[key];
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; }
    };
  });

  it('el Super Usuario siempre tiene dominio completo e inmutable', () => {
    const permisosSU = RolesPermisosService.getPermisosRol('super_usuario');
    expect(permisosSU.length).toBe(TODAS_LAS_CLAVES.length);
    expect(RolesPermisosService.tienePermiso('super_usuario', k('roles', 'editar'))).toBe(true);
    expect(RolesPermisosService.tienePermiso('super_usuario', k('base_datos', 'ejecutar'))).toBe(true);

    // Intentar modificar el rol del super usuario debe lanzar error
    expect(() => {
      RolesPermisosService.guardarPermisosRol('super_usuario', [], 'test');
    }).toThrow(/no es editable/);
  });

  it('migra automáticamente roles heredados a la nueva taxonomía', () => {
    expect(normalizarRol('admin')).toBe('super_usuario');
    expect(normalizarRol('asesor')).toBe('asesor_uatp');
    expect(normalizarRol('director_colegio')).toBe('director_establecimiento');
    expect(normalizarRol('auditor')).toBe('subdirector_uatp');
  });

  it('permite al super usuario modificar permisos de otros roles y persistirlos', () => {
    const rol = 'asesor_uatp';
    const permisoInicial = RolesPermisosService.tienePermiso(rol, k('config_normativa', 'editar'));
    expect(permisoInicial).toBe(false);

    // Asignar el permiso
    const permisosActuales = RolesPermisosService.getPermisosRol(rol);
    RolesPermisosService.guardarPermisosRol(rol, [...permisosActuales, k('config_normativa', 'editar')], 'saxneal');

    expect(RolesPermisosService.tienePermiso(rol, k('config_normativa', 'editar'))).toBe(true);

    // Debe quedar registrado en la bitácora
    const bitacora = RolesPermisosService.getBitacora();
    expect(bitacora.length).toBeGreaterThan(0);
    expect(bitacora[0].rolId).toBe(rol);
    expect(bitacora[0].agregados).toContain(k('config_normativa', 'editar'));
  });

  it('aplica la regla de dependencia: si se otorga editar/eliminar, se agrega automáticamente "ver"', () => {
    const rol = 'director_establecimiento';
    // Otorgar sólo 'docentes.eliminar'
    RolesPermisosService.guardarPermisosRol(rol, [k('docentes', 'eliminar')], 'saxneal');
    const permisos = RolesPermisosService.getPermisosRol(rol);

    expect(permisos).toContain(k('docentes', 'eliminar'));
    expect(permisos).toContain(k('docentes', 'ver'));
  });

  it('delimita el alcance territorial según la jerarquía de roles', () => {
    const colegiosSimulados: Establecimiento[] = [
      { id: '1', rbd: '101', nombre: 'Escuela A', comuna: 'Chillán Viejo', regimen: 'JORNADA_COMPLETA', porcentajePrioritarios: 85, asesorUatp: 'Juan Asesor' },
      { id: '2', rbd: '102', nombre: 'Escuela B', comuna: 'Bulnes', regimen: 'JORNADA_COMPLETA', porcentajePrioritarios: 70, asesorUatp: 'Pedro Asesor' },
      { id: '3', rbd: '103', nombre: 'Escuela C', comuna: 'Yungay', regimen: 'JORNADA_COMPLETA', porcentajePrioritarios: 90, asesorUatp: 'Juan Asesor' }
    ];

    // 1. Director: sólo su escuela
    const director = { id: 'u1', role: 'director_establecimiento' as const, nombreCompleto: 'Dir A', rbdAsignado: '101' };
    const visiblesDirector = colegiosVisibles(director, colegiosSimulados);
    expect(visiblesDirector.length).toBe(1);
    expect(visiblesDirector[0].rbd).toBe('101');
    expect(puedeAccederRbd(director, '101', colegiosSimulados)).toBe(true);
    expect(puedeAccederRbd(director, '102', colegiosSimulados)).toBe(false);

    // 2. Asesor: su cartera asignada y colegios donde es asesorUatp
    const asesor = { id: 'u2', role: 'asesor_uatp' as const, nombreCompleto: 'Juan Asesor', carteraRbds: ['101'] };
    const visiblesAsesor = colegiosVisibles(asesor, colegiosSimulados);
    // Tiene 101 explícito y 103 por nombre
    expect(visiblesAsesor.map(c => c.rbd)).toEqual(expect.arrayContaining(['101', '103']));
    expect(puedeAccederRbd(asesor, '102', colegiosSimulados)).toBe(false);

    // 3. Super Usuario y Subdirector: alcance global
    const subdirector = { id: 'u3', role: 'subdirector_uatp' as const, nombreCompleto: 'Subdir UATP' };
    expect(colegiosVisibles(subdirector, colegiosSimulados).length).toBe(3);
  });

  it('respeta la jerarquía en la asignación de roles (un usuario no asigna roles de nivel superior)', () => {
    const rolesDeAsesor = rolesAsignablesPor('asesor_uatp');
    // Asesor (nivel 3) sólo puede asignar director (4) y jefe UTP (4)
    expect(rolesDeAsesor.map(r => r.id)).toEqual(['director_establecimiento', 'jefe_utp_establecimiento']);

    const rolesDeSuperUsuario = rolesAsignablesPor('super_usuario');
    expect(rolesDeSuperUsuario.length).toBe(7);
  });

  it('bloquea incondicionalmente mesa_movilidad y gdp_validador para roles de establecimiento', () => {
    const permisosProhibidos = [
      k('mesa_movilidad', 'ver'),
      k('mesa_movilidad', 'crear'),
      k('mesa_movilidad', 'editar'),
      k('mesa_movilidad', 'eliminar'),
      k('mesa_movilidad', 'ejecutar'),
      k('gdp_validador', 'ver'),
      k('gdp_validador', 'editar'),
      k('gdp_validador', 'ejecutar')
    ];

    for (const rolEscuela of ['director_establecimiento', 'jefe_utp_establecimiento'] as const) {
      const normalizados = normalizarPermisos(rolEscuela, [
        k('workflow', 'ver'),
        ...permisosProhibidos
      ]);
      expect(normalizados.some(p => p.startsWith('mesa_movilidad.') || p.startsWith('gdp_validador.'))).toBe(false);

      RolesPermisosService.guardarPermisosRol(rolEscuela, [k('workflow', 'ver'), ...permisosProhibidos], 'test-admin');
      const persistidos = RolesPermisosService.getPermisosRol(rolEscuela);
      expect(persistidos.some(p => p.startsWith('mesa_movilidad.') || p.startsWith('gdp_validador.'))).toBe(false);
    }
  });

  it('identifica correctamente roles de nivel central y permisos por defecto de gdp_validador', () => {
    expect(esRolNivelCentral('director_establecimiento')).toBe(false);
    expect(esRolNivelCentral('jefe_utp_establecimiento')).toBe(false);
    expect(esRolNivelCentral('director_colegio')).toBe(false);
    expect(esRolNivelCentral('desconocido')).toBe(false);

    expect(esRolNivelCentral('super_usuario')).toBe(true);
    expect(esRolNivelCentral('subdirector_uatp')).toBe(true);
    expect(esRolNivelCentral('coordinador_uatp')).toBe(true);
    expect(esRolNivelCentral('asesor_uatp')).toBe(true);
    expect(esRolNivelCentral('gdp_validador')).toBe(true);

    expect(RolesPermisosService.tienePermiso('gdp_validador', k('gdp_validador', 'ejecutar'))).toBe(true);
    expect(RolesPermisosService.tienePermiso('gdp_validador', k('mesa_movilidad', 'ver'))).toBe(true);
    expect(RolesPermisosService.tienePermiso('gdp_validador', k('workflow', 'ver'))).toBe(true);
    expect(RolesPermisosService.tienePermiso('gdp_validador', k('docentes', 'ver'))).toBe(true);
    expect(RolesPermisosService.tienePermiso('gdp_validador', k('establecimiento_slep', 'exportar'))).toBe(true);
    expect(RolesPermisosService.tienePermiso('gdp_validador', k('estadisticas', 'exportar'))).toBe(true);
    expect(RolesPermisosService.tienePermiso('gdp_validador', k('analizador', 'ver'))).toBe(true);
    expect(RolesPermisosService.tienePermiso('gdp_validador', k('analizador', 'exportar'))).toBe(true);
    expect(RolesPermisosService.tienePermiso('gdp_validador', k('planillas_dep', 'exportar'))).toBe(true);

    const legadoDobleRol = RolesPermisosService.derivarPermisosLegados('asesor_uatp', ['gdp_validador']);
    expect(legadoDobleRol.puedeAccederTodasEscuelas).toBe(true);
    expect(legadoDobleRol.puedeExportarReportes).toBe(true);
  });
});
