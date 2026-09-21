---
name: slep-dotacion-normativa
description: Motor de reglas y normativas educacionales chilenas (Ley 20.903, Dto 170 PIE, DFL 1/1996 Estatuto Docente, Dto 548 Infraestructura, Ley 21.040, Ley 20.248 SEP). Úsalo para validar cálculos de dotación, proporciones lectivas/no lectivas, asignaciones docentes y auditorías territoriales.
triggers:
  - "validar dotación"
  - "cálculo de horas"
  - "ley 20903"
  - "decreto 170"
  - "pie"
  - "artículo 69"
  - "sobreasignación"
  - "65/35"
  - "60/40"
---

# Skill: Normativa y Reglas de Dominio SLEP / MINEDUC

Este skill contiene las reglas inmutables de cálculo, auditoría y restricciones legales aplicables a la dotación docente de los Servicios Locales de Educación Pública (SLEP) en Chile.

---

## 1. Principio Fundamental: Aritmética en Minutos Enteros

**Regla de Oro:** NUNCA realices cálculos de jornada docente usando divisiones decimales con punto flotante (`horas / 0.65`). Todo cálculo de horas lectivas, no lectivas y recreos debe realizarse en **minutos enteros** consultando las tablas oficiales MINEDUC indexadas por horas cronológicas de contrato.

### Fórmulas Canónicas:
1. **Minutos Totales de Contrato Semanal:**
   $$\text{MinutosTotales} = \text{HorasContrato} \times 60$$

2. **Minutos Lectivos de Aula:**
   $$\text{MinutosLectivos} = \text{HorasPedagogicasAula (HA)} \times 45$$

3. **Minutos de Recreo:**
   Obtenidos directamente de `TABLA_MINEDUC_65_35` o `TABLA_MINEDUC_60_40` en `@slep/mineduc-engine/src/tablasMineduc.ts`.

4. **Minutos No Lectivos (HNL):**
   $$\text{MinutosHNL} = \text{MinutosTotales} - \text{MinutosLectivos} - \text{MinutosRecreo}$$

5. **Tiempo de Preparación y Evaluación Individual (40% de HNL):**
   $$\text{MinutosPlanificacionExclusiva} = \lfloor \text{MinutosHNL} \times 0.40 \rfloor$$

---

## 2. Regímenes de Proporción (Ley 20.903)

| Régimen | Criterio de Aplicación | Máximo Lectivo (Aula + Recreo) | Mínimo No Lectivo (HNL) |
|---|---|---|---|
| **65/35 (General)** | Establecimientos con concentración de alumnos prioritarios **< 80%**. Cursos regulares de 5° Básico a 4° Medio. | **65%** | **35%** |
| **60/40 (Especial / Vulnerable)** | Establecimientos con **≥ 80% de alumnos prioritarios**, o niveles desde NT1 (Pre-kínder) hasta 4° Básico en escuelas con índice de vulnerabilidad. | **60%** | **40%** |

### Auditoría para Docentes Multitramo (Mixtos)
Cuando un docente atiende simultáneamente cursos en régimen 65/35 y 60/40:
1. Calcular el contrato mínimo requerido para el tramo 65/35: $\text{Req}_{65} = \text{buscarContratoMinimo}(\text{HA}_{65}, '65\_35')$.
2. Calcular el contrato mínimo requerido para el tramo 60/40: $\text{Req}_{60} = \text{buscarContratoMinimo}(\text{HA}_{60}, '60\_40')$.
3. Deducir funciones no aula (directivas, UTP, inspectoría, coordinación) y horas directas SEP/PIE del contrato total para obtener el `ContratoRegularBase`.
4. Ponderar proporcionalmente el contrato entre ambos regímenes:
   $$C_{65} = \text{round}\left(\text{ContratoRegularBase} \times \frac{\text{Req}_{65}}{\text{Req}_{65} + \text{Req}_{60}}\right), \quad C_{60} = \text{ContratoRegularBase} - C_{65}$$
5. Sumar minutos lectivos máximos permitidos por tabla en $C_{65}$ y $C_{60}$. Si los minutos reales impartidos exceden este umbral, marcar como **Sobreasignación Infractora**.

---

## 3. Restricciones y Trazabilidad de Fuentes de Financiamiento

Cada hora de contrato docente debe estar explícitamente respaldada por una fuente presupuestaria válida:
$$\text{HorasContrato} = (\text{SubvGen}_{\text{Tit}} + \text{SubvGen}_{\text{Cont}}) + (\text{SEP}_{\text{Tit}} + \text{SEP}_{\text{Cont}}) + (\text{PIE}_{\text{Tit}} + \text{PIE}_{\text{Cont}})$$

### Reglas de Imputación del Gasto:
1. **Plan de Estudio Obligatorio:** Las asignaturas troncales (Lenguaje, Matemática, Ciencias, Historia, Educación Física, etc.) y talleres JEC base **NO PUEDEN ser imputadas a SEP ni PIE**. Deben ser costeadas con **Subvención General**.
2. **Subvención Escolar Preferencial (SEP - Ley 20.248):**
   - Solo financia: talleres extracurriculares del Plan de Mejoramiento Educativo (PME), reforzamiento fuera del horario común o co-docencia de apoyo en aula.
3. **Programa de Integración Escolar (PIE - Decreto 170):**
   - Solo financia: docencia diferencial (máximo 10 hrs por curso PIE estándar), apoyo fonoaudiológico/psicológico y las **3 horas cronológicas semanales de trabajo colaborativo** (Art. 86).
4. **Alerta de Infracción Financiera:** Si una asignación de plan común obligatorio está vinculada a un docente contratado 100% por SEP o PIE sin horas de Subvención General, levantar alerta crítica de reproceso contable.

---

## 4. Auditoría Territorial Multi-Escuela y Topes Legales

1. **Tope Territorial 44 Horas:**
   $$\sum_{\text{escuelas SLEP}} \text{HorasContrato}_i(\text{RUN}) \le 44 \text{ hrs cronológicas}$$
   Cualquier docente con $\sum > 44\text{ hrs}$ debe ser alertado en el Consolidador Territorial por incompatibilidad horaria del Estatuto Administrativo.

2. **Artículo 69 (DFL 1/1996 - Rebaja de Aula por Antigüedad):**
   - Si `aplicaArticulo69 === true`:
     - Máximo de docencia de aula: **24 horas cronológicas semanales** $\iff$ **32 Horas Pedagógicas (HA)**.
     - El resto de la jornada contractual se destina obligatoriamente a actividades no lectivas (HNL).

---

## 5. Normativa de Infraestructura y Capacidad SAE (Decreto 548)

| Nivel / Tipo de Sala | Coeficiente Normativo Superficie | Fórmula de Aforo Máximo |
|---|---|---|
| **Educación Parvularia (NT1 - NT2)** | $1.50\text{ m}^2 / \text{párvulo}$ | $\lfloor \text{Superficie m}^2 / 1.50 \rfloor$ |
| **Básica y Media Regular** | $1.10\text{ m}^2 / \text{estudiante}$ | $\lfloor \text{Superficie m}^2 / 1.10 \rfloor$ |
| **Talleres Técnico-Profesionales / Laboratorios** | $1.80\text{ m}^2 / \text{estudiante}$ | $\lfloor \text{Superficie m}^2 / 1.80 \rfloor$ |

- **Invariante SAE:** En todo curso, $\text{MatriculaProyectada} \le \text{AforoMaximo}$ y $\text{CupoSae} \le \text{AforoMaximo}$. Si se supera, sugerir desdoblamiento de curso o cambio a sala de mayor metraje.
