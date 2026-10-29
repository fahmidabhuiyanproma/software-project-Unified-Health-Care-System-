<?php
/**
 * GET  /api/doctor/schedule.php?date=YYYY-MM-DD — that day's slots (booked + open), plus weekly availability toggles.
 * POST /api/doctor/schedule.php {weekday, is_available} — toggle a weekday on/off.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_slots.php';

requireRole(['doctor']);
$db = getDb();
$doctor = requireDoctorProfile($db);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $weekday = (int) ($body['weekday'] ?? -1);
    $isAvailable = !empty($body['is_available']) ? 1 : 0;
    if ($weekday < 0 || $weekday > 6) {
        respond(['success' => false, 'message' => 'Invalid weekday.'], 422);
    }
    $stmt = $db->prepare(
        'INSERT INTO doctor_weekly_availability (doctor_id, weekday, is_available) VALUES (:did, :wd, :avail)
         ON DUPLICATE KEY UPDATE is_available = VALUES(is_available)'
    );
    $stmt->execute([':did' => $doctor['id'], ':wd' => $weekday, ':avail' => $isAvailable]);
    respond(['success' => true]);
}

$date = (string) ($_GET['date'] ?? date('Y-m-d'));
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    $date = date('Y-m-d');
}

$stmt = $db->prepare(
    'SELECT a.appointment_time, a.visit_type, a.status, u.full_name AS patient_name
     FROM appointments a JOIN users u ON u.id = a.patient_id
     WHERE a.doctor_id = :did AND a.appointment_date = :date AND a.status IN ("confirmed", "pending")'
);
$stmt->execute([':did' => $doctor['id'], ':date' => $date]);
$booked = [];
foreach ($stmt->fetchAll() as $row) {
    $booked[$row['appointment_time']] = $row;
}

$slots = array_map(function (string $time) use ($booked): array {
    if (isset($booked[$time])) {
        $b = $booked[$time];
        return ['time' => $time, 'patient' => $b['patient_name'], 'type' => $b['visit_type'], 'status' => $b['status']];
    }
    return ['time' => $time, 'patient' => null];
}, TIME_SLOTS);

$availStmt = $db->prepare('SELECT weekday, is_available FROM doctor_weekly_availability WHERE doctor_id = :did');
$availStmt->execute([':did' => $doctor['id']]);
$weekly = array_fill(0, 7, true);
foreach ($availStmt->fetchAll() as $row) {
    $weekly[(int) $row['weekday']] = (bool) $row['is_available'];
}

respond(['success' => true, 'date' => $date, 'slots' => $slots, 'weeklyAvailability' => $weekly]);
