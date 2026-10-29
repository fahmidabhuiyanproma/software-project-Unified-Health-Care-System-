<?php
/**
 * GET /api/doctor/patients.php?q= — patients currently under this doctor's
 * care (FR-4.4 basis): every distinct patient who has an appointment with
 * them, with last/next visit summary.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_slots.php';

requireRole(['doctor']);
$db = getDb();
$doctor = requireDoctorProfile($db);

$q = trim((string) ($_GET['q'] ?? ''));

$sql = 'SELECT u.id AS patient_id, u.full_name,
               MAX(CASE WHEN a.appointment_date <= CURDATE() THEN a.appointment_date END) AS last_visit,
               MIN(CASE WHEN a.appointment_date >= CURDATE() AND a.status = "confirmed" THEN a.appointment_date END) AS next_visit,
               (SELECT status FROM appointments a2 WHERE a2.patient_id = u.id AND a2.doctor_id = :did
                ORDER BY (a2.status = "cancelled") ASC, a2.appointment_date DESC LIMIT 1) AS latest_status
        FROM appointments a JOIN users u ON u.id = a.patient_id
        WHERE a.doctor_id = :did2';
if ($q !== '') {
    $sql .= ' AND u.full_name LIKE :q';
}
$sql .= ' GROUP BY u.id, u.full_name HAVING SUM(a.status <> "cancelled") > 0 ORDER BY u.full_name';

$stmt = $db->prepare($sql);
$params = [':did' => $doctor['id'], ':did2' => $doctor['id']];
if ($q !== '') $params[':q'] = "%$q%";
$stmt->execute($params);
$rows = $stmt->fetchAll();

// Appointment requests awaiting this doctor's decision, grouped per patient —
// approving/declining happens here (My Patients), not on the schedule page.
$slotOrder = "FIELD(appointment_time, '" . implode("', '", TIME_SLOTS) . "')";
$pendingStmt = $db->prepare(
    "SELECT id, patient_id, appointment_date, appointment_time, visit_type FROM appointments
     WHERE doctor_id = :did AND status = 'pending' ORDER BY appointment_date, {$slotOrder}"
);
$pendingStmt->execute([':did' => $doctor['id']]);
$pendingByPatient = [];
foreach ($pendingStmt->fetchAll() as $a) {
    $pendingByPatient[(int) $a['patient_id']][] = [
        'id' => (int) $a['id'], 'date' => $a['appointment_date'], 'time' => $a['appointment_time'], 'type' => $a['visit_type'],
    ];
}

$patients = array_map(function (array $p) use ($pendingByPatient): array {
    return [
        'id' => (int) $p['patient_id'],
        'name' => $p['full_name'],
        'lastVisit' => $p['last_visit'],
        'nextAppt' => $p['next_visit'],
        'status' => $p['latest_status'],
        'pending' => $pendingByPatient[(int) $p['patient_id']] ?? [],
    ];
}, $rows);

respond(['success' => true, 'patients' => $patients]);
