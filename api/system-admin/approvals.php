<?php
/**
 * GET  /api/system-admin/approvals.php — every provider application (FR-1.2).
 * POST /api/system-admin/approvals.php {application_id, decision: "approve"|"reject", reason}
 *
 * Approving a hospital/lab/pharmacy application creates that provider's
 * organization row (hospitals/labs/pharmacies) owned by the applicant, so
 * their admin dashboard has something to manage immediately.
 *
 * Doctor applications are excluded here once they carry a hospital_id —
 * a doctor now picks their hospital at registration, and that hospital
 * reviews the application instead (api/hospital-admin/approvals.php).
 * The doctor branch below only still fires for legacy applications
 * submitted before that hospital_id requirement existed.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_notify.php';

$adminId = requireRole(['admin']);
$db = getDb();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $applicationId = (int) ($body['application_id'] ?? 0);
    $decision = (string) ($body['decision'] ?? '');
    $reason = trim((string) ($body['reason'] ?? ''));

    if ($applicationId <= 0 || !in_array($decision, ['approve', 'reject'], true)) {
        respond(['success' => false, 'message' => 'application_id and a valid decision are required.'], 422);
    }

    $stmt = $db->prepare('SELECT pa.*, u.full_name, u.role, u.email, u.phone FROM provider_applications pa JOIN users u ON u.id = pa.user_id WHERE pa.id = :id');
    $stmt->execute([':id' => $applicationId]);
    $app = $stmt->fetch();
    if (!$app) {
        respond(['success' => false, 'message' => 'Application not found.'], 404);
    }
    if ($app['role'] === 'doctor' && $app['hospital_id'] !== null) {
        respond(['success' => false, 'message' => 'This doctor application is managed by their selected hospital.'], 403);
    }
    if ($app['review_status'] !== 'pending') {
        respond(['success' => false, 'message' => 'This application has already been reviewed.'], 409);
    }

    $db->beginTransaction();
    try {
        if ($decision === 'approve') {
            $db->prepare('UPDATE provider_applications SET review_status = "approved", reviewed_by_user_id = :aid, reviewed_at = NOW() WHERE id = :id')
               ->execute([':aid' => $adminId, ':id' => $applicationId]);
            $db->prepare('UPDATE users SET status = "active" WHERE id = :uid')->execute([':uid' => $app['user_id']]);

            $orgTables = ['hospital' => 'hospitals', 'lab' => 'labs', 'pharmacy' => 'pharmacies'];
            if (isset($orgTables[$app['role']])) {
                $table = $orgTables[$app['role']];
                $extra = $app['role'] === 'hospital' ? ', registration_no' : '';
                $extraVal = $app['role'] === 'hospital' ? ', :regno' : '';
                $sql = "INSERT INTO {$table} (owner_user_id, name, phone{$extra}) VALUES (:uid, :name, :phone{$extraVal})";
                $params = [':uid' => $app['user_id'], ':name' => $app['full_name'], ':phone' => $app['phone']];
                if ($app['role'] === 'hospital') $params[':regno'] = $app['license_number'];
                $db->prepare($sql)->execute($params);
            } elseif ($app['role'] === 'doctor') {
                $stmt = $db->prepare(
                    'INSERT INTO doctors (user_id, full_name, specialty, qualification, consultation_fee, status)
                     VALUES (:uid, :name, "General Physician", :qual, 500, "active")'
                );
                $stmt->execute([':uid' => $app['user_id'], ':name' => $app['full_name'], ':qual' => 'BMDC Reg. No: ' . $app['license_number']]);
                $doctorId = (int) $db->lastInsertId();
                $db->prepare(
                    'INSERT INTO doctor_weekly_availability (doctor_id, weekday, is_available)
                     SELECT :did, w.weekday, 1 FROM (SELECT 0 weekday UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) w'
                )->execute([':did' => $doctorId]);
            }

            $db->commit();
            notify($db, (int) $app['user_id'], 'user-check', 'Provider Account Approved', 'Congratulations! Your ' . $app['role'] . ' account has been approved by the SynCura admin team.');
            respond(['success' => true, 'message' => 'Application approved.']);
        }

        // reject
        $db->prepare('UPDATE provider_applications SET review_status = "rejected", reviewed_by_user_id = :aid, reviewed_at = NOW(), rejection_reason = :reason WHERE id = :id')
           ->execute([':aid' => $adminId, ':id' => $applicationId, ':reason' => $reason !== '' ? $reason : null]);
        $db->prepare('UPDATE users SET status = "rejected" WHERE id = :uid')->execute([':uid' => $app['user_id']]);
        $db->commit();

        notify($db, (int) $app['user_id'], 'x-circle', 'Application Rejected', 'Your provider application was not approved.' . ($reason !== '' ? ' Reason: ' . $reason : ''));
        respond(['success' => true, 'message' => 'Application rejected.']);
    } catch (Throwable $e) {
        $db->rollBack();
        respond(['success' => false, 'message' => 'Could not process this decision.'], 500);
    }
}

$stmt = $db->query(
    'SELECT pa.id, u.full_name, u.role, u.phone, u.email, pa.license_number, pa.submitted_at, pa.review_status
     FROM provider_applications pa JOIN users u ON u.id = pa.user_id
     WHERE NOT (u.role = "doctor" AND pa.hospital_id IS NOT NULL)
     ORDER BY (pa.review_status = "pending") DESC, pa.submitted_at DESC'
);
$providers = array_map(function (array $p): array {
    $statusMap = ['pending' => 'pending', 'approved' => 'confirmed', 'rejected' => 'cancelled'];
    return [
        'id' => (int) $p['id'], 'name' => $p['full_name'], 'type' => ucfirst($p['role']),
        'contact' => $p['phone'], 'email' => $p['email'], 'regNo' => $p['license_number'],
        'submitted' => date('M j, Y', strtotime($p['submitted_at'])), 'status' => $statusMap[$p['review_status']],
    ];
}, $stmt->fetchAll());

respond(['success' => true, 'providers' => $providers]);
