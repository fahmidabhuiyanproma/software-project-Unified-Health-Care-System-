/* ==========================================================================
   SynCura — doctor.js
   Talks to the PHP/MySQL backend under /api/doctor (+ /api/common).
   ========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!SC.requireAuth()) return;
    SC.renderShell();
    initDashboard();
    initSchedule();
    initPatients();
    initPatientRecord();
  });

  function qs(name) { return new URLSearchParams(window.location.search).get(name); }
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
    var el = document.getElementById('todaySchedule');
    if (!el) return;
    var greet = document.getElementById('doctorGreeting');
    if (greet) {
      var user = SC.getUser();
      var hour = new Date().getHours();
      greet.textContent = (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening') + ', ' + ((user && user.name) || 'Doctor') + ' 👨‍⚕️';
    }

    getJson('doctor/dashboard.php').then(function (result) {
      var schedule = (result.ok && result.data.success) ? result.data.schedule : [];

      if (result.ok && result.data.success) {
        var s = result.data.stats;
        var today = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        document.getElementById('doctorSubtitle').textContent = 'You have ' + result.data.todayCount + ' appointment' + (result.data.todayCount === 1 ? '' : 's') + ' today · ' + today;
        document.getElementById('statPatientsToday').textContent = s.patientsToday;
        document.getElementById('statPatientsTodaySub').textContent = s.telemedicineToday + ' telemedicine';
        document.getElementById('statThisWeek').textContent = s.thisWeek;
        document.getElementById('statThisWeekSub').textContent = s.thisWeekPending + ' pending';
        document.getElementById('statPendingRequests').textContent = s.pendingRequests;
        document.getElementById('statPendingRequestsSub').textContent = s.pendingRequests > 0 ? 'Awaiting your approval' : 'None waiting';

        document.getElementById('pendingRequestsList').innerHTML = result.data.pendingRequests.length ? result.data.pendingRequests.map(function (r) {
          var when = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          return '<a href="patients.html" class="flex items-center gap-3 text-sm"><span class="w-2 h-2 rounded-full bg-amber-400" style="flex-shrink:0;"></span><span class="text-gray-600" style="font-size:.75rem;">' + r.name + ' — ' + when + ' · ' + r.time + '</span></a>';
        }).join('') : '<div class="text-gray-400 text-sm">No pending requests.</div>';
        document.getElementById('statVideoCalls').textContent = s.videoCallsToday;
        document.getElementById('statVideoCallsSub').textContent = s.videoCallsToday === 0 ? 'None today' : (s.nextVideoCall ? 'Next at ' + s.nextVideoCall : 'All done for today');
      }

      if (!schedule.length) {
        el.innerHTML = '<div class="p-6 text-center text-gray-400 text-sm">No appointments scheduled for today.</div>';
        return;
      }
      el.innerHTML = schedule.map(function (a) {
        return '<div class="p-4 flex items-center gap-4">' +
          '<div class="text-xs font-mono font-semibold text-gray-500" style="width:4rem;flex-shrink:0;">' + a.time + '</div>' +
          '<div class="avatar" style="width:2.25rem;height:2.25rem;font-size:.75rem;background-image:none;background:var(--purple-100);color:var(--purple-700);">' + SC.initials(a.patient).toUpperCase() + '</div>' +
          '<div class="flex-1 min-w-0"><div class="font-semibold text-gray-800 text-sm">' + a.patient + '</div><div class="text-xs text-gray-500">' + a.reason + '</div></div>' +
          '<div class="flex items-center gap-2">' +
          '<span class="text-xs" style="padding:.25rem .5rem;border-radius:.5rem;background:' + (a.type === 'telemedicine' ? 'var(--blue-50);color:var(--blue-700)' : 'var(--gray-100);color:var(--gray-600)') + ';">' + (a.type === 'telemedicine' ? '📱 Video' : '🏥 In-Person') + '</span>' +
          SC.badgeHTML(a.status) + '</div>' +
          '<a href="patients.html" class="btn btn-secondary btn-sm">View</a></div>';
      }).join('');
      SC.icons();
    });
  }

  function initSchedule() {
    var tabsEl = document.getElementById('dayTabs');
    if (!tabsEl) return;
    var dayDates = [];
    for (var i = 0; i < 6; i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      dayDates.push(d);
    }
    var selectedDay = 0;

    function renderTabs() {
      tabsEl.innerHTML = dayDates.map(function (d, i) {
        var active = i === selectedDay;
        var label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
        return '<button class="day-tab" data-i="' + i + '" style="white-space:nowrap;padding:.5rem 1rem;border-radius:.75rem;font-size:.875rem;font-weight:500;' +
          (active ? 'background:#5B3F8D;color:#fff;' : 'background:#fff;border:1px solid var(--gray-200);color:var(--gray-600);') + '">' + label + '</button>';
      }).join('');
      tabsEl.querySelectorAll('.day-tab').forEach(function (b) { b.addEventListener('click', function () { selectedDay = Number(b.dataset.i); renderTabs(); loadSlots(); }); });
    }

    function loadSlots() {
      var iso = SC.localISO(dayDates[selectedDay]);
      getJson('doctor/schedule.php?date=' + iso).then(function (result) {
        if (!result.ok || !result.data.success) return;
        document.getElementById('slotsList').innerHTML = result.data.slots.map(function (s) {
          if (s.patient) {
            return '<div class="flex items-center gap-3" style="padding:.75rem;border-radius:.75rem;background:#fff;box-shadow:0 1px 2px rgba(16,24,40,.06);border:1px solid var(--gray-100);">' +
              '<div class="text-xs font-mono font-semibold text-gray-500" style="width:4rem;flex-shrink:0;">' + s.time + '</div>' +
              '<div class="avatar" style="width:2rem;height:2rem;font-size:.75rem;background-image:none;background:var(--purple-100);color:var(--purple-700);">' + SC.initials(s.patient).toUpperCase() + '</div>' +
              '<div class="flex-1"><div class="text-sm font-semibold text-gray-800">' + s.patient + '</div></div>' +
              '<div class="flex items-center gap-2">' + (s.type === 'telemedicine' ? '<span data-lucide="video" class="icon icon-13 text-blue-500"></span>' : '') + (s.status ? SC.badgeHTML(s.status) : '') + '</div></div>';
          }
          return '<div class="flex items-center gap-3" style="padding:.75rem;border-radius:.75rem;background:var(--gray-50);border:1px dashed var(--gray-200);">' +
            '<div class="text-xs font-mono font-semibold text-gray-500" style="width:4rem;flex-shrink:0;">' + s.time + '</div><div class="flex-1 text-xs text-gray-400" style="font-style:italic;">Available slot</div></div>';
        }).join('');
        var days2 = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        document.getElementById('availDays').innerHTML = days2.map(function (d, i) {
          return '<div class="flex items-center justify-between"><span class="text-sm text-gray-700">' + d + '</span>' +
            '<label class="toggle sm"><input type="checkbox" class="avail-toggle" data-wd="' + i + '" ' + (result.data.weeklyAvailability[i] ? 'checked' : '') + '><span class="track"></span></label></div>';
        }).join('');
        document.querySelectorAll('.avail-toggle').forEach(function (cb) {
          cb.addEventListener('change', function () {
            postJson('doctor/schedule.php', { weekday: Number(cb.dataset.wd), is_available: cb.checked });
          });
        });
        SC.icons();
      });
    }

    renderTabs();
    loadSlots();
  }

  function initPatients() {
    var body = document.getElementById('patientsTableBody');
    if (!body) return;
    var searchInput = document.getElementById('doctorPatientSearch');

    function load() {
      var q = searchInput ? searchInput.value.trim() : '';
      getJson('doctor/patients.php' + (q ? '?q=' + encodeURIComponent(q) : '')).then(function (result) {
        var patients = (result.ok && result.data.success) ? result.data.patients : [];
        if (!patients.length) {
          body.innerHTML = '<tr><td colspan="7" class="text-center text-gray-400 py-8">No patients yet.</td></tr>';
          return;
        }
        function rowHTML(p, timeCell, statusCell) {
          return '<tr><td><div class="flex items-center gap-3">' +
            '<div class="avatar" style="width:2rem;height:2rem;font-size:.75rem;background-image:none;background:var(--purple-100);color:var(--purple-700);">' + SC.initials(p.name).toUpperCase() + '</div>' +
            '<div><div class="font-semibold text-gray-800">' + p.name + '</div></div></div></td>' +
            '<td class="md:table-cell text-gray-600" style="font-size:.75rem;">—</td>' +
            '<td class="lg:table-cell text-gray-500" style="font-size:.75rem;">' + (p.lastVisit || '—') + '</td>' +
            '<td class="lg:table-cell text-gray-500" style="font-size:.75rem;">' + (p.nextAppt || '—') + '</td>' +
            '<td>' + timeCell + '</td>' +
            '<td>' + statusCell + '</td>' +
            '<td><a href="patient-record.html?patient_id=' + p.id + '" class="btn btn-secondary btn-sm"><span data-lucide="file-text" class="icon icon-12"></span> View Record</a></td></tr>';
        }
        body.innerHTML = patients.map(function (p) {
          if (!p.pending || !p.pending.length) return rowHTML(p, '<span class="text-gray-400 text-sm">—</span>', SC.badgeHTML(p.status || 'completed'));
          // Each pending request gets its own row (the patient repeats): its date/time
          // goes under "Date & Time", Approve / Reject under "Status".
          return p.pending.map(function (a) {
            var when = new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            var timeCell = '<div class="flex items-center gap-2" style="flex-wrap:wrap;"><span class="text-sm text-gray-700" style="white-space:nowrap;">' + when + ' · ' + a.time + '</span>' +
              (a.type === 'telemedicine' ? '<span class="text-xs" style="padding:.125rem .5rem;border-radius:.5rem;background:var(--blue-50);color:var(--blue-700);">📱 Video</span>' : '') + '</div>';
            var actions = '<div class="flex items-center gap-2">' +
              '<button class="btn btn-sm confirm-btn" data-id="' + a.id + '" style="background:var(--green-50);color:#15803d;">Approve</button>' +
              '<button class="btn btn-sm reject-btn" data-id="' + a.id + '" style="background:var(--red-50);color:var(--red-600);">Reject</button></div>';
            return rowHTML(p, timeCell, actions);
          }).join('');
        }).join('');
        SC.icons();
        body.querySelectorAll('.confirm-btn').forEach(function (b) { b.addEventListener('click', function () { decide(Number(b.dataset.id), 'confirm'); }); });
        body.querySelectorAll('.reject-btn').forEach(function (b) { b.addEventListener('click', function () { decide(Number(b.dataset.id), 'reject'); }); });
      });
    }

    function decide(appointmentId, action) {
      postJson('doctor/appointment_update.php', { appointment_id: appointmentId, action: action }).then(function (result) {
        if (!result.ok || !result.data.success) { alert((result.data && result.data.message) || 'Could not process this appointment.'); }
        load();
      });
    }
    if (searchInput) searchInput.addEventListener('input', load);
    load();
  }

  function initPatientRecord() {
    var historyEl = document.getElementById('prHistory');
    if (!historyEl) return;
    var patientId = qs('patient_id');
    if (!patientId) {
      historyEl.innerHTML = '<div class="card p-6 text-center text-gray-400">No patient selected.</div>';
      return;
    }

    function load() {
      getJson('doctor/patient_record.php?patient_id=' + patientId).then(function (result) {
        if (!result.ok || !result.data.success) {
          document.getElementById('prPatientName').textContent = 'Access denied';
          historyEl.innerHTML = '<div class="card p-6 text-center text-gray-400">' + ((result.data && result.data.message) || 'Could not load this record.') + '</div>';
          return;
        }
        var patient = result.data.patient;
        document.getElementById('prAvatar').textContent = SC.initials(patient.name).toUpperCase();
        document.getElementById('prPatientName').textContent = patient.name;
        document.getElementById('prPatientMeta').textContent = patient.phone || '';
        document.getElementById('prPatientPhone').textContent = patient.phone ? ('Phone: ' + patient.phone) : '';
        document.getElementById('prPatientId').textContent = 'Patient ID: ' + patient.id;
        document.getElementById('prAddFormTitle').textContent = 'Add Visit Note — ' + patient.name;

        var history = result.data.history;
        historyEl.innerHTML = history.length ? history.map(function (h) {
          var when = new Date(h.visit_date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
          return '<div class="card p-5"><div class="flex items-center justify-between mb-3"><div class="text-sm font-semibold text-gray-800">' + when + '</div>' + SC.badgeHTML('completed') + '</div>' +
            '<div class="space-y-2 text-sm"><div style="white-space:pre-line;" class="text-gray-800">' + h.description + '</div>' +
            (h.vitals ? '<div><span class="text-gray-500 font-medium">Vitals: </span><span class="text-gray-800">' + h.vitals + '</span></div>' : '') + '</div></div>';
        }).join('') : '<div class="card p-6 text-center text-gray-400">No visit history yet.</div>';
        SC.icons();
      });
    }

    var addForm = document.getElementById('prAddForm');
    var tabButtons = document.querySelectorAll('.pr-tab-btn');
    function setTab(tab) {
      tabButtons.forEach(function (b) {
        var active = b.dataset.tab === tab;
        b.style.background = active ? '#5B3F8D' : 'transparent';
        b.style.color = active ? '#fff' : 'var(--gray-500)';
      });
      historyEl.style.display = tab === 'history' ? 'block' : 'none';
      addForm.style.display = tab === 'add' ? 'block' : 'none';
    }
    tabButtons.forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });
    document.getElementById('prCancelBtn').addEventListener('click', function () { setTab('history'); });

    var diagInput = document.getElementById('prDiagnosis');
    var saveBtn = document.getElementById('prSaveBtn');
    diagInput.addEventListener('input', function () { saveBtn.disabled = !diagInput.value.trim(); });
    addForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!diagInput.value.trim()) return;
      var errorBox = document.getElementById('prAddError');
      errorBox.style.display = 'none';
      saveBtn.disabled = true;

      var vitals = [
        document.getElementById('prBP').value.trim() ? ('BP: ' + document.getElementById('prBP').value.trim()) : '',
        document.getElementById('prPulse').value.trim() ? ('Pulse: ' + document.getElementById('prPulse').value.trim()) : '',
        document.getElementById('prTemp').value.trim() ? ('Temp: ' + document.getElementById('prTemp').value.trim()) : ''
      ].filter(Boolean).join(', ');

      postJson('doctor/patient_record.php', {
        patient_id: Number(patientId),
        chief_complaint: document.getElementById('prChiefComplaint').value.trim(),
        vitals: vitals,
        diagnosis: diagInput.value.trim(),
        prescription: document.getElementById('prPrescription').value.trim(),
        notes: document.getElementById('prNotes').value.trim()
      }).then(function (result) {
        if (!result.ok || !result.data.success) {
          errorBox.textContent = (result.data && result.data.message) || 'Could not save this note.';
          errorBox.style.display = 'block';
          saveBtn.disabled = false;
          return;
        }
        var savedMsg = document.getElementById('prSaved');
        savedMsg.style.display = 'flex';
        SC.icons();
        setTimeout(function () {
          savedMsg.style.display = 'none';
          addForm.reset();
          saveBtn.disabled = true;
          setTab('history');
          load();
        }, 1200);
      });
    });

    load();
  }
})();
