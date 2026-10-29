<?php
/**
 * GET  /api/pharmacy-admin/catalog.php — this pharmacy's medicine catalog + stock (FR-2.4).
 * POST /api/pharmacy-admin/catalog.php {name, generic_name, category, price, stock_qty} — add a medicine.
 * POST /api/pharmacy-admin/catalog.php {action:"update", id, name, generic_name, category, price, stock_qty}
 *      — edit an existing medicine's details/price/stock.
 */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['pharmacy']);
$db = getDb();
$pharmacy = requireOwnedProvider($db, 'pharmacies');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $action = (string) ($body['action'] ?? 'add');

    $name = trim((string) ($body['name'] ?? ''));
    $generic = trim((string) ($body['generic_name'] ?? ''));
    $category = trim((string) ($body['category'] ?? ''));
    $price = (float) ($body['price'] ?? 0);
    $stock = max(0, (int) ($body['stock_qty'] ?? 0));

    if ($name === '' || $generic === '' || $category === '' || $price <= 0) {
        respond(['success' => false, 'message' => 'Brand name, generic name, category, and price are required.'], 422);
    }

    if ($action === 'update') {
        $medicineId = (int) ($body['id'] ?? 0);
        $stmt = $db->prepare('SELECT id FROM medicines WHERE id = :id AND pharmacy_id = :pid');
        $stmt->execute([':id' => $medicineId, ':pid' => $pharmacy['id']]);
        if (!$stmt->fetch()) {
            respond(['success' => false, 'message' => 'Medicine not found.'], 404);
        }

        $stmt = $db->prepare(
            'UPDATE medicines SET name = :name, generic_name = :generic, category = :cat, price = :price, stock_qty = :stock WHERE id = :id'
        );
        $stmt->execute([':name' => $name, ':generic' => $generic, ':cat' => $category, ':price' => $price, ':stock' => $stock, ':id' => $medicineId]);

        respond(['success' => true, 'message' => 'Medicine updated.']);
    }

    $stmt = $db->prepare('INSERT INTO medicines (pharmacy_id, name, generic_name, category, unit, price, stock_qty) VALUES (:pid, :name, :generic, :cat, "tablet", :price, :stock)');
    $stmt->execute([':pid' => $pharmacy['id'], ':name' => $name, ':generic' => $generic, ':cat' => $category, ':price' => $price, ':stock' => $stock]);

    respond(['success' => true, 'message' => 'Medicine added to catalog.']);
}

$stmt = $db->prepare('SELECT id, name, generic_name, category, price, stock_qty FROM medicines WHERE pharmacy_id = :pid ORDER BY name');
$stmt->execute([':pid' => $pharmacy['id']]);

$lowCount = 0; $outCount = 0;
$medicines = array_map(function (array $m) use (&$lowCount, &$outCount): array {
    $stock = (int) $m['stock_qty'];
    $status = $stock === 0 ? 'out-of-stock' : ($stock < 50 ? 'low-stock' : 'in-stock');
    if ($status === 'low-stock') $lowCount++;
    if ($status === 'out-of-stock') $outCount++;
    return ['id' => (int) $m['id'], 'name' => $m['name'], 'generic' => $m['generic_name'], 'category' => $m['category'], 'price' => (float) $m['price'], 'stock' => $stock, 'status' => $status];
}, $stmt->fetchAll());

respond(['success' => true, 'medicines' => $medicines, 'lowStockCount' => $lowCount, 'outOfStockCount' => $outCount]);
