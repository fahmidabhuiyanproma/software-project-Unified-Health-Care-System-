<?php

namespace App\Http\Controllers\LabAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresOwnedProvider;
use App\Http\Controllers\Controller;
use App\Models\Lab;
use App\Models\LabTest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Ports api/lab-admin/catalog.php (FR-2.3). */
class CatalogController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    public function index(Request $request): JsonResponse
    {
        $lab = $this->ownedProviderOrFail($request->user(), Lab::class);
        if ($lab instanceof JsonResponse) {
            return $lab;
        }

        $tests = LabTest::where('lab_id', $lab->id)->orderBy('name')->get()->map(fn (LabTest $t) => [
            'id' => $t->id,
            'name' => $t->name,
            'category' => $t->category,
            'price' => (float) $t->price,
            'turnaround' => $t->turnaround_text,
            'active' => (bool) $t->is_active,
        ]);

        return $this->ok(['tests' => $tests]);
    }

    public function store(Request $request): JsonResponse
    {
        $lab = $this->ownedProviderOrFail($request->user(), Lab::class);
        if ($lab instanceof JsonResponse) {
            return $lab;
        }

        $name = trim((string) $request->input('name', ''));
        $category = trim((string) $request->input('category', ''));
        $price = (float) $request->input('price', 0);
        $turnaround = trim((string) $request->input('turnaround', ''));
        $description = trim((string) $request->input('description', ''));

        if ($name === '' || $category === '' || $price <= 0 || $turnaround === '') {
            return $this->fail('Test name, category, price, and turnaround time are required.', 422);
        }

        LabTest::create([
            'lab_id' => $lab->id,
            'name' => $name,
            'category' => $category,
            'description' => $description !== '' ? $description : null,
            'price' => $price,
            'turnaround_text' => $turnaround,
        ]);

        return $this->ok(['message' => 'Test added to catalog.']);
    }

    public function toggle(Request $request, int $id): JsonResponse
    {
        $lab = $this->ownedProviderOrFail($request->user(), Lab::class);
        if ($lab instanceof JsonResponse) {
            return $lab;
        }

        LabTest::where('id', $id)->where('lab_id', $lab->id)->update(['is_active' => $request->boolean('is_active')]);

        return $this->ok();
    }
}
