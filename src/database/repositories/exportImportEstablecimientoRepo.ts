import { Establecimiento, SalaInfraestructura, CursoSae, Docente, AsignacionHoraria, AsistenteEducacion } from '../../types';
import { getDb, persistDb } from '../dbCore';
import { guardarEstablecimiento, obtenerEstablecimientoPorRbd } from './establecimientosRepo';
import { listarSalas, guardarSala } from './salasRepo';
import { listarCursos, guardarCurso } from './cursosRepo';
import { listarDocentes, guardarDocentesBatch } from './docentesRepo';
import { listarAsignaciones, guardarAsignacionesBatch } from './asignacionesRepo';
import { listarAsistentes, guardarAsistentesBatch } from './asistentesRepo';
import { normalizarRut } from '../../utils/rutUtils';

export interface EstablecimientoExportPackage {
  formato: 'SLEP_ESTABLECIMIENTO_PACKAGE';
  tipo?: 'DOTACION_ESTABLECIMIENTO';
  version: string;
  timestamp?: string;
  fechaExportacion?: string;
  exportadoPor?: string;
  periodo: number;
  establecimiento: Establecimiento;
  salas: SalaInfraestructura[];
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  asistentes?: AsistenteEducacion[];
  resumenMetricas?: {
    totalCursos: number;
    totalDocentes: number;
    totalSalas: number;
    totalAsistentes?: number;
    totalHorasContrato: number;
    totalHorasAsignadas: number;
    matriculaTotal: number;
  };
  checksum?: string;
}

export interface ImportEstablecimientoResult {
  exito: boolean;
  rbdDestino: string;
  nombreColegio: string;
  periodoDestino: number;
  salasImportadas: number;
  cursosImportados: number;
  docentesImportados: number;
  asistentesImportados: number;
  asignacionesImportadas: number;
  modoAplicado: 'REEMPLAZAR' | 'FUSIONAR';
  alertas: string[];
  error?: string;
}

export interface PaqueteEstablecimientoNormalizado {
  valido: boolean;
  error?: string;
  establecimiento: Establecimiento;
  periodo: number;
  salas: SalaInfraestructura[];
  cursos: CursoSae[];
  docentes: Docente[];
  asistentes: AsistenteEducacion[];
  asignaciones: AsignacionHoraria[];
  metadatos?: {
    tipo?: string;
    formato?: string;
    version?: string;
    fechaExportacion?: string;
    exportadoPor?: string;
    asesor?: { nombre?: string; email?: string };
  };
}

