<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\HospitalDepartment;
use App\Models\LoginLog;
use App\Models\ProviderApplication;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Ports api/login.php, api/register.php, api/logout.php — same validation
 * messages, same status codes, same JSON shape. Session auth now goes
 * through Sanctum's SPA cookie-session guard instead of a raw PHP session,
 * but the observable behavior (identifier+password in, cookie session out)
 * is unchanged.
 */
class AuthController extends Controller
{
    use ApiResponse;

    private const VALID_ROLES = ['patient', 'doctor', 'hospital', 'lab', 'pharmacy', 'admin'];
    private const PROVIDER_ROLES = ['doctor', 'hospital', 'lab', 'pharmacy'];

    public function login(Request $request): JsonResponse
    {
        $identifier = trim((string) $request->input('identifier', ''));
        $password = (string) $request->input('password', '');

        if ($identifier === '' || $password === '') {
            return $this->fail('Email/phone and password are required.', 422);
        }

        $user = User::where('email', $identifier)->orWhere('phone', $identifier)->first();

        if (! $user || ! Hash::check($password, $user->password_hash)) {
            $this->logAttempt($request, $user?->id, $identifier, 'failed', $user ? 'invalid_password' : 'no_such_account');

            return $this->fail('Invalid credentials.', 401);
        }

        if ($user->status !== 'active') {
            $this->logAttempt($request, $user->id, $identifier, 'failed', $user->status);

            $messages = [
                'pending' => 'Your provider account is still pending admin approval.',
                'rejected' => 'Your application was rejected. Please contact support.',
                'suspended' => 'Your account has been suspended. Please contact support.',
            ];

            return $this->fail($messages[$user->status] ?? 'Account is not active.', 403);
        }

        $this->logAttempt($request, $user->id, $identifier, 'success', null);

        Auth::login($user);
        $request->session()->regenerate();

        return $this->ok(['user' => $this->userPayload($user)]);
    }

    public function register(Request $request): JsonResponse
    {
        $fullName = trim((string) $request->input('full_name', ''));
        $phone = trim((string) $request->input('phone', ''));
        $email = trim((string) $request->input('email', ''));
        $password = (string) $request->input('password', '');
        $confirm = (string) $request->input('confirm_password', '');
        $role = trim((string) $request->input('role', ''));
        $license = trim((string) $request->input('license_number', ''));

        if ($fullName === '' || $phone === '' || $password === '' || $confirm === '' || $role === '') {
            return $this->fail('Please fill in all required fields.', 422);
        }
        if (! in_array($role, self::VALID_ROLES, true)) {
            return $this->fail('Invalid role.', 422);
        }
        if (strlen($password) < 8) {
            return $this->fail('Password must be at least 8 characters.', 422);
        }
        if ($password !== $confirm) {
            return $this->fail('Passwords do not match.', 422);
        }

        $isProvider = in_array($role, self::PROVIDER_ROLES, true);
        if ($isProvider && $license === '') {
            return $this->fail('Organization / License number is required.', 422);
        }

        $hospitalId = null;
        $departmentId = null;
        if ($role === 'doctor') {
            $hospitalId = (int) $request->input('hospital_id', 0);
            $departmentId = (int) $request->input('department_id', 0);
            if ($hospitalId <= 0 || $departmentId <= 0) {
                return $this->fail('Please select your hospital and department.', 422);
            }
            $department = HospitalDepartment::where('id', $departmentId)->where('hospital_id', $hospitalId)->first();
            if (! $department) {
                return $this->fail('That department does not belong to the selected hospital.', 422);
            }
        }

        $exists = User::where('phone', $phone)
            ->orWhere(function ($q) use ($email) {
                $q->where('email', $email)->where('email', '<>', '');
            })
            ->exists();
        if ($exists) {
            return $this->fail('An account with this phone or email already exists.', 409);
        }

        $status = $isProvider ? 'pending' : 'active';

        try {
            $user = DB::transaction(function () use ($fullName, $email, $phone, $password, $role, $status, $isProvider, $hospitalId, $departmentId, $license) {
                $user = User::create([
                    'full_name' => $fullName,
                    'email' => $email !== '' ? $email : null,
                    'phone' => $phone,
                    'password_hash' => Hash::make($password),
                    'role' => $role,
                    'status' => $status,
                ]);

                if ($isProvider) {
                    ProviderApplication::create([
                        'user_id' => $user->id,
                        'hospital_id' => $role === 'doctor' ? $hospitalId : null,
                        'department_id' => $role === 'doctor' ? $departmentId : null,
                        'license_number' => $license,
                    ]);
                }

                return $user;
            });
        } catch (\Throwable $e) {
            return $this->fail('Registration failed. Please try again.', 500);
        }

        if ($isProvider && $role !== 'doctor') {
            User::where('role', 'admin')->where('status', 'active')->pluck('id')->each(
                fn ($adminId) => NotificationService::send(
                    (int) $adminId,
                    'user-check',
                    'New Provider Application',
                    "{$fullName} applied for a {$role} account (Reg. No. {$license}). Review it in Provider Approvals."
                )
            );
        }

        if ($role === 'doctor') {
            $department = HospitalDepartment::with('hospital')->find($departmentId);
            if ($department && $department->hospital) {
                NotificationService::send(
                    (int) $department->hospital->owner_user_id,
                    'user-check',
                    'New Doctor Application',
                    "{$fullName} applied to join {$department->name}. Review it in Doctor Approvals."
                );
            }
        }

        $message = $role === 'doctor'
            ? 'Application submitted. Your selected hospital will review and approve your account.'
            : ($isProvider
                ? 'Application submitted. Your provider account is pending admin approval.'
                : 'Account created successfully.');

        return $this->ok(['status' => $status, 'role' => $role, 'message' => $message]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->ok();
    }

    /**
     * New endpoint (the old app didn't need one — it trusted localStorage
     * across page loads). A real SPA must ask the server who's signed in
     * on boot instead of trusting client-side state.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return $this->fail('Please sign in to continue.', 401);
        }

        return $this->ok(['user' => $this->userPayload($user)]);
    }

    private function logAttempt(Request $request, ?int $userId, string $identifier, string $status, ?string $reason): void
    {
        LoginLog::create([
            'user_id' => $userId,
            'identifier' => $identifier,
            'status' => $status,
            'failure_reason' => $reason,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 255),
        ]);
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => (int) $user->id,
            'name' => $user->full_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'avatar' => $user->avatar_url,
        ];
    }
}
