import * as XLSX from 'xlsx';

/**
 * Genera un libro Excel sintético (en memoria, sin PII real) que reproduce la estructura
 * de la planilla territorial de levantamiento de Asistentes de la Educación (23 funcionarios, 844h).
 */
export function crearWorkbookAsistentesSintetico(): XLSX.WorkBook {
  const filasBase: Array<[string, string, string, number, number | '', number | '', number | '', number | '', number | '', number | '']> = [
    ['PRUEBA UNO, LUISA', '11.111.101-1', 'ASISTENTE DE SALA', 38, '', 38, '', '', '', ''],
    ['PRUEBA DOS, MARCELA', '11.111.102-2', 'TECNICO EN PARVULOS', 44, 44, '', '', '', '', ''],
    ['PRUEBA TRES, MARISOL', '11.111.103-3', 'INSPECTOR/A', 38, 38, '', '', '', '', ''],
    ['PRUEBA CUATRO, CARLOS', '11.111.104-4', 'AUXILIAR DE SERVICIOS', 44, 44, '', '', '', '', ''],
    ['PRUEBA CINCO, JUAN', '11.111.105-5', 'AUXILIAR DE SERVICIOS', 44, '', 44, '', '', '', ''],
    ['PRUEBA SEIS, ANA', '11.111.106-6', 'SECRETARIA ADMINISTRATIVA', 44, 44, '', '', '', '', ''],
    ['PRUEBA SIETE, CLAUDIA', '11.111.107-7', 'TECNICO EN PARVULOS', 38, 38, '', '', '', '', ''],
    ['PRUEBA OCHO, PATRICIA', '11.111.108-8', 'ASISTENTE DE SALA', 38, 38, '', '', '', '', ''],
    ['PRUEBA NUEVE, LUIS', '11.111.109-9', 'AUXILIAR DE SERVICIOS', 22, 22, '', '', '', '', ''],
    ['PRUEBA DIEZ, ROSA', '11.111.110-K', 'ASISTENTE DE SALA', 38, 38, '', '', '', '', ''],
    ['PRUEBA ONCE, PEDRO', '11.111.111-1', 'INSPECTOR/A', 38, 38, '', '', '', '', ''],
    ['PRUEBA DOCE, NICOLE', '11.111.112-2', 'ASISTENTE SOCIAL', 44, '', '', 22, '', 22, ''],
    ['PRUEBA TRECE, DIEGO', '11.111.113-3', 'ENCARGADO DE INFORMATICA', 22, '', '', 22, '', '', ''],
    ['PRUEBA CATORCE, SOFIA', '11.111.114-4', 'TÉCNICO EN ENFERMERÍA', 38, '', '', '', 38, '', ''],
    ['PRUEBA QUINCE, MARTA', '11.111.115-5', 'ASISTENTE EDUCACION DIFERENCIAL', 38, '', '', 38, '', '', ''],
    ['PRUEBA DIECISEIS, JOSE', '11.111.116-6', 'INSPECTOR/A', 38, '', '', '', 38, '', ''],
    ['PRUEBA DIECISIETE, CAMILA', '11.111.117-7', 'PSICOLOGO/A', 44, '', '', '', '', 44, ''],
    ['PRUEBA DIECIOCHO, PABLO', '11.111.118-8', 'KINESIOLOGO/A', 18, '', '', '', '', 18, ''],
    ['PRUEBA DIECINUEVE, VALERIA', '11.111.119-9', 'FONOAUDIÓLOGO/A', 26, '', '', '', '', 26, ''],
    ['PRUEBA VEINTE, ANDRES', '11.111.120-K', 'TERAPEUTA OCUPACIONAL', 30, '', '', '', '', 30, ''],
    ['PRUEBA VEINTIUNO, ELENA', '11.111.121-1', 'ASISTENTE EDUCACION DIFERENCIAL', 38, '', '', '', '', 38, ''],
    ['PRUEBA VEINTIDOS, MONICA', '11.111.122-2', 'ASISTENTE DE SALA', 38, '', '', '', '', '', 38],
    ['PRUEBA VEINTITRES, DANIELA', '11.111.123-3', 'ASISTENTE EDUCACION DIFERENCIAL', 44, '', '', '', '', 44, '']
  ];

  const aoa: any[][] = [
    ['Asistentes de la educación', '', '', '', '', '', '', '', '', '', ''],
    [
      'NOMBRES',
      'RUT',
      'FUNCIÓN',
      'HORAS CONTRATO',
      'INDEFINIDAS SUB GRAL',
      'PLAZO FIJO SUB GRAL',
      'INDEFINIDAS SEP',
      'PLAZO FIJO SEP',
      'INDEFINIDAS PIE',
      'PLAZO FIJO PIE',
      ''
    ],
    ...filasBase.map(f => [...f, '']),
    ['', '', '', '', '', '', '', '', '', '', ''],
    ['TOTAL', '', '', 844, 344, 82, 82, 76, 222, 38, '']
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Asistentes');
  return wb;
}
