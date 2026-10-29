<?php
/**
 * POST /api/register.php
 * Body: {
 *   "full_name", "phone", "email", "password", "confirm_password",
 *   "role", "license_number" (required for provider roles),
 *   "hospital_id", "department_id" (required for role="doctor")
 * }
 *
 * Creates the user (status = 'active' for patients, 'pending' for
 * providers awaiting approval) and records a provider_applications row.
 * A doctor must pick a registered hospital + one of its departments;
 * that hospital reviews the application (api/hospital-admin/approvals.php)
 * instead of the System Admin.
 */

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/_notify.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body = readJsonBody();

$fullName = trim((string) ($body['full_name'] ?? ''));
$phone    = trim((string) ($body['phone'] ?? ''));
$email    = trim((string) ($body['email'] ?? ''));
$password = (string) ($body['password'] ?? '');
$confirm  = (string) ($body['confirm_password'] ?? '');
$role     = trim((string) ($body['role'] ?? ''));
$license  = trim((string) ($body['license_number'] ?? ''));

$validRoles = ['patient', 'doctor', 'hospital', 'lab', 'pharmacy', 'admin'];
$providerRoles = ['doctor', 'hospital', 'lab', 'pharmacy'];

if ($fullName === '' || $phone === '' || $password === '' || $confirm === '' || $role === '') {
    respond(['success' => false, 'message' => 'Please fill in all required fields.'], 422);
}
if (!in_array($role, $validRoles, true)) {
    respond(['success' => false, 'message' => 'Invalid role.'], 422);
}
if (strlen($password) < 8) {
    respond(['success' => false, 'message' => 'Password must be at least 8 characters.'], 422);
}
if ($password !== $confirm) {
    respond(['success' => false, 'message' => 'Passwords do not match.'], 422);
}
$isProvider = in_array($role, $providerRoles, true);
if ($isProvider && $license === '') {
    respond(['success' => false, 'message' => 'Organization / License number is required.'], 422);
}

$db = getDb();

$hospitalId = null;
$departmentId = null;
if ($role === 'doctor') {
    $hospitalId = (int) ($body['hospital_id'] ?? 0);
    $departmentId = (int) ($body['department_id'] ?? 0);
    if ($hospitalId <= 0 || $departmentId <= 0) {
        respond(['success' => false, 'message' => 'Please select your hospital and department.'], 422);
    }
    $stmt = $db->prepare('SELECT id FROM hospital_departments WHERE id = :did AND hospital_id = :hid');
    $stmt->execute([':did' => $departmentId, ':hid' => $hospitalId]);
    if (!$stmt->fetch()) {
        respond(['success' => false, 'message' => 'That department does not belong to the selected hospital.'], 422);
    }
}

$stmt = $db->prepare('SELECT id FROM users WHERE phone = :phone OR (email = :email1 AND :email2 <> "") LIMIT 1');
$stmt->execute([':phone' => $phone, ':email1' => $email, ':email2' => $email]);
if ($stmt->fetch()) {
    respond(['success' => false, 'message' => 'An account with this phone or email already exists.'], 409);
}

$status = $isProvider ? 'pending' : 'active';
$passwordHash = password_hash($password, PASSWORD_BCRYPT);

$db->beginTransaction();
try {
    $stmt = $db->prepare(
        'INSERT INTO users (full_name, email, phone, password_hash, role, status)
         VALUES (:name, :email, :phone, :hash, :role, :status)'
    );
    $stmt->execute([
        ':name'   => $fullName,
        ':email'  => $email !== '' ? $email : null,
        ':phone'  => $phone,
        ':hash'   => $passwordHash,
        ':role'   => $role,
        ':status' => $status,
    ]);
    $userId = (int) $db->lastInsertId();

    if ($isProvider) {
        $stmt = $db->prepare(
            'INSERT INTO provider_applications (user_id, hospital_id, department_id, license_number) VALUES (:user_id, :hid, :did, :license)'
        );
        $stmt->execute([':user_id' => $userId, ':hid' => $hospitalId, ':did' => $departmentId, ':license' => $license]);
    }

    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    respond(['success' => false, 'message' => 'Registration failed. Please try again.'], 500);
}

if ($isProvider && $role !== 'doctor') {
    // Hospitals, labs and pharmacies are approved by the System Admin — tell every active admin.
    $adminIds = $db->query('SELECT id FROM users WHERE role = "admin" AND status = "active"')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($adminIds as $adminId) {
        notify($db, (int) $adminId, 'user-check', 'New Provider Application', $fullName . ' applied for a ' . $role . ' account (Reg. No. ' . $license . '). Review it in Provider Approvals.');
    }
}

if ($role === 'doctor') {
    $ownerStmt = $db->prepare(
        'SELECT h.owner_user_id, hd.name AS dept_name FROM hospitals h
         JOIN hospital_departments hd ON hd.id = :did WHERE h.id = :hid'
    );
    $ownerStmt->execute([':did' => $departmentId, ':hid' => $hospitalId]);
    $target = $ownerStmt->fetch();
    if ($target) {
        notify($db, (int) $target['owner_user_id'], 'user-check', 'New Doctor Application', $fullName . ' applied to join ' . $target['dept_name'] . '. Review it in Doctor Approvals.');
    }
}

respond([
    'success' => true,
    'status'  => $status,
    'role'    => $role,
    'message' => $role === 'doctor'
        ? 'Application submitted. Your selected hospital will review and approve your account.'
        : ($isProvider
            ? 'Application submitted. Your provider account is pending admin approval.'
            : 'Account created successfully.'),
]);
