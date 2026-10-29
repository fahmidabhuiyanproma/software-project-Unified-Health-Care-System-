<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** platform_settings — string PK (`setting_key`), key/value store, no timestamps. */
class PlatformSetting extends Model
{
    protected $table = 'platform_settings';

    protected $primaryKey = 'setting_key';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = ['setting_key', 'setting_value'];
}
