import { AsistenteAnalizadoRecord } from './asistentesClassifier';
import { AsistenteEducacion } from '../../types';
import { geminiFetch } from '../geminiApiClient';

export const FUNCIONES_CANONICAS_LEVANTAMIENTO = [
  'Inspectores',
  'Auxiliares',
  'Psicólogo',
  'Trabajador  Social',
  'Asistente social',
  'Kinesiólogo/a',
  'Fonoaudiólogo/a',
  'Terapeuta ocupacional',
  'Asistente técnico de Educación Diferencial',
  'Asistentes de aula',
  'Administrativos',
  'Conductores Auxliar',
  'Maestros',
  'Enfermero/TENS/Asistente con capacitación',
  'Comunicaciones',
  'Secretaria',
  'Nocheros',
] as const;

export type FuncionCanonicaLevantamiento = typeof FUNCIONES_CANONICAS_LEVANTAMIENTO[number];

export interface LevantamientoRow {
  cargoFuncion: string;
  cantidadFuncionarios: number;
  horasSubRegular: number;
  horasPie: number;
  horasSep: number;
  totalHoras: number;
  observaciones: string;
  isOtro?: boolean;
}

export interface EstablecimientoLevantamiento {
  rbd: string;
  nombreEstablecimiento: string;
  comuna?: string;
  rows: LevantamientoRow[];
  totalGeneral: {
    cantidadFuncionarios: number;
    horasSubRegular: number;
    horasPie: number;
    horasSep: number;
    totalHoras: number;
  };
}

/**
 * Normaliza y clasifica un cargo a una de las 17 funciones canónicas oficiales
 * o determina que debe ser 'OTROS '
 */
