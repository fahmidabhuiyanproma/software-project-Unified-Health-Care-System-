import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface PendingAppt { id: number; date: string; time: string; type: string }
interface DoctorPatient { id: number; name: string; lastVisit: string | null; nextAppt: string | null; status: string | null; pending: PendingAppt[] }

function initials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Ports pages/doctor/patients.html + js/doctor.js's initPatients() (FR-4.4 basis). */
export function DoctorPatients() {
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async (query: string) => {
    const res = await apiRequest<{ patients: DoctorPatient[] }>('get', `/api/doctor/patients${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    setPatients(res.ok ? res.data.patients : []);
  };

  useEffect(() => { load(q); }, []);

  const onSearch = (value: string) => {
    setQ(value);
    load(value);
  };

  const decide = async (appointmentId: number, action: 'confirm' | 'reject') => {
    setBusyId(appointmentId);
    const res = await apiRequest(`post`, `/api/doctor/appointments/${appointmentId}/${action}`);
    setBusyId(null);
    if (!res.ok) alert(res.data.message ?? 'Could not process this appointment.');
    load(q);
  };

  return (
    <>
      <div className="page-header"><div><h1>My Patients</h1><p>Patients currently under your care</p></div></div>

      <div className="relative mb-6">
        <Icon name="search" className="icon icon-16 text-gray-400" style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)' }} />
        <input className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="Search patients..." value={q} onChange={(e) => onSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Patient</th><th className="md:table-cell">Condition</th><th className="lg:table-cell">Last Visit</th><th className="lg:table-cell">Next Appt.</th><th>Date &amp; Time</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {patients.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">No patients yet.</td></tr>}
            {patients.flatMap((p) => {
              const patientCell = (
                <td key="patient">
                  <div className="flex items-center gap-3">
                    <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '.75rem', background: 'var(--purple-100)', color: 'var(--purple-700)' }}>{initials(p.name)}</div>
                    <div><div className="font-semibold text-gray-800">{p.name}</div></div>
                  </div>
                </td>
              );
              const commonCells = [
                <td key="condition" className="md:table-cell text-gray-600" style={{ fontSize: '.75rem' }}>—</td>,
                <td key="last" className="lg:table-cell text-gray-500" style={{ fontSize: '.75rem' }}>{p.lastVisit || '—'}</td>,
                <td key="next" className="lg:table-cell text-gray-500" style={{ fontSize: '.75rem' }}>{p.nextAppt || '—'}</td>,
              ];

              if (!p.pending || p.pending.length === 0) {
                return (
                  <tr key={p.id}>
                    {patientCell}
                    {commonCells}
                    <td><span className="text-gray-400 text-sm">—</span></td>
                    <td><Badge status={p.status || 'completed'} /></td>
                    <td><Link to={`/doctor/patient-record?patient_id=${p.id}`} className="btn btn-secondary btn-sm"><Icon name="file-text" className="icon icon-12" /> View Record</Link></td>
                  </tr>
                );
              }

              return p.pending.map((a) => {
                const when = new Date(`${a.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <tr key={`${p.id}-${a.id}`}>
                    {patientCell}
                    {commonCells}
                    <td>
                      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                        <span className="text-sm text-gray-700" style={{ whiteSpace: 'nowrap' }}>{when} · {a.time}</span>
                        {a.type === 'telemedicine' && <span className="text-xs" style={{ padding: '.125rem .5rem', borderRadius: '.5rem', background: 'var(--blue-50)', color: 'var(--blue-700)' }}>📱 Video</span>}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button className="btn btn-sm" disabled={busyId === a.id} onClick={() => decide(a.id, 'confirm')} style={{ background: 'var(--green-50)', color: '#15803d' }}>Approve</button>
                        <button className="btn btn-sm" disabled={busyId === a.id} onClick={() => decide(a.id, 'reject')} style={{ background: 'var(--red-50)', color: 'var(--red-600)' }}>Reject</button>
                      </div>
                    </td>
                    <td><Link to={`/doctor/patient-record?patient_id=${p.id}`} className="btn btn-secondary btn-sm"><Icon name="file-text" className="icon icon-12" /> View Record</Link></td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
