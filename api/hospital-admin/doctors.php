<?php
/**
 * GET /api/hospital-admin/doctors.php?q=  — doctors at this hospital (FR-2.1).
 *
 * Doctors are no longer added directly by the Hospital Admin — a doctor
 * self-registers and picks this hospital, then the hospital approves them
 * via api/hospital-admin/approvals.php, which creates their `doctors` row.
 * This endpoint is read-only: the roster of already-approved doctors.
 */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['hospital']);
$db = getDb();
$hospital = requireOwnedProvider($db, 'hospitals');

$q = trim((string) ($_GET['q'] ?? ''));
$sql = 'SELECT d.id, d.full_name, d.specialty, d.status, d.created_at, hd.name AS dept_name,
               (SELECT COUNT(DISTINCT patient_id) FROM appointments a WHERE a.doctor_id = d.id) AS patient_count
        FROM doctors d LEFT JOIN hospital_departments hd ON hd.id = d.department_id
        WHERE d.hospital_id = :hid';
if ($q !== '') $sql .= ' AND d.full_name LIKE :q';
$sql .= ' ORDER BY d.full_name';

$stmt = $db->prepare($sql);
$params = [':hid' => $hospital['id']];
if ($q !== '') $params[':q'] = "%$q%";
$stmt->execute($params);

$doctors = array_map(function (array $d): array {
    return [
        'id' => (int) $d['id'], 'name' => $d['full_name'], 'specialty' => $d['specialty'],
        'dept' => $d['dept_name'] ?: 'Unassigned', 'patients' => (int) $d['patient_count'],
        'status' => $d['status'] === 'active' ? 'confirmed' : $d['status'],
        'joined' => date('M Y', strtotime($d['created_at'])),
    ];
}, $stmt->fetchAll());

respond(['success' => true, 'doctors' => $doctors]);
