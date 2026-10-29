# SynCura API Migration Map

Every old PHP endpoint's new Laravel route, and why the URL changed where it did.
Updated as each stage of the migration lands. The old `.php` file is left in place at
its original path throughout — nothing here is a live cutover until the React frontend
switches over and it's verified end-to-end.

Legend: **unchanged** = same shape/semantics, only the file→route mechanism changed.
**changed** = a real behavior/shape difference is called out explicitly.

## Auth

| OLD ENDPOINT | NEW ENDPOINT | REASON |
|---|---|---|
| `POST /api/login.php` | `POST /api/login` | Laravel route, no `.php`. Response shape unchanged. |
| `POST /api/register.php` | `POST /api/register` | Same. Response shape unchanged. |
| `POST /api/logout.php` | `POST /api/logout` | Same. Response shape unchanged. |
| *(none — new)* | `GET /api/me` | **New.** The old app trusted `localStorage` across page loads; a real SPA must ask the server who's authenticated on boot. Not a ported behavior, required plumbing for Sanctum SPA auth. |

Auth mechanism itself changed: native PHP `session_start()`/`$_SESSION` → Laravel Sanctum SPA
cookie-session guard. Observable behavior is the same (cookie in, cookie out, same
401/403 semantics), with CSRF protection added (the old app had none).

## Common (api/common/*)

| OLD ENDPOINT | NEW ENDPOINT | REASON |
|---|---|---|
| `GET /api/common/hospitals.php` | `GET /api/hospitals` | Route, no `.php`/`common/`. Same query param (`?hospital_id=`) switches list vs. departments, unchanged. |
| `GET /api/common/notifications.php` | `GET /api/notifications` | Route. Unchanged response shape. |
| `POST /api/common/notifications.php` `{mark_all_read}` | `POST /api/notifications` `{mark_all_read}` | Route. Unchanged body/response. |
| `GET /api/common/profile.php` | `GET /api/profile` | Route. Unchanged response shape. |
| `POST /api/common/profile.php` (multipart `avatar`) | `POST /api/profile/avatar` | **Changed.** Split out of the single action-multiplexed file into its own route — same validation (2MB max, JPG/PNG/WebP/GIF), same on-disk destination (`assets/avatars/`, not moved). |
| `POST /api/common/profile.php` `{action:"remove_avatar"}` | `DELETE /api/profile/avatar` | **Changed.** Same split; DELETE verb matches the action instead of a body flag. |
| `POST /api/common/profile.php` `{action:"update", ...}` | `PUT /api/profile` | **Changed.** Same split; PUT verb matches "update a resource" instead of a body flag. Same field validation and doctor/organization mirroring. |
| `POST /api/common/profile.php` `{action:"password", ...}` | `PUT /api/profile/password` | **Changed.** Same split. Same validation (8-char minimum, current-password check). |
| `GET /api/common/telemedicine.php?appointment_id=` | `GET /api/telemedicine?appointment_id=` | Route. Unchanged behavior, including "omit → most recent" resolution. |
| `POST /api/common/telemedicine.php` `{appointment_id, message}` | `POST /api/telemedicine` `{appointment_id, message}` | Route. Unchanged body/response, unchanged cross-notification. |
| *(implicit — plain static file under `/assets/avatars/`)* | `GET /avatars/{filename}` | **Changed.** The old app served avatars as plain static files under the PHP app's own web root. The Laravel API and the (future) React frontend are different origins/processes, so uploaded avatars are now served by a small public (unauthenticated, same as before) Laravel route reading straight from the same physical `assets/avatars/` folder — the files themselves were never moved. |

## Patient (api/patient/*)

