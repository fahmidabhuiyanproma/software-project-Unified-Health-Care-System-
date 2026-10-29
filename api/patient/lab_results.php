<?php
/** GET /api/patient/lab_results.php — the patient's lab bookings + results, newest first. */

require_once __DIR__ . '/../_bootstrap.php';

$patientId = requireRole(['patient']);
$db = getDb();

$stmt = $db->prepare(
    'SELECT b.id, b.status, b.booking_date, t.name AS test_name, l.name AS lab_name,
            r.result_summary, r.file_path
     FROM lab_bookings b
     JOIN lab_tests t ON t.id = b.test_id
     JOIN labs l ON l.id = b.lab_id
     LEFT JOIN lab_results r ON r.booking_id = b.id
     WHERE b.patient_id = :pid
     ORDER BY b.booking_date DESC, b.id DESC'
);
$stmt->execute([':pid' => $patientId]);
$rows = $stmt->fetchAll();

$results = array_map(function (array $r): array {
    return [
        'id' => (int) $r['id'],
        'test' => $r['test_name'],
        'lab' => $r['lab_name'],
        'date' => $r['booking_date'],
        'status' => $r['status'],
        'result' => $r['result_summary'],
        'file' => $r['file_path'] !== null,
    ];
}, $rows);

respond(['success' => true, 'results' => $results]);
