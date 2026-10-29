<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BedBooking extends Model
{
    protected $table = 'bed_bookings';

    protected $fillable = [
        'patient_id', 'hospital_id', 'department_id', 'admission_date', 'reason',
        'attendant_phone', 'notes', 'status', 'rejection_reason', 'decided_at',
    ];

    protected function casts(): array
    {
        return ['admission_date' => 'date', 'decided_at' => 'datetime'];
    }

    public function patient()
    {
        return $this->belongsTo(User::class, 'patient_id');
    }

    public function hospital()
    {
        return $this->belongsTo(Hospital::class, 'hospital_id');
    }

    public function department()
    {
        return $this->belongsTo(HospitalDepartment::class, 'department_id');
    }
}