export function clasificarFuncionLevantamientoHeuristica(
  cargoOriginal: string,
  estamento?: string,
  flags?: {
    esDuplaPsicosocial?: boolean;
    esEquipoPie?: boolean;
    esTecnicoParvulo?: boolean;
    esAuxiliarServicio?: boolean;
    esInspectorPatio?: boolean;
  }
): { funcion: FuncionCanonicaLevantamiento | 'OTROS '; cargoDetalleOtro?: string } {
  const raw = (cargoOriginal || '').toLowerCase().trim();
  const c = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. Inspectores / Paradocentes
  if (
    flags?.esInspectorPatio ||
    c.includes('inspector') ||
    c.includes('paradocente') ||
    c.includes('patio') ||
    c.includes('asistente de inspectoria') ||
    c.includes('asistente inspectoria')
  ) {
    return { funcion: 'Inspectores' };
  }

  // 2. Auxiliares / Servicios / Aseo
  if (
    flags?.esAuxiliarServicio ||
    (c.includes('auxiliar') && !c.includes('parvul') && !c.includes('diferencial') && !c.includes('aula') && !c.includes('chofer') && !c.includes('conductor')) ||
    c.includes('aseo') ||
    c.includes('portero') ||
    c.includes('porteria') ||
    c.includes('servicio menor') ||
    c.includes('servicios menores') ||
    c.includes('cuidador diurno') ||
    c.includes('estafeta')
  ) {
    return { funcion: 'Auxiliares' };
  }

  // 3. Psicólogo
  if (c.includes('psicolog') || c.includes('psicol')) {
    return { funcion: 'Psicólogo' };
  }

  // 4. Trabajador Social
  if (c.includes('trabajador social') || c.includes('trabajadora social')) {
    return { funcion: 'Trabajador  Social' };
  }

  // 5. Asistente Social
  if (c.includes('asistente social')) {
    return { funcion: 'Asistente social' };
  }

  // 6. Kinesiólogo/a
  if (c.includes('kinesiolog') || c.includes('kine')) {
    return { funcion: 'Kinesiólogo/a' };
  }

  // 7. Fonoaudiólogo/a
  if (c.includes('fonoaudiolog') || c.includes('fono')) {
    return { funcion: 'Fonoaudiólogo/a' };
  }

  // 8. Terapeuta ocupacional
  if (c.includes('terapeuta') || c.includes('terapia ocupacional') || c.includes('to pie')) {
    return { funcion: 'Terapeuta ocupacional' };
  }

  // 9. Asistente técnico de Educación Diferencial (y sinónimos como Asistente Educación Diferencial)
  if (
    c.includes('diferencial') ||
    c.includes('educacion especial') ||
    c.includes('educacion diferencial') ||
    c.includes('asistente diferencial') ||
    c.includes('tecnico diferencial') ||
    c.includes('asistente tecnico de educacion diferencial') ||
    c.includes('asistente de educacion diferencial') ||
    c.includes('asistente educacion diferencial') ||
    c.includes('asistente educacional diferencial') ||
    c.includes('apoyo pie') ||
    c.includes('tecnico pie') ||
    c.includes('asistente pie')
  ) {
    return { funcion: 'Asistente técnico de Educación Diferencial' };
  }

  // 10. Asistentes de aula / Técnicos en Párvulos / Asistente de Párvulos
  if (
    flags?.esTecnicoParvulo ||
    c.includes('asistente de aula') ||
    c.includes('asistente aula') ||
    c.includes('asistente de sala') ||
    c.includes('asistente sala') ||
    c.includes('tecnico parvul') ||
    c.includes('tecnico en parvulos') ||
    c.includes('tecnico parvularia') ||
    c.includes('asistente de parvulo') ||
    c.includes('asistente de parvulos') ||
    c.includes('asistente parvulo') ||
    c.includes('asistente parvulos') ||
    c.includes('educadora de parvulo') ||
    c.includes('auxiliar de parvulo') ||
    c.includes('atencion de parvulos')
  ) {
    return { funcion: 'Asistentes de aula' };
  }

  // 12. Conductores Auxiliar / Chofer
  if (
    c.includes('conductor') ||
    c.includes('chofer') ||
    c.includes('furgon') ||
    c.includes('transporte')
  ) {
    return { funcion: 'Conductores Auxliar' };
  }

  // 13. Maestros / Mantención
  if (
    c.includes('maestro') ||
    c.includes('mantencion') ||
    c.includes('carpinter') ||
    c.includes('gasfiter') ||
    c.includes('electric')
  ) {
    return { funcion: 'Maestros' };
  }

  // 14. Enfermero / TENS / Salud
  if (
    c.includes('tens') ||
    c.includes('enferm') ||
    c.includes('salud') ||
    c.includes('primeros auxilios') ||
    c.includes('paramedico')
  ) {
    return { funcion: 'Enfermero/TENS/Asistente con capacitación' };
  }

  // 15. Comunicaciones / Periodismo / Difusión
  if (
    c.includes('comunicaci') ||
    c.includes('periodis') ||
    c.includes('difusion') ||
    c.includes('redes') ||
    c.includes('audiovisual')
  ) {
    return { funcion: 'Comunicaciones' };
  }

  // 16. Secretaria
  if (
    c.includes('secretari') ||
    c.includes('recepcio')
  ) {
    return { funcion: 'Secretaria' };
  }

  // 17. Nocheros / Cuidadores nocturnos / Guardias
  if (
    c.includes('nochero') ||
    c.includes('nocturno') ||
    c.includes('guardia') ||
    c.includes('sereno') ||
    c.includes('rondin')
  ) {
    return { funcion: 'Nocheros' };
  }

  // 11. Administrativos
  if (
    estamento === 'ADMINISTRATIVO' ||
    c.includes('admin') ||
    c.includes('digitad') ||
    c.includes('sige') ||
    c.includes('computacion') ||
    c.includes('informat') ||
    c.includes('contab')
  ) {
    return { funcion: 'Administrativos' };
  }

  // OTROS (CRA, Nutricionista, Monitor, Encargados, etc.)
  return {
    funcion: 'OTROS ',
    cargoDetalleOtro: cargoOriginal ? cargoOriginal.trim() : 'Función no especificada'
  };
}

/**
 * Prompt del Sistema para el Agente IA de Levantamiento de Coeficientes de Asistentes
 */
