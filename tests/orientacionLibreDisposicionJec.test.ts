import { describe, it, expect } from 'vitest';
import { 
  calcularDisponibilidadCurso 
} from '../src/components/DocenteAsignacionPanel';
import { 
  PLANES_MINEDUC, 
  obtenerPlanPorCurso 
} from '@slep/mineduc-engine';
import { CursoSae, AsignacionHoraria } from '../src/types';

describe('Orientación vs Horas de Libre Disposición en Cursos JEC', () => {
  const cursoJec1a4: CursoSae = {
    id: 'curso_2_basico_a',
    colegioId: 'colegio_1',
    periodo: 2026,
    grado: 2,
    nivel: '2° Básico',
    letra: 'A',
    regimen: 'JEC',
    jornada: 'COMPLETA',
    alumnosMatriculados: 28,
    capacidadAula: 35
  };

  const infoPlanBase1a4 = {
    esJec: true,
    horasMinimasJec: 38,
    horasLibreDisposicion: 6.5,
    talleresJecPredefinidos: [],
    nombrePlan: '1° a 4° Básico',
    asignaturas: [
      { nombre: 'Lenguaje y Comunicación', horas: 8, caracter: 'Obligatoria' },
      { nombre: 'Matemática', horas: 6, caracter: 'Obligatoria' },
      { nombre: 'Ciencias Naturales', horas: 3, caracter: 'Obligatoria' },
      { nombre: 'Historia, Geografía y Ciencias Sociales', horas: 3, caracter: 'Obligatoria' },
      { nombre: 'Artes Visuales', horas: 2, caracter: 'Obligatoria' },
      { nombre: 'Música', horas: 2, caracter: 'Obligatoria' },
      { nombre: 'Educación Física y Salud', horas: 4, caracter: 'Obligatoria' },
      { nombre: 'Orientación', horas: 0.5, caracter: 'Obligatoria' },
      { nombre: 'Tecnología', horas: 1, caracter: 'Obligatoria' },
      { nombre: 'Religión', horas: 2, caracter: 'Opcional' }
    ]
  };

  describe('Colegios Tipo A: Mantienen Orientación en 0.5 HA y Libre Disposición en 6.5 HA', () => {
    it('al asignar 0.5 HA a Orientación, queda cubierta y deja 6.5 HA disponibles en Libre Disposición', () => {
      const asigOrientacion: AsignacionHoraria = {
        id: 'asig_ori_05',
        docenteId: 'doc_1',
        colegioId: 'colegio_1',
        cursoId: 'curso_2_basico_a',
        asignatura: 'Orientación',
        horasPedagogicasAula: 0.5,
        horasSemanales: 0.5,
        esTallerJec: false,
        regimenCurso: 'JEC',
        periodo: 2026
      };

      const resultado = calcularDisponibilidadCurso(cursoJec1a4, infoPlanBase1a4, [asigOrientacion]);

      const ori = resultado.todas.find(a => a.nombre === 'Orientación');
      expect(ori).toBeDefined();
      expect(ori?.horasPlan).toBe(0.5);
      expect(ori?.horasAsignadas).toBe(0.5);
      expect(ori?.horasDisponibles).toBe(0);
      expect(ori?.estado).toBe('CUBIERTA');
      expect(ori?.horasCompensadasLibreDisposicion).toBe(0);

      // Libre disposición intacta
      expect(resultado.horasLibrePlan).toBe(6.5);
      expect(resultado.horasLibreAsignadas).toBe(0);
      expect(resultado.horasLibreDisponibles).toBe(6.5);
    });
  });

  describe('Colegios Tipo B: Asignan 1 HA a Orientación y descuentan la diferencia de Libre Disposición (6.0 HA)', () => {
    it('al asignar 1 HA a Orientación, se marca como CUBIERTA y descuenta 0.5 HA de Libre Disposición quedando 6.0 HA disponibles', () => {
      const asigOrientacion1h: AsignacionHoraria = {
        id: 'asig_ori_1h',
        docenteId: 'doc_1',
        colegioId: 'colegio_1',
        cursoId: 'curso_2_basico_a',
        asignatura: 'Orientación',
        horasPedagogicasAula: 1,
        horasSemanales: 1,
        esTallerJec: false,
        regimenCurso: 'JEC',
        periodo: 2026
      };

      const resultado = calcularDisponibilidadCurso(cursoJec1a4, infoPlanBase1a4, [asigOrientacion1h]);

      const ori = resultado.todas.find(a => a.nombre === 'Orientación');
      expect(ori).toBeDefined();
      expect(ori?.horasPlan).toBe(0.5);
      expect(ori?.horasAsignadas).toBe(1);
      expect(ori?.horasDisponibles).toBe(0);
      // NO debe quedar EXCEDIDA, sino CUBIERTA legítimamente mediante Libre Disposición
      expect(ori?.estado).toBe('CUBIERTA');
      expect(ori?.horasCompensadasLibreDisposicion).toBe(0.5);

      // Libre Disposición: de 6.5 HA pasa a tener 0.5 asignadas y 6.0 HA disponibles
      expect(resultado.horasLibrePlan).toBe(6.5);
      expect(resultado.horasLibreAsignadas).toBe(0.5);
      expect(resultado.horasLibreDisponibles).toBe(6.0);
    });

    it('si además de 1 HA Orientación se asigna un taller JEC de 2 HA, Libre Disposición descuenta 2.5 HA quedando 4.0 HA disponibles', () => {
      const asigOrientacion: AsignacionHoraria = {
        id: 'asig_ori_1h',
        docenteId: 'doc_1',
        colegioId: 'colegio_1',
        cursoId: 'curso_2_basico_a',
        asignatura: 'Orientación',
        horasPedagogicasAula: 1,
        horasSemanales: 1,
        esTallerJec: false,
        regimenCurso: 'JEC',
        periodo: 2026
      };

      const asigTaller: AsignacionHoraria = {
        id: 'asig_taller_rob',
        docenteId: 'doc_2',
        colegioId: 'colegio_1',
        cursoId: 'curso_2_basico_a',
        asignatura: 'Taller de Robótica',
        horasPedagogicasAula: 2,
        horasSemanales: 2,
        esTallerJec: true,
        regimenCurso: 'JEC',
        periodo: 2026
      };

      const resultado = calcularDisponibilidadCurso(cursoJec1a4, infoPlanBase1a4, [asigOrientacion, asigTaller]);

      // 6.5 libre - (2.0 taller + 0.5 exceso orientación) = 4.0 disponibles
      expect(resultado.horasLibrePlan).toBe(6.5);
      expect(resultado.horasLibreAsignadas).toBe(2.5);
      expect(resultado.horasLibreDisponibles).toBe(4.0);

      // Matemática sigue 100% disponible
      const mate = resultado.todas.find(a => a.nombre === 'Matemática');
      expect(mate?.horasDisponibles).toBe(6);
      expect(mate?.horasAsignadas).toBe(0);
    });
  });

  describe('Colegios Tipo B: Asignación de 2 HA de Orientación en plan con 32h obligatorias / 6h Libre Disposición', () => {
    it('al asignar 2 HA de Orientación con plan variante (Orientación 1 HA / Libre 7 HA), queda en 6.0 HA libres', () => {
      const infoPlanVariante = {
        esJec: true,
        horasMinimasJec: 38,
        horasLibreDisposicion: 7,
        talleresJecPredefinidos: [],
        nombrePlan: '3° y 4° Básico',
        asignaturas: [
          ...infoPlanBase1a4.asignaturas.filter(a => a.nombre !== 'Orientación' && a.nombre !== 'Educación Física y Salud'),
          { nombre: 'Educación Física y Salud', horas: 3, caracter: 'Obligatoria' },
          { nombre: 'Orientación', horas: 1, caracter: 'Obligatoria' }
        ]
      };

      const asigOrientacion2h: AsignacionHoraria = {
        id: 'asig_ori_2h',
        docenteId: 'doc_1',
        colegioId: 'colegio_1',
        cursoId: 'curso_2_basico_a',
        asignatura: 'Orientación',
        horasPedagogicasAula: 2,
        horasSemanales: 2,
        esTallerJec: false,
        regimenCurso: 'JEC',
        periodo: 2026
      };

      const resultado = calcularDisponibilidadCurso(cursoJec1a4, infoPlanVariante, [asigOrientacion2h]);

      const ori = resultado.todas.find(a => a.nombre === 'Orientación');
      expect(ori?.horasAsignadas).toBe(2);
      expect(ori?.estado).toBe('CUBIERTA');
      expect(ori?.horasCompensadasLibreDisposicion).toBe(1);

      // 7.0 libre - 1.0 = 6.0 HA de libre disposición
      expect(resultado.horasLibrePlan).toBe(7);
      expect(resultado.horasLibreAsignadas).toBe(1);
      expect(resultado.horasLibreDisponibles).toBe(6.0);
    });
  });

  describe('Catálogo Oficial MINEDUC: Variantes Curriculares Disponibles', () => {
    it('incluye variante oficial "1° a 4° Básico (Orientación 1 HA / Libre 6 HA)" en PLANES_MINEDUC', () => {
      const plan1h = PLANES_MINEDUC.find(p => p.nivel === '1° a 4° Básico (Orientación 1 HA / Libre 6 HA)' && p.regimen === 'JEC');
      expect(plan1h).toBeDefined();
      expect(plan1h?.totalHorasPlan).toBe(38);
      expect(plan1h?.horasLibreDisposicion).toBe(6);
      const asigOri = plan1h?.asignaturasBase.find(a => a.nombre === 'Orientación');
      expect(asigOri?.horasSugeridas).toBe(1);
    });

    it('incluye variante oficial "1° a 4° Básico (Orientación 2 HA / Libre 6 HA)" en PLANES_MINEDUC', () => {
      const plan2h = PLANES_MINEDUC.find(p => p.nivel === '1° a 4° Básico (Orientación 2 HA / Libre 6 HA)' && p.regimen === 'JEC');
      expect(plan2h).toBeDefined();
      expect(plan2h?.totalHorasPlan).toBe(38);
      expect(plan2h?.horasLibreDisposicion).toBe(6);
      const asigOri = plan2h?.asignaturasBase.find(a => a.nombre === 'Orientación');
      expect(asigOri?.horasSugeridas).toBe(2);
    });

    it('resuelve automáticamente mediante obtenerPlanPorCurso cuando se especifica orientación 1h o 2h', () => {
      const res1 = obtenerPlanPorCurso('2° Básico A (Orientación 1h)', 'JEC');
      expect(res1?.nivel).toBe('1° a 4° Básico (Orientación 1 HA / Libre 6 HA)');

      const res2 = obtenerPlanPorCurso('3° Básico B (Orientación 2h)', 'JEC');
      expect(res2?.nivel).toBe('1° a 4° Básico (Orientación 2 HA / Libre 6 HA)');
    });
  });
});
