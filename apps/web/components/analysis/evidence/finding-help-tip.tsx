"use client";

import { CircleHelp } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface PopoverPosition {
  top: number;
  left: number;
  width: number;
}

function useHoverCapable(): boolean {
  const [hoverCapable, setHoverCapable] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHoverCapable(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return hoverCapable;
}

export function FindingHelpTip({
  description,
  label,
}: {
  description: string;
  label: string;
}) {
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCapable = useHoverCapable();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function showTip() {
    clearCloseTimer();
    setOpen(true);
  }

  function hideTipSoon() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  }

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!buttonRef.current) {
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      const width = Math.min(300, Math.max(220, window.innerWidth - 24));
      const margin = 12;
      let left = rect.left + rect.width / 2 - width / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

      const popoverHeight = popoverRef.current?.offsetHeight ?? 108;
      const preferredTop = rect.bottom + 8;
      const fitsBelow = preferredTop + popoverHeight <= window.innerHeight - margin;
      const top = fitsBelow ? preferredTop : Math.max(margin, rect.top - popoverHeight - 8);

      setPosition({ top, left, width });
    };

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, description]);

  useEffect(() => {
    if (!open || hoverCapable) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [hoverCapable, open]);

  useEffect(() => () => clearCloseTimer(), []);

  if (!description.trim()) {
    return null;
  }

  const popover =
    open && mounted && position
      ? createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            className="findingHelpPopover"
            role="tooltip"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            onMouseEnter={hoverCapable ? showTip : undefined}
            onMouseLeave={hoverCapable ? hideTipSoon : undefined}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {description}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`findingHelpTip ${open ? "findingHelpTipOpen" : ""}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onMouseEnter={hoverCapable ? showTip : undefined}
        onMouseLeave={hoverCapable ? hideTipSoon : undefined}
        onFocus={hoverCapable ? showTip : undefined}
        onBlur={hoverCapable ? hideTipSoon : undefined}
        onClick={(event) => {
          event.stopPropagation();
          if (!hoverCapable) {
            setOpen((current) => !current);
          }
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <CircleHelp size={14} strokeWidth={2.1} aria-hidden="true" />
      </button>
      {popover}
    </>
  );
}
