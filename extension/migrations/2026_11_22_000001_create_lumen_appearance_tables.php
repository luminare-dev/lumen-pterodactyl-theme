<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lumen theme: the active token set and each user's light/dark/system choice.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('lumen_appearance', function (Blueprint $table) {
            $table->increments('id');
            $table->string('key', 32)->unique();
            $table->longText('tokens');
            $table->unsignedInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('lumen_user_preferences', function (Blueprint $table) {
            $table->unsignedInteger('user_id')->primary();
            $table->string('mode', 8);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lumen_user_preferences');
        Schema::dropIfExists('lumen_appearance');
    }
};
