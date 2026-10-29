<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** provider_applications — no `created_at`; `submitted_at` is the creation timestamp. */
class ProviderApplication extends Model
{
    protected $table = 'provider_applications';

    const CREATED_AT = 'submitted_at';
    const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'hospital_id', 'department_id', 'license_number',
        'review_status', 'reviewed_by_user_id', 'reviewed_at', 'rejection_reason',
    ];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime', 'submitted_at' => 'datetime'];
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

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }
}
