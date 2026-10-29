<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\JsonResponse;

/** Same {success, message, ...} JSON envelope the old api/_bootstrap.php's respond() used. */
trait ApiResponse
{
    protected function ok(array $payload = [], int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, ...$payload], $status);
    }

    protected function fail(string $message, int $status = 400, array $extra = []): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message, ...$extra], $status);
    }
}
