<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lab extends Model
{
    protected $table = 'labs';

    const UPDATED_AT = null;

    protected $fillable = ['owner_user_id', 'name', 'address', 'city', 'phone'];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function tests()
    {
        return $this->hasMany(LabTest::class, 'lab_id');
    }

    public function bookings()
    {
        return $this->hasMany(LabBooking::class, 'lab_id');
    }
}
