/**
 * intelligentCargoNormalizer.ts
 * Motor de normalización léxica, lematización en español (plurales/singulares),
 * armonización de género, sanitización de puntuación y agrupamiento canónico inteligente
 * para Asistentes de la Educación y Docentes del SLEP Valle Diguillín.
 */

import { FuncionCanonicaLevantamiento, FUNCIONES_CANONICAS_LEVANTAMIENTO } from './asistentesLevantamientoRollup';
import { EstamentoAsistente } from '../../types';

export interface CanonicalRoleResult {
  cargoEstandar: string;
  estamento: EstamentoAsistente;
  funcionLevantamiento: FuncionCanonicaLevantamiento | 'OTROS ';
  esDuplaPsicosocial: boolean;
  esEquipoPie: boolean;
  esTecnicoParvulo: boolean;
  esAuxiliarServicio: boolean;
  esInspectorPatio: boolean;
  tokensNormalizados: string[];
}

/**
 * Sanitiza un texto eliminando puntuación innecesaria, diacríticos (tildes),
 * caracteres especiales y dobles espacios.
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes/acentos
    .toLowerCase()
    .replace(/[\.\,\;\:\_\-\/\(\)\[\]\{\}\"\'\`\<\>\*\+\=\#\$\%\&\?\¿\!\¡]/g, ' ') // Remueve puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lematizador de palabras individuales en español orientado a roles escolares.
 * Convierte plurales a singulares regulares e irregulares.
 */
export function lemmatizeSpanishWord(word: string): string {
  const w = word.trim().toLowerCase();
  if (w.length <= 3) return w;

  // Casos especiales directos de roles y funciones escolares
  const irregulars: Record<string, string> = {
    nocheros: 'nochero',
    nocheras: 'nochero',
    rondines: 'rondin',
    inspectores: 'inspector',
    inspectoras: 'inspector',
    choferes: 'chofer',
    conductores: 'conductor',
    conductoras: 'conductor',
    auxiliares: 'auxiliar',
    secretarias: 'secretaria',
    secretarios: 'secretaria',
    psicologos: 'psicologo',
    psicologas: 'psicologo',
    fonoaudiologos: 'fonoaudiologo',
    fonoaudiologas: 'fonoaudiologo',
    kinesiologos: 'kinesiologo',
    kinesiologas: 'kinesiologo',
    terapeutas: 'terapeuta',
    parvulos: 'parvulo',
    parvularias: 'parvulo',
    diferenciales: 'diferencial',
    profesores: 'profesor',
    profesoras: 'profesor',
    educadores: 'educador',
    educadoras: 'educador',
    directores: 'director',
    directoras: 'director',
    maestros: 'maestro',
    maestras: 'maestro',
    conserjes: 'conserje',
    porteros: 'portero',
    porteras: 'portero',
    manipuladoras: 'manipuladora',
    manipuladores: 'manipuladora',
    cocineras: 'cocinera',
    cocineros: 'cocinera',
    asistentes: 'asistente',
    tecnicos: 'tecnico',
    tecnicas: 'tecnico',
    monitores: 'monitor',
    monitoras: 'monitor',
    coordinadores: 'coordinador',
    coordinadoras: 'coordinador',
    orientadores: 'orientador',
    orientadoras: 'orientador',
    psicopedagogos: 'psicopedagogo',
    psicopedagogas: 'psicopedagogo',
    enfermeros: 'enfermero',
    enfermeras: 'enfermero',
  };

  if (irregulars[w]) return irregulars[w];

  // Reglas morfológicas del español:
  // 1. Terminación en -ces (ej: voces -> voz, jueces -> juez)
  if (w.endsWith('ces') && w.length > 4) {
    return w.slice(0, -3) + 'z';
  }

  // 2. Terminación en -es precedida por consonante (ej: inspectores -> inspector, choferes -> chofer, auxiliares -> auxiliar)
  if (w.endsWith('es') && w.length > 4) {
    const prevChar = w[w.length - 3];
    if (/[bcdfghjklmnpqrstvwxyz]/.test(prevChar)) {
      return w.slice(0, -2);
    }
  }

  // 3. Terminación en -s precedida de vocal (ej: nocheros -> nochero, tecnicos -> tecnico)
  if (w.endsWith('s') && !w.endsWith('is') && !w.endsWith('us') && !w.endsWith('es') && w.length > 3) {
    return w.slice(0, -1);
  }

  return w;
}

