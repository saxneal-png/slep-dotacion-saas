import { describe, it, expect } from 'vitest';
import {
  DECRETO_0876_2019_METADATA,
  CATALOGO_PROFUNDIZACION_HC_27,
  CATALOGO_PLAN_COMUN_ELECTIVO_3_4,
  CATALOGO_SECTORES_Y_ESPECIALIDADES_TP_35,
  CATALOGO_MENCIONES_ARTISTICAS_10,
  validarOfertaElectivosHc,
  validarEleccionEstudianteHc,
  PLANES_MINEDUC,
  obtenerPlanPorCurso
} from '../src/planesEstudio';

describe('Decreto Exento N° 0876/2019 - Planes de Estudio 3° y 4° Medio (CNED Acuerdo 057/2019)', () => {
  
  it('contiene los metadatos oficiales del Decreto Exento N° 0876/2019', () => {
    expect(DECRETO_0876_2019_METADATA.decreto).toContain('0876');
    expect(DECRETO_0876_2019_METADATA.acuerdoCned).toContain('057-2019');
    expect(DECRETO_0876_2019_METADATA.semanasLectivasBase).toBe(38);
    expect(DECRETO_0876_2019_METADATA.criteriosOfertaHc.minimoAsignaturasOfertadasLiceo).toBe(6);
    expect(DECRETO_0876_2019_METADATA.criteriosOfertaHc.totalAsignaturasDisponibles).toBe(27);
    expect(DECRETO_0876_2019_METADATA.criteriosOfertaHc.asignaturasPorEstudiante).toBe(3);
    expect(DECRETO_0876_2019_METADATA.criteriosOfertaHc.horasPorAsignatura).toBe(6);
  });

  it('contempla el catálogo íntegro de las 27 asignaturas de profundización organizadas en 3 áreas', () => {
    expect(CATALOGO_PROFUNDIZACION_HC_27.length).toBe(27);

    // Área A: 9 asignaturas
    const areaA = CATALOGO_PROFUNDIZACION_HC_27.filter(a => a.area === 'A');
    expect(areaA.length).toBe(9);
    const disciplinasA = Array.from(new Set(areaA.map(a => a.disciplina)));
    expect(disciplinasA).toEqual(expect.arrayContaining(['Lengua y Literatura', 'Filosofía', 'Historia, Geografía y Ciencias Sociales']));

    // Área B: 9 asignaturas
    const areaB = CATALOGO_PROFUNDIZACION_HC_27.filter(a => a.area === 'B');
    expect(areaB.length).toBe(9);
    const disciplinasB = Array.from(new Set(areaB.map(a => a.disciplina)));
    expect(disciplinasB).toEqual(expect.arrayContaining(['Matemática', 'Ciencias']));

    // Área C: 9 asignaturas
    const areaC = CATALOGO_PROFUNDIZACION_HC_27.filter(a => a.area === 'C');
    expect(areaC.length).toBe(9);
    const disciplinasC = Array.from(new Set(areaC.map(a => a.disciplina)));
    expect(disciplinasC).toEqual(expect.arrayContaining(['Artes', 'Educación Física y Salud']));

    // Cada asignatura tiene 6 horas semanales y 228 horas anuales (38 sem x 6h)
    for (const asig of CATALOGO_PROFUNDIZACION_HC_27) {
      expect(asig.horasSemanales).toBe(6);
      expect(asig.horasAnuales).toBe(228);
    }
  });

  it('incluye asignaturas emblemáticas de innovación del CNED (Pensamiento Computacional, Límites, Taller Literatura, etc.)', () => {
    const nombres = CATALOGO_PROFUNDIZACION_HC_27.map(a => a.nombre);
    expect(nombres).toContain('Pensamiento computacional y programación');
    expect(nombres).toContain('Límites, derivadas e integrales');
    expect(nombres).toContain('Biología de los ecosistemas');
    expect(nombres).toContain('Taller de Literatura');
    expect(nombres).toContain('Participación y argumentación en democracia');
    expect(nombres).toContain('Filosofía Política');
    expect(nombres).toContain('Artes visuales, audiovisuales y multimediales');
    expect(nombres).toContain('Promoción de estilos de vida activos y saludables');
  });

  it('contempla el catálogo de 4 asignaturas del Plan Común Electivo de 2 horas', () => {
    expect(CATALOGO_PLAN_COMUN_ELECTIVO_3_4.length).toBe(4);
    const nombres = CATALOGO_PLAN_COMUN_ELECTIVO_3_4.map(a => a.nombre);
    expect(nombres).toContain('Historia, Geografía y Ciencias Sociales');
    expect(nombres).toContain('Artes');
    expect(nombres).toContain('Educación Física y Salud');
    expect(nombres).toContain('Religión');

    const religion = CATALOGO_PLAN_COMUN_ELECTIVO_3_4.find(a => a.nombre === 'Religión');
    expect(religion?.decreto).toContain('924/1983');
  });

  it('valida correctamente una oferta curricular institucional conforme a normativa', () => {
    // Oferta válida: 6 asignaturas, 2 áreas (Área A y B), sin concentración disciplinar
    const ofertaValida = [
      "Taller de Literatura",
      "Economía y sociedad",
      "Límites, derivadas e integrales",
      "Pensamiento computacional y programación",
      "Biología de los ecosistemas",
      "Física"
    ];

    const res = validarOfertaElectivosHc(ofertaValida);
    expect(res.valido).toBe(true);
    expect(res.totalOfertadas).toBe(6);
    expect(res.areasCubiertas.length).toBe(2);
    expect(res.errores.length).toBe(0);
  });

  it('detecta incumplimiento cuando el establecimiento oferta menos de 6 asignaturas', () => {
    const ofertaInsuficiente = [
      "Taller de Literatura",
      "Límites, derivadas e integrales",
      "Biología de los ecosistemas"
    ];

    const res = validarOfertaElectivosHc(ofertaInsuficiente);
    expect(res.valido).toBe(false);
    expect(res.errores.some(e => e.includes('6 asignaturas mínimas'))).toBe(true);
  });

  it('detecta incumplimiento cuando el establecimiento cubre solo 1 área de conocimiento', () => {
    // 6 asignaturas pero todas del Área A
    const ofertaMonoArea = [
      "Taller de Literatura",
      "Lectura y escritura especializadas",
      "Estética",
      "Filosofía Política",
      "Comprensión histórica del presente",
      "Economía y sociedad"
    ];

    const res = validarOfertaElectivosHc(ofertaMonoArea);
    expect(res.valido).toBe(false);
    expect(res.errores.some(e => e.includes('garantizar cobertura en al menos dos de las tres áreas'))).toBe(true);
  });

  it('detecta concentración indebida en una sola disciplina dentro de un área', () => {
    // 6 asignaturas en 2 áreas, pero en Área B las 3 asignaturas son solo de Matemática (sin Ciencias)
    const ofertaConcentrada = [
      "Taller de Literatura",
      "Filosofía Política",
      "Economía y sociedad",
      "Límites, derivadas e integrales",
      "Probabilidades y estadística descriptiva e inferencial",
      "Geometría 3D"
    ];

    const res = validarOfertaElectivosHc(ofertaConcentrada);
    expect(res.valido).toBe(false);
    expect(res.errores.some(e => e.includes('concentran en una única disciplina'))).toBe(true);
  });

  it('valida la elección del estudiante (exactamente 3 asignaturas = 18 horas)', () => {
    const eleccionCorrecta = [
      "Taller de Literatura",
      "Límites, derivadas e integrales",
      "Artes visuales, audiovisuales y multimediales"
    ];
    const resOk = validarEleccionEstudianteHc(eleccionCorrecta);
    expect(resOk.valido).toBe(true);
    expect(resOk.totalHoras).toBe(18);

    const eleccionIncompleta = ["Taller de Literatura", "Física"];
    const resIncompleta = validarEleccionEstudianteHc(eleccionIncompleta);
    expect(resIncompleta.valido).toBe(false);
    expect(resIncompleta.totalHoras).toBe(12);
  });

  it('verifica la carga horaria oficial en PLANES_MINEDUC para HC, TP y Artístico', () => {
    const planHcJec = PLANES_MINEDUC.find(p => p.nivel === '3° y 4° Medio (Humanístico-Científico)' && p.regimen === 'JEC');
    expect(planHcJec).toBeDefined();
    expect(planHcJec?.totalHorasPlan).toBe(42);
    expect(planHcJec?.horasObligatorias).toBe(34); // 14 común + 2 común elec + 18 dif = 34
    expect(planHcJec?.horasLibreDisposicion).toBe(8);
    expect(planHcJec?.referenciaFuente).toContain('Decreto Exento N° 0876/2019');

    const planHcNoJec = PLANES_MINEDUC.find(p => p.nivel === '3° y 4° Medio (Humanístico-Científico)' && p.regimen === 'No JEC');
    expect(planHcNoJec).toBeDefined();
    expect(planHcNoJec?.totalHorasPlan).toBe(36);
    expect(planHcNoJec?.horasLibreDisposicion).toBe(2);

    const planArtJec = PLANES_MINEDUC.find(p => p.nivel === '3° y 4° Medio (Artístico)' && p.regimen === 'JEC');
    expect(planArtJec).toBeDefined();
    expect(planArtJec?.totalHorasPlan).toBe(42);
    expect(planArtJec?.horasLibreDisposicion).toBe(5);

    const planTpJec = PLANES_MINEDUC.find(p => p.nivel === '3° y 4° Medio (Técnico-Profesional)' && p.regimen === 'JEC');
    expect(planTpJec).toBeDefined();
    expect(planTpJec?.totalHorasPlan).toBe(42);
    expect(planTpJec?.horasLibreDisposicion).toBe(6);
  });

  it('contiene 35 especialidades TP en 15 sectores económicos y 10 menciones artísticas', () => {
    expect(CATALOGO_SECTORES_Y_ESPECIALIDADES_TP_35.length).toBe(15);
    const totalEspecialidades = CATALOGO_SECTORES_Y_ESPECIALIDADES_TP_35.reduce((sum, s) => sum + s.especialidades.length, 0);
    expect(totalEspecialidades).toBe(35);
    expect(CATALOGO_MENCIONES_ARTISTICAS_10.length).toBe(10);
  });

  it('resuelve adecuadamente cursos de 3° y 4° Medio HC con obtenerPlanPorCurso', () => {
    const p3 = obtenerPlanPorCurso('3° Medio HC A', 'JEC');
    expect(p3).toBeDefined();
    expect(p3?.nivel).toBe('3° y 4° Medio (Humanístico-Científico)');
    expect(p3?.totalHorasPlan).toBe(42);

    const p4 = obtenerPlanPorCurso('4° Medio Humanista', 'No JEC');
    expect(p4).toBeDefined();
    expect(p4?.nivel).toBe('3° y 4° Medio (Humanístico-Científico)');
    expect(p4?.totalHorasPlan).toBe(36);
  });

});
