<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Models\Hospital;
use App\Models\HospitalDepartment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ports api/common/hospitals.php — public (no login required, used during
 * doctor registration before the visitor has an account).
 */
class HospitalController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $hospitalId = (int) $request->query('hospital_id', 0);

        if ($hospitalId > 0) {
            $departments = HospitalDepartment::where('hospital_id', $hospitalId)
                ->orderBy('name')
                ->get(['id', 'name']);

            return $this->ok(['departments' => $departments]);
        }

        $hospitals = Hospital::orderBy('name')->get(['id', 'name', 'city']);

        return $this->ok(['hospitals' => $hospitals]);
    }
}
