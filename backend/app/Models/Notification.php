<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * notifications — this app's own simple in-app notification table
 * (user_id, icon, title, body, is_read). Unrelated to Laravel's built-in
 * notification system; do not use the Notifiable trait's ->notifications()
 * against this table, its column shape doesn't match.
 */
class Notification extends Model
{
    protected $table = 'notifications';

    const UPDATED_AT = null;

    protected $fillable = ['user_id', 'icon', 'title', 'body', 'is_read'];

    protected function casts(): array
    {
        return ['is_read' => 'boolean'];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
