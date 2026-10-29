import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface OverviewAppt { id: number; patient: string; doctor: string; dept: string; date: string; time: string; type: string; status: string }

/** Ports pages/hospital-admin/appointments.html + js/hospital-admin.js's initAppointments() — read-only overview. */
export function HospitalAdminAppointments() {
  const [appointments, setAppointments] = useState<OverviewAppt[]>([]);
  const [q, setQ] = useState('');

  const load = async (query: string) => {
    const res = await apiRequest<{ appointments: OverviewAppt[] }>('get', `/api/hospital-admin/appointments${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    setAppointments(res.ok ? res.data.appointments : []);
  };

  useEffect(() => { load(''); }, []);

  return (
    <>
      <div className="page-header"><div><h1>Appointment Overview</h1><p>{appointments.length} total appointments across all departments</p></div></div>

      <div className="relative mb-6">
        <Icon name="search" className="icon icon-16 text-gray-400" style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)' }} />
        <input className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="Search by patient or doctor..." value={q} onChange={(e) => { setQ(e.target.value); load(e.target.value); }} />
      </div>

      <div className="table-wrap">
        <table className="data-table min-w-640">
          <thead><tr><th>ID</th><th>Patient</th><th>Doctor</th><th>Department</th><th>Date &amp; Time</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            {appointments.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">No appointments yet.</td></tr>}
            {appointments.map((a) => (
              <tr key={a.id}>
                <td className="text-xs font-mono text-gray-400">A{String(a.id).padStart(3, '0')}</td>
                <td className="font-semibold text-gray-800">{a.patient}</td>
                <td className="text-gray-600" style={{ fontSize: '.75rem' }}>{a.doctor}</td>
                <td style={{ fontSize: '.75rem' }}><span style={{ background: 'var(--purple-50)', color: 'var(--purple-700)', padding: '.25rem .5rem', borderRadius: '.5rem' }}>{a.dept}</span></td>
                <td className="text-gray-500" style={{ fontSize: '.75rem' }}>{a.date} · {a.time}</td>
                <td className="text-gray-500" style={{ fontSize: '.75rem' }}>{a.type}</td>
                <td><Badge status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
