<?php

namespace App\Http\Controllers;

use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Serves uploaded avatars straight from the real, unmoved assets/avatars/
 * folder at the project root — same as the old app's plain public URL
 * under the web root, no auth gate (avatars have always been public URLs).
 */
class AvatarController extends Controller
{
    public function show(string $filename): BinaryFileResponse
    {
        $path = dirname(base_path()).'/assets/avatars/'.basename($filename);

        abort_unless(is_file($path), 404);

        return response()->file($path);
    }
}
