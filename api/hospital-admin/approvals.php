<?php
/**
 * GET  /api/hospital-admin/approvals.php — doctor applications submitted
 *      to this hospital (the doctor picked it at registration).
 * POST /api/hospital-admin/approvals.php {application_id, decision: "approve"|"reject", reason}
 *
 * Approving creates the doctor's directory profile (linked to this
 * hospital + the department they applied to) so they immediately show up
 * in Find Doctors and can be booked, and activates their login.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_notify.php';

requireRole(['hospital']);
$db = getDb();
$hospital = requireOwnedProvider($db, 'hospitals');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $applicationId = (int) ($body['application_id'] ?? 0);
    $decision = (string) ($body['decision'] ?? '');
    $reason = trim((string) ($body['reason'] ?? ''));

    if ($applicationId <= 0 || !in_array($decision, ['approve', 'reject'], true)) {
        respond(['success' => false, 'message' => 'application_id and a valid decision are required.'], 422);
    }

    $stmt = $db->prepare(
        'SELECT pa.*, u.full_name, u.role FROM provider_applications pa
         JOIN users u ON u.id = pa.user_id
         WHERE pa.id = :id AND pa.hospital_id = :hid AND u.role = "doctor"'
    );
    $stmt->execute([':id' => $applicationId, ':hid' => $hospital['id']]);
    $app = $stmt->fetch();
    if (!$app) {
        respond(['success' => false, 'message' => 'Application not found.'], 404);
    }
    if ($app['review_status'] !== 'pending') {
        respond(['success' => false, 'message' => 'This application has already been reviewed.'], 409);
    }

    $db->beginTransaction();
    try {
        if ($decision === 'approve') {
            $db->prepare('UPDATE provider_applications SET review_status = "approved", reviewed_by_user_id = :aid, reviewed_at = NOW() WHERE id = :id')
               ->execute([':aid' => $hospital['owner_user_id'], ':id' => $applicationId]);
            $db->prepare('UPDATE users SET status = "active" WHERE id = :uid')->execute([':uid' => $app['user_id']]);

            $stmt = $db->prepare(
                'INSERT INTO doctors (user_id, hospital_id, department_id, full_name, specialty, qualification, consultation_fee, status)
                 VALUES (:uid, :hid, :did, :name, "General Physician", :qual, 500, "active")'
            );
            $stmt->execute([
                ':uid' => $app['user_id'], ':hid' => $hospital['id'], ':did' => $app['department_id'],
                ':name' => $app['full_name'], ':qual' => 'BMDC Reg. No: ' . $app['license_number'],
            ]);
            $doctorId = (int) $db->lastInsertId();
            $db->prepare(
                'INSERT INTO doctor_weekly_availability (doctor_id, weekday, is_available)
                 SELECT :did, w.weekday, 1 FROM (SELECT 0 weekday UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) w'
            )->execute([':did' => $doctorId]);

            $db->commit();
            notify($db, (int) $app['user_id'], 'user-check', 'Doctor Account Approved', $hospital['name'] . ' approved your doctor account. You can now sign in to the Doctor Portal.');
            respond(['success' => true, 'message' => 'Doctor approved.']);
        }

        // reject
        $db->prepare('UPDATE provider_applications SET review_status = "rejected", reviewed_by_user_id = :aid, reviewed_at = NOW(), rejection_reason = :reason WHERE id = :id')
           ->execute([':aid' => $hospital['owner_user_id'], ':id' => $applicationId, ':reason' => $reason !== '' ? $reason : null]);
        $db->prepare('UPDATE users SET status = "rejected" WHERE id = :uid')->execute([':uid' => $app['user_id']]);
        $db->commit();

        notify($db, (int) $app['user_id'], 'x-circle', 'Application Declined', $hospital['name'] . ' declined your doctor application.' . ($reason !== '' ? ' Reason: ' . $reason : ''));
        respond(['success' => true, 'message' => 'Application declined.']);
    } catch (Throwable $e) {
        $db->rollBack();
        respond(['success' => false, 'message' => 'Could not process this decision.'], 500);
    }
}

$stmt = $db->prepare(
    'SELECT pa.id, u.full_name, u.phone, u.email, pa.license_number, pa.submitted_at, pa.review_status, hd.name AS dept_name
     FROM provider_applications pa
     JOIN users u ON u.id = pa.user_id
     LEFT JOIN hospital_departments hd ON hd.id = pa.department_id
     WHERE pa.hospital_id = :hid AND u.role = "doctor"
     ORDER BY (pa.review_status = "pending") DESC, pa.submitted_at DESC'
);
$stmt->execute([':hid' => $hospital['id']]);
$statusMap = ['pending' => 'pending', 'approved' => 'confirmed', 'rejected' => 'cancelled'];
$applications = array_map(function (array $a) use ($statusMap): array {
    return [
        'id' => (int) $a['id'], 'name' => $a['full_name'], 'contact' => $a['phone'], 'email' => $a['email'],
        'regNo' => $a['license_number'], 'dept' => $a['dept_name'] ?: 'Unassigned',
        'submitted' => date('M j, Y', strtotime($a['submitted_at'])), 'status' => $statusMap[$a['review_status']],
    ];
}, $stmt->fetchAll());

respond(['success' => true, 'applications' => $applications]);
