/* ==========================================================================
   SynCura — profile.js
   The shared "My Profile" page: photo, personal details, doctor fee/specialty,
   organization details and password — for every role.
   ========================================================================== */
(function () {
  'use strict';

  var roleNames = { patient: 'Patient', doctor: 'Doctor', hospital: 'Hospital admin', lab: 'Lab admin', pharmacy: 'Pharmacy admin', admin: 'System admin' };
  var orgTitles = { hospital: 'Hospital details', lab: 'Lab details', pharmacy: 'Pharmacy details' };

  function apiUrl(path) { return SC.base() + 'api/' + path; }
  function send(options) {
    return fetch(apiUrl('common/profile.php'), Object.assign({ credentials: 'same-origin' }, options)).then(function (r) {
      if (r.status === 401) SC.sessionExpired();
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    });
  }
  function postJson(body) {
    return send({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  function $(id) { return document.getElementById(id); }
  function show(box, ok, text) {
    box.textContent = text;
    box.style.display = 'block';
    box.style.background = ok ? 'var(--green-50)' : 'var(--red-50)';
    box.style.color = ok ? '#15803d' : 'var(--red-600)';
  }

  var profile = null;

  function paintAvatar(url, name) {
    var el = $('profileAvatar');
    el.style.backgroundImage = url ? 'url("' + encodeURI(url).replace(/"/g, '%22') + '")' : '';
    el.style.backgroundSize = url ? 'cover' : '';
    el.style.backgroundPosition = url ? 'center' : '';
    el.textContent = url ? '' : SC.initials(name).toUpperCase();
    $('removePhotoBtn').style.display = url ? '' : 'none';
  }

  function fill(p) {
    profile = p;
    var u = p.user;
    $('profileName').textContent = u.name;
    $('profileRole').textContent = roleNames[u.role] || u.role;
    $('profileSince').textContent = 'Member since ' + new Date(u.memberSince.replace(' ', 'T')).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    $('pfName').value = u.name;
    $('pfPhone').value = u.phone || '';
    $('pfEmail').value = u.email || '';
    paintAvatar(u.avatar, u.name);

    if (p.doctor) {
      $('doctorSection').style.display = 'block';
      $('pfSpecialty').value = p.doctor.specialty;
      $('pfFee').value = p.doctor.fee;
      $('pfExperience').value = p.doctor.experience;
      $('pfBio').value = p.doctor.bio || '';
    }
    if (p.organization) {
      $('orgSection').style.display = 'block';
      $('orgTitle').textContent = orgTitles[u.role] || 'Organization';
      $('pfOrgName').value = p.organization.name || '';
      $('pfOrgAddress').value = p.organization.address || '';
      $('pfOrgCity').value = p.organization.city || '';
      $('pfOrgPhone').value = p.organization.phone || '';
    }
    // Keep the navbar (name + photo) in step with the server.
    SC.updateUser({ name: u.name, avatar: u.avatar || '' });
    SC.icons();
  }

  function load() {
    send({}).then(function (result) {
      if (!result.ok || !result.data.success) {
        show($('profileMsg'), false, (result.data && result.data.message) || 'Could not load your profile.');
        return;
      }
      fill(result.data);
    });
  }

  // ---- personal details / doctor / organization
  $('profileForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var body = { action: 'update', full_name: $('pfName').value.trim(), phone: $('pfPhone').value.trim(), email: $('pfEmail').value.trim() };
    if (profile && profile.doctor) {
      body.doctor = { specialty: $('pfSpecialty').value.trim(), fee: $('pfFee').value, experience: $('pfExperience').value || 0, bio: $('pfBio').value.trim() };
    }
    if (profile && profile.organization) {
      body.organization = { name: $('pfOrgName').value.trim(), address: $('pfOrgAddress').value.trim(), city: $('pfOrgCity').value.trim(), phone: $('pfOrgPhone').value.trim() };
    }
    var btn = $('saveProfileBtn');
    btn.disabled = true;
    postJson(body).then(function (result) {
      btn.disabled = false;
      if (!result.ok || !result.data.success) {
        show($('profileMsg'), false, (result.data && result.data.message) || 'Could not save your profile.');
        return;
      }
      fill(result.data);
      show($('profileMsg'), true, 'Profile saved.');
    });
  });

  // ---- photo
  $('changePhotoBtn').addEventListener('click', function () { $('avatarInput').click(); });
  $('avatarInput').addEventListener('change', function () {
    var file = this.files[0];
    this.value = '';
    if (!file) return;
    var box = $('avatarMsg');
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { show(box, false, 'Please choose a JPG, PNG, WebP or GIF image.'); return; }
    if (file.size > 2 * 1024 * 1024) { show(box, false, 'Please choose an image under 2 MB.'); return; }
    var form = new FormData();
    form.append('avatar', file);
    show(box, true, 'Uploading…');
    send({ method: 'POST', body: form }).then(function (result) {
      if (!result.ok || !result.data.success) { show(box, false, (result.data && result.data.message) || 'Upload failed.'); return; }
      profile.user.avatar = result.data.avatar;
      paintAvatar(result.data.avatar, profile.user.name);
      SC.updateUser({ avatar: result.data.avatar });
      show(box, true, 'Profile picture updated.');
    });
  });
  $('removePhotoBtn').addEventListener('click', function () {
    postJson({ action: 'remove_avatar' }).then(function (result) {
      if (!result.ok || !result.data.success) { show($('avatarMsg'), false, (result.data && result.data.message) || 'Could not remove the picture.'); return; }
      profile.user.avatar = null;
      paintAvatar(null, profile.user.name);
      SC.updateUser({ avatar: '' });
      show($('avatarMsg'), true, 'Profile picture removed.');
    });
  });

  // ---- password
  $('passwordForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('savePasswordBtn');
    btn.disabled = true;
    postJson({ action: 'password', current_password: $('pwCurrent').value, new_password: $('pwNew').value, confirm_password: $('pwConfirm').value }).then(function (result) {
      btn.disabled = false;
      if (!result.ok || !result.data.success) { show($('passwordMsg'), false, (result.data && result.data.message) || 'Could not change your password.'); return; }
      $('passwordForm').reset();
      show($('passwordMsg'), true, 'Password changed.');
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (!SC.requireAuth()) return;
    SC.renderShell();
    load();
  });
})();
