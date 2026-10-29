<?php
/**
 * POST /api/patient/lab_book.php {test_id, lab_id, date, time}
 * Books a diagnostic test (FR-6.3). Fee is payable at the lab (matches
 * the UI), so no payment record is created here.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_notify.php';

$patientId = requireRole(['patient']);
$db = getDb();

$body = readJsonBody();
$testId = (int) ($body['test_id'] ?? 0);
$labId = (int) ($body['lab_id'] ?? 0);
$date = (string) ($body['date'] ?? '');
$time = trim((string) ($body['time'] ?? ''));

if ($testId <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $time === '') {
    respond(['success' => false, 'message' => 'Test, date, and time are required.'], 422);
}

$stmt = $db->prepare('SELECT id, lab_id, name, price, turnaround_text FROM lab_tests WHERE id = :id AND is_active = 1');
$stmt->execute([':id' => $testId]);
$test = $stmt->fetch();
if (!$test) {
    respond(['success' => false, 'message' => 'Test not found for the selected lab.'], 404);
}
$labId = (int) $test['lab_id'];

$stmt = $db->prepare('INSERT INTO lab_bookings (patient_id, lab_id, test_id, booking_date, booking_time, fee) VALUES (:pid, :lab, :test, :date, :time, :fee)');
$stmt->execute([':pid' => $patientId, ':lab' => $labId, ':test' => $testId, ':date' => $date, ':time' => $time, ':fee' => $test['price']]);
$bookingId = (int) $db->lastInsertId();

notify($db, $patientId, 'flask-conical', 'Lab Test Booked', $test['name'] . ' booked for ' . $date . ' at ' . $time . '. Fee payable at the lab.');

$labOwnerStmt = $db->prepare('SELECT owner_user_id FROM labs WHERE id = :id');
$labOwnerStmt->execute([':id' => $labId]);
$labOwnerId = $labOwnerStmt->fetchColumn();
if ($labOwnerId) {
    $patientNameStmt = $db->prepare('SELECT full_name FROM users WHERE id = :id');
    $patientNameStmt->execute([':id' => $patientId]);
    $patientName = $patientNameStmt->fetchColumn() ?: 'A patient';
    notify($db, (int) $labOwnerId, 'flask-conical', 'New Lab Booking', $patientName . ' booked ' . $test['name'] . ' for ' . $date . ' at ' . $time . '.');
}

respond(['success' => true, 'booking_id' => $bookingId, 'message' => 'Lab test booked successfully.']);
