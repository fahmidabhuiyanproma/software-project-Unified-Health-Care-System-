<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Hospital extends Model
{
    protected $table = 'hospitals';

    const UPDATED_AT = null;

    protected $fillable = ['owner_user_id', 'name', 'address', 'city', 'phone', 'registration_no'];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function departments()
    {
        return $this->hasMany(HospitalDepartment::class, 'hospital_id');
    }

    public function doctors()
    {
        return $this->hasMany(Doctor::class, 'hospital_id');
    }

    public function appointments()
    {
        return $this->hasMany(Appointment::class, 'hospital_id');
    }
}
