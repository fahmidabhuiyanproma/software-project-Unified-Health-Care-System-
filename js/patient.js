/* ==========================================================================
   SynCura — patient.js
   Talks to the PHP/MySQL backend under /api/patient (+ /api/common).
   ========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!SC.requireAuth()) return;
    SC.renderShell();
    initGreeting();
    initDashboardOverview();
    initSearchDoctors();
    initDoctorProfile();
    initBookAppointment();
    initAppointments();
    initMedicalRecords();
    initTelemedicine();
    initPharmacy();
    initLabTests();
    initLabResults();
    initBedBooking();
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

  // ---------------- Dashboard greeting ----------------
  function initGreeting() {
    var el = document.getElementById('greeting');
    if (!el) return;
    var hour = new Date().getHours();
    var greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    var user = SC.getUser();
    var first = (user && user.name) ? user.name.split(' ')[0] : 'there';
    el.textContent = greeting + ', ' + first + ' 👋';
  }

  // ---------------- Dashboard overview (stats, upcoming, activity) ----------------
  function initDashboardOverview() {
    var upcomingEl = document.getElementById('dashUpcoming');
    if (!upcomingEl) return;
    var activityEl = document.getElementById('dashActivity');

    getJson('patient/dashboard.php').then(function (result) {
      if (!result.ok || !result.data.success) return;
      var data = result.data;

      document.getElementById('statAppointments').textContent = data.stats.appointments.value;
      document.getElementById('statAppointmentsSub').textContent = data.stats.appointments.sub;
      document.getElementById('statRecords').textContent = data.stats.records.value;
      document.getElementById('statRecordsSub').textContent = data.stats.records.sub;
      document.getElementById('statOrders').textContent = data.stats.orders.value;
      document.getElementById('statOrdersSub').textContent = data.stats.orders.sub;
      document.getElementById('statLabTests').textContent = data.stats.labTests.value;
      document.getElementById('statLabTestsSub').textContent = data.stats.labTests.sub;

      var bannerCount = document.getElementById('bannerCount');
      var bannerNext = document.getElementById('bannerNext');
      if (bannerCount) {
        bannerCount.textContent = 'You have ' + data.upcomingCount + ' upcoming appointment' + (data.upcomingCount === 1 ? '' : 's');
      }
      if (bannerNext) {
        var next = data.upcoming[0];
        bannerNext.textContent = next
          ? 'Next: ' + next.doctor + ' on ' + new Date(next.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }) + ' at ' + next.time
          : '';
      }

      upcomingEl.innerHTML = data.upcoming.length ? data.upcoming.map(function (a) {
        var when = new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        return '<div class="p-4 flex items-start gap-3">' +
          '<div class="avatar" style="width:2.5rem;height:2.5rem;background-image:none;background:var(--purple-100);color:var(--purple-700);font-size:.875rem;">' + SC.initials(a.doctor).toUpperCase() + '</div>' +
          '<div class="flex-1 min-w-0">' +
          '<div class="font-semibold text-gray-800 text-sm">' + a.doctor + '</div>' +
          '<div class="text-xs text-gray-500">' + a.specialty + ' · ' + a.hospital + '</div>' +
          '<div class="flex items-center gap-2 mt-2">' +
          '<span data-lucide="clock" class="icon icon-11 text-gray-400"></span>' +
          '<span class="text-xs text-gray-500">' + when + ' · ' + a.time + '</span>' +
          SC.badgeHTML(a.status) +
          '</div></div></div>';
      }).join('') : '<div class="p-6 text-center text-gray-400 text-sm">No upcoming appointments.</div>';

      var activityIconStyles = {
        cancelled: { bg: '#FEE2E218', color: '#DC2626' },
        delivered: { bg: '#DCFCE718', color: '#16A34A' }
      };
      activityEl.innerHTML = data.activity.length ? data.activity.map(function (n) {
        var when = new Date(n.time.replace(' ', 'T')).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        var style = /cancel|declin/i.test(n.title) ? activityIconStyles.cancelled
          : /deliver/i.test(n.title) ? activityIconStyles.delivered
          : { bg: '#5B3F8D18', color: '#5B3F8D' };
        return '<div class="p-4 flex items-center gap-3">' +
          '<div class="stat-icon" style="width:2.25rem;height:2.25rem;background:' + style.bg + ';color:' + style.color + ';"><span data-lucide="' + n.icon + '" class="icon icon-16"></span></div>' +
          '<div><div class="text-sm font-medium text-gray-800">' + n.title + '</div><div class="text-xs text-gray-400">' + n.body + ' — ' + when + '</div></div></div>';
      }).join('') : '<div class="p-6 text-center text-gray-400 text-sm">No recent activity yet.</div>';

      SC.icons();
    });
  }

  // ---------------- Search Doctors ----------------
  function initSearchDoctors() {
    var grid = document.getElementById('doctorGrid');
    if (!grid) return;
    var queryEl = document.getElementById('docQuery');
    var specialtyEl = document.getElementById('docSpecialty');
    var availEl = document.getElementById('docAvailOnly');
    var countEl = document.getElementById('docCount');
    var emptyEl = document.getElementById('docEmpty');

    function render() {
      var params = new URLSearchParams();
      if (queryEl.value.trim()) params.set('q', queryEl.value.trim());
      if (specialtyEl.value && specialtyEl.value !== 'All Specialties') params.set('specialty', specialtyEl.value);
      if (availEl.checked) params.set('available_only', '1');

      getJson('patient/doctors.php?' + params.toString()).then(function (result) {
        var filtered = (result.ok && result.data.success) ? result.data.doctors : [];
        countEl.textContent = filtered.length;
        emptyEl.style.display = filtered.length ? 'none' : 'block';
        grid.innerHTML = filtered.map(function (doc) {
          return '<div class="card" style="overflow:hidden;">' +
            '<div class="p-5">' +
            '<div class="flex items-start gap-4 mb-4">' +
            '<img src="' + doc.img + '" alt="" style="width:4rem;height:4rem;border-radius:1rem;object-fit:cover;background:var(--purple-100);flex-shrink:0;">' +
            '<div class="flex-1 min-w-0"><h3 class="font-semibold text-gray-800 font-heading">' + doc.name + '</h3>' +
            '<p class="text-sm font-medium" style="color:var(--purple-700);">' + doc.specialty + '</p>' +
            '<p class="text-gray-500 text-xs mt-1">' + doc.hospital + '</p></div></div>' +
            '<div class="flex items-center justify-between text-xs text-gray-500 mb-4">' +
            '<div class="flex items-center gap-1"><span data-lucide="map-pin" class="icon icon-11"></span> ' + (doc.location || '—') + '</div>' +
            '<div class="flex items-center gap-1"><span data-lucide="clock" class="icon icon-11"></span> ' + doc.exp + ' exp.</div></div>' +
            '<div class="flex items-center justify-between mb-4">' +
            '<div class="flex items-center gap-1"><span class="text-star">★</span><span class="text-sm font-semibold text-gray-800">' + doc.rating + '</span><span class="text-xs text-gray-400">(' + doc.reviews + ')</span></div>' +
            '<div class="text-sm font-bold" style="color:#5B3F8D;">' + doc.fee + ' / visit</div></div>' +
            '<div class="flex items-center gap-2">' +
            '<div class="flex items-center gap-1.5 text-xs" style="padding:.375rem .625rem;border-radius:.5rem;background:' + (doc.available ? 'var(--green-50);color:var(--green-700)' : 'var(--red-50);color:var(--red-600)') + ';">' +
            '<span style="width:.375rem;height:.375rem;border-radius:9999px;background:' + (doc.available ? 'var(--green-500)' : '#f87171') + ';"></span>' + (doc.available ? 'Available Today' : 'Not Available') + '</div>' +
            '<div class="flex-1"></div>' +
            '<a href="doctor-profile.html?id=' + doc.id + '" class="btn btn-secondary btn-sm">View Profile</a>' +
            (doc.available ? '<a href="book-appointment.html?id=' + doc.id + '" class="btn btn-brand btn-sm">Book</a>' : '') +
            '</div></div></div>';
        }).join('');
        SC.icons();
      });
    }
    queryEl.addEventListener('input', render);
    specialtyEl.addEventListener('change', render);
    availEl.addEventListener('change', render);
    render();
  }

  // ---------------- Doctor Profile ----------------
  function initDoctorProfile() {
    var root = document.getElementById('doctorProfileRoot');
    if (!root) return;
    var id = qs('id') || '1';

    getJson('patient/doctor_detail.php?id=' + encodeURIComponent(id)).then(function (result) {
      if (!result.ok || !result.data.success) {
        root.innerHTML = '<div class="card p-6">Doctor not found.</div>';
        return;
      }
      var doc = result.data.doctor;
      root.innerHTML =
        '<div class="lg:col-span-2 space-y-5">' +
          '<div class="card p-6">' +
            '<div class="flex gap-5 mb-5">' +
              '<img src="' + doc.img + '" alt="" style="width:6rem;height:6rem;border-radius:1rem;object-fit:cover;background:var(--purple-100);flex-shrink:0;">' +
              '<div class="flex-1"><h1 class="text-xl font-bold text-gray-800 font-heading">' + doc.name + '</h1>' +
              '<p class="font-medium" style="color:var(--purple-700);">' + doc.specialty + '</p>' +
              '<p class="text-gray-500 text-sm">' + doc.hospital + '</p>' +
              '<div class="flex items-center gap-3 mt-2 text-sm text-gray-500">' +
              '<div class="flex items-center gap-1"><span data-lucide="map-pin" class="icon icon-13"></span> ' + (doc.location || '—') + '</div>' +
              '<div class="flex items-center gap-1"><span data-lucide="clock" class="icon icon-13"></span> ' + doc.exp + ' exp.</div></div>' +
              '<div class="flex items-center gap-3 mt-2">' + SC.badgeHTML('confirmed') + '</div></div></div>' +
            '<div class="border-t pt-4"><h3 class="font-semibold text-gray-800 mb-2 font-heading">About</h3><p class="text-gray-600 text-sm leading-relaxed">' + doc.bio + '</p></div>' +
          '</div>' +
          '<div class="card p-6"><h3 class="font-semibold text-gray-800 mb-4 flex items-center gap-2 font-heading"><span data-lucide="award" class="icon icon-16" style="color:var(--purple-600);"></span> Qualification</h3>' +
            '<div class="flex items-start gap-3"><span data-lucide="check-circle" class="icon icon-15 text-green-500" style="margin-top:2px;"></span><span class="text-sm text-gray-600">' + (doc.qualification || 'Not specified') + '</span></div></div>' +
        '</div>' +
        '<div class="space-y-5">' +
          '<div class="card p-6"><div class="text-2xl font-bold mb-1 font-heading" style="color:#5B3F8D;">' + doc.fee + '</div><div class="text-gray-500 text-sm mb-5">per consultation visit</div>' +
            '<a href="book-appointment.html?id=' + doc.id + '" class="btn btn-brand btn-md w-full flex items-center justify-center gap-2"><span data-lucide="calendar" class="icon icon-16"></span> Book Appointment</a></div>' +
          '<div class="card p-6"><h3 class="font-semibold text-gray-800 mb-4 font-heading">Available Slots — Today</h3>' +
            '<div class="grid grid-cols-2 gap-2">' + doc.todaySlots.filter(function (s) { return s.available; }).map(function (s) {
              return '<a href="book-appointment.html?id=' + doc.id + '&slot=' + encodeURIComponent(s.time) + '" class="text-xs font-medium" style="padding:.5rem;border-radius:.5rem;border:1px solid var(--purple-200);color:var(--purple-700);text-align:center;">' + s.time + '</a>';
            }).join('') + '</div></div>' +
        '</div>';
      SC.icons();
    });
  }

  // ---------------- Book Appointment ----------------
  function initBookAppointment() {
    var root = document.getElementById('dateRow');
    if (!root) return;
    var doctorId = qs('id') || '1';
    var doctor = null;
    var dates = [];
    var selectedDateIndex = 0;
    var selectedSlot = qs('slot') || '';
    var visitType = 'in-person';
    var step = 1;

    document.getElementById('bookBackBtn').addEventListener('click', function () {
      if (step > 1) { step--; renderStep(); } else { window.location.href = 'doctor-profile.html?id=' + doctorId; }
    });

    function buildDates(weeklyAvailability) {
      var labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      var out = [];
      for (var i = 0; i < 7; i++) {
        var d = new Date();
        d.setDate(d.getDate() + i);
        var weekday = d.getDay();
        out.push({
          iso: SC.localISO(d),
          label: labels[weekday],
          date: String(d.getDate()),
          full: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
          avail: weeklyAvailability[weekday] !== false
        });
      }
      return out;
    }

    function renderDates() {
      document.getElementById('dateRow').innerHTML = dates.map(function (d, i) {
        var active = i === selectedDateIndex;
        var style = 'min-width:64px;padding:.75rem 1rem;border-radius:.75rem;border:2px solid ' +
          (active ? 'var(--purple-700);background:var(--purple-700);color:#fff;' : d.avail ? 'var(--gray-200);color:var(--gray-700);' : 'var(--gray-100);color:var(--gray-300);');
        return '<button type="button" class="date-btn" data-i="' + i + '" ' + (d.avail ? '' : 'disabled') + ' style="' + style + 'display:flex;flex-direction:column;align-items:center;flex-shrink:0;">' +
          '<span class="text-xs">' + d.label + '</span><span class="text-lg font-bold">' + d.date + '</span>' + (!d.avail ? '<span style="font-size:9px;">N/A</span>' : '') + '</button>';
      }).join('');
      document.querySelectorAll('.date-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          selectedDateIndex = Number(btn.dataset.i);
          selectedSlot = '';
          renderDates();
          loadSlots();
        });
      });
    }

    function loadSlots() {
      var date = dates[selectedDateIndex];
      getJson('patient/doctor_slots.php?doctor_id=' + doctorId + '&date=' + date.iso).then(function (result) {
        var slots = (result.ok && result.data.success) ? result.data.slots : [];
        document.getElementById('slotGrid').innerHTML = slots.map(function (s) {
          var active = s.time === selectedSlot;
          if (!s.available) {
            return '<button type="button" disabled style="padding:.625rem;border-radius:.75rem;border:2px solid var(--gray-100);color:var(--gray-300);font-size:.875rem;font-weight:500;">' + s.time + '</button>';
          }
          return '<button type="button" class="slot-btn" data-slot="' + s.time + '" style="padding:.625rem;border-radius:.75rem;border:2px solid ' +
            (active ? 'var(--purple-700);background:var(--purple-700);color:#fff;' : 'var(--gray-200);color:var(--gray-700);') +
            'font-size:.875rem;font-weight:500;">' + s.time + '</button>';
        }).join('');
        document.querySelectorAll('.slot-btn').forEach(function (btn) {
          btn.addEventListener('click', function () { selectedSlot = btn.dataset.slot; loadSlots(); });
        });
        refreshContinue();
      });
    }
    function refreshContinue() { document.getElementById('toStep2').disabled = !selectedSlot; }

    document.querySelectorAll('.visit-type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        visitType = btn.dataset.type;
        document.querySelectorAll('.visit-type-btn').forEach(function (b) {
          var on = b === btn;
          b.style.borderColor = on ? 'var(--purple-700)' : 'var(--gray-200)';
          b.style.background = on ? 'var(--purple-50)' : 'transparent';
          b.style.color = on ? 'var(--purple-700)' : 'var(--gray-600)';
        });
      });
    });

    document.getElementById('toStep2').addEventListener('click', function () { step = 2; renderStep(); });
    document.getElementById('toStep3').addEventListener('click', function () { step = 3; renderStep(); renderConfirm(); });
    document.getElementById('confirmBookingBtn').addEventListener('click', function () {
      var btn = document.getElementById('confirmBookingBtn');
      var errorBox = document.getElementById('bookError');
      errorBox.style.display = 'none';
      btn.disabled = true;
      postJson('patient/appointments.php', {
        doctor_id: Number(doctorId), date: dates[selectedDateIndex].iso, time: selectedSlot,
        visit_type: visitType, reason: document.getElementById('bookReason').value.trim(), notes: document.getElementById('bookNotes').value.trim()
      }).then(function (result) {
        btn.disabled = false;
        if (!result.ok || !result.data.success) {
          errorBox.textContent = (result.data && result.data.message) || 'Could not book this appointment.';
          errorBox.style.display = 'block';
          if (result.data && result.data.message && result.data.message.indexOf('slot') > -1) loadSlots();
          return;
        }
        document.getElementById('bookStep3').style.display = 'none';
        document.querySelector('.max-w-2xl .progress-steps').style.display = 'none';
        document.getElementById('bookStepLabel').style.display = 'none';
        document.getElementById('bookBackBtn').style.display = 'none';
        document.getElementById('bookDone').style.display = 'block';
        document.getElementById('bookDoneDoctor').textContent = doctor.name + ' · ' + doctor.specialty;
        document.getElementById('bookDoneHospital').textContent = doctor.hospital;
        document.getElementById('bookDoneWhen').textContent = dates[selectedDateIndex].full + ' · ' + selectedSlot;
      }).catch(function () {
        btn.disabled = false;
        errorBox.textContent = 'Could not reach the server. Please try again.';
        errorBox.style.display = 'block';
      });
    });

    function renderStep() {
      document.getElementById('bookStep1').style.display = step === 1 ? 'block' : 'none';
      document.getElementById('bookStep2').style.display = step === 2 ? 'block' : 'none';
      document.getElementById('bookStep3').style.display = step === 3 ? 'block' : 'none';
      document.getElementById('bstep2').classList.toggle('done', step >= 2);
      document.getElementById('bstep3').classList.toggle('done', step >= 3);
      var labels = ['Select Date & Time', 'Visit Details', 'Confirm'];
      document.getElementById('bookStepLabel').textContent = 'Step ' + step + ' of 3 — ' + labels[step - 1];
      document.getElementById('bookBackLabel').textContent = step > 1 ? 'Back' : 'Back to Doctor';
    }
    function renderConfirm() {
      var rows = [
        ['Doctor', doctor.name + ' · ' + doctor.specialty], ['Hospital', doctor.hospital],
        ['Date', dates[selectedDateIndex].full], ['Time', selectedSlot],
        ['Visit Type', visitType === 'in-person' ? 'In-Person' : 'Telemedicine'], ['Consultation Fee', doctor.fee]
      ];
      document.getElementById('confirmSummary').innerHTML = rows.map(function (r) {
        return '<div class="flex justify-between py-2 border-b" style="border-color:var(--gray-100);"><span class="text-sm text-gray-500">' + r[0] + '</span><span class="text-sm font-medium text-gray-800">' + r[1] + '</span></div>';
      }).join('');
    }

    getJson('patient/doctor_detail.php?id=' + doctorId).then(function (result) {
      if (!result.ok || !result.data.success) return;
      doctor = result.data.doctor;
      document.getElementById('bookDoctorImg').src = doctor.img;
      document.getElementById('bookDoctorName').textContent = doctor.name;
      document.getElementById('bookDoctorMeta').textContent = doctor.specialty + ' · ' + doctor.hospital;
      document.getElementById('bookDoctorFee').textContent = 'Consultation fee: ' + doctor.fee;
      dates = buildDates(doctor.weeklyAvailability);
      selectedDateIndex = 0;
      for (var i = 0; i < dates.length; i++) { if (dates[i].avail) { selectedDateIndex = i; break; } }
      renderDates();
      loadSlots();
      renderStep();
    });
  }

  // ---------------- Appointments list ----------------
  function initAppointments() {
    var list = document.getElementById('apptList');
    if (!list) return;
    var tab = 'upcoming';
    var cancelId = null;
    var rescheduleId = null;
    var rescheduleDoctorId = null;
    var appointmentsData = [];

    function upcoming() { return appointmentsData.filter(function (a) { return a.status === 'confirmed' || a.status === 'pending'; }); }
    function past() { return appointmentsData.filter(function (a) { return a.status !== 'confirmed' && a.status !== 'pending'; }); }

    function load() {
      getJson('patient/appointments.php').then(function (result) {
        appointmentsData = (result.ok && result.data.success) ? result.data.appointments : [];
        render();
      });
    }

    function render() {
      var data = tab === 'upcoming' ? upcoming() : past();
      document.querySelectorAll('.tab-btn').forEach(function (b) {
        var active = b.dataset.tab === tab;
        b.style.background = active ? '#5B3F8D' : 'transparent';
        b.style.color = active ? '#fff' : 'var(--gray-500)';
        b.textContent = b.dataset.tab.charAt(0).toUpperCase() + b.dataset.tab.slice(1) + ' (' + (b.dataset.tab === 'upcoming' ? upcoming().length : past().length) + ')';
      });
      document.getElementById('apptEmpty').style.display = data.length ? 'none' : 'block';
      list.style.display = data.length ? 'block' : 'none';
      list.innerHTML = data.map(function (a) {
        var when = new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        var actions = '';
        if (a.status === 'confirmed' || a.status === 'pending') {
          actions = (a.status === 'pending' ? '<div class="text-xs mt-3" style="color:var(--amber-700);">⏳ Awaiting doctor confirmation</div>' : '') +
            '<div class="flex gap-2 mt-4 pt-4 border-t">' +
            '<button class="btn btn-secondary btn-sm reschedule-btn" data-id="' + a.id + '" data-doctor="' + a.doctor_id + '"><span data-lucide="refresh-cw" class="icon icon-13"></span> Reschedule</button>' +
            '<button class="btn btn-danger btn-sm cancel-btn" data-id="' + a.id + '"><span data-lucide="x" class="icon icon-13"></span> Cancel</button>' +
            (a.status === 'confirmed' && a.type === 'telemedicine' ? '<a href="telemedicine.html?appointment_id=' + a.id + '" class="btn btn-brand btn-sm"><span data-lucide="video" class="icon icon-13"></span> Join Call</a>' : '') +
            '</div>';
        } else if (a.status === 'completed') {
          actions = '<div class="flex gap-2 mt-4 pt-4 border-t">' +
            '<a href="medical-records.html" class="btn btn-ghost btn-sm">View Record</a>' +
            '<a href="search-doctors.html" class="btn btn-secondary btn-sm">Book Follow-up</a></div>';
        }
        return '<div class="card p-5"><div class="flex items-start gap-4">' +
          '<img src="' + a.img + '" alt="" style="width:3.5rem;height:3.5rem;border-radius:1rem;object-fit:cover;background:var(--purple-100);flex-shrink:0;">' +
          '<div class="flex-1 min-w-0"><div class="flex flex-wrap items-start justify-between gap-2">' +
          '<div><h3 class="font-semibold text-gray-800 font-heading">' + a.doctor + '</h3><p class="text-sm" style="color:var(--purple-700);">' + a.specialty + '</p></div>' +
          SC.badgeHTML(a.status) + '</div>' +
          '<div class="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">' +
          '<div class="flex items-center gap-1"><span data-lucide="map-pin" class="icon icon-11"></span> ' + a.hospital + '</div>' +
          '<div class="flex items-center gap-1"><span data-lucide="calendar" class="icon icon-11"></span> ' + when + '</div>' +
          '<div class="flex items-center gap-1"><span data-lucide="clock" class="icon icon-11"></span> ' + a.time + '</div>' +
          '<div class="flex items-center gap-1">' + (a.type === 'telemedicine' ? '<span data-lucide="video" class="icon icon-11"></span> Telemedicine' : '🏥 In-Person') + '</div></div>' +
          '<div class="text-sm font-semibold text-gray-700 mt-2">' + a.fee + '</div></div></div>' + actions + '</div>';
      }).join('');
      SC.icons();
      document.querySelectorAll('.cancel-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { cancelId = Number(btn.dataset.id); document.getElementById('cancelModal').hidden = false; });
      });
      document.querySelectorAll('.reschedule-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { openReschedule(Number(btn.dataset.id), Number(btn.dataset.doctor)); });
      });
    }

    function openReschedule(id, doctorId) {
      rescheduleId = id; rescheduleDoctorId = doctorId;
      document.getElementById('rescheduleError').style.display = 'none';
      var dateInput = document.getElementById('rescheduleDate');
      dateInput.min = SC.localISO(new Date());
      dateInput.value = dateInput.min;
      loadRescheduleSlots();
      dateInput.onchange = loadRescheduleSlots;
      document.getElementById('rescheduleModal').hidden = false;
    }
    function loadRescheduleSlots() {
      var date = document.getElementById('rescheduleDate').value;
      getJson('patient/doctor_slots.php?doctor_id=' + rescheduleDoctorId + '&date=' + date).then(function (result) {
        var slots = (result.ok && result.data.success) ? result.data.slots : [];
        document.getElementById('rescheduleTime').innerHTML = slots.filter(function (s) { return s.available; }).map(function (s) {
          return '<option>' + s.time + '</option>';
        }).join('') || '<option value="">No slots available</option>';
      });
    }

    document.querySelectorAll('.tab-btn').forEach(function (b) { b.addEventListener('click', function () { tab = b.dataset.tab; render(); }); });
    document.getElementById('keepApptBtn').addEventListener('click', function () { document.getElementById('cancelModal').hidden = true; });
    document.getElementById('cancelBackdrop').addEventListener('click', function () { document.getElementById('cancelModal').hidden = true; });
    document.getElementById('confirmCancelBtn').addEventListener('click', function () {
      postJson('patient/appointment_update.php', { appointment_id: cancelId, action: 'cancel' }).then(function () {
        document.getElementById('cancelModal').hidden = true;
        load();
      });
    });
    document.getElementById('cancelRescheduleBtn').addEventListener('click', function () { document.getElementById('rescheduleModal').hidden = true; });
    document.getElementById('rescheduleBackdrop').addEventListener('click', function () { document.getElementById('rescheduleModal').hidden = true; });
    document.getElementById('confirmRescheduleBtn').addEventListener('click', function () {
      var time = document.getElementById('rescheduleTime').value;
      if (!time) return;
      postJson('patient/appointment_update.php', { appointment_id: rescheduleId, action: 'reschedule', date: document.getElementById('rescheduleDate').value, time: time }).then(function (result) {
        if (!result.ok || !result.data.success) {
          var box = document.getElementById('rescheduleError');
          box.textContent = (result.data && result.data.message) || 'Could not reschedule.';
          box.style.display = 'block';
          return;
        }
        document.getElementById('rescheduleModal').hidden = true;
        load();
      });
    });

    load();
  }

  // ---------------- Medical Records ----------------
  function initMedicalRecords() {
    var wrap = document.getElementById('recordsTimeline');
    if (!wrap) return;
    var icons = { diagnosis: ['activity', '#5B3F8D', '#F3F0FF'], note: ['activity', '#5B3F8D', '#F3F0FF'], lab: ['flask-conical', '#0369A1', '#E0F2FE'], prescription: ['pill', '#16A34A', '#DCFCE7'], telemedicine: ['video', '#5B3F8D', '#F3F0FF'] };
    var searchInput = document.getElementById('recordSearch');
    var hospitalSelect = document.getElementById('recordHospital');
    var typeSelect = document.getElementById('recordType');
    var allRecords = [];

    function hasPrescription(r) { return /prescription:/i.test(r.desc || ''); }
    function matchesType(r, type) {
      if (!type) return true;
      if (type === 'lab') return r.type === 'lab';
      if (type === 'prescription') return hasPrescription(r);
      return r.type !== 'lab';
    }

    function render() {
      var q = searchInput.value.trim().toLowerCase();
      var hospital = hospitalSelect.value;
      var type = typeSelect.value;

      var filtered = allRecords.filter(function (r) {
        if (hospital && r.hospital !== hospital) return false;
        if (!matchesType(r, type)) return false;
        if (q && (r.title + ' ' + (r.desc || '') + ' ' + (r.doctor || '')).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });

      if (!filtered.length) {
        wrap.innerHTML = '<div class="text-center text-gray-400 py-10">' + (allRecords.length ? 'No records match your search.' : 'No medical records yet.') + '</div>';
        return;
      }
      wrap.innerHTML = filtered.map(function (r) {
        var ic = icons[r.type] || icons.note;
        var when = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        return '<div class="flex gap-4 relative">' +
          '<div style="width:2.5rem;height:2.5rem;border-radius:9999px;display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:1;border:2px solid #fff;background:' + ic[2] + ';color:' + ic[1] + ';">' +
          '<span data-lucide="' + ic[0] + '" class="icon icon-18"></span></div>' +
          '<div class="flex-1 card p-5">' +
          '<div class="flex items-start justify-between gap-2 mb-2">' +
          '<div><h3 class="font-semibold text-gray-800 text-sm font-heading">' + r.title + '</h3>' +
          '<p class="text-xs text-gray-400">' + (r.hospital || '') + (r.doctor ? ' · ' + r.doctor : '') + ' · ' + when + '</p></div></div>' +
          '<p class="text-sm text-gray-600 leading-relaxed mb-1" style="white-space:pre-line;">' + (r.desc || '') + '</p>' +
          (r.vitals ? '<p class="text-xs text-gray-500">' + r.vitals + '</p>' : '') +
          '</div></div>';
      }).join('');
      SC.icons();
    }

    getJson('patient/medical_records.php').then(function (result) {
      allRecords = (result.ok && result.data.success) ? result.data.records : [];

      var statTotal = document.getElementById('statTotalVisits');
      var statLab = document.getElementById('statLabTests');
      var statRx = document.getElementById('statPrescriptions');
      if (statTotal) statTotal.textContent = allRecords.length;
      if (statLab) statLab.textContent = allRecords.filter(function (r) { return r.type === 'lab'; }).length;
      if (statRx) statRx.textContent = allRecords.filter(hasPrescription).length;

      var hospitals = Array.from(new Set(allRecords.map(function (r) { return r.hospital; }).filter(Boolean))).sort();
      hospitalSelect.innerHTML = '<option value="">All Hospitals</option>' + hospitals.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('');

      render();
    });

    searchInput.addEventListener('input', render);
    hospitalSelect.addEventListener('change', render);
    typeSelect.addEventListener('change', render);
  }

  // ---------------- Telemedicine ----------------
  function initTelemedicine() {
    var chatBox = document.getElementById('chatMessages');
    if (!chatBox) return;
    var appointmentId = qs('appointment_id');
    var currentAppointment = null;

    function renderChat(messages) {
      chatBox.innerHTML = messages.map(function (m) {
        var mine = m.from === SC.getRole();
        return '<div class="flex flex-col" style="align-items:' + (mine ? 'flex-end' : 'flex-start') + ';">' +
          '<div style="max-width:85%;padding:.625rem .75rem;border-radius:1rem;font-size:.875rem;line-height:1.5;' +
          (mine ? 'background:#5B3F8D;color:#fff;border-top-right-radius:.25rem;' : 'background:var(--gray-100);color:var(--gray-800);border-top-left-radius:.25rem;') + '">' + m.text + '</div>' +
          '<span class="text-gray-400 mt-1" style="font-size:10px;">' + new Date(m.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '</span></div>';
      }).join('');
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    function load() {
      var url = 'common/telemedicine.php' + (appointmentId ? '?appointment_id=' + appointmentId : '');
      getJson(url).then(function (result) {
        if (!result.ok || !result.data.success || !result.data.appointment) {
          document.getElementById('tmSubtitle').textContent = 'No upcoming telemedicine session';
          document.getElementById('tmVideoLabel').textContent = '';
          chatBox.innerHTML = '<div class="text-center text-gray-400 py-10">No telemedicine session to show. Book a telemedicine appointment first.</div>';
          document.getElementById('chatSendBtn').disabled = true;
          return;
        }
        currentAppointment = result.data.appointment;
        appointmentId = currentAppointment.id;
        var role = SC.getRole();
        var otherLabel = role === 'patient' ? (currentAppointment.doctor_name + ' · ' + currentAppointment.specialty) : currentAppointment.patient_name;
        document.getElementById('tmSubtitle').textContent = otherLabel;
        document.getElementById('tmVideoLabel').textContent = otherLabel;
        renderChat(result.data.messages);
      });
    }

    document.getElementById('chatSendBtn').addEventListener('click', send);
    document.getElementById('chatInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    function send() {
      var input = document.getElementById('chatInput');
      if (!input.value.trim() || !appointmentId) return;
      var text = input.value.trim();
      input.value = '';
      postJson('common/telemedicine.php', { appointment_id: appointmentId, message: text }).then(function () { load(); });
    }
    var micOn = true, vidOn = true;
    document.getElementById('micBtn').addEventListener('click', function () {
      micOn = !micOn;
      this.setAttribute('data-lucide', micOn ? 'mic' : 'mic-off');
      this.classList.toggle('active-off', !micOn);
      SC.icons();
    });
    document.getElementById('vidBtn').addEventListener('click', function () {
      vidOn = !vidOn;
      this.setAttribute('data-lucide', vidOn ? 'video' : 'video-off');
      this.classList.toggle('active-off', !vidOn);
      var prev = document.getElementById('selfPreview');
      prev.innerHTML = vidOn ? 'F' : '<span data-lucide="video-off" class="icon icon-18"></span>';
      prev.style.background = vidOn ? 'linear-gradient(to bottom right,#6b21a8,#3b0764)' : '#374151';
      SC.icons();
    });
    load();
  }

  // ---------------- Pharmacy ----------------
  function initPharmacy() {
    var browse = document.getElementById('pharmBrowse');
    if (!browse) return;
    var cartKey = 'syncura_cart_v1';
    var cart = loadCart();
    var medicines = [];
    var payMethod = 'bkash';

    function loadCart() { try { return JSON.parse(localStorage.getItem(cartKey) || '[]'); } catch (e) { return []; } }
    function saveCart() {
      localStorage.setItem(cartKey, JSON.stringify(cart));
      var qty = cart.reduce(function (s, c) { return s + c.qty; }, 0);
      SC.setCartCount(qty);
    }
    function cartQty(id) { var c = cart.filter(function (c) { return c.id === id; })[0]; return c ? c.qty : 0; }
    function addToCart(id) {
      var c = cart.filter(function (c) { return c.id === id; })[0];
      if (c) c.qty++; else cart.push({ id: id, qty: 1 });
      saveCart(); renderMeds();
    }
    function updateQty(id, delta) {
      cart = cart.map(function (c) { return c.id === id ? { id: id, qty: Math.max(0, c.qty + delta) } : c; }).filter(function (c) { return c.qty > 0; });
      saveCart();
    }
    function total() {
      return cart.reduce(function (s, c) {
        var med = medicines.filter(function (m) { return m.id === c.id; })[0];
        return s + (med ? med.price * c.qty : 0);
      }, 0);
    }

    function renderMeds() {
      var filtered = medicines;
      document.getElementById('medGrid').innerHTML = filtered.map(function (med) {
        var qty = cartQty(med.id);
        var actionHtml;
        if (med.stock === 'out-of-stock') {
          actionHtml = '<button disabled class="btn" style="margin-top:auto;background:var(--gray-100);color:var(--gray-400);width:100%;">Out of Stock</button>';
        } else if (qty > 0) {
          actionHtml = '<div class="flex items-center gap-2" style="margin-top:auto;">' +
            '<button class="qty-minus" data-id="' + med.id + '" style="flex:1;padding:.5rem;border-radius:.75rem;background:var(--gray-100);display:flex;align-items:center;justify-content:center;"><span data-lucide="minus" class="icon icon-14"></span></button>' +
            '<span class="text-sm font-bold" style="width:2rem;text-align:center;">' + qty + '</span>' +
            '<button class="qty-plus" data-id="' + med.id + '" style="flex:1;padding:.5rem;border-radius:.75rem;background:#5B3F8D;color:#fff;display:flex;align-items:center;justify-content:center;"><span data-lucide="plus" class="icon icon-14"></span></button></div>';
        } else {
          actionHtml = '<button class="add-cart-btn btn" data-id="' + med.id + '" style="margin-top:auto;background:#5B3F8D;color:#fff;width:100%;padding:.625rem;border-radius:.75rem;font-weight:600;font-size:.875rem;display:flex;align-items:center;justify-content:center;gap:.5rem;"><span data-lucide="plus" class="icon icon-15"></span> Add to Cart</button>';
        }
        return '<div class="card p-4 flex flex-col">' +
          '<div style="width:3rem;height:3rem;background:var(--purple-50);border-radius:.75rem;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:.75rem;">💊</div>' +
          '<div class="font-semibold text-gray-800 text-sm mb-0.5 font-heading">' + med.name + '</div>' +
          '<div class="text-xs text-gray-400 mb-1">' + med.generic + '</div>' +
          '<div class="text-xs text-gray-400 mb-2">' + (med.brand || '') + '</div>' +
          '<div class="flex items-center justify-between mb-3"><span class="font-bold text-sm" style="color:#5B3F8D;">৳ ' + med.price + '<span class="text-xs text-gray-400 font-normal"> /' + med.unit + '</span></span>' + SC.badgeHTML(med.stock) + '</div>' +
          actionHtml + '</div>';
      }).join('');
      SC.icons();
      document.querySelectorAll('.add-cart-btn').forEach(function (b) { b.addEventListener('click', function () { addToCart(Number(b.dataset.id)); }); });
      document.querySelectorAll('.qty-plus').forEach(function (b) { b.addEventListener('click', function () { addToCart(Number(b.dataset.id)); }); });
      document.querySelectorAll('.qty-minus').forEach(function (b) { b.addEventListener('click', function () { updateQty(Number(b.dataset.id), -1); renderMeds(); }); });
    }

    function loadMeds() {
      var q = document.getElementById('medQuery').value.trim();
      getJson('patient/medicines.php' + (q ? '?q=' + encodeURIComponent(q) : '')).then(function (result) {
        medicines = (result.ok && result.data.success) ? result.data.medicines : [];
        saveCart();
        renderMeds();
      });
    }

    function renderCart() {
      document.getElementById('cartQtyLabel').textContent = cart.reduce(function (s, c) { return s + c.qty; }, 0);
      document.getElementById('cartCountLabel').textContent = cart.length + ' item types';
      var empty = cart.length === 0;
      document.getElementById('cartEmpty').style.display = empty ? 'block' : 'none';
      document.getElementById('cartContent').style.display = empty ? 'none' : 'block';
      document.getElementById('cartItems').innerHTML = cart.map(function (c) {
        var med = medicines.filter(function (m) { return m.id === c.id; })[0];
        if (!med) return '';
        return '<div class="flex items-center gap-3" style="padding:.75rem 0;border-bottom:1px solid var(--gray-100);">' +
          '<div style="width:2.5rem;height:2.5rem;background:var(--purple-50);border-radius:.75rem;display:flex;align-items:center;justify-content:center;font-size:1.25rem;">💊</div>' +
          '<div class="flex-1"><div class="text-sm font-semibold text-gray-800">' + med.name + '</div><div class="text-xs text-gray-400">' + (med.brand || '') + '</div>' +
          '<div class="text-sm font-bold mt-0.5" style="color:#5B3F8D;">৳ ' + (med.price * c.qty) + '</div></div>' +
          '<div class="flex items-center gap-2">' +
          '<button class="qty-minus2" data-id="' + c.id + '" style="width:1.75rem;height:1.75rem;border-radius:.5rem;background:var(--gray-100);display:flex;align-items:center;justify-content:center;"><span data-lucide="minus" class="icon icon-12"></span></button>' +
          '<span class="text-sm font-semibold" style="width:1.5rem;text-align:center;">' + c.qty + '</span>' +
          '<button class="qty-plus2" data-id="' + c.id + '" style="width:1.75rem;height:1.75rem;border-radius:.5rem;background:var(--purple-100);color:var(--purple-700);display:flex;align-items:center;justify-content:center;"><span data-lucide="plus" class="icon icon-12"></span></button></div></div>';
      }).join('');
      document.getElementById('cartSubtotal').textContent = '৳ ' + total();
      document.getElementById('cartTotal').textContent = '৳ ' + (total() + 50);
      SC.icons();
      document.querySelectorAll('.qty-plus2').forEach(function (b) { b.addEventListener('click', function () { addToCart(Number(b.dataset.id)); renderCart(); }); });
      document.querySelectorAll('.qty-minus2').forEach(function (b) { b.addEventListener('click', function () { updateQty(Number(b.dataset.id), -1); renderCart(); }); });
    }

    function showView(view) {
      document.getElementById('pharmBrowse').style.display = view === 'browse' ? 'block' : 'none';
      document.getElementById('pharmCart').style.display = view === 'cart' ? 'block' : 'none';
      document.getElementById('pharmPayment').style.display = view === 'payment' ? 'block' : 'none';
      document.getElementById('pharmDone').style.display = view === 'done' ? 'block' : 'none';
      if (view === 'cart') renderCart();
      if (view === 'payment') { document.getElementById('paySubtotal').textContent = '৳ ' + total(); document.getElementById('payTotal').textContent = '৳ ' + (total() + 50); document.getElementById('payNowAmount').textContent = '৳ ' + (total() + 50); }
    }

    document.getElementById('medQuery').addEventListener('input', loadMeds);
    document.getElementById('openCartBtn').addEventListener('click', function () { showView('cart'); });
    document.getElementById('cartBrowseBtn').addEventListener('click', function () { showView('browse'); });
    document.getElementById('continueShoppingBtn').addEventListener('click', function () { showView('browse'); });
    document.getElementById('toPaymentBtn').addEventListener('click', function () { showView('payment'); });
    document.querySelectorAll('.pay-method').forEach(function (btn) {
      btn.innerHTML = '<span style="width:2.5rem;height:2.5rem;border-radius:.75rem;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.875rem;background:' + btn.dataset.color + ';">' + btn.textContent[0] + '</span>' +
        '<span class="flex-1"><span class="block font-semibold text-gray-800 text-sm">' + btn.textContent + '</span><span class="block text-xs text-gray-400">' + btn.dataset.num + '</span></span>';
      btn.addEventListener('click', function () {
        payMethod = btn.dataset.id;
        document.querySelectorAll('.pay-method').forEach(function (b) { b.classList.toggle('selected', b === btn); });
      });
    });
    document.querySelector('.pay-method').classList.add('selected');
    document.getElementById('payNowBtn').addEventListener('click', function () {
      var btn = document.getElementById('payNowBtn');
      var errorBox = document.getElementById('payError');
      errorBox.style.display = 'none';
      btn.disabled = true;
      var items = cart.map(function (c) { return { id: c.id, qty: c.qty }; });
      postJson('patient/pharmacy_order.php', { items: items, payment_method: payMethod }).then(function (result) {
        btn.disabled = false;
        if (!result.ok || !result.data.success) {
          errorBox.textContent = (result.data && result.data.message) || 'Could not place order.';
          errorBox.style.display = 'block';
          return;
        }
        var label = payMethod === 'bkash' ? 'bKash' : payMethod === 'nagad' ? 'Nagad' : 'Rocket';
        document.getElementById('orderIdLabel').textContent = 'Order #' + result.data.order_label;
        document.getElementById('orderPayLabel').textContent = 'Payment of ৳ ' + result.data.total + ' received via ' + label + '.';
        cart = []; saveCart();
        showView('done');
      }).catch(function () {
        btn.disabled = false;
        errorBox.textContent = 'Could not reach the server. Please try again.';
        errorBox.style.display = 'block';
      });
    });
    document.getElementById('orderDoneBtn').addEventListener('click', function () { window.location.href = 'dashboard.html'; });

    loadMeds();
  }

  // ---------------- Lab Tests ----------------
  function initLabTests() {
    var grid = document.getElementById('testGrid');
    if (!grid) return;
    var selected = null;
    var labs = [];

    function render(tests) {
      grid.innerHTML = tests.map(function (t) {
        return '<div class="card p-5 flex flex-col">' +
          '<div class="flex items-start justify-between mb-3">' +
          '<div style="width:2.5rem;height:2.5rem;border-radius:.75rem;background:var(--blue-50);color:var(--blue-600);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span data-lucide="flask-conical" class="icon icon-18"></span></div></div>' +
          '<h3 class="font-semibold text-gray-800 text-sm mb-1 font-heading">' + t.name + '</h3>' +
          '<p class="text-xs text-gray-400 mb-3 flex-1 leading-relaxed">' + (t.desc || '') + '</p>' +
          '<div class="flex items-center gap-2 text-xs text-gray-500 mb-4"><span data-lucide="clock" class="icon icon-11"></span> Result in ' + t.turnaround + '<span class="mx-1">·</span><span class="font-medium" style="color:var(--purple-600);">' + t.category + '</span></div>' +
          '<div class="flex items-center justify-between"><span class="font-bold text-lg font-heading" style="color:#5B3F8D;">৳ ' + t.price + '</span>' +
          '<button class="btn btn-brand btn-sm book-test-btn" data-id="' + t.id + '">Book Test</button></div></div>';
      }).join('');
      SC.icons();

      document.querySelectorAll('.book-test-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          selected = tests.filter(function (t) { return t.id === Number(btn.dataset.id); })[0];
          showConfirm();
        });
      });
    }

    function showConfirm() {
      document.getElementById('labBrowse').style.display = 'none';
      document.getElementById('labConfirm').style.display = 'block';
      document.getElementById('labConfirmSubtitle').textContent = selected.name;
      document.getElementById('labBookError').style.display = 'none';
      renderSummary();
    }
    function renderSummary() {
      document.getElementById('labSummary').innerHTML =
        '<div class="flex justify-between"><span class="text-gray-500">Test</span><span class="font-medium">' + selected.name + '</span></div>' +
        '<div class="flex justify-between"><span class="text-gray-500">Category</span><span>' + selected.category + '</span></div>' +
        '<div class="flex justify-between"><span class="text-gray-500">Turnaround</span><span>' + selected.turnaround + '</span></div>' +
        '<div class="flex justify-between font-bold"><span>Fee</span><span style="color:#5B3F8D;">৳ ' + selected.price + '</span></div>';
    }
    document.getElementById('labSelect').addEventListener('change', renderSummary);
    document.getElementById('labBackBtn').addEventListener('click', function () {
      document.getElementById('labConfirm').style.display = 'none';
      document.getElementById('labBrowse').style.display = 'block';
    });
    document.getElementById('labConfirmBtn').addEventListener('click', function () {
      var btn = document.getElementById('labConfirmBtn');
      var errorBox = document.getElementById('labBookError');
      var labIndex = document.getElementById('labSelect').selectedIndex;
      var lab = labs[labIndex];
      btn.disabled = true;
      postJson('patient/lab_book.php', {
        test_id: selected.id, lab_id: lab ? lab.id : (labs[0] && labs[0].id),
        date: document.getElementById('labDate').value, time: document.getElementById('labTime').value
      }).then(function (result) {
        btn.disabled = false;
        if (!result.ok || !result.data.success) {
          errorBox.textContent = (result.data && result.data.message) || 'Could not book this test.';
          errorBox.style.display = 'block';
          return;
        }
        document.getElementById('labConfirm').style.display = 'none';
        document.getElementById('labDone').style.display = 'block';
        document.getElementById('labDoneName').textContent = selected.name;
        document.getElementById('labDoneLab').textContent = document.getElementById('labSelect').value;
        document.getElementById('labDoneWhen').textContent = document.getElementById('labDate').value + ' · ' + document.getElementById('labTime').value;
        document.getElementById('labDoneFee').textContent = 'Fee: ৳ ' + selected.price + ' (payable at lab)';
        document.getElementById('labDoneTurnaround').textContent = 'Results in: ' + selected.turnaround;
      });
    });
    document.getElementById('labAnotherBtn').addEventListener('click', function () {
      document.getElementById('labDone').style.display = 'none';
      document.getElementById('labBrowse').style.display = 'block';
    });

    getJson('patient/labs.php').then(function (result) {
      labs = (result.ok && result.data.success) ? result.data.labs : [];
      document.getElementById('labSelect').innerHTML = labs.map(function (l) { return '<option>' + l.name + '</option>'; }).join('');
    });
    getJson('patient/lab_tests.php').then(function (result) {
      render((result.ok && result.data.success) ? result.data.tests : []);
    });

    var dateInput = document.getElementById('labDate');
    dateInput.min = SC.localISO(new Date());
    dateInput.value = dateInput.min;
  }

  // ---------------- Bed Booking ----------------
  function initBedBooking() {
    var deptWrap = document.getElementById('bedDepts');
    if (!deptWrap) return;
    var hospitalSelect = document.getElementById('bedHospital');
    var form = document.getElementById('bedForm');
    var msg = document.getElementById('bedMsg');
    var dateInput = document.getElementById('bedDate');
    var selected = null;          // { id, name }
    var departments = [];

    var max = new Date(); max.setDate(max.getDate() + 90);
    dateInput.min = SC.localISO(new Date());
    dateInput.max = SC.localISO(max);
    dateInput.value = dateInput.min;

    function show(ok, text) {
      msg.textContent = text;
      msg.style.display = 'block';
      msg.style.background = ok ? 'var(--green-50)' : 'var(--red-50)';
      msg.style.color = ok ? '#15803d' : 'var(--red-600)';
    }

    function renderDepts() {
      if (!hospitalSelect.value) { deptWrap.innerHTML = ''; return; }
      deptWrap.innerHTML = departments.length ? departments.map(function (d) {
        var pct = d.total > 0 ? Math.round(d.booked / d.total * 100) : 100;
        var isSel = selected && selected.id === d.id;
        var status = d.open
          ? '<span class="text-xs font-semibold" style="color:' + (d.available <= 3 ? 'var(--amber-700)' : '#15803d') + ';">' + d.available + ' of ' + d.total + ' beds free</span>'
          : '<span class="text-xs font-semibold" style="color:var(--red-600);">' + (d.total === 0 ? 'No beds set up' : 'Full — bookings closed') + '</span>';
        return '<button type="button" class="bed-dept" data-id="' + d.id + '" ' + (d.open ? '' : 'disabled') + ' style="text-align:left;padding:.875rem 1rem;border-radius:.75rem;background:' + (isSel ? 'var(--purple-50)' : '#fff') + ';' +
          'border:2px solid ' + (isSel ? 'var(--purple-700)' : 'var(--gray-200)') + ';' + (d.open ? 'cursor:pointer;' : 'opacity:.6;cursor:not-allowed;') + '">' +
          '<div class="flex items-center justify-between gap-2"><span class="font-semibold text-gray-800 text-sm">' + SC.esc(d.name) + '</span>' + status + '</div>' +
          '<div class="progress-track" style="margin-top:.5rem;"><div class="progress-fill" style="width:' + pct + '%;background:' + (d.open ? '#5B3F8D' : 'var(--red-600)') + ';"></div></div></button>';
      }).join('') : '<div class="text-sm text-gray-400" style="grid-column:1/-1;">This hospital has no departments yet.</div>';
      deptWrap.querySelectorAll('.bed-dept').forEach(function (b) {
        b.addEventListener('click', function () {
          var d = departments.filter(function (x) { return x.id === Number(b.dataset.id); })[0];
          selected = { id: d.id, name: d.name };
          document.getElementById('bedSelected').textContent = hospitalSelect.options[hospitalSelect.selectedIndex].text + ' · ' + d.name + ' (' + d.available + ' beds free)';
          form.style.display = 'block';
          msg.style.display = 'none';
          renderDepts();
        });
      });
    }

    function loadDepts() {
      if (!hospitalSelect.value) { departments = []; renderDepts(); return; }
      getJson('patient/beds.php?hospital_id=' + hospitalSelect.value).then(function (result) {
        if (!result.ok || !result.data.success) return;
        departments = result.data.departments;
        // The department I picked may have just filled up.
        if (selected) {
          var cur = departments.filter(function (x) { return x.id === selected.id; })[0];
          if (!cur || !cur.open) {
            selected = null;
            document.getElementById('bedSelected').textContent = 'Please pick another department.';
            show(false, 'That department just filled up — bookings for it are now closed.');
          }
        }
        renderDepts();
      });
    }

    function loadHome() {
      getJson('patient/beds.php').then(function (result) {
        if (!result.ok || !result.data.success) return;
        var current = hospitalSelect.value;
        hospitalSelect.innerHTML = '<option value="">Select a hospital</option>' + result.data.hospitals.map(function (h) {
          return '<option value="' + h.id + '">' + SC.esc(h.name) + (h.city ? ' — ' + SC.esc(h.city) : '') + '</option>';
        }).join('');
        hospitalSelect.value = current;

        var list = document.getElementById('myBeds');
        list.innerHTML = result.data.bookings.length ? result.data.bookings.map(function (b) {
          var when = new Date(b.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
          var active = b.status === 'pending' || b.status === 'approved';
          return '<div style="padding:.75rem 0;border-bottom:1px solid var(--gray-100);">' +
            '<div class="flex items-start justify-between gap-2"><div><div class="font-semibold text-gray-800 text-sm">' + SC.esc(b.department) + '</div>' +
            '<div class="text-xs text-gray-500">' + SC.esc(b.hospital) + '</div></div>' + SC.badgeHTML(b.status) + '</div>' +
            '<div class="text-xs text-gray-500 mt-1">Admission: ' + when + '</div>' +
            '<div class="text-xs text-gray-400" style="margin-top:.125rem;">' + SC.esc(b.reason) + '</div>' +
            (b.status === 'pending' ? '<div class="text-xs mt-1" style="color:var(--amber-700);">⏳ Awaiting hospital approval</div>' : '') +
            (b.status === 'rejected' && b.rejectionReason ? '<div class="text-xs mt-1" style="color:var(--red-600);">Reason: ' + SC.esc(b.rejectionReason) + '</div>' : '') +
            (active ? '<button class="btn btn-danger btn-sm cancel-bed mt-2" data-id="' + b.id + '">Cancel booking</button>' : '') + '</div>';
        }).join('') : '<div class="text-sm text-gray-400">You have no bed bookings yet.</div>';
        list.querySelectorAll('.cancel-bed').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (!window.confirm('Cancel this bed booking? The bed will be released.')) return;
            postJson('patient/beds.php', { action: 'cancel', booking_id: Number(btn.dataset.id) }).then(function (r) {
              if (!r.ok || !r.data.success) { window.alert((r.data && r.data.message) || 'Could not cancel this booking.'); }
              loadHome(); loadDepts();
            });
          });
        });
      });
    }

    hospitalSelect.addEventListener('change', function () {
      selected = null; form.style.display = 'none'; msg.style.display = 'none';
      loadDepts();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!selected) { show(false, 'Please choose a department first.'); return; }
      var btn = document.getElementById('bedSubmit');
      btn.disabled = true;
      postJson('patient/beds.php', {
        department_id: selected.id, admission_date: dateInput.value,
        reason: document.getElementById('bedReason').value.trim(),
        attendant_phone: document.getElementById('bedPhone').value.trim(),
        notes: document.getElementById('bedNotes').value.trim()
      }).then(function (result) {
        btn.disabled = false;
        if (!result.ok || !result.data.success) {
          show(false, (result.data && result.data.message) || 'Could not send your request.');
          loadDepts(); loadHome();
          return;
        }
        show(true, result.data.message);
        ['bedReason', 'bedNotes', 'bedPhone'].forEach(function (id) { document.getElementById(id).value = ''; });
        selected = null;
        loadDepts(); loadHome();
      });
    });

    loadHome();
    // Keep the bed numbers fresh while the page is open.
    setInterval(function () { if (hospitalSelect.value) loadDepts(); }, 20000);
  }

  // ---------------- Lab Results ----------------
  function initLabResults() {
    var wrap = document.getElementById('labResultsList');
    if (!wrap) return;

    getJson('patient/lab_results.php').then(function (result) {
      var results = (result.ok && result.data.success) ? result.data.results : [];
      if (!results.length) {
        wrap.innerHTML = '<div class="text-center text-gray-400 py-10">No lab bookings yet.</div>';
        return;
      }
      wrap.innerHTML = results.map(function (r) {
        var when = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        return '<div class="card p-5"><div class="flex items-start gap-4">' +
          '<div style="width:2.5rem;height:2.5rem;border-radius:.75rem;background:var(--blue-50);color:var(--blue-600);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span data-lucide="flask-conical" class="icon icon-18"></span></div>' +
          '<div class="flex-1 min-w-0"><div class="flex flex-wrap items-start justify-between gap-2 mb-1"><h3 class="font-semibold text-gray-800 font-heading">' + r.test + '</h3>' + SC.badgeHTML(r.status) + '</div>' +
          '<p class="text-sm text-gray-500 mb-1">' + r.lab + '</p>' +
          '<div class="flex items-center gap-1 text-xs text-gray-400 mb-3"><span data-lucide="clock" class="icon icon-11"></span> ' + when + '</div>' +
          (r.result ? '<div class="rounded-xl text-sm text-gray-700 mb-3" style="background:var(--gray-50);padding:.75rem 1rem;"><span class="font-medium">Result: </span>' + r.result + '</div>' : '') +
          (r.status !== 'ready' ? '<div class="rounded-xl text-xs mb-3" style="background:var(--amber-50);color:var(--amber-700);padding:.625rem 1rem;border:1px solid var(--amber-100);">⏳ Your result is being processed. You will be notified when it\'s ready.</div>' : '') +
          (r.file ? '<div class="flex gap-2"><a href="' + apiUrl('patient/lab_result_file.php?booking_id=' + r.id) + '" target="_blank" class="btn btn-ghost btn-sm" style="border:1px solid var(--gray-200);"><span data-lucide="eye" class="icon icon-13"></span> View Report</a></div>' : '') +
          '</div></div></div>';
      }).join('');
      SC.icons();
    });
  }

})();
