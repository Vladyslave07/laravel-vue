<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\ScrapeController;

Route::get('/', function () {
    return Inertia::render('Welcome');
})->name('home');

Route::get('dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');
Route::get('test', function () {
    return view('test');
})->name('test');
Route::get('iaai', function () {
    return Inertia::render('IAAI');
})->middleware(['auth', 'verified'])->name('iaai');
Route::get('/iaai-html', [ScrapeController::class, 'fetchIAAI'])
    ->middleware(['auth']);
Route::get('copart', function () {
    return Inertia::render('Copart');
})->middleware(['auth', 'verified'])->name('copart');
Route::get('/copart-html', [ScrapeController::class, 'fetchCopart'])
    ->middleware(['auth']);
Route::get('/proxy-copart', [ScrapeController::class, 'proxyCopart']);

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