function generarChecksumSimple(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Normaliza un archivo cargado (.slep, .slep.json o .json) proveniente de cualquier fuente:
 * - Ficha individual de Asesor (tipo: 'DOTACION_ESTABLECIMIENTO')
 * - Paquete de Establecimiento (formato: 'SLEP_ESTABLECIMIENTO_PACKAGE')
 * - Cartera Territorial interoperable (array 'establecimientos')
 * - JSON genérico con datos de escuela
 */
export function normalizarPaqueteEstablecimiento(
  data: any,
  colegioDestinoDefault?: Establecimiento
): PaqueteEstablecimientoNormalizado {
  if (!data || typeof data !== 'object') {
    return {
      valido: false,
      error: 'El archivo está vacío o no contiene una estructura JSON válida.',
      establecimiento: {} as Establecimiento,
      periodo: 2026,
      salas: [],
      cursos: [],
      docentes: [],
      asistentes: [],
      asignaciones: []
    };
  }

  // Caso 1: Archivo de Cartera Territorial (múltiples colegios)
  if (Array.isArray(data.establecimientos) && data.establecimientos.length > 0) {
    const targetRbd = colegioDestinoDefault?.rbd;
    const est = data.establecimientos.find((e: any) => String(e.rbd) === String(targetRbd)) || data.establecimientos[0];
    const rbdStr = String(est.rbd);
    const periodo = Number(data.periodo) || 2026;

    const salas = Array.isArray(data.salas) ? data.salas.filter((s: any) => String(s.rbd) === rbdStr) : [];
    const cursos = Array.isArray(data.cursos) ? data.cursos.filter((c: any) => String(c.rbd) === rbdStr) : [];
    const docentes = Array.isArray(data.docentes) ? data.docentes.filter((d: any) => String(d.rbd) === rbdStr) : [];
    const asistentes = Array.isArray(data.asistentes) ? data.asistentes.filter((a: any) => String(a.rbd) === rbdStr) : [];
    const asignaciones = Array.isArray(data.asignaciones) ? data.asignaciones.filter((a: any) => String(a.rbd) === rbdStr) : [];

    return {
      valido: true,
      establecimiento: est,
      periodo,
      salas,
      cursos,
      docentes,
      asistentes,
      asignaciones,
      metadatos: {
        tipo: 'CARTERA_TERRITORIAL',
        version: data.version,
        fechaExportacion: data.fechaExportacion || data.timestamp,
        asesor: data.asesor
      }
    };
  }

  // Caso 2: Ficha individual de establecimiento (DOTACION_ESTABLECIMIENTO o SLEP_ESTABLECIMIENTO_PACKAGE)
  const est: Establecimiento | undefined = data.establecimiento || (data.rbd ? {
    id: `est-${data.rbd}`,
    rbd: String(data.rbd),
    nombre: data.nombre || `Colegio RBD ${data.rbd}`,
    comuna: data.comuna || 'Territorio SLEP',
    regimen: data.regimen || 'JEC',
    porcentajePrioritarios: data.porcentajePrioritarios || 75
  } : undefined);

  if (!est || !est.rbd) {
    return {
      valido: false,
      error: 'El archivo no contiene un establecimiento educacional reconocible (falta RBD o ficha de establecimiento).',
      establecimiento: {} as Establecimiento,
      periodo: 2026,
      salas: [],
      cursos: [],
      docentes: [],
      asistentes: [],
      asignaciones: []
    };
  }

  const periodo = Number(data.periodo) || 2026;
  const salas = Array.isArray(data.salas) ? data.salas : [];
  const cursos = Array.isArray(data.cursos) ? data.cursos : [];
  const docentes = Array.isArray(data.docentes) ? data.docentes : [];
  const asistentes = Array.isArray(data.asistentes) ? data.asistentes : [];
  const asignaciones = Array.isArray(data.asignaciones) ? data.asignaciones : [];

  return {
    valido: true,
    establecimiento: est,
    periodo,
    salas,
    cursos,
    docentes,
    asistentes,
    asignaciones,
    metadatos: {
      tipo: data.tipo || 'DOTACION_ESTABLECIMIENTO',
      formato: data.formato || 'SLEP_ESTABLECIMIENTO_PACKAGE',
      version: data.version || '2.0.0',
      fechaExportacion: data.fechaExportacion || data.timestamp,
      exportadoPor: data.exportadoPor || data.asesor?.nombre,
      asesor: data.asesor
    }
  };
}

/**
 * Exporta toda la dotación, infraestructura, cursos, docentes, asistentes y asignaciones de un establecimiento.
 */
export async function exportarPaqueteEstablecimiento(
  rbd: string,
  periodo: number = 2026,
  exportadoPor: string = 'UATP SLEP Valle Diguillín'
): Promise<EstablecimientoExportPackage> {
  const est = await obtenerEstablecimientoPorRbd(rbd);
  if (!est) {
    throw new Error(`Establecimiento con RBD ${rbd} no encontrado.`);
  }

  const db = await getDb();
  const salas = await listarSalas(rbd);
  const cursos = await listarCursos(rbd, periodo);
  const docentes = await listarDocentes(rbd, periodo);
  const asistentes = await listarAsistentes(db, rbd, periodo);
  const asignaciones = await listarAsignaciones(rbd, periodo);

  const totalHorasContrato = docentes.reduce((s, d) => s + (d.horasContrato || 0), 0);
  const totalHorasAsignadas = asignaciones.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
  const matriculaTotal = cursos.reduce((s, c) => s + (c.matriculaProyectada || 0), 0);

  const paqueteSinChecksum: Omit<EstablecimientoExportPackage, 'checksum'> = {
    formato: 'SLEP_ESTABLECIMIENTO_PACKAGE',
    tipo: 'DOTACION_ESTABLECIMIENTO',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    fechaExportacion: new Date().toISOString(),
    exportadoPor,
    periodo,
    establecimiento: est,
    salas,
    cursos,
    docentes,
    asistentes,
    asignaciones,
    resumenMetricas: {
      totalCursos: cursos.length,
      totalDocentes: docentes.length,
      totalSalas: salas.length,
      totalAsistentes: asistentes.length,
      totalHorasContrato,
      totalHorasAsignadas,
      matriculaTotal
    }
  };

  const payloadString = JSON.stringify({
    rbd: est.rbd,
    periodo,
    cursosCount: cursos.length,
    docentesCount: docentes.length,
    asistentesCount: asistentes.length
  });

  return {
    ...paqueteSinChecksum,
    checksum: generarChecksumSimple(payloadString)
  };
}

/**
 * Importa un paquete de dotación de establecimiento (.slep o .json) con selector
 * de período de destino y modo de integración (REEMPLAZAR o FUSIONAR).
 */
export async function importarPaqueteEstablecimiento(
  paqueteInput: any,
  targetRbd?: string,
  targetPeriodo?: number,
  modo: 'REEMPLAZAR' | 'FUSIONAR' = 'REEMPLAZAR'
): Promise<ImportEstablecimientoResult> {
  const paqueteNorm = normalizarPaqueteEstablecimiento(paqueteInput);
  if (!paqueteNorm.valido || !paqueteNorm.establecimiento) {
    throw new Error(paqueteNorm.error || 'El archivo no tiene el formato oficial de dotación escolar.');
  }

  const db = await getDb();
  const rbdFinal = (targetRbd || paqueteNorm.establecimiento.rbd).trim();
  const periodoFinal = Number(targetPeriodo) || paqueteNorm.periodo || 2026;
  const alertas: string[] = [];

  const estOriginal = paqueteNorm.establecimiento;
  const estDestino: Establecimiento = {
    ...estOriginal,
    id: `est-${rbdFinal}`,
    rbd: rbdFinal
  };

  const esOtroRbd = rbdFinal !== estOriginal.rbd;
  const esOtroPeriodo = Number(periodoFinal) !== Number(paqueteNorm.periodo);
  const reasignarIds = esOtroRbd || esOtroPeriodo;

  const salaIdMap = new Map<string, string>();
  const cursoIdMap = new Map<string, string>();
  const docenteIdMap = new Map<string, string>();

  try {
    // 1. Limpieza si el modo es REEMPLAZAR
    if (modo === 'REEMPLAZAR') {
      db.run(
        "DELETE FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))",
        [rbdFinal, periodoFinal, periodoFinal]
      );
      db.run(
        "DELETE FROM cursos_sae WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))",
        [rbdFinal, periodoFinal, periodoFinal]
      );
      db.run(
        "DELETE FROM docentes WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))",
        [rbdFinal, periodoFinal, periodoFinal]
      );
      db.run(
        "DELETE FROM asistentes_educacion WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))",
        [rbdFinal, periodoFinal, periodoFinal]
      );
      if (esOtroRbd) {
        db.run("DELETE FROM salas_infraestructura WHERE rbd = ?", [rbdFinal]);
      }
    }

    // 2. Guardar o actualizar la ficha del establecimiento
    await guardarEstablecimiento(estDestino);

    // 3. Mapear y guardar salas de infraestructura
    let salasCount = 0;
    for (const sala of (paqueteNorm.salas || [])) {
      let nuevaSalaId = sala.id;
      if (modo === 'FUSIONAR') {
        const existente = db.exec("SELECT id FROM salas_infraestructura WHERE rbd = ? AND nombre_sala = ?", [rbdFinal, sala.nombreSala]);
        if (existente.length && existente[0].values.length) {
          nuevaSalaId = String(existente[0].values[0][0]);
        } else if (esOtroRbd) {
          nuevaSalaId = `sala-${rbdFinal}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        }
      } else if (esOtroRbd) {
        nuevaSalaId = `sala-${rbdFinal}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      }

      salaIdMap.set(sala.id, nuevaSalaId);
      await guardarSala({
        ...sala,
        id: nuevaSalaId,
        rbd: rbdFinal
      });
      salasCount++;
    }

    // 4. Mapear y guardar cursos SAE
    let cursosCount = 0;
    for (const curso of (paqueteNorm.cursos || [])) {
      let nuevoCursoId = curso.id;
      const nivelLetraKey = `${(curso.nivel || '').trim().replace(/\s+/g, '')}-${(curso.letra || 'A').trim().toUpperCase()}`;

      if (modo === 'FUSIONAR') {
        const existente = db.exec(
          "SELECT id FROM cursos_sae WHERE rbd = ? AND periodo = ? AND nivel = ? AND letra = ?",
          [rbdFinal, periodoFinal, curso.nivel, curso.letra]
        );
        if (existente.length && existente[0].values.length) {
          nuevoCursoId = String(existente[0].values[0][0]);
        } else if (reasignarIds) {
          nuevoCursoId = `curso-${rbdFinal}-${periodoFinal}-${nivelLetraKey}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        }
      } else if (reasignarIds) {
        nuevoCursoId = `curso-${rbdFinal}-${periodoFinal}-${nivelLetraKey}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      }

      cursoIdMap.set(curso.id, nuevoCursoId);
      const salaMapeada = curso.salaId ? (salaIdMap.get(curso.salaId) || curso.salaId) : undefined;
      await guardarCurso({
        ...curso,
        id: nuevoCursoId,
        rbd: rbdFinal,
        periodo: periodoFinal,
        salaId: salaMapeada
      });
      cursosCount++;
    }

    // 5. Mapear y guardar docentes
    const docentesMapeados: Docente[] = [];
    for (const doc of (paqueteNorm.docentes || [])) {
      let nuevoDocId = doc.id;
      const docRun = normalizarRut(doc.run);
      if (modo === 'FUSIONAR') {
        const existente = db.exec(
          "SELECT id FROM docentes WHERE rbd = ? AND run = ? AND periodo = ?",
          [rbdFinal, docRun, periodoFinal]
        );
        if (existente.length && existente[0].values.length) {
          nuevoDocId = String(existente[0].values[0][0]);
        } else if (reasignarIds) {
          nuevoDocId = `doc-${rbdFinal}-${periodoFinal}-${docRun.replace(/[^0-9kK]/g, '')}`;
        }
      } else if (reasignarIds) {
        nuevoDocId = `doc-${rbdFinal}-${periodoFinal}-${docRun.replace(/[^0-9kK]/g, '')}`;
      }

      docenteIdMap.set(doc.id, nuevoDocId);
      docentesMapeados.push({
        ...doc,
        id: nuevoDocId,
        rbd: rbdFinal,
        periodo: periodoFinal
      });
    }
    if (docentesMapeados.length > 0) {
      await guardarDocentesBatch(docentesMapeados);
    }

    // 6. Mapear y guardar asistentes de la educación
    let asistentesCount = 0;
    const asistentesMapeados: AsistenteEducacion[] = [];
    for (const ast of (paqueteNorm.asistentes || [])) {
      let nuevoAstId = ast.id;
      const astRun = normalizarRut(ast.run);
      if (modo === 'FUSIONAR') {
        const existente = db.exec(
          "SELECT id FROM asistentes_educacion WHERE rbd = ? AND run = ? AND periodo = ?",
          [rbdFinal, astRun, periodoFinal]
        );
        if (existente.length && existente[0].values.length) {
          nuevoAstId = String(existente[0].values[0][0]);
        } else if (reasignarIds) {
          nuevoAstId = `ast-${rbdFinal}-${periodoFinal}-${astRun.replace(/[^0-9kK]/g, '')}`;
        }
      } else if (reasignarIds) {
        nuevoAstId = `ast-${rbdFinal}-${periodoFinal}-${astRun.replace(/[^0-9kK]/g, '')}`;
      }

      asistentesMapeados.push({
        ...ast,
        id: nuevoAstId,
        rbd: rbdFinal,
        periodo: periodoFinal
      });
      asistentesCount++;
    }
    if (asistentesMapeados.length > 0) {
      await guardarAsistentesBatch(asistentesMapeados, rbdFinal, periodoFinal, false);
    }

    // 7. Mapear y guardar asignaciones horarias
    const asignacionesMapeadas: AsignacionHoraria[] = [];
    for (const asig of (paqueteNorm.asignaciones || [])) {
      const nuevoCursoId = cursoIdMap.get(asig.cursoId) || asig.cursoId;
      const nuevoDocId = docenteIdMap.get(asig.docenteId) || asig.docenteId;
      const nuevoCoDocId = asig.coDocenteId ? (docenteIdMap.get(asig.coDocenteId) || asig.coDocenteId) : undefined;
      const nuevaAsigId = reasignarIds ? `asig-${rbdFinal}-${periodoFinal}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` : asig.id;

      asignacionesMapeadas.push({
        ...asig,
        id: nuevaAsigId,
        rbd: rbdFinal,
        periodo: periodoFinal,
        cursoId: nuevoCursoId,
        docenteId: nuevoDocId,
        coDocenteId: nuevoCoDocId
      });
    }
    if (asignacionesMapeadas.length > 0) {
      await guardarAsignacionesBatch(asignacionesMapeadas);
    }

    await persistDb(true);

    return {
      exito: true,
      rbdDestino: rbdFinal,
      nombreColegio: estDestino.nombre,
      periodoDestino: periodoFinal,
      salasImportadas: salasCount,
      cursosImportados: cursosCount,
      docentesImportados: docentesMapeados.length,
      asistentesImportados: asistentesCount,
      asignacionesImportadas: asignacionesMapeadas.length,
      modoAplicado: modo,
      alertas
    };
  } catch (err: any) {
    console.error('Error durante la importación del paquete:', err);
    return {
      exito: false,
      rbdDestino: rbdFinal,
      nombreColegio: estDestino.nombre,
      periodoDestino: periodoFinal,
      salasImportadas: 0,
      cursosImportados: 0,
      docentesImportados: 0,
      asistentesImportados: 0,
      asignacionesImportadas: 0,
      modoAplicado: modo,
      alertas,
      error: err?.message || 'Error durante la importación del paquete.'
    };
  }
}
