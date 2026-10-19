/**
 * Things that float: dialogs, the drawer, and menus.
 *
 * These are the only elements in the product allowed a shadow, because they are
 * the only ones that genuinely sit above the page. All of them close on Escape,
 * move focus inside when they open, and give it back to whatever opened them.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Lock the page behind an overlay without losing the scroll position. */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { overflow, paddingRight } = document.body.style;
    const width = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (width > 0) document.body.style.paddingRight = `${width}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [active]);
}

function useOverlay(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  const restoreTo = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    const node = ref.current;
    if (!node) return;
    const first = node.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node).focus();
  }, [open, ref]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const node = ref.current;
      if (!node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      restoreTo.current?.focus?.();
    };
  }, [open, onClose, ref]);
}

export function Dialog({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  width = "md",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "narrow" | "md" | "wide";
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const generated = useId();
  const headingId = labelledBy ?? `dialog-${generated.replace(/[:]/g, "")}`;
  useScrollLock(open);
  useOverlay(open, onClose, ref);

  if (!open) return null;
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div
        className={`dialog${width === "wide" ? " dialog--wide" : width === "narrow" ? " dialog--narrow" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={ref}
        tabIndex={-1}
      >
        <header className="dialog__head">
          <div>
            <h2 className="dialog__title" id={headingId}>
              {title}
            </h2>
            {sub ? <p className="dialog__sub">{sub}</p> : null}
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="dialog__body">{children}</div>
        {footer ? <footer className="dialog__foot">{footer}</footer> : null}
      </div>
    </>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  side = "right",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "right" | "left";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const generated = useId();
  const headingId = `drawer-${generated.replace(/[:]/g, "")}`;
  useScrollLock(open);
  useOverlay(open, onClose, ref);

  if (!open) return null;
  return createPortal(
    <>
      <div className="scrim scrim--soft" onClick={onClose} aria-hidden="true" />
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={ref}
        tabIndex={-1}
        style={side === "left" ? { right: "auto", left: 0, borderLeft: 0, borderRight: "1px solid var(--color-line-strong)" } : undefined}
      >
        <header className="drawer__head">
          <div style={{ minWidth: 0 }}>
            <h2 className="dialog__title" id={headingId}>
              {title}
            </h2>
            {sub ? <p className="dialog__sub">{sub}</p> : null}
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="drawer__body">{children}</div>
        {footer ? <footer className="drawer__foot">{footer}</footer> : null}
      </aside>
    </>,
    document.body,
  );
}

export interface MenuItem {
  label: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  hint?: string;
  disabled?: boolean;
}

/** A small anchored menu. Closes on Escape, on an outside click, and on select. */
export function Menu({ label, items, align = "right", icon, className, ariaLabel }: { label: ReactNode; items: MenuItem[]; align?: "left" | "right"; icon?: ReactNode; className?: string; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div className={`tip${className ? ` ${className}` : ""}`} ref={wrap} style={{ position: "relative" }}>
      <button type="button" className="btn btn--ghost btn--sm" aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {icon}
        {label}
      </button>
      {open ? (
        <div className="menu" role="menu" style={align === "right" ? { right: 0, top: "calc(100% + 0.3rem)" } : { left: 0, top: "calc(100% + 0.3rem)" }}>
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              className={`menu__item${item.danger ? " menu__item--danger" : ""}`}
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                close();
              }}
            >
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.hint ? <span className="label">{item.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="square" />
    </svg>
  );
}

/** A confirmation that says what will happen, rather than "are you sure". */
export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  danger,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width="narrow"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={danger ? "btn btn--danger" : "btn btn--primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: "var(--text-base)", lineHeight: 1.55 }}>{body}</p>
    </Dialog>
  );
}
