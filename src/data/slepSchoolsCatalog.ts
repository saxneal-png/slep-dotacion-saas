import { ComunaValleDiguillin } from '../types';

export interface SlepSchoolCatalogItem {
  rbd: string;
  nombre: string;
  comuna: ComunaValleDiguillin;
  tipo: 'LICEO' | 'ESCUELA' | 'COLEGIO' | 'JARDIN' | 'SALA_CUNA';
  director?: string;
}

/**
 * Catálogo Maestro Oficial del Servicio Local de Educación Pública Valle Diguillín.
 * Comprende los 121 establecimientos y jardines infantiles de las 6 comunas territoriales.
 */
export const SLEP_VALLE_DIGUILLIN_SCHOOLS: SlepSchoolCatalogItem[] = [
  { rbd: '3638', nombre: 'LICEO BICENTENARIO MARTA BRUNET CÁRAVES', comuna: 'Chillán', tipo: 'LICEO' },
  { rbd: '3639', nombre: 'LICEO NARCISO TONDREAU', comuna: 'Chillán', tipo: 'LICEO' },
  { rbd: '3643', nombre: 'LICEO MARTIN RUIZ DE GAMBOA', comuna: 'Chillán', tipo: 'LICEO' },
  { rbd: '3644', nombre: 'ESCUELA NUEVA ESPERANZA', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3645', nombre: 'LICEO VIDA NUEVA', comuna: 'Chillán', tipo: 'LICEO' },
  { rbd: '3649', nombre: 'ESCUELA ESPECIAL LAS ACACIAS', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3656', nombre: 'LICEO POLIVALENTE JUAN PACHECO ALTAMIRANO', comuna: 'Chillán Viejo', tipo: 'LICEO', director: 'Verónica Knothe Badillo' },
  { rbd: '3657', nombre: 'LICEO LIBERTADOR BERNARDO O´HIGGINS RIQUELME', comuna: 'Chillán', tipo: 'LICEO' },
  { rbd: '3659', nombre: 'ESCUELA ARTURO MERINO BENITEZ', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3660', nombre: 'ESCUELA GABRIELA MISTRAL', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3662', nombre: 'LICEO REPÚBLICA DE ITALIA ARTURO BONOMETTI BROGI', comuna: 'Chillán', tipo: 'LICEO' },
  { rbd: '3663', nombre: 'ESCUELA REPUBLICA DE MEXICO', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3664', nombre: 'ESCUELA BASICA EL TEJAR', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3666', nombre: 'ESCUELA MARIA AMALIA SAAVEDRA MARTINEZ', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3667', nombre: 'ESCUELA BASICA LA CASTILLA', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3668', nombre: 'ESCUELA PALESTINA', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3669', nombre: 'ESCUELA BÁSICA ROSITA O´HIGGINS RIQUELME', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3670', nombre: 'ESCUELA BASICA REYES DE ESPAÑA', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3671', nombre: 'ESCUELA BASICA JUAN MADRID AZOLA', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3672', nombre: 'ESC. BASICA ARTURO MUTIZABAL SOTOMAYOR', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3673', nombre: 'ESCUELA BASICA QUILAMAPU', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3675', nombre: 'ESCUELA BASICA JOSE MARIA CARO RODRIGUEZ', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3677', nombre: 'ESCUELA BASICA LAS CANOAS', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3678', nombre: 'ESCUELA 27 DE ABRIL', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3681', nombre: 'ESCUELA BASICA CAPILLA COX', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3683', nombre: 'ESCUELA BASICA RUCAPEQUEN', comuna: 'Chillán Viejo', tipo: 'ESCUELA' },
  { rbd: '3685', nombre: 'ESCUELA BASICA QUINCHAMALI', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3686', nombre: 'ESCUELA BASICA NEBUCO', comuna: 'Chillán Viejo', tipo: 'ESCUELA' },
  { rbd: '3691', nombre: 'ESCUELA PAUL HARRIS', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3694', nombre: 'ESCUELA BASICA LLOLLINCO', comuna: 'Chillán Viejo', tipo: 'ESCUELA' },
  { rbd: '3697', nombre: 'ESCUELA BASICA CONFLUENCIA', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3698', nombre: 'ESCUELA BASICA QUILMO', comuna: 'Chillán Viejo', tipo: 'ESCUELA' },
  { rbd: '3703', nombre: 'ESCUELA ANTONIO MACHADO', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3704', nombre: 'ESCUELA BASICA COLLIGUAY', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3707', nombre: 'ESCUELA LOS JARDINES DE LAUTARO', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3709', nombre: 'ESCUELA BASICA LOS COLIGUES', comuna: 'Chillán Viejo', tipo: 'ESCUELA' },
  { rbd: '3849', nombre: 'ESCUELA CAMILO HENRIQUEZ', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '3886', nombre: 'LICEO BICENTENARIO MANUEL JESUS ORTIZ', comuna: 'San Ignacio', tipo: 'LICEO' },
  { rbd: '3887', nombre: 'LICEO BICENTENARIO DE EXCELENCIA PUEBLO SECO', comuna: 'San Ignacio', tipo: 'LICEO' },
  { rbd: '3888', nombre: 'COLEGIO BICENTENARIO DE EXCELENCIA POLITECNICO VICTOR JARA', comuna: 'San Ignacio', tipo: 'COLEGIO' },
  { rbd: '3890', nombre: 'ESCUELA MARÍA LUISA ESPINOZA RUIZ', comuna: 'San Ignacio', tipo: 'ESCUELA' },
  { rbd: '3891', nombre: 'ESCUELA LAS QUILAS', comuna: 'San Ignacio', tipo: 'ESCUELA' },
  { rbd: '3894', nombre: 'ESCUELA SANTA MARIA', comuna: 'San Ignacio', tipo: 'ESCUELA' },
  { rbd: '3897', nombre: 'ESCUELA CALLE ALEGRE', comuna: 'San Ignacio', tipo: 'ESCUELA' },
  { rbd: '3898', nombre: 'ESCUELA SANTA JUANA', comuna: 'San Ignacio', tipo: 'ESCUELA' },
  { rbd: '3899', nombre: 'ESCUELA COLTON VARIANTE', comuna: 'San Ignacio', tipo: 'ESCUELA' },
  { rbd: '3903', nombre: 'ESCUELA MAYULERMO', comuna: 'San Ignacio', tipo: 'ESCUELA' },
  { rbd: '3904', nombre: 'ESCUELA LOURDES', comuna: 'San Ignacio', tipo: 'ESCUELA' },
  { rbd: '3906', nombre: 'ESCUELA SELVA NEGRA', comuna: 'San Ignacio', tipo: 'ESCUELA' },
  { rbd: '3938', nombre: 'ESCUELA BÁSICA ADULTOS YUNGAY', comuna: 'Yungay', tipo: 'ESCUELA' },
  { rbd: '3940', nombre: 'LICEO DE YUNGAY', comuna: 'Yungay', tipo: 'LICEO' },
  { rbd: '3941', nombre: 'LICEO CAMPANARIO', comuna: 'Yungay', tipo: 'LICEO' },
  { rbd: '3947', nombre: 'ESCUELA PANGAL DEL LAJA', comuna: 'Yungay', tipo: 'ESCUELA' },
  { rbd: '3948', nombre: 'ESCUELA SAN MIGUEL DE ITATA', comuna: 'Yungay', tipo: 'ESCUELA' },
  { rbd: '3949', nombre: 'ESCUELA EL ROBLE', comuna: 'Yungay', tipo: 'ESCUELA' },
  { rbd: '3955', nombre: 'ESCUELA BASICA RANCHILLOS', comuna: 'Yungay', tipo: 'ESCUELA' },
  { rbd: '3957', nombre: 'ESCUELA LOS MAYOS', comuna: 'Yungay', tipo: 'ESCUELA' },
  { rbd: '3959', nombre: 'ESCUELA PALLAHUALA', comuna: 'Yungay', tipo: 'ESCUELA' },
  { rbd: '3961', nombre: 'LICEO POLIVALENTE TOMÁS ARNALDO HERRERA VEGA', comuna: 'Pemuco', tipo: 'LICEO' },
  { rbd: '3962', nombre: 'ESCUELA BASICA EL CIPRES', comuna: 'Pemuco', tipo: 'ESCUELA' },
  { rbd: '3964', nombre: 'ESCUELA JOSE FRANCISCO ZAPATA DOMINGUEZ', comuna: 'Pemuco', tipo: 'ESCUELA' },
  { rbd: '3966', nombre: 'ESCUELA VILLA SAN PEDRO', comuna: 'Pemuco', tipo: 'ESCUELA' },
  { rbd: '3967', nombre: 'ESCUELA BASICA GENERAL CRUZ', comuna: 'Pemuco', tipo: 'ESCUELA' },
  { rbd: '3968', nombre: 'ESCUELA BASICA MONTE EL LEON', comuna: 'Pemuco', tipo: 'ESCUELA' },
  { rbd: '3971', nombre: 'ESCUELA JOSÉ RENÉ SALGADO', comuna: 'Pemuco', tipo: 'ESCUELA' },
  { rbd: '3972', nombre: 'ESCUELA ARTURO MATTE ALESSANDRI', comuna: 'Pemuco', tipo: 'ESCUELA' },
  { rbd: '3974', nombre: 'ESCUELA BASICA VALLE HERMOSO', comuna: 'Pemuco', tipo: 'ESCUELA' },
  { rbd: '3975', nombre: 'ESCUELA BASICA SALTO DE DANICALQUI', comuna: 'Pemuco', tipo: 'ESCUELA' },
  { rbd: '3976', nombre: 'LICEO MANUEL BULNES', comuna: 'Bulnes', tipo: 'LICEO' },
  { rbd: '3977', nombre: 'LICEO BICENTENARIO SANTA CRUZ DE LARQUI', comuna: 'Bulnes', tipo: 'LICEO' },
  { rbd: '3978', nombre: 'ESCUELA CELIA URRUTIA PRIETO', comuna: 'Bulnes', tipo: 'ESCUELA' },
  { rbd: '3979', nombre: 'LICEO POLIVALENTE ADULTOS DE ITATA', comuna: 'Bulnes', tipo: 'LICEO' },
  { rbd: '3980', nombre: 'ESCUELA BASICA PUEBLO SECO SANTA CLARA', comuna: 'Bulnes', tipo: 'ESCUELA' },
  { rbd: '3981', nombre: 'ESCUELA EL PALPAL DE SANTA CLARA', comuna: 'Bulnes', tipo: 'ESCUELA' },
  { rbd: '3982', nombre: 'ESCUELA BATALLA DEL ROBLE', comuna: 'Bulnes', tipo: 'ESCUELA' },
  { rbd: '3983', nombre: 'ESCUELA EVARISTA OGALDE ORTEGA', comuna: 'Bulnes', tipo: 'ESCUELA' },
  { rbd: '3984', nombre: 'ESCUELA CANTA RANA', comuna: 'Bulnes', tipo: 'ESCUELA' },
  { rbd: '3991', nombre: 'ESCUELA COLTON QUILLAY', comuna: 'Bulnes', tipo: 'ESCUELA' },
  { rbd: '3992', nombre: 'ESCUELA MILAHUE', comuna: 'Bulnes', tipo: 'ESCUELA' },
  { rbd: '3995', nombre: 'ESCUELA LOS TILOS JOSÉ ANDRADES VÁSQUEZ', comuna: 'Bulnes', tipo: 'ESCUELA' },
  { rbd: '3997', nombre: 'ESCUELA EL CARACOL', comuna: 'Bulnes', tipo: 'ESCUELA' },
  { rbd: '11404', nombre: 'ESCUELA SAN LUIS', comuna: 'Yungay', tipo: 'ESCUELA' },
  { rbd: '11405', nombre: 'ESCUELA FERNANDO BAQUEDANO', comuna: 'Yungay', tipo: 'ESCUELA' },
  { rbd: '17698', nombre: 'ESCUELA RAMÓN VINAY SEPÚLVEDA', comuna: 'Chillán', tipo: 'ESCUELA' },
  { rbd: '17742', nombre: 'ESCUELA BASICA EDUARDO FREI MONTALBA', comuna: 'Bulnes', tipo: 'ESCUELA' },
  { rbd: '17892', nombre: 'LICEO POLIVALENTE MARTA COLVIN ANDRADE', comuna: 'Chillán', tipo: 'LICEO' },
  { rbd: '17916', nombre: 'ESCUELA DAFNE ELVIRA ZAPATA ROZAS', comuna: 'Pemuco', tipo: 'ESCUELA' },
  { rbd: '18016', nombre: 'ESCUELA BASICA PUEBLO SECO', comuna: 'San Ignacio', tipo: 'ESCUELA' },
  { rbd: '18099', nombre: 'LICEO TOMAS LAGO', comuna: 'Chillán Viejo', tipo: 'LICEO' },
  { rbd: '34591', nombre: 'JARDIN PEQUEÑO ARCOIRIS', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34593', nombre: 'JARDIN MANITOS MAGICAS', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34594', nombre: 'JARDIN PEQUEÑA LUNITA', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34595', nombre: 'JARDIN LUZ DE KERUBIEL', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34596', nombre: 'JARDIN GOTITAS DE AMOR', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34597', nombre: 'JARDIN LOS ARTESANITOS', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34598', nombre: 'JARDIN CAPULLITO', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34599', nombre: 'JARDIN ESTRELLITAS DE LUZ', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34600', nombre: 'JARDIN RAYITO DE SOL', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34602', nombre: 'JARDIN LOS GIRASOLES', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34603', nombre: 'JARDIN RINCONCITO ENCANTADO', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34604', nombre: 'JARDIN MIS PRIMEROS PASITOS', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34605', nombre: 'JARDIN CASITA DEL SOL', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34606', nombre: 'JARDIN ROBLIN', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34607', nombre: 'JARDIN MI PRIMERA ESTACION', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34609', nombre: 'JARDIN TEJITAS', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34610', nombre: 'JARDIN MARIA INES FULLER', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34612', nombre: 'JARDIN CASTILLO ESPERANZA', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34615', nombre: 'JARDIN BRISAS DEL VOLCÁN', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34616', nombre: 'JARDIN PASITOS AL FUTURO', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34617', nombre: 'JARDIN MIS PRIMEROS SUEÑOS', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34618', nombre: 'JARDIN SEMILLITAS', comuna: 'Chillán', tipo: 'JARDIN' },
  { rbd: '34621', nombre: 'JARDIN MIS PEQUEÑOS CORAZONES', comuna: 'Bulnes', tipo: 'JARDIN' },
  { rbd: '34622', nombre: 'JARDIN MIS ANGELITOS', comuna: 'Bulnes', tipo: 'JARDIN' },
  { rbd: '34623', nombre: 'JARDIN INFANCIA FELIZ', comuna: 'Bulnes', tipo: 'JARDIN' },
  { rbd: '34624', nombre: 'JARDIN MIS CARIÑOSITOS', comuna: 'Bulnes', tipo: 'JARDIN' },
  { rbd: '34626', nombre: 'JARDIN MIS PEQUEÑOS DUENDECITOS', comuna: 'Bulnes', tipo: 'JARDIN' },
  { rbd: '34627', nombre: 'JARDIN MIS PRIMEROS PASOS', comuna: 'Bulnes', tipo: 'JARDIN' },
  { rbd: '34640', nombre: 'JARDIN PADRE HURTADO', comuna: 'Chillán Viejo', tipo: 'JARDIN' },
  { rbd: '34643', nombre: 'JARDIN RIOS DEL SUR', comuna: 'Chillán Viejo', tipo: 'JARDIN' },
  { rbd: '34644', nombre: 'JARDIN RUCAPEQUEN', comuna: 'Chillán Viejo', tipo: 'JARDIN' },
  { rbd: '34645', nombre: 'JARDIN LAS MANITOS', comuna: 'Chillán Viejo', tipo: 'JARDIN' },
  { rbd: '34647', nombre: 'JARDIN EDUARDO FREI', comuna: 'Chillán Viejo', tipo: 'JARDIN' },
  { rbd: '34671', nombre: 'JARDIN INFANTIL PAPELUCHO', comuna: 'Pemuco', tipo: 'JARDIN' },
  { rbd: '34672', nombre: 'SALA CUNA PASITOS', comuna: 'Pemuco', tipo: 'SALA_CUNA' },
  { rbd: '34713', nombre: 'JARDIN INFANTIL RAYITO DE SOL PUEBLO SECO', comuna: 'San Ignacio', tipo: 'JARDIN' },
  { rbd: '34722', nombre: 'JARDIN INFANTIL CAMPANITAS', comuna: 'Yungay', tipo: 'JARDIN' },
  { rbd: '34724', nombre: 'JARDIN INFANTIL ANGELITOS DE AMOR', comuna: 'Yungay', tipo: 'JARDIN' },
  { rbd: '34725', nombre: 'JARDIN INFANTIL CUNCUNITA', comuna: 'Yungay', tipo: 'JARDIN' },
  { rbd: '34726', nombre: 'JARDIN INFANTIL MUNDO DE AMOR', comuna: 'Yungay', tipo: 'JARDIN' },
  { rbd: '36646', nombre: 'SALA CUNA Y JARDIN INFANTIL RIOS DEL SUR 2', comuna: 'Chillán Viejo', tipo: 'JARDIN' },
  { rbd: '34727', nombre: 'SALA CUNA PARQUE ESTADIO', comuna: 'Yungay', tipo: 'SALA_CUNA' },
];

// Mapas indexados para búsqueda rápida en O(1)
const catalogByRbd = new Map<string, SlepSchoolCatalogItem>();
const catalogByNameNormalized = new Map<string, SlepSchoolCatalogItem>();

function normalizeText(text: string): string {
  return (text || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Inicialización de índices
for (const item of SLEP_VALLE_DIGUILLIN_SCHOOLS) {
  catalogByRbd.set(item.rbd, item);
  catalogByNameNormalized.set(normalizeText(item.nombre), item);
}

/**
 * Busca un establecimiento oficial por su RBD exacto.
 */
export function findSchoolByRbd(rbd: string | number | undefined | null): SlepSchoolCatalogItem | undefined {
  if (!rbd) return undefined;
  const clean = String(rbd).trim().replace(/^[0]+/, ''); // Quitar ceros a la izquierda
  return catalogByRbd.get(clean) || catalogByRbd.get(String(rbd).trim());
}

/**
 * Busca un establecimiento por su nombre oficial o coincidencia fonética/aproximada.
 */
const STOP_WORDS = new Set([
  'ESCUELA', 'LICEO', 'COLEGIO', 'JARDIN', 'INFANTIL', 'SALA', 'CUNA', 'BASICA', 'BÁSICA',
  'POLIVALENTE', 'BICENTENARIO', 'ESPECIAL', 'DE', 'DEL', 'Y', 'LA', 'LAS', 'LOS', 'EL',
  'PLANILLA', 'DOTACION', 'DOTACIÓN', 'MATRIZ', 'CARGA', 'XLSX', 'XLS', 'CSV', 'PROYECCION',
  'PROYECCIÓN', 'HORAS', 'ANEXO', 'FINAL', 'OFICIAL', '2024', '2025', '2026', '2027'
]);

export function findSchoolByName(name: string | undefined | null): SlepSchoolCatalogItem | undefined {
  if (!name) return undefined;
  const norm = normalizeText(name);
  if (!norm || norm.length < 3) return undefined;

  // 1. Coincidencia exacta normalizada
  if (catalogByNameNormalized.has(norm)) {
    return catalogByNameNormalized.get(norm);
  }

  // 2. Coincidencia si el texto contiene el nombre oficial completo del establecimiento
  let bestDirectMatch: SlepSchoolCatalogItem | undefined;
  let bestDirectLen = 0;
  for (const item of SLEP_VALLE_DIGUILLIN_SCHOOLS) {
    const itemNorm = normalizeText(item.nombre);
    if (norm.includes(itemNorm) && itemNorm.length > bestDirectLen) {
      bestDirectMatch = item;
      bestDirectLen = itemNorm.length;
    }
  }
  if (bestDirectMatch) return bestDirectMatch;

  // 3. Coincidencia por tokens distintivos del establecimiento contenidos en el texto/archivo
  // Ej: Si el colegio es "ESCUELA REPUBLICA DE MEXICO", sus tokens son ["REPUBLICA", "MEXICO"].
  // Si ambos están en "DOTACION ESCUELA REPUBLICA DE MEXICO 2026", hace match perfecto.
  let bestCandidate: SlepSchoolCatalogItem | undefined;
  let maxScore = 0;

  for (const item of SLEP_VALLE_DIGUILLIN_SCHOOLS) {
    const itemNorm = normalizeText(item.nombre);
    const itemTokens = itemNorm.split(' ').filter((w) => !STOP_WORDS.has(w) && w.length >= 3);
    if (itemTokens.length === 0) continue;

    const matchedTokens = itemTokens.filter((t) => norm.includes(t));
    if (matchedTokens.length === itemTokens.length) {
      // Todos los tokens distintivos del colegio están presentes en la cadena buscada
      const score = matchedTokens.reduce((acc, t) => acc + t.length, 0);
      if (score > maxScore) {
        maxScore = score;
        bestCandidate = item;
      }
    }
  }

  if (bestCandidate) return bestCandidate;

  // 4. Búsqueda inversa: tokens relevantes de la entrada contenidos en el colegio
  const inputTokens = norm.split(' ').filter((w) => !STOP_WORDS.has(w) && w.length >= 4);
  if (inputTokens.length > 0) {
    for (const item of SLEP_VALLE_DIGUILLIN_SCHOOLS) {
      const itemNorm = normalizeText(item.nombre);
      const matchesAll = inputTokens.every((t) => itemNorm.includes(t));
      if (matchesAll) return item;
    }
  }

  return undefined;
}

/**
 * Identifica un colegio de SLEP Valle Diguillín a partir de cualquier indicio:
 * RBD, nombre institucional, texto de encabezado o nombre del archivo.
 */
export function identifySchool(
  textOrRbd?: string | number | null,
  filename?: string | null
): SlepSchoolCatalogItem | undefined {
  // 1. Intentar por RBD directo
  if (textOrRbd) {
    const byRbd = findSchoolByRbd(textOrRbd);
    if (byRbd) return byRbd;
  }

  // 2. Extraer RBD desde texto o nombre de archivo si contiene dígitos de 4 a 5 cifras
  const sources = [String(textOrRbd || ''), String(filename || '')];
  for (const src of sources) {
    if (!src) continue;
    const matches = src.match(/(?:^|[^0-9])(\d{4,5})(?=[^0-9]|$)/g);
    if (matches) {
      for (const m of matches) {
        const digits = m.replace(/[^0-9]/g, '');
        const found = findSchoolByRbd(digits);
        if (found) return found;
      }
    }
  }

  // 3. Intentar por coincidencia de nombre en textOrRbd
  if (textOrRbd) {
    const byName = findSchoolByName(String(textOrRbd));
    if (byName) return byName;
  }

  // 4. Intentar por coincidencia de nombre en el nombre de archivo
  if (filename) {
    const byFilename = findSchoolByName(filename);
    if (byFilename) return byFilename;
  }

  return undefined;
}

/**
 * Obtiene todos los establecimientos de una comuna específica.
 */
export function getSchoolsByComuna(comuna: ComunaValleDiguillin | string): SlepSchoolCatalogItem[] {
  const normComuna = normalizeText(comuna);
  return SLEP_VALLE_DIGUILLIN_SCHOOLS.filter((s) => normalizeText(s.comuna) === normComuna);
}

/**
 * Retorna todos los establecimientos del catálogo oficial.
 */
export function getAllSlepSchools(): SlepSchoolCatalogItem[] {
  return SLEP_VALLE_DIGUILLIN_SCHOOLS;
}

/**
 * Búsqueda de colegios por término (RBD, Nombre o Comuna).
 */
export function searchSlepSchools(query: string): SlepSchoolCatalogItem[] {
  if (!query || !query.trim()) return SLEP_VALLE_DIGUILLIN_SCHOOLS;
  const qNorm = normalizeText(query);
  return SLEP_VALLE_DIGUILLIN_SCHOOLS.filter((s) => {
    return s.rbd.includes(query.trim()) ||
      normalizeText(s.nombre).includes(qNorm) ||
      normalizeText(s.comuna).includes(qNorm);
  });
}
