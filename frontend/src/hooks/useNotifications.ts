import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export interface AppNotification {
  id: number;
  icon: string;
  title: string;
  body: string;
  read: boolean;
  time: string | null;
}

/** Ports app.js's pollNotifications()/startNotificationPolling(): 15s poll, unread count, and a toast for anything new since last seen (per role, in localStorage). */
export function useNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const lastSeenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const key = `syncura_last_notif_${user.role}`;
    try {
      const stored = localStorage.getItem(key);
      lastSeenRef.current = stored !== null ? Number(stored) : null;
    } catch {
      lastSeenRef.current = null;
    }

    let cancelled = false;

    const poll = async () => {
      const result = await apiRequest<{ notifications: AppNotification[] }>('get', '/api/notifications');
      if (cancelled || !result.ok) return;

      const list = result.data.notifications;
      setUnreadCount(list.filter((n) => !n.read).length);

      const maxId = list.reduce((m, n) => Math.max(m, n.id), 0);
      if (lastSeenRef.current !== null) {
        const fresh = list.filter((n) => !n.read && n.id > lastSeenRef.current!).sort((a, b) => a.id - b.id);
        if (fresh.length > 0) {
          setToast(fresh[fresh.length - 1]);
        }
      }
      lastSeenRef.current = maxId;
      try {
        localStorage.setItem(key, String(maxId));
      } catch {
        /* ignore */
      }
    };

    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  return { unreadCount, toast, dismissToast: () => setToast(null) };
}
