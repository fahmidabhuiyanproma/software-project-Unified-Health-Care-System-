/* ==========================================================================
   SynCura — system-admin.js
   Talks to the PHP/MySQL backend under /api/system-admin.
   ========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!SC.requireAuth()) return;
    SC.renderShell();
    initDashboard();
    initApprovals();
    initUsers();
    initSettings();
  });

  function apiUrl(path) { return SC.base() + 'api/' + path; }
  function getJson(path) {
    return fetch(apiUrl(path), { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) SC.sessionExpired();
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    });
  }
  function postJson(path, body) {
    return fetch(apiUrl(path), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body || {})
    }).then(function (r) {
      if (r.status === 401) SC.sessionExpired();
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    });
  }

  function initDashboard() {
    var el = document.getElementById('pendingProviders');
    if (!el) return;

    getJson('system-admin/dashboard.php').then(function (result) {
      if (!result.ok || !result.data.success) return;
      var pendingProviders = result.data.pendingProviders;
      el.innerHTML = pendingProviders.length ? pendingProviders.map(function (p) {
        return '<div class="p-4 flex items-center gap-4">' +
          '<div style="width:2.25rem;height:2.25rem;border-radius:.75rem;background:var(--amber-50);color:var(--amber-600);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span data-lucide="user-check" class="icon icon-16"></span></div>' +
          '<div class="flex-1"><div class="font-semibold text-gray-800 text-sm">' + p.name + '</div><div class="text-xs text-gray-500">' + p.type + ' · Submitted ' + p.submitted + '</div></div>' +
          SC.badgeHTML('pending') +
          '<a href="approvals.html" class="text-xs font-semibold" style="padding:.375rem .75rem;border-radius:.5rem;background:#5B3F8D;color:#fff;">Review</a></div>';
      }).join('') : '<div class="p-6 text-center text-gray-400 text-sm">No pending approvals.</div>';

      document.getElementById('statTotalUsers').textContent = result.data.stats.totalUsers.toLocaleString();
      document.getElementById('statHospitals').textContent = result.data.stats.hospitals;
      document.getElementById('statLabs').textContent = result.data.stats.labs;

      document.getElementById('adminSubtitle').textContent = 'SynCura Platform Overview · ' + new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      var badge = document.getElementById('pendingBadge');
      badge.textContent = result.data.pendingCount;
      badge.style.display = result.data.pendingCount > 0 ? '' : 'none';

      document.getElementById('platformActivity').innerHTML = result.data.activity.map(function (s) {
        return '<div style="background:var(--gray-50);border-radius:.75rem;padding:1rem;">' +
          '<div class="text-xl font-bold text-gray-800 font-heading">' + s.value + '</div>' +
          '<div class="text-xs text-gray-500 mt-0.5">' + s.label + '</div></div>';
      }).join('');

      document.getElementById('providerBreakdown').innerHTML = result.data.providerBreakdown.map(function (b) {
        return '<div class="mb-3"><div class="flex justify-between text-xs text-gray-600 mb-1"><span>' + b.label + '</span><span>' + b.value + '</span></div>' +
          '<div class="progress-track"><div class="progress-fill" style="width:' + ((b.value / b.total) * 100) + '%;background:#5B3F8D;"></div></div></div>';
      }).join('');
      SC.icons();
    });
  }

  function initApprovals() {
    var body = document.getElementById('providersBody');
    if (!body) return;
    var providers = [];

    function load() {
      getJson('system-admin/approvals.php').then(function (result) {
        providers = (result.ok && result.data.success) ? result.data.providers : [];
        render();
      });
    }

    function render() {
      document.getElementById('approvalsSubtitle').textContent = providers.filter(function (p) { return p.status === 'pending'; }).length + ' pending reviews';
      body.innerHTML = providers.length ? providers.map(function (p) {
        var actions = p.status === 'pending'
          ? '<div class="flex" style="gap:.375rem;">' +
            '<button class="approve-btn" data-id="' + p.id + '" style="display:flex;align-items:center;gap:.25rem;font-size:.75rem;font-weight:600;padding:.375rem .625rem;border-radius:.5rem;background:var(--green-50);color:#15803d;"><span data-lucide="check-circle" class="icon icon-12"></span> Approve</button>' +
            '<button class="reject-btn" data-id="' + p.id + '" style="display:flex;align-items:center;gap:.25rem;font-size:.75rem;font-weight:600;padding:.375rem .625rem;border-radius:.5rem;background:var(--red-50);color:var(--red-600);"><span data-lucide="x-circle" class="icon icon-12"></span> Reject</button></div>'
          : '<button class="view-btn" data-id="' + p.id + '" style="display:flex;align-items:center;gap:.25rem;font-size:.75rem;color:var(--gray-400);"><span data-lucide="external-link" class="icon icon-12"></span> View</button>';
        return '<tr><td class="font-semibold text-gray-800">' + p.name + '</td>' +
          '<td><span style="background:var(--purple-50);color:var(--purple-700);font-size:.75rem;padding:.25rem .5rem;border-radius:.5rem;">' + p.type + '</span></td>' +
          '<td class="text-gray-500" style="font-size:.75rem;">' + (p.email || '—') + '</td>' +
          '<td class="text-xs font-mono text-gray-400">' + (p.regNo || '—') + '</td>' +
          '<td class="text-gray-500" style="font-size:.75rem;">' + p.submitted + '</td>' +
          '<td>' + SC.badgeHTML(p.status) + '</td><td>' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="text-center text-gray-400 py-8">No provider applications yet.</td></tr>';
      SC.icons();
      document.querySelectorAll('.approve-btn').forEach(function (b) { b.addEventListener('click', function () { decide(Number(b.dataset.id), 'approve'); }); });
      document.querySelectorAll('.reject-btn').forEach(function (b) { b.addEventListener('click', function () { decide(Number(b.dataset.id), 'reject'); }); });
      document.querySelectorAll('.view-btn').forEach(function (b) { b.addEventListener('click', function () { openModal(Number(b.dataset.id)); }); });
    }
    function decide(id, decision) {
      postJson('system-admin/approvals.php', { application_id: id, decision: decision }).then(function (result) {
        if (!result.ok || !result.data.success) { alert((result.data && result.data.message) || 'Could not process this decision.'); return; }
        load();
      });
    }
    var modal = document.getElementById('providerModal');
    function openModal(id) {
      var p = providers.filter(function (x) { return x.id === id; })[0];
      document.getElementById('providerModalTitle').textContent = p.name;
      var rows = [['Type', p.type], ['Contact', p.contact], ['Email', p.email || '—'], ['Reg. No.', p.regNo || '—'], ['Submitted', p.submitted], ['Status', p.status]];
      document.getElementById('providerModalBody').innerHTML = rows.map(function (r) {
        return '<div class="flex justify-between" style="padding:.5rem 0;border-bottom:1px solid var(--gray-100);"><span class="text-gray-500">' + r[0] + '</span><span class="font-medium text-gray-800">' + r[1] + '</span></div>';
      }).join('');
      modal.hidden = false;
    }
    document.getElementById('providerModalBackdrop').addEventListener('click', function () { modal.hidden = true; });
    document.getElementById('closeProviderModal').addEventListener('click', function () { modal.hidden = true; });
    load();
  }

  function initUsers() {
    var body = document.getElementById('usersBody');
    if (!body) return;

    function load(q) {
      getJson('system-admin/users.php' + (q ? '?q=' + encodeURIComponent(q) : '')).then(function (result) {
        var users = (result.ok && result.data.success) ? result.data.users : [];
        document.getElementById('usersSubtitle').textContent = users.length + ' total users on the platform';
        body.innerHTML = users.length ? users.map(function (u) {
          var suspended = u.rawStatus === 'suspended';
          return '<tr><td><div class="flex items-center gap-3">' +
            '<div class="avatar" style="width:2rem;height:2rem;font-size:.75rem;background-image:none;background:var(--purple-100);color:var(--purple-700);">' + (u.name[0] || '?') + '</div>' +
            '<span class="font-semibold text-gray-800">' + u.name + '</span></div></td>' +
            '<td class="text-gray-500" style="font-size:.75rem;">' + u.email + '</td>' +
            '<td><span style="background:var(--purple-50);color:var(--purple-700);font-size:.75rem;padding:.25rem .5rem;border-radius:.5rem;">' + u.role + '</span></td>' +
            '<td class="text-gray-500" style="font-size:.75rem;">' + u.joined + '</td>' +
            '<td>' + SC.badgeHTML(u.status) + '</td>' +
            '<td><button class="btn btn-ghost btn-sm status-btn" data-id="' + u.id + '" data-suspended="' + suspended + '" style="border:1px solid var(--gray-200);"><span data-lucide="shield" class="icon icon-12"></span> ' + (suspended ? 'Reactivate' : 'Suspend') + '</button></td></tr>';
        }).join('') : '<tr><td colspan="6" class="text-center text-gray-400 py-8">No users found.</td></tr>';
        SC.icons();
        document.querySelectorAll('.status-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var willSuspend = btn.dataset.suspended !== 'true';
            postJson('system-admin/users.php', { user_id: Number(btn.dataset.id), status: willSuspend ? 'suspended' : 'active' }).then(function (result) {
              if (!result.ok || !result.data.success) { alert((result.data && result.data.message) || 'Could not update user.'); return; }
              load(document.getElementById('userSearch').value);
            });
          });
        });
      });
    }
    document.getElementById('userSearch').addEventListener('input', function (e) { load(e.target.value); });
    load('');

    var modal = document.getElementById('addAdminModal');
    document.getElementById('addAdminBtn').addEventListener('click', function () { modal.hidden = false; });
    document.getElementById('addAdminBackdrop').addEventListener('click', function () { modal.hidden = true; });
    document.getElementById('cancelAddAdmin').addEventListener('click', function () { modal.hidden = true; });
    document.getElementById('confirmAddAdmin').addEventListener('click', function () {
      var errorBox = document.getElementById('addAdminError');
      errorBox.style.display = 'none';
      postJson('system-admin/create_admin.php', {
        full_name: document.getElementById('adminFullName').value.trim(),
        email: document.getElementById('adminEmail').value.trim(),
        phone: document.getElementById('adminPhone').value.trim()
      }).then(function (result) {
        if (!result.ok || !result.data.success) {
          errorBox.textContent = (result.data && result.data.message) || 'Could not add admin.';
          errorBox.style.display = 'block';
          return;
        }
        alert('Admin account created.\nLogin phone: ' + result.data.login.phone + '\nTemporary password: ' + result.data.login.temp_password);
        modal.hidden = true;
        ['adminFullName', 'adminEmail', 'adminPhone'].forEach(function (id) { document.getElementById(id).value = ''; });
        load(document.getElementById('userSearch').value);
      });
    });
  }

  function initSettings() {
    var btn = document.getElementById('saveSettingsBtn');
    if (!btn) return;

    getJson('system-admin/settings.php').then(function (result) {
      if (!result.ok || !result.data.success) return;
      var s = result.data.settings;
      document.getElementById('settingPlatformName').value = s.platform_name || 'SynCura';
      document.getElementById('settingCurrency').value = s.currency || 'BDT (৳)';
      document.getElementById('settingSupportEmail').value = s.support_email || '';
      document.getElementById('settingSms').checked = s.sms_notifications === '1';
      document.getElementById('settingEmail').checked = s.email_notifications === '1';
      document.getElementById('settingPush').checked = s.push_notifications === '1';
    });

    btn.addEventListener('click', function () {
      var original = btn.textContent;
      btn.disabled = true;
      postJson('system-admin/settings.php', {
        platform_name: document.getElementById('settingPlatformName').value.trim(),
        currency: document.getElementById('settingCurrency').value.trim(),
        support_email: document.getElementById('settingSupportEmail').value.trim(),
        sms_notifications: document.getElementById('settingSms').checked,
        email_notifications: document.getElementById('settingEmail').checked,
        push_notifications: document.getElementById('settingPush').checked
      }).then(function () {
        btn.textContent = 'Saved ✓';
        setTimeout(function () { btn.textContent = original; btn.disabled = false; }, 1500);
      });
    });
  }
})();
