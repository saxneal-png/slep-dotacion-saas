import { describe, it, expect } from 'vitest';
import { 
  normalizarNombreAsignatura, 
  sonAsignaturasEquivalentes, 
  calcularDisponibilidadCurso 
} from '../src/components/DocenteAsignacionPanel';
import { CursoSae, AsignacionHoraria } from '../src/types';

describe('Aislamiento de Talleres JEC y Libre Disposición vs Plan de Estudio', () => {
  describe('Equivalencias y Normalización', () => {
    it('no debe considerar equivalentes un taller/reforzamiento con la asignatura troncal del plan', () => {
      expect(sonAsignaturasEquivalentes('Taller de Matemáticas', 'Matemática')).toBe(false);
      expect(sonAsignaturasEquivalentes('Taller de Matemática', 'Matemáticas')).toBe(false);
      expect(sonAsignaturasEquivalentes('Taller de Lenguaje', 'Lengua y Literatura')).toBe(false);
      expect(sonAsignaturasEquivalentes('Refuerzo Educativo Matemáticas', 'Matemática')).toBe(false);
      expect(sonAsignaturasEquivalentes('Taller JEC Inglés', 'Idioma Extranjero: Inglés')).toBe(false);
    });

    it('debe respetar asignaturas oficiales MINEDUC que contengan la palabra Taller', () => {
      // Taller de Literatura es un electivo oficial de 3° y 4° Medio HC
      expect(sonAsignaturasEquivalentes('Taller de Literatura', 'Taller de Literatura')).toBe(true);
      // Taller Laboral en Educación Especial
      expect(sonAsignaturasEquivalentes('Taller Laboral', 'Taller Laboral')).toBe(true);
    });

    it('normaliza talleres identificándolos como taller_ para evitar colisiones en tablas', () => {
      const normTallerMate = normalizarNombreAsignatura('Taller de Matemáticas');
      const normMate = normalizarNombreAsignatura('Matemática');
      expect(normTallerMate).not.toBe(normMate);
      expect(normTallerMate.startsWith('taller_')).toBe(true);
    });
  });

  describe('Cálculo de Disponibilidad de Curso (calcularDisponibilidadCurso)', () => {
    const cursoJec: CursoSae = {
      id: 'curso_5_basico_a',
      colegioId: 'escuela_1',
      periodo: 2026,
      grado: 5,
      nivel: 'Básica',
      letra: 'A',
      regimen: 'JEC',
      jornada: 'COMPLETA',
      alumnosMatriculados: 30,
      capacidadAula: 35
    };

    const infoPlan = {
      esJec: true,
      horasMinimasJec: 38,
      horasLibreDisposicion: 6,
      asignaturas: [
        { nombre: 'Lengua y Literatura', horas: 6, caracter: 'Plan Común' },
        { nombre: 'Matemática', horas: 7, caracter: 'Plan Común' },
        { nombre: 'Ciencias Naturales', horas: 4, caracter: 'Plan Común' },
        { nombre: 'Historia, Geografía y Ciencias Sociales', horas: 4, caracter: 'Plan Común' },
        { nombre: 'Idioma Extranjero: Inglés', horas: 3, caracter: 'Plan Común' },
        { nombre: 'Educación Física y Salud', horas: 2, caracter: 'Plan Común' },
        { nombre: 'Artes Visuales', horas: 2, caracter: 'Plan Común' },
        { nombre: 'Música', horas: 2, caracter: 'Plan Común' },
        { nombre: 'Tecnología', horas: 1, caracter: 'Plan Común' },
        { nombre: 'Orientación', horas: 1, caracter: 'Plan Común' }
      ]
    };

    it('al asignar 2 horas de Taller de Matemáticas (JEC), descuenta de Libre Disposición y NO de Matemática regular', () => {
      const asignacionTallerJec: AsignacionHoraria = {
        id: 'asig_taller_1',
        docenteId: 'doc_1',
        colegioId: 'escuela_1',
        cursoId: 'curso_5_basico_a',
        asignatura: 'Taller de Matemáticas',
        horasPedagogicasAula: 2,
        horasSemanales: 2,
        esTallerJec: true,
        regimenCurso: 'JEC',
        periodo: 2026
      };

      const resultado = calcularDisponibilidadCurso(cursoJec, infoPlan, [asignacionTallerJec]);

      // Verificar que Matemática del plan de estudio regular siga con 7 horas disponibles y 0 asignadas
      const matePlan = resultado.todas.find(a => a.nombre === 'Matemática');
      expect(matePlan).toBeDefined();
      expect(matePlan?.horasPlan).toBe(7);
      expect(matePlan?.horasAsignadas).toBe(0);
      expect(matePlan?.horasDisponibles).toBe(7);
      expect(matePlan?.estado).toBe('DISPONIBLE');

      // Verificar que Libre Disposición ahora tenga 2 horas asignadas y 4 disponibles (6 - 2 = 4)
      expect(resultado.horasLibrePlan).toBe(6);
      expect(resultado.horasLibreAsignadas).toBe(2);
      expect(resultado.horasLibreDisponibles).toBe(4);
    });

    it('al asignar Matemática (7 HA) y Taller de Matemáticas (2 HA), ambos se contabilizan en sus respectivos conceptos', () => {
      const asigMateRegular: AsignacionHoraria = {
        id: 'asig_mate_reg',
        docenteId: 'doc_1',
        colegioId: 'escuela_1',
        cursoId: 'curso_5_basico_a',
        asignatura: 'Matemática',
        horasPedagogicasAula: 7,
        horasSemanales: 7,
        esTallerJec: false,
        regimenCurso: 'JEC',
        periodo: 2026
      };

      const asigTaller: AsignacionHoraria = {
        id: 'asig_taller_mate',
        docenteId: 'doc_2',
        colegioId: 'escuela_1',
        cursoId: 'curso_5_basico_a',
        asignatura: 'Taller de Matemáticas',
        horasPedagogicasAula: 2,
        horasSemanales: 2,
        esTallerJec: true,
        regimenCurso: 'JEC',
        periodo: 2026
      };

      const resultado = calcularDisponibilidadCurso(cursoJec, infoPlan, [asigMateRegular, asigTaller]);

      const matePlan = resultado.todas.find(a => a.nombre === 'Matemática');
      expect(matePlan?.horasAsignadas).toBe(7);
      expect(matePlan?.horasDisponibles).toBe(0);
      expect(matePlan?.estado).toBe('CUBIERTA');

      // Libre disposición computa exclusivamente las 2 horas de taller
      expect(resultado.horasLibrePlan).toBe(6);
      expect(resultado.horasLibreAsignadas).toBe(2);
      expect(resultado.horasLibreDisponibles).toBe(4);
    });
  });
});
