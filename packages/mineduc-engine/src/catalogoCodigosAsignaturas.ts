/**
 * @file catalogoCodigosAsignaturas.ts
 * @description Sistema Centralizado de Códigos Canónicos de Asignatura (CCA), Ámbitos Curriculares y Mapeo Indexado
 * Cumple con Decreto Exento N° 0876/2019 (Media 3° y 4°), Dto. 2960/2012 (Básica), Dto. 1358/2011 (Media 1° y 2°),
 * Dto. 306/2007 y Dto. 28/2019 (Educación Parvularia) y Ley N° 19.532 (Jornada Escolar Completa Diurna - JEC).
 */

export type AmbitoCurricular = 
  | 'PLAN_COMUN'                // Formación general obligatoria del nivel
  | 'PLAN_COMUN_ELECTIVO'       // Electivo de 2 HA en 3° y 4° Medio (Historia, Artes, Ed. Física, Religión)
  | 'DIFERENCIADA_HC'           // Profundización HC (27 asignaturas oficiales de 6 HA)
  | 'DIFERENCIADA_TP'           // Especialidades Técnico-Profesionales (módulos técnicos 22 HA)
  | 'DIFERENCIADA_ART'          // Especialidades Artísticas (21 HA)
  | 'LIBRE_DISPOSICION_JEC'     // Talleres y asignaturas financiadas con cargo al saldo de Libre Disposición JEC
  | 'ADICIONAL_EXTRA'           // Talleres SEP o extracurriculares exentos de la malla troncal y de la proporción
  | 'PERSONALIZADA';            // Asignatura propia del establecimiento con ámbito parametrizable

export interface DefinicionAsignaturaCanonica {
  codigo: string;
  nombreOficial: string;
  ambito: AmbitoCurricular;
  nivelOModalidad?: string;
  horasSugeridas?: number;
  esElectiva?: boolean;
  areaProfundizacion?: 'A' | 'B' | 'C';
  disciplina?: string;
  descripcion?: string;
  alias?: string[];
}

/**
 * Catálogo Canónico Indexado de Asignaturas Oficiales MINEDUC
 */
