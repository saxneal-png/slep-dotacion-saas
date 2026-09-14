# Inventario y Plan de Gestión de Deuda Técnica

**Proyecto:** Consolidador de Dotación Docente SLEP  
**Fecha:** Septiembre 2026  

---

## 1. Inventario y Priorización de Deuda Técnica

A continuación se detallan los elementos de deuda técnica detectados en la auditoría del código, clasificados por severidad, esfuerzo estimado e impacto en la mantenibilidad:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                               Matriz de Priorización                                      │
│                                                                                          │
│   ALTO IMPACTO   │ [DT-02] Migraciones Formales      │ [DT-01] Estado Monolítico App.tsx │
│                  │ [DT-03] Entidad Formal Contratos  │ [DT-04] Lógica Duplicada Vacantes │
│                  ├───────────────────────────────────┼───────────────────────────────────┤
│   MEDIO IMPACTO  │ [DT-05] Normalización Asignaturas │ [DT-07] Modularización Vistas     │
│                  │ [DT-06] Monodivisa / Costos CLP   │ [DT-08] Tests E2E de UI           │
│                  └───────────────────────────────────┴───────────────────────────────────┘
│                                BAJO ESFUERZO                       ALTO ESFUERZO         │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

| ID | Área / Archivo | Nivel de Severidad | Descripción del Problema Técnico | Esfuerzo | Impacto |
|---|---|:---:|---|:---:|:---:|
| **DT-01** | `src/App.tsx` | **ALTA** | **Estado Monolítico y Prop Drilling Masivo:** `App.tsx` (848 líneas) gestiona más de 25 variables de estado y pasa hasta 30 props/callbacks hacia 11 vistas distintas. | Medio | Alto |
| **DT-02** | `src/database/schema.ts` | **ALTA** | **Migraciones Rudimentarias con `try/catch`:** La función `runMigrations` encadena 20 bloques `try { db.run("ALTER TABLE ...") } catch (_) {}` sin registro de versión ni control transaccional de esquema. | Bajo | Alto |
| **DT-03** | `database/schema.ts` / `types/index.ts` | **ALTA** | **Contratos Implícitos en Entidad Docente:** Los contratos están acoplados directamente en la tabla `docentes`. Un docente no puede tener formalmente 2 decretos de nombramiento separados (ej: 30h Titular por concurso + 14h Contrata transitoria) con sus propias fechas y centros de costo. | Medio | Alto |
| **DT-04** | `services/` | **MEDIA** | **Lógica Duplicada de Horas Vacantes y Parser de Cursos:** Se calcula el desglose de horas vacantes por fuente en 3 lugares (`dotacionCalculationService`, `estadisticasHorasService`, `excelMatrizDotacionService`). El parser de niveles de curso se encuentra duplicado en 3 módulos. | Bajo | Medio |
| **DT-05** | `database/schema.ts` / `tablasMineduc.ts` | **MEDIA** | **Asignaturas como Texto Libre en BD:** La columna `asignatura` en `asignaciones_horarias` es texto libre, requiriendo normalizadores heurísticos continuos en lugar de una clave foránea referenciada al catálogo CEDS v7.1. | Bajo | Medio |
| **DT-06** | `types/index.ts` / `services/` | **MEDIA** | **Ausencia de Cálculo Monetario (CLP):** La plataforma calcula horas cronológicas y pedagógicas, pero no valoriza el presupuesto financiero en pesos chilenos (Renta Básica Mínima Nacional, Bienios, BRP, Asignación de Tramo y Zona). | Medio | Alto |
| **DT-07** | `src/views/` (ej. `CurriculumDemandaView.tsx`) | **MEDIA** | **Componentes de Vista de Gran Tamaño:** `CurriculumDemandaView.tsx` supera las 100 KB de código (más de 2.000 líneas), concentrando en un solo archivo renderizado de tablas, modales de asignación, lógica de filtros y exportaciones. | Medio | Medio |
| **DT-08** | `tests/` | **BAJA** | **Falta de Pruebas de Integración E2E en UI:** Se cuenta con 141 tests unitarios y de servicios excelentes, pero no hay tests automatizados de interfaz con Puppeteer o Playwright para flujos de usuario completos. | Medio | Medio |

---

