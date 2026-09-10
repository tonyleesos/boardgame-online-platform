import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Native modal provides focus trapping, Escape and an inert background. */
export function GameDialog({ title, children, onClose, className = "" }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <dialog ref={ref} className={`game-dialog panel ${className}`} aria-label={title}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="dialog-heading">
        <span>{title}</span>
        <button className="quiet icon-button" aria-label="關閉視窗" onClick={onClose}><X size={20} /></button>
      </div>
      {children}
    </dialog>, document.body,
  );
}
