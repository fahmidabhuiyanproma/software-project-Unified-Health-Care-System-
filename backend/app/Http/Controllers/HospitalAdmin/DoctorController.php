<?php

namespace App\Http\Controllers\HospitalAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresOwnedProvider;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Hospital;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ports api/hospital-admin/doctors.php (FR-2.1) — read-only roster. Doctors
 * are no longer added directly here: a doctor self-registers, picks this
 * hospital, and ApprovalController creates their `doctors` row on approval.
 */
class DoctorController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    public function index(Request $request): JsonResponse
    {
        $hospital = $this->ownedProviderOrFail($request->user(), Hospital::class);
        if ($hospital instanceof JsonResponse) {
            return $hospital;
        }

        $q = trim((string) $request->query('q', ''));

        $query = Doctor::with('department')->where('hospital_id', $hospital->id);
        if ($q !== '') {
            $query->where('full_name', 'like', "%{$q}%");
        }

        $doctors = $query->orderBy('full_name')->get()->map(function (Doctor $d) {
            $patientCount = Appointment::where('doctor_id', $d->id)->distinct('patient_id')->count('patient_id');

            return [
                'id' => $d->id,
                'name' => $d->full_name,
                'specialty' => $d->specialty,
                'dept' => $d->department?->name ?? 'Unassigned',
                'patients' => $patientCount,
                'status' => $d->status === 'active' ? 'confirmed' : $d->status,
                'joined' => $d->created_at->format('M Y'),
            ];
        });

        return $this->ok(['doctors' => $doctors]);
    }
}
