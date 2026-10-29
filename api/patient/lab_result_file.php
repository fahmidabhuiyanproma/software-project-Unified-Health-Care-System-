<?php
/**
 * GET /api/patient/lab_result_file.php?booking_id= — streams a lab result
 * PDF, but only to the patient who owns that booking. Access-gated
 * download rather than a public file URL, per FR-4.5 / STEP 19.
 */

require_once __DIR__ . '/../_bootstrap.php';

$patientId = requireRole(['patient']);
$db = getDb();

$bookingId = (int) ($_GET['booking_id'] ?? 0);
$stmt = $db->prepare(
    'SELECT r.file_path FROM lab_results r
     JOIN lab_bookings b ON b.id = r.booking_id
     WHERE r.booking_id = :bid AND b.patient_id = :pid'
);
$stmt->execute([':bid' => $bookingId, ':pid' => $patientId]);
$row = $stmt->fetch();

if (!$row || !$row['file_path']) {
    respond(['success' => false, 'message' => 'Report not found.'], 404);
}

$path = __DIR__ . '/../../uploads/' . basename($row['file_path']);
if (!is_file($path)) {
    respond(['success' => false, 'message' => 'Report file is missing on the server.'], 404);
}

header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="' . basename($path) . '"');
header('Content-Length: ' . filesize($path));
readfile($path);
exit;
