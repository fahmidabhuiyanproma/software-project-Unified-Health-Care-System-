<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** user_sessions — legacy "remember me"/revocable-session table from the old app; unused by Sanctum SPA auth. */
class UserSession extends Model
{
    protected $table = 'user_sessions';

    const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'session_token', 'ip_address', 'user_agent', 'expires_at', 'revoked_at',
    ];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'revoked_at' => 'datetime', 'created_at' => 'datetime'];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
