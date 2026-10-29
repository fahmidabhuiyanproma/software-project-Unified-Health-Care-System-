<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Doctor\AppointmentController as DoctorAppointmentController;
use App\Http\Controllers\Doctor\DashboardController as DoctorDashboardController;
use App\Http\Controllers\Doctor\PatientController as DoctorPatientController;
use App\Http\Controllers\Doctor\PatientRecordController;
use App\Http\Controllers\Doctor\ScheduleController;
use App\Http\Controllers\HospitalAdmin\ApprovalController as HospitalApprovalController;
use App\Http\Controllers\HospitalAdmin\AppointmentController as HospitalAppointmentController;
use App\Http\Controllers\HospitalAdmin\BedController as HospitalBedController;
use App\Http\Controllers\HospitalAdmin\DashboardController as HospitalDashboardController;
use App\Http\Controllers\HospitalAdmin\DepartmentController;
use App\Http\Controllers\HospitalAdmin\DoctorController as HospitalDoctorController;
use App\Http\Controllers\HospitalController;
use App\Http\Controllers\LabAdmin\BookingController as LabBookingController;
use App\Http\Controllers\LabAdmin\CatalogController as LabCatalogController;
use App\Http\Controllers\LabAdmin\DashboardController as LabDashboardController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Patient\AIConsultationController;
use App\Http\Controllers\Patient\AppointmentController;
use App\Http\Controllers\Patient\BedController;
use App\Http\Controllers\Patient\DashboardController as PatientDashboardController;
use App\Http\Controllers\Patient\DoctorController;
use App\Http\Controllers\Patient\LabController;
use App\Http\Controllers\Patient\MedicalRecordController;
use App\Http\Controllers\Patient\MedicineController;
use App\Http\Controllers\Patient\PharmacyOrderController;
use App\Http\Controllers\PharmacyAdmin\CatalogController as PharmacyCatalogController;
use App\Http\Controllers\PharmacyAdmin\DashboardController as PharmacyDashboardController;
use App\Http\Controllers\PharmacyAdmin\OrderController as PharmacyOrderAdminController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SystemAdmin\ApprovalController as SystemApprovalController;
use App\Http\Controllers\SystemAdmin\CreateAdminController;
use App\Http\Controllers\SystemAdmin\DashboardController as SystemDashboardController;
use App\Http\Controllers\SystemAdmin\SettingsController;
use App\Http\Controllers\SystemAdmin\UserController as SystemUserController;
use App\Http\Controllers\TelemedicineController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::post('/logout', [AuthController::class, 'logout']);
Route::get('/me', [AuthController::class, 'me']);

// Public directory lookup used by the registration form (no login yet).
Route::get('/hospitals', [HospitalController::class, 'index']);

Route::middleware('auth.check')->group(function () {
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications', [NotificationController::class, 'markAllRead']);

    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'changePassword']);
    Route::post('/profile/avatar', [ProfileController::class, 'uploadAvatar']);
    Route::delete('/profile/avatar', [ProfileController::class, 'removeAvatar']);
});

Route::middleware('role:patient,doctor')->group(function () {
    Route::get('/telemedicine', [TelemedicineController::class, 'show']);
    Route::post('/telemedicine', [TelemedicineController::class, 'sendMessage']);
});

Route::middleware('role:patient')->prefix('patient')->group(function () {
    Route::get('/dashboard', [PatientDashboardController::class, 'index']);

    Route::get('/ai-consultation/models', [AIConsultationController::class, 'models']);
    Route::post('/ai-consultation/chat', [AIConsultationController::class, 'chat']);

    Route::get('/doctors', [DoctorController::class, 'index']);
    Route::get('/doctors/{id}', [DoctorController::class, 'show']);
    Route::get('/doctors/{id}/slots', [DoctorController::class, 'slots']);

    Route::get('/appointments', [AppointmentController::class, 'index']);
    Route::post('/appointments', [AppointmentController::class, 'store']);
    Route::post('/appointments/{id}/cancel', [AppointmentController::class, 'cancel']);
    Route::post('/appointments/{id}/reschedule', [AppointmentController::class, 'reschedule']);

    Route::get('/beds', [BedController::class, 'index']);
    Route::post('/beds', [BedController::class, 'store']);
    Route::post('/beds/{id}/cancel', [BedController::class, 'cancel']);

    Route::get('/labs', [LabController::class, 'labs']);
    Route::get('/lab-tests', [LabController::class, 'tests']);
    Route::post('/lab-bookings', [LabController::class, 'book']);
    Route::get('/lab-results', [LabController::class, 'results']);
    Route::get('/lab-results/{booking}/file', [LabController::class, 'resultFile']);

    Route::get('/medical-records', [MedicalRecordController::class, 'index']);
    Route::get('/medicines', [MedicineController::class, 'index']);
    Route::post('/pharmacy-orders', [PharmacyOrderController::class, 'store']);
});

