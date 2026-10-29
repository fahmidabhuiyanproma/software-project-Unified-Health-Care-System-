<?php
/**
 * GET  /api/doctor/patient_record.php?patient_id=  — a patient's visit history.
 * POST /api/doctor/patient_record.php {patient_id, chief_complaint, vitals, diagnosis, prescription, notes}
 *      — add a diagnosis/prescription/note (FR-4.2).
 *
 * FR-4.4 (critical): a doctor may only view or add to a patient's record
 * if they have (or have had) an appointment with that patient. Every
 * request here is checked against the appointments table before any
 * patient data is returned or written.
 */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['doctor']);
$db = getDb();
$doctor = requireDoctorProfile($db);

function isTreatingDoctor(PDO $db, int $doctorId, int $patientId): bool {
    $stmt = $db->prepare('SELECT 1 FROM appointments WHERE doctor_id = :did AND patient_id = :pid LIMIT 1');
    $stmt->execute([':did' => $doctorId, ':pid' => $patientId]);
    return (bool) $stmt->fetchColumn();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = readJsonBody();
    $patientId = (int) ($body['patient_id'] ?? 0);
    $chiefComplaint = trim((string) ($body['chief_complaint'] ?? ''));
    $vitals = trim((string) ($body['vitals'] ?? ''));
    $diagnosis = trim((string) ($body['diagnosis'] ?? ''));
    $prescription = trim((string) ($body['prescription'] ?? ''));
    $notes = trim((string) ($body['notes'] ?? ''));

    if ($patientId <= 0 || $diagnosis === '') {
        respond(['success' => false, 'message' => 'Patient and diagnosis are required.'], 422);
    }
    if (!isTreatingDoctor($db, $doctor['id'], $patientId)) {
        respond(['success' => false, 'message' => 'You can only add records for your own patients.'], 403);
    }

    $description = $diagnosis;
    if ($chiefComplaint !== '') $description = "Chief complaint: {$chiefComplaint}\n" . $description;
    if ($prescription !== '') $description .= "\n\nPrescription: {$prescription}";
    if ($notes !== '') $description .= "\n\nNotes: {$notes}";

    $stmt = $db->prepare(
        'INSERT INTO medical_records (patient_id, doctor_id, record_type, title, description, vitals, visit_date)
         VALUES (:pid, :did, "diagnosis", :title, :desc, :vitals, CURDATE())'
    );
    $stmt->execute([
        ':pid' => $patientId, ':did' => $doctor['id'],
        ':title' => $chiefComplaint !== '' ? $chiefComplaint : 'Consultation Note',
        ':desc' => $description, ':vitals' => $vitals !== '' ? $vitals : null,
    ]);

    respond(['success' => true, 'message' => 'Note saved successfully.']);
}

$patientId = (int) ($_GET['patient_id'] ?? 0);
if ($patientId <= 0) {
    respond(['success' => false, 'message' => 'patient_id is required.'], 422);
}
if (!isTreatingDoctor($db, $doctor['id'], $patientId)) {
    respond(['success' => false, 'message' => 'You can only view records for your own patients.'], 403);
}

$patientStmt = $db->prepare('SELECT id, full_name, phone, email FROM users WHERE id = :id');
$patientStmt->execute([':id' => $patientId]);
$patient = $patientStmt->fetch();

$stmt = $db->prepare(
    'SELECT title, description, vitals, visit_date FROM medical_records
     WHERE patient_id = :pid AND doctor_id = :did ORDER BY visit_date DESC, id DESC'
);
$stmt->execute([':pid' => $patientId, ':did' => $doctor['id']]);
$history = $stmt->fetchAll();

respond(['success' => true, 'patient' => [
    'id' => (int) $patient['id'], 'name' => $patient['full_name'],
    'phone' => $patient['phone'], 'email' => $patient['email'],
], 'history' => $history]);
