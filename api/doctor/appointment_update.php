<?php
/**
 * POST /api/doctor/appointment_update.php
 * Body: {appointment_id, action: "confirm"|"reject"}
 * A doctor reviews a patient's appointment request (FR-3.1 confirm step):
 * confirming locks the slot in as the doctor's agenda, rejecting frees it
 * back up for other patients. The patient is always notified; if the
 * doctor belongs to a hospital, that hospital's admin is notified too, so
 * the hospital portal's notification bell reflects its own doctors' activity.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_notify.php';

requireRole(['doctor']);
$db = getDb();
$doctor = requireDoctorProfile($db);

$body = readJsonBody();
$appointmentId = (int) ($body['appointment_id'] ?? 0);
$action = (string) ($body['action'] ?? '');

if ($appointmentId <= 0 || !in_array($action, ['confirm', 'reject'], true)) {
    respond(['success' => false, 'message' => 'appointment_id and a valid action are required.'], 422);
}

$stmt = $db->prepare('SELECT * FROM appointments WHERE id = :id AND doctor_id = :did');
$stmt->execute([':id' => $appointmentId, ':did' => $doctor['id']]);
$appt = $stmt->fetch();
if (!$appt) {
    respond(['success' => false, 'message' => 'Appointment not found.'], 404);
}
if ($appt['status'] !== 'pending') {
    respond(['success' => false, 'message' => 'This appointment has already been reviewed.'], 409);
}

$newStatus = $action === 'confirm' ? 'confirmed' : 'cancelled';
$db->prepare('UPDATE appointments SET status = :status WHERE id = :id')
   ->execute([':status' => $newStatus, ':id' => $appointmentId]);

$hospitalOwnerId = null;
if ($appt['hospital_id']) {
    $stmt = $db->prepare('SELECT owner_user_id FROM hospitals WHERE id = :id');
    $stmt->execute([':id' => $appt['hospital_id']]);
    $hospitalOwnerId = $stmt->fetchColumn() ?: null;
}
$patientNameStmt = $db->prepare('SELECT full_name FROM users WHERE id = :id');
$patientNameStmt->execute([':id' => $appt['patient_id']]);
$patientName = $patientNameStmt->fetchColumn() ?: 'A patient';

if ($action === 'confirm') {
    notify($db, (int) $appt['patient_id'], 'calendar-check', 'Appointment Confirmed', $doctor['full_name'] . ' confirmed your appointment on ' . $appt['appointment_date'] . ' at ' . $appt['appointment_time'] . '.');
    if ($hospitalOwnerId) {
        notify($db, (int) $hospitalOwnerId, 'calendar-check', 'Appointment Confirmed', $doctor['full_name'] . ' confirmed ' . $patientName . '\'s appointment on ' . $appt['appointment_date'] . ' at ' . $appt['appointment_time'] . '.');
    }
    respond(['success' => true, 'message' => 'Appointment confirmed.']);
}

notify($db, (int) $appt['patient_id'], 'calendar-x', 'Appointment Declined', $doctor['full_name'] . ' could not accept your appointment request for ' . $appt['appointment_date'] . ' at ' . $appt['appointment_time'] . '. Please book another slot.');
if ($hospitalOwnerId) {
    notify($db, (int) $hospitalOwnerId, 'calendar-x', 'Appointment Declined', $doctor['full_name'] . ' declined ' . $patientName . '\'s appointment request for ' . $appt['appointment_date'] . ' at ' . $appt['appointment_time'] . '.');
}
respond(['success' => true, 'message' => 'Appointment declined.']);
