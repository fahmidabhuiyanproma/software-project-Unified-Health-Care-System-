import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface DoctorApplication { id: number; name: string; contact: string; email: string | null; regNo: string | null; dept: string; submitted: string; status: string }

/** Ports pages/hospital-admin/approvals.html + js/hospital-admin.js's initDoctorApprovals(). */
export function HospitalAdminApprovals() {
  const [applications, setApplications] = useState<DoctorApplication[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await apiRequest<{ applications: DoctorApplication[] }>('get', '/api/hospital-admin/approvals');
    setApplications(res.ok ? res.data.applications : []);
  };

  useEffect(() => { load(); }, []);

  const decide = async (id: number, decision: 'approve' | 'reject') => {
    setBusyId(id);
    setError(null);
    const res = await apiRequest('post', `/api/hospital-admin/approvals/${id}/${decision}`);
    setBusyId(null);
    if (!res.ok) {
      setError(res.data.message ?? 'Could not process this decision.');
      return;
    }
    load();
  };

  const pendingCount = applications.filter((a) => a.status === 'pending').length;

  return (
    <>
      <div className="page-header"><div><h1>Doctor Approvals</h1><p>{pendingCount} pending reviews</p></div></div>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl mb-4" style={{ padding: '.75rem 1rem' }}>{error}</div>}

      <div className="table-wrap">
        <table className="data-table min-w-700">
          <thead><tr><th>Doctor</th><th>Department</th><th>Email</th><th>Reg. No.</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {applications.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">No doctor applications yet.</td></tr>}
            {applications.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold text-gray-800">{a.name}</td>
                <td><span style={{ background: 'var(--purple-50)', color: 'var(--purple-700)', fontSize: '.75rem', padding: '.25rem .5rem', borderRadius: '.5rem' }}>{a.dept}</span></td>
                <td className="text-gray-500" style={{ fontSize: '.75rem' }}>{a.email || '—'}</td>
                <td className="text-xs font-mono text-gray-400">{a.regNo || '—'}</td>
                <td className="text-gray-500" style={{ fontSize: '.75rem' }}>{a.submitted}</td>
                <td><Badge status={a.status} /></td>
                <td>
                  {a.status === 'pending' && (
                    <div className="flex" style={{ gap: '.375rem' }}>
                      <button disabled={busyId === a.id} onClick={() => decide(a.id, 'approve')} style={{ display: 'flex', alignItems: 'center', gap: '.25rem', fontSize: '.75rem', fontWeight: 600, padding: '.375rem .625rem', borderRadius: '.5rem', background: 'var(--green-50)', color: '#15803d' }}>
                        <Icon name="check-circle" className="icon icon-12" /> Approve
                      </button>
                      <button disabled={busyId === a.id} onClick={() => decide(a.id, 'reject')} style={{ display: 'flex', alignItems: 'center', gap: '.25rem', fontSize: '.75rem', fontWeight: 600, padding: '.375rem .625rem', borderRadius: '.5rem', background: 'var(--red-50)', color: 'var(--red-600)' }}>
                        <Icon name="x-circle" className="icon icon-12" /> Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
