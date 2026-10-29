<?php
/**
 * POST /api/patient/appointment_update.php
 * Body: {appointment_id, action: "cancel"} or {appointment_id, action: "reschedule", date, time}
 * FR-3.3 — a patient may cancel or reschedule their own upcoming appointment.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_slots.php';
require_once __DIR__ . '/../_notify.php';

$patientId = requireRole(['patient']);
$db = getDb();

$body = readJsonBody();
$appointmentId = (int) ($body['appointment_id'] ?? 0);
$action = (string) ($body['action'] ?? '');

if ($appointmentId <= 0 || !in_array($action, ['cancel', 'reschedule'], true)) {
    respond(['success' => false, 'message' => 'appointment_id and a valid action are required.'], 422);
}

$stmt = $db->prepare('SELECT * FROM appointments WHERE id = :id AND patient_id = :pid');
$stmt->execute([':id' => $appointmentId, ':pid' => $patientId]);
$appt = $stmt->fetch();
if (!$appt) {
    respond(['success' => false, 'message' => 'Appointment not found.'], 404);
}
if (!in_array($appt['status'], ['pending', 'confirmed'], true)) {
    respond(['success' => false, 'message' => 'Only an upcoming appointment can be changed.'], 409);
}

if ($action === 'cancel') {
    $db->prepare('UPDATE appointments SET status = "cancelled" WHERE id = :id')->execute([':id' => $appointmentId]);
    $docNameStmt = $db->prepare('SELECT full_name FROM doctors WHERE id = :id');
    $docNameStmt->execute([':id' => $appt['doctor_id']]);
    $docName = $docNameStmt->fetchColumn() ?: 'your doctor';
    notify($db, $patientId, 'calendar-x', 'Appointment Cancelled', 'Your appointment with ' . $docName . ' on ' . $appt['appointment_date'] . ' was cancelled.');
    respond(['success' => true, 'message' => 'Appointment cancelled.']);
}

// reschedule
$date = (string) ($body['date'] ?? '');
$time = (string) ($body['time'] ?? '');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !in_array($time, TIME_SLOTS, true)) {
    respond(['success' => false, 'message' => 'A valid new date and time slot are required.'], 422);
}

$stmt = $db->prepare('SELECT id FROM appointments WHERE doctor_id = :did AND appointment_date = :date AND appointment_time = :time AND status IN ("confirmed", "pending") AND id <> :id');
$stmt->execute([':did' => $appt['doctor_id'], ':date' => $date, ':time' => $time, ':id' => $appointmentId]);
if ($stmt->fetch()) {
    respond(['success' => false, 'message' => 'That slot is already booked. Please choose another.'], 409);
}

try {
    $stmt = $db->prepare('UPDATE appointments SET appointment_date = :date, appointment_time = :time WHERE id = :id');
    $stmt->execute([':date' => $date, ':time' => $time, ':id' => $appointmentId]);
} catch (PDOException $e) {
    if ((int) $e->getCode() === 23000) {
        respond(['success' => false, 'message' => 'That slot is already booked. Please choose another.'], 409);
    }
    throw $e;
}

notify($db, $patientId, 'calendar', 'Appointment Rescheduled', 'Your appointment has been moved to ' . $date . ' at ' . $time . '.');

respond(['success' => true, 'message' => 'Appointment rescheduled.']);
