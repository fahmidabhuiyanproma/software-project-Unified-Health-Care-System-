<?php
/** GET /api/pharmacy-admin/dashboard.php — recent orders + low-stock list for this pharmacy. */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['pharmacy']);
$db = getDb();
$pharmacy = requireOwnedProvider($db, 'pharmacies');

$stmt = $db->prepare('SELECT COUNT(*) FROM pharmacy_orders WHERE pharmacy_id = :pid AND DATE(created_at) = CURDATE()');
$stmt->execute([':pid' => $pharmacy['id']]);
$ordersToday = (int) $stmt->fetchColumn();

$stmt = $db->prepare('SELECT COUNT(*) FROM pharmacy_orders WHERE pharmacy_id = :pid AND DATE(created_at) = CURDATE() AND status = "pending"');
$stmt->execute([':pid' => $pharmacy['id']]);
$pendingToday = (int) $stmt->fetchColumn();

// Revenue only counts once an order is actually delivered — a pending/
// processing order hasn't earned the pharmacy anything yet.
$stmt = $db->prepare('SELECT COALESCE(SUM(total_amount), 0) FROM pharmacy_orders WHERE pharmacy_id = :pid AND DATE(created_at) = CURDATE() AND status = "delivered"');
$stmt->execute([':pid' => $pharmacy['id']]);
$revenueToday = (float) $stmt->fetchColumn();

$stmt = $db->prepare('SELECT COALESCE(SUM(total_amount), 0) FROM pharmacy_orders WHERE pharmacy_id = :pid AND DATE(created_at) = CURDATE() - INTERVAL 1 DAY AND status = "delivered"');
$stmt->execute([':pid' => $pharmacy['id']]);
$revenueYesterday = (float) $stmt->fetchColumn();

$stmt = $db->prepare('SELECT COUNT(*) FROM medicines WHERE pharmacy_id = :pid');
$stmt->execute([':pid' => $pharmacy['id']]);
$totalProducts = (int) $stmt->fetchColumn();

$stmt = $db->prepare('SELECT COUNT(*) FROM medicines WHERE pharmacy_id = :pid AND stock_qty > 0 AND stock_qty < 50');
$stmt->execute([':pid' => $pharmacy['id']]);
$lowStockCount = (int) $stmt->fetchColumn();

$stmt = $db->prepare(
    'SELECT o.id, o.total_amount, o.status, o.created_at, u.full_name AS patient_name,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM pharmacy_orders o JOIN users u ON u.id = o.patient_id
     WHERE o.pharmacy_id = :pid ORDER BY o.id DESC LIMIT 10'
);
$stmt->execute([':pid' => $pharmacy['id']]);
$orders = array_map(function (array $o): array {
    return [
        'id' => 'ORD-' . $o['id'], 'patient' => $o['patient_name'], 'items' => (int) $o['item_count'],
        'total' => '৳ ' . number_format((float) $o['total_amount']), 'time' => $o['created_at'], 'status' => $o['status'],
    ];
}, $stmt->fetchAll());

$stmt = $db->prepare('SELECT name FROM medicines WHERE pharmacy_id = :pid AND stock_qty > 0 AND stock_qty < 50 ORDER BY stock_qty LIMIT 8');
$stmt->execute([':pid' => $pharmacy['id']]);
$lowStock = $stmt->fetchAll(PDO::FETCH_COLUMN);

respond([
    'success' => true,
    'pharmacy' => [
        'name' => $pharmacy['name'],
        'location' => trim(implode(', ', array_filter([$pharmacy['address'] ?? null, $pharmacy['city'] ?? null]))) ?: null,
    ],
    'stats' => [
        'ordersToday' => $ordersToday,
        'pendingToday' => $pendingToday,
        'revenueToday' => $revenueToday,
        'revenueYesterday' => $revenueYesterday,
        'totalProducts' => $totalProducts,
        'lowStockCount' => $lowStockCount,
    ],
    'recentOrders' => $orders,
    'lowStock' => $lowStock,
]);
