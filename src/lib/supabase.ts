import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Optional reader accounts. Both values come from environment variables (Vercel → Settings →
 * Environment Variables, or a git-ignored .env.local for local runs). The publishable key is meant
 * to be public; Row Level Security in supabase/schema.sql is what protects each reader's data.
 * Without them the site runs exactly as before: no Sign in button, saves stay in the browser.
 */
// The dashboard also shows the Data API address (…/rest/v1/); the client needs the bare project URL.
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/(rest|auth)\/v1\/?$/, "").replace(/\/+$/, "");
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const authEnabled = Boolean(URL && KEY);

let client: Promise<SupabaseClient> | null = null;

/** Loads the Supabase library on first use, so readers who never sign in don't download it up front. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!authEnabled) return Promise.reject(new Error("Reader accounts are not configured"));
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL!, KEY!, {
      // PKCE returns ?code=… in the query string, which leaves the site's #/ routes alone.
      auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
    }),
  );
  return client;
}

/**
 * Which sign-in methods are switched on in the Supabase dashboard, read from its public settings
 * endpoint (no extra keys, and without loading the Supabase library). Google sign-in needs its own
 * Google Cloud setup, so the site offers it only once it's enabled there.
 */
export async function fetchEnabledProviders(): Promise<{ google: boolean }> {
  if (!authEnabled) return { google: false };
  const res = await fetch(`${URL}/auth/v1/settings`, { headers: { apikey: KEY! } });
  if (!res.ok) throw new Error(`Supabase settings: HTTP ${res.status}`);
  return enabledProviders(await res.json());
}

/** Reads Supabase's /auth/v1/settings response; anything unexpected counts as "off". */
export function enabledProviders(settings: unknown): { google: boolean } {
  const external = (settings as { external?: Record<string, unknown> } | null)?.external;
  return { google: external?.google === true };
}

/** Where sign-in, Google and password-reset links send readers back to. */
export function siteRoot(): string {
  return `${window.location.origin}${window.location.pathname}`;
}
