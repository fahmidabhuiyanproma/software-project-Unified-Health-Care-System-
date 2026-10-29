<?php

namespace App\Http\Controllers\PharmacyAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresOwnedProvider;
use App\Http\Controllers\Controller;
use App\Models\Medicine;
use App\Models\Pharmacy;
use App\Models\PharmacyOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Ports api/pharmacy-admin/dashboard.php. */
class DashboardController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    public function index(Request $request): JsonResponse
    {
        $pharmacy = $this->ownedProviderOrFail($request->user(), Pharmacy::class);
        if ($pharmacy instanceof JsonResponse) {
            return $pharmacy;
        }

        $today = Carbon::today();

        $ordersToday = PharmacyOrder::where('pharmacy_id', $pharmacy->id)->whereDate('created_at', $today)->count();
        $pendingToday = PharmacyOrder::where('pharmacy_id', $pharmacy->id)->whereDate('created_at', $today)->where('status', 'pending')->count();

        // Revenue only counts once an order is actually delivered.
        $revenueToday = (float) PharmacyOrder::where('pharmacy_id', $pharmacy->id)->whereDate('created_at', $today)->where('status', 'delivered')->sum('total_amount');
        $revenueYesterday = (float) PharmacyOrder::where('pharmacy_id', $pharmacy->id)->whereDate('created_at', $today->copy()->subDay())->where('status', 'delivered')->sum('total_amount');

        $totalProducts = Medicine::where('pharmacy_id', $pharmacy->id)->count();
        $lowStockCount = Medicine::where('pharmacy_id', $pharmacy->id)->whereBetween('stock_qty', [1, 49])->count();

        $orders = PharmacyOrder::with('patient')
            ->withCount('items')
            ->where('pharmacy_id', $pharmacy->id)
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (PharmacyOrder $o) => [
                'id' => 'ORD-'.$o->id,
                'patient' => $o->patient->full_name,
                'items' => $o->items_count,
                'total' => '৳ '.number_format((float) $o->total_amount),
                'time' => optional($o->created_at)->toDateTimeString(),
                'status' => $o->status,
            ]);

        $lowStock = Medicine::where('pharmacy_id', $pharmacy->id)
            ->whereBetween('stock_qty', [1, 49])
            ->orderBy('stock_qty')
            ->limit(8)
            ->pluck('name');

        return $this->ok([
            'pharmacy' => [
                'name' => $pharmacy->name,
                'location' => trim(implode(', ', array_filter([$pharmacy->address, $pharmacy->city]))) ?: null,
            ],
            'stats' => [
                'ordersToday' => $ordersToday,
                'pendingToday' => $pendingToday,
                'revenueToday' => $revenueToday,
                'revenueYesterday' => $revenueYesterday,
                'totalProducts' => $totalProducts,
                'lowStockCount' => $lowStockCount,
            ],
            'recentOrders' => $orders,
            'lowStock' => $lowStock,
        ]);
    }
}
