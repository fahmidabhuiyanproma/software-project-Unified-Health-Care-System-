<?php
/** GET /api/patient/lab_tests.php — active diagnostic test catalog across all labs (FR-6.3). */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['patient']);
$db = getDb();

$rows = $db->query(
    'SELECT t.id, t.name, t.category, t.description, t.price, t.turnaround_text, t.lab_id
     FROM lab_tests t WHERE t.is_active = 1 ORDER BY t.name'
)->fetchAll();

$tests = array_map(function (array $t): array {
    return [
        'id' => (int) $t['id'],
        'lab_id' => (int) $t['lab_id'],
        'name' => $t['name'],
        'category' => $t['category'],
        'desc' => $t['description'],
        'price' => (float) $t['price'],
        'turnaround' => $t['turnaround_text'],
    ];
}, $rows);

respond(['success' => true, 'tests' => $tests]);
