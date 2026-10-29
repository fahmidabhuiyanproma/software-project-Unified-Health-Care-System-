import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export interface CartLine { id: number; qty: number }

const CART_KEY = 'syncura_cart_v1';

function loadCart(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

interface CartContextValue {
  cart: CartLine[];
  totalQty: number;
  qtyOf: (id: number) => number;
  add: (id: number) => void;
  setQty: (id: number, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Ports js/patient.js's pharmacy cart (localStorage key syncura_cart_v1), shared across the pharmacy page and the navbar badge. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* ignore */
    }
  }, [cart]);

  const qtyOf = useCallback((id: number) => cart.find((c) => c.id === id)?.qty ?? 0, [cart]);

  const add = useCallback((id: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing) return prev.map((c) => (c.id === id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { id, qty: 1 }];
    });
  }, []);

  const setQty = useCallback((id: number, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((c) => c.id !== id);
      const existing = prev.find((c) => c.id === id);
      if (existing) return prev.map((c) => (c.id === id ? { ...c, qty } : c));
      return [...prev, { id, qty }];
    });
  }, []);

  const clear = useCallback(() => setCart([]), []);

  const totalQty = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <CartContext.Provider value={{ cart, totalQty, qtyOf, add, setQty, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
