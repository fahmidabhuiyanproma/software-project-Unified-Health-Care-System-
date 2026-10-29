<?php

namespace App\Http\Controllers\SystemAdmin;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Ports api/system-admin/settings.php. */
class SettingsController extends Controller
{
    use ApiResponse;

    private const KEYS = ['platform_name', 'currency', 'support_email', 'sms_notifications', 'email_notifications', 'push_notifications'];

    public function index(): JsonResponse
    {
        $settings = PlatformSetting::pluck('setting_value', 'setting_key');

        return $this->ok(['settings' => $settings]);
    }

    public function update(Request $request): JsonResponse
    {
        foreach (self::KEYS as $key) {
            if (! $request->has($key)) {
                continue;
            }
            $raw = $request->input($key);
            $value = is_bool($raw) ? ($raw ? '1' : '0') : trim((string) $raw);

            DB::table('platform_settings')->updateOrInsert(['setting_key' => $key], ['setting_value' => $value]);
        }

        return $this->ok(['message' => 'Settings saved.']);
    }
}
