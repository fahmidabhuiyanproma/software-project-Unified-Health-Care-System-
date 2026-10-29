/** Ports app.js's badgeClass()/badgeLabel()/badgeHTML(). */
const KNOWN = [
  'confirmed', 'completed', 'ready', 'delivered', 'in-stock', 'pending',
  'processing', 'low-stock', 'cancelled', 'out-of-stock',
];

const STATUS_ALIAS: Record<string, string> = { approved: 'confirmed', rejected: 'cancelled', discharged: 'completed' };

const LABELS: Record<string, string> = {
  confirmed: 'Confirmed', completed: 'Completed', ready: 'Ready', delivered: 'Delivered',
  'in-stock': 'In Stock', pending: 'Pending', processing: 'Processing', 'low-stock': 'Low Stock',
  cancelled: 'Cancelled', 'out-of-stock': 'Out of Stock',
  approved: 'Approved', rejected: 'Rejected', discharged: 'Discharged',
};

export function Badge({ status }: { status: string }) {
  const normalized = STATUS_ALIAS[status] ?? status;
  const cls = KNOWN.includes(normalized) ? `badge-${normalized}` : 'badge-default';
  const label = LABELS[status] ?? status;

  return (
    <span className={`badge ${cls}`}>
      <span className="dot" />
      {label}
    </span>
  );
}
