import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DigestItem, SectionId } from "../../pipeline/types";
import { EMPTY_PREFS, type Prefs } from "./personalize";
import { mergeSaved, readLocalSaved, snapshot, writeLocalSaved, type SavedStory } from "./saved";
import { authEnabled, getSupabase, siteRoot } from "./supabase";

export interface Reader {
  id: string;
  email: string;
}

interface Account {
  authEnabled: boolean;
  /** False until the stored session (if any) has been checked. */
  ready: boolean;
  user: Reader | null;
  /** True after a reader opens a password-reset link, until they set a new password. */
  recovering: boolean;
  signUp(email: string, password: string): Promise<string | null>;
  signIn(email: string, password: string): Promise<string | null>;
  signInWithGoogle(): Promise<string | null>;
  sendPasswordReset(email: string): Promise<string | null>;
  updatePassword(password: string): Promise<string | null>;
  signOut(): Promise<void>;

  saved: SavedStory[];
  isSaved(id: string): boolean;
  toggleSave(item: DigestItem, editionDate: string): Promise<void>;
  removeSaved(id: string): Promise<void>;
  clearSaved(): Promise<void>;

  prefs: Prefs;
  setPrefs(sections: SectionId[], firms: string[]): Promise<string | null>;
}

const AccountContext = createContext<Account | null>(null);

export function useAccount(): Account {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside <AccountProvider>");
  return ctx;
}

/** Drops ?code=… (and auth errors) from the address bar after Supabase has read them. */
function cleanAuthParams() {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ["code", "error", "error_code", "error_description"]) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

