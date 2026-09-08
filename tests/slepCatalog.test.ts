import { describe, it, expect } from 'vitest';
import {
  SLEP_VALLE_DIGUILLIN_SCHOOLS,
  findSchoolByRbd,
  findSchoolByName,
  identifySchool,
  getSchoolsByComuna,
  searchSlepSchools,
} from '../src/data/slepSchoolsCatalog';
import * as XLSX from 'xlsx';
import { parseExcelBrowser } from '../src/services/analizador/excelParser';
import { exportConsolidatedExcelBrowser } from '../src/services/analizador/excelExporter';

describe('Catálogo Oficial SLEP Valle Diguillín (131 Establecimientos)', () => {
  it('contiene exactamente los 131 establecimientos y jardines del territorio', () => {
    expect(SLEP_VALLE_DIGUILLIN_SCHOOLS.length).toBe(131);

    // Verificar que todos tienen RBD, Nombre y Comuna válida
    for (const school of SLEP_VALLE_DIGUILLIN_SCHOOLS) {
      expect(school.rbd).toBeTruthy();
      expect(school.nombre).toBeTruthy();
      expect(school.comuna).toBeTruthy();
      expect(['Chillán', 'Chillán Viejo', 'Bulnes', 'San Ignacio', 'Yungay', 'Pemuco']).toContain(school.comuna);
    }
  });

  it('agrupa correctamente por cada una de las 6 comunas', () => {
    const chillan = getSchoolsByComuna('Chillán');
    const chillanViejo = getSchoolsByComuna('Chillán Viejo');
    const bulnes = getSchoolsByComuna('Bulnes');
    const sanIgnacio = getSchoolsByComuna('San Ignacio');
    const yungay = getSchoolsByComuna('Yungay');
    const pemuco = getSchoolsByComuna('Pemuco');

    expect(chillan.length).toBeGreaterThan(30);
    expect(chillanViejo.length).toBeGreaterThan(10);
    expect(bulnes.length).toBeGreaterThan(15);
    expect(sanIgnacio.length).toBeGreaterThan(10);
    expect(yungay.length).toBeGreaterThan(15);
    expect(pemuco.length).toBeGreaterThan(10);

    const sumComunas = chillan.length + chillanViejo.length + bulnes.length + sanIgnacio.length + yungay.length + pemuco.length;
    expect(sumComunas).toBe(131);
  });

  it('encuentra establecimientos por su RBD exacto', () => {
    // Caso 1: Liceo Marta Brunet (Chillán)
    const martaBrunet = findSchoolByRbd('3638');
    expect(martaBrunet).toBeDefined();
    expect(martaBrunet?.nombre).toBe('LICEO BICENTENARIO MARTA BRUNET CÁRAVES');
    expect(martaBrunet?.comuna).toBe('Chillán');

    // Caso 2: Liceo Manuel Bulnes (Bulnes)
    const bulnes = findSchoolByRbd('3976');
    expect(bulnes).toBeDefined();
    expect(bulnes?.nombre).toBe('LICEO MANUEL BULNES');
    expect(bulnes?.comuna).toBe('Bulnes');

    // Caso 3: Escuela Arturo Merino Benitez (Chillán)
    const arturoMerino = findSchoolByRbd('3659');
    expect(arturoMerino).toBeDefined();
    expect(arturoMerino?.nombre).toBe('ESCUELA ARTURO MERINO BENITEZ');
    expect(arturoMerino?.comuna).toBe('Chillán');

    // Caso 4: Jardin Infantil Papelucho (Pemuco)
    const papelucho = findSchoolByRbd('34671');
    expect(papelucho).toBeDefined();
    expect(papelucho?.comuna).toBe('Pemuco');

    // Caso 5: Liceo Pueblo Seco (San Ignacio)
    const puebloSeco = findSchoolByRbd('3887');
    expect(puebloSeco).toBeDefined();
    expect(puebloSeco?.comuna).toBe('San Ignacio');
  });

  it('identifica colegios por coincidencia aproximada de nombre', () => {
    const s1 = findSchoolByName('MARTA BRUNET');
    expect(s1?.rbd).toBe('3638');

    const s2 = findSchoolByName('Narciso Tondreau');
    expect(s2?.rbd).toBe('3639');

    const s3 = findSchoolByName('Liceo Tomas Lago');
    expect(s3?.rbd).toBe('18099');
    expect(s3?.comuna).toBe('Chillán Viejo');
  });

  it('identifica colegio a partir del nombre del archivo Excel', () => {
    const identified = identifySchool(undefined, 'Planilla_3638_Marta_Brunet_2026.xlsx');
    expect(identified).toBeDefined();
    expect(identified?.rbd).toBe('3638');
    expect(identified?.comuna).toBe('Chillán');

    const bySchoolNameInFile = identifySchool(undefined, 'DOTACION_ESCUELA_REPUBLICA_DE_MEXICO.xlsx');
    expect(bySchoolNameInFile).toBeDefined();
    expect(bySchoolNameInFile?.rbd).toBe('3663');
    expect(bySchoolNameInFile?.comuna).toBe('Chillán');
  });

  it('enriquece automáticamente el resultado al parsear un Excel con su Comuna oficial', async () => {
    const sheetData = [
      ['DOTACION OFICIAL', '', '', '', '', '', '', '', '', ''],
      [
        'NOMBRES', 'RUN', 'HORAS CONTRATO',
        'TITULARES SUB GRAL', 'CONTRATA PIE',
        'NT1', '1', 'TOTAL HA*', 'TOTAL HC'
      ],
      [
        'PROFESOR EJEMPLO', '15.111.222-3', 44,
        44, '',
        '', 30, 30, 44
      ]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Nomina');

    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Archivo con nombre que contiene el RBD oficial 3639 (Liceo Narciso Tondreau - Chillán)
    const mockFile = {
      name: 'RBD_3639_Planilla.xlsx',
      arrayBuffer: async () => {
        const u8 = new Uint8Array(wbOut);
        return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
      },
    } as unknown as File;

    const result = await parseExcelBrowser(mockFile);

    expect(result.rbd).toBe('3639');
    expect(result.establishment).toBe('LICEO NARCISO TONDREAU');
    expect(result.comuna).toBe('Chillán');
    expect(result.teachers[0].comuna).toBe('Chillán');
    expect(result.teachers[0].establishment).toBe('LICEO NARCISO TONDREAU');
  });

  it('permite buscar colegios por término general de búsqueda', () => {
    const resultsChillanViejo = searchSlepSchools('Chillán Viejo');
    expect(resultsChillanViejo.length).toBeGreaterThan(10);
    expect(resultsChillanViejo.every(s => s.comuna === 'Chillán Viejo')).toBe(true);

    const resultsBicentenario = searchSlepSchools('Bicentenario');
    expect(resultsBicentenario.length).toBeGreaterThan(3);
  });
});
