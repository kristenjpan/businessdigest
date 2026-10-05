import { useEffect, useState } from "react";
import { CORE_FIRMS, SECTIONS, TRACKED_FIRMS, type SectionId } from "../../pipeline/types";
import { useAccount } from "../lib/account";
import { hostOf, publishedLabel } from "../lib/format";
import { PageHeader } from "./Pages";

const inputClass = "mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-[15px] text-ink focus:border-accent focus:outline-none";
const primaryButton = "rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60";
const quietButton = "rounded-lg border border-rule px-4 py-2 text-[14px] font-semibold text-ink-soft hover:bg-surface-muted";

// ── Saved ────────────────────────────────────────────────────────────────

export function SavedPage({ onSignIn }: { onSignIn: () => void }) {
  const { saved, removeSaved, clearSaved, user, authEnabled } = useAccount();
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="max-w-3xl">
      <PageHeader kicker="Saved" title="Saved stories">
        {user ? (
          <>Saved to your account ({user.email}), so they follow you to any device where you sign in.</>
        ) : (
          <>
            Saved in this browser only.{" "}
            {authEnabled && (
              <>
                <button type="button" onClick={onSignIn} className="font-semibold text-accent hover:underline">
                  Sign in
                </button>{" "}
                to keep them in your account and see them on other devices.
              </>
            )}
          </>
        )}
      </PageHeader>

      {saved.length === 0 ? (
        <p className="rounded-xl border border-dashed border-rule-strong px-5 py-10 text-center text-ink-soft">
          Nothing saved yet. Tap <strong>Save</strong> on any story to keep it here.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {saved.map((s) => (
              <li key={s.id} data-section={s.section} className="relative rounded-xl border border-rule bg-surface p-5">
                <span aria-hidden className="sec-bg absolute top-5 bottom-5 left-0 w-[3px] rounded-r" />
                <a href={s.url} target="_blank" rel="noreferrer" className="font-display text-[19px] leading-snug font-semibold text-ink hover:underline">
                  {s.title}
                </a>
                <p className="mt-1 text-[13px] text-muted">
                  {s.source.name} · {publishedLabel(s.publishedAt)}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.takeaway}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
                  <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                    Read the original at {hostOf(s.url)} ↗
                  </a>
                  <button type="button" onClick={() => void removeSaved(s.id)} className="font-medium text-muted hover:text-down">
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-3">
            {confirmClear ? (
              <>
                <span className="text-[14px] text-ink-soft">Remove all {saved.length} saved stories?</span>
                <button
                  type="button"
                  onClick={() => {
                    void clearSaved();
                    setConfirmClear(false);
                  }}
                  className="rounded-lg bg-down px-4 py-2 text-[14px] font-semibold text-white hover:opacity-90"
                >
                  Yes, clear all
                </button>
                <button type="button" onClick={() => setConfirmClear(false)} className={quietButton}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} className={quietButton}>
                Clear all
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Account ──────────────────────────────────────────────────────────────

export function AccountPage({ onSignIn }: { onSignIn: () => void }) {
  const account = useAccount();

  if (!account.authEnabled) {
    return (
      <div className="max-w-2xl">
        <PageHeader kicker="Account" title="Accounts aren't switched on">
          This copy of the site has no sign-in configured. Everything is free to read, and Save keeps stories in this browser.
        </PageHeader>
      </div>
    );
  }
  if (!account.ready) return <p className="py-16 text-muted">Loading your account…</p>;
  if (!account.user) {
    return (
      <div className="max-w-2xl">
        <PageHeader kicker="Account" title="Make the digest yours">
          An account is optional. Sign in to keep saved stories across devices and to choose the sections and firms you follow. Your picks
          get a <strong>For you</strong> filter and move to the top of each edition.
        </PageHeader>
        <button type="button" onClick={onSignIn} className={primaryButton}>
          Sign in or create an account
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader kicker="Account" title="Your account">
        Signed in as <strong className="text-ink">{account.user.email}</strong>.
      </PageHeader>
      {account.recovering && <PasswordForm title="Set a new password" highlight />}
      <PreferencesForm />
      {!account.recovering && <PasswordForm title="Change password" />}
      <section className="mt-8 border-t border-rule pt-6">
        <button type="button" onClick={() => void account.signOut()} className={quietButton}>
          Sign out
        </button>
      </section>
    </div>
  );
}

function PreferencesForm() {
  const { prefs, setPrefs } = useAccount();
  const [sections, setSections] = useState<SectionId[]>(prefs.sections);
  const [firms, setFirms] = useState<string[]>(prefs.firms);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Account data loads just after sign-in; show it once it arrives.
  useEffect(() => {
    setSections(prefs.sections);
    setFirms(prefs.firms);
  }, [prefs]);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  async function save() {
    setBusy(true);
    const err = await setPrefs(
      SECTIONS.map((s) => s.id).filter((id) => sections.includes(id)),
      TRACKED_FIRMS.filter((f) => firms.includes(f)),
    );
    setBusy(false);
    setStatus(err ? { ok: false, text: err } : { ok: true, text: "Saved. Today's edition now has a For you filter." });
  }

  return (
    <section className="mt-2 rounded-xl border border-rule bg-surface p-5 sm:p-6">
      <h3 className="font-display text-[22px] font-semibold text-ink">What you follow</h3>
      <p className="mt-1 text-[14px] text-ink-soft">Stories in these sections, or that mention these firms, appear under For you. Your sections also move to the top.</p>

      <fieldset className="mt-5">
        <legend className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Sections</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <label key={s.id} data-section={s.id} className="flex items-center gap-2.5 rounded-lg border border-rule px-3 py-2 text-[14px] text-ink hover:bg-surface-muted">
              <input type="checkbox" checked={sections.includes(s.id)} onChange={() => setSections((l) => toggle(l, s.id))} className="h-4 w-4 accent-[var(--accent)]" />
              <span aria-hidden className="sec-bg h-2 w-2 rounded-sm" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Firms</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRACKED_FIRMS.map((f) => {
            const on = firms.includes(f);
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setFirms((l) => toggle(l, f))}
                className={`rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${
                  on ? "border-accent bg-accent text-accent-ink" : "border-rule text-ink-soft hover:bg-surface-muted"
                } ${CORE_FIRMS.includes(f) ? "font-semibold" : ""}`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className={primaryButton}>
          {busy ? "Saving…" : "Save preferences"}
        </button>
        {status && (
          <span role="status" className={`text-[14px] ${status.ok ? "text-up" : "text-down"}`}>
            {status.text}
          </span>
        )}
      </div>
    </section>
  );
}

function PasswordForm({ title, highlight }: { title: string; highlight?: boolean }) {
  const { updatePassword } = useAccount();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setStatus({ ok: false, text: "The two passwords don't match." });
    setBusy(true);
    const err = await updatePassword(password);
    setBusy(false);
    if (err) setStatus({ ok: false, text: err });
    else {
      setStatus({ ok: true, text: "Password updated." });
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <section className={`mt-6 rounded-xl border p-5 sm:p-6 ${highlight ? "border-brass/50 bg-brass-soft" : "border-rule bg-surface"}`}>
      <h3 className="font-display text-[20px] font-semibold text-ink">{title}</h3>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:max-w-sm">
        <label>
          <span className="text-[13px] font-medium text-ink-soft">New password</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </label>
        <label>
          <span className="text-[13px] font-medium text-ink-soft">Confirm new password</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? "Saving…" : "Update password"}
          </button>
          {status && (
            <span role="status" className={`text-[14px] ${status.ok ? "text-up" : "text-down"}`}>
              {status.text}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
