import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';

/**
 * Ports pages/system-admin/settings.html + js/system-admin.js's initSettings().
 * Security/payment sections are decorative in the old page too (no ids, never
 * read or saved) — only platform name/currency/support email and the three
 * notification toggles are real, backed by platform_settings.
 */
export function SystemAdminSettings() {
  const [platformName, setPlatformName] = useState('SynCura');
  const [currency, setCurrency] = useState('BDT (৳)');
  const [supportEmail, setSupportEmail] = useState('');
  const [sms, setSms] = useState(true);
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(false);
  const [saveLabel, setSaveLabel] = useState('Save All Settings');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<{ settings: Record<string, string> }>('get', '/api/system-admin/settings').then((res) => {
      if (!res.ok) return;
      const s = res.data.settings;
      setPlatformName(s.platform_name || 'SynCura');
      setCurrency(s.currency || 'BDT (৳)');
      setSupportEmail(s.support_email || '');
      setSms(s.sms_notifications === '1');
      setEmail(s.email_notifications === '1');
      setPush(s.push_notifications === '1');
    });
  }, []);

  const save = async () => {
    setSaving(true);
    await apiRequest('put', '/api/system-admin/settings', {
      platform_name: platformName.trim(),
      currency: currency.trim(),
      support_email: supportEmail.trim(),
      sms_notifications: sms,
      email_notifications: email,
      push_notifications: push,
    });
    setSaving(false);
    setSaveLabel('Saved ✓');
    setTimeout(() => setSaveLabel('Save All Settings'), 1500);
  };

  return (
    <>
      <div className="page-header"><div><h1>Platform Settings</h1><p>Configure global SynCura platform parameters</p></div></div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '.75rem', background: 'var(--purple-50)', color: 'var(--purple-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="shield" className="icon icon-18" /></div>
            <h3 className="font-semibold text-gray-800 font-heading">Security Settings</h3>
          </div>
          <div className="space-y-4">
            {[
              ['Two-Factor Authentication (2FA)', 'Require 2FA for all admin and provider accounts'],
              ['Session Timeout', 'Auto-logout after 30 minutes of inactivity'],
              ['Audit Logging', 'Log all admin actions and data access'],
            ].map(([title, desc]) => (
              <div className="flex items-start justify-between gap-4" key={title}>
                <div><div className="text-sm font-medium text-gray-800">{title}</div><div className="text-xs text-gray-400 mt-0.5">{desc}</div></div>
                <label className="toggle" style={{ marginTop: '2px', flexShrink: 0 }}><input type="checkbox" defaultChecked /><span className="track" /></label>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '.75rem', background: 'var(--green-50)', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="credit-card" className="icon icon-18" /></div>
            <h3 className="font-semibold text-gray-800 font-heading">Payment Settings</h3>
          </div>
          <div className="space-y-3">
            <div className="text-sm rounded-xl" style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-200)', color: 'var(--amber-700)', padding: '.75rem 1rem' }}>⚠️ Currently in Sandbox / Test Mode</div>
            {['bKash Merchant API', 'Nagad Payment Gateway', 'Rocket (DBBL) Integration'].map((label, i) => (
              <div className="flex items-center justify-between" style={{ padding: '.5rem 0', borderBottom: i < 2 ? '1px solid var(--gray-100)' : undefined }} key={label}>
                <span className="text-sm text-gray-700">{label}</span>
                <span className="text-xs font-medium" style={{ background: 'var(--green-50)', color: '#15803d', padding: '.25rem .5rem', borderRadius: '.5rem' }}>Configured</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '.75rem', background: 'var(--blue-50)', color: 'var(--blue-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="globe" className="icon icon-18" /></div>
            <h3 className="font-semibold text-gray-800 font-heading">Platform Configuration</h3>
          </div>
          <div className="space-y-3">
            <div><label className="text-xs font-medium text-gray-500" style={{ display: 'block', marginBottom: '.25rem' }}>Platform Name</label><input className="form-input" value={platformName} onChange={(e) => setPlatformName(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-gray-500" style={{ display: 'block', marginBottom: '.25rem' }}>Default Currency</label><input className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-gray-500" style={{ display: 'block', marginBottom: '.25rem' }}>Support Email</label><input className="form-input" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} /></div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '.75rem', background: 'var(--orange-50)', color: 'var(--orange-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bell" className="icon icon-18" /></div>
            <h3 className="font-semibold text-gray-800 font-heading">Notification Settings</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div><div className="text-sm font-medium text-gray-800">SMS Notifications</div><div className="text-xs text-gray-400 mt-0.5">Send appointment reminders via SMS</div></div>
              <label className="toggle" style={{ marginTop: '2px', flexShrink: 0 }}><input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} /><span className="track" /></label>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div><div className="text-sm font-medium text-gray-800">Email Notifications</div><div className="text-xs text-gray-400 mt-0.5">Send receipts and reports via email</div></div>
              <label className="toggle" style={{ marginTop: '2px', flexShrink: 0 }}><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /><span className="track" /></label>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div><div className="text-sm font-medium text-gray-800">Push Notifications</div><div className="text-xs text-gray-400 mt-0.5">In-app push notifications</div></div>
              <label className="toggle" style={{ marginTop: '2px', flexShrink: 0 }}><input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} /><span className="track" /></label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button className="btn btn-brand btn-lg" disabled={saving} onClick={save}>{saveLabel}</button>
      </div>
    </>
  );
}
