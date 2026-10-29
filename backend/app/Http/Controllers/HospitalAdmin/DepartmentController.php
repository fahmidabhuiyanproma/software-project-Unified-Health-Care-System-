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

/** Ports api/hospital-admin/departments.php (FR-2.1). */
class DepartmentController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    public function index(Request $request): JsonResponse
    {
        $hospital = $this->ownedProviderOrFail($request->user(), Hospital::class);
        if ($hospital instanceof JsonResponse) {
            return $hospital;
        }

        $today = Carbon::today()->toDateString();
        $bedsFree = collect(BedService::summaryForHospital($hospital->id))->keyBy('id');

        $departments = HospitalDepartment::where('hospital_id', $hospital->id)
            ->orderBy('name')
            ->get()
            ->map(function (HospitalDepartment $d) use ($today, $bedsFree) {
                $doctorCount = Doctor::where('department_id', $d->id)->count();
                $todayAppts = Appointment::whereHas('doctor', fn ($q) => $q->where('department_id', $d->id))
                    ->where('appointment_date', $today)
                    ->where('status', 'confirmed')
                    ->count();
                $headDoctor = Doctor::where('department_id', $d->id)->orderBy('id')->value('full_name');

                return [
                    'id' => $d->id,
                    'name' => $d->name,
                    'beds' => $d->bed_count,
                    'bedsFree' => $bedsFree->get($d->id)['available'] ?? $d->bed_count,
                    'doctors' => $doctorCount,
                    'todayAppts' => $todayAppts,
                    'head' => $headDoctor ?: 'Unassigned',
                ];
            });

        return $this->ok(['departments' => $departments]);
    }

    public function store(Request $request): JsonResponse
    {
        $hospital = $this->ownedProviderOrFail($request->user(), Hospital::class);
        if ($hospital instanceof JsonResponse) {
            return $hospital;
        }

        $name = trim((string) $request->input('name', ''));
        $bedCount = max(0, (int) $request->input('bed_count', 0));

        if ($name === '') {
            return $this->fail('Department name is required.', 422);
        }

        $exists = HospitalDepartment::where('hospital_id', $hospital->id)->where('name', $name)->exists();
        if ($exists) {
            return $this->fail('This department already exists.', 409);
        }

        HospitalDepartment::create(['hospital_id' => $hospital->id, 'name' => $name, 'bed_count' => $bedCount]);

        return $this->ok(['message' => 'Department added.']);
    }
}
