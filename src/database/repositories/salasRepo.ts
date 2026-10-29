import { SalaInfraestructura } from '../../types';
import { getDb, persistDb } from '../dbCore';
import { FirebaseDotacionService } from '../../services/firebaseDotacionService';

export async function listarSalas(rbd: string): Promise<SalaInfraestructura[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, pabellon, nombre_sala, superficie_m2, tipo, aforo_maximo FROM salas_infraestructura WHERE rbd = ?", [rbd]);
  if (!res.length) return [];
  return res[0].values.map(row => ({
    id: String(row[0]),
    rbd: String(row[1]),
    pabellon: row[2] ? String(row[2]) : undefined,
    nombreSala: String(row[3]),
    superficieM2: Number(row[4]),
    tipo: row[5] as any,
    aforoMaximo: Number(row[6])
  }));
}

export async function listarTodasLasSalas(): Promise<SalaInfraestructura[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, pabellon, nombre_sala, superficie_m2, tipo, aforo_maximo FROM salas_infraestructura");
  if (!res.length) return [];
  return res[0].values.map(row => ({
    id: String(row[0]),
    rbd: String(row[1]),
    pabellon: row[2] ? String(row[2]) : undefined,
    nombreSala: String(row[3]),
    superficieM2: Number(row[4]),
    tipo: row[5] as any,
    aforoMaximo: Number(row[6])
  }));
}

export async function guardarSala(s: SalaInfraestructura): Promise<void> {
  const db = await getDb();
  db.run(`
    INSERT INTO salas_infraestructura (id, rbd, pabellon, nombre_sala, superficie_m2, tipo, aforo_maximo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      pabellon=excluded.pabellon, nombre_sala=excluded.nombre_sala,
      superficie_m2=excluded.superficie_m2, tipo=excluded.tipo, aforo_maximo=excluded.aforo_maximo;
  `, [s.id, s.rbd, s.pabellon || null, s.nombreSala, s.superficieM2, s.tipo, s.aforoMaximo]);
  persistDb();
  FirebaseDotacionService.guardarSala(s).catch(err =>
    console.warn('[salasRepo] Aviso sincronizando con Firestore:', err)
  );
}

export async function eliminarSala(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM salas_infraestructura WHERE id = ?", [id]);
  persistDb();
  FirebaseDotacionService.eliminarSala(id).catch(err =>
    console.warn('[salasRepo] Aviso eliminando en Firestore:', err)
  );
}