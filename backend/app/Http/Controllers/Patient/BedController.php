<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\BedBooking;
use App\Models\Hospital;
use App\Models\HospitalDepartment;
use App\Services\BedService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Ports api/patient/beds.php. */
class BedController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $hospitalId = (int) $request->query('hospital_id', 0);
        if ($hospitalId > 0) {
            return $this->ok(['departments' => BedService::summaryForHospital($hospitalId)]);
        }

        $patientId = $request->user()->id;

        $hospitals = Hospital::orderBy('name')->get(['id', 'name', 'city']);

        $bookings = BedBooking::with(['hospital', 'department'])
            ->where('patient_id', $patientId)
            ->orderByDesc('id')
            ->get()
            ->map(fn (BedBooking $b) => [
                'id' => $b->id,
                'hospital' => $b->hospital->name,
                'department' => $b->department->name,
                'date' => $b->admission_date->toDateString(),
                'reason' => $b->reason,
                'status' => $b->status,
                'rejectionReason' => $b->rejection_reason,
                'requestedAt' => optional($b->created_at)->toIso8601String(),
            ]);

        return $this->ok(['hospitals' => $hospitals, 'bookings' => $bookings]);
    }

    public function store(Request $request): JsonResponse
    {
        $patientId = $request->user()->id;

        $departmentId = (int) $request->input('department_id', 0);
        $date = (string) $request->input('admission_date', '');
        $reason = trim((string) $request->input('reason', ''));
        $attendantPhone = trim((string) $request->input('attendant_phone', ''));
        $notes = trim((string) $request->input('notes', ''));

        if ($departmentId <= 0) {
            return $this->fail('Please choose a department.', 422);
        }
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || ! checkdate((int) substr($date, 5, 2), (int) substr($date, 8, 2), (int) substr($date, 0, 4))) {
            return $this->fail('Please choose a valid admission date.', 422);
        }
        $today = Carbon::today()->toDateString();
        if ($date < $today) {
            return $this->fail('The admission date cannot be in the past.', 422);
        }
        if ($date > Carbon::today()->addDays(90)->toDateString()) {
            return $this->fail('Beds can be requested up to 90 days ahead.', 422);
        }
        if ($reason === '' || mb_strlen($reason) > 255) {
            return $this->fail('Please tell the hospital why the bed is needed (up to 255 characters).', 422);
        }
        if ($attendantPhone !== '' && ! preg_match('/^[+0-9][0-9 +\-()]{5,19}$/', $attendantPhone)) {
            return $this->fail('Please enter a valid attendant phone number.', 422);
        }
        if (mb_strlen($notes) > 500) {
            return $this->fail('Notes are too long (500 characters max).', 422);
        }

        $hasActive = BedBooking::where('patient_id', $patientId)->whereIn('status', ['pending', 'approved'])->exists();
        if ($hasActive) {
            return $this->fail('You already have an active bed booking. Cancel it before requesting another.', 409);
        }

        try {
            $booking = DB::transaction(function () use ($departmentId, $patientId, $date, $reason, $attendantPhone, $notes) {
                $dept = HospitalDepartment::where('id', $departmentId)->lockForUpdate()->first();
                if (! $dept) {
                    throw new \RuntimeException('Department not found.', 404);
                }

                $taken = BedBooking::where('department_id', $departmentId)->whereIn('status', ['pending', 'approved'])->count();
                if ($taken >= $dept->bed_count) {
                    throw new \RuntimeException("Sorry, all beds in {$dept->name} are booked. Bookings for this department are closed.", 409);
                }

                return BedBooking::create([
                    'patient_id' => $patientId,
                    'hospital_id' => $dept->hospital_id,
                    'department_id' => $departmentId,
                    'admission_date' => $date,
                    'reason' => $reason,
                    'attendant_phone' => $attendantPhone !== '' ? $attendantPhone : null,
                    'notes' => $notes !== '' ? $notes : null,
                ]);
            });
        } catch (\RuntimeException $e) {
            return $this->fail($e->getMessage(), $e->getCode() ?: 404);
        }

        $department = HospitalDepartment::find($departmentId);
        $patientName = $request->user()->full_name ?: 'A patient';

        NotificationService::send($patientId, 'bed-double', 'Bed Requested', "Your {$department->name} bed request for {$date} has been sent and is awaiting the hospital's approval.");
        $this->notifyHospitalOwner((int) $booking->hospital_id, 'New Bed Request', "{$patientName} requested a {$department->name} bed for {$date}. Review it in Bed Requests.");

        return $this->ok(['booking_id' => $booking->id, 'message' => "Bed request sent. You'll be notified once the hospital decides."]);
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $patientId = $request->user()->id;

        $booking = BedBooking::with('department')->where('id', $id)->where('patient_id', $patientId)->first();
        if (! $booking) {
            return $this->fail('Bed booking not found.', 404);
        }
        if (! in_array($booking->status, ['pending', 'approved'], true)) {
            return $this->fail('This booking can no longer be cancelled.', 409);
        }

        $booking->update(['status' => 'cancelled']);

        $patientName = $request->user()->full_name ?: 'A patient';
        $this->notifyHospitalOwner(
            (int) $booking->hospital_id,
            'Bed Booking Cancelled',
            "{$patientName} cancelled their {$booking->department->name} bed request for {$booking->admission_date->toDateString()}. The bed is free again."
        );

        return $this->ok(['message' => 'Bed booking cancelled.']);
    }

    private function notifyHospitalOwner(int $hospitalId, string $title, string $body): void
    {
        $ownerId = Hospital::where('id', $hospitalId)->value('owner_user_id');
        if ($ownerId) {
            NotificationService::send((int) $ownerId, 'bed-double', $title, $body);
        }
    }
}
