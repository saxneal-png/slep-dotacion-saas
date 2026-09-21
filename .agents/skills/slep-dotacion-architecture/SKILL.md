---
name: slep-dotacion-architecture
description: Directrices de arquitectura de software, desacoplamiento en capas, persistencia SQLite WASM + IndexedDB, transacciones ACID, IPC seguro en Electron y consumo modular de @slep/mineduc-engine.
triggers:
  - "arquitectura"
  - "persistencia"
  - "sqlite wasm"
  - "sql.js"
  - "indexeddb"
  - "electron ipc"
  - "repositorios"
  - "mineduc-engine"
---

# Skill: Arquitectura, Persistencia y Manejo de Estado

Este skill gobierna la estructura técnica, separación de capas y patrones de persistencia del proyecto Consolidador de Dotación Docente SLEP.

---

## 1. Topología Arquitectónica en 5 Capas

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Electron Desktop Shell                         │
│ - electron/main.ts, preload.ts (Context Isolation: ON)  │
│ - IPC Handlers para Diálogos de Archivos y Gemini API   │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ Layer 2: Presentación (React 18 + Tailwind)             │
│ - src/views/ (Vistas funcionales)                       │
│ - src/components/ (Modales, Tablas reactivas, Paneles)  │
│ - src/context/ / Custom Hooks (Estado desacoplado)      │
└────────────┬─────────────────────────────┬──────────────┘
             │                             │
┌────────────▼──────────────────┐ ┌────────▼──────────────┐
│ Layer 3: Servicios de Negocio │ │ Layer 4: Motor Puro   │
│ - dotacionCalculationService  │ │ @slep/mineduc-engine  │
│ - estadisticasHorasService    │ │ (Inmutable, Minutos   │
│ - sigeParser / excelMatrix    │ │  Tablas Oficiales)    │
└────────────┬──────────────────┘ └───────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│ Layer 5: Persistencia SQLite WASM (sql.js + IndexedDB)  │
│ - database/dbCore.ts (In-memory execution)              │
│ - database/idbStorage.ts (Persistencia binaria Blob)    │
│ - database/repositories/ (Abstracción SQL tipada)       │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Reglas de Persistencia y Transacciones ACID

1. **Persistencia No Bloqueante con Respaldo:**
   - La base de datos opera 100% en memoria RAM vía WebAssembly (`sql.js`).
   - Cada operación de mutación que persista datos debe llamar a `persistDb()`.
   - `persistDb()` exporta el binario `db.export()` y lo guarda en IndexedDB de forma asíncrona.

2. **Transacciones Atómicas Obligatorias en Operaciones Batch:**
   - Al importar archivos masivos (SIGE, Matrices Excel, Proyección de periodos, Traspasos del analizador), SIEMPRE encapsula las inserciones en una transacción explícita:
   ```typescript
   db.run("BEGIN TRANSACTION;");
   try {
     // ... inserciones en batch
     db.run("COMMIT;");
     await persistDb();
   } catch (error) {
     db.run("ROLLBACK;");
     throw error;
   }
   ```

3. **Consultas Parametrizadas (Anti-SQL Injection):**
   - Nunca concatenes cadenas no sanitizadas en consultas SQL. Utiliza `db.prepare()` con parámetros vinculados o placeholders `?`:
   ```typescript
   const stmt = db.prepare("SELECT * FROM docentes WHERE rbd = ? AND periodo = ?;");
   stmt.bind([rbd, periodo]);
   ```

---

## 3. Desacoplamiento del Motor Normativo (`@slep/mineduc-engine`)

- El paquete `packages/mineduc-engine` debe mantenerse **100% libre de dependencias de React, DOM, Electron o SQLite**.
- Es un motor funcional puro (Entrada tipada $\to$ Salida tipada determinista).
- Cualquier nueva regla de cálculo ministerial (nuevas tablas de horas, decretos o leyes de ajuste curricular) debe codificarse primero en `packages/mineduc-engine` con sus respectivos tests unitarios antes de conectarse a la interfaz.

---

## 4. Comunicación Segura IPC en Electron

- Nunca actives `nodeIntegration: true` ni desactives `contextIsolation`.
- El archivo `electron/preload.ts` expone únicamente funciones seguras en `window.electronAPI`:
  - `saveFileDialog({ title, defaultPath, filters })`
  - `openFileDialog({ title, filters, properties })`
  - `writeFile(filePath, buffer)`
  - `readFile(filePath)`
  - `geminiRequest(payload)` (ejecuta llamadas hacia la API de Google Gemini en el proceso principal Node.js con `net.fetch` evitando CORS).
