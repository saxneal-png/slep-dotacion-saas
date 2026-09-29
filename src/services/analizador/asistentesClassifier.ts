import { geminiFetch } from '../geminiApiClient';
import { EstamentoAsistente } from '../../types';
import { inferirClasificacionAsistente } from '../../../packages/mineduc-engine/src/calculoAsistentes';

import { normalizarCargoAsistenteInteligente } from './intelligentCargoNormalizer';

export interface RawAsistenteInput {
  id: string;
  rbd: string;
  establishment: string;
  comuna?: string;
  file_name?: string;
  run: string;
  nombres: string;
  apellidos: string;
  cargo_original: string;
  horas_contrato: number;
  horas_subvencion_general_indefinido?: number;
  horas_subvencion_general_plazo_fijo?: number;
  horas_sep_indefinido?: number;
  horas_sep_plazo_fijo?: number;
  horas_pie_indefinido?: number;
  horas_pie_plazo_fijo?: number;
  observaciones_originales?: string;
}

export interface AsistenteAnalizadoRecord {
  id: string;
  rbd: string;
  establishment: string;
  comuna?: string;
  file_name: string;
  run: string;
  nombres: string;
  apellidos: string;
  cargo_original: string;
  cargo_estandar: string;
  estamento: EstamentoAsistente;
  horas_contrato: number;
  horas_subvencion_general_indefinido: number;
  horas_subvencion_general_plazo_fijo: number;
  horas_sep_indefinido: number;
  horas_sep_plazo_fijo: number;
  horas_pie_indefinido: number;
  horas_pie_plazo_fijo: number;
  es_dupla_psicosocial: boolean;
  es_equipo_pie: boolean;
  es_tecnico_parvulo: boolean;
  es_auxiliar_servicio: boolean;
  es_inspector_patio: boolean;
  observaciones_originales?: string;
  observaciones_ia?: string;
  justificacion_ia?: string;
  confianza_ia: 'ALTA' | 'MEDIA' | 'BAJA';
  fuente_clasificacion: 'IA_GEMINI' | 'REGLA_LOCAL' | 'MANUAL';
  estado_cuadratura: 'CUADRADA' | 'DESCUADRADA' | 'EXCESO_LEGAL';
  alertas: string[];
}

