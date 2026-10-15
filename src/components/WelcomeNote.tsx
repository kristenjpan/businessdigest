import { useEffect, useState } from "react";

const KEY = "tda-welcomed";

function alreadyWelcomed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * One-line welcome for first-time visitors. It's recorded as seen the first time it appears, so it
 * shows on that first visit only; the reader can also dismiss it straight away.
 */
export function WelcomeNote() {
  const [show, setShow] = useState(() => !alreadyWelcomed());

  useEffect(() => {
    if (!show) return;
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable: it may show again next visit */
    }
  }, [show]);

  if (!show) return null;
  return (
    <div role="note" className="print-hidden mt-6 flex items-start justify-between gap-3 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-[14px] text-ink">
      <p>
        <strong className="font-semibold">New here?</strong> Start with{" "}
        <button type="button" onClick={() => scrollTo("sixty-second")} className="font-semibold text-accent underline-offset-2 hover:underline">
          the 60-Second Version
        </button>
        , then{" "}
        <button type="button" onClick={() => scrollTo("section-filters")} className="font-semibold text-accent underline-offset-2 hover:underline">
          filter by what you care about
        </button>
        .
      </p>
      <button type="button" onClick={() => setShow(false)} aria-label="Dismiss welcome" className="-mt-0.5 -mr-1 rounded p-1 leading-none text-muted hover:text-ink">
        ×
      </button>
    </div>
  );
}
