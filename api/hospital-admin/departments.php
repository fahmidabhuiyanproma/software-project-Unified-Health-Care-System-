<?php
/**
 * GET  /api/hospital-admin/departments.php — departments at this hospital.
 * POST /api/hospital-admin/departments.php {name, bed_count} — add one (FR-2.1).
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_beds.php';

requireRole(['hospital']);
$db = getDb();
$hospital = requireOwnedProvider($db, 'hospitals');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $name = trim((string) ($body['name'] ?? ''));
    $bedCount = max(0, (int) ($body['bed_count'] ?? 0));

    if ($name === '') {
        respond(['success' => false, 'message' => 'Department name is required.'], 422);
    }

    $stmt = $db->prepare('SELECT id FROM hospital_departments WHERE hospital_id = :hid AND name = :name');
    $stmt->execute([':hid' => $hospital['id'], ':name' => $name]);
    if ($stmt->fetch()) {
        respond(['success' => false, 'message' => 'This department already exists.'], 409);
    }

    $stmt = $db->prepare('INSERT INTO hospital_departments (hospital_id, name, bed_count) VALUES (:hid, :name, :beds)');
    $stmt->execute([':hid' => $hospital['id'], ':name' => $name, ':beds' => $bedCount]);

    respond(['success' => true, 'message' => 'Department added.']);
}

$stmt = $db->prepare(
    'SELECT hd.id, hd.name, hd.bed_count,
            (SELECT COUNT(*) FROM doctors d WHERE d.department_id = hd.id) AS doctor_count,
            (SELECT COUNT(*) FROM appointments a JOIN doctors d ON d.id = a.doctor_id
             WHERE d.department_id = hd.id AND a.appointment_date = CURDATE() AND a.status = "confirmed") AS today_appts,
            (SELECT d.full_name FROM doctors d WHERE d.department_id = hd.id ORDER BY d.id LIMIT 1) AS head_doctor
     FROM hospital_departments hd WHERE hd.hospital_id = :hid ORDER BY hd.name'
);
$stmt->execute([':hid' => $hospital['id']]);

$bedsFree = [];
foreach (hospitalBedSummary($db, (int) $hospital['id']) as $b) $bedsFree[$b['id']] = $b['available'];

$departments = array_map(function (array $d) use ($bedsFree): array {
    return [
        'id' => (int) $d['id'], 'name' => $d['name'], 'beds' => (int) $d['bed_count'], 'bedsFree' => $bedsFree[(int) $d['id']] ?? (int) $d['bed_count'],
        'doctors' => (int) $d['doctor_count'], 'todayAppts' => (int) $d['today_appts'],
        'head' => $d['head_doctor'] ?: 'Unassigned',
    ];
}, $stmt->fetchAll());

respond(['success' => true, 'departments' => $departments]);
