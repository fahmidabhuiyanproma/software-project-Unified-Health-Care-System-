<?php
/**
 * GET  /api/pharmacy-admin/orders.php — orders for this pharmacy, with line items.
 * POST /api/pharmacy-admin/orders.php {order_id} — advance pending->processing->delivered (FR-6.2).
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_notify.php';

requireRole(['pharmacy']);
$db = getDb();
$pharmacy = requireOwnedProvider($db, 'pharmacies');

$statusFlow = ['pending' => 'processing', 'processing' => 'delivered'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $orderId = (int) ($body['order_id'] ?? 0);

    $stmt = $db->prepare('SELECT * FROM pharmacy_orders WHERE id = :id AND pharmacy_id = :pid');
    $stmt->execute([':id' => $orderId, ':pid' => $pharmacy['id']]);
    $order = $stmt->fetch();
    if (!$order) {
        respond(['success' => false, 'message' => 'Order not found.'], 404);
    }
    $next = $statusFlow[$order['status']] ?? null;
    if (!$next) {
        respond(['success' => false, 'message' => 'This order has already been delivered.'], 409);
    }

    $db->prepare('UPDATE pharmacy_orders SET status = :status WHERE id = :id')->execute([':status' => $next, ':id' => $orderId]);
    notify($db, (int) $order['patient_id'], 'shopping-bag', 'Order Update', 'Your order #ORD-' . $orderId . ' is now ' . $next . '.');

    respond(['success' => true, 'message' => 'Order marked as ' . $next . '.']);
}

$stmt = $db->prepare(
    'SELECT o.id, o.total_amount, o.status, o.created_at, u.full_name AS patient_name, u.phone
     FROM pharmacy_orders o JOIN users u ON u.id = o.patient_id
     WHERE o.pharmacy_id = :pid ORDER BY o.id DESC'
);
$stmt->execute([':pid' => $pharmacy['id']]);
$orders = $stmt->fetchAll();

$itemStmt = $db->prepare('SELECT m.name, oi.quantity FROM order_items oi JOIN medicines m ON m.id = oi.medicine_id WHERE oi.order_id = :oid');

$result = array_map(function (array $o) use ($itemStmt): array {
    $itemStmt->execute([':oid' => $o['id']]);
    $items = array_map(function (array $i): string { return $i['name'] . ' ×' . $i['quantity']; }, $itemStmt->fetchAll());
    return [
        'id' => 'ORD-' . $o['id'], 'order_id' => (int) $o['id'], 'patient' => $o['patient_name'], 'phone' => $o['phone'],
        'items' => $items, 'total' => '৳ ' . number_format((float) $o['total_amount']),
        'date' => date('M j, Y', strtotime($o['created_at'])), 'time' => date('g:i A', strtotime($o['created_at'])),
        'status' => $o['status'],
    ];
}, $orders);

respond(['success' => true, 'orders' => $result]);
