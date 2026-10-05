import { useCallback, useEffect, useState } from "react";
import type { Digest } from "../pipeline/types";
import { DigestView } from "./components/DigestView";
import { Masthead } from "./components/Masthead";
import { SignInDialog } from "./components/SignInDialog";
import { loadEdition, loadLatest } from "./lib/data";
import { generatedLabel, longDate } from "./lib/format";
import { useHashRoute, useTheme } from "./lib/hooks";
import { SITE } from "./lib/site";
import { AccountPage, SavedPage } from "./pages/AccountPages";
import { AboutPage, ArchivePage, EmptyState, Footer, GlossaryPage, LoadingState, SourcesPage } from "./pages/Pages";

export default function App() {
  const route = useHashRoute();
  const [theme, setTheme] = useTheme();
  const [signInOpen, setSignInOpen] = useState(false);
  const openSignIn = useCallback(() => setSignInOpen(true), []);
  const closeSignIn = useCallback(() => setSignInOpen(false), []);
  // undefined = loading, null = not found / not published yet
  const [latest, setLatest] = useState<Digest | null | undefined>(undefined);
  const [edition, setEdition] = useState<Digest | null | undefined>(undefined);

  useEffect(() => {
    loadLatest().then(setLatest);
  }, []);

  const editionDate = route.page === "edition" ? route.date : null;
  useEffect(() => {
    if (!editionDate) return;
    setEdition(undefined);
    loadEdition(editionDate).then(setEdition);
  }, [editionDate]);

  const shown = route.page === "edition" ? edition : latest;

  useEffect(() => {
    const page = route.page === "today" || route.page === "edition" ? (shown ? longDate(shown.date) : null) : route.page[0].toUpperCase() + route.page.slice(1);
    document.title = page ? `${SITE.name} · ${page}` : SITE.name;
  }, [route, shown]);

  const editionLine = latest ? `${longDate(latest.date)} · No. ${latest.edition} · Updated ${generatedLabel(latest.generatedAt)}` : null;

  let body: React.ReactNode;
  switch (route.page) {
    case "archive":
      body = <ArchivePage />;
      break;
    case "glossary":
      body = <GlossaryPage />;
      break;
    case "sources":
      body = <SourcesPage />;
      break;
    case "about":
      body = <AboutPage />;
      break;
    case "saved":
      body = <SavedPage onSignIn={openSignIn} />;
      break;
    case "account":
      body = <AccountPage onSignIn={openSignIn} />;
      break;
    case "edition":
      body =
        edition === undefined ? (
          <LoadingState />
        ) : edition === null ? (
          <p className="py-24 text-center text-muted">
            That edition isn't in the archive. <a href="#/archive" className="text-accent underline">Browse past editions</a>
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brass/40 bg-brass-soft px-4 py-3 text-[14px] text-ink-soft">
              <span>
                You're reading an archived edition: <strong className="text-ink">{longDate(edition.date)}</strong> (No. {edition.edition})
              </span>
              <a href="#/" className="font-semibold text-accent hover:underline">
                Go to today's edition →
              </a>
            </div>
            <DigestView key={edition.date} digest={edition} archived />
          </>
        );
      break;
    default:
      body = latest === undefined ? <LoadingState /> : latest === null ? <EmptyState /> : <DigestView digest={latest} />;
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Masthead route={route} theme={theme} onTheme={setTheme} editionLine={editionLine} onSignIn={openSignIn} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 outline-none sm:px-6">
        {body}
      </main>
      <Footer generatedAt={shown?.generatedAt} engine={shown?.engine} />
      {signInOpen && <SignInDialog onClose={closeSignIn} />}
    </div>
  );
}
