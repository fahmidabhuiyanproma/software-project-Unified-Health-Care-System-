import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../../lib/api';
import { Badge } from '../../components/Badge';
import { localISO } from '../../lib/date';

interface HospitalOption { id: number; name: string; city: string | null }
interface DepartmentSummary { id: number; name: string; total: number; pending: number; approved: number; booked: number; available: number; open: boolean }
interface MyBooking { id: number; hospital: string; department: string; date: string; reason: string; status: string; rejectionReason: string | null; requestedAt: string | null }

/** Ports pages/patient/bed-booking.html + js/patient.js's initBedBooking(). */
export function BedBooking() {
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [hospitalId, setHospitalId] = useState('');
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);
  const [myBeds, setMyBeds] = useState<MyBooking[]>([]);
  const [reason, setReason] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(localISO(new Date()));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = localISO(new Date());
  const maxDate = localISO(new Date(Date.now() + 90 * 86400000));

  const loadHome = async () => {
    const res = await apiRequest<{ hospitals: HospitalOption[]; bookings: MyBooking[] }>('get', '/api/patient/beds');
    if (res.ok) {
      setHospitals(res.data.hospitals);
      setMyBeds(res.data.bookings);
    }
  };

  const loadDepts = async (hid: string) => {
    if (!hid) {
      setDepartments([]);
      return;
    }
    const res = await apiRequest<{ departments: DepartmentSummary[] }>('get', `/api/patient/beds?hospital_id=${hid}`);
    if (res.ok) {
      setDepartments(res.data.departments);
      setSelected((cur) => {
        if (!cur) return cur;
        const stillOpen = res.data.departments.find((d) => d.id === cur.id)?.open;
        if (!stillOpen) {
          setMsg({ ok: false, text: 'That department just filled up — bookings for it are now closed.' });
          return null;
        }
        return cur;
      });
    }
  };

  useEffect(() => { loadHome(); }, []);
  useEffect(() => { loadDepts(hospitalId); }, [hospitalId]);
  useEffect(() => {
    const t = setInterval(() => { if (hospitalId) loadDepts(hospitalId); }, 20000);
    return () => clearInterval(t);
  }, [hospitalId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setMsg({ ok: false, text: 'Please choose a department first.' });
      return;
    }
    setSubmitting(true);
    const res = await apiRequest<{ message: string }>('post', '/api/patient/beds', {
      department_id: selected.id, admission_date: date, reason: reason.trim(), attendant_phone: phone.trim(), notes: notes.trim(),
    });
    setSubmitting(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.data.message ?? 'Could not send your request.' });
      loadDepts(hospitalId); loadHome();
      return;
    }
    setMsg({ ok: true, text: res.data.message });
    setReason(''); setNotes(''); setPhone('');
    setSelected(null);
    loadDepts(hospitalId); loadHome();
  };

  const cancelBooking = async (id: number) => {
    if (!window.confirm('Cancel this bed booking? The bed will be released.')) return;
    const res = await apiRequest('post', `/api/patient/beds/${id}/cancel`);
    if (!res.ok) window.alert(res.data.message ?? 'Could not cancel this booking.');
    loadHome(); loadDepts(hospitalId);
  };

  const hospitalName = hospitals.find((h) => String(h.id) === hospitalId)?.name ?? '';

  return (
    <>
      <div className="page-header"><div><h1>Bed Booking</h1><p>Request a hospital bed — the hospital reviews and approves your request</p></div></div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-800 mb-4 font-heading">1. Choose a hospital and department</h3>
            <select className="form-select" value={hospitalId} onChange={(e) => { setHospitalId(e.target.value); setSelected(null); setMsg(null); }}>
              <option value="">Select a hospital</option>
              {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}{h.city ? ` — ${h.city}` : ''}</option>)}
            </select>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              {hospitalId && departments.length === 0 && <div className="text-sm text-gray-400" style={{ gridColumn: '1/-1' }}>This hospital has no departments yet.</div>}
              {departments.map((d) => {
                const pct = d.total > 0 ? Math.round((d.booked / d.total) * 100) : 100;
                const isSel = selected?.id === d.id;
                return (
                  <button
                    type="button" key={d.id} disabled={!d.open}
                    onClick={() => {
                      setSelected({ id: d.id, name: d.name });
                      setMsg(null);
                    }}
                    style={{
                      textAlign: 'left', padding: '.875rem 1rem', borderRadius: '.75rem',
                      background: isSel ? 'var(--purple-50)' : '#fff',
                      border: `2px solid ${isSel ? 'var(--purple-700)' : 'var(--gray-200)'}`,
                      cursor: d.open ? 'pointer' : 'not-allowed', opacity: d.open ? 1 : 0.6,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-800 text-sm">{d.name}</span>
                      {d.open ? (
                        <span className="text-xs font-semibold" style={{ color: d.available <= 3 ? 'var(--amber-700)' : '#15803d' }}>{d.available} of {d.total} beds free</span>
                      ) : (
                        <span className="text-xs font-semibold" style={{ color: 'var(--red-600)' }}>{d.total === 0 ? 'No beds set up' : 'Full — bookings closed'}</span>
                      )}
                    </div>
                    <div className="progress-track" style={{ marginTop: '.5rem' }}><div className="progress-fill" style={{ width: `${pct}%`, background: d.open ? '#5B3F8D' : 'var(--red-600)' }} /></div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3">Bed numbers update live. A department with no free beds is closed for new requests.</p>
          </div>

          {selected && (
            <form className="card p-6" onSubmit={onSubmit}>
              <h3 className="font-semibold text-gray-800 mb-1 font-heading">2. Admission details</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--purple-700)' }}>{hospitalName} · {selected.name} ({departments.find((d) => d.id === selected.id)?.available ?? 0} beds free)</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="form-group"><label className="form-label">Admission date<span className="req">*</span></label><input type="date" className="form-input" min={today} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Attendant phone</label><input className="form-input" maxLength={20} placeholder="Someone we can call" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Reason for admission<span className="req">*</span></label><input className="form-input" maxLength={255} placeholder="e.g., Chest pain, planned surgery..." value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Notes for the hospital (optional)</label><textarea rows={3} className="form-textarea" maxLength={500} placeholder="Allergies, existing conditions, special needs..." value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              </div>
              {msg && (
                <div className="text-sm rounded-xl mt-4" style={{ padding: '.75rem 1rem', background: msg.ok ? 'var(--green-50)' : 'var(--red-50)', color: msg.ok ? '#15803d' : 'var(--red-600)' }}>{msg.text}</div>
              )}
              <button type="submit" className="btn btn-brand mt-4" disabled={submitting}>Request bed</button>
            </form>
          )}
          {!selected && msg && (
            <div className="text-sm rounded-xl" style={{ padding: '.75rem 1rem', background: msg.ok ? 'var(--green-50)' : 'var(--red-50)', color: msg.ok ? '#15803d' : 'var(--red-600)' }}>{msg.text}</div>
          )}
        </div>

        <div className="card p-6 h-fit">
          <h3 className="font-semibold text-gray-800 mb-4 font-heading">My bed bookings</h3>
          {myBeds.length === 0 && <div className="text-sm text-gray-400">You have no bed bookings yet.</div>}
          {myBeds.map((b) => {
            const when = new Date(`${b.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            const active = b.status === 'pending' || b.status === 'approved';
            return (
              <div style={{ padding: '.75rem 0', borderBottom: '1px solid var(--gray-100)' }} key={b.id}>
                <div className="flex items-start justify-between gap-2">
                  <div><div className="font-semibold text-gray-800 text-sm">{b.department}</div><div className="text-xs text-gray-500">{b.hospital}</div></div>
                  <Badge status={b.status} />
                </div>
                <div className="text-xs text-gray-500 mt-1">Admission: {when}</div>
                <div className="text-xs text-gray-400" style={{ marginTop: '.125rem' }}>{b.reason}</div>
                {b.status === 'pending' && <div className="text-xs mt-1" style={{ color: 'var(--amber-700)' }}>⏳ Awaiting hospital approval</div>}
                {b.status === 'rejected' && b.rejectionReason && <div className="text-xs mt-1" style={{ color: 'var(--red-600)' }}>Reason: {b.rejectionReason}</div>}
                {active && <button className="btn btn-danger btn-sm mt-2" onClick={() => cancelBooking(b.id)}>Cancel booking</button>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
