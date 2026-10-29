<?php

namespace App\Http\Controllers\LabAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresOwnedProvider;
use App\Http\Controllers\Controller;
use App\Models\Lab;
use App\Models\LabBooking;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Ports api/lab-admin/dashboard.php. */
class DashboardController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    public function index(Request $request): JsonResponse
    {
        $lab = $this->ownedProviderOrFail($request->user(), Lab::class);
        if ($lab instanceof JsonResponse) {
            return $lab;
        }

        $stats = DB::table('lab_bookings as b')
            ->leftJoin('lab_results as r', 'r.booking_id', '=', 'b.id')
            ->where('b.lab_id', $lab->id)
            ->selectRaw('
                COUNT(CASE WHEN b.booking_date = CURDATE() THEN 1 END) as bookings_today,
                COUNT(CASE WHEN b.booking_date = CURDATE() AND b.status = "pending" THEN 1 END) as bookings_today_pending,
                COUNT(CASE WHEN b.status = "ready" AND DATE(r.uploaded_at) = CURDATE() THEN 1 END) as results_ready_today,
                COUNT(CASE WHEN b.status <> "ready" THEN 1 END) as pending_upload
            ')
            ->first();

        $bookings = LabBooking::with(['patient', 'test'])
            ->where('lab_id', $lab->id)
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (LabBooking $b) => [
                'id' => $b->id,
                'patient' => $b->patient->full_name,
                'test' => $b->test->name,
                'time' => $b->booking_time,
                'status' => $b->status,
            ]);

        return $this->ok([
            'lab' => [
                'name' => $lab->name,
                'location' => trim(implode(', ', array_filter([$lab->address, $lab->city]))) ?: null,
            ],
            'recentBookings' => $bookings,
            'stats' => [
                'bookingsToday' => (int) $stats->bookings_today,
                'bookingsTodayPending' => (int) $stats->bookings_today_pending,
                'resultsReadyToday' => (int) $stats->results_ready_today,
                'pendingUpload' => (int) $stats->pending_upload,
            ],
        ]);
    }
}
