<?php
/**
 * POST /api/system-admin/create_admin.php {full_name, email, phone}
 *
 * Lets an existing System Admin provision another admin account. This is
 * the only way an "admin" role user can be created — the public
 * registration form deliberately refuses role=admin (see api/register.php)
 * so nobody can grant themselves platform-wide access. A random temporary
 * password is generated and returned once; the new admin should sign in
 * and note it down (no forced password-change flow exists yet, so it
 * doubles as the permanent password for this MVP).
 */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['admin']);
$db = getDb();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body = readJsonBody();
$fullName = trim((string) ($body['full_name'] ?? ''));
$email = trim((string) ($body['email'] ?? ''));
$phone = trim((string) ($body['phone'] ?? ''));

if ($fullName === '' || $phone === '') {
    respond(['success' => false, 'message' => 'Full name and phone are required.'], 422);
}

$stmt = $db->prepare('SELECT id FROM users WHERE phone = :phone OR (email = :email1 AND :email2 <> "") LIMIT 1');
$stmt->execute([':phone' => $phone, ':email1' => $email, ':email2' => $email]);
if ($stmt->fetch()) {
    respond(['success' => false, 'message' => 'A user with this phone or email already exists.'], 409);
}

$tempPassword = substr(bin2hex(random_bytes(4)), 0, 8);
$passwordHash = password_hash($tempPassword, PASSWORD_BCRYPT);

$stmt = $db->prepare('INSERT INTO users (full_name, email, phone, password_hash, role, status) VALUES (:name, :email, :phone, :hash, "admin", "active")');
$stmt->execute([':name' => $fullName, ':email' => $email !== '' ? $email : null, ':phone' => $phone, ':hash' => $passwordHash]);

respond([
    'success' => true,
    'message' => 'Admin account created. Share these login details with them.',
    'login' => ['phone' => $phone, 'temp_password' => $tempPassword],
]);
