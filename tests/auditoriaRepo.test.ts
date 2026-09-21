import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, registrarEventoAuditoria, listarEventosAuditoria } from '../src/database/db';

describe('Repositorio de Auditoría y Trazabilidad SQLite', () => {
  beforeAll(async () => {
    await getDb();
  });

  it('registra y recupera eventos de auditoría para un establecimiento', async () => {
    const rbdPrueba = '99999';
    await registrarEventoAuditoria({
      rbd: rbdPrueba,
      periodo: 2026,
      tipoEvento: 'CREACION',
      entidad: 'DOCENTE',
      entidadId: 'doc_123',
      descripcion: 'Alta de docente Juan Pérez (44 hrs Titular)',
      detalles: { run: '12.345.678-9', horas: 44, calidad: 'TITULAR' }
    });

    await registrarEventoAuditoria({
      rbd: rbdPrueba,
      periodo: 2026,
      tipoEvento: 'ACTUALIZACION',
      entidad: 'ASIGNACION',
      entidadId: 'asig_456',
      descripcion: 'Asignación de 6 hrs Matemática en 1° Básico A',
      detalles: { horas: 6, asignatura: 'Matemática' }
    });

    const eventos = await listarEventosAuditoria(rbdPrueba, 2026);
    expect(eventos.length).toBeGreaterThanOrEqual(2);
    expect(eventos[0].descripcion).toContain('Asignación');
    expect(eventos[1].descripcion).toContain('Alta de docente');
    expect(eventos[0].tipoEvento).toBe('ACTUALIZACION');
  });
});
