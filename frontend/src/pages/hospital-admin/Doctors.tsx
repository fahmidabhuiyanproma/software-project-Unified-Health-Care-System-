import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface HospitalDoctor { id: number; name: string; specialty: string; dept: string; patients: number; status: string; joined: string }

function initials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Ports pages/hospital-admin/doctors.html + js/hospital-admin.js's initDoctors() — read-only roster (FR-2.1). */
export function HospitalAdminDoctors() {
  const [doctors, setDoctors] = useState<HospitalDoctor[]>([]);
  const [q, setQ] = useState('');

  const load = async (query: string) => {
    const res = await apiRequest<{ doctors: HospitalDoctor[] }>('get', `/api/hospital-admin/doctors${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    setDoctors(res.ok ? res.data.doctors : []);
  };

  useEffect(() => { load(''); }, []);

  return (
    <>
      <div className="page-header">
        <div><h1>Manage Doctors</h1><p>{doctors.length} doctors registered</p></div>
        <Link to="/hospital-admin/approvals" className="btn btn-brand btn-md"><Icon name="user-check" className="icon icon-16" /> Doctor Approvals</Link>
      </div>

      <div className="relative mb-6">
        <Icon name="search" className="icon icon-16 text-gray-400" style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)' }} />
        <input className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="Search doctors..." value={q} onChange={(e) => { setQ(e.target.value); load(e.target.value); }} />
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Doctor</th><th className="md:table-cell">Department</th><th className="lg:table-cell">Patients</th><th className="lg:table-cell">Joined</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {doctors.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No doctors yet.</td></tr>}
            {doctors.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '.75rem', background: 'var(--purple-100)', color: 'var(--purple-700)' }}>{initials(d.name)}</div>
                    <div><div className="font-semibold text-gray-800">{d.name}</div><div className="text-xs text-gray-400">{d.specialty}</div></div>
                  </div>
                </td>
                <td className="md:table-cell text-gray-600" style={{ fontSize: '.75rem' }}>{d.dept}</td>
                <td className="lg:table-cell text-gray-500" style={{ fontSize: '.75rem' }}>{d.patients}</td>
                <td className="lg:table-cell text-gray-500" style={{ fontSize: '.75rem' }}>{d.joined}</td>
                <td><Badge status={d.status} /></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
