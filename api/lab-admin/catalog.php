<?php
/**
 * GET  /api/lab-admin/catalog.php — this lab's test catalog (FR-2.3).
 * POST /api/lab-admin/catalog.php {name, category, price, turnaround, description} — add a test.
 * POST /api/lab-admin/catalog.php {toggle_id, is_active} — flip a test's active flag.
 */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['lab']);
$db = getDb();
$lab = requireOwnedProvider($db, 'labs');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();

    if (isset($body['toggle_id'])) {
        $id = (int) $body['toggle_id'];
        $isActive = !empty($body['is_active']) ? 1 : 0;
        $stmt = $db->prepare('UPDATE lab_tests SET is_active = :active WHERE id = :id AND lab_id = :lid');
        $stmt->execute([':active' => $isActive, ':id' => $id, ':lid' => $lab['id']]);
        respond(['success' => true]);
    }

    $name = trim((string) ($body['name'] ?? ''));
    $category = trim((string) ($body['category'] ?? ''));
    $price = (float) ($body['price'] ?? 0);
    $turnaround = trim((string) ($body['turnaround'] ?? ''));
    $description = trim((string) ($body['description'] ?? ''));

    if ($name === '' || $category === '' || $price <= 0 || $turnaround === '') {
        respond(['success' => false, 'message' => 'Test name, category, price, and turnaround time are required.'], 422);
    }

    $stmt = $db->prepare('INSERT INTO lab_tests (lab_id, name, category, description, price, turnaround_text) VALUES (:lid, :name, :cat, :desc, :price, :turn)');
    $stmt->execute([':lid' => $lab['id'], ':name' => $name, ':cat' => $category, ':desc' => $description !== '' ? $description : null, ':price' => $price, ':turn' => $turnaround]);

    respond(['success' => true, 'message' => 'Test added to catalog.']);
}

$stmt = $db->prepare('SELECT id, name, category, price, turnaround_text, is_active FROM lab_tests WHERE lab_id = :lid ORDER BY name');
$stmt->execute([':lid' => $lab['id']]);

$tests = array_map(function (array $t): array {
    return [
        'id' => (int) $t['id'], 'name' => $t['name'], 'category' => $t['category'],
        'price' => (float) $t['price'], 'turnaround' => $t['turnaround_text'], 'active' => (bool) $t['is_active'],
    ];
}, $stmt->fetchAll());

respond(['success' => true, 'tests' => $tests]);
