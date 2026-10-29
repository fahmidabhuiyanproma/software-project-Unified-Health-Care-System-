<?php

namespace App\Services;

use App\Models\Appointment;

/** Ports api/_slots.php — the fixed appointment/lab time-slot list and availability lookup. */
class SlotService
{
    public const TIME_SLOTS = [
        '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM',
        '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM',
    ];

    /** @return array<int, array{time: string, available: bool}> */
    public static function forDoctorAndDate(int $doctorId, string $date): array
    {
        $booked = Appointment::where('doctor_id', $doctorId)
            ->where('appointment_date', $date)
            ->whereIn('status', ['confirmed', 'pending'])
            ->pluck('appointment_time')
            ->all();

        return array_map(
            fn (string $time) => ['time' => $time, 'available' => ! in_array($time, $booked, true)],
            self::TIME_SLOTS
        );
    }

    /** MySQL FIELD(...) expression to order rows by the fixed slot list, same as the old dashboard query. */
    public static function orderByExpression(string $column = 'appointment_time'): string
    {
        $list = implode("', '", self::TIME_SLOTS);

        return "FIELD({$column}, '{$list}')";
    }
}
