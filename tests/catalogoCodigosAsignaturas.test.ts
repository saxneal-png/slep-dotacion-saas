import { describe, it, expect } from 'vitest';
import { CursoSae, AsignacionHoraria } from '../src/types';
import { 
  resolverCodigoYAmbitoAsignatura, 
  CATALOGO_CODIGOS_ASIGNATURAS,
  obtenerAsignaturaPorCodigo
} from '../packages/mineduc-engine/src/catalogoCodigosAsignaturas';
import { 
  calcularDisponibilidadCurso, 
  sonAsignaturasEquivalentes 
} from '../src/components/DocenteAsignacionPanel';

describe('Sistema Canónico de Códigos e Indexación de Asignaturas (Decreto 0876 y JEC)', () => {
  it('resuelve correctamente los códigos canónicos para asignaturas oficiales de Formación Diferenciada HC', () => {
    // 1. Taller de Literatura debe mapear a DIF-HC-A-LENG-1 y ámbito DIFERENCIADA_HC
    const resLit = resolverCodigoYAmbitoAsignatura('Taller de Literatura', { nivelCurso: '3° Medio HC' });
    expect(resLit.codigo).toBe('DIF-HC-A-LENG-1');
    expect(resLit.ambito).toBe('DIFERENCIADA_HC');
    expect(resLit.esOficial).toBe(true);
    expect(resLit.horasSugeridas).toBe(6);

    // 2. Límites, derivadas e integrales
    const resMat = resolverCodigoYAmbitoAsignatura('Límites, derivadas e integrales');
    expect(resMat.codigo).toBe('DIF-HC-B-MAT-1');
    expect(resMat.ambito).toBe('DIFERENCIADA_HC');

    // 3. Biología celular y molecular
    const resBio = resolverCodigoYAmbitoAsignatura('Biología celular y molecular');
    expect(resBio.codigo).toBe('DIF-HC-B-BIO-1');
    expect(resBio.ambito).toBe('DIFERENCIADA_HC');
  });

  it('distingue Ciencias para la Ciudadanía de Educación Ciudadana por sus códigos oficiales únicos', () => {
    const resCiencias = resolverCodigoYAmbitoAsignatura('Ciencias para la Ciudadanía');
    const resCiudadana = resolverCodigoYAmbitoAsignatura('Educación Ciudadana');

    expect(resCiencias.codigo).toBe('PC-MED34-CIEN');
    expect(resCiencias.ambito).toBe('PLAN_COMUN');
    expect(resCiencias.nombreOficial).toBe('Ciencias para la Ciudadanía');

    expect(resCiudadana.codigo).toBe('PC-MED34-CIUD');
    expect(resCiudadana.ambito).toBe('PLAN_COMUN');
    expect(resCiudadana.nombreOficial).toBe('Educación Ciudadana');

    expect(resCiencias.codigo).not.toBe(resCiudadana.codigo);
  });

  it('auto-genera códigos canónicos para talleres JEC y actividades adicionales/SEP sin colisionar', () => {
    // Taller JEC de Robótica
    const resJec = resolverCodigoYAmbitoAsignatura('Taller de Robótica y Ciencias', { esJec: true });
    expect(resJec.codigo.startsWith('JEC-')).toBe(true);
    expect(resJec.ambito).toBe('LIBRE_DISPOSICION_JEC');
    expect(resJec.esOficial).toBe(false);

    // Taller SEP
    const resSep = resolverCodigoYAmbitoAsignatura('Taller de Refuerzo SEP', { esTallerSep: true });
    expect(resSep.codigo.startsWith('ADICIONAL-SEP-')).toBe(true);
    expect(resSep.ambito).toBe('ADICIONAL_EXTRA');

    // Trabajo Colaborativo Art. 86
    const resColab = resolverCodigoYAmbitoAsignatura('Co-Planificación Matemática', { esTrabajoColaborativo: true });
    expect(resColab.codigo.startsWith('ADICIONAL-COLAB-')).toBe(true);
    expect(resColab.ambito).toBe('ADICIONAL_EXTRA');
  });

  it('al asignar Taller de Literatura (6 HA) en 3° Medio HC JEC, NUNCA descuenta horas de Libre Disposición JEC', () => {
    const curso3Medio: CursoSae = {
      id: 'curso-3m-hc',
      rbd: '9999',
      nivel: '3° Medio HC',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 30,
      alumnosNeet: 5,
      alumnosNeep: 2
    };

    const infoPlan = {
      asignaturas: [
        { nombre: 'Lengua y Literatura', horas: 3 },
        { nombre: 'Matemática', horas: 3 },
        { nombre: 'Educación Ciudadana', horas: 2 },
        { nombre: 'Filosofía', horas: 2 },
        { nombre: 'Inglés', horas: 2 },
        { nombre: 'Ciencias para la Ciudadanía', horas: 2 },
        { nombre: 'Plan Común Electivo', horas: 2 },
        { nombre: 'Formación Diferenciada (Humanístico-Científico)', horas: 18 }
      ],
      horasLibreDisposicion: 8, // En 3° y 4° Medio HC JEC son 8 HA de libre disposición
      esJec: true,
      talleresJecPredefinidos: [],
      nombrePlan: '3° y 4° Medio (Humanístico-Científico)'
    };

    // Asignación de 6 HA de Taller de Literatura
    const asignacionLit: AsignacionHoraria = {
      id: 'asig-lit-1',
      rbd: '9999',
      cursoId: 'curso-3m-hc',
      docenteId: 'doc-lit',
      asignatura: 'Taller de Literatura',
      codigoAsignatura: 'DIF-HC-A-LENG-1',
      ambitoCurricular: 'DIFERENCIADA_HC',
      horasPedagogicasAula: 6,
      esTallerJec: false
    };

    const disp = calcularDisponibilidadCurso(curso3Medio, infoPlan, [asignacionLit]);

    // 1. Las horas de Libre Disposición JEC deben mantenerse 100% INTACTAS (8 HA libres)
    expect(disp.horasLibrePlan).toBe(8);
    expect(disp.horasLibreAsignadas).toBe(0);
    expect(disp.horasLibreDisponibles).toBe(8);

    // 2. La Formación Diferenciada HC debe registrar las 6 HA asignadas y restar 6 HA de las 18 requeridas
    const asigDif = disp.todas.find(a => a.nombre.includes('Formación Diferenciada'));
    expect(asigDif).toBeDefined();
    expect(asigDif?.horasAsignadas).toBe(6);
    expect(asigDif?.horasDisponibles).toBe(12);
  });

  it('permite asignar un taller JEC real descontando legítimamente de la Libre Disposición sin tocar el plan diferenciado', () => {
    const curso3Medio: CursoSae = {
      id: 'curso-3m-hc',
      rbd: '9999',
      nivel: '3° Medio HC',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 30,
      alumnosNeet: 5,
      alumnosNeep: 2
    };

    const infoPlan = {
      asignaturas: [
        { nombre: 'Lengua y Literatura', horas: 3 },
        { nombre: 'Matemática', horas: 3 },
        { nombre: 'Educación Ciudadana', horas: 2 },
        { nombre: 'Filosofía', horas: 2 },
        { nombre: 'Inglés', horas: 2 },
        { nombre: 'Ciencias para la Ciudadanía', horas: 2 },
        { nombre: 'Formación Diferenciada (Humanístico-Científico)', horas: 18 }
      ],
      horasLibreDisposicion: 8,
      esJec: true,
      talleresJecPredefinidos: [],
      nombrePlan: '3° y 4° Medio (Humanístico-Científico)'
    };

    const asignacionTallerAjedrez: AsignacionHoraria = {
      id: 'asig-ajedrez-1',
      rbd: '9999',
      cursoId: 'curso-3m-hc',
      docenteId: 'doc-ajedrez',
      asignatura: 'Taller de Ajedrez y Estrategia',
      codigoAsignatura: 'JEC-TALLER_DE_AJEDREZ',
      ambitoCurricular: 'LIBRE_DISPOSICION_JEC',
      horasPedagogicasAula: 2,
      esTallerJec: true
    };

    const disp = calcularDisponibilidadCurso(curso3Medio, infoPlan, [asignacionTallerAjedrez]);

    // Las horas de Libre Disposición deben haber descontado exactamente 2 HA (8 - 2 = 6 HA libres)
    expect(disp.horasLibrePlan).toBe(8);
    expect(disp.horasLibreAsignadas).toBe(2);
    expect(disp.horasLibreDisponibles).toBe(6);

    // La Formación Diferenciada no debe haberse tocado (0 HA asignadas, 18 HA disponibles)
    const asigDif = disp.todas.find(a => a.nombre.includes('Formación Diferenciada'));
    expect(asigDif?.horasAsignadas).toBe(0);
    expect(asigDif?.horasDisponibles).toBe(18);
  });

  it('en Educación Media TP de Adultos (EPJA D.S. N° 10/2022), los módulos de Formación Diferenciada con Especialización NO son JEC ni colapsan a Lengua y Literatura', () => {
    const cursoEpjaTp: CursoSae = {
      id: 'curso-epja-tp-3',
      rbd: '12345',
      nivel: 'Educación Media TP Adultos Nivel 3',
      letra: 'A',
      regimen: 'No JEC',
      cupoSae: 30,
      matriculaProyectada: 25
    };

    const infoPlanEpja = {
      asignaturas: [
        { nombre: 'Lengua y Literatura', horas: 2 },
        { nombre: 'Matemática', horas: 2 },
        { nombre: 'Ciencias Naturales', horas: 2 },
        { nombre: 'Idioma Extranjero: Inglés', horas: 4 },
        { nombre: 'Formación Instrumental', horas: 2 },
        { 
          nombre: 'Formación Diferenciada con Especialización: Especialización diferenciada en sectores económicos específicos (a lo menos 12 horas semanales)', 
          horas: 12 
        }
      ],
      horasLibreDisposicion: 0,
      esJec: false,
      talleresJecPredefinidos: [],
      nombrePlan: 'Educación Media Técnico-Profesional con Formación en Especialidades - Nivel 3',
      categoria: 'EPJA'
    };

    // 1. Verificar resolución canónica de un módulo técnico en contexto EPJA
    const resMod = resolverCodigoYAmbitoAsignatura('Mecánica Automotriz y Motores Térmicos', {
      nivelCurso: cursoEpjaTp.nivel,
      esJec: false
    });
    expect(resMod.ambito).toBe('DIFERENCIADA_TP');
    expect(resMod.codigo.startsWith('DIF-EPJA-') || resMod.codigo.startsWith('DIF-TP-')).toBe(true);

    // 2. Verificar que sonAsignaturasEquivalentes reconozca el módulo como parte de la Formación Diferenciada con Especialización
    const esEquivalente = sonAsignaturasEquivalentes(
      'Formación Diferenciada con Especialización: Especialización diferenciada en sectores económicos específicos (a lo menos 12 horas semanales)',
      'Mecánica Automotriz y Motores Térmicos'
    );
    expect(esEquivalente).toBe(true);

    // 3. NUNCA debe considerarlo equivalente a Lengua y Literatura ni a Matemática
    expect(sonAsignaturasEquivalentes('Lengua y Literatura', 'Mecánica Automotriz y Motores Térmicos')).toBe(false);
    expect(sonAsignaturasEquivalentes('Matemática', 'Mecánica Automotriz y Motores Térmicos')).toBe(false);

    // 4. Asignación de 6 HA de un módulo de especialidad y 6 HA de otro módulo en el curso EPJA
    const asig1: AsignacionHoraria = {
      id: 'asig-epja-mod-1',
      rbd: '12345',
      cursoId: 'curso-epja-tp-3',
      docenteId: 'doc-tp-1',
      asignatura: 'Mecánica Automotriz y Motores Térmicos',
      codigoAsignatura: resMod.codigo,
      ambitoCurricular: 'DIFERENCIADA_TP',
      horasPedagogicasAula: 6,
      esTallerJec: false
    };

    const asig2: AsignacionHoraria = {
      id: 'asig-epja-mod-2',
      rbd: '12345',
      cursoId: 'curso-epja-tp-3',
      docenteId: 'doc-tp-2',
      asignatura: 'Sistemas Eléctricos y Electrónica del Automóvil',
      codigoAsignatura: 'DIF-EPJA-SISTEMAS_ELECTRICOS',
      ambitoCurricular: 'DIFERENCIADA_TP',
      horasPedagogicasAula: 6,
      esTallerJec: false
    };

    const disp = calcularDisponibilidadCurso(cursoEpjaTp, infoPlanEpja, [asig1, asig2]);

    // En EPJA no hay horas de Libre Disposición JEC (deben ser 0)
    expect(disp.horasLibrePlan).toBe(0);
    expect(disp.horasLibreAsignadas).toBe(0);
    expect(disp.horasLibreDisponibles).toBe(0);

    // El bloque de Formación Diferenciada con Especialización (12 HA) debe quedar 100% CUBIERTO (6 + 6 = 12 HA)
    const asigEspecialidad = disp.todas.find(a => a.nombre.includes('Formación Diferenciada con Especialización'));
    expect(asigEspecialidad).toBeDefined();
    expect(asigEspecialidad?.horasPlan).toBe(12);
    expect(asigEspecialidad?.horasAsignadas).toBe(12);
    expect(asigEspecialidad?.horasDisponibles).toBe(0);
    expect(asigEspecialidad?.estado).toBe('CUBIERTA');

    // Lengua y Literatura y las demás asignaturas troncales deben seguir disponibles intactas con 2 HA
    const asigLeng = disp.todas.find(a => a.nombre === 'Lengua y Literatura');
    expect(asigLeng?.horasAsignadas).toBe(0);
    expect(asigLeng?.horasDisponibles).toBe(2);
    expect(asigLeng?.estado).toBe('DISPONIBLE');
  });
});
