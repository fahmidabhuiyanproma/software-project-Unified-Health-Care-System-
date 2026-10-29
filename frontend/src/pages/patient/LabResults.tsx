import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface LabResultRow { id: number; test: string; lab: string; date: string; status: string; result: string | null; file: boolean }

const API_URL = import.meta.env.VITE_API_URL as string;

/** Ports pages/patient/lab-results.html + js/patient.js's initLabResults(). */
export function LabResults() {
  const [results, setResults] = useState<LabResultRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiRequest<{ results: LabResultRow[] }>('get', '/api/patient/lab-results').then((res) => {
      setResults(res.ok ? res.data.results : []);
      setLoaded(true);
    });
  }, []);

  return (
    <>
      <div className="page-header"><div><h1>Lab Results</h1><p>View and download your diagnostic test results</p></div></div>

      <div className="space-y-4">
        {loaded && results.length === 0 && <div className="text-center text-gray-400 py-10">No lab bookings yet.</div>}
        {results.map((r) => {
          const when = new Date(`${r.date}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
          return (
            <div className="card p-5" key={r.id}>
              <div className="flex items-start gap-4">
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '.75rem', background: 'var(--blue-50)', color: 'var(--blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="flask-conical" className="icon icon-18" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800 font-heading">{r.test}</h3>
                    <Badge status={r.status} />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">{r.lab}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-3"><Icon name="clock" className="icon icon-11" /> {when}</div>
                  {r.result && (
                    <div className="rounded-xl text-sm text-gray-700 mb-3" style={{ background: 'var(--gray-50)', padding: '.75rem 1rem' }}>
                      <span className="font-medium">Result: </span>{r.result}
                    </div>
                  )}
                  {r.status !== 'ready' && (
                    <div className="rounded-xl text-xs mb-3" style={{ background: 'var(--amber-50)', color: 'var(--amber-700)', padding: '.625rem 1rem', border: '1px solid var(--amber-100)' }}>
                      ⏳ Your result is being processed. You will be notified when it's ready.
                    </div>
                  )}
                  {r.file && (
                    <div className="flex gap-2">
                      <a href={`${API_URL}/api/patient/lab-results/${r.id}/file`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--gray-200)' }}>
                        <Icon name="eye" className="icon icon-13" /> View Report
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
