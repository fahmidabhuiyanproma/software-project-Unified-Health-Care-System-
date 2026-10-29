<?php

namespace App\Http\Controllers\LabAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresOwnedProvider;
use App\Http\Controllers\Controller;
use App\Models\Lab;
use App\Models\LabBooking;
use App\Models\LabResult;
use App\Models\MedicalRecord;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Ports api/lab-admin/bookings.php. Publishing a result moves the booking to
 * "ready", stores the result (+ optional PDF, validated by real mime-type
 * sniffing, not just extension), logs it into the patient's unified medical
 * record (FR-4.1), and notifies the patient.
 */
class BookingController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    public function index(Request $request): JsonResponse
    {
        $lab = $this->ownedProviderOrFail($request->user(), Lab::class);
        if ($lab instanceof JsonResponse) {
            return $lab;
        }

        $bookings = LabBooking::with(['patient', 'test'])
            ->where('lab_id', $lab->id)
            ->orderByDesc('booking_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (LabBooking $b) => [
                'id' => $b->id,
                'patient' => $b->patient->full_name,
                'test' => $b->test->name,
                'date' => $b->booking_date->toDateString(),
                'time' => $b->booking_time,
                'fee' => '৳ '.number_format((float) $b->fee),
                'status' => $b->status,
            ]);

        return $this->ok(['bookings' => $bookings]);
    }

    public function publish(Request $request): JsonResponse
    {
        $lab = $this->ownedProviderOrFail($request->user(), Lab::class);
        if ($lab instanceof JsonResponse) {
            return $lab;
        }

        $bookingId = (int) $request->input('booking_id', 0);
        $resultSummary = trim((string) $request->input('result_summary', ''));

        if ($bookingId <= 0 || $resultSummary === '') {
            return $this->fail('Booking and result summary are required.', 422);
        }

        $booking = LabBooking::with('test')->where('id', $bookingId)->where('lab_id', $lab->id)->first();
        if (! $booking) {
            return $this->fail('Booking not found.', 404);
        }

        $storedFileName = null;
        if ($request->hasFile('report')) {
            $file = $request->file('report');
            if (! $file->isValid()) {
                return $this->fail('File upload failed.', 422);
            }
            if ($file->getSize() > 10 * 1024 * 1024) {
                return $this->fail('File must be 10MB or smaller.', 422);
            }
            if ($file->getMimeType() !== 'application/pdf') {
                return $this->fail('Only PDF reports can be uploaded.', 422);
            }

            $uploadDir = dirname(base_path()).'/uploads';
            if (! is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            $storedFileName = 'lab_'.$bookingId.'_'.bin2hex(random_bytes(6)).'.pdf';
            try {
                $file->move($uploadDir, $storedFileName);
            } catch (\Throwable $e) {
                return $this->fail('Could not save the uploaded file.', 500);
            }
        }

        try {
            DB::transaction(function () use ($booking, $bookingId, $resultSummary, $storedFileName) {
                DB::table('lab_results')->updateOrInsert(
                    ['booking_id' => $bookingId],
                    ['result_summary' => $resultSummary, 'file_path' => $storedFileName]
                );

                LabBooking::where('id', $bookingId)->update(['status' => 'ready']);

                MedicalRecord::create([
                    'patient_id' => $booking->patient_id,
                    'record_type' => 'lab',
                    'title' => $booking->test->name.' — Lab Result',
                    'description' => $resultSummary,
                    'visit_date' => $booking->booking_date,
                ]);
            });
        } catch (\Throwable $e) {
            return $this->fail('Could not publish result.', 500);
        }

        NotificationService::send((int) $booking->patient_id, 'flask-conical', 'Lab Result Ready', "Your {$booking->test->name} result is now available.");

        return $this->ok(['message' => 'Result published.']);
    }
}
