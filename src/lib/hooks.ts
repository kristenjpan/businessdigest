import { useCallback, useEffect, useState } from "react";

export type Route =
  | { page: "today" }
  | { page: "edition"; date: string }
  | { page: "archive" }
  | { page: "glossary" }
  | { page: "sources" }
  | { page: "about" }
  | { page: "saved" }
  | { page: "account" };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "").split("?")[0];
  const [head, arg] = path.split("/");
  switch (head) {
    case "edition":
      return arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? { page: "edition", date: arg } : { page: "archive" };
    case "archive":
    case "glossary":
    case "sources":
    case "about":
    case "saved":
    case "account":
      return { page: head };
    default:
      return { page: "today" };
  }
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

/** A string preference remembered in localStorage (best-effort; works without storage). */
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, allowed, fallback));
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        /* storage unavailable */
      }
    },
    [key],
  );
  return [value, update] as const;
}

export type Theme = "system" | "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useStoredChoice<Theme>("tda-theme", ["system", "light", "dark"], "system");
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);
  return [theme, setTheme] as const;
}

