import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface RecordPatient { id: number; name: string; phone: string | null; email: string | null }
interface HistoryItem { title: string; description: string; vitals: string | null; visit_date: string }

function initials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Ports pages/doctor/patient-record.html + js/doctor.js's initPatientRecord() (FR-4.2, FR-4.4). */
export function DoctorPatientRecord() {
  const [params] = useSearchParams();
  const patientId = params.get('patient_id');

  const [patient, setPatient] = useState<RecordPatient | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [tab, setTab] = useState<'history' | 'add'>('history');

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [bp, setBp] = useState('');
  const [pulse, setPulse] = useState('');
  const [temp, setTemp] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!patientId) return;
    const res = await apiRequest<{ patient: RecordPatient; history: HistoryItem[] }>('get', `/api/doctor/patient-record?patient_id=${patientId}`);
    if (!res.ok) {
      setAccessError(res.data.message ?? 'Could not load this record.');
      return;
    }
    setPatient(res.data.patient);
    setHistory(res.data.history);
  };

  useEffect(() => { load(); }, [patientId]);

  const resetForm = () => {
    setChiefComplaint(''); setBp(''); setPulse(''); setTemp(''); setDiagnosis(''); setPrescription(''); setNotes('');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!diagnosis.trim() || !patientId) return;
    setError(null);
    setSaving(true);

    const vitals = [
      bp.trim() ? `BP: ${bp.trim()}` : '',
      pulse.trim() ? `Pulse: ${pulse.trim()}` : '',
      temp.trim() ? `Temp: ${temp.trim()}` : '',
    ].filter(Boolean).join(', ');

    const res = await apiRequest('post', '/api/doctor/patient-record', {
      patient_id: Number(patientId), chief_complaint: chiefComplaint.trim(), vitals,
      diagnosis: diagnosis.trim(), prescription: prescription.trim(), notes: notes.trim(),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.data.message ?? 'Could not save this note.');
      return;
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      resetForm();
      setTab('history');
      load();
    }, 1200);
  };

  if (!patientId) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card p-6 text-center text-gray-400">No patient selected.</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/doctor/patients" className="back-link mb-6" style={{ display: 'inline-flex', marginBottom: '1.5rem' }}>
        <Icon name="arrow-left" className="icon icon-16" /> Back to Patients
      </Link>

      {accessError && !patient ? (
        <div className="card p-6 text-center text-gray-400">{accessError}</div>
      ) : patient ? (
        <>
          <div className="card p-5 mb-6 flex items-start gap-4">
            <div className="avatar" style={{ width: '3.5rem', height: '3.5rem', fontSize: '1.25rem' }}>{initials(patient.name)}</div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800 font-heading">{patient.name}</h1>
              <div className="text-sm text-gray-500 mt-1">{patient.phone || ''}</div>
            </div>
            <div className="text-right text-xs text-gray-400">
              <div>{patient.phone ? `Phone: ${patient.phone}` : ''}</div>
              <div className="mt-1">Patient ID: {patient.id}</div>
            </div>
          </div>

          <div className="flex gap-2 mb-6 card p-1 max-w-xs">
            {(['history', 'add'] as const).map((t) => (
              <button
                key={t} className="flex-1" onClick={() => setTab(t)}
                style={{ padding: '.5rem', borderRadius: '.75rem', fontSize: '.875rem', fontWeight: 600, background: tab === t ? '#5B3F8D' : 'transparent', color: tab === t ? '#fff' : 'var(--gray-500)' }}
              >
                {t === 'history' ? 'Visit History' : '+ Add Note'}
              </button>
            ))}
          </div>

          {tab === 'history' && (
            <div className="space-y-4">
              {history.length === 0 && <div className="card p-6 text-center text-gray-400">No visit history yet.</div>}
              {history.map((h, i) => {
                const when = new Date(`${h.visit_date}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <div className="card p-5" key={i}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-gray-800">{when}</div>
                      <Badge status="completed" />
                    </div>
                    <div className="space-y-2 text-sm">
                      <div style={{ whiteSpace: 'pre-line' }} className="text-gray-800">{h.description}</div>
                      {h.vitals && <div><span className="text-gray-500 font-medium">Vitals: </span><span className="text-gray-800">{h.vitals}</span></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'add' && (
            <form className="card p-6 space-y-4" onSubmit={onSubmit}>
              <h3 className="font-semibold text-gray-800 font-heading">Add Visit Note — {patient.name}</h3>
              {saved && (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#15803d', background: 'var(--green-50)', padding: '.75rem 1rem', borderRadius: '.75rem', border: '1px solid #bbf7d0' }}>
                  <Icon name="check-circle" className="icon icon-16" /> Note saved successfully
                </div>
              )}
              {error && <div className="text-sm" style={{ color: 'var(--red-600)' }}>{error}</div>}
              <div className="form-group"><label className="form-label">Chief Complaint<span className="req">*</span></label><input className="form-input" placeholder="e.g., Chest pain, shortness of breath" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} /></div>
              <div className="form-group">
                <label className="form-label">Vitals</label>
                <div className="grid grid-cols-3 gap-2">
                  <input className="form-input" placeholder="BP (mmHg)" value={bp} onChange={(e) => setBp(e.target.value)} />
                  <input className="form-input" placeholder="Pulse (bpm)" value={pulse} onChange={(e) => setPulse(e.target.value)} />
                  <input className="form-input" placeholder="Temp (°C)" value={temp} onChange={(e) => setTemp(e.target.value)} />
                </div>
              </div>
              <div className="form-group"><label className="form-label">Diagnosis<span className="req">*</span></label><textarea rows={2} className="form-textarea" placeholder="e.g., Hypertensive heart disease, Stable angina..." value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Prescription</label><textarea rows={3} className="form-textarea" placeholder="Tab. Losartan 50mg — 1 daily x 30 days" value={prescription} onChange={(e) => setPrescription(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Doctor's Notes / Advice</label><textarea rows={2} className="form-textarea" placeholder="Low-sodium diet, exercise 30 min daily, follow-up in 4 weeks..." value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setTab('history')}>Cancel</button>
                <button type="submit" className="btn btn-brand flex-1" disabled={!diagnosis.trim() || saving}><Icon name="plus" className="icon icon-15" /> Save Note</button>
              </div>
            </form>
          )}
        </>
      ) : null}
    </div>
  );
}
