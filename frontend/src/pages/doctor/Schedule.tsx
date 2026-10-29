import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { localISO } from '../../lib/date';

interface Slot { time: string; patient?: string | null; type?: string; status?: string }

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function initials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Ports pages/doctor/schedule.html + js/doctor.js's initSchedule(). */
export function DoctorSchedule() {
  const [dayDates] = useState(() => Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }));
  const [selectedDay, setSelectedDay] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [weeklyAvailability, setWeeklyAvailability] = useState<boolean[]>(Array(7).fill(true));

  const loadSlots = async (dayIndex: number) => {
    const iso = localISO(dayDates[dayIndex]);
    const res = await apiRequest<{ slots: Slot[]; weeklyAvailability: boolean[] }>('get', `/api/doctor/schedule?date=${iso}`);
    if (res.ok) {
      setSlots(res.data.slots);
      setWeeklyAvailability(res.data.weeklyAvailability);
    }
  };

  useEffect(() => { loadSlots(selectedDay); }, [selectedDay]);

  const toggleDay = async (weekday: number) => {
    const next = [...weeklyAvailability];
    next[weekday] = !next[weekday];
    setWeeklyAvailability(next);
    await apiRequest('post', '/api/doctor/schedule', { weekday, is_available: next[weekday] });
  };

  return (
    <>
      <div className="page-header"><div><h1>My Schedule</h1><p>Manage your appointment slots and availability</p></div></div>

      <div className="flex items-center gap-2 mb-6">
        <button style={{ padding: '.5rem', borderRadius: '.75rem' }}><Icon name="chevron-left" className="icon icon-18" /></button>
        <div className="flex gap-2 overflow-x-auto">
          {dayDates.map((d, i) => {
            const active = i === selectedDay;
            const label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
            return (
              <button
                key={i} onClick={() => setSelectedDay(i)}
                style={{ whiteSpace: 'nowrap', padding: '.5rem 1rem', borderRadius: '.75rem', fontSize: '.875rem', fontWeight: 500, background: active ? '#5B3F8D' : '#fff', color: active ? '#fff' : 'var(--gray-600)', border: active ? undefined : '1px solid var(--gray-200)' }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button style={{ padding: '.5rem', borderRadius: '.75rem' }}><Icon name="chevron-right" className="icon icon-18" /></button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-2">
          {slots.map((s, i) => (
            s.patient ? (
              <div className="flex items-center gap-3" style={{ padding: '.75rem', borderRadius: '.75rem', background: '#fff', boxShadow: '0 1px 2px rgba(16,24,40,.06)', border: '1px solid var(--gray-100)' }} key={i}>
                <div className="text-xs font-mono font-semibold text-gray-500" style={{ width: '4rem', flexShrink: 0 }}>{s.time}</div>
                <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '.75rem', background: 'var(--purple-100)', color: 'var(--purple-700)' }}>{initials(s.patient)}</div>
                <div className="flex-1"><div className="text-sm font-semibold text-gray-800">{s.patient}</div></div>
                <div className="flex items-center gap-2">
                  {s.type === 'telemedicine' && <Icon name="video" className="icon icon-13 text-blue-500" />}
                  {s.status && <Badge status={s.status} />}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3" style={{ padding: '.75rem', borderRadius: '.75rem', background: 'var(--gray-50)', border: '1px dashed var(--gray-200)' }} key={i}>
                <div className="text-xs font-mono font-semibold text-gray-500" style={{ width: '4rem', flexShrink: 0 }}>{s.time}</div>
                <div className="flex-1 text-xs text-gray-400" style={{ fontStyle: 'italic' }}>Available slot</div>
              </div>
            )
          ))}
        </div>

        <div className="card p-5 h-fit">
          <h3 className="font-semibold text-gray-800 mb-4 font-heading">Availability Settings</h3>
          <div className="space-y-3">
            {WEEKDAY_NAMES.map((name, i) => (
              <div className="flex items-center justify-between" key={name}>
                <span className="text-sm text-gray-700">{name}</span>
                <label className="toggle sm"><input type="checkbox" checked={weeklyAvailability[i]} onChange={() => toggleDay(i)} /><span className="track" /></label>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 mb-2">Session hours</p>
            <div className="flex gap-2 text-sm">
              <input className="form-input" defaultValue="9:00 AM" style={{ fontSize: '.75rem' }} />
              <span className="text-gray-400" style={{ alignSelf: 'center' }}>to</span>
              <input className="form-input" defaultValue="5:00 PM" style={{ fontSize: '.75rem' }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
