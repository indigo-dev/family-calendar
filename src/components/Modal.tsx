import { useLayoutEffect, useRef, type ReactNode } from 'react';

interface Props {
  onClose: () => void;
  /** class of the full-screen layer – it gives the dimmed backdrop and centres the content */
  layerClass?: string;
  /** accessible name of the dialog */
  label?: string;
  /** a tap next to the content closes the dialog (default); Escape always does */
  dismissible?: boolean;
  children: ReactNode;
}

/**
 * Modal dialog on a native `<dialog>` opened with `showModal()`: the browser puts it in the top layer,
 * makes the rest of the page inert, keeps the focus inside and gives it back when it closes.
 * The `<dialog>` itself is the full-screen layer; the content is its child.
 */
export function Modal({ onClose, layerClass = 'modal-backdrop', label, dismissible = true, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // a tap closes only if it also started on the layer (not a text selection dragged out of the content)
  const downOnLayer = useRef(false);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog-layer ${layerClass}`}
      aria-label={label}
      onCancel={(e) => {
        // Escape: let React decide (the parent unmounts the dialog)
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        downOnLayer.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (dismissible && downOnLayer.current && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
