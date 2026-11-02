import { describe, it, expect } from 'vitest';
import { parsearPlanillaSige, limpiarTextoMineduc } from '../src/services/sigeParserService';

describe('SIGE Parser Service con soporte de caracteres hispanos (Ñ, tildes)', () => {
  it('debe limpiar mojibake y rescatar caracteres dañados', () => {
    // Si viene con el caracter corrupto (\ufffd)
    expect(limpiarTextoMineduc('PE\ufffdA')).toBe('PEÑA');
    expect(limpiarTextoMineduc('VENEGAS PE\ufffdA')).toBe('VENEGAS PEÑA');
    expect(limpiarTextoMineduc('GONZ\ufffdLEZ')).toBe('GONZÁLEZ');
    expect(limpiarTextoMineduc('EDUCACI\ufffdN F\ufffdSICA')).toBe('EDUCACIÓN FÍSICA');
  });

  it('no debe alterar nombres legítimos que no contengan caracteres corruptos', () => {
    expect(limpiarTextoMineduc('MARTA')).toBe('MARTA');
    expect(limpiarTextoMineduc('MARTA MARÍA')).toBe('MARTA MARÍA');
    expect(limpiarTextoMineduc('VALENZUELA LAGOS')).toBe('VALENZUELA LAGOS');
  });

  it('debe procesar nómina SIGE real con punto y coma y campos MINEDUC', () => {
    const csvContent = `DOC_RUN;DOC_DV;DOC_NOMBRE;DOC_PATERNO;DOC_MATERNO;DOC_GENERO;DOC_FEC_NAC;RBD;NOMBRE_ESTA;FUNCION_PRINCIPAL;FUNCION_SECUNDARIA;HORAS_CONTRATO;HORAS_INGLES;HORAS_DIRECTIVAS;HORAS_TECNICO_PEDAGOGICA;HORAS_AULA;HORAS_PEDAGOGICAS_FUNCION_1;HORAS_PEDAGOGICAS_FUNCION_2;SECTOR_FUNCION_1;SUB_SECTOR_FUNCION_1;SECTOR_FUNCION_2;SUB_SECTOR_FUNCION_2;ESTADO_IDONEIDAD;
12549653;9;NAYADET CAROLA;VALENZUELA;LAGOS;F;19/01/74;3691;ESCUELA PAUL HARRIS;DOCENTE DE AULA;--;30;0;0;0;26;26;0;GENERAL;GENERAL;--;--;OK;
14359601;K;RODRIGO ALEJANDRO;VENEGAS;PEÑA;M;04/10/78;3691;ESCUELA PAUL HARRIS;DOCENTE DE AULA;--;11;0;0;0;8;6;0;EDUCACIÓN FÍSICA;EDUCACIÓN FÍSICA;--;--;OK;
16222003;9;MARTA MARÍA;LLANOS;GODOY;F;24/03/86;3691;ESCUELA PAUL HARRIS;DOCENTE DE AULA;DOCENTE DE AULA;44;0;0;0;36;24;0;LENGUAJE Y COMUNICACIÓN;LENGUAJE Y COMUNICACIÓN;--;--;OK;
8746092;4;MARÍA EUGENIA;ESCALONA;REYES;F;01/05/64;3691;ESCUELA PAUL HARRIS;DOCENTE DE AULA;--;32;0;0;0;20;20;0;EDUCACIÓN PARVULARIA;EDUCACIÓN PARVULARIA;--;--;OK;
`;

    const res = parsearPlanillaSige(csvContent, '3691', 2027);

    expect(res.rbdDetectado).toBe('3691');
    expect(res.docentesConvertidos.length).toBe(4);

    const venegas = res.docentesConvertidos.find(d => d.run.includes('14359601'));
    expect(venegas).toBeDefined();
    expect(venegas?.nombres).toBe('Rodrigo Alejandro');
    expect(venegas?.apellidos).toBe('Venegas Peña');
    expect(venegas?.horasContrato).toBe(11);
    expect(venegas?.horasAula).toBe(8);
    expect(venegas?.asignaturaPrincipal).toBe('Educación Física');

    const llanos = res.docentesConvertidos.find(d => d.run.includes('16222003'));
    expect(llanos).toBeDefined();
    expect(llanos?.nombres).toBe('Marta María');
    expect(llanos?.apellidos).toBe('Llanos Godoy');
    expect(llanos?.horasContrato).toBe(44);
    expect(llanos?.horasAula).toBe(36);
  });

  it('asocia docentes según la columna RBD y valida contratos en más de un establecimiento (tope legal 44h)', () => {
    // Nómina docente con múltiples establecimientos:
    // - Docente 1 (11222333-4): 22h en RBD 3691 + 22h en RBD 3645 = 44h (PERMITIDO)
    // - Docente 2 (14555666-7): 30h en RBD 3691 + 18h en RBD 3645 = 48h (SOBRECONTRATACIÓN > 44h)
    const csvContentMultiRbd = `DOC_RUN;DOC_DV;DOC_NOMBRE;DOC_PATERNO;DOC_MATERNO;DOC_GENERO;DOC_FEC_NAC;RBD;NOMBRE_ESTA;FUNCION_PRINCIPAL;FUNCION_SECUNDARIA;HORAS_CONTRATO;HORAS_INGLES;HORAS_DIRECTIVAS;HORAS_TECNICO_PEDAGOGICA;HORAS_AULA;HORAS_PEDAGOGICAS_FUNCION_1;HORAS_PEDAGOGICAS_FUNCION_2;SECTOR_FUNCION_1;SUB_SECTOR_FUNCION_1;SECTOR_FUNCION_2;SUB_SECTOR_FUNCION_2;ESTADO_IDONEIDAD;
11222333;4;LUIS ALBERTO;SALAZAR;CAMPOS;M;12/03/75;3691;ESCUELA PAUL HARRIS;DOCENTE DE AULA;--;22;0;0;0;18;18;0;MATEMÁTICA;MATEMÁTICA;--;--;OK;
11222333;4;LUIS ALBERTO;SALAZAR;CAMPOS;M;12/03/75;3645;LICEO VIDA NUEVA;DOCENTE DE AULA;--;22;0;0;0;18;18;0;MATEMÁTICA;MATEMÁTICA;--;--;OK;
14555666;7;CAROLINA ANDREA;FUENTEALBA;TORRES;F;15/07/80;3691;ESCUELA PAUL HARRIS;DOCENTE DE AULA;--;30;0;0;0;24;24;0;LENGUAJE;LENGUAJE;--;--;OK;
14555666;7;CAROLINA ANDREA;FUENTEALBA;TORRES;F;15/07/80;3645;LICEO VIDA NUEVA;DOCENTE DE AULA;--;18;0;0;0;14;14;0;LENGUAJE;LENGUAJE;--;--;OK;
`;

    const res = parsearPlanillaSige(csvContentMultiRbd, undefined, 2027);

    // 1. Detección de ambos RBDs
    expect(res.establecimientosDetectados.length).toBe(2);
    const rbds = res.establecimientosDetectados.map(e => e.rbd);
    expect(rbds).toContain('3691');
    expect(rbds).toContain('3645');

    // 2. Asociación de contratos por columna RBD
    expect(res.docentesConvertidos.length).toBe(4);
    const contratoLuis3691 = res.docentesConvertidos.find(d => d.run.includes('11222333') && d.rbd === '3691');
    const contratoLuis3645 = res.docentesConvertidos.find(d => d.run.includes('11222333') && d.rbd === '3645');
    expect(contratoLuis3691).toBeDefined();
    expect(contratoLuis3691?.horasContrato).toBe(22);
    expect(contratoLuis3645).toBeDefined();
    expect(contratoLuis3645?.horasContrato).toBe(22);

    // 3. Control de funcionarios multi-establecimiento
    expect(res.funcionariosMultiEstablecimiento.length).toBe(2);

    // Luis Salazar: 22h + 22h = 44h (Dentro del límite)
    const multiLuis = res.funcionariosMultiEstablecimiento.find(f => f.run.includes('11222333'));
    expect(multiLuis).toBeDefined();
    expect(multiLuis?.totalHoras).toBe(44);
    expect(multiLuis?.excede44h).toBe(false);

    // Carolina Fuentealba: 30h + 18h = 48h (Excede tope 44h)
    const multiCaro = res.funcionariosMultiEstablecimiento.find(f => f.run.includes('14555666'));
    expect(multiCaro).toBeDefined();
    expect(multiCaro?.totalHoras).toBe(48);
    expect(multiCaro?.excede44h).toBe(true);

    // Advertencia emitida
    const adv = res.advertencias.find(a => a.run.includes('14555666') && a.mensaje.includes('excede el tope legal'));
    expect(adv).toBeDefined();
  });
});
