<?php
/**
 * The signed-in user's own profile (FR-1.5) — shared by every role.
 *
 * GET  /api/common/profile.php
 *      → {user, doctor|null, organization|null}
 * POST /api/common/profile.php  (multipart, field "avatar")   — upload a profile picture
 * POST /api/common/profile.php  {action:"update", full_name, email, phone,
 *        doctor?:{specialty, fee, experience, bio},            — doctors only
 *        organization?:{name, address, city, phone}}           — hospital/lab/pharmacy only
 * POST /api/common/profile.php  {action:"remove_avatar"}
 * POST /api/common/profile.php  {action:"password", current_password, new_password, confirm_password}
 *
 * A doctor's picture, name and specialty are mirrored onto their `doctors`
 * directory row, which is what patients see in Find Doctors.
 */

require_once __DIR__ . '/../_bootstrap.php';

$userId = requireLogin();
$db = getDb();

const ORG_TABLES = ['hospital' => 'hospitals', 'lab' => 'labs', 'pharmacy' => 'pharmacies'];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'];

function avatarDir(): string {
    return dirname(__DIR__, 2) . '/assets/avatars';
}

/** Site-absolute URL prefix, e.g. "/syncura/assets/avatars/" — works from pages at any depth. */
function avatarUrlPrefix(): string {
    $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '', 3)), '/');
    return $base . '/assets/avatars/';
}

function deleteAvatarFile(?string $url): void {
    if (!$url || !str_contains($url, '/assets/avatars/')) return;
    $path = avatarDir() . '/' . basename($url);
    if (is_file($path)) @unlink($path);
}

