<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Proxies the Patient Portal's AI Consultation page to the standalone
 * Flask ML service (ai-service/app.py, not browser-facing). Not a port
 * of anything in the old PHP app. Stateless - no consultation results
 * are persisted.
 */
class AIConsultationController extends Controller
{
    use ApiResponse;

    private function baseUrl(): string
    {
        return rtrim(config('services.ai_service.url'), '/');
    }

    public function models(): JsonResponse
    {
        try {
            $response = Http::timeout(10)->get("{$this->baseUrl()}/api/models");
        } catch (\Throwable $e) {
            Log::warning('AI service unreachable (models)', ['error' => $e->getMessage()]);
            return $this->fail('The AI consultation service is unavailable right now. Please try again shortly.', 503);
        }

        if (!$response->successful()) {
            return $this->fail('The AI consultation service returned an error.', 502);
        }

        return $this->ok(['models' => $response->json('models') ?? []]);
    }

    public function chat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'step' => 'required|string|in:welcome,symptoms,refinement',
            'patient' => 'sometimes|array',
            'patient.name' => 'sometimes|string|max:150',
            'patient.age' => 'sometimes',
            'patient.gender' => 'sometimes|string|max:20',
            'model_name' => 'sometimes|string|in:decision_tree,logistic_regression,random_forest,svm,xgboost',
            'symptoms' => 'sometimes|array',
            'symptoms_to_ask' => 'sometimes|array',
            'current_question_idx' => 'sometimes|integer|min:0',
            'user_input' => 'sometimes|string|max:500',
            'predicted_disease' => 'sometimes|string|max:150',
        ]);

        try {
            $response = Http::timeout(15)->post("{$this->baseUrl()}/api/chat", $validated);
        } catch (\Throwable $e) {
            Log::warning('AI service unreachable (chat)', ['error' => $e->getMessage()]);
            return $this->fail('The AI consultation service is unavailable right now. Please try again shortly.', 503);
        }

        if (!$response->successful()) {
            return $this->fail('The AI consultation service returned an error.', 502);
        }

        return $this->ok($response->json());
    }
}
