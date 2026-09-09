// =============================================================================
// CATÁLOGO OFICIAL DE MODALIDADES DE ENSEÑANZA MINEDUC/SIGE
// =============================================================================

export interface ModalidadEnsenanza {
  codigo: string;
  nombre: string;
  categoria: 'elegible_pie' | 'no_elegible_pie';
  descripcion: string;
}

export const MODALIDADES_ENSENANZA_OFICIALES: ModalidadEnsenanza[] = [
  { codigo: "10", nombre: "Educación Parvularia (NT1/NT2)", categoria: "elegible_pie", descripcion: "Educación Parvularia Regular Niños" },
  { codigo: "110", nombre: "Enseñanza Básica (1º a 8º)", categoria: "elegible_pie", descripcion: "Educación Básica Regular Niños y Jóvenes" },
  { codigo: "310", nombre: "Enseñanza Media Humanístico-Científica", categoria: "elegible_pie", descripcion: "Educación Media H-C Regular Niños y Jóvenes" },
  { codigo: "410", nombre: "Enseñanza Media Técnico-Profesional Comercial", categoria: "elegible_pie", descripcion: "Educación Media T-P Comercial Niños y Jóvenes" },
  { codigo: "510", nombre: "Enseñanza Media Técnico-Profesional Industrial", categoria: "elegible_pie", descripcion: "Educación Media T-P Industrial Niños y Jóvenes" },
  { codigo: "610", nombre: "Enseñanza Media Técnico-Profesional Técnica", categoria: "elegible_pie", descripcion: "Educación Media T-P Técnica Niños y Jóvenes" },
  { codigo: "710", nombre: "Enseñanza Media Técnico-Profesional Agrícola", categoria: "elegible_pie", descripcion: "Educación Media T-P Agrícola Niños y Jóvenes" },
  { codigo: "810", nombre: "Enseñanza Media Técnico-Profesional Marítima", categoria: "elegible_pie", descripcion: "Educación Media T-P Marítima Niños y Jóvenes" },
  { codigo: "131", nombre: "Educación Básica Adultos Sin Oficios (Decreto 584)", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Básica Adultos Regular" },
  { codigo: "133", nombre: "Educación Básica Adultos Con Oficios", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Básica Adultos con Formación en Oficios" },
  { codigo: "330", nombre: "Educación Media Humanístico-Científica Adultos (Decreto 239)", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Media H-C Adultos" },
  { codigo: "430", nombre: "Educación Media Técnico-Profesional Comercial Adultos", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Media T-P Comercial Adultos" },
  { codigo: "530", nombre: "Educación Media Técnico-Profesional Industrial Adultos", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Media T-P Industrial Adultos" },
  { codigo: "630", nombre: "Educación Media Técnico-Profesional Técnica Adultos", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Media T-P Técnica Adultos" },
  { codigo: "730", nombre: "Educación Media Técnico-Profesional Agrícola Adultos", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Media T-P Agrícola Adultos" },
  { codigo: "211", nombre: "Educación Especial Discapacidad Intelectual (Decreto 87)", categoria: "elegible_pie", descripcion: "Educación Especial Diferencial" },
  { codigo: "212", nombre: "Educación Especial Trastornos Específicos del Lenguaje (Decreto 1300)", categoria: "elegible_pie", descripcion: "Escuelas Especiales de Lenguaje" }
];

export function esModalidadElegiblePie(codigoOModalidad: string): boolean {
  const match = MODALIDADES_ENSENANZA_OFICIALES.find(
    m => m.codigo === codigoOModalidad || m.nombre.toLowerCase().includes(codigoOModalidad.toLowerCase())
  );
  return match ? match.categoria === 'elegible_pie' : true;
}

export function esModalidadAdultos(textoONivel: string): boolean {
  if (!textoONivel) return false;
  const t = textoONivel.toLowerCase();
  return t.includes('epja') || t.includes('adulto') || t.includes('nivel básico') || t.includes('nivel basico') || t.includes('nivel medio') || /^[123]°?\s*nivel/i.test(t);
}

export function esModalidadMultigradoOCombinado(textoONivel: string): boolean {
  if (!textoONivel) return false;
  const t = textoONivel.toLowerCase();
  return t.includes('multigrado') || t.includes('combinado') || /^[1-8]°?\s*[-/]\s*[1-8]°?/.test(t);
}