export const ASISTENTES_GEMINI_SYSTEM_PROMPT = `Eres un auditor y analista experto en la dotación de Asistentes de la Educación del sistema público chileno (Servicios Locales de Educación Pública - SLEP Valle Diguillín, Ley N° 21.109, Ley N° 19.464, Decreto 170 PIE, Ley 20.248 SEP y Código del Trabajo).

Tu objetivo es analizar nóminas, funciones y NOTAS U OBSERVACIONES de asistentes de la educación.
Muchas planillas contienen anotaciones informales, plurales, errores tipográficos o notas complejas en el campo de función o notas (ejemplos: "nochero", "nocheros", "Nochero.", "rondín", "apoyo PIE 18h + reemplazo 22h", "licencia médica, reemplazado por X", "asistente de aula en 1° básico y apoyo patio", "técnico en párvulos jornada completa SEP", "dupla psicosocial comunal", "maestro mantención y gasfitería", "chofer furgón rural").

Reglas de Homologación, Plurales y Resiliencia Tipográfica:
- PLURALES A SINGULAR: Convierte cualquier término en plural al cargo oficial singular (ej: "nocheros" -> "NOCHERO/A", "inspectores" -> "INSPECTOR/A DE PATIO", "auxiliares" -> "AUXILIAR DE SERVICIOS", "técnicos de párvulo" -> "TÉCNICO EN EDUCACIÓN PARVULARIA", "choferes" -> "CHOFER / CONDUCTOR", "maestros" -> "MAESTRO DE MANTENCIÓN").
- NOCHERO/A: En el territorio SLEP, todo "nochero", "nocheros", "Nochero/A", "rondín", "rondines", "sereno", "cuidador nocturno" debe normalizarse como "NOCHERO/A" (Estamento AUXILIAR, es_auxiliar_servicio = true).
- ERRORES DE TIPEO Y PUNTUACIÓN: Ignora tildes faltantes, mayúsculas/minúsculas y signos de puntuación (ej: "Nochero.", "nocherro", "parbulo").

Debes:
1. Normalizar el cargo a un título oficial estándar (ej: "NOCHERO/A", "ASISTENTE DE SALA", "PSICÓLOGO/A", "TÉCNICO EN EDUCACIÓN PARVULARIA", "TÉCNICO EN EDUCACIÓN DIFERENCIAL", "AUXILIAR DE SERVICIOS", "TRABAJADOR/A SOCIAL", "FONOAUDIÓLOGO/A", "TERAPEUTA OCUPACIONAL", "SECRETARIA ADMINISTRATIVA", "INSPECTOR/A DE PATIO", "MAESTRO DE MANTENCIÓN", "CHOFER / CONDUCTOR", "PORTERO/A / CONSERJE").
2. Clasificar en exactamente UNO de los 5 estamentos de la Ley 21.109:
   - "PROFESIONAL": Psicólogos, Trabajadores/Asistentes Sociales, Fonoaudiólogos, Terapeutas Ocupacionales, Kinesiólogos, Enfermeros Universitarios, Ingenieros TI.
   - "TECNICO": Técnicos en Párvulos, TENS, Técnicos en Educación Especial/Diferencial, Soporte Técnico TI, Técnicos en Bibliotecología.
   - "ADMINISTRATIVO": Secretarias de Dirección/UTP, Encargados de Adquisiciones/Bodega, Encargados SIGE, digitadores.
   - "AUXILIAR": Auxiliares de Aseo, Maestros de Mantención/Servicios Generales, Choferes de Transporte Escolar, Nocheros/Serenos/Cuidadores/Porteros.
   - "PARADOCENTE_INSPECTORIA": Inspectores de Patio/Pasillos, Asistentes de Sala/Aula (1°-2° Básico), Asistentes de Educación Diferencial, Monitores Extraescolares/PME.
3. Extraer y ordenar las NOTAS / OBSERVACIONES administrativas relevantes (ej: tipo de reemplazo, multi-fuente, condición de jornada, sede o nivel atendido) en un texto limpio y conciso.
4. Identificar flags booleanos:
   - esDuplaPsicosocial (Psicólogo o Trabajador/Asistente Social)
   - esEquipoPie (Fonoaudiólogo, Terapeuta, Kinesiólogo, Diferencial, Psicopedagogo)
   - esTecnicoParvulo (Técnico en educación parvularia / asistente de párvulo)
   - esAuxiliarServicio (Auxiliares de aseo, mantención, chofer, guardia, nochero/a, sereno)
   - esInspectorPatio (Inspectores de patio o paradocentes)
5. Estimar nivel de confianza ("ALTA", "MEDIA", "BAJA") y breve justificación técnica.

Datos de asistentes a procesar:
{asistentes_json}

Responde ÚNICAMENTE con un arreglo JSON de objetos con la siguiente estructura exacta:
[
  {
    "id": "id_del_asistente_recibido",
    "cargo_estandar": "TÍTULO NORMALIZADO",
    "estamento": "PROFESIONAL" | "TECNICO" | "ADMINISTRATIVO" | "AUXILIAR" | "PARADOCENTE_INSPECTORIA",
    "observaciones_ia": "Resumen limpio de condiciones o notas administrativas",
    "es_dupla_psicosocial": boolean,
    "es_equipo_pie": boolean,
    "es_tecnico_parvulo": boolean,
    "es_auxiliar_servicio": boolean,
    "es_inspector_patio": boolean,
    "confianza_ia": "ALTA" | "MEDIA" | "BAJA",
    "justificacion_ia": "Breve explicación de la inferencia"
  }
]
`;

/**
 * Llama a la API de Gemini para procesar un lote de asistentes.
 */
