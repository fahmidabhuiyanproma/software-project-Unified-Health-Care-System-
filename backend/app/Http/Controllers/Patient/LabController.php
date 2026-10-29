<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Lab;
use App\Models\LabBooking;
use App\Models\LabTest;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Ports api/patient/labs.php, lab_tests.php, lab_book.php, lab_results.php, lab_result_file.php (FR-6.3). */
class LabController extends Controller
{
    use ApiResponse;

    public function labs(): JsonResponse
    {
        $labs = Lab::orderBy('name')->get()->map(fn (Lab $l) => [
            'id' => $l->id,
            'name' => $l->name.($l->city ? ', '.$l->city : ''),
        ]);

        return $this->ok(['labs' => $labs]);
    }

    public function tests(): JsonResponse
    {
        $tests = LabTest::where('is_active', true)->orderBy('name')->get()->map(fn (LabTest $t) => [
            'id' => $t->id,
            'lab_id' => $t->lab_id,
            'name' => $t->name,
            'category' => $t->category,
            'desc' => $t->description,
            'price' => (float) $t->price,
            'turnaround' => $t->turnaround_text,
        ]);

        return $this->ok(['tests' => $tests]);
    }

    public function book(Request $request): JsonResponse
    {
        $patientId = $request->user()->id;

        $testId = (int) $request->input('test_id', 0);
        $date = (string) $request->input('date', '');
        $time = trim((string) $request->input('time', ''));

        if ($testId <= 0 || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $time === '') {
            return $this->fail('Test, date, and time are required.', 422);
        }

        $test = LabTest::where('id', $testId)->where('is_active', true)->first();
        if (! $test) {
            return $this->fail('Test not found for the selected lab.', 404);
        }

        $booking = LabBooking::create([
            'patient_id' => $patientId,
            'lab_id' => $test->lab_id,
            'test_id' => $testId,
            'booking_date' => $date,
            'booking_time' => $time,
            'fee' => $test->price,
        ]);

        NotificationService::send($patientId, 'flask-conical', 'Lab Test Booked', "{$test->name} booked for {$date} at {$time}. Fee payable at the lab.");

        $labOwnerId = Lab::where('id', $test->lab_id)->value('owner_user_id');
        if ($labOwnerId) {
            $patientName = $request->user()->full_name ?: 'A patient';
            NotificationService::send((int) $labOwnerId, 'flask-conical', 'New Lab Booking', "{$patientName} booked {$test->name} for {$date} at {$time}.");
        }

        return $this->ok(['booking_id' => $booking->id, 'message' => 'Lab test booked successfully.']);
    }

    public function results(Request $request): JsonResponse
    {
        $patientId = $request->user()->id;

        $results = LabBooking::with(['test', 'lab', 'result'])
            ->where('patient_id', $patientId)
            ->orderByDesc('booking_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (LabBooking $b) => [
                'id' => $b->id,
                'test' => $b->test->name,
                'lab' => $b->lab->name,
                'date' => $b->booking_date->toDateString(),
                'status' => $b->status,
                'result' => $b->result?->result_summary,
                'file' => $b->result?->file_path !== null,
            ]);

        return $this->ok(['results' => $results]);
    }

    public function resultFile(Request $request, int $booking): BinaryFileResponse|JsonResponse
    {
        $patientId = $request->user()->id;

        $labBooking = LabBooking::with('result')->where('id', $booking)->where('patient_id', $patientId)->first();
        if (! $labBooking || ! $labBooking->result || ! $labBooking->result->file_path) {
            return $this->fail('Report not found.', 404);
        }

        $path = dirname(base_path()).'/uploads/'.basename($labBooking->result->file_path);
        if (! is_file($path)) {
            return $this->fail('Report file is missing on the server.', 404);
        }

        return response()->file($path, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'inline; filename="'.basename($path).'"']);
    }
}
