import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';

interface DeptCard { id: number; name: string; beds: number; bedsFree: number; doctors: number; todayAppts: number; head: string }

/** Ports pages/hospital-admin/departments.html + js/hospital-admin.js's initDepartments() (FR-2.1). */
export function HospitalAdminDepartments() {
  const [departments, setDepartments] = useState<DeptCard[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [beds, setBeds] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const res = await apiRequest<{ departments: DeptCard[] }>('get', '/api/hospital-admin/departments');
    setDepartments(res.ok ? res.data.departments : []);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const res = await apiRequest('post', '/api/hospital-admin/departments', { name: name.trim(), bed_count: Number(beds) || 0 });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.data.message ?? 'Could not add department.');
      return;
    }
    setShowModal(false);
    setName(''); setBeds('');
    load();
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Departments &amp; Slots</h1><p>Manage hospital departments and appointment capacity</p></div>
        <button className="btn btn-brand btn-md" onClick={() => setShowModal(true)}>+ Add Department</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {departments.length === 0 && <div className="card p-6 text-center text-gray-400 col-span-full">No departments yet. Add one to get started.</div>}
        {departments.map((d) => (
          <div className="card p-5" key={d.id}>
            <div className="flex items-start gap-3 mb-4">
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#5B3F8D18', color: '#5B3F8D' }}>
                <Icon name="building-2" className="icon icon-18" />
              </div>
              <div><h3 className="font-semibold text-gray-800 font-heading">{d.name}</h3><p className="text-xs text-gray-400">Head: {d.head}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center mb-4">
              <div style={{ background: 'var(--gray-50)', borderRadius: '.75rem', padding: '.5rem' }}><div className="font-bold text-gray-800 text-lg font-heading">{d.doctors}</div><div className="text-gray-400" style={{ fontSize: 10 }}>Doctors</div></div>
              <div style={{ background: 'var(--gray-50)', borderRadius: '.75rem', padding: '.5rem' }}><div className="font-bold text-gray-800 text-lg font-heading">{d.bedsFree}/{d.beds}</div><div className="text-gray-400" style={{ fontSize: 10 }}>Beds free</div></div>
              <div style={{ background: 'var(--gray-50)', borderRadius: '.75rem', padding: '.5rem' }}><div className="font-bold text-gray-800 text-lg font-heading">{d.todayAppts}</div><div className="text-gray-400" style={{ fontSize: 10 }}>Today's Appts</div></div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h3>Add New Department</h3>
          <div className="space-y-3">
            {error && <div className="text-sm" style={{ color: 'var(--red-600)' }}>{error}</div>}
            <input className="form-input" placeholder="Department Name (e.g., Orthopedics)" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="number" className="form-input" placeholder="Bed Count" value={beds} onChange={(e) => setBeds(e.target.value)} />
            <div className="flex gap-3 pt-2">
              <button className="btn btn-ghost flex-1" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-brand flex-1" disabled={submitting} onClick={submit}>Add Department</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
