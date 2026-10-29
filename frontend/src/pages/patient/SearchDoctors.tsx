import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';

interface DoctorCard {
  id: number; name: string; specialty: string; hospital: string; location: string;
  exp: string; fee: string; available: boolean; img: string; rating: number; reviews: number;
}

const SPECIALTIES = ['All Specialties', 'Cardiologist', 'Dermatologist', 'Gynecologist', 'Pediatrician', 'Neurologist', 'Orthopedic'];

/** Ports pages/patient/search-doctors.html + js/patient.js's initSearchDoctors() (FR-2.2). */
export function SearchDoctors() {
  const [q, setQ] = useState('');
  const [specialty, setSpecialty] = useState('All Specialties');
  const [availOnly, setAvailOnly] = useState(false);
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (specialty && specialty !== 'All Specialties') params.set('specialty', specialty);
    if (availOnly) params.set('available_only', '1');

    const t = setTimeout(() => {
      apiRequest<{ doctors: DoctorCard[] }>('get', `/api/patient/doctors?${params.toString()}`).then((res) => {
        setDoctors(res.ok ? res.data.doctors : []);
        setLoaded(true);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q, specialty, availOnly]);

  return (
    <>
      <div className="page-header"><div><h1>Find Doctors</h1><p>Search by name, specialty, or hospital</p></div></div>

      <div className="card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Icon name="search" className="icon icon-16 text-gray-400" style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="Search doctor, hospital, or specialty..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="form-select" style={{ maxWidth: 220 }} value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            {SPECIALTIES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-2 form-input" style={{ maxWidth: 200, cursor: 'pointer' }}>
            <input type="checkbox" className="accent-purple-700" checked={availOnly} onChange={(e) => setAvailOnly(e.target.checked)} />
            <span className="text-gray-600">Available only</span>
          </label>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4"><span className="font-semibold text-gray-700">{doctors.length}</span> doctors found</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {doctors.map((doc) => (
          <div className="card" style={{ overflow: 'hidden' }} key={doc.id}>
            <div className="p-5">
              <div className="flex items-start gap-4 mb-4">
                <img src={doc.img} alt="" style={{ width: '4rem', height: '4rem', borderRadius: '1rem', objectFit: 'cover', background: 'var(--purple-100)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 font-heading">{doc.name}</h3>
                  <p className="text-sm font-medium" style={{ color: 'var(--purple-700)' }}>{doc.specialty}</p>
                  <p className="text-gray-500 text-xs mt-1">{doc.hospital}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <div className="flex items-center gap-1"><Icon name="map-pin" className="icon icon-11" /> {doc.location || '—'}</div>
                <div className="flex items-center gap-1"><Icon name="clock" className="icon icon-11" /> {doc.exp} exp.</div>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1"><span className="text-star">★</span><span className="text-sm font-semibold text-gray-800">{doc.rating}</span><span className="text-xs text-gray-400">({doc.reviews})</span></div>
                <div className="text-sm font-bold" style={{ color: '#5B3F8D' }}>{doc.fee} / visit</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs" style={{ padding: '.375rem .625rem', borderRadius: '.5rem', background: doc.available ? 'var(--green-50)' : 'var(--red-50)', color: doc.available ? 'var(--green-700)' : 'var(--red-600)' }}>
                  <span style={{ width: '.375rem', height: '.375rem', borderRadius: '9999px', background: doc.available ? 'var(--green-500)' : '#f87171' }} />
                  {doc.available ? 'Available Today' : 'Not Available'}
                </div>
                <div className="flex-1" />
                <Link to={`/patient/doctors/${doc.id}`} className="btn btn-secondary btn-sm">View Profile</Link>
                {doc.available && <Link to={`/patient/book-appointment?id=${doc.id}`} className="btn btn-brand btn-sm">Book</Link>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {loaded && doctors.length === 0 && (
        <div className="text-center py-20">
          <Icon name="filter" className="icon icon-40 text-gray-200" />
          <p className="text-gray-500 mt-4">No doctors match your search. Try different filters.</p>
        </div>
      )}
    </>
  );
}
