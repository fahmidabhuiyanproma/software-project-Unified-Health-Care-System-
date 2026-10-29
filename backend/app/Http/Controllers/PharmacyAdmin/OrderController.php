<?php

namespace App\Http\Controllers\PharmacyAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Concerns\RequiresOwnedProvider;
use App\Http\Controllers\Controller;
use App\Models\Pharmacy;
use App\Models\PharmacyOrder;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Ports api/pharmacy-admin/orders.php (FR-6.2). */
class OrderController extends Controller
{
    use ApiResponse, RequiresOwnedProvider;

    private const STATUS_FLOW = ['pending' => 'processing', 'processing' => 'delivered'];

    public function index(Request $request): JsonResponse
    {
        $pharmacy = $this->ownedProviderOrFail($request->user(), Pharmacy::class);
        if ($pharmacy instanceof JsonResponse) {
            return $pharmacy;
        }

        $orders = PharmacyOrder::with(['patient', 'items.medicine'])
            ->where('pharmacy_id', $pharmacy->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (PharmacyOrder $o) => [
                'id' => 'ORD-'.$o->id,
                'order_id' => $o->id,
                'patient' => $o->patient->full_name,
                'phone' => $o->patient->phone,
                'items' => $o->items->map(fn ($i) => "{$i->medicine->name} ×{$i->quantity}"),
                'total' => '৳ '.number_format((float) $o->total_amount),
                'date' => $o->created_at->format('M j, Y'),
                'time' => $o->created_at->format('g:i A'),
                'status' => $o->status,
            ]);

        return $this->ok(['orders' => $orders]);
    }

    public function advance(Request $request, int $id): JsonResponse
    {
        $pharmacy = $this->ownedProviderOrFail($request->user(), Pharmacy::class);
        if ($pharmacy instanceof JsonResponse) {
            return $pharmacy;
        }

        $order = PharmacyOrder::where('id', $id)->where('pharmacy_id', $pharmacy->id)->first();
        if (! $order) {
            return $this->fail('Order not found.', 404);
        }

        $next = self::STATUS_FLOW[$order->status] ?? null;
        if (! $next) {
            return $this->fail('This order has already been delivered.', 409);
        }

        $order->update(['status' => $next]);
        NotificationService::send((int) $order->patient_id, 'shopping-bag', 'Order Update', "Your order #ORD-{$order->id} is now {$next}.");

        return $this->ok(['message' => "Order marked as {$next}."]);
    }
}
