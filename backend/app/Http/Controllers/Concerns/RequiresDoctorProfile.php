<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Doctor;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/** Mirrors api/_bootstrap.php's requireDoctorProfile(): 403 if no doctors row is linked to this account. */
trait RequiresDoctorProfile
{
    protected function doctorProfileOrFail(User $user): Doctor|JsonResponse
    {
        $doctor = Doctor::where('user_id', $user->id)->first();
        if (! $doctor) {
            return $this->fail('No doctor profile is linked to this account yet.', 403);
        }

        return $doctor;
    }
}
