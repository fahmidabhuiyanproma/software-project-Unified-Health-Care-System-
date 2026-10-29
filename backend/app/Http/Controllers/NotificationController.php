<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Ports api/common/notifications.php — shared by every role's notifications page. */
class NotificationController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $notifications = Notification::where('user_id', $userId)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (Notification $n) => [
                'id' => $n->id,
                'icon' => $n->icon,
                'title' => $n->title,
                'body' => $n->body,
                'read' => (bool) $n->is_read,
                'time' => optional($n->created_at)->toIso8601String(),
            ]);

        $unreadCount = Notification::where('user_id', $userId)->where('is_read', false)->count();

        return $this->ok(['notifications' => $notifications, 'unread_count' => $unreadCount]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        if ($request->boolean('mark_all_read')) {
            Notification::where('user_id', $request->user()->id)->update(['is_read' => true]);
        }

        return $this->ok();
    }
}
