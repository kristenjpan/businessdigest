import { useSyncExternalStore } from "react";
import { useAccount } from "../lib/account";

const KEY = "tda-hide-signin-preview";

// The card is rendered twice (sidebar on desktop, inline on phones), so "Not now" goes through one
// shared store and hides both copies at once.
let hiddenNow = (() => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

function hidePreview() {
  hiddenNow = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* storage unavailable: hidden for this visit only */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const BENEFITS = [
  { title: "For you", text: "Your sections and firms first, with a one-tap filter." },
  { title: "Saved stories on every device", text: "Save now, read later on your phone or laptop." },
  { title: "Your subscriptions", text: "Latest headlines from WSJ, FT, Bloomberg or The Economist, if you subscribe." },
];

/** Shows signed-out readers what a free account adds. Hidden for good with "Not now". */
export function SignInPreview({ onSignIn, className = "" }: { onSignIn: () => void; className?: string }) {
  const { authEnabled, ready, user } = useAccount();
  const dismissed = useSyncExternalStore(subscribe, () => hiddenNow);
  if (!authEnabled || !ready || user || dismissed) return null;

  return (
    <div className={`print-hidden rounded-xl border border-rule bg-surface p-5 ${className}`}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">Make it yours</p>
      <p className="mt-1 text-[14px] text-ink-soft">A free account adds:</p>
      <ul className="mt-3 space-y-2.5">
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
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={onSignIn} className="rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-ink hover:opacity-90">
          Create a free account
        </button>
        <button type="button" onClick={hidePreview} className="text-[13px] font-medium text-muted hover:text-ink">
          Not now
        </button>
      </div>
      <p className="mt-3 text-[12px] text-muted">The daily edition stays free to read without one.</p>
    </div>
  );
}
