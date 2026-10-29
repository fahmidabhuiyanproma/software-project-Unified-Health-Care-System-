<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresDoctorProfile;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ports api/doctor/appointment_update.php — a doctor reviews a patient's
 * appointment request (FR-3.1 confirm step). Confirming locks the slot in;
 * rejecting frees it back up. Patient always notified; the doctor's hospital
 * admin (if any) is notified too, same as before.
 */
class AppointmentController extends Controller
{
    use ApiResponse, RequiresDoctorProfile;

    public function confirm(Request $request, int $id): JsonResponse
    {
        return $this->review($request, $id, 'confirm');
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        return $this->review($request, $id, 'reject');
    }

    private function review(Request $request, int $id, string $action): JsonResponse
    {
        $doctor = $this->doctorProfileOrFail($request->user());
        if ($doctor instanceof JsonResponse) {
            return $doctor;
        }

        $appt = Appointment::with(['hospital', 'patient'])->where('id', $id)->where('doctor_id', $doctor->id)->first();
        if (! $appt) {
            return $this->fail('Appointment not found.', 404);
        }
        if ($appt->status !== 'pending') {
            return $this->fail('This appointment has already been reviewed.', 409);
        }

        $newStatus = $action === 'confirm' ? 'confirmed' : 'cancelled';
        $appt->update(['status' => $newStatus]);

        $hospitalOwnerId = $appt->hospital?->owner_user_id;
        $patientName = $appt->patient->full_name ?? 'A patient';
        $date = $appt->appointment_date->toDateString();

        if ($action === 'confirm') {
            NotificationService::send((int) $appt->patient_id, 'calendar-check', 'Appointment Confirmed', "{$doctor->full_name} confirmed your appointment on {$date} at {$appt->appointment_time}.");
            if ($hospitalOwnerId) {
                NotificationService::send((int) $hospitalOwnerId, 'calendar-check', 'Appointment Confirmed', "{$doctor->full_name} confirmed {$patientName}'s appointment on {$date} at {$appt->appointment_time}.");
            }

            return $this->ok(['message' => 'Appointment confirmed.']);
        }

        NotificationService::send((int) $appt->patient_id, 'calendar-x', 'Appointment Declined', "{$doctor->full_name} could not accept your appointment request for {$date} at {$appt->appointment_time}. Please book another slot.");
        if ($hospitalOwnerId) {
            NotificationService::send((int) $hospitalOwnerId, 'calendar-x', 'Appointment Declined', "{$doctor->full_name} declined {$patientName}'s appointment request for {$date} at {$appt->appointment_time}.");
        }

        return $this->ok(['message' => 'Appointment declined.']);
    }
}
