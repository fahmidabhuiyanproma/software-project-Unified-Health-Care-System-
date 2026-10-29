<?php
/**
 * Patient bed booking.
 *
 * GET  /api/patient/beds.php                    → {hospitals, bookings}   (hospital picker + my bookings)
 * GET  /api/patient/beds.php?hospital_id=N      → {departments}           (live bed numbers; open=false when full)
 * POST /api/patient/beds.php {department_id, admission_date, reason, attendant_phone?, notes?}
 *      → request a bed. The bed is reserved immediately (so the count drops) and the hospital is asked to approve.
 * POST /api/patient/beds.php {action:"cancel", booking_id}
 *      → cancel my pending/approved booking (the bed is released).
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_beds.php';
require_once __DIR__ . '/../_notify.php';

$patientId = requireRole(['patient']);
$db = getDb();

function notifyHospitalOwner(PDO $db, int $hospitalId, string $title, string $body): void {
    $stmt = $db->prepare('SELECT owner_user_id FROM hospitals WHERE id = :id');
    $stmt->execute([':id' => $hospitalId]);
    if ($owner = $stmt->fetchColumn()) {
        notify($db, (int) $owner, 'bed-double', $title, $body);
    }
}

function patientName(PDO $db, int $patientId): string {
    $stmt = $db->prepare('SELECT full_name FROM users WHERE id = :id');
    $stmt->execute([':id' => $patientId]);
    return (string) ($stmt->fetchColumn() ?: 'A patient');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();

    // ------------------------------------------------------------ cancel
    if (($body['action'] ?? '') === 'cancel') {
        $bookingId = (int) ($body['booking_id'] ?? 0);
        $stmt = $db->prepare(
            'SELECT b.*, hd.name AS dept_name FROM bed_bookings b JOIN hospital_departments hd ON hd.id = b.department_id
             WHERE b.id = :id AND b.patient_id = :pid'
        );
        $stmt->execute([':id' => $bookingId, ':pid' => $patientId]);
        $booking = $stmt->fetch();
        if (!$booking) {
            respond(['success' => false, 'message' => 'Bed booking not found.'], 404);
        }
        if (!in_array($booking['status'], ['pending', 'approved'], true)) {
            respond(['success' => false, 'message' => 'This booking can no longer be cancelled.'], 409);
        }
        $db->prepare('UPDATE bed_bookings SET status = "cancelled" WHERE id = :id')->execute([':id' => $bookingId]);
        notifyHospitalOwner($db, (int) $booking['hospital_id'], 'Bed Booking Cancelled',
            patientName($db, $patientId) . ' cancelled their ' . $booking['dept_name'] . ' bed request for ' . $booking['admission_date'] . '. The bed is free again.');
        respond(['success' => true, 'message' => 'Bed booking cancelled.']);
    }

    // ------------------------------------------------------------ request a bed
    $departmentId = (int) ($body['department_id'] ?? 0);
    $date = (string) ($body['admission_date'] ?? '');
    $reason = trim((string) ($body['reason'] ?? ''));
    $attendantPhone = trim((string) ($body['attendant_phone'] ?? ''));
    $notes = trim((string) ($body['notes'] ?? ''));

    if ($departmentId <= 0) {
        respond(['success' => false, 'message' => 'Please choose a department.'], 422);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !checkdate((int) substr($date, 5, 2), (int) substr($date, 8, 2), (int) substr($date, 0, 4))) {
        respond(['success' => false, 'message' => 'Please choose a valid admission date.'], 422);
    }
    if ($date < date('Y-m-d')) {
        respond(['success' => false, 'message' => 'The admission date cannot be in the past.'], 422);
    }
    if ($date > date('Y-m-d', strtotime('+90 days'))) {
        respond(['success' => false, 'message' => 'Beds can be requested up to 90 days ahead.'], 422);
    }
    if ($reason === '' || mb_strlen($reason) > 255) {
        respond(['success' => false, 'message' => 'Please tell the hospital why the bed is needed (up to 255 characters).'], 422);
    }
    if ($attendantPhone !== '' && !preg_match('/^[+0-9][0-9 +\-()]{5,19}$/', $attendantPhone)) {
        respond(['success' => false, 'message' => 'Please enter a valid attendant phone number.'], 422);
    }
    if (mb_strlen($notes) > 500) {
        respond(['success' => false, 'message' => 'Notes are too long (500 characters max).'], 422);
    }

    $stmt = $db->prepare('SELECT id FROM bed_bookings WHERE patient_id = :pid AND status IN ("pending", "approved") LIMIT 1');
    $stmt->execute([':pid' => $patientId]);
    if ($stmt->fetch()) {
        respond(['success' => false, 'message' => 'You already have an active bed booking. Cancel it before requesting another.'], 409);
    }

    // Lock the department row so two patients can't both take the last bed.
    $db->beginTransaction();
    try {
        $stmt = $db->prepare('SELECT id, hospital_id, name, bed_count FROM hospital_departments WHERE id = :id FOR UPDATE');
        $stmt->execute([':id' => $departmentId]);
        $dept = $stmt->fetch();
        if (!$dept) {
            $db->rollBack();
            respond(['success' => false, 'message' => 'Department not found.'], 404);
        }

        $stmt = $db->prepare('SELECT COUNT(*) FROM bed_bookings WHERE department_id = :id AND status IN ("pending", "approved")');
        $stmt->execute([':id' => $departmentId]);
        $taken = (int) $stmt->fetchColumn();
        if ($taken >= (int) $dept['bed_count']) {
            $db->rollBack();
            respond(['success' => false, 'message' => 'Sorry, all beds in ' . $dept['name'] . ' are booked. Bookings for this department are closed.'], 409);
        }

        $stmt = $db->prepare(
            'INSERT INTO bed_bookings (patient_id, hospital_id, department_id, admission_date, reason, attendant_phone, notes)
             VALUES (:pid, :hid, :did, :date, :reason, :phone, :notes)'
        );
        $stmt->execute([
            ':pid' => $patientId, ':hid' => $dept['hospital_id'], ':did' => $departmentId, ':date' => $date, ':reason' => $reason,
            ':phone' => $attendantPhone !== '' ? $attendantPhone : null, ':notes' => $notes !== '' ? $notes : null,
        ]);
        $bookingId = (int) $db->lastInsertId();
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }

    notify($db, $patientId, 'bed-double', 'Bed Requested', 'Your ' . $dept['name'] . ' bed request for ' . $date . ' has been sent and is awaiting the hospital\'s approval.');
    notifyHospitalOwner($db, (int) $dept['hospital_id'], 'New Bed Request',
        patientName($db, $patientId) . ' requested a ' . $dept['name'] . ' bed for ' . $date . '. Review it in Bed Requests.');

    respond(['success' => true, 'booking_id' => $bookingId, 'message' => 'Bed request sent. You\'ll be notified once the hospital decides.']);
}

// ---------------------------------------------------------------- GET
$hospitalId = (int) ($_GET['hospital_id'] ?? 0);
if ($hospitalId > 0) {
    respond(['success' => true, 'departments' => hospitalBedSummary($db, $hospitalId)]);
}

$hospitals = array_map(function (array $h): array {
    return ['id' => (int) $h['id'], 'name' => $h['name'], 'city' => $h['city']];
}, $db->query('SELECT id, name, city FROM hospitals ORDER BY name')->fetchAll());

$stmt = $db->prepare(
    'SELECT b.id, b.admission_date, b.reason, b.status, b.rejection_reason, b.created_at,
            h.name AS hospital_name, hd.name AS dept_name
     FROM bed_bookings b
     JOIN hospitals h ON h.id = b.hospital_id
     JOIN hospital_departments hd ON hd.id = b.department_id
     WHERE b.patient_id = :pid ORDER BY b.id DESC'
);
$stmt->execute([':pid' => $patientId]);
$bookings = array_map(function (array $b): array {
    return [
        'id' => (int) $b['id'], 'hospital' => $b['hospital_name'], 'department' => $b['dept_name'],
        'date' => $b['admission_date'], 'reason' => $b['reason'], 'status' => $b['status'],
        'rejectionReason' => $b['rejection_reason'], 'requestedAt' => isoTime($b['created_at']),
    ];
}, $stmt->fetchAll());

respond(['success' => true, 'hospitals' => $hospitals, 'bookings' => $bookings]);
