<?php
/**
 * Controlador de Autenticación de Usuarios SLEP
 * Login para Directores, Asesores UATP y Administradores
 */

declare(strict_types=1);

namespace Slep\Api\Controllers;

use Slep\Api\Config\Database;
use Slep\Api\Middleware\AuthMiddleware;
use PDO;

class AuthController {
    public static function login(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $email = trim($data['email'] ?? '');
        $password = trim($data['password'] ?? '');

        if (empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Email y contraseña requeridos']);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT id, run, email, password_hash, nombre_completo, rol, rbd_asignado, activo FROM usuarios WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Credenciales inválidas']);
            return;
        }

        if (!$user['activo']) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Usuario inactivo. Contacte a soporte SLEP.']);
            return;
        }

        // Obtener cartera si es Asesor UATP
        $cartera = [];
        if ($user['rol'] === 'ASESOR_UATP') {
            $stmtCartera = $pdo->prepare('SELECT rbd FROM asesor_cartera WHERE usuario_id = :uid');
            $stmtCartera->execute([':uid' => $user['id']]);
            $cartera = $stmtCartera->fetchAll(PDO::FETCH_COLUMN);
        }

        $tokenPayload = [
            'id' => $user['id'],
            'run' => $user['run'],
            'email' => $user['email'],
            'nombre' => $user['nombre_completo'],
            'rol' => $user['rol'],
            'rbd_asignado' => $user['rbd_asignado'],
            'cartera' => $cartera
        ];

        $token = AuthMiddleware::generateToken($tokenPayload);

        // Actualizar último acceso
        $upd = $pdo->prepare('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = :id');
        $upd->execute([':id' => $user['id']]);

        echo json_encode([
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'run' => $user['run'],
                'nombre' => $user['nombre_completo'],
                'email' => $user['email'],
                'rol' => $user['rol'],
                'rbd_asignado' => $user['rbd_asignado'],
                'cartera' => $cartera
            ]
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function me(): void {
        $user = AuthMiddleware::authenticate();
        echo json_encode(['success' => true, 'user' => $user], JSON_UNESCAPED_UNICODE);
    }
}