| OLD ENDPOINT | NEW ENDPOINT | REASON |
|---|---|---|
| `GET /api/patient/dashboard.php` | `GET /api/patient/dashboard` | Route. Unchanged response shape. |
| `GET /api/patient/doctors.php?q=&specialty=&available_only=` | `GET /api/patient/doctors?q=&specialty=&available_only=` | Route. Unchanged query params/response. |
| `GET /api/patient/doctor_detail.php?id=` | `GET /api/patient/doctors/{id}` | **Changed.** Path parameter instead of query string — the id identifies a specific resource. Unchanged response shape. |
| `GET /api/patient/doctor_slots.php?doctor_id=&date=` | `GET /api/patient/doctors/{id}/slots?date=` | **Changed.** Same reasoning — doctor id is a path segment of the doctor resource; `date` stays a query param. Unchanged response shape. |
| `GET /api/patient/appointments.php` | `GET /api/patient/appointments` | Route. Unchanged response shape. |
| `POST /api/patient/appointments.php` (book) | `POST /api/patient/appointments` | Route. Unchanged body/response, unchanged double-booking check. |
| `POST /api/patient/appointment_update.php` `{action:"cancel"}` | `POST /api/patient/appointments/{id}/cancel` | **Changed.** Split the action-flag body into two explicit routes — same validation, same notifications. |
| `POST /api/patient/appointment_update.php` `{action:"reschedule"}` | `POST /api/patient/appointments/{id}/reschedule` | **Changed.** Same split. |
| `GET /api/patient/beds.php` (+ `?hospital_id=`) | `GET /api/patient/beds` (+ `?hospital_id=`) | Route. Unchanged dual-mode query param. |
| `POST /api/patient/beds.php` (request) | `POST /api/patient/beds` | Route. Unchanged validation/locking. |
| `POST /api/patient/beds.php` `{action:"cancel"}` | `POST /api/patient/beds/{id}/cancel` | **Changed.** Same action-flag → route split as appointments. |
| `GET /api/patient/labs.php` | `GET /api/patient/labs` | Route. Unchanged. |
| `GET /api/patient/lab_tests.php` | `GET /api/patient/lab-tests` | Route (hyphenated, matches Laravel convention). Unchanged. |
| `POST /api/patient/lab_book.php` | `POST /api/patient/lab-bookings` | Route. Unchanged body/response. |
| `GET /api/patient/lab_results.php` | `GET /api/patient/lab-results` | Route. Unchanged. |
| `GET /api/patient/lab_result_file.php?booking_id=` | `GET /api/patient/lab-results/{booking}/file` | **Changed.** Path parameter instead of query string. Same ownership check, same `uploads/` folder (files never moved). |
| `GET /api/patient/medical_records.php` | `GET /api/patient/medical-records` | Route. Unchanged. |
| `GET /api/patient/medicines.php?q=` | `GET /api/patient/medicines?q=` | Route. Unchanged. |
| `POST /api/patient/pharmacy_order.php` | `POST /api/patient/pharmacy-orders` | Route. Unchanged transaction/stock/payment behavior. |

## Doctor (api/doctor/*)

| OLD ENDPOINT | NEW ENDPOINT | REASON |
|---|---|---|
| `GET /api/doctor/dashboard.php` | `GET /api/doctor/dashboard` | Route. Unchanged response shape. |
| `GET /api/doctor/patients.php?q=` | `GET /api/doctor/patients?q=` | Route. Unchanged. |
| `GET /api/doctor/patient_record.php?patient_id=` | `GET /api/doctor/patient-record?patient_id=` | Route (hyphenated). Unchanged query param, unchanged FR-4.4 ownership check. |
| `POST /api/doctor/patient_record.php` | `POST /api/doctor/patient-record` | Route. Unchanged body/response. |
| `GET /api/doctor/schedule.php?date=` | `GET /api/doctor/schedule?date=` | Route. Unchanged. |
| `POST /api/doctor/schedule.php` (toggle weekday) | `POST /api/doctor/schedule` | Route. Unchanged body/response — but see below, the *implementation* was fixed after a real bug was caught in testing. |
| `POST /api/doctor/appointment_update.php` `{action:"confirm"}` | `POST /api/doctor/appointments/{id}/confirm` | **Changed.** Action-flag body → route, same split pattern as the patient module. |
| `POST /api/doctor/appointment_update.php` `{action:"reject"}` | `POST /api/doctor/appointments/{id}/reject` | **Changed.** Same split. |

