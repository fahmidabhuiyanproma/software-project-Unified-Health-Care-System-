import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { localISO } from '../../lib/date';

interface LabTest { id: number; lab_id: number; name: string; category: string; desc: string | null; price: number; turnaround: string }
interface Lab { id: number; name: string }

/** Ports pages/patient/lab-tests.html + js/patient.js's initLabTests() (FR-6.3). */
export function LabTests() {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selected, setSelected] = useState<LabTest | null>(null);
  const [labIndex, setLabIndex] = useState(0);
  const [date, setDate] = useState(localISO(new Date()));
  const [time, setTime] = useState('9:00 AM');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<{ name: string; lab: string; when: string; fee: string; turnaround: string } | null>(null);

  useEffect(() => {
    apiRequest<{ labs: Lab[] }>('get', '/api/patient/labs').then((res) => { if (res.ok) setLabs(res.data.labs); });
    apiRequest<{ tests: LabTest[] }>('get', '/api/patient/lab-tests').then((res) => { if (res.ok) setTests(res.data.tests); });
  }, []);

  const showConfirm = (t: LabTest) => {
    setSelected(t);
    setError(null);
  };

  const confirmBooking = async () => {
    if (!selected) return;
    setSubmitting(true);
    const lab = labs[labIndex];
    const res = await apiRequest('post', '/api/patient/lab-bookings', {
      test_id: selected.id, lab_id: lab ? lab.id : labs[0]?.id, date, time,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.data.message ?? 'Could not book this test.');
      return;
    }
    setBooked({
      name: selected.name, lab: labs[labIndex]?.name ?? '', when: `${date} · ${time}`,
      fee: `Fee: ৳ ${selected.price} (payable at lab)`, turnaround: `Results in: ${selected.turnaround}`,
    });
  };

  if (booked) {
    return (
      <div className="max-w-md mx-auto" style={{ paddingTop: '2.5rem' }}>
        <div className="card p-10 text-center">
          <div className="result-icon-ok"><Icon name="check-circle" className="icon icon-32" /></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2 font-heading">Lab Test Booked!</h2>
          <p className="text-gray-500 text-sm mb-1">{booked.name}</p>
          <p className="text-gray-500 text-sm mb-1">{booked.lab}</p>
          <p className="font-semibold my-3" style={{ color: 'var(--purple-700)' }}>{booked.when}</p>
          <p className="text-xs text-gray-400 mb-1">{booked.fee}</p>
          <p className="text-xs text-gray-400 mb-6">{booked.turnaround}</p>
          <button className="btn btn-brand btn-lg w-full" onClick={() => { setBooked(null); setSelected(null); }}>Book Another Test</button>
        </div>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="page-header"><div><h1>Confirm Booking</h1><p>{selected.name}</p></div></div>
        <div className="card p-6 space-y-4">
          <div className="form-group">
            <label className="form-label">Lab / Diagnostic Centre</label>
            <select className="form-select" value={labIndex} onChange={(e) => setLabIndex(Number(e.target.value))}>
              {labs.map((l, i) => <option key={l.id} value={i}>{l.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Preferred Date</label><input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="form-group">
            <label className="form-label">Preferred Time</label>
            <select className="form-select" value={time} onChange={(e) => setTime(e.target.value)}>
              {['7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: 'var(--purple-50)' }}>
            <div className="flex justify-between"><span className="text-gray-500">Test</span><span className="font-medium">{selected.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Category</span><span>{selected.category}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Turnaround</span><span>{selected.turnaround}</span></div>
            <div className="flex justify-between font-bold"><span>Fee</span><span style={{ color: '#5B3F8D' }}>৳ {selected.price}</span></div>
          </div>
          {error && <div className="text-sm" style={{ color: 'var(--red-600)' }}>{error}</div>}
          <div className="flex gap-3">
            <button className="btn btn-secondary flex-1" onClick={() => setSelected(null)}>Back</button>
            <button className="btn btn-brand flex-1" disabled={submitting} onClick={confirmBooking}>Confirm Booking</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header"><div><h1>Book Lab Test</h1><p>Certified labs across Bangladesh · Results to your portal</p></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tests.map((t) => (
          <div className="card p-5 flex flex-col" key={t.id}>
            <div className="flex items-start justify-between mb-3">
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '.75rem', background: 'var(--blue-50)', color: 'var(--blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="flask-conical" className="icon icon-18" />
              </div>
            </div>
            <h3 className="font-semibold text-gray-800 text-sm mb-1 font-heading">{t.name}</h3>
            <p className="text-xs text-gray-400 mb-3 flex-1 leading-relaxed">{t.desc || ''}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
              <Icon name="clock" className="icon icon-11" /> Result in {t.turnaround}<span className="mx-1">·</span><span className="font-medium" style={{ color: 'var(--purple-600)' }}>{t.category}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg font-heading" style={{ color: '#5B3F8D' }}>৳ {t.price}</span>
              <button className="btn btn-brand btn-sm" onClick={() => showConfirm(t)}>Book Test</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
