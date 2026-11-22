<?php

/*
| Lumen theme web routes, prefixed by Blueprint with /extensions/lumen.
| The group already runs the session and CSRF middleware.
*/

use Illuminate\Support\Facades\Route;
use Pterodactyl\BlueprintFramework\Extensions\lumen\Http\ModeController;
use Pterodactyl\BlueprintFramework\Extensions\lumen\Http\MediaController;

Route::post('/mode', [ModeController::class, 'store'])->middleware('auth')->name('lumen.mode');
Route::get('/media/{name}', [MediaController::class, 'show'])
    ->where('name', '[a-z0-9-]+\.[a-z]+')
    ->name('lumen.media');
