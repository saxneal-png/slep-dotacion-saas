# Auditoría Técnica y Funcional: Estado Actual del Sistema Dotación

**Proyecto:** Consolidador y Auditor de Dotación Docente — SLEP Valle Diguillín  
**Versión Auditada:** 1.0.0 (Standalone Desktop Electron + React + SQLite WASM)  
**Fecha de Auditoría:** Septiembre 2026  
**Entorno de Ejecución:** Electron 33.2.1 / Chromium / Node.js 22 / Vite 6.0.3 / sql.js 1.12.0 (WASM) / React 18.3.1 / TypeScript 5.7.2  

---

## 1. Resumen Ejecutivo de la Arquitectura Actual

El repositorio alberga una aplicación de escritorio offline-first empaquetada con **Electron** y construida sobre **React** y **TypeScript**. La base de datos es una instancia in-memory de SQLite compilada a WebAssembly (`sql.js`), cuya persistencia se sincroniza binariamente mediante volcados completos (`db.export()`) hacia **IndexedDB** (`idbStorage.ts`) y respaldo de fallback en `localStorage`.

El cálculo normativo fundamental se encuentra desacoplado en un monorepo workspace local (`packages/mineduc-engine`), mientras que la lógica de aplicación, agregación territorial, diagnóstico financiero, importación/exportación y UI residen en `src/`.

