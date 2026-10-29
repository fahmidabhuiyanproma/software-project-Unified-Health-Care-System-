import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';

interface DoctorDetail {
  id: number; name: string; specialty: string; hospital: string; location: string;
  exp: string; fee: string; feeAmount: number; bio: string; qualification: string; img: string;
  weeklyAvailability: boolean[]; todaySlots: { time: string; available: boolean }[];
}

/** Ports pages/patient/doctor-profile.html + js/patient.js's initDoctorProfile(). */
export function DoctorProfile() {
  const { id = '1' } = useParams();
  const [doc, setDoc] = useState<DoctorDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setDoc(null);
    setNotFound(false);
    apiRequest<{ doctor: DoctorDetail }>('get', `/api/patient/doctors/${id}`).then((res) => {
      if (res.ok) setDoc(res.data.doctor);
      else setNotFound(true);
    });
  }, [id]);

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/patient/search-doctors" className="back-link mb-6" style={{ display: 'inline-flex', marginBottom: '1.5rem' }}>
        <Icon name="arrow-left" className="icon icon-16" /> Back to Search
      </Link>

      {notFound && <div className="card p-6">Doctor not found.</div>}

      {doc && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="card p-6">
              <div className="flex gap-5 mb-5">
                <img src={doc.img} alt="" style={{ width: '6rem', height: '6rem', borderRadius: '1rem', objectFit: 'cover', background: 'var(--purple-100)', flexShrink: 0 }} />
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-gray-800 font-heading">{doc.name}</h1>
                  <p className="font-medium" style={{ color: 'var(--purple-700)' }}>{doc.specialty}</p>
                  <p className="text-gray-500 text-sm">{doc.hospital}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                    <div className="flex items-center gap-1"><Icon name="map-pin" className="icon icon-13" /> {doc.location || '—'}</div>
                    <div className="flex items-center gap-1"><Icon name="clock" className="icon icon-13" /> {doc.exp} exp.</div>
                  </div>
                  <div className="flex items-center gap-3 mt-2"><Badge status="confirmed" /></div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-800 mb-2 font-heading">About</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{doc.bio}</p>
              </div>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 font-heading">
                <Icon name="award" className="icon icon-16" style={{ color: 'var(--purple-600)' }} /> Qualification
              </h3>
              <div className="flex items-start gap-3">
                <Icon name="check-circle" className="icon icon-15 text-green-500" style={{ marginTop: '2px' }} />
                <span className="text-sm text-gray-600">{doc.qualification || 'Not specified'}</span>
              </div>
            </div>
          </div>
          <div className="space-y-5">
            <div className="card p-6">
              <div className="text-2xl font-bold mb-1 font-heading" style={{ color: '#5B3F8D' }}>{doc.fee}</div>
              <div className="text-gray-500 text-sm mb-5">per consultation visit</div>
              <Link to={`/patient/book-appointment?id=${doc.id}`} className="btn btn-brand btn-md w-full flex items-center justify-center gap-2">
                <Icon name="calendar" className="icon icon-16" /> Book Appointment
              </Link>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold text-gray-800 mb-4 font-heading">Available Slots — Today</h3>
              <div className="grid grid-cols-2 gap-2">
                {doc.todaySlots.filter((s) => s.available).map((s) => (
                  <Link
                    key={s.time} to={`/patient/book-appointment?id=${doc.id}&slot=${encodeURIComponent(s.time)}`}
                    className="text-xs font-medium" style={{ padding: '.5rem', borderRadius: '.5rem', border: '1px solid var(--purple-200)', color: 'var(--purple-700)', textAlign: 'center' }}
                  >
                    {s.time}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
