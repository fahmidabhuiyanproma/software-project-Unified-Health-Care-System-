<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pharmacy extends Model
{
    protected $table = 'pharmacies';

    const UPDATED_AT = null;

    protected $fillable = ['owner_user_id', 'name', 'address', 'city', 'phone'];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function medicines()
    {
        return $this->hasMany(Medicine::class, 'pharmacy_id');
    }

    public function orders()
    {
        return $this->hasMany(PharmacyOrder::class, 'pharmacy_id');
    }
}
