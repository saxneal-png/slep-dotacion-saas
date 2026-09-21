---
name: slep-dotacion-testing
description: Estándares de calidad de software, pirámide de pruebas con Vitest, fixtures realistas para dotación docente y validación de escenarios extremos (multigrado, TP, PIE, sobreasignaciones).
triggers:
  - "testing"
  - "tests"
  - "vitest"
  - "cobertura"
  - "fixtures"
  - "qa"
  - "probar"
---

# Skill: Testing, Fixtures y Control de Calidad SLEP

Este skill define la estrategia de pruebas automatizadas y aseguramiento de calidad del proyecto.

---

## 1. Pirámide de Pruebas

```
                   ▲
                  / \
                 /   \     E2E UI & Workflows (Puppeteer / Playwright)
                / E2E \    - Carga de planillas Excel, navegación entre vistas
               /───────\
              /         \   Pruebas de Integración y Repositorios
             / Integrac. \  - SQLite WASM in-memory, guardado batch, transacciones
            /─────────────\
           /               \ Pruebas Unitarias del Motor Normativo
          /    Unitarias    \ - @slep/mineduc-engine (Tablas 65/35, 60/40, PIE, Art. 69)
         /───────────────────\
```

---

## 2. Comandos de Ejecución de Tests

- **Suite Completa:** `npm test` o `npm run test:all`
- **Solo Motor Normativo:** `npm run test:engine`
- **Test Específico:** `npx vitest run tests/[nombre].test.ts`
- **Modo Watch:** `npx vitest`

---

## 3. Guía de Construcción de Fixtures

Al crear pruebas para nuevos casos de uso, utiliza siempre fixtures con datos consistentes con la realidad educacional chilena:

1. **RUTs Válidos:**
   - Usar RUNs chilenos con dígito verificador matemáticamente correcto (ej. `12.345.678-5`).
2. **Estructura de Horas Docente:**
   - Siempre verificar que la suma de horas por fuente cuadre con el contrato:
   ```typescript
   const docenteMock: Docente = {
     id: 'doc-001',
     rbd: '12345',
     periodo: 2026,
     run: '15.443.219-4',
     nombres: 'María Paz',
     apellidos: 'González Flores',
     titulo: 'Profesora de Educación General Básica',
     calidadJuridica: 'TITULAR',
     estamento: 'DOCENTE',
     horasContrato: 44,
     horasSubvencionGeneralTitular: 38,
     horasSubvencionGeneralContrata: 0,
     horasSepTitular: 6,
     horasSepContrata: 0,
     horasPieTitular: 0,
     horasPieContrata: 0,
     aplicaArticulo69: false,
     funcionesNoAula: []
   };
   ```
3. **Escenarios de Borde Obligatorios:**
   - Docente con 44h en Escuela A + 10h en Escuela B (debe saltar alerta territorial).
   - Docente de 44h con Artículo 69 con 33 HA de aula (debe marcar sobreasignación por superar tope de 32 HA).
   - Curso de 45 alumnos en sala de 40 m² básica (debe detectar hacinamiento por requerir 49.5 m²).
   - Curso PIE con 5 NEET + 2 NEEP (debe exigir exactamente 10 horas cronológicas docentes).
