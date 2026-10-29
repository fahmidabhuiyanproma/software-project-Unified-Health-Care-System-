import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface RecentAppt { patient: string; doctor: string; dept: string; time: string; status: string }
interface DeptOccupancy { dept: string; pct: number; booked: number; total: number }
interface DashboardData {
  hospital: { name: string; location: string | null };
  stats: { activeDoctors: number; departmentCount: number; appointmentsToday: number; confirmedToday: number; pendingToday: number };
  recentAppointments: RecentAppt[];
  departmentOccupancy: DeptOccupancy[];
}

function initials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Ports pages/hospital-admin/dashboard.html + js/hospital-admin.js's initDashboard(). */
export function HospitalAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiRequest<DashboardData>('get', '/api/hospital-admin/dashboard').then((res) => { if (res.ok) setData(res.data); });
  }, []);

  const subtitle = data ? (data.hospital.location ? `${data.hospital.name} — ${data.hospital.location}` : data.hospital.name) : '—';

  return (
    <>
      <div className="page-header"><div><h1>Hospital Admin Dashboard</h1><p>{subtitle}</p></div></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#5B3F8D18', color: '#5B3F8D' }}><Icon name="stethoscope" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.activeDoctors ?? '—'}</div><div className="stat-label">Active Doctors</div><div className="stat-sub">{data ? `${data.stats.departmentCount} department${data.stats.departmentCount === 1 ? '' : 's'}` : ''}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#16A34A18', color: '#16A34A' }}><Icon name="calendar" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.appointmentsToday ?? '—'}</div><div className="stat-label">Appointments Today</div><div className="stat-sub">{data ? `Confirmed: ${data.stats.confirmedToday}${data.stats.pendingToday > 0 ? ` · Pending: ${data.stats.pendingToday}` : ''}` : ''}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#B57BC418', color: '#B57BC4' }}><Icon name="building-2" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.departmentCount ?? '—'}</div><div className="stat-label">Departments</div><div className="stat-sub">{data ? (data.stats.departmentCount > 0 ? 'All operational' : 'None added yet') : ''}</div></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 font-heading">Today's Appointments</h2>
              <Link to="/hospital-admin/appointments" className="text-xs font-medium flex items-center gap-1" style={{ color: '#5B3F8D' }}>View All <Icon name="arrow-right" className="icon icon-12" /></Link>
            </div>
            <div className="divide-y divide-gray-50">
              {data && data.recentAppointments.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No appointments today.</div>}
              {data?.recentAppointments.map((a, i) => (
                <div className="p-4 flex items-center gap-4" key={i}>
                  <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '.75rem', background: 'var(--purple-100)', color: 'var(--purple-700)' }}>{initials(a.patient)}</div>
                  <div className="flex-1"><div className="font-semibold text-gray-800 text-sm">{a.patient}</div><div className="text-xs text-gray-500">{a.doctor} · {a.dept}</div></div>
                  <div className="text-xs text-gray-500 sm:block" style={{ display: 'none' }}>{a.time}</div>
                  <Badge status={a.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card p-5 h-fit">
          <h3 className="font-semibold text-gray-800 mb-4 font-heading">Quick Actions</h3>
          <Link to="/hospital-admin/doctors" className="flex items-center gap-3" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', marginBottom: '.25rem', fontSize: '.875rem' }}>
            <Icon name="stethoscope" className="icon icon-15" style={{ color: 'var(--purple-600)' }} /><span className="text-gray-700">Manage Doctors</span><Icon name="arrow-right" className="icon icon-12 text-gray-400" style={{ marginLeft: 'auto' }} />
          </Link>
          <Link to="/hospital-admin/approvals" className="flex items-center gap-3" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', marginBottom: '.25rem', fontSize: '.875rem' }}>
            <Icon name="user-check" className="icon icon-15" style={{ color: 'var(--purple-600)' }} /><span className="text-gray-700">Doctor Approvals</span><Icon name="arrow-right" className="icon icon-12 text-gray-400" style={{ marginLeft: 'auto' }} />
          </Link>
          <Link to="/hospital-admin/departments" className="flex items-center gap-3" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', marginBottom: '.25rem', fontSize: '.875rem' }}>
            <Icon name="building-2" className="icon icon-15" style={{ color: 'var(--purple-600)' }} /><span className="text-gray-700">Manage Departments</span><Icon name="arrow-right" className="icon icon-12 text-gray-400" style={{ marginLeft: 'auto' }} />
          </Link>
          <Link to="/hospital-admin/appointments" className="flex items-center gap-3" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', fontSize: '.875rem' }}>
            <Icon name="calendar" className="icon icon-15" style={{ color: 'var(--purple-600)' }} /><span className="text-gray-700">All Appointments</span><Icon name="arrow-right" className="icon icon-12 text-gray-400" style={{ marginLeft: 'auto' }} />
          </Link>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 mb-4 font-heading">Dept. Occupancy</h3>
        <div className="grid md:grid-cols-2" style={{ columnGap: '2rem' }}>
          {data && data.departmentOccupancy.length === 0 && <div className="text-gray-400 text-sm">No departments yet.</div>}
          {data?.departmentOccupancy.map((d, i) => (
            <div className="mb-3" key={i}>
              <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{d.dept}</span><span>{d.booked}/{d.total} beds · {d.pct}%</span></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${d.pct}%`, background: d.pct > 80 ? 'var(--red-600)' : '#5B3F8D' }} /></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
