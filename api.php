<?php
// ============================================================
// GameZone — FastCard API Proxy
// ارفع هذا الملف في: public_html/api.php
// ============================================================

// CORS — اسمح للموقع يتصل
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── إعدادات ──────────────────────────────────────────────
define('FC_BASE',  'https://fastcard1.store/client/api');
define('FC_TOKEN', 'QMMcLPmGsdgD6lQq9Z_2WFdfMQnLy1ZfM670CByiBS43O5PX6U9SHmlvMBI_ycg7');
define('PROFIT',   0.15); // هامش الربح 15% — غيّره من هون

// ── Helper: طلب لـ FastCard ──────────────────────────────
function fc_request($path, $method = 'GET', $params = []) {
    $url = FC_BASE . $path;

    if (!empty($params) && $method === 'POST') {
        $url .= '?' . http_build_query($params);
    } elseif (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => [
            'api-token: ' . FC_TOKEN,
            'Accept: application/json',
        ],
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    if ($err) {
        http_response_code(503);
        echo json_encode(['error' => 'FastCard unreachable: ' . $err]);
        exit;
    }

    http_response_code($status);
    echo $body;
    exit;
}

// ── Router ───────────────────────────────────────────────
$action = $_GET['action'] ?? '';

switch ($action) {

    // GET /api.php?action=profile
    case 'profile':
        fc_request('/profile');
        break;

    // GET /api.php?action=products
    case 'products':
        $raw = file_get_contents(FC_BASE . '/products', false, stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => 'api-token: ' . FC_TOKEN,
                'timeout' => 15,
            ]
        ]));
        $products = json_decode($raw, true);
        if (!is_array($products)) {
            echo json_encode(['error' => 'Failed to fetch products']);
            exit;
        }
        // Apply profit margin
        foreach ($products as &$p) {
            $p['sell_price'] = round($p['price'] * (1 + PROFIT), 3);
        }
        header('Content-Type: application/json');
        echo json_encode($products);
        exit;

    // POST /api.php?action=order
    // Body JSON: { productId, qty, playerId?, order_uuid, ...extra }
    case 'order':
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $productId = $body['productId'] ?? null;
        if (!$productId) {
            http_response_code(400);
            echo json_encode(['error' => 'productId required']);
            exit;
        }
        unset($body['productId']);
        fc_request('/newOrder/' . $productId . '/params', 'POST', $body);
        break;

    // GET /api.php?action=check&orderId=ID_123
    case 'check':
        $orderId = $_GET['orderId'] ?? '';
        $isUUID  = $_GET['uuid'] ?? '0';
        if (!$orderId) {
            http_response_code(400);
            echo json_encode(['error' => 'orderId required']);
            exit;
        }
        if ($isUUID === '1') {
            fc_request('/check?orders=["' . urlencode($orderId) . '"]&uuid=1');
        } else {
            fc_request('/check?orders=[' . urlencode($orderId) . ']');
        }
        break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'Unknown action: ' . $action]);
        exit;
}
