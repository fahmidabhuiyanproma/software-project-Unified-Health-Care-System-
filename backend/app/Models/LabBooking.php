<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LabBooking extends Model
{
    protected $table = 'lab_bookings';

    const UPDATED_AT = null;

    protected $fillable = ['patient_id', 'lab_id', 'test_id', 'booking_date', 'booking_time', 'fee', 'status'];

    protected function casts(): array
    {
        return ['booking_date' => 'date', 'fee' => 'decimal:2'];
    }

    public function patient()
    {
        return $this->belongsTo(User::class, 'patient_id');
    }

    public function lab()
    {
        return $this->belongsTo(Lab::class, 'lab_id');
    }

    public function test()
    {
        return $this->belongsTo(LabTest::class, 'test_id');
    }

    public function result()
    {
        return $this->hasOne(LabResult::class, 'booking_id');
    }
}
