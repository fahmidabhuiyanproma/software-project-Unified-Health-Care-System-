<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\LabBooking;
use App\Models\MedicalRecord;
use App\Models\Notification;
use App\Models\PharmacyOrder;
use App\Services\SlotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Ports api/patient/dashboard.php. */
class DashboardController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $patientId = $request->user()->id;
        $today = Carbon::today()->toDateString();

        $appointmentsThisYear = Appointment::where('patient_id', $patientId)
            ->whereRaw('YEAR(appointment_date) = YEAR(CURDATE())')
            ->count();

        $recordCount = MedicalRecord::where('patient_id', $patientId)->count();

        $recordHospitals = MedicalRecord::where('medical_records.patient_id', $patientId)
            ->join('doctors', 'doctors.id', '=', 'medical_records.doctor_id')
            ->whereNotNull('doctors.hospital_id')
            ->distinct('doctors.hospital_id')
            ->count('doctors.hospital_id');

        $orderCount = PharmacyOrder::where('patient_id', $patientId)
            ->where('created_at', '>=', Carbon::today()->subMonths(6))
            ->count();

        $labTestCount = LabBooking::where('patient_id', $patientId)->count();
        $labResultsReady = LabBooking::where('patient_id', $patientId)->where('status', 'ready')->count();

        $upcomingCount = Appointment::where('patient_id', $patientId)
            ->whereIn('status', ['pending', 'confirmed'])
            ->where('appointment_date', '>=', $today)
            ->count();

        $upcoming = Appointment::with(['doctor', 'hospital'])
            ->where('patient_id', $patientId)
            ->whereIn('status', ['pending', 'confirmed'])
            ->where('appointment_date', '>=', $today)
            ->orderBy('appointment_date')
            ->orderByRaw(SlotService::orderByExpression())
            ->limit(2)
            ->get()
            ->map(fn (Appointment $a) => [
                'id' => $a->id,
                'doctor' => $a->doctor->full_name,
                'specialty' => $a->doctor->specialty,
                'hospital' => ($a->hospital?->name ?? 'Independent Practice').($a->hospital?->city ? ', '.$a->hospital->city : ''),
                'date' => $a->appointment_date->toDateString(),
                'time' => $a->appointment_time,
                'status' => $a->status,
                'img' => $a->doctor->photo_url ?: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=60&h=60&fit=crop&auto=format',
            ]);

        $activity = Notification::where('user_id', $patientId)
            ->orderByDesc('created_at')
            ->limit(3)
            ->get()
            ->map(fn (Notification $n) => [
                'icon' => $n->icon,
                'title' => $n->title,
                'body' => $n->body,
                'time' => optional($n->created_at)->toIso8601String(),
            ]);

        return $this->ok([
            'stats' => [
                'appointments' => ['value' => $appointmentsThisYear, 'sub' => 'This year'],
                'records' => ['value' => $recordCount, 'sub' => $recordHospitals.' hospital'.($recordHospitals === 1 ? '' : 's')],
                'orders' => ['value' => $orderCount, 'sub' => 'Last 6 months'],
                'labTests' => ['value' => $labTestCount, 'sub' => 'Results ready: '.$labResultsReady],
            ],
            'upcomingCount' => $upcomingCount,
            'upcoming' => $upcoming,
            'activity' => $activity,
        ]);
    }
}
