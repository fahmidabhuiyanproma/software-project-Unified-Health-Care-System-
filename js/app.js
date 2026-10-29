/* ==========================================================================
   SynCura — app.js
   Shared application state (role/user/cart), the sidebar+navbar "layout"
   renderer used by every logged-in page, and small shared helpers.
   State is kept in localStorage so it persists across page loads, the way
   the original React app kept it in memory for the session.
   ========================================================================== */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'syncura_state_v1';

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { role: null, user: null, cartCount: 0 };
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  var state = loadState();

  var SC = {
    getRole: function () { return state.role; },
    getUser: function () { return state.user; },
    getCartCount: function () { return state.cartCount || 0; },
    setCartCount: function (n) { state.cartCount = Math.max(0, n); saveState(state); SC.renderNavbar(); },
    notifications: 0,

    // Real unread count on the navbar bell (was a hardcoded 3).
    setNotificationCount: function (n) {
      SC.notifications = n;
      var bell = document.querySelector('.navbar-icon-btn[aria-label="Notifications"]');
      if (!bell) return;
      var badge = bell.querySelector('.navbar-badge');
      if (n > 0) {
        if (!badge) { badge = document.createElement('span'); badge.className = 'navbar-badge'; bell.appendChild(badge); }
        badge.textContent = n;
      } else if (badge) {
        badge.remove();
      }
    },

    showToast: function (title, body) {
      var t = document.createElement('div');
      t.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;max-width:20rem;background:#fff;border-left:4px solid #5B3F8D;' +
        'border-radius:.75rem;box-shadow:0 10px 30px rgba(16,24,40,.18);padding:.75rem 1rem;cursor:pointer;';
      var h = document.createElement('div');
      h.style.cssText = 'font-weight:600;font-size:.875rem;color:#1f2937;';
      h.textContent = title;
      var p = document.createElement('div');
      p.style.cssText = 'font-size:.75rem;color:#6b7280;margin-top:.125rem;';
      p.textContent = body;
      t.appendChild(h); t.appendChild(p);
      t.addEventListener('click', function () { global.location.href = SC.base() + 'pages/notifications.html'; });
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 6000);
    },

    // Polls for new notifications: keeps the bell count live and pops a toast
    // for anything newer than the last one this browser has already seen.
    pollNotifications: function () {
      fetch(SC.base() + 'api/common/notifications.php', { credentials: 'same-origin' }).then(function (r) {
        if (r.status === 401) { SC.sessionExpired(); return null; }
        return r.json();
      }).then(function (data) {
        if (!data || !data.success) return;
        var list = data.notifications;
        SC.setNotificationCount(list.filter(function (n) { return !n.read; }).length);
        var key = 'syncura_last_notif_' + (SC.getRole() || '');
        var lastSeen = null;
        try { lastSeen = localStorage.getItem(key); } catch (e) { /* ignore */ }
        var maxId = list.reduce(function (m, n) { return Math.max(m, n.id); }, 0);
        if (lastSeen !== null) {
          list.filter(function (n) { return !n.read && n.id > Number(lastSeen); })
            .sort(function (a, b) { return a.id - b.id; })
            .forEach(function (n) { SC.showToast(n.title, n.body); });
        }
        try { localStorage.setItem(key, String(maxId)); } catch (e) { /* ignore */ }
      }).catch(function () { /* offline: try again next tick */ });
    },
    startNotificationPolling: function () {
      if (SC._polling) return;
      SC._polling = true;
      SC.pollNotifications();
      setInterval(SC.pollNotifications, 15000);
    },

    login: function (role, user) {
      state.role = role;
      state.user = user;
      saveState(state);
    },
    logout: function () {
      state.role = null;
      state.user = null;
      state.cartCount = 0;
      saveState(state);
      global.location.href = SC.base() + 'index.html';
    },

    // Called by getJson/postJson when the server says the PHP session is
    // gone (401) even though localStorage still thinks we're logged in —
    // e.g. the session expired or the server was restarted. Clears the
    // stale local state and sends the user back to login with a notice,
    // instead of letting every page silently render as "no data".
    sessionExpired: function () {
      if (!state.role) return;
      state.role = null;
      state.user = null;
      state.cartCount = 0;
      saveState(state);
      global.location.href = SC.base() + 'pages/auth/login.html?expired=1';
    },

    // Base path: every page defines `window.SC_BASE` before loading app.js,
    // e.g. '../../' for pages two levels deep, './' for the root index.html.
    base: function () { return global.SC_BASE || './'; },

    roleLabels: {
      patient: 'Patient Portal', doctor: 'Doctor Portal', hospital: 'Hospital Admin',
      lab: 'Lab Admin', pharmacy: 'Pharmacy Admin', admin: 'System Admin'
    },
    navUserLabel: {
      patient: 'Patient', doctor: 'Dr.', hospital: 'Hospital Admin',
      lab: 'Lab Admin', pharmacy: 'Pharmacy Admin', admin: 'System Admin'
    },
    roleHome: {
      patient: 'pages/patient/dashboard.html', doctor: 'pages/doctor/dashboard.html',
      hospital: 'pages/hospital-admin/dashboard.html', lab: 'pages/lab-admin/dashboard.html',
      pharmacy: 'pages/pharmacy-admin/dashboard.html', admin: 'pages/system-admin/dashboard.html'
    },

    menuByRole: {
      patient: [
        { label: 'Dashboard', icon: 'home', to: 'pages/patient/dashboard.html' },
        { label: 'Find Doctors', icon: 'search', to: 'pages/patient/search-doctors.html' },
        { label: 'Appointments', icon: 'calendar', to: 'pages/patient/appointments.html' },
        { label: 'Medical Records', icon: 'file-text', to: 'pages/patient/medical-records.html' },
        { label: 'Telemedicine', icon: 'video', to: 'pages/patient/telemedicine.html' },
        { label: 'Pharmacy', icon: 'shopping-bag', to: 'pages/patient/pharmacy.html' },
        { label: 'Lab Tests', icon: 'flask-conical', to: 'pages/patient/lab-tests.html' },
        { label: 'Lab Results', icon: 'clipboard-list', to: 'pages/patient/lab-results.html' },
        { label: 'Bed Booking', icon: 'bed-double', to: 'pages/patient/bed-booking.html' },
        { label: 'Notifications', icon: 'bell', to: 'pages/notifications.html' }
      ],
      doctor: [
        { label: 'Dashboard', icon: 'home', to: 'pages/doctor/dashboard.html' },
        { label: 'My Schedule', icon: 'calendar', to: 'pages/doctor/schedule.html' },
        { label: 'My Patients', icon: 'users', to: 'pages/doctor/patients.html' },
        { label: 'Notifications', icon: 'bell', to: 'pages/notifications.html' }
      ],
      hospital: [
        { label: 'Dashboard', icon: 'home', to: 'pages/hospital-admin/dashboard.html' },
        { label: 'Manage Doctors', icon: 'stethoscope', to: 'pages/hospital-admin/doctors.html' },
        { label: 'Doctor Approvals', icon: 'user-check', to: 'pages/hospital-admin/approvals.html' },
        { label: 'Departments', icon: 'building-2', to: 'pages/hospital-admin/departments.html' },
        { label: 'Appointments', icon: 'calendar', to: 'pages/hospital-admin/appointments.html' },
        { label: 'Bed Requests', icon: 'bed-double', to: 'pages/hospital-admin/beds.html' },
        { label: 'Notifications', icon: 'bell', to: 'pages/notifications.html' }
      ],
      lab: [
        { label: 'Dashboard', icon: 'home', to: 'pages/lab-admin/dashboard.html' },
        { label: 'Test Catalog', icon: 'flask-conical', to: 'pages/lab-admin/catalog.html' },
        { label: 'Bookings', icon: 'clipboard-list', to: 'pages/lab-admin/bookings.html' },
        { label: 'Notifications', icon: 'bell', to: 'pages/notifications.html' }
      ],
      pharmacy: [
        { label: 'Dashboard', icon: 'home', to: 'pages/pharmacy-admin/dashboard.html' },
        { label: 'Medicine Catalog', icon: 'package', to: 'pages/pharmacy-admin/catalog.html' },
        { label: 'Orders', icon: 'shopping-bag', to: 'pages/pharmacy-admin/orders.html' },
        { label: 'Notifications', icon: 'bell', to: 'pages/notifications.html' }
      ],
      admin: [
        { label: 'Dashboard', icon: 'bar-chart-3', to: 'pages/system-admin/dashboard.html' },
        { label: 'Provider Approvals', icon: 'user-check', to: 'pages/system-admin/approvals.html' },
        { label: 'Manage Users', icon: 'users', to: 'pages/system-admin/users.html' },
        { label: 'Platform Settings', icon: 'settings', to: 'pages/system-admin/settings.html' },
        { label: 'Notifications', icon: 'bell', to: 'pages/notifications.html' }
      ]
    },

    // Inline CSS that paints a profile picture over the default gradient ('' when there is none).
    avatarStyle: function (url) {
      if (!url) return '';
      return 'background-image:url(&quot;' + encodeURI(url).replace(/"/g, '%22') + '&quot;);background-size:cover;background-position:center;';
    },

    // Merge fresh name/avatar into the stored user (after a profile edit) and redraw the navbar.
    updateUser: function (partial) {
      state.user = Object.assign({}, state.user || {}, partial);
      saveState(state);
      SC.renderNavbar();
    },

    // Escape user-supplied text before it goes into innerHTML.
    esc: function (v) {
      return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },

    initials: function (name) {
      if (!name) return '?';
      var parts = name.replace(/^Dr\.\s*/, '').split(' ').filter(Boolean);
      return (parts[0] ? parts[0][0] : '') + (parts[1] ? parts[1][0] : '');
    },

    badgeClass: function (status) {
      status = { approved: 'confirmed', rejected: 'cancelled', discharged: 'completed' }[status] || status;
      var known = ['confirmed', 'completed', 'ready', 'delivered', 'in-stock', 'pending',
        'processing', 'low-stock', 'cancelled', 'out-of-stock'];
      return known.indexOf(status) > -1 ? 'badge-' + status : 'badge-default';
    },
    badgeLabel: function (status) {
      var map = {
        confirmed: 'Confirmed', completed: 'Completed', ready: 'Ready', delivered: 'Delivered',
        'in-stock': 'In Stock', pending: 'Pending', processing: 'Processing', 'low-stock': 'Low Stock',
        cancelled: 'Cancelled', 'out-of-stock': 'Out of Stock',
        approved: 'Approved', rejected: 'Rejected', discharged: 'Discharged'
      };
      return map[status] || status;
    },
    badgeHTML: function (status) {
      return '<span class="badge ' + SC.badgeClass(status) + '"><span class="dot"></span>' + SC.badgeLabel(status) + '</span>';
    },

    // ---- Layout: builds the sidebar + navbar into the #app-shell skeleton ----
    requireAuth: function () {
      if (!state.role) {
        global.location.href = SC.base() + 'pages/auth/login.html';
        return false;
      }
      return true;
    },

    renderSidebar: function () {
      var role = state.role;
      var mount = document.getElementById('sidebar');
      if (!mount || !role) return;
      var items = SC.menuByRole[role] || [];
      var base = SC.base();
      var current = global.location.pathname.split('/').pop();
      var html = '';
      html += '<div class="sidebar-head">';
      html += '<div><div class="sidebar-brand">SynCura</div><div class="sidebar-role">' + SC.roleLabels[role] + '</div></div>';
      html += '<button class="sidebar-close" id="sidebarCloseBtn" aria-label="Close menu" data-lucide="x"></button>';
      html += '</div>';
      html += '<nav class="sidebar-nav">';
      items.forEach(function (item) {
        var href = base + item.to;
        var file = item.to.split('/').pop();
        var isActive = file === current;
        html += '<a class="sidebar-link' + (isActive ? ' active' : '') + '" href="' + href + '">';
        html += '<span data-lucide="' + item.icon + '" class="icon"></span>' + item.label;
        html += '</a>';
      });
      html += '</nav>';
      html += '<div class="sidebar-foot"><span data-lucide="shield" class="icon"></span><span>HIPAA Compliant &middot; Secure</span></div>';
      mount.innerHTML = html;

      var closeBtn = document.getElementById('sidebarCloseBtn');
      if (closeBtn) closeBtn.addEventListener('click', SC.closeSidebar);
    },

    openSidebar: function () {
      var sb = document.getElementById('sidebar');
      var bd = document.getElementById('sidebarBackdrop');
      if (sb) sb.classList.add('open');
      if (bd) bd.classList.add('show');
    },
    closeSidebar: function () {
      var sb = document.getElementById('sidebar');
      var bd = document.getElementById('sidebarBackdrop');
      if (sb) sb.classList.remove('open');
      if (bd) bd.classList.remove('show');
    },

    renderNavbar: function () {
      var role = state.role;
      var mount = document.getElementById('navbar');
      if (!mount || !role) return;
      var base = SC.base();
      var user = state.user || { name: 'User' };
      var cart = SC.getCartCount();
      var html = '';
      html += '<button class="navbar-menu-btn" id="navMenuBtn" aria-label="Open menu"><span data-lucide="menu" class="icon"></span></button>';
      html += '<div class="flex-1"></div>';
      html += '<a class="navbar-icon-btn" href="' + base + 'pages/notifications.html" aria-label="Notifications">';
      html += '<span data-lucide="bell" class="icon"></span>';
      if (SC.notifications > 0) html += '<span class="navbar-badge">' + SC.notifications + '</span>';
      html += '</a>';
      if (cart > 0) {
        html += '<a class="navbar-icon-btn" href="' + base + 'pages/patient/pharmacy.html" aria-label="Cart">\uD83D\uDED2';
        html += '<span class="navbar-badge cart">' + cart + '</span></a>';
      }
      html += '<div class="navbar-user">';
      html += '<button class="navbar-user-btn" id="navUserBtn">';
      html += '<span class="avatar avatar-round" style="width:2rem;height:2rem;font-size:.8rem;' + SC.avatarStyle(user.avatar) + '">' + (user.avatar ? '' : SC.initials(user.name).toUpperCase()) + '</span>';
      html += '<span class="navbar-user-name">' + (SC.navUserLabel[role] || '') + ' ' + (user.name || 'User') + '</span>';
      html += '<span data-lucide="chevron-down" class="icon" style="color:var(--gray-400);"></span>';
      html += '</button>';
      html += '<div class="navbar-dropdown" id="navDropdown" hidden>';
      html += '<button class="navbar-dropdown-item" id="navProfileBtn"><span data-lucide="user" class="icon"></span> Profile</button>';
      html += '<hr>';
      html += '<button class="navbar-dropdown-item danger" id="navLogoutBtn"><span data-lucide="log-out" class="icon"></span> Sign Out</button>';
      html += '</div></div>';
      mount.innerHTML = html;

      var menuBtn = document.getElementById('navMenuBtn');
      if (menuBtn) menuBtn.addEventListener('click', SC.openSidebar);
      var userBtn = document.getElementById('navUserBtn');
      var dropdown = document.getElementById('navDropdown');
      if (userBtn && dropdown) {
        userBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          dropdown.hidden = !dropdown.hidden;
        });
        document.addEventListener('click', function () { dropdown.hidden = true; });
      }
      var profileBtn = document.getElementById('navProfileBtn');
      if (profileBtn) profileBtn.addEventListener('click', function () { global.location.href = SC.base() + 'pages/profile.html'; });
      var logoutBtn = document.getElementById('navLogoutBtn');
      if (logoutBtn) logoutBtn.addEventListener('click', SC.logout);

      if (global.lucide) global.lucide.createIcons();
    },

    renderShell: function () {
      if (!SC.requireAuth()) return;
      SC.renderSidebar();
      SC.renderNavbar();
      var backdrop = document.getElementById('sidebarBackdrop');
      if (backdrop) backdrop.addEventListener('click', SC.closeSidebar);
      if (global.lucide) global.lucide.createIcons();
      SC.startNotificationPolling();
    },

    // YYYY-MM-DD in the browser's LOCAL timezone. Date.toISOString() is UTC,
    // which shifts the date back a day for anyone ahead of UTC (e.g. Dhaka,
    // UTC+6) between local midnight and their UTC offset.
    localISO: function (d) {
      var m = d.getMonth() + 1, day = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    },

    icons: function () { if (global.lucide) global.lucide.createIcons(); }
  };

  global.SC = SC;
})(window);
