<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MedicalRecord extends Model
{
    protected $table = 'medical_records';

    const UPDATED_AT = null;

    protected $fillable = [
        'patient_id', 'doctor_id', 'appointment_id', 'record_type', 'title',
        'description', 'vitals', 'attachment_path', 'visit_date',
    ];

    protected function casts(): array
    {
        return ['visit_date' => 'date'];
    }

    public function patient()
    {
        return $this->belongsTo(User::class, 'patient_id');
    }

    public function doctor()
    {
        return $this->belongsTo(Doctor::class, 'doctor_id');
    }

    public function appointment()
    {
        return $this->belongsTo(Appointment::class, 'appointment_id');
    }
}
