<?php
/** GET /api/hospital-admin/appointments.php?q= — appointment overview across the hospital. */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['hospital']);
$db = getDb();
$hospital = requireOwnedProvider($db, 'hospitals');

$q = trim((string) ($_GET['q'] ?? ''));
$sql = 'SELECT a.id, a.appointment_date, a.appointment_time, a.visit_type, a.status,
               u.full_name AS patient_name, d.full_name AS doctor_name, hd.name AS dept_name
        FROM appointments a
        JOIN users u ON u.id = a.patient_id
        JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN hospital_departments hd ON hd.id = d.department_id
        WHERE a.hospital_id = :hid';
if ($q !== '') $sql .= ' AND (u.full_name LIKE :q OR d.full_name LIKE :q2)';
$sql .= ' ORDER BY a.appointment_date DESC, a.id DESC LIMIT 100';

$stmt = $db->prepare($sql);
$params = [':hid' => $hospital['id']];
if ($q !== '') { $params[':q'] = "%$q%"; $params[':q2'] = "%$q%"; }
$stmt->execute($params);

$appointments = array_map(function (array $a): array {
    return [
        'id' => (int) $a['id'], 'patient' => $a['patient_name'], 'doctor' => $a['doctor_name'],
        'dept' => $a['dept_name'] ?: 'General', 'date' => $a['appointment_date'], 'time' => $a['appointment_time'],
        'type' => $a['visit_type'] === 'in-person' ? 'In-Person' : 'Telemedicine', 'status' => $a['status'],
    ];
}, $stmt->fetchAll());

respond(['success' => true, 'appointments' => $appointments]);
