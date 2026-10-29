<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** telemedicine_sessions — `started_at`/`ended_at` are business fields, not bookkeeping timestamps. */
class TelemedicineSession extends Model
{
    protected $table = 'telemedicine_sessions';

    public $timestamps = false;

    protected $fillable = ['appointment_id', 'started_at', 'ended_at'];

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'ended_at' => 'datetime'];
    }

    public function appointment()
    {
        return $this->belongsTo(Appointment::class, 'appointment_id');
    }

    public function messages()
    {
        return $this->hasMany(TelemedicineMessage::class, 'session_id');
    }
}
