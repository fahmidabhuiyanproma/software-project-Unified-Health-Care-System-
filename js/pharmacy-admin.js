/* ==========================================================================
   SynCura — pharmacy-admin.js
   Talks to the PHP/MySQL backend under /api/pharmacy-admin.
   ========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!SC.requireAuth()) return;
    SC.renderShell();
    initDashboard();
    initCatalog();
    initOrders();
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
    var el = document.getElementById('recentOrders');
    if (!el) return;

    getJson('pharmacy-admin/dashboard.php').then(function (result) {
      if (!result.ok || !result.data.success) return;

      var subtitleEl = document.getElementById('pharmacySubtitle');
      if (subtitleEl) {
        var ph = result.data.pharmacy;
        subtitleEl.textContent = ph.location ? (ph.name + ' — ' + ph.location) : ph.name;
      }
      var s = result.data.stats;
      document.getElementById('statOrdersToday').textContent = s.ordersToday;
      document.getElementById('statOrdersTodaySub').textContent = s.pendingToday + ' pending';
      document.getElementById('statRevenueToday').textContent = '৳ ' + Number(s.revenueToday).toLocaleString();
      var revenueSub = document.getElementById('statRevenueTodaySub');
      if (s.revenueYesterday > 0) {
        var pct = Math.round(((s.revenueToday - s.revenueYesterday) / s.revenueYesterday) * 100);
        revenueSub.textContent = (pct >= 0 ? '+' : '') + pct + '% vs yesterday';
      } else {
        revenueSub.textContent = s.revenueToday > 0 ? 'vs ৳0 yesterday' : 'No revenue yesterday';
      }
      document.getElementById('statTotalProducts').textContent = s.totalProducts;
      document.getElementById('statLowStock').textContent = s.lowStockCount;
      document.getElementById('statLowStockSub').textContent = s.lowStockCount > 0 ? 'Needs restock' : 'All stocked';

      var recentOrders = result.data.recentOrders;
      el.innerHTML = recentOrders.length ? recentOrders.map(function (o) {
        return '<div class="p-4 flex items-center gap-4">' +
          '<div class="text-xs font-mono text-gray-400" style="width:5rem;flex-shrink:0;">' + o.id + '</div>' +
          '<div class="flex-1"><div class="font-semibold text-gray-800 text-sm">' + o.patient + '</div><div class="text-xs text-gray-400">' + o.items + ' items</div></div>' +
          '<div class="font-bold sm:block" style="font-size:.875rem;color:#5B3F8D;display:none;">' + o.total + '</div>' + SC.badgeHTML(o.status) + '</div>';
      }).join('') : '<div class="p-6 text-center text-gray-400 text-sm">No orders yet.</div>';

      var low = document.getElementById('lowStockList');
      low.innerHTML = result.data.lowStock.length ? result.data.lowStock.map(function (m) {
        return '<div class="flex items-center gap-2" style="padding:.5rem 0;border-bottom:1px solid var(--gray-50);font-size:.875rem;">' +
          '<span class="w-2 h-2 rounded-full bg-amber-400" style="flex-shrink:0;"></span><span class="text-gray-700 flex-1">' + m + '</span>' +
          '<span class="font-medium" style="font-size:.75rem;color:var(--amber-600);">Restock</span></div>';
      }).join('') : '<div class="text-gray-400 text-sm">No low-stock items.</div>';
      SC.icons();
    });
  }

  function initCatalog() {
    var body = document.getElementById('medCatalogBody');
    if (!body) return;
    var editingId = null;
    var medsById = {};

    function load() {
      getJson('pharmacy-admin/catalog.php').then(function (result) {
        var meds = (result.ok && result.data.success) ? result.data.medicines : [];
        medsById = {};
        document.getElementById('medCatalogSubtitle').textContent = meds.length + ' medicines · ' + result.data.lowStockCount + ' low stock, ' + result.data.outOfStockCount + ' out of stock';
        body.innerHTML = meds.length ? meds.map(function (m) {
          medsById[m.id] = m;
          var stockColor = m.stock === 0 ? 'var(--red-500)' : m.stock < 50 ? 'var(--amber-600)' : 'var(--gray-700)';
          return '<tr><td class="font-semibold text-gray-800">' + m.name + '</td>' +
            '<td class="text-gray-500" style="font-size:.75rem;">' + m.generic + '</td>' +
            '<td><span style="background:var(--purple-50);color:var(--purple-700);font-size:.75rem;padding:.25rem .5rem;border-radius:.5rem;">' + m.category + '</span></td>' +
            '<td class="font-bold" style="font-size:.875rem;color:#5B3F8D;">৳ ' + m.price + '</td>' +
            '<td style="font-size:.875rem;"><span style="color:' + stockColor + ';font-weight:' + (m.stock < 50 ? '600' : '400') + ';">' + (m.stock < 50 && m.stock > 0 ? '⚠ ' : '') + m.stock + ' units</span></td>' +
            '<td>' + SC.badgeHTML(m.status) + '</td>' +
            '<td><button class="btn btn-secondary btn-sm edit-med-btn" data-id="' + m.id + '"><span data-lucide="pencil" class="icon icon-12"></span> Edit</button></td></tr>';
        }).join('') : '<tr><td colspan="7" class="text-center text-gray-400 py-8">No medicines yet. Add one to get started.</td></tr>';
        SC.icons();
        document.querySelectorAll('.edit-med-btn').forEach(function (b) {
          b.addEventListener('click', function () { openModal(medsById[Number(b.dataset.id)]); });
        });
      });
    }

    var modal = document.getElementById('addMedModal');
    var modalTitle = document.getElementById('medModalTitle');
    var confirmBtn = document.getElementById('confirmAddMed');

    function openModal(med) {
      editingId = med ? med.id : null;
      modalTitle.textContent = med ? 'Edit Medicine' : 'Add Medicine to Catalog';
      confirmBtn.textContent = med ? 'Save Changes' : 'Add Medicine';
      document.getElementById('medName').value = med ? med.name : '';
      document.getElementById('medGeneric').value = med ? med.generic : '';
      document.getElementById('medCategory').value = med ? med.category : '';
      document.getElementById('medPrice').value = med ? med.price : '';
      document.getElementById('medStock').value = med ? med.stock : '';
      document.getElementById('addMedError').style.display = 'none';
      modal.hidden = false;
    }

    document.getElementById('addMedBtn').addEventListener('click', function () { openModal(null); });
    document.getElementById('addMedBackdrop').addEventListener('click', function () { modal.hidden = true; });
    document.getElementById('cancelAddMed').addEventListener('click', function () { modal.hidden = true; });
    confirmBtn.addEventListener('click', function () {
      var errorBox = document.getElementById('addMedError');
      errorBox.style.display = 'none';
      var payload = {
        name: document.getElementById('medName').value.trim(),
        generic_name: document.getElementById('medGeneric').value.trim(),
        category: document.getElementById('medCategory').value,
        price: Number(document.getElementById('medPrice').value) || 0,
        stock_qty: Number(document.getElementById('medStock').value) || 0
      };
      if (editingId) { payload.action = 'update'; payload.id = editingId; }
      postJson('pharmacy-admin/catalog.php', payload).then(function (result) {
        if (!result.ok || !result.data.success) {
          errorBox.textContent = (result.data && result.data.message) || 'Could not save this medicine.';
          errorBox.style.display = 'block';
          return;
        }
        modal.hidden = true;
        load();
      });
    });

    load();
  }

  function initOrders() {
    var list = document.getElementById('ordersList');
    if (!list) return;
    var statusFlow = { pending: 'processing', processing: 'delivered' };

    function load() {
      getJson('pharmacy-admin/orders.php').then(function (result) {
        var orders = (result.ok && result.data.success) ? result.data.orders : [];
        document.getElementById('ordersSubtitle').textContent = orders.length + ' orders';
        list.innerHTML = orders.length ? orders.map(function (o) {
          var action = statusFlow[o.status]
            ? '<button class="btn btn-brand btn-sm advance-btn" data-id="' + o.order_id + '">Mark as ' + statusFlow[o.status].charAt(0).toUpperCase() + statusFlow[o.status].slice(1) + '</button>'
            : '<span class="text-green-600 flex items-center gap-1.5 font-medium" style="font-size:.875rem;">✓ Delivered</span>';
          return '<div class="card p-5"><div class="flex flex-wrap items-start justify-between gap-3 mb-4">' +
            '<div><div class="flex items-center gap-3 mb-1"><span class="font-mono text-xs text-gray-400">' + o.id + '</span>' + SC.badgeHTML(o.status) + '</div>' +
            '<div class="font-semibold text-gray-800">' + o.patient + '</div><div class="text-xs text-gray-400">' + o.phone + ' · ' + o.date + ' · ' + o.time + '</div></div>' +
            '<div class="font-bold text-lg font-heading" style="color:#5B3F8D;">' + o.total + '</div></div>' +
            '<div style="background:var(--gray-50);border-radius:.75rem;padding:.75rem;margin-bottom:1rem;">' +
            '<div class="font-medium text-gray-500" style="font-size:.75rem;margin-bottom:.5rem;">Items (' + o.items.length + ')</div>' +
            '<div class="flex flex-wrap gap-2">' + o.items.map(function (i) { return '<span style="font-size:.75rem;background:#fff;border:1px solid var(--gray-200);padding:.25rem .625rem;border-radius:.5rem;color:var(--gray-700);">' + i + '</span>'; }).join('') + '</div></div>' +
            '<div class="flex gap-2">' + action + '</div></div>';
        }).join('') : '<div class="card p-6 text-center text-gray-400">No orders yet.</div>';
        document.querySelectorAll('.advance-btn').forEach(function (btn) {
          btn.addEventListener('click', function () { postJson('pharmacy-admin/orders.php', { order_id: Number(btn.dataset.id) }).then(load); });
        });
      });
    }
    load();
  }
})();
