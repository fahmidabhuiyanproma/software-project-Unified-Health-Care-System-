<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Doctor extends Model
{
    protected $table = 'doctors';

    const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'hospital_id', 'department_id', 'full_name', 'specialty', 'qualification',
        'experience_years', 'consultation_fee', 'bio', 'photo_url', 'status',
    ];

    protected function casts(): array
    {
        return ['consultation_fee' => 'decimal:2'];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function hospital()
    {
        return $this->belongsTo(Hospital::class, 'hospital_id');
    }

    public function department()
    {
        return $this->belongsTo(HospitalDepartment::class, 'department_id');
    }

    public function weeklyAvailability()
    {
        return $this->hasMany(DoctorWeeklyAvailability::class, 'doctor_id');
    }

    public function appointments()
    {
        return $this->hasMany(Appointment::class, 'doctor_id');
    }
}
