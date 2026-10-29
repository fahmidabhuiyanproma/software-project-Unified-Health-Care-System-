import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { useAuth } from '../../context/AuthContext';

interface ScheduleItem { time: string; patient: string; type: string; reason: string; status: string }
interface PendingRequest { name: string; date: string; time: string }
interface DashboardData {
  schedule: ScheduleItem[];
  todayCount: number;
  pendingRequests: PendingRequest[];
  stats: {
    pendingRequests: number; patientsToday: number; telemedicineToday: number;
    thisWeek: number; thisWeekPending: number; videoCallsToday: number; nextVideoCall: string | null;
  };
}

function initials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Ports pages/doctor/dashboard.html + js/doctor.js's initDashboard(). */
export function DoctorDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiRequest<DashboardData>('get', '/api/doctor/dashboard').then((res) => { if (res.ok) setData(res.data); });
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 font-heading">{greeting}, {user?.name ?? 'Doctor'} 👨‍⚕️</h1>
        <p className="text-gray-500 text-sm mt-1">{data ? `You have ${data.todayCount} appointment${data.todayCount === 1 ? '' : 's'} today · ${today}` : '—'}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#5B3F8D18', color: '#5B3F8D' }}><Icon name="users" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.patientsToday ?? '—'}</div><div className="stat-label">Patients Today</div><div className="stat-sub">{data ? `${data.stats.telemedicineToday} telemedicine` : ''}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#8E5DAF18', color: '#8E5DAF' }}><Icon name="calendar" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.thisWeek ?? '—'}</div><div className="stat-label">This Week</div><div className="stat-sub">{data ? `${data.stats.thisWeekPending} pending` : ''}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#D9770618', color: '#D97706' }}><Icon name="file-text" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.pendingRequests ?? '—'}</div><div className="stat-label">Pending Requests</div><div className="stat-sub">{data ? (data.stats.pendingRequests > 0 ? 'Awaiting your approval' : 'None waiting') : ''}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#0369A118', color: '#0369A1' }}><Icon name="video" className="icon icon-20" /></div>
          <div><div className="stat-value">{data?.stats.videoCallsToday ?? '—'}</div><div className="stat-label">Video Calls Today</div>
            <div className="stat-sub">{data ? (data.stats.videoCallsToday === 0 ? 'None today' : (data.stats.nextVideoCall ? `Next at ${data.stats.nextVideoCall}` : 'All done for today')) : ''}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 font-heading">Today's Schedule</h2>
              <Link to="/doctor/schedule" className="text-xs font-medium flex items-center gap-1" style={{ color: '#5B3F8D' }}>Full Schedule <Icon name="arrow-right" className="icon icon-12" /></Link>
            </div>
            <div className="divide-y divide-gray-50">
              {data && data.schedule.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No appointments scheduled for today.</div>}
              {data?.schedule.map((a, i) => (
                <div className="p-4 flex items-center gap-4" key={i}>
                  <div className="text-xs font-mono font-semibold text-gray-500" style={{ width: '4rem', flexShrink: 0 }}>{a.time}</div>
                  <div className="avatar" style={{ width: '2.25rem', height: '2.25rem', fontSize: '.75rem', background: 'var(--purple-100)', color: 'var(--purple-700)' }}>{initials(a.patient)}</div>
                  <div className="flex-1 min-w-0"><div className="font-semibold text-gray-800 text-sm">{a.patient}</div><div className="text-xs text-gray-500">{a.reason}</div></div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ padding: '.25rem .5rem', borderRadius: '.5rem', background: a.type === 'telemedicine' ? 'var(--blue-50)' : 'var(--gray-100)', color: a.type === 'telemedicine' ? 'var(--blue-700)' : 'var(--gray-600)' }}>
                      {a.type === 'telemedicine' ? '📱 Video' : '🏥 In-Person'}
                    </span>
                    <Badge status={a.status} />
                  </div>
                  <Link to="/doctor/patients" className="btn btn-secondary btn-sm">View</Link>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4 font-heading">Quick Actions</h3>
            <Link to="/doctor/patients" className="flex items-center gap-3" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', marginBottom: '.25rem', fontSize: '.875rem' }}>
              <Icon name="file-text" className="icon icon-16" style={{ color: 'var(--purple-600)' }} /><span className="text-gray-700">Add Diagnosis / Note</span><Icon name="arrow-right" className="icon icon-12 text-gray-400" style={{ marginLeft: 'auto' }} />
            </Link>
            <Link to="/doctor/schedule" className="flex items-center gap-3" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', marginBottom: '.25rem', fontSize: '.875rem' }}>
              <Icon name="calendar" className="icon icon-16" style={{ color: 'var(--purple-600)' }} /><span className="text-gray-700">View My Schedule</span><Icon name="arrow-right" className="icon icon-12 text-gray-400" style={{ marginLeft: 'auto' }} />
            </Link>
            <Link to="/doctor/patients" className="flex items-center gap-3" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', marginBottom: '.25rem', fontSize: '.875rem' }}>
              <Icon name="users" className="icon icon-16" style={{ color: 'var(--purple-600)' }} /><span className="text-gray-700">Patient List</span><Icon name="arrow-right" className="icon icon-12 text-gray-400" style={{ marginLeft: 'auto' }} />
            </Link>
            <Link to="/patient/telemedicine" className="flex items-center gap-3" style={{ padding: '.625rem .75rem', borderRadius: '.75rem', fontSize: '.875rem' }}>
              <Icon name="video" className="icon icon-16" style={{ color: 'var(--purple-600)' }} /><span className="text-gray-700">Telemedicine</span><Icon name="arrow-right" className="icon icon-12 text-gray-400" style={{ marginLeft: 'auto' }} />
            </Link>
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 font-heading">Pending Requests</h3>
              <Link to="/doctor/patients" className="text-xs font-medium" style={{ color: '#5B3F8D' }}>Review</Link>
            </div>
            <div className="space-y-3">
              {data && data.pendingRequests.length === 0 && <div className="text-gray-400 text-sm">No pending requests.</div>}
              {data?.pendingRequests.map((r, i) => {
                const when = new Date(`${r.date}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                return (
                  <Link to="/doctor/patients" className="flex items-center gap-3 text-sm" key={i}>
                    <span className="w-2 h-2 rounded-full bg-amber-400" style={{ flexShrink: 0 }} />
                    <span className="text-gray-600" style={{ fontSize: '.75rem' }}>{r.name} — {when} · {r.time}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
