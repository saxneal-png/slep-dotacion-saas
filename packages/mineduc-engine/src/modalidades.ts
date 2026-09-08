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
  { codigo: "131", nombre: "Educación Básica Adultos Sin Oficios (Decreto 584)", categoria: "no_elegible_pie", descripcion: "EPJA - Educación Básica Adultos" },
  { codigo: "211", nombre: "Educación Especial Discapacidad Intelectual (Decreto 87)", categoria: "elegible_pie", descripcion: "Educación Especial Diferencial" },
  { codigo: "212", nombre: "Educación Especial Trastornos Específicos del Lenguaje (Decreto 1300)", categoria: "elegible_pie", descripcion: "Escuelas Especiales de Lenguaje" }
];

export function esModalidadElegiblePie(codigoOModalidad: string): boolean {
  const match = MODALIDADES_ENSENANZA_OFICIALES.find(
    m => m.codigo === codigoOModalidad || m.nombre.toLowerCase().includes(codigoOModalidad.toLowerCase())
  );
  return match ? match.categoria === 'elegible_pie' : true;
}
