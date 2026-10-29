<?php
/**
 * GET /api/common/hospitals.php — public list of registered hospitals, for
 * the doctor registration form's "select your hospital" step. No login
 * required (the visitor isn't signed in yet at registration time).
 * GET /api/common/hospitals.php?hospital_id=N — that hospital's departments,
 * for the dependent "select your department" dropdown.
 */

require_once __DIR__ . '/../_bootstrap.php';

$db = getDb();

$hospitalId = (int) ($_GET['hospital_id'] ?? 0);

if ($hospitalId > 0) {
    $stmt = $db->prepare('SELECT id, name FROM hospital_departments WHERE hospital_id = :hid ORDER BY name');
    $stmt->execute([':hid' => $hospitalId]);
    $departments = array_map(function (array $d): array {
        return ['id' => (int) $d['id'], 'name' => $d['name']];
    }, $stmt->fetchAll());
    respond(['success' => true, 'departments' => $departments]);
}

$stmt = $db->query('SELECT id, name, city FROM hospitals ORDER BY name');
$hospitals = array_map(function (array $h): array {
    return ['id' => (int) $h['id'], 'name' => $h['name'], 'city' => $h['city']];
}, $stmt->fetchAll());

respond(['success' => true, 'hospitals' => $hospitals]);
