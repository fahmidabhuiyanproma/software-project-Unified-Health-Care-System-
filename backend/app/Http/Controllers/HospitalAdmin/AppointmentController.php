<?php

namespace App\Http\Controllers\HospitalAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresOwnedProvider;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Hospital;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Ports api/hospital-admin/appointments.php — read-only overview across the hospital. */
class AppointmentController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    public function index(Request $request): JsonResponse
    {
        $hospital = $this->ownedProviderOrFail($request->user(), Hospital::class);
        if ($hospital instanceof JsonResponse) {
            return $hospital;
        }

        $q = trim((string) $request->query('q', ''));

        $query = Appointment::with(['patient', 'doctor.department'])->where('hospital_id', $hospital->id);
        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->whereHas('patient', fn ($p) => $p->where('full_name', 'like', "%{$q}%"))
                    ->orWhereHas('doctor', fn ($d) => $d->where('full_name', 'like', "%{$q}%"));
            });
        }

        $appointments = $query->orderByDesc('appointment_date')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn (Appointment $a) => [
                'id' => $a->id,
                'patient' => $a->patient->full_name,
                'doctor' => $a->doctor->full_name,
                'dept' => $a->doctor->department?->name ?? 'General',
                'date' => $a->appointment_date->toDateString(),
                'time' => $a->appointment_time,
                'type' => $a->visit_type === 'in-person' ? 'In-Person' : 'Telemedicine',
                'status' => $a->status,
            ]);

        return $this->ok(['appointments' => $appointments]);
    }
}