async function llamarGeminiAsistentesLote(
  lote: RawAsistenteInput[],
  apiKey: string,
  modelName: string = 'gemini-3.7-flash',
  customPrompt?: string
): Promise<Record<string, any>> {
  const promptTemplate = customPrompt || ASISTENTES_GEMINI_SYSTEM_PROMPT;
  const payloadData = lote.map((a) => ({
    id: a.id,
    run: a.run,
    nombre_completo: `${a.apellidos ? a.apellidos + ', ' : ''}${a.nombres}`.trim(),
    cargo_original: a.cargo_original,
    horas_contrato: a.horas_contrato,
    horas_financiamiento: {
      subv_gral_ind: a.horas_subvencion_general_indefinido || 0,
      subv_gral_pf: a.horas_subvencion_general_plazo_fijo || 0,
      sep_ind: a.horas_sep_indefinido || 0,
      sep_pf: a.horas_sep_plazo_fijo || 0,
      pie_ind: a.horas_pie_indefinido || 0,
      pie_pf: a.horas_pie_plazo_fijo || 0,
    },
    observaciones: a.observaciones_originales || '',
  }));

  const promptFinal = promptTemplate.replace('{asistentes_json}', JSON.stringify(payloadData, null, 2));

  const candidateModels = [
    modelName,
    'gemini-3.7-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ].filter((v, i, a) => a.indexOf(v) === i);

  for (const m of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const resp = await geminiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptFinal }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          const mapaRes: Record<string, any> = {};
          parsed.forEach((item) => {
            if (item && item.id) {
              mapaRes[item.id] = item;
            }
          });
          return mapaRes;
        }
      }
    } catch (e) {
      console.warn(`Error llamando a modelo ${m} para asistentes:`, e);
    }
  }

  return {};
}

/**
 * Clasificador y analizador inteligente completo para Asistentes de la Educación.
 * Integra Inteligencia Artificial Gemini con reglas locales de respaldo.
 */
