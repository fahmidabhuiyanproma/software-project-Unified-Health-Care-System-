<?php
/** GET /api/system-admin/dashboard.php — platform overview (FR: System Admin monitors platform usage). */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['admin']);
$db = getDb();

$stmt = $db->prepare(
    'SELECT pa.id AS application_id, u.full_name, u.role, pa.submitted_at
     FROM provider_applications pa JOIN users u ON u.id = pa.user_id
     WHERE pa.review_status = "pending" AND NOT (u.role = "doctor" AND pa.hospital_id IS NOT NULL)
     ORDER BY pa.submitted_at LIMIT 5'
);
$stmt->execute();
$pending = array_map(function (array $p): array {
    return [
        'id' => (int) $p['application_id'], 'name' => $p['full_name'],
        'type' => ucfirst($p['role']), 'submitted' => date('M j, Y', strtotime($p['submitted_at'])),
    ];
}, $stmt->fetchAll());

// Doctor applications tied to a hospital are that hospital's to review, not the admin's.
$pendingCount = (int) $db->query('SELECT COUNT(*) FROM provider_applications pa JOIN users u ON u.id = pa.user_id WHERE pa.review_status = "pending" AND NOT (u.role = "doctor" AND pa.hospital_id IS NOT NULL)')->fetchColumn();

$totalUsers = (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn();
$hospitalsCount = (int) $db->query('SELECT COUNT(*) FROM hospitals')->fetchColumn();
$labsCount = (int) $db->query('SELECT COUNT(*) FROM labs')->fetchColumn();
$pharmaciesTotal = (int) $db->query('SELECT COUNT(*) FROM users WHERE role = "pharmacy"')->fetchColumn();
$pharmaciesActive = (int) $db->query('SELECT COUNT(*) FROM pharmacies')->fetchColumn();
$doctorsCount = (int) $db->query('SELECT COUNT(*) FROM doctors')->fetchColumn();
$hospitalsTotal = (int) $db->query('SELECT COUNT(*) FROM users WHERE role = "hospital"')->fetchColumn();
$labsTotal = (int) $db->query('SELECT COUNT(*) FROM users WHERE role = "lab"')->fetchColumn();

$activity = [
    ['label' => 'Appointments Today', 'value' => (int) $db->query('SELECT COUNT(*) FROM appointments WHERE appointment_date = CURDATE()')->fetchColumn()],
    ['label' => 'Successful Logins Today', 'value' => (int) $db->query('SELECT COUNT(*) FROM login_logs WHERE status = "success" AND DATE(attempted_at) = CURDATE()')->fetchColumn()],
    ['label' => 'Medicine Orders Today', 'value' => (int) $db->query('SELECT COUNT(*) FROM pharmacy_orders WHERE DATE(created_at) = CURDATE()')->fetchColumn()],
    ['label' => 'Lab Bookings Today', 'value' => (int) $db->query('SELECT COUNT(*) FROM lab_bookings WHERE booking_date = CURDATE()')->fetchColumn()],
];

$breakdown = [
    ['label' => 'Hospitals / Clinics', 'value' => $hospitalsCount, 'total' => max($hospitalsTotal, 1)],
    ['label' => 'Diagnostic Labs', 'value' => $labsCount, 'total' => max($labsTotal, 1)],
    ['label' => 'Doctors', 'value' => $doctorsCount, 'total' => max($doctorsCount, 1)],
    ['label' => 'Pharmacies', 'value' => $pharmaciesActive, 'total' => max($pharmaciesTotal, 1)],
];

respond(['success' => true,
    'pendingProviders' => $pending,
    'pendingCount' => $pendingCount,
    'stats' => [
        'totalUsers' => $totalUsers, 'hospitals' => $hospitalsCount, 'labs' => $labsCount,
    ],
    'activity' => $activity,
    'providerBreakdown' => $breakdown,
]);
