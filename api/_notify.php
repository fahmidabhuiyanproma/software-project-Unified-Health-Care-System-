<?php
/**
 * Shared helper for writing an in-app notification row. Required by any
 * endpoint that needs to notify a user of something (booking confirmed,
 * result ready, order status change, provider approved, etc.) — kept
 * separate from api/common/notifications.php so it can be included
 * without triggering that endpoint's own request handling.
 */

declare(strict_types=1);

function notify(PDO $db, int $userId, string $icon, string $title, string $body): void {
    $stmt = $db->prepare('INSERT INTO notifications (user_id, icon, title, body) VALUES (:uid, :icon, :title, :body)');
    $stmt->execute([':uid' => $userId, ':icon' => $icon, ':title' => $title, ':body' => $body]);
}
