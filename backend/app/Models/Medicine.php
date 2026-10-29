<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Medicine extends Model
{
    protected $table = 'medicines';

    const UPDATED_AT = null;

    protected $fillable = ['pharmacy_id', 'name', 'generic_name', 'brand', 'category', 'unit', 'price', 'stock_qty'];

    protected function casts(): array
    {
        return ['price' => 'decimal:2'];
    }

    public function pharmacy()
    {
        return $this->belongsTo(Pharmacy::class, 'pharmacy_id');
    }
}
