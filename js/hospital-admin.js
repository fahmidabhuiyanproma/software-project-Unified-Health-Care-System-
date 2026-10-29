/* ==========================================================================
   SynCura — hospital-admin.js
   Talks to the PHP/MySQL backend under /api/hospital-admin.
   ========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!SC.requireAuth()) return;
    SC.renderShell();
    initDashboard();
    initDoctors();
    initDoctorApprovals();
    initDepartments();
    initAppointments();
    initBeds();
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
    var el = document.getElementById('recentAppts');
    if (!el) return;

    getJson('hospital-admin/dashboard.php').then(function (result) {
      if (!result.ok || !result.data.success) return;

      var subtitleEl = document.getElementById('hospitalSubtitle');
      if (subtitleEl) {
        var h = result.data.hospital;
        subtitleEl.textContent = h.location ? (h.name + ' — ' + h.location) : h.name;
      }
      var s = result.data.stats;
      document.getElementById('statActiveDoctors').textContent = s.activeDoctors;
      document.getElementById('statActiveDoctorsSub').textContent = s.departmentCount + ' department' + (s.departmentCount === 1 ? '' : 's');
      document.getElementById('statApptsToday').textContent = s.appointmentsToday;
      document.getElementById('statApptsTodaySub').textContent = 'Confirmed: ' + s.confirmedToday + (s.pendingToday > 0 ? ' · Pending: ' + s.pendingToday : '');
      document.getElementById('statDepartments').textContent = s.departmentCount;
      document.getElementById('statDepartmentsSub').textContent = s.departmentCount > 0 ? 'All operational' : 'None added yet';

      var recentAppts = result.data.recentAppointments;
      el.innerHTML = recentAppts.length ? recentAppts.map(function (a) {
        return '<div class="p-4 flex items-center gap-4">' +
          '<div class="avatar" style="width:2rem;height:2rem;font-size:.75rem;background-image:none;background:var(--purple-100);color:var(--purple-700);">' + SC.initials(a.patient).toUpperCase() + '</div>' +
          '<div class="flex-1"><div class="font-semibold text-gray-800 text-sm">' + a.patient + '</div><div class="text-xs text-gray-500">' + a.doctor + ' · ' + a.dept + '</div></div>' +
          '<div class="text-xs text-gray-500 sm:block" style="display:none;">' + a.time + '</div>' + SC.badgeHTML(a.status) + '</div>';
      }).join('') : '<div class="p-6 text-center text-gray-400 text-sm">No appointments today.</div>';

      var occ = document.getElementById('deptOccupancy');
      occ.innerHTML = result.data.departmentOccupancy.map(function (d) {
        return '<div class="mb-3"><div class="flex justify-between text-xs text-gray-600 mb-1"><span>' + d.dept + '</span><span>' + d.booked + '/' + d.total + ' beds · ' + d.pct + '%</span></div>' +
          '<div class="progress-track"><div class="progress-fill" style="width:' + d.pct + '%;background:' + (d.pct > 80 ? 'var(--red-600)' : '#5B3F8D') + ';"></div></div></div>';
      }).join('') || '<div class="text-gray-400 text-sm">No departments yet.</div>';
      SC.icons();
    });
  }

  function initDoctors() {
    var body = document.getElementById('doctorsTableBody');
    if (!body) return;

    function load(filterText) {
      getJson('hospital-admin/doctors.php' + (filterText ? '?q=' + encodeURIComponent(filterText) : '')).then(function (result) {
        var doctors = (result.ok && result.data.success) ? result.data.doctors : [];
        document.getElementById('doctorsSubtitle').textContent = doctors.length + ' doctors registered';
        body.innerHTML = doctors.length ? doctors.map(function (d) {
          return '<tr><td><div class="flex items-center gap-3">' +
            '<div class="avatar" style="width:2rem;height:2rem;font-size:.75rem;background-image:none;background:var(--purple-100);color:var(--purple-700);">' + SC.initials(d.name).toUpperCase() + '</div>' +
            '<div><div class="font-semibold text-gray-800">' + d.name + '</div><div class="text-xs text-gray-400">' + d.specialty + '</div></div></div></td>' +
            '<td class="md:table-cell text-gray-600" style="font-size:.75rem;">' + d.dept + '</td>' +
            '<td class="lg:table-cell text-gray-500" style="font-size:.75rem;">' + d.patients + '</td>' +
            '<td class="lg:table-cell text-gray-500" style="font-size:.75rem;">' + d.joined + '</td>' +
            '<td>' + SC.badgeHTML(d.status) + '</td>' +
            '<td></td></tr>';
        }).join('') : '<tr><td colspan="6" class="text-center text-gray-400 py-8">No doctors yet.</td></tr>';
        SC.icons();
      });
    }
    document.getElementById('doctorSearch').addEventListener('input', function (e) { load(e.target.value); });
    load('');
  }

  function initDoctorApprovals() {
    var body = document.getElementById('doctorApprovalsBody');
    if (!body) return;
    var applications = [];

    function load() {
      getJson('hospital-admin/approvals.php').then(function (result) {
        applications = (result.ok && result.data.success) ? result.data.applications : [];
        render();
      });
    }

    function render() {
      document.getElementById('doctorApprovalsSubtitle').textContent = applications.filter(function (a) { return a.status === 'pending'; }).length + ' pending reviews';
      body.innerHTML = applications.length ? applications.map(function (a) {
        var actions = a.status === 'pending'
          ? '<div class="flex" style="gap:.375rem;">' +
            '<button class="approve-btn" data-id="' + a.id + '" style="display:flex;align-items:center;gap:.25rem;font-size:.75rem;font-weight:600;padding:.375rem .625rem;border-radius:.5rem;background:var(--green-50);color:#15803d;"><span data-lucide="check-circle" class="icon icon-12"></span> Approve</button>' +
            '<button class="reject-btn" data-id="' + a.id + '" style="display:flex;align-items:center;gap:.25rem;font-size:.75rem;font-weight:600;padding:.375rem .625rem;border-radius:.5rem;background:var(--red-50);color:var(--red-600);"><span data-lucide="x-circle" class="icon icon-12"></span> Reject</button></div>'
          : '';
        return '<tr><td class="font-semibold text-gray-800">' + a.name + '</td>' +
          '<td><span style="background:var(--purple-50);color:var(--purple-700);font-size:.75rem;padding:.25rem .5rem;border-radius:.5rem;">' + a.dept + '</span></td>' +
          '<td class="text-gray-500" style="font-size:.75rem;">' + (a.email || '—') + '</td>' +
          '<td class="text-xs font-mono text-gray-400">' + (a.regNo || '—') + '</td>' +
          '<td class="text-gray-500" style="font-size:.75rem;">' + a.submitted + '</td>' +
          '<td>' + SC.badgeHTML(a.status) + '</td><td>' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="text-center text-gray-400 py-8">No doctor applications yet.</td></tr>';
      SC.icons();
      document.querySelectorAll('.approve-btn').forEach(function (b) { b.addEventListener('click', function () { decide(Number(b.dataset.id), 'approve'); }); });
      document.querySelectorAll('.reject-btn').forEach(function (b) { b.addEventListener('click', function () { decide(Number(b.dataset.id), 'reject'); }); });
    }

    function decide(id, decision) {
      postJson('hospital-admin/approvals.php', { application_id: id, decision: decision }).then(function (result) {
        if (!result.ok || !result.data.success) { alert((result.data && result.data.message) || 'Could not process this decision.'); return; }
        load();
      });
    }

    load();
  }

  function initDepartments() {
    var grid = document.getElementById('deptGrid');
    if (!grid) return;

    function load() {
      getJson('hospital-admin/departments.php').then(function (result) {
        var depts = (result.ok && result.data.success) ? result.data.departments : [];
        grid.innerHTML = depts.length ? depts.map(function (d) {
          return '<div class="card p-5">' +
            '<div class="flex items-start gap-3 mb-4">' +
            '<div style="width:2.5rem;height:2.5rem;border-radius:.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#5B3F8D18;color:#5B3F8D;"><span data-lucide="building-2" class="icon icon-18"></span></div>' +
            '<div><h3 class="font-semibold text-gray-800 font-heading">' + d.name + '</h3><p class="text-xs text-gray-400">Head: ' + d.head + '</p></div></div>' +
            '<div class="grid grid-cols-3 gap-3 text-center mb-4">' +
            '<div style="background:var(--gray-50);border-radius:.75rem;padding:.5rem;"><div class="font-bold text-gray-800 text-lg font-heading">' + d.doctors + '</div><div class="text-gray-400" style="font-size:10px;">Doctors</div></div>' +
            '<div style="background:var(--gray-50);border-radius:.75rem;padding:.5rem;"><div class="font-bold text-gray-800 text-lg font-heading">' + d.bedsFree + '/' + d.beds + '</div><div class="text-gray-400" style="font-size:10px;">Beds free</div></div>' +
            '<div style="background:var(--gray-50);border-radius:.75rem;padding:.5rem;"><div class="font-bold text-gray-800 text-lg font-heading">' + d.todayAppts + '</div><div class="text-gray-400" style="font-size:10px;">Today\'s Appts</div></div>' +
            '</div></div>';
        }).join('') : '<div class="card p-6 text-center text-gray-400 col-span-full">No departments yet. Add one to get started.</div>';
        SC.icons();
      });
    }

    var modal = document.getElementById('addDeptModal');
    document.getElementById('addDeptBtn').addEventListener('click', function () { modal.hidden = false; });
    document.getElementById('addDeptBackdrop').addEventListener('click', function () { modal.hidden = true; });
    document.getElementById('cancelAddDept').addEventListener('click', function () { modal.hidden = true; });
    document.getElementById('confirmAddDept').addEventListener('click', function () {
      var errorBox = document.getElementById('addDeptError');
      errorBox.style.display = 'none';
      postJson('hospital-admin/departments.php', {
        name: document.getElementById('deptName').value.trim(),
        bed_count: Number(document.getElementById('deptBeds').value) || 0
      }).then(function (result) {
        if (!result.ok || !result.data.success) {
          errorBox.textContent = (result.data && result.data.message) || 'Could not add department.';
          errorBox.style.display = 'block';
          return;
        }
        modal.hidden = true;
        document.getElementById('deptName').value = '';
        document.getElementById('deptBeds').value = '';
        load();
      });
    });

    load();
  }

  function initBeds() {
    var body = document.getElementById('bedRequestsBody');
    if (!body) return;

    function render(data) {
      var pending = data.requests.filter(function (r) { return r.status === 'pending'; }).length;
      document.getElementById('bedSubtitle').textContent = pending + ' pending request' + (pending === 1 ? '' : 's');

      document.getElementById('bedSummary').innerHTML = data.departments.length ? data.departments.map(function (d) {
        var pct = d.total > 0 ? Math.round(d.booked / d.total * 100) : 0;
        var tag = d.total === 0 ? '<span class="text-xs" style="color:var(--gray-400);">No beds set up</span>'
          : d.open ? '<span class="text-xs font-semibold" style="color:' + (d.available <= 3 ? 'var(--amber-700)' : '#15803d') + ';">' + d.available + ' free</span>'
          : '<span class="text-xs font-semibold" style="color:var(--red-600);">Full · closed</span>';
        return '<div style="background:var(--gray-50);border-radius:.75rem;padding:.875rem 1rem;">' +
          '<div class="flex items-center justify-between gap-2"><span class="font-semibold text-gray-800 text-sm">' + SC.esc(d.name) + '</span>' + tag + '</div>' +
          '<div class="text-xs text-gray-500 mt-1">' + d.approved + ' admitted · ' + d.pending + ' pending · ' + d.total + ' total</div>' +
          '<div class="progress-track" style="margin-top:.5rem;"><div class="progress-fill" style="width:' + pct + '%;background:' + (d.open ? '#5B3F8D' : 'var(--red-600)') + ';"></div></div></div>';
      }).join('') : '<div class="text-sm text-gray-400">No departments yet. Add one under Departments.</div>';

      body.innerHTML = data.requests.length ? data.requests.map(function (r) {
        var admit = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        var asked = new Date(r.requestedAt).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
        var actions = r.status === 'pending'
          ? '<div class="flex" style="gap:.375rem;">' +
            '<button class="bed-approve" data-id="' + r.id + '" style="display:flex;align-items:center;gap:.25rem;font-size:.75rem;font-weight:600;padding:.375rem .625rem;border-radius:.5rem;background:var(--green-50);color:#15803d;"><span data-lucide="check-circle" class="icon icon-12"></span> Approve</button>' +
            '<button class="bed-reject" data-id="' + r.id + '" style="display:flex;align-items:center;gap:.25rem;font-size:.75rem;font-weight:600;padding:.375rem .625rem;border-radius:.5rem;background:var(--red-50);color:var(--red-600);"><span data-lucide="x-circle" class="icon icon-12"></span> Reject</button></div>'
          : r.status === 'approved'
            ? '<button class="bed-discharge btn btn-secondary btn-sm" data-id="' + r.id + '">Discharge</button>'
            : '<span class="text-gray-400 text-xs">—</span>';
        return '<tr><td><div class="font-semibold text-gray-800">' + SC.esc(r.patient) + '</div><div class="text-xs text-gray-400">' + SC.esc(r.patientPhone || '') + '</div></td>' +
          '<td><span style="background:var(--purple-50);color:var(--purple-700);font-size:.75rem;padding:.25rem .5rem;border-radius:.5rem;">' + SC.esc(r.department) + '</span></td>' +
          '<td class="text-gray-600" style="font-size:.75rem;white-space:nowrap;">' + admit + '</td>' +
          '<td style="font-size:.75rem;max-width:18rem;"><div class="text-gray-800 font-medium">' + SC.esc(r.reason) + '</div>' +
          (r.notes ? '<div class="text-gray-500" style="margin-top:.125rem;">' + SC.esc(r.notes) + '</div>' : '') +
          (r.attendantPhone ? '<div class="text-gray-400" style="margin-top:.125rem;">Attendant: ' + SC.esc(r.attendantPhone) + '</div>' : '') +
          (r.status === 'rejected' && r.rejectionReason ? '<div style="margin-top:.125rem;color:var(--red-600);">Declined: ' + SC.esc(r.rejectionReason) + '</div>' : '') + '</td>' +
          '<td class="text-gray-500" style="font-size:.75rem;white-space:nowrap;">' + asked + '</td>' +
          '<td>' + SC.badgeHTML(r.status) + '</td><td>' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="text-center text-gray-400 py-8">No bed requests yet.</td></tr>';
      SC.icons();

      body.querySelectorAll('.bed-approve').forEach(function (b) { b.addEventListener('click', function () { decide(Number(b.dataset.id), 'approve'); }); });
      body.querySelectorAll('.bed-reject').forEach(function (b) {
        b.addEventListener('click', function () {
          var reason = window.prompt('Reason for declining (optional — the patient will see it):');
          if (reason === null) return;
          decide(Number(b.dataset.id), 'reject', reason);
        });
      });
      body.querySelectorAll('.bed-discharge').forEach(function (b) {
        b.addEventListener('click', function () {
          if (window.confirm('Mark this patient as discharged? The bed becomes available again.')) decide(Number(b.dataset.id), 'discharge');
        });
      });
    }

    function load() {
      getJson('hospital-admin/beds.php').then(function (result) {
        if (result.ok && result.data.success) render(result.data);
      });
    }

    function decide(id, decision, reason) {
      postJson('hospital-admin/beds.php', { booking_id: id, decision: decision, reason: reason || '' }).then(function (result) {
        if (!result.ok || !result.data.success) { window.alert((result.data && result.data.message) || 'Could not process this request.'); }
        load();
      });
    }

    load();
    setInterval(load, 20000);
  }

  function initAppointments() {
    var body = document.getElementById('apptOverviewBody');
    if (!body) return;

    function render(q) {
      getJson('hospital-admin/appointments.php' + (q ? '?q=' + encodeURIComponent(q) : '')).then(function (result) {
        var appointments = (result.ok && result.data.success) ? result.data.appointments : [];
        document.getElementById('apptOverviewSubtitle').textContent = appointments.length + ' total appointments across all departments';
        body.innerHTML = appointments.length ? appointments.map(function (a) {
          return '<tr><td class="text-xs font-mono text-gray-400">A' + String(a.id).padStart(3, '0') + '</td>' +
            '<td class="font-semibold text-gray-800">' + a.patient + '</td>' +
            '<td class="text-gray-600" style="font-size:.75rem;">' + a.doctor + '</td>' +
            '<td style="font-size:.75rem;"><span style="background:var(--purple-50);color:var(--purple-700);padding:.25rem .5rem;border-radius:.5rem;">' + a.dept + '</span></td>' +
            '<td class="text-gray-500" style="font-size:.75rem;">' + a.date + ' · ' + a.time + '</td>' +
            '<td class="text-gray-500" style="font-size:.75rem;">' + a.type + '</td>' +
            '<td>' + SC.badgeHTML(a.status) + '</td></tr>';
        }).join('') : '<tr><td colspan="7" class="text-center text-gray-400 py-8">No appointments yet.</td></tr>';
      });
    }
    document.getElementById('apptOverviewSearch').addEventListener('input', function (e) { render(e.target.value); });
    render('');
  }
})();
