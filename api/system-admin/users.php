<?php
/**
 * GET  /api/system-admin/users.php?q= — every platform user.
 * POST /api/system-admin/users.php {user_id, status} — activate/suspend an account.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_notify.php';

$adminId = requireRole(['admin']);
$db = getDb();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $userId = (int) ($body['user_id'] ?? 0);
    $status = (string) ($body['status'] ?? '');

    if ($userId <= 0 || !in_array($status, ['active', 'suspended'], true)) {
        respond(['success' => false, 'message' => 'user_id and a valid status are required.'], 422);
    }
    if ($userId === $adminId) {
        respond(['success' => false, 'message' => 'You cannot change your own account status.'], 422);
    }

    $stmt = $db->prepare('UPDATE users SET status = :status WHERE id = :id');
    $stmt->execute([':status' => $status, ':id' => $userId]);

    if ($status === 'suspended') {
        notify($db, $userId, 'shield', 'Account Suspended', 'Your SynCura account has been suspended by an administrator.');
    } else {
        notify($db, $userId, 'shield', 'Account Reactivated', 'Your SynCura account has been reactivated.');
    }

    respond(['success' => true, 'message' => 'User status updated.']);
}

$q = trim((string) ($_GET['q'] ?? ''));
$sql = 'SELECT id, full_name, email, phone, role, status, created_at FROM users';
$params = [];
if ($q !== '') {
    $sql .= ' WHERE full_name LIKE :q OR email LIKE :q2';
    $params[':q'] = "%$q%"; $params[':q2'] = "%$q%";
}
$sql .= ' ORDER BY created_at DESC';

$stmt = $db->prepare($sql);
$stmt->execute($params);

$roleLabels = ['patient' => 'Patient', 'doctor' => 'Doctor', 'hospital' => 'Hospital Admin', 'lab' => 'Lab Admin', 'pharmacy' => 'Pharmacy Admin', 'admin' => 'System Admin'];
$statusMap = ['active' => 'confirmed', 'pending' => 'pending', 'rejected' => 'cancelled', 'suspended' => 'cancelled'];

$users = array_map(function (array $u) use ($roleLabels, $statusMap): array {
    return [
        'id' => (int) $u['id'], 'name' => $u['full_name'], 'email' => $u['email'] ?: $u['phone'],
        'role' => $roleLabels[$u['role']] ?? $u['role'], 'joined' => date('M j, Y', strtotime($u['created_at'])),
        'status' => $statusMap[$u['status']] ?? $u['status'], 'rawStatus' => $u['status'],
    ];
}, $stmt->fetchAll());

respond(['success' => true, 'users' => $users]);
