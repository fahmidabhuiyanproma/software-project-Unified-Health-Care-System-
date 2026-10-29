import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME } from '../../components/ProtectedRoute';
import type { Role } from '../../context/AuthContext';

const PROVIDER_ROLES: Role[] = ['doctor', 'hospital', 'lab', 'pharmacy'];

interface HospitalOption { id: number; name: string; city: string | null }
interface DepartmentOption { id: number; name: string }

/** Ports pages/auth/register.html + js/auth.js's initRegister(). */
export function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const role = (params.get('role') as Role) || 'patient';
  const isProvider = PROVIDER_ROLES.includes(role);
  const isDoctor = role === 'doctor';

  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [license, setLicense] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ title: string; body: string; showBackToLogin: boolean } | null>(null);

  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  useEffect(() => {
    if (!isDoctor) return;
    apiRequest<{ hospitals: HospitalOption[] }>('get', '/api/hospitals').then((res) => {
      if (res.ok) setHospitals(res.data.hospitals);
    });
  }, [isDoctor]);

  useEffect(() => {
    if (!isDoctor || !hospitalId) {
      setDepartments([]);
      return;
    }
    setDepartmentsLoading(true);
    apiRequest<{ departments: DepartmentOption[] }>('get', `/api/hospitals?hospital_id=${hospitalId}`).then((res) => {
      setDepartmentsLoading(false);
      if (res.ok) setDepartments(res.data.departments);
    });
  }, [isDoctor, hospitalId]);

  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      if (!fullName.trim() || !phone.trim()) {
        setError('Full name and phone number are required.');
        return;
      }
      if (isProvider && !license.trim()) {
        setError(isDoctor ? 'BMDC registration number is required.' : 'Organization / License number is required.');
        return;
      }
      if (isDoctor && (!hospitalId || !departmentId)) {
        setError('Please select your hospital and department.');
        return;
      }
      setStep(2);
      return;
    }

    if (!password || !confirmPassword) {
      setError('Please create and confirm your password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const payload: Record<string, unknown> = {
      full_name: fullName, phone, email, password, confirm_password: confirmPassword,
      role, license_number: isProvider ? license : '',
    };
    if (isDoctor) {
      payload.hospital_id = Number(hospitalId) || 0;
      payload.department_id = Number(departmentId) || 0;
    }

    const result = await apiRequest<{ status: string; role: string; message: string }>('post', '/api/register', payload);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.data.message ?? 'Registration failed. Please try again.');
      return;
    }

    if (isProvider) {
      setDone({ title: 'Application Submitted!', body: result.data.message, showBackToLogin: true });
    } else {
      setDone({ title: 'Welcome to SynCura!', body: result.data.message, showBackToLogin: false });
      const loginResult = await login(phone, password);
      if (loginResult.ok) {
        setTimeout(() => navigate(ROLE_HOME[loginResult.user.role]), 1400);
      }
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="flex flex-col items-center justify-center px-4 py-10">
          <div style={{ width: '100%', maxWidth: '28rem' }}>
            <div className="card result-card p-10 text-center">
              <div className="result-icon-ok"><Icon name="check-circle" className="icon icon-32" /></div>
              <h2 className="result-title text-xl font-bold text-gray-800 mb-3 font-heading">{done.title}</h2>
              <p className="result-body text-gray-500">{done.body}</p>
              {done.showBackToLogin && (
                <Link to="/auth/login" className="btn btn-brand result-back-login mt-6" style={{ display: 'inline-flex' }}>
                  Back to Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="flex flex-col items-center justify-center px-4 py-10">
        <div style={{ width: '100%', maxWidth: '28rem' }}>
          <Link to="/auth/role-select" className="back-link mb-8" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
            <Icon name="arrow-left" className="icon icon-16" /> Back
          </Link>
          <div className="flex items-center gap-2 mb-6">
            <div className="brand-mark" style={{ width: '2rem', height: '2rem' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M12 21s-6.716-4.29-9.428-8.114C.688 10.09 1.5 6 5 5c2.2-.14 3.6 1.02 4.5 2.3.2.29.6.29.8 0C11.2 6.02 12.6 4.86 14.8 5c3.5 1 4.312 5.09 2.428 7.886C18.716 16.71 12 21 12 21z" /></svg>
            </div>
            <span className="font-bold text-lg font-heading" style={{ color: '#5B3F8D' }}>SynCura</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1 font-heading">Create {roleTitle} Account</h1>
          <p className="text-gray-500 text-sm mb-8">Step {step} of 2 — {step === 1 ? 'Personal Information' : 'Verify & Confirm'}</p>

          <div className="progress-steps">
            <div className="seg done" />
            <div className={`seg${step >= 2 ? ' done' : ''}`} />
          </div>

          <form onSubmit={onSubmit} className="card p-6 space-y-4">
            {step === 1 && (
              <div>
                <div className="form-group mb-4">
                  <label className="form-label">Full Name<span className="req">*</span></label>
                  <input className="form-input" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="form-group mb-4">
                  <label className="form-label">Phone Number<span className="req">*</span></label>
                  <input className="form-input" placeholder="+880 17XX-XXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
                <div className="form-group mb-4">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-input" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {isDoctor && (
                  <div>
                    <div className="form-group mb-4">
                      <label className="form-label">Hospital<span className="req">*</span></label>
                      <select className="form-select" value={hospitalId} onChange={(e) => { setHospitalId(e.target.value); setDepartmentId(''); }}>
                        <option value="">Select your hospital</option>
                        {hospitals.map((h) => (
                          <option key={h.id} value={h.id}>{h.name}{h.city ? ` — ${h.city}` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group mb-4">
                      <label className="form-label">Department<span className="req">*</span></label>
                      <select className="form-select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={!hospitalId || departmentsLoading}>
                        <option value="">{!hospitalId ? 'Select hospital first' : departmentsLoading ? 'Loading…' : 'Select your department'}</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {isProvider && (
                  <div className="form-group">
                    <label className="form-label">{isDoctor ? 'BMDC Registration Number' : 'Organization / License Number'}<span className="req">*</span></label>
                    <input className="form-input" placeholder="e.g. BMDC-12345 or Hospital Reg. No." value={license} onChange={(e) => setLicense(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="form-group mb-4">
                  <label className="form-label">Create Password<span className="req">*</span></label>
                  <input type="password" className="form-input" placeholder="At least 8 characters" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="form-group mb-4">
                  <label className="form-label">Confirm Password<span className="req">*</span></label>
                  <input type="password" className="form-input" placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
                {isProvider && (
                  <div className="text-sm rounded-xl" style={{ background: '#fffbeb', color: '#92400e', padding: '.75rem 1rem', border: '1px solid var(--amber-100)' }}>
                    ⏳ Provider accounts are reviewed by our admin team and approved within 1–2 business days.
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-xl" style={{ padding: '.75rem 1rem', marginBottom: '1rem' }}>{error}</div>
            )}

            <button type="submit" className="btn btn-brand btn-lg w-full mt-2" disabled={submitting}>
              {submitting ? 'Please wait…' : step === 1 ? 'Continue' : (isProvider ? 'Submit Application' : 'Create Account')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already registered? <Link to="/auth/login" className="font-semibold" style={{ color: '#5B3F8D' }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
