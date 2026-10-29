<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;

/**
 * Maps to the existing `users` table (database/syncura_auth.sql) exactly as-is.
 * No `name`/`password`/`remember_token` columns exist here — this account
 * uses `full_name` and `password_hash`, and never uses "remember me".
 */
class User extends Authenticatable
{
    protected $table = 'users';

    /** No `updated_at` write needed beyond what the app explicitly sets; MySQL owns `created_at` via DEFAULT CURRENT_TIMESTAMP. */
    const UPDATED_AT = 'updated_at';

    protected $fillable = [
        'full_name',
        'email',
        'phone',
        'password_hash',
        'role',
        'status',
        'avatar_url',
        'phone_verified_at',
        'email_verified_at',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected function casts(): array
    {
        return [
            'phone_verified_at' => 'datetime',
            'email_verified_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /** Sanctum/Auth guard reads the hash from this column, not the conventional `password`. */
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    /** No `remember_token` column exists on this table — "remember me" is unsupported, not emulated. */
    public function getRememberToken(): ?string
    {
        return null;
    }

    public function setRememberToken($value): void
    {
        // Intentionally a no-op: no remember_token column on the existing schema.
    }

    public function getRememberTokenName(): ?string
    {
        return null;
    }

    public function doctorProfile()
    {
        return $this->hasOne(Doctor::class, 'user_id');
    }

    public function hospital()
    {
        return $this->hasOne(Hospital::class, 'owner_user_id');
    }

    public function lab()
    {
        return $this->hasOne(Lab::class, 'owner_user_id');
    }

    public function pharmacy()
    {
        return $this->hasOne(Pharmacy::class, 'owner_user_id');
    }
}
