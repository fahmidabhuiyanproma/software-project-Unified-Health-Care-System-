<?php
/**
 * POST /api/patient/pharmacy_order.php {items: [{id, qty}], payment_method}
 * Places a medicine order (FR-6.1) and records a sandbox payment receipt
 * (FR-7.1/7.2). All items must currently come from the same pharmacy —
 * true for this MVP since there is a single seeded pharmacy catalog.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_notify.php';

$patientId = requireRole(['patient']);
$db = getDb();

$body = readJsonBody();
$items = is_array($body['items'] ?? null) ? $body['items'] : [];
$paymentMethod = (string) ($body['payment_method'] ?? '');

if (count($items) === 0) {
    respond(['success' => false, 'message' => 'Your cart is empty.'], 422);
}
if (!in_array($paymentMethod, ['bkash', 'nagad', 'rocket'], true)) {
    respond(['success' => false, 'message' => 'Please select a valid payment method.'], 422);
}

$db->beginTransaction();
try {
    $subtotal = 0;
    $lineItems = [];
    $pharmacyId = null;

    foreach ($items as $item) {
        $medId = (int) ($item['id'] ?? 0);
        $qty = max(1, (int) ($item['qty'] ?? 0));

        $stmt = $db->prepare('SELECT id, pharmacy_id, price, stock_qty, name FROM medicines WHERE id = :id FOR UPDATE');
        $stmt->execute([':id' => $medId]);
        $med = $stmt->fetch();
        if (!$med) {
            throw new RuntimeException('One of the items in your cart no longer exists.');
        }
        if ($med['stock_qty'] < $qty) {
            throw new RuntimeException($med['name'] . ' does not have enough stock.');
        }
        $pharmacyId = $pharmacyId ?? $med['pharmacy_id'];

        $lineItems[] = ['medicine_id' => $med['id'], 'qty' => $qty, 'price' => $med['price']];
        $subtotal += $med['price'] * $qty;
    }

    $deliveryFee = 50;
    $total = $subtotal + $deliveryFee;

    $stmt = $db->prepare(
        'INSERT INTO pharmacy_orders (patient_id, pharmacy_id, subtotal, delivery_fee, total_amount, payment_method)
         VALUES (:pid, :pharm, :sub, :delivery, :total, :method)'
    );
    $stmt->execute([':pid' => $patientId, ':pharm' => $pharmacyId, ':sub' => $subtotal, ':delivery' => $deliveryFee, ':total' => $total, ':method' => $paymentMethod]);
    $orderId = (int) $db->lastInsertId();

    foreach ($lineItems as $li) {
        $db->prepare('INSERT INTO order_items (order_id, medicine_id, quantity, unit_price) VALUES (:oid, :mid, :qty, :price)')
           ->execute([':oid' => $orderId, ':mid' => $li['medicine_id'], ':qty' => $li['qty'], ':price' => $li['price']]);
        $db->prepare('UPDATE medicines SET stock_qty = stock_qty - :qty WHERE id = :mid')
           ->execute([':qty' => $li['qty'], ':mid' => $li['medicine_id']]);
    }

    $txnRef = 'TXN-' . strtoupper(bin2hex(random_bytes(5)));
    $db->prepare('INSERT INTO payments (patient_id, reference_type, reference_id, amount, method, transaction_ref) VALUES (:pid, "pharmacy_order", :ref, :amount, :method, :txn)')
       ->execute([':pid' => $patientId, ':ref' => $orderId, ':amount' => $total, ':method' => $paymentMethod, ':txn' => $txnRef]);

    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    respond(['success' => false, 'message' => $e->getMessage() ?: 'Could not place order.'], 422);
}

notify($db, $patientId, 'shopping-bag', 'Order Placed', 'Your order #ORD-' . $orderId . ' has been placed and is being processed.');

$pharmOwnerStmt = $db->prepare('SELECT owner_user_id FROM pharmacies WHERE id = :id');
$pharmOwnerStmt->execute([':id' => $pharmacyId]);
$pharmOwnerId = $pharmOwnerStmt->fetchColumn();
if ($pharmOwnerId) {
    $patientNameStmt = $db->prepare('SELECT full_name FROM users WHERE id = :id');
    $patientNameStmt->execute([':id' => $patientId]);
    $patientName = $patientNameStmt->fetchColumn() ?: 'A patient';
    $itemCount = count($lineItems);
    notify($db, (int) $pharmOwnerId, 'shopping-bag', 'New Order', $patientName . ' placed order #ORD-' . $orderId . ' (' . $itemCount . ' item' . ($itemCount === 1 ? '' : 's') . ', ৳' . number_format($total) . ').');
}

respond([
    'success' => true,
    'order_id' => $orderId,
    'order_label' => 'ORD-' . $orderId,
    'transaction_ref' => $txnRef,
    'total' => $total,
    'message' => 'Order placed successfully.',
]);
