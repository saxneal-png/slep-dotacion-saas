import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  getDb,
  guardarEstablecimiento,
  guardarSala,
  guardarCurso,
  guardarDocente,
  guardarAsignacion,
  exportarDotacionEstablecimiento,
  exportarPaqueteEstablecimiento,
  importarPaqueteEstablecimiento,
  normalizarPaqueteEstablecimiento,
  listarCursos,
  listarDocentes,
  listarAsignaciones,
  listarSalas
} from '../src/database/db';
import { guardarAsistente, listarAsistentes } from '../src/database/repositories/asistentesRepo';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria, SalaInfraestructura, AsistenteEducacion } from '../src/types';

describe('Importación y Exportación de Fichas de Establecimiento (.slep y .json)', () => {
  const colegioOrigen: Establecimiento = {
    id: 'est-slep-1',
    rbd: '99001',
    nombre: 'Escuela Rural El Roble',
    comuna: 'Bulnes',
    regimen: 'JEC',
    porcentajePrioritarios: 85,
    asesorUatp: 'Asesor UATP Test'
  };

  const colegioDestino: Establecimiento = {
    id: 'est-slep-2',
    rbd: '99002',
    nombre: 'Liceo Bicentenario Cordillera',
    comuna: 'San Ignacio',
    regimen: 'JEC',
    porcentajePrioritarios: 70,
    asesorUatp: 'Asesora Andrea'
  };

  beforeAll(async () => {
    await getDb();
    await guardarEstablecimiento(colegioOrigen);
    await guardarEstablecimiento(colegioDestino);
  });

  beforeEach(async () => {
    const db = await getDb();
    // Limpiar datos de prueba
    db.run("DELETE FROM asignaciones_horarias WHERE rbd IN ('99001', '99002');");
    db.run("DELETE FROM cursos_sae WHERE rbd IN ('99001', '99002');");
    db.run("DELETE FROM docentes WHERE rbd IN ('99001', '99002');");
    db.run("DELETE FROM asistentes_educacion WHERE rbd IN ('99001', '99002');");
    db.run("DELETE FROM salas_infraestructura WHERE rbd IN ('99001', '99002');");

    // Datos iniciales en colegioOrigen (2026)
    await guardarSala({
      id: 'sala-orig-1',
      rbd: '99001',
      nombreSala: 'Sala 1 - Multiuso',
      superficieM2: 45,
      tipo: 'AULA_COMUN',
      aforoMaximo: 35
    });

    await guardarCurso({
      id: 'curso-orig-1',
      rbd: '99001',
      periodo: 2026,
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 28,
      alumnosNeet: 2,
      alumnosNeep: 0
    });

    await guardarDocente({
      id: 'doc-orig-1',
      rbd: '99001',
      periodo: 2026,
      run: '11.111.111-1',
      nombres: 'María',
      apellidos: 'Fernández',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44
    });

    await guardarAsistente(db, {
      id: 'ast-orig-1',
      rbd: '99001',
      periodo: 2026,
      run: '12.222.222-2',
      nombres: 'Pedro',
      apellidos: 'Soto',
      cargoFuncion: 'Inspector de Patio',
      estamento: 'PARADOCENTES',
      horasContrato: 44,
      horasSubvencionGeneralIndefinido: 44,
      horasSubvencionGeneralPlazoFijo: 0,
      horasSepIndefinido: 0,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 0,
      horasPiePlazoFijo: 0,
      activo: true
    });

    await guardarAsignacion({
      id: 'asig-orig-1',
      rbd: '99001',
      periodo: 2026,
      cursoId: 'curso-orig-1',
      docenteId: 'doc-orig-1',
      asignatura: 'Matemática',
      horasPedagogicasAula: 6
    });
  });

  it('normaliza tanto archivos exportados por asesor (.slep / DOTACION_ESTABLECIMIENTO) como paquetes (.slep.json / SLEP_ESTABLECIMIENTO_PACKAGE)', async () => {
    // 1. Archivo generado por exportarDotacionEstablecimiento (la función que genera el .slep del asesor)
    const archivoSlep = await exportarDotacionEstablecimiento('99001', 2026);
    expect(archivoSlep.tipo).toBe('DOTACION_ESTABLECIMIENTO');
    expect(archivoSlep.asistentes.length).toBe(1);

    const norm1 = normalizarPaqueteEstablecimiento(archivoSlep);
    expect(norm1.valido).toBe(true);
    expect(norm1.establecimiento.rbd).toBe('99001');
    expect(norm1.cursos.length).toBe(1);
    expect(norm1.docentes.length).toBe(1);
    expect(norm1.asistentes.length).toBe(1);

    // 2. Archivo generado por exportarPaqueteEstablecimiento
    const paqueteSlep = await exportarPaqueteEstablecimiento('99001', 2026);
    expect(paqueteSlep.formato).toBe('SLEP_ESTABLECIMIENTO_PACKAGE');
    expect(paqueteSlep.asistentes?.length).toBe(1);

    const norm2 = normalizarPaqueteEstablecimiento(paqueteSlep);
    expect(norm2.valido).toBe(true);
    expect(norm2.establecimiento.rbd).toBe('99001');
    expect(norm2.cursos.length).toBe(1);
    expect(norm2.docentes.length).toBe(1);
    expect(norm2.asistentes.length).toBe(1);
  });

  it('importa a un período diferente (ej: 2027) preguntado por el usuario', async () => {
    const db = await getDb();
    const archivoSlep = await exportarDotacionEstablecimiento('99001', 2026);

    // Importar hacia el período 2027 en el mismo colegio
    const resultado = await importarPaqueteEstablecimiento(archivoSlep, '99001', 2027, 'REEMPLAZAR');

    expect(resultado.exito).toBe(true);
    expect(resultado.periodoDestino).toBe(2027);
    expect(resultado.cursosImportados).toBe(1);
    expect(resultado.docentesImportados).toBe(1);
    expect(resultado.asistentesImportados).toBe(1);
    expect(resultado.asignacionesImportadas).toBe(1);

    // Verificar en la BD que ahora existen en 2027
    const cursos2027 = await listarCursos('99001', 2027);
    expect(cursos2027.length).toBe(1);
    expect(cursos2027[0].periodo).toBe(2027);

    const docentes2027 = await listarDocentes('99001', 2027);
    expect(docentes2027.length).toBe(1);
    expect(docentes2027[0].periodo).toBe(2027);

    const asistentes2027 = await listarAsistentes(db, '99001', 2027);
    expect(asistentes2027.length).toBe(1);
    expect(asistentes2027[0].periodo).toBe(2027);

    // Y que los originales de 2026 siguen existiendo
    const cursos2026 = await listarCursos('99001', 2026);
    expect(cursos2026.length).toBe(1);
  });

  it('permite REEMPLAZAR la dotación existente de un período limpiamente sin duplicados', async () => {
    const db = await getDb();

    // Crear un docente previo en el colegio destino que será reemplazado
    await guardarDocente({
      id: 'doc-viejo',
      rbd: '99002',
      periodo: 2026,
      run: '19.999.999-9',
      nombres: 'Docente',
      apellidos: 'Antiguo',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 20
    });

    const archivoSlep = await exportarDotacionEstablecimiento('99001', 2026);

    // Importar hacia colegio destino (99002) en modo REEMPLAZAR
    const resultado = await importarPaqueteEstablecimiento(archivoSlep, '99002', 2026, 'REEMPLAZAR');
    expect(resultado.exito).toBe(true);
    expect(resultado.modoAplicado).toBe('REEMPLAZAR');

    const docentesDestino = await listarDocentes('99002', 2026);
    expect(docentesDestino.length).toBe(1);
    // El docente antiguo fue eliminado, ahora está la docente importada
    expect(docentesDestino[0].run).toBe('11.111.111-1');

    const asistentesDestino = await listarAsistentes(db, '99002', 2026);
    expect(asistentesDestino.length).toBe(1);
    expect(asistentesDestino[0].run).toBe('12.222.222-2');
  });

  it('permite FUSIONAR con la dotación existente conservando lo previo y agregando lo nuevo', async () => {
    const db = await getDb();

    // En colegio destino (99002), creamos un docente existente
    await guardarDocente({
      id: 'doc-existente-previo',
      rbd: '99002',
      periodo: 2026,
      run: '18.888.888-8',
      nombres: 'Profesor',
      apellidos: 'Existente',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30
    });

    const archivoSlep = await exportarDotacionEstablecimiento('99001', 2026);

    // Importar hacia colegio destino (99002) en modo FUSIONAR
    const resultado = await importarPaqueteEstablecimiento(archivoSlep, '99002', 2026, 'FUSIONAR');
    expect(resultado.exito).toBe(true);
    expect(resultado.modoAplicado).toBe('FUSIONAR');

    const docentesDestino = await listarDocentes('99002', 2026);
    // Deben estar AMBOS: el existente previo (18.888.888-8) y el importado (11.111.111-1)
    expect(docentesDestino.length).toBe(2);
    const runs = docentesDestino.map(d => d.run);
    expect(runs).toContain('18.888.888-8');
    expect(runs).toContain('11.111.111-1');
  });
});
