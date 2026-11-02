import { describe, it, expect, beforeEach } from 'vitest';
import {
  listarEstablecimientos,
  guardarEstablecimiento,
  eliminarEstablecimiento,
  obtenerEstablecimientoPorRbd
} from '../src/database/repositories/establecimientosRepo';
import { guardarCurso, listarCursos } from '../src/database/repositories/cursosRepo';
import { guardarDocente, listarDocentes } from '../src/database/repositories/docentesRepo';
import { sincronizarCatalogoEstablecimientos } from '../src/database/seedData';
import { Establecimiento } from '../src/types';

describe('Gestión de Establecimientos Educacionales por el Super Usuario', () => {
  const TEST_RBD = '99999';
  const TEST_COLEGIO: Establecimiento = {
    id: `est-${TEST_RBD}`,
    rbd: TEST_RBD,
    nombre: 'Escuela Tecnológica de Prueba SLEP',
    comuna: 'San Ignacio',
    regimen: 'JEC',
    porcentajePrioritarios: 85.5,
    director: 'Profesor Director Prueba',
    asesorUatp: 'Asesor UATP Oficial',
    telefono: '+56 9 1234 5678',
    email: 'contacto.99999@slepvallediguillin.cl',
    subvencionSepMensual: 1500000,
    subvencionProRetencion: 500000,
    cupoHorasPieDiferencial: 44,
    cupoHorasPieAsistentes: 30
  };

  beforeEach(async () => {
    // Asegurar que no exista previamente
    await eliminarEstablecimiento(TEST_RBD);
  });

  it('permite al super usuario agregar un nuevo establecimiento con todos sus campos', async () => {
    await guardarEstablecimiento(TEST_COLEGIO, true);

    const recuperado = await obtenerEstablecimientoPorRbd(TEST_RBD);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.rbd).toBe(TEST_RBD);
    expect(recuperado?.nombre).toBe('Escuela Tecnológica de Prueba SLEP');
    expect(recuperado?.comuna).toBe('San Ignacio');
    expect(recuperado?.regimen).toBe('JEC');
    expect(recuperado?.porcentajePrioritarios).toBe(85.5);
    expect(recuperado?.director).toBe('Profesor Director Prueba');
    expect(recuperado?.asesorUatp).toBe('Asesor UATP Oficial');
    expect(recuperado?.subvencionSepMensual).toBe(1500000);
    expect(recuperado?.cupoHorasPieDiferencial).toBe(44);

    const todos = await listarEstablecimientos();
    const existeEnLista = todos.some(c => c.rbd === TEST_RBD);
    expect(existeEnLista).toBe(true);
  });

  it('permite al super usuario eliminar un establecimiento y limpia en cascada sus dotaciones', async () => {
    // 1. Crear el establecimiento
    await guardarEstablecimiento(TEST_COLEGIO, true);

    // 2. Asociar un curso y un docente a este RBD
    await guardarCurso({
      id: `curso-${TEST_RBD}-1`,
      rbd: TEST_RBD,
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 28,
      alumnosNeet: 5,
      alumnosNeep: 2,
      periodo: 2027
    });

    await guardarDocente({
      id: `doc-${TEST_RBD}-1`,
      rbd: TEST_RBD,
      run: '12345678-9',
      nombres: 'Docente',
      apellidos: 'Prueba SLEP',
      calidadJuridica: 'Titular',
      estamento: 'Docente de Aula',
      horasContrato: 44,
      horasAula: 30,
      periodo: 2027
    });

    // Verificar que existen
    const cursosAntes = await listarCursos(TEST_RBD, 2027);
    expect(cursosAntes.length).toBe(1);
    const docsAntes = await listarDocentes(TEST_RBD, 2027);
    expect(docsAntes.length).toBe(1);

    // 3. Eliminar el establecimiento
    await eliminarEstablecimiento(TEST_RBD);

    // 4. Verificar que el establecimiento y sus dependencias fueron eliminados
    const recuperado = await obtenerEstablecimientoPorRbd(TEST_RBD);
    expect(recuperado).toBeNull();

    const cursosDespues = await listarCursos(TEST_RBD, 2027);
    expect(cursosDespues.length).toBe(0);

    const docsDespues = await listarDocentes(TEST_RBD, 2027);
    expect(docsDespues.length).toBe(0);

    const listaActual = await listarEstablecimientos();
    expect(listaActual.some(c => c.rbd === TEST_RBD)).toBe(false);
  });

  it('evita que el sincronizador de catálogo oficial resucite un colegio eliminado por el super usuario', async () => {
    // Si se elimina un RBD registrado en `slep_rbds_eliminados`, `sincronizarCatalogoEstablecimientos` no lo reinserta
    const rbdEliminar = '3451'; // Liceo Manuel Bulnes en catálogo
    await eliminarEstablecimiento(rbdEliminar);

    // Ejecutar sincronizador de catálogo
    await sincronizarCatalogoEstablecimientos(false);

    const postSync = await obtenerEstablecimientoPorRbd(rbdEliminar);
    expect(postSync).toBeNull();

    // Limpiar: si el usuario lo vuelve a guardar, se reactiva
    await guardarEstablecimiento({
      id: `est-${rbdEliminar}`,
      rbd: rbdEliminar,
      nombre: 'Liceo Bicentenario Manuel Bulnes',
      comuna: 'Bulnes',
      regimen: 'JEC',
      porcentajePrioritarios: 75
    }, true);

    const restaurado = await obtenerEstablecimientoPorRbd(rbdEliminar);
    expect(restaurado).not.toBeNull();
  });
});
