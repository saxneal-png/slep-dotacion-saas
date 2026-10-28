<?php
/**
 * Enrutador Principal de la API REST SLEP Dotación
 * Apache 2.4 / PHP 8.3 FPM
 */

declare(strict_types=1);

// CORS Headers para permitir consumo desde el Frontend SPA
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

// Responder inmediatamente a pre-flight requests de los navegadores
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Cargar clases
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/middleware/auth.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/ColegiosController.php';
require_once __DIR__ . '/controllers/DotacionController.php';

use Slep\Api\Controllers\AuthController;
use Slep\Api\Controllers\ColegiosController;
use Slep\Api\Controllers\DotacionController;

// Obtener método y URI
$method = $_SERVER['REQUEST_METHOD'];
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Normalizar ruta quitando prefijos de subcarpetas si aplica (/api/...)
$basePath = preg_replace('#^.*?/api#', '', $requestUri);
$route = trim($basePath, '/');

// Enrutamiento simple y robusto sin dependencias pesadas
try {
    // 1. AUTENTICACIÓN
    if ($route === 'auth/login' && $method === 'POST') {
        AuthController::login();
        exit;
    }
    if ($route === 'auth/me' && $method === 'GET') {
        AuthController::me();
        exit;
    }

    // 2. COLEGIOS
    if ($route === 'colegios' && $method === 'GET') {
        ColegiosController::list();
        exit;
    }
    if (preg_match('#^colegios/([^/]+)$#', $route, $matches)) {
        $rbd = $matches[1];
        if ($method === 'GET') {
            ColegiosController::getByRbd($rbd);
            exit;
        }
        if ($method === 'PUT' || $method === 'POST') {
            ColegiosController::update($rbd);
            exit;
        }
    }

    // 3. DOTACIÓN
    if (preg_match('#^dotacion/([^/]+)$#', $route, $matches)) {
        $rbd = $matches[1];
        if ($method === 'GET') {
            DotacionController::getDotacion($rbd);
            exit;
        }
        if ($method === 'POST') {
            DotacionController::saveDotacion($rbd);
            exit;
        }
    }

    // 4. CONCURRENCIA / BLOQUEOS
    if (preg_match('#^bloqueos/([^/]+)/adquirir$#', $route, $matches) && $method === 'POST') {
        DotacionController::acquireLock($matches[1]);
        exit;
    }
    if (preg_match('#^bloqueos/([^/]+)/liberar$#', $route, $matches) && $method === 'POST') {
        DotacionController::releaseLock($matches[1]);
        exit;
    }

    // 5. HEALTHCHECK
    if ($route === 'health' || $route === '') {
        echo json_encode([
            'status' => 'online',
            'system' => 'SLEP Valle Diguillín Dotación API',
            'php_version' => PHP_VERSION,
            'timestamp' => date('c')
        ]);
        exit;
    }

    // Ruta no encontrada
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Endpoint no encontrado: ' . $route]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error interno del servidor',
        'message' => $e->getMessage()
    ]);
}
