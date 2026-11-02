import { describe, it, expect } from 'vitest';
import { parsearAsistentesSige, esEncabezadoAsistentesSige } from '../src/services/sigeAsistentesParser';

const NOMINA_SIGE_MUESTRA = `ASISTENTE_RUN;ASISTENTE_DV;ASISTENTE_NOMBRE;ASISTENTE_PATERNO;ASISTENTE_MATERNO;ASISTENTE_GENERO;FECHA_NACIMIENTO;RBD;NOMBRE_ESTA;ASISTENTE_TITULO;INSTITUCION;DURACION_CARRERA;HORAS_CONTRATO;FUNCION_UNO;ANIOS_FUNCION_UNO;HORAS_FUNCION_UNO;FUNCION_DOS;ANIOS_FUNCION_DOS;HORAS_FUNCION_DOS;ESTADO_ASISTENTE;
10177332;9;VERNICA JEANNETTE;PINO;URRUTIA;F;19/10/1963;3645;LICEO VIDA NUEVA;SIN TTULO;NINGUNA;0;44;INSPECTOR/A;37;44;SIN DATO / AGREGAR;0;0;HABILITADO;
9733582;6;MARA ELBA;WALL;CARTES;F;13/06/1962;3645;LICEO VIDA NUEVA;SIN TTULO;NINGUNA;0;44;INSPECTOR/A;0;44;SIN DATO / AGREGAR;0;0;HABILITADO;
27083099;4;JAVIER ALEJANDRO;ARIAS;AEZ;M;27/06/1984;3645;LICEO VIDA NUEVA;SIN TTULO;NINGUNA;0;44;AUXILIAR DE ASEO;0;22;ENCARGADO/A DE MANTENCIN;0;22;HABILITADO;
17062989;2;ALEXANDRA DE LAS MERCEDES;CASTRO;MEDINA;F;21/06/1989;3645;LICEO VIDA NUEVA;PSICLOGO;UNIVERSIDAD DEL BIO-BIO;10;10;PSICLOGO/A;2;10;SIN DATO / AGREGAR;0;0;HABILITADO;
15159499;9;SANDRA DEL CARMEN;SEPLVEDA;CCERES;F;17/09/1983;3645;LICEO VIDA NUEVA;OTRO TTULO PROFESIONAL;DIEGO PORTALES;6;44;INSPECTOR/A;0;44;SIN DATO / AGREGAR;0;0;HABILITADO;
12549570;2;JOS MANUEL;AGUILERA;MUOZ;M;14/01/1974;3645;LICEO VIDA NUEVA;SIN TTULO;NINGUNA;0;44;INSPECTOR/A;25;40;ASISTENTE ADMINISTRATIVO;25;4;HABILITADO;
11148528;3;MARA SANDRA CAROLINA;LLANOS;PANTOJA;F;15/09/1967;3645;LICEO VIDA NUEVA;SIN TTULO;NINGUNA;0;36;MONITOR/A TALLER;0;36;SIN DATO / AGREGAR;0;0;HABILITADO;
10369247;4;CLAUDIA ISABEL;RIED;SALINAS;F;12/05/1964;3645;LICEO VIDA NUEVA;SIN TTULO;NINGUNA;0;44;AUXILIAR DE ASEO;0;44;SIN DATO / AGREGAR;0;0;HABILITADO;`;

