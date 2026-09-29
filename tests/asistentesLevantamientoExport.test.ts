import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  clasificarFuncionLevantamientoHeuristica,
  generarMatrizLevantamientoEstablecimiento,
  FUNCIONES_CANONICAS_LEVANTAMIENTO,
  EstablecimientoLevantamiento
} from '../src/services/analizador/asistentesLevantamientoRollup';
import {
  agregarHojaLevantamientoEstablecimiento
} from '../src/services/analizador/asistentesLevantamientoExporter';
import { AsistenteAnalizadoRecord } from '../src/services/analizador/asistentesClassifier';

describe('Levantamiento Coeficiente Asistentes de la Educación (Planilla Oficial)', () => {
  it('clasifica correctamente los 17 cargos canónicos con heurística normativa', () => {
    expect(clasificarFuncionLevantamientoHeuristica('Inspector de patio').funcion).toBe('Inspectores');
    expect(clasificarFuncionLevantamientoHeuristica('PARADOCENTE').funcion).toBe('Inspectores');
    expect(clasificarFuncionLevantamientoHeuristica('Auxiliar de Aseo').funcion).toBe('Auxiliares');
    expect(clasificarFuncionLevantamientoHeuristica('Portero').funcion).toBe('Auxiliares');
    expect(clasificarFuncionLevantamientoHeuristica('Psicóloga PIE').funcion).toBe('Psicólogo');
    expect(clasificarFuncionLevantamientoHeuristica('Trabajadora Social Dupla SEP').funcion).toBe('Trabajador  Social');
    expect(clasificarFuncionLevantamientoHeuristica('Asistente Social Bienestar').funcion).toBe('Asistente social');
    expect(clasificarFuncionLevantamientoHeuristica('Kinesiólogo').funcion).toBe('Kinesiólogo/a');
    expect(clasificarFuncionLevantamientoHeuristica('Fonoaudióloga PIE').funcion).toBe('Fonoaudiólogo/a');
    expect(clasificarFuncionLevantamientoHeuristica('Terapeuta Ocupacional').funcion).toBe('Terapeuta ocupacional');
    expect(clasificarFuncionLevantamientoHeuristica('Técnico Diferencial').funcion).toBe('Asistente técnico de Educación Diferencial');
    expect(clasificarFuncionLevantamientoHeuristica('Técnico en Párvulos').funcion).toBe('Asistentes de aula');
    expect(clasificarFuncionLevantamientoHeuristica('Asistente de Aula 1° Básico').funcion).toBe('Asistentes de aula');
    expect(clasificarFuncionLevantamientoHeuristica('Administrativo de Finanzas').funcion).toBe('Administrativos');
    expect(clasificarFuncionLevantamientoHeuristica('Chofer de Furgón Escolar').funcion).toBe('Conductores Auxliar');
    expect(clasificarFuncionLevantamientoHeuristica('Maestro de Mantención y Gasfitería').funcion).toBe('Maestros');
    expect(clasificarFuncionLevantamientoHeuristica('TENS Primeros Auxilios').funcion).toBe('Enfermero/TENS/Asistente con capacitación');
    expect(clasificarFuncionLevantamientoHeuristica('Encargada de Comunicaciones y Redes').funcion).toBe('Comunicaciones');
    expect(clasificarFuncionLevantamientoHeuristica('Secretaria de Dirección').funcion).toBe('Secretaria');
    expect(clasificarFuncionLevantamientoHeuristica('Nochero / Cuidador').funcion).toBe('Nocheros');
  });

  it('clasifica cargos no estándar en "OTROS " extrayendo el cargo detallado', () => {
    const resNutri = clasificarFuncionLevantamientoHeuristica('Nutricionista');
    expect(resNutri.funcion).toBe('OTROS ');
    expect(resNutri.cargoDetalleOtro).toBe('Nutricionista');

    const resCra = clasificarFuncionLevantamientoHeuristica('Encargada CRA Biblioteca');
    expect(resCra.funcion).toBe('OTROS ');
    expect(resCra.cargoDetalleOtro).toBe('Encargada CRA Biblioteca');
  });

  it('genera la matriz de levantamiento para un establecimiento agrupando horas y conteos', () => {
    const mockAsistentes: AsistenteAnalizadoRecord[] = [
      {
        id: 'asist-1',
        rbd: '12345',
        establishment: 'COLEGIO DE PRUEBA',
        file_name: 'dotacion.xlsx',
        run: '11.111.111-1',
        nombres: 'JUAN',
        apellidos: 'INSPECTOR',
        cargo_original: 'Inspector de Patio',
        cargo_estandar: 'Inspector de Patio',
        estamento: 'PARADOCENTE_INSPECTORIA',
        horas_contrato: 44,
        horas_subvencion_general_indefinido: 44,
        horas_subvencion_general_plazo_fijo: 0,
        horas_sep_indefinido: 0,
        horas_sep_plazo_fijo: 0,
        horas_pie_indefinido: 0,
        horas_pie_plazo_fijo: 0,
        es_inspector_patio: true,
        es_dupla_psicosocial: false,
        es_equipo_pie: false,
        es_tecnico_parvulo: false,
        es_auxiliar_servicio: false,
      },
      {
        id: 'asist-2',
        rbd: '12345',
        establishment: 'COLEGIO DE PRUEBA',
        file_name: 'dotacion.xlsx',
        run: '22.222.222-2',
        nombres: 'MARIA',
        apellidos: 'PSICOLOGA',
        cargo_original: 'Psicóloga Dupla',
        cargo_estandar: 'Psicóloga',
        estamento: 'PROFESIONAL',
        horas_contrato: 44,
        horas_subvencion_general_indefinido: 0,
        horas_subvencion_general_plazo_fijo: 0,
        horas_sep_indefinido: 0,
        horas_sep_plazo_fijo: 44,
        horas_pie_indefinido: 0,
        horas_pie_plazo_fijo: 0,
        es_inspector_patio: false,
        es_dupla_psicosocial: true,
        es_equipo_pie: false,
        es_tecnico_parvulo: false,
        es_auxiliar_servicio: false,
      },
      {
        id: 'asist-3',
        rbd: '12345',
        establishment: 'COLEGIO DE PRUEBA',
        file_name: 'dotacion.xlsx',
        run: '33.333.333-3',
        nombres: 'PEDRO',
        apellidos: 'FONOAUDIOLOGO',
        cargo_original: 'Fonoaudiólogo PIE',
        cargo_estandar: 'Fonoaudiólogo',
        estamento: 'PROFESIONAL',
        horas_contrato: 30,
        horas_subvencion_general_indefinido: 0,
        horas_subvencion_general_plazo_fijo: 0,
        horas_sep_indefinido: 0,
        horas_sep_plazo_fijo: 0,
        horas_pie_indefinido: 0,
        horas_pie_plazo_fijo: 30,
        es_inspector_patio: false,
        es_dupla_psicosocial: false,
        es_equipo_pie: true,
        es_tecnico_parvulo: false,
        es_auxiliar_servicio: false,
      },
      {
        id: 'asist-4',
        rbd: '12345',
        establishment: 'COLEGIO DE PRUEBA',
        file_name: 'dotacion.xlsx',
        run: '44.444.444-4',
        nombres: 'ANA',
        apellidos: 'NUTRICIONISTA',
        cargo_original: 'Nutricionista',
        cargo_estandar: 'Nutricionista',
        estamento: 'PROFESIONAL',
        horas_contrato: 40,
        horas_subvencion_general_indefinido: 0,
        horas_subvencion_general_plazo_fijo: 0,
        horas_sep_indefinido: 0,
        horas_sep_plazo_fijo: 0,
        horas_pie_indefinido: 0,
        horas_pie_plazo_fijo: 40,
        es_inspector_patio: false,
        es_dupla_psicosocial: false,
        es_equipo_pie: false,
        es_tecnico_parvulo: false,
        es_auxiliar_servicio: false,
      }
    ];

    const matriz = generarMatrizLevantamientoEstablecimiento(
      mockAsistentes,
      '12345',
      'COLEGIO DE PRUEBA',
      'BULNES'
    );

    expect(matriz.nombreEstablecimiento).toBe('COLEGIO DE PRUEBA');
    expect(matriz.rows.length).toBeGreaterThanOrEqual(18);

    // Inspectores
    const rowInspectores = matriz.rows.find((r) => r.cargoFuncion === 'Inspectores');
    expect(rowInspectores).toBeDefined();
    expect(rowInspectores?.cantidadFuncionarios).toBe(1);
    expect(rowInspectores?.horasSubRegular).toBe(44);

    // Psicólogo
    const rowPsicologo = matriz.rows.find((r) => r.cargoFuncion === 'Psicólogo');
    expect(rowPsicologo).toBeDefined();
    expect(rowPsicologo?.cantidadFuncionarios).toBe(1);
    expect(rowPsicologo?.horasSep).toBe(44);

    // Fonoaudiólogo/a
    const rowFono = matriz.rows.find((r) => r.cargoFuncion === 'Fonoaudiólogo/a');
    expect(rowFono).toBeDefined();
    expect(rowFono?.cantidadFuncionarios).toBe(1);
    expect(rowFono?.horasPie).toBe(30);

    // OTROS (Nutricionista)
    const rowNutri = matriz.rows.find((r) => r.cargoFuncion.startsWith('OTROS') && r.observaciones.includes('Nutricionista'));
    expect(rowNutri).toBeDefined();
    expect(rowNutri?.cantidadFuncionarios).toBe(1);
    expect(rowNutri?.horasPie).toBe(40);

    // Total General
    expect(matriz.totalGeneral.cantidadFuncionarios).toBe(4);
    expect(matriz.totalGeneral.horasSubRegular).toBe(44);
    expect(matriz.totalGeneral.horasSep).toBe(44);
    expect(matriz.totalGeneral.horasPie).toBe(70);
    expect(matriz.totalGeneral.totalHoras).toBe(158);
  });

  it('genera un libro Excel con fórmulas y formato idéntico a la plantilla oficial', async () => {
    const matriz: EstablecimientoLevantamiento = {
      rbd: '12345',
      nombreEstablecimiento: 'LICEO SANTA CLARA',
      comuna: 'BULNES',
      rows: [
        { cargoFuncion: 'Inspectores', cantidadFuncionarios: 2, horasSubRegular: 88, horasPie: 0, horasSep: 0, totalHoras: 88, observaciones: '' },
        { cargoFuncion: 'Psicólogo', cantidadFuncionarios: 1, horasSubRegular: 0, horasPie: 0, horasSep: 44, totalHoras: 44, observaciones: 'Dupla SEP' },
        { cargoFuncion: 'OTROS ', cantidadFuncionarios: 1, horasSubRegular: 0, horasPie: 40, horasSep: 0, totalHoras: 40, observaciones: 'Nutricionista', isOtro: true },
      ],
      totalGeneral: {
        cantidadFuncionarios: 4,
        horasSubRegular: 88,
        horasPie: 40,
        horasSep: 44,
        totalHoras: 172
      }
    };

    const wb = new ExcelJS.Workbook();
    const ws = agregarHojaLevantamientoEstablecimiento(wb, matriz, 'Santa Clara');

    expect(ws.getCell('A1').value).toBe('COEFICIENTE ASISTENTES DE LA EDUCACIÓN PARA  EE');
    expect(ws.getCell('A4').value).toBe('Nombre del Establecimiento');
    expect(ws.getCell('B4').value).toContain('LICEO SANTA CLARA');
    expect(ws.getCell('A9').value).toBe('Cargo / función');
    expect(ws.getCell('F10').value).toEqual({ formula: 'SUM(C10:E10)' });

    const buffer = await wb.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it('homologa nomenclaturas similares y variantes al cargo oficial correcto', () => {
    // Variantes de Diferencial
    expect(clasificarFuncionLevantamientoHeuristica('ASISTENTE EDUCACION DIFERENCIAL').funcion).toBe('Asistente técnico de Educación Diferencial');
    expect(clasificarFuncionLevantamientoHeuristica('Asistente Diferencial PIE').funcion).toBe('Asistente técnico de Educación Diferencial');
    expect(clasificarFuncionLevantamientoHeuristica('Técnico en Educación Especial').funcion).toBe('Asistente técnico de Educación Diferencial');
    expect(clasificarFuncionLevantamientoHeuristica('Apoyo Diferencial PIE').funcion).toBe('Asistente técnico de Educación Diferencial');

    // Variantes de Párvulo / Aula
    expect(clasificarFuncionLevantamientoHeuristica('ASISTENTE DE PARVULOS').funcion).toBe('Asistentes de aula');
    expect(clasificarFuncionLevantamientoHeuristica('Tecnico en Parvulos').funcion).toBe('Asistentes de aula');
    expect(clasificarFuncionLevantamientoHeuristica('Tecnico Parvularia NT1').funcion).toBe('Asistentes de aula');
    expect(clasificarFuncionLevantamientoHeuristica('Asistente de Sala').funcion).toBe('Asistentes de aula');
    expect(clasificarFuncionLevantamientoHeuristica('Auxiliar de Parvulo').funcion).toBe('Asistentes de aula');

    // Variantes de Inspectoría
    expect(clasificarFuncionLevantamientoHeuristica('PARADOCENTE DE PATIO').funcion).toBe('Inspectores');
    expect(clasificarFuncionLevantamientoHeuristica('Asistente de Convivencia e Inspectoría').funcion).toBe('Inspectores');
  });

  it('permite exportar una matriz editada manualmente preservando los cambios del usuario', async () => {
    const matrizEditadaManualmente: EstablecimientoLevantamiento = {
      rbd: '12345',
      nombreEstablecimiento: 'LICEO SANTA CLARA',
      comuna: 'BULNES',
      rows: [
        {
          cargoFuncion: 'Asistente técnico de Educación Diferencial',
          cantidadFuncionarios: 3,
          horasSubRegular: 0,
          horasPie: 120,
          horasSep: 0,
          totalHoras: 120,
          observaciones: 'Reclasificado manualmente por el usuario'
        },
        {
          cargoFuncion: 'OTROS Monitor de Robótica',
          cantidadFuncionarios: 1,
          horasSubRegular: 0,
          horasPie: 0,
          horasSep: 20,
          totalHoras: 20,
          observaciones: 'Taller extracurricular SEP',
          isOtro: true
        }
      ],
      totalGeneral: {
        cantidadFuncionarios: 4,
        horasSubRegular: 0,
        horasPie: 120,
        horasSep: 20,
        totalHoras: 140
      }
    };

    const wb = new ExcelJS.Workbook();
    const ws = agregarHojaLevantamientoEstablecimiento(wb, matrizEditadaManualmente, 'Editado');

    expect(ws.getCell('A10').value).toBe('Asistente técnico de Educación Diferencial');
    expect(ws.getCell('B10').value).toBe(3);
    expect(ws.getCell('D10').value).toBe(120);
    expect(ws.getCell('G10').value).toBe('Reclasificado manualmente por el usuario');

    expect(ws.getCell('A11').value).toBe('OTROS Monitor de Robótica');
    expect(ws.getCell('B11').value).toBe(1);
    expect(ws.getCell('E11').value).toBe(20);
    expect(ws.getCell('G11').value).toBe('Taller extracurricular SEP');

    const buffer = await wb.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
