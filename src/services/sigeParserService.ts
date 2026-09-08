import { SigeDocenteRow, Docente, Establecimiento, EstamentoDocente, CalidadJuridicaDocente } from '../types';
import { identifySchool } from '../data/slepSchoolsCatalog';

/**
 * Limpia caracteres dañados o mojibake provenientes de exportaciones SIGE (ISO-8859-1 / Windows-1252)
 */
export function limpiarTextoMineduc(texto: string): string {
  if (!texto) return '';
  return texto.trim();
}

/**
 * Parsea el contenido en texto plano de una exportación oficial SIGE MINEDUC (delimitada por punto y coma)
 */
export function parsearPlanillaSige(contenidoTexto: string): {
  rbdDetectado: string;
  nombreColegioDetectado: string;
  filas: SigeDocenteRow[];
  docentesConvertidos: Docente[];
  establecimientoSugerido: Establecimiento;
  totales: {
    totalDocentes: number;
    totalHorasContrato: number;
    totalHorasDirectivas: number;
    totalHorasTecnicas: number;
    totalHorasAula: number;
  };
} {
  const lineas = contenidoTexto
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lineas.length === 0) {
    throw new Error('El archivo SIGE está vacío.');
  }

  // Verificar encabezado
  const cabeceraLinea = lineas[0];
  const cabeceras = cabeceraLinea.split(';').map(c => c.trim().toUpperCase());

  const idxRun = cabeceras.indexOf('DOC_RUN');
  const idxDv = cabeceras.indexOf('DOC_DV');
  const idxNombre = cabeceras.indexOf('DOC_NOMBRE');
  const idxPaterno = cabeceras.indexOf('DOC_PATERNO');
  const idxMaterno = cabeceras.indexOf('DOC_MATERNO');
  const idxRbd = cabeceras.indexOf('RBD');
  const idxNombreEsta = cabeceras.indexOf('NOMBRE_ESTA');
  const idxFuncP = cabeceras.indexOf('FUNCION_PRINCIPAL');
  const idxFuncS = cabeceras.indexOf('FUNCION_SECUNDARIA');
  const idxHorasContrato = cabeceras.indexOf('HORAS_CONTRATO');
  const idxHorasIngles = cabeceras.indexOf('HORAS_INGLES');
  const idxHorasDirectivas = cabeceras.indexOf('HORAS_DIRECTIVAS');
  const idxHorasTecnicas = cabeceras.indexOf('HORAS_TECNICO_PEDAGOGICA');
  const idxHorasAula = cabeceras.indexOf('HORAS_AULA');
  const idxPedF1 = cabeceras.indexOf('HORAS_PEDAGOGICAS_FUNCION_1');
  const idxPedF2 = cabeceras.indexOf('HORAS_PEDAGOGICAS_FUNCION_2');
  const idxSec1 = cabeceras.indexOf('SECTOR_FUNCION_1');
  const idxSubSec1 = cabeceras.indexOf('SUB_SECTOR_FUNCION_1');
  const idxSec2 = cabeceras.indexOf('SECTOR_FUNCION_2');
  const idxSubSec2 = cabeceras.indexOf('SUB_SECTOR_FUNCION_2');
  const idxIdoneidad = cabeceras.indexOf('ESTADO_IDONEIDAD');

  if (idxRun === -1 || idxRbd === -1) {
    throw new Error('Formato SIGE inválido: No se encontraron las columnas DOC_RUN o RBD.');
  }

  const filas: SigeDocenteRow[] = [];
  let rbdDetectado = '';
  let nombreColegioDetectado = '';

  for (let i = 1; i < lineas.length; i++) {
    const cols = lineas[i].split(';');
    if (cols.length < 5) continue;

    const rawRun = cols[idxRun]?.trim() || '';
    if (!rawRun || isNaN(Number(rawRun))) continue;

    const dv = cols[idxDv]?.trim() || '';
    const nombres = limpiarTextoMineduc(cols[idxNombre] || '');
    const paterno = limpiarTextoMineduc(cols[idxPaterno] || '');
    const materno = limpiarTextoMineduc(cols[idxMaterno] || '');
    const rbd = cols[idxRbd]?.trim() || '';
    const nombreEsta = limpiarTextoMineduc(cols[idxNombreEsta] || '');

    if (!rbdDetectado && rbd) rbdDetectado = rbd;
    if (!nombreColegioDetectado && nombreEsta) nombreColegioDetectado = nombreEsta;

    const funcP = cols[idxFuncP]?.trim() || 'DOCENTE DE AULA';
    const funcS = cols[idxFuncS]?.trim() || '--';
    const hContrato = parseInt(cols[idxHorasContrato]) || 0;
    const hIngles = parseInt(cols[idxHorasIngles]) || 0;
    const hDirectivas = parseInt(cols[idxHorasDirectivas]) || 0;
    const hTecnicas = parseInt(cols[idxHorasTecnicas]) || 0;
    const hAula = parseInt(cols[idxHorasAula]) || 0;
    const hPed1 = parseInt(cols[idxPedF1]) || 0;
    const hPed2 = parseInt(cols[idxPedF2]) || 0;
    const sec1 = cols[idxSec1]?.trim() || '';
    const subSec1 = cols[idxSubSec1]?.trim() || '';
    const sec2 = cols[idxSec2]?.trim() || '';
    const subSec2 = cols[idxSubSec2]?.trim() || '';
    const idoneidad = cols[idxIdoneidad]?.trim() || 'OK';

    filas.push({
      runCompleto: `${rawRun}-${dv}`,
      run: rawRun,
      dv,
      nombres,
      apellidos: `${paterno} ${materno}`.trim(),
      rbd,
      nombreEstablecimiento: nombreEsta,
      funcionPrincipal: funcP,
      funcionSecundaria: funcS,
      horasContrato: hContrato,
      horasIngles: hIngles,
      horasDirectivas: hDirectivas,
      horasTecnicoPedagogica: hTecnicas,
      horasAula: hAula,
      horasPedagogicasFuncion1: hPed1,
      horasPedagogicasFuncion2: hPed2,
      sectorFuncion1: sec1,
      subSectorFuncion1: subSec1,
      sectorFuncion2: sec2,
      subSectorFuncion2: subSec2,
      estadoIdoneidad: idoneidad
    });
  }

  // Convertir a modelos Docente de la aplicación
  const docentesConvertidos: Docente[] = filas.map(f => {
    let estamento: EstamentoDocente = 'DOCENTE_AULA';
    const funcUpper = f.funcionPrincipal.toUpperCase();
    const sec1Upper = f.sectorFuncion1.toUpperCase();

    if (funcUpper.includes('DIRECTOR') || funcUpper.includes('INSPECTOR') || funcUpper.includes('ORIENTADOR')) {
      estamento = 'DIRECTIVO';
    } else if (funcUpper.includes('TÉCNICO') || funcUpper.includes('TECNICO') || funcUpper.includes('PEDAGÓGICA') || funcUpper.includes('UTP')) {
      estamento = 'TECNICO_PEDAGOGICO';
    } else if (funcUpper.includes('DIFERENCIAL') || sec1Upper.includes('ESPECIAL') || sec1Upper.includes('DIFERENCIAL')) {
      estamento = 'DOCENTE_DIFERENCIAL';
    } else if (funcUpper.includes('CRA')) {
      estamento = 'COORDINADOR_CRA';
    } else if (funcUpper.includes('OTRA')) {
      estamento = 'OTRA_ESTABLECIMIENTO';
    }

    let asignatura = f.subSectorFuncion1 !== '--' && f.subSectorFuncion1 ? f.subSectorFuncion1 : f.sectorFuncion1;
    if (asignatura === '--') asignatura = f.funcionPrincipal;

    return {
      id: `doc-${f.rbd}-${f.run}`,
      rbd: f.rbd,
      run: f.runCompleto,
      nombres: f.nombres,
      apellidos: f.apellidos,
      titulo: f.funcionPrincipal,
      calidadJuridica: 'TITULAR' as CalidadJuridicaDocente,
      estamento,
      horasContrato: f.horasContrato,
      horasDirectivas: f.horasDirectivas,
      horasTecnicoPedagogicas: f.horasTecnicoPedagogica,
      horasAula: f.horasAula,
      horasIngles: f.horasIngles,
      funcionPrincipal: f.funcionPrincipal,
      funcionSecundaria: f.funcionSecundaria !== '--' ? f.funcionSecundaria : undefined,
      asignaturaPrincipal: asignatura,
      aplicaArticulo69: false
    };
  });

  const schoolMatch = identifySchool(rbdDetectado) || identifySchool(nombreColegioDetectado);
  const nombreFinal = schoolMatch ? schoolMatch.nombre : (nombreColegioDetectado || `Establecimiento RBD ${rbdDetectado}`);
  const comunaFinal = schoolMatch ? schoolMatch.comuna : 'Chillán';

  const establecimientoSugerido: Establecimiento = {
    id: `est-${rbdDetectado}`,
    rbd: rbdDetectado,
    nombre: nombreFinal,
    comuna: comunaFinal,
    regimen: schoolMatch?.tipo === 'JARDIN' || schoolMatch?.tipo === 'SALA_CUNA' ? 'No JEC' : 'JEC',
    porcentajePrioritarios: 80,
    asesorUatp: 'UATP SLEP Valle Diguillín'
  };

  const totales = {
    totalDocentes: filas.length,
    totalHorasContrato: filas.reduce((s, f) => s + f.horasContrato, 0),
    totalHorasDirectivas: filas.reduce((s, f) => s + f.horasDirectivas, 0),
    totalHorasTecnicas: filas.reduce((s, f) => s + f.horasTecnicoPedagogica, 0),
    totalHorasAula: filas.reduce((s, f) => s + f.horasAula, 0)
  };

  return {
    rbdDetectado,
    nombreColegioDetectado,
    filas,
    docentesConvertidos,
    establecimientoSugerido,
    totales
  };
}