export const CATALOGO_CODIGOS_ASIGNATURAS: DefinicionAsignaturaCanonica[] = [
  // ==========================================================================
  // 1. EDUCACIÓN PARVULARIA (BCEP Dto. 28/2019)
  // ==========================================================================
  {
    codigo: 'PC-PARV-DPS',
    nombreOficial: 'Ámbito Desarrollo Personal y Social',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Educación Parvularia',
    horasSugeridas: 9,
    alias: ['desarrollo personal y social', 'personal y social', 'identidad y autonomia', 'convivencia y ciudadania', 'corporalidad y movimiento']
  },
  {
    codigo: 'PC-PARV-CI',
    nombreOficial: 'Ámbito Comunicación Integral',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Educación Parvularia',
    horasSugeridas: 11,
    alias: ['comunicacion integral', 'lenguaje verbal', 'lenguajes artisticos']
  },
  {
    codigo: 'PC-PARV-ICE',
    nombreOficial: 'Ámbito Interacción y Comprensión del Entorno',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Educación Parvularia',
    horasSugeridas: 8,
    alias: ['interaccion y comprension del entorno', 'exploracion del entorno natural', 'comprension del entorno sociocultural', 'pensamiento matematico']
  },
  {
    codigo: 'PC-PARV-EAI',
    nombreOficial: 'Experiencias de Aprendizaje Integradas',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Educación Parvularia',
    horasSugeridas: 4,
    alias: ['experiencias integradas', 'aprendizaje integrado', 'experiencias de aprendizaje integradas']
  },

  // ==========================================================================
  // 2. PLAN COMÚN TRONCAL (BÁSICA Y MEDIA 1°/2°)
  // ==========================================================================
  {
    codigo: 'PC-TRON-LENG',
    nombreOficial: 'Lenguaje y Comunicación',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Básica y Media',
    alias: ['lenguaje y comunicacion', 'lengua castellana y comunicacion', 'lenguaje', 'comunicacion', 'lengua y literatura']
  },
  {
    codigo: 'PC-TRON-MAT',
    nombreOficial: 'Matemática',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Básica y Media',
    alias: ['matematica', 'matematicas', 'educacion matematica']
  },
  {
    codigo: 'PC-TRON-HIST',
    nombreOficial: 'Historia, Geografía y Ciencias Sociales',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Básica y Media',
    alias: ['historia, geografia y ciencias sociales', 'historia y geografia', 'historia', 'ciencias sociales', 'estudios sociales']
  },
  {
    codigo: 'PC-TRON-CNAT',
    nombreOficial: 'Ciencias Naturales',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Básica y Media 1°-2°',
    alias: ['ciencias naturales', 'ciencias de la naturaleza', 'ciencias']
  },
  {
    codigo: 'PC-TRON-BIO',
    nombreOficial: 'Biología',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: '1° y 2° Medio',
    alias: ['biologia', 'ciencias biologicas']
  },
  {
    codigo: 'PC-TRON-FIS',
    nombreOficial: 'Física',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: '1° y 2° Medio',
    alias: ['fisica', 'ciencias fisicas']
  },
  {
    codigo: 'PC-TRON-QUI',
    nombreOficial: 'Química',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: '1° y 2° Medio',
    alias: ['quimica']
  },
  {
    codigo: 'PC-TRON-ING',
    nombreOficial: 'Idioma Extranjero: Inglés',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Básica y Media',
    alias: ['ingles', 'idioma extranjero ingles', 'idioma extranjero: ingles', 'idioma ingles']
  },
  {
    codigo: 'PC-TRON-ART',
    nombreOficial: 'Artes Visuales',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Básica y Media',
    alias: ['artes visuales', 'artes plasticas', 'educacion artistica']
  },
  {
    codigo: 'PC-TRON-MUS',
    nombreOficial: 'Música',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Básica y Media',
    alias: ['musica', 'educacion musical', 'artes musicales']
  },
  {
    codigo: 'PC-TRON-EDFIS',
    nombreOficial: 'Educación Física y Salud',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Básica y Media',
    alias: ['educacion fisica y salud', 'educacion fisica', 'ed fisica', 'ed. fisica', 'deporte', 'educacion y salud']
  },
  {
    codigo: 'PC-TRON-TEC',
    nombreOficial: 'Tecnología',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Básica y Media',
    alias: ['tecnologia', 'educacion tecnologica']
  },
  {
    codigo: 'PC-TRON-ORI',
    nombreOficial: 'Orientación',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Básica y Media',
    alias: ['orientacion', 'orientacion vocacional']
  },
  {
    codigo: 'PC-TRON-REL',
    nombreOficial: 'Religión',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'Básica y Media',
    esElectiva: true,
    alias: ['religion', 'religion catolica', 'religion evangelica', 'formacion espiritual']
  },

  // ==========================================================================
  // 3. PLAN COMÚN DE FORMACIÓN GENERAL 3° Y 4° MEDIO (Decreto Exento N° 0876/2019)
  // ==========================================================================
  {
    codigo: 'PC-MED34-LENG',
    nombreOficial: 'Lengua y Literatura',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: '3° y 4° Medio',
    horasSugeridas: 3,
    alias: ['lengua y literatura', 'lengua y literatura 3 y 4']
  },
  {
    codigo: 'PC-MED34-MAT',
    nombreOficial: 'Matemática',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: '3° y 4° Medio',
    horasSugeridas: 3,
    alias: ['matematica 3 y 4']
  },
  {
    codigo: 'PC-MED34-CIUD',
    nombreOficial: 'Educación Ciudadana',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: '3° y 4° Medio',
    horasSugeridas: 2,
    alias: ['educacion ciudadana', 'formacion ciudadana', 'ed. ciudadana', 'ed ciudadana']
  },
  {
    codigo: 'PC-MED34-FIL',
    nombreOficial: 'Filosofía',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: '3° y 4° Medio',
    horasSugeridas: 2,
    alias: ['filosofia', 'filosofia general']
  },
  {
    codigo: 'PC-MED34-ING',
    nombreOficial: 'Inglés',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: '3° y 4° Medio',
    horasSugeridas: 2,
    alias: ['ingles 3 y 4']
  },
  {
    codigo: 'PC-MED34-CIEN',
    nombreOficial: 'Ciencias para la Ciudadanía',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: '3° y 4° Medio',
    horasSugeridas: 2,
    alias: ['ciencias para la ciudadania', 'ciencia para la ciudadania', 'ciencias ciudadania', 'ciencias de la ciudadania']
  },

  // ==========================================================================
  // 4. PLAN COMÚN ELECTIVO 3° Y 4° MEDIO (Decreto Exento N° 0876/2019 - 2 HA)
  // ==========================================================================
  {
    codigo: 'PCE-MED34-HIST',
    nombreOficial: 'Historia, Geografía y Ciencias Sociales (Electivo)',
    ambito: 'PLAN_COMUN_ELECTIVO',
    nivelOModalidad: '3° y 4° Medio',
    horasSugeridas: 2,
    esElectiva: true,
    alias: ['historia electivo', 'historia, geografia y ciencias sociales (electivo)', 'plan comun electivo historia']
  },
  {
    codigo: 'PCE-MED34-ART',
    nombreOficial: 'Artes (Electivo)',
    ambito: 'PLAN_COMUN_ELECTIVO',
    nivelOModalidad: '3° y 4° Medio',
    horasSugeridas: 2,
    esElectiva: true,
    alias: ['artes electivo', 'artes (electivo)', 'plan comun electivo artes']
  },
  {
    codigo: 'PCE-MED34-EDFIS',
    nombreOficial: 'Educación Física y Salud (Electivo)',
    ambito: 'PLAN_COMUN_ELECTIVO',
    nivelOModalidad: '3° y 4° Medio',
    horasSugeridas: 2,
    esElectiva: true,
    alias: ['educacion fisica electivo', 'educacion fisica y salud (electivo)', 'plan comun electivo educacion fisica']
  },
  {
    codigo: 'PCE-MED34-REL',
    nombreOficial: 'Religión (Electivo)',
    ambito: 'PLAN_COMUN_ELECTIVO',
    nivelOModalidad: '3° y 4° Medio',
    horasSugeridas: 2,
    esElectiva: true,
    alias: ['religion electivo', 'religion (electivo)', 'plan comun electivo religion']
  },

  // ==========================================================================
  // 5. FORMACIÓN DIFERENCIADA HC (27 ASIGNATURAS OFICIALES - 6 HA C/U)
  // ==========================================================================
  // ── ÁREA A: Lengua, Filosofía, Cs. Sociales ──
  {
    codigo: 'DIF-HC-A-LENG-1',
    nombreOficial: 'Taller de Literatura',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'A',
    disciplina: 'Lengua y Literatura',
    alias: ['taller de literatura', 'taller literatura', 'literatura profundizacion', 'electivo taller de literatura']
  },
  {
    codigo: 'DIF-HC-A-LENG-2',
    nombreOficial: 'Lectura y escritura especializadas',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'A',
    disciplina: 'Lengua y Literatura',
    alias: ['lectura y escritura especializadas', 'lectura y escritura']
  },
  {
    codigo: 'DIF-HC-A-LENG-3',
    nombreOficial: 'Participación y argumentación en democracia',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'A',
    disciplina: 'Lengua y Literatura',
    alias: ['participacion y argumentacion en democracia', 'argumentacion en democracia']
  },
  {
    codigo: 'DIF-HC-A-FIL-1',
    nombreOficial: 'Estética',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'A',
    disciplina: 'Filosofía',
    alias: ['estetica', 'electivo estetica']
  },
  {
    codigo: 'DIF-HC-A-FIL-2',
    nombreOficial: 'Filosofía Política',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'A',
    disciplina: 'Filosofía',
    alias: ['filosofia politica']
  },
  {
    codigo: 'DIF-HC-A-FIL-3',
    nombreOficial: 'Seminario de Filosofía',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'A',
    disciplina: 'Filosofía',
    alias: ['seminario de filosofia', 'seminario filosofia']
  },
  {
    codigo: 'DIF-HC-A-HIST-1',
    nombreOficial: 'Comprensión histórica del presente',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'A',
    disciplina: 'Historia, Geografía y Ciencias Sociales',
    alias: ['comprension historica del presente', 'historia del presente']
  },
  {
    codigo: 'DIF-HC-A-HIST-2',
    nombreOficial: 'Geografía, territorio y desafíos socioambientales',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'A',
    disciplina: 'Historia, Geografía y Ciencias Sociales',
    alias: ['geografia, territorio y desafios socioambientales', 'desafios socioambientales', 'geografia y territorio']
  },
  {
    codigo: 'DIF-HC-A-HIST-3',
    nombreOficial: 'Economía y sociedad',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'A',
    disciplina: 'Historia, Geografía y Ciencias Sociales',
    alias: ['economia y sociedad']
  },

  // ── ÁREA B: Matemática y Ciencias ──
  {
    codigo: 'DIF-HC-B-MAT-1',
    nombreOficial: 'Límites, derivadas e integrales',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'B',
    disciplina: 'Matemática',
    alias: ['limites, derivadas e integrales', 'calculo', 'limites y derivadas']
  },
  {
    codigo: 'DIF-HC-B-MAT-2',
    nombreOficial: 'Probabilidades y estadística descriptiva e inferencial',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'B',
    disciplina: 'Matemática',
    alias: ['probabilidades y estadistica descriptiva e inferencial', 'probabilidades y estadistica', 'estadistica']
  },
  {
    codigo: 'DIF-HC-B-MAT-3',
    nombreOficial: 'Geometría 3D',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'B',
    disciplina: 'Matemática',
    alias: ['geometria 3d', 'geometria tridimensional']
  },
  {
    codigo: 'DIF-HC-B-MAT-4',
    nombreOficial: 'Pensamiento computacional y programación',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'B',
    disciplina: 'Matemática',
    alias: ['pensamiento computacional y programacion', 'pensamiento computacional', 'programacion']
  },
  {
    codigo: 'DIF-HC-B-BIO-1',
    nombreOficial: 'Biología celular y molecular',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'B',
    disciplina: 'Ciencias Naturales',
    alias: ['biologia celular y molecular', 'biologia molecular']
  },
  {
    codigo: 'DIF-HC-B-BIO-2',
    nombreOficial: 'Biología de los ecosistemas',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'B',
    disciplina: 'Ciencias Naturales',
    alias: ['biologia de los ecosistemas', 'ecosistemas']
  },
  {
    codigo: 'DIF-HC-B-FIS-1',
    nombreOficial: 'Física',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'B',
    disciplina: 'Ciencias Naturales',
    alias: ['fisica profundizacion', 'fisica electivo', 'fisica 3 y 4']
  },
  {
    codigo: 'DIF-HC-B-QUI-1',
    nombreOficial: 'Química',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'B',
    disciplina: 'Ciencias Naturales',
    alias: ['quimica profundizacion', 'quimica electivo', 'quimica 3 y 4']
  },
  {
    codigo: 'DIF-HC-B-CSALUD-1',
    nombreOficial: 'Ciencias de la Salud',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'B',
    disciplina: 'Ciencias Naturales',
    alias: ['ciencias de la salud', 'salud']
  },

  // ── ÁREA C: Artes y Educación Física ──
  {
    codigo: 'DIF-HC-C-ART-1',
    nombreOficial: 'Artes visuales, audiovisuales y multimediales',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'C',
    disciplina: 'Artes',
    alias: ['artes visuales, audiovisuales y multimediales', 'artes audiovisuales', 'artes multimediales']
  },
  {
    codigo: 'DIF-HC-C-ART-2',
    nombreOficial: 'Creación y composición musical',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'C',
    disciplina: 'Artes',
    alias: ['creacion y composicion musical', 'composicion musical', 'musica profundizacion']
  },
  {
    codigo: 'DIF-HC-C-ART-3',
    nombreOficial: 'Diseño y arquitectura',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'C',
    disciplina: 'Artes',
    alias: ['diseno y arquitectura', 'diseno', 'arquitectura']
  },
  {
    codigo: 'DIF-HC-C-ART-4',
    nombreOficial: 'Interpretación y creación en teatro',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'C',
    disciplina: 'Artes',
    alias: ['interpretacion y creacion en teatro', 'teatro']
  },
  {
    codigo: 'DIF-HC-C-ART-5',
    nombreOficial: 'Interpretación y creación en danza',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'C',
    disciplina: 'Artes',
    alias: ['interpretacion y creacion en danza', 'danza']
  },
  {
    codigo: 'DIF-HC-C-EDFIS-1',
    nombreOficial: 'Promoción de estilos de vida activos y saludables',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'C',
    disciplina: 'Educación Física y Salud',
    alias: ['promocion de estilos de vida activos y saludables', 'estilos de vida activos y saludables']
  },
  {
    codigo: 'DIF-HC-C-EDFIS-2',
    nombreOficial: 'Ciencias del ejercicio físico y del deporte',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'C',
    disciplina: 'Educación Física y Salud',
    alias: ['ciencias del ejercicio fisico y del deporte', 'ciencias del deporte', 'ejercicio fisico y deporte']
  },
  {
    codigo: 'DIF-HC-C-EDFIS-3',
    nombreOficial: 'Expresión corporal',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'C',
    disciplina: 'Educación Física y Salud',
    alias: ['expresion corporal']
  },
  {
    codigo: 'DIF-HC-C-FIL-1',
    nombreOficial: 'Filosofía y cine',
    ambito: 'DIFERENCIADA_HC',
    nivelOModalidad: '3° y 4° Medio HC',
    horasSugeridas: 6,
    areaProfundizacion: 'C',
    disciplina: 'Filosofía',
    alias: ['filosofia y cine']
  },

  // ==========================================================================
  // 6. EDUCACIÓN DE PERSONAS JÓVENES Y ADULTAS - EPJA (D.S. N° 10/2022 y D.S. N° 452/2013)
  // ==========================================================================
  // ── Formación Instrumental (2 HA en Media HC y TP Adultos) ──
  {
    codigo: 'PC-EPJA-INST-GEN',
    nombreOficial: 'Formación Instrumental',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'EPJA Educación Media',
    horasSugeridas: 2,
    alias: [
      'formacion instrumental',
      'formacion instrumental (pensamiento computacional / responsabilidad personal y social / emprendimiento y empleabilidad / educacion financiera)',
      'formacion instrumental (convivencia social / consumo y calidad de vida / insercion laboral / tecnologias de la informacion y las telecomunicaciones)'
    ]
  },
  {
    codigo: 'PC-EPJA-INST-1',
    nombreOficial: 'Pensamiento Computacional (Formación Instrumental EPJA)',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'EPJA Educación Media',
    horasSugeridas: 2,
    alias: ['pensamiento computacional epja', 'formacion instrumental: pensamiento computacional', 'instrumental pensamiento computacional']
  },
  {
    codigo: 'PC-EPJA-INST-2',
    nombreOficial: 'Responsabilidad Personal y Social',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'EPJA Educación Media',
    horasSugeridas: 2,
    alias: ['responsabilidad personal y social', 'formacion instrumental: responsabilidad personal y social', 'convivencia social']
  },
  {
    codigo: 'PC-EPJA-INST-3',
    nombreOficial: 'Emprendimiento y Empleabilidad',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'EPJA Educación Media',
    horasSugeridas: 2,
    alias: ['emprendimiento y empleabilidad', 'formacion instrumental: emprendimiento y empleabilidad', 'insercion laboral']
  },
  {
    codigo: 'PC-EPJA-INST-4',
    nombreOficial: 'Educación Financiera',
    ambito: 'PLAN_COMUN',
    nivelOModalidad: 'EPJA Educación Media',
    horasSugeridas: 2,
    alias: ['educacion financiera', 'formacion instrumental: educacion financiera', 'consumo y calidad de vida']
  },
  // ── Formación Diferenciada EPJA (Oficios y Especialidades TP - Sin JEC) ──
  {
    codigo: 'DIF-EPJA-OFICIOS',
    nombreOficial: 'Formación Diferenciada en Oficios',
    ambito: 'DIFERENCIADA_TP',
    nivelOModalidad: 'EPJA Básica y Media',
    horasSugeridas: 4,
    alias: [
      'formacion diferenciada en oficios',
      'formacion en oficios',
      'formacion diferenciada en oficios: aprendizaje de un oficio en algun area de actividad economica de interes (4 horas semanales)',
      'formacion diferenciada en oficios: aprendizaje de un oficio en algun area de actividad economica de interes (a lo menos 4 horas semanales)'
    ]
  },
  {
    codigo: 'DIF-EPJA-TP-ESP',
    nombreOficial: 'Formación Diferenciada con Especialización',
    ambito: 'DIFERENCIADA_TP',
    nivelOModalidad: 'EPJA Educación Media TP (Niveles 2 y 3)',
    horasSugeridas: 12,
    alias: [
      'formacion diferenciada con especializacion',
      'formacion diferenciada tp (especialidad)',
      'formacion diferenciada tp',
      'formacion diferenciada con especializacion: especializacion diferenciada en sectores economicos especificos (a lo menos 12 horas semanales)',
      'especializacion diferenciada en sectores economicos especificos'
    ]
  }
];

