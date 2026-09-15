import {
  TraspasoConfig,
  TraspasoResult,
  SchoolSummary,
  TeacherRecord,
  CourseLoadSummary,
  TeacherConsolidatedLoad
} from '../../types/analizadorTypes';
import { CursoSae, Docente, AsignacionHoraria } from '../../types';
import { getDb, persistDb } from '../dbCore';
import { guardarEstablecimiento } from './establecimientosRepo';
import { guardarCurso } from './cursosRepo';
import { guardarDocente } from './docentesRepo';
import { guardarAsignacion } from './asignacionesRepo';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../../data/slepSchoolsCatalog';
import { homologarAsignaturaPorRegla } from '../../services/analizador/homologationService';

export async function ejecutarTraspasoDotacionAnalizador(
  config: TraspasoConfig,
  data: {
    schools: SchoolSummary[];
    teachers: TeacherRecord[];
    courses: CourseLoadSummary[];
    teacherLoads: TeacherConsolidatedLoad[];
  }
): Promise<TraspasoResult> {
  const db = await getDb();
  const periodo = config.periodo || 2026;
  const alertas: string[] = [];
  const targetRbds = new Set(config.colegiosRbd);
  const targetOverride = config.targetRbdOverride?.trim();

  const filteredSchools = data.schools.filter(s => targetRbds.has(s.rbd));
  const filteredCourses = data.courses.filter(c => targetRbds.has(c.rbd));
  const filteredTeacherLoads = data.teacherLoads.filter(tl => targetRbds.has(tl.rbd));

  let cursosCreados = 0;
  let docentesGuardados = 0;
  let asignacionesGuardadas = 0;

  // 1. Si el modo es REEMPLAZAR, eliminar registros previos de estos colegios en el periodo destino
  if (config.modo === 'REEMPLAZAR') {
    const rbdsToClean = targetOverride ? new Set([targetOverride, ...targetRbds]) : targetRbds;
    for (const rbd of rbdsToClean) {
      db.run("DELETE FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
      db.run("DELETE FROM cursos_sae WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
      db.run("DELETE FROM docentes WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
    }
  }

  // 2. Asegurar que el o los establecimientos existan en la tabla establecimientos
  if (targetOverride) {
    const res = db.exec("SELECT id FROM establecimientos WHERE rbd = ?", [targetOverride]);
    if (!res.length || !res[0].values.length) {
      const catalogSchool = SLEP_VALLE_DIGUILLIN_SCHOOLS.find(s => s.rbd === targetOverride);
      const fallbackSchool = filteredSchools[0];
      await guardarEstablecimiento({
        id: `est-${targetOverride}`,
        rbd: targetOverride,
        nombre: catalogSchool ? catalogSchool.nombre : (fallbackSchool?.establishment || `Establecimiento RBD ${targetOverride}`),
        comuna: (catalogSchool?.comuna as any) || (fallbackSchool?.comuna as any) || 'Chillán',
        regimen: 'JEC',
        porcentajePrioritarios: 75,
      });
    }
  } else {
    for (const s of filteredSchools) {
      const res = db.exec("SELECT id FROM establecimientos WHERE rbd = ?", [s.rbd]);
      if (!res.length || !res[0].values.length) {
        const catalogSchool = SLEP_VALLE_DIGUILLIN_SCHOOLS.find(cs => cs.rbd === s.rbd);
        await guardarEstablecimiento({
          id: `est-${s.rbd}`,
          rbd: s.rbd,
          nombre: catalogSchool?.nombre || s.establishment,
          comuna: (catalogSchool?.comuna as any) || (s.comuna as any) || 'Chillán',
          regimen: 'JEC',
          porcentajePrioritarios: 75,
        });
      }
    }
  }

  // 3. Crear / mapear Cursos
  const cursoMap = new Map<string, CursoSae>();
  for (const sc of filteredCourses) {
    const effectiveRbd = targetOverride || sc.rbd;
    const key = `${effectiveRbd}_${sc.nivel}_${sc.letra}`.toUpperCase();
    if (!cursoMap.has(key)) {
      const cursoId = `curso_${effectiveRbd}_${periodo}_${sc.nivel}_${sc.letra}`.replace(/[\s°]/g, '_');
      const schoolInfo = filteredSchools.find(s => s.rbd === sc.rbd);
      const estMatricula = schoolInfo ? schoolInfo.matricula : 0;
      const schoolCoursesCount = filteredCourses.filter(c => c.rbd === sc.rbd).length;
      const matProy = Math.round(estMatricula / Math.max(1, schoolCoursesCount)) || 30;

      // Evaluar si tiene configuración explícita de JEC y Régimen Proporción Docente
      const customJec =
        config.cursosJecMap?.[sc.curso] ||
        config.cursosJecMap?.[`${sc.nivel} ${sc.letra}`] ||
        config.cursosJecMap?.[`${sc.nivel}_${sc.letra}`] ||
        config.cursosJecMap?.[sc.nivel];

      const isMediaOrTp = sc.nivel.toLowerCase().includes('medio') || sc.nivel.toLowerCase().includes('tp') || sc.nivel.toLowerCase().includes('especialidad');
      const isParvLevel = !isMediaOrTp && (sc.nivel.toLowerCase().includes('parv') || sc.nivel.toLowerCase().includes('nt'));
      const defaultJec = isParvLevel ? 'No JEC' : 'JEC';
      const effectiveJec = customJec || defaultJec;

      const isPrimerCicloOrParv =
        isParvLevel ||
        /^[1-4][°\.\s]?[bB]/.test(sc.nivel) ||
        (!isMediaOrTp && (sc.nivel.includes('1°') || sc.nivel.includes('2°') || sc.nivel.includes('3°') || sc.nivel.includes('4°')));

      const customProp =
        config.cursosProporcionMap?.[sc.curso] ||
        config.cursosProporcionMap?.[`${sc.nivel} ${sc.letra}`] ||
        config.cursosProporcionMap?.[`${sc.nivel}_${sc.letra}`] ||
        config.cursosProporcionMap?.[sc.nivel];

      const effectiveProp = customProp || (isPrimerCicloOrParv ? '65_35' : undefined);

      const cursoObj: CursoSae = {
        id: cursoId,
        rbd: effectiveRbd,
        periodo,
        nivel: sc.nivel,
        letra: sc.letra || 'A',
        regimen: effectiveJec,
        regimenProporcion: effectiveProp,
        cupoSae: 35,
        matriculaProyectada: matProy,
        alumnosNeet: 5,
        alumnosNeep: 2,
      };
      await guardarCurso(cursoObj);
      cursoMap.set(key, cursoObj);
      cursoMap.set(`${effectiveRbd}_${sc.curso}`.toUpperCase(), cursoObj);
      cursosCreados++;
    }
  }

  // 4. Crear / mapear Docentes
  const docenteMap = new Map<string, Docente>();
  for (const tl of filteredTeacherLoads) {
    const effectiveRbd = targetOverride || tl.rbd;
    const cleanRun = (tl.rut || '').trim().replace(/[^0-9kK]/g, '') || `TEMP_${tl.teacher_name.replace(/[^A-Za-z0-9]/g, '').slice(0, 10)}`;
    const key = `${effectiveRbd}_${cleanRun}`;

    if (tl.is_over_legal_limit || tl.horas_contrato > 44) {
      alertas.push(`Docente ${tl.teacher_name} (${tl.rut || 'S/RUN'}) excede las 44 horas semanales (${tl.horas_contrato} hrs).`);
    }

    const docId = `doc_${effectiveRbd}_${periodo}_${cleanRun}`;
    const nombres = tl.teacher_name.split(',')[1]?.trim() || tl.teacher_name.split(' ')[0] || 'Docente';
    const apellidos = tl.teacher_name.split(',')[0]?.trim() || tl.teacher_name.split(' ').slice(1).join(' ') || '';

    let horasDirectivasDeCursos = 0;
    let horasTecnicasDeCursos = 0;
    let horasCoordinacionAcum = 0;
    let horasCoordinacionPieAcum = 0;
    let horasConvivenciaAcum = 0;
    let horasExtraescolarAcum = 0;
    let cargoInstitucionalDetectado: string | undefined = undefined;
    let tipoCoordinacionDeterminado: string | undefined = undefined;

    interface AsignacionValida {
      cursoStr: string;
      rawSub: string;
      asigOficial: string;
      horas: number;
      esCoDocencia: boolean;
      esAgrupacionFlexible: boolean;
      esTallerSep: boolean;
      esTallerJec: boolean;
    }
    const asignacionesAProcesar: AsignacionValida[] = [];

    // Inspeccionar las asignaciones del docente y separar horas institucionales vs lectivas de aula
    for (const asig of tl.cursos) {
      const cursoStr = asig.curso || 'Aula Regular';
      const rawSub = (asig.asignatura || 'Docencia de Aula General').trim();
      const homologKey = `${rawSub}__${cursoStr}`;
      const asigOficial = config.homologaciones[homologKey] ||
                          config.homologaciones[rawSub] ||
                          rawSub;

      // Evaluar heurística normativa MINEDUC
      const infoNorm = homologarAsignaturaPorRegla(rawSub, cursoStr);
      const infoOficial = homologarAsignaturaPorRegla(asigOficial, cursoStr);

      const isDirectivo = Boolean(infoNorm.esDirectivo || infoOficial.esDirectivo || /director|subdirector|inspector.*general|profesor.*encargado|docente.*encargado/i.test(asigOficial) || /director|subdirector|inspector.*general|profesor.*encargado|docente.*encargado/i.test(rawSub));
      const isTecnico = Boolean(infoNorm.esTecnicoPedagogico || infoOficial.esTecnicoPedagogico || /jefe.*utp|jefatura.*utp|\butp\b|tecnico.*pedag|\bcurricul|evaluador/i.test(asigOficial) || /jefe.*utp|jefatura.*utp|\butp\b|tecnico.*pedag|\bcurricul|evaluador/i.test(rawSub));
      const isCoordPie = Boolean(infoNorm.esCoordinacionPie || infoOficial.esCoordinacionPie || /coordinad.*pie|coordinacion.*pie/i.test(asigOficial) || /coordinad.*pie|coordinacion.*pie/i.test(rawSub));
      const isConvivencia = Boolean(infoNorm.esConvivencia || infoOficial.esConvivencia || /convivencia|cra\b|enlaces/i.test(asigOficial) || /convivencia|cra\b|enlaces/i.test(rawSub));
      const isExtraescolar = Boolean(infoNorm.esExtraescolar || infoOficial.esExtraescolar || /extraescolar|\bacle\b/i.test(asigOficial) || /extraescolar|\bacle\b/i.test(rawSub));

      const isProporcionDocente = Boolean(
        infoNorm.esProporcionDocente || infoOficial.esProporcionDocente ||
        asigOficial.toLowerCase().includes('proporci') ||
        asigOficial.toLowerCase().includes('recreo') ||
        asigOficial.toLowerCase().includes('no lectiv') ||
        asigOficial.toLowerCase().includes('h.l.') ||
        /\bhl\b/i.test(asigOficial) ||
        /\brecreo\b/i.test(rawSub) ||
        /\bhl\b/i.test(rawSub)
      );

      // Si es Directivo institucional -> sumar a horas directivas y no registrar en asignaciones curriculares del curso
      if (isDirectivo) {
        horasDirectivasDeCursos += asig.horas;
        if (!cargoInstitucionalDetectado) cargoInstitucionalDetectado = asigOficial;
        continue;
      }

      // Si es Técnico-Pedagógico institucional -> sumar a horas técnicas y no registrar en asignaciones curriculares
      if (isTecnico) {
        horasTecnicasDeCursos += asig.horas;
        if (!cargoInstitucionalDetectado) cargoInstitucionalDetectado = asigOficial;
        continue;
      }

      // Si es Coordinación PIE -> sumar a horas de coordinación y no registrar en asignaciones curriculares del curso
      if (isCoordPie) {
        horasCoordinacionAcum += asig.horas;
        horasCoordinacionPieAcum += asig.horas;
        tipoCoordinacionDeterminado = 'PIE';
        if (!cargoInstitucionalDetectado) cargoInstitucionalDetectado = asigOficial;
        continue;
      }

      // Si es Convivencia Escolar / CRA -> sumar a horas de coordinación y no registrar en asignaciones curriculares
      if (isConvivencia) {
        horasCoordinacionAcum += asig.horas;
        horasConvivenciaAcum += asig.horas;
        if (!tipoCoordinacionDeterminado) tipoCoordinacionDeterminado = 'CONVIVENCIA';
        if (!cargoInstitucionalDetectado) cargoInstitucionalDetectado = asigOficial;
        continue;
      }

      // Si es Extraescolar / ACLE -> sumar a horas de coordinación y no registrar en asignaciones curriculares
      if (isExtraescolar) {
        horasCoordinacionAcum += asig.horas;
        horasExtraescolarAcum += asig.horas;
        if (!tipoCoordinacionDeterminado) tipoCoordinacionDeterminado = 'EXTRAESCOLAR';
        if (!cargoInstitucionalDetectado) cargoInstitucionalDetectado = asigOficial;
        continue;
      }

      // Si es Recreo o Proporción Docente (65/35 o 60/40) -> omitir de la carga lectiva curricular
      if (isProporcionDocente) {
        continue;
      }

      // Apoyos pedagógicos en aula: Co-Docencia y Agrupaciones Flexibles
      const esCoDocencia = Boolean(infoNorm.esCoDocencia || infoOficial.esCoDocencia || /co.*docenc|codocenc|docenc.*compartida/i.test(asigOficial) || /co.*docenc|codocenc/i.test(rawSub));
      const esAgrupacionFlexible = Boolean(infoNorm.esAgrupacionFlexible || infoOficial.esAgrupacionFlexible || /agrupaci[oó]n.*flexible|grupo.*flexible|refuerzo.*pedag/i.test(asigOficial) || /agrupaci[oó]n.*flexible/i.test(rawSub));

      // Talleres SEP y JEC
      const esTallerSep = Boolean(infoNorm.esTallerSep || infoOficial.esTallerSep || asigOficial === 'Taller Extracurricular SEP' || /taller.*sep|refuerzo.*sep|extraesc.*sep|\bsep\b/i.test(asigOficial) || /taller.*sep|refuerzo.*sep|extraesc.*sep|\bsep\b/i.test(rawSub));
      const esTallerJec = esTallerSep || Boolean(infoNorm.esTallerJec || infoOficial.esTallerJec || /taller|aele|reforz/i.test(asigOficial));

      asignacionesAProcesar.push({
        cursoStr,
        rawSub,
        asigOficial,
        horas: asig.horas,
        esCoDocencia,
        esAgrupacionFlexible,
        esTallerSep,
        esTallerJec,
      });
    }

    const horasDirectivasFinal = Math.max(Number(tl.horas_directivas || 0), horasDirectivasDeCursos);
    const horasTecnicasFinal = Math.max(Number(tl.horas_tecnicas || 0), horasTecnicasDeCursos);
    let estamentoDeterminado: any = 'DOCENTE_AULA';
    if (horasDirectivasFinal > 0) {
      estamentoDeterminado = 'DIRECTIVO';
    } else if (horasTecnicasFinal > 0) {
      estamentoDeterminado = 'TECNICO_PEDAGOGICO';
    }

    const docObj: Docente = {
      id: docId,
      rbd: effectiveRbd,
      periodo,
      run: tl.rut || cleanRun,
      nombres,
      apellidos,
      calidadJuridica: 'TITULAR',
      estamento: estamentoDeterminado,
      horasContrato: tl.horas_contrato,
      horasAula: tl.horas_aula,
      horasDirectivas: horasDirectivasFinal,
      horasTecnicoPedagogicas: horasTecnicasFinal,
      horasCoordinacion: horasCoordinacionAcum,
      tipoCoordinacion: tipoCoordinacionDeterminado,
      horasCoordinacionPie: horasCoordinacionPieAcum,
      horasConvivenciaEscolar: horasConvivenciaAcum,
      horasExtraescolar: horasExtraescolarAcum,
      cargoInstitucional: cargoInstitucionalDetectado,
      horasSubvencionGeneralTitular: tl.horas_contrato,
    };

    await guardarDocente(docObj);
    docenteMap.set(key, docObj);
    docentesGuardados++;

    // 5. Crear Asignaciones Horarias con la asignatura oficial homologada
    let asigIndex = 0;
    for (const asig of asignacionesAProcesar) {
      asigIndex++;
      const cursoStr = asig.cursoStr;
      const cursoKey = `${effectiveRbd}_${cursoStr}`.toUpperCase();
      let curso = cursoMap.get(cursoKey);

      if (!curso) {
        for (const [k, c] of cursoMap.entries()) {
          if (k.startsWith(`${effectiveRbd}_`.toUpperCase()) && (cursoStr.toUpperCase().includes(c.nivel.toUpperCase()) || c.nivel.toUpperCase().includes(cursoStr.toUpperCase()))) {
            curso = c;
            break;
          }
        }
      }

      if (!curso) {
        const anySchoolCourse = Array.from(cursoMap.values()).find(c => c.rbd === effectiveRbd);
        if (anySchoolCourse) {
          curso = anySchoolCourse;
        } else {
          const defaultCursoId = `curso_${effectiveRbd}_${periodo}_1_Basico_A`;
          curso = {
            id: defaultCursoId,
            rbd: effectiveRbd,
            periodo,
            nivel: '1° Básico',
            letra: 'A',
            regimen: 'JEC',
            cupoSae: 35,
            matriculaProyectada: 30,
            alumnosNeet: 5,
            alumnosNeep: 2,
          };
          await guardarCurso(curso);
          cursoMap.set(`${effectiveRbd}_1° BÁSICO_A`.toUpperCase(), curso);
          cursosCreados++;
        }
      }

      const asigId = `asig_${effectiveRbd}_${periodo}_${cleanRun}_${curso.id}_${asigIndex}`;

      const asigObj: AsignacionHoraria = {
        id: asigId,
        rbd: effectiveRbd,
        periodo,
        cursoId: curso.id,
        docenteId: docObj.id,
        asignatura: asig.asigOficial,
        horasPedagogicasAula: asig.horas,
        esTallerJec: asig.esTallerJec,
        esTallerSep: asig.esTallerSep,
        esProporcionDocente: false,
        tieneCoDocente: asig.esCoDocencia,
        esCoDocencia: asig.esCoDocencia,
        esAgrupacionFlexible: asig.esAgrupacionFlexible,
      };

      await guardarAsignacion(asigObj);
      asignacionesGuardadas++;
    }
  }

  persistDb();

  return {
    colegiosProcesados: targetOverride ? 1 : targetRbds.size,
    cursosCreados,
    docentesGuardados,
    asignacionesGuardadas,
    alertas,
  };
}
