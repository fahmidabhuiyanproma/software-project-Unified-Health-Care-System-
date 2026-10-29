<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LabTest extends Model
{
    protected $table = 'lab_tests';

    const UPDATED_AT = null;

    protected $fillable = ['lab_id', 'name', 'category', 'description', 'price', 'turnaround_text', 'is_active'];

    protected function casts(): array
    {
        return ['price' => 'decimal:2', 'is_active' => 'boolean'];
    }

    public function lab()
    {
        return $this->belongsTo(Lab::class, 'lab_id');
    }
}
