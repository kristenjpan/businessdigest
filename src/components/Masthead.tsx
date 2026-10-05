import { useAccount } from "../lib/account";
import type { Route, Theme } from "../lib/hooks";
import { SITE } from "../lib/site";

const NAV: { href: string; label: string; pages: Route["page"][] }[] = [
  { href: "#/", label: "Today", pages: ["today"] },
  { href: "#/archive", label: "Archive", pages: ["archive", "edition"] },
  { href: "#/glossary", label: "Glossary", pages: ["glossary"] },
  { href: "#/sources", label: "Sources", pages: ["sources"] },
  { href: "#/about", label: "About", pages: ["about"] },
  { href: "#/saved", label: "Saved", pages: ["saved"] },
];

const THEME_NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const THEME_LABEL: Record<Theme, string> = { system: "Auto", light: "Light", dark: "Dark" };

interface Props {
  route: Route;
  theme: Theme;
  onTheme: (t: Theme) => void;
  editionLine: string | null;
  onSignIn: () => void;
}

export function Masthead({ route, theme, onTheme, editionLine, onSignIn }: Props) {
  const account = useAccount();
  return (
    <header className="bg-masthead text-masthead-ink print:border-b print:border-black">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-white/10 py-2 text-[12px] tracking-wide text-masthead-ink/70">
          <span className="tabular">{editionLine ?? "Daily investment intelligence"}</span>
          <span className="hidden sm:inline">Free to read · Account optional · Not investment advice</span>
        </div>

        <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
          <a href="#/" className="group block min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d9b25d]">Morning Edition</p>
            <h1 className="font-display mt-1 text-[34px] leading-none font-semibold sm:text-[44px]">{SITE.name}</h1>
            <p className="mt-2 max-w-xl text-[14px] text-masthead-ink/70">{SITE.tagline}</p>
          </a>

          <div className="print-hidden flex shrink-0 items-center gap-2">
            {account.authEnabled && account.ready &&
              (account.user ? (
                <a
                  href="#/account"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 py-1 pr-3 pl-1 text-[13px] font-medium text-masthead-ink hover:border-white/60"
                  title={`Signed in as ${account.user.email}`}
                >
                  <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-[#5cc4a6] text-[12px] font-semibold text-[#0a0f14] uppercase">
                    {account.user.email.charAt(0) || "?"}
                  </span>
                  Account
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="rounded-full bg-[#5cc4a6] px-3.5 py-1.5 text-[13px] font-semibold text-[#0a0f14] hover:bg-[#7ed3ba]"
                >
                  Sign in
                </button>
              ))}
            <button
              type="button"
              onClick={() => onTheme(THEME_NEXT[theme])}
              className="rounded-full border border-white/25 px-3 py-1.5 text-[13px] font-medium text-masthead-ink hover:border-white/60"
              aria-label={`Color theme: ${THEME_LABEL[theme]}. Click to change.`}
            >
              <ThemeIcon theme={theme} /> <span className="ml-1">{THEME_LABEL[theme]}</span>
            </button>
          </div>
        </div>

        <nav aria-label="Primary" className="print-hidden no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {NAV.map((n) => {
            const active = n.pages.includes(route.page);
            return (
              <a
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 border-b-2 px-3 pt-1 pb-2.5 text-[14px] font-medium transition-colors ${
                  active ? "border-[#5cc4a6] text-masthead-ink" : "border-transparent text-masthead-ink/65 hover:text-masthead-ink"
                }`}
              >
                {n.label}
                {n.href === "#/saved" && account.saved.length > 0 && (
                  <span className="tabular ml-1.5 rounded-full bg-white/15 px-1.5 py-px text-[11px]">{account.saved.length}</span>
                )}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark")
    return (
      <svg aria-hidden viewBox="0 0 16 16" className="inline h-3.5 w-3.5 align-[-2px]" fill="currentColor">
        <path d="M6 1.5a6.5 6.5 0 1 0 8.5 8.5A5.5 5.5 0 0 1 6 1.5Z" />
      </svg>
    );
  if (theme === "light")
    return (
      <svg aria-hidden viewBox="0 0 16 16" className="inline h-3.5 w-3.5 align-[-2px]" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="inline h-3.5 w-3.5 align-[-2px]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2a6 6 0 0 0 0 12Z" fill="currentColor" />
    </svg>
  );
}
