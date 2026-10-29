import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { Icon } from '../components/Icon';

interface AppNotification {
  id: number; icon: string; title: string; body: string; read: boolean; time: string | null;
}

const ICON_COLORS: Record<string, [string, string]> = {
  calendar: ['#5B3F8D', '#F3F0FF'], 'flask-conical': ['#0369A1', '#E0F2FE'], 'shopping-bag': ['#16A34A', '#DCFCE7'],
  'user-check': ['#D97706', '#FEF3C7'], 'x-circle': ['#DC2626', '#FEE2E2'], 'message-circle': ['#8E5DAF', '#F3E8FF'],
  shield: ['#DC2626', '#FEE2E2'], 'bed-double': ['#0F766E', '#CCFBF1'], bell: ['#8E5DAF', '#F3E8FF'],
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/** Ports pages/notifications.html + js/notifications.js — shared by every role. */
export function Notifications() {
  const [list, setList] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const res = await apiRequest<{ notifications: AppNotification[] }>('get', '/api/notifications');
    setList(res.ok ? res.data.notifications : []);
    setLoaded(true);
  };

  useEffect(() => { load(); }, []);

  const unread = list.filter((n) => !n.read).length;

  const markAllRead = async () => {
    await apiRequest('post', '/api/notifications', { mark_all_read: true });
    load();
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Notifications</h1><p>{unread} unread</p></div>
        <button className="text-sm font-medium" style={{ color: '#5B3F8D' }} onClick={markAllRead}>Mark all as read</button>
      </div>

      <div className="space-y-3">
        {loaded && list.length === 0 && (
          <div className="card p-10 text-center text-gray-400">No notifications yet.</div>
        )}
        {list.map((n) => {
          const [fg, bg] = ICON_COLORS[n.icon] ?? ICON_COLORS.bell;
          return (
            <div className="card p-5" style={n.read ? undefined : { borderColor: 'var(--purple-100)' }} key={n.id}>
              <div className="flex items-start gap-4">
                <div className="stat-icon" style={{ width: '2.5rem', height: '2.5rem', background: bg, color: fg, flexShrink: 0 }}>
                  <Icon name={n.icon} className="icon icon-18" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold font-heading" style={{ color: n.read ? 'var(--gray-700)' : 'var(--gray-800)' }}>
                      {n.title}
                      {!n.read && <span style={{ display: 'inline-block', width: '.5rem', height: '.5rem', borderRadius: '9999px', background: '#5B3F8D', marginLeft: '.5rem', verticalAlign: 'middle' }} />}
                    </h3>
                    <span className="text-xs text-gray-400" style={{ whiteSpace: 'nowrap' }}>{timeAgo(n.time)}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{n.body}</p>
                </div>
                {n.read && <Icon name="check-circle" className="icon icon-14 text-gray-300" style={{ marginTop: '2px' }} />}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
