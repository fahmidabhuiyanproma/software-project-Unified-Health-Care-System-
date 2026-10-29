<?php
/**
 * Hospital bed requests.
 *
 * GET  /api/hospital-admin/beds.php
 *      → {departments: live bed numbers, requests: every bed booking for this hospital (pending first)}
 * POST /api/hospital-admin/beds.php {booking_id, decision: "approve"|"reject"|"discharge", reason?}
 *      approve   pending  → approved   (patient admitted; the bed stays taken)
 *      reject    pending  → rejected   (the bed is released; optional reason goes to the patient)
 *      discharge approved → discharged (the bed is released)
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_beds.php';
require_once __DIR__ . '/../_notify.php';

requireRole(['hospital']);
$db = getDb();
$hospital = requireOwnedProvider($db, 'hospitals');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $bookingId = (int) ($body['booking_id'] ?? 0);
    $decision = (string) ($body['decision'] ?? '');
    $reason = trim((string) ($body['reason'] ?? ''));

    if ($bookingId <= 0 || !in_array($decision, ['approve', 'reject', 'discharge'], true)) {
        respond(['success' => false, 'message' => 'booking_id and a valid decision are required.'], 422);
    }
    if (mb_strlen($reason) > 255) {
        respond(['success' => false, 'message' => 'The reason is too long (255 characters max).'], 422);
    }

    $stmt = $db->prepare(
        'SELECT b.*, hd.name AS dept_name FROM bed_bookings b JOIN hospital_departments hd ON hd.id = b.department_id
         WHERE b.id = :id AND b.hospital_id = :hid'
    );
    $stmt->execute([':id' => $bookingId, ':hid' => $hospital['id']]);
    $booking = $stmt->fetch();
    if (!$booking) {
        respond(['success' => false, 'message' => 'Bed request not found.'], 404);
    }

    $required = $decision === 'discharge' ? 'approved' : 'pending';
    if ($booking['status'] !== $required) {
        respond(['success' => false, 'message' => 'This request has already been ' . $booking['status'] . '.'], 409);
    }

    $patientId = (int) $booking['patient_id'];
    $where = $booking['dept_name'] . ' bed on ' . $booking['admission_date'];

    if ($decision === 'approve') {
        $db->prepare('UPDATE bed_bookings SET status = "approved", decided_at = NOW() WHERE id = :id')->execute([':id' => $bookingId]);
        notify($db, $patientId, 'bed-double', 'Bed Request Approved', $hospital['name'] . ' approved your ' . $where . '. Please arrive on the admission date.');
        respond(['success' => true, 'message' => 'Bed request approved.']);
    }
    if ($decision === 'reject') {
        $db->prepare('UPDATE bed_bookings SET status = "rejected", decided_at = NOW(), rejection_reason = :reason WHERE id = :id')
           ->execute([':reason' => $reason !== '' ? $reason : null, ':id' => $bookingId]);
        notify($db, $patientId, 'x-circle', 'Bed Request Declined', $hospital['name'] . ' could not accept your ' . $where . '.' . ($reason !== '' ? ' Reason: ' . $reason : ''));
        respond(['success' => true, 'message' => 'Bed request declined.']);
    }

    $db->prepare('UPDATE bed_bookings SET status = "discharged", decided_at = NOW() WHERE id = :id')->execute([':id' => $bookingId]);
    notify($db, $patientId, 'bed-double', 'Discharged', $hospital['name'] . ' recorded your discharge from ' . $booking['dept_name'] . '.');
    respond(['success' => true, 'message' => 'Patient discharged — the bed is free again.']);
}

$stmt = $db->prepare(
    'SELECT b.id, b.admission_date, b.reason, b.attendant_phone, b.notes, b.status, b.rejection_reason, b.created_at, b.decided_at,
            u.full_name AS patient_name, u.phone AS patient_phone, hd.name AS dept_name
     FROM bed_bookings b
     JOIN users u ON u.id = b.patient_id
     JOIN hospital_departments hd ON hd.id = b.department_id
     WHERE b.hospital_id = :hid
     ORDER BY (b.status = "pending") DESC, (b.status = "approved") DESC, b.id DESC
     LIMIT 200'
);
$stmt->execute([':hid' => $hospital['id']]);
$requests = array_map(function (array $b): array {
    return [
        'id' => (int) $b['id'], 'patient' => $b['patient_name'], 'patientPhone' => $b['patient_phone'],
        'attendantPhone' => $b['attendant_phone'], 'department' => $b['dept_name'], 'date' => $b['admission_date'],
        'reason' => $b['reason'], 'notes' => $b['notes'], 'status' => $b['status'],
        'rejectionReason' => $b['rejection_reason'], 'requestedAt' => isoTime($b['created_at']),
    ];
}, $stmt->fetchAll());

respond(['success' => true, 'departments' => hospitalBedSummary($db, (int) $hospital['id']), 'requests' => $requests]);
