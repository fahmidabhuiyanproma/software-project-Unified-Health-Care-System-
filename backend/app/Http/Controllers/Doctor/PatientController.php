<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresDoctorProfile;
use App\Http\Controllers\Controller;
use App\Services\SlotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Ports api/doctor/patients.php — every distinct patient currently under this
 * doctor's care, with last/next visit summary (FR-4.4 basis). Kept as raw SQL
 * (parameterized) like the original: a correlated subquery for "latest status"
 * is awkward to express faithfully in the query builder without changing
 * behavior.
 */
class PatientController extends Controller
{
    use ApiResponse, RequiresDoctorProfile;

    public function index(Request $request): JsonResponse
    {
        $doctor = $this->doctorProfileOrFail($request->user());
        if ($doctor instanceof JsonResponse) {
            return $doctor;
        }

        $q = trim((string) $request->query('q', ''));

        $sql = 'SELECT u.id AS patient_id, u.full_name,
                       MAX(CASE WHEN a.appointment_date <= CURDATE() THEN a.appointment_date END) AS last_visit,
                       MIN(CASE WHEN a.appointment_date >= CURDATE() AND a.status = "confirmed" THEN a.appointment_date END) AS next_visit,
                       (SELECT status FROM appointments a2 WHERE a2.patient_id = u.id AND a2.doctor_id = ?
                        ORDER BY (a2.status = "cancelled") ASC, a2.appointment_date DESC LIMIT 1) AS latest_status
                FROM appointments a JOIN users u ON u.id = a.patient_id
                WHERE a.doctor_id = ?';
        $bindings = [$doctor->id, $doctor->id];

        if ($q !== '') {
            $sql .= ' AND u.full_name LIKE ?';
            $bindings[] = "%{$q}%";
        }
        $sql .= ' GROUP BY u.id, u.full_name HAVING SUM(a.status <> "cancelled") > 0 ORDER BY u.full_name';

        $rows = DB::select($sql, $bindings);

        $slotOrder = SlotService::orderByExpression();
        $pendingRows = DB::select(
            "SELECT id, patient_id, appointment_date, appointment_time, visit_type FROM appointments
             WHERE doctor_id = ? AND status = 'pending' ORDER BY appointment_date, {$slotOrder}",
            [$doctor->id]
        );

        $pendingByPatient = [];
        foreach ($pendingRows as $a) {
            $pendingByPatient[(int) $a->patient_id][] = [
                'id' => (int) $a->id,
                'date' => $a->appointment_date,
                'time' => $a->appointment_time,
                'type' => $a->visit_type,
            ];
        }

        $patients = array_map(fn ($p) => [
            'id' => (int) $p->patient_id,
            'name' => $p->full_name,
            'lastVisit' => $p->last_visit,
            'nextAppt' => $p->next_visit,
            'status' => $p->latest_status,
            'pending' => $pendingByPatient[(int) $p->patient_id] ?? [],
        ], $rows);

        return $this->ok(['patients' => $patients]);
    }
}
