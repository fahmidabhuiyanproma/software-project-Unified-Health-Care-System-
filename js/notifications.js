/* ==========================================================================
   SynCura — notifications.js
   Talks to the PHP/MySQL backend under /api/common/notifications.php.
   Shared by every role's Notifications page.
   ========================================================================== */
(function () {
  'use strict';

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

  function timeAgo(iso) {
    var diffMs = Date.now() - new Date(iso.replace(' ', 'T')).getTime();
    var mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' minute' + (mins === 1 ? '' : 's') + ' ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
    var days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return days + ' days ago';
  }

  var iconColors = {
    calendar: ['#5B3F8D', '#F3F0FF'], 'flask-conical': ['#0369A1', '#E0F2FE'], 'shopping-bag': ['#16A34A', '#DCFCE7'],
    'user-check': ['#D97706', '#FEF3C7'], 'x-circle': ['#DC2626', '#FEE2E2'], 'message-circle': ['#8E5DAF', '#F3E8FF'],
    shield: ['#DC2626', '#FEE2E2'], 'bed-double': ['#0F766E', '#CCFBF1'], bell: ['#8E5DAF', '#F3E8FF']
  };

  function render() {
    getJson('common/notifications.php').then(function (result) {
      var list = (result.ok && result.data.success) ? result.data.notifications : [];
      var unread = list.filter(function (n) { return !n.read; }).length;
      document.getElementById('unreadCount').textContent = unread + ' unread';
      SC.setNotificationCount(unread);
      var wrap = document.getElementById('notifList');
      if (!list.length) {
        wrap.innerHTML = '<div class="card p-10 text-center text-gray-400">No notifications yet.</div>';
        return;
      }
      wrap.innerHTML = list.map(function (n) {
        var colors = iconColors[n.icon] || iconColors.bell;
        return '<div class="card p-5" style="' + (n.read ? '' : 'border-color:var(--purple-100);') + '">' +
          '<div class="flex items-start gap-4">' +
          '<div class="stat-icon" style="width:2.5rem;height:2.5rem;background:' + colors[1] + ';color:' + colors[0] + ';flex-shrink:0;">' +
          '<span data-lucide="' + n.icon + '" class="icon icon-18"></span></div>' +
          '<div class="flex-1 min-w-0">' +
          '<div class="flex items-start justify-between gap-2">' +
          '<h3 class="text-sm font-semibold font-heading" style="color:' + (n.read ? 'var(--gray-700)' : 'var(--gray-800)') + ';">' + n.title +
          (n.read ? '' : ' <span style="display:inline-block;width:.5rem;height:.5rem;border-radius:9999px;background:#5B3F8D;margin-left:.5rem;vertical-align:middle;"></span>') +
          '</h3><span class="text-xs text-gray-400" style="white-space:nowrap;">' + timeAgo(n.time) + '</span></div>' +
          '<p class="text-sm text-gray-500 mt-1 leading-relaxed">' + n.body + '</p></div>' +
          (n.read ? '<span data-lucide="check-circle" class="icon icon-14 text-gray-300" style="margin-top:2px;"></span>' : '') +
          '</div></div>';
      }).join('');
      SC.icons();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!SC.requireAuth()) return;
    SC.renderShell();
    render();
    document.getElementById('markAllRead').addEventListener('click', function () {
      postJson('common/notifications.php', { mark_all_read: true }).then(render);
    });
  });
})();
