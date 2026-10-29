import { persistDb } from '../dbCore';
import { MatrizExcelParseResult, CursoSae, Docente, AsignacionHoraria } from '../../types';
import { listarCursos, guardarCurso } from './cursosRepo';
import { guardarDocente } from './docentesRepo';
import { guardarAsignacion } from './asignacionesRepo';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../../data/slepSchoolsCatalog';

export async function guardarMatrizExcelEnDb(
  result: MatrizExcelParseResult,
  rbdDestino: string,
  periodoDestino: number = 2026
): Promise<{ cursosNuevos: number; docentesGuardados: number; asignacionesGuardadas: number }> {
  const cursosExistentes = await listarCursos(rbdDestino, periodoDestino);
  let cursosNuevos = 0;

  const cursoMap = new Map<string, CursoSae>();
  for (const c of cursosExistentes) {
    const key = `${c.nivel}_${c.letra}`.toUpperCase();
    cursoMap.set(key, c);
  }

  for (const cDet of result.cursos) {
    const key = `${cDet.nivel}_${cDet.letra}`.toUpperCase();
    if (!cursoMap.has(key)) {
      const nuevoCursoId = `curso_${rbdDestino}_${periodoDestino}_${cDet.nivel}_${cDet.letra}`.replace(/[\s°]/g, '_');
      const nuevoCurso: CursoSae = {
        id: nuevoCursoId,
        rbd: rbdDestino,
        periodo: periodoDestino,
        nivel: cDet.nivel,
        letra: cDet.letra,
        regimen: cDet.regimen,
        cupoSae: 35,
        matriculaProyectada: 30,
        alumnosNeet: 5,
        alumnosNeep: 2
      };
      await guardarCurso(nuevoCurso);
      cursoMap.set(key, nuevoCurso);
      cursosNuevos++;
    }
  }

  let docentesGuardados = 0;
  const docenteMap = new Map<string, Docente>();

  const catalogoSchool = SLEP_VALLE_DIGUILLIN_SCHOOLS.find(s => s.rbd === rbdDestino);
  const directorCatalogNorm = (catalogoSchool?.director || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  for (const d of result.docentes) {
    const calidadJuridica = (d.contrataSubGral > 0 || d.contrataSep > 0 || d.contrataPie > 0) &&
      (d.titularSubGral === 0 && d.titularSep === 0 && d.titularPie === 0) ? 'CONTRATA' : 'TITULAR';
    const totalHorasAula = d.totalHa || d.asignaciones.reduce((s, a) => s + a.horasPedagogicasAula, 0);

    const docNomNorm = `${d.nombres} ${d.apellidos}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const docApNomNorm = `${d.apellidos} ${d.nombres}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const obsNorm = (d.observaciones || '').toLowerCase();

    let estamento: any = (d.titularPie > 0 || d.contrataPie > 0) ? 'DOCENTE_DIFERENCIAL' : 'DOCENTE_AULA';
    let cargoInstitucional: string | undefined = undefined;
    let horasDirectivas = 0;
    let horasInspector = 0;
    let horasUtp = 0;

    const esDirector = Boolean(
      (directorCatalogNorm && (docNomNorm.includes(directorCatalogNorm) || directorCatalogNorm.includes(docNomNorm) || docApNomNorm.includes(directorCatalogNorm))) ||
      /director|directora|rector/i.test(obsNorm) ||
      /director|directora/i.test(d.nombres) ||
      /director|directora/i.test(d.apellidos)
    );

    const esInspector = /inspector/i.test(obsNorm);
    const esUtp = /utp|tecnico/i.test(obsNorm);

    if (esDirector && totalHorasAula === 0) {
      estamento = 'DIRECTIVO';
      cargoInstitucional = 'DIRECTOR(A)';
      horasDirectivas = d.horasContrato;
    } else if (esInspector && totalHorasAula === 0) {
      estamento = 'DIRECTIVO';
      cargoInstitucional = 'INSPECTOR(A) GENERAL';
      horasInspector = d.horasContrato;
    } else if (esUtp && totalHorasAula === 0) {
      estamento = 'TECNICO_PEDAGOGICO';
      cargoInstitucional = 'JEFE(A) UTP';
      horasUtp = d.horasContrato;
    }

    const docObj: Docente = {
      id: `doc_${rbdDestino}_${periodoDestino}_${d.run}`,
      rbd: rbdDestino,
      periodo: periodoDestino,
      run: d.run,
      nombres: d.nombres,
      apellidos: d.apellidos,
      calidadJuridica,
      estamento,
      cargoInstitucional,
      horasContrato: d.horasContrato,
      horasSubvencionGeneralTitular: d.titularSubGral,
      horasSubvencionGeneralContrata: d.contrataSubGral,
      horasSepTitular: d.titularSep,
      horasSepContrata: d.contrataSep,
      horasPieTitular: d.titularPie,
      horasPieContrata: d.contrataPie,
      horasDirectivas,
      horasInspectorGeneral: horasInspector,
      horasTecnicoPedagogicas: horasUtp,
      horasAula: totalHorasAula
    };

    await guardarDocente(docObj);
    docenteMap.set(d.run, docObj);
    docentesGuardados++;
  }

  let asignacionesGuardadas = 0;
  for (const d of result.docentes) {
    const doc = docenteMap.get(d.run);
    if (!doc) continue;

    for (const a of d.asignaciones) {
      const key = `${a.nivelCurso}_${a.letraCurso}`.toUpperCase();
      const curso = cursoMap.get(key);
      if (!curso) continue;

      const asigId = `asig_${rbdDestino}_${periodoDestino}_${d.run}_${curso.id}_${a.asignatura}`.replace(/[\s°]/g, '_');
      const asigObj: AsignacionHoraria = {
        id: asigId,
        rbd: rbdDestino,
        periodo: periodoDestino,
        cursoId: curso.id,
        docenteId: doc.id,
        asignatura: a.asignatura,
        horasPedagogicasAula: a.horasPedagogicasAula,
        esTallerJec: a.esTallerJec
      };
      await guardarAsignacion(asigObj);
      asignacionesGuardadas++;
    }
  }

  await persistDb(true);
  return { cursosNuevos, docentesGuardados, asignacionesGuardadas };
}