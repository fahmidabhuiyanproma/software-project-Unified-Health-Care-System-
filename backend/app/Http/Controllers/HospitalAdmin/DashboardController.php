<?php

namespace App\Http\Controllers\HospitalAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresOwnedProvider;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Hospital;
use App\Models\HospitalDepartment;
use App\Services\BedService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Ports api/hospital-admin/dashboard.php. */
class DashboardController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    public function index(Request $request): JsonResponse
    {
        $hospital = $this->ownedProviderOrFail($request->user(), Hospital::class);
        if ($hospital instanceof JsonResponse) {
            return $hospital;
        }

        $today = Carbon::today()->toDateString();

        $activeDoctors = Doctor::where('hospital_id', $hospital->id)->where('status', 'active')->count();
        $departmentCount = HospitalDepartment::where('hospital_id', $hospital->id)->count();
        $appointmentsToday = Appointment::where('hospital_id', $hospital->id)->where('appointment_date', $today)->count();
        $confirmedToday = Appointment::where('hospital_id', $hospital->id)->where('appointment_date', $today)->where('status', 'confirmed')->count();
        $pendingToday = Appointment::where('hospital_id', $hospital->id)->where('appointment_date', $today)->where('status', 'pending')->count();

        $recent = Appointment::with(['patient', 'doctor.department'])
            ->where('hospital_id', $hospital->id)
            ->where('appointment_date', $today)
            ->orderBy('appointment_time')
            ->limit(10)
            ->get()
            ->map(fn (Appointment $a) => [
                'patient' => $a->patient->full_name,
                'doctor' => $a->doctor->full_name,
                'dept' => $a->doctor->department?->name ?? 'General',
                'time' => $a->appointment_time,
                'status' => $a->status,
            ]);

        $occupancy = array_map(function (array $d) {
            $pct = $d['total'] > 0 ? min(100, (int) round($d['booked'] / $d['total'] * 100)) : 0;

            return ['dept' => $d['name'], 'pct' => $pct, 'booked' => $d['booked'], 'total' => $d['total']];
        }, BedService::summaryForHospital($hospital->id));

        return $this->ok([
            'hospital' => [
                'name' => $hospital->name,
                'location' => trim(implode(', ', array_filter([$hospital->address, $hospital->city]))) ?: null,
            ],
            'stats' => [
                'activeDoctors' => $activeDoctors,
                'departmentCount' => $departmentCount,
                'appointmentsToday' => $appointmentsToday,
                'confirmedToday' => $confirmedToday,
                'pendingToday' => $pendingToday,
            ],
            'recentAppointments' => $recent,
            'departmentOccupancy' => $occupancy,
        ]);
    }
}
