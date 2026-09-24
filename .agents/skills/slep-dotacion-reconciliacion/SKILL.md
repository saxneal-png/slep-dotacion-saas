---
name: slep-dotacion-reconciliacion
description: Protocolo y motor de reconciliación, deduplicación de asignaciones, purga de datos precargados obsoletos y sincronización asistida (Single Source of Truth) entre la Nómina Ley 20.903 y los Cursos y Planes de Estudio MINEDUC.
triggers:
  - "reconciliacion"
  - "sincronizar"
  - "duplica"
  - "precargado"
  - "nomina ley"
  - "malla curricular"
  - "asignaciones"
  - "single source of truth"
---

# Skill: Reconciliación y Sincronización Nómina Ley ➔ Cursos & Planes MINEDUC

Este skill establece el estándar de oro para garantizar la coherencia absoluta entre la **Nómina de Docentes (Ley 20.903)** y las **Asignaciones de Aula por Curso (Planes MINEDUC)** en el Consolidador de Dotación del SLEP Valle Diguillín.

---

## 1. Principio Fundamental: Single Source of Truth (Fuente Única de Verdad)

1. **La Nómina Ley es la Base Contratada y Vigente:**
   - La dotación de docentes (RUN, contratos, estamento, horas de aula, horas directivas, SEP, PIE y funciones no aula) constituye la fuente primaria de datos.
2. **Cursos & Planes es la Expresión Curricular de la Demanda:**
   - La malla de asignaturas distribuye las horas lectivas autorizadas en los cursos SAE (38 HA JEC / 30 HA No JEC / 42 HA TP / Multigrado / EPJA).
3. **Inadmisibilidad de Duplicados o Registros Residuales:**
   - Si un docente es eliminado o modificado en la Nómina, sus asignaciones huérfanas o residuales en los cursos deben ser purgadas o reconciliadas inmediatamente.
   - Las asignaciones idénticas (mismo docente, curso y asignatura) deben ser deduplicadas automáticamente sin inflar la demanda ni la cobertura.

---

## 2. Niveles de Reconciliación

| Nivel | Acción | Resultado |
|---|---|---|
| **Detección Preventiva** | Escaneo en tiempo real de asignaciones huérfanas o duplicadas en el colegio. | Muestra badge/alerta con diagnóstico claro (ej. "3 asignaciones precargadas obsoletas detectadas"). |
| **Purga y Reconciliación Limpia** | Elimina asignaciones huérfanas de docentes que ya no pertenecen al establecimiento o periodo, y deduplica registros idénticos. | Preserva asignaciones válidas y elimina la duplicación visual de horas. |
| **Sincronización Total Asistida (Jidoka)** | Lee la carga lectiva disponible de los docentes de la nómina y auto-asigna la malla obligatoria MINEDUC según sus especialidades. | Cobertura óptima del plan de estudio (100% de la malla) en 1 solo clic. |
| **Reseteo Seguro de Malla** | Limpia exclusivamente las asignaciones horarias del colegio sin alterar los docentes ni la infraestructura. | Permite armar una nueva distribución de asignaciones desde un lienzo limpio. |

---

## 3. Heurísticas Pedagógicas de Auto-Distribución

1. **Prioridad por Especialidad y Asignatura Principal:**
   - Docente con asignatura "Lenguaje y Comunicación" se vincula prioritariamente a horas de Lenguaje del plan.
   - Docente con especialidad "Educación Diferencial" se vincula a co-docencia y apoyos PIE (Decreto 170).
2. **Respeto a la Capacidad de Carga Lectiva (Ley 20.903):**
   - No sobreasignar a ningún docente por encima de sus horas lectivas máximas ($65\%$ o $60\%$ de su contrato de Subvención General).
3. **Preservación de Exenciones:**
   - Las horas de Talleres SEP y Trabajo Colaborativo se etiquetan con sus banderas correspondientes para no inflar la malla regular obligatoria.
