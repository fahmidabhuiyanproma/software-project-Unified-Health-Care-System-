import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';

interface Provider {
  id: number; name: string; type: string; contact: string; email: string | null;
  regNo: string | null; submitted: string; status: string;
}

/** Ports pages/system-admin/approvals.html + js/system-admin.js's initApprovals(). */
export function SystemAdminApprovals() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [viewing, setViewing] = useState<Provider | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await apiRequest<{ providers: Provider[] }>('get', '/api/system-admin/approvals');
    setProviders(res.ok ? res.data.providers : []);
  };

  useEffect(() => { load(); }, []);

  const decide = async (id: number, decision: 'approve' | 'reject') => {
    setBusyId(id);
    setError(null);
    const res = await apiRequest('post', `/api/system-admin/approvals/${id}/${decision}`);
    setBusyId(null);
    if (!res.ok) {
      setError(res.data.message ?? 'Could not process this decision.');
      return;
    }
    load();
  };

  const pendingCount = providers.filter((p) => p.status === 'pending').length;

  return (
    <>
      <div className="page-header"><div><h1>Provider Approvals</h1><p>{pendingCount} pending reviews</p></div></div>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl mb-4" style={{ padding: '.75rem 1rem' }}>{error}</div>}

      <div className="table-wrap">
        <table className="data-table min-w-700">
          <thead><tr><th>Provider</th><th>Type</th><th>Location</th><th>Reg. No.</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {providers.length === 0 && (
              <tr><td colSpan={7} className="text-center text-gray-400 py-8">No provider applications yet.</td></tr>
            )}
            {providers.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold text-gray-800">{p.name}</td>
                <td><span style={{ background: 'var(--purple-50)', color: 'var(--purple-700)', fontSize: '.75rem', padding: '.25rem .5rem', borderRadius: '.5rem' }}>{p.type}</span></td>
                <td className="text-gray-500" style={{ fontSize: '.75rem' }}>{p.email || '—'}</td>
                <td className="text-xs font-mono text-gray-400">{p.regNo || '—'}</td>
                <td className="text-gray-500" style={{ fontSize: '.75rem' }}>{p.submitted}</td>
                <td><Badge status={p.status} /></td>
                <td>
                  {p.status === 'pending' ? (
                    <div className="flex" style={{ gap: '.375rem' }}>
                      <button
                        disabled={busyId === p.id} onClick={() => decide(p.id, 'approve')}
                        style={{ display: 'flex', alignItems: 'center', gap: '.25rem', fontSize: '.75rem', fontWeight: 600, padding: '.375rem .625rem', borderRadius: '.5rem', background: 'var(--green-50)', color: '#15803d' }}
                      >
                        <Icon name="check-circle" className="icon icon-12" /> Approve
                      </button>
                      <button
                        disabled={busyId === p.id} onClick={() => decide(p.id, 'reject')}
                        style={{ display: 'flex', alignItems: 'center', gap: '.25rem', fontSize: '.75rem', fontWeight: 600, padding: '.375rem .625rem', borderRadius: '.5rem', background: 'var(--red-50)', color: 'var(--red-600)' }}
                      >
                        <Icon name="x-circle" className="icon icon-12" /> Reject
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setViewing(p)} style={{ display: 'flex', alignItems: 'center', gap: '.25rem', fontSize: '.75rem', color: 'var(--gray-400)' }}>
                      <Icon name="external-link" className="icon icon-12" /> View
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewing && (
        <Modal onClose={() => setViewing(null)}>
          <h3>{viewing.name}</h3>
          <div className="space-y-3 text-sm">
            {([
              ['Type', viewing.type], ['Contact', viewing.contact], ['Email', viewing.email || '—'],
              ['Reg. No.', viewing.regNo || '—'], ['Submitted', viewing.submitted], ['Status', viewing.status],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex justify-between" style={{ padding: '.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
                <span className="text-gray-500">{label}</span><span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost w-full mt-2" onClick={() => setViewing(null)}>Close</button>
        </Modal>
      )}
    </>
  );
}
