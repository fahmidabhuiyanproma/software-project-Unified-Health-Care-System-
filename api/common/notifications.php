<?php
/**
 * GET  /api/common/notifications.php            — list current user's notifications, newest first.
 * POST /api/common/notifications.php  {mark_all_read:true} — mark every notification read.
 *
 * Backs pages/notifications.html for every role (patient/doctor/hospital/
 * lab/pharmacy/admin all share the same notifications table and page).
 */

require_once __DIR__ . '/../_bootstrap.php';

$userId = requireLogin();
$db = getDb();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    if (!empty($body['mark_all_read'])) {
        $stmt = $db->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = :uid');
        $stmt->execute([':uid' => $userId]);
    }
    respond(['success' => true]);
}

$stmt = $db->prepare('SELECT id, icon, title, body, is_read, created_at FROM notifications WHERE user_id = :uid ORDER BY created_at DESC LIMIT 50');
$stmt->execute([':uid' => $userId]);
$rows = $stmt->fetchAll();

$stmt = $db->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND is_read = 0');
$stmt->execute([':uid' => $userId]);
$unreadCount = (int) $stmt->fetchColumn();

$notifications = array_map(function (array $n): array {
    return [
        'id' => (int) $n['id'],
        'icon' => $n['icon'],
        'title' => $n['title'],
        'body' => $n['body'],
        'read' => (bool) $n['is_read'],
        'time' => isoTime($n['created_at']),
    ];
}, $rows);

respond(['success' => true, 'notifications' => $notifications, 'unread_count' => $unreadCount]);
