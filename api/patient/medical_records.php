<?php
/** GET /api/patient/medical_records.php — the patient's own unified medical record (FR-4.3). */

require_once __DIR__ . '/../_bootstrap.php';

$patientId = requireRole(['patient']);
$db = getDb();

$stmt = $db->prepare(
    'SELECT r.id, r.record_type, r.title, r.description, r.vitals, r.attachment_path, r.visit_date,
            d.full_name AS doctor_name, h.name AS hospital_name
     FROM medical_records r
     LEFT JOIN doctors d ON d.id = r.doctor_id
     LEFT JOIN hospitals h ON h.id = d.hospital_id
     WHERE r.patient_id = :pid
     ORDER BY r.visit_date DESC, r.id DESC'
);
$stmt->execute([':pid' => $patientId]);
$rows = $stmt->fetchAll();

$records = array_map(function (array $r): array {
    return [
        'id' => (int) $r['id'],
        'type' => $r['record_type'],
        'title' => $r['title'],
        'desc' => $r['description'],
        'vitals' => $r['vitals'],
        'hasFile' => $r['attachment_path'] !== null,
        'date' => $r['visit_date'],
        'doctor' => $r['doctor_name'],
        'hospital' => $r['hospital_name'] ?: ($r['doctor_name'] ? 'Independent Practice' : null),
    ];
}, $rows);

respond(['success' => true, 'records' => $records]);