/**
 * Normaliza una frase completa de cargo token a token aplicando lematización y sanitización.
 */
export function normalizeCargoTokens(text: string): string[] {
  const sanitized = sanitizeText(text);
  if (!sanitized) return [];

  // Palabras vacías no esenciales en el match
  const stopWords = new Set(['de', 'la', 'el', 'los', 'las', 'en', 'y', 'del', 'para', 'con', 'por', 'un', 'una', 'al']);

  return sanitized
    .split(/\s+/)
    .map((token) => lemmatizeSpanishWord(token))
    .filter((token) => token.length > 0 && !stopWords.has(token));
}

/**
 * Distancia de Levenshtein para tolerancia a errores tipográficos.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sustitución
          matrix[i][j - 1] + 1,     // inserción
          matrix[i - 1][j] + 1      // eliminación
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Motor central de normalización y clasificación canónica para Asistentes de la Educación.
 * Reconoce "nochero", "nocheros", "Nochero/A", "rondín", "rondines", "sereno", etc.
 */
export function normalizarCargoAsistenteInteligente(rawCargo: string, observacionesRaw?: string): CanonicalRoleResult {
  const cleanInput = (rawCargo || '').trim();
  const tokens = normalizeCargoTokens(cleanInput + ' ' + (observacionesRaw || ''));
  const normalizedStr = tokens.join(' ');
  const rawUpper = cleanInput.toUpperCase();

  // 1. NOCHERO / SERENO / CUIDADOR NOCTURNO / RONDÍN (Territorio SLEP: Nochero/a)
  const isNochero =
    tokens.some((t) => ['nochero', 'nochera', 'rondin', 'sereno', 'velador'].includes(t)) ||
    /NOCHERO|NOCHERA|NOCHEROS|NOCHERAS|ROND[IÍ]N|RONDINES|SERENO|CUIDADOR.*NOCTURNO|GUARDIA.*NOCTURNO|VELADOR/i.test(rawUpper) ||
    ((tokens.includes('cuidador') || tokens.includes('guardia')) && (tokens.includes('noche') || tokens.includes('nocturno')));

  if (isNochero) {
    return {
      cargoEstandar: 'NOCHERO/A',
      estamento: 'AUXILIAR',
      funcionLevantamiento: 'Nocheros',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: true,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 2. TÉCNICO / ASISTENTE EN EDUCACIÓN DIFERENCIAL
  const isDiferencial =
    /DIFERENCIAL|ESPECIAL|NEE|DISCAPACIDAD/i.test(rawUpper) ||
    tokens.includes('diferencial') ||
    (tokens.includes('asistente') && tokens.includes('diferencial')) ||
    (tokens.includes('tecnico') && tokens.includes('diferencial'));

  if (isDiferencial) {
    return {
      cargoEstandar: 'TÉCNICO EN EDUCACIÓN DIFERENCIAL',
      estamento: 'TECNICO',
      funcionLevantamiento: 'Asistente técnico de Educación Diferencial',
      esDuplaPsicosocial: false,
      esEquipoPie: true,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 3. TÉCNICO / ASISTENTE EN EDUCACIÓN PARVULARIA
  const isParvulo =
    /P[AÁ]RVULO|PARVULARIA|KINDER|PREKINDER|PRE\s*KINDER|NT1|NT2|SALA\s*CUNA/i.test(rawUpper) ||
    tokens.includes('parvulo') ||
    tokens.includes('parvularia') ||
    tokens.includes('kinder');

  if (isParvulo) {
    return {
      cargoEstandar: 'TÉCNICO EN EDUCACIÓN PARVULARIA',
      estamento: 'TECNICO',
      funcionLevantamiento: 'Asistentes de aula',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: true,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 4. PSICÓLOGO / PSICÓLOGA
  const isPsicologo =
    /PSIC[OÓ]LOG/i.test(rawUpper) ||
    tokens.includes('psicologo') ||
    tokens.some((t) => levenshteinDistance(t, 'psicologo') <= 2);

  if (isPsicologo) {
    return {
      cargoEstandar: 'PSICÓLOGO/A',
      estamento: 'PROFESIONAL',
      funcionLevantamiento: 'Psicólogo',
      esDuplaPsicosocial: true,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 5. TRABAJADOR SOCIAL / ASISTENTE SOCIAL
  const isTrabajadorSocial =
    /TRABAJADOR(A)?\s*SOCIAL/i.test(rawUpper) ||
    (tokens.includes('trabajador') && tokens.includes('social'));

  if (isTrabajadorSocial) {
    return {
      cargoEstandar: 'TRABAJADOR/A SOCIAL',
      estamento: 'PROFESIONAL',
      funcionLevantamiento: 'Trabajador  Social',
      esDuplaPsicosocial: true,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  const isAsistenteSocial =
    /ASISTENTE\s*SOCIAL|ASISTENTA\s*SOCIAL/i.test(rawUpper) ||
    (tokens.includes('asistente') && tokens.includes('social'));

  if (isAsistenteSocial) {
    return {
      cargoEstandar: 'TRABAJADOR/A SOCIAL',
      estamento: 'PROFESIONAL',
      funcionLevantamiento: 'Asistente social',
      esDuplaPsicosocial: true,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 6. FONOAUDIÓLOGO / FONOAUDIÓLOGA
  const isFono =
    /FONOAUD/i.test(rawUpper) ||
    tokens.includes('fonoaudiologo') ||
    tokens.some((t) => levenshteinDistance(t, 'fonoaudiologo') <= 2);

  if (isFono) {
    return {
      cargoEstandar: 'FONOAUDIÓLOGO/A',
      estamento: 'PROFESIONAL',
      funcionLevantamiento: 'Fonoaudiólogo/a',
      esDuplaPsicosocial: false,
      esEquipoPie: true,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 7. TERAPEUTA OCUPACIONAL
  const isTerapeuta =
    /TERAPEUTA\s*OCUPACIONAL|TERAPIA\s*OCUPACIONAL/i.test(rawUpper) ||
    (tokens.includes('terapeuta') && tokens.includes('ocupacional'));

  if (isTerapeuta) {
    return {
      cargoEstandar: 'TERAPEUTA OCUPACIONAL',
      estamento: 'PROFESIONAL',
      funcionLevantamiento: 'Terapeuta ocupacional',
      esDuplaPsicosocial: false,
      esEquipoPie: true,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 8. KINESIÓLOGO / KINESIÓLOGA
  const isKine =
    /KINESI[OÓ]LOG/i.test(rawUpper) ||
    tokens.includes('kinesiologo') ||
    tokens.some((t) => levenshteinDistance(t, 'kinesiologo') <= 2);

  if (isKine) {
    return {
      cargoEstandar: 'KINESIÓLOGO/A',
      estamento: 'PROFESIONAL',
      funcionLevantamiento: 'Kinesiólogo/a',
      esDuplaPsicosocial: false,
      esEquipoPie: true,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 9. TÉCNICO EN ENFERMERÍA / TENS / ENFERMERO
  const isSalud =
    /TENS|ENFERMER|PARAM[EÉ]DICO|SALUD/i.test(rawUpper) ||
    tokens.includes('tens') ||
    tokens.includes('enfermero') ||
    tokens.includes('enfermeria') ||
    tokens.includes('paramedico');

  if (isSalud) {
    return {
      cargoEstandar: 'TÉCNICO EN ENFERMERÍA / TENS',
      estamento: 'TECNICO',
      funcionLevantamiento: 'Enfermero/TENS/Asistente con capacitación',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 10. MAESTRO DE MANTENCIÓN / SERVICIOS MENORES / GASFITER
  const isMaestro =
    /MAESTRO|MANTENCI[OÓ]N|GASFITER|G[AÁ]SFITER|EL[EÉ]CTRICO|CARPINTERO|SERVICIOS\s*MENORES/i.test(rawUpper) ||
    tokens.includes('maestro') ||
    tokens.includes('mantencion') ||
    tokens.includes('gasfiter') ||
    tokens.includes('electrico') ||
    tokens.includes('carpintero');

  if (isMaestro) {
    return {
      cargoEstandar: 'MAESTRO DE MANTENCIÓN',
      estamento: 'AUXILIAR',
      funcionLevantamiento: 'Maestros',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: true,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 11. CHOFER / CONDUCTOR
  const isChofer =
    /CHOFER|CONDUCTOR|TRANSPORTE\s*ESCOLAR|FURG[OÓ]N/i.test(rawUpper) ||
    tokens.includes('chofer') ||
    tokens.includes('conductor');

  if (isChofer) {
    return {
      cargoEstandar: 'CHOFER / CONDUCTOR',
      estamento: 'AUXILIAR',
      funcionLevantamiento: 'Conductores Auxliar',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: true,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 12. PORTERO / CONSERJE / AUXILIAR DE ASEO
  const isPortero =
    /PORTER|CONSERJE|ACCESO/i.test(rawUpper) ||
    tokens.includes('portero') ||
    tokens.includes('conserje');

  if (isPortero) {
    return {
      cargoEstandar: 'PORTERO/A / CONSERJE',
      estamento: 'AUXILIAR',
      funcionLevantamiento: 'Auxiliares',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: true,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  const isAuxiliarAseo =
    /AUXILIAR|ASEO|LIMPIEZA|ESTAFETA/i.test(rawUpper) ||
    tokens.includes('auxiliar') ||
    tokens.includes('aseo');

  if (isAuxiliarAseo) {
    return {
      cargoEstandar: 'AUXILIAR DE SERVICIOS',
      estamento: 'AUXILIAR',
      funcionLevantamiento: 'Auxiliares',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: true,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 13. INSPECTORÍA / PARADOCENCIA / PATIO
  const isInspector =
    /INSPECTOR|PARADOCENTE|PATIO|PASILLO|DISCIPLINA/i.test(rawUpper) ||
    tokens.includes('inspector') ||
    tokens.includes('paradocente') ||
    tokens.includes('patio');

  if (isInspector) {
    return {
      cargoEstandar: 'INSPECTOR/A DE PATIO',
      estamento: 'PARADOCENTE_INSPECTORIA',
      funcionLevantamiento: 'Inspectores',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: true,
      tokensNormalizados: tokens,
    };
  }

  // 14. ASISTENTE PEDAGÓGICO DE AULA (1° A 2° BÁSICO)
  const isAsistenteAula =
    /ASISTENTE\s*(DE\s*)?(AULA|SALA)|APOYO\s*DE\s*AULA|T[EÉ]CNICO\s*PEDAG[OÓ]GICO/i.test(rawUpper) ||
    (tokens.includes('asistente') && (tokens.includes('aula') || tokens.includes('sala'))) ||
    (tokens.includes('apoyo') && tokens.includes('aula'));

  if (isAsistenteAula) {
    return {
      cargoEstandar: 'ASISTENTE DE AULA',
      estamento: 'PARADOCENTE_INSPECTORIA',
      funcionLevantamiento: 'Asistentes de aula',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 15. SECRETARIA / ADMINISTRATIVO
  const isSecretaria =
    /SECRETARI|RECEPCI/i.test(rawUpper) ||
    tokens.includes('secretaria');

  if (isSecretaria) {
    return {
      cargoEstandar: 'SECRETARIA',
      estamento: 'ADMINISTRATIVO',
      funcionLevantamiento: 'Secretaria',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  const isAdministrativo =
    /ADMINISTRATIV|SIGE|OFICINA|CONTADOR|BODEGA|ADQUISICI|PAÑOL/i.test(rawUpper) ||
    tokens.includes('administrativo') ||
    tokens.includes('bodega') ||
    tokens.includes('adquisiciones');

  if (isAdministrativo) {
    return {
      cargoEstandar: 'ADMINISTRATIVO/A',
      estamento: 'ADMINISTRATIVO',
      funcionLevantamiento: 'Administrativos',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // 16. COMUNICACIONES
  const isComunicaciones =
    /COMUNICACI|PERIODIS|PRENSA|AUDIOVISUAL/i.test(rawUpper) ||
    tokens.includes('comunicacion') ||
    tokens.includes('periodista');

  if (isComunicaciones) {
    return {
      cargoEstandar: 'ENCARGADO/A DE COMUNICACIONES',
      estamento: 'PROFESIONAL',
      funcionLevantamiento: 'Comunicaciones',
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      tokensNormalizados: tokens,
    };
  }

  // Caso por defecto: Función no estándar / OTROS
  return {
    cargoEstandar: cleanInput ? cleanInput.toUpperCase() : 'ASISTENTE DE LA EDUCACIÓN',
    estamento: 'PARADOCENTE_INSPECTORIA',
    funcionLevantamiento: 'OTROS ',
    esDuplaPsicosocial: false,
    esEquipoPie: false,
    esTecnicoParvulo: false,
    esAuxiliarServicio: false,
    esInspectorPatio: false,
    tokensNormalizados: tokens,
  };
}
