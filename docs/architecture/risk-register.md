# Registro de Riesgos Técnicos y Estrategias de Mitigación

**Proyecto:** Plataforma de Planificación, Simulación y Auditoría de Dotación SLEP  
**Fecha:** Septiembre 2026  

---

## 1. Matriz General de Riesgos

| ID | Área de Riesgo | Nivel de Probabilidad | Impacto Técnico / Negocio | Nivel de Riesgo |
|---|---|:---:|:---:|:---:|
| **R-01** | Modificación del Motor Normativo Core (`mineduc-engine`) | Media | Crítico | **ALTO** |
| **R-02** | Evolución del Esquema de Base de Datos y Migraciones | Alta | Alto | **ALTO** |
| **R-03** | Introducción de Escenarios de Simulación y "What-If" | Media | Alto | **MEDIO-ALTO** |
| **R-04** | Persistencia Asíncrona SQLite WASM e IndexedDB | Media | Medio-Alto | **MEDIO** |
| **R-05** | Integridad Referencial y Consistencia de Fuentes de Financiamiento | Media | Alto | **ALTO** |
| **R-06** | Ingesta de Datos Heterogéneos (SIGE y Matrices Excel libres) | Alta | Medio | **MEDIO** |
| **R-07** | Dependencia y Comportamiento de Modelos de IA (Copilot / Gemini) | Media | Bajo-Medio | **BAJO** |

---

## 2. Análisis Detallado de Riesgos y Mitigaciones

### 2.1 [R-01] Riesgos de Modificar el Motor Normativo Core (`packages/mineduc-engine`)
- **Naturaleza del Riesgo:** El cálculo de remuneraciones y horas pedagógicas versus cronológicas en Chile está sujeto a auditorías de la Contraloría General de la República y la Superintendencia de Educación. Una alteración en las fórmulas de minutos de recreo, redondeo de fracciones de hora o tablas 65/35 y 60/40 invalidaría la validez jurídica y financiera de las propuestas de dotación.
- **Efecto Colateral:** Romper la compatibilidad en cascada en `dotacionCalculationService`, `estadisticasHorasService`, `excelMatrizDotacionService` y los 141 tests automatizados.
- **Estrategias de Mitigación:**
  1. Mantener `@slep/mineduc-engine` como un paquete inmutable aislado con su propia suite de tests unitarios independientes (`npm run test:engine`).
  2. Implementar versionado semántico formal para el motor de cálculo.
  3. No incorporar heurísticas de UI ni tipos de base de datos dentro de `mineduc-engine`.
  4. Exigir que cualquier cambio normativo se justifique con el número de Ley, Decreto u Ordinario MINEDUC correspondiente y cuente con tests de regresión parametrizados.

---

### 2.2 [R-02] Riesgos de Modificar el Esquema de Base de Datos SQLite
- **Naturaleza del Riesgo:** Actualmente las migraciones en `schema.ts` (`runMigrations`) se ejecutan mediante bloques `try / catch` con `ALTER TABLE ... ADD COLUMN`. Si se requiere renombrar columnas, cambiar claves primarias, dividir la tabla `docentes` en `contratos` o modificar tipos, SQLite en versiones WASM tiene soporte limitado para `ALTER TABLE` avanzados.
- **Efecto Colateral:** Corrupción de datos existentes en IndexedDB de usuarios locales o fallas silenciosas durante el inicio de la aplicación.
- **Estrategias de Mitigación:**
  1. Implementar un sistema formal de versionado de esquema con tabla de metadatos `__schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT)`.
  2. Para migraciones destructivas o de refactorización de claves, aplicar la técnica canónica de SQLite: crear tabla temporal `_new`, copiar datos con `INSERT INTO ... SELECT`, renombrar tablas y recrear índices dentro de una transacción única (`BEGIN TRANSACTION ... COMMIT`).
  3. Proporcionar un mecanismo automático de respaldo previo (`auto-backup`) del archivo `.sqlite` antes de ejecutar migraciones de versión.

---

