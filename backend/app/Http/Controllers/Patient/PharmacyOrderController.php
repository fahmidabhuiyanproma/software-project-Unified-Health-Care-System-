<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\Medicine;
use App\Models\Payment;
use App\Models\Pharmacy;
use App\Models\PharmacyOrder;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Ports api/patient/pharmacy_order.php (FR-6.1, FR-7.1/7.2). */
class PharmacyOrderController extends Controller
{
    use ApiResponse;

    public function store(Request $request): JsonResponse
    {
        $patientId = $request->user()->id;

        $items = is_array($request->input('items')) ? $request->input('items') : [];
        $paymentMethod = (string) $request->input('payment_method', '');

        if (count($items) === 0) {
            return $this->fail('Your cart is empty.', 422);
        }
        if (! in_array($paymentMethod, ['bkash', 'nagad', 'rocket'], true)) {
            return $this->fail('Please select a valid payment method.', 422);
        }

        try {
            $result = DB::transaction(function () use ($items, $patientId, $paymentMethod) {
                $subtotal = 0;
                $lineItems = [];
                $pharmacyId = null;

                foreach ($items as $item) {
                    $medId = (int) ($item['id'] ?? 0);
                    $qty = max(1, (int) ($item['qty'] ?? 0));

                    $med = Medicine::where('id', $medId)->lockForUpdate()->first();
                    if (! $med) {
                        throw new \RuntimeException('One of the items in your cart no longer exists.');
                    }
                    if ($med->stock_qty < $qty) {
                        throw new \RuntimeException("{$med->name} does not have enough stock.");
                    }
                    $pharmacyId = $pharmacyId ?? $med->pharmacy_id;

                    $lineItems[] = ['medicine_id' => $med->id, 'qty' => $qty, 'price' => $med->price];
                    $subtotal += $med->price * $qty;
                }

                $deliveryFee = 50;
                $total = $subtotal + $deliveryFee;

                $order = PharmacyOrder::create([
                    'patient_id' => $patientId,
                    'pharmacy_id' => $pharmacyId,
                    'subtotal' => $subtotal,
                    'delivery_fee' => $deliveryFee,
                    'total_amount' => $total,
                    'payment_method' => $paymentMethod,
                ]);

                foreach ($lineItems as $li) {
                    $order->items()->create([
                        'medicine_id' => $li['medicine_id'],
                        'quantity' => $li['qty'],
                        'unit_price' => $li['price'],
                    ]);
                    Medicine::where('id', $li['medicine_id'])->decrement('stock_qty', $li['qty']);
                }

                $txnRef = 'TXN-'.strtoupper(bin2hex(random_bytes(5)));
                Payment::create([
                    'patient_id' => $patientId,
                    'reference_type' => 'pharmacy_order',
                    'reference_id' => $order->id,
                    'amount' => $total,
                    'method' => $paymentMethod,
                    'transaction_ref' => $txnRef,
                ]);

                return [
                    'order' => $order,
                    'pharmacy_id' => $pharmacyId,
                    'txn_ref' => $txnRef,
                    'total' => $total,
                    'item_count' => count($lineItems),
                ];
            });
        } catch (\RuntimeException $e) {
            return $this->fail($e->getMessage() ?: 'Could not place order.', 422);
        }

        $order = $result['order'];

        NotificationService::send($patientId, 'shopping-bag', 'Order Placed', "Your order #ORD-{$order->id} has been placed and is being processed.");

        $pharmOwnerId = Pharmacy::where('id', $result['pharmacy_id'])->value('owner_user_id');
        if ($pharmOwnerId) {
            $patientName = $request->user()->full_name ?: 'A patient';
            $itemCount = $result['item_count'];
            NotificationService::send((int) $pharmOwnerId, 'shopping-bag', 'New Order', "{$patientName} placed order #ORD-{$order->id} ({$itemCount} item".($itemCount === 1 ? '' : 's').", ৳".number_format($result['total']).').');
        }

        return $this->ok([
            'order_id' => $order->id,
            'order_label' => 'ORD-'.$order->id,
            'transaction_ref' => $result['txn_ref'],
            'total' => $result['total'],
            'message' => 'Order placed successfully.',
        ]);
    }
}
