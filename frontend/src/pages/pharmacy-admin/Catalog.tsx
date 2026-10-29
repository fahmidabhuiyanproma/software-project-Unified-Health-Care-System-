import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';

interface Medicine { id: number; name: string; generic: string; category: string; price: number; stock: number; status: string }

const CATEGORIES = ['Analgesic', 'Antibiotic', 'Antidiabetic', 'Antihypertensive', 'Antacid', 'Antihistamine', 'Supplement'];

/** Ports pages/pharmacy-admin/catalog.html + js/pharmacy-admin.js's initCatalog() (FR-2.4). */
export function PharmacyAdminCatalog() {
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [counts, setCounts] = useState({ low: 0, out: 0 });
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [generic, setGeneric] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const res = await apiRequest<{ medicines: Medicine[]; lowStockCount: number; outOfStockCount: number }>('get', '/api/pharmacy-admin/catalog');
    if (res.ok) {
      setMeds(res.data.medicines);
      setCounts({ low: res.data.lowStockCount, out: res.data.outOfStockCount });
    }
  };

  useEffect(() => { load(); }, []);

  const openModal = (med: Medicine | null) => {
    setEditing(med);
    setName(med?.name ?? '');
    setGeneric(med?.generic ?? '');
    setCategory(med?.category ?? '');
    setPrice(med ? String(med.price) : '');
    setStock(med ? String(med.stock) : '');
    setError(null);
    setShowModal(true);
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const payload = { name: name.trim(), generic_name: generic.trim(), category, price: Number(price) || 0, stock_qty: Number(stock) || 0 };
    const res = editing
      ? await apiRequest('put', `/api/pharmacy-admin/catalog/${editing.id}`, payload)
      : await apiRequest('post', '/api/pharmacy-admin/catalog', payload);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.data.message ?? 'Could not save this medicine.');
      return;
    }
    setShowModal(false);
    load();
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Medicine Catalog &amp; Stock</h1><p>{meds.length} medicines · {counts.low} low stock, {counts.out} out of stock</p></div>
        <button className="btn btn-brand btn-md" onClick={() => openModal(null)}><Icon name="plus" className="icon icon-16" /> Add Medicine</button>
      </div>

      <div className="table-wrap">
        <table className="data-table min-w-640">
          <thead><tr><th>Medicine</th><th>Generic Name</th><th>Category</th><th>Price/Unit</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {meds.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">No medicines yet. Add one to get started.</td></tr>}
            {meds.map((m) => {
              const stockColor = m.stock === 0 ? 'var(--red-500)' : m.stock < 50 ? 'var(--amber-600)' : 'var(--gray-700)';
              return (
                <tr key={m.id}>
                  <td className="font-semibold text-gray-800">{m.name}</td>
                  <td className="text-gray-500" style={{ fontSize: '.75rem' }}>{m.generic}</td>
                  <td><span style={{ background: 'var(--purple-50)', color: 'var(--purple-700)', fontSize: '.75rem', padding: '.25rem .5rem', borderRadius: '.5rem' }}>{m.category}</span></td>
                  <td className="font-bold" style={{ fontSize: '.875rem', color: '#5B3F8D' }}>৳ {m.price}</td>
                  <td style={{ fontSize: '.875rem' }}>
                    <span style={{ color: stockColor, fontWeight: m.stock < 50 ? 600 : 400 }}>{m.stock < 50 && m.stock > 0 ? '⚠ ' : ''}{m.stock} units</span>
                  </td>
                  <td><Badge status={m.status} /></td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => openModal(m)}><Icon name="pencil" className="icon icon-12" /> Edit</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h3>{editing ? 'Edit Medicine' : 'Add Medicine to Catalog'}</h3>
          <div className="space-y-3">
            {error && <div className="text-sm" style={{ color: 'var(--red-600)' }}>{error}</div>}
            <input className="form-input" placeholder="Brand Name (e.g., Napa 500mg)" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="form-input" placeholder="Generic Name (e.g., Paracetamol)" value={generic} onChange={(e) => setGeneric(e.target.value)} />
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select Category</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" className="form-input" placeholder="Price per unit (৳)" value={price} onChange={(e) => setPrice(e.target.value)} />
              <input type="number" className="form-input" placeholder="Initial stock (units)" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn btn-ghost flex-1" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-brand flex-1" disabled={submitting} onClick={submit}>{editing ? 'Save Changes' : 'Add Medicine'}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
