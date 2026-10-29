<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Services\NotificationService;
use App\Services\SlotService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Ports api/patient/appointments.php + appointment_update.php (FR-3.1..FR-3.4). */
class AppointmentController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $patientId = $request->user()->id;

        $appointments = Appointment::with(['doctor', 'hospital'])
            ->where('patient_id', $patientId)
            ->orderByDesc('appointment_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Appointment $a) => [
                'id' => $a->id,
                'doctor_id' => $a->doctor_id,
                'doctor' => $a->doctor->full_name,
                'specialty' => $a->doctor->specialty,
                'hospital' => ($a->hospital?->name ?? 'Independent Practice').($a->hospital?->city ? ', '.$a->hospital->city : ''),
                'date' => $a->appointment_date->toDateString(),
                'time' => $a->appointment_time,
                'type' => $a->visit_type,
                'status' => $a->status,
                'fee' => '৳ '.number_format((float) $a->fee),
                'reason' => $a->reason,
                'img' => $a->doctor->photo_url ?: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=60&h=60&fit=crop&auto=format',
            ]);

        return $this->ok(['appointments' => $appointments]);
    }

    public function store(Request $request): JsonResponse
    {
        $patientId = $request->user()->id;

        $doctorId = (int) $request->input('doctor_id', 0);
        $date = (string) $request->input('date', '');
        $time = (string) $request->input('time', '');
        $visitType = (string) $request->input('visit_type', 'in-person');
        $reason = trim((string) $request->input('reason', ''));
        $notes = trim((string) $request->input('notes', ''));

        if ($doctorId <= 0 || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $time === '') {
            return $this->fail('Doctor, date, and time slot are required.', 422);
        }
        if (! in_array($time, SlotService::TIME_SLOTS, true)) {
            return $this->fail('Invalid time slot.', 422);
        }
        if (! in_array($visitType, ['in-person', 'telemedicine'], true)) {
            $visitType = 'in-person';
        }

        $doctor = Doctor::where('id', $doctorId)->where('status', 'active')->first();
        if (! $doctor) {
            return $this->fail('Doctor not found.', 404);
        }

        $taken = Appointment::where('doctor_id', $doctorId)
            ->where('appointment_date', $date)
            ->where('appointment_time', $time)
            ->whereIn('status', ['confirmed', 'pending'])
            ->exists();
        if ($taken) {
            return $this->fail('This time slot was just booked by someone else. Please pick another slot.', 409);
        }

        try {
            $appointment = Appointment::create([
                'patient_id' => $patientId,
                'doctor_id' => $doctorId,
                'hospital_id' => $doctor->hospital_id,
                'appointment_date' => $date,
                'appointment_time' => $time,
                'visit_type' => $visitType,
                'reason' => $reason !== '' ? $reason : null,
                'notes' => $notes !== '' ? $notes : null,
                'fee' => $doctor->consultation_fee,
                'status' => 'pending',
            ]);
        } catch (QueryException $e) {
            if ($e->getCode() === '23000') {
                return $this->fail('This time slot was just booked by someone else. Please pick another slot.', 409);
            }
            throw $e;
        }

        NotificationService::send($patientId, 'clock', 'Appointment Requested', "Your appointment request with {$doctor->full_name} on {$date} at {$time} has been sent and is awaiting the doctor's confirmation.");
        if ($doctor->user_id) {
            NotificationService::send((int) $doctor->user_id, 'calendar', 'New Appointment Request', "A patient has requested an appointment on {$date} at {$time}. Approve or reject it from My Patients.");
        }
        if ($doctor->hospital_id && $doctor->hospital) {
            $patientName = $request->user()->full_name ?: 'A patient';
            NotificationService::send((int) $doctor->hospital->owner_user_id, 'calendar', 'New Appointment Request', "{$patientName} requested an appointment with {$doctor->full_name} on {$date} at {$time}.");
        }

        return $this->ok(['appointment_id' => $appointment->id, 'message' => "Appointment request sent. You'll be notified once the doctor confirms it."]);
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $appt = Appointment::with('doctor')->where('id', $id)->where('patient_id', $request->user()->id)->first();
        if (! $appt) {
            return $this->fail('Appointment not found.', 404);
        }
        if (! in_array($appt->status, ['pending', 'confirmed'], true)) {
            return $this->fail('Only an upcoming appointment can be changed.', 409);
        }

        $appt->update(['status' => 'cancelled']);

        $docName = $appt->doctor->full_name ?? 'your doctor';
        NotificationService::send($request->user()->id, 'calendar-x', 'Appointment Cancelled', "Your appointment with {$docName} on {$appt->appointment_date->toDateString()} was cancelled.");

        return $this->ok(['message' => 'Appointment cancelled.']);
    }

    public function reschedule(Request $request, int $id): JsonResponse
    {
        $patientId = $request->user()->id;

        $appt = Appointment::where('id', $id)->where('patient_id', $patientId)->first();
        if (! $appt) {
            return $this->fail('Appointment not found.', 404);
        }
        if (! in_array($appt->status, ['pending', 'confirmed'], true)) {
            return $this->fail('Only an upcoming appointment can be changed.', 409);
        }

        $date = (string) $request->input('date', '');
        $time = (string) $request->input('time', '');
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || ! in_array($time, SlotService::TIME_SLOTS, true)) {
            return $this->fail('A valid new date and time slot are required.', 422);
        }

        $taken = Appointment::where('doctor_id', $appt->doctor_id)
            ->where('appointment_date', $date)
            ->where('appointment_time', $time)
            ->whereIn('status', ['confirmed', 'pending'])
            ->where('id', '<>', $id)
            ->exists();
        if ($taken) {
            return $this->fail('That slot is already booked. Please choose another.', 409);
        }

        try {
            $appt->update(['appointment_date' => $date, 'appointment_time' => $time]);
        } catch (QueryException $e) {
            if ($e->getCode() === '23000') {
                return $this->fail('That slot is already booked. Please choose another.', 409);
            }
            throw $e;
        }

        NotificationService::send($patientId, 'calendar', 'Appointment Rescheduled', "Your appointment has been moved to {$date} at {$time}.");

        return $this->ok(['message' => 'Appointment rescheduled.']);
    }
}
