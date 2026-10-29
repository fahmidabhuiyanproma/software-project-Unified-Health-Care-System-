/* ==========================================================================
   SynCura — auth.js
   Login, Register, and Role Select page behaviour.
   Talks to the PHP/MySQL backend under /api.
   ========================================================================== */

(function () {
  'use strict';

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function goToRoleHome(role) {
    window.location.href = SC.base() + SC.roleHome[role];
  }

  function apiUrl(path) {
    return SC.base() + 'api/' + path;
  }

  function postJson(path, body) {
    return fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    });
  }
  function getJson(path) {
    return fetch(apiUrl(path), { credentials: 'same-origin' }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    });
  }

  // ---------------- Login page ----------------
  function initLogin() {
    var form = document.getElementById('loginForm');
    if (!form) return;

    if (qs('expired')) {
      var expiredBox = document.getElementById('loginError');
      expiredBox.textContent = 'Your session expired. Please sign in again.';
      expiredBox.style.display = 'block';
    }

    var toggleBtn = document.getElementById('togglePass');
    var passInput = document.getElementById('loginPass');
    if (toggleBtn && passInput) {
      toggleBtn.addEventListener('click', function () {
        var isText = passInput.type === 'text';
        passInput.type = isText ? 'password' : 'text';
        toggleBtn.setAttribute('data-lucide', isText ? 'eye' : 'eye-off');
        SC.icons();
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var identifier = document.getElementById('loginEmail').value.trim();
      var pass = passInput.value;
      var errorBox = document.getElementById('loginError');
      var submitBtn = document.getElementById('loginSubmit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';
      errorBox.style.display = 'none';

      postJson('login.php', { identifier: identifier, password: pass }).then(function (result) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
        if (result.ok && result.data.success) {
          var user = result.data.user;
          SC.login(user.role, { name: user.name, avatar: user.avatar || '' });
          goToRoleHome(user.role);
        } else {
          errorBox.textContent = (result.data && result.data.message) || 'Unable to sign in. Please try again.';
          errorBox.style.display = 'block';
        }
      }).catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
        errorBox.textContent = 'Could not reach the server. Please try again.';
        errorBox.style.display = 'block';
      });
    });
  }

  // ---------------- Register page ----------------
  function initRegister() {
    var form = document.getElementById('registerForm');
    if (!form) return;

    var role = qs('role') || 'patient';
    var isProvider = ['doctor', 'hospital', 'lab', 'pharmacy'].indexOf(role) > -1;
    var step = 1;

    var roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
    document.getElementById('registerTitle').textContent = 'Create ' + roleTitle + ' Account';
    var providerFields = document.getElementById('providerFields');
    var providerNotice = document.getElementById('providerNotice');
    var isDoctor = role === 'doctor';
    var doctorFields = document.getElementById('doctorFields');
    var hospitalSelect = document.getElementById('regHospital');
    var departmentSelect = document.getElementById('regDepartment');
    if (isProvider) {
      if (providerFields) providerFields.style.display = 'block';
      if (providerNotice) providerNotice.style.display = 'block';
    }
    if (isDoctor) {
      doctorFields.style.display = 'block';
      document.getElementById('regLicenseLabel').innerHTML = 'BMDC Registration Number<span class="req">*</span>';
      getJson('common/hospitals.php').then(function (result) {
        var hospitals = (result.ok && result.data.success) ? result.data.hospitals : [];
        hospitalSelect.innerHTML = '<option value="">Select your hospital</option>' +
          hospitals.map(function (h) { return '<option value="' + h.id + '">' + h.name + (h.city ? ' — ' + h.city : '') + '</option>'; }).join('');
      });
      hospitalSelect.addEventListener('change', function () {
        if (!hospitalSelect.value) {
          departmentSelect.innerHTML = '<option value="">Select hospital first</option>';
          departmentSelect.disabled = true;
          return;
        }
        departmentSelect.disabled = true;
        departmentSelect.innerHTML = '<option value="">Loading…</option>';
        getJson('common/hospitals.php?hospital_id=' + hospitalSelect.value).then(function (result) {
          var depts = (result.ok && result.data.success) ? result.data.departments : [];
          departmentSelect.innerHTML = '<option value="">Select your department</option>' +
            depts.map(function (d) { return '<option value="' + d.id + '">' + d.name + '</option>'; }).join('');
          departmentSelect.disabled = false;
        });
      });
    }

    var step1 = document.getElementById('regStep1');
    var step2 = document.getElementById('regStep2');
    var seg2 = document.getElementById('seg2');
    var stepLabel = document.getElementById('stepLabel');
    var submitBtn = document.getElementById('registerSubmit');
    var errorBox = document.getElementById('registerError');

    function showError(message) {
      errorBox.textContent = message;
      errorBox.style.display = 'block';
    }
    function clearError() {
      errorBox.style.display = 'none';
    }

    function renderStep() {
      step1.style.display = step === 1 ? 'block' : 'none';
      step2.style.display = step === 2 ? 'block' : 'none';
      seg2.classList.toggle('done', step >= 2);
      stepLabel.textContent = 'Step ' + step + ' of 2 — ' + (step === 1 ? 'Personal Information' : 'Verify & Confirm');
      submitBtn.textContent = step === 1 ? 'Continue' : (isProvider ? 'Submit Application' : 'Create Account');
    }
    renderStep();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();

      var name = document.getElementById('regName').value.trim();
      var phone = document.getElementById('regPhone').value.trim();
      var email = document.getElementById('regEmail').value.trim();
      var license = isProvider ? document.getElementById('regLicense').value.trim() : '';

      if (step === 1) {
        if (!name || !phone) {
          showError('Full name and phone number are required.');
          return;
        }
        if (isProvider && !license) {
          showError(isDoctor ? 'BMDC registration number is required.' : 'Organization / License number is required.');
          return;
        }
        if (isDoctor && (!hospitalSelect.value || !departmentSelect.value)) {
          showError('Please select your hospital and department.');
          return;
        }
        step = 2;
        renderStep();
        return;
      }

      var password = document.getElementById('regPassword').value;
      var confirmPassword = document.getElementById('regConfirmPassword').value;

      if (!password || !confirmPassword) {
        showError('Please create and confirm your password.');
        return;
      }
      if (password.length < 8) {
        showError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        showError('Passwords do not match.');
        return;
      }

      submitBtn.disabled = true;
      var payload = {
        full_name: name,
        phone: phone,
        email: email,
        password: password,
        confirm_password: confirmPassword,
        role: role,
        license_number: license
      };
      if (isDoctor) {
        payload.hospital_id = Number(hospitalSelect.value) || 0;
        payload.department_id = Number(departmentSelect.value) || 0;
      }
      postJson('register.php', payload).then(function (result) {
        submitBtn.disabled = false;
        if (!result.ok || !result.data.success) {
          showError((result.data && result.data.message) || 'Registration failed. Please try again.');
          return;
        }

        document.getElementById('registerForm').style.display = 'none';
        document.querySelector('.progress-steps').style.display = 'none';
        document.getElementById('stepLabel').style.display = 'none';
        var done = document.getElementById('registerDone');
        done.style.display = 'block';
        done.querySelector('.result-title').textContent = isProvider ? 'Application Submitted!' : 'Welcome to SynCura!';
        done.querySelector('.result-body').textContent = result.data.message;
        var backBtn = done.querySelector('.result-back-login');
        if (isProvider) {
          backBtn.style.display = 'inline-flex';
        } else {
          SC.login(role, { name: name || 'New User', avatar: '' });
          setTimeout(function () { goToRoleHome(role); }, 1400);
        }
      }).catch(function () {
        submitBtn.disabled = false;
        showError('Could not reach the server. Please try again.');
      });
    });
  }

  // ---------------- Role select page ----------------
  function initRoleSelect() {
    var grid = document.getElementById('roleGrid');
    if (!grid) return;
    grid.querySelectorAll('[data-role]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.location.href = 'register.html?role=' + btn.dataset.role;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initLogin();
    initRegister();
    initRoleSelect();
    if (window.lucide) window.lucide.createIcons();
  });
})();
