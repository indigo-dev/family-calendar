import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { t } from '../i18n';

/** Asks before a destructive action. The confirm button is red; Escape or a tap next to it cancels. */
export function ConfirmDialog({
  title,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
  children,
}: {
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  /** the action is running: buttons disabled, the dialog stays open */
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <Modal onClose={() => !busy && onClose()} label={title} dismissible={!busy}>
      <div className="modal confirm-dialog" role="alertdialog">
        <h2>{title}</h2>
        <div className="confirm-body">{children}</div>
        <div className="modal-actions confirm-actions">
          <button className="btn" onClick={onClose} disabled={busy} autoFocus>
            {t('common.cancel')}
          </button>
          <button className="btn danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
