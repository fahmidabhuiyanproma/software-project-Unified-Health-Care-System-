import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface DashboardData {
  lab: { name: string; location: string | null };
  stats: { bookingsToday: number; bookingsTodayPending: number; resultsReadyToday: number; pendingUpload: number };
  recentBookings: { id: number; patient: string; test: string; time: string; status: string }[];
}

/** Ports pages/lab-admin/dashboard.html + js/lab-admin.js's initDashboard(). */
export function LabAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiRequest<DashboardData>('get', '/api/lab-admin/dashboard').then((res) => { if (res.ok) setData(res.data); });
  }, []);

  const subtitle = data ? (data.lab.location ? `${data.lab.name}, ${data.lab.location}` : data.lab.name) : '—';

  return (
    <>
      <div className="page-header"><div><h1>Lab Admin Dashboard</h1><p>{subtitle}</p></div></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#5B3F8D18', color: '#5B3F8D' }}><Icon name="flask-conical" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.bookingsToday ?? 0}</div><div className="stat-label">Bookings Today</div><div className="stat-sub">{data ? `${data.stats.bookingsTodayPending} pending` : '0 pending'}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#16A34A18', color: '#16A34A' }}><Icon name="check-circle" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.resultsReadyToday ?? 0}</div><div className="stat-label">Results Ready</div><div className="stat-sub">Today</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#D9770618', color: '#D97706' }}><Icon name="alert-circle" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.pendingUpload ?? 0}</div><div className="stat-label">Pending Upload</div><div className="stat-sub">Needs action</div></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 font-heading">Recent Bookings</h2>
              <Link to="/lab-admin/bookings" className="text-xs font-medium flex items-center gap-1" style={{ color: '#5B3F8D' }}>View All <Icon name="arrow-right" className="icon icon-12" /></Link>
            </div>
            <div className="divide-y divide-gray-50">
              {data && data.recentBookings.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No bookings yet.</div>}
              {data?.recentBookings.map((b) => (
                <div className="p-4 flex items-center gap-4" key={b.id}>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '.75rem', background: 'var(--blue-50)', color: 'var(--blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="flask-conical" className="icon icon-16" />
                  </div>
                  <div className="flex-1"><div className="font-semibold text-gray-800 text-sm">{b.patient}</div><div className="text-xs text-gray-500">{b.test} · {b.time}</div></div>
                  <Badge status={b.status} />
                  {b.status !== 'ready' && <Link to="/lab-admin/bookings" className="text-xs font-semibold" style={{ padding: '.375rem .75rem', borderRadius: '.5rem', background: '#5B3F8D', color: '#fff' }}>Upload</Link>}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card p-5 h-fit">
          <h3 className="font-semibold text-gray-800 mb-4 font-heading">Quick Actions</h3>
          <Link to="/lab-admin/catalog" className="flex items-center justify-between text-sm text-gray-700" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', marginBottom: '.25rem' }}>Manage Test Catalog <Icon name="arrow-right" className="icon icon-12 text-gray-400" /></Link>
          <Link to="/lab-admin/bookings" className="flex items-center justify-between text-sm text-gray-700" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', marginBottom: '.25rem' }}>View All Bookings <Icon name="arrow-right" className="icon icon-12 text-gray-400" /></Link>
          <Link to="/lab-admin/bookings" className="flex items-center justify-between text-sm text-gray-700" style={{ padding: '.625rem .75rem', borderRadius: '.75rem' }}>Upload Results <Icon name="arrow-right" className="icon icon-12 text-gray-400" /></Link>
        </div>
      </div>
    </>
  );
}
