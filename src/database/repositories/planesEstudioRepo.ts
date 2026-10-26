import {
  PlanEstudioNivel,
  PLANES_MINEDUC,
  CATALOGO_PROFUNDIZACION_HC_27,
  CATALOGO_PLAN_COMUN_ELECTIVO_3_4,
  CATALOGO_SECTORES_Y_ESPECIALIDADES_TP_35,
  CATALOGO_MENCIONES_ARTISTICAS_10,
  DECRETO_0876_2019_METADATA,
  validarOfertaElectivosHc,
  validarEleccionEstudianteHc,
  AsignaturaProfundizacionHc,
  ResultadoValidacionOfertaElectivosHc
} from '@slep/mineduc-engine';
import { PlanEstudioCurricular, AsignaturaPlanEstudio, AmbitoFormativoPlan, CursoSae } from '../../types';
import { getDb, persistDb } from '../dbCore';
import { Database } from 'sql.js';

export {
  CATALOGO_PROFUNDIZACION_HC_27,
  CATALOGO_PLAN_COMUN_ELECTIVO_3_4,
  CATALOGO_SECTORES_Y_ESPECIALIDADES_TP_35,
  CATALOGO_MENCIONES_ARTISTICAS_10,
  DECRETO_0876_2019_METADATA,
  validarOfertaElectivosHc,
  validarEleccionEstudianteHc
};
export type { AsignaturaProfundizacionHc, ResultadoValidacionOfertaElectivosHc };