```
                    ┌─────────────────────────────────────────────────────────┐
                    │               Electron Desktop Shell                    │
                    │  (electron/main.ts, preload.ts, IPC handlers, fs/dialog)│
                    └───────────────────────────┬─────────────────────────────┘
                                                │
                                                ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │                 React 18 SPA (Vite)                     │
                    │  (App.tsx, 11 Views, Modales, Copilot Drawer, Context)   │
                    └────────────┬─────────────────────────────┬──────────────┘
                                 │                             │
                                 ▼                             ▼
┌────────────────────────────────────────────────┐   ┌────────────────────────────────────────┐
│             Lógica de Aplicación                │   │        @slep/mineduc-engine            │
│  (dotacionCalculationService, estadisticas,    │   │  (Tablas 65/35 y 60/40 en minutos,     │
│   analizador, sigeParser, excelMatrizDotacion) │──>│   Ley 20.903, Dto 170, Capacidad SAE,  │
│                                                │   │   Planes Estudio, Multitramo)          │
└────────────────────────┬───────────────────────┘   └────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                      Capa de Persistencia SQLite WASM (sql.js)                               │
│  schema.ts (5 tablas) ──> dbCore.ts (Memoria) ──> idbStorage.ts (IndexedDB Binary Blobs)    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Clasificación Exhaustiva de los 20 Componentes Clave

A continuación se auditan los 20 aspectos funcionales requeridos por la normativa de dotación de un Servicio Local de Educación Pública (SLEP):

| # | Componente Funcional | Clasificación | Evidencia en Código / Módulos | Observaciones Técnicas y Brechas |
|---|----------------------|---------------|-------------------------------|----------------------------------|
| **1** | **Establecimientos** | **EXISTENTE** | `database/schema.ts` (`table establecimientos`), `establecimientosRepo.ts`, `data/slepSchoolsCatalog.ts`, `CarteraView.tsx` | Almacena RBD, nombre, comuna (7 comunas SLEP), régimen (JEC/No JEC), % prioritarios, director, asesor UATP. Catálogo estático precargado. Falta modelar anexos/sedes rurales y geolocalización. |
| **2** | **Docentes** | **EXISTENTE** | `database/schema.ts` (`table docentes`), `docentesRepo.ts`, `DocentesDotacionView.tsx`, `DocenteFormModal.tsx` | Almacena RUN, nombres, apellidos, título, calidad jurídica (TITULAR/CONTRATA), estamento, horas contrato, desglose de funciones no aula y artículo 69. |
| **3** | **Contratos** | **PARCIAL** | `database/schema.ts` (columnas en `docentes`), `types/index.ts` (`ContratoDocenteColegio`) | Los contratos están implícitos como atributos dentro de la tabla `docentes`. No existe una tabla relacional independiente `contratos` que gestione contratos múltiples formalizados por decreto o fecha de inicio/término. |
| **4** | **Horas Contractuales** | **EXISTENTE** | `tablasMineduc.ts`, `calculoJornada.ts`, `calculoMultitramo.ts`, `docentesRepo.ts` | Soporte completo para 1 a 44 horas semanales. Separación estricta de minutos lectivos (HA x 45 min), recreo y HNL. Auditoría de topes legales por contrato y multi-escuela. |
| **5** | **Asignaciones** | **EXISTENTE** | `database/schema.ts` (`table asignaciones_horarias`), `asignacionesRepo.ts`, `CurriculumDemandaView.tsx` | Relaciona docente, curso, asignatura, horas pedagógicas, co-docencia, agrupación flexible, talleres JEC/SEP y horas colaborativas PIE. |
| **6** | **Cursos** | **EXISTENTE** | `database/schema.ts` (`table cursos_sae`), `cursosRepo.ts`, `combinacionCursosService.ts`, `ModalCombinarCursos.tsx` | Niveles desde NT1 a 4° Medio, EPJA Básica/Media, cursos multigrado y combinados. Asignación de sala física, cupo SAE y matrícula proyectada. |
| **7** | **Asignaturas** | **PARCIAL** | `tablasMineduc.ts` (`CATALOGO_ASIGNATURAS_MINEDUC`), `planesEstudio.ts`, `homologationService.ts` | Catálogo de referencia CEDS v7.1 en memoria y planes de estudio. En base de datos la asignatura se almacena como texto libre (`TEXT`), dependiendo de normalizadores y reglas heurísticas. |
| **8** | **Matrícula** | **PARCIAL** | `database/schema.ts` (`matricula_proyectada`, `cupo_sae`, `alumnos_neet`, `alumnos_neep`), `proyeccionCohortes.test.ts` | Se almacena un único valor escalar proyectado por curso. No existen series históricas de asistencia media mensual (para cálculo de subvención efectiva) ni modelos predictivos demográficos avanzados. |
| **9** | **Demanda Curricular** | **EXISTENTE** | `packages/mineduc-engine/src/planesEstudio.ts`, `dotacionCalculationService.ts`, `CurriculumDemandaView.tsx` | Matrices de planes de estudio oficiales MINEDUC para Parvularia, Básica (1°-4°, 5°-6°, 7°-8° con/sin Lengua Indígena), Multigrado, Media HC (1°-2°, 3°-4° Plan Común + Diferenciado + TP) y EPJA. Cuadre automático contra horas asignadas. |
| **10** | **PIE (Decreto 170)** | **EXISTENTE** | `packages/mineduc-engine/src/normativaPieAuditor.ts`, `PieAuditorView.tsx`, `dotacionCalculationService.ts` | Matriz inmutable de horas cronológicas por NEET (máx 5) y NEEP (hasta 10), cálculo de horas docentes diferenciales vs asistentes de la educación (fonoaudiólogos, psicólogos), y cálculo de 3 horas de trabajo colaborativo Art. 86. |
| **11** | **Infraestructura** | **EXISTENTE** | `database/schema.ts` (`table salas_infraestructura`), `capacidadSae.ts`, `SalasSaeView.tsx` | Cálculo de aforo físico según Decreto 548 (1.1 m² básica/media, 1.5 m² párvulos, 1.8 m² talleres). Cruce con cupos SAE y matrícula proyectada para detectar hacinamiento o necesidad de desdoblamiento. |
| **12** | **Financiamiento** | **PARCIAL** | `types/index.ts`, `dotacionCalculationService.ts`, `estadisticasHorasService.ts`, `tests/proporcionDocenteYFinanciamiento.test.ts` | Desglose de horas por fuente (Subvención General, SEP, PIE) y calidad (Titular/Contrata). Detección de improcedencia de financiar Plan de Estudio obligatorio con SEP/PIE. **Falta:** cálculo financiero monetario (costo en pesos CLP, valor hora, bienios, BRP, asignación de zona y tramos de carrera docente). |
| **13** | **Normativa** | **EXISTENTE** | `packages/mineduc-engine/` (10 módulos), `tablasMineduc.ts`, `calculoMultitramo.ts`, `ley20903.ts` | Reglas inmutables en minutos enteros: Ley 20.903 (65/35 y 60/40), Ley 21.040, DFL 1/1996 (Estatuto Docente), Decreto 170/2009 (PIE), Decreto 548 (Infraestructura), Artículo 69 (tope 24h cronológicas para docentes mayores). |
| **14** | **Periodos** | **EXISTENTE** | `schema.ts` (`periodo INTEGER`), `carteraRepo.ts`, `App.tsx` | Soporte nativo para segmentar dotación por año escolar (2026, 2027, etc.). Índices compuestos `(rbd, periodo)` en SQLite. |
| **15** | **Comparación entre Periodos**| **EXISTENTE** | `carteraRepo.ts` (`getComparativaPeriodos`, `proyectarPeriodoColegio`), `ComparadorPeriodosModal.tsx` | Simulación y proyección con promoción de cohortes (1°B -> 2°B, 4°M egresa, regeneración de cohorte inicial). Matriz comparativa de deltas de matrícula, cursos, horas de contrato y variaciones individuales de docentes. |
| **16** | **Importación SIGE** | **EXISTENTE** | `services/sigeParserService.ts`, `SigeIngestaView.tsx` | Parser para archivos oficiales delimitados por punto y coma exportados desde SIGE MINEDUC. Mapeo automático de RUN, RBD, funciones y horas. |
| **17** | **Importación / Exportación Excel** | **EXISTENTE** | `services/excelMatrixParserService.ts`, `services/excelMatrizDotacionService.ts`, `services/excelReportService.ts`, `services/analizador/` | Importación de planillas matrices reales territoriales con detección de cursos combinados/multigrado. Exportación con formato institucional SLEP en ExcelJS con fórmulas dinámicas, celdas coloreadas y resúmenes normativos. |
| **18** | **Copilot / IA** | **EXISTENTE** | `services/dotacionCopilotService.ts`, `services/geminiApiClient.ts`, `DotacionCopilotDrawer.tsx` | Motor híbrido: asistente determinista local (offline, 0ms, sin API key) para responder consultas sobre balances, sobreasignaciones y alertas normativas + integración con API Google Gemini (modelos Gemini 2.5/Flash) vía IPC seguro en Electron. |
| **19** | **Auditoría** | **EXISTENTE** | `calculoMultitramo.ts`, `dotacionCalculationService.ts`, `ConsolidadorMasterView.tsx` | Detección de sobreasignaciones de aula, docentes con exceso de 44 hrs en el territorio multi-escuela, horas sin función asignada, incompatibilidades SEP/PIE y aforos excedidos. |
| **20** | **Estadísticas** | **EXISTENTE** | `services/estadisticasHorasService.ts`, `EstadisticasView.tsx` | Métricas y KPIs consolidados territoriales y por escuela: % de aula lectiva, % no lectivo, % recreos, % institucional, horas vacantes por fuente de financiamiento y gráficos de distribución. |

---

## 3. Mapa de Localización de la Lógica de Negocio

La lógica de negocio se encuentra actualmente estratificada en 5 capas:

```
[ Capa 1: Núcleo Matemático y Normativo Puro ]
  └── packages/mineduc-engine/src/
      ├── tablasMineduc.ts        -> Tablas oficiales 65/35 y 60/40 en minutos enteros.
      ├── calculoJornada.ts       -> Aritmética de recreos y HNL para 1 tramo.
      ├── calculoMultitramo.ts    -> Auditoría ponderada para docentes mixtos (65/35 + 60/40 + SEP + PIE).
      ├── normativaPieAuditor.ts  -> Decreto 170 y Ordinario 2398.
      ├── capacidadSae.ts         -> Decreto 548 (aforos) y cruce con cupos SAE.
      ├── planesEstudio.ts        -> Mallas curriculares obligatorias MINEDUC.
      └── modalidades.ts          -> Catálogo de modalidades de enseñanza.

