<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Mirrors api/_bootstrap.php's requireLogin(): 401 JSON if no session, no role restriction. */
class EnsureAuthenticated
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()) {
            return response()->json(['success' => false, 'message' => 'Please sign in to continue.'], 401);
        }

        return $next($request);
    }
}