export const LEVANTAMIENTO_IA_SYSTEM_PROMPT = `Eres el Agente Especialista en Dotación y Coeficientes de Asistentes de la Educación del Sistema Educacional Chileno (Ley N° 21.109 / SLEP).
Tu misión es interpretar la nómina de asistentes de la educación y clasificar cada funcionario exactamente en las 17 categorías oficiales de la "Planilla de Levantamiento de Coeficiente de Asistentes de la Educación" o categorizarlo como "OTROS " cuando corresponda.

CATEGORÍAS OFICIALES (17 ESTÁNDAR):
1. "Inspectores" (Inspectores de patio, paradocentes, apoyo a inspectoría, asistentes de convivencia/patio)
2. "Auxiliares" (Aseo, servicios menores, portería, mantención básica, estafeta)
3. "Psicólogo" (Psicólogos clínicos/educacionales, duplas psicosociales)
4. "Trabajador  Social" (Trabajadores Sociales / Asistentes Sociales en Dupla SEP)
5. "Asistente social" (Asistente Social bienestar)
6. "Kinesiólogo/a" (Kinesiólogos PIE / rehabilitación)
7. "Fonoaudiólogo/a" (Fonoaudiólogos PIE)
8. "Terapeuta ocupacional" (Terapeutas Ocupacionales PIE)
9. "Asistente técnico de Educación Diferencial" (Asistente de Educación Diferencial, Técnicos en Diferencial, Técnicos en Educación Especial, Apoyo PIE NEE)
10. "Asistentes de aula" (Asistentes de aula Básica/Media, Técnicos en Párvulos NT1/NT2/Kínder, Asistentes de Párvulo, Asistentes de Sala)
11. "Administrativos" (Encargados SIGE/SAE, digitadores, analistas administrativos, soporte computación)
12. "Conductores Auxliar" (Choferes de transporte escolar, conductores auxiliares)
13. "Maestros" (Maestros de mantención, carpinteros, gásfiter, electricistas, servicios generales)
14. "Enfermero/TENS/Asistente con capacitación" (TENS, técnicos en enfermería, primeros auxilios, salud escolar)
15. "Comunicaciones" (Periodistas, encargados de difusión, diseñadores, redes)
16. "Secretaria" (Secretarias de dirección, secretaría académica/UTP, recepcionistas)
17. "Nocheros" (Nocheros, cuidadores nocturnos, guardias nocturnos, serenos)

HOMOLOGACIÓN DE NOMENCLATURAS SIMILARES O VARIANTES:
- Cualquier variación como "ASISTENTE EDUCACION DIFERENCIAL", "ASISTENTE DIFERENCIAL" o "TECNICO EN EDUCACION ESPECIAL" DEBE clasificarse como "Asistente técnico de Educación Diferencial".
- Cualquier variación como "TECNICO EN PARVULOS", "ASISTENTE DE PARVULOS", "TECNICO PARVULARIA" o "ASISTENTE DE SALA" DEBE clasificarse como "Asistentes de aula".
- "PARADOCENTE", "ASISTENTE DE PATIO" o "ASISTENTE DE CONVIVENCIA" DEBE clasificarse como "Inspectores".
- "ASISTENTE DE SALUD" o "PRIMEROS AUXILIOS" DEBE clasificarse como "Enfermero/TENS/Asistente con capacitación".

REGLAS PARA "OTROS ":
- Si el cargo NO es ninguno de los 17 anteriores (ej. "Nutricionista", "Encargado(a) CRA / Biblioteca", "Monitor de Taller / Robótica", "Orientador Familiar", "Encargado de Laboratorio"), asígnalo como "OTROS ".
- En "cargo_detalle_otro", especifica la función clara y limpia (ej. "Nutricionista", "Encargado CRA Biblioteca").
- En "observaciones", resume notas relevantes como reemplazos, licencias, convenios o distribución de jornada.

REGLAS PARA HORAS:
- "sub_regular": Horas de Subvención General / Regular (incluye financiamiento base, indefinido o plazo fijo regular).
- "pie": Horas del Programa de Integración Escolar.
- "sep": Horas de Subvención Escolar Preferencial.

Debes responder ÚNICAMENTE con un arreglo JSON válido con la siguiente estructura:
[
  {
    "id": string,
    "rut": string,
    "nombre": string,
    "funcion_oficial": "Inspectores" | "Auxiliares" | "Psicólogo" | "Trabajador  Social" | "Asistente social" | "Kinesiólogo/a" | "Fonoaudiólogo/a" | "Terapeuta ocupacional" | "Asistente técnico de Educación Diferencial" | "Asistentes de aula" | "Administrativos" | "Conductores Auxliar" | "Maestros" | "Enfermero/TENS/Asistente con capacitación" | "Comunicaciones" | "Secretaria" | "Nocheros" | "OTROS ",
    "cargo_detalle_otro": string,
    "horas_sub_regular": number,
    "horas_pie": number,
    "horas_sep": number,
    "horas_totales": number,
    "observaciones": string
  }
]`;

