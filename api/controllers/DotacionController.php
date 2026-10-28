<?php
/**
 * Controlador de Dotación Escolar (Docentes, Cursos y Asignaciones)
 */

declare(strict_types=1);

namespace Slep\Api\Controllers;

use Slep\Api\Config\Database;
use Slep\Api\Middleware\AuthMiddleware;
use PDO;

class DotacionController {
    /**
     * Obtiene el paquete completo de dotación de un RBD:
     * Datos del colegio, Cursos SAE con asignaturas, Docentes y Asignaciones.
     */
    public static function getDotacion(string $rbd): void {
        $user = AuthMiddleware::authenticate();
        AuthMiddleware::authorizeRbd($user, $rbd);

        $periodo = (int)($_GET['periodo'] ?? 2027);
        $pdo = Database::getConnection();

        // 1. Colegio
        $stmtEst = $pdo->prepare('SELECT * FROM establecimientos WHERE rbd = :rbd');
        $stmtEst->execute([':rbd' => $rbd]);
        $establecimiento = $stmtEst->fetch();

        // 2. Cursos
        $stmtCursos = $pdo->prepare('SELECT * FROM cursos_sae WHERE rbd = :rbd AND periodo = :periodo ORDER BY nivel, letra');
        $stmtCursos->execute([':rbd' => $rbd, ':periodo' => $periodo]);
        $cursos = $stmtCursos->fetchAll();

        // Cargar asignaturas por curso
        foreach ($cursos as &$c) {
            $stmtAsig = $pdo->prepare('SELECT id, nombre, horas_semanales, caracter FROM curso_asignaturas WHERE curso_id = :cid');
            $stmtAsig->execute([':cid' => $c['id']]);
            $c['asignaturas'] = $stmtAsig->fetchAll();
        }

        // 3. Docentes
        $stmtDoc = $pdo->prepare('SELECT * FROM docentes WHERE rbd = :rbd AND periodo = :periodo ORDER BY apellidos, nombres');
        $stmtDoc->execute([':rbd' => $rbd, ':periodo' => $periodo]);
        $docentes = $stmtDoc->fetchAll();

        // 4. Asignaciones de Horas (Leyes 20.903)
        $stmtAsigDoc = $pdo->prepare('
            SELECT a.* 
            FROM asignaciones_docente_curso a
            INNER JOIN docentes d ON a.docente_id = d.id
            WHERE d.rbd = :rbd AND d.periodo = :periodo
        ');
        $stmtAsigDoc->execute([':rbd' => $rbd, ':periodo' => $periodo]);
        $asignaciones = $stmtAsigDoc->fetchAll();

        // 5. Estado de Bloqueo
        $stmtLock = $pdo->prepare('SELECT bloqueado_por, usuario_nombre, bloqueado_en, expira_en FROM bloqueos_edicion WHERE rbd = :rbd AND expira_en > NOW()');
        $stmtLock->execute([':rbd' => $rbd]);
        $bloqueo = $stmtLock->fetch();

        echo json_encode([
            'success' => true,
            'establecimiento' => $establecimiento,
            'cursos' => $cursos,
            'docentes' => $docentes,
            'asignaciones' => $asignaciones,
            'bloqueo' => $bloqueo ?: null
        ], JSON_UNESCAPED_UNICODE);
    }

    /**
     * Guarda transaccionalmente la dotación docente completa de un RBD
     */
    public static function saveDotacion(string $rbd): void {
        $user = AuthMiddleware::authenticate();
        AuthMiddleware::authorizeRbd($user, $rbd);

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $periodo = (int)($data['periodo'] ?? 2027);
        $docentes = $data['docentes'] ?? [];
        $cursos = $data['cursos'] ?? [];
        $asignaciones = $data['asignaciones'] ?? [];

        $pdo = Database::getConnection();

        try {
            $pdo->beginTransaction();

            // 1. Sincronizar Docentes (UPSERT o Reemplazo seguro por RBD y periodo)
            // Para mantener integridad, actualizamos o insertamos cada docente
            $stmtDocUpsert = $pdo->prepare('
                INSERT INTO docentes (
                    id, rbd, periodo, run, nombres, apellidos, titulo, calidad_juridica,
                    estamento, horas_contrato, horas_subvencion_general_titular, horas_subvencion_general_contrata,
                    horas_sep_titular, horas_sep_contrata, horas_pie_titular, horas_pie_contrata,
                    horas_directivas, horas_inspector_general, horas_tecnico_pedagogicas, horas_coordinacion,
                    horas_taller_sep, horas_trabajo_colaborativo, horas_coordinacion_pie, horas_convivencia_escolar,
                    horas_extraescolar, horas_aula, funcion_principal, aplica_articulo69, remuneracion_mensual
                ) VALUES (
                    :id, :rbd, :periodo, :run, :nombres, :apellidos, :titulo, :calidad_juridica,
                    :estamento, :horas_contrato, :h_sg_tit, :h_sg_con,
                    :h_sep_tit, :h_sep_con, :h_pie_tit, :h_pie_con,
                    :h_dir, :h_insp, :h_tp, :h_coord,
                    :h_tall_sep, :h_colab, :h_coord_pie, :h_conv,
                    :h_extra, :h_aula, :funcion, :art69, :remun
                ) ON DUPLICATE KEY UPDATE
                    nombres = VALUES(nombres),
                    apellidos = VALUES(apellidos),
                    titulo = VALUES(titulo),
                    calidad_juridica = VALUES(calidad_juridica),
                    estamento = VALUES(estamento),
                    horas_contrato = VALUES(horas_contrato),
                    horas_subvencion_general_titular = VALUES(horas_subvencion_general_titular),
                    horas_subvencion_general_contrata = VALUES(horas_subvencion_general_contrata),
                    horas_sep_titular = VALUES(horas_sep_titular),
                    horas_sep_contrata = VALUES(horas_sep_contrata),
                    horas_pie_titular = VALUES(horas_pie_titular),
                    horas_pie_contrata = VALUES(horas_pie_contrata),
                    horas_directivas = VALUES(horas_directivas),
                    horas_inspector_general = VALUES(horas_inspector_general),
                    horas_tecnico_pedagogicas = VALUES(horas_tecnico_pedagogicas),
                    horas_coordinacion = VALUES(horas_coordinacion),
                    horas_taller_sep = VALUES(horas_taller_sep),
                    horas_trabajo_colaborativo = VALUES(horas_trabajo_colaborativo),
                    horas_coordinacion_pie = VALUES(horas_coordinacion_pie),
                    horas_convivencia_escolar = VALUES(horas_convivencia_escolar),
                    horas_extraescolar = VALUES(horas_extraescolar),
                    horas_aula = VALUES(horas_aula),
                    funcion_principal = VALUES(funcion_principal),
                    aplica_articulo69 = VALUES(aplica_articulo69),
                    remuneracion_mensual = VALUES(remuneracion_mensual)
            ');

            foreach ($docentes as $doc) {
                $stmtDocUpsert->execute([
                    ':id' => $doc['id'],
                    ':rbd' => $rbd,
                    ':periodo' => $periodo,
                    ':run' => $doc['run'],
                    ':nombres' => $doc['nombres'] ?? '',
                    ':apellidos' => $doc['apellidos'] ?? '',
                    ':titulo' => $doc['titulo'] ?? null,
                    ':calidad_juridica' => $doc['calidadJuridica'] ?? 'TITULAR',
                    ':estamento' => $doc['estamento'] ?? 'DOCENTE_AULA',
                    ':horas_contrato' => $doc['horasContrato'] ?? 44,
                    ':h_sg_tit' => $doc['horasSubvencionGeneralTitular'] ?? 0,
                    ':h_sg_con' => $doc['horasSubvencionGeneralContrata'] ?? 0,
                    ':h_sep_tit' => $doc['horasSepTitular'] ?? 0,
                    ':h_sep_con' => $doc['horasSepContrata'] ?? 0,
                    ':h_pie_tit' => $doc['horasPieTitular'] ?? 0,
                    ':h_pie_con' => $doc['horasPieContrata'] ?? 0,
                    ':h_dir' => $doc['horasDirectivas'] ?? 0,
                    ':h_insp' => $doc['horasInspectorGeneral'] ?? 0,
                    ':h_tp' => $doc['horasTecnicoPedagogicas'] ?? 0,
                    ':h_coord' => $doc['horasCoordinacion'] ?? 0,
                    ':h_tall_sep' => $doc['horasTallerSep'] ?? 0,
                    ':h_colab' => $doc['horasTrabajoColaborativo'] ?? 0,
                    ':h_coord_pie' => $doc['horasCoordinacionPie'] ?? 0,
                    ':h_conv' => $doc['horasConvivenciaEscolar'] ?? 0,
                    ':h_extra' => $doc['horasExtraescolar'] ?? 0,
                    ':h_aula' => $doc['horasAula'] ?? 0,
                    ':funcion' => $doc['funcionPrincipal'] ?? null,
                    ':art69' => !empty($doc['aplicaArticulo69']) ? 1 : 0,
                    ':remun' => $doc['remuneracionMensual'] ?? 0.00
                ]);
            }

            // 2. Registrar en auditoría
            $stmtAudit = $pdo->prepare('
                INSERT INTO logs_auditoria (usuario_id, rbd, accion, entidad, detalles, ip)
                VALUES (:uid, :rbd, :accion, :entidad, :detalles, :ip)
            ');
            $stmtAudit->execute([
                ':uid' => $user['id'],
                ':rbd' => $rbd,
                ':accion' => 'GUARDAR_DOTACION',
                ':entidad' => 'DOTACION_DOCENTE',
                ':detalles' => json_encode(['num_docentes' => count($docentes), 'num_asignaciones' => count($asignaciones)]),
                ':ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);

            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Dotación guardada exitosamente en la base de datos'], JSON_UNESCAPED_UNICODE);
        } catch (\Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Error al guardar la dotación: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * Adquiere o renueva el bloqueo de edición para evitar concurrencia
     */
    public static function acquireLock(string $rbd): void {
        $user = AuthMiddleware::authenticate();
        AuthMiddleware::authorizeRbd($user, $rbd);

        $pdo = Database::getConnection();
        
        // Comprobar si existe un bloqueo activo de otro usuario
        $stmt = $pdo->prepare('SELECT bloqueado_por, usuario_nombre, expira_en FROM bloqueos_edicion WHERE rbd = :rbd AND expira_en > NOW()');
        $stmt->execute([':rbd' => $rbd]);
        $currentLock = $stmt->fetch();

        if ($currentLock && (int)$currentLock['bloqueado_por'] !== (int)$user['id']) {
            http_response_code(423); // Locked
            echo json_encode([
                'success' => false,
                'locked' => true,
                'message' => 'El establecimiento está siendo editado por ' . $currentLock['usuario_nombre'],
                'lock' => $currentLock
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        // Renovar o insertar bloqueo por 15 minutos
        $stmtUpsert = $pdo->prepare('
            INSERT INTO bloqueos_edicion (rbd, bloqueado_por, usuario_nombre, modulo, expira_en)
            VALUES (:rbd, :uid, :unombre, "DOTACION", DATE_ADD(NOW(), INTERVAL 15 MINUTE))
            ON DUPLICATE KEY UPDATE 
                bloqueado_por = VALUES(bloqueado_por),
                usuario_nombre = VALUES(usuario_nombre),
                expira_en = VALUES(expira_en)
        ');
        $stmtUpsert->execute([
            ':rbd' => $rbd,
            ':uid' => $user['id'],
            ':unombre' => $user['nombre']
        ]);

        echo json_encode(['success' => true, 'message' => 'Bloqueo concedido por 15 minutos']);
    }

    /**
     * Libera el bloqueo de edición
     */
    public static function releaseLock(string $rbd): void {
        $user = AuthMiddleware::authenticate();
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('DELETE FROM bloqueos_edicion WHERE rbd = :rbd AND (bloqueado_por = :uid OR :is_admin = 1)');
        $stmt->execute([
            ':rbd' => $rbd,
            ':uid' => $user['id'],
            ':is_admin' => $user['rol'] === 'ADMIN' ? 1 : 0
        ]);

        echo json_encode(['success' => true, 'message' => 'Bloqueo liberado']);
    }
}
