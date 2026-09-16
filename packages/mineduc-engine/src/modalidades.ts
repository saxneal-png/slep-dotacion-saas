// =============================================================================
// CATÁLOGO OFICIAL DE MODALIDADES DE ENSEÑANZA Y GRADOS MINEDUC/SIGE
// (Incluye Ordinario N° 05/1470 del 20.12.2018 y Decreto N° 83 de 2015)
// =============================================================================

export interface ModalidadEnsenanza {
  codigo: string;
  nombre: string;
  categoria: 'elegible_pie' | 'no_elegible_pie' | 'especial';
  descripcion: string;
}

export interface GradoEnsenanzaEspecial {
  codigo: string;
  glosa: string;
  ciclo: 'PARVULARIA' | 'BASICA' | 'LABORAL';
  edadCronologicaSugerida?: string;
  descripcion: string;
}

export const MODALIDADES_ENSENANZA_OFICIALES: ModalidadEnsenanza[] = [
  // 1. Educación Parvularia y Básica Regular
  { codigo: "10", nombre: "Educación Parvularia (NT1/NT2)", categoria: "elegible_pie", descripcion: "Educación Parvularia Regular Niños" },
  { codigo: "110", nombre: "Enseñanza Básica (1º a 8º)", categoria: "elegible_pie", descripcion: "Educación Básica Regular Niños y Jóvenes" },

  // 2. Educación Media Regular (HC y TP)
  { codigo: "310", nombre: "Enseñanza Media Humanístico-Científica", categoria: "elegible_pie", descripcion: "Educación Media H-C Regular Niños y Jóvenes" },
  { codigo: "410", nombre: "Enseñanza Media Técnico-Profesional Comercial", categoria: "elegible_pie", descripcion: "Educación Media T-P Comercial Niños y Jóvenes" },
  { codigo: "510", nombre: "Enseñanza Media Técnico-Profesional Industrial", categoria: "elegible_pie", descripcion: "Educación Media T-P Industrial Niños y Jóvenes" },
  { codigo: "610", nombre: "Enseñanza Media Técnico-Profesional Técnica", categoria: "elegible_pie", descripcion: "Educación Media T-P Técnica Niños y Jóvenes" },
  { codigo: "710", nombre: "Enseñanza Media Técnico-Profesional Agrícola", categoria: "elegible_pie", descripcion: "Educación Media T-P Agrícola Niños y Jóvenes" },
  { codigo: "810", nombre: "Enseñanza Media Técnico-Profesional Marítima", categoria: "elegible_pie", descripcion: "Educación Media T-P Marítima Niños y Jóvenes" },
  { codigo: "910", nombre: "Enseñanza Media Artística", categoria: "elegible_pie", descripcion: "Educación Media Artística Regular" },

  // 3. EPJA - Educación de Personas Jóvenes y Adultas (Decreto Supremo N° 10/2022 y anteriores)
  { codigo: "131", nombre: "Educación Básica Adultos Sin Oficios (Decreto 584)", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Básica Adultos Regular" },
  { codigo: "133", nombre: "Educación Básica Adultos Con Oficios", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Básica Adultos con Formación en Oficios" },
  { codigo: "330", nombre: "Educación Media Humanístico-Científica Adultos (Decreto 239)", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Media H-C Adultos" },
  { codigo: "430", nombre: "Educación Media Técnico-Profesional Comercial Adultos", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Media T-P Comercial Adultos" },
  { codigo: "530", nombre: "Educación Media Técnico-Profesional Industrial Adultos", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Media T-P Industrial Adultos" },
  { codigo: "630", nombre: "Educación Media Técnico-Profesional Técnica Adultos", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Media T-P Técnica Adultos" },
  { codigo: "730", nombre: "Educación Media Técnico-Profesional Agrícola Adultos", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Media T-P Agrícola Adultos" },

  // 4. Educación Especial (Ordinario N° 05/1470 del 20.12.2018 y Decreto N° 83 de 2015)
  { codigo: "211", nombre: "Educación Especial Discapacidad Auditiva", categoria: "especial", descripcion: "Escuelas Especiales y Cursos Especiales PIE - Discapacidad Auditiva (Decreto 86/1990)" },
  { codigo: "212", nombre: "Educación Especial Discapacidad Intelectual", categoria: "especial", descripcion: "Escuelas Especiales y Cursos Especiales PIE - Discapacidad Intelectual (Decreto 87/1990)" },
  { codigo: "213", nombre: "Educación Especial Discapacidad Visual", categoria: "especial", descripcion: "Escuelas Especiales y Cursos Especiales PIE - Discapacidad Visual (Decreto 89/1990)" },
  { codigo: "214", nombre: "Educación Especial Trastornos Específicos del Lenguaje (Decreto 1300)", categoria: "especial", descripcion: "Escuelas Especiales de Lenguaje (Decreto 1300/2002)" },
  { codigo: "215", nombre: "Educación Especial Trastornos Motores", categoria: "especial", descripcion: "Escuelas Especiales y Cursos Especiales PIE - Trastornos Motores (Decreto 570/1990)" },
  { codigo: "216", nombre: "Educación Especial Autismo", categoria: "especial", descripcion: "Escuelas Especiales y Cursos Especiales PIE - Espectro Autista (Decreto 815/1990)" },
  { codigo: "217", nombre: "Educación Especial Discapacidad Graves Alteraciones en la Capacidad de Relación y Comunicación", categoria: "especial", descripcion: "Escuelas Especiales - Graves Alteraciones (Decreto 815/1990)" },
  { codigo: "218", nombre: "Educación Especial Discapacidad Múltiple", categoria: "especial", descripcion: "Escuelas Especiales y Cursos Especiales PIE - Retos Múltiples / Multidéficit" },
  { codigo: "219", nombre: "Educación Especial Sordoceguera", categoria: "especial", descripcion: "Escuelas Especiales - Sordoceguera" }
];

export const GRADOS_ENSENANZA_ESPECIAL_OFICIALES: GradoEnsenanzaEspecial[] = [
  // Parvularia Especial
  { codigo: "21", glosa: "Atención Temprana", ciclo: "PARVULARIA", edadCronologicaSugerida: "0 a 2 años", descripcion: "Estimulación y atención temprana en educación especial" },
  { codigo: "22", glosa: "Nivel Medio Menor", ciclo: "PARVULARIA", edadCronologicaSugerida: "2 (+2) años", descripcion: "Educación Parvularia Especial - Nivel Medio Menor" },
  { codigo: "23", glosa: "Nivel Medio Mayor", ciclo: "PARVULARIA", edadCronologicaSugerida: "3 (+2) años", descripcion: "Educación Parvularia Especial - Nivel Medio Mayor" },
  { codigo: "24", glosa: "Nivel de Transición 1 (NT1 / Pre-Kínder)", ciclo: "PARVULARIA", edadCronologicaSugerida: "4 (+2) años", descripcion: "Pre-Kínder Especial con Adecuación Decreto 83" },
  { codigo: "25", glosa: "Nivel de Transición 2 (NT2 / Kínder)", ciclo: "PARVULARIA", edadCronologicaSugerida: "5 (+2) años", descripcion: "Kínder Especial con Adecuación Decreto 83" },

  // Básica Especial (Decreto 83/2015)
  { codigo: "1", glosa: "1° Básico Especial", ciclo: "BASICA", edadCronologicaSugerida: "6 (+2) años", descripcion: "1° Básico Especial (Decreto 83 / Validación Dec. 2272)" },
  { codigo: "2", glosa: "2° Básico Especial", ciclo: "BASICA", edadCronologicaSugerida: "7 (+2) años", descripcion: "2° Básico Especial (Decreto 83 / Validación Dec. 2272)" },
  { codigo: "3", glosa: "3° Básico Especial", ciclo: "BASICA", edadCronologicaSugerida: "8 (+2) años", descripcion: "3° Básico Especial (Decreto 83 / Validación Dec. 2272)" },
  { codigo: "4", glosa: "4° Básico Especial", ciclo: "BASICA", edadCronologicaSugerida: "9 (+2) años", descripcion: "4° Básico Especial (Decreto 83 / Validación Dec. 2272)" },
  { codigo: "5", glosa: "5° Básico Especial", ciclo: "BASICA", edadCronologicaSugerida: "10 (+2) años", descripcion: "5° Básico Especial (Decreto 83 / Validación Dec. 2272)" },
  { codigo: "6", glosa: "6° Básico Especial", ciclo: "BASICA", edadCronologicaSugerida: "11 (+2) años", descripcion: "6° Básico Especial (Decreto 83 / Validación Dec. 2272)" },
  { codigo: "7", glosa: "7° Básico Especial", ciclo: "BASICA", edadCronologicaSugerida: "12 (+2) años", descripcion: "7° Básico Especial (Decreto 83 / Validación Dec. 2272)" },
  { codigo: "8", glosa: "8° Básico Especial", ciclo: "BASICA", edadCronologicaSugerida: "13 (+2) años", descripcion: "8° Básico Especial (Decreto 83 / Validación Dec. 2272)" },

  // Nivel Laboral (Decreto 87/1990 y afines)
  { codigo: "31", glosa: "Laboral 1 (Nivel Laboral 1)", ciclo: "LABORAL", edadCronologicaSugerida: "16 a 26 años", descripcion: "Formación y Capacitación Laboral Básica (Decreto 87/1990)" },
  { codigo: "32", glosa: "Laboral 2 (Nivel Laboral 2)", ciclo: "LABORAL", edadCronologicaSugerida: "16 a 26 años", descripcion: "Formación Laboral Media y Talleres de Oficio" },
  { codigo: "33", glosa: "Laboral 3 (Nivel Laboral 3)", ciclo: "LABORAL", edadCronologicaSugerida: "16 a 26 años", descripcion: "Formación Laboral Avanzada y Práctica de Inserción Laboral" }
];

export function esModalidadElegiblePie(codigoOModalidad: string): boolean {
  const match = MODALIDADES_ENSENANZA_OFICIALES.find(
    m => m.codigo === codigoOModalidad || m.nombre.toLowerCase().includes(codigoOModalidad.toLowerCase())
  );
  return match ? match.categoria !== 'no_elegible_pie' : true;
}

export function esModalidadAdultos(textoONivel: string): boolean {
  if (!textoONivel) return false;
  const t = textoONivel.toLowerCase();
  return t.includes('epja') || t.includes('adulto') || t.includes('nivel básico') || t.includes('nivel basico') || t.includes('nivel medio') || /^[123]°?\s*nivel/i.test(t);
}

export function esModalidadEspecial(textoONivel: string): boolean {
  if (!textoONivel) return false;
  const t = textoONivel.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Descartar la palabra "especialidad" para no confundir con especialidades Técnico-Profesionales
  const tSinEspecialidad = t.replace(/especialidad(es)?/g, ' ');

  // Si contiene "medio" o "tp" y no menciona explícitamente "decreto 83" o "retardo" o "discapacidad", no es Educación Especial
  const esMediaOTp = (t.includes('medio') || t.includes('tp') || t.includes('tecnico') || t.includes('profesional')) &&
                     !t.includes('decreto 83') && !t.includes('dec. 83') && !t.includes('dec 83') && !t.includes('discapacidad');
  if (esMediaOTp) return false;

  return (
    /\bespecial\b/i.test(tSinEspecialidad) ||
    tSinEspecialidad.includes('discapacidad') ||
    tSinEspecialidad.includes('laboral') ||
    tSinEspecialidad.includes('decreto 83') ||
    tSinEspecialidad.includes('decreto 87') ||
    tSinEspecialidad.includes('decreto 89') ||
    tSinEspecialidad.includes('decreto 86') ||
    tSinEspecialidad.includes('decreto 815') ||
    tSinEspecialidad.includes('dec. 83') ||
    tSinEspecialidad.includes('dec 83') ||
    tSinEspecialidad.includes('tel-') ||
    tSinEspecialidad.includes('tel ') ||
    tSinEspecialidad.includes('trastorno') ||
    tSinEspecialidad.includes('autismo') ||
    tSinEspecialidad.includes('multideficit') ||
    tSinEspecialidad.includes('retardo') ||
    tSinEspecialidad.includes('sordo') ||
    tSinEspecialidad.includes('ciego')
  );
}

export function esModalidadLaboral(textoONivel: string): boolean {
  if (!textoONivel) return false;
  const t = textoONivel.toLowerCase();
  return t.includes('laboral') || t.includes('taller laboral') || /laboral\s*[123]/i.test(t);
}

export function esModalidadMultigradoOCombinado(textoONivel: string): boolean {
  if (!textoONivel) return false;
  const t = textoONivel.toLowerCase();
  return t.includes('multigrado') || t.includes('combinado') || /^[1-8]°?\s*[-/]\s*[1-8]°?/.test(t);
}

export function esModalidadTp(textoONivel: string): boolean {
  if (!textoONivel) return false;
  const t = textoONivel.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.includes('epja') || t.includes('adulto')) return false;
  return (
    t.includes('tp') ||
    t.includes('tecnico') ||
    t.includes('profesional') ||
    t.includes('especialidad') ||
    t.includes('electric') ||
    t.includes('programac') ||
    t.includes('gastronom') ||
    t.includes('parvulo') ||
    t.includes('atencion de parv') ||
    t.includes('administrac') ||
    t.includes('construcc') ||
    t.includes('mecanic') ||
    t.includes('agropec') ||
    t.includes('elaboracion') ||
    t.includes('alimento') ||
    t.includes('vitivin') ||
    t.includes('automotriz') ||
    t.includes('electronica') ||
    t.includes('enfermer') ||
    t.includes('salud') ||
    t.includes('contabil') ||
    t.includes('conectivid') ||
    t.includes('redes') ||
    t.includes('logistica') ||
    t.includes('edificac') ||
    t.includes('terminacion') ||
    t.includes('obra vial') ||
    t.includes('matricer') ||
    t.includes('maquina') ||
    t.includes('cocina') ||
    t.includes('pasteler')
  );
}