interface HelperParsedAsistente {
  id: string;
  rut: string;
  nombre: string;
  cargo_original: string;
  estamento?: string;
  horas_sub_regular: number;
  horas_pie: number;
  horas_sep: number;
  horas_totales: number;
  observaciones_originales: string;
  flags: {
    esDuplaPsicosocial?: boolean;
    esEquipoPie?: boolean;
    esTecnicoParvulo?: boolean;
    esAuxiliarServicio?: boolean;
    esInspectorPatio?: boolean;
  };
}

function normalizarItemAsistente(a: AsistenteAnalizadoRecord | AsistenteEducacion, idx: number): HelperParsedAsistente {
  const isAnalizado = 'cargo_original' in a;
  const id = a.id || `asist-${idx}`;
  const rut = a.run || `RUT-${idx + 1}`;
  const nombre = `${a.nombres || ''} ${a.apellidos || ''}`.trim();
  const cargoOriginal = isAnalizado ? (a as AsistenteAnalizadoRecord).cargo_original : (a as AsistenteEducacion).cargoFuncion;
  const estamento = a.estamento;

  let subIndef = 0;
  let subPf = 0;
  let sepIndef = 0;
  let sepPf = 0;
  let pieIndef = 0;
  let piePf = 0;
  let total = 0;
  let obs = '';

  let flags: HelperParsedAsistente['flags'] = {};

  if (isAnalizado) {
    const r = a as AsistenteAnalizadoRecord;
    subIndef = r.horas_subvencion_general_indefinido || 0;
    subPf = r.horas_subvencion_general_plazo_fijo || 0;
    sepIndef = r.horas_sep_indefinido || 0;
    sepPf = r.horas_sep_plazo_fijo || 0;
    pieIndef = r.horas_pie_indefinido || 0;
    piePf = r.horas_pie_plazo_fijo || 0;
    total = r.horas_contrato || 0;
    obs = r.observaciones_ia || r.observaciones_originales || '';
    flags = {
      esDuplaPsicosocial: r.es_dupla_psicosocial,
      esEquipoPie: r.es_equipo_pie,
      esTecnicoParvulo: r.es_tecnico_parvulo,
      esAuxiliarServicio: r.es_auxiliar_servicio,
      esInspectorPatio: r.es_inspector_patio,
    };
  } else {
    const e = a as AsistenteEducacion;
    subIndef = e.horasSubvencionGeneralIndefinido || 0;
    subPf = e.horasSubvencionGeneralPlazoFijo || 0;
    sepIndef = e.horasSepIndefinido || 0;
    sepPf = e.horasSepPlazoFijo || 0;
    pieIndef = e.horasPieIndefinido || 0;
    piePf = e.horasPiePlazoFijo || 0;
    total = e.horasContrato || 0;
    obs = e.observaciones || '';
    flags = {
      esDuplaPsicosocial: e.esDuplaPsicosocial,
      esEquipoPie: e.esEquipoPie,
      esTecnicoParvulo: e.esTecnicoParvulo,
      esAuxiliarServicio: e.esAuxiliarServicio,
      esInspectorPatio: e.esInspectorPatio,
    };
  }

  const subGral = subIndef + subPf;
  const pie = pieIndef + piePf;
  const sep = sepIndef + sepPf;

  let subRegularCalculada = subGral;
  if (subRegularCalculada === 0 && pie === 0 && sep === 0) {
    subRegularCalculada = total > 0 ? total : 0;
  } else if (subRegularCalculada === 0 && total > 0) {
    subRegularCalculada = Math.max(0, total - pie - sep);
  }

  return {
    id,
    rut,
    nombre,
    cargo_original: cargoOriginal,
    estamento,
    horas_sub_regular: subRegularCalculada,
    horas_pie: pie,
    horas_sep: sep,
    horas_totales: total || (subRegularCalculada + pie + sep),
    observaciones_originales: obs,
    flags
  };
}

