<?php
/**
 * GET /api/patient/dashboard.php — everything the patient dashboard's
 * summary cards, upcoming-appointments preview and recent-activity feed
 * need, in one call.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_slots.php';

$patientId = requireRole(['patient']);
$db = getDb();

$stmt = $db->prepare('SELECT COUNT(*) FROM appointments WHERE patient_id = :pid AND YEAR(appointment_date) = YEAR(CURDATE())');
$stmt->execute([':pid' => $patientId]);
$appointmentsThisYear = (int) $stmt->fetchColumn();

$stmt = $db->prepare('SELECT COUNT(*) FROM medical_records WHERE patient_id = :pid');
$stmt->execute([':pid' => $patientId]);
$recordCount = (int) $stmt->fetchColumn();

$stmt = $db->prepare(
    'SELECT COUNT(DISTINCT d.hospital_id) FROM medical_records m
     JOIN doctors d ON d.id = m.doctor_id
     WHERE m.patient_id = :pid AND d.hospital_id IS NOT NULL'
);
$stmt->execute([':pid' => $patientId]);
$recordHospitals = (int) $stmt->fetchColumn();

$stmt = $db->prepare('SELECT COUNT(*) FROM pharmacy_orders WHERE patient_id = :pid AND created_at >= (CURDATE() - INTERVAL 6 MONTH)');
$stmt->execute([':pid' => $patientId]);
$orderCount = (int) $stmt->fetchColumn();

$stmt = $db->prepare('SELECT COUNT(*) FROM lab_bookings WHERE patient_id = :pid');
$stmt->execute([':pid' => $patientId]);
$labTestCount = (int) $stmt->fetchColumn();

$stmt = $db->prepare("SELECT COUNT(*) FROM lab_bookings WHERE patient_id = :pid AND status = 'ready'");
$stmt->execute([':pid' => $patientId]);
$labResultsReady = (int) $stmt->fetchColumn();

$slotOrder = "FIELD(a.appointment_time, '" . implode("', '", TIME_SLOTS) . "')";

$stmt = $db->prepare(
    "SELECT COUNT(*) FROM appointments a
     WHERE a.patient_id = :pid AND a.status IN ('pending', 'confirmed') AND a.appointment_date >= CURDATE()"
);
$stmt->execute([':pid' => $patientId]);
$upcomingCount = (int) $stmt->fetchColumn();

$stmt = $db->prepare(
    "SELECT a.id, a.appointment_date, a.appointment_time, a.status,
            d.full_name AS doctor_name, d.specialty, d.photo_url,
            h.name AS hospital_name, h.city AS hospital_city
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     LEFT JOIN hospitals h ON h.id = a.hospital_id
     WHERE a.patient_id = :pid AND a.status IN ('pending', 'confirmed') AND a.appointment_date >= CURDATE()
     ORDER BY a.appointment_date ASC, {$slotOrder} ASC
     LIMIT 2"
);
$stmt->execute([':pid' => $patientId]);
$upcoming = array_map(function (array $a): array {
    return [
        'id' => (int) $a['id'],
        'doctor' => $a['doctor_name'],
        'specialty' => $a['specialty'],
        'hospital' => ($a['hospital_name'] ?? 'Independent Practice') . ($a['hospital_city'] ? ', ' . $a['hospital_city'] : ''),
        'date' => $a['appointment_date'],
        'time' => $a['appointment_time'],
        'status' => $a['status'],
        'img' => $a['photo_url'] ?: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=60&h=60&fit=crop&auto=format',
    ];
}, $stmt->fetchAll());

$stmt = $db->prepare('SELECT icon, title, body, created_at FROM notifications WHERE user_id = :pid ORDER BY created_at DESC LIMIT 3');
$stmt->execute([':pid' => $patientId]);
$activity = array_map(function (array $n): array {
    return ['icon' => $n['icon'], 'title' => $n['title'], 'body' => $n['body'], 'time' => isoTime($n['created_at'])];
}, $stmt->fetchAll());

respond([
    'success' => true,
    'stats' => [
        'appointments' => ['value' => $appointmentsThisYear, 'sub' => 'This year'],
        'records' => ['value' => $recordCount, 'sub' => $recordHospitals . ' hospital' . ($recordHospitals === 1 ? '' : 's')],
        'orders' => ['value' => $orderCount, 'sub' => 'Last 6 months'],
        'labTests' => ['value' => $labTestCount, 'sub' => 'Results ready: ' . $labResultsReady],
    ],
    'upcomingCount' => $upcomingCount,
    'upcoming' => $upcoming,
    'activity' => $activity,
]);
