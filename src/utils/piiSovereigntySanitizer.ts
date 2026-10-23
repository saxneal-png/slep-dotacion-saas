/**
 * piiSovereigntySanitizer.ts
 * Capa de Aislamiento, Anonimización Determinista y Soberanía de Datos para Integraciones LLM / Gemini.
 * Cumple con Ley N° 19.628 de Protección de Datos de Carácter Personal y Ley N° 20.584 de Derechos y Deberes en Salud.
 */

export interface FuncionarioIdentificable {
  run?: string;
  nombres?: string;
  apellidos?: string;
  teacher_name?: string;
}

export interface PiiVault {
  anonymizeText: (input: string) => string;
  deanonimizeText: (output: string) => string;
}

// Expresión regular exhaustiva para diagnósticos clínicos del Decreto 170 / 2009 y patologías laborales
export const CLINICAL_NEE_REGEX = /\b(tea|trastorno\s+del\s+espectro\s+autista|asperger|tdah|tda\b|deficit\s+atencional|déficit\s+atencional|discapacidad\s+intelectual|\bdi\b|funcionamiento\s+intelectual\s+limitrofe|\bfil\b|\btel\b|trastorno\s+espec[ií]fico\s+del\s+lenguaje|s[ií]ndrome\s+de\s+down|hipoacusia|sordera|sordoceguera|ceguera|baja\s+visi[oó]n|multid[eé]ficit|retos\s+m[uú]ltiples|trastorno\s+motor|par[aá]lisis\s+cerebral|licencia\s+psiqui[aá]trica|depresi[oó]n\s+severa|salud\s+mental)\b/gi;

// Expresión regular para RUN chileno con o sin puntos y dígito verificador
export const CHILEAN_RUN_REGEX = /\b\d{1,2}\.?\d{3}\.?\d{3}[-‐][0-9kK]\b/g;

/**
 * Crea una bóveda determinista reversible para ofuscar RUNs y Nombres de funcionarios
 * antes de enviarlos a APIs externas, y restaurarlos localmente al recibir la respuesta.
 */
export function createDeterministicPiiVault(
  funcionarios: FuncionarioIdentificable[]
): PiiVault {
  const forwardMap = new Map<string, string>();
  const reverseMap = new Map<string, string>();

  let counter = 1;

  for (const f of funcionarios) {
    const token = `FUNC_${String(counter).padStart(3, '0')}`;
    let added = false;

    // Nombre completo estándar
    const fullName = `${f.nombres || ''} ${f.apellidos || ''}`.trim();
    if (fullName.length >= 3) {
      const nameToken = `[${token}_NOMBRE]`;
      forwardMap.set(fullName, nameToken);
      reverseMap.set(nameToken, fullName);
      added = true;
    }

    // Nombre en formato Apellidos, Nombres
    const revName = `${f.apellidos || ''}, ${f.nombres || ''}`.trim();
    if (revName.length >= 3 && revName !== fullName) {
      const nameToken = `[${token}_NOMBRE]`;
      forwardMap.set(revName, nameToken);
      added = true;
    }

    // Nombre si viene en campo teacher_name
    if (f.teacher_name && f.teacher_name.trim().length >= 3 && !forwardMap.has(f.teacher_name.trim())) {
      const nameToken = `[${token}_NOMBRE]`;
      forwardMap.set(f.teacher_name.trim(), nameToken);
      reverseMap.set(nameToken, f.teacher_name.trim());
      added = true;
    }

    // RUN / RUT
    if (f.run && f.run.trim().length >= 7) {
      const runClean = f.run.trim();
      const runToken = `[${token}_RUN]`;
      forwardMap.set(runClean, runToken);
      reverseMap.set(runToken, runClean);

      // También registrar sin puntos si venía con puntos
      const unformatted = runClean.replace(/\./g, '');
      if (unformatted !== runClean) {
        forwardMap.set(unformatted, runToken);
      }
      added = true;
    }

    if (added) {
      counter++;
    }
  }

  // Ordenar reemplazos por longitud descendente para evitar colisiones de sub-cadenas
  const sortedEntries = Array.from(forwardMap.entries()).sort(
    (a, b) => b[0].length - a[0].length
  );

  const anonymizeText = (input: string): string => {
    if (!input || typeof input !== 'string') return '';
    let sanitized = input;

    // 1. Reemplazar nombres y RUNs conocidos por sus tokens deterministas
    for (const [realVal, token] of sortedEntries) {
      sanitized = sanitized.split(realVal).join(token);
    }

    // 2. Redactar cualquier RUN residual no indexado en la lista
    sanitized = sanitized.replace(CHILEAN_RUN_REGEX, '[RUN_RESERVADO_SLEP]');

    // 3. Redactar diagnósticos clínicos Decreto 170 y patologías de salud laboral
    sanitized = sanitized.replace(CLINICAL_NEE_REGEX, '[DIAGNOSTICO_NEE_DECRETO_170_RESERVADO]');

    return sanitized;
  };

  const deanonimizeText = (output: string): string => {
    if (!output || typeof output !== 'string') return '';
    let restored = output;

    for (const [token, realVal] of reverseMap.entries()) {
      restored = restored.split(token).join(realVal);
    }

    // Normalizar cualquier token genérico que el modelo haya citado
    restored = restored
      .replace(/\[RUN_RESERVADO_SLEP\]/g, 'RUN protegido')
      .replace(/\[DIAGNOSTICO_NEE_DECRETO_170_RESERVADO\]/g, 'Diagnóstico NEE reservado');

    return restored;
  };

  return { anonymizeText, deanonimizeText };
}
