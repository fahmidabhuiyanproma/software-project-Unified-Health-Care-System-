<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Medicine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Ports api/patient/medicines.php (FR-6.1). */
class MedicineController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $query = Medicine::query();
        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'like', "%{$q}%")->orWhere('generic_name', 'like', "%{$q}%");
            });
        }

        $medicines = $query->orderBy('name')->get()->map(function (Medicine $m) {
            $stock = (int) $m->stock_qty;
            $status = $stock === 0 ? 'out-of-stock' : ($stock < 50 ? 'low-stock' : 'in-stock');

            return [
                'id' => $m->id,
                'name' => $m->name,
                'generic' => $m->generic_name,
                'brand' => $m->brand,
                'unit' => $m->unit,
                'price' => (float) $m->price,
                'stock' => $status,
            ];
        });

        return $this->ok(['medicines' => $medicines]);
    }
}
