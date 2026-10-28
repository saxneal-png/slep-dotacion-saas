import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { firestore } from './firebaseConfig';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria } from '../types';

/**
 * Servicio de sincronización y persistencia con Google Cloud Firestore
 * Proyecto: dotacionslep (1042724678573)
 */
export class FirebaseDotacionService {
  /**
   * Guarda o actualiza un establecimiento educacional
   */
  static async guardarEstablecimiento(est: Establecimiento): Promise<void> {
    const ref = doc(firestore, 'establecimientos', est.rbd);
    await setDoc(ref, est, { merge: true });
  }

  /**
   * Obtiene todos los establecimientos registrados
   */
  static async obtenerEstablecimientos(): Promise<Establecimiento[]> {
    const colRef = collection(firestore, 'establecimientos');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => d.data() as Establecimiento);
  }

  /**
   * Obtiene la dotación completa de un RBD y Periodo desde Firestore
   */
  static async obtenerDotacionColegio(rbd: string, periodo: number = 2027) {
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

    return { establecimiento, cursos, docentes, asignaciones };
  }

  /**
   * Guarda en lote (Batch) toda la dotación de un colegio en Firestore
   */
  static async guardarDotacionBatch(
    rbd: string,
    periodo: number,
    cursos: CursoSae[],
    docentes: Docente[],
    asignaciones: AsignacionHoraria[]
  ): Promise<void> {
    const batch = writeBatch(firestore);

    // Guardar Cursos
    for (const c of cursos) {
      const ref = doc(firestore, 'cursos', c.id);
      batch.set(ref, { ...c, rbd, periodo }, { merge: true });
    }

    // Guardar Docentes
    for (const d of docentes) {
      const ref = doc(firestore, 'docentes', d.id);
      batch.set(ref, { ...d, rbd, periodo }, { merge: true });
    }

    // Guardar Asignaciones
    for (const a of asignaciones) {
      const ref = doc(firestore, 'asignaciones', a.id);
      batch.set(ref, { ...a, rbd, periodo }, { merge: true });
    }

    await batch.commit();
  }
}
