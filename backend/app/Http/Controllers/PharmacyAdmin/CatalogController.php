<?php

namespace App\Http\Controllers\PharmacyAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresOwnedProvider;
use App\Http\Controllers\Controller;
use App\Models\Medicine;
use App\Models\Pharmacy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Ports api/pharmacy-admin/catalog.php (FR-2.4). */
class CatalogController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    public function index(Request $request): JsonResponse
    {
        $pharmacy = $this->ownedProviderOrFail($request->user(), Pharmacy::class);
        if ($pharmacy instanceof JsonResponse) {
            return $pharmacy;
        }

        $lowCount = 0;
        $outCount = 0;
        $medicines = Medicine::where('pharmacy_id', $pharmacy->id)->orderBy('name')->get()
            ->map(function (Medicine $m) use (&$lowCount, &$outCount) {
                $stock = (int) $m->stock_qty;
                $status = $stock === 0 ? 'out-of-stock' : ($stock < 50 ? 'low-stock' : 'in-stock');
                if ($status === 'low-stock') {
                    $lowCount++;
                }
                if ($status === 'out-of-stock') {
                    $outCount++;
                }

                return [
                    'id' => $m->id,
                    'name' => $m->name,
                    'generic' => $m->generic_name,
                    'category' => $m->category,
                    'price' => (float) $m->price,
                    'stock' => $stock,
                    'status' => $status,
                ];
            });

        return $this->ok(['medicines' => $medicines, 'lowStockCount' => $lowCount, 'outOfStockCount' => $outCount]);
    }

    public function store(Request $request): JsonResponse
    {
        $pharmacy = $this->ownedProviderOrFail($request->user(), Pharmacy::class);
        if ($pharmacy instanceof JsonResponse) {
            return $pharmacy;
        }

        [$name, $generic, $category, $price, $stock, $error] = $this->validateInput($request);
        if ($error) {
            return $this->fail($error, 422);
        }

        Medicine::create([
            'pharmacy_id' => $pharmacy->id,
            'name' => $name,
            'generic_name' => $generic,
            'category' => $category,
            'unit' => 'tablet',
            'price' => $price,
            'stock_qty' => $stock,
        ]);

        return $this->ok(['message' => 'Medicine added to catalog.']);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $pharmacy = $this->ownedProviderOrFail($request->user(), Pharmacy::class);
        if ($pharmacy instanceof JsonResponse) {
            return $pharmacy;
        }

        [$name, $generic, $category, $price, $stock, $error] = $this->validateInput($request);
        if ($error) {
            return $this->fail($error, 422);
        }

        $exists = Medicine::where('id', $id)->where('pharmacy_id', $pharmacy->id)->exists();
        if (! $exists) {
            return $this->fail('Medicine not found.', 404);
        }

        Medicine::where('id', $id)->update([
            'name' => $name,
            'generic_name' => $generic,
            'category' => $category,
            'price' => $price,
            'stock_qty' => $stock,
        ]);

        return $this->ok(['message' => 'Medicine updated.']);
    }

    /** @return array{0: string, 1: string, 2: string, 3: float, 4: int, 5: ?string} */
    private function validateInput(Request $request): array
    {
        $name = trim((string) $request->input('name', ''));
        $generic = trim((string) $request->input('generic_name', ''));
        $category = trim((string) $request->input('category', ''));
        $price = (float) $request->input('price', 0);
        $stock = max(0, (int) $request->input('stock_qty', 0));

        $error = ($name === '' || $generic === '' || $category === '' || $price <= 0)
            ? 'Brand name, generic name, category, and price are required.'
            : null;

        return [$name, $generic, $category, $price, $stock, $error];
    }
}
