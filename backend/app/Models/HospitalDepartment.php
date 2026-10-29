<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HospitalDepartment extends Model
{
    protected $table = 'hospital_departments';

    const UPDATED_AT = null;

    protected $fillable = ['hospital_id', 'name', 'bed_count'];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class, 'hospital_id');
    }

    public function doctors()
    {
        return $this->hasMany(Doctor::class, 'department_id');
    }

    public function bedBookings()
    {
        return $this->hasMany(BedBooking::class, 'department_id');
    }
}
