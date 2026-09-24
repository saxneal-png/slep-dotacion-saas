---
name: slep-aesthetic-theming
description: Especialista en diseño visual de alta gama, estética artística de interfaces, disposición de elementos en dashboards, botonería artesanal, tipografías tabulares, micro-animaciones y sistemas de temas personalizables (CSS variables / Tailwind).
triggers:
  - "estilo"
  - "estetica"
  - "diseño visual"
  - "tema"
  - "personalizacion"
  - "color"
  - "botones"
  - "dashboard"
  - "animacion"
  - "tipografia"
  - "dark mode"
---

# Skill: Artesanía Visual, Estética de Interfaces y Motor de Temas

Esta skill provee estándares avanzados de diseño visual, dirección artística y componentes estilizados para plataformas de alta densidad de datos (educación, auditoría, dashboards analíticos y herramientas de gestión territorial).

---

## 1. Filosofía de Dirección de Arte para Plataformas de Datos

Las aplicaciones profesionales y gubernamentales no deben ser aburridas ni visualmente toscas. La estética eleva la confianza del usuario, reduce la fatiga visual en jornadas extensas y facilita la toma de decisiones críticas.

### Principios Fundamentales:
1. **Claridad sobre Ruido (Data-First Beauty)**: El color no es adorno; comunica estado, jerarquía, urgencia y pertenencia.
2. **Elevación y Profundidad Sutil**: Uso de bordes subpíxel (`ring-1 ring-slate-900/5` o `border-white/10`), sombras suaves multicapa y `backdrop-blur` en superficies flotantes.
3. **Ritmo y Micro-Espaciado**: Grilla base de 4px / 8px. Espaciados coherentes (`gap-3`, `gap-4`, `p-5`, `p-6`).
4. **Composiciones Bento Grid**: Agrupación visual en bloques modulares con esquinas redondeadas calibradas (`rounded-xl` / `rounded-2xl`).

---

## 2. Sistema de Temas Personalizables (Theming Engine)

El motor de temas se basa en variables CSS semánticas aplicadas en el `:root` o mediante un atributo `data-theme="..."`. Permite alternar instantáneamente entre esquemas visuales sin romper la legibilidad ni la normativa de contraste WCAG AA/AAA.

### A. Definición de Variables CSS Semánticas
```css
/* Variables base para el tema activo */
:root, [data-theme="slep-republicano"] {
  --canvas-bg: #f8fafc;
  --surface-card: #ffffff;
  --surface-card-hover: #f1f5f9;
  --surface-elevated: #ffffff;
  --border-subtle: #e2e8f0;
  --border-strong: #cbd5e1;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  
  /* Identidad & Acentos */
  --brand-primary: #002b49;        /* Azul SLEP */
  --brand-primary-light: #006699;  /* Azul Claro */
  --brand-accent: #e35205;         /* Naranja Institucional */
  --brand-gold: #c69214;           /* Dorado / Destacado */
  
  /* Semántica de Estado */
  --status-success: #10b981;
  --status-warning: #f59e0b;
  --status-danger: #e11d48;
  --status-pie: #8b5cf6;
  --status-sep: #0284c7;

  /* Efectos & Glow */
  --glow-primary: rgba(0, 102, 153, 0.18);
  --shadow-card: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05);
  --shadow-hover: 0 10px 25px -5px rgba(0, 43, 73, 0.08), 0 8px 10px -6px rgba(0, 43, 73, 0.04);
}

/* Tema 2: Graphite & Cyan Executive (Modo Oscuro Sofisticado) */
[data-theme="executive-dark"] {
  --canvas-bg: #090d16;
  --surface-card: #0f172a;
  --surface-card-hover: #1e293b;
  --surface-elevated: #1e293b;
  --border-subtle: #1e293b;
  --border-strong: #334155;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  
  --brand-primary: #38bdf8;
  --brand-primary-light: #7dd3fc;
  --brand-accent: #f97316;
  --brand-gold: #fbbf24;
  
  --status-success: #34d399;
  --status-warning: #fbbf24;
  --status-danger: #fb7185;
  --status-pie: #a78bfa;
  --status-sep: #38bdf8;

  --glow-primary: rgba(56, 189, 248, 0.15);
  --shadow-card: 0 4px 20px -2px rgba(0, 0, 0, 0.5);
  --shadow-hover: 0 12px 30px -4px rgba(0, 0, 0, 0.7);
}

/* Tema 3: Emerald Botanical (Enfoque de Calma y Equilibrio) */
[data-theme="emerald-nordic"] {
  --canvas-bg: #f4fbf7;
  --surface-card: #ffffff;
  --surface-card-hover: #ebf8f2;
  --surface-elevated: #ffffff;
  --border-subtle: #d1fae5;
  --border-strong: #a7f3d0;
  --text-primary: #064e3b;
  --text-secondary: #047857;
  --text-muted: #6ee7b7;
  
  --brand-primary: #059669;
  --brand-primary-light: #10b981;
  --brand-accent: #d97706;
  --brand-gold: #eab308;
  
  --status-success: #059669;
  --status-warning: #d97706;
  --status-danger: #dc2626;
  --status-pie: #7c3aed;
  --status-sep: #0284c7;

  --glow-primary: rgba(5, 150, 105, 0.15);
  --shadow-card: 0 1px 3px 0 rgba(6, 78, 59, 0.05);
  --shadow-hover: 0 10px 25px -5px rgba(6, 78, 59, 0.08);
}
```

