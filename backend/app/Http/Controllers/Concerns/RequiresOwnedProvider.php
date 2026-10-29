<?php

namespace App\Http\Controllers\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;

/** Mirrors api/_bootstrap.php's requireOwnedProvider(): 403 if no hospital/lab/pharmacy row is owned by this account. */
trait RequiresOwnedProvider
{
    /** @param class-string<Model> $modelClass */
    protected function ownedProviderOrFail(User $user, string $modelClass): Model|JsonResponse
    {
        $provider = $modelClass::where('owner_user_id', $user->id)->first();
        if (! $provider) {
            return $this->fail('No provider organization is linked to this account yet.', 403);
        }

        return $provider;
    }
}
