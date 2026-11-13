import { describe, it, expect, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import {
  getDb,
  guardarEstablecimiento,
  listarAsistentes,
  listarDocentes,
} from '../src/database/db';
import { importarDetalleCentroCostoVtf } from '../src/services/centroCostoVtfImportService';

async function buildMockCentroCostoWorkbook(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hoja1');

  ws.addRow([]);
  ws.addRow([
    'R.U.N.',
    'Apellido Paterno',
    'Apellido Materno',
    'Nombres',
    'Sexo',
    'Legislación Laboral',
    'Tramo Docente',
    'Aplica Ley 20903 Artículo 5',
    'Categoria',
    'Ingreso',
    'Término',
    'Programa',
    'Centro Costo',
    'RBD',
    'Comuna',
    'Cargo',
    'Tipo Contrato',
    'Horas Contrato',
    'Jornada Trabajador',
    'Centro Costo Extensión',
  ]);

  // 1. Educadora de Párvulos registrada como "Asistentes de la educación" en RR.HH.
  ws.addRow([
    '18.708.978-6',
    'ABURTO',
    'ROCHA',
    'BELEN OLIMPIA',
    'Femenino',
    'Asistentes de la educación',
    '',
    'No',
    'Profesional',
    '01/03/2018',
    '',
    '',
    'SALA CUNA CHOLGUAN',
    '34725',
    'Yungay',
    'EDUCADORA DE PARVULOS',
    'Indefinido',
    44,
    'Jornada completa',
    '',
  ]);

  // 2. Directora VTF
  ws.addRow([
    '12.345.678-5',
    'PEREZ',
    'LAGOS',
    'MARIA JOSE',
    'Femenino',
    'Asistentes de la educación',
    '',
    'No',
    'Profesional',
    '01/03/2019',
    '',
    '',
    'SALA CUNA CHOLGUAN',
    '34725',
    'Yungay',
    'DIRECTOR/A',
    'Indefinido',
    44,
    'Jornada completa',
    '',
  ]);

  // 3. Técnico en Párvulos
  ws.addRow([
    '19.111.222-3',
    'ROJAS',
    'DIAZ',
    'CARLA ANDREA',
    'Femenino',
    'Asistentes de la educación',
    '',
    'No',
    'Técnica',
    '01/03/2025',
    '31/12/2026',
    '',
    'SALA CUNA CHOLGUAN',
    '34725',
    'Yungay',
    'TECNICO EN PARVULOS',
    'Plazo fijo',
    44,
    'Jornada completa',
    '',
  ]);

  // 4. Auxiliar de Servicios en SALA CUNA RIOS DEL SUR sin RBD -> debe resolver a 36646
  ws.addRow([
    '15.222.333-4',
    'SILVA',
    'MORA',
    'ELENA PATRICIA',
    'Femenino',
    'Asistentes de la educación',
    '',
    'No',
    'Auxiliar',
    '01/04/2020',
    '',
    '',
    'SALA CUNA RIOS DEL SUR',
    '',
    'Chillán',
    'AUXILIAR DE SERVICIOS',
    'Indefinido',
    44,
    'Jornada completa',
    '',
  ]);

  // 5. Escuela Básica con "JARDINES" en su nombre (RBD 3707) -> DEBE excluirse
  ws.addRow([
    '16.444.555-6',
    'CASTRO',
    'VEGA',
    'PEDRO PABLO',
    'Masculino',
    'Estatuto docente',
    'Temprano',
    'No',
    '',
    '01/03/2020',
    '',
    '',
    'ESCUELA LOS JARDINES DE LAUTARO',
    '3707',
    'Bulnes',
    'DOCENTE DE AULA',
    'Titular',
    44,
    'Jornada completa',
    '',
  ]);

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

describe('centroCostoVtfImportService', () => {
  beforeEach(async () => {
    await getDb();
    for (const est of [
      {
        id: 'est-34725',
        rbd: '34725',
        nombre: 'Jardín infantil Cuncunita',
        tipo: 'JARDIN' as const,
        tipoPerfil: 'JARDIN_SALA_CUNA' as const,
        comuna: 'Yungay' as const,
        regimen: 'No JEC' as const,
        porcentajePrioritarios: 80,
      },
      {
        id: 'est-36646',
        rbd: '36646',
        nombre: 'Sala Cuna y Jardín Infantil Rios del Sur 2',
        tipo: 'JARDIN' as const,
        tipoPerfil: 'JARDIN_SALA_CUNA' as const,
        comuna: 'Chillán' as const,
        regimen: 'No JEC' as const,
        porcentajePrioritarios: 80,
      },
      {
        id: 'est-3707',
        rbd: '3707',
        nombre: 'ESCUELA LOS JARDINES DE LAUTARO',
        tipo: 'ESCUELA' as const,
        tipoPerfil: 'ESCUELA_BASICA' as const,
        comuna: 'Bulnes' as const,
        regimen: 'JEC' as const,
        porcentajePrioritarios: 80,
      },
    ]) {
      await guardarEstablecimiento(est);
    }
  });

  it('enruta Educadora/Directora a docentes y Técnicos/Auxiliares a asistentes, resuelve Ríos del Sur a 36646 y excluye RBD 3707', async () => {
    const buffer = await buildMockCentroCostoWorkbook();
    const res = await importarDetalleCentroCostoVtf(buffer, 2027);

    expect(res.hojaUtilizada).toBe('Hoja1');
    expect(res.unidadesAfectadas).toBe(2);
    expect(res.docentesImportados).toBe(2);
    expect(res.directorasImportadas).toBe(1);
    expect(res.educadorasImportadas).toBe(1);
    expect(res.asistentesImportados).toBe(2);
    expect(res.tecnicosImportados).toBe(1);
    expect(res.otrosAsistentesImportados).toBe(1);
    expect(res.sinRbdResueltos).toBe(1);
    expect(res.omitidosNoVtf).toBe(1);

    const docs34725 = await listarDocentes('34725', 2027);
    expect(docs34725).toHaveLength(2);
    expect(docs34725.find(d => d.funcionVtf === 'Educadora de Párvulos')?.apellidos).toBe('ABURTO ROCHA');
    expect(docs34725.find(d => d.funcionVtf === 'Función Directiva')?.apellidos).toBe('PEREZ LAGOS');

    const asist34725 = await listarAsistentes('34725', 2027);
    expect(asist34725).toHaveLength(1);
    expect(asist34725[0].funcionVtf).toBe('Técnico de Educación Parvularia');

    const asist36646 = await listarAsistentes('36646', 2027);
    expect(asist36646).toHaveLength(1);
    expect(asist36646[0].funcionVtf).toBe('Otros asistentes de la educación');

    const docs3707 = await listarDocentes('3707', 2027);
    expect(docs3707).toHaveLength(0);
  });
});
