import { describe, it, expect } from 'vitest';
import {
  agruparPresenciaPorEstablecimiento,
  filtrarPresenciaPorAlcance,
  PresenciaGlobalUsuario
} from '../src/services/colaboracionService';
import { PERMISOS_POR_DEFECTO } from '../src/security/permissionCatalog';

const crearSesion = (overrides: Partial<PresenciaGlobalUsuario>): PresenciaGlobalUsuario => ({
  sessionId: 'sess-1',
  usuarioId: 'user-1',
  nombreCompleto: 'Usuario Prueba',
  role: 'director_establecimiento',
  rbd: '3911',
  nombreEstablecimiento: 'Escuela República de Chile',
  comuna: 'Bulnes',
  vistaActiva: 'workflow',
  apartadoActivo: 'docentes',
  periodo: 2027,
  conectadoDesde: 1000,
  ultimaActividad: 2000,
  estado: 'activo',
  ...overrides
});

describe('Presencia Global en Tiempo Real (Monitor Super Usuario y Asesor UATP)', () => {
  it('incluye el permiso monitoreo_actividad.ver por defecto para super_usuario y asesor_uatp, pero no para establecimientos', () => {
    expect(PERMISOS_POR_DEFECTO.super_usuario).toContain('monitoreo_actividad.ver');
    expect(PERMISOS_POR_DEFECTO.asesor_uatp).toContain('monitoreo_actividad.ver');
    expect(PERMISOS_POR_DEFECTO.director_establecimiento).not.toContain('monitoreo_actividad.ver');
    expect(PERMISOS_POR_DEFECTO.jefe_utp_establecimiento).not.toContain('monitoreo_actividad.ver');
  });

  it('filtra sesiones según alcance territorial (global ve todo; cartera solo sus RBDs; establecimiento nada)', () => {
    const sesiones: PresenciaGlobalUsuario[] = [
      crearSesion({ sessionId: 's1', rbd: '3911', nombreEstablecimiento: 'Escuela A' }),
      crearSesion({ sessionId: 's2', rbd: '4055', nombreEstablecimiento: 'Escuela B' }),
      crearSesion({ sessionId: 's3', rbd: null, nombreEstablecimiento: null, vistaActiva: 'consolidador' })
    ];

    const carteraAsesor = new Set(['3911']);

    const globalRes = filtrarPresenciaPorAlcance(sesiones, carteraAsesor, 'global');
    expect(globalRes).toHaveLength(3);

    const carteraRes = filtrarPresenciaPorAlcance(sesiones, carteraAsesor, 'cartera');
    expect(carteraRes).toHaveLength(1);
    expect(carteraRes[0].rbd).toBe('3911');

    const estRes = filtrarPresenciaPorAlcance(sesiones, carteraAsesor, 'establecimiento');
    expect(estRes).toHaveLength(0);
  });

  it('agrupa sesiones por establecimiento, cuenta activos reales y separa vistas globales', () => {
    const sesiones: PresenciaGlobalUsuario[] = [
      crearSesion({ sessionId: 's1', rbd: '3911', nombreEstablecimiento: 'Escuela A', estado: 'activo' }),
      crearSesion({ sessionId: 's2', rbd: '3911', nombreEstablecimiento: 'Escuela A', estado: 'ausente', usuarioId: 'u2' }),
      crearSesion({ sessionId: 's3', rbd: '4055', nombreEstablecimiento: 'Liceo B', estado: 'activo', usuarioId: 'u3' }),
      crearSesion({ sessionId: 's4', rbd: null, nombreEstablecimiento: null, vistaActiva: 'colegios_asesorados', ultimaActividad: 5000, usuarioId: 'u4' })
    ];

    const { porEstablecimiento, enVistasGlobales } = agruparPresenciaPorEstablecimiento(sesiones);

    expect(porEstablecimiento).toHaveLength(2);
    // Escuela A tiene 2 usuarios, debe ir primero
    expect(porEstablecimiento[0].rbd).toBe('3911');
    expect(porEstablecimiento[0].usuarios).toHaveLength(2);
    expect(porEstablecimiento[0].activosCount).toBe(1);

    expect(porEstablecimiento[1].rbd).toBe('4055');
    expect(porEstablecimiento[1].activosCount).toBe(1);

    expect(enVistasGlobales).toHaveLength(1);
    expect(enVistasGlobales[0].sessionId).toBe('s4');
  });
});
