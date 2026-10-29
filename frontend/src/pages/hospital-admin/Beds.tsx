import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface DeptSummary { id: number; name: string; total: number; pending: number; approved: number; booked: number; available: number; open: boolean }
interface BedRequest {
  id: number; patient: string; patientPhone: string | null; department: string; date: string; reason: string;
  notes: string | null; attendantPhone: string | null; status: string; rejectionReason: string | null; requestedAt: string | null;
}
interface BedsData { departments: DeptSummary[]; requests: BedRequest[] }

/** Ports pages/hospital-admin/beds.html + js/hospital-admin.js's initBeds(). */
export function HospitalAdminBeds() {
  const [data, setData] = useState<BedsData | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    const res = await apiRequest<BedsData>('get', '/api/hospital-admin/beds');
    if (res.ok) setData(res.data);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const decide = async (id: number, decision: 'approve' | 'reject' | 'discharge', reason?: string) => {
    setBusyId(id);
    const res = await apiRequest('post', `/api/hospital-admin/beds/${id}/${decision}`, reason !== undefined ? { reason } : undefined);
    setBusyId(null);
    if (!res.ok) window.alert(res.data.message ?? 'Could not process this request.');
    load();
  };

  const onReject = (id: number) => {
    const reason = window.prompt('Reason for declining (optional — the patient will see it):');
    if (reason === null) return;
    decide(id, 'reject', reason);
  };

  const onDischarge = (id: number) => {
    if (window.confirm('Mark this patient as discharged? The bed becomes available again.')) decide(id, 'discharge');
  };

  const pendingCount = data?.requests.filter((r) => r.status === 'pending').length ?? 0;

  return (
    <>
      <div className="page-header"><div><h1>Bed Requests</h1><p>{pendingCount} pending request{pendingCount === 1 ? '' : 's'}</p></div></div>

      <div className="card p-5 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4 font-heading">Beds by department</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data && data.departments.length === 0 && <div className="text-sm text-gray-400">No departments yet. Add one under Departments.</div>}
          {data?.departments.map((d) => {
            const pct = d.total > 0 ? Math.round((d.booked / d.total) * 100) : 0;
            return (
              <div style={{ background: 'var(--gray-50)', borderRadius: '.75rem', padding: '.875rem 1rem' }} key={d.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-800 text-sm">{d.name}</span>
                  {d.total === 0 ? (
                    <span className="text-xs" style={{ color: 'var(--gray-400)' }}>No beds set up</span>
                  ) : d.open ? (
                    <span className="text-xs font-semibold" style={{ color: d.available <= 3 ? 'var(--amber-700)' : '#15803d' }}>{d.available} free</span>
                  ) : (
                    <span className="text-xs font-semibold" style={{ color: 'var(--red-600)' }}>Full · closed</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">{d.approved} admitted · {d.pending} pending · {d.total} total</div>
                <div className="progress-track" style={{ marginTop: '.5rem' }}><div className="progress-fill" style={{ width: `${pct}%`, background: d.open ? '#5B3F8D' : 'var(--red-600)' }} /></div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">Pending and approved requests each hold a bed. When a department has no free beds it stops accepting new requests.</p>
      </div>

      <div className="table-wrap">
        <table className="data-table min-w-700">
          <thead><tr><th>Patient</th><th>Department</th><th>Admission</th><th>Details</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {data && data.requests.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">No bed requests yet.</td></tr>}
            {data?.requests.map((r) => {
              const admit = new Date(`${r.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
              const asked = r.requestedAt ? new Date(r.requestedAt).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
              return (
                <tr key={r.id}>
                  <td><div className="font-semibold text-gray-800">{r.patient}</div><div className="text-xs text-gray-400">{r.patientPhone || ''}</div></td>
                  <td><span style={{ background: 'var(--purple-50)', color: 'var(--purple-700)', fontSize: '.75rem', padding: '.25rem .5rem', borderRadius: '.5rem' }}>{r.department}</span></td>
                  <td className="text-gray-600" style={{ fontSize: '.75rem', whiteSpace: 'nowrap' }}>{admit}</td>
                  <td style={{ fontSize: '.75rem', maxWidth: '18rem' }}>
                    <div className="text-gray-800 font-medium">{r.reason}</div>
                    {r.notes && <div className="text-gray-500" style={{ marginTop: '.125rem' }}>{r.notes}</div>}
                    {r.attendantPhone && <div className="text-gray-400" style={{ marginTop: '.125rem' }}>Attendant: {r.attendantPhone}</div>}
                    {r.status === 'rejected' && r.rejectionReason && <div style={{ marginTop: '.125rem', color: 'var(--red-600)' }}>Declined: {r.rejectionReason}</div>}
                  </td>
                  <td className="text-gray-500" style={{ fontSize: '.75rem', whiteSpace: 'nowrap' }}>{asked}</td>
                  <td><Badge status={r.status} /></td>
                  <td>
                    {r.status === 'pending' ? (
                      <div className="flex" style={{ gap: '.375rem' }}>
                        <button disabled={busyId === r.id} onClick={() => decide(r.id, 'approve')} style={{ display: 'flex', alignItems: 'center', gap: '.25rem', fontSize: '.75rem', fontWeight: 600, padding: '.375rem .625rem', borderRadius: '.5rem', background: 'var(--green-50)', color: '#15803d' }}>
                          <Icon name="check-circle" className="icon icon-12" /> Approve
                        </button>
                        <button disabled={busyId === r.id} onClick={() => onReject(r.id)} style={{ display: 'flex', alignItems: 'center', gap: '.25rem', fontSize: '.75rem', fontWeight: 600, padding: '.375rem .625rem', borderRadius: '.5rem', background: 'var(--red-50)', color: 'var(--red-600)' }}>
                          <Icon name="x-circle" className="icon icon-12" /> Reject
                        </button>
                      </div>
                    ) : r.status === 'approved' ? (
                      <button className="btn btn-secondary btn-sm" disabled={busyId === r.id} onClick={() => onDischarge(r.id)}>Discharge</button>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