export async function clasificarAsistentesConIa(
  asistentes: RawAsistenteInput[],
  apiKey?: string,
  modelName: string = 'gemini-3.7-flash',
  customPrompt?: string,
  onProgress?: (procesados: number, total: number) => void
): Promise<AsistenteAnalizadoRecord[]> {
  const resultadoFinal: AsistenteAnalizadoRecord[] = [];
  const BATCH_SIZE = 25;

  const total = asistentes.length;
  let procesadosCount = 0;

  for (let i = 0; i < asistentes.length; i += BATCH_SIZE) {
    const lote = asistentes.slice(i, i + BATCH_SIZE);
    let mapaIa: Record<string, any> = {};

    if (apiKey && apiKey.trim()) {
      mapaIa = await llamarGeminiAsistentesLote(lote, apiKey.trim(), modelName, customPrompt);
    }

    for (const ast of lote) {
      const iaData = mapaIa[ast.id];
      const normInteligente = normalizarCargoAsistenteInteligente(ast.cargo_original, ast.observaciones_originales);

      const hGralInd = ast.horas_subvencion_general_indefinido || 0;
      const hGralPf = ast.horas_subvencion_general_plazo_fijo || 0;
      const hSepInd = ast.horas_sep_indefinido || 0;
      const hSepPf = ast.horas_sep_plazo_fijo || 0;
      const hPieInd = ast.horas_pie_indefinido || 0;
      const hPiePf = ast.horas_pie_plazo_fijo || 0;

      const sumaFuentes = hGralInd + hGralPf + hSepInd + hSepPf + hPieInd + hPiePf;
      const horasContrato = ast.horas_contrato > 0 ? ast.horas_contrato : sumaFuentes;

      // Validación de alertas
      const alertas: string[] = [];
      let estadoCuadratura: 'CUADRADA' | 'DESCUADRADA' | 'EXCESO_LEGAL' = 'CUADRADA';

      if (horasContrato > 44) {
        estadoCuadratura = 'EXCESO_LEGAL';
        alertas.push(`Exceso legal: ${horasContrato} hrs semanales (Límite Art. 22: 44 hrs).`);
      } else if (sumaFuentes > 0 && Math.abs(sumaFuentes - horasContrato) > 0.05) {
        estadoCuadratura = 'DESCUADRADA';
        alertas.push(`Descuadre: Fuentes suman ${sumaFuentes} hrs vs contrato ${horasContrato} hrs.`);
      }

      let estamento: EstamentoAsistente = normInteligente.estamento;
      let cargoEstandar = normInteligente.cargoEstandar;
      let observacionesIa = ast.observaciones_originales || '';
      let justificacionIa = 'Normalización léxica y clasificación canónica SLEP';
      let confianzaIa: 'ALTA' | 'MEDIA' | 'BAJA' = 'ALTA';
      let fuenteClasificacion: 'IA_GEMINI' | 'REGLA_LOCAL' = 'REGLA_LOCAL';

      let esDupla = normInteligente.esDuplaPsicosocial;
      let esPie = normInteligente.esEquipoPie;
      let esParvulo = normInteligente.esTecnicoParvulo;
      let esAuxiliar = normInteligente.esAuxiliarServicio;
      let esInspector = normInteligente.esInspectorPatio;

      if (iaData) {
        fuenteClasificacion = 'IA_GEMINI';
        if (iaData.estamento && ['PROFESIONAL', 'TECNICO', 'ADMINISTRATIVO', 'AUXILIAR', 'PARADOCENTE_INSPECTORIA'].includes(iaData.estamento)) {
          estamento = iaData.estamento as EstamentoAsistente;
        }
        if (iaData.cargo_estandar) {
          cargoEstandar = String(iaData.cargo_estandar).trim();
        }
        if (iaData.observaciones_ia) {
          observacionesIa = String(iaData.observaciones_ia).trim();
        }
        if (iaData.justificacion_ia) {
          justificacionIa = String(iaData.justificacion_ia).trim();
        }
        if (iaData.confianza_ia && ['ALTA', 'MEDIA', 'BAJA'].includes(iaData.confianza_ia)) {
          confianzaIa = iaData.confianza_ia;
        }

        if (typeof iaData.es_dupla_psicosocial === 'boolean') esDupla = iaData.es_dupla_psicosocial;
        if (typeof iaData.es_equipo_pie === 'boolean') esPie = iaData.es_equipo_pie;
        if (typeof iaData.es_tecnico_parvulo === 'boolean') esParvulo = iaData.es_tecnico_parvulo;
        if (typeof iaData.es_auxiliar_servicio === 'boolean') esAuxiliar = iaData.es_auxiliar_servicio;
        if (typeof iaData.es_inspector_patio === 'boolean') esInspector = iaData.es_inspector_patio;
      }

      resultadoFinal.push({
        id: ast.id,
        rbd: ast.rbd,
        establishment: ast.establishment,
        comuna: ast.comuna,
        file_name: ast.file_name || 'Sin Archivo',
        run: ast.run,
        nombres: ast.nombres,
        apellidos: ast.apellidos,
        cargo_original: ast.cargo_original,
        cargo_estandar: cargoEstandar,
        estamento,
        horas_contrato: horasContrato,
        horas_subvencion_general_indefinido: hGralInd,
        horas_subvencion_general_plazo_fijo: hGralPf,
        horas_sep_indefinido: hSepInd,
        horas_sep_plazo_fijo: hSepPf,
        horas_pie_indefinido: hPieInd,
        horas_pie_plazo_fijo: hPiePf,
        es_dupla_psicosocial: esDupla,
        es_equipo_pie: esPie,
        es_tecnico_parvulo: esParvulo,
        es_auxiliar_servicio: esAuxiliar,
        es_inspector_patio: esInspector,
        observaciones_originales: ast.observaciones_originales,
        observaciones_ia: observacionesIa,
        justificacion_ia: justificacionIa,
        confianza_ia: confianzaIa,
        fuente_clasificacion: fuenteClasificacion,
        estado_cuadratura: estadoCuadratura,
        alertas,
      });

      procesadosCount++;
    }

    if (onProgress) {
      onProgress(procesadosCount, total);
    }
  }

  return resultadoFinal;
}
