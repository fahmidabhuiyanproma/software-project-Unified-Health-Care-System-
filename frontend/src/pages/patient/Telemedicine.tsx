import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';

interface TelemedicineMessage { from: string; text: string; time: string }
interface TelemedicineAppointment { id: number; doctor_name: string; specialty: string; patient_name: string; date: string; time: string }

/** Ports pages/patient/telemedicine.html + js/patient.js's initTelemedicine() (FR-5.1/5.2). Shared by Patient and Doctor. */
export function Telemedicine() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [appointmentId, setAppointmentId] = useState<number | null>(params.get('appointment_id') ? Number(params.get('appointment_id')) : null);
  const [appointment, setAppointment] = useState<TelemedicineAppointment | null>(null);
  const [messages, setMessages] = useState<TelemedicineMessage[]>([]);
  const [input, setInput] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [vidOn, setVidOn] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const url = appointmentId ? `/api/telemedicine?appointment_id=${appointmentId}` : '/api/telemedicine';
    const res = await apiRequest<{ appointment: TelemedicineAppointment | null; messages: TelemedicineMessage[] }>('get', url);
    if (res.ok && res.data.appointment) {
      setAppointment(res.data.appointment);
      setAppointmentId(res.data.appointment.id);
      setMessages(res.data.messages);
    } else {
      setAppointment(null);
      setMessages([]);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || !appointmentId) return;
    setInput('');
    await apiRequest('post', '/api/telemedicine', { appointment_id: appointmentId, message: text });
    load();
  };

  const otherLabel = appointment
    ? (user?.role === 'patient' ? `${appointment.doctor_name} · ${appointment.specialty}` : appointment.patient_name)
    : '';

  return (
    <>
      <div className="page-header"><div><h1>Telemedicine Session</h1><p>{appointment ? otherLabel : 'No upcoming telemedicine session'}</p></div></div>

      <div className="grid lg:grid-cols-3 gap-6 h-video">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex-1 min-h-300 relative overflow-hidden rounded-2xl" style={{ background: '#111827' }}>
            <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&h=500&fit=crop&auto=format" alt="Doctor" className="w-full h-full object-cover" style={{ position: 'absolute', inset: 0, opacity: 0.8 }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to top, rgba(0,0,0,.6), transparent)' }} />
            <div className="absolute" style={{ top: '1rem', left: '1rem', background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: '.75rem', padding: '.375rem .75rem', borderRadius: '.5rem' }}>{otherLabel}</div>
            <div className="absolute flex items-center gap-2" style={{ top: '1rem', right: '1rem', background: 'var(--green-500)', color: '#fff', fontSize: '.75rem', padding: '.25rem .625rem', borderRadius: '.5rem' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE · 00:04:32
            </div>
            <div className="absolute" style={{ bottom: '1rem', right: '1rem', width: '7rem', height: '5rem', background: '#1f2937', borderRadius: '.75rem', overflow: 'hidden', border: '2px solid rgba(255,255,255,.2)' }}>
              <div
                className="w-full h-full flex items-center justify-center text-white text-2xl font-bold"
                style={{ backgroundImage: vidOn ? 'linear-gradient(to bottom right,#6b21a8,#3b0764)' : undefined, background: vidOn ? undefined : '#374151' }}
              >
                {vidOn ? (user?.name?.[0] ?? 'U') : <Icon name="video-off" className="icon icon-18" />}
              </div>
            </div>
          </div>
          <div className="card p-4 flex items-center justify-center gap-4">
            <button className={`tm-ctrl${micOn ? '' : ' active-off'}`} style={micOn ? { background: 'var(--gray-100)', color: 'var(--gray-700)' } : undefined} onClick={() => setMicOn((v) => !v)}>
              <Icon name={micOn ? 'mic' : 'mic-off'} className="icon icon-20" />
            </button>
            <button className={`tm-ctrl${vidOn ? '' : ' active-off'}`} style={vidOn ? { background: 'var(--gray-100)', color: 'var(--gray-700)' } : undefined} onClick={() => setVidOn((v) => !v)}>
              <Icon name={vidOn ? 'video' : 'video-off'} className="icon icon-20" />
            </button>
            <button className="tm-ctrl" style={{ width: '3.5rem', height: '3.5rem', background: 'var(--red-500)', color: '#fff' }}>
              <Icon name="phone" className="icon icon-22" style={{ transform: 'rotate(135deg)' }} />
            </button>
            <button className="tm-ctrl" style={{ background: 'var(--purple-100)', color: 'var(--purple-700)' }}>
              <Icon name="message-circle" className="icon icon-20" />
            </button>
          </div>
        </div>

        <div className="card flex flex-col" style={{ minHeight: 300 }}>
          <div className="p-4 border-b"><h3 className="font-semibold text-gray-800 text-sm font-heading">Session Chat</h3><p className="text-xs text-gray-400">Messages are part of your medical record</p></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={chatRef}>
            {!appointment && <div className="text-center text-gray-400 py-10">No telemedicine session to show. Book a telemedicine appointment first.</div>}
            {messages.map((m, i) => {
              const mine = m.from === user?.role;
              return (
                <div className="flex flex-col" style={{ alignItems: mine ? 'flex-end' : 'flex-start' }} key={i}>
                  <div style={{ maxWidth: '85%', padding: '.625rem .75rem', borderRadius: '1rem', fontSize: '.875rem', lineHeight: 1.5, ...(mine ? { background: '#5B3F8D', color: '#fff', borderTopRightRadius: '.25rem' } : { background: 'var(--gray-100)', color: 'var(--gray-800)', borderTopLeftRadius: '.25rem' }) }}>
                    {m.text}
                  </div>
                  <span className="text-gray-400 mt-1" style={{ fontSize: 10 }}>{new Date(m.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t flex gap-2">
            <input
              className="form-input flex-1" placeholder="Type a message..." value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button disabled={!appointment} onClick={send} style={{ width: '2.5rem', height: '2.5rem', borderRadius: '.75rem', background: '#5B3F8D', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="send" className="icon icon-16" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
