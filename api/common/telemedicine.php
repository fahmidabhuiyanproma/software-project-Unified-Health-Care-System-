<?php
/**
 * GET  /api/common/telemedicine.php?appointment_id=  — session + chat history.
 * POST /api/common/telemedicine.php {appointment_id, message} — send a chat message.
 *
 * Shared by both the Patient and Doctor portals since they use the same
 * telemedicine.html screen (FR-5.1/5.2). Omitting appointment_id resolves
 * to the caller's most recent upcoming telemedicine appointment.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_notify.php';

$userId = requireRole(['patient', 'doctor']);
$role = currentRole();
$db = getDb();

function loadAppointmentForUser(PDO $db, int $appointmentId, int $userId, string $role): ?array {
    if ($role === 'patient') {
        $stmt = $db->prepare(
            'SELECT a.*, d.full_name AS doctor_name, d.specialty, d.user_id AS doctor_user_id, u.full_name AS patient_name
             FROM appointments a JOIN doctors d ON d.id = a.doctor_id JOIN users u ON u.id = a.patient_id
             WHERE a.id = :aid AND a.patient_id = :uid AND a.visit_type = "telemedicine"'
        );
        $stmt->execute([':aid' => $appointmentId, ':uid' => $userId]);
    } else {
        $stmt = $db->prepare(
            'SELECT a.*, d.full_name AS doctor_name, d.specialty, d.user_id AS doctor_user_id, u.full_name AS patient_name
             FROM appointments a JOIN doctors d ON d.id = a.doctor_id JOIN users u ON u.id = a.patient_id
             WHERE a.id = :aid AND d.user_id = :uid AND a.visit_type = "telemedicine"'
        );
        $stmt->execute([':aid' => $appointmentId, ':uid' => $userId]);
    }
    $row = $stmt->fetch();
    return $row ?: null;
}

function mostRecentTelemedicineAppointmentId(PDO $db, int $userId, string $role): ?int {
    if ($role === 'patient') {
        $stmt = $db->prepare('SELECT id FROM appointments WHERE patient_id = :uid AND visit_type = "telemedicine" ORDER BY appointment_date DESC, id DESC LIMIT 1');
        $stmt->execute([':uid' => $userId]);
    } else {
        $stmt = $db->prepare('SELECT a.id FROM appointments a JOIN doctors d ON d.id = a.doctor_id WHERE d.user_id = :uid AND a.visit_type = "telemedicine" ORDER BY a.appointment_date DESC, a.id DESC LIMIT 1');
        $stmt->execute([':uid' => $userId]);
    }
    $id = $stmt->fetchColumn();
    return $id ? (int) $id : null;
}

$appointmentId = (int) ($_GET['appointment_id'] ?? ($_SERVER['REQUEST_METHOD'] === 'POST' ? 0 : 0));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $appointmentId = (int) ($body['appointment_id'] ?? 0);
    $message = trim((string) ($body['message'] ?? ''));

    if ($appointmentId <= 0 || $message === '') {
        respond(['success' => false, 'message' => 'appointment_id and message are required.'], 422);
    }
    $appt = loadAppointmentForUser($db, $appointmentId, $userId, $role);
    if (!$appt) {
        respond(['success' => false, 'message' => 'Telemedicine session not found.'], 404);
    }

    $stmt = $db->prepare('SELECT id FROM telemedicine_sessions WHERE appointment_id = :aid');
    $stmt->execute([':aid' => $appointmentId]);
    $sessionId = $stmt->fetchColumn();
    if (!$sessionId) {
        $db->prepare('INSERT INTO telemedicine_sessions (appointment_id) VALUES (:aid)')->execute([':aid' => $appointmentId]);
        $sessionId = (int) $db->lastInsertId();
    }

    $db->prepare('INSERT INTO telemedicine_messages (session_id, sender_user_id, sender_role, message) VALUES (:sid, :uid, :role, :msg)')
       ->execute([':sid' => $sessionId, ':uid' => $userId, ':role' => $role, ':msg' => $message]);

    $otherUserId = $role === 'patient' ? (int) $appt['doctor_user_id'] : (int) $appt['patient_id'];
    if ($otherUserId) {
        notify($db, $otherUserId, 'message-circle', 'New Telemedicine Message', ($role === 'patient' ? $appt['patient_name'] : 'Dr. ' . $appt['doctor_name']) . ' sent a message.');
    }

    respond(['success' => true]);
}

if ($appointmentId <= 0) {
    $appointmentId = mostRecentTelemedicineAppointmentId($db, $userId, $role) ?? 0;
}
if ($appointmentId <= 0) {
    respond(['success' => true, 'appointment' => null, 'messages' => []]);
}

$appt = loadAppointmentForUser($db, $appointmentId, $userId, $role);
if (!$appt) {
    respond(['success' => false, 'message' => 'Telemedicine session not found.'], 404);
}

$stmt = $db->prepare('SELECT id FROM telemedicine_sessions WHERE appointment_id = :aid');
$stmt->execute([':aid' => $appointmentId]);
$sessionId = $stmt->fetchColumn();

$messages = [];
if ($sessionId) {
    $stmt = $db->prepare('SELECT sender_role, message, created_at FROM telemedicine_messages WHERE session_id = :sid ORDER BY id ASC');
    $stmt->execute([':sid' => $sessionId]);
    $messages = array_map(function (array $m): array {
        return ['from' => $m['sender_role'], 'text' => $m['message'], 'time' => isoTime($m['created_at'])];
    }, $stmt->fetchAll());
}

respond(['success' => true, 'appointment' => [
    'id' => (int) $appt['id'],
    'doctor_name' => $appt['doctor_name'],
    'specialty' => $appt['specialty'],
    'patient_name' => $appt['patient_name'],
    'date' => $appt['appointment_date'],
    'time' => $appt['appointment_time'],
], 'messages' => $messages]);
