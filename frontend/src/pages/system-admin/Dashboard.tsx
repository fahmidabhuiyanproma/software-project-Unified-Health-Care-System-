import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface PendingProvider { id: number; name: string; type: string; submitted: string }
interface ActivityItem { label: string; value: number }
interface BreakdownItem { label: string; value: number; total: number }
interface DashboardData {
  pendingProviders: PendingProvider[];
  pendingCount: number;
  stats: { totalUsers: number; hospitals: number; labs: number };
  activity: ActivityItem[];
  providerBreakdown: BreakdownItem[];
}

/** Ports pages/system-admin/dashboard.html + js/system-admin.js's initDashboard(). */
export function SystemAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiRequest<DashboardData>('get', '/api/system-admin/dashboard').then((res) => {
      if (res.ok) setData(res.data);
    });
  }, []);

  const subtitle = `SynCura Platform Overview · ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

  return (
    <>
      <div className="page-header"><div><h1>System Admin Dashboard</h1><p>{subtitle}</p></div></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#5B3F8D18', color: '#5B3F8D' }}><Icon name="users" className="icon icon-20" /></div>
          <div><div className="stat-value">{data ? data.stats.totalUsers.toLocaleString() : 0}</div><div className="stat-label">Total Users</div><div className="stat-sub">All roles</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#8E5DAF18', color: '#8E5DAF' }}><Icon name="building-2" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.hospitals ?? 0}</div><div className="stat-label">Hospitals</div><div className="stat-sub">Approved</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#0369A118', color: '#0369A1' }}><Icon name="flask-conical" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.labs ?? 0}</div><div className="stat-label">Diagnostic Labs</div><div className="stat-sub">Approved</div></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 font-heading">Pending Approvals</h2>
              <Link to="/system-admin/approvals" className="text-xs font-medium flex items-center gap-1" style={{ color: '#5B3F8D' }}>
                View All <Icon name="arrow-right" className="icon icon-12" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {data && data.pendingProviders.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-sm">No pending approvals.</div>
              )}
              {data?.pendingProviders.map((p) => (
                <div className="p-4 flex items-center gap-4" key={p.id}>
                  <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '.75rem', background: 'var(--amber-50)', color: 'var(--amber-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="user-check" className="icon icon-16" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 text-sm">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.type} · Submitted {p.submitted}</div>
                  </div>
                  <Badge status="pending" />
                  <Link to="/system-admin/approvals" className="text-xs font-semibold" style={{ padding: '.375rem .75rem', borderRadius: '.5rem', background: '#5B3F8D', color: '#fff' }}>Review</Link>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4 font-heading">Platform Activity</h3>
            <div className="grid grid-cols-2 gap-4">
              {data?.activity.map((s) => (
                <div style={{ background: 'var(--gray-50)', borderRadius: '.75rem', padding: '1rem' }} key={s.label}>
                  <div className="text-xl font-bold text-gray-800 font-heading">{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4 font-heading">Admin Actions</h3>
            <Link to="/system-admin/approvals" className="flex items-center gap-3" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', marginBottom: '.25rem', fontSize: '.875rem' }}>
              <Icon name="user-check" className="icon icon-15" style={{ color: 'var(--purple-600)' }} />
              <span className="text-gray-700 flex-1">Provider Approvals</span>
              {!!data && data.pendingCount > 0 && (
                <span style={{ background: 'var(--red-100)', color: 'var(--red-600)', fontSize: '.75rem', padding: '.125rem .5rem', borderRadius: '9999px', fontWeight: 700 }}>{data.pendingCount}</span>
              )}
              <Icon name="arrow-right" className="icon icon-12 text-gray-400" />
            </Link>
            <Link to="/system-admin/users" className="flex items-center gap-3" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', marginBottom: '.25rem', fontSize: '.875rem' }}>
              <Icon name="users" className="icon icon-15" style={{ color: 'var(--purple-600)' }} />
              <span className="text-gray-700 flex-1">Manage Users &amp; Roles</span>
              <Icon name="arrow-right" className="icon icon-12 text-gray-400" />
            </Link>
            <Link to="/system-admin/settings" className="flex items-center gap-3" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', fontSize: '.875rem' }}>
              <Icon name="shield" className="icon icon-15" style={{ color: 'var(--purple-600)' }} />
              <span className="text-gray-700 flex-1">Platform Settings</span>
              <Icon name="arrow-right" className="icon icon-12 text-gray-400" />
            </Link>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-3 font-heading">Provider Breakdown</h3>
            {data?.providerBreakdown.map((b) => (
              <div className="mb-3" key={b.label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{b.label}</span><span>{b.value}</span></div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${(b.value / b.total) * 100}%`, background: '#5B3F8D' }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
