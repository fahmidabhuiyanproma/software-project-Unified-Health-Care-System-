<?php
/**
 * GET  /api/patient/appointments.php — the signed-in patient's appointments.
 * POST /api/patient/appointments.php {doctor_id, date, time, visit_type, reason, notes}
 *      — book a new appointment (FR-3.1). Rejects a slot that is already
 *      taken for that doctor (FR-3.2) both via a pre-check and the
 *      database UNIQUE constraint as a second line of defense.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_slots.php';
require_once __DIR__ . '/../_notify.php';

$patientId = requireRole(['patient']);
$db = getDb();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $doctorId = (int) ($body['doctor_id'] ?? 0);
    $date = (string) ($body['date'] ?? '');
    $time = (string) ($body['time'] ?? '');
    $visitType = (string) ($body['visit_type'] ?? 'in-person');
    $reason = trim((string) ($body['reason'] ?? ''));
    $notes = trim((string) ($body['notes'] ?? ''));

    if ($doctorId <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $time === '') {
        respond(['success' => false, 'message' => 'Doctor, date, and time slot are required.'], 422);
    }
    if (!in_array($time, TIME_SLOTS, true)) {
        respond(['success' => false, 'message' => 'Invalid time slot.'], 422);
    }
    if (!in_array($visitType, ['in-person', 'telemedicine'], true)) {
        $visitType = 'in-person';
    }

    $stmt = $db->prepare('SELECT id, full_name, hospital_id, consultation_fee FROM doctors WHERE id = :id AND status = "active"');
    $stmt->execute([':id' => $doctorId]);
    $doctor = $stmt->fetch();
    if (!$doctor) {
        respond(['success' => false, 'message' => 'Doctor not found.'], 404);
    }

    $stmt = $db->prepare('SELECT id FROM appointments WHERE doctor_id = :did AND appointment_date = :date AND appointment_time = :time AND status IN ("confirmed", "pending")');
    $stmt->execute([':did' => $doctorId, ':date' => $date, ':time' => $time]);
    if ($stmt->fetch()) {
        respond(['success' => false, 'message' => 'This time slot was just booked by someone else. Please pick another slot.'], 409);
    }

    try {
        $stmt = $db->prepare(
            'INSERT INTO appointments (patient_id, doctor_id, hospital_id, appointment_date, appointment_time, visit_type, reason, notes, fee, status)
             VALUES (:pid, :did, :hid, :date, :time, :vtype, :reason, :notes, :fee, "pending")'
        );
        $stmt->execute([
            ':pid' => $patientId, ':did' => $doctorId, ':hid' => $doctor['hospital_id'],
            ':date' => $date, ':time' => $time, ':vtype' => $visitType,
            ':reason' => $reason !== '' ? $reason : null, ':notes' => $notes !== '' ? $notes : null,
            ':fee' => $doctor['consultation_fee'],
        ]);
    } catch (PDOException $e) {
        if ((int) $e->getCode() === 23000) {
            respond(['success' => false, 'message' => 'This time slot was just booked by someone else. Please pick another slot.'], 409);
        }
        throw $e;
    }

    $appointmentId = (int) $db->lastInsertId();

    $docUserStmt = $db->prepare('SELECT user_id FROM doctors WHERE id = :id');
    $docUserStmt->execute([':id' => $doctorId]);
    $docUserId = $docUserStmt->fetchColumn();

    notify($db, $patientId, 'clock', 'Appointment Requested', 'Your appointment request with ' . $doctor['full_name'] . ' on ' . $date . ' at ' . $time . ' has been sent and is awaiting the doctor\'s confirmation.');
    if ($docUserId) {
        notify($db, (int) $docUserId, 'calendar', 'New Appointment Request', 'A patient has requested an appointment on ' . $date . ' at ' . $time . '. Approve or reject it from My Patients.');
    }
    if ($doctor['hospital_id']) {
        $ownerStmt = $db->prepare('SELECT owner_user_id FROM hospitals WHERE id = :id');
        $ownerStmt->execute([':id' => $doctor['hospital_id']]);
        $hospitalOwnerId = $ownerStmt->fetchColumn();
        if ($hospitalOwnerId) {
            $nameStmt = $db->prepare('SELECT full_name FROM users WHERE id = :id');
            $nameStmt->execute([':id' => $patientId]);
            $patientName = $nameStmt->fetchColumn() ?: 'A patient';
            notify($db, (int) $hospitalOwnerId, 'calendar', 'New Appointment Request', $patientName . ' requested an appointment with ' . $doctor['full_name'] . ' on ' . $date . ' at ' . $time . '.');
        }
    }

    respond(['success' => true, 'appointment_id' => $appointmentId, 'message' => 'Appointment request sent. You\'ll be notified once the doctor confirms it.']);
}

$stmt = $db->prepare(
    'SELECT a.id, a.appointment_date, a.appointment_time, a.visit_type, a.status, a.fee, a.reason,
            d.id AS doctor_id, d.full_name AS doctor_name, d.specialty, d.photo_url,
            h.name AS hospital_name, h.city AS hospital_city
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     LEFT JOIN hospitals h ON h.id = a.hospital_id
     WHERE a.patient_id = :pid
     ORDER BY a.appointment_date DESC, a.id DESC'
);
$stmt->execute([':pid' => $patientId]);
$rows = $stmt->fetchAll();

$appointments = array_map(function (array $a): array {
    return [
        'id' => (int) $a['id'],
        'doctor_id' => (int) $a['doctor_id'],
        'doctor' => $a['doctor_name'],
        'specialty' => $a['specialty'],
        'hospital' => ($a['hospital_name'] ?? 'Independent Practice') . ($a['hospital_city'] ? ', ' . $a['hospital_city'] : ''),
        'date' => $a['appointment_date'],
        'time' => $a['appointment_time'],
        'type' => $a['visit_type'],
        'status' => $a['status'],
        'fee' => '৳ ' . number_format((float) $a['fee']),
        'reason' => $a['reason'],
        'img' => $a['photo_url'] ?: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=60&h=60&fit=crop&auto=format',
    ];
}, $rows);

respond(['success' => true, 'appointments' => $appointments]);
