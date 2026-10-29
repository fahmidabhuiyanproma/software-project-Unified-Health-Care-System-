<?php
/**
 * POST /api/login.php
 * Body: { "identifier": "email or phone", "password": "..." }
 *
 * Verifies credentials against `users`, writes an audit row to
 * `login_logs` for every attempt (success or failure), and starts a
 * PHP session on success.
 */

require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body = readJsonBody();
$identifier = trim((string) ($body['identifier'] ?? ''));
$password   = (string) ($body['password'] ?? '');

if ($identifier === '' || $password === '') {
    respond(['success' => false, 'message' => 'Email/phone and password are required.'], 422);
}

$db = getDb();

function logAttempt(PDO $db, ?int $userId, string $identifier, string $status, ?string $reason): void {
    $stmt = $db->prepare(
        'INSERT INTO login_logs (user_id, identifier, status, failure_reason, ip_address, user_agent)
         VALUES (:user_id, :identifier, :status, :reason, :ip, :ua)'
    );
    $stmt->execute([
        ':user_id'   => $userId,
        ':identifier'=> $identifier,
        ':status'    => $status,
        ':reason'    => $reason,
        ':ip'        => clientIp(),
        ':ua'        => clientUserAgent(),
    ]);
}

$stmt = $db->prepare('SELECT * FROM users WHERE email = :id1 OR phone = :id2 LIMIT 1');
$stmt->execute([':id1' => $identifier, ':id2' => $identifier]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    logAttempt($db, $user['id'] ?? null, $identifier, 'failed', $user ? 'invalid_password' : 'no_such_account');
    respond(['success' => false, 'message' => 'Invalid credentials.'], 401);
}

if ($user['status'] !== 'active') {
    logAttempt($db, $user['id'], $identifier, 'failed', $user['status']);
    $messages = [
        'pending'   => 'Your provider account is still pending admin approval.',
        'rejected'  => 'Your application was rejected. Please contact support.',
        'suspended' => 'Your account has been suspended. Please contact support.',
    ];
    respond(['success' => false, 'message' => $messages[$user['status']] ?? 'Account is not active.'], 403);
}

logAttempt($db, $user['id'], $identifier, 'success', null);

$_SESSION['user_id'] = $user['id'];
$_SESSION['role']    = $user['role'];

respond([
    'success' => true,
    'user' => [
        'id'    => (int) $user['id'],
        'name'  => $user['full_name'],
        'email' => $user['email'],
        'phone' => $user['phone'],
        'role'  => $user['role'],
        'avatar'=> $user['avatar_url'],
    ],
]);
