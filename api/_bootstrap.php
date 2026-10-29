<?php
/**
 * Shared setup for every SynCura API endpoint: JSON in/out, session, DB.
 */

declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';

function readJsonBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function respond(array $payload, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

/** A DB DATETIME as ISO-8601 with an explicit offset, so browsers in any timezone parse it correctly. */
function isoTime(?string $dbDatetime): ?string {
    return $dbDatetime ? date('c', strtotime($dbDatetime)) : null;
}

function clientIp(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

function clientUserAgent(): string {
    return substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
}

/**
 * Role-guard helpers shared by every non-auth endpoint (patient/doctor/
 * hospital-admin/lab-admin/pharmacy-admin/system-admin APIs). Session
 * role/user_id are set by api/login.php on successful sign-in.
 */
function currentUserId(): ?int {
    return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
}

function currentRole(): ?string {
    return $_SESSION['role'] ?? null;
}

function requireLogin(): int {
    $id = currentUserId();
    if ($id === null) {
        respond(['success' => false, 'message' => 'Please sign in to continue.'], 401);
    }
    return $id;
}

/** @param string[] $roles */
function requireRole(array $roles): int {
    $id = requireLogin();
    if (!in_array(currentRole(), $roles, true)) {
        respond(['success' => false, 'message' => 'You are not authorized to access this resource.'], 403);
    }
    return $id;
}

/** Look up the doctors-table profile row for the signed-in doctor user, or 403. */
function requireDoctorProfile(PDO $db): array {
    $stmt = $db->prepare('SELECT * FROM doctors WHERE user_id = :uid LIMIT 1');
    $stmt->execute([':uid' => currentUserId()]);
    $row = $stmt->fetch();
    if (!$row) {
        respond(['success' => false, 'message' => 'No doctor profile is linked to this account yet.'], 403);
    }
    return $row;
}

/** Look up the hospital/lab/pharmacy row owned by the current provider-admin user, or 403. */
function requireOwnedProvider(PDO $db, string $table): array {
    $userId = currentUserId();
    $stmt = $db->prepare("SELECT * FROM {$table} WHERE owner_user_id = :uid LIMIT 1");
    $stmt->execute([':uid' => $userId]);
    $row = $stmt->fetch();
    if (!$row) {
        respond(['success' => false, 'message' => 'No provider organization is linked to this account yet.'], 403);
    }
    return $row;
}
