/**
 * Servicio de Generación de la Planilla GDP (Gestión de Dotación de Personal)
 * Exportación individual por Establecimiento Educacional (RBD)
 * SLEP Valle Diguillín
 */

import ExcelJS from 'exceljs';
import { Docente, AsistenteEducacion, Establecimiento, CursoSae, AsignacionHoraria } from '../types';
import { formatRut, inferirPropuestaGdp } from './depHomologationEngine';

/**
 * Obtiene el buffer de la plantilla oficial GDP
 */
async function obtenerPlantillaGdpBuffer(): Promise<ArrayBuffer> {
  // 1. Intentar cargar desde public/templates (vía fetch en navegador/Electron)
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    try {
      const res = await fetch('./templates/Planilla_GDP_Template.xlsx');
      if (res.ok) {
        return await res.arrayBuffer();
      }
    } catch (_) {}
  }

  // 2. Intentar cargar en entorno Node.js / Electron si está disponible
  if (typeof process !== 'undefined' && (process as any).versions?.node) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const localPath = path.resolve('public/templates/Planilla_GDP_Template.xlsx');
      const buf = await fs.readFile(localPath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch (_) {}
  }

  throw new Error('No se pudo localizar la plantilla base Planilla_GDP_Template.xlsx');
}

/**
 * Genera el libro oficial Excel de la Planilla GDP para un establecimiento específico
 * Respetando estrictamente todas las fórmulas nativas de Excel y rellenando solo las celdas de entrada.
 */