**Note:** `doctor_weekly_availability`'s real primary key is the composite
`(doctor_id, weekday)`, which Eloquent can't express directly. The schedule
toggle must use the query builder's `updateOrInsert()` (matches the full WHERE
clause) rather than an Eloquent model's `updateOrCreate()`/instance `update()`
(which scope by the model's single declared `$primaryKey` alone) — the latter
was tried first, caught immediately in testing (it silently overwrote every
weekday row instead of just the toggled one), and fixed. See
`Doctor\ScheduleController` in Stage 5's commit for details.

## Hospital-admin (api/hospital-admin/*)

| OLD ENDPOINT | NEW ENDPOINT | REASON |
|---|---|---|
| `GET /api/hospital-admin/appointments.php?q=` | `GET /api/hospital-admin/appointments?q=` | Route. Unchanged. |
| `GET /api/hospital-admin/approvals.php` | `GET /api/hospital-admin/approvals` | Route. Unchanged. |
| `POST /api/hospital-admin/approvals.php` `{decision:"approve"}` | `POST /api/hospital-admin/approvals/{id}/approve` | **Changed.** Action-flag body → route, same split pattern as every prior stage. |
| `POST /api/hospital-admin/approvals.php` `{decision:"reject"}` | `POST /api/hospital-admin/approvals/{id}/reject` | **Changed.** Same split. |
| `GET /api/hospital-admin/beds.php` | `GET /api/hospital-admin/beds` | Route. Unchanged. |
| `POST /api/hospital-admin/beds.php` `{decision:"approve"}` | `POST /api/hospital-admin/beds/{id}/approve` | **Changed.** Same split pattern. |
| `POST /api/hospital-admin/beds.php` `{decision:"reject"}` | `POST /api/hospital-admin/beds/{id}/reject` | **Changed.** Same split. |
| `POST /api/hospital-admin/beds.php` `{decision:"discharge"}` | `POST /api/hospital-admin/beds/{id}/discharge` | **Changed.** Same split. |
| `GET /api/hospital-admin/dashboard.php` | `GET /api/hospital-admin/dashboard` | Route. Unchanged. |
| `GET /api/hospital-admin/departments.php` | `GET /api/hospital-admin/departments` | Route. Unchanged. |
| `POST /api/hospital-admin/departments.php` | `POST /api/hospital-admin/departments` | Route. Unchanged. |
| `GET /api/hospital-admin/doctors.php?q=` | `GET /api/hospital-admin/doctors?q=` | Route. Unchanged (still read-only). |

## Lab-admin (api/lab-admin/*)

| OLD ENDPOINT | NEW ENDPOINT | REASON |
|---|---|---|
| `GET /api/lab-admin/bookings.php` | `GET /api/lab-admin/bookings` | Route. Unchanged. |
| `POST /api/lab-admin/bookings.php` (publish result, multipart) | `POST /api/lab-admin/bookings/publish` | **Changed.** A named action route instead of overloading the collection URI's POST — same multipart fields, same PDF mime-sniffing, same side effects. |
| `GET /api/lab-admin/catalog.php` | `GET /api/lab-admin/catalog` | Route. Unchanged. |
| `POST /api/lab-admin/catalog.php` (add test) | `POST /api/lab-admin/catalog` | Route. Unchanged. |
| `POST /api/lab-admin/catalog.php` `{toggle_id}` | `POST /api/lab-admin/catalog/{id}/toggle` | **Changed.** Action-flag body → route. |
| `GET /api/lab-admin/dashboard.php` | `GET /api/lab-admin/dashboard` | Route. Unchanged. |

## Pharmacy-admin (api/pharmacy-admin/*)

| OLD ENDPOINT | NEW ENDPOINT | REASON |
|---|---|---|
| `GET /api/pharmacy-admin/catalog.php` | `GET /api/pharmacy-admin/catalog` | Route. Unchanged. |
| `POST /api/pharmacy-admin/catalog.php` (add) | `POST /api/pharmacy-admin/catalog` | Route. Unchanged. |
| `POST /api/pharmacy-admin/catalog.php` `{action:"update", id}` | `PUT /api/pharmacy-admin/catalog/{id}` | **Changed.** Action-flag body → PUT on the specific resource. |
| `GET /api/pharmacy-admin/dashboard.php` | `GET /api/pharmacy-admin/dashboard` | Route. Unchanged. |
| `GET /api/pharmacy-admin/orders.php` | `GET /api/pharmacy-admin/orders` | Route. Unchanged. |
| `POST /api/pharmacy-admin/orders.php` `{order_id}` | `POST /api/pharmacy-admin/orders/{id}/advance` | **Changed.** Order id moved from body to path; the single "advance to next status" action is now a named route. |

## System-admin (api/system-admin/*)

| OLD ENDPOINT | NEW ENDPOINT | REASON |
|---|---|---|
| `GET /api/system-admin/approvals.php` | `GET /api/system-admin/approvals` | Route. Unchanged. |
| `POST /api/system-admin/approvals.php` `{decision:"approve"}` | `POST /api/system-admin/approvals/{id}/approve` | **Changed.** Action-flag body → route, same split pattern as every prior stage. |
| `POST /api/system-admin/approvals.php` `{decision:"reject"}` | `POST /api/system-admin/approvals/{id}/reject` | **Changed.** Same split. |
| `POST /api/system-admin/create_admin.php` | `POST /api/system-admin/create-admin` | Route (hyphenated). Unchanged body/response. |
| `GET /api/system-admin/dashboard.php` | `GET /api/system-admin/dashboard` | Route. Unchanged. |
| `GET /api/system-admin/settings.php` | `GET /api/system-admin/settings` | Route. Unchanged. |
| `POST /api/system-admin/settings.php` | `PUT /api/system-admin/settings` | **Changed.** POST → PUT since this always updates the existing settings resource, never creates a new one. |
| `GET /api/system-admin/users.php?q=` | `GET /api/system-admin/users?q=` | Route. Unchanged. |
| `POST /api/system-admin/users.php` `{user_id, status}` | `PUT /api/system-admin/users/status` | **Changed.** POST → PUT (updating an existing user's status); body shape unchanged. |

## Migration status: complete

Every PHP API module (auth, common, patient, doctor, hospital-admin, lab-admin,
pharmacy-admin, system-admin) has a corresponding Laravel implementation,
verified against the real database. The old `api/*.php` files remain in place,
untouched, as the working reference until the React frontend is built and the
full system is verified end-to-end (Stage 8+ of the migration plan).

## New functionality added after migration (not a port of the old app)

The Patient Portal's **AI Consultation** page has no equivalent in the old
PHP app — there is no OLD ENDPOINT to map from. It's a new feature backed by
a standalone Flask ML microservice (`ai-service/`), proxied through Laravel
so the browser only ever talks to the existing API surface:

| NEW ENDPOINT | Proxies to | Notes |
|---|---|---|
| `GET /api/patient/ai-consultation/models` | `ai-service` `GET /api/models` | Train/test accuracy for the 5 classifiers. |
| `POST /api/patient/ai-consultation/chat` | `ai-service` `POST /api/chat` | Drives the symptom-extraction/follow-up conversation; persists a summary row to `ai_consultations` when a session reaches `step: "complete"`. |
| `GET /api/patient/ai-consultation/history` | — (reads `ai_consultations` directly) | Lists the signed-in patient's past consultations. |

This required one schema addition — a new `ai_consultations` table (patient_id,
model_name, symptoms, predicted_disease, confidence, severity, description,
precautions, timestamps), created via a normal Laravel migration. No existing
table was touched; this is a net-new table for a net-new feature, not part of
the "immutable legacy schema" the migration itself was bound by.
