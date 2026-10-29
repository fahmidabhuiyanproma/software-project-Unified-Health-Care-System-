<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Mirrors api/_bootstrap.php's requireRole(): 401 if not signed in,
 * 403 if signed in but the wrong role. Usage: ->middleware('role:doctor')
 * or ->middleware('role:patient,doctor').
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Please sign in to continue.'], 401);
        }

        if (! in_array($user->role, $roles, true)) {
            return response()->json(['success' => false, 'message' => 'You are not authorized to access this resource.'], 403);
        }

        return $next($request);
    }
}
