<?php

namespace App\Http\Controllers\HospitalAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresOwnedProvider;
use App\Http\Controllers\Controller;
use App\Models\BedBooking;
use App\Models\Hospital;
use App\Services\BedService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ports api/hospital-admin/beds.php.
 * approve   pending  -> approved   (patient admitted; bed stays taken)
 * reject    pending  -> rejected   (bed released)
 * discharge approved -> discharged (bed released)
 */
class BedController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    public function index(Request $request): JsonResponse
    {
        $hospital = $this->ownedProviderOrFail($request->user(), Hospital::class);
        if ($hospital instanceof JsonResponse) {
            return $hospital;
        }

        $requests = BedBooking::with(['patient', 'department'])
            ->where('hospital_id', $hospital->id)
            ->orderByRaw('(status = "pending") DESC')
            ->orderByRaw('(status = "approved") DESC')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (BedBooking $b) => [
                'id' => $b->id,
                'patient' => $b->patient->full_name,
                'patientPhone' => $b->patient->phone,
                'attendantPhone' => $b->attendant_phone,
                'department' => $b->department->name,
                'date' => $b->admission_date->toDateString(),
                'reason' => $b->reason,
                'notes' => $b->notes,
                'status' => $b->status,
                'rejectionReason' => $b->rejection_reason,
                'requestedAt' => optional($b->created_at)->toIso8601String(),
            ]);

        return $this->ok([
            'departments' => BedService::summaryForHospital($hospital->id),
            'requests' => $requests,
        ]);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        return $this->decide($request, $id, 'approve');
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        return $this->decide($request, $id, 'reject');
    }

    public function discharge(Request $request, int $id): JsonResponse
    {
        return $this->decide($request, $id, 'discharge');
    }

    private function decide(Request $request, int $id, string $decision): JsonResponse
    {
        $hospital = $this->ownedProviderOrFail($request->user(), Hospital::class);
        if ($hospital instanceof JsonResponse) {
            return $hospital;
        }

        $reason = trim((string) $request->input('reason', ''));
        if (mb_strlen($reason) > 255) {
            return $this->fail('The reason is too long (255 characters max).', 422);
        }

        $booking = BedBooking::with('department')->where('id', $id)->where('hospital_id', $hospital->id)->first();
        if (! $booking) {
            return $this->fail('Bed request not found.', 404);
        }

        $required = $decision === 'discharge' ? 'approved' : 'pending';
        if ($booking->status !== $required) {
            return $this->fail("This request has already been {$booking->status}.", 409);
        }

        $patientId = (int) $booking->patient_id;
        $where = "{$booking->department->name} bed on {$booking->admission_date->toDateString()}";

        if ($decision === 'approve') {
            $booking->update(['status' => 'approved', 'decided_at' => now()]);
            NotificationService::send($patientId, 'bed-double', 'Bed Request Approved', "{$hospital->name} approved your {$where}. Please arrive on the admission date.");

            return $this->ok(['message' => 'Bed request approved.']);
        }

        if ($decision === 'reject') {
            $booking->update(['status' => 'rejected', 'decided_at' => now(), 'rejection_reason' => $reason !== '' ? $reason : null]);
            NotificationService::send($patientId, 'x-circle', 'Bed Request Declined', "{$hospital->name} could not accept your {$where}.".($reason !== '' ? " Reason: {$reason}" : ''));

            return $this->ok(['message' => 'Bed request declined.']);
        }

        $booking->update(['status' => 'discharged', 'decided_at' => now()]);
        NotificationService::send($patientId, 'bed-double', 'Discharged', "{$hospital->name} recorded your discharge from {$booking->department->name}.");

        return $this->ok(['message' => 'Patient discharged — the bed is free again.']);
    }
}
