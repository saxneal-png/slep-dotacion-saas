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
}
