---
name: slep-dotacion-traspaso
description: Reglas de transición interanual de dotación docente, promoción de cursos SAE, continuidad curricular, resguardo de titulares y directores DFL 1 para proyecciones territoriales SLEP.
triggers:
  - "traspaso"
  - "proyeccion"
  - "periodo"
  - "2026"
  - "2027"
  - "promocion"
  - "cohortes"
---

# Skill: Traspaso y Proyección Interanual de Dotación Docente (2026 ➔ 2027)

Este skill estandariza el protocolo normativo y técnico para traspasar la dotación escolar de un periodo lectivo al siguiente en el Servicio Local de Educación Pública Valle Diguillín.

---

## 1. Reglas de Promoción Curricular y Cohortes

1. **Promoción Natural de Cursos:**
   - Pre-Kínder (NT1) ➔ Kínder (NT2)
   - Kínder (NT2) ➔ 1° Básico
   - $N$° Básico ➔ $(N+1)$° Básico (hasta 8° Básico)
   - $N$° Medio ➔ $(N+1)$° Medio (hasta 4° Medio)

2. **Criterios de Egreso:**
   - **4° Medio:** Egresa siempre del sistema escolar formal (no se promueve a 5°).
   - **8° Básico:** Egresa si el establecimiento es de **Enseñanza Básica Exclusiva** (no imparte enseñanza media). Si el establecimiento es polivalente o integrado básica-media, promueve a **1° Medio**.

3. **Cohorte Entrante (Regeneración de Nivel Inicial):**
   - El nivel inferior de entrada (Pre-Kínder o Kínder según la escuela) se regenera automáticamente para recibir a la nueva cohorte del Sistema de Admisión Escolar (SAE).
   - La capacidad de matrícula del nuevo nivel inicial toma por defecto la capacidad histórica del año anterior, permitiendo ajustes por cupos autorizados MINEDUC.

4. **Cursos Combinados / Multigrado:**
   - En escuelas rurales con aulas multigrado (ej. 1°-2° o 3°-4°-5° combinados), la estructura del curso combinado se proyecta preservando las salas y demanda unificada.

---

## 2. Reglas de Planta Docente y Estatuto Docente

1. **Docentes Titulares (Ley 20.903 / Ley 21.040):**
   - Su traspaso es **obligatorio y 100% garantizado**. No pueden ser desvinculados administrativamente ni ver reducida su carga horaria sin sumario o mutuo acuerdo según el DFL 1.
2. **Docentes a Contrata:**
   - Su traspaso está sujeto a evaluación anual de continuidad o disponibilidad presupuestaria. El sistema permite:
     - **Renovación Completa:** Se transfieren con su carga idéntica.
     - **Modificación:** Ajuste de horas antes de transferir.
     - **No Renovación:** Excluidos del periodo entrante para proyectar contratación o ahorro.
3. **Directores y Cargos Directivos Superiores (DFL 1):**
   - El Director mantiene su carga completa (normalmente 44 hrs directivas) sin imputación forzada a horas lectivas de aula.
4. **Carrera Docente y Bienios:**
   - Se actualiza automáticamente la antigüedad y asignación de tramo para el nuevo año de ejercicio.

---

## 3. Estrategias Curriculares y Asignación de Horas

| Estrategia | Descripción | Caso de Uso |
|---|---|---|
| **Continuidad Docente** | El docente sigue asignado a la misma asignatura en el curso promovido. | Escuelas donde el profesor jefe o de asignatura acompaña a la cohorte. |
| **Demanda Vacante (Recomendado)** | Se crean los cursos 2027 con su demanda horaria teórica completa según plan de estudio, pero las horas quedan vacantes. | Planificación desde cero de la nueva malla horaria. |
| **Replicación Exacta de Malla** | Se replican las mismas asignaciones de nivel y docente que en el año anterior. | Escuelas con profesores especialistas fijos por nivel (ej. profe de 3° básico siempre en 3°). |

---

## 4. Trazabilidad y Seguridad de Datos

- Todo traspaso debe ejecutarse en una **transacción SQLite atómica**.
- Se debe registrar un evento en `auditoria_cambios` indicando:
  - Usuario / origen de la operación.
  - RBD del establecimiento.
  - Periodo origen (2026) y Periodo destino (2027).
  - Cantidad de cursos, docentes y asignaciones creadas.
