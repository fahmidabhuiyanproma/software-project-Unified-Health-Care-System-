<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Models\Appointment;
use App\Models\TelemedicineMessage;
use App\Models\TelemedicineSession;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ports api/common/telemedicine.php — shared by the Patient and Doctor
 * portals (both use the same telemedicine.html screen). Omitting
 * appointment_id resolves to the caller's most recent upcoming
 * telemedicine appointment, exactly as before.
 */
class TelemedicineController extends Controller
{
    use ApiResponse;

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->role;

        $appointmentId = (int) $request->query('appointment_id', 0);
        if ($appointmentId <= 0) {
            $appointmentId = $this->mostRecentTelemedicineAppointmentId($user->id, $role) ?? 0;
        }
        if ($appointmentId <= 0) {
            return $this->ok(['appointment' => null, 'messages' => []]);
        }

        $appt = $this->loadAppointmentForUser($appointmentId, $user->id, $role);
        if (! $appt) {
            return $this->fail('Telemedicine session not found.', 404);
        }

        $session = TelemedicineSession::where('appointment_id', $appointmentId)->first();

        $messages = [];
        if ($session) {
            $messages = TelemedicineMessage::where('session_id', $session->id)
                ->orderBy('id')
                ->get()
                ->map(fn (TelemedicineMessage $m) => [
                    'from' => $m->sender_role,
                    'text' => $m->message,
                    'time' => optional($m->created_at)->toIso8601String(),
                ]);
        }

        return $this->ok([
            'appointment' => [
                'id' => (int) $appt->id,
                'doctor_name' => $appt->doctor->full_name,
                'specialty' => $appt->doctor->specialty,
                'patient_name' => $appt->patient->full_name,
                'date' => $appt->appointment_date->toDateString(),
                'time' => $appt->appointment_time,
            ],
            'messages' => $messages,
        ]);
    }

    public function sendMessage(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->role;

        $appointmentId = (int) $request->input('appointment_id', 0);
        $message = trim((string) $request->input('message', ''));

        if ($appointmentId <= 0 || $message === '') {
            return $this->fail('appointment_id and message are required.', 422);
        }

        $appt = $this->loadAppointmentForUser($appointmentId, $user->id, $role);
        if (! $appt) {
            return $this->fail('Telemedicine session not found.', 404);
        }

        $session = TelemedicineSession::firstOrCreate(['appointment_id' => $appointmentId]);

        TelemedicineMessage::create([
            'session_id' => $session->id,
            'sender_user_id' => $user->id,
            'sender_role' => $role,
            'message' => $message,
        ]);

        $otherUserId = $role === 'patient' ? (int) ($appt->doctor->user_id ?? 0) : (int) $appt->patient_id;
        if ($otherUserId) {
            $label = $role === 'patient' ? $appt->patient->full_name : 'Dr. '.$appt->doctor->full_name;
            NotificationService::send($otherUserId, 'message-circle', 'New Telemedicine Message', "{$label} sent a message.");
        }

        return $this->ok();
    }

    private function loadAppointmentForUser(int $appointmentId, int $userId, string $role): ?Appointment
    {
        $query = Appointment::with(['doctor', 'patient'])
            ->where('id', $appointmentId)
            ->where('visit_type', 'telemedicine');

        if ($role === 'patient') {
            $query->where('patient_id', $userId);
        } else {
            $query->whereHas('doctor', fn ($q) => $q->where('user_id', $userId));
        }

        return $query->first();
    }

    private function mostRecentTelemedicineAppointmentId(int $userId, string $role): ?int
    {
        $query = Appointment::where('visit_type', 'telemedicine')
            ->orderByDesc('appointment_date')
            ->orderByDesc('id');

        if ($role === 'patient') {
            $query->where('patient_id', $userId);
        } else {
            $query->whereHas('doctor', fn ($q) => $q->where('user_id', $userId));
        }

        return $query->value('id');
    }
}
