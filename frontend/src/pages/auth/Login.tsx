import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME } from '../../components/ProtectedRoute';

/** Ports pages/auth/login.html + js/auth.js's initLogin(). */
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(params.get('expired') ? 'Your session expired. Please sign in again.' : null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await login(identifier.trim(), password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate(ROLE_HOME[result.user.role]);
  };

  return (
    <div className="login-shell">
      <aside className="login-aside">
        <div className="flex items-center gap-2">
          <div style={{ width: '2rem', height: '2rem', borderRadius: '.5rem', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 21s-6.716-4.29-9.428-8.114C.688 10.09 1.5 6 5 5c2.2-.14 3.6 1.02 4.5 2.3.2.29.6.29.8 0C11.2 6.02 12.6 4.86 14.8 5c3.5 1 4.312 5.09 2.428 7.886C18.716 16.71 12 21 12 21z" /></svg>
          </div>
          <span className="font-bold text-white text-xl font-heading">SynCura</span>
        </div>
        <div>
          <h2>Welcome back to Bangladesh's healthcare platform.</h2>
          <p>Secure access to appointments, records, pharmacy, and more.</p>
        </div>
        <div style={{ color: '#d8b4fe', fontSize: '.875rem' }}>© 2026 SynCura Health Technologies Ltd.</div>
      </aside>

      <div className="login-form-col">
        <div className="login-form-inner">
          <Link to="/" className="back-link mb-8" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
            <Icon name="arrow-left" className="icon icon-16" /> Back to Home
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 mb-1 font-heading">Sign In</h1>
          <p className="text-gray-500 text-sm mb-8">Access your SynCura account</p>

          <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
            <div className="form-group">
              <label className="form-label">Email or Phone Number<span className="req">*</span></label>
              <input
                type="text" className="form-input" placeholder="Enter your email" required
                autoComplete="off"
                value={identifier} onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password<span className="req">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} className="form-input" placeholder="Enter your password"
                  style={{ paddingRight: '2.75rem' }} required
                  autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button" className="absolute" onClick={() => setShowPassword((v) => !v)}
                  style={{ right: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} className="icon icon-18" />
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" className="text-sm font-medium" style={{ color: '#5B3F8D' }}>Forgot password?</button>
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-xl" style={{ padding: '.75rem 1rem' }}>{error}</div>
            )}
            <button type="submit" className="btn btn-brand btn-lg w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Don't have an account? <Link to="/auth/role-select" className="font-semibold" style={{ color: '#5B3F8D' }}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