// ============================================================================
// MAPAS DE BÚSQUEDA RÁPIDA EN O(1)
// ============================================================================
const MAPA_POR_CODIGO = new Map<string, DefinicionAsignaturaCanonica>();
const MAPA_POR_NOMBRE_NORM = new Map<string, DefinicionAsignaturaCanonica>();

function normalizarCadenaBusqueda(txt: string): string {
  if (!txt) return '';
  return txt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

for (const asig of CATALOGO_CODIGOS_ASIGNATURAS) {
  MAPA_POR_CODIGO.set(asig.codigo.toUpperCase(), asig);
  MAPA_POR_NOMBRE_NORM.set(normalizarCadenaBusqueda(asig.nombreOficial), asig);
  if (asig.alias) {
    for (const al of asig.alias) {
      MAPA_POR_NOMBRE_NORM.set(normalizarCadenaBusqueda(al), asig);
    }
  }
}

/**
 * Obtiene la definición de una asignatura a partir de su código canónico
 */
export function obtenerAsignaturaPorCodigo(codigo?: string): DefinicionAsignaturaCanonica | null {
  if (!codigo) return null;
  return MAPA_POR_CODIGO.get(codigo.toUpperCase().trim()) || null;
}

/**
 * Auto-indexa y resuelve el código canónico y ámbito normativo de cualquier asignatura por nombre y nivel.
 * Si no está catalogada, genera un código determinista clasificando si es JEC o adicional.
 */
export function resolverCodigoYAmbitoAsignatura(
  nombreAsignatura: string,
  contexto?: {
    nivelCurso?: string;
    esJec?: boolean;
    esTallerSep?: boolean;
    esTrabajoColaborativo?: boolean;
    esCoDocencia?: boolean;
    esDiferenciadoCompartido?: boolean;
    ambitoExplicito?: AmbitoCurricular;
  }
): {
  codigo: string;
  ambito: AmbitoCurricular;
  nombreOficial: string;
  esOficial: boolean;
  horasSugeridas?: number;
} {
  const norm = normalizarCadenaBusqueda(nombreAsignatura);
  const nivelNorm = normalizarCadenaBusqueda(contexto?.nivelCurso || '');
  const esContextoEpja = /\b(epja|adulto|adultos|tercera jornada|vespertin|nocturn)\b/i.test(nivelNorm) ||
    (/\bnivel\s*[123]\b/i.test(nivelNorm) && !/\b(nt[12]|transicion|parvulo)\b/i.test(nivelNorm));

  const esTextoTaller = /\b(taller(?:es)?|reforzamientos?|refuerzos?|academias?|club(?:es)?|jec|libre\s+disposicion)\b/i.test(norm);
  const esTallerOficial = (norm.includes('taller') && norm.includes('literatura')) || norm.includes('taller laboral');
  const slug = norm.replace(/\s+/g, '_').substring(0, 30).toUpperCase();

  // Prioridad absoluta: si la asignación pertenece a SEP o Trabajo Colaborativo Art. 86, nunca debe colisionar con malla oficial
  if (contexto?.esTallerSep || /\bsep\b|subvencion escolar/i.test(norm)) {
    return {
      codigo: `ADICIONAL-SEP-${slug || 'TALLER'}`,
      ambito: 'ADICIONAL_EXTRA',
      nombreOficial: nombreAsignatura.trim(),
      esOficial: false
    };
  }

  if (contexto?.esTrabajoColaborativo || /colaborativo|co planificacion|art 86/i.test(norm)) {
    return {
      codigo: `ADICIONAL-COLAB-${slug || 'TRABAJO'}`,
      ambito: 'ADICIONAL_EXTRA',
      nombreOficial: nombreAsignatura.trim(),
      esOficial: false
    };
  }

  // Si el ámbito fue especificado explícitamente como LIBRE_DISPOSICION_JEC (o es taller/JEC en contexto no EPJA ni taller oficial):
  // debe prevalecer sobre el catálogo general para que "Talleres de educación física y deporte" nunca sea secuestrado por "Física" ni "Ed. Física".
  if (
    !esContextoEpja &&
    (
      contexto?.ambitoExplicito === 'LIBRE_DISPOSICION_JEC' ||
      (contexto?.esJec === true && !esTallerOficial) ||
      (esTextoTaller && !esTallerOficial && contexto?.ambitoExplicito !== 'PLAN_COMUN' && contexto?.ambitoExplicito !== 'DIFERENCIADA_HC')
    )
  ) {
    return {
      codigo: `JEC-${slug || 'TALLER'}`,
      ambito: 'LIBRE_DISPOSICION_JEC',
      nombreOficial: nombreAsignatura.trim(),
      esOficial: false
    };
  }

  // 0. Detección especial prioritaria para Módulos y Formación Diferenciada Técnico-Profesional / Oficios (Decreto 0876/2019 y EPJA D.S. 10/2022)
  if (
    /^(modulo|modulo mencion|modulo comun|oficio|especialidad)\b/i.test(norm) ||
    /^(modulo|modulo mencion|modulo comun|oficio|especialidad):/i.test(nombreAsignatura.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ||
    (norm.includes('formacion diferenciada') && (norm.includes('especializacion') || norm.includes('oficio') || norm.includes('tp') || norm.includes('tecnico') || norm.includes('especialidad')))
  ) {
    const slugMod = norm
      .replace(/^(modulo|oficio|especialidad|formacion diferenciada)\s*(mencion|comun|con especializacion|en oficios|tp)?\s*:?\s*/i, '')
      .replace(/\s+/g, '_')
      .substring(0, 32)
      .toUpperCase();
    return {
      codigo: `DIF-TP-${slugMod || 'MODULO'}`,
      ambito: 'DIFERENCIADA_TP',
      nombreOficial: nombreAsignatura.trim(),
      esOficial: true
    };
  }

  // 0.1 Detección prioritaria para Formación Instrumental EPJA (2 HA)
  if (norm.startsWith('formacion instrumental')) {
    const asig = MAPA_POR_CODIGO.get('PC-EPJA-INST-GEN')!;
    return { codigo: asig.codigo, ambito: asig.ambito, nombreOficial: nombreAsignatura.trim(), esOficial: true, horasSugeridas: 2 };
  }

  // 1. Detección especial prioritaria para evitar colisión de Ciudadanía
  if (norm.includes('cienc') && norm.includes('ciudadan')) {
    const asig = MAPA_POR_CODIGO.get('PC-MED34-CIEN')!;
    return { codigo: asig.codigo, ambito: asig.ambito, nombreOficial: asig.nombreOficial, esOficial: true, horasSugeridas: asig.horasSugeridas };
  }
  if (norm.includes('ciudadan') && !norm.includes('cienc')) {
    const asig = MAPA_POR_CODIGO.get('PC-MED34-CIUD')!;
    return { codigo: asig.codigo, ambito: asig.ambito, nombreOficial: asig.nombreOficial, esOficial: true, horasSugeridas: asig.horasSugeridas };
  }

  // 2. Detección especial prioritaria para Taller de Literatura (Decreto 0876)
  if (norm.includes('taller') && norm.includes('literatura')) {
    const asig = MAPA_POR_CODIGO.get('DIF-HC-A-LENG-1')!;
    return { codigo: asig.codigo, ambito: asig.ambito, nombreOficial: asig.nombreOficial, esOficial: true, horasSugeridas: asig.horasSugeridas };
  }

  // 3. Búsqueda exacta en catálogo por nombre u alias
  const matchDirecto = MAPA_POR_NOMBRE_NORM.get(norm);
  if (matchDirecto) {
    return {
      codigo: matchDirecto.codigo,
      ambito: matchDirecto.ambito,
      nombreOficial: matchDirecto.nombreOficial,
      esOficial: true,
      horasSugeridas: matchDirecto.horasSugeridas
    };
  }

  // 4. Búsqueda flexible por catálogo de 27 asignaturas de profundización HC
  // Exige coincidencia exacta o subfrase multi-palabra con límites de palabra (nunca "fisica" dentro de un taller de educación física)
  if (!esTextoTaller) {
    for (const item of CATALOGO_CODIGOS_ASIGNATURAS) {
      if (item.ambito === 'DIFERENCIADA_HC') {
        const itemNorm = normalizarCadenaBusqueda(item.nombreOficial);
        const esCoincidenciaSegura =
          norm === itemNorm ||
          (itemNorm.includes(' ') && new RegExp(`\\b${itemNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(norm));
        if (esCoincidenciaSegura) {
          return {
            codigo: item.codigo,
            ambito: item.ambito,
            nombreOficial: item.nombreOficial,
            esOficial: true,
            horasSugeridas: item.horasSugeridas
          };
        }
      }
    }
  }

  // 5. Búsqueda flexible en Plan Común Electivo (3° y 4° Medio)
  for (const item of CATALOGO_CODIGOS_ASIGNATURAS) {
    if (item.ambito === 'PLAN_COMUN_ELECTIVO') {
      const itemNorm = normalizarCadenaBusqueda(item.nombreOficial);
      if (norm.includes('electivo') && (norm.includes(itemNorm) || itemNorm.includes(norm))) {
        return {
          codigo: item.codigo,
          ambito: item.ambito,
          nombreOficial: item.nombreOficial,
          esOficial: true,
          horasSugeridas: item.horasSugeridas
        };
      }
    }
  }

  // 6. Si no es oficial, generar un código identificando si es EPJA o Personalizada
  // En contexto EPJA (Adultos), NUNCA existe régimen JEC (D.S. N° 10/2022).
  // Las asignaturas/módulos de especialidad u oficios creados con nombres propios pertenecen a Formación Diferenciada TP.
  if (esContextoEpja) {
    return {
      codigo: `DIF-EPJA-${slug || 'MODULO'}`,
      ambito: 'DIFERENCIADA_TP',
      nombreOficial: nombreAsignatura.trim(),
      esOficial: true
    };
  }

  if (esTextoTaller || contexto?.esJec) {
    return {
      codigo: `JEC-${slug || 'TALLER'}`,
      ambito: 'LIBRE_DISPOSICION_JEC',
      nombreOficial: nombreAsignatura.trim(),
      esOficial: false
    };
  }

  // Asignatura personalizada de la escuela
  return {
    codigo: `CUSTOM-${slug || 'ASIG'}`,
    ambito: 'PERSONALIZADA',
    nombreOficial: nombreAsignatura.trim(),
    esOficial: false
  };
}
