/**
 * sigeAsistentesParser.ts
 * Parser oficial de nóminas de Asistentes de la Educación descargadas desde SIGE (MINEDUC).
 * Cumple con Ley N° 21.109 / DFL 1/1996, normalización léxica y rescate fonético de tildes y eñes.
 */

import { AsistenteEducacion, EstamentoAsistente, Establecimiento } from '../types';
import { identifySchool } from '../data/slepSchoolsCatalog';
import { validarRut, normalizarRut } from '../utils/rutUtils';
import { limpiarTextoMineduc, toTitleCase, decodificarArchivoSige } from './sigeParserService';
import { normalizarCargoAsistenteInteligente } from './analizador/intelligentCargoNormalizer';
import { inferirClasificacionAsistente } from '../../packages/mineduc-engine/src/calculoAsistentes';

export interface SigeAsistenteFilaRaw {
  run: string;
  dv: string;
  runCompleto: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  apellidos: string;
  nombreCompleto: string;
  genero: string;
  fechaNacimiento: string;
  rbd: string;
  nombreEstablecimiento: string;
  titulo: string;
  institucion: string;
  duracionCarrera: number;
  horasContrato: number;
  funcionUno: string;
  aniosFuncionUno: number;
  horasFuncionUno: number;
  funcionDos: string;
  aniosFuncionDos: number;
  horasFuncionDos: number;
  estadoAsistente: string;
  // Campos calculados y clasificados
  cargoCompuesto: string;
  estamentoDetectado: EstamentoAsistente;
  esDuplaPsicosocial: boolean;
  esEquipoPie: boolean;
  esTecnicoParvulo: boolean;
  esAuxiliarServicio: boolean;
  esInspectorPatio: boolean;
}

export interface ResultadoParseoAsistentesSige {
  rbdDetectado: string;
  nombreColegioDetectado: string;
  filas: SigeAsistenteFilaRaw[];
  asistentesConvertidos: AsistenteEducacion[];
  establecimientoSugerido: Establecimiento;
  totales: {
    totalAsistentes: number;
    totalHorasContrato: number;
    totalProfesionales: number;
    totalTecnicos: number;
    totalAdministrativos: number;
    totalAuxiliares: number;
    totalParadocentes: number;
    totalDuplas: number;
    totalPie: number;
  };
  advertencias: Array<{ linea: number; run: string; mensaje: string }>;
}

function parseNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }
  const s = String(val).trim().replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

/**
 * Determina si una línea o texto corresponde a la cabecera de Asistentes de SIGE
 */
export function esEncabezadoAsistentesSige(lineaOTexto: string): boolean {
  if (!lineaOTexto) return false;
  const upper = lineaOTexto.toUpperCase();
  return (
    upper.includes('ASISTENTE_RUN') ||
    (upper.includes('ASISTENTE_NOMBRE') && upper.includes('FUNCION_UNO')) ||
    (upper.includes('FUNCION_UNO') && upper.includes('HORAS_FUNCION_UNO'))
  );
}

/**
 * Parsea el contenido en texto plano de una exportación oficial SIGE MINEDUC de Asistentes.
 */
