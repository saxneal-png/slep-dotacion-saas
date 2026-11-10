import {
  AsignacionHoraria,
  CursoSae,
  Docente,
  Establecimiento,
  PlanEstudioCurricular
} from '../types';
import {
  CATALOGO_PLAN_COMUN_ELECTIVO_3_4,
  CATALOGO_PROFUNDIZACION_HC_27,
  PLANES_MINEDUC,
  PlanEstudioNivel,
  obtenerPlanPorCurso,
  resolverCodigoYAmbitoAsignatura
} from '@slep/mineduc-engine';
import { calcularHorasFueraAulaDocente } from './auditoriaDocenteService';

export interface InfoPlanResuelto {
  asignaturas: { nombre: string; horas: number; caracter?: string }[];
  horasLibreDisposicion: number;
  esJec: boolean;
  talleresJecPredefinidos: { nombre: string; horas?: number }[];
  nombrePlan: string;
  categoria?: string;
  totalHorasPlan?: number;
  esPersonalizadoBd?: boolean;
}

export interface DisponibilidadAsignatura {
  nombre: string;
  horasPlan: number;
  horasAsignadas: number;
  horasDisponibles: number;
  estado: 'DISPONIBLE' | 'CUBIERTA' | 'EXCEDIDA';
  caracter?: string;
  horasCompensadasLibreDisposicion?: number;
}

/**
 * Detecta modalidad EPJA (Adultos D.S. N° 10/2022 y D.S. N° 452/2013).
 * Los cursos EPJA jamás poseen régimen JEC ni horas de Libre Disposición JEC.
 */