// =============================================================================
// PLAN OFICIAL EPJA 2024 (DECRETO SUPREMO DE EDUCACIÓN N° 10/2022)
// =============================================================================
export const PLAN_EPJA_2024_OFICIAL_JSON = {
  "informacion_curricular": {
    "documento": "Bases Curriculares para la Educación de Personas Jóvenes y Adultas (EPJA)",
    "decreto_supremo": "Decreto Supremo de Educación N° 10/2022",
    "ministerio": "Ministerio de Educación - Gobierno de Chile",
    "duracion_ano_lectivo_semanas": 36,
    "organizacion_modular_sugerida": {
      "modulos_obligatorios": 4,
      "modulos_electivos": 2,
      "duracion_modulo_semanas": 6
    }
  },
  "planes_de_estudio_epja": [
    {
      "nivel": "Educación Básica - Nivel 1",
      "equivalencia_regular": "1° a 4° año de Educación Básica",
      "total_horas_semanales_obligatorias": 10.0,
      "total_horas_anuales_obligatorias": 360,
      "ambitos_formativos": [
        {
          "ambito": "Formación General",
          "caracter": "Obligatoria",
          "horas_semanales_subtotal": 10.0,
          "horas_anuales_subtotal": 360,
          "asignaturas": [
            {
              "nombre": "Lenguaje y Comunicación",
              "horas_semanales": 5.0,
              "horas_anuales": 180,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Matemática",
              "horas_semanales": 5.0,
              "horas_anuales": 180,
              "caracter": "Obligatoria"
            }
          ]
        }
      ]
    },
    {
      "nivel": "Educación Básica - Nivel 2",
      "equivalencia_regular": "5° y 6° año de Educación Básica",
      "total_horas_semanales_obligatorias": 16.0,
      "total_horas_anuales_obligatorias": 576,
      "total_horas_semanales_con_opcionales": 24.0,
      "total_horas_anuales_con_opcionales": 864,
      "ambitos_formativos": [
        {
          "ambito": "Formación General",
          "caracter": "Obligatoria",
          "horas_semanales_subtotal": 16.0,
          "horas_anuales_subtotal": 576,
          "asignaturas": [
            {
              "nombre": "Lenguaje y Comunicación",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Matemática",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Ciencias Naturales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Historia, Geografía y Ciencias Sociales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            }
          ]
        },
        {
          "ambito": "Formación Opcional y en Oficios",
          "caracter": "Optativa para el establecimiento y el estudiante",
          "horas_semanales_subtotal": 8.0,
          "horas_anuales_subtotal": 288,
          "asignaturas": [
            {
              "nombre": "Idioma Extranjero: Inglés",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Opcional"
            },
            {
              "nombre": "Formación en Oficios",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Opcional"
            }
          ]
        }
      ]
    },
    {
      "nivel": "Educación Básica - Nivel 3",
      "equivalencia_regular": "7° y 8° año de Educación Básica",
      "total_horas_semanales_obligatorias": 16.0,
      "total_horas_anuales_obligatorias": 576,
      "total_horas_semanales_con_opcionales": 24.0,
      "total_horas_anuales_con_opcionales": 864,
      "ambitos_formativos": [
        {
          "ambito": "Formación General",
          "caracter": "Obligatoria",
          "horas_semanales_subtotal": 16.0,
          "horas_anuales_subtotal": 576,
          "asignaturas": [
            {
              "nombre": "Lenguaje y Comunicación",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Matemática",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Ciencias Naturales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Historia, Geografía y Ciencias Sociales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            }
          ]
        },
        {
          "ambito": "Formación Opcional y en Oficios",
          "caracter": "Optativa para el establecimiento y el estudiante",
          "horas_semanales_subtotal": 8.0,
          "horas_anuales_subtotal": 288,
          "asignaturas": [
            {
              "nombre": "Idioma Extranjero: Inglés",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Opcional"
            },
            {
              "nombre": "Formación en Oficios",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Opcional"
            }
          ]
        }
      ]
    },
    {
      "nivel": "Educación Media Humanístico-Científica - Nivel 1",
      "equivalencia_regular": "1° y 2° año de Educación Media",
      "total_horas_semanales_obligatorias": 26.0,
      "total_horas_anuales_obligatorias": 936,
      "ambitos_formativos": [
        {
          "ambito": "Formación General",
          "caracter": "Obligatoria",
          "horas_semanales_subtotal": 20.0,
          "horas_anuales_subtotal": 720,
          "asignaturas": [
            {
              "nombre": "Lengua y Literatura",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Matemática",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Ciencias Naturales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Historia, Geografía y Ciencias Sociales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Idioma Extranjero: Inglés",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            }
          ]
        },
        {
          "ambito": "Formación Instrumental",
          "caracter": "Obligatoria (cursar 2 asignaturas por nivel de 2 horas cada una)",
          "horas_semanales_subtotal": 4.0,
          "horas_anuales_subtotal": 144,
          "catalogo_asignaturas_elegibles": [
            "Pensamiento Computacional",
            "Responsabilidad Personal y Social",
            "Emprendimiento y Empleabilidad",
            "Educación Financiera"
          ]
        },
        {
          "ambito": "Formación Diferenciada Humanístico-Científica",
          "caracter": "Electiva (ofrecer al menos 2; estudiante cursa 1 asignatura de 2 horas)",
          "horas_semanales_subtotal": 2.0,
          "horas_anuales_subtotal": 72,
          "catalogo_asignaturas_elegibles": [
            "Artes Visuales",
            "Educación Física y Salud",
            "Filosofía"
          ]
        }
      ]
    },
    {
      "nivel": "Educación Media Humanístico-Científica - Nivel 2",
      "equivalencia_regular": "3° y 4° año de Educación Media",
      "total_horas_semanales_obligatorias": 26.0,
      "total_horas_anuales_obligatorias": 936,
      "ambitos_formativos": [
        {
          "ambito": "Formación General",
          "caracter": "Obligatoria",
          "horas_semanales_subtotal": 20.0,
          "horas_anuales_subtotal": 720,
          "asignaturas": [
            {
              "nombre": "Lengua y Literatura",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Matemática",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Ciencias Naturales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Educación Ciudadana",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Idioma Extranjero: Inglés",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            }
          ]
        },
        {
          "ambito": "Formación Instrumental",
          "caracter": "Obligatoria (cursar 2 asignaturas por nivel de 2 horas cada una)",
          "horas_semanales_subtotal": 4.0,
          "horas_anuales_subtotal": 144,
          "catalogo_asignaturas_elegibles": [
            "Pensamiento Computacional",
            "Responsabilidad Personal y Social",
            "Emprendimiento y Empleabilidad",
            "Educación Financiera"
          ]
        },
        {
          "ambito": "Formación Diferenciada Humanístico-Científica",
          "caracter": "Electiva (ofrecer al menos 2; estudiante cursa 1 asignatura de 2 horas)",
          "horas_semanales_subtotal": 2.0,
          "horas_anuales_subtotal": 72,
          "catalogo_asignaturas_elegibles": [
            "Artes Visuales",
            "Educación Física y Salud",
            "Filosofía"
          ]
        }
      ]
    },
    {
      "nivel": "Educación Media Técnico-Profesional con Formación en Oficios - Nivel 1",
      "equivalencia_regular": "1° y 2° año de Educación Media",
      "total_horas_semanales_obligatorias": 26.0,
      "total_horas_anuales_obligatorias": 936,
      "ambitos_formativos": [
        {
          "ambito": "Formación General",
          "caracter": "Obligatoria",
          "horas_semanales_subtotal": 20.0,
          "horas_anuales_subtotal": 720,
          "asignaturas": [
            {
              "nombre": "Lengua y Literatura",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Matemática",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Ciencias Naturales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Historia, Geografía y Ciencias Sociales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Idioma Extranjero: Inglés",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            }
          ]
        },
        {
          "ambito": "Formación Instrumental",
          "caracter": "Obligatoria (1 asignatura de 2 horas)",
          "horas_semanales_subtotal": 2.0,
          "horas_anuales_subtotal": 72,
          "catalogo_asignaturas_elegibles": [
            "Pensamiento Computacional",
            "Responsabilidad Personal y Social",
            "Emprendimiento y Empleabilidad",
            "Educación Financiera"
          ]
        },
        {
          "ambito": "Formación Diferenciada en Oficios",
          "caracter": "Obligatoria de la modalidad",
          "horas_semanales_subtotal": 4.0,
          "horas_anuales_subtotal": 144,
          "descripcion": "Formación en oficios específicos para la preparación de tareas normalizadas"
        }
      ]
    },
    {
      "nivel": "Educación Media Técnico-Profesional con Formación en Oficios - Nivel 2",
      "equivalencia_regular": "3° y 4° año de Educación Media",
      "total_horas_semanales_obligatorias": 26.0,
      "total_horas_anuales_obligatorias": 936,
      "ambitos_formativos": [
        {
          "ambito": "Formación General",
          "caracter": "Obligatoria",
          "horas_semanales_subtotal": 20.0,
          "horas_anuales_subtotal": 720,
          "asignaturas": [
            {
              "nombre": "Lengua y Literatura",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Matemática",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Ciencias Naturales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Educación Ciudadana",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Idioma Extranjero: Inglés",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            }
          ]
        },
        {
          "ambito": "Formación Instrumental",
          "caracter": "Obligatoria (1 asignatura de 2 horas)",
          "horas_semanales_subtotal": 2.0,
          "horas_anuales_subtotal": 72,
          "catalogo_asignaturas_elegibles": [
            "Pensamiento Computacional",
            "Responsabilidad Personal y Social",
            "Emprendimiento y Empleabilidad",
            "Educación Financiera"
          ]
        },
        {
          "ambito": "Formación Diferenciada en Oficios",
          "caracter": "Obligatoria de la modalidad",
          "horas_semanales_subtotal": 4.0,
          "horas_anuales_subtotal": 144,
          "descripcion": "Formación en oficios específicos para la preparación de tareas normalizadas"
        }
      ]
    },
    {
      "nivel": "Educación Media Técnico-Profesional con Formación en Especialidades - Nivel 1",
      "equivalencia_regular": "1° y 2° año de Educación Media",
      "total_horas_semanales_obligatorias": 24.0,
      "total_horas_anuales_obligatorias": 864,
      "ambitos_formativos": [
        {
          "ambito": "Formación General",
          "caracter": "Obligatoria",
          "horas_semanales_subtotal": 20.0,
          "horas_anuales_subtotal": 720,
          "asignaturas": [
            {
              "nombre": "Lengua y Literatura",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Matemática",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Ciencias Naturales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Historia, Geografía y Ciencias Sociales",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Idioma Extranjero: Inglés",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            }
          ]
        },
        {
          "ambito": "Formación Diferenciada Técnico-Profesional",
          "caracter": "Obligatoria de la especialidad",
          "horas_semanales_subtotal": 4.0,
          "horas_anuales_subtotal": 144,
          "descripcion": "Formación técnica introductoria de la especialidad"
        }
      ]
    },
    {
      "nivel": "Educación Media Técnico-Profesional con Formación en Especialidades - Nivel 2",
      "equivalencia_regular": "3° año de Educación Media",
      "total_horas_semanales_obligatorias": 24.0,
      "total_horas_anuales_obligatorias": 864,
      "nota_horas": "Total de horas semanales corresponde al mínimo normativo exigido (24 h o más)",
      "ambitos_formativos": [
        {
          "ambito": "Formación General",
          "caracter": "Obligatoria",
          "horas_semanales_subtotal": 10.0,
          "horas_anuales_subtotal": 360,
          "asignaturas": [
            {
              "nombre": "Lengua y Literatura",
              "horas_semanales": 2.0,
              "horas_anuales": 72,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Matemática",
              "horas_semanales": 2.0,
              "horas_anuales": 72,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Ciencias Naturales",
              "horas_semanales": 2.0,
              "horas_anuales": 72,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Educación Ciudadana",
              "horas_semanales": 2.0,
              "horas_anuales": 72,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Idioma Extranjero: Inglés",
              "horas_semanales": 2.0,
              "horas_anuales": 72,
              "caracter": "Obligatoria"
            }
          ]
        },
        {
          "ambito": "Formación Instrumental",
          "caracter": "Obligatoria (1 asignatura de 2 horas)",
          "horas_semanales_subtotal": 2.0,
          "horas_anuales_subtotal": 72,
          "catalogo_asignaturas_elegibles": [
            "Pensamiento Computacional",
            "Responsabilidad Personal y Social",
            "Emprendimiento y Empleabilidad",
            "Educación Financiera"
          ]
        },
        {
          "ambito": "Formación Diferenciada con Especialización",
          "caracter": "Obligatoria (especialidad según D.S. N° 452/2013)",
          "horas_semanales_subtotal": 12.0,
          "horas_anuales_subtotal": 432,
          "descripcion": "Especialización diferenciada en sectores económicos específicos (a lo menos 12 horas semanales)"
        }
      ]
    },
    {
      "nivel": "Educación Media Técnico-Profesional con Formación en Especialidades - Nivel 3",
      "equivalencia_regular": "4° año de Educación Media",
      "total_horas_semanales_obligatorias": 24.0,
      "total_horas_anuales_obligatorias": 864,
      "nota_horas": "Total de horas semanales corresponde al mínimo normativo exigido (24 h o más)",
      "ambitos_formativos": [
        {
          "ambito": "Formación General",
          "caracter": "Obligatoria",
          "horas_semanales_subtotal": 10.0,
          "horas_anuales_subtotal": 360,
          "asignaturas": [
            {
              "nombre": "Lengua y Literatura",
              "horas_semanales": 2.0,
              "horas_anuales": 72,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Matemática",
              "horas_semanales": 2.0,
              "horas_anuales": 72,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Ciencias Naturales",
              "horas_semanales": 2.0,
              "horas_anuales": 72,
              "caracter": "Obligatoria"
            },
            {
              "nombre": "Idioma Extranjero: Inglés",
              "horas_semanales": 4.0,
              "horas_anuales": 144,
              "caracter": "Obligatoria"
            }
          ]
        },
        {
          "ambito": "Formación Instrumental",
          "caracter": "Obligatoria (1 asignatura de 2 horas)",
          "horas_semanales_subtotal": 2.0,
          "horas_anuales_subtotal": 72,
          "catalogo_asignaturas_elegibles": [
            "Pensamiento Computacional",
            "Responsabilidad Personal y Social",
            "Emprendimiento y Empleabilidad",
            "Educación Financiera"
          ]
        },
        {
          "ambito": "Formación Diferenciada con Especialización",
          "caracter": "Obligatoria (especialidad según D.S. N° 452/2013)",
          "horas_semanales_subtotal": 12.0,
          "horas_anuales_subtotal": 432,
          "descripcion": "Especialización diferenciada en sectores económicos específicos (a lo menos 12 horas semanales)"
        }
      ]
    }
  ]
};

// =============================================================================
// REPOSITORIO DE PLANES DE ESTUDIO EN SQLITE
// =============================================================================

export interface PlanEstudioRegistroDb {
  id: string;
  nivel: string;
  regimen: 'JEC' | 'No JEC';
  categoria?: 'BASICA' | 'MEDIA_HC' | 'MEDIA_TP' | 'PARVULARIA' | 'EPJA' | 'MULTIGRADO' | 'ESPECIAL' | 'LABORAL' | 'OTRO';
  referenciaFuente?: string;
  horasObligatorias: number;
  horasLibreDisposicion: number;
  totalHorasPlan: number;
  asignaturas: AsignaturaPlanEstudio[];
  ambitosFormativos?: AmbitoFormativoPlan[];
  detallesExtraJson?: string;
}

export async function listarPlanesEstudio(categoriaFiltro?: string): Promise<PlanEstudioCurricular[]> {
  const db = await getDb();
  let sql = "SELECT id, nivel, regimen, categoria, referencia_fuente, horas_obligatorias, horas_libre_disposicion, total_horas_plan, asignaturas_json FROM planes_estudio_mineduc";
  const params: any[] = [];

  if (categoriaFiltro && categoriaFiltro !== 'ALL') {
    sql += " WHERE categoria = ?";
    params.push(categoriaFiltro);
  }
  sql += " ORDER BY categoria, nivel, regimen";

  const res = db.exec(sql, params);
  if (!res.length) return [];

  return res[0].values.map(row => {
    let asignaturas: AsignaturaPlanEstudio[] = [];
    let ambitosFormativos: AmbitoFormativoPlan[] | undefined = undefined;
    let extraMeta: any = {};

    if (row[8]) {
      try {
        const parsed = JSON.parse(String(row[8]));
        if (Array.isArray(parsed)) {
          asignaturas = parsed.map((a: any) => ({
            id: a.id || `asig-${Math.random().toString(36).substr(2, 9)}`,
            nombre: a.nombre || a.asignatura || 'Asignatura',
            horasSemanales: Number(a.horasSemanales || a.horasSugeridas || a.horas || 2),
            horasAnuales: a.horasAnuales ? Number(a.horasAnuales) : undefined,
            caracter: a.caracter || 'Obligatoria',
            ambito: a.ambito
          }));
        } else if (parsed && typeof parsed === 'object') {
          asignaturas = (parsed.asignaturas || []).map((a: any) => ({
            id: a.id || `asig-${Math.random().toString(36).substr(2, 9)}`,
            nombre: a.nombre,
            horasSemanales: Number(a.horasSemanales || a.horas || 2),
            horasAnuales: a.horasAnuales ? Number(a.horasAnuales) : undefined,
            caracter: a.caracter || 'Obligatoria',
            ambito: a.ambito
          }));
          ambitosFormativos = parsed.ambitosFormativos;
          extraMeta = parsed.extraMeta || {};
        }
      } catch (_) {}
    }

    return {
      id: String(row[0]),
      nivel: String(row[1]),
      regimen: row[2] as 'JEC' | 'No JEC',
      categoria: (row[3] as any) || 'OTRO',
      documento: extraMeta.documento || (row[3] === 'EPJA' ? 'Bases Curriculares EPJA' : 'Planes de Estudio MINEDUC'),
      decretoSupremo: row[4] ? String(row[4]) : undefined,
      ministerio: extraMeta.ministerio || 'Ministerio de Educación - Gobierno de Chile',
      duracionAnoLectivoSemanas: extraMeta.duracionAnoLectivoSemanas || 36,
      totalHorasSemanalesObligatorias: Number(row[5]),
      totalHorasAnualesObligatorias: extraMeta.totalHorasAnualesObligatorias || (Number(row[5]) * 36),
      horasLibreDisposicion: Number(row[6]),
      totalHorasPlan: Number(row[7]),
      ambitosFormativos,
      asignaturas,
      organizacionModular: extraMeta.organizacionModular,
      esPersonalizado: extraMeta.esPersonalizado || false
    };
  });
}

export async function obtenerPlanEstudioPorId(id: string): Promise<PlanEstudioCurricular | null> {
  const db = await getDb();
  const res = db.exec(
    "SELECT id, nivel, regimen, categoria, referencia_fuente, horas_obligatorias, horas_libre_disposicion, total_horas_plan, asignaturas_json FROM planes_estudio_mineduc WHERE id = ?",
    [id]
  );
  if (!res.length || !res[0].values.length) return null;

  const row = res[0].values[0];
  let asignaturas: AsignaturaPlanEstudio[] = [];
  let ambitosFormativos: AmbitoFormativoPlan[] | undefined = undefined;
  let extraMeta: any = {};

  if (row[8]) {
    try {
      const parsed = JSON.parse(String(row[8]));
      if (Array.isArray(parsed)) {
        asignaturas = parsed.map((a: any) => ({
          id: a.id || `asig-${Math.random().toString(36).substr(2, 9)}`,
          nombre: a.nombre,
          horasSemanales: Number(a.horasSemanales || a.horasSugeridas || 2),
          horasAnuales: a.horasAnuales ? Number(a.horasAnuales) : undefined,
          caracter: a.caracter || 'Obligatoria',
          ambito: a.ambito
        }));
      } else if (parsed && typeof parsed === 'object') {
        asignaturas = parsed.asignaturas || [];
        ambitosFormativos = parsed.ambitosFormativos;
        extraMeta = parsed.extraMeta || {};
      }
    } catch (_) {}
  }

  return {
    id: String(row[0]),
    nivel: String(row[1]),
    regimen: row[2] as 'JEC' | 'No JEC',
    categoria: (row[3] as any) || 'OTRO',
    documento: extraMeta.documento || (row[3] === 'EPJA' ? 'Bases Curriculares EPJA' : 'Planes de Estudio MINEDUC'),
    decretoSupremo: row[4] ? String(row[4]) : undefined,
    ministerio: extraMeta.ministerio || 'Ministerio de Educación - Gobierno de Chile',
    duracionAnoLectivoSemanas: extraMeta.duracionAnoLectivoSemanas || 36,
    totalHorasSemanalesObligatorias: Number(row[5]),
    totalHorasAnualesObligatorias: extraMeta.totalHorasAnualesObligatorias || (Number(row[5]) * 36),
    horasLibreDisposicion: Number(row[6]),
    totalHorasPlan: Number(row[7]),
    ambitosFormativos,
    asignaturas,
    organizacionModular: extraMeta.organizacionModular,
    esPersonalizado: extraMeta.esPersonalizado || false
  };
}

export async function obtenerPlanEstudioPorNivelYRegimen(
  nivel: string,
  regimen?: string
): Promise<PlanEstudioCurricular | null> {
  const todos = await listarPlanesEstudio();
  const nivelNorm = nivel.toLowerCase().trim();
  const regNorm = (regimen || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Coincidencia exacta de nivel
  const matchExacto = todos.find(p => {
    const pNivelNorm = p.nivel.toLowerCase().trim();
    const pRegNorm = p.regimen.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (pNivelNorm !== nivelNorm) return false;
    if (!regNorm) return true;
    const esNoJecReq = regNorm.includes('no');
    const esNoJecPlan = pRegNorm.includes('no');
    return esNoJecReq === esNoJecPlan;
  });
  if (matchExacto) return matchExacto;

  // 2. Coincidencia flexible de nivel
  const matchParcial = todos.find(p => {
    const pNivelNorm = p.nivel.toLowerCase();
    const pRegNorm = p.regimen.toLowerCase().replace(/[^a-z0-9]/g, '');
    const contiene = pNivelNorm.includes(nivelNorm) || nivelNorm.includes(pNivelNorm);
    if (!contiene) return false;
    if (!regNorm) return true;
    const esNoJecReq = regNorm.includes('no');
    const esNoJecPlan = pRegNorm.includes('no');
    return esNoJecReq === esNoJecPlan;
  });

  return matchParcial || null;
}

export async function guardarPlanEstudio(plan: PlanEstudioCurricular): Promise<void> {
  const db = await getDb();
  const payload = {
    asignaturas: plan.asignaturas || [],
    ambitosFormativos: plan.ambitosFormativos,
    extraMeta: {
      documento: plan.documento,
      ministerio: plan.ministerio,
      duracionAnoLectivoSemanas: plan.duracionAnoLectivoSemanas,
      totalHorasAnualesObligatorias: plan.totalHorasAnualesObligatorias,
      totalHorasSemanalesConOpcionales: plan.totalHorasSemanalesConOpcionales,
      totalHorasAnualesConOpcionales: plan.totalHorasAnualesConOpcionales,
      organizacionModular: plan.organizacionModular,
      esPersonalizado: plan.esPersonalizado !== false
    }
  };

  const asigsJson = JSON.stringify(payload);
  db.run(
    `INSERT INTO planes_estudio_mineduc (id, nivel, regimen, categoria, referencia_fuente, horas_obligatorias, horas_libre_disposicion, total_horas_plan, asignaturas_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      nivel=excluded.nivel,
      regimen=excluded.regimen,
      categoria=excluded.categoria,
      referencia_fuente=excluded.referencia_fuente,
      horas_obligatorias=excluded.horas_obligatorias,
      horas_libre_disposicion=excluded.horas_libre_disposicion,
      total_horas_plan=excluded.total_horas_plan,
      asignaturas_json=excluded.asignaturas_json;`,
    [
      plan.id,
      plan.nivel,
      plan.regimen,
      plan.categoria || null,
      plan.decretoSupremo || null,
      plan.totalHorasSemanalesObligatorias,
      plan.horasLibreDisposicion || 0,
      plan.totalHorasPlan || plan.totalHorasSemanalesObligatorias,
      asigsJson
    ]
  );
  persistDb();
}

export async function eliminarPlanEstudio(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM planes_estudio_mineduc WHERE id = ?", [id]);
  persistDb();
}

/**
 * Adjunta un plan de estudio a uno o múltiples cursos de un establecimiento
 */
export async function adjuntarPlanACursos(
  planId: string,
  rbd: string,
  cursoIds: string[],
  periodo: number = 2026
): Promise<{ cursosActualizados: number; plan: PlanEstudioCurricular | null }> {
  const db = await getDb();
  const plan = await obtenerPlanEstudioPorId(planId);
  if (!plan) throw new Error(`Plan con ID ${planId} no encontrado.`);

  let actualizados = 0;
  for (const cId of cursoIds) {
    db.run(
      "UPDATE cursos_sae SET plan_estudio_id = ? WHERE id = ? AND rbd = ?",
      [planId, cId, rbd]
    );
    actualizados++;
  }

  persistDb();
  return { cursosActualizados: actualizados, plan };
}

/**
 * Poblar base de datos con todos los planes oficiales MINEDUC + EPJA 2024
 */
export async function poblarPlanesEstudioEnDb(dbParam?: Database): Promise<void> {
  const db = dbParam || await getDb();
  // 1. Poblar Planes Regulares, TP y Especiales de mineduc-engine
  for (const p of PLANES_MINEDUC) {
    const id = `${p.nivel}_${p.regimen}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const semanas = p.semanasLectivas || 36;
    const asigs: AsignaturaPlanEstudio[] = (p.asignaturasBase || []).map(a => ({
      nombre: a.nombre,
      horasSemanales: a.horasSugeridas,
      horasAnuales: a.horasSugeridas * semanas,
      caracter: 'Obligatoria'
    }));

    let ambitosFormativos: AmbitoFormativoPlan[] | undefined = undefined;

    // Complementar planes de 3° y 4° Medio según Decreto Exento N° 0876/2019
    if (p.nivel.includes('3° y 4° Medio (Humanístico-Científico)')) {
      ambitosFormativos = [
        {
          ambito: "Plan Común de Formación General",
          caracter: "Obligatoria",
          horasSemanalesSubtotal: 14,
          horasAnualesSubtotal: 532,
          asignaturas: [
            { id: "pc-leng", nombre: "Lengua y Literatura", horasSemanales: 3, horasAnuales: 114, caracter: "Obligatoria", ambito: "Plan Común" },
            { id: "pc-mat", nombre: "Matemática", horasSemanales: 3, horasAnuales: 114, caracter: "Obligatoria", ambito: "Plan Común" },
            { id: "pc-ciud", nombre: "Educación Ciudadana", horasSemanales: 2, horasAnuales: 76, caracter: "Obligatoria", ambito: "Plan Común" },
            { id: "pc-fil", nombre: "Filosofía", horasSemanales: 2, horasAnuales: 76, caracter: "Obligatoria", ambito: "Plan Común" },
            { id: "pc-ing", nombre: "Inglés", horasSemanales: 2, horasAnuales: 76, caracter: "Obligatoria", ambito: "Plan Común" },
            { id: "pc-cien", nombre: "Ciencias para la Ciudadanía", horasSemanales: 2, horasAnuales: 76, caracter: "Obligatoria", ambito: "Plan Común" }
          ],
          descripcion: "Base obligatoria de 6 asignaturas para todo el ciclo de 3° y 4° medio (14 hrs semanales)."
        },
        {
          ambito: "Plan Común de Formación General Electivo",
          caracter: "Electiva para el establecimiento y estudiante",
          horasSemanalesSubtotal: 2,
          horasAnualesSubtotal: 76,
          catalogoAsignaturasElegibles: CATALOGO_PLAN_COMUN_ELECTIVO_3_4.map(c => c.nombre),
          descripcion: "2 horas semanales a elegir entre Historia, Artes, Educación Física y Salud, o Religión (Dec. 924/1983)."
        },
        {
          ambito: "Plan de Formación Diferenciada Humanístico-Científica",
          caracter: "Obligatoria por elección (3 asignaturas de 6 hrs)",
          horasSemanalesSubtotal: 18,
          horasAnualesSubtotal: 684,
          catalogoAsignaturasElegibles: CATALOGO_PROFUNDIZACION_HC_27.map(c => c.nombre),
          descripcion: "El liceo debe ofrecer mínimo 6 asignaturas de las 27 oficiales (Áreas A, B y C) en al menos 2 áreas y sin concentrar en una sola disciplina. Cada estudiante elige 3 asignaturas (18h)."
        }
      ];
    } else if (p.nivel.includes('3° y 4° Medio (Técnico-Profesional)')) {
      ambitosFormativos = [
        {
          ambito: "Plan Común de Formación General",
          caracter: "Obligatoria",
          horasSemanalesSubtotal: 14,
          horasAnualesSubtotal: 532,
          descripcion: "Plan común para Educación Técnico-Profesional (14 horas semanales)."
        },
        {
          ambito: "Plan Común de Formación General Electivo (en Libre Disposición)",
          caracter: "Electiva",
          horasSemanalesSubtotal: 2,
          horasAnualesSubtotal: 76,
          catalogoAsignaturasElegibles: CATALOGO_PLAN_COMUN_ELECTIVO_3_4.map(c => c.nombre),
          descripcion: "Se implementa dentro de las horas de libre disposición del establecimiento TP (2 horas)."
        },
        {
          ambito: "Plan de Formación Diferenciada Técnico-Profesional",
          caracter: "Obligatoria de especialidad",
          horasSemanalesSubtotal: 22,
          horasAnualesSubtotal: 836,
          catalogoAsignaturasElegibles: CATALOGO_SECTORES_Y_ESPECIALIDADES_TP_35.flatMap(s => s.especialidades),
          descripcion: "35 especialidades agrupadas en 15 sectores económicos (22 horas semanales)."
        }
      ];
    } else if (p.nivel.includes('3° y 4° Medio (Artístico)')) {
      ambitosFormativos = [
        {
          ambito: "Plan Común de Formación General",
          caracter: "Obligatoria",
          horasSemanalesSubtotal: 14,
          horasAnualesSubtotal: 532,
          descripcion: "Plan común oficial para Educación Artística (14 horas semanales)."
        },
        {
          ambito: "Plan Común de Formación General Electivo",
          caracter: "Electiva",
          horasSemanalesSubtotal: 2,
          horasAnualesSubtotal: 76,
          catalogoAsignaturasElegibles: CATALOGO_PLAN_COMUN_ELECTIVO_3_4.map(c => c.nombre),
          descripcion: "2 horas semanales a elegir entre Historia, Artes, Ed. Física y Salud, o Religión."
        },
        {
          ambito: "Plan de Formación Diferenciada Artística",
          caracter: "Obligatoria de mención",
          horasSemanalesSubtotal: 21,
          horasAnualesSubtotal: 798,
          catalogoAsignaturasElegibles: CATALOGO_MENCIONES_ARTISTICAS_10,
          descripcion: "10 menciones artísticas según Decreto Supremo N° 3/2007 (21 horas semanales)."
        }
      ];
    } else if (p.categoria === 'MEDIA_TP' && p.nivel.includes('Especialidad')) {
      // Especialidades TP específicas bajo Decreto Exento N° 0876/2019
      const modulosEspecialidad = asigs.filter(a =>
        a.nombre.startsWith('Módulo') || !['Lengua y Literatura', 'Matemática', 'Educación Ciudadana', 'Filosofía', 'Inglés', 'Ciencias para la Ciudadanía'].includes(a.nombre)
      );
      const horasModulos = modulosEspecialidad.reduce((acc, m) => acc + m.horasSemanales, 0);

      ambitosFormativos = [
        {
          ambito: "Plan Común de Formación General",
          caracter: "Obligatoria",
          horasSemanalesSubtotal: 14,
          horasAnualesSubtotal: 532,
          asignaturas: [
            { id: "pc-tp-leng", nombre: "Lengua y Literatura", horasSemanales: 3, horasAnuales: 114, caracter: "Obligatoria", ambito: "Plan Común" },
            { id: "pc-tp-mat", nombre: "Matemática", horasSemanales: 3, horasAnuales: 114, caracter: "Obligatoria", ambito: "Plan Común" },
            { id: "pc-tp-ciud", nombre: "Educación Ciudadana", horasSemanales: 2, horasAnuales: 76, caracter: "Obligatoria", ambito: "Plan Común" },
            { id: "pc-tp-fil", nombre: "Filosofía", horasSemanales: 2, horasAnuales: 76, caracter: "Obligatoria", ambito: "Plan Común" },
            { id: "pc-tp-ing", nombre: "Inglés", horasSemanales: 2, horasAnuales: 76, caracter: "Obligatoria", ambito: "Plan Común" },
            { id: "pc-tp-cien", nombre: "Ciencias para la Ciudadanía", horasSemanales: 2, horasAnuales: 76, caracter: "Obligatoria", ambito: "Plan Común" }
          ],
          descripcion: "Base obligatoria común de 6 asignaturas para todo el ciclo TP (14 horas semanales)."
        },
        {
          ambito: "Plan Común de Formación General Electivo (en Libre Disposición)",
          caracter: "Electiva para el establecimiento y estudiante",
          horasSemanalesSubtotal: 2,
          horasAnualesSubtotal: 76,
          catalogoAsignaturasElegibles: CATALOGO_PLAN_COMUN_ELECTIVO_3_4.map(c => c.nombre),
          descripcion: "Se imparte en horas de libre disposición (2h): Historia, Artes, Ed. Física y Salud, o Religión."
        },
        {
          ambito: "Formación Diferenciada Técnico-Profesional (Módulos de la Especialidad)",
          caracter: "Obligatoria de la Especialidad",
          horasSemanalesSubtotal: horasModulos || 22,
          horasAnualesSubtotal: (horasModulos || 22) * semanas,
          asignaturas: modulosEspecialidad,
          descripcion: "Módulos técnicos y competencias laborales propias de la especialidad."
        }
      ];
    } else if (p.nivel.includes('Combinado (1° Ciclo')) {
      ambitosFormativos = [
        {
          ambito: "Formación General Básica (1° Ciclo)",
          caracter: "Obligatoria",
          horasSemanalesSubtotal: p.regimen === 'JEC' ? 31.5 : 30,
          horasAnualesSubtotal: (p.regimen === 'JEC' ? 31.5 : 30) * 38,
          asignaturas: asigs,
          descripcion: "Decreto Exento N° 2960/2012 para 1° y 2° o 3° y 4° Básico Combinado (8h Lenguaje, 0h Inglés)."
        }
      ];
    } else if (p.nivel.includes('Combinado (2° Ciclo')) {
      ambitosFormativos = [
        {
          ambito: "Formación General Básica (2° Ciclo)",
          caracter: "Obligatoria",
          horasSemanalesSubtotal: p.regimen === 'JEC' ? 32 : 30,
          horasAnualesSubtotal: (p.regimen === 'JEC' ? 32 : 30) * 38,
          asignaturas: asigs,
          descripcion: "Decreto Exento N° 2960/2012 para 5° y 6° Básico Combinado (6h Lenguaje, 3h Inglés, 4h Ciencias)."
        }
      ];
    } else if (p.nivel.includes('Combinado (3° Ciclo')) {
      ambitosFormativos = [
        {
          ambito: "Formación General Básica (3° Ciclo)",
          caracter: "Obligatoria",
          horasSemanalesSubtotal: p.regimen === 'JEC' ? 32 : 31,
          horasAnualesSubtotal: (p.regimen === 'JEC' ? 32 : 31) * 38,
          asignaturas: asigs,
          descripcion: "Decreto Exento N° 1363/2011 y Dto. 628/2016 para 7° y 8° Básico Combinado (33h No JEC / 38h JEC)."
        }
      ];
    } else if (p.nivel.includes('Multigrado Rural')) {
      ambitosFormativos = [
        {
          ambito: "Plan Integrado de Educación Básica Rural",
          caracter: "Obligatoria",
          horasSemanalesSubtotal: p.regimen === 'JEC' ? 32 : 30,
          horasAnualesSubtotal: (p.regimen === 'JEC' ? 32 : 30) * 38,
          asignaturas: asigs,
          descripcion: "Decreto Exento N° 477/1995 y Orientaciones Curriculares DEG para Escuelas Rurales Unidocentes (1° a 6°)."
        }
      ];
    }

    const payload = {
      asignaturas: asigs,
      ambitosFormativos,
      extraMeta: {
        documento: p.referenciaFuente || 'Planes de Estudio Oficiales MINEDUC',
        decretoSupremo: p.referenciaFuente,
        duracionAnoLectivoSemanas: semanas,
        totalHorasAnualesObligatorias: p.horasObligatorias * semanas,
        esPersonalizado: false
      }
    };

    db.run(
      `INSERT INTO planes_estudio_mineduc (id, nivel, regimen, categoria, referencia_fuente, horas_obligatorias, horas_libre_disposicion, total_horas_plan, asignaturas_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        nivel=excluded.nivel,
        regimen=excluded.regimen,
        categoria=excluded.categoria,
        referencia_fuente=excluded.referencia_fuente,
        horas_obligatorias=excluded.horas_obligatorias,
        horas_libre_disposicion=excluded.horas_libre_disposicion,
        total_horas_plan=excluded.total_horas_plan,
        asignaturas_json=excluded.asignaturas_json;`,
      [
        id,
        p.nivel,
        p.regimen,
        p.categoria || null,
        p.referenciaFuente || null,
        p.horasObligatorias,
        p.horasLibreDisposicion,
        p.totalHorasPlan,
        JSON.stringify(payload)
      ]
    );
  }

  // 2. Poblar Planes EPJA 2024 (Decreto Supremo N° 10/2022) Oficiales
  const epjaInfo = PLAN_EPJA_2024_OFICIAL_JSON.informacion_curricular;
  for (const planEpja of PLAN_EPJA_2024_OFICIAL_JSON.planes_de_estudio_epja) {
    const id = `epja_2024_${planEpja.nivel}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    
    // Extraer asignaturas planas
    const todasAsigs: AsignaturaPlanEstudio[] = [];
    const ambitos: AmbitoFormativoPlan[] = [];

    for (const amb of planEpja.ambitos_formativos) {
      const asigsAmbito: AsignaturaPlanEstudio[] = [];
      if (amb.asignaturas) {
        for (const a of amb.asignaturas) {
          const item: AsignaturaPlanEstudio = {
            id: `asig-${Math.random().toString(36).substr(2, 9)}`,
            nombre: a.nombre,
            horasSemanales: a.horas_semanales,
            horasAnuales: a.horas_anuales,
            caracter: a.caracter as any,
            ambito: amb.ambito
          };
          asigsAmbito.push(item);
          todasAsigs.push(item);
        }
      } else if (amb.catalogo_asignaturas_elegibles) {
        const item: AsignaturaPlanEstudio = {
          id: `asig-${Math.random().toString(36).substr(2, 9)}`,
          nombre: `${amb.ambito} (${amb.catalogo_asignaturas_elegibles.join(' / ')})`,
          horasSemanales: amb.horas_semanales_subtotal,
          horasAnuales: amb.horas_anuales_subtotal,
          caracter: amb.caracter.includes('Electiva') ? 'Electiva' : 'Instrumental',
          ambito: amb.ambito
        };
        asigsAmbito.push(item);
        todasAsigs.push(item);
      } else if ((amb as any).descripcion) {
        const item: AsignaturaPlanEstudio = {
          id: `asig-${Math.random().toString(36).substr(2, 9)}`,
          nombre: `${amb.ambito}: ${(amb as any).descripcion}`,
          horasSemanales: amb.horas_semanales_subtotal,
          horasAnuales: amb.horas_anuales_subtotal,
          caracter: 'Obligatoria',
          ambito: amb.ambito
        };
        asigsAmbito.push(item);
        todasAsigs.push(item);
      }

      ambitos.push({
        ambito: amb.ambito,
        caracter: amb.caracter,
        horasSemanalesSubtotal: amb.horas_semanales_subtotal,
        horasAnualesSubtotal: amb.horas_anuales_subtotal,
        asignaturas: asigsAmbito,
        catalogoAsignaturasElegibles: (amb as any).catalogo_asignaturas_elegibles,
        descripcion: (amb as any).descripcion
      });
    }

    const payload = {
      asignaturas: todasAsigs,
      ambitosFormativos: ambitos,
      extraMeta: {
        documento: epjaInfo.documento,
        decretoSupremo: epjaInfo.decreto_supremo,
        ministerio: epjaInfo.ministerio,
        duracionAnoLectivoSemanas: epjaInfo.duracion_ano_lectivo_semanas,
        totalHorasAnualesObligatorias: planEpja.total_horas_anuales_obligatorias,
        totalHorasSemanalesConOpcionales: (planEpja as any).total_horas_semanales_con_opcionales,
        totalHorasAnualesConOpcionales: (planEpja as any).total_horas_anuales_con_opcionales,
        equivalenciaRegular: planEpja.equivalencia_regular,
        organizacionModular: epjaInfo.organizacion_modular_sugerida,
        esPersonalizado: false
      }
    };

    db.run(
      `INSERT INTO planes_estudio_mineduc (id, nivel, regimen, categoria, referencia_fuente, horas_obligatorias, horas_libre_disposicion, total_horas_plan, asignaturas_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        nivel=excluded.nivel,
        regimen=excluded.regimen,
        categoria=excluded.categoria,
        referencia_fuente=excluded.referencia_fuente,
        horas_obligatorias=excluded.horas_obligatorias,
        horas_libre_disposicion=excluded.horas_libre_disposicion,
        total_horas_plan=excluded.total_horas_plan,
        asignaturas_json=excluded.asignaturas_json;`,
      [
        id,
        `EPJA - ${planEpja.nivel}`,
        'JEC',
        'EPJA',
        epjaInfo.decreto_supremo,
        planEpja.total_horas_semanales_obligatorias,
        0,
        planEpja.total_horas_semanales_obligatorias,
        JSON.stringify(payload)
      ]
    );
  }
}
