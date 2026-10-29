<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TelemedicineMessage extends Model
{
    protected $table = 'telemedicine_messages';

    const UPDATED_AT = null;

    protected $fillable = ['session_id', 'sender_user_id', 'sender_role', 'message'];

    public function session()
    {
        return $this->belongsTo(TelemedicineSession::class, 'session_id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }
}
