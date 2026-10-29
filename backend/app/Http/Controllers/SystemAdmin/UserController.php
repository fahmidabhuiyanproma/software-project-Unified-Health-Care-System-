<?php

namespace App\Http\Controllers\SystemAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Ports api/system-admin/users.php. */
class UserController extends Controller
{
    use ApiResponse;

    private const ROLE_LABELS = [
        'patient' => 'Patient', 'doctor' => 'Doctor', 'hospital' => 'Hospital Admin',
        'lab' => 'Lab Admin', 'pharmacy' => 'Pharmacy Admin', 'admin' => 'System Admin',
    ];
    private const STATUS_MAP = ['active' => 'confirmed', 'pending' => 'pending', 'rejected' => 'cancelled', 'suspended' => 'cancelled'];

    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $query = User::query();
        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('full_name', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%");
            });
        }

        $users = $query->orderByDesc('created_at')->get()->map(fn (User $u) => [
            'id' => $u->id,
            'name' => $u->full_name,
            'email' => $u->email ?: $u->phone,
            'role' => self::ROLE_LABELS[$u->role] ?? $u->role,
            'joined' => $u->created_at->format('M j, Y'),
            'status' => self::STATUS_MAP[$u->status] ?? $u->status,
            'rawStatus' => $u->status,
        ]);

        return $this->ok(['users' => $users]);
    }

    public function updateStatus(Request $request): JsonResponse
    {
        $adminId = $request->user()->id;

        $userId = (int) $request->input('user_id', 0);
        $status = (string) $request->input('status', '');

        if ($userId <= 0 || ! in_array($status, ['active', 'suspended'], true)) {
            return $this->fail('user_id and a valid status are required.', 422);
        }
        if ($userId === $adminId) {
            return $this->fail('You cannot change your own account status.', 422);
        }

        User::where('id', $userId)->update(['status' => $status]);

        if ($status === 'suspended') {
            NotificationService::send($userId, 'shield', 'Account Suspended', 'Your SynCura account has been suspended by an administrator.');
        } else {
            NotificationService::send($userId, 'shield', 'Account Reactivated', 'Your SynCura account has been reactivated.');
        }

        return $this->ok(['message' => 'User status updated.']);
    }
}
