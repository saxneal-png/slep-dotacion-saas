import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria
} from '../types';
import {
  guardarEstablecimiento,
  guardarSala,
  guardarCurso,
  guardarDocente,
  guardarAsignacion,
  listarEstablecimientos
} from './db';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../data/slepSchoolsCatalog';

/**
 * Sincroniza los 121 establecimientos del catálogo oficial en la tabla SQLite.
 */
export async function sincronizarCatalogoEstablecimientos(): Promise<void> {
  const existing = await listarEstablecimientos();
  const existingByRbd = new Set(existing.map(e => e.rbd.trim()));

  for (const school of SLEP_VALLE_DIGUILLIN_SCHOOLS) {
    if (!existingByRbd.has(school.rbd)) {
      await guardarEstablecimiento({
        id: `est-${school.rbd}`,
        rbd: school.rbd,
        nombre: school.nombre,
        comuna: school.comuna,
        regimen: school.tipo === 'JARDIN' || school.tipo === 'SALA_CUNA' ? 'No JEC' : 'JEC',
        porcentajePrioritarios: 75.0,
      });
    }
  }
}

export async function checkAndSeedInitialData(): Promise<void> {
  await sincronizarCatalogoEstablecimientos();

  const existing = await listarEstablecimientos();
  // Si ya contiene los datos de prueba o pilotos, continuar
  if (existing.some(e => e.rbd === '3451')) return;

  // 1. Establecimientos Piloto de Valle Diguillín
  const establecimientosSeed: Establecimiento[] = [
    {
      id: 'est-1',
      rbd: '3451',
      nombre: 'Liceo Manuel Bulnes',
      comuna: 'Bulnes',
      regimen: 'JEC',
      porcentajePrioritarios: 82.5, // Aplica 60/40
      director: 'Carlos Miranda Valenzuela',
      asesorUatp: 'Rodrigo Fuentes Uribe',
      telefono: '+56 42 2631200',
      email: 'contacto@liceomanuelbulnes.cl'
    },
    {
      id: 'est-2',
      rbd: '3480',
      nombre: 'Colegio Quilamapu',
      comuna: 'Chillán Viejo',
      regimen: 'JEC',
      porcentajePrioritarios: 68.0, // Aplica 65/35
      director: 'María Elena Salazar',
      asesorUatp: 'Rodrigo Fuentes Uribe',
      telefono: '+56 42 2278900',
      email: 'quilamapu@slepvallediguillin.cl'
    },
    {
      id: 'est-3',
      rbd: '3512',
      nombre: 'Escuela Básica San Ignacio',
      comuna: 'San Ignacio',
      regimen: 'JEC',
      porcentajePrioritarios: 85.0, // Aplica 60/40
      director: 'Juan Pablo Rivas',
      asesorUatp: 'Marcela Navarrete Díaz',
      telefono: '+56 42 2451100',
      email: 'sanignacio@slepvallediguillin.cl'
    },
    {
      id: 'est-4',
      rbd: '3560',
      nombre: 'Liceo Bicentenario de Yungay',
      comuna: 'Yungay',
      regimen: 'JEC',
      porcentajePrioritarios: 74.0, // Aplica 65/35
      director: 'Patricia Andrea Morales',
      asesorUatp: 'Marcela Navarrete Díaz',
      telefono: '+56 42 2682300',
      email: 'liceoyungay@slepvallediguillin.cl'
    }
  ];

  for (const est of establecimientosSeed) {
    await guardarEstablecimiento(est);
  }

  // 2. Salas de Liceo Manuel Bulnes (RBD 3451)
  const salasSeed: SalaInfraestructura[] = [
    { id: 'sala-101', rbd: '3451', pabellon: 'Pabellón A (Piso 1)', nombreSala: 'Sala 101 - 1° Básico', superficieM2: 46.2, tipo: 'REGULAR', aforoMaximo: 42 },
    { id: 'sala-102', rbd: '3451', pabellon: 'Pabellón A (Piso 1)', nombreSala: 'Sala 102 - 2° Básico', superficieM2: 44.0, tipo: 'REGULAR', aforoMaximo: 40 },
    { id: 'sala-103', rbd: '3451', pabellon: 'Pabellón A (Piso 2)', nombreSala: 'Sala 103 - 7° Básico', superficieM2: 45.0, tipo: 'REGULAR', aforoMaximo: 40 },
    { id: 'sala-104', rbd: '3451', pabellon: 'Pabellón B', nombreSala: 'Sala 104 - 1° Medio HC', superficieM2: 48.0, tipo: 'REGULAR', aforoMaximo: 43 },
    { id: 'sala-105', rbd: '3451', pabellon: 'Pabellón Parvulario', nombreSala: 'Sala Kinder NT2', superficieM2: 52.5, tipo: 'PARVULARIA', aforoMaximo: 35 },
    { id: 'sala-106', rbd: '3451', pabellon: 'Talleres TP', nombreSala: 'Taller Especialidad Agropecuaria', superficieM2: 60.0, tipo: 'TALLER', aforoMaximo: 33 }
  ];

  for (const s of salasSeed) {
    await guardarSala(s);
  }

  // 3. Cursos SAE de Liceo Manuel Bulnes
  const cursosSeed: CursoSae[] = [
    { id: 'curso-1', rbd: '3451', nivel: '1° Básico', letra: 'A', regimen: 'JEC', salaId: 'sala-101', cupoSae: 38, matriculaProyectada: 36, alumnosNeet: 5, alumnosNeep: 2 },
    { id: 'curso-2', rbd: '3451', nivel: '2° Básico', letra: 'A', regimen: 'JEC', salaId: 'sala-102', cupoSae: 38, matriculaProyectada: 37, alumnosNeet: 5, alumnosNeep: 1 },
    { id: 'curso-3', rbd: '3451', nivel: '7° Básico', letra: 'A', regimen: 'JEC', salaId: 'sala-103', cupoSae: 40, matriculaProyectada: 39, alumnosNeet: 5, alumnosNeep: 2 },
    { id: 'curso-4', rbd: '3451', nivel: '1° Medio', letra: 'A', regimen: 'JEC', salaId: 'sala-104', cupoSae: 42, matriculaProyectada: 40, alumnosNeet: 4, alumnosNeep: 2 }
  ];

  for (const c of cursosSeed) {
    await guardarCurso(c);
  }

  // 4. Docentes de Liceo Manuel Bulnes y Colegio Quilamapu
  const docentesSeed: Docente[] = [
    { 
      id: 'doc-1', rbd: '3451', run: '12.456.789-K', nombres: 'Gonzalo', apellidos: 'Pinto Soto', 
      titulo: 'Profesor de Estado en Castellano', calidadJuridica: 'TITULAR', estamento: 'DOCENTE_AULA', 
      horasContrato: 44, asignaturaPrincipal: 'Lenguaje y Comunicación',
      horasSubvencionGeneralTitular: 44
    },
    { 
      id: 'doc-2', rbd: '3451', run: '14.567.890-3', nombres: 'Andrea', apellidos: 'Cisternas Alarcón', 
      titulo: 'Licenciada en Educación Matemática', calidadJuridica: 'TITULAR', estamento: 'DOCENTE_AULA', 
      horasContrato: 44, asignaturaPrincipal: 'Matemática',
      horasSubvencionGeneralTitular: 30, horasSepTitular: 14
    },
    { 
      id: 'doc-3', rbd: '3451', run: '15.678.901-5', nombres: 'Luis', apellidos: 'Henríquez Valenzuela', 
      titulo: 'Profesor de Historia y Geografía', calidadJuridica: 'CONTRATA', estamento: 'DOCENTE_AULA', 
      horasContrato: 38, asignaturaPrincipal: 'Historia, Geografía y Ciencias Sociales',
      horasSubvencionGeneralContrata: 38
    },
    { 
      id: 'doc-4', rbd: '3451', run: '16.789.012-7', nombres: 'Claudia', apellidos: 'Muñoz Sepúlveda', 
      titulo: 'Educadora Diferencial mención TEL', calidadJuridica: 'CONTRATA', estamento: 'DOCENTE_DIFERENCIAL', 
      horasContrato: 44, asignaturaPrincipal: 'Apoyo PIE',
      horasPieContrata: 44
    },
    { 
      id: 'doc-5', rbd: '3451', run: '17.890.123-9', nombres: 'Felipe', apellidos: 'Bustos Parra', 
      titulo: 'Fonoaudiólogo Clínico Escolar', calidadJuridica: 'CONTRATA', estamento: 'PROFESIONAL_PAE', 
      horasContrato: 30, asignaturaPrincipal: 'PAE Fonoaudiología',
      horasPieContrata: 30
    },
    { 
      id: 'doc-6', rbd: '3451', run: '10.234.567-8', nombres: 'René', apellidos: 'Gutiérrez Mardones', 
      titulo: 'Profesor General Básico', calidadJuridica: 'TITULAR', estamento: 'DOCENTE_AULA', 
      horasContrato: 30, asignaturaPrincipal: 'Ciencias Naturales', aplicaArticulo69: true,
      horasSubvencionGeneralTitular: 30
    },
    { 
      id: 'doc-7', rbd: '3451', run: '13.345.678-2', nombres: 'Mónica', apellidos: 'Reyes Troncoso', 
      titulo: 'Profesora de Inglés', calidadJuridica: 'CONTRATA', estamento: 'DOCENTE_AULA', 
      horasContrato: 30, asignaturaPrincipal: 'Idioma Extranjero: Inglés',
      horasSubvencionGeneralContrata: 20, horasSepContrata: 10
    },
    // Contrato compartido de Mónica Reyes en Colegio Quilamapu (14 hrs adicionales -> 44 hrs totales SLEP)
    { 
      id: 'doc-8', rbd: '3480', run: '13.345.678-2', nombres: 'Mónica', apellidos: 'Reyes Troncoso', 
      titulo: 'Profesora de Inglés', calidadJuridica: 'CONTRATA', estamento: 'DOCENTE_AULA', 
      horasContrato: 14, asignaturaPrincipal: 'Idioma Extranjero: Inglés',
      horasSubvencionGeneralContrata: 14
    }
  ];

  for (const d of docentesSeed) {
    await guardarDocente(d);
  }

  // 5. Asignaciones de Ejemplo
  const asigsSeed: AsignacionHoraria[] = [
    { id: 'asig-1', rbd: '3451', cursoId: 'curso-1', docenteId: 'doc-1', asignatura: 'Lenguaje y Comunicación', horasPedagogicasAula: 8 },
    { id: 'asig-2', rbd: '3451', cursoId: 'curso-1', docenteId: 'doc-2', asignatura: 'Matemática', horasPedagogicasAula: 6 },
    { id: 'asig-3', rbd: '3451', cursoId: 'curso-1', docenteId: 'doc-4', asignatura: 'Apoyo Especializado PIE / Co-docencia', horasPedagogicasAula: 0, horasCronologicasPie: 10.5, horasColaborativas: 3.0, tipoApoyo: 'Co-docencia Aula Común' },
    { id: 'asig-4', rbd: '3451', cursoId: 'curso-2', docenteId: 'doc-1', asignatura: 'Lenguaje y Comunicación', horasPedagogicasAula: 8 },
    { id: 'asig-5', rbd: '3451', cursoId: 'curso-2', docenteId: 'doc-2', asignatura: 'Matemática', horasPedagogicasAula: 6 }
  ];

  for (const a of asigsSeed) {
    await guardarAsignacion(a);
  }
}