export function esCursoModalidadEpja(
  curso?: CursoSae | null,
  infoPlan?: { nombrePlan?: string; categoria?: string } | null
): boolean {
  if (!curso && !infoPlan) return false;
  if (infoPlan?.categoria === 'EPJA') return true;
  const txt = `${curso?.nivel || ''} ${infoPlan?.nombrePlan || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/\b(epja|adulto|adultos|tercera jornada|vespertin|nocturn)\b/i.test(txt)) return true;
  if (/\bnivel\s*[123]\b/i.test(txt) && !/\b(nt[12]|transicion|parvulo)\b/i.test(txt)) return true;
  if (txt.includes('formacion en oficios') || txt.includes('formacion en especialidades')) return true;
  return false;
}

/**
 * Detecta si el curso corresponde a 3° o 4° Año de Educación Media Regular (no EPJA).
 */
export function esCursoNivelMedio34(
  curso?: CursoSae | null,
  infoPlan?: { nombrePlan?: string; categoria?: string } | null
): boolean {
  if (!curso) return false;
  if (esCursoModalidadEpja(curso, infoPlan)) return false;
  if (/b[aá]sic[oa]|parvulari|k[ií]nder|transici[oó]n|nt[12]|sala\s*cuna/i.test(curso.nivel)) {
    return false;
  }
  return Boolean(
    /([34][°ºo]?\s*(medio|em|tp)|tercer[oa]?\s*(medio|em)|cuart[oa]?\s*(medio|em))/i.test(curso.nivel) ||
    (infoPlan?.nombrePlan && infoPlan.nombrePlan.toLowerCase().includes('medio') && /[34]/i.test(infoPlan.nombrePlan)) ||
    ((infoPlan?.categoria === 'MEDIA_HC' || infoPlan?.categoria === 'MEDIA_TP') && /[34]/i.test(infoPlan?.nombrePlan || ''))
  );
}

/**
 * Detecta si el curso corresponde a Educación Media Técnico-Profesional.
 */
export function esCursoModalidadTp(
  curso?: CursoSae | null,
  infoPlan?: { nombrePlan?: string; categoria?: string } | null,
  colegio?: Establecimiento | null
): boolean {
  if (!curso) return false;
  const esEpja = esCursoModalidadEpja(curso, infoPlan);
  return Boolean(
    /\btp\b/i.test(curso.nivel) ||
    /t[eé]cnico/i.test(curso.nivel) ||
    Boolean(curso.especialidadTp) ||
    infoPlan?.categoria === 'MEDIA_TP' ||
    (esEpja && /tp|t[eé]cnico|especialidad|oficio/i.test(`${curso.nivel} ${infoPlan?.nombrePlan || ''}`)) ||
    Boolean(colegio && /t[eé]cnico|industrial|comercial|polit[eé]cnico|agr[ií]cola/i.test(colegio.nombre) && /^[34]°?\s*medio/i.test(curso.nivel))
  );
}

/**
 * Detecta si un nombre corresponde a taller, reforzamiento, academia o libre disposición
 * (soportando singular y plural: taller / talleres, refuerzo / reforzamientos, etc.),
 * respetando las excepciones oficiales del currículum MINEDUC ("Taller de Literatura" y "Taller Laboral").
 */
export function esTextoTallerOLibreDisposicion(nombre: string): boolean {
  if (!nombre) return false;
  const n = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const esOficialTaller = n.includes('taller de literatura') || n.includes('taller laboral');
  if (esOficialTaller) return false;
  return /\b(taller(?:es)?|reforzamientos?|refuerzos?|academias?|club(?:es)?|jec|libre\s+disposicion)\b/i.test(n);
}

/**
 * Single Source of Truth para resolver el Plan de Estudio efectivo de un curso,
 * priorizando el plan personalizado en BD (`curso.planEstudioId`), luego el motor MINEDUC.
 */
export function resolverPlanCurso(
  curso: CursoSae | null,
  planesDb: PlanEstudioCurricular[] = []
): InfoPlanResuelto {
  if (!curso) {
    return {
      asignaturas: [],
      horasLibreDisposicion: 0,
      esJec: false,
      talleresJecPredefinidos: [],
      nombrePlan: 'Sin curso',
      totalHorasPlan: 0
    };
  }

  const esNivelEpja = esCursoModalidadEpja(curso, null);
  const esJec = !esNivelEpja && curso.regimen === 'JEC';
  const talleresCurso = esNivelEpja ? [] : (curso.talleresJec || []);

  // 1. Plan de estudio personalizado asignado en BD
  if (curso.planEstudioId && planesDb.length > 0) {
    const planDb = planesDb.find(p => p.id === curso.planEstudioId);
    if (planDb && planDb.asignaturas && planDb.asignaturas.length > 0) {
      const esPlanEpja = esNivelEpja || planDb.categoria === 'EPJA' || esCursoModalidadEpja(curso, { nombrePlan: planDb.nivel, categoria: planDb.categoria });
      const esJecReal = !esPlanEpja && (planDb.regimen === 'JEC' || esJec);
      const librePlan = esPlanEpja ? 0 : (planDb.horasLibreDisposicion ?? (esJecReal ? 6 : 0));
      const sumaBase = planDb.asignaturas.reduce((s, a) => s + (Number(a.horasSemanales) || 0), 0);
      return {
        asignaturas: planDb.asignaturas.map(a => ({
          nombre: a.nombre,
          horas: Number(a.horasSemanales) || 2,
          caracter: a.caracter || 'Obligatoria'
        })),
        horasLibreDisposicion: librePlan,
        esJec: esJecReal,
        talleresJecPredefinidos: esPlanEpja ? [] : talleresCurso.map(t => ({ nombre: t.nombre, horas: t.horas })),
        nombrePlan: planDb.nivel,
        categoria: planDb.categoria,
        totalHorasPlan: planDb.totalHorasPlan || (sumaBase + librePlan),
        esPersonalizadoBd: true
      };
    }
  }

  // 2. Motor normativo oficial MINEDUC
  const planMineduc: PlanEstudioNivel | null = obtenerPlanPorCurso(
    curso.nivel,
    esNivelEpja ? 'No JEC' : curso.regimen,
    curso.especialidadTp
  );

  if (planMineduc && planMineduc.asignaturasBase && planMineduc.asignaturasBase.length > 0) {
    const esPlanEpja = esNivelEpja || planMineduc.categoria === 'EPJA' || esCursoModalidadEpja(curso, { nombrePlan: planMineduc.nivel, categoria: planMineduc.categoria });
    const esJecReal = !esPlanEpja && (planMineduc.regimen === 'JEC' || esJec);

    const asignaturasBase = planMineduc.asignaturasBase.map(a => ({
      nombre: a.nombre,
      horas: a.horasSugeridas,
      caracter: 'Obligatoria'
    }));

    // En 3° y 4° Medio TP Regular (no EPJA), incluir Plan Común Electivo (2 HA con cargo a Libre Disposición) si no está explícito
    const esMedio34 = !esPlanEpja && !/b[aá]sic[oa]|parvulari|k[ií]nder|transici[oó]n|nt[12]|sala\s*cuna/i.test(curso.nivel) && (
      /([34][°ºo]?\s*(medio|em|tp)|tercer[oa]?\s*(medio|em)|cuart[oa]?\s*(medio|em))/i.test(curso.nivel) ||
      ((planMineduc.categoria === 'MEDIA_HC' || planMineduc.categoria === 'MEDIA_TP') && /[34]/i.test(planMineduc.nivel))
    );
    const esModalidadTecnica = planMineduc.categoria === 'MEDIA_TP' || curso.nivel.toLowerCase().includes('tp') || Boolean(curso.especialidadTp);
    if (esMedio34 && esModalidadTecnica && !asignaturasBase.some(a => a.nombre.toLowerCase().includes('electivo'))) {
      asignaturasBase.push({
        nombre: 'Plan Común Electivo (Historia / Artes / Ed. Física / Religión)',
        horas: 2,
        caracter: 'Electiva en Libre Disposición'
      });
    }

    return {
      asignaturas: asignaturasBase,
      horasLibreDisposicion: esPlanEpja ? 0 : (planMineduc.horasLibreDisposicion ?? (esJecReal ? 6 : 0)),
      esJec: esJecReal,
      talleresJecPredefinidos: esPlanEpja ? [] : talleresCurso.map(t => ({ nombre: t.nombre, horas: t.horas })),
      nombrePlan: planMineduc.nivel,
      categoria: planMineduc.categoria,
      totalHorasPlan: planMineduc.totalHorasPlan,
      esPersonalizadoBd: false
    };
  }

  // 3. Fallback estándar
  const fallback = [
    { nombre: 'Lenguaje y Comunicación', horas: 6, caracter: 'Obligatoria' },
    { nombre: 'Matemática', horas: 6, caracter: 'Obligatoria' },
    { nombre: 'Ciencias Naturales', horas: 3, caracter: 'Obligatoria' },
    { nombre: 'Historia, Geografía y Ciencias Sociales', horas: 3, caracter: 'Obligatoria' },
    { nombre: 'Inglés', horas: 3, caracter: 'Obligatoria' },
    { nombre: 'Educación Física y Salud', horas: 3, caracter: 'Obligatoria' },
    { nombre: 'Artes Visuales', horas: 2, caracter: 'Obligatoria' },
    { nombre: 'Música', horas: 2, caracter: 'Obligatoria' },
    { nombre: 'Tecnología', horas: 1, caracter: 'Obligatoria' },
    { nombre: 'Orientación', horas: 1, caracter: 'Obligatoria' },
    { nombre: 'Religión', horas: 2, caracter: 'Opcional' }
  ];

  const libre = esJec ? 6 : 0;
  return {
    asignaturas: fallback,
    horasLibreDisposicion: libre,
    esJec,
    talleresJecPredefinidos: talleresCurso.map(t => ({ nombre: t.nombre, horas: t.horas })),
    nombrePlan: `${curso.nivel} (${esNivelEpja ? 'No JEC' : curso.regimen})`,
    totalHorasPlan: 32 + libre,
    esPersonalizadoBd: false
  };
}

/**
 * Convierte `InfoPlanResuelto` al formato `PlanEstudioNivel` para componentes de vista (ej. MallaPlanPanel).
 */
export function convertirInfoPlanANivelMineduc(infoPlan: InfoPlanResuelto, curso?: CursoSae | null): PlanEstudioNivel {
  const sumaBase = infoPlan.asignaturas.reduce((s, a) => s + a.horas, 0);
  const total = infoPlan.totalHorasPlan || (sumaBase + infoPlan.horasLibreDisposicion);
  return {
    nivel: infoPlan.nombrePlan,
    regimen: infoPlan.esJec ? 'JEC' : (curso?.regimen || 'No JEC'),
    horasObligatorias: Math.max(0, total - infoPlan.horasLibreDisposicion),
    horasLibreDisposicion: infoPlan.horasLibreDisposicion,
    totalHorasPlan: total,
    asignaturasBase: infoPlan.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.horas })),
    categoria: infoPlan.categoria as PlanEstudioNivel['categoria']
  };
}

export function esAsignaturaProfundizacionHc(nombre: string): boolean {
  if (!nombre) return false;
  const n = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (n.includes('educacion fisica') || n.includes('ed. fisica') || n.includes('ed fisica') || n.includes('ed.fisica')) {
    return false;
  }
  if (esTextoTallerOLibreDisposicion(n)) {
    return false;
  }
  return CATALOGO_PROFUNDIZACION_HC_27.some(p => {
    const pn = p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return n === pn;
  });
}

export function esAsignaturaPlanComunElectivo(nombre: string): boolean {
  if (!nombre) return false;
  const n = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (esTextoTallerOLibreDisposicion(n)) return false;
  if (n.includes('plan comun electivo') || n.includes('electivo comun')) return true;
  if (n.includes('electivo') && (n.includes('historia') || n.includes('artes') || n.includes('fisica') || n.includes('religion'))) return true;
  return false;
}

/**
 * Normalizador de nombres de asignaturas para conciliación de cobertura curricular.
 */
export function normalizarNombreAsignatura(nombre: string): string {
  if (!nombre) return '';
  let n = nombre.toLowerCase().trim();
  n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  n = n.replace(/^idioma extranjero:\s*/i, '');
  n = n.replace(/\s+/g, ' ').trim();

  // Módulos TP u Oficios EPJA preservan identidad única
  if (
    /^m[oó]dulo\b/i.test(n) ||
    (n.includes('formacion diferenciada') && (n.includes('especializacion') || n.includes('oficio') || n.includes('tp') || n.includes('tecnico') || n.includes('especialidad')))
  ) {
    if (n.includes('formacion diferenciada') && (n.includes('especializacion') || n.includes('tp') || n.includes('tecnico') || n.includes('especialidad'))) {
      return 'formacion diferenciada con especializacion';
    }
    if (n.includes('formacion diferenciada') && n.includes('oficio')) {
      return 'formacion diferenciada en oficios';
    }
    return `modulo_${n.replace(/^m[oó]dulo\s*(menci[oó]n|com[uú]n)?\s*:?\s*/i, '').replace(/[^a-z0-9]/g, '_')}`;
  }

  // Formación Instrumental EPJA
  if (
    n.startsWith('formacion instrumental') ||
    n === 'pensamiento computacional' ||
    n === 'responsabilidad personal y social' ||
    n === 'emprendimiento y empleabilidad' ||
    n === 'educacion financiera'
  ) {
    return 'formacion instrumental';
  }

  // Talleres (singular y plural), reforzamientos, academias y Libre Disposición JAMÁS colisionan con troncales
  if (esTextoTallerOLibreDisposicion(n)) {
    return `taller_${n.replace(/[^a-z0-9]/g, '_')}`;
  }

  // 1. Educación Física y Salud
  if (
    n.includes('educacion fisica') ||
    n.includes('ed. fisica') ||
    n.includes('ed fisica') ||
    n.includes('ed.fisica') ||
    n.includes('educacion y salud') ||
    n.includes('deporte') ||
    n.includes('motricidad') ||
    (/\bsalud\b/i.test(n) && !n.includes('ciencias de la salud'))
  ) {
    return 'educacion fisica y salud';
  }

  // 1.1 Ámbitos y Núcleos de Educación Parvularia (Bases Curriculares Dto. 28/2019)
  if (
    n.includes('desarrollo personal') ||
    n.includes('personal y social') ||
    n.includes('identidad y autonomia') ||
    n.includes('convivencia y ciudadania') ||
    n.includes('corporalidad y movimiento')
  ) {
    return 'ambito desarrollo personal y social';
  }
  if (
    n.includes('comunicacion integral') ||
    n.includes('lenguaje verbal') ||
    n.includes('lenguajes artisticos')
  ) {
    return 'ambito comunicacion integral';
  }
  if (
    n.includes('interaccion y comprension') ||
    n.includes('comprension del entorno') ||
    n.includes('interaccion con el entorno') ||
    n.includes('exploracion del entorno natural') ||
    n.includes('comprension del entorno sociocultural') ||
    n.includes('pensamiento matematico')
  ) {
    return 'ambito interaccion y comprension del entorno';
  }
  if (
    n.includes('experiencias de aprendizaje') ||
    n.includes('aprendizaje integrad') ||
    n.includes('experiencias integradas') ||
    n.includes('juego libre guiado') ||
    n.includes('desarrollo integral')
  ) {
    return 'experiencias de aprendizaje integradas';
  }

  // 2. Plan Común Electivo (3° y 4° Medio)
  if (esAsignaturaPlanComunElectivo(n)) {
    return 'plan comun electivo';
  }

  // 3. Inglés
  if (n.includes('ingles')) return 'ingles';

  // 4. Lenguaje y Comunicación / Lengua y Literatura
  if (
    (n.includes('lengua') || n.includes('lenguaje') || /\bcomunicacion\b/i.test(n)) &&
    !n.includes('taller de literatura') && !n.includes('lectura y escritura') && !n.includes('argumentacion')
  ) {
    return 'lenguaje y comunicacion';
  }

  // 5. Matemática
  if (
    (/\b(mate|matematica|matematicas|algebra|geometria|calculo)\b/i.test(n)) &&
    !n.includes('limites') && !n.includes('probabilidades') && !n.includes('pensamiento computacional') && !n.includes('geometria 3d')
  ) {
    return 'matematica';
  }

  // 6. Historia, Geografía y Ciencias Sociales
  if (
    (n.includes('historia') || n.includes('geograf') || (n.includes('sociales') && !n.includes('ciencias naturales'))) &&
    !n.includes('comprension historica') && !n.includes('socioambientales') && !n.includes('economia y sociedad')
  ) {
    return 'historia, geografia y ciencias sociales';
  }

  // 7. Ciencias Naturales y sus ramas en Media (Biología, Física, Química)
  if (
    (
      n.includes('ciencias naturales') ||
      n.includes('naturales') ||
      n.includes('biolog') ||
      n.includes('quimic') ||
      /\b(fisica|ciencias fisicas)\b/i.test(n)
    ) &&
    !n.includes('celular y molecular') && !n.includes('ecosistemas') && !n.includes('ciencias de la salud') && !n.includes('ciudadan')
  ) {
    return 'ciencias naturales';
  }

  // Artes Visuales y/o Música (incluye planes que combinan "Artes Visuales y Música" o "Artes Visuales o Música")
  if (n.includes('artes visuales') && n.includes('musica')) return 'artes visuales y musica';
  if (n.includes('visual') || n.includes('plastica') || (n.includes('artes') && !n.includes('musical'))) return 'artes visuales';
  if (n.includes('musica') || n.includes('musical')) return 'musica';
  if (n.includes('tecno') || n.includes('tecnologia')) return 'tecnologia';
  if (n.includes('orienta')) return 'orientacion';
  if (n.includes('relig')) return 'religion';
  if (n.includes('filosof')) return 'filosofia';

  if (
    n.includes('ciencias para la ciudadania') ||
    n.includes('ciencia para la ciudadania') ||
    n.includes('ciencias ciudadania') ||
    (n.includes('cienc') && n.includes('ciudadan'))
  ) {
    return 'ciencias para la ciudadania';
  }

  if (
    n.includes('educacion ciudadana') ||
    n.includes('formacion ciudadana') ||
    n.includes('ed. ciudadana') ||
    n.includes('ed ciudadana') ||
    (n.includes('ciudadan') && !n.includes('cienc'))
  ) {
    return 'educacion ciudadana';
  }

  return n;
}

export function sonAsignaturasEquivalentes(asigA: string, asigB: string): boolean {
  if (!asigA || !asigB) return false;
  if (asigA.trim().toLowerCase() === asigB.trim().toLowerCase()) return true;

  const aNorm = asigA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const bNorm = asigB.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const esModuloA = /^(m[oó]dulo|oficio|especialidad)\b/i.test(aNorm);
  const esModuloB = /^(m[oó]dulo|oficio|especialidad)\b/i.test(bNorm);
  const esBloqueGenericoTpA = aNorm.includes('formacion diferenciada') && (aNorm.includes('tecnico') || aNorm.includes('tp') || aNorm.includes('especialidad') || aNorm.includes('especializacion') || aNorm.includes('oficio'));
  const esBloqueGenericoTpB = bNorm.includes('formacion diferenciada') && (bNorm.includes('tecnico') || bNorm.includes('tp') || bNorm.includes('especialidad') || bNorm.includes('especializacion') || bNorm.includes('oficio'));

  if (esBloqueGenericoTpA || esBloqueGenericoTpB) {
    const otroNorm = esBloqueGenericoTpA ? normalizarNombreAsignatura(asigB) : normalizarNombreAsignatura(asigA);
    const troncalesNorm = new Set([
      'lenguaje y comunicacion',
      'matematica',
      'historia, geografia y ciencias sociales',
      'ciencias naturales',
      'ingles',
      'educacion fisica y salud',
      'artes visuales',
      'musica',
      'artes visuales y musica',
      'tecnologia',
      'orientacion',
      'religion',
      'filosofia',
      'ciencias para la ciudadania',
      'educacion ciudadana',
      'plan comun electivo',
      'formacion instrumental',
      'ambito desarrollo personal y social',
      'ambito comunicacion integral',
      'ambito interaccion y comprension del entorno',
      'experiencias de aprendizaje integradas'
    ]);
    if (!troncalesNorm.has(otroNorm) && !otroNorm.startsWith('taller_')) {
      return true;
    }
    return false;
  }

  if ((esModuloA && !esModuloB) || (esModuloB && !esModuloA)) {
    return false;
  }

  // Ciencias para la Ciudadanía vs Educación Ciudadana
  const esCienciasCiudadaniaA = aNorm.includes('cienc') && aNorm.includes('ciudadan');
  const esCienciasCiudadaniaB = bNorm.includes('cienc') && bNorm.includes('ciudadan');
  const esEdCiudadanaA = !esCienciasCiudadaniaA && aNorm.includes('ciudadan');
  const esEdCiudadanaB = !esCienciasCiudadaniaB && bNorm.includes('ciudadan');
  if ((esCienciasCiudadaniaA && esEdCiudadanaB) || (esEdCiudadanaA && esCienciasCiudadaniaB)) {
    return false;
  }

  // Talleres (singular/plural), refuerzos, academias o libre disposición JAMÁS equivalen a asignaturas regulares
  const esTallerA = esTextoTallerOLibreDisposicion(aNorm);
  const esTallerB = esTextoTallerOLibreDisposicion(bNorm);
  if ((esTallerA && !esTallerB) || (esTallerB && !esTallerA)) {
    return false;
  }

  // Formación Diferenciada HC (18 HA) equivale a cualquiera de las 27 asignaturas de profundización
  const esDiferenciadaA = aNorm.includes('formacion diferenciada') || aNorm.includes('diferenciado hc');
  const esDiferenciadaB = bNorm.includes('formacion diferenciada') || bNorm.includes('diferenciado hc');
  if (esDiferenciadaA && esAsignaturaProfundizacionHc(asigB)) return true;
  if (esDiferenciadaB && esAsignaturaProfundizacionHc(asigA)) return true;

  // Plan Común Electivo (2 HA)
  const esPlanComunA = aNorm.includes('plan comun electivo') || aNorm.includes('electivo comun');
  const esPlanComunB = bNorm.includes('plan comun electivo') || bNorm.includes('electivo comun');
  if (esPlanComunA && esAsignaturaPlanComunElectivo(asigB)) return true;
  if (esPlanComunB && esAsignaturaPlanComunElectivo(asigA)) return true;

  const normA = normalizarNombreAsignatura(asigA);
  const normB = normalizarNombreAsignatura(asigB);

  // Si el plan tiene el bloque combinado "Artes Visuales y Música" (o "Artes Visuales o Música"),
  // tanto "Artes Visuales" como "Música" cubren ese bloque
  if (
    (normA === 'artes visuales y musica' && (normB === 'artes visuales' || normB === 'musica')) ||
    (normB === 'artes visuales y musica' && (normA === 'artes visuales' || normA === 'musica'))
  ) {
    return true;
  }

  return normA === normB;
}

export function esAsignacionCoDocenciaOApoyo(a: AsignacionHoraria): boolean {
  return Boolean(
    a.esCoDocencia ||
    a.esAgrupacionFlexible ||
    a.tipoApoyo === 'CO_DOCENCIA' ||
    a.tipoApoyo === 'AGRUPACION_FLEXIBLE' ||
    a.tipoApoyo === 'REFUERZO_AULA' ||
    a.tipoApoyo === 'APOYO_DOCENTE' ||
    (a.tipoApoyo && /co-docencia|codocencia|refuerzo|agrupaci[oó]n|apoyo|decreto 170/i.test(a.tipoApoyo)) ||
    (a.asignatura && /co-docencia|codocencia|refuerzo aula|agrupaci[oó]n|apoyo pie/i.test(a.asignatura))
  );
}

/**
 * Determina de forma unificada si una asignación regular corresponde a Libre Disposición (JEC / 7°-8° No JEC).
 */
export function esAsignacionLibreDisposicionJec(
  a: AsignacionHoraria,
  curso: CursoSae | null,
  infoPlan: InfoPlanResuelto
): boolean {
  if (!curso) return false;
  if (esCursoModalidadEpja(curso, infoPlan)) return false;
  if (a.esTallerSep || a.esTrabajoColaborativo || esAsignacionCoDocenciaOApoyo(a)) return false;

  const tieneCupoLibre = infoPlan.esJec || (infoPlan.horasLibreDisposicion || 0) > 0;
  if (!tieneCupoLibre) return false;

  if (a.ambitoCurricular === 'LIBRE_DISPOSICION_JEC') return true;
  if (
    a.ambitoCurricular === 'DIFERENCIADA_HC' ||
    a.ambitoCurricular === 'DIFERENCIADA_TP' ||
    a.ambitoCurricular === 'PLAN_COMUN_ELECTIVO' ||
    a.ambitoCurricular === 'PLAN_COMUN' ||
    a.ambitoCurricular === 'ADICIONAL_EXTRA'
  ) {
    return false;
  }

  const infoCanonica = resolverCodigoYAmbitoAsignatura(a.asignatura, {
    nivelCurso: curso.nivel,
    esJec: a.esTallerJec,
    esTallerSep: a.esTallerSep,
    esTrabajoColaborativo: a.esTrabajoColaborativo,
    esDiferenciadoCompartido: a.esDiferenciadoCompartido
  });

  if (infoCanonica.ambito === 'LIBRE_DISPOSICION_JEC') return true;
  if (
    infoCanonica.ambito === 'DIFERENCIADA_HC' ||
    infoCanonica.ambito === 'DIFERENCIADA_TP' ||
    infoCanonica.ambito === 'PLAN_COMUN_ELECTIVO' ||
    infoCanonica.ambito === 'PLAN_COMUN'
  ) {
    return false;
  }

  const esOficial =
    /taller de literatura|taller laboral/i.test(a.asignatura) ||
    esAsignaturaProfundizacionHc(a.asignatura) ||
    /^m[oó]dulo\b/i.test(a.asignatura);
  if (!esOficial && (a.esTallerJec || esTextoTallerOLibreDisposicion(a.asignatura))) {
    return true;
  }

  const coincideConBase = infoPlan.asignaturas.some(asigPlan => sonAsignaturasEquivalentes(a.asignatura, asigPlan.nombre));
  return !coincideConBase;
}

/**
 * Calcula la disponibilidad y cobertura de asignaturas y Libre Disposición de un curso.
 */
export function calcularDisponibilidadCurso(
  curso: CursoSae | null,
  infoPlan: InfoPlanResuelto,
  asignacionesColegio: AsignacionHoraria[]
): {
  disponibles: DisponibilidadAsignatura[];
  cubiertas: DisponibilidadAsignatura[];
  todas: DisponibilidadAsignatura[];
  horasLibreDisponibles: number;
  horasLibrePlan: number;
  horasLibreAsignadas: number;
  horasCoDocenciaApoyoCurso: number;
} {
  if (!curso) {
    return {
      disponibles: [],
      cubiertas: [],
      todas: [],
      horasLibreDisponibles: 0,
      horasLibrePlan: 0,
      horasLibreAsignadas: 0,
      horasCoDocenciaApoyoCurso: 0
    };
  }

  const perteneceACurso = (a: AsignacionHoraria) =>
    a.cursoId === curso.id || Boolean(a.cursosCompartidosIds && a.cursosCompartidosIds.includes(curso.id));

  const asigsCurso = asignacionesColegio.filter(
    a => perteneceACurso(a) && !esAsignacionCoDocenciaOApoyo(a) && !a.esTallerSep && !a.esTrabajoColaborativo
  );

  const horasCoDocenciaApoyoCurso = asignacionesColegio
    .filter(a => perteneceACurso(a) && esAsignacionCoDocenciaOApoyo(a))
    .reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);

  const esCursoEpja = esCursoModalidadEpja(curso, infoPlan);
  const horasLibrePlan = esCursoEpja ? 0 : (infoPlan.horasLibreDisposicion ?? (infoPlan.esJec ? 6 : 0));

  // Talleres y asignaciones explícitas de Libre Disposición
  const asigsLibres = esCursoEpja
    ? []
    : asigsCurso.filter(a => esAsignacionLibreDisposicionJec(a, curso, infoPlan));
  const idsLibres = new Set(asigsLibres.map(a => a.id));

  const horasTalleresJecAsignadas = asigsLibres.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);

  // Saldo Libre Disposición disponible después de talleres dedicados
  let saldoLibreDisponible = Math.max(0, horasLibrePlan - horasTalleresJecAsignadas);
  let totalCompensadoLibre = 0;

  const todas: DisponibilidadAsignatura[] = infoPlan.asignaturas.map(asigPlan => {
    const esAsigPlanTallerOficial =
      /taller de literatura|taller laboral/i.test(asigPlan.nombre) ||
      esAsignaturaProfundizacionHc(asigPlan.nombre);

    const horasAsig = asigsCurso
      .filter(a => {
        if (idsLibres.has(a.id)) return false;
        if (!esCursoEpja && esTextoTallerOLibreDisposicion(a.asignatura) && !esAsigPlanTallerOficial) return false;
        return sonAsignaturasEquivalentes(a.asignatura, asigPlan.nombre);
      })
      .reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);

    const horasDisp = Math.max(0, Math.round((asigPlan.horas - horasAsig) * 100) / 100);
    const horasExceso = Math.max(0, Math.round((horasAsig - asigPlan.horas) * 100) / 100);

    let horasCompensadas = 0;
    if (!esCursoEpja && (infoPlan.esJec || horasLibrePlan > 0) && horasExceso > 0 && saldoLibreDisponible > 0) {
      horasCompensadas = Math.min(horasExceso, saldoLibreDisponible);
      saldoLibreDisponible = Math.max(0, Math.round((saldoLibreDisponible - horasCompensadas) * 100) / 100);
      totalCompensadoLibre = Math.round((totalCompensadoLibre + horasCompensadas) * 100) / 100;
    }

    const excesoNoCubierto = horasExceso - horasCompensadas;
    const estado: 'DISPONIBLE' | 'CUBIERTA' | 'EXCEDIDA' =
      horasAsig < asigPlan.horas
        ? 'DISPONIBLE'
        : (excesoNoCubierto > 0.01 ? 'EXCEDIDA' : 'CUBIERTA');

    return {
      nombre: asigPlan.nombre,
      horasPlan: asigPlan.horas,
      horasAsignadas: horasAsig,
      horasDisponibles: horasDisp,
      estado,
      caracter: asigPlan.caracter,
      horasCompensadasLibreDisposicion: horasCompensadas
    };
  });

  const disponibles = todas.filter(a => a.estado === 'DISPONIBLE');
  const cubiertas = todas.filter(a => a.estado !== 'DISPONIBLE');

  const horasLibreAsignadas = Math.round((horasTalleresJecAsignadas + totalCompensadoLibre) * 100) / 100;
  const horasLibreDisponibles = Math.max(0, Math.round((horasLibrePlan - horasLibreAsignadas) * 100) / 100);

  return {
    disponibles,
    cubiertas,
    todas,
    horasLibreDisponibles,
    horasLibrePlan,
    horasLibreAsignadas,
    horasCoDocenciaApoyoCurso
  };
}

/**
 * Calcula saldo rápido del docente separado por fuente de financiamiento (Subv. General, SEP, PIE)
 * para mostrar alertas preventivas antes de guardar una asignación horaria.
 */
export function calcularSaldoDocentePorFuente(
  docente: Docente,
  asignacionesColegio: AsignacionHoraria[],
  porcentajePrioritarios: number = 0
): {
  contratoTotal: number;
  contratoSubvGen: number;
  contratoSep: number;
  contratoPie: number;
  horasParaAulaTotal: number;
  saldoJornadaContrato: number;
  esDocentePiePuro: boolean;
  esDocenteSepPuro: boolean;
} {
  const asigsDoc = asignacionesColegio.filter(
    a => a.docenteId === docente.id || (a.coDocenteId === docente.id && a.tieneCoDocente)
  );
  const desglose = calcularHorasFueraAulaDocente(docente, asigsDoc, porcentajePrioritarios);

  const contratoSubvGen = Number(docente.horasSubvencionGeneralTitular || 0) + Number(docente.horasSubvencionGeneralContrata || 0);
  const contratoSep = Number(docente.horasSepTitular || 0) + Number(docente.horasSepContrata || 0);
  const contratoPie = Number(docente.horasPieTitular || 0) + Number(docente.horasPieContrata || 0);

  const esDocentePiePuro =
    docente.estamento === 'DOCENTE_DIFERENCIAL' ||
    (contratoPie > 0 && contratoSubvGen === 0 && contratoSep === 0);
  const esDocenteSepPuro = contratoSep > 0 && contratoSubvGen === 0 && contratoPie === 0;

  return {
    contratoTotal: Number(docente.horasContrato || 0),
    contratoSubvGen,
    contratoSep,
    contratoPie,
    horasParaAulaTotal: desglose.horasParaDocenciaAula,
    saldoJornadaContrato: Math.round((Number(docente.horasContrato || 0) - desglose.horasExentasTotales) * 10) / 10,
    esDocentePiePuro,
    esDocenteSepPuro
  };
}

export { PLANES_MINEDUC, CATALOGO_PROFUNDIZACION_HC_27, CATALOGO_PLAN_COMUN_ELECTIVO_3_4 };
