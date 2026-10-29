<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** login_logs — audit trail; no `created_at`, `attempted_at` is the creation timestamp. */
class LoginLog extends Model
{
    protected $table = 'login_logs';

    const CREATED_AT = 'attempted_at';
    const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'identifier', 'status', 'failure_reason', 'ip_address', 'user_agent',
    ];

    protected function casts(): array
    {
        return ['attempted_at' => 'datetime'];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
