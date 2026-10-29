import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';

interface LabBooking { id: number; patient: string; test: string; date: string; time: string; fee: string; status: string }

/** Ports pages/lab-admin/bookings.html + js/lab-admin.js's initBookings() (FR-6.3). */
export function LabAdminBookings() {
  const [bookings, setBookings] = useState<LabBooking[]>([]);
  const [current, setCurrent] = useState<LabBooking | null>(null);
  const [summary, setSummary] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = await apiRequest<{ bookings: LabBooking[] }>('get', '/api/lab-admin/bookings');
    setBookings(res.ok ? res.data.bookings : []);
  };

  useEffect(() => { load(); }, []);

  const openUpload = (b: LabBooking) => {
    setCurrent(b);
    setSummary('');
    setFile(null);
    setError(null);
    setDone(false);
  };

  const publish = async () => {
    if (!current) return;
    if (!summary.trim()) {
      setError('Please enter a result summary.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const form = new FormData();
    form.append('booking_id', String(current.id));
    form.append('result_summary', summary.trim());
    if (file) form.append('report', file);

    const res = await apiRequest('post', '/api/lab-admin/bookings/publish', form);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.data.message ?? 'Could not publish result.');
      return;
    }
    setDone(true);
    setTimeout(() => { setCurrent(null); load(); }, 1300);
  };

  return (
    <>
      <div className="page-header"><div><h1>Manage Bookings</h1><p>{bookings.length} bookings</p></div></div>

      <div className="table-wrap">
        <table className="data-table min-w-600">
          <thead><tr><th>ID</th><th>Patient</th><th>Test</th><th>Date &amp; Time</th><th>Fee</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {bookings.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">No bookings yet.</td></tr>}
            {bookings.map((b) => (
              <tr key={b.id}>
                <td className="text-xs font-mono text-gray-400">LB{String(b.id).padStart(3, '0')}</td>
                <td className="font-semibold text-gray-800">{b.patient}</td>
                <td className="text-gray-600" style={{ fontSize: '.75rem' }}>{b.test}</td>
                <td className="text-gray-500" style={{ fontSize: '.75rem' }}>{b.date} · {b.time}</td>
                <td className="text-gray-700 font-medium" style={{ fontSize: '.75rem' }}>{b.fee}</td>
                <td><Badge status={b.status} /></td>
                <td>
                  {b.status === 'ready' ? (
                    <span className="text-green-600 flex items-center gap-1" style={{ fontSize: '.75rem' }}><Icon name="check-circle" className="icon icon-12" /> Published</span>
                  ) : (
                    <button className="btn btn-brand btn-sm" onClick={() => openUpload(b)}><Icon name="upload" className="icon icon-12" /> Upload Result</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {current && (
        <Modal onClose={() => setCurrent(null)}>
          <h3>Upload Result — {current.test}</h3>
          {!done ? (
            <div>
              <p className="text-sm text-gray-500 mb-3">Patient: <strong>{current.patient}</strong></p>
              {error && <div className="text-sm mb-3" style={{ color: 'var(--red-600)' }}>{error}</div>}
              <div className="form-group mb-3">
                <label className="form-label">Result Summary</label>
                <textarea rows={3} className="form-textarea" placeholder="e.g., WBC: 7.2, RBC: 4.8 — All within normal range" value={summary} onChange={(e) => setSummary(e.target.value)} />
              </div>
              <div className="form-group mb-4">
                <label className="form-label">Attach PDF Report (optional)</label>
                <label
                  style={{ display: 'block', border: '2px dashed var(--gray-200)', borderRadius: '.75rem', padding: '1.5rem', textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon name="upload" className="icon icon-24 text-gray-300" />
                  <p className="text-sm text-gray-400 mt-2">{file ? file.name : 'Click to upload or drag & drop'}</p>
                  <p className="text-xs text-gray-300 mt-1">PDF, up to 10MB</p>
                  <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className="flex gap-3">
                <button className="btn btn-ghost flex-1" onClick={() => setCurrent(null)}>Cancel</button>
                <button className="btn btn-brand flex-1" disabled={submitting} onClick={publish}>Publish Result</button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <Icon name="check-circle" className="icon icon-32 text-green-500" />
              <p style={{ color: '#15803d', fontWeight: 600, marginTop: '.75rem' }}>Result published!</p>
              <p className="text-xs text-gray-400 mt-1">Patient has been notified.</p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
