import { useEffect, useRef, useState } from "react";
import { useAccount } from "../lib/account";

type Mode = "signin" | "signup" | "reset";

const TITLES: Record<Mode, string> = { signin: "Sign in", signup: "Create an account", reset: "Reset your password" };

/** Optional sign-in. Reading never requires it; an account syncs saved stories and preferences. */
export function SignInDialog({ onClose }: { onClose: () => void }) {
  const account = useAccount();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Close once a sign-in or sign-up succeeds.
  useEffect(() => {
    if (account.user) onClose();
  }, [account.user, onClose]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "reset") {
        const err = await account.sendPasswordReset(email.trim());
        if (err) setError(err);
        else setNotice("If an account exists for that email, a reset link is on its way.");
      } else {
        const err = mode === "signup" ? await account.signUp(email.trim(), password) : await account.signIn(email.trim(), password);
        if (err && err.startsWith("Check your email")) setNotice(err);
        else if (err) setError(err);
      }
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    setBusy(true);
    const err = await account.signInWithGoogle().catch((e: Error) => e.message);
    if (err) {
      setError(err);
      setBusy(false);
    }
    // On success the browser leaves for Google and comes back signed in.
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        className="w-full max-w-sm rounded-2xl border border-rule bg-surface p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="signin-title" className="font-display text-[24px] font-semibold text-ink">
            {TITLES[mode]}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 rounded-full p-2 text-muted hover:bg-surface-muted hover:text-ink">
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
          Save stories across devices and choose the sections and firms you follow.
        </p>

        {mode !== "reset" && account.googleEnabled && (
          <>
            <button
              type="button"
              onClick={google}
              disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-rule-strong bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-surface-muted disabled:opacity-60"
            >
              <svg aria-hidden viewBox="0 0 18 18" className="h-4 w-4">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
              </svg>
              Continue with Google
            </button>
            <div className="my-4 flex items-center gap-3 text-[12px] text-muted">
              <span className="h-px flex-1 bg-rule" />
              or use email
              <span className="h-px flex-1 bg-rule" />
            </div>
          </>
        )}

        <form onSubmit={submit} className={mode === "reset" || !account.googleEnabled ? "mt-5 space-y-3" : "space-y-3"}>
          <label className="block">
            <span className="text-[13px] font-medium text-ink-soft">Email</span>
            <input
              ref={emailRef}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-[15px] text-ink focus:border-accent focus:outline-none"
            />
          </label>
          {mode !== "reset" && (
            <label className="block">
              <span className="flex items-baseline justify-between text-[13px] font-medium text-ink-soft">
                Password
                {mode === "signin" && (
                  <button type="button" onClick={() => switchMode("reset")} className="text-[12px] font-medium text-accent hover:underline">
                    Forgot password?
                  </button>
                )}
              </span>
              <input
                type="password"
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-[15px] text-ink focus:border-accent focus:outline-none"
              />
              {mode === "signup" && <span className="mt-1 block text-[12px] text-muted">At least 8 characters.</span>}
            </label>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-down/10 px-3 py-2 text-[13px] text-down">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-ink">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Email me a reset link" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[13px] text-ink-soft">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button type="button" onClick={() => switchMode("signup")} className="font-semibold text-accent hover:underline">
                Create an account
              </button>
            </>
          ) : (
            <>
              {mode === "signup" ? "Already have an account?" : "Remembered it?"}{" "}
              <button type="button" onClick={() => switchMode("signin")} className="font-semibold text-accent hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>
        <p className="mt-4 border-t border-rule pt-3 text-center text-[12px] text-muted">Optional. The daily edition is always free to read.</p>
      </div>
    </div>
  );
}
