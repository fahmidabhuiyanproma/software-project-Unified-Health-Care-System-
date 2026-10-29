<?php
/**
 * GET /api/patient/doctors.php?q=&specialty=&available_only=1
 * Search/filter the doctor directory (FR-2.2). "Available today" means
 * the doctor has at least one open slot today per their weekly schedule.
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_slots.php';

requireRole(['patient']);
$db = getDb();

$q = trim((string) ($_GET['q'] ?? ''));
$specialty = trim((string) ($_GET['specialty'] ?? ''));
$availableOnly = !empty($_GET['available_only']);

$sql = 'SELECT d.id, d.full_name, d.specialty, d.experience_years, d.consultation_fee, d.photo_url,
               h.name AS hospital_name, h.city AS hospital_city
        FROM doctors d
        LEFT JOIN hospitals h ON h.id = d.hospital_id
        WHERE d.status = "active"';
$params = [];

if ($q !== '') {
    $sql .= ' AND (d.full_name LIKE :q OR h.name LIKE :q2)';
    $params[':q'] = "%$q%";
    $params[':q2'] = "%$q%";
}
if ($specialty !== '' && $specialty !== 'All Specialties') {
    $sql .= ' AND d.specialty = :specialty';
    $params[':specialty'] = $specialty;
}
$sql .= ' ORDER BY d.full_name';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$today = date('Y-m-d');
$todayWeekday = (int) date('w');

$doctors = [];
foreach ($rows as $d) {
    $availStmt = $db->prepare('SELECT is_available FROM doctor_weekly_availability WHERE doctor_id = :id AND weekday = :wd');
    $availStmt->execute([':id' => $d['id'], ':wd' => $todayWeekday]);
    $weeklyRow = $availStmt->fetch();
    $worksToday = $weeklyRow === false ? true : (bool) $weeklyRow['is_available'];

    $availableToday = false;
    if ($worksToday) {
        foreach (doctorSlotsForDate($db, (int) $d['id'], $today) as $slot) {
            if ($slot['available']) { $availableToday = true; break; }
        }
    }

    if ($availableOnly && !$availableToday) continue;

    $doctors[] = [
        'id' => (int) $d['id'],
        'name' => $d['full_name'],
        'specialty' => $d['specialty'],
        'hospital' => $d['hospital_name'] ?? 'Independent Practice',
        'location' => $d['hospital_city'] ? ($d['hospital_city']) : '',
        'exp' => $d['experience_years'] . ' yrs',
        'fee' => '৳ ' . number_format((float) $d['consultation_fee']),
        'available' => $availableToday,
        'img' => $d['photo_url'] ?: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&h=200&fit=crop&auto=format',
        'rating' => 4.8,
        'reviews' => 0,
    ];
}

respond(['success' => true, 'doctors' => $doctors]);
