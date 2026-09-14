# Propuesta de Arquitectura Objetivo: Evolución Incremental de la Plataforma Dotación SLEP

**Visión:** Transformar el sistema actual en una plataforma profesional e integral de **Planificación, Simulación, Optimización y Auditoría de Dotación Docente y Financiera** para Servicios Locales de Educación Pública (SLEP) en Chile.  
**Principio Rector:** **Evolución Incremental Estricta** — Aprovechar el 100% de la sólida base existente (motor normativo en minutos, SQLite WASM, 141 tests automatizados, interfaces operativas y exportadores oficiales), sin reescrituras desde cero.

---

## 1. Principios de Diseño de la Arquitectura Objetivo

1. **Preservación del Núcleo Normativo Inmutable:** `@slep/mineduc-engine` permanece como el motor desacoplado de máxima autoridad legal y matemática para Ley 20.903, Ley 21.040, DFL 1/1996, Dto 170 y Dto 548.
2. **Offline-First con Portabilidad Territorial:** Mantener la capacidad de operar sin conexión a internet en escuelas rurales mediante SQLite WASM e IndexedDB, asegurando la exportación/importación de paquetes de dotación completos.
3. **Aislamiento de Escenarios ("What-If"):** Las simulaciones de dotación (fusiones, desdoblamientos, reasignaciones) operan en ramas o tablas aisladas sin alterar la dotación oficial vigente hasta su aprobación formal.
4. **Retrocompatibilidad Total:** Las estructuras de base de datos actuales, contratos de exportación Excel y firmas de repositorios existentes continúan operando con adaptadores transparentes.
5. **Transición hacia Doble Auditoría (Horas + Presupuesto CLP):** Complementar la balanza de horas pedagógicas con el costeo monetario de la dotación (Renta Básica, BRP, Asignación de Tramo, Bienios y Zona).

---

## 2. Diagrama de la Arquitectura Objetivo

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Plataforma Dotación Docente SLEP                                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                     Capa de Presentación (React 18)                                    │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ Espacio Colegio         │  │ Consolidado Territorial  │  │ Centro de Simulación y Optimización   │  │
│  │ (Mallas, PIE, Dotación) │  │ (Cartera, Inconsistenc.) │  │ (What-If, Fusión, Reubicación)        │  │
│  └─────────────────────────┘  └──────────────────────────┘  └───────────────────────────────────────┘  │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ Auditoría y Compliance  │  │ Analítica y Presupuesto  │  │ Copilot Asesor IA                    │  │
│  │ (Supereduc / Mineduc)   │  │ (Costeo CLP, KPIs SLEP)  │  │ (Local Determinista + Gemini Híbrido) │  │
│  └─────────────────────────┘  └──────────────────────────┘  └───────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                Capa de Aplicación y Servicios de Dominio                               │
│  ┌───────────────────────────────────┐  ┌──────────────────────────────────┐  ┌─────────────────────┐  │
│  │ Servicio de Escenarios y 'What-If'│  │ Motor de Optimización Asignativa │  │ Servicio de Costeo  │  │
│  │ (Clonación, Deltas, Aprobación)   │  │ (Reubicación de horas vacantes)  │  │ Presupuestario CLP  │  │
│  └───────────────────────────────────┘  └──────────────────────────────────┘  └─────────────────────┘  │
│  ┌───────────────────────────────────┐  ┌──────────────────────────────────┐  ┌─────────────────────┐  │
│  │ dotacionCalculationService        │  │ estadisticasHorasService         │  │ dotacionCopilot     │  │
│  │ (Balanza, Multitramo, Diagnóstico)│  │ (Agregación Territorial y Comuna)│  │ (Contexto y Reglas) │  │
│  └───────────────────────────────────┘  └──────────────────────────────────┘  └─────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                      Motor Normativo Core Desacoplado                                  │
│                                           @slep/mineduc-engine                                         │
│   Tablas 65/35 & 60/40 en Minutos | Ley 20.903 | Dto 170 (PIE) | Dto 548 (Salas) | Planes MINEDUC    │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                     Capa de Datos y Persistencia SQLite                                │
│   schema.ts con Versionado (__migrations) | Repositorios Tipados | SQLite WASM + IndexedDB Saneado    │
│   Tablas Base: establecimientos, salas, cursos, docentes, asignaciones, escenarios, contratos, costes  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Nuevos Módulos Funcionales a Incorporar (Incrementales)

### 3.1 Módulo 1: Motor de Simulación y Escenarios "What-If"
- **Objetivo:** Permitir a los asesores UATP y directivos modelar escenarios alternativos de dotación para el año escolar siguiente sin sobreescribir los datos oficiales.
- **Capacidades:**
  - Crear escenarios ramificados (ej: *"Escenario 2027-A: Fusión 3° y 4° Básico en Escuela Rural"*, *"Escenario 2027-B: Incorporación de 2° Ciclo a JEC"*).
  - Comparar matrices de impacto en tiempo real: delta de horas aula, delta de presupuesto, delta de dotación contratada y cumplimiento de aforo.
  - Botón de gobernanza: *"Promover Escenario a Dotación Oficial"*, registrando trazabilidad y fecha de aprobación.

