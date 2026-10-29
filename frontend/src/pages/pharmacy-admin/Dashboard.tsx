import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface DashboardData {
  pharmacy: { name: string; location: string | null };
  stats: { ordersToday: number; pendingToday: number; revenueToday: number; revenueYesterday: number; totalProducts: number; lowStockCount: number };
  recentOrders: { id: string; patient: string; items: number; total: string; time: string; status: string }[];
  lowStock: string[];
}

/** Ports pages/pharmacy-admin/dashboard.html + js/pharmacy-admin.js's initDashboard(). */
export function PharmacyAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiRequest<DashboardData>('get', '/api/pharmacy-admin/dashboard').then((res) => { if (res.ok) setData(res.data); });
  }, []);

  const subtitle = data ? (data.pharmacy.location ? `${data.pharmacy.name} — ${data.pharmacy.location}` : data.pharmacy.name) : '—';

  let revenueSub = '';
  if (data) {
    const { revenueToday, revenueYesterday } = data.stats;
    if (revenueYesterday > 0) {
      const pct = Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100);
      revenueSub = `${pct >= 0 ? '+' : ''}${pct}% vs yesterday`;
    } else {
      revenueSub = revenueToday > 0 ? 'vs ৳0 yesterday' : 'No revenue yesterday';
    }
  }

  return (
    <>
      <div className="page-header"><div><h1>Pharmacy Admin Dashboard</h1><p>{subtitle}</p></div></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#5B3F8D18', color: '#5B3F8D' }}><Icon name="shopping-bag" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.ordersToday ?? '—'}</div><div className="stat-label">Orders Today</div><div className="stat-sub">{data ? `${data.stats.pendingToday} pending` : ''}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#16A34A18', color: '#16A34A' }}><Icon name="trending-up" className="icon icon-20" /></div>
          <div><div className="stat-value">{data ? `৳ ${Number(data.stats.revenueToday).toLocaleString()}` : '—'}</div><div className="stat-label">Revenue Today</div><div className="stat-sub">{revenueSub}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#8E5DAF18', color: '#8E5DAF' }}><Icon name="package" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.totalProducts ?? '—'}</div><div className="stat-label">Total Products</div><div className="stat-sub">In catalog</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#D9770618', color: '#D97706' }}><Icon name="alert-triangle" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.lowStockCount ?? '—'}</div><div className="stat-label">Low Stock Alerts</div><div className="stat-sub">{data ? (data.stats.lowStockCount > 0 ? 'Needs restock' : 'All stocked') : ''}</div></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 font-heading">Recent Orders</h2>
              <Link to="/pharmacy-admin/orders" className="text-xs font-medium flex items-center gap-1" style={{ color: '#5B3F8D' }}>View All <Icon name="arrow-right" className="icon icon-12" /></Link>
            </div>
            <div className="divide-y divide-gray-50">
              {data && data.recentOrders.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No orders yet.</div>}
              {data?.recentOrders.map((o) => (
                <div className="p-4 flex items-center gap-4" key={o.id}>
                  <div className="text-xs font-mono text-gray-400" style={{ width: '5rem', flexShrink: 0 }}>{o.id}</div>
                  <div className="flex-1"><div className="font-semibold text-gray-800 text-sm">{o.patient}</div><div className="text-xs text-gray-400">{o.items} items</div></div>
                  <div className="font-bold sm:block" style={{ fontSize: '.875rem', color: '#5B3F8D', display: 'none' }}>{o.total}</div>
                  <Badge status={o.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card p-5 h-fit">
          <h3 className="font-semibold text-gray-800 mb-4 font-heading">⚠ Low Stock</h3>
          {data && data.lowStock.length === 0 && <div className="text-gray-400 text-sm">No low-stock items.</div>}
          {data?.lowStock.map((m, i) => (
            <div className="flex items-center gap-2" style={{ padding: '.5rem 0', borderBottom: '1px solid var(--gray-50)', fontSize: '.875rem' }} key={i}>
              <span className="w-2 h-2 rounded-full bg-amber-400" style={{ flexShrink: 0 }} />
              <span className="text-gray-700 flex-1">{m}</span>
              <span className="font-medium" style={{ fontSize: '.75rem', color: 'var(--amber-600)' }}>Restock</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