function loadProfile(PDO $db, int $userId): array {
    $stmt = $db->prepare('SELECT id, full_name, email, phone, role, status, avatar_url, created_at FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();
    if (!$user) {
        respond(['success' => false, 'message' => 'User not found.'], 404);
    }

    $doctor = null;
    if ($user['role'] === 'doctor') {
        $stmt = $db->prepare('SELECT specialty, experience_years, consultation_fee, bio FROM doctors WHERE user_id = :uid');
        $stmt->execute([':uid' => $userId]);
        if ($d = $stmt->fetch()) {
            $doctor = [
                'specialty' => $d['specialty'], 'experience' => (int) $d['experience_years'],
                'fee' => (float) $d['consultation_fee'], 'bio' => $d['bio'],
            ];
        }
    }

    $organization = null;
    if (isset(ORG_TABLES[$user['role']])) {
        $stmt = $db->prepare('SELECT name, address, city, phone FROM ' . ORG_TABLES[$user['role']] . ' WHERE owner_user_id = :uid');
        $stmt->execute([':uid' => $userId]);
        if ($o = $stmt->fetch()) $organization = $o;
    }

    return [
        'success' => true,
        'user' => [
            'id' => (int) $user['id'], 'name' => $user['full_name'], 'email' => $user['email'], 'phone' => $user['phone'],
            'role' => $user['role'], 'status' => $user['status'], 'avatar' => $user['avatar_url'], 'memberSince' => $user['created_at'],
        ],
        'doctor' => $doctor,
        'organization' => $organization,
    ];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(loadProfile($db, $userId));
}

// ---------------------------------------------------------------- avatar upload
if (!empty($_FILES['avatar'])) {
    $file = $_FILES['avatar'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        respond(['success' => false, 'message' => 'The upload failed. Please try again.'], 422);
    }
    if ($file['size'] > AVATAR_MAX_BYTES) {
        respond(['success' => false, 'message' => 'Please choose an image under 2 MB.'], 422);
    }
    $info = @getimagesize($file['tmp_name']);
    if ($info === false || !isset(AVATAR_TYPES[$info[2]])) {
        respond(['success' => false, 'message' => 'Please choose a JPG, PNG, WebP or GIF image.'], 422);
    }

    if (!is_dir(avatarDir()) && !mkdir(avatarDir(), 0755, true)) {
        respond(['success' => false, 'message' => 'Could not store the image.'], 500);
    }
    $name = 'u' . $userId . '_' . bin2hex(random_bytes(6)) . '.' . AVATAR_TYPES[$info[2]];
    if (!move_uploaded_file($file['tmp_name'], avatarDir() . '/' . $name)) {
        respond(['success' => false, 'message' => 'Could not store the image.'], 500);
    }
    $url = avatarUrlPrefix() . $name;

    $stmt = $db->prepare('SELECT avatar_url FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $old = $stmt->fetchColumn();

    $db->prepare('UPDATE users SET avatar_url = :url WHERE id = :id')->execute([':url' => $url, ':id' => $userId]);
    $db->prepare('UPDATE doctors SET photo_url = :url WHERE user_id = :id')->execute([':url' => $url, ':id' => $userId]);
    deleteAvatarFile($old);

    respond(['success' => true, 'message' => 'Profile picture updated.', 'avatar' => $url]);
}

$body = readJsonBody();
$action = (string) ($body['action'] ?? 'update');

// ---------------------------------------------------------------- remove avatar
if ($action === 'remove_avatar') {
    $stmt = $db->prepare('SELECT avatar_url FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $old = $stmt->fetchColumn();
    $db->prepare('UPDATE users SET avatar_url = NULL WHERE id = :id')->execute([':id' => $userId]);
    $db->prepare('UPDATE doctors SET photo_url = NULL WHERE user_id = :id')->execute([':id' => $userId]);
    deleteAvatarFile($old);
    respond(['success' => true, 'message' => 'Profile picture removed.']);
}

// ---------------------------------------------------------------- change password
if ($action === 'password') {
    $current = (string) ($body['current_password'] ?? '');
    $new = (string) ($body['new_password'] ?? '');
    $confirm = (string) ($body['confirm_password'] ?? '');

    if ($current === '' || $new === '' || $confirm === '') {
        respond(['success' => false, 'message' => 'Please fill in all password fields.'], 422);
    }
    if (strlen($new) < 8) {
        respond(['success' => false, 'message' => 'New password must be at least 8 characters.'], 422);
    }
    if ($new !== $confirm) {
        respond(['success' => false, 'message' => 'New passwords do not match.'], 422);
    }
    $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    if (!password_verify($current, (string) $stmt->fetchColumn())) {
        respond(['success' => false, 'message' => 'Your current password is incorrect.'], 403);
    }
    $db->prepare('UPDATE users SET password_hash = :hash WHERE id = :id')
       ->execute([':hash' => password_hash($new, PASSWORD_BCRYPT), ':id' => $userId]);
    respond(['success' => true, 'message' => 'Password changed.']);
}

if ($action !== 'update') {
    respond(['success' => false, 'message' => 'Unknown action.'], 422);
}

// ---------------------------------------------------------------- update profile
$fullName = trim((string) ($body['full_name'] ?? ''));
$email    = trim((string) ($body['email'] ?? ''));
$phone    = trim((string) ($body['phone'] ?? ''));

if ($fullName === '' || $phone === '') {
    respond(['success' => false, 'message' => 'Full name and phone number are required.'], 422);
}
if (mb_strlen($fullName) > 150) {
    respond(['success' => false, 'message' => 'Name is too long.'], 422);
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(['success' => false, 'message' => 'Please enter a valid email address.'], 422);
}
if (!preg_match('/^[+0-9][0-9 +\-()]{5,19}$/', $phone)) {
    respond(['success' => false, 'message' => 'Please enter a valid phone number.'], 422);
}

$stmt = $db->prepare('SELECT id FROM users WHERE (phone = :phone OR (email = :email1 AND :email2 <> "")) AND id <> :id LIMIT 1');
$stmt->execute([':phone' => $phone, ':email1' => $email, ':email2' => $email, ':id' => $userId]);
if ($stmt->fetch()) {
    respond(['success' => false, 'message' => 'Another account already uses this phone or email.'], 409);
}

$stmt = $db->prepare('SELECT role FROM users WHERE id = :id');
$stmt->execute([':id' => $userId]);
$role = (string) $stmt->fetchColumn();

$doctorData = null;
if ($role === 'doctor' && is_array($body['doctor'] ?? null)) {
    $specialty = trim((string) ($body['doctor']['specialty'] ?? ''));
    $fee = $body['doctor']['fee'] ?? null;
    $experience = $body['doctor']['experience'] ?? 0;
    $bio = trim((string) ($body['doctor']['bio'] ?? ''));

    if ($specialty === '' || mb_strlen($specialty) > 100) {
        respond(['success' => false, 'message' => 'Please enter your specialty (up to 100 characters).'], 422);
    }
    if (!is_numeric($fee) || (float) $fee < 0 || (float) $fee > 1000000) {
        respond(['success' => false, 'message' => 'Please enter a valid appointment fee.'], 422);
    }
    if (!is_numeric($experience) || (int) $experience < 0 || (int) $experience > 80) {
        respond(['success' => false, 'message' => 'Experience must be between 0 and 80 years.'], 422);
    }
    if (mb_strlen($bio) > 2000) {
        respond(['success' => false, 'message' => 'Bio is too long (2000 characters max).'], 422);
    }
    $doctorData = ['specialty' => $specialty, 'fee' => (float) $fee, 'experience' => (int) $experience, 'bio' => $bio !== '' ? $bio : null];
}

$orgData = null;
if (isset(ORG_TABLES[$role]) && is_array($body['organization'] ?? null)) {
    $o = $body['organization'];
    $orgName = trim((string) ($o['name'] ?? ''));
    $orgPhone = trim((string) ($o['phone'] ?? ''));
    if ($orgName === '' || mb_strlen($orgName) > 150) {
        respond(['success' => false, 'message' => 'Please enter your organization name.'], 422);
    }
    if ($orgPhone !== '' && !preg_match('/^[+0-9][0-9 +\-()]{5,19}$/', $orgPhone)) {
        respond(['success' => false, 'message' => 'Please enter a valid organization phone number.'], 422);
    }
    $orgData = [
        'name' => $orgName, 'phone' => $orgPhone !== '' ? $orgPhone : null,
        'address' => trim((string) ($o['address'] ?? '')) ?: null, 'city' => trim((string) ($o['city'] ?? '')) ?: null,
    ];
}

$db->beginTransaction();
try {
    $db->prepare('UPDATE users SET full_name = :name, email = :email, phone = :phone WHERE id = :id')
       ->execute([':name' => $fullName, ':email' => $email !== '' ? $email : null, ':phone' => $phone, ':id' => $userId]);

    if ($role === 'doctor') {
        // Keep the public directory name in step with the account name.
        $db->prepare('UPDATE doctors SET full_name = :name WHERE user_id = :id')->execute([':name' => $fullName, ':id' => $userId]);
        if ($doctorData) {
            $db->prepare('UPDATE doctors SET specialty = :spec, consultation_fee = :fee, experience_years = :exp, bio = :bio WHERE user_id = :id')
               ->execute([':spec' => $doctorData['specialty'], ':fee' => $doctorData['fee'], ':exp' => $doctorData['experience'], ':bio' => $doctorData['bio'], ':id' => $userId]);
        }
    }
    if ($orgData) {
        $db->prepare('UPDATE ' . ORG_TABLES[$role] . ' SET name = :name, address = :address, city = :city, phone = :phone WHERE owner_user_id = :id')
           ->execute([':name' => $orgData['name'], ':address' => $orgData['address'], ':city' => $orgData['city'], ':phone' => $orgData['phone'], ':id' => $userId]);
    }
    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    respond(['success' => false, 'message' => 'Could not save your profile. Please try again.'], 500);
}

$profile = loadProfile($db, $userId);
$profile['message'] = 'Profile saved.';
respond($profile);
