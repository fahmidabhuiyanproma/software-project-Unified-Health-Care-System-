<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** lab_results — no `created_at`; `uploaded_at` is the creation timestamp. */
class LabResult extends Model
{
    protected $table = 'lab_results';

    const CREATED_AT = 'uploaded_at';
    const UPDATED_AT = null;

    protected $fillable = ['booking_id', 'result_summary', 'file_path'];

    protected function casts(): array
    {
        return ['uploaded_at' => 'datetime'];
    }

    public function booking()
    {
        return $this->belongsTo(LabBooking::class, 'booking_id');
    }
}
