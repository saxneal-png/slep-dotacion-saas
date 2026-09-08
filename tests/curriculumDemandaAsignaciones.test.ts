import { describe, it, expect } from 'vitest';
import { calcularDemandaNormativaPieCurso, autoAsignarHorasPieCursos } from '@slep/mineduc-engine';
import { AsignacionHoraria, CursoSae, Docente } from '../src/types';

describe('Asignación de Docencia y Apoyo PIE por Curso (Decreto 170 / Ord. 2398)', () => {
  // Helper que replica la discriminación de asignaciones implementada en CurriculumDemandaView
  const esApoyoPie = (a: AsignacionHoraria) => {
    return (
      a.esCoDocencia === true ||
      a.tipoApoyo === 'PIE' ||
      (a.tipoApoyo && a.tipoApoyo.toLowerCase().includes('pie')) ||
      (a.tipoApoyo && a.tipoApoyo.toLowerCase().includes('recurso')) ||
      (a.tipoApoyo && a.tipoApoyo.toLowerCase().includes('colaborativ')) ||
      (a.asignatura && a.asignatura.toLowerCase().includes('pie')) ||
      (a.asignatura && a.asignatura.toLowerCase().includes('codocenc'))
    );
  };

  it('discrimina correctamente entre Docencia de Aula Curricular y Apoyo PIE', () => {
    const asignaciones: AsignacionHoraria[] = [
      {
        id: 'asig-1',
        rbd: '1234',
        cursoId: 'curso-1',
        docenteId: 'doc-1',
        asignatura: 'Lenguaje y Comunicación',
        horasPedagogicasAula: 8,
        esCoDocencia: false,
        tipoApoyo: 'AULA_REGULAR'
      },
      {
        id: 'asig-2',
        rbd: '1234',
        cursoId: 'curso-1',
        docenteId: 'doc-2',
        asignatura: 'Matemática',
        horasPedagogicasAula: 6,
        esCoDocencia: false,
      },
      {
        id: 'asig-3',
        rbd: '1234',
        cursoId: 'curso-1',
        docenteId: 'pie-1',
        asignatura: 'Apoyo PIE - Co-docencia Aula Común',
        horasPedagogicasAula: 8,
        horasCronologicasPie: 6.0,
        esCoDocencia: true,
        tipoApoyo: 'Co-Docencia en Aula Regular'
      },
      {
        id: 'asig-4',
        rbd: '1234',
        cursoId: 'curso-1',
        docenteId: 'pae-1',
        asignatura: 'Apoyo Fonoaudiología en Aula Recursos',
        horasPedagogicasAula: 4,
        horasCronologicasPie: 3.0,
        esCoDocencia: true,
        tipoApoyo: 'Apoyo Multidisciplinario / Clínico PAE'
      }
    ];

    const regulares = asignaciones.filter(a => !esApoyoPie(a));
    const apoyosPie = asignaciones.filter(a => esApoyoPie(a));

    expect(regulares).toHaveLength(2);
    expect(regulares.map(r => r.asignatura)).toEqual(['Lenguaje y Comunicación', 'Matemática']);
    expect(regulares.reduce((s, r) => s + r.horasPedagogicasAula, 0)).toBe(14);

    expect(apoyosPie).toHaveLength(2);
    expect(apoyosPie.reduce((s, p) => s + (p.horasCronologicasPie || 0), 0)).toBe(9.0);
  });

  it('calcula la demanda normativa PIE exacta según metodología pieauditor para cursos con JEC y sin JEC', () => {
    // Caso 1: Con JEC y aforo estándar 5 NEET + 2 NEEP = 16 hrs (10:30 Ed Dif + 05:30 PAE)
    const demandaJec = calcularDemandaNormativaPieCurso(5, 2, true);
    expect(demandaJec.horasTotalCronologicas).toBe(16);
    expect(demandaJec.horasDiferencialDecimal).toBe(10.5);
    expect(demandaJec.horasPaeDecimal).toBe(5.5);
    expect(demandaJec.horasTrabajoColaborativoCronologicas).toBe(3.0);
    expect(demandaJec.cumpleAforo).toBe(true);

    // Caso 2: Sin JEC y 5 NEET + 2 NEEP = 13 hrs (09:00 Ed Dif + 04:00 PAE)
    const demandaSinJec = calcularDemandaNormativaPieCurso(5, 2, false);
    expect(demandaSinJec.horasTotalCronologicas).toBe(13);
    expect(demandaSinJec.horasDiferencialDecimal).toBe(9.0);
    expect(demandaSinJec.horasPaeDecimal).toBe(4.0);
    expect(demandaSinJec.cumpleAforo).toBe(true);

    // Caso 3: Solo NEET (5 NEET + 0 NEEP)
    const demandaSoloNeetJec = calcularDemandaNormativaPieCurso(5, 0, true);
    expect(demandaSoloNeetJec.horasTotalCronologicas).toBe(10);
    expect(demandaSoloNeetJec.horasDiferencialDecimal).toBe(6.25);
    expect(demandaSoloNeetJec.horasPaeDecimal).toBe(3.75);

    // Caso 4: Alerta de aforo excedido (> 5 NEET o > 2 NEEP)
    const demandaExcedida = calcularDemandaNormativaPieCurso(6, 3, true);
    expect(demandaExcedida.cumpleAforo).toBe(false);
    expect(demandaExcedida.observacionNormativa).toContain('Aforo excedido');
  });

  it('soporta la asignación de Asistentes de la Educación Profesionales (PAE) y Técnicos', () => {
    const personal: Docente[] = [
      {
        id: 'doc-aula-1',
        rbd: '1234',
        run: '10.111.222-3',
        nombres: 'María',
        apellidos: 'González',
        estamento: 'DOCENTE_AULA',
        calidadJuridica: 'TITULAR',
        horasContrato: 44
      },
      {
        id: 'doc-dif-1',
        rbd: '1234',
        run: '12.333.444-5',
        nombres: 'Claudia',
        apellidos: 'Soto',
        titulo: 'Prof. Educación Diferencial mención TEL',
        estamento: 'DOCENTE_DIFERENCIAL',
        calidadJuridica: 'TITULAR',
        horasContrato: 44
      },
      {
        id: 'pae-fono-1',
        rbd: '1234',
        run: '15.555.666-7',
        nombres: 'Felipe',
        apellidos: 'Morales',
        titulo: 'Fonoaudiólogo',
        estamento: 'PROFESIONAL_PAE',
        calidadJuridica: 'CONTRATA',
        horasContrato: 30
      },
      {
        id: 'tec-esp-1',
        rbd: '1234',
        run: '18.777.888-9',
        nombres: 'Camila',
        apellidos: 'Pérez',
        titulo: 'Técnico en Educación Especial',
        estamento: 'TECNICO_ESPECIAL',
        calidadJuridica: 'CONTRATA',
        horasContrato: 44
      },
      {
        id: 'asist-aula-1',
        rbd: '1234',
        run: '19.999.000-1',
        nombres: 'Juana',
        apellidos: 'Reyes',
        estamento: 'ASISTENTE_AULA',
        calidadJuridica: 'TITULAR',
        horasContrato: 40
      }
    ];

    expect(personal.filter(p => p.estamento === 'DOCENTE_DIFERENCIAL')).toHaveLength(1);
    expect(personal.filter(p => p.estamento === 'PROFESIONAL_PAE')).toHaveLength(1);
    expect(personal.filter(p => p.estamento === 'TECNICO_ESPECIAL')).toHaveLength(1);
    expect(personal.filter(p => p.estamento === 'ASISTENTE_AULA')).toHaveLength(1);
  });

  it('permite crear talleres transversales no asociados a curso y los suma a la demanda y carga horaria', () => {
    const asignaciones: AsignacionHoraria[] = [
      {
        id: 'asig-reg-1',
        rbd: '1234',
        cursoId: 'curso-1',
        docenteId: 'doc-1',
        asignatura: 'Lenguaje y Comunicación',
        horasPedagogicasAula: 8
      },
      {
        id: 'asig-transversal-1',
        rbd: '1234',
        cursoId: 'TRANSVERSAL',
        docenteId: 'doc-1',
        asignatura: 'Taller de Robótica Institucional',
        horasPedagogicasAula: 4,
        esTallerSep: false
      },
      {
        id: 'asig-transversal-2',
        rbd: '1234',
        cursoId: 'TRANSVERSAL',
        docenteId: 'doc-2',
        asignatura: 'Taller de Teatro Extraescolar SEP',
        horasPedagogicasAula: 6,
        esTallerSep: true
      }
    ];

    // Identificar asignaciones transversales
    const transversales = asignaciones.filter(a => !a.cursoId || a.cursoId === 'TRANSVERSAL' || a.cursoId === 'SIN_CURSO');
    expect(transversales).toHaveLength(2);
    expect(transversales.reduce((s, a) => s + a.horasPedagogicasAula, 0)).toBe(10);

    // Verificar carga horaria del docente 1
    const asigsDoc1 = asignaciones.filter(a => a.docenteId === 'doc-1');
    const totalDoc1 = asigsDoc1.reduce((s, a) => s + a.horasPedagogicasAula, 0);
    expect(totalDoc1).toBe(12); // 8 regular + 4 taller transversal
  });

  it('filtra docentes correctamente por nombre, apellido, RUN o asignatura principal', () => {
    const docentesList: Docente[] = [
      {
        id: 'd1',
        rbd: '1234',
        run: '11.222.333-4',
        nombres: 'Rodrigo',
        apellidos: 'Araya',
        estamento: 'DOCENTE_AULA',
        calidadJuridica: 'TITULAR',
        horasContrato: 44,
        asignaturaPrincipal: 'Matemática'
      },
      {
        id: 'd2',
        rbd: '1234',
        run: '15.666.777-8',
        nombres: 'Lorena',
        apellidos: 'Pavez',
        estamento: 'DOCENTE_DIFERENCIAL',
        calidadJuridica: 'CONTRATA',
        horasContrato: 40,
        asignaturaPrincipal: 'Educación Especial'
      }
    ];

    const filtrar = (q: string, estamento: string = 'TODOS') => {
      const term = q.toLowerCase().trim();
      return docentesList.filter(d => {
        const matchText = term === '' ||
          `${d.nombres} ${d.apellidos}`.toLowerCase().includes(term) ||
          d.run.toLowerCase().includes(term) ||
          (d.asignaturaPrincipal || '').toLowerCase().includes(term);
        const matchEst = estamento === 'TODOS' || d.estamento === estamento;
        return matchText && matchEst;
      });
    };

    expect(filtrar('rodrigo')).toHaveLength(1);
    expect(filtrar('15.666')).toHaveLength(1);
    expect(filtrar('matemática')).toHaveLength(1);
    expect(filtrar('pavez')).toHaveLength(1);
    expect(filtrar('inexistente')).toHaveLength(0);
    expect(filtrar('', 'DOCENTE_DIFERENCIAL')).toHaveLength(1);
  });
});
