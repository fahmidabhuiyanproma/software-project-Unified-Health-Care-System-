<?php
/** GET /api/doctor/dashboard.php — today's schedule, headline stats and pending appointment requests for the signed-in doctor. */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_slots.php';

requireRole(['doctor']);
$db = getDb();
$doctor = requireDoctorProfile($db);

// Slot order (9:00 AM … 4:00 PM), not string order — "10:30 AM" must not sort before "9:00 AM".
$slotOrder = "FIELD(a.appointment_time, '" . implode("', '", TIME_SLOTS) . "')";

$stmt = $db->prepare(
    "SELECT a.patient_id, a.appointment_time, a.visit_type, a.status, a.reason, u.full_name AS patient_name
     FROM appointments a JOIN users u ON u.id = a.patient_id
     WHERE a.doctor_id = :did AND a.appointment_date = CURDATE() AND a.status = 'confirmed'
     ORDER BY {$slotOrder}"
);
$stmt->execute([':did' => $doctor['id']]);
$rows = $stmt->fetchAll();

$schedule = array_map(function (array $a): array {
    return [
        'time' => $a['appointment_time'],
        'patient' => $a['patient_name'],
        'type' => $a['visit_type'],
        'reason' => $a['reason'] ?: 'Consultation',
        'status' => $a['status'],
    ];
}, $rows);

$patientsToday = count(array_unique(array_column($rows, 'patient_id')));
$videoCalls = array_values(array_filter($rows, function (array $a): bool { return $a['visit_type'] === 'telemedicine'; }));
$nextVideoCall = null;
foreach ($videoCalls as $call) {
    if (strtotime($call['appointment_time']) >= time()) { $nextVideoCall = $call['appointment_time']; break; }
}

$stmt = $db->prepare(
    "SELECT COUNT(*) AS total, COALESCE(SUM(status = 'pending'), 0) AS pending
     FROM appointments
     WHERE doctor_id = :did AND status IN ('pending', 'confirmed', 'completed')
       AND YEARWEEK(appointment_date, 1) = YEARWEEK(CURDATE(), 1)"
);
$stmt->execute([':did' => $doctor['id']]);
$week = $stmt->fetch();

// Appointment requests waiting for this doctor's Approve / Reject (same set My Patients shows).
$stmt = $db->prepare("SELECT COUNT(*) FROM appointments WHERE doctor_id = :did AND status = 'pending'");
$stmt->execute([':did' => $doctor['id']]);
$pendingRequestsCount = (int) $stmt->fetchColumn();

$stmt = $db->prepare(
    "SELECT a.appointment_date, a.appointment_time, u.full_name
     FROM appointments a JOIN users u ON u.id = a.patient_id
     WHERE a.doctor_id = :did AND a.status = 'pending'
     ORDER BY a.appointment_date, {$slotOrder} LIMIT 5"
);
$stmt->execute([':did' => $doctor['id']]);
$pendingRequests = array_map(function (array $r): array {
    return ['name' => $r['full_name'], 'date' => $r['appointment_date'], 'time' => $r['appointment_time']];
}, $stmt->fetchAll());

respond([
    'success' => true,
    'schedule' => $schedule,
    'todayCount' => count($schedule),
    'pendingRequests' => $pendingRequests,
    'stats' => [
        'pendingRequests' => $pendingRequestsCount,
        'patientsToday' => $patientsToday,
        'telemedicineToday' => count($videoCalls),
        'thisWeek' => (int) $week['total'],
        'thisWeekPending' => (int) $week['pending'],
        'videoCallsToday' => count($videoCalls),
        'nextVideoCall' => $nextVideoCall,
    ],
]);