/**
 * Consulta a Gemini para interpretar y clasificar la nómina de asistentes para la planilla oficial
 */
export async function interpretarAsistentesConIaParaLevantamiento(
  asistentes: (AsistenteAnalizadoRecord | AsistenteEducacion)[],
  apiKey: string,
  selectedModel: string = 'gemini-3.7-flash',
  customPrompt?: string
): Promise<Array<{
  id: string;
  rut: string;
  nombre: string;
  funcion_oficial: FuncionCanonicaLevantamiento | 'OTROS ';
  cargo_detalle_otro: string;
  horas_sub_regular: number;
  horas_pie: number;
  horas_sep: number;
  horas_totales: number;
  observaciones: string;
}>> {
  if (!asistentes || asistentes.length === 0) return [];

  const itemsInput = asistentes.map((a, idx) => normalizarItemAsistente(a, idx));

  if (!apiKey || apiKey.trim() === '') {
    // Fallback heurístico
    return itemsInput.map((it) => {
      const { funcion, cargoDetalleOtro } = clasificarFuncionLevantamientoHeuristica(it.cargo_original, it.estamento, it.flags);
      return {
        id: it.id,
        rut: it.rut,
        nombre: it.nombre,
        funcion_oficial: funcion,
        cargo_detalle_otro: cargoDetalleOtro || '',
        horas_sub_regular: it.horas_sub_regular,
        horas_pie: it.horas_pie,
        horas_sep: it.horas_sep,
        horas_totales: it.horas_totales,
        observaciones: it.observaciones_originales
      };
    });
  }

  try {
    const promptFinal = customPrompt || LEVANTAMIENTO_IA_SYSTEM_PROMPT;
    const userMessage = `Analiza y clasifica para la "Planilla de Levantamiento de Coeficiente de Asistentes" los siguientes ${itemsInput.length} funcionarios:\n\n${JSON.stringify(itemsInput, null, 2)}`;

    const candidateModels = [
      selectedModel,
      'gemini-3.7-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ].filter((v, i, a) => a.indexOf(v) === i);

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await geminiFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: `${promptFinal}\n\n${userMessage}` }]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        });

        if (!response.ok) continue;

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) continue;

        const parsedJson = JSON.parse(candidateText);
        if (!Array.isArray(parsedJson)) continue;

        return parsedJson.map((item: any, idx: number) => {
          const fallback = itemsInput[idx] || {
            id: `asist-${idx}`,
            rut: '',
            nombre: '',
            cargo_original: '',
            horas_sub_regular: 0,
            horas_pie: 0,
            horas_sep: 0,
            horas_totales: 0,
            observaciones_originales: '',
            flags: {}
          };

          let funcionOficial: FuncionCanonicaLevantamiento | 'OTROS ' = item.funcion_oficial;
          if (!FUNCIONES_CANONICAS_LEVANTAMIENTO.includes(funcionOficial as any) && funcionOficial !== 'OTROS ') {
            const { funcion } = clasificarFuncionLevantamientoHeuristica(item.cargo_detalle_otro || fallback.cargo_original, fallback.estamento, fallback.flags);
            funcionOficial = funcion;
          }

          return {
            id: item.id || fallback.id,
            rut: item.rut || fallback.rut,
            nombre: item.nombre || fallback.nombre,
            funcion_oficial: funcionOficial,
            cargo_detalle_otro: item.cargo_detalle_otro || '',
            horas_sub_regular: typeof item.horas_sub_regular === 'number' ? item.horas_sub_regular : fallback.horas_sub_regular,
            horas_pie: typeof item.horas_pie === 'number' ? item.horas_pie : fallback.horas_pie,
            horas_sep: typeof item.horas_sep === 'number' ? item.horas_sep : fallback.horas_sep,
            horas_totales: typeof item.horas_totales === 'number' ? item.horas_totales : fallback.horas_totales,
            observaciones: item.observaciones || fallback.observaciones_originales || ''
          };
        });
      } catch (inner) {
        console.warn(`Intento con modelo ${model} falló en Levantamiento IA:`, inner);
      }
    }

    throw new Error('No fue posible obtener respuesta válida de Gemini AI');
  } catch (err) {
    console.warn('Fallo en Gemini AI para Levantamiento, aplicando fallback heurístico:', err);
    return itemsInput.map((it) => {
      const { funcion, cargoDetalleOtro } = clasificarFuncionLevantamientoHeuristica(it.cargo_original, it.estamento, it.flags);
      return {
        id: it.id,
        rut: it.rut,
        nombre: it.nombre,
        funcion_oficial: funcion,
        cargo_detalle_otro: cargoDetalleOtro || '',
        horas_sub_regular: it.horas_sub_regular,
        horas_pie: it.horas_pie,
        horas_sep: it.horas_sep,
        horas_totales: it.horas_totales,
        observaciones: it.observaciones_originales
      };
    });
  }
}

