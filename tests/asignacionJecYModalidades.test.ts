import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolverCodigoYAmbitoAsignatura,
  PLANES_MINEDUC
} from '@slep/mineduc-engine';
import {
  normalizarNombreAsignatura,
  sonAsignaturasEquivalentes,
  esAsignacionLibreDisposicionJec,
  resolverPlanCurso,
  calcularDisponibilidadCurso
} from '../src/services/curricularPlanService';
import { calcularDiagnosticoColegio } from '../src/services/dotacionCalculationService';
import { getDb, persistDb } from '../src/database/dbCore';
import {
  autoIndexarAsignacionesHistoricas,
  listarAsignaciones
} from '../src/database/repositories/asignacionesRepo';
import { guardarCurso } from '../src/database/repositories/cursosRepo';
import { guardarDocente } from '../src/database/repositories/docentesRepo';
import { guardarEstablecimiento } from '../src/database/repositories/establecimientosRepo';
import {
  AsignacionHoraria,
  CursoSae,
  Docente,
  Establecimiento,
  PlanEstudioCurricular
} from '../src/types';

describe('Asignación Curricular, Libre Disposición JEC y Modalidades de Enseñanza', () => {
  describe('1. Desambiguación de "Talleres de Educación Física y Deporte" y talleres con palabras de asignaturas', () => {
    it('NUNCA secuestra talleres (singular o plural) como DIFERENCIADA_HC ni PLAN_COMUN', () => {
      const casos = [
        'Talleres de educación física y deporte',
        'Taller de Educación Física y Salud',
        'Taller de Química y Experimentación',
        'Club de Teatro Escolar',
        'Academia de Ciencias de la Salud',
        'Reforzamientos de Física y Matemática',
        'Taller de Danza Folclórica'
      ];

      for (const nombre of casos) {
        const resConContexto = resolverCodigoYAmbitoAsignatura(nombre, {
          nivelCurso: '6° Básico',
          esJec: true,
          ambitoExplicito: 'LIBRE_DISPOSICION_JEC'
        });
        expect(resConContexto.ambito).toBe('LIBRE_DISPOSICION_JEC');
        expect(resConContexto.codigo.startsWith('JEC-')).toBe(true);
        expect(resConContexto.esOficial).toBe(false);

        const resSinContexto = resolverCodigoYAmbitoAsignatura(nombre, {
          nivelCurso: '6° Básico'
        });
        expect(resSinContexto.ambito).toBe('LIBRE_DISPOSICION_JEC');
        expect(resSinContexto.codigo.startsWith('JEC-')).toBe(true);

        const norm = normalizarNombreAsignatura(nombre);
        expect(norm.startsWith('taller_')).toBe(true);
        expect(sonAsignaturasEquivalentes(nombre, 'Educación Física y Salud')).toBe(false);
        expect(sonAsignaturasEquivalentes(nombre, 'Física')).toBe(false);
        expect(sonAsignaturasEquivalentes(nombre, 'Química')).toBe(false);
      }
    });

    it('al asignar "Talleres de educación física y deporte" (4 HA) en 6° Básico JEC, descuenta de Libre Disposición y NO cubre Educación Física y Salud', () => {
      const curso: CursoSae = {
        id: 'curso-6b',
        rbd: '4001',
        nivel: '6° Básico',
        letra: 'A',
        regimen: 'JEC',
        cupoSae: 35,
        matriculaProyectada: 28,
        alumnosNeet: 3,
        alumnosNeep: 1,
        periodo: 2027
      };
      const infoPlan = resolverPlanCurso(curso, []);

      const asigTallerDeporte: AsignacionHoraria = {
        id: 'asig-taller-deporte',
        rbd: '4001',
        periodo: 2027,
        cursoId: 'curso-6b',
        docenteId: 'doc-edfis',
        asignatura: 'Talleres de educación física y deporte',
        codigoAsignatura: 'JEC-TALLERES_DE_EDUCACION_FISICA_Y',
        ambitoCurricular: 'LIBRE_DISPOSICION_JEC',
        horasPedagogicasAula: 4,
        esTallerJec: true
      };

      expect(esAsignacionLibreDisposicionJec(asigTallerDeporte, curso, infoPlan)).toBe(true);

      const disp = calcularDisponibilidadCurso(curso, infoPlan, [asigTallerDeporte]);
      const edFis = disp.todas.find(a => a.nombre === 'Educación Física y Salud');
      expect(edFis).toBeDefined();
      expect(edFis?.horasAsignadas).toBe(0);
      expect(edFis?.horasDisponibles).toBe(2);
      expect(edFis?.estado).toBe('DISPONIBLE');

      // Libre Disposición debe reflejar 4 HA asignadas y 2 HA restantes (6 - 4 = 2)
      expect(disp.horasLibrePlan).toBe(6);
      expect(disp.horasLibreAsignadas).toBe(4);
      expect(disp.horasLibreDisponibles).toBe(2);
    });

    it('en Balanza/Diagnóstico (calcularDiagnosticoColegio), el taller se imputa a Libre Disposición JEC y deja intacta Educación Física y Salud', () => {
      const est: Establecimiento = {
        id: 'est-4001',
        rbd: '4001',
        nombre: 'Escuela Prueba SLEP',
        comuna: 'Chillán',
        regimen: 'JEC',
        porcentajePrioritarios: 70
      };
      const curso: CursoSae = {
        id: 'curso-6b',
        rbd: '4001',
        nivel: '6° Básico',
        letra: 'A',
        regimen: 'JEC',
        cupoSae: 35,
        matriculaProyectada: 28,
        alumnosNeet: 3,
        alumnosNeep: 1,
        periodo: 2027
      };
      const doc: Docente = {
        id: 'doc-edfis',
        rbd: '4001',
        run: '15.111.222-3',
        nombres: 'CAMILO',
        apellidos: 'TORRES',
        calidadJuridica: 'TITULAR',
        estamento: 'DOCENTE_AULA',
        horasContrato: 30,
        horasSubvencionGeneralTitular: 30,
        periodo: 2027
      };
      const asigs: AsignacionHoraria[] = [
        {
          id: 'asig-edfis-plan',
          rbd: '4001',
          periodo: 2027,
          cursoId: 'curso-6b',
          docenteId: 'doc-edfis',
          asignatura: 'Educación Física y Salud',
          codigoAsignatura: 'PC-TRON-EDFIS',
          ambitoCurricular: 'PLAN_COMUN',
          horasPedagogicasAula: 2,
          esTallerJec: false
        },
        {
          id: 'asig-taller-deporte',
          rbd: '4001',
          periodo: 2027,
          cursoId: 'curso-6b',
          docenteId: 'doc-edfis',
          asignatura: 'Talleres de educación física y deporte',
          codigoAsignatura: 'JEC-TALLERES_DE_EDUCACION_FISICA_Y',
          ambitoCurricular: 'LIBRE_DISPOSICION_JEC',
          horasPedagogicasAula: 4,
          esTallerJec: true
        }
      ];

      const diag = calcularDiagnosticoColegio(est, [], [curso], [doc], asigs);
      const itemEdFis = diag.diagnosticoPorEspecialidad.find(e => e.asignatura === 'Educación Física y Salud');
      const itemLibre = diag.diagnosticoPorEspecialidad.find(e => e.asignatura === 'Libre Disposición JEC');

      expect(itemEdFis?.horasDemandadas).toBe(2);
      expect(itemEdFis?.horasAsignadas).toBe(2);
      expect(itemEdFis?.balance).toBe(0);

      expect(itemLibre?.horasDemandadas).toBe(6);
      expect(itemLibre?.horasAsignadas).toBe(4);
      expect(itemLibre?.balance).toBe(-2);
    });
  });

  describe('2. Modalidades, Horas Fraccionadas (0.5 / 1.5 HA), Divisiones de Plan y Planes BD', () => {
    it('soporta 7° a 8° Básico No JEC (33 HA con 2 HA de Libre Disposición) sin requerir JEC en curso', () => {
      const curso7NoJec: CursoSae = {
        id: 'curso-7-nojec',
        rbd: '4002',
        nivel: '7° Básico',
        letra: 'A',
        regimen: 'No JEC',
        cupoSae: 35,
        matriculaProyectada: 25,
        alumnosNeet: 2,
        alumnosNeep: 1,
        periodo: 2027
      };
      const infoPlan = resolverPlanCurso(curso7NoJec, []);
      expect(infoPlan.horasLibreDisposicion).toBe(2);

      const asigTaller: AsignacionHoraria = {
        id: 'asig-7nj-taller',
        rbd: '4002',
        periodo: 2027,
        cursoId: 'curso-7-nojec',
        docenteId: 'doc-1',
        asignatura: 'Talleres de Lenguaje',
        codigoAsignatura: 'JEC-TALLERES_DE_LENGUAJE',
        ambitoCurricular: 'LIBRE_DISPOSICION_JEC',
        horasPedagogicasAula: 2,
        esTallerJec: true
      };

      expect(esAsignacionLibreDisposicionJec(asigTaller, curso7NoJec, infoPlan)).toBe(true);
      const disp = calcularDisponibilidadCurso(curso7NoJec, infoPlan, [asigTaller]);
      expect(disp.horasLibrePlan).toBe(2);
      expect(disp.horasLibreAsignadas).toBe(2);
      expect(disp.horasLibreDisponibles).toBe(0);
    });

    it('en 1° a 2° Medio agrupa Biología + Física + Química como cobertura de Ciencias Naturales (6 HA)', () => {
      const curso1M: CursoSae = {
        id: 'curso-1m',
        rbd: '4003',
        nivel: '1° Medio',
        letra: 'A',
        regimen: 'JEC',
        cupoSae: 40,
        matriculaProyectada: 34,
        alumnosNeet: 2,
        alumnosNeep: 0,
        periodo: 2027
      };
      const infoPlan = resolverPlanCurso(curso1M, []);
      const asigsCiencias: AsignacionHoraria[] = [
        { id: 'c1', rbd: '4003', periodo: 2027, cursoId: 'curso-1m', docenteId: 'd-bio', asignatura: 'Biología', horasPedagogicasAula: 2, esTallerJec: false },
        { id: 'c2', rbd: '4003', periodo: 2027, cursoId: 'curso-1m', docenteId: 'd-fis', asignatura: 'Física', horasPedagogicasAula: 2, esTallerJec: false },
        { id: 'c3', rbd: '4003', periodo: 2027, cursoId: 'curso-1m', docenteId: 'd-qui', asignatura: 'Química', horasPedagogicasAula: 2, esTallerJec: false }
      ];

      const disp = calcularDisponibilidadCurso(curso1M, infoPlan, asigsCiencias);
      const ciencias = disp.todas.find(a => a.nombre === 'Ciencias Naturales');
      expect(ciencias?.horasPlan).toBe(6);
      expect(ciencias?.horasAsignadas).toBe(6);
      expect(ciencias?.estado).toBe('CUBIERTA');
    });

    it('prioriza el plan personalizado guardado en BD (planEstudioId) sobre el estándar MINEDUC', () => {
      const planCustom: PlanEstudioCurricular = {
        id: 'plan-custom-5b',
        nivel: '5° Básico Personalizado SLEP',
        regimen: 'JEC',
        categoria: 'BASICA',
        horasObligatorias: 34,
        horasLibreDisposicion: 4,
        totalHorasPlan: 38,
        asignaturas: [
          { nombre: 'Lenguaje y Comunicación', horasSemanales: 8, caracter: 'Obligatoria' },
          { nombre: 'Matemática', horasSemanales: 8, caracter: 'Obligatoria' }
        ],
        esPersonalizado: true
      };
      const curso: CursoSae = {
        id: 'c-5b-custom',
        rbd: '4004',
        nivel: '5° Básico',
        letra: 'A',
        regimen: 'JEC',
        cupoSae: 30,
        matriculaProyectada: 25,
        alumnosNeet: 1,
        alumnosNeep: 0,
        planEstudioId: 'plan-custom-5b'
      };

      const infoPlan = resolverPlanCurso(curso, [planCustom]);
      expect(infoPlan.esPersonalizadoBd).toBe(true);
      expect(infoPlan.horasLibreDisposicion).toBe(4);
      expect(infoPlan.asignaturas.find(a => a.nombre === 'Matemática')?.horas).toBe(8);
    });
  });

  describe('3. Auto-reparación en SQLite de asignaciones mal indexadas históricamente', () => {
    const rbd = '4999';
    beforeEach(async () => {
      const db = await getDb();
      db.run('DELETE FROM asignaciones_horarias WHERE rbd = ?', [rbd]);
      db.run('DELETE FROM docentes WHERE rbd = ?', [rbd]);
      db.run('DELETE FROM cursos_sae WHERE rbd = ?', [rbd]);
      db.run('DELETE FROM establecimientos WHERE rbd = ?', [rbd]);
      persistDb(true);

      await guardarEstablecimiento({
        id: `est_${rbd}`,
        rbd,
        nombre: 'Escuela Saneamiento Test',
        comuna: 'Bulnes',
        regimen: 'JEC',
        porcentajePrioritarios: 75
      });

      await guardarCurso({
        id: `curso_${rbd}_6a`,
        rbd,
        periodo: 2027,
        nivel: '6° Básico',
        letra: 'A',
        regimen: 'JEC',
        cupoSae: 35,
        matriculaProyectada: 25,
        alumnosNeet: 2,
        alumnosNeep: 1
      });

      await guardarDocente({
        id: `doc_${rbd}_2027_1`,
        rbd,
        periodo: 2027,
        run: '16.000.111-2',
        nombres: 'PEDRO',
        apellidos: 'RIVAS',
        calidadJuridica: 'TITULAR',
        estamento: 'DOCENTE_AULA',
        horasContrato: 30
      });
    });

    it('repara automáticamente en SQLite "Talleres de educación física y deporte" guardado erróneamente como DIFERENCIADA_HC / es_taller_jec = 0', async () => {
      const db = await getDb();
      db.run(
        `INSERT INTO asignaciones_horarias (
          id, rbd, curso_id, docente_id, es_taller_jec, asignatura, horas_pedagogicas_aula,
          periodo, es_taller_sep, es_trabajo_colaborativo, codigo_asignatura, ambito_curricular
        ) VALUES (?, ?, ?, ?, 0, ?, 4, 2027, 0, 0, 'DIF-HC-B-FIS-1', 'DIFERENCIADA_HC')`,
        ['asig_bug_deporte', rbd, `curso_${rbd}_6a`, `doc_${rbd}_2027_1`, 'Talleres de educación física y deporte']
      );

      // Ejecutar saneamiento automático y listar
      const actualizadas = await autoIndexarAsignacionesHistoricas(db);
      expect(actualizadas).toBeGreaterThanOrEqual(1);

      const asigs = await listarAsignaciones(rbd, 2027);
      const reparada = asigs.find(a => a.id === 'asig_bug_deporte');
      expect(reparada).toBeDefined();
      expect(reparada?.esTallerJec).toBe(true);
      expect(reparada?.ambitoCurricular).toBe('LIBRE_DISPOSICION_JEC');
      expect(reparada?.codigoAsignatura?.startsWith('JEC-')).toBe(true);
    });
  });
});
