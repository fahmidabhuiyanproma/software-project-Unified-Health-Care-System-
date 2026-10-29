<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $table = 'payments';

    const UPDATED_AT = null;

    protected $fillable = ['patient_id', 'reference_type', 'reference_id', 'amount', 'method', 'status', 'transaction_ref'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function patient()
    {
        return $this->belongsTo(User::class, 'patient_id');
    }
}
