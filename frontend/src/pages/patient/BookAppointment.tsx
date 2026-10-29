import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { localISO } from '../../lib/date';

interface DoctorDetail {
  id: number; name: string; specialty: string; hospital: string; fee: string; img: string; weeklyAvailability: boolean[];
}
interface Slot { time: string; available: boolean }
interface DateOption { iso: string; label: string; date: string; full: string; avail: boolean }

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildDates(weeklyAvailability: boolean[]): DateOption[] {
  const out: DateOption[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const weekday = d.getDay();
    out.push({
      iso: localISO(d),
      label: WEEKDAY_LABELS[weekday],
      date: String(d.getDate()),
      full: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      avail: weeklyAvailability[weekday] !== false,
    });
  }
  return out;
}

/** Ports pages/patient/book-appointment.html + js/patient.js's initBookAppointment(). */
export function BookAppointment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const doctorId = params.get('id') || '1';

  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [dates, setDates] = useState<DateOption[]>([]);
  const [dateIndex, setDateIndex] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState(params.get('slot') || '');
  const [visitType, setVisitType] = useState<'in-person' | 'telemedicine'>('in-person');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    apiRequest<{ doctor: DoctorDetail }>('get', `/api/patient/doctors/${doctorId}`).then((res) => {
      if (!res.ok) return;
      const d = res.data.doctor;
      setDoctor(d);
      const built = buildDates(d.weeklyAvailability);
      setDates(built);
      const firstAvail = built.findIndex((x) => x.avail);
      setDateIndex(firstAvail >= 0 ? firstAvail : 0);
    });
  }, [doctorId]);

  useEffect(() => {
    if (!dates.length) return;
    const date = dates[dateIndex];
    apiRequest<{ slots: Slot[] }>('get', `/api/patient/doctors/${doctorId}/slots?date=${date.iso}`).then((res) => {
      setSlots(res.ok ? res.data.slots : []);
    });
  }, [dates, dateIndex, doctorId]);

  const confirmBooking = async () => {
    setSubmitting(true);
    setError(null);
    const res = await apiRequest('post', '/api/patient/appointments', {
      doctor_id: Number(doctorId), date: dates[dateIndex].iso, time: selectedSlot,
      visit_type: visitType, reason: reason.trim(), notes: notes.trim(),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.data.message ?? 'Could not book this appointment.');
      if ((res.data.message ?? '').includes('slot')) {
        apiRequest<{ slots: Slot[] }>('get', `/api/patient/doctors/${doctorId}/slots?date=${dates[dateIndex].iso}`).then((r) => setSlots(r.ok ? r.data.slots : []));
      }
      return;
    }
    setDone(true);
  };

  if (done && doctor) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="max-w-md mx-auto" style={{ paddingTop: '2.5rem' }}>
          <div className="card p-10 text-center">
            <div className="result-icon-ok"><Icon name="check-circle" className="icon icon-32" /></div>
            <h2 className="text-xl font-bold text-gray-800 mb-2 font-heading">Appointment Requested!</h2>
            <p className="text-gray-500 text-sm mb-1">{doctor.name} · {doctor.specialty}</p>
            <p className="text-gray-500 text-sm mb-1">{doctor.hospital}</p>
            <p className="font-semibold my-3" style={{ color: 'var(--purple-700)' }}>{dates[dateIndex].full} · {selectedSlot}</p>
            <p className="text-xs text-gray-400 mb-6">Your request is awaiting the doctor's confirmation. You'll get a notification as soon as it's confirmed.</p>
            <div className="flex gap-3">
              <Link to="/patient/appointments" className="btn btn-secondary flex-1">My Appointments</Link>
              <Link to="/patient/dashboard" className="btn btn-brand flex-1">Home</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stepLabels = ['Select Date & Time', 'Visit Details', 'Confirm'];

  return (
    <div className="max-w-2xl mx-auto">
      <button
        className="back-link mb-6" style={{ display: 'inline-flex', marginBottom: '1.5rem' }}
        onClick={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2) : navigate(`/patient/doctors/${doctorId}`))}
      >
        <Icon name="arrow-left" className="icon icon-16" /> {step > 1 ? 'Back' : 'Back to Doctor'}
      </button>
      <h1 className="text-2xl font-bold text-gray-800 mb-1 font-heading">Book Appointment</h1>
      <p className="text-gray-500 text-sm mb-6">Step {step} of 3 — {stepLabels[step - 1]}</p>
      <div className="progress-steps">
        <div className="seg done" />
        <div className={`seg${step >= 2 ? ' done' : ''}`} />
        <div className={`seg${step >= 3 ? ' done' : ''}`} />
      </div>

      <div className="rounded-2xl p-4 mb-6 flex items-center gap-4" style={{ background: 'var(--purple-50)' }}>
        <img src={doctor?.img || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=60&h=60&fit=crop&auto=format'} alt="Doctor" style={{ width: '3rem', height: '3rem', borderRadius: '.75rem', objectFit: 'cover' }} />
        <div>
          <div className="font-semibold text-gray-800 font-heading">{doctor?.name || 'Loading…'}</div>
          <div className="text-sm" style={{ color: 'var(--purple-700)' }}>{doctor ? `${doctor.specialty} · ${doctor.hospital}` : ''}</div>
          <div className="text-xs text-gray-500">{doctor ? `Consultation fee: ${doctor.fee}` : ''}</div>
        </div>
      </div>

      {step === 1 && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-800 mb-4 font-heading">Select Date</h3>
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {dates.map((d, i) => {
              const active = i === dateIndex;
              return (
                <button
                  key={d.iso} type="button" disabled={!d.avail}
                  onClick={() => { setDateIndex(i); setSelectedSlot(''); }}
                  style={{
                    minWidth: 64, padding: '.75rem 1rem', borderRadius: '.75rem',
                    border: `2px solid ${active ? 'var(--purple-700)' : d.avail ? 'var(--gray-200)' : 'var(--gray-100)'}`,
                    background: active ? 'var(--purple-700)' : 'transparent',
                    color: active ? '#fff' : d.avail ? 'var(--gray-700)' : 'var(--gray-300)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0,
                  }}
                >
                  <span className="text-xs">{d.label}</span>
                  <span className="text-lg font-bold">{d.date}</span>
                  {!d.avail && <span style={{ fontSize: 9 }}>N/A</span>}
                </button>
              );
            })}
          </div>
          <h3 className="font-semibold text-gray-800 mb-4 font-heading">Select Time Slot</h3>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {slots.map((s) => {
              const active = s.time === selectedSlot;
              return (
                <button
                  key={s.time} type="button" disabled={!s.available}
                  onClick={() => setSelectedSlot(s.time)}
                  style={{
                    padding: '.625rem', borderRadius: '.75rem',
                    border: `2px solid ${!s.available ? 'var(--gray-100)' : active ? 'var(--purple-700)' : 'var(--gray-200)'}`,
                    color: !s.available ? 'var(--gray-300)' : active ? '#fff' : 'var(--gray-700)',
                    background: active && s.available ? 'var(--purple-700)' : undefined,
                    fontSize: '.875rem', fontWeight: 500,
                  }}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
          <button className="btn btn-brand btn-lg w-full" disabled={!selectedSlot} onClick={() => setStep(2)}>Continue</button>
        </div>
      )}

      {step === 2 && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-gray-800 mb-4 font-heading">Visit Details</h3>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Visit Type</label>
            <div className="flex gap-3">
              {(['in-person', 'telemedicine'] as const).map((t) => {
                const on = visitType === t;
                return (
                  <button
                    key={t} type="button" onClick={() => setVisitType(t)}
                    style={{
                      flex: 1, padding: '.75rem', borderRadius: '.75rem',
                      border: `2px solid ${on ? 'var(--purple-700)' : 'var(--gray-200)'}`,
                      background: on ? 'var(--purple-50)' : 'transparent',
                      color: on ? 'var(--purple-700)' : 'var(--gray-600)',
                      fontSize: '.875rem', fontWeight: 500,
                    }}
                  >
                    {t === 'in-person' ? '🏥 In-Person' : '📱 Telemedicine'}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="form-group"><label className="form-label">Reason for Visit</label><input className="form-input" placeholder="e.g., Chest pain, routine checkup..." value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Additional Notes (optional)</label><textarea rows={3} className="form-textarea" placeholder="Any existing conditions, allergies, or notes for the doctor..." value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <button className="btn btn-brand btn-lg w-full" onClick={() => setStep(3)}>Continue</button>
        </div>
      )}

      {step === 3 && doctor && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-800 mb-4 font-heading">Confirm Appointment</h3>
          {error && <div className="text-sm mb-3" style={{ color: 'var(--red-600)' }}>{error}</div>}
          <div className="space-y-3 mb-6">
            {([
              ['Doctor', `${doctor.name} · ${doctor.specialty}`], ['Hospital', doctor.hospital],
              ['Date', dates[dateIndex].full], ['Time', selectedSlot],
              ['Visit Type', visitType === 'in-person' ? 'In-Person' : 'Telemedicine'], ['Consultation Fee', doctor.fee],
            ] as const).map(([label, value]) => (
              <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--gray-100)' }} key={label}>
                <span className="text-sm text-gray-500">{label}</span><span className="text-sm font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </div>
          <div className="text-xs rounded-xl mb-5" style={{ background: 'var(--amber-50)', color: 'var(--amber-700)', padding: '.75rem 1rem', border: '1px solid var(--amber-100)' }}>
            ⏰ Please arrive 15 minutes before your appointment. Cancellations must be made at least 2 hours in advance.
          </div>
          <button className="btn btn-brand btn-lg w-full" disabled={submitting} onClick={confirmBooking}>Confirm Appointment</button>
        </div>
      )}
    </div>
  );
}
