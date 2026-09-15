import { PlanEstudioNivel } from '@slep/mineduc-engine';
import { PLANES_MINEDUC } from '@slep/mineduc-engine';
import { getDb, persistDb } from '../dbCore';
import { Database } from 'sql.js';

export interface PlanEstudioRegistroDb {
  id: string;
  nivel: string;
  regimen: 'JEC' | 'No JEC';
  categoria?: 'BASICA' | 'MEDIA_HC' | 'MEDIA_TP' | 'PARVULARIA' | 'EPJA' | 'MULTIGRADO';
  referenciaFuente?: string;
  horasObligatorias: number;
  horasLibreDisposicion: number;
  totalHorasPlan: number;
  asignaturas: { nombre: string; horasSugeridas: number }[];
}

export async function listarPlanesEstudio(categoriaFiltro?: string): Promise<PlanEstudioRegistroDb[]> {
  const db = await getDb();
  let sql = "SELECT id, nivel, regimen, categoria, referencia_fuente, horas_obligatorias, horas_libre_disposicion, total_horas_plan, asignaturas_json FROM planes_estudio_mineduc";
  const params: any[] = [];

  if (categoriaFiltro) {
    sql += " WHERE categoria = ?";
    params.push(categoriaFiltro);
  }
  sql += " ORDER BY categoria, nivel, regimen";

  const res = db.exec(sql, params);
  if (!res.length) return [];

  return res[0].values.map(row => {
    let asignaturas = [];
    if (row[8]) {
      try { asignaturas = JSON.parse(String(row[8])); } catch (_) {}
    }
    return {
      id: String(row[0]),
      nivel: String(row[1]),
      regimen: row[2] as 'JEC' | 'No JEC',
      categoria: row[3] ? (row[3] as any) : undefined,
      referenciaFuente: row[4] ? String(row[4]) : undefined,
      horasObligatorias: Number(row[5]),
      horasLibreDisposicion: Number(row[6]),
      totalHorasPlan: Number(row[7]),
      asignaturas
    };
  });
}

export async function obtenerPlanEstudioPorNivelYRegimen(nivel: string, regimen: 'JEC' | 'No JEC' | 'NO_JEC' = 'JEC'): Promise<PlanEstudioRegistroDb | null> {
  const db = await getDb();
  const regNorm = (regimen === 'NO_JEC' || regimen === 'No JEC') ? 'No JEC' : 'JEC';
  const res = db.exec(
    "SELECT id, nivel, regimen, categoria, referencia_fuente, horas_obligatorias, horas_libre_disposicion, total_horas_plan, asignaturas_json FROM planes_estudio_mineduc WHERE nivel = ? AND regimen = ?",
    [nivel, regNorm]
  );
  if (!res.length || !res[0].values.length) return null;

  const row = res[0].values[0];
  let asignaturas = [];
  if (row[8]) {
    try { asignaturas = JSON.parse(String(row[8])); } catch (_) {}
  }
  return {
    id: String(row[0]),
    nivel: String(row[1]),
    regimen: row[2] as 'JEC' | 'No JEC',
    categoria: row[3] ? (row[3] as any) : undefined,
    referenciaFuente: row[4] ? String(row[4]) : undefined,
    horasObligatorias: Number(row[5]),
    horasLibreDisposicion: Number(row[6]),
    totalHorasPlan: Number(row[7]),
    asignaturas
  };
}

export async function guardarPlanEstudio(plan: PlanEstudioRegistroDb): Promise<void> {
  const db = await getDb();
  const asigsJson = JSON.stringify(plan.asignaturas || []);
  db.run(
    `INSERT INTO planes_estudio_mineduc (id, nivel, regimen, categoria, referencia_fuente, horas_obligatorias, horas_libre_disposicion, total_horas_plan, asignaturas_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      nivel=excluded.nivel,
      regimen=excluded.regimen,
      categoria=excluded.categoria,
      referencia_fuente=excluded.referencia_fuente,
      horas_obligatorias=excluded.horas_obligatorias,
      horas_libre_disposicion=excluded.horas_libre_disposicion,
      total_horas_plan=excluded.total_horas_plan,
      asignaturas_json=excluded.asignaturas_json;`,
    [
      plan.id,
      plan.nivel,
      plan.regimen,
      plan.categoria || null,
      plan.referenciaFuente || null,
      plan.horasObligatorias,
      plan.horasLibreDisposicion,
      plan.totalHorasPlan,
      asigsJson
    ]
  );
  persistDb();
}

export function poblarPlanesEstudioEnDb(db: Database): void {
  for (const p of PLANES_MINEDUC) {
    const id = `${p.nivel}_${p.regimen}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const asigsJson = JSON.stringify(p.asignaturasBase || []);
    db.run(
      `INSERT INTO planes_estudio_mineduc (id, nivel, regimen, categoria, referencia_fuente, horas_obligatorias, horas_libre_disposicion, total_horas_plan, asignaturas_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        nivel=excluded.nivel,
        regimen=excluded.regimen,
        categoria=excluded.categoria,
        referencia_fuente=excluded.referencia_fuente,
        horas_obligatorias=excluded.horas_obligatorias,
        horas_libre_disposicion=excluded.horas_libre_disposicion,
        total_horas_plan=excluded.total_horas_plan,
        asignaturas_json=excluded.asignaturas_json;`,
      [
        id,
        p.nivel,
        p.regimen,
        p.categoria || null,
        p.referenciaFuente || null,
        p.horasObligatorias,
        p.horasLibreDisposicion,
        p.totalHorasPlan,
        asigsJson
      ]
    );
  }
}
