<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PharmacyOrder extends Model
{
    protected $table = 'pharmacy_orders';

    const UPDATED_AT = null;

    protected $fillable = ['patient_id', 'pharmacy_id', 'subtotal', 'delivery_fee', 'total_amount', 'payment_method', 'status'];

    protected function casts(): array
    {
        return ['subtotal' => 'decimal:2', 'delivery_fee' => 'decimal:2', 'total_amount' => 'decimal:2'];
    }

    public function patient()
    {
        return $this->belongsTo(User::class, 'patient_id');
    }

    public function pharmacy()
    {
        return $this->belongsTo(Pharmacy::class, 'pharmacy_id');
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class, 'order_id');
    }
}