interface SavedRow {
  story_id: string;
  story: SavedStory;
  saved_at: string;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!authEnabled);
  const [user, setUser] = useState<Reader | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [saved, setSaved] = useState<SavedStory[]>(readLocalSaved);
  const [prefs, setPrefsState] = useState<Prefs>(EMPTY_PREFS);
  const userRef = useRef<Reader | null>(null);
  userRef.current = user;

  // Restore any stored session and follow sign-in / sign-out. Data loading happens in the effect
  // below, not inside this callback, as Supabase recommends.
  useEffect(() => {
    if (!authEnabled) return;
    let unsubscribe: (() => void) | undefined;
    getSupabase()
      .then((sb) => {
        const { data } = sb.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY") {
            setRecovering(true);
            window.location.hash = "#/account";
          }
          const u = session?.user;
          setUser((prev) => (u ? (prev?.id === u.id ? prev : { id: u.id, email: u.email ?? "" }) : null));
          setReady(true);
          cleanAuthParams();
        });
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch((err) => {
        console.warn("Reader accounts unavailable:", err);
        setReady(true);
      });
    return () => unsubscribe?.();
  }, []);

  // On sign-in: move browser saves into the account, then load the account's saves and preferences.
  // On sign-out: show this browser's saves again (normally none, since they moved to the account).
  useEffect(() => {
    if (!user) {
      setPrefsState(EMPTY_PREFS);
      setSaved(readLocalSaved());
      return;
    }
    let cancelled = false;
    (async () => {
      const sb = await getSupabase();
      const local = readLocalSaved();
      if (local.length) {
        const { error } = await sb
          .from("saved_stories")
          .upsert(
            local.map((s) => ({ user_id: user.id, story_id: s.id, story: s, saved_at: s.savedAt })),
            { onConflict: "user_id,story_id", ignoreDuplicates: true },
          );
        if (!error) writeLocalSaved([]);
        else console.warn("Could not move browser saves to the account:", error.message);
      }
      const [savedRes, prefsRes] = await Promise.all([
        sb.from("saved_stories").select("story_id, story, saved_at").order("saved_at", { ascending: false }),
        sb.from("preferences").select("sections, firms").maybeSingle(),
      ]);
      if (cancelled) return;
      const remote = ((savedRes.data ?? []) as SavedRow[]).map((r) => ({ ...r.story, id: r.story_id, savedAt: r.saved_at }));
      setSaved(mergeSaved(readLocalSaved(), remote));
      if (prefsRes.data) setPrefsState({ sections: prefsRes.data.sections ?? [], firms: prefsRes.data.firms ?? [] });
      else setPrefsState(EMPTY_PREFS);
    })().catch((err) => console.warn("Could not load account data:", err));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: siteRoot() } });
    if (error) return error.message;
    if (!data.session) return "Check your email to confirm your account, then sign in.";
    return null;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: siteRoot() } });
    return error ? error.message : null;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const sb = await getSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: siteRoot() });
    return error ? error.message : null;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const sb = await getSupabase();
    const { error } = await sb.auth.updateUser({ password });
    if (!error) setRecovering(false);
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    const sb = await getSupabase();
    await sb.auth.signOut();
    setRecovering(false);
  }, []);

  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);
  const savedIdsRef = useRef(savedIds);
  savedIdsRef.current = savedIds;

  /**
   * Every change goes through a functional update, so quick successive taps build on the latest
   * list. Signed out, the list is mirrored to browser storage; signed in, the change is written to
   * the account and undone on the screen if the write fails.
   */
  const applySaved = useCallback((update: (list: SavedStory[]) => SavedStory[]) => {
    setSaved((prev) => {
      const next = update(prev);
      if (!userRef.current) writeLocalSaved(next);
      return next;
    });
  }, []);

  const removeSaved = useCallback(async (id: string) => {
    let removed: SavedStory | undefined;
    applySaved((list) => {
      removed = list.find((s) => s.id === id);
      return list.filter((s) => s.id !== id);
    });
    const u = userRef.current;
    if (!u) return;
    const { error } = await (await getSupabase()).from("saved_stories").delete().eq("story_id", id);
    if (error) {
      console.warn("Could not remove saved story:", error.message);
      if (removed) applySaved((list) => mergeSaved(list, [removed!]));
    }
  }, [applySaved]);

  const toggleSave = useCallback(async (item: DigestItem, editionDate: string) => {
    if (savedIdsRef.current.has(item.id)) return removeSaved(item.id);
    const entry = snapshot(item, editionDate);
    applySaved((list) => (list.some((s) => s.id === entry.id) ? list : [entry, ...list]));
    const u = userRef.current;
    if (!u) return;
    const { error } = await (await getSupabase())
      .from("saved_stories")
      .upsert({ user_id: u.id, story_id: entry.id, story: entry, saved_at: entry.savedAt }, { onConflict: "user_id,story_id" });
    if (error) {
      console.warn("Could not save story:", error.message);
      applySaved((list) => list.filter((s) => s.id !== entry.id));
    }
  }, [applySaved, removeSaved]);

  const clearSaved = useCallback(async () => {
    let before: SavedStory[] = [];
    applySaved((list) => {
      before = list;
      return [];
    });
    const u = userRef.current;
    if (!u) return;
    const { error } = await (await getSupabase()).from("saved_stories").delete().eq("user_id", u.id);
    if (error) {
      console.warn("Could not clear saved stories:", error.message);
      applySaved(() => before);
    }
  }, [applySaved]);

  const setPrefs = useCallback(async (sections: SectionId[], firms: string[]) => {
    const u = userRef.current;
    if (!u) return "Sign in to save preferences.";
    const { error } = await (await getSupabase())
      .from("preferences")
      .upsert({ user_id: u.id, sections, firms, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return error.message;
    setPrefsState({ sections, firms });
    return null;
  }, []);

  const value = useMemo<Account>(
    () => ({
      authEnabled,
      ready,
      user,
      recovering,
      signUp,
      signIn,
      signInWithGoogle,
      sendPasswordReset,
      updatePassword,
      signOut,
      saved,
      isSaved: (id) => savedIds.has(id),
      toggleSave,
      removeSaved,
      clearSaved,
      prefs,
      setPrefs,
    }),
    [ready, user, recovering, signUp, signIn, signInWithGoogle, sendPasswordReset, updatePassword, signOut, saved, savedIds, toggleSave, removeSaved, clearSaved, prefs, setPrefs],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
