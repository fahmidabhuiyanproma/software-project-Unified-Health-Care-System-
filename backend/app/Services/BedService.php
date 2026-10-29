<?php

namespace App\Services;

use App\Models\HospitalDepartment;
use Illuminate\Support\Facades\DB;

/** Ports api/_beds.php — bed availability rules shared by patient + hospital-admin. */
class BedService
{
    /**
     * Every department of a hospital with its live bed numbers.
     * Free beds = total - (pending + approved bookings); at 0 the department is closed.
     *
     * @return array<int, array{id:int, name:string, total:int, pending:int, approved:int, booked:int, available:int, open:bool}>
     */
    public static function summaryForHospital(int $hospitalId): array
    {
        $rows = HospitalDepartment::query()
            ->selectRaw(
                'hospital_departments.id, hospital_departments.name, hospital_departments.bed_count as total,
                 COALESCE(SUM(bed_bookings.status = "pending"), 0) as pending,
                 COALESCE(SUM(bed_bookings.status = "approved"), 0) as approved'
            )
            ->leftJoin('bed_bookings', function ($join) {
                $join->on('bed_bookings.department_id', '=', 'hospital_departments.id')
                    ->whereIn('bed_bookings.status', ['pending', 'approved']);
            })
            ->where('hospital_departments.hospital_id', $hospitalId)
            ->groupBy('hospital_departments.id', 'hospital_departments.name', 'hospital_departments.bed_count')
            ->orderBy('hospital_departments.name')
            ->get();

        return $rows->map(function ($d) {
            $total = (int) $d->total;
            $pending = (int) $d->pending;
            $approved = (int) $d->approved;
            $booked = $pending + $approved;
            $available = max(0, $total - $booked);

            return [
                'id' => (int) $d->id,
                'name' => $d->name,
                'total' => $total,
                'pending' => $pending,
                'approved' => $approved,
                'booked' => $booked,
                'available' => $available,
                'open' => $available > 0,
            ];
        })->all();
    }
}
