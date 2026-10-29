<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresDoctorProfile;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Services\SlotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Ports api/doctor/dashboard.php. */
class DashboardController extends Controller
{
    use ApiResponse, RequiresDoctorProfile;

    public function index(Request $request): JsonResponse
    {
        $doctor = $this->doctorProfileOrFail($request->user());
        if ($doctor instanceof JsonResponse) {
            return $doctor;
        }

        $today = Carbon::today()->toDateString();

        $todayRows = Appointment::with('patient')
            ->where('doctor_id', $doctor->id)
            ->where('appointment_date', $today)
            ->where('status', 'confirmed')
            ->orderByRaw(SlotService::orderByExpression())
            ->get();

        $schedule = $todayRows->map(fn (Appointment $a) => [
            'time' => $a->appointment_time,
            'patient' => $a->patient->full_name,
            'type' => $a->visit_type,
            'reason' => $a->reason ?: 'Consultation',
            'status' => $a->status,
        ]);

        $patientsToday = $todayRows->pluck('patient_id')->unique()->count();
        $videoCalls = $todayRows->where('visit_type', 'telemedicine');
        $now = Carbon::now();
        $nextVideoCall = null;
        foreach ($videoCalls as $call) {
            if (Carbon::parse($call->appointment_time) >= $now) {
                $nextVideoCall = $call->appointment_time;
                break;
            }
        }

        $week = Appointment::where('doctor_id', $doctor->id)
            ->whereIn('status', ['pending', 'confirmed', 'completed'])
            ->whereRaw('YEARWEEK(appointment_date, 1) = YEARWEEK(CURDATE(), 1)')
            ->selectRaw('COUNT(*) as total, COALESCE(SUM(status = "pending"), 0) as pending')
            ->first();

        $pendingRequestsCount = Appointment::where('doctor_id', $doctor->id)->where('status', 'pending')->count();

        $pendingRequests = Appointment::with('patient')
            ->where('doctor_id', $doctor->id)
            ->where('status', 'pending')
            ->orderBy('appointment_date')
            ->orderByRaw(SlotService::orderByExpression())
            ->limit(5)
            ->get()
            ->map(fn (Appointment $a) => [
                'name' => $a->patient->full_name,
                'date' => $a->appointment_date->toDateString(),
                'time' => $a->appointment_time,
            ]);

        return $this->ok([
            'schedule' => $schedule,
            'todayCount' => $schedule->count(),
            'pendingRequests' => $pendingRequests,
            'stats' => [
                'pendingRequests' => $pendingRequestsCount,
                'patientsToday' => $patientsToday,
                'telemedicineToday' => $videoCalls->count(),
                'thisWeek' => (int) $week->total,
                'thisWeekPending' => (int) $week->pending,
                'videoCallsToday' => $videoCalls->count(),
                'nextVideoCall' => $nextVideoCall,
            ],
        ]);
    }
}
