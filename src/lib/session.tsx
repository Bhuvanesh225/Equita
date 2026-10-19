/**
 * Who is signed in.
 *
 * One request on boot returns the person, their skill profile, every class they
 * are in and their unread count, so the shell can render immediately without a
 * waterfall of small requests.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { post, put, patch, del } from "./api";
import { useApi } from "./live";
import type { Classroom, MySkill, SessionPayload, User } from "./types";

interface SessionShape {
  user: User | null;
  skills: MySkill[];
  memberships: Classroom[];
  counts: { projects: number; unread: number; openTasks: number };
  clusters: Array<{ cluster: string; name: string; level: number }>;
  top: Array<{ slug: string; name: string; cluster: string; level: number; appetite: number }>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (input: { name: string; email: string; password: string; role: "student" | "teacher"; school?: string; joinCode?: string }) => Promise<{ user: User; joined: { id: string; name: string } | null }>;
  enterDemo: (email: string) => Promise<User>;
  signOut: () => Promise<void>;
  saveProfile: (input: Partial<Pick<User, "name" | "headline" | "school" | "capacity" | "hue" | "role">>) => Promise<void>;
  saveSkills: (skills: Array<{ slug: string; level: number; appetite: number }>) => Promise<void>;
  joinClass: (code: string) => Promise<{ id: string; name: string }>;
}

const SessionContext = createContext<SessionShape | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, refresh } = useApi<SessionPayload>("/api/auth/me", { live: false });

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await post<{ user: User }>("/api/auth/login", { email, password });
      // Wait for the session to actually hold this person before returning: the
      // sign-in screen navigates straight after, and a guard that reads a stale
      // "nobody is signed in" would bounce them back to the form.
      await refresh();
      return result.user;
    },
    [refresh],
  );

  const signUp = useCallback(
    async (input: { name: string; email: string; password: string; role: "student" | "teacher"; school?: string; joinCode?: string }) => {
      const result = await post<{ user: User; joined: { id: string; name: string } | null }>("/api/auth/signup", input);
      await refresh();
      return result;
    },
    [refresh],
  );

  const enterDemo = useCallback(
    async (email: string) => {
      const result = await post<{ user: User }>("/api/auth/demo", { email });
      await refresh();
      return result.user;
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await post("/api/auth/logout");
    await refresh();
  }, [refresh]);

  const saveProfile = useCallback(
    async (input: Partial<Pick<User, "name" | "headline" | "school" | "capacity" | "hue" | "role">>) => {
      await patch("/api/auth/me", input);
      await refresh();
    },
    [refresh],
  );

  const saveSkills = useCallback(
    async (skills: Array<{ slug: string; level: number; appetite: number }>) => {
      await put("/api/auth/me/skills", { skills });
      await refresh();
    },
    [refresh],
  );

  const joinClass = useCallback(
    async (code: string) => {
      const result = await post<{ classroom: { id: string; name: string } }>("/api/classrooms/join", { code });
      await refresh();
      return result.classroom;
    },
    [refresh],
  );

  const value = useMemo<SessionShape>(
    () => ({
      user: data?.user ?? null,
      skills: data?.skills ?? [],
      memberships: data?.memberships ?? [],
      counts: data?.counts ?? { projects: 0, unread: 0, openTasks: 0 },
      clusters: data?.clusters ?? [],
      top: data?.top ?? [],
      loading,
      error,
      refresh,
      signIn,
      signUp,
      enterDemo,
      signOut,
      saveProfile,
      saveSkills,
      joinClass,
    }),
    [data, loading, error, refresh, signIn, signUp, enterDemo, signOut, saveProfile, saveSkills, joinClass],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionShape {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession was used outside SessionProvider");
  return context;
}

/** Is this person a teacher of this class, or its owner? */
export function teaches(user: User | null, classroomId: string | null | undefined, memberships: Classroom[]) {
  if (!user || !classroomId) return false;
  const match = memberships.find((c) => c.id === classroomId);
  return match?.role === "teacher" || match?.role === "assistant" || match?.ownerId === user.id;
}

export { del };