### 2.3 [R-03] Riesgos de Introducir Nuevos Escenarios de Simulación ("What-If")
- **Naturaleza del Riesgo:** Si los escenarios de simulación (ej. "Escenario A: Fusión de Cursos", "Escenario B: Cierre de Nivel", "Escenario C: Ajuste 60/40") modifican directamente las tablas base de un periodo o sobreescriben la memoria global sin aislamiento, los datos reales de la dotación oficial pueden corromperse.
- **Efecto Colateral:** Fugas de estado entre escenarios, inconsistencia en comparativas temporales y degradación de memoria al clonar árboles de dotación masivos.
- **Estrategias de Mitigación:**
  1. Diseñar los escenarios como entidades explícitas en base de datos (`table escenarios_simulacion (id, rbd, periodo, nombre, es_base, creado_en)`) con clave foránea en cursos, contratos y asignaciones (`escenario_id`).
  2. El escenario base (`es_base = 1`) representa la dotación oficial; los escenarios simulados heredan por copia inmutable y no alteran la base oficial hasta que el usuario decida explícitamente "Aplicar Escenario como Oficial".
  3. Ejecutar simulaciones en memoria desacoplada utilizando el motor normativo sin persistir estados efímeros que el usuario descarte.

---

### 2.4 [R-04] Riesgos de Persistencia en IndexedDB y SQLite WASM
- **Naturaleza del Riesgo:** La base de datos opera completamente en la memoria RAM del proceso renderer y se vuelca por completo en cada persistencia (`dbInstance.export()`). Aunque IndexedDB soporta cientos de megabytes, operaciones de exportación masivas continuas pueden generar picos de memoria o retrasos en equipos de bajo rendimiento. Si el sistema operativo finaliza el proceso abruptamente antes del guardado, los últimos cambios en memoria no se conservan.
- **Estrategias de Mitigación:**
  1. Implementar un indicador visual de guardado en tiempo real (ya presente con `subscribePersist` en `Header.tsx`).
  2. Agregar un debouncer de persistencia (ej. retraso de 300 ms) para operaciones agrupadas en UI.
  3. En Electron, capturar el evento `beforeunload` y el hook `app.on('before-quit')` para forzar un `persistDb()` síncrono antes de la destrucción de la ventana.
  4. Mantener la opción de exportación e importación binaria directa de archivos `.sqlite` / `.slep` para respaldos manuales y portabilidad territorial.

---

### 2.5 [R-05] Riesgos de Integridad de Datos y Cuadre Financiero
- **Naturaleza del Riesgo:** Discrepancias entre la suma de fuentes de financiamiento (`horasSubvencionGeneral + horasSep + horasPie`) y las `horasContrato`, o asignaciones huérfanas que apuntan a cursos o docentes eliminados.
- **Estrategias de Mitigación:**
  1. Activar `PRAGMA foreign_keys = ON;` en `dbCore.ts` al inicializar la base de datos SQLite.
  2. Validar a nivel de repositorios (`guardarDocente`) que la suma de fuentes coincida exactamente con las horas totales de contrato antes de persistir.
  3. En la eliminación de cursos o docentes, ejecutar eliminaciones en cascada o verificaciones de integridad dentro de transacciones.
  4. Ejecutar el validador de integridad territorial en el arranque para alertar sobre cualquier anomalía previa.

---

### 2.6 [R-06] Riesgos de Ingesta de Datos Heterogéneos (SIGE y Excel)
- **Naturaleza del Riesgo:** Las planillas Excel enviadas por directores de escuelas y las descargas de SIGE suelen contener nombres de asignaturas no estandarizados, caracteres especiales corruptos (mojibake), formatos de RUT variables y celdas combinadas imprevistas.
- **Estrategias de Mitigación:**
  1. Mantener la capa de saneamiento (`limpiarTextoMineduc`, `normalizarRut`, `normalizeText`).
  2. En el módulo Analizador (`services/analizador/`), conservar la pantalla interactiva de homologación previa antes de transferir datos a la base de datos principal, permitiendo al asesor revisar y corregir equivalencias de asignaturas y cargos institucionales.

---

### 2.7 [R-07] Riesgos Asociados a Componentes de Inteligencia Artificial (Copilot / Gemini)
- **Naturaleza del Riesgo:** Falta de conexión a internet en escuelas rurales, ausencia de API Key configurada, latencia de red o respuestas no deterministas ("alucinaciones") en cálculos numéricos.
- **Estrategias de Mitigación:**
  1. **Principio de Primacía Normativa:** Las decisiones numéricas, cálculos de sobreasignación y matrices de horas se resuelven exclusivamente mediante el motor determinista local `@slep/mineduc-engine` y `dotacionCopilotService.ts` (`responderConsultaLocalmente`), con tiempo de respuesta de 0 ms y disponibilidad 100% offline.
  2. El modelo LLM (Gemini) se utiliza únicamente como asistente semántico contextual enriquecido y clasificador de texto, nunca como calculadora de dotación.
  3. Si la API de Gemini no responde o no está configurada, el Copilot conmuta de forma transparente al motor local sin interrumpir la experiencia de usuario.