describe('Parser Oficial SIGE Asistentes de la Educación', () => {
  it('detecta correctamente la cabecera de Asistentes SIGE', () => {
    expect(esEncabezadoAsistentesSige('ASISTENTE_RUN;ASISTENTE_DV;ASISTENTE_NOMBRE...')).toBe(true);
    expect(esEncabezadoAsistentesSige('DOC_RUN;DOC_DV;DOC_NOMBRE...')).toBe(false);
  });

  it('parsea la nómina SIGE oficial rescatando tildes, eñes y dobles funciones', () => {
    const res = parsearAsistentesSige(NOMINA_SIGE_MUESTRA, '3645', 2026);

    expect(res.rbdDetectado).toBe('3645');
    expect(res.nombreColegioDetectado.toUpperCase()).toContain('LICEO VIDA NUEVA');
    expect(res.filas.length).toBe(8);
    expect(res.asistentesConvertidos.length).toBe(8);
    expect(res.totales.totalAsistentes).toBe(8);

    // Horas totales: 44 + 44 + 44 + 10 + 44 + 44 + 36 + 44 = 310
    expect(res.totales.totalHorasContrato).toBe(310);

    // 1. Verónica Jeannette Pino Urrutia (Rescate de tilde en Verónica)
    const veronica = res.asistentesConvertidos.find(a => a.run === '10177332-9');
    expect(veronica).toBeDefined();
    expect(veronica?.nombres).toBe('Verónica Jeannette');
    expect(veronica?.apellidos).toBe('Pino Urrutia');
    expect(veronica?.horasContrato).toBe(44);
    expect(veronica?.cargoFuncion).toBe('INSPECTOR/A');
    expect(veronica?.esInspectorPatio).toBe(true);
    expect(veronica?.estamento).toBe('PARADOCENTE_INSPECTORIA');

    // 2. María Elba Wall Cartes (Rescate de tilde en María)
    const maria = res.asistentesConvertidos.find(a => a.run === '9733582-6');
    expect(maria).toBeDefined();
    expect(maria?.nombres).toBe('María Elba');
    expect(maria?.apellidos).toBe('Wall Cartes');

    // 3. Javier Alejandro Arias Añez (Rescate de la letra Ñ en Añez, Mantención, y bivalencia funcional)
    const javier = res.asistentesConvertidos.find(a => a.run === '27083099-4');
    expect(javier).toBeDefined();
    expect(javier?.nombres).toBe('Javier Alejandro');
    expect(javier?.apellidos).toBe('Arias Añez');
    expect(javier?.horasContrato).toBe(44);
    expect(javier?.cargoFuncion).toContain('AUXILIAR DE ASEO (22h)');
    expect(javier?.cargoFuncion).toContain('ENCARGADO/A DE MANTENCIÓN (22h)');
    expect(javier?.estamento).toBe('AUXILIAR');
    expect(javier?.esAuxiliarServicio).toBe(true);

    // 4. Alexandra De Las Mercedes Castro Medina (Psicóloga 10h, Dupla Psicosocial)
    const alexandra = res.asistentesConvertidos.find(a => a.run === '17062989-2');
    expect(alexandra).toBeDefined();
    expect(alexandra?.horasContrato).toBe(10);
    expect(alexandra?.estamento).toBe('PROFESIONAL');
    expect(alexandra?.esDuplaPsicosocial).toBe(true);
    expect(alexandra?.observaciones).toContain('Título: PSICÓLOGO (UNIVERSIDAD DEL BIO-BIO)');

    // 5. Sandra Del Carmen Sepúlveda Cáceres (Rescate de tildes en Sepúlveda y Cáceres)
    const sandra = res.asistentesConvertidos.find(a => a.run === '15159499-9');
    expect(sandra).toBeDefined();
    expect(sandra?.nombres).toBe('Sandra Del Carmen');
    expect(sandra?.apellidos).toBe('Sepúlveda Cáceres');

    // 6. José Manuel Aguilera Muñoz (Rescate de tildes en José y Ñ en Muñoz, doble función 40h + 4h)
    const jose = res.asistentesConvertidos.find(a => a.run === '12549570-2');
    expect(jose).toBeDefined();
    expect(jose?.nombres).toBe('José Manuel');
    expect(jose?.apellidos).toBe('Aguilera Muñoz');
    expect(jose?.cargoFuncion).toContain('INSPECTOR/A (40h)');
    expect(jose?.cargoFuncion).toContain('ASISTENTE ADMINISTRATIVO (4h)');
    expect(jose?.horasContrato).toBe(44);

    // 7. María Sandra Carolina Llanos Pantoja (36h, Monitor/a Taller)
    const sandraLlanos = res.asistentesConvertidos.find(a => a.run === '11148528-3');
    expect(sandraLlanos).toBeDefined();
    expect(sandraLlanos?.nombres).toBe('María Sandra Carolina');
    expect(sandraLlanos?.horasContrato).toBe(36);
    expect(sandraLlanos?.cargoFuncion).toBe('MONITOR/A TALLER');

    // 8. Claudia Isabel Ried Salinas (44h, Auxiliar de Aseo)
    const claudia = res.asistentesConvertidos.find(a => a.run === '10369247-4');
    expect(claudia).toBeDefined();
    expect(claudia?.nombres).toBe('Claudia Isabel');
    expect(claudia?.apellidos).toBe('Ried Salinas');
    expect(claudia?.estamento).toBe('AUXILIAR');
    expect(claudia?.esAuxiliarServicio).toBe(true);
  });

  it('asocia asistentes según la columna RBD y valida contratos en más de un establecimiento (tope legal 44h)', () => {
    // Nómina con múltiples establecimientos:
    // - Funcionario 1 (18111222-3): 20h en RBD 3645 + 24h en RBD 3543 = 44h (PERMITIDO)
    // - Funcionario 2 (19333444-5): 30h en RBD 3645 + 20h en RBD 3543 = 50h (SOBRECONTRATACIÓN > 44h)
    // - Funcionario 3 (15777888-9): 44h solo en RBD 3543 (REGULAR)
    const nominaMultiRbd = `ASISTENTE_RUN;ASISTENTE_DV;ASISTENTE_NOMBRE;ASISTENTE_PATERNO;ASISTENTE_MATERNO;ASISTENTE_GENERO;FECHA_NACIMIENTO;RBD;NOMBRE_ESTA;ASISTENTE_TITULO;INSTITUCION;DURACION_CARRERA;HORAS_CONTRATO;FUNCION_UNO;ANIOS_FUNCION_UNO;HORAS_FUNCION_UNO;FUNCION_DOS;ANIOS_FUNCION_DOS;HORAS_FUNCION_DOS;ESTADO_ASISTENTE;
18111222;3;CARLOS ALBERTO;MENDOZA;RIVAS;M;10/05/1990;3645;LICEO VIDA NUEVA;TÉCNICO EN INFORMÁTICA;INACAP;4;20;SOPORTE TÉCNICO;2;20;SIN DATO / AGREGAR;0;0;HABILITADO;
18111222;3;CARLOS ALBERTO;MENDOZA;RIVAS;M;10/05/1990;3543;ESCUELA PUEBLO SECO;TÉCNICO EN INFORMÁTICA;INACAP;4;24;SOPORTE TÉCNICO;1;24;SIN DATO / AGREGAR;0;0;HABILITADO;
19333444;5;GLORIA MARCELA;PARRA;SILVA;F;12/08/1992;3645;LICEO VIDA NUEVA;PSICÓLOGA;UNIVERSIDAD DE CONCEPCIÓN;10;30;PSICÓLOGO/A;3;30;SIN DATO / AGREGAR;0;0;HABILITADO;
19333444;5;GLORIA MARCELA;PARRA;SILVA;F;12/08/1992;3543;ESCUELA PUEBLO SECO;PSICÓLOGA;UNIVERSIDAD DE CONCEPCIÓN;10;20;PSICÓLOGO/A;1;20;SIN DATO / AGREGAR;0;0;HABILITADO;
15777888;9;PABLO ANDRÉS;SOTO;VERA;M;01/02/1985;3543;ESCUELA PUEBLO SECO;SIN TÍTULO;NINGUNA;0;44;AUXILIAR DE ASEO;5;44;SIN DATO / AGREGAR;0;0;HABILITADO;`;

    const res = parsearAsistentesSige(nominaMultiRbd, undefined, 2026);

    // 1. Debe haber detectado ambos colegios a través de la columna RBD
    expect(res.establecimientosDetectados.length).toBe(2);
    const rbdsDetectados = res.establecimientosDetectados.map(e => e.rbd);
    expect(rbdsDetectados).toContain('3645');
    expect(rbdsDetectados).toContain('3543');

    // 2. Cada contrato debe estar asociado al RBD de su propia fila
    expect(res.asistentesConvertidos.length).toBe(5);
    const contratoCarlos3645 = res.asistentesConvertidos.find(a => a.run === '18111222-3' && a.rbd === '3645');
    const contratoCarlos3543 = res.asistentesConvertidos.find(a => a.run === '18111222-3' && a.rbd === '3543');
    expect(contratoCarlos3645).toBeDefined();
    expect(contratoCarlos3645?.horasContrato).toBe(20);
    expect(contratoCarlos3543).toBeDefined();
    expect(contratoCarlos3543?.horasContrato).toBe(24);

    // 3. Control de funcionarios multi-establecimiento
    expect(res.funcionariosMultiEstablecimiento.length).toBe(2);

    // Carlos Mendoza: 20 + 24 = 44h -> VÁLIDO (no excede)
    const multiCarlos = res.funcionariosMultiEstablecimiento.find(f => f.run === '18111222-3');
    expect(multiCarlos).toBeDefined();
    expect(multiCarlos?.totalHoras).toBe(44);
    expect(multiCarlos?.excede44h).toBe(false);
    expect(multiCarlos?.rbds).toEqual(['3645', '3543']);

    // Gloria Parra: 30 + 20 = 50h -> EXCEDE TOPE 44h (alerta normativa)
    const multiGloria = res.funcionariosMultiEstablecimiento.find(f => f.run === '19333444-5');
    expect(multiGloria).toBeDefined();
    expect(multiGloria?.totalHoras).toBe(50);
    expect(multiGloria?.excede44h).toBe(true);

    // Debe existir advertencia de sobrecontratación en advertencias
    const advSobrecontratacion = res.advertencias.find(a => a.run === '19333444-5' && a.mensaje.includes('excede el tope legal'));
    expect(advSobrecontratacion).toBeDefined();
  });
});
