<?php
/** GET /api/patient/labs.php — list diagnostic labs (for the lab-select dropdown). */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['patient']);
$db = getDb();

$rows = $db->query('SELECT id, name, city FROM labs ORDER BY name')->fetchAll();

$labs = array_map(function (array $l): array {
    return ['id' => (int) $l['id'], 'name' => $l['name'] . ($l['city'] ? ', ' . $l['city'] : '')];
}, $rows);

respond(['success' => true, 'labs' => $labs]);
