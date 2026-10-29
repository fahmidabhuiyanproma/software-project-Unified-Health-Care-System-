import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { localISO } from '../../lib/date';

interface Appointment {
  id: number; doctor_id: number; doctor: string; specialty: string; hospital: string;
  date: string; time: string; type: string; status: string; fee: string; reason: string | null; img: string;
}
interface Slot { time: string; available: boolean }

/** Ports pages/patient/appointments.html + js/patient.js's initAppointments() (FR-3.3). */
export function Appointments() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [reschedule, setReschedule] = useState<{ id: number; doctorId: number } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const load = async () => {
    const res = await apiRequest<{ appointments: Appointment[] }>('get', '/api/patient/appointments');
    setAppointments(res.ok ? res.data.appointments : []);
  };

  useEffect(() => { load(); }, []);

  const upcoming = appointments.filter((a) => a.status === 'confirmed' || a.status === 'pending');
  const past = appointments.filter((a) => a.status !== 'confirmed' && a.status !== 'pending');
  const data = tab === 'upcoming' ? upcoming : past;

  const openReschedule = (id: number, doctorId: number) => {
    const today = localISO(new Date());
    setReschedule({ id, doctorId });
    setRescheduleDate(today);
    setRescheduleError(null);
    setRescheduleTime('');
    loadRescheduleSlots(doctorId, today);
  };

  const loadRescheduleSlots = async (doctorId: number, date: string) => {
    const res = await apiRequest<{ slots: Slot[] }>('get', `/api/patient/doctors/${doctorId}/slots?date=${date}`);
    setRescheduleSlots(res.ok ? res.data.slots.filter((s) => s.available) : []);
  };

  const confirmCancel = async () => {
    if (cancelId === null) return;
    await apiRequest('post', `/api/patient/appointments/${cancelId}/cancel`);
    setCancelId(null);
    load();
  };

  const confirmReschedule = async () => {
    if (!reschedule || !rescheduleTime) return;
    const res = await apiRequest('post', `/api/patient/appointments/${reschedule.id}/reschedule`, { date: rescheduleDate, time: rescheduleTime });
    if (!res.ok) {
      setRescheduleError(res.data.message ?? 'Could not reschedule.');
      return;
    }
    setReschedule(null);
    load();
  };

  return (
    <>
      <div className="page-header">
        <div><h1>My Appointments</h1><p>Manage your upcoming and past appointments</p></div>
        <Link to="/patient/search-doctors" className="btn btn-brand btn-md"><Icon name="plus" className="icon icon-16" /> Book New</Link>
      </div>

      <div className="flex gap-2 mb-6 card p-1 max-w-xs">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t} className="tab-btn flex-1" onClick={() => setTab(t)}
            style={{ padding: '.5rem', borderRadius: '.75rem', fontSize: '.875rem', fontWeight: 600, background: tab === t ? '#5B3F8D' : 'transparent', color: tab === t ? '#fff' : 'var(--gray-500)' }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)} ({t === 'upcoming' ? upcoming.length : past.length})
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="text-center card" style={{ padding: '5rem 0' }}>
          <Icon name="calendar" className="icon icon-40 text-gray-200" />
          <p className="text-gray-500 mt-4">No appointments</p>
          <Link to="/patient/search-doctors" className="btn btn-brand btn-md mt-4">Book an Appointment</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((a) => {
            const when = new Date(`${a.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            return (
              <div className="card p-5" key={a.id}>
                <div className="flex items-start gap-4">
                  <img src={a.img} alt="" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', objectFit: 'cover', background: 'var(--purple-100)', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><h3 className="font-semibold text-gray-800 font-heading">{a.doctor}</h3><p className="text-sm" style={{ color: 'var(--purple-700)' }}>{a.specialty}</p></div>
                      <Badge status={a.status} />
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1"><Icon name="map-pin" className="icon icon-11" /> {a.hospital}</div>
                      <div className="flex items-center gap-1"><Icon name="calendar" className="icon icon-11" /> {when}</div>
                      <div className="flex items-center gap-1"><Icon name="clock" className="icon icon-11" /> {a.time}</div>
                      <div className="flex items-center gap-1">{a.type === 'telemedicine' ? <><Icon name="video" className="icon icon-11" /> Telemedicine</> : <>🏥 In-Person</>}</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-700 mt-2">{a.fee}</div>
                  </div>
                </div>

                {(a.status === 'confirmed' || a.status === 'pending') && (
                  <>
                    {a.status === 'pending' && <div className="text-xs mt-3" style={{ color: 'var(--amber-700)' }}>⏳ Awaiting doctor confirmation</div>}
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <button className="btn btn-secondary btn-sm" onClick={() => openReschedule(a.id, a.doctor_id)}><Icon name="refresh-cw" className="icon icon-13" /> Reschedule</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setCancelId(a.id)}><Icon name="x" className="icon icon-13" /> Cancel</button>
                      {a.status === 'confirmed' && a.type === 'telemedicine' && (
                        <Link to={`/patient/telemedicine?appointment_id=${a.id}`} className="btn btn-brand btn-sm"><Icon name="video" className="icon icon-13" /> Join Call</Link>
                      )}
                    </div>
                  </>
                )}
                {a.status === 'completed' && (
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Link to="/patient/medical-records" className="btn btn-ghost btn-sm">View Record</Link>
                    <Link to="/patient/search-doctors" className="btn btn-secondary btn-sm">Book Follow-up</Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {cancelId !== null && (
        <Modal onClose={() => setCancelId(null)}>
          <h3>Cancel Appointment?</h3>
          <p className="text-sm text-gray-600 mb-6">Are you sure you want to cancel this appointment? Cancellations within 2 hours may incur a fee.</p>
          <div className="flex gap-3">
            <button className="btn btn-ghost flex-1" onClick={() => setCancelId(null)}>Keep Appointment</button>
            <button className="btn btn-danger flex-1" onClick={confirmCancel}>Yes, Cancel</button>
          </div>
        </Modal>
      )}

      {reschedule && (
        <Modal onClose={() => setReschedule(null)}>
          <h3>Reschedule Appointment</h3>
          {rescheduleError && <div className="text-sm mb-2" style={{ color: 'var(--red-600)' }}>{rescheduleError}</div>}
          <div className="form-group">
            <label className="form-label">New Date</label>
            <input
              type="date" className="form-input" min={localISO(new Date())} value={rescheduleDate}
              onChange={(e) => { setRescheduleDate(e.target.value); loadRescheduleSlots(reschedule.doctorId, e.target.value); }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">New Time</label>
            <select className="form-select" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)}>
              {rescheduleSlots.length === 0 && <option value="">No slots available</option>}
              {rescheduleSlots.map((s) => <option key={s.time}>{s.time}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn btn-ghost flex-1" onClick={() => setReschedule(null)}>Cancel</button>
            <button className="btn btn-brand flex-1" onClick={confirmReschedule}>Confirm</button>
          </div>
        </Modal>
      )}
    </>
  );
}
