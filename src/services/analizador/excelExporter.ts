import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { SchoolSummary, TeacherRecord, CourseLoadSummary, TeacherConsolidatedLoad } from '../../types/analizadorTypes';
import type { AsistenteAnalizadoRecord } from './asistentesClassifier';

export function exportConsolidatedExcelBrowser(
  schools: SchoolSummary[],
  teachers: TeacherRecord[],
  courses: CourseLoadSummary[] = [],
  teacherLoads: TeacherConsolidatedLoad[] = [],
  asistentes: AsistenteAnalizadoRecord[] = []
) {
  const wb = XLSX.utils.book_new();

  // Precomputar asistentes por RBD
  const asistentesPorRbd = new Map<string, { count: number; horas: number }>();
  for (const a of asistentes) {
    const rbdKey = String(a.rbd);
    const prev = asistentesPorRbd.get(rbdKey) || { count: 0, horas: 0 };
    prev.count += 1;
    prev.horas += Number(a.horas_contrato || 0);
    asistentesPorRbd.set(rbdKey, prev);
  }

  // 1. Hoja Consolidado Oficial SLEP
  const consolidatedHeaders = [
    ['SERVICIO LOCAL DE EDUCACIÓN PÚBLICA (SLEP) - DOTACIÓN DOCENTE Y ASISTENTES'],
    ['CONSOLIDADO DE HORAS DOCENTES (AULA, TÉCNICAS, DIRECTIVAS) Y ASISTENTES DE LA EDUCACIÓN'],
    [''],
    [
      'RBD',
      'ESTABLECIMIENTO',
      'COMUNA',
      'MATRÍCULA',
      'HORAS DOCENTES AULA',
      'HORAS DOCENTES DIRECTIVAS',
      'HORAS DOCENTES TÉCNICAS',
      'TOTAL HORAS EE',
      'DOCENTES',
      'CURSOS',
      'ASISTENTES (N°)',
      'HORAS ASISTENTES',
      'ESTADO CUADRATURA',
    ],
  ];

  const consolidatedRows = schools.map((s) => {
    const asisRbd = asistentesPorRbd.get(String(s.rbd)) || { count: 0, horas: 0 };
    return [
      s.rbd,
      s.establishment,
      s.comuna || 'Sin Comuna',
      s.matricula,
      s.horas_aula,
      s.horas_directivas,
      s.horas_tecnicas,
      s.total_horas_ee,
      s.teachers_count,
      s.courses_count || 0,
      asisRbd.count,
      Math.round(asisRbd.horas * 100) / 100,
      s.has_discrepancy ? `Descuadre (${s.discrepancy_note || 'Revisar'})` : 'Cuadrado',
    ];
  });

  const totalMatricula = schools.reduce((acc, s) => acc + (s.matricula || 0), 0);
  const totalAula = schools.reduce((acc, s) => acc + (s.horas_aula || 0), 0);
  const totalDirectivas = schools.reduce((acc, s) => acc + (s.horas_directivas || 0), 0);
  const totalTecnicas = schools.reduce((acc, s) => acc + (s.horas_tecnicas || 0), 0);
  const totalHoras = schools.reduce((acc, s) => acc + (s.total_horas_ee || 0), 0);
  const totalHorasAsistentes = asistentes.reduce((acc, a) => acc + (a.horas_contrato || 0), 0);

  const totalRow = [
    'TOTAL GENERAL',
    '',
    '',
    totalMatricula,
    Math.round(totalAula * 100) / 100,
    Math.round(totalDirectivas * 100) / 100,
    Math.round(totalTecnicas * 100) / 100,
    Math.round(totalHoras * 100) / 100,
    teachers.length,
    courses.length,
    asistentes.length,
    Math.round(totalHorasAsistentes * 100) / 100,
    '',
  ];

  const wsConsolidado = XLSX.utils.aoa_to_sheet([
    ...consolidatedHeaders,
    ...consolidatedRows,
    totalRow,
  ]);

  wsConsolidado['!cols'] = [
    { wch: 12 },
    { wch: 45 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 26 },
    { wch: 24 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, wsConsolidado, 'CONSOLIDADO SLEP');

  // 2. Hoja Auditoría Detallada Docentes
  const auditHeaders = [
    [
      'RBD',
      'ESTABLECIMIENTO',
      'COMUNA',
      'DOCENTE',
      'RUT',
      'ACTIVIDAD / ASIGNATURA',
      'CURSO(S) DETECTADO(S)',
      'HORAS ACTIVIDAD',
      'CATEGORÍA',
      'ORIGEN CLASIFICACIÓN',
      'HORAS CONTRATO',
      'TOTAL ASIGNADO DOCENTE',
      'ESTADO CARGA',
      'ALERTA SOBRECARGA',
    ],
  ];

  const auditRows = teachers.map((t) => [
    t.rbd,
    t.establishment,
    t.comuna || 'Sin Comuna',
    t.teacher_name,
    t.rut,
    t.activity,
    t.curso || (t.cursos_asignados && t.cursos_asignados.length > 0 ? t.cursos_asignados.join(', ') : 'Sin Curso Específico'),
    t.hours,
    t.category,
    t.source,
    t.total_declared || t.hours,
    t.total_teacher_hours || t.hours,
    t.estado_carga || 'CUADRADA',
    t.legal_limit_warning || '',
  ]);

  const wsAuditoria = XLSX.utils.aoa_to_sheet([...auditHeaders, ...auditRows]);
  wsAuditoria['!cols'] = [
    { wch: 12 },
    { wch: 35 },
    { wch: 18 },
    { wch: 32 },
    { wch: 15 },
    { wch: 35 },
    { wch: 25 },
    { wch: 16 },
    { wch: 15 },
    { wch: 30 },
    { wch: 18 },
    { wch: 24 },
    { wch: 18 },
    { wch: 40 },
  ];

  XLSX.utils.book_append_sheet(wb, wsAuditoria, 'AUDITORÍA DETALLADA');

  // 3. Hoja Carga por Cursos y Docentes
  if (courses.length > 0) {
    const courseHeaders = [
      ['RBD', 'ESTABLECIMIENTO', 'COMUNA', 'CURSO', 'NIVEL', 'LETRA', 'DOCENTE', 'RUT', 'ASIGNATURA', 'HORAS PEDAGÓGICAS', 'CATEGORÍA'],
    ];

    const courseRows: any[][] = [];
    courses.forEach((c) => {
      c.docentes.forEach((d) => {
        courseRows.push([
          c.rbd,
          c.establishment,
          c.comuna || 'Sin Comuna',
          c.curso,
          c.nivel,
          c.letra,
          d.teacher_name,
          d.rut,
          d.asignatura,
          d.horas,
          d.categoria,
        ]);
      });
    });

    const wsCursos = XLSX.utils.aoa_to_sheet([...courseHeaders, ...courseRows]);
    wsCursos['!cols'] = [
      { wch: 12 },
      { wch: 35 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 10 },
      { wch: 32 },
      { wch: 15 },
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(wb, wsCursos, 'CARGA POR CURSO Y DOCENTE');
  }

  // 4. Hoja Asistentes de la Educación
  if (asistentes.length > 0) {
    const asisHeaders = [
      [
        'RBD',
        'ESTABLECIMIENTO',
        'COMUNA',
        'RUN',
        'NOMBRES',
        'APELLIDOS',
        'CARGO ORIGINAL',
        'CARGO ESTÁNDAR',
        'ESTAMENTO',
        'HORAS CONTRATO',
        'SUBV. GEN. INDEF.',
        'SUBV. GEN. PLAZO FIJO',
        'SEP INDEF.',
        'SEP PLAZO FIJO',
        'PIE INDEF.',
        'PIE PLAZO FIJO',
        'ESTADO CUADRATURA',
        'ORIGEN CLASIFICACIÓN',
        'ALERTAS',
      ],
    ];

    const asisRows = asistentes.map((a) => [
      a.rbd,
      a.establishment,
      a.comuna || 'Sin Comuna',
      a.run,
      a.nombres,
      a.apellidos,
      a.cargo_original,
      a.cargo_estandar,
      a.estamento,
      a.horas_contrato,
      a.horas_subvencion_general_indefinido,
      a.horas_subvencion_general_plazo_fijo,
      a.horas_sep_indefinido,
      a.horas_sep_plazo_fijo,
      a.horas_pie_indefinido,
      a.horas_pie_plazo_fijo,
      a.estado_cuadratura,
      a.fuente_clasificacion,
      (a.alertas || []).join('; '),
    ]);

    const wsAsistentes = XLSX.utils.aoa_to_sheet([...asisHeaders, ...asisRows]);
    wsAsistentes['!cols'] = [
      { wch: 12 },
      { wch: 35 },
      { wch: 18 },
      { wch: 15 },
      { wch: 24 },
      { wch: 24 },
      { wch: 28 },
      { wch: 28 },
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 35 },
    ];

    XLSX.utils.book_append_sheet(wb, wsAsistentes, 'ASISTENTES DE LA EDUCACIÓN');
  }

  // Descargar archivo Excel
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(data, `Consolidado_SLEP_Dotacion_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportCsvBrowser(schools: SchoolSummary[], asistentes: AsistenteAnalizadoRecord[] = []) {
  const asistentesPorRbd = new Map<string, { count: number; horas: number }>();
  for (const a of asistentes) {
    const rbdKey = String(a.rbd);
    const prev = asistentesPorRbd.get(rbdKey) || { count: 0, horas: 0 };
    prev.count += 1;
    prev.horas += Number(a.horas_contrato || 0);
    asistentesPorRbd.set(rbdKey, prev);
  }

  const headers = ['RBD', 'ESTABLECIMIENTO', 'COMUNA', 'MATRICULA', 'HORAS_AULA', 'HORAS_DIRECTIVAS', 'HORAS_TECNICAS', 'TOTAL_HORAS_EE', 'DOCENTES', 'CURSOS', 'ASISTENTES', 'HORAS_ASISTENTES'];
  const rows = schools.map((s) => {
    const asisRbd = asistentesPorRbd.get(String(s.rbd)) || { count: 0, horas: 0 };
    return [
      s.rbd,
      `"${s.establishment.replace(/"/g, '""')}"`,
      `"${(s.comuna || '').replace(/"/g, '""')}"`,
      s.matricula,
      s.horas_aula,
      s.horas_directivas,
      s.horas_tecnicas,
      s.total_horas_ee,
      s.teachers_count,
      s.courses_count || 0,
      asisRbd.count,
      Math.round(asisRbd.horas * 100) / 100,
    ];
  });

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `Consolidado_Dotacion_SLEP_${new Date().toISOString().split('T')[0]}.csv`);
}
