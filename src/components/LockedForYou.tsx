import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

const BENEFITS = [
  { title: "For you", text: "Your sections and firms first, with a one-tap filter." },
  { title: "Saved stories on every device", text: "Save now, read later on your phone or laptop." },
  { title: "Your subscriptions", text: "Latest headlines from WSJ, FT, Bloomberg or The Economist, if you subscribe." },
];

/**
 * The locked "For you" pill signed-out readers see, with a tooltip on what a free account adds.
 * Hover shows it on desktop (it stays open while the pointer is on it, so the link is clickable);
 * a click or tap pins it open, a second tap closes it, and Esc or a tap outside dismisses it.
 * The tooltip is absolutely positioned against a wrapper outside the sideways-scrolling pill row,
 * so the row can't clip it, and placed just under the pill wherever the row wraps.
 */
export function LockedForYou({ onSignIn }: { onSignIn: () => void }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const [top, setTop] = useState<number | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const id = useId();

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const close = () => {
    cancelClose();
    setOpen(false);
    setPinned(false);
  };

  // Mouse only: on touch screens the tap (click) handles it, so a tap never opens and closes at once.
  const onEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    cancelClose();
    setOpen(true);
  };
  const onLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || pinned) return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };

  const onClick = () => {
    if (!open) {
      setOpen(true);
      setPinned(true);
    } else if (!pinned) {
      setPinned(true); // opened by hover: a click keeps it open
    } else {
      close();
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // The pill's offsetParent is the positioned wrapper, so this is the pill's bottom edge within it.
  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (open && pill) setTop(pill.offsetTop + pill.offsetHeight);
  }, [open]);

  return (
    <span ref={rootRef} className="contents">
      <button
        ref={pillRef}
        type="button"
        onClick={onClick}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        aria-expanded={open}
        aria-controls={id}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-[13px] font-medium hover:border-accent hover:text-ink ${
          open ? "border-accent bg-surface text-ink" : "border-rule-strong bg-surface text-muted"
        }`}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </svg>
        For you
        <span className="sr-only">(what a free account adds)</span>
      </button>
      {open && (
        <div
          id={id}
          role="region"
          aria-label="What a free account adds"
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          style={top !== null ? { top } : undefined}
          className="absolute top-full left-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-rule bg-surface p-4 text-left shadow-lg"
        >
          <span aria-hidden className="absolute -top-1.5 left-7 h-3 w-3 rotate-45 border-t border-l border-rule bg-surface" />
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">Make it yours</p>
          <p className="mt-1 text-[14px] text-ink-soft">A free account adds:</p>
          <ul className="mt-2.5 space-y-2">
            {BENEFITS.map((b) => (
              <li key={b.title} className="grid grid-cols-[16px_1fr] gap-2 text-[14px] leading-snug">
                <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong className="font-semibold text-ink">{b.title}.</strong> <span className="text-ink-soft">{b.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              close();
              onSignIn();
            }}
            className="mt-3 text-[14px] font-semibold text-accent hover:underline"
          >
            Sign in or create an account →
          </button>
        </div>
      )}
    </span>
  );
}
