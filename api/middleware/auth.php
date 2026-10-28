<?php
/**
 * Middleware de Autenticación y Autorización por Token JWT / Bearer
 * Valida Roles: ADMIN, ASESOR_UATP, DIRECTOR
 */

declare(strict_types=1);

namespace Slep\Api\Middleware;

use Slep\Api\Config\Database;
use PDO;

class AuthMiddleware {
    /**
     * Obtiene la clave secreta desde la variable de entorno del servidor
     */
    private static function getSecretKey(): string {
        $secret = getenv('JWT_SECRET_KEY') ?: ($_ENV['JWT_SECRET_KEY'] ?? null);
        if (!$secret || strlen((string)$secret) < 32) {
            http_response_code(500);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                'success' => false,
                'error' => 'Error de configuración de seguridad en el servidor (JWT_SECRET_KEY ausente o insegura).'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        return (string)$secret;
    }

    /**
     * Genera un token JWT simple y firmado (HMAC SHA256)
     */
    public static function generateToken(array $payload, int $ttlSeconds = 86400): string {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload['exp'] = time() + $ttlSeconds;
        $payload['iat'] = time();

        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode(json_encode($payload));
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, self::getSecretKey(), true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    /**
     * Valida la petición entrante y retorna el usuario autenticado
     */
    public static function authenticate(): array {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

        if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'No autorizado: Token ausente o formato inválido']);
            exit;
        }

        $token = $matches[1];
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Token malformado']);
            exit;
        }

        list($header64, $payload64, $sig64) = $tokenParts;
        $signature = self::base64UrlDecode($sig64);
        $expectedSignature = hash_hmac('sha256', $header64 . "." . $payload64, self::getSecretKey(), true);

        if (!hash_equals($expectedSignature, $signature)) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Token con firma inválida']);
            exit;
        }

        $payload = json_decode(self::base64UrlDecode($payload64), true);
        if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Sesión expirada']);
            exit;
        }

        return $payload;
    }

    /**
     * Valida si el usuario tiene permiso para acceder a un RBD específico
     */
    public static function authorizeRbd(array $user, string $rbd): void {
        if ($user['rol'] === 'ADMIN') {
            return; // Administrador tiene acceso total a todos los colegios
        }

        if ($user['rol'] === 'DIRECTOR') {
            if ($user['rbd_asignado'] !== $rbd) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Acceso denegado: No tiene permisos sobre este RBD']);
                exit;
            }
            return;
        }

        if ($user['rol'] === 'ASESOR_UATP') {
            // Verificar si el RBD está en su cartera
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM asesor_cartera WHERE usuario_id = :uid AND rbd = :rbd');
            $stmt->execute([':uid' => $user['id'], ':rbd' => $rbd]);
            if ($stmt->fetchColumn() == 0) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Acceso denegado: El establecimiento no pertenece a su cartera UATP']);
                exit;
            }
            return;
        }

        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Permisos insuficientes']);
        exit;
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
