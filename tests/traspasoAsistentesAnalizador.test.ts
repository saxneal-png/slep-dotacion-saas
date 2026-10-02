import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, reiniciarTodaLaBaseDatos } from '../src/database/dbCore';
import { ejecutarTraspasoDotacionAnalizador } from '../src/database/repositories/traspasoRepo';
import { listarAsistentes } from '../src/database/repositories/asistentesRepo';
import type { TraspasoConfig, SchoolSummary, TeacherRecord, CourseLoadSummary, TeacherConsolidatedLoad } from '../src/types/analizadorTypes';
import type { AsistenteAnalizadoRecord } from '../src/services/analizador/asistentesClassifier';

describe('Traspaso de Asistentes de la Educación desde el Analizador', () => {
  beforeEach(async () => {
    await reiniciarTodaLaBaseDatos();
  });

  it('debe transferir asistentes de la educación a SQLite correctamente durante el traspaso del analizador', async () => {
    const config: TraspasoConfig = {
      periodo: 2026,
      modo: 'REEMPLAZAR',
      homologaciones: {},
      colegiosRbd: ['12345'],
    };

    const schools: SchoolSummary[] = [
      {
        rbd: '12345',
        establishment: 'Escuela Test Diguillín',
        matricula: 150,
        horas_aula: 100,
        horas_directivas: 20,
        horas_tecnicas: 15,
        total_horas_ee: 135,
        teachers_count: 5,
        has_discrepancy: false,
        source_file: 'nomina.xlsx',
      }
    ];

    const asistentes: AsistenteAnalizadoRecord[] = [
      {
        id: 'ast-1',
        rbd: '12345',
        establishment: 'Escuela Test Diguillín',
        run: '12.345.678-9',
        nombres: 'María',
        apellidos: 'González López',
        cargo_original: 'Psicóloga SEP',
        cargo_estandar: 'Psicólogo/a',
        estamento: 'PROFESIONAL',
        horas_contrato: 44,
        horas_subvencion_general_indefinido: 0,
        horas_subvencion_general_plazo_fijo: 0,
        horas_sep_indefinido: 44,
        horas_sep_plazo_fijo: 0,
        horas_pie_indefinido: 0,
        horas_pie_plazo_fijo: 0,
        es_dupla_psicosocial: true,
        es_equipo_pie: false,
        es_tecnico_parvulo: false,
        es_auxiliar_servicio: false,
        es_inspector_patio: false,
        observaciones_ia: 'Dupla Psicosocial SEP',
        fuente_clasificacion: 'IA_GEMINI',
        confianza_ia: 'ALTA',
        estado_cuadratura: 'CUADRADA',
      },
      {
        id: 'ast-2',
        rbd: '12345',
        establishment: 'Escuela Test Diguillín',
        run: '11.222.333-4',
        nombres: 'Pedro',
        apellidos: 'Pérez Soto',
        cargo_original: 'Nochero',
        cargo_estandar: 'Nochero/a',
        estamento: 'AUXILIAR',
        horas_contrato: 44,
        horas_subvencion_general_indefinido: 44,
        horas_subvencion_general_plazo_fijo: 0,
        horas_sep_indefinido: 0,
        horas_sep_plazo_fijo: 0,
        horas_pie_indefinido: 0,
        horas_pie_plazo_fijo: 0,
        es_dupla_psicosocial: false,
        es_equipo_pie: false,
        es_tecnico_parvulo: false,
        es_auxiliar_servicio: true,
        es_inspector_patio: false,
        observaciones_ia: 'Personal de seguridad / rondín',
        fuente_clasificacion: 'HEURISTICA',
        confianza_ia: 'ALTA',
        estado_cuadratura: 'CUADRADA',
      }
    ];

    const result = await ejecutarTraspasoDotacionAnalizador(config, {
      schools,
      teachers: [],
      courses: [],
      teacherLoads: [],
      asistentes,
    });

    expect(result.asistentesGuardados).toBe(2);

    const guardados = await listarAsistentes('12345', 2026);
    expect(guardados.length).toBe(2);

    const psicologa = guardados.find(a => a.cargoFuncion === 'Psicólogo/a');
    expect(psicologa).toBeDefined();
    expect(psicologa?.estamento).toBe('PROFESIONAL');
    expect(psicologa?.esDuplaPsicosocial).toBe(true);
    expect(psicologa?.horasSepIndefinido).toBe(44);

    const nochero = guardados.find(a => a.cargoFuncion === 'Nochero/a');
    expect(nochero).toBeDefined();
    expect(nochero?.estamento).toBe('AUXILIAR');
    expect(nochero?.esAuxiliarServicio).toBe(true);
    expect(nochero?.horasSubvencionGeneralIndefinido).toBe(44);
  });

  it('debe respetar targetRbdOverride al traspasar asistentes a un RBD destino específico', async () => {
    const config: TraspasoConfig = {
      periodo: 2026,
      modo: 'REEMPLAZAR',
      homologaciones: {},
      colegiosRbd: ['99999'],
      targetRbdOverride: '77777',
    };

    const schools: SchoolSummary[] = [
      {
        rbd: '99999',
        establishment: 'Colegio Origen',
        matricula: 100,
        horas_aula: 80,
        horas_directivas: 10,
        horas_tecnicas: 10,
        total_horas_ee: 100,
        teachers_count: 4,
        has_discrepancy: false,
        source_file: 'origen.xlsx',
      }
    ];

    const asistentes: AsistenteAnalizadoRecord[] = [
      {
        id: 'ast-pie',
        rbd: '99999',
        establishment: 'Colegio Origen',
        run: '15.678.901-2',
        nombres: 'Claudia',
        apellidos: 'Reyes Silva',
        cargo_original: 'Fonoaudióloga PIE',
        cargo_estandar: 'Fonoaudiólogo/a',
        estamento: 'PROFESIONAL',
        horas_contrato: 30,
        horas_subvencion_general_indefinido: 0,
        horas_subvencion_general_plazo_fijo: 0,
        horas_sep_indefinido: 0,
        horas_sep_plazo_fijo: 0,
        horas_pie_indefinido: 30,
        horas_pie_plazo_fijo: 0,
        es_dupla_psicosocial: false,
        es_equipo_pie: true,
        es_tecnico_parvulo: false,
        es_auxiliar_servicio: false,
        es_inspector_patio: false,
        fuente_clasificacion: 'IA_GEMINI',
        confianza_ia: 'ALTA',
        estado_cuadratura: 'CUADRADA',
      }
    ];

    const result = await ejecutarTraspasoDotacionAnalizador(config, {
      schools,
      teachers: [],
      courses: [],
      teacherLoads: [],
      asistentes,
    });

    expect(result.asistentesGuardados).toBe(1);

    // Debe estar en el RBD destino 77777
    const enDestino = await listarAsistentes('77777', 2026);
    expect(enDestino.length).toBe(1);
    expect(enDestino[0].rbd).toBe('77777');
    expect(enDestino[0].cargoFuncion).toBe('Fonoaudiólogo/a');
    expect(enDestino[0].esEquipoPie).toBe(true);

    // En el origen no debe haber quedado
    const enOrigen = await listarAsistentes('99999', 2026);
    expect(enOrigen.length).toBe(0);
  });

  it('debe respetar el alcance SOLO_ASISTENTES sin alterar los docentes ni cursos', async () => {
    const config: TraspasoConfig = {
      periodo: 2026,
      modo: 'REEMPLAZAR',
      alcance: 'SOLO_ASISTENTES',
      homologaciones: {},
      colegiosRbd: ['12345'],
    };

    const schools: SchoolSummary[] = [
      {
        rbd: '12345',
        establishment: 'Escuela Test',
        matricula: 100,
        horas_aula: 80,
        horas_directivas: 10,
        horas_tecnicas: 10,
        total_horas_ee: 100,
        teachers_count: 2,
        has_discrepancy: false,
        source_file: 'test.xlsx',
      }
    ];

    const asistentes: AsistenteAnalizadoRecord[] = [
      {
        id: 'ast-solo',
        rbd: '12345',
        establishment: 'Escuela Test',
        run: '18.999.888-7',
        nombres: 'Andrea',
        apellidos: 'Castro',
        cargo_original: 'Inspectora',
        cargo_estandar: 'Inspector/a de Patio',
        estamento: 'PARADOCENTE_INSPECTORIA',
        horas_contrato: 44,
        horas_subvencion_general_indefinido: 44,
        horas_subvencion_general_plazo_fijo: 0,
        horas_sep_indefinido: 0,
        horas_sep_plazo_fijo: 0,
        horas_pie_indefinido: 0,
        horas_pie_plazo_fijo: 0,
        es_dupla_psicosocial: false,
        es_equipo_pie: false,
        es_tecnico_parvulo: false,
        es_auxiliar_servicio: false,
        es_inspector_patio: true,
        fuente_clasificacion: 'HEURISTICA',
        confianza_ia: 'ALTA',
        estado_cuadratura: 'CUADRADA',
      }
    ];

    const result = await ejecutarTraspasoDotacionAnalizador(config, {
      schools,
      teachers: [],
      courses: [],
      teacherLoads: [],
      asistentes,
    });

    expect(result.asistentesGuardados).toBe(1);
    expect(result.cursosCreados).toBe(0);
    expect(result.docentesGuardados).toBe(0);

    const guardados = await listarAsistentes('12345', 2026);
    expect(guardados.length).toBe(1);
    expect(guardados[0].cargoFuncion).toBe('Inspector/a de Patio');
  });
});
