<?php
/**
 * Shared bed-availability rules for bed_bookings.
 *
 * A department's total beds are hospital_departments.bed_count. A bed is taken
 * by a booking that is 'pending' (reserved while the hospital decides) or
 * 'approved' (patient admitted). Rejected / cancelled / discharged bookings
 * give the bed back. Free beds = total - taken; at 0 the department is closed.
 */

declare(strict_types=1);

/**
 * Every department of a hospital with its live bed numbers.
 * @return array<int, array{id:int, name:string, total:int, pending:int, approved:int, booked:int, available:int, open:bool}>
 */
function hospitalBedSummary(PDO $db, int $hospitalId): array {
    $stmt = $db->prepare(
        "SELECT hd.id, hd.name, hd.bed_count AS total,
                COALESCE(SUM(b.status = 'pending'), 0) AS pending,
                COALESCE(SUM(b.status = 'approved'), 0) AS approved
         FROM hospital_departments hd
         LEFT JOIN bed_bookings b ON b.department_id = hd.id AND b.status IN ('pending', 'approved')
         WHERE hd.hospital_id = :hid
         GROUP BY hd.id, hd.name, hd.bed_count
         ORDER BY hd.name"
    );
    $stmt->execute([':hid' => $hospitalId]);

    return array_map(function (array $d): array {
        $total = (int) $d['total'];
        $pending = (int) $d['pending'];
        $approved = (int) $d['approved'];
        $booked = $pending + $approved;
        $available = max(0, $total - $booked);
        return [
            'id' => (int) $d['id'], 'name' => $d['name'], 'total' => $total,
            'pending' => $pending, 'approved' => $approved, 'booked' => $booked,
            'available' => $available, 'open' => $available > 0,
        ];
    }, $stmt->fetchAll());
}
