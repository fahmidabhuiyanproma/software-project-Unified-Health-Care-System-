<?php

namespace App\Http\Controllers\SystemAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Doctor;
use App\Models\DoctorWeeklyAvailability;
use App\Models\Hospital;
use App\Models\Lab;
use App\Models\Pharmacy;
use App\Models\ProviderApplication;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Ports api/system-admin/approvals.php (FR-1.2). Approving a hospital/lab/
 * pharmacy application creates that provider's organization row, owned by
 * the applicant. Doctor applications tied to a hospital belong to that
 * hospital to review (HospitalAdmin\ApprovalController); the doctor branch
 * here only still fires for legacy applications with no hospital_id.
 */
class ApprovalController extends Controller
{
    use ApiResponse;

    private const ORG_MODELS = ['hospital' => Hospital::class, 'lab' => Lab::class, 'pharmacy' => Pharmacy::class];
    private const STATUS_MAP = ['pending' => 'pending', 'approved' => 'confirmed', 'rejected' => 'cancelled'];

    public function index(): JsonResponse
    {
        $providers = ProviderApplication::with('user')
            ->whereHas('user', fn ($q) => $q->where('role', '<>', 'doctor'))
            ->orWhereNull('hospital_id')
            ->orderByRaw('(review_status = "pending") DESC')
            ->orderByDesc('submitted_at')
            ->get()
            ->map(fn (ProviderApplication $p) => [
                'id' => $p->id,
                'name' => $p->user->full_name,
                'type' => ucfirst($p->user->role),
                'contact' => $p->user->phone,
                'email' => $p->user->email,
                'regNo' => $p->license_number,
                'submitted' => $p->submitted_at->format('M j, Y'),
                'status' => self::STATUS_MAP[$p->review_status],
            ]);

        return $this->ok(['providers' => $providers]);
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
        $adminId = $request->user()->id;
        $reason = trim((string) $request->input('reason', ''));

        $app = ProviderApplication::with('user')->where('id', $id)->first();
        if (! $app) {
            return $this->fail('Application not found.', 404);
        }
        if ($app->user->role === 'doctor' && $app->hospital_id !== null) {
            return $this->fail('This doctor application is managed by their selected hospital.', 403);
        }
        if ($app->review_status !== 'pending') {
            return $this->fail('This application has already been reviewed.', 409);
        }

        try {
            DB::transaction(function () use ($app, $adminId, $decision, $reason) {
                if ($decision === 'approve') {
                    $app->update(['review_status' => 'approved', 'reviewed_by_user_id' => $adminId, 'reviewed_at' => now()]);
                    User::where('id', $app->user_id)->update(['status' => 'active']);

                    $role = $app->user->role;
                    if (isset(self::ORG_MODELS[$role])) {
                        $data = ['owner_user_id' => $app->user_id, 'name' => $app->user->full_name, 'phone' => $app->user->phone];
                        if ($role === 'hospital') {
                            $data['registration_no'] = $app->license_number;
                        }
                        self::ORG_MODELS[$role]::create($data);
                    } elseif ($role === 'doctor') {
                        $doctor = Doctor::create([
                            'user_id' => $app->user_id,
                            'full_name' => $app->user->full_name,
                            'specialty' => 'General Physician',
                            'qualification' => 'BMDC Reg. No: '.$app->license_number,
                            'consultation_fee' => 500,
                            'status' => 'active',
                        ]);
                        foreach (range(0, 4) as $weekday) {
                            DoctorWeeklyAvailability::create(['doctor_id' => $doctor->id, 'weekday' => $weekday, 'is_available' => true]);
                        }
                    }

                    return;
                }

                $app->update([
                    'review_status' => 'rejected',
                    'reviewed_by_user_id' => $adminId,
                    'reviewed_at' => now(),
                    'rejection_reason' => $reason !== '' ? $reason : null,
                ]);
                User::where('id', $app->user_id)->update(['status' => 'rejected']);
            });
        } catch (\Throwable $e) {
            return $this->fail('Could not process this decision.', 500);
        }

        if ($decision === 'approve') {
            NotificationService::send((int) $app->user_id, 'user-check', 'Provider Account Approved', "Congratulations! Your {$app->user->role} account has been approved by the SynCura admin team.");

            return $this->ok(['message' => 'Application approved.']);
        }

        NotificationService::send((int) $app->user_id, 'x-circle', 'Application Rejected', 'Your provider application was not approved.'.($reason !== '' ? " Reason: {$reason}" : ''));

        return $this->ok(['message' => 'Application rejected.']);
    }
}
