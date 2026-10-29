<?php
/** GET /api/lab-admin/dashboard.php — recent bookings for this lab. */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['lab']);
$db = getDb();
$lab = requireOwnedProvider($db, 'labs');

$stmt = $db->prepare(
    'SELECT
        COUNT(CASE WHEN b.booking_date = CURDATE() THEN 1 END) AS bookings_today,
        COUNT(CASE WHEN b.booking_date = CURDATE() AND b.status = "pending" THEN 1 END) AS bookings_today_pending,
        COUNT(CASE WHEN b.status = "ready" AND DATE(r.uploaded_at) = CURDATE() THEN 1 END) AS results_ready_today,
        COUNT(CASE WHEN b.status <> "ready" THEN 1 END) AS pending_upload
     FROM lab_bookings b
     LEFT JOIN lab_results r ON r.booking_id = b.id
     WHERE b.lab_id = :lid'
);
$stmt->execute([':lid' => $lab['id']]);
$stats = $stmt->fetch();

$stmt = $db->prepare(
    'SELECT b.id, b.status, b.booking_time, u.full_name AS patient_name, t.name AS test_name
     FROM lab_bookings b JOIN users u ON u.id = b.patient_id JOIN lab_tests t ON t.id = b.test_id
     WHERE b.lab_id = :lid ORDER BY b.id DESC LIMIT 10'
);
$stmt->execute([':lid' => $lab['id']]);

$bookings = array_map(function (array $b): array {
    return ['id' => (int) $b['id'], 'patient' => $b['patient_name'], 'test' => $b['test_name'], 'time' => $b['booking_time'], 'status' => $b['status']];
}, $stmt->fetchAll());

respond([
    'success' => true,
    'lab' => [
        'name' => $lab['name'],
        'location' => trim(implode(', ', array_filter([$lab['address'] ?? null, $lab['city'] ?? null]))) ?: null,
    ],
    'recentBookings' => $bookings,
    'stats' => [
        'bookingsToday' => (int) $stats['bookings_today'],
        'bookingsTodayPending' => (int) $stats['bookings_today_pending'],
        'resultsReadyToday' => (int) $stats['results_ready_today'],
        'pendingUpload' => (int) $stats['pending_upload'],
    ],
]);
