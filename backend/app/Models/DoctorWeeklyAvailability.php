<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * doctor_weekly_availability — composite PRIMARY KEY (doctor_id, weekday), no surrogate id,
 * no timestamps. Eloquent doesn't model true composite keys, so `$primaryKey` below is only
 * the first half — always query/update via ->where('doctor_id', ...)->where('weekday', ...),
 * never ->find()/->save() on a fetched instance for uniqueness.
 */
class DoctorWeeklyAvailability extends Model
{
    protected $table = 'doctor_weekly_availability';

    protected $primaryKey = 'doctor_id';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = ['doctor_id', 'weekday', 'is_available'];

    protected function casts(): array
    {
        return ['is_available' => 'boolean'];
    }

    public function doctor()
    {
        return $this->belongsTo(Doctor::class, 'doctor_id');
    }
}
