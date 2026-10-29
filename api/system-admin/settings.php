<?php
/**
 * GET  /api/system-admin/settings.php — platform configuration key/values.
 * POST /api/system-admin/settings.php {platform_name, currency, support_email, sms_notifications, email_notifications, push_notifications}
 */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['admin']);
$db = getDb();

$keys = ['platform_name', 'currency', 'support_email', 'sms_notifications', 'email_notifications', 'push_notifications'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $stmt = $db->prepare('INSERT INTO platform_settings (setting_key, setting_value) VALUES (:k, :v) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)');
    foreach ($keys as $key) {
        if (!array_key_exists($key, $body)) continue;
        $value = is_bool($body[$key]) ? ($body[$key] ? '1' : '0') : trim((string) $body[$key]);
        $stmt->execute([':k' => $key, ':v' => $value]);
    }
    respond(['success' => true, 'message' => 'Settings saved.']);
}

$stmt = $db->query('SELECT setting_key, setting_value FROM platform_settings');
$settings = [];
foreach ($stmt->fetchAll() as $row) {
    $settings[$row['setting_key']] = $row['setting_value'];
}

respond(['success' => true, 'settings' => $settings]);
