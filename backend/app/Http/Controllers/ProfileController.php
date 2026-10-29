<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ApiResponse;
use App\Models\Doctor;
use App\Models\Hospital;
use App\Models\Lab;
use App\Models\Pharmacy;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Ports api/common/profile.php (FR-1.5), split into REST-shaped actions
 * instead of one file multiplexed on an "action" body field. Same
 * validation rules, same side effects (a doctor's name/specialty/photo
 * mirror onto the `doctors` directory row patients see in Find Doctors).
 */
class ProfileController extends Controller
{
    use ApiResponse;

    private const ORG_MODELS = ['hospital' => Hospital::class, 'lab' => Lab::class, 'pharmacy' => Pharmacy::class];
    private const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
    private const AVATAR_EXT_BY_IMAGETYPE = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        IMAGETYPE_WEBP => 'webp',
        IMAGETYPE_GIF => 'gif',
    ];

    public function show(Request $request): JsonResponse
    {
        return $this->ok($this->loadProfile($request->user()));
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $fullName = trim((string) $request->input('full_name', ''));
        $email = trim((string) $request->input('email', ''));
        $phone = trim((string) $request->input('phone', ''));

        if ($fullName === '' || $phone === '') {
            return $this->fail('Full name and phone number are required.', 422);
        }
        if (mb_strlen($fullName) > 150) {
            return $this->fail('Name is too long.', 422);
        }
        if ($email !== '' && ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->fail('Please enter a valid email address.', 422);
        }
        if (! preg_match('/^[+0-9][0-9 +\-()]{5,19}$/', $phone)) {
            return $this->fail('Please enter a valid phone number.', 422);
        }

        $duplicate = User::where('id', '<>', $user->id)
            ->where(function ($q) use ($phone, $email) {
                $q->where('phone', $phone);
                if ($email !== '') {
                    $q->orWhere('email', $email);
                }
            })
            ->exists();
        if ($duplicate) {
            return $this->fail('Another account already uses this phone or email.', 409);
        }

        $doctorData = null;
        if ($user->role === 'doctor' && is_array($request->input('doctor'))) {
            $d = $request->input('doctor');
            $specialty = trim((string) ($d['specialty'] ?? ''));
            $fee = $d['fee'] ?? null;
            $experience = $d['experience'] ?? 0;
            $bio = trim((string) ($d['bio'] ?? ''));

            if ($specialty === '' || mb_strlen($specialty) > 100) {
                return $this->fail('Please enter your specialty (up to 100 characters).', 422);
            }
            if (! is_numeric($fee) || (float) $fee < 0 || (float) $fee > 1000000) {
                return $this->fail('Please enter a valid appointment fee.', 422);
            }
            if (! is_numeric($experience) || (int) $experience < 0 || (int) $experience > 80) {
                return $this->fail('Experience must be between 0 and 80 years.', 422);
            }
            if (mb_strlen($bio) > 2000) {
                return $this->fail('Bio is too long (2000 characters max).', 422);
            }
            $doctorData = [
                'specialty' => $specialty,
                'fee' => (float) $fee,
                'experience' => (int) $experience,
                'bio' => $bio !== '' ? $bio : null,
            ];
        }

        $orgData = null;
        if (isset(self::ORG_MODELS[$user->role]) && is_array($request->input('organization'))) {
            $o = $request->input('organization');
            $orgName = trim((string) ($o['name'] ?? ''));
            $orgPhone = trim((string) ($o['phone'] ?? ''));
            if ($orgName === '' || mb_strlen($orgName) > 150) {
                return $this->fail('Please enter your organization name.', 422);
            }
            if ($orgPhone !== '' && ! preg_match('/^[+0-9][0-9 +\-()]{5,19}$/', $orgPhone)) {
                return $this->fail('Please enter a valid organization phone number.', 422);
            }
            $orgData = [
                'name' => $orgName,
                'phone' => $orgPhone !== '' ? $orgPhone : null,
                'address' => trim((string) ($o['address'] ?? '')) ?: null,
                'city' => trim((string) ($o['city'] ?? '')) ?: null,
            ];
        }

        try {
            DB::transaction(function () use ($user, $fullName, $email, $phone, $doctorData, $orgData) {
                $user->update([
                    'full_name' => $fullName,
                    'email' => $email !== '' ? $email : null,
                    'phone' => $phone,
                ]);

                if ($user->role === 'doctor') {
                    Doctor::where('user_id', $user->id)->update(['full_name' => $fullName]);
                    if ($doctorData) {
                        Doctor::where('user_id', $user->id)->update([
                            'specialty' => $doctorData['specialty'],
                            'consultation_fee' => $doctorData['fee'],
                            'experience_years' => $doctorData['experience'],
                            'bio' => $doctorData['bio'],
                        ]);
                    }
                }
                if ($orgData) {
                    self::ORG_MODELS[$user->role]::where('owner_user_id', $user->id)->update($orgData);
                }
            });
        } catch (\Throwable $e) {
            return $this->fail('Could not save your profile. Please try again.', 500);
        }

        $profile = $this->loadProfile($user->fresh());
        $profile['message'] = 'Profile saved.';

        return $this->ok($profile);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $current = (string) $request->input('current_password', '');
        $new = (string) $request->input('new_password', '');
        $confirm = (string) $request->input('confirm_password', '');

        if ($current === '' || $new === '' || $confirm === '') {
            return $this->fail('Please fill in all password fields.', 422);
        }
        if (strlen($new) < 8) {
            return $this->fail('New password must be at least 8 characters.', 422);
        }
        if ($new !== $confirm) {
            return $this->fail('New passwords do not match.', 422);
        }
        if (! Hash::check($current, $user->password_hash)) {
            return $this->fail('Your current password is incorrect.', 403);
        }

        $user->update(['password_hash' => Hash::make($new)]);

        return $this->ok(['message' => 'Password changed.']);
    }

    public function uploadAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $request->hasFile('avatar') || ! $request->file('avatar')->isValid()) {
            return $this->fail('The upload failed. Please try again.', 422);
        }
        $file = $request->file('avatar');
        if ($file->getSize() > self::AVATAR_MAX_BYTES) {
            return $this->fail('Please choose an image under 2 MB.', 422);
        }

        $imageInfo = @getimagesize($file->getRealPath());
        if ($imageInfo === false || ! isset(self::AVATAR_EXT_BY_IMAGETYPE[$imageInfo[2]])) {
            return $this->fail('Please choose a JPG, PNG, WebP or GIF image.', 422);
        }

        $avatarDir = $this->avatarDir();
        if (! is_dir($avatarDir) && ! mkdir($avatarDir, 0755, true)) {
            return $this->fail('Could not store the image.', 500);
        }

        $filename = 'u'.$user->id.'_'.bin2hex(random_bytes(6)).'.'.self::AVATAR_EXT_BY_IMAGETYPE[$imageInfo[2]];
        try {
            $file->move($avatarDir, $filename);
        } catch (\Throwable $e) {
            return $this->fail('Could not store the image.', 500);
        }

        $url = url('/avatars/'.$filename);

        $old = $user->avatar_url;
        $user->update(['avatar_url' => $url]);
        Doctor::where('user_id', $user->id)->update(['photo_url' => $url]);
        $this->deleteAvatarFile($old);

        return $this->ok(['message' => 'Profile picture updated.', 'avatar' => $url]);
    }

    public function removeAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        $old = $user->avatar_url;
        $user->update(['avatar_url' => null]);
        Doctor::where('user_id', $user->id)->update(['photo_url' => null]);
        $this->deleteAvatarFile($old);

        return $this->ok(['message' => 'Profile picture removed.']);
    }

    /** Same physical folder the old app wrote to — project_root/assets/avatars, not moved into Laravel's storage/. */
    private function avatarDir(): string
    {
        return dirname(base_path()).'/assets/avatars';
    }

    private function deleteAvatarFile(?string $url): void
    {
        if (! $url || ! str_contains($url, '/avatars/')) {
            return;
        }
        $path = $this->avatarDir().'/'.basename($url);
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private function loadProfile(User $user): array
    {
        $doctor = null;
        if ($user->role === 'doctor') {
            $d = Doctor::where('user_id', $user->id)->first();
            if ($d) {
                $doctor = [
                    'specialty' => $d->specialty,
                    'experience' => (int) $d->experience_years,
                    'fee' => (float) $d->consultation_fee,
                    'bio' => $d->bio,
                ];
            }
        }

        $organization = null;
        if (isset(self::ORG_MODELS[$user->role])) {
            $org = self::ORG_MODELS[$user->role]::where('owner_user_id', $user->id)->first(['name', 'address', 'city', 'phone']);
            if ($org) {
                $organization = $org->toArray();
            }
        }

        return [
            'user' => [
                'id' => (int) $user->id,
                'name' => $user->full_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'status' => $user->status,
                'avatar' => $user->avatar_url,
                'memberSince' => optional($user->created_at)->toIso8601String(),
            ],
            'doctor' => $doctor,
            'organization' => $organization,
        ];
    }
}
