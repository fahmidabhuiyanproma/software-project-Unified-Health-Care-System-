<?php

namespace App\Http\Controllers\SystemAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Hospital;
use App\Models\Lab;
use App\Models\LabBooking;
use App\Models\LoginLog;
use App\Models\Pharmacy;
use App\Models\PharmacyOrder;
use App\Models\ProviderApplication;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Ports api/system-admin/dashboard.php. */
class DashboardController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $today = Carbon::today()->toDateString();

        // Doctor applications tied to a hospital are that hospital's to review, not the admin's.
        $baseQuery = fn () => ProviderApplication::where('review_status', 'pending')
            ->where(function ($q) {
                $q->whereHas('user', fn ($u) => $u->where('role', '<>', 'doctor'))
                    ->orWhereNull('hospital_id');
            });

        $pending = $baseQuery()->with('user')
            ->orderBy('submitted_at')
            ->limit(5)
            ->get()
            ->map(fn (ProviderApplication $a) => [
                'id' => $a->id,
                'name' => $a->user->full_name,
                'type' => ucfirst($a->user->role),
                'submitted' => $a->submitted_at->format('M j, Y'),
            ]);

        $pendingCount = $baseQuery()->count();

        $totalUsers = User::count();
        $hospitalsCount = Hospital::count();
        $labsCount = Lab::count();
        $pharmaciesTotal = User::where('role', 'pharmacy')->count();
        $pharmaciesActive = Pharmacy::count();
        $doctorsCount = Doctor::count();
        $hospitalsTotal = User::where('role', 'hospital')->count();
        $labsTotal = User::where('role', 'lab')->count();

        $activity = [
            ['label' => 'Appointments Today', 'value' => Appointment::where('appointment_date', $today)->count()],
            ['label' => 'Successful Logins Today', 'value' => LoginLog::where('status', 'success')->whereDate('attempted_at', $today)->count()],
            ['label' => 'Medicine Orders Today', 'value' => PharmacyOrder::whereDate('created_at', $today)->count()],
            ['label' => 'Lab Bookings Today', 'value' => LabBooking::where('booking_date', $today)->count()],
        ];

        $breakdown = [
            ['label' => 'Hospitals / Clinics', 'value' => $hospitalsCount, 'total' => max($hospitalsTotal, 1)],
            ['label' => 'Diagnostic Labs', 'value' => $labsCount, 'total' => max($labsTotal, 1)],
            ['label' => 'Doctors', 'value' => $doctorsCount, 'total' => max($doctorsCount, 1)],
            ['label' => 'Pharmacies', 'value' => $pharmaciesActive, 'total' => max($pharmaciesTotal, 1)],
        ];

        return $this->ok([
            'pendingProviders' => $pending,
            'pendingCount' => $pendingCount,
            'stats' => [
                'totalUsers' => $totalUsers,
                'hospitals' => $hospitalsCount,
                'labs' => $labsCount,
            ],
            'activity' => $activity,
            'providerBreakdown' => $breakdown,
        ]);
    }
}