---

## 3. Botonería Artesanal e Interacciones Táctiles

Los botones son el elemento interactivo principal. Cada variante debe tener una anatomía clara:

### Catálogo de Variantes:
1. **Primary Glow Button (Acción Principal)**:
   - Gradiente de color con brillo difuso inferior.
   - Micro-escala al hacer click (`active:scale-[0.98]`).
   - `transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)`.
   ```tsx
   <button className="relative group inline-flex items-center justify-center px-4 py-2 text-sm font-medium tracking-tight text-white rounded-lg bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 hover:from-blue-800 hover:to-sky-700 shadow-sm hover:shadow-md hover:shadow-blue-500/20 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
     <Sparkles className="w-4 h-4 mr-2 transition-transform group-hover:rotate-12" />
     <span>Ejecutar Balance</span>
   </button>
   ```

2. **Subtle Glass / Ghost Button (Acción Secundaria)**:
   - Fondo traslúcido con borde refinado.
   ```tsx
   <button className="inline-flex items-center px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 rounded-lg backdrop-blur-sm shadow-xs transition-all duration-150 active:scale-[0.98]">
     <Download className="w-4 h-4 mr-2 text-slate-500" />
     <span>Exportar Excel</span>
   </button>
   ```

3. **Pill Badge Selector / Switchers**:
   - Pestañas con animación de pastilla activa y fondo con contraste dinámico.

---

## 4. Tipografía y Numerales Tabulares

En software analítico, la alineación visual de números y códigos es crítica:
1. **Tabular Nums**: Usar siempre `tabular-nums` en conteos de horas, RUTs, balances y porcentajes para evitar saltos de línea y desalineación óptica.
2. **Jerarquía Tipográfica**:
   - Títulos de Sección: `text-xl font-bold tracking-tight text-slate-900 dark:text-white`
   - Subtítulos / Metadata: `text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400`
   - Métricas Clave (KPI Big Numbers): `text-3xl font-extrabold tracking-tight tabular-nums`
   - Indicadores de Unidad: `text-xs font-medium text-slate-400 ml-1`

---

## 5. Micro-Animaciones y Coreografía Visual

- **Timing Curves**: Usar la curva `cubic-bezier(0.16, 1, 0.3, 1)` para un movimiento "snappy" y profesional (estilo Apple/macOS).
- **Entrada Escalonada (Staggered Animation)**: En dashboards, renderizar tarjetas con retardo de 50ms entre cada una para crear una sensación fluida.
- **Pulsos de Estado**: Al cambiar un balance crítico a superávit o déficit, activar un pulso suave `animate-pulse` que se desvanece tras 1.5 segundos.
- **Backdrop Blur en Modales**: `backdrop-blur-md bg-slate-900/40` con animación de entrada suave `scale-95 opacity-0 -> scale-100 opacity-100`.

---

## 6. Checklist de Evaluación Estética

Antes de finalizar una interfaz o componente, verificar:
- [ ] ¿Los contrastes de texto cumplen estándar WCAG AA?
- [ ] ¿Los números están configurados con `tabular-nums` y alineados a la derecha en tablas?
- [ ] ¿Los botones tienen estados `:hover`, `:active` y `:focus-visible` claramente perceptibles?
- [ ] ¿Las tarjetas usan bordes sutiles en lugar de sombras negras pesadas?
- [ ] ¿Existe soporte o adaptabilidad para cambios de tema claro/oscuro/institucional?
- [ ] ¿Los estados vacíos (empty states) tienen ilustraciones/iconos estilizados y un llamado a la acción claro?
