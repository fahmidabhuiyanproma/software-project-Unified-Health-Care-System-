<?php

namespace App\Services;

use App\Models\Notification;

/** Same job as the old api/_notify.php's notify() — write one in-app notification row. */
class NotificationService
{
    public static function send(int $userId, string $icon, string $title, string $body): void
    {
        Notification::create([
            'user_id' => $userId,
            'icon' => $icon,
            'title' => $title,
            'body' => $body,
        ]);
    }
}
