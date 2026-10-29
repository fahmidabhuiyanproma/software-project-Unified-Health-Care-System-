import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';

interface LabTest { id: number; name: string; category: string; price: number; turnaround: string; active: boolean }

const CATEGORIES = ['Hematology', 'Biochemistry', 'Microbiology', 'Radiology', 'Cardiology', 'Endocrinology', 'Urology', 'Diabetes'];

/** Ports pages/lab-admin/catalog.html + js/lab-admin.js's initCatalog() (FR-2.3). */
export function LabAdminCatalog() {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [turnaround, setTurnaround] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const res = await apiRequest<{ tests: LabTest[] }>('get', '/api/lab-admin/catalog');
    setTests(res.ok ? res.data.tests : []);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (t: LabTest) => {
    setTests((prev) => prev.map((x) => (x.id === t.id ? { ...x, active: !x.active } : x)));
    await apiRequest('post', `/api/lab-admin/catalog/${t.id}/toggle`, { is_active: !t.active });
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const res = await apiRequest('post', '/api/lab-admin/catalog', {
      name: name.trim(), category, price: Number(price) || 0, turnaround: turnaround.trim(), description: description.trim(),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.data.message ?? 'Could not add test.');
      return;
    }
    setShowModal(false);
    setName(''); setCategory(''); setPrice(''); setTurnaround(''); setDescription('');
    load();
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Test Catalog</h1><p>{tests.length} tests · Manage prices and availability</p></div>
        <button className="btn btn-brand btn-md" onClick={() => setShowModal(true)}><Icon name="plus" className="icon icon-16" /> Add Test</button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Test Name</th><th>Category</th><th>Price</th><th>Turnaround</th><th>Active</th></tr></thead>
          <tbody>
            {tests.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-8">No tests yet. Add one to get started.</td></tr>}
            {tests.map((t) => (
              <tr key={t.id}>
                <td className="font-semibold text-gray-800">{t.name}</td>
                <td><span style={{ background: 'var(--blue-50)', color: 'var(--blue-700)', fontSize: '.75rem', padding: '.25rem .5rem', borderRadius: '.5rem' }}>{t.category}</span></td>
                <td className="font-bold" style={{ fontSize: '.875rem', color: '#5B3F8D' }}>৳ {t.price}</td>
                <td className="text-gray-500" style={{ fontSize: '.75rem' }}>{t.turnaround}</td>
                <td><label className="toggle sm"><input type="checkbox" checked={t.active} onChange={() => toggle(t)} /><span className="track" /></label></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h3>Add New Test</h3>
          <div className="space-y-3">
            {error && <div className="text-sm" style={{ color: 'var(--red-600)' }}>{error}</div>}
            <input className="form-input" placeholder="Test Name" value={name} onChange={(e) => setName(e.target.value)} />
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select Category</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input type="number" className="form-input" placeholder="Price (৳)" value={price} onChange={(e) => setPrice(e.target.value)} />
            <input className="form-input" placeholder="Turnaround time (e.g., 4–6 hours)" value={turnaround} onChange={(e) => setTurnaround(e.target.value)} />
            <textarea rows={2} className="form-textarea" placeholder="Description / instructions for patient" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="flex gap-3 pt-2">
              <button className="btn btn-ghost flex-1" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-brand flex-1" disabled={submitting} onClick={submit}>Add Test</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
