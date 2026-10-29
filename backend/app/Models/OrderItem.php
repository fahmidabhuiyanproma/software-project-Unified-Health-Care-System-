<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** order_items — no timestamp columns at all. */
class OrderItem extends Model
{
    protected $table = 'order_items';

    public $timestamps = false;

    protected $fillable = ['order_id', 'medicine_id', 'quantity', 'unit_price'];

    protected function casts(): array
    {
        return ['unit_price' => 'decimal:2'];
    }

    public function order()
    {
        return $this->belongsTo(PharmacyOrder::class, 'order_id');
    }

    public function medicine()
    {
        return $this->belongsTo(Medicine::class, 'medicine_id');
    }
}
