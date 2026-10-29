import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { useCart } from '../../context/CartContext';

interface Medicine { id: number; name: string; generic: string; brand: string | null; unit: string; price: number; stock: string }

type View = 'browse' | 'cart' | 'payment' | 'done';
type PayMethod = 'bkash' | 'nagad' | 'rocket';

const PAY_METHODS: { id: PayMethod; label: string; color: string; num: string }[] = [
  { id: 'bkash', label: 'bKash', color: '#E2136E', num: '01XXXXXXXXX' },
  { id: 'nagad', label: 'Nagad', color: '#F05822', num: '01XXXXXXXXX' },
  { id: 'rocket', label: 'Rocket (DBBL)', color: '#7B2D8B', num: '01XXXXXXXXX' },
];

/** Ports pages/patient/pharmacy.html + js/patient.js's initPharmacy() (FR-6.1, FR-7.1/7.2). */
export function Pharmacy() {
  const navigate = useNavigate();
  const { cart, totalQty, qtyOf, add, setQty, clear } = useCart();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>('browse');
  const [payMethod, setPayMethod] = useState<PayMethod>('bkash');
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [orderLabel, setOrderLabel] = useState('');
  const [orderPayLabel, setOrderPayLabel] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      apiRequest<{ medicines: Medicine[] }>('get', `/api/patient/medicines${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((res) => {
        if (res.ok) setMedicines(res.data.medicines);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const total = cart.reduce((s, c) => {
    const med = medicines.find((m) => m.id === c.id);
    return s + (med ? med.price * c.qty : 0);
  }, 0);

  const payNow = async () => {
    setPaying(true);
    setPayError(null);
    const items = cart.map((c) => ({ id: c.id, qty: c.qty }));
    const res = await apiRequest<{ order_label: string; total: number }>('post', '/api/patient/pharmacy-orders', { items, payment_method: payMethod });
    setPaying(false);
    if (!res.ok) {
      setPayError(res.data.message ?? 'Could not place order.');
      return;
    }
    const label = payMethod === 'bkash' ? 'bKash' : payMethod === 'nagad' ? 'Nagad' : 'Rocket';
    setOrderLabel(`Order #${res.data.order_label}`);
    setOrderPayLabel(`Payment of ৳ ${res.data.total} received via ${label}.`);
    clear();
    setView('done');
  };

  if (view === 'done') {
    return (
      <div className="max-w-md mx-auto" style={{ paddingTop: '2.5rem' }}>
        <div className="card p-10 text-center">
          <div className="result-icon-ok"><Icon name="check-circle" className="icon icon-32" /></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2 font-heading">Order Placed!</h2>
          <p className="text-gray-500 text-sm mb-2">{orderLabel}</p>
          <p className="text-gray-500 text-sm mb-4">{orderPayLabel}</p>
          <p className="text-xs text-gray-400 mb-6">Estimated delivery: 2–4 hours to your registered address.</p>
          <div className="text-xs rounded-xl mb-5" style={{ background: 'var(--amber-50)', color: 'var(--amber-700)', padding: '.625rem 1rem', border: '1px solid var(--amber-100)' }}>
            ⚠️ Test Mode — No real payment was processed
          </div>
          <button className="btn btn-brand btn-lg w-full" onClick={() => navigate('/patient/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (view === 'payment') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="page-header"><div><h1>Payment</h1><p>Secure checkout · Test Mode</p></div></div>
        <div className="card p-6 mb-4">
          <div className="text-xs rounded-lg mb-4" style={{ color: 'var(--amber-700)', background: 'var(--amber-50)', padding: '.5rem .75rem', border: '1px solid var(--amber-100)' }}>🔒 TEST MODE — No real transactions occur</div>
          <h3 className="font-semibold text-gray-800 mb-4 font-heading">Select Payment Method</h3>
          <div className="space-y-3 mb-6">
            {PAY_METHODS.map((m) => (
              <button key={m.id} type="button" className={`pay-method${payMethod === m.id ? ' selected' : ''}`} onClick={() => setPayMethod(m.id)}>
                <span style={{ width: '2.5rem', height: '2.5rem', borderRadius: '.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '.875rem', background: m.color }}>{m.label[0]}</span>
                <span className="flex-1"><span className="block font-semibold text-gray-800 text-sm">{m.label}</span><span className="block text-xs text-gray-400">{m.num}</span></span>
              </button>
            ))}
          </div>
          <div className="border-t pt-4 space-y-2 mb-4">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>৳ {total}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Delivery</span><span>৳ 50</span></div>
            <div className="flex justify-between font-bold text-gray-800"><span>Total</span><span style={{ color: '#5B3F8D' }}>৳ {total + 50}</span></div>
          </div>
          {payError && <div className="text-sm mb-3" style={{ color: 'var(--red-600)' }}>{payError}</div>}
          <button className="btn btn-brand btn-lg w-full" disabled={paying} onClick={payNow}>Pay ৳ {total + 50}</button>
        </div>
      </div>
    );
  }

  if (view === 'cart') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="page-header"><div><h1>Your Cart</h1><p>{cart.length} item types</p></div></div>
        {cart.length === 0 ? (
          <div className="card text-center" style={{ padding: '2.5rem 0' }}>
            <Icon name="shopping-cart" className="icon icon-40 text-gray-200" />
            <p className="text-gray-500 mt-4">Your cart is empty</p>
            <button className="btn btn-brand btn-md mt-4" onClick={() => setView('browse')}>Browse Medicines</button>
          </div>
        ) : (
          <>
            <div className="card p-4 mb-4">
              {cart.map((c) => {
                const med = medicines.find((m) => m.id === c.id);
                if (!med) return null;
                return (
                  <div className="flex items-center gap-3" style={{ padding: '.75rem 0', borderBottom: '1px solid var(--gray-100)' }} key={c.id}>
                    <div style={{ width: '2.5rem', height: '2.5rem', background: 'var(--purple-50)', borderRadius: '.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>💊</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-800">{med.name}</div>
                      <div className="text-xs text-gray-400">{med.brand || ''}</div>
                      <div className="text-sm font-bold mt-0.5" style={{ color: '#5B3F8D' }}>৳ {med.price * c.qty}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(c.id, c.qty - 1)} style={{ width: '1.75rem', height: '1.75rem', borderRadius: '.5rem', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" className="icon icon-12" /></button>
                      <span className="text-sm font-semibold" style={{ width: '1.5rem', textAlign: 'center' }}>{c.qty}</span>
                      <button onClick={() => add(c.id)} style={{ width: '1.75rem', height: '1.75rem', borderRadius: '.5rem', background: 'var(--purple-100)', color: 'var(--purple-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" className="icon icon-12" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="card p-4 mb-4">
              <div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Subtotal</span><span>৳ {total}</span></div>
              <div className="flex justify-between text-sm mb-3"><span className="text-gray-500">Delivery</span><span>৳ 50</span></div>
              <div className="flex justify-between font-bold text-gray-800 text-base"><span>Total</span><span style={{ color: '#5B3F8D' }}>৳ {total + 50}</span></div>
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary flex-1" onClick={() => setView('browse')}>Continue Shopping</button>
              <button className="btn btn-brand flex-1" onClick={() => setView('payment')}>Proceed to Payment</button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Online Pharmacy</h1><p>Order medicines with home delivery</p></div>
        <button className="btn btn-secondary btn-md" onClick={() => setView('cart')}><Icon name="shopping-cart" className="icon icon-16" /> Cart ({totalQty})</button>
      </div>
      <div className="relative mb-6">
        <Icon name="search" className="icon icon-16 text-gray-400" style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)' }} />
        <input className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="Search medicines by name or generic..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {medicines.map((med) => {
          const qty = qtyOf(med.id);
          return (
            <div className="card p-4 flex flex-col" key={med.id}>
              <div style={{ width: '3rem', height: '3rem', background: 'var(--purple-50)', borderRadius: '.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '.75rem' }}>💊</div>
              <div className="font-semibold text-gray-800 text-sm mb-0.5 font-heading">{med.name}</div>
              <div className="text-xs text-gray-400 mb-1">{med.generic}</div>
              <div className="text-xs text-gray-400 mb-2">{med.brand || ''}</div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm" style={{ color: '#5B3F8D' }}>৳ {med.price}<span className="text-xs text-gray-400 font-normal"> /{med.unit}</span></span>
                <Badge status={med.stock} />
              </div>
              {med.stock === 'out-of-stock' ? (
                <button disabled className="btn" style={{ marginTop: 'auto', background: 'var(--gray-100)', color: 'var(--gray-400)', width: '100%' }}>Out of Stock</button>
              ) : qty > 0 ? (
                <div className="flex items-center gap-2" style={{ marginTop: 'auto' }}>
                  <button onClick={() => setQty(med.id, qty - 1)} style={{ flex: 1, padding: '.5rem', borderRadius: '.75rem', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" className="icon icon-14" /></button>
                  <span className="text-sm font-bold" style={{ width: '2rem', textAlign: 'center' }}>{qty}</span>
                  <button onClick={() => add(med.id)} style={{ flex: 1, padding: '.5rem', borderRadius: '.75rem', background: '#5B3F8D', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" className="icon icon-14" /></button>
                </div>
              ) : (
                <button
                  onClick={() => add(med.id)} className="btn"
                  style={{ marginTop: 'auto', background: '#5B3F8D', color: '#fff', width: '100%', padding: '.625rem', borderRadius: '.75rem', fontWeight: 600, fontSize: '.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}
                >
                  <Icon name="plus" className="icon icon-15" /> Add to Cart
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
