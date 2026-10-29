/* ==========================================================================
   SynCura — lab-admin.js
   Talks to the PHP/MySQL backend under /api/lab-admin.
   ========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!SC.requireAuth()) return;
    SC.renderShell();
    initDashboard();
    initCatalog();
    initBookings();
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
  function postForm(path, formData) {
    return fetch(apiUrl(path), { method: 'POST', credentials: 'same-origin', body: formData })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); });
  }

  function initDashboard() {
    var el = document.getElementById('recentBookings');
    if (!el) return;

    getJson('lab-admin/dashboard.php').then(function (result) {
      if (!result.ok || !result.data.success) return;

      var subtitleEl = document.getElementById('labSubtitle');
      if (subtitleEl) {
        var lb = result.data.lab;
        subtitleEl.textContent = lb.location ? (lb.name + ', ' + lb.location) : lb.name;
      }
      var s = result.data.stats;
      if (s) {
        document.getElementById('statBookingsToday').textContent = s.bookingsToday;
        document.getElementById('statBookingsTodaySub').textContent = s.bookingsTodayPending + ' pending';
        document.getElementById('statResultsReady').textContent = s.resultsReadyToday;
        document.getElementById('statPendingUpload').textContent = s.pendingUpload;
      }

      var recentBookings = result.data.recentBookings;
      el.innerHTML = recentBookings.length ? recentBookings.map(function (b) {
        return '<div class="p-4 flex items-center gap-4">' +
          '<div style="width:2rem;height:2rem;border-radius:.75rem;background:var(--blue-50);color:var(--blue-600);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span data-lucide="flask-conical" class="icon icon-16"></span></div>' +
          '<div class="flex-1"><div class="font-semibold text-gray-800 text-sm">' + b.patient + '</div><div class="text-xs text-gray-500">' + b.test + ' · ' + b.time + '</div></div>' +
          SC.badgeHTML(b.status) + (b.status !== 'ready' ? '<a href="bookings.html" class="text-xs font-semibold" style="padding:.375rem .75rem;border-radius:.5rem;background:#5B3F8D;color:#fff;">Upload</a>' : '') +
          '</div>';
      }).join('') : '<div class="p-6 text-center text-gray-400 text-sm">No bookings yet.</div>';
      SC.icons();
    });
  }

  function initCatalog() {
    var body = document.getElementById('catalogBody');
    if (!body) return;

    function load() {
      getJson('lab-admin/catalog.php').then(function (result) {
        var tests = (result.ok && result.data.success) ? result.data.tests : [];
        document.getElementById('catalogSubtitle').textContent = tests.length + ' tests · Manage prices and availability';
        body.innerHTML = tests.length ? tests.map(function (t) {
          return '<tr><td class="font-semibold text-gray-800">' + t.name + '</td>' +
            '<td><span style="background:var(--blue-50);color:var(--blue-700);font-size:.75rem;padding:.25rem .5rem;border-radius:.5rem;">' + t.category + '</span></td>' +
            '<td class="font-bold" style="font-size:.875rem;color:#5B3F8D;">৳ ' + t.price + '</td>' +
            '<td class="text-gray-500" style="font-size:.75rem;">' + t.turnaround + '</td>' +
            '<td><label class="toggle sm"><input type="checkbox" class="test-toggle" data-id="' + t.id + '" ' + (t.active ? 'checked' : '') + '><span class="track"></span></label></td>' +
            '<td></td></tr>';
        }).join('') : '<tr><td colspan="6" class="text-center text-gray-400 py-8">No tests yet. Add one to get started.</td></tr>';
        SC.icons();
        document.querySelectorAll('.test-toggle').forEach(function (cb) {
          cb.addEventListener('change', function () { postJson('lab-admin/catalog.php', { toggle_id: Number(cb.dataset.id), is_active: cb.checked }); });
        });
      });
    }

    var modal = document.getElementById('addTestModal');
    document.getElementById('addTestBtn').addEventListener('click', function () { modal.hidden = false; });
    document.getElementById('addTestBackdrop').addEventListener('click', function () { modal.hidden = true; });
    document.getElementById('cancelAddTest').addEventListener('click', function () { modal.hidden = true; });
    document.getElementById('confirmAddTest').addEventListener('click', function () {
      var errorBox = document.getElementById('addTestError');
      errorBox.style.display = 'none';
      postJson('lab-admin/catalog.php', {
        name: document.getElementById('testName').value.trim(),
        category: document.getElementById('testCategory').value,
        price: Number(document.getElementById('testPrice').value) || 0,
        turnaround: document.getElementById('testTurnaround').value.trim(),
        description: document.getElementById('testDescription').value.trim()
      }).then(function (result) {
        if (!result.ok || !result.data.success) {
          errorBox.textContent = (result.data && result.data.message) || 'Could not add test.';
          errorBox.style.display = 'block';
          return;
        }
        modal.hidden = true;
        ['testName', 'testPrice', 'testTurnaround', 'testDescription'].forEach(function (id) { document.getElementById(id).value = ''; });
        document.getElementById('testCategory').value = '';
        load();
      });
    });

    load();
  }

  function initBookings() {
    var body = document.getElementById('bookingsBody');
    if (!body) return;
    var currentId = null;

    function load() {
      getJson('lab-admin/bookings.php').then(function (result) {
        var bookings = (result.ok && result.data.success) ? result.data.bookings : [];
        document.getElementById('bookingsSubtitle').textContent = bookings.length + ' bookings';
        body.innerHTML = bookings.length ? bookings.map(function (b) {
          var action = b.status === 'ready'
            ? '<span class="text-green-600 flex items-center gap-1" style="font-size:.75rem;"><span data-lucide="check-circle" class="icon icon-12"></span> Published</span>'
            : '<button class="btn btn-brand btn-sm upload-btn" data-id="' + b.id + '" data-patient="' + b.patient + '" data-test="' + b.test + '"><span data-lucide="upload" class="icon icon-12"></span> Upload Result</button>';
          return '<tr><td class="text-xs font-mono text-gray-400">LB' + String(b.id).padStart(3, '0') + '</td>' +
            '<td class="font-semibold text-gray-800">' + b.patient + '</td>' +
            '<td class="text-gray-600" style="font-size:.75rem;">' + b.test + '</td>' +
            '<td class="text-gray-500" style="font-size:.75rem;">' + b.date + ' · ' + b.time + '</td>' +
            '<td class="text-gray-700 font-medium" style="font-size:.75rem;">' + b.fee + '</td>' +
            '<td>' + SC.badgeHTML(b.status) + '</td><td>' + action + '</td></tr>';
        }).join('') : '<tr><td colspan="7" class="text-center text-gray-400 py-8">No bookings yet.</td></tr>';
        SC.icons();
        document.querySelectorAll('.upload-btn').forEach(function (btn) {
          btn.addEventListener('click', function () { openUpload(Number(btn.dataset.id), btn.dataset.patient, btn.dataset.test); });
        });
      });
    }

    var modal = document.getElementById('uploadModal');
    function openUpload(id, patient, test) {
      currentId = id;
      document.getElementById('uploadTitle').textContent = 'Upload Result — ' + test;
      document.getElementById('uploadPatientName').textContent = patient;
      document.getElementById('resultSummary').value = '';
      document.getElementById('resultFile').value = '';
      document.getElementById('resultFileLabel').textContent = 'Click to upload or drag & drop';
      document.getElementById('uploadError').style.display = 'none';
      document.getElementById('uploadForm').style.display = 'block';
      document.getElementById('uploadDone').style.display = 'none';
      modal.hidden = false;
    }
    document.getElementById('resultFile').addEventListener('change', function () {
      document.getElementById('resultFileLabel').textContent = this.files[0] ? this.files[0].name : 'Click to upload or drag & drop';
    });
    document.getElementById('uploadBackdrop').addEventListener('click', function () { modal.hidden = true; });
    document.getElementById('cancelUpload').addEventListener('click', function () { modal.hidden = true; });
    document.getElementById('publishResult').addEventListener('click', function () {
      var errorBox = document.getElementById('uploadError');
      var summary = document.getElementById('resultSummary').value.trim();
      if (!summary) {
        errorBox.textContent = 'Please enter a result summary.';
        errorBox.style.display = 'block';
        return;
      }
      var formData = new FormData();
      formData.append('booking_id', currentId);
      formData.append('result_summary', summary);
      var file = document.getElementById('resultFile').files[0];
      if (file) formData.append('report', file);

      postForm('lab-admin/bookings.php', formData).then(function (result) {
        if (!result.ok || !result.data.success) {
          errorBox.textContent = (result.data && result.data.message) || 'Could not publish result.';
          errorBox.style.display = 'block';
          return;
        }
        document.getElementById('uploadForm').style.display = 'none';
        document.getElementById('uploadDone').style.display = 'block';
        SC.icons();
        setTimeout(function () { modal.hidden = true; load(); }, 1300);
      });
    });

    load();
  }
})();
