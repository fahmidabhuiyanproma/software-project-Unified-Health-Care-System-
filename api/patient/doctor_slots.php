<?php
/** GET /api/patient/doctor_slots.php?doctor_id=&date=YYYY-MM-DD — open slots for a specific date. */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/../_slots.php';

requireRole(['patient']);
$db = getDb();

$doctorId = (int) ($_GET['doctor_id'] ?? 0);
$date = (string) ($_GET['date'] ?? '');

if ($doctorId <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    respond(['success' => false, 'message' => 'doctor_id and date are required.'], 422);
}

respond(['success' => true, 'slots' => doctorSlotsForDate($db, $doctorId, $date)]);
