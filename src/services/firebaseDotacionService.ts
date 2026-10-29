import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { firestore } from './firebaseConfig';
import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria,
  AsistenteEducacion
} from '../types';

/**
 * Elimina propiedades con valor `undefined` para evitar que el SDK de Firestore lance errores.
 */
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export function isCloudSyncEnabled(): boolean {
  if (typeof window === 'undefined' || !firestore) return false;
  if (typeof process !== 'undefined' && (process.env as any)?.VITEST) return false;
  return true;
}

/**
 * Servicio de sincronización y persistencia con Google Cloud Firestore
 * Proyecto: dotacionslep (1042724678573)
 */
export class FirebaseDotacionService {
  /**
   * Guarda o actualiza un establecimiento educacional
   */
  static async guardarEstablecimiento(est: Establecimiento): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    const ref = doc(firestore, 'establecimientos', est.rbd.trim());
    await setDoc(ref, sanitizeForFirestore({ ...est, rbd: est.rbd.trim() }), { merge: true });
  }

  /**
   * Guarda un lote de establecimientos en Firestore (writeBatch en bloques de 400)
   */
  static async guardarEstablecimientosBatch(establecimientos: Establecimiento[]): Promise<void> {
    if (!isCloudSyncEnabled() || !establecimientos.length) return;
    const chunkSize = 400;
    for (let i = 0; i < establecimientos.length; i += chunkSize) {
      const chunk = establecimientos.slice(i, i + chunkSize);
      const batch = writeBatch(firestore);
      for (const est of chunk) {
        const ref = doc(firestore, 'establecimientos', est.rbd.trim());
        batch.set(ref, sanitizeForFirestore({ ...est, rbd: est.rbd.trim() }), { merge: true });
      }
      await batch.commit();
    }
  }

  static async eliminarEstablecimiento(idOrRbd: string): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    const clean = idOrRbd.replace(/^est-/, '').trim();
    await deleteDoc(doc(firestore, 'establecimientos', clean));
  }

  /**
   * Obtiene todos los establecimientos registrados en Firestore
   */
  static async obtenerEstablecimientos(): Promise<Establecimiento[]> {
    if (!isCloudSyncEnabled()) return [];
    const colRef = collection(firestore, 'establecimientos');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => d.data() as Establecimiento);
  }

  static async guardarSala(sala: SalaInfraestructura): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    const ref = doc(firestore, 'salas', sala.id);
    await setDoc(ref, sanitizeForFirestore(sala), { merge: true });
  }

  static async eliminarSala(id: string): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    await deleteDoc(doc(firestore, 'salas', id));
  }

  static async guardarCurso(curso: CursoSae): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    const ref = doc(firestore, 'cursos', curso.id);
    await setDoc(ref, sanitizeForFirestore({ ...curso, periodo: curso.periodo || 2026 }), { merge: true });
  }

  static async eliminarCurso(id: string): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    await deleteDoc(doc(firestore, 'cursos', id));
  }

  static async guardarDocente(docente: Docente): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    const ref = doc(firestore, 'docentes', docente.id);
    await setDoc(ref, sanitizeForFirestore({ ...docente, periodo: docente.periodo || 2026 }), { merge: true });
  }

  static async guardarDocentesBatch(docentes: Docente[]): Promise<void> {
    if (!isCloudSyncEnabled() || !docentes.length) return;
    const chunkSize = 400;
    for (let i = 0; i < docentes.length; i += chunkSize) {
      const chunk = docentes.slice(i, i + chunkSize);
      const batch = writeBatch(firestore);
      for (const d of chunk) {
        const ref = doc(firestore, 'docentes', d.id);
        batch.set(ref, sanitizeForFirestore({ ...d, periodo: d.periodo || 2026 }), { merge: true });
      }
      await batch.commit();
    }
  }

  static async eliminarDocente(id: string): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    await deleteDoc(doc(firestore, 'docentes', id));
  }

  static async guardarAsignacion(asignacion: AsignacionHoraria): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    const ref = doc(firestore, 'asignaciones', asignacion.id);
    await setDoc(ref, sanitizeForFirestore({ ...asignacion, periodo: asignacion.periodo || 2026 }), { merge: true });
  }

  static async guardarAsignacionesBatch(asignaciones: AsignacionHoraria[]): Promise<void> {
    if (!isCloudSyncEnabled() || !asignaciones.length) return;
    const chunkSize = 400;
    for (let i = 0; i < asignaciones.length; i += chunkSize) {
      const chunk = asignaciones.slice(i, i + chunkSize);
      const batch = writeBatch(firestore);
      for (const a of chunk) {
        const ref = doc(firestore, 'asignaciones', a.id);
        batch.set(ref, sanitizeForFirestore({ ...a, periodo: a.periodo || 2026 }), { merge: true });
      }
      await batch.commit();
    }
  }

  static async eliminarAsignacion(id: string): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    await deleteDoc(doc(firestore, 'asignaciones', id));
  }

  static async guardarAsistente(asistente: AsistenteEducacion): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    const ref = doc(firestore, 'asistentes', asistente.id);
    await setDoc(ref, sanitizeForFirestore({ ...asistente, periodo: asistente.periodo || 2026 }), { merge: true });
  }

  static async guardarAsistentesBatch(asistentes: AsistenteEducacion[]): Promise<void> {
    if (!isCloudSyncEnabled() || !asistentes.length) return;
    const chunkSize = 400;
    for (let i = 0; i < asistentes.length; i += chunkSize) {
      const chunk = asistentes.slice(i, i + chunkSize);
      const batch = writeBatch(firestore);
      for (const a of chunk) {
        const ref = doc(firestore, 'asistentes', a.id);
        batch.set(ref, sanitizeForFirestore({ ...a, periodo: a.periodo || 2026 }), { merge: true });
      }
      await batch.commit();
    }
  }

  static async eliminarAsistente(id: string): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    await deleteDoc(doc(firestore, 'asistentes', id));
  }

  /**
   * Obtiene la dotación completa de un RBD y Periodo desde Firestore
   */
  static async obtenerDotacionColegio(rbd: string, periodo: number = 2027) {
    if (!isCloudSyncEnabled()) {
      return { establecimiento: null, cursos: [], docentes: [], asignaciones: [], asistentes: [] };
    }
    // 1. Colegio
    const estRef = doc(firestore, 'establecimientos', rbd);
    const estSnap = await getDoc(estRef);
    const establecimiento = estSnap.exists() ? (estSnap.data() as Establecimiento) : null;

    // 2. Cursos
    const cursosRef = collection(firestore, 'cursos');
    const qCursos = query(cursosRef, where('rbd', '==', rbd), where('periodo', '==', periodo));
    const cursosSnap = await getDocs(qCursos);
    const cursos = cursosSnap.docs.map(d => d.data() as CursoSae);

    // 3. Docentes
    const docentesRef = collection(firestore, 'docentes');
    const qDoc = query(docentesRef, where('rbd', '==', rbd), where('periodo', '==', periodo));
    const docSnap = await getDocs(qDoc);
    const docentes = docSnap.docs.map(d => d.data() as Docente);

    // 4. Asignaciones
    const asigRef = collection(firestore, 'asignaciones');
    const qAsig = query(asigRef, where('rbd', '==', rbd), where('periodo', '==', periodo));
    const asigSnap = await getDocs(qAsig);
    const asignaciones = asigSnap.docs.map(d => d.data() as AsignacionHoraria);

    // 5. Asistentes
    const asistRef = collection(firestore, 'asistentes');
    const qAsist = query(asistRef, where('rbd', '==', rbd), where('periodo', '==', periodo));
    const asistSnap = await getDocs(qAsist);
    const asistentes = asistSnap.docs.map(d => d.data() as AsistenteEducacion);

    return { establecimiento, cursos, docentes, asignaciones, asistentes };
  }

  /**
   * Guarda en lote (Batch) toda la dotación de un colegio en Firestore
   */
  static async guardarDotacionBatch(
    rbd: string,
    periodo: number,
    cursos: CursoSae[],
    docentes: Docente[],
    asignaciones: AsignacionHoraria[],
    asistentes: AsistenteEducacion[] = []
  ): Promise<void> {
    if (!isCloudSyncEnabled()) return;
    const ops: Array<{ col: string; id: string; data: Record<string, any> }> = [];

    for (const c of cursos) {
      ops.push({ col: 'cursos', id: c.id, data: sanitizeForFirestore({ ...c, rbd, periodo }) });
    }
    for (const d of docentes) {
      ops.push({ col: 'docentes', id: d.id, data: sanitizeForFirestore({ ...d, rbd, periodo }) });
    }
    for (const a of asignaciones) {
      ops.push({ col: 'asignaciones', id: a.id, data: sanitizeForFirestore({ ...a, rbd, periodo }) });
    }
    for (const ast of asistentes) {
      ops.push({ col: 'asistentes', id: ast.id, data: sanitizeForFirestore({ ...ast, rbd, periodo }) });
    }

    const chunkSize = 400;
    for (let i = 0; i < ops.length; i += chunkSize) {
      const chunk = ops.slice(i, i + chunkSize);
      const batch = writeBatch(firestore);
      for (const item of chunk) {
        const ref = doc(firestore, item.col, item.id);
        batch.set(ref, item.data, { merge: true });
      }
      await batch.commit();
    }
  }

  /**
   * Sincroniza y vuelca toda la base de datos local SQLite y catálogo de directores hacia Cloud Firestore en lotes eficientes.
   * Crea las colecciones: 'usuarios', 'establecimientos', 'cursos', 'docentes', 'asignaciones', 'asistentes', 'salas'.
   */
  static async sincronizarTodaLaBaseDeDatosAFirestore(): Promise<{
    usuariosSincronizados: number;
    establecimientosSincronizados: number;
    cursosSincronizados: number;
    docentesSincronizados: number;
    asignacionesSincronizados: number;
    asistentesSincronizados: number;
    salasSincronizadas: number;
  }> {
    if (!isCloudSyncEnabled()) {
      throw new Error('La sincronización en la nube no está disponible en este entorno.');
    }

    const { getDb } = await import('../database/dbCore');
    const { listarEstablecimientos } = await import('../database/repositories/establecimientosRepo');
    const { listarTodasLasSalas } = await import('../database/repositories/salasRepo');
    const { listarTodosLosCursos } = await import('../database/repositories/cursosRepo');
    const { listarTodosLosDocentesTerritorio } = await import('../database/repositories/docentesRepo');
    const { listarTodasLasAsignaciones } = await import('../database/repositories/asignacionesRepo');
    const { listarTodosLosAsistentesTerritorio } = await import('../database/repositories/asistentesRepo');
    const { listarUsuariosDb } = await import('../database/repositories/usuariosRepo');
    const { AuthService } = await import('./authService');
    const { DIRECTORES_TERRITORIO } = await import('../data/directoresTerritorio');

    // 1. Asegurar usuarios y directores
    await AuthService.generarUsuariosDirectoresMasivo(DIRECTORES_TERRITORIO, '12346');
    const usuarios = await listarUsuariosDb();

    // 2. Extraer datos de SQLite
    const establecimientos = await listarEstablecimientos();
    const salas = await listarTodasLasSalas();
    const cursos2026 = await listarTodosLosCursos(2026);
    const cursos2027 = await listarTodosLosCursos(2027);
    const todosCursos = [...cursos2026, ...cursos2027.filter(c27 => !cursos2026.some(c26 => c26.id === c27.id))];

    const docentes2026 = await listarTodosLosDocentesTerritorio(2026);
    const docentes2027 = await listarTodosLosDocentesTerritorio(2027);
    const todosDocentes = [...docentes2026, ...docentes2027.filter(d27 => !docentes2026.some(d26 => d26.id === d27.id))];

    const asigs2026 = await listarTodasLasAsignaciones(2026);
    const asigs2027 = await listarTodasLasAsignaciones(2027);
    const todasAsigs = [...asigs2026, ...asigs2027.filter(a27 => !asigs2026.some(a26 => a26.id === a27.id))];

    const db = await getDb();
    const ast2026 = await listarTodosLosAsistentesTerritorio(db, 2026);
    const ast2027 = await listarTodosLosAsistentesTerritorio(db, 2027);
    const todosAst = [...ast2026, ...ast2027.filter(a27 => !ast2026.some(a26 => a26.id === a27.id))];

    // 3. Subir en bloques (writeBatch) a Firestore
    const subirColeccion = async (colName: string, items: Array<{ id: string; [k: string]: any }>) => {
      const chunkSize = 400;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = writeBatch(firestore);
        for (const item of chunk) {
          const docRef = doc(firestore, colName, item.id);
          batch.set(docRef, sanitizeForFirestore(item), { merge: true });
        }
        await batch.commit();
      }
    };

    // Colección: usuarios
    await subirColeccion('usuarios', usuarios.map(u => ({
      id: u.id,
      email: u.email,
      username: u.username,
      nombreCompleto: u.nombreCompleto,
      rol: u.role,
      cargo: u.cargo,
      rbdAsignado: u.rbdAsignado,
      carteraRbds: u.carteraRbds || [],
      asesoresSupervisados: u.asesoresSupervisados || [],
      passwordHash: u.passwordHash,
      salt: u.salt,
      activo: u.activo !== false,
      actualizadoEn: new Date().toISOString()
    })));

    // Colección: establecimientos
    await subirColeccion('establecimientos', establecimientos.map(e => ({
      ...e,
      id: e.rbd.trim()
    })));

    // Colección: salas
    await subirColeccion('salas', salas);

    // Colección: cursos
    await subirColeccion('cursos', todosCursos);

    // Colección: docentes
    await subirColeccion('docentes', todosDocentes);

    // Colección: asignaciones
    await subirColeccion('asignaciones', todasAsigs);

    // Colección: asistentes
    await subirColeccion('asistentes', todosAst);

    return {
      usuariosSincronizados: usuarios.length,
      establecimientosSincronizados: establecimientos.length,
      cursosSincronizados: todosCursos.length,
      docentesSincronizados: todosDocentes.length,
      asignacionesSincronizados: todasAsigs.length,
      asistentesSincronizados: todosAst.length,
      salasSincronizadas: salas.length
    };
  }
}
