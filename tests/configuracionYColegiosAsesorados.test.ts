import { describe, it, expect, beforeEach } from 'vitest';
import {
  cargarConfiguracionGeneral,
  guardarConfiguracionGeneral,
  guardarPerfilAsesor,
  eliminarPerfilAsesor,
  establecerAsesorActivo,
  restablecerConfiguracionPorDefecto,
  reasignarColegiosMasivo,
  CONFIGURACION_DEFAULT
} from '../src/services/configuracionGeneralService';
import { Establecimiento, PerfilAsesor } from '../src/types';
import { getDb, guardarEstablecimiento, listarEstablecimientos } from '../src/database/db';

describe('Servicio de Configuraciones Generales y Colegios Asesorados', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('carga la configuración por defecto cuando no hay datos guardados', () => {
    const config = cargarConfiguracionGeneral();
    expect(config).toBeDefined();
    expect(config.asesorActivoNombre).toBe('Rodrigo Fuentes Uribe');
    expect(config.asesoresRegistrados.length).toBeGreaterThanOrEqual(4);
    expect(config.parametrosMineduc.umbralPrioritarios60_40).toBe(80);
    expect(config.parametrosMineduc.topeHorasDocenteSlep).toBe(44);
    expect(config.ui.periodoPredeterminado).toBe(2026);
  });

  it('guarda y recupera cambios en la configuración general', () => {
    const config = cargarConfiguracionGeneral();
    config.asesorActivoNombre = 'Marcela Navarrete Díaz';
    config.parametrosMineduc.umbralPrioritarios60_40 = 75;
    config.gemini.model = 'gemini-1.5-pro';

    guardarConfiguracionGeneral(config);

    const reloaded = cargarConfiguracionGeneral();
    expect(reloaded.asesorActivoNombre).toBe('Marcela Navarrete Díaz');
    expect(reloaded.parametrosMineduc.umbralPrioritarios60_40).toBe(75);
    expect(reloaded.gemini.model).toBe('gemini-1.5-pro');
  });

  it('permite registrar, actualizar y eliminar asesores UATP', () => {
    const nuevoAsesor: PerfilAsesor = {
      id: 'asesor-test-1',
      nombre: 'Valeska Alarcón',
      email: 'valeska.alarcon@slepvallediguillin.cl',
      cargo: 'Asesora Curricular UATP',
      comunasPreferentes: ['El Carmen']
    };

    let config = guardarPerfilAsesor(nuevoAsesor);
    expect(config.asesoresRegistrados.some(a => a.id === 'asesor-test-1')).toBe(true);

    // Actualizar datos
    nuevoAsesor.telefono = '+56 9 1122 3344';
    config = guardarPerfilAsesor(nuevoAsesor);
    const encontrado = config.asesoresRegistrados.find(a => a.id === 'asesor-test-1');
    expect(encontrado?.telefono).toBe('+56 9 1122 3344');

    // Cambiar a activo
    config = establecerAsesorActivo('asesor-test-1');
    expect(config.asesorActivoId).toBe('asesor-test-1');
    expect(config.asesorActivoNombre).toBe('Valeska Alarcón');

    // Eliminar asesor
    config = eliminarPerfilAsesor('asesor-test-1');
    expect(config.asesoresRegistrados.some(a => a.id === 'asesor-test-1')).toBe(false);
  });

  it('restablece las configuraciones a sus valores de fábrica', () => {
    const config = cargarConfiguracionGeneral();
    config.parametrosMineduc.topeHorasDocenteSlep = 38;
    guardarConfiguracionGeneral(config);

    const restablecido = restablecerConfiguracionPorDefecto();
    expect(restablecido.parametrosMineduc.topeHorasDocenteSlep).toBe(44);
  });

  it('permite reasignación masiva de colegios a un asesor', async () => {
    await getDb();
    const colegio1: Establecimiento = {
      id: 'est-test-reasignar-1',
      rbd: '99901',
      nombre: 'Escuela Rural Test 1',
      comuna: 'San Ignacio',
      regimen: 'JEC',
      porcentajePrioritarios: 85,
      asesorUatp: 'Rodrigo Fuentes Uribe'
    };
    const colegio2: Establecimiento = {
      id: 'est-test-reasignar-2',
      rbd: '99902',
      nombre: 'Escuela Rural Test 2',
      comuna: 'Bulnes',
      regimen: 'JEC',
      porcentajePrioritarios: 80,
      asesorUatp: 'Rodrigo Fuentes Uribe'
    };

    await guardarEstablecimiento(colegio1);
    await guardarEstablecimiento(colegio2);

    const lista = await listarEstablecimientos();
    await reasignarColegiosMasivo(['99901', '99902'], 'Marcela Navarrete Díaz', lista);

    const actualizados = await listarEstablecimientos();
    const c1 = actualizados.find(c => c.rbd === '99901');
    const c2 = actualizados.find(c => c.rbd === '99902');

    expect(c1?.asesorUatp).toBe('Marcela Navarrete Díaz');
    expect(c2?.asesorUatp).toBe('Marcela Navarrete Díaz');
  });
});
