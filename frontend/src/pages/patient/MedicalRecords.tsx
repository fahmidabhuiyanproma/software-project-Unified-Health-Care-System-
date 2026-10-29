import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';

interface MedicalRecord {
  id: number; type: string; title: string; desc: string | null; vitals: string | null;
  hasFile: boolean; date: string; doctor: string | null; hospital: string | null;
}

const TYPE_ICONS: Record<string, [string, string, string]> = {
  diagnosis: ['activity', '#5B3F8D', '#F3F0FF'],
  note: ['activity', '#5B3F8D', '#F3F0FF'],
  lab: ['flask-conical', '#0369A1', '#E0F2FE'],
  prescription: ['pill', '#16A34A', '#DCFCE7'],
  telemedicine: ['video', '#5B3F8D', '#F3F0FF'],
};

function hasPrescription(r: MedicalRecord): boolean {
  return /prescription:/i.test(r.desc || '');
}

/** Ports pages/patient/medical-records.html + js/patient.js's initMedicalRecords() (FR-4.3). */
export function MedicalRecords() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [q, setQ] = useState('');
  const [hospital, setHospital] = useState('');
  const [type, setType] = useState('');

  useEffect(() => {
    apiRequest<{ records: MedicalRecord[] }>('get', '/api/patient/medical-records').then((res) => {
      if (res.ok) setRecords(res.data.records);
    });
  }, []);

  const hospitals = useMemo(() => Array.from(new Set(records.map((r) => r.hospital).filter(Boolean))).sort() as string[], [records]);

  const matchesType = (r: MedicalRecord, t: string) => {
    if (!t) return true;
    if (t === 'lab') return r.type === 'lab';
    if (t === 'prescription') return hasPrescription(r);
    return r.type !== 'lab';
  };

  const filtered = records.filter((r) => {
    if (hospital && r.hospital !== hospital) return false;
    if (!matchesType(r, type)) return false;
    const needle = q.trim().toLowerCase();
    if (needle && !(`${r.title} ${r.desc || ''} ${r.doctor || ''}`).toLowerCase().includes(needle)) return false;
    return true;
  });

  return (
    <>
      <div className="page-header"><div><h1>Medical Records</h1><p>Your complete health history across all providers</p></div></div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input className="form-input flex-1" placeholder="Search records..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-select" style={{ maxWidth: 220 }} value={hospital} onChange={(e) => setHospital(e.target.value)}>
          <option value="">All Hospitals</option>
          {hospitals.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: 220 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          <option value="visit">Visits</option>
          <option value="lab">Lab Results</option>
          <option value="prescription">Prescriptions</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-4 text-center"><div className="text-2xl font-bold mb-1 font-heading" style={{ color: '#5B3F8D' }}>{records.length}</div><div className="text-xs text-gray-500">Total Visits</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold mb-1 font-heading" style={{ color: '#0369A1' }}>{records.filter((r) => r.type === 'lab').length}</div><div className="text-xs text-gray-500">Lab Tests</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold mb-1 font-heading" style={{ color: '#16A34A' }}>{records.filter(hasPrescription).length}</div><div className="text-xs text-gray-500">Prescriptions</div></div>
      </div>

      <div className="relative">
        <div style={{ position: 'absolute', left: '1.25rem', top: 0, bottom: 0, width: 2, background: 'var(--gray-200)' }} />
        <div className="space-y-6">
          {filtered.length === 0 && (
            <div className="text-center text-gray-400 py-10">{records.length ? 'No records match your search.' : 'No medical records yet.'}</div>
          )}
          {filtered.map((r) => {
            const [icon, fg, bg] = TYPE_ICONS[r.type] || TYPE_ICONS.note;
            const when = new Date(`${r.date}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            return (
              <div className="flex gap-4 relative" key={r.id}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, border: '2px solid #fff', background: bg, color: fg }}>
                  <Icon name={icon} className="icon icon-18" />
                </div>
                <div className="flex-1 card p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm font-heading">{r.title}</h3>
                      <p className="text-xs text-gray-400">{r.hospital || ''}{r.doctor ? ` · ${r.doctor}` : ''} · {when}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-1" style={{ whiteSpace: 'pre-line' }}>{r.desc || ''}</p>
                  {r.vitals && <p className="text-xs text-gray-500">{r.vitals}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
