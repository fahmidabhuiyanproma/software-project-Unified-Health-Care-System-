<?php

namespace App\Http\Controllers\SystemAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Ports api/system-admin/create_admin.php — the only way an "admin" role
 * user gets created (public registration refuses role=admin). Returns a
 * random temporary password once; no forced password-change flow exists
 * yet, so it doubles as the permanent password for this MVP, same as before.
 */
class CreateAdminController extends Controller
{
    use ApiResponse;

    public function store(Request $request): JsonResponse
    {
        $fullName = trim((string) $request->input('full_name', ''));
        $email = trim((string) $request->input('email', ''));
        $phone = trim((string) $request->input('phone', ''));

        if ($fullName === '' || $phone === '') {
            return $this->fail('Full name and phone are required.', 422);
        }

        $exists = User::where('phone', $phone)
            ->orWhere(function ($q) use ($email) {
                $q->where('email', $email)->where('email', '<>', '');
            })
            ->exists();
        if ($exists) {
            return $this->fail('A user with this phone or email already exists.', 409);
        }

        $tempPassword = substr(bin2hex(random_bytes(4)), 0, 8);

        User::create([
            'full_name' => $fullName,
            'email' => $email !== '' ? $email : null,
            'phone' => $phone,
            'password_hash' => Hash::make($tempPassword),
            'role' => 'admin',
            'status' => 'active',
        ]);

        return $this->ok([
            'message' => 'Admin account created. Share these login details with them.',
            'login' => ['phone' => $phone, 'temp_password' => $tempPassword],
        ]);
    }
}
