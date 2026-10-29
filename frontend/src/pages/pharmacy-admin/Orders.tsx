import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Badge } from '../../components/Badge';

interface Order {
  id: string; order_id: number; patient: string; phone: string;
  items: string[]; total: string; date: string; time: string; status: string;
}

const STATUS_FLOW: Record<string, string> = { pending: 'processing', processing: 'delivered' };

/** Ports pages/pharmacy-admin/orders.html + js/pharmacy-admin.js's initOrders() (FR-6.2). */
export function PharmacyAdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    const res = await apiRequest<{ orders: Order[] }>('get', '/api/pharmacy-admin/orders');
    setOrders(res.ok ? res.data.orders : []);
  };

  useEffect(() => { load(); }, []);

  const advance = async (orderId: number) => {
    setBusyId(orderId);
    await apiRequest('post', `/api/pharmacy-admin/orders/${orderId}/advance`);
    setBusyId(null);
    load();
  };

  return (
    <>
      <div className="page-header"><div><h1>Process Orders</h1><p>{orders.length} orders</p></div></div>

      <div className="space-y-4">
        {orders.length === 0 && <div className="card p-6 text-center text-gray-400">No orders yet.</div>}
        {orders.map((o) => {
          const next = STATUS_FLOW[o.status];
          return (
            <div className="card p-5" key={o.order_id}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1"><span className="font-mono text-xs text-gray-400">{o.id}</span><Badge status={o.status} /></div>
                  <div className="font-semibold text-gray-800">{o.patient}</div>
                  <div className="text-xs text-gray-400">{o.phone} · {o.date} · {o.time}</div>
                </div>
                <div className="font-bold text-lg font-heading" style={{ color: '#5B3F8D' }}>{o.total}</div>
              </div>
              <div style={{ background: 'var(--gray-50)', borderRadius: '.75rem', padding: '.75rem', marginBottom: '1rem' }}>
                <div className="font-medium text-gray-500" style={{ fontSize: '.75rem', marginBottom: '.5rem' }}>Items ({o.items.length})</div>
                <div className="flex flex-wrap gap-2">
                  {o.items.map((i, idx) => (
                    <span style={{ fontSize: '.75rem', background: '#fff', border: '1px solid var(--gray-200)', padding: '.25rem .625rem', borderRadius: '.5rem', color: 'var(--gray-700)' }} key={idx}>{i}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {next ? (
                  <button className="btn btn-brand btn-sm" disabled={busyId === o.order_id} onClick={() => advance(o.order_id)}>
                    Mark as {next.charAt(0).toUpperCase() + next.slice(1)}
                  </button>
                ) : (
                  <span className="text-green-600 flex items-center gap-1.5 font-medium" style={{ fontSize: '.875rem' }}>✓ Delivered</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
