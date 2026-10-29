import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';

interface PlatformUser {
  id: number; name: string; email: string; role: string; joined: string; status: string; rawStatus: string;
}

/** Ports pages/system-admin/users.html + js/system-admin.js's initUsers(). */
export function SystemAdminUsers() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [addAdminError, setAddAdminError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async (query: string) => {
    const res = await apiRequest<{ users: PlatformUser[] }>('get', `/api/system-admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    setUsers(res.ok ? res.data.users : []);
  };

  useEffect(() => { load(''); }, []);

  const onSearch = (value: string) => {
    setQ(value);
    load(value);
  };

  const toggleStatus = async (u: PlatformUser) => {
    setBusyId(u.id);
    const willSuspend = u.rawStatus !== 'suspended';
    const res = await apiRequest('put', '/api/system-admin/users/status', { user_id: u.id, status: willSuspend ? 'suspended' : 'active' });
    setBusyId(null);
    if (!res.ok) {
      alert(res.data.message ?? 'Could not update user.');
      return;
    }
    load(q);
  };

  const submitAddAdmin = async () => {
    setAddAdminError(null);
    setSubmitting(true);
    const res = await apiRequest<{ login: { phone: string; temp_password: string } }>('post', '/api/system-admin/create-admin', {
      full_name: fullName.trim(), email: email.trim(), phone: phone.trim(),
    });
    setSubmitting(false);
    if (!res.ok) {
      setAddAdminError(res.data.message ?? 'Could not add admin.');
      return;
    }
    alert(`Admin account created.\nLogin phone: ${res.data.login.phone}\nTemporary password: ${res.data.login.temp_password}`);
    setShowAddAdmin(false);
    setFullName(''); setEmail(''); setPhone('');
    load(q);
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Manage Users &amp; Roles</h1><p>{users.length} total users on the platform</p></div>
        <button className="btn btn-brand btn-md" onClick={() => setShowAddAdmin(true)}>
          <Icon name="shield-plus" className="icon icon-16" /> Add Admin
        </button>
      </div>

      <div className="relative mb-6">
        <Icon name="search" className="icon icon-16 text-gray-400" style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)' }} />
        <input className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="Search users..." value={q} onChange={(e) => onSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table className="data-table min-w-640">
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8">No users found.</td></tr>
            )}
            {users.map((u) => {
              const suspended = u.rawStatus === 'suspended';
              return (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '.75rem', background: 'var(--purple-100)', color: 'var(--purple-700)' }}>{u.name[0] || '?'}</div>
                      <span className="font-semibold text-gray-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="text-gray-500" style={{ fontSize: '.75rem' }}>{u.email}</td>
                  <td><span style={{ background: 'var(--purple-50)', color: 'var(--purple-700)', fontSize: '.75rem', padding: '.25rem .5rem', borderRadius: '.5rem' }}>{u.role}</span></td>
                  <td className="text-gray-500" style={{ fontSize: '.75rem' }}>{u.joined}</td>
                  <td><Badge status={u.status} /></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" disabled={busyId === u.id} onClick={() => toggleStatus(u)} style={{ border: '1px solid var(--gray-200)' }}>
                      <Icon name="shield" className="icon icon-12" /> {suspended ? 'Reactivate' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAddAdmin && (
        <Modal onClose={() => setShowAddAdmin(false)}>
          <h3>Add System Admin</h3>
          <div className="space-y-3">
            {addAdminError && <div className="text-sm" style={{ color: 'var(--red-600)' }}>{addAdminError}</div>}
            <input className="form-input" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input type="email" className="form-input" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="form-input" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="flex gap-3 pt-2">
              <button className="btn btn-ghost flex-1" onClick={() => setShowAddAdmin(false)}>Cancel</button>
              <button className="btn btn-brand flex-1" disabled={submitting} onClick={submitAddAdmin}>Add Admin</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