## 2. Detalle y Diagnóstico de Elementos Clave

### 2.1 [DT-01] Estado Monolítico en `src/App.tsx`
- **Diagnóstico:** `App.tsx` carga en memoria simultáneamente los datos del colegio activo (`salas`, `cursos`, `docentes`, `asignaciones`) y las colecciones globales del territorio (`todasLasSalas`, `todosLosCursos`, `todosLosDocentes`, `todasLasAsignaciones`), recargándolas en cada cambio.
- **Riesgo para la Evolución:** Al agregar simulaciones de escenarios múltiples o auditorías de optimización territorial, el flujo de props se vuelve inmanejable y propenso a re-renderizados innecesarios.
- **Solución Recomendada (Evolución Incremental):**
  - Introducir un gestor de estado ligero basado en React Context especializado (ej. `DotacionTerritorioContext`, `ColegioActivoContext`) o Zustand sin reescribir la UI existente.
  - Mantener las firmas de las vistas para que consuman hooks desacoplados.

### 2.2 [DT-02] Sistema de Migraciones de Base de Datos
- **Diagnóstico:**
  ```typescript
  // database/schema.ts (actual)
  try { db.run("ALTER TABLE docentes ADD COLUMN horas_subvencion_general_titular REAL DEFAULT 0;"); } catch (_) {}
  try { db.run("ALTER TABLE docentes ADD COLUMN horas_subvencion_general_contrata REAL DEFAULT 0;"); } catch (_) {}
  // ... 20 bloques try/catch idénticos
  ```
- **Riesgo:** Si una sentencia falla por sintaxis o incompatibilidad, el error es silenciado por el `catch (_) {}`, dejando la base de datos en un estado inconsistente sin trazabilidad.
- **Solución Recomendada:**
  - Crear una tabla `__migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)` y un runner determinista secuencial de migraciones numeradas (`001_init.sql`, `002_add_funding_sources.sql`, `003_add_scenarios.sql`).

### 2.3 [DT-03] Modelado de Contratos Independientes
- **Diagnóstico:** La tabla `docentes` combina la identidad biográfica del profesional (RUN, nombres, apellidos, título) con los datos contractuales y fuentes de financiamiento en ese colegio específico.
- **Riesgo:** Limita el modelado cuando un docente tiene múltiples decretos contractuales o cuando se simulan escenarios con modificaciones contractuales parciales.
- **Solución Recomendada:**
  - En la siguiente fase evolutiva, crear la tabla `contratos_docentes` vinculada a `docente_id`, `rbd`, `periodo` y `escenario_id`, manteniendo vistas compatibles para no romper el código existente.

### 2.4 [DT-04] Unificación de Lógica Duplicada
- **Diagnóstico:** Existen 3 implementaciones paralelas para calcular horas vacantes y clasificar nombres de cursos.
- **Solución Recomendada:**
  - Consolidar la función canónica de cálculo de vacantes en `dotacionCalculationService.ts` y exportarla hacia `estadisticasHorasService` y `excelMatrizDotacionService`.
  - Centralizar el normalizador de cursos en `@slep/mineduc-engine/src/modalidades.ts` o `services/normalizadorCursos.ts`.

---

## 3. Hoja de Ruta para Remediación Incremental de Deuda Técnica

```
Fase 1: Estabilización de Capa de Datos (Pre-requisito antes de nuevas funciones)
  ├── 1.1 Implementar migrador secuencial con versionado en __migrations.
  ├── 1.2 Unificar funciones duplicadas de cálculo de vacantes y parser de cursos.
  └── 1.3 Activar PRAGMA foreign_keys = ON; en SQLite.

Fase 2: Modularización del Estado de Presentación
  ├── 2.1 Desacoplar App.tsx introduciendo Contexts o Custom Hooks por dominio.
  └── 2.2 Dividir componentes extensos (CurriculumDemandaView) en submódulos desacoplados.

Fase 3: Extensión del Modelo de Datos para Escenarios y Costeo
  ├── 3.1 Introducir entidad formal de Escenarios de Simulación.
  ├── 3.2 Incorporar tabla de Contratos Formales con retrocompatibilidad.
  └── 3.3 Añadir motor de valorización presupuestaria en pesos CLP.
```