### 3.2 Módulo 2: Motor de Valorización Financiera y Presupuesto (CLP)
- **Objetivo:** Traducir las horas contractuales y calidades jurídicas a costo financiero real en pesos chilenos.
- **Capacidades:**
  - Parámetros salariales oficiales: Renta Básica Mínima Nacional (RBMN), Bonificación de Reconocimiento Profesional (BRP), Asignación de Tramo de Desarrollo Profesional (Inicial, Temprano, Avanzado, Experto I, Experto II), Asignación de Zona (según comuna) y Bienios.
  - Cálculo de costo mensual y anual por docente, por establecimiento, por fuente de financiamiento (Subvención General vs SEP vs PIE) y por territorio SLEP completo.
  - Proyección de déficit o superávit financiero de la dotación contra el marco presupuestario asignado por la Dirección de Educación Pública (DEP).

### 3.3 Módulo 3: Motor de Optimización y Recomendación Asignativa
- **Objetivo:** Asistir al equipo de planificación en la resolución eficiente de déficits y holguras.
- **Capacidades:**
  - **Detección de Vacantes vs Déficits:** Algoritmo que cruza docentes con horas vacantes disponibles (subasignados) con especialidades en déficit en la misma escuela o en escuelas cercanas dentro de la misma comuna.
  - **Sugerencias de Reasignación Automática:** Propuesta de cobertura curricular basada en idoneidad docente y cercanía geográfica, minimizando la necesidad de nuevas contrataciones.

### 3.4 Módulo 4: Auditoría Avanzada y Matriz de Riesgo Regulatorio (Compliance)
- **Objetivo:** Blindar al SLEP frente a fiscalizaciones de la Superintendencia de Educación (Supereduc) y Contraloría.
- **Capacidades:**
  - Semáforo de riesgo por establecimiento: (1) Riesgo de multa por exceso lectivo Ley 20.903, (2) Riesgo de rechazo de rendición de cuentas SEP/PIE por financiamiento improcedente de Plan de Estudio, (3) Riesgo de hacinamiento físico Decreto 548, (4) Incompatibilidad horaria > 44 hrs.
  - Generación de informe ejecutivo de pre-auditoría en PDF / Excel con descargos sugeridos y plan de acción correctivo.

### 3.5 Módulo 5: Proyección Demográfica y Cohortes a Mediano Plazo (3-5 Años)
- **Objetivo:** Planificación plurianual de dotación.
- **Capacidades:**
  - Proyección de matrícula por cohorte considerando tasas de promoción, retención histórica y capacidad de salas.
  - Estimación de jubilaciones proyectadas (docentes en edad de retiro / aplicación de Art. 69) y necesidades futuras de reemplazo por especialidad.

---

## 4. Evolución del Modelo de Datos (Extensión no Destructiva)

Para soportar las nuevas capacidades sin alterar las tablas actuales, el esquema SQLite se expande agregando tablas dedicadas y una columna opcional `escenario_id`:

```sql
-- 1. Tabla de Control de Versiones de Esquema
CREATE TABLE IF NOT EXISTS __schema_migrations (
  version INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  aplicado_en TEXT NOT NULL
);

-- 2. Tabla de Escenarios de Simulación
CREATE TABLE IF NOT EXISTS escenarios_simulacion (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  periodo INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  es_oficial INTEGER DEFAULT 0,
  creado_por TEXT,
  creado_en TEXT NOT NULL,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
);

-- 3. Tabla de Parámetros Salariales y Costos
CREATE TABLE IF NOT EXISTS parametros_costeo_docente (
  periodo INTEGER PRIMARY KEY,
  rbmn_hora_cronologica REAL NOT NULL,
  valor_brp_titulo REAL NOT NULL,
  valor_brp_mencion REAL NOT NULL,
  factor_zona REAL DEFAULT 1.0,
  porcentaje_bienio REAL DEFAULT 0.033
);

-- 4. Extensión retrocompatible en cursos, docentes y asignaciones
-- Las columnas escenario_id TEXT DEFAULT 'OFICIAL' permiten filtrar dotaciones paralelas sin romper consultas previas.
```

---

## 5. Estrategia de Implementación por Fases (Hoja de Ruta)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 0: Estabilización y Saneamiento (Actual - Sin cambios de código)                  │
│  ✓ Auditoría completa y documentación de arquitectura (Entregado).                    │
│  ✓ Verificación de suite de pruebas unitarias (141/141 tests aprobados).               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ FASE 1: Estructuración y Versionado de Persistencia                                   │
│  • Implementación del runner de migraciones formales (__schema_migrations).            │
│  • Centralización de funciones duplicadas de vacantes y normalizadores de cursos.      │
│  • Introducción de Contexts ligeros de React para aliviar el prop-drilling en App.tsx. │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ FASE 2: Motor de Simulación y Escenarios "What-If"                                    │
│  • Creación de entidad y tabla escenarios_simulacion.                                 │
│  • Interfaz visual de clonación, edición simulada y comparador de escenarios.         │
│  • Flujo de promoción de escenario simulado a dotación oficial.                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ FASE 3: Motor de Valorización Financiera en CLP                                        │
│  • Módulo de costeo en pesos chilenos según Carrera Docente y fuentes de financiamiento.│
│  • Visualización de balanza presupuestaria (Ingresos proyectados vs Costo dotación).  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ FASE 4: Optimización Asignativa y Auditoría Avanzada                                   │
│  • Algoritmo de sugerencia de reasignación territorial de horas vacantes.             │
│  • Matriz de cumplimiento e informes ejecutivos para auditoría Supereduc / DEP.        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