[ Capa 2: Servicios de Dominio y Diagnóstico ]
  └── src/services/
      ├── dotacionCalculationService.ts -> Balanza horaria, balance por asignatura, cruce global de contratos.
      ├── estadisticasHorasService.ts   -> Métricas territoriales y agregación comunal.
      ├── combinacionCursosService.ts   -> Fusión y desdoblamiento de cursos multigrado.
      ├── dotacionCopilotService.ts     -> Respuestas contextuales y análisis semántico determinista.
      └── geminiExportAssistant.ts      -> Clasificación semántica de docentes asistida por IA.

[ Capa 3: Ingesta, Parsing y Homologación ]
  └── src/services/
      ├── sigeParserService.ts          -> Ingesta de archivos planos SIGE.
      ├── excelMatrixParserService.ts   -> Parser de matrices complejas de dotación.
      └── analizador/
          ├── classifier.ts            -> Clasificación regex de cargos y asignaturas.
          ├── courseExtractor.ts       -> Extracción de niveles desde encabezados.
          ├── homologationService.ts   -> Normalización contra catálogo MINEDUC.
          └── dotacionProcessor.ts     -> Cuadre de planillas de cálculo de establecimientos.

[ Capa 4: Persistencia y Transaccionalidad ]
  └── src/database/
      ├── schema.ts                    -> DDL de tablas e índices SQLite.
      ├── dbCore.ts                    -> Inicialización WASM, sincronización IndexedDB, transacciones.
      └── repositories/
          ├── carteraRepo.ts           -> Exportación de paquetes territoriales, proyección de cohortes.
          ├── traspasoRepo.ts          -> Inserción atómica y saneamiento del analizador a SQLite.
          └── docentesRepo.ts          -> Batching e inferencia de fuentes de financiamiento.

