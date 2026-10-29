<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresDoctorProfile;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\DoctorWeeklyAvailability;
use App\Services\SlotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Ports api/doctor/schedule.php. */
class ScheduleController extends Controller
{
    use ApiResponse, RequiresDoctorProfile;

    public function show(Request $request): JsonResponse
    {
        $doctor = $this->doctorProfileOrFail($request->user());
        if ($doctor instanceof JsonResponse) {
            return $doctor;
        }

        $date = (string) $request->query('date', Carbon::today()->toDateString());
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $date = Carbon::today()->toDateString();
        }

        $booked = Appointment::with('patient')
            ->where('doctor_id', $doctor->id)
            ->where('appointment_date', $date)
            ->whereIn('status', ['confirmed', 'pending'])
            ->get()
            ->keyBy('appointment_time');

        $slots = array_map(function (string $time) use ($booked) {
            $b = $booked->get($time);
            if ($b) {
                return ['time' => $time, 'patient' => $b->patient->full_name, 'type' => $b->visit_type, 'status' => $b->status];
            }

            return ['time' => $time, 'patient' => null];
        }, SlotService::TIME_SLOTS);

        $weekly = array_fill(0, 7, true);
        foreach (DoctorWeeklyAvailability::where('doctor_id', $doctor->id)->get() as $row) {
            $weekly[(int) $row->weekday] = (bool) $row->is_available;
        }

        return $this->ok(['date' => $date, 'slots' => $slots, 'weeklyAvailability' => $weekly]);
    }

    public function toggleAvailability(Request $request): JsonResponse
    {
        $doctor = $this->doctorProfileOrFail($request->user());
        if ($doctor instanceof JsonResponse) {
            return $doctor;
        }

        $weekday = (int) $request->input('weekday', -1);
        $isAvailable = $request->boolean('is_available');

        if ($weekday < 0 || $weekday > 6) {
            return $this->fail('Invalid weekday.', 422);
        }

        // NOT Eloquent's updateOrCreate(): this table's declared primaryKey
        // (doctor_id, for composite-key support) makes any instance-level
        // ->update() scope by doctor_id ALONE, silently overwriting every
        // weekday row for this doctor. The query builder's updateOrInsert()
        // matches on the full WHERE clause instead, same as the old
        // INSERT ... ON DUPLICATE KEY UPDATE.
        DB::table('doctor_weekly_availability')->updateOrInsert(
            ['doctor_id' => $doctor->id, 'weekday' => $weekday],
            ['is_available' => $isAvailable]
        );

        return $this->ok();
    }
}
