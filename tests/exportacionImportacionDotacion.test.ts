import { describe, it, expect, beforeAll } from 'vitest';
import {
  getDb,
  guardarEstablecimiento,
  guardarSala,
  guardarCurso,
  guardarDocente,
  guardarAsignacion,
  exportarDotacionEstablecimiento,
  importarCartera,
  listarCursos,
  listarDocentes,
  listarAsignaciones,
  obtenerEstablecimientoPorRbd
} from '../src/database/db';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria, SalaInfraestructura } from '../src/types';

describe('Sistema Compatible de Exportación e Importación de Dotaciones (Asesor -> Consolidador)', () => {
  const colegioA: Establecimiento = {
    id: 'est-col-a',
    rbd: '11111',
    nombre: 'Escuela Los Robles',
    comuna: 'Bulnes',
    regimen: 'JEC',
    porcentajePrioritarios: 82,
    asesorUatp: 'Asesor Carlos'
  };

  const colegioB: Establecimiento = {
    id: 'est-col-b',
    rbd: '22222',
    nombre: 'Liceo Las Araucarias',
    comuna: 'San Ignacio',
    regimen: 'JEC',
    porcentajePrioritarios: 74,
    asesorUatp: 'Asesora Andrea'
  };

  beforeAll(async () => {
    await getDb();
    await guardarEstablecimiento(colegioA);
    await guardarEstablecimiento(colegioB);

    // Cursos y dotación para colegio A
    const cursoA: CursoSae = {
      id: 'c-a1',
      rbd: '11111',
      periodo: 2026,
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 25,
      alumnosNeet: 3,
      alumnosNeep: 1
    };
    await guardarCurso(cursoA);

    const docA: Docente = {
      id: 'd-a1',
      rbd: '11111',
      periodo: 2026,
      run: '10.000.001-1',
      nombres: 'Roberto',
      apellidos: 'Muñoz',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44
    };
    await guardarDocente(docA);

    const asigA: AsignacionHoraria = {
      id: 'as-a1',
      rbd: '11111',
      periodo: 2026,
      cursoId: 'c-a1',
      docenteId: 'd-a1',
      asignatura: 'Lenguaje',
      horasPedagogicasAula: 8
    };
    await guardarAsignacion(asigA);
  });

  it('exporta la dotación exclusiva del colegio del asesor con metadatos compatibles', async () => {
    const exported = await exportarDotacionEstablecimiento('11111', 2026, 'Asesor Carlos', 'carlos@slep.cl');

    expect(exported.tipo).toBe('DOTACION_ESTABLECIMIENTO');
    expect(exported.version).toBe('1.2.0');
    expect(exported.periodo).toBe(2026);
    expect(exported.rbd).toBe('11111');
    expect(exported.establecimiento.nombre).toBe('Escuela Los Robles');
    expect(exported.cursos.length).toBe(1);
    expect(exported.docentes.length).toBe(1);
    expect(exported.asignaciones.length).toBe(1);
    expect(exported.asesor.nombre).toBe('Asesor Carlos');
  });

  it('el consolidador ingesta la dotación individual del asesor sin pisar los otros colegios', async () => {
    // 1. Modificar los datos exportados simulando trabajo del asesor
    const dotacionAsesor = await exportarDotacionEstablecimiento('11111', 2026);
    dotacionAsesor.cursos.push({
      id: 'c-a2',
      rbd: '11111',
      periodo: 2026,
      nivel: '2° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 27,
      alumnosNeet: 2,
      alumnosNeep: 0
    });

    // 2. Ingestar por el consolidador
    const resImport = await importarCartera(dotacionAsesor);
    expect(resImport.tipo).toBe('DOTACION_ESTABLECIMIENTO');
    expect(resImport.importados).toBe(1);
    expect(resImport.colegiosNombres).toContain('Escuela Los Robles');

    // 3. Verificar que colegio A tiene sus 2 cursos
    const cursosA = await listarCursos('11111', 2026);
    expect(cursosA.length).toBe(2);

    // 4. Verificar que colegio B sigue intacto
    const estB = await obtenerEstablecimientoPorRbd('22222');
    expect(estB).toBeDefined();
    expect(estB?.nombre).toBe('Liceo Las Araucarias');
  });
});
