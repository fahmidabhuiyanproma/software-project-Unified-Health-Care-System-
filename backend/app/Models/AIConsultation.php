<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** New table (not part of the legacy schema) backing the Patient Portal's AI Consultation page. */
class AIConsultation extends Model
{
    protected $table = 'ai_consultations';

    protected $fillable = [
        'patient_id',
        'model_name',
        'symptoms',
        'predicted_disease',
        'confidence',
        'severity',
        'description',
        'precautions',
    ];

    protected $casts = [
        'symptoms' => 'array',
        'precautions' => 'array',
        'confidence' => 'float',
        'severity' => 'float',
    ];

    public function patient()
    {
        return $this->belongsTo(User::class, 'patient_id');
    }
}
