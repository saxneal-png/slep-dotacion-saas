import { Establecimiento, SalaInfraestructura, CursoSae, Docente, AsignacionHoraria } from '../../types';
import { getDb, persistDb } from '../dbCore';
import { guardarEstablecimiento, obtenerEstablecimientoPorRbd } from './establecimientosRepo';
import { listarSalas, guardarSala } from './salasRepo';
import { listarCursos, guardarCurso } from './cursosRepo';
import { listarDocentes, guardarDocentesBatch } from './docentesRepo';
import { listarAsignaciones, guardarAsignacionesBatch } from './asignacionesRepo';

export interface EstablecimientoExportPackage {
  formato: 'SLEP_ESTABLECIMIENTO_PACKAGE';
  version: '2.0.0';
  timestamp: string;
  exportadoPor: string;
  periodo: number;
  establecimiento: Establecimiento;
  salas: SalaInfraestructura[];
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  resumenMetricas: {
    totalCursos: number;
    totalDocentes: number;
    totalSalas: number;
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
  asignacionesImportadas: number;
  modoAplicado: 'REEMPLAZAR' | 'FUSIONAR';
  alertas: string[];
  error?: string;
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
 * Exporta toda la dotación, infraestructura, cursos, docentes y asignaciones de un establecimiento específico.
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

  const salas = await listarSalas(rbd);
  const cursos = await listarCursos(rbd, periodo);
  const docentes = await listarDocentes(rbd, periodo);
  const asignaciones = await listarAsignaciones(rbd, periodo);

  const totalHorasContrato = docentes.reduce((s, d) => s + (d.horasContrato || 0), 0);
  const totalHorasAsignadas = asignaciones.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
  const matriculaTotal = cursos.reduce((s, c) => s + (c.matriculaProyectada || 0), 0);

  const paqueteSinChecksum: Omit<EstablecimientoExportPackage, 'checksum'> = {
    formato: 'SLEP_ESTABLECIMIENTO_PACKAGE',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    exportadoPor,
    periodo,
    establecimiento: est,
    salas,
    cursos,
    docentes,
    asignaciones,
    resumenMetricas: {
      totalCursos: cursos.length,
      totalDocentes: docentes.length,
      totalSalas: salas.length,
      totalHorasContrato,
      totalHorasAsignadas,
      matriculaTotal
    }
  };

  const payloadString = JSON.stringify({
    rbd: est.rbd,
    periodo,
    cursosCount: cursos.length,
    docentesCount: docentes.length
  });

  return {
    ...paqueteSinChecksum,
    checksum: generarChecksumSimple(payloadString)
  };
}

/**
 * Importa un paquete de establecimiento con selector de RBD de destino y modo de reemplazo o fusión.
 */
export async function importarPaqueteEstablecimiento(
  paquete: EstablecimientoExportPackage,
  targetRbd?: string,
  targetPeriodo?: number,
  modo: 'REEMPLAZAR' | 'FUSIONAR' = 'REEMPLAZAR'
): Promise<ImportEstablecimientoResult> {
  if (!paquete || paquete.formato !== 'SLEP_ESTABLECIMIENTO_PACKAGE') {
    throw new Error('El archivo no tiene el formato oficial SLEP_ESTABLECIMIENTO_PACKAGE.');
  }

  const db = await getDb();
  const rbdFinal = (targetRbd || paquete.establecimiento.rbd).trim();
  const periodoFinal = targetPeriodo || paquete.periodo || 2026;
  const alertas: string[] = [];

  const estOriginal = paquete.establecimiento;
  const estDestino: Establecimiento = {
    ...estOriginal,
    id: `est-${rbdFinal}`,
    rbd: rbdFinal
  };

  const esOtroRbd = rbdFinal !== estOriginal.rbd;
  const salaIdMap = new Map<string, string>();
  const cursoIdMap = new Map<string, string>();
  const docenteIdMap = new Map<string, string>();

  db.run("BEGIN TRANSACTION;");
  try {
    if (modo === 'REEMPLAZAR') {
      db.run("DELETE FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbdFinal, periodoFinal, periodoFinal]);
      db.run("DELETE FROM cursos_sae WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbdFinal, periodoFinal, periodoFinal]);
      db.run("DELETE FROM docentes WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbdFinal, periodoFinal, periodoFinal]);
      if (esOtroRbd) {
        db.run("DELETE FROM salas_infraestructura WHERE rbd = ?", [rbdFinal]);
      }
    }

    await guardarEstablecimiento(estDestino);

    let salasCount = 0;
    for (const sala of (paquete.salas || [])) {
      const nuevaSalaId = esOtroRbd ? `sala-${rbdFinal}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` : sala.id;
      salaIdMap.set(sala.id, nuevaSalaId);
      await guardarSala({
        ...sala,
        id: nuevaSalaId,
        rbd: rbdFinal
      });
      salasCount++;
    }

    let cursosCount = 0;
    for (const curso of (paquete.cursos || [])) {
      const nuevoCursoId = esOtroRbd ? `curso-${rbdFinal}-${periodoFinal}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` : curso.id;
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

    const docentesMapeados: Docente[] = [];
    for (const doc of (paquete.docentes || [])) {
      const nuevoDocId = esOtroRbd ? `doc-${rbdFinal}-${periodoFinal}-${doc.run.replace(/[^0-9kK]/g, '')}` : doc.id;
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

    const asignacionesMapeadas: AsignacionHoraria[] = [];
    for (const asig of (paquete.asignaciones || [])) {
      const nuevoCursoId = cursoIdMap.get(asig.cursoId) || asig.cursoId;
      const nuevoDocId = docenteIdMap.get(asig.docenteId) || asig.docenteId;
      const nuevoCoDocId = asig.coDocenteId ? (docenteIdMap.get(asig.coDocenteId) || asig.coDocenteId) : undefined;
      const nuevaAsigId = esOtroRbd ? `asig-${rbdFinal}-${periodoFinal}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` : asig.id;

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

    db.run("COMMIT;");
    persistDb();

    return {
      exito: true,
      rbdDestino: rbdFinal,
      nombreColegio: estDestino.nombre,
      periodoDestino: periodoFinal,
      salasImportadas: salasCount,
      cursosImportados: cursosCount,
      docentesImportados: docentesMapeados.length,
      asignacionesImportadas: asignacionesMapeadas.length,
      modoAplicado: modo,
      alertas
    };
  } catch (err: any) {
    db.run("ROLLBACK;");
    return {
      exito: false,
      rbdDestino: rbdFinal,
      nombreColegio: estDestino.nombre,
      periodoDestino: periodoFinal,
      salasImportadas: 0,
      cursosImportados: 0,
      docentesImportados: 0,
      asignacionesImportadas: 0,
      modoAplicado: modo,
      alertas,
      error: err?.message || 'Error durante la importación atómica.'
    };
  }
}
