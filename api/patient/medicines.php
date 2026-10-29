<?php
/** GET /api/patient/medicines.php?q= — browse the medicine catalog (FR-6.1). */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['patient']);
$db = getDb();

$q = trim((string) ($_GET['q'] ?? ''));
$sql = 'SELECT id, name, generic_name, brand, unit, price, stock_qty FROM medicines';
$params = [];
if ($q !== '') {
    $sql .= ' WHERE name LIKE :q OR generic_name LIKE :q2';
    $params[':q'] = "%$q%";
    $params[':q2'] = "%$q%";
}
$sql .= ' ORDER BY name';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$medicines = array_map(function (array $m): array {
    $stock = (int) $m['stock_qty'];
    $status = $stock === 0 ? 'out-of-stock' : ($stock < 50 ? 'low-stock' : 'in-stock');
    return [
        'id' => (int) $m['id'],
        'name' => $m['name'],
        'generic' => $m['generic_name'],
        'brand' => $m['brand'],
        'unit' => $m['unit'],
        'price' => (float) $m['price'],
        'stock' => $status,
    ];
}, $rows);

respond(['success' => true, 'medicines' => $medicines]);
