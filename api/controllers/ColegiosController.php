<?php
/**
 * Controlador de Establecimientos Educacionales SLEP
 */

declare(strict_types=1);

namespace Slep\Api\Controllers;

use Slep\Api\Config\Database;
use Slep\Api\Middleware\AuthMiddleware;
use PDO;

class ColegiosController {
    public static function list(): void {
        $user = AuthMiddleware::authenticate();
        $pdo = Database::getConnection();

        // Filtro según rol
        if ($user['rol'] === 'ADMIN') {
            $stmt = $pdo->query('SELECT rbd, nombre, comuna, tipo, director, telefono, email, regimen, porcentaje_prioritarios, estado_planificacion FROM establecimientos ORDER BY nombre ASC');
            $colegios = $stmt->fetchAll();
        } elseif ($user['rol'] === 'ASESOR_UATP') {
            $stmt = $pdo->prepare('
                SELECT e.rbd, e.nombre, e.comuna, e.tipo, e.director, e.telefono, e.email, e.regimen, e.porcentaje_prioritarios, e.estado_planificacion 
                FROM establecimientos e
                INNER JOIN asesor_cartera ac ON e.rbd = ac.rbd
                WHERE ac.usuario_id = :uid
                ORDER BY e.nombre ASC
            ');
            $stmt->execute([':uid' => $user['id']]);
            $colegios = $stmt->fetchAll();
        } else { // DIRECTOR
            $stmt = $pdo->prepare('SELECT rbd, nombre, comuna, tipo, director, telefono, email, regimen, porcentaje_prioritarios, estado_planificacion FROM establecimientos WHERE rbd = :rbd');
            $stmt->execute([':rbd' => $user['rbd_asignado']]);
            $colegios = $stmt->fetchAll();
        }

        echo json_encode(['success' => true, 'data' => $colegios], JSON_UNESCAPED_UNICODE);
    }

    public static function getByRbd(string $rbd): void {
        $user = AuthMiddleware::authenticate();
        AuthMiddleware::authorizeRbd($user, $rbd);

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM establecimientos WHERE rbd = :rbd LIMIT 1');
        $stmt->execute([':rbd' => $rbd]);
        $colegio = $stmt->fetch();

        if (!$colegio) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Establecimiento no encontrado']);
            return;
        }

        echo json_encode(['success' => true, 'data' => $colegio], JSON_UNESCAPED_UNICODE);
    }

    public static function update(string $rbd): void {
        $user = AuthMiddleware::authenticate();
        AuthMiddleware::authorizeRbd($user, $rbd);

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('
            UPDATE establecimientos 
            SET director = :director,
                telefono = :telefono,
                email = :email,
                regimen = :regimen,
                porcentaje_prioritarios = :porcentaje,
                estado_planificacion = COALESCE(:estado, estado_planificacion)
            WHERE rbd = :rbd
        ');

        $stmt->execute([
            ':director' => $data['director'] ?? null,
            ':telefono' => $data['telefono'] ?? null,
            ':email' => $data['email'] ?? null,
            ':regimen' => $data['regimen'] ?? 'JEC',
            ':porcentaje' => $data['porcentaje_prioritarios'] ?? 75.00,
            ':estado' => $data['estado_planificacion'] ?? null,
            ':rbd' => $rbd
        ]);

        echo json_encode(['success' => true, 'message' => 'Establecimiento actualizado con éxito']);
    }
}
