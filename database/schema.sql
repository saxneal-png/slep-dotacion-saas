-- ==============================================================================
-- SISTEMA DE GESTIÓN Y PLANIFICACIÓN DE DOTACIÓN ESCOLAR SLEP VALLE DIGUILLÍN
-- Esquema de Base de Datos para MySQL 8.0 (InnoDB, utf8mb4_unicode_ci)
-- Soporta: Multi-tenancy por RBD, Roles (Director, Asesor UATP, Administrador SLEP),
-- Asignación Ley 20.903, Cursos SAE, Asignaturas y Control de Bloqueos de Edición.
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. ESTABLECIMIENTOS EDUCACIONALES (121 Establecimientos SLEP)
CREATE TABLE IF NOT EXISTS establecimientos (
    rbd VARCHAR(10) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    comuna VARCHAR(100) NOT NULL,
    tipo ENUM('LICEO', 'ESCUELA', 'COLEGIO', 'JARDIN', 'SALA_CUNA') NOT NULL DEFAULT 'ESCUELA',
    director VARCHAR(255) DEFAULT NULL,
    telefono VARCHAR(50) DEFAULT NULL,
    email VARCHAR(150) DEFAULT NULL,
    regimen ENUM('JEC', 'No JEC', 'Mixto') NOT NULL DEFAULT 'JEC',
    porcentaje_prioritarios DECIMAL(5,2) NOT NULL DEFAULT 75.00,
    subvencion_sep_mensual DECIMAL(14,2) DEFAULT 0.00,
    subvencion_pro_retencion DECIMAL(14,2) DEFAULT 0.00,
    cupo_horas_pie_diferencial INT DEFAULT 0,
    cupo_horas_pie_asistentes INT DEFAULT 0,
    estado_planificacion ENUM('BORRADOR', 'EN_REVISION', 'APROBADO_UATP', 'CONSOLIDADO') NOT NULL DEFAULT 'BORRADOR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_comuna (comuna),
    INDEX idx_estado_planificacion (estado_planificacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. USUARIOS Y PERFILES DE ACCESO
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run VARCHAR(12) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(255) NOT NULL,
    rol ENUM('ADMIN', 'ASESOR_UATP', 'DIRECTOR', 'VISUALIZADOR') NOT NULL,
    rbd_asignado VARCHAR(10) DEFAULT NULL, -- Obligatorio para DIRECTORES
    activo TINYINT(1) NOT NULL DEFAULT 1,
    ultimo_acceso TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rbd_asignado) REFERENCES establecimientos(rbd) ON DELETE SET NULL,
    INDEX idx_rol (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. CARTERA DE ASESORÍAS TERRITORIALES UATP (Un Asesor supervisa múltiples RBDs)
CREATE TABLE IF NOT EXISTS asesor_cartera (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    rbd VARCHAR(10) NOT NULL,
    asignado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (rbd) REFERENCES establecimientos(rbd) ON DELETE CASCADE,
    UNIQUE KEY uq_asesor_rbd (usuario_id, rbd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. CURSOS SAE Y PLANES DE ESTUDIO
CREATE TABLE IF NOT EXISTS cursos_sae (
    id VARCHAR(50) PRIMARY KEY,
    rbd VARCHAR(10) NOT NULL,
    periodo INT NOT NULL DEFAULT 2027,
    nivel VARCHAR(100) NOT NULL,
    letra VARCHAR(5) NOT NULL DEFAULT 'A',
    regimen ENUM('JEC', 'No JEC') NOT NULL DEFAULT 'JEC',
    regimen_proporcion ENUM('65_35', '60_40') NOT NULL DEFAULT '65_35',
    cupo_sae INT NOT NULL DEFAULT 35,
    matricula_proyectada INT NOT NULL DEFAULT 30,
    alumnos_neet INT NOT NULL DEFAULT 0,
    alumnos_neep INT NOT NULL DEFAULT 0,
    tipo_modalidad VARCHAR(50) NOT NULL DEFAULT 'REGULAR',
    especialidad_tp VARCHAR(150) DEFAULT NULL,
    plan_estudio_id VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rbd) REFERENCES establecimientos(rbd) ON DELETE CASCADE,
    INDEX idx_curso_rbd_periodo (rbd, periodo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. ASIGNATURAS POR CURSO
CREATE TABLE IF NOT EXISTS curso_asignaturas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    curso_id VARCHAR(50) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    horas_semanales INT NOT NULL DEFAULT 2,
    caracter VARCHAR(50) DEFAULT 'Obligatoria',
    FOREIGN KEY (curso_id) REFERENCES cursos_sae(id) ON DELETE CASCADE,
    INDEX idx_curso_asig (curso_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. DOCENTES Y PROFESIONALES DE LA EDUCACIÓN
CREATE TABLE IF NOT EXISTS docentes (
    id VARCHAR(50) PRIMARY KEY,
    rbd VARCHAR(10) NOT NULL,
    periodo INT NOT NULL DEFAULT 2027,
    run VARCHAR(12) NOT NULL,
    nombres VARCHAR(150) NOT NULL,
    apellidos VARCHAR(150) NOT NULL,
    titulo VARCHAR(255) DEFAULT NULL,
    calidad_juridica ENUM('TITULAR', 'CONTRATA') NOT NULL DEFAULT 'TITULAR',
    estamento VARCHAR(50) NOT NULL DEFAULT 'DOCENTE_AULA',
    horas_contrato INT NOT NULL DEFAULT 44,
    horas_subvencion_general_titular INT DEFAULT 0,
    horas_subvencion_general_contrata INT DEFAULT 0,
    horas_sep_titular INT DEFAULT 0,
    horas_sep_contrata INT DEFAULT 0,
    horas_pie_titular INT DEFAULT 0,
    horas_pie_contrata INT DEFAULT 0,
    horas_directivas INT DEFAULT 0,
    horas_inspector_general INT DEFAULT 0,
    horas_tecnico_pedagogicas INT DEFAULT 0,
    horas_coordinacion INT DEFAULT 0,
    horas_taller_sep INT DEFAULT 0,
    horas_trabajo_colaborativo INT DEFAULT 0,
    horas_coordinacion_pie INT DEFAULT 0,
    horas_convivencia_escolar INT DEFAULT 0,
    horas_extraescolar INT DEFAULT 0,
    cargo_institucional VARCHAR(150) DEFAULT NULL,
    tipo_coordinacion VARCHAR(150) DEFAULT NULL,
    horas_aula INT DEFAULT 0,
    funcion_principal VARCHAR(150) DEFAULT NULL,
    aplica_articulo69 TINYINT(1) DEFAULT 0,
    horas_vigentes_anterior INT DEFAULT 0,
    propuesta_gdp VARCHAR(255) DEFAULT NULL,
    remuneracion_mensual DECIMAL(12,2) DEFAULT 0.00,
    fecha_inicio_contrato DATE DEFAULT NULL,
    fecha_termino_contrato DATE DEFAULT NULL,
    estado_sancion_gdp ENUM('Pendiente', 'Aprobado', 'Aprobado parcial.', 'Rechazado') DEFAULT 'Pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rbd) REFERENCES establecimientos(rbd) ON DELETE CASCADE,
    INDEX idx_docente_rbd (rbd, periodo),
    INDEX idx_docente_run (run)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. ASIGNACIÓN DE HORAS DOCENTE EN CURSOS (Vínculo Mineduc-Engine)
CREATE TABLE IF NOT EXISTS asignaciones_docente_curso (
    id INT AUTO_INCREMENT PRIMARY KEY,
    docente_id VARCHAR(50) NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    asignatura_nombre VARCHAR(150) NOT NULL,
    horas_lectivas INT NOT NULL DEFAULT 2,
    tipo_financiamiento ENUM('GENERAL', 'SEP', 'PIE') NOT NULL DEFAULT 'GENERAL',
    FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE CASCADE,
    FOREIGN KEY (curso_id) REFERENCES cursos_sae(id) ON DELETE CASCADE,
    INDEX idx_asig_doc (docente_id),
    INDEX idx_asig_cur (curso_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. BLOQUEOS DE EDICIÓN Y SEGURIDAD CONCURRENTE
CREATE TABLE IF NOT EXISTS bloqueos_edicion (
    rbd VARCHAR(10) PRIMARY KEY,
    bloqueado_por INT NOT NULL,
    usuario_nombre VARCHAR(255) NOT NULL,
    modulo VARCHAR(50) NOT NULL DEFAULT 'DOTACION_DOCENTE',
    bloqueado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expira_en TIMESTAMP NOT NULL,
    FOREIGN KEY (rbd) REFERENCES establecimientos(rbd) ON DELETE CASCADE,
    FOREIGN KEY (bloqueado_por) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. AUDITORÍA DE CAMBIOS (LOG TRANSACCIONAL)
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT DEFAULT NULL,
    rbd VARCHAR(10) DEFAULT NULL,
    accion VARCHAR(50) NOT NULL,
    entidad VARCHAR(50) NOT NULL,
    registro_id VARCHAR(50) DEFAULT NULL,
    detalles JSON DEFAULT NULL,
    ip VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_audit_rbd (rbd),
    INDEX idx_audit_fecha (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
