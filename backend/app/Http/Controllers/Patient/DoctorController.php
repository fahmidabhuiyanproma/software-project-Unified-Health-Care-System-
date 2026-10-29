<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Doctor;
use App\Models\DoctorWeeklyAvailability;
use App\Services\SlotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Ports api/patient/doctors.php, doctor_detail.php, doctor_slots.php (FR-2.2). */
class DoctorController extends Controller
{
    use ApiResponse;

    private const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&h=200&fit=crop&auto=format';

    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $specialty = trim((string) $request->query('specialty', ''));
        $availableOnly = $request->boolean('available_only');

        $query = Doctor::with('hospital')->where('status', 'active');

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('full_name', 'like', "%{$q}%")
                    ->orWhereHas('hospital', fn ($h) => $h->where('name', 'like', "%{$q}%"));
            });
        }
        if ($specialty !== '' && $specialty !== 'All Specialties') {
            $query->where('specialty', $specialty);
        }

        $today = Carbon::today()->toDateString();
        $todayWeekday = (int) Carbon::today()->dayOfWeek;

        $doctors = [];
        foreach ($query->orderBy('full_name')->get() as $d) {
            $weeklyRow = DoctorWeeklyAvailability::where('doctor_id', $d->id)->where('weekday', $todayWeekday)->first();
            $worksToday = $weeklyRow === null ? true : (bool) $weeklyRow->is_available;

            $availableToday = false;
            if ($worksToday) {
                foreach (SlotService::forDoctorAndDate($d->id, $today) as $slot) {
                    if ($slot['available']) {
                        $availableToday = true;
                        break;
                    }
                }
            }

            if ($availableOnly && ! $availableToday) {
                continue;
            }

            $doctors[] = [
                'id' => $d->id,
                'name' => $d->full_name,
                'specialty' => $d->specialty,
                'hospital' => $d->hospital->name ?? 'Independent Practice',
                'location' => $d->hospital->city ?? '',
                'exp' => $d->experience_years.' yrs',
                'fee' => '৳ '.number_format((float) $d->consultation_fee),
                'available' => $availableToday,
                'img' => $d->photo_url ?: self::PLACEHOLDER_IMG,
                'rating' => 4.8,
                'reviews' => 0,
            ];
        }

        return $this->ok(['doctors' => $doctors]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $d = Doctor::with('hospital')->where('id', $id)->where('status', 'active')->first();
        if (! $d) {
            return $this->fail('Doctor not found.', 404);
        }

        $weekly = array_fill(0, 7, true);
        foreach (DoctorWeeklyAvailability::where('doctor_id', $id)->get() as $row) {
            $weekly[(int) $row->weekday] = (bool) $row->is_available;
        }

        $hospitalAddress = $d->hospital->address ?? '';
        $hospitalCity = $d->hospital->city ?? '';
        $location = trim($hospitalAddress.($hospitalAddress && $hospitalCity ? ', ' : '').$hospitalCity);

        $today = Carbon::today()->toDateString();

        return $this->ok(['doctor' => [
            'id' => $d->id,
            'name' => $d->full_name,
            'specialty' => $d->specialty,
            'hospital' => $d->hospital->name ?? 'Independent Practice',
            'location' => $location,
            'exp' => $d->experience_years.' yrs',
            'fee' => '৳ '.number_format((float) $d->consultation_fee),
            'feeAmount' => (float) $d->consultation_fee,
            'bio' => $d->bio ?: 'No biography provided yet.',
            'qualification' => $d->qualification ?: '',
            'img' => $d->photo_url ?: self::PLACEHOLDER_IMG,
            'weeklyAvailability' => $weekly,
            'todaySlots' => SlotService::forDoctorAndDate($id, $today),
        ]]);
    }

    public function slots(Request $request, int $id): JsonResponse
    {
        $date = (string) $request->query('date', '');
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return $this->fail('doctor_id and date are required.', 422);
        }

        return $this->ok(['slots' => SlotService::forDoctorAndDate($id, $date)]);
    }
}
