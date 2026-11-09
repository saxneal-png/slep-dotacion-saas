import { describe, it, expect } from 'vitest';
import { Docente, AsignacionHoraria, CursoSae } from '../src/types';
import { calcularHorasFueraAulaDocente, auditarCargaDocenteIntegral } from '../src/services/auditoriaDocenteService';
import {
  obtenerTramoMineduc,
  buscarContratoMinimoParvulariaPorMinutos,
  calcularDotacionParvulariaCurso
} from '@slep/mineduc-engine';

describe('Descuento previo de horas PIE y SEP fuera del aula para Educadoras de Párvulos', () => {
  it('una educadora con 39h sin funciones fuera de aula dispone de 39h para docencia (25h 30m de aula)', () => {
    const educadora: Docente = {
      id: 'doc-parv-1',
      rbd: '1234',
      run: '11.111.111-1',
      nombreDocente: 'Paulina Parvularia',
      estamento: 'EDUCADORA_PARVULO',
      horasContrato: 39,
      horasSubvencionGeneralTitular: 39,
      horasSubvencionGeneralContrata: 0,
      horasPieTitular: 0,
      horasPieContrata: 0,
      horasSepTitular: 0,
      horasSepContrata: 0
    };

    const asignaciones: AsignacionHoraria[] = [];

    const resultado = calcularHorasFueraAulaDocente(educadora, asignaciones, 50);

    expect(resultado.horasExentasTotales).toBe(0);
    expect(resultado.horasParaDocenciaAula).toBe(39);

    const tramo = obtenerTramoMineduc(resultado.horasParaDocenciaAula, '65_35');
    expect(tramo).toBeDefined();
    // 25h 30m = 1530 minutos
    expect(tramo!.lectivasMinutosCronologicos).toBe(1530);
  });

  it('una educadora con 39h y 4h fuera de aula (PIE + SEP) descuenta esas horas de su capacidad de aula', () => {
    const educadora: Docente = {
      id: 'doc-parv-2',
      rbd: '1234',
      run: '22.222.222-2',
      nombreDocente: 'Marcela Montes',
      estamento: 'EDUCADORA_PARVULO',
      horasContrato: 39,
      horasSubvencionGeneralTitular: 35,
      horasSubvencionGeneralContrata: 0,
      horasPieTitular: 2,
      horasPieContrata: 0,
      horasSepTitular: 2,
      horasSepContrata: 0,
      horasTrabajoColaborativo: 2,
      horasTallerSep: 2
    };

    const asignaciones: AsignacionHoraria[] = [
      {
        id: 'asig-colab-1',
        rbd: '1234',
        cursoId: 'SIN_CURSO',
        docenteId: 'doc-parv-2',
        asignatura: 'Trabajo Colaborativo PIE Art. 86',
        horasPedagogicasAula: 0,
        horasCronologicasPie: 2,
        esTrabajoColaborativo: true,
        tipoApoyo: 'TRABAJO_COLABORATIVO'
      },
      {
        id: 'asig-sep-1',
        rbd: '1234',
        cursoId: 'SIN_CURSO',
        docenteId: 'doc-parv-2',
        asignatura: 'Taller SEP Reforzamiento',
        horasPedagogicasAula: 2,
        horasCronologicasPie: 2,
        esTallerSep: true,
        tipoApoyo: 'TALLER_SEP'
      }
    ];

    const resultado = calcularHorasFueraAulaDocente(educadora, asignaciones, 50);

    // Debe descontar las 2h PIE y 2h SEP = 4h
    expect(resultado.pieCronologicas).toBe(2);
    expect(resultado.sepExentasCronologicas).toBe(2);
    expect(resultado.horasExentasTotales).toBe(4);

    // Horas de contrato disponibles netas para hacer clases en aula = 39 - 4 = 35 hrs
    expect(resultado.horasParaDocenciaAula).toBe(35);

    // Con 35 horas de contrato disponible en 65/35, el tope de aula según MINEDUC (tabla oficial) es 22h 30m (1350 min)
    const tramo = obtenerTramoMineduc(resultado.horasParaDocenciaAula, '65_35');
    expect(tramo).toBeDefined();
    expect(tramo!.lectivasMinutosCronologicos).toBe(1350); // 22h 30m

    // Si la educadora realiza esas 22h 30m en Kínder:
    const lookup = buscarContratoMinimoParvulariaPorMinutos(1350, '65_35');
    expect(lookup.horasContrato).toBe(35);

    // El contrato total calculado (reqAula + horasFueraAula) debe dar exactamente 39h
    const contratoCalculadoTotal = lookup.horasContrato + resultado.horasExentasTotales;
    expect(contratoCalculadoTotal).toBe(39);

    // Y el saldo respecto a su contrato real de 39h es 0 (no genera sobreasignación falsa)
    const saldo = educadora.horasContrato - contratoCalculadoTotal;
    expect(saldo).toBe(0);
  });

  it('calcularDotacionParvulariaCurso reconoce que la titular con horas PIE/SEP no puede cubrir sola toda la permanencia JECD', () => {
    const cursoParv: CursoSae = {
      id: 'curso-kinder-1',
      rbd: '1234',
      nombre: 'Kínder A',
      nivel: 'Kínder',
      letra: 'A',
      regimen: 'JEC',
      matriculaProyectada: 25,
      esCombinado: false,
      regimenProporcion: '65_35'
    };

    const educadoraTitular: Docente = {
      id: 'doc-parv-3',
      rbd: '1234',
      run: '33.333.333-3',
      nombreDocente: 'Claudia Cancino',
      estamento: 'EDUCADORA_PARVULO',
      horasContrato: 39,
      horasTrabajoColaborativo: 2,
      horasTallerSep: 2
    };

    const asignacionesTitular: AsignacionHoraria[] = [
      {
        id: 'asig-colab-3',
        rbd: '1234',
        cursoId: 'SIN_CURSO',
        docenteId: 'doc-parv-3',
        asignatura: 'Trabajo Colaborativo Art. 86',
        horasPedagogicasAula: 0,
        horasCronologicasPie: 2,
        esTrabajoColaborativo: true
      },
      {
        id: 'asig-sep-3',
        rbd: '1234',
        cursoId: 'SIN_CURSO',
        docenteId: 'doc-parv-3',
        asignatura: 'Taller SEP',
        horasPedagogicasAula: 2,
        horasCronologicasPie: 2,
        esTallerSep: true
      }
    ];

    const desglose = calcularHorasFueraAulaDocente(educadoraTitular, asignacionesTitular, 50);
    expect(desglose.horasExentasTotales).toBe(4);
    expect(desglose.horasParaDocenciaAula).toBe(35);

    // Se evalúa el curso con la titular teniendo 35h disponibles para aula
    const estadoCurso = calcularDotacionParvulariaCurso(
      {
        id: cursoParv.id,
        nivel: cursoParv.nivel,
        letra: cursoParv.letra,
        regimen: cursoParv.regimen,
        matriculaProyectada: cursoParv.matriculaProyectada,
        esCombinado: cursoParv.esCombinado,
        regimenProporcion: cursoParv.regimenProporcion
      },
      50,
      {
        horasContrato: educadoraTitular.horasContrato,
        horasNoAulaDeducibles: desglose.horasExentasTotales,
        horasContratoDisponiblesAula: desglose.horasParaDocenciaAula
      },
      {
        horasAsignadasTitular: 22.5, // Asigna sus 22h 30m tope (1350 min)
        horasAsignadasSegundaEducadora: 0
      }
    );

    // El curso requiere 35h 25m (2125 min) de permanencia oficial JECD (DTO 306/2007)
    expect(estadoCurso.permanenciaMinutos).toBe(2125);

    // La titular sólo puede aportar como máximo 1350 min (22h 30m) con sus 35h disponibles
    expect(estadoCurso.minutosAulaTitular).toBe(1350);

    // Requiere una 2ª educadora para cubrir el remanente (775 min de déficit teórico)
    expect(estadoCurso.segundaEducadoraRequerida).toBe(true);
    expect(estadoCurso.minutosDeficit).toBe(775);
    expect(estadoCurso.minutosAulaSegundaEducadora).toBe(810);
    expect(estadoCurso.coberturaCompletaPermanencia).toBe(false);
  });

  it('Caso Verónica Valenzuela: 42h contrato (40 Subv + 2 PIE), 2h No Aula, 2h Colab PIE y 24h en Kínder 65/35 cuadra en 41h (+1h libre) sin falso Exceso Lectivo', () => {
    const veronica: Docente = {
      id: 'doc-veronica',
      rbd: '3829',
      run: '15757231-8',
      nombres: 'Verónica Valeria',
      apellidos: 'Valenzuela Navarrete',
      estamento: 'EDUCADORA_PARVULO',
      calidadJuridica: 'TITULAR',
      horasContrato: 42,
      horasSubvencionGeneralTitular: 40,
      horasSubvencionGeneralContrata: 0,
      horasPieTitular: 2,
      horasPieContrata: 0,
      horasSepTitular: 0,
      horasSepContrata: 0,
      horasTrabajoColaborativo: 2,
      funcionesNoAula: [
        { id: 'f1', tipo: 'OTRA', nombre: 'Función Institucional 1', horas: 1, financiamiento: 'SUBV_GENERAL' },
        { id: 'f2', tipo: 'OTRA', nombre: 'Función Institucional 2', horas: 1, financiamiento: 'SUBV_GENERAL' }
      ]
    };

    const kinderA: CursoSae = {
      id: 'kinder-a',
      rbd: '3829',
      nivel: 'Kínder',
      letra: 'A',
      regimen: 'JEC',
      regimenProporcion: '65_35',
      matriculaActual: 20,
      matriculaProyectada: 20,
      capacidadMaximaSae: 30,
      neeTransitorios: 3,
      neePermanentes: 1
    };

    const asigKinder: AsignacionHoraria = {
      id: 'asig-kinder-24',
      rbd: '3829',
      cursoId: 'kinder-a',
      docenteId: 'doc-veronica',
      asignatura: 'Lenguajes Artísticos',
      horasPedagogicasAula: 24
    };

    const desglose = calcularHorasFueraAulaDocente(veronica, [asigKinder], 68);
    expect(desglose.horasInstitucionalesSubvGen).toBe(2);
    expect(desglose.pieCronologicas).toBe(2);
    expect(desglose.horasExentasTotales).toBe(4);
    expect(desglose.horasParaDocenciaAula).toBe(38);

    // Tope en 65/35 para 38h disponibles = 24h 45m (1485 min)
    const tramo38 = obtenerTramoMineduc(desglose.horasParaDocenciaAula, '65_35');
    expect(tramo38?.lectivasMinutosCronologicos).toBe(1485);

    // Auditoría integral (incluso si el colegio tiene 68% prioritarios, respeta regimenProporcion='65_35' del curso)
    const cursosMap = new Map<string, CursoSae>([['kinder-a', kinderA]]);
    const audit = auditarCargaDocenteIntegral(veronica, [asigKinder], [], cursosMap, 68);

    expect(audit.ha65_35).toBe(24);
    expect(audit.ha60_40).toBe(0);
    expect(audit.auditDoc.req65_35).toBe(37);
    expect(audit.auditDoc.contratoCalculadoTotal).toBe(41); // 37 (Aula) + 2 (PIE) + 2 (No Aula) = 41h
    expect(audit.auditDoc.saldoHoras).toBe(1); // 42 - 41 = +1h libre
    expect(audit.auditDoc.esInfractorExcesoLectivo).toBe(false);
    expect(audit.estaSobreasignado).toBe(false);
  });
});
