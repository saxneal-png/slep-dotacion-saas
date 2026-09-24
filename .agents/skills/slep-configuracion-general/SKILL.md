---
name: slep-configuracion-general
description: Arquitectura y reglas para el centro de configuraciones generales del sistema de dotación SLEP, incluyendo perfiles de usuario/asesor, personalización del motor normativo MINEDUC, configuración de IA Gemini/Copilot, preferencias de interfaz y almacenamiento persistente.
---

# Skill: Centro de Configuraciones Generales SLEP

Este skill define la estructura, componentes y comportamiento del módulo de Configuraciones Generales del Consolidador de Dotación Docente para el SLEP Valle Diguillín.

## 1. Módulos y Pestañas de Configuración

El Centro de Configuraciones Generales centraliza todas las opciones del sistema en 5 áreas funcionales:

### 1. Perfil de Asesor & Gestión de Asesores UATP
- **Asesor Activo**: Selección del asesor actual del sistema (almacenado en `configuracion_general`).
- **Datos de Contacto**: Nombre, correo institucional `@slepvallediguillin.cl`, teléfono de contacto y cargo.
- **Gestión de Lista de Asesores**: Alta de nuevos asesores, edición de nombres existentes, eliminación o reasignación masiva de carteras.
- **Matriz de Asignación Rápida**: Asignación de colegios a cada asesor con buscador y filtros por comuna.

### 2. Parámetros del Motor MINEDUC & Normativa Escolar
- **Umbral de Vulnerabilidad Ley 20.903**: Porcentaje mínimo de alumnos prioritarios para aplicar la proporción lectiva 60/40 (predeterminado: 80%).
- **Duración de Hora Pedagógica**: Predeterminado 45 minutos (0.75 horas cronológicas).
- **Proporción de Recreos MINEDUC**: 10 minutos de recreo proporcional por cada 45 minutos lectivos.
- **Tope Máximo de Jornada Territorial**: 44 horas semanales de contrato docente en el SLEP.
- **Horas PIE Base Decreto 170**: Cálculo automático de horas de apoyo especializado por curso con NEET (predeterminado 3 horas docente diferencial + profesionales PAE).
- **Aforos y Salas Decreto 548**: Metros cuadrados mínimos por alumno (1.1 m² en básica/media, 1.5 m² en parvularia).
- **Validaciones Estrictas**: Interruptor para activar/desactivar advertencias de sobreasignación y restricciones de financiamiento SEP/PIE en asignaturas del plan común.

### 3. Inteligencia Artificial (Gemini AI & Copilot)
- **API Key de Google Gemini**: Clave de API para consultas semánticas y auditoría inteligente.
- **Modelo de IA**: Selector de modelos (`gemini-2.5-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`).
- **Análisis Automático en Exportación**: Interruptor para invocar Gemini al exportar matrices Excel.
- **Temperatura y Creatividad**: Control de balance entre precisión técnica y síntesis ejecutiva.
- **Comprobación de Conexión**: Botón de prueba de conectividad y estado de la cuota de API.

### 4. Preferencias de Interfaz & Visualización
- **Periodo Predeterminado**: Año escolar de apertura predeterminado (2026 o 2027).
- **Vista Inicial al Iniciar**: Módulo que se muestra al abrir la aplicación (`cartera`, `colegios_asesorados`, `workflow`, `estadisticas`, etc.).
- **Densidad de Tablas**: Modo compacto (alta densidad de datos) o cómodo (mayor espaciado).
- **Animaciones y Notificaciones**: Control de toasts y transiciones visuales.

### 5. Base de Datos, Respaldos & Mantenimiento
- **Respaldos SQLite Offline**: Exportación y restauración directa de archivos `.sqlite`.
- **Exportación e Importación de Cartera SLEP**: Archivos `.slep` interoperables.
- **Sincronización del Catálogo Maestro**: Re-sincronización de los 121 establecimientos oficiales del catálogo.
- **Restablecimiento de Fábrica**: Opción para restablecer configuraciones por defecto.

## 2. Esquema de Tipos y Persistencia

```typescript
export interface ConfiguracionGeneral {
  // Asesor activo
  asesorActivoId: string;
  asesorActivoNombre: string;
  asesorActivoEmail: string;
  asesorActivoTelefono?: string;
  asesorActivoCargo?: string;
  
  // Lista de asesores disponibles
  asesoresRegistrados: {
    id: string;
    nombre: string;
    email: string;
    telefono?: string;
    cargo?: string;
  }[];

  // Parámetros MINEDUC
  umbralPrioritarios60_40: number; // Defecto: 80
  duracionHoraPedagogicaMin: number; // Defecto: 45
  topeHorasDocenteSlep: number; // Defecto: 44
  horasPieDocentePorCurso: number; // Defecto: 3
  validacionesEstrictas: boolean; // Defecto: true

  // Configuración Gemini AI
  geminiApiKey: string;
  geminiModel: string; // Defecto: 'gemini-2.5-flash'
  geminiAnalizarTodos: boolean; // Defecto: false
  copilotModoEstricto: boolean; // Defecto: true

  // Preferencias UI
  periodoPredeterminado: 2026 | 2027;
  vistaInicial: string; // 'cartera' | 'colegios_asesorados' | 'workflow' | 'consolidador' | 'estadisticas'
  densidadTablas: 'compacta' | 'comoda';
}
```
