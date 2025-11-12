"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ResponsiveDialogProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg"; // desktop widths
  initialFocusRef?: React.RefObject<HTMLElement>;
  closeOnBackdrop?: boolean;
  className?: string; // extra classes for panel body
};

/**
 * ResponsiveDialog
 * - Mobile/tablet: fullscreen panel using 100dvh; sticky header/footer; scrollable body.
 * - Desktop: centered card with constrained width and max height.
 * - Closes on ESC and (optionally) on backdrop click.
 * - Locks background scroll while open.
 */
export default function ResponsiveDialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  initialFocusRef,
  closeOnBackdrop = true,
  className = "",
}: ResponsiveDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // lock scroll
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open]);

  // esc close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // focus management
  useEffect(() => {
    if (!open) return;
    const el = initialFocusRef?.current || panelRef.current?.querySelector<HTMLElement>("[tabindex],button,input,select,textarea,a[href]");
    el?.focus?.();
  }, [open, initialFocusRef]);

  const onBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!closeOnBackdrop) return;
      if (e.target === e.currentTarget) onClose?.();
    },
    [closeOnBackdrop, onClose]
  );

  if (!open) return null;

  // desktop widths
  const sizeClass = size === "sm" ? "md:w-[520px]" : size === "lg" ? "md:w-[920px]" : "md:w-[720px]";

  const content = (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={onBackdropClick} />
      <div className="absolute inset-0 grid place-items-center">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          className={`
            w-screen md:w-[90dvh] h-[100dvh] max-h-[100dvh] bg-white overflow-hidden md:rounded-2xl md:h-auto md:max-h-[90vh]
            md:${sizeClass} shadow-2xl
            flex flex-col
          `}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-100 bg-white">
            <div className="min-w-0 text-base font-semibold truncate">{title}</div>
            <button
              aria-label="Fechar"
              className="p-2 rounded-lg hover:bg-zinc-100"
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className={`flex-1 overflow-auto px-4 py-3 ${className}`}>{children}</div>

          {/* Footer (optional) */}
          {footer ? (
            <div className="sticky bottom-0 z-10 px-4 py-3 border-t border-zinc-100 bg-white">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );

  // portal to body for reliable stacking
  if (typeof window !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
