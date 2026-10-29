<?php
/**
 * GET  /api/lab-admin/bookings.php — bookings for this lab.
 * POST /api/lab-admin/bookings.php (multipart/form-data)
 *      fields: booking_id, result_summary, [report: PDF file]
 *      Publishes a result (FR-6.3): moves the booking to "ready", stores
 *      the result (+ optional PDF, safely validated), logs it into the
 *      patient's unified medical record (FR-4.1), and notifies the patient.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_notify.php';

requireRole(['lab']);
$db = getDb();
$lab = requireOwnedProvider($db, 'labs');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $bookingId = (int) ($_POST['booking_id'] ?? 0);
    $resultSummary = trim((string) ($_POST['result_summary'] ?? ''));

    if ($bookingId <= 0 || $resultSummary === '') {
        respond(['success' => false, 'message' => 'Booking and result summary are required.'], 422);
    }

    $stmt = $db->prepare(
        'SELECT b.*, t.name AS test_name FROM lab_bookings b JOIN lab_tests t ON t.id = b.test_id
         WHERE b.id = :id AND b.lab_id = :lid'
    );
    $stmt->execute([':id' => $bookingId, ':lid' => $lab['id']]);
    $booking = $stmt->fetch();
    if (!$booking) {
        respond(['success' => false, 'message' => 'Booking not found.'], 404);
    }

    $storedFileName = null;
    if (!empty($_FILES['report']['name'])) {
        $file = $_FILES['report'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            respond(['success' => false, 'message' => 'File upload failed.'], 422);
        }
        if ($file['size'] > 10 * 1024 * 1024) {
            respond(['success' => false, 'message' => 'File must be 10MB or smaller.'], 422);
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        if ($mime !== 'application/pdf') {
            respond(['success' => false, 'message' => 'Only PDF reports can be uploaded.'], 422);
        }

        $uploadDir = __DIR__ . '/../../uploads';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        $storedFileName = 'lab_' . $bookingId . '_' . bin2hex(random_bytes(6)) . '.pdf';
        if (!move_uploaded_file($file['tmp_name'], $uploadDir . '/' . $storedFileName)) {
            respond(['success' => false, 'message' => 'Could not save the uploaded file.'], 500);
        }
    }

    $db->beginTransaction();
    try {
        $stmt = $db->prepare(
            'INSERT INTO lab_results (booking_id, result_summary, file_path) VALUES (:bid, :summary, :file)
             ON DUPLICATE KEY UPDATE result_summary = VALUES(result_summary), file_path = VALUES(file_path)'
        );
        $stmt->execute([':bid' => $bookingId, ':summary' => $resultSummary, ':file' => $storedFileName]);

        $db->prepare('UPDATE lab_bookings SET status = "ready" WHERE id = :id')->execute([':id' => $bookingId]);

        $stmt = $db->prepare(
            'INSERT INTO medical_records (patient_id, record_type, title, description, visit_date)
             VALUES (:pid, "lab", :title, :desc, :date)'
        );
        $stmt->execute([
            ':pid' => $booking['patient_id'], ':title' => $booking['test_name'] . ' — Lab Result',
            ':desc' => $resultSummary, ':date' => $booking['booking_date'],
        ]);

        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        respond(['success' => false, 'message' => 'Could not publish result.'], 500);
    }

    notify($db, (int) $booking['patient_id'], 'flask-conical', 'Lab Result Ready', 'Your ' . $booking['test_name'] . ' result is now available.');

    respond(['success' => true, 'message' => 'Result published.']);
}

$stmt = $db->prepare(
    'SELECT b.id, b.status, b.booking_date, b.booking_time, b.fee, u.full_name AS patient_name, t.name AS test_name
     FROM lab_bookings b JOIN users u ON u.id = b.patient_id JOIN lab_tests t ON t.id = b.test_id
     WHERE b.lab_id = :lid ORDER BY b.booking_date DESC, b.id DESC'
);
$stmt->execute([':lid' => $lab['id']]);

$bookings = array_map(function (array $b): array {
    return [
        'id' => (int) $b['id'], 'patient' => $b['patient_name'], 'test' => $b['test_name'],
        'date' => $b['booking_date'], 'time' => $b['booking_time'],
        'fee' => '৳ ' . number_format((float) $b['fee']), 'status' => $b['status'],
    ];
}, $stmt->fetchAll());

respond(['success' => true, 'bookings' => $bookings]);