[ Capa 5: Presentación y Flujo de Usuario ]
  └── src/views/ & src/components/
      ├── CurriculumDemandaView.tsx    -> Panel interactivo de mallas, asignaciones y co-docencia.
      ├── DocentesDotacionView.tsx     -> Gestión de fichas docentes, funciones no aula y contratos.
      ├── CarteraView.tsx              -> Gestión de escuelas, importación/exportación de cartera.
      ├── ConsolidadorMasterView.tsx   -> Matriz territorial, alertas globales de RUT duplicado/44h.
      └── EstadisticasView.tsx         -> Visualización analítica y reportes de gestión.
```

---

## 4. Identificación de Lógica Duplicada y Fricciones

1. **Cálculo de Horas no Asignadas / Vacantes:**
   - Se calcula en `dotacionCalculationService.ts` (`estadoDocentes`), en `estadisticasHorasService.ts` (`desgloseDocentes`) y en `excelMatrizDotacionService.ts`. Aunque los 3 usan `@slep/mineduc-engine`, recalculan estructuras similares independientemente.
2. **Normalización de Cursos y Niveles:**
   - La lógica para reconocer si un texto representa "1° Básico", "EPJA", o "Multigrado" existe en `excelMatrixParserService.ts` (`normalizarEncabezadoCurso`), en `services/analizador/courseExtractor.ts` y en `services/combinacionCursosService.ts` (`extraerGradosDeCurso`).
3. **Clasificación de Funciones Fuera de Aula (Directivas/UTP/Convivencia/SEP):**
   - Existen heurísticas por expresiones regulares en `services/analizador/homologationService.ts`, en `services/analizador/classifier.ts` y en `database/repositories/traspasoRepo.ts`.
4. **Normalización de RUT:**
   - Se encuentra centralizado en `src/utils/rutUtils.ts`, pero algunas funciones secundarias en repositorios hacían `replace(/[^0-9kK]/g, '')` de forma ad-hoc antes de normalizar.

---

## 5. Análisis de la Persistencia, Runtime y Configuración

### 5.1 Base de Datos (sql.js / SQLite WASM)
- **Modo:** Base de datos in-memory en WebAssembly (`SQL.Database`).
- **Persistencia:** Al invocar `persistDb()`, se ejecuta `db.export()` generando un `Uint8Array` que se almacena en **IndexedDB** bajo la clave `slep_valle_diguillin_sqlite_db`.
- **Integridad:** Soporta transacciones ACID nativas (`BEGIN TRANSACTION`, `COMMIT`, `ROLLBACK`) implementadas en `guardarDocentesBatch` y `ejecutarTraspasoDotacionAnalizador`.
- **Límites:** El almacenamiento en IndexedDB elimina la barrera de 5 MB de localStorage, permitiendo bases de datos de decenas de megabytes sin degradación.
- **Riesgo:** Si la aplicación sufre un cierre forzado abrupto a nivel de proceso antes de que se ejecute `persistDb()`, las modificaciones en memoria no sincronizadas se pierden.

### 5.2 Configuración Electron (`electron/main.ts`)
- **Seguridad:** `nodeIntegration: false`, `contextIsolation: true`, `sandbox: false`, `webSecurity: true`.
- **Bridge IPC:** Exposición controlada en `preload.ts` (`saveFileDialog`, `openFileDialog`, `writeFile`, `readFile`, `geminiRequest`).
- **Llamadas a API Gemini:** Implementadas mediante `net.fetch` nativo de Chromium en el proceso principal (`main.ts`), evitando problemas de CORS en el frontend.

### 5.3 Configuración Vite (`vite.config.ts`)
- Configurado con alias `@` -> `./src` y `@slep/mineduc-engine` -> `./packages/mineduc-engine/src`.
- Chunking modular en Rollup (`vendor-react`, `vendor-icons`, `vendor-xlsx`).
- Base relativa (`./`) para ejecución hermética tanto en navegador como en protocolo `file://` dentro de Electron.
