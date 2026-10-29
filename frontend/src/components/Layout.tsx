import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { useAuth, type Role } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../hooks/useNotifications';

interface MenuItem {
  label: string;
  icon: string;
  to: string;
}

/** Ports app.js's menuByRole. */
const MENU_BY_ROLE: Record<Role, MenuItem[]> = {
  patient: [
    { label: 'Dashboard', icon: 'home', to: '/patient/dashboard' },
    { label: 'AI Consultation', icon: 'brain-circuit', to: '/patient/ai-consultation' },
    { label: 'Find Doctors', icon: 'search', to: '/patient/search-doctors' },
    { label: 'Appointments', icon: 'calendar', to: '/patient/appointments' },
    { label: 'Medical Records', icon: 'file-text', to: '/patient/medical-records' },
    { label: 'Telemedicine', icon: 'video', to: '/patient/telemedicine' },
    { label: 'Pharmacy', icon: 'shopping-bag', to: '/patient/pharmacy' },
    { label: 'Lab Tests', icon: 'flask-conical', to: '/patient/lab-tests' },
    { label: 'Lab Results', icon: 'clipboard-list', to: '/patient/lab-results' },
    { label: 'Bed Booking', icon: 'bed-double', to: '/patient/bed-booking' },
    { label: 'Notifications', icon: 'bell', to: '/notifications' },
  ],
  doctor: [
    { label: 'Dashboard', icon: 'home', to: '/doctor/dashboard' },
    { label: 'My Schedule', icon: 'calendar', to: '/doctor/schedule' },
    { label: 'My Patients', icon: 'users', to: '/doctor/patients' },
    { label: 'Notifications', icon: 'bell', to: '/notifications' },
  ],
  hospital: [
    { label: 'Dashboard', icon: 'home', to: '/hospital-admin/dashboard' },
    { label: 'Manage Doctors', icon: 'stethoscope', to: '/hospital-admin/doctors' },
    { label: 'Doctor Approvals', icon: 'user-check', to: '/hospital-admin/approvals' },
    { label: 'Departments', icon: 'building-2', to: '/hospital-admin/departments' },
    { label: 'Appointments', icon: 'calendar', to: '/hospital-admin/appointments' },
    { label: 'Bed Requests', icon: 'bed-double', to: '/hospital-admin/beds' },
    { label: 'Notifications', icon: 'bell', to: '/notifications' },
  ],
  lab: [
    { label: 'Dashboard', icon: 'home', to: '/lab-admin/dashboard' },
    { label: 'Test Catalog', icon: 'flask-conical', to: '/lab-admin/catalog' },
    { label: 'Bookings', icon: 'clipboard-list', to: '/lab-admin/bookings' },
    { label: 'Notifications', icon: 'bell', to: '/notifications' },
  ],
  pharmacy: [
    { label: 'Dashboard', icon: 'home', to: '/pharmacy-admin/dashboard' },
    { label: 'Medicine Catalog', icon: 'package', to: '/pharmacy-admin/catalog' },
    { label: 'Orders', icon: 'shopping-bag', to: '/pharmacy-admin/orders' },
    { label: 'Notifications', icon: 'bell', to: '/notifications' },
  ],
  admin: [
    { label: 'Dashboard', icon: 'bar-chart-3', to: '/system-admin/dashboard' },
    { label: 'Provider Approvals', icon: 'user-check', to: '/system-admin/approvals' },
    { label: 'Manage Users', icon: 'users', to: '/system-admin/users' },
    { label: 'Platform Settings', icon: 'settings', to: '/system-admin/settings' },
    { label: 'Notifications', icon: 'bell', to: '/notifications' },
  ],
};

const ROLE_LABELS: Record<Role, string> = {
  patient: 'Patient Portal', doctor: 'Doctor Portal', hospital: 'Hospital Admin',
  lab: 'Lab Admin', pharmacy: 'Pharmacy Admin', admin: 'System Admin',
};

const NAV_USER_LABEL: Record<Role, string> = {
  patient: 'Patient', doctor: 'Dr.', hospital: 'Hospital Admin',
  lab: 'Lab Admin', pharmacy: 'Pharmacy Admin', admin: 'System Admin',
};

function initials(name: string): string {
  if (!name) return '?';
  const parts = name.replace(/^Dr\.\s*/, '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount, toast, dismissToast } = useNotifications();
  const { totalQty: cartQty } = useCart();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 6000);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!user) return null;

  const items = MENU_BY_ROLE[user.role];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const avatarStyle = user.avatar
    ? { backgroundImage: `url("${encodeURI(user.avatar)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop${sidebarOpen ? ' show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-head">
          <div>
            <div className="sidebar-brand">SynCura</div>
            <div className="sidebar-role">{ROLE_LABELS[user.role]}</div>
          </div>
          <button className="sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>
            <Icon name="x" className="icon" />
          </button>
        </div>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon name={item.icon} className="icon" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Icon name="shield" className="icon" />
          <span>HIPAA Compliant &middot; Secure</span>
        </div>
      </aside>

      <div className="shell-main">
        <header className="navbar">
          <button className="navbar-menu-btn" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
            <Icon name="menu" className="icon" />
          </button>
          <div className="flex-1" />
          <Link to="/notifications" className="navbar-icon-btn" aria-label="Notifications">
            <Icon name="bell" className="icon" />
            {unreadCount > 0 && <span className="navbar-badge">{unreadCount}</span>}
          </Link>
          {cartQty > 0 && (
            <Link to="/patient/pharmacy" className="navbar-icon-btn" aria-label="Cart">
              🛒<span className="navbar-badge cart">{cartQty}</span>
            </Link>
          )}
          <div className="navbar-user">
            <button className="navbar-user-btn" onClick={() => setDropdownOpen((v) => !v)}>
              <span className="avatar avatar-round" style={{ width: '2rem', height: '2rem', fontSize: '.8rem', ...avatarStyle }}>
                {!user.avatar && initials(user.name)}
              </span>
              <span className="navbar-user-name">{NAV_USER_LABEL[user.role]} {user.name}</span>
              <Icon name="chevron-down" className="icon" style={{ color: 'var(--gray-400)' }} />
            </button>
            {dropdownOpen && (
              <div className="navbar-dropdown">
                <button className="navbar-dropdown-item" onClick={() => { setDropdownOpen(false); navigate('/profile'); }}>
                  <Icon name="user" className="icon" /> Profile
                </button>
                <hr />
                <button className="navbar-dropdown-item danger" onClick={handleLogout}>
                  <Icon name="log-out" className="icon" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      {toast && (
        <div
          onClick={() => { dismissToast(); navigate('/notifications'); }}
          style={{
            position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, maxWidth: '20rem',
            background: '#fff', borderLeft: '4px solid #5B3F8D', borderRadius: '.75rem',
            boxShadow: '0 10px 30px rgba(16,24,40,.18)', padding: '.75rem 1rem', cursor: 'pointer',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '.875rem', color: '#1f2937' }}>{toast.title}</div>
          <div style={{ fontSize: '.75rem', color: '#6b7280', marginTop: '.125rem' }}>{toast.body}</div>
        </div>
      )}
    </div>
  );
}