Route::middleware('role:doctor')->prefix('doctor')->group(function () {
    Route::get('/dashboard', [DoctorDashboardController::class, 'index']);
    Route::get('/patients', [DoctorPatientController::class, 'index']);

    Route::get('/patient-record', [PatientRecordController::class, 'show']);
    Route::post('/patient-record', [PatientRecordController::class, 'store']);

    Route::get('/schedule', [ScheduleController::class, 'show']);
    Route::post('/schedule', [ScheduleController::class, 'toggleAvailability']);

    Route::post('/appointments/{id}/confirm', [DoctorAppointmentController::class, 'confirm']);
    Route::post('/appointments/{id}/reject', [DoctorAppointmentController::class, 'reject']);
});

Route::middleware('role:hospital')->prefix('hospital-admin')->group(function () {
    Route::get('/dashboard', [HospitalDashboardController::class, 'index']);
    Route::get('/appointments', [HospitalAppointmentController::class, 'index']);
    Route::get('/doctors', [HospitalDoctorController::class, 'index']);

    Route::get('/departments', [DepartmentController::class, 'index']);
    Route::post('/departments', [DepartmentController::class, 'store']);

    Route::get('/approvals', [HospitalApprovalController::class, 'index']);
    Route::post('/approvals/{id}/approve', [HospitalApprovalController::class, 'approve']);
    Route::post('/approvals/{id}/reject', [HospitalApprovalController::class, 'reject']);

    Route::get('/beds', [HospitalBedController::class, 'index']);
    Route::post('/beds/{id}/approve', [HospitalBedController::class, 'approve']);
    Route::post('/beds/{id}/reject', [HospitalBedController::class, 'reject']);
    Route::post('/beds/{id}/discharge', [HospitalBedController::class, 'discharge']);
});

Route::middleware('role:lab')->prefix('lab-admin')->group(function () {
    Route::get('/dashboard', [LabDashboardController::class, 'index']);

    Route::get('/catalog', [LabCatalogController::class, 'index']);
    Route::post('/catalog', [LabCatalogController::class, 'store']);
    Route::post('/catalog/{id}/toggle', [LabCatalogController::class, 'toggle']);

    Route::get('/bookings', [LabBookingController::class, 'index']);
    Route::post('/bookings/publish', [LabBookingController::class, 'publish']);
});

Route::middleware('role:pharmacy')->prefix('pharmacy-admin')->group(function () {
    Route::get('/dashboard', [PharmacyDashboardController::class, 'index']);

    Route::get('/catalog', [PharmacyCatalogController::class, 'index']);
    Route::post('/catalog', [PharmacyCatalogController::class, 'store']);
    Route::put('/catalog/{id}', [PharmacyCatalogController::class, 'update']);

    Route::get('/orders', [PharmacyOrderAdminController::class, 'index']);
    Route::post('/orders/{id}/advance', [PharmacyOrderAdminController::class, 'advance']);
});

Route::middleware('role:admin')->prefix('system-admin')->group(function () {
    Route::get('/dashboard', [SystemDashboardController::class, 'index']);

    Route::get('/approvals', [SystemApprovalController::class, 'index']);
    Route::post('/approvals/{id}/approve', [SystemApprovalController::class, 'approve']);
    Route::post('/approvals/{id}/reject', [SystemApprovalController::class, 'reject']);

    Route::post('/create-admin', [CreateAdminController::class, 'store']);

    Route::get('/settings', [SettingsController::class, 'index']);
    Route::put('/settings', [SettingsController::class, 'update']);

    Route::get('/users', [SystemUserController::class, 'index']);
    Route::put('/users/status', [SystemUserController::class, 'updateStatus']);
});