export async function generarExcelGdpColegio(
  establecimiento: Establecimiento,
  docentesColegio: Docente[],
  asistentesColegio: AsistenteEducacion[],
  cursosColegio: CursoSae[] = [],
  asignacionesColegio: AsignacionHoraria[] = []
): Promise<Uint8Array> {
  const plantillaBuffer = await obtenerPlantillaGdpBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(plantillaBuffer);

  // ==========================================
  // HOJA 1: PIE (Programa Integración Escolar)
  // ==========================================
  const wsPie = workbook.getWorksheet('PIE');
  if (wsPie) {
    // 1.1 Docentes Diferenciales PIE (Filas 8 a 35)
    const docPie = docentesColegio.filter(d => 
      (Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0) > 0) ||
      d.estamento === 'DOCENTE_DIFERENCIAL' ||
      /diferencial|pie/i.test(d.titulo || d.funcionPrincipal || '')
    );

    const sumaHorasPieDoc = docPie.reduce((s, d) => s + (Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0) || d.horasContrato || 0), 0);
    // F4: Total horas por asignar (Input)
    wsPie.getCell('F4').value = establecimiento.cupoHorasPieDiferencial || sumaHorasPieDoc;

    let rIdx = 8;
    for (const d of docPie) {
      if (rIdx > 35) break; // Si supera fila 35, se truncan en el bloque predeterminado
      const hPie = (Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0)) || d.horasContrato || 0;
      const hVig = d.horasVigentesAnterior !== undefined ? d.horasVigentesAnterior : hPie;
      const prop = d.propuestaGdp || inferirPropuestaGdp(hVig, hPie, false);

      const row = wsPie.getRow(rIdx);
      // Col B conserva su numeración nativa
      row.getCell('C').value = `${d.nombres} ${d.apellidos}`.trim().toUpperCase();
      row.getCell('D').value = formatRut(d.run);
      row.getCell('E').value = 'Docente Diferencial';
      row.getCell('G').value = (Number(d.horasPieTitular || 0) > 0 || d.calidadJuridica === 'TITULAR') ? 'Titular' : 'Contrata';
      row.getCell('H').value = d.fechaTerminoContrato || (d.calidadJuridica === 'TITULAR' ? '-' : '28-02-2027');
      row.getCell('I').value = hVig;
      row.getCell('J').value = prop;
      row.getCell('K').value = hPie; // Horas solicitadas
      row.getCell('L').value = d.observacionesDirector || '';
      row.getCell('M').value = d.estadoSancionGdp || 'Pendiente';
      row.getCell('N').value = d.horasAprobadasGdp || hPie;
      row.getCell('O').value = d.observacionesSlep || '';
      row.commit();
      rIdx++;
    }
    // Limpiar celdas sobrantes del bloque 1
    for (let r = rIdx; r <= 35; r++) {
      const row = wsPie.getRow(r);
      ['C', 'D', 'G', 'H', 'I', 'J', 'K', 'L', 'N', 'O'].forEach(col => {
        row.getCell(col).value = null;
      });
      row.getCell('M').value = 'Pendiente';
      row.commit();
    }

    // 1.2 Asistentes de la Educación PIE (Filas 43 a 55)
    const aePie = asistentesColegio.filter(a => 
      (Number(a.horasPieIndefinido || 0) + Number(a.horasPiePlazoFijo || 0) > 0) || a.esEquipoPie
    );

    const sumaHorasPieAe = aePie.reduce((s, a) => s + (Number(a.horasPieIndefinido || 0) + Number(a.horasPiePlazoFijo || 0) || a.horasContrato || 0), 0);
    // F39: Total horas por asignar Asistentes PIE (Input)
    wsPie.getCell('F39').value = establecimiento.cupoHorasPieAsistentes || sumaHorasPieAe;

    let rAeIdx = 43;
    for (const a of aePie) {
      if (rAeIdx > 55) break;
      const hPie = (Number(a.horasPieIndefinido || 0) + Number(a.horasPiePlazoFijo || 0)) || a.horasContrato || 0;
      const hVig = a.horasVigentesAnterior !== undefined ? a.horasVigentesAnterior : hPie;
      const prop = a.propuestaGdp || inferirPropuestaGdp(hVig, hPie, false);

      const row = wsPie.getRow(rAeIdx);
      row.getCell('C').value = `${a.nombres} ${a.apellidos}`.trim().toUpperCase();
      row.getCell('D').value = formatRut(a.run);
      row.getCell('E').value = a.cargoFuncion || 'Psicólogo/a';
      row.getCell('G').value = (Number(a.horasPieIndefinido || 0) > 0) ? 'COD. DEL TRAB.' : 'COD. DEL TRAB.';
      row.getCell('H').value = a.fechaTerminoContrato || '28-02-2027';
      row.getCell('I').value = hVig;
      row.getCell('J').value = prop;
      row.getCell('K').value = hPie;
      row.getCell('L').value = a.observacionesDirector || '';
      row.getCell('M').value = a.estadoSancionGdp || 'Pendiente';
      row.getCell('N').value = a.horasAprobadasGdp || hPie;
      row.getCell('O').value = a.observacionesSlep || '';
      row.commit();
      rAeIdx++;
    }
    for (let r = rAeIdx; r <= 55; r++) {
      const row = wsPie.getRow(r);
      ['C', 'D', 'E', 'G', 'H', 'I', 'J', 'K', 'L', 'N', 'O'].forEach(col => {
        row.getCell(col).value = null;
      });
      row.getCell('M').value = 'Pendiente';
      row.commit();
    }

    // 1.3 Trabajo Colaborativo PIE (Filas 64 a 83)
    const docColab = docentesColegio.filter(d => 
      Number(d.horasTrabajoColaborativo || 0) > 0 ||
      asignacionesColegio.some(asg => asg.docenteId === d.id && (asg.esTrabajoColaborativo || /colaborativo|decreto 170/i.test(asg.tipoApoyo || '')))
    );

    let rColabIdx = 64;
    for (const d of docColab) {
      if (rColabIdx > 83) break;
      const row = wsPie.getRow(rColabIdx);
      const hColab = Number(d.horasTrabajoColaborativo || 0) || 3;
      row.getCell('C').value = `${d.nombres} ${d.apellidos}`.trim().toUpperCase();
      row.getCell('D').value = formatRut(d.run);
      row.getCell('E').value = d.fechaInicioContrato || '01-03-2026';
      row.getCell('F').value = d.fechaTerminoContrato || '28-02-2027';
      row.getCell('K').value = hColab;
      // Col N tiene fórmula nativa =K64
      row.getCell('N').value = { formula: `K${rColabIdx}` };
      row.getCell('J').value = 'Aprobado';
      row.commit();
      rColabIdx++;
    }
  }

  // ==========================================
  // HOJA 2: SEP (Subvención Escolar Preferencial)
  // ==========================================
  const wsSep = workbook.getWorksheet('SEP');
  if (wsSep) {
    // D4: Subvención disponible agosto (Input)
    wsSep.getCell('D4').value = establecimiento.subvencionSepMensual || 0;

    // Filtrar todo personal financiado con SEP (Docentes + AA.EE.)
    const sepDoc = docentesColegio
      .filter(d => (Number(d.horasSepTitular || 0) + Number(d.horasSepContrata || 0) + Number(d.horasTallerSep || 0) > 0))
      .map(d => ({
        tipo: 'DOCENTE',
        run: d.run,
        nombre: `${d.nombres} ${d.apellidos}`.trim(),
        formacion: d.titulo || d.funcionPrincipal || 'Docente aula',
        contrato: Number(d.horasSepTitular || 0) > 0 ? 'Titular' : 'Contrata',
        fechaTermino: d.fechaTerminoContrato || '28-02-2027',
        horasVig: d.horasVigentesAnterior || (Number(d.horasSepTitular || 0) + Number(d.horasSepContrata || 0)),
        horasSol: Number(d.horasSepTitular || 0) + Number(d.horasSepContrata || 0) + Number(d.horasTallerSep || 0),
        remuApp: d.remuneracionMensualApp || 0,
        propuesta: d.propuestaGdp,
        accionPme: d.accionPmeSep || 'Acción PME',
        descFuncion: d.descripcionFuncionGdp || 'Apoyo Pedagógico SEP',
        obsDir: d.observacionesDirector || '',
        estado: d.estadoSancionGdp || 'Pendiente',
        aprobadas: d.horasAprobadasGdp || 0
      }));

    const sepAe = asistentesColegio
      .filter(a => (Number(a.horasSepIndefinido || 0) + Number(a.horasSepPlazoFijo || 0) > 0))
      .map(a => ({
        tipo: 'ASISTENTE',
        run: a.run,
        nombre: `${a.nombres} ${a.apellidos}`.trim(),
        formacion: a.cargoFuncion || 'Asistente Aula (técnico)',
        contrato: Number(a.horasSepIndefinido || 0) > 0 ? 'Indefinido' : 'Plazo Fijo',
        fechaTermino: a.fechaTerminoContrato || '28-02-2027',
        horasVig: a.horasVigentesAnterior || (Number(a.horasSepIndefinido || 0) + Number(a.horasSepPlazoFijo || 0)),
        horasSol: Number(a.horasSepIndefinido || 0) + Number(a.horasSepPlazoFijo || 0),
        remuApp: a.remuneracionMensualApp || 0,
        propuesta: a.propuestaGdp,
        accionPme: a.accionPmeSep || 'Acción PME',
        descFuncion: a.descripcionFuncionGdp || 'Asistencia de Aula SEP',
        obsDir: a.observacionesDirector || '',
        estado: a.estadoSancionGdp || 'Pendiente',
        aprobadas: a.horasAprobadasGdp || 0
      }));

    const todosSep = [...sepDoc, ...sepAe];
    let rSepIdx = 9;

    for (const item of todosSep) {
      if (rSepIdx > 33) break;
      const row = wsSep.getRow(rSepIdx);
      const prop = item.propuesta || inferirPropuestaGdp(item.horasVig, item.horasSol, false);

      row.getCell('C').value = item.nombre.toUpperCase();
      row.getCell('D').value = formatRut(item.run);
      row.getCell('E').value = item.formacion;
      row.getCell('F').value = item.tipo;
      row.getCell('G').value = item.contrato;
      row.getCell('H').value = item.fechaTermino;
      row.getCell('I').value = item.horasVig;
      row.getCell('J').value = item.remuApp;
      // Formula nativa K: =(J/I)
      row.getCell('K').value = { formula: `IF(I${rSepIdx}>0,J${rSepIdx}/I${rSepIdx},0)` };
      row.getCell('L').value = prop;
      row.getCell('M').value = item.horasSol;
      // Formula nativa N: =IFERROR((M*K),0)
      row.getCell('N').value = { formula: `IFERROR(M${rSepIdx}*K${rSepIdx},0)` };
      row.getCell('O').value = item.accionPme;
      row.getCell('P').value = item.descFuncion;
      row.getCell('Q').value = item.obsDir;
      row.getCell('R').value = item.estado;
      row.getCell('S').value = item.aprobadas || item.horasSol;
      row.commit();
      rSepIdx++;
    }

    // Limpiar filas no usadas conservando las fórmulas seguras
    for (let r = rSepIdx; r <= 33; r++) {
      const row = wsSep.getRow(r);
      ['C', 'D', 'E', 'F', 'G', 'H', 'L', 'O', 'P', 'Q', 'S'].forEach(col => {
        row.getCell(col).value = null;
      });
      row.getCell('I').value = 0;
      row.getCell('J').value = 0;
      row.getCell('K').value = { formula: `IF(I${r}>0,J${r}/I${r},0)` };
      row.getCell('M').value = 0;
      row.getCell('N').value = { formula: `IFERROR(M${r}*K${r},0)` };
      row.getCell('R').value = 'Pendiente';
      row.commit();
    }
  }

  // ==========================================
  // HOJA 3: Subv. Normal - Docentes Titulares
  // ==========================================
  const wsTit = workbook.getWorksheet('Subv. Normal - Docentes Tit');
  if (wsTit) {
    const docTit = docentesColegio.filter(d => 
      Number(d.horasSubvencionGeneralTitular || 0) > 0 ||
      (d.calidadJuridica === 'TITULAR' && d.horasContrato > 0)
    );

    let rTitIdx = 8;
    for (const d of docTit) {
      if (rTitIdx > 46) break;
      const hSubv = Number(d.horasSubvencionGeneralTitular || 0) || d.horasContrato || 0;
      const hVig = d.horasVigentesAnterior !== undefined ? d.horasVigentesAnterior : hSubv;
      const prop = d.propuestaGdp || inferirPropuestaGdp(hVig, hSubv, false);

      const row = wsTit.getRow(rTitIdx);
      row.getCell('C').value = `${d.nombres} ${d.apellidos}`.trim().toUpperCase();
      row.getCell('D').value = formatRut(d.run);
      row.getCell('E').value = 'Titular';
      row.getCell('F').value = d.funcionPrincipal || d.cargoInstitucional || 'Docente aula';
      row.getCell('G').value = hVig;
      row.getCell('H').value = prop;
      row.getCell('I').value = hSubv;
      row.getCell('J').value = d.observacionesDirector || '';
      row.getCell('K').value = d.estadoSancionGdp || 'Pendiente';
      row.getCell('L').value = d.horasAprobadasGdp || hSubv;
      row.getCell('M').value = d.observacionesSlep || '';
      row.getCell('O').value = d.fechaInicioContrato || '01-03-2026';
      row.getCell('P').value = 'Indefinido';
      row.getCell('Q').value = d.situacionFinalGdp || 'Vigente';
      row.commit();
      rTitIdx++;
    }

    for (let r = rTitIdx; r <= 46; r++) {
      const row = wsTit.getRow(r);
      ['C', 'D', 'F', 'H', 'J', 'L', 'M', 'O', 'P'].forEach(col => {
        row.getCell(col).value = null;
      });
      row.getCell('G').value = 0;
      row.getCell('I').value = 0;
      row.getCell('K').value = 'Pendiente';
      row.getCell('Q').value = 'Vigente';
      row.commit();
    }
  }

  // ==========================================
  // HOJA 4: Subv. Normal - Docentes Contrata
  // ==========================================
  const wsCtta = workbook.getWorksheet('Subv. Normal - Docentes Ctta.');
  if (wsCtta) {
    const docCtta = docentesColegio.filter(d => 
      Number(d.horasSubvencionGeneralContrata || 0) > 0 ||
      (d.calidadJuridica === 'CONTRATA' && d.horasContrato > 0)
    );

    // Segmentar contratas por nivel de enseñanza
    const cttaParvula = docCtta.filter(d => /párvulo|parvulo/i.test(d.titulo || d.funcionPrincipal || ''));
    const cttaMedia = docCtta.filter(d => !cttaParvula.includes(d) && (/medio|media|tp|técnico|tecnico/i.test(d.funcionPrincipal || d.asignaturaPrincipal || '')));
    const cttaBasica = docCtta.filter(d => !cttaParvula.includes(d) && !cttaMedia.includes(d));

    const llenarBloque = (docentesNivel: Docente[], startRow: number, endRow: number) => {
      let r = startRow;
      for (const d of docentesNivel) {
        if (r > endRow) break;
        const hCtta = Number(d.horasSubvencionGeneralContrata || 0) || d.horasContrato || 0;
        const row = wsCtta.getRow(r);

        row.getCell('C').value = `${d.nombres} ${d.apellidos}`.trim().toUpperCase();
        row.getCell('D').value = formatRut(d.run);
        row.getCell('E').value = d.titulo || d.funcionPrincipal || 'Docente aula';
        row.getCell('I').value = hCtta; // Horas por asignar
        row.getCell('J').value = hCtta; // Horas solicitadas
        // Formula K: =IF(SUM(J)<>I,"Revisar","Correcto")
        row.getCell('K').value = { formula: `IF(SUM(J${r})<>I${r},"Revisar","Correcto")` };
        row.getCell('L').value = d.observacionesDirector || '';
        row.getCell('M').value = d.estadoSancionGdp || 'Pendiente';
        row.getCell('N').value = d.horasAprobadasGdp || hCtta;
        row.getCell('O').value = d.observacionesSlep || '';
        row.commit();
        r++;
      }
      for (let emptyRow = r; emptyRow <= endRow; emptyRow++) {
        const row = wsCtta.getRow(emptyRow);
        ['C', 'D', 'L', 'N', 'O'].forEach(col => {
          row.getCell(col).value = null;
        });
        row.getCell('I').value = 0;
        row.getCell('J').value = 0;
        row.getCell('K').value = { formula: `IF(SUM(J${emptyRow})<>I${emptyRow},"Revisar","Correcto")` };
        row.getCell('M').value = 'Pendiente';
        row.commit();
      }
    };

    // Bloque Parvularia: 10 a 12
    llenarBloque(cttaParvula, 10, 12);
    // Bloque Básica: 20 a 41
    llenarBloque(cttaBasica, 20, 41);
    // Bloque Media: 49 a 66
    llenarBloque(cttaMedia, 49, 66);
  }

  // ==========================================
  // HOJA 5: Subv. Normal AA.EE (Asistentes)
  // ==========================================
  const wsAeNormal = workbook.getWorksheet('Subv. Normal AA.EE');
  if (wsAeNormal) {
    const aeNormal = asistentesColegio.filter(a => 
      Number(a.horasSubvencionGeneralIndefinido || 0) + Number(a.horasSubvencionGeneralPlazoFijo || 0) > 0 ||
      (Number(a.horasPieIndefinido || 0) === 0 && Number(a.horasSepIndefinido || 0) === 0)
    );

    let rAeIdx = 8;
    for (const a of aeNormal) {
      if (rAeIdx > 37) break;
      const hGral = (Number(a.horasSubvencionGeneralIndefinido || 0) + Number(a.horasSubvencionGeneralPlazoFijo || 0)) || a.horasContrato || 0;
      const hVig = a.horasVigentesAnterior !== undefined ? a.horasVigentesAnterior : hGral;
      const prop = a.propuestaGdp || inferirPropuestaGdp(hVig, hGral, false);

      const row = wsAeNormal.getRow(rAeIdx);
      row.getCell('C').value = `${a.nombres} ${a.apellidos}`.trim().toUpperCase();
      row.getCell('D').value = formatRut(a.run);
      row.getCell('E').value = 'COD. DEL TRAB.';
      row.getCell('F').value = a.fechaTerminoContrato || 'Indefinido';
      row.getCell('G').value = a.cargoFuncion || 'Auxiliar';
      row.getCell('H').value = hVig;
      row.getCell('I').value = prop;
      row.getCell('J').value = hGral;
      row.getCell('K').value = a.observacionesDirector || '';
      row.getCell('L').value = a.estadoSancionGdp || 'Pendiente';
      row.getCell('M').value = a.horasAprobadasGdp || hGral;
      row.getCell('N').value = a.observacionesSlep || '';
      row.getCell('P').value = a.fechaInicioContrato || '01-03-2026';
      row.getCell('Q').value = a.fechaTerminoContrato || 'Indefinido';
      row.getCell('R').value = a.situacionFinalGdp || 'Vigente';
      row.commit();
      rAeIdx++;
    }

    for (let r = rAeIdx; r <= 37; r++) {
      const row = wsAeNormal.getRow(r);
      ['C', 'D', 'F', 'G', 'I', 'K', 'L', 'M', 'N', 'P', 'Q', 'R'].forEach(col => {
        row.getCell(col).value = null;
      });
      row.getCell('H').value = 0;
      row.getCell('J').value = 0;
      row.getCell('L').value = 'Pendiente';
      row.commit();
    }
  }

  // ==========================================
  // HOJA 6: Pro-Retención
  // ==========================================
  const wsProRet = workbook.getWorksheet('Pro-Retención') || workbook.getWorksheet('Pro-Retencin');
  if (wsProRet) {
    wsProRet.getCell('D4').value = establecimiento.subvencionProRetencion || 0;

    const proRetStaff = [
      ...docentesColegio.filter(d => Number(d.horasProRetencion || 0) > 0),
      ...asistentesColegio.filter(a => Number(a.horasProRetencion || 0) > 0)
    ];

    let rProIdx = 9;
    for (const item of proRetStaff) {
      if (rProIdx > 14) break;
      const hPro = Number(item.horasProRetencion || 0);
      const row = wsProRet.getRow(rProIdx);

      row.getCell('C').value = `${item.nombres} ${item.apellidos}`.trim().toUpperCase();
      row.getCell('D').value = formatRut(item.run);
      row.getCell('E').value = (item as any).titulo || (item as any).cargoFuncion || 'Monitor/a';
      row.getCell('F').value = 'COD.TRAB. PRORETENCIÓN';
      row.getCell('G').value = item.fechaTerminoContrato || '28-02-2027';
      row.getCell('H').value = hPro;
      row.getCell('I').value = item.remuneracionMensualApp || 0;
      // Formula J: =(I/H)
      row.getCell('J').value = { formula: `IF(H${rProIdx}>0,I${rProIdx}/H${rProIdx},0)` };
      row.getCell('K').value = item.propuestaGdp || 'Continuidad';
      row.getCell('L').value = hPro;
      // Formula M: =IFERROR((L*J),0)
      row.getCell('M').value = { formula: `IFERROR(L${rProIdx}*J${rProIdx},0)` };
      row.getCell('O').value = item.accionPmeSep || 'Retención Escolar';
      row.getCell('P').value = item.descripcionFuncionGdp || 'Acompañamiento y Tutoría';
      row.getCell('Q').value = item.observacionesDirector || '';
      row.getCell('R').value = item.estadoSancionGdp || 'Pendiente';
      row.getCell('S').value = item.horasAprobadasGdp || hPro;
      row.getCell('V').value = item.fechaInicioContrato || '01-03-2026';
      row.getCell('W').value = item.fechaTerminoContrato || '28-02-2027';
      // Formula X: =DATEDIF(V,W,"YM")+1
      row.getCell('X').value = { formula: `IF(AND(ISNUMBER(V${rProIdx}),ISNUMBER(W${rProIdx})),DATEDIF(V${rProIdx},W${rProIdx},"YM")+1,12)` };
      // Formula N: =M*X
      row.getCell('N').value = { formula: `M${rProIdx}*X${rProIdx}` };
      row.commit();
      rProIdx++;
    }

    for (let r = rProIdx; r <= 14; r++) {
      const row = wsProRet.getRow(r);
      ['C', 'D', 'E', 'G', 'K', 'O', 'P', 'Q', 'S', 'V', 'W'].forEach(col => {
        row.getCell(col).value = null;
      });
      row.getCell('H').value = 0;
      row.getCell('I').value = 0;
      row.getCell('J').value = { formula: `IF(H${r}>0,I${r}/H${r},0)` };
      row.getCell('L').value = 0;
      row.getCell('M').value = { formula: `IFERROR(L${r}*J${r},0)` };
      row.getCell('X').value = 12;
      row.getCell('N').value = { formula: `M${r}*X${r}` };
      row.getCell('R').value = 'Pendiente';
      row.commit();
    }
  }

  const outBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(outBuffer);
}