export function parsearAsistentesSige(
  contenidoTexto: string,
  rbdDestino?: string,
  periodo: number = 2026
): ResultadoParseoAsistentesSige {
  const advertencias: Array<{ linea: number; run: string; mensaje: string }> = [];
  const lineas = contenidoTexto
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  if (lineas.length === 0) {
    throw new Error('El archivo o texto provisto está vacío.');
  }

  // 1. Detección del delimitador (punto y coma prioritario en SIGE, o coma alternativa)
  let delimitador = ';';
  const primeraLinea = lineas[0];
  if (!primeraLinea.includes(';') && primeraLinea.includes(',')) {
    delimitador = ',';
  }

  // 2. Localizar cabecera de asistentes
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lineas.length, 10); i++) {
    const l = lineas[i].toUpperCase();
    if (l.includes('ASISTENTE_RUN') || (l.includes('ASISTENTE_NOMBRE') && l.includes('FUNCION_UNO'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    // Si no tiene prefijo "ASISTENTE_", buscar columnas generales
    for (let i = 0; i < Math.min(lineas.length, 10); i++) {
      const tokens = lineas[i].split(delimitador).map(t => limpiarTextoMineduc(t).toUpperCase());
      const hasRun = tokens.some(t => t.includes('RUN') || t.includes('RUT'));
      const hasNombre = tokens.some(t => t.includes('NOMBRE') || t.includes('PATERNO'));
      const hasFuncion = tokens.some(t => t.includes('FUNCION') || t.includes('CARGO'));
      if (hasRun && hasNombre && hasFuncion) {
        headerIndex = i;
        break;
      }
    }
  }

  if (headerIndex === -1) {
    headerIndex = 0;
  }

  const headerTokens = lineas[headerIndex]
    .split(delimitador)
    .map(col => limpiarTextoMineduc(col).toUpperCase().replace(/[\"\']/g, ''));

  // Mapa de índices por nombre de columna oficial SIGE
  const colMap: Record<string, number> = {};
  headerTokens.forEach((token, idx) => {
    if (token.includes('ASISTENTE_RUN') || token === 'RUN' || token === 'RUT') colMap['run'] = idx;
    else if (token.includes('ASISTENTE_DV') || token === 'DV') colMap['dv'] = idx;
    else if (token.includes('ASISTENTE_NOMBRE') || token === 'NOMBRES' || token === 'NOMBRE') colMap['nombres'] = idx;
    else if (token.includes('ASISTENTE_PATERNO') || token.includes('PATERNO')) colMap['paterno'] = idx;
    else if (token.includes('ASISTENTE_MATERNO') || token.includes('MATERNO')) colMap['materno'] = idx;
    else if (token.includes('GENERO') || token.includes('SEXO')) colMap['genero'] = idx;
    else if (token.includes('FECHA_NACIMIENTO') || token.includes('NACIMIENTO')) colMap['fechaNacimiento'] = idx;
    else if (token === 'RBD' || token.includes('COD_RBD')) colMap['rbd'] = idx;
    else if (token.includes('NOMBRE_ESTA') || token.includes('ESTABLECIMIENTO')) colMap['nombreEstablecimiento'] = idx;
    else if (token.includes('TITULO')) colMap['titulo'] = idx;
    else if (token.includes('INSTITUCION')) colMap['institucion'] = idx;
    else if (token.includes('DURACION_CARRERA')) colMap['duracionCarrera'] = idx;
    else if (token.includes('HORAS_CONTRATO') || token === 'HORAS') colMap['horasContrato'] = idx;
    else if (token.includes('ANIOS_FUNCION_UNO') || token.includes('ANTIGUEDAD_1')) colMap['aniosFuncionUno'] = idx;
    else if (token.includes('HORAS_FUNCION_UNO') || token.includes('HORAS_1')) colMap['horasFuncionUno'] = idx;
    else if (token.includes('ANIOS_FUNCION_DOS') || token.includes('ANTIGUEDAD_2')) colMap['aniosFuncionDos'] = idx;
    else if (token.includes('HORAS_FUNCION_DOS') || token.includes('HORAS_2')) colMap['horasFuncionDos'] = idx;
    else if (token.includes('FUNCION_UNO') || token.includes('FUNCION_1') || token === 'FUNCION') colMap['funcionUno'] = idx;
    else if (token.includes('FUNCION_DOS') || token.includes('FUNCION_2')) colMap['funcionDos'] = idx;
    else if (token.includes('ESTADO_ASISTENTE') || token.includes('ESTADO')) colMap['estadoAsistente'] = idx;
  });

  // Fallbacks de posición si no se identificaron nombres
  if (colMap['run'] === undefined) colMap['run'] = 0;
  if (colMap['dv'] === undefined) colMap['dv'] = 1;
  if (colMap['nombres'] === undefined) colMap['nombres'] = 2;
  if (colMap['paterno'] === undefined) colMap['paterno'] = 3;
  if (colMap['materno'] === undefined) colMap['materno'] = 4;
  if (colMap['genero'] === undefined) colMap['genero'] = 5;
  if (colMap['fechaNacimiento'] === undefined) colMap['fechaNacimiento'] = 6;
  if (colMap['rbd'] === undefined) colMap['rbd'] = 7;
  if (colMap['nombreEstablecimiento'] === undefined) colMap['nombreEstablecimiento'] = 8;
  if (colMap['titulo'] === undefined) colMap['titulo'] = 9;
  if (colMap['institucion'] === undefined) colMap['institucion'] = 10;
  if (colMap['duracionCarrera'] === undefined) colMap['duracionCarrera'] = 11;
  if (colMap['horasContrato'] === undefined) colMap['horasContrato'] = 12;
  if (colMap['funcionUno'] === undefined) colMap['funcionUno'] = 13;
  if (colMap['aniosFuncionUno'] === undefined) colMap['aniosFuncionUno'] = 14;
  if (colMap['horasFuncionUno'] === undefined) colMap['horasFuncionUno'] = 15;
  if (colMap['funcionDos'] === undefined) colMap['funcionDos'] = 16;
  if (colMap['aniosFuncionDos'] === undefined) colMap['aniosFuncionDos'] = 17;
  if (colMap['horasFuncionDos'] === undefined) colMap['horasFuncionDos'] = 18;
  if (colMap['estadoAsistente'] === undefined) colMap['estadoAsistente'] = 19;

  let rbdDetectado = rbdDestino || '';
  let nombreColegioDetectado = '';
  const filasRaw: SigeAsistenteFilaRaw[] = [];
  const asistentesConvertidos: AsistenteEducacion[] = [];
  const runsVistos = new Set<string>();

  for (let r = headerIndex + 1; r < lineas.length; r++) {
    const rawLine = lineas[r];
    if (!rawLine || rawLine.replace(/;/g, '').trim().length === 0) continue;

    const cols = rawLine.split(delimitador).map(c => c.trim().replace(/^[\"\']|[\"\']$/g, ''));
    if (cols.length < 5) continue;

    // Extracción limpia con rescate fonético
    const runStr = cols[colMap['run']] ? cols[colMap['run']].replace(/\./g, '').trim() : '';
    const dvStr = cols[colMap['dv']] ? cols[colMap['dv']].trim().toUpperCase() : '';
    if (!runStr) continue;

    const runCombinado = `${runStr}-${dvStr}`;
    const runValidado = normalizarRut(runCombinado) || runCombinado;

    if (!validarRut(runValidado)) {
      advertencias.push({
        linea: r + 1,
        run: runValidado,
        mensaje: `Dígito verificador inválido o formato de RUN irregular para ${runValidado}`
      });
    }

    const nombresCrudos = limpiarTextoMineduc(cols[colMap['nombres']] || '');
    const paternoCrudo = limpiarTextoMineduc(cols[colMap['paterno']] || '');
    const maternoCrudo = limpiarTextoMineduc(cols[colMap['materno']] || '');

    const nombres = toTitleCase(nombresCrudos);
    const apellidos = toTitleCase(`${paternoCrudo} ${maternoCrudo}`.trim());
    const nombreCompleto = `${apellidos}, ${nombres}`;

    const genero = (cols[colMap['genero']] || 'F').toUpperCase();
    const fechaNacimiento = cols[colMap['fechaNacimiento']] || '';
    const rbdFila = cols[colMap['rbd']] ? cols[colMap['rbd']].trim() : '';
    const nombreEstaFila = cols[colMap['nombreEstablecimiento']]
      ? toTitleCase(limpiarTextoMineduc(cols[colMap['nombreEstablecimiento']]))
      : '';

    if (!rbdDetectado && rbdFila && !isNaN(Number(rbdFila))) {
      rbdDetectado = rbdFila;
    }
    if (!nombreColegioDetectado && nombreEstaFila) {
      nombreColegioDetectado = nombreEstaFila;
    }

    const titulo = limpiarTextoMineduc(cols[colMap['titulo']] || 'SIN TÍTULO');
    const institucion = limpiarTextoMineduc(cols[colMap['institucion']] || 'NINGUNA');
    const duracionCarrera = parseNumber(cols[colMap['duracionCarrera']] || 0);
    const horasContratoTotales = parseNumber(cols[colMap['horasContrato']] || 0);

    const funcionUno = limpiarTextoMineduc(cols[colMap['funcionUno']] || 'ASISTENTE DE LA EDUCACIÓN');
    const aniosFuncionUno = parseNumber(cols[colMap['aniosFuncionUno']] || 0);
    const horasFuncionUno = parseNumber(cols[colMap['horasFuncionUno']] || 0);

    const funcionDosRaw = cols[colMap['funcionDos']] ? limpiarTextoMineduc(cols[colMap['funcionDos']]) : '';
    const funcionDos =
      funcionDosRaw && !/^(SIN DATO|SIN INFORMACI[OÓ]N|AGREGAR|--|\.)$/i.test(funcionDosRaw)
        ? funcionDosRaw
        : '';
    const aniosFuncionDos = parseNumber(cols[colMap['aniosFuncionDos']] || 0);
    const horasFuncionDos = parseNumber(cols[colMap['horasFuncionDos']] || 0);

    const estadoAsistente = cols[colMap['estadoAsistente']]
      ? cols[colMap['estadoAsistente']].trim().toUpperCase()
      : 'HABILITADO';

    // Manejo de Horas y Doble Función
    let finalHorasContrato = horasContratoTotales;
    if (finalHorasContrato === 0 && (horasFuncionUno + horasFuncionDos) > 0) {
      finalHorasContrato = horasFuncionUno + horasFuncionDos;
    }

    // Composición de Cargo Compuesto Legible
    let cargoCompuesto = funcionUno;
    if (funcionDos && horasFuncionDos > 0) {
      cargoCompuesto = `${funcionUno} (${horasFuncionUno}h) / ${funcionDos} (${horasFuncionDos}h)`;
    }

    // Clasificación de estamento y roles normativos
    // Evaluamos función uno, función dos y el título académico
    const contextoEvaluacion = `${funcionUno} ${funcionDos} ${titulo}`;
    const normInteligente = normalizarCargoAsistenteInteligente(funcionUno, `${funcionDos} ${titulo}`);
    const clasificacionNormativa = inferirClasificacionAsistente(contextoEvaluacion);

    let estamentoFinal: EstamentoAsistente = normInteligente.estamento || clasificacionNormativa.estamento;

    // Regla de jerarquía: si es psicólogo, fonoaudiólogo, trabajador social, siempre estamento PROFESIONAL
    if (
      /PSIC[OÓ]LOG|FONOAUD|TRABAJADOR(A)?\s*SOCIAL|ASISTENTE\s*SOCIAL|KINESI[OÓ]LOG|TERAPEUTA/i.test(contextoEvaluacion)
    ) {
      estamentoFinal = 'PROFESIONAL';
    } else if (/T[EÉ]CNICO|TENS/i.test(contextoEvaluacion) || normInteligente.esTecnicoParvulo) {
      estamentoFinal = 'TECNICO';
    } else if (normInteligente.esAuxiliarServicio || clasificacionNormativa.esAuxiliarServicio) {
      estamentoFinal = 'AUXILIAR';
    } else if (/INSPECTOR|MONITOR|PARADOCENTE|PATIO/i.test(contextoEvaluacion)) {
      estamentoFinal = 'PARADOCENTE_INSPECTORIA';
    }

    const esDuplaPsicosocial =
      normInteligente.esDuplaPsicosocial ||
      clasificacionNormativa.esDuplaPsicosocial ||
      /PSIC[OÓ]LOG|ASISTENTE\s*SOCIAL|TRABAJADOR(A)?\s*SOCIAL/i.test(contextoEvaluacion);

    const esEquipoPie =
      normInteligente.esEquipoPie ||
      clasificacionNormativa.esEquipoPie ||
      /FONOAUD|TERAPEUTA|KINESI|DIFERENCIAL|PSICOPEDAG/i.test(contextoEvaluacion);

    const esTecnicoParvulo =
      normInteligente.esTecnicoParvulo ||
      clasificacionNormativa.esTecnicoParvulo ||
      /P[AÁ]RVULO|PARVULARIA/i.test(contextoEvaluacion);

    const esAuxiliarServicio =
      normInteligente.esAuxiliarServicio ||
      clasificacionNormativa.esAuxiliarServicio ||
      /AUXILIAR|ASEO|MANTENCI[OÓ]N|MAESTRO|CHOFER|CONDUCTOR|NOCHERO|ROND[IÍ]N/i.test(contextoEvaluacion);

    const esInspectorPatio =
      normInteligente.esInspectorPatio ||
      clasificacionNormativa.esInspectorPatio ||
      /INSPECTOR|PARADOCENTE|PATIO/i.test(contextoEvaluacion);

    // Registro Crudo SIGE
    filasRaw.push({
      run: runStr,
      dv: dvStr,
      runCompleto: runValidado,
      nombres,
      apellidoPaterno: toTitleCase(paternoCrudo),
      apellidoMaterno: toTitleCase(maternoCrudo),
      apellidos,
      nombreCompleto,
      genero,
      fechaNacimiento,
      rbd: rbdFila || rbdDetectado,
      nombreEstablecimiento: nombreEstaFila || nombreColegioDetectado,
      titulo,
      institucion,
      duracionCarrera,
      horasContrato: finalHorasContrato,
      funcionUno,
      aniosFuncionUno,
      horasFuncionUno,
      funcionDos,
      aniosFuncionDos,
      horasFuncionDos,
      estadoAsistente,
      cargoCompuesto,
      estamentoDetectado: estamentoFinal,
      esDuplaPsicosocial,
      esEquipoPie,
      esTecnicoParvulo,
      esAuxiliarServicio,
      esInspectorPatio
    });

    // Construcción de Observaciones y Metadatos Oficiales
    const partesObs: string[] = [];
    if (titulo && titulo !== 'SIN TÍTULO') partesObs.push(`Título: ${titulo} (${institucion})`);
    if (aniosFuncionUno > 0) partesObs.push(`Antigüedad F1: ${aniosFuncionUno} años`);
    if (funcionDos && horasFuncionDos > 0) partesObs.push(`F2: ${funcionDos} (${horasFuncionDos}h, ${aniosFuncionDos} años)`);
    if (fechaNacimiento) partesObs.push(`F.Nac: ${fechaNacimiento}`);
    if (genero) partesObs.push(`Sexo: ${genero}`);
    const observacionesFinal = partesObs.join(' | ');

    const rbdRegistro = rbdFila || rbdDetectado || '0';
    const cleanRunId = runStr.replace(/\D/g, '');
    const id = `asist_${rbdRegistro}_${cleanRunId}_${periodo}`;

    if (runsVistos.has(runValidado)) {
      advertencias.push({
        linea: r + 1,
        run: runValidado,
        mensaje: `RUT duplicado en la nómina SIGE: ${runValidado} (${nombreCompleto})`
      });
    }
    runsVistos.add(runValidado);

    // En SIGE no se desglosa el origen financiero; se imputa a Subvención General como línea base inicial
    let horasSubvGral = finalHorasContrato;
    let horasSep = 0;
    let horasPie = 0;

    if (esDuplaPsicosocial) {
      // Habitualmente financiado vía SEP o Convenio
      horasSep = finalHorasContrato;
      horasSubvGral = 0;
    } else if (esEquipoPie) {
      // Financiado vía Decreto 170 PIE
      horasPie = finalHorasContrato;
      horasSubvGral = 0;
    }

    asistentesConvertidos.push({
      id,
      rbd: rbdRegistro,
      periodo,
      run: runValidado,
      nombres,
      apellidos,
      cargoFuncion: cargoCompuesto,
      estamento: estamentoFinal,
      horasContrato: finalHorasContrato,
      horasSubvencionGeneralIndefinido: horasSubvGral,
      horasSubvencionGeneralPlazoFijo: 0,
      horasSepIndefinido: horasSep,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: horasPie,
      horasPiePlazoFijo: 0,
      esDuplaPsicosocial,
      esEquipoPie,
      esTecnicoParvulo,
      esAuxiliarServicio,
      esInspectorPatio,
      observaciones: observacionesFinal || undefined,
      activo: estadoAsistente === 'HABILITADO',
      horasVigentesAnterior: finalHorasContrato,
      propuestaGdp: 'Continuidad',
      descripcionFuncionGdp: cargoCompuesto,
      situacionFinalGdp: estadoAsistente
    });
  }

  // Establecimiento Sugerido usando el catálogo territorial oficial SLEP
  const schoolMatch = identifySchool(rbdDetectado) || (nombreColegioDetectado ? identifySchool(nombreColegioDetectado) : null);
  const nombreFinal = schoolMatch ? schoolMatch.nombre : (nombreColegioDetectado || `Establecimiento RBD ${rbdDetectado}`);
  const comunaFinal = schoolMatch ? schoolMatch.comuna : 'Chillán';

  const establecimientoSugerido: Establecimiento = {
    id: `est-${rbdDetectado}`,
    rbd: rbdDetectado,
    nombre: nombreFinal,
    comuna: comunaFinal,
    regimen: 'JEC',
    porcentajePrioritarios: 80,
    asesorUatp: 'UATP SLEP Valle Diguillín'
  };

  // Métricas agregadas
  const totalHorasContrato = asistentesConvertidos.reduce((sum, a) => sum + (a.horasContrato || 0), 0);
  const totalProfesionales = asistentesConvertidos.filter(a => a.estamento === 'PROFESIONAL').length;
  const totalTecnicos = asistentesConvertidos.filter(a => a.estamento === 'TECNICO').length;
  const totalAdministrativos = asistentesConvertidos.filter(a => a.estamento === 'ADMINISTRATIVO').length;
  const totalAuxiliares = asistentesConvertidos.filter(a => a.estamento === 'AUXILIAR').length;
  const totalParadocentes = asistentesConvertidos.filter(a => a.estamento === 'PARADOCENTE_INSPECTORIA').length;
  const totalDuplas = asistentesConvertidos.filter(a => a.esDuplaPsicosocial).length;
  const totalPie = asistentesConvertidos.filter(a => a.esEquipoPie).length;

  return {
    rbdDetectado,
    nombreColegioDetectado: establecimientoSugerido.nombre,
    filas: filasRaw,
    asistentesConvertidos,
    establecimientoSugerido,
    totales: {
      totalAsistentes: asistentesConvertidos.length,
      totalHorasContrato,
      totalProfesionales,
      totalTecnicos,
      totalAdministrativos,
      totalAuxiliares,
      totalParadocentes,
      totalDuplas,
      totalPie
    },
    advertencias
  };
}
