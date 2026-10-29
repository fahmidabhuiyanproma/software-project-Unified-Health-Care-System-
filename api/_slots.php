<?php
/**
 * Shared fixed appointment/lab time-slot list, and the query that turns
 * it into an availability list for a given doctor + date by subtracting
 * whatever is already booked in `appointments`.
 */

declare(strict_types=1);

const TIME_SLOTS = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM'];

/** @return array<int, array{time: string, available: bool}> */
function doctorSlotsForDate(PDO $db, int $doctorId, string $date): array {
    $stmt = $db->prepare('SELECT appointment_time FROM appointments WHERE doctor_id = :did AND appointment_date = :date AND status IN ("confirmed", "pending")');
    $stmt->execute([':did' => $doctorId, ':date' => $date]);
    $booked = $stmt->fetchAll(PDO::FETCH_COLUMN);

    return array_map(function (string $time) use ($booked): array {
        return ['time' => $time, 'available' => !in_array($time, $booked, true)];
    }, TIME_SLOTS);
}
