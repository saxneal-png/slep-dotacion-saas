// =============================================================================
// REGLA DE NEGOCIO PURA: PLANES Y PROGRAMAS DE ESTUDIO OFICIALES MINEDUC
// =============================================================================

export interface AsignaturaPlan {
  nombre: string;
  horasSugeridas: number;
}

export interface PlanEstudioNivel {
  nivel: string;
  regimen: 'JEC' | 'No JEC';
  horasObligatorias: number;
  horasLibreDisposicion: number;
  totalHorasPlan: number;
  asignaturasBase: AsignaturaPlan[];
  categoria?: 'PARVULARIA' | 'BASICA' | 'MEDIA_HC' | 'MEDIA_TP' | 'EPJA' | 'ESPECIAL' | 'LABORAL' | 'MULTIGRADO' | 'OTRO';
  referenciaFuente?: string;
}

export const DATA_PLANES_ESTUDIO_MINEDUC = {
  "parvularia": {
    nombre: "Educación Parvularia (NT1 y NT2)",
    regimen: {
      JEC: { total: 28, libre: 4 },
      No_JEC: { total: 22, libre: 0 }
    },
    asignaturas: [
      { nombre: "Ámbito Desarrollo Personal y Social", JEC: 8, No_JEC: 6 },
      { nombre: "Ámbito Comunicación Integral", JEC: 10, No_JEC: 8 },
      { nombre: "Ámbito Interacción y Comprensión del Entorno", JEC: 6, No_JEC: 6 },
      { nombre: "Experiencias de Aprendizaje Integradas", JEC: 4, No_JEC: 2 }
    ]
  },
  "multigrado_parvularia": {
    nombre: "Multigrado Parvularia (NT1-NT2)",
    regimen: {
      JEC: { total: 28, libre: 4 },
      No_JEC: { total: 22, libre: 0 }
    },
    asignaturas: [
      { nombre: "Ámbito Desarrollo Personal y Social", JEC: 8, No_JEC: 6 },
      { nombre: "Ámbito Comunicación Integral", JEC: 10, No_JEC: 8 },
      { nombre: "Ámbito Interacción y Comprensión del Entorno", JEC: 6, No_JEC: 6 },
      { nombre: "Experiencias de Aprendizaje Integradas", JEC: 4, No_JEC: 2 }
    ]
  },
  "1_4_basico": {
    nombre: "1° a 4° año de Educación Básica",
    regimen: {
      JEC: { total: 38, libre: 6.5 },
      No_JEC: { total: 30, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 8, No_JEC: 8 },
      { nombre: "Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 3, No_JEC: 3 },
      { nombre: "Artes Visuales", JEC: 2, No_JEC: 2 },
      { nombre: "Música", JEC: 2, No_JEC: 2 },
      { nombre: "Educación Física y Salud", JEC: 4, No_JEC: 3 },
      { nombre: "Orientación", JEC: 0.5, No_JEC: 0.5 },
      { nombre: "Tecnología", JEC: 1, No_JEC: 0.5 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Ciencias Naturales", JEC: 3, No_JEC: 3 }
    ]
  },
  "5_6_basico": {
    nombre: "5° a 6° año de Educación Básica",
    regimen: {
      JEC: { total: 38, libre: 6 },
      No_JEC: { total: 30, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 6, No_JEC: 6 },
      { nombre: "Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Artes Visuales", JEC: 1.5, No_JEC: 1 },
      { nombre: "Música", JEC: 1.5, No_JEC: 1 },
      { nombre: "Educación Física y Salud", JEC: 2, No_JEC: 2 },
      { nombre: "Orientación", JEC: 1, No_JEC: 1 },
      { nombre: "Tecnología", JEC: 1, No_JEC: 1 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 3, No_JEC: 3 }
    ]
  },
  "7_8_basico": {
    nombre: "7° a 8° año de Educación Básica (Estándar)",
    regimen: {
      JEC: { total: 38, libre: 6 },
      No_JEC: { total: 33, libre: 2 }
    },
    asignaturas: [
      { nombre: "Lengua y Literatura", JEC: 6, No_JEC: 6 },
      { nombre: "Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Artes Visuales y Música", JEC: 3, No_JEC: 2 },
      { nombre: "Educación Física y Salud", JEC: 2, No_JEC: 2 },
      { nombre: "Orientación", JEC: 1, No_JEC: 1 },
      { nombre: "Tecnología", JEC: 1, No_JEC: 1 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 3, No_JEC: 3 }
    ]
  },
  "7_8_basico_indigena": {
    nombre: "7° a 8° año de Educación Básica - Con Sector Lengua Indígena",
    regimen: {
      JEC: { total: 38, libre: 6 },
      No_JEC: { total: 33, libre: 2 }
    },
    asignaturas: [
      { nombre: "Lengua y Literatura", JEC: 5, No_JEC: 4 },
      { nombre: "Lengua Indígena", JEC: 4, No_JEC: 4 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 3, No_JEC: 3 },
      { nombre: "Artes Visuales y Música", JEC: 3, No_JEC: 2 },
      { nombre: "Educación Física y Salud", JEC: 2, No_JEC: 2 },
      { nombre: "Orientación", JEC: 1, No_JEC: 1 },
      { nombre: "Tecnología", JEC: 1, No_JEC: 1 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Ciencias Naturales", JEC: 3, No_JEC: 4 }
    ]
  },
  "multigrado_basica": {
    nombre: "Educación Básica Multigrado / Combinada",
    regimen: {
      JEC: { total: 38, libre: 6 },
      No_JEC: { total: 30, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 7, No_JEC: 7 },
      { nombre: "Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 3.5, No_JEC: 3.5 },
      { nombre: "Ciencias Naturales", JEC: 3.5, No_JEC: 3 },
      { nombre: "Artes Visuales y Música", JEC: 3, No_JEC: 2.5 },
      { nombre: "Educación Física y Salud", JEC: 3, No_JEC: 2.5 },
      { nombre: "Tecnología", JEC: 1.5, No_JEC: 1 },
      { nombre: "Orientación", JEC: 1, No_JEC: 0.5 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2.5, No_JEC: 2 }
    ]
  },
  "1_2_medio": {
    nombre: "1° y 2° año de Educación Media",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 33, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua y Literatura", JEC: 6, No_JEC: 6 },
      { nombre: "Matemática", JEC: 7, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Artes Visuales o Música", JEC: 2, No_JEC: 2 },
      { nombre: "Educación Física y Salud", JEC: 2, No_JEC: 2 },
      { nombre: "Orientación", JEC: 1, No_JEC: 1 },
      { nombre: "Tecnología", JEC: 2, No_JEC: 1 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Ciencias Naturales", JEC: 6, No_JEC: 6 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 4, No_JEC: 3 }
    ]
  },
  "3_4_medio": {
    nombre: "3° y 4° año de Educación Media",
    plan_comun_general: [
      { nombre: "Lengua y Literatura", horas: 3 },
      { nombre: "Matemática", horas: 3 },
      { nombre: "Educación Ciudadana", horas: 2 },
      { nombre: "Filosofía", horas: 2 },
      { nombre: "Inglés", horas: 2 },
      { nombre: "Ciencias para la Ciudadanía", horas: 2 }
    ],
    plan_comun_electivo: [
      { nombre: "Electivo Común (Religión/Historia/Artes/Ed.Física)", horas: 2 }
    ],
    modalidades: {
      humanistico_cientifico: {
        nombre: "Humanístico-Científico",
        diferenciada: 18,
        JEC: { total: 42, libre: 8 },
        No_JEC: { total: 36, libre: 2 }
      },
      tecnico_profesional: {
        nombre: "Técnico-Profesional",
        diferenciada: 22,
        JEC: { total: 42, libre: 6 },
        No_JEC: { total: 38, libre: 2 }
      },
      artistico: {
        nombre: "Artístico",
        diferenciada: 21,
        JEC: { total: 42, libre: 5 },
        No_JEC: { total: 0, libre: 0 }
      }
    }
  },
  // ===========================================================================
  // EDUCACIÓN MEDIA TÉCNICO-PROFESIONAL (DECRETOS 452/2013 Y 0954/2015)
  // ===========================================================================
  "tp_formacion_general_3_4": {
    nombre: "3° y 4° Medio Técnico-Profesional (Plan Común de Formación General)",
    referenciaFuente: "Decreto Supremo de Educación N° 452/2013 y Decreto Exento de Educación N° 0954/2015",
    regimen: {
      JEC: { total: 20, libre: 6 },
      No_JEC: { total: 14, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_electricidad_3": {
    nombre: "3° Medio - Especialidad Electricidad (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Electricidad (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Instalación de motores eléctricos y equipos de calefacción", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Instalaciones eléctricas domiciliarias", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Elaboración de proyectos eléctricos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Mantenimiento de máquinas, equipos y sistemas eléctricos", JEC: 6, No_JEC: 6 }
    ]
  },
  "tp_electricidad_4": {
    nombre: "4° Medio - Especialidad Electricidad (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Electricidad (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Instalación de sistemas de control eléctrico industrial", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Instalaciones eléctricas industriales", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Instalación de equipos electrónicos de potencia", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Automatización de sistemas eléctricos industriales", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_programacion_3": {
    nombre: "3° Medio - Especialidad Programación (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Programación (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Programación y bases de datos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Instalación y configuración de equipos informáticos", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo: Soporte a usuarios y productividad", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Sistemas operativos", JEC: 5, No_JEC: 5 }
    ]
  },
  "tp_programacion_4": {
    nombre: "4° Medio - Especialidad Programación (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Programación (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Diseño de bases de datos relacionales", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Programación orientada a objetos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Administración de bases de datos", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Desarrollo de aplicaciones web", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_gastronomia_3": {
    nombre: "3° Medio - Especialidad Gastronomía (Plan Común de la Especialidad)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Gastronomía (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Higiene para la elaboración de alimentos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Elaboración de alimentos de baja complejidad", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Recepción y almacenamiento de insumos", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Planificación de la producción gastronómica", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Preparación, diseño y montaje de buffet", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Servicio de comedores, bares y salones", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_gastronomia_cocina_4": {
    nombre: "4° Medio - Especialidad Gastronomía, Mención Cocina",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Gastronomía (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Cocina chilena", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Innovación y cocina internacional", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Elaboración de bebidas alcohólicas y analcohólicas", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Elaboración de menús y carta", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_gastronomia_pasteleria_4": {
    nombre: "4° Medio - Especialidad Gastronomía, Mención Pastelería y Repostería",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Gastronomía (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Elaboración de masas y pastas", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Elaboración de productos de repostería", JEC: 3, No_JEC: 3 },
      { nombre: "Módulo mención: Elaboración de productos de pastelería", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Innovación en la pastelería y repostería", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_parvulos_3": {
    nombre: "3° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Atención de Párvulos (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Material didáctico y de ambientación", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Expresión musical para párvulos", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Relación con la familia", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Salud en párvulos", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Recreación y bienestar de los párvulos", JEC: 6, No_JEC: 6 }
    ]
  },
  "tp_parvulos_4": {
    nombre: "4° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Atención de Párvulos (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Actividades educativas para párvulos", JEC: 7, No_JEC: 7 },
      { nombre: "Módulo: Expresión literaria y teatral con párvulos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Alimentación de los párvulos", JEC: 3, No_JEC: 3 },
      { nombre: "Módulo: Higiene y seguridad de los párvulos", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_administracion_3": {
    nombre: "3° Medio - Especialidad Administración (Plan Común de la Especialidad)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Administración (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Utilización de información contable", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Gestión comercial y tributaria", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Procesos administrativos", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo: Atención de clientes", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Organización de oficinas", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Aplicaciones informáticas para la gestión administrativa", JEC: 3, No_JEC: 3 }
    ]
  },
  "tp_administracion_rrhh_4": {
    nombre: "4° Medio - Especialidad Administración, Mención Recursos Humanos",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Administración (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Legislación laboral", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Cálculo de remuneraciones, finiquitos y obligaciones laborales", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Desarrollo y bienestar del personal", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Dotación de personal", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_construccion_3": {
    nombre: "3° Medio - Especialidad Construcción (Plan Común de la Especialidad)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Construcción (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Análisis de muestras de hormigón, suelos y materiales", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Carpintería de instalación de faenas", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Control y mantenimiento de bodegas y pañoles", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Cubicación de materiales e insumos", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Interpretación de planos de construcción", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Prevención de riesgos en la construcción", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Trazado de obras de construcción", JEC: 4, No_JEC: 4 }
    ]
  },
  "tp_construccion_edificacion_4": {
    nombre: "4° Medio - Especialidad Construcción, Mención Edificación",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Construcción (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Albañilerías estructurales y no estructurales", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Carpintería estructural", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Enfierradura para elementos estructurales", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Estructuras de hormigón", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_construccion_terminaciones_4": {
    nombre: "4° Medio - Especialidad Construcción, Mención Terminaciones de la Construcción",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Construcción (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Impermeabilización y aislación de elementos", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Instalación de cubiertas y elementos de evacuación de aguas lluvias", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Instalación de muebles, puertas y ventanas", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Revestimientos para pisos, muros y cielos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_construccion_viales_4": {
    nombre: "4° Medio - Especialidad Construcción, Mención Obras Viales e Infraestructura",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Construcción (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Calidad en obras viales e infraestructura", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo mención: Seguridad vial", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Mantenimiento de obras viales", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Conformación de la calzada", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Infraestructura para la protección de la calzada", JEC: 3, No_JEC: 3 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_mecanica_industrial_3": {
    nombre: "3° Medio - Especialidad Mecánica Industrial (Plan Común de la Especialidad)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Mecánica Industrial (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Soldadura industrial", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo: Mantenimiento de herramientas", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo: Medición y verificación", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo: Mecánica de banco", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Lectura de manuales y planos", JEC: 3, No_JEC: 3 }
    ]
  },
  "tp_mecanica_mantenimiento_4": {
    nombre: "4° Medio - Especialidad Mecánica Industrial, Mención Mantenimiento Electromecánico",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Mecánica Industrial (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Mantenimiento y reparación industrial", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Detección de fallas en sistemas industriales", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Control de procesos industriales", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Montaje de equipos y sistemas industriales", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_mecanica_herramientas_4": {
    nombre: "4° Medio - Especialidad Mecánica Industrial, Mención Máquinas-Herramientas",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Mecánica Industrial (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Torneado de piezas y conjuntos mecánicos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Fresado de piezas y conjuntos mecánicos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Taladrado y rectificado de piezas mecánicas", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Mecanizado con máquinas de control numérico computacional", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_mecanica_matriceria_4": {
    nombre: "4° Medio - Especialidad Mecánica Industrial, Mención Matricería",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Mecánica Industrial (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Fabricación de matrices", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo mención: Fabricación de moldes", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo mención: Mantención de matrices y moldes", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo mención: Diseño y dibujo de moldes y matrices", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_agropecuaria_3": {
    nombre: "3° Medio - Especialidad Agropecuaria (Plan Común de la Especialidad)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Agropecuaria (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Manejo de suelo y residuos", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo: Manejo de técnicas de riego", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Técnicas de reproducción vegetal", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo: Alimentación y pesaje pecuario", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Control de plagas y enfermedades", JEC: 4, No_JEC: 4 }
    ]
  },
  "tp_agropecuaria_agricultura_4": {
    nombre: "4° Medio - Especialidad Agropecuaria, Mención Agricultura",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Agropecuaria (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Técnicas de cultivo de especies vegetales", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo mención: Manejos para optimización productiva de frutales", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Postcosecha y guarda de productos agrícolas", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Mantenimiento de maquinarias y equipos agrícolas", JEC: 3, No_JEC: 3 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_agropecuaria_pecuaria_4": {
    nombre: "4° Medio - Especialidad Agropecuaria, Mención Pecuaria",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Agropecuaria (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Manejos pecuarios", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo mención: Reproducción animal", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Producción lechera", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Sanidad y bienestar animal", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Cultivo de praderas y forrajes", JEC: 3, No_JEC: 3 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_agropecuaria_vitivinicola_4": {
    nombre: "4° Medio - Especialidad Agropecuaria, Mención Vitivinícola",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Agropecuaria (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Viticultura", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo mención: Cosecha y transporte de vides", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Elaboración de vinos", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Envasado y maquinaria vitivinícola", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Manejo de bodegas vitivinícolas", JEC: 3, No_JEC: 3 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_elaboracion_alimentos_3": {
    nombre: "3° Medio - Especialidad Elaboración Industrial de Alimentos (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Elaboración Industrial de Alimentos (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Recepción de materias primas", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo: Almacenaje y bodega de alimentos e insumos alimentarios", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo: Elaboración de alimentos e higiene", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Aseguramiento de la calidad de procesos y alimentos", JEC: 6, No_JEC: 6 }
    ]
  },
  "tp_elaboracion_alimentos_4": {
    nombre: "4° Medio - Especialidad Elaboración Industrial de Alimentos (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Elaboración Industrial de Alimentos (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Tratamientos de conservación de alimentos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Control y registro de procesos de la industria de alimentos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Manejo de desechos de la industria de alimentos", JEC: 3, No_JEC: 3 },
      { nombre: "Módulo: Envasado y rotulación de alimentos", JEC: 5, No_JEC: 5 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_administracion_logistica_4": {
    nombre: "4° Medio - Especialidad Administración, Mención Logística",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Administración (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo mención: Almacenamiento y control de inventarios", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Procesamiento de pedidos y distribución", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo mención: Operaciones de importación y exportación", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo mención: Legislación laboral aplicada", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_mecanica_automotriz_3": {
    nombre: "3° Medio - Especialidad Mecánica Automotriz (Plan Común de la Especialidad)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Mecánica Automotriz (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Motores de combustión interna y sus sistemas", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Sistemas de frenos, suspensión y dirección", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Sistemas eléctricos y electrónicos automotrices", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Mantenimiento preventivo de vehículos livianos", JEC: 4, No_JEC: 4 }
    ]
  },
  "tp_mecanica_automotriz_4": {
    nombre: "4° Medio - Especialidad Mecánica Automotriz (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Mecánica Automotriz (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Diagnóstico electrónico y control de emisiones", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Sistemas de transmisión y transferencia de fuerza", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Sistemas de inyección electrónica diésel y gasolina", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Mantenimiento y reparación de vehículos pesados y electromovilidad", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_electronica_3": {
    nombre: "3° Medio - Especialidad Electrónica (Plan Común de la Especialidad)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Electrónica (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Circuitos analógicos y digitales", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Montaje y soldadura de componentes electrónicos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Medición y verificación electrónica", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Sistemas de automatización y control", JEC: 4, No_JEC: 4 }
    ]
  },
  "tp_electronica_4": {
    nombre: "4° Medio - Especialidad Electrónica (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Electrónica (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Sistemas de microcontroladores y programación embebida", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Mantenimiento y reparación de equipos electrónicos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Telecomunicaciones y redes de datos", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Sistemas de potencia y actuadores", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_enfermeria_3": {
    nombre: "3° Medio - Especialidad Atención de Enfermería (Plan Común de la Especialidad)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Atención de Enfermería (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Cuidados básicos de enfermería", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Higiene y bioseguridad en salud", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Primeros auxilios y atención de urgencia", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Promoción y prevención en salud comunitaria", JEC: 4, No_JEC: 4 }
    ]
  },
  "tp_enfermeria_4": {
    nombre: "4° Medio - Especialidad Atención de Enfermería (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Atención de Enfermería (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Administración de medicamentos y procedimientos invasivos menores", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Cuidados del adulto mayor y paciente en situación de dependencia", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Atención en salud materno-infantil y del adolescente", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Registros clínicos y bioética en salud", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_contabilidad_3": {
    nombre: "3° Medio - Especialidad Contabilidad (Plan Común de la Especialidad)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Contabilidad (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Procesos contables y estados financieros básicos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Legislación tributaria aplicada", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Legislación laboral y previsión social", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Utilización de software contable y ERP", JEC: 4, No_JEC: 4 }
    ]
  },
  "tp_contabilidad_4": {
    nombre: "4° Medio - Especialidad Contabilidad (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Contabilidad (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Contabilidad de costos y presupuestos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Auditoría y control interno", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Declaraciones de impuestos mensuales y anuales", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Finanzas de la empresa y evaluación de proyectos", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  "tp_conectividad_redes_3": {
    nombre: "3° Medio - Especialidad Conectividad y Redes (Plan Común de la Especialidad)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Conectividad y Redes (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Instalación y configuración de redes LAN", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Cableado estructurado y normas de telecomunicaciones", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Enrutamiento y conmutación básica", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Mantenimiento de hardware y sistemas de red", JEC: 4, No_JEC: 4 }
    ]
  },
  "tp_conectividad_redes_4": {
    nombre: "4° Medio - Especialidad Conectividad y Redes (Formación Diferenciada TP)",
    referenciaFuente: "Programa de Estudio 3° y 4° Medio - Especialidad Conectividad y Redes (Decreto Exento N° 0954/2015)",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 36, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 3, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Religión (Optativa)", JEC: 2, No_JEC: 2 },
      { nombre: "Módulo: Seguridad en redes y cortafuegos", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Servicios de red e infraestructura en la nube", JEC: 6, No_JEC: 6 },
      { nombre: "Módulo: Redes inalámbricas y telefonía IP", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo: Diagnóstico y monitoreo de tráfico de red", JEC: 4, No_JEC: 4 },
      { nombre: "Módulo común: Emprendimiento y empleabilidad", JEC: 2, No_JEC: 2 }
    ]
  },
  // ===========================================================================
  // EDUCACIÓN DE PERSONAS JÓVENES Y ADULTAS (EPJA - DECRETO SUPREMO N° 10/2022)
  // ===========================================================================
  "epja_basica_1_nivel": {
    nombre: "Educación Básica - Nivel 1 (1° a 4° Básico)",
    referenciaFuente: "Bases Curriculares EPJA (Decreto Supremo de Educación N° 10/2022)",
    regimen: {
      JEC: { total: 10, libre: 0 },
      No_JEC: { total: 10, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 5, No_JEC: 5 },
      { nombre: "Matemática", JEC: 5, No_JEC: 5 }
    ]
  },
  "epja_basica_2_nivel": {
    nombre: "Educación Básica - Nivel 2 (5° y 6° Básico)",
    referenciaFuente: "Bases Curriculares EPJA (Decreto Supremo de Educación N° 10/2022)",
    regimen: {
      JEC: { total: 24, libre: 0 },
      No_JEC: { total: 16, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 4, No_JEC: 4 },
      { nombre: "Matemática", JEC: 4, No_JEC: 4 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Idioma Extranjero: Inglés (Opcional)", JEC: 4, No_JEC: 0 },
      { nombre: "Formación en Oficios (Opcional)", JEC: 4, No_JEC: 0 }
    ]
  },
  "epja_basica_3_nivel": {
    nombre: "Educación Básica - Nivel 3 (7° y 8° Básico)",
    referenciaFuente: "Bases Curriculares EPJA (Decreto Supremo de Educación N° 10/2022)",
    regimen: {
      JEC: { total: 24, libre: 0 },
      No_JEC: { total: 16, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 4, No_JEC: 4 },
      { nombre: "Matemática", JEC: 4, No_JEC: 4 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Idioma Extranjero: Inglés (Opcional)", JEC: 4, No_JEC: 0 },
      { nombre: "Formación en Oficios (Opcional)", JEC: 4, No_JEC: 0 }
    ]
  },
  "epja_media_hc_1_nivel": {
    nombre: "Educación Media HC - Nivel 1 (1° y 2° Medio)",
    referenciaFuente: "Bases Curriculares EPJA (Decreto Supremo de Educación N° 10/2022)",
    regimen: {
      JEC: { total: 26, libre: 0 },
      No_JEC: { total: 26, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua y Literatura", JEC: 4, No_JEC: 4 },
      { nombre: "Matemática", JEC: 4, No_JEC: 4 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Inglés", JEC: 4, No_JEC: 4 },
      { nombre: "Formación Instrumental 1", JEC: 2, No_JEC: 2 },
      { nombre: "Formación Instrumental 2", JEC: 2, No_JEC: 2 },
      { nombre: "Formación Diferenciada HC", JEC: 2, No_JEC: 2 }
    ]
  },
  "epja_media_hc_2_nivel": {
    nombre: "Educación Media HC - Nivel 2 (3° y 4° Medio)",
    referenciaFuente: "Bases Curriculares EPJA (Decreto Supremo de Educación N° 10/2022)",
    regimen: {
      JEC: { total: 26, libre: 0 },
      No_JEC: { total: 26, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua y Literatura", JEC: 4, No_JEC: 4 },
      { nombre: "Matemática", JEC: 4, No_JEC: 4 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Educación Ciudadana", JEC: 4, No_JEC: 4 },
      { nombre: "Inglés", JEC: 4, No_JEC: 4 },
      { nombre: "Formación Instrumental 1", JEC: 2, No_JEC: 2 },
      { nombre: "Formación Instrumental 2", JEC: 2, No_JEC: 2 },
      { nombre: "Formación Diferenciada HC", JEC: 2, No_JEC: 2 }
    ]
  },
  "epja_media_tp_oficios_1_2": {
    nombre: "Educación Media TP en Oficios - Niveles 1 y 2 (1° a 4° Medio TP)",
    referenciaFuente: "Bases Curriculares EPJA (Decreto Supremo de Educación N° 10/2022)",
    regimen: {
      JEC: { total: 26, libre: 0 },
      No_JEC: { total: 26, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua y Literatura", JEC: 4, No_JEC: 4 },
      { nombre: "Matemática", JEC: 4, No_JEC: 4 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Historia, Geografía y Cs. Sociales / Educación Ciudadana", JEC: 4, No_JEC: 4 },
      { nombre: "Inglés", JEC: 4, No_JEC: 4 },
      { nombre: "Formación Instrumental (1 asignatura a elección)", JEC: 2, No_JEC: 2 },
      { nombre: "Formación Diferenciada en Oficios", JEC: 4, No_JEC: 4 }
    ]
  },
  "epja_media_tp_especialidad_1": {
    nombre: "Educación Media TP en Especialidades - Nivel 1 (1° y 2° Medio TP)",
    referenciaFuente: "Bases Curriculares EPJA (Decreto Supremo de Educación N° 10/2022)",
    regimen: {
      JEC: { total: 24, libre: 0 },
      No_JEC: { total: 24, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua y Literatura", JEC: 4, No_JEC: 4 },
      { nombre: "Matemática", JEC: 4, No_JEC: 4 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Inglés", JEC: 4, No_JEC: 4 },
      { nombre: "Formación Diferenciada TP (Módulos iniciales de la especialidad)", JEC: 4, No_JEC: 4 }
    ]
  },
  "epja_media_tp_especialidad_2_3": {
    nombre: "Educación Media TP en Especialidades - Niveles 2 y 3 (3° y 4° Medio TP)",
    referenciaFuente: "Bases Curriculares EPJA (Decreto Supremo de Educación N° 10/2022 y Decreto N° 452/2013)",
    regimen: {
      JEC: { total: 24, libre: 0 },
      No_JEC: { total: 24, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua y Literatura", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 2, No_JEC: 2 },
      { nombre: "Educación Ciudadana", JEC: 2, No_JEC: 2 },
      { nombre: "Ciencias Naturales", JEC: 2, No_JEC: 2 },
      { nombre: "Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Formación Instrumental (1 asignatura a elección)", JEC: 2, No_JEC: 2 },
      { nombre: "Formación Diferenciada con Especialización (Módulos Técnicos)", JEC: 12, No_JEC: 12 }
    ]
  },
  // ===========================================================================
  // EDUCACIÓN ESPECIAL (ORDINARIO N° 05/1470 Y DECRETO N° 83/2015)
  // ===========================================================================
  "especial_parvularia": {
    nombre: "Educación Parvularia Especial (Decreto 83 / Decretos Supremos)",
    referenciaFuente: "Ordinario N° 05/1470 (20/12/2018) y Decreto N° 83/2015",
    regimen: {
      JEC: { total: 28, libre: 4 },
      No_JEC: { total: 22, libre: 0 }
    },
    asignaturas: [
      { nombre: "Ámbito Desarrollo Personal y Social", JEC: 8, No_JEC: 6 },
      { nombre: "Ámbito Comunicación Integral / Lenguaje", JEC: 10, No_JEC: 8 },
      { nombre: "Ámbito Interacción y Comprensión del Entorno", JEC: 6, No_JEC: 6 },
      { nombre: "Plan Específico / Estimulación Temprana", JEC: 4, No_JEC: 2 }
    ]
  },
  "especial_basica_1_8": {
    nombre: "Educación Básica Especial (1° a 8° Básico con Adecuaciones Curriculares - Dec. 83)",
    referenciaFuente: "Ordinario N° 05/1470 (20/12/2018) y Decreto N° 83/2015",
    regimen: {
      JEC: { total: 38, libre: 6 },
      No_JEC: { total: 30, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación / Lengua y Literatura", JEC: 8, No_JEC: 7 },
      { nombre: "Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 3 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 3 },
      { nombre: "Artes Visuales y Música", JEC: 3, No_JEC: 2 },
      { nombre: "Educación Física y Salud", JEC: 3, No_JEC: 2 },
      { nombre: "Tecnología", JEC: 2, No_JEC: 1 },
      { nombre: "Orientación", JEC: 1, No_JEC: 1 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Plan Específico de Apoyo Especializado", JEC: 5, No_JEC: 3 }
    ]
  },
  "laboral_1": {
    nombre: "Nivel Laboral 1 (Decreto N° 87/1990 y Normativa Especial)",
    referenciaFuente: "Ordinario N° 05/1470 y Decreto N° 87/1990 (Educación Especial Laboral)",
    regimen: {
      JEC: { total: 38, libre: 4 },
      No_JEC: { total: 30, libre: 0 }
    },
    asignaturas: [
      { nombre: "Área Vocacional / Oficios Básicos", JEC: 18, No_JEC: 14 },
      { nombre: "Área de Desarrollo Personal y Social", JEC: 6, No_JEC: 5 },
      { nombre: "Área Cognitivo-Funcional (Lenguaje y Cálculo Funcional)", JEC: 6, No_JEC: 5 },
      { nombre: "Educación Física, Recreación y Salud", JEC: 4, No_JEC: 3 },
      { nombre: "Plan Específico / Autonomía en la Comunidad", JEC: 4, No_JEC: 3 }
    ]
  },
  "laboral_2": {
    nombre: "Nivel Laboral 2 (Decreto N° 87/1990 y Normativa Especial)",
    referenciaFuente: "Ordinario N° 05/1470 y Decreto N° 87/1990 (Educación Especial Laboral)",
    regimen: {
      JEC: { total: 38, libre: 4 },
      No_JEC: { total: 30, libre: 0 }
    },
    asignaturas: [
      { nombre: "Área Vocacional / Formación para el Trabajo", JEC: 20, No_JEC: 16 },
      { nombre: "Área de Habilidades Laborales y Sociales", JEC: 6, No_JEC: 5 },
      { nombre: "Área Funcional Instrumental Aplicada", JEC: 4, No_JEC: 3 },
      { nombre: "Educación Física y Deportes Adaptados", JEC: 4, No_JEC: 3 },
      { nombre: "Plan Específico de Inserción Laboral", JEC: 4, No_JEC: 3 }
    ]
  },
  "laboral_3": {
    nombre: "Nivel Laboral 3 (Decreto N° 87/1990 y Normativa Especial)",
    referenciaFuente: "Ordinario N° 05/1470 y Decreto N° 87/1990 (Educación Especial Laboral)",
    regimen: {
      JEC: { total: 38, libre: 4 },
      No_JEC: { total: 30, libre: 0 }
    },
    asignaturas: [
      { nombre: "Práctica y Especialización Laboral en Puesto de Trabajo", JEC: 22, No_JEC: 18 },
      { nombre: "Área de Autonomía, Legislación y Deberes Ciudadanos", JEC: 4, No_JEC: 3 },
      { nombre: "Habilidades para la Vida Independiente", JEC: 4, No_JEC: 3 },
      { nombre: "Educación Física y Bienestar Laboral", JEC: 4, No_JEC: 3 },
      { nombre: "Plan Específico / Acompañamiento Laboral", JEC: 4, No_JEC: 3 }
    ]
  }
};

export function getPlanesMineducConvertidos(): PlanEstudioNivel[] {
  const result: PlanEstudioNivel[] = [];

  const addSimplePlan = (key: keyof typeof DATA_PLANES_ESTUDIO_MINEDUC, customNivelName?: string, categoria?: PlanEstudioNivel['categoria']) => {
    const item = DATA_PLANES_ESTUDIO_MINEDUC[key] as any;
    if (!item || !item.regimen) return;
    const nivelName = customNivelName || item.nombre;
    const refFuente = item.referenciaFuente;

    if (item.regimen.JEC && item.regimen.JEC.total > 0) {
      result.push({
        nivel: nivelName,
        regimen: "JEC",
        horasObligatorias: item.regimen.JEC.total - (item.regimen.JEC.libre || 0),
        horasLibreDisposicion: item.regimen.JEC.libre || 0,
        totalHorasPlan: item.regimen.JEC.total,
        asignaturasBase: item.asignaturas.map((a: any) => ({ nombre: a.nombre, horasSugeridas: a.JEC })),
        referenciaFuente: refFuente,
        categoria
      });
    }

    if (item.regimen.No_JEC && item.regimen.No_JEC.total > 0) {
      result.push({
        nivel: nivelName,
        regimen: "No JEC",
        horasObligatorias: item.regimen.No_JEC.total - (item.regimen.No_JEC.libre || 0),
        horasLibreDisposicion: item.regimen.No_JEC.libre || 0,
        totalHorasPlan: item.regimen.No_JEC.total,
        asignaturasBase: item.asignaturas.map((a: any) => ({ nombre: a.nombre, horasSugeridas: a.No_JEC })),
        referenciaFuente: refFuente,
        categoria
      });
    }
  };

  // 0. Parvularia
  addSimplePlan("parvularia", "Educación Parvularia (NT1 y NT2)", "PARVULARIA");
  addSimplePlan("multigrado_parvularia", "Multigrado Parvularia (NT1-NT2)", "PARVULARIA");

  // 1. Básica Regular
  addSimplePlan("1_4_basico", "1° a 4° Básico", "BASICA");
  addSimplePlan("5_6_basico", "5° a 6° Básico", "BASICA");
  addSimplePlan("7_8_basico", "7° a 8° Básico", "BASICA");
  addSimplePlan("7_8_basico_indigena", "7° a 8° año de Educación Básica - Con Sector Lengua Indígena", "BASICA");
  addSimplePlan("multigrado_basica", "Educación Básica Multigrado / Combinada", "MULTIGRADO");

  // 2. Media 1° y 2°
  addSimplePlan("1_2_medio", "1° y 2° Medio", "MEDIA_HC");

  // 3. Media 3° y 4° Diferenciada Genérica
  const p34 = DATA_PLANES_ESTUDIO_MINEDUC["3_4_medio"];
  const general = p34.plan_comun_general;
  const electivo = p34.plan_comun_electivo;

  for (const [, mod] of Object.entries(p34.modalidades)) {
    const listBase = [
      ...general.map(g => ({ nombre: g.nombre, horasSugeridas: g.horas })),
      ...electivo.map(e => ({ nombre: e.nombre, horasSugeridas: e.horas })),
      { nombre: `Formación Diferenciada (${mod.nombre})`, horasSugeridas: mod.diferenciada }
    ];

    const cat: PlanEstudioNivel['categoria'] = mod.nombre.includes('Técnico') ? 'MEDIA_TP' : 'MEDIA_HC';

    if (mod.JEC.total > 0) {
      result.push({
        nivel: `3° y 4° Medio (${mod.nombre})`,
        regimen: "JEC",
        horasObligatorias: mod.JEC.total - mod.JEC.libre,
        horasLibreDisposicion: mod.JEC.libre,
        totalHorasPlan: mod.JEC.total,
        asignaturasBase: listBase,
        categoria: cat
      });
    }

    if (mod.No_JEC.total > 0) {
      result.push({
        nivel: `3° y 4° Medio (${mod.nombre})`,
        regimen: "No JEC",
        horasObligatorias: mod.No_JEC.total - mod.No_JEC.libre,
        horasLibreDisposicion: mod.No_JEC.libre,
        totalHorasPlan: mod.No_JEC.total,
        asignaturasBase: listBase,
        categoria: cat
      });
    }
  }

  // 4. Planes Técnico-Profesionales Específicos del Territorio (26 Especialidades)
  addSimplePlan("tp_formacion_general_3_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_electricidad_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_electricidad_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_programacion_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_programacion_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_gastronomia_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_gastronomia_cocina_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_gastronomia_pasteleria_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_parvulos_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_parvulos_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_administracion_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_administracion_rrhh_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_construccion_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_construccion_edificacion_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_construccion_terminaciones_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_construccion_viales_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_mecanica_industrial_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_mecanica_mantenimiento_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_mecanica_herramientas_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_mecanica_matriceria_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_agropecuaria_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_agropecuaria_agricultura_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_agropecuaria_pecuaria_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_agropecuaria_vitivinicola_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_elaboracion_alimentos_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_elaboracion_alimentos_4", undefined, "MEDIA_TP");

  addSimplePlan("tp_administracion_logistica_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_mecanica_automotriz_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_mecanica_automotriz_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_electronica_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_electronica_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_enfermeria_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_enfermeria_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_contabilidad_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_contabilidad_4", undefined, "MEDIA_TP");
  addSimplePlan("tp_conectividad_redes_3", undefined, "MEDIA_TP");
  addSimplePlan("tp_conectividad_redes_4", undefined, "MEDIA_TP");

  // 5. EPJA (Educación de Adultos - Decreto Supremo N° 10/2022)
  addSimplePlan("epja_basica_1_nivel", undefined, "EPJA");
  addSimplePlan("epja_basica_2_nivel", undefined, "EPJA");
  addSimplePlan("epja_basica_3_nivel", undefined, "EPJA");
  addSimplePlan("epja_media_hc_1_nivel", undefined, "EPJA");
  addSimplePlan("epja_media_hc_2_nivel", undefined, "EPJA");
  addSimplePlan("epja_media_tp_oficios_1_2", undefined, "EPJA");
  addSimplePlan("epja_media_tp_especialidad_1", undefined, "EPJA");
  addSimplePlan("epja_media_tp_especialidad_2_3", undefined, "EPJA");

  // 6. Educación Especial y Niveles Laborales (Ordinario N° 05/1470 & Decreto 83/2015 & Decreto 87/1990)
  addSimplePlan("especial_parvularia", undefined, "ESPECIAL");
  addSimplePlan("especial_basica_1_8", undefined, "ESPECIAL");
  addSimplePlan("laboral_1", undefined, "LABORAL");
  addSimplePlan("laboral_2", undefined, "LABORAL");
  addSimplePlan("laboral_3", undefined, "LABORAL");

  return result;
}

export const PLANES_MINEDUC: PlanEstudioNivel[] = getPlanesMineducConvertidos();

/**
 * Retorna todos los planes de estudio oficiales de especialidades Técnico-Profesionales.
 */
export function listarPlanesEspecialidadesTp(): PlanEstudioNivel[] {
  return PLANES_MINEDUC.filter(p => p.categoria === 'MEDIA_TP' && p.regimen === 'JEC');
}

/**
 * Obtiene el plan de estudios más adecuado según nombre de curso, régimen y especialidad opcional.
 */
export function obtenerPlanPorCurso(
  cursoNombre: string,
  regimen: 'JEC' | 'No JEC' = 'JEC',
  especialidadTp?: string
): PlanEstudioNivel | null {
  if (!cursoNombre && !especialidadTp) return null;
  const raw = (cursoNombre || '').trim();
  const espRaw = (especialidadTp || '').trim();

  // 0. Si se pasa especialidad directa que coincida exactamente con un nivel
  if (espRaw) {
    const matchEsp = PLANES_MINEDUC.find(p => p.nivel === espRaw && p.regimen === regimen) ||
                     PLANES_MINEDUC.find(p => p.nivel === espRaw);
    if (matchEsp) return matchEsp;
  }

  // Búsqueda por coincidencia exacta primero
  const exactMatch = PLANES_MINEDUC.find(p => p.nivel === raw && p.regimen === regimen);
  if (exactMatch) return exactMatch;
  const exactAnyReg = PLANES_MINEDUC.find(p => p.nivel === raw);
  if (exactAnyReg && exactAnyReg.regimen === regimen) return exactAnyReg;

  const fullSearch = `${raw} ${espRaw}`.trim();
  const c = fullSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let grupo = '';

  // 1. EPJA - EDUCACIÓN DE ADULTOS (Bases Curriculares Decreto 10/2022)
  if (c.includes('adulto') || c.includes('epja') || c.includes('nivel basico') || c.includes('nivel medio') || c.includes('oficio')) {
    if (c.includes('oficio')) {
      grupo = "Educación Media TP en Oficios - Niveles 1 y 2 (1° a 4° Medio TP)";
    } else if (c.includes('especialidad') || (c.includes('tp') && (c.includes('medio') || c.includes('nivel')))) {
      if (c.includes('2') || c.includes('3') || c.includes('segundo') || c.includes('tercer') || c.includes('4') || c.includes('cuarto')) {
        grupo = "Educación Media TP en Especialidades - Niveles 2 y 3 (3° y 4° Medio TP)";
      } else {
        grupo = "Educación Media TP en Especialidades - Nivel 1 (1° y 2° Medio TP)";
      }
    } else if (c.includes('medio') || c.includes('hc') || c.includes('human')) {
      if (c.includes('2') || c.includes('segundo') || c.includes('3') || c.includes('4') || c.includes('cuarto')) {
        grupo = "Educación Media HC - Nivel 2 (3° y 4° Medio)";
      } else {
        grupo = "Educación Media HC - Nivel 1 (1° y 2° Medio)";
      }
    } else if (c.includes('3') || c.includes('tercer') || c.includes('7') || c.includes('8')) {
      grupo = "Educación Básica - Nivel 3 (7° y 8° Básico)";
    } else if (c.includes('2') || c.includes('segundo') || c.includes('5') || c.includes('6')) {
      grupo = "Educación Básica - Nivel 2 (5° y 6° Básico)";
    } else {
      grupo = "Educación Básica - Nivel 1 (1° a 4° Básico)";
    }
  }
  // 2. ESPECIALIDADES TÉCNICO-PROFESIONALES ESPECÍFICAS
  else if (c.includes('electric') || c.includes('programac') || c.includes('gastronom') || c.includes('parvulo') || c.includes('atencion de parv') ||
           c.includes('administrac') || c.includes('construcc') || c.includes('mecanic') || c.includes('agropec') || 
           c.includes('elaboracion') || c.includes('alimento') || c.includes('vitivin') || c.includes('recursos humanos') ||
           c.includes('edificac') || c.includes('terminacion') || c.includes('obra vial') || c.includes('matricer') || 
           c.includes('maquina') || c.includes('cocina') || c.includes('pasteler') || c.includes('logistica') ||
           c.includes('automotriz') || c.includes('electronica') || c.includes('enfermer') || c.includes('salud') ||
           c.includes('contabil') || c.includes('conectivid') || c.includes('redes')) {
    const es4 = c.includes('4°') || c.includes('4o') || c.includes('4 ') || c.includes('cuarto') || c.includes('4to');

    if (c.includes('electric')) {
      grupo = es4 
        ? "4° Medio - Especialidad Electricidad (Formación Diferenciada TP)"
        : "3° Medio - Especialidad Electricidad (Formación Diferenciada TP)";
    } else if (c.includes('programac')) {
      grupo = es4 
        ? "4° Medio - Especialidad Programación (Formación Diferenciada TP)"
        : "3° Medio - Especialidad Programación (Formación Diferenciada TP)";
    } else if (c.includes('gastronom')) {
      if (es4) {
        if (c.includes('pastel') || c.includes('repost')) {
          grupo = "4° Medio - Especialidad Gastronomía, Mención Pastelería y Repostería";
        } else {
          grupo = "4° Medio - Especialidad Gastronomía, Mención Cocina";
        }
      } else {
        grupo = "3° Medio - Especialidad Gastronomía (Plan Común de la Especialidad)";
      }
    } else if (c.includes('parvulo') || c.includes('atencion de parv') || (c.includes('parvul') && (c.includes('medio') || c.includes('tp') || c.includes('especialidad')))) {
      grupo = es4 
        ? "4° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP)"
        : "3° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP)";
    } else if (c.includes('administrac')) {
      if (es4) {
        if (c.includes('logist')) {
          grupo = "4° Medio - Especialidad Administración, Mención Logística";
        } else {
          grupo = "4° Medio - Especialidad Administración, Mención Recursos Humanos";
        }
      } else {
        grupo = "3° Medio - Especialidad Administración (Plan Común de la Especialidad)";
      }
    } else if (c.includes('construcc') || c.includes('edificac') || c.includes('terminacion') || c.includes('vial')) {
      if (es4) {
        if (c.includes('terminac')) {
          grupo = "4° Medio - Especialidad Construcción, Mención Terminaciones de la Construcción";
        } else if (c.includes('vial') || c.includes('infraestructura')) {
          grupo = "4° Medio - Especialidad Construcción, Mención Obras Viales e Infraestructura";
        } else {
          grupo = "4° Medio - Especialidad Construcción, Mención Edificación";
        }
      } else {
        grupo = "3° Medio - Especialidad Construcción (Plan Común de la Especialidad)";
      }
    } else if (c.includes('automotriz') || c.includes('vehicul')) {
      grupo = es4
        ? "4° Medio - Especialidad Mecánica Automotriz (Formación Diferenciada TP)"
        : "3° Medio - Especialidad Mecánica Automotriz (Plan Común de la Especialidad)";
    } else if (c.includes('mecanic')) {
      if (es4) {
        if (c.includes('herramienta') || c.includes('mecaniz') || c.includes('torno')) {
          grupo = "4° Medio - Especialidad Mecánica Industrial, Mención Máquinas-Herramientas";
        } else if (c.includes('matricer') || c.includes('molde')) {
          grupo = "4° Medio - Especialidad Mecánica Industrial, Mención Matricería";
        } else {
          grupo = "4° Medio - Especialidad Mecánica Industrial, Mención Mantenimiento Electromecánico";
        }
      } else {
        grupo = "3° Medio - Especialidad Mecánica Industrial (Plan Común de la Especialidad)";
      }
    } else if (c.includes('electronica')) {
      grupo = es4
        ? "4° Medio - Especialidad Electrónica (Formación Diferenciada TP)"
        : "3° Medio - Especialidad Electrónica (Plan Común de la Especialidad)";
    } else if (c.includes('enfermer') || c.includes('salud')) {
      grupo = es4
        ? "4° Medio - Especialidad Atención de Enfermería (Formación Diferenciada TP)"
        : "3° Medio - Especialidad Atención de Enfermería (Plan Común de la Especialidad)";
    } else if (c.includes('contabil')) {
      grupo = es4
        ? "4° Medio - Especialidad Contabilidad (Formación Diferenciada TP)"
        : "3° Medio - Especialidad Contabilidad (Plan Común de la Especialidad)";
    } else if (c.includes('conectivid') || c.includes('redes')) {
      grupo = es4
        ? "4° Medio - Especialidad Conectividad y Redes (Formación Diferenciada TP)"
        : "3° Medio - Especialidad Conectividad y Redes (Plan Común de la Especialidad)";
    } else if (c.includes('agropec') || c.includes('agric') || c.includes('pecuar') || c.includes('vitivin')) {
      if (es4) {
        if (c.includes('pecuar') || c.includes('animal') || c.includes('leche')) {
          grupo = "4° Medio - Especialidad Agropecuaria, Mención Pecuaria";
        } else if (c.includes('vitivin') || c.includes('vino') || c.includes('vid')) {
          grupo = "4° Medio - Especialidad Agropecuaria, Mención Vitivinícola";
        } else {
          grupo = "4° Medio - Especialidad Agropecuaria, Mención Agricultura";
        }
      } else {
        grupo = "3° Medio - Especialidad Agropecuaria (Plan Común de la Especialidad)";
      }
    } else if (c.includes('elaboracion') || c.includes('alimento')) {
      grupo = es4 
        ? "4° Medio - Especialidad Elaboración Industrial de Alimentos (Formación Diferenciada TP)"
        : "3° Medio - Especialidad Elaboración Industrial de Alimentos (Formación Diferenciada TP)";
    }
  }
  // 3. NIVELES LABORALES DE EDUCACIÓN ESPECIAL (Decreto 87/1990 y Ord. 1470)
  else if (c.includes('laboral') || c.includes('taller laboral') || c.includes('oficio laboral')) {
    if (c.includes('3') || c.includes('3°') || c.includes('tercer')) {
      grupo = "Nivel Laboral 3 (Decreto N° 87/1990 y Normativa Especial)";
    } else if (c.includes('2') || c.includes('2°') || c.includes('segundo')) {
      grupo = "Nivel Laboral 2 (Decreto N° 87/1990 y Normativa Especial)";
    } else {
      grupo = "Nivel Laboral 1 (Decreto N° 87/1990 y Normativa Especial)";
    }
  }
  // 4. EDUCACIÓN ESPECIAL PARVULARIA Y BÁSICA (Decreto 83 / Ordinario 1470)
  else if (((/\bespecial\b/i.test(c) && !c.includes('especialidad')) || c.includes('dec. 83') || c.includes('dec 83') || c.includes('decreto 83') ||
           c.includes('discapacidad') || c.includes('retardo') || c.includes('sordo') || c.includes('ciego') ||
           c.includes('tel-') || c.includes('tel ') || c.includes('trastorno motor') || c.includes('autismo')) && !c.includes('medio') && !c.includes('tp')) {
    if (c.includes('parvul') || c.includes('nt1') || c.includes('nt2') || c.includes('kinder') || c.includes('temprana')) {
      grupo = "Educación Parvularia Especial (Decreto 83 / Decretos Supremos)";
    } else {
      grupo = "Educación Básica Especial (1° a 8° Básico con Adecuaciones Curriculares - Dec. 83)";
    }
  }
  // 5. CURSOS MULTIGRADO Y COMBINADOS
  else if (c.includes('multigrado') || c.includes('combinado') || c.includes('comb')) {
    if (c.includes('nt') || c.includes('kinder') || c.includes('parvular')) {
      grupo = "Multigrado Parvularia (NT1-NT2)";
    } else if (c.includes('medio')) {
      grupo = "1° y 2° Medio";
    } else {
      grupo = "Educación Básica Multigrado / Combinada";
    }
  }
  // 6. PARVULARIA REGULAR
  else if ((c.includes('prekinder') || c.includes('kinder') || c.includes('nt1') || c.includes('nt2') || c.includes('parvular')) && !c.includes('medio') && !c.includes('tp') && !c.includes('especialidad')) {
    grupo = 'Educación Parvularia (NT1 y NT2)';
  }
  // 7. BÁSICA Y MEDIA REGULAR
  else if (c.includes('1°') || c.includes('2°') || c.includes('3°') || c.includes('4°') ||
      c.includes('1o') || c.includes('2o') || c.includes('3o') || c.includes('4o') ||
      c.includes('1 ') || c.includes('2 ') || c.includes('3 ') || c.includes('4 ')) {
    if (c.includes('medio') || c.includes('secundaria')) {
      if (c.includes('1°') || c.includes('2°') || c.includes('1o') || c.includes('2o') || c.includes('1 ') || c.includes('2 ')) {
        grupo = '1° y 2° Medio';
      } else if (c.includes('tp') || c.includes('tecnico') || c.includes('profesional')) {
        grupo = '3° y 4° Medio (Técnico-Profesional)';
      } else if (c.includes('artistic')) {
        grupo = '3° y 4° Medio (Artístico)';
      } else {
        grupo = '3° y 4° Medio (Humanístico-Científico)';
      }
    } else {
      grupo = '1° a 4° Básico';
    }
  } else if (c.includes('5°') || c.includes('6°') || c.includes('5o') || c.includes('6o') || c.includes('5 ') || c.includes('6 ')) {
    grupo = '5° a 6° Básico';
  } else if (c.includes('7°') || c.includes('8°') || c.includes('7o') || c.includes('8o') || c.includes('7 ') || c.includes('8 ')) {
    grupo = '7° a 8° Básico';
  }

  if (!grupo) return null;

  // Buscar coincidencia exacta por nivel y régimen; si no existe, retornar el primer régimen disponible para ese nivel
  const match = PLANES_MINEDUC.find(p => p.nivel === grupo && p.regimen === regimen);
  if (match) return match;

  return PLANES_MINEDUC.find(p => p.nivel === grupo) || null;
}

