---
name: slep-asesoria-territorial
description: Protocolo y reglas para la gestión de asesorías territoriales UATP, carteras de colegios asignados, supervisión de dotación escolar por asesor y filtros ejecutivos en el SLEP Valle Diguillín.
---

# Skill: Asesoría Territorial y Gestión de Carteras UATP

Este skill define la gobernanza, modelos de datos, protocolos de asignación y patrones de experiencia de usuario para que los asesores técnico-pedagógicos (UATP) del SLEP Valle Diguillín supervisen y filtren sus carteras de establecimientos asignados.

## 1. Contexto y Objetivos Operativos

El Servicio Local de Educación Pública (SLEP) Valle Diguillín administra 121 establecimientos educacionales distribuidos en 6 comunas (Bulnes, Chillán, Chillán Viejo, El Carmen, Pemuco, San Ignacio y Yungay).

Cada asesor de la Unidad de Acompañamiento Técnico Pedagógico (UATP) tiene a su cargo una cartera focalizada de escuelas y liceos. **Regla de Asignación Fundamental:** La asignación de establecimientos a los asesores se realiza **directamente por colegio individual (código RBD)** y NO por comuna completa. Esto permite que un asesor gestione carteras mixtas/inter-comunales según perfiles técnico-pedagógicos (ej. escuelas rurales multigrado, liceos TP, colegios con PIE de alta complejidad o continuidad curricular).

Para optimizar su labor diaria:
- **Filtrado Focalizado ("Mis Colegios Asesorados")**: Los asesores pueden aislar rápidamente sus escuelas asignadas en la vista de cartera, en el buscador global (Spotlight / Ctrl+K), en el espacio escolar y en los reportes ejecutivos.
- **Métricas Ejecutivas por Asesor**:
  - Total de colegios asignados y desglose por RBD.
  - Cobertura de matrícula proyectada y cupos SAE.
  - Horas docentes contratadas vs horas aula demandadas (Balance lectivo territorial).
  - Alertas normativas focalizadas (Ley 20.903, Decreto 170 PIE, Decreto 548).
- **Asignación Granular y Reasignación Rápida**:
  - Selector individual por establecimiento (RBD) en tarjetas y tablas.
  - Drawer / Selector interactivo de establecimientos con buscador por RBD y nombre en el perfil del asesor.
  - Reasignación masiva en lote de múltiples escuelas.

## 2. Modelado de Datos y Persistencia

### Estructura del Perfil de Asesor
```typescript
export interface PerfilAsesor {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  cargo?: string; // ej: "Asesor Técnico Pedagógico UATP", "Coordinador Comunal"
  comunasPreferentes?: string[];
  rbdsAsignados?: string[];
}
```

### Relación Establecimiento - Asesor
- En la tabla SQLite `establecimientos`, la columna `asesor_uatp` almacena el nombre del asesor responsable de dicho colegio (clave primaria `rbd`).
- Cuando un colegio no tiene asesor asignado, `asesor_uatp` es `undefined`, `null` o `'Sin Asignar'`.

## 3. Principios de UX y Navegación

1. **Selector Rápido de Asesor Activo**:
   - En la cabecera o módulo de asesorías, permitir conmutar entre la perspectiva de cualquier asesor o ver el territorio completo.
2. **Acciones Rápidas en Tarjeta Escolar**:
   - Acceso inmediato al "Espacio Escolar" (Workspace) con un solo clic.
   - Exportación de la dotación individual (`.slep`).
   - Exportación directa de la Matriz Oficial Excel (`.xlsx`).
   - Resumen visual de la balanza horaria (Superávit / Déficit / Exacto).
3. **Reasignación Ágil (Modal / Drawer)**:
   - Selección múltiple de establecimientos con buscador en tiempo real para asignar en lote a un asesor específico.
