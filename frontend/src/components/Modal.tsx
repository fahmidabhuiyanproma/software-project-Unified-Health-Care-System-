import type { ReactNode } from 'react';

/** Ports the .modal-overlay/.modal-backdrop/.modal-box pattern used across dashboard pages. */
export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-box">{children}</div>
    </div>
  );
}
