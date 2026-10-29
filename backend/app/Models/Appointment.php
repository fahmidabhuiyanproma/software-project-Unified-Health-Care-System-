<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** appointments — `active_slot_key` is a MySQL VIRTUAL generated column; deliberately not fillable. */
class Appointment extends Model
{
    protected $table = 'appointments';

    protected $fillable = [
        'patient_id', 'doctor_id', 'hospital_id', 'appointment_date', 'appointment_time',
        'visit_type', 'reason', 'notes', 'fee', 'status',
    ];

    protected function casts(): array
    {
        return ['appointment_date' => 'date', 'fee' => 'decimal:2'];
    }

    public function patient()
    {
        return $this->belongsTo(User::class, 'patient_id');
    }

    public function doctor()
    {
        return $this->belongsTo(Doctor::class, 'doctor_id');
    }

    public function hospital()
    {
        return $this->belongsTo(Hospital::class, 'hospital_id');
    }

    public function medicalRecords()
    {
        return $this->hasMany(MedicalRecord::class, 'appointment_id');
    }

    public function telemedicineSession()
    {
        return $this->hasOne(TelemedicineSession::class, 'appointment_id');
    }
}