/**
 * Agrupa la lista de asistentes de un establecimiento en la estructura de la Planilla Oficial de Levantamiento
 */
export function generarMatrizLevantamientoEstablecimiento(
  asistentes: (AsistenteAnalizadoRecord | AsistenteEducacion)[],
  rbd: string,
  nombreEstablecimiento: string,
  comuna?: string,
  interpretacionIa?: Array<{
    id: string;
    funcion_oficial: FuncionCanonicaLevantamiento | 'OTROS ';
    cargo_detalle_otro: string;
    horas_sub_regular: number;
    horas_pie: number;
    horas_sep: number;
    horas_totales: number;
    observaciones: string;
  }>
): EstablecimientoLevantamiento {
  // 1. Inicializar las 17 filas estándar con valores en 0
  const rowsMap: Record<FuncionCanonicaLevantamiento, LevantamientoRow> = {
    'Inspectores': { cargoFuncion: 'Inspectores', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Auxiliares': { cargoFuncion: 'Auxiliares', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Psicólogo': { cargoFuncion: 'Psicólogo', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Trabajador  Social': { cargoFuncion: 'Trabajador  Social', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Asistente social': { cargoFuncion: 'Asistente social', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Kinesiólogo/a': { cargoFuncion: 'Kinesiólogo/a', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Fonoaudiólogo/a': { cargoFuncion: 'Fonoaudiólogo/a', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Terapeuta ocupacional': { cargoFuncion: 'Terapeuta ocupacional', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Asistente técnico de Educación Diferencial': { cargoFuncion: 'Asistente técnico de Educación Diferencial', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Asistentes de aula': { cargoFuncion: 'Asistentes de aula', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Administrativos': { cargoFuncion: 'Administrativos', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Conductores Auxliar': { cargoFuncion: 'Conductores Auxliar', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Maestros': { cargoFuncion: 'Maestros', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Enfermero/TENS/Asistente con capacitación': { cargoFuncion: 'Enfermero/TENS/Asistente con capacitación', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Comunicaciones': { cargoFuncion: 'Comunicaciones', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Secretaria': { cargoFuncion: 'Secretaria', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
    'Nocheros': { cargoFuncion: 'Nocheros', cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0, observaciones: '' },
  };

  const otrosRows: LevantamientoRow[] = [];

  // 2. Procesar cada asistente
  asistentes.forEach((asist, idx) => {
    const itemNorm = normalizarItemAsistente(asist, idx);

    let funcionOficial: FuncionCanonicaLevantamiento | 'OTROS ';
    let cargoDetalleOtro = '';
    let subRegular = itemNorm.horas_sub_regular;
    let pie = itemNorm.horas_pie;
    let sep = itemNorm.horas_sep;
    let total = itemNorm.horas_totales;
    let obs = itemNorm.observaciones_originales;

    const iaItem = interpretacionIa?.find((i) => i.id === itemNorm.id || (itemNorm.rut && i.id.includes(itemNorm.rut)));

    if (iaItem) {
      funcionOficial = iaItem.funcion_oficial;
      cargoDetalleOtro = iaItem.cargo_detalle_otro;
      subRegular = iaItem.horas_sub_regular;
      pie = iaItem.horas_pie;
      sep = iaItem.horas_sep;
      total = iaItem.horas_totales || (subRegular + pie + sep);
      obs = iaItem.observaciones;
    } else {
      const cl = clasificarFuncionLevantamientoHeuristica(itemNorm.cargo_original, itemNorm.estamento, itemNorm.flags);
      funcionOficial = cl.funcion;
      cargoDetalleOtro = cl.cargoDetalleOtro || '';
    }

    if (funcionOficial === 'OTROS ') {
      // Agregar o acumular fila OTROS
      const existingOtro = otrosRows.find((o) => o.observaciones.toLowerCase().includes((cargoDetalleOtro || 'otro').toLowerCase()));
      if (existingOtro) {
        existingOtro.cantidadFuncionarios += 1;
        existingOtro.horasSubRegular += subRegular;
        existingOtro.horasPie += pie;
        existingOtro.horasSep += sep;
        existingOtro.totalHoras += total;
        if (obs && !existingOtro.observaciones.includes(obs)) {
          existingOtro.observaciones += `; ${obs}`;
        }
      } else {
        const obsFinal = cargoDetalleOtro ? (obs ? `${cargoDetalleOtro} (${obs})` : cargoDetalleOtro) : (obs || 'Función no listada');
        otrosRows.push({
          cargoFuncion: 'OTROS ',
          cantidadFuncionarios: 1,
          horasSubRegular: subRegular,
          horasPie: pie,
          horasSep: sep,
          totalHoras: total,
          observaciones: obsFinal,
          isOtro: true
        });
      }
    } else {
      const target = rowsMap[funcionOficial];
      if (target) {
        target.cantidadFuncionarios += 1;
        target.horasSubRegular += subRegular;
        target.horasPie += pie;
        target.horasSep += sep;
        target.totalHoras += total;
        if (obs && !target.observaciones.includes(obs)) {
          target.observaciones = target.observaciones ? `${target.observaciones}; ${obs}` : obs;
        }
      }
    }
  });

  // Si no hay filas de OTROS, asegurar al menos 2 filas de plantilla con placeholder
  if (otrosRows.length === 0) {
    otrosRows.push({
      cargoFuncion: 'OTROS ',
      cantidadFuncionarios: 0,
      horasSubRegular: 0,
      horasPie: 0,
      horasSep: 0,
      totalHoras: 0,
      observaciones: '( Señalar cuál es la función)',
      isOtro: true
    });
    otrosRows.push({
      cargoFuncion: 'OTROS ',
      cantidadFuncionarios: 0,
      horasSubRegular: 0,
      horasPie: 0,
      horasSep: 0,
      totalHoras: 0,
      observaciones: '( Señalar cuál es la función)',
      isOtro: true
    });
  }

  const standardList = FUNCIONES_CANONICAS_LEVANTAMIENTO.map((fn) => rowsMap[fn]);
  const allRows = [...standardList, ...otrosRows];

  // Calcular Total General
  const totalGeneral = allRows.reduce(
    (acc, r) => ({
      cantidadFuncionarios: acc.cantidadFuncionarios + r.cantidadFuncionarios,
      horasSubRegular: acc.horasSubRegular + r.horasSubRegular,
      horasPie: acc.horasPie + r.horasPie,
      horasSep: acc.horasSep + r.horasSep,
      totalHoras: acc.totalHoras + r.totalHoras,
    }),
    { cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0 }
  );

  return {
    rbd,
    nombreEstablecimiento,
    comuna,
    rows: allRows,
    totalGeneral
  };
}
