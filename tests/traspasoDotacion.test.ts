import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  getDb,
  guardarEstablecimiento,
  guardarCurso,
  guardarDocente,
  guardarAsignacion,
  listarCursos,
  listarDocentes,
  listarAsignaciones,
  listarEventosAuditoria,
  borrarDotacionPeriodo
} from '../src/database/db';
import {
  diagnosticarTraspasoColegio,
  ejecutarTraspasoPeriodoColegio
} from '../src/services/traspasoDotacionService';
import type { Establecimiento, CursoSae, Docente, AsignacionHoraria } from '../src/types';

describe('Motor de Traspaso de Dotación 2026 -> 2027 por Escuela', () => {
  const rbdTest = '77777';

  beforeAll(async () => {
    await getDb();
  });

  beforeEach(async () => {
    await borrarDotacionPeriodo(2026, rbdTest);
    await borrarDotacionPeriodo(2027, rbdTest);

    const est: Establecimiento = {
      id: `est_${rbdTest}`,
      rbd: rbdTest,
      nombre: 'ESCUELA BASICA EXPERIMENTAL EL DIGUILLIN',
      comuna: 'San Ignacio',
      regimen: 'JEC',
      porcentajePrioritarios: 85,
      director: 'Patricia Andrea Morales'
    };
    await guardarEstablecimiento(est);

    // Cursos 2026
    const cPK: CursoSae = {
      id: `c_${rbdTest}_2026_PK`,
      rbd: rbdTest,
      periodo: 2026,
      nivel: 'Pre-Kínder',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 25,
      matriculaProyectada: 20
    };
    const c1B: CursoSae = {
      id: `c_${rbdTest}_2026_1B`,
      rbd: rbdTest,
      periodo: 2026,
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 30
    };
    const c8B: CursoSae = {
      id: `c_${rbdTest}_2026_8B`,
      rbd: rbdTest,
      periodo: 2026,
      nivel: '8° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 28
    };

    await guardarCurso(cPK);
    await guardarCurso(c1B);
    await guardarCurso(c8B);

    // Docentes 2026
    const dDirector: Docente = {
      id: `doc_${rbdTest}_2026_dir`,
      rbd: rbdTest,
      periodo: 2026,
      run: '10.111.222-3',
      nombres: 'Patricia Andrea',
      apellidos: 'Morales',
      calidadJuridica: 'TITULAR',
      estamento: 'DIRECTIVO',
      cargoInstitucional: 'DIRECTORA',
      horasContrato: 44,
      horasDirectivas: 44
    };

    const dTitular: Docente = {
      id: `doc_${rbdTest}_2026_tit`,
      rbd: rbdTest,
      periodo: 2026,
      run: '12.333.444-5',
      nombres: 'Roberto',
      apellidos: 'Lara',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30
    };

    const dContrata: Docente = {
      id: `doc_${rbdTest}_2026_con`,
      rbd: rbdTest,
      periodo: 2026,
      run: '18.555.666-7',
      nombres: 'Camila',
      apellidos: 'Vargas',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 20
    };

    await guardarDocente(dDirector);
    await guardarDocente(dTitular);
    await guardarDocente(dContrata);

    // Asignaciones 2026
    const asig1: AsignacionHoraria = {
      id: `asig_${rbdTest}_2026_1`,
      rbd: rbdTest,
      periodo: 2026,
      cursoId: c1B.id,
      docenteId: dTitular.id,
      asignatura: 'Lenguaje y Comunicación',
      horasPedagogicasAula: 8
    };
    await guardarAsignacion(asig1);
  });

  it('diagnostica correctamente el estado previo del establecimiento para el traspaso', async () => {
    const diag = await diagnosticarTraspasoColegio(rbdTest, 2026, 2027);
    expect(diag.rbd).toBe(rbdTest);
    expect(diag.totalCursosOrigen).toBe(3);
    expect(diag.totalDocentesOrigen).toBe(3);
    expect(diag.totalTitulares).toBe(2);
    expect(diag.totalContratas).toBe(1);
    expect(diag.totalHorasContratoOrigen).toBe(94); // 44 + 30 + 20
    expect(diag.directorDetectado).toContain('Patricia Andrea Morales');
    expect(diag.cursosYaExistenEnDestino).toBe(0);
  });

  it('ejecuta el traspaso 2026 -> 2027 promoviendo niveles, egresando 8° Básico y regenerando Pre-Kínder', async () => {
    const resultado = await ejecutarTraspasoPeriodoColegio(rbdTest, 2026, 2027, {
      promoverCursos: true,
      estrategiaDocentes: 'TODOS',
      estrategiaAsignaciones: 'REPLICAR_CONTINUIDAD'
    });

    expect(resultado.exito).toBe(true);

    const cursos2027 = await listarCursos(rbdTest, 2027);
    // Pre-Kínder -> Kínder (1) + 1° Básico -> 2° Básico (1) + 8° Básico egresa (0) + Regeneración Pre-Kínder (1) = 3 cursos
    expect(cursos2027.length).toBe(3);
    const niveles2027 = cursos2027.map(c => c.nivel);
    expect(niveles2027).toContain('Kínder');
    expect(niveles2027).toContain('2° Básico');
    expect(niveles2027).toContain('Pre-Kínder');
    expect(niveles2027).not.toContain('8° Básico');

    // Docentes
    const docentes2027 = await listarDocentes(rbdTest, 2027);
    expect(docentes2027.length).toBe(3);

    const director2027 = docentes2027.find(d => d.run === '10.111.222-3');
    expect(director2027).toBeDefined();
    expect(director2027?.horasDirectivas).toBe(44);

    // Auditoría
    const eventos = await listarEventosAuditoria(rbdTest, 2027);
    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos[0].tipoEvento).toBe('TRASPASO');
  });

  it('permite filtrar para traspasar SOLO_TITULARES excluyendo contratas', async () => {
    const resultado = await ejecutarTraspasoPeriodoColegio(rbdTest, 2026, 2027, {
      promoverCursos: true,
      estrategiaDocentes: 'SOLO_TITULARES',
      estrategiaAsignaciones: 'REPLICAR_CONTINUIDAD'
    });

    expect(resultado.exito).toBe(true);
    const docentes2027 = await listarDocentes(rbdTest, 2027);
    expect(docentes2027.length).toBe(2);
    expect(docentes2027.every(d => d.calidadJuridica === 'TITULAR')).toBe(true);
  });
});
