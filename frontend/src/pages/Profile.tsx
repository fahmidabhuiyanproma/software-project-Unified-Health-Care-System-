import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api';
import { Icon } from '../components/Icon';
import { useAuth, type Role } from '../context/AuthContext';

interface ProfileUser { id: number; name: string; email: string | null; phone: string; role: Role; status: string; avatar: string | null; memberSince: string }
interface DoctorInfo { specialty: string; experience: number; fee: number; bio: string | null }
interface OrgInfo { name: string; address: string | null; city: string | null; phone: string | null }
interface ProfileData { user: ProfileUser; doctor: DoctorInfo | null; organization: OrgInfo | null }

const ROLE_NAMES: Record<Role, string> = { patient: 'Patient', doctor: 'Doctor', hospital: 'Hospital admin', lab: 'Lab admin', pharmacy: 'Pharmacy admin', admin: 'System admin' };
const ORG_TITLES: Partial<Record<Role, string>> = { hospital: 'Hospital details', lab: 'Lab details', pharmacy: 'Pharmacy details' };

function initials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Ports pages/profile.html + js/profile.js — shared "My Profile" page for every role. */
export function Profile() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [fee, setFee] = useState('');
  const [experience, setExperience] = useState('');
  const [bio, setBio] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgCity, setOrgCity] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fill = (p: ProfileData) => {
    setProfile(p);
    setName(p.user.name);
    setPhone(p.user.phone || '');
    setEmail(p.user.email || '');
    if (p.doctor) {
      setSpecialty(p.doctor.specialty);
      setFee(String(p.doctor.fee));
      setExperience(String(p.doctor.experience));
      setBio(p.doctor.bio || '');
    }
    if (p.organization) {
      setOrgName(p.organization.name || '');
      setOrgAddress(p.organization.address || '');
      setOrgCity(p.organization.city || '');
      setOrgPhone(p.organization.phone || '');
    }
    updateUser({ name: p.user.name, avatar: p.user.avatar });
  };

  const load = async () => {
    const res = await apiRequest<ProfileData>('get', '/api/profile');
    if (!res.ok) {
      setProfileMsg({ ok: false, text: res.data.message ?? 'Could not load your profile.' });
      return;
    }
    fill(res.data);
  };

  useEffect(() => { load(); }, []);

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    const body: Record<string, unknown> = { full_name: name.trim(), phone: phone.trim(), email: email.trim() };
    if (profile?.doctor) {
      body.doctor = { specialty: specialty.trim(), fee, experience: experience || 0, bio: bio.trim() };
    }
    if (profile?.organization) {
      body.organization = { name: orgName.trim(), address: orgAddress.trim(), city: orgCity.trim(), phone: orgPhone.trim() };
    }
    const res = await apiRequest<ProfileData>('put', '/api/profile', body);
    setSavingProfile(false);
    if (!res.ok) {
      setProfileMsg({ ok: false, text: res.data.message ?? 'Could not save your profile.' });
      return;
    }
    fill(res.data);
    setProfileMsg({ ok: true, text: 'Profile saved.' });
  };

  const onAvatarSelected = async (file: File) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setAvatarMsg({ ok: false, text: 'Please choose a JPG, PNG, WebP or GIF image.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarMsg({ ok: false, text: 'Please choose an image under 2 MB.' });
      return;
    }
    setAvatarMsg({ ok: true, text: 'Uploading…' });
    const form = new FormData();
    form.append('avatar', file);
    const res = await apiRequest<{ avatar: string }>('post', '/api/profile/avatar', form);
    if (!res.ok) {
      setAvatarMsg({ ok: false, text: res.data.message ?? 'Upload failed.' });
      return;
    }
    setProfile((p) => (p ? { ...p, user: { ...p.user, avatar: res.data.avatar } } : p));
    updateUser({ avatar: res.data.avatar });
    setAvatarMsg({ ok: true, text: 'Profile picture updated.' });
  };

  const removeAvatar = async () => {
    const res = await apiRequest<{ message: string }>('delete', '/api/profile/avatar');
    if (!res.ok) {
      setAvatarMsg({ ok: false, text: res.data.message ?? 'Could not remove the picture.' });
      return;
    }
    setProfile((p) => (p ? { ...p, user: { ...p.user, avatar: null } } : p));
    updateUser({ avatar: null });
    setAvatarMsg({ ok: true, text: 'Profile picture removed.' });
  };

  const onSavePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMsg(null);
    const res = await apiRequest<{ message: string }>('put', '/api/profile/password', {
      current_password: pwCurrent, new_password: pwNew, confirm_password: pwConfirm,
    });
    setSavingPassword(false);
    if (!res.ok) {
      setPasswordMsg({ ok: false, text: res.data.message ?? 'Could not change your password.' });
      return;
    }
    setPwCurrent(''); setPwNew(''); setPwConfirm('');
    setPasswordMsg({ ok: true, text: 'Password changed.' });
  };

  if (!profile) return null;

  const avatarStyle = profile.user.avatar
    ? { backgroundImage: `url("${encodeURI(profile.user.avatar).replace(/"/g, '%22')}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <>
      <div className="page-header"><div><h1>My Profile</h1><p>Manage your photo, personal details and password</p></div></div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-6 h-fit" style={{ textAlign: 'center' }}>
          <div className="avatar avatar-round" style={{ width: '7rem', height: '7rem', fontSize: '2.25rem', margin: '0 auto 1rem', ...avatarStyle }}>
            {!profile.user.avatar && initials(profile.user.name)}
          </div>
          <div className="font-semibold text-gray-800 font-heading">{profile.user.name}</div>
          <div className="text-sm" style={{ color: 'var(--purple-700)' }}>{ROLE_NAMES[profile.user.role] || profile.user.role}</div>
          <div className="text-xs text-gray-400 mt-1">Member since {new Date(profile.user.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>

          <input
            ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onAvatarSelected(f); }}
          />
          <div className="flex gap-2 mt-4" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-brand btn-sm" onClick={() => fileInputRef.current?.click()}><Icon name="camera" className="icon icon-13" /> Change photo</button>
            {profile.user.avatar && <button type="button" className="btn btn-secondary btn-sm" onClick={removeAvatar}>Remove</button>}
          </div>
          <div className="text-xs text-gray-400 mt-3">JPG, PNG, WebP or GIF · up to 2 MB</div>
          {avatarMsg && <div className="text-sm mt-3" style={{ color: avatarMsg.ok ? '#15803d' : 'var(--red-600)' }}>{avatarMsg.text}</div>}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <form className="card p-6" onSubmit={onSaveProfile}>
            <h3 className="font-semibold text-gray-800 mb-4 font-heading">Personal details</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="form-group"><label className="form-label">Full name<span className="req">*</span></label><input className="form-input" maxLength={150} value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Phone<span className="req">*</span></label><input className="form-input" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Email</label><input type="email" className="form-input" maxLength={190} placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>

            {profile.doctor && (
              <div>
                <h3 className="font-semibold text-gray-800 mt-6 mb-4 font-heading">Doctor profile</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="form-group"><label className="form-label">Specialty<span className="req">*</span></label><input className="form-input" maxLength={100} value={specialty} onChange={(e) => setSpecialty(e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Appointment fee (৳)<span className="req">*</span></label><input type="number" min={0} step={1} className="form-input" value={fee} onChange={(e) => setFee(e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Experience (years)</label><input type="number" min={0} max={80} className="form-input" value={experience} onChange={(e) => setExperience(e.target.value)} /></div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">About you</label><textarea rows={4} className="form-textarea" maxLength={2000} placeholder="A short introduction patients will see on your profile" value={bio} onChange={(e) => setBio(e.target.value)} /></div>
                </div>
              </div>
            )}

            {profile.organization && (
              <div>
                <h3 className="font-semibold text-gray-800 mt-6 mb-4 font-heading">{ORG_TITLES[profile.user.role] || 'Organization'}</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Name<span className="req">*</span></label><input className="form-input" maxLength={150} value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Address</label><input className="form-input" maxLength={255} value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">City</label><input className="form-input" maxLength={100} value={orgCity} onChange={(e) => setOrgCity(e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input className="form-input" maxLength={20} value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} /></div>
                </div>
              </div>
            )}

            {profileMsg && (
              <div className="text-sm rounded-xl mt-4" style={{ padding: '.75rem 1rem', background: profileMsg.ok ? 'var(--green-50)' : 'var(--red-50)', color: profileMsg.ok ? '#15803d' : 'var(--red-600)' }}>{profileMsg.text}</div>
            )}
            <button type="submit" className="btn btn-brand mt-4" disabled={savingProfile}>Save changes</button>
          </form>

          <form className="card p-6" onSubmit={onSavePassword}>
            <h3 className="font-semibold text-gray-800 mb-4 font-heading">Change password</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Current password</label><input type="password" className="form-input" autoComplete="current-password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">New password</label><input type="password" className="form-input" minLength={8} placeholder="At least 8 characters" autoComplete="new-password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Confirm new password</label><input type="password" className="form-input" autoComplete="new-password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} /></div>
            </div>
            {passwordMsg && (
              <div className="text-sm rounded-xl mt-4" style={{ padding: '.75rem 1rem', background: passwordMsg.ok ? 'var(--green-50)' : 'var(--red-50)', color: passwordMsg.ok ? '#15803d' : 'var(--red-600)' }}>{passwordMsg.text}</div>
            )}
            <button type="submit" className="btn btn-secondary mt-4" disabled={savingPassword}>Update password</button>
          </form>
        </div>
      </div>
    </>
  );
}
