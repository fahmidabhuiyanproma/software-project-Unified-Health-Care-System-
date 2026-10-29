<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresDoctorProfile;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\MedicalRecord;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Ports api/doctor/patient_record.php (FR-4.2). FR-4.4: a doctor may only
 * view/add to a patient's record if they have (or have had) an appointment
 * with that patient — checked on every request, same as before.
 */
class PatientRecordController extends Controller
{
    use ApiResponse, RequiresDoctorProfile;

    public function show(Request $request): JsonResponse
    {
        $doctor = $this->doctorProfileOrFail($request->user());
        if ($doctor instanceof JsonResponse) {
            return $doctor;
        }

        $patientId = (int) $request->query('patient_id', 0);
        if ($patientId <= 0) {
            return $this->fail('patient_id is required.', 422);
        }
        if (! $this->isTreatingDoctor($doctor->id, $patientId)) {
            return $this->fail('You can only view records for your own patients.', 403);
        }

        $patient = User::find($patientId);

        $history = MedicalRecord::where('patient_id', $patientId)
            ->where('doctor_id', $doctor->id)
            ->orderByDesc('visit_date')
            ->orderByDesc('id')
            ->get(['title', 'description', 'vitals', 'visit_date'])
            ->map(fn (MedicalRecord $r) => [
                'title' => $r->title,
                'description' => $r->description,
                'vitals' => $r->vitals,
                'visit_date' => $r->visit_date->toDateString(),
            ]);

        return $this->ok([
            'patient' => [
                'id' => $patient->id,
                'name' => $patient->full_name,
                'phone' => $patient->phone,
                'email' => $patient->email,
            ],
            'history' => $history,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $doctor = $this->doctorProfileOrFail($request->user());
        if ($doctor instanceof JsonResponse) {
            return $doctor;
        }

        $patientId = (int) $request->input('patient_id', 0);
        $chiefComplaint = trim((string) $request->input('chief_complaint', ''));
        $vitals = trim((string) $request->input('vitals', ''));
        $diagnosis = trim((string) $request->input('diagnosis', ''));
        $prescription = trim((string) $request->input('prescription', ''));
        $notes = trim((string) $request->input('notes', ''));

        if ($patientId <= 0 || $diagnosis === '') {
            return $this->fail('Patient and diagnosis are required.', 422);
        }
        if (! $this->isTreatingDoctor($doctor->id, $patientId)) {
            return $this->fail('You can only add records for your own patients.', 403);
        }

        $description = $diagnosis;
        if ($chiefComplaint !== '') {
            $description = "Chief complaint: {$chiefComplaint}\n{$description}";
        }
        if ($prescription !== '') {
            $description .= "\n\nPrescription: {$prescription}";
        }
        if ($notes !== '') {
            $description .= "\n\nNotes: {$notes}";
        }

        MedicalRecord::create([
            'patient_id' => $patientId,
            'doctor_id' => $doctor->id,
            'record_type' => 'diagnosis',
            'title' => $chiefComplaint !== '' ? $chiefComplaint : 'Consultation Note',
            'description' => $description,
            'vitals' => $vitals !== '' ? $vitals : null,
            'visit_date' => Carbon::today()->toDateString(),
        ]);

        return $this->ok(['message' => 'Note saved successfully.']);
    }

    private function isTreatingDoctor(int $doctorId, int $patientId): bool
    {
        return Appointment::where('doctor_id', $doctorId)->where('patient_id', $patientId)->exists();
    }
}
