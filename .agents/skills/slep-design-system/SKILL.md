---
name: slep-design-system
description: Guía de estilos, tokens de diseño institucional MINEDUC/SLEP, patrones de UI para densidad de datos, modales, alertas normativas y accesibilidad con Tailwind CSS.
triggers:
  - "ui"
  - "diseño"
  - "design system"
  - "componentes"
  - "tailwind"
  - "estilos"
  - "modal"
  - "tabla"
---

# Skill: Sistema de Diseño y UI para Gestión Educativa SLEP

Este skill estandariza los componentes visuales, paleta cromática institucional y patrones de usabilidad para interfaces densas de dotación docente y auditoría curricular.

---

## 1. Paleta Cromática y Tokens Semánticos

El sistema utiliza la identidad visual oficial de los Servicios Locales de Educación Pública (Gobierno de Chile):

| Categoría | Token Tailwind | Color Hex | Significado Funcional |
|---|---|---|---|
| **Primario Institucional** | `bg-blue-600` / `bg-blue-900` | `#1E40AF` / `#1E3A8A` | Encabezados, barras de navegación, botones de acción principal y estado activo de colegio. |
| **Aprobado / Cuadrado** | `bg-emerald-500` / `text-emerald-700` | `#10B981` / `#047857` | Demanda horaria cubierta al 100%, aforos conformes, balance en 0 horas. |
| **Alerta / Diferencia** | `bg-amber-500` / `text-amber-700` | `#F59E0B` / `#B45309` | Déficit de horas por asignar, advertencia de aforo al 90%, curso sin sala. |
| **Crítico / Infracción** | `bg-rose-600` / `text-rose-700` | `#E11D48` / `#BE123C` | Sobreasignación horaria, docente con > 44h territoriales, infracción Art. 69. |
| **PIE / Necesidades Esp.** | `bg-purple-600` / `text-purple-700` | `#7C3AED` / `#6D28D9` | Horas diferenciales Decreto 170, trabajo colaborativo, NEET/NEEP. |
| **SEP / Refuerzo** | `bg-sky-600` / `text-sky-700` | `#0284C7` / `#0369A1` | Talleres PME, co-docencia y financiamiento SEP. |

---

## 2. Patrones de Diseño para Alta Densidad de Datos

1. **Tablas de Matriz Curricular:**
   - Tipografía tabular monoespaciada para números (`font-mono text-sm`).
   - Sticky header obligatorio para listas largas de docentes o cursos.
   - Resaltado interactivo de filas con `hover:bg-slate-50 transition-colors`.
   - Tooltips enriquecidos en celdas con advertencias normativas para no saturar visualmente la grilla.

2. **Tarjetas KPI y Resúmenes de Balanza:**
   - Presentar el valor principal en tamaño `text-2xl font-bold`.
   - Subtítulo descriptivo con desglose en minutos pedagógicos y cronológicos.
   - Indicador visual de porcentaje de avance o cumplimiento.

3. **Modales y Diálogos de Confirmación:**
   - Fondo con backdrop blur: `fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center`.
   - En acciones destructivas (ej. vaciar dotación o eliminar periodo), exigir confirmación explícita mediante texto de seguridad.

---

## 3. Accesibilidad y Ergonomía

- Contraste WCAG AA asegurado en todos los estados de badge (`text-xs font-semibold px-2.5 py-0.5 rounded-full`).
- Soporte para navegación por teclado en selectores de cursos y docentes.
- Iconografía coherente provista por `lucide-react`.
