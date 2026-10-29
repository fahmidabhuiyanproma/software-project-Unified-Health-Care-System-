<?php
/**
 * GET /api/patient/doctor_detail.php?id=  — doctor profile + this week's
 * weekday availability (used to build the 6-day date strip client-side).
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_slots.php';

requireRole(['patient']);
$db = getDb();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    respond(['success' => false, 'message' => 'Doctor id is required.'], 422);
}

$stmt = $db->prepare('SELECT d.*, h.name AS hospital_name, h.city AS hospital_city, h.address AS hospital_address
                       FROM doctors d LEFT JOIN hospitals h ON h.id = d.hospital_id
                       WHERE d.id = :id AND d.status = "active"');
$stmt->execute([':id' => $id]);
$d = $stmt->fetch();
if (!$d) {
    respond(['success' => false, 'message' => 'Doctor not found.'], 404);
}

$availStmt = $db->prepare('SELECT weekday, is_available FROM doctor_weekly_availability WHERE doctor_id = :id');
$availStmt->execute([':id' => $id]);
$weekly = array_fill(0, 7, true);
foreach ($availStmt->fetchAll() as $row) {
    $weekly[(int) $row['weekday']] = (bool) $row['is_available'];
}

$today = date('Y-m-d');
respond(['success' => true, 'doctor' => [
    'id' => (int) $d['id'],
    'name' => $d['full_name'],
    'specialty' => $d['specialty'],
    'hospital' => $d['hospital_name'] ?? 'Independent Practice',
    'location' => trim(($d['hospital_address'] ?? '') . ($d['hospital_address'] && $d['hospital_city'] ? ', ' : '') . ($d['hospital_city'] ?? '')),
    'exp' => $d['experience_years'] . ' yrs',
    'fee' => '৳ ' . number_format((float) $d['consultation_fee']),
    'feeAmount' => (float) $d['consultation_fee'],
    'bio' => $d['bio'] ?: 'No biography provided yet.',
    'qualification' => $d['qualification'] ?: '',
    'img' => $d['photo_url'] ?: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&h=200&fit=crop&auto=format',
    'weeklyAvailability' => $weekly,
    'todaySlots' => doctorSlotsForDate($db, $id, $today),
]]);
