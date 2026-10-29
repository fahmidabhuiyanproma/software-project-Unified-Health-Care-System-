<?php

use App\Http\Controllers\AvatarController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Public avatar files, served straight from the real assets/avatars/ folder
// at the project root — not under /api since it's a plain file URL, same as
// the old app's static /assets/avatars/<file> links.
Route::get('/avatars/{filename}', [AvatarController::class, 'show'])
    ->where('filename', '[A-Za-z0-9_.-]+');
