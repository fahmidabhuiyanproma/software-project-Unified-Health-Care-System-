<?php
/** GET /api/hospital-admin/dashboard.php — recent appointments + department occupancy for this hospital. */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_beds.php';

requireRole(['hospital']);
$db = getDb();
$hospital = requireOwnedProvider($db, 'hospitals');

$stmt = $db->prepare('SELECT COUNT(*) FROM doctors WHERE hospital_id = :hid AND status = "active"');
$stmt->execute([':hid' => $hospital['id']]);
$activeDoctors = (int) $stmt->fetchColumn();

$stmt = $db->prepare('SELECT COUNT(*) FROM hospital_departments WHERE hospital_id = :hid');
$stmt->execute([':hid' => $hospital['id']]);
$departmentCount = (int) $stmt->fetchColumn();

$stmt = $db->prepare('SELECT COUNT(*) FROM appointments WHERE hospital_id = :hid AND appointment_date = CURDATE()');
$stmt->execute([':hid' => $hospital['id']]);
$appointmentsToday = (int) $stmt->fetchColumn();

$stmt = $db->prepare('SELECT COUNT(*) FROM appointments WHERE hospital_id = :hid AND appointment_date = CURDATE() AND status = "confirmed"');
$stmt->execute([':hid' => $hospital['id']]);
$confirmedToday = (int) $stmt->fetchColumn();

$stmt = $db->prepare('SELECT COUNT(*) FROM appointments WHERE hospital_id = :hid AND appointment_date = CURDATE() AND status = "pending"');
$stmt->execute([':hid' => $hospital['id']]);
$pendingToday = (int) $stmt->fetchColumn();

$stmt = $db->prepare(
    'SELECT a.appointment_time, a.status, u.full_name AS patient_name, d.full_name AS doctor_name, hd.name AS dept_name
     FROM appointments a
     JOIN users u ON u.id = a.patient_id
     JOIN doctors d ON d.id = a.doctor_id
     LEFT JOIN hospital_departments hd ON hd.id = d.department_id
     WHERE a.hospital_id = :hid AND a.appointment_date = CURDATE()
     ORDER BY a.appointment_time LIMIT 10'
);
$stmt->execute([':hid' => $hospital['id']]);
$recent = array_map(function (array $a): array {
    return ['patient' => $a['patient_name'], 'doctor' => $a['doctor_name'], 'dept' => $a['dept_name'] ?: 'General', 'time' => $a['appointment_time'], 'status' => $a['status']];
}, $stmt->fetchAll());

// Dept. Occupancy = beds currently booked (pending + approved) out of each department's total beds.
$occupancy = array_map(function (array $d): array {
    $pct = $d['total'] > 0 ? min(100, (int) round($d['booked'] / $d['total'] * 100)) : 0;
    return ['dept' => $d['name'], 'pct' => $pct, 'booked' => $d['booked'], 'total' => $d['total']];
}, hospitalBedSummary($db, (int) $hospital['id']));

respond([
    'success' => true,
    'hospital' => [
        'name' => $hospital['name'],
        'location' => trim(implode(', ', array_filter([$hospital['address'] ?? null, $hospital['city'] ?? null]))) ?: null,
    ],
    'stats' => [
        'activeDoctors' => $activeDoctors,
        'departmentCount' => $departmentCount,
        'appointmentsToday' => $appointmentsToday,
        'confirmedToday' => $confirmedToday,
        'pendingToday' => $pendingToday,
    ],
    'recentAppointments' => $recent,
    'departmentOccupancy' => $occupancy,
]);
