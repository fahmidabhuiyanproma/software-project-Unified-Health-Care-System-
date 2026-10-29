import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { useAuth } from '../../context/AuthContext';

interface StatItem { value: number; sub: string }
interface UpcomingAppt { id: number; doctor: string; specialty: string; hospital: string; date: string; time: string; status: string; img: string }
interface ActivityItem { icon: string; title: string; body: string; time: string | null }
interface DashboardData {
  stats: { appointments: StatItem; records: StatItem; orders: StatItem; labTests: StatItem };
  upcomingCount: number;
  upcoming: UpcomingAppt[];
  activity: ActivityItem[];
}

function initials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const QUICK_ACTIONS = [
  { to: '/patient/search-doctors', icon: 'search', label: 'Find Doctor', color: '#5B3F8D' },
  { to: '/patient/appointments', icon: 'calendar', label: 'Appointments', color: '#8E5DAF' },
  { to: '/patient/medical-records', icon: 'file-text', label: 'Records', color: '#B57BC4' },
  { to: '/patient/telemedicine', icon: 'video', label: 'Telemedicine', color: '#5B3F8D' },
  { to: '/patient/pharmacy', icon: 'shopping-bag', label: 'Pharmacy', color: '#8E5DAF' },
  { to: '/patient/lab-tests', icon: 'flask-conical', label: 'Lab Tests', color: '#B57BC4' },
];

/** Ports pages/patient/dashboard.html + js/patient.js's initGreeting()/initDashboardOverview(). */
export function PatientDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiRequest<DashboardData>('get', '/api/patient/dashboard').then((res) => {
      if (res.ok) setData(res.data);
    });
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const next = data?.upcoming[0];
  const activityStyle = (title: string) => {
    if (/cancel|declin/i.test(title)) return { bg: '#FEE2E218', color: '#DC2626' };
    if (/deliver/i.test(title)) return { bg: '#DCFCE718', color: '#16A34A' };
    return { bg: '#5B3F8D18', color: '#5B3F8D' };
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 font-heading">{greeting}, {firstName} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Here's your health overview for today.</p>
      </div>

      <div className="rounded-2xl p-4 mb-6 flex items-center gap-4" style={{ backgroundImage: 'linear-gradient(135deg,#5B3F8D,#8E5DAF)' }}>
        <div style={{ width: '2.5rem', height: '2.5rem', background: 'rgba(255,255,255,.2)', borderRadius: '.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="activity" className="icon icon-20 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-white font-semibold text-sm font-heading">
            You have {data?.upcomingCount ?? 0} upcoming appointment{(data?.upcomingCount ?? 0) === 1 ? '' : 's'}
          </div>
          <div className="text-purple-200 text-xs">
            {next ? `Next: ${next.doctor} on ${new Date(`${next.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })} at ${next.time}` : ''}
          </div>
        </div>
        <Link to="/patient/appointments" className="text-white text-xs font-semibold rounded-xl flex items-center gap-1" style={{ background: 'rgba(255,255,255,.2)', padding: '.5rem .75rem' }}>
          View <Icon name="arrow-right" className="icon icon-12" />
        </Link>
      </div>

      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-3 font-heading">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.to} to={a.to} className="card p-4 flex flex-col items-center gap-2" style={{ textAlign: 'center' }}>
              <div className="stat-icon" style={{ background: `${a.color}18`, color: a.color }}><Icon name={a.icon} className="icon icon-20" /></div>
              <span className="text-xs font-medium text-gray-600">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { key: 'appointments', icon: 'calendar', color: '#5B3F8D', label: 'Total Appointments' },
          { key: 'records', icon: 'file-text', color: '#8E5DAF', label: 'Health Records' },
          { key: 'orders', icon: 'shopping-bag', color: '#B57BC4', label: 'Medicine Orders' },
          { key: 'labTests', icon: 'flask-conical', color: '#5B3F8D', label: 'Lab Tests' },
        ].map((s) => {
          const stat = data?.stats[s.key as keyof DashboardData['stats']];
          return (
            <div className="stat-card" key={s.key}>
              <div className="stat-icon" style={{ background: `${s.color}18`, color: s.color }}><Icon name={s.icon} className="icon icon-20" /></div>
              <div>
                <div className="stat-value">{stat?.value ?? '—'}</div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-sub">{stat?.sub ?? ''}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 font-heading">Upcoming Appointments</h2>
            <Link to="/patient/appointments" className="text-xs font-medium" style={{ color: '#5B3F8D' }}>View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data && data.upcoming.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No upcoming appointments.</div>}
            {data?.upcoming.map((a) => {
              const when = new Date(`${a.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <div className="p-4 flex items-start gap-3" key={a.id}>
                  <div className="avatar" style={{ width: '2.5rem', height: '2.5rem', background: 'var(--purple-100)', color: 'var(--purple-700)', fontSize: '.875rem' }}>{initials(a.doctor)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 text-sm">{a.doctor}</div>
                    <div className="text-xs text-gray-500">{a.specialty} · {a.hospital}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <Icon name="clock" className="icon icon-11 text-gray-400" />
                      <span className="text-xs text-gray-500">{when} · {a.time}</span>
                      <Badge status={a.status} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="p-5 border-b"><h2 className="font-semibold text-gray-800 font-heading">Recent Activity</h2></div>
          <div className="divide-y divide-gray-50">
            {data && data.activity.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No recent activity yet.</div>}
            {data?.activity.map((n, i) => {
              const style = activityStyle(n.title);
              const when = n.time ? new Date(n.time).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '';
              return (
                <div className="p-4 flex items-center gap-3" key={i}>
                  <div className="stat-icon" style={{ width: '2.25rem', height: '2.25rem', background: style.bg, color: style.color }}>
                    <Icon name={n.icon} className="icon icon-16" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{n.title}</div>
                    <div className="text-xs text-gray-400">{n.body} — {when}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
