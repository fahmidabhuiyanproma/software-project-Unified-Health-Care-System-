import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';

const ROLES = [
  { role: 'patient', icon: 'user', color: '#5B3F8D', title: 'Patient', desc: 'Book appointments, manage your health records, order medicines' },
  { role: 'doctor', icon: 'stethoscope', color: '#8E5DAF', title: 'Doctor', desc: 'Manage your schedule, view patient records, conduct telemedicine' },
  { role: 'hospital', icon: 'building-2', color: '#B57BC4', title: 'Hospital / Clinic', desc: 'Manage doctors, departments, and appointment scheduling' },
  { role: 'lab', icon: 'flask-conical', color: '#5B3F8D', title: 'Diagnostic Lab', desc: 'Manage test catalog, bookings, and upload patient results' },
  { role: 'pharmacy', icon: 'shopping-bag', color: '#8E5DAF', title: 'Pharmacy', desc: 'Manage medicine catalog, stock levels, and customer orders' },
  { role: 'admin', icon: 'shield', color: '#B57BC4', title: 'System Admin', desc: 'Platform-wide oversight, provider approvals, and settings' },
] as const;

/** Ports pages/auth/role-select.html. */
export function RoleSelect() {
  const navigate = useNavigate();

  return (
    <div className="auth-page">
      <div className="p-4">
        <Link to="/" className="back-link"><Icon name="arrow-left" className="icon icon-16" /> Back to Home</Link>
      </div>

      <div className="flex flex-col items-center justify-center px-4 py-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="brand-mark" style={{ width: '2.25rem', height: '2.25rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 21s-6.716-4.29-9.428-8.114C.688 10.09 1.5 6 5 5c2.2-.14 3.6 1.02 4.5 2.3.2.29.6.29.8 0C11.2 6.02 12.6 4.86 14.8 5c3.5 1 4.312 5.09 2.428 7.886C18.716 16.71 12 21 12 21z" /></svg>
          </div>
          <span className="font-bold text-2xl font-heading" style={{ color: '#5B3F8D' }}>SynCura</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2 mt-4 text-center font-heading">Choose Your Account Type</h1>
        <p className="text-gray-500 mb-8 text-center">Select the option that best describes you. Provider accounts require admin approval.</p>

        <div className="role-grid">
          {ROLES.map((r) => (
            <button key={r.role} className="role-card" onClick={() => navigate(`/auth/register?role=${r.role}`)}>
              <div className="role-icon" style={{ background: `${r.color}18`, color: r.color }}>
                <Icon name={r.icon} className="icon icon-22" />
              </div>
              <h3>{r.title}</h3>
              <p>{r.desc}</p>
            </button>
          ))}
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Already have an account? <Link to="/auth/login" className="font-semibold" style={{ color: '#5B3F8D' }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
