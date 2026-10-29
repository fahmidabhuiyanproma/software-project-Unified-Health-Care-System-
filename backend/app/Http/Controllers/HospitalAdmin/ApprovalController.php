<?php

namespace App\Http\Controllers\HospitalAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresOwnedProvider;
use App\Http\Controllers\Controller;
use App\Models\Doctor;
use App\Models\DoctorWeeklyAvailability;
use App\Models\Hospital;
use App\Models\ProviderApplication;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Ports api/hospital-admin/approvals.php — doctor applications submitted to
 * this hospital. Approving creates the doctor's directory profile (linked to
 * this hospital + the department they applied to) and activates their login.
 */
class ApprovalController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    private const STATUS_MAP = ['pending' => 'pending', 'approved' => 'confirmed', 'rejected' => 'cancelled'];

    public function index(Request $request): JsonResponse
    {
        $hospital = $this->ownedProviderOrFail($request->user(), Hospital::class);
        if ($hospital instanceof JsonResponse) {
            return $hospital;
        }

        $applications = ProviderApplication::with(['user', 'department'])
            ->where('hospital_id', $hospital->id)
            ->whereHas('user', fn ($q) => $q->where('role', 'doctor'))
            ->orderByRaw('(review_status = "pending") DESC')
            ->orderByDesc('submitted_at')
            ->get()
            ->map(fn (ProviderApplication $a) => [
                'id' => $a->id,
                'name' => $a->user->full_name,
                'contact' => $a->user->phone,
                'email' => $a->user->email,
                'regNo' => $a->license_number,
                'dept' => $a->department?->name ?? 'Unassigned',
                'submitted' => $a->submitted_at->format('M j, Y'),
                'status' => self::STATUS_MAP[$a->review_status],
            ]);

        return $this->ok(['applications' => $applications]);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        return $this->decide($request, $id, 'approve');
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        return $this->decide($request, $id, 'reject');
    }

    private function decide(Request $request, int $id, string $decision): JsonResponse
    {
        $hospital = $this->ownedProviderOrFail($request->user(), Hospital::class);
        if ($hospital instanceof JsonResponse) {
            return $hospital;
        }

        $reason = trim((string) $request->input('reason', ''));

        $app = ProviderApplication::with('user')
            ->where('id', $id)
            ->where('hospital_id', $hospital->id)
            ->whereHas('user', fn ($q) => $q->where('role', 'doctor'))
            ->first();
        if (! $app) {
            return $this->fail('Application not found.', 404);
        }
        if ($app->review_status !== 'pending') {
            return $this->fail('This application has already been reviewed.', 409);
        }

        try {
            DB::transaction(function () use ($app, $hospital, $decision, $reason) {
                if ($decision === 'approve') {
                    $app->update([
                        'review_status' => 'approved',
                        'reviewed_by_user_id' => $hospital->owner_user_id,
                        'reviewed_at' => now(),
                    ]);
                    User::where('id', $app->user_id)->update(['status' => 'active']);

                    $doctor = Doctor::create([
                        'user_id' => $app->user_id,
                        'hospital_id' => $hospital->id,
                        'department_id' => $app->department_id,
                        'full_name' => $app->user->full_name,
                        'specialty' => 'General Physician',
                        'qualification' => 'BMDC Reg. No: '.$app->license_number,
                        'consultation_fee' => 500,
                        'status' => 'active',
                    ]);

                    foreach (range(0, 4) as $weekday) {
                        DoctorWeeklyAvailability::create(['doctor_id' => $doctor->id, 'weekday' => $weekday, 'is_available' => true]);
                    }

                    return;
                }

                $app->update([
                    'review_status' => 'rejected',
                    'reviewed_by_user_id' => $hospital->owner_user_id,
                    'reviewed_at' => now(),
                    'rejection_reason' => $reason !== '' ? $reason : null,
                ]);
                User::where('id', $app->user_id)->update(['status' => 'rejected']);
            });
        } catch (\Throwable $e) {
            return $this->fail('Could not process this decision.', 500);
        }

        if ($decision === 'approve') {
            NotificationService::send((int) $app->user_id, 'user-check', 'Doctor Account Approved', "{$hospital->name} approved your doctor account. You can now sign in to the Doctor Portal.");

            return $this->ok(['message' => 'Doctor approved.']);
        }

        NotificationService::send((int) $app->user_id, 'x-circle', 'Application Declined', "{$hospital->name} declined your doctor application.".($reason !== '' ? " Reason: {$reason}" : ''));

        return $this->ok(['message' => 'Application declined.']);
    }
}
