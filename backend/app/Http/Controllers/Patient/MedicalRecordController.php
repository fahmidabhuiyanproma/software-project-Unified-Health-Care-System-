<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\MedicalRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Ports api/patient/medical_records.php (FR-4.3). */
class MedicalRecordController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $patientId = $request->user()->id;

        $records = MedicalRecord::with('doctor.hospital')
            ->where('patient_id', $patientId)
            ->orderByDesc('visit_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (MedicalRecord $r) => [
                'id' => $r->id,
                'type' => $r->record_type,
                'title' => $r->title,
                'desc' => $r->description,
                'vitals' => $r->vitals,
                'hasFile' => $r->attachment_path !== null,
                'date' => $r->visit_date->toDateString(),
                'doctor' => $r->doctor->full_name ?? null,
                'hospital' => $r->doctor?->hospital?->name ?? ($r->doctor ? 'Independent Practice' : null),
            ]);

        return $this->ok(['records' => $records]);
    }
}